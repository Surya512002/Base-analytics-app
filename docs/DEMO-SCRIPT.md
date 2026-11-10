# Stocks Maxxing Demo Script (Base Sepolia)

A 3-minute video walkthrough demonstrating on-chain limit, stop-loss, trailing stop, bracket (OCO), and recurring DCA orders for tokenized stocks on Base Sepolia.

---

## Pre-Recording Checklist

- [ ] **Throwaway Test Wallet**: Funded with testnet ETH and mock USDC on Base Sepolia (`chainId: 84532`).
- [ ] **Environment Configuration**: Set `NEXT_PUBLIC_LIMIT_ORDERS_ENABLED=true` in `.env.local`.
- [ ] **Restart Dev Server**: After editing `.env.local`, restart Next.js (`npm run dev` or `npm start`).
- [ ] **Keeper Daemon Active**: Keep the testnet keeper running in a background terminal:
  ```powershell
  $env:CHAIN="baseSepolia"
  $env:RPC_URL="https://sepolia.base.org"
  $env:ORDER_BOOK="0xC7fBA8EB5442760F83266C32F3Bc2E5c65079e46"
  node limit-orders/src/keeper.js
  ```
- [ ] **Initial Balances**: Ensure test wallet has mock stock and quote tokens from the testnet faucet:
  ```powershell
  node limit-orders/scripts/testnet-faucet.js 0xYourTestWalletAddress
  ```

---

## 3-Minute Video Demo Steps (8–10 Steps)

### Step 1: Connect Wallet & Select Base Sepolia (0:00 – 0:15)
- Open the application at `/swap` and click the **Orders** tab.
- Switch wallet to **Base Sepolia** (`84532`).
- Note that connection requires **no automatic signature requests** (`personal_sign` removed) and **no forced network switches**.
- Verify the header badge displays **Base Sepolia (Testnet)**.

### Step 2: Explore Mock Equities Selector (0:15 – 0:30)
- Click the **Stock Asset** dropdown.
- Show the 4 verified mock equity markets:
  1. `mNVDA` — NVIDIA Corp ($188.00)
  2. `mAAPL` — Apple Inc ($171.00)
  3. `mMSFT` — Microsoft Corp ($415.00)
  4. `mGOOGL` — Alphabet Inc ($175.00)
- Select `mAAPL`. Point to the live on-chain Chainlink mock oracle price feed display.

### Step 3: Place a Limit Buy Order (0:30 – 0:50)
- Select the **Limit Buy** tab.
- Enter amount: `100 mUSDC`.
- Set trigger price below current market: e.g. `$165.00` (target dip buy).
- Show the **Oracle-Bounded Fill Guard**: note that execution will only trigger when the price reaches target and within maximum allowed oracle deviation (300 bps).
- Click **Place Limit Buy Order**. Confirm exact allowance approval and order submission in wallet.

### Step 4: Set Up a Take-Profit & Stop-Loss (0:50 – 1:15)
- Switch to **Limit Sell (Take-Profit)**: target `$185.00` to lock in profits when the price rallies.
- Switch to **Stop-Loss**: target `$155.00`.
- **Notice the Callout**: Point out the explicit safety notice: *"Not guaranteed — subject to market liquidity and keeper execution timing during volatile gaps"*.
- Explain how stop-loss orders escrow tokens in the order book contract until filled or cancelled.

### Step 5: Place a Bracket Order (OCO - One-Cancels-the-Other) (1:15 – 1:40)
- Click the **Bracket** tab.
- Enter stock amount: `0.5 mAAPL`.
- Set **Take-Profit Upper Price**: `$185.00` (+8.1%).
- Set **Stop-Loss Lower Price**: `$160.00` (-6.4%).
- Explain the atomic escrow: single asset deposit backs both legs. When one leg is triggered and filled by the keeper, the remaining leg is automatically cancelled on-chain.
- Click **Create Bracket Order** and confirm.

### Step 6: Create a Trailing Stop Order (1:40 – 2:05)
- Select the **Trailing Stop** tab.
- Set a trailing delta of `5.0%`.
- Explain how the ratchet mechanism works:
  - If `mAAPL` climbs to `$180.00`, the stop-price ratchets up to `$171.00`.
  - The stop-price never ratchets downward.
- Submit the trailing stop order.

### Step 7: Schedule a Recurring Buy (DCA) (2:05 – 2:25)
- Navigate to the **Recurring** sub-tab.
- Set up a DCA stream: `50 mUSDC` into `mNVDA` every 7 days.
- Show interval options (1 hour, 1 day, 7 days, 30 days).
- Confirm the recurring plan.

### Step 8: Edit, Cancel, & Refund Open Orders (2:25 – 2:45)
- Scroll to **My Orders** at the bottom of the page.
- Show open Limit Buy, Bracket, and Trailing Stop orders.
- Click **Edit** on the Limit Buy: update the trigger price from `$165.00` to `$168.00`. Confirm transaction.
- Click **Cancel** on a test order: watch tokens return immediately to your wallet with zero fee deduction.

### Step 9: Live Keeper Execution & Fill Simulation (2:45 – 3:00)
- In the operator terminal, move the oracle price to trigger the limit order:
  ```powershell
  node limit-orders/scripts/testnet-set-price.js mAAPL 164.50
  ```
- Show the keeper terminal detecting the condition:
  `[KEEPER] Market mAAPL price $164.50 <= trigger $168.00 -> executing fillOrderId(id)`
- Refresh the UI: order status switches to **Filled** with a verified Basescan testnet transaction link.
- Conclude demo highlighting non-custodial architecture, EIP-7702 upgrade protection, and exact approvals.
