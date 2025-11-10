// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/access/Ownable.sol";

/**
 * @title ShariaCompliance
 * @notice Registry and validation system for Sharia-compliant tokens
 * @dev Manages which tokens are approved for Islamic finance compliance
 */
contract ShariaCompliance is Ownable {
    // ============================================================================
    // STRUCTS
    // ============================================================================

    struct ShariaCoin {
        string id;              
        string name;
        string symbol;
        address tokenAddress;  
        bool verified;
        string complianceReason;
        bool exists;
    }

    // ============================================================================
    // STATE VARIABLES
    // ============================================================================

    /// @notice Mapping from coin ID (address) to Sharia coin data
    mapping(string => ShariaCoin) public shariaCoins;
    
    /// @notice Array of all registered coin IDs for enumeration
    string[] public coinIds;
    
    /// @notice Mapping to track coin ID existence in array
    mapping(string => bool) private coinIdExists;

    // Add reverse lookup mappings
    mapping(address => string) public addressToSymbol;  // Address → Symbol
    mapping(string => address) public symbolToAddress;  // Symbol → Address

    // ============================================================================
    // EVENTS
    // ============================================================================

    event CoinRegistered(
        string indexed coinId,
        string name,
        string symbol,
        string complianceReason
    );

    event CoinRemoved(string indexed coinId);

    event CoinUpdated(
        string indexed coinId,
        bool verified,
        string complianceReason
    );

    // ============================================================================
    // ERRORS
    // ============================================================================

    error CoinNotFound(string coinId);
    error CoinAlreadyExists(string coinId);
    error NotShariaCompliant(string coinId);

    // ============================================================================
    // CONSTRUCTOR
    // ============================================================================

    constructor() Ownable(msg.sender) {
        // Initialize with some default Sharia-compliant coins
        _initializeDefaultCoins();
    }

    // ============================================================================
    // ADMIN FUNCTIONS
    // ============================================================================

    /**
     * @notice Register a new Sharia-compliant coin
     * @param coinId Unique identifier (typically token address)
     * @param name Token name
     * @param symbol Token symbol
     * @param complianceReason Explanation of Sharia compliance
     */
    function registerShariaCoin(
        string memory coinId,
        string memory name,
        string memory symbol,
        address tokenAddress, 
        string memory complianceReason
    ) external onlyOwner {
        if (shariaCoins[coinId].exists) {
            revert CoinAlreadyExists(coinId);
        }
        
        if (tokenAddress != address(0)) {
            // Prevent duplicate addresses
            string memory existingSymbol = addressToSymbol[tokenAddress];
            if (bytes(existingSymbol).length > 0) {
                revert("Address already registered");
            }
            // Prevent duplicate symbols
            address existingAddress = symbolToAddress[symbol];
            if (existingAddress != address(0)) {
                revert("Symbol already registered");
            }
            addressToSymbol[tokenAddress] = symbol;
            symbolToAddress[symbol] = tokenAddress;
        }

        shariaCoins[coinId] = ShariaCoin({
            id: coinId,
            name: name,
            symbol: symbol,
            tokenAddress: tokenAddress,  
            verified: true,
            complianceReason: complianceReason,
            exists: true
        });

        if (!coinIdExists[coinId]) {
            coinIds.push(coinId);
            coinIdExists[coinId] = true;
        }

        emit CoinRegistered(coinId, name, symbol, complianceReason);
    }

    /**
     * @notice Remove a coin from the Sharia compliance registry
     * @param coinId Coin identifier to remove
     */
    function removeShariaCoin(string memory coinId) external onlyOwner {
        if (!shariaCoins[coinId].exists) {
            revert CoinNotFound(coinId);
        }

        // Clean up reverse mappings
        address tokenAddress = shariaCoins[coinId].tokenAddress;
        if (tokenAddress != address(0)) {
            delete addressToSymbol[tokenAddress];
            delete symbolToAddress[coinId]; // coinId is the symbol
        }

        delete shariaCoins[coinId];
        
        // Remove from coinIds array
        for (uint256 i = 0; i < coinIds.length; i++) {
            if (keccak256(bytes(coinIds[i])) == keccak256(bytes(coinId))) {
                coinIds[i] = coinIds[coinIds.length - 1];
                coinIds.pop();
                break;
            }
        }
        
        coinIdExists[coinId] = false;

        emit CoinRemoved(coinId);
    }

    /**
     * @notice Update compliance status of a coin
     * @param coinId Coin identifier
     * @param verified New verification status
     * @param complianceReason Updated reason
     */
    function updateComplianceStatus(
        string memory coinId,
        bool verified,
        string memory complianceReason
    ) external onlyOwner {
        if (!shariaCoins[coinId].exists) {
            revert CoinNotFound(coinId);
        }

        shariaCoins[coinId].verified = verified;
        shariaCoins[coinId].complianceReason = complianceReason;

        emit CoinUpdated(coinId, verified, complianceReason);
    }

    // ============================================================================
    // VIEW FUNCTIONS
    // ============================================================================

    /**
     * @notice Check if a coin is Sharia compliant
     * @param coinId Coin identifier to check
     * @return bool True if compliant and verified
     */
    function isShariaCompliant(string memory coinId) public view returns (bool) {
        return shariaCoins[coinId].exists && shariaCoins[coinId].verified;
    }

    /**
     * @notice Get details of a Sharia coin
     * @param coinId Coin identifier
     * @return ShariaCoin struct with all details
     */
    function getShariaCoin(string memory coinId) external view returns (ShariaCoin memory) {
        if (!shariaCoins[coinId].exists) {
            revert CoinNotFound(coinId);
        }
        return shariaCoins[coinId];
    }

    /**
     * @notice Get all registered Sharia coins
     * @return Array of all ShariaCoin structs
     */
    function getAllShariaCoins() external view returns (ShariaCoin[] memory) {
        ShariaCoin[] memory coins = new ShariaCoin[](coinIds.length);
        
        for (uint256 i = 0; i < coinIds.length; i++) {
            coins[i] = shariaCoins[coinIds[i]];
        }
        
        return coins;
    }

    /**
     * @notice Get total number of registered coins
     * @return uint256 Total count
     */
    function getTotalCoins() external view returns (uint256) {
        return coinIds.length;
    }

    /**
     * @notice Require that a coin is Sharia compliant (reverts if not)
     * @param coinId Coin identifier to validate
     */
    function requireShariaCompliant(string memory coinId) public view {
        if (!isShariaCompliant(coinId)) {
            revert NotShariaCompliant(coinId);
        }
    }

    // Add helper functions
    function getCoinByAddress(address tokenAddress) external view returns (ShariaCoin memory) {
        string memory symbol = addressToSymbol[tokenAddress];
        if (bytes(symbol).length == 0) {
            revert CoinNotFound("");
        }
        return shariaCoins[symbol];
    }

    function getCoinBySymbol(string memory symbol) external view returns (ShariaCoin memory) {
        if (!shariaCoins[symbol].exists) {
            revert CoinNotFound(symbol);
        }
        return shariaCoins[symbol];
    }

    function getTokenAddress(string memory symbol) external view returns (address) {
        return symbolToAddress[symbol];
    }

    function getSymbolByAddress(address tokenAddress) external view returns (string memory) {
        return addressToSymbol[tokenAddress];
    }

    // ============================================================================
    // INTERNAL FUNCTIONS
    // ============================================================================

    /**
     * @notice Initialize default Sharia-compliant coins
     * @dev Coins are registered programmatically from config during deployment
     * This function is kept empty - all coins are registered via registerShariaCoin() in deployment script
     */
    function _initializeDefaultCoins() private {
        // All Initial Hala Coins are registered programmatically from config
        // See scripts/deploy/deploy-core.ts for registration logic
    }

    /**
     * @notice Internal function to register a coin during initialization
     * @dev This function is deprecated - use registerShariaCoin() instead
     * Kept for potential future use with default initialization
     */
    function _registerCoin(
        string memory coinId,
        string memory name,
        string memory symbol,
        address tokenAddress,
        string memory complianceReason
    ) private {
        if (tokenAddress != address(0)) {
            string memory existingSymbol = addressToSymbol[tokenAddress];
            if (bytes(existingSymbol).length > 0) {
                return; // Skip if address already registered
            }
            address existingAddress = symbolToAddress[symbol];
            if (existingAddress != address(0)) {
                return; // Skip if symbol already registered
            }
            addressToSymbol[tokenAddress] = symbol;
            symbolToAddress[symbol] = tokenAddress;
        }

        shariaCoins[coinId] = ShariaCoin({
            id: coinId,
            name: name,
            symbol: symbol,
            tokenAddress: tokenAddress,
            verified: true,
            complianceReason: complianceReason,
            exists: true
        });

        if (!coinIdExists[coinId]) {
            coinIds.push(coinId);
            coinIdExists[coinId] = true;
        }
    }
}

