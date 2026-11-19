// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import {IClaimGate} from "./IClaimGate.sol";

interface IBalanceOf {
    function balanceOf(address account) external view returns (uint256);
}

/// @title TokenBalanceGate — "hold at least X of token T" (ERC-20, ERC-721, ERC-4626 shares,
///        tokenized stocks: anything with balanceOf(address)).
/// @notice The balance is read inside the claim transaction, so it can't be faked with an
///         earlier snapshot. Holding through a flash loan for one tx is still possible; drops
///         that need "held since" use the app's verified ticket instead.
contract TokenBalanceGate is IClaimGate {
    struct Rule {
        address token;
        uint256 minBalance;
        bool set;
    }

    /// drops contract => dropId => rule
    mapping(address => mapping(uint256 => Rule)) public rules;

    event GateConfigured(address indexed drops, uint256 indexed dropId, address token, uint256 minBalance);

    /// @param config abi.encode(address token, uint256 minBalance)
    function configure(uint256 dropId, bytes calldata config) external {
        Rule storage r = rules[msg.sender][dropId];
        require(!r.set, "Already configured");
        (address token, uint256 minBalance) = abi.decode(config, (address, uint256));
        require(token.code.length > 0, "Token has no code");
        require(minBalance > 0, "Min balance is zero");
        rules[msg.sender][dropId] = Rule({token: token, minBalance: minBalance, set: true});
        emit GateConfigured(msg.sender, dropId, token, minBalance);
    }

    function check(uint256 dropId, address claimer, bytes calldata) external view returns (bool) {
        Rule storage r = rules[msg.sender][dropId];
        if (!r.set) return false;
        try IBalanceOf(r.token).balanceOf(claimer) returns (uint256 bal) {
            return bal >= r.minBalance;
        } catch {
            return false;
        }
    }
}
