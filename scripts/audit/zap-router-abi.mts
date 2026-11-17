/** Confirm Beefy Zap Router's function selectors exist in its deployed bytecode. */
import { toFunctionSelector, type Address } from "viem";
import { pub } from "./sim-harness.mts";

const ROUTER = "0x6F19Da51d488926C007B9eBaa5968291a2eC6a63" as Address;
const TM = "0x3fBD1da78369864c67d62c242d30983d6900c0f0" as Address;
const code = (await pub.getCode({ address: ROUTER }))!.toLowerCase();
const tmCode = (await pub.getCode({ address: TM }))!.toLowerCase();
const ORDER = "((address,uint256)[],(address,uint256)[],(address,uint256,bytes),address,address)";
const STEP = "(address,uint256,bytes,(address,int32)[])[]";
for (const [where, c, sig] of [
  ["router", code, `executeOrder(${ORDER},${STEP})`],
  ["router", code, `executeOrder(${ORDER},bytes,${STEP})`],
  ["router", code, "tokenManager()"],
  ["tokenManager", tmCode, "pullTokens(address,(address,uint256)[])"],
  ["tokenManager", tmCode, "zap()"],
] as const) {
  const sel = toFunctionSelector(sig).slice(2);
  console.log(where.padEnd(12), sig.slice(0, 60).padEnd(60), sel, c.includes(`63${sel}`) ? "FOUND" : "missing");
}
