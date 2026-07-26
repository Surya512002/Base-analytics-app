/**
 * Base mainnet protocol addresses used to classify wallet activity.
 *
 * Every entry is verified to hold contract code on Base — see
 * `protocols.test.ts`. A wrong address here silently mis-reports a wallet's DEX
 * volume rather than failing, so entries must never be added from memory.
 */

export const DEX_ROUTERS = new Set([
  // Aerodrome
  "0xcf77a3ba9a5ca399b7c97c74d54e5b1beb874e43", // Router (v2)
  "0xbe6d8f0d05cc4be24d5167a3ef062215be6d18a5", // Slipstream SwapRouter
  "0x6cb442acf35158d5eda88fe602221b67b400be3e", // Universal Router
  "0x420dd381b31aef6683db6b902084cb0ffece40da", // PoolFactory
  "0x827922686190790b37229fd06084350e74485b72", // Slipstream Position Manager

  // Uniswap
  "0x2626664c2603336e57b271c5c0b26f421741e481", // V3 SwapRouter02
  "0xe592427a0aece92de3edee1f18e0157c05861564", // V3 SwapRouter
  "0x6ff5693b99212da76ad316178a184ab56d299b43", // UniversalRouter (v4 era)
  "0x3fc91a3afd70395cd496c647d5a6cc9d4b2b7fad", // UniversalRouter v1.2
  "0x3a23f943181408eac424116af7b7790c94cb97a5", // UniversalRouter (legacy)
  "0x4752ba5dbc23f44d87826276bf6fd6b1c372ad24", // V2 Router02
  "0x498581ff718922c3f8e6a244956af099b2652b2b", // V4 PoolManager
  "0x000000000022d473030f116ddee9f6b43ac78ba3", // Permit2

  // Other Base AMMs
  "0x327df1e6de05895d2ab08513aadd9313fe505d86", // BaseSwap Router
  "0x8c1a3cf8f83074169fe5d7ad50b978e1cd6b37c7", // AlienBase Router
  "0x195fbc5b8fbd5ac739c1ba57d4ef6d5a704f34f7", // DackieSwap V3 Router
  "0x1b81d678ffb9c0263b24a97847620c99d213eb14", // PancakeSwap V3 Router
  "0x678aa4bf4e210cf2166753e054d5b7c31cc7fa86", // PancakeSwap Smart Router
  "0x8cfe327cec66d1c090dd72bd0ff11d690c33a2eb", // PancakeSwap Smart Router (alt)
  "0x0389879e0156033202c44bf784ac18fc02edee4f", // SushiSwap RouteProcessor4
  "0x9b3336186a38e1b6c21955d112dbb0343ee061ee", // SushiSwap RouteProcessor5

  // Aggregators
  "0xdef1c0ded9bec7f1a1670819833240f027b25eff", // 0x Exchange Proxy
  "0x0000000000001ff3684f28c67538d4d072c22734", // 0x AllowanceHolder
  "0x1111111254eeb25477b68fb85ed929f73a960582", // 1inch v5
  "0x111111125421ca6dc452d289314280a0f8842a65", // 1inch v6
  "0x19ceead7105607cd444f5ad10dd51356436095a1", // Odos Router V2
  "0x6131b5fae19ea4f9d964eac0408e4408b66337b5", // KyberSwap MetaAggregationV2
  "0x9008d19f58aabd9ed0d60971565aa8510560ab41", // CoW Protocol GPv2Settlement
  "0xdef171fe48cf0115b1d80b88dc8eab59176fee57", // ParaSwap Augustus v5
  "0x1231deb6f5749ef6ce6943a275a1d3e7486f4eae", // LI.FI Diamond
  "0x6352a56caadc4f1e25cd6c75970fa768a3304e64", // OpenOcean Exchange
]);

/** Bridge / cross-chain contracts on Base (deposit or withdraw). */
export const BRIDGE_CONTRACTS = new Set([
  "0x4200000000000000000000000000000000000010", // Base L2 Standard Bridge
  "0x09aea4b2242abc8bb4bb78d537a67a245a7bec64", // Across SpokePool
  "0x45f1a95a4d3f3836523f5c83673c797f4d4d263b", // Stargate Router
  "0x1231deb6f5749ef6ce6943a275a1d3e7486f4eae", // LI.FI Diamond
]);

export const DEFI_PROTOCOLS = new Set([
  "0xcf77a3ba9a5ca399b7c97c74d54e5b1beb874e43", // Aerodrome Router
  "0xbe6d8f0d05cc4be24d5167a3ef062215be6d18a5", // Aerodrome Slipstream
  "0x000000000022d473030f116ddee9f6b43ac78ba3", // Uniswap Permit2
  "0xba12222222228d8ba445958a75a0704d566bf2c8", // Balancer Vault
  "0x4f37a9d177470499a2dd084621020b023fcffc1f", // Curve Router
  "0x4200000000000000000000000000000000000006", // WETH
  "0xfbb21d0380bee3312b33c4353c8936a0f13ef26c", // Moonwell
  "0x628ff693426583d9a7fb391e54366292f509d457", // Moonwell mWETH
  "0xedc817a28e8b93b03976fbd4a3ddbc9f7d176c22", // Moonwell mUSDC
  "0xbbbbbbbbbb9cc5e90e3b3af64bdaf62c37eeffcb", // Morpho Blue
  "0x498581ff718922c3f8e6a244956af099b2652b2b", // Uniswap V4 PoolManager
  "0x4200000000000000000000000000000000000010", // Base Bridge
]);

export const PROTOCOL_NAMES: Record<string, string> = {
  "0xcf77a3ba9a5ca399b7c97c74d54e5b1beb874e43": "Aerodrome",
  "0xbe6d8f0d05cc4be24d5167a3ef062215be6d18a5": "Aerodrome CL",
  "0x6cb442acf35158d5eda88fe602221b67b400be3e": "Aerodrome",
  "0x420dd381b31aef6683db6b902084cb0ffece40da": "Aerodrome",
  "0x827922686190790b37229fd06084350e74485b72": "Aerodrome CL",
  "0x2626664c2603336e57b271c5c0b26f421741e481": "Uniswap V3",
  "0xe592427a0aece92de3edee1f18e0157c05861564": "Uniswap V3",
  "0x6ff5693b99212da76ad316178a184ab56d299b43": "Uniswap",
  "0x3fc91a3afd70395cd496c647d5a6cc9d4b2b7fad": "Uniswap",
  "0x3a23f943181408eac424116af7b7790c94cb97a5": "Uniswap",
  "0x4752ba5dbc23f44d87826276bf6fd6b1c372ad24": "Uniswap V2",
  "0x498581ff718922c3f8e6a244956af099b2652b2b": "Uniswap V4",
  "0x000000000022d473030f116ddee9f6b43ac78ba3": "Uniswap Permit2",
  "0x327df1e6de05895d2ab08513aadd9313fe505d86": "BaseSwap",
  "0x8c1a3cf8f83074169fe5d7ad50b978e1cd6b37c7": "AlienBase",
  "0x195fbc5b8fbd5ac739c1ba57d4ef6d5a704f34f7": "DackieSwap",
  "0x1b81d678ffb9c0263b24a97847620c99d213eb14": "PancakeSwap",
  "0x678aa4bf4e210cf2166753e054d5b7c31cc7fa86": "PancakeSwap",
  "0x8cfe327cec66d1c090dd72bd0ff11d690c33a2eb": "PancakeSwap",
  "0x0389879e0156033202c44bf784ac18fc02edee4f": "SushiSwap",
  "0x9b3336186a38e1b6c21955d112dbb0343ee061ee": "SushiSwap",
  "0xdef1c0ded9bec7f1a1670819833240f027b25eff": "0x Swap",
  "0x0000000000001ff3684f28c67538d4d072c22734": "0x Swap",
  "0x1111111254eeb25477b68fb85ed929f73a960582": "1inch",
  "0x111111125421ca6dc452d289314280a0f8842a65": "1inch",
  "0x19ceead7105607cd444f5ad10dd51356436095a1": "Odos",
  "0x6131b5fae19ea4f9d964eac0408e4408b66337b5": "KyberSwap",
  "0x9008d19f58aabd9ed0d60971565aa8510560ab41": "CoW Protocol",
  "0xdef171fe48cf0115b1d80b88dc8eab59176fee57": "ParaSwap",
  "0x1231deb6f5749ef6ce6943a275a1d3e7486f4eae": "LI.FI",
  "0x6352a56caadc4f1e25cd6c75970fa768a3304e64": "OpenOcean",
  "0xba12222222228d8ba445958a75a0704d566bf2c8": "Balancer",
  "0x4f37a9d177470499a2dd084621020b023fcffc1f": "Curve",
  "0x4200000000000000000000000000000000000006": "WETH",
  "0xfbb21d0380bee3312b33c4353c8936a0f13ef26c": "Moonwell",
  "0x628ff693426583d9a7fb391e54366292f509d457": "Moonwell",
  "0xedc817a28e8b93b03976fbd4a3ddbc9f7d176c22": "Moonwell",
  "0xbbbbbbbbbb9cc5e90e3b3af64bdaf62c37eeffcb": "Morpho Blue",
  "0x09aea4b2242abc8bb4bb78d537a67a245a7bec64": "Across",
  "0x45f1a95a4d3f3836523f5c83673c797f4d4d263b": "Stargate",
  "0x4200000000000000000000000000000000000010": "Base Bridge",
};
