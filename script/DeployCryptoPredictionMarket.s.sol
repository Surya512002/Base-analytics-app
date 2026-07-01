// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import {Script, console2} from "forge-std/Script.sol";
import {CryptoPredictionMarket} from "../contracts/CryptoPredictionMarket.sol";

/// @notice Deploy with treasury 0xB4BD7D410543cB27f42c562ab3fF5DC12fBDd42F and 1.5% protocol fee.
contract DeployCryptoPredictionMarket is Script {
    address constant TREASURY = 0xB4BD7D410543cB27f42c562ab3fF5DC12fBDd42F;
    uint16 constant PROTOCOL_FEE_BPS = 150;

    function run() external returns (address deployed) {
        vm.startBroadcast();

        CryptoPredictionMarket market = new CryptoPredictionMarket(TREASURY, PROTOCOL_FEE_BPS);
        deployed = address(market);

        console2.log("CryptoPredictionMarket deployed at:", deployed);
        console2.log("Treasury:", TREASURY);
        console2.log("Protocol fee bps:", PROTOCOL_FEE_BPS);

        vm.stopBroadcast();
    }
}
