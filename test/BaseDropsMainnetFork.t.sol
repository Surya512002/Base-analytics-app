// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "forge-std/Test.sol";
import {BaseDrops} from "../contracts/drops/BaseDrops.sol";

interface IUSDC {
    function balanceOf(address) external view returns (uint256);
    function transfer(address, uint256) external returns (bool);
    function approve(address, uint256) external returns (bool);
}

/// Rehearsal against the REAL Base mainnet state (a fork: nothing is sent to the chain).
/// Covers what the mocks can't: Circle's real USDC (proxy, blacklist logic) funding a drop,
/// a random-split-style ticket drop paying exact shares, and the exact refund on close.
///
/// Run: FORK_BASE=true forge test --match-contract BaseDropsMainnetFork -vv
/// Skipped unless FORK_BASE=true so normal test runs stay offline.
contract BaseDropsMainnetForkTest is Test {
    address constant USDC = 0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913;
    // Aave's aBasUSDC pool holds a large USDC balance; we only impersonate it on the fork to fund test wallets.
    address constant WHALE = 0x4e65fE4DbA92790696d040ac24Aa414708F5c0AB;

    BaseDrops drops;
    // Fresh addresses: round numbers like 0xA11CE are real mainnet wallets that may already hold USDC.
    address creator = makeAddr("drops-fork-creator");
    address alice = makeAddr("drops-fork-alice");
    address bob = makeAddr("drops-fork-bob");
    address carol = makeAddr("drops-fork-carol");
    address dave = makeAddr("drops-fork-dave");
    address erin = makeAddr("drops-fork-erin");
    uint256 constant TICKET_PK = 0xA11CE1;

    function setUp() public {
        if (!vm.envOr("FORK_BASE", false)) {
            vm.skip(true);
            return;
        }
        vm.createSelectFork(vm.envOr("BASE_RPC_URL", string("https://mainnet.base.org")));
        require(block.chainid == 8453, "not Base mainnet");
        drops = new BaseDrops();
        uint256 whaleBal = IUSDC(USDC).balanceOf(WHALE);
        require(whaleBal > 1_000e6, "whale has too little USDC to fund the test");
        vm.prank(WHALE);
        IUSDC(USDC).transfer(creator, 1_000e6);
    }

    function _ticket(uint256 id, address who, uint32 idx, uint256 amount, uint64 dl) internal view returns (BaseDrops.ClaimArgs memory a) {
        (uint8 v, bytes32 r, bytes32 s) = vm.sign(TICKET_PK, drops.ticketDigest(id, who, idx, amount, dl));
        a.amount = amount;
        a.deadline = dl;
        a.ticket = abi.encodePacked(r, s, v);
    }

    /// 100 USDC in escrow, 4 claims sharing it exactly (random split: 10 + 55 + 30 + 5), then an exact refund.
    function test_RealUsdc_SplitShares_SumToBudget_AndRefundIsExact() public {
        BaseDrops.CreateParams memory p;
        p.token = USDC;
        p.budget = 100e6;
        p.amountPerClaim = 5e6; // smallest share
        p.maxAmountPerClaim = 60e6; // largest share
        p.maxClaimsTotal = 4;
        p.maxClaimsPerWallet = 1;
        p.expiresAt = uint64(block.timestamp + 30 days);
        p.ticketSigner = vm.addr(TICKET_PK);
        p.message = "fork rehearsal";

        vm.startPrank(creator);
        IUSDC(USDC).approve(address(drops), 100e6); // exactly the budget, never unlimited
        uint256 id = drops.createDrop(p);
        vm.stopPrank();
        assertEq(IUSDC(USDC).balanceOf(address(drops)), 100e6, "escrow holds the budget");

        uint64 dl = uint64(block.timestamp + 10 minutes);
        uint256[4] memory shares = [uint256(10e6), 55e6, 30e6, 5e6];
        address[4] memory who = [alice, bob, carol, dave];
        uint256 total;
        for (uint256 i = 0; i < 4; i++) {
            BaseDrops.ClaimArgs memory args = _ticket(id, who[i], 0, shares[i], dl); // built first: the digest call would eat a prank
            vm.prank(who[i]);
            drops.claim(id, args);
            assertEq(IUSDC(USDC).balanceOf(who[i]), shares[i], "claimer got exactly its share");
            total += shares[i];
        }
        assertEq(total, 100e6, "shares add up to the budget");
        assertEq(IUSDC(USDC).balanceOf(address(drops)), 0, "nothing left in escrow");

        // A fifth claim has nothing to take.
        BaseDrops.ClaimArgs memory extra = _ticket(id, erin, 0, 5e6, dl);
        vm.prank(erin);
        vm.expectRevert();
        drops.claim(id, extra);
    }

    function test_RealUsdc_CloseRefundsTheRemainder() public {
        BaseDrops.CreateParams memory p;
        p.token = USDC;
        p.budget = 50e6;
        p.amountPerClaim = 10e6;
        p.maxClaimsPerWallet = 1;
        p.expiresAt = uint64(block.timestamp + 7 days);
        p.linkSigner = vm.addr(0xBEEF1);
        p.message = "refund check";

        vm.startPrank(creator);
        IUSDC(USDC).approve(address(drops), 50e6);
        uint256 id = drops.createDrop(p);
        vm.stopPrank();

        (uint8 v, bytes32 r, bytes32 s) = vm.sign(0xBEEF1, drops.linkDigest(id, alice));
        BaseDrops.ClaimArgs memory a;
        a.linkSig = abi.encodePacked(r, s, v);
        vm.prank(alice);
        drops.claim(id, a);
        assertEq(IUSDC(USDC).balanceOf(alice), 10e6);

        uint256 before = IUSDC(USDC).balanceOf(creator);
        vm.prank(creator);
        drops.close(id);
        assertEq(IUSDC(USDC).balanceOf(creator) - before, 40e6, "creator gets back exactly what is left");
        assertEq(IUSDC(USDC).balanceOf(address(drops)), 0);
    }
}
