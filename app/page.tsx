"use client";

import React, { useState, useEffect, useRef } from 'react';
import { 
  Wallet, Activity, Zap, Layers, Calendar, ArrowRightLeft, Power, 
  RefreshCcw, Sun, FileCode, BarChart3, Trophy, 
  CreditCard, User, BadgeCheck, Send, X, AlertTriangle,
  ChevronRight, Share2, Rocket, Twitter, MousePointerClick, Clock, Moon, Sparkles, Medal, History, Droplets
} from 'lucide-react';
import { JsonRpcProvider, formatEther, toUtf8Bytes } from 'ethers';
import { sdk } from "@farcaster/miniapp-sdk";
import { connectWallet } from './connection';

// OnchainKit & Viem Imports
import { 
  Transaction, 
  TransactionButton
} from '@coinbase/onchainkit/transaction'; 
import { base } from 'viem/chains';
import { encodeFunctionData } from 'viem';

// --- CONFIGURATION ---
const ALCHEMY_KEY = process.env.NEXT_PUBLIC_ALCHEMY_KEY || "ZHHTYOLANc6hp1RX7bQp1"; 
const BASE_RPC = `https://base-mainnet.g.alchemy.com/v2/${ALCHEMY_KEY}`;
const MINIAPP_URL = "https://farcaster.xyz/miniapps/lYFXQz4s1wsq/base-analytics";

const BUILDER_CODE = "bc_4uoh9iu2"; 

function getBuilderSuffix() {
  const codeBytes = toUtf8Bytes(BUILDER_CODE);
  const codeHex = Array.from(codeBytes).map(b => b.toString(16).padStart(2, '0')).join('');
  const lengthHex = codeBytes.length.toString(16).padStart(2, '0'); 
  const schemaId = "00";
  const ercMarker = "80218021802180218021802180218021"; 
  return `${codeHex}${lengthHex}${schemaId}${ercMarker}`;
}

const BOOSTER_CONTRACT_ADDRESS = "0xd14E38239791738e8aCbd0Ad5278496af26fF510"; 
const GM_GN_CONTRACT_ADDRESS = "0xc801bCe6739D30C409151a544F0baEd10EB719dE"; 

const BOOSTER_ABI = [
  { name: 'boost', type: 'function', stateMutability: 'payable', inputs: [], outputs: [] }
] as const;

const GM_GN_ABI = [
  { name: 'gm', type: 'function', stateMutability: 'payable', inputs: [], outputs: [] },
  { name: 'gn', type: 'function', stateMutability: 'payable', inputs: [], outputs: [] }
] as const;

const MONTHS_3_LETTERS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

// --- TYPES ---
interface DayStats { date: string; count: number; intensity: number; }
interface Badge { icon: string; name: string; desc: string; }
interface WalletData {
  address: string; basename: string | null; balance: string; ethVolume: string;
  txCount: number; uniqueDays: number; activeWeeks: number; activeMonths: number;
  currentStreak: number; longestStreak: number; firstTx: string; lastTx: string;
  daysSinceActive: number; tokensSwapped: number; swapCount: number;     
  contractInteractions: number; nftCount: number; walletRank: string; 
  score: number; historyDays: number; weekLabels: string[]; dailyStats: DayStats[];
  topTokens: string[]; recommendation: string; 
  badges: Badge[]; recentTxs: AlchemyTransfer[];
  daysOnBase: number;
}
interface AlchemyTransfer { hash: string; category: string; value: number | null; asset: string | null; from: string; to: string | null; metadata: { blockTimestamp: string; }; }
interface AlchemyResponse { result?: { transfers: AlchemyTransfer[]; pageKey?: string; }; error?: { message: string; }; }
type ConnectionType = 'farcaster' | 'coinbase' | 'metamask';

export default function Page() {
  const [wallet, setWallet] = useState<WalletData | null>(null);
  const [connectionType, setConnectionType] = useState<ConnectionType | null>(null);
  
  const [loading, setLoading] = useState(false);
  const [isReady, setIsReady] = useState(false);
  const [showConnectModal, setShowConnectModal] = useState(false);
  const [selectedDay, setSelectedDay] = useState<DayStats | null>(null);
  const scrollRef = useRef<HTMLDivElement>(null);
  
  const [userBoosts, setUserBoosts] = useState(0);
  const [sponsoredTxs, setSponsoredTxs] = useState(0); 

  const [txKeys, setTxKeys] = useState({ boost: 0, gm: 0, gn: 0 });
  const [toast, setToast] = useState<{ show: boolean, message: string, hash: string } | null>(null);

  // --- MOVED DECLARATIONS UP HERE TO FIX TYPESCRIPT ERROR ---
  const boostData = encodeFunctionData({ abi: BOOSTER_ABI, functionName: 'boost' });
  const boostDataWithTracking = `${boostData}${getBuilderSuffix()}` as `0x${string}`;
  
  const gmData = encodeFunctionData({ abi: GM_GN_ABI, functionName: 'gm' });
  const gmDataWithTracking = `${gmData}${getBuilderSuffix()}` as `0x${string}`;

  const gnData = encodeFunctionData({ abi: GM_GN_ABI, functionName: 'gn' });
  const gnDataWithTracking = `${gnData}${getBuilderSuffix()}` as `0x${string}`;

  const boostCall = [{ to: BOOSTER_CONTRACT_ADDRESS as `0x${string}`, data: boostDataWithTracking, value: BigInt(4000000000000) }];
  const gmCall = [{ to: GM_GN_CONTRACT_ADDRESS as `0x${string}`, data: gmDataWithTracking, value: BigInt(4000000000000) }];
  const gnCall = [{ to: GM_GN_CONTRACT_ADDRESS as `0x${string}`, data: gnDataWithTracking, value: BigInt(4000000000000) }];

  const paymasterCapability = process.env.NEXT_PUBLIC_PAYMASTER_URL 
    ? { paymasterService: { url: process.env.NEXT_PUBLIC_PAYMASTER_URL } } 
    : undefined;
  // --------------------------------------------------------

  const showToast = (message: string, hash: string) => {
    setToast({ show: true, message, hash });
    setTimeout(() => setToast(null), 5000);
  };

  useEffect(() => {
    if (typeof window !== 'undefined' && sdk?.actions?.ready) {
        try { sdk.actions.ready(); setIsReady(true); } catch (e) { console.error("SDK Init Error", e); }
    }
  }, []);

  useEffect(() => {
    if (wallet && scrollRef.current) {
      setTimeout(() => { if (scrollRef.current) scrollRef.current.scrollLeft = scrollRef.current.scrollWidth; }, 100);
    }
  }, [wallet]);

  const getStrictUTCDate = (isoTimestamp: string) => isoTimestamp.split('T')[0];
  const getISOWeekToken = (date: Date) => {
    const d = new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()));
    const dayNum = d.getUTCDay() || 7;
    d.setUTCDate(d.getUTCDate() + 4 - dayNum);
    const year = d.getUTCFullYear();
    const weekNo = Math.ceil((((d.getTime() - new Date(Date.UTC(year, 0, 1)).getTime()) / 86400000) + 1) / 7);
    return `${year}-W${weekNo}`;
  };

  const analyzeWallet = async (address: string) => {
    setLoading(true); setShowConnectModal(false);
    try {
      const provider = new JsonRpcProvider(BASE_RPC);
      let basename = null; try { basename = await provider.lookupAddress(address); } catch {}
      const balWei = await provider.getBalance(address);

      let allTransfers: AlchemyTransfer[] = [];
      let pageKey: string | undefined = undefined;
      let loopCount = 0;

      while (true) {
          loopCount++;
          const params: Record<string, unknown> = { 
            fromBlock: "0x0", 
            toBlock: "latest", 
            fromAddress: address, 
            category: ["external", "erc20", "erc721", "erc1155"], 
            maxCount: "0x3e8", 
            withMetadata: true 
          };
          if (pageKey) params.pageKey = pageKey;
          const response = await fetch(BASE_RPC, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ jsonrpc: "2.0", id: 1, method: "alchemy_getAssetTransfers", params: [params] }) });
          const data = (await response.json()) as AlchemyResponse;
          if (data.error) throw new Error(data.error.message);
          const newTransfers = data.result?.transfers || [];
          allTransfers = [...allTransfers, ...newTransfers];
          pageKey = data.result?.pageKey;
          if (!pageKey || loopCount > 200) break;
      }
      
      const uniqueDays = new Set<string>(), uniqueWeeks = new Set<string>(), uniqueMonths = new Set<string>(), uniqueTokens = new Set<string>();
      const tokenFrequency = new Map<string, number>(); 
      
      let ethVolume = 0.0, swapCount = 0, contractInteractions = 0, nftCount = 0;
      let historicalBoosts = 0; 
      const txsPerDay = new Map<string, number>();

      const addTxToDay = (dateStr: string) => txsPerDay.set(dateStr, (txsPerDay.get(dateStr) || 0) + 1);

      for (const tx of allTransfers) {
        const d = new Date(tx.metadata.blockTimestamp);
        const dayStr = getStrictUTCDate(tx.metadata.blockTimestamp);
        uniqueDays.add(dayStr);
        addTxToDay(dayStr);
        uniqueWeeks.add(getISOWeekToken(d));
        uniqueMonths.add(`${d.getUTCFullYear()}-${d.getUTCMonth()}`);
        
        if (tx.value && (tx.asset === 'ETH' || tx.asset === 'WETH')) ethVolume += tx.value;
        if (['erc20', 'erc721', 'erc1155'].includes(tx.category)) { 
            swapCount++; 
            if (tx.asset) {
                uniqueTokens.add(tx.asset);
                tokenFrequency.set(tx.asset, (tokenFrequency.get(tx.asset) || 0) + 1);
            }
        }
        if (tx.category === 'external') contractInteractions++;
        if (tx.category === 'erc721' || tx.category === 'erc1155') nftCount++; 
        
        if (tx.to && tx.to.toLowerCase() === BOOSTER_CONTRACT_ADDRESS.toLowerCase()) {
            historicalBoosts++;
        }
      }

      setUserBoosts(historicalBoosts);

      const totalTxCount = allTransfers.length;

      const topTokens = Array.from(tokenFrequency.entries())
        .sort((a, b) => b[1] - a[1])
        .slice(0, 3)
        .map(entry => entry[0]);

      const recentTxs = [...allTransfers]
        .sort((a, b) => new Date(b.metadata.blockTimestamp).getTime() - new Date(a.metadata.blockTimestamp).getTime())
        .slice(0, 5);

      const sortedUniqueDays = Array.from(uniqueDays).sort(); 
      let currentStreak = 0, longestStreak = 0, tempStreak = 0, prevTimestamp = 0;
      for (const dayStr of sortedUniqueDays) {
          const currentTimestamp = Date.parse(dayStr);
          if (prevTimestamp !== 0) {
              const diff = (currentTimestamp - prevTimestamp) / (1000 * 3600 * 24);
              if (Math.round(diff) === 1) tempStreak++; else { longestStreak = Math.max(longestStreak, tempStreak); tempStreak = 1; }
          } else tempStreak = 1;
          prevTimestamp = currentTimestamp;
      }
      longestStreak = Math.max(longestStreak, tempStreak);
      const now = new Date();
      const todayStr = now.toISOString().split('T')[0];
      const yestDate = new Date(); yestDate.setUTCDate(now.getUTCDate() - 1);
      const yestStr = yestDate.toISOString().split('T')[0];
      if (uniqueDays.has(todayStr) || uniqueDays.has(yestStr)) currentStreak = tempStreak; else currentStreak = 0;

      let firstTxTimestamp = now.getTime();
      let lastTxTimestamp = 0;

      if (allTransfers.length > 0) {
          firstTxTimestamp = Math.min(firstTxTimestamp, new Date(allTransfers[0].metadata.blockTimestamp).getTime());
          lastTxTimestamp = Math.max(lastTxTimestamp, new Date(allTransfers[allTransfers.length-1].metadata.blockTimestamp).getTime());
      }

      let historyDays = 364; let firstTxStr = "N/A", lastTxStr = "N/A", daysSinceActive = 0, daysOnBase = 0;
      if (totalTxCount > 0) {
        firstTxStr = new Date(firstTxTimestamp).toLocaleDateString();
        lastTxStr = new Date(lastTxTimestamp).toLocaleDateString();
        daysSinceActive = Math.floor((now.getTime() - lastTxTimestamp) / (1000 * 3600 * 24));
        daysOnBase = Math.floor((now.getTime() - firstTxTimestamp) / (1000 * 3600 * 24)); 
        historyDays = Math.max(364, Math.ceil(Math.abs(now.getTime() - firstTxTimestamp) / (1000 * 3600 * 24)) + 14); 
      }

      let recommendation = "You're a Base power user! Keep up the great onchain activity.";
      if (daysSinceActive > 7) recommendation = `⚠️ You've been inactive for ${daysSinceActive} days! Send a GM below to keep your streak alive.`;
      else if (swapCount === 0) recommendation = "💡 You haven't swapped any tokens yet! Try exploring DEXs on Base.";
      else if (totalTxCount < 10) recommendation = "👋 Welcome to Base! Try minting an NFT or boosting your score below.";

      const dailyStats: DayStats[] = [];
      const pointerDate = new Date(); 
      for(let i=0; i<historyDays; i++) {
          const dateStr = pointerDate.toISOString().split('T')[0];
          const count = txsPerDay.get(dateStr) || 0;
          let intensity = 0;
          if (count > 0) intensity = 1; if (count > 2) intensity = 2; if (count > 5) intensity = 3; if (count > 10) intensity = 4;
          dailyStats.unshift({ date: dateStr, count, intensity }); 
          pointerDate.setUTCDate(pointerDate.getUTCDate() - 1);
      }

      const totalColumns = Math.ceil(historyDays / 7);
      const weekLabels: string[] = [];
      let lastMonthLabel = "";
      const gridStartDate = new Date();
      gridStartDate.setUTCDate(gridStartDate.getUTCDate() - historyDays + 1);
      for (let col = 0; col < totalColumns; col++) {
          const weekStartDate = new Date(gridStartDate);
          weekStartDate.setUTCDate(weekStartDate.getUTCDate() + (col * 7));
          const monthIndex = weekStartDate.getUTCMonth();
          if (MONTHS_3_LETTERS[monthIndex] !== lastMonthLabel) { weekLabels.push(MONTHS_3_LETTERS[monthIndex]); lastMonthLabel = MONTHS_3_LETTERS[monthIndex]; } else weekLabels.push(""); 
      }

      const finalScore = Math.floor(
          Math.min(25, totalTxCount/20) + 
          Math.min(20, uniqueDays.size/5) + 
          Math.min(15, uniqueMonths.size*1.25) + 
          Math.min(15, currentStreak*1.1) + 
          Math.min(10, ethVolume*2) + 
          Math.min(10, uniqueTokens.size/2) + 
          (basename ? 5 : 0)
      );

      let walletRank = "Base Shrimp 🦐";
      if (finalScore >= 30) walletRank = "Base Dolphin 🐬";
      if (finalScore >= 60) walletRank = "Base Shark 🦈";
      if (finalScore >= 85) walletRank = "Base Whale 🐳";

      const badges: Badge[] = [];
      
      // --- TIME & ACTIVITY BADGES ---
      if (firstTxTimestamp < new Date('2023-10-01').getTime()) badges.push({ icon: '🔵', name: 'Early Adopter', desc: 'Active since 2023' });
      if (uniqueDays.size >= 100) badges.push({ icon: '💎', name: 'Diamond Hands', desc: '100+ Active Days' });
      if (uniqueDays.size >= 365) badges.push({ icon: '📅', name: 'One Year Club', desc: '365+ Active Days' });
      if (longestStreak >= 7) badges.push({ icon: '🔥', name: 'Streak Master', desc: '7+ Day Streak' });
      if (longestStreak >= 30) badges.push({ icon: '🌋', name: 'Unstoppable', desc: '30+ Day Streak' });
      
      // --- VOLUME & TRANSACTIONS ---
      if (ethVolume >= 1) badges.push({ icon: '🐬', name: 'Dolphin', desc: '1+ ETH Volume' });
      if (ethVolume >= 5) badges.push({ icon: '🐋', name: 'Whale Alert', desc: '5+ ETH Volume' });
      if (totalTxCount >= 500) badges.push({ icon: '⚡', name: 'Power User', desc: '500+ Total Txs' });
      if (totalTxCount >= 1000) badges.push({ icon: '🚀', name: '1K Club', desc: '1,000+ Total Txs' });
      if (contractInteractions >= 50) badges.push({ icon: '🏗️', name: 'Base Builder', desc: '50+ Contract Txs' });

      // --- DEFI & ASSETS ---
      if (swapCount >= 50) badges.push({ icon: '🔄', name: 'DeFi Degen', desc: '50+ Swaps' });
      if (uniqueTokens.size >= 10) badges.push({ icon: '🌈', name: 'Token Explorer', desc: '10+ Unique Tokens' });
      if (nftCount >= 20) badges.push({ icon: '🖼️', name: 'Collector', desc: '20+ NFTs' });
      if (nftCount >= 100) badges.push({ icon: '🎨', name: 'NFT Maxi', desc: '100+ NFTs' });

      // --- IDENTITY & APP ENGAGEMENT ---
      if (basename) badges.push({ icon: '🏷️', name: 'Named', desc: 'Owns a verified Basename' });
      if (historicalBoosts >= 5) badges.push({ icon: '🔋', name: 'Booster', desc: 'Used the XP Booster 5+ times' });
      if (finalScore >= 85) badges.push({ icon: '👑', name: 'Base God', desc: '85+ Overall Onchain Score' });

      setWallet({
        address, basename, balance: parseFloat(formatEther(balWei)).toFixed(4), ethVolume: ethVolume.toFixed(2),
        txCount: totalTxCount, uniqueDays: uniqueDays.size, activeWeeks: uniqueWeeks.size, activeMonths: uniqueMonths.size,
        currentStreak, longestStreak, firstTx: firstTxStr, lastTx: lastTxStr, daysSinceActive,
        tokensSwapped: uniqueTokens.size, swapCount, contractInteractions, nftCount, walletRank,
        score: Math.min(100, finalScore), dailyStats, historyDays, weekLabels, topTokens, recommendation, badges, recentTxs, daysOnBase
      });
    } catch (e: unknown) { console.error("Analysis failed", e); alert("❌ Error: " + (e instanceof Error ? e.message : String(e))); } finally { setLoading(false); }
  };

  const handleConnect = async (type: ConnectionType) => {
    try {
      const { address } = await connectWallet(type);
      setConnectionType(type);
      analyzeWallet(address);
    } catch (e) { alert((e as Error).message); }
  };

  const handleDisconnect = () => { setWallet(null); setConnectionType(null); };

  // --- NATIVE FARCASTER TRANSACTION HANDLER ---
  const handleNativeTx = async (type: 'boost' | 'gm' | 'gn') => {
    if (!wallet || !wallet.address) return;

    try {
      let toAddress: `0x${string}` = '0x';
      let txData: `0x${string}` = '0x';
      let successMsg = '';
      const txValue = BigInt(4000000000000);

      if (type === 'boost') {
        toAddress = BOOSTER_CONTRACT_ADDRESS as `0x${string}`;
        txData = boostDataWithTracking as `0x${string}`;
        successMsg = 'Boost Successful! 🎉';
      } else if (type === 'gm') {
        toAddress = GM_GN_CONTRACT_ADDRESS as `0x${string}`;
        txData = gmDataWithTracking as `0x${string}`;
        successMsg = 'GM Registered on Base! ☀️';
      } else {
        toAddress = GM_GN_CONTRACT_ADDRESS as `0x${string}`;
        txData = gnDataWithTracking as `0x${string}`;
        successMsg = 'GN Registered on Base! 🌙';
      }

      const hash = await sdk.wallet.ethProvider.request({
        method: "eth_sendTransaction",
        params: [{
          from: wallet.address as `0x${string}`, 
          to: toAddress,
          data: txData,
          value: `0x${txValue.toString(16)}` as `0x${string}`
        }]
      });
      
      if (hash && typeof hash === 'string') {
        showToast(successMsg, hash);
        setSponsoredTxs(s => s + 1);
        if (type === 'boost') {
            setUserBoosts(b => b + 1);
            setTxKeys(prev => ({ ...prev, boost: prev.boost + 1 })); 
        }
      }
    } catch (err: unknown) {
      console.error("Native TX Error:", err);
      const errorMessage = err instanceof Error 
        ? err.message 
        : 'The contract rejected the simulation. Did you already do this today?';
        
      alert(`Transaction Failed: ${errorMessage}`);
    }
  };

  const shareNative = async () => {
    if (!wallet) return;
    const shareText = `I'm a ${wallet.walletRank} on Base! 🚀\n\nOnchain Score: ${wallet.score}/100 🔵\nBuilt by @suryaprakash.farcaster.eth 🎩\n\nCheck your score 👇`;
    if (navigator.share) { try { await navigator.share({ title: 'My Base Analytics', text: shareText, url: MINIAPP_URL }); } catch {} } 
    else { alert("Link copied to clipboard!"); navigator.clipboard.writeText(`${shareText}\n${MINIAPP_URL}`); }
  };

  const shareWarpcast = () => {
    if (!wallet) return;
    const shareText = `I'm a ${wallet.walletRank} on Base! 🚀\n\nOnchain Score: ${wallet.score}/100 🔵\nBuilt by @suryaprakash.farcaster.eth 🎩\n\nCheck your score 👇`;
    window.open(`https://warpcast.com/~/compose?text=${encodeURIComponent(shareText)}&embeds[]=${encodeURIComponent(MINIAPP_URL)}`, '_blank');
  };

  const shareTwitter = () => {
    if (!wallet) return;
    const shareText = `I'm a ${wallet.walletRank} on @base! 🚀\n\nOnchain Score: ${wallet.score}/100 🔵\nBuilt by @TamilCrypt0 ⚡\n\nCheck your score 👇\n${MINIAPP_URL}`;
    window.open(`https://twitter.com/intent/tweet?text=${encodeURIComponent(shareText)}`, '_blank');
  };

  if (!isReady) return <div className="min-h-screen bg-slate-300 flex items-center justify-center text-[#0052FF] font-mono text-xs animate-pulse">INITIALIZING BASE...</div>;

  if (!wallet) return (
    <div className="min-h-screen bg-slate-300 flex flex-col items-center justify-center p-6 text-center relative overflow-hidden w-full max-w-[100vw]">
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_top,#e2e8f0_0%,#cbd5e1_100%)]"></div>
      
      <div className="w-24 h-24 bg-[#0052FF] rounded-full mb-8 flex items-center justify-center shadow-[0_20px_50px_-10px_rgba(0,82,255,0.4)] z-10 animate-pulse">
          <Activity className="text-white" size={48} />
      </div>
      
      <h1 className="text-4xl md:text-6xl font-black text-[#0052FF] mb-2 tracking-tighter z-10 text-center drop-shadow-sm">BASE ANALYTICS</h1>
      <p className="text-slate-600 font-medium z-10 max-w-sm mx-auto mb-8">Discover your true Onchain identity and farm XP entirely gasless.</p>
      
      <button onClick={() => setShowConnectModal(true)} disabled={loading} className="w-full max-w-xs bg-[#0052FF] text-white py-4 rounded-full font-black text-lg flex items-center justify-center gap-3 hover:bg-[#0040C5] transition active:scale-95 z-10 shadow-[0_10px_25px_-5px_rgba(0,82,255,0.4)]">
        {loading ? <RefreshCcw className="animate-spin"/> : <Wallet size={22} />} {loading ? "Scanning..." : "Connect Wallet"}
      </button>
      
      {showConnectModal && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-sm">
              <div className="bg-slate-200 border border-slate-300 rounded-3xl w-full max-w-sm p-6 relative shadow-2xl">
                  <button onClick={() => setShowConnectModal(false)} className="absolute top-4 right-4 text-slate-500 hover:text-[#0052FF]"><X size={20}/></button>
                  <h3 className="text-xl font-black text-[#0052FF] mb-6 text-center">Connect Wallet</h3>
                  <div className="flex flex-col gap-3">
                      <button onClick={() => handleConnect('coinbase')} className="flex items-center justify-between bg-[#0052FF] text-white p-4 rounded-xl font-bold hover:bg-[#0040C5] transition shadow-sm">Coinbase <ChevronRight size={18}/></button>
                      <button onClick={() => handleConnect('metamask')} className="flex items-center justify-between bg-[#F6851B] text-white p-4 rounded-xl font-bold hover:bg-[#e2761b] transition shadow-sm">MetaMask <ChevronRight size={18}/></button>
                      <button onClick={() => handleConnect('farcaster')} className="flex items-center justify-between bg-[#8A2BE2] text-white p-4 rounded-xl font-bold hover:bg-[#7324BC] transition shadow-sm">Farcaster <ChevronRight size={18}/></button>
                  </div>
              </div>
          </div>
      )}
    </div>
  );

  return (
    <main className="min-h-screen bg-slate-300 p-4 lg:p-8 font-sans text-slate-800 pb-12 relative isolate">
      <div className="absolute inset-x-0 -top-40 -z-10 transform-gpu overflow-hidden blur-3xl sm:-top-80 pointer-events-none" aria-hidden="true">
          <div className="relative left-[calc(50%-11rem)] aspect-1155/678 w-144.5 -translate-x-1/2 rotate-30 bg-linear-to-tr from-[#0052FF] to-[#94A3B8] opacity-10 sm:left-[calc(50%-30rem)] sm:w-288.75"></div>
      </div>
      
      {toast && (
        <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-50 bg-[#0052FF] text-white px-6 py-4 rounded-2xl shadow-[0_15px_35px_-10px_rgba(0,82,255,0.5)] flex items-center gap-6 animate-in slide-in-from-bottom-5">
            <div>
                <p className="font-bold text-lg flex items-center gap-2"><BadgeCheck size={20}/> {toast.message}</p>
                {toast.hash && (
                  <a href={`https://basescan.org/tx/${toast.hash}`} target="_blank" rel="noreferrer" className="text-blue-100 text-xs hover:text-white underline mt-1 block">
                    View on BaseScan ↗
                  </a>
                )}
            </div>
            <button onClick={() => setToast(null)} className="bg-black/10 p-2 rounded-full hover:bg-black/20 transition"><X size={16}/></button>
        </div>
      )}

      <div className="flex justify-between items-center mb-8">
        <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-[#0052FF] rounded-full flex items-center justify-center shadow-md shadow-[#0052FF]/30"><Activity className="text-white" size={20}/></div>
            <span className="font-black text-xl tracking-tight text-[#0052FF] uppercase drop-shadow-sm">Base Analytics</span>
        </div>
        <button onClick={handleDisconnect} className="p-3 bg-slate-200 rounded-full border border-slate-400 text-[#0052FF] hover:bg-slate-300 transition shadow-sm"><Power size={18}/></button>
      </div>

      <div className={`rounded-2xl p-4 mb-8 flex items-center gap-3 border shadow-sm ${wallet.daysSinceActive > 7 ? 'bg-slate-200 border-slate-400 text-[#0052FF]' : 'bg-slate-200 border-slate-400 text-[#0052FF]'}`}>
          {wallet.daysSinceActive > 7 ? <AlertTriangle size={20} className="text-[#0052FF] shrink-0" /> : <Activity size={20} className="text-[#0052FF] shrink-0" />}
          <p className="text-sm font-bold">{wallet.recommendation}</p>
      </div>

      {sponsoredTxs > 0 && (
         <div className="bg-slate-200 border border-slate-400 text-[#0052FF] rounded-2xl p-4 mb-8 flex items-center justify-between shadow-sm">
            <div className="flex items-center gap-3">
              <Droplets size={20} className="text-[#0052FF]" />
              <div>
                 <p className="text-sm font-bold text-slate-800">Gas Sponsored by App</p>
                 <p className="text-xs text-slate-600">You saved roughly ${(sponsoredTxs * 0.05).toFixed(2)} in gas fees!</p>
              </div>
            </div>
            <div className="text-2xl font-black text-[#0052FF]">{sponsoredTxs} Txs</div>
         </div>
      )}

      <div className="bg-slate-200 rounded-[20px] p-6 sm:p-8 border border-slate-300 mb-8 shadow-md shadow-slate-400/50">
          <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-8">
              <div>
                  <div className="flex items-center gap-4 mb-4">
                      <div className="p-3 bg-[#0052FF]/10 rounded-xl border border-[#0052FF]/20"><Rocket size={24} className="text-[#0052FF]"/></div>
                      <div>
                          <h3 className="font-black text-2xl text-[#0052FF] leading-none uppercase drop-shadow-sm">XP Booster</h3>
                      </div>
                  </div>
                  <div className="bg-slate-300 px-4 py-2 rounded-lg border border-slate-400 inline-block shadow-inner">
                      <span className="text-slate-600 text-[10px] font-bold uppercase block">Your Boosts</span>
                      <span className="text-2xl font-black text-[#0052FF] drop-shadow-sm">{userBoosts}</span>
                  </div>
              </div>
              
              <div className="w-full md:w-64 relative z-20">
                  {connectionType === 'farcaster' ? (
                      <button 
                          onClick={() => handleNativeTx('boost')}
                          className="w-full min-h-14 flex items-center justify-center bg-[#0052FF] text-white font-black py-4 rounded-xl hover:bg-[#0040C5] transition shadow-md shadow-[#0052FF]/30"
                      >
                          BOOST SCORE (+1)
                      </button>
                  ) : (
                      <Transaction 
                        key={`boost-${txKeys.boost}`}
                        chainId={base.id} 
                        calls={boostCall} 
                        capabilities={paymasterCapability}
                        onStatus={(s) => { 
                          if (s.statusName === 'success') {
                            setUserBoosts(b => b + 1); 
                            setSponsoredTxs(st => st + 1); 
                            const txHash = s.statusData.transactionReceipts?.[0]?.transactionHash || '';
                            showToast('Boost Successful! 🎉', txHash);
                            setTxKeys(prev => ({ ...prev, boost: prev.boost + 1 })); 
                          }
                        }}
                      >
                        <TransactionButton className="w-full min-h-14 flex items-center justify-center bg-[#0052FF] text-white font-black py-4 rounded-xl hover:bg-[#0040C5] transition shadow-md shadow-[#0052FF]/30" text="BOOST SCORE (+1)" />
                      </Transaction>
                  )}
              </div>
          </div>
      </div>

      <div className="bg-slate-200 rounded-[20px] p-6 sm:p-8 border border-slate-300 mb-8 shadow-md shadow-slate-400/50">
            <div className="flex flex-col md:flex-row justify-between items-start mb-8 w-full">
                <div className="w-full md:w-auto">
                    <div className="flex items-center gap-3 mb-2">
                        <p className="text-xs font-bold text-[#0052FF] uppercase tracking-widest">ONCHAIN SCORE</p>
                        <div className="flex gap-2">
                            <button onClick={shareWarpcast} className="bg-slate-300 text-slate-700 px-3 py-1 rounded-full text-[10px] font-bold flex items-center gap-1.5 border border-slate-400 hover:bg-slate-400/50 transition"><Send size={10} className="text-[#0052FF]"/> Warpcast</button>
                            <button onClick={shareTwitter} className="bg-slate-300 text-slate-700 px-3 py-1 rounded-full text-[10px] font-bold flex items-center gap-1.5 border border-slate-400 hover:bg-slate-400/50 transition"><Twitter size={10} className="text-[#0052FF]"/> Post on X</button>
                            <button onClick={shareNative} className="bg-slate-300 text-slate-700 px-3 py-1 rounded-full text-[10px] font-bold flex items-center gap-1.5 border border-slate-400 hover:bg-slate-400/50 transition"><Share2 size={10} className="text-[#0052FF]"/> Share</button>
                        </div>
                    </div>
                    <h1 className="text-7xl font-black text-[#0052FF] tracking-tighter drop-shadow-sm">{wallet.score}<span className="text-3xl text-[#0052FF]/60">/100</span></h1>
                </div>
                <div className="w-full md:w-auto md:text-right mt-4 md:mt-0">
                  {selectedDay ? <div className="bg-slate-300 px-4 py-3 rounded-lg border border-slate-400 shadow-inner"><p className="text-xs text-slate-600 font-bold uppercase">{selectedDay.date}</p><p className="text-xl font-black text-[#0052FF]">{selectedDay.count} Txs</p></div> : <div className="flex items-center opacity-70 gap-2 justify-end"><MousePointerClick size={16} className="text-[#0052FF]"/><p className="text-[10px] text-slate-600 uppercase font-bold">Click a dot for details</p></div>}
                </div>
            </div>
            <div ref={scrollRef} className="w-full overflow-x-auto pb-4 custom-scrollbar">
                <div className="grid grid-flow-col gap-1.5 mb-2 relative min-w-max auto-cols-[12px]">
                  {wallet.weekLabels.map((m, i) => (<div key={i} className="text-[9px] font-bold text-slate-500 uppercase text-left w-3 whitespace-nowrap overflow-visible">{m}</div>))}
                </div>
                <div className="grid grid-rows-7 grid-flow-col gap-1.5 h-36 min-w-max">
                    {wallet.dailyStats.map((stat, i) => (
                        <div key={i} onClick={() => setSelectedDay(stat)} className={`w-3 h-3 rounded-xs cursor-pointer hover:scale-125 transition-all ${stat.count === 0 ? 'bg-slate-300/80' : 'bg-[#0052FF] shadow-[0_0_12px_rgba(0,82,255,0.4)]'} opacity-${stat.intensity * 25 || 20}`}></div>
                    ))}
                </div>
            </div>
      </div>

      <h3 className="text-sm font-bold text-[#0052FF] mb-4 ml-2 flex items-center gap-2 uppercase tracking-widest"><BarChart3 size={16} className="text-[#0052FF]"/> Wallet Status</h3>
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4 mb-8">
          
          <div className="bg-slate-200 p-5 rounded-2xl border border-slate-300 flex flex-col justify-between col-span-2 relative overflow-hidden group hover:border-[#0052FF]/40 transition-all shadow-md shadow-slate-400/50">
              <div className="absolute top-0 right-0 w-32 h-32 bg-[#0052FF] rounded-full blur-[80px] opacity-10 pointer-events-none"></div>
              <div className="flex justify-between items-start mb-2 relative z-10">
                  <div className="p-2 bg-slate-300 rounded-lg text-[#0052FF] border border-slate-400 shadow-sm"><User size={20}/></div>
                  {wallet.basename && <div className="px-2 py-1 bg-[#0052FF]/10 text-[#0052FF] text-[10px] font-bold rounded border border-[#0052FF]/20 flex items-center gap-1"><BadgeCheck size={10} className="text-[#0052FF]"/> VERIFIED</div>}
              </div>
              <div className="relative z-10">
                  <p className="text-2xl font-black text-[#0052FF] tracking-tight truncate drop-shadow-sm">{wallet.basename ? wallet.basename : `${wallet.address.slice(0,6)}...${wallet.address.slice(-4)}`}</p>
                  <p className="text-[10px] font-bold text-slate-600 uppercase tracking-widest mt-1">{wallet.walletRank}</p>
              </div>
          </div>

          <div className="bg-slate-200 p-5 rounded-2xl border border-slate-300 flex flex-col justify-between col-span-2 lg:col-span-2 relative overflow-hidden shadow-md shadow-slate-400/50">
              <div className="flex items-center gap-2 mb-3"><Medal size={18} className="text-[#0052FF]"/><p className="text-[10px] text-slate-600 uppercase tracking-widest font-bold">Achievements Unlocked</p></div>
              <div className="flex flex-wrap gap-2">
                 {wallet.badges.length > 0 ? wallet.badges.map((badge, i) => (
                    <div key={i} className="flex items-center gap-1.5 px-3 py-1 bg-slate-300 border border-slate-400 rounded-lg shadow-sm" title={badge.desc}>
                       <span className="text-sm">{badge.icon}</span>
                       <span className="text-xs font-bold text-[#0052FF]">{badge.name}</span>
                    </div>
                 )) : <span className="text-sm text-slate-500">No badges unlocked yet. Keep building!</span>}
              </div>
          </div>

          <StatCard label="Wallet Balance" value={`${wallet.balance} ETH`} icon={<CreditCard size={18}/>} />
          <StatCard label="Days on Base" value={wallet.daysOnBase.toLocaleString()} icon={<Clock size={18}/>} />
          <StatCard label="Current Streak" value={`${wallet.currentStreak} Days`} icon={<Zap size={18}/>} />
          <StatCard label="Longest Streak" value={`${wallet.longestStreak} Days`} icon={<Trophy size={18}/>} />
          <StatCard label="First Active Date" value={wallet.firstTx} icon={<Calendar size={18}/>} />
          <StatCard label="Total Active Days" value={wallet.uniqueDays.toString()} icon={<Sun size={18}/>} />
          <StatCard label="Days Inactive" value={wallet.daysSinceActive.toString()} icon={<Moon size={18}/>} />
          <StatCard label="Total Txs" value={wallet.txCount.toLocaleString()} icon={<Layers size={18}/>} />
          <StatCard label="ETH Volume" value={`${wallet.ethVolume} Ξ`} icon={<ArrowRightLeft size={18}/>} />
          <StatCard label="NFTs Transferred" value={wallet.nftCount.toLocaleString()} icon={<Sparkles size={18}/>} />
          <StatCard label="Token Transfers" value={wallet.swapCount.toLocaleString()} icon={<RefreshCcw size={18}/>} />
          <StatCard label="Contract Txs" value={wallet.contractInteractions.toLocaleString()} icon={<FileCode size={18}/>} />
      </div>

      <h3 className="text-sm font-bold text-[#0052FF] mb-4 ml-2 flex items-center gap-2 uppercase tracking-widest"><History size={16} className="text-[#0052FF]"/> Recent Activity</h3>
      <div className="bg-slate-200 rounded-3xl p-6 border border-slate-300 mb-8 shadow-md shadow-slate-400/50">
          <div className="flex flex-col gap-3">
              {wallet.recentTxs.length > 0 ? wallet.recentTxs.map((tx, i) => (
                  <div key={i} className="flex justify-between items-center bg-slate-300/80 p-3 rounded-xl border border-slate-400 hover:border-[#0052FF]/30 transition shadow-sm">
                      <div className="flex items-center gap-3">
                          <div className="p-2 rounded-lg bg-[#0052FF]/10 text-[#0052FF] shadow-inner">
                              {tx.category === 'erc721' ? <Sparkles size={16}/> : <ArrowRightLeft size={16}/>}
                          </div>
                          <div>
                              <p className="text-sm font-black text-[#0052FF] uppercase leading-none mb-1">{tx.category === 'external' ? 'Contract Interaction' : `${tx.category} Transfer`}</p>
                              <p className="text-[10px] font-bold text-slate-600 uppercase">{new Date(tx.metadata.blockTimestamp).toLocaleString()}</p>
                          </div>
                      </div>
                      <a href={`https://basescan.org/tx/${tx.hash}`} target="_blank" rel="noreferrer" className="text-[10px] font-black text-[#0052FF] hover:underline bg-[#0052FF]/10 px-3 py-2 rounded-lg border border-[#0052FF]/20 uppercase">
                          {tx.value ? `${tx.value.toFixed(3)} ${tx.asset}` : 'View TX'} ↗
                      </a>
                  </div>
              )) : (
                  <p className="text-slate-500 text-sm italic">No recent transactions found.</p>
              )}
          </div>
      </div>

      <div className="bg-slate-200 rounded-3xl p-6 border border-slate-300 shadow-md shadow-slate-400/50">
           <h3 className="font-bold text-lg text-[#0052FF] mb-4 flex items-center gap-2 uppercase tracking-tight">Community Vibes</h3>
           <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 relative z-20 w-full">
              <div>
                {connectionType === 'farcaster' ? (
                    <button 
                        onClick={() => handleNativeTx('gm')}
                        className="w-full min-h-14 flex items-center justify-center bg-[#0052FF]/10 border border-[#0052FF]/20 text-[#0052FF] hover:bg-[#0052FF] hover:text-white transition rounded-xl font-black text-xl shadow-sm"
                    >
                        GM
                    </button>
                ) : (
                    <Transaction 
                      key={`gm-${txKeys.gm}`}
                      chainId={base.id} 
                      calls={gmCall} 
                      capabilities={paymasterCapability}
                      onStatus={(s) => {
                        if (s.statusName === 'success') {
                          showToast('GM Registered on Base! ☀️', s.statusData.transactionReceipts?.[0]?.transactionHash || '');
                          setSponsoredTxs(st => st + 1);
                          setTxKeys(prev => ({ ...prev, gm: prev.gm + 1 }));
                        }
                      }}
                    >
                       <TransactionButton className="min-h-14 flex items-center justify-center bg-[#0052FF]/10 border border-[#0052FF]/20 text-[#0052FF] hover:bg-[#0052FF] hover:text-white transition rounded-xl font-black text-xl w-full shadow-sm" text="GM" />
                    </Transaction>
                )}
              </div>

              <div>
                {connectionType === 'farcaster' ? (
                    <button 
                        onClick={() => handleNativeTx('gn')}
                        className="w-full min-h-14 flex items-center justify-center bg-[#0052FF]/10 border border-[#0052FF]/20 text-[#0052FF] hover:bg-[#0052FF] hover:text-white transition rounded-xl font-black text-xl shadow-sm"
                    >
                        GN
                    </button>
                ) : (
                    <Transaction 
                      key={`gn-${txKeys.gn}`}
                      chainId={base.id} 
                      calls={gnCall} 
                      capabilities={paymasterCapability}
                      onStatus={(s) => {
                        if (s.statusName === 'success') {
                          showToast('GN Registered on Base! 🌙', s.statusData.transactionReceipts?.[0]?.transactionHash || '');
                          setSponsoredTxs(st => st + 1);
                          setTxKeys(prev => ({ ...prev, gn: prev.gn + 1 }));
                        }
                      }}
                    >
                       <TransactionButton className="min-h-14 flex items-center justify-center bg-[#0052FF]/10 border border-[#0052FF]/20 text-[#0052FF] hover:bg-[#0052FF] hover:text-white transition rounded-xl font-black text-xl w-full shadow-sm" text="GN" />
                    </Transaction>
                )}
              </div>
           </div>
      </div>
    </main>
  );
}

function StatCard({ label, value, icon }: { label: string, value: string, icon: React.ReactNode }) {
    return (
        <div className="bg-slate-200 p-5 rounded-2xl border border-slate-300 group hover:border-[#0052FF]/40 transition-all shadow-md shadow-slate-400/50">
            <div className="mb-3 text-[#0052FF]">{icon}</div>
            <p className="text-xl font-black text-[#0052FF] truncate drop-shadow-sm" title={value}>{value}</p>
            <p className="text-[9px] text-slate-600 uppercase tracking-widest font-bold mt-1">{label}</p>
        </div>
    );
} 