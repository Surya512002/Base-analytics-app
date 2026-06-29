"use client";

import {
  Activity, ArrowRightLeft, BadgeCheck, BarChart3, BrainCircuit, Calendar,
  ChevronDown, ChevronUp, Clock, Coins, CreditCard,
  Database, DollarSign, Droplets, ExternalLink, FileCode, Flame, Gauge, Gift,
  GitBranch, Globe, History, Landmark, Layers, Lock, MousePointerClick,
  Palette, RefreshCcw, Repeat2, Rocket, Send, Share2, ShieldCheck, Sparkles,
  Star, Sun, Swords, Target, TrendingUp, Trophy, Twitter, User, Users, Wifi,
  Zap,
} from "lucide-react";
import { Transaction, TransactionButton } from "@coinbase/onchainkit/transaction";
import { base } from "viem/chains";
import dynamic from "next/dynamic";
import { ActivityHeatmap } from "@/components/wallet/ActivityHeatmap";
import QuestProgressBanner from "@/components/wallet/QuestProgressBanner";
import PremiumBanner from "@/components/wallet/PremiumBanner";
import PremiumInsightsPanel from "@/components/wallet/PremiumInsightsPanel";
import ReferralPanel from "@/components/wallet/ReferralPanel";
import PaymasterInsightTile from "@/components/wallet/PaymasterInsightTile";
import WatchlistPanel from "@/components/wallet/WatchlistPanel";
import { SCORE_MAX, SCORE_LABELS } from "@/lib/utils/score";
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
import { formatDexVolumeUsd } from "@/lib/utils/swap-volume";
import { ACHIEVEMENTS, SEASON_NAME, WEEKLY_QUESTS } from "@/lib/constants/season";
import { getLevelStyle, getTargetTokenId } from "@/lib/utils/achievements";
import { getDaysLeft, getSeasonPct } from "@/lib/utils/season";
import { getAppContractHit, isPaymasterActivity } from "@/lib/utils/app-contracts";
import {
  patchCheckInInWalletCache,
  writeLocalCheckInToday,
} from "@/lib/utils/check-in-status";
import { txHashFromLifecycle } from "@/lib/utils/tx-status";
import type { WalletAppState } from "@/hooks/useWalletApp";

const FarcasterAnalytics = dynamic(
  () => import("@/components/wallet/FarcasterAnalytics"),
  { loading: () => <div className="h-48 glass-panel rounded-3xl animate-pulse" /> }
);

export default function DashboardTab({ app }: { app: WalletAppState }) {
  const {
    wallet, connType, minting, mintedLevels, setMintedLevels, selDay, setSelDay,
    scrollRef, boosts, setBoosts, sponsored, setSponsored, txKeys, setTxKeys, streak,
    checkedToday, setCheckedToday, setStreak, challenge, setChallenge,
    challengeResult, challengeLoading, weeklyXP,
    x402PayCount, boostCall, gmCall, gnCall, ciCall, txCaps, mintedCount,
    showToast, handleChallenge, doNativeTx, doNativeMint, shareScore, shareAch,
    shareAll, leaderboard, lbLoading, doneQuests,
    premiumUnlocked, premiumLoading, premiumData, premiumInsights, handlePremiumScan,
    x402Product, setX402Product,
  } = app;

if (!wallet) return null;

  return (
          <div className="space-y-4">
            {/* ── Quick onchain actions (top priority) ── */}
            <div className="elegant-panel rounded-3xl overflow-hidden border border-violet-500/20">
              <div className="h-0.5 bg-linear-to-r from-champagne via-violet-500 to-cyan-400" />
              <div className="p-4 sm:p-5 flex flex-wrap items-center justify-between gap-3 border-b border-white/8">
                <div>
                  <p className="text-[10px] font-black text-cyan-400 uppercase tracking-[0.35em]">Onchain Analysis</p>
                  <h2 className="text-lg sm:text-xl font-black text-white mt-1">
                    Your <span className="text-gradient-blue">Base Profile</span>
                  </h2>
                </div>
                <p className="text-xs text-slate-400 max-w-xs leading-relaxed">
                  Check in, boost XP, and say GM — gas sponsored on Base.
                </p>
              </div>

              {/* Daily check-in */}
              <div className={`mx-4 sm:mx-5 mt-4 mb-4 border rounded-2xl overflow-hidden ${checkedToday?'border-cyan-400/35':'border-cyan-500/18'}`}>
                <div className={`h-0.5 ${checkedToday?'bg-linear-to-r from-cyan-400 to-cyan-300':'bg-linear-to-r from-rose-500 to-cyan-500'}`}/>
                <div className="p-4 sm:p-5 flex flex-col sm:flex-row sm:items-center gap-4 justify-between bg-white/[0.02]">
                  <div className="flex items-center gap-4">
                    <div className={`w-12 h-12 rounded-2xl flex items-center justify-center shrink-0 border ${checkedToday?'bg-cyan-400/15 border-cyan-400/30':'bg-cyan-500/12 border-cyan-500/20'}`}>
                      <Flame size={22} className={checkedToday?'text-cyan-300':'text-cyan-400'}/>
                    </div>
                    <div>
                      <p className="font-black text-white text-base">{checkedToday?`Day ${streak} streak 🔥`:'Daily Check-In Available'}</p>
                      <p className={`text-xs mt-0.5 ${checkedToday?'text-cyan-300/60':'text-slate-500'}`}>{checkedToday?'Recorded immutably on Base.':'Sign once · earn XP · unlock multipliers'}</p>
                      <div className="flex items-center gap-1.5 mt-2">
                        {Array.from({length:Math.min(streak,7)}).map((_,i)=>(
                          <div key={i} className="w-5 h-5 rounded-lg flex items-center justify-center text-[10px] bg-cyan-500/15 border border-cyan-500/30">🔥</div>
                        ))}
                        {streak>7&&<span className="text-[10px] text-slate-500 font-bold">+{streak-7}</span>}
                      </div>
                    </div>
                  </div>
                  <div className="flex flex-col items-stretch sm:items-end gap-1 shrink-0">
                    {connType==='farcaster'?(
                      <button onClick={()=>doNativeTx('checkin')} disabled={checkedToday||!!minting}
                        className={`py-3 px-6 rounded-2xl font-black text-sm transition-all ${checkedToday?'bg-cyan-500/10 text-cyan-300 cursor-default border border-cyan-500/18':'btn-primary hover:opacity-90 text-white shadow-lg shadow-cyan-500/20 active:scale-95'}`}>
                        {minting==='checkin'?<RefreshCcw className="animate-spin mx-auto" size={14}/>:checkedToday?'✓ Secured Today':'Check In'}
                      </button>
                    ):checkedToday?(
                      <button disabled className="py-3 px-6 rounded-2xl font-black text-sm bg-cyan-500/10 text-cyan-300 border border-cyan-500/18">✓ Secured Today</button>
                    ):(
                      <Transaction key={`ci-${txKeys.checkin}`} chainId={base.id} calls={ciCall} capabilities={txCaps}
                        onStatus={(s) => {
                          if (
                            s.statusName !== "success" &&
                            s.statusName !== "transactionLegacyExecuted"
                          ) {
                            return;
                          }
                          writeLocalCheckInToday(wallet.address);
                          setCheckedToday(true);
                          setStreak((v) => {
                            const next = v + 1;
                            patchCheckInInWalletCache(wallet.address, true, next);
                            return next;
                          });
                          setSponsored((v) => v + 1);
                          showToast("✅ Onchain check-in secured!", txHashFromLifecycle(s));
                          setTxKeys((k) => ({ ...k, checkin: (k.checkin || 0) + 1 }));
                        }}>
                        <TransactionButton className="py-3 px-6 rounded-2xl font-black text-sm btn-primary hover:opacity-90 text-white transition-all w-full" text="Check In"/>
                      </Transaction>
                    )}
                    <p className="text-[9px] text-slate-500 flex items-center justify-center gap-1 mt-0.5"><Droplets size={8}/>Gas Sponsored</p>
                  </div>
                </div>
              </div>

              {/* Wallet health */}
              <div className="mx-4 sm:mx-5 mb-4 glass-panel-accent rounded-2xl overflow-hidden">
                <div className="p-4 sm:p-5">
                  <div className="flex flex-col sm:flex-row items-start sm:items-center gap-4 justify-between">
                    <div className="flex items-center gap-4">
                      <div className="relative w-16 h-16 shrink-0">
                        <svg width="64" height="64" viewBox="0 0 64 64">
                          <circle cx="32" cy="32" r="26" fill="none" stroke="rgba(0,229,255,0.1)" strokeWidth="6"/>
                          <circle cx="32" cy="32" r="26" fill="none" stroke="#00E5FF" strokeWidth="6" strokeLinecap="round"
                            strokeDasharray={`${2*Math.PI*26}`} strokeDashoffset={`${2*Math.PI*26*(1-wallet.walletHealthScore/100)}`}
                            transform="rotate(-90 32 32)" style={{filter:'drop-shadow(0 0 4px rgba(0,229,255,0.6))',transition:'stroke-dashoffset 1s ease'}}/>
                          <text x="32" y="36" textAnchor="middle" fill="#60a5fa" fontSize="12" fontWeight="800" fontFamily="monospace">{wallet.walletHealthScore}</text>
                        </svg>
                      </div>
                      <div>
                        <div className="flex items-center gap-2 mb-1">
                          <span className="text-xs font-black text-cyan-400/60 uppercase tracking-widest">Wallet Health</span>
                          <span className="text-xs font-black text-white bg-cyan-500/12 border border-cyan-500/20 px-2 py-0.5 rounded-full">{wallet.walletHealthLabel}</span>
                        </div>
                        <p className="text-slate-200/70 text-xs leading-relaxed max-w-sm">{wallet.recommendation}</p>
                      </div>
                    </div>
                    <div className="grid grid-cols-3 gap-2 w-full sm:w-auto">
                      {[{l:'Active Days',v:wallet.uniqueDays,c:'text-cyan-400'},{l:'Months',v:wallet.activeMonths,c:'text-cyan-300'},{l:'Streak',v:`${wallet.currentStreak}d`,c:'text-cyan-400'}].map((s,i)=>(
                        <div key={i} className="bg-white/[0.04] border border-white/10 rounded-xl p-2.5 text-center">
                          <p className={`font-black text-lg ${s.c}`}>{s.v}</p>
                          <p className="text-[9px] text-slate-500 uppercase font-bold mt-0.5">{s.l}</p>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              </div>

              {/* XP Booster + Community Vibes */}
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-3 sm:gap-4 px-4 sm:px-5 pb-5">
                <div className="glass-panel-accent rounded-2xl p-5 flex flex-col sm:flex-row items-center gap-4 justify-between card-tilt-3d">
                  <div className="flex items-center gap-3 w-full sm:w-auto">
                    <div className="w-12 h-12 bg-cyan-500/12 rounded-2xl border border-cyan-500/18 flex items-center justify-center shrink-0"><Rocket size={22} className="text-cyan-400"/></div>
                    <div>
                      <p className="font-black text-white text-base">XP Booster</p>
                      <div className="flex gap-2 mt-1.5">
                        <span className="bg-white/5 border border-white/10 rounded-lg px-2.5 py-1 text-xs"><span className="text-cyan-400 font-black">{boosts}</span><span className="text-slate-500 ml-1">boosts</span></span>
                        <span className="bg-white/5 border border-white/10 rounded-lg px-2.5 py-1 text-xs"><span className="text-cyan-300 font-black">{streak}d</span><span className="text-slate-500 ml-1">streak</span></span>
                      </div>
                    </div>
                  </div>
                  <div className="w-full sm:w-auto text-center">
                    {connType==='farcaster'?(
                      <button onClick={()=>doNativeTx('boost')} disabled={!!minting}
                        className={`w-full py-3 px-5 rounded-xl font-black text-sm transition-all active:scale-95 ${minting?'bg-white/10/40 text-slate-500 cursor-not-allowed':'btn-primary hover:opacity-90 text-white shadow-xl shadow-cyan-500/20'}`}>
                        {minting==='boost'?<RefreshCcw className="animate-spin mx-auto" size={18}/>:'BOOST (+1)'}
                      </button>
                    ):(
                      <Transaction key={`boost-${txKeys.boost}`} chainId={base.id} calls={boostCall} capabilities={txCaps}
                        onStatus={s=>{if(s.statusName==='success'){setBoosts(b=>{const n=b+1;if(typeof window!=='undefined')localStorage.setItem(`base_boosts_${wallet.address.toLowerCase()}`,n.toString());return n;});setSponsored(v=>v+1);showToast('Boosted! 🎉',s.statusData.transactionReceipts?.[0]?.transactionHash||'');setTxKeys(k=>({...k,boost:(k.boost||0)+1}));}}}>
                        <TransactionButton className="w-full py-3 px-5 rounded-xl font-black text-sm btn-primary hover:opacity-90 text-white shadow-xl shadow-cyan-500/20 transition-all" text="BOOST (+1)"/>
                      </Transaction>
                    )}
                    <p className="text-[9px] text-slate-500 mt-1.5 flex items-center justify-center gap-1"><Droplets size={8}/>Gas Sponsored</p>
                  </div>
                </div>

                <div className="glass-panel-accent rounded-2xl p-5 card-tilt-3d">
                  <p className="font-black text-white mb-4 flex items-center gap-2"><Star size={15} className="text-cyan-400"/>Community Vibes</p>
                  <div className="grid grid-cols-2 gap-3">
                    {(['gm','gn'] as const).map(type=>(
                      <div key={type} className="text-center">
                        {connType==='farcaster'?(
                          <button onClick={()=>doNativeTx(type)} disabled={!!minting}
                            className={`w-full py-4 rounded-xl font-black text-xl transition-all active:scale-95 border ${minting?'opacity-40 cursor-not-allowed bg-white/[0.04] border-white/8 text-slate-600':'bg-white/[0.04] hover:bg-cyan-500/12 border-white/8 hover:border-cyan-500/28 text-white'}`}>
                            {minting===type?<RefreshCcw className="animate-spin mx-auto" size={18}/>:(type==='gm'?'☀️ GM':'🌙 GN')}
                          </button>
                        ):(
                          <Transaction key={`${type}-${txKeys[type]}`} chainId={base.id} calls={type==='gm'?gmCall:gnCall} capabilities={txCaps}
                            onStatus={s=>{if(s.statusName==='success'){showToast(type==='gm'?'GM! ☀️':'GN! 🌙',s.statusData.transactionReceipts?.[0]?.transactionHash||'');setSponsored(v=>v+1);if(type==='gm'&&typeof window!=='undefined')localStorage.setItem(`base_gm_${wallet.address.toLowerCase()}`,'true');setTxKeys(k=>({...k,[type]:(k[type]||0)+1}));}}}>
                            <TransactionButton className="w-full py-4 rounded-xl font-black text-xl bg-white/[0.04] hover:bg-cyan-500/12 border border-white/8 hover:border-cyan-500/28 text-white transition-all" text={type==='gm'?'☀️ GM':'🌙 GN'}/>
                          </Transaction>
                        )}
                        <p className="text-[9px] text-slate-500 mt-1.5 flex items-center justify-center gap-1"><Droplets size={8}/>Gas Sponsored</p>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </div>

            <QuestProgressBanner doneQuests={doneQuests} onGoQuests={() => app.setTab("quests")} />

            <PremiumBanner
              premiumLoading={premiumLoading}
              premiumData={premiumData}
              x402PayCount={x402PayCount}
              product={x402Product}
              onProductChange={setX402Product}
              onPay={handlePremiumScan}
            />

            {premiumUnlocked && (
              <PremiumInsightsPanel insights={premiumInsights} unlocked={premiumUnlocked} />
            )}

            <PaymasterInsightTile wallet={wallet} />

            <div className="glass-panel rounded-3xl overflow-hidden shadow-xl shadow-black/25">
              <div className="h-0.5 bg-linear-to-r from-rose-500 via-cyan-400 to-blue-600"/>
              <div className="p-5 sm:p-6">
                <div className="flex flex-col lg:flex-row lg:items-start lg:justify-between gap-5 mb-6">
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2 mb-3">
                      <span className="text-[10px] font-black text-cyan-400/60 uppercase tracking-widest">Onchain Score</span>
                      <div className="flex gap-1">
                        {([['w','Cast'],['t','Post'],['n','Share']] as const).map(([pl,lbl])=>(
                          <button key={pl} onClick={()=>shareScore(pl)} className="bg-white/5 hover:bg-white/8 border border-white/10 text-cyan-400/60 px-2 py-1 rounded-lg text-[10px] font-bold flex items-center gap-1 transition-all">
                            {pl==='w'?<Send size={9}/>:pl==='t'?<Twitter size={9}/>:<Share2 size={9}/>}{lbl}
                          </button>
                        ))}
                      </div>
                    </div>
                    <div className="flex items-baseline gap-1">
                      <span className="text-7xl sm:text-8xl font-black text-white tracking-tighter leading-none">{wallet.score}</span>
                      <span className="text-2xl text-slate-600 font-black">/100</span>
                    </div>
                    <p className="text-cyan-400 font-black text-base mt-2">{wallet.walletRank}</p>
                    <div className="mt-3 grid grid-cols-1 sm:grid-cols-2 gap-x-5 sm:gap-x-6 gap-y-1 max-w-lg">
                      {Object.entries(wallet.scoreComponents).map(([k,v],i)=>{
                        const key = k as keyof typeof SCORE_MAX;
                        const pct = Math.round((v / (SCORE_MAX[key] || 1)) * 100);
                        return(
                          <div key={i} className="flex items-center gap-2 min-w-0">
                            <span className="text-[10px] text-slate-400 w-16 sm:w-[4.25rem] font-bold shrink-0">{SCORE_LABELS[key]||k}</span>
                            <div className="flex-1 min-w-0 bg-white/5 rounded-full h-1.5 overflow-hidden border border-white/8">
                              <div className="h-full bg-linear-to-r from-rose-500 to-cyan-400 rounded-full" style={{width:`${pct}%`,transition:'width 1.5s ease-out'}}/>
                            </div>
                            <span className="text-[10px] text-cyan-400/70 w-5 text-right shrink-0 font-bold tabular-nums">{Math.round(v)}</span>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                  <div className="shrink-0">
                    {selDay?(
                      <div className="bg-white/[0.04] border border-white/10 rounded-2xl px-5 py-4 text-center">
                        <p className="text-[10px] text-cyan-400/50 font-bold uppercase tracking-wide">{selDay.date}</p>
                        <p className="text-3xl font-black text-cyan-400 mt-1">{selDay.count}</p>
                        <p className="text-[10px] text-slate-500 font-bold">transactions</p>
                      </div>
                    ):(
                      <div className="flex items-center gap-2 opacity-30">
                        <MousePointerClick size={14} className="text-cyan-400"/>
                        <span className="text-[10px] text-cyan-400/50 uppercase font-bold">Click a cell</span>
                      </div>
                    )}
                  </div>
                </div>
                <ActivityHeatmap
                  dailyStats={wallet.dailyStats}
                  selectedDay={selDay}
                  onSelectDay={setSelDay}
                  scrollRef={scrollRef}
                />
              </div>
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 sm:gap-3">
              {[
                {label:'Age Percentile',value:`Top ${100-wallet.onchainAgePercentile}%`,sub:`vs Base median`,icon:<GitBranch size={16} className="text-cyan-400"/>,active:true},
                {label:'Total Txs',value:wallet.txCount.toLocaleString(),sub:`Lifetime interactions`,icon:<Layers size={16} className="text-cyan-300"/>,active:true},
                {label:'Bridge Txs',value:wallet.bridgeTxCount.toString(),sub:'L1 ↔ Base bridge',icon:<Globe size={16} className="text-cyan-400"/>,active:wallet.bridgeTxCount>0},
                {label:'Net ETH Flow',value:`${wallet.netETHFlow>=0?'+':''}${wallet.netETHFlow} Ξ`,sub:wallet.netETHFlow>=0?'Net receiver':'Net sender',icon:<TrendingUp size={16} className={wallet.netETHFlow>=0?'text-green-400':'text-red-400'}/>,active:true},
              ].map((s,i)=>(
                <div key={i} className={`bg-white/[0.04] border rounded-2xl p-4 shadow-sm ${s.active?'border-cyan-500/20':'border-cyan-500/12'}`}>
                  <div className="mb-2">{s.icon}</div>
                  <p className={`font-black text-lg leading-tight ${s.active?'text-white':'text-slate-600'}`}>{s.value}</p>
                  <p className="text-[9px] text-slate-500 uppercase font-bold tracking-wide mt-0.5">{s.label}</p>
                  <p className="text-[9px] text-slate-600 mt-0.5">{s.sub}</p>
                </div>
              ))}
            </div>

            <div>
              <p className="text-[10px] font-black text-slate-500 uppercase tracking-widest mb-3 flex items-center gap-2"><BarChart3 size={12}/>Wallet Intelligence</p>
              <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 xl:grid-cols-5 gap-2 sm:gap-3">
                <div className="glass-panel-accent rounded-2xl p-4 col-span-2 flex items-center gap-3 overflow-hidden shadow-lg shadow-black/25">
                  <div className="w-12 h-12 bg-cyan-500/15 border border-cyan-500/30 rounded-2xl flex items-center justify-center shrink-0"><User size={22} className="text-cyan-400"/></div>
                  <div className="min-w-0">
                    <p className="font-black text-white text-base sm:text-lg truncate">{wallet.basename||`${wallet.address.slice(0,8)}...${wallet.address.slice(-4)}`}</p>
                    <p className="text-[10px] text-cyan-400/50 uppercase font-bold truncate mt-0.5">{wallet.walletRank}</p>
                    {wallet.basename&&<span className="inline-flex items-center gap-1 text-[9px] font-black text-cyan-300 bg-cyan-500/10 border border-cyan-500/18 px-2 py-0.5 rounded-full mt-1.5"><BadgeCheck size={9}/>Verified Basename</span>}
                  </div>
                </div>
                <div className="bg-linear-to-br from-rose-500/20 to-[#071220]/10 border border-cyan-500/30 rounded-2xl p-3 sm:p-4 col-span-2 sm:col-span-1 shadow-lg shadow-black/25">
                  <div className="mb-2"><DollarSign size={15} className="text-cyan-400"/></div>
                  <p className="font-black text-white text-lg sm:text-xl">${wallet.portfolioValueUSD.toLocaleString('en-US',{maximumFractionDigits:0})}</p>
                  <p className="text-[9px] text-cyan-400/50 uppercase font-bold tracking-wide mt-0.5">Portfolio Value</p>
                </div>

                {([
                  {l:'x402 Payments', v: x402PayCount.toString(), i:<Zap size={15} className="text-yellow-400"/>},
                  {l:'ETH Balance',      v:`${wallet.balance} Ξ`,                        i:<CreditCard size={15} className="text-cyan-400"/>},
                  {l:'Days on Base',     v:wallet.daysOnBase.toLocaleString(),            i:<Calendar size={15} className="text-cyan-300"/>},
                  {l:'Active Days ✅',   v:wallet.uniqueDays.toString(),                  i:<Sun size={15} className="text-cyan-400"/>},
                  {l:'Active Weeks ✅',  v:wallet.activeWeeks.toString(),                 i:<Calendar size={15} className="text-cyan-300"/>},
                  {l:'Active Months ✅', v:wallet.activeMonths.toString(),                i:<Calendar size={15} className="text-cyan-400"/>},
                  {l:'Current Streak ✅',v:`${wallet.currentStreak}d`,                    i:<Flame size={15} className="text-cyan-300"/>},
                  {l:'Longest Streak ✅',v:`${wallet.longestStreak}d`,                    i:<Trophy size={15} className="text-cyan-400"/>},
                  {l:'Longest Gap',      v:`${wallet.longestInactiveDays}d`,              i:<Clock size={15} className="text-cyan-300"/>},
                  {l:'Peak Day Txs',     v:wallet.peakDayTxCount.toString(),              i:<Gauge size={15} className="text-cyan-400"/>},
                  {l:'Peak Active Day',  v:wallet.peakDayDate,                            i:<Star size={15} className="text-cyan-300"/>},
                  {l:'Total Txs',        v:wallet.txCount.toLocaleString(),               i:<Layers size={15} className="text-cyan-300"/>},
                  {l:'Avg Tx / Day',     v:wallet.avgTxPerDay.toString(),                 i:<BarChart3 size={15} className="text-cyan-400"/>},
                  {l:'Avg Tx / Week',    v:wallet.weeklyTxAvg.toString(),                 i:<Activity size={15} className="text-cyan-300"/>},
                  {l:'Avg Tx Value',     v:`${wallet.avgTxValueETH} Ξ`,                   i:<Coins size={15} className="text-cyan-400"/>},
                  {l:'Contract Txs',     v:wallet.contractInteractions.toLocaleString(),  i:<FileCode size={15} className="text-cyan-300"/>},
                  {l:'Unique Contracts', v:wallet.uniqueContracts.toLocaleString(),       i:<Database size={15} className="text-cyan-400"/>},
                  {l:'ERC-20 Txs',       v:wallet.erc20Txs.toLocaleString(),              i:<Coins size={15} className="text-cyan-300"/>},
                  {l:'NFT Txs',          v:wallet.erc721Txs.toLocaleString(),             i:<Palette size={15} className="text-cyan-400"/>},
                  {l:'ETH Sent',         v:`${wallet.ethVolume} Ξ`,                       i:<ArrowRightLeft size={15} className="text-cyan-300"/>},
                  {l:'ETH Received',     v:`${wallet.ethReceived} Ξ`,                     i:<Gift size={15} className="text-cyan-400"/>},
                  {l:'Net ETH Flow',     v:`${wallet.netETHFlow>=0?'+':''}${wallet.netETHFlow} Ξ`,i:<TrendingUp size={15} className={wallet.netETHFlow>=0?'text-green-400':'text-red-400'}/>},
                  {l:'Swap Volume',      v:formatDexVolumeUsd(wallet.dexVolumeUSD),       i:<TrendingUp size={15} className="text-cyan-300"/>},
                  {l:'Swap Count',       v:wallet.dexTradeCount.toLocaleString(),         i:<Repeat2 size={15} className="text-cyan-400"/>},
                  {l:'Token Swaps',      v:wallet.swapCount.toLocaleString(),             i:<ArrowRightLeft size={15} className="text-cyan-300"/>},
                  {l:'Unique Tokens',    v:wallet.tokensSwapped.toString(),               i:<Coins size={15} className="text-cyan-300"/>},
                  {l:'DeFi Interactions',v:wallet.defiInteractions.toLocaleString(),      i:<TrendingUp size={15} className="text-cyan-400"/>},
                  {l:'Unique Protocols', v:wallet.uniqueProtocols.toString(),             i:<Landmark size={15} className="text-cyan-300"/>},
                  {l:'Fav Protocol',     v:wallet.mostUsedProtocol,                       i:<Star size={15} className="text-cyan-400"/>},
                  {l:'Bridge Txs',       v:wallet.bridgeTxCount.toString(),               i:<Globe size={15} className="text-cyan-300"/>},
                  {l:'NFTs Held',        v:wallet.nftCount.toLocaleString(),              i:<Sparkles size={15} className="text-cyan-400"/>},
                  {l:'Most Active Month',v:wallet.mostActiveMonth,                        i:<Clock size={15} className="text-cyan-300"/>},
                  {l:'First Transaction',v:wallet.firstTx,                                i:<Star size={15} className="text-cyan-400"/>},
                  {l:'Last Transaction', v:wallet.lastTx,                                 i:<Clock size={15} className="text-cyan-300"/>},
                  {l:'Onchain Streak',   v:`${streak}d`,                                  i:<Zap size={15} className="text-cyan-400"/>},
                  {l:'Check-In Count',   v:wallet.checkInCount.toLocaleString(),          i:<Flame size={15} className="text-orange-400"/>},
                  {l:'GM / GN Count',    v:wallet.gmCount.toLocaleString(),               i:<Star size={15} className="text-yellow-400"/>},
                  {l:'XP Boosts',        v:boosts.toString(),                             i:<Rocket size={15} className="text-cyan-300"/>},
                  {l:'Minted Badges',    v:mintedCount.toString(),                        i:<Trophy size={15} className="text-cyan-400"/>},
                  {l:'Weekly XP',        v:weeklyXP.toString(),                           i:<Zap size={15} className="text-cyan-300"/>},
                  {l:'Activity Score',   v:`${wallet.activityScore}/100`,                 i:<Activity size={15} className="text-cyan-400"/>},
                  {l:'Wallet Health',    v:`${wallet.walletHealthScore}/100`,             i:<ShieldCheck size={15} className="text-cyan-300"/>},
                ] as {l:string;v:string|number;i:React.ReactNode}[]).map((s,i)=>(
                  <div key={i} className="glass-panel-accent rounded-2xl p-3 sm:p-4 hover:border-cyan-500/30 transition-all group shadow-sm shadow-black/20">
                    <div className="mb-2 group-hover:scale-110 transition-transform w-fit">{s.i}</div>
                    <p className="font-black text-white text-sm sm:text-base truncate leading-tight">{s.v}</p>
                    <p className="text-[9px] text-slate-500 uppercase font-bold tracking-wide mt-0.5 truncate">{s.l}</p>
                  </div>
                ))}
              </div>
            </div>

            <WatchlistPanel myAddress={wallet.address} />

            <div className="glass-panel-accent rounded-2xl p-5 shadow-lg shadow-black/25">
              <div className="flex items-center gap-2 mb-3"><Swords size={18} className="text-cyan-400"/><span className="font-black text-white">Wallet Challenge</span></div>
              <p className="text-xs text-cyan-300/50 mb-4">Enter any wallet to compare real onchain scores.</p>
              <div className="flex gap-2 mb-3">
                <input value={challenge} onChange={e=>setChallenge(e.target.value)} onKeyDown={e=>e.key==='Enter'&&handleChallenge()}
                  placeholder="0x..." className="flex-1 min-w-0 bg-white/[0.04] border border-white/10 rounded-xl px-3 py-2.5 text-xs font-mono text-white placeholder-slate-600 outline-none focus:border-cyan-500/50 transition-all"/>
                <button onClick={handleChallenge} disabled={challengeLoading}
                  className="shrink-0 btn-primary hover:opacity-90 disabled:bg-white/10 text-white px-5 py-2.5 rounded-xl font-black text-xs transition-all active:scale-95 flex items-center gap-1">
                  {challengeLoading?<RefreshCcw size={12} className="animate-spin"/>:'Go'}
                </button>
              </div>
              {challengeResult&&(
                <div className="grid grid-cols-2 gap-2">
                  <div className={`rounded-xl p-3 text-center border ${wallet.score>=challengeResult.score?'bg-cyan-500/10 border-cyan-500/20':'bg-white/[0.04] border-white/8'}`}>
                    <p className="text-[10px] text-cyan-400/50 uppercase font-bold">You</p>
                    <p className="text-3xl font-black text-cyan-400 my-1">{wallet.score}</p>
                    <p className="text-[9px] text-cyan-300/50">{wallet.uniqueDays} days</p>
                    {wallet.score>challengeResult.score&&<p className="text-[10px] font-black text-cyan-300 mt-1">WINNER 🏆</p>}
                  </div>
                  <div className={`rounded-xl p-3 text-center border ${challengeResult.score>wallet.score?'bg-white/530 border-cyan-500/25':'bg-white/[0.04] border-white/8'}`}>
                    <p className="text-[10px] text-cyan-400/50 uppercase font-bold">{challengeResult.address.slice(0,6)}...</p>
                    <p className="text-3xl font-black text-cyan-200 my-1">{challengeResult.score}</p>
                    <p className="text-[9px] text-cyan-300/50">{challengeResult.days} days</p>
                    {challengeResult.score>wallet.score&&<p className="text-[10px] font-black text-cyan-300 mt-1">WINNER 🏆</p>}
                  </div>
                </div>
              )}
            </div>

            <ReferralPanel address={wallet.address} />

            <FarcasterAnalytics />

            <div>
              <p className="text-[10px] font-black text-slate-500 uppercase tracking-widest mb-3 flex items-center gap-2"><History size={12}/>Recent Activity</p>
              <div className="glass-panel-accent rounded-2xl overflow-hidden shadow-lg shadow-black/25">
                {wallet.recentTxs.length>0?wallet.recentTxs.map((tx,i)=>{
                  const toAddr=(tx.to||'').toLowerCase();
                  const wAddr=wallet.address.toLowerCase();
                  const appHit=getAppContractHit(tx,wAddr);
                  const isGM=appHit==='gm';
                  const isBoost=appHit==='booster';
                  const isCI=appHit==='checkin';
                  const isBadge=appHit==='achievements';
                  const isDEX=DEX_ROUTERS.has(toAddr);
                  const isBridge=toAddr===BASE_BRIDGE.toLowerCase();
                  const isPaymaster=isPaymasterActivity(tx,wAddr)||toAddr===ENTRYPOINT_V06.toLowerCase()||toAddr===ENTRYPOINT_V07.toLowerCase();
                  let label='Contract Call',badge:string|null=null;
                  let icon=<ArrowRightLeft size={13} className="text-cyan-400"/>;
                  if(isGM){label='GM / GN';icon=<Star size={13} className="text-yellow-400"/>;badge='☀️ Vibes';}
                  else if(isBoost){label='XP Boost';icon=<Rocket size={13} className="text-cyan-300"/>;badge='🚀 Boost';}
                  else if(isCI){label='Check-In';icon=<Flame size={13} className="text-orange-400"/>;badge='🔥 Streak';}
                  else if(isBadge){label='Badge Mint';icon=<Trophy size={13} className="text-yellow-300"/>;badge='🏅 Badge';}
                  else if(isDEX){label='DEX Swap';icon=<Repeat2 size={13} className="text-cyan-400"/>;badge='🔄 Swap';}
                  else if(isBridge){label='Bridge Tx';icon=<Globe size={13} className="text-cyan-300"/>;badge='🌉 Bridge';}
                  else if(isPaymaster){label=tx.category==='useroperation'?'Base App Tx':'Gasless Tx';icon=<Droplets size={13} className="text-cyan-400"/>;badge='⛽ Sponsored';}
                  else if(tx.category==='erc721'){label='NFT Transfer';icon=<Sparkles size={13} className="text-cyan-300"/>;}
                  else if(tx.category==='erc20'){label='Token Transfer';icon=<Coins size={13} className="text-cyan-400"/>;}
                  else if(tx.category==='internal'){label='Internal Tx';icon=<Zap size={13} className="text-cyan-300"/>;}
                  return(
                    <div key={i} className={`flex items-center justify-between p-3 sm:p-4 gap-3 hover:bg-white/[0.03] transition-colors ${i!==wallet.recentTxs.length-1?'border-b border-white/8':''}`}>
                      <div className="flex items-center gap-3 min-w-0">
                        <div className={`w-8 h-8 border rounded-xl flex items-center justify-center shrink-0 ${isGM?'bg-yellow-500/10 border-yellow-500/20':isBoost?'bg-cyan-500/15 border-cyan-500/20':isCI?'bg-orange-500/10 border-orange-500/20':isBadge?'bg-yellow-500/10 border-yellow-500/20':isDEX?'bg-cyan-500/10 border-cyan-500/18':isBridge?'bg-purple-500/10 border-purple-500/20':'bg-cyan-500/10 border-cyan-500/15'}`}>{icon}</div>
                        <div className="min-w-0">
                          <div className="flex items-center gap-1.5">
                            <p className="text-xs font-black text-white uppercase truncate">{label}</p>
                            {badge&&<span className="text-[9px] bg-cyan-500/10 border border-cyan-500/18 text-cyan-300 px-1.5 py-0.5 rounded-full font-bold shrink-0">{badge}</span>}
                          </div>
                          <p className="text-[10px] text-slate-500 truncate">{new Date(tx.metadata.blockTimestamp).toLocaleString()}</p>
                          {tx.to&&<p className="text-[9px] text-slate-700 font-mono truncate">{tx.to.slice(0,10)}…</p>}
                        </div>
                      </div>
                      <a href={`https://basescan.org/tx/${tx.hash}`} target="_blank" rel="noreferrer"
                        className="shrink-0 text-[10px] font-black text-cyan-400 hover:text-cyan-300 bg-cyan-500/8 hover:bg-cyan-500/12 border border-cyan-500/18 px-3 py-1.5 rounded-xl flex items-center gap-1 transition-all whitespace-nowrap">
                        <ExternalLink size={9}/>{tx.value&&tx.value>0?`${parseFloat(tx.value.toFixed(4))} ${tx.asset||'ETH'}`:'View ↗'}
                      </a>
                    </div>
                  );
                }):<p className="text-slate-600 text-sm text-center py-8">No recent transactions found.</p>}
              </div>
            </div>
          </div>
  );
}
