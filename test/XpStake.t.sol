// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "forge-std/Test.sol";
import "../contracts/XpStake.sol";

contract XpStakeTest is Test {
    XpStake public stakeContract;
    address public staker = address(0x5555);

    function setUp() public {
        stakeContract = new XpStake();
        vm.deal(staker, 10 ether);
    }

    function test_Stake_Tier1() public {
        vm.prank(staker);
        stakeContract.stake{value: 0.0001 ether}();

        (uint256 amount, uint64 unlockAt, uint8 tier, bool active) = stakeContract.getStake(staker);
        assertEq(amount, 0.0001 ether);
        assertEq(tier, 1);
        assertTrue(active);
        assertEq(unlockAt, block.timestamp + 7 days);
    }

    function test_Stake_Tier3() public {
        vm.prank(staker);
        stakeContract.stake{value: 0.001 ether}();

        (, , uint8 tier, ) = stakeContract.getStake(staker);
        assertEq(tier, 3);
    }

    function test_Unstake_Revert_Locked() public {
        vm.prank(staker);
        stakeContract.stake{value: 0.001 ether}();

        vm.warp(block.timestamp + 3 days);
        vm.prank(staker);
        vm.expectRevert("locked");
        stakeContract.unstake();
    }

    function test_Unstake_Success_AfterLockPeriod() public {
        vm.prank(staker);
        stakeContract.stake{value: 0.001 ether}();

        uint256 balBefore = staker.balance;
        vm.warp(block.timestamp + 7 days + 1);

        vm.prank(staker);
        stakeContract.unstake();

        assertEq(staker.balance, balBefore + 0.001 ether);
        (, , , bool active) = stakeContract.getStake(staker);
        assertFalse(active);
    }
}
