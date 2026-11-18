// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import {IClaimGate} from "./IClaimGate.sol";

interface IDropsERC20 {
    function balanceOf(address account) external view returns (uint256);
    function transfer(address to, uint256 amount) external returns (bool);
    function transferFrom(address from, address to, uint256 amount) external returns (bool);
}

/// @title BaseDrops — rule-based gift drops on Base (successor to BaseVoucher + BaseVoucherCampaign).
/// @notice A creator escrows ETH or an ERC-20 (incl. tokenized stocks) and decides who can claim,
///         how often, and what they must prove first. Gift cards, one-link gifts, daily faucets,
///         quests and allowlist airdrops are all presets of one drop.
///
/// Access (a drop needs at least one; they combine with AND):
///  - linkSigner     one private link key; the claimer shows a signature bound to their wallet.
///  - codesRoot      many one-time codes (gift cards). Each code is a key; the root commits to
///                   their addresses. A used code can't be used again by anyone.
///  - allowlistRoot  Merkle root of allowed wallets.
///  - ticketSigner   the app (or the creator's own server) signs a short-lived ticket after
///                   verifying offchain tasks. The ticket names the wallet, its claim number and
///                   the amount, so it can't be replayed or reused by anyone else.
///  - gate           an IClaimGate module checked onchain (e.g. holds ≥ X of a token).
///
/// Frequency: claims per wallet, cooldown between a wallet's claims, a cap per period (e.g.
/// per day) for the whole drop, a total cap, and the budget itself.
///
/// Recovery (no secret needed): rotate the link key, two-step creator transfer, managers who
/// can pause / rotate / top up but never withdraw, and a recovery address that can take over a
/// drop RECOVERY_DELAY after it expires if the creator's wallet is lost.
///
/// Safety: funds escrowed in full; refunds only ever go to the creator; committed drops can't
/// be closed, paused or tightened before expiry; reentrancy guard + checks-effects-interactions;
/// fee-on-transfer tokens rejected; malleable (high-s) signatures rejected; ids start at
/// FIRST_DROP_ID so a link's id alone routes it to this contract.
contract BaseDrops {
    // ───────────────────────────── constants ─────────────────────────────

    uint256 public constant FIRST_DROP_ID = 2_000_000_001;
    uint256 public constant MAX_MESSAGE_BYTES = 280;
    uint256 public constant MAX_LABEL_BYTES = 40;
    uint256 public constant MAX_TICKET_TTL = 1 hours;
    uint256 public constant RECOVERY_DELAY = 30 days;
    uint256 public constant MAX_GATE_CONFIG_BYTES = 1024;

    bytes32 public constant LINK_TAG = keccak256("BaseDrops.v1.link");
    bytes32 public constant CODE_TAG = keccak256("BaseDrops.v1.code");
    bytes32 public constant TICKET_TAG = keccak256("BaseDrops.v1.ticket");

    // ───────────────────────────── types ─────────────────────────────

    struct Drop {
        address creator;
        address token; // address(0) = ETH
        uint128 amountPerClaim; // paid when there's no ticket, or the ticket says 0
        uint128 maxAmountPerClaim; // ceiling for a ticket-chosen amount (tiers, random, streaks)
        uint256 budget; // escrow left
        uint32 maxClaimsTotal; // 0 = until the budget runs out
        uint32 claimedCount;
        uint32 maxClaimsPerWallet; // 0 = unlimited
        uint32 cooldown; // seconds between one wallet's claims (0 = none)
        uint32 periodSecs; // length of a period for maxClaimsPerPeriod (0 = no period cap)
        uint32 maxClaimsPerPeriod;
        uint64 createdAt;
        uint64 unlockAt; // 0 = claimable now
        uint64 expiresAt; // required; after this, claims stop and the creator can close
        address linkSigner;
        address ticketSigner;
        address gate;
        address recovery; // may take over after expiresAt + RECOVERY_DELAY
        address pendingCreator;
        bytes32 allowlistRoot;
        bytes32 codesRoot;
        bool committed;
        bool paused;
        bool closed;
    }

    struct CreateParams {
        address token;
        uint256 budget;
        uint128 amountPerClaim;
        uint128 maxAmountPerClaim; // 0 = same as amountPerClaim
        uint32 maxClaimsTotal;
        uint32 maxClaimsPerWallet;
        uint32 cooldown;
        uint32 periodSecs;
        uint32 maxClaimsPerPeriod;
        uint64 unlockAt;
        uint64 expiresAt;
        address linkSigner;
        address ticketSigner;
        bytes32 allowlistRoot;
        bytes32 codesRoot;
        address gate;
        bytes gateConfig;
        address recovery;
        bool committed;
        string message;
        string senderLabel;
    }

    struct ClaimArgs {
        bytes linkSig; // by linkSigner over linkDigest(id, claimer)
        address code; // code key address (codesRoot drops)
        bytes32[] codeProof;
        bytes codeSig; // by `code` over codeDigest(id, claimer)
        bytes32[] allowlistProof;
        uint256 amount; // ticket amount (0 = amountPerClaim)
        uint64 deadline; // ticket expiry
        bytes ticket; // by ticketSigner over ticketDigest(...)
        bytes gateData;
        address referrer; // emitted only, for referral counting
    }

    struct WalletState {
        uint32 claims;
        uint64 lastClaimAt;
    }

    // ───────────────────────────── storage ─────────────────────────────

    uint256 public nextDropId = FIRST_DROP_ID;
    mapping(uint256 => Drop) private _drops;
    mapping(uint256 => string) private _messages;
    mapping(uint256 => string) private _senderLabels;
    mapping(uint256 => mapping(address => WalletState)) public walletState;
    mapping(uint256 => mapping(uint256 => uint32)) public claimsInPeriod;
    mapping(uint256 => mapping(address => bool)) public codeUsed;
    mapping(uint256 => mapping(address => bool)) public isManager;

    uint256 private _lock = 1;

    // ───────────────────────────── events ─────────────────────────────

    event DropCreated(
        uint256 indexed dropId,
        address indexed creator,
        address indexed token,
        uint256 budget,
        uint128 amountPerClaim,
        uint64 expiresAt,
        bool committed,
        string senderLabel,
        string message
    );
    event DropClaimed(
        uint256 indexed dropId,
        address indexed claimer,
        address indexed referrer,
        uint256 amount,
        uint32 walletClaimNumber,
        uint32 claimedCount
    );
    event DropToppedUp(uint256 indexed dropId, address indexed by, uint256 amount);
    event DropPaused(uint256 indexed dropId, bool paused);
    event DropExpiryExtended(uint256 indexed dropId, uint64 expiresAt);
    event LinkSignerRotated(uint256 indexed dropId, address linkSigner);
    event TicketSignerChanged(uint256 indexed dropId, address ticketSigner);
    event ManagerSet(uint256 indexed dropId, address indexed manager, bool enabled);
    event RecoverySet(uint256 indexed dropId, address recovery);
    event CreatorTransferStarted(uint256 indexed dropId, address indexed from, address indexed to);
    event CreatorTransferred(uint256 indexed dropId, address indexed from, address indexed to);
    event DropClosed(uint256 indexed dropId, address indexed creator, uint256 refunded);

    // ───────────────────────────── modifiers ─────────────────────────────

    modifier nonReentrant() {
        require(_lock == 1, "Reentrancy");
        _lock = 2;
        _;
        _lock = 1;
    }

    modifier onlyCreator(uint256 id) {
        require(_drops[id].creator != address(0), "Invalid drop");
        require(msg.sender == _drops[id].creator, "Only creator");
        _;
    }

    modifier onlyCreatorOrManager(uint256 id) {
        Drop storage d = _drops[id];
        require(d.creator != address(0), "Invalid drop");
        require(msg.sender == d.creator || isManager[id][msg.sender], "Only creator or manager");
        _;
    }

    // ───────────────────────────── create ─────────────────────────────

    function createDrop(CreateParams calldata p) external payable nonReentrant returns (uint256 id) {
        require(p.budget > 0, "No budget");
        if (p.token == address(0)) {
            require(msg.value == p.budget, "ETH amount mismatch");
        } else {
            require(msg.value == 0, "ETH sent with token drop");
            require(p.token.code.length > 0, "Invalid token");
            uint256 before = IDropsERC20(p.token).balanceOf(address(this));
            _safeTransferFrom(p.token, msg.sender, address(this), p.budget);
            require(IDropsERC20(p.token).balanceOf(address(this)) - before == p.budget, "Fee-on-transfer unsupported");
        }
        id = _create(p);
    }

    function _create(CreateParams calldata p) private returns (uint256 id) {
        require(p.amountPerClaim > 0, "Amount per claim is zero");
        uint128 maxAmount = p.maxAmountPerClaim == 0 ? p.amountPerClaim : p.maxAmountPerClaim;
        require(maxAmount >= p.amountPerClaim, "Max below amount");
        require(maxAmount == p.amountPerClaim || p.ticketSigner != address(0), "Variable amounts need tickets");
        require(p.budget >= p.amountPerClaim, "Budget below one claim");
        require(p.expiresAt > block.timestamp, "Expiry must be in the future");
        require(p.unlockAt < p.expiresAt, "Unlock must be before expiry");
        require((p.periodSecs == 0) == (p.maxClaimsPerPeriod == 0), "Period needs a cap");
        require(
            p.linkSigner != address(0) || p.codesRoot != bytes32(0) || p.allowlistRoot != bytes32(0)
                || p.ticketSigner != address(0) || p.gate != address(0),
            "Drop needs an access rule"
        );
        require(bytes(p.message).length <= MAX_MESSAGE_BYTES, "Message too long");
        require(bytes(p.senderLabel).length <= MAX_LABEL_BYTES, "Label too long");
        require(p.gateConfig.length <= MAX_GATE_CONFIG_BYTES, "Gate config too long");
        require(p.recovery != msg.sender, "Recovery must differ from creator");

        id = nextDropId++;
        Drop storage d = _drops[id];
        d.creator = msg.sender;
        d.token = p.token;
        d.amountPerClaim = p.amountPerClaim;
        d.maxAmountPerClaim = maxAmount;
        d.budget = p.budget;
        d.maxClaimsTotal = p.maxClaimsTotal;
        d.maxClaimsPerWallet = p.maxClaimsPerWallet;
        d.cooldown = p.cooldown;
        d.periodSecs = p.periodSecs;
        d.maxClaimsPerPeriod = p.maxClaimsPerPeriod;
        d.createdAt = uint64(block.timestamp);
        d.unlockAt = p.unlockAt;
        d.expiresAt = p.expiresAt;
        d.linkSigner = p.linkSigner;
        d.ticketSigner = p.ticketSigner;
        d.gate = p.gate;
        d.recovery = p.recovery;
        d.allowlistRoot = p.allowlistRoot;
        d.codesRoot = p.codesRoot;
        d.committed = p.committed;
        _messages[id] = p.message;
        _senderLabels[id] = p.senderLabel;

        if (p.gate != address(0)) {
            require(p.gate.code.length > 0, "Gate has no code");
            IClaimGate(p.gate).configure(id, p.gateConfig);
        }

        emit DropCreated(id, msg.sender, p.token, p.budget, p.amountPerClaim, p.expiresAt, p.committed, p.senderLabel, p.message);
        if (p.recovery != address(0)) emit RecoverySet(id, p.recovery);
    }

    // ───────────────────────────── claim ─────────────────────────────

    function claim(uint256 id, ClaimArgs calldata a) external nonReentrant {
        Drop storage d = _drops[id];
        require(d.creator != address(0), "Invalid drop");
        require(!d.closed, "Drop closed");
        require(!d.paused, "Drop paused");
        require(msg.sender != d.creator, "Creator cannot claim");
        require(d.unlockAt == 0 || block.timestamp >= d.unlockAt, "Not unlocked yet");
        require(block.timestamp < d.expiresAt, "Drop expired");
        require(d.maxClaimsTotal == 0 || d.claimedCount < d.maxClaimsTotal, "All claims taken");

        WalletState memory w = walletState[id][msg.sender];
        require(d.maxClaimsPerWallet == 0 || w.claims < d.maxClaimsPerWallet, "Wallet claim limit reached");
        require(w.claims == 0 || d.cooldown == 0 || block.timestamp >= uint256(w.lastClaimAt) + d.cooldown, "Cooldown active");

        uint256 period;
        if (d.periodSecs != 0) {
            period = (block.timestamp - d.createdAt) / d.periodSecs;
            require(claimsInPeriod[id][period] < d.maxClaimsPerPeriod, "Period cap reached");
        }

        _checkAccess(id, d, a, w.claims);
        uint256 amount = _claimAmount(id, d, a, w.claims);
        require(d.budget >= amount, "Budget exhausted");

        // effects
        d.budget -= amount;
        d.claimedCount += 1;
        if (d.periodSecs != 0) claimsInPeriod[id][period] += 1;
        walletState[id][msg.sender] = WalletState({claims: w.claims + 1, lastClaimAt: uint64(block.timestamp)});
        if (d.codesRoot != bytes32(0)) codeUsed[id][a.code] = true;

        // interaction
        _pay(d.token, msg.sender, amount);
        emit DropClaimed(id, msg.sender, a.referrer, amount, w.claims + 1, d.claimedCount);
    }

    function _checkAccess(uint256 id, Drop storage d, ClaimArgs calldata a, uint32 claimIndex) private view {
        if (d.linkSigner != address(0)) {
            require(_recover(linkDigest(id, msg.sender), a.linkSig) == d.linkSigner, "Invalid link");
        }
        if (d.codesRoot != bytes32(0)) {
            require(a.code != address(0) && !codeUsed[id][a.code], "Code already used");
            require(_verifyProof(a.codeProof, d.codesRoot, _leaf(a.code)), "Unknown code");
            require(_recover(codeDigest(id, msg.sender), a.codeSig) == a.code, "Invalid code signature");
        }
        if (d.allowlistRoot != bytes32(0)) {
            require(_verifyProof(a.allowlistProof, d.allowlistRoot, _leaf(msg.sender)), "Not on allowlist");
        }
        if (d.ticketSigner != address(0)) {
            require(block.timestamp <= a.deadline, "Ticket expired");
            require(a.deadline <= block.timestamp + MAX_TICKET_TTL, "Ticket TTL too long");
            bytes32 digest = ticketDigest(id, msg.sender, claimIndex, a.amount, a.deadline);
            require(_recover(digest, a.ticket) == d.ticketSigner, "Invalid ticket");
        }
        if (d.gate != address(0)) {
            bool ok;
            try IClaimGate(d.gate).check(id, msg.sender, a.gateData) returns (bool r) {
                ok = r;
            } catch {
                ok = false;
            }
            require(ok, "Gate check failed");
        }
    }

    function _claimAmount(uint256, Drop storage d, ClaimArgs calldata a, uint32) private view returns (uint256) {
        if (d.ticketSigner == address(0) || a.amount == 0) return d.amountPerClaim;
        require(a.amount <= d.maxAmountPerClaim, "Amount above max");
        return a.amount;
    }

    /// @notice Digest the link key signs for one claimer (EIP-191 personal_sign of the inner hash).
    function linkDigest(uint256 id, address claimer) public view returns (bytes32) {
        return _ethSigned(keccak256(abi.encode(LINK_TAG, block.chainid, address(this), id, claimer)));
    }

    /// @notice Digest a one-time code key signs for the wallet redeeming it.
    function codeDigest(uint256 id, address claimer) public view returns (bytes32) {
        return _ethSigned(keccak256(abi.encode(CODE_TAG, block.chainid, address(this), id, claimer)));
    }

    /// @notice Digest the ticket signer signs. `claimIndex` is the wallet's claims so far, so a
    ///         ticket works for exactly one claim.
    function ticketDigest(uint256 id, address claimer, uint32 claimIndex, uint256 amount, uint64 deadline)
        public
        view
        returns (bytes32)
    {
        return _ethSigned(
            keccak256(abi.encode(TICKET_TAG, block.chainid, address(this), id, claimer, claimIndex, amount, deadline))
        );
    }

    // ───────────────────────────── creator & managers ─────────────────────────────

    /// @notice Add funds. Creator or manager. Refunds still only go to the creator.
    function topUp(uint256 id, uint256 amount) external payable nonReentrant onlyCreatorOrManager(id) {
        Drop storage d = _drops[id];
        require(!d.closed, "Drop closed");
        require(amount > 0, "Nothing to add");
        if (d.token == address(0)) {
            require(msg.value == amount, "ETH amount mismatch");
        } else {
            require(msg.value == 0, "ETH sent with token drop");
            uint256 before = IDropsERC20(d.token).balanceOf(address(this));
            _safeTransferFrom(d.token, msg.sender, address(this), amount);
            require(IDropsERC20(d.token).balanceOf(address(this)) - before == amount, "Fee-on-transfer unsupported");
        }
        d.budget += amount;
        emit DropToppedUp(id, msg.sender, amount);
    }

    /// @notice Pause or resume claims. Not allowed on committed drops.
    function setPaused(uint256 id, bool paused) external onlyCreatorOrManager(id) {
        Drop storage d = _drops[id];
        require(!d.closed, "Drop closed");
        require(!d.committed, "Committed drop");
        d.paused = paused;
        emit DropPaused(id, paused);
    }

    /// @notice New link key (old link stops working). For a lost or leaked link. Moves no funds,
    ///         so it's allowed on committed drops too.
    function rotateLinkSigner(uint256 id, address newLinkSigner) external onlyCreatorOrManager(id) {
        Drop storage d = _drops[id];
        require(!d.closed, "Drop closed");
        require(d.linkSigner != address(0), "Drop has no link");
        require(newLinkSigner != address(0), "Empty link signer");
        d.linkSigner = newLinkSigner;
        emit LinkSignerRotated(id, newLinkSigner);
    }

    /// @notice Change the ticket signer (e.g. the app rotated its key). Creator only; on a
    ///         committed drop only an existing signer can be replaced, never added.
    function setTicketSigner(uint256 id, address newTicketSigner) external onlyCreator(id) {
        Drop storage d = _drops[id];
        require(!d.closed, "Drop closed");
        require(newTicketSigner != address(0) || d.maxAmountPerClaim == d.amountPerClaim, "Variable amounts need tickets");
        if (d.committed) {
            require(d.ticketSigner != address(0) && newTicketSigner != address(0), "Committed drop");
        }
        d.ticketSigner = newTicketSigner;
        emit TicketSignerChanged(id, newTicketSigner);
    }

    /// @notice Later expiry. Always allowed (it only gives claimers more time).
    function extendExpiry(uint256 id, uint64 newExpiresAt) external onlyCreator(id) {
        Drop storage d = _drops[id];
        require(!d.closed, "Drop closed");
        require(newExpiresAt > d.expiresAt, "Must be later");
        d.expiresAt = newExpiresAt;
        emit DropExpiryExtended(id, newExpiresAt);
    }

    function setManager(uint256 id, address manager, bool enabled) external onlyCreator(id) {
        require(manager != address(0), "Empty manager");
        isManager[id][manager] = enabled;
        emit ManagerSet(id, manager, enabled);
    }

    function setRecovery(uint256 id, address recovery) external onlyCreator(id) {
        require(recovery != msg.sender, "Recovery must differ from creator");
        _drops[id].recovery = recovery;
        emit RecoverySet(id, recovery);
    }

    /// @notice Step 1 of moving a drop to a new wallet (address(0) cancels).
    function transferCreator(uint256 id, address newCreator) external onlyCreator(id) {
        _drops[id].pendingCreator = newCreator;
        emit CreatorTransferStarted(id, msg.sender, newCreator);
    }

    /// @notice Step 2: the new wallet accepts.
    function acceptCreator(uint256 id) external {
        Drop storage d = _drops[id];
        require(d.creator != address(0), "Invalid drop");
        require(msg.sender == d.pendingCreator, "Not the pending creator");
        _setCreator(id, d, msg.sender);
    }

    /// @notice Lost creator wallet: the recovery address takes over once the drop has been
    ///         expired for RECOVERY_DELAY (so a live drop can't be hijacked).
    function recoverCreator(uint256 id) external {
        Drop storage d = _drops[id];
        require(d.creator != address(0), "Invalid drop");
        require(d.recovery != address(0) && msg.sender == d.recovery, "Not the recovery address");
        require(block.timestamp >= uint256(d.expiresAt) + RECOVERY_DELAY, "Recovery not open yet");
        _setCreator(id, d, msg.sender);
    }

    function _setCreator(uint256 id, Drop storage d, address next) private {
        address prev = d.creator;
        d.creator = next;
        d.pendingCreator = address(0);
        if (d.recovery == next) d.recovery = address(0);
        emit CreatorTransferred(id, prev, next);
    }

    /// @notice Refund what's left to the creator and end the drop. Committed drops: only after expiry.
    function close(uint256 id) external nonReentrant onlyCreator(id) {
        Drop storage d = _drops[id];
        require(!d.closed, "Already closed");
        require(!d.committed || block.timestamp >= d.expiresAt, "Committed until expiry");
        uint256 refund = d.budget;
        d.budget = 0;
        d.closed = true;
        if (refund > 0) _pay(d.token, d.creator, refund);
        emit DropClosed(id, d.creator, refund);
    }

    // ───────────────────────────── views ─────────────────────────────

    function getDrop(uint256 id)
        external
        view
        returns (Drop memory drop, string memory message, string memory senderLabel)
    {
        return (_drops[id], _messages[id], _senderLabels[id]);
    }

    /// @notice Why `claimer` can't claim right now, ignoring proofs/signatures ("" = timing and
    ///         limits allow it). Lets the UI explain cooldowns and caps without a failed tx.
    function claimBlocker(uint256 id, address claimer) external view returns (string memory) {
        Drop storage d = _drops[id];
        if (d.creator == address(0)) return "Invalid drop";
        if (d.closed) return "Drop closed";
        if (d.paused) return "Drop paused";
        if (claimer == d.creator) return "Creator cannot claim";
        if (d.unlockAt != 0 && block.timestamp < d.unlockAt) return "Not unlocked yet";
        if (block.timestamp >= d.expiresAt) return "Drop expired";
        if (d.maxClaimsTotal != 0 && d.claimedCount >= d.maxClaimsTotal) return "All claims taken";
        if (d.budget < d.amountPerClaim) return "Budget exhausted";
        WalletState memory w = walletState[id][claimer];
        if (d.maxClaimsPerWallet != 0 && w.claims >= d.maxClaimsPerWallet) return "Wallet claim limit reached";
        if (w.claims != 0 && d.cooldown != 0 && block.timestamp < uint256(w.lastClaimAt) + d.cooldown) {
            return "Cooldown active";
        }
        if (d.periodSecs != 0) {
            uint256 period = (block.timestamp - d.createdAt) / d.periodSecs;
            if (claimsInPeriod[id][period] >= d.maxClaimsPerPeriod) return "Period cap reached";
        }
        return "";
    }

    /// @notice When `claimer` may claim next (0 = now or never, see claimBlocker).
    function nextClaimAt(uint256 id, address claimer) external view returns (uint256) {
        Drop storage d = _drops[id];
        WalletState memory w = walletState[id][claimer];
        if (w.claims == 0 || d.cooldown == 0) return 0;
        uint256 t = uint256(w.lastClaimAt) + d.cooldown;
        return t > block.timestamp ? t : 0;
    }

    // ───────────────────────────── internals ─────────────────────────────

    function _pay(address token, address to, uint256 amount) private {
        if (token == address(0)) {
            (bool ok,) = payable(to).call{value: amount}("");
            require(ok, "ETH transfer failed");
        } else {
            _safeTransfer(token, to, amount);
        }
    }

    function _safeTransfer(address token, address to, uint256 amount) private {
        (bool ok, bytes memory ret) = token.call(abi.encodeWithSelector(IDropsERC20.transfer.selector, to, amount));
        require(ok && (ret.length == 0 || abi.decode(ret, (bool))), "Token transfer failed");
    }

    function _safeTransferFrom(address token, address from, address to, uint256 amount) private {
        (bool ok, bytes memory ret) =
            token.call(abi.encodeWithSelector(IDropsERC20.transferFrom.selector, from, to, amount));
        require(ok && (ret.length == 0 || abi.decode(ret, (bool))), "Token pull failed");
    }

    /// Merkle leaf for an address (double-hashed, same as OpenZeppelin's StandardMerkleTree).
    function _leaf(address account) private pure returns (bytes32) {
        return keccak256(bytes.concat(keccak256(abi.encode(account))));
    }

    /// Sorted-pair Merkle proof (OpenZeppelin MerkleProof compatible).
    function _verifyProof(bytes32[] calldata proof, bytes32 root, bytes32 leaf) private pure returns (bool) {
        bytes32 h = leaf;
        for (uint256 i = 0; i < proof.length; i++) {
            bytes32 p = proof[i];
            h = h < p ? keccak256(abi.encodePacked(h, p)) : keccak256(abi.encodePacked(p, h));
        }
        return h == root;
    }

    function _ethSigned(bytes32 inner) private pure returns (bytes32) {
        return keccak256(abi.encodePacked("\x19Ethereum Signed Message:\n32", inner));
    }

    function _recover(bytes32 digest, bytes calldata sig) private pure returns (address) {
        require(sig.length == 65, "Bad signature length");
        bytes32 r = bytes32(sig[0:32]);
        bytes32 s = bytes32(sig[32:64]);
        uint8 v = uint8(sig[64]);
        if (v < 27) v += 27;
        require(v == 27 || v == 28, "Bad v");
        require(uint256(s) <= 0x7FFFFFFFFFFFFFFFFFFFFFFFFFFFFFFF5D576E7357A4501DDFE92F46681B20A0, "Bad s");
        address signer = ecrecover(digest, v, r, s);
        require(signer != address(0), "Bad signature");
        return signer;
    }
}
