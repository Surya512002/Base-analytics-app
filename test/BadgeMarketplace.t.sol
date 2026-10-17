// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "forge-std/Test.sol";
import "../contracts/BadgeMarketplace.sol";

contract MockBadgeERC1155 is IERC1155 {
    mapping(address => mapping(uint256 => uint256)) public balances;
    mapping(address => mapping(address => bool)) public isApprovedForAll;

    function mint(address to, uint256 id, uint256 amount) external {
        balances[to][id] += amount;
    }

    function balanceOf(address account, uint256 id) external view override returns (uint256) {
        return balances[account][id];
    }

    function setApprovalForAll(address operator, bool approved) external {
        isApprovedForAll[msg.sender][operator] = approved;
    }

    function safeTransferFrom(
        address from,
        address to,
        uint256 id,
        uint256 amount,
        bytes calldata
    ) external override {
        require(from == msg.sender || isApprovedForAll[from][msg.sender], "not authorized");
        require(balances[from][id] >= amount, "low balance");
        balances[from][id] -= amount;
        balances[to][id] += amount;
    }
}

contract BadgeMarketplaceTest is Test {
    BadgeMarketplace public marketplace;
    MockBadgeERC1155 public badges;
    address public seller = address(0x1111);
    address public buyer = address(0x2222);

    function setUp() public {
        badges = new MockBadgeERC1155();
        marketplace = new BadgeMarketplace(address(badges));

        badges.mint(seller, 1, 10);
        vm.prank(seller);
        badges.setApprovalForAll(address(marketplace), true);
    }

    function test_ListBadge_Success() public {
        vm.prank(seller);
        marketplace.list(1, 10_000_000); // 10 USDC

        assertEq(marketplace.listingCount(), 1);
        (address s, uint256 tokenId, uint256 price, bool active) = marketplace.listings(1);
        assertEq(s, seller);
        assertEq(tokenId, 1);
        assertEq(price, 10_000_000);
        assertTrue(active);
        assertEq(badges.balanceOf(address(marketplace), 1), 1);
    }

    function test_CancelListing_Success() public {
        vm.prank(seller);
        marketplace.list(1, 5_000_000);

        vm.prank(seller);
        marketplace.cancel(1);

        (, , , bool active) = marketplace.listings(1);
        assertFalse(active);
        assertEq(badges.balanceOf(seller, 1), 10); // Returned to seller
    }

    function test_CancelListing_Revert_NotSeller() public {
        vm.prank(seller);
        marketplace.list(1, 5_000_000);

        vm.prank(buyer);
        vm.expectRevert("not seller");
        marketplace.cancel(1);
    }
}
