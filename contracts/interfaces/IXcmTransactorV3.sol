// SPDX-License-Identifier: GPL-3.0-only
pragma solidity ^0.8.20;

interface IXcmTransactorV3 {
    // A multilocation is defined by its number of parents and the encoded junctions (interior)
    struct Multilocation {
        uint8 parents;
        bytes[] interior;
    }

    // Support for Weights V2
    struct Weight {
        uint64 refTime;
        uint64 proofSize;
    }

    function indexToAccount(uint16 index) external view returns (address owner);

    function transactInfoWithSigned(Multilocation memory multilocation)
        external
        view
        returns (
            Weight memory transactExtraWeight,
            Weight memory transactExtraWeightSigned,
            Weight memory maxWeight
        );

    function feePerSecond(Multilocation memory multilocation)
        external
        view
        returns (uint256 feePerSecond);

    function transactThroughDerivativeMultilocation(
        uint8 transactor,
        uint16 index,
        Multilocation memory feeAsset,
        Weight memory transactRequiredWeightAtMost,
        bytes memory innerCall,
        uint256 feeAmount,
        Weight memory overallWeight,
        bool refund
    ) external;

    function transactThroughDerivative(
        uint8 transactor,
        uint16 index,
        address currencyId,
        Weight memory transactRequiredWeightAtMost,
        bytes memory innerCall,
        uint256 feeAmount,
        Weight memory overallWeight,
        bool refund
    ) external;

    function transactThroughSignedMultilocation(
        Multilocation memory dest,
        Multilocation memory feeLocation,
        Weight memory transactRequiredWeightAtMost,
        bytes memory call,
        uint256 feeAmount,
        Weight memory overallWeight,
        bool refund
    ) external;

    function transactThroughSigned(
        Multilocation memory dest,
        address feeLocationAddress,
        Weight memory transactRequiredWeightAtMost,
        bytes memory call,
        uint256 feeAmount,
        Weight memory overallWeight,
        bool refund
    ) external;
}


