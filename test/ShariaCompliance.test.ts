import { expect } from "chai";
import { ethers } from "hardhat";
import { ShariaCompliance } from "../typechain-types";
import { SignerWithAddress } from "@nomicfoundation/hardhat-ethers/signers";

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

    it("Should initialize with default coins", async function () {
      expect(await shariaCompliance.isShariaCompliant("BTC")).to.be.true;
      expect(await shariaCompliance.isShariaCompliant("ETH")).to.be.true;
      expect(await shariaCompliance.isShariaCompliant("USDT")).to.be.true;
      expect(await shariaCompliance.isShariaCompliant("USDC")).to.be.true;
    });

    it("Should return total coins", async function () {
      const totalCoins = await shariaCompliance.getTotalCoins();
      expect(totalCoins).to.equal(4); // BTC, ETH, USDT, USDC
    });
  });

  describe("Register Coin", function () {
    it("Should allow owner to register new coin", async function () {
      await expect(
        shariaCompliance.registerShariaCoin(
          "ADA",
          "Cardano",
          "ADA",
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
          .registerShariaCoin("ADA", "Cardano", "ADA", "Test")
      ).to.be.revertedWithCustomError(shariaCompliance, "OwnableUnauthorizedAccount");
    });

    it("Should not allow duplicate coin registration", async function () {
      await shariaCompliance.registerShariaCoin("ADA", "Cardano", "ADA", "Test");
      
      await expect(
        shariaCompliance.registerShariaCoin("ADA", "Cardano2", "ADA", "Test")
      ).to.be.revertedWithCustomError(shariaCompliance, "CoinAlreadyExists");
    });
  });

  describe("Remove Coin", function () {
    it("Should allow owner to remove coin", async function () {
      await shariaCompliance.registerShariaCoin("ADA", "Cardano", "ADA", "Test");
      
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
      await shariaCompliance.registerShariaCoin("ADA", "Cardano", "ADA", "Test");
      
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
      const coins = await shariaCompliance.getAllShariaCoins();
      
      expect(coins.length).to.equal(4);
      expect(coins[0].symbol).to.equal("BTC");
      expect(coins[1].symbol).to.equal("ETH");
    });
  });

  describe("Require Sharia Compliant", function () {
    it("Should not revert for compliant coin", async function () {
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

