// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "forge-std/Test.sol";
import {BaseDrops} from "../contracts/drops/BaseDrops.sol";
import {TokenBalanceGate} from "../contracts/drops/TokenBalanceGate.sol";

contract DropsToken {
    mapping(address => uint256) public balanceOf;
    mapping(address => mapping(address => uint256)) public allowance;
    uint256 public feeBps; // fee-on-transfer simulation

    function setFee(uint256 bps) external {
        feeBps = bps;
    }

    function mint(address to, uint256 amount) external {
        balanceOf[to] += amount;
    }

    function approve(address spender, uint256 amount) external returns (bool) {
        allowance[msg.sender][spender] = amount;
        return true;
    }

    function transfer(address to, uint256 amount) external returns (bool) {
        _move(msg.sender, to, amount);
        return true;
    }

    function transferFrom(address from, address to, uint256 amount) external returns (bool) {
        require(allowance[from][msg.sender] >= amount, "allowance");
        allowance[from][msg.sender] -= amount;
        _move(from, to, amount);
        return true;
    }

    function _move(address from, address to, uint256 amount) private {
        require(balanceOf[from] >= amount, "balance");
        balanceOf[from] -= amount;
        uint256 fee = (amount * feeBps) / 10_000;
        balanceOf[to] += amount - fee;
    }
}

/// Tries to claim again from inside the ETH payout.
contract ReenteringClaimer {
    BaseDrops public drops;
    uint256 public dropId;
    BaseDrops.ClaimArgs internal args;
    bool public reentered;

    constructor(BaseDrops d) {
        drops = d;
    }

    function go(uint256 id, BaseDrops.ClaimArgs calldata a) external {
        dropId = id;
        args = a;
        drops.claim(id, a);
    }

    receive() external payable {
        if (!reentered) {
            reentered = true;
            drops.claim(dropId, args);
        }
    }
}

contract BaseDropsTest is Test {
    BaseDrops drops;
    TokenBalanceGate gate;
    DropsToken token;

    uint256 constant LINK_PK = 0xA11CE;
    uint256 constant TICKET_PK = 0xB0B;
    uint256 constant CODE1_PK = 0xC0DE1;
    uint256 constant CODE2_PK = 0xC0DE2;

    address creator = makeAddr("creator");
    address alice = makeAddr("alice");
    address bob = makeAddr("bob");
    address carol = makeAddr("carol");
    address manager = makeAddr("manager");
    address rescuer = makeAddr("rescuer");

    function setUp() public {
        vm.warp(1_700_000_000);
        drops = new BaseDrops();
        gate = new TokenBalanceGate();
        token = new DropsToken();
        vm.deal(creator, 1_000 ether);
    }

    // ───────────────────────────── helpers ─────────────────────────────

    function _params() internal view returns (BaseDrops.CreateParams memory p) {
        p.token = address(0);
        p.budget = 10 ether;
        p.amountPerClaim = 1 ether;
        p.maxClaimsPerWallet = 1;
        p.expiresAt = uint64(block.timestamp + 30 days);
        p.linkSigner = vm.addr(LINK_PK);
        p.message = "gm";
        p.senderLabel = "creator";
    }

    function _create(BaseDrops.CreateParams memory p) internal returns (uint256 id) {
        vm.prank(creator);
        id = drops.createDrop{value: p.token == address(0) ? p.budget : 0}(p);
    }

    function _sign(uint256 pk, bytes32 digest) internal pure returns (bytes memory) {
        (uint8 v, bytes32 r, bytes32 s) = vm.sign(pk, digest);
        return abi.encodePacked(r, s, v);
    }

    function _linkArgs(uint256 id, address who) internal view returns (BaseDrops.ClaimArgs memory a) {
        a.linkSig = _sign(LINK_PK, drops.linkDigest(id, who));
    }

    function _claim(uint256 id, address who, BaseDrops.ClaimArgs memory a) internal {
        vm.prank(who);
        drops.claim(id, a);
    }

    function _leaf(address a) internal pure returns (bytes32) {
        return keccak256(bytes.concat(keccak256(abi.encode(a))));
    }

    function _hashPair(bytes32 a, bytes32 b) internal pure returns (bytes32) {
        return a < b ? keccak256(abi.encodePacked(a, b)) : keccak256(abi.encodePacked(b, a));
    }

    // ───────────────────────────── create ─────────────────────────────

    function test_Create_IdsStartAtFirstDropId() public {
        uint256 id = _create(_params());
        assertEq(id, drops.FIRST_DROP_ID());
        assertEq(address(drops).balance, 10 ether);
    }

    function test_Create_RejectsUnsafeConfigs() public {
        BaseDrops.CreateParams memory p = _params();
        p.linkSigner = address(0);
        vm.prank(creator);
        vm.expectRevert("Drop needs an access rule");
        drops.createDrop{value: p.budget}(p);

        p = _params();
        p.expiresAt = uint64(block.timestamp);
        vm.prank(creator);
        vm.expectRevert("Expiry must be in the future");
        drops.createDrop{value: p.budget}(p);

        p = _params();
        p.maxAmountPerClaim = 5 ether; // variable amounts without a ticket signer
        vm.prank(creator);
        vm.expectRevert("Variable amounts need tickets");
        drops.createDrop{value: p.budget}(p);

        p = _params();
        p.periodSecs = 1 days; // period without a cap
        vm.prank(creator);
        vm.expectRevert("Period needs a cap");
        drops.createDrop{value: p.budget}(p);

        p = _params();
        vm.prank(creator);
        vm.expectRevert("ETH amount mismatch");
        drops.createDrop{value: 1 ether}(p);
    }

    function test_Create_RejectsFeeOnTransferToken() public {
        token.mint(creator, 100e18);
        token.setFee(100);
        BaseDrops.CreateParams memory p = _params();
        p.token = address(token);
        p.budget = 10e18;
        p.amountPerClaim = 1e18;
        vm.startPrank(creator);
        token.approve(address(drops), 10e18);
        vm.expectRevert("Fee-on-transfer unsupported");
        drops.createDrop(p);
        vm.stopPrank();
    }

    // ───────────────────────────── link ─────────────────────────────

    function test_Link_ClaimPaysAndIsBoundToWallet() public {
        uint256 id = _create(_params());
        _claim(id, alice, _linkArgs(id, alice));
        assertEq(alice.balance, 1 ether);

        // Alice's link proof is useless to Bob (front-running / copying it from calldata).
        BaseDrops.ClaimArgs memory stolen = _linkArgs(id, alice);
        vm.prank(bob);
        vm.expectRevert("Invalid link");
        drops.claim(id, stolen);
    }

    function test_Link_OneClaimPerWalletAndCreatorCantClaim() public {
        uint256 id = _create(_params());
        _claim(id, alice, _linkArgs(id, alice));
        BaseDrops.ClaimArgs memory again = _linkArgs(id, alice);
        vm.prank(alice);
        vm.expectRevert("Wallet claim limit reached");
        drops.claim(id, again);

        BaseDrops.ClaimArgs memory a = _linkArgs(id, creator);
        vm.prank(creator);
        vm.expectRevert("Creator cannot claim");
        drops.claim(id, a);
    }

    function test_Link_RejectsHighS() public {
        uint256 id = _create(_params());
        (uint8 v, bytes32 r, bytes32 s) = vm.sign(LINK_PK, drops.linkDigest(id, alice));
        uint256 n = 0xFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFEBAAEDCE6AF48A03BBFD25E8CD0364141;
        bytes32 highS = bytes32(n - uint256(s));
        uint8 flipped = v == 27 ? 28 : 27;
        BaseDrops.ClaimArgs memory a;
        a.linkSig = abi.encodePacked(r, highS, flipped);
        vm.prank(alice);
        vm.expectRevert("Bad s");
        drops.claim(id, a);
    }

    // ───────────────────────────── frequency ─────────────────────────────

    function test_Cooldown_DailyClaims() public {
        BaseDrops.CreateParams memory p = _params();
        p.maxClaimsPerWallet = 0;
        p.cooldown = 1 days;
        uint256 id = _create(p);

        _claim(id, alice, _linkArgs(id, alice));
        assertEq(drops.claimBlocker(id, alice), "Cooldown active");
        assertEq(drops.nextClaimAt(id, alice), block.timestamp + 1 days);
        BaseDrops.ClaimArgs memory tooSoon = _linkArgs(id, alice);
        vm.prank(alice);
        vm.expectRevert("Cooldown active");
        drops.claim(id, tooSoon);

        vm.warp(block.timestamp + 1 days);
        assertEq(drops.claimBlocker(id, alice), "");
        _claim(id, alice, _linkArgs(id, alice));
        assertEq(alice.balance, 2 ether);
    }

    function test_PeriodCap_ResetsNextPeriod() public {
        BaseDrops.CreateParams memory p = _params();
        p.periodSecs = 1 days;
        p.maxClaimsPerPeriod = 2;
        uint256 id = _create(p);

        _claim(id, alice, _linkArgs(id, alice));
        _claim(id, bob, _linkArgs(id, bob));
        BaseDrops.ClaimArgs memory c = _linkArgs(id, carol);
        vm.prank(carol);
        vm.expectRevert("Period cap reached");
        drops.claim(id, c);

        vm.warp(block.timestamp + 1 days);
        _claim(id, carol, c);
        assertEq(carol.balance, 1 ether);
    }

    function test_TotalCapAndBudget() public {
        BaseDrops.CreateParams memory p = _params();
        p.maxClaimsTotal = 1;
        uint256 id = _create(p);
        _claim(id, alice, _linkArgs(id, alice));
        BaseDrops.ClaimArgs memory b = _linkArgs(id, bob);
        vm.prank(bob);
        vm.expectRevert("All claims taken");
        drops.claim(id, b);

        p = _params();
        p.budget = 1.5 ether;
        uint256 id2 = _create(p);
        _claim(id2, alice, _linkArgs(id2, alice));
        b = _linkArgs(id2, bob);
        vm.prank(bob);
        vm.expectRevert("Budget exhausted");
        drops.claim(id2, b);
    }

    function test_UnlockAndExpiry() public {
        BaseDrops.CreateParams memory p = _params();
        p.unlockAt = uint64(block.timestamp + 1 hours);
        uint256 id = _create(p);
        BaseDrops.ClaimArgs memory a = _linkArgs(id, alice);
        vm.prank(alice);
        vm.expectRevert("Not unlocked yet");
        drops.claim(id, a);

        vm.warp(p.expiresAt);
        vm.prank(alice);
        vm.expectRevert("Drop expired");
        drops.claim(id, a);
    }

    // ───────────────────────────── one-time codes (gift cards) ─────────────────────────────

    function _codesDrop() internal returns (uint256 id, bytes32[] memory proof1, bytes32[] memory proof2) {
        bytes32 l1 = _leaf(vm.addr(CODE1_PK));
        bytes32 l2 = _leaf(vm.addr(CODE2_PK));
        BaseDrops.CreateParams memory p = _params();
        p.linkSigner = address(0);
        p.codesRoot = _hashPair(l1, l2);
        id = _create(p);
        proof1 = new bytes32[](1);
        proof1[0] = l2;
        proof2 = new bytes32[](1);
        proof2[0] = l1;
    }

    function _codeArgs(uint256 id, uint256 pk, bytes32[] memory proof, address who)
        internal
        view
        returns (BaseDrops.ClaimArgs memory a)
    {
        a.code = vm.addr(pk);
        a.codeProof = proof;
        a.codeSig = _sign(pk, drops.codeDigest(id, who));
    }

    function test_Codes_EachUsableOnce() public {
        (uint256 id, bytes32[] memory proof1, bytes32[] memory proof2) = _codesDrop();
        _claim(id, alice, _codeArgs(id, CODE1_PK, proof1, alice));
        assertTrue(drops.codeUsed(id, vm.addr(CODE1_PK)));

        BaseDrops.ClaimArgs memory again = _codeArgs(id, CODE1_PK, proof1, bob);
        vm.prank(bob);
        vm.expectRevert("Code already used");
        drops.claim(id, again);

        _claim(id, bob, _codeArgs(id, CODE2_PK, proof2, bob));
        assertEq(bob.balance, 1 ether);
    }

    function test_Codes_SignatureBoundToWalletAndUnknownCodesFail() public {
        (uint256 id, bytes32[] memory proof1,) = _codesDrop();
        // Bob copies Alice's code proof from the mempool.
        BaseDrops.ClaimArgs memory alices = _codeArgs(id, CODE1_PK, proof1, alice);
        vm.prank(bob);
        vm.expectRevert("Invalid code signature");
        drops.claim(id, alices);

        BaseDrops.ClaimArgs memory fake = _codeArgs(id, 0xBAD, proof1, carol);
        vm.prank(carol);
        vm.expectRevert("Unknown code");
        drops.claim(id, fake);
    }

    // ───────────────────────────── allowlist ─────────────────────────────

    function test_Allowlist() public {
        BaseDrops.CreateParams memory p = _params();
        p.linkSigner = address(0);
        p.allowlistRoot = _hashPair(_leaf(alice), _leaf(bob));
        uint256 id = _create(p);

        BaseDrops.ClaimArgs memory a;
        a.allowlistProof = new bytes32[](1);
        a.allowlistProof[0] = _leaf(bob);
        _claim(id, alice, a);
        assertEq(alice.balance, 1 ether);

        vm.prank(carol);
        vm.expectRevert("Not on allowlist");
        drops.claim(id, a);
    }

    // ───────────────────────────── tickets (verified tasks) ─────────────────────────────

    function _ticketDrop() internal returns (uint256 id) {
        BaseDrops.CreateParams memory p = _params();
        p.linkSigner = address(0);
        p.ticketSigner = vm.addr(TICKET_PK);
        p.maxClaimsPerWallet = 0;
        p.maxAmountPerClaim = 3 ether;
        id = _create(p);
    }

    function _ticket(uint256 id, address who, uint32 claimIndex, uint256 amount, uint64 deadline)
        internal
        view
        returns (BaseDrops.ClaimArgs memory a)
    {
        a.amount = amount;
        a.deadline = deadline;
        a.ticket = _sign(TICKET_PK, drops.ticketDigest(id, who, claimIndex, amount, deadline));
    }

    function test_Ticket_PaysChosenAmountAndCantBeReplayed() public {
        uint256 id = _ticketDrop();
        uint64 dl = uint64(block.timestamp + 10 minutes);
        BaseDrops.ClaimArgs memory t = _ticket(id, alice, 0, 2 ether, dl);
        _claim(id, alice, t);
        assertEq(alice.balance, 2 ether);

        // Same ticket again: the wallet's claim number moved on, so it no longer matches.
        vm.prank(alice);
        vm.expectRevert("Invalid ticket");
        drops.claim(id, t);

        // Alice's ticket can't be used by Bob.
        BaseDrops.ClaimArgs memory forAlice = _ticket(id, alice, 1, 1 ether, dl);
        vm.prank(bob);
        vm.expectRevert("Invalid ticket");
        drops.claim(id, forAlice);

        // Zero amount = the default amount.
        _claim(id, alice, _ticket(id, alice, 1, 0, dl));
        assertEq(alice.balance, 3 ether);
    }

    function test_Ticket_BoundsAndExpiry() public {
        uint256 id = _ticketDrop();
        BaseDrops.ClaimArgs memory tooMuch = _ticket(id, alice, 0, 4 ether, uint64(block.timestamp + 60));
        vm.prank(alice);
        vm.expectRevert("Amount above max");
        drops.claim(id, tooMuch);

        BaseDrops.ClaimArgs memory longTtl = _ticket(id, alice, 0, 1 ether, uint64(block.timestamp + 2 hours));
        vm.prank(alice);
        vm.expectRevert("Ticket TTL too long");
        drops.claim(id, longTtl);

        BaseDrops.ClaimArgs memory old = _ticket(id, alice, 0, 1 ether, uint64(block.timestamp + 60));
        vm.warp(block.timestamp + 61);
        vm.prank(alice);
        vm.expectRevert("Ticket expired");
        drops.claim(id, old);
    }

    // ───────────────────────────── gate module ─────────────────────────────

    function test_Gate_TokenBalance() public {
        BaseDrops.CreateParams memory p = _params();
        p.gate = address(gate);
        p.gateConfig = abi.encode(address(token), uint256(100e18));
        uint256 id = _create(p);

        BaseDrops.ClaimArgs memory a = _linkArgs(id, alice);
        vm.prank(alice);
        vm.expectRevert("Gate check failed");
        drops.claim(id, a);

        token.mint(alice, 100e18);
        _claim(id, alice, a);
        assertEq(alice.balance, 1 ether);

        // Config is keyed by the calling drops contract, so nobody else can rewrite this drop's rule.
        vm.expectRevert("Already configured");
        vm.prank(address(drops));
        gate.configure(id, abi.encode(address(token), uint256(1)));
        (address t,,) = gate.rules(address(drops), id);
        assertEq(t, address(token));
    }

    // ───────────────────────────── token drops ─────────────────────────────

    function test_TokenDrop_ClaimAndClose() public {
        token.mint(creator, 10e18);
        BaseDrops.CreateParams memory p = _params();
        p.token = address(token);
        p.budget = 10e18;
        p.amountPerClaim = 1e18;
        vm.startPrank(creator);
        token.approve(address(drops), 10e18);
        uint256 id = drops.createDrop(p);
        vm.stopPrank();

        _claim(id, alice, _linkArgs(id, alice));
        assertEq(token.balanceOf(alice), 1e18);
        vm.prank(creator);
        drops.close(id);
        assertEq(token.balanceOf(creator), 9e18);
        assertEq(token.balanceOf(address(drops)), 0);
    }

    // ───────────────────────────── close / commit / pause ─────────────────────────────

    function test_Close_RefundsAndStopsClaims() public {
        uint256 id = _create(_params());
        _claim(id, alice, _linkArgs(id, alice));
        uint256 before = creator.balance;
        vm.prank(creator);
        drops.close(id);
        assertEq(creator.balance - before, 9 ether);

        BaseDrops.ClaimArgs memory b = _linkArgs(id, bob);
        vm.prank(bob);
        vm.expectRevert("Drop closed");
        drops.claim(id, b);
        vm.prank(creator);
        vm.expectRevert("Already closed");
        drops.close(id);
    }

    function test_Committed_LockedUntilExpiry() public {
        BaseDrops.CreateParams memory p = _params();
        p.committed = true;
        uint256 id = _create(p);

        vm.startPrank(creator);
        vm.expectRevert("Committed until expiry");
        drops.close(id);
        vm.expectRevert("Committed drop");
        drops.setPaused(id, true);
        vm.expectRevert("Committed drop");
        drops.setTicketSigner(id, vm.addr(TICKET_PK));
        vm.stopPrank();

        vm.warp(p.expiresAt);
        vm.prank(creator);
        drops.close(id);
        assertEq(address(drops).balance, 0);
    }

    function test_Pause_BlocksClaims() public {
        uint256 id = _create(_params());
        vm.prank(creator);
        drops.setPaused(id, true);
        BaseDrops.ClaimArgs memory a = _linkArgs(id, alice);
        vm.prank(alice);
        vm.expectRevert("Drop paused");
        drops.claim(id, a);
        vm.prank(creator);
        drops.setPaused(id, false);
        _claim(id, alice, a);
    }

    // ───────────────────────────── recovery ─────────────────────────────

    function test_Recovery_RotateLinkKey() public {
        uint256 id = _create(_params());
        BaseDrops.ClaimArgs memory oldLink = _linkArgs(id, alice);

        uint256 newPk = 0xFEED;
        vm.prank(creator);
        drops.rotateLinkSigner(id, vm.addr(newPk));

        vm.prank(alice);
        vm.expectRevert("Invalid link");
        drops.claim(id, oldLink);

        BaseDrops.ClaimArgs memory fresh;
        fresh.linkSig = _sign(newPk, drops.linkDigest(id, alice));
        _claim(id, alice, fresh);
        assertEq(alice.balance, 1 ether);
    }

    function test_Recovery_ManagerCanRotateButNeverWithdraw() public {
        uint256 id = _create(_params());
        vm.prank(creator);
        drops.setManager(id, manager, true);

        vm.prank(manager);
        drops.rotateLinkSigner(id, vm.addr(0xFEED));
        vm.prank(manager);
        drops.setPaused(id, true);

        vm.startPrank(manager);
        vm.expectRevert("Only creator");
        drops.close(id);
        vm.expectRevert("Only creator");
        drops.transferCreator(id, manager);
        vm.expectRevert("Only creator");
        drops.setRecovery(id, manager);
        vm.stopPrank();
    }

    function test_Recovery_TwoStepTransfer() public {
        uint256 id = _create(_params());
        address newWallet = makeAddr("newWallet");
        vm.prank(creator);
        drops.transferCreator(id, newWallet);

        vm.prank(bob);
        vm.expectRevert("Not the pending creator");
        drops.acceptCreator(id);

        vm.prank(newWallet);
        drops.acceptCreator(id);
        vm.prank(creator);
        vm.expectRevert("Only creator");
        drops.close(id);

        vm.prank(newWallet);
        drops.close(id);
        assertEq(newWallet.balance, 10 ether);
    }

    function test_Recovery_LostWalletAfterExpiryDelay() public {
        BaseDrops.CreateParams memory p = _params();
        p.recovery = rescuer;
        uint256 id = _create(p);

        vm.prank(rescuer);
        vm.expectRevert("Recovery not open yet");
        drops.recoverCreator(id);

        vm.warp(uint256(p.expiresAt) + drops.RECOVERY_DELAY() - 1);
        vm.prank(rescuer);
        vm.expectRevert("Recovery not open yet");
        drops.recoverCreator(id);

        vm.warp(uint256(p.expiresAt) + drops.RECOVERY_DELAY());
        vm.prank(bob);
        vm.expectRevert("Not the recovery address");
        drops.recoverCreator(id);

        vm.prank(rescuer);
        drops.recoverCreator(id);
        vm.prank(rescuer);
        drops.close(id);
        assertEq(rescuer.balance, 10 ether);
    }

    function test_ExtendExpiryOnly() public {
        BaseDrops.CreateParams memory p = _params();
        uint256 id = _create(p);
        vm.startPrank(creator);
        vm.expectRevert("Must be later");
        drops.extendExpiry(id, p.expiresAt - 1);
        drops.extendExpiry(id, p.expiresAt + 1 days);
        vm.stopPrank();
    }

    function test_TopUp() public {
        uint256 id = _create(_params());
        vm.prank(creator);
        drops.setManager(id, manager, true);
        vm.deal(manager, 5 ether);
        vm.prank(manager);
        drops.topUp{value: 5 ether}(id, 5 ether);
        (BaseDrops.Drop memory d,,) = drops.getDrop(id);
        assertEq(d.budget, 15 ether);

        vm.deal(bob, 1 ether);
        vm.prank(bob);
        vm.expectRevert("Only creator or manager");
        drops.topUp{value: 1 ether}(id, 1 ether);
    }

    // ───────────────────────────── attacks ─────────────────────────────

    function test_Reentrancy_Blocked() public {
        BaseDrops.CreateParams memory p = _params();
        p.maxClaimsPerWallet = 0;
        uint256 id = _create(p);
        ReenteringClaimer attacker = new ReenteringClaimer(drops);
        BaseDrops.ClaimArgs memory a = _linkArgs(id, address(attacker));
        vm.expectRevert("ETH transfer failed");
        attacker.go(id, a);
        assertEq(address(drops).balance, 10 ether);
    }

    // ───────────────────────────── fuzz ─────────────────────────────

    /// Over any sequence of claim attempts and waits, a wallet never exceeds its claim limit,
    /// never claims inside its cooldown, and the escrow always equals the remaining budget.
    function testFuzz_LimitsAndAccounting(uint8 attempts, uint32 seed) public {
        BaseDrops.CreateParams memory p = _params();
        p.budget = 1_000 ether;
        p.amountPerClaim = 1 ether;
        p.maxClaimsPerWallet = 5;
        p.cooldown = 6 hours;
        p.expiresAt = uint64(block.timestamp + 365 days);
        uint256 id = _create(p);

        uint256 lastClaimAt;
        uint32 claims;
        for (uint256 i = 0; i < uint256(attempts) % 40; i++) {
            vm.warp(block.timestamp + (uint256(keccak256(abi.encode(seed, i))) % 10 hours));
            BaseDrops.ClaimArgs memory a = _linkArgs(id, alice);
            vm.prank(alice);
            try drops.claim(id, a) {
                assertTrue(claims == 0 || block.timestamp >= lastClaimAt + 6 hours, "claimed inside cooldown");
                claims++;
                lastClaimAt = block.timestamp;
            } catch {}
            assertLe(claims, 5, "over per-wallet limit");
        }
        (BaseDrops.Drop memory d,,) = drops.getDrop(id);
        assertEq(address(drops).balance, d.budget, "escrow != budget");
        assertEq(alice.balance, uint256(claims) * 1 ether);
    }
}
