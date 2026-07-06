import { execFile } from "node:child_process";
import { existsSync } from "node:fs";
import { promisify } from "node:util";
import path from "node:path";
import type { AlchemyTransfer } from "@/lib/types/wallet";

const execFileAsync = promisify(execFile);

export interface GoCollectResult {
  transfers: AlchemyTransfer[];
  nftLegs: number;
  nftTxCount: number;
  source: string;
  elapsedMs: number;
}

let binaryPath: string | null = null;

function resolveCollectorBinary(): string {
  if (binaryPath) return binaryPath;
  binaryPath = path.join(process.cwd(), "collector", "collector");
  return binaryPath;
}

/** Run Go parallel collector (Blockscout + optional Basescan). Returns null if binary missing. */
export async function collectWalletViaGo(
  address: string,
  pages = 4
): Promise<GoCollectResult | null> {
  if (!isGoCollectorAvailable()) return null;
  const bin = resolveCollectorBinary();
  try {
    const { stdout } = await execFileAsync(
      bin,
      [address.toLowerCase(), `--pages=${pages}`],
      {
        timeout: 18_000,
        maxBuffer: 32 * 1024 * 1024,
        env: process.env,
      }
    );
    const parsed = JSON.parse(stdout) as GoCollectResult;
    if (!Array.isArray(parsed.transfers)) return null;
    return parsed;
  } catch {
    return null;
  }
}

export function isGoCollectorAvailable(): boolean {
  try {
    return existsSync(resolveCollectorBinary());
  } catch {
    return false;
  }
}
