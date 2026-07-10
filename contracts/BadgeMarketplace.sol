// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

interface IERC1155 {
    function balanceOf(address account, uint256 id) external view returns (uint256);
    function safeTransferFrom(
        address from,
        address to,
        uint256 id,
        uint256 amount,
        bytes calldata data
    ) external;
}

interface IERC20 {
    function transferFrom(address from, address to, uint256 amount) external returns (bool);
}

/// @title BadgeMarketplace — escrow ERC1155 achievement badges for USDC on Base
contract BadgeMarketplace {
    address public immutable badges;
    address public constant USDC = 0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913;

    struct Listing {
        address seller;
        uint256 tokenId;
        uint256 price;
        bool active;
    }

    uint256 public nextListingId = 1;
    mapping(uint256 => Listing) public listings;

    event Listed(uint256 indexed listingId, address indexed seller, uint256 tokenId, uint256 price);
    event Sold(uint256 indexed listingId, address indexed buyer, address indexed seller);
    event Cancelled(uint256 indexed listingId);

    constructor(address badges_) {
        badges = badges_;
    }

    function list(uint256 tokenId, uint256 priceUsdc) external {
        require(priceUsdc > 0, "price");
        IERC1155(badges).safeTransferFrom(msg.sender, address(this), tokenId, 1, "");
        uint256 id = nextListingId++;
        listings[id] = Listing(msg.sender, tokenId, priceUsdc, true);
        emit Listed(id, msg.sender, tokenId, priceUsdc);
    }

    function buy(uint256 listingId) external {
        Listing storage L = listings[listingId];
        require(L.active, "inactive");
        L.active = false;
        require(IERC20(USDC).transferFrom(msg.sender, L.seller, L.price), "pay failed");
        IERC1155(badges).safeTransferFrom(address(this), msg.sender, L.tokenId, 1, "");
        emit Sold(listingId, msg.sender, L.seller);
    }

    function cancel(uint256 listingId) external {
        Listing storage L = listings[listingId];
        require(L.active && L.seller == msg.sender, "not seller");
        L.active = false;
        IERC1155(badges).safeTransferFrom(address(this), msg.sender, L.tokenId, 1, "");
        emit Cancelled(listingId);
    }

    function listingCount() external view returns (uint256) {
        return nextListingId > 1 ? nextListingId - 1 : 0;
    }
}
