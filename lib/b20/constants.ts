import { keccak256, toBytes } from "viem";

/** Base B20 precompile addresses (same on all B20-enabled networks). */
export const B20_FACTORY_ADDRESS =
  "0xB20f000000000000000000000000000000000000" as const;

export const ACTIVATION_REGISTRY_ADDRESS =
  "0x8453000000000000000000000000000000000001" as const;

export const B20_VARIANT_ASSET = 0;

export const B20_ASSET_FEATURE_ID = "base.b20_asset";

export const B20_ASSET_CREATE_PARAMS_VERSION = 1;

/** Must match `B20Constants` / OpenZeppelin AccessControl role ids. */
export const MINT_ROLE = keccak256(toBytes("MINT_ROLE"));
export const BURN_ROLE = keccak256(toBytes("BURN_ROLE"));
export const METADATA_ROLE = keccak256(toBytes("METADATA_ROLE"));
export const OPERATOR_ROLE = keccak256(toBytes("OPERATOR_ROLE"));

export const MIN_ASSET_DECIMALS = 6;
export const MAX_ASSET_DECIMALS = 18;

export const MAX_SUPPLY_CAP =
  (BigInt(2) ** BigInt(128)) - BigInt(1);
