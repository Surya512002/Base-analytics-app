"use client";

import React, { useState, useEffect, useRef } from 'react';
// ✅ Restored X and ChevronRight, removed unused icons
import { Wallet, Activity, Power, RefreshCcw, Sun, CreditCard, X, ChevronRight } from 'lucide-react';
import { JsonRpcProvider, formatEther } from 'ethers';
import { sdk } from "@farcaster/miniapp-sdk";
import { connectWallet } from './connection';

// ✅ OnchainKit Imports
import { 
  Transaction, 
  TransactionButton, 
  TransactionSponsor, 
  TransactionStatus, 
  TransactionStatusLabel 
} from '@coinbase/onchainkit/transaction'; 
import { base } from 'viem/chains';

// --- CONFIGURATION ---
const ALCHEMY_KEY = process.env.NEXT_PUBLIC_ALCHEMY_KEY || "ZHHTYOLANc6hp1RX7bQp1"; 
const BASE_RPC = `https://base-mainnet.g.alchemy.com/v2/${ALCHEMY_KEY}`;
const BASESCAN_KEY = "UDFW8PRDXWMNZUWGNIU6R5C4991KU5UB68";

// ✅ REAL CONTRACT ADDRESSES
const BOOSTER_CONTRACT_ADDRESS = "0xd14E38239791738e8aCbd0Ad5278496af26fF510"; 
const GM_GN_CONTRACT_ADDRESS = "0xc801bCe6739D30C409151a544F0baEd10EB719dE"; 

// ✅ OnchainKit ABIs
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
  const [, setLoadingMsg] = useState("");
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

  const getStrictUTCDate = (isoTimestamp: string) => isoTimestamp.split('T')[0];

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
    setLoading(true); 
    setLoadingMsg("Scanning Base Network..."); 
    setShowConnectModal(false);
    try {
      const provider = new JsonRpcProvider(BASE_RPC);
      let basename = null; try { basename = await provider.lookupAddress(address); } catch {}
      const balWei = await provider.getBalance(address);

      let allTransfers: AlchemyTransfer[] = [];
      let pageKey: string | undefined = undefined;
      
      while (true) {
          const params: Record<string, unknown> = { fromBlock: "0x0", toBlock: "latest", fromAddress: address, category: ["external", "erc20", "erc721", "erc1155"], maxCount: "0x3e8", withMetadata: true };
          if (pageKey) params.pageKey = pageKey;
          const response = await fetch(BASE_RPC, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ jsonrpc: "2.0", id: 1, method: "alchemy_getAssetTransfers", params: [params] }) });
          const data = (await response.json()) as AlchemyResponse;
          const newTransfers = data.result?.transfers || [];
          allTransfers = [...allTransfers, ...newTransfers];
          pageKey = data.result?.pageKey;
          if (!pageKey) break;
      }

      const internalTxs = await fetchInternalTxs(address);
      const uniqueDays = new Set<string>(), txsPerDay = new Map<string, number>();
      let ethVolume = 0.0;
      let contractInteractions = 0;

      allTransfers.forEach(tx => {
        const dayStr = getStrictUTCDate(tx.metadata.blockTimestamp);
        uniqueDays.add(dayStr);
        txsPerDay.set(dayStr, (txsPerDay.get(dayStr) || 0) + 1);
        if (tx.value && (tx.asset === 'ETH' || tx.asset === 'WETH')) ethVolume += tx.value;
        if (tx.category === 'external') contractInteractions++;
      });

      const totalTxCount = allTransfers.length + internalTxs.length;
      const dailyStats: DayStats[] = [];
      const pointerDate = new Date(); 
      for(let i=0; i<364; i++) {
          const dateStr = pointerDate.toISOString().split('T')[0];
          const count = txsPerDay.get(dateStr) || 0;
          let intensity = 0;
          if (count > 0) intensity = 1; if (count > 2) intensity = 2; if (count > 5) intensity = 3; if (count > 10) intensity = 4;
          dailyStats.unshift({ date: dateStr, count, intensity }); 
          pointerDate.setUTCDate(pointerDate.getUTCDate() - 1);
      }

      setWallet({
        address, basename, balance: parseFloat(formatEther(balWei)).toFixed(4), ethVolume: ethVolume.toFixed(2),
        txCount: totalTxCount, uniqueDays: uniqueDays.size, activeWeeks: 0, activeMonths: 0,
        currentStreak: 0, longestStreak: 0, firstTx: "Scan Complete", lastTx: "Today", daysSinceActive: 0,
        tokensSwapped: 0, swapCount: 0, contractInteractions, internalTxCount: internalTxs.length,
        score: Math.min(100, totalTxCount), historyDays: 364, weekLabels: MONTHS_3_LETTERS, dailyStats
      });
    } catch (e) { console.error("Analysis Error", e); } finally { setLoading(false); }
  };

  const handleConnect = async (type: ConnectionType) => {
    try {
      const { address } = await connectWallet(type);
      setConnectionType(type);
      analyzeWallet(address);
    } catch (e) { alert((e as Error).message); }
  };

  const handleDisconnect = () => { setWallet(null); setConnectionType(null); };

  // Sponsored Calls
  const boostCall = [{ to: BOOSTER_CONTRACT_ADDRESS as `0x${string}`, abi: BOOSTER_ABI, functionName: 'boost', args: [], value: BigInt(4000000000000) }];
  const gmCall = [{ to: GM_GN_CONTRACT_ADDRESS as `0x${string}`, abi: GM_GN_ABI, functionName: 'gm', args: [], value: BigInt(4000000000000) }];
  const gnCall = [{ to: GM_GN_CONTRACT_ADDRESS as `0x${string}`, abi: GM_GN_ABI, functionName: 'gn', args: [], value: BigInt(4000000000000) }];

  if (!isReady) return <div className="min-h-screen bg-[#020410] flex items-center justify-center text-blue-500 font-mono text-xs animate-pulse">INITIALIZING BASE...</div>;

  if (!wallet) return (
    <div className="min-h-screen bg-[#020410] flex flex-col items-center justify-center p-6 text-center text-white relative overflow-hidden">
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_center,#0033aa_0%,#000510_70%)] opacity-40"></div>
      <div className="w-24 h-24 bg-[#0052FF] rounded-full mb-8 flex items-center justify-center shadow-[0_0_80px_-10px_rgba(0,82,255,0.6)] z-10 animate-pulse"><Activity className="text-white" size={48} /></div>
      <h1 className="text-4xl md:text-6xl font-black text-white mb-2 tracking-tighter z-10 drop-shadow-2xl text-center">BASE ANALYTICS</h1>
      <button onClick={() => setShowConnectModal(true)} disabled={loading} className="w-full max-w-xs bg-[#0052FF] text-white py-4 rounded-full font-black text-lg flex items-center justify-center gap-3 hover:bg-blue-600 transition active:scale-95 z-10">
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
                      <div className="p-3 bg-[#0052FF]/20 rounded-xl border border-[#0052FF]/30">🚀</div>
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
            <div className="flex flex-col md:flex-row justify-between items-start mb-8">
                <div>
                    <p className="text-xs font-bold text-blue-500 uppercase tracking-widest mb-2">ONCHAIN SCORE</p>
                    <h1 className="text-7xl font-black text-white tracking-tighter">{wallet.score}<span className="text-3xl text-blue-900">/100</span></h1>
                </div>
                {selectedDay && <div className="bg-blue-900/30 px-4 py-3 rounded-lg border border-blue-500/30"><p className="text-xs text-blue-300 font-bold uppercase">{selectedDay.date}</p><p className="text-xl font-black text-white">{selectedDay.count} Txs</p></div>}
            </div>
            <div ref={scrollRef} className="w-full overflow-x-auto pb-4 custom-scrollbar">
                <div className="grid grid-rows-7 grid-flow-col gap-1.5 h-36 min-w-max">
                    {wallet.dailyStats.map((stat, i) => (
                        <div key={i} onClick={() => setSelectedDay(stat)} className={`w-3 h-3 rounded-xs cursor-pointer hover:scale-125 transition-all ${stat.count === 0 ? 'bg-blue-950/30' : 'bg-[#0052FF]'} opacity-${stat.intensity * 25 || 10}`}></div>
                    ))}
                </div>
            </div>
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
          <StatCard label="Balance" value={`${wallet.balance} ETH`} icon={<CreditCard size={18}/>} />
          <StatCard label="Active Days" value={wallet.uniqueDays.toString()} icon={<Sun size={18}/>} highlight />
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