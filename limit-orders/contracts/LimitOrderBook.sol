// SPDX-License-Identifier: MIT
pragma solidity 0.8.24;

import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {IERC20Metadata} from "@openzeppelin/contracts/token/ERC20/extensions/IERC20Metadata.sol";
import {SafeERC20} from "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import {ReentrancyGuard} from "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
import {Pausable} from "@openzeppelin/contracts/utils/Pausable.sol";
import {Ownable} from "@openzeppelin/contracts/access/Ownable.sol";
import {Ownable2Step} from "@openzeppelin/contracts/access/Ownable2Step.sol";

/// @notice Minimal Chainlink-style price feed interface.
interface IAggregatorV3 {
    function decimals() external view returns (uint8);

    function latestRoundData()
        external
        view
        returns (uint80 roundId, int256 answer, uint256 startedAt, uint256 updatedAt, uint80 answeredInRound);
}

/// @notice Swaps `amountIn` of `tokenIn` (pulled from msg.sender) into `tokenOut` and sends the output to msg.sender.
interface ISwapAdapter {
    function swap(address tokenIn, address tokenOut, uint256 amountIn, uint256 minAmountOut)
        external
        returns (uint256 amountOut);
}

/// @title LimitOrderBook (v2)
/// @notice Escrow-based order book for tokenized stocks (stock token <-> quote stablecoin) on Base.
///
///  Order types (all executed by a permissionless keeper once the Chainlink price crosses the trigger):
///   - LIMIT_BUY      spend quote, receive stock, executes when price <= trigger
///   - LIMIT_SELL     spend stock, receive quote, executes when price >= trigger  (this is "take-profit")
///   - STOP_LOSS      spend stock, receive quote, executes when price <= trigger
///   - TRAILING_STOP  stop-loss whose trigger ratchets up with the highest price seen (never down)
///   - BRACKET        take-profit + stop-loss sharing ONE deposit; when one fills the other is cancelled (OCO)
///   - DCA plan       recurring buys on a schedule, optionally only below a price ceiling
///   - DCA sell plan  recurring sells (scale out) on a schedule, optionally only above a price floor
///   - BUY + EXITS    limit buy with an attached take-profit + stop-loss: when the buy fills, the bought tokens go
///                    straight into a bracket (OCO) for the owner, in the same transaction
///
///  Safety features:
///   - Oracle-bounded fills: every execution must receive at least (1 - maxDeviationBps) of what the Chainlink
///     price implies, even if the user's own minimum is looser. Bad pool prices revert and the order stays open.
///   - Stale-price protection (market closed / feed down): nothing executes on a stale feed.
///   - Owners can ALWAYS cancel and withdraw (even when paused).
///   - Risk changes to a live market (new feed, new adapter, looser deviation or staleness) are TIMELOCKED for
///     RISK_DELAY, so users can see them coming and cancel before they apply. Tightening applies immediately.
///   - Only allowlisted keepers can execute while `keeperOnly` is on. This stops anyone from wrapping an execution
///     in an atomic sandwich (flash-swap the pool, execute at the oracle floor, swap back).
///   - L2 sequencer uptime check: nothing executes while Base's sequencer is down or within the grace period after.
///   - Per-order caps per market (beta limits), per-market ESCROW ceilings (total value at risk), pause switch,
///     a pause-only guardian key, 2-step ownership.
///
/// @dev Prices are normalized to 8 decimals (USD per 1 whole stock token). The quote token is assumed to be worth $1.
///      `minAmountOut` is what the order owner receives AFTER the keeper fee.
contract LimitOrderBook is Ownable2Step, Pausable, ReentrancyGuard {
    using SafeERC20 for IERC20;

    enum OrderType {
        LIMIT_BUY,
        LIMIT_SELL,
        STOP_LOSS,
        TRAILING_STOP
    }

    enum Status {
        NONE,
        OPEN,
        EXECUTED,
        CANCELLED,
        EXPIRED
    }

    struct Market {
        IAggregatorV3 feed;
        uint8 feedDecimals;
        uint8 stockDecimals;
        bool enabled;
        uint32 maxStaleness; // seconds the feed may be old before execution is blocked
        uint16 maxDeviationBps; // max allowed fill shortfall vs. the oracle price (fill guard)
        ISwapAdapter adapter;
        uint128 maxStockIn; // per-order cap in stock token units (beta safety)
        uint128 maxQuoteIn; // per-order / per-plan cap in quote token units (beta safety)
    }

    struct Order {
        address owner;
        uint40 expiry;
        OrderType orderType;
        Status status;
        uint16 trailBps; // trailing stop only
        address stockToken;
        uint96 triggerPrice; // 8 decimals; for TRAILING_STOP this is the current stop level
        uint128 amountIn;
        uint128 minAmountOut;
        uint96 peakPrice; // trailing stop only: highest price seen
        uint64 linkedId; // bracket sibling order id, 0 if none
    }

    /// @notice Take-profit / stop-loss attached to a LIMIT_BUY, placed as a bracket when the buy fills.
    struct Exits {
        uint96 takeProfitPrice; // 8 decimals; must be above the buy trigger
        uint96 stopLossPrice; // 8 decimals; must be below the buy trigger
        uint16 slippageBps; // min-out tolerance for both exit legs (must exceed the keeper fee)
        uint32 duration; // seconds the exit legs stay open after the buy fills
    }

    struct Plan {
        address owner;
        Status status; // OPEN, EXECUTED (completed), CANCELLED
        uint16 remaining;
        uint32 interval;
        uint40 nextTime;
        address stockToken;
        uint96 maxPrice; // 0 = no ceiling
        uint128 amountPerBuy; // quote units
    }

    uint256 public constant MAX_DURATION = 90 days;
    uint16 public constant MAX_KEEPER_FEE_BPS = 100; // 1%
    uint16 public constant MIN_TRAIL_BPS = 50; // 0.5%
    uint16 public constant MAX_TRAIL_BPS = 5000; // 50%
    uint32 public constant MIN_DCA_INTERVAL = 1 hours;
    uint16 public constant MAX_DCA_BUYS = 365;
    uint16 public constant MAX_DEVIATION_BPS = 5000; // 50%, upper bound for the admin setting

    IERC20 public immutable quoteToken;
    uint8 public immutable quoteDecimals;
    uint16 public keeperFeeBps;
    uint256 public nextOrderId = 1;
    uint256 public nextPlanId = 1;

    mapping(address stockToken => Market) public markets;
    mapping(uint256 id => Order) private _orders;
    mapping(address user => uint256[]) private _userOrderIds;
    mapping(uint256 id => Plan) private _plans;

    // ---- v2.1: total-escrow ceilings, recurring sells, guardian ----
    /// @notice Ceiling on the total stock token held in escrow for a market (orders + sell plans). 0 = no ceiling.
    mapping(address stockToken => uint128) public maxStockEscrow;
    /// @notice Ceiling on the total quote token held in escrow for a market (buy orders + buy plans). 0 = no ceiling.
    mapping(address stockToken => uint128) public maxQuoteEscrow;
    mapping(address stockToken => uint256) public stockEscrowed;
    mapping(address stockToken => uint256) public quoteEscrowed;
    /// @notice True for recurring SELL plans. For these, Plan.amountPerBuy is stock per run and Plan.maxPrice is a price FLOOR.
    mapping(uint256 planId => bool) public isSellPlan;
    /// @notice Exits attached to an open LIMIT_BUY (cleared once it fills, is cancelled or expires).
    mapping(uint256 buyOrderId => Exits) public attachedExits;
    /// @notice Pending risk-increasing market change (applies after RISK_DELAY).
    struct PendingRisk {
        address feed;
        address adapter;
        uint32 maxStaleness;
        uint16 maxDeviationBps;
        uint40 eta;
    }

    uint256 public constant RISK_DELAY = 2 days;
    uint256 public constant SEQUENCER_GRACE = 1 hours;
    mapping(address stockToken => PendingRisk) public pendingRisk;
    /// @notice When true (default) only allowlisted keepers may execute orders and plans.
    bool public keeperOnly = true;
    mapping(address keeper => bool) public isKeeper;
    /// @notice Chainlink L2 sequencer uptime feed (Base: 0xBCF85224fc0756B9Fa45aA7892530B47e10b6433). 0 = no check.
    IAggregatorV3 public sequencerUptimeFeed;
    /// @notice Optional emergency key that can ONLY pause. It can never move funds, unpause or change markets.
    address public guardian;
    mapping(address user => uint256[]) private _userPlanIds;

    event MarketSet(address indexed stockToken, address feed, address adapter, uint16 maxDeviationBps, bool enabled);
    event KeeperFeeSet(uint16 bps);
    event OrderCreated(
        uint256 indexed id,
        address indexed owner,
        address indexed stockToken,
        OrderType orderType,
        uint256 amountIn,
        uint256 triggerPrice,
        uint256 minAmountOut,
        uint256 expiry
    );
    event BracketCreated(uint256 indexed takeProfitId, uint256 indexed stopLossId);
    event OrderUpdated(uint256 indexed id, uint256 triggerPrice, uint256 minAmountOut);
    event TrailUpdated(uint256 indexed id, uint256 peakPrice, uint256 stopPrice);
    event OrderCancelled(uint256 indexed id, address indexed owner);
    event OrderExpired(uint256 indexed id, address indexed owner);
    event OrderExecuted(
        uint256 indexed id,
        address indexed owner,
        address indexed keeper,
        uint256 price,
        uint256 amountIn,
        uint256 amountOutToOwner,
        uint256 keeperFee
    );
    event DcaCreated(
        uint256 indexed id,
        address indexed owner,
        address indexed stockToken,
        uint256 amountPerBuy,
        uint256 buys,
        uint256 interval,
        uint256 maxPrice
    );
    event DcaExecuted(
        uint256 indexed id,
        address indexed owner,
        address indexed keeper,
        uint256 price,
        uint256 amountIn,
        uint256 stockToOwner,
        uint256 keeperFee,
        uint256 remaining
    );
    event DcaCancelled(uint256 indexed id, address indexed owner, uint256 refunded);
    event DcaSellCreated(
        uint256 indexed id,
        address indexed owner,
        address indexed stockToken,
        uint256 amountPerSell,
        uint256 sells,
        uint256 interval,
        uint256 minPrice
    );
    event ExitsAttached(uint256 indexed buyId, uint256 takeProfitPrice, uint256 stopLossPrice, uint256 slippageBps, uint256 duration);
    event ExitsPlaced(uint256 indexed buyId, uint256 indexed takeProfitId, uint256 indexed stopLossId, uint256 amount);
    /// @dev reason: 1 = price already outside the exits, 2 = above per-order cap, 3 = escrow ceiling reached, 4 = dust
    event ExitsSkipped(uint256 indexed buyId, uint8 reason);
    event EscrowCapsSet(address indexed stockToken, uint256 maxStock, uint256 maxQuote);
    event GuardianSet(address indexed guardian);
    event RiskChangeQueued(address indexed stockToken, address feed, address adapter, uint32 maxStaleness, uint16 maxDeviationBps, uint256 eta);
    event RiskChangeCancelled(address indexed stockToken);
    event KeeperSet(address indexed keeper, bool allowed);
    event KeeperOnlySet(bool keeperOnly);
    event SequencerFeedSet(address feed);

    error MarketDisabled();
    error InvalidParams();
    error InvalidExpiry();
    error InvalidBracket();
    error AmountTooLarge();
    error AlreadyTriggered();
    error FeeOnTransferUnsupported();
    error NotOpen();
    error NotOwner();
    error OrderHasExpired();
    error NotExpired();
    error BadPrice();
    error StalePrice();
    error NotTriggered();
    error Slippage();
    error FillBelowOracleBound();
    error FeeTooHigh();
    error NotTrailing();
    error NoTrailUpdate();
    error TooEarly();
    error PriceAboveCeiling();
    error PriceBelowFloor();
    error EscrowCapReached();
    error NotGuardian();
    error NeedsTimelock();
    error TimelockNotReady();
    error NotKeeper();
    error SequencerDown();

    constructor(address quoteToken_, address owner_, uint16 keeperFeeBps_) Ownable(owner_) {
        if (quoteToken_ == address(0)) revert InvalidParams();
        if (keeperFeeBps_ > MAX_KEEPER_FEE_BPS) revert FeeTooHigh();
        quoteToken = IERC20(quoteToken_);
        quoteDecimals = IERC20Metadata(quoteToken_).decimals();
        keeperFeeBps = keeperFeeBps_;
    }

    // =====================================================================
    // Create orders
    // =====================================================================

    /// @notice Create a LIMIT_BUY, LIMIT_SELL (take-profit) or STOP_LOSS order and deposit the input token.
    /// @param triggerPrice USD per whole stock token, 8 decimals (e.g. $123.45 => 12_345_000_000)
    /// @param minAmountOut minimum the owner must receive after the keeper fee
    /// @param expiry unix timestamp after which the order can no longer execute
    function createOrder(
        address stockToken,
        OrderType orderType,
        uint128 amountIn,
        uint96 triggerPrice,
        uint128 minAmountOut,
        uint40 expiry
    ) external whenNotPaused nonReentrant returns (uint256 id) {
        id = _createOrder(stockToken, orderType, amountIn, triggerPrice, minAmountOut, expiry);
    }

    /// @notice LIMIT_BUY with an attached take-profit and stop-loss (one-triggers-OCO). When the buy fills, the
    ///         bought tokens (after the keeper fee) are escrowed straight into a bracket for the owner. If the exits
    ///         cannot be placed at fill time (price already beyond them, cap or ceiling), the tokens are sent to the
    ///         owner instead and `ExitsSkipped` explains why. The buy itself never fails because of its exits.
    function createLimitBuyWithExits(
        address stockToken,
        uint128 amountIn,
        uint96 triggerPrice,
        uint128 minAmountOut,
        uint40 expiry,
        Exits calldata exits
    ) external whenNotPaused nonReentrant returns (uint256 id) {
        if (exits.takeProfitPrice <= triggerPrice || exits.stopLossPrice == 0 || exits.stopLossPrice >= triggerPrice) {
            revert InvalidBracket();
        }
        if (exits.slippageBps <= keeperFeeBps || exits.slippageBps > 5000) revert InvalidParams();
        if (exits.duration < 1 hours || exits.duration > MAX_DURATION) revert InvalidExpiry();
        id = _createOrder(stockToken, OrderType.LIMIT_BUY, amountIn, triggerPrice, minAmountOut, expiry);
        attachedExits[id] = exits;
        emit ExitsAttached(id, exits.takeProfitPrice, exits.stopLossPrice, exits.slippageBps, exits.duration);
    }

    function _createOrder(
        address stockToken,
        OrderType orderType,
        uint128 amountIn,
        uint96 triggerPrice,
        uint128 minAmountOut,
        uint40 expiry
    ) internal returns (uint256 id) {
        if (orderType == OrderType.TRAILING_STOP) revert InvalidParams(); // use createTrailingStop
        Market memory m = _market(stockToken);
        bool isBuy = orderType == OrderType.LIMIT_BUY;
        _checkCommon(m, amountIn, minAmountOut, expiry, isBuy);
        if (triggerPrice == 0) revert InvalidParams();

        // Reject orders that would trigger immediately (they would behave like a market order by mistake).
        (uint256 price,) = _lastPrice(m);
        if (_isTriggered(orderType, price, triggerPrice)) revert AlreadyTriggered();

        _pullIn(isBuy ? quoteToken : IERC20(stockToken), amountIn);
        _escrowIn(stockToken, isBuy, amountIn);
        id = _store(
            Order({
                owner: msg.sender,
                expiry: expiry,
                orderType: orderType,
                status: Status.OPEN,
                trailBps: 0,
                stockToken: stockToken,
                triggerPrice: triggerPrice,
                amountIn: amountIn,
                minAmountOut: minAmountOut,
                peakPrice: 0,
                linkedId: 0
            })
        );
    }

    /// @notice Stop-loss that follows the price up. The stop sits `trailBps` below the highest price seen and never moves down.
    ///         The keeper "ratchets" it with `updateTrailing`; anyone can call that.
    function createTrailingStop(address stockToken, uint128 amountIn, uint16 trailBps, uint128 minAmountOut, uint40 expiry)
        external
        whenNotPaused
        nonReentrant
        returns (uint256 id)
    {
        Market memory m = _market(stockToken);
        if (trailBps < MIN_TRAIL_BPS || trailBps > MAX_TRAIL_BPS) revert InvalidParams();
        _checkCommon(m, amountIn, minAmountOut, expiry, false);

        (uint256 price,) = _lastPrice(m);
        _pullIn(IERC20(stockToken), amountIn);
        _escrowIn(stockToken, false, amountIn);
        id = _store(
            Order({
                owner: msg.sender,
                expiry: expiry,
                orderType: OrderType.TRAILING_STOP,
                status: Status.OPEN,
                trailBps: trailBps,
                stockToken: stockToken,
                triggerPrice: _stopFromPeak(price, trailBps),
                amountIn: amountIn,
                minAmountOut: minAmountOut,
                peakPrice: _toUint96(price),
                linkedId: 0
            })
        );
    }

    /// @notice Bracket (OCO): sell with BOTH a take-profit and a stop-loss from ONE deposit.
    ///         When either leg executes the other is cancelled automatically. Cancelling or refunding either leg
    ///         closes both and returns the deposit once.
    /// @return takeProfitId id of the take-profit leg; the stop-loss leg is `takeProfitId + 1`
    function createBracket(
        address stockToken,
        uint128 amountIn,
        uint96 takeProfitPrice,
        uint96 stopLossPrice,
        uint128 minOutTakeProfit,
        uint128 minOutStopLoss,
        uint40 expiry
    ) external whenNotPaused nonReentrant returns (uint256 takeProfitId, uint256 stopLossId) {
        Market memory m = _market(stockToken);
        _checkCommon(m, amountIn, minOutTakeProfit, expiry, false);
        if (takeProfitPrice == 0 || stopLossPrice == 0 || minOutStopLoss == 0) revert InvalidParams();
        if (stopLossPrice >= takeProfitPrice) revert InvalidBracket();

        (uint256 price,) = _lastPrice(m);
        if (price >= takeProfitPrice || price <= stopLossPrice) revert AlreadyTriggered();

        _pullIn(IERC20(stockToken), amountIn);
        _escrowIn(stockToken, false, amountIn);
        takeProfitId = nextOrderId;
        stopLossId = takeProfitId + 1;
        _store(
            Order({
                owner: msg.sender,
                expiry: expiry,
                orderType: OrderType.LIMIT_SELL,
                status: Status.OPEN,
                trailBps: 0,
                stockToken: stockToken,
                triggerPrice: takeProfitPrice,
                amountIn: amountIn,
                minAmountOut: minOutTakeProfit,
                peakPrice: 0,
                linkedId: uint64(stopLossId)
            })
        );
        _store(
            Order({
                owner: msg.sender,
                expiry: expiry,
                orderType: OrderType.STOP_LOSS,
                status: Status.OPEN,
                trailBps: 0,
                stockToken: stockToken,
                triggerPrice: stopLossPrice,
                amountIn: amountIn,
                minAmountOut: minOutStopLoss,
                peakPrice: 0,
                linkedId: uint64(takeProfitId)
            })
        );
        emit BracketCreated(takeProfitId, stopLossId);
    }

    /// @notice Edit the trigger price and minimum output of your open order in place (no cancel and re-create).
    function updateOrder(uint256 id, uint96 newTriggerPrice, uint128 newMinAmountOut) external whenNotPaused nonReentrant {
        Order storage o = _orders[id];
        if (o.status != Status.OPEN) revert NotOpen();
        if (o.owner != msg.sender) revert NotOwner();
        if (o.orderType == OrderType.TRAILING_STOP) revert InvalidParams();
        if (newTriggerPrice == 0 || newMinAmountOut == 0) revert InvalidParams();
        if (block.timestamp > o.expiry) revert OrderHasExpired();

        Market memory m = markets[o.stockToken];
        if (!m.enabled) revert MarketDisabled();
        (uint256 price,) = _lastPrice(m);
        if (_isTriggered(o.orderType, price, newTriggerPrice)) revert AlreadyTriggered();

        if (o.linkedId != 0) {
            uint256 sibling = _orders[o.linkedId].triggerPrice;
            if (o.orderType == OrderType.LIMIT_SELL) {
                if (newTriggerPrice <= sibling) revert InvalidBracket();
            } else if (newTriggerPrice >= sibling) {
                revert InvalidBracket();
            }
        }
        o.triggerPrice = newTriggerPrice;
        o.minAmountOut = newMinAmountOut;
        emit OrderUpdated(id, newTriggerPrice, newMinAmountOut);
    }

    // =====================================================================
    // Exit: cancel / refund (always available, even when paused)
    // =====================================================================

    /// @notice Cancel your open order (and its bracket sibling) and get the deposit back.
    function cancelOrder(uint256 id) external nonReentrant {
        Order storage o = _orders[id];
        if (o.status != Status.OPEN) revert NotOpen();
        if (o.owner != msg.sender) revert NotOwner();
        o.status = Status.CANCELLED;
        if (o.linkedId != 0) {
            _orders[o.linkedId].status = Status.CANCELLED;
            emit OrderCancelled(o.linkedId, msg.sender);
        }
        delete attachedExits[id];
        _refund(o);
        emit OrderCancelled(id, msg.sender);
    }

    /// @notice Anyone can return the deposit of an expired order (and its bracket sibling) to its owner.
    function refundExpired(uint256 id) external nonReentrant {
        Order storage o = _orders[id];
        if (o.status != Status.OPEN) revert NotOpen();
        if (block.timestamp <= o.expiry) revert NotExpired();
        o.status = Status.EXPIRED;
        if (o.linkedId != 0) {
            _orders[o.linkedId].status = Status.EXPIRED;
            emit OrderExpired(o.linkedId, o.owner);
        }
        delete attachedExits[id];
        _refund(o);
        emit OrderExpired(id, o.owner);
    }

    // =====================================================================
    // Keeper actions
    // =====================================================================

    /// @notice Execute an order whose trigger has been hit. The caller earns `keeperFeeBps` of the output.
    function executeOrder(uint256 id) external whenNotPaused nonReentrant returns (uint256 amountOutToOwner) {
        _onlyKeeper();
        Order storage o = _orders[id];
        if (o.status != Status.OPEN) revert NotOpen();
        if (block.timestamp > o.expiry) revert OrderHasExpired();

        (Market memory m, uint256 price) = _validateTrigger(o);

        // Effects before interactions. A filled bracket leg cancels its sibling (no refund: the deposit was spent).
        o.status = Status.EXECUTED;
        if (o.linkedId != 0) {
            _orders[o.linkedId].status = Status.CANCELLED;
            emit OrderCancelled(o.linkedId, o.owner);
        }

        bool isBuy = o.orderType == OrderType.LIMIT_BUY;
        _escrowOut(o.stockToken, isBuy, o.amountIn);
        uint256 amountOut = _swapRaw(
            isBuy ? address(quoteToken) : o.stockToken,
            isBuy ? o.stockToken : address(quoteToken),
            o.amountIn,
            o.minAmountOut,
            m.adapter
        );
        if (amountOut < _guardFloor(isBuy, o.amountIn, price, m)) revert FillBelowOracleBound();

        uint256 fee;
        if (isBuy && attachedExits[id].takeProfitPrice != 0) {
            (amountOutToOwner, fee) = _fillIntoExits(id, o, m, price, amountOut);
        } else {
            (amountOutToOwner, fee) = _payout(o, amountOut);
        }
        emit OrderExecuted(id, o.owner, msg.sender, price, o.amountIn, amountOutToOwner, fee);
    }

    /// @notice Ratchet a trailing stop up after the price made a new high. Callable by anyone (the keeper does it).
    function updateTrailing(uint256 id) external whenNotPaused returns (uint96 newStop) {
        Order storage o = _orders[id];
        if (o.status != Status.OPEN) revert NotOpen();
        if (o.orderType != OrderType.TRAILING_STOP) revert NotTrailing();
        if (block.timestamp > o.expiry) revert OrderHasExpired();

        Market memory m = markets[o.stockToken];
        if (!m.enabled) revert MarketDisabled();
        (uint256 price, uint256 updatedAt) = _lastPrice(m);
        if (updatedAt > block.timestamp || block.timestamp - updatedAt > m.maxStaleness) revert StalePrice();
        if (!_sequencerUp()) revert SequencerDown();
        if (price <= o.peakPrice) revert NoTrailUpdate();

        o.peakPrice = _toUint96(price);
        newStop = _stopFromPeak(price, o.trailBps);
        o.triggerPrice = newStop;
        emit TrailUpdated(id, price, newStop);
    }

    // =====================================================================
    // Recurring buys (DCA)
    // =====================================================================

    /// @notice Deposit `amountPerBuy * buys` of quote token. One buy is executed every `interval` seconds (first one is
    ///         immediately executable). If `maxPrice` is non-zero, buys are skipped while the price is above it.
    function createDca(address stockToken, uint128 amountPerBuy, uint16 buys, uint32 interval, uint96 maxPrice)
        external
        whenNotPaused
        nonReentrant
        returns (uint256 id)
    {
        Market memory m = _market(stockToken);
        if (amountPerBuy == 0 || buys == 0 || buys > MAX_DCA_BUYS || interval < MIN_DCA_INTERVAL) revert InvalidParams();
        uint256 total = uint256(amountPerBuy) * buys;
        if (total > m.maxQuoteIn) revert AmountTooLarge();

        _pullIn(quoteToken, total);
        _escrowIn(stockToken, true, total);
        id = nextPlanId++;
        _plans[id] = Plan({
            owner: msg.sender,
            status: Status.OPEN,
            remaining: buys,
            interval: interval,
            nextTime: uint40(block.timestamp),
            stockToken: stockToken,
            maxPrice: maxPrice,
            amountPerBuy: amountPerBuy
        });
        _userPlanIds[msg.sender].push(id);
        emit DcaCreated(id, msg.sender, stockToken, amountPerBuy, buys, interval, maxPrice);
    }

    /// @notice Execute the next scheduled buy of a plan. The caller earns `keeperFeeBps` of the stock bought.
    function executeDca(uint256 id) external whenNotPaused nonReentrant returns (uint256 stockToOwner) {
        _onlyKeeper();
        Plan storage p = _plans[id];
        if (p.status != Status.OPEN) revert NotOpen();
        if (block.timestamp < p.nextTime) revert TooEarly();

        (Market memory m, uint256 price) = _requireFreshMarket(p.stockToken);
        bool sell = isSellPlan[id];
        if (sell) {
            if (p.maxPrice != 0 && price < p.maxPrice) revert PriceBelowFloor();
        } else if (p.maxPrice != 0 && price > p.maxPrice) {
            revert PriceAboveCeiling();
        }

        // Effects first.
        uint128 amountIn = p.amountPerBuy;
        _escrowOut(p.stockToken, !sell, amountIn);
        p.remaining -= 1;
        p.nextTime = uint40(block.timestamp) + p.interval;
        if (p.remaining == 0) p.status = Status.EXECUTED;

        uint256 fee;
        (stockToOwner, fee) = sell ? _dcaSellFill(p, m, price, amountIn) : _dcaFill(p, m, price, amountIn);
        emit DcaExecuted(id, p.owner, msg.sender, price, amountIn, stockToOwner, fee, p.remaining);
    }

    /// @notice Cancel your plan and get the unspent quote token back. Works even when paused.
    function cancelDca(uint256 id) external nonReentrant {
        Plan storage p = _plans[id];
        if (p.status != Status.OPEN) revert NotOpen();
        if (p.owner != msg.sender) revert NotOwner();
        p.status = Status.CANCELLED;
        uint256 refund = uint256(p.amountPerBuy) * p.remaining;
        bool sell = isSellPlan[id];
        _escrowOut(p.stockToken, !sell, refund);
        (sell ? IERC20(p.stockToken) : quoteToken).safeTransfer(p.owner, refund);
        emit DcaCancelled(id, p.owner, refund);
    }

    /// @notice Recurring SELL (scale out / DCA-out): deposit `amountPerSell * sells` of the stock token. One sale of
    ///         `amountPerSell` runs every `interval` seconds. If `minPrice` is non-zero, sales are skipped while the
    ///         price is below it. `executeDca` / `cancelDca` / `canExecuteDca` are shared with buy plans.
    ///         Each `DcaExecuted` reports `amountIn` = stock sold and `stockToOwner` = quote paid to the owner.
    function createDcaSell(address stockToken, uint128 amountPerSell, uint16 sells, uint32 interval, uint96 minPrice)
        external
        whenNotPaused
        nonReentrant
        returns (uint256 id)
    {
        Market memory m = _market(stockToken);
        if (amountPerSell == 0 || sells == 0 || sells > MAX_DCA_BUYS || interval < MIN_DCA_INTERVAL) revert InvalidParams();
        uint256 total = uint256(amountPerSell) * sells;
        if (total > m.maxStockIn) revert AmountTooLarge();

        _pullIn(IERC20(stockToken), total);
        _escrowIn(stockToken, false, total);
        id = nextPlanId++;
        _plans[id] = Plan({
            owner: msg.sender,
            status: Status.OPEN,
            remaining: sells,
            interval: interval,
            nextTime: uint40(block.timestamp),
            stockToken: stockToken,
            maxPrice: minPrice,
            amountPerBuy: amountPerSell
        });
        isSellPlan[id] = true;
        _userPlanIds[msg.sender].push(id);
        emit DcaSellCreated(id, msg.sender, stockToken, amountPerSell, sells, interval, minPrice);
    }

    // =====================================================================
    // Views
    // =====================================================================

    function getOrder(uint256 id) external view returns (Order memory) {
        return _orders[id];
    }

    function getPlan(uint256 id) external view returns (Plan memory) {
        return _plans[id];
    }

    /// @notice Orders with ids in [fromId, toId] (inclusive), clamped to existing ids.
    function getOrdersRange(uint256 fromId, uint256 toId)
        external
        view
        returns (uint256[] memory ids, Order[] memory list)
    {
        if (fromId == 0) fromId = 1;
        if (toId >= nextOrderId) toId = nextOrderId - 1;
        if (toId < fromId) return (new uint256[](0), new Order[](0));
        uint256 n = toId - fromId + 1;
        ids = new uint256[](n);
        list = new Order[](n);
        for (uint256 i = 0; i < n; i++) {
            ids[i] = fromId + i;
            list[i] = _orders[fromId + i];
        }
    }

    /// @notice Plans with ids in [fromId, toId] (inclusive), clamped to existing ids.
    function getPlansRange(uint256 fromId, uint256 toId)
        external
        view
        returns (uint256[] memory ids, Plan[] memory list)
    {
        if (fromId == 0) fromId = 1;
        if (toId >= nextPlanId) toId = nextPlanId - 1;
        if (toId < fromId) return (new uint256[](0), new Plan[](0));
        uint256 n = toId - fromId + 1;
        ids = new uint256[](n);
        list = new Plan[](n);
        for (uint256 i = 0; i < n; i++) {
            ids[i] = fromId + i;
            list[i] = _plans[fromId + i];
        }
    }

    function ordersOf(address user) external view returns (uint256[] memory) {
        return _userOrderIds[user];
    }

    function plansOf(address user) external view returns (uint256[] memory) {
        return _userPlanIds[user];
    }

    /// @notice Latest feed price normalized to 8 decimals, and its timestamp.
    function currentPrice(address stockToken) external view returns (uint256 price, uint256 updatedAt) {
        Market memory m = markets[stockToken];
        if (address(m.feed) == address(0)) revert MarketDisabled();
        return _lastPrice(m);
    }

    /// @notice True if `executeOrder(id)` would pass its trigger checks right now (swap output is checked at execution).
    function canExecute(uint256 id) external view returns (bool) {
        Order storage o = _orders[id];
        if (paused() || o.status != Status.OPEN || block.timestamp > o.expiry) return false;
        (bool ok, uint256 price,) = _freshPrice(o.stockToken);
        if (!ok) return false;
        return _isTriggered(o.orderType, price, o.triggerPrice);
    }

    /// @notice True if `updateTrailing(id)` would succeed (a new high was made).
    function canUpdateTrailing(uint256 id) external view returns (bool) {
        Order storage o = _orders[id];
        if (paused() || o.status != Status.OPEN || o.orderType != OrderType.TRAILING_STOP) return false;
        if (block.timestamp > o.expiry) return false;
        (bool ok, uint256 price,) = _freshPrice(o.stockToken);
        return ok && price > o.peakPrice;
    }

    /// @notice True if `executeDca(id)` would pass its checks right now (swap output is checked at execution).
    function canExecuteDca(uint256 id) external view returns (bool) {
        Plan storage p = _plans[id];
        if (paused() || p.status != Status.OPEN || block.timestamp < p.nextTime) return false;
        (bool ok, uint256 price,) = _freshPrice(p.stockToken);
        if (!ok) return false;
        if (p.maxPrice == 0) return true;
        return isSellPlan[id] ? price >= p.maxPrice : price <= p.maxPrice;
    }

    // =====================================================================
    // Admin (use a multisig; consider a timelock before holding real value)
    // =====================================================================

    function setMarket(
        address stockToken,
        address feed,
        uint32 maxStaleness,
        address adapter,
        uint128 maxStockIn,
        uint128 maxQuoteIn,
        uint16 maxDeviationBps,
        bool enabled
    ) external onlyOwner {
        if (stockToken == address(0) || feed == address(0) || adapter == address(0)) revert InvalidParams();
        if (maxDeviationBps == 0 || maxDeviationBps > MAX_DEVIATION_BPS) revert InvalidParams();
        Market storage m = markets[stockToken];
        if (address(m.feed) != address(0)) {
            // Live market: anything that could make fills worse for users must go through queueRiskChange.
            if (
                feed != address(m.feed) || adapter != address(m.adapter) || maxStaleness > m.maxStaleness
                    || maxDeviationBps > m.maxDeviationBps
            ) revert NeedsTimelock();
        }
        m.feed = IAggregatorV3(feed);
        m.feedDecimals = IAggregatorV3(feed).decimals();
        m.stockDecimals = IERC20Metadata(stockToken).decimals();
        m.enabled = enabled;
        m.maxStaleness = maxStaleness;
        m.maxDeviationBps = maxDeviationBps;
        m.adapter = ISwapAdapter(adapter);
        m.maxStockIn = maxStockIn;
        m.maxQuoteIn = maxQuoteIn;
        emit MarketSet(stockToken, feed, adapter, maxDeviationBps, enabled);
    }

    function setKeeperFeeBps(uint16 bps) external onlyOwner {
        if (bps > MAX_KEEPER_FEE_BPS) revert FeeTooHigh();
        keeperFeeBps = bps;
        emit KeeperFeeSet(bps);
    }

    /// @notice Total-value ceilings for a market (0 = no ceiling). Bounds what a bug or a bad feed can put at risk.
    function setEscrowCaps(address stockToken, uint128 maxStock, uint128 maxQuote) external onlyOwner {
        if (stockToken == address(0)) revert InvalidParams();
        maxStockEscrow[stockToken] = maxStock;
        maxQuoteEscrow[stockToken] = maxQuote;
        emit EscrowCapsSet(stockToken, maxStock, maxQuote);
    }

    /// @notice Queue a risk-increasing change for a live market. It can be applied after RISK_DELAY.
    function queueRiskChange(address stockToken, address feed, address adapter, uint32 maxStaleness, uint16 maxDeviationBps)
        external
        onlyOwner
    {
        if (address(markets[stockToken].feed) == address(0)) revert MarketDisabled();
        if (feed == address(0) || adapter == address(0)) revert InvalidParams();
        if (maxDeviationBps == 0 || maxDeviationBps > MAX_DEVIATION_BPS) revert InvalidParams();
        uint40 eta = uint40(block.timestamp + RISK_DELAY);
        pendingRisk[stockToken] = PendingRisk(feed, adapter, maxStaleness, maxDeviationBps, eta);
        emit RiskChangeQueued(stockToken, feed, adapter, maxStaleness, maxDeviationBps, eta);
    }

    function cancelRiskChange(address stockToken) external onlyOwner {
        delete pendingRisk[stockToken];
        emit RiskChangeCancelled(stockToken);
    }

    function applyRiskChange(address stockToken) external onlyOwner {
        PendingRisk memory r = pendingRisk[stockToken];
        if (r.eta == 0 || block.timestamp < r.eta) revert TimelockNotReady();
        delete pendingRisk[stockToken];
        Market storage m = markets[stockToken];
        m.feed = IAggregatorV3(r.feed);
        m.feedDecimals = IAggregatorV3(r.feed).decimals();
        m.adapter = ISwapAdapter(r.adapter);
        m.maxStaleness = r.maxStaleness;
        m.maxDeviationBps = r.maxDeviationBps;
        emit MarketSet(stockToken, r.feed, r.adapter, r.maxDeviationBps, m.enabled);
    }

    function setKeeper(address keeper, bool allowed) external onlyOwner {
        isKeeper[keeper] = allowed;
        emit KeeperSet(keeper, allowed);
    }

    /// @notice Turn the keeper allowlist off only if your keepers are down and users need fills (liveness fallback).
    function setKeeperOnly(bool on) external onlyOwner {
        keeperOnly = on;
        emit KeeperOnlySet(on);
    }

    function setSequencerUptimeFeed(address feed) external onlyOwner {
        sequencerUptimeFeed = IAggregatorV3(feed);
        emit SequencerFeedSet(feed);
    }

    /// @notice Set (or clear with address(0)) the pause-only guardian.
    function setGuardian(address guardian_) external onlyOwner {
        guardian = guardian_;
        emit GuardianSet(guardian_);
    }

    /// @notice Owner or guardian can pause. Only the owner can unpause. Exits (cancel / refund) always work.
    function pause() external {
        if (msg.sender != owner() && msg.sender != guardian) revert NotGuardian();
        _pause();
    }

    function unpause() external onlyOwner {
        _unpause();
    }

    // =====================================================================
    // Internals
    // =====================================================================

    function _onlyKeeper() internal view {
        if (keeperOnly && !isKeeper[msg.sender]) revert NotKeeper();
    }

    /// @dev Chainlink L2 sequencer uptime: answer 0 = up. Wait SEQUENCER_GRACE after it comes back.
    function _sequencerUp() internal view returns (bool) {
        IAggregatorV3 f = sequencerUptimeFeed;
        if (address(f) == address(0)) return true;
        try f.latestRoundData() returns (uint80, int256 answer, uint256 startedAt, uint256, uint80) {
            if (answer != 0 || startedAt == 0) return false;
            return block.timestamp - startedAt > SEQUENCER_GRACE;
        } catch {
            return false;
        }
    }

    function _market(address stockToken) internal view returns (Market memory m) {
        m = markets[stockToken];
        if (!m.enabled) revert MarketDisabled();
    }

    function _checkCommon(Market memory m, uint128 amountIn, uint128 minAmountOut, uint40 expiry, bool isBuy)
        internal
        view
    {
        if (amountIn == 0 || minAmountOut == 0) revert InvalidParams();
        if (expiry <= block.timestamp || expiry > block.timestamp + MAX_DURATION) revert InvalidExpiry();
        if (amountIn > (isBuy ? m.maxQuoteIn : m.maxStockIn)) revert AmountTooLarge();
    }

    function _pullIn(IERC20 token, uint256 amount) internal {
        uint256 balBefore = token.balanceOf(address(this));
        token.safeTransferFrom(msg.sender, address(this), amount);
        if (token.balanceOf(address(this)) - balBefore != amount) revert FeeOnTransferUnsupported();
    }

    function _store(Order memory o) internal returns (uint256 id) {
        id = nextOrderId++;
        _orders[id] = o;
        _userOrderIds[o.owner].push(id);
        emit OrderCreated(id, o.owner, o.stockToken, o.orderType, o.amountIn, o.triggerPrice, o.minAmountOut, o.expiry);
    }

    function _validateTrigger(Order storage o) internal view returns (Market memory m, uint256 price) {
        m = markets[o.stockToken];
        if (!m.enabled) revert MarketDisabled();
        uint256 updatedAt;
        (price, updatedAt) = _lastPrice(m);
        if (updatedAt > block.timestamp || block.timestamp - updatedAt > m.maxStaleness) revert StalePrice();
        if (!_sequencerUp()) revert SequencerDown();
        if (!_isTriggered(o.orderType, price, o.triggerPrice)) revert NotTriggered();
    }

    /// @dev Approves the adapter, swaps, and returns the actual output measured by balance change.
    function _swapRaw(address tokenIn, address tokenOut, uint256 amountIn, uint256 minOut, ISwapAdapter adapter)
        internal
        returns (uint256 amountOut)
    {
        IERC20(tokenIn).forceApprove(address(adapter), amountIn);
        uint256 outBefore = IERC20(tokenOut).balanceOf(address(this));
        adapter.swap(tokenIn, tokenOut, amountIn, minOut);
        IERC20(tokenIn).forceApprove(address(adapter), 0);
        amountOut = IERC20(tokenOut).balanceOf(address(this)) - outBefore;
    }

    function _payout(Order storage o, uint256 amountOut) internal returns (uint256 toOwner, uint256 fee) {
        fee = (amountOut * keeperFeeBps) / 10_000;
        toOwner = amountOut - fee;
        if (toOwner < o.minAmountOut) revert Slippage();

        IERC20 tokenOut = o.orderType == OrderType.LIMIT_BUY ? IERC20(o.stockToken) : quoteToken;
        if (fee > 0) tokenOut.safeTransfer(msg.sender, fee);
        tokenOut.safeTransfer(o.owner, toOwner);
    }

    function _requireFreshMarket(address stockToken) internal view returns (Market memory m, uint256 price) {
        m = markets[stockToken];
        if (!m.enabled) revert MarketDisabled();
        uint256 updatedAt;
        (price, updatedAt) = _lastPrice(m);
        if (updatedAt > block.timestamp || block.timestamp - updatedAt > m.maxStaleness) revert StalePrice();
        if (!_sequencerUp()) revert SequencerDown();
    }

    function _dcaFill(Plan storage p, Market memory m, uint256 price, uint128 amountIn)
        internal
        returns (uint256 stockToOwner, uint256 fee)
    {
        uint256 floorOut = _guardFloor(true, amountIn, price, m);
        uint256 out = _swapRaw(address(quoteToken), p.stockToken, amountIn, floorOut, m.adapter);
        if (out < floorOut) revert FillBelowOracleBound();

        fee = (out * keeperFeeBps) / 10_000;
        stockToOwner = out - fee;
        IERC20 stock = IERC20(p.stockToken);
        if (fee > 0) stock.safeTransfer(msg.sender, fee);
        stock.safeTransfer(p.owner, stockToOwner);
    }

    function _escrowIn(address stockToken, bool isQuote, uint256 amount) internal {
        if (isQuote) {
            uint256 total = quoteEscrowed[stockToken] + amount;
            uint128 cap = maxQuoteEscrow[stockToken];
            if (cap != 0 && total > cap) revert EscrowCapReached();
            quoteEscrowed[stockToken] = total;
        } else {
            uint256 total = stockEscrowed[stockToken] + amount;
            uint128 cap = maxStockEscrow[stockToken];
            if (cap != 0 && total > cap) revert EscrowCapReached();
            stockEscrowed[stockToken] = total;
        }
    }

    /// @dev Saturating on purpose: accounting must never be able to block a user's exit.
    function _escrowOut(address stockToken, bool isQuote, uint256 amount) internal {
        if (isQuote) {
            uint256 cur = quoteEscrowed[stockToken];
            quoteEscrowed[stockToken] = cur > amount ? cur - amount : 0;
        } else {
            uint256 cur = stockEscrowed[stockToken];
            stockEscrowed[stockToken] = cur > amount ? cur - amount : 0;
        }
    }

    function _dcaSellFill(Plan storage p, Market memory m, uint256 price, uint128 amountIn)
        internal
        returns (uint256 quoteToOwner, uint256 fee)
    {
        uint256 floorOut = _guardFloor(false, amountIn, price, m);
        uint256 out = _swapRaw(p.stockToken, address(quoteToken), amountIn, floorOut, m.adapter);
        if (out < floorOut) revert FillBelowOracleBound();

        fee = (out * keeperFeeBps) / 10_000;
        quoteToOwner = out - fee;
        if (fee > 0) quoteToken.safeTransfer(msg.sender, fee);
        quoteToken.safeTransfer(p.owner, quoteToOwner);
    }

    /// @dev Pays the keeper, then escrows the bought tokens into a TP/SL bracket for the owner, or delivers them.
    function _fillIntoExits(uint256 buyId, Order storage o, Market memory m, uint256 price, uint256 amountOut)
        internal
        returns (uint256 toOwner, uint256 fee)
    {
        fee = (amountOut * keeperFeeBps) / 10_000;
        toOwner = amountOut - fee;
        if (toOwner < o.minAmountOut) revert Slippage();
        IERC20 stock = IERC20(o.stockToken);
        if (fee > 0) stock.safeTransfer(msg.sender, fee);

        Exits memory ex = attachedExits[buyId];
        delete attachedExits[buyId];

        uint8 reason;
        if (price >= ex.takeProfitPrice || price <= ex.stopLossPrice) reason = 1;
        else if (toOwner > m.maxStockIn) reason = 2;
        else {
            uint128 ceiling = maxStockEscrow[o.stockToken];
            if (ceiling != 0 && stockEscrowed[o.stockToken] + toOwner > ceiling) reason = 3;
        }
        uint256 minTp = (_sellValue(toOwner, ex.takeProfitPrice, m) * (10_000 - ex.slippageBps)) / 10_000;
        uint256 minSl = (_sellValue(toOwner, ex.stopLossPrice, m) * (10_000 - ex.slippageBps)) / 10_000;
        if (reason == 0 && (minTp == 0 || minSl == 0 || minTp > type(uint128).max)) reason = 4;

        if (reason != 0) {
            stock.safeTransfer(o.owner, toOwner);
            emit ExitsSkipped(buyId, reason);
            return (toOwner, fee);
        }

        stockEscrowed[o.stockToken] += toOwner;
        (uint256 tpId, uint256 slId) = _placeExitLegs(o, ex, toOwner, minTp, minSl);
        emit ExitsPlaced(buyId, tpId, slId, toOwner);
    }

    function _placeExitLegs(Order storage o, Exits memory ex, uint256 amount, uint256 minTp, uint256 minSl)
        internal
        returns (uint256 tpId, uint256 slId)
    {
        uint40 exitExpiry = uint40(block.timestamp) + ex.duration;
        tpId = nextOrderId;
        slId = tpId + 1;
        _store(
            Order({
                owner: o.owner,
                expiry: exitExpiry,
                orderType: OrderType.LIMIT_SELL,
                status: Status.OPEN,
                trailBps: 0,
                stockToken: o.stockToken,
                triggerPrice: ex.takeProfitPrice,
                amountIn: uint128(amount),
                minAmountOut: uint128(minTp),
                peakPrice: 0,
                linkedId: uint64(slId)
            })
        );
        _store(
            Order({
                owner: o.owner,
                expiry: exitExpiry,
                orderType: OrderType.STOP_LOSS,
                status: Status.OPEN,
                trailBps: 0,
                stockToken: o.stockToken,
                triggerPrice: ex.stopLossPrice,
                amountIn: uint128(amount),
                minAmountOut: uint128(minSl),
                peakPrice: 0,
                linkedId: uint64(tpId)
            })
        );
        emit BracketCreated(tpId, slId);
    }

    /// @dev Quote value of `amount` stock at `price` (8 decimals).
    function _sellValue(uint256 amount, uint256 price, Market memory m) internal view returns (uint256) {
        return (amount * price * (10 ** quoteDecimals)) / ((10 ** m.stockDecimals) * (10 ** 8));
    }

    function _refund(Order storage o) internal {
        _escrowOut(o.stockToken, o.orderType == OrderType.LIMIT_BUY, o.amountIn);
        IERC20 tokenIn = o.orderType == OrderType.LIMIT_BUY ? quoteToken : IERC20(o.stockToken);
        tokenIn.safeTransfer(o.owner, o.amountIn);
    }

    /// @dev Minimum acceptable gross output given the oracle price and the market's deviation bound.
    function _guardFloor(bool isBuy, uint256 amountIn, uint256 price, Market memory m) internal view returns (uint256) {
        uint256 ideal;
        if (isBuy) {
            ideal = (amountIn * (10 ** 8) * (10 ** m.stockDecimals)) / (price * (10 ** quoteDecimals));
        } else {
            ideal = (amountIn * price * (10 ** quoteDecimals)) / ((10 ** m.stockDecimals) * (10 ** 8));
        }
        return (ideal * (10_000 - m.maxDeviationBps)) / 10_000;
    }

    function _freshPrice(address stockToken) internal view returns (bool ok, uint256 price, Market memory m) {
        m = markets[stockToken];
        if (!m.enabled || !_sequencerUp()) return (false, 0, m);
        try m.feed.latestRoundData() returns (uint80, int256 answer, uint256, uint256 updatedAt, uint80) {
            if (answer <= 0) return (false, 0, m);
            if (updatedAt > block.timestamp || block.timestamp - updatedAt > m.maxStaleness) return (false, 0, m);
            return (true, _normalize(uint256(answer), m.feedDecimals), m);
        } catch {
            return (false, 0, m);
        }
    }

    function _lastPrice(Market memory m) internal view returns (uint256 price, uint256 updatedAt) {
        (, int256 answer,, uint256 updated,) = m.feed.latestRoundData();
        if (answer <= 0) revert BadPrice();
        return (_normalize(uint256(answer), m.feedDecimals), updated);
    }

    function _normalize(uint256 answer, uint8 dec) internal pure returns (uint256) {
        if (dec == 8) return answer;
        if (dec > 8) return answer / (10 ** (dec - 8));
        return answer * (10 ** (8 - dec));
    }

    function _stopFromPeak(uint256 peak, uint16 trailBps) internal pure returns (uint96) {
        return _toUint96((peak * (10_000 - trailBps)) / 10_000);
    }

    function _toUint96(uint256 v) internal pure returns (uint96) {
        if (v == 0 || v > type(uint96).max) revert BadPrice();
        return uint96(v);
    }

    function _isTriggered(OrderType t, uint256 price, uint256 trigger) internal pure returns (bool) {
        if (t == OrderType.LIMIT_SELL) return price >= trigger;
        return price <= trigger; // LIMIT_BUY, STOP_LOSS, TRAILING_STOP
    }
}
