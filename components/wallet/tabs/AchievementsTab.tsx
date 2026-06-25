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

export default function AchievementsTab({ app }: { app: WalletAppState }) {
  const {
    wallet, connType, minting, mintedLevels, setMintedLevels, selDay, setSelDay,
    scrollRef, boosts, sponsored, setSponsored, txKeys, setTxKeys, streak,
    checkedToday, setCheckedToday, setStreak, challenge, setChallenge,
    challengeResult, challengeLoading, refCopied, setRefCopied, weeklyXP,
    x402PayCount, boostCall, gmCall, gnCall, ciCall, txCaps, mintedCount, ref,
    showToast, handleChallenge, doNativeTx, doNativeMint, shareScore, shareAch,
    shareAll, leaderboard, lbLoading, doneQuests,
  } = app;

const getCatValue = (id: string, wallet: NonNullable<WalletAppState["wallet"]>, boosts: number) => {
  const m: Record<string, number> = {
    score: wallet.score, age: wallet.daysOnBase, name: wallet.basename ? 1 : 0,
    days: wallet.uniqueDays, contract: wallet.contractInteractions,
    volume: parseFloat(wallet.ethVolume), txs: wallet.txCount, swaps: wallet.swapCount,
    nfts: wallet.nftCount, streak: wallet.longestStreak, boosts,
  };
  return m[id] ?? 0;
};


if (!wallet) return null;

  return (
          <div>
            <div className="flex items-center justify-between mb-4">
              <p className="text-[10px] font-black text-blue-400/40 uppercase tracking-widest flex items-center gap-2"><Trophy size={12}/>Mint Your Identity</p>
              {mintedCount>0&&<div className="flex gap-1.5">
                <button onClick={()=>shareAll(mintedCount,'w')} className="bg-[#0d1628] border border-blue-500/20 hover:bg-blue-600/15 text-blue-400/60 p-2 rounded-xl transition-all"><Send size={13}/></button>
                <button onClick={()=>shareAll(mintedCount,'t')} className="bg-[#0d1628] border border-blue-500/20 hover:bg-blue-600/15 text-blue-400/60 p-2 rounded-xl transition-all"><Twitter size={13}/></button>
              </div>}
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-3 sm:gap-4">
              {ACHIEVEMENTS.map(cat=>{
                const value=getCatValue(cat.id, wallet, boosts);
                let unlocked=0;
                for(let i=0;i<cat.thresholds.length;i++){if(value>=cat.thresholds[i])unlocked=i+1;}
                const mintedTier=mintedLevels[cat.id]||0;
                const canMint=unlocked>mintedTier;
                const nextThr=unlocked<cat.thresholds.length?cat.thresholds[unlocked]:cat.thresholds[cat.thresholds.length-1];
                const prog=unlocked===cat.thresholds.length?100:Math.min(100,(value/nextThr)*100);
                const toMint:number[]=[],toLevels:number[]=[];
                for(let i=mintedTier+1;i<=unlocked;i++){toLevels.push(i);toMint.push(getTargetTokenId(cat.baseId,cat.thresholds.length,i));}
                const isBatch=toMint.length>1;
                let mintCall2:{to:`0x${string}`;data:`0x${string}`}[]=[];
                if(toMint.length>0){
                  const raw=isBatch
                    ?encodeFunctionData({abi:ACHIEVEMENTS_ABI,functionName:'mintBatchAchievements',args:[toMint.map(id=>BigInt(id))]})
                    :encodeFunctionData({abi:ACHIEVEMENTS_ABI,functionName:'mintAchievement',args:[BigInt(toMint[0])]});
                  mintCall2=[{to:ACHIEVEMENTS_CONTRACT as `0x${string}`,data:`${raw}${getBuilderSuffix()}` as `0x${string}`}];
                }
                let btnText=`${cat.tierNames[mintedTier]||'...'} Locked`;
                if(mintedTier===cat.thresholds.length)btnText='Fully Minted 👑';
                else if(canMint)btnText=isBatch?`Claim ${toMint.length} Badges 🚀`:`Mint ${cat.tierNames[mintedTier]}`;
                return(
                  <div key={cat.id} className="bg-[#0d1628] border border-blue-500/15 rounded-3xl p-5 flex flex-col hover:border-blue-500/30 transition-all shadow-lg shadow-blue-900/10">
                    <div className="flex justify-between items-start mb-4">
                      <div className="flex items-center gap-3">
                        <div className="w-11 h-11 bg-blue-950/60 border border-blue-800/30 rounded-2xl flex items-center justify-center text-2xl">{cat.icon}</div>
                        <div>
                          <p className="font-black text-white text-sm">{cat.name}</p>
                          <p className="text-[10px] text-blue-400/40 uppercase font-bold mt-0.5">{unlocked>0?cat.tierNames[unlocked-1]:'Unranked'} · L{unlocked}/{cat.thresholds.length}</p>
                        </div>
                      </div>
                      <div className="text-right">
                        <p className="text-2xl font-black text-blue-400">{typeof value==='number'&&value<1?value.toFixed(3):value.toLocaleString()}</p>
                        <p className="text-[10px] text-blue-400/40 uppercase">{cat.unit}</p>
                      </div>
                    </div>
                    <div className="w-full bg-blue-950/60 rounded-full h-1.5 mb-1 overflow-hidden border border-blue-800/20">
                      <div className="h-full bg-linear-to-r from-blue-600 to-blue-400 rounded-full transition-all duration-1000" style={{width:`${prog}%`,filter:'drop-shadow(0 0 3px rgba(59,130,246,0.5))'}}/>
                    </div>
                    <p className="text-right text-[10px] text-blue-400/40 font-bold mb-5">
                      {unlocked===cat.thresholds.length?'Max Level 👑':`${typeof value==='number'&&value<1?value.toFixed(3):value.toLocaleString()} / ${typeof nextThr==='number'&&nextThr<1?nextThr.toFixed(3):nextThr.toLocaleString()}`}
                    </p>
                    <div className={`flex ${cat.thresholds.length===1?'justify-center':'justify-between'} items-end mb-5`}>
                      {cat.thresholds.map((_,idx)=>{
                        const tier=idx+1;
                        const isEarned=unlocked>=tier;
                        const isMinted2=mintedTier>=tier;
                        const style=getLevelStyle(cat.thresholds.length===1?5:tier,isMinted2,isEarned);
                        return(
                          <div key={tier} className="flex flex-col items-center gap-1.5 relative" style={{width:`${Math.floor(100/cat.thresholds.length)}%`}}>
                            <div className={`w-10 h-10 sm:w-11 sm:h-11 rounded-2xl flex items-center justify-center text-lg sm:text-xl transition-all ${style}`}>
                              {isEarned?cat.tierIcons[idx]:<Lock size={12} className="text-white/20"/>}
                              {isMinted2&&<div className="absolute -top-1.5 -right-1.5 bg-blue-500 text-white text-[8px] font-black w-4 h-4 flex items-center justify-center rounded-full border border-[#0a0f1e] z-10">✓</div>}
                            </div>
                            <span className={`text-[7px] font-black text-center uppercase leading-tight truncate w-full px-0.5 ${isMinted2?'text-blue-400':isEarned?'text-blue-300/60':'text-blue-800'}`}>{cat.tierNames[idx]}</span>
                          </div>
                        );
                      })}
                    </div>
                    <div className="flex flex-col mt-auto">
                      <div className="flex gap-2">
                        {connType==='farcaster'?(
                          <button onClick={()=>doNativeMint(cat.id,toLevels,toMint,cat.name)} disabled={!canMint||!!minting}
                            className={`flex-1 py-3 rounded-xl font-black text-xs transition-all active:scale-95 ${canMint&&!minting?'bg-blue-600 hover:bg-blue-500 text-white shadow-lg shadow-blue-600/20':'bg-blue-950/40 text-blue-800 cursor-not-allowed border border-blue-900/30'}`}>
                            {minting===`mint-${cat.id}`?<RefreshCcw className="animate-spin mx-auto" size={16}/>:btnText}
                          </button>
                        ):canMint?(
                          <Transaction key={`mint-${cat.id}-${txKeys[`mint-${cat.id}`]||0}`} chainId={base.id} calls={mintCall2} capabilities={txCaps}
                            onStatus={s=>{if(s.statusName==='success'){showToast(isBatch?`✅ Claimed ${toMint.length} ${cat.name} Badges!`:`✅ Badge minted!`,s.statusData.transactionReceipts?.[0]?.transactionHash||'');setMintedLevels(p=>({...p,[cat.id]:Math.max(...toLevels)}));setSponsored(v=>v+1);}}}>
                            <TransactionButton className="flex-1 py-3 w-full rounded-xl font-black text-xs bg-blue-600 hover:bg-blue-500 text-white shadow-lg shadow-blue-600/20 transition-all" text={btnText}/>
                          </Transaction>
                        ):(
                          <button disabled className="flex-1 py-3 rounded-xl font-black text-xs bg-blue-950/40 text-blue-800 cursor-not-allowed border border-blue-900/30">{btnText}</button>
                        )}
                        {mintedTier>0&&(
                          <div className="flex gap-1.5 shrink-0">
                            <button onClick={()=>shareAch(cat.name,cat.tierNames[mintedTier-1],'w')} className="bg-[#0d1628] border border-blue-500/15 hover:bg-blue-600/15 text-blue-400/50 p-3 rounded-xl transition-all"><Send size={13}/></button>
                            <button onClick={()=>shareAch(cat.name,cat.tierNames[mintedTier-1],'t')} className="bg-[#0d1628] border border-blue-500/15 hover:bg-blue-600/15 text-blue-400/50 p-3 rounded-xl transition-all"><Twitter size={13}/></button>
                          </div>
                        )}
                      </div>
                      {canMint&&<p className="text-[9px] text-blue-400/30 mt-2 text-center flex items-center justify-center gap-1"><Droplets size={8}/>Gas Sponsored via Coinbase Paymaster</p>}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
  );
}
