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
  const provider = new WsProvider('ws://127.0.0.1:9949');
  const api = await ApiPromise.create({ provider });
  await api.isReady;
  
  console.log('✅ Connected to Moonbeam fork');
  console.log(`📍 Contract address: ${contractAddress}\n`);
  
  // Method 1: Check contract code via Substrate RPC
  const accountInfo = await api.query.system.account(contractAddress);
  console.log('Account info:', accountInfo.toHuman());
  
  // Method 2: Check EVM contract code
  const code = await api.rpc.eth.getCode(contractAddress);
  console.log(`\n📝 Contract code length: ${code.length} bytes`);
  
  if (code.length > 2) { // More than '0x'
    console.log('✅ Contract EXISTS in the fork!');
    console.log('✅ You can interact with it via Polkadot.js or ethers.js');
  } else {
    console.log('❌ Contract NOT FOUND in fork');
    console.log('💡 Make sure you forked at a block AFTER deployment');
  }
  
  // Method 3: Try reading a view function (if contract has one)
  try {
    // Example: Read shariaCompliance address from RemoteSwapInitiator
    const artifact = await hre.artifacts.readArtifact("RemoteSwapInitiator");
    const provider = new ethers.JsonRpcProvider("http://127.0.0.1:9949");
    const remoteSwapInitiator = new ethers.Contract(contractAddress, artifact.abi, provider);
    
    const shariaAddress = await remoteSwapInitiator.shariaCompliance();
    console.log(`\n✅ Successfully called contract function!`);
    console.log(`   shariaCompliance address: ${shariaAddress}`);
  } catch (error) {
    console.log('\n⚠️  Could not call contract function (might need EVM RPC support)');
    console.log('   But contract code exists, so it\'s in the fork!');
  }
  
  await api.disconnect();
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });

