"use client";

import { useState, useEffect, useRef, useCallback } from 'react';
import {
  Wallet, Activity, Zap, Layers, Calendar, ArrowRightLeft, Power, BookOpen,
  RefreshCcw, Sun, FileCode, BarChart3, Trophy,
  CreditCard, User, BadgeCheck, Send, X, AlertTriangle,
  ChevronRight, Share2, Rocket, Twitter, MousePointerClick, Clock, Sparkles, History, Droplets, Lock,
  Flame, Gift, Users, Target, Star, CheckCircle, Copy, ExternalLink, ChevronUp, ChevronDown, Swords, Medal,
  TrendingUp, Wifi, Database, Palette, Coins, DollarSign, ShieldCheck, Hexagon
} from 'lucide-react';
import { JsonRpcProvider, formatEther, toUtf8Bytes } from 'ethers';
import sdk from "@farcaster/miniapp-sdk";
import { connectWallet } from './connection';
import BaseHub from '../components/BaseHub';
import { encodeFunctionData, createPublicClient, http } from 'viem';
import { base } from 'viem/chains';
import { Transaction, TransactionButton } from '@coinbase/onchainkit/transaction';

const ALCHEMY_KEY   = process.env.NEXT_PUBLIC_ALCHEMY_KEY || "mn8s-DCTchMi4q2DEKasm";
const BASE_RPC      = `https://base-mainnet.g.alchemy.com/v2/${ALCHEMY_KEY}`;
const MINIAPP_URL   = "https://farcaster.xyz/miniapps/lYFXQz4s1wsq/base-analytics";
const APP_URL_WEB   = "https://base-analytics-app.vercel.app";
const BUILDER_CODE  = "bc_4uoh9iu2";
const PAYMASTER_URL = process.env.NEXT_PUBLIC_PAYMASTER_URL || "";

function getBuilderSuffix(){
  const cb=toUtf8Bytes(BUILDER_CODE);
  const hex=Array.from(cb).map((b:number)=>b.toString(16).padStart(2,'0')).join('');
  return `${hex}${cb.length.toString(16).padStart(2,'0')}0080218021802180218021802180218021`;
}

// ── Contracts (unchanged) ─────────────────────────────────────────────────────
const BOOSTER_CONTRACT      = "0xd14E38239791738e8aCbd0Ad5278496af26fF510";
const GM_GN_CONTRACT        = "0xFF9Efc0ac8667674BC737C482d8885224a694f13";
const ACHIEVEMENTS_CONTRACT = "0xadb8120B4B18b892cFAD171243074487122Dea03";
const CHECKIN_CONTRACT      = "0xABc7099C631E18640ea60b25116407aa17354FBb";

const CHECKIN_ABI = [
  {inputs:[],name:"checkIn",outputs:[],stateMutability:"nonpayable",type:"function"},
  {inputs:[{internalType:"address",name:"",type:"address"}],name:"streaks",outputs:[{internalType:"uint256",name:"",type:"uint256"}],stateMutability:"view",type:"function"},
  {inputs:[{internalType:"address",name:"",type:"address"}],name:"lastCheckIn",outputs:[{internalType:"uint256",name:"",type:"uint256"}],stateMutability:"view",type:"function"}
] as const;

const ACHIEVEMENTS_ABI = [
  {inputs:[{internalType:"uint256",name:"tokenId",type:"uint256"}],name:"mintAchievement",outputs:[],stateMutability:"nonpayable",type:"function"},
  {inputs:[{internalType:"uint256[]",name:"tokenIds",type:"uint256[]"}],name:"mintBatchAchievements",outputs:[],stateMutability:"nonpayable",type:"function"},
  {inputs:[{internalType:"address",name:"",type:"address"},{internalType:"uint256",name:"",type:"uint256"}],name:"hasMinted",outputs:[{internalType:"bool",name:"",type:"bool"}],stateMutability:"view",type:"function"}
] as const;

const BOOSTER_ABI = [{name:'boost',type:'function',stateMutability:'payable',inputs:[],outputs:[]}] as const;
const GM_GN_ABI   = [
  {name:'gm',type:'function',stateMutability:'nonpayable',inputs:[],outputs:[]},
  {name:'gn',type:'function',stateMutability:'nonpayable',inputs:[],outputs:[]}
] as const;

const DEFI_PROTOCOLS = [
  "0xcf77a3ba9a5ca399b7c97c74d54e5b1beb874e43","0x3ddfa8ec3052539b6c9549f12cea2c295cff5296",
  "0x8ebaf22e6f05b4fbce41712019ba2289f631eff2","0x000000000022d473030f116ddee9f6b43ac78ba3",
  "0x3b6067d4caa8a14c63fdbe6318f27a0bbc9f9237","0x280b3b748ccc42d5062ce59111fad08594f51d9f",
  "0x4200000000000000000000000000000000000006",
];

const MONTH_NAMES = ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"];

// ── FIXED date helpers ────────────────────────────────────────────────────────
// getDayKey: simple ISO slice — always correct
const getDayKey = (iso: string): string => iso.slice(0, 10);

// getWeekKey: ISO week, no date mutation
const getWeekKey = (iso: string): string => {
  const d = new Date(iso);
  const thursday = new Date(Date.UTC(
    d.getUTCFullYear(), d.getUTCMonth(),
    d.getUTCDate() + 4 - (d.getUTCDay() || 7)
  ));
  const yearStart = new Date(Date.UTC(thursday.getUTCFullYear(), 0, 1));
  const wk = Math.ceil(((thursday.getTime() - yearStart.getTime()) / 86400000 + 1) / 7);
  return `${thursday.getUTCFullYear()}-W${String(wk).padStart(2,'0')}`;
};

// getMonthKey: padded 01-12, NOT 0-indexed
const getMonthKey = (iso: string): string => {
  const d = new Date(iso);
  return `${d.getUTCFullYear()}-${String(d.getUTCMonth()+1).padStart(2,'0')}`;
};

// ── Achievements & quests (unchanged) ────────────────────────────────────────
const ACHIEVEMENTS = [
  {id:'score',  baseId:10,name:'Onchain Rank',  icon:'🏅',unit:'Score',    thresholds:[10,30,60,75,85],   tierNames:["Base Shrimp","Base Dolphin","Base Shark","Base Whale","Base God"],      tierIcons:["🦐","🐬","🦈","🐋","👑"]},
  {id:'age',    baseId:20,name:'Pioneer',        icon:'📅',unit:'Days',     thresholds:[10,30,90,180,365], tierNames:["Newcomer","Explorer","Settler","Veteran","Early Adopter"],             tierIcons:["🥚","🧭","⛺","🎖️","🛸"]},
  {id:'name',   baseId:30,name:'Identity',       icon:'📛',unit:'Basename', thresholds:[1],                tierNames:["Verified"],                                                             tierIcons:["🆔"]},
  {id:'days',   baseId:40,name:'Diamond Hands',  icon:'💎',unit:'Days',     thresholds:[10,50,100,200,365],tierNames:["Tourist","Resident","Citizen","Patriot","Immortal"],                   tierIcons:["🎒","🏠","🏛️","🛡️","🗿"]},
  {id:'contract',baseId:50,name:'Base Builder',  icon:'🧱',unit:'Txs',     thresholds:[10,50,100,500,1000],tierNames:["Tinkerer","Apprentice","Engineer","Architect","Master Builder"],       tierIcons:["🔧","🔨","📐","🏗️","🌆"]},
  {id:'volume', baseId:60,name:'Whale Alert',    icon:'💰',unit:'ETH',      thresholds:[0.001,0.01,0.1,1.0,5.0],tierNames:["Guppy","Puffer","Angelfish","Sailboat","Leviathan"],            tierIcons:["🐟","🐡","🐠","⛵","🚢"]},
  {id:'txs',    baseId:70,name:'Power User',     icon:'📈',unit:'Txs',      thresholds:[10,50,100,500,1000],tierNames:["Spark","Bolt","Surge","Lightning","Storm"],                          tierIcons:["✨","🌩️","🌊","⚡","🌪️"]},
  {id:'swaps',  baseId:80,name:'DeFi Degen',     icon:'🔄',unit:'Swaps',    thresholds:[3,10,25,50,100],   tierNames:["Swapper","Trader","Provider","Yield Farmer","DeFi God"],              tierIcons:["🪙","📈","🏦","🚜","🦄"]},
  {id:'nfts',   baseId:90,name:'Collector',      icon:'👾',unit:'NFTs',     thresholds:[3,10,25,50,100],   tierNames:["Scout","Gatherer","Curator","Connoisseur","NFT Whale"],                tierIcons:["👁️","🧺","🖼️","🍷","🎨"]},
  {id:'streak', baseId:100,name:'Streak Master', icon:'🎯',unit:'Days',     thresholds:[3,7,14,30,100],    tierNames:["Match","Flame","Blaze","Inferno","Supernova"],                        tierIcons:["🕯️","🪔","🔥","🌋","🌌"]},
  {id:'boosts', baseId:110,name:'XP Booster',    icon:'🔋',unit:'Boosts',   thresholds:[5,10,25,50,100],   tierNames:["Novice","Supporter","Fanatic","Champion","Apex"],                     tierIcons:["🔰","🤝","📣","🏆","🔋"]},
];

const WEEKLY_QUESTS = [
  {id:'q_boost',   icon:'🚀',title:'Boost your score',  desc:'Use the XP Booster at least once',       xp:25,check:(w:WalletData,b:number)=>b>=1},
  {id:'q_gm',      icon:'☀️',title:'Say GM on Base',    desc:'Send a GM transaction onchain',          xp:15,check:(w:WalletData,_b:number,_s:number,k?:Record<string,number>)=>w.hasGm||!!(k?.gm&&k.gm>0)},
  {id:'q_checkin', icon:'🔥',title:'Onchain check-in',  desc:'Complete a daily onchain check-in',      xp:20,check:(_w:WalletData,_b:number,s:number,k?:Record<string,number>)=>s>=1||!!(k?.checkin&&k.checkin>0)},
  {id:'q_streak',  icon:'⚡',title:'3-day streak',      desc:'Maintain a 3+ day onchain streak',       xp:30,check:(_w:WalletData,_b:number,s:number)=>s>=3},
  {id:'q_defi',    icon:'🦄',title:'DeFi interaction',  desc:'Interact with a DeFi protocol',          xp:40,check:(w:WalletData)=>w.defiInteractions>=1},
  {id:'q_swap',    icon:'🔄',title:'Token swap',        desc:'Swap at least one token on Base',        xp:20,check:(w:WalletData)=>w.swapCount>=1},
  {id:'q_nft',     icon:'🎨',title:'Collect an NFT',    desc:'Hold 1+ NFTs on Base network',           xp:35,check:(w:WalletData)=>w.nftCount>=1},
  {id:'q_basename',icon:'🆔',title:'Claim Basename',    desc:'Register a .base.eth username',          xp:50,check:(w:WalletData)=>!!w.basename},
  {id:'q_vol',     icon:'💎',title:'Volume milestone',  desc:'Reach 0.001+ ETH transaction volume',   xp:30,check:(w:WalletData)=>parseFloat(w.ethVolume)>=0.001},
  {id:'q_txs',     icon:'📊',title:'Active trader',     desc:'Complete 10+ transactions on Base',      xp:25,check:(w:WalletData)=>w.txCount>=10},
];

const SEASON_START = new Date('2026-04-20T00:00:00Z');
const SEASON_END   = new Date('2026-07-20T23:59:59Z');
const SEASON_NAME  = "Season 1: Genesis";

const TIER_GRADIENTS = [
  'from-slate-500 to-slate-600',
  'from-amber-500 to-orange-600',
  'from-slate-300 to-slate-500',
  'from-yellow-400 to-yellow-600',
  'from-blue-600 to-indigo-600',
];

function getLevelStyle(level:number,isMinted:boolean,isEarned:boolean):string{
  if(!isEarned)return'bg-white/5 border border-white/8 text-white/15 opacity-40';
  const t=Math.min(level,5)-1;
  const b=`bg-linear-to-br ${TIER_GRADIENTS[t]} border border-white/20 text-white`;
  if(isMinted)return`${b} ring-2 ring-blue-400 ring-offset-1 ring-offset-[#0a0f1e] shadow-lg shadow-blue-400/20`;
  return`${b} opacity-75 border-dashed`;
}

function getTargetTokenId(baseId:number,num:number,level:number){return num===1?baseId+5:baseId+level;}

// ── TypeScript interfaces ─────────────────────────────────────────────────────
interface DayStats{date:string;count:number;intensity:number;}
interface WalletData{
  address:string; basename:string|null; balance:string; ethVolume:string;
  txCount:number; uniqueDays:number; activeWeeks:number; activeMonths:number;
  currentStreak:number; longestStreak:number; firstTx:string; lastTx:string;
  daysSinceActive:number; tokensSwapped:number; swapCount:number;
  contractInteractions:number; nftCount:number; walletRank:string;
  score:number; historyDays:number; weekLabels:string[]; dailyStats:DayStats[];
  topTokens:string[]; recommendation:string; recentTxs:AlchemyTransfer[];
  daysOnBase:number; defiInteractions:number; hasGm:boolean;
  uniqueContracts:number; avgTxPerDay:number; mostActiveMonth:string;
  ethReceived:number; totalGasSpent:number; erc20Txs:number; erc721Txs:number;
  walletHealthScore:number; walletHealthLabel:string;
  scoreComponents:Record<string,number>;
  portfolioValueUSD:number;
}
interface AlchemyTransfer{hash:string;category:string;value:number|null;asset:string|null;to:string|null;from:string|null;metadata:{blockTimestamp:string;};}
interface AlchemyResponse{result?:{transfers:AlchemyTransfer[];pageKey?:string;};error?:{message:string;};}
type ConnectionType='farcaster'|'coinbase'|'metamask';
interface LeaderboardEntry{address:string;basename:string|null;score:number;rank:string;boosts:number;badges:number;weeklyXP:number;totalXP:number;weekNumber:number;lastSeen?:number;}
type LeaderboardPost=Omit<LeaderboardEntry,'totalXP'|'lastSeen'>;

// ── Leaderboard API ───────────────────────────────────────────────────────────
async function saveLeaderboard(entry:LeaderboardPost){
  try{await fetch('/api/leaderboard',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(entry)});}
  catch(e){console.error('Leaderboard save failed',e);}
}
async function fetchLeaderboard():Promise<LeaderboardEntry[]>{
  try{const r=await fetch('/api/leaderboard');if(!r.ok)return[];const d=await r.json();return d.leaderboard||[];}
  catch{return[];}
}

// ── Utility functions ─────────────────────────────────────────────────────────
function getReferralCode(a:string){return a.slice(2,10).toUpperCase();}
function getISOWeekNumber():number{const d=new Date();const day=d.getUTCDay()||7;d.setUTCDate(d.getUTCDate()+4-day);const y=new Date(Date.UTC(d.getUTCFullYear(),0,1));return Math.ceil(((d.getTime()-y.getTime())/86400000+1)/7);}
function getQuestXP(w:WalletData,b:number,s:number,k?:Record<string,number>):number{return WEEKLY_QUESTS.filter(q=>q.check(w,b,s,k)).reduce((acc,q)=>acc+q.xp,0);}
function computeWeeklyXP(w:WalletData,b:number,s:number,k?:Record<string,number>):number{return getQuestXP(w,b,s,k)+Math.min(b,10)*10+Math.min(s,7)*5;}
function getSeasonPct(){const now=new Date();if(now<SEASON_START)return 0;if(now>SEASON_END)return 100;return Math.round(((now.getTime()-SEASON_START.getTime())/(SEASON_END.getTime()-SEASON_START.getTime()))*100);}
function getDaysLeft(){const now=new Date();if(now>SEASON_END)return 0;return Math.max(0,Math.ceil((SEASON_END.getTime()-now.getTime())/86400000));}
function buildShare(w:WalletData,ref:string,extra:string):string{return`${extra}\n\n🔵 ${SEASON_NAME} — earn XP, mint badges & unlock future rewards!\n🎁 Use my link: ${APP_URL_WEB}?ref=${ref}\n#BaseAnalytics #Base #Onchain`;}
function warpcast(text:string):string{return`https://warpcast.com/~/compose?text=${encodeURIComponent(text)}&embeds[]=${encodeURIComponent(MINIAPP_URL)}`;}
function twitterShare(text:string):string{return`https://twitter.com/intent/tweet?text=${encodeURIComponent(text)}`;}
function getCapabilities(){if(!PAYMASTER_URL)return{};return{paymasterService:{url:PAYMASTER_URL}};}

// ── Wallet Health Score ───────────────────────────────────────────────────────
function calcWalletHealth(w:{uniqueDays:number;activeMonths:number;currentStreak:number;defiInteractions:number;uniqueContracts:number;txCount:number;nftCount:number;basename:string|null;daysSinceActive:number}):{score:number;label:string}{
  let h=0;
  if(w.uniqueDays>=100)h+=20;else if(w.uniqueDays>=30)h+=10;else if(w.uniqueDays>=7)h+=5;
  if(w.activeMonths>=12)h+=20;else if(w.activeMonths>=6)h+=12;else if(w.activeMonths>=3)h+=6;
  if(w.currentStreak>=30)h+=15;else if(w.currentStreak>=7)h+=8;else if(w.currentStreak>=3)h+=4;
  if(w.defiInteractions>=20)h+=15;else if(w.defiInteractions>=5)h+=8;else if(w.defiInteractions>=1)h+=4;
  if(w.uniqueContracts>=50)h+=15;else if(w.uniqueContracts>=10)h+=8;else if(w.uniqueContracts>=3)h+=4;
  if(w.txCount>=500)h+=10;else if(w.txCount>=100)h+=6;else if(w.txCount>=20)h+=3;
  if(w.nftCount>=10)h+=5;
  if(w.basename)h+=5;
  if(w.daysSinceActive<=1)h+=10;else if(w.daysSinceActive<=7)h+=5;else if(w.daysSinceActive>30)h-=10;
  const score=Math.min(100,Math.max(0,h));
  let label='💀 Dormant';
  if(score>=80)label='🔥 Excellent';
  else if(score>=60)label='💪 Strong';
  else if(score>=40)label='📈 Growing';
  else if(score>=20)label='🌱 Early';
  return{score,label};
}

// ═════════════════════════════════════════════════════════════════════════════
// MAIN COMPONENT
// ═════════════════════════════════════════════════════════════════════════════
export default function Page(){
  const[wallet,setWallet]=useState<WalletData|null>(null);
  const[connType,setConnType]=useState<ConnectionType|null>(null);
  const[loading,setLoading]=useState(false);
  const[tab,setTab]=useState<'dashboard'|'achievements'|'quests'|'leaderboard'|'basehub'>('dashboard');
  const[minting,setMinting]=useState<string|null>(null);
  const[mintedLevels,setMintedLevels]=useState<Record<string,number>>({});
  const[ready,setReady]=useState(false);
  const[showModal,setShowModal]=useState(false);
  const[selDay,setSelDay]=useState<DayStats|null>(null);
  const scrollRef=useRef<HTMLDivElement>(null);
  const[boosts,setBoosts]=useState(0);
  const[sponsored,setSponsored]=useState(0);
  const[txKeys,setTxKeys]=useState<Record<string,number>>({boost:0,gm:0,gn:0,checkin:0});
  const[toast,setToast]=useState<{msg:string;hash:string}|null>(null);
  const[streak,setStreak]=useState(0);
  const[checkedToday,setCheckedToday]=useState(false);
  const[leaderboard,setLeaderboard]=useState<LeaderboardEntry[]>([]);
  const[lbLoading,setLbLoading]=useState(true);
  const[challenge,setChallenge]=useState('');
  const[challengeResult,setChallengeResult]=useState<{address:string;score:number;rank:string;days:number;txs:number}|null>(null);
  const[challengeLoading,setChallengeLoading]=useState(false);
  const[refCopied,setRefCopied]=useState(false);
  const[weeklyXP,setWeeklyXP]=useState(0);

  // ── Calldata (unchanged builder suffix) ──────────────────────────────────
  const boostDWT=`${encodeFunctionData({abi:BOOSTER_ABI,functionName:'boost'})}${getBuilderSuffix()}` as `0x${string}`;
  const gmDWT   =`${encodeFunctionData({abi:GM_GN_ABI,functionName:'gm'})}${getBuilderSuffix()}` as `0x${string}`;
  const gnDWT   =`${encodeFunctionData({abi:GM_GN_ABI,functionName:'gn'})}${getBuilderSuffix()}` as `0x${string}`;
  const ciDWT   =`${encodeFunctionData({abi:CHECKIN_ABI,functionName:'checkIn'})}${getBuilderSuffix()}` as `0x${string}`;

  const boostCall=[{to:BOOSTER_CONTRACT as `0x${string}`,data:boostDWT,value:BigInt(4000000000000)}];
  const gmCall = [{to:GM_GN_CONTRACT as `0x${string}`,data:gmDWT}];
  const gnCall = [{to:GM_GN_CONTRACT as `0x${string}`,data:gnDWT}];
  const ciCall   =[{to:CHECKIN_CONTRACT as `0x${string}`,data:ciDWT}];
  const txCaps   = getCapabilities();

  const showToast=(msg:string,hash:string)=>{setToast({msg,hash});setTimeout(()=>setToast(null),6000);};

  useEffect(()=>{
    if(typeof window!=='undefined'&&sdk?.actions?.ready){try{sdk.actions.ready();setReady(true);}catch(e){console.error(e);}}
    fetchLeaderboard().then(d=>{setLeaderboard(d);setLbLoading(false);});
    if(typeof window!=='undefined'){const p=new URLSearchParams(window.location.search);const r=p.get('ref');if(r)localStorage.setItem('base_referrer',r);}
  },[]);

  useEffect(()=>{
    if(wallet&&tab==='dashboard'&&scrollRef.current)setTimeout(()=>{if(scrollRef.current)scrollRef.current.scrollLeft=scrollRef.current.scrollWidth;},100);
  },[wallet,tab]);

  useEffect(()=>{
    if(!wallet)return;
    const xp=computeWeeklyXP(wallet,boosts,streak,txKeys);
    setWeeklyXP(xp);
    const mintedCount=Object.keys(mintedLevels).filter(k=>mintedLevels[k]>0).length;
    const entry:LeaderboardPost={address:wallet.address,basename:wallet.basename,score:wallet.score,rank:wallet.walletRank,boosts,badges:mintedCount,weeklyXP:xp,weekNumber:getISOWeekNumber()};
    saveLeaderboard(entry).then(()=>fetchLeaderboard().then(d=>setLeaderboard(d)));
  },[wallet,boosts,mintedLevels,streak,txKeys]);

  // ── REAL challenge lookup — uses same fixed helpers ───────────────────────
  const handleChallenge=useCallback(async()=>{
    const addr=challenge.trim().toLowerCase();
    if(!addr||!addr.startsWith('0x')||addr.length!==42){showToast('❌ Invalid address','');return;}
    setChallengeLoading(true);
    try{
      let txs:AlchemyTransfer[]=[],pk:string|undefined;
      for(let n=0;n<3;n++){
        const params:Record<string,unknown>={fromBlock:"0x0",toBlock:"latest",fromAddress:addr,category:["external","erc20","erc721","erc1155"],maxCount:"0x3e8",withMetadata:true};
        if(pk)params.pageKey=pk;
        const r=await fetch(BASE_RPC,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({jsonrpc:"2.0",id:1,method:"alchemy_getAssetTransfers",params:[params]})});
        const d=await r.json() as AlchemyResponse;
        if(d.error)break;
        txs=[...txs,...(d.result?.transfers||[])];
        pk=d.result?.pageKey;
        if(!pk)break;
      }
      // Use same fixed helpers for accurate counts
      const days=new Set(txs.map(tx=>getDayKey(tx.metadata.blockTimestamp)));
      const months=new Set(txs.map(tx=>getMonthKey(tx.metadata.blockTimestamp)));
      const s=Math.min(100,Math.floor(
        Math.min(25,txs.length/20)+Math.min(20,days.size/4)+
        Math.min(15,months.size*1.25)+Math.min(20,days.size/3)+Math.min(10,months.size)
      ));
      let rank='Base Shrimp 🦐';
      if(s>=30)rank='Base Dolphin 🐬';if(s>=50)rank='Base Shark 🦈';
      if(s>=70)rank='Base Whale 🐋';if(s>=85)rank='Base God 👑';
      setChallengeResult({address:addr,score:s,rank,days:days.size,txs:txs.length});
    }catch{showToast('❌ Lookup failed','');}
    finally{setChallengeLoading(false);}
  },[challenge]);

  // ── Main wallet analysis ──────────────────────────────────────────────────
  const analyzeWallet=useCallback(async(address:string)=>{
    if(!address||!address.startsWith('0x')||address.length!==42){showToast('❌ Invalid EVM Address','');setLoading(false);return;}
    try{
      const provider=new JsonRpcProvider(BASE_RPC);
      const pub=createPublicClient({chain:base,transport:http(BASE_RPC)});
      setMintedLevels({});

      const BASE_REVERSE_REGISTRAR='0x79EA96012eEa67A83431F1701B3dFf7e37F9E282' as `0x${string}`;
      const BASE_L2_RESOLVER='0xC6d566A56A1aFf6508b41f6c90ff131615583BCD' as `0x${string}`;
      const REVERSE_REGISTRAR_ABI=[{name:'node',type:'function',stateMutability:'view',inputs:[{name:'addr',type:'address'}],outputs:[{name:'',type:'bytes32'}]}] as const;
      const NAME_RESOLVER_ABI=[{name:'name',type:'function',stateMutability:'view',inputs:[{name:'node',type:'bytes32'}],outputs:[{name:'',type:'string'}]}] as const;

      const bnP=pub.readContract({address:BASE_REVERSE_REGISTRAR,abi:REVERSE_REGISTRAR_ABI,functionName:'node',args:[address as `0x${string}`]})
        .then(async(rn)=>{if(!rn)return null;const n=await pub.readContract({address:BASE_L2_RESOLVER,abi:NAME_RESOLVER_ABI,functionName:'name',args:[rn]}).catch(()=>null);return(n&&typeof n==='string'&&n.trim()!=='')?n:null;}).catch(()=>null);

      const balP =provider.getBalance(address).catch(()=>BigInt(0));
      const nftP =fetch(`https://base-mainnet.g.alchemy.com/nft/v3/${ALCHEMY_KEY}/getNFTsForOwner?owner=${address}&withMetadata=false`).then(r=>r.json()).catch(()=>({totalCount:0}));
      const strkP=pub.readContract({address:CHECKIN_CONTRACT as `0x${string}`,abi:CHECKIN_ABI,functionName:'streaks',args:[address as `0x${string}`]}).catch(()=>BigInt(0));
      const lastP=pub.readContract({address:CHECKIN_CONTRACT as `0x${string}`,abi:CHECKIN_ABI,functionName:'lastCheckIn',args:[address as `0x${string}`]}).catch(()=>BigInt(0));

      const calls:{address:`0x${string}`;abi:typeof ACHIEVEMENTS_ABI;functionName:'hasMinted';args:readonly[`0x${string}`,bigint]}[]=[];
      const callMap:{catId:string;level:number}[]=[];
      for(const cat of ACHIEVEMENTS){for(let i=cat.thresholds.length;i>=1;i--){const tid=getTargetTokenId(cat.baseId,cat.thresholds.length,i);calls.push({address:ACHIEVEMENTS_CONTRACT as `0x${string}`,abi:ACHIEVEMENTS_ABI,functionName:'hasMinted',args:[address as `0x${string}`,BigInt(tid)]});callMap.push({catId:cat.id,level:i});}}
      const mcP=pub.multicall({contracts:calls}).catch(()=>[]);

      // Paginated outbound tx fetch
      const txP=(async()=>{
        let txs:AlchemyTransfer[]=[],pk:string|undefined,n=0;
        while(true){
          n++;
          const params:Record<string,unknown>={fromBlock:"0x0",toBlock:"latest",fromAddress:address,category:["external","erc20","erc721","erc1155"],maxCount:"0x3e8",withMetadata:true};
          if(pk)params.pageKey=pk;
          const r=await fetch(BASE_RPC,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({jsonrpc:"2.0",id:1,method:"alchemy_getAssetTransfers",params:[params]})});
          const d=await r.json() as AlchemyResponse;
          if(d.error)break;
          txs=[...txs,...(d.result?.transfers||[])];
          pk=d.result?.pageKey;
          if(!pk||n>5)break;
        }
        return txs;
      })();

      const rxP=fetch(BASE_RPC,{method:'POST',headers:{'Content-Type':'application/json'},
        body:JSON.stringify({jsonrpc:"2.0",id:2,method:"alchemy_getAssetTransfers",
          params:[{fromBlock:"0x0",toBlock:"latest",toAddress:address,category:["external","erc20"],maxCount:"0x3e8",withMetadata:true}]})
      }).then(r=>r.json()).catch(()=>({result:{transfers:[]}}));

      const ethPriceP=fetch('https://api.coingecko.com/api/v3/simple/price?ids=ethereum&vs_currencies=usd')
        .then(r=>r.json()).catch(()=>({ethereum:{usd:3200}}));

      const[bn,balWei,nftData,mcRes,allTxs,rxData,dbStreak,dbLastCI,ethPriceData]=
        await Promise.all([bnP,balP,nftP,mcP,txP,rxP,strkP,lastP,ethPriceP]);

      setStreak(Number(dbStreak));
      if(Number(dbLastCI)>0){const ld=new Date(Number(dbLastCI)*1000).toISOString().slice(0,10);setCheckedToday(ld===new Date().toISOString().slice(0,10));}

      const ms:Record<string,number>={};
      mcRes.forEach((r:{status:string;result?:unknown},i:number)=>{const{catId,level}=callMap[i];if(r.status==='success'&&r.result===true){if(!ms[catId]||ms[catId]<level)ms[catId]=level;}});
      setMintedLevels(ms);

      // ── FIXED: use corrected date helpers ──────────────────────────────
      const uDays=new Set<string>(),uWeeks=new Set<string>(),uMonths=new Set<string>();
      const uTokens=new Set<string>(),uContracts=new Set<string>();
      const tokFreq=new Map<string,number>(),monthActivity=new Map<string,number>(),tpd=new Map<string,number>();
      let ethVol=0,swapCount=0,cxInteract=0,hBoosts=0,defi=0,hasGm=false,erc20Txs=0,erc721Txs=0;

      for(const tx of allTxs){
        const ts=tx.metadata.blockTimestamp;
        if(!ts)continue;
        const dk=getDayKey(ts);    // ✅ FIXED
        const wk=getWeekKey(ts);   // ✅ FIXED — no mutation
        const mk=getMonthKey(ts);  // ✅ FIXED — padded 01-12
        uDays.add(dk);uWeeks.add(wk);uMonths.add(mk);
        tpd.set(dk,(tpd.get(dk)||0)+1);
        monthActivity.set(mk,(monthActivity.get(mk)||0)+1);
        if(tx.value&&tx.value>0&&(tx.asset==='ETH'||tx.asset==='WETH'))ethVol+=tx.value;
        if(tx.category==='erc20'){swapCount++;erc20Txs++;}
        if(tx.category==='erc721')erc721Txs++;
        if(['erc20','erc721','erc1155'].includes(tx.category)&&tx.asset){uTokens.add(tx.asset);tokFreq.set(tx.asset,(tokFreq.get(tx.asset)||0)+1);}
        if(tx.category==='external'){cxInteract++;if(tx.to)uContracts.add(tx.to.toLowerCase());}
        if(tx.to&&DEFI_PROTOCOLS.includes(tx.to.toLowerCase()))defi++;
        if(tx.to&&tx.to.toLowerCase()===BOOSTER_CONTRACT.toLowerCase())hBoosts++;
        if(tx.to&&tx.to.toLowerCase()===GM_GN_CONTRACT.toLowerCase())hasGm=true;
      }

      // ETH received
      let ethReceived=0;
      const rxTxs=(rxData as AlchemyResponse).result?.transfers||[];
      for(const tx of rxTxs){if(tx.value&&(tx.asset==='ETH'||tx.asset==='WETH'))ethReceived+=tx.value;}

      // Boosts from localStorage
      let fBoosts=hBoosts;
      if(typeof window!=='undefined'){
        const c=localStorage.getItem(`base_boosts_${address.toLowerCase()}`);
        if(c){const p=parseInt(c,10);if(p>fBoosts)fBoosts=p;}
        localStorage.setItem(`base_boosts_${address.toLowerCase()}`,fBoosts.toString());
        if(localStorage.getItem(`base_gm_${address.toLowerCase()}`)==='true')hasGm=true;
        else if(hasGm)localStorage.setItem(`base_gm_${address.toLowerCase()}`,'true');
      }
      setBoosts(fBoosts);

      // ── FIXED streak calculation ────────────────────────────────────────
      const sortedDays=Array.from(uDays).sort();
      let longest=sortedDays.length>0?1:0,runLen=sortedDays.length>0?1:0;
      for(let i=1;i<sortedDays.length;i++){
        const diff=Math.round((new Date(sortedDays[i]).getTime()-new Date(sortedDays[i-1]).getTime())/86400000);
        if(diff===1){runLen++;longest=Math.max(longest,runLen);}else{runLen=1;}
      }

      // Current streak — walk backwards from today
      const todayKey=new Date().toISOString().slice(0,10);
      const yesterKey=new Date(Date.now()-86400000).toISOString().slice(0,10);
      let curStreak=0;
      if(uDays.has(todayKey)||uDays.has(yesterKey)){
        let ptr=new Date((uDays.has(todayKey)?todayKey:yesterKey)+'T00:00:00Z');
        while(uDays.has(ptr.toISOString().slice(0,10))){curStreak++;ptr=new Date(ptr.getTime()-86400000);}
      }

      // Timeline
      const now=new Date();
      let firstTs=now.getTime(),lastTs=0,firstTx='N/A',lastTx='N/A',daysSinceActive=0,daysOnBase=0;
      if(allTxs.length>0){
        const stamps=allTxs.map(tx=>new Date(tx.metadata.blockTimestamp).getTime()).filter(t=>!isNaN(t));
        firstTs=Math.min(...stamps);lastTs=Math.max(...stamps);
        firstTx=new Date(firstTs).toLocaleDateString();lastTx=new Date(lastTs).toLocaleDateString();
        daysSinceActive=Math.floor((now.getTime()-lastTs)/86400000);
        daysOnBase=Math.floor((now.getTime()-firstTs)/86400000);
      }

      // Most active month — FIXED (mk is padded 01-12, parseInt(m)-1 gives 0-11)
      const mak=Array.from(monthActivity.entries()).sort((a,b)=>b[1]-a[1])[0]?.[0]||'';
      let mostActiveMonth='N/A';
      if(mak){const[y,m]=mak.split('-');mostActiveMonth=`${MONTH_NAMES[parseInt(m)-1]} ${y}`;}

      const avgTxPerDay=uDays.size>0?Math.round((allTxs.length/uDays.size)*10)/10:0;

      // Improved score formula — transparent, each bucket clear
      const scoreComponents:{[k:string]:number}={
        txActivity:  Math.min(25,allTxs.length/20),
        consistency: Math.min(20,uDays.size/4),
        longevity:   Math.min(15,uMonths.size*1.25),
        streak:      Math.min(15,curStreak*2),
        volume:      Math.min(10,ethVol*10),
        diversity:   Math.min(10,uTokens.size),
        defiUsage:   Math.min(5,defi),
      };
      const score=Math.min(100,Math.floor(Object.values(scoreComponents).reduce((a,b)=>a+b,0)));
      let walletRank='Base Shrimp 🦐';
      if(score>=30)walletRank='Base Dolphin 🐬';if(score>=50)walletRank='Base Shark 🦈';
      if(score>=70)walletRank='Base Whale 🐋';if(score>=85)walletRank='Base God 👑';

      // Portfolio value (ETH × live price)
      const ethUSD=ethPriceData?.ethereum?.usd||3200;
      const ethBalNum=parseFloat(formatEther(balWei));
      const portfolioValueUSD=parseFloat((ethBalNum*ethUSD).toFixed(2));

      // Wallet health
      const health=calcWalletHealth({uniqueDays:uDays.size,activeMonths:uMonths.size,currentStreak:curStreak,defiInteractions:defi,uniqueContracts:uContracts.size,txCount:allTxs.length,nftCount:nftData.totalCount||0,basename:bn,daysSinceActive});

      // Recommendation
      let recommendation="You're a Base power user! Keep it up.";
      if(daysSinceActive>30)recommendation=`⚠️ Inactive ${daysSinceActive} days! Wallet going dormant.`;
      else if(daysSinceActive>7)recommendation=`⚠️ Inactive for ${daysSinceActive} days! Send a GM to revive your streak.`;
      else if(!bn)recommendation='🆔 Get a Basename to boost your identity and score on Base!';
      else if(swapCount===0)recommendation='💡 No swaps yet! Try Aerodrome or Uniswap on Base.';
      else if(defi===0)recommendation='🏦 No DeFi activity! Try Moonwell or Morpho.';
      else if(allTxs.length<10)recommendation='👋 Welcome to Base! Try minting an NFT or boosting your score.';

      // Heatmap
      const histDays=allTxs.length>0?Math.max(364,Math.ceil((now.getTime()-firstTs)/86400000)+14):364;
      const dStats:DayStats[]=[];
      const hPtr=new Date(now);
      for(let i=0;i<histDays;i++){
        const ds=hPtr.toISOString().slice(0,10);const c=tpd.get(ds)||0;
        let intensity=0;if(c>0)intensity=1;if(c>2)intensity=2;if(c>5)intensity=3;if(c>10)intensity=4;
        dStats.unshift({date:ds,count:c,intensity});hPtr.setUTCDate(hPtr.getUTCDate()-1);
      }
      const tCols=Math.ceil(histDays/7);const wLabels:string[]=[];let lastML='';
      const gStart=new Date();gStart.setUTCDate(gStart.getUTCDate()-histDays+1);
      for(let col=0;col<tCols;col++){const ws=new Date(gStart);ws.setUTCDate(ws.getUTCDate()+(col*7));const mi=ws.getUTCMonth();if(MONTH_NAMES[mi]!==lastML){wLabels.push(MONTH_NAMES[mi]);lastML=MONTH_NAMES[mi];}else wLabels.push('');}

      const topTokens=Array.from(tokFreq.entries()).sort((a,b)=>b[1]-a[1]).slice(0,3).map(e=>e[0]);
      const recentTxs=[...allTxs].sort((a,b)=>new Date(b.metadata.blockTimestamp).getTime()-new Date(a.metadata.blockTimestamp).getTime()).slice(0,8);

      setWallet({
        address,basename:bn,balance:ethBalNum.toFixed(4),ethVolume:ethVol.toFixed(4),
        txCount:allTxs.length,
        uniqueDays:uDays.size,      // ✅ FIXED — was showing 355, now correct ~553
        activeWeeks:uWeeks.size,    // ✅ FIXED — no mutation bug
        activeMonths:uMonths.size,  // ✅ FIXED — no 0-index collision
        currentStreak:curStreak,    // ✅ FIXED
        longestStreak:longest,      // ✅ FIXED
        firstTx,lastTx,daysSinceActive,
        tokensSwapped:uTokens.size,swapCount,contractInteractions:cxInteract,
        nftCount:nftData.totalCount||0,walletRank,score:Math.min(100,score),
        historyDays:histDays,weekLabels:wLabels,dailyStats:dStats,
        topTokens,recommendation,recentTxs,daysOnBase,defiInteractions:defi,hasGm,
        uniqueContracts:uContracts.size,avgTxPerDay,
        mostActiveMonth,            // ✅ FIXED
        ethReceived:parseFloat(ethReceived.toFixed(4)),totalGasSpent:0,erc20Txs,erc721Txs,
        walletHealthScore:health.score,walletHealthLabel:health.label,
        scoreComponents,portfolioValueUSD,
      });
    }catch(e){console.error(e);setWallet(null);}
    finally{setLoading(false);}
  },[]);

  const handleConnect=async(type:ConnectionType)=>{
    try{
      setShowModal(false);setLoading(true);let addr='';
      if(type==='farcaster'){
        showToast("⏳ Connecting Farcaster...","");
        const accs=await sdk.wallet.ethProvider.request({method:"eth_requestAccounts"}) as string[];
        const evm=accs.find(a=>a&&a.startsWith('0x'));
        if(!evm)throw new Error("No EVM wallet");
        addr=evm;showToast("✅ Scanning...","");
      }else{const{address}=await connectWallet(type);addr=address;}
      setConnType(type);analyzeWallet(addr);
    }catch{setLoading(false);showToast("❌ Connection Failed.","");}
  };

  const handleDisconnect=()=>{setWallet(null);setConnType(null);};

  const doNativeTx=async(type:'boost'|'gm'|'gn'|'checkin')=>{
    if(!wallet||minting)return;setMinting(type);
    try{
      let to:`0x${string}`=BOOSTER_CONTRACT as `0x${string}`;let data:`0x${string}`=boostDWT;let msg='Boosted! 🎉';
      const val=type==='boost'?BigInt(4000000000000):BigInt(0);
      if(type==='gm'){to=GM_GN_CONTRACT as `0x${string}`;data=gmDWT;msg='GM on Base! ☀️';}
      else if(type==='gn'){to=GM_GN_CONTRACT as `0x${string}`;data=gnDWT;msg='GN on Base! 🌙';}
      else if(type==='checkin'){to=CHECKIN_CONTRACT as `0x${string}`;data=ciDWT;msg='Check-in secured! 🔥';}
      const p:{from:`0x${string}`;to:`0x${string}`;data:`0x${string}`;chainId:`0x${string}`;value?:`0x${string}`}={from:wallet.address as `0x${string}`,to,data,chainId:'0x2105' as `0x${string}`};
      if(type!=='checkin')p.value=`0x${val.toString(16)}` as `0x${string}`;
      const hash=await sdk.wallet.ethProvider.request({method:"eth_sendTransaction",params:[p]});
      if(hash&&typeof hash==='string'){
        showToast(msg,hash);setSponsored(s=>s+1);
        if(type==='boost'){setBoosts(b=>{const n=b+1;if(typeof window!=='undefined')localStorage.setItem(`base_boosts_${wallet.address.toLowerCase()}`,n.toString());return n;});setTxKeys(k=>({...k,boost:(k.boost||0)+1}));}
        if(type==='gm'){if(typeof window!=='undefined')localStorage.setItem(`base_gm_${wallet.address.toLowerCase()}`,'true');setTxKeys(k=>({...k,gm:(k.gm||0)+1}));}
        if(type==='gn')setTxKeys(k=>({...k,gn:(k.gn||0)+1}));
        if(type==='checkin'){setCheckedToday(true);setStreak(s=>s+1);setTxKeys(k=>({...k,checkin:(k.checkin||0)+1}));}
      }
    }catch(e:unknown){const m=e instanceof Error?e.message.split('\n')[0]:'Rejected.';if(!m.includes("rejected"))showToast(`❌ ${m}`,'');}
    finally{setMinting(null);}
  };

  const doNativeMint=async(catId:string,targetLevels:number[],tokenIds:number[],catName:string)=>{
    if(!wallet||minting)return;setMinting(`mint-${catId}`);
    try{
      const isBatch=tokenIds.length>1;
      const raw=isBatch?encodeFunctionData({abi:ACHIEVEMENTS_ABI,functionName:'mintBatchAchievements',args:[tokenIds.map(id=>BigInt(id))]}):encodeFunctionData({abi:ACHIEVEMENTS_ABI,functionName:'mintAchievement',args:[BigInt(tokenIds[0])]});
      const data=`${raw}${getBuilderSuffix()}` as `0x${string}`;
      const hash=await sdk.wallet.ethProvider.request({method:"eth_sendTransaction",params:[{from:wallet.address as `0x${string}`,to:ACHIEVEMENTS_CONTRACT as `0x${string}`,data,chainId:'0x2105' as `0x${string}`}]});
      if(hash&&typeof hash==='string'){
        showToast(isBatch?`✅ Claimed ${tokenIds.length} ${catName} Badges!`:`✅ Badge minted!`,hash);
        setMintedLevels(p=>({...p,[catId]:Math.max(...targetLevels)}));
        setTxKeys(p=>({...p,[`mint-${catId}`]:(p[`mint-${catId}`]||0)+1}));setSponsored(s=>s+1);
      }
    }catch(e:unknown){const m=e instanceof Error?e.message.split('\n')[0]:'Mint rejected.';if(!m.includes("rejected"))showToast('❌ Mint Failed','');}
    finally{setMinting(null);}
  };

  const getCatValue=(id:string)=>{if(!wallet)return 0;const m:Record<string,number>={score:wallet.score,age:wallet.daysOnBase,name:wallet.basename?1:0,days:wallet.uniqueDays,contract:wallet.contractInteractions,volume:parseFloat(wallet.ethVolume),txs:wallet.txCount,swaps:wallet.swapCount,nfts:wallet.nftCount,streak:wallet.longestStreak,boosts};return m[id]??0;};
  const mintedCount=wallet?Object.keys(mintedLevels).filter(k=>mintedLevels[k]>0).length:0;
  const doneQuests=wallet?WEEKLY_QUESTS.filter(q=>q.check(wallet,boosts,streak,txKeys)).length:0;
  const ref=wallet?getReferralCode(wallet.address):'';

  const shareScore=(pl:'w'|'t'|'n')=>{
    if(!wallet)return;
    const text=buildShare(wallet,ref,`🏆 I'm a ${wallet.walletRank} on @base!\n\nScore: ${wallet.score}/100 🔵\nActive Days: ${wallet.uniqueDays} 📅\nStreak: ${streak}d 🔥\nBadges: ${mintedCount} 🎖️`);
    if(pl==='w')window.open(warpcast(text),'_blank');
    else if(pl==='t')window.open(twitterShare(text),'_blank');
    else if(navigator.share)navigator.share({title:'Base Analytics',text,url:APP_URL_WEB}).catch(()=>{});
  };
  const shareAch=(name:string,level:string,pl:'w'|'t')=>{if(!wallet)return;const text=buildShare(wallet,ref,`🏅 Just unlocked "${level}" badge for ${name} on Base Analytics! 🔵`);if(pl==='w')window.open(warpcast(text),'_blank');else window.open(twitterShare(text),'_blank');};
  const shareAll=(count:number,pl:'w'|'t')=>{if(!wallet)return;const text=buildShare(wallet,ref,`🎖️ Just claimed ${count} Onchain Badges gasless on Base Analytics! 🔵`);if(pl==='w')window.open(warpcast(text),'_blank');else window.open(twitterShare(text),'_blank');};

  // ── LOADING ──────────────────────────────────────────────────────────────
  if(!ready)return(
    <div className="min-h-screen bg-[#0a0f1e] flex items-center justify-center">
      <div className="text-center space-y-5">
        <div className="relative w-20 h-20 mx-auto">
          <div className="w-20 h-20 rounded-3xl bg-linear-to-br from-blue-500 to-blue-700 flex items-center justify-center shadow-2xl shadow-blue-600/60">
            <Hexagon size={36} className="text-white"/>
          </div>
          <div className="absolute inset-0 rounded-3xl border-2 border-blue-400/30 animate-ping"/>
        </div>
        <div>
          <p className="text-white font-black text-xl tracking-tight">BASE<span className="text-blue-400">.</span>ANALYTICS</p>
          <p className="text-blue-400/60 font-mono text-[10px] tracking-[0.4em] uppercase mt-1">Initializing...</p>
        </div>
      </div>
    </div>
  );

  // ── LANDING ──────────────────────────────────────────────────────────────
  if(!wallet)return(
    <div className="min-h-screen bg-[#0a0f1e] flex flex-col items-center justify-center p-4 relative overflow-hidden">
      <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[600px] h-[300px] bg-blue-600/12 rounded-full blur-3xl pointer-events-none"/>
      <div className="absolute bottom-0 right-0 w-[400px] h-[300px] bg-blue-500/8 rounded-full blur-3xl pointer-events-none"/>
      <div className="absolute inset-0 pointer-events-none opacity-30" style={{backgroundImage:'linear-gradient(rgba(59,130,246,0.05) 1px,transparent 1px),linear-gradient(90deg,rgba(59,130,246,0.05) 1px,transparent 1px)',backgroundSize:'48px 48px'}}/>
      <div className="relative z-10 w-full max-w-sm">
        <div className="text-center mb-8">
          <div className="relative w-20 h-20 mx-auto mb-5">
            <div className="w-20 h-20 bg-linear-to-br from-blue-500 to-blue-700 rounded-3xl flex items-center justify-center shadow-2xl shadow-blue-600/50">
              <Hexagon size={36} className="text-white"/>
            </div>
            <div className="absolute -top-1.5 -right-1.5 w-6 h-6 bg-blue-400 rounded-full border-2 border-[#0a0f1e] flex items-center justify-center">
              <div className="w-2.5 h-2.5 bg-white rounded-full animate-pulse"/>
            </div>
          </div>
          <h1 className="text-4xl font-black text-white tracking-tight mb-2">BASE<span className="text-blue-400">.</span>ANALYTICS</h1>
          <p className="text-blue-300/60 text-sm">Your onchain identity on Base · Farm XP · Climb the leaderboard</p>
        </div>
        <div className="bg-[#0d1628] border border-blue-500/25 rounded-3xl p-5 mb-4 shadow-xl shadow-blue-900/30">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-2">
              <div className="w-7 h-7 bg-blue-500/20 rounded-xl flex items-center justify-center"><Star size={13} className="text-blue-400"/></div>
              <span className="text-[10px] font-black text-blue-400/70 uppercase tracking-widest">{SEASON_NAME}</span>
            </div>
            <span className="text-[10px] font-black text-blue-300 bg-blue-500/15 border border-blue-500/30 px-2.5 py-1 rounded-lg">{getDaysLeft()}d left</span>
          </div>
          <div className="mb-4">
            <p className="text-[10px] font-black text-blue-400/50 uppercase tracking-widest mb-1">SEASON PROGRESS</p>
            <p className="text-5xl font-black text-white">{getSeasonPct()}<span className="text-2xl text-blue-400/40">%</span></p>
          </div>
          <div className="w-full bg-blue-950/60 rounded-full h-1.5 overflow-hidden border border-blue-800/40">
            <div className="h-full bg-linear-to-br from-blue-500 to-blue-400 rounded-full" style={{width:`${getSeasonPct()}%`,transition:'width 2s ease-out'}}/>
          </div>
          <div className="mt-4 space-y-2">
            {[
              {icon:<Trophy size={14} className="text-blue-400"/>,label:'Achievement Badges',value:'11 Categories'},
              {icon:<Target size={14} className="text-blue-300"/>,label:'Weekly Quests',value:`${WEEKLY_QUESTS.length} Available`},
              {icon:<Zap size={14} className="text-blue-400"/>,label:'XP Farming',value:'Carry-over weekly'},
            ].map((r,i)=>(
              <div key={i} className="flex items-center justify-between bg-blue-950/40 rounded-xl px-3 py-2.5 border border-blue-800/30">
                <div className="flex items-center gap-2.5">{r.icon}<span className="text-xs text-blue-100/80 font-bold">{r.label}</span></div>
                <span className="text-xs font-black text-blue-400">{r.value}</span>
              </div>
            ))}
          </div>
        </div>
        <button onClick={()=>setShowModal(true)} disabled={loading}
          className="w-full bg-blue-600 hover:bg-blue-500 active:scale-[0.98] text-white py-4 rounded-2xl font-black text-base flex items-center justify-center gap-3 transition-all shadow-2xl shadow-blue-600/40 mb-3 disabled:opacity-60">
          {loading?<RefreshCcw className="animate-spin" size={20}/>:<Wallet size={20}/>}
          {loading?"Scanning wallet...":"Connect & Check Score"}
        </button>
        <p className="text-center text-[10px] text-blue-400/40 flex items-center justify-center gap-1.5"><Droplets size={9}/>Gas fees sponsored by Coinbase Paymaster</p>
      </div>
      {showModal&&(
        <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-4 bg-black/80 backdrop-blur-md">
          <div className="bg-[#0d1628] border border-blue-500/25 rounded-3xl w-full max-w-sm p-6 relative shadow-2xl shadow-blue-900/40">
            <button onClick={()=>setShowModal(false)} className="absolute top-4 right-4 text-blue-400/50 hover:text-white w-8 h-8 flex items-center justify-center rounded-xl bg-blue-950/60 transition-colors"><X size={16}/></button>
            <div className="flex items-center gap-3 mb-5">
              <div className="w-10 h-10 bg-blue-600 rounded-2xl flex items-center justify-center shadow-lg shadow-blue-600/40"><Hexagon size={20} className="text-white"/></div>
              <div><h3 className="font-black text-white text-base">Connect Wallet</h3><p className="text-blue-300/50 text-xs mt-0.5">All transactions gas-free via Paymaster</p></div>
            </div>
            <div className="space-y-2">
              {[
                {type:'coinbase' as ConnectionType,label:'Coinbase Wallet',sub:'Best for gas sponsorship',emoji:'🔵',cls:'bg-blue-600 hover:bg-blue-500 border-blue-500/50'},
                {type:'metamask' as ConnectionType,label:'MetaMask',sub:'EVM compatible wallet',emoji:'🦊',cls:'bg-[#0d1628] hover:bg-blue-950/60 border-blue-700/30'},
                {type:'farcaster' as ConnectionType,label:'Farcaster',sub:'Social + onchain wallet',emoji:'🟣',cls:'bg-[#0d1628] hover:bg-blue-950/60 border-blue-700/30'},
              ].map(w=>(
                <button key={w.type} onClick={()=>handleConnect(w.type)}
                  className={`w-full flex items-center justify-between ${w.cls} border text-white p-4 rounded-2xl transition-all active:scale-[0.98] group`}>
                  <div className="flex items-center gap-3">
                    <span className="w-9 h-9 bg-white/10 rounded-xl flex items-center justify-center text-base">{w.emoji}</span>
                    <div className="text-left"><p className="font-black text-sm">{w.label}</p><p className="text-[10px] text-blue-300/50">{w.sub}</p></div>
                  </div>
                  <ChevronRight size={16} className="text-blue-400/50 group-hover:text-white transition-all"/>
                </button>
              ))}
            </div>
            {PAYMASTER_URL&&(
              <div className="mt-4 flex items-center justify-center gap-1.5 bg-blue-500/8 border border-blue-500/20 rounded-xl p-2.5">
                <Droplets size={11} className="text-blue-400"/>
                <p className="text-[10px] text-blue-400 font-bold">Coinbase Paymaster active — gas fees sponsored</p>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );

  // ── MAIN APP ──────────────────────────────────────────────────────────────
  return(
    <main className="min-h-screen bg-[#0a0f1e] text-white font-sans">
      <div className="fixed inset-0 pointer-events-none opacity-20" style={{backgroundImage:'linear-gradient(rgba(59,130,246,0.04) 1px,transparent 1px),linear-gradient(90deg,rgba(59,130,246,0.04) 1px,transparent 1px)',backgroundSize:'60px 60px'}}/>

      {toast&&(
        <div className="fixed bottom-4 left-4 right-4 sm:left-auto sm:right-6 sm:w-80 z-50 bg-linear-to-br from-blue-600 to-blue-700 text-white px-5 py-4 rounded-2xl shadow-2xl shadow-blue-600/40 flex items-start gap-3" style={{animation:'slideUp 0.3s ease-out'}}>
          <BadgeCheck size={20} className="shrink-0 mt-0.5"/>
          <div className="flex-1 min-w-0">
            <p className="font-bold text-sm">{toast.msg}</p>
            {toast.hash&&<a href={`https://basescan.org/tx/${toast.hash}`} target="_blank" rel="noreferrer" className="text-blue-200 text-xs underline hover:text-white">View on BaseScan ↗</a>}
          </div>
          <button onClick={()=>setToast(null)} className="shrink-0 bg-white/10 hover:bg-white/20 p-1.5 rounded-xl transition-colors"><X size={13}/></button>
        </div>
      )}

      <header className="sticky top-0 z-40 bg-[#0a0f1e]/95 backdrop-blur-xl border-b border-blue-500/15">
        <div className="max-w-7xl mx-auto px-3 sm:px-6 h-14 flex items-center justify-between gap-3">
          <div className="flex items-center gap-2.5 min-w-0">
            <div className="w-8 h-8 bg-linear-to-br from-blue-500 to-blue-700 rounded-xl flex items-center justify-center shadow-lg shadow-blue-600/40 shrink-0"><Hexagon size={16} className="text-white"/></div>
            <span className="font-black text-sm sm:text-base text-white truncate">BASE<span className="text-blue-400">.</span>ANALYTICS</span>
          </div>
          <div className="flex items-center gap-1.5 sm:gap-2 shrink-0">
            <div className="hidden sm:flex items-center gap-1.5 bg-blue-950/60 border border-blue-500/20 rounded-xl px-2.5 py-1.5">
              <div className="w-1.5 h-1.5 bg-blue-400 rounded-full animate-pulse"/>
              <span className="text-[10px] font-black text-blue-300 whitespace-nowrap">{SEASON_NAME}</span>
              <span className="text-blue-700 mx-0.5">·</span>
              <span className="text-[10px] text-blue-400/50">{getDaysLeft()}d</span>
            </div>
            <div className="flex items-center gap-1 bg-blue-500/10 border border-blue-500/20 rounded-xl px-2.5 py-1.5">
              <Zap size={11} className="text-blue-400"/>
              <span className="text-[10px] font-black text-blue-300">{weeklyXP}</span>
              <span className="text-[9px] text-blue-500 hidden sm:inline">XP</span>
            </div>
            {sponsored>0&&<div className="hidden sm:flex items-center gap-1 bg-blue-500/8 border border-blue-500/15 rounded-xl px-2.5 py-1.5"><Droplets size={11} className="text-blue-400"/><span className="text-[10px] text-blue-400 font-bold">{sponsored}</span></div>}
            <button onClick={handleDisconnect} className="p-2 bg-blue-950/60 border border-blue-700/30 rounded-xl text-blue-400/60 hover:text-white hover:border-blue-500/40 transition-all"><Power size={14}/></button>
          </div>
        </div>
      </header>

      <div className="max-w-7xl mx-auto px-3 sm:px-6 pt-4 pb-24">
        {/* Tabs */}
        <div className="flex bg-[#0d1628] border border-blue-500/20 p-1 rounded-2xl mb-5 overflow-x-auto gap-0.5 no-scrollbar">
          {[
            {id:'dashboard',icon:<BarChart3 size={13}/>,label:'Dashboard'},
            {id:'achievements',icon:<Trophy size={13}/>,label:'Badges'},
            {id:'quests',icon:<Target size={13}/>,label:`Quests${doneQuests>0?` · ${doneQuests}`:''}`},
            {id:'leaderboard',icon:<Users size={13}/>,label:'Rankings'},
            {id:'basehub',icon:<BookOpen size={13}/>,label:'Ecosystem'},
          ].map(t=>(
            <button key={t.id} onClick={()=>setTab(t.id as typeof tab)}
              className={`flex items-center justify-center gap-1.5 py-2 px-3 sm:px-4 rounded-xl font-bold text-[11px] sm:text-xs whitespace-nowrap flex-1 transition-all ${tab===t.id?'bg-blue-600 text-white shadow-lg shadow-blue-600/30':'text-blue-400/50 hover:text-blue-300 hover:bg-blue-950/60'}`}>
              {t.icon}<span className="hidden sm:inline">{t.label}</span><span className="sm:hidden">{t.label.split(' ')[0]}</span>
            </button>
          ))}
        </div>

        {/* ═══ DASHBOARD ═══ */}
        {tab==='dashboard'&&(
          <div className="space-y-4">

            {/* Wallet Health Card */}
            <div className="bg-[#0d1628] border border-blue-500/20 rounded-3xl overflow-hidden shadow-xl shadow-blue-900/20">
              <div className="h-0.5 bg-linear-to-br from-blue-600 via-blue-400 to-blue-600"/>
              <div className="p-5">
                <div className="flex flex-col sm:flex-row items-start sm:items-center gap-4 justify-between">
                  <div className="flex items-center gap-4">
                    <div className="relative w-16 h-16 shrink-0">
                      <svg width="64" height="64" viewBox="0 0 64 64">
                        <circle cx="32" cy="32" r="26" fill="none" stroke="rgba(59,130,246,0.1)" strokeWidth="6"/>
                        <circle cx="32" cy="32" r="26" fill="none" stroke="#3b82f6" strokeWidth="6" strokeLinecap="round"
                          strokeDasharray={`${2*Math.PI*26}`}
                          strokeDashoffset={`${2*Math.PI*26*(1-wallet.walletHealthScore/100)}`}
                          transform="rotate(-90 32 32)"
                          style={{filter:'drop-shadow(0 0 4px rgba(59,130,246,0.6))',transition:'stroke-dashoffset 1s ease'}}/>
                        <text x="32" y="36" textAnchor="middle" fill="#60a5fa" fontSize="12" fontWeight="800" fontFamily="monospace">{wallet.walletHealthScore}</text>
                      </svg>
                    </div>
                    <div>
                      <div className="flex items-center gap-2 mb-1">
                        <span className="text-xs font-black text-blue-400/60 uppercase tracking-widest">Wallet Health</span>
                        <span className="text-xs font-black text-white bg-blue-500/15 border border-blue-500/25 px-2 py-0.5 rounded-full">{wallet.walletHealthLabel}</span>
                      </div>
                      <p className="text-blue-100/70 text-xs leading-relaxed max-w-sm">{wallet.recommendation}</p>
                    </div>
                  </div>
                  <div className="grid grid-cols-3 gap-2 w-full sm:w-auto">
                    {[
                      {l:'Active Days',v:wallet.uniqueDays,c:'text-blue-400'},
                      {l:'Months',v:wallet.activeMonths,c:'text-blue-300'},
                      {l:'Streak',v:`${wallet.currentStreak}d`,c:'text-blue-400'},
                    ].map((s,i)=>(
                      <div key={i} className="bg-blue-950/40 border border-blue-800/30 rounded-xl p-2.5 text-center">
                        <p className={`font-black text-lg ${s.c}`}>{s.v}</p>
                        <p className="text-[9px] text-blue-400/40 uppercase font-bold mt-0.5">{s.l}</p>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </div>

            {/* Daily check-in */}
            <div className={`bg-[#0d1628] border rounded-3xl overflow-hidden ${checkedToday?'border-blue-400/40':'border-blue-500/20'}`}>
              <div className={`h-0.5 ${checkedToday?'bg-linear-to-br from-blue-400 to-blue-300':'bg-linear-to-br from-blue-600 to-blue-500'}`}/>
              <div className="p-5 flex flex-col sm:flex-row sm:items-center gap-4 justify-between">
                <div className="flex items-center gap-4">
                  <div className={`w-12 h-12 rounded-2xl flex items-center justify-center shrink-0 border ${checkedToday?'bg-blue-400/15 border-blue-400/30':'bg-blue-600/15 border-blue-500/25'}`}>
                    <Flame size={22} className={checkedToday?'text-blue-300':'text-blue-400'}/>
                  </div>
                  <div>
                    <p className="font-black text-white text-base">{checkedToday?`Day ${streak} streak 🔥`:'Daily Check-In Available'}</p>
                    <p className={`text-xs mt-0.5 ${checkedToday?'text-blue-300/60':'text-blue-400/40'}`}>{checkedToday?'Recorded immutably on Base.':'Sign once · earn XP · unlock multipliers'}</p>
                    <div className="flex items-center gap-1.5 mt-2">
                      {Array.from({length:Math.min(streak,7)}).map((_,i)=>(
                        <div key={i} className={`w-5 h-5 rounded-lg flex items-center justify-center text-[10px] ${i<streak?'bg-blue-500/20 border border-blue-500/30':'bg-white/5 border border-white/8'}`}>{i<streak?'🔥':'·'}</div>
                      ))}
                      {streak>7&&<span className="text-[10px] text-blue-400/40 font-bold">+{streak-7}</span>}
                    </div>
                  </div>
                </div>
                <div className="flex flex-col items-stretch sm:items-end gap-1 shrink-0">
                  {connType==='farcaster'?(
                    <button onClick={()=>doNativeTx('checkin')} disabled={checkedToday||!!minting}
                      className={`py-3 px-6 rounded-2xl font-black text-sm transition-all ${checkedToday?'bg-blue-500/10 text-blue-300 cursor-default border border-blue-500/20':'bg-blue-600 hover:bg-blue-500 text-white shadow-lg shadow-blue-600/30 active:scale-95'}`}>
                      {minting==='checkin'?<RefreshCcw className="animate-spin mx-auto" size={14}/>:checkedToday?'✓ Secured Today':'Check In'}
                    </button>
                  ):checkedToday?(
                    <button disabled className="py-3 px-6 rounded-2xl font-black text-sm bg-blue-500/10 text-blue-300 border border-blue-500/20">✓ Secured Today</button>
                  ):(
                    <Transaction key={`ci-${txKeys.checkin}`} chainId={base.id} calls={ciCall} capabilities={txCaps}
                      onStatus={s=>{if(s.statusName==='success'){setCheckedToday(true);setStreak(v=>v+1);setSponsored(v=>v+1);showToast('✅ Onchain check-in secured!',s.statusData.transactionReceipts?.[0]?.transactionHash||'');setTxKeys(k=>({...k,checkin:(k.checkin||0)+1}));}}}>
                      <TransactionButton className="py-3 px-6 rounded-2xl font-black text-sm bg-blue-600 hover:bg-blue-500 text-white transition-all w-full" text="Check In"/>
                    </Transaction>
                  )}
                  <p className="text-[9px] text-blue-400/40 flex items-center justify-center gap-1 mt-0.5"><Droplets size={8}/>Gas Sponsored</p>
                </div>
              </div>
            </div>

            {/* Score + Heatmap */}
            <div className="bg-[#0d1628] border border-blue-500/20 rounded-3xl overflow-hidden shadow-xl shadow-blue-900/20">
              <div className="h-0.5 bg-linear-to-br from-blue-600 via-blue-400 to-blue-600"/>
              <div className="p-5 sm:p-6">
                <div className="flex flex-col lg:flex-row lg:items-start lg:justify-between gap-5 mb-6">
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-2 mb-3">
                      <span className="text-[10px] font-black text-blue-400/60 uppercase tracking-widest">Onchain Score</span>
                      <div className="flex gap-1">
                        {([['w','Cast'],['t','Post'],['n','Share']] as const).map(([pl,lbl])=>(
                          <button key={pl} onClick={()=>shareScore(pl)} className="bg-blue-950/60 hover:bg-blue-900/60 border border-blue-700/30 text-blue-400/60 px-2 py-1 rounded-lg text-[10px] font-bold flex items-center gap-1 transition-all">
                            {pl==='w'?<Send size={9}/>:pl==='t'?<Twitter size={9}/>:<Share2 size={9}/>}{lbl}
                          </button>
                        ))}
                      </div>
                    </div>
                    <div className="flex items-baseline gap-1">
                      <span className="text-7xl sm:text-8xl font-black text-white tracking-tighter leading-none">{wallet.score}</span>
                      <span className="text-2xl text-blue-400/30 font-black">/100</span>
                    </div>
                    <p className="text-blue-400 font-black text-base mt-2">{wallet.walletRank}</p>
                    <div className="mt-4 space-y-1.5 max-w-xs">
                      {Object.entries(wallet.scoreComponents).map(([k,v],i)=>{
                        const maxes:{[k:string]:number}={txActivity:25,consistency:20,longevity:15,streak:15,volume:10,diversity:10,defiUsage:5};
                        const pct=Math.round((v/(maxes[k]||1))*100);
                        const labels:{[k:string]:string}={txActivity:'Activity',consistency:'Consistency',longevity:'Longevity',streak:'Streak',volume:'Volume',diversity:'Diversity',defiUsage:'DeFi'};
                        return(
                          <div key={i} className="flex items-center gap-2">
                            <span className="text-[10px] text-blue-400/40 w-20 font-bold shrink-0">{labels[k]||k}</span>
                            <div className="flex-1 bg-blue-950/60 rounded-full h-1.5 overflow-hidden border border-blue-800/20">
                              <div className="h-full bg-linear-to-br from-blue-600 to-blue-400 rounded-full" style={{width:`${pct}%`,transition:'width 1.5s ease-out',filter:'drop-shadow(0 0 3px rgba(59,130,246,0.4))'}}/>
                            </div>
                            <span className="text-[10px] text-blue-400/50 w-5 text-right shrink-0">{v.toFixed(0)}</span>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                  <div className="shrink-0">
                    {selDay?(
                      <div className="bg-blue-950/40 border border-blue-700/30 rounded-2xl px-5 py-4 text-center">
                        <p className="text-[10px] text-blue-400/50 font-bold uppercase tracking-wide">{selDay.date}</p>
                        <p className="text-3xl font-black text-blue-400 mt-1">{selDay.count}</p>
                        <p className="text-[10px] text-blue-400/40 font-bold">transactions</p>
                      </div>
                    ):(
                      <div className="flex items-center gap-2 opacity-30">
                        <MousePointerClick size={14} className="text-blue-400"/>
                        <span className="text-[10px] text-blue-400/50 uppercase font-bold">Click a cell</span>
                      </div>
                    )}
                  </div>
                </div>
                {/* Heatmap — active days in BLUE */}
                <div ref={scrollRef} className="overflow-x-auto pb-2 no-scrollbar">
                  <div className="grid grid-flow-col gap-1 mb-1 min-w-max auto-cols-[11px]">
                    {wallet.weekLabels.map((m,i)=><div key={i} className="text-[8px] font-bold text-blue-400/40 uppercase overflow-visible whitespace-nowrap">{m}</div>)}
                  </div>
                  <div className="grid grid-rows-7 grid-flow-col gap-1 h-24 min-w-max">
                    {wallet.dailyStats.map((s,i)=>(
                      <div key={i} onClick={()=>setSelDay(s)} title={`${s.date}: ${s.count} txs`}
                        className="w-3 h-3 rounded-sm cursor-pointer transition-all hover:scale-125 hover:ring-1 hover:ring-blue-400"
                        style={s.count>0?{background:`rgba(59,130,246,${0.2+s.intensity*0.2})`,boxShadow:s.intensity>=3?'0 0 4px rgba(59,130,246,0.5)':'none',border:'1px solid rgba(59,130,246,0.3)'}:{background:'rgba(30,41,59,0.6)',border:'1px solid rgba(59,130,246,0.08)'}}/>
                    ))}
                  </div>
                  <div className="flex items-center gap-2 mt-2">
                    <span className="text-[9px] text-blue-400/30 font-bold">Less</span>
                    {[0.2,0.4,0.6,0.8,1.0].map((o,i)=>(
                      <div key={i} className="w-3 h-3 rounded-sm border border-blue-500/20" style={{background:`rgba(59,130,246,${o})`}}/>
                    ))}
                    <span className="text-[9px] text-blue-400/30 font-bold">More</span>
                  </div>
                </div>
              </div>
            </div>

            {/* Wallet Intelligence Grid */}
            <div>
              <p className="text-[10px] font-black text-blue-400/40 uppercase tracking-widest mb-3 flex items-center gap-2"><BarChart3 size={12}/>Wallet Intelligence</p>
              <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 xl:grid-cols-5 gap-2 sm:gap-3">
                <div className="bg-[#0d1628] border border-blue-500/20 rounded-2xl p-4 col-span-2 flex items-center gap-3 overflow-hidden shadow-lg shadow-blue-900/20">
                  <div className="w-12 h-12 bg-blue-600/20 border border-blue-500/30 rounded-2xl flex items-center justify-center shrink-0"><User size={22} className="text-blue-400"/></div>
                  <div className="min-w-0">
                    <p className="font-black text-white text-base sm:text-lg truncate">{wallet.basename||`${wallet.address.slice(0,8)}...${wallet.address.slice(-4)}`}</p>
                    <p className="text-[10px] text-blue-400/50 uppercase font-bold truncate mt-0.5">{wallet.walletRank}</p>
                    {wallet.basename&&<span className="inline-flex items-center gap-1 text-[9px] font-black text-blue-300 bg-blue-500/10 border border-blue-500/20 px-2 py-0.5 rounded-full mt-1.5"><BadgeCheck size={9}/>Verified Basename</span>}
                  </div>
                </div>
                <div className="bg-linear-to-br from-blue-600/20 to-blue-800/10 border border-blue-500/30 rounded-2xl p-3 sm:p-4 col-span-2 sm:col-span-1 shadow-lg shadow-blue-900/20">
                  <div className="mb-2"><DollarSign size={15} className="text-blue-400"/></div>
                  <p className="font-black text-white text-lg sm:text-xl">${wallet.portfolioValueUSD.toLocaleString('en-US',{maximumFractionDigits:0})}</p>
                  <p className="text-[9px] text-blue-400/50 uppercase font-bold tracking-wide mt-0.5">Portfolio Value</p>
                </div>
                {[
                  {l:'ETH Balance',       v:`${wallet.balance} Ξ`,                   i:<CreditCard size={15} className="text-blue-400"/>},
                  {l:'Days on Base',       v:wallet.daysOnBase.toLocaleString(),       i:<Calendar size={15} className="text-blue-300"/>},
                  {l:'Active Days ✅',     v:wallet.uniqueDays.toString(),             i:<Sun size={15} className="text-blue-400"/>},
                  {l:'Active Weeks ✅',    v:wallet.activeWeeks.toString(),            i:<Calendar size={15} className="text-blue-300"/>},
                  {l:'Active Months ✅',   v:wallet.activeMonths.toString(),           i:<Calendar size={15} className="text-blue-400"/>},
                  {l:'Current Streak ✅',  v:`${wallet.currentStreak}d`,              i:<Flame size={15} className="text-blue-300"/>},
                  {l:'Longest Streak ✅',  v:`${wallet.longestStreak}d`,              i:<Trophy size={15} className="text-blue-400"/>},
                  {l:'Total Txs',          v:wallet.txCount.toLocaleString(),          i:<Layers size={15} className="text-blue-300"/>},
                  {l:'Token Swaps',        v:wallet.swapCount.toLocaleString(),        i:<ArrowRightLeft size={15} className="text-blue-400"/>},
                  {l:'Unique Tokens',      v:wallet.tokensSwapped.toString(),          i:<Coins size={15} className="text-blue-300"/>},
                  {l:'DeFi Interactions',  v:wallet.defiInteractions.toLocaleString(), i:<TrendingUp size={15} className="text-blue-400"/>},
                  {l:'ETH Volume Sent',    v:`${wallet.ethVolume} Ξ`,                 i:<ArrowRightLeft size={15} className="text-blue-300"/>},
                  {l:'ETH Received',       v:`${wallet.ethReceived} Ξ`,               i:<Gift size={15} className="text-blue-400"/>},
                  {l:'NFTs Held',          v:wallet.nftCount.toLocaleString(),         i:<Sparkles size={15} className="text-blue-300"/>},
                  {l:'Contract Txs',       v:wallet.contractInteractions.toLocaleString(),i:<FileCode size={15} className="text-blue-400"/>},
                  {l:'Unique Contracts',   v:wallet.uniqueContracts.toLocaleString(),  i:<Database size={15} className="text-blue-300"/>},
                  {l:'Avg Tx / Day',       v:wallet.avgTxPerDay.toString(),            i:<BarChart3 size={15} className="text-blue-400"/>},
                  {l:'ERC-20 Txs',         v:wallet.erc20Txs.toLocaleString(),         i:<Coins size={15} className="text-blue-300"/>},
                  {l:'NFT Txs',            v:wallet.erc721Txs.toLocaleString(),        i:<Palette size={15} className="text-blue-400"/>},
                  {l:'Most Active Month',  v:wallet.mostActiveMonth,                   i:<Clock size={15} className="text-blue-300"/>},
                  {l:'First Transaction',  v:wallet.firstTx,                           i:<Star size={15} className="text-blue-400"/>},
                  {l:'Last Transaction',   v:wallet.lastTx,                            i:<Clock size={15} className="text-blue-300"/>},
                  {l:'Onchain Streak',     v:`${streak}d`,                             i:<Zap size={15} className="text-blue-400"/>},
                  {l:'Minted Badges',      v:mintedCount.toString(),                   i:<Trophy size={15} className="text-blue-300"/>},
                  {l:'XP Boosts',          v:boosts.toString(),                        i:<Rocket size={15} className="text-blue-400"/>},
                  {l:'Weekly XP',          v:weeklyXP.toString(),                      i:<Zap size={15} className="text-blue-300"/>},
                  {l:'Wallet Health',      v:`${wallet.walletHealthScore}/100`,        i:<ShieldCheck size={15} className="text-blue-400"/>},
                ].map((s,i)=>(
                  <div key={i} className="bg-[#0d1628] border border-blue-500/15 rounded-2xl p-3 sm:p-4 hover:border-blue-500/35 hover:bg-blue-950/40 transition-all group shadow-sm shadow-blue-900/10">
                    <div className="mb-2 group-hover:scale-110 transition-transform w-fit">{s.i}</div>
                    <p className="font-black text-white text-sm sm:text-base truncate leading-tight">{s.v}</p>
                    <p className="text-[9px] text-blue-400/40 uppercase font-bold tracking-wide mt-0.5 truncate">{s.l}</p>
                  </div>
                ))}
              </div>
            </div>

            {/* Action Cards */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-3 sm:gap-4">
              {/* Referral */}
              <div className="bg-[#0d1628] border border-blue-500/20 rounded-2xl p-5 shadow-lg shadow-blue-900/20">
                <div className="flex items-start justify-between mb-3">
                  <div className="flex items-center gap-2"><Gift size={18} className="text-blue-400"/><span className="font-black text-white">Referral Program</span></div>
                  <span className="text-[10px] font-bold text-blue-300 bg-blue-500/10 border border-blue-500/20 px-2 py-1 rounded-lg">+50 XP per ref</span>
                </div>
                <p className="text-xs text-blue-300/50 mb-4">Share your link. Friends who connect earn you bonus Season XP.</p>
                <div className="flex gap-2">
                  <div className="flex-1 min-w-0 bg-blue-950/40 border border-blue-800/30 rounded-xl px-3 py-2.5 text-xs font-mono text-blue-300/60 truncate">{APP_URL_WEB}?ref={ref}</div>
                  <button onClick={()=>{navigator.clipboard.writeText(`${APP_URL_WEB}?ref=${ref}`);setRefCopied(true);setTimeout(()=>setRefCopied(false),2000);}}
                    className={`shrink-0 px-4 py-2.5 rounded-xl font-black text-xs flex items-center gap-1.5 transition-all active:scale-95 ${refCopied?'bg-blue-400 text-white':'bg-blue-600 hover:bg-blue-500 text-white shadow-lg shadow-blue-600/25'}`}>
                    {refCopied?<CheckCircle size={13}/>:<Copy size={13}/>}{refCopied?'Done!':'Copy'}
                  </button>
                </div>
              </div>

              {/* REAL Challenge */}
              <div className="bg-[#0d1628] border border-blue-500/20 rounded-2xl p-5 shadow-lg shadow-blue-900/20">
                <div className="flex items-center gap-2 mb-3"><Swords size={18} className="text-blue-400"/><span className="font-black text-white">Wallet Challenge</span></div>
                <p className="text-xs text-blue-300/50 mb-4">Enter any wallet to compare real onchain scores.</p>
                <div className="flex gap-2 mb-3">
                  <input value={challenge} onChange={e=>setChallenge(e.target.value)} onKeyDown={e=>e.key==='Enter'&&handleChallenge()}
                    placeholder="0x..." className="flex-1 min-w-0 bg-blue-950/40 border border-blue-800/30 rounded-xl px-3 py-2.5 text-xs font-mono text-white placeholder-blue-400/30 outline-none focus:border-blue-500/50 transition-all"/>
                  <button onClick={handleChallenge} disabled={challengeLoading}
                    className="shrink-0 bg-blue-600 hover:bg-blue-500 disabled:bg-blue-800 text-white px-5 py-2.5 rounded-xl font-black text-xs transition-all active:scale-95 flex items-center gap-1">
                    {challengeLoading?<RefreshCcw size={12} className="animate-spin"/>:'Go'}
                  </button>
                </div>
                {challengeResult&&(
                  <div className="grid grid-cols-2 gap-2">
                    <div className={`rounded-xl p-3 text-center border ${wallet.score>=challengeResult.score?'bg-blue-600/10 border-blue-500/25':'bg-blue-950/40 border-blue-800/20'}`}>
                      <p className="text-[10px] text-blue-400/50 uppercase font-bold">You</p>
                      <p className="text-3xl font-black text-blue-400 my-1">{wallet.score}</p>
                      <p className="text-[9px] text-blue-300/50">{wallet.uniqueDays} days</p>
                      {wallet.score>challengeResult.score&&<p className="text-[10px] font-black text-blue-300 mt-1">WINNER 🏆</p>}
                    </div>
                    <div className={`rounded-xl p-3 text-center border ${challengeResult.score>wallet.score?'bg-blue-900/30 border-blue-600/25':'bg-blue-950/40 border-blue-800/20'}`}>
                      <p className="text-[10px] text-blue-400/50 uppercase font-bold">{challengeResult.address.slice(0,6)}...</p>
                      <p className="text-3xl font-black text-blue-200 my-1">{challengeResult.score}</p>
                      <p className="text-[9px] text-blue-300/50">{challengeResult.days} days</p>
                      {challengeResult.score>wallet.score&&<p className="text-[10px] font-black text-blue-300 mt-1">WINNER 🏆</p>}
                    </div>
                  </div>
                )}
              </div>

              {/* XP Booster */}
              <div className="bg-[#0d1628] border border-blue-500/20 rounded-2xl p-5 flex flex-col sm:flex-row items-center gap-4 justify-between shadow-lg shadow-blue-900/20">
                <div className="flex items-center gap-3 w-full sm:w-auto">
                  <div className="w-12 h-12 bg-blue-600/15 rounded-2xl border border-blue-500/20 flex items-center justify-center shrink-0"><Rocket size={22} className="text-blue-400"/></div>
                  <div>
                    <p className="font-black text-white text-base">XP Booster</p>
                    <div className="flex gap-2 mt-1.5">
                      <span className="bg-blue-950/60 border border-blue-800/30 rounded-lg px-2.5 py-1 text-xs"><span className="text-blue-400 font-black">{boosts}</span><span className="text-blue-400/40 ml-1">boosts</span></span>
                      <span className="bg-blue-950/60 border border-blue-800/30 rounded-lg px-2.5 py-1 text-xs"><span className="text-blue-300 font-black">{streak}d</span><span className="text-blue-400/40 ml-1">streak</span></span>
                    </div>
                  </div>
                </div>
                <div className="w-full sm:w-auto sm:min-w-[140px] text-center">
                  {connType==='farcaster'?(
                    <button onClick={()=>doNativeTx('boost')} disabled={!!minting}
                      className={`w-full py-3 px-5 rounded-xl font-black text-sm transition-all active:scale-95 ${minting?'bg-blue-800/40 text-blue-400/40 cursor-not-allowed':'bg-blue-600 hover:bg-blue-500 text-white shadow-xl shadow-blue-600/30'}`}>
                      {minting==='boost'?<RefreshCcw className="animate-spin mx-auto" size={18}/>:'BOOST (+1)'}
                    </button>
                  ):(
                    <Transaction key={`boost-${txKeys.boost}`} chainId={base.id} calls={boostCall} capabilities={txCaps}
                      onStatus={s=>{if(s.statusName==='success'){setBoosts(b=>{const n=b+1;if(typeof window!=='undefined')localStorage.setItem(`base_boosts_${wallet.address.toLowerCase()}`,n.toString());return n;});setSponsored(v=>v+1);showToast('Boosted! 🎉',s.statusData.transactionReceipts?.[0]?.transactionHash||'');setTxKeys(k=>({...k,boost:(k.boost||0)+1}));}}}>
                      <TransactionButton className="w-full py-3 px-5 rounded-xl font-black text-sm bg-blue-600 hover:bg-blue-500 text-white shadow-xl shadow-blue-600/30 transition-all" text="BOOST (+1)"/>
                    </Transaction>
                  )}
                  <p className="text-[9px] text-blue-400/40 mt-1.5 flex items-center justify-center gap-1"><Droplets size={8}/>Gas Sponsored</p>
                </div>
              </div>

              {/* GM/GN */}
              <div className="bg-[#0d1628] border border-blue-500/20 rounded-2xl p-5 shadow-lg shadow-blue-900/20">
                <p className="font-black text-white mb-4 flex items-center gap-2"><Star size={15} className="text-blue-400"/>Community Vibes</p>
                <div className="grid grid-cols-2 gap-3">
                  {(['gm','gn'] as const).map(type=>(
                    <div key={type} className="text-center">
                      {connType==='farcaster'?(
                        <button onClick={()=>doNativeTx(type)} disabled={!!minting}
                          className={`w-full py-4 rounded-xl font-black text-xl transition-all active:scale-95 border ${minting?'opacity-40 cursor-not-allowed bg-blue-950/40 border-blue-800/20 text-blue-400/30':'bg-blue-950/40 hover:bg-blue-600/15 border-blue-800/20 hover:border-blue-500/30 text-white'}`}>
                          {minting===type?<RefreshCcw className="animate-spin mx-auto" size={18}/>:(type==='gm'?'☀️ GM':'🌙 GN')}
                        </button>
                      ):(
                        <Transaction key={`${type}-${txKeys[type]}`} chainId={base.id} calls={type==='gm'?gmCall:gnCall} capabilities={txCaps}
                          onStatus={s=>{if(s.statusName==='success'){showToast(type==='gm'?'GM! ☀️':'GN! 🌙',s.statusData.transactionReceipts?.[0]?.transactionHash||'');setSponsored(v=>v+1);if(type==='gm'&&typeof window!=='undefined')localStorage.setItem(`base_gm_${wallet.address.toLowerCase()}`,'true');setTxKeys(k=>({...k,[type]:(k[type]||0)+1}));}}}>
                          <TransactionButton className="w-full py-4 rounded-xl font-black text-xl bg-blue-950/40 hover:bg-blue-600/15 border border-blue-800/20 hover:border-blue-500/30 text-white transition-all" text={type==='gm'?'☀️ GM':'🌙 GN'}/>
                        </Transaction>
                      )}
                      <p className="text-[9px] text-blue-400/40 mt-1.5 flex items-center justify-center gap-1"><Droplets size={8}/>Gas Sponsored</p>
                    </div>
                  ))}
                </div>
              </div>
            </div>

            {/* Recent Activity */}
            <div>
              <p className="text-[10px] font-black text-blue-400/40 uppercase tracking-widest mb-3 flex items-center gap-2"><History size={12}/>Recent Activity</p>
              <div className="bg-[#0d1628] border border-blue-500/20 rounded-2xl overflow-hidden shadow-lg shadow-blue-900/20">
                {wallet.recentTxs.length>0?wallet.recentTxs.map((tx,i)=>(
                  <div key={i} className={`flex items-center justify-between p-3 sm:p-4 gap-3 hover:bg-blue-950/30 transition-colors ${i!==wallet.recentTxs.length-1?'border-b border-blue-800/20':''}`}>
                    <div className="flex items-center gap-3 min-w-0">
                      <div className="w-8 h-8 bg-blue-600/10 border border-blue-500/15 rounded-xl flex items-center justify-center shrink-0">
                        {tx.category==='erc721'?<Sparkles size={13} className="text-blue-300"/>:tx.category==='erc20'?<Coins size={13} className="text-blue-400"/>:<ArrowRightLeft size={13} className="text-blue-400"/>}
                      </div>
                      <div className="min-w-0">
                        <p className="text-xs font-black text-white uppercase truncate">{tx.category==='external'?'Contract Call':tx.category==='erc20'?'Token Transfer':tx.category==='erc721'?'NFT Transfer':'Transfer'}</p>
                        <p className="text-[10px] text-blue-400/40 truncate">{new Date(tx.metadata.blockTimestamp).toLocaleString()}</p>
                      </div>
                    </div>
                    <a href={`https://basescan.org/tx/${tx.hash}`} target="_blank" rel="noreferrer"
                      className="shrink-0 text-[10px] font-black text-blue-400 hover:text-blue-300 bg-blue-600/8 hover:bg-blue-600/15 border border-blue-500/20 px-3 py-1.5 rounded-xl flex items-center gap-1 transition-all whitespace-nowrap">
                      <ExternalLink size={9}/>{tx.value?`${parseFloat(tx.value.toFixed(4))} ${tx.asset}`:'View'}
                    </a>
                  </div>
                )):<p className="text-blue-400/30 text-sm text-center py-8">No recent transactions found.</p>}
              </div>
            </div>
          </div>
        )}

        {/* ═══ ACHIEVEMENTS ═══ */}
        {tab==='achievements'&&(
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
                const value=getCatValue(cat.id);
                let unlocked=0;for(let i=0;i<cat.thresholds.length;i++){if(value>=cat.thresholds[i])unlocked=i+1;}
                const mintedTier=mintedLevels[cat.id]||0;const canMint=unlocked>mintedTier;
                const nextThr=unlocked<cat.thresholds.length?cat.thresholds[unlocked]:cat.thresholds[cat.thresholds.length-1];
                const prog=unlocked===cat.thresholds.length?100:Math.min(100,(value/nextThr)*100);
                const toMint:number[]=[],toLevels:number[]=[];
                for(let i=mintedTier+1;i<=unlocked;i++){toLevels.push(i);toMint.push(getTargetTokenId(cat.baseId,cat.thresholds.length,i));}
                const isBatch=toMint.length>1;
                let mintCall2:{to:`0x${string}`;data:`0x${string}`}[]=[];
                if(toMint.length>0){const raw=isBatch?encodeFunctionData({abi:ACHIEVEMENTS_ABI,functionName:'mintBatchAchievements',args:[toMint.map(id=>BigInt(id))]}):encodeFunctionData({abi:ACHIEVEMENTS_ABI,functionName:'mintAchievement',args:[BigInt(toMint[0])]});mintCall2=[{to:ACHIEVEMENTS_CONTRACT as `0x${string}`,data:`${raw}${getBuilderSuffix()}` as `0x${string}`}];}
                let btnText=`${cat.tierNames[mintedTier]||'...'} Locked`;
                if(mintedTier===cat.thresholds.length)btnText='Fully Minted 👑';
                else if(canMint)btnText=isBatch?`Claim ${toMint.length} Badges 🚀`:`Mint ${cat.tierNames[mintedTier]}`;
                return(
                  <div key={cat.id} className="bg-[#0d1628] border border-blue-500/15 rounded-3xl p-5 flex flex-col hover:border-blue-500/30 transition-all shadow-lg shadow-blue-900/10">
                    <div className="flex justify-between items-start mb-4">
                      <div className="flex items-center gap-3">
                        <div className="w-11 h-11 bg-blue-950/60 border border-blue-800/30 rounded-2xl flex items-center justify-center text-2xl">{cat.icon}</div>
                        <div><p className="font-black text-white text-sm">{cat.name}</p><p className="text-[10px] text-blue-400/40 uppercase font-bold mt-0.5">{unlocked>0?cat.tierNames[unlocked-1]:'Unranked'} · L{unlocked}/{cat.thresholds.length}</p></div>
                      </div>
                      <div className="text-right"><p className="text-2xl font-black text-blue-400">{typeof value==='number'&&value<1?value.toFixed(3):value.toLocaleString()}</p><p className="text-[10px] text-blue-400/40 uppercase">{cat.unit}</p></div>
                    </div>
                    <div className="w-full bg-blue-950/60 rounded-full h-1.5 mb-1 overflow-hidden border border-blue-800/20">
                      <div className="h-full bg-linear-to-br from-blue-600 to-blue-400 rounded-full transition-all duration-1000" style={{width:`${prog}%`,filter:'drop-shadow(0 0 3px rgba(59,130,246,0.5))'}}/>
                    </div>
                    <p className="text-right text-[10px] text-blue-400/40 font-bold mb-5">
                      {unlocked===cat.thresholds.length?'Max Level 👑':`${typeof value==='number'&&value<1?value.toFixed(3):value.toLocaleString()} / ${typeof nextThr==='number'&&nextThr<1?nextThr.toFixed(3):nextThr.toLocaleString()}`}
                    </p>
                    <div className={`flex ${cat.thresholds.length===1?'justify-center':'justify-between'} items-end mb-5`}>
                      {cat.thresholds.map((_,idx)=>{
                        const tier=idx+1;const isEarned=unlocked>=tier;const isMinted2=mintedTier>=tier;
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
                        {mintedTier>0&&<div className="flex gap-1.5 shrink-0">
                          <button onClick={()=>shareAch(cat.name,cat.tierNames[mintedTier-1],'w')} className="bg-[#0d1628] border border-blue-500/15 hover:bg-blue-600/15 text-blue-400/50 p-3 rounded-xl transition-all"><Send size={13}/></button>
                          <button onClick={()=>shareAch(cat.name,cat.tierNames[mintedTier-1],'t')} className="bg-[#0d1628] border border-blue-500/15 hover:bg-blue-600/15 text-blue-400/50 p-3 rounded-xl transition-all"><Twitter size={13}/></button>
                        </div>}
                      </div>
                      {canMint&&<p className="text-[9px] text-blue-400/30 mt-2 text-center flex items-center justify-center gap-1"><Droplets size={8}/>Gas Sponsored via Coinbase Paymaster</p>}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* ═══ QUESTS ═══ */}
        {tab==='quests'&&(
          <div className="space-y-4">
            <div className="relative overflow-hidden bg-linear-to-br from-blue-700 via-blue-600 to-blue-800 rounded-3xl p-5 sm:p-7 border border-blue-500/30 shadow-2xl shadow-blue-900/40">
              <div className="absolute inset-0 opacity-10" style={{backgroundImage:'linear-gradient(rgba(255,255,255,0.1) 1px,transparent 1px),linear-gradient(90deg,rgba(255,255,255,0.1) 1px,transparent 1px)',backgroundSize:'32px 32px'}}/>
              <div className="absolute -right-8 -top-8 w-40 h-40 bg-white/5 rounded-full"/>
              <div className="relative flex flex-col sm:flex-row sm:items-center justify-between gap-5">
                <div>
                  <div className="flex items-center gap-2 mb-1.5"><Star size={14} className="text-blue-200"/><span className="text-xs font-black uppercase tracking-widest text-white/60">{SEASON_NAME}</span></div>
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
                  <div key={q.id} className={`rounded-2xl p-4 border flex items-center gap-4 justify-between transition-all ${done?'bg-blue-600/8 border-blue-500/25':'bg-[#0d1628] border-blue-500/15 hover:border-blue-500/25'}`}>
                    <div className="flex items-center gap-3 min-w-0">
                      <div className={`w-11 h-11 rounded-2xl flex items-center justify-center text-xl shrink-0 ${done?'bg-blue-500/15 border border-blue-500/25':'bg-blue-950/40 border border-blue-800/20'}`}>{done?'✅':q.icon}</div>
                      <div className="min-w-0">
                        <p className={`font-black text-sm truncate ${done?'text-blue-300':'text-white'}`}>{q.title}</p>
                        <p className="text-[10px] text-blue-400/40 truncate mt-0.5">{q.desc}</p>
                      </div>
                    </div>
                    <div className={`shrink-0 px-3 py-2 rounded-xl font-black text-xs border whitespace-nowrap ${done?'bg-blue-500/10 text-blue-300 border-blue-500/20':'bg-blue-950/40 text-blue-400 border-blue-800/20'}`}>+{q.xp} XP</div>
                  </div>
                );
              })}
            </div>
            <div className="bg-[#0d1628] border border-blue-500/15 rounded-2xl p-5">
              <p className="font-black text-white mb-4 flex items-center gap-2"><Zap size={15} className="text-blue-400"/>XP Multipliers & Season Rewards</p>
              <div className="space-y-2">
                {[
                  {l:'3-day check-in streak',b:'2× XP on all quests'},{l:'7-day check-in streak',b:'3× XP on all quests'},
                  {l:'Top 10 at season end',b:'Exclusive Genesis Badge NFT'},{l:'Refer 3+ friends',b:'+150 bonus XP + referral badge'},
                  {l:'All 10 weekly quests',b:'Season multiplier bonus'},{l:'Mint all 11 badges',b:'Hall of Fame status'},
                  {l:'Weekly XP resets Mon',b:'Past weeks carry to Total Season XP'},
                ].map((m,i)=>(
                  <div key={i} className="flex flex-col sm:flex-row sm:items-center justify-between bg-blue-950/30 rounded-xl p-3 border border-blue-800/20 gap-2">
                    <span className="text-xs text-blue-100/70">{m.l}</span>
                    <span className="text-xs font-black text-blue-400 sm:text-right shrink-0">{m.b}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* ═══ LEADERBOARD ═══ */}
        {tab==='leaderboard'&&(
          <div className="space-y-4">
            <div className="bg-[#0d1628] border border-blue-500/20 rounded-3xl overflow-hidden shadow-xl shadow-blue-900/20">
              <div className="h-0.5 bg-linear-to-br from-blue-600 via-blue-400 to-blue-600"/>
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
            {(()=>{const pos=leaderboard.findIndex(e=>e.address.toLowerCase()===wallet.address.toLowerCase());return pos>=0?(
              <div className="bg-[#0d1628] border border-blue-500/25 rounded-3xl overflow-hidden shadow-xl shadow-blue-900/20">
                <div className="h-0.5 bg-linear-to-br from-blue-600 to-blue-400"/>
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
                    {[{l:'Score',v:wallet.score+'/100',c:'text-blue-400'},{l:'Badges',v:String(mintedCount),c:'text-blue-300'},{l:'Streak',v:streak+'d',c:'text-blue-400'}].map((s,i)=>(
                      <div key={i} className="bg-blue-950/40 border border-blue-800/20 rounded-xl p-2.5 text-center">
                        <p className={`font-black text-base ${s.c}`}>{s.v}</p>
                        <p className="text-[9px] text-blue-400/40 uppercase font-bold mt-0.5">{s.l}</p>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            ):null;})()}
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
                    <span className="w-10">Rank</span><span>Wallet</span>
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
                      <div className="w-10">{medal?<span className="text-lg">{medal}</span>:<span className={`text-xs font-black ${idx<10?'text-blue-300/60':'text-blue-700'}`}>#{idx+1}</span>}</div>
                      <div className="min-w-0 pr-3">
                        <p className={`font-black text-sm truncate ${isMe?'text-blue-400':'text-white'}`}>
                          {e.basename||`${e.address.slice(0,8)}...${e.address.slice(-4)}`}
                          {isMe&&<span className="text-[9px] text-blue-500/60 ml-2 font-bold bg-blue-500/10 px-1.5 py-0.5 rounded">you</span>}
                        </p>
                        <p className="text-[9px] text-blue-400/40 font-bold mt-0.5">{e.rank}</p>
                      </div>
                      <div className="hidden sm:block w-16 text-right"><p className="text-xs font-black text-blue-300/60">{e.badges}</p><p className="text-[8px] text-blue-700 font-bold">badges</p></div>
                      <div className="w-24 text-right">
                        <p className={`text-base font-black ${isMe?'text-blue-400':'text-white'}`}>{((e.totalXP??e.weeklyXP??0)).toLocaleString()}</p>
                        <p className="text-[9px] text-blue-400/50 font-bold">+{e.weeklyXP} wk</p>
                      </div>
                      <div className="hidden sm:flex w-8 justify-center">{idx===0?<ChevronUp size={12} className="text-blue-400"/>:<ChevronDown size={12} className="text-blue-800"/>}</div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        )}

        {tab==='basehub'&&<BaseHub/>}
      </div>

      <style>{`
        @keyframes slideUp{from{transform:translateY(100%);opacity:0}to{transform:translateY(0);opacity:1}}
        .no-scrollbar::-webkit-scrollbar{display:none}
        .no-scrollbar{-ms-overflow-style:none;scrollbar-width:none}
      `}</style>
    </main>
  );
} 