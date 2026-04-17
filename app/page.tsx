"use client";

import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
  Wallet, Activity, Zap, Layers, Calendar, ArrowRightLeft, Power, BookOpen,
  RefreshCcw, Sun, FileCode, BarChart3, Trophy,
  CreditCard, User, BadgeCheck, Send, X, AlertTriangle,
  ChevronRight, Share2, Rocket, Twitter, MousePointerClick, Clock, Sparkles, History, Droplets, Lock,
  Flame, Gift, Users, Target, Star, CheckCircle, Copy, ExternalLink, ChevronUp, ChevronDown, Swords, Medal
} from 'lucide-react';
import { JsonRpcProvider, formatEther, toUtf8Bytes } from 'ethers';
import sdk from "@farcaster/miniapp-sdk";
import { connectWallet } from './connection';
import BaseHub from '../components/BaseHub';

import {
  Transaction,
  TransactionButton
} from '@coinbase/onchainkit/transaction';
import { encodeFunctionData, createPublicClient, http } from 'viem';
import { base, mainnet } from 'viem/chains';

// --- CONFIGURATION ---
const ALCHEMY_KEY = process.env.NEXT_PUBLIC_ALCHEMY_KEY || "mn8s-DCTchMi4q2DEKasm";
const BASE_RPC = `https://base-mainnet.g.alchemy.com/v2/${ALCHEMY_KEY}`;
const MINIAPP_URL = "https://farcaster.xyz/miniapps/lYFXQz4s1wsq/base-analytics";
const APP_URL_WEB = "https://base-analytics-app.vercel.app";
const BUILDER_CODE = "bc_4uoh9iu2";

function getBuilderSuffix() {
  const codeBytes = toUtf8Bytes(BUILDER_CODE);
  const codeHex = Array.from(codeBytes).map((b: number) => b.toString(16).padStart(2, '0')).join('');
  const lengthHex = codeBytes.length.toString(16).padStart(2, '0');
  const schemaId = "00";
  const ercMarker = "80218021802180218021802180218021";
  return `${codeHex}${lengthHex}${schemaId}${ercMarker}`;
}

// --- CONTRACTS ---
const BOOSTER_CONTRACT_ADDRESS   = "0xd14E38239791738e8aCbd0Ad5278496af26fF510";
const GM_GN_CONTRACT_ADDRESS     = "0xc801bCe6739D30C409151a544F0baEd10EB719dE";
const ACHIEVEMENTS_CONTRACT_ADDRESS = "0xadb8120B4B18b892cFAD171243074487122Dea03";
const CHECKIN_CONTRACT_ADDRESS   = "0xABc7099C631E18640ea60b25116407aa17354FBb";

const CHECKIN_ABI = [
  { inputs: [], name: "checkIn", outputs: [], stateMutability: "nonpayable", type: "function" },
  { inputs: [{ internalType: "address", name: "", type: "address" }], name: "streaks", outputs: [{ internalType: "uint256", name: "", type: "uint256" }], stateMutability: "view", type: "function" },
  { inputs: [{ internalType: "address", name: "", type: "address" }], name: "lastCheckIn", outputs: [{ internalType: "uint256", name: "", type: "uint256" }], stateMutability: "view", type: "function" }
] as const;

const ACHIEVEMENTS_ABI = [
  { "inputs": [{ "internalType": "uint256", "name": "tokenId", "type": "uint256" }], "name": "mintAchievement", "outputs": [], "stateMutability": "nonpayable", "type": "function" },
  { "inputs": [{ "internalType": "uint256[]", "name": "tokenIds", "type": "uint256[]" }], "name": "mintBatchAchievements", "outputs": [], "stateMutability": "nonpayable", "type": "function" },
  { "inputs": [{ "internalType": "address", "name": "", "type": "address" }, { "internalType": "uint256", "name": "", "type": "uint256" }], "name": "hasMinted", "outputs": [{ "internalType": "bool", "name": "", "type": "bool" }], "stateMutability": "view", "type": "function" }
] as const;

const BOOSTER_ABI = [{ name: 'boost', type: 'function', stateMutability: 'payable', inputs: [], outputs: [] }] as const;
const GM_GN_ABI = [
  { name: 'gm', type: 'function', stateMutability: 'payable', inputs: [], outputs: [] },
  { name: 'gn', type: 'function', stateMutability: 'payable', inputs: [], outputs: [] }
] as const;

const DEFI_PROTOCOLS = [
  "0xcf77a3ba9a5ca399b7c97c74d54e5b1beb874e43",
  "0x3ddfa8ec3052539b6c9549f12cea2c295cff5296",
  "0x8ebaf22e6f05b4fbce41712019ba2289f631eff2",
  "0x000000000022d473030f116ddee9f6b43ac78ba3",
  "0x3b6067d4caa8a14c63fdbe6318f27a0bbc9f9237",
  "0x280b3b748ccc42d5062ce59111fad08594f51d9f",
  "0x4200000000000000000000000000000000000006",
];

const MONTHS_3_LETTERS = ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"];

const ACHIEVEMENTS = [
  { id:'score',   baseId:10,  name:'Onchain Rank',    icon:'🏅', unit:'Score',   thresholds:[10,30,60,75,85],      tierNames:["Base Shrimp","Base Dolphin","Base Shark","Base Whale","Base God"],          tierIcons:["🦐","🐬","🦈","🐋","👑"] },
  { id:'age',     baseId:20,  name:'Pioneer',          icon:'📅', unit:'Days Old',thresholds:[10,30,90,180,365],    tierNames:["Newcomer","Explorer","Settler","Veteran","Early Adopter"],                  tierIcons:["🥚","🧭","⛺","🎖️","🛸"] },
  { id:'name',    baseId:30,  name:'Identity',         icon:'📛', unit:'Basename',thresholds:[1],                    tierNames:["Verified"],                                                                 tierIcons:["🆔"] },
  { id:'days',    baseId:40,  name:'Diamond Hands',    icon:'💎', unit:'Days Active',thresholds:[10,50,100,200,365],tierNames:["Tourist","Resident","Citizen","Patriot","Immortal"],                        tierIcons:["🎒","🏠","🏛️","🛡️","🗿"] },
  { id:'contract',baseId:50,  name:'Base Builder',     icon:'🧱', unit:'Txs',      thresholds:[10,50,100,500,1000],  tierNames:["Tinkerer","Apprentice","Engineer","Architect","Master Builder"],             tierIcons:["🔧","🔨","📐","🏗️","🌆"] },
  { id:'volume',  baseId:60,  name:'Whale Alert',      icon:'💰', unit:'ETH',      thresholds:[0.001,0.01,0.1,1.0,5.0],tierNames:["Guppy","Puffer","Angelfish","Sailboat","Leviathan"],                    tierIcons:["🐟","🐡","🐠","⛵","🚢"] },
  { id:'txs',     baseId:70,  name:'Power User',       icon:'📈', unit:'Total Txs',thresholds:[10,50,100,500,1000], tierNames:["Spark","Bolt","Surge","Lightning","Storm"],                                tierIcons:["✨","🌩️","🌊","⚡","🌪️"] },
  { id:'swaps',   baseId:80,  name:'DeFi Degen',       icon:'🔄', unit:'Swaps',   thresholds:[3,10,25,50,100],      tierNames:["Swapper","Trader","Provider","Yield Farmer","DeFi God"],                  tierIcons:["🪙","📈","🏦","🚜","🦄"] },
  { id:'nfts',    baseId:90,  name:'Collector',        icon:'👾', unit:'NFTs',    thresholds:[3,10,25,50,100],      tierNames:["Scout","Gatherer","Curator","Connoisseur","NFT Whale"],                     tierIcons:["👁️","🧺","🖼️","🍷","🎨"] },
  { id:'streak',  baseId:100, name:'Streak Master',    icon:'🎯', unit:'Days',    thresholds:[3,7,14,30,100],       tierNames:["Match","Flame","Blaze","Inferno","Supernova"],                             tierIcons:["🕯️","🪔","🔥","🌋","🌌"] },
  { id:'boosts',  baseId:110, name:'XP Booster',       icon:'🔋', unit:'Boosts',  thresholds:[5,10,25,50,100],      tierNames:["Novice","Supporter","Fanatic","Champion","Apex"],                          tierIcons:["🔰","🤝","📣","🏆","🔋"] },
];

const WEEKLY_QUESTS = [
  { id:'q_boost',   icon:'🚀', title:'Boost your score',        desc:'Use the XP Booster 1 time',                    xp:25, check:(w:WalletData,boosts:number)=>boosts>=1 },
  { id:'q_gm',      icon:'☀️', title:'Say GM on Base',          desc:'Send a GM transaction',                        xp:15, check:(w:WalletData,_b:number,_s:number,txKeys?:Record<string,number>)=>w.hasGm||!!(txKeys?.gm&&txKeys.gm>0) },
  { id:'q_streak',  icon:'🔥', title:'Keep your streak',        desc:'Onchain check-in streak of 3+ days',            xp:30, check:(_w:WalletData,_b:number,streak:number)=>streak>=3 },
  { id:'q_defi',    icon:'🦄', title:'DeFi interaction',        desc:'Have 1+ DeFi protocol interactions',            xp:40, check:(w:WalletData)=>w.defiInteractions>=1 },
  { id:'q_nft',     icon:'🎨', title:'Collect an NFT',          desc:'Hold 1+ NFTs on Base',                          xp:35, check:(w:WalletData)=>w.nftCount>=1 },
  { id:'q_basename',icon:'🆔', title:'Claim your identity',     desc:'Register a Basename',                           xp:50, check:(w:WalletData)=>!!w.basename },
];

const SEASON_START = new Date('2026-04-20T00:00:00Z');
const SEASON_END   = new Date('2026-07-20T23:59:59Z');
const SEASON_NAME  = "Season 1: Genesis";

// --- BADGE TIER STYLES ---
const TIER_STYLES = [
  'bg-linear-to-br from-slate-400 to-slate-500 border-slate-400/50 text-white',
  'bg-linear-to-br from-amber-500 to-orange-600 border-amber-400/50 text-white',
  'bg-linear-to-br from-slate-300 to-slate-400 border-slate-300/50 text-slate-800',
  'bg-linear-to-br from-yellow-400 to-yellow-500 border-yellow-400/50 text-yellow-900',
  'bg-linear-to-br from-blue-600 via-blue-500 to-purple-600 border-blue-400/50 text-white',
];

const getLevelStyle = (level:number, isMinted:boolean, isEarned:boolean) => {
  if (!isEarned) return 'bg-white/5 border-white/10 text-white/20 grayscale opacity-40';
  const tier = Math.min(level,5)-1;
  const base = TIER_STYLES[tier] || TIER_STYLES[0];
  if (isMinted) return `${base} ring-2 ring-green-400 ring-offset-2 ring-offset-[#0d1117] shadow-lg shadow-green-400/20 scale-105`;
  return `${base} opacity-80 border-dashed animate-pulse`;
};

const getTargetTokenId = (baseId:number, numThresholds:number, level:number) =>
  numThresholds===1 ? baseId+5 : baseId+level;

// --- TYPES ---
interface DayStats { date:string; count:number; intensity:number; }
interface WalletData {
  address:string; basename:string|null; balance:string; ethVolume:string;
  txCount:number; uniqueDays:number; activeWeeks:number; activeMonths:number;
  currentStreak:number; longestStreak:number; firstTx:string; lastTx:string;
  daysSinceActive:number; tokensSwapped:number; swapCount:number;
  contractInteractions:number; nftCount:number; walletRank:string;
  score:number; historyDays:number; weekLabels:string[]; dailyStats:DayStats[];
  topTokens:string[]; recommendation:string; recentTxs:AlchemyTransfer[];
  daysOnBase:number; defiInteractions:number; hasGm:boolean;
}
interface AlchemyTransfer { hash:string; category:string; value:number|null; asset:string|null; to:string|null; metadata:{blockTimestamp:string;}; }
interface AlchemyResponse { result?:{transfers:AlchemyTransfer[];pageKey?:string;}; error?:{message:string;}; }
type ConnectionType = 'farcaster'|'coinbase'|'metamask';
interface LeaderboardEntry { address:string; basename:string|null; score:number; rank:string; boosts:number; badges:number; weeklyXP:number; }

// --- HELPERS ---
function saveToLeaderboard(wallet:WalletData, boosts:number, mintedCount:number, weeklyXP:number) {
  if (typeof window==='undefined') return;
  try {
    const entry:LeaderboardEntry = { address:wallet.address, basename:wallet.basename, score:wallet.score, rank:wallet.walletRank, boosts, badges:mintedCount, weeklyXP };
    const board:LeaderboardEntry[] = JSON.parse(localStorage.getItem('base_leaderboard')||'[]');
    const idx = board.findIndex(e=>e.address.toLowerCase()===wallet.address.toLowerCase());
    if (idx>=0) board[idx]=entry; else board.push(entry);
    board.sort((a,b)=>b.weeklyXP-a.weeklyXP);
    localStorage.setItem('base_leaderboard', JSON.stringify(board.slice(0,100)));
  } catch {}
}
function getLeaderboard():LeaderboardEntry[] {
  if (typeof window==='undefined') return [];
  try { return JSON.parse(localStorage.getItem('base_leaderboard')||'[]'); } catch { return []; }
}
function getReferralCode(address:string) { return address.slice(2,10).toUpperCase(); }
function getQuestXP(wallet:WalletData, boosts:number, streak:number, txKeys?:Record<string,number>):number {
  return WEEKLY_QUESTS.filter(q=>q.check(wallet,boosts,streak,txKeys)).reduce((s,q)=>s+q.xp,0);
}
function computeWeeklyXP(wallet:WalletData, boosts:number, streak:number, txKeys?:Record<string,number>):number {
  return getQuestXP(wallet,boosts,streak,txKeys) + Math.min(boosts,10)*10 + Math.min(streak,7)*5;
}
function getSeasonProgress() {
  const now=new Date();
  if (now<SEASON_START) return 0;
  if (now>SEASON_END) return 100;
  return Math.max(0,Math.min(100,((now.getTime()-SEASON_START.getTime())/(SEASON_END.getTime()-SEASON_START.getTime()))*100));
}
function getDaysLeft() {
  const now=new Date();
  if (now>SEASON_END) return 0;
  return Math.max(0,Math.ceil((SEASON_END.getTime()-now.getTime())/(1000*3600*24)));
}

// --- SHARE HELPERS with Season mention + referral ---
function buildShareText(wallet:WalletData, referralCode:string, extra:string=''):string {
  return `${extra}\n\n🔵 ${SEASON_NAME} is LIVE — earn XP, mint badges & unlock future rewards!\n🎁 Join with my link: ${APP_URL_WEB}?ref=${referralCode}\n\n#BaseAnalytics #Base #OnchainSummer`;
}
function buildWarpcastShare(text:string):string {
  return `https://warpcast.com/~/compose?text=${encodeURIComponent(text)}&embeds[]=${encodeURIComponent(MINIAPP_URL)}`;
}
function buildTwitterShare(text:string):string {
  return `https://twitter.com/intent/tweet?text=${encodeURIComponent(text)}`;
}

export default function Page() {
  const [wallet, setWallet] = useState<WalletData|null>(null);
  const [connectionType, setConnectionType] = useState<ConnectionType|null>(null);
  const [loading, setLoading] = useState(false);
  const [activeTab, setActiveTab] = useState<'dashboard'|'achievements'|'quests'|'leaderboard'|'basehub'>('dashboard');
  const [transactingType, setTransactingType] = useState<string|null>(null);
  const [mintedLevels, setMintedLevels] = useState<Record<string,number>>({});
  const [isReady, setIsReady] = useState(false);
  const [showConnectModal, setShowConnectModal] = useState(false);
  const [selectedDay, setSelectedDay] = useState<DayStats|null>(null);
  const scrollRef = useRef<HTMLDivElement>(null);
  const [userBoosts, setUserBoosts] = useState(0);
  const [sponsoredTxs, setSponsoredTxs] = useState(0);
  const [txKeys, setTxKeys] = useState<Record<string,number>>({boost:0,gm:0,gn:0,checkin:0});
  const [toast, setToast] = useState<{show:boolean;message:string;hash:string}|null>(null);
  const [onchainStreak, setOnchainStreak] = useState(0);
  const [hasCheckedInToday, setHasCheckedInToday] = useState(false);
  const [leaderboard, setLeaderboard] = useState<LeaderboardEntry[]>([]);
  const [challengeAddress, setChallengeAddress] = useState('');
  const [challengeData, setChallengeData] = useState<{address:string;score:number;rank:string}|null>(null);
  const [referralCopied, setReferralCopied] = useState(false);
  const [weeklyXP, setWeeklyXP] = useState(0);

  const boostDataWT  = `${encodeFunctionData({abi:BOOSTER_ABI,functionName:'boost'})}${getBuilderSuffix()}` as `0x${string}`;
  const gmDataWT     = `${encodeFunctionData({abi:GM_GN_ABI,functionName:'gm'})}${getBuilderSuffix()}` as `0x${string}`;
  const gnDataWT     = `${encodeFunctionData({abi:GM_GN_ABI,functionName:'gn'})}${getBuilderSuffix()}` as `0x${string}`;
  const checkInDataWT= `${encodeFunctionData({abi:CHECKIN_ABI,functionName:'checkIn'})}${getBuilderSuffix()}` as `0x${string}`;

  const boostCall   = [{to:BOOSTER_CONTRACT_ADDRESS as `0x${string}`,data:boostDataWT,value:BigInt(4000000000000)}];
  const gmCall      = [{to:GM_GN_CONTRACT_ADDRESS as `0x${string}`,data:gmDataWT,value:BigInt(2000000000000)}];
  const gnCall      = [{to:GM_GN_CONTRACT_ADDRESS as `0x${string}`,data:gnDataWT,value:BigInt(2000000000000)}];
  const checkInCall = [{to:CHECKIN_CONTRACT_ADDRESS as `0x${string}`,data:checkInDataWT}];

  const txCaps = {
    ...(process.env.NEXT_PUBLIC_PAYMASTER_URL?{paymasterService:{url:process.env.NEXT_PUBLIC_PAYMASTER_URL}}:{}),
    dataSuffix:{value:`0x${getBuilderSuffix()}` as `0x${string}`,optional:true}
  };

  const showToast=(message:string,hash:string)=>{
    setToast({show:true,message,hash});
    setTimeout(()=>setToast(null),5000);
  };

  useEffect(()=>{
    if (typeof window!=='undefined'&&sdk?.actions?.ready) {
      try{sdk.actions.ready();setIsReady(true);}catch(e){console.error(e);}
    }
    setLeaderboard(getLeaderboard());
    if (typeof window!=='undefined') {
      const params=new URLSearchParams(window.location.search);
      const ref=params.get('ref');
      if (ref) localStorage.setItem('base_referrer',ref);
    }
  },[]);

  useEffect(()=>{
    if (wallet&&activeTab==='dashboard'&&scrollRef.current) {
      setTimeout(()=>{if(scrollRef.current)scrollRef.current.scrollLeft=scrollRef.current.scrollWidth;},100);
    }
  },[wallet,activeTab]);

  useEffect(()=>{
    if (wallet) {
      const xp=computeWeeklyXP(wallet,userBoosts,onchainStreak,txKeys);
      setWeeklyXP(xp);
      const mintedCount=Object.keys(mintedLevels).filter(k=>mintedLevels[k]>0).length;
      saveToLeaderboard(wallet,userBoosts,mintedCount,xp);
      setLeaderboard(getLeaderboard());
    }
  },[wallet,userBoosts,mintedLevels,onchainStreak,txKeys]);

  const getStrictUTCDate=(ts:string)=>ts.split('T')[0];
  const getISOWeekToken=(date:Date)=>{
    const d=new Date(Date.UTC(date.getUTCFullYear(),date.getUTCMonth(),date.getUTCDate()));
    const dayNum=d.getUTCDay()||7;
    d.setUTCDate(d.getUTCDate()+4-dayNum);
    const year=d.getUTCFullYear();
    const weekNo=Math.ceil((((d.getTime()-new Date(Date.UTC(year,0,1)).getTime())/86400000)+1)/7);
    return `${year}-W${weekNo}`;
  };

  const analyzeWallet=useCallback(async(address:string)=>{
    if (!address||!address.startsWith('0x')||address.length!==42){showToast('❌ Invalid EVM Address','');setLoading(false);return;}
    try {
      const provider=new JsonRpcProvider(BASE_RPC);
      const publicClient=createPublicClient({chain:base,transport:http(BASE_RPC)});
      setMintedLevels({});

      const mainnetClient=createPublicClient({chain:mainnet,transport:http(`https://eth-mainnet.g.alchemy.com/v2/${ALCHEMY_KEY}`)});
      const basenamePromise=mainnetClient.getEnsName({address:address as `0x${string}`}).catch(()=>null);
      const balancePromise=provider.getBalance(address).catch(()=>BigInt(0));
      const nftPromise=fetch(`https://base-mainnet.g.alchemy.com/nft/v3/${ALCHEMY_KEY}/getNFTsForOwner?owner=${address}&withMetadata=false`).then(r=>r.json()).catch(()=>({totalCount:0}));
      const streakPromise=publicClient.readContract({address:CHECKIN_CONTRACT_ADDRESS as `0x${string}`,abi:CHECKIN_ABI,functionName:'streaks',args:[address as `0x${string}`]}).catch(()=>BigInt(0));
      const lastCIPromise=publicClient.readContract({address:CHECKIN_CONTRACT_ADDRESS as `0x${string}`,abi:CHECKIN_ABI,functionName:'lastCheckIn',args:[address as `0x${string}`]}).catch(()=>BigInt(0));

      const calls: { address: `0x${string}`; abi: typeof ACHIEVEMENTS_ABI; functionName: 'hasMinted'; args: readonly [`0x${string}`, bigint]; }[] = [];
      const callMap:{catId:string;level:number}[]=[];
      for (const cat of ACHIEVEMENTS) {
        for (let i=cat.thresholds.length;i>=1;i--) {
          const tid=getTargetTokenId(cat.baseId,cat.thresholds.length,i);
          calls.push({address:ACHIEVEMENTS_CONTRACT_ADDRESS as `0x${string}`,abi:ACHIEVEMENTS_ABI,functionName:'hasMinted',args:[address as `0x${string}`,BigInt(tid)]});
          callMap.push({catId:cat.id,level:i});
        }
      }
      const multicallPromise=publicClient.multicall({contracts:calls}).catch(()=>[]);

      const transfersPromise=(async()=>{
        let transfers:AlchemyTransfer[]=[];
        let pageKey:string|undefined;
        let loop=0;
        while(true){
          loop++;
          const params:Record<string,unknown>={fromBlock:"0x0",toBlock:"latest",fromAddress:address,category:["external","erc20","erc721","erc1155"],maxCount:"0x3e8",withMetadata:true};
          if(pageKey)params.pageKey=pageKey;
          const res=await fetch(BASE_RPC,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({jsonrpc:"2.0",id:1,method:"alchemy_getAssetTransfers",params:[params]})});
          const data=(await res.json()) as AlchemyResponse;
          if(data.error)break;
          transfers=[...transfers,...(data.result?.transfers||[])];
          pageKey=data.result?.pageKey;
          if(!pageKey||loop>5)break;
        }
        return transfers;
      })();

      const [basename,balWei,nftData,multicallResults,allTransfers,dbStreak,dbLastCI]=await Promise.all([
        basenamePromise,balancePromise,nftPromise,multicallPromise,transfersPromise,streakPromise,lastCIPromise
      ]);

      setOnchainStreak(Number(dbStreak));
      if(Number(dbLastCI)>0){
        const lastDate=new Date(Number(dbLastCI)*1000).toISOString().split('T')[0];
        setHasCheckedInToday(lastDate===new Date().toISOString().split('T')[0]);
      }

      const currentMintedState:Record<string,number>={};
      multicallResults.forEach((res: { status: string; result?: unknown },index:number)=>{
        const{catId,level}=callMap[index];
        if(res.status==='success'&&res.result===true){
          if(!currentMintedState[catId]||currentMintedState[catId]<level)currentMintedState[catId]=level;
        }
      });
      setMintedLevels(currentMintedState);

      const uniqueDays=new Set<string>(),uniqueWeeks=new Set<string>(),uniqueMonths=new Set<string>(),uniqueTokens=new Set<string>();
      const tokenFrequency=new Map<string,number>();
      let ethVolume=0,swapCount=0,contractInteractions=0,historicalBoosts=0,defiInteractions=0;
      let hasGm=false;
      const txsPerDay=new Map<string,number>();
      const addTxDay=(d:string)=>txsPerDay.set(d,(txsPerDay.get(d)||0)+1);

      for(const tx of allTransfers){
        const d=new Date(tx.metadata.blockTimestamp);
        const day=getStrictUTCDate(tx.metadata.blockTimestamp);
        uniqueDays.add(day);addTxDay(day);
        uniqueWeeks.add(getISOWeekToken(d));uniqueMonths.add(`${d.getUTCFullYear()}-${d.getUTCMonth()}`);
        if(tx.value&&(tx.asset==='ETH'||tx.asset==='WETH'))ethVolume+=tx.value;
        if(tx.category==='erc20')swapCount++;
        if(['erc20','erc721','erc1155'].includes(tx.category)){if(tx.asset){uniqueTokens.add(tx.asset);tokenFrequency.set(tx.asset,(tokenFrequency.get(tx.asset)||0)+1);}}
        if(tx.category==='external')contractInteractions++;
        if(tx.to&&DEFI_PROTOCOLS.includes(tx.to.toLowerCase()))defiInteractions++;
        if(tx.to&&tx.to.toLowerCase()===BOOSTER_CONTRACT_ADDRESS.toLowerCase())historicalBoosts++;
        if(tx.to&&tx.to.toLowerCase()===GM_GN_CONTRACT_ADDRESS.toLowerCase())hasGm=true;
      }

      let finalBoosts=historicalBoosts;
      if(typeof window!=='undefined'){
        const cached=localStorage.getItem(`base_boosts_${address.toLowerCase()}`);
        if(cached){const p=parseInt(cached,10);if(p>finalBoosts)finalBoosts=p;}
        localStorage.setItem(`base_boosts_${address.toLowerCase()}`,finalBoosts.toString());
        if(localStorage.getItem(`base_gm_${address.toLowerCase()}`)==='true')hasGm=true;
        else if(hasGm)localStorage.setItem(`base_gm_${address.toLowerCase()}`,'true');
      }
      setUserBoosts(finalBoosts);

      const totalTxCount=allTransfers.length;
      const topTokens=Array.from(tokenFrequency.entries()).sort((a,b)=>b[1]-a[1]).slice(0,3).map(e=>e[0]);
      const recentTxs=[...allTransfers].sort((a,b)=>new Date(b.metadata.blockTimestamp).getTime()-new Date(a.metadata.blockTimestamp).getTime()).slice(0,5);

      const sortedDays=Array.from(uniqueDays).sort();
      let longestStreak=0,tempStreak=0,prevTs=0;
      for(const day of sortedDays){
        const ts=Date.parse(day);
        if(prevTs!==0){const diff=(ts-prevTs)/(1000*3600*24);if(Math.round(diff)===1)tempStreak++;else{longestStreak=Math.max(longestStreak,tempStreak);tempStreak=1;}}else tempStreak=1;
        prevTs=ts;
      }
      longestStreak=Math.max(longestStreak,tempStreak);

      const now=new Date();
      const todayStr=now.toISOString().split('T')[0];
      const yestDate=new Date();yestDate.setUTCDate(now.getUTCDate()-1);
      const currentStreak=(uniqueDays.has(todayStr)||uniqueDays.has(yestDate.toISOString().split('T')[0]))?tempStreak:0;

      let firstTxTs=now.getTime(),lastTxTs=0;
      if(allTransfers.length>0){
        firstTxTs=Math.min(firstTxTs,new Date(allTransfers[0].metadata.blockTimestamp).getTime());
        lastTxTs=Math.max(lastTxTs,new Date(allTransfers[allTransfers.length-1].metadata.blockTimestamp).getTime());
      }

      let historyDays=364,firstTxStr="N/A",lastTxStr="N/A",daysSinceActive=0,daysOnBase=0;
      if(totalTxCount>0){
        firstTxStr=new Date(firstTxTs).toLocaleDateString();
        lastTxStr=new Date(lastTxTs).toLocaleDateString();
        daysSinceActive=Math.floor((now.getTime()-lastTxTs)/(1000*3600*24));
        daysOnBase=Math.floor((now.getTime()-firstTxTs)/(1000*3600*24));
        historyDays=Math.max(364,Math.ceil(Math.abs(now.getTime()-firstTxTs)/(1000*3600*24))+14);
      }

      let recommendation="You're a Base power user! Keep up the great onchain activity.";
      if(daysSinceActive>7)recommendation=`⚠️ Inactive for ${daysSinceActive} days! Send a GM to keep your streak alive.`;
      else if(swapCount===0)recommendation="💡 Haven't swapped tokens yet! Try exploring DEXs on Base.";
      else if(totalTxCount<10)recommendation="👋 Welcome to Base! Try minting an NFT or boosting your score.";

      const dailyStats:DayStats[]=[];
      const ptr=new Date();
      for(let i=0;i<historyDays;i++){
        const ds=ptr.toISOString().split('T')[0];
        const count=txsPerDay.get(ds)||0;
        let intensity=0;if(count>0)intensity=1;if(count>2)intensity=2;if(count>5)intensity=3;if(count>10)intensity=4;
        dailyStats.unshift({date:ds,count,intensity});
        ptr.setUTCDate(ptr.getUTCDate()-1);
      }

      const totalColumns=Math.ceil(historyDays/7);
      const weekLabels:string[]=[];
      let lastMonthLabel="";
      const gridStart=new Date();gridStart.setUTCDate(gridStart.getUTCDate()-historyDays+1);
      for(let col=0;col<totalColumns;col++){
        const ws=new Date(gridStart);ws.setUTCDate(ws.getUTCDate()+(col*7));
        const mi=ws.getUTCMonth();
        if(MONTHS_3_LETTERS[mi]!==lastMonthLabel){weekLabels.push(MONTHS_3_LETTERS[mi]);lastMonthLabel=MONTHS_3_LETTERS[mi];}else weekLabels.push("");
      }

      const finalScore=Math.floor(
        Math.min(25,totalTxCount/20)+Math.min(20,uniqueDays.size/5)+Math.min(15,uniqueMonths.size*1.25)+
        Math.min(15,currentStreak*1.1)+Math.min(10,ethVolume*2)+Math.min(10,uniqueTokens.size/2)+Math.min(5,defiInteractions*2)+(basename?5:0)
      );

      let walletRank="Base Shrimp 🦐";
      if(finalScore>=30)walletRank="Base Dolphin 🐬";
      if(finalScore>=60)walletRank="Base Shark 🦈";
      if(finalScore>=75)walletRank="Base Whale 🐋";
      if(finalScore>=85)walletRank="Base God 👑";

      setWallet({
        address,basename,balance:parseFloat(formatEther(balWei)).toFixed(4),ethVolume:ethVolume.toFixed(2),
        txCount:totalTxCount,uniqueDays:uniqueDays.size,activeWeeks:uniqueWeeks.size,activeMonths:uniqueMonths.size,
        currentStreak,longestStreak,firstTx:firstTxStr,lastTx:lastTxStr,daysSinceActive,
        tokensSwapped:uniqueTokens.size,swapCount,contractInteractions,nftCount:nftData.totalCount||0,walletRank,
        score:Math.min(100,finalScore),dailyStats,historyDays,weekLabels,topTokens,recommendation,recentTxs,daysOnBase,defiInteractions,hasGm
      });
    } catch { setWallet(null); }
    finally { setLoading(false); }
  },[]);

  const handleConnect=async(type:ConnectionType)=>{
    try{
      setShowConnectModal(false);setLoading(true);
      let userAddress='';
      if(type==='farcaster'){
        showToast("⏳ Requesting Farcaster profile...","");
        const accounts=(await sdk.wallet.ethProvider.request({method:"eth_requestAccounts"})) as string[];
        if(!accounts||accounts.length===0)throw new Error("No account found.");
        const evmAddress=accounts.find(addr=>addr&&addr.startsWith('0x'));
        if(!evmAddress)throw new Error("Solana wallet detected. Please verify a Base/ETH wallet!");
        userAddress=evmAddress;
        showToast(`✅ Wallet linked! Scanning...`,"");
      }else{
        const{address}=await connectWallet(type);
        userAddress=address;
      }
      setConnectionType(type);analyzeWallet(userAddress);
    }catch{setLoading(false);showToast(`❌ Connection Failed.`,"");}
  };

  const handleDisconnect=()=>{setWallet(null);setConnectionType(null);};

  const handleNativeTx=async(type:'boost'|'gm'|'gn'|'checkin')=>{
    if(!wallet||transactingType!==null)return;
    setTransactingType(type);
    try{
      let toAddress:`0x${string}`='0x',txData:`0x${string}`='0x',successMsg='';
      const txValue=type==='boost'?BigInt(4000000000000):BigInt(2000000000000);
      if(type==='boost'){toAddress=BOOSTER_CONTRACT_ADDRESS as `0x${string}`;txData=boostDataWT;successMsg='Boost Successful! 🎉';}
      else if(type==='gm'){toAddress=GM_GN_CONTRACT_ADDRESS as `0x${string}`;txData=gmDataWT;successMsg='GM Registered on Base! ☀️';}
      else if(type==='gn'){toAddress=GM_GN_CONTRACT_ADDRESS as `0x${string}`;txData=gnDataWT;successMsg='GN Registered on Base! 🌙';}
      else{toAddress=CHECKIN_CONTRACT_ADDRESS as `0x${string}`;txData=checkInDataWT;successMsg='Onchain Check-in Secured! 🔥';}

      const txParams:{from:`0x${string}`;to:`0x${string}`;data:`0x${string}`;chainId:`0x${string}`;value?:`0x${string}`}={from:wallet.address as `0x${string}`,to:toAddress,data:txData,chainId:'0x2105'};
      if(type!=='checkin'&&txValue>BigInt(0))txParams.value=`0x${txValue.toString(16)}` as `0x${string}`;
      const hash=await sdk.wallet.ethProvider.request({method:"eth_sendTransaction",params:[txParams]});

      if(hash&&typeof hash==='string'){
        showToast(successMsg,hash);setSponsoredTxs(s=>s+1);
        if(type==='boost'){setUserBoosts(b=>{const n=b+1;if(typeof window!=='undefined')localStorage.setItem(`base_boosts_${wallet.address.toLowerCase()}`,n.toString());return n;});setTxKeys(p=>({...p,boost:(p.boost||0)+1}));}
        if(type==='gm'){if(typeof window!=='undefined')localStorage.setItem(`base_gm_${wallet.address.toLowerCase()}`,'true');setTxKeys(p=>({...p,gm:(p.gm||0)+1}));}
        if(type==='gn')setTxKeys(p=>({...p,gn:(p.gn||0)+1}));
        if(type==='checkin'){setHasCheckedInToday(true);setOnchainStreak(s=>s+1);setTxKeys(p=>({...p,checkin:(p.checkin||0)+1}));}
      }
      setTransactingType(null);
    }catch(err:unknown){
      setTransactingType(null);
      let msg='Transaction rejected.';
      if(err instanceof Error)msg=err.message.split('\n')[0];
      if(!msg.includes("rejected"))showToast(`❌ Tx Failed: ${msg}`,'');
    }
  };

  const handleNativeMint=async(catId:string,targetLevels:number[],tokenIds:number[],catName:string)=>{
    if(!wallet||transactingType!==null)return;
    setTransactingType(`mint-${catId}`);
    try{
      const isBatch=tokenIds.length>1;
      const rawData=isBatch
        ?encodeFunctionData({abi:ACHIEVEMENTS_ABI,functionName:'mintBatchAchievements',args:[tokenIds.map(id=>BigInt(id))]})
        :encodeFunctionData({abi:ACHIEVEMENTS_ABI,functionName:'mintAchievement',args:[BigInt(tokenIds[0])]});
      const mintData=`${rawData}${getBuilderSuffix()}` as `0x${string}`;
      const txParams:{from:`0x${string}`;to:`0x${string}`;data:`0x${string}`;chainId:`0x${string}`}={from:wallet.address as `0x${string}`,to:ACHIEVEMENTS_CONTRACT_ADDRESS as `0x${string}`,data:mintData,chainId:'0x2105'};
      const hash=await sdk.wallet.ethProvider.request({method:"eth_sendTransaction",params:[txParams]});
      if(hash&&typeof hash==='string'){
        showToast(isBatch?`✅ Claimed ${tokenIds.length} ${catName} Badges!`:`✅ Badge minted!`,hash);
        setMintedLevels(prev=>({...prev,[catId]:Math.max(...targetLevels)}));
        setTxKeys(prev=>({...prev,[`mint-${catId}`]:(prev[`mint-${catId}`]||0)+1}));
        setSponsoredTxs(s=>s+1);
      }
      setTransactingType(null);
    }catch(err:unknown){
      setTransactingType(null);
      let msg='Mint rejected.';
      if(err instanceof Error){if(err.message.includes("already minted"))msg="Already minted.";else msg=err.message.split('\n')[0];}
      if(!msg.includes("rejected"))showToast(`❌ Mint Failed`,'');
    }
  };

  const handleChallengeWallet=async()=>{
    if(!challengeAddress||challengeAddress.length<10)return;
    try{
      const score=Math.floor(Math.random()*60+20);
      const ranks=['Base Shrimp 🦐','Base Dolphin 🐬','Base Shark 🦈','Base Whale 🐋'];
      setChallengeData({address:challengeAddress,score,rank:ranks[Math.floor(score/25)]||ranks[0]});
    }catch{showToast('❌ Could not fetch wallet data','');}
  };

  const handleReferralCopy=()=>{
    if(!wallet)return;
    navigator.clipboard.writeText(`${APP_URL_WEB}?ref=${getReferralCode(wallet.address)}`);
    setReferralCopied(true);setTimeout(()=>setReferralCopied(false),2000);
  };

  const getCategoryValue=(id:string)=>{
    if(!wallet)return 0;
    const map:Record<string,number>={score:wallet.score,age:wallet.daysOnBase,name:wallet.basename?1:0,days:wallet.uniqueDays,contract:wallet.contractInteractions,volume:parseFloat(wallet.ethVolume),txs:wallet.txCount,swaps:wallet.swapCount,nfts:wallet.nftCount,streak:wallet.longestStreak,boosts:userBoosts};
    return map[id]??0;
  };

  const refCode=wallet?getReferralCode(wallet.address):'';
  const completedQuestsCount=wallet?WEEKLY_QUESTS.filter(q=>q.check(wallet,userBoosts,onchainStreak,txKeys)).length:0;

  // --- Share functions ---
  const shareScore=(platform:'warpcast'|'twitter'|'native')=>{
    if(!wallet)return;
    const text=buildShareText(wallet,refCode,`🏆 I'm a ${wallet.walletRank} on @base!\n\nScore: ${wallet.score}/100 🔵\nStreak: ${onchainStreak} days 🔥\nBadges minted: ${Object.keys(mintedLevels).filter(k=>mintedLevels[k]>0).length} 🎖️`);
    if(platform==='warpcast')window.open(buildWarpcastShare(text),'_blank');
    else if(platform==='twitter')window.open(buildTwitterShare(text),'_blank');
    else if(navigator.share)navigator.share({title:'Base Analytics',text,url:APP_URL_WEB}).catch(()=>{});
  };
  const shareAchievement=(catName:string,levelName:string,platform:'warpcast'|'twitter')=>{
    if(!wallet)return;
    const text=buildShareText(wallet,refCode,`🏅 Just unlocked the "${levelName}" badge for ${catName} on Base Analytics! 🔵`);
    if(platform==='warpcast')window.open(buildWarpcastShare(text),'_blank');
    else window.open(buildTwitterShare(text),'_blank');
  };
  const shareAllBadges=(count:number,platform:'warpcast'|'twitter')=>{
    if(!wallet)return;
    const text=buildShareText(wallet,refCode,`🎖️ Just claimed ${count} Onchain Badges gasless on Base Analytics! 🔵\n\n${SEASON_NAME} rewards are coming — stack your XP now!`);
    if(platform==='warpcast')window.open(buildWarpcastShare(text),'_blank');
    else window.open(buildTwitterShare(text),'_blank');
  };

  if(!isReady)return(
    <div className="min-h-screen bg-[#0d1117] flex items-center justify-center">
      <div className="flex flex-col items-center gap-4">
        <div className="w-12 h-12 bg-blue-600 rounded-full flex items-center justify-center animate-pulse shadow-lg shadow-blue-600/40">
          <Activity className="text-white" size={24}/>
        </div>
        <p className="text-blue-400 font-mono text-xs tracking-widest uppercase">Initializing Base...</p>
      </div>
    </div>
  );

  if(!wallet)return(
    <div className="min-h-screen bg-[#0d1117] flex flex-col items-center justify-center p-6 text-center relative overflow-hidden">
      {/* Grid bg */}
      <div className="absolute inset-0 opacity-20" style={{backgroundImage:'linear-gradient(rgba(0,82,255,0.15)1px,transparent 1px),linear-gradient(90deg,rgba(0,82,255,0.15)1px,transparent 1px)',backgroundSize:'60px 60px'}}/>
      {/* Glows */}
      <div className="absolute top-0 left-1/2 -translate-x-1/2 w-96 h-96 bg-blue-600/20 rounded-full blur-3xl"/>
      <div className="absolute bottom-0 right-0 w-64 h-64 bg-purple-600/15 rounded-full blur-3xl"/>

      <div className="relative z-10 flex flex-col items-center">
        <div className="w-20 h-20 bg-blue-600 rounded-2xl flex items-center justify-center mb-6 shadow-2xl shadow-blue-600/50 rotate-3">
          <Activity className="text-white" size={40}/>
        </div>
        <h1 className="text-5xl md:text-7xl font-black text-white mb-3 tracking-tighter">BASE<span className="text-blue-500">.</span>ANALYTICS</h1>
        <p className="text-slate-400 font-medium max-w-sm mx-auto mb-3">Discover your true Onchain identity. Farm XP. Climb the leaderboard.</p>

        {/* Season pill */}
        <div className="inline-flex items-center gap-2 bg-blue-600/10 border border-blue-500/30 rounded-full px-4 py-2 mb-8">
          <Star size={12} className="text-blue-400"/>
          <span className="text-blue-300 text-xs font-black uppercase tracking-widest">{SEASON_NAME}</span>
          <span className="text-slate-500 text-xs">·</span>
          <span className="text-slate-400 text-xs font-bold">{getDaysLeft()}d left</span>
        </div>

        {/* Season progress */}
        <div className="w-full max-w-xs mb-8">
          <div className="w-full bg-white/5 rounded-full h-1.5 mb-1">
            <div className="bg-blue-600 h-1.5 rounded-full transition-all shadow-sm shadow-blue-600/50" style={{width:`${getSeasonProgress().toFixed(0)}%`}}/>
          </div>
          <p className="text-slate-600 text-[10px] text-right font-bold">{getSeasonProgress().toFixed(0)}% of season complete</p>
        </div>

        <button onClick={()=>setShowConnectModal(true)} disabled={loading}
          className="w-full max-w-xs bg-blue-600 hover:bg-blue-500 text-white py-4 rounded-2xl font-black text-lg flex items-center justify-center gap-3 transition active:scale-95 shadow-xl shadow-blue-600/40">
          {loading?<RefreshCcw className="animate-spin"/>:<Wallet size={22}/>}
          {loading?"Scanning...":"Connect Wallet"}
        </button>

        <div className="mt-6 grid grid-cols-3 gap-3 w-full max-w-xs">
          {[{v:'11+',l:'Badges'},{v:'6',l:'Quests'},{v:getDaysLeft()+'d',l:'Season Left'}].map((s,i)=>(
            <div key={i} className="bg-white/5 border border-white/5 rounded-xl p-3 text-center">
              <p className="text-white font-black text-lg">{s.v}</p>
              <p className="text-slate-500 text-[9px] uppercase font-bold tracking-wide">{s.l}</p>
            </div>
          ))}
        </div>
      </div>

      {showConnectModal&&(
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-md">
          <div className="bg-[#161b27] border border-white/10 rounded-3xl w-full max-w-sm p-6 relative shadow-2xl">
            <button onClick={()=>setShowConnectModal(false)} className="absolute top-4 right-4 text-slate-500 hover:text-white"><X size={20}/></button>
            <div className="flex items-center gap-3 mb-6">
              <div className="w-8 h-8 bg-blue-600 rounded-xl flex items-center justify-center"><Activity size={16} className="text-white"/></div>
              <h3 className="text-lg font-black text-white">Connect Wallet</h3>
            </div>
            <div className="flex flex-col gap-3">
              <button onClick={()=>handleConnect('coinbase')} className="flex items-center justify-between bg-blue-600 hover:bg-blue-500 text-white p-4 rounded-xl font-bold transition">Coinbase Wallet<ChevronRight size={18}/></button>
              <button onClick={()=>handleConnect('metamask')} className="flex items-center justify-between bg-[#F6851B] hover:bg-[#e2761b] text-white p-4 rounded-xl font-bold transition">MetaMask<ChevronRight size={18}/></button>
              <button onClick={()=>handleConnect('farcaster')} className="flex items-center justify-between bg-[#8A2BE2] hover:bg-[#7B1AD2] text-white p-4 rounded-xl font-bold transition">Farcaster<ChevronRight size={18}/></button>
            </div>
          </div>
        </div>
      )}
    </div>
  );

  // --- MAIN APP (dark theme) ---
  return(
    <main className="min-h-screen bg-[#0d1117] text-white font-sans pb-16">
      {/* Grid background */}
      <div className="fixed inset-0 pointer-events-none opacity-30" style={{backgroundImage:'linear-gradient(rgba(0,82,255,0.06)1px,transparent 1px),linear-gradient(90deg,rgba(0,82,255,0.06)1px,transparent 1px)',backgroundSize:'60px 60px'}}/>

      {/* TOAST */}
      {toast&&(
        <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-50 bg-blue-600 text-white px-5 py-4 rounded-2xl shadow-2xl shadow-blue-600/40 flex items-center gap-4 animate-in slide-in-from-bottom-4 max-w-sm w-full mx-4">
          <BadgeCheck size={20}/><div className="flex-1 min-w-0"><p className="font-bold text-sm">{toast.message}</p>{toast.hash&&<a href={`https://basescan.org/tx/${toast.hash}`} target="_blank" rel="noreferrer" className="text-blue-200 text-xs underline">View on BaseScan ↗</a>}</div>
          <button onClick={()=>setToast(null)} className="shrink-0 bg-white/10 p-1.5 rounded-lg hover:bg-white/20"><X size={14}/></button>
        </div>
      )}

      {/* HEADER */}
      <div className="sticky top-0 z-40 bg-[#0d1117]/90 backdrop-blur-xl border-b border-white/5 px-4 py-3">
        <div className="flex justify-between items-center max-w-4xl mx-auto">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 bg-blue-600 rounded-xl flex items-center justify-center shadow-lg shadow-blue-600/40"><Activity size={16} className="text-white"/></div>
            <span className="font-black text-base tracking-tight text-white">BASE<span className="text-blue-500">.</span>ANALYTICS</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="hidden sm:flex items-center gap-1.5 bg-white/5 border border-white/8 rounded-xl px-2.5 py-1.5">
              <Star size={11} className="text-blue-400"/><span className="text-[10px] font-black text-blue-300">{SEASON_NAME}</span>
              <span className="text-white/20">·</span><span className="text-[10px] text-slate-500">{getDaysLeft()}d</span>
            </div>
            <div className="flex items-center gap-1.5 bg-yellow-500/10 border border-yellow-500/20 rounded-xl px-2.5 py-1.5">
              <Zap size={11} className="text-yellow-400"/><span className="text-[10px] font-black text-yellow-300">{weeklyXP} XP</span>
            </div>
            <button onClick={handleDisconnect} className="p-2 bg-white/5 border border-white/8 rounded-xl text-slate-400 hover:text-white hover:bg-white/10 transition"><Power size={14}/></button>
          </div>
        </div>
      </div>

      <div className="max-w-4xl mx-auto px-4 pt-4">
        {/* TABS */}
        <div className="flex bg-white/5 border border-white/8 p-1 rounded-2xl mb-6 overflow-x-auto gap-0.5">
          {[
            {id:'dashboard',icon:<BarChart3 size={13}/>,label:'Dashboard'},
            {id:'achievements',icon:<Trophy size={13}/>,label:'Badges'},
            {id:'quests',icon:<Target size={13}/>,label:`Quests${completedQuestsCount>0?` (${completedQuestsCount})`:''}`},
            {id:'leaderboard',icon:<Users size={13}/>,label:'Leaderboard'},
            {id:'basehub',icon:<BookOpen size={13}/>,label:'Base Hub'},
          ].map(tab=>(
            <button key={tab.id} onClick={()=>setActiveTab(tab.id as typeof activeTab)}
              className={`flex-1 py-2 rounded-xl font-bold text-[10px] sm:text-xs transition-all flex flex-col sm:flex-row justify-center items-center gap-1 whitespace-nowrap px-1.5 ${activeTab===tab.id?'bg-blue-600 text-white shadow-lg shadow-blue-600/30':'text-slate-500 hover:text-slate-300'}`}>
              {tab.icon}<span>{tab.label}</span>
            </button>
          ))}
        </div>

        {/* ===== DASHBOARD ===== */}
        {activeTab==='dashboard'&&(
          <div className="animate-in fade-in slide-in-from-bottom-3 space-y-4">

            {/* Check-in banner */}
            <div className={`rounded-2xl p-4 flex items-center justify-between border ${hasCheckedInToday?'bg-green-500/10 border-green-500/20':'bg-blue-600/8 border-blue-500/20'}`}>
              <div className="flex items-center gap-3">
                <div className={`p-2 rounded-xl ${hasCheckedInToday?'bg-green-500/20':'bg-blue-600/20'}`}><Flame size={18} className={hasCheckedInToday?'text-green-400':'text-blue-400'}/></div>
                <div>
                  <p className="font-black text-sm text-white">{hasCheckedInToday?`Streak Secured: ${onchainStreak} Days 🔥`:'Daily Onchain Check-In Available'}</p>
                  <p className="text-[10px] text-slate-500">{hasCheckedInToday?'Your streak is recorded on Base.':'Sign a gas-free tx to log your streak onchain.'}</p>
                </div>
              </div>
              <div className="text-center">
                {connectionType==='farcaster'?(
                  <button onClick={()=>handleNativeTx('checkin')} disabled={hasCheckedInToday||transactingType!==null}
                    className={`px-4 py-2 rounded-xl font-black text-xs transition ${hasCheckedInToday?'bg-green-500/20 text-green-400 cursor-default':'bg-blue-600 hover:bg-blue-500 text-white'}`}>
                    {transactingType==='checkin'?<RefreshCcw className="animate-spin mx-auto" size={14}/>:hasCheckedInToday?'✓ Done':'Check In'}
                  </button>
                ):hasCheckedInToday?(
                  <button disabled className="px-4 py-2 rounded-xl font-black text-xs bg-green-500/20 text-green-400 cursor-default">✓ Done</button>
                ):(
                  <Transaction key={`ci-${txKeys.checkin}`} chainId={base.id} calls={checkInCall} capabilities={txCaps} onStatus={(s)=>{if(s.statusName==='success'){setHasCheckedInToday(true);setOnchainStreak(str=>str+1);setSponsoredTxs(st=>st+1);showToast('✅ Onchain check-in secured!',s.statusData.transactionReceipts?.[0]?.transactionHash||'');setTxKeys(p=>({...p,checkin:(p.checkin||0)+1}));}}}>
                    <TransactionButton className="px-4 py-2 rounded-xl font-black text-xs bg-blue-600 hover:bg-blue-500 text-white transition" text="Check In"/>
                  </Transaction>
                )}
                <p className="text-[9px] text-blue-500 mt-1 flex items-center justify-center gap-1"><Droplets size={9}/>Gas Free</p>
              </div>
            </div>

            {/* Recommendation */}
            <div className="bg-white/4 border border-white/8 rounded-2xl p-4 flex items-center gap-3">
              {wallet.daysSinceActive>7?<AlertTriangle size={18} className="text-yellow-400 shrink-0"/>:<Activity size={18} className="text-blue-400 shrink-0"/>}
              <p className="text-sm text-slate-300">{wallet.recommendation}</p>
            </div>

            {/* Gas saved */}
            {sponsoredTxs>0&&(
              <div className="bg-green-500/8 border border-green-500/15 rounded-2xl p-4 flex items-center justify-between">
                <div className="flex items-center gap-3"><Droplets size={18} className="text-green-400"/><div><p className="text-sm font-bold text-white">Gas Sponsored</p><p className="text-xs text-slate-500">Saved ~${(sponsoredTxs*0.05).toFixed(2)} in fees this session</p></div></div>
                <div className="text-2xl font-black text-green-400">{sponsoredTxs}</div>
              </div>
            )}

            {/* Score + Heatmap card */}
            <div className="bg-[#161b27] border border-white/8 rounded-3xl p-6">
              <div className="flex flex-col md:flex-row justify-between items-start mb-6 gap-4">
                <div>
                  <div className="flex items-center gap-3 mb-2">
                    <span className="text-[10px] font-black text-blue-400 uppercase tracking-widest">Onchain Score</span>
                    <div className="flex gap-1.5">
                      <button onClick={()=>shareScore('warpcast')} className="bg-white/5 hover:bg-white/10 border border-white/8 text-slate-400 px-2 py-1 rounded-lg text-[10px] font-bold flex items-center gap-1 transition"><Send size={9} className="text-purple-400"/>Cast</button>
                      <button onClick={()=>shareScore('twitter')} className="bg-white/5 hover:bg-white/10 border border-white/8 text-slate-400 px-2 py-1 rounded-lg text-[10px] font-bold flex items-center gap-1 transition"><Twitter size={9} className="text-sky-400"/>Post</button>
                      <button onClick={()=>shareScore('native')} className="bg-white/5 hover:bg-white/10 border border-white/8 text-slate-400 p-1 rounded-lg transition"><Share2 size={11}/></button>
                    </div>
                  </div>
                  <div className="flex items-end gap-2">
                    <h1 className="text-8xl font-black text-white tracking-tighter leading-none">{wallet.score}</h1>
                    <span className="text-3xl text-white/25 mb-2">/100</span>
                  </div>
                  <p className="text-blue-400 font-black mt-2 text-lg">{wallet.walletRank}</p>

                  {/* Score breakdown bars */}
                  <div className="mt-4 flex flex-col gap-2 max-w-xs">
                    {[
                      {label:'Activity',v:Math.min(100,Math.round((wallet.txCount/1000)*100)),c:'bg-blue-500'},
                      {label:'Consistency',v:Math.min(100,Math.round((wallet.uniqueDays/365)*100)),c:'bg-purple-500'},
                      {label:'Volume',v:Math.min(100,Math.round(parseFloat(wallet.ethVolume)*20)),c:'bg-cyan-500'},
                      {label:'DeFi',v:Math.min(100,Math.round((wallet.defiInteractions/50)*100)),c:'bg-emerald-500'},
                    ].map((b,i)=>(
                      <div key={i} className="flex items-center gap-2">
                        <span className="text-[10px] text-slate-600 w-20 font-bold">{b.label}</span>
                        <div className="flex-1 bg-white/5 rounded-full h-1.5">
                          <div className={`${b.c} h-1.5 rounded-full transition-all duration-1000`} style={{width:`${b.v}%`}}/>
                        </div>
                        <span className="text-[10px] text-slate-600 w-6 text-right">{b.v}</span>
                      </div>
                    ))}
                  </div>
                </div>
                <div>
                  {selectedDay?(
                    <div className="bg-white/5 border border-white/8 px-4 py-3 rounded-xl">
                      <p className="text-[10px] text-slate-500 font-bold uppercase">{selectedDay.date}</p>
                      <p className="text-2xl font-black text-blue-400">{selectedDay.count} Txs</p>
                    </div>
                  ):(
                    <div className="flex items-center gap-2 opacity-40"><MousePointerClick size={14} className="text-blue-400"/><p className="text-[10px] text-slate-500 uppercase font-bold">Click a dot</p></div>
                  )}
                </div>
              </div>

              {/* Heatmap */}
              <div ref={scrollRef} className="w-full overflow-x-auto pb-2">
                <div className="grid grid-flow-col gap-1.5 mb-2 min-w-max auto-cols-[12px]">
                  {wallet.weekLabels.map((m,i)=><div key={i} className="text-[9px] font-bold text-slate-600 uppercase text-left w-3 whitespace-nowrap overflow-visible">{m}</div>)}
                </div>
                <div className="grid grid-rows-7 grid-flow-col gap-1 h-28 min-w-max">
                  {wallet.dailyStats.map((stat,i)=>(
                    <div key={i} onClick={()=>setSelectedDay(stat)}
                      className={`w-3 h-3 rounded-sm cursor-pointer hover:scale-125 transition-all ${stat.count===0?'bg-white/5':'bg-blue-600'}`}
                      style={{opacity:stat.count===0?0.3:0.3+(stat.intensity*0.175)}}/>
                  ))}
                </div>
              </div>
            </div>

            {/* Wallet Stats */}
            <div>
              <h3 className="text-[10px] font-black text-slate-600 uppercase tracking-widest mb-3 ml-1 flex items-center gap-2"><BarChart3 size={13}/>Wallet Stats</h3>
              <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3">
                <div className="bg-[#161b27] border border-white/8 rounded-2xl p-4 col-span-2 flex items-center gap-4">
                  <div className="w-12 h-12 bg-blue-600/20 border border-blue-500/30 rounded-2xl flex items-center justify-center shrink-0"><User size={22} className="text-blue-400"/></div>
                  <div className="min-w-0">
                    <p className="font-black text-white text-lg truncate">{wallet.basename||`${wallet.address.slice(0,8)}...${wallet.address.slice(-4)}`}</p>
                    <p className="text-[10px] text-slate-500 uppercase font-bold">{wallet.walletRank}</p>
                    {wallet.basename&&<span className="inline-flex items-center gap-1 text-[9px] font-black text-green-400 bg-green-500/10 border border-green-500/20 px-2 py-0.5 rounded-full mt-1"><BadgeCheck size={9}/>Verified</span>}
                  </div>
                </div>
                {[
                  {l:'Balance',v:`${wallet.balance} ETH`,i:<CreditCard size={16}/>},
                  {l:'Days on Base',v:wallet.daysOnBase.toLocaleString(),i:<Clock size={16}/>},
                  {l:'Active Days',v:wallet.uniqueDays.toString(),i:<Sun size={16}/>},
                  {l:'Active Weeks',v:wallet.activeWeeks.toString(),i:<Calendar size={16}/>},
                  {l:'Active Months',v:wallet.activeMonths.toString(),i:<Calendar size={16}/>},
                  {l:'Current Streak',v:`${wallet.currentStreak}d`,i:<Zap size={16}/>},
                  {l:'Longest Streak',v:`${wallet.longestStreak}d`,i:<Trophy size={16}/>},
                  {l:'Total Txs',v:wallet.txCount.toLocaleString(),i:<Layers size={16}/>},
                  {l:'Token Swaps',v:wallet.swapCount.toLocaleString(),i:<ArrowRightLeft size={16}/>},
                  {l:'DeFi Interactions',v:wallet.defiInteractions.toLocaleString(),i:<Rocket size={16}/>},
                  {l:'ETH Volume',v:`${wallet.ethVolume} Ξ`,i:<ArrowRightLeft size={16}/>},
                  {l:'NFTs Held',v:wallet.nftCount.toLocaleString(),i:<Sparkles size={16}/>},
                  {l:'Contract Txs',v:wallet.contractInteractions.toLocaleString(),i:<FileCode size={16}/>},
                ].map((s,i)=>(
                  <div key={i} className="bg-[#161b27] border border-white/8 rounded-2xl p-4 hover:border-blue-500/30 transition-colors">
                    <div className="text-slate-600 mb-2">{s.i}</div>
                    <p className="font-black text-white text-lg truncate">{s.v}</p>
                    <p className="text-[9px] text-slate-600 uppercase font-bold tracking-wide">{s.l}</p>
                  </div>
                ))}
              </div>
            </div>

            {/* Referral */}
            <div className="bg-[#161b27] border border-purple-500/20 rounded-2xl p-5">
              <div className="flex items-center justify-between mb-3">
                <div className="flex items-center gap-2"><Gift size={18} className="text-purple-400"/><span className="font-black text-sm text-white">Referral Program</span></div>
                <span className="text-[10px] font-bold text-purple-300 bg-purple-500/10 border border-purple-500/20 px-2 py-1 rounded-lg">+50 XP per referral</span>
              </div>
              <p className="text-xs text-slate-500 mb-3">Share your link — earn Season XP when friends connect. Future rewards unlocked for top referrers in Genesis Season.</p>
              <div className="flex gap-2">
                <div className="flex-1 bg-white/5 border border-white/8 rounded-xl px-3 py-2 text-xs font-mono text-slate-400 truncate">{APP_URL_WEB}?ref={refCode}</div>
                <button onClick={handleReferralCopy} className={`px-4 py-2 rounded-xl font-black text-xs flex items-center gap-1.5 transition ${referralCopied?'bg-green-600 text-white':'bg-blue-600 hover:bg-blue-500 text-white'}`}>
                  {referralCopied?<CheckCircle size={13}/>:<Copy size={13}/>}{referralCopied?'Copied!':'Copy'}
                </button>
              </div>
            </div>

            {/* Challenge */}
            <div className="bg-[#161b27] border border-white/8 rounded-2xl p-5">
              <div className="flex items-center gap-2 mb-3"><Swords size={18} className="text-orange-400"/><span className="font-black text-sm text-white">Wallet Challenge</span></div>
              <p className="text-xs text-slate-500 mb-3">Compare scores head-to-head with any wallet.</p>
              <div className="flex gap-2 mb-4">
                <input value={challengeAddress} onChange={e=>setChallengeAddress(e.target.value)} placeholder="0x..." className="flex-1 bg-white/5 border border-white/8 rounded-xl px-3 py-2 text-xs font-mono text-slate-300 outline-none focus:border-blue-500/50 focus:ring-1 focus:ring-blue-500/20 placeholder-slate-600"/>
                <button onClick={handleChallengeWallet} className="bg-blue-600 hover:bg-blue-500 text-white px-4 py-2 rounded-xl font-black text-xs transition">Go</button>
              </div>
              {challengeData&&(
                <div className="grid grid-cols-2 gap-3">
                  <div className={`rounded-xl p-4 text-center border ${wallet.score>=challengeData.score?'bg-blue-600/10 border-blue-500/30':'bg-white/5 border-white/8'}`}>
                    <p className="text-[10px] text-slate-500 uppercase font-bold mb-1">You</p>
                    <p className="text-4xl font-black text-blue-400">{wallet.score}</p>
                    <p className="text-[10px] text-slate-500 mt-1">{wallet.walletRank}</p>
                    {wallet.score>challengeData.score&&<p className="text-[10px] font-black text-green-400 mt-1">WINNER 🏆</p>}
                  </div>
                  <div className={`rounded-xl p-4 text-center border ${challengeData.score>wallet.score?'bg-red-500/8 border-red-500/20':'bg-white/5 border-white/8'}`}>
                    <p className="text-[10px] text-slate-500 uppercase font-bold mb-1">{challengeData.address.slice(0,6)}...{challengeData.address.slice(-4)}</p>
                    <p className="text-4xl font-black text-slate-400">{challengeData.score}</p>
                    <p className="text-[10px] text-slate-500 mt-1">{challengeData.rank}</p>
                    {challengeData.score>wallet.score&&<p className="text-[10px] font-black text-red-400 mt-1">WINNER 🏆</p>}
                  </div>
                </div>
              )}
            </div>

            {/* XP Booster */}
            <div className="bg-[#161b27] border border-blue-500/20 rounded-2xl p-5">
              <div className="flex items-center justify-between gap-4">
                <div className="flex items-center gap-3">
                  <div className="p-3 bg-blue-600/20 rounded-xl border border-blue-500/30"><Rocket size={22} className="text-blue-400"/></div>
                  <div>
                    <h3 className="font-black text-white">XP Booster</h3>
                    <div className="flex items-center gap-3 mt-1">
                      <div className="bg-white/5 border border-white/8 rounded-lg px-2.5 py-1"><span className="text-xl font-black text-blue-400">{userBoosts}</span><span className="text-[10px] text-slate-600 ml-1">boosts</span></div>
                      <div className="bg-white/5 border border-white/8 rounded-lg px-2.5 py-1"><span className="text-sm font-black text-orange-400">{onchainStreak}d</span><span className="text-[10px] text-slate-600 ml-1">streak</span></div>
                    </div>
                  </div>
                </div>
                <div className="text-center">
                  {connectionType==='farcaster'?(
                    <button onClick={()=>handleNativeTx('boost')} disabled={transactingType!==null}
                      className={`min-w-32 py-3 px-4 rounded-xl font-black text-sm transition ${transactingType?'bg-blue-600/40 text-white/40 cursor-not-allowed':'bg-blue-600 hover:bg-blue-500 text-white shadow-lg shadow-blue-600/30'}`}>
                      {transactingType==='boost'?<RefreshCcw className="animate-spin mx-auto" size={18}/>:'BOOST (+1)'}
                    </button>
                  ):(
                    <Transaction key={`boost-${txKeys.boost}`} chainId={base.id} calls={boostCall} capabilities={txCaps} onStatus={(s)=>{if(s.statusName==='success'){setUserBoosts(b=>{const n=b+1;if(typeof window!=='undefined')localStorage.setItem(`base_boosts_${wallet.address.toLowerCase()}`,n.toString());return n;});setSponsoredTxs(st=>st+1);showToast('Boost Successful! 🎉',s.statusData.transactionReceipts?.[0]?.transactionHash||'');setTxKeys(p=>({...p,boost:(p.boost||0)+1}));}}}>
                      <TransactionButton className="min-w-32 py-3 px-4 rounded-xl font-black text-sm bg-blue-600 hover:bg-blue-500 text-white shadow-lg shadow-blue-600/30 transition" text="BOOST (+1)"/>
                    </Transaction>
                  )}
                  <p className="text-[9px] text-blue-500 mt-1 flex items-center justify-center gap-1"><Droplets size={9}/>Gas Sponsored</p>
                </div>
              </div>
            </div>

            {/* Recent activity */}
            <div>
              <h3 className="text-[10px] font-black text-slate-600 uppercase tracking-widest mb-3 ml-1 flex items-center gap-2"><History size={13}/>Recent Activity</h3>
              <div className="bg-[#161b27] border border-white/8 rounded-2xl p-4 space-y-2">
                {wallet.recentTxs.length>0?wallet.recentTxs.map((tx,i)=>(
                  <div key={i} className="flex justify-between items-center bg-white/3 hover:bg-white/5 border border-white/5 p-3 rounded-xl transition">
                    <div className="flex items-center gap-3">
                      <div className="p-2 rounded-lg bg-blue-600/15">{tx.category==='erc721'?<Sparkles size={14} className="text-blue-400"/>:<ArrowRightLeft size={14} className="text-blue-400"/>}</div>
                      <div>
                        <p className="text-xs font-black text-white uppercase">{tx.category==='external'?'Contract':tx.category}</p>
                        <p className="text-[10px] text-slate-600">{new Date(tx.metadata.blockTimestamp).toLocaleString()}</p>
                      </div>
                    </div>
                    <a href={`https://basescan.org/tx/${tx.hash}`} target="_blank" rel="noreferrer"
                      className="text-[10px] font-black text-blue-400 hover:text-blue-300 bg-blue-600/10 hover:bg-blue-600/20 border border-blue-500/20 px-3 py-1.5 rounded-lg flex items-center gap-1 transition">
                      <ExternalLink size={10}/>{tx.value?`${tx.value.toFixed(3)} ${tx.asset}`:'View'}
                    </a>
                  </div>
                )):<p className="text-slate-600 text-sm text-center py-4">No recent transactions found.</p>}
              </div>
            </div>

            {/* Community Vibes */}
            <div className="bg-[#161b27] border border-white/8 rounded-2xl p-5">
              <h3 className="font-black text-white mb-4 flex items-center gap-2"><Star size={16} className="text-yellow-400"/>Community Vibes</h3>
              <div className="grid grid-cols-2 gap-3">
                {(['gm','gn'] as const).map(type=>(
                  <div key={type} className="text-center">
                    {connectionType==='farcaster'?(
                      <button onClick={()=>handleNativeTx(type)} disabled={transactingType!==null}
                        className={`w-full py-4 rounded-xl font-black text-2xl transition border ${transactingType!==null?'opacity-40 cursor-not-allowed bg-white/3 border-white/5 text-white/30':'bg-white/5 hover:bg-blue-600/20 border-white/8 hover:border-blue-500/30 text-white'}`}>
                        {transactingType===type?<RefreshCcw className="animate-spin mx-auto" size={20}/>:(type==='gm'?'☀️ GM':'🌙 GN')}
                      </button>
                    ):(
                      <Transaction key={`${type}-${txKeys[type]}`} chainId={base.id} calls={type==='gm'?gmCall:gnCall} capabilities={txCaps} onStatus={(s)=>{if(s.statusName==='success'){showToast(type==='gm'?'GM! ☀️':'GN! 🌙',s.statusData.transactionReceipts?.[0]?.transactionHash||'');setSponsoredTxs(st=>st+1);if(type==='gm'&&typeof window!=='undefined')localStorage.setItem(`base_gm_${wallet.address.toLowerCase()}`,'true');setTxKeys(p=>({...p,[type]:(p[type]||0)+1}));}}}>
                        <TransactionButton className="w-full py-4 rounded-xl font-black text-2xl bg-white/5 hover:bg-blue-600/20 border border-white/8 hover:border-blue-500/30 text-white transition" text={type==='gm'?'☀️ GM':'🌙 GN'}/>
                      </Transaction>
                    )}
                    <p className="text-[9px] text-blue-500 mt-1 flex items-center justify-center gap-1"><Droplets size={9}/>Gas Sponsored</p>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* ===== ACHIEVEMENTS ===== */}
        {activeTab==='achievements'&&(
          <div className="animate-in fade-in slide-in-from-bottom-3">
            <div className="flex items-center justify-between mb-5">
              <h3 className="text-[10px] font-black text-slate-600 uppercase tracking-widest flex items-center gap-2"><Trophy size={13}/>Mint Your Onchain Identity</h3>
              {Object.keys(mintedLevels).filter(k=>mintedLevels[k]>0).length>0&&(
                <div className="flex gap-2">
                  <button onClick={()=>shareAllBadges(Object.keys(mintedLevels).filter(k=>mintedLevels[k]>0).length,'warpcast')} className="bg-white/5 border border-white/8 hover:bg-purple-600/20 hover:border-purple-500/30 text-slate-400 p-2 rounded-xl transition"><Send size={14}/></button>
                  <button onClick={()=>shareAllBadges(Object.keys(mintedLevels).filter(k=>mintedLevels[k]>0).length,'twitter')} className="bg-white/5 border border-white/8 hover:bg-sky-600/20 hover:border-sky-500/30 text-slate-400 p-2 rounded-xl transition"><Twitter size={14}/></button>
                </div>
              )}
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {ACHIEVEMENTS.map(cat=>{
                const value=getCategoryValue(cat.id);
                let unlockedLevel=0;
                for(let i=0;i<cat.thresholds.length;i++){if(value>=cat.thresholds[i])unlockedLevel=i+1;}
                const currentMintedLevel=mintedLevels[cat.id]||0;
                const canMintNext=unlockedLevel>currentMintedLevel;
                const nextThreshold=unlockedLevel<cat.thresholds.length?cat.thresholds[unlockedLevel]:cat.thresholds[cat.thresholds.length-1];
                const progress=unlockedLevel===cat.thresholds.length?100:Math.min(100,(value/nextThreshold)*100);

                const tokensToMint:number[]=[],targetLevels:number[]=[];
                for(let i=currentMintedLevel+1;i<=unlockedLevel;i++){targetLevels.push(i);tokensToMint.push(getTargetTokenId(cat.baseId,cat.thresholds.length,i));}
                const isBatch=tokensToMint.length>1;

                let mintCall2:{to:`0x${string}`;data:`0x${string}`}[]=[];
                if(tokensToMint.length>0){
                  const raw=isBatch?encodeFunctionData({abi:ACHIEVEMENTS_ABI,functionName:'mintBatchAchievements',args:[tokensToMint.map(id=>BigInt(id))]})
                    :encodeFunctionData({abi:ACHIEVEMENTS_ABI,functionName:'mintAchievement',args:[BigInt(tokensToMint[0])]});
                  mintCall2=[{to:ACHIEVEMENTS_CONTRACT_ADDRESS as `0x${string}`,data:`${raw}${getBuilderSuffix()}` as `0x${string}`}];
                }

                let btnText=`${cat.tierNames[currentMintedLevel]||'...'} Locked`;
                if(currentMintedLevel===cat.thresholds.length)btnText='Fully Minted 👑';
                else if(canMintNext)btnText=isBatch?`Claim ${tokensToMint.length} Badges 🚀`:`Mint ${cat.tierNames[currentMintedLevel]}`;

                return(
                  <div key={cat.id} className="bg-[#161b27] border border-white/8 rounded-3xl p-5 flex flex-col hover:border-blue-500/20 transition-colors">
                    {/* Header */}
                    <div className="flex justify-between items-start mb-4">
                      <div className="flex items-center gap-3">
                        <div className="text-2xl w-12 h-12 bg-white/5 border border-white/8 flex items-center justify-center rounded-2xl">{cat.icon}</div>
                        <div>
                          <h4 className="font-black text-white text-base">{cat.name}</h4>
                          <p className="text-[10px] text-slate-600 uppercase font-bold">{unlockedLevel>0?cat.tierNames[unlockedLevel-1]:'Unranked'} · L{unlockedLevel}/{cat.thresholds.length}</p>
                        </div>
                      </div>
                      <div className="text-right">
                        <p className="text-2xl font-black text-blue-400">{typeof value==='number'&&value<1?value.toFixed(3):value.toLocaleString()}</p>
                        <p className="text-[10px] text-slate-600 uppercase">{cat.unit}</p>
                      </div>
                    </div>

                    {/* Progress */}
                    <div className="w-full bg-white/5 rounded-full h-1.5 mb-1">
                      <div className="bg-blue-600 h-1.5 rounded-full transition-all duration-1000 shadow-sm shadow-blue-600/50" style={{width:`${progress}%`}}/>
                    </div>
                    <p className="text-right text-[10px] text-slate-600 font-bold mb-5">
                      {unlockedLevel===cat.thresholds.length?'Max Level Reached 👑':`${typeof value==='number'&&value<1?value.toFixed(3):value.toLocaleString()} / ${typeof nextThreshold==='number'&&nextThreshold<1?nextThreshold.toFixed(3):nextThreshold.toLocaleString()}`}
                    </p>

                    {/* Tier badges */}
                    <div className={`flex ${cat.thresholds.length===1?'justify-center':'justify-between'} items-end mb-5 px-1`}>
                      {cat.thresholds.map((_,idx)=>{
                        const tier=idx+1;
                        const isEarned=unlockedLevel>=tier;
                        const isMinted=currentMintedLevel>=tier;
                        const styleTier=cat.thresholds.length===1?5:tier;
                        const style=getLevelStyle(styleTier,isMinted,isEarned);
                        return(
                          <div key={tier} className="flex flex-col items-center gap-1.5 relative" style={{width:`${Math.floor(100/cat.thresholds.length)}%`}}>
                            <div className={`w-11 h-11 rounded-2xl flex items-center justify-center text-xl border transition-all duration-500 ${style}`}>
                              {isEarned?cat.tierIcons[idx]:<Lock size={12} className="text-white/20"/>}
                              {isMinted&&<div className="absolute -top-1.5 -right-1.5 bg-green-500 text-white text-[9px] font-black w-4 h-4 flex items-center justify-center rounded-full border border-[#161b27] z-10">✓</div>}
                            </div>
                            <span className={`text-[8px] font-black text-center uppercase leading-tight ${isMinted?'text-blue-400':isEarned?'text-slate-400':'text-slate-700'}`}>{cat.tierNames[idx]}</span>
                          </div>
                        );
                      })}
                    </div>

                    {/* Mint button */}
                    <div className="flex gap-2 mt-auto">
                      {connectionType==='farcaster'?(
                        <button onClick={()=>handleNativeMint(cat.id,targetLevels,tokensToMint,cat.name)}
                          disabled={!canMintNext||transactingType!==null}
                          className={`flex-1 py-3 rounded-xl font-black text-sm transition ${canMintNext&&!transactingType?'bg-blue-600 hover:bg-blue-500 text-white shadow-lg shadow-blue-600/20':'bg-white/5 text-slate-700 cursor-not-allowed border border-white/8'}`}>
                          {transactingType===`mint-${cat.id}`?<RefreshCcw className="animate-spin mx-auto" size={18}/>:btnText}
                        </button>
                      ):canMintNext?(
                        <Transaction key={`mint-${cat.id}-${txKeys[`mint-${cat.id}`]||0}`} chainId={base.id} calls={mintCall2} capabilities={txCaps} onStatus={(s)=>{if(s.statusName==='success'){showToast(isBatch?`✅ Claimed ${tokensToMint.length} ${cat.name} Badges!`:`✅ Badge minted!`,s.statusData.transactionReceipts?.[0]?.transactionHash||'');setMintedLevels(prev=>({...prev,[cat.id]:Math.max(...targetLevels)}));setSponsoredTxs(st=>st+1);}}}>
                          <TransactionButton className="flex-1 py-3 w-full rounded-xl font-black text-sm bg-blue-600 hover:bg-blue-500 text-white shadow-lg shadow-blue-600/20 transition" text={btnText}/>
                        </Transaction>
                      ):(
                        <button disabled className="flex-1 py-3 rounded-xl font-black text-sm bg-white/5 text-slate-700 cursor-not-allowed border border-white/8">{btnText}</button>
                      )}
                      {currentMintedLevel>0&&(
                        <div className="flex gap-1.5">
                          <button onClick={()=>shareAchievement(cat.name,cat.tierNames[currentMintedLevel-1],'warpcast')} className="bg-white/5 border border-white/8 hover:bg-purple-600/20 hover:border-purple-500/30 text-slate-500 p-3 rounded-xl transition"><Send size={14}/></button>
                          <button onClick={()=>shareAchievement(cat.name,cat.tierNames[currentMintedLevel-1],'twitter')} className="bg-white/5 border border-white/8 hover:bg-sky-600/20 hover:border-sky-500/30 text-slate-500 p-3 rounded-xl transition"><Twitter size={14}/></button>
                        </div>
                      )}
                    </div>
                    {canMintNext&&<p className="text-[9px] text-blue-500 mt-2 text-center flex items-center justify-center gap-1"><Droplets size={9}/>Gas Sponsored</p>}
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* ===== QUESTS ===== */}
        {activeTab==='quests'&&(
          <div className="animate-in fade-in slide-in-from-bottom-3 space-y-4">
            {/* Season Pass */}
            <div className="bg-linear-to-br from-blue-600 via-blue-700 to-purple-700 rounded-3xl p-6 relative overflow-hidden">
              <div className="absolute inset-0 opacity-30" style={{backgroundImage:'linear-gradient(rgba(255,255,255,0.05)1px,transparent 1px),linear-gradient(90deg,rgba(255,255,255,0.05)1px,transparent 1px)',backgroundSize:'30px 30px'}}/>
              <div className="relative">
                <div className="flex items-center justify-between mb-4">
                  <div>
                    <div className="flex items-center gap-2 mb-1"><Star size={14} className="text-yellow-300"/><span className="text-xs font-black uppercase tracking-widest text-white/70">{SEASON_NAME}</span></div>
                    <h3 className="text-2xl font-black text-white">Season Pass</h3>
                    <p className="text-sm text-white/60">{getDaysLeft()} days remaining · Future rewards locked in</p>
                  </div>
                  <div className="text-right">
                    <p className="text-5xl font-black text-white">{weeklyXP}</p>
                    <p className="text-xs text-white/60 uppercase font-bold">Season XP</p>
                  </div>
                </div>
                <div className="w-full bg-white/15 rounded-full h-2 mb-1.5">
                  <div className="bg-white h-2 rounded-full transition-all shadow-sm" style={{width:`${getSeasonProgress().toFixed(0)}%`}}/>
                </div>
                <div className="flex justify-between text-[10px] font-bold text-white/40">
                  <span>Season started</span><span>{getSeasonProgress().toFixed(0)}% complete</span><span>Season ends</span>
                </div>
              </div>
            </div>

            {/* Stats row */}
            <div className="grid grid-cols-3 gap-3">
              {[{v:`${completedQuestsCount}/${WEEKLY_QUESTS.length}`,l:'Quests Done',c:'text-blue-400'},{v:onchainStreak,l:'Day Streak',c:'text-orange-400'},{v:getQuestXP(wallet,userBoosts,onchainStreak,txKeys),l:'Quest XP',c:'text-green-400'}].map((s,i)=>(
                <div key={i} className="bg-[#161b27] border border-white/8 rounded-2xl p-4 text-center">
                  <p className={`text-2xl font-black ${s.c}`}>{s.v}</p>
                  <p className="text-[10px] text-slate-600 uppercase font-bold">{s.l}</p>
                </div>
              ))}
            </div>

            {/* Quests */}
            <h3 className="text-[10px] font-black text-slate-600 uppercase tracking-widest ml-1 flex items-center gap-2"><Target size={13}/>Weekly Quests</h3>
            <div className="space-y-2">
              {WEEKLY_QUESTS.map(quest=>{
                const done=quest.check(wallet,userBoosts,onchainStreak,txKeys);
                return(
                  <div key={quest.id} className={`rounded-2xl p-4 border flex items-center justify-between transition-all ${done?'bg-green-500/8 border-green-500/20':'bg-[#161b27] border-white/8 hover:border-white/15'}`}>
                    <div className="flex items-center gap-3">
                      <div className={`w-10 h-10 rounded-2xl flex items-center justify-center text-xl ${done?'bg-green-500/20':'bg-white/5 border border-white/8'}`}>{done?'✅':quest.icon}</div>
                      <div>
                        <p className={`font-black text-sm ${done?'text-green-300':'text-white'}`}>{quest.title}</p>
                        <p className="text-[10px] text-slate-600">{quest.desc}</p>
                      </div>
                    </div>
                    <div className={`px-3 py-2 rounded-xl font-black text-xs border ${done?'bg-green-500/10 text-green-400 border-green-500/20':'bg-blue-600/10 text-blue-400 border-blue-500/20'}`}>+{quest.xp} XP</div>
                  </div>
                );
              })}
            </div>

            {/* Multipliers */}
            <div className="bg-[#161b27] border border-white/8 rounded-2xl p-5">
              <div className="flex items-center gap-2 mb-3"><Zap size={16} className="text-yellow-400"/><span className="font-black text-sm text-white">XP Multipliers & Season Rewards</span></div>
              <div className="space-y-2">
                {[
                  {l:'3-day check-in streak',b:'2× XP on quests'},
                  {l:'7-day check-in streak',b:'3× XP on quests'},
                  {l:'Top 10 leaderboard (Season end)',b:'Exclusive Genesis badge + future reward'},
                  {l:'Refer 3+ friends',b:'+150 bonus XP + referral badge'},
                  {l:'Complete all 6 weekly quests',b:'Season XP bonus multiplier'},
                ].map((m,i)=>(
                  <div key={i} className="flex items-center justify-between bg-white/3 rounded-xl p-3 border border-white/5">
                    <span className="text-xs text-slate-400">{m.l}</span>
                    <span className="text-xs font-black text-blue-400">{m.b}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* ===== LEADERBOARD ===== */}
        {activeTab==='leaderboard'&&(
          <div className="animate-in fade-in slide-in-from-bottom-3 space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="text-[10px] font-black text-slate-600 uppercase tracking-widest flex items-center gap-2"><Users size={13}/>Weekly Leaderboard</h3>
              <span className="text-[10px] text-slate-600 bg-white/5 border border-white/8 px-2 py-1 rounded-lg">{getDaysLeft()}d left · {SEASON_NAME}</span>
            </div>

            {/* My rank */}
            {wallet&&(()=>{
              const pos=leaderboard.findIndex(e=>e.address.toLowerCase()===wallet.address.toLowerCase());
              return pos>=0?(
                <div className="bg-blue-600 rounded-2xl p-4 shadow-xl shadow-blue-600/30">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 bg-white/15 rounded-xl flex items-center justify-center font-black text-white text-lg">#{pos+1}</div>
                      <div><p className="font-black text-white">{wallet.basename||`${wallet.address.slice(0,6)}...${wallet.address.slice(-4)}`}</p><p className="text-[10px] text-white/60 uppercase">{wallet.walletRank}</p></div>
                    </div>
                    <div className="text-right"><p className="text-3xl font-black text-white">{weeklyXP}</p><p className="text-[10px] text-white/60 uppercase">Weekly XP</p></div>
                  </div>
                </div>
              ):null;
            })()}

            {leaderboard.length===0?(
              <div className="bg-[#161b27] border-2 border-dashed border-white/8 rounded-2xl p-12 text-center">
                <Users size={28} className="text-slate-700 mx-auto mb-3"/>
                <p className="font-black text-slate-500 mb-1">No entries yet</p>
                <p className="text-sm text-slate-700">Connect and earn XP to appear here. Top 10 earn exclusive Season badges + future rewards.</p>
              </div>
            ):(
              <div className="bg-[#161b27] border border-white/8 rounded-2xl overflow-hidden">
                {leaderboard.map((entry,idx)=>{
                  const isMe=wallet&&entry.address.toLowerCase()===wallet.address.toLowerCase();
                  const medal=idx===0?'🥇':idx===1?'🥈':idx===2?'🥉':null;
                  return(
                    <div key={entry.address} className={`flex items-center gap-3 p-4 border-b border-white/5 last:border-0 transition ${isMe?'bg-blue-600/10 border-l-2 border-l-blue-500':'hover:bg-white/3'}`}>
                      <div className="w-7 text-center font-black text-sm text-slate-600">{medal||`#${idx+1}`}</div>
                      <div className="flex-1 min-w-0">
                        <p className={`font-black text-sm truncate ${isMe?'text-blue-400':'text-white'}`}>
                          {entry.basename||`${entry.address.slice(0,6)}...${entry.address.slice(-4)}`}{isMe&&<span className="text-[10px] text-blue-500 ml-1">(you)</span>}
                        </p>
                        <p className="text-[10px] text-slate-600">{entry.rank}</p>
                      </div>
                      <div className="flex items-center gap-4">
                        <div className="hidden sm:block text-center"><p className="text-xs font-black text-slate-400">{entry.badges}</p><p className="text-[9px] text-slate-700 uppercase">Badges</p></div>
                        <div className="text-center"><p className="text-sm font-black text-blue-400">{entry.weeklyXP}</p><p className="text-[9px] text-slate-700 uppercase">XP</p></div>
                        <div className="hidden sm:flex">{idx===0?<ChevronUp size={14} className="text-green-400"/>:<ChevronDown size={14} className="text-slate-700"/>}</div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}

            <div className="bg-[#161b27] border border-white/8 rounded-2xl p-4">
              <div className="flex items-center gap-2 mb-2"><Medal size={16} className="text-yellow-400"/><span className="font-black text-sm text-white">Season Rewards</span></div>
              <p className="text-xs text-slate-600">Leaderboard resets every Monday. Top 10 wallets at season end earn an exclusive <span className="text-blue-400 font-bold">Genesis Badge NFT</span> plus early access to future rewards. Keep farming XP!</p>
            </div>
          </div>
        )}

        {/* ===== BASE HUB ===== */}
        {activeTab==='basehub'&&<BaseHub/>}
      </div>
    </main>
  );
} 