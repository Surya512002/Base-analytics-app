#!/usr/bin/env bash
# Deploy BaseVoucher to Base mainnet via Alchemy RPC and verify on Basescan.
#
# Required in .env.local (or export before running):
#   DEPLOYER_PRIVATE_KEY=0x...          # wallet with Base ETH for gas
#   NEXT_PUBLIC_ALCHEMY_KEY=...         # Alchemy key (RPC)
#   BASESCAN_API_KEY=...                # https://basescan.org/myapikey (free)
#
# Optional:
#   BASE_RPC_URL=...                    # defaults to Alchemy Base mainnet
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

echo "==> Compiling BaseVoucher..."
forge build

echo "==> Deploying to Base (Alchemy RPC)..."
DEPLOY_OUT=$(forge script script/DeployBaseVoucher.s.sol:DeployBaseVoucher \
  --rpc-url "$BASE_RPC_URL" \
  --private-key "$DEPLOYER_PRIVATE_KEY" \
  --broadcast \
  -vvv 2>&1)

echo "$DEPLOY_OUT"

CONTRACT=$(echo "$DEPLOY_OUT" | grep -oE '0x[a-fA-F0-9]{40}' | tail -1)
if [[ -z "$CONTRACT" ]]; then
  CONTRACT=$(echo "$DEPLOY_OUT" | grep 'BaseVoucher deployed at:' | awk '{print $NF}')
fi

if [[ -z "$CONTRACT" ]]; then
  echo "ERROR: Could not parse deployed address from forge output."
  exit 1
fi

echo ""
echo "Deployed BaseVoucher at: $CONTRACT"
echo ""

if [[ -z "${BASESCAN_API_KEY:-}" ]]; then
  echo "==> Verifying via Sourcify (free, no API key)..."
  forge verify-contract \
    "$CONTRACT" \
    contracts/BaseVoucher.sol:BaseVoucher \
    --chain base \
    --verifier sourcify \
    --watch || echo "WARN: Sourcify verify failed — you can verify manually on Basescan with a free API key."

  echo ""
  echo "Contract on Basescan: https://basescan.org/address/$CONTRACT#code"
  echo "Sourcify: https://repo.sourcify.dev/contracts/full_match/8453/$CONTRACT/"
else
  echo "==> Verifying on Basescan (source code public)..."
  forge verify-contract \
    "$CONTRACT" \
    contracts/BaseVoucher.sol:BaseVoucher \
    --chain base \
    --etherscan-api-key "$BASESCAN_API_KEY" \
    --verifier-url https://api.basescan.org/api \
    --watch

  echo ""
  echo "Verified: https://basescan.org/address/$CONTRACT#code"
fi

echo ""
echo "Add to .env.local:"
echo "NEXT_PUBLIC_VOUCHER_CONTRACT=$CONTRACT"
