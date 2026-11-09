import { spawnSync } from "child_process";

process.env.NEXT_PUBLIC_LIMIT_ORDERS_ENABLED = "true";
process.env.NEXT_PUBLIC_BASE_SEPOLIA_RPC = "https://sepolia.base.org";
process.env.NEXT_PUBLIC_LIMIT_ORDER_BOOK_SEPOLIA = "0xC7fBA8EB5442760F83266C32F3Bc2E5c65079e46";
process.env.NEXT_PUBLIC_LIMIT_ORDER_QUOTE_SEPOLIA = "0x19468e9fe5dBfdbD786D9b09Da7caC07c1367187";
process.env.NEXT_PUBLIC_LIMIT_ORDER_STOCK_SEPOLIA = "0xCCc66590BA8a67fe51bC2eB552B24f30c30263F2";
process.env.NEXT_PUBLIC_LIMIT_ORDER_FEED_SEPOLIA = "0x3e5336e32663A387063462F7462B34B8039E8B61";
process.env.NEXT_PUBLIC_LIMIT_ORDER_ADAPTER_SEPOLIA = "0x2863b668b8dCe0C538A7b6a1889e23933C3F8150";

console.log("Starting Next.js Production Build with Pro Orders & Active CSP...");
const res = spawnSync("npx", ["next", "build"], {
  stdio: "inherit",
  shell: true,
  env: process.env,
});

process.exit(res.status ?? 0);
