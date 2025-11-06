// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
import "@openzeppelin/contracts/access/Ownable.sol";
import "./ShariaCompliance.sol";
import "./interfaces/IDEXRouter.sol";
import "./testnet/SimpleFactory.sol";
import "./libraries/SwapPathBuilder.sol";

/**
 * @title ShariaSwap
 * @notice Sharia-compliant token swapping with custom AMM
 * @dev Uses SimpleRouter (Uniswap V2-style) on Moonbase Alpha testnet
 */
contract ShariaSwap is Ownable, ReentrancyGuard {
    using SafeERC20 for IERC20;

    // ============================================================================
    // STATE VARIABLES
    // ============================================================================

    /// @notice Reference to Sharia compliance contract
    ShariaCompliance public immutable shariaCompliance;

    /// @notice DEX router for swaps (SimpleRouter)
    IDEXRouter public dexRouter;

    /// @notice Factory for checking pair existence
    SimpleFactory public immutable factory;

    /// @notice WETH (Wrapped DEV) address on Moonbase Alpha
    address public immutable WETH;

    /// @notice Swap history per user
    mapping(address => SwapRecord[]) public userSwapHistory;

    // ============================================================================
    // STRUCTS
    // ============================================================================

    struct SwapRecord {
        address tokenIn;
        address tokenOut;
        uint256 amountIn;
        uint256 amountOut;
        uint256 timestamp;
        string tokenInSymbol;
        string tokenOutSymbol;
    }

    // ============================================================================
    // EVENTS
    // ============================================================================

    event SwapExecuted(
        address indexed user,
        address indexed tokenIn,
        address indexed tokenOut,
        uint256 amountIn,
        uint256 amountOut,
        string tokenOutSymbol
    );

    event AssetRegistered(
        address indexed tokenAddress,
        string symbol
    );

    event DexRouterUpdated(
        address indexed oldRouter,
        address indexed newRouter
    );

    // ============================================================================
    // ERRORS
    // ============================================================================

    error InsufficientBalance();
    error SlippageExceeded();
    error InvalidAmount();
    error InvalidPath();
    error SwapFailed();
    error AssetNotRegistered();

    // ============================================================================
    // CONSTRUCTOR
    // ============================================================================

    /**
     * @notice Initialize the ShariaSwap contract
     * @param _shariaCompliance Address of ShariaCompliance contract
     * @param _dexRouter Address of DEX router (SimpleRouter)
     * @param _weth Address of WETH token (Wrapped DEV)
     * @param _factory Address of SimpleFactory for pair lookups
     */
    constructor(
        address _shariaCompliance,
        address _dexRouter,
        address _weth,
        address _factory
    ) Ownable(msg.sender) {
        shariaCompliance = ShariaCompliance(_shariaCompliance);
        dexRouter = IDEXRouter(_dexRouter);
        WETH = _weth;
        factory = SimpleFactory(_factory);
    }

    // ============================================================================
    // ADMIN FUNCTIONS
    // ============================================================================

    /**
     * @notice Update DEX router address
     * @param _newRouter New router address
     */
    function updateDexRouter(address _newRouter) external onlyOwner {
        address oldRouter = address(dexRouter);
        dexRouter = IDEXRouter(_newRouter);
        emit DexRouterUpdated(oldRouter, _newRouter);
    }

    // ============================================================================
    // SWAP FUNCTIONS
    // ============================================================================

    /**
     * @notice Execute a Sharia-compliant swap
     * @param tokenIn Input token address
     * @param tokenOut Output token address
     * @param amountIn Amount of input tokens
     * @param minAmountOut Minimum output amount (slippage protection)
     * @param deadline Transaction deadline
     * @return amountOut Actual output amount received
     */
    function swapShariaCompliant(
        address tokenIn,
        address tokenOut,
        uint256 amountIn,
        uint256 minAmountOut,
        uint256 deadline
    ) external nonReentrant returns (uint256 amountOut) {
        if (amountIn == 0) revert InvalidAmount();

        // Get symbol from ShariaCompliance (instead of assetSymbols mapping)
        string memory tokenOutSymbol = shariaCompliance.getSymbolByAddress(tokenOut);
        if (bytes(tokenOutSymbol).length == 0) revert AssetNotRegistered();
        
        shariaCompliance.requireShariaCompliant(tokenOutSymbol);

        // Transfer tokens from user
        IERC20(tokenIn).safeTransferFrom(msg.sender, address(this), amountIn);

        // Approve router if needed
        IERC20(tokenIn).forceApprove(address(dexRouter), amountIn);

        // Build swap path (auto-routes through USDC if no direct pair)
        address[] memory path = _buildSwapPath(tokenIn, tokenOut);

        // Execute swap
        uint256[] memory amounts;
        try dexRouter.swapExactTokensForTokens(
            amountIn,
            minAmountOut,
            path,
            msg.sender,
            deadline
        ) returns (uint256[] memory _amounts) {
            amounts = _amounts;
        } catch {
            revert SwapFailed();
        }

        amountOut = amounts[amounts.length - 1];

        if (amountOut < minAmountOut) {
            revert SlippageExceeded();
        }

        // Record swap
        _recordSwap(
            msg.sender,
            tokenIn,
            tokenOut,
            amountIn,
            amountOut,
            shariaCompliance.getSymbolByAddress(tokenIn),  // Get from contract
            tokenOutSymbol
        );

        emit SwapExecuted(
            msg.sender,
            tokenIn,
            tokenOut,
            amountIn,
            amountOut,
            tokenOutSymbol
        );

        return amountOut;
    }

    /**
     * @notice Swap native DEV for Sharia-compliant tokens
     * @param tokenOut Output token address
     * @param minAmountOut Minimum output amount
     * @param deadline Transaction deadline
     * @return amountOut Actual output amount received
     */
    function swapGLMRForToken(
        address tokenOut,
        uint256 minAmountOut,
        uint256 deadline
    ) external payable nonReentrant returns (uint256 amountOut) {
        if (msg.value == 0) revert InvalidAmount();

        // Get symbol from ShariaCompliance
        string memory tokenOutSymbol = shariaCompliance.getSymbolByAddress(tokenOut);
        if (bytes(tokenOutSymbol).length == 0) revert AssetNotRegistered();
        
        shariaCompliance.requireShariaCompliant(tokenOutSymbol);

        // Wrap DEV to WETH
        (bool success, ) = WETH.call{value: msg.value}("");
        if (!success) revert SwapFailed();

        // Approve router
        IERC20(WETH).forceApprove(address(dexRouter), msg.value);

        // Build swap path (auto-routes through USDC if no direct pair)
        address[] memory path = _buildSwapPath(WETH, tokenOut);

        // Execute swap
        uint256[] memory amounts;
        try dexRouter.swapExactTokensForTokens(
            msg.value,
            minAmountOut,
            path,
            msg.sender,
            deadline
        ) returns (uint256[] memory _amounts) {
            amounts = _amounts;
        } catch {
            revert SwapFailed();
        }

        amountOut = amounts[amounts.length - 1];

        // Record swap
        _recordSwap(
            msg.sender,
            WETH,
            tokenOut,
            msg.value,
            amountOut,
            "DEV",
            tokenOutSymbol
        );

        emit SwapExecuted(
            msg.sender,
            WETH,
            tokenOut,
            msg.value,
            amountOut,
            tokenOutSymbol
        );

        return amountOut;
    }

    // ============================================================================
    // VIEW FUNCTIONS
    // ============================================================================

    /**
     * @notice Get quote for a swap
     * @param tokenIn Input token
     * @param tokenOut Output token
     * @param amountIn Input amount
     * @return amountOut Expected output amount
     */
    function getSwapQuote(
        address tokenIn,
        address tokenOut,
        uint256 amountIn
    ) external view returns (uint256 amountOut) {
        // Build swap path (auto-routes through USDC if no direct pair)
        address[] memory path = _buildSwapPath(tokenIn, tokenOut);

        uint256[] memory amounts = dexRouter.getAmountsOut(amountIn, path);
        return amounts[amounts.length - 1];
    }

    /**
     * @notice Get user's swap history
     * @param user User address
     * @return Array of swap records
     */
    function getUserSwapHistory(address user) external view returns (SwapRecord[] memory) {
        return userSwapHistory[user];
    }

    /**
     * @notice Get user's swap count
     * @param user User address
     * @return count Number of swaps
     */
    function getUserSwapCount(address user) external view returns (uint256) {
        return userSwapHistory[user].length;
    }

    // ============================================================================
    // INTERNAL FUNCTIONS
    // ============================================================================

    /**
     * @notice Build optimal swap path (direct or through USDC)
     * @param tokenIn Input token address
     * @param tokenOut Output token address
     * @return path Array of token addresses for the swap
     */
    function _buildSwapPath(address tokenIn, address tokenOut) internal view returns (address[] memory path) {
        // Get USDC address from ShariaCompliance
        address usdc = shariaCompliance.getTokenAddress("USDC");
        
        // Use library to build path
        return SwapPathBuilder.buildSwapPath(address(factory), tokenIn, tokenOut, usdc);
    }

    /**
     * @notice Record swap in history
     */
    function _recordSwap(
        address user,
        address tokenIn,
        address tokenOut,
        uint256 amountIn,
        uint256 amountOut,
        string memory tokenInSymbol,
        string memory tokenOutSymbol
    ) private {
        userSwapHistory[user].push(SwapRecord({
            tokenIn: tokenIn,
            tokenOut: tokenOut,
            amountIn: amountIn,
            amountOut: amountOut,
            timestamp: block.timestamp,
            tokenInSymbol: tokenInSymbol,
            tokenOutSymbol: tokenOutSymbol
        }));
    }

    // ============================================================================
    // EMERGENCY FUNCTIONS
    // ============================================================================

    /**
     * @notice Rescue stuck tokens (emergency only)
     * @param token Token address
     * @param amount Amount to rescue
     */
    function rescueTokens(address token, uint256 amount) external onlyOwner {
        IERC20(token).safeTransfer(owner(), amount);
    }

    /**
     * @notice Receive function for WETH wrapping
     */
    receive() external payable {}
}

