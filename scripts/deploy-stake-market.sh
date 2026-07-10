#!/usr/bin/env bash
# Deploy XpStake + BadgeMarketplace to Base mainnet.
#
# Required in .env.local:
#   DEPLOYER_PRIVATE_KEY=0x...
#   NEXT_PUBLIC_ALCHEMY_KEY=...
#   BASESCAN_API_KEY=... (optional, for verification)
#
set -euo pipefail
cd "$(dirname "$0")/.."

if [[ -f .env.local ]]; then
  set -a
  # shellcheck disable=SC1091
  source .env.local
  set +a
fi

if [[ -z "${DEPLOYER_PRIVATE_KEY:-}" ]]; then
  DEPLOYER_PRIVATE_KEY="${X402_FACILITATOR_PRIVATE_KEY:-}"
fi

if [[ -z "${DEPLOYER_PRIVATE_KEY:-}" ]]; then
  echo "ERROR: Set DEPLOYER_PRIVATE_KEY in .env.local"
  exit 1
fi

if [[ -z "${NEXT_PUBLIC_ALCHEMY_KEY:-}" && -z "${BASE_RPC_URL:-}" ]]; then
  echo "WARN: No Alchemy key; using https://mainnet.base.org"
fi

# Prefer explicit BASE_RPC_URL; otherwise public Base RPC (Alchemy may hit monthly cap).
export BASE_RPC_URL="${BASE_RPC_URL:-https://mainnet.base.org}"
ACHIEVEMENTS=0xadb8120B4B18b892cFAD171243074487122Dea03

echo "==> Installing forge-std if missing..."
if [[ ! -d lib/forge-std ]]; then
  forge install foundry-rs/forge-std --no-commit 2>/dev/null || forge install foundry-rs/forge-std
fi

echo "==> Compiling contracts..."
forge build

echo "==> Deploying XpStake + BadgeMarketplace to Base..."
DEPLOY_OUT=$(forge script script/DeployStakeMarket.s.sol:DeployStakeMarket \
  --rpc-url "$BASE_RPC_URL" \
  --private-key "$DEPLOYER_PRIVATE_KEY" \
  --broadcast \
  -vvv 2>&1)

echo "$DEPLOY_OUT"

XP_STAKE=$(echo "$DEPLOY_OUT" | grep -E 'XpStake deployed at:' | awk '{print $NF}')
BADGE_MARKET=$(echo "$DEPLOY_OUT" | grep -E 'BadgeMarketplace deployed at:' | awk '{print $NF}')

# Fallback: parse broadcast artifact if log grep missed (e.g. captured stderr only).
if [[ -z "$XP_STAKE" || -z "$BADGE_MARKET" ]]; then
  BROADCAST="broadcast/DeployStakeMarket.s.sol/8453/run-latest.json"
  if [[ -f "$BROADCAST" ]]; then
    XP_STAKE=$(node -e "const j=require('./$BROADCAST');const t=j.transactions.find(x=>x.contractName==='XpStake');console.log(t?.contractAddress||'')")
    BADGE_MARKET=$(node -e "const j=require('./$BROADCAST');const t=j.transactions.find(x=>x.contractName==='BadgeMarketplace');console.log(t?.contractAddress||'')")
  fi
fi

if [[ -z "$XP_STAKE" || -z "$BADGE_MARKET" ]]; then
  echo "ERROR: Could not parse deployed addresses."
  exit 1
fi

echo ""
echo "XpStake:          $XP_STAKE"
echo "BadgeMarketplace: $BADGE_MARKET"
echo ""

if [[ -z "${BASESCAN_API_KEY:-}" ]]; then
  echo "==> Verifying via Sourcify..."
  forge verify-contract "$XP_STAKE" contracts/XpStake.sol:XpStake --chain base --verifier sourcify --watch \
    || echo "WARN: XpStake verify failed"
  CONSTRUCTOR_ARGS=$(cast abi-encode "constructor(address)" "$ACHIEVEMENTS")
  forge verify-contract "$BADGE_MARKET" contracts/BadgeMarketplace.sol:BadgeMarketplace \
    --chain base --verifier sourcify --constructor-args "$CONSTRUCTOR_ARGS" --watch \
    || echo "WARN: BadgeMarketplace verify failed"
else
  echo "==> Verifying on Basescan..."
  forge verify-contract "$XP_STAKE" contracts/XpStake.sol:XpStake --chain base \
    --etherscan-api-key "$BASESCAN_API_KEY" \
    --verifier etherscan \
    --watch || echo "WARN: XpStake verify failed"

  CONSTRUCTOR_ARGS=$(cast abi-encode "constructor(address)" "$ACHIEVEMENTS")
  forge verify-contract "$BADGE_MARKET" contracts/BadgeMarketplace.sol:BadgeMarketplace \
    --chain base \
    --etherscan-api-key "$BASESCAN_API_KEY" \
    --verifier etherscan \
    --constructor-args "$CONSTRUCTOR_ARGS" \
    --watch || echo "WARN: BadgeMarketplace verify failed"
fi

echo ""
echo "Basescan:"
echo "  https://basescan.org/address/$XP_STAKE"
echo "  https://basescan.org/address/$BADGE_MARKET"
echo ""
echo "Add to .env.local:"
echo "NEXT_PUBLIC_XP_STAKE_CONTRACT=$XP_STAKE"
echo "NEXT_PUBLIC_BADGE_MARKETPLACE_CONTRACT=$BADGE_MARKET"
