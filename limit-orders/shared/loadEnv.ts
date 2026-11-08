import path from "path";
import dotenv from "dotenv";

export function loadLimitOrdersEnv(customPath?: string) {
  const envPath = customPath || path.resolve(__dirname, "../.env");
  return dotenv.config({ path: envPath });
}

loadLimitOrdersEnv();
