# Mainnet Canary Verification Runbook

> **Rule:** Never use more than ~$2 per step. Execute manually only **after** Base Sepolia smoke tests and dry runs pass.
> If any transaction reverts unexpectedly, token balance does not match, or an issuer policy halts transfers, **STOP IMMEDIATELY**.

---

## Prerequisites & Pre-flight Checks
1. Ensure your wallet has:
   - ~0.005 ETH on Base mainnet (for gas fees; Base gas is typically < $0.05 per tx).
   - ~$10 USDC on Base mainnet (`0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913`).
2. Verify you are connected to Base Mainnet (Chain ID `8453`).
3. Keep [Basescan](https://basescan.org) open in another tab to inspect transactions and token balances.
4. Record your user wallet address: `USER_ADDRESS`.

---

## Step 1: Market Swap (~$2 USDC to NVDAc)
1. In the **Market** tab, select **Pay: USDC**, **Receive: NVDAc**.
2. Enter **2 USDC**. Slippage setting: default **0.5%**.
3. Click **Swap** and confirm in your wallet.
4. **Basescan Verification:**
   - Check the transaction on Basescan:
     - Outgoing: ~2 USDC (`0x8335...`) from `USER_ADDRESS` to Uniswap pool.
     - Incoming: ~0.013 NVDAc (`0xb200...`) to `USER_ADDRESS`.
   - Verify `balanceOf(USER_ADDRESS)` for NVDAc shows the received stock tokens.
5. **Stop Condition:** If swap reverts or NVDAc balance is zero, stop.

---

## Step 2: Escrow Stock into Take-Profit Order
1. Switch to the **Orders** tab -> select **Take-profit**.
2. Stock: **NVDAc**, Order size: 100% of received stock (~0.013 NVDAc, ~$2 value).
3. Set **Take-Profit Trigger Price** far above market (e.g. +50% above current price, so it cannot fill immediately).
4. Approve NVDAc spending if prompted, then click **Place Take-Profit Order**.
5. **Basescan Verification:**
   - In the transaction:
     - Transfer of ~0.013 NVDAc from `USER_ADDRESS` to `LimitOrderBook` contract.
     - Event `OrderCreated` emitted with `orderType: 1` (TAKE_PROFIT), `tokenIn: NVDAc`, `amountIn: ~0.013`.
   - Check `LimitOrderBook` address on Basescan: Token holdings must now include the deposited NVDAc.
   - In UI: Order appears in **My Orders** with status `OPEN`.
6. **Stop Condition:** If transfer to `LimitOrderBook` fails, token policy halts deposit, or order is not indexed, stop.

---

## Step 3: Cancel Take-Profit & Verify Stock Refund
1. In **My Orders**, locate the open Take-Profit order from Step 2.
2. Click **Cancel Order** and confirm transaction.
3. **Basescan Verification:**
   - In the transaction:
     - Transfer of the exact deposited NVDAc (~0.013 NVDAc) from `LimitOrderBook` back to `USER_ADDRESS`.
     - Event `OrderCancelled` emitted.
   - Check `balanceOf(USER_ADDRESS)` on Basescan: NVDAc balance must be fully restored.
   - In UI: Order status updates to `CANCELLED`.
4. **Stop Condition:** If refund is not received in full or contract holds escrowed funds, stop.

---

## Step 4: Escrow USDC into Limit Buy & Verify Refund
1. In the **Orders** tab -> select **Limit buy**.
2. Stock: **NVDAc**, Pay: **2 USDC**.
3. Set **Limit Price** far below market (e.g. -50% below current price, so it cannot fill immediately).
4. Approve USDC if needed, then click **Place Limit Buy Order**.
5. **Basescan Verification:**
   - Transfer of 2 USDC from `USER_ADDRESS` to `LimitOrderBook`.
   - Event `OrderCreated` with `orderType: 0` (LIMIT_BUY).
6. In **My Orders**, click **Cancel Order** and confirm.
7. **Basescan Verification:**
   - Transfer of 2 USDC from `LimitOrderBook` back to `USER_ADDRESS`.
   - Event `OrderCancelled` emitted.
   - User USDC balance fully restored.
8. **Stop Condition:** If USDC escrow or refund fails, stop.

---

## Step 5: Test Bracket Order Deposit & In-Place Edit
1. In the **Orders** tab -> select **Bracket**.
2. Stock: **NVDAc**, Deposit: ~0.013 NVDAc (~$2).
3. Set:
   - **Take-Profit Trigger**: +30% above current price.
   - **Stop-Loss Trigger**: -30% below current price.
4. Click **Place Bracket Order** and confirm.
5. **Basescan Verification:**
   - 2 linked orders created (`takeProfitOrderId` and `stopLossOrderId`) sharing the same stock deposit.
6. In **My Orders**, click **Edit** on the open bracket order to adjust the stop trigger by +1%.
7. Confirm the edit transaction. Verify `OrderEdited` event emitted on Basescan.
8. Cancel the bracket order. Verify full refund of NVDAc back to `USER_ADDRESS`.
9. **Stop Condition:** If bracket creation, edit, or cancellation reverts, stop.

---

## Step 6: Test Recurring Buy (DCA) Plan
1. Switch to the **Recurring** tab.
2. Select **NVDAc**. Amount per buy: **2 USDC**.
3. Total buys: **2** (Total: 4 USDC).
4. Interval: **1 Hour** (minimum interval).
5. Price Ceiling: Enabled, set to +20% above market.
6. Click **Create Recurring Plan** and approve USDC deposit (4 USDC).
7. **Basescan Verification:**
   - Transfer of 4 USDC into `LimitOrderBook`.
   - Event `DCAPlanCreated` emitted.
   - First buy executes or is queued according to keeper parameters.
8. Cancel the plan before the second interval to verify partial/remaining USDC refund.
9. **Basescan Verification:**
   - Remaining unspent USDC refunded back to `USER_ADDRESS`.
   - Event `DCAPlanCancelled` emitted.

---

## Emergency Abort Criteria
Halt testing and report immediately if:
1. `transfer` or `transferFrom` reverts with a policy restriction or pause error.
2. Order book accounting does not match token balances on Basescan.
3. Keeper execution causes unexpected slippage or oracle deviation error.
