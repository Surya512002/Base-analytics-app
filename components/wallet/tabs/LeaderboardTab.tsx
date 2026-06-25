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

export default function LeaderboardTab({ app }: { app: WalletAppState }) {
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
            <div className="bg-white/[0.04] border border-cyan-500/18 rounded-3xl overflow-hidden shadow-xl shadow-black/25">
              <div className="h-0.5 bg-linear-to-r from-rose-500 via-cyan-400 to-blue-600"/>
              <div className="p-5">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <p className="text-[10px] font-black text-cyan-400/50 uppercase tracking-widest flex items-center gap-2 mb-1"><Users size={11}/>GLOBAL LEADERBOARD</p>
                    <p className="text-2xl font-black text-white">{leaderboard.length.toLocaleString()}</p>
                    <p className="text-[11px] text-slate-500 mt-0.5">Genesis Season Participants</p>
                  </div>
                  <div className="flex flex-col items-end gap-2">
                    <span className="flex items-center gap-1.5 text-[9px] sm:text-[10px] font-bold text-cyan-300 bg-cyan-500/10 border border-cyan-500/18 px-2.5 sm:px-3 py-1.5 rounded-xl whitespace-nowrap"><Wifi size={9}/>Live · Redis</span>
                    <span className="text-[10px] text-slate-500 bg-white/[0.04] border border-white/8 px-3 py-1.5 rounded-xl">{getDaysLeft()}d left</span>
                  </div>
                </div>
              </div>
            </div>

            {(()=>{
              const pos=leaderboard.findIndex(e=>e.address.toLowerCase()===wallet.address.toLowerCase());
              return pos>=0?(
                <div className="bg-white/[0.04] border border-cyan-500/20 rounded-3xl overflow-hidden shadow-xl shadow-black/25">
                  <div className="h-0.5 bg-linear-to-r from-rose-500 to-cyan-400"/>
                  <div className="p-4 sm:p-5">
                    <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
                      <div className="flex items-center gap-3 min-w-0">
                        <div className="w-11 h-11 sm:w-12 sm:h-12 bg-cyan-500/15 border border-cyan-500/30 rounded-2xl flex items-center justify-center font-black text-cyan-400 text-base sm:text-lg shrink-0">#{pos+1}</div>
                        <div className="min-w-0">
                          <p className="font-black text-white text-sm sm:text-base break-all sm:truncate">{wallet.basename||`${wallet.address.slice(0,6)}...${wallet.address.slice(-4)}`}</p>
                          <span className="inline-block text-[10px] font-black text-cyan-300 bg-cyan-500/10 border border-cyan-500/15 px-2 py-0.5 rounded-lg mt-1">{wallet.walletRank}</span>
                        </div>
                      </div>
                      <div className="sm:text-right shrink-0">
                        <p className="text-[10px] font-black text-cyan-400/50 uppercase tracking-widest mb-1">Total Season XP</p>
                        <p className="text-2xl sm:text-4xl font-black text-white tabular-nums leading-none">{(leaderboard[pos]?.totalXP??weeklyXP).toLocaleString()}</p>
                        <p className="text-[11px] text-cyan-400 font-bold mt-1.5 whitespace-nowrap">+{weeklyXP} XP this week</p>
                      </div>
                    </div>
                    <div className="grid grid-cols-3 gap-2 mt-4">
                      {[
                        {l:'Score',v:wallet.score+'/100',c:'text-cyan-400'},
                        {l:'Badges',v:String(mintedCount),c:'text-cyan-300'},
                        {l:'Streak',v:streak+'d',c:'text-cyan-400'},
                      ].map((s,i)=>(
                        <div key={i} className="bg-white/[0.04] border border-white/8 rounded-xl p-2.5 text-center">
                          <p className={`font-black text-base ${s.c}`}>{s.v}</p>
                          <p className="text-[9px] text-slate-500 uppercase font-bold mt-0.5">{s.l}</p>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              ):null;
            })()}

            {lbLoading?(
              <div className="bg-white/[0.04] border border-cyan-500/15 rounded-3xl p-12 text-center">
                <RefreshCcw className="animate-spin text-rose-400 mx-auto mb-3" size={24}/>
                <p className="text-cyan-400/50 font-bold text-sm">Loading...</p>
              </div>
            ):leaderboard.length===0?(
              <div className="bg-white/[0.04] border-2 border-dashed border-white/10 rounded-3xl p-12 text-center">
                <Users size={28} className="text-slate-700 mx-auto mb-3"/>
                <p className="font-black text-slate-600 mb-1">No entries yet</p>
                <p className="text-xs text-slate-700">Be the first! Connect your wallet and earn XP.</p>
              </div>
            ):(
              <div className="bg-white/[0.04] border border-cyan-500/15 rounded-3xl overflow-hidden shadow-lg shadow-black/25">
                <div className="px-3 sm:px-4 py-3 border-b border-white/8 bg-white/[0.03]">
                  <div className="grid grid-cols-[2.25rem_minmax(0,1fr)_4.25rem] sm:grid-cols-[2.5rem_minmax(0,1fr)_4rem_5.5rem_2rem] gap-x-2 sm:gap-x-3 text-[9px] font-black text-slate-500 uppercase tracking-widest">
                    <span>Rank</span>
                    <span>Wallet</span>
                    <span className="hidden sm:block text-right">Badges</span>
                    <span className="text-right">Season XP</span>
                    <span className="hidden sm:block"/>
                  </div>
                </div>
                {leaderboard.map((e,idx)=>{
                  const isMe=e.address.toLowerCase()===wallet.address.toLowerCase();
                  const medal=idx===0?'🥇':idx===1?'🥈':idx===2?'🥉':null;
                  return(
                    <div key={e.address} className={`grid grid-cols-[2.25rem_minmax(0,1fr)_4.25rem] sm:grid-cols-[2.5rem_minmax(0,1fr)_4rem_5.5rem_2rem] gap-x-2 sm:gap-x-3 items-center px-3 sm:px-4 py-3 border-b border-white/6 last:border-0 transition-all ${isMe?'bg-cyan-500/8 border-l-2 border-l-rose-500':'hover:bg-white/[0.03]'}`}>
                      <div className="shrink-0">
                        {medal
                          ?<span className="text-base sm:text-lg">{medal}</span>
                          :<span className={`text-[11px] sm:text-xs font-black ${idx<10?'text-cyan-300/60':'text-slate-600'}`}>#{idx+1}</span>}
                      </div>
                      <div className="min-w-0">
                        <p className={`font-black text-[11px] sm:text-sm leading-snug break-all sm:truncate ${isMe?'text-cyan-400':'text-white'}`}>
                          {e.basename||`${e.address.slice(0,8)}...${e.address.slice(-4)}`}
                          {isMe&&<span className="text-[8px] sm:text-[9px] text-rose-400/60 ml-1.5 font-bold bg-cyan-500/10 px-1 py-0.5 rounded align-middle">you</span>}
                        </p>
                        <p className="text-[8px] sm:text-[9px] text-slate-500 font-bold mt-0.5 truncate">{e.rank}</p>
                      </div>
                      <div className="hidden sm:block text-right">
                        <p className="text-xs font-black text-cyan-300/60">{e.badges}</p>
                        <p className="text-[8px] text-slate-600 font-bold">badges</p>
                      </div>
                      <div className="text-right shrink-0 tabular-nums">
                        <p className={`text-xs sm:text-base font-black leading-none ${isMe?'text-cyan-400':'text-white'}`}>{(e.totalXP??e.weeklyXP??0).toLocaleString()}</p>
                        <p className="text-[8px] sm:text-[9px] text-cyan-400/50 font-bold mt-0.5">+{e.weeklyXP} wk</p>
                      </div>
                      <div className="hidden sm:flex justify-center">
                        {idx===0?<ChevronUp size={12} className="text-cyan-400"/>:<ChevronDown size={12} className="text-slate-700"/>}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
  );
}
