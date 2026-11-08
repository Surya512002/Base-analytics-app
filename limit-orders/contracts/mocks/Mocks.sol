// SPDX-License-Identifier: MIT
pragma solidity 0.8.24;

import {ERC20} from "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {ISwapAdapter} from "../LimitOrderBook.sol";

contract MockERC20 is ERC20 {
    uint8 private immutable _dec;

    constructor(string memory n, string memory s, uint8 d) ERC20(n, s) {
        _dec = d;
    }

    function decimals() public view override returns (uint8) {
        return _dec;
    }

    function mint(address to, uint256 amt) external {
        _mint(to, amt);
    }
}

contract MockFeed {
    uint8 public decimals = 8;
    int256 public answer;
    uint256 public updatedAt;

    constructor(int256 a) {
        answer = a;
        updatedAt = block.timestamp;
    }

    function setAnswer(int256 a) external {
        answer = a;
        updatedAt = block.timestamp;
    }

    function setAnswerStale(int256 a, uint256 ts) external {
        answer = a;
        updatedAt = ts;
    }

    function latestRoundData() external view returns (uint80, int256, uint256, uint256, uint80) {
        return (1, answer, updatedAt, updatedAt, 1);
    }
}

/// @dev Pre-funded adapter with a configurable rate: out = in * num / den.
contract MockAdapter is ISwapAdapter {
    mapping(address => mapping(address => uint256)) public num;
    mapping(address => mapping(address => uint256)) public den;

    function setRate(address tIn, address tOut, uint256 n, uint256 d) external {
        num[tIn][tOut] = n;
        den[tIn][tOut] = d;
    }

    function swap(address tokenIn, address tokenOut, uint256 amountIn, uint256 minAmountOut)
        external
        returns (uint256 amountOut)
    {
        IERC20(tokenIn).transferFrom(msg.sender, address(this), amountIn);
        amountOut = (amountIn * num[tokenIn][tokenOut]) / den[tokenIn][tokenOut];
        require(amountOut >= minAmountOut, "Too little received");
        IERC20(tokenOut).transfer(msg.sender, amountOut);
    }
}

/// @dev Stand-in for Uniswap SwapRouter02 to test the adapter plumbing.
contract MockRouter02 {
    struct ExactInputSingleParams {
        address tokenIn;
        address tokenOut;
        uint24 fee;
        address recipient;
        uint256 amountIn;
        uint256 amountOutMinimum;
        uint160 sqrtPriceLimitX96;
    }

    uint256 public num;
    uint256 public den = 1;

    function setRate(uint256 n, uint256 d) external {
        num = n;
        den = d;
    }

    function exactInputSingle(ExactInputSingleParams calldata p) external payable returns (uint256 out) {
        IERC20(p.tokenIn).transferFrom(msg.sender, address(this), p.amountIn);
        out = (p.amountIn * num) / den;
        require(out >= p.amountOutMinimum, "Too little received");
        IERC20(p.tokenOut).transfer(p.recipient, out);
    }
}

/// @dev Adapter that IGNORES minAmountOut, to test the order book's own oracle-bound check as a second layer.
contract MockLooseAdapter is ISwapAdapter {
    uint256 public num;
    uint256 public den = 1;

    function setRate(uint256 n, uint256 d) external {
        num = n;
        den = d;
    }

    function swap(address tokenIn, address tokenOut, uint256 amountIn, uint256) external returns (uint256 amountOut) {
        IERC20(tokenIn).transferFrom(msg.sender, address(this), amountIn);
        amountOut = (amountIn * num) / den;
        IERC20(tokenOut).transfer(msg.sender, amountOut);
    }
}
