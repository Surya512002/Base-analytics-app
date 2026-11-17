/** Probe Beefy's Zap Router on Base: deployed? token manager? */
import { parseAbi, type Address } from "viem";
import { pub } from "./sim-harness.mts";

const ROUTER = "0x6F19Da51d488926C007B9eBaa5968291a2eC6a63" as Address;
const code = await pub.getCode({ address: ROUTER });
console.log("router code bytes:", code ? (code.length - 2) / 2 : 0);
for (const sig of ["function tokenManager() view returns (address)", "function owner() view returns (address)", "function paused() view returns (bool)"]) {
  const fn = sig.match(/function (\w+)/)![1];
  try {
    console.log(fn, await pub.readContract({ address: ROUTER, abi: parseAbi([sig]), functionName: fn as never }));
  } catch (e) {
    console.log(fn, "ERR", (e as Error).message.split("\n")[0].slice(0, 80));
  }
}
