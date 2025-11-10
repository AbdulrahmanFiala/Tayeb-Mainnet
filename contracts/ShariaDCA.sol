// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
import "@openzeppelin/contracts/access/Ownable.sol";
import "./ShariaCompliance.sol";
import "./interfaces/IDEXRouter.sol";
import "./interfaces/IWETH.sol";

/**
 * @title ShariaDCA
 * @notice Automated Dollar Cost Averaging for Sharia-compliant tokens
 * @dev Uses local automation script for periodic execution on testnet
 */
contract ShariaDCA is Ownable, ReentrancyGuard {
    using SafeERC20 for IERC20;

    // ============================================================================
    // STATE VARIABLES
    // ============================================================================

    /// @notice Sharia compliance contract
    ShariaCompliance public immutable shariaCompliance;

    /// @notice DEX router
    IDEXRouter public dexRouter;

    /// @notice WETH address (Wrapped DEV)
    address public immutable WETH;

    /// @notice DCA order counter
    uint256 public nextOrderId = 1;

    /// @notice All DCA orders
    mapping(uint256 => DCAOrder) public dcaOrders;

    /// @notice User's DCA orders
    mapping(address => uint256[]) public userOrders;

    // Token addresses are stored in ShariaCompliance contract

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
        address sourceToken;      // address(0) for DEV, token address for ERC20
        address targetToken;
        address[] path;
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
        address sourceToken,
        address targetToken,
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
    error InvalidPath();

    // ============================================================================
    // CONSTRUCTOR
    // ============================================================================

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
     * @notice Create a new DCA order with native DEV
     * @param targetToken Target token address
     * @param amountPerInterval Amount to invest per interval (in wei)
     * @param intervalSeconds Time between executions (in seconds)
     * @param totalIntervals Total number of intervals
     * @return orderId Created order ID
     */
    function createDCAOrderWithDEV(
        address targetToken,
        address[] calldata path,
        uint256 amountPerInterval,
        uint256 intervalSeconds,
        uint256 totalIntervals
    ) external payable nonReentrant returns (uint256) {
        if (amountPerInterval == 0 || totalIntervals == 0) {
            revert InvalidAmount();
        }

        if (path.length < 2 || path[0] != WETH || path[path.length - 1] != targetToken) {
            revert InvalidPath();
        }

        // Validate target token is Sharia compliant
        string memory targetSymbol = shariaCompliance.getSymbolByAddress(targetToken);
        if (bytes(targetSymbol).length == 0) {
            revert TokenNotRegistered();
        }
        if (!shariaCompliance.isShariaCompliant(targetSymbol)) {
            revert ShariaCompliance.NotShariaCompliant(targetSymbol);
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
        order.sourceToken = address(0);  // address(0) indicates DEV
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
        _storePath(order, path);

        // Refund excess DEV
        if (msg.value > totalRequired) {
            (bool success, ) = msg.sender.call{value: msg.value - totalRequired}("");
            require(success, "Refund failed");
        }

        emit DCAOrderCreated(
            orderId,
            msg.sender,
            address(0),
            targetToken,
            amountPerInterval,
            intervalSeconds,
            totalIntervals
        );

        return orderId;
    }

    /**
     * @notice Create a new DCA order with ERC20 tokens
     * @param sourceToken Source token address
     * @param targetToken Target token address
     * @param amountPerInterval Amount to invest per interval (in wei)
     * @param intervalSeconds Time between executions (in seconds)
     * @param totalIntervals Total number of intervals
     * @return orderId Created order ID
     */
    function createDCAOrderWithToken(
        address sourceToken,
        address targetToken,
        address[] calldata path,
        uint256 amountPerInterval,
        uint256 intervalSeconds,
        uint256 totalIntervals
    ) external nonReentrant returns (uint256) {
        if (amountPerInterval == 0 || totalIntervals == 0) {
            revert InvalidAmount();
        }

        if (path.length < 2 || path[0] != sourceToken || path[path.length - 1] != targetToken) {
            revert InvalidPath();
        }

        // Validate source token is Sharia compliant
        string memory sourceSymbol = shariaCompliance.getSymbolByAddress(sourceToken);
        if (bytes(sourceSymbol).length == 0) {
            revert TokenNotRegistered();
        }
        if (!shariaCompliance.isShariaCompliant(sourceSymbol)) {
            revert ShariaCompliance.NotShariaCompliant(sourceSymbol);
        }

        // Validate target token is Sharia compliant
        string memory targetSymbol = shariaCompliance.getSymbolByAddress(targetToken);
        if (bytes(targetSymbol).length == 0) {
            revert TokenNotRegistered();
        }
        if (!shariaCompliance.isShariaCompliant(targetSymbol)) {
            revert ShariaCompliance.NotShariaCompliant(targetSymbol);
        }

        // Transfer tokens from user upfront
        uint256 totalRequired = amountPerInterval * totalIntervals;
        IERC20(sourceToken).safeTransferFrom(msg.sender, address(this), totalRequired);

        // Create order
        uint256 orderId = nextOrderId++;
        
        DCAOrder storage order = dcaOrders[orderId];
        order.id = orderId;
        order.owner = msg.sender;
        order.sourceToken = sourceToken;
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
        _storePath(order, path);

        emit DCAOrderCreated(
            orderId,
            msg.sender,
            sourceToken,
            targetToken,
            amountPerInterval,
            intervalSeconds,
            totalIntervals
        );

        return orderId;
    }

    /**
     * @notice Execute a DCA order (called by automation script or manually)
     * @param orderId Order ID to execute
     */
    function executeDCAOrder(uint256 orderId) public nonReentrant {
        DCAOrder storage order = dcaOrders[orderId];
        
        if (!order.exists) revert OrderNotFound();
        if (!order.isActive) revert OrderInactive();
        if (block.timestamp < order.nextExecutionTime) revert OrderNotReady();

        // Prepare swap
        address tokenIn;
        uint256 amountIn = order.amountPerInterval;
        
        // Handle source token (DEV or ERC20)
        if (order.sourceToken == address(0)) {
            // Wrap DEV to WETH
            IWETH(WETH).deposit{value: amountIn}();
            tokenIn = WETH;
        } else {
            // Use ERC20 token directly
            tokenIn = order.sourceToken;
        }

        // Approve router
        IERC20(tokenIn).forceApprove(address(dexRouter), amountIn);

        address[] storage path = order.path;
        if (path.length < 2) revert InvalidPath();

        // Execute swap
        uint256[] memory amounts;
        try dexRouter.swapExactTokensForTokens(
            amountIn,
            0, // No slippage protection for DCA
            path,
            order.owner,
            block.timestamp + 15 minutes
        ) returns (uint256[] memory _amounts) {
            amounts = _amounts;
        } catch {
            revert SwapFailed();
        }

        uint256 amountOut = amounts[amounts.length - 1];

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
            if (order.sourceToken == address(0)) {
                // Refund DEV
                (bool success, ) = msg.sender.call{value: refundAmount}("");
                require(success, "Refund failed");
            } else {
                // Refund ERC20
                IERC20(order.sourceToken).safeTransfer(msg.sender, refundAmount);
            }
        }

        emit DCAOrderCancelled(orderId, msg.sender);
    }

    // ============================================================================
    // AUTOMATION FUNCTIONS
    // ============================================================================

    /**
     * @notice Check if upkeep is needed (for automation script)
     * @dev Checks all active orders to see if any need execution
     * @return upkeepNeeded Whether upkeep is needed
     * @return performData Encoded order IDs to execute
     */
    function checkUpkeep(
        bytes calldata /* checkData */
    ) external view returns (bool upkeepNeeded, bytes memory performData) {
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
     * @notice Perform upkeep (called by automation script)
     * @param performData Encoded order IDs to execute
     * @dev Catches errors per order to prevent one failure from blocking others
     */
    function performUpkeep(bytes calldata performData) external {
        uint256[] memory orderIds = abi.decode(performData, (uint256[]));
        
        for (uint256 i = 0; i < orderIds.length; i++) {
            // Use external call (this.) to enable try-catch error handling
            // This allows one failed order to not block execution of other orders
            try this.executeDCAOrder(orderIds[i]) {
                // Order executed successfully - event emitted in executeDCAOrder
            } catch {
                // Silently continue - failed order will be retried in next upkeep cycle
                // This prevents one failed order from blocking batch execution
            }
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
     * @notice Get stored swap path for an order
     * @param orderId Order ID
     */
    function getOrderPath(uint256 orderId) external view returns (address[] memory) {
        if (!dcaOrders[orderId].exists) revert OrderNotFound();
        return dcaOrders[orderId].path;
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

    function _storePath(DCAOrder storage order, address[] calldata path) internal {
        delete order.path;
        for (uint256 i = 0; i < path.length; i++) {
            order.path.push(path[i]);
        }
    }
}

