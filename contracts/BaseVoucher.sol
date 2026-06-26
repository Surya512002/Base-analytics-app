// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

interface IERC20 {
    function transferFrom(address from, address to, uint256 amount) external returns (bool);
    function transfer(address to, uint256 amount) external returns (bool);
}

/// @title BaseVoucher — split ETH/USDC gifts on Base (max 50 cards per batch)
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

    event BatchCreated(
        uint256 indexed batchId,
        address indexed creator,
        address token,
        uint256 totalAmount,
        uint256 cardCount,
        string message
    );
    event CardRedeemed(
        uint256 indexed batchId,
        uint256 indexed cardIndex,
        address indexed redeemer,
        uint256 amount
    );

    function createEthBatch(
        uint256 cardCount,
        bytes32[] calldata secretHashes,
        string calldata message
    ) external payable {
        require(msg.value > 0, "No ETH sent");
        _createBatch(address(0), cardCount, secretHashes, message, msg.value);
    }

    function createUsdcBatch(
        uint256 cardCount,
        bytes32[] calldata secretHashes,
        string calldata message,
        uint256 totalAmount
    ) external {
        require(totalAmount > 0, "No USDC amount");
        require(
            IERC20(USDC).transferFrom(msg.sender, address(this), totalAmount),
            "USDC transfer failed"
        );
        _createBatch(USDC, cardCount, secretHashes, message, totalAmount);
    }

    function redeem(uint256 batchId, uint256 cardIndex, string calldata secret) external {
        Batch storage b = batches[batchId];
        require(b.cardCount > 0, "Invalid batch");
        require(cardIndex < b.cardCount, "Invalid card");
        require(!cardRedeemed[batchId][cardIndex], "Card already redeemed");
        require(!walletRedeemedBatch[batchId][msg.sender], "One card per wallet per batch");
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
            require(IERC20(b.token).transfer(msg.sender, b.amountPerCard), "USDC transfer failed");
        }

        emit CardRedeemed(batchId, cardIndex, msg.sender, b.amountPerCard);
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
        uint256 totalAmount
    ) internal {
        require(cardCount > 0 && cardCount <= MAX_CARDS, "Invalid card count");
        require(secretHashes.length == cardCount, "Hash count mismatch");
        require(bytes(message).length <= 280, "Message too long");
        require(totalAmount % cardCount == 0, "Amount must split evenly");

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

        for (uint256 i = 0; i < cardCount; i++) {
            require(secretHashes[i] != bytes32(0), "Empty hash");
            cardSecretHashes[batchId][i] = secretHashes[i];
        }

        emit BatchCreated(batchId, msg.sender, token, totalAmount, cardCount, message);
    }
}
