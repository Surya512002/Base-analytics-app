"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  AlertTriangle,
  CheckCircle2,
  Clock,
  Copy,
  Link2,
  Loader2,
  Lock,
  ShieldCheck,
  Users,
} from "lucide-react";
import { formatUnits, parseEther, parseEventLogs, parseUnits } from "viem";
import SectionCard from "@/components/ui/SectionCard";
import { BASE_STOCKS, BASE_STOCK_DECIMALS } from "@/lib/stocks/base-stocks";
import { APP_URL_WEB, CAMPAIGN_CONTRACT } from "@/lib/constants/env";
import { ERC20_ABI, USDC_BASE } from "@/lib/constants/contracts";
import { createPublicOnlyBaseClient } from "@/lib/utils/base-rpc";
import { encodeContractCall, type ContractCall } from "@/lib/utils/tx";
import { sendAppTransactions } from "@/lib/utils/send-app-tx";
import { resolveBasenameClient } from "@/lib/utils/resolve-basename";
import { CAMPAIGN_ABI } from "@/lib/voucher/campaign-abi";
import {
  CAMPAIGN_MAX_CLAIMS,
  CAMPAIGN_MAX_LABEL,
  CAMPAIGN_MAX_MESSAGE,
  ZERO_ADDRESS,
  buildCampaignLink,
  buildCampaignShortLink,
  explainCampaignError,
  generateCampaignSecret,
  hashCampaignSecret,
  parseCampaignLink,
  validateCampaignInput,
} from "@/lib/voucher/campaign";
import type { CampaignPublicView, EligibilityResult } from "@/lib/voucher/campaign-server";
import { EligibilityChecklist, OwnershipTerms, SenderIdentity } from "@/components/voucher/CampaignTrust";
import type { WalletAppState } from "@/hooks/useWalletApp";

// ───────────────────────────── local link vault ─────────────────────────────
// The secret is NOT stored on any server. The creator's browser keeps a copy so they can
// re-copy the link; losing it (and the link) means unclaimed funds can only be refunded via Cancel.

interface SavedCampaign {
  id: string;
  secret: string;
  createdAt: number;
  asset: string;
  slots: number;
}

const vaultKey = (addr: string) => `base_campaign_links_v1_${addr.toLowerCase()}`;

function loadSaved(addr: string): SavedCampaign[] {
  try {
    const raw = localStorage.getItem(vaultKey(addr));
    const parsed = raw ? (JSON.parse(raw) as SavedCampaign[]) : [];
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function saveCampaign(addr: string, entry: SavedCampaign) {
  try {
    const next = [entry, ...loadSaved(addr).filter((e) => e.id !== entry.id)].slice(0, 50);
    localStorage.setItem(vaultKey(addr), JSON.stringify(next));
  } catch {
    /* private mode — link is still shown on screen */
  }
}

// ───────────────────────────── helpers ─────────────────────────────

type Mode = "claim" | "create" | "mine";
const UNLOCK_OPTIONS = [
  { id: "now", label: "Right away", secs: 0 },
  { id: "1h", label: "In 1 hour", secs: 3_600 },
  { id: "24h", label: "Tomorrow", secs: 86_400 },
  { id: "7d", label: "In 7 days", secs: 7 * 86_400 },
] as const;

const EXPIRY_OPTIONS = [
  { id: "none", label: "No expiry", secs: 0 },
  { id: "24h", label: "24 hours", secs: 86_400 },
  { id: "7d", label: "7 days", secs: 7 * 86_400 },
  { id: "30d", label: "30 days", secs: 30 * 86_400 },
] as const;

const SLOT_PRESETS = [1, 10, 50, 100, 500] as const;

function fmtDate(sec: number) {
  return sec ? new Date(sec * 1000).toLocaleString() : "";
}

function decimalsFor(asset: string): number {
  if (asset === "ETH") return 18;
  if (asset === "USDC") return 6;
  return BASE_STOCKS.find((s) => s.symbol === asset)?.decimals ?? BASE_STOCK_DECIMALS;
}

function toBaseUnits(asset: string, total: string): bigint | null {
  try {
    if (!/^\d+(\.\d+)?$/.test(total.trim())) return null;
    if (asset === "ETH") return parseEther(total.trim());
    return parseUnits(total.trim(), decimalsFor(asset));
  } catch {
    return null;
  }
}

function assetAddress(asset: string): `0x${string}` {
  if (asset === "ETH") return ZERO_ADDRESS;
  if (asset === "USDC") return USDC_BASE as `0x${string}`;
  return (BASE_STOCKS.find((s) => s.symbol === asset)?.address ?? ZERO_ADDRESS) as `0x${string}`;
}

async function copy(text: string) {
  try {
    await navigator.clipboard.writeText(text);
    return true;
  } catch {
    return false;
  }
}

// ───────────────────────────── component ─────────────────────────────

export default function VoucherCampaignPanel({ app }: { app: WalletAppState }) {
  const address = app.wallet?.address as `0x${string}` | undefined;
  const connType = app.connType;
  const [mode, setMode] = useState<Mode>("create");
  const [cfg, setCfg] = useState<{
    ready: boolean;
    claimSigner: string | null;
    verifiedClaimsAvailable: boolean;
  } | null>(null);

  useEffect(() => {
    fetch("/api/voucher/campaign/config", { cache: "no-store" })
      .then((r) => r.json())
      .then(setCfg)
      .catch(() => setCfg({ ready: false, claimSigner: null, verifiedClaimsAvailable: false }));
  }, []);

  // Land on the claim view when the visitor arrived through a shared campaign link.
  const [claimId, setClaimId] = useState("");
  const [claimSecret, setClaimSecret] = useState("");
  useEffect(() => {
    const parsed = parseCampaignLink({
      pathname: window.location.pathname,
      search: window.location.search,
      hash: window.location.hash,
    });
    if (parsed.campaignId) {
      setClaimId(parsed.campaignId);
      if (parsed.secret) setClaimSecret(parsed.secret);
      setMode("claim");
    }
  }, []);

  const notLive = cfg !== null && !cfg.ready;

  return (
    <div className="space-y-4">
      <div role="tablist" aria-label="Shared link actions" className="flex gap-1 glass-panel p-1 rounded-2xl">
        {(
          [
            ["create", "Create link"],
            ["claim", "Claim"],
            ["mine", "My links"],
          ] as const
        ).map(([id, label]) => (
          <button
            key={id}
            type="button"
            role="tab"
            aria-selected={mode === id}
            onClick={() => setMode(id)}
            className={`flex-1 min-h-[40px] rounded-xl text-[11px] font-black uppercase tracking-wide transition ${
              mode === id ? "tab-active" : "text-[var(--ink-muted)] hover:text-[var(--ink)]"
            }`}
          >
            {label}
          </button>
        ))}
      </div>

      {notLive && (
        <div className="rounded-2xl border border-amber-500/30 bg-amber-500/10 p-4 text-sm text-[var(--ink)] flex gap-3">
          <AlertTriangle size={18} className="shrink-0 text-amber-500 mt-0.5" />
          <p>
            Shared-link vouchers aren&apos;t live on this deployment yet. The campaign contract hasn&apos;t been
            deployed/configured (<code>NEXT_PUBLIC_CAMPAIGN_CONTRACT</code>), so nothing here can move funds.
          </p>
        </div>
      )}

      {mode === "create" && (
        <CreateCampaign
          address={address}
          connType={connType}
          cfg={cfg}
          disabled={notLive}
          onCreated={() => setMode("mine")}
        />
      )}
      {mode === "claim" && (
        <ClaimCampaign
          address={address}
          connType={connType}
          initialId={claimId}
          initialSecret={claimSecret}
          disabled={notLive}
        />
      )}
      {mode === "mine" && <MyCampaigns address={address} connType={connType} />}
    </div>
  );
}

// ───────────────────────────── create ─────────────────────────────

function CreateCampaign({
  address,
  connType,
  cfg,
  disabled,
  onCreated,
}: {
  address: `0x${string}` | undefined;
  connType: WalletAppState["connType"];
  cfg: { claimSigner: string | null; verifiedClaimsAvailable: boolean } | null;
  disabled: boolean;
  onCreated: () => void;
}) {
  const [asset, setAsset] = useState("USDC");
  const [total, setTotal] = useState("50");
  const [slots, setSlots] = useState(50);
  const [message, setMessage] = useState("");
  const [label, setLabel] = useState("");
  const [expiry, setExpiry] = useState<(typeof EXPIRY_OPTIONS)[number]["id"]>("7d");
  const [unlock, setUnlock] = useState<(typeof UNLOCK_OPTIONS)[number]["id"]>("now");
  const [committed, setCommitted] = useState(false);
  const [gatedPref, setGatedPref] = useState(true);
  const [ackSafety, setAckSafety] = useState(false);
  const [busy, setBusy] = useState("");
  const [error, setError] = useState("");
  const [result, setResult] = useState<{ id: string; link: string; shortLink: string } | null>(null);
  const [copied, setCopied] = useState(false);
  const labelTouched = useRef(false);
  const [nowSec] = useState(() => Math.floor(Date.now() / 1000));

  const isStock = asset !== "ETH" && asset !== "USDC";
  // Region/kill-switch rules can only be enforced through claim tickets, so stocks always require them.
  const gated = isStock ? true : gatedPref;
  const gateUnavailable = gated && !cfg?.verifiedClaimsAvailable;

  // Prefill sender name with the wallet's own Basename — a name that is verifiable.
  useEffect(() => {
    if (!address || labelTouched.current) return;
    resolveBasenameClient(address)
      .then((n) => {
        if (n && !labelTouched.current) setLabel(n);
      })
      .catch(() => undefined);
  }, [address]);

  const totalUnits = toBaseUnits(asset, total);
  const splitsEvenly = totalUnits !== null && slots > 0 && totalUnits % BigInt(slots) === 0n;
  const perClaim =
    totalUnits !== null && splitsEvenly
      ? formatUnits(totalUnits / BigInt(slots), decimalsFor(asset))
      : null;

  const expirySecs = EXPIRY_OPTIONS.find((o) => o.id === expiry)?.secs ?? 0;
  const unlockSecs = UNLOCK_OPTIONS.find((o) => o.id === unlock)?.secs ?? 0;
  const validation = validateCampaignInput(
    {
    asset,
    total,
    maxClaims: slots,
    message,
    senderLabel: label,
    unlockAt: unlockSecs ? nowSec + unlockSecs : undefined,
    // expiry counts from when the gift opens, so the two can never conflict
    expiresAt: expirySecs ? nowSec + unlockSecs + expirySecs : undefined,
      committed,
      gated,
    },
    nowSec
  );

  const create = useCallback(async () => {
    setError("");
    if (!address) return setError("Connect your wallet first.");
    if (!CAMPAIGN_CONTRACT) return setError("Campaign contract is not configured.");
    if (!validation.ok) return setError(validation.errors[0]);
    if (totalUnits === null || !splitsEvenly) return setError("Total must split evenly across the claim slots.");
    if (gated && !cfg?.claimSigner) return setError("Verified claims aren't available right now.");

    const secret = generateCampaignSecret(); // never leaves this browser
    const token = assetAddress(asset);
    const createdAt = Math.floor(Date.now() / 1000);
    const unlockAt = unlockSecs ? BigInt(createdAt + unlockSecs) : 0n;
    const expiresAt = expirySecs ? BigInt(createdAt + unlockSecs + expirySecs) : 0n;
    const params = {
      token,
      totalAmount: totalUnits,
      maxClaims: slots,
      secretHash: hashCampaignSecret(secret),
      unlockAt,
      expiresAt,
      claimSigner: (gated ? cfg!.claimSigner : ZERO_ADDRESS) as `0x${string}`,
      committed,
      message: message.trim(),
      senderLabel: label.trim(),
    };

    try {
      setBusy("Preparing…");
      const pub = createPublicOnlyBaseClient();
      const calls: ContractCall[] = [];
      if (asset === "ETH") {
        calls.push(encodeContractCall(CAMPAIGN_CONTRACT, CAMPAIGN_ABI, "createEthCampaign", [params], totalUnits));
      } else {
        const allowance = (await pub.readContract({
          address: token,
          abi: ERC20_ABI,
          functionName: "allowance",
          args: [address, CAMPAIGN_CONTRACT],
        })) as bigint;
        // Approve exactly what this campaign needs — never an unlimited allowance.
        if (allowance < totalUnits) {
          calls.push(encodeContractCall(token, ERC20_ABI, "approve", [CAMPAIGN_CONTRACT, totalUnits]));
        }
        calls.push(encodeContractCall(CAMPAIGN_CONTRACT, CAMPAIGN_ABI, "createTokenCampaign", [params]));
      }

      const nextId = (await pub.readContract({
        address: CAMPAIGN_CONTRACT,
        abi: CAMPAIGN_ABI,
        functionName: "nextCampaignId",
      })) as bigint;
      const fromBlock = await pub.getBlockNumber();

      setBusy("Confirm in your wallet…");
      const hash = await sendAppTransactions(connType ?? "injected", address, calls);

      setBusy("Waiting for confirmation…");
      let createdId: bigint | null = null;
      try {
        const receipt = await pub.waitForTransactionReceipt({ hash: hash as `0x${string}`, timeout: 120_000 });
        const logs = parseEventLogs({ abi: CAMPAIGN_ABI, logs: receipt.logs, eventName: "CampaignCreated" });
        const mine = logs.find((l) => l.address.toLowerCase() === CAMPAIGN_CONTRACT.toLowerCase());
        if (mine) createdId = mine.args.campaignId as bigint;
      } catch {
        /* hash may be a calls-bundle id; fall back to scanning logs below */
      }
      if (createdId === null) {
        const logs = await pub.getContractEvents({
          address: CAMPAIGN_CONTRACT,
          abi: CAMPAIGN_ABI,
          eventName: "CampaignCreated",
          args: { creator: address },
          fromBlock: fromBlock > 50n ? fromBlock - 50n : 0n,
        });
        const found = logs.map((l) => l.args.campaignId as bigint).filter((id) => id >= nextId);
        if (found.length) createdId = found[found.length - 1];
      }
      if (createdId === null) {
        throw new Error(
          "Your deposit was sent but the campaign ID couldn't be read yet. Open “My links” in a minute — it will appear there."
        );
      }

      saveCampaign(address, {
        id: createdId.toString(),
        secret,
        createdAt: Date.now(),
        asset,
        slots,
      });
      setResult({
        id: createdId.toString(),
        link: buildCampaignLink(createdId, secret, APP_URL_WEB),
        shortLink: buildCampaignShortLink(createdId, secret, APP_URL_WEB),
      });
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      setError(explainCampaignError(msg).startsWith("Transaction failed") ? msg.slice(0, 220) : explainCampaignError(msg));
    } finally {
      setBusy("");
    }
  }, [
    address, asset, cfg, committed, connType, expirySecs, unlockSecs, gated, label, message, slots, splitsEvenly, totalUnits, validation,
  ]);

  if (result) {
    const shareText = `🎁 I'm gifting ${total} ${asset} — first ${slots} to claim get ${perClaim ?? "an equal share"} ${asset} each. One link, first come first served:`;
    return (
      <SectionCard>
        <div className="space-y-4">
          <div className="flex items-center gap-2">
            <CheckCircle2 className="text-emerald-500" />
            <h3 className="text-xl font-black text-[var(--ink)]">Campaign #{result.id} is funded</h3>
          </div>
          <div className="rounded-2xl border border-[var(--border-subtle)] bg-[var(--bg-elevated)] p-4 space-y-2">
            <p className="text-[10px] font-black uppercase tracking-widest text-[var(--ink-muted)]">Your one claim link</p>
            <p className="font-mono text-xs break-all text-[var(--ink)]">{result.link}</p>
            <div className="flex flex-wrap gap-2">
              <button
                type="button"
                className="btn-primary text-white rounded-xl px-4 py-2 text-sm font-black inline-flex items-center gap-2"
                onClick={async () => {
                  setCopied(await copy(result.link));
                  setTimeout(() => setCopied(false), 1500);
                }}
              >
                <Copy size={14} /> {copied ? "Copied" : "Copy link"}
              </button>
              <a
                className="rounded-xl px-4 py-2 text-sm font-bold border border-[var(--border-subtle)] text-[var(--ink)]"
                target="_blank"
                rel="noopener noreferrer"
                href={`https://warpcast.com/~/compose?text=${encodeURIComponent(shareText)}&embeds[]=${encodeURIComponent(result.shortLink)}`}
              >
                Share on Farcaster
              </a>
              <a
                className="rounded-xl px-4 py-2 text-sm font-bold border border-[var(--border-subtle)] text-[var(--ink)]"
                target="_blank"
                rel="noopener noreferrer"
                href={`https://twitter.com/intent/tweet?text=${encodeURIComponent(shareText)}&url=${encodeURIComponent(result.shortLink)}`}
              >
                Share on X
              </a>
            </div>
          </div>
          <div className="rounded-2xl border border-amber-500/30 bg-amber-500/8 p-4 text-sm text-[var(--ink)] space-y-1">
            <p className="font-black flex items-center gap-2">
              <AlertTriangle size={16} className="text-amber-500" /> Keep this link safe
            </p>
            <p className="text-[var(--ink-muted)]">
              The secret in the link is created in your browser and is <strong>not stored on our servers</strong>. Anyone
              with the link can claim until the slots run out. We keep a copy in this browser under “My links”; if you
              clear site data, you can still cancel the campaign from this wallet and get unclaimed funds back
              {committed ? " (after it expires, since you chose a committed campaign)" : ""}.
            </p>
          </div>
          <button type="button" className="text-sm font-bold text-[var(--brand)]" onClick={onCreated}>
            View my links →
          </button>
        </div>
      </SectionCard>
    );
  }

  return (
    <SectionCard>
      <div className="space-y-5">
        <div className="page-hero">
          <p className="section-eyebrow">One link · first {slots || "N"} claim</p>
          <p className="readable-body mt-2">
            Fund once, share <strong className="text-[var(--ink)]">one link</strong>. The first {slots || "N"} different
            wallets to claim each get an equal share — no more sending 50 separate links. Funds sit in the contract, not
            with us, and anything unclaimed goes back to you.
          </p>
        </div>

        {/* Asset */}
        <div>
          <label className="section-eyebrow mb-2 block" htmlFor="camp-asset">Asset</label>
          <select
            id="camp-asset"
            value={asset}
            onChange={(e) => {
              setAsset(e.target.value);
              setTotal(e.target.value === "ETH" ? "0.05" : e.target.value === "USDC" ? "50" : "5");
            }}
            className="w-full bg-[var(--bg-elevated)] border border-[var(--border-subtle)] rounded-xl px-4 py-3 text-[var(--ink)] font-bold"
          >
            <option value="USDC">USDC</option>
            <option value="ETH">ETH</option>
            {BASE_STOCKS.slice(0, 40).map((s) => (
              <option key={s.address} value={s.symbol}>
                {s.symbol} — {s.name} (tokenized stock)
              </option>
            ))}
          </select>
        </div>

        {/* Amount + slots */}
        <div className="grid sm:grid-cols-2 gap-4">
          <div>
            <label className="section-eyebrow mb-2 block" htmlFor="camp-total">Total to give away</label>
            <input
              id="camp-total"
              inputMode="decimal"
              value={total}
              onChange={(e) => setTotal(e.target.value)}
              className="w-full bg-[var(--bg-elevated)] border border-[var(--border-subtle)] rounded-xl px-4 py-3 text-[var(--ink)] font-mono"
            />
          </div>
          <div>
            <label className="section-eyebrow mb-2 block" htmlFor="camp-slots">
              Claim slots (1–{CAMPAIGN_MAX_CLAIMS})
            </label>
            <input
              id="camp-slots"
              inputMode="numeric"
              value={slots || ""}
              onChange={(e) => setSlots(Math.max(0, Math.min(CAMPAIGN_MAX_CLAIMS, parseInt(e.target.value || "0", 10) || 0)))}
              className="w-full bg-[var(--bg-elevated)] border border-[var(--border-subtle)] rounded-xl px-4 py-3 text-[var(--ink)] font-mono"
            />
            <div className="flex gap-1.5 mt-2 flex-wrap">
              {SLOT_PRESETS.map((n) => (
                <button
                  key={n}
                  type="button"
                  onClick={() => setSlots(n)}
                  className={`px-3 py-1 rounded-lg text-xs font-bold border ${
                    slots === n
                      ? "border-[var(--brand)] bg-[var(--brand-soft)] text-[var(--brand-dark)]"
                      : "border-[var(--border-subtle)] text-[var(--ink-muted)]"
                  }`}
                >
                  {n === 1 ? "1 · single gift" : n}
                </button>
              ))}
            </div>
          </div>
        </div>

        <div className="rounded-2xl bg-[var(--surface-2)] border border-[var(--border-subtle)] p-4 flex items-center gap-3">
          <Users size={18} className="text-[var(--ink-muted)]" />
          <p className="text-sm text-[var(--ink)]">
            {perClaim ? (
              <>
                Each of the first <strong>{slots}</strong> wallets gets <strong>{perClaim} {asset}</strong>.
              </>
            ) : (
              <span className="text-amber-500">This total doesn&apos;t split evenly into {slots || "N"} slots — adjust the amount or slots.</span>
            )}
          </p>
        </div>

        {/* Sender identity */}
        <div>
          <label className="section-eyebrow mb-2 block" htmlFor="camp-label">Sender name (shown to claimers)</label>
          <input
            id="camp-label"
            value={label}
            maxLength={CAMPAIGN_MAX_LABEL}
            onChange={(e) => {
              labelTouched.current = true;
              setLabel(e.target.value);
            }}
            placeholder="yourname.base.eth"
            className="w-full bg-[var(--bg-elevated)] border border-[var(--border-subtle)] rounded-xl px-4 py-3 text-[var(--ink)]"
          />
          <p className="text-[11px] text-[var(--ink-dim)] mt-1.5">
            Claimers always see your <strong>wallet address</strong> from the contract. The name is only marked
            &ldquo;verified&rdquo; if it matches your wallet&apos;s own Basename — so use your Basename.
          </p>
        </div>

        <div>
          <label className="section-eyebrow mb-2 block" htmlFor="camp-msg">Message (optional)</label>
          <textarea
            id="camp-msg"
            value={message}
            maxLength={CAMPAIGN_MAX_MESSAGE}
            onChange={(e) => setMessage(e.target.value)}
            rows={2}
            className="w-full bg-[var(--bg-elevated)] border border-[var(--border-subtle)] rounded-xl px-4 py-3 text-[var(--ink)]"
          />
        </div>

        {/* Safety options */}
        <div className="space-y-3">
          <div>
            <label className="section-eyebrow mb-2 block">Opens (unlock date)</label>
            <div className="flex gap-1.5 flex-wrap">
              {UNLOCK_OPTIONS.map((o) => (
                <button
                  key={o.id}
                  type="button"
                  onClick={() => setUnlock(o.id)}
                  className={`px-3 py-2 rounded-xl text-xs font-bold border ${
                    unlock === o.id
                      ? "border-[var(--brand)] bg-[var(--brand-soft)] text-[var(--brand-dark)]"
                      : "border-[var(--border-subtle)] text-[var(--ink-muted)]"
                  }`}
                >
                  {o.label}
                </button>
              ))}
            </div>
            <p className="text-[11px] text-[var(--ink-dim)] mt-1.5">Claimers can see the gift and who sent it right away, but can only claim once it opens.</p>
          </div>
          <div>
            <label className="section-eyebrow mb-2 block">Expires (after it opens)</label>
            <div className="flex gap-1.5 flex-wrap">
              {EXPIRY_OPTIONS.map((o) => (
                <button
                  key={o.id}
                  type="button"
                  onClick={() => {
                    setExpiry(o.id);
                    if (o.id === "none") setCommitted(false);
                  }}
                  className={`px-3 py-2 rounded-xl text-xs font-bold border ${
                    expiry === o.id
                      ? "border-[var(--brand)] bg-[var(--brand-soft)] text-[var(--brand-dark)]"
                      : "border-[var(--border-subtle)] text-[var(--ink-muted)]"
                  }`}
                >
                  {o.label}
                </button>
              ))}
            </div>
          </div>

          <label className={`flex items-start gap-3 text-sm ${expiry === "none" ? "opacity-50" : ""}`}>
            <input
              type="checkbox"
              className="mt-1"
              disabled={expiry === "none"}
              checked={committed}
              onChange={(e) => setCommitted(e.target.checked)}
            />
            <span className="text-[var(--ink)]">
              <span className="font-bold inline-flex items-center gap-1"><Lock size={13} /> Committed</span> — I can&apos;t cancel
              before it expires. Shows claimers the gift can&apos;t be pulled back.
            </span>
          </label>

          <label className="flex items-start gap-3 text-sm">
            <input
              type="checkbox"
              className="mt-1"
              disabled={isStock}
              checked={gated}
              onChange={(e) => setGatedPref(e.target.checked)}
            />
            <span className="text-[var(--ink)]">
              <span className="font-bold inline-flex items-center gap-1"><ShieldCheck size={13} /> Verified claims</span> — each claim
              needs a short-lived ticket from our server (rate limits, region &amp; kill-switch checks).
              {isStock ? " Always on for tokenized stocks." : " Recommended: blocks bots cycling many wallets from one machine."}
              {gateUnavailable && <span className="text-amber-500"> Not available on this deployment yet.</span>}
            </span>
          </label>
        </div>

        {(validation.warnings.length > 0 || validation.errors.length > 0) && (
          <ul className="text-xs space-y-1">
            {validation.errors.map((e) => (
              <li key={e} className="text-red-400">• {e}</li>
            ))}
            {validation.warnings.map((w) => (
              <li key={w} className="text-amber-500">• {w}</li>
            ))}
          </ul>
        )}

        {isStock && (
          <p className="text-xs text-[var(--ink-muted)] rounded-xl border border-[var(--border-subtle)] p-3">
            Tokenized stocks are issued by third parties and may be restricted in some regions. Recipients in restricted
            regions can&apos;t claim; unclaimed shares return to you. This isn&apos;t investment advice and holding a
            token confers no shareholder rights.
          </p>
        )}

        {/* Terms the sender agrees to — the same terms claimers see before accepting */}
        <div className="rounded-2xl border border-[var(--border-subtle)] bg-[var(--surface-2)] p-4 space-y-1.5 text-xs">
          <p className="text-[10px] font-black uppercase tracking-widest text-[var(--ink-muted)]">What claimers will see</p>
          <p className="text-[var(--ink)]">
            <strong>Sender:</strong> {label.trim() || "(no name)"} and your wallet address{address ? ` ${address}` : ""} — recorded by the contract.
          </p>
          <p className="text-[var(--ink)]">
            <strong>Owner until claimed:</strong> the campaign contract holds it in escrow for you. It becomes the recipient&apos;s only when their claim confirms.
          </p>
          <p className="text-[var(--ink)]">
            <strong>Opens:</strong> {unlockSecs ? new Date((nowSec + unlockSecs) * 1000).toLocaleString() : "right away"} ·{" "}
            <strong>Expires:</strong> {expirySecs ? new Date((nowSec + unlockSecs + expirySecs) * 1000).toLocaleString() : "never"}
          </p>
          <p className="text-[var(--ink)]">
            <strong>Refunds:</strong> recipients who aren&apos;t eligible (region, sanctions, already claimed) are refused
            before anything moves, so their share stays in escrow. You get every unclaimed share back from “My links”
            {committed ? " once the gift expires" : " at any time, or after it expires"} — from any device with this wallet.
          </p>
        </div>

        <label className="flex items-start gap-3 text-sm">
          <input type="checkbox" className="mt-1" checked={ackSafety} onChange={(e) => setAckSafety(e.target.checked)} />
          <span className="text-[var(--ink)]">
            I understand anyone with the link can claim until slots run out, and I should only share it with people I
            want to receive it.
          </span>
        </label>

        {error && <p className="text-sm text-red-400">{error}</p>}

        <button
          type="button"
          disabled={disabled || !!busy || !address || !validation.ok || !splitsEvenly || !ackSafety || gateUnavailable}
          onClick={create}
          className="w-full py-4 rounded-2xl font-black btn-primary text-white disabled:opacity-50 disabled:cursor-not-allowed inline-flex items-center justify-center gap-2"
        >
          {busy ? (
            <>
              <Loader2 size={16} className="animate-spin" /> {busy}
            </>
          ) : !address ? (
            "Connect wallet to continue"
          ) : (
            <>
              <Link2 size={16} /> Fund &amp; create link
            </>
          )}
        </button>
      </div>
    </SectionCard>
  );
}

// ───────────────────────────── claim ─────────────────────────────

function ClaimCampaign({
  address,
  connType,
  initialId,
  initialSecret,
  disabled,
}: {
  address: `0x${string}` | undefined;
  connType: WalletAppState["connType"];
  initialId: string;
  initialSecret: string;
  disabled: boolean;
}) {
  const [id, setId] = useState(initialId);
  const [secret, setSecret] = useState(initialSecret);
  useEffect(() => setId(initialId), [initialId]);
  useEffect(() => setSecret(initialSecret), [initialSecret]);

  const [view, setView] = useState<CampaignPublicView | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState("");
  const [done, setDone] = useState<{ hash: string } | null>(null);
  const [claimedBefore, setClaimedBefore] = useState(false);
  const [eligibility, setEligibility] = useState<EligibilityResult | null>(null);
  const [eligKey, setEligKey] = useState(0);

  const refresh = useCallback(async () => {
    if (!/^\d{1,12}$/.test(id)) {
      setView(null);
      return;
    }
    setLoading(true);
    try {
      const r = await fetch(`/api/voucher/campaign/${id}`, { cache: "no-store" });
      const data = await r.json();
      if (!r.ok) {
        setView(null);
        setError(data?.error || "Campaign not found.");
      } else {
        setError("");
        setView(data);
      }
    } catch {
      setError("Couldn't load the campaign. Check your connection.");
    } finally {
      setLoading(false);
    }
  }, [id]);

  useEffect(() => {
    refresh();
  }, [refresh]);

  useEffect(() => {
    if (!address || !view || !CAMPAIGN_CONTRACT) return;
    createPublicOnlyBaseClient()
      .readContract({
        address: CAMPAIGN_CONTRACT,
        abi: CAMPAIGN_ABI,
        functionName: "hasClaimed",
        args: [BigInt(view.campaignId), address],
      })
      .then((v) => setClaimedBefore(Boolean(v)))
      .catch(() => undefined);
  }, [address, view]);

  const claim = useCallback(async () => {
    setError("");
    if (!address || !view || !CAMPAIGN_CONTRACT) return;
    const clean = secret.trim();
    if (!clean) return setError("This link is missing its secret key. Open the full link from the sender.");

    try {
      let deadline = 0n;
      let ticket: `0x${string}` = "0x";
      if (view.gated) {
        setBusy("Verifying…");
        const r = await fetch(`/api/voucher/campaign/${view.campaignId}/ticket`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ claimer: address }),
        });
        const data = await r.json();
        if (!r.ok) throw new Error(data?.error || "Verification failed.");
        ticket = data.ticket;
        deadline = BigInt(data.deadline);
      }

      const args = [BigInt(view.campaignId), clean, deadline, ticket] as const;

      // Simulate first: a doomed claim costs the user nothing and shows a readable reason.
      setBusy("Checking…");
      const pub = createPublicOnlyBaseClient();
      await pub.simulateContract({
        address: CAMPAIGN_CONTRACT,
        abi: CAMPAIGN_ABI,
        functionName: "claim",
        args,
        account: address,
      });

      setBusy("Confirm in your wallet…");
      const call = encodeContractCall(CAMPAIGN_CONTRACT, CAMPAIGN_ABI, "claim", args);
      const hash = await sendAppTransactions(connType ?? "injected", address, [call]);
      setDone({ hash });
      refresh();
      setEligKey((k) => k + 1);
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      const friendly = explainCampaignError(msg);
      setError(friendly.startsWith("Transaction failed") && msg.length < 200 ? msg : friendly);
    } finally {
      setBusy("");
    }
  }, [address, connType, refresh, secret, view]);

  const pct = view ? Math.round((view.claimedCount / view.maxClaims) * 100) : 0;
  // Eligibility is checked and shown BEFORE claiming; an ineligible wallet never sends a transaction.
  const canClaim =
    view?.status === "open" && !claimedBefore && !done && !disabled && eligibility?.eligible !== false;

  return (
    <SectionCard>
      <div className="space-y-4">
        <div className="page-hero">
          <p className="section-eyebrow">Claim from a shared link</p>
          <p className="readable-body mt-2">
            Open the sender&apos;s link, check who sent it, then claim. Only the first wallets to claim get a share — one
            claim per wallet.
          </p>
        </div>

        <div className="grid sm:grid-cols-[1fr_auto] gap-2">
          <input
            value={id}
            onChange={(e) => setId(e.target.value.replace(/\D/g, ""))}
            placeholder="Campaign ID (from the link)"
            className="w-full bg-[var(--bg-elevated)] border border-[var(--border-subtle)] rounded-xl px-4 py-3 text-[var(--ink)] font-mono"
            aria-label="Campaign ID"
          />
          <button
            type="button"
            onClick={refresh}
            className="rounded-xl px-4 py-3 text-sm font-bold border border-[var(--border-subtle)] text-[var(--ink)]"
          >
            Look up
          </button>
        </div>
        {!initialSecret && (
          <input
            value={secret}
            onChange={(e) => setSecret(e.target.value)}
            placeholder="Secret key (if your link didn't include it)"
            autoComplete="off"
            className="w-full bg-[var(--bg-elevated)] border border-[var(--border-subtle)] rounded-xl px-4 py-3 text-[var(--ink)] font-mono"
            aria-label="Secret key"
          />
        )}

        {loading && <p className="text-xs text-[var(--ink-dim)] animate-pulse">Reading campaign from Base…</p>}

        {view && (
          <div className="space-y-4">
            <SenderIdentity sender={view.sender} />

            <div className="rounded-2xl border border-[var(--border-subtle)] bg-[var(--bg-elevated)] p-4 space-y-3">
              <div className="flex items-baseline justify-between gap-2 flex-wrap">
                <p className="text-3xl font-black text-[var(--ink)]">{view.perClaimFormatted}</p>
                <p className="text-xs font-bold text-[var(--ink-muted)]">per claim · campaign #{view.campaignId}</p>
              </div>
              {view.message && <p className="text-sm italic text-[var(--ink-muted)]">&ldquo;{view.message}&rdquo;</p>}

              <div>
                <div className="flex justify-between text-xs font-bold text-[var(--ink-muted)] mb-1">
                  <span>{view.claimedCount} claimed</span>
                  <span>{view.claimsRemaining} left of {view.maxClaims}</span>
                </div>
                <div className="h-2 rounded-full bg-[var(--surface-2)] overflow-hidden">
                  <div className="h-full bg-[var(--brand)]" style={{ width: `${pct}%` }} />
                </div>
              </div>

              <div className="flex flex-wrap gap-2 text-[11px] font-bold">
                <span className="px-2 py-1 rounded-lg bg-[var(--surface-2)] text-[var(--ink-muted)]">Status: {view.status}</span>
                {view.unlockAt > 0 && (
                  <span className="px-2 py-1 rounded-lg bg-[var(--surface-2)] text-[var(--ink-muted)] inline-flex items-center gap-1">
                    <Lock size={11} /> {view.status === "locked" ? "Opens" : "Opened"} {fmtDate(view.unlockAt)}
                  </span>
                )}
                {view.expiresAt > 0 && (
                  <span className="px-2 py-1 rounded-lg bg-[var(--surface-2)] text-[var(--ink-muted)] inline-flex items-center gap-1">
                    <Clock size={11} /> Expires {fmtDate(view.expiresAt)}
                  </span>
                )}
                {view.committed && (
                  <span className="px-2 py-1 rounded-lg bg-emerald-500/10 text-emerald-500 inline-flex items-center gap-1">
                    <Lock size={11} /> Sender can&apos;t cancel before expiry
                  </span>
                )}
                {view.gated && (
                  <span className="px-2 py-1 rounded-lg bg-[var(--surface-2)] text-[var(--ink-muted)] inline-flex items-center gap-1">
                    <ShieldCheck size={11} /> Verified claims
                  </span>
                )}
              </div>

              {!view.asset.recognised && (
                <p className="text-xs text-amber-500">
                  This token isn&apos;t one the app recognises. Check the contract on Basescan before claiming.
                </p>
              )}
            </div>

            <OwnershipTerms view={view} />

            {!done && (
              <EligibilityChecklist
                campaignId={view.campaignId}
                wallet={address}
                onResult={setEligibility}
                refreshKey={eligKey}
              />
            )}

            {done ? (
              <div className="rounded-2xl border border-emerald-500/30 bg-emerald-500/8 p-4 text-sm text-[var(--ink)]">
                <p className="font-black flex items-center gap-2">
                  <CheckCircle2 className="text-emerald-500" size={18} /> Claimed!
                </p>
                <p className="text-[var(--ink-muted)] mt-1">
                  {view.perClaimFormatted} is on its way to your wallet.{" "}
                  {done.hash.startsWith("0x") && done.hash.length === 66 && (
                    <a className="font-bold text-[var(--brand)]" target="_blank" rel="noopener noreferrer" href={`https://basescan.org/tx/${done.hash}`}>
                      View transaction
                    </a>
                  )}
                </p>
              </div>
            ) : (
              <button
                type="button"
                disabled={!canClaim || !!busy || !address}
                onClick={claim}
                className="w-full py-4 rounded-2xl font-black btn-primary text-white disabled:opacity-50 disabled:cursor-not-allowed inline-flex items-center justify-center gap-2"
              >
                {busy ? (
                  <>
                    <Loader2 size={16} className="animate-spin" /> {busy}
                  </>
                ) : !address ? (
                  "Connect wallet to claim"
                ) : claimedBefore ? (
                  "This wallet already claimed"
                ) : view.status !== "open" ? (
                  view.status === "full" ? "All slots taken" : `Campaign ${view.status}`
                ) : eligibility && !eligibility.eligible ? (
                  "Not eligible — nothing will be sent"
                ) : (
                  `Claim ${view.perClaimFormatted}`
                )}
              </button>
            )}
          </div>
        )}

        {error && <p className="text-sm text-red-400">{error}</p>}
      </div>
    </SectionCard>
  );
}

// ───────────────────────────── my campaigns ─────────────────────────────

function MyCampaigns({
  address,
  connType,
}: {
  address: `0x${string}` | undefined;
  connType: WalletAppState["connType"];
}) {
  const [items, setItems] = useState<Array<Omit<SavedCampaign, "secret"> & { secret?: string }>>([]);
  const [views, setViews] = useState<Record<string, CampaignPublicView | null>>({});
  const [busyId, setBusyId] = useState("");
  const [msg, setMsg] = useState("");
  const [copiedId, setCopiedId] = useState("");

  const load = useCallback(() => {
    if (!address) return;
    const saved = loadSaved(address);
    setItems(saved);
    const fetchView = (id: string) =>
      fetch(`/api/voucher/campaign/${id}`, { cache: "no-store" })
        .then((r) => (r.ok ? r.json() : null))
        .then((v) => setViews((prev) => ({ ...prev, [id]: v })))
        .catch(() => undefined);
    saved.forEach((c) => fetchView(c.id));
    // Also list every campaign this wallet created onchain, so refunds work from any device.
    fetch(`/api/voucher/campaign/by-creator?address=${address}`, { cache: "no-store" })
      .then((r) => (r.ok ? r.json() : { ids: [] }))
      .then((d: { ids?: string[] }) => {
        const known = new Set(saved.map((c) => c.id));
        const extra = (d.ids ?? []).filter((id) => !known.has(id));
        if (!extra.length) return;
        setItems((prev) => [...prev, ...extra.map((id) => ({ id, createdAt: 0, asset: "", slots: 0 }))]);
        extra.forEach(fetchView);
      })
      .catch(() => undefined);
  }, [address]);

  useEffect(load, [load]);

  const close = useCallback(
    async (id: string) => {
      if (!address || !CAMPAIGN_CONTRACT) return;
      setMsg("");
      setBusyId(id);
      try {
        const call = encodeContractCall(CAMPAIGN_CONTRACT, CAMPAIGN_ABI, "close", [BigInt(id)]);
        await createPublicOnlyBaseClient().simulateContract({
          address: CAMPAIGN_CONTRACT,
          abi: CAMPAIGN_ABI,
          functionName: "close",
          args: [BigInt(id)],
          account: address,
        });
        await sendAppTransactions(connType ?? "injected", address, [call]);
        setMsg(`Campaign #${id} closed — unclaimed funds are returning to your wallet.`);
        setTimeout(load, 4000);
      } catch (e) {
        const m = e instanceof Error ? e.message : String(e);
        setMsg(explainCampaignError(m));
      } finally {
        setBusyId("");
      }
    },
    [address, connType, load]
  );

  const empty = useMemo(() => address && items.length === 0, [address, items]);

  if (!address) {
    return (
      <SectionCard>
        <p className="text-sm text-[var(--ink-muted)]">Connect your wallet to see the shared links you created.</p>
      </SectionCard>
    );
  }

  return (
    <SectionCard>
      <div className="space-y-3">
        <p className="section-eyebrow">Your shared links</p>
        {empty && (
          <p className="text-sm text-[var(--ink-muted)]">
            Nothing here yet. Every campaign this wallet funds shows up here on any device. Claim links can only be copied on the device that created them, because the secret never leaves it.
          </p>
        )}
        {msg && <p className="text-sm text-[var(--ink)]">{msg}</p>}
        {items.map((c) => {
          const v = views[c.id];
          const open = v?.status === "open" || v?.status === "locked";
          const canClose = Boolean(v && v.status !== "closed" && v.status !== "full" && (!v.committed || v.status === "expired"));
          return (
            <div key={c.id} className="rounded-2xl border border-[var(--border-subtle)] bg-[var(--bg-elevated)] p-4 space-y-2">
              <div className="flex items-center justify-between gap-2 flex-wrap">
                <p className="font-black text-[var(--ink)]">
                  #{c.id} · {v ? `${v.perClaimFormatted} × ${v.maxClaims}` : c.asset ? `${c.asset} × ${c.slots}` : "loading…"}
                </p>
                <span className="text-[11px] font-bold text-[var(--ink-muted)]">
                  {v ? `${v.claimedCount}/${v.maxClaims} claimed · ${v.status}` : "loading…"}
                </span>
              </div>
              <div className="flex gap-2 flex-wrap">
                {c.secret ? (
                  <button
                    type="button"
                    className="rounded-xl px-3 py-2 text-xs font-bold border border-[var(--border-subtle)] text-[var(--ink)] inline-flex items-center gap-1.5"
                    onClick={async () => {
                      if (c.secret && (await copy(buildCampaignLink(c.id, c.secret, APP_URL_WEB)))) {
                        setCopiedId(c.id);
                        setTimeout(() => setCopiedId(""), 1500);
                      }
                    }}
                  >
                    <Copy size={12} /> {copiedId === c.id ? "Copied" : "Copy link"}
                  </button>
                ) : (
                  <span className="text-[11px] text-[var(--ink-dim)] self-center">
                    Claim link is only on the device that created it — refunds still work here.
                  </span>
                )}
                {canClose && (
                  <button
                    type="button"
                    disabled={busyId === c.id}
                    onClick={() => close(c.id)}
                    className="rounded-xl px-3 py-2 text-xs font-bold border border-red-500/40 text-red-400 disabled:opacity-50"
                  >
                    {busyId === c.id ? "Closing…" : open ? "Cancel & refund remaining" : "Refund remaining"}
                  </button>
                )}
                {v?.committed && v.status === "open" && (
                  <span className="text-[11px] text-[var(--ink-muted)] self-center inline-flex items-center gap-1">
                    <Lock size={11} /> Committed until {fmtDate(v.expiresAt)}
                  </span>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </SectionCard>
  );
}
