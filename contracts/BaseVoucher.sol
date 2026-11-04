// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

interface IERC20 {
    function transferFrom(address from, address to, uint256 amount) external returns (bool);
    function transfer(address to, uint256 amount) external returns (bool);
}

/// @title BaseVoucher — split ETH/USDC/Token gifts on Base (max 50 cards per batch) with time-lock, expiration reclaim, and conditional access
contract BaseVoucher {
    address public constant USDC = 0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913;
    uint256 public constant MAX_CARDS = 50;

    struct Batch {
        address creator;
        address token;
        uint256 amountPerCard;
        uint256 cardCount;
        uint256 redeemedCount;
        string message;
    }

    uint256 public nextBatchId = 1;

    mapping(uint256 => Batch) public batches;
    mapping(uint256 => mapping(uint256 => bytes32)) public cardSecretHashes;
    mapping(uint256 => mapping(uint256 => bool)) public cardRedeemed;
    mapping(uint256 => mapping(address => bool)) public walletRedeemedBatch;

    // Advanced features: time-lock, expiration, and conditional authorization
    mapping(uint256 => uint64) public batchUnlockTimestamps;
    mapping(uint256 => uint64) public batchExpirationTimestamps;
    mapping(uint256 => address) public batchRequiredSigners;

    event BatchCreated(
        uint256 indexed batchId,
        address indexed creator,
        address token,
        uint256 totalAmount,
        uint256 cardCount,
        string message
    );
    event BatchConfigured(
        uint256 indexed batchId,
        uint64 unlockTimestamp,
        uint64 expirationTimestamp,
        address requiredSigner
    );
    event CardRedeemed(
        uint256 indexed batchId,
        uint256 indexed cardIndex,
        address indexed redeemer,
        uint256 amount
    );
    event BatchReclaimed(
        uint256 indexed batchId,
        address indexed creator,
        uint256 amount
    );

    function createEthBatch(
        uint256 cardCount,
        bytes32[] calldata secretHashes,
        string calldata message
    ) external payable {
        createEthBatchCustom(cardCount, secretHashes, message, 0, 0, address(0));
    }

    function createEthBatchCustom(
        uint256 cardCount,
        bytes32[] calldata secretHashes,
        string calldata message,
        uint64 unlockTimestamp,
        uint64 expirationTimestamp,
        address requiredSigner
    ) public payable {
        require(msg.value > 0, "No ETH sent");
        _createBatch(
            address(0),
            cardCount,
            secretHashes,
            message,
            msg.value,
            unlockTimestamp,
            expirationTimestamp,
            requiredSigner
        );
    }

    function createUsdcBatch(
        uint256 cardCount,
        bytes32[] calldata secretHashes,
        string calldata message,
        uint256 totalAmount
    ) external {
        createTokenBatchCustom(USDC, cardCount, secretHashes, message, totalAmount, 0, 0, address(0));
    }

    function createTokenBatch(
        address token,
        uint256 cardCount,
        bytes32[] calldata secretHashes,
        string calldata message,
        uint256 totalAmount
    ) external {
        createTokenBatchCustom(token, cardCount, secretHashes, message, totalAmount, 0, 0, address(0));
    }

    function createTokenBatchCustom(
        address token,
        uint256 cardCount,
        bytes32[] calldata secretHashes,
        string calldata message,
        uint256 totalAmount,
        uint64 unlockTimestamp,
        uint64 expirationTimestamp,
        address requiredSigner
    ) public {
        require(token != address(0), "Invalid token");
        require(totalAmount > 0, "No token amount");
        require(
            IERC20(token).transferFrom(msg.sender, address(this), totalAmount),
            "Token transfer failed"
        );
        _createBatch(
            token,
            cardCount,
            secretHashes,
            message,
            totalAmount,
            unlockTimestamp,
            expirationTimestamp,
            requiredSigner
        );
    }

    function redeem(uint256 batchId, uint256 cardIndex, string calldata secret) external {
        redeemConditional(batchId, cardIndex, secret, "");
    }

    function redeemConditional(
        uint256 batchId,
        uint256 cardIndex,
        string calldata secret,
        bytes calldata signature
    ) public {
        Batch storage b = batches[batchId];
        require(b.cardCount > 0, "Invalid batch");
        require(cardIndex < b.cardCount, "Invalid card");
        require(!cardRedeemed[batchId][cardIndex], "Card already redeemed");
        require(!walletRedeemedBatch[batchId][msg.sender], "One card per wallet per batch");

        uint64 unlock = batchUnlockTimestamps[batchId];
        require(unlock == 0 || block.timestamp >= unlock, "Voucher is time-locked");

        uint64 exp = batchExpirationTimestamps[batchId];
        require(exp == 0 || block.timestamp < exp, "Voucher has expired");

        address reqSigner = batchRequiredSigners[batchId];
        if (reqSigner != address(0)) {
            if (msg.sender != reqSigner) {
                require(signature.length == 65, "Invalid signature length");
                bytes32 msgHash = keccak256(abi.encodePacked(
                    "\x19Ethereum Signed Message:\n32",
                    keccak256(abi.encodePacked(address(this), batchId, cardIndex, msg.sender))
                ));
                address recovered = _recoverSigner(msgHash, signature);
                require(recovered == reqSigner, "Invalid authorization signature");
            }
        }

        require(
            keccak256(abi.encodePacked(secret)) == cardSecretHashes[batchId][cardIndex],
            "Invalid secret"
        );

        cardRedeemed[batchId][cardIndex] = true;
        walletRedeemedBatch[batchId][msg.sender] = true;
        b.redeemedCount++;

        if (b.token == address(0)) {
            (bool ok, ) = payable(msg.sender).call{value: b.amountPerCard}("");
            require(ok, "ETH transfer failed");
        } else {
            require(IERC20(b.token).transfer(msg.sender, b.amountPerCard), "Token transfer failed");
        }

        emit CardRedeemed(batchId, cardIndex, msg.sender, b.amountPerCard);
    }

    function reclaimUnredeemed(uint256 batchId) external {
        Batch storage b = batches[batchId];
        require(b.cardCount > 0, "Invalid batch");
        require(msg.sender == b.creator, "Only creator can reclaim");
        uint64 exp = batchExpirationTimestamps[batchId];
        require(exp > 0 && block.timestamp >= exp, "Batch not expired");

        uint256 remainingCards = b.cardCount - b.redeemedCount;
        require(remainingCards > 0, "No cards remaining");

        uint256 reclaimAmount = remainingCards * b.amountPerCard;
        b.redeemedCount = b.cardCount; // Mark all redeemed to prevent double-reclaim

        if (b.token == address(0)) {
            (bool ok, ) = payable(b.creator).call{value: reclaimAmount}("");
            require(ok, "ETH reclaim failed");
        } else {
            require(IERC20(b.token).transfer(b.creator, reclaimAmount), "Token reclaim failed");
        }

        emit BatchReclaimed(batchId, b.creator, reclaimAmount);
    }

    function getBatch(uint256 batchId)
        external
        view
        returns (
            address creator,
            address token,
            uint256 amountPerCard,
            uint256 cardCount,
            uint256 redeemedCount,
            string memory message
        )
    {
        Batch storage b = batches[batchId];
        return (b.creator, b.token, b.amountPerCard, b.cardCount, b.redeemedCount, b.message);
    }

    function getBatchConfig(uint256 batchId)
        external
        view
        returns (
            uint64 unlockTimestamp,
            uint64 expirationTimestamp,
            address requiredSigner
        )
    {
        return (
            batchUnlockTimestamps[batchId],
            batchExpirationTimestamps[batchId],
            batchRequiredSigners[batchId]
        );
    }

    function isBatchUnlocked(uint256 batchId) external view returns (bool) {
        uint64 unlock = batchUnlockTimestamps[batchId];
        return unlock == 0 || block.timestamp >= unlock;
    }

    function isBatchExpired(uint256 batchId) external view returns (bool) {
        uint64 exp = batchExpirationTimestamps[batchId];
        return exp > 0 && block.timestamp >= exp;
    }

    function isCardRedeemed(uint256 batchId, uint256 cardIndex) external view returns (bool) {
        return cardRedeemed[batchId][cardIndex];
    }

    function hasWalletRedeemed(uint256 batchId, address wallet) external view returns (bool) {
        return walletRedeemedBatch[batchId][wallet];
    }

    function _createBatch(
        address token,
        uint256 cardCount,
        bytes32[] calldata secretHashes,
        string calldata message,
        uint256 totalAmount,
        uint64 unlockTimestamp,
        uint64 expirationTimestamp,
        address requiredSigner
    ) internal {
        require(cardCount > 0 && cardCount <= MAX_CARDS, "Invalid card count");
        require(secretHashes.length == cardCount, "Hash count mismatch");
        require(bytes(message).length <= 280, "Message too long");
        require(totalAmount % cardCount == 0, "Amount must split evenly");
        if (expirationTimestamp > 0 && unlockTimestamp > 0) {
            require(expirationTimestamp > unlockTimestamp, "Expiration must be after unlock");
        }

        uint256 batchId = nextBatchId++;
        uint256 perCard = totalAmount / cardCount;

        batches[batchId] = Batch({
            creator: msg.sender,
            token: token,
            amountPerCard: perCard,
            cardCount: cardCount,
            redeemedCount: 0,
            message: message
        });

        if (unlockTimestamp > 0) {
            batchUnlockTimestamps[batchId] = unlockTimestamp;
        }
        if (expirationTimestamp > 0) {
            batchExpirationTimestamps[batchId] = expirationTimestamp;
        }
        if (requiredSigner != address(0)) {
            batchRequiredSigners[batchId] = requiredSigner;
        }

        for (uint256 i = 0; i < cardCount; i++) {
            require(secretHashes[i] != bytes32(0), "Empty hash");
            cardSecretHashes[batchId][i] = secretHashes[i];
        }

        emit BatchCreated(batchId, msg.sender, token, totalAmount, cardCount, message);
        if (unlockTimestamp > 0 || expirationTimestamp > 0 || requiredSigner != address(0)) {
            emit BatchConfigured(batchId, unlockTimestamp, expirationTimestamp, requiredSigner);
        }
    }

    function _recoverSigner(bytes32 messageHash, bytes memory sig) internal pure returns (address) {
        bytes32 r;
        bytes32 s;
        uint8 v;
        assembly {
            r := mload(add(sig, 32))
            s := mload(add(sig, 64))
            v := byte(0, mload(add(sig, 96)))
        }
        if (v < 27) {
            v += 27;
        }
        require(v == 27 || v == 28, "Invalid v parameter");
        return ecrecover(messageHash, v, r, s);
    }
}
