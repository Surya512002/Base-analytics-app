#!/usr/bin/env node
/**
 * Send Base App in-app notifications via Base Dashboard API.
 *
 * Setup (one time):
 *   1. Register app at https://dashboard.base.org
 *   2. Add BASE_DASHBOARD_API_KEY + BASE_NOTIFICATIONS_ADMIN_SECRET to .env.local
 *
 * Examples:
 *   # List opted-in users count
 *   node scripts/send-base-notification.mjs list
 *
 *   # Send B20 launch preset to all opted-in users
 *   node scripts/send-base-notification.mjs broadcast --preset b20_launch
 *
 *   # Custom message to one wallet
 *   node scripts/send-base-notification.mjs send 0xYourWallet --title "B20 is Live" --message "Launch & trade B20 on Base Analytics"
 */
import { readFileSync, existsSync } from "fs";
import { resolve, dirname } from "path";
import { fileURLToPath } from "url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = resolve(__dirname, "..");

function loadEnvFile(path) {
  if (!existsSync(path)) return;
  for (const line of readFileSync(path, "utf8").split("\n")) {
    const t = line.trim();
    if (!t || t.startsWith("#")) continue;
    const i = t.indexOf("=");
    if (i <= 0) continue;
    const key = t.slice(0, i).trim();
    let val = t.slice(i + 1).trim();
    if ((val.startsWith('"') && val.endsWith('"')) || (val.startsWith("'") && val.endsWith("'"))) {
      val = val.slice(1, -1);
    }
    if (!process.env[key]) process.env[key] = val;
  }
}

loadEnvFile(resolve(root, ".env.local"));
loadEnvFile(resolve(root, ".env"));

const APP_URL =
  process.env.BASE_APP_REGISTERED_URL?.trim() ||
  process.env.NEXT_PUBLIC_APP_URL?.trim() ||
  "https://base-analytics-app.vercel.app";

const API = "https://dashboard.base.org/api/v1/notifications";
const KEY = process.env.BASE_DASHBOARD_API_KEY?.trim();

const B20_PRESET = {
  title: "B20 Launch is Live 🚀",
  message:
    "Create your 0xB20 token, explore trending B20 & swap in-app on Base Analytics. Tap to launch or trade now.",
  target_path: "/?tab=launchpad",
};

function usage() {
  console.log(`
Usage:
  node scripts/send-base-notification.mjs list
  node scripts/send-base-notification.mjs broadcast [--preset b20_launch] [--title T] [--message M] [--path /?tab=launchpad]
  node scripts/send-base-notification.mjs send <0xWallet> [--preset b20_launch] [--title T] [--message M] [--path /?tab=launchpad]

Requires BASE_DASHBOARD_API_KEY in .env.local
`);
}

async function api(path, init) {
  const res = await fetch(`${API}${path}`, {
    ...init,
    headers: {
      "Content-Type": "application/json",
      "x-api-key": KEY,
      ...(init?.headers ?? {}),
    },
  });
  const text = await res.text();
  let data;
  try {
    data = JSON.parse(text);
  } catch {
    data = { raw: text };
  }
  if (!res.ok) {
    throw new Error(data.error || data.raw || `HTTP ${res.status}`);
  }
  return data;
}

async function listOptedIn() {
  const addresses = [];
  let cursor;
  do {
    const qs = new URLSearchParams({ app_url: APP_URL, notification_enabled: "true", limit: "100" });
    if (cursor) qs.set("cursor", cursor);
    const page = await api(`/app/users?${qs}`, { method: "GET" });
    for (const u of page.users ?? []) {
      if (u.notificationsEnabled) addresses.push(u.address);
    }
    cursor = page.nextCursor;
  } while (cursor);
  return [...new Set(addresses)];
}

function parseArgs(argv) {
  const args = { preset: null, title: "", message: "", path: "", wallet: null };
  const rest = [...argv];
  const cmd = rest.shift();

  for (let i = 0; i < rest.length; i++) {
    const a = rest[i];
    if (a === "--preset" && rest[i + 1]) {
      args.preset = rest[++i];
    } else if (a === "--title" && rest[i + 1]) {
      args.title = rest[++i];
    } else if (a === "--message" && rest[i + 1]) {
      args.message = rest[++i];
    } else if (a === "--path" && rest[i + 1]) {
      args.path = rest[++i];
    } else if (a.startsWith("0x")) {
      args.wallet = a;
    }
  }

  if (args.preset === "b20_launch") {
    args.title = B20_PRESET.title;
    args.message = B20_PRESET.message;
    args.path = B20_PRESET.target_path;
  }

  return { cmd, ...args };
}

async function send(wallets, title, message, targetPath) {
  const body = {
    app_url: APP_URL,
    wallet_addresses: wallets,
    title: title.slice(0, 30),
    message: message.slice(0, 200),
  };
  if (targetPath) body.target_path = targetPath.startsWith("/") ? targetPath : `/${targetPath}`;
  return api("/send", { method: "POST", body: JSON.stringify(body) });
}

async function main() {
  if (!KEY) {
    console.error("Set BASE_DASHBOARD_API_KEY in .env.local");
    process.exit(1);
  }

  const { cmd, wallet, title, message, path } = parseArgs(process.argv.slice(2));

  if (!cmd || cmd === "help" || cmd === "-h") {
    usage();
    return;
  }

  if (cmd === "list") {
    const users = await listOptedIn();
    console.log(`Opted-in users: ${users.length}`);
    console.log(users.slice(0, 20).join("\n"));
    return;
  }

  if (cmd === "broadcast") {
    if (!title || !message) {
      console.error("Provide --preset b20_launch or --title and --message");
      process.exit(1);
    }
    const users = await listOptedIn();
    if (!users.length) {
      console.log("No opted-in users yet — ask Base App users to pin the app first.");
      return;
    }
    console.log(`Broadcasting to ${users.length} wallets…`);
    let sent = 0;
    let failed = 0;
    for (let i = 0; i < users.length; i += 1000) {
      const chunk = users.slice(i, i + 1000);
      const r = await send(chunk, title, message, path);
      sent += r.sentCount ?? 0;
      failed += r.failedCount ?? 0;
      console.log(`Batch ${Math.floor(i / 1000) + 1}: sent=${r.sentCount} failed=${r.failedCount}`);
      if (i + 1000 < users.length) await new Promise((r) => setTimeout(r, 3200));
    }
    console.log(`Done. sent=${sent} failed=${failed}`);
    return;
  }

  if (cmd === "send") {
    if (!wallet) {
      console.error("Provide wallet address: send 0x...");
      process.exit(1);
    }
    if (!title || !message) {
      console.error("Provide --preset b20_launch or --title and --message");
      process.exit(1);
    }
    const r = await send([wallet], title, message, path);
    console.log(JSON.stringify(r, null, 2));
    return;
  }

  usage();
  process.exit(1);
}

main().catch((e) => {
  console.error(e.message || e);
  process.exit(1);
});
