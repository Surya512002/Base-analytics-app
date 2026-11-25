"use client";

import React, { useEffect, useMemo, useRef, useState } from "react";
import { AnimatePresence, motion, useReducedMotion } from "motion/react";
import { parseEventLogs } from "viem";
import {
  CalendarClock,
  ChevronLeft,
  ChevronRight,
  Coins,
  Copy,
  Crown,
  Download,
  Droplets,
  Flame,
  Globe,
  Shuffle,
  Gift,
  Heart,
  KeyRound,
  Link2,
  ListChecks,
  ListPlus,
  Loader2,
  Lock,
  Pencil,
  Rocket,
  Share2,
  ShieldCheck,
  Sparkles,
  Ticket,
  TrendingUp,
  Trophy,
  Upload,
  Users,
  Zap,
  type LucideIcon,
} from "lucide-react";
import { ERC20_ABI } from "@/lib/constants/contracts";
import { DROPS_USDC, IS_DROPS_TESTNET } from "@/lib/drops/network";
import { encodeContractCall, type ContractCall } from "@/lib/utils/tx";
import { sendAppTransactions } from "@/lib/utils/send-app-tx";
import { BASE_DROPS_ABI } from "@/lib/drops/abi";
import {
  DROPS_CHAIN_ID,
  DROPS_CONTRACT,
  PRESETS,
  ZERO_ADDRESS,
  codeLink,
  defaultForm,
  dropLink,
  explainDropError,
  fromUnits,
  prepareDrop,
  toUnits,
  type Access,
  type DropForm,
  type PresetId,
} from "@/lib/drops/client";
import { assetToToken, getVaultShareBySymbol } from "@/lib/utils/voucher";
import { syncVaultInBackground } from "@/lib/voucher/vault-client";
import { BASE_OFFICIAL_STOCKS } from "@/lib/stocks/base-verified";
import { BASE_STOCK_DECIMALS } from "@/lib/stocks/base-stocks";
import ClickSpark from "@/components/ui/motion/ClickSpark";
import TokenLogo from "@/components/ui/TokenLogo";
import VoucherAssetPickerModal from "@/components/voucher/VoucherAssetPickerModal";
import { StepHeader, StepSlide, WizardStepper, type WizardStepDef } from "@/components/voucher/WizardChrome";
import AirdropScene from "./AirdropScene";
import { checkSplit, generateSplit } from "@/lib/drops/split";
import TaskLibrary from "./TaskLibrary";
import { draftsToDefinition, type TaskDraft } from "./TaskBuilder";
import { missingFields } from "./task-meta";
import { dropsApi, dropsClient, ensureSignedIn, saveDrop, tokenMeta, updateSavedDrop, type CatalogEntry, type ConnType, type ListingCategory } from "./drops-api";
import { Chips, Field, Notice, OptionCard, Pill, Section, Segmented, Stepper, Toggle, btnPrimary, btnSecondary, inputCls, useNow } from "./ui";

type StepId = "type" | "asset" | "who" | "tasks" | "timing" | "review";
type AssetKind = "ETH" | "USDC" | "stock" | "vault" | "TOKEN";

const STEP_DEFS: Record<StepId, { title: string; hint: string; icon: LucideIcon }> = {
  type: { title: "Type", hint: "What kind of drop", icon: Sparkles },
  asset: { title: "Reward", hint: "Asset and amounts", icon: Coins },
  who: { title: "Who", hint: "Who can claim", icon: Users },
  tasks: { title: "Tasks", hint: "What they do first", icon: ListChecks },
  timing: { title: "Rules", hint: "How often, when", icon: CalendarClock },
  review: { title: "Launch", hint: "Check and fund", icon: Rocket },
};

const PRESET_LOOK: Record<PresetId, { icon: LucideIcon; tint: string; chips: string[] }> = {
  friend: { icon: Heart, tint: "from-pink-500 to-rose-500", chips: ["1 link", "1 claim"] },
  group: { icon: Users, tint: "from-[var(--brand)] to-indigo-500", chips: ["1 link", "first N wallets"] },
  cards: { icon: Ticket, tint: "from-amber-500 to-orange-500", chips: ["unique codes", "each works once"] },
  faucet: { icon: Droplets, tint: "from-sky-500 to-cyan-500", chips: ["every 24h", "daily cap"] },
  quest: { icon: ListChecks, tint: "from-violet-500 to-fuchsia-500", chips: ["tasks", "claim once"] },
  "daily-quest": { icon: Flame, tint: "from-orange-500 to-red-500", chips: ["daily tasks", "streaks"] },
  holders: { icon: Crown, tint: "from-emerald-500 to-teal-500", chips: ["token holders", "or your list"] },
};

const ACCESS_LOOK: Record<Access, { icon: LucideIcon; title: string; note: string }> = {
  link: { icon: Link2, title: "Anyone with the link", note: "One private link. A claim copied from the chain can't be reused." },
  codes: { icon: Ticket, title: "Unique gift codes", note: "Each code works once — great for DMs, events, printed cards." },
  allowlist: { icon: ListPlus, title: "Wallets on my list", note: "Paste or upload addresses. Only they can claim." },
  holders: { icon: Crown, title: "Token or NFT holders", note: "Hold a token, NFT or stock (or be on your list)." },
  tasks: { icon: ListChecks, title: "Wallets that finish tasks", note: "Follows, buys, quizzes, events… checked by the app." },
};

const AMOUNT_CHIPS: Record<string, string[]> = {
  ETH: ["0.0005", "0.001", "0.005", "0.01"],
  USDC: ["1", "5", "10", "25"],
};

const isAddr = (v: string) => /^0x[0-9a-fA-F]{40}$/.test(v.trim());
const parseList = (raw: string) => {
  const parts = raw.split(/[\s,;]+/).map((x) => x.trim()).filter(Boolean);
  const ok = new Set(parts.filter(isAddr).map((x) => x.toLowerCase()));
  return { valid: ok.size, invalid: parts.filter((x) => !isAddr(x)).length };
};

const LISTING_CATS: Array<{ id: ListingCategory; label: string }> = [
  { id: "quest", label: "Quest" },
  { id: "daily", label: "Daily" },
  { id: "holders", label: "Holders" },
  { id: "airdrop", label: "Airdrop" },
  { id: "gift", label: "Gift" },
];

/** Days (1..totalDays) that no required task covers, when tasks are planned by day. */
function uncoveredDays(drafts: TaskDraft[], totalDays: number): number[] {
  if (!drafts.some((d) => d.days)) return [];
  if (drafts.some((d) => !d.days && d.required)) return [];
  const covered = new Set<number>();
  for (const d of drafts) {
    if (!d.days || !d.required) continue;
    for (let x = d.days.from; x <= Math.min(d.days.to, totalDays); x++) covered.add(x);
  }
  const missing: number[] = [];
  for (let i = 1; i <= Math.min(totalDays, 365); i++) if (!covered.has(i)) missing.push(i);
  return missing;
}

function rangesText(nums: number[]): string {
  const out: string[] = [];
  for (let i = 0; i < nums.length; ) {
    let j = i;
    while (j + 1 < nums.length && nums[j + 1] === nums[j]! + 1) j++;
    out.push(i === j ? `${nums[i]}` : `${nums[i]}–${nums[j]}`);
    i = j + 1;
  }
  return out.length ? `day${nums.length > 1 ? "s" : ""} ${out.join(", ")}` : "";
}

interface Done {
  id: string;
  listed?: boolean;
  link: string | null;
  codeLinks: string[];
  publicLink: string;
  warnings: string[];
}

export default function DropCreate({
  address,
  connType,
  onCreated,
}: {
  address: string;
  connType: ConnType;
  onCreated?: (id: string) => void;
}) {
  const reduce = useReducedMotion();
  const [step, setStep] = useState<StepId>("type");
  const [furthest, setFurthest] = useState(0);
  const [direction, setDirection] = useState(1);
  const [form, setForm] = useState<DropForm>(() => defaultForm("group"));
  const [assetKind, setAssetKind] = useState<AssetKind>("ETH");
  const [assetSymbol, setAssetSymbol] = useState("ETH");
  const [picker, setPicker] = useState<{ open: boolean; category: "stock" | "vault" }>({ open: false, category: "stock" });
  const [customToken, setCustomToken] = useState("");
  const [tokenNote, setTokenNote] = useState("");
  const [drafts, setDrafts] = useState<TaskDraft[]>([]);
  const [catalog, setCatalog] = useState<CatalogEntry[]>([]);
  const [appSigner, setAppSigner] = useState<string | null>(null);
  const [busy, setBusy] = useState("");
  const [error, setError] = useState("");
  const [done, setDone] = useState<Done | null>(null);
  const [copied, setCopied] = useState("");
  const topRef = useRef<HTMLDivElement>(null);
  const now = useNow();
  const [listing, setListing] = useState<{ on: boolean; title: string; blurb: string; category: ListingCategory }>({ on: false, title: "", blurb: "", category: "quest" });

  useEffect(() => {
    dropsApi
      .catalog()
      .then((c) => {
        setCatalog(c.tasks);
        setAppSigner(c.ticketSigner);
      })
      .catch(() => {
        /* task drops show as unavailable */
      });
  }, []);

  const set = (patch: Partial<DropForm>) => setForm((f) => ({ ...f, ...patch }));
  const usesTasks = form.access.includes("tasks");
  const usesCodes = form.access.includes("codes");
  const split = form.rewardMode === "split";
  // Only drops anyone can reach on their own (tasks, holders) can be listed; link / code drops keep a secret.
  const canList = !form.access.includes("link") && !form.access.includes("codes") && (usesTasks || form.access.includes("holders"));
  const daily = form.cooldownHours > 0;

  // Asset → token address + metadata.
  useEffect(() => {
    let alive = true;
    const load = (token: string, fallbackSymbol?: string) => {
      setTokenNote("Reading token…");
      tokenMeta(token)
        .then((m) => {
          if (!alive) return;
          set({ token: token as `0x${string}`, symbol: fallbackSymbol ?? m.symbol, decimals: m.decimals });
          setTokenNote("");
        })
        .catch(() => alive && setTokenNote("Couldn't read this token on this network."));
    };
    if (assetKind === "ETH") set({ token: ZERO_ADDRESS, symbol: "ETH", decimals: 18 });
    else if (assetKind === "USDC") set({ token: DROPS_USDC, symbol: "USDC", decimals: 6 });
    else if (assetKind === "vault") {
      const v = getVaultShareBySymbol(assetSymbol);
      if (v) set({ token: v.address, symbol: v.symbol, decimals: v.decimals });
    } else if (assetKind === "stock") load(assetToToken(assetSymbol), assetSymbol);
    else if (isAddr(customToken)) load(customToken.trim());
    else setTokenNote("");
    return () => {
      alive = false;
    };
  }, [assetKind, assetSymbol, customToken]);

  useEffect(() => {
    if (!usesTasks && form.rewardMode === "random") setForm((f) => ({ ...f, rewardMode: "fixed" }));
  }, [usesTasks, form.rewardMode]);

  const preview = useMemo(() => prepareDrop(form, { now, appTicketSigner: appSigner, creator: address }), [form, appSigner, address, now]);

  const steps: StepId[] = usesTasks ? ["type", "asset", "who", "tasks", "timing", "review"] : ["type", "asset", "who", "timing", "review"];
  const idx = Math.max(0, steps.indexOf(step));
  const stepDefs: WizardStepDef[] = steps.map((s, i) => ({ step: i + 1, ...STEP_DEFS[s] }));

  const goTo = (target: number) => {
    const t = Math.max(0, Math.min(steps.length - 1, target));
    setError("");
    setDirection(t >= idx ? 1 : -1);
    setStep(steps[t]!);
    setFurthest((f) => Math.max(f, t));
    requestAnimationFrame(() => topRef.current?.scrollIntoView({ behavior: reduce ? "auto" : "smooth", block: "start" }));
  };

  /** Problems that keep the current step from moving on. */
  const stepProblem = (s: StepId): string => {
    if (s === "asset") {
      if (assetKind === "TOKEN" && !isAddr(customToken)) return "Paste the token's contract address.";
      if ((assetKind === "stock" || assetKind === "vault") && form.token === ZERO_ADDRESS) return "Pick a stock or vault.";
      if (tokenNote && tokenNote !== "Reading token…") return tokenNote;
      if (split) {
        const total = toUnits(form.budget, form.decimals);
        const lo = toUnits(form.randomMin, form.decimals);
        const hi = toUnits(form.randomMax, form.decimals);
        if (!total) return "Enter the total to share.";
        if (!lo) return "Enter the smallest amount a claim can get.";
        if (!hi) return "Enter the largest amount a claim can get.";
        const c = checkSplit(total, usesCodes ? form.codeCount : form.totalClaims, lo, hi);
        if (!c.ok) return c.error;
      } else {
        if (form.rewardMode !== "random" && !toUnits(form.amountPerClaim, form.decimals)) return "Enter how much each claim gets.";
        if (!usesCodes && form.totalClaims === 0 && !toUnits(form.budget, form.decimals)) return "Enter the total budget, or set a number of claims.";
      }
    }
    if (s === "who") {
      if (form.access.length === 0) return "Choose who can claim.";
      if (form.access.includes("holders")) {
        if (!isAddr(form.holderToken)) return "Enter the token holders must have.";
        if (!toUnits(form.holderMin || "", form.holderDecimals)) return "Enter how much they must hold.";
      }
      if (form.access.includes("allowlist") && parseList(form.allowlist).valid === 0) return "Add at least one wallet address to your list.";
    }
    if (s === "review" && listing.on && canList) {
      if (listing.title.trim().length < 3) return "Give your public listing a title (3+ characters).";
    }
    if (s === "tasks") {
      if (drafts.length === 0) return "Add at least one task.";
      const bad = drafts.find((d) => missingFields(d).length);
      if (bad) return `“${bad.title || bad.type}” needs: ${missingFields(bad).join(", ")}.`;
      if (form.rewardMode === "random" && (!toUnits(form.randomMin, form.decimals) || !toUnits(form.randomMax, form.decimals))) return "Enter the lucky amount range.";
    }
    return "";
  };

  const next = () => {
    const p = stepProblem(step);
    if (p) return setError(p);
    goTo(idx + 1);
  };

  const pickPreset = (id: PresetId) => {
    const nextForm = defaultForm(id);
    setForm((f) => ({ ...nextForm, token: f.token, symbol: f.symbol, decimals: f.decimals, amountPerClaim: f.amountPerClaim, message: f.message, senderLabel: f.senderLabel }));
    // The steps that follow depend on the type (tasks or not), so restart progress from here.
    setListing((l) => ({ ...l, category: id === "daily-quest" || id === "faucet" ? "daily" : id === "holders" ? "holders" : id === "quest" ? "quest" : id === "cards" || id === "friend" ? "gift" : "airdrop" }));
    setFurthest(1);
    setDirection(1);
    setError("");
    setStep("asset");
    requestAnimationFrame(() => topRef.current?.scrollIntoView({ behavior: reduce ? "auto" : "smooth", block: "start" }));
  };

  const toggleAccess = (a: Access) => {
    const has = form.access.includes(a);
    let nextAccess = has ? form.access.filter((x) => x !== a) : [...form.access, a];
    // Codes replace a shared link; holders/allowlist are one option in the form.
    if (a === "codes" && !has) nextAccess = nextAccess.filter((x) => x !== "link");
    if (a === "link" && !has) nextAccess = nextAccess.filter((x) => x !== "codes");
    if (a === "holders" && !has) nextAccess = nextAccess.filter((x) => x !== "allowlist");
    if (a === "allowlist" && !has) nextAccess = nextAccess.filter((x) => x !== "holders");
    set({ access: nextAccess });
    setFurthest((f) => Math.min(f, idx)); // the step list may change
  };

  const create = async () => {
    setError("");
    if (!DROPS_CONTRACT) return setError("Drops aren't live on this deployment yet.");
    for (const s of steps) {
      const p = stepProblem(s);
      if (p) {
        goTo(steps.indexOf(s));
        return setError(p);
      }
    }
    if (!preview.ok) return setError(preview.error);
    const { params, linkKey, codeKeys, allowlist } = preview.prepared;

    let definition: unknown = null;
    try {
      if (usesTasks) {
        const base = (await draftsToDefinition(drafts)) as Record<string, unknown>;
        definition = { ...base, rewards: preview.prepared.rewards, raffle: preview.prepared.raffle };
      } else if (split) {
        definition = { version: 1, tasks: [], rewards: preview.prepared.rewards };
      }
    } catch (e) {
      return setError(e instanceof Error ? e.message : "Check your tasks.");
    }

    try {
      setBusy("Preparing…");
      const pub = dropsClient();
      const calls: ContractCall[] = [];
      if (params.token === ZERO_ADDRESS) {
        calls.push(encodeContractCall(DROPS_CONTRACT, BASE_DROPS_ABI, "createDrop", [params], params.budget));
      } else {
        const allowance = (await pub.readContract({
          address: params.token,
          abi: ERC20_ABI,
          functionName: "allowance",
          args: [address as `0x${string}`, DROPS_CONTRACT],
        })) as bigint;
        // Approve exactly this drop's budget — never an unlimited allowance.
        if (allowance < params.budget) calls.push(encodeContractCall(params.token, ERC20_ABI, "approve", [DROPS_CONTRACT, params.budget]));
        calls.push(encodeContractCall(DROPS_CONTRACT, BASE_DROPS_ABI, "createDrop", [params]));
      }
      const fromBlock = await pub.getBlockNumber();

      setBusy("Confirm in your wallet…");
      const hash = await sendAppTransactions(connType ?? "injected", address, calls, { targetChainId: DROPS_CHAIN_ID });

      setBusy("Waiting for confirmation…");
      let id: bigint | null = null;
      try {
        const receipt = await pub.waitForTransactionReceipt({ hash: hash as `0x${string}`, timeout: 120_000 });
        const logs = parseEventLogs({ abi: BASE_DROPS_ABI, logs: receipt.logs, eventName: "DropCreated" });
        const mine = logs.find((l) => l.address.toLowerCase() === DROPS_CONTRACT.toLowerCase());
        if (mine) id = mine.args.dropId as bigint;
      } catch {
        /* a calls-bundle id instead of a tx hash: scan events below */
      }
      if (id === null) {
        const logs = await pub.getContractEvents({
          address: DROPS_CONTRACT,
          abi: BASE_DROPS_ABI,
          eventName: "DropCreated",
          args: { creator: address as `0x${string}` },
          fromBlock: fromBlock > BigInt(50) ? fromBlock - BigInt(50) : BigInt(0),
        });
        const last = logs[logs.length - 1];
        if (last) id = last.args.dropId as bigint;
      }
      if (id === null) throw new Error("Your drop was funded but its id couldn't be read yet. It will show in My drops in a minute.");

      // Keep the secrets in this browser (and the private vault when it's on).
      const idStr = id.toString();
      saveDrop(address, { id: idStr, createdAt: Date.now(), linkKey: linkKey ?? undefined, codeKeys: codeKeys.length ? codeKeys : undefined, title: form.message.slice(0, 60) });
      try {
        const slot = `base_campaign_links_v1_${address.toLowerCase()}`;
        const prev = JSON.parse(localStorage.getItem(slot) ?? "[]") as Array<{ id: string }>;
        const entries = [
          ...(linkKey ? [{ id: `drop:${idStr}`, secret: linkKey.slice(2), createdAt: Date.now(), asset: form.symbol, slots: params.maxClaimsTotal }] : []),
          ...codeKeys.map((k, i) => ({ id: `drop:${idStr}:c${i + 1}`, secret: k.slice(2), createdAt: Date.now(), asset: form.symbol, slots: 1 })),
        ];
        localStorage.setItem(slot, JSON.stringify([...entries, ...prev.filter((p) => !entries.some((e) => e.id === p.id))].slice(0, 200)));
        syncVaultInBackground(address);
      } catch {
        /* private mode */
      }

      const warnings: string[] = [];
      if (definition || allowlist.length) {
        setBusy("Sign in to save the rules…");
        try {
          await ensureSignedIn(address, connType);
          if (definition) await dropsApi.saveDefinition(idStr, address, definition);
          if (allowlist.length) await dropsApi.saveAllowlist(idStr, address, allowlist);
        } catch (e) {
          updateSavedDrop(address, idStr, { pendingDefinition: definition ?? undefined, pendingAllowlist: allowlist.length ? allowlist : undefined });
          warnings.push(
            `Your drop is live, but its ${definition ? "tasks" : "list"} weren't saved (${e instanceof Error ? e.message : "error"}). Open My drops and tap “Save rules” to retry.`
          );
        }
      }

      let listed = false;
      if (listing.on && canList) {
        setBusy("Listing in Explore…");
        try {
          await ensureSignedIn(address, connType);
          await dropsApi.saveListing(idStr, address, { title: listing.title.trim(), blurb: listing.blurb.trim(), category: listing.category });
          listed = true;
        } catch (e) {
          warnings.push(`Your drop is live, but it couldn't be listed in Explore (${e instanceof Error ? e.message : "error"}). Open My drops to list it.`);
        }
      }

      const origin = window.location.origin;
      setDone({
        id: idStr,
        listed,
        link: linkKey ? dropLink(origin, id, linkKey) : null,
        codeLinks: codeKeys.map((k) => codeLink(origin, id!, k, codeKeys)),
        publicLink: dropLink(origin, id),
        warnings,
      });
      onCreated?.(idStr);
    } catch (e) {
      setError(explainDropError(e instanceof Error ? e.message : String(e)));
    } finally {
      setBusy("");
    }
  };

  const copy = async (text: string, tag: string) => {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(tag);
      setTimeout(() => setCopied(""), 1500);
    } catch {
      /* clipboard blocked */
    }
  };

  const reset = () => {
    setDone(null);
    setStep("type");
    setFurthest(0);
    setForm(defaultForm("group"));
    setDrafts([]);
    setListing({ on: false, title: "", blurb: "", category: "quest" });
  };

  // ───────────────────────────── derived numbers ─────────────────────────────

  const count = usesCodes ? form.codeCount : form.totalClaims;
  const perUnits = toUnits(form.rewardMode === "random" ? form.randomMax || "" : form.amountPerClaim, form.decimals);
  const totalText = preview.ok
    ? `${fromUnits(preview.prepared.params.budget, form.decimals)} ${form.symbol}`
    : split
      ? form.budget
        ? `${form.budget} ${form.symbol}`
        : "—"
      : perUnits && count
      ? `${fromUnits(perUnits * BigInt(count), form.decimals)} ${form.symbol}`
      : form.budget
        ? `${form.budget} ${form.symbol}`
        : "—";
  const amountLabel = (form.rewardMode === "random" || split) && form.randomMin && form.randomMax ? `${form.randomMin}–${form.randomMax} ${form.symbol}` : `${form.amountPerClaim || "0"} ${form.symbol}`;

  // ───────────────────────────── done ─────────────────────────────

  if (done) {
    const csv = ["code,link", ...done.codeLinks.map((l, i) => `${i + 1},${l}`)].join("\n");
    const share = done.link ?? done.publicLink;
    return (
      <section className="overflow-hidden rounded-3xl border border-[var(--border-subtle)] bg-[var(--surface)] shadow-sm">
        <div className="pulse-surface !rounded-none flex flex-col items-center gap-2 p-6 text-center">
          <AirdropScene size={170} label={form.symbol.slice(0, 5)} />
          <h3 className="text-2xl font-black text-white">Drop #{done.id} is live</h3>
          <p className="text-sm text-white/80">
            {amountLabel} per claim · {totalText} in escrow
          </p>
        </div>
        <div className="space-y-4 p-5 sm:p-6">
          {done.warnings.map((w) => (
            <Notice key={w} tone="warn">
              {w}
            </Notice>
          ))}
          {(done.link || done.codeLinks.length === 0) && (
            <Field label={done.link ? "Your claim link" : "Your drop page"} hint={done.link ? "Anyone who opens it can claim, within your rules. Keep it private if the drop is private." : undefined}>
              <div className="flex gap-2">
                <input readOnly className={inputCls} value={share} onFocus={(e) => e.currentTarget.select()} />
                <button type="button" className={btnSecondary} onClick={() => void copy(share, "link")}>
                  <Copy size={14} /> {copied === "link" ? "Copied" : "Copy"}
                </button>
              </div>
            </Field>
          )}
          {done.codeLinks.length > 0 && (
            <div className="space-y-2 rounded-2xl border border-[var(--border-subtle)] bg-[var(--surface-2)]/50 p-4">
              <p className="text-sm font-black text-[var(--ink)]">{done.codeLinks.length} gift-card links (each works once)</p>
              <div className="flex flex-wrap gap-2">
                <button type="button" className={btnSecondary} onClick={() => void copy(done.codeLinks.join("\n"), "codes")}>
                  <Copy size={14} /> {copied === "codes" ? "Copied" : "Copy all"}
                </button>
                <a className={btnSecondary} href={`data:text/csv;charset=utf-8,${encodeURIComponent(csv)}`} download={`drop-${done.id}-codes.csv`}>
                  <Download size={14} /> Download CSV
                </a>
              </div>
            </div>
          )}
          <div className="flex flex-wrap gap-2">
            {typeof navigator !== "undefined" && "share" in navigator && (
              <button type="button" className={btnPrimary} onClick={() => void navigator.share({ title: "A drop for you", url: share }).catch(() => undefined)}>
                <Share2 size={14} /> Share
              </button>
            )}
            <a className={btnSecondary} href={`/drops/${done.id}`}>
              Open drop page
            </a>
            <button type="button" className={btnSecondary} onClick={reset}>
              Create another
            </button>
          </div>
          {done.listed && <Notice tone="ok">Listed in Explore — people can find it there.</Notice>}
          <Notice>Links are saved in this browser and in your private backup if it&apos;s on (My Cards → Private backup). Lost one? Make a new link from My drops.</Notice>
        </div>
      </section>
    );
  }

  // ───────────────────────────── steps ─────────────────────────────

  return (
    <div ref={topRef} className="scroll-mt-20 space-y-4">
      {step !== "type" && <WizardStepper steps={stepDefs} current={idx + 1} onSelect={(n) => goTo(n - 1)} isDisabled={(n) => n - 1 > furthest} />}

      <div className="overflow-hidden rounded-3xl border border-[var(--border-subtle)] bg-[var(--surface)] p-5 shadow-sm sm:p-7">
        {!DROPS_CONTRACT && <Notice tone="warn">Drops aren&apos;t live on this deployment yet. You can explore the options; creating is turned off.</Notice>}

        <AnimatePresence mode="wait" initial={false}>
          <StepSlide key={step} direction={direction}>
            {step === "type" && (
              <>
                <StepHeader icon={Sparkles} step={1} total={steps.length} title="What kind of drop?" description="Pick one to start — the next steps open with the right settings. You can change everything later." />
                <div className="grid gap-3 sm:grid-cols-2">
                  {PRESETS.map((p, i) => {
                    const look = PRESET_LOOK[p.id];
                    const Icon = look.icon;
                    return (
                      <motion.button
                        key={p.id}
                        type="button"
                        onClick={() => pickPreset(p.id)}
                        initial={reduce ? false : { opacity: 0, y: 10 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ delay: i * 0.04 }}
                        whileHover={reduce ? undefined : { y: -2 }}
                        className={`group relative flex min-h-[92px] cursor-pointer items-start gap-3 rounded-2xl border p-4 text-left transition ${
                          form.preset === p.id && furthest > 0 ? "border-[var(--brand)] bg-[var(--brand-soft)]/40" : "border-[var(--border-subtle)] bg-[var(--surface-2)]/60 hover:border-[var(--brand)]/50"
                        }`}
                      >
                        <span className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-gradient-to-br ${look.tint} text-white shadow-md`}>
                          <Icon size={20} />
                        </span>
                        <span className="min-w-0 flex-1">
                          <span className="flex items-center justify-between gap-2 text-sm font-black text-[var(--ink)]">
                            {p.title}
                            <ChevronRight size={16} className="shrink-0 text-[var(--ink-muted)] transition group-hover:translate-x-0.5 group-hover:text-[var(--brand-text)]" />
                          </span>
                          <span className="mt-0.5 block text-xs text-[var(--ink-muted)]">{p.note}</span>
                          <span className="mt-2 flex flex-wrap gap-1">
                            {look.chips.map((c) => (
                              <Pill key={c}>{c}</Pill>
                            ))}
                          </span>
                        </span>
                      </motion.button>
                    );
                  })}
                </div>
              </>
            )}

            {step === "asset" && (
              <>
                <StepHeader icon={Coins} step={idx + 1} total={steps.length} title="What are you dropping?" description="Pick the asset, then how much each claim gets and how many claims." />
                <div className={`grid grid-cols-2 gap-2.5 ${IS_DROPS_TESTNET ? "sm:grid-cols-3" : "sm:grid-cols-5"}`}>
                  {(
                    [
                      { id: "USDC", label: "USDC", sub: "Digital dollars" },
                      { id: "ETH", label: "ETH", sub: "Ether" },
                      ...(IS_DROPS_TESTNET
                        ? []
                        : [
                            { id: "stock", label: "Stocks", sub: "Real companies" },
                            { id: "vault", label: "Vaults", sub: "Earns yield" },
                          ]),
                      { id: "TOKEN", label: "Any token", sub: "Memecoins, ERC-20" },
                    ] as Array<{ id: AssetKind; label: string; sub: string }>
                  ).map((cat) => {
                    const selected = assetKind === cat.id;
                    return (
                      <button
                        key={cat.id}
                        type="button"
                        aria-pressed={selected}
                        onClick={() => {
                          if (cat.id === "stock" || cat.id === "vault") setPicker({ open: true, category: cat.id });
                          else {
                            setAssetKind(cat.id);
                            setAssetSymbol(cat.id);
                            if (cat.id !== form.symbol) set({ amountPerClaim: "", randomMin: "", randomMax: "", budget: "" });
                          }
                        }}
                        className={`relative isolate flex flex-col items-center gap-1.5 rounded-2xl border px-2 py-4 text-center transition-colors ${
                          selected ? "border-[var(--brand)] bg-[var(--brand-soft)] text-[var(--ink)]" : "border-[var(--border-subtle)] bg-[var(--surface-2)] text-[var(--ink-muted)] hover:border-[var(--brand)]/40 hover:text-[var(--ink)]"
                        }`}
                      >
                        <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-[var(--surface)] shadow-sm">
                          {cat.id === "USDC" ? (
                            <TokenLogo address={DROPS_USDC} symbol="USDC" size={28} />
                          ) : cat.id === "ETH" ? (
                            <TokenLogo address={ZERO_ADDRESS} symbol="ETH" size={28} />
                          ) : cat.id === "stock" ? (
                            <TrendingUp size={20} className="text-[var(--brand-text)]" />
                          ) : cat.id === "vault" ? (
                            <Zap size={20} className="text-amber-500" />
                          ) : (
                            <Coins size={20} className="text-violet-500" />
                          )}
                        </span>
                        <span className="text-sm font-black">{cat.label}</span>
                        <span className="text-[11px] text-[var(--ink-muted)]">{cat.sub}</span>
                      </button>
                    );
                  })}
                </div>

                {assetKind === "TOKEN" && (
                  <Field label="Token contract address" hint={tokenNote || (isAddr(customToken) ? `${form.symbol} · ${form.decimals} decimals` : "Any ERC-20 on Base — your memecoin, project token, LP token…")}>
                    <input className={inputCls} value={customToken} onChange={(e) => setCustomToken(e.target.value.trim())} placeholder="0x…" spellCheck={false} />
                  </Field>
                )}

                <div className="flex items-center justify-between gap-3 rounded-2xl border border-[var(--border-subtle)] bg-gradient-to-br from-[var(--surface-2)] to-[var(--surface)] p-3.5">
                  <div className="flex min-w-0 items-center gap-3">
                    <TokenLogo address={form.token === ZERO_ADDRESS ? ZERO_ADDRESS : form.token} symbol={form.symbol} size={40} shape="rounded-xl" />
                    <div className="min-w-0">
                      <p className="truncate text-sm font-black text-[var(--ink)]">{form.symbol}</p>
                      <p className="truncate text-xs text-[var(--ink-muted)]">
                        {assetKind === "vault" ? getVaultShareBySymbol(assetSymbol)?.name : assetKind === "stock" ? "Tokenized stock" : IS_DROPS_TESTNET ? "Base Sepolia" : "Base"}
                      </p>
                    </div>
                  </div>
                  {(assetKind === "stock" || assetKind === "vault") && (
                    <button type="button" className="rounded-lg border border-[var(--brand)]/30 px-3 py-1.5 text-xs font-bold text-[var(--brand-text)] hover:bg-[var(--brand-soft)]" onClick={() => setPicker({ open: true, category: assetKind })}>
                      Change
                    </button>
                  )}
                </div>

                <Segmented
                  id="reward-mode"
                  label="Reward amount"
                  value={form.rewardMode}
                  onChange={(v) => set(v === "split" ? { rewardMode: v, totalClaims: form.totalClaims || 100 } : { rewardMode: v })}
                  options={[
                    { value: "fixed" as const, label: "Same for everyone" },
                    { value: "split" as const, label: "Random split" },
                    ...(usesTasks ? [{ value: "random" as const, label: "Lucky each" }] : []),
                  ]}
                />

                {split ? (
                  <Section title="Total to share" hint="All of it goes into escrow now. It's shared randomly across the claims, so every claim is different and it adds up exactly.">
                    <div className="relative">
                      <input
                        aria-label={`Total to share in ${form.symbol}`}
                        className={`${inputCls} min-h-[56px] pr-20 text-2xl font-black`}
                        inputMode="decimal"
                        value={form.budget}
                        onChange={(e) => set({ budget: e.target.value.replace(",", ".") })}
                        placeholder="1"
                      />
                      <span className="pointer-events-none absolute right-4 top-1/2 -translate-y-1/2 text-sm font-black text-[var(--ink-muted)]">{form.symbol}</span>
                    </div>
                  </Section>
                ) : form.rewardMode === "random" && usesTasks ? (
                  <Section title="Lucky amount" hint="Each claim gets a random amount in this range. The escrow covers the max for every claim; what's unused comes back.">
                    <div className="grid grid-cols-2 gap-2">
                      <Field label={`From (${form.symbol})`}>
                        <input className={inputCls} inputMode="decimal" value={form.randomMin} onChange={(e) => set({ randomMin: e.target.value, amountPerClaim: e.target.value })} placeholder="0.001" />
                      </Field>
                      <Field label={`Up to (${form.symbol})`}>
                        <input className={inputCls} inputMode="decimal" value={form.randomMax} onChange={(e) => set({ randomMax: e.target.value })} placeholder="0.01" />
                      </Field>
                    </div>
                  </Section>
                ) : (
                  <Section title="Each claim gets">
                    <div className="relative">
                      <input
                        aria-label={`Amount per claim in ${form.symbol}`}
                        className={`${inputCls} min-h-[56px] pr-20 text-2xl font-black`}
                        inputMode="decimal"
                        value={form.amountPerClaim}
                        onChange={(e) => set({ amountPerClaim: e.target.value.replace(",", ".") })}
                        placeholder="0.00"
                      />
                      <span className="pointer-events-none absolute right-4 top-1/2 -translate-y-1/2 text-sm font-black text-[var(--ink-muted)]">{form.symbol}</span>
                    </div>
                    {AMOUNT_CHIPS[form.symbol] && (
                      <Chips value={form.amountPerClaim} onPick={(v) => set({ amountPerClaim: v })} options={AMOUNT_CHIPS[form.symbol]!.map((v) => ({ value: v, label: `${v} ${form.symbol}` }))} />
                    )}
                  </Section>
                )}

                <Section
                  title={usesCodes ? "How many gift codes" : split ? "How many cards (claims)" : "How many claims in total"}
                  hint={usesCodes ? "Each code works once." : !split && form.totalClaims === 0 ? "No fixed number: claims continue until the budget runs out." : undefined}
                  aside={
                    !usesCodes &&
                    !split && <Toggle checked={form.totalClaims === 0} onChange={(v) => set({ totalClaims: v ? 0 : 10 })} label="Until budget runs out" />
                  }
                >
                  {usesCodes ? (
                    <div className="flex flex-wrap items-center gap-3">
                      <Stepper label="codes" min={1} max={split ? 1000 : 500} value={form.codeCount} onChange={(v) => set({ codeCount: v, totalClaims: v })} />
                      <Chips value={form.codeCount} onPick={(v) => set({ codeCount: v, totalClaims: v })} options={[5, 10, 25, 50, 100].map((v) => ({ value: v, label: String(v) }))} />
                    </div>
                  ) : !split && form.totalClaims === 0 ? (
                    <Field label={`Total budget (${form.symbol})`}>
                      <input className={inputCls} inputMode="decimal" value={form.budget} onChange={(e) => set({ budget: e.target.value })} placeholder="e.g. 1" />
                    </Field>
                  ) : (
                    <div className="flex flex-wrap items-center gap-3">
                      <Stepper label="claims" min={1} max={split ? 1000 : 100_000} value={form.totalClaims} onChange={(v) => set({ totalClaims: v })} />
                      <Chips value={form.totalClaims} onPick={(v) => set({ totalClaims: v })} options={[1, 10, 50, 100, 500].map((v) => ({ value: v, label: String(v) }))} />
                    </div>
                  )}
                </Section>

                {split && <SplitSection form={form} set={set} count={usesCodes ? form.codeCount : form.totalClaims} />}

                <CrateSplit count={form.totalClaims === 0 && !usesCodes ? 0 : count} each={amountLabel} total={totalText} />
              </>
            )}

            {step === "who" && (
              <>
                <StepHeader icon={Users} step={idx + 1} total={steps.length} title="Who can claim?" description="Tap an option to turn it on — its settings open right below. You can combine a link or codes with a list, holders or tasks." />
                <div className="space-y-2.5">
                  {(Object.keys(ACCESS_LOOK) as Access[]).map((a) => {
                    const look = ACCESS_LOOK[a];
                    const Icon = look.icon;
                    const selected = form.access.includes(a);
                    return (
                      <OptionCard key={a} multi icon={<Icon size={18} />} title={look.title} note={look.note} selected={selected} onSelect={() => toggleAccess(a)} badge={a === "tasks" && !appSigner ? <Pill tone="warn">Not set up here</Pill> : undefined}>
                        {a === "link" && <p className="text-xs text-[var(--ink-muted)]">You&apos;ll get one link after launching. Each wallet proves it has the link when claiming, so front-runners can&apos;t steal claims.</p>}
                        {a === "codes" && (
                          <div className="flex flex-wrap items-center gap-3">
                            <Stepper label="codes" min={1} max={500} value={form.codeCount} onChange={(v) => set({ codeCount: v, totalClaims: v })} />
                            <span className="text-xs text-[var(--ink-muted)]">codes · download them as CSV after launch</span>
                          </div>
                        )}
                        {a === "allowlist" && <AllowlistField value={form.allowlist} onChange={(v) => set({ allowlist: v })} />}
                        {a === "holders" && (
                          <>
                            <div className="grid gap-2 sm:grid-cols-[2fr_1fr]">
                              <Field label="Token, NFT or stock they must hold">
                                <input
                                  className={inputCls}
                                  value={form.holderToken}
                                  spellCheck={false}
                                  onChange={(e) => {
                                    const v = e.target.value.trim();
                                    set({ holderToken: v });
                                    if (isAddr(v)) void tokenMeta(v).then((m) => set({ holderDecimals: m.decimals })).catch(() => undefined);
                                  }}
                                  placeholder="0x…"
                                />
                              </Field>
                              <Field label="At least">
                                <input className={inputCls} inputMode="decimal" value={form.holderMin} onChange={(e) => set({ holderMin: e.target.value })} placeholder="1" />
                              </Field>
                            </div>
                            <div className="space-y-1.5">
                              <p className="text-xs font-bold text-[var(--ink-soft)]">Reward stock holders: pick a stock</p>
                              <Chips
                                value={form.holderToken}
                                onPick={(v) => set({ holderToken: v, holderDecimals: BASE_STOCK_DECIMALS })}
                                options={["NVDAc", "AAPLc", "MSFTc", "GOOGLc", "AMZNc", "TSLAc", "METAc"].flatMap((sym) => {
                                  const st = BASE_OFFICIAL_STOCKS.find((x) => x.symbol === sym);
                                  return st ? [{ value: st.address as string, label: sym }] : [];
                                })}
                              />
                            </div>
                            <details className="rounded-xl border border-[var(--border-subtle)] px-3 py-1">
                              <summary className="min-h-[40px] cursor-pointer py-2.5 text-xs font-bold text-[var(--ink-muted)]">Also let a list of wallets in (optional)</summary>
                              <div className="pb-2">
                                <AllowlistField value={form.allowlist} onChange={(v) => set({ allowlist: v })} />
                              </div>
                            </details>
                          </>
                        )}
                        {a === "tasks" && <p className="text-xs text-[var(--ink-muted)]">Next you&apos;ll pick the tasks — social follows, buys, quizzes, events and more — plus streaks, lucky amounts and raffles.</p>}
                      </OptionCard>
                    );
                  })}
                </div>
              </>
            )}

            {step === "tasks" && (
              <>
                <StepHeader icon={ListChecks} step={idx + 1} total={steps.length} title="What do they do first?" description="Add tasks from the library or start from a template. Each one is checked by the app before it signs a claim." />
                {!appSigner && <Notice tone="warn">Task checks aren&apos;t set up on this deployment yet.</Notice>}
                <TaskLibrary catalog={catalog} drafts={drafts} onChange={setDrafts} daily={daily} maxDays={Math.min(form.expiresInDays, 30)} />
                {uncoveredDays(drafts, form.expiresInDays).length > 0 && (
                  <Notice tone="warn">
                    No task is scheduled for {rangesText(uncoveredDays(drafts, form.expiresInDays).slice(0, 60))}
                    {uncoveredDays(drafts, form.expiresInDays).length > 60 ? "…" : ""}, so nobody can claim then. Add an &ldquo;Every day&rdquo; task or plan those days — you can also add tomorrow&apos;s task later from My drops (unless you lock the drop).
                  </Notice>
                )}

                <Section title="Bonus rewards" hint="Optional extras that make it fun to come back.">
                  <div className="space-y-2.5">
                    <OptionCard
                      multi
                      icon={<Flame size={18} />}
                      title="Streak bonus"
                      note="Claim on consecutive days, get a bit more each day."
                      selected={form.streakBonusPct > 0 && !split}
                      onSelect={() => !split && set({ streakBonusPct: form.streakBonusPct > 0 ? 0 : 10 })}
                    >
                      {!daily && <Notice tone="warn">Streaks need repeat claims — set “Every day” in the next step.</Notice>}
                      {split && <Notice tone="warn">A random split can&apos;t also have a streak bonus.</Notice>}
                      <div className="grid grid-cols-2 gap-2">
                        <Field label="Bonus per day (%)">
                          <input className={inputCls} inputMode="numeric" value={String(form.streakBonusPct)} onChange={(e) => set({ streakBonusPct: Math.min(100, Number(e.target.value.replace(/\D/g, "")) || 0) })} />
                        </Field>
                        <Field label="Counts up to (days)">
                          <input className={inputCls} inputMode="numeric" value={String(form.streakMaxDays)} onChange={(e) => set({ streakMaxDays: Number(e.target.value.replace(/\D/g, "")) || 0 })} />
                        </Field>
                      </div>
                    </OptionCard>
                    <OptionCard
                      multi
                      icon={<Trophy size={18} />}
                      title="Raffle"
                      note="Everyone who finishes enters; only the winners can claim."
                      selected={form.raffleWinners > 0}
                      onSelect={() => set({ raffleWinners: form.raffleWinners > 0 ? 0 : 10 })}
                    >
                      <div className="grid grid-cols-2 gap-2">
                        <Field label="Winners">
                          <input className={inputCls} inputMode="numeric" value={String(form.raffleWinners)} onChange={(e) => set({ raffleWinners: Number(e.target.value.replace(/\D/g, "")) || 0 })} />
                        </Field>
                        <Field label="Draw in">
                          <Segmented
                            id="raffle-in"
                            label="Draw in"
                            value={[24, 72, 168].includes(form.raffleInHours) ? form.raffleInHours : null}
                            onChange={(v) => set({ raffleInHours: v })}
                            options={[
                              { value: 24, label: "1d" },
                              { value: 72, label: "3d" },
                              { value: 168, label: "7d" },
                            ]}
                          />
                        </Field>
                      </div>
                      <p className="text-[11px] text-[var(--ink-muted)]">The draw uses a future Base block hash, committed in advance, so nobody (including you) can pick the winners.</p>
                    </OptionCard>
                  </div>
                </Section>
              </>
            )}

            {step === "timing" && (
              <TimingStep form={form} set={set} idx={idx} total={steps.length} />
            )}

            {step === "review" && (
              <>
                <StepHeader icon={Rocket} step={idx + 1} total={steps.length} title="Check and launch" description="Add a note, check the details, then fund the escrow from your wallet." />
                <div className="grid gap-4 lg:grid-cols-[1fr_1.1fr]">
                  <div className="space-y-3">
                    <DropPreviewCard amount={amountLabel} message={form.message} sender={form.senderLabel} tasks={usesTasks ? drafts.length : 0} />
                    <Field label="Message (optional)">
                      <textarea className={`${inputCls} min-h-[72px] py-2`} maxLength={280} value={form.message} onChange={(e) => set({ message: e.target.value })} placeholder="gm! thanks for being early 💙" />
                    </Field>
                    <Field label="From (optional)" hint="Shown next to your wallet or Basename.">
                      <input className={inputCls} maxLength={40} value={form.senderLabel} onChange={(e) => set({ senderLabel: e.target.value })} placeholder="Your name or project" />
                    </Field>
                    <OptionCard
                      multi
                      icon={<Globe size={18} />}
                      title="List it in Explore"
                      note={canList ? "Show this drop in the public feed so people can find it." : "Only drops with tasks or token holders can be public. Link and gift-card drops keep a secret, so they stay private."}
                      selected={listing.on && canList}
                      onSelect={() => canList && setListing((l) => ({ ...l, on: !l.on, title: l.title || form.senderLabel.trim() || (usesTasks ? "New quest" : "New drop") }))}
                    >
                      <Field label="Title">
                        <input className={inputCls} maxLength={60} value={listing.title} onChange={(e) => setListing((l) => ({ ...l, title: e.target.value }))} />
                      </Field>
                      <Field label="One line about it (optional)">
                        <input className={inputCls} maxLength={160} value={listing.blurb} onChange={(e) => setListing((l) => ({ ...l, blurb: e.target.value }))} placeholder="Follow us and claim a random share" />
                      </Field>
                      <Chips value={listing.category} onPick={(v) => setListing((l) => ({ ...l, category: v }))} options={LISTING_CATS.map((c) => ({ value: c.id, label: c.label }))} />
                    </OptionCard>
                  </div>
                  <div className="space-y-2">
                    <ReviewRow icon={Gift} label="Reward" value={`${amountLabel} per claim`} sub={`${totalText} into escrow`} onEdit={() => goTo(steps.indexOf("asset"))} />
                    <ReviewRow
                      icon={Users}
                      label="Who"
                      value={form.access.map((a) => ACCESS_LOOK[a].title).join(" + ")}
                      sub={usesCodes ? `${form.codeCount} codes` : form.totalClaims ? `${form.totalClaims} claims` : "until the budget runs out"}
                      onEdit={() => goTo(steps.indexOf("who"))}
                    />
                    {usesTasks && (
                      <ReviewRow
                        icon={ListChecks}
                        label="Tasks"
                        value={`${drafts.length} task${drafts.length === 1 ? "" : "s"}`}
                        sub={[form.streakBonusPct ? `+${form.streakBonusPct}%/day streak` : "", form.raffleWinners ? `raffle: ${form.raffleWinners} winners` : ""].filter(Boolean).join(" · ") || drafts.map((d) => d.title).slice(0, 3).join(", ")}
                        onEdit={() => goTo(steps.indexOf("tasks"))}
                      />
                    )}
                    <ReviewRow
                      icon={CalendarClock}
                      label="Rules"
                      value={[
                        form.cooldownHours ? `every ${form.cooldownHours}h` : form.maxClaimsPerWallet === 1 ? "once per wallet" : form.maxClaimsPerWallet ? `${form.maxClaimsPerWallet} per wallet` : "no per-wallet limit",
                        form.perDayCap ? `${form.perDayCap}/day max` : "",
                      ]
                        .filter(Boolean)
                        .join(" · ")}
                      sub={`${form.unlockInHours ? `opens in ${form.unlockInHours}h` : "opens now"} · ends in ${form.expiresInDays} days${form.committed ? " · locked" : ""}`}
                      onEdit={() => goTo(steps.indexOf("timing"))}
                    />
                    {split && (
                      <Notice>
                        Random split: {totalText} is shared across {count} claims, each between {form.randomMin} and {form.randomMax} {form.symbol}. The exact shares are drawn privately by the app and add up to the total, with nothing left over.
                      </Notice>
                    )}
                    {usesTasks && uncoveredDays(drafts, form.expiresInDays).length > 0 && (
                      <Notice tone="warn">No task for {rangesText(uncoveredDays(drafts, form.expiresInDays).slice(0, 60))} — nobody can claim on those days.</Notice>
                    )}
                    {!split && preview.ok && preview.prepared.params.maxAmountPerClaim > BigInt(0) && (
                      <Notice>
                        A claim can be up to {fromUnits(preview.prepared.params.maxAmountPerClaim, form.decimals)} {form.symbol}, so the escrow covers that for every claim. Anything unused comes back to you.
                      </Notice>
                    )}
                    {preview.ok && form.token !== ZERO_ADDRESS && <Notice>Your wallet approves exactly {totalText} (never unlimited), then funds the drop.</Notice>}
                    {!preview.ok && <Notice tone="error">{preview.error}</Notice>}
                    {!IS_DROPS_TESTNET && (
                      <Notice tone="warn">This uses real funds on Base. Check the amount and who can claim before you launch. A drop can be closed any time (unless you locked it) and what is left comes back to you.</Notice>
                    )}
                    <div className="flex items-center gap-2 rounded-xl bg-emerald-500/10 px-3 py-2 text-xs font-semibold text-emerald-700 dark:text-emerald-300">
                      <ShieldCheck size={14} className="shrink-0" /> Funds sit in the drop contract. Whatever isn&apos;t claimed comes back to you after it ends.
                    </div>
                  </div>
                </div>
              </>
            )}
          </StepSlide>
        </AnimatePresence>

        {error && (
          <div className="mt-4">
            <Notice tone="error">{error}</Notice>
          </div>
        )}

        {step !== "type" && (
          <div className="mt-5 flex items-center justify-between gap-2 border-t border-[var(--border-subtle)] pt-4">
            <button type="button" className={btnSecondary} onClick={() => goTo(idx - 1)} disabled={Boolean(busy)}>
              <ChevronLeft size={16} /> Back
            </button>
            {step === "review" ? (
              <ClickSpark>
                <button type="button" className={`${btnPrimary} px-6`} onClick={() => void create()} disabled={Boolean(busy) || !preview.ok || !DROPS_CONTRACT}>
                  {busy ? (
                    <>
                      <Loader2 size={16} className="animate-spin" /> {busy}
                    </>
                  ) : (
                    <>
                      <Rocket size={16} /> Launch drop · {totalText}
                    </>
                  )}
                </button>
              </ClickSpark>
            ) : (
              <button type="button" className={`${btnPrimary} px-6`} onClick={next}>
                Continue <ChevronRight size={16} />
              </button>
            )}
          </div>
        )}
      </div>

      <VoucherAssetPickerModal
        open={picker.open}
        onClose={() => setPicker((p) => ({ ...p, open: false }))}
        category={picker.category}
        selectedSymbol={assetSymbol}
        onSelect={(sym) => {
          setAssetKind(picker.category);
          setAssetSymbol(sym);
          set({ amountPerClaim: "", randomMin: "", randomMax: "", budget: "" });
          setPicker((p) => ({ ...p, open: false }));
        }}
      />
    </div>
  );
}

// ───────────────────────────── pieces ─────────────────────────────

/** "N crates × amount each = total" with a little fan of crates. */
function CrateSplit({ count, each, total }: { count: number; each: string; total: string }) {
  const reduce = useReducedMotion();
  const drawn = Math.max(1, Math.min(count || 1, 6));
  return (
    <div className="flex items-center gap-4 rounded-2xl border border-emerald-500/25 bg-emerald-500/8 p-4">
      <div className="relative h-12 shrink-0" style={{ width: 40 + (drawn - 1) * 12 }} aria-hidden>
        {Array.from({ length: drawn }, (_, i) => (
          <motion.div
            key={`${count}-${i}`}
            className="absolute top-0 flex h-12 w-10 items-end justify-center rounded-lg bg-gradient-to-b from-[var(--brand)] to-indigo-600 pb-1 shadow-md"
            style={{ left: i * 12, zIndex: i }}
            initial={reduce ? false : { y: -16, opacity: 0 }}
            animate={{ y: 0, opacity: 1, rotate: (i - (drawn - 1) / 2) * 4 }}
            transition={{ delay: i * 0.05, type: "spring", stiffness: 320, damping: 18 }}
          >
            <span className="absolute inset-x-0 top-2 h-1.5 bg-amber-300/90" />
            <span className="absolute inset-y-0 left-1/2 w-1.5 -translate-x-1/2 bg-amber-300/90" />
          </motion.div>
        ))}
      </div>
      <div className="min-w-0">
        <p className="text-sm font-black text-[var(--ink)]">{count ? `${count} ${count === 1 ? "claim" : "claims"} × ${each}` : `${each} per claim`}</p>
        <p className="truncate text-sm font-bold text-emerald-600 dark:text-emerald-400">{total === "—" ? "Enter an amount to see the total" : `${total} total in escrow`}</p>
      </div>
    </div>
  );
}

function AllowlistField({ value, onChange }: { value: string; onChange: (v: string) => void }) {
  const stats = parseList(value);
  return (
    <div className="space-y-1.5">
      <textarea
        aria-label="Wallet addresses"
        className={`${inputCls} min-h-[96px] py-2 font-mono text-xs`}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={"0x…\n0x…"}
        spellCheck={false}
      />
      <div className="flex flex-wrap items-center justify-between gap-2">
        <span className="text-[11px] font-semibold text-[var(--ink-muted)]">
          {stats.valid} wallet{stats.valid === 1 ? "" : "s"}
          {stats.invalid ? <span className="text-amber-600 dark:text-amber-400"> · {stats.invalid} not an address (ignored)</span> : null}
        </span>
        <label className="inline-flex min-h-[36px] cursor-pointer items-center gap-1.5 rounded-lg border border-[var(--border-subtle)] px-3 text-xs font-bold text-[var(--ink)] hover:bg-[var(--surface-2)]">
          <Upload size={13} /> Upload CSV / TXT
          <input
            type="file"
            accept=".csv,.txt,text/csv,text/plain"
            className="sr-only"
            onChange={async (e) => {
              const f = e.target.files?.[0];
              if (!f || f.size > 2_000_000) return;
              const text = await f.text();
              const found = text.match(/0x[0-9a-fA-F]{40}/g) ?? [];
              onChange([value.trim(), ...found].filter(Boolean).join("\n"));
              e.target.value = "";
            }}
          />
        </label>
      </div>
    </div>
  );
}

function TimingStep({ form, set, idx, total }: { form: DropForm; set: (p: Partial<DropForm>) => void; idx: number; total: number }) {
  const freq = form.cooldownHours === 24 && form.maxClaimsPerWallet === 0 ? "daily" : form.cooldownHours === 0 && form.maxClaimsPerWallet === 1 ? "once" : "custom";
  const [custom, setCustom] = useState(freq === "custom");
  const mode = custom ? "custom" : freq;
  const [backupOn, setBackupOn] = useState(form.recovery !== "");
  return (
    <>
      <StepHeader icon={CalendarClock} step={idx + 1} total={total} title="How often and when?" description="Set how each wallet can claim, when the drop opens and when it ends." />
      <Section title="Each wallet can claim">
        <Segmented
          id="freq"
          label="Claim frequency"
          value={mode}
          onChange={(v) => {
            setCustom(v === "custom");
            if (v === "once") set({ maxClaimsPerWallet: 1, cooldownHours: 0 });
            if (v === "daily") set({ maxClaimsPerWallet: 0, cooldownHours: 24, perDayCap: form.perDayCap || 100 });
          }}
          options={[
            { value: "once", label: "Once" },
            { value: "daily", label: "Every day" },
            { value: "custom", label: "Custom" },
          ]}
        />
        {mode === "custom" && (
          <div className="grid grid-cols-2 gap-2">
            <Field label="Claims per wallet" hint="0 = no limit">
              <input className={inputCls} inputMode="numeric" value={String(form.maxClaimsPerWallet)} onChange={(e) => set({ maxClaimsPerWallet: Number(e.target.value.replace(/\D/g, "")) || 0 })} />
            </Field>
            <Field label="Hours between claims" hint="0 = any time">
              <input className={inputCls} inputMode="numeric" value={String(form.cooldownHours)} onChange={(e) => set({ cooldownHours: Number(e.target.value.replace(/\D/g, "")) || 0 })} />
            </Field>
          </div>
        )}
        {form.cooldownHours > 0 && (
          <Field label="Max claims per day, all wallets" hint="Keeps a popular drop from emptying in one day. 0 = no cap.">
            <input className={inputCls} inputMode="numeric" value={String(form.perDayCap)} onChange={(e) => set({ perDayCap: Number(e.target.value.replace(/\D/g, "")) || 0 })} />
          </Field>
        )}
      </Section>

      <div className="grid gap-4 sm:grid-cols-2">
        <Section title="Opens">
          <Segmented
            id="opens"
            label="Opens"
            value={[0, 1, 24, 72].includes(form.unlockInHours) ? form.unlockInHours : null}
            onChange={(v) => set({ unlockInHours: v })}
            options={[
              { value: 0, label: "Now" },
              { value: 1, label: "1h" },
              { value: 24, label: "1d" },
              { value: 72, label: "3d" },
            ]}
          />
        </Section>
        <Section title="Ends after">
          <Segmented
            id="ends"
            label="Ends after"
            value={[1, 7, 30, 90].includes(form.expiresInDays) ? form.expiresInDays : null}
            onChange={(v) => set({ expiresInDays: v })}
            options={[
              { value: 1, label: "1d" },
              { value: 7, label: "7d" },
              { value: 30, label: "30d" },
              { value: 90, label: "90d" },
            ]}
          />
        </Section>
      </div>
      <p className="-mt-2 text-xs text-[var(--ink-muted)]">
        {form.unlockInHours ? `Opens in ${form.unlockInHours} hour${form.unlockInHours === 1 ? "" : "s"}` : "Claimable right away"}, ends {form.expiresInDays} day
        {form.expiresInDays === 1 ? "" : "s"} later. Anything left then comes back to you.
      </p>

      <Section title="Trust & safety">
        <div className="space-y-2.5">
          <OptionCard
            multi
            icon={<Lock size={18} />}
            title="Lock it until it ends"
            note="You can't cancel, pause or change tasks early. Claimers see a ‘Locked’ badge and can trust the funds stay."
            selected={form.committed}
            onSelect={() => set({ committed: !form.committed })}
          />
          <OptionCard
            multi
            icon={<KeyRound size={18} />}
            title="Backup wallet"
            note="If you lose this wallet, the backup can take over 30 days after the drop ends and get back what's left."
            selected={backupOn}
            onSelect={() => {
              if (backupOn) set({ recovery: "" });
              setBackupOn(!backupOn);
            }}
          >
            <Field label="Backup wallet address">
              <input className={inputCls} value={form.recovery} onChange={(e) => set({ recovery: e.target.value.trim() })} placeholder="0x…" spellCheck={false} />
            </Field>
          </OptionCard>
        </div>
      </Section>
    </>
  );
}

function ReviewRow({ icon: Icon, label, value, sub, onEdit }: { icon: LucideIcon; label: string; value: string; sub?: string; onEdit: () => void }) {
  return (
    <div className="flex items-start gap-3 rounded-2xl border border-[var(--border-subtle)] bg-[var(--surface-2)]/50 p-3">
      <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-[var(--surface)] text-[var(--brand-text)] shadow-sm">
        <Icon size={16} />
      </span>
      <div className="min-w-0 flex-1">
        <p className="text-[11px] font-bold uppercase tracking-wide text-[var(--ink-muted)]">{label}</p>
        <p className="text-sm font-bold text-[var(--ink)]">{value}</p>
        {sub && <p className="truncate text-xs text-[var(--ink-muted)]">{sub}</p>}
      </div>
      <button type="button" onClick={onEdit} aria-label={`Edit ${label}`} className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg text-[var(--ink-muted)] hover:bg-[var(--surface)] hover:text-[var(--brand-text)]">
        <Pencil size={14} />
      </button>
    </div>
  );
}

/** What claimers will see: a small version of the claim page header. */
function DropPreviewCard({ amount, message, sender, tasks }: { amount: string; message: string; sender: string; tasks: number }) {
  return (
    <div className="pulse-surface flex items-center gap-3 p-4">
      <AirdropScene size={96} still />
      <div className="min-w-0">
        <p className="text-[11px] font-bold uppercase tracking-wide text-white/70">Preview · what claimers see</p>
        <p className="text-xl font-black text-white">{amount}</p>
        <p className="line-clamp-2 text-xs text-white/85">{message || "A drop for you"}</p>
        <p className="mt-1 text-[11px] font-semibold text-white/70">
          from {sender || "your wallet"}
          {tasks ? ` · ${tasks} task${tasks === 1 ? "" : "s"}` : ""}
        </p>
      </div>
    </div>
  );
}

/** Random split settings: smallest / largest share, a live check, and a sample of how it could look. */
function SplitSection({ form, set, count }: { form: DropForm; set: (p: Partial<DropForm>) => void; count: number }) {
  const [seed, setSeed] = useState(0);
  const total = toUnits(form.budget, form.decimals);
  const lo = toUnits(form.randomMin, form.decimals);
  const hi = toUnits(form.randomMax, form.decimals);
  const check = total && lo && hi && count ? checkSplit(total, count, lo, hi) : null;
  const avgUnits = total && count ? total / BigInt(count) : null;
  const avg = avgUnits ? fromUnits(avgUnits, form.decimals, 6) : "";
  const times = (num: number, den: number) => (avgUnits ? fromUnits((avgUnits * BigInt(num)) / BigInt(den), form.decimals, 8) : "");

  const sample = useMemo(() => {
    void seed;
    if (!check?.ok || !total || !lo || !hi) return null;
    return generateSplit(total, count, lo, hi).sort((a, b) => (a < b ? -1 : a > b ? 1 : 0));
  }, [check?.ok, total, lo, hi, count, seed]);

  const bars = useMemo(() => {
    if (!sample) return [];
    const n = Math.min(sample.length, 60);
    return Array.from({ length: n }, (_, i) => sample[Math.min(sample.length - 1, Math.floor(((i + 0.5) * sample.length) / n))]!);
  }, [sample]);

  return (
    <div className="space-y-3 rounded-2xl border border-[var(--border-subtle)] bg-[var(--surface-2)]/50 p-4">
      <p className="flex items-center gap-2 text-sm font-black text-[var(--ink)]">
        <Shuffle size={16} className="text-[var(--brand-text)]" /> Random split
      </p>
      <div className="grid grid-cols-2 gap-2">
        <Field label={`Smallest share (${form.symbol})`} hint={avg ? `Average is ${avg}` : undefined}>
          <input className={inputCls} inputMode="decimal" value={form.randomMin} onChange={(e) => set({ randomMin: e.target.value.replace(",", ".") })} placeholder="0.001" />
        </Field>
        <Field label={`Largest share (${form.symbol})`}>
          <input className={inputCls} inputMode="decimal" value={form.randomMax} onChange={(e) => set({ randomMax: e.target.value.replace(",", ".") })} placeholder="0.02" />
        </Field>
      </div>
      {avgUnits !== null && avgUnits > BigInt(0) && (
        <div className="flex flex-wrap gap-1.5">
          <Chips value={null as string | null} onPick={(v) => set({ randomMin: v })} options={[{ value: times(1, 4), label: "Min ¼ avg" }, { value: times(1, 2), label: "Min ½ avg" }]} />
          <Chips value={null as string | null} onPick={(v) => set({ randomMax: v })} options={[{ value: times(2, 1), label: "Max 2× avg" }, { value: times(3, 1), label: "Max 3× avg" }, { value: times(5, 1), label: "Max 5× avg" }]} />
        </div>
      )}
      {check && !check.ok && <Notice tone="error">{check.error}</Notice>}
      {sample && (
        <div className="space-y-2">
          <div className="flex items-center justify-between gap-2">
            <p className="text-xs font-bold text-[var(--ink-muted)]">Example of {count} shares (sorted)</p>
            <button type="button" onClick={() => setSeed((n) => n + 1)} className="inline-flex min-h-[32px] items-center gap-1 rounded-lg px-2 text-xs font-bold text-[var(--brand-text)] hover:bg-[var(--brand-soft)]">
              <Shuffle size={12} /> Shuffle example
            </button>
          </div>
          <div className="flex h-16 items-end gap-[2px]" aria-hidden>
            {bars.map((b, i) => (
              <span key={i} className="flex-1 rounded-t bg-gradient-to-t from-[var(--brand)] to-indigo-400" style={{ height: `${Math.max(6, Number((b * BigInt(100)) / (hi ?? BigInt(1))))}%` }} />
            ))}
          </div>
          <p className="text-[11px] text-[var(--ink-muted)]">
            In this example the smallest is {fromUnits(sample[0]!, form.decimals, 6)}, the largest {fromUnits(sample[sample.length - 1]!, form.decimals, 6)}, and they add up to exactly {form.budget} {form.symbol}. The real shares are drawn privately when you launch — nobody, including you, can see or pick who gets what.
          </p>
        </div>
      )}
    </div>
  );
}
