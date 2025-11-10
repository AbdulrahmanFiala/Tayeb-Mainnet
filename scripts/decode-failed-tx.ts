import hre from "hardhat";
import type { ErrorDescription } from "ethers";
import * as dotenv from "dotenv";
import * as fs from "fs";
import * as path from "path";

dotenv.config();

const { ethers } = hre;

async function main() {
  // Get transaction hash from environment or use default
  const txHash = process.env.TX_HASH || process.argv[2];
  
  if (!txHash || txHash === "") {
    console.log("Usage:");
    console.log("  TX_HASH=0x... npx hardhat run scripts/decode-failed-tx.ts --network moonbeam");
    console.log();
    console.log("Example:");
    console.log("  TX_HASH=0x773aac5810a73346407eccc695b23aa9197653b4d306effe58f2714683509a23 npx hardhat run scripts/decode-failed-tx.ts --network moonbeam");
    process.exit(1);
  }

  console.log("🔍 Decoding Transaction\n");
  console.log("Transaction Hash:", txHash);
  console.log();

  try {
    // Get transaction receipt
    const receipt = await ethers.provider.getTransactionReceipt(txHash);
    
    if (!receipt) {
      console.log("❌ Transaction not found or not yet mined");
      console.log("   Make sure the transaction hash is correct and the transaction has been mined");
      return;
    }

    console.log("📋 Transaction Details:");
    console.log("  Status:", receipt.status === 1 ? "✅ Success" : "❌ Failed/Reverted");
    console.log("  From:", receipt.from);
    console.log("  To:", receipt.to);
    console.log("  Block:", receipt.blockNumber);
    console.log("  Gas Used:", receipt.gasUsed.toString());
    if (receipt.gasPrice) {
      console.log("  Gas Price:", ethers.formatUnits(receipt.gasPrice, "gwei"), "gwei");
    }
    console.log();

    if (receipt.status === 1) {
      console.log("✅ Transaction was successful!");
      console.log();
      console.log("Events emitted:");
      for (const log of receipt.logs) {
        console.log(`  - ${log.address}: ${log.topics[0]}`);
      }
      return;
    }

    // Transaction failed - get more details
    console.log("❌ Transaction Failed - Analyzing...\n");

    // Get the transaction
    const tx = await ethers.provider.getTransaction(txHash);
    if (!tx) {
      console.log("⚠️ Transaction not found on the current RPC endpoint");
      return;
    }
    console.log("📋 Transaction Data:");
    console.log("  Value:", ethers.formatEther(tx.value || 0), "native token");
    console.log("  Data length:", tx.data.length, "bytes");
    console.log();

    // Try to decode the function call
    if (receipt.to) {
      await decodeFunctionCall(tx, receipt);
    } else {
      console.log("⚠️  Contract creation transaction");
      console.log("  Contract address:", receipt.contractAddress);
    }

    // Try to get revert reason
    console.log("\n🔄 Attempting to get revert reason...");
    try {
      if (receipt.to) {
        const code = await ethers.provider.getCode(receipt.to);
        if (code && code !== "0x") {
          // Try to call the transaction to get error
          await ethers.provider.call({
            to: receipt.to,
            data: tx.data,
            from: receipt.from,
            value: tx.value,
          });
          console.log("  ⚠️  Transaction simulation succeeded (unexpected)");
        } else {
          console.log("  ⚠️  Contract code not found");
        }
      }
    } catch (error: any) {
      console.log("  ✅ Revert reason:");
      console.log("  Error:", error.message);
      
      if (error.data && error.data !== "0x") {
        console.log("  Error data:", error.data);
        await decodeErrorData(error.data);
      }
      
      // Try to extract reason from error message
      if (error.reason) {
        console.log("  Reason:", error.reason);
      }
      
      // Try to extract from error message
      const reasonMatch = error.message?.match(/reason="([^"]+)"/);
      if (reasonMatch) {
        console.log("  Extracted reason:", reasonMatch[1]);
      }
    }
    console.log();

  } catch (error: any) {
    console.error("❌ Error:", error.message);
    if (error.reason) {
      console.error("Reason:", error.reason);
    }
    console.error("\nStack:", error.stack);
  }
}

async function decodeFunctionCall(tx: any, receipt: any) {
  console.log("🎯 Contract Address:", receipt.to);
  console.log();

  // Try to find contract artifact
  const artifactsDir = path.join(__dirname, "..", "artifacts", "contracts");
  let decoded: any = null;
  let contractName = "Unknown";
  const functionSelector = tx.data.substring(0, 10);

  if (fs.existsSync(artifactsDir)) {
    // Try to find matching contract by trying to decode with each artifact
    const contractFiles = findContractFiles(artifactsDir);
    
    console.log(`  Searching ${contractFiles.length} contract artifacts...`);
    
    // First pass: Try direct decoding
    for (const contractFile of contractFiles) {
      try {
        const artifact = JSON.parse(fs.readFileSync(contractFile, "utf-8"));
        
        if (!artifact.abi || !Array.isArray(artifact.abi)) {
          continue;
        }
        
        const iface = new ethers.Interface(artifact.abi);
        
        try {
          const parsed = iface.parseTransaction({ data: tx.data, value: tx.value });
          decoded = parsed;
          // Extract contract name from path (e.g., "ShariaSwap.sol/ShariaSwap.json" -> "ShariaSwap")
          const pathParts = contractFile.split(path.sep);
          const solFile = pathParts[pathParts.length - 2];
          contractName = solFile.replace(".sol", "");
          break;
        } catch (e) {
          // Not this contract's function, try next
        }
      } catch (e) {
        // Skip invalid files
      }
    }
    
    // Second pass: If direct decoding failed, try to match by selector
    if (!decoded) {
      const matchingFunctions: string[] = [];
      
      for (const contractFile of contractFiles) {
        try {
          const artifact = JSON.parse(fs.readFileSync(contractFile, "utf-8"));
          if (!artifact.abi || !Array.isArray(artifact.abi)) continue;
          
          const pathParts = contractFile.split(path.sep);
          const solFile = pathParts[pathParts.length - 2];
          const fileContractName = solFile.replace(".sol", "");
          
          // Check all functions in this contract
          for (const func of artifact.abi) {
            if (func.type === "function") {
              try {
                const funcSig = `${func.name}(${func.inputs.map((i: any) => i.type).join(",")})`;
                const computedSelector = ethers.id(funcSig).substring(0, 10);
                if (computedSelector === functionSelector) {
                  matchingFunctions.push(`${fileContractName}.${funcSig}`);
                  
                  // Try to decode with this specific contract
                  if (!decoded) {
                    try {
                      const iface = new ethers.Interface(artifact.abi);
                      const parsed = iface.parseTransaction({ data: tx.data, value: tx.value });
                      decoded = parsed;
                      contractName = fileContractName;
                    } catch (e) {
                      // Decode failed
                    }
                  }
                }
              } catch (e) {
                // Skip
              }
            }
          }
        } catch (e) {
          // Skip
        }
      }
      
      if (matchingFunctions.length > 0 && !decoded) {
        console.log("  ⚠️  Function selector matches but decoding failed");
        console.log("  ✅ Found matching function(s):");
        matchingFunctions.forEach(func => console.log(`    - ${func}`));
        console.log("  This might indicate wrong parameter types or malformed data");
      }
    }
  }

  if (decoded) {
    console.log("📝 Function Call Analysis:");
    console.log("  Contract:", contractName);
    console.log("  Function:", decoded.name);
    
    // Get function signature for reference
    const functionFragment = decoded.fragment;
    if (functionFragment) {
      console.log("  Signature:", functionFragment.format());
    }
    
    console.log("  Parameters:");
    decoded.args.forEach((arg: any, i: number) => {
      const paramName = functionFragment?.inputs[i]?.name || `param${i}`;
      const paramType = functionFragment?.inputs[i]?.type || "unknown";
      const paramInfo = formatParameter(arg);
      console.log(`    [${i}] ${paramName} (${paramType}): ${paramInfo}`);
    });
  } else {
    console.log("⚠️  Could not decode function call");
    console.log("  Function selector:", functionSelector);
    console.log("  Data:", tx.data.substring(0, 50) + "...");
    console.log("  To decode, ensure contract artifacts exist in artifacts/contracts/");
    console.log("  Or the contract may not be in this project");
  }
}

function findContractFiles(dir: string): string[] {
  const files: string[] = [];
  
  function traverse(currentDir: string) {
    const entries = fs.readdirSync(currentDir, { withFileTypes: true });
    
    for (const entry of entries) {
      const fullPath = path.join(currentDir, entry.name);
      
      if (entry.isDirectory()) {
        traverse(fullPath);
      } else if (entry.name.endsWith(".json") && !entry.name.includes(".dbg")) {
        // Check if it's an artifact file (has abi)
        try {
          const content = JSON.parse(fs.readFileSync(fullPath, "utf-8"));
          if (content.abi && Array.isArray(content.abi)) {
            files.push(fullPath);
          }
        } catch (e) {
          // Not a valid JSON or artifact
        }
      }
    }
  }
  
  traverse(dir);
  return files;
}

function formatParameter(arg: any): string {
  if (typeof arg === 'string') {
    if (arg.startsWith('0x') && arg.length === 42) {
      return arg;
    } else if (arg.length > 0 && arg.length < 100) {
      return `"${arg}"`;
    } else {
      return `"${arg.substring(0, 50)}..."`;
    }
  } else if (typeof arg === 'bigint') {
    // Try to format as ether if it's a reasonable size
    try {
      const asEther = ethers.formatEther(arg);
      if (asEther.includes('.')) {
        const parts = asEther.split('.');
        if (parts[1].length <= 6 && !parts[0].includes('e')) {
          return `${arg.toString()} (${asEther} native tokens)`;
        }
      }
      return arg.toString();
    } catch (e) {
      return arg.toString();
    }
  } else if (typeof arg === 'boolean') {
    return arg.toString();
  } else if (Array.isArray(arg)) {
    return `[${arg.length} items]`;
  } else {
    return String(arg);
  }
}

async function decodeErrorData(errorData: string) {
  console.log("\n🔍 Decoding Error Data:");
  
  // Standard Solidity errors
  const standardErrors = [
    "error Error(string)",
    "error Panic(uint256)",
  ];

  // Try to decode as standard error
  const standardIface = new ethers.Interface(standardErrors);
  
  try {
    const decoded = standardIface.parseError(errorData) as ErrorDescription | null;
    if (!decoded) {
      console.log("  Unable to decode error with standard selectors");
      return;
    }
    console.log("  ✅ Decoded error:", decoded.name);
    if (decoded.args && decoded.args.length > 0) {
      console.log("  Args:", decoded.args);
      
      // If it's Error(string), show the message
      if (decoded.name === "Error" && decoded.args[0]) {
        console.log("  Error message:", decoded.args[0]);
      }
      
      // If it's Panic, show panic code meaning
      if (decoded.name === "Panic" && decoded.args[0]) {
        const panicCode = Number(decoded.args[0]);
        const panicMessages: Record<number, string> = {
          0x01: "assert(false)",
          0x11: "arithmetic underflow/overflow",
          0x12: "division/modulo by zero",
          0x21: "converted enum value out of bounds",
          0x22: "incorrectly encoded storage byte array",
          0x31: "pop() on empty array",
          0x32: "out-of-bounds array access",
          0x41: "too much memory allocated",
          0x51: "zero-initialized variable of internal function type",
        };
        if (panicMessages[panicCode]) {
          console.log("  Panic reason:", panicMessages[panicCode]);
        }
      }
    }
    return;
  } catch (e) {
    // Not a standard error, continue
  }

  // Try to find custom errors in artifacts
  const artifactsDir = path.join(__dirname, "..", "artifacts", "contracts");
  if (fs.existsSync(artifactsDir)) {
    const contractFiles = findContractFiles(artifactsDir);
    const errorSelector = errorData.substring(0, 10);
    
    for (const contractFile of contractFiles) {
      try {
        const artifact = JSON.parse(fs.readFileSync(contractFile, "utf-8"));
        const iface = new ethers.Interface(artifact.abi);
        
        try {
          const decoded = iface.parseError(errorData) as ErrorDescription | null;
          if (!decoded) {
            continue;
          }
          console.log("  ✅ Decoded error:", decoded.name);
          console.log("  From contract:", path.basename(contractFile, ".json"));
          if (decoded.args && decoded.args.length > 0) {
            console.log("  Args:", decoded.args);
          }
          return;
        } catch (e) {
          // Not this contract's error
        }
      } catch (e) {
        // Skip
      }
    }
  }

  // Couldn't decode
  console.log("  ⚠️  Could not decode error (custom error or require)");
  console.log("  Raw data:", errorData);
  
  const errorSelector = errorData.substring(0, 10);
  console.log("  Error selector:", errorSelector);
  
  const errorMap: Record<string, string> = {
    "0x08c379a0": "Error(string) - Standard Solidity error",
    "0x4e487b71": "Panic(uint256) - Solidity panic",
  };
  
  if (errorMap[errorSelector]) {
    console.log("  Type:", errorMap[errorSelector]);
    // Try to decode Error(string)
    if (errorSelector === "0x08c379a0") {
      try {
        const decoded = ethers.AbiCoder.defaultAbiCoder().decode(["string"], "0x" + errorData.substring(10));
        console.log("  Error message:", decoded[0]);
      } catch (e) {
        // Couldn't decode
      }
    }
  }
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error("❌ Script failed:", error);
    if (error.reason) {
      console.error("Reason:", error.reason);
    }
    process.exit(1);
  });
