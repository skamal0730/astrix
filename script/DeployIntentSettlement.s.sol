// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {Script} from "forge-std/Script.sol";
import {IntentSettlement} from "../contracts/IntentSettlement.sol";

contract DeployIntentSettlement is Script {
    function run() external returns (IntentSettlement settlement) {
        address router = vm.envAddress("ROUTER_ADDRESS");
        address whbar = vm.envAddress("WHBAR_TOKEN");
        address usdc = vm.envAddress("USDC_TOKEN");
        uint24 fee = uint24(vm.envUint("POOL_FEE"));

        vm.startBroadcast();
        settlement = new IntentSettlement(router, whbar, usdc, fee);
        vm.stopBroadcast();
    }
}
