// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
import "@openzeppelin/contracts/access/Ownable.sol";
import "./ShariaCompliance.sol";
import "./interfaces/IDEXRouter.sol";

/**
 * @title ShariaETF
 * @notice Create and invest in Sharia-compliant ETF portfolios
 * @dev Batch swaps multiple tokens according to allocation percentages
 */
contract ShariaETF is Ownable, ReentrancyGuard {
    using SafeERC20 for IERC20;

    // ============================================================================
    // STATE VARIABLES
    // ============================================================================

    /// @notice Reference to Sharia compliance contract
    ShariaCompliance public immutable shariaCompliance;

    /// @notice DEX router for swaps
    IDEXRouter public dexRouter;

    /// @notice WGLMR address
    address public immutable WGLMR;

    /// @notice ETF counter
    uint256 public nextETFId = 1;

    /// @notice Template ETF counter
    uint256 public nextTemplateId = 1;

    /// @notice All ETFs
    mapping(uint256 => ETF) public etfs;

    /// @notice Template ETFs (pre-configured)
    mapping(uint256 => ETF) public templateETFs;

    /// @notice User ETF subscriptions
    mapping(address => uint256[]) public userETFs;

    /// @notice User investments in specific ETFs
    mapping(address => mapping(uint256 => uint256)) public userETFBalances;

    /// @notice Token address registry
    mapping(string => address) public tokenAddresses;

    // ============================================================================
    // STRUCTS
    // ============================================================================

    struct ETF {
        uint256 id;
        string name;
        string description;
        address creator;
        Allocation[] allocations;
        bool isTemplate;
        uint256 totalValue;
        bool exists;
    }

    struct Allocation {
        string symbol;          // Token symbol
        address tokenAddress;   // Token contract address
        uint8 percentage;       // Allocation percentage (0-100)
    }

    struct InvestmentRecord {
        uint256 etfId;
        uint256 totalInvested;
        uint256 timestamp;
    }

    // ============================================================================
    // EVENTS
    // ============================================================================

    event ETFCreated(
        uint256 indexed etfId,
        string name,
        address indexed creator,
        bool isTemplate
    );

    event ETFInvestment(
        address indexed user,
        uint256 indexed etfId,
        uint256 amountInvested,
        uint256 timestamp
    );

    event TokenAddressRegistered(
        string indexed symbol,
        address indexed tokenAddress
    );

    // ============================================================================
    // ERRORS
    // ============================================================================

    error ETFNotFound();
    error InvalidAllocation();
    error InvalidAmount();
    error TokenNotRegistered();
    error SwapFailed();
    error NotShariaCompliant();

    // ============================================================================
    // CONSTRUCTOR
    // ============================================================================

    constructor(
        address _shariaCompliance,
        address _dexRouter,
        address _wglmr
    ) Ownable(msg.sender) {
        shariaCompliance = ShariaCompliance(_shariaCompliance);
        dexRouter = IDEXRouter(_dexRouter);
        WGLMR = _wglmr;
        
        _initializeTemplateETFs();
    }

    // ============================================================================
    // ADMIN FUNCTIONS
    // ============================================================================

    /**
     * @notice Register token address for a symbol
     * @param symbol Token symbol
     * @param tokenAddress Token contract address
     */
    function registerTokenAddress(
        string memory symbol,
        address tokenAddress
    ) external onlyOwner {
        tokenAddresses[symbol] = tokenAddress;
        emit TokenAddressRegistered(symbol, tokenAddress);
    }

    /**
     * @notice Update DEX router
     * @param _newRouter New router address
     */
    function updateDexRouter(address _newRouter) external onlyOwner {
        dexRouter = IDEXRouter(_newRouter);
    }

    /**
     * @notice Create a template ETF (admin only)
     * @param name ETF name
     * @param description ETF description
     * @param symbols Array of token symbols
     * @param percentages Array of allocation percentages
     */
    function createTemplateETF(
        string memory name,
        string memory description,
        string[] memory symbols,
        uint8[] memory percentages
    ) external onlyOwner returns (uint256) {
        if (symbols.length != percentages.length) revert InvalidAllocation();
        
        uint256 totalPercentage = 0;
        for (uint256 i = 0; i < percentages.length; i++) {
            totalPercentage += percentages[i];
        }
        if (totalPercentage != 100) revert InvalidAllocation();

        uint256 etfId = nextTemplateId++;
        
        ETF storage etf = templateETFs[etfId];
        etf.id = etfId;
        etf.name = name;
        etf.description = description;
        etf.creator = msg.sender;
        etf.isTemplate = true;
        etf.totalValue = 0;
        etf.exists = true;

        for (uint256 i = 0; i < symbols.length; i++) {
            address tokenAddr = tokenAddresses[symbols[i]];
            if (tokenAddr == address(0)) revert TokenNotRegistered();
            
            etf.allocations.push(Allocation({
                symbol: symbols[i],
                tokenAddress: tokenAddr,
                percentage: percentages[i]
            }));
        }

        emit ETFCreated(etfId, name, msg.sender, true);
        
        return etfId;
    }

    // ============================================================================
    // USER FUNCTIONS
    // ============================================================================

    /**
     * @notice Create a custom ETF
     * @param name ETF name
     * @param description ETF description
     * @param symbols Token symbols
     * @param percentages Allocation percentages
     */
    function createETF(
        string memory name,
        string memory description,
        string[] memory symbols,
        uint8[] memory percentages
    ) external returns (uint256) {
        if (symbols.length != percentages.length) revert InvalidAllocation();
        
        uint256 totalPercentage = 0;
        for (uint256 i = 0; i < percentages.length; i++) {
            totalPercentage += percentages[i];
            
            // Validate Sharia compliance
            if (!shariaCompliance.isShariaCompliant(symbols[i])) {
                revert NotShariaCompliant();
            }
        }
        if (totalPercentage != 100) revert InvalidAllocation();

        uint256 etfId = nextETFId++;
        
        ETF storage etf = etfs[etfId];
        etf.id = etfId;
        etf.name = name;
        etf.description = description;
        etf.creator = msg.sender;
        etf.isTemplate = false;
        etf.totalValue = 0;
        etf.exists = true;

        for (uint256 i = 0; i < symbols.length; i++) {
            address tokenAddr = tokenAddresses[symbols[i]];
            if (tokenAddr == address(0)) revert TokenNotRegistered();
            
            etf.allocations.push(Allocation({
                symbol: symbols[i],
                tokenAddress: tokenAddr,
                percentage: percentages[i]
            }));
        }

        userETFs[msg.sender].push(etfId);

        emit ETFCreated(etfId, name, msg.sender, false);
        
        return etfId;
    }

    /**
     * @notice Invest in an ETF using GLMR
     * @param etfId ETF identifier
     * @param minAmountsOut Minimum output amounts for slippage protection
     * @param deadline Swap deadline
     */
    function investInETF(
        uint256 etfId,
        uint256[] memory minAmountsOut,
        uint256 deadline
    ) external payable nonReentrant {
        if (msg.value == 0) revert InvalidAmount();

        // Get ETF (check both regular and template)
        ETF storage etf = etfs[etfId].exists ? etfs[etfId] : templateETFs[etfId];
        if (!etf.exists) revert ETFNotFound();

        if (minAmountsOut.length != etf.allocations.length) revert InvalidAllocation();

        // Add to user's ETF list if not already subscribed
        bool isSubscribed = false;
        uint256[] storage userETFList = userETFs[msg.sender];
        for (uint256 i = 0; i < userETFList.length; i++) {
            if (userETFList[i] == etfId) {
                isSubscribed = true;
                break;
            }
        }
        if (!isSubscribed) {
            userETFList.push(etfId);
        }

        uint256 totalInvested = msg.value;

        // Execute swaps for each allocation
        for (uint256 i = 0; i < etf.allocations.length; i++) {
            Allocation memory allocation = etf.allocations[i];
            
            // Calculate amount for this allocation
            uint256 allocationAmount = (totalInvested * allocation.percentage) / 100;
            
            if (allocationAmount > 0) {
                _swapGLMRForToken(
                    allocation.tokenAddress,
                    allocationAmount,
                    minAmountsOut[i],
                    deadline,
                    msg.sender
                );
            }
        }

        // Update balances
        userETFBalances[msg.sender][etfId] += totalInvested;
        etf.totalValue += totalInvested;

        emit ETFInvestment(msg.sender, etfId, totalInvested, block.timestamp);
    }

    /**
     * @notice Invest in an ETF using a specific token
     * @param etfId ETF identifier
     * @param inputToken Input token address
     * @param inputAmount Amount of input tokens
     * @param minAmountsOut Minimum output amounts
     * @param deadline Swap deadline
     */
    function investInETFWithToken(
        uint256 etfId,
        address inputToken,
        uint256 inputAmount,
        uint256[] memory minAmountsOut,
        uint256 deadline
    ) external nonReentrant {
        if (inputAmount == 0) revert InvalidAmount();

        ETF storage etf = etfs[etfId].exists ? etfs[etfId] : templateETFs[etfId];
        if (!etf.exists) revert ETFNotFound();

        if (minAmountsOut.length != etf.allocations.length) revert InvalidAllocation();

        // Transfer input tokens
        IERC20(inputToken).safeTransferFrom(msg.sender, address(this), inputAmount);

        // Add to user's ETF list if needed
        bool isSubscribed = false;
        uint256[] storage userETFList = userETFs[msg.sender];
        for (uint256 i = 0; i < userETFList.length; i++) {
            if (userETFList[i] == etfId) {
                isSubscribed = true;
                break;
            }
        }
        if (!isSubscribed) {
            userETFList.push(etfId);
        }

        // Execute swaps for each allocation
        for (uint256 i = 0; i < etf.allocations.length; i++) {
            Allocation memory allocation = etf.allocations[i];
            
            uint256 allocationAmount = (inputAmount * allocation.percentage) / 100;
            
            if (allocationAmount > 0) {
                _swapTokenForToken(
                    inputToken,
                    allocation.tokenAddress,
                    allocationAmount,
                    minAmountsOut[i],
                    deadline,
                    msg.sender
                );
            }
        }

        userETFBalances[msg.sender][etfId] += inputAmount;
        etf.totalValue += inputAmount;

        emit ETFInvestment(msg.sender, etfId, inputAmount, block.timestamp);
    }

    // ============================================================================
    // VIEW FUNCTIONS
    // ============================================================================

    /**
     * @notice Get ETF details
     * @param etfId ETF identifier
     * @param isTemplate Whether to look in templates
     */
    function getETF(uint256 etfId, bool isTemplate) external view returns (
        uint256 id,
        string memory name,
        string memory description,
        address creator,
        Allocation[] memory allocations,
        uint256 totalValue
    ) {
        ETF storage etf = isTemplate ? templateETFs[etfId] : etfs[etfId];
        if (!etf.exists) revert ETFNotFound();
        
        return (
            etf.id,
            etf.name,
            etf.description,
            etf.creator,
            etf.allocations,
            etf.totalValue
        );
    }

    /**
     * @notice Get user's ETFs
     * @param user User address
     */
    function getUserETFs(address user) external view returns (uint256[] memory) {
        return userETFs[user];
    }

    /**
     * @notice Get user's balance in specific ETF
     * @param user User address
     * @param etfId ETF identifier
     */
    function getUserETFBalance(address user, uint256 etfId) external view returns (uint256) {
        return userETFBalances[user][etfId];
    }

    // ============================================================================
    // INTERNAL FUNCTIONS
    // ============================================================================

    /**
     * @notice Swap GLMR for token
     */
    function _swapGLMRForToken(
        address tokenOut,
        uint256 amountIn,
        uint256 minAmountOut,
        uint256 deadline,
        address recipient
    ) private {
        // Wrap GLMR
        (bool success, ) = WGLMR.call{value: amountIn}("");
        if (!success) revert SwapFailed();

        // Approve router
        IERC20(WGLMR).forceApprove(address(dexRouter), amountIn);

        // Build path
        address[] memory path = new address[](2);
        path[0] = WGLMR;
        path[1] = tokenOut;

        // Execute swap
        try dexRouter.swapExactTokensForTokens(
            amountIn,
            minAmountOut,
            path,
            recipient,
            deadline
        ) {} catch {
            revert SwapFailed();
        }
    }

    /**
     * @notice Swap token for token
     */
    function _swapTokenForToken(
        address tokenIn,
        address tokenOut,
        uint256 amountIn,
        uint256 minAmountOut,
        uint256 deadline,
        address recipient
    ) private {
        // Approve router
        IERC20(tokenIn).forceApprove(address(dexRouter), amountIn);

        // Build path
        address[] memory path = new address[](2);
        path[0] = tokenIn;
        path[1] = tokenOut;

        // Execute swap
        try dexRouter.swapExactTokensForTokens(
            amountIn,
            minAmountOut,
            path,
            recipient,
            deadline
        ) {} catch {
            revert SwapFailed();
        }
    }

    /**
     * @notice Initialize template ETFs
     */
    function _initializeTemplateETFs() private {
        // Templates will be added via createTemplateETF after token addresses are registered
    }

    // ============================================================================
    // EMERGENCY FUNCTIONS
    // ============================================================================

    /**
     * @notice Rescue stuck tokens
     */
    function rescueTokens(address token, uint256 amount) external onlyOwner {
        IERC20(token).safeTransfer(owner(), amount);
    }

    receive() external payable {}
}

