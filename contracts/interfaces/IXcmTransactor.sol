// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

/**
 * @title IXcmTransactor
 * @notice Interface for Moonbeam's XCM Transactor precompile
 * @dev Precompile address: 0x0000000000000000000000000000000000000806
 * @dev Allows EVM contracts to send XCM messages to other parachains
 */
interface IXcmTransactor {
    // ============================================================================
    // ENUMS
    // ============================================================================

    /// @notice Multilocation structure for identifying destinations
    struct Multilocation {
        uint8 parents;
        bytes[] interior;
    }

    /// @notice Currency ID for fee payment
    struct CurrencyId {
        address currencyAddress;
        uint256 amount;
    }

    /// @notice Weight information for XCM execution
    struct WeightInfo {
        uint64 transactRequiredWeightAtMost;
        uint64 overallWeight;
    }

    // ============================================================================
    // FUNCTIONS
    // ============================================================================

    /**
     * @notice Transact through a signed origin (user pays fees)
     * @dev Sends an XCM message to execute a call on a remote parachain
     * @param dest Destination parachain as Multilocation
     * @param fee Fee asset and amount for execution
     * @param call Encoded call data to execute on destination
     * @param weightInfo Weight limits for the transaction
     */
    function transactThroughSigned(
        Multilocation memory dest,
        CurrencyId memory fee,
        bytes memory call,
        WeightInfo memory weightInfo
    ) external;

    /**
     * @notice Transact through sovereign account (parachain pays fees)
     * @dev Sends an XCM message using the parachain's sovereign account
     * @param dest Destination parachain as Multilocation
     * @param fee Fee asset and amount for execution
     * @param call Encoded call data to execute on destination
     * @param originKind Origin type for the transaction
     * @param weightInfo Weight limits for the transaction
     */
    function transactThroughSovereign(
        Multilocation memory dest,
        address feePayer,
        CurrencyId memory fee,
        bytes memory call,
        uint8 originKind,
        WeightInfo memory weightInfo
    ) external;

    /**
     * @notice Encode call data for remote execution
     * @dev Helper to encode Substrate calls for XCM Transact
     * @param palletIndex Index of the pallet on destination chain
     * @param callIndex Index of the call within the pallet
     * @param callData Encoded parameters for the call
     * @return Encoded call bytes
     */
    function encodeCall(
        uint8 palletIndex,
        uint8 callIndex,
        bytes memory callData
    ) external pure returns (bytes memory);

    // ============================================================================
    // EVENTS
    // ============================================================================

    /// @notice Emitted when an XCM transact is sent
    event TransactedSigned(
        address indexed sender,
        Multilocation dest,
        bytes call
    );

    /// @notice Emitted when a sovereign transact is sent
    event TransactedSovereign(
        Multilocation dest,
        address feePayer,
        bytes call
    );
}



