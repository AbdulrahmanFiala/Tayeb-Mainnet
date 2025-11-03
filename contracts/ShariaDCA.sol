// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
import "@openzeppelin/contracts/access/Ownable.sol";
import "@chainlink/contracts/src/v0.8/automation/AutomationCompatible.sol";
import "./ShariaCompliance.sol";
import "./interfaces/IDEXRouter.sol";

/**
 * @title ShariaDCA
 * @notice Automated Dollar Cost Averaging for Sharia-compliant tokens
 * @dev Uses Chainlink Automation for periodic execution
 */
contract ShariaDCA is Ownable, ReentrancyGuard, AutomationCompatibleInterface {
    using SafeERC20 for IERC20;

    // ============================================================================
    // STATE VARIABLES
    // ============================================================================

    /// @notice Sharia compliance contract
    ShariaCompliance public immutable shariaCompliance;

    /// @notice DEX router
    IDEXRouter public dexRouter;

    /// @notice WGLMR address
    address public immutable WGLMR;

    /// @notice DCA order counter
    uint256 public nextOrderId = 1;

    /// @notice All DCA orders
    mapping(uint256 => DCAOrder) public dcaOrders;

    /// @notice User's DCA orders
    mapping(address => uint256[]) public userOrders;

    /// @notice Token address registry
    mapping(string => address) public tokenAddresses;

    /// @notice Minimum interval between executions (1 hour)
    uint256 public constant MIN_INTERVAL = 1 hours;

    /// @notice Maximum interval between executions (30 days)
    uint256 public constant MAX_INTERVAL = 30 days;

    // ============================================================================
    // STRUCTS
    // ============================================================================

    struct DCAOrder {
        uint256 id;
        address owner;
        string targetSymbol;
        address targetToken;
        uint256 amountPerInterval;
        uint256 interval;
        uint256 intervalsCompleted;
        uint256 totalIntervals;
        uint256 nextExecutionTime;
        uint256 startTime;
        bool isActive;
        bool exists;
    }

    // ============================================================================
    // EVENTS
    // ============================================================================

    event DCAOrderCreated(
        uint256 indexed orderId,
        address indexed owner,
        string targetSymbol,
        uint256 amountPerInterval,
        uint256 interval,
        uint256 totalIntervals
    );

    event DCAOrderExecuted(
        uint256 indexed orderId,
        uint256 intervalNumber,
        uint256 amountIn,
        uint256 amountOut,
        uint256 timestamp
    );

    event DCAOrderCancelled(
        uint256 indexed orderId,
        address indexed owner
    );

    event DCAOrderCompleted(
        uint256 indexed orderId,
        address indexed owner,
        uint256 totalIntervals
    );

    // ============================================================================
    // ERRORS
    // ============================================================================

    error OrderNotFound();
    error Unauthorized();
    error InvalidInterval();
    error InvalidAmount();
    error InsufficientDeposit();
    error OrderInactive();
    error OrderNotReady();
    error SwapFailed();
    error TokenNotRegistered();

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
    }

    // ============================================================================
    // ADMIN FUNCTIONS
    // ============================================================================

    /**
     * @notice Register token address
     * @param symbol Token symbol
     * @param tokenAddress Token contract address
     */
    function registerTokenAddress(
        string memory symbol,
        address tokenAddress
    ) external onlyOwner {
        tokenAddresses[symbol] = tokenAddress;
    }

    /**
     * @notice Update DEX router
     * @param _newRouter New router address
     */
    function updateDexRouter(address _newRouter) external onlyOwner {
        dexRouter = IDEXRouter(_newRouter);
    }

    // ============================================================================
    // DCA FUNCTIONS
    // ============================================================================

    /**
     * @notice Create a new DCA order
     * @param targetSymbol Target token symbol
     * @param amountPerInterval Amount to invest per interval (in wei)
     * @param intervalSeconds Time between executions (in seconds)
     * @param totalIntervals Total number of intervals
     * @return orderId Created order ID
     */
    function createDCAOrder(
        string memory targetSymbol,
        uint256 amountPerInterval,
        uint256 intervalSeconds,
        uint256 totalIntervals
    ) external payable nonReentrant returns (uint256) {
        if (intervalSeconds < MIN_INTERVAL || intervalSeconds > MAX_INTERVAL) {
            revert InvalidInterval();
        }
        if (amountPerInterval == 0 || totalIntervals == 0) {
            revert InvalidAmount();
        }

        // Validate Sharia compliance
        if (!shariaCompliance.isShariaCompliant(targetSymbol)) {
            revert ShariaCompliance.NotShariaCompliant(targetSymbol);
        }

        // Get token address
        address targetToken = tokenAddresses[targetSymbol];
        if (targetToken == address(0)) {
            revert TokenNotRegistered();
        }

        // Check deposit
        uint256 totalRequired = amountPerInterval * totalIntervals;
        if (msg.value < totalRequired) {
            revert InsufficientDeposit();
        }

        // Create order
        uint256 orderId = nextOrderId++;
        
        DCAOrder storage order = dcaOrders[orderId];
        order.id = orderId;
        order.owner = msg.sender;
        order.targetSymbol = targetSymbol;
        order.targetToken = targetToken;
        order.amountPerInterval = amountPerInterval;
        order.interval = intervalSeconds;
        order.intervalsCompleted = 0;
        order.totalIntervals = totalIntervals;
        order.nextExecutionTime = block.timestamp + intervalSeconds;
        order.startTime = block.timestamp;
        order.isActive = true;
        order.exists = true;

        userOrders[msg.sender].push(orderId);

        // Refund excess
        if (msg.value > totalRequired) {
            (bool success, ) = msg.sender.call{value: msg.value - totalRequired}("");
            require(success, "Refund failed");
        }

        emit DCAOrderCreated(
            orderId,
            msg.sender,
            targetSymbol,
            amountPerInterval,
            intervalSeconds,
            totalIntervals
        );

        return orderId;
    }

    /**
     * @notice Execute a DCA order (called by Chainlink Automation or manually)
     * @param orderId Order ID to execute
     */
    function executeDCAOrder(uint256 orderId) public nonReentrant {
        DCAOrder storage order = dcaOrders[orderId];
        
        if (!order.exists) revert OrderNotFound();
        if (!order.isActive) revert OrderInactive();
        if (block.timestamp < order.nextExecutionTime) revert OrderNotReady();

        // Execute swap
        uint256 amountOut = _swapGLMRForToken(
            order.targetToken,
            order.amountPerInterval,
            0, // No slippage protection for DCA
            block.timestamp + 15 minutes,
            order.owner
        );

        // Update order
        order.intervalsCompleted++;
        order.nextExecutionTime = block.timestamp + order.interval;

        emit DCAOrderExecuted(
            orderId,
            order.intervalsCompleted,
            order.amountPerInterval,
            amountOut,
            block.timestamp
        );

        // Check if completed
        if (order.intervalsCompleted >= order.totalIntervals) {
            order.isActive = false;
            emit DCAOrderCompleted(orderId, order.owner, order.totalIntervals);
        }
    }

    /**
     * @notice Cancel a DCA order and refund remaining balance
     * @param orderId Order ID to cancel
     */
    function cancelDCAOrder(uint256 orderId) external nonReentrant {
        DCAOrder storage order = dcaOrders[orderId];
        
        if (!order.exists) revert OrderNotFound();
        if (order.owner != msg.sender) revert Unauthorized();
        if (!order.isActive) revert OrderInactive();

        // Calculate refund
        uint256 remaining = order.totalIntervals - order.intervalsCompleted;
        uint256 refundAmount = remaining * order.amountPerInterval;

        // Deactivate order
        order.isActive = false;

        // Refund
        if (refundAmount > 0) {
            (bool success, ) = msg.sender.call{value: refundAmount}("");
            require(success, "Refund failed");
        }

        emit DCAOrderCancelled(orderId, msg.sender);
    }

    // ============================================================================
    // CHAINLINK AUTOMATION
    // ============================================================================

    /**
     * @notice Check if upkeep is needed (Chainlink Automation)
     * @dev Checks all active orders to see if any need execution
     * @return upkeepNeeded Whether upkeep is needed
     * @return performData Encoded order IDs to execute
     */
    function checkUpkeep(
        bytes calldata /* checkData */
    ) external view override returns (bool upkeepNeeded, bytes memory performData) {
        uint256[] memory ordersToExecute = new uint256[](nextOrderId);
        uint256 count = 0;

        for (uint256 i = 1; i < nextOrderId; i++) {
            DCAOrder storage order = dcaOrders[i];
            if (
                order.exists &&
                order.isActive &&
                block.timestamp >= order.nextExecutionTime &&
                order.intervalsCompleted < order.totalIntervals
            ) {
                ordersToExecute[count] = i;
                count++;
            }
        }

        if (count > 0) {
            // Resize array
            uint256[] memory result = new uint256[](count);
            for (uint256 i = 0; i < count; i++) {
                result[i] = ordersToExecute[i];
            }
            
            upkeepNeeded = true;
            performData = abi.encode(result);
        }

        return (upkeepNeeded, performData);
    }

    /**
     * @notice Perform upkeep (Chainlink Automation)
     * @param performData Encoded order IDs to execute
     */
    function performUpkeep(bytes calldata performData) external override {
        uint256[] memory orderIds = abi.decode(performData, (uint256[]));
        
        for (uint256 i = 0; i < orderIds.length; i++) {
            try this.executeDCAOrder(orderIds[i]) {} catch {}
        }
    }

    // ============================================================================
    // VIEW FUNCTIONS
    // ============================================================================

    /**
     * @notice Get DCA order details
     * @param orderId Order ID
     */
    function getDCAOrder(uint256 orderId) external view returns (DCAOrder memory) {
        if (!dcaOrders[orderId].exists) revert OrderNotFound();
        return dcaOrders[orderId];
    }

    /**
     * @notice Get user's DCA orders
     * @param user User address
     */
    function getUserOrders(address user) external view returns (uint256[] memory) {
        return userOrders[user];
    }

    /**
     * @notice Get active order count for user
     * @param user User address
     */
    function getUserActiveOrderCount(address user) external view returns (uint256) {
        uint256[] memory orders = userOrders[user];
        uint256 count = 0;
        
        for (uint256 i = 0; i < orders.length; i++) {
            if (dcaOrders[orders[i]].isActive) {
                count++;
            }
        }
        
        return count;
    }

    // ============================================================================
    // INTERNAL FUNCTIONS
    // ============================================================================

    /**
     * @notice Swap GLMR for token
     * @return amountOut Amount received
     */
    function _swapGLMRForToken(
        address tokenOut,
        uint256 amountIn,
        uint256 minAmountOut,
        uint256 deadline,
        address recipient
    ) private returns (uint256 amountOut) {
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
        uint256[] memory amounts;
        try dexRouter.swapExactTokensForTokens(
            amountIn,
            minAmountOut,
            path,
            recipient,
            deadline
        ) returns (uint256[] memory _amounts) {
            amounts = _amounts;
            amountOut = amounts[amounts.length - 1];
        } catch {
            revert SwapFailed();
        }

        return amountOut;
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

    /**
     * @notice Rescue stuck GLMR
     */
    function rescueGLMR(uint256 amount) external onlyOwner {
        (bool success, ) = owner().call{value: amount}("");
        require(success, "Rescue failed");
    }

    receive() external payable {}
}

