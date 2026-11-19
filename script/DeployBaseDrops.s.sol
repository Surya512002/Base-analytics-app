// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import {Script, console2} from "forge-std/Script.sol";
import {BaseDrops} from "../contracts/drops/BaseDrops.sol";
import {TokenBalanceGate} from "../contracts/drops/TokenBalanceGate.sol";

/// Deploys BaseDrops and the TokenBalanceGate module.
///
/// Base Sepolia first (chain 84532):
///   forge script script/DeployBaseDrops.s.sol --rpc-url https://sepolia.base.org \
///     --account <your-keystore-account> --broadcast --verify
///
/// Then run the Sepolia checklist in docs/DROPS_DESIGN.md (§9) before mainnet.
/// The script refuses mainnet unless ALLOW_MAINNET=true is set.
contract DeployBaseDrops is Script {
    function run() external returns (address drops, address gate) {
        if (block.chainid == 8453) {
            require(vm.envOr("ALLOW_MAINNET", false), "Mainnet: set ALLOW_MAINNET=true after the Sepolia run");
        }
        vm.startBroadcast();
        drops = address(new BaseDrops());
        gate = address(new TokenBalanceGate());
        vm.stopBroadcast();

        console2.log("Chain id:", block.chainid);
        console2.log("BaseDrops:", drops);
        console2.log("TokenBalanceGate:", gate);
        console2.log("Set NEXT_PUBLIC_DROPS_CONTRACT and NEXT_PUBLIC_DROPS_TOKEN_GATE to these addresses.");
    }
}
