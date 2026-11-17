/**
 * Secret leak scan: does any value from .env.local appear in the client bundle
 * (.next/static) or in public/? Prints variable NAMES and a yes/no only, never values.
 *
 *   npm run build && node scripts/audit/secret-leak-scan.mjs
 */
import fs from "node:fs";
import path from "node:path";

const envFile = process.argv[2] || ".env.local";
if (!fs.existsSync(envFile)) {
  console.log(`no ${envFile}; nothing to scan`);
  process.exit(0);
}
const vars = [];
for (const line of fs.readFileSync(envFile, "utf8").split(/\r?\n/)) {
  const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/);
  if (!m) continue;
  const value = m[2].replace(/^["']|["']$/g, "");
  // Skip short / non-secret-looking values (flags, numbers, addresses are public anyway).
  if (value.length < 12 || /^(true|false|\d+)$/i.test(value) || /^0x[0-9a-fA-F]{40}$/.test(value)) continue;
  vars.push({ name: m[1], value });
}

function* walk(dir) {
  if (!fs.existsSync(dir)) return;
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, e.name);
    if (e.isDirectory()) yield* walk(p);
    else if (/\.(js|css|html|json|txt|map)$/.test(e.name)) yield p;
  }
}
const files = [...walk(".next/static"), ...walk("public")];
const contents = files.map((f) => fs.readFileSync(f, "utf8"));
let leaks = 0;
for (const v of vars) {
  const hit = contents.some((c) => c.includes(v.value));
  const isPublicByDesign = v.name.startsWith("NEXT_PUBLIC_");
  if (hit) leaks++;
  console.log(`${hit ? "IN CLIENT BUNDLE" : "not in bundle   "}  ${v.name}${hit && isPublicByDesign ? "  (NEXT_PUBLIC_: shipped by design)" : hit ? "  <-- SERVER SECRET LEAKED" : ""}`);
}
console.log(`\nscanned ${files.length} client files for ${vars.length} env values; ${leaks} present in the client bundle`);
