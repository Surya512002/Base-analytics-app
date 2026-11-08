require("@nomicfoundation/hardhat-toolbox");
const { subtask } = require("hardhat/config");
const { TASK_COMPILE_SOLIDITY_GET_SOLC_BUILD } = require("hardhat/builtin-tasks/task-names");

// Use the solc-js npm package so compilation works without downloading native compilers.
// If you have internet access to binaries.soliditylang.org you can delete this block.
subtask(TASK_COMPILE_SOLIDITY_GET_SOLC_BUILD, async (args, hre, runSuper) => {
  if (args.solcVersion === "0.8.24") {
    const solc = require("solc");
    return {
      compilerPath: require.resolve("solc/soljson.js"),
      isSolcJs: true,
      version: args.solcVersion,
      longVersion: solc.version(),
    };
  }
  return runSuper();
});

// Load limit-orders/.env via dotenv
const path = require("path");
require("dotenv").config({ path: path.join(__dirname, ".env") });

const PK = process.env.DEPLOYER_PK ? [process.env.DEPLOYER_PK] : [];

/** @type import('hardhat/config').HardhatUserConfig */
module.exports = {
  solidity: {
    version: "0.8.24",
    settings: { optimizer: { enabled: true, runs: 200 }, evmVersion: "cancun" },
  },
  networks: {
    hardhat: {
      chains: {
        8453: {
          hardforkHistory: {
            cancun: 0,
          },
        },
      },
    },
    base: { url: process.env.BASE_RPC_URL || "https://mainnet.base.org", accounts: PK, chainId: 8453 },
    baseSepolia: { url: process.env.BASE_SEPOLIA_RPC_URL || "https://sepolia.base.org", accounts: PK, chainId: 84532 },
  },
};
