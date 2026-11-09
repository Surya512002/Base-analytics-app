#!/bin/bash
cd "$(dirname "$0")/../.."
npx hardhat node --port 8546 > /tmp/node.log 2>&1 &
NODE_PID=$!
sleep 8
node -e "
const fs=require('fs');let c=fs.readFileSync('hardhat.config.js','utf8');
if(!c.includes('localhost:')){c=c.replace('networks: {','networks: {\n    localhost: { url: \"http://127.0.0.1:8546\" },');fs.writeFileSync('hardhat.config.js',c);}"
HH="npx hardhat run --network localhost"
$HH scripts/e2e/e2e-setup.js 2>&1 | tail -2
BOOK=$(node -p "require('/tmp/e2e.json').book")
TEST_PK="0x5de4111afa1a4b94908f83103eb1f170""6367c2e68ca870fc3fb9a804cdab365a"
CHAIN=hardhat RPC_URL=http://127.0.0.1:8546 ORDER_BOOK=$BOOK POLL_MS=1000 KEEPER_PK=${KEEPER_PK:-$TEST_PK} timeout 70 npx tsx keeper/keeper.ts > /tmp/keeper.log 2>&1 &
KEEPER_PID=$!
sleep 7; echo "=== after keeper start (expect: DCA first buy done, orders open)"; $HH scripts/e2e/e2e-check.js 2>&1 | tail -6
PRICE=120 $HH scripts/e2e/e2e-price.js 2>&1 | tail -1; sleep 9
echo "=== price 120 (expect: trailing stop raised to 108, take-profit executed, stop-loss leg cancelled)"; $HH scripts/e2e/e2e-check.js 2>&1 | tail -6
PRICE=100 $HH scripts/e2e/e2e-price.js 2>&1 | tail -1; sleep 7
echo "=== price back to 100 (expect: trailing stop executed)"; $HH scripts/e2e/e2e-check.js 2>&1 | tail -6
$HH scripts/e2e/e2e-time.js 2>&1 | tail -1; PRICE=100 $HH scripts/e2e/e2e-price.js 2>&1 | tail -1; sleep 7
echo "=== after +1h (expect: DCA remaining 1)"; $HH scripts/e2e/e2e-check.js 2>&1 | tail -6
echo "--- keeper log:"; cat /tmp/keeper.log
kill $KEEPER_PID $NODE_PID 2>/dev/null
# restore config (remove the temporary localhost network)
node -e "
const fs=require('fs');let c=fs.readFileSync('hardhat.config.js','utf8');
c=c.replace(/\n    localhost: \{ url: \"http:\/\/127.0.0.1:8546\" \},/,'');fs.writeFileSync('hardhat.config.js',c);"
