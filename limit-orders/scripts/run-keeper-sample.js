const { spawn } = require("child_process");
const path = require("path");

const env = {
  ...process.env,
  CHAIN: "baseSepolia",
  RPC_URL: "https://sepolia.base.org",
  ORDER_BOOK: "0xC7fBA8EB5442760F83266C32F3Bc2E5c65079e46",
};

const tsxPath = path.resolve(__dirname, "../node_modules/tsx/dist/cli.mjs");
const keeperProc = spawn(process.execPath, [tsxPath, "keeper/keeper.ts"], {
  cwd: path.resolve(__dirname, ".."),
  env,
  stdio: ["ignore", "pipe", "pipe"],
});

let output = "";
keeperProc.stdout.on("data", (data) => {
  const s = data.toString();
  output += s;
  process.stdout.write(s);
});
keeperProc.stderr.on("data", (data) => {
  const s = data.toString();
  output += s;
  process.stderr.write(s);
});

setTimeout(() => {
  try {
    keeperProc.kill("SIGTERM");
  } catch {}
  setTimeout(() => {
    try {
      keeperProc.kill("SIGKILL");
    } catch {}
    process.exit(0);
  }, 1000);
}, 6000);
