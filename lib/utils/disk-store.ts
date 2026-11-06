import fs from "fs";
import path from "path";

const DATA_DIR = path.join(process.cwd(), ".data");

function ensureDir(): boolean {
  try {
    if (!fs.existsSync(DATA_DIR)) {
      fs.mkdirSync(DATA_DIR, { recursive: true });
    }
    return true;
  } catch {
    return false;
  }
}

/**
 * Safely read a JSON file from the local .data directory.
 * Returns `fallback` if file doesn't exist or parsing fails.
 */
export function readDiskJson<T>(filename: string, fallback: T): T {
  try {
    const file = path.join(DATA_DIR, filename);
    if (!fs.existsSync(file)) return fallback;
    const raw = fs.readFileSync(file, "utf8");
    return raw ? (JSON.parse(raw) as T) : fallback;
  } catch {
    return fallback;
  }
}

/**
 * Safely write a JSON file to the local .data directory.
 * Returns true on success, false if disk is not writable (e.g. read-only serverless).
 */
export function writeDiskJson<T>(filename: string, data: T): boolean {
  try {
    if (!ensureDir()) return false;
    const file = path.join(DATA_DIR, filename);
    fs.writeFileSync(file, JSON.stringify(data, null, 2), "utf8");
    return true;
  } catch {
    return false;
  }
}
