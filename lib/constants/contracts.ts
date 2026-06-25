export const BOOSTER_CONTRACT = "0x0d1BE33F8B6a33BeEe7b3bb834DF6f8c168B2e46";
export const GM_GN_CONTRACT = "0xdb4f873B33F448aeA8Bb2b3B7e3ab9561329608A";
export const ACHIEVEMENTS_CONTRACT =
  "0xadb8120B4B18b892cFAD171243074487122Dea03";
export const CHECKIN_CONTRACT = "0xABc7099C631E18640ea60b25116407aa17354FBb";
export const ENTRYPOINT_V06 = "0x5FF137D4b0FDCD49DcA30c7CF57E578a026d2789";
export const ENTRYPOINT_V07 = "0x0000000071727De22E5E9d8BAf0edAc6f37da032";
export const BASE_BRIDGE = "0x4200000000000000000000000000000000000010";

export const CHECKIN_ABI = [
  {
    inputs: [],
    name: "checkIn",
    outputs: [],
    stateMutability: "nonpayable",
    type: "function",
  },
  {
    inputs: [{ internalType: "address", name: "", type: "address" }],
    name: "streaks",
    outputs: [{ internalType: "uint256", name: "", type: "uint256" }],
    stateMutability: "view",
    type: "function",
  },
  {
    inputs: [{ internalType: "address", name: "", type: "address" }],
    name: "lastCheckIn",
    outputs: [{ internalType: "uint256", name: "", type: "uint256" }],
    stateMutability: "view",
    type: "function",
  },
] as const;

export const ACHIEVEMENTS_ABI = [
  {
    inputs: [{ internalType: "uint256", name: "tokenId", type: "uint256" }],
    name: "mintAchievement",
    outputs: [],
    stateMutability: "nonpayable",
    type: "function",
  },
  {
    inputs: [{ internalType: "uint256[]", name: "tokenIds", type: "uint256[]" }],
    name: "mintBatchAchievements",
    outputs: [],
    stateMutability: "nonpayable",
    type: "function",
  },
  {
    inputs: [
      { internalType: "address", name: "", type: "address" },
      { internalType: "uint256", name: "", type: "uint256" },
    ],
    name: "hasMinted",
    outputs: [{ internalType: "bool", name: "", type: "bool" }],
    stateMutability: "view",
    type: "function",
  },
] as const;

export const BOOSTER_ABI = [
  {
    name: "boost",
    type: "function",
    stateMutability: "nonpayable",
    inputs: [],
    outputs: [],
  },
] as const;

export const GM_GN_ABI = [
  {
    name: "gm",
    type: "function",
    stateMutability: "nonpayable",
    inputs: [],
    outputs: [],
  },
  {
    name: "gn",
    type: "function",
    stateMutability: "payable",
    inputs: [],
    outputs: [],
  },
] as const;
