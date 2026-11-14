// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

/// @title SimQuoter
/// @notice Read-only price quoter for Uniswap-v3-style pools (incl. Aerodrome Slipstream).
///         It is NEVER deployed: the app injects this runtime code at a throwaway address inside
///         an eth_call (state override) and asks it for a quote. `quote` starts a real swap on the
///         pool, the pool calls back `uniswapV3SwapCallback`, which reverts with the exact
///         amounts — so nothing ever executes, no funds move, and the result is the pool's own math.
interface ICLPool {
    function swap(
        address recipient,
        bool zeroForOne,
        int256 amountSpecified,
        uint160 sqrtPriceLimitX96,
        bytes calldata data
    ) external returns (int256 amount0, int256 amount1);
}

contract SimQuoter {
    uint160 internal constant MIN_SQRT_RATIO_PLUS_ONE = 4295128740;
    uint160 internal constant MAX_SQRT_RATIO_MINUS_ONE = 1461446703485210103287273052203988822378723970341;

    /// @return amountOut tokens the pool would pay for `amountIn` (exact-input swap).
    function quote(address pool, bool zeroForOne, uint256 amountIn) external returns (uint256 amountOut) {
        try
            ICLPool(pool).swap(
                address(this),
                zeroForOne,
                int256(amountIn),
                zeroForOne ? MIN_SQRT_RATIO_PLUS_ONE : MAX_SQRT_RATIO_MINUS_ONE,
                ""
            )
        {
            revert("unexpected");
        } catch (bytes memory reason) {
            if (reason.length != 64) {
                assembly {
                    revert(add(reason, 32), mload(reason))
                }
            }
            (int256 a0, int256 a1) = abi.decode(reason, (int256, int256));
            amountOut = uint256(-(zeroForOne ? a1 : a0));
        }
    }

    function uniswapV3SwapCallback(int256 amount0Delta, int256 amount1Delta, bytes calldata) external pure {
        assembly {
            let ptr := mload(0x40)
            mstore(ptr, amount0Delta)
            mstore(add(ptr, 32), amount1Delta)
            revert(ptr, 64)
        }
    }
}
