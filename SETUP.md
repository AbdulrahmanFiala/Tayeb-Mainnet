# Quick Setup Guide

## 🚀 Get Started in 5 Minutes

### 1. Install Dependencies

```bash
npm install
```

### 2. Configure Environment

```bash
# Copy the example environment file
cp .env.example .env
```

Then edit `.env` and add your private key:

```bash
# Open in your editor
nano .env
# or
code .env
```

**How to get your private key from MetaMask:**
1. Open MetaMask
2. Click the three dots menu
3. Select "Account details"
4. Click "Export Private Key"
5. Enter your password
6. Copy the private key (starts with `0x`)

⚠️ **IMPORTANT**: Never commit your `.env` file or share your private key!

### 3. Get Testnet Tokens

Visit the Moonbase Alpha faucet to get free DEV tokens:
- **Faucet**: https://faucet.moonbeam.network/
- You'll need DEV tokens for deployment and testing

### 4. Compile Contracts

```bash
npm run compile
```

You should see:
```
✅ Compiled x Solidity files successfully
```

### 5. Run Tests

```bash
npm test
```

You should see:
```
✅ x passing
```

### 6. Deploy to Testnet

```bash
npm run deploy:testnet
```

This will deploy all 4 contracts to Moonbase Alpha:
- ShariaCompliance
- ShariaSwap
- ShariaETF
- ShariaDCA

**Save the contract addresses!** You'll need them for frontend integration.

## 📋 Post-Deployment Steps

After deployment, you need to register token addresses. Here's an example script:

```typescript
// setup.ts
import { ethers } from "hardhat";

async function main() {
  const SHARIA_COMPLIANCE = "0x..."; // Your deployed address
  const SHARIA_SWAP = "0x...";       // Your deployed address
  const SHARIA_ETF = "0x...";        // Your deployed address
  const SHARIA_DCA = "0x...";        // Your deployed address

  // Example token addresses on Moonbase Alpha
  const WGLMR = "0xD909178CC99d318e4D46e7E66a972955859670E1";
  
  // Get contracts
  const shariaCompliance = await ethers.getContractAt("ShariaCompliance", SHARIA_COMPLIANCE);
  const shariaSwap = await ethers.getContractAt("ShariaSwap", SHARIA_SWAP);
  const shariaETF = await ethers.getContractAt("ShariaETF", SHARIA_ETF);
  const shariaDCA = await ethers.getContractAt("ShariaDCA", SHARIA_DCA);

  // Register WGLMR as Sharia-compliant
  console.log("Registering GLMR as Sharia-compliant...");
  await shariaCompliance.registerShariaCoin(
    "GLMR",
    "Glimmer",
    "GLMR",
    "Native token of Moonbeam"
  );

  // Register token addresses
  console.log("Registering token addresses...");
  await shariaSwap.registerAsset(WGLMR, "GLMR");
  await shariaETF.registerTokenAddress("GLMR", WGLMR);
  await shariaDCA.registerTokenAddress("GLMR", WGLMR);

  console.log("✅ Setup complete!");
}

main().catch(console.error);
```

Run it:
```bash
npx hardhat run setup.ts --network moonbase
```

## 🔍 Verify Contracts (Optional)

> **Note**: Moonbeam uses Etherscan API V2 for contract verification. Get your API key from [etherscan.io/mapidashboard](https://etherscan.io/apidashboard) and add it to your `.env` file as `ETHERSCAN_API_KEY`.

Verify your contracts on Moonscan:

```bash
# Make sure ETHERSCAN_API_KEY is set in your .env file
npx hardhat verify --network moonbase <CONTRACT_ADDRESS>
```

For contracts with constructor arguments:
```bash
npx hardhat verify --network moonbase <CONTRACT_ADDRESS> \
  "0x..." "0x..." "0x..."
```

**Important**: Moonbeam networks now use Etherscan API V2. The verification process is the same, but you need an Etherscan API key instead of the deprecated Moonscan API key.

## 📱 Frontend Integration

For comprehensive frontend integration examples with detailed code samples, see [README.md](./README.md#-usage).

Quick example:
```typescript
import { ethers } from "ethers";
import ShariaComplianceABI from "./artifacts/contracts/ShariaCompliance.sol/ShariaCompliance.json";

const provider = new ethers.BrowserProvider(window.ethereum);
const signer = await provider.getSigner();
const shariaCompliance = new ethers.Contract(
  "0x...", // Your deployed address
  ShariaComplianceABI.abi,
  signer
);

const coins = await shariaCompliance.getAllShariaCoins();
```

## 🛠️ Development Workflow

```bash
# Compile contracts
npm run compile

# Run tests
npm test

# Deploy to testnet
npm run deploy:testnet

# Deploy to mainnet (when ready)
npx hardhat run scripts/deploy.ts --network moonbeam

# Start local node (for testing)
npx hardhat node

# Deploy to local node
npx hardhat run scripts/deploy.ts --network localhost
```

## 📚 Resources

- **Full Documentation**: See [README.md](./README.md) for comprehensive docs, features, and usage examples
- **Migration Guide**: See [MIGRATION_GUIDE.md](./MIGRATION_GUIDE.md) for Ink! → Solidity details
- **Moonbeam Docs**: https://docs.moonbeam.network/
- **Hardhat Docs**: https://hardhat.org/docs

## 🆘 Common Issues

### "Insufficient funds"
**Solution**: Get testnet tokens from https://faucet.moonbeam.network/

### "Network not found"
**Solution**: Make sure MetaMask is connected to Moonbase Alpha:
- Network Name: Moonbase Alpha
- RPC URL: https://rpc.api.moonbase.moonbeam.network
- Chain ID: 1287
- Currency: DEV

### "Nonce too high"
**Solution**: Reset your MetaMask account:
1. Settings → Advanced
2. Clear activity tab data

### Compilation errors
**Solution**: 
```bash
rm -rf cache/ artifacts/
npm run compile
```

## ✅ Checklist

- [ ] Dependencies installed (`npm install`)
- [ ] `.env` configured with private key
- [ ] Testnet tokens received
- [ ] Contracts compiled successfully
- [ ] Tests passing
- [ ] Deployed to testnet
- [ ] Contract addresses saved
- [ ] Token addresses registered
- [ ] Contracts verified (optional)
- [ ] Frontend connected (optional)

## 🎉 You're Ready!

Once you complete these steps, your Sharia-compliant DeFi platform is live on Moonbeam!

**Next Steps:**
- Review [README.md](./README.md) for detailed usage examples and features
- Build your frontend or integrate with existing dApps
- Deploy to Moonbeam mainnet when ready

---

**Need help?** 
- Check [README.md](./README.md) for comprehensive documentation
- See [MIGRATION_GUIDE.md](./MIGRATION_GUIDE.md) for technical details
- Open an issue on GitHub

