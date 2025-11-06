// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "../testnet/SimpleFactory.sol";

/**
 * @title SwapPathBuilder
 * @notice Library for building optimal swap paths with automatic USDC routing
 * @dev Used by ShariaSwap and ShariaDCA to determine swap routes
 */
library SwapPathBuilder {
    /**
     * @notice Build optimal swap path (direct or through USDC)
     * @param factory SimpleFactory contract for checking pair existence
     * @param tokenIn Input token address
     * @param tokenOut Output token address
     * @param usdc USDC token address for routing
     * @return path Array of token addresses for the swap
     */
    function buildSwapPath(
        address factory,
        address tokenIn,
        address tokenOut,
        address usdc
    ) internal view returns (address[] memory path) {
        // If either token is USDC, use direct path
        if (tokenIn == usdc || tokenOut == usdc) {
            path = new address[](2);
            path[0] = tokenIn;
            path[1] = tokenOut;
            return path;
        }
        
        // Check if direct pair exists
        address directPair = SimpleFactory(factory).getPair(tokenIn, tokenOut);
        if (directPair != address(0)) {
            // Direct pair exists, use it
            path = new address[](2);
            path[0] = tokenIn;
            path[1] = tokenOut;
            return path;
        }
        
        // No direct pair, route through USDC
        path = new address[](3);
        path[0] = tokenIn;
        path[1] = usdc;
        path[2] = tokenOut;
        return path;
    }
}

