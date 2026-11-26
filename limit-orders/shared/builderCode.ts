/**
 * The app's Base Builder Code as a calldata suffix, for transactions the keeper sends itself.
 * Must stay byte-for-byte equal to getBuilderDataSuffix() in the app (a test there checks it).
 */
export function builderDataSuffix(code: string = process.env.BUILDER_CODE || "bc_4uoh9iu2"): `0x${string}` {
  const bytes = Buffer.from(code, "utf8");
  return `0x${bytes.toString("hex")}${bytes.length.toString(16).padStart(2, "0")}0080218021802180218021802180218021`;
}
