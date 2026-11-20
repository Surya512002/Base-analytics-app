/**
 * Mainnet deployment REHEARSAL on a local fork of Base. No real transactions, no keys.
 *
 * Runs the exact production deploy path (scripts/deploy.js with the mainnet canary profile and a Safe owner),
 * then trades through the REAL Uniswap pools and REAL Chainlink feeds for the coin markets:
 *   1. Safe accepts ownership of both contracts (2-step)
 *   2. Alice wraps ETH and runs a recurring SELL of WETH -> USDC (fills immediately at the live oracle price)
 *   3. Alice runs a recurring BUY of cbBTC with that USDC
 *   4. Escrow ceilings, guardian pause, and cancel-while-paused are exercised
 * Tokenized stocks (B20 precompile, 0xef bytecode) cannot run on a local EVM, see test-fork/ for the mocked version.
 *
 *   npx hardhat run scripts/fork-rehearsal.js
 *   BASE_FORK_RPC=https://your-rpc npx hardhat run scripts/fork-rehearsal.js
 */
const { ethers, network } = require("hardhat");
const path = require("path");

const FORK_RPC = process.env.BASE_FORK_RPC || "https://mainnet.base.org";
const WETH = "0x4200000000000000000000000000000000000006";
const CBBTC = "0xcbB7C0000aB88B473b1f5aFd9ef808440eed33Bf";
const USDC = "0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913";

function check(cond, msg) {
  if (!cond) throw new Error(`REHEARSAL FAILED: ${msg}`);
  console.log(`  ✔ ${msg}`);
}

async function main() {
  console.log(`Forking Base mainnet from ${FORK_RPC} ...`);
  await network.provider.request({ method: "hardhat_reset", params: [{ forking: { jsonRpcUrl: FORK_RPC } }] });
  const [deployer, safe, guardian, alice, keeper] = await ethers.getSigners();

  // ---- 1. Production deploy path with the canary profile
  process.env.DEPLOY_CONFIG = path.join(__dirname, "../config/mainnet-canary.json");
  process.env.OWNER_ADDRESS = safe.address;
  process.env.GUARDIAN_ADDRESS = guardian.address;
  process.env.QUOTE_TOKEN = USDC; // forces the real-config path instead of the mock dry run
  const { deployAll } = require("./deployLib");
  const cfgFull = require(process.env.DEPLOY_CONFIG);
  // B20 stock tokens use a Coinbase op-geth precompile (0xef bytecode) that local EVMs cannot execute.
  const cfg = { ...cfgFull, markets: cfgFull.markets.filter((m) => m.kind === "coin") };
  console.log(`Rehearsing coin markets: ${cfg.markets.map((m) => m.symbol).join(", ")} (stocks skipped: ${cfgFull.markets.filter((m) => m.kind !== "coin").map((m) => m.symbol).join(", ")})`);
  const { book, adapter, pendingOwner } = await deployAll({
    quoteToken: USDC,
    router: cfg.router,
    keeperFeeBps: cfg.keeperFeeBps,
    owner: safe.address,
    guardian: guardian.address,
    keepers: [keeper.address],
    sequencerUptimeFeed: cfgFull.sequencerUptimeFeed,
    markets: cfg.markets,
  });
  console.log(`\nDeployed book ${book.target}, adapter ${adapter.target}`);
  check(pendingOwner === safe.address, "ownership offered to the Safe");
  await (await book.connect(safe).acceptOwnership()).wait();
  await (await adapter.connect(safe).acceptOwnership()).wait();
  check((await book.owner()) === safe.address && (await adapter.owner()) === safe.address, "Safe accepted ownership of both contracts");
  let instantDrainBlocked = false;
  try {
    await book.connect(safe).setMarket.staticCall(WETH, cfg.markets[0].feed, 3600, alice.address, 1n, 1n, 150, true);
  } catch {
    instantDrainBlocked = true;
  }
  check(instantDrainBlocked, "the Safe cannot swap a live market's adapter without the 2-day timelock");
  check((await book.guardian()) === guardian.address, "guardian set");
  check((await book.keeperOnly()) && (await book.isKeeper(keeper.address)), "only the allowlisted keeper can execute");
  check((await book.sequencerUptimeFeed()) === cfgFull.sequencerUptimeFeed, "Base sequencer uptime check is live");

  for (const m of cfg.markets) {
    const mk = await book.markets(m.stockToken);
    check(mk.enabled && mk.maxQuoteIn === BigInt(m.maxQuoteIn), `${m.symbol} wired with canary caps ($${Number(m.maxQuoteIn) / 1e6} per order)`);
  }

  // ---- 2. Recurring SELL of WETH through the real 0.3% pool at the live Chainlink price
  const weth = await ethers.getContractAt(["function deposit() payable", "function approve(address,uint256) returns (bool)", "function balanceOf(address) view returns (uint256)"], WETH);
  const usdc = await ethers.getContractAt(["function approve(address,uint256) returns (bool)", "function balanceOf(address) view returns (uint256)"], USDC);
  const cbbtc = await ethers.getContractAt(["function balanceOf(address) view returns (uint256)"], CBBTC);

  const wethMarket = cfg.markets.find((m) => m.symbol === "WETH");
  const perSell = BigInt(wethMarket.maxStockIn) / 2n; // two sales fit the per-plan cap
  await (await weth.connect(alice).deposit({ value: perSell * 2n })).wait();
  await (await weth.connect(alice).approve(book.target, perSell * 2n)).wait();
  const [price] = await book.currentPrice(WETH);
  console.log(`\nLive ETH/USD oracle: $${(Number(price) / 1e8).toFixed(2)}`);

  await (await book.connect(alice).createDcaSell(WETH, perSell, 2, 3600, 0)).wait();
  check((await book.stockEscrowed(WETH)) === perSell * 2n, "WETH sell plan escrowed");
  check(await book.canExecuteDca(1), "first sale is due immediately");
  let strangerBlocked = false;
  try {
    await book.connect(alice).executeDca.staticCall(1);
  } catch {
    strangerBlocked = true;
  }
  check(strangerBlocked, "a non-keeper cannot execute (no atomic sandwich)");
  const usdcBefore = await usdc.balanceOf(alice.address);
  await (await book.connect(keeper).executeDca(1)).wait();
  const got = (await usdc.balanceOf(alice.address)) - usdcBefore;
  const ideal = (Number(perSell) / 1e18) * (Number(price) / 1e8);
  const shortfall = (1 - Number(got) / 1e6 / ideal) * 100;
  console.log(`  sold ${(Number(perSell) / 1e18).toFixed(5)} WETH for ${(Number(got) / 1e6).toFixed(4)} USDC (shortfall vs oracle ${shortfall.toFixed(2)}%, incl. 0.3% pool fee + 0.1% keeper fee)`);
  check(got > 0n && shortfall < 1.5, "real Uniswap fill within the market oracle bound (1.5%)");

  // ---- 3. Recurring BUY of cbBTC with that USDC through the real 0.05% pool
  const perBuy = got / 2n;
  await (await usdc.connect(alice).approve(book.target, perBuy * 2n)).wait();
  await (await book.connect(alice).createDca(CBBTC, perBuy, 2, 3600, 0)).wait();
  const btcBefore = await cbbtc.balanceOf(alice.address);
  await (await book.connect(keeper).executeDca(2)).wait();
  const btcGot = (await cbbtc.balanceOf(alice.address)) - btcBefore;
  console.log(`  bought ${(Number(btcGot) / 1e8).toFixed(8)} cbBTC for ${(Number(perBuy) / 1e6).toFixed(4)} USDC`);
  check(btcGot > 0n, "real cbBTC buy filled");

  // ---- 4. Ceilings, guardian, always-exit
  const ceiling = BigInt(wethMarket.maxStockEscrow);
  const escrowed = await book.stockEscrowed(WETH);
  check(escrowed <= ceiling, `WETH escrow ${escrowed} within ceiling ${ceiling}`);

  await (await book.connect(guardian).pause()).wait();
  check(await book.paused(), "guardian paused the book");
  let blocked = false;
  try {
    await book.connect(alice).createDcaSell.staticCall(WETH, 1n, 1, 3600, 0);
  } catch {
    blocked = true;
  }
  check(blocked, "new plans are blocked while paused");
  const wethBefore = await weth.balanceOf(alice.address);
  await (await book.connect(alice).cancelDca(1)).wait();
  await (await book.connect(alice).cancelDca(2)).wait();
  check((await weth.balanceOf(alice.address)) - wethBefore === perSell, "cancel while paused refunded the unsold WETH");
  check((await book.stockEscrowed(WETH)) === 0n && (await book.quoteEscrowed(CBBTC)) === 0n, "escrow accounting back to zero");
  let guardianCantUnpause = false;
  try {
    await book.connect(guardian).unpause.staticCall();
  } catch {
    guardianCantUnpause = true;
  }
  check(guardianCantUnpause, "guardian cannot unpause");
  await (await book.connect(safe).unpause()).wait();
  check(!(await book.paused()), "Safe unpaused");

  console.log("\nREHEARSAL PASSED: the mainnet deploy path works against real Base pools and feeds.");
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
