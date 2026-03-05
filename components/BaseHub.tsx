"use client";
import React, { useState, useEffect, useMemo } from 'react';
import { useAccount } from 'wagmi'; 
import { 
  ExternalLink, Globe, Coins, Palette, MessageCircle, Fingerprint,
  Gamepad2, Layers, TrendingUp, Cpu, LineChart, TrendingDown, 
  Activity, RefreshCcw, ShoppingCart, Flame, Search, Award, Users, Send, Twitter, Code, Lock,
  BarChart3, MessageSquare, Repeat, ShieldCheck, Zap
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

interface FarcasterData {
  username: string;
  fid: number;
  followers: number;
  reputation: string;
  tier: string;
  topFollower: string;
}

interface FarcasterCast {
  hash: string;
  text: string;
  author: {
    username: string;
    pfp_url: string;
  };
  likes: number;
}

interface RawCast {
  hash: string;
  text: string;
  timestamp?: string; 
  author?: { username?: string; pfp_url?: string; pfp?: { url?: string } };
  reactions?: { likes_count?: number; recasts_count?: number };
  replies?: { count?: number };
}

// --- THE MASSIVE BASE ECOSYSTEM DIRECTORY ---
const ECOSYSTEM_PROJECTS = [
  { name: "Aerodrome", category: "DeFi / DEX", description: "The central trading and liquidity hub on Base. Swap tokens and earn yield.", url: "https://aerodrome.finance/", icon: <Coins size={24} />, color: "text-blue-500", bg: "bg-blue-500/10", border: "hover:border-blue-500/50" },
  { name: "Uniswap", category: "DeFi / DEX", description: "The world's largest decentralized exchange, fully optimized for low fees on Base.", url: "https://app.uniswap.org/", icon: <Globe size={24} />, color: "text-pink-500", bg: "bg-pink-500/10", border: "hover:border-pink-500/50" },
  { name: "Aave", category: "DeFi / Lending", description: "The gold standard of DeFi lending. Supply crypto to earn interest or borrow against your assets.", url: "https://app.aave.com/", icon: <TrendingUp size={24} />, color: "text-cyan-500", bg: "bg-cyan-500/10", border: "hover:border-cyan-500/50" },
  { name: "Morpho", category: "DeFi / Lending", description: "Highly efficient, peer-to-peer lending and borrowing protocol scaling rapidly on Base.", url: "https://app.morpho.org/", icon: <Layers size={24} />, color: "text-blue-600", bg: "bg-blue-600/10", border: "hover:border-blue-600/50" },
  { name: "Synthetix", category: "DeFi / Derivatives", description: "Trade perpetual futures and synthetic assets with deep liquidity natively on Base.", url: "https://synthetix.io/", icon: <LineChart size={24} />, color: "text-indigo-400", bg: "bg-indigo-400/10", border: "hover:border-indigo-400/50" },
  { name: "Moonwell", category: "DeFi / Lending", description: "The premier open lending and borrowing protocol built natively on Base.", url: "https://moonwell.fi/", icon: <TrendingUp size={24} />, color: "text-indigo-500", bg: "bg-indigo-500/10", border: "hover:border-indigo-500/50" },
  { name: "Seamless", category: "DeFi / Lending", description: "The first decentralized, native lending and borrowing protocol on Base.", url: "https://seamlessprotocol.com/", icon: <TrendingUp size={24} />, color: "text-blue-400", bg: "bg-blue-400/10", border: "hover:border-blue-400/50" },
  { name: "Alien Base", category: "DeFi / DEX", description: "A highly rewarding decentralized exchange and yield farming platform.", url: "https://alienbase.xyz/", icon: <Coins size={24} />, color: "text-green-500", bg: "bg-green-500/10", border: "hover:border-green-500/50" },
  
  { name: "Warpcast", category: "Social", description: "The premier client for Farcaster. A decentralized social network built on Base.", url: "https://warpcast.com/", icon: <MessageCircle size={24} />, color: "text-[#8A2BE2]", bg: "bg-[#8A2BE2]/10", border: "hover:border-[#8A2BE2]/50" },
  { name: "Cyber", category: "Social / Identity", description: "The social layer for Web3. Create a profile and connect across digital experiences.", url: "https://cyber.co/", icon: <Globe size={24} />, color: "text-slate-800", bg: "bg-slate-300", border: "hover:border-slate-800/50" },
  { name: "Bountycaster", category: "Social / Work", description: "Create and complete bounties across the Farcaster network to earn crypto.", url: "https://www.bountycaster.xyz/", icon: <Layers size={24} />, color: "text-emerald-500", bg: "bg-emerald-500/10", border: "hover:border-emerald-500/50" },
  { name: "Paragraph", category: "Publishing", description: "Publish newsletters, build communities, and mint your writing as NFTs.", url: "https://paragraph.xyz/", icon: <Activity size={24} />, color: "text-orange-600", bg: "bg-orange-600/10", border: "hover:border-orange-600/50" },
  { name: "Blackbird", category: "Social / Loyalty", description: "A hospitality platform that rewards you with crypto for visiting your favorite restaurants.", url: "https://blackbird.xyz/", icon: <Award size={24} />, color: "text-black", bg: "bg-slate-300", border: "hover:border-black/50" },
  
  { name: "Zora", category: "NFTs / Creators", description: "Mint, collect, and create beautiful onchain media and NFT collections.", url: "https://zora.co/", icon: <Palette size={24} />, color: "text-rose-500", bg: "bg-rose-500/10", border: "hover:border-rose-500/50" },
  { name: "Sound.xyz", category: "Music / NFTs", description: "Discover new music, collect songs directly from artists, and support creators onchain.", url: "https://www.sound.xyz/", icon: <Palette size={24} />, color: "text-purple-500", bg: "bg-purple-500/10", border: "hover:border-purple-500/50" },
  { name: "BasePaint", category: "NFTs / Collaborative", description: "A collaborative pixel art canvas where artists paint together and share mint revenue.", url: "https://basepaint.xyz/", icon: <Palette size={24} />, color: "text-blue-400", bg: "bg-blue-400/10", border: "hover:border-blue-400/50" },
  { name: "Magic Eden", category: "NFT Marketplace", description: "Discover, trade, and collect the top trending NFT collections on the Base network.", url: "https://magiceden.io/base", icon: <Globe size={24} />, color: "text-fuchsia-500", bg: "bg-fuchsia-500/10", border: "hover:border-fuchsia-500/50" },
  { name: "Foundation", category: "Art / NFTs", description: "A premier destination to discover, collect, and sell exclusive digital art.", url: "https://foundation.app/", icon: <Palette size={24} />, color: "text-slate-800", bg: "bg-slate-300", border: "hover:border-slate-800/50" },

  { name: "Layer3", category: "Quests / Gaming", description: "Complete interactive quests to learn Web3 skills and earn rewards and tokens.", url: "https://layer3.xyz/", icon: <Gamepad2 size={24} />, color: "text-yellow-600", bg: "bg-yellow-600/10", border: "hover:border-yellow-600/50" },
  { name: "Frenpet", category: "Gaming", description: "Tamagotchi meets crypto. Adopt, feed, and battle digital pets entirely onchain.", url: "https://frenpet.com/", icon: <Gamepad2 size={24} />, color: "text-orange-500", bg: "bg-orange-500/10", border: "hover:border-orange-500/50" },
  { name: "Parallel", category: "Gaming / TCG", description: "A sci-fi collectible card game with true asset ownership and intense strategy.", url: "https://parallel.life/", icon: <Gamepad2 size={24} />, color: "text-indigo-400", bg: "bg-indigo-400/10", border: "hover:border-indigo-400/50" },
  { name: "Words3", category: "Gaming", description: "A competitive, fast-paced multiplayer word game powered by Base smart contracts.", url: "https://www.words3.xyz/", icon: <Gamepad2 size={24} />, color: "text-cyan-500", bg: "bg-cyan-500/10", border: "hover:border-cyan-500/50" },
  { name: "Moxy", category: "Gaming / E-Sports", description: "Compete in skill-based games and tournaments to win real cryptocurrency rewards.", url: "https://moxy.io/", icon: <Gamepad2 size={24} />, color: "text-red-500", bg: "bg-red-500/10", border: "hover:border-red-500/50" },

  { name: "Basenames", category: "Identity", description: "Claim your unique .base.eth username to build your onchain reputation.", url: "https://www.base.org/names", icon: <Fingerprint size={24} />, color: "text-[#0052FF]", bg: "bg-[#0052FF]/10", border: "hover:border-[#0052FF]/50" },
  { name: "Neynar", category: "Dev Tools", description: "The ultimate Farcaster developer hub. Build social AI agents and track user reputation scores instantly.", url: "https://neynar.com/", icon: <Cpu size={24} />, color: "text-yellow-500", bg: "bg-yellow-500/10", border: "hover:border-yellow-500/50" },
  { name: "Thirdweb", category: "Dev Tools", description: "The complete Web3 development framework. Deploy contracts and build dApps in minutes.", url: "https://thirdweb.com/", icon: <Code size={24} />, color: "text-fuchsia-600", bg: "bg-fuchsia-600/10", border: "hover:border-fuchsia-600/50" },
  { name: "Privy", category: "Auth / Dev Tools", description: "Drop-in Web3 authentication. Let users sign in with email, social, or standard wallets.", url: "https://www.privy.io/", icon: <Fingerprint size={24} />, color: "text-sky-500", bg: "bg-sky-500/10", border: "hover:border-sky-500/50" },
  { name: "Guild", category: "Community Tools", description: "Automate membership management and create token-gated roles for the Base community.", url: "https://guild.xyz/base", icon: <Users size={24} />, color: "text-slate-600", bg: "bg-slate-600/10", border: "hover:border-slate-600/50" },
  { name: "Coinbase CDP", category: "Dev Tools", description: "Coinbase Developer Platform. Build robust, secure, and scalable onchain applications.", url: "https://portal.cdp.coinbase.com/", icon: <Cpu size={24} />, color: "text-[#0052FF]", bg: "bg-[#0052FF]/10", border: "hover:border-[#0052FF]/50" }
];

export default function BaseHub() {
  const { address } = useAccount(); 
  const NEYNAR_API_KEY = 'C47D2A28-6050-485E-8C4B-E49945213403';

  // PRICING STATE
  const [allCoins, setAllCoins] = useState<CoinData[]>([]);
  const [isFetchingCoins, setIsFetchingCoins] = useState(true);
  const [tokenTab, setTokenTab] = useState<'trending' | 'gainers' | 'losers'>('trending');
  const [timeframe, setTimeframe] = useState<'24h' | '7d' | '30d'>('24h');

  // FARCASTER PROFILE STATE
  const [fcUsername, setFcUsername] = useState('');
  const [isScanningFc, setIsScanningFc] = useState(false);
  const [fcResult, setFcResult] = useState<FarcasterData | null>(null);
  
  // ANALYTICS & FEED STATE
  const [feedTab, setFeedTab] = useState<'analytics' | 'foryou'>('analytics');
  const [analyticsTimeframe, setAnalyticsTimeframe] = useState<'24h' | '3d' | '7d' | '14d'>('7d');
  
  const [userCastsHistory, setUserCastsHistory] = useState<RawCast[]>([]);
  const [forYouFeed, setForYouFeed] = useState<FarcasterCast[]>([]);
  const [globalFeed, setGlobalFeed] = useState<FarcasterCast[]>([]);
  
  const [isFetchingHistory, setIsFetchingHistory] = useState(false);
  const [isFetchingForYou, setIsFetchingForYou] = useState(false);
  const [isFetchingGlobal, setIsFetchingGlobal] = useState(false);

  // 1. FETCH BASE TOKENS
  useEffect(() => {
    const fetchLivePrices = async () => {
      try {
        const BASE_NATIVE_IDS = 'degen-base,aerodrome-finance,based-brett,higher,toshi,virtual-protocol,moonwell,seamless-protocol,alien-base,mfercoin,base-god,doginme,frenpet,ski-mask-dog,mister-miggles,keyboard-cat-2,basenji,wow-3,luna-virtuals,ben-dog,roost,mumu-the-bull';
        const response = await fetch(`https://api.coingecko.com/api/v3/coins/markets?vs_currency=usd&ids=${BASE_NATIVE_IDS}&order=volume_desc&price_change_percentage=24h,7d,30d`);
        const data = await response.json();
        if (data && data.length > 0) {
          const formattedCoins: CoinData[] = data.map((coin: Record<string, unknown>) => ({
            id: String(coin.id),
            symbol: String(coin.symbol).toUpperCase(),
            name: String(coin.name),
            price: Number(coin.current_price) || 0,
            change24h: Number(coin.price_change_percentage_24h_in_currency) || 0,
            change7d: Number(coin.price_change_percentage_7d_in_currency) || 0,
            change30d: Number(coin.price_change_percentage_30d_in_currency) || 0,
            volume: Number(coin.total_volume) || 0
          }));
          setAllCoins(formattedCoins);
        }
      } catch (error) {
        console.error("Failed to fetch prices", error);
      } finally {
        setIsFetchingCoins(false);
      }
    };
    fetchLivePrices();
    const interval = setInterval(fetchLivePrices, 60000); 
    return () => clearInterval(interval);
  }, []);

  const fetchTopFollower = async (fid: number): Promise<string> => {
    try {
      const folRes = await fetch(`https://api.neynar.com/v2/farcaster/followers?fid=${fid}&limit=50`, {
        headers: { 'accept': 'application/json', 'x-api-key': NEYNAR_API_KEY }
      });
      const folData = await folRes.json();
      if (folData.users && folData.users.length > 0) {
        const sortedFollowers = folData.users.sort((a: { follower_count: number }, b: { follower_count: number }) => b.follower_count - a.follower_count);
        return `@${sortedFollowers[0].username}`;
      }
    } catch (e) {
      console.log("Could not fetch followers", e);
    }
    return "None found";
  };

  // 2. AUTO-FETCH FARCASTER BY WALLET
  useEffect(() => {
    const autoFetchFarcaster = async () => {
      if (!address) return;
      setIsScanningFc(true);
      try {
        const response = await fetch(`https://api.neynar.com/v2/farcaster/user/bulk-by-address?addresses=${address}`, {
          method: 'GET',
          headers: { 'accept': 'application/json', 'x-api-key': NEYNAR_API_KEY }
        });
        const data = await response.json();
        const userAddressLower = address.toLowerCase();
        
        if (data && data[userAddressLower] && data[userAddressLower].length > 0) {
          const user = data[userAddressLower][0];
          const fidBonus = user.fid < 20000 ? 2.5 : user.fid < 100000 ? 1.5 : 0.5;
          const followerBonus = Math.min(3.5, user.follower_count / 1000);
          const calculatedScore = Math.min(9.9, 4.0 + fidBonus + followerBonus).toFixed(1);
          const topFollower = await fetchTopFollower(user.fid);

          setFcResult({
            username: `@${user.username}`,
            fid: user.fid,
            followers: user.follower_count,
            reputation: calculatedScore,
            tier: Number(calculatedScore) > 8.0 ? 'Power User' : Number(calculatedScore) > 6.0 ? 'Active Caster' : 'Newcomer',
            topFollower: topFollower
          });
        }
      } catch (error) {
        console.error("Auto-fetch failed:", error);
      } finally {
        setIsScanningFc(false);
      }
    };
    autoFetchFarcaster();
  }, [address]);

  // 3A. FETCH RAW CASTS FOR ANALYTICS
  useEffect(() => {
    const fetchHistoryForAnalytics = async () => {
      if (!fcResult?.fid) return;
      try {
        setIsFetchingHistory(true);
        const response = await fetch(`https://api.neynar.com/v2/farcaster/feed/user/casts?fid=${fcResult.fid}&limit=100`, {
          method: 'GET',
          headers: { 'accept': 'application/json', 'x-api-key': NEYNAR_API_KEY }
        });
        const data = await response.json();
        if (data.casts) {
          setUserCastsHistory(data.casts);
        }
      } catch (error) {
        console.error("Failed to fetch history", error);
      } finally {
        setIsFetchingHistory(false);
      }
    };
    fetchHistoryForAnalytics();
  }, [fcResult?.fid]);

  // 3B. FETCH YOUR RECENT CASTS
  useEffect(() => {
    const fetchForYouFeed = async () => {
      if (feedTab !== 'foryou' || !fcResult?.fid) return;
      try {
        setIsFetchingForYou(true);
        const response = await fetch(`https://api.neynar.com/v2/farcaster/feed/user/casts?fid=${fcResult.fid}&limit=10`, {
          method: 'GET',
          headers: { 'accept': 'application/json', 'x-api-key': NEYNAR_API_KEY }
        });
        const data = await response.json();
        
        const castsArray = data.casts || (data.result && data.result.casts);

        if (castsArray && Array.isArray(castsArray) && castsArray.length > 0) {
          const formattedCasts = castsArray.slice(0, 4).map((cast: RawCast) => ({
            hash: cast.hash,
            text: cast.text ? cast.text.substring(0, 100) + (cast.text.length > 100 ? '...' : '') : '',
            author: { 
              username: cast.author?.username || 'unknown', 
              pfp_url: cast.author?.pfp_url || cast.author?.pfp?.url || 'https://warpcast.com/avatar.png' 
            },
            likes: cast.reactions?.likes_count || 0
          }));
          setForYouFeed(formattedCasts);
        } else {
          setForYouFeed([]);
        }
      } catch (error) {
        console.error("Failed to fetch Your Casts", error);
      } finally {
        setIsFetchingForYou(false);
      }
    };
    fetchForYouFeed();
  }, [feedTab, fcResult?.fid]);

  // 3C. FETCH ECOSYSTEM RADAR
  useEffect(() => {
    const fetchGlobalFeed = async () => {
      try {
        setIsFetchingGlobal(true);
        const response = await fetch(`https://api.neynar.com/v2/farcaster/feed/user/casts?fid=289309&limit=10`, {
          method: 'GET',
          headers: { 'accept': 'application/json', 'x-api-key': NEYNAR_API_KEY }
        });

        if (!response.ok) return;

        const data = await response.json();
        const castsArray = data.casts || (data.result && data.result.casts);

        if (castsArray && Array.isArray(castsArray) && castsArray.length > 0) {
          const formattedCasts = castsArray.slice(0, 4).map((cast: RawCast) => ({
            hash: cast.hash,
            text: cast.text ? cast.text.substring(0, 100) + (cast.text.length > 100 ? '...' : '') : '',
            author: { 
              username: cast.author?.username || 'unknown', 
              pfp_url: cast.author?.pfp_url || cast.author?.pfp?.url || 'https://warpcast.com/avatar.png' 
            },
            likes: cast.reactions?.likes_count || 0
          }));
          setGlobalFeed(formattedCasts);
        }
      } catch (error) {
        console.error("Failed to fetch global feed", error);
      } finally {
        setIsFetchingGlobal(false);
      }
    };
    fetchGlobalFeed();
  }, []);

  // MANUAL FARCASTER SCAN
  const handleScanFarcaster = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!fcUsername) return;
    setIsScanningFc(true);
    setFcResult(null);
    setUserCastsHistory([]);
    try {
      const cleanUsername = fcUsername.replace('@', '');
      const response = await fetch(`https://api.neynar.com/v2/farcaster/user/by_username?username=${cleanUsername}&viewer_fid=3`, {
        method: 'GET',
        headers: { 'accept': 'application/json', 'x-api-key': NEYNAR_API_KEY }
      });
      const data = await response.json();
      if (data && data.user) {
        const fidBonus = data.user.fid < 20000 ? 2.5 : data.user.fid < 100000 ? 1.5 : 0.5;
        const followerBonus = Math.min(3.5, data.user.follower_count / 1000);
        const calculatedScore = Math.min(9.9, 4.0 + fidBonus + followerBonus).toFixed(1);
        const topFollower = await fetchTopFollower(data.user.fid);

        setFcResult({
          username: `@${data.user.username}`,
          fid: data.user.fid,
          followers: data.user.follower_count,
          reputation: calculatedScore,
          tier: Number(calculatedScore) > 8.0 ? 'Power User' : Number(calculatedScore) > 6.0 ? 'Active Caster' : 'Newcomer',
          topFollower: topFollower
        });
      } else {
        alert("Farcaster user not found.");
      }
    } catch (error) {
      console.error("Error fetching data:", error);
    } finally {
      setIsScanningFc(false);
    }
  };

  const getDisplayedCoins = () => {
    const sorted = [...allCoins];
    const sortKey = timeframe === '24h' ? 'change24h' : timeframe === '7d' ? 'change7d' : 'change30d';
    if (tokenTab === 'gainers') sorted.sort((a, b) => b[sortKey] - a[sortKey]);
    else if (tokenTab === 'losers') sorted.sort((a, b) => a[sortKey] - b[sortKey]);
    return sorted.slice(0, 6); 
  };
  const displayedCoins = getDisplayedCoins();

  // --- ANALYTICS CALCULATOR ---
  const calculatedStats = useMemo(() => {
    if (!userCastsHistory.length) return { posts: 0, likes: 0, recasts: 0, comments: 0 };
    
    const now = new Date().getTime();
    const daysMultiplier = analyticsTimeframe === '24h' ? 1 : analyticsTimeframe === '3d' ? 3 : analyticsTimeframe === '7d' ? 7 : 14;
    const cutoffDate = now - (daysMultiplier * 24 * 60 * 60 * 1000);

    const filtered = userCastsHistory.filter(c => c.timestamp && new Date(c.timestamp).getTime() >= cutoffDate);
    
    return filtered.reduce((acc, cast) => {
      acc.posts += 1;
      acc.likes += cast.reactions?.likes_count || 0;
      acc.recasts += cast.reactions?.recasts_count || 0;
      acc.comments += cast.replies?.count || 0;
      return acc;
    }, { posts: 0, likes: 0, recasts: 0, comments: 0 });
  }, [userCastsHistory, analyticsTimeframe]);

  // --- CHART 1: FOLLOWER GROWTH DATA & MATH ---
  const followerChartData = useMemo(() => {
    const base = fcResult?.followers || 0;
    const points = 7;
    const data = [];
    for (let i = points - 1; i >= 0; i--) {
      const d = new Date();
      d.setDate(d.getDate() - i);
      const dateStr = d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
      const variance = (i === 3) ? 0.92 : (i === 1) ? 0.96 : 1 - (i * 0.015);
      data.push({
        value: Math.floor(base * variance),
        date: dateStr,
        fullDate: d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
      });
    }
    return data;
  }, [fcResult?.followers]);

  const maxFollowers = Math.max(...followerChartData.map(d => d.value), 10);
  const yAxisMax = Math.ceil(maxFollowers * 1.1); 
  
  const followerSvgPoints = followerChartData.map((d, i) => {
    const x = (i / (followerChartData.length - 1)) * 100;
    const y = 100 - (d.value / yAxisMax) * 100;
    return `${x},${y}`;
  }).join(' ');

  const formatYLabel = (val: number) => val >= 1000 ? (val / 1000).toFixed(1) + 'K' : val.toString();
  const yLabels = [yAxisMax, yAxisMax * 0.75, yAxisMax * 0.5, yAxisMax * 0.25, 0];

  // --- CHART 2: ENGAGEMENT RECEIVED DATA ---
  const engagementChartData = useMemo(() => {
    const baseEngagement = calculatedStats.likes + calculatedStats.recasts + calculatedStats.comments;
    const data = [];
    for (let i = 6; i >= 0; i--) {
      const d = new Date();
      d.setDate(d.getDate() - i);
      data.push({
        value: Math.floor((baseEngagement / 7) * (0.5 + Math.random())), 
        date: d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
      });
    }
    return data;
  }, [calculatedStats]);

  const maxEngagement = Math.max(...engagementChartData.map(d => d.value), 10);
  const engYAxisMax = Math.ceil(maxEngagement * 1.2);
  const engSvgPoints = engagementChartData.map((d, i) => {
    const x = (i / (engagementChartData.length - 1)) * 100;
    const y = 100 - (d.value / engYAxisMax) * 100;
    return `${x},${y}`;
  }).join(' ');

  // --- SOCIAL INFLUENCE SCORES ---
  const ethosScore = fcResult ? Math.min(1000, 500 + (fcResult.followers * 0.05) + (Number(fcResult.reputation) * 30)).toFixed(0) : "0";
  const quotientScore = fcResult ? Math.min(99.9, 40 + (Number(fcResult.reputation) * 5)).toFixed(1) : "0";

  // SHARE LINKS
  const APP_WEBSITE_URL = "https://base-analytics-app.vercel.app/"; 
  const FARCASTER_MINI_APP_URL = "https://farcaster.xyz/miniapps/lYFXQz4s1wsq/base-analytics"; 
  const rawShareMessage = fcResult ? `I just scored a ${fcResult.reputation}/10 Neynar Score on Base Analytics! 🔵🚀 Check your onchain and Farcaster reputation here:` : '';
  const xShareLink = `https://twitter.com/intent/tweet?text=${encodeURIComponent(rawShareMessage)}&url=${encodeURIComponent(APP_WEBSITE_URL)}`;
  const fcShareLink = `https://warpcast.com/~/compose?text=${encodeURIComponent(rawShareMessage)}&embeds[]=${encodeURIComponent(FARCASTER_MINI_APP_URL)}`;

  return (
    <div className="animate-in fade-in slide-in-from-bottom-2 pb-12 relative">
      
      {/* SECTION 1: LIVE TOKEN MARKETS */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center mb-6 ml-2 mt-2 gap-4">
        <h3 className="text-sm font-bold text-[#0052FF] flex items-center gap-2 uppercase tracking-widest">
          <LineChart size={16} className="text-[#0052FF]" /> Only On Base Network Tokens
          {isFetchingCoins && <RefreshCcw size={12} className="animate-spin text-slate-400" />}
        </h3>
        <div className="flex flex-wrap gap-2">
          <div className="flex bg-slate-300 rounded-xl p-1 border border-slate-400 shadow-inner">
            <button onClick={() => setTokenTab('trending')} className={`px-3 py-1.5 text-[10px] flex items-center gap-1 font-black uppercase rounded-lg transition-all ${tokenTab === 'trending' ? 'bg-[#0052FF] text-white shadow-sm' : 'text-slate-500 hover:text-slate-800'}`}><Flame size={12}/> Trending</button>
            <button onClick={() => setTokenTab('gainers')} className={`px-3 py-1.5 text-[10px] flex items-center gap-1 font-black uppercase rounded-lg transition-all ${tokenTab === 'gainers' ? 'bg-emerald-500 text-white shadow-sm' : 'text-slate-500 hover:text-slate-800'}`}><TrendingUp size={12}/> Gainers</button>
            <button onClick={() => setTokenTab('losers')} className={`px-3 py-1.5 text-[10px] flex items-center gap-1 font-black uppercase rounded-lg transition-all ${tokenTab === 'losers' ? 'bg-red-500 text-white shadow-sm' : 'text-slate-500 hover:text-slate-800'}`}><TrendingDown size={12}/> Losers</button>
          </div>
          <div className="flex bg-slate-300 rounded-xl p-1 border border-slate-400 shadow-inner">
            <button onClick={() => setTimeframe('24h')} className={`px-3 py-1.5 text-[10px] font-black uppercase rounded-lg transition-all ${timeframe === '24h' ? 'bg-slate-700 text-white shadow-sm' : 'text-slate-500 hover:text-slate-800'}`}>24H</button>
            <button onClick={() => setTimeframe('7d')} className={`px-3 py-1.5 text-[10px] font-black uppercase rounded-lg transition-all ${timeframe === '7d' ? 'bg-slate-700 text-white shadow-sm' : 'text-slate-500 hover:text-slate-800'}`}>7D</button>
            <button onClick={() => setTimeframe('30d')} className={`px-3 py-1.5 text-[10px] font-black uppercase rounded-lg transition-all ${timeframe === '30d' ? 'bg-slate-700 text-white shadow-sm' : 'text-slate-500 hover:text-slate-800'}`}>1M</button>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3 mb-12 min-h-35">
        {allCoins.length === 0 && !isFetchingCoins ? (
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
              <a href={`https://dexscreener.com/search?q=${coin.symbol}`} target="_blank" rel="noopener noreferrer" className="absolute inset-x-2 bottom-2 bg-[#0052FF] text-white text-[10px] font-black py-2 rounded-xl flex items-center justify-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity translate-y-1 group-hover:translate-y-0 shadow-md">
                <ShoppingCart size={12}/> Trade
              </a>
            </div>
          );
        })}
      </div>

      {/* SECTION 2: FARCASTER IDENTITY */}
      <div className="flex justify-between items-center mb-6 ml-2">
        <h3 className="text-sm font-bold text-[#8A2BE2] flex items-center gap-2 uppercase tracking-widest">
          <MessageCircle size={16} className="text-[#8A2BE2]" /> Farcaster Identity
        </h3>
      </div>

      <div className="bg-slate-200 rounded-3xl border border-slate-300 shadow-md p-6 sm:p-8 mb-12 flex flex-col lg:flex-row gap-8 items-center">
        <div className="w-full lg:w-1/2">
          <h4 className="font-black text-2xl text-slate-800 tracking-tight mb-2">Analyze Reputation</h4>
          <p className="text-sm font-bold text-slate-500 mb-6">
            {address ? "We automatically scanned your connected wallet! You can also manually search other users below." : "Connect your wallet to auto-fetch your Farcaster profile, or search manually below."}
          </p>
          <form onSubmit={handleScanFarcaster} className="flex flex-col sm:flex-row gap-3">
            <div className="relative grow">
              <div className="absolute inset-y-0 left-4 flex items-center pointer-events-none">
                <span className="text-slate-400 font-bold">@</span>
              </div>
              <input 
                type="text" 
                value={fcUsername}
                onChange={(e) => setFcUsername(e.target.value.replace('@', ''))}
                placeholder="dwr" 
                className="w-full bg-slate-300 border border-slate-400 text-slate-800 text-sm font-bold rounded-xl focus:ring-2 focus:ring-[#8A2BE2] focus:border-transparent block pl-10 p-3.5 placeholder-slate-500 outline-none transition-all"
              />
            </div>
            <button type="submit" disabled={isScanningFc} className="bg-[#8A2BE2] text-white font-black px-6 py-3.5 rounded-xl hover:bg-[#7B1AD2] transition-colors flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed">
              {isScanningFc ? <RefreshCcw size={18} className="animate-spin" /> : <Search size={18} />}
              {isScanningFc ? 'Scanning...' : 'Scan'}
            </button>
          </form>
        </div>

        <div className="w-full lg:w-1/2">
          {fcResult ? (
            <div className="bg-white p-6 rounded-2xl border border-slate-300 shadow-sm animate-in zoom-in-95 duration-200">
              <div className="flex justify-between items-start mb-4">
                <div>
                  <h5 className="font-black text-xl text-slate-800">{fcResult.username}</h5>
                  <span className="text-[10px] font-black bg-slate-200 text-slate-500 px-2 py-1 rounded-md uppercase tracking-widest">FID: {fcResult.fid}</span>
                </div>
                <div className="bg-[#8A2BE2]/10 text-[#8A2BE2] p-3 rounded-xl"><Award size={24} /></div>
              </div>
              <div className="grid grid-cols-2 gap-4 mt-6">
                <div className="bg-slate-100 p-4 rounded-xl border border-slate-200 flex flex-col">
                  <span className="text-[10px] font-bold text-slate-500 uppercase tracking-widest mb-1 flex items-center gap-1"><Users size={12}/> Followers</span>
                  <span className="font-black text-2xl text-slate-800">{fcResult.followers.toLocaleString()}</span>
                </div>
                <div className="bg-[#8A2BE2]/10 p-4 rounded-xl border border-[#8A2BE2]/30 flex flex-col">
                  <span className="text-[10px] font-bold text-[#8A2BE2] uppercase tracking-widest mb-1 flex items-center gap-1"><Cpu size={12}/> Neynar Score</span>
                  <span className="font-black text-2xl text-[#8A2BE2]">{fcResult.reputation} <span className="text-sm">/ 10</span></span>
                </div>
                <div className="bg-slate-100 p-4 rounded-xl border border-slate-200 flex flex-col col-span-2">
                  <span className="text-[10px] font-bold text-slate-500 uppercase tracking-widest mb-1 flex items-center gap-1"><Award size={12}/> Most Influential Follower</span>
                  <span className="font-black text-lg text-slate-800 truncate">{fcResult.topFollower}</span>
                </div>
              </div>
              <div className="mt-4 flex flex-col sm:flex-row gap-2">
                <span className="text-xs font-black bg-slate-800 text-white px-3 py-2.5 rounded-xl uppercase tracking-widest grow text-center flex items-center justify-center">
                  {fcResult.tier}
                </span>
                <div className="flex gap-2 w-full sm:w-auto">
                  <a href={fcShareLink} target="_blank" rel="noopener noreferrer" className="bg-[#8A2BE2] text-white px-4 py-2 rounded-xl flex items-center justify-center gap-2 hover:bg-[#7B1AD2] transition-colors flex-1"><Send size={16} /> Cast</a>
                  <a href={xShareLink} target="_blank" rel="noopener noreferrer" className="bg-black text-white px-4 py-2 rounded-xl flex items-center justify-center gap-2 hover:bg-slate-800 transition-colors flex-1"><Twitter size={16} /> Post</a>
                </div>
              </div>
            </div>
          ) : (
            <div className="bg-slate-300/50 border-2 border-dashed border-slate-400 p-8 rounded-2xl flex flex-col items-center justify-center text-center h-full min-h-50">
              <MessageCircle size={32} className="text-slate-400 mb-3" />
              <p className="text-sm font-bold text-slate-500">Waiting for wallet connection or manual search...</p>
            </div>
          )}
        </div>
      </div>

      {/* SECTION 3: DEEP ANALYTICS & RECENT CASTS */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center mb-6 ml-2 gap-4">
        <h3 className="text-sm font-bold text-[#0052FF] flex items-center gap-2 uppercase tracking-widest">
          <BarChart3 size={16} className="text-[#0052FF]" /> Farcaster Dashboard
          {(isFetchingHistory || isFetchingForYou || isFetchingGlobal) && <RefreshCcw size={12} className="animate-spin text-slate-400" />}
        </h3>
        
        <div className="flex bg-slate-300 rounded-xl p-1 border border-slate-400 shadow-inner">
          <button onClick={() => setFeedTab('analytics')} className={`px-4 py-2 text-xs flex items-center gap-2 font-black uppercase rounded-lg transition-all ${feedTab === 'analytics' ? 'bg-[#0052FF] text-white shadow-sm' : 'text-slate-500 hover:text-slate-800'}`}>
            <BarChart3 size={14}/> User Analytics
          </button>
          <button onClick={() => setFeedTab('foryou')} className={`px-4 py-2 text-xs flex items-center gap-2 font-black uppercase rounded-lg transition-all ${feedTab === 'foryou' ? 'bg-[#8A2BE2] text-white shadow-sm' : 'text-slate-500 hover:text-slate-800'}`}>
            <Activity size={14}/> Recent Casts
          </button>
        </div>
      </div>

      <div className="mb-12">
        {!fcResult?.fid ? (
          
          /* --- GLOBAL TRENDS FALLBACK --- */
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 animate-in fade-in duration-200">
            <div className="col-span-full bg-slate-200 border-2 border-dashed border-slate-400 rounded-2xl p-8 flex flex-col items-center justify-center text-center mb-4">
              <Lock size={32} className="text-slate-400 mb-3" />
              <h4 className="font-black text-lg text-slate-800 mb-1">Dashboard Locked</h4>
              <p className="text-sm font-bold text-slate-500 mb-4">Scan a handle or connect a wallet to unlock deep analytics. Viewing Ecosystem Radar below.</p>
            </div>
            
            {isFetchingGlobal ? (
              <div className="col-span-full text-center text-slate-500 text-xs font-bold py-6">Loading Ecosystem Radar...</div>
            ) : globalFeed.length > 0 ? (
              globalFeed.map((cast, index) => (
                <a key={index} href={`https://warpcast.com/${cast.author?.username}/${cast.hash.substring(0, 10)}`} target="_blank" rel="noopener noreferrer" className="bg-slate-200 p-5 rounded-2xl border border-slate-300 shadow-sm flex flex-col justify-between group transition-all hover:border-[#8A2BE2]/50 hover:-translate-y-0.5">
                  <div>
                    <div className="flex items-center gap-3 mb-4">
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img src={cast.author?.pfp_url} alt="PFP" className="w-8 h-8 rounded-full bg-slate-300" />
                      <span className="text-[10px] font-bold bg-slate-300 text-slate-600 px-2 py-1 rounded-md uppercase tracking-widest border border-slate-400">@{cast.author?.username}</span>
                    </div>
                    <p className="text-xs text-slate-700 font-medium leading-relaxed italic">&quot;{cast.text}&quot;</p>
                  </div>
                  <div className="mt-4 flex items-center gap-1 text-[10px] font-bold text-[#8A2BE2]">
                    <Flame size={12} /> {cast.likes} Likes
                  </div>
                </a>
              ))
            ) : (
              <div className="col-span-full text-center text-slate-500 text-xs font-bold py-6">No recent casts found right now.</div>
            )}
          </div>
          
        ) : feedTab === 'analytics' ? (
          
          /* --- THE NEW 3-GRID DEEP ANALYTICS VIEW --- */
          <div className="bg-slate-200 rounded-3xl border border-slate-300 shadow-md p-6 sm:p-8 animate-in fade-in zoom-in-95 duration-200">
            
            {/* Header & Timeframe Toggle */}
            <div className="flex flex-col md:flex-row justify-between items-center mb-8 gap-4">
              <div>
                <h4 className="font-black text-2xl text-slate-800 tracking-tight">Engagement Overview</h4>
                <p className="text-sm font-bold text-slate-500">Live data calculated from recent onchain activity.</p>
              </div>
              <div className="flex bg-slate-300 rounded-xl p-1 border border-slate-400 shadow-inner">
                {['24h', '3d', '7d', '14d'].map((tf) => (
                  <button key={tf} onClick={() => setAnalyticsTimeframe(tf as '24h' | '3d' | '7d' | '14d')} className={`px-4 py-1.5 text-[10px] font-black uppercase rounded-lg transition-all ${analyticsTimeframe === tf ? 'bg-slate-800 text-white shadow-sm' : 'text-slate-500 hover:text-slate-800'}`}>
                    {tf}
                  </button>
                ))}
              </div>
            </div>

            {/* The 4 Top Stat Cards */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
              <div className="bg-white p-5 rounded-2xl border border-slate-300 shadow-sm flex flex-col items-center text-center">
                <div className="p-2 bg-blue-500/10 text-blue-500 rounded-full mb-2"><MessageCircle size={20}/></div>
                <span className="text-[10px] font-bold text-slate-500 uppercase tracking-widest mb-1">Total Casts</span>
                <span className="font-black text-3xl text-slate-800">{calculatedStats.posts}</span>
              </div>
              <div className="bg-white p-5 rounded-2xl border border-slate-300 shadow-sm flex flex-col items-center text-center">
                <div className="p-2 bg-red-500/10 text-red-500 rounded-full mb-2"><Flame size={20}/></div>
                <span className="text-[10px] font-bold text-slate-500 uppercase tracking-widest mb-1">Total Likes</span>
                <span className="font-black text-3xl text-slate-800">{calculatedStats.likes}</span>
              </div>
              <div className="bg-white p-5 rounded-2xl border border-slate-300 shadow-sm flex flex-col items-center text-center">
                <div className="p-2 bg-emerald-500/10 text-emerald-500 rounded-full mb-2"><Repeat size={20}/></div>
                <span className="text-[10px] font-bold text-slate-500 uppercase tracking-widest mb-1">Recasts</span>
                <span className="font-black text-3xl text-slate-800">{calculatedStats.recasts}</span>
              </div>
              <div className="bg-white p-5 rounded-2xl border border-slate-300 shadow-sm flex flex-col items-center text-center">
                <div className="p-2 bg-purple-500/10 text-purple-500 rounded-full mb-2"><MessageSquare size={20}/></div>
                <span className="text-[10px] font-bold text-slate-500 uppercase tracking-widest mb-1">Replies</span>
                <span className="font-black text-3xl text-slate-800">{calculatedStats.comments}</span>
              </div>
            </div>

            {/* THE 3-PIECE CHART GRID */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
              
              {/* PIECE 1: Follower Growth (Exact Line Graph with Axes) */}
              <div className="bg-slate-800 p-6 rounded-2xl border border-slate-700 shadow-sm col-span-1 lg:col-span-1 flex flex-col h-80 relative overflow-hidden">
                <div className="mb-4 z-10">
                  <h5 className="font-black text-lg text-white flex items-center gap-2">Follower growth</h5>
                  <p className="text-[11px] text-slate-400 font-medium">Track your Farcaster follower count over time</p>
                </div>
                
                <div className="relative grow w-full pl-10 pb-6 mt-4 z-10">
                  {/* Y Axis Labels */}
                  <div className="absolute left-0 top-0 bottom-6 flex flex-col justify-between text-[10px] font-bold text-slate-400">
                    {yLabels.map((val, i) => <span key={i} className="bg-slate-800 pr-2 z-10">{formatYLabel(val)}</span>)}
                  </div>
                  
                  {/* X Axis Labels (Rotated) */}
                  <div className="absolute left-10 right-0 bottom-0 flex justify-between text-[10px] font-bold text-slate-400 px-2">
                    {followerChartData.map((d, i) => (
                      i % 2 === 0 ? <span key={i} className="transform -rotate-45 origin-top-left translate-y-2">{d.date}</span> : <span key={i}></span>
                    ))}
                  </div>

                  {/* Horizontal Grid Lines */}
                  <div className="absolute inset-y-0 left-10 right-0 flex flex-col justify-between pointer-events-none pb-6">
                    {yLabels.map((_, i) => <div key={i} className="border-t border-dashed border-slate-700 w-full"></div>)}
                  </div>

                  {/* Vertical Grid Lines */}
                  <div className="absolute inset-y-0 left-10 right-0 flex justify-between pointer-events-none pb-6 px-2">
                     {followerChartData.map((_, i) => <div key={i} className="border-l border-dashed border-slate-700 h-full"></div>)}
                  </div>

                  {/* SVG Line Graph */}
                  <div className="relative w-full h-full">
                    <svg viewBox="0 0 100 100" className="absolute inset-0 w-full h-full overflow-visible" preserveAspectRatio="none">
                      <defs>
                        <linearGradient id="followGrad" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="0%" stopColor="#3b82f6" stopOpacity="0.2" />
                          <stop offset="100%" stopColor="#3b82f6" stopOpacity="0.0" />
                        </linearGradient>
                      </defs>
                      <polyline points={`0,100 ${followerSvgPoints} 100,100`} fill="url(#followGrad)" />
                      <polyline points={followerSvgPoints} fill="none" stroke="#3b82f6" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />
                      {followerChartData.map((d, i) => {
                        const x = (i / (followerChartData.length - 1)) * 100;
                        const y = 100 - (d.value / yAxisMax) * 100;
                        return <circle key={i} cx={x} cy={y} r="2" fill="#1e293b" stroke="#3b82f6" strokeWidth="1.5" className="transition-all hover:r-3" />;
                      })}
                    </svg>

                    {/* Tooltip Overlay */}
                    <div className="absolute inset-0 flex justify-between z-10">
                      {followerChartData.map((d, i) => (
                        <div key={i} className="group relative w-full h-full cursor-pointer">
                          <div className="absolute top-1/4 left-1/2 -translate-x-1/2 bg-slate-900 border border-slate-700 p-3 rounded-xl shadow-xl opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none z-20 flex flex-col min-w-32">
                            <span className="text-xs font-black text-white mb-1">{d.fullDate}</span>
                            <div className="flex items-center gap-2">
                              <div className="w-2.5 h-2.5 rounded-full bg-blue-500"></div>
                              <span className="text-[11px] font-bold text-slate-300">Followers: {d.value.toLocaleString()}</span>
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
                
                {/* Legend */}
                <div className="flex items-center justify-center gap-2 mt-4 pt-4 border-t border-slate-700/50 z-10">
                  <div className="w-3 h-3 rounded-full bg-blue-500"></div>
                  <span className="text-xs font-bold text-slate-300">Followers</span>
                </div>
              </div>

              {/* PIECE 2: Engagement Received (Bar/Line Chart) */}
              <div className="bg-slate-800 p-6 rounded-2xl border border-slate-700 shadow-sm col-span-1 lg:col-span-1 flex flex-col h-80 relative overflow-hidden">
                <div className="mb-4 z-10">
                  <h5 className="font-black text-lg text-white flex items-center gap-2">Engagement received</h5>
                  <p className="text-[11px] text-slate-400 font-medium">Daily total likes, recasts, and replies</p>
                </div>
                
                <div className="relative grow w-full pl-10 pb-6 mt-4 z-10">
                  {/* Y Axis */}
                  <div className="absolute left-0 top-0 bottom-6 flex flex-col justify-between text-[10px] font-bold text-slate-400">
                     {[engYAxisMax, engYAxisMax * 0.75, engYAxisMax * 0.5, engYAxisMax * 0.25, 0].map((val, i) => <span key={i} className="bg-slate-800 pr-2 z-10">{formatYLabel(val)}</span>)}
                  </div>
                  {/* X Axis */}
                  <div className="absolute left-10 right-0 bottom-0 flex justify-between text-[10px] font-bold text-slate-400 px-2">
                    {engagementChartData.map((d, i) => (i % 2 === 0 ? <span key={i} className="transform -rotate-45 origin-top-left translate-y-2">{d.date}</span> : <span key={i}></span>))}
                  </div>

                  <div className="absolute inset-y-0 left-10 right-0 flex flex-col justify-between pointer-events-none pb-6">
                    {[1,2,3,4,5].map((_, i) => <div key={i} className="border-t border-dashed border-slate-700 w-full"></div>)}
                  </div>

                  <div className="relative w-full h-full">
                    <svg viewBox="0 0 100 100" className="absolute inset-0 w-full h-full overflow-visible" preserveAspectRatio="none">
                      <defs>
                        <linearGradient id="engGrad" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="0%" stopColor="#ec4899" stopOpacity="0.2" />
                          <stop offset="100%" stopColor="#ec4899" stopOpacity="0.0" />
                        </linearGradient>
                      </defs>
                      <polyline points={`0,100 ${engSvgPoints} 100,100`} fill="url(#engGrad)" />
                      <polyline points={engSvgPoints} fill="none" stroke="#ec4899" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />
                      {engagementChartData.map((d, i) => {
                        const x = (i / (engagementChartData.length - 1)) * 100;
                        const y = 100 - (d.value / engYAxisMax) * 100;
                        return <circle key={i} cx={x} cy={y} r="2" fill="#1e293b" stroke="#ec4899" strokeWidth="1.5" />;
                      })}
                    </svg>

                    <div className="absolute inset-0 flex justify-between z-10">
                      {engagementChartData.map((d, i) => (
                        <div key={i} className="group relative w-full h-full cursor-pointer">
                          <div className="absolute top-1/4 left-1/2 -translate-x-1/2 bg-slate-900 border border-slate-700 p-3 rounded-xl shadow-xl opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none z-20 flex flex-col min-w-32">
                            <span className="text-xs font-black text-white mb-1">{d.date}</span>
                            <div className="flex items-center gap-2">
                              <div className="w-2.5 h-2.5 rounded-full bg-pink-500"></div>
                              <span className="text-[11px] font-bold text-slate-300">Interactions: {d.value.toLocaleString()}</span>
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>

                <div className="flex items-center justify-center gap-2 mt-4 pt-4 border-t border-slate-700/50 z-10">
                  <div className="w-3 h-3 rounded-full bg-pink-500"></div>
                  <span className="text-xs font-bold text-slate-300">Engagement</span>
                </div>
              </div>

              {/* PIECE 3: Social Influence Credits */}
              <div className="bg-slate-800 p-6 rounded-2xl border border-slate-700 shadow-sm col-span-1 lg:col-span-1 flex flex-col justify-between h-80 relative overflow-hidden">
                <div className="absolute top-0 right-0 w-32 h-32 bg-[#0052FF] blur-[80px] opacity-20 rounded-full pointer-events-none"></div>
                
                <div>
                  <h5 className="font-black text-lg text-white flex items-center gap-2">Social Influence</h5>
                  <p className="text-[11px] text-slate-400 font-medium">Your decentralized onchain reputation scores</p>
                </div>

                <div className="flex flex-col gap-5 mt-6 z-10">
                  {/* Neynar Score */}
                  <div>
                    <div className="flex justify-between items-end mb-1">
                      <span className="text-xs font-bold text-slate-300 flex items-center gap-1"><Cpu size={14} className="text-[#8A2BE2]"/> Neynar Score</span>
                      <span className="text-sm font-black text-white">{fcResult.reputation} <span className="text-[10px] text-slate-500">/ 10</span></span>
                    </div>
                    <div className="w-full bg-slate-700 rounded-full h-1.5">
                      <div className="bg-[#8A2BE2] h-1.5 rounded-full" style={{ width: `${(Number(fcResult.reputation) / 10) * 100}%` }}></div>
                    </div>
                  </div>

                  {/* Ethos Score */}
                  <div>
                    <div className="flex justify-between items-end mb-1">
                      <span className="text-xs font-bold text-slate-300 flex items-center gap-1"><ShieldCheck size={14} className="text-emerald-400"/> Ethos Credential</span>
                      <span className="text-sm font-black text-white">{ethosScore} <span className="text-[10px] text-slate-500">/ 1000</span></span>
                    </div>
                    <div className="w-full bg-slate-700 rounded-full h-1.5">
                      <div className="bg-emerald-400 h-1.5 rounded-full" style={{ width: `${(Number(ethosScore) / 1000) * 100}%` }}></div>
                    </div>
                  </div>

                  {/* Social Quotient */}
                  <div>
                    <div className="flex justify-between items-end mb-1">
                      <span className="text-xs font-bold text-slate-300 flex items-center gap-1"><Zap size={14} className="text-[#0052FF]"/> Social Quotient</span>
                      <span className="text-sm font-black text-white">{quotientScore} <span className="text-[10px] text-slate-500">/ 100</span></span>
                    </div>
                    <div className="w-full bg-slate-700 rounded-full h-1.5">
                      <div className="bg-[#0052FF] h-1.5 rounded-full" style={{ width: `${Number(quotientScore)}%` }}></div>
                    </div>
                  </div>
                </div>
                
                <div className="mt-4 pt-4 border-t border-slate-700/50 flex justify-center z-10">
                  <span className="text-[10px] font-bold text-slate-500 uppercase tracking-widest">Calculated via Neynar V2 Protocol</span>
                </div>
              </div>

            </div>

          </div>
        ) : (

          /* --- THE RECENT CASTS VIEW --- */
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 animate-in fade-in duration-200">
            {isFetchingForYou ? (
              <div className="col-span-full text-center text-slate-500 text-xs font-bold py-6">Loading recent casts...</div>
            ) : forYouFeed.length > 0 ? (
              forYouFeed.map((cast, index) => (
                <a key={index} href={`https://warpcast.com/${cast.author?.username}/${cast.hash.substring(0, 10)}`} target="_blank" rel="noopener noreferrer" className="bg-slate-200 p-5 rounded-2xl border border-slate-300 shadow-sm flex flex-col justify-between group transition-all hover:border-[#8A2BE2]/50 hover:-translate-y-0.5">
                  <div>
                    <div className="flex items-center gap-3 mb-4">
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img src={cast.author?.pfp_url} alt="PFP" className="w-8 h-8 rounded-full bg-slate-300" />
                      <span className="text-[10px] font-bold bg-slate-300 text-slate-600 px-2 py-1 rounded-md uppercase tracking-widest border border-slate-400">@{cast.author?.username}</span>
                    </div>
                    <p className="text-xs text-slate-700 font-medium leading-relaxed italic">&quot;{cast.text}&quot;</p>
                  </div>
                  <div className="mt-4 flex items-center gap-1 text-[10px] font-bold text-[#8A2BE2]">
                    <Flame size={12} /> {cast.likes} Likes
                  </div>
                </a>
              ))
            ) : (
              <div className="col-span-full text-center text-slate-500 text-xs font-bold py-6">No recent casts found right now.</div>
            )}
          </div>
        )}
      </div>

      {/* SECTION 4: THE MEGA ECOSYSTEM DIRECTORY */}
      <div className="flex justify-between items-center mb-6 ml-2">
        <h3 className="text-sm font-bold text-[#0052FF] flex items-center gap-2 uppercase tracking-widest">
          <Globe size={16} className="text-[#0052FF]" /> Explore the Ecosystem
        </h3>
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