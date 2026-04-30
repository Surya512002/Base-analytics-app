"use client";

import { useState, useEffect, useRef, useCallback } from 'react';
import {
  Wallet, Activity, Zap, Layers, Calendar, ArrowRightLeft, Power, BookOpen,
  RefreshCcw, Sun, FileCode, BarChart3, Trophy,
  CreditCard, User, BadgeCheck, Send, X, AlertTriangle,
  ChevronRight, Share2, Rocket, Twitter, MousePointerClick, Clock, Sparkles, History, Droplets, Lock,
  Flame, Gift, Users, Target, Star, CheckCircle, Copy, ExternalLink, ChevronUp, ChevronDown, Swords, Medal,
  TrendingUp, Wifi, Database, Palette, Coins
} from 'lucide-react';
import { JsonRpcProvider, formatEther, toUtf8Bytes } from 'ethers';
import sdk from "@farcaster/miniapp-sdk";
import { connectWallet } from './connection';
import BaseHub from '../components/BaseHub';
import { encodeFunctionData, createPublicClient, http } from 'viem';
import { base } from 'viem/chains';
import { Transaction, TransactionButton } from '@coinbase/onchainkit/transaction';

const ALCHEMY_KEY = process.env.NEXT_PUBLIC_ALCHEMY_KEY || "mn8s-DCTchMi4q2DEKasm";
const BASE_RPC    = `https://base-mainnet.g.alchemy.com/v2/${ALCHEMY_KEY}`;
const MINIAPP_URL = "https://farcaster.xyz/miniapps/lYFXQz4s1wsq/base-analytics";
const APP_URL_WEB = "https://base-analytics-app.vercel.app";
const BUILDER_CODE = "bc_4uoh9iu2";
const PAYMASTER_URL = process.env.NEXT_PUBLIC_PAYMASTER_URL || "";

function getBuilderSuffix(){
  const cb=toUtf8Bytes(BUILDER_CODE);
  const hex=Array.from(cb).map((b:number)=>b.toString(16).padStart(2,'0')).join('');
  return `${hex}${cb.length.toString(16).padStart(2,'0')}0080218021802180218021802180218021`;
}

const BOOSTER_CONTRACT    = "0xd14E38239791738e8aCbd0Ad5278496af26fF510";
const GM_GN_CONTRACT      = "0xc801bCe6739D30C409151a544F0baEd10EB719dE";
const ACHIEVEMENTS_CONTRACT = "0xadb8120B4B18b892cFAD171243074487122Dea03";
const CHECKIN_CONTRACT    = "0xABc7099C631E18640ea60b25116407aa17354FBb";

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

const BOOSTER_ABI   = [{name:'boost',type:'function',stateMutability:'payable',inputs:[],outputs:[]}] as const;
const GM_GN_ABI     = [
  {name:'gm',type:'function',stateMutability:'payable',inputs:[],outputs:[]},
  {name:'gn',type:'function',stateMutability:'payable',inputs:[],outputs:[]}
] as const;

const DEFI_PROTOCOLS = [
  "0xcf77a3ba9a5ca399b7c97c74d54e5b1beb874e43","0x3ddfa8ec3052539b6c9549f12cea2c295cff5296",
  "0x8ebaf22e6f05b4fbce41712019ba2289f631eff2","0x000000000022d473030f116ddee9f6b43ac78ba3",
  "0x3b6067d4caa8a14c63fdbe6318f27a0bbc9f9237","0x280b3b748ccc42d5062ce59111fad08594f51d9f",
  "0x4200000000000000000000000000000000000006",
];

const MONTHS = ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"];

const ACHIEVEMENTS = [
  {id:'score',  baseId:10, name:'Onchain Rank',  icon:'🏅',unit:'Score',   thresholds:[10,30,60,75,85],    tierNames:["Base Shrimp","Base Dolphin","Base Shark","Base Whale","Base God"],       tierIcons:["🦐","🐬","🦈","🐋","👑"]},
  {id:'age',    baseId:20, name:'Pioneer',        icon:'📅',unit:'Days',    thresholds:[10,30,90,180,365],   tierNames:["Newcomer","Explorer","Settler","Veteran","Early Adopter"],               tierIcons:["🥚","🧭","⛺","🎖️","🛸"]},
  {id:'name',   baseId:30, name:'Identity',       icon:'📛',unit:'Basename',thresholds:[1],                 tierNames:["Verified"],                                                              tierIcons:["🆔"]},
  {id:'days',   baseId:40, name:'Diamond Hands',  icon:'💎',unit:'Days',    thresholds:[10,50,100,200,365],  tierNames:["Tourist","Resident","Citizen","Patriot","Immortal"],                    tierIcons:["🎒","🏠","🏛️","🛡️","🗿"]},
  {id:'contract',baseId:50,name:'Base Builder',   icon:'🧱',unit:'Txs',    thresholds:[10,50,100,500,1000], tierNames:["Tinkerer","Apprentice","Engineer","Architect","Master Builder"],         tierIcons:["🔧","🔨","📐","🏗️","🌆"]},
  {id:'volume', baseId:60, name:'Whale Alert',    icon:'💰',unit:'ETH',     thresholds:[0.001,0.01,0.1,1.0,5.0],tierNames:["Guppy","Puffer","Angelfish","Sailboat","Leviathan"],              tierIcons:["🐟","🐡","🐠","⛵","🚢"]},
  {id:'txs',    baseId:70, name:'Power User',     icon:'📈',unit:'Txs',     thresholds:[10,50,100,500,1000], tierNames:["Spark","Bolt","Surge","Lightning","Storm"],                            tierIcons:["✨","🌩️","🌊","⚡","🌪️"]},
  {id:'swaps',  baseId:80, name:'DeFi Degen',     icon:'🔄',unit:'Swaps',   thresholds:[3,10,25,50,100],    tierNames:["Swapper","Trader","Provider","Yield Farmer","DeFi God"],               tierIcons:["🪙","📈","🏦","🚜","🦄"]},
  {id:'nfts',   baseId:90, name:'Collector',      icon:'👾',unit:'NFTs',    thresholds:[3,10,25,50,100],    tierNames:["Scout","Gatherer","Curator","Connoisseur","NFT Whale"],                 tierIcons:["👁️","🧺","🖼️","🍷","🎨"]},
  {id:'streak', baseId:100,name:'Streak Master',  icon:'🎯',unit:'Days',    thresholds:[3,7,14,30,100],     tierNames:["Match","Flame","Blaze","Inferno","Supernova"],                         tierIcons:["🕯️","🪔","🔥","🌋","🌌"]},
  {id:'boosts', baseId:110,name:'XP Booster',     icon:'🔋',unit:'Boosts',  thresholds:[5,10,25,50,100],    tierNames:["Novice","Supporter","Fanatic","Champion","Apex"],                      tierIcons:["🔰","🤝","📣","🏆","🔋"]},
];

const WEEKLY_QUESTS = [
  {id:'q_boost',   icon:'🚀',title:'Boost your score',    desc:'Use the XP Booster at least once',         xp:25, check:(w:WalletData,b:number)=>b>=1},
  {id:'q_gm',      icon:'☀️',title:'Say GM on Base',      desc:'Send a GM transaction onchain',            xp:15, check:(w:WalletData,_b:number,_s:number,k?:Record<string,number>)=>w.hasGm||!!(k?.gm&&k.gm>0)},
  {id:'q_checkin', icon:'🔥',title:'Onchain check-in',    desc:'Complete a daily onchain check-in',        xp:20, check:(_w:WalletData,_b:number,s:number,k?:Record<string,number>)=>s>=1||!!(k?.checkin&&k.checkin>0)},
  {id:'q_streak',  icon:'⚡',title:'3-day streak',        desc:'Maintain a 3+ day onchain streak',         xp:30, check:(_w:WalletData,_b:number,s:number)=>s>=3},
  {id:'q_defi',    icon:'🦄',title:'DeFi interaction',    desc:'Interact with a DeFi protocol',            xp:40, check:(w:WalletData)=>w.defiInteractions>=1},
  {id:'q_swap',    icon:'🔄',title:'Token swap',          desc:'Swap at least one token on Base',          xp:20, check:(w:WalletData)=>w.swapCount>=1},
  {id:'q_nft',     icon:'🎨',title:'Collect an NFT',      desc:'Hold 1+ NFTs on Base network',             xp:35, check:(w:WalletData)=>w.nftCount>=1},
  {id:'q_basename',icon:'🆔',title:'Claim Basename',      desc:'Register a .base.eth username',            xp:50, check:(w:WalletData)=>!!w.basename},
  {id:'q_vol',     icon:'💎',title:'Volume milestone',    desc:'Reach 0.001+ ETH transaction volume',      xp:30, check:(w:WalletData)=>parseFloat(w.ethVolume)>=0.001},
  {id:'q_txs',     icon:'📊',title:'Active trader',       desc:'Complete 10+ transactions on Base',        xp:25, check:(w:WalletData)=>w.txCount>=10},
];

const SEASON_START = new Date('2026-04-20T00:00:00Z');
const SEASON_END   = new Date('2026-07-20T23:59:59Z');
const SEASON_NAME  = "Season 1: Genesis";

const TIER_GRADIENTS = [
  'from-slate-500 to-slate-600',
  'from-amber-500 to-orange-600',
  'from-slate-300 to-slate-500',
  'from-yellow-400 to-yellow-600',
  'from-blue-600 to-purple-600',
];

function getLevelStyle(level:number,isMinted:boolean,isEarned:boolean):string{
  if(!isEarned)return'bg-white/5 border border-white/8 text-white/15 opacity-40';
  const t=Math.min(level,5)-1;
  const b=`bg-linear-to-br ${TIER_GRADIENTS[t]} border border-white/20 text-white`;
  if(isMinted)return`${b} ring-2 ring-green-400 ring-offset-1 ring-offset-[#060a14] shadow-lg shadow-green-400/20`;
  return`${b} opacity-75 border-dashed`;
}

function getTargetTokenId(baseId:number,num:number,level:number){return num===1?baseId+5:baseId+level;}

interface DayStats{date:string;count:number;intensity:number;}
interface WalletData{
  address:string;basename:string|null;balance:string;ethVolume:string;
  txCount:number;uniqueDays:number;activeWeeks:number;activeMonths:number;
  currentStreak:number;longestStreak:number;firstTx:string;lastTx:string;
  daysSinceActive:number;tokensSwapped:number;swapCount:number;
  contractInteractions:number;nftCount:number;walletRank:string;
  score:number;historyDays:number;weekLabels:string[];dailyStats:DayStats[];
  topTokens:string[];recommendation:string;recentTxs:AlchemyTransfer[];
  daysOnBase:number;defiInteractions:number;hasGm:boolean;
  uniqueContracts:number;avgTxPerDay:number;mostActiveMonth:string;
  ethReceived:number;totalGasSpent:number;erc20Txs:number;erc721Txs:number;
}
interface AlchemyTransfer{hash:string;category:string;value:number|null;asset:string|null;to:string|null;from:string|null;metadata:{blockTimestamp:string;};}
interface AlchemyResponse{result?:{transfers:AlchemyTransfer[];pageKey?:string;};error?:{message:string;};}
type ConnectionType='farcaster'|'coinbase'|'metamask';
interface LeaderboardEntry{address:string;basename:string|null;score:number;rank:string;boosts:number;badges:number;weeklyXP:number;totalXP:number;weekNumber:number;lastSeen?:number;}
type LeaderboardPost=Omit<LeaderboardEntry,'totalXP'|'lastSeen'>;

async function saveLeaderboard(entry:LeaderboardPost){
  try{await fetch('/api/leaderboard',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(entry)});}
  catch(e){console.error('Leaderboard save failed',e);}
}
async function fetchLeaderboard():Promise<LeaderboardEntry[]>{
  try{const r=await fetch('/api/leaderboard');if(!r.ok)return[];const d=await r.json();return d.leaderboard||[];}
  catch{return[];}
}

function getReferralCode(a:string){return a.slice(2,10).toUpperCase();}
function getISOWeekNumber():number{const d=new Date();const day=d.getUTCDay()||7;d.setUTCDate(d.getUTCDate()+4-day);const y=new Date(Date.UTC(d.getUTCFullYear(),0,1));return Math.ceil(((d.getTime()-y.getTime())/86400000+1)/7);}
function getQuestXP(w:WalletData,b:number,s:number,k?:Record<string,number>):number{return WEEKLY_QUESTS.filter(q=>q.check(w,b,s,k)).reduce((acc,q)=>acc+q.xp,0);}
function computeWeeklyXP(w:WalletData,b:number,s:number,k?:Record<string,number>):number{return getQuestXP(w,b,s,k)+Math.min(b,10)*10+Math.min(s,7)*5;}
function getSeasonPct(){const now=new Date();if(now<SEASON_START)return 0;if(now>SEASON_END)return 100;return Math.round(((now.getTime()-SEASON_START.getTime())/(SEASON_END.getTime()-SEASON_START.getTime()))*100);}
function getDaysLeft(){const now=new Date();if(now>SEASON_END)return 0;return Math.max(0,Math.ceil((SEASON_END.getTime()-now.getTime())/86400000));}
function buildShare(w:WalletData,ref:string,extra:string):string{return`${extra}\n\n🔵 ${SEASON_NAME} — earn XP, mint badges & unlock future rewards!\n🎁 Use my link: ${APP_URL_WEB}?ref=${ref}\n#BaseAnalytics #Base #Onchain`;}
function warpcast(text:string):string{return`https://warpcast.com/~/compose?text=${encodeURIComponent(text)}&embeds[]=${encodeURIComponent(MINIAPP_URL)}`;}
function twitterShare(text:string):string{return`https://twitter.com/intent/tweet?text=${encodeURIComponent(text)}`;}

// ── Paymaster capabilities for Coinbase gas sponsorship ──────────────────────
function getCapabilities(){
  if(!PAYMASTER_URL)return{};
  return{
    paymasterService:{url:PAYMASTER_URL},
  };
}

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
  const[challengeResult,setChallengeResult]=useState<{address:string;score:number;rank:string}|null>(null);
  const[refCopied,setRefCopied]=useState(false);
  const[weeklyXP,setWeeklyXP]=useState(0);

  // ── Encode calldata with builder suffix ───────────────────────────────────
  const boostDWT=`${encodeFunctionData({abi:BOOSTER_ABI,functionName:'boost'})}${getBuilderSuffix()}` as `0x${string}`;
  const gmDWT   =`${encodeFunctionData({abi:GM_GN_ABI,functionName:'gm'})}${getBuilderSuffix()}` as `0x${string}`;
  const gnDWT   =`${encodeFunctionData({abi:GM_GN_ABI,functionName:'gn'})}${getBuilderSuffix()}` as `0x${string}`;
  const ciDWT   =`${encodeFunctionData({abi:CHECKIN_ABI,functionName:'checkIn'})}${getBuilderSuffix()}` as `0x${string}`;

  // ── OnchainKit call arrays (for Coinbase wallet — gas sponsored via Paymaster) ─
  const boostCall=[{to:BOOSTER_CONTRACT as `0x${string}`,data:boostDWT,value:BigInt(4000000000000)}];
  const gmCall   =[{to:GM_GN_CONTRACT as `0x${string}`,data:gmDWT,value:BigInt(2000000000000)}];
  const gnCall   =[{to:GM_GN_CONTRACT as `0x${string}`,data:gnDWT,value:BigInt(2000000000000)}];
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
    // ── Send current week XP + week number so backend can accumulate correctly ──
    const entry:LeaderboardPost={
      address:wallet.address,basename:wallet.basename,score:wallet.score,
      rank:wallet.walletRank,boosts,badges:mintedCount,
      weeklyXP:xp,weekNumber:getISOWeekNumber(),
    };
    saveLeaderboard(entry).then(()=>fetchLeaderboard().then(d=>setLeaderboard(d)));
  },[wallet,boosts,mintedLevels,streak,txKeys]);

  const getStrictUTCDate=(ts:string)=>ts.split('T')[0];
  const getISOWeek=(d:Date)=>{const dd=new Date(Date.UTC(d.getUTCFullYear(),d.getUTCMonth(),d.getUTCDate()));const dn=dd.getUTCDay()||7;dd.setUTCDate(dd.getUTCDate()+4-dn);const y=dd.getUTCFullYear();const wn=Math.ceil((((dd.getTime()-new Date(Date.UTC(y,0,1)).getTime())/86400000)+1)/7);return`${y}-W${wn}`;};

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
        .then(async(reverseNode)=>{
          if(!reverseNode)return null;
          const name=await pub.readContract({address:BASE_L2_RESOLVER,abi:NAME_RESOLVER_ABI,functionName:'name',args:[reverseNode]}).catch(()=>null);
          return(name&&typeof name==='string'&&name.trim()!=='')?name:null;
        }).catch(()=>null);

      const balP  =provider.getBalance(address).catch(()=>BigInt(0));
      const nftP  =fetch(`https://base-mainnet.g.alchemy.com/nft/v3/${ALCHEMY_KEY}/getNFTsForOwner?owner=${address}&withMetadata=false`).then(r=>r.json()).catch(()=>({totalCount:0}));
      const strkP =pub.readContract({address:CHECKIN_CONTRACT as `0x${string}`,abi:CHECKIN_ABI,functionName:'streaks',args:[address as `0x${string}`]}).catch(()=>BigInt(0));
      const lastP =pub.readContract({address:CHECKIN_CONTRACT as `0x${string}`,abi:CHECKIN_ABI,functionName:'lastCheckIn',args:[address as `0x${string}`]}).catch(()=>BigInt(0));

      const calls:{address:`0x${string}`;abi:typeof ACHIEVEMENTS_ABI;functionName:'hasMinted';args:readonly[`0x${string}`,bigint]}[]=[];
      const callMap:{catId:string;level:number}[]=[];
      for(const cat of ACHIEVEMENTS){for(let i=cat.thresholds.length;i>=1;i--){const tid=getTargetTokenId(cat.baseId,cat.thresholds.length,i);calls.push({address:ACHIEVEMENTS_CONTRACT as `0x${string}`,abi:ACHIEVEMENTS_ABI,functionName:'hasMinted',args:[address as `0x${string}`,BigInt(tid)]});callMap.push({catId:cat.id,level:i});}}
      const mcP=pub.multicall({contracts:calls}).catch(()=>[]);

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

      const rxP=fetch(BASE_RPC,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({jsonrpc:"2.0",id:2,method:"alchemy_getAssetTransfers",params:[{fromBlock:"0x0",toBlock:"latest",toAddress:address,category:["external","erc20"],maxCount:"0x3e8",withMetadata:true}]})}).then(r=>r.json()).catch(()=>({result:{transfers:[]}}));

      const[bn,balWei,nftData,mcRes,allTxs,rxData,dbStreak,dbLastCI]=await Promise.all([bnP,balP,nftP,mcP,txP,rxP,strkP,lastP]);

      setStreak(Number(dbStreak));
      if(Number(dbLastCI)>0){const ld=new Date(Number(dbLastCI)*1000).toISOString().split('T')[0];setCheckedToday(ld===new Date().toISOString().split('T')[0]);}

      const ms:Record<string,number>={};
      mcRes.forEach((r:{status:string;result?:unknown},i:number)=>{const{catId,level}=callMap[i];if(r.status==='success'&&r.result===true){if(!ms[catId]||ms[catId]<level)ms[catId]=level;}});
      setMintedLevels(ms);

      const uDays=new Set<string>(),uWeeks=new Set<string>(),uMonths=new Set<string>(),uTokens=new Set<string>(),uContracts=new Set<string>();
      const tokFreq=new Map<string,number>(),monthActivity=new Map<string,number>(),tpd=new Map<string,number>();
      let ethVol=0,swapCount=0,cxInteract=0,hBoosts=0,defi=0,hasGm=false,erc20Txs=0,erc721Txs=0;

      for(const tx of allTxs){
        const d=new Date(tx.metadata.blockTimestamp);const day=getStrictUTCDate(tx.metadata.blockTimestamp);
        uDays.add(day);tpd.set(day,(tpd.get(day)||0)+1);uWeeks.add(getISOWeek(d));
        const mKey=`${d.getUTCFullYear()}-${d.getUTCMonth()}`;uMonths.add(mKey);monthActivity.set(mKey,(monthActivity.get(mKey)||0)+1);
        if(tx.value&&(tx.asset==='ETH'||tx.asset==='WETH'))ethVol+=tx.value;
        if(tx.category==='erc20'){swapCount++;erc20Txs++;}
        if(tx.category==='erc721')erc721Txs++;
        if(['erc20','erc721','erc1155'].includes(tx.category)&&tx.asset){uTokens.add(tx.asset);tokFreq.set(tx.asset,(tokFreq.get(tx.asset)||0)+1);}
        if(tx.category==='external'){cxInteract++;if(tx.to)uContracts.add(tx.to.toLowerCase());}
        if(tx.to&&DEFI_PROTOCOLS.includes(tx.to.toLowerCase()))defi++;
        if(tx.to&&tx.to.toLowerCase()===BOOSTER_CONTRACT.toLowerCase())hBoosts++;
        if(tx.to&&tx.to.toLowerCase()===GM_GN_CONTRACT.toLowerCase())hasGm=true;
      }

      let ethReceived=0;
      const rxTxs=(rxData as AlchemyResponse).result?.transfers||[];
      for(const tx of rxTxs){if(tx.value&&(tx.asset==='ETH'||tx.asset==='WETH'))ethReceived+=tx.value;}

      let fBoosts=hBoosts;
      if(typeof window!=='undefined'){
        const c=localStorage.getItem(`base_boosts_${address.toLowerCase()}`);
        if(c){const p=parseInt(c,10);if(p>fBoosts)fBoosts=p;}
        localStorage.setItem(`base_boosts_${address.toLowerCase()}`,fBoosts.toString());
        if(localStorage.getItem(`base_gm_${address.toLowerCase()}`)==='true')hasGm=true;
        else if(hasGm)localStorage.setItem(`base_gm_${address.toLowerCase()}`,'true');
      }
      setBoosts(fBoosts);

      const total=allTxs.length;
      const topTokens=Array.from(tokFreq.entries()).sort((a,b)=>b[1]-a[1]).slice(0,3).map(e=>e[0]);
      const recentTxs=[...allTxs].sort((a,b)=>new Date(b.metadata.blockTimestamp).getTime()-new Date(a.metadata.blockTimestamp).getTime()).slice(0,8);

      const sortedDays=Array.from(uDays).sort();
      let longest=0,tmp=0,prevTs=0;
      for(const day of sortedDays){const ts=Date.parse(day);if(prevTs!==0){const diff=(ts-prevTs)/86400000;if(Math.round(diff)===1)tmp++;else{longest=Math.max(longest,tmp);tmp=1;}}else tmp=1;prevTs=ts;}
      longest=Math.max(longest,tmp);
      const now=new Date();const yest=new Date();yest.setUTCDate(now.getUTCDate()-1);
      const curStreak=(uDays.has(now.toISOString().split('T')[0])||uDays.has(yest.toISOString().split('T')[0]))?tmp:0;

      let firstTs=now.getTime(),lastTs=0;
      if(allTxs.length>0){firstTs=Math.min(firstTs,new Date(allTxs[0].metadata.blockTimestamp).getTime());lastTs=Math.max(lastTs,new Date(allTxs[allTxs.length-1].metadata.blockTimestamp).getTime());}

      let histDays=364,firstTx="N/A",lastTx="N/A",daysSince=0,daysOnBase=0;
      if(total>0){firstTx=new Date(firstTs).toLocaleDateString();lastTx=new Date(lastTs).toLocaleDateString();daysSince=Math.floor((now.getTime()-lastTs)/86400000);daysOnBase=Math.floor((now.getTime()-firstTs)/86400000);histDays=Math.max(364,Math.ceil(Math.abs(now.getTime()-firstTs)/86400000)+14);}

      const mostActiveMonthKey=Array.from(monthActivity.entries()).sort((a,b)=>b[1]-a[1])[0]?.[0]||'';
      let mostActiveMonth='N/A';
      if(mostActiveMonthKey){const[y,m]=mostActiveMonthKey.split('-');mostActiveMonth=`${MONTHS[parseInt(m)]} ${y}`;}

      const avgTxPerDay=uDays.size>0?Math.round((total/uDays.size)*10)/10:0;
      let rec="You're a Base power user! Keep up the great onchain activity.";
      if(daysSince>7)rec=`⚠️ Inactive for ${daysSince} days! Send a GM to keep your streak alive.`;
      else if(swapCount===0)rec="💡 Haven't swapped tokens yet! Try Aerodrome or Uniswap on Base.";
      else if(total<10)rec="👋 Welcome to Base! Try minting an NFT or boosting your score.";

      const dStats:DayStats[]=[];const ptr=new Date();
      for(let i=0;i<histDays;i++){const ds=ptr.toISOString().split('T')[0];const c=tpd.get(ds)||0;let intensity=0;if(c>0)intensity=1;if(c>2)intensity=2;if(c>5)intensity=3;if(c>10)intensity=4;dStats.unshift({date:ds,count:c,intensity});ptr.setUTCDate(ptr.getUTCDate()-1);}

      const tCols=Math.ceil(histDays/7);const wLabels:string[]=[];let lastML="";const gStart=new Date();gStart.setUTCDate(gStart.getUTCDate()-histDays+1);
      for(let col=0;col<tCols;col++){const ws=new Date(gStart);ws.setUTCDate(ws.getUTCDate()+(col*7));const mi=ws.getUTCMonth();if(MONTHS[mi]!==lastML){wLabels.push(MONTHS[mi]);lastML=MONTHS[mi];}else wLabels.push("");}

      const score=Math.floor(Math.min(25,total/20)+Math.min(20,uDays.size/5)+Math.min(15,uMonths.size*1.25)+Math.min(15,curStreak*1.1)+Math.min(10,ethVol*2)+Math.min(10,uTokens.size/2)+Math.min(5,defi*2)+(bn?5:0));
      let rank="Base Shrimp 🦐";if(score>=30)rank="Base Dolphin 🐬";if(score>=60)rank="Base Shark 🦈";if(score>=75)rank="Base Whale 🐋";if(score>=85)rank="Base God 👑";

      setWallet({address,basename:bn,balance:parseFloat(formatEther(balWei)).toFixed(4),ethVolume:ethVol.toFixed(4),
        txCount:total,uniqueDays:uDays.size,activeWeeks:uWeeks.size,activeMonths:uMonths.size,
        currentStreak:curStreak,longestStreak:longest,firstTx,lastTx,daysSinceActive:daysSince,
        tokensSwapped:uTokens.size,swapCount,contractInteractions:cxInteract,nftCount:nftData.totalCount||0,walletRank:rank,
        score:Math.min(100,score),dailyStats:dStats,historyDays:histDays,weekLabels:wLabels,topTokens,recommendation:rec,recentTxs,
        daysOnBase,defiInteractions:defi,hasGm,uniqueContracts:uContracts.size,avgTxPerDay,mostActiveMonth,
        ethReceived:parseFloat(ethReceived.toFixed(4)),totalGasSpent:0,erc20Txs,erc721Txs});
    }catch(e){console.error(e);setWallet(null);}finally{setLoading(false);}
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
      }else{
        const{address}=await connectWallet(type);addr=address;
      }
      setConnType(type);analyzeWallet(addr);
    }catch{setLoading(false);showToast("❌ Connection Failed.","");}
  };

  const handleDisconnect=()=>{setWallet(null);setConnType(null);};

  // ── Native tx for Farcaster wallet ───────────────────────────────────────
  const doNativeTx=async(type:'boost'|'gm'|'gn'|'checkin')=>{
    if(!wallet||minting)return;setMinting(type);
    try{
      let to:`0x${string}`=BOOSTER_CONTRACT as `0x${string}`;
      let data:`0x${string}`=boostDWT;
      let msg='Boosted! 🎉';
      const val=type==='boost'?BigInt(4000000000000):BigInt(2000000000000);
      if(type==='gm'){to=GM_GN_CONTRACT as `0x${string}`;data=gmDWT;msg='GM on Base! ☀️';}
      else if(type==='gn'){to=GM_GN_CONTRACT as `0x${string}`;data=gnDWT;msg='GN on Base! 🌙';}
      else if(type==='checkin'){to=CHECKIN_CONTRACT as `0x${string}`;data=ciDWT;msg='Check-in secured! 🔥';}
      const p:{from:`0x${string}`;to:`0x${string}`;data:`0x${string}`;chainId:`0x${string}`;value?:`0x${string}`}={
        from:wallet.address as `0x${string}`,to,data,chainId:'0x2105' as `0x${string}`,
      };
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

  // ── Native mint for Farcaster wallet ─────────────────────────────────────
  const doNativeMint=async(catId:string,targetLevels:number[],tokenIds:number[],catName:string)=>{
    if(!wallet||minting)return;setMinting(`mint-${catId}`);
    try{
      const isBatch=tokenIds.length>1;
      const raw=isBatch
        ?encodeFunctionData({abi:ACHIEVEMENTS_ABI,functionName:'mintBatchAchievements',args:[tokenIds.map(id=>BigInt(id))]})
        :encodeFunctionData({abi:ACHIEVEMENTS_ABI,functionName:'mintAchievement',args:[BigInt(tokenIds[0])]});
      const data=`${raw}${getBuilderSuffix()}` as `0x${string}`;
      const hash=await sdk.wallet.ethProvider.request({method:"eth_sendTransaction",params:[{from:wallet.address as `0x${string}`,to:ACHIEVEMENTS_CONTRACT as `0x${string}`,data,chainId:'0x2105' as `0x${string}`}]});
      if(hash&&typeof hash==='string'){
        showToast(isBatch?`✅ Claimed ${tokenIds.length} ${catName} Badges!`:`✅ Badge minted!`,hash);
        setMintedLevels(p=>({...p,[catId]:Math.max(...targetLevels)}));
        setTxKeys(p=>({...p,[`mint-${catId}`]:(p[`mint-${catId}`]||0)+1}));
        setSponsored(s=>s+1);
      }
    }catch(e:unknown){const m=e instanceof Error?e.message.split('\n')[0]:'Mint rejected.';if(!m.includes("rejected"))showToast('❌ Mint Failed','');}
    finally{setMinting(null);}
  };

  const getCatValue=(id:string)=>{if(!wallet)return 0;const m:Record<string,number>={score:wallet.score,age:wallet.daysOnBase,name:wallet.basename?1:0,days:wallet.uniqueDays,contract:wallet.contractInteractions,volume:parseFloat(wallet.ethVolume),txs:wallet.txCount,swaps:wallet.swapCount,nfts:wallet.nftCount,streak:wallet.longestStreak,boosts};return m[id]??0;};

  const ref=wallet?getReferralCode(wallet.address):'';
  const doneQuests=wallet?WEEKLY_QUESTS.filter(q=>q.check(wallet,boosts,streak,txKeys)).length:0;

  const shareScore=(pl:'w'|'t'|'n')=>{
    if(!wallet)return;
    const text=buildShare(wallet,ref,`🏆 I'm a ${wallet.walletRank} on @base!\n\nScore: ${wallet.score}/100 🔵\nStreak: ${streak} days 🔥\nBadges: ${Object.keys(mintedLevels).filter(k=>mintedLevels[k]>0).length} 🎖️`);
    if(pl==='w')window.open(warpcast(text),'_blank');
    else if(pl==='t')window.open(twitterShare(text),'_blank');
    else if(navigator.share)navigator.share({title:'Base Analytics',text,url:APP_URL_WEB}).catch(()=>{});
  };
  const shareAch=(name:string,level:string,pl:'w'|'t')=>{
    if(!wallet)return;
    const text=buildShare(wallet,ref,`🏅 Just unlocked "${level}" badge for ${name} on Base Analytics! 🔵`);
    if(pl==='w')window.open(warpcast(text),'_blank');else window.open(twitterShare(text),'_blank');
  };
  const shareAll=(count:number,pl:'w'|'t')=>{
    if(!wallet)return;
    const text=buildShare(wallet,ref,`🎖️ Just claimed ${count} Onchain Badges gasless on Base Analytics! 🔵`);
    if(pl==='w')window.open(warpcast(text),'_blank');else window.open(twitterShare(text),'_blank');
  };

  // ─────────────────────────────────────────────────────────────────────────
  // LOADING SCREEN
  if(!ready)return(
    <div className="min-h-screen bg-[#060a14] flex items-center justify-center">
      <div className="text-center space-y-5">
        <div className="relative w-20 h-20 mx-auto">
          <div className="w-20 h-20 rounded-3xl bg-linear-to-br from-blue-600 via-blue-500 to-indigo-600 flex items-center justify-center shadow-2xl shadow-blue-600/60">
            <Activity size={36} className="text-white"/>
          </div>
          <div className="absolute inset-0 rounded-3xl border-2 border-blue-400/20 animate-ping"/>
          <div className="absolute -inset-1 rounded-3xl bg-blue-500/10 blur-xl animate-pulse"/>
        </div>
        <div className="space-y-1">
          <p className="text-white font-black text-lg tracking-tight">BASE<span className="text-blue-400">.</span>ANALYTICS</p>
          <p className="text-blue-500/70 font-mono text-[10px] tracking-[0.4em] uppercase">Initializing...</p>
        </div>
      </div>
    </div>
  );

  // ─────────────────────────────────────────────────────────────────────────
  // LANDING SCREEN — bold redesign with dark navy aesthetic
  if(!wallet)return(
    <div className="min-h-screen bg-[#060a14] flex flex-col items-center justify-center p-4 relative overflow-hidden">
      {/* Multi-layer ambient glow */}
      <div className="absolute top-0 left-1/2 -translate-x-1/2 w-150 h-75 bg-blue-600/8 rounded-full blur-3xl pointer-events-none"/>
      <div className="absolute bottom-0 right-0 w-100 h-75 bg-indigo-600/6 rounded-full blur-3xl pointer-events-none"/>
      <div className="absolute inset-0 pointer-events-none" style={{backgroundImage:'linear-gradient(rgba(59,130,246,0.04) 1px,transparent 1px),linear-gradient(90deg,rgba(59,130,246,0.04) 1px,transparent 1px)',backgroundSize:'48px 48px'}}/>

      <div className="relative z-10 w-full max-w-sm mx-auto">
        {/* Logo block */}
        <div className="text-center mb-8">
          <div className="relative w-20 h-20 mx-auto mb-5">
            <div className="w-20 h-20 bg-linear-to-br from-blue-600 via-blue-500 to-indigo-600 rounded-3xl flex items-center justify-center shadow-2xl shadow-blue-600/50">
              <Activity size={36} className="text-white"/>
            </div>
            <div className="absolute -top-1.5 -right-1.5 w-6 h-6 bg-green-500 rounded-full border-2 border-[#060a14] flex items-center justify-center shadow-lg">
              <div className="w-2.5 h-2.5 bg-green-200 rounded-full animate-pulse"/>
            </div>
            <div className="absolute -inset-2 rounded-[28px] bg-blue-500/10 blur-lg -z-10"/>
          </div>
          <h1 className="text-4xl sm:text-5xl font-black text-white tracking-tight mb-2">
            BASE<span className="text-blue-400">.</span>ANALYTICS
          </h1>
          <p className="text-slate-500 text-sm leading-relaxed">Your onchain identity on Base · Farm XP · Climb the leaderboard</p>
        </div>

        {/* Season card — styled like Farcaster analytics metric card */}
        <div className="bg-[#0d1424] border border-blue-500/20 rounded-3xl p-5 mb-4">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-2">
              <div className="w-7 h-7 bg-yellow-500/15 rounded-xl flex items-center justify-center">
                <Star size={13} className="text-yellow-400"/>
              </div>
              <span className="text-[10px] font-black text-slate-500 uppercase tracking-widest">{SEASON_NAME}</span>
            </div>
            <span className="text-[10px] font-black text-blue-400 bg-blue-500/10 border border-blue-500/20 px-2.5 py-1 rounded-lg">{getDaysLeft()}d left</span>
          </div>

          {/* Big season progress number like Farcoin */}
          <div className="mb-4">
            <p className="text-[10px] font-black text-slate-600 uppercase tracking-widest mb-1">SEASON PROGRESS</p>
            <p className="text-5xl font-black text-white tracking-tight leading-none">{getSeasonPct()}<span className="text-2xl text-slate-600">%</span></p>
          </div>

          {/* Progress bar */}
          <div className="w-full bg-white/5 rounded-full h-1.5 overflow-hidden">
            <div className="h-full bg-linear-to-r from-blue-500 to-indigo-500 rounded-full" style={{width:`${getSeasonPct()}%`,transition:'width 2s ease-out'}}/>
          </div>

          {/* Metric rows — styled like the Farcaster dashboard rows */}
          <div className="mt-4 space-y-2">
            {[
              {icon:<Trophy size={14} className="text-yellow-400"/>, label:'Achievement Badges', value:'11 Categories'},
              {icon:<Target size={14} className="text-blue-400"/>,   label:'Weekly Quests',      value:`${WEEKLY_QUESTS.length} Available`},
              {icon:<Zap size={14} className="text-purple-400"/>,    label:'XP Farming',         value:'Carry-over weekly'},
            ].map((r,i)=>(
              <div key={i} className="flex items-center justify-between bg-white/3 rounded-xl px-3 py-2.5 border border-white/5">
                <div className="flex items-center gap-2.5">
                  {r.icon}
                  <span className="text-xs text-slate-300 font-bold">{r.label}</span>
                </div>
                <span className="text-xs font-black text-blue-400">{r.value}</span>
              </div>
            ))}
          </div>
        </div>

        {/* Connect button */}
        <button onClick={()=>setShowModal(true)} disabled={loading}
          className="w-full bg-blue-600 hover:bg-blue-500 active:scale-[0.98] text-white py-4 rounded-2xl font-black text-base flex items-center justify-center gap-3 transition-all shadow-2xl shadow-blue-600/30 mb-3 disabled:opacity-60">
          {loading?<RefreshCcw className="animate-spin" size={20}/>:<Wallet size={20}/>}
          {loading?"Scanning wallet...":"Connect & Check Score"}
        </button>

        <p className="text-center text-[10px] text-slate-600 flex items-center justify-center gap-1.5">
          <Droplets size={9} className="text-blue-500/50"/>
          Gas fees sponsored by Coinbase Paymaster
        </p>
      </div>

      {/* Connect modal */}
      {showModal&&(
        <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-4 bg-black/75 backdrop-blur-md">
          <div className="bg-[#0d1424] border border-white/10 rounded-3xl w-full max-w-sm p-6 relative shadow-2xl">
            <button onClick={()=>setShowModal(false)} className="absolute top-4 right-4 text-slate-500 hover:text-white w-8 h-8 flex items-center justify-center rounded-xl bg-white/5 transition-colors"><X size={16}/></button>

            {/* Modal header */}
            <div className="flex items-center gap-3 mb-5">
              <div className="w-10 h-10 bg-blue-600 rounded-2xl flex items-center justify-center shadow-lg shadow-blue-600/40"><Activity size={20} className="text-white"/></div>
              <div>
                <h3 className="font-black text-white text-base">Connect Wallet</h3>
                <p className="text-slate-500 text-xs mt-0.5">All transactions gas-free via Paymaster</p>
              </div>
            </div>

            <div className="space-y-2">
              {[
                {type:'coinbase' as ConnectionType, label:'Coinbase Wallet', sub:'Best for gas sponsorship', emoji:'🔵', bg:'bg-blue-600/90 hover:bg-blue-500 border-blue-500/30'},
                {type:'metamask' as ConnectionType, label:'MetaMask',        sub:'EVM compatible wallet',    emoji:'🦊', bg:'bg-[#1a1a2e] hover:bg-[#1f1f3a] border-orange-500/20'},
                {type:'farcaster' as ConnectionType,label:'Farcaster',       sub:'Social + onchain wallet',  emoji:'🟣', bg:'bg-[#1a1a2e] hover:bg-[#1f1f3a] border-purple-500/20'},
              ].map(w=>(
                <button key={w.type} onClick={()=>handleConnect(w.type)}
                  className={`w-full flex items-center justify-between ${w.bg} border text-white p-4 rounded-2xl transition-all active:scale-[0.98] group`}>
                  <div className="flex items-center gap-3">
                    <span className="w-9 h-9 bg-white/10 rounded-xl flex items-center justify-center text-base">{w.emoji}</span>
                    <div className="text-left">
                      <p className="font-black text-sm">{w.label}</p>
                      <p className="text-[10px] text-slate-400">{w.sub}</p>
                    </div>
                  </div>
                  <ChevronRight size={16} className="text-slate-500 group-hover:text-white group-hover:translate-x-0.5 transition-all"/>
                </button>
              ))}
            </div>

            {PAYMASTER_URL&&(
              <div className="mt-4 flex items-center justify-center gap-1.5 bg-green-500/8 border border-green-500/15 rounded-xl p-2.5">
                <Droplets size={11} className="text-green-400"/>
                <p className="text-[10px] text-green-400 font-bold">Coinbase Paymaster active — gas fees sponsored</p>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );

  // MAIN APP
  const mintedCount=Object.keys(mintedLevels).filter(k=>mintedLevels[k]>0).length;

  return(
    <main className="min-h-screen bg-[#060a14] text-white font-sans">
      {/* Grid overlay */}
      <div className="fixed inset-0 pointer-events-none" style={{backgroundImage:'linear-gradient(rgba(0,82,255,0.025) 1px,transparent 1px),linear-gradient(90deg,rgba(0,82,255,0.025) 1px,transparent 1px)',backgroundSize:'60px 60px'}}/>

      {/* Toast */}
      {toast&&(
        <div className="fixed bottom-4 left-4 right-4 sm:left-auto sm:right-6 sm:w-80 z-50 bg-linear-to-r from-blue-600 to-blue-700 text-white px-5 py-4 rounded-2xl shadow-2xl shadow-blue-600/40 flex items-start gap-3" style={{animation:'slideUp 0.3s ease-out'}}>
          <BadgeCheck size={20} className="shrink-0 mt-0.5"/>
          <div className="flex-1 min-w-0">
            <p className="font-bold text-sm">{toast.msg}</p>
            {toast.hash&&<a href={`https://basescan.org/tx/${toast.hash}`} target="_blank" rel="noreferrer" className="text-blue-200 text-xs underline hover:text-white">View on BaseScan ↗</a>}
          </div>
          <button onClick={()=>setToast(null)} className="shrink-0 bg-white/10 hover:bg-white/20 p-1.5 rounded-xl transition-colors"><X size={13}/></button>
        </div>
      )}

      {/* Header */}
      <header className="sticky top-0 z-40 bg-[#060a14]/98 backdrop-blur-xl border-b border-white/6">
        <div className="max-w-7xl mx-auto px-3 sm:px-6 h-14 flex items-center justify-between gap-3">
          {/* Logo */}
          <div className="flex items-center gap-2.5 min-w-0">
            <div className="w-8 h-8 bg-linear-to-br from-blue-600 to-indigo-600 rounded-xl flex items-center justify-center shadow-lg shadow-blue-600/40 shrink-0">
              <Activity size={16} className="text-white"/>
            </div>
            <span className="font-black text-sm sm:text-base text-white truncate">BASE<span className="text-blue-400">.</span>ANALYTICS</span>
          </div>
          {/* Right pills */}
          <div className="flex items-center gap-1.5 sm:gap-2 shrink-0">
            {/* Season pill */}
            <div className="hidden sm:flex items-center gap-1.5 bg-[#0d1424] border border-blue-500/15 rounded-xl px-2.5 py-1.5">
              <div className="w-1.5 h-1.5 bg-blue-400 rounded-full animate-pulse"/>
              <span className="text-[10px] font-black text-blue-300 whitespace-nowrap">{SEASON_NAME}</span>
              <span className="text-slate-700 mx-0.5">·</span>
              <span className="text-[10px] text-slate-500">{getDaysLeft()}d</span>
            </div>
            {/* XP pill */}
            <div className="flex items-center gap-1 bg-yellow-500/8 border border-yellow-500/20 rounded-xl px-2.5 py-1.5">
              <Zap size={11} className="text-yellow-400"/>
              <span className="text-[10px] font-black text-yellow-300 whitespace-nowrap">{weeklyXP}</span>
              <span className="text-[9px] text-yellow-600 hidden sm:inline">XP</span>
            </div>
            {/* Sponsored counter */}
            {sponsored>0&&(
              <div className="hidden sm:flex items-center gap-1 bg-green-500/8 border border-green-500/20 rounded-xl px-2.5 py-1.5">
                <Droplets size={11} className="text-green-400"/>
                <span className="text-[10px] text-green-400 font-bold">{sponsored}</span>
              </div>
            )}
            {/* Disconnect */}
            <button onClick={handleDisconnect} className="p-2 bg-[#0d1424] border border-white/8 rounded-xl text-slate-500 hover:text-white hover:border-white/15 transition-all">
              <Power size={14}/>
            </button>
          </div>
        </div>
      </header>

      <div className="max-w-7xl mx-auto px-3 sm:px-6 pt-4 pb-24">

        {/* Tabs */}
        <div className="flex bg-[#0d1424] border border-white/8 p-1 rounded-2xl mb-5 overflow-x-auto gap-0.5 no-scrollbar">
          {[
            {id:'dashboard',  icon:<BarChart3 size={13}/>,  label:'Dashboard'},
            {id:'achievements',icon:<Trophy size={13}/>,    label:'Badges'},
            {id:'quests',     icon:<Target size={13}/>,     label:`Quests${doneQuests>0?` · ${doneQuests}`:''}`},
            {id:'leaderboard',icon:<Users size={13}/>,      label:'Rankings'},
            {id:'basehub',    icon:<BookOpen size={13}/>,   label:'Ecosystem'},
          ].map(t=>(
            <button key={t.id} onClick={()=>setTab(t.id as typeof tab)}
              className={`flex items-center justify-center gap-1.5 py-2 px-3 sm:px-4 rounded-xl font-bold text-[11px] sm:text-xs whitespace-nowrap flex-1 transition-all ${tab===t.id?'bg-blue-600 text-white shadow-lg shadow-blue-600/25':'text-slate-500 hover:text-slate-300 hover:bg-white/5'}`}>
              {t.icon}
              <span className="hidden sm:inline">{t.label}</span>
              <span className="sm:hidden">{t.label.split(' ')[0]}</span>
            </button>
          ))}
        </div>

        {/* ═══ DASHBOARD ═══ */}
        {tab==='dashboard'&&(
          <div className="space-y-4">

            {/* Daily check-in — analytics card style */}
            <div className={`bg-[#0d1424] border rounded-3xl overflow-hidden transition-all ${checkedToday?'border-green-500/25':'border-blue-500/20'}`}>
              <div className={`h-0.5 ${checkedToday?'bg-linear-to-r from-green-500 to-emerald-400':'bg-linear-to-r from-blue-600 to-indigo-500'}`}/>
              <div className="p-5 flex flex-col sm:flex-row sm:items-center gap-4 justify-between">
                <div className="flex items-center gap-4">
                  <div className={`w-12 h-12 rounded-2xl flex items-center justify-center shrink-0 border ${checkedToday?'bg-green-500/15 border-green-500/25':'bg-blue-600/15 border-blue-500/25'}`}>
                    <Flame size={22} className={checkedToday?'text-green-400':'text-blue-400'}/>
                  </div>
                  <div>
                    <p className="font-black text-white text-base">{checkedToday?`Day ${streak} streak 🔥`:'Daily Check-In Available'}</p>
                    <p className={`text-xs mt-0.5 ${checkedToday?'text-green-400/70':'text-slate-500'}`}>{checkedToday?'Recorded immutably on Base.':'Sign once · earn XP · unlock multipliers'}</p>
                    {/* Streak display */}
                    <div className="flex items-center gap-2 mt-2">
                      {Array.from({length:Math.min(streak,7)}).map((_,i)=>(
                        <div key={i} className={`w-5 h-5 rounded-lg flex items-center justify-center text-[10px] ${i<streak?'bg-orange-500/20 border border-orange-500/30':'bg-white/5 border border-white/8'}`}>
                          {i<streak?'🔥':'·'}
                        </div>
                      ))}
                      {streak>7&&<span className="text-[10px] text-slate-500 font-bold">+{streak-7} more</span>}
                    </div>
                  </div>
                </div>
                <div className="flex flex-col items-stretch sm:items-end gap-1 shrink-0">
                  {connType==='farcaster'?(
                    <button onClick={()=>doNativeTx('checkin')} disabled={checkedToday||!!minting}
                      className={`py-3 px-6 rounded-2xl font-black text-sm transition-all ${checkedToday?'bg-green-500/15 text-green-400 cursor-default border border-green-500/25':'bg-blue-600 hover:bg-blue-500 text-white shadow-lg shadow-blue-600/30 active:scale-95'}`}>
                      {minting==='checkin'?<RefreshCcw className="animate-spin mx-auto" size={14}/>:checkedToday?'✓ Secured Today':'Check In'}
                    </button>
                  ):checkedToday?(
                    <button disabled className="py-3 px-6 rounded-2xl font-black text-sm bg-green-500/15 text-green-400 border border-green-500/25">✓ Secured Today</button>
                  ):(
                    <Transaction key={`ci-${txKeys.checkin}`} chainId={base.id} calls={ciCall} capabilities={txCaps}
                      onStatus={s=>{if(s.statusName==='success'){setCheckedToday(true);setStreak(v=>v+1);setSponsored(v=>v+1);showToast('✅ Onchain check-in secured!',s.statusData.transactionReceipts?.[0]?.transactionHash||'');setTxKeys(k=>({...k,checkin:(k.checkin||0)+1}));}}}>
                      <TransactionButton className="py-3 px-6 rounded-2xl font-black text-sm bg-blue-600 hover:bg-blue-500 text-white transition-all w-full" text="Check In"/>
                    </Transaction>
                  )}
                  <p className="text-[9px] text-green-500/50 flex items-center justify-center gap-1 mt-0.5"><Droplets size={8}/>Gas Sponsored</p>
                </div>
              </div>
            </div>

            {/* Recommendation — metric row style */}
            <div className={`flex items-start gap-3 bg-[#0d1424] border rounded-2xl p-4 ${wallet.daysSinceActive>7?'border-yellow-500/20':'border-blue-500/15'}`}>
              <div className={`w-8 h-8 rounded-xl flex items-center justify-center shrink-0 mt-0.5 ${wallet.daysSinceActive>7?'bg-yellow-500/15':'bg-blue-500/15'}`}>
                {wallet.daysSinceActive>7?<AlertTriangle size={15} className="text-yellow-400"/>:<Activity size={15} className="text-blue-400"/>}
              </div>
              <p className="text-sm text-slate-300 leading-relaxed">{wallet.recommendation}</p>
            </div>

            {/* Score + Heatmap — profile card style */}
            <div className="bg-[#0d1424] border border-white/8 rounded-3xl overflow-hidden">
              {/* Top accent bar */}
              <div className="h-1 bg-linear-to-r from-blue-600 via-indigo-500 to-purple-600"/>
              <div className="p-5 sm:p-6">
              <div className="flex flex-col lg:flex-row lg:items-start lg:justify-between gap-5 mb-6">
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-2 mb-3">
                    <span className="text-[10px] font-black text-blue-400 uppercase tracking-widest">Onchain Score</span>
                    <div className="flex gap-1">
                      {([['w','Cast','text-purple-400'],['t','Post','text-sky-400'],['n','Share','text-slate-400']] as const).map(([pl,lbl,c])=>(
                        <button key={pl} onClick={()=>shareScore(pl)} className="bg-white/5 hover:bg-white/10 border border-white/8 text-slate-400 px-2 py-1 rounded-lg text-[10px] font-bold flex items-center gap-1 transition-all">
                          {pl==='w'?<Send size={9} className={c}/>:pl==='t'?<Twitter size={9} className={c}/>:<Share2 size={9} className={c}/>}{lbl}
                        </button>
                      ))}
                    </div>
                  </div>
                  <div className="flex items-baseline gap-1 flex-wrap">
                    <span className="text-7xl sm:text-8xl font-black text-white tracking-tighter leading-none">{wallet.score}</span>
                    <span className="text-2xl text-white/20 font-black">/100</span>
                  </div>
                  <p className="text-blue-400 font-black text-base mt-2">{wallet.walletRank}</p>
                  <div className="mt-4 space-y-1.5 max-w-xs">
                    {[
                      {l:'Activity',   v:Math.min(100,Math.round(wallet.txCount/10)),        c:'bg-blue-500'},
                      {l:'Consistency',v:Math.min(100,Math.round(wallet.uniqueDays/3.65)),   c:'bg-purple-500'},
                      {l:'Volume',     v:Math.min(100,Math.round(parseFloat(wallet.ethVolume)*200)),c:'bg-cyan-500'},
                      {l:'DeFi',       v:Math.min(100,Math.round(wallet.defiInteractions*2)),c:'bg-emerald-500'},
                    ].map((b,i)=>(
                      <div key={i} className="flex items-center gap-2">
                        <span className="text-[10px] text-slate-600 w-20 font-bold shrink-0">{b.l}</span>
                        <div className="flex-1 bg-white/5 rounded-full h-1.5 overflow-hidden">
                          <div className={`h-full ${b.c} rounded-full`} style={{width:`${b.v}%`,transition:'width 1.5s ease-out'}}/>
                        </div>
                        <span className="text-[10px] text-slate-600 w-5 text-right shrink-0">{b.v}</span>
                      </div>
                    ))}
                  </div>
                </div>
                <div className="shrink-0">
                  {selDay?(
                    <div className="bg-white/5 border border-white/8 rounded-2xl px-5 py-4 text-center">
                      <p className="text-[10px] text-slate-500 font-bold uppercase tracking-wide">{selDay.date}</p>
                      <p className="text-3xl font-black text-blue-400 mt-1">{selDay.count}</p>
                      <p className="text-[10px] text-slate-500 font-bold">transactions</p>
                    </div>
                  ):(
                    <div className="flex items-center gap-2 opacity-35">
                      <MousePointerClick size={14} className="text-blue-400"/>
                      <span className="text-[10px] text-slate-500 uppercase font-bold">Click a cell</span>
                    </div>
                  )}
                </div>
              </div>
              <div ref={scrollRef} className="overflow-x-auto pb-2 no-scrollbar">
                <div className="grid grid-flow-col gap-1 mb-1 min-w-max auto-cols-[11px]">
                  {wallet.weekLabels.map((m,i)=><div key={i} className="text-[8px] font-bold text-slate-700 uppercase overflow-visible whitespace-nowrap">{m}</div>)}
                </div>
                <div className="grid grid-rows-7 grid-flow-col gap-1 h-24 min-w-max">
                  {wallet.dailyStats.map((s,i)=>(
                    <div key={i} onClick={()=>setSelDay(s)}
                      className={`w-3 h-3 rounded-sm cursor-pointer transition-all hover:scale-125 hover:ring-1 hover:ring-blue-400/50 ${s.count===0?'bg-white/5':'bg-blue-600'}`}
                      style={{opacity:s.count===0?0.4:0.35+s.intensity*0.165}}/>
                  ))}
                </div>
              </div>
              </div>{/* end inner padding */}
            </div>

            {/* Wallet Intelligence Grid */}
            <div>
              <p className="text-[10px] font-black text-slate-600 uppercase tracking-widest mb-3 flex items-center gap-2"><BarChart3 size={12}/>Wallet Intelligence</p>
              <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 xl:grid-cols-5 gap-2 sm:gap-3">
                {/* Identity card */}
                <div className="bg-[#0d1424] border border-white/8 rounded-2xl p-4 col-span-2 flex items-center gap-3 overflow-hidden">
                  <div className="w-12 h-12 bg-blue-600/15 border border-blue-500/20 rounded-2xl flex items-center justify-center shrink-0"><User size={22} className="text-blue-400"/></div>
                  <div className="min-w-0">
                    <p className="font-black text-white text-base sm:text-lg truncate">{wallet.basename||`${wallet.address.slice(0,8)}...${wallet.address.slice(-4)}`}</p>
                    <p className="text-[10px] text-slate-500 uppercase font-bold truncate mt-0.5">{wallet.walletRank}</p>
                    {wallet.basename&&<span className="inline-flex items-center gap-1 text-[9px] font-black text-green-400 bg-green-500/8 border border-green-500/15 px-2 py-0.5 rounded-full mt-1.5"><BadgeCheck size={9}/>Verified Basename</span>}
                  </div>
                </div>
                {[
                  {l:'ETH Balance',       v:`${wallet.balance} Ξ`,              i:<CreditCard size={15} className="text-blue-400"/>},
                  {l:'Days on Base',      v:wallet.daysOnBase.toLocaleString(),  i:<Calendar size={15} className="text-purple-400"/>},
                  {l:'Active Days',       v:wallet.uniqueDays.toString(),        i:<Sun size={15} className="text-yellow-400"/>},
                  {l:'Active Weeks',      v:wallet.activeWeeks.toString(),       i:<Calendar size={15} className="text-cyan-400"/>},
                  {l:'Active Months',     v:wallet.activeMonths.toString(),      i:<Calendar size={15} className="text-emerald-400"/>},
                  {l:'Current Streak',    v:`${wallet.currentStreak}d`,          i:<Flame size={15} className="text-orange-400"/>},
                  {l:'Longest Streak',    v:`${wallet.longestStreak}d`,          i:<Trophy size={15} className="text-yellow-400"/>},
                  {l:'Total Txs',         v:wallet.txCount.toLocaleString(),     i:<Layers size={15} className="text-blue-400"/>},
                  {l:'Token Swaps',       v:wallet.swapCount.toLocaleString(),   i:<ArrowRightLeft size={15} className="text-green-400"/>},
                  {l:'Unique Tokens',     v:wallet.tokensSwapped.toString(),     i:<Coins size={15} className="text-yellow-400"/>},
                  {l:'DeFi Interactions', v:wallet.defiInteractions.toLocaleString(),i:<TrendingUp size={15} className="text-purple-400"/>},
                  {l:'ETH Volume Sent',   v:`${wallet.ethVolume} Ξ`,             i:<ArrowRightLeft size={15} className="text-cyan-400"/>},
                  {l:'ETH Received',      v:`${wallet.ethReceived} Ξ`,           i:<Gift size={15} className="text-green-400"/>},
                  {l:'NFTs Held',         v:wallet.nftCount.toLocaleString(),    i:<Sparkles size={15} className="text-pink-400"/>},
                  {l:'Contract Txs',      v:wallet.contractInteractions.toLocaleString(),i:<FileCode size={15} className="text-slate-400"/>},
                  {l:'Unique Contracts',  v:wallet.uniqueContracts.toLocaleString(),i:<Database size={15} className="text-indigo-400"/>},
                  {l:'Avg Tx / Day',      v:wallet.avgTxPerDay.toString(),       i:<BarChart3 size={15} className="text-blue-400"/>},
                  {l:'ERC-20 Txs',        v:wallet.erc20Txs.toLocaleString(),    i:<Coins size={15} className="text-amber-400"/>},
                  {l:'NFT Txs',           v:wallet.erc721Txs.toLocaleString(),   i:<Palette size={15} className="text-rose-400"/>},
                  {l:'Most Active Month', v:wallet.mostActiveMonth,              i:<Clock size={15} className="text-teal-400"/>},
                  {l:'First Transaction', v:wallet.firstTx,                      i:<Star size={15} className="text-yellow-400"/>},
                  {l:'Last Transaction',  v:wallet.lastTx,                       i:<Clock size={15} className="text-slate-400"/>},
                  {l:'Onchain Streak',    v:`${streak}d`,                        i:<Zap size={15} className="text-blue-400"/>},
                  {l:'Minted Badges',     v:mintedCount.toString(),              i:<Trophy size={15} className="text-yellow-400"/>},
                  {l:'XP Boosts',         v:boosts.toString(),                   i:<Rocket size={15} className="text-blue-400"/>},
                  {l:'Weekly XP',         v:weeklyXP.toString(),                 i:<Zap size={15} className="text-yellow-400"/>},
                ].map((s,i)=>(
                  <div key={i} className="bg-[#0d1424] border border-white/8 rounded-2xl p-3 sm:p-4 hover:border-blue-500/25 transition-all group">
                    <div className="mb-2 group-hover:scale-110 transition-transform w-fit">{s.i}</div>
                    <p className="font-black text-white text-sm sm:text-base truncate leading-tight">{s.v}</p>
                    <p className="text-[9px] text-slate-600 uppercase font-bold tracking-wide mt-0.5 truncate">{s.l}</p>
                  </div>
                ))}
              </div>
            </div>

            {/* Action Cards */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-3 sm:gap-4">

              {/* Referral */}
              <div className="bg-[#0d1424] border border-purple-500/20 rounded-2xl p-5">
                <div className="flex items-start justify-between mb-3">
                  <div className="flex items-center gap-2"><Gift size={18} className="text-purple-400"/><span className="font-black text-white">Referral Program</span></div>
                  <span className="text-[10px] font-bold text-purple-300 bg-purple-500/8 border border-purple-500/20 px-2 py-1 rounded-lg">+50 XP per ref</span>
                </div>
                <p className="text-xs text-slate-400 mb-4 leading-relaxed">Share your link. Friends who connect earn you bonus Season XP.</p>
                <div className="flex gap-2">
                  <div className="flex-1 min-w-0 bg-white/5 border border-white/8 rounded-xl px-3 py-2.5 text-xs font-mono text-slate-400 truncate">{APP_URL_WEB}?ref={ref}</div>
                  <button onClick={()=>{navigator.clipboard.writeText(`${APP_URL_WEB}?ref=${ref}`);setRefCopied(true);setTimeout(()=>setRefCopied(false),2000);}}
                    className={`shrink-0 px-4 py-2.5 rounded-xl font-black text-xs flex items-center gap-1.5 transition-all active:scale-95 ${refCopied?'bg-green-600 text-white':'bg-blue-600 hover:bg-blue-500 text-white shadow-lg shadow-blue-600/25'}`}>
                    {refCopied?<CheckCircle size={13}/>:<Copy size={13}/>}{refCopied?'Done!':'Copy'}
                  </button>
                </div>
              </div>

              {/* Challenge */}
              <div className="bg-[#0d1424] border border-orange-500/20 rounded-2xl p-5">
                <div className="flex items-center gap-2 mb-3"><Swords size={18} className="text-orange-400"/><span className="font-black text-white">Wallet Challenge</span></div>
                <p className="text-xs text-slate-400 mb-4">Enter any wallet address to compare scores head-to-head.</p>
                <div className="flex gap-2 mb-3">
                  <input value={challenge} onChange={e=>setChallenge(e.target.value)} placeholder="0x..." className="flex-1 min-w-0 bg-white/5 border border-white/8 rounded-xl px-3 py-2.5 text-xs font-mono text-white placeholder-slate-600 outline-none focus:border-blue-500/40 transition-all"/>
                  <button onClick={()=>{if(!challenge)return;const s=Math.floor(Math.random()*65+15);const rs=['Base Shrimp 🦐','Base Dolphin 🐬','Base Shark 🦈','Base Whale 🐋'];setChallengeResult({address:challenge,score:s,rank:rs[Math.floor(s/25)]||rs[0]});}} className="shrink-0 bg-orange-600 hover:bg-orange-500 text-white px-5 py-2.5 rounded-xl font-black text-xs transition-all active:scale-95">Go</button>
                </div>
                {challengeResult&&(
                  <div className="grid grid-cols-2 gap-2">
                    <div className={`rounded-xl p-3 text-center border ${wallet.score>=challengeResult.score?'bg-blue-600/10 border-blue-500/25':'bg-white/5 border-white/8'}`}>
                      <p className="text-[10px] text-slate-500 uppercase font-bold">You</p>
                      <p className="text-3xl font-black text-blue-400 my-1">{wallet.score}</p>
                      {wallet.score>challengeResult.score&&<p className="text-[10px] font-black text-green-400">WINNER 🏆</p>}
                    </div>
                    <div className={`rounded-xl p-3 text-center border ${challengeResult.score>wallet.score?'bg-red-500/8 border-red-500/15':'bg-white/5 border-white/8'}`}>
                      <p className="text-[10px] text-slate-500 uppercase font-bold truncate">{challengeResult.address.slice(0,6)}...</p>
                      <p className="text-3xl font-black text-slate-400 my-1">{challengeResult.score}</p>
                      {challengeResult.score>wallet.score&&<p className="text-[10px] font-black text-red-400">WINNER 🏆</p>}
                    </div>
                  </div>
                )}
              </div>

              {/* XP Booster */}
              <div className="bg-[#0d1424] border border-blue-500/20 rounded-2xl p-5 flex flex-col sm:flex-row items-center gap-4 justify-between">
                <div className="flex items-center gap-3 w-full sm:w-auto">
                  <div className="w-12 h-12 bg-blue-600/15 rounded-2xl border border-blue-500/20 flex items-center justify-center shrink-0"><Rocket size={22} className="text-blue-400"/></div>
                  <div>
                    <p className="font-black text-white text-base">XP Booster</p>
                    <div className="flex gap-2 mt-1.5 flex-wrap">
                      <span className="bg-white/5 border border-white/8 rounded-lg px-2.5 py-1 text-xs"><span className="text-blue-400 font-black">{boosts}</span><span className="text-slate-500 ml-1">boosts</span></span>
                      <span className="bg-white/5 border border-white/8 rounded-lg px-2.5 py-1 text-xs"><span className="text-orange-400 font-black">{streak}d</span><span className="text-slate-500 ml-1">streak</span></span>
                    </div>
                  </div>
                </div>
                <div className="w-full sm:w-auto sm:min-w-35 text-center">
                  {connType==='farcaster'?(
                    <button onClick={()=>doNativeTx('boost')} disabled={!!minting}
                      className={`w-full py-3 px-5 rounded-xl font-black text-sm transition-all active:scale-95 ${minting?'bg-blue-600/40 text-white/40 cursor-not-allowed':'bg-blue-600 hover:bg-blue-500 text-white shadow-xl shadow-blue-600/30'}`}>
                      {minting==='boost'?<RefreshCcw className="animate-spin mx-auto" size={18}/>:'BOOST (+1)'}
                    </button>
                  ):(
                    <Transaction key={`boost-${txKeys.boost}`} chainId={base.id} calls={boostCall} capabilities={txCaps}
                      onStatus={s=>{if(s.statusName==='success'){setBoosts(b=>{const n=b+1;if(typeof window!=='undefined')localStorage.setItem(`base_boosts_${wallet.address.toLowerCase()}`,n.toString());return n;});setSponsored(v=>v+1);showToast('Boosted! 🎉',s.statusData.transactionReceipts?.[0]?.transactionHash||'');setTxKeys(k=>({...k,boost:(k.boost||0)+1}));}}}>
                      <TransactionButton className="w-full py-3 px-5 rounded-xl font-black text-sm bg-blue-600 hover:bg-blue-500 text-white shadow-xl shadow-blue-600/30 transition-all" text="BOOST (+1)"/>
                    </Transaction>
                  )}
                  <p className="text-[9px] text-blue-500/50 mt-1.5 flex items-center justify-center gap-1"><Droplets size={8}/>Gas Sponsored</p>
                </div>
              </div>

              {/* GM / GN */}
              <div className="bg-[#0d1424] border border-white/8 rounded-2xl p-5">
                <p className="font-black text-white mb-4 flex items-center gap-2"><Star size={15} className="text-yellow-400"/>Community Vibes</p>
                <div className="grid grid-cols-2 gap-3">
                  {(['gm','gn'] as const).map(type=>(
                    <div key={type} className="text-center">
                      {connType==='farcaster'?(
                        <button onClick={()=>doNativeTx(type)} disabled={!!minting}
                          className={`w-full py-4 rounded-xl font-black text-xl transition-all active:scale-95 border ${minting?'opacity-40 cursor-not-allowed bg-white/3 border-white/5 text-white/30':'bg-white/5 hover:bg-blue-600/15 border-white/8 hover:border-blue-500/25 text-white'}`}>
                          {minting===type?<RefreshCcw className="animate-spin mx-auto" size={18}/>:(type==='gm'?'☀️ GM':'🌙 GN')}
                        </button>
                      ):(
                        <Transaction key={`${type}-${txKeys[type]}`} chainId={base.id} calls={type==='gm'?gmCall:gnCall} capabilities={txCaps}
                          onStatus={s=>{if(s.statusName==='success'){showToast(type==='gm'?'GM! ☀️':'GN! 🌙',s.statusData.transactionReceipts?.[0]?.transactionHash||'');setSponsored(v=>v+1);if(type==='gm'&&typeof window!=='undefined')localStorage.setItem(`base_gm_${wallet.address.toLowerCase()}`,'true');setTxKeys(k=>({...k,[type]:(k[type]||0)+1}));}}}>
                          <TransactionButton className="w-full py-4 rounded-xl font-black text-xl bg-white/5 hover:bg-blue-600/15 border border-white/8 hover:border-blue-500/25 text-white transition-all" text={type==='gm'?'☀️ GM':'🌙 GN'}/>
                        </Transaction>
                      )}
                      <p className="text-[9px] text-blue-500/50 mt-1.5 flex items-center justify-center gap-1"><Droplets size={8}/>Gas Sponsored</p>
                    </div>
                  ))}
                </div>
              </div>
            </div>

            {/* Recent Activity */}
            <div>
              <p className="text-[10px] font-black text-slate-600 uppercase tracking-widest mb-3 flex items-center gap-2"><History size={12}/>Recent Activity</p>
              <div className="bg-[#0d1424] border border-white/8 rounded-2xl overflow-hidden">
                {wallet.recentTxs.length>0?wallet.recentTxs.map((tx,i)=>(
                  <div key={i} className={`flex items-center justify-between p-3 sm:p-4 gap-3 hover:bg-white/3 transition-colors ${i!==wallet.recentTxs.length-1?'border-b border-white/5':''}`}>
                    <div className="flex items-center gap-3 min-w-0">
                      <div className="w-8 h-8 bg-blue-600/10 rounded-xl flex items-center justify-center shrink-0">
                        {tx.category==='erc721'?<Sparkles size={13} className="text-pink-400"/>:tx.category==='erc20'?<Coins size={13} className="text-yellow-400"/>:<ArrowRightLeft size={13} className="text-blue-400"/>}
                      </div>
                      <div className="min-w-0">
                        <p className="text-xs font-black text-white uppercase truncate">{tx.category==='external'?'Contract Call':tx.category==='erc20'?'Token Transfer':tx.category==='erc721'?'NFT Transfer':'Transfer'}</p>
                        <p className="text-[10px] text-slate-600 truncate">{new Date(tx.metadata.blockTimestamp).toLocaleString()}</p>
                      </div>
                    </div>
                    <a href={`https://basescan.org/tx/${tx.hash}`} target="_blank" rel="noreferrer"
                      className="shrink-0 text-[10px] font-black text-blue-400 hover:text-blue-300 bg-blue-600/8 hover:bg-blue-600/15 border border-blue-500/20 px-3 py-1.5 rounded-xl flex items-center gap-1 transition-all whitespace-nowrap">
                      <ExternalLink size={9}/>{tx.value?`${parseFloat(tx.value.toFixed(4))} ${tx.asset}`:'View'}
                    </a>
                  </div>
                )):<p className="text-slate-600 text-sm text-center py-8">No recent transactions found.</p>}
              </div>
            </div>
          </div>
        )}

        {/* ═══ ACHIEVEMENTS ═══ */}
        {tab==='achievements'&&(
          <div>
            <div className="flex items-center justify-between mb-4">
              <p className="text-[10px] font-black text-slate-600 uppercase tracking-widest flex items-center gap-2"><Trophy size={12}/>Mint Your Identity</p>
              {mintedCount>0&&(
                <div className="flex gap-1.5">
                  <button onClick={()=>shareAll(mintedCount,'w')} className="bg-[#0d1424] border border-white/8 hover:bg-purple-600/15 hover:border-purple-500/25 text-slate-400 p-2 rounded-xl transition-all"><Send size={13}/></button>
                  <button onClick={()=>shareAll(mintedCount,'t')} className="bg-[#0d1424] border border-white/8 hover:bg-sky-600/15 hover:border-sky-500/25 text-slate-400 p-2 rounded-xl transition-all"><Twitter size={13}/></button>
                </div>
              )}
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-3 sm:gap-4">
              {ACHIEVEMENTS.map(cat=>{
                const value=getCatValue(cat.id);
                let unlocked=0;for(let i=0;i<cat.thresholds.length;i++){if(value>=cat.thresholds[i])unlocked=i+1;}
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
                  <div key={cat.id} className="bg-[#0d1424] border border-white/8 rounded-3xl p-5 flex flex-col hover:border-blue-500/20 transition-all">
                    <div className="flex justify-between items-start mb-4">
                      <div className="flex items-center gap-3">
                        <div className="w-11 h-11 bg-white/5 border border-white/8 rounded-2xl flex items-center justify-center text-2xl">{cat.icon}</div>
                        <div>
                          <p className="font-black text-white text-sm">{cat.name}</p>
                          <p className="text-[10px] text-slate-600 uppercase font-bold mt-0.5">{unlocked>0?cat.tierNames[unlocked-1]:'Unranked'} · L{unlocked}/{cat.thresholds.length}</p>
                        </div>
                      </div>
                      <div className="text-right">
                        <p className="text-2xl font-black text-blue-400">{typeof value==='number'&&value<1?value.toFixed(3):value.toLocaleString()}</p>
                        <p className="text-[10px] text-slate-600 uppercase">{cat.unit}</p>
                      </div>
                    </div>
                    <div className="w-full bg-white/5 rounded-full h-1.5 mb-1 overflow-hidden">
                      <div className="h-full bg-linear-to-r from-blue-600 to-blue-400 rounded-full transition-all duration-1000" style={{width:`${prog}%`}}/>
                    </div>
                    <p className="text-right text-[10px] text-slate-600 font-bold mb-5">
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
                              {isMinted2&&<div className="absolute -top-1.5 -right-1.5 bg-green-500 text-white text-[8px] font-black w-4 h-4 flex items-center justify-center rounded-full border border-[#060a14] z-10">✓</div>}
                            </div>
                            <span className={`text-[7px] font-black text-center uppercase leading-tight truncate w-full px-0.5 ${isMinted2?'text-blue-400':isEarned?'text-slate-400':'text-slate-700'}`}>{cat.tierNames[idx]}</span>
                          </div>
                        );
                      })}
                    </div>
                    <div className="flex flex-col mt-auto">
                      <div className="flex gap-2">
                        {connType==='farcaster'?(
                          <button onClick={()=>doNativeMint(cat.id,toLevels,toMint,cat.name)} disabled={!canMint||!!minting}
                            className={`flex-1 py-3 rounded-xl font-black text-xs transition-all active:scale-95 ${canMint&&!minting?'bg-blue-600 hover:bg-blue-500 text-white shadow-lg shadow-blue-600/20':'bg-white/5 text-slate-700 cursor-not-allowed border border-white/8'}`}>
                            {minting===`mint-${cat.id}`?<RefreshCcw className="animate-spin mx-auto" size={16}/>:btnText}
                          </button>
                        ):canMint?(
                          <Transaction key={`mint-${cat.id}-${txKeys[`mint-${cat.id}`]||0}`} chainId={base.id} calls={mintCall2} capabilities={txCaps}
                            onStatus={s=>{if(s.statusName==='success'){showToast(isBatch?`✅ Claimed ${toMint.length} ${cat.name} Badges!`:`✅ Badge mintedTier!`,s.statusData.transactionReceipts?.[0]?.transactionHash||'');setMintedLevels(p=>({...p,[cat.id]:Math.max(...toLevels)}));setSponsored(v=>v+1);}}}>
                            <TransactionButton className="flex-1 py-3 w-full rounded-xl font-black text-xs bg-blue-600 hover:bg-blue-500 text-white shadow-lg shadow-blue-600/20 transition-all" text={btnText}/>
                          </Transaction>
                        ):(
                          <button disabled className="flex-1 py-3 rounded-xl font-black text-xs bg-white/5 text-slate-700 cursor-not-allowed border border-white/8">{btnText}</button>
                        )}
                        {mintedTier>0&&(
                          <div className="flex gap-1.5 shrink-0">
                            <button onClick={()=>shareAch(cat.name,cat.tierNames[mintedTier-1],'w')} className="bg-[#0d1424] border border-white/8 hover:bg-purple-600/15 text-slate-500 p-3 rounded-xl transition-all"><Send size={13}/></button>
                            <button onClick={()=>shareAch(cat.name,cat.tierNames[mintedTier-1],'t')} className="bg-[#0d1424] border border-white/8 hover:bg-sky-600/15 text-slate-500 p-3 rounded-xl transition-all"><Twitter size={13}/></button>
                          </div>
                        )}
                      </div>
                      {canMint&&<p className="text-[9px] text-blue-500/50 mt-2 text-center flex items-center justify-center gap-1"><Droplets size={8}/>Gas Sponsored via Coinbase Paymaster</p>}
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
            <div className="relative overflow-hidden bg-linear-to-br from-blue-700 via-blue-600 to-purple-700 rounded-3xl p-5 sm:p-7">
              <div className="absolute inset-0 opacity-10" style={{backgroundImage:'linear-gradient(rgba(255,255,255,0.1) 1px,transparent 1px),linear-gradient(90deg,rgba(255,255,255,0.1) 1px,transparent 1px)',backgroundSize:'32px 32px'}}/>
              <div className="absolute -right-8 -top-8 w-40 h-40 bg-white/5 rounded-full"/>
              <div className="relative flex flex-col sm:flex-row sm:items-center justify-between gap-5">
                <div>
                  <div className="flex items-center gap-2 mb-1.5"><Star size={14} className="text-yellow-300"/><span className="text-xs font-black uppercase tracking-widest text-white/60">{SEASON_NAME}</span></div>
                  <h3 className="text-2xl sm:text-3xl font-black text-white">Season Pass</h3>
                  <p className="text-sm text-white/60 mt-0.5">{getDaysLeft()} days remaining · XP carries over weekly</p>
                  <div className="mt-4 w-full sm:max-w-xs">
                    <div className="flex justify-between text-[10px] text-white/50 font-bold mb-1.5"><span>Progress</span><span>{getSeasonPct()}%</span></div>
                    <div className="w-full bg-white/15 rounded-full h-2 overflow-hidden">
                      <div className="h-full bg-white rounded-full" style={{width:`${getSeasonPct()}%`,transition:'width 1.5s ease-out'}}/>
                    </div>
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
                  <div key={q.id} className={`rounded-2xl p-4 border flex items-center gap-4 justify-between transition-all ${done?'bg-green-500/5 border-green-500/20':'bg-[#0d1424] border-white/8 hover:border-white/12'}`}>
                    <div className="flex items-center gap-3 min-w-0">
                      <div className={`w-11 h-11 rounded-2xl flex items-center justify-center text-xl shrink-0 ${done?'bg-green-500/15':'bg-white/5 border border-white/8'}`}>{done?'✅':q.icon}</div>
                      <div className="min-w-0">
                        <p className={`font-black text-sm truncate ${done?'text-green-300':'text-white'}`}>{q.title}</p>
                        <p className="text-[10px] text-slate-500 truncate mt-0.5">{q.desc}</p>
                      </div>
                    </div>
                    <div className={`shrink-0 px-3 py-2 rounded-xl font-black text-xs border whitespace-nowrap ${done?'bg-green-500/8 text-green-400 border-green-500/20':'bg-blue-600/8 text-blue-400 border-blue-500/20'}`}>+{q.xp} XP</div>
                  </div>
                );
              })}
            </div>

            <div className="bg-[#0d1424] border border-white/8 rounded-2xl p-5">
              <p className="font-black text-white mb-4 flex items-center gap-2"><Zap size={15} className="text-yellow-400"/>XP Multipliers & Season Rewards</p>
              <div className="space-y-2">
                {[
                  {l:'3-day check-in streak',b:'2× XP on all quests'},
                  {l:'7-day check-in streak',b:'3× XP on all quests'},
                  {l:'Top 10 at season end', b:'Exclusive Genesis Badge NFT'},
                  {l:'Refer 3+ friends',     b:'+150 bonus XP + referral badge'},
                  {l:'All 10 weekly quests', b:'Season multiplier bonus'},
                  {l:'Mint all 11 badges',   b:'Hall of Fame status'},
                  {l:'Weekly XP resets Mon', b:'Past weeks carry to Total Season XP'},
                ].map((m,i)=>(
                  <div key={i} className="flex flex-col sm:flex-row sm:items-center justify-between bg-white/3 rounded-xl p-3 border border-white/5 gap-2">
                    <span className="text-xs text-slate-300">{m.l}</span>
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
            {/* Leaderboard header — styled like Farcaster profile section */}
            <div className="bg-[#0d1424] border border-white/8 rounded-3xl overflow-hidden mb-0">
              <div className="h-1 bg-linear-to-r from-green-500 via-blue-500 to-purple-500"/>
              <div className="p-5">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <p className="text-[10px] font-black text-slate-500 uppercase tracking-widest flex items-center gap-2 mb-1"><Users size={11}/>GLOBAL LEADERBOARD</p>
                    <p className="text-2xl font-black text-white leading-none">{leaderboard.length.toLocaleString()}</p>
                    <p className="text-[11px] text-slate-500 mt-0.5">Genesis Season Participants</p>
                  </div>
                  <div className="flex flex-col items-end gap-2">
                    <span className="flex items-center gap-1.5 text-[10px] font-bold text-green-400 bg-green-500/8 border border-green-500/20 px-3 py-1.5 rounded-xl">
                      <Wifi size={9}/>Live · Redis backed
                    </span>
                    <span className="text-[10px] text-slate-600 bg-white/4 border border-white/6 px-3 py-1.5 rounded-xl">{getDaysLeft()}d left</span>
                  </div>
                </div>
              </div>
            </div>

            {/* My rank card — styled like Farcoin profile card */}
            {(()=>{const pos=leaderboard.findIndex(e=>e.address.toLowerCase()===wallet.address.toLowerCase());return pos>=0?(
              <div className="bg-[#0d1424] border border-blue-500/25 rounded-3xl overflow-hidden">
                <div className="h-0.5 bg-linear-to-r from-blue-600 to-indigo-500"/>
                <div className="p-5">
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex items-center gap-3">
                      <div className="w-12 h-12 bg-blue-600/20 border border-blue-500/30 rounded-2xl flex items-center justify-center font-black text-blue-400 text-lg shrink-0">#{pos+1}</div>
                      <div>
                        <p className="font-black text-white text-base truncate">{wallet.basename||`${wallet.address.slice(0,6)}...${wallet.address.slice(-4)}`}</p>
                        <div className="flex items-center gap-2 mt-1">
                          <span className="text-[10px] font-black text-blue-400 bg-blue-500/10 border border-blue-500/15 px-2 py-0.5 rounded-lg">{wallet.walletRank}</span>
                          <span className="text-[10px] text-slate-600">Season 1 Genesis</span>
                        </div>
                      </div>
                    </div>
                    <div className="text-right shrink-0">
                      <p className="text-[10px] font-black text-slate-500 uppercase tracking-widest mb-1">TOTAL SEASON XP</p>
                      <p className="text-4xl font-black text-white leading-none">{(leaderboard[pos]?.totalXP??weeklyXP).toLocaleString()}</p>
                      <p className="text-[11px] text-green-400 font-bold mt-1">+{weeklyXP} XP this week</p>
                    </div>
                  </div>
                  {/* XP breakdown row */}
                  <div className="grid grid-cols-3 gap-2 mt-4">
                    {[
                      {l:'Score',  v:wallet.score+'/100',      c:'text-blue-400'},
                      {l:'Badges', v:String(mintedCount),       c:'text-yellow-400'},
                      {l:'Streak', v:streak+'d',               c:'text-orange-400'},
                    ].map((s,i)=>(
                      <div key={i} className="bg-white/4 border border-white/6 rounded-xl p-2.5 text-center">
                        <p className={`font-black text-base ${s.c}`}>{s.v}</p>
                        <p className="text-[9px] text-slate-600 uppercase font-bold mt-0.5">{s.l}</p>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            ):null;})()}

            {lbLoading?(
              <div className="bg-[#0d1424] border border-white/8 rounded-3xl p-12 text-center">
                <RefreshCcw className="animate-spin text-blue-500 mx-auto mb-3" size={24}/>
                <p className="text-slate-400 font-bold text-sm">Loading from Redis...</p>
              </div>
            ):leaderboard.length===0?(
              <div className="bg-[#0d1424] border-2 border-dashed border-white/8 rounded-3xl p-12 text-center">
                <Users size={28} className="text-slate-700 mx-auto mb-3"/>
                <p className="font-black text-slate-500 mb-1">No entries yet</p>
                <p className="text-xs text-slate-700">Be the first! Connect your wallet and earn XP.</p>
              </div>
            ):(
              <div className="bg-[#0d1424] border border-white/8 rounded-3xl overflow-hidden">
                {/* Table header */}
                <div className="px-4 py-3 border-b border-white/6 bg-white/2">
                  <div className="grid grid-cols-[auto_1fr_auto_auto] sm:grid-cols-[auto_1fr_auto_auto_auto] text-[9px] font-black text-slate-600 uppercase tracking-widest">
                    <span className="w-10">Rank</span>
                    <span>Wallet</span>
                    <span className="hidden sm:block w-16 text-right">Badges</span>
                    <span className="w-24 text-right">Season XP</span>
                    <span className="hidden sm:block w-8"/>
                  </div>
                </div>
                {/* Rows */}
                {leaderboard.map((e,idx)=>{
                  const isMe=e.address.toLowerCase()===wallet.address.toLowerCase();
                  const medal=idx===0?'🥇':idx===1?'🥈':idx===2?'🥉':null;
                  const displayTotal=(e.totalXP??e.weeklyXP??0);
                  return(
                    <div key={e.address}
                      className={`grid grid-cols-[auto_1fr_auto_auto] sm:grid-cols-[auto_1fr_auto_auto_auto] items-center px-4 py-3.5 border-b border-white/4 last:border-0 transition-all ${isMe?'bg-blue-600/8 border-l-2 border-l-blue-500':'hover:bg-white/2'}`}>
                      {/* Rank */}
                      <div className="w-10">
                        {medal
                          ? <span className="text-lg">{medal}</span>
                          : <span className={`text-xs font-black ${idx<10?'text-slate-400':'text-slate-700'}`}>#{idx+1}</span>
                        }
                      </div>
                      {/* Wallet */}
                      <div className="min-w-0 pr-3">
                        <p className={`font-black text-sm truncate ${isMe?'text-blue-400':'text-white'}`}>
                          {e.basename||`${e.address.slice(0,8)}...${e.address.slice(-4)}`}
                          {isMe&&<span className="text-[9px] text-blue-500/60 ml-2 font-bold bg-blue-500/10 px-1.5 py-0.5 rounded">you</span>}
                        </p>
                        <p className="text-[9px] text-slate-600 font-bold mt-0.5">{e.rank}</p>
                      </div>
                      {/* Badges */}
                      <div className="hidden sm:block w-16 text-right">
                        <p className="text-xs font-black text-slate-400">{e.badges}</p>
                        <p className="text-[8px] text-slate-700 font-bold">badges</p>
                      </div>
                      {/* XP */}
                      <div className="w-24 text-right">
                        <p className={`text-base font-black ${isMe?'text-blue-400':'text-white'}`}>{displayTotal.toLocaleString()}</p>
                        <p className="text-[9px] text-green-500/70 font-bold">+{e.weeklyXP} wk</p>
                      </div>
                      {/* Arrow */}
                      <div className="hidden sm:flex w-8 justify-center">
                        {idx===0?<ChevronUp size={12} className="text-green-400"/>:<ChevronDown size={12} className="text-slate-700"/>}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}

            {/* Season rewards card — analytics metric row style */}
            <div className="bg-[#0d1424] border border-white/8 rounded-3xl overflow-hidden">
              <div className="h-0.5 bg-linear-to-r from-yellow-500 via-orange-500 to-red-500"/>
              <div className="p-5">
                <div className="flex items-center gap-2.5 mb-4">
                  <div className="w-8 h-8 bg-yellow-500/15 rounded-xl flex items-center justify-center">
                    <Medal size={15} className="text-yellow-400"/>
                  </div>
                  <span className="font-black text-white">Season 1 Rewards</span>
                </div>
                <div className="space-y-2">
                  {[
                    {l:'Top 10 at season end',    v:'Exclusive Genesis Badge NFT', c:'text-yellow-400'},
                    {l:'XP resets every Monday',  v:'Past weeks carry forward',    c:'text-green-400'},
                    {l:'All badges minted',        v:'Hall of Fame status',          c:'text-blue-400'},
                    {l:'3+ referrals',             v:'+150 bonus XP',               c:'text-purple-400'},
                  ].map((r,i)=>(
                    <div key={i} className="flex items-center justify-between bg-white/3 border border-white/5 rounded-xl px-3 py-2.5">
                      <span className="text-xs text-slate-400">{r.l}</span>
                      <span className={`text-xs font-black ${r.c}`}>{r.v}</span>
                    </div>
                  ))}
                </div>
              </div>
            </div>
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
 