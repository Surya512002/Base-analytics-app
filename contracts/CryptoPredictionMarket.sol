// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

interface IERC20 {
    function transferFrom(address from, address to, uint256 amount) external returns (bool);
    function transfer(address to, uint256 amount) external returns (bool);
    function balanceOf(address account) external view returns (uint256);
}

interface AggregatorV3Interface {
    function latestRoundData()
        external
        view
        returns (
            uint80 roundId,
            int256 answer,
            uint256 startedAt,
            uint256 updatedAt,
            uint80 answeredInRound
        );
}

/// @title CryptoPredictionMarket — CPMM YES/NO on Base, Chainlink resolution, void one-sided rounds
/// @notice Chainlink Automation should call closeMarket / resolveMarket on cron per track.
contract CryptoPredictionMarket {
    address public constant USDC = 0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913;
    uint256 public constant USDC_UNIT = 1e6;

    address public immutable treasury;
    address public automationRegistry;
    uint16 public protocolFeeBps;

    enum Phase { Open, Closed, Resolved, Void }

    struct Market {
        bytes32 trackId;
        address priceFeed;
        uint64 openTime;
        uint64 closeTime;
        uint64 resolveTime;
        int256 openPrice;
        int256 resolvePrice;
        uint256 yesReserve;
        uint256 noReserve;
        Phase phase;
        bool yesWins;
        bool hasYesBuys;
        bool hasNoBuys;
    }

    uint256 public nextMarketId = 1;
    mapping(uint256 => Market) public markets;
    mapping(uint256 => mapping(address => uint256)) public yesShares;
    mapping(uint256 => mapping(address => uint256)) public noShares;
    mapping(uint256 => address[]) private participants;
    mapping(uint256 => mapping(address => bool)) private isParticipant;

    event MarketOpened(uint256 indexed marketId, bytes32 trackId, int256 openPrice);
    event MarketClosed(uint256 indexed marketId);
    event Trade(
        uint256 indexed marketId,
        address indexed trader,
        bool isYes,
        uint256 usdcIn,
        uint256 sharesOut
    );
    event MarketResolved(uint256 indexed marketId, bool yesWins, int256 resolvePrice, uint256 feeToTreasury);
    event MarketVoided(uint256 indexed marketId, string reason);
    event Redeemed(uint256 indexed marketId, address indexed user, uint256 usdcOut);

    modifier onlyAutomation() {
        require(
            msg.sender == automationRegistry || automationRegistry == address(0),
            "Not automation"
        );
        _;
    }

    constructor(address _treasury, uint16 _protocolFeeBps) {
        require(_treasury != address(0), "Treasury");
        require(_protocolFeeBps <= 500, "Fee too high");
        treasury = _treasury;
        protocolFeeBps = _protocolFeeBps;
    }

    function setAutomationRegistry(address registry) external {
        automationRegistry = registry;
    }

    function openMarket(
        bytes32 trackId,
        address priceFeed,
        uint64 openTime,
        uint64 closeTime,
        uint64 resolveTime,
        uint256 initialLiquidity
    ) external returns (uint256 marketId) {
        require(closeTime > openTime && resolveTime >= closeTime, "Bad times");
        require(initialLiquidity >= USDC_UNIT * 100, "Min liquidity");

        marketId = nextMarketId++;
        int256 openPrice = _readFeed(priceFeed);

        markets[marketId] = Market({
            trackId: trackId,
            priceFeed: priceFeed,
            openTime: openTime,
            closeTime: closeTime,
            resolveTime: resolveTime,
            openPrice: openPrice,
            resolvePrice: 0,
            yesReserve: initialLiquidity,
            noReserve: initialLiquidity,
            phase: Phase.Open,
            yesWins: false,
            hasYesBuys: false,
            hasNoBuys: false
        });

        emit MarketOpened(marketId, trackId, openPrice);
    }

    function buyYes(uint256 marketId, uint256 usdcIn) external {
        _trade(marketId, true, usdcIn);
    }

    function buyNo(uint256 marketId, uint256 usdcIn) external {
        _trade(marketId, false, usdcIn);
    }

    function closeMarket(uint256 marketId) external onlyAutomation {
        Market storage m = markets[marketId];
        require(m.phase == Phase.Open, "Not open");
        require(block.timestamp >= m.closeTime, "Too early");
        m.phase = Phase.Closed;
        emit MarketClosed(marketId);
    }

    function resolveMarket(uint256 marketId) external onlyAutomation {
        Market storage m = markets[marketId];
        require(m.phase == Phase.Closed || m.phase == Phase.Open, "Bad phase");
        require(block.timestamp >= m.resolveTime, "Too early");

        if (!m.hasYesBuys || !m.hasNoBuys) {
            m.phase = Phase.Void;
            _refundAll(marketId);
            emit MarketVoided(marketId, "one-sided");
            return;
        }

        int256 price = _readFeed(m.priceFeed);
        m.resolvePrice = price;
        m.yesWins = price > m.openPrice;
        m.phase = Phase.Resolved;

        uint256 vault = IERC20(USDC).balanceOf(address(this));
        uint256 fee = (vault * protocolFeeBps) / 10_000;
        if (fee > 0) {
            require(IERC20(USDC).transfer(treasury, fee), "Fee xfer");
        }

        _settleAll(marketId, m.yesWins);
        emit MarketResolved(marketId, m.yesWins, price, fee);
    }

    function impliedYesBps(uint256 marketId) external view returns (uint256) {
        Market storage m = markets[marketId];
        uint256 total = m.yesReserve + m.noReserve;
        if (total == 0) return 5000;
        return (m.noReserve * 10_000) / total;
    }

    function _trade(uint256 marketId, bool isYes, uint256 usdcIn) internal {
        require(usdcIn >= USDC_UNIT / 10, "Min trade");
        Market storage m = markets[marketId];
        require(m.phase == Phase.Open, "Not trading");
        require(block.timestamp >= m.openTime && block.timestamp < m.closeTime, "Outside window");
        require(IERC20(USDC).transferFrom(msg.sender, address(this), usdcIn), "USDC in");

        uint256 sharesOut;
        if (isYes) {
            sharesOut = _swapYes(m, usdcIn);
            yesShares[marketId][msg.sender] += sharesOut;
            m.hasYesBuys = true;
        } else {
            sharesOut = _swapNo(m, usdcIn);
            noShares[marketId][msg.sender] += sharesOut;
            m.hasNoBuys = true;
        }

        _trackParticipant(marketId, msg.sender);
        emit Trade(marketId, msg.sender, isYes, usdcIn, sharesOut);
    }

    function _swapYes(Market storage m, uint256 usdcIn) internal returns (uint256) {
        uint256 k = m.yesReserve * m.noReserve;
        uint256 newNo = m.noReserve + usdcIn;
        uint256 newYes = k / newNo;
        uint256 sharesOut = m.yesReserve - newYes;
        m.yesReserve = newYes;
        m.noReserve = newNo;
        return sharesOut;
    }

    function _swapNo(Market storage m, uint256 usdcIn) internal returns (uint256) {
        uint256 k = m.yesReserve * m.noReserve;
        uint256 newYes = m.yesReserve + usdcIn;
        uint256 newNo = k / newYes;
        uint256 sharesOut = m.noReserve - newNo;
        m.yesReserve = newYes;
        m.noReserve = newNo;
        return sharesOut;
    }

    function _trackParticipant(uint256 marketId, address user) internal {
        if (!isParticipant[marketId][user]) {
            isParticipant[marketId][user] = true;
            participants[marketId].push(user);
        }
    }

    function _settleAll(uint256 marketId, bool yesWins) internal {
        address[] storage list = participants[marketId];
        for (uint256 i = 0; i < list.length; i++) {
            address user = list[i];
            uint256 winShares = yesWins ? yesShares[marketId][user] : noShares[marketId][user];
            if (winShares == 0) continue;
            yesShares[marketId][user] = 0;
            noShares[marketId][user] = 0;
            require(IERC20(USDC).transfer(user, winShares), "Payout");
            emit Redeemed(marketId, user, winShares);
        }
    }

    function _refundAll(uint256 marketId) internal {
        address[] storage list = participants[marketId];
        for (uint256 i = 0; i < list.length; i++) {
            address user = list[i];
            uint256 refund = yesShares[marketId][user] + noShares[marketId][user];
            if (refund == 0) continue;
            yesShares[marketId][user] = 0;
            noShares[marketId][user] = 0;
            require(IERC20(USDC).transfer(user, refund), "Refund");
            emit Redeemed(marketId, user, refund);
        }
    }

    function _readFeed(address feed) internal view returns (int256) {
        (, int256 answer, , , ) = AggregatorV3Interface(feed).latestRoundData();
        require(answer > 0, "Bad feed");
        return answer;
    }
}
