// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
import "@openzeppelin/contracts/access/Ownable.sol";
import "./ShariaCompliance.sol";
import "./interfaces/IDEXRouter.sol";

/**
 * @title ShariaSwap
 * @notice Sharia-compliant token swapping using external DEX routing
 * @dev Users provide explicit swap paths (via a Uniswap V2-compatible router)
 */
contract ShariaSwap is Ownable, ReentrancyGuard {
    using SafeERC20 for IERC20;

    // ============================================================================
    // STATE VARIABLES
    // ============================================================================

    /// @notice Reference to Sharia compliance contract
    ShariaCompliance public immutable shariaCompliance;

    /// @notice DEX router for swaps (Uniswap V2 compatible)
    IDEXRouter public dexRouter;

    /// @notice WETH (Wrapped GLMR) address on Moonbeam
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
     * @param _dexRouter Address of Uniswap V2 compatible router
     * @param _weth Address of WETH token (Wrapped DEV)
     */
    constructor(
        address _shariaCompliance,
        address _dexRouter,
        address _weth
    ) Ownable(msg.sender) {
        shariaCompliance = ShariaCompliance(_shariaCompliance);
        dexRouter = IDEXRouter(_dexRouter);
        WETH = _weth;
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
     * @param path Swap path (first element = input token, last element = output token)
     * @param amountIn Amount of input tokens
     * @param minAmountOut Minimum output amount (slippage protection)
     * @param deadline Transaction deadline
     * @return amountOut Actual output amount received
     */
    function swapShariaCompliant(
        address[] calldata path,
        uint256 amountIn,
        uint256 minAmountOut,
        uint256 deadline
    ) external nonReentrant returns (uint256 amountOut) {
        if (amountIn == 0) revert InvalidAmount();
        if (path.length < 2) revert InvalidPath();

        address tokenIn = path[0];
        address tokenOut = path[path.length - 1];

        // Get symbol from ShariaCompliance (instead of assetSymbols mapping)
        string memory tokenOutSymbol = shariaCompliance.getSymbolByAddress(tokenOut);
        if (bytes(tokenOutSymbol).length == 0) revert AssetNotRegistered();
        
        shariaCompliance.requireShariaCompliant(tokenOutSymbol);

        // Transfer tokens from user
        IERC20(tokenIn).safeTransferFrom(msg.sender, address(this), amountIn);

        // Approve router if needed
        IERC20(tokenIn).forceApprove(address(dexRouter), amountIn);

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
     * @param path Swap path (must start with WETH and end with desired output token)
     * @param minAmountOut Minimum output amount
     * @param deadline Transaction deadline
     * @return amountOut Actual output amount received
     */
    function swapGLMRForToken(
        address[] calldata path,
        uint256 minAmountOut,
        uint256 deadline
    ) external payable nonReentrant returns (uint256 amountOut) {
        if (msg.value == 0) revert InvalidAmount();
        if (path.length < 2) revert InvalidPath();
        if (path[0] != WETH) revert InvalidPath();

        address tokenOut = path[path.length - 1];

        // Get symbol from ShariaCompliance
        string memory tokenOutSymbol = shariaCompliance.getSymbolByAddress(tokenOut);
        if (bytes(tokenOutSymbol).length == 0) revert AssetNotRegistered();
        
        shariaCompliance.requireShariaCompliant(tokenOutSymbol);

        // Wrap DEV to WETH
        (bool success, ) = WETH.call{value: msg.value}("");
        if (!success) revert SwapFailed();

        // Approve router
        IERC20(WETH).forceApprove(address(dexRouter), msg.value);

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
     * @param path Swap path (first element = input token, last element = output token)
     * @param amountIn Input amount
     * @return amountOut Expected output amount
     */
    function getSwapQuote(
        address[] calldata path,
        uint256 amountIn
    ) external view returns (uint256 amountOut) {
        if (path.length < 2) revert InvalidPath();

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

