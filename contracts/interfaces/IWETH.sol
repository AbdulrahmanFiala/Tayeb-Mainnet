// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

/**
 * @title IWETH
 * @notice Interface for Wrapped ETH (WETH) / Wrapped DEV token
 * @dev Standard WETH interface for wrapping/unwrapping native tokens
 */
interface IWETH {
    function deposit() external payable;
    function withdraw(uint wad) external;
    function approve(address guy, uint wad) external returns (bool);
    function transfer(address dst, uint wad) external returns (bool);
    function transferFrom(address src, address dst, uint wad) external returns (bool);
    function balanceOf(address owner) external view returns (uint);
}

