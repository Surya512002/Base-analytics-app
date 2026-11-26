"use client";

import Link from "next/link";
import type { WalletAppState } from "@/hooks/useWalletApp";
import { useLimitOrders } from "@/src/lib/limitOrders/useLimitOrders";
import { getOrdersConfigError } from "@/src/config/limitOrders";
import { AUTO_INVEST_HREF, LIMIT_ORDERS_HREF } from "@/lib/constants/destinations";
import MyOrdersPanel from "./MyOrdersPanel";
import MyPlansPanel from "./MyPlansPanel";

const card = "rounded-2xl border border-[var(--border-subtle)] bg-[var(--surface)] p-5 text-center text-sm text-[var(--ink-muted)]";
const link = "inline-flex min-h-[44px] items-center rounded-xl border border-[var(--border-subtle)] px-4 text-sm font-bold text-[var(--ink)] hover:border-[var(--brand)]";

/** Account: the wallet's open orders and auto-invest plans, with the same panels the Trade screens use. */
export default function AccountOrders({ app, onRequestConnect }: { app: WalletAppState; onRequestConnect?: () => void }) {
  const orders = useLimitOrders(app);
  const { config, chainId, walletAddress, ordersStatus, openOrders, historyOrders, plans, marketStates, txSubmitting } = orders;
  const quoteSymbol = config.quoteToken.symbol;
  const quoteDecimals = config.quoteToken.decimals;
  const notLive = /^0x0{40}$/i.test(config.orderBook) ? "Orders aren't live on this network yet." : getOrdersConfigError(config, chainId);

  const newLinks = (
    <div className="flex flex-wrap justify-center gap-2">
      <Link href={LIMIT_ORDERS_HREF} className={link}>New limit or stop order</Link>
      <Link href={AUTO_INVEST_HREF} className={link}>New auto-invest plan</Link>
    </div>
  );

  let notice: string | null = null;
  if (notLive) notice = notLive;
  else if (walletAddress && ordersStatus === "loading") notice = "Reading your orders from Base…";
  else if (walletAddress && ordersStatus === "error") notice = "Your orders couldn't be read just now. We'll keep trying. Anything you placed stays on Base.";

  return (
    <section aria-label="Orders and plans" className="mx-auto w-full max-w-3xl space-y-4">
      {!walletAddress ? (
        <div className={`${card} space-y-3`}>
          <p>Connect your wallet to see and cancel your orders and plans.</p>
          <button type="button" onClick={onRequestConnect} className="min-h-[44px] rounded-xl bg-[var(--brand)] px-5 text-sm font-bold text-white">
            Connect wallet
          </button>
        </div>
      ) : notice ? (
        <p role="status" className={card}>{notice}</p>
      ) : (
        <>
          <h2 className="text-lg font-black text-[var(--ink)]">Orders</h2>
          {openOrders.length + historyOrders.length === 0 ? (
            <p className={card}>No limit or stop orders yet.</p>
          ) : (
            <MyOrdersPanel
              openOrders={openOrders}
              historyOrders={historyOrders}
              markets={marketStates}
              quoteSymbol={quoteSymbol}
              quoteDecimals={quoteDecimals}
              onCancelOrder={orders.cancelOrder}
              onRefundExpired={orders.refundExpired}
              onUpdateOrder={orders.updateOrder}
              isSubmitting={txSubmitting}
            />
          )}
          <h2 className="text-lg font-black text-[var(--ink)]">Auto-invest plans</h2>
          {plans.length === 0 ? (
            <p className={card}>No auto-invest plans yet.</p>
          ) : (
            <MyPlansPanel
              plans={plans}
              markets={marketStates}
              quoteSymbol={quoteSymbol}
              quoteDecimals={quoteDecimals}
              onCancelPlan={orders.cancelDca}
              isSubmitting={txSubmitting}
              rulesCtx={{ chainId, orderBook: config.orderBook, owner: walletAddress, sign: orders.signMessage }}
            />
          )}
        </>
      )}
      {newLinks}
    </section>
  );
}
