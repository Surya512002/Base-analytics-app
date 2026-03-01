"use client";
import React, { useState, useEffect } from 'react';
import { 
  BookOpen, ShieldAlert, Code, 
  ExternalLink, Globe, Coins, Palette, MessageCircle, Fingerprint,
  Gamepad2, Layers, TrendingUp, Cpu, ArrowRight, PlayCircle, X, 
  CheckCircle2, Wrench, Bot, LineChart, TrendingDown, Activity, RefreshCcw, ShoppingCart, Flame
} from 'lucide-react';

// --- TYPE DEFINITIONS ---
interface CoinData {
  id: string;
  symbol: string;
  name: string;
  price: number;
  change24h: number;
  change7d: number;
  change30d: number;
  volume: number;
}

// --- TRENDING AI AGENTS ---
const TRENDING_AGENTS = [
  { name: "Clanker", creator: "@clanker", description: "The premier AI token deployer. Tag Clanker with a name and image to instantly deploy an ERC-20 token.", icon: <Bot size={24} />, color: "text-emerald-500", bg: "bg-emerald-500/10", border: "hover:border-emerald-500/50" },
  { name: "Aethernet", creator: "@aethernet", description: "The official AI agent for the Higher community, creating generative art and tipping creators autonomously.", icon: <Cpu size={24} />, color: "text-green-500", bg: "bg-green-500/10", border: "hover:border-green-500/50" },
  { name: "X-Tx Radar", creator: "In Development", description: "Mentions a username on X (Twitter)? This powerful agent instantly surfaces their recent onchain transactions.", icon: <Activity size={24} />, color: "text-[#0052FF]", bg: "bg-[#0052FF]/10", border: "hover:border-[#0052FF]/50" },
  { name: "Luna AI", creator: "@virtuals", description: "An interactive, fully autonomous AI idol deployed on the Virtuals protocol that streams and interacts with fans.", icon: <MessageCircle size={24} />, color: "text-pink-500", bg: "bg-pink-500/10", border: "hover:border-pink-500/50" }
];

// --- MEGA BASE ECOSYSTEM DIRECTORY ---
const ECOSYSTEM_PROJECTS = [
  // DeFi & Finance
  { name: "Aerodrome", category: "DeFi / DEX", description: "The central trading and liquidity hub on Base. Swap tokens and earn yield.", url: "https://aerodrome.finance/", icon: <Coins size={24} />, color: "text-blue-500", bg: "bg-blue-500/10", border: "hover:border-blue-500/50" },
  { name: "Uniswap", category: "DeFi / DEX", description: "The world's largest decentralized exchange, fully optimized for low fees on Base.", url: "https://app.uniswap.org/", icon: <Globe size={24} />, color: "text-pink-500", bg: "bg-pink-500/10", border: "hover:border-pink-500/50" },
  { name: "Aave", category: "DeFi / Lending", description: "The gold standard of DeFi lending. Supply crypto to earn interest or borrow against your assets.", url: "https://app.aave.com/", icon: <TrendingUp size={24} />, color: "text-cyan-500", bg: "bg-cyan-500/10", border: "hover:border-cyan-500/50" },
  { name: "Morpho", category: "DeFi / Lending", description: "Highly efficient, peer-to-peer lending and borrowing protocol scaling rapidly on Base.", url: "https://app.morpho.org/", icon: <Layers size={24} />, color: "text-blue-600", bg: "bg-blue-600/10", border: "hover:border-blue-600/50" },
  { name: "Synthetix", category: "DeFi / Derivatives", description: "Trade perpetual futures and synthetic assets with deep liquidity natively on Base.", url: "https://synthetix.io/", icon: <LineChart size={24} />, color: "text-indigo-400", bg: "bg-indigo-400/10", border: "hover:border-indigo-400/50" },
  { name: "Moonwell", category: "DeFi / Lending", description: "The premier open lending and borrowing protocol built natively on Base.", url: "https://moonwell.fi/", icon: <TrendingUp size={24} />, color: "text-indigo-500", bg: "bg-indigo-500/10", border: "hover:border-indigo-500/50" },
  { name: "SushiSwap", category: "DeFi / DEX", description: "A community-driven decentralized exchange with cross-chain capabilities.", url: "https://www.sushi.com/", icon: <Coins size={24} />, color: "text-rose-500", bg: "bg-rose-500/10", border: "hover:border-rose-500/50" },
  { name: "Beefy", category: "DeFi / Yield", description: "Multichain yield optimizer. Auto-compound your crypto rewards effortlessly.", url: "https://app.beefy.finance/", icon: <TrendingUp size={24} />, color: "text-emerald-500", bg: "bg-emerald-500/10", border: "hover:border-emerald-500/50" },
  
  // Social & Consumer
  { name: "Farcaster", category: "Social", description: "The premier client for Farcaster. A decentralized social network built on Base.", url: "https://farcaster.xyz/", icon: <MessageCircle size={24} />, color: "text-[#8A2BE2]", bg: "bg-[#8A2BE2]/10", border: "hover:border-[#8A2BE2]/50" },
  { name: "Cyber", category: "Social / Identity", description: "The social layer for Web3. Create a profile and connect across digital experiences.", url: "https://cyber.co/", icon: <Globe size={24} />, color: "text-black", bg: "bg-slate-400/20", border: "hover:border-slate-500/50" },
  { name: "RH HUB", category: "Social / dApp", description: "An upcoming decentralized application bridging seamless social and onchain interactions.", url: "#", icon: <Layers size={24} />, color: "text-green-600", bg: "bg-green-600/10", border: "hover:border-green-600/50" },
  { name: "Bountycaster", category: "Social / Work", description: "Create and complete bounties across the Farcaster network to earn crypto.", url: "https://www.bountycaster.xyz/", icon: <Layers size={24} />, color: "text-emerald-500", bg: "bg-emerald-500/10", border: "hover:border-emerald-500/50" },
  { name: "Drakula", category: "Social / Video", description: "The short-form video app of Web3. Swipe, create, and earn tokens for content.", url: "https://drakula.app/", icon: <PlayCircle size={24} />, color: "text-red-500", bg: "bg-red-500/10", border: "hover:border-red-500/50" },
  { name: "Paragraph", category: "Publishing", description: "Publish newsletters, build communities, and mint your writing as NFTs.", url: "https://paragraph.xyz/", icon: <BookOpen size={24} />, color: "text-orange-600", bg: "bg-orange-600/10", border: "hover:border-orange-600/50" },

  // NFTs & Creators
  { name: "Zora", category: "NFTs / Creators", description: "Mint, collect, and create beautiful onchain media and NFT collections.", url: "https://zora.co/", icon: <Palette size={24} />, color: "text-rose-500", bg: "bg-rose-500/10", border: "hover:border-rose-500/50" },
  { name: "Sound.xyz", category: "Music / NFTs", description: "Discover new music, collect songs directly from artists, and support creators onchain.", url: "https://www.sound.xyz/", icon: <PlayCircle size={24} />, color: "text-purple-500", bg: "bg-purple-500/10", border: "hover:border-purple-500/50" },
  { name: "BasePaint", category: "NFTs / Collaborative", description: "A collaborative pixel art canvas where artists paint together and share mint revenue.", url: "https://basepaint.xyz/", icon: <Palette size={24} />, color: "text-blue-400", bg: "bg-blue-400/10", border: "hover:border-blue-400/50" },
  { name: "Magic Eden", category: "NFT Marketplace", description: "Discover, trade, and collect the top trending NFT collections on the Base network.", url: "https://magiceden.io/base", icon: <Globe size={24} />, color: "text-fuchsia-500", bg: "bg-fuchsia-500/10", border: "hover:border-fuchsia-500/50" },
  { name: "Foundation", category: "Art / NFTs", description: "A premier destination to discover, collect, and sell exclusive digital art.", url: "https://foundation.app/", icon: <Palette size={24} />, color: "text-slate-800", bg: "bg-slate-300", border: "hover:border-slate-800/50" },

  // Gaming & Quests
  { name: "Layer3", category: "Quests / Gaming", description: "Complete interactive quests to learn Web3 skills and earn rewards and tokens.", url: "https://layer3.xyz/", icon: <Gamepad2 size={24} />, color: "text-yellow-600", bg: "bg-yellow-600/10", border: "hover:border-yellow-600/50" },
  { name: "Frenpet", category: "Gaming", description: "Tamagotchi meets crypto. Adopt, feed, and battle digital pets entirely onchain.", url: "https://frenpet.com/", icon: <Gamepad2 size={24} />, color: "text-orange-500", bg: "bg-orange-500/10", border: "hover:border-orange-500/50" },
  { name: "Parallel", category: "Gaming / TCG", description: "A sci-fi collectible card game with true asset ownership and intense strategy.", url: "https://parallel.life/", icon: <Gamepad2 size={24} />, color: "text-indigo-400", bg: "bg-indigo-400/10", border: "hover:border-indigo-400/50" },
  { name: "Words3", category: "Gaming", description: "A competitive, fast-paced multiplayer word game powered by Base smart contracts.", url: "https://www.words3.xyz/", icon: <BookOpen size={24} />, color: "text-cyan-500", bg: "bg-cyan-500/10", border: "hover:border-cyan-500/50" },

  // Infrastructure & Dev Tools
  { name: "Basenames", category: "Identity", description: "Claim your unique .base.eth username to build your onchain reputation.", url: "https://www.base.org/names", icon: <Fingerprint size={24} />, color: "text-[#0052FF]", bg: "bg-[#0052FF]/10", border: "hover:border-[#0052FF]/50" },
  { name: "Neynar", category: "Dev Tools", description: "The ultimate Farcaster developer hub. Build social AI agents and track user reputation scores instantly.", url: "https://neynar.com/", icon: <Cpu size={24} />, color: "text-yellow-500", bg: "bg-yellow-500/10", border: "hover:border-yellow-500/50" },
  { name: "Thirdweb", category: "Dev Tools", description: "The complete Web3 development framework. Deploy contracts and build dApps in minutes.", url: "https://thirdweb.com/", icon: <Code size={24} />, color: "text-fuchsia-600", bg: "bg-fuchsia-600/10", border: "hover:border-fuchsia-600/50" },
  { name: "Privy", category: "Auth / Dev Tools", description: "Drop-in Web3 authentication. Let users sign in with email, social, or standard wallets.", url: "https://www.privy.io/", icon: <ShieldAlert size={24} />, color: "text-sky-500", bg: "bg-sky-500/10", border: "hover:border-sky-500/50" },
  { name: "Guild", category: "Community Tools", description: "Automate membership management and create token-gated roles for the Base community.", url: "https://guild.xyz/base", icon: <ShieldAlert size={24} />, color: "text-slate-600", bg: "bg-slate-600/10", border: "hover:border-slate-600/50" },
  { name: "Coinbase CDP", category: "Dev Tools", description: "Coinbase Developer Platform. Build robust, secure, and scalable onchain applications.", url: "https://portal.cdp.coinbase.com/", icon: <Code size={24} />, color: "text-[#0052FF]", bg: "bg-[#0052FF]/10", border: "hover:border-[#0052FF]/50" }
];

// --- MODULE CONTENT DATA (Academy) ---
const MODULE_DATA = {
  basics: {
    title: "Web3 Basics & Base L2",
    icon: <BookOpen size={32} className="text-[#0052FF]" />,
    color: "text-[#0052FF]",
    bg: "bg-[#0052FF]/10",
    sections: [
      { title: "1. Setup Your Web3 Wallet", desc: "To interact with Base, you need a crypto wallet. We recommend Smart Wallets for gasless transactions.", links: [{ text: "Download Coinbase Wallet", url: "https://www.coinbase.com/wallet" }] },
      { title: "2. Fund Your Wallet (Bridging)", desc: "Move ETH from Ethereum (L1) to Base (L2) to pay for transactions.", links: [{ text: "Official Base Bridge", url: "https://bridge.base.org/" }] },
      { title: "3. Claim Your Identity", desc: "Instead of a long 0x address, claim a human-readable name for your wallet.", links: [{ text: "Claim a .base.eth Name", url: "https://www.base.org/names" }] }
    ]
  },
  security: {
    title: "Scam Defense & Security",
    icon: <ShieldAlert size={32} className="text-red-500" />,
    color: "text-red-500",
    bg: "bg-red-500/10",
    sections: [
      { title: "1. Read Transaction Signatures", desc: "Never click 'Confirm' without reading! Use browser extensions that simulate transactions.", links: [{ text: "Pocket Universe Extension", url: "https://www.pocketuniverse.app/" }] },
      { title: "2. Revoke Malicious Approvals", desc: "If you accidentally connected to a shady site, revoke their permission to spend your tokens.", links: [{ text: "Revoke.cash", url: "https://revoke.cash/" }] }
    ]
  },
  build: {
    title: "Deploy & Build on Base",
    icon: <Code size={32} className="text-[#8A2BE2]" />,
    color: "text-[#8A2BE2]",
    bg: "bg-[#8A2BE2]/10",
    sections: [
      { title: "1. Write Smart Contracts", desc: "Write your custom ERC-20 tokens or NFTs using web-based IDEs.", links: [{ text: "Remix IDE", url: "https://remix.ethereum.org/" }] },
      { title: "2. The Developer Toolkit", desc: "Use the absolute best tools for building social and onchain apps fast.", links: [{ text: "OnchainKit", url: "https://onchainkit.xyz/" }, { text: "Neynar API", url: "https://neynar.com/" }] }
    ]
  }
};

type ModuleKey = keyof typeof MODULE_DATA;

export default function BaseHub() {
  const [activeModule, setActiveModule] = useState<ModuleKey | null>(null);
  
  // LIVE PRICING STATE (Updates Automatically)
  const [allCoins, setAllCoins] = useState<CoinData[]>([]);
  const [isFetching, setIsFetching] = useState(true);
  
  // SORTING STATE
  const [tokenTab, setTokenTab] = useState<'trending' | 'gainers' | 'losers'>('trending');
  const [timeframe, setTimeframe] = useState<'24h' | '7d' | '30d'>('24h');

  // FETCH 100% PURE BASE NATIVE TOKENS DYNAMICALLY (Runs automatically every 60s)
  useEffect(() => {
    const fetchLivePrices = async () => {
      try {
        // THE FIX: We explicitly ask CoinGecko for only verified, Base-native tokens!
        const BASE_NATIVE_IDS = 'degen-base,aerodrome-finance,based-brett,higher,toshi,virtual-protocol,moonwell,seamless-protocol,alien-base,mfercoin,base-god,doginme,frenpet,ski-mask-dog,mister-miggles,keyboard-cat-2,basenji,wow-3,luna-virtuals,ben-dog,roost,mumu-the-bull';
        
        const response = await fetch(`https://api.coingecko.com/api/v3/coins/markets?vs_currency=usd&ids=${BASE_NATIVE_IDS}&order=volume_desc&price_change_percentage=24h,7d,30d`);
        const data = await response.json();

        if (data && data.length > 0) {
          // No more messy filters needed! Every token in this list is guaranteed to be pure Base.
          const formattedCoins: CoinData[] = data.map((coin: Record<string, unknown>) => {
            const currentPrice = Number(coin.current_price) || 0;
            const price24h = Number(coin.price_change_percentage_24h_in_currency) || 0;
            const price7d = Number(coin.price_change_percentage_7d_in_currency) || 0;
            const price30d = Number(coin.price_change_percentage_30d_in_currency) || 0;

            return {
              id: String(coin.id),
              symbol: String(coin.symbol).toUpperCase(),
              name: String(coin.name),
              price: currentPrice,
              change24h: price24h,
              change7d: price7d,
              change30d: price30d,
              volume: Number(coin.total_volume) || 0
            };
          });
          
          setAllCoins(formattedCoins);
        }
      } catch (error) {
        console.error("Failed to fetch live prices", error);
      } finally {
        setIsFetching(false);
      }
    };

    // Run instantly on load
    fetchLivePrices();
    
    // THE ROBOT: Runs automatically every 60 seconds to update live data
    const interval = setInterval(fetchLivePrices, 60000); 
    return () => clearInterval(interval);
  }, []);

  // SORTING ENGINE (Recalculates instantly when tabs are clicked)
  const getDisplayedCoins = () => {
    const sorted = [...allCoins];
    const sortKey = timeframe === '24h' ? 'change24h' : timeframe === '7d' ? 'change7d' : 'change30d';

    if (tokenTab === 'gainers') {
      sorted.sort((a, b) => b[sortKey] - a[sortKey]);
    } else if (tokenTab === 'losers') {
      sorted.sort((a, b) => a[sortKey] - b[sortKey]);
    } 
    // If 'trending', it remains sorted by Volume (default API behavior)
    
    return sorted.slice(0, 6); // Only show the Top 6 for clean UI
  };

  const selectedData = activeModule ? MODULE_DATA[activeModule] : null;
  const displayedCoins = getDisplayedCoins();

  return (
    <div className="animate-in fade-in slide-in-from-bottom-2 pb-12 relative">
      
      {/* --- MODAL OVERLAY --- */}
      {activeModule && selectedData && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 sm:p-6 bg-slate-900/60 backdrop-blur-sm animate-in fade-in duration-200">
          <div className="bg-slate-200 rounded-3xl w-full max-w-2xl max-h-[90vh] flex flex-col shadow-2xl border border-slate-300 overflow-hidden animate-in zoom-in-95 duration-200">
            <div className="p-6 border-b border-slate-300 flex justify-between items-center bg-slate-200 sticky top-0 z-10">
              <div className="flex items-center gap-4">
                <div className={`p-3 rounded-2xl ${selectedData.bg}`}>{selectedData.icon}</div>
                <h2 className={`text-2xl font-black uppercase tracking-tight ${selectedData.color}`}>{selectedData.title}</h2>
              </div>
              <button onClick={() => setActiveModule(null)} className="p-2 bg-slate-300 text-slate-500 rounded-full hover:bg-slate-400 transition-colors"><X size={24} /></button>
            </div>
            <div className="p-6 overflow-y-auto custom-scrollbar flex flex-col gap-8 bg-slate-200/50">
              {selectedData.sections.map((sec, i) => (
                <div key={i} className="flex flex-col gap-3">
                  <h3 className="text-lg font-black text-slate-800 uppercase tracking-tight flex items-center gap-2">
                    <CheckCircle2 size={18} className={selectedData.color} /> {sec.title}
                  </h3>
                  <p className="text-sm text-slate-600 font-bold ml-7">{sec.desc}</p>
                  <div className="flex flex-col sm:flex-row gap-3 ml-7 mt-2">
                    {sec.links.map((link, j) => (
                      <a key={j} href={link.url} target="_blank" rel="noopener noreferrer" className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs font-black uppercase tracking-widest border transition-all hover:-translate-y-0.5 shadow-sm ${selectedData.bg} ${selectedData.color} border-${selectedData.color.replace('text-', '')}/30 hover:bg-${selectedData.color.replace('text-', '')} hover:text-white`}>
                        <Wrench size={14} /> {link.text}
                      </a>
                    ))}
                  </div>
                </div>
              ))}
            </div>
            <div className="p-6 border-t border-slate-300 bg-slate-200">
              <button onClick={() => setActiveModule(null)} className="w-full py-3 bg-slate-300 text-slate-700 font-black uppercase tracking-widest rounded-xl hover:bg-slate-400 transition-colors">
                Mark as Complete & Close
              </button>
            </div>
          </div>
        </div>
      )}

      {/* SECTION 1: LIVE TOKEN MARKETS (Updates Automatically) */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center mb-6 ml-2 mt-2 gap-4">
        <h3 className="text-sm font-bold text-[#0052FF] flex items-center gap-2 uppercase tracking-widest">
          <LineChart size={16} className="text-[#0052FF]" /> Base Network Tokens
          {isFetching && <RefreshCcw size={12} className="animate-spin text-slate-400" />}
        </h3>
        
        <div className="flex flex-wrap gap-2">
          {/* Category Toggle */}
          <div className="flex bg-slate-300 rounded-xl p-1 border border-slate-400 shadow-inner">
            <button onClick={() => setTokenTab('trending')} className={`px-3 py-1.5 text-[10px] flex items-center gap-1 font-black uppercase rounded-lg transition-all ${tokenTab === 'trending' ? 'bg-[#0052FF] text-white shadow-sm' : 'text-slate-500 hover:text-slate-800'}`}><Flame size={12}/> Trending</button>
            <button onClick={() => setTokenTab('gainers')} className={`px-3 py-1.5 text-[10px] flex items-center gap-1 font-black uppercase rounded-lg transition-all ${tokenTab === 'gainers' ? 'bg-emerald-500 text-white shadow-sm' : 'text-slate-500 hover:text-slate-800'}`}><TrendingUp size={12}/> Gainers</button>
            <button onClick={() => setTokenTab('losers')} className={`px-3 py-1.5 text-[10px] flex items-center gap-1 font-black uppercase rounded-lg transition-all ${tokenTab === 'losers' ? 'bg-red-500 text-white shadow-sm' : 'text-slate-500 hover:text-slate-800'}`}><TrendingDown size={12}/> Losers</button>
          </div>
          {/* Timeframe Toggle */}
          <div className="flex bg-slate-300 rounded-xl p-1 border border-slate-400 shadow-inner">
            <button onClick={() => setTimeframe('24h')} className={`px-3 py-1.5 text-[10px] font-black uppercase rounded-lg transition-all ${timeframe === '24h' ? 'bg-slate-700 text-white shadow-sm' : 'text-slate-500 hover:text-slate-800'}`}>24H</button>
            <button onClick={() => setTimeframe('7d')} className={`px-3 py-1.5 text-[10px] font-black uppercase rounded-lg transition-all ${timeframe === '7d' ? 'bg-slate-700 text-white shadow-sm' : 'text-slate-500 hover:text-slate-800'}`}>7D</button>
            <button onClick={() => setTimeframe('30d')} className={`px-3 py-1.5 text-[10px] font-black uppercase rounded-lg transition-all ${timeframe === '30d' ? 'bg-slate-700 text-white shadow-sm' : 'text-slate-500 hover:text-slate-800'}`}>1M</button>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3 mb-12 min-h-35">
        {allCoins.length === 0 && !isFetching ? (
            <div className="col-span-full text-center text-slate-500 text-xs font-bold py-10">Fetching live network data...</div>
        ) : displayedCoins.map((coin: CoinData, idx: number) => {
          const change = timeframe === '24h' ? coin.change24h : timeframe === '7d' ? coin.change7d : coin.change30d;
          const isUp = change >= 0;
          return (
            <div key={idx} className="bg-slate-200 p-4 rounded-2xl border border-slate-300 shadow-sm flex flex-col items-center text-center relative group hover:border-[#0052FF]/50 transition-colors">
              <span className="text-[10px] font-bold text-slate-500 uppercase tracking-widest mb-1 truncate w-full">{coin.name}</span>
              <h4 className="font-black text-lg text-slate-800 tracking-tight leading-none mb-2">{coin.symbol}</h4>
              <p className="text-sm font-black text-slate-700 mb-2">${coin.price < 0.01 ? coin.price.toFixed(4) : coin.price.toFixed(2)}</p>
              <div className={`flex items-center gap-1 text-[10px] font-black px-2 py-1 rounded-md ${isUp ? 'bg-emerald-500/10 text-emerald-600' : 'bg-red-500/10 text-red-600'}`}>
                {isUp ? <TrendingUp size={12} /> : <TrendingDown size={12} />} {Math.abs(change).toFixed(1)}%
              </div>
              {/* Buy/Trade Overlay */}
              <a href={`https://dexscreener.com/search?q=${coin.symbol}`} target="_blank" rel="noopener noreferrer" className="absolute inset-x-2 bottom-2 bg-[#0052FF] text-white text-[10px] font-black py-2 rounded-xl flex items-center justify-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity translate-y-1 group-hover:translate-y-0 shadow-md">
                <ShoppingCart size={12}/> Trade
              </a>
            </div>
          );
        })}
      </div>

      {/* SECTION 2: TRENDING AI AGENTS */}
      <div className="flex justify-between items-center mb-6 ml-2">
        <h3 className="text-sm font-bold text-[#0052FF] flex items-center gap-2 uppercase tracking-widest">
          <Bot size={16} className="text-[#0052FF]" /> Trending AI Agents
        </h3>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-12">
        {TRENDING_AGENTS.map((agent, index) => (
          <div key={index} className={`bg-slate-200 p-5 rounded-2xl border border-slate-300 shadow-sm flex flex-col justify-between group transition-all ${agent.border}`}>
            <div>
              <div className="flex justify-between items-start mb-4">
                <div className={`p-3 rounded-xl ${agent.bg} ${agent.color}`}>
                  {agent.icon}
                </div>
                <span className="text-[9px] font-bold bg-slate-300 text-slate-600 px-2 py-1 rounded-md uppercase tracking-widest border border-slate-400">{agent.creator}</span>
              </div>
              <h4 className="font-black text-lg text-slate-800 tracking-tight leading-none mb-2">{agent.name}</h4>
              <p className="text-xs text-slate-600 font-medium leading-relaxed">{agent.description}</p>
            </div>
          </div>
        ))}
      </div>

      {/* SECTION 3: BASE ACADEMY */}
      <div className="flex justify-between items-center mb-6 ml-2">
        <h3 className="text-sm font-bold text-[#0052FF] flex items-center gap-2 uppercase tracking-widest">
          <BookOpen size={16} className="text-[#0052FF]" /> Base Academy
        </h3>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-12">
        {/* Module 1 */}
        <div className="bg-slate-200 p-6 rounded-[20px] border border-slate-300 shadow-md flex flex-col items-center text-center hover:-translate-y-1 transition-all group">
          <div className="w-16 h-16 bg-[#0052FF]/10 text-[#0052FF] rounded-full flex items-center justify-center mb-4 group-hover:scale-110 transition-transform"><BookOpen size={32} /></div>
          <span className="text-[10px] font-bold text-slate-500 uppercase tracking-widest mb-1">5 Min Read</span>
          <h4 className="font-black text-xl text-[#0052FF] uppercase mb-2">Web3 Basics</h4>
          <p className="text-xs font-bold text-slate-600 mb-6 grow">Master wallet setup, bridge your first ETH, and understand how gas fees work on Layer 2.</p>
          <button onClick={() => setActiveModule('basics')} className="w-full py-3 bg-slate-300 text-[#0052FF] font-black rounded-xl border border-slate-400 group-hover:bg-[#0052FF] group-hover:text-white transition-colors flex justify-center items-center gap-2">Start Module <ArrowRight size={16} /></button>
        </div>

        {/* Module 2 */}
        <div className="bg-slate-200 p-6 rounded-[20px] border border-slate-300 shadow-md flex flex-col items-center text-center hover:-translate-y-1 transition-all group">
          <div className="w-16 h-16 bg-red-500/10 text-red-500 rounded-full flex items-center justify-center mb-4 group-hover:scale-110 transition-transform"><ShieldAlert size={32} /></div>
          <span className="text-[10px] font-bold text-slate-500 uppercase tracking-widest mb-1">8 Min Read</span>
          <h4 className="font-black text-xl text-red-500 uppercase mb-2">Scam Defense</h4>
          <p className="text-xs font-bold text-slate-600 mb-6 grow">Learn to read transaction signatures, identify fake websites, and protect your assets.</p>
          <button onClick={() => setActiveModule('security')} className="w-full py-3 bg-slate-300 text-red-500 font-black rounded-xl border border-slate-400 group-hover:bg-red-500 group-hover:text-white transition-colors flex justify-center items-center gap-2">Start Module <ArrowRight size={16} /></button>
        </div>

        {/* Module 3 */}
        <div className="bg-slate-200 p-6 rounded-[20px] border border-slate-300 shadow-md flex flex-col items-center text-center hover:-translate-y-1 transition-all group">
          <div className="w-16 h-16 bg-[#8A2BE2]/10 text-[#8A2BE2] rounded-full flex items-center justify-center mb-4 group-hover:scale-110 transition-transform"><Code size={32} /></div>
          <span className="text-[10px] font-bold text-slate-500 uppercase tracking-widest mb-1">15 Min Build</span>
          <h4 className="font-black text-xl text-[#8A2BE2] uppercase mb-2">Deploy a Contract</h4>
          <p className="text-xs font-bold text-slate-600 mb-6 grow">Write your first Solidity code, compile it, and deploy a custom token to Base.</p>
          <button onClick={() => setActiveModule('build')} className="w-full py-3 bg-slate-300 text-[#8A2BE2] font-black rounded-xl border border-slate-400 group-hover:bg-[#8A2BE2] group-hover:text-white transition-colors flex justify-center items-center gap-2">Start Module <ArrowRight size={16} /></button>
        </div>
      </div>

      {/* SECTION 4: THE MEGA ECOSYSTEM DIRECTORY */}
      <div className="flex justify-between items-center mb-6 ml-2">
        <h3 className="text-sm font-bold text-[#0052FF] flex items-center gap-2 uppercase tracking-widest">
          <Globe size={16} className="text-[#0052FF]" /> Explore the Ecosystem
        </h3>
        <span className="text-[10px] font-bold bg-slate-300 text-slate-600 px-3 py-1 rounded-full uppercase tracking-widest border border-slate-400">{ECOSYSTEM_PROJECTS.length} Verified Apps</span>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
        {ECOSYSTEM_PROJECTS.map((project, index) => (
          <a key={index} href={project.url} target="_blank" rel="noopener noreferrer" className={`bg-slate-200 p-5 rounded-2xl border border-slate-300 shadow-sm flex flex-col justify-between group transition-all hover:-translate-y-0.5 ${project.border}`}>
            <div>
              <div className="flex justify-between items-start mb-3">
                <div className={`p-3 rounded-xl ${project.bg} ${project.color} group-hover:scale-110 transition-transform`}>{project.icon}</div>
                <ExternalLink size={16} className="text-slate-400 group-hover:text-slate-700 transition-colors" />
              </div>
              <h4 className="font-black text-lg text-slate-800 tracking-tight leading-none mb-1">{project.name}</h4>
              <p className={`text-[9px] font-bold uppercase tracking-widest mb-3 ${project.color}`}>{project.category}</p>
              <p className="text-xs text-slate-600 font-medium leading-relaxed">{project.description}</p>
            </div>
          </a>
        ))}
      </div>

    </div>
  );
} 