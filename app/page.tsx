"use client";

import React, { useState, useEffect, useRef } from 'react';
import { 
  Wallet, Activity, Layers, ArrowRightLeft, Power, 
  RefreshCcw, Sun, CreditCard, Send, X, 
  ChevronRight, Share2, Rocket, Twitter, MousePointerClick 
} from 'lucide-react';
import { JsonRpcProvider, formatEther, toUtf8Bytes } from 'ethers';
import { sdk } from "@farcaster/miniapp-sdk";
import { connectWallet } from './connection';

// ✅ OnchainKit & Viem Imports
import { 
  Transaction, 
  TransactionButton, 
  TransactionSponsor, 
  TransactionStatus, 
  TransactionStatusLabel 
} from '@coinbase/onchainkit/transaction'; 
import { base } from 'viem/chains';
import { encodeFunctionData } from 'viem';

// --- CONFIGURATION ---
const ALCHEMY_KEY = process.env.NEXT_PUBLIC_ALCHEMY_KEY || "ZHHTYOLANc6hp1RX7bQp1"; 
const BASE_RPC = `https://base-mainnet.g.alchemy.com/v2/${ALCHEMY_KEY}`;
const BASESCAN_KEY = "UDFW8PRDXWMNZUWGNIU6R5C4991KU5UB68";
const MINIAPP_URL = "https://farcaster.xyz/miniapps/lYFXQz4s1wsq/base-analytics";

// ✅ RESTORED: Your specific Builder Code
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
interface WalletData {
  address: string; basename: string | null; balance: string; ethVolume: string;
  txCount: number; uniqueDays: number; activeWeeks: number; activeMonths: number;
  currentStreak: number; longestStreak: number; firstTx: string; lastTx: string;
  daysSinceActive: number; tokensSwapped: number; swapCount: number;     
  contractInteractions: number; internalTxCount: number;      
  score: number; historyDays: number; weekLabels: string[]; dailyStats: DayStats[]; 
}
interface AlchemyTransfer { category: string; value: number | null; asset: string | null; metadata: { blockTimestamp: string; }; }
interface AlchemyResponse { result?: { transfers: AlchemyTransfer[]; pageKey?: string; }; error?: { message: string; }; }
interface BaseScanTx { timeStamp: string; value: string; isError: string; type: string; }
type ConnectionType = 'farcaster' | 'coinbase' | 'metamask';

export default function Page() {
  const [wallet, setWallet] = useState<WalletData | null>(null);
  const [, setConnectionType] = useState<ConnectionType | null>(null);
  const [loading, setLoading] = useState(false);
  const [isReady, setIsReady] = useState(false);
  const [showConnectModal, setShowConnectModal] = useState(false);
  const [selectedDay, setSelectedDay] = useState<DayStats | null>(null);
  const scrollRef = useRef<HTMLDivElement>(null);
  const [userBoosts, setUserBoosts] = useState(0);

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

  // --- ANALYTICS LOGIC ---
  const getStrictUTCDate = (isoTimestamp: string) => isoTimestamp.split('T')[0];
  const getISOWeekToken = (date: Date) => {
    const d = new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()));
    const dayNum = d.getUTCDay() || 7;
    d.setUTCDate(d.getUTCDate() + 4 - dayNum);
    const year = d.getUTCFullYear();
    const weekNo = Math.ceil((((d.getTime() - new Date(Date.UTC(year, 0, 1)).getTime()) / 86400000) + 1) / 7);
    return `${year}-W${weekNo}`;
  };

  const fetchInternalTxs = async (address: string): Promise<BaseScanTx[]> => {
    try {
        const url = `https://api.basescan.org/api?module=account&action=txlistinternal&address=${address}&startblock=0&endblock=99999999&sort=asc&apikey=${BASESCAN_KEY}`;
        const res = await fetch(url);
        const data = await res.json();
        if (data.status === "1" && Array.isArray(data.result)) return data.result;
    } catch (e) { console.error("BaseScan fetch failed:", e); }
    return [];
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
          const params: Record<string, unknown> = { fromBlock: "0x0", toBlock: "latest", fromAddress: address, category: ["external", "erc20", "erc721", "erc1155"], maxCount: "0x3e8", withMetadata: true };
          if (pageKey) params.pageKey = pageKey;
          const response = await fetch(BASE_RPC, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ jsonrpc: "2.0", id: 1, method: "alchemy_getAssetTransfers", params: [params] }) });
          const data = (await response.json()) as AlchemyResponse;
          if (data.error) throw new Error(data.error.message);
          const newTransfers = data.result?.transfers || [];
          allTransfers = [...allTransfers, ...newTransfers];
          pageKey = data.result?.pageKey;
          if (!pageKey || loopCount > 200) break;
      }

      const internalTxs = await fetchInternalTxs(address);
      
      const uniqueDays = new Set<string>(), uniqueWeeks = new Set<string>(), uniqueMonths = new Set<string>(), uniqueTokens = new Set<string>();
      let ethVolume = 0.0, swapCount = 0, contractInteractions = 0;
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
        if (['erc20', 'erc721', 'erc1155'].includes(tx.category)) { swapCount++; if (tx.asset) uniqueTokens.add(tx.asset); }
        if (tx.category === 'external') contractInteractions++;
      }

      for (const tx of internalTxs) {
          if (tx.isError === "0") {
             const ts = parseInt(tx.timeStamp) * 1000;
             const d = new Date(ts);
             const dayStr = getStrictUTCDate(d.toISOString());
             uniqueDays.add(dayStr);
             addTxToDay(dayStr);
             uniqueWeeks.add(getISOWeekToken(d));
             uniqueMonths.add(`${d.getUTCFullYear()}-${d.getUTCMonth()}`);
             contractInteractions++;
             const val = parseFloat(formatEther(tx.value));
             if (val > 0) ethVolume += val;
          }
      }

      const totalTxCount = allTransfers.length + internalTxs.length;

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
      if (internalTxs.length > 0) {
          const firstInt = parseInt(internalTxs[0].timeStamp) * 1000;
          const lastInt = parseInt(internalTxs[internalTxs.length-1].timeStamp) * 1000;
          firstTxTimestamp = Math.min(firstTxTimestamp, firstInt);
          lastTxTimestamp = Math.max(lastTxTimestamp, lastInt);
      }

      let historyDays = 364; let firstTxStr = "N/A", lastTxStr = "N/A", daysSinceActive = 0;
      if (totalTxCount > 0) {
        firstTxStr = new Date(firstTxTimestamp).toLocaleDateString();
        lastTxStr = new Date(lastTxTimestamp).toLocaleDateString();
        daysSinceActive = Math.floor((now.getTime() - lastTxTimestamp) / (1000 * 3600 * 24));
        historyDays = Math.max(364, Math.ceil(Math.abs(now.getTime() - firstTxTimestamp) / (1000 * 3600 * 24)) + 14); 
      }

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

      setWallet({
        address, basename, balance: parseFloat(formatEther(balWei)).toFixed(4), ethVolume: ethVolume.toFixed(2),
        txCount: totalTxCount, uniqueDays: uniqueDays.size, activeWeeks: uniqueWeeks.size, activeMonths: uniqueMonths.size,
        currentStreak, longestStreak, firstTx: firstTxStr, lastTx: lastTxStr, daysSinceActive,
        tokensSwapped: uniqueTokens.size, swapCount, contractInteractions, internalTxCount: internalTxs.length,
        score: Math.min(100, finalScore), dailyStats, historyDays, weekLabels
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

  // --- SHARING LOGIC ---
  const shareNative = async () => {
    if (!wallet) return;
    const shareText = `I have ${userBoosts} Boosts on Base! 🚀\n\n💰 Boost More = Earn More\n\nOnchain Score: ${wallet.score}/100 🔵\nBuilt by @suryaprakash.farcaster.eth 🎩\n\nCheck your score 👇`;
    if (navigator.share) { try { await navigator.share({ title: 'My Base Analytics', text: shareText, url: MINIAPP_URL }); } catch {} } 
    else { alert("Link copied to clipboard!"); navigator.clipboard.writeText(`${shareText}\n${MINIAPP_URL}`); }
  };

  const shareWarpcast = () => {
    if (!wallet) return;
    const shareText = `I have ${userBoosts} Boosts on Base! 🚀\n\n💰 Boost More = Earn More\n\nOnchain Score: ${wallet.score}/100 🔵\nBuilt by @suryaprakash.farcaster.eth 🎩\n\nCheck your score 👇`;
    window.open(`https://warpcast.com/~/compose?text=${encodeURIComponent(shareText)}&embeds[]=${encodeURIComponent(MINIAPP_URL)}`, '_blank');
  };

  const shareTwitter = () => {
    if (!wallet) return;
    const shareText = `I have ${userBoosts} Boosts on @base! 🚀\n\n💰 Boost More = Earn More\n\nOnchain Score: ${wallet.score}/100 🔵\nBuilt by @suryaprakash.farcaster.eth 🎩\n\nCheck your score 👇\n${MINIAPP_URL}`;
    window.open(`https://twitter.com/intent/tweet?text=${encodeURIComponent(shareText)}`, '_blank');
  };

  // --- ONCHAINKIT GASLESS DATA GENERATION ---
  const boostData = encodeFunctionData({ abi: BOOSTER_ABI, functionName: 'boost' });
  const boostDataWithTracking = `${boostData}${getBuilderSuffix()}` as `0x${string}`;
  
  const gmData = encodeFunctionData({ abi: GM_GN_ABI, functionName: 'gm' });
  const gmDataWithTracking = `${gmData}${getBuilderSuffix()}` as `0x${string}`;

  const gnData = encodeFunctionData({ abi: GM_GN_ABI, functionName: 'gn' });
  const gnDataWithTracking = `${gnData}${getBuilderSuffix()}` as `0x${string}`;

  const boostCall = [{ to: BOOSTER_CONTRACT_ADDRESS as `0x${string}`, data: boostDataWithTracking, value: BigInt(4000000000000) }];
  const gmCall = [{ to: GM_GN_CONTRACT_ADDRESS as `0x${string}`, data: gmDataWithTracking, value: BigInt(4000000000000) }];
  const gnCall = [{ to: GM_GN_CONTRACT_ADDRESS as `0x${string}`, data: gnDataWithTracking, value: BigInt(4000000000000) }];

  if (!isReady) return <div className="min-h-screen bg-[#020410] flex items-center justify-center text-blue-500 font-mono text-xs animate-pulse">INITIALIZING BASE...</div>;

  if (!wallet) return (
    <div className="min-h-screen bg-[#020410] flex flex-col items-center justify-center p-6 text-center text-white relative overflow-hidden w-full max-w-[100vw]">
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_center,#0033aa_0%,#000510_70%)] opacity-40"></div>
      <div className="w-24 h-24 bg-[#0052FF] rounded-full mb-8 flex items-center justify-center shadow-[0_0_80px_-10px_rgba(0,82,255,0.6)] z-10 animate-pulse"><Activity className="text-white" size={48} /></div>
      <h1 className="text-4xl md:text-6xl font-black text-white mb-2 tracking-tighter z-10 drop-shadow-2xl text-center">BASE ANALYTICS</h1>
      <button onClick={() => setShowConnectModal(true)} disabled={loading} className="w-full max-w-xs bg-[#0052FF] text-white py-4 rounded-full font-black text-lg flex items-center justify-center gap-3 hover:bg-blue-600 transition active:scale-95 z-10 mt-8">
        {loading ? <RefreshCcw className="animate-spin"/> : <Wallet size={22} />} {loading ? "Scanning..." : "Connect Wallet"}
      </button>
      {showConnectModal && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm">
              <div className="bg-[#0F172A] border border-blue-900/50 rounded-3xl w-full max-w-sm p-6 relative">
                  <button onClick={() => setShowConnectModal(false)} className="absolute top-4 right-4 text-slate-400"><X size={20}/></button>
                  <h3 className="text-xl font-black text-white mb-6 text-center">Connect Wallet</h3>
                  <div className="flex flex-col gap-3">
                      <button onClick={() => handleConnect('coinbase')} className="flex items-center justify-between bg-blue-600 text-white p-4 rounded-xl font-bold">Coinbase <ChevronRight size={18}/></button>
                      <button onClick={() => handleConnect('metamask')} className="flex items-center justify-between bg-orange-700/80 text-white p-4 rounded-xl font-bold">MetaMask <ChevronRight size={18}/></button>
                      <button onClick={() => handleConnect('farcaster')} className="flex items-center justify-between bg-[#472a91] text-white p-4 rounded-xl font-bold">Farcaster <ChevronRight size={18}/></button>
                  </div>
              </div>
          </div>
      )}
    </div>
  );

  return (
    <main className="min-h-screen bg-[#020410] p-4 lg:p-8 font-sans text-slate-200 pb-32 overflow-x-hidden">
      <div className="flex justify-between items-center mb-8">
        <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-[#0052FF] rounded-full flex items-center justify-center shadow-lg"><Activity className="text-white" size={20}/></div>
            <span className="font-black text-xl tracking-tight text-white uppercase">Base Analytics</span>
        </div>
        <button onClick={handleDisconnect} className="p-3 bg-blue-950/30 rounded-full border border-blue-900/30 text-blue-400"><Power size={18}/></button>
      </div>

      <div className="bg-[#0A1024]/80 backdrop-blur-xl rounded-[20px] p-6 sm:p-8 border border-blue-900/30 mb-8">
          <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-8">
              <div>
                  <div className="flex items-center gap-4 mb-4">
                      <div className="p-3 bg-[#0052FF]/20 rounded-xl border border-[#0052FF]/30"><Rocket size={24} className="text-[#0052FF]"/></div>
                      <div>
                          <h3 className="font-black text-2xl text-white leading-none">XP Booster</h3>
                          <p className="text-green-400 text-xs font-bold mt-1 uppercase animate-pulse">Gasless Enabled</p>
                      </div>
                  </div>
                  <div className="bg-[#020410]/50 px-4 py-2 rounded-lg border border-blue-900/50 inline-block">
                      <span className="text-blue-400 text-[10px] font-bold uppercase block">Your Boosts</span>
                      <span className="text-2xl font-black text-white">{userBoosts}</span>
                  </div>
              </div>
              <div className="w-full md:w-64">
                  <Transaction chainId={base.id} calls={boostCall} onStatus={(s) => { if(s.statusName === 'success') setUserBoosts(b => b + 1); }}>
                    <TransactionButton className="w-full bg-[#0052FF] text-white font-bold py-4 rounded-xl" text="BOOST SCORE (+1)" />
                    <TransactionSponsor />
                    <TransactionStatus><TransactionStatusLabel /></TransactionStatus>
                  </Transaction>
              </div>
          </div>
      </div>

      <div className="bg-[#0A1024]/90 rounded-[20px] p-6 sm:p-8 shadow-xl border border-blue-900/30 mb-8">
            <div className="flex flex-col md:flex-row justify-between items-start mb-8 w-full">
                <div className="w-full md:w-auto">
                    <div className="flex items-center gap-3 mb-2">
                        <p className="text-xs font-bold text-blue-500 uppercase tracking-widest">ONCHAIN SCORE</p>
                        <div className="flex gap-2">
                            <button onClick={shareWarpcast} className="bg-purple-500/10 text-purple-400 px-3 py-1 rounded-full text-[10px] font-bold flex items-center gap-1.5 border border-purple-500/20"><Send size={10}/> Warpcast</button>
                            <button onClick={shareTwitter} className="bg-blue-400/10 text-blue-400 px-3 py-1 rounded-full text-[10px] font-bold flex items-center gap-1.5 border border-blue-400/20"><Twitter size={10}/> Post on X</button>
                            <button onClick={shareNative} className="bg-blue-950/30 text-blue-300 px-3 py-1 rounded-full text-[10px] font-bold flex items-center gap-1.5 border border-blue-900/30"><Share2 size={10}/> Share</button>
                        </div>
                    </div>
                    <h1 className="text-7xl font-black text-white tracking-tighter">{wallet.score}<span className="text-3xl text-blue-900">/100</span></h1>
                </div>
                <div className="w-full md:w-auto md:text-right mt-4 md:mt-0">
                  {selectedDay ? <div className="bg-blue-900/30 px-4 py-3 rounded-lg border border-blue-500/30"><p className="text-xs text-blue-300 font-bold uppercase">{selectedDay.date}</p><p className="text-xl font-black text-white">{selectedDay.count} Txs</p></div> : <div className="flex items-center opacity-50 gap-2"><MousePointerClick size={16} className="text-blue-500"/><p className="text-[10px] text-blue-300 uppercase">Click a dot for details</p></div>}
                </div>
            </div>
            <div ref={scrollRef} className="w-full overflow-x-auto pb-4 custom-scrollbar">
                <div className="grid grid-flow-col gap-1.5 mb-2 relative min-w-max auto-cols-[12px]">
                  {wallet.weekLabels.map((m, i) => (<div key={i} className="text-[9px] font-bold text-white/90 uppercase text-left w-3 whitespace-nowrap overflow-visible">{m}</div>))}
                </div>
                <div className="grid grid-rows-7 grid-flow-col gap-1.5 h-36 min-w-max">
                    {wallet.dailyStats.map((stat, i) => (
                        <div key={i} onClick={() => setSelectedDay(stat)} className={`w-3 h-3 rounded-xs cursor-pointer hover:scale-125 transition-all ${stat.count === 0 ? 'bg-blue-950/30' : 'bg-[#0052FF]'} opacity-${stat.intensity * 25 || 10}`}></div>
                    ))}
                </div>
            </div>
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
          <StatCard label="Wallet Balance" value={`${wallet.balance} ETH`} icon={<CreditCard size={18}/>} />
          <StatCard label="Active Days" value={wallet.uniqueDays.toString()} icon={<Sun size={18}/>} highlight />
          <StatCard label="Total Txs" value={wallet.txCount.toLocaleString()} icon={<Layers size={18}/>} />
          <StatCard label="ETH Volume" value={`${wallet.ethVolume} Ξ`} icon={<ArrowRightLeft size={18}/>} />
      </div>

      <div className="bg-[#0A1024] rounded-3xl p-6 border border-blue-900/30">
           <h3 className="font-bold text-lg text-white mb-4 flex items-center gap-2">Community Vibes</h3>
           <div className="grid grid-cols-2 gap-4">
              <Transaction chainId={base.id} calls={gmCall}><TransactionButton className="py-4 bg-blue-950/30 text-white rounded-xl font-black text-xl w-full" text="GM" /><TransactionSponsor /></Transaction>
              <Transaction chainId={base.id} calls={gnCall}><TransactionButton className="py-4 bg-blue-950/30 text-white rounded-xl font-black text-xl w-full" text="GN" /><TransactionSponsor /></Transaction>
           </div>
      </div>
    </main>
  );
}

function StatCard({ label, value, icon, highlight }: { label: string, value: string, icon: React.ReactNode, highlight?: boolean }) {
    return (
        <div className="bg-[#0A1024] p-5 rounded-2xl border border-blue-900/20">
            <div className={`mb-3 ${highlight ? 'text-[#0052FF]' : 'text-white'}`}>{icon}</div>
            <p className="text-xl font-black text-white truncate">{value}</p>
            <p className="text-[9px] font-bold text-blue-200 uppercase tracking-widest">{label}</p>
        </div>
    );
} 