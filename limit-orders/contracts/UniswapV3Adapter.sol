// SPDX-License-Identifier: MIT
pragma solidity 0.8.24;

import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {SafeERC20} from "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import {Ownable} from "@openzeppelin/contracts/access/Ownable.sol";
import {Ownable2Step} from "@openzeppelin/contracts/access/Ownable2Step.sol";
import {ISwapAdapter} from "./LimitOrderBook.sol";

/// @dev Uniswap V3 SwapRouter02 (no deadline field in params).
interface ISwapRouter02 {
    struct ExactInputSingleParams {
        address tokenIn;
        address tokenOut;
        uint24 fee;
        address recipient;
        uint256 amountIn;
        uint256 amountOutMinimum;
        uint160 sqrtPriceLimitX96;
    }

    function exactInputSingle(ExactInputSingleParams calldata params) external payable returns (uint256 amountOut);
}

/// @notice Swap adapter for LimitOrderBook that routes through a single Uniswap V3 pool per token pair.
///         Only the order book can call `swap`. Write an Aerodrome adapter with the same interface if your
///         tokenized-stock liquidity lives there.
contract UniswapV3Adapter is ISwapAdapter, Ownable2Step {
    using SafeERC20 for IERC20;

    address public immutable orderBook;
    ISwapRouter02 public immutable router;
    mapping(bytes32 pairKey => uint24 fee) public poolFee;

    error OnlyOrderBook();
    error NoPool();

    event PoolFeeSet(address indexed tokenA, address indexed tokenB, uint24 fee);

    constructor(address orderBook_, address router_, address owner_) Ownable(owner_) {
        orderBook = orderBook_;
        router = ISwapRouter02(router_);
    }

    function setPoolFee(address tokenA, address tokenB, uint24 fee) external onlyOwner {
        poolFee[_key(tokenA, tokenB)] = fee;
        emit PoolFeeSet(tokenA, tokenB, fee);
    }

    function swap(address tokenIn, address tokenOut, uint256 amountIn, uint256 minAmountOut)
        external
        returns (uint256 amountOut)
    {
        if (msg.sender != orderBook) revert OnlyOrderBook();
        uint24 fee = poolFee[_key(tokenIn, tokenOut)];
        if (fee == 0) revert NoPool();

        IERC20(tokenIn).safeTransferFrom(msg.sender, address(this), amountIn);
        IERC20(tokenIn).forceApprove(address(router), amountIn);
        amountOut = router.exactInputSingle(
            ISwapRouter02.ExactInputSingleParams({
                tokenIn: tokenIn,
                tokenOut: tokenOut,
                fee: fee,
                recipient: msg.sender,
                amountIn: amountIn,
                amountOutMinimum: minAmountOut,
                sqrtPriceLimitX96: 0
            })
        );
        IERC20(tokenIn).forceApprove(address(router), 0);
    }

    function _key(address a, address b) private pure returns (bytes32) {
        return a < b ? keccak256(abi.encode(a, b)) : keccak256(abi.encode(b, a));
    }
}
