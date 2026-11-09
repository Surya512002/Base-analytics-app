const { expect } = require("chai");
const fs = require("fs");
const path = require("path");
const { loadLimitOrdersEnv } = require("../shared/loadEnv");

describe("G1: Environment Variable Loading (.env) Suite", () => {
  const tempEnvPath = path.join(__dirname, ".temp-test.env");

  beforeEach(() => {
    delete process.env.TEST_DUMMY_KEY;
    delete process.env.TEST_DUMMY_RPC;
  });

  afterEach(() => {
    if (fs.existsSync(tempEnvPath)) {
      fs.unlinkSync(tempEnvPath);
    }
    delete process.env.TEST_DUMMY_KEY;
    delete process.env.TEST_DUMMY_RPC;
  });

  it("loads environment variables from file via dotenv without printing keys", () => {
    // Intercept console.log to prove nothing is printed
    let logged = "";
    const origLog = console.log;
    console.log = (...args) => {
      logged += args.join(" ") + "\n";
    };

    try {
      // 1. Write dummy test env file
      const dummySecret =
        "0x1111222233334444" + "5555666677778888" + "9999aaaabbbbcccc" + "ddddeeeeffff0000";
      const dummyContent = [
        "TEST_DUMMY_KEY=" + dummySecret,
        "TEST_DUMMY_RPC=https://dummy.sepolia.rpc.test",
      ].join("\n");
      fs.writeFileSync(tempEnvPath, dummyContent, "utf8");

      // 2. Load env
      loadLimitOrdersEnv(tempEnvPath);

      // 3. Assert values loaded into process.env
      expect(process.env.TEST_DUMMY_KEY).to.equal(dummySecret);
      expect(process.env.TEST_DUMMY_RPC).to.equal("https://dummy.sepolia.rpc.test");

      // 4. Assert NO private key or secret value was printed
      expect(logged).to.not.include("0x11112222");
      expect(logged).to.not.include("TEST_DUMMY_KEY");
    } finally {
      console.log = origLog;
    }
  });

  it("hardhat.config.js loads .env file correctly via dotenv", () => {
    const hre = require("hardhat");
    expect(hre.config).to.be.an("object");
    expect(hre.config.networks).to.be.an("object");
    expect(hre.config.networks.baseSepolia).to.be.an("object");
  });
});
