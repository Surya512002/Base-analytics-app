import { spawnSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";

function buildCollector() {
  const collectorDir = path.join(process.cwd(), "collector");
  if (!fs.existsSync(collectorDir)) {
    console.log("No collector directory found, skipping.");
    return;
  }

  // Check if `go` is available
  const checkGo = spawnSync("go", ["version"], { stdio: "ignore" });
  if (checkGo.status === 0) {
    console.log("Building Go collector...");
    const build = spawnSync("go", ["build", "-o", "collector", "."], {
      cwd: collectorDir,
      stdio: "inherit",
    });
    if (build.status !== 0) {
      console.warn("Go build returned non-zero status. Proceeding with JS fallback.");
    }
  } else {
    console.log("Skipping Go collector (go not installed — wallet sync uses JS fallback)");
  }
}

buildCollector();
