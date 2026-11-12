// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import {Script, console2} from "forge-std/Script.sol";
import {BaseVoucherCampaign} from "../contracts/BaseVoucherCampaign.sol";

/// forge script script/DeployBaseVoucherCampaign.s.sol --rpc-url base_sepolia --broadcast --verify
/// Deploy to Base Sepolia first, run a real 3-wallet claim, then mainnet.
contract DeployBaseVoucherCampaign is Script {
    function run() external returns (address deployed) {
        vm.startBroadcast();
        BaseVoucherCampaign campaign = new BaseVoucherCampaign();
        deployed = address(campaign);
        console2.log("BaseVoucherCampaign deployed at:", deployed);
        vm.stopBroadcast();
    }
}
