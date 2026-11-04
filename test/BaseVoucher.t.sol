// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "forge-std/Test.sol";
import "../contracts/BaseVoucher.sol";

contract MockUSDC is IERC20 {
    mapping(address => uint256) public balanceOf;
    mapping(address => mapping(address => uint256)) public allowance;

    function mint(address to, uint256 amount) external {
        balanceOf[to] += amount;
    }

    function transfer(address to, uint256 amount) external override returns (bool) {
        require(balanceOf[msg.sender] >= amount, "low bal");
        balanceOf[msg.sender] -= amount;
        balanceOf[to] += amount;
        return true;
    }

    function approve(address spender, uint256 amount) external returns (bool) {
        allowance[msg.sender][spender] = amount;
        return true;
    }

    function transferFrom(address from, address to, uint256 amount) external override returns (bool) {
        require(balanceOf[from] >= amount, "low bal");
        require(allowance[from][msg.sender] >= amount, "low allow");
        allowance[from][msg.sender] -= amount;
        balanceOf[from] -= amount;
        balanceOf[to] += amount;
        return true;
    }
}

contract ReentrantAttacker {
    BaseVoucher public voucher;
    uint256 public targetBatch;
    uint256 public targetCard;
    string public secret;

    constructor(address _voucher) {
        voucher = BaseVoucher(_voucher);
    }

    function attack(uint256 _batchId, uint256 _cardIndex, string memory _secret) external {
        targetBatch = _batchId;
        targetCard = _cardIndex;
        secret = _secret;
        voucher.redeem(_batchId, _cardIndex, _secret);
    }

    receive() external payable {
        // Attempt reentrancy
        if (address(voucher).balance > 0) {
            voucher.redeem(targetBatch, targetCard, secret);
        }
    }
}

contract BaseVoucherTest is Test {
    BaseVoucher public voucher;
    MockUSDC public mockToken;
    address public alice = address(0xAA11);
    address public bob = address(0xBB22);
    address public charlie = address(0xCC33);
    uint256 internal signerPrivateKey = 0xA11CE;
    address public signer;

    function setUp() public {
        voucher = new BaseVoucher();
        mockToken = new MockUSDC();
        signer = vm.addr(signerPrivateKey);

        vm.deal(alice, 100 ether);
        vm.deal(bob, 100 ether);
        vm.deal(charlie, 100 ether);

        mockToken.mint(alice, 10_000 * 1e6);
        vm.prank(alice);
        mockToken.approve(address(voucher), type(uint256).max);
    }

    function test_CreateEthBatch_Success() public {
        vm.startPrank(alice);
        bytes32[] memory hashes = new bytes32[](2);
        hashes[0] = keccak256(abi.encodePacked("secret1"));
        hashes[1] = keccak256(abi.encodePacked("secret2"));

        voucher.createEthBatch{value: 2 ether}(2, hashes, "Happy Holidays");
        vm.stopPrank();

        (
            address creator,
            address token,
            uint256 amountPerCard,
            uint256 cardCount,
            uint256 redeemedCount,
            string memory msgText
        ) = voucher.getBatch(1);

        assertEq(creator, alice);
        assertEq(token, address(0));
        assertEq(amountPerCard, 1 ether);
        assertEq(cardCount, 2);
        assertEq(redeemedCount, 0);
        assertEq(msgText, "Happy Holidays");
    }

    function test_Redeem_Success() public {
        vm.startPrank(alice);
        bytes32[] memory hashes = new bytes32[](2);
        hashes[0] = keccak256(abi.encodePacked("secret1"));
        hashes[1] = keccak256(abi.encodePacked("secret2"));
        voucher.createEthBatch{value: 2 ether}(2, hashes, "Gift");
        vm.stopPrank();

        uint256 bobBalBefore = bob.balance;
        vm.prank(bob);
        voucher.redeem(1, 0, "secret1");

        assertEq(bob.balance, bobBalBefore + 1 ether);
        assertTrue(voucher.isCardRedeemed(1, 0));
        assertTrue(voucher.hasWalletRedeemed(1, bob));
    }

    function test_Redeem_Revert_WrongSecret() public {
        vm.startPrank(alice);
        bytes32[] memory hashes = new bytes32[](1);
        hashes[0] = keccak256(abi.encodePacked("correct_secret"));
        voucher.createEthBatch{value: 1 ether}(1, hashes, "Gift");
        vm.stopPrank();

        vm.prank(bob);
        vm.expectRevert("Invalid secret");
        voucher.redeem(1, 0, "wrong_secret");
    }

    function test_Redeem_Revert_AlreadyRedeemed() public {
        vm.startPrank(alice);
        bytes32[] memory hashes = new bytes32[](2);
        hashes[0] = keccak256(abi.encodePacked("secret1"));
        hashes[1] = keccak256(abi.encodePacked("secret2"));
        voucher.createEthBatch{value: 2 ether}(2, hashes, "Gift");
        vm.stopPrank();

        vm.prank(bob);
        voucher.redeem(1, 0, "secret1");

        vm.prank(charlie);
        vm.expectRevert("Card already redeemed");
        voucher.redeem(1, 0, "secret1");
    }

    function test_Redeem_Revert_OneCardPerWalletPerBatch() public {
        vm.startPrank(alice);
        bytes32[] memory hashes = new bytes32[](2);
        hashes[0] = keccak256(abi.encodePacked("secret1"));
        hashes[1] = keccak256(abi.encodePacked("secret2"));
        voucher.createEthBatch{value: 2 ether}(2, hashes, "Gift");
        vm.stopPrank();

        vm.startPrank(bob);
        voucher.redeem(1, 0, "secret1");

        vm.expectRevert("One card per wallet per batch");
        voucher.redeem(1, 1, "secret2");
        vm.stopPrank();
    }

    function test_CreateBatch_Revert_MaxCardsEnforced() public {
        vm.startPrank(alice);
        bytes32[] memory hashes = new bytes32[](51);
        for (uint256 i = 0; i < 51; i++) {
            hashes[i] = keccak256(abi.encodePacked(i));
        }

        vm.expectRevert("Invalid card count");
        voucher.createEthBatch{value: 51 ether}(51, hashes, "Too big");
        vm.stopPrank();
    }

    function test_CreateBatch_Revert_UnevenSplitDust() public {
        vm.startPrank(alice);
        bytes32[] memory hashes = new bytes32[](3);
        hashes[0] = bytes32(uint256(1));
        hashes[1] = bytes32(uint256(2));
        hashes[2] = bytes32(uint256(3));

        // 10 wei cannot divide evenly among 3 cards (10 % 3 != 0)
        vm.expectRevert("Amount must split evenly");
        voucher.createEthBatch{value: 10}(3, hashes, "Dust error");
        vm.stopPrank();
    }

    function test_Reentrancy_Resistance() public {
        ReentrantAttacker attacker = new ReentrantAttacker(address(voucher));

        vm.startPrank(alice);
        bytes32[] memory hashes = new bytes32[](2);
        hashes[0] = keccak256(abi.encodePacked("attack_secret"));
        hashes[1] = keccak256(abi.encodePacked("secret2"));
        voucher.createEthBatch{value: 2 ether}(2, hashes, "Pool");
        vm.stopPrank();

        vm.expectRevert();
        attacker.attack(1, 0, "attack_secret");
    }

    // --- TIME-LOCK TESTS ---

    function test_TimeLock_RevertBeforeUnlockTimestamp() public {
        uint64 unlockAt = uint64(block.timestamp + 1 days);
        vm.startPrank(alice);
        bytes32[] memory hashes = new bytes32[](1);
        hashes[0] = keccak256(abi.encodePacked("secret1"));
        voucher.createEthBatchCustom{value: 1 ether}(1, hashes, "Christmas Gift", unlockAt, 0, address(0));
        vm.stopPrank();

        assertFalse(voucher.isBatchUnlocked(1));

        vm.prank(bob);
        vm.expectRevert("Voucher is time-locked");
        voucher.redeem(1, 0, "secret1");
    }

    function test_TimeLock_SuccessAfterUnlockTimestamp() public {
        uint64 unlockAt = uint64(block.timestamp + 1 days);
        vm.startPrank(alice);
        bytes32[] memory hashes = new bytes32[](1);
        hashes[0] = keccak256(abi.encodePacked("secret1"));
        voucher.createEthBatchCustom{value: 1 ether}(1, hashes, "Christmas Gift", unlockAt, 0, address(0));
        vm.stopPrank();

        vm.warp(unlockAt + 1);
        assertTrue(voucher.isBatchUnlocked(1));

        uint256 bobBalBefore = bob.balance;
        vm.prank(bob);
        voucher.redeem(1, 0, "secret1");

        assertEq(bob.balance, bobBalBefore + 1 ether);
    }

    // --- EXPIRATION & RECLAIM TESTS ---

    function test_Expiration_RevertRedemptionAfterExpiration() public {
        uint64 expAt = uint64(block.timestamp + 3 days);
        vm.startPrank(alice);
        bytes32[] memory hashes = new bytes32[](1);
        hashes[0] = keccak256(abi.encodePacked("secret1"));
        voucher.createEthBatchCustom{value: 1 ether}(1, hashes, "Expiring Gift", 0, expAt, address(0));
        vm.stopPrank();

        vm.warp(expAt + 1);
        assertTrue(voucher.isBatchExpired(1));

        vm.prank(bob);
        vm.expectRevert("Voucher has expired");
        voucher.redeem(1, 0, "secret1");
    }

    function test_Reclaim_CreatorCanReclaimExpiredTokens() public {
        uint64 expAt = uint64(block.timestamp + 3 days);
        vm.startPrank(alice);
        bytes32[] memory hashes = new bytes32[](2);
        hashes[0] = keccak256(abi.encodePacked("secret1"));
        hashes[1] = keccak256(abi.encodePacked("secret2"));
        voucher.createEthBatchCustom{value: 2 ether}(2, hashes, "Expiring Gift", 0, expAt, address(0));
        vm.stopPrank();

        // Bob redeems 1 card before expiration
        vm.prank(bob);
        voucher.redeem(1, 0, "secret1");

        // Warp past expiration
        vm.warp(expAt + 10);

        uint256 aliceBalBefore = alice.balance;
        vm.prank(alice);
        voucher.reclaimUnredeemed(1);

        // Alice recovers 1 ETH for unredeemed card
        assertEq(alice.balance, aliceBalBefore + 1 ether);

        // Cannot reclaim again
        vm.prank(alice);
        vm.expectRevert("No cards remaining");
        voucher.reclaimUnredeemed(1);
    }

    function test_Reclaim_RevertIfNotExpiredOrNonCreator() public {
        uint64 expAt = uint64(block.timestamp + 3 days);
        vm.startPrank(alice);
        bytes32[] memory hashes = new bytes32[](1);
        hashes[0] = keccak256(abi.encodePacked("secret1"));
        voucher.createEthBatchCustom{value: 1 ether}(1, hashes, "Expiring Gift", 0, expAt, address(0));
        vm.stopPrank();

        // Non-creator cannot reclaim
        vm.prank(bob);
        vm.expectRevert("Only creator can reclaim");
        voucher.reclaimUnredeemed(1);

        // Creator cannot reclaim before expiration
        vm.prank(alice);
        vm.expectRevert("Batch not expired");
        voucher.reclaimUnredeemed(1);
    }

    // --- CONDITIONAL SIGNER TESTS ---

    function test_ConditionalSigner_AuthorizedRedemption() public {
        vm.startPrank(alice);
        bytes32[] memory hashes = new bytes32[](1);
        hashes[0] = keccak256(abi.encodePacked("secret1"));
        voucher.createEthBatchCustom{value: 1 ether}(1, hashes, "VIP Gift", 0, 0, signer);
        vm.stopPrank();

        // Signer authorizes Bob for batch 1, card 0
        bytes32 innerHash = keccak256(abi.encodePacked(address(voucher), uint256(1), uint256(0), bob));
        bytes32 ethSignedMsgHash = keccak256(abi.encodePacked("\x19Ethereum Signed Message:\n32", innerHash));
        (uint8 v, bytes32 r, bytes32 s) = vm.sign(signerPrivateKey, ethSignedMsgHash);
        bytes memory sig = abi.encodePacked(r, s, v);

        vm.prank(bob);
        voucher.redeemConditional(1, 0, "secret1", sig);

        assertTrue(voucher.isCardRedeemed(1, 0));
        assertEq(bob.balance, 101 ether);
    }

    function test_ConditionalSigner_RevertsUnauthorizedRedemption() public {
        vm.startPrank(alice);
        bytes32[] memory hashes = new bytes32[](1);
        hashes[0] = keccak256(abi.encodePacked("secret1"));
        voucher.createEthBatchCustom{value: 1 ether}(1, hashes, "VIP Gift", 0, 0, signer);
        vm.stopPrank();

        // Bob tries without signature
        vm.prank(bob);
        vm.expectRevert("Invalid signature length");
        voucher.redeem(1, 0, "secret1");
    }

    function test_CreateBatchCustom_RevertIfExpirationBeforeUnlock() public {
        vm.startPrank(alice);
        bytes32[] memory hashes = new bytes32[](1);
        hashes[0] = keccak256(abi.encodePacked("secret1"));

        vm.expectRevert("Expiration must be after unlock");
        voucher.createEthBatchCustom{value: 1 ether}(1, hashes, "Invalid timing", 1000, 500, address(0));
        vm.stopPrank();
    }
}
