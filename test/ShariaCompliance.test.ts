import { expect } from "chai";
import hre from "hardhat";
import "@nomicfoundation/hardhat-chai-matchers";
import { ShariaCompliance } from "../typechain-types";
import { SignerWithAddress } from "@nomicfoundation/hardhat-ethers/signers";

const { ethers } = hre;

describe("ShariaCompliance", function () {
  let shariaCompliance: ShariaCompliance;
  let owner: SignerWithAddress;
  let user: SignerWithAddress;

  beforeEach(async function () {
    [owner, user] = await ethers.getSigners();

    const ShariaCompliance = await ethers.getContractFactory("ShariaCompliance");
    shariaCompliance = await ShariaCompliance.deploy();
    await shariaCompliance.waitForDeployment();
  });

  describe("Deployment", function () {
    it("Should set the correct owner", async function () {
      expect(await shariaCompliance.owner()).to.equal(owner.address);
    });

    it("Should start with no coins registered (coins registered programmatically from config)", async function () {
      const totalCoins = await shariaCompliance.getTotalCoins();
      expect(totalCoins).to.equal(0); // No coins initialized by default
      
      // Coins should not be compliant until registered
      expect(await shariaCompliance.isShariaCompliant("BTC")).to.be.false;
      expect(await shariaCompliance.isShariaCompliant("ETH")).to.be.false;
    });

    it("Should return total coins", async function () {
      const totalCoins = await shariaCompliance.getTotalCoins();
      expect(totalCoins).to.equal(0); // No default coins
    });
  });

  describe("Register Coin", function () {
    it("Should allow owner to register new coin", async function () {
      await expect(
        shariaCompliance.registerShariaCoin(
          "ADA",
          "Cardano",
          "ADA",
          ethers.ZeroAddress,
          "Proof-of-stake blockchain"
        )
      )
        .to.emit(shariaCompliance, "CoinRegistered")
        .withArgs("ADA", "Cardano", "ADA", "Proof-of-stake blockchain");

      expect(await shariaCompliance.isShariaCompliant("ADA")).to.be.true;
    });

    it("Should not allow non-owner to register coin", async function () {
      await expect(
        shariaCompliance
          .connect(user)
          .registerShariaCoin("ADA", "Cardano", "ADA", ethers.ZeroAddress, "Test")
      ).to.be.revertedWithCustomError(shariaCompliance, "OwnableUnauthorizedAccount");
    });

    it("Should not allow duplicate coin registration", async function () {
      await shariaCompliance.registerShariaCoin("ADA", "Cardano", "ADA", ethers.ZeroAddress, "Test");
      
      await expect(
        shariaCompliance.registerShariaCoin("ADA", "Cardano2", "ADA", ethers.ZeroAddress, "Test")
      ).to.be.revertedWithCustomError(shariaCompliance, "CoinAlreadyExists");
    });
  });

  describe("Remove Coin", function () {
    it("Should allow owner to remove coin", async function () {
      await shariaCompliance.registerShariaCoin("ADA", "Cardano", "ADA", ethers.ZeroAddress, "Test");
      
      await expect(shariaCompliance.removeShariaCoin("ADA"))
        .to.emit(shariaCompliance, "CoinRemoved")
        .withArgs("ADA");

      expect(await shariaCompliance.isShariaCompliant("ADA")).to.be.false;
    });

    it("Should not allow removing non-existent coin", async function () {
      await expect(
        shariaCompliance.removeShariaCoin("NONEXISTENT")
      ).to.be.revertedWithCustomError(shariaCompliance, "CoinNotFound");
    });
  });

  describe("Update Compliance Status", function () {
    it("Should allow owner to update compliance status", async function () {
      await shariaCompliance.registerShariaCoin("ADA", "Cardano", "ADA", ethers.ZeroAddress, "Test");
      
      await expect(
        shariaCompliance.updateComplianceStatus("ADA", false, "Under review")
      )
        .to.emit(shariaCompliance, "CoinUpdated")
        .withArgs("ADA", false, "Under review");

      expect(await shariaCompliance.isShariaCompliant("ADA")).to.be.false;
    });
  });

  describe("Get Coin Details", function () {
    it("Should return correct coin details", async function () {
      // Register BTC first
      await shariaCompliance.registerShariaCoin(
        "BTC",
        "Bitcoin",
        "BTC",
        ethers.ZeroAddress,
        "Decentralized cryptocurrency"
      );
      
      const coin = await shariaCompliance.getShariaCoin("BTC");
      
      expect(coin.id).to.equal("BTC");
      expect(coin.name).to.equal("Bitcoin");
      expect(coin.symbol).to.equal("BTC");
      expect(coin.verified).to.be.true;
      expect(coin.exists).to.be.true;
    });

    it("Should revert when getting non-existent coin", async function () {
      await expect(
        shariaCompliance.getShariaCoin("NONEXISTENT")
      ).to.be.revertedWithCustomError(shariaCompliance, "CoinNotFound");
    });
  });

  describe("Get All Coins", function () {
    it("Should return all registered coins", async function () {
      // Register coins first
      await shariaCompliance.registerShariaCoin("BTC", "Bitcoin", "BTC", ethers.ZeroAddress, "Test");
      await shariaCompliance.registerShariaCoin("ETH", "Ethereum", "ETH", ethers.ZeroAddress, "Test");
      await shariaCompliance.registerShariaCoin("USDT", "Tether", "USDT", ethers.ZeroAddress, "Test");
      await shariaCompliance.registerShariaCoin("USDC", "USD Coin", "USDC", ethers.ZeroAddress, "Test");
      
      const coins = await shariaCompliance.getAllShariaCoins();
      
      expect(coins.length).to.equal(4);
      expect(coins[0].id).to.equal("BTC");
      expect(coins[1].id).to.equal("ETH");
      expect(coins[2].id).to.equal("USDT");
      expect(coins[3].id).to.equal("USDC");
    });
  });

  describe("Require Sharia Compliant", function () {
    it("Should not revert for compliant coin", async function () {
      // Register BTC first
      await shariaCompliance.registerShariaCoin("BTC", "Bitcoin", "BTC", ethers.ZeroAddress, "Test");
      
      await expect(
        shariaCompliance.requireShariaCompliant("BTC")
      ).to.not.be.reverted;
    });

    it("Should revert for non-compliant coin", async function () {
      await expect(
        shariaCompliance.requireShariaCompliant("NONEXISTENT")
      ).to.be.revertedWithCustomError(shariaCompliance, "NotShariaCompliant");
    });
  });
});

