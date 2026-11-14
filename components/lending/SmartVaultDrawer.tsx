"use client";

/**
 * In-app Smart Deposit / Withdraw for stock pair vaults (Beefy CoW on Aerodrome, e.g. AMDc-USDC),
 * plus "Get {stock}" for single-stock markets. Nobody needs to hold both tokens or leave the app:
 * the planner reads the vault's live ratio, swaps only what's missing, adds liquidity and stakes,
 * all in one batch (one signature on smart wallets). Every plan is simulated in order against
 * the chain before the wallet opens, approvals are exact, and every call carries the builder code.
 */
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { erc20Abi, formatUnits, parseUnits, type Address } from "viem";
import { AlertTriangle, ArrowDownUp, Check, ExternalLink, Loader2, ShieldCheck, Sparkles, X } from "lucide-react";
import type { ConnectionType } from "@/lib/types/wallet";
import { createBasePublicClient } from "@/lib/utils/base-rpc";
import { sendAppTransactions } from "@/lib/utils/send-app-tx";
import { finalizeAppTransactionBatch, type ContractCall } from "@/lib/utils/tx";
import {
  BEEFY_VAULT_ABI,
  NOT_CALM_MESSAGE,
  NOT_CALM_SELECTOR,
  planClmDeposit,
  readClmCalm,
  planClmWithdraw,
  readClmVault,
  type ClmDepositPlan,
  type ClmVault,
  type ClmWithdrawPlan,
  type PayAsset,
} from "@/lib/lending/zap/clm-zap";
import { planGetToken, USDC_ADDRESS, type GetTokenPlan } from "@/lib/lending/zap/get-token";
import { useCompliance } from "@/hooks/useCompliance";

type Pub = ReturnType<typeof createBasePublicClient>;

export type SmartVaultTarget =
  | { mode: "lp"; vault: Address; stockSymbol: string; apy: number; venue: string; sourceLink: string }
  | {
      mode: "get";
      token: Address;
      symbol: string;
      decimals: number;
      /** What the user wants the token for, e.g. "deposit on Aave v4 · Beefy". */
      purpose: string;
      /** Continue to the market once the user holds the token. */
      onContinue?: () => void;
    };

type Props = {
  target: SmartVaultTarget | null;
  onClose: () => void;
  connType: ConnectionType | null;
  userAddress: string | null;
  onRequestConnect?: () => void;
  onDone?: (message: string) => void;
};

type Phase = "idle" | "simulating" | "signing" | "confirming" | "done" | "error";

const fmt = (n: number, max = 4) =>
  n === 0 ? "0" : n < 0.0001 ? "<0.0001" : n.toLocaleString(undefined, { maximumFractionDigits: max });
const usd = (n: number) => `$${n.toLocaleString(undefined, { maximumFractionDigits: n < 10 ? 2 : 0 })}`;
const safeParse = (v: string, d: number) => {
  try {
    return v && Number(v) > 0 ? parseUnits(v, d) : BigInt(0);
  } catch {
    return BigInt(0);
  }
};
const errText = (e: unknown) => {
  const m = e instanceof Error ? e.message : String(e);
  if (/user rejected|denied|rejected the request/i.test(m)) return "You cancelled in your wallet.";
  return m.split("\n")[0].slice(0, 180);
};

/** Run the calls in order with state carried between them (eth_simulateV1). */
async function simulateInOrder(pub: Pub, user: Address, calls: ContractCall[]): Promise<string | null> {
  try {
    const batch = finalizeAppTransactionBatch(calls);
    const sim = await pub.simulateCalls({
      account: user,
      calls: batch.map((c) => ({ to: c.to, data: c.data, value: c.value })),
    });
    const bad = sim.results.findIndex((r) => r.status !== "success");
    if (bad === -1) return null;
    const why = String((sim.results[bad] as { error?: Error }).error?.message ?? "");
    if (why.includes(NOT_CALM_SELECTOR)) return NOT_CALM_MESSAGE;
    return `Step ${bad + 1} would fail on-chain right now. Try a smaller amount or refresh.`;
  } catch {
    // An RPC without eth_simulateV1 shouldn't block the user; the wallet still simulates.
    return null;
  }
}

export default function SmartVaultDrawer(props: Props) {
  const { target, onClose } = props;
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);
  useEffect(() => {
    if (!target) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    return () => {
      document.body.style.overflow = prev;
      window.removeEventListener("keydown", onKey);
    };
  }, [target, onClose]);
  if (!target || !mounted) return null;
  return createPortal(
    <div
      className="fixed inset-0 z-[100] flex items-end justify-end bg-[var(--overlay)] backdrop-blur-xs sm:items-stretch"
      onClick={onClose}
      role="dialog"
      aria-modal="true"
      aria-labelledby="smart-vault-title"
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className="flex max-h-[92dvh] w-full flex-col overflow-hidden rounded-t-3xl border-t border-[var(--border-subtle)] bg-[var(--surface-3)] shadow-2xl sm:h-[100dvh] sm:max-h-[100dvh] sm:max-w-md sm:rounded-none sm:border-l sm:border-t-0"
      >
        {target.mode === "lp" ? <LpPanel {...props} target={target} /> : <GetPanel {...props} target={target} />}
      </div>
    </div>,
    document.body
  );
}

// ─────────────────────────── shared bits ───────────────────────────

function Header({ title, subtitle, onClose }: { title: string; subtitle: string; onClose: () => void }) {
  return (
    <div className="flex items-start justify-between gap-3 border-b border-[var(--border-subtle)] p-4">
      <div className="min-w-0">
        <h2 id="smart-vault-title" className="truncate text-base font-black text-[var(--ink)]">
          {title}
        </h2>
        <p className="mt-0.5 text-xs text-[var(--ink-muted)]">{subtitle}</p>
      </div>
      <button
        type="button"
        onClick={onClose}
        aria-label="Close"
        className="cursor-pointer rounded-lg p-1.5 text-[var(--ink-muted)] transition hover:bg-[var(--surface-2)] hover:text-[var(--ink)]"
      >
        <X size={18} />
      </button>
    </div>
  );
}

function Steps({ labels, phase }: { labels: string[]; phase: Phase }) {
  if (!labels.length) return null;
  const done = phase === "done";
  const active = phase === "signing" || phase === "confirming";
  return (
    <ol className="space-y-1.5 rounded-2xl border border-[var(--border-subtle)] bg-[var(--surface-2)] p-3">
      <li className="mb-1 text-[10px] font-black uppercase tracking-wide text-[var(--ink-dim)]">What happens, in order</li>
      {labels.map((l, i) => (
        <li key={i} className="flex items-center gap-2 text-xs text-[var(--ink)]">
          <span
            className={`flex h-5 w-5 shrink-0 items-center justify-center rounded-full text-[10px] font-black ${
              done ? "bg-emerald-500 text-white" : "bg-[var(--surface)] text-[var(--ink-muted)]"
            }`}
          >
            {done ? <Check size={11} /> : active ? <Loader2 size={11} className="animate-spin" /> : i + 1}
          </span>
          {l}
        </li>
      ))}
    </ol>
  );
}

function AmountInput({
  value,
  onChange,
  symbol,
  balance,
  onMax,
}: {
  value: string;
  onChange: (v: string) => void;
  symbol: string;
  balance: number | null;
  onMax?: () => void;
}) {
  return (
    <div className="rounded-2xl border border-[var(--border-subtle)] bg-[var(--surface)] p-3">
      <div className="flex items-center gap-2">
        <input
          value={value}
          onChange={(e) => onChange(e.target.value.replace(/[^\d.]/g, ""))}
          inputMode="decimal"
          placeholder="0.0"
          aria-label={`Amount of ${symbol}`}
          className="min-w-0 flex-1 bg-transparent font-mono text-2xl font-black text-[var(--ink)] outline-none"
        />
        <span className="text-sm font-black text-[var(--ink-muted)]">{symbol}</span>
      </div>
      <div className="mt-1 flex items-center justify-between text-[11px] text-[var(--ink-dim)]">
        <span>Wallet: {balance == null ? "—" : `${fmt(balance, 6)} ${symbol}`}</span>
        {onMax && balance ? (
          <button type="button" onClick={onMax} className="cursor-pointer font-black text-[var(--brand-text)] hover:underline">
            Max
          </button>
        ) : null}
      </div>
    </div>
  );
}

function ActionButton({
  label,
  disabled,
  busy,
  onClick,
}: {
  label: string;
  disabled?: boolean;
  busy?: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled || busy}
      className="flex w-full cursor-pointer items-center justify-center gap-2 rounded-2xl bg-[var(--brand)] py-3 text-sm font-black text-white transition hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-50"
    >
      {busy && <Loader2 size={15} className="animate-spin" />}
      {label}
    </button>
  );
}

function TxResult({ phase, hash, error }: { phase: Phase; hash: string | null; error: string | null }) {
  if (phase === "error" && error)
    return (
      <p className="flex items-start gap-1.5 rounded-xl bg-red-500/10 p-2.5 text-xs text-red-600 dark:text-red-400">
        <AlertTriangle size={13} className="mt-0.5 shrink-0" /> {error}
      </p>
    );
  if ((phase === "confirming" || phase === "done") && hash)
    return (
      <a
        href={`https://basescan.org/tx/${hash}`}
        target="_blank"
        rel="noopener noreferrer"
        className="flex items-center justify-center gap-1 text-xs font-bold text-[var(--brand-text)] hover:underline"
      >
        {phase === "done" ? "Done. View transaction" : "Confirming. View transaction"} <ExternalLink size={11} />
      </a>
    );
  return null;
}

/** Sign + wait. Returns the hash. */
async function execute(
  pub: Pub,
  connType: ConnectionType | null,
  user: Address,
  calls: ContractCall[],
  set: { phase: (p: Phase) => void; hash: (h: string) => void }
) {
  set.phase("simulating");
  const simErr = await simulateInOrder(pub, user, calls);
  if (simErr) throw new Error(simErr);
  set.phase("signing");
  const hash = await sendAppTransactions(connType ?? "injected", user, calls, { atomicBatch: true });
  set.hash(hash);
  set.phase("confirming");
  if (/^0x[0-9a-fA-F]{64}$/.test(hash)) {
    const r = await pub.waitForTransactionReceipt({ hash: hash as `0x${string}`, timeout: 120_000 });
    if (r.status !== "success") throw new Error("The transaction reverted on-chain. Nothing was deposited.");
  }
  set.phase("done");
  return hash;
}

function useBalances(pub: Pub, user: Address | null, tokens: Array<{ address: Address; decimals: number }>, vault?: Address) {
  const [bal, setBal] = useState<{ eth: number; tokens: number[]; raw: bigint[]; vaultShares: bigint } | null>(null);
  const key = tokens.map((t) => t.address).join(",");
  const refresh = useCallback(async () => {
    if (!user) return setBal(null);
    try {
      const [eth, ...rest] = await Promise.all([
        pub.getBalance({ address: user }),
        ...tokens.map((t) => pub.readContract({ address: t.address, abi: erc20Abi, functionName: "balanceOf", args: [user] })),
        ...(vault ? [pub.readContract({ address: vault, abi: BEEFY_VAULT_ABI, functionName: "balanceOf", args: [user] })] : []),
      ]);
      const raw = rest.slice(0, tokens.length) as bigint[];
      setBal({
        eth: Number(formatUnits(eth, 18)),
        raw,
        tokens: raw.map((r, i) => Number(formatUnits(r, tokens[i].decimals))),
        vaultShares: vault ? (rest[tokens.length] as bigint) : BigInt(0),
      });
    } catch {
      /* keep the last good numbers */
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pub, user, key, vault]);
  useEffect(() => {
    refresh();
  }, [refresh]);
  return { bal, refresh };
}

function Gate({ userAddress, onRequestConnect, blocked }: { userAddress: string | null; onRequestConnect?: () => void; blocked: boolean }) {
  if (blocked)
    return (
      <p className="rounded-xl bg-amber-500/10 p-2.5 text-xs text-amber-700 dark:text-amber-400">
        Stock vaults aren&apos;t available in your region.
      </p>
    );
  if (!userAddress)
    return <ActionButton label="Connect wallet" onClick={() => onRequestConnect?.()} disabled={!onRequestConnect} />;
  return null;
}

// ─────────────────────────── LP vault: deposit / withdraw ───────────────────────────

function LpPanel({
  target,
  onClose,
  connType,
  userAddress,
  onRequestConnect,
  onDone,
}: Props & { target: Extract<SmartVaultTarget, { mode: "lp" }> }) {
  const pub = useMemo(() => createBasePublicClient(), []);
  const user = (userAddress as Address | null) ?? null;
  const compliance = useCompliance();
  const blocked = !compliance.status.features["stocks.lend"] || (compliance.isRestricted && !compliance.canEnter);

  const [info, setInfo] = useState<ClmVault | null>(null);
  const [loadErr, setLoadErr] = useState<string | null>(null);
  useEffect(() => {
    let live = true;
    readClmVault(pub, target.vault)
      .then((i) => live && setInfo(i))
      .catch(() => live && setLoadErr("This vault can't be routed in-app right now."));
    return () => {
      live = false;
    };
  }, [pub, target.vault]);

  const tokens = useMemo(() => (info ? [info.token0, info.token1] : []), [info]);
  const { bal, refresh } = useBalances(pub, user, tokens, target.vault);

  // Beefy CLMs pause deposits while the pool price is off its 2-minute TWAP. Watch it live.
  const [calm, setCalm] = useState<boolean | null>(null);
  useEffect(() => {
    if (!info) return;
    let live = true;
    const check = () => readClmCalm(pub, info).then((c) => live && setCalm(c));
    check();
    const t = setInterval(check, 12_000);
    return () => {
      live = false;
      clearInterval(t);
    };
  }, [pub, info]);
  const depositPaused = calm === false;

  const [tab, setTab] = useState<"deposit" | "withdraw">("deposit");
  const [pay, setPay] = useState<PayAsset>("token0");
  const [amount, setAmount] = useState("");
  const [pctOut, setPctOut] = useState(100);
  const [toUsdc, setToUsdc] = useState(true);
  const [plan, setPlan] = useState<ClmDepositPlan | ClmWithdrawPlan | null>(null);
  const [planErr, setPlanErr] = useState<string | null>(null);
  const [planning, setPlanning] = useState(false);
  const [phase, setPhase] = useState<Phase>("idle");
  const [hash, setHash] = useState<string | null>(null);
  const [txErr, setTxErr] = useState<string | null>(null);
  const reqId = useRef(0);

  // When the user holds no USDC but holds the stock, start from the stock.
  useEffect(() => {
    if (!bal || amount) return;
    if (bal.tokens[0] === 0 && bal.tokens[1] > 0) setPay("token1");
    else if (bal.tokens[0] === 0 && bal.tokens[1] === 0 && bal.eth > 0.0005) setPay("eth");
  }, [bal, amount]);

  const paySym = !info ? "" : pay === "eth" ? "ETH" : pay === "token0" ? info.token0.symbol : info.token1.symbol;
  const payDec = !info ? 18 : pay === "eth" ? 18 : pay === "token0" ? info.token0.decimals : info.token1.decimals;
  const payBal = !bal ? null : pay === "eth" ? bal.eth : pay === "token0" ? bal.tokens[0] : bal.tokens[1];
  const amt = safeParse(amount, payDec);
  const overBalance = payBal != null && Number(amount || 0) > payBal + 1e-12;
  const withdrawShares = bal ? (bal.vaultShares * BigInt(pctOut)) / BigInt(100) : BigInt(0);

  // Debounced live plan.
  useEffect(() => {
    if (!info || !user) return setPlan(null);
    const id = ++reqId.current;
    setPlanErr(null);
    if (tab === "deposit" && (amt <= BigInt(0) || overBalance)) return setPlan(null);
    if (tab === "withdraw" && withdrawShares <= BigInt(0)) return setPlan(null);
    setPlanning(true);
    const t = setTimeout(async () => {
      try {
        const p =
          tab === "deposit"
            ? await planClmDeposit({ client: pub, info, user, pay, amount: amt })
            : await planClmWithdraw({ client: pub, info, user, vaultShares: withdrawShares, toToken0: toUsdc });
        if (id === reqId.current) setPlan(p);
      } catch (e) {
        if (id === reqId.current) {
          setPlan(null);
          setPlanErr(errText(e));
        }
      } finally {
        if (id === reqId.current) setPlanning(false);
      }
    }, 550);
    return () => clearTimeout(t);
  }, [info, user, tab, pay, amt, overBalance, withdrawShares, toUsdc, pub]);

  const onSubmit = async () => {
    if (!plan || !user) return;
    setTxErr(null);
    setHash(null);
    try {
      await execute(pub, connType, user, plan.calls, { phase: setPhase, hash: setHash });
      onDone?.(tab === "deposit" ? `Deposited into ${target.stockSymbol}-USDC vault` : `Withdrew from ${target.stockSymbol}-USDC vault`);
      setAmount("");
      refresh();
    } catch (e) {
      setPhase("error");
      setTxErr(errText(e));
    }
  };

  const busy = phase === "simulating" || phase === "signing" || phase === "confirming";
  const position = plan && tab === "withdraw" ? (plan as ClmWithdrawPlan).expected.valueInToken0 : null;

  return (
    <>
      <Header
        title={`${target.stockSymbol}-USDC vault`}
        subtitle={`${target.apy.toFixed(2)}% APY · ${target.venue} · auto-compounding`}
        onClose={onClose}
      />
      <div className="flex-1 space-y-3 overflow-y-auto p-4">
        <div className="flex items-start gap-2 rounded-2xl bg-[var(--brand-soft)] p-3 text-xs text-[var(--brand-text)]">
          <Sparkles size={14} className="mt-0.5 shrink-0" />
          <span>
            You don&apos;t need both tokens. Pay with USDC, {target.stockSymbol} or ETH and we swap only the missing part,
            add the liquidity and stake it, all in one go.
          </span>
        </div>

        {loadErr ? (
          <div className="space-y-2">
            <p className="rounded-xl bg-amber-500/10 p-2.5 text-xs text-amber-700 dark:text-amber-400">{loadErr}</p>
            <a href={target.sourceLink} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1 text-xs font-bold text-[var(--brand-text)]">
              Open the vault page <ExternalLink size={11} />
            </a>
          </div>
        ) : !info ? (
          <p className="flex items-center gap-2 text-xs text-[var(--ink-muted)]">
            <Loader2 size={14} className="animate-spin" /> Reading the vault from Base…
          </p>
        ) : (
          <>
            <div className="grid grid-cols-2 gap-1 rounded-xl bg-[var(--surface-2)] p-1">
              {(["deposit", "withdraw"] as const).map((t) => (
                <button
                  key={t}
                  type="button"
                  onClick={() => {
                    setTab(t);
                    setPhase("idle");
                    setTxErr(null);
                  }}
                  className={`cursor-pointer rounded-lg py-1.5 text-xs font-black capitalize transition ${
                    tab === t ? "bg-[var(--surface)] text-[var(--ink)] shadow-sm" : "text-[var(--ink-muted)]"
                  }`}
                >
                  {t}
                </button>
              ))}
            </div>

            {tab === "deposit" ? (
              <>
                <div>
                  <p className="mb-1.5 text-[11px] font-bold text-[var(--ink-muted)]">Pay with</p>
                  <div className="grid grid-cols-3 gap-1.5">
                    {(
                      [
                        ["token0", info.token0.symbol, bal?.tokens[0]],
                        ["token1", info.token1.symbol, bal?.tokens[1]],
                        ["eth", "ETH", bal?.eth],
                      ] as const
                    ).map(([k, sym, b]) => (
                      <button
                        key={k}
                        type="button"
                        onClick={() => {
                          setPay(k);
                          setAmount("");
                        }}
                        className={`cursor-pointer rounded-xl border p-2 text-left transition ${
                          pay === k ? "border-[var(--brand)] bg-[var(--brand-soft)]" : "border-[var(--border-subtle)] hover:border-[var(--brand)]/50"
                        }`}
                      >
                        <span className="block text-xs font-black text-[var(--ink)]">{sym}</span>
                        <span className="block truncate font-mono text-[10px] text-[var(--ink-dim)]">{b == null ? "—" : fmt(b)}</span>
                      </button>
                    ))}
                  </div>
                </div>
                <AmountInput
                  value={amount}
                  onChange={setAmount}
                  symbol={paySym}
                  balance={payBal}
                  onMax={() => payBal && setAmount(String(pay === "eth" ? Math.max(0, payBal - 0.0003) : payBal))}
                />
                {overBalance && (
                  <p className="text-xs text-amber-600 dark:text-amber-400">
                    That&apos;s more {paySym} than your wallet holds. Pick another asset above to pay with.
                  </p>
                )}
                <p className="text-[11px] text-[var(--ink-dim)]">
                  Right now the pool takes {Math.round(info.token0ValueShare * 100)}% {info.token0.symbol} /{" "}
                  {100 - Math.round(info.token0ValueShare * 100)}% {info.token1.symbol} · 1 {info.token1.symbol} ≈{" "}
                  {usd(info.priceToken1InToken0)}
                </p>
              </>
            ) : (
              <>
                <div className="rounded-2xl border border-[var(--border-subtle)] bg-[var(--surface)] p-3 text-xs">
                  <p className="text-[var(--ink-muted)]">Your position</p>
                  <p className="font-mono text-lg font-black text-[var(--ink)]">
                    {!bal ? "—" : bal.vaultShares === BigInt(0) ? "Nothing deposited yet" : position != null ? `≈ ${usd(position / (pctOut / 100))}` : "…"}
                  </p>
                </div>
                {bal && bal.vaultShares > BigInt(0) && (
                  <>
                    <div className="grid grid-cols-4 gap-1.5">
                      {[25, 50, 75, 100].map((p) => (
                        <button
                          key={p}
                          type="button"
                          onClick={() => setPctOut(p)}
                          className={`cursor-pointer rounded-lg border py-1.5 text-xs font-black transition ${
                            pctOut === p ? "border-[var(--brand)] bg-[var(--brand-soft)] text-[var(--brand-text)]" : "border-[var(--border-subtle)] text-[var(--ink-muted)]"
                          }`}
                        >
                          {p === 100 ? "All" : `${p}%`}
                        </button>
                      ))}
                    </div>
                    <label className="flex cursor-pointer items-center gap-2 text-xs text-[var(--ink)]">
                      <input type="checkbox" checked={toUsdc} onChange={(e) => setToUsdc(e.target.checked)} />
                      <ArrowDownUp size={12} /> Receive everything as {info.token0.symbol}
                    </label>
                  </>
                )}
              </>
            )}

            {tab === "deposit" && depositPaused && (
              <p className="flex items-start gap-1.5 rounded-xl bg-amber-500/10 p-2.5 text-xs text-amber-700 dark:text-amber-400">
                <Loader2 size={13} className="mt-0.5 shrink-0 animate-spin" />
                <span>{NOT_CALM_MESSAGE} The button turns on by itself when it does.</span>
              </p>
            )}
            {planning && (
              <p className="flex items-center gap-2 text-xs text-[var(--ink-muted)]">
                <Loader2 size={13} className="animate-spin" /> Finding the best route on-chain…
              </p>
            )}
            {planErr && <p className="text-xs text-red-600 dark:text-red-400">{planErr}</p>}
            {plan && !planning && (
              <>
                <Steps labels={plan.steps.map((s) => s.label)} phase={phase} />
                <div className="space-y-1 rounded-2xl border border-[var(--border-subtle)] p-3 text-xs">
                  {tab === "deposit" ? (
                    <>
                      <Row k="Goes into the pool" v={`≈ ${usd((plan as ClmDepositPlan).expected.valueInToken0)}`} />
                      <Row
                        k="Split"
                        v={`${fmt(Number(formatUnits((plan as ClmDepositPlan).expected.deposit0, info.token0.decimals)), 2)} ${info.token0.symbol} + ${fmt(
                          Number(formatUnits((plan as ClmDepositPlan).expected.deposit1, info.token1.decimals)),
                          6
                        )} ${info.token1.symbol}`}
                      />
                      <Row k="Yearly at today's APY" v={`≈ ${usd(((plan as ClmDepositPlan).expected.valueInToken0 * target.apy) / 100)}`} />
                    </>
                  ) : (
                    <>
                      <Row k="You receive about" v={`${usd((plan as ClmWithdrawPlan).expected.valueInToken0)}`} />
                      {!toUsdc && (
                        <Row
                          k="As"
                          v={`${fmt(Number(formatUnits((plan as ClmWithdrawPlan).expected.out0, info.token0.decimals)), 2)} ${info.token0.symbol} + ${fmt(
                            Number(formatUnits((plan as ClmWithdrawPlan).expected.out1, info.token1.decimals)),
                            6
                          )} ${info.token1.symbol}`}
                        />
                      )}
                    </>
                  )}
                  <Row k="Max slippage" v="1%" />
                </div>
                {"warnings" in plan &&
                  plan.warnings.map((w) => (
                    <p key={w} className="flex items-start gap-1.5 text-[11px] text-amber-600 dark:text-amber-400">
                      <AlertTriangle size={12} className="mt-0.5 shrink-0" /> {w}
                    </p>
                  ))}
              </>
            )}
            <TxResult phase={phase} hash={hash} error={txErr} />
          </>
        )}
      </div>
      <div className="space-y-2 border-t border-[var(--border-subtle)] p-4">
        <Gate userAddress={userAddress} onRequestConnect={onRequestConnect} blocked={blocked} />
        {userAddress && !blocked && info && (
          <ActionButton
            label={
              phase === "simulating"
                ? "Checking every step…"
                : phase === "signing"
                  ? "Confirm in your wallet…"
                  : phase === "confirming"
                    ? "Confirming on Base…"
                    : tab === "deposit"
                      ? depositPaused && plan
                        ? "Waiting for the pool to settle…"
                        : plan
                          ? `Deposit ${amount || ""} ${paySym}`.trim()
                          : "Enter an amount"
                      : plan
                        ? `Withdraw ${pctOut === 100 ? "all" : `${pctOut}%`}`
                        : "Nothing to withdraw"
            }
            disabled={!plan || planning || (tab === "deposit" && depositPaused)}
            busy={busy}
            onClick={onSubmit}
          />
        )}
        <p className="flex items-center justify-center gap-1 text-[10px] text-[var(--ink-dim)]">
          <ShieldCheck size={11} /> Simulated before you sign · exact approvals · verified vault
        </p>
      </div>
    </>
  );
}

function Row({ k, v }: { k: string; v: string }) {
  return (
    <p className="flex justify-between gap-3">
      <span className="text-[var(--ink-muted)]">{k}</span>
      <span className="text-right font-mono font-bold text-[var(--ink)]">{v}</span>
    </p>
  );
}

// ─────────────────────────── Get {stock} first ───────────────────────────

function GetPanel({
  target,
  onClose,
  connType,
  userAddress,
  onRequestConnect,
  onDone,
}: Props & { target: Extract<SmartVaultTarget, { mode: "get" }> }) {
  const pub = useMemo(() => createBasePublicClient(), []);
  const user = (userAddress as Address | null) ?? null;
  const compliance = useCompliance();
  const blocked = !compliance.status.features["stocks.lend"] || (compliance.isRestricted && !compliance.canEnter);
  const tokens = useMemo(
    () => [
      { address: USDC_ADDRESS, decimals: 6 },
      { address: target.token, decimals: target.decimals },
    ],
    [target.token, target.decimals]
  );
  const { bal, refresh } = useBalances(pub, user, tokens);
  const [pay, setPay] = useState<"usdc" | "eth">("usdc");
  const [amount, setAmount] = useState("");
  const [plan, setPlan] = useState<GetTokenPlan | null>(null);
  const [planErr, setPlanErr] = useState<string | null>(null);
  const [planning, setPlanning] = useState(false);
  const [phase, setPhase] = useState<Phase>("idle");
  const [hash, setHash] = useState<string | null>(null);
  const [txErr, setTxErr] = useState<string | null>(null);
  const reqId = useRef(0);

  useEffect(() => {
    if (bal && !amount && bal.tokens[0] === 0 && bal.eth > 0.0005) setPay("eth");
  }, [bal, amount]);

  const dec = pay === "eth" ? 18 : 6;
  const payBal = !bal ? null : pay === "eth" ? bal.eth : bal.tokens[0];
  const amt = safeParse(amount, dec);
  const overBalance = payBal != null && Number(amount || 0) > payBal + 1e-12;

  useEffect(() => {
    if (!user || amt <= BigInt(0) || overBalance) return setPlan(null);
    const id = ++reqId.current;
    setPlanErr(null);
    setPlanning(true);
    const t = setTimeout(async () => {
      try {
        const p = await planGetToken({ user, pay, amount: amt, tokenOut: target.token, tokenOutSymbol: target.symbol });
        if (id === reqId.current) setPlan(p);
      } catch (e) {
        if (id === reqId.current) {
          setPlan(null);
          setPlanErr(errText(e));
        }
      } finally {
        if (id === reqId.current) setPlanning(false);
      }
    }, 550);
    return () => clearTimeout(t);
  }, [user, pay, amt, overBalance, target.token, target.symbol]);

  const onSubmit = async () => {
    if (!plan || !user) return;
    setTxErr(null);
    setHash(null);
    try {
      await execute(pub, connType, user, plan.calls, { phase: setPhase, hash: setHash });
      onDone?.(`Bought ${target.symbol}`);
      setAmount("");
      refresh();
    } catch (e) {
      setPhase("error");
      setTxErr(errText(e));
    }
  };
  const busy = phase === "simulating" || phase === "signing" || phase === "confirming";
  const held = bal?.tokens[1] ?? 0;

  return (
    <>
      <Header title={`Get ${target.symbol}`} subtitle={`To ${target.purpose}. Buy it here, no need to leave.`} onClose={onClose} />
      <div className="flex-1 space-y-3 overflow-y-auto p-4">
        <div className="rounded-2xl border border-[var(--border-subtle)] bg-[var(--surface)] p-3 text-xs">
          <p className="text-[var(--ink-muted)]">You hold</p>
          <p className="font-mono text-lg font-black text-[var(--ink)]">
            {bal ? `${fmt(held, 6)} ${target.symbol}` : "—"}
          </p>
        </div>
        <div className="grid grid-cols-2 gap-1.5">
          {(
            [
              ["usdc", "USDC", bal?.tokens[0]],
              ["eth", "ETH", bal?.eth],
            ] as const
          ).map(([k, sym, b]) => (
            <button
              key={k}
              type="button"
              onClick={() => {
                setPay(k);
                setAmount("");
              }}
              className={`cursor-pointer rounded-xl border p-2 text-left transition ${
                pay === k ? "border-[var(--brand)] bg-[var(--brand-soft)]" : "border-[var(--border-subtle)] hover:border-[var(--brand)]/50"
              }`}
            >
              <span className="block text-xs font-black text-[var(--ink)]">Pay with {sym}</span>
              <span className="block font-mono text-[10px] text-[var(--ink-dim)]">{b == null ? "—" : fmt(b)}</span>
            </button>
          ))}
        </div>
        <AmountInput
          value={amount}
          onChange={setAmount}
          symbol={pay === "eth" ? "ETH" : "USDC"}
          balance={payBal}
          onMax={() => payBal && setAmount(String(pay === "eth" ? Math.max(0, payBal - 0.0003) : payBal))}
        />
        {overBalance && <p className="text-xs text-amber-600 dark:text-amber-400">That&apos;s more than your wallet holds.</p>}
        {planning && (
          <p className="flex items-center gap-2 text-xs text-[var(--ink-muted)]">
            <Loader2 size={13} className="animate-spin" /> Quoting on-chain…
          </p>
        )}
        {planErr && <p className="text-xs text-red-600 dark:text-red-400">{planErr}</p>}
        {plan && !planning && (
          <>
            <Steps labels={plan.steps} phase={phase} />
            <div className="space-y-1 rounded-2xl border border-[var(--border-subtle)] p-3 text-xs">
              <Row k="You get about" v={`${fmt(Number(formatUnits(plan.quotedOut, target.decimals)), 6)} ${target.symbol}`} />
              <Row k="At least" v={`${fmt(Number(formatUnits(plan.minOut, target.decimals)), 6)} ${target.symbol}`} />
            </div>
          </>
        )}
        <TxResult phase={phase} hash={hash} error={txErr} />
      </div>
      <div className="space-y-2 border-t border-[var(--border-subtle)] p-4">
        <Gate userAddress={userAddress} onRequestConnect={onRequestConnect} blocked={blocked} />
        {userAddress && !blocked && (
          <ActionButton
            label={
              phase === "simulating"
                ? "Checking every step…"
                : phase === "signing"
                  ? "Confirm in your wallet…"
                  : phase === "confirming"
                    ? "Confirming on Base…"
                    : plan
                      ? `Buy ${target.symbol}`
                      : "Enter an amount"
            }
            disabled={!plan || planning}
            busy={busy}
            onClick={onSubmit}
          />
        )}
        {target.onContinue && held > 0 && (
          <button
            type="button"
            onClick={target.onContinue}
            className="w-full cursor-pointer rounded-2xl border border-[var(--brand)] py-2.5 text-sm font-black text-[var(--brand-text)] transition hover:bg-[var(--brand-soft)]"
          >
            Continue: {target.purpose}
          </button>
        )}
        <p className="flex items-center justify-center gap-1 text-[10px] text-[var(--ink-dim)]">
          <ShieldCheck size={11} /> Simulated before you sign · exact approvals · 1% max slippage
        </p>
      </div>
    </>
  );
}
