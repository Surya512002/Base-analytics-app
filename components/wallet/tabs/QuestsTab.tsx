"use client";

import {
  Activity, ArrowRightLeft, BadgeCheck, BarChart3, BrainCircuit, Calendar,
  CheckCircle, ChevronDown, ChevronUp, Clock, Coins, Copy, CreditCard,
  Database, DollarSign, Droplets, ExternalLink, FileCode, Flame, Gauge, Gift,
  GitBranch, Globe, History, Landmark, Layers, Lock, MousePointerClick,
  Palette, RefreshCcw, Repeat2, Rocket, Send, Share2, ShieldCheck, Sparkles,
  Star, Sun, Swords, Target, TrendingUp, Trophy, Twitter, User, Users, Wifi,
  Zap,
} from "lucide-react";
import { Transaction, TransactionButton } from "@coinbase/onchainkit/transaction";
import { encodeFunctionData } from "viem";
import { base } from "viem/chains";
import { APP_URL_WEB } from "@/lib/constants/env";
import {
  ACHIEVEMENTS_ABI,
  ACHIEVEMENTS_CONTRACT,
  BASE_BRIDGE,
  BOOSTER_CONTRACT,
  CHECKIN_CONTRACT,
  ENTRYPOINT_V06,
  ENTRYPOINT_V07,
  GM_GN_CONTRACT,
} from "@/lib/constants/contracts";
import { DEX_ROUTERS } from "@/lib/constants/protocols";
import { ACHIEVEMENTS, SEASON_NAME, WEEKLY_QUESTS } from "@/lib/constants/season";
import { getLevelStyle, getTargetTokenId } from "@/lib/utils/achievements";
import { getDaysLeft, getSeasonPct } from "@/lib/utils/season";
import { getBuilderSuffix } from "@/lib/utils/tx";
import type { WalletAppState } from "@/hooks/useWalletApp";

export default function QuestsTab({ app }: { app: WalletAppState }) {
  const {
    wallet, connType, minting, mintedLevels, setMintedLevels, selDay, setSelDay,
    scrollRef, boosts, sponsored, setSponsored, txKeys, setTxKeys, streak,
    checkedToday, setCheckedToday, setStreak, challenge, setChallenge,
    challengeResult, challengeLoading, refCopied, setRefCopied, weeklyXP,
    x402PayCount, boostCall, gmCall, gnCall, ciCall, txCaps, mintedCount, ref,
    showToast, handleChallenge, doNativeTx, doNativeMint, shareScore, shareAch,
    shareAll, leaderboard, lbLoading, doneQuests,
  } = app;

if (!wallet) return null;

  return (
          <div className="space-y-4">
            <div className="relative overflow-hidden bg-linear-to-br from-rose-600 via-cyan-500 to-[#071220] rounded-3xl p-5 sm:p-7 border border-cyan-500/30 shadow-2xl shadow-black/40">
              <div className="absolute inset-0 opacity-10" style={{backgroundImage:'linear-gradient(rgba(255,255,255,0.1) 1px,transparent 1px),linear-gradient(90deg,rgba(255,255,255,0.1) 1px,transparent 1px)',backgroundSize:'32px 32px'}}/>
              <div className="absolute -right-8 -top-8 w-40 h-40 bg-white/5 rounded-full"/>
              <div className="relative flex flex-col sm:flex-row sm:items-center justify-between gap-5">
                <div>
                  <div className="flex items-center gap-2 mb-1.5"><Star size={14} className="text-cyan-200"/><span className="text-xs font-black uppercase tracking-widest text-white/60">{SEASON_NAME}</span></div>
                  <h3 className="text-2xl sm:text-3xl font-black text-white">Season Pass</h3>
                  <p className="text-sm text-white/60 mt-0.5">{getDaysLeft()} days remaining · XP carries over weekly</p>
                  <div className="mt-4 w-full sm:max-w-xs">
                    <div className="flex justify-between text-[10px] text-white/50 font-bold mb-1.5"><span>Progress</span><span>{getSeasonPct()}%</span></div>
                    <div className="w-full bg-white/15 rounded-full h-2 overflow-hidden"><div className="h-full bg-white rounded-full" style={{width:`${getSeasonPct()}%`,transition:'width 1.5s ease-out'}}/></div>
                  </div>
                </div>
                <div className="sm:text-right shrink-0">
                  <p className="text-5xl sm:text-6xl font-black text-white leading-none">{weeklyXP}</p>
                  <p className="text-sm text-white/60 uppercase font-bold">This Week XP</p>
                  <div className="mt-3 flex sm:justify-end gap-2 flex-wrap">
                    <span className="bg-white/10 border border-white/15 rounded-xl px-3 py-1.5 text-xs font-black text-white">{doneQuests}/{WEEKLY_QUESTS.length} quests</span>
                    <span className="bg-white/10 border border-white/15 rounded-xl px-3 py-1.5 text-xs font-black text-white">{streak}d streak</span>
                  </div>
                </div>
              </div>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {WEEKLY_QUESTS.map(q=>{
                const done=q.check(wallet,boosts,streak,txKeys);
                return(
                  <div key={q.id} className={`rounded-2xl p-4 border flex items-center gap-4 justify-between transition-all ${done?'bg-cyan-500/8 border-cyan-500/20':'bg-white/[0.04] border-cyan-500/15 hover:border-cyan-500/20'}`}>
                    <div className="flex items-center gap-3 min-w-0">
                      <div className={`w-11 h-11 rounded-2xl flex items-center justify-center text-xl shrink-0 ${done?'bg-cyan-500/12 border border-cyan-500/20':'bg-white/[0.04] border border-white/8'}`}>{done?'✅':q.icon}</div>
                      <div className="min-w-0">
                        <p className={`font-black text-sm truncate ${done?'text-cyan-300':'text-white'}`}>{q.title}</p>
                        <p className="text-[10px] text-slate-500 truncate mt-0.5">{q.desc}</p>
                      </div>
                    </div>
                    <div className={`shrink-0 px-3 py-2 rounded-xl font-black text-xs border whitespace-nowrap ${done?'bg-cyan-500/10 text-cyan-300 border-cyan-500/18':'bg-white/[0.04] text-cyan-400 border-white/8'}`}>+{q.xp} XP</div>
                  </div>
                );
              })}
            </div>
            <div className="bg-white/[0.04] border border-cyan-500/15 rounded-2xl p-5">
              <p className="font-black text-white mb-4 flex items-center gap-2"><Zap size={15} className="text-cyan-400"/>XP Multipliers & Season Rewards</p>
              <div className="space-y-2">
                {[
                  {l:'3-day check-in streak',b:'2× XP on all quests'},
                  {l:'7-day check-in streak',b:'3× XP on all quests'},
                  {l:'Top 10 at season end',b:'Exclusive Genesis Badge NFT'},
                  {l:'Refer 3+ friends',b:'+150 bonus XP + referral badge'},
                  {l:'All 10 weekly quests',b:'Season multiplier bonus'},
                  {l:'Mint all 11 badges',b:'Hall of Fame status'},
                  {l:'Weekly XP resets Mon',b:'Past weeks carry to Total Season XP'},
                ].map((m,i)=>(
                  <div key={i} className="flex flex-col sm:flex-row sm:items-center justify-between bg-white/[0.03] rounded-xl p-3 border border-white/8 gap-2">
                    <span className="text-xs text-slate-200/70">{m.l}</span>
                    <span className="text-xs font-black text-cyan-400 sm:text-right shrink-0">{m.b}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>
  );
}
