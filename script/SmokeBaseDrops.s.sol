// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import {Script, console2} from "forge-std/Script.sol";
import {BaseDrops} from "../contracts/drops/BaseDrops.sol";

/// Creates a tiny ETH link drop on a deployed BaseDrops and prints its claim link, so the app's
/// claim flow can be tried end to end. Testnet only.
///
///   DROPS=0x… APP_URL=https://<preview-deployment> \
///   forge script script/SmokeBaseDrops.s.sol --rpc-url base_sepolia --account <keystore> --broadcast
///
/// The link key is a throwaway gift-link secret generated here (it only unlocks this test drop).
contract SmokeBaseDrops is Script {
    function run() external returns (uint256 id, uint256 linkKey) {
        require(block.chainid != 8453, "Smoke drops are for testnets only");
        BaseDrops drops = BaseDrops(vm.envAddress("DROPS"));
        string memory appUrl = vm.envOr("APP_URL", string("http://localhost:3000"));
        uint256 perClaim = vm.envOr("PER_CLAIM_WEI", uint256(0.0001 ether));
        uint32 claims = uint32(vm.envOr("CLAIMS", uint256(2)));

        // secp256k1 order minus one bounds a valid private key.
        uint256 n = 0xFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFEBAAEDCE6AF48A03BBFD25E8CD0364141;
        linkKey = (uint256(keccak256(abi.encode(block.timestamp, block.prevrandao, msg.sender, address(drops)))) % (n - 1)) + 1;

        BaseDrops.CreateParams memory p;
        p.budget = perClaim * claims;
        p.amountPerClaim = uint128(perClaim);
        p.maxClaimsTotal = claims;
        p.maxClaimsPerWallet = 1;
        p.expiresAt = uint64(block.timestamp + 2 days);
        p.linkSigner = vm.addr(linkKey);
        p.message = "Sepolia smoke test";
        p.senderLabel = "smoke";

        vm.startBroadcast();
        id = drops.createDrop{value: p.budget}(p);
        vm.stopBroadcast();

        console2.log("Drop id:", id);
        console2.log("Claim link (open with a different wallet than the creator):");
        console2.log(string.concat(appUrl, "/drops/", vm.toString(id), "#k=", _hexNoPrefix(linkKey)));
    }

    function _hexNoPrefix(uint256 v) private pure returns (string memory) {
        bytes memory alphabet = "0123456789abcdef";
        bytes memory out = new bytes(64);
        for (uint256 i = 0; i < 32; i++) {
            uint8 b = uint8(v >> (8 * (31 - i)));
            out[2 * i] = alphabet[b >> 4];
            out[2 * i + 1] = alphabet[b & 0x0f];
        }
        return string(out);
    }
}
