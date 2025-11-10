// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
import "../ShariaCompliance.sol";
import "./IXcmTransactor.sol";

/**
 * @title RemoteSwapInitiator
 * @notice Initiates cross-chain swaps from Moonbeam to Hydration via XCM
 * @dev Locks assets on Moonbeam, sends XCM message to execute swap on Hydration,
 *      and receives swapped assets back via XCM
 */
contract RemoteSwapInitiator is Ownable, ReentrancyGuard {
    using SafeERC20 for IERC20;

    // ============================================================================
    // STATE VARIABLES
    // ============================================================================

    /// @notice Reference to Sharia compliance contract
    ShariaCompliance public immutable shariaCompliance;

    /// @notice XCM Transactor precompile interface
    IXcmTransactor public immutable xcmTransactor;

    /// @notice Hydration parachain ID
    uint32 public immutable hydrationParachainId;

    /// @notice Omnipool pallet index on Hydration
    uint8 public omnipoolPalletIndex;

    /// @notice Omnipool sell call index
    uint8 public omnipoolSellCallIndex;

    /// @notice Mapping of swap ID to swap details
    mapping(bytes32 => RemoteSwap) public remoteSwaps;

    /// @notice Mapping of user to their swap IDs
    mapping(address => bytes32[]) public userSwapIds;

    /// @notice Counter for generating unique swap IDs
    uint256 public swapCounter;

    /// @notice Minimum gas for XCM execution
    uint64 public minXcmGas;

    // ============================================================================
    // STRUCTS
    // ============================================================================

    struct RemoteSwap {
        address user;
        address sourceToken;
        address targetToken;
        uint256 sourceAmount;
        uint256 minTargetAmount;
        uint256 timestamp;
        SwapStatus status;
        bytes32 xcmMessageHash;
    }

    enum SwapStatus {
        Pending,
        Initiated,
        Completed,
        Failed,
        Cancelled
    }

    // ============================================================================
    // EVENTS
    // ============================================================================

    event RemoteSwapInitiated(
        bytes32 indexed swapId,
        address indexed user,
        address sourceToken,
        address targetToken,
        uint256 sourceAmount,
        uint256 minTargetAmount,
        bytes32 xcmMessageHash
    );

    event RemoteSwapCompleted(
        bytes32 indexed swapId,
        address indexed user,
        uint256 targetAmount
    );

    event RemoteSwapFailed(
        bytes32 indexed swapId,
        address indexed user,
        string reason
    );

    event RemoteSwapCancelled(
        bytes32 indexed swapId,
        address indexed user
    );

    event OmnipoolConfigUpdated(
        uint8 palletIndex,
        uint8 callIndex
    );

    event MinXcmGasUpdated(
        uint64 oldGas,
        uint64 newGas
    );

    // ============================================================================
    // ERRORS
    // ============================================================================

    error InvalidAmount();
    error InvalidToken();
    error SwapNotFound();
    error SwapAlreadyProcessed();
    error InsufficientBalance();
    error XcmTransferFailed();
    error NotShariaCompliant(string symbol);

    // ============================================================================
    // CONSTRUCTOR
    // ============================================================================

    /**
     * @notice Initialize the RemoteSwapInitiator contract
     * @param _shariaCompliance Address of ShariaCompliance contract
     * @param _xcmTransactor Address of XCM Transactor precompile (0x806)
     * @param _hydrationParachainId Hydration parachain ID (2034 for mainnet)
     * @param _omnipoolPalletIndex Omnipool pallet index on Hydration
     * @param _omnipoolSellCallIndex Omnipool sell call index
     */
    constructor(
        address _shariaCompliance,
        address _xcmTransactor,
        uint32 _hydrationParachainId,
        uint8 _omnipoolPalletIndex,
        uint8 _omnipoolSellCallIndex
    ) Ownable(msg.sender) {
        if (_shariaCompliance == address(0) || _xcmTransactor == address(0)) {
            revert InvalidToken();
        }

        shariaCompliance = ShariaCompliance(_shariaCompliance);
        xcmTransactor = IXcmTransactor(_xcmTransactor);
        hydrationParachainId = _hydrationParachainId;
        omnipoolPalletIndex = _omnipoolPalletIndex;
        omnipoolSellCallIndex = _omnipoolSellCallIndex;
        minXcmGas = 1000000000; // 1 billion weight units (default)
    }

    // ============================================================================
    // EXTERNAL FUNCTIONS
    // ============================================================================

    /**
     * @notice Initiate a remote swap from Moonbeam to Hydration
     * @dev Validates Sharia compliance, locks tokens, sends XCM message
     * @param sourceToken Token to swap from (on Moonbeam)
     * @param targetToken Token to swap to (on Hydration)
     * @param sourceAmount Amount of source token to swap
     * @param minTargetAmount Minimum amount of target token to receive
     * @param deadline Deadline for swap execution
     * @return swapId Unique identifier for this swap
     */
    function initiateRemoteSwap(
        address sourceToken,
        address targetToken,
        uint256 sourceAmount,
        uint256 minTargetAmount,
        uint256 deadline
    ) external nonReentrant returns (bytes32 swapId) {
        // Validate inputs
        if (sourceAmount == 0 || minTargetAmount == 0) {
            revert InvalidAmount();
        }
        if (sourceToken == address(0) || targetToken == address(0)) {
            revert InvalidToken();
        }
        if (block.timestamp > deadline) {
            revert("Deadline expired");
        }

        // Validate Sharia compliance of target token
        string memory targetSymbol = shariaCompliance.getSymbolByAddress(targetToken);
        if (!shariaCompliance.isShariaCompliant(targetSymbol)) {
            revert NotShariaCompliant(targetSymbol);
        }

        // Transfer source tokens from user to this contract
        IERC20(sourceToken).safeTransferFrom(msg.sender, address(this), sourceAmount);

        // Generate unique swap ID
        swapId = keccak256(abi.encodePacked(
            msg.sender,
            sourceToken,
            targetToken,
            sourceAmount,
            block.timestamp,
            swapCounter++
        ));

        // Store swap details
        remoteSwaps[swapId] = RemoteSwap({
            user: msg.sender,
            sourceToken: sourceToken,
            targetToken: targetToken,
            sourceAmount: sourceAmount,
            minTargetAmount: minTargetAmount,
            timestamp: block.timestamp,
            status: SwapStatus.Initiated,
            xcmMessageHash: bytes32(0)
        });

        userSwapIds[msg.sender].push(swapId);

        // Build and send XCM message
        bytes32 xcmHash = _sendXcmSwapMessage(
            sourceToken,
            targetToken,
            sourceAmount,
            minTargetAmount,
            msg.sender
        );

        remoteSwaps[swapId].xcmMessageHash = xcmHash;

        emit RemoteSwapInitiated(
            swapId,
            msg.sender,
            sourceToken,
            targetToken,
            sourceAmount,
            minTargetAmount,
            xcmHash
        );

        return swapId;
    }

    /**
     * @notice Cancel a pending swap and refund tokens
     * @dev Only callable by swap initiator, only for pending/failed swaps
     * @param swapId ID of the swap to cancel
     */
    function cancelSwap(bytes32 swapId) external nonReentrant {
        RemoteSwap storage swap = remoteSwaps[swapId];
        
        if (swap.user == address(0)) {
            revert SwapNotFound();
        }
        if (swap.user != msg.sender) {
            revert("Not swap owner");
        }
        if (swap.status == SwapStatus.Completed || swap.status == SwapStatus.Cancelled) {
            revert SwapAlreadyProcessed();
        }

        // Update status
        swap.status = SwapStatus.Cancelled;

        // Refund source tokens
        IERC20(swap.sourceToken).safeTransfer(swap.user, swap.sourceAmount);

        emit RemoteSwapCancelled(swapId, msg.sender);
    }

    /**
     * @notice Mark a swap as completed (called by relayer or admin)
     * @dev In production, this would be triggered by XCM callback
     * @param swapId ID of the swap
     * @param targetAmount Amount of target token received
     */
    function completeSwap(bytes32 swapId, uint256 targetAmount) external onlyOwner {
        RemoteSwap storage swap = remoteSwaps[swapId];
        
        if (swap.user == address(0)) {
            revert SwapNotFound();
        }
        if (swap.status != SwapStatus.Initiated) {
            revert SwapAlreadyProcessed();
        }

        swap.status = SwapStatus.Completed;

        emit RemoteSwapCompleted(swapId, swap.user, targetAmount);
    }

    /**
     * @notice Mark a swap as failed
     * @param swapId ID of the swap
     * @param reason Failure reason
     */
    function failSwap(bytes32 swapId, string calldata reason) external onlyOwner {
        RemoteSwap storage swap = remoteSwaps[swapId];
        
        if (swap.user == address(0)) {
            revert SwapNotFound();
        }
        if (swap.status != SwapStatus.Initiated) {
            revert SwapAlreadyProcessed();
        }

        swap.status = SwapStatus.Failed;

        emit RemoteSwapFailed(swapId, swap.user, reason);
    }

    // ============================================================================
    // VIEW FUNCTIONS
    // ============================================================================

    /**
     * @notice Get swap details
     * @param swapId ID of the swap
     * @return Swap details
     */
    function getSwap(bytes32 swapId) external view returns (RemoteSwap memory) {
        return remoteSwaps[swapId];
    }

    /**
     * @notice Get all swap IDs for a user
     * @param user User address
     * @return Array of swap IDs
     */
    function getUserSwaps(address user) external view returns (bytes32[] memory) {
        return userSwapIds[user];
    }

    // ============================================================================
    // ADMIN FUNCTIONS
    // ============================================================================

    /**
     * @notice Update Omnipool configuration
     * @param _palletIndex New pallet index
     * @param _callIndex New call index
     */
    function updateOmnipoolConfig(
        uint8 _palletIndex,
        uint8 _callIndex
    ) external onlyOwner {
        omnipoolPalletIndex = _palletIndex;
        omnipoolSellCallIndex = _callIndex;

        emit OmnipoolConfigUpdated(_palletIndex, _callIndex);
    }

    /**
     * @notice Update minimum XCM gas
     * @param _minGas New minimum gas
     */
    function updateMinXcmGas(uint64 _minGas) external onlyOwner {
        uint64 oldGas = minXcmGas;
        minXcmGas = _minGas;

        emit MinXcmGasUpdated(oldGas, _minGas);
    }

    /**
     * @notice Emergency withdraw of stuck tokens
     * @param token Token to withdraw
     * @param amount Amount to withdraw
     */
    function emergencyWithdraw(address token, uint256 amount) external onlyOwner {
        IERC20(token).safeTransfer(owner(), amount);
    }

    // ============================================================================
    // INTERNAL FUNCTIONS
    // ============================================================================

    /**
     * @notice Build and send XCM message to Hydration
     * @dev Constructs XCM instructions for remote swap execution
     * @param sourceToken Source token address
     * @param targetToken Target token address
     * @param sourceAmount Amount to swap
     * @param minTargetAmount Minimum output amount
     * @param beneficiary Address to receive swapped tokens
     * @return Message hash
     */
    function _sendXcmSwapMessage(
        address sourceToken,
        address targetToken,
        uint256 sourceAmount,
        uint256 minTargetAmount,
        address beneficiary
    ) internal returns (bytes32) {
        // Build destination multilocation (Hydration parachain)
        IXcmTransactor.Multilocation memory dest = IXcmTransactor.Multilocation({
            parents: 1, // Parent relay chain
            interior: _buildParachainInterior(hydrationParachainId)
        });

        // Build fee payment (use native token for fees)
        IXcmTransactor.CurrencyId memory fee = IXcmTransactor.CurrencyId({
            currencyAddress: address(0), // Native token
            amount: 1e17 // 0.1 DEV for fees
        });

        // Encode Omnipool sell call
        bytes memory omnipoolCall = _encodeOmnipoolSell(
            sourceToken,
            targetToken,
            sourceAmount,
            minTargetAmount
        );

        // Build weight info
        IXcmTransactor.WeightInfo memory weightInfo = IXcmTransactor.WeightInfo({
            transactRequiredWeightAtMost: minXcmGas,
            overallWeight: minXcmGas * 2
        });

        // Send XCM message
        xcmTransactor.transactThroughSigned(dest, fee, omnipoolCall, weightInfo);

        // Return message hash (simplified - in production use actual XCM message hash)
        return keccak256(abi.encodePacked(
            dest.parents,
            omnipoolCall,
            block.timestamp
        ));
    }

    /**
     * @notice Build parachain interior for multilocation
     * @param parachainId Parachain ID
     * @return Interior bytes array
     */
    function _buildParachainInterior(uint32 parachainId) internal pure returns (bytes[] memory) {
        bytes[] memory interior = new bytes[](1);
        interior[0] = abi.encodePacked(uint8(0), parachainId); // Parachain junction
        return interior;
    }

    /**
     * @notice Encode Omnipool sell call
     * @dev Encodes the Substrate call for Hydration's Omnipool
     * @param assetIn Input asset address
     * @param assetOut Output asset address
     * @param amount Amount to sell
     * @param minBuyAmount Minimum amount to receive
     * @return Encoded call data
     */
    function _encodeOmnipoolSell(
        address assetIn,
        address assetOut,
        uint256 amount,
        uint256 minBuyAmount
    ) internal view returns (bytes memory) {
        // Note: This is a simplified encoding
        // In production, use proper SCALE encoding for Substrate calls
        // The actual encoding should be done via @polkadot/api in scripts
        
        return abi.encodePacked(
            omnipoolPalletIndex,
            omnipoolSellCallIndex,
            assetIn,
            assetOut,
            amount,
            minBuyAmount
        );
    }
}



