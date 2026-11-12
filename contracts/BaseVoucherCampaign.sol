// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

interface ICampaignERC20 {
    function balanceOf(address account) external view returns (uint256);
    function transfer(address to, uint256 amount) external returns (bool);
    function transferFrom(address from, address to, uint256 amount) external returns (bool);
}

/// @title BaseVoucherCampaign — ONE shared link, first N wallets claim.
/// @notice A creator funds a campaign (ETH or any ERC20, incl. tokenized stocks) and shares a
///         single link. The first `maxClaims` distinct wallets to claim each receive an equal share.
///
/// Safety properties
///  - One claim per wallet per campaign, enforced onchain.
///  - Funds are escrowed in full at creation; unclaimed funds can only ever go back to the creator.
///  - Optional `claimSigner`: claims then also need a short-lived ticket signed by that address
///    (used by the app for region / kill-switch / anti-bot checks, incl. tokenized stocks).
///    A ticket is bound to (chain, contract, campaign, claimer, deadline) so it cannot be replayed.
///  - Optional `committed` mode: the creator cannot cancel before expiry (trustless for claimers).
///  - Sender identity: the creator address is recorded by the contract (msg.sender) and can't be
///    spoofed; an optional short `senderLabel` is emitted for display only and must be verified
///    against the creator address by the UI.
///  - Checks-effects-interactions + reentrancy guard; fee-on-transfer tokens are rejected.
contract BaseVoucherCampaign {
    uint256 public constant MAX_CLAIMS = 1000;
    uint256 public constant MAX_MESSAGE_BYTES = 280;
    uint256 public constant MAX_LABEL_BYTES = 40;
    uint256 public constant MAX_TICKET_TTL = 1 hours;

    struct Campaign {
        address creator;
        address token; // address(0) = ETH
        uint256 amountPerClaim;
        uint32 maxClaims;
        uint32 claimedCount;
        uint64 unlockAt; // 0 = none
        uint64 expiresAt; // 0 = never
        address claimSigner; // 0 = open claim (secret only)
        bytes32 secretHash;
        bool committed; // creator cannot cancel before expiry
        bool closed; // cancelled / fully refunded
    }

    struct CreateParams {
        address token;
        uint256 totalAmount;
        uint32 maxClaims;
        bytes32 secretHash;
        uint64 unlockAt;
        uint64 expiresAt;
        address claimSigner;
        bool committed;
        string message;
        string senderLabel;
    }

    uint256 public nextCampaignId = 1;
    mapping(uint256 => Campaign) private _campaigns;
    mapping(uint256 => string) private _messages;
    mapping(uint256 => string) private _senderLabels;
    mapping(uint256 => mapping(address => bool)) public hasClaimed;

    uint256 private _lock = 1;

    event CampaignCreated(
        uint256 indexed campaignId,
        address indexed creator,
        address token,
        uint256 totalAmount,
        uint32 maxClaims,
        uint64 unlockAt,
        uint64 expiresAt,
        address claimSigner,
        bool committed,
        string senderLabel,
        string message
    );
    event CampaignClaimed(
        uint256 indexed campaignId,
        address indexed claimer,
        uint256 amount,
        uint32 claimedCount
    );
    event CampaignClosed(uint256 indexed campaignId, address indexed creator, uint256 refunded);

    modifier nonReentrant() {
        require(_lock == 1, "Reentrancy");
        _lock = 2;
        _;
        _lock = 1;
    }

    // ───────────────────────────── create ─────────────────────────────

    function createEthCampaign(CreateParams calldata p) external payable nonReentrant returns (uint256) {
        require(p.token == address(0), "Token must be zero for ETH");
        require(msg.value == p.totalAmount && msg.value > 0, "ETH amount mismatch");
        return _create(p);
    }

    function createTokenCampaign(CreateParams calldata p) external nonReentrant returns (uint256) {
        require(p.token != address(0) && p.token.code.length > 0, "Invalid token");
        require(p.totalAmount > 0, "No token amount");

        uint256 before = ICampaignERC20(p.token).balanceOf(address(this));
        _safeTransferFrom(p.token, msg.sender, address(this), p.totalAmount);
        uint256 received = ICampaignERC20(p.token).balanceOf(address(this)) - before;
        require(received == p.totalAmount, "Fee-on-transfer unsupported");
        return _create(p);
    }

    function _create(CreateParams calldata p) internal returns (uint256 id) {
        require(p.maxClaims > 0 && p.maxClaims <= MAX_CLAIMS, "Invalid claim count");
        require(p.secretHash != bytes32(0), "Empty secret hash");
        require(p.totalAmount % p.maxClaims == 0, "Amount must split evenly");
        require(bytes(p.message).length <= MAX_MESSAGE_BYTES, "Message too long");
        require(bytes(p.senderLabel).length <= MAX_LABEL_BYTES, "Label too long");
        if (p.expiresAt > 0) {
            require(p.expiresAt > block.timestamp, "Already expired");
            if (p.unlockAt > 0) require(p.expiresAt > p.unlockAt, "Expiry must be after unlock");
        }
        // A committed campaign needs an expiry, otherwise funds could never come back.
        require(!p.committed || p.expiresAt > 0, "Committed needs expiry");

        id = nextCampaignId++;
        _campaigns[id] = Campaign({
            creator: msg.sender,
            token: p.token,
            amountPerClaim: p.totalAmount / p.maxClaims,
            maxClaims: p.maxClaims,
            claimedCount: 0,
            unlockAt: p.unlockAt,
            expiresAt: p.expiresAt,
            claimSigner: p.claimSigner,
            secretHash: p.secretHash,
            committed: p.committed,
            closed: false
        });
        _messages[id] = p.message;
        _senderLabels[id] = p.senderLabel;

        emit CampaignCreated(
            id,
            msg.sender,
            p.token,
            p.totalAmount,
            p.maxClaims,
            p.unlockAt,
            p.expiresAt,
            p.claimSigner,
            p.committed,
            p.senderLabel,
            p.message
        );
    }

    // ───────────────────────────── claim ──────────────────────────────

    /// @param secret   the shared secret from the link fragment
    /// @param deadline ticket expiry (ignored when the campaign has no claimSigner)
    /// @param ticket   65-byte signature from claimSigner (ignored when none is set)
    function claim(uint256 campaignId, string calldata secret, uint64 deadline, bytes calldata ticket)
        external
        nonReentrant
    {
        Campaign storage c = _campaigns[campaignId];
        require(c.maxClaims > 0, "Invalid campaign");
        require(!c.closed, "Campaign closed");
        require(c.claimedCount < c.maxClaims, "All claims taken");
        require(!hasClaimed[campaignId][msg.sender], "Already claimed");
        require(msg.sender != c.creator, "Creator cannot claim");
        require(c.unlockAt == 0 || block.timestamp >= c.unlockAt, "Not unlocked yet");
        require(c.expiresAt == 0 || block.timestamp < c.expiresAt, "Campaign expired");
        require(keccak256(abi.encodePacked(secret)) == c.secretHash, "Invalid secret");

        if (c.claimSigner != address(0)) {
            require(block.timestamp <= deadline, "Ticket expired");
            require(deadline <= block.timestamp + MAX_TICKET_TTL, "Ticket TTL too long");
            bytes32 digest = claimDigest(campaignId, msg.sender, deadline);
            require(_recover(digest, ticket) == c.claimSigner, "Invalid ticket");
        }

        // effects
        hasClaimed[campaignId][msg.sender] = true;
        c.claimedCount += 1;
        uint256 amount = c.amountPerClaim;

        // interactions
        if (c.token == address(0)) {
            (bool ok, ) = payable(msg.sender).call{value: amount}("");
            require(ok, "ETH transfer failed");
        } else {
            _safeTransfer(c.token, msg.sender, amount);
        }

        emit CampaignClaimed(campaignId, msg.sender, amount, c.claimedCount);
    }

    /// @notice Digest the claimSigner signs (EIP-191 personal_sign over this hash).
    function claimDigest(uint256 campaignId, address claimer, uint64 deadline) public view returns (bytes32) {
        return keccak256(
            abi.encodePacked(
                "\x19Ethereum Signed Message:\n32",
                keccak256(abi.encode(block.chainid, address(this), campaignId, claimer, deadline))
            )
        );
    }

    // ───────────────────────────── close ──────────────────────────────

    /// @notice Refund every unclaimed share to the creator. Creator only. A `committed`
    ///         campaign can only be closed after it expires.
    function close(uint256 campaignId) external nonReentrant {
        Campaign storage c = _campaigns[campaignId];
        require(c.maxClaims > 0, "Invalid campaign");
        require(msg.sender == c.creator, "Only creator");
        require(!c.closed, "Already closed");
        bool expired = c.expiresAt > 0 && block.timestamp >= c.expiresAt;
        require(!c.committed || expired, "Committed until expiry");

        uint256 remaining = uint256(c.maxClaims - c.claimedCount) * c.amountPerClaim;
        c.closed = true;

        if (remaining > 0) {
            if (c.token == address(0)) {
                (bool ok, ) = payable(c.creator).call{value: remaining}("");
                require(ok, "ETH refund failed");
            } else {
                _safeTransfer(c.token, c.creator, remaining);
            }
        }
        emit CampaignClosed(campaignId, c.creator, remaining);
    }

    // ───────────────────────────── views ──────────────────────────────

    function getCampaign(uint256 campaignId)
        external
        view
        returns (Campaign memory campaign, string memory message, string memory senderLabel)
    {
        return (_campaigns[campaignId], _messages[campaignId], _senderLabels[campaignId]);
    }

    function claimsRemaining(uint256 campaignId) external view returns (uint256) {
        Campaign storage c = _campaigns[campaignId];
        if (c.closed) return 0;
        return c.maxClaims - c.claimedCount;
    }

    // ──────────────────────────── internals ───────────────────────────

    function _safeTransfer(address token, address to, uint256 amount) private {
        (bool ok, bytes memory ret) = token.call(abi.encodeWithSelector(ICampaignERC20.transfer.selector, to, amount));
        require(ok && (ret.length == 0 || abi.decode(ret, (bool))), "Token transfer failed");
    }

    function _safeTransferFrom(address token, address from, address to, uint256 amount) private {
        (bool ok, bytes memory ret) =
            token.call(abi.encodeWithSelector(ICampaignERC20.transferFrom.selector, from, to, amount));
        require(ok && (ret.length == 0 || abi.decode(ret, (bool))), "Token pull failed");
    }

    function _recover(bytes32 digest, bytes calldata sig) private pure returns (address) {
        require(sig.length == 65, "Bad signature length");
        bytes32 r = bytes32(sig[0:32]);
        bytes32 s = bytes32(sig[32:64]);
        uint8 v = uint8(sig[64]);
        if (v < 27) v += 27;
        require(v == 27 || v == 28, "Bad v");
        // reject malleable (high-s) signatures
        require(
            uint256(s) <= 0x7FFFFFFFFFFFFFFFFFFFFFFFFFFFFFFF5D576E7357A4501DDFE92F46681B20A0,
            "Bad s"
        );
        address signer = ecrecover(digest, v, r, s);
        require(signer != address(0), "Bad signature");
        return signer;
    }
}
