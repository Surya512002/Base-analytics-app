// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import {Script, console2} from "forge-std/Script.sol";
import {XpStake} from "../contracts/XpStake.sol";
import {BadgeMarketplace} from "../contracts/BadgeMarketplace.sol";

/// @notice Deploy XpStake + BadgeMarketplace to Base mainnet.
contract DeployStakeMarket is Script {
    address constant ACHIEVEMENTS = 0xadb8120B4B18b892cFAD171243074487122Dea03;

    function run() external returns (address xpStake, address badgeMarket) {
        vm.startBroadcast();

        XpStake stake = new XpStake();
        xpStake = address(stake);
        console2.log("XpStake deployed at:", xpStake);

        BadgeMarketplace market = new BadgeMarketplace(ACHIEVEMENTS);
        badgeMarket = address(market);
        console2.log("BadgeMarketplace deployed at:", badgeMarket);

        vm.stopBroadcast();
    }
}
