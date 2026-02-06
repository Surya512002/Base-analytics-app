"use client";

import React, { useState, useEffect, useCallback } from 'react';
import { useNeynarContext, NeynarAuthButton } from "@neynar/react";
import Image from 'next/image';
import { TrendingUp, Repeat, MessageCircle, PenTool, CheckCircle2, Wallet, RefreshCcw, Zap, Trophy, Share2, Sun, Moon, Users, UserPlus, LogOut, Power } from 'lucide-react';
import { fetchUserAnalytics, fetchUserByAddress } from "./actions/farcaster";
import { Contract, BrowserProvider, Eip1193Provider } from 'ethers';
// ensure you installed: npm install @farcaster/miniapp-sdk
import { sdk } from "@farcaster/miniapp-sdk";

// --- 1. CONFIGURATION (Update these!) ---
const CREATOR_USERNAME = "suryaprakash.eth"; // Your Farcaster Username
const APP_URL = "https://base-analytics-app.vercel.app/"; // Your Vercel URL
// Replace with your real deployed addresses from Remix
const CHECKIN_CONTRACT_ADDRESS = "0x2d4c8a035868eF8FcF9A3c339957350524D38f82"; 
const GM_GN_CONTRACT_ADDRESS = "0xCee17958A9d6fEea76330Cb40eDEC4332bd97133"; 

// --- ABIs ---
const CHECKIN_ABI = [
  "function checkIn() external payable",
  "function getUserData(address _user) external view returns (uint256, uint256, uint256)",
  "function checkInFee() external view returns (uint256)"
];

const GM_GN_ABI = [
  "function gm() external payable", 
  "function gn() external payable", 
  "function fee() external view returns (uint256)" 
];

// --- STRICT TYPES ---
interface TimeframeStats {
  likes: number;
  recasts: number;
  replies: number;
  posts: number;
}

interface AnalyticsData {
  day: TimeframeStats;
  week: TimeframeStats;
  twoWeeks: TimeframeStats;
  neynarScore: number;
  followers: number;
  following: number;
  username?: string;
  pfp?: string;
  fid?: number;
}

interface EthereumWindow extends Window {
  ethereum?: Eip1193Provider;
}

export default function AnalyticsDashboard() {
  const { user, logoutUser } = useNeynarContext();
  
  const [engagement, setEngagement] = useState<AnalyticsData | null>(null);
  const [timeframe, setTimeframe] = useState<'day' | 'week' | 'twoWeeks'>('week');
  const [loading, setLoading] = useState(false);
  const [isReady, setIsReady] = useState(false);

  const [walletAddress, setWalletAddress] = useState<string | null>(null);
  const [points, setPoints] = useState(0);
  const [streak, setStreak] = useState(0);
  const [txLoading, setTxLoading] = useState(false);
  const [gmLoading, setGmLoading] = useState(false);

  // --- CRITICAL: CALL READY() ---
  useEffect(() => {
    const load = async () => {
        if (sdk && sdk.actions) {
            try {
                await sdk.actions.ready();
                setIsReady(true);
                console.log("Farcaster MiniApp SDK Ready!");
            } catch (err) {
                console.error("SDK Ready Failed:", err);
                // Force ready anyway so UI shows up
                setIsReady(true);
            }
        } else {
            // Fallback for browser testing
            setIsReady(true);
        }
    };
    load();
  }, []);

  // --- HELPER FUNCTIONS ---
  const fetchContractData = useCallback(async (address: string) => {
    if (typeof window === 'undefined') return;
    const ethWindow = window as unknown as EthereumWindow;
    
    if (ethWindow.ethereum) {
      try {
        const provider = new BrowserProvider(ethWindow.ethereum);
        const contract = new Contract(CHECKIN_CONTRACT_ADDRESS, CHECKIN_ABI, provider);
        
        const data = await contract.getUserData(address);
        setPoints(Number(data[0]));
        setStreak(Number(data[1]));
      } catch (error) {
        console.error("Error fetching contract data:", error);
      }
    }
  }, []);

  // --- WALLET CONNECTION ---
  const connectWallet = async () => {
    if (typeof window === 'undefined') return;
    const ethWindow = window as unknown as EthereumWindow;

    if (ethWindow.ethereum) {
      try {
        const provider = new BrowserProvider(ethWindow.ethereum);
        await provider.send("eth_requestAccounts", []);
        const signer = await provider.getSigner();
        const address = await signer.getAddress();
        
        setWalletAddress(address);
        fetchContractData(address);

        if (!user && !engagement) {
            setLoading(true);
            const data = await fetchUserByAddress(address);
            if (data) {
                setEngagement(data as unknown as AnalyticsData);
            } else {
                alert("No Farcaster account found for this wallet. Try signing in with Neynar instead.");
            }
            setLoading(false);
        }

      } catch (error) {
        console.error("Connection failed", error);
      }
    } else {
      alert("Please install MetaMask!");
    }
  };

  const disconnectWallet = () => {
      setWalletAddress(null);
      setPoints(0);
      setStreak(0);
      if (!user) setEngagement(null);
  };

  const handleNeynarLogout = () => {
      logoutUser(); 
      setEngagement(null);
  };

  // --- CONTRACT INTERACTIONS ---
  const handleOnChainCheckIn = async () => {
    if (!walletAddress) return connectWallet();
    if (typeof window === 'undefined') return;
    const ethWindow = window as unknown as EthereumWindow;
    if (!ethWindow.ethereum) return;

    try {
      setTxLoading(true);
      const provider = new BrowserProvider(ethWindow.ethereum);
      const signer = await provider.getSigner();
      const contract = new Contract(CHECKIN_CONTRACT_ADDRESS, CHECKIN_ABI, signer);

      const fee = await contract.checkInFee();
      const tx = await contract.checkIn({ value: fee });
      await tx.wait(); 

      alert("Check-in Successful! Streak Updated.");
      fetchContractData(walletAddress); 
      setTxLoading(false);
    } catch (error: unknown) {
      console.error("Transaction failed:", error);
      setTxLoading(false);
    }
  };

  const handleGmGn = async (type: 'gm' | 'gn') => {
    if (!walletAddress) return connectWallet();
    if (typeof window === 'undefined') return;
    const ethWindow = window as unknown as EthereumWindow;
    if (!ethWindow.ethereum) return;

    try {
      setGmLoading(true);
      const provider = new BrowserProvider(ethWindow.ethereum);
      const signer = await provider.getSigner();
      const contract = new Contract(GM_GN_CONTRACT_ADDRESS, GM_GN_ABI, signer);

      const fee = await contract.fee();
      const tx = type === 'gm' 
        ? await contract.gm({ value: fee }) 
        : await contract.gn({ value: fee });
      
      await tx.wait();

      alert(`Successfully said ${type.toUpperCase()}!`);
      setGmLoading(false);
    } catch (error) {
      console.error(`${type} failed:`, error);
      setGmLoading(false);
    }
  };

  const handleShare = () => {
    if (!engagement) return;
    const currentStats = engagement[timeframe];
    const timeframeLabel = timeframe === 'twoWeeks' ? '2 Weeks' : timeframe.charAt(0).toUpperCase() + timeframe.slice(1);
    const text = `My Base Analytics (${timeframeLabel}):
🔥 Neynar Score: ${(engagement.neynarScore * 100).toFixed(1)}%
❤️ Likes: ${currentStats.likes}
👥 Followers: ${engagement.followers}

Check your stats on Base Analytics by @${CREATOR_USERNAME}`;
    
    const url = `https://warpcast.com/~/compose?text=${encodeURIComponent(text)}&embeds[]=${encodeURIComponent(APP_URL)}`;
    window.open(url, '_blank');
  };

  const handleRefresh = async () => {
    if (user?.fid) {
      setLoading(true);
      const data = await fetchUserAnalytics(user.fid);
      if (data) setEngagement(data as unknown as AnalyticsData);
      setLoading(false);
    }
  };

  useEffect(() => {
    async function initData() {
      if (user?.fid) {
        setLoading(true);
        const data = await fetchUserAnalytics(user.fid);
        if (data) setEngagement(data as unknown as AnalyticsData);
        setLoading(false);
      }
    }
    initData();
  }, [user?.fid]);

  // --- RENDER LOGIC ---
  if (!isReady) return (
      <div className="min-h-screen bg-slate-900 flex items-center justify-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-white"></div>
      </div>
  );

  const displayUser = user || (engagement?.username ? { 
      username: engagement.username, 
      pfp_url: engagement.pfp 
  } : null);

  if (!displayUser && !engagement) return (
    <div className="min-h-screen bg-white flex flex-col items-center justify-center p-6 text-center">
      <div className="w-16 h-16 bg-blue-600 rounded-2xl mb-6 flex items-center justify-center shadow-blue-200 shadow-xl">
        <TrendingUp className="text-white" size={32} />
      </div>
      <h1 className="text-2xl font-black text-slate-900 mb-2 italic tracking-tighter">BASE ANALYTICS</h1>
      
      <div className="space-y-4 w-full max-w-xs">
          <NeynarAuthButton />
          
          <div className="relative">
            <div className="absolute inset-0 flex items-center"><span className="w-full border-t border-slate-200"></span></div>
            <div className="relative flex justify-center text-xs uppercase"><span className="bg-white px-2 text-slate-400 font-bold">Or check via Wallet</span></div>
          </div>

          <button 
            onClick={connectWallet}
            className="w-full bg-slate-900 text-white py-3 rounded-xl font-bold flex items-center justify-center gap-2 hover:bg-slate-800 transition shadow-lg"
          >
            <Wallet size={18} />
            Connect Wallet
          </button>
      </div>
    </div>
  );

  const stats = engagement?.[timeframe];

  return (
    <main className="min-h-screen bg-[#F5F8FF] text-slate-900 font-sans pb-12">
      <nav className="bg-white border-b border-slate-200 px-4 py-3 sticky top-0 z-50 shadow-sm">
        <div className="max-w-4xl mx-auto flex justify-between items-center">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 bg-blue-600 rounded-full flex items-center justify-center">
              <div className="w-3 h-3 bg-white rounded-full"></div>
            </div>
            <span className="font-black italic tracking-tighter text-blue-600 text-lg">BASE</span>
          </div>
          <div className="flex gap-2 items-center">
            
            {!walletAddress ? (
              <button onClick={connectWallet} className="bg-slate-900 text-white px-4 py-2 rounded-full text-xs font-bold hover:bg-slate-800 transition flex items-center gap-2">
                <Wallet size={14} /> Connect
              </button>
            ) : (
              <div className="flex items-center gap-1 bg-blue-50 border border-blue-100 rounded-full p-1 pl-3">
                <span className="text-blue-600 text-xs font-bold">
                    {walletAddress.slice(0,6)}...{walletAddress.slice(-4)}
                </span>
                <button 
                    onClick={disconnectWallet}
                    className="w-6 h-6 bg-white rounded-full flex items-center justify-center text-red-500 hover:bg-red-50"
                    title="Disconnect Wallet"
                >
                    <Power size={12} />
                </button>
              </div>
            )}

            <button onClick={handleRefresh} className={`p-2 rounded-full hover:bg-slate-100 transition-all ${loading ? 'animate-spin' : ''}`}>
              <RefreshCcw size={20} className="text-slate-400" />
            </button>
          </div>
        </div>
      </nav>

      <div className="max-w-4xl mx-auto p-4 lg:p-6 space-y-6">
        
        {/* HERO SECTION */}
        <div className="bg-[#0F172A] text-white rounded-3xl p-6 shadow-xl relative overflow-hidden">
            <div className="absolute top-0 right-0 w-64 h-64 bg-blue-500 rounded-full blur-[80px] opacity-20 pointer-events-none"></div>

            <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-6 relative z-10">
                <div>
                    <div className="flex items-center gap-3 mb-4">
                        <div className="p-2 bg-slate-800 rounded-lg">
                            <Zap size={24} className="text-yellow-400" />
                        </div>
                        <div>
                            <h3 className="font-bold text-xl leading-none">Daily Check-in</h3>
                            <p className="text-slate-400 text-xs mt-1">Mint your streak on Base</p>
                        </div>
                    </div>

                    <div className="flex gap-2">
                        {[...Array(7)].map((_, i) => (
                            <div 
                            key={i} 
                            className={`w-8 h-10 rounded-lg border flex items-center justify-center transition-all ${
                                i < streak % 7 
                                ? 'bg-blue-500 border-blue-500 text-white shadow-lg shadow-blue-900/50' 
                                : 'border-slate-700 text-slate-600 bg-slate-800/50'
                            }`}
                            >
                            {i < streak % 7 && <CheckCircle2 size={14} />}
                            </div>
                        ))}
                    </div>
                </div>

                <div className="flex flex-col md:flex-row gap-4 md:items-stretch">
                    <div className="bg-slate-800/80 p-4 rounded-2xl border border-slate-700/50 flex flex-col justify-center min-w-30">
                        <div className="flex items-center gap-2 mb-1">
                            <Trophy size={14} className="text-yellow-400" />
                            <span className="text-xs font-bold uppercase text-slate-400 tracking-wider">Reward Pool</span>
                        </div>
                        <p className="text-2xl font-black text-white leading-none">$100 <span className="text-blue-400 text-xs">USDC</span></p>
                    </div>

                    <div className="bg-slate-800/50 p-4 rounded-2xl border border-slate-700/50 flex flex-col md:flex-row gap-4 items-center">
                         <div className="pr-4 md:border-r border-slate-600/50 text-center md:text-left w-full md:w-auto">
                            <div className="flex items-center justify-center md:justify-start gap-2 mb-1">
                                <Wallet size={14} className="text-slate-400" />
                                <span className="text-xs font-bold uppercase text-slate-400 tracking-wider">My Points</span>
                            </div>
                            <p className="text-2xl font-black text-white leading-none">{points} <span className="text-slate-500 text-xs">PTS</span></p>
                        </div>

                        <button
                            onClick={handleOnChainCheckIn}
                            disabled={txLoading}
                            className={`w-full md:w-auto px-6 py-3 rounded-xl font-bold text-sm transition-all transform active:scale-95 flex items-center justify-center gap-2 ${
                            txLoading
                                ? 'bg-slate-700 text-slate-400 cursor-wait'
                                : 'bg-white text-blue-600 hover:bg-blue-50 shadow-lg shadow-white/10'
                            }`}
                        >
                            {txLoading ? 'Minting...' : (!walletAddress ? 'Connect Wallet' : 'Pay & Check-in')}
                        </button>
                    </div>
                </div>
            </div>
        </div>

        {/* PROFILE SECTION */}
        <div className="bg-white rounded-3xl p-6 shadow-sm border border-slate-100 flex flex-col sm:flex-row items-center gap-6 justify-between relative group">
            
            <button 
                onClick={handleNeynarLogout}
                className="absolute top-4 right-4 text-slate-300 hover:text-red-500 transition-colors p-2"
                title="Sign Out of Farcaster"
            >
                <LogOut size={18} />
            </button>

            <div className="flex flex-col sm:flex-row items-center gap-6 w-full">
              <div className="shrink-0">
                  <Image 
                      src={displayUser?.pfp_url || ''} 
                      alt="Profile" 
                      width={80}
                      height={80}
                      unoptimized 
                      className="rounded-2xl border-4 border-blue-50 object-cover shadow-sm"
                      style={{ width: '80px', height: '80px' }} 
                  />
              </div>
              <div className="text-center sm:text-left w-full">
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-6">
                      
                      <div>
                          <p className="text-xs font-bold text-blue-600 uppercase tracking-widest mb-1">Neynar Score</p>
                          <h1 className="text-5xl font-black text-slate-900 tracking-tight">
                              {(engagement?.neynarScore ? engagement.neynarScore * 100 : 0).toFixed(1)}%
                          </h1>
                          <p className="text-slate-400 text-sm font-medium mt-1">@{displayUser?.username}</p>
                      </div>

                      <div className="flex gap-6 border-l border-slate-100 pl-6">
                        <div>
                          <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-1 flex items-center gap-1">
                            <Users size={12} /> Followers
                          </p>
                          <p className="text-xl font-bold text-slate-900">{engagement?.followers.toLocaleString() || 0}</p>
                        </div>
                        <div>
                          <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-1 flex items-center gap-1">
                            <UserPlus size={12} /> Following
                          </p>
                          <p className="text-xl font-bold text-slate-900">{engagement?.following.toLocaleString() || 0}</p>
                        </div>
                      </div>
                  </div>
              </div>
            </div>

            <div className="flex flex-col gap-2 w-full sm:w-auto mt-4 sm:mt-0">
               <div className="bg-slate-50 p-1 rounded-xl flex gap-1 self-center w-full">
                  {(['day', 'week', 'twoWeeks'] as const).map((t) => (
                      <button 
                      key={t} 
                      onClick={() => setTimeframe(t)} 
                      className={`flex-1 px-4 py-2 text-[10px] font-black uppercase rounded-lg transition-all ${
                          timeframe === t 
                          ? 'bg-white text-blue-600 shadow-sm' 
                          : 'text-slate-400 hover:text-slate-600'
                      }`}
                      >
                      {t === 'twoWeeks' ? '2W' : t}
                      </button>
                  ))}
              </div>
              <button 
                onClick={handleShare}
                className="w-full px-6 py-3 bg-purple-600 hover:bg-purple-700 text-white rounded-xl font-bold flex items-center justify-center gap-2 shadow-lg shadow-purple-200 transition-all active:scale-95"
              >
                <Share2 size={18} />
                Share Stats
              </button>
            </div>
        </div>

        {/* STATS GRID */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
            <StatCard label="Likes" value={stats?.likes} icon={<TrendingUp size={20}/>} color="bg-blue-50 text-blue-600" delay={0} />
            <StatCard label="Reposts" value={stats?.recasts} icon={<Repeat size={20}/>} color="bg-emerald-50 text-emerald-600" delay={75} />
            <StatCard label="Comments" value={stats?.replies} icon={<MessageCircle size={20}/>} color="bg-violet-50 text-violet-600" delay={150} />
            <StatCard label="Casts" value={stats?.posts} icon={<PenTool size={20}/>} color="bg-amber-50 text-amber-600" delay={225} />
        </div>

        {/* GM / GN CONTRACT SECTION */}
        <div className="bg-white rounded-3xl p-6 shadow-sm border border-slate-100">
           <div className="flex items-center gap-3 mb-4">
              <div className="p-2 bg-orange-100 rounded-lg">
                <Sun size={20} className="text-orange-500" />
              </div>
              <h3 className="font-bold text-lg text-slate-900">Community Vibes (Costs $0.005)</h3>
           </div>
           
           <div className="grid grid-cols-2 gap-4">
              <button 
                onClick={() => handleGmGn('gm')}
                disabled={gmLoading}
                className="py-4 bg-orange-50 hover:bg-orange-100 text-orange-600 rounded-xl font-black text-xl flex items-center justify-center gap-2 border border-orange-200 transition-all active:scale-95"
              >
                <Sun size={24} /> GM
              </button>
              <button 
                onClick={() => handleGmGn('gn')}
                disabled={gmLoading}
                className="py-4 bg-indigo-50 hover:bg-indigo-100 text-indigo-600 rounded-xl font-black text-xl flex items-center justify-center gap-2 border border-indigo-200 transition-all active:scale-95"
              >
                <Moon size={24} /> GN
              </button>
           </div>
           <p className="text-center text-xs text-slate-400 mt-3 font-medium">Saying GM/GN writes to the Base Blockchain and supports the creator.</p>
        </div>

      </div>
    </main>
  );
}

interface StatCardProps {
  label: string;
  value?: number;
  icon: React.ReactNode;
  color: string;
  delay: number;
}

function StatCard({ label, value, icon, color, delay }: StatCardProps) {
  return (
    <div 
      className="bg-white p-5 rounded-3xl shadow-sm border border-slate-100 hover:border-blue-100 transition-all duration-300 hover:shadow-md"
      style={{ animationDelay: `${delay}ms` }}
    >
      <div className={`w-12 h-12 rounded-2xl flex items-center justify-center mb-3 ${color}`}>
        {icon}
      </div>
      <p className="text-xs font-bold uppercase text-slate-400 tracking-widest mb-1">{label}</p>
      <p className="text-3xl font-black text-slate-900 tracking-tight">{value?.toLocaleString() || 0}</p>
    </div>
  );
} 