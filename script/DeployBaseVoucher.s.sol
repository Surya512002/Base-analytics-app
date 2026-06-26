// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import {Script, console2} from "forge-std/Script.sol";
import {BaseVoucher} from "../contracts/BaseVoucher.sol";

contract DeployBaseVoucher is Script {
    function run() external returns (address deployed) {
        vm.startBroadcast();

        BaseVoucher voucher = new BaseVoucher();
        deployed = address(voucher);

        console2.log("BaseVoucher deployed at:", deployed);

        vm.stopBroadcast();
    }
}
