import { ApiPromise, WsProvider } from '@polkadot/api';
import hre from "hardhat";

const { ethers } = hre;

/**
 * Verify that a contract deployed on Moonbeam mainnet
 * is accessible in the Chopsticks fork
 */
async function main() {
  const contractAddress = process.env.REMOTE_SWAP_INITIATOR_ADDRESS || '0x...';
  
  console.log('🔍 Verifying contract in Chopsticks fork...\n');
  
  // Connect to Chopsticks Moonbeam fork
  const moonbeamWs =
    process.env.MOONBEAM_FORK_WS ||
    `ws://127.0.0.1:${process.env.MOONBEAM_FORK_PORT || "9949"}`;

  const provider = new WsProvider(moonbeamWs);
  const api = await ApiPromise.create({ provider });
  await api.isReady;
  
  console.log('✅ Connected to Moonbeam fork');
  console.log(`📍 Contract address: ${contractAddress}\n`);
  
  // Method 1: Check contract code via Substrate RPC
  const accountInfo = await api.query.system.account(contractAddress);
  console.log('Account info:', accountInfo.toHuman());

  try {
    const evmModule = (api.query as any).evm;
    if (evmModule?.accountCodes) {
      const h160Address = api.createType("H160", contractAddress);
      const evmCode = await evmModule.accountCodes(h160Address);
      const hexCode = evmCode.toHex?.() || evmCode.toString();
      console.log(`\n🗄️  EVM code (substrate storage) length: ${hexCode.length} chars`);
      if (hexCode !== "0x") {
        console.log('✅ Contract bytecode found in storage (via evm.accountCodes)');
      } else {
        console.log('⚠️  No bytecode found in evm.accountCodes');
      }
    } else {
      console.log('\n⚠️  evm.accountCodes storage is not available on this fork');
    }
  } catch (error) {
    console.log('\n⚠️  Could not read evm.accountCodes:', (error as Error).message);
  }
  
  // Method 2: Check EVM contract code
  let codeLength = 0;
  try {
    const rpcEth = (api.rpc as any).eth;
    if (rpcEth && typeof rpcEth.getCode === "function") {
      const code = await rpcEth.getCode(contractAddress);
      codeLength = code.length;
      console.log(`\n📝 Contract code length: ${code.length} bytes`);
  
      if (code.length > 2) { // More than '0x'
        console.log('✅ Contract EXISTS in the fork!');
        console.log('✅ You can interact with it via Polkadot.js or ethers.js');
      } else {
        console.log('❌ Contract NOT FOUND in fork');
        console.log('💡 Make sure you forked at a block AFTER deployment');
      }
    } else {
      console.log('\n⚠️  eth_getCode RPC not available on this fork. Skipping direct EVM code check.');
    }
  } catch (error) {
    console.log('\n⚠️  Unable to read contract code via eth_getCode:', (error as Error).message);
  }
  
  // Method 3: Try reading a view function (if contract has one)
  try {
    // Example: Read shariaCompliance address from RemoteSwapInitiator
    const artifact = await hre.artifacts.readArtifact("RemoteSwapInitiator");
    const httpUrl =
      process.env.MOONBEAM_FORK_HTTP ||
      `http://127.0.0.1:${process.env.MOONBEAM_FORK_HTTP_PORT || "9946"}`;

    const network = {
      chainId: Number(process.env.CHOPSTICKS_CHAIN_ID || 1284),
      name: "chopsticks-moonbeam",
    };

    const provider = new ethers.JsonRpcProvider(httpUrl, network);
    const remoteSwapInitiator = new ethers.Contract(contractAddress, artifact.abi, provider);
    
    const shariaAddress = await remoteSwapInitiator.shariaCompliance();
    console.log(`\n✅ Successfully called contract function!`);
    console.log(`   shariaCompliance address: ${shariaAddress}`);
    if (codeLength <= 2) {
      console.log("   (Ethers call confirmed contract code even though eth_getCode was unavailable)");
    }
  } catch (error) {
    console.log('\n⚠️  Could not call contract function (might need EVM RPC support)');
    console.log(`   Error: ${(error as Error).message}`);
    console.log('   If the fork lacks eth RPC calls, rely on Substrate storage or fork newest block.');
  }
  
  await api.disconnect();
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });

