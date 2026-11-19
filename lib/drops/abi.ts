/**
 * BaseDrops ABI (generated from forge-out/BaseDrops.sol/BaseDrops.json; regenerate after
 * changing contracts/drops/BaseDrops.sol). Only the entries the app uses.
 */
export const BASE_DROPS_ABI = [
  {
    "type": "function",
    "name": "nextDropId",
    "inputs": [],
    "outputs": [{ "name": "", "type": "uint256", "internalType": "uint256" }],
    "stateMutability": "view"
  },
  {
    "type": "function",
    "name": "FIRST_DROP_ID",
    "inputs": [],
    "outputs": [
      {
        "name": "",
        "type": "uint256",
        "internalType": "uint256"
      }
    ],
    "stateMutability": "view"
  },
  {
    "type": "function",
    "name": "acceptCreator",
    "inputs": [
      {
        "name": "id",
        "type": "uint256",
        "internalType": "uint256"
      }
    ],
    "outputs": [],
    "stateMutability": "nonpayable"
  },
  {
    "type": "function",
    "name": "claim",
    "inputs": [
      {
        "name": "id",
        "type": "uint256",
        "internalType": "uint256"
      },
      {
        "name": "a",
        "type": "tuple",
        "internalType": "struct BaseDrops.ClaimArgs",
        "components": [
          {
            "name": "linkSig",
            "type": "bytes",
            "internalType": "bytes"
          },
          {
            "name": "code",
            "type": "address",
            "internalType": "address"
          },
          {
            "name": "codeProof",
            "type": "bytes32[]",
            "internalType": "bytes32[]"
          },
          {
            "name": "codeSig",
            "type": "bytes",
            "internalType": "bytes"
          },
          {
            "name": "allowlistProof",
            "type": "bytes32[]",
            "internalType": "bytes32[]"
          },
          {
            "name": "amount",
            "type": "uint256",
            "internalType": "uint256"
          },
          {
            "name": "deadline",
            "type": "uint64",
            "internalType": "uint64"
          },
          {
            "name": "ticket",
            "type": "bytes",
            "internalType": "bytes"
          },
          {
            "name": "gateData",
            "type": "bytes",
            "internalType": "bytes"
          },
          {
            "name": "referrer",
            "type": "address",
            "internalType": "address"
          }
        ]
      }
    ],
    "outputs": [],
    "stateMutability": "nonpayable"
  },
  {
    "type": "function",
    "name": "claimBlocker",
    "inputs": [
      {
        "name": "id",
        "type": "uint256",
        "internalType": "uint256"
      },
      {
        "name": "claimer",
        "type": "address",
        "internalType": "address"
      }
    ],
    "outputs": [
      {
        "name": "",
        "type": "string",
        "internalType": "string"
      }
    ],
    "stateMutability": "view"
  },
  {
    "type": "function",
    "name": "claimsInPeriod",
    "inputs": [
      {
        "name": "",
        "type": "uint256",
        "internalType": "uint256"
      },
      {
        "name": "",
        "type": "uint256",
        "internalType": "uint256"
      }
    ],
    "outputs": [
      {
        "name": "",
        "type": "uint32",
        "internalType": "uint32"
      }
    ],
    "stateMutability": "view"
  },
  {
    "type": "function",
    "name": "close",
    "inputs": [
      {
        "name": "id",
        "type": "uint256",
        "internalType": "uint256"
      }
    ],
    "outputs": [],
    "stateMutability": "nonpayable"
  },
  {
    "type": "function",
    "name": "codeDigest",
    "inputs": [
      {
        "name": "id",
        "type": "uint256",
        "internalType": "uint256"
      },
      {
        "name": "claimer",
        "type": "address",
        "internalType": "address"
      }
    ],
    "outputs": [
      {
        "name": "",
        "type": "bytes32",
        "internalType": "bytes32"
      }
    ],
    "stateMutability": "view"
  },
  {
    "type": "function",
    "name": "codeUsed",
    "inputs": [
      {
        "name": "",
        "type": "uint256",
        "internalType": "uint256"
      },
      {
        "name": "",
        "type": "address",
        "internalType": "address"
      }
    ],
    "outputs": [
      {
        "name": "",
        "type": "bool",
        "internalType": "bool"
      }
    ],
    "stateMutability": "view"
  },
  {
    "type": "function",
    "name": "createDrop",
    "inputs": [
      {
        "name": "p",
        "type": "tuple",
        "internalType": "struct BaseDrops.CreateParams",
        "components": [
          {
            "name": "token",
            "type": "address",
            "internalType": "address"
          },
          {
            "name": "budget",
            "type": "uint256",
            "internalType": "uint256"
          },
          {
            "name": "amountPerClaim",
            "type": "uint128",
            "internalType": "uint128"
          },
          {
            "name": "maxAmountPerClaim",
            "type": "uint128",
            "internalType": "uint128"
          },
          {
            "name": "maxClaimsTotal",
            "type": "uint32",
            "internalType": "uint32"
          },
          {
            "name": "maxClaimsPerWallet",
            "type": "uint32",
            "internalType": "uint32"
          },
          {
            "name": "cooldown",
            "type": "uint32",
            "internalType": "uint32"
          },
          {
            "name": "periodSecs",
            "type": "uint32",
            "internalType": "uint32"
          },
          {
            "name": "maxClaimsPerPeriod",
            "type": "uint32",
            "internalType": "uint32"
          },
          {
            "name": "unlockAt",
            "type": "uint64",
            "internalType": "uint64"
          },
          {
            "name": "expiresAt",
            "type": "uint64",
            "internalType": "uint64"
          },
          {
            "name": "linkSigner",
            "type": "address",
            "internalType": "address"
          },
          {
            "name": "ticketSigner",
            "type": "address",
            "internalType": "address"
          },
          {
            "name": "allowlistRoot",
            "type": "bytes32",
            "internalType": "bytes32"
          },
          {
            "name": "codesRoot",
            "type": "bytes32",
            "internalType": "bytes32"
          },
          {
            "name": "gate",
            "type": "address",
            "internalType": "address"
          },
          {
            "name": "gateConfig",
            "type": "bytes",
            "internalType": "bytes"
          },
          {
            "name": "recovery",
            "type": "address",
            "internalType": "address"
          },
          {
            "name": "committed",
            "type": "bool",
            "internalType": "bool"
          },
          {
            "name": "message",
            "type": "string",
            "internalType": "string"
          },
          {
            "name": "senderLabel",
            "type": "string",
            "internalType": "string"
          }
        ]
      }
    ],
    "outputs": [
      {
        "name": "id",
        "type": "uint256",
        "internalType": "uint256"
      }
    ],
    "stateMutability": "payable"
  },
  {
    "type": "function",
    "name": "extendExpiry",
    "inputs": [
      {
        "name": "id",
        "type": "uint256",
        "internalType": "uint256"
      },
      {
        "name": "newExpiresAt",
        "type": "uint64",
        "internalType": "uint64"
      }
    ],
    "outputs": [],
    "stateMutability": "nonpayable"
  },
  {
    "type": "function",
    "name": "getDrop",
    "inputs": [
      {
        "name": "id",
        "type": "uint256",
        "internalType": "uint256"
      }
    ],
    "outputs": [
      {
        "name": "drop",
        "type": "tuple",
        "internalType": "struct BaseDrops.Drop",
        "components": [
          {
            "name": "creator",
            "type": "address",
            "internalType": "address"
          },
          {
            "name": "token",
            "type": "address",
            "internalType": "address"
          },
          {
            "name": "amountPerClaim",
            "type": "uint128",
            "internalType": "uint128"
          },
          {
            "name": "maxAmountPerClaim",
            "type": "uint128",
            "internalType": "uint128"
          },
          {
            "name": "budget",
            "type": "uint256",
            "internalType": "uint256"
          },
          {
            "name": "maxClaimsTotal",
            "type": "uint32",
            "internalType": "uint32"
          },
          {
            "name": "claimedCount",
            "type": "uint32",
            "internalType": "uint32"
          },
          {
            "name": "maxClaimsPerWallet",
            "type": "uint32",
            "internalType": "uint32"
          },
          {
            "name": "cooldown",
            "type": "uint32",
            "internalType": "uint32"
          },
          {
            "name": "periodSecs",
            "type": "uint32",
            "internalType": "uint32"
          },
          {
            "name": "maxClaimsPerPeriod",
            "type": "uint32",
            "internalType": "uint32"
          },
          {
            "name": "createdAt",
            "type": "uint64",
            "internalType": "uint64"
          },
          {
            "name": "unlockAt",
            "type": "uint64",
            "internalType": "uint64"
          },
          {
            "name": "expiresAt",
            "type": "uint64",
            "internalType": "uint64"
          },
          {
            "name": "linkSigner",
            "type": "address",
            "internalType": "address"
          },
          {
            "name": "ticketSigner",
            "type": "address",
            "internalType": "address"
          },
          {
            "name": "gate",
            "type": "address",
            "internalType": "address"
          },
          {
            "name": "recovery",
            "type": "address",
            "internalType": "address"
          },
          {
            "name": "pendingCreator",
            "type": "address",
            "internalType": "address"
          },
          {
            "name": "allowlistRoot",
            "type": "bytes32",
            "internalType": "bytes32"
          },
          {
            "name": "codesRoot",
            "type": "bytes32",
            "internalType": "bytes32"
          },
          {
            "name": "committed",
            "type": "bool",
            "internalType": "bool"
          },
          {
            "name": "paused",
            "type": "bool",
            "internalType": "bool"
          },
          {
            "name": "closed",
            "type": "bool",
            "internalType": "bool"
          }
        ]
      },
      {
        "name": "message",
        "type": "string",
        "internalType": "string"
      },
      {
        "name": "senderLabel",
        "type": "string",
        "internalType": "string"
      }
    ],
    "stateMutability": "view"
  },
  {
    "type": "function",
    "name": "linkDigest",
    "inputs": [
      {
        "name": "id",
        "type": "uint256",
        "internalType": "uint256"
      },
      {
        "name": "claimer",
        "type": "address",
        "internalType": "address"
      }
    ],
    "outputs": [
      {
        "name": "",
        "type": "bytes32",
        "internalType": "bytes32"
      }
    ],
    "stateMutability": "view"
  },
  {
    "type": "function",
    "name": "nextClaimAt",
    "inputs": [
      {
        "name": "id",
        "type": "uint256",
        "internalType": "uint256"
      },
      {
        "name": "claimer",
        "type": "address",
        "internalType": "address"
      }
    ],
    "outputs": [
      {
        "name": "",
        "type": "uint256",
        "internalType": "uint256"
      }
    ],
    "stateMutability": "view"
  },
  {
    "type": "function",
    "name": "recoverCreator",
    "inputs": [
      {
        "name": "id",
        "type": "uint256",
        "internalType": "uint256"
      }
    ],
    "outputs": [],
    "stateMutability": "nonpayable"
  },
  {
    "type": "function",
    "name": "rotateLinkSigner",
    "inputs": [
      {
        "name": "id",
        "type": "uint256",
        "internalType": "uint256"
      },
      {
        "name": "newLinkSigner",
        "type": "address",
        "internalType": "address"
      }
    ],
    "outputs": [],
    "stateMutability": "nonpayable"
  },
  {
    "type": "function",
    "name": "setManager",
    "inputs": [
      {
        "name": "id",
        "type": "uint256",
        "internalType": "uint256"
      },
      {
        "name": "manager",
        "type": "address",
        "internalType": "address"
      },
      {
        "name": "enabled",
        "type": "bool",
        "internalType": "bool"
      }
    ],
    "outputs": [],
    "stateMutability": "nonpayable"
  },
  {
    "type": "function",
    "name": "setPaused",
    "inputs": [
      {
        "name": "id",
        "type": "uint256",
        "internalType": "uint256"
      },
      {
        "name": "paused",
        "type": "bool",
        "internalType": "bool"
      }
    ],
    "outputs": [],
    "stateMutability": "nonpayable"
  },
  {
    "type": "function",
    "name": "setRecovery",
    "inputs": [
      {
        "name": "id",
        "type": "uint256",
        "internalType": "uint256"
      },
      {
        "name": "recovery",
        "type": "address",
        "internalType": "address"
      }
    ],
    "outputs": [],
    "stateMutability": "nonpayable"
  },
  {
    "type": "function",
    "name": "setTicketSigner",
    "inputs": [
      {
        "name": "id",
        "type": "uint256",
        "internalType": "uint256"
      },
      {
        "name": "newTicketSigner",
        "type": "address",
        "internalType": "address"
      }
    ],
    "outputs": [],
    "stateMutability": "nonpayable"
  },
  {
    "type": "function",
    "name": "ticketDigest",
    "inputs": [
      {
        "name": "id",
        "type": "uint256",
        "internalType": "uint256"
      },
      {
        "name": "claimer",
        "type": "address",
        "internalType": "address"
      },
      {
        "name": "claimIndex",
        "type": "uint32",
        "internalType": "uint32"
      },
      {
        "name": "amount",
        "type": "uint256",
        "internalType": "uint256"
      },
      {
        "name": "deadline",
        "type": "uint64",
        "internalType": "uint64"
      }
    ],
    "outputs": [
      {
        "name": "",
        "type": "bytes32",
        "internalType": "bytes32"
      }
    ],
    "stateMutability": "view"
  },
  {
    "type": "function",
    "name": "topUp",
    "inputs": [
      {
        "name": "id",
        "type": "uint256",
        "internalType": "uint256"
      },
      {
        "name": "amount",
        "type": "uint256",
        "internalType": "uint256"
      }
    ],
    "outputs": [],
    "stateMutability": "payable"
  },
  {
    "type": "function",
    "name": "transferCreator",
    "inputs": [
      {
        "name": "id",
        "type": "uint256",
        "internalType": "uint256"
      },
      {
        "name": "newCreator",
        "type": "address",
        "internalType": "address"
      }
    ],
    "outputs": [],
    "stateMutability": "nonpayable"
  },
  {
    "type": "function",
    "name": "walletState",
    "inputs": [
      {
        "name": "",
        "type": "uint256",
        "internalType": "uint256"
      },
      {
        "name": "",
        "type": "address",
        "internalType": "address"
      }
    ],
    "outputs": [
      {
        "name": "claims",
        "type": "uint32",
        "internalType": "uint32"
      },
      {
        "name": "lastClaimAt",
        "type": "uint64",
        "internalType": "uint64"
      }
    ],
    "stateMutability": "view"
  },
  {
    "type": "event",
    "name": "DropClaimed",
    "inputs": [
      {
        "name": "dropId",
        "type": "uint256",
        "indexed": true,
        "internalType": "uint256"
      },
      {
        "name": "claimer",
        "type": "address",
        "indexed": true,
        "internalType": "address"
      },
      {
        "name": "referrer",
        "type": "address",
        "indexed": true,
        "internalType": "address"
      },
      {
        "name": "amount",
        "type": "uint256",
        "indexed": false,
        "internalType": "uint256"
      },
      {
        "name": "walletClaimNumber",
        "type": "uint32",
        "indexed": false,
        "internalType": "uint32"
      },
      {
        "name": "claimedCount",
        "type": "uint32",
        "indexed": false,
        "internalType": "uint32"
      }
    ],
    "anonymous": false
  },
  {
    "type": "event",
    "name": "DropCreated",
    "inputs": [
      {
        "name": "dropId",
        "type": "uint256",
        "indexed": true,
        "internalType": "uint256"
      },
      {
        "name": "creator",
        "type": "address",
        "indexed": true,
        "internalType": "address"
      },
      {
        "name": "token",
        "type": "address",
        "indexed": true,
        "internalType": "address"
      },
      {
        "name": "budget",
        "type": "uint256",
        "indexed": false,
        "internalType": "uint256"
      },
      {
        "name": "amountPerClaim",
        "type": "uint128",
        "indexed": false,
        "internalType": "uint128"
      },
      {
        "name": "expiresAt",
        "type": "uint64",
        "indexed": false,
        "internalType": "uint64"
      },
      {
        "name": "committed",
        "type": "bool",
        "indexed": false,
        "internalType": "bool"
      },
      {
        "name": "senderLabel",
        "type": "string",
        "indexed": false,
        "internalType": "string"
      },
      {
        "name": "message",
        "type": "string",
        "indexed": false,
        "internalType": "string"
      }
    ],
    "anonymous": false
  }
] as const;
