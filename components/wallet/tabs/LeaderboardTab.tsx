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
            <div className="bg-[#0d1628] border border-blue-500/20 rounded-3xl overflow-hidden shadow-xl shadow-blue-900/20">
              <div className="h-0.5 bg-linear-to-r from-blue-600 via-blue-400 to-blue-600"/>
              <div className="p-5">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <p className="text-[10px] font-black text-blue-400/50 uppercase tracking-widest flex items-center gap-2 mb-1"><Users size={11}/>GLOBAL LEADERBOARD</p>
                    <p className="text-2xl font-black text-white">{leaderboard.length.toLocaleString()}</p>
                    <p className="text-[11px] text-blue-400/40 mt-0.5">Genesis Season Participants</p>
                  </div>
                  <div className="flex flex-col items-end gap-2">
                    <span className="flex items-center gap-1.5 text-[10px] font-bold text-blue-300 bg-blue-500/10 border border-blue-500/20 px-3 py-1.5 rounded-xl"><Wifi size={9}/>Live · Redis backed</span>
                    <span className="text-[10px] text-blue-400/40 bg-blue-950/40 border border-blue-800/20 px-3 py-1.5 rounded-xl">{getDaysLeft()}d left</span>
                  </div>
                </div>
              </div>
            </div>

            {(()=>{
              const pos=leaderboard.findIndex(e=>e.address.toLowerCase()===wallet.address.toLowerCase());
              return pos>=0?(
                <div className="bg-[#0d1628] border border-blue-500/25 rounded-3xl overflow-hidden shadow-xl shadow-blue-900/20">
                  <div className="h-0.5 bg-linear-to-r from-blue-600 to-blue-400"/>
                  <div className="p-5">
                    <div className="flex items-start justify-between gap-3">
                      <div className="flex items-center gap-3">
                        <div className="w-12 h-12 bg-blue-600/20 border border-blue-500/30 rounded-2xl flex items-center justify-center font-black text-blue-400 text-lg shrink-0">#{pos+1}</div>
                        <div>
                          <p className="font-black text-white text-base">{wallet.basename||`${wallet.address.slice(0,6)}...${wallet.address.slice(-4)}`}</p>
                          <span className="text-[10px] font-black text-blue-300 bg-blue-500/10 border border-blue-500/15 px-2 py-0.5 rounded-lg">{wallet.walletRank}</span>
                        </div>
                      </div>
                      <div className="text-right">
                        <p className="text-[10px] font-black text-blue-400/50 uppercase tracking-widest mb-1">TOTAL SEASON XP</p>
                        <p className="text-4xl font-black text-white">{(leaderboard[pos]?.totalXP??weeklyXP).toLocaleString()}</p>
                        <p className="text-[11px] text-blue-400 font-bold mt-1">+{weeklyXP} XP this week</p>
                      </div>
                    </div>
                    <div className="grid grid-cols-3 gap-2 mt-4">
                      {[
                        {l:'Score',v:wallet.score+'/100',c:'text-blue-400'},
                        {l:'Badges',v:String(mintedCount),c:'text-blue-300'},
                        {l:'Streak',v:streak+'d',c:'text-blue-400'},
                      ].map((s,i)=>(
                        <div key={i} className="bg-blue-950/40 border border-blue-800/20 rounded-xl p-2.5 text-center">
                          <p className={`font-black text-base ${s.c}`}>{s.v}</p>
                          <p className="text-[9px] text-blue-400/40 uppercase font-bold mt-0.5">{s.l}</p>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              ):null;
            })()}

            {lbLoading?(
              <div className="bg-[#0d1628] border border-blue-500/15 rounded-3xl p-12 text-center">
                <RefreshCcw className="animate-spin text-blue-500 mx-auto mb-3" size={24}/>
                <p className="text-blue-400/50 font-bold text-sm">Loading...</p>
              </div>
            ):leaderboard.length===0?(
              <div className="bg-[#0d1628] border-2 border-dashed border-blue-800/30 rounded-3xl p-12 text-center">
                <Users size={28} className="text-blue-800 mx-auto mb-3"/>
                <p className="font-black text-blue-700 mb-1">No entries yet</p>
                <p className="text-xs text-blue-800">Be the first! Connect your wallet and earn XP.</p>
              </div>
            ):(
              <div className="bg-[#0d1628] border border-blue-500/15 rounded-3xl overflow-hidden shadow-lg shadow-blue-900/20">
                <div className="px-4 py-3 border-b border-blue-800/20 bg-blue-950/20">
                  <div className="grid grid-cols-[auto_1fr_auto_auto_auto] text-[9px] font-black text-blue-400/40 uppercase tracking-widest">
                    <span className="w-10">Rank</span>
                    <span>Wallet</span>
                    <span className="hidden sm:block w-16 text-right">Badges</span>
                    <span className="w-24 text-right">Season XP</span>
                    <span className="hidden sm:block w-8"/>
                  </div>
                </div>
                {leaderboard.map((e,idx)=>{
                  const isMe=e.address.toLowerCase()===wallet.address.toLowerCase();
                  const medal=idx===0?'🥇':idx===1?'🥈':idx===2?'🥉':null;
                  return(
                    <div key={e.address} className={`grid grid-cols-[auto_1fr_auto_auto_auto] items-center px-4 py-3.5 border-b border-blue-800/10 last:border-0 transition-all ${isMe?'bg-blue-600/8 border-l-2 border-l-blue-500':'hover:bg-blue-950/20'}`}>
                      <div className="w-10">
                        {medal
                          ?<span className="text-lg">{medal}</span>
                          :<span className={`text-xs font-black ${idx<10?'text-blue-300/60':'text-blue-700'}`}>#{idx+1}</span>}
                      </div>
                      <div className="min-w-0 pr-3">
                        <p className={`font-black text-sm truncate ${isMe?'text-blue-400':'text-white'}`}>
                          {e.basename||`${e.address.slice(0,8)}...${e.address.slice(-4)}`}
                          {isMe&&<span className="text-[9px] text-blue-500/60 ml-2 font-bold bg-blue-500/10 px-1.5 py-0.5 rounded">you</span>}
                        </p>
                        <p className="text-[9px] text-blue-400/40 font-bold mt-0.5">{e.rank}</p>
                      </div>
                      <div className="hidden sm:block w-16 text-right">
                        <p className="text-xs font-black text-blue-300/60">{e.badges}</p>
                        <p className="text-[8px] text-blue-700 font-bold">badges</p>
                      </div>
                      <div className="w-24 text-right">
                        <p className={`text-base font-black ${isMe?'text-blue-400':'text-white'}`}>{(e.totalXP??e.weeklyXP??0).toLocaleString()}</p>
                        <p className="text-[9px] text-blue-400/50 font-bold">+{e.weeklyXP} wk</p>
                      </div>
                      <div className="hidden sm:flex w-8 justify-center">
                        {idx===0?<ChevronUp size={12} className="text-blue-400"/>:<ChevronDown size={12} className="text-blue-800"/>}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
  );
}
