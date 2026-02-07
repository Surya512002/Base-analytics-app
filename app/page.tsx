"use client";

import React, { useState, useEffect } from 'react';
import { Wallet, Activity, Zap, Layers, Calendar, ArrowRightLeft, Power, RefreshCcw, Sun, Moon, CheckCircle2, Coins, FileCode, BarChart3, Trophy, Smartphone, Globe, CreditCard, User, BadgeCheck, Send, X, ChevronRight, Share2 } from 'lucide-react';
import { JsonRpcProvider, formatEther, parseEther, Contract } from 'ethers';
import { sdk } from "@farcaster/miniapp-sdk";
import { connectWallet, getWalletProvider } from './connection';

// --- CONFIGURATION ---
const ALCHEMY_KEY = process.env.NEXT_PUBLIC_ALCHEMY_KEY || "ZHHTYOLANc6hp1RX7bQp1"; 
const BASE_RPC = `https://base-mainnet.g.alchemy.com/v2/${ALCHEMY_KEY}`;
const MINIAPP_URL = "https://farcaster.xyz/miniapps/lYFXQz4s1wsq/base-analytics";

// ✅ YOUR REAL ADDRESSES (Keep these!)
const CHECKIN_CONTRACT_ADDRESS = "0x100a14B0c760b0d8e617e0D9230226566b6fACB0"; 
const GM_GN_CONTRACT_ADDRESS = "0xc801bCe6739D30C409151a544F0baEd10EB719dE"; 

const CHECKIN_ABI = [
  "function checkIn() external payable", 
  "function checkin() external payable", 
  "function getUserData(address _user) external view returns (uint256, uint256, uint256)", 
  "function checkInFee() external view returns (uint256)"
];
const GM_GN_ABI = ["function gm() external payable", "function gn() external payable", "function fee() external view returns (uint256)"];

const MONTHS_3_LETTERS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

// --- TYPES ---
interface WalletData {
  address: string;
  basename: string | null;
  balance: string;
  ethVolume: string;
  txCount: number;
  uniqueDays: number;
  activeWeeks: number;
  activeMonths: number;
  currentStreak: number;
  longestStreak: number;
  firstTx: string;
  lastTx: string;
  daysSinceActive: number;
  tokensSwapped: number; 
  swapCount: number;     
  contractInteractions: number;
  score: number;
  activityMap: boolean[]; 
  historyDays: number;
  weekLabels: string[]; 
}

interface AlchemyTransfer {
  category: string;
  value: number | null;
  asset: string | null;
  metadata: { blockTimestamp: string; };
}

interface AlchemyResponse {
  result?: { transfers: AlchemyTransfer[]; pageKey?: string; };
  error?: { message: string; };
}

type ConnectionType = 'farcaster' | 'coinbase' | 'metamask';

export default function Page() {
  const [wallet, setWallet] = useState<WalletData | null>(null);
  const [connectionType, setConnectionType] = useState<ConnectionType | null>(null);
  const [loading, setLoading] = useState(false);
  const [loadingMsg, setLoadingMsg] = useState("");
  const [isReady, setIsReady] = useState(false);
  const [showConnectModal, setShowConnectModal] = useState(false);

  // Contract State
  const [points, setPoints] = useState(0);
  const [streak, setStreak] = useState(0); 
  const [txLoading, setTxLoading] = useState(false);
  const [gmLoading, setGmLoading] = useState(false);

  useEffect(() => {
    if (typeof window !== 'undefined' && sdk?.actions?.ready) {
        try { sdk.actions.ready(); setIsReady(true); } catch (e) { console.error("SDK Init Error", e); }
    }
  }, []);

  const getStrictUTCDate = (isoTimestamp: string) => {
    const date = new Date(isoTimestamp); 
    return date.toISOString().split('T')[0];
  };

  const getISOWeekToken = (date: Date) => {
    const d = new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()));
    const dayNum = d.getUTCDay() || 7;
    d.setUTCDate(d.getUTCDate() + 4 - dayNum);
    const year = d.getUTCFullYear();
    const weekNo = Math.ceil((((d.getTime() - new Date(Date.UTC(year, 0, 1)).getTime()) / 86400000) + 1) / 7);
    return `${year}-W${weekNo}`;
  };

  const analyzeWallet = async (address: string) => {
    setLoading(true);
    setLoadingMsg("Scanning Base Network...");
    setShowConnectModal(false);
    try {
      const provider = new JsonRpcProvider(BASE_RPC);
      let basename = null;
      try { basename = await provider.lookupAddress(address); } catch {}
      const balWei = await provider.getBalance(address);

      try {
          const contract = new Contract(CHECKIN_CONTRACT_ADDRESS, CHECKIN_ABI, provider);
          const data = await contract.getUserData(address);
          setPoints(Number(data[0]));
          setStreak(Number(data[1]));
      } catch {}

      let allTransfers: AlchemyTransfer[] = [];
      let pageKey: string | undefined = undefined;
      let loopCount = 0;

      while (true) {
          loopCount++;
          setLoadingMsg(`Indexing Actions: ${allTransfers.length}...`);
          const params: Record<string, unknown> = {
            fromBlock: "0x0", toBlock: "latest", fromAddress: address,
            category: ["external", "erc20", "erc721", "erc1155"], maxCount: "0x3e8", withMetadata: true
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

      setLoadingMsg(`Calculating Score...`);
      const uniqueDays = new Set<string>(), uniqueWeeks = new Set<string>(), uniqueMonths = new Set<string>(), uniqueTokens = new Set<string>();
      let ethVolume = 0.0, swapCount = 0, contractInteractions = 0;
      const sortedTxs = allTransfers.sort((a, b) => new Date(a.metadata.blockTimestamp).getTime() - new Date(b.metadata.blockTimestamp).getTime());

      for (const tx of sortedTxs) {
        const d = new Date(tx.metadata.blockTimestamp);
        uniqueDays.add(getStrictUTCDate(tx.metadata.blockTimestamp));
        uniqueWeeks.add(getISOWeekToken(d));
        uniqueMonths.add(`${d.getUTCFullYear()}-${d.getUTCMonth()}`);
        if (tx.value && (tx.asset === 'ETH' || tx.asset === 'WETH')) ethVolume += tx.value;
        if (['erc20', 'erc721', 'erc1155'].includes(tx.category)) { swapCount++; if (tx.asset) uniqueTokens.add(tx.asset); }
        if (tx.category === 'external') contractInteractions++;
      }

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

      let historyDays = 364; let firstTxStr = "N/A", lastTxStr = "N/A", daysSinceActive = 0;
      if (sortedTxs.length > 0) {
        const firstTxDate = new Date(sortedTxs[0].metadata.blockTimestamp);
        const lastTxDate = new Date(sortedTxs[sortedTxs.length - 1].metadata.blockTimestamp);
        firstTxStr = firstTxDate.toLocaleDateString(); lastTxStr = lastTxDate.toLocaleDateString();
        daysSinceActive = Math.floor((now.getTime() - lastTxDate.getTime()) / (1000 * 3600 * 24));
        historyDays = Math.max(364, Math.ceil(Math.abs(now.getTime() - firstTxDate.getTime()) / (1000 * 3600 * 24)) + 14); 
      }

      const activityMap = Array(historyDays).fill(false);
      const pointerDate = new Date(); 
      for(let i=0; i<historyDays; i++) {
          if (uniqueDays.has(pointerDate.toISOString().split('T')[0])) activityMap[(historyDays - 1) - i] = true; 
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

      const finalScore = Math.floor(Math.min(25, allTransfers.length/20) + Math.min(20, uniqueDays.size/5) + Math.min(15, uniqueMonths.size*1.25) + Math.min(15, currentStreak*1.1) + Math.min(10, ethVolume*2) + Math.min(10, uniqueTokens.size/2) + (basename ? 5 : 0));

      setWallet({
        address, basename, balance: parseFloat(formatEther(balWei)).toFixed(4), ethVolume: ethVolume.toFixed(2),
        txCount: allTransfers.length, uniqueDays: uniqueDays.size, activeWeeks: uniqueWeeks.size, activeMonths: uniqueMonths.size,
        currentStreak, longestStreak, firstTx: firstTxStr, lastTx: lastTxStr, daysSinceActive,
        tokensSwapped: uniqueTokens.size, swapCount, contractInteractions, score: Math.min(100, finalScore),
        activityMap, historyDays, weekLabels
      });
    } catch (e: unknown) { console.error("Analysis failed", e); alert("❌ Error: " + (e instanceof Error ? e.message : String(e))); } finally { setLoading(false); }
  };

  const handleConnect = async (type: ConnectionType) => {
    try {
      const { address } = await connectWallet(type);
      setConnectionType(type);
      analyzeWallet(address);
    } catch (e) { console.error(e); alert((e as Error).message); }
  };

  const handleDisconnect = () => { setWallet(null); setConnectionType(null); };

  const handleOnChainCheckIn = async () => {
    if (!wallet || !connectionType) return setShowConnectModal(true);
    
    try {
      setTxLoading(true);
      const provider = await getWalletProvider(connectionType); 
      const signer = await provider.getSigner();

      const network = await provider.getNetwork();
      if (network.chainId !== BigInt(8453)) {
        try { await provider.send("wallet_switchEthereumChain", [{ chainId: "0x2105" }]); } catch {
            alert("Please switch your wallet network to Base Mainnet manually."); setTxLoading(false); return;
        }
      }
      
      const contract = new Contract(CHECKIN_CONTRACT_ADDRESS, CHECKIN_ABI, signer);
      let fee = parseEther("0.000004");
      try { fee = await contract.checkInFee(); } catch { console.warn("Using default fee"); }

      // ✅ REMOVED the placeholder address check (Since you have real addresses now)
      const tx = await contract.checkIn({ 
          value: fee,
          gasLimit: 300000 
      });
      
      setPoints(prev => prev + 1); 
      setStreak(prev => prev + 1);
      
      await tx.wait(); 
      alert("✅ Success: Check-in Verified on Chain!");
      analyzeWallet(wallet.address);

    } catch (error: unknown) { 
        console.error("Check-in Error:", error);
        const err = error as { reason?: string; message?: string };
        alert("❌ Failed: " + (err.reason || err.message || "Unknown error"));
    } finally { setTxLoading(false); }
  };

  const handleGmGn = async (type: 'gm' | 'gn') => {
    if (!wallet || !connectionType) return setShowConnectModal(true);
    try {
      setGmLoading(true);
      const provider = await getWalletProvider(connectionType); 
      const signer = await provider.getSigner();

      const network = await provider.getNetwork();
      if (network.chainId !== BigInt(8453)) {
        try { await provider.send("wallet_switchEthereumChain", [{ chainId: "0x2105" }]); } catch {
            alert("Please switch your wallet network to Base Mainnet manually."); setGmLoading(false); return;
        }
      }

      // ✅ REMOVED the placeholder address check
      const contract = new Contract(GM_GN_CONTRACT_ADDRESS, GM_GN_ABI, signer);
      let fee = parseEther("0.000004");
      try { fee = await contract.fee(); } catch {}

      const tx = type === 'gm' 
        ? await contract.gm({ value: fee, gasLimit: 300000 }) 
        : await contract.gn({ value: fee, gasLimit: 300000 });
      await tx.wait();
      alert(`✅ Success: Said ${type.toUpperCase()} on chain!`);
      
    } catch (error: unknown) { 
        console.error("GM Error:", error);
        const err = error as { reason?: string; message?: string };
        alert("❌ Failed: " + (err.reason || err.message || "Unknown error"));
    } finally { setGmLoading(false); }
  };

  const shareNative = async () => {
    if (!wallet) return;
    const shareText = `My Onchain Score: ${wallet.score}/100 🔵\n\n👤 ${wallet.basename || wallet.address.slice(0,6)}\n🔥 Streak: ${wallet.currentStreak} Days\n📅 Active: ${wallet.uniqueDays} Days\n\nCheck your score 👇`;
    if (navigator.share) { try { await navigator.share({ title: 'My Base Analytics', text: shareText, url: MINIAPP_URL }); } catch {} } 
    else { alert("Link copied to clipboard!"); navigator.clipboard.writeText(`${shareText}\n${MINIAPP_URL}`); }
  };

  const shareWarpcast = () => {
    if (!wallet) return;
    const shareText = `My Onchain Score: ${wallet.score}/100 🔵\n\n👤 ${wallet.basename || wallet.address.slice(0,6)}\n🔥 Streak: ${wallet.currentStreak} Days\n📅 Active: ${wallet.uniqueDays} Days\n\nBuilt by @suryaprakash.farcaster.eth 🎩\nCheck your score 👇`;
    window.open(`https://warpcast.com/~/compose?text=${encodeURIComponent(shareText)}&embeds[]=${encodeURIComponent(MINIAPP_URL)}`, '_blank');
  };

  if (!isReady) return <div className="min-h-screen bg-[#000510] flex items-center justify-center text-blue-500 font-mono">INITIALIZING BASE...</div>;

  if (!wallet) return (
    <div className="min-h-screen bg-[#000510] flex flex-col items-center justify-center p-6 text-center text-white relative overflow-hidden">
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_center,#0033aa_0%,#000510_70%)] opacity-30"></div>
      <div className="w-24 h-24 bg-[#0052FF] rounded-full mb-8 flex items-center justify-center shadow-[0_0_80px_-10px_rgba(0,82,255,0.6)] z-10 animate-pulse"><Activity className="text-white" size={48} /></div>
      <h1 className="text-4xl md:text-6xl font-black text-white mb-2 tracking-tighter z-10 drop-shadow-2xl">BASE ANALYTICS</h1>
      <p className="text-blue-200/80 mb-10 font-medium text-lg z-10 tracking-widest uppercase">The better way to analyse your onchain activity</p>
      <button onClick={() => setShowConnectModal(true)} disabled={loading} className="w-full max-w-xs bg-white text-[#0052FF] py-4 rounded-full font-black text-lg flex items-center justify-center gap-3 hover:bg-blue-50 transition active:scale-95 shadow-[0_0_40px_-10px_rgba(255,255,255,0.3)] z-10">
        {loading ? <RefreshCcw className="animate-spin"/> : <Wallet size={22} />} {loading ? loadingMsg : "Connect Wallet"}
      </button>
      {showConnectModal && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-in fade-in duration-200">
              <div className="bg-[#0F172A] border border-blue-900/50 rounded-3xl w-full max-w-sm p-6 shadow-2xl relative">
                  <button onClick={() => setShowConnectModal(false)} className="absolute top-4 right-4 text-slate-400 hover:text-white"><X size={20}/></button>
                  <h3 className="text-xl font-black text-white mb-6 text-center">Connect Wallet</h3>
                  <div className="flex flex-col gap-3">
                      <button onClick={() => handleConnect('coinbase')} className="flex items-center justify-between bg-blue-600 hover:bg-blue-500 text-white p-4 rounded-xl font-bold transition-all group">
                          <div className="flex items-center gap-3"><div className="bg-white/20 p-2 rounded-lg"><Globe size={20}/></div> Coinbase Wallet</div><ChevronRight size={18} className="opacity-50 group-hover:opacity-100"/>
                      </button>
                      <button onClick={() => handleConnect('metamask')} className="flex items-center justify-between bg-orange-700/80 hover:bg-orange-600 text-white border border-orange-500/30 p-4 rounded-xl font-bold transition-all group">
                          <div className="flex items-center gap-3"><div className="bg-orange-500/20 p-2 rounded-lg"><Wallet size={20}/></div> MetaMask / Injected</div><ChevronRight size={18} className="opacity-50 group-hover:opacity-100"/>
                      </button>
                      <button onClick={() => handleConnect('farcaster')} className="flex items-center justify-between bg-[#472a91] hover:bg-[#5835b0] text-white p-4 rounded-xl font-bold transition-all group border border-purple-500/30">
                          <div className="flex items-center gap-3"><div className="bg-white/20 p-2 rounded-lg"><Smartphone size={20}/></div> Farcaster Wallet</div><ChevronRight size={18} className="opacity-50 group-hover:opacity-100"/>
                      </button>
                  </div>
              </div>
          </div>
      )}
      <div className="flex flex-col gap-3 mt-16 z-10 opacity-60">
          <p className="text-[10px] uppercase font-bold text-blue-400 tracking-[0.3em]">POWERED BY</p>
          <div className="flex gap-6 justify-center text-blue-300">
              <div className="flex flex-col items-center gap-2"><Smartphone size={20} /><span className="text-[10px] font-bold">Farcaster</span></div>
              <div className="flex flex-col items-center gap-2"><Globe size={20} /><span className="text-[10px] font-bold">MetaMask</span></div>
              <div className="flex flex-col items-center gap-2"><div className="w-5 h-5 rounded-full bg-[#0052FF]"></div><span className="text-[10px] font-bold">Base</span></div>
          </div>
      </div>
    </div>
  );

  return (
    <main className="min-h-screen bg-[#000510] p-4 lg:p-8 font-sans text-slate-200 pb-32">
      <div className="flex justify-between items-center mb-8">
        <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-[#0052FF] rounded-full flex items-center justify-center shadow-lg shadow-blue-900/50"><Activity className="text-white" size={20}/></div>
            <span className="font-black text-xl tracking-tight text-white">BASE ANALYTICS</span>
        </div>
        <button onClick={handleDisconnect} className="p-3 bg-blue-950/30 rounded-full shadow-lg border border-blue-900/30 text-blue-400 hover:text-white hover:bg-[#0052FF] transition-all"><Power size={18}/></button>
      </div>
      <div className="bg-linear-to-r from-blue-950/40 to-slate-900/40 rounded-3xl p-1 shadow-2xl mb-8 border border-blue-900/30 relative overflow-hidden group">
            <div className="absolute top-0 right-0 w-96 h-96 bg-[#0052FF] rounded-full blur-[150px] opacity-10 group-hover:opacity-20 transition-opacity duration-700 pointer-events-none"></div>
            <div className="bg-[#020817]/80 backdrop-blur-xl rounded-[20px] p-6 sm:p-8 relative z-10">
                <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-8">
                    <div>
                        <div className="flex items-center gap-4 mb-4">
                            <div className="p-3 bg-[#0052FF]/20 rounded-xl border border-[#0052FF]/30"><Zap size={28} className="text-[#0052FF]" /></div>
                            <div><h3 className="font-black text-2xl text-white leading-none">Daily Check-in</h3><p className="text-blue-300/60 text-sm mt-1">Mint your streak on Base</p></div>
                        </div>
                        <div className="flex gap-2">
                            {[...Array(7)].map((_, i) => (
                                <div key={i} className={`w-10 h-12 rounded-lg border flex items-center justify-center transition-all ${i < streak % 7 ? 'bg-[#0052FF] border-[#0052FF] text-white shadow-[0_0_15px_-3px_rgba(0,82,255,0.6)]' : 'border-blue-900/30 bg-blue-950/20 text-blue-900'}`}>{i < streak % 7 && <CheckCircle2 size={16} />}</div>
                            ))}
                        </div>
                    </div>
                    <div className="flex flex-row md:flex-col items-center gap-4 w-full md:w-auto">
                         <div className="bg-blue-950/30 p-4 rounded-2xl border border-blue-900/30 flex flex-col justify-center min-w-36 text-center md:text-right">
                            <div className="flex items-center justify-center md:justify-end gap-1.5 mb-1"><Trophy size={14} className="text-[#0052FF]" /><span className="text-[10px] font-bold uppercase text-blue-400 tracking-wider">Reward Pool</span></div>
                            <p className="text-2xl font-black text-white leading-none tracking-tight">$100 <span className="text-blue-600 text-sm">USDC</span></p>
                        </div>
                        <div className="flex flex-col gap-2 w-full md:w-auto">
                            <button onClick={handleOnChainCheckIn} disabled={txLoading} className="w-full px-8 py-4 rounded-xl font-bold text-sm bg-white text-[#0052FF] hover:bg-blue-50 shadow-[0_0_20px_-5px_rgba(255,255,255,0.2)] transition active:scale-95 disabled:opacity-50 disabled:cursor-not-allowed">
                                {txLoading ? 'Minting...' : 'Check-in Now'}
                            </button>
                            <p className="text-[10px] text-center text-blue-400 font-bold uppercase tracking-wide">{points} PTS Earned</p>
                        </div>
                    </div>
                </div>
            </div>
      </div>
      <div className="bg-[#020817] rounded-[20px] p-6 sm:p-8 shadow-lg border border-blue-900/30 mb-8">
            <div className="flex justify-between items-start mb-8 relative z-10">
                <div>
                    <div className="flex items-center gap-3 mb-2">
                        <p className="text-xs font-bold text-blue-500 uppercase tracking-widest">ONCHAIN SCORE</p>
                        <div className="flex gap-2">
                            <button onClick={shareNative} className="bg-[#0052FF]/10 text-[#0052FF] px-3 py-1 rounded-full text-[10px] font-bold flex items-center gap-1.5 hover:bg-[#0052FF]/20 border border-[#0052FF]/20 transition-all"><Share2 size={10}/> Share</button>
                            <button onClick={shareWarpcast} className="bg-purple-500/10 text-purple-400 px-3 py-1 rounded-full text-[10px] font-bold flex items-center gap-1.5 hover:bg-purple-500/20 border border-purple-500/20 transition-all"><Send size={10}/> Warpcast</button>
                        </div>
                    </div>
                    <h1 className="text-7xl font-black text-white tracking-tighter drop-shadow-xl">{wallet.score}<span className="text-3xl text-blue-900">/100</span></h1>
                </div>
                <div className="text-right"></div>
            </div>
            <div className="w-full overflow-x-auto pb-4 custom-scrollbar">
                <div className="grid grid-flow-col gap-1.5 mb-2 relative min-w-max auto-cols-[12px]">
                {wallet.weekLabels.map((m, i) => (
                    <div key={i} className="text-[9px] font-bold text-white/90 uppercase text-left w-3 whitespace-nowrap overflow-visible">{m}</div>
                ))}
                </div>
                <div className="grid grid-rows-7 grid-flow-col gap-1.5 h-36 relative z-10 min-w-max">
                    {wallet.activityMap.map((active, i) => (
                        <div key={i} title={active ? 'Active' : 'Inactive'} className={`w-3 h-3 rounded-xs transition-all duration-300 ${active ? 'bg-[#0052FF] shadow-[0_0_8px_-1px_rgba(0,82,255,0.8)]' : 'bg-blue-950/30'}`}></div>
                    ))}
                </div>
            </div>
            <div className="flex justify-between items-center mt-4 pt-4 border-t border-blue-900/30">
                <p className="text-[10px] text-blue-500 font-bold uppercase tracking-wide">First Tx: {wallet.firstTx}</p>
                <p className="text-[10px] text-blue-400 font-bold uppercase tracking-widest">Lifetime History ({wallet.historyDays} Days)</p>
                <p className="text-[10px] text-blue-500 font-bold uppercase tracking-wide">Today</p>
            </div>
      </div>
      <h3 className="text-sm font-bold text-blue-500 mb-4 ml-2 flex items-center gap-2 uppercase tracking-widest"><BarChart3 size={16}/> Wallet Status</h3>
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
          <div className="bg-linear-to-br from-[#0052FF]/10 to-blue-950/20 p-5 rounded-2xl border border-[#0052FF]/30 flex flex-col justify-between col-span-2 relative overflow-hidden group">
              <div className="absolute top-0 right-0 w-32 h-32 bg-[#0052FF] rounded-full blur-[80px] opacity-20 pointer-events-none"></div>
              <div className="flex justify-between items-start mb-2 relative z-10">
                  <div className="p-2 bg-blue-950/50 rounded-lg text-white"><User size={20}/></div>
                  {wallet.basename && <div className="px-2 py-1 bg-green-500/20 text-green-400 text-[10px] font-bold rounded border border-green-500/30 flex items-center gap-1"><BadgeCheck size={10}/> VERIFIED</div>}
              </div>
              <div className="relative z-10">
                  <p className="text-2xl font-black text-white tracking-tight truncate">{wallet.basename ? wallet.basename : `${wallet.address.slice(0,6)}...${wallet.address.slice(-4)}`}</p>
                  <p className="text-[10px] font-bold text-blue-300 uppercase tracking-widest mt-1">Base Identity</p>
              </div>
          </div>
          <StatCard label="Wallet Balance" value={`${wallet.balance} ETH`} icon={<CreditCard size={18}/>} />
          <StatCard label="Total Active Days" value={wallet.uniqueDays.toString()} icon={<Sun size={18}/>} highlight />
          <StatCard label="Current Streak" value={`${wallet.currentStreak} Days`} icon={<Zap size={18} className={wallet.currentStreak > 0 ? "text-[#0052FF]" : "text-white"}/>} />
          <StatCard label="Longest Streak" value={`${wallet.longestStreak} Days`} icon={<Trophy size={18}/>} />
          <StatCard label="Active Weeks" value={wallet.activeWeeks.toString()} icon={<Calendar size={18}/>} />
          <StatCard label="Total Txs" value={wallet.txCount.toLocaleString()} icon={<Layers size={18}/>} />
          <StatCard label="ETH Volume" value={`${wallet.ethVolume} Ξ`} icon={<ArrowRightLeft size={18}/>} />
          <StatCard label="Tokens Moved" value={wallet.tokensSwapped.toString()} icon={<Coins size={18}/>} />
          <StatCard label="Token Transfers" value={wallet.swapCount.toLocaleString()} icon={<RefreshCcw size={18}/>} />
          <StatCard label="Contract Txs" value={wallet.contractInteractions.toLocaleString()} icon={<FileCode size={18}/>} />
      </div>
      <div className="bg-[#020817] rounded-3xl p-6 shadow-sm border border-blue-900/30">
           <div className="flex items-center gap-3 mb-4">
              <div className="p-2 bg-blue-900/20 rounded-lg"><Sun size={20} className="text-[#0052FF]" /></div>
              <h3 className="font-bold text-lg text-white">Community Vibes</h3>
           </div>
           <div className="grid grid-cols-2 gap-4">
              <button onClick={() => handleGmGn('gm')} disabled={gmLoading} className="py-4 bg-blue-950/30 hover:bg-[#0052FF] hover:text-white text-white rounded-xl font-black text-xl flex items-center justify-center gap-2 border border-blue-900/30 transition-all active:scale-95"><Sun size={24} /> GM</button>
              <button onClick={() => handleGmGn('gn')} disabled={gmLoading} className="py-4 bg-blue-950/30 hover:bg-[#0052FF] hover:text-white text-white rounded-xl font-black text-xl flex items-center justify-center gap-2 border border-blue-900/30 transition-all active:scale-95"><Moon size={24} /> GN</button>
           </div>
      </div>
    </main>
  );
}

function StatCard({ label, value, icon, full, highlight }: { label: string, value: string, icon: React.ReactNode, full?: boolean, highlight?: boolean }) {
    return (
        <div className={`bg-[#020817] p-5 rounded-2xl border border-blue-900/20 flex flex-col justify-between group hover:border-[#0052FF]/50 transition-all ${full ? 'col-span-1' : ''}`}>
            <div className={`mb-3 ${highlight ? 'text-[#0052FF]' : 'text-white group-hover:text-blue-200'}`}>{icon}</div>
            <div>
                <p className="text-xl font-black text-white tracking-tight truncate" title={value}>{value}</p>
                <p className="text-[9px] font-bold text-blue-200 uppercase tracking-widest truncate group-hover:text-white transition-colors">{label}</p>
            </div>
        </div>
    )
} 