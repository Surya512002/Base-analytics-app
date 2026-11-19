// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "forge-std/Test.sol";
import {BaseDrops} from "../contracts/drops/BaseDrops.sol";

/// Cross-language check: the link signature, one-time code proof + signature, and allowlist
/// proof below were produced by the app's TypeScript (lib/drops/client.ts + lib/drops/merkle.ts)
/// for this contract address, drop id, claimer and chain. The real contract must accept them.
/// If either side's encoding changes, this test fails.
contract BaseDropsAppFixtureTest is Test {
    address constant DROPS_AT = 0x00000000000000000000000000000000000D7095;
    address constant CLAIMER = 0x00000000000000000000000000000000000A11cE;
    BaseDrops drops;
    address creator = makeAddr("creator");

    function setUp() public {
        vm.chainId(8453);
        vm.warp(1_700_000_000);
        deployCodeTo("BaseDrops.sol:BaseDrops", DROPS_AT);
        drops = BaseDrops(DROPS_AT);
        vm.deal(creator, 10 ether);
    }

    function _params() internal view returns (BaseDrops.CreateParams memory p) {
        p.budget = 1 ether;
        p.amountPerClaim = 1 ether;
        p.maxClaimsPerWallet = 1;
        p.expiresAt = uint64(block.timestamp + 30 days);
    }

    function _create(BaseDrops.CreateParams memory p) internal returns (uint256 id) {
        vm.prank(creator);
        id = drops.createDrop{value: p.budget}(p);
        assertEq(id, 2_000_000_001, "fixture was generated for the first drop id");
    }

    function test_AppLinkSignatureIsAccepted() public {
        BaseDrops.CreateParams memory p = _params();
        p.linkSigner = 0x7564105E977516C53bE337314c7E53838967bDaC;
        uint256 id = _create(p);
        BaseDrops.ClaimArgs memory a;
        a.linkSig =
            hex"cfbb138f87071becaa09741ca8392768a7f16705a5af57022dc85e2082464e5703ce76de0c9421be71576c92c1134ef34b8d3e3b9d71a466e9c6a7353b2139e41b";
        vm.prank(CLAIMER);
        drops.claim(id, a);
        assertEq(CLAIMER.balance, 1 ether);
    }

    function test_AppCodeProofAndSignatureAreAccepted() public {
        BaseDrops.CreateParams memory p = _params();
        p.codesRoot = bytes32(hex"ed18d78f905557cbca215f63e57a83cd04074db60292bc76c496e0adfdb7ffae");
        uint256 id = _create(p);
        BaseDrops.ClaimArgs memory a;
        a.code = 0x1563915e194D8CfBA1943570603F7606A3115508;
        a.codeProof = new bytes32[](1);
        a.codeProof[0] = bytes32(hex"75b26f2455f55b18ea5b8767fb050676d40cb46ff8f33d32b37c4d9e6055ada7");
        a.codeSig =
            hex"2fbe0e5a42138ab04e328f9988da3cc2ace6995b2670ab635e2516408a222536068a0edd5397d930ad4bdf40b8be72ec9a2a502ab1e3151582e4676d87f0f1fa1b";
        vm.prank(CLAIMER);
        drops.claim(id, a);
        assertEq(CLAIMER.balance, 1 ether);
        assertTrue(drops.codeUsed(id, a.code));
    }

    function test_AppAllowlistProofIsAccepted() public {
        BaseDrops.CreateParams memory p = _params();
        p.allowlistRoot = bytes32(hex"d8ce7c85d2c9070feec92db137cac130511169c4c75e681a6d50a73dcea83816");
        uint256 id = _create(p);
        BaseDrops.ClaimArgs memory a;
        a.allowlistProof = new bytes32[](2);
        a.allowlistProof[0] = bytes32(hex"1784b0769865baa1afd22d0bc055ff4f3917c73c7d217adece4f4f112ffd9007");
        a.allowlistProof[1] = bytes32(hex"7740b371745000923b2b7cb0f43a638c71ba9d6a6f760f879e55fb1f075a434c");
        vm.prank(CLAIMER);
        drops.claim(id, a);
        assertEq(CLAIMER.balance, 1 ether);
    }
}
