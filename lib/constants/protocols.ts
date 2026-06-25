export const DEX_ROUTERS = new Set([
  "0xcf77a3ba9a5ca399b7c97c74d54e5b1beb874e43", // Aerodrome Router
  "0x3ddfa8ec3052539b6c9549f12cea2c295cff5296", // Aerodrome Slipstream / CL
  "0x3a23f943181408eac424116af7b7790c94cb97a5", // Uniswap Universal Router
  "0x2626664c2603336e57b271c5c0b26f421741e481", // Uniswap V3 SwapRouter02
  "0xe592427a0aece92de3edee1f18e0157c05861564", // Uniswap V3 Router
  "0x198ef79f1f515f02dfe9e3115ed9fb06d9e3b801", // Alien Base Router
  "0x6cb442acf35158d5eda88fe602221b67a400be3e", // Sushi RouteProcessor
  "0x4752ba5dbc23f44d87826276bf6fd6b1c372ad24", // BaseSwap Router
  "0x8cfe327cec66d1c090dd72bd0ff11d690c33a2eb", // PancakeSwap Smart Router
  "0x1b81d678ffb9c0263b24a97847620c99d213eb14", // PancakeSwap V3 Router
  "0x111111125421ca6dc452d289314280a0f8842a65", // 1inch v5
  "0x1111111254eeb25477b68fb85ed929f73a960582", // 1inch v6
  "0x3b6067d4caa8a14c63fdbe6318f27a0bbc9f9237", // Balancer
  "0x280b3b748ccc42d5062ce59111fad08594f51d9f", // BaseSwap (alt)
  "0xdef1c0ded9bec7f1a1670819833240f027b25eff", // 0x Exchange Proxy
  "0xca423977156bb05b13a2ba3b76bc5419e2fe9680", // DackieSwap
  "0x19ceed7105607cd444f5ad10dd51356436095a1", // SynthSwap
  "0x6352a56caadc4f1e25cd6c75970fa768a3304e64", // OpenOcean
  "0x000000000022d473030f116ddee9f6b43ac78ba3", // Uniswap Permit2
  "0x19cee0fad0b2f56a4118c2fdda38b04eef1dd7bfd", // Odos Router V2
  "0x6131b5fae19ea4f9d964eacc031c14783b47da2a", // Kyber MetaAggregation
  "0x9008d19f58aabd9e3d60971565aa8510560ab410", // CoW Protocol
  "0x327df1e6de05895d2ab08513e4e192b45d9c8f88", // BaseSwap Router v2
  "0x678aa4bf4e210f68689df86a67cbdb72b1305a083", // PancakeSwap Universal
]);

/** Bridge / cross-chain contracts on Base (deposit or withdraw). */
export const BRIDGE_CONTRACTS = new Set([
  "0x4200000000000000000000000000000000000010", // Base L2 Standard Bridge
  "0x09aea4b2242abc8d8da1a5c964cf3735b8a5ea", // Across SpokePool
  "0x45f1a95a4d3f3836524538ac6a22ea3118263bb4", // Stargate Router
  "0x1231aeb402000000000000000000000000000000", // Superbridge / native bridge helper
]);

export const DEFI_PROTOCOLS = new Set([
  "0xcf77a3ba9a5ca399b7c97c74d54e5b1beb874e43",
  "0x3ddfa8ec3052539b6c9549f12cea2c295cff5296",
  "0x8ebaf22e6f05b4fbce41712019ba2289f631eff2",
  "0x000000000022d473030f116ddee9f6b43ac78ba3",
  "0x3b6067d4caa8a14c63fdbe6318f27a0bbc9f9237",
  "0x280b3b748ccc42d5062ce59111fad08594f51d9f",
  "0x4200000000000000000000000000000000000006",
  "0xfbb21d0380bee3312b33c4353c8936a0f13ef26c",
  "0x70778cfcfc475c7512610ccea48519738eb7f0a1",
  "0xbbbbbbbbbb9cc5e90e3b3af64bdaf62c37eeffcb",
  "0xa0533b80a28e3e3e17e4cff3adfd3b6c4f12fb83",
  "0x4200000000000000000000000000000000000010",
]);

export const PROTOCOL_NAMES: Record<string, string> = {
  "0xcf77a3ba9a5ca399b7c97c74d54e5b1beb874e43": "Aerodrome",
  "0x3ddfa8ec3052539b6c9549f12cea2c295cff5296": "Aerodrome CL",
  "0x19cee0fad0b2f56a4118c2fdda38b04eef1dd7bfd": "Odos",
  "0x6131b5fae19ea4f9d964eacc031c14783b47da2a": "KyberSwap",
  "0xdef1c0ded9bec7f1a1670819833240f027b25eff": "0x Swap",
  "0x8ebaf22e6f05b4fbce41712019ba2289f631eff2": "Curve",
  "0x000000000022d473030f116ddee9f6b43ac78ba3": "Uniswap Permit2",
  "0x3b6067d4caa8a14c63fdbe6318f27a0bbc9f9237": "Balancer",
  "0x280b3b748ccc42d5062ce59111fad08594f51d9f": "BaseSwap",
  "0x4200000000000000000000000000000000000006": "WETH",
  "0xfbb21d0380bee3312b33c4353c8936a0f13ef26c": "Moonwell",
  "0x70778cfcfc475c7512610ccea48519738eb7f0a1": "Moonwell ETH",
  "0xbbbbbbbbbb9cc5e90e3b3af64bdaf62c37eeffcb": "Morpho Blue",
  "0x4200000000000000000000000000000000000010": "Base Bridge",
};
