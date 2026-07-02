#!/usr/bin/env bash
# Deploy CryptoPredictionMarket to Base mainnet via Alchemy RPC and verify on Basescan.
#
# Required in .env.local (or export before running):
#   DEPLOYER_PRIVATE_KEY=0x...
#   NEXT_PUBLIC_ALCHEMY_KEY=...
#
# Optional:
#   BASESCAN_API_KEY=...
#   BASE_RPC_URL=...
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
  echo "ERROR: Set DEPLOYER_PRIVATE_KEY in .env.local (hex private key, with 0x prefix)."
  exit 1
fi

if [[ -z "${NEXT_PUBLIC_ALCHEMY_KEY:-}" ]]; then
  echo "ERROR: Set NEXT_PUBLIC_ALCHEMY_KEY in .env.local"
  exit 1
fi

export BASE_RPC_URL="${BASE_RPC_URL:-https://base-mainnet.g.alchemy.com/v2/${NEXT_PUBLIC_ALCHEMY_KEY}}"

echo "==> Installing forge-std if missing..."
if [[ ! -d lib/forge-std ]]; then
  forge install foundry-rs/forge-std --no-commit 2>/dev/null || forge install foundry-rs/forge-std
fi

echo "==> Compiling CryptoPredictionMarket..."
forge build

echo "==> Deploying to Base (Alchemy RPC)..."
echo "    Treasury: 0xB4BD7D410543cB27f42c562ab3fF5DC12fBDd42F"
echo "    Protocol fee: 150 bps (1.5%)"
DEPLOY_OUT=$(forge script script/DeployCryptoPredictionMarket.s.sol:DeployCryptoPredictionMarket \
  --rpc-url "$BASE_RPC_URL" \
  --private-key "$DEPLOYER_PRIVATE_KEY" \
  --broadcast \
  -vvv 2>&1)

echo "$DEPLOY_OUT"

CONTRACT=$(echo "$DEPLOY_OUT" | grep -E 'deployed: address|CryptoPredictionMarket deployed at:' | grep -oE '0x[a-fA-F0-9]{40}' | tail -1)
if [[ -z "$CONTRACT" ]]; then
  CONTRACT=$(echo "$DEPLOY_OUT" | grep 'CryptoPredictionMarket deployed at:' | awk '{print $NF}')
fi

if [[ -z "$CONTRACT" ]]; then
  echo "ERROR: Could not parse deployed address from forge output."
  exit 1
fi

echo ""
echo "Deployed CryptoPredictionMarket at: $CONTRACT"
echo ""

CONSTRUCTOR_ARGS=$(cast abi-encode "constructor(address,uint16)" 0xB4BD7D410543cB27f42c562ab3fF5DC12fBDd42F 150)

if [[ -z "${BASESCAN_API_KEY:-}" ]]; then
  echo "==> Verifying via Sourcify (free, no API key)..."
  forge verify-contract \
    "$CONTRACT" \
    contracts/CryptoPredictionMarket.sol:CryptoPredictionMarket \
    --chain base \
    --constructor-args "$CONSTRUCTOR_ARGS" \
    --verifier sourcify \
    --watch || echo "WARN: Sourcify verify failed — verify manually on Basescan."

  echo ""
  echo "Contract on Basescan: https://basescan.org/address/$CONTRACT#code"
else
  echo "==> Verifying on Basescan..."
  forge verify-contract \
    "$CONTRACT" \
    contracts/CryptoPredictionMarket.sol:CryptoPredictionMarket \
    --chain base \
    --constructor-args "$CONSTRUCTOR_ARGS" \
    --etherscan-api-key "$BASESCAN_API_KEY" \
    --verifier-url https://api.basescan.org/api \
    --watch

  echo ""
  echo "Verified: https://basescan.org/address/$CONTRACT#code"
fi

echo ""
echo "Add to .env.local:"
echo "NEXT_PUBLIC_PREDICTIONS_CONTRACT=$CONTRACT"
echo "PREDICTIONS_KEEPER_PRIVATE_KEY=\$DEPLOYER_PRIVATE_KEY"
echo "PREDICTIONS_KEEPER_SECRET=<random-cron-secret>"
echo "PREDICTIONS_INITIAL_LIQUIDITY_USDC=10000"
echo ""
echo "Keeper: POST /api/predictions/keeper with Authorization: Bearer <PREDICTIONS_KEEPER_SECRET>"
echo "        or run: bash scripts/run-prediction-keeper.sh"
echo ""
echo "Markets auto-open on each /api/predictions fetch when keeper key is set (12 tracks incl. 15m)."
