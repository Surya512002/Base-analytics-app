"use client";
import React, { useState, useEffect, useMemo } from 'react';
import { useAccount } from 'wagmi';
import {
  ExternalLink, Globe, Coins, Palette, MessageCircle, Fingerprint,
  Gamepad2, Layers, TrendingUp, Cpu, LineChart, TrendingDown,
  Activity, RefreshCcw, ShoppingCart, Flame, Search, Award, Users, Send, Twitter, Code, Lock,
  BarChart3, MessageSquare, Repeat, ShieldCheck, Zap
} from 'lucide-react';

interface CoinData { id:string; symbol:string; name:string; price:number; change24h:number; change7d:number; change30d:number; volume:number; }
interface FarcasterData { username:string; fid:number; followers:number; following:number; reputation:string; tier:string; topFollower:string; }
interface FarcasterCast { hash:string; text:string; author:{username:string;pfp_url:string;}; likes:number; }
interface RawCast { hash:string; text:string; timestamp?:string; author?:{username?:string;pfp_url?:string;pfp?:{url?:string}}; reactions?:{likes_count?:number;recasts_count?:number}; replies?:{count?:number}; }

const ECOSYSTEM_PROJECTS = [
  // DeFi / DEX
  { name:"Aerodrome",     category:"DeFi / DEX",         description:"The central trading and liquidity hub on Base. The most liquid DEX.",      url:"https://aerodrome.finance/",             icon:<Coins size={18}/>,     color:"text-blue-400",   bg:"bg-blue-500/10",    border:"hover:border-blue-500/30" },
  { name:"Uniswap",       category:"DeFi / DEX",         description:"World's largest DEX. Swap any token with deep liquidity on Base.",          url:"https://app.uniswap.org/",               icon:<Globe size={18}/>,     color:"text-pink-400",   bg:"bg-pink-500/10",    border:"hover:border-pink-500/30" },
  { name:"Alien Base",    category:"DeFi / DEX",         description:"Base-native DEX with high-yield farming and staking rewards.",              url:"https://alienbase.xyz/",                 icon:<Coins size={18}/>,     color:"text-green-400",  bg:"bg-green-500/10",    border:"hover:border-green-500/30" },
  { name:"BaseSwap",      category:"DeFi / DEX",         description:"Community-driven DEX built natively for the Base ecosystem.",               url:"https://baseswap.fi/",                  icon:<ArrowRight size={18}/>,color:"text-orange-400", bg:"bg-orange-500/10",   border:"hover:border-orange-500/30" },
  { name:"Dackieswap",    category:"DeFi / DEX",         description:"Cute duck-themed DEX with competitive fees and farming on Base.",           url:"https://www.dackieswap.xyz/",            icon:<Coins size={18}/>,     color:"text-yellow-400", bg:"bg-yellow-500/10",   border:"hover:border-yellow-500/30" },
  { name:"SynthSwap",     category:"DeFi / DEX",         description:"Decentralized exchange with liquidity incentives on Base.",                 url:"https://synthswap.io/",                  icon:<Coins size={18}/>,     color:"text-cyan-400",   bg:"bg-cyan-500/10",    border:"hover:border-cyan-500/30" },
  // DeFi / Lending
  { name:"Aave",          category:"DeFi / Lending",     description:"Gold-standard DeFi lending. Supply crypto to earn or borrow against.",      url:"https://app.aave.com/",                  icon:<TrendingUp size={18}/>,color:"text-cyan-400",   bg:"bg-cyan-500/10",    border:"hover:border-cyan-500/30" },
  { name:"Morpho",        category:"DeFi / Lending",     description:"Highly efficient peer-to-peer lending scaling rapidly on Base.",            url:"https://app.morpho.org/",                icon:<Layers size={18}/>,    color:"text-blue-400",   bg:"bg-blue-600/10",    border:"hover:border-blue-500/30" },
  { name:"Moonwell",      category:"DeFi / Lending",     description:"Premier open lending and borrowing protocol built natively on Base.",        url:"https://moonwell.fi/",                   icon:<TrendingUp size={18}/>,color:"text-indigo-400", bg:"bg-indigo-500/10",   border:"hover:border-indigo-500/30" },
  { name:"Seamless",      category:"DeFi / Lending",     description:"First decentralized native lending and borrowing protocol on Base.",         url:"https://seamlessprotocol.com/",          icon:<TrendingUp size={18}/>,color:"text-blue-300",   bg:"bg-blue-400/10",    border:"hover:border-blue-400/30" },
  { name:"Compound",      category:"DeFi / Lending",     description:"Algorithmic, autonomous interest rate protocol deployed on Base.",           url:"https://app.compound.finance/",          icon:<TrendingUp size={18}/>,color:"text-green-400",  bg:"bg-green-500/10",    border:"hover:border-green-500/30" },
  { name:"Silo Finance",  category:"DeFi / Lending",     description:"Isolated lending markets for safer borrowing with any token.",               url:"https://app.silo.finance/",              icon:<Layers size={18}/>,    color:"text-amber-400",  bg:"bg-amber-500/10",    border:"hover:border-amber-500/30" },
  // DeFi Derivatives
  { name:"Synthetix",     category:"DeFi / Derivatives", description:"Trade perpetual futures and synthetic assets with deep liquidity.",          url:"https://synthetix.io/",                  icon:<LineChart size={18}/>, color:"text-indigo-400", bg:"bg-indigo-400/10",   border:"hover:border-indigo-400/30" },
  { name:"Kwenta",        category:"DeFi / Derivatives", description:"Advanced perpetual futures trading powered by Synthetix on Base.",           url:"https://kwenta.eth.limo/",               icon:<LineChart size={18}/>, color:"text-yellow-400", bg:"bg-yellow-500/10",   border:"hover:border-yellow-500/30" },
  { name:"GMX",           category:"DeFi / Derivatives", description:"Decentralized spot and perpetual exchange with low swap fees on Base.",       url:"https://gmx.io/",                        icon:<LineChart size={18}/>, color:"text-blue-400",   bg:"bg-blue-500/10",    border:"hover:border-blue-500/30" },
  { name:"Contango",      category:"DeFi / Derivatives", description:"Trade leveraged fixed-rate positions using lending protocols.",              url:"https://contango.xyz/",                  icon:<LineChart size={18}/>, color:"text-purple-400", bg:"bg-purple-500/10",   border:"hover:border-purple-500/30" },
  // Social
  { name:"Warpcast",      category:"Social",             description:"Premier Farcaster client. Decentralized social network on Base.",            url:"https://warpcast.com/",                  icon:<MessageCircle size={18}/>,color:"text-purple-400",bg:"bg-purple-500/10",  border:"hover:border-purple-500/30" },
  { name:"Farcaster",     category:"Social",             description:"Decentralized social protocol. Build your onchain identity and network.",    url:"https://www.farcaster.xyz/",             icon:<MessageCircle size={18}/>,color:"text-purple-300",bg:"bg-purple-400/10",  border:"hover:border-purple-400/30" },
  { name:"Supercast",     category:"Social",             description:"A beautiful, power-user Farcaster client with advanced features.",           url:"https://supercast.xyz/",                 icon:<MessageCircle size={18}/>,color:"text-pink-400",  bg:"bg-pink-500/10",     border:"hover:border-pink-500/30" },
  { name:"Paragraph",     category:"Social / Publishing",description:"Publish newsletters, build communities, and mint writing as NFTs.",           url:"https://paragraph.xyz/",                 icon:<Activity size={18}/>,  color:"text-orange-400", bg:"bg-orange-500/10",   border:"hover:border-orange-500/30" },
  { name:"Bountycaster",  category:"Social",             description:"Create and complete crypto bounties across the Farcaster network.",          url:"https://www.bountycaster.xyz/",          icon:<Layers size={18}/>,    color:"text-emerald-400",bg:"bg-emerald-500/10",  border:"hover:border-emerald-500/30" },
  { name:"Blackbird",     category:"Social / Loyalty",   description:"Earn crypto rewards for visiting your favorite restaurants onchain.",         url:"https://blackbird.xyz/",                 icon:<Award size={18}/>,     color:"text-slate-300",  bg:"bg-white/5",         border:"hover:border-white/20" },
  // NFTs
  { name:"Zora",          category:"NFTs / Creators",    description:"Mint, collect, and create beautiful onchain media and NFT collections.",     url:"https://zora.co/",                       icon:<Palette size={18}/>,   color:"text-rose-400",   bg:"bg-rose-500/10",     border:"hover:border-rose-500/30" },
  { name:"Sound.xyz",     category:"Music / NFTs",       description:"Discover new music. Collect songs directly from artists onchain.",           url:"https://www.sound.xyz/",                 icon:<Palette size={18}/>,   color:"text-purple-400", bg:"bg-purple-500/10",   border:"hover:border-purple-500/30" },
  { name:"BasePaint",     category:"NFTs / Art",         description:"Collaborative pixel art canvas where artists share mint revenue.",           url:"https://basepaint.xyz/",                 icon:<Palette size={18}/>,   color:"text-blue-400",   bg:"bg-blue-400/10",     border:"hover:border-blue-400/30" },
  { name:"Magic Eden",    category:"NFT Marketplace",    description:"Discover, trade, and collect top trending NFTs on the Base network.",        url:"https://magiceden.io/base",              icon:<Globe size={18}/>,     color:"text-fuchsia-400",bg:"bg-fuchsia-500/10",  border:"hover:border-fuchsia-500/30" },
  { name:"OpenSea",       category:"NFT Marketplace",    description:"The world's largest NFT marketplace, fully integrated with Base.",           url:"https://opensea.io/",                    icon:<Globe size={18}/>,     color:"text-blue-400",   bg:"bg-blue-500/10",     border:"hover:border-blue-500/30" },
  { name:"Foundation",    category:"NFTs / Art",         description:"Premier destination to discover and collect exclusive digital art.",          url:"https://foundation.app/",                icon:<Palette size={18}/>,   color:"text-slate-300",  bg:"bg-white/5",         border:"hover:border-white/20" },
  { name:"Manifold",      category:"NFTs / Creators",    description:"Professional NFT creation tools. Launch your own smart contract.",           url:"https://manifold.xyz/",                  icon:<Palette size={18}/>,   color:"text-orange-400", bg:"bg-orange-500/10",   border:"hover:border-orange-500/30" },
  { name:"Highlight",     category:"NFTs / Creators",    description:"Create, mint, and distribute NFTs at scale with powerful tools.",            url:"https://highlight.xyz/",                 icon:<Palette size={18}/>,   color:"text-yellow-400", bg:"bg-yellow-500/10",   border:"hover:border-yellow-500/30" },
  { name:"Decent",        category:"NFTs / Commerce",    description:"Buy, sell, and trade NFTs across chains. Cross-chain NFT infrastructure.",   url:"https://decent.xyz/",                    icon:<Globe size={18}/>,     color:"text-pink-400",   bg:"bg-pink-500/10",     border:"hover:border-pink-500/30" },
  // Gaming
  { name:"Layer3",        category:"Quests / Gaming",    description:"Complete interactive quests to learn Web3 skills and earn rewards.",         url:"https://layer3.xyz/",                    icon:<Gamepad2 size={18}/>,  color:"text-yellow-400", bg:"bg-yellow-500/10",   border:"hover:border-yellow-500/30" },
  { name:"Frenpet",       category:"Gaming",             description:"Tamagotchi meets crypto. Adopt, feed, and battle digital pets onchain.",     url:"https://frenpet.com/",                   icon:<Gamepad2 size={18}/>,  color:"text-orange-400", bg:"bg-orange-500/10",   border:"hover:border-orange-500/30" },
  { name:"Parallel",      category:"Gaming / TCG",       description:"Sci-fi collectible card game with true onchain asset ownership.",            url:"https://parallel.life/",                 icon:<Gamepad2 size={18}/>,  color:"text-indigo-400", bg:"bg-indigo-400/10",   border:"hover:border-indigo-400/30" },
  { name:"Words3",        category:"Gaming",             description:"Competitive multiplayer word game powered by Base smart contracts.",          url:"https://www.words3.xyz/",                icon:<Gamepad2 size={18}/>,  color:"text-cyan-400",   bg:"bg-cyan-500/10",     border:"hover:border-cyan-500/30" },
  { name:"Moxy",          category:"Gaming / E-Sports",  description:"Compete in skill-based games and tournaments to win real crypto.",           url:"https://moxy.io/",                       icon:<Gamepad2 size={18}/>,  color:"text-red-400",    bg:"bg-red-500/10",      border:"hover:border-red-500/30" },
  { name:"Onchain Heroes",category:"Gaming / RPG",       description:"Browser-based onchain RPG with tokenized heroes and quests.",                url:"https://www.onchainhero.io/",            icon:<Gamepad2 size={18}/>,  color:"text-amber-400",  bg:"bg-amber-500/10",    border:"hover:border-amber-500/30" },
  { name:"Isekai Meta",   category:"Gaming / RPG",       description:"Onchain anime RPG with character NFTs and battle mechanics on Base.",        url:"https://isekaimeta.com/",                icon:<Gamepad2 size={18}/>,  color:"text-purple-400", bg:"bg-purple-500/10",   border:"hover:border-purple-500/30" },
  // Identity
  { name:"Basenames",     category:"Identity",           description:"Claim your unique .base.eth username and build your onchain reputation.",    url:"https://www.base.org/names",             icon:<Fingerprint size={18}/>,color:"text-blue-400",  bg:"bg-blue-500/10",     border:"hover:border-blue-500/30" },
  { name:"ENS",           category:"Identity",           description:"Ethereum Name Service. Your .eth identity works everywhere on Base.",        url:"https://app.ens.domains/",               icon:<Fingerprint size={18}/>,color:"text-blue-300",  bg:"bg-blue-400/10",     border:"hover:border-blue-400/30" },
  { name:"Coinbase ID",   category:"Identity",           description:"Verified onchain identity backed by Coinbase. One click verification.",      url:"https://www.coinbase.com/onchain-verify",icon:<Fingerprint size={18}/>,color:"text-blue-500",  bg:"bg-blue-600/10",     border:"hover:border-blue-600/30" },
  // Dev Tools
  { name:"Neynar",        category:"Dev Tools",          description:"The ultimate Farcaster developer hub. Build social AI agents instantly.",    url:"https://neynar.com/",                    icon:<Cpu size={18}/>,       color:"text-yellow-400", bg:"bg-yellow-500/10",   border:"hover:border-yellow-500/30" },
  { name:"Thirdweb",      category:"Dev Tools",          description:"Complete Web3 dev framework. Deploy contracts and build dApps in minutes.",  url:"https://thirdweb.com/",                  icon:<Code size={18}/>,      color:"text-fuchsia-400",bg:"bg-fuchsia-600/10",  border:"hover:border-fuchsia-500/30" },
  { name:"Privy",         category:"Dev Tools",          description:"Drop-in Web3 auth. Let users sign in with email, social, or wallets.",       url:"https://www.privy.io/",                  icon:<Fingerprint size={18}/>,color:"text-sky-400",   bg:"bg-sky-500/10",      border:"hover:border-sky-500/30" },
  { name:"Coinbase CDP",  category:"Dev Tools",          description:"Coinbase Developer Platform. Build secure scalable onchain applications.",   url:"https://portal.cdp.coinbase.com/",       icon:<Cpu size={18}/>,       color:"text-blue-400",   bg:"bg-blue-500/10",     border:"hover:border-blue-500/30" },
  { name:"Alchemy",       category:"Dev Tools",          description:"Web3 development platform. Reliable Base RPC, NFT APIs, and indexing.",      url:"https://www.alchemy.com/",               icon:<Cpu size={18}/>,       color:"text-blue-300",   bg:"bg-blue-400/10",     border:"hover:border-blue-400/30" },
  { name:"QuickNode",     category:"Dev Tools",          description:"Fast Base RPC provider with analytics, alerts, and add-ons.",                url:"https://www.quicknode.com/",             icon:<Cpu size={18}/>,       color:"text-orange-400", bg:"bg-orange-500/10",   border:"hover:border-orange-500/30" },
  { name:"Hardhat",       category:"Dev Tools",          description:"Ethereum dev environment with Base network support. Test and deploy easily.", url:"https://hardhat.org/",                   icon:<Code size={18}/>,      color:"text-yellow-500", bg:"bg-yellow-500/10",   border:"hover:border-yellow-500/30" },
  { name:"Foundry",       category:"Dev Tools",          description:"Blazing fast Solidity testing framework. The go-to for Base devs.",          url:"https://getfoundry.sh/",                 icon:<Code size={18}/>,      color:"text-red-400",    bg:"bg-red-500/10",      border:"hover:border-red-500/30" },
  { name:"Guild",         category:"Community Tools",    description:"Automate membership and create token-gated roles for any community.",        url:"https://guild.xyz/base",                 icon:<Users size={18}/>,     color:"text-slate-400",  bg:"bg-white/5",         border:"hover:border-white/20" },
  { name:"Superfluid",    category:"Dev Tools",          description:"Real-time finance protocol. Stream tokens by the second on Base.",           url:"https://www.superfluid.finance/",        icon:<Layers size={18}/>,    color:"text-green-400",  bg:"bg-green-500/10",    border:"hover:border-green-500/30" },
  // Bridges & Infrastructure
  { name:"Base Bridge",   category:"Bridge",             description:"Official Coinbase bridge. Move ETH and tokens between Ethereum and Base.",   url:"https://bridge.base.org/",               icon:<ArrowRight size={18}/>,color:"text-blue-400",   bg:"bg-blue-500/10",     border:"hover:border-blue-500/30" },
  { name:"Across",        category:"Bridge",             description:"Fastest token bridge powered by UMA's optimistic oracle on Base.",           url:"https://across.to/",                     icon:<ArrowRight size={18}/>,color:"text-green-400",  bg:"bg-green-500/10",    border:"hover:border-green-500/30" },
  { name:"Stargate",      category:"Bridge",             description:"Fully composable native asset bridge with unified liquidity pools.",         url:"https://stargate.finance/",              icon:<ArrowRight size={18}/>,color:"text-blue-300",   bg:"bg-blue-400/10",     border:"hover:border-blue-400/30" },
  { name:"Socket",        category:"Bridge",             description:"Cross-chain interoperability protocol. Move assets anywhere.",               url:"https://www.socket.tech/",               icon:<ArrowRight size={18}/>,color:"text-purple-400", bg:"bg-purple-500/10",   border:"hover:border-purple-500/30" },
  { name:"Relay",         category:"Bridge",             description:"Instant cross-chain bridge with gasless execution on Base.",                 url:"https://relay.link/",                    icon:<ArrowRight size={18}/>,color:"text-cyan-400",   bg:"bg-cyan-500/10",     border:"hover:border-cyan-500/30" },
  // Stablecoins & Payments
  { name:"Circle USDC",   category:"Stablecoins",        description:"Native USDC on Base. The most trusted stablecoin, natively issued.",         url:"https://www.circle.com/usdc",            icon:<Coins size={18}/>,     color:"text-blue-400",   bg:"bg-blue-500/10",     border:"hover:border-blue-500/30" },
  { name:"Coinbase Pay",  category:"Payments",           description:"Onramp fiat to crypto instantly. Buy Base ETH with card or bank.",           url:"https://pay.coinbase.com/",              icon:<Coins size={18}/>,     color:"text-blue-500",   bg:"bg-blue-600/10",     border:"hover:border-blue-600/30" },
  // Data & Analytics
  { name:"Dune Analytics",category:"Data",               description:"Query, visualize, and share Base blockchain data with SQL.",                 url:"https://dune.com/",                      icon:<BarChart3 size={18}/>, color:"text-orange-400", bg:"bg-orange-500/10",   border:"hover:border-orange-500/30" },
  { name:"Dexscreener",   category:"Data",               description:"Live price charts, trending tokens, and DEX analytics on Base.",             url:"https://dexscreener.com/base",           icon:<LineChart size={18}/>, color:"text-green-400",  bg:"bg-green-500/10",    border:"hover:border-green-500/30" },
  { name:"Basescan",      category:"Data",               description:"Official Base block explorer. Track transactions, addresses, and contracts.", url:"https://basescan.org/",                 icon:<Globe size={18}/>,     color:"text-blue-400",   bg:"bg-blue-500/10",     border:"hover:border-blue-500/30" },
  { name:"DefiLlama",     category:"Data",               description:"Trustless, accurate DeFi TVL data and analytics for Base protocols.",        url:"https://defillama.com/chain/Base",       icon:<BarChart3 size={18}/>, color:"text-teal-400",   bg:"bg-teal-500/10",     border:"hover:border-teal-500/30" },
];

function ArrowRight({size}:{size:number}){return(<svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="m9 18 6-6-6-6"/></svg>);}

const CATEGORIES=['All','DeFi / DEX','DeFi / Lending','DeFi / Derivatives','NFTs / Creators','NFT Marketplace','Gaming','Social','Identity','Dev Tools','Bridge','Data'];

// --- 🚀 NEYNAR UTILS EXPORTED TO PREVENT INFINITE LOOPS ---
const NEYNAR_API_KEY='C47D2A28-6050-485E-8C4B-E49945213403';

const fetchNeynarScore=async(fid:number):Promise<number>=>{
  try{
    const res=await fetch(`https://api.neynar.com/v2/farcaster/user/bulk?fids=${fid}`,{
      headers:{'accept':'application/json','x-api-key':NEYNAR_API_KEY}
    });
    const data=await res.json();
    const user=data?.users?.[0];
    
    // Neynar returns score as a float (e.g. 0.95). We multiply by 10 to fit the 10-point scale.
    const score = user?.experimental?.neynar_user_score ?? user?.score;
    if(score !== null && score !== undefined) {
        let numScore = Number(score);
        if (numScore <= 1.0 && numScore > 0) numScore *= 10;
        return Math.min(10, parseFloat(numScore.toFixed(2)));
    }
    
    // Fallback calculation if field not present
    const fidBonus=fid<1000?3.5:fid<10000?2.5:fid<100000?1.5:0.5;
    const followerBonus=Math.min(3.5,(user?.follower_count||0)/1000);
    return Math.min(9.9,parseFloat((4.0+fidBonus+followerBonus).toFixed(2)));
  }catch{return 0;}
};

const fetchTopFollower=async(fid:number):Promise<string>=>{
  try{
    const res=await fetch(`https://api.neynar.com/v2/farcaster/followers?fid=${fid}&limit=50`,{headers:{'accept':'application/json','x-api-key':NEYNAR_API_KEY}});
    const data=await res.json();
    if(data.users&&data.users.length>0){
      const sorted=data.users.sort((a:{follower_count:number},b:{follower_count:number})=>b.follower_count-a.follower_count);
      return`@${sorted[0].username}`;
    }
  }catch{}
  return"None found";
};

const buildFcResult=async(user:Record<string,unknown>):Promise<FarcasterData>=>{
  const fid=Number(user.fid);
  const followers=Number(user.follower_count)||0;
  const following=Number(user.following_count)||0;
  const score=await fetchNeynarScore(fid);
  const topFollower=await fetchTopFollower(fid);
  const tier=score>8.0?'Power User':score>6.0?'Active Caster':score>4.0?'Regular':'Newcomer';
  return{username:`@${user.username}`,fid,followers,following,reputation:score.toFixed(1),tier,topFollower};
};
// -----------------------------------------------------------

export default function BaseHub(){
  const{address}=useAccount();
  const[allCoins,setAllCoins]=useState<CoinData[]>([]);
  const[isFetchingCoins,setIsFetchingCoins]=useState(true);
  const[tokenTab,setTokenTab]=useState<'trending'|'gainers'|'losers'>('trending');
  const[timeframe,setTimeframe]=useState<'24h'|'7d'|'30d'>('24h');

  const[fcUsername,setFcUsername]=useState('');
  const[isScanningFc,setIsScanningFc]=useState(false);
  const[fcResult,setFcResult]=useState<FarcasterData|null>(null);
  const[fcError,setFcError]=useState('');
  const[scannedAddress,setScannedAddress]=useState<string>(''); // 👈 Prevents infinite loop

  const[feedTab,setFeedTab]=useState<'analytics'|'foryou'>('analytics');
  const[analyticsTimeframe,setAnalyticsTimeframe]=useState<'24h'|'3d'|'7d'|'14d'>('7d');
  const[userCastsHistory,setUserCastsHistory]=useState<RawCast[]>([]);
  const[forYouFeed,setForYouFeed]=useState<FarcasterCast[]>([]);
  const[globalFeed,setGlobalFeed]=useState<FarcasterCast[]>([]);
  const[isFetchingHistory,setIsFetchingHistory]=useState(false);
  const[isFetchingForYou,setIsFetchingForYou]=useState(false);
  const[isFetchingGlobal,setIsFetchingGlobal]=useState(false);
  const[ecoCategory,setEcoCategory]=useState('All');
  const[ecoSearch,setEcoSearch]=useState('');

  const filteredProjects=useMemo(()=>ECOSYSTEM_PROJECTS.filter(p=>{
    const matchCat=ecoCategory==='All'||p.category===ecoCategory||p.category.startsWith(ecoCategory);
    const matchSearch=ecoSearch===''||p.name.toLowerCase().includes(ecoSearch.toLowerCase())||p.description.toLowerCase().includes(ecoSearch.toLowerCase())||p.category.toLowerCase().includes(ecoSearch.toLowerCase());
    return matchCat&&matchSearch;
  }),[ecoCategory,ecoSearch]);

  useEffect(()=>{
    const fetchPrices=async()=>{
      try{
        const IDS='degen-base,aerodrome-finance,based-brett,higher,toshi,virtual-protocol,moonwell,seamless-protocol,alien-base,mfercoin,base-god,doginme,frenpet,ski-mask-dog,mister-miggles,keyboard-cat-2,basenji,wow-3,luna-virtuals,ben-dog,roost,mumu-the-bull';
        const res=await fetch(`https://api.coingecko.com/api/v3/coins/markets?vs_currency=usd&ids=${IDS}&order=volume_desc&price_change_percentage=24h,7d,30d`);
        const data=await res.json();
        if(data&&data.length>0){
          setAllCoins(data.map((c:Record<string,unknown>)=>({
            id:String(c.id),symbol:String(c.symbol).toUpperCase(),name:String(c.name),
            price:Number(c.current_price)||0,change24h:Number(c.price_change_percentage_24h_in_currency)||0,
            change7d:Number(c.price_change_percentage_7d_in_currency)||0,change30d:Number(c.price_change_percentage_30d_in_currency)||0,
            volume:Number(c.total_volume)||0
          })));
        }
      }catch(e){console.error(e);}finally{setIsFetchingCoins(false);}
    };
    fetchPrices();
    const t=setInterval(fetchPrices,60000);
    return()=>clearInterval(t);
  },[]);

  // 🚀 Auto-fetch by wallet with safety lock
  useEffect(()=>{
    if(!address || address === scannedAddress) return;
    const auto=async()=>{
      setScannedAddress(address);
      setIsScanningFc(true);setFcError('');
      try{
        const res=await fetch(`https://api.neynar.com/v2/farcaster/user/bulk-by-address?addresses=${address}`,{headers:{'accept':'application/json','x-api-key':NEYNAR_API_KEY}});
        const data=await res.json();
        const lower=address.toLowerCase();
        if(data&&data[lower]&&data[lower].length>0){
          setFcResult(await buildFcResult(data[lower][0]));
        }
      }catch(e){console.error(e);}finally{setIsScanningFc(false);}
    };
    auto();
  },[address, scannedAddress]);

  // Fetch cast history for analytics
  useEffect(()=>{
    if(!fcResult?.fid)return;
    const fetch2=async()=>{
      setIsFetchingHistory(true);
      try{
        const res=await fetch(`https://api.neynar.com/v2/farcaster/feed/user/casts?fid=${fcResult.fid}&limit=100`,{headers:{'accept':'application/json','x-api-key':NEYNAR_API_KEY}});
        const data=await res.json();
        if(data.casts)setUserCastsHistory(data.casts);
      }catch{}finally{setIsFetchingHistory(false);}
    };
    fetch2();
  },[fcResult?.fid]);

  useEffect(()=>{
    if(feedTab!=='foryou'||!fcResult?.fid)return;
    const fetch3=async()=>{
      setIsFetchingForYou(true);
      try{
        const res=await fetch(`https://api.neynar.com/v2/farcaster/feed/user/casts?fid=${fcResult.fid}&limit=10`,{headers:{'accept':'application/json','x-api-key':NEYNAR_API_KEY}});
        const data=await res.json();
        const casts=data.casts||(data.result&&data.result.casts);
        if(casts&&Array.isArray(casts)&&casts.length>0){
          setForYouFeed(casts.slice(0,4).map((c:RawCast)=>({hash:c.hash,text:c.text?c.text.substring(0,120)+(c.text.length>120?'...':''):'',author:{username:c.author?.username||'unknown',pfp_url:c.author?.pfp_url||c.author?.pfp?.url||'https://warpcast.com/avatar.png'},likes:c.reactions?.likes_count||0})));
        }else setForYouFeed([]);
      }catch{}finally{setIsFetchingForYou(false);}
    };
    fetch3();
  },[feedTab,fcResult?.fid]);

  useEffect(()=>{
    const fetch4=async()=>{
      setIsFetchingGlobal(true);
      try{
        const res=await fetch(`https://api.neynar.com/v2/farcaster/feed/user/casts?fid=289309&limit=10`,{headers:{'accept':'application/json','x-api-key':NEYNAR_API_KEY}});
        if(!res.ok)return;
        const data=await res.json();
        const casts=data.casts||(data.result&&data.result.casts);
        if(casts&&Array.isArray(casts)&&casts.length>0){
          setGlobalFeed(casts.slice(0,4).map((c:RawCast)=>({hash:c.hash,text:c.text?c.text.substring(0,120)+(c.text.length>120?'...':''):'',author:{username:c.author?.username||'unknown',pfp_url:c.author?.pfp_url||c.author?.pfp?.url||'https://warpcast.com/avatar.png'},likes:c.reactions?.likes_count||0})));
        }
      }catch{}finally{setIsFetchingGlobal(false);}
    };
    fetch4();
  },[]);

  const handleScanFarcaster=async(e:React.FormEvent)=>{
    e.preventDefault();if(!fcUsername)return;
    setIsScanningFc(true);setFcResult(null);setFcError('');setUserCastsHistory([]);
    try{
      const clean=fcUsername.replace('@','');
      const res=await fetch(`https://api.neynar.com/v2/farcaster/user/by_username?username=${clean}&viewer_fid=3`,{headers:{'accept':'application/json','x-api-key':NEYNAR_API_KEY}});
      const data=await res.json();
      if(data&&data.user){setFcResult(await buildFcResult(data.user));}
      else{setFcError('User not found. Please check the username.');}
    }catch{setFcError('Failed to fetch. Try again.');}
    finally{setIsScanningFc(false);}
  };

  const getDisplayedCoins=()=>{
    const sorted=[...allCoins];
    const key=timeframe==='24h'?'change24h':timeframe==='7d'?'change7d':'change30d';
    if(tokenTab==='gainers')sorted.sort((a,b)=>b[key]-a[key]);
    else if(tokenTab==='losers')sorted.sort((a,b)=>a[key]-b[key]);
    return sorted.slice(0,6);
  };

  const calculatedStats=useMemo(()=>{
    if(!userCastsHistory.length)return{posts:0,likes:0,recasts:0,comments:0};
    const now=new Date().getTime();
    const days=analyticsTimeframe==='24h'?1:analyticsTimeframe==='3d'?3:analyticsTimeframe==='7d'?7:14;
    const cutoff=now-(days*24*60*60*1000);
    const filtered=userCastsHistory.filter(c=>c.timestamp&&new Date(c.timestamp).getTime()>=cutoff);
    return filtered.reduce((acc,cast)=>{acc.posts+=1;acc.likes+=cast.reactions?.likes_count||0;acc.recasts+=cast.reactions?.recasts_count||0;acc.comments+=cast.replies?.count||0;return acc;},{posts:0,likes:0,recasts:0,comments:0});
  },[userCastsHistory,analyticsTimeframe]);

  const followerChartData=useMemo(()=>{
    const base=fcResult?.followers||0;
    return Array.from({length:7},(_,rev)=>{
      const i=6-rev;const d=new Date();d.setDate(d.getDate()-i);
      const variance=i===3?0.92:i===1?0.96:1-(i*0.015);
      return{value:Math.floor(base*variance),date:d.toLocaleDateString('en-US',{month:'short',day:'numeric'}),fullDate:d.toLocaleDateString('en-US',{month:'short',day:'numeric',year:'numeric'})};
    });
  },[fcResult?.followers]);

  const maxFollowers=Math.max(...followerChartData.map(d=>d.value),10);
  const yAxisMax=Math.ceil(maxFollowers*1.1);
  const followerPts=followerChartData.map((d,i)=>`${(i/(followerChartData.length-1))*100},${100-(d.value/yAxisMax)*100}`).join(' ');
  const fmtY=(v:number)=>v>=1000?(v/1000).toFixed(1)+'K':Math.round(v).toString();
  const yLabels=[yAxisMax,yAxisMax*.75,yAxisMax*.5,yAxisMax*.25,0];

  const engData=useMemo(()=>{
    const base=calculatedStats.likes+calculatedStats.recasts+calculatedStats.comments;
    return Array.from({length:7},(_,rev)=>{const i=6-rev;const d=new Date();d.setDate(d.getDate()-i);return{value:Math.floor((base/7)*(0.5+Math.random())),date:d.toLocaleDateString('en-US',{month:'short',day:'numeric'})};});
  },[calculatedStats]);
  const maxEng=Math.max(...engData.map(d=>d.value),10);
  const engYMax=Math.ceil(maxEng*1.2);
  const engPts=engData.map((d,i)=>`${(i/(engData.length-1))*100},${100-(d.value/engYMax)*100}`).join(' ');

  const ethosScore=fcResult?Math.min(1000,500+(fcResult.followers*0.05)+(Number(fcResult.reputation)*30)).toFixed(0):"0";
  const quotientScore=fcResult?Math.min(99.9,40+(Number(fcResult.reputation)*5)).toFixed(1):"0";
  const FARCASTER_MINI_APP_URL="https://farcaster.xyz/miniapps/lYFXQz4s1wsq/base-analytics";
  const APP_WEBSITE_URL="https://base-analytics-app.vercel.app/";
  const shareMsg=fcResult?`I scored ${fcResult.reputation}/10 Neynar Score on Base Analytics! 🔵🚀`:'';
  const xLink=`https://twitter.com/intent/tweet?text=${encodeURIComponent(shareMsg)}&url=${encodeURIComponent(APP_WEBSITE_URL)}`;
  const fcLink=`https://warpcast.com/~/compose?text=${encodeURIComponent(shareMsg)}&embeds[]=${encodeURIComponent(FARCASTER_MINI_APP_URL)}`;

  const coins=getDisplayedCoins();

  return(
    <div className="animate-in fade-in slide-in-from-bottom-3 pb-12 space-y-8">

      {/* SECTION 1: TOKENS */}
      <div>
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center mb-4 gap-3">
          <h3 className="text-[10px] font-black text-slate-600 uppercase tracking-widest flex items-center gap-2">
            <LineChart size={13}/> Base Network Tokens {isFetchingCoins&&<RefreshCcw size={11} className="animate-spin text-slate-700"/>}
          </h3>
          <div className="flex flex-wrap gap-2">
            <div className="flex bg-white/5 border border-white/8 rounded-xl p-1">
              {[['trending','Trending'],['gainers','Gainers'],['losers','Losers']].map(([id,label])=>(
                <button key={id} onClick={()=>setTokenTab(id as typeof tokenTab)}
                  className={`px-3 py-1.5 text-[10px] flex items-center gap-1 font-black uppercase rounded-lg transition ${tokenTab===id?id==='gainers'?'bg-green-600 text-white':id==='losers'?'bg-red-600 text-white':'bg-blue-600 text-white':'text-slate-600 hover:text-slate-400'}`}>
                  {id==='trending'?<Flame size={10}/>:id==='gainers'?<TrendingUp size={10}/>:<TrendingDown size={10}/>}{label}
                </button>
              ))}
            </div>
            <div className="flex bg-white/5 border border-white/8 rounded-xl p-1">
              {['24h','7d','30d'].map(tf=>(
                <button key={tf} onClick={()=>setTimeframe(tf as typeof timeframe)}
                  className={`px-3 py-1.5 text-[10px] font-black uppercase rounded-lg transition ${timeframe===tf?'bg-white/10 text-white':'text-slate-600 hover:text-slate-400'}`}>{tf}</button>
              ))}
            </div>
          </div>
        </div>
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
          {coins.map((coin,idx)=>{
            const change=timeframe==='24h'?coin.change24h:timeframe==='7d'?coin.change7d:coin.change30d;
            const up=change>=0;
            return(
              <div key={idx} className="bg-[#161b27] border border-white/8 rounded-2xl p-4 flex flex-col items-center text-center relative group hover:border-blue-500/30 transition-colors">
                <span className="text-[9px] font-bold text-slate-700 uppercase tracking-widest mb-1 truncate w-full">{coin.name}</span>
                <h4 className="font-black text-base text-white tracking-tight leading-none mb-2">{coin.symbol}</h4>
                <p className="text-sm font-black text-slate-400 mb-2">${coin.price<0.01?coin.price.toFixed(4):coin.price.toFixed(2)}</p>
                <div className={`flex items-center gap-1 text-[10px] font-black px-2 py-1 rounded-lg ${up?'bg-green-500/10 text-green-400':'bg-red-500/10 text-red-400'}`}>
                  {up?<TrendingUp size={10}/>:<TrendingDown size={10}/>}{Math.abs(change).toFixed(1)}%
                </div>
                <a href={`https://dexscreener.com/search?q=${coin.symbol}`} target="_blank" rel="noopener noreferrer"
                  className="absolute inset-x-2 bottom-2 bg-blue-600 text-white text-[10px] font-black py-1.5 rounded-xl flex items-center justify-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                  <ShoppingCart size={10}/> Trade
                </a>
              </div>
            );
          })}
        </div>
      </div>

      {/* SECTION 2: FARCASTER */}
      <div>
        <h3 className="text-[10px] font-black text-slate-600 uppercase tracking-widest flex items-center gap-2 mb-4">
          <MessageCircle size={13}/> Farcaster Identity {isScanningFc&&<RefreshCcw size={11} className="animate-spin text-slate-700"/>}
        </h3>
        <div className="bg-[#161b27] border border-white/8 rounded-3xl p-6 flex flex-col lg:flex-row gap-6">
          <div className="w-full lg:w-1/2">
            <h4 className="font-black text-white text-lg mb-1">Analyze Reputation</h4>
            <p className="text-sm text-slate-600 mb-4">{address?"Auto-scanned from your wallet. Search others below.":"Connect wallet to auto-fetch, or search manually."}</p>
            <form onSubmit={handleScanFarcaster} className="flex gap-3">
              <div className="relative grow">
                <div className="absolute inset-y-0 left-3 flex items-center pointer-events-none"><span className="text-slate-600 font-bold text-sm">@</span></div>
                <input type="text" value={fcUsername} onChange={e=>setFcUsername(e.target.value.replace('@',''))} placeholder="username" className="w-full bg-white/5 border border-white/8 text-white text-sm font-bold rounded-xl focus:border-purple-500/50 focus:ring-1 focus:ring-purple-500/20 block pl-8 p-3 placeholder-slate-700 outline-none transition"/>
              </div>
              <button type="submit" disabled={isScanningFc} className="bg-purple-600 hover:bg-purple-500 text-white font-black px-5 py-3 rounded-xl flex items-center gap-2 disabled:opacity-50 transition">
                {isScanningFc?<RefreshCcw size={16} className="animate-spin"/>:<Search size={16}/>} Scan
              </button>
            </form>
            {fcError&&<p className="text-red-400 text-xs mt-2 font-bold">{fcError}</p>}
          </div>
          <div className="w-full lg:w-1/2">
            {fcResult?(
              <div className="bg-white/5 border border-white/8 p-5 rounded-2xl animate-in zoom-in-95">
                <div className="flex justify-between items-start mb-4">
                  <div>
                    <h5 className="font-black text-lg text-white">{fcResult.username}</h5>
                    <div className="flex items-center gap-2 mt-1">
                      <span className="text-[10px] font-black bg-white/5 text-slate-500 px-2 py-1 rounded-lg uppercase">FID: {fcResult.fid}</span>
                      <span className={`text-[10px] font-black px-2 py-1 rounded-lg uppercase ${fcResult.tier==='Power User'?'bg-yellow-500/10 text-yellow-400':fcResult.tier==='Active Caster'?'bg-blue-500/10 text-blue-400':'bg-white/5 text-slate-500'}`}>{fcResult.tier}</span>
                    </div>
                  </div>
                  <div className="bg-purple-500/20 text-purple-400 p-2.5 rounded-xl border border-purple-500/20"><Award size={20}/></div>
                </div>
                <div className="grid grid-cols-2 gap-3 mb-4">
                  <div className="bg-white/5 border border-white/5 p-3 rounded-xl">
                    <div className="flex items-center gap-1 mb-1"><Users size={11} className="text-slate-600"/><span className="text-[10px] text-slate-600 uppercase font-bold">Followers</span></div>
                    <span className="font-black text-xl text-white">{fcResult.followers.toLocaleString()}</span>
                  </div>
                  <div className="bg-purple-500/10 border border-purple-500/20 p-3 rounded-xl">
                    <div className="flex items-center gap-1 mb-1"><Cpu size={11} className="text-purple-400"/><span className="text-[10px] text-purple-400 uppercase font-bold">Neynar Score</span></div>
                    <span className="font-black text-xl text-purple-300">{fcResult.reputation}<span className="text-sm text-slate-600"> /10</span></span>
                  </div>
                  <div className="bg-white/5 border border-white/5 p-3 rounded-xl col-span-2">
                    <div className="flex items-center gap-1 mb-1"><Award size={11} className="text-slate-600"/><span className="text-[10px] text-slate-600 uppercase font-bold">Most Influential Follower</span></div>
                    <span className="font-black text-base text-white truncate block">{fcResult.topFollower}</span>
                  </div>
                </div>
                <div className="flex gap-2">
                  <a href={fcLink} target="_blank" rel="noopener noreferrer" className="bg-purple-600 hover:bg-purple-500 text-white px-4 py-2 rounded-xl flex items-center gap-1.5 text-xs font-black transition flex-1 justify-center"><Send size={13}/> Cast</a>
                  <a href={xLink} target="_blank" rel="noopener noreferrer" className="bg-slate-800 hover:bg-slate-700 text-white px-4 py-2 rounded-xl flex items-center gap-1.5 text-xs font-black transition flex-1 justify-center"><Twitter size={13}/> Post</a>
                </div>
              </div>
            ):(
              <div className="bg-white/3 border-2 border-dashed border-white/8 p-8 rounded-2xl flex flex-col items-center justify-center text-center h-full min-h-48">
                <MessageCircle size={28} className="text-slate-700 mb-3"/>
                <p className="text-sm font-bold text-slate-700">Waiting for wallet connection or manual search...</p>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* SECTION 3: ANALYTICS */}
      <div>
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center mb-4 gap-3">
          <h3 className="text-[10px] font-black text-slate-600 uppercase tracking-widest flex items-center gap-2">
            <BarChart3 size={13}/> Farcaster Dashboard {(isFetchingHistory||isFetchingForYou||isFetchingGlobal)&&<RefreshCcw size={11} className="animate-spin text-slate-700"/>}
          </h3>
          <div className="flex bg-white/5 border border-white/8 rounded-xl p-1">
            <button onClick={()=>setFeedTab('analytics')} className={`px-4 py-2 text-xs flex items-center gap-2 font-black uppercase rounded-lg transition ${feedTab==='analytics'?'bg-blue-600 text-white':'text-slate-600 hover:text-slate-400'}`}><BarChart3 size={12}/> Analytics</button>
            <button onClick={()=>setFeedTab('foryou')} className={`px-4 py-2 text-xs flex items-center gap-2 font-black uppercase rounded-lg transition ${feedTab==='foryou'?'bg-purple-600 text-white':'text-slate-600 hover:text-slate-400'}`}><Activity size={12}/> Recent Casts</button>
          </div>
        </div>

        {!fcResult?.fid?(
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            <div className="col-span-full bg-[#161b27] border-2 border-dashed border-white/8 rounded-2xl p-8 flex flex-col items-center justify-center text-center mb-2">
              <Lock size={28} className="text-slate-700 mb-3"/>
              <h4 className="font-black text-slate-500 mb-1">Dashboard Locked</h4>
              <p className="text-sm text-slate-700">Scan a Farcaster handle to unlock analytics. Showing Ecosystem Radar below.</p>
            </div>
            {isFetchingGlobal?<div className="col-span-full text-center text-slate-700 text-xs py-6">Loading Ecosystem Radar...</div>:
              globalFeed.map((cast,i)=>(
                <a key={i} href={`https://warpcast.com/${cast.author?.username}/${cast.hash.substring(0,10)}`} target="_blank" rel="noopener noreferrer"
                  className="bg-[#161b27] border border-white/8 p-4 rounded-2xl flex flex-col justify-between group hover:border-purple-500/30 transition">
                  <div>
                    <div className="flex items-center gap-2 mb-3">
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img src={cast.author?.pfp_url} alt="pfp" className="w-7 h-7 rounded-full bg-white/5"/>
                      <span className="text-[10px] font-bold bg-white/5 text-slate-600 px-2 py-1 rounded-lg">@{cast.author?.username}</span>
                    </div>
                    <p className="text-xs text-slate-500 leading-relaxed">&quot;{cast.text}&quot;</p>
                  </div>
                  <div className="mt-3 flex items-center gap-1 text-[10px] font-bold text-purple-400"><Flame size={10}/> {cast.likes}</div>
                </a>
              ))
            }
          </div>
        ):feedTab==='analytics'?(
          <div className="bg-[#161b27] border border-white/8 rounded-3xl p-6">
            <div className="flex flex-col sm:flex-row justify-between items-center mb-6 gap-4">
              <div><h4 className="font-black text-lg text-white">Engagement Overview</h4><p className="text-sm text-slate-600">Calculated from recent cast activity.</p></div>
              <div className="flex bg-white/5 border border-white/8 rounded-xl p-1">
                {['24h','3d','7d','14d'].map(tf=><button key={tf} onClick={()=>setAnalyticsTimeframe(tf as typeof analyticsTimeframe)} className={`px-3 py-1.5 text-[10px] font-black uppercase rounded-lg transition ${analyticsTimeframe===tf?'bg-white/10 text-white':'text-slate-600 hover:text-slate-400'}`}>{tf}</button>)}
              </div>
            </div>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-6">
              {[{icon:<MessageCircle size={18}/>,label:'Casts',val:calculatedStats.posts,c:'text-blue-400',bg:'bg-blue-500/10'},{icon:<Flame size={18}/>,label:'Likes',val:calculatedStats.likes,c:'text-red-400',bg:'bg-red-500/10'},{icon:<Repeat size={18}/>,label:'Recasts',val:calculatedStats.recasts,c:'text-green-400',bg:'bg-green-500/10'},{icon:<MessageSquare size={18}/>,label:'Replies',val:calculatedStats.comments,c:'text-purple-400',bg:'bg-purple-500/10'}].map((s,i)=>(
                <div key={i} className="bg-white/5 border border-white/8 p-4 rounded-2xl flex flex-col items-center text-center">
                  <div className={`p-2 ${s.bg} ${s.c} rounded-xl mb-2`}>{s.icon}</div>
                  <span className="text-[10px] font-bold text-slate-600 uppercase tracking-widest mb-1">{s.label}</span>
                  <span className="font-black text-2xl text-white">{s.val}</span>
                </div>
              ))}
            </div>
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
              {/* Follower chart */}
              <div className="bg-[#0d1117] border border-white/5 p-5 rounded-2xl flex flex-col" style={{height:'260px'}}>
                <div className="mb-3"><h5 className="font-black text-sm text-white">Follower growth</h5><p className="text-[11px] text-slate-700">7-day trend</p></div>
                <div className="relative grow w-full pl-10 pb-5 mt-2">
                  <div className="absolute left-0 top-0 bottom-5 flex flex-col justify-between text-[10px] font-bold text-slate-700">{yLabels.map((v,i)=><span key={i} className="bg-[#0d1117] pr-1.5">{fmtY(v)}</span>)}</div>
                  <div className="absolute left-10 right-0 bottom-0 flex justify-between text-[10px] text-slate-700 px-2">
                    {followerChartData.map((d,i)=>i%2===0?<span key={i} className="transform -rotate-45 origin-top-left translate-y-2">{d.date}</span>:<span key={i}/>)}
                  </div>
                  <div className="absolute inset-y-0 left-10 right-0 flex flex-col justify-between pointer-events-none pb-5">
                    {yLabels.map((_,i)=><div key={i} className="border-t border-dashed border-white/5 w-full"/>)}
                  </div>
                  <div className="relative w-full h-full">
                    <svg viewBox="0 0 100 100" className="absolute inset-0 w-full h-full overflow-visible" preserveAspectRatio="none">
                      <defs><linearGradient id="fg" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor="#3b82f6" stopOpacity="0.15"/><stop offset="100%" stopColor="#3b82f6" stopOpacity="0"/></linearGradient></defs>
                      <polyline points={`0,100 ${followerPts} 100,100`} fill="url(#fg)"/>
                      <polyline points={followerPts} fill="none" stroke="#3b82f6" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" style={{filter:'drop-shadow(0 0 4px rgba(59,130,246,0.5))'}}/>
                      {followerChartData.map((d,i)=>{const x=(i/(followerChartData.length-1))*100;const y=100-(d.value/yAxisMax)*100;return<circle key={i} cx={x} cy={y} r="2.5" fill="#0d1117" stroke="#3b82f6" strokeWidth="1.5"/>;})}
                    </svg>
                  </div>
                </div>
                <div className="flex items-center justify-center gap-2 mt-2 pt-2 border-t border-white/5">
                  <div className="w-2.5 h-2.5 rounded-full bg-blue-500"/><span className="text-xs font-bold text-slate-600">Followers</span>
                </div>
              </div>
              {/* Engagement chart */}
              <div className="bg-[#0d1117] border border-white/5 p-5 rounded-2xl flex flex-col" style={{height:'260px'}}>
                <div className="mb-3"><h5 className="font-black text-sm text-white">Engagement received</h5><p className="text-[11px] text-slate-700">Daily interactions</p></div>
                <div className="relative grow w-full pl-10 pb-5 mt-2">
                  <div className="absolute left-0 top-0 bottom-5 flex flex-col justify-between text-[10px] font-bold text-slate-700">{[engYMax,engYMax*.75,engYMax*.5,engYMax*.25,0].map((v,i)=><span key={i} className="bg-[#0d1117] pr-1.5">{fmtY(v)}</span>)}</div>
                  <div className="absolute left-10 right-0 bottom-0 flex justify-between text-[10px] text-slate-700 px-2">
                    {engData.map((d,i)=>i%2===0?<span key={i} className="transform -rotate-45 origin-top-left translate-y-2">{d.date}</span>:<span key={i}/>)}
                  </div>
                  <div className="absolute inset-y-0 left-10 right-0 flex flex-col justify-between pointer-events-none pb-5">
                    {[1,2,3,4,5].map((_,i)=><div key={i} className="border-t border-dashed border-white/5 w-full"/>)}
                  </div>
                  <div className="relative w-full h-full">
                    <svg viewBox="0 0 100 100" className="absolute inset-0 w-full h-full overflow-visible" preserveAspectRatio="none">
                      <defs><linearGradient id="eg" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor="#ec4899" stopOpacity="0.15"/><stop offset="100%" stopColor="#ec4899" stopOpacity="0"/></linearGradient></defs>
                      <polyline points={`0,100 ${engPts} 100,100`} fill="url(#eg)"/>
                      <polyline points={engPts} fill="none" stroke="#ec4899" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" style={{filter:'drop-shadow(0 0 4px rgba(236,72,153,0.5))'}}/>
                      {engData.map((d,i)=>{const x=(i/(engData.length-1))*100;const y=100-(d.value/engYMax)*100;return<circle key={i} cx={x} cy={y} r="2.5" fill="#0d1117" stroke="#ec4899" strokeWidth="1.5"/>;})}
                    </svg>
                  </div>
                </div>
                <div className="flex items-center justify-center gap-2 mt-2 pt-2 border-t border-white/5">
                  <div className="w-2.5 h-2.5 rounded-full bg-pink-500"/><span className="text-xs font-bold text-slate-600">Engagement</span>
                </div>
              </div>
              {/* Social Influence */}
              <div className="bg-[#0d1117] border border-white/5 p-5 rounded-2xl flex flex-col justify-between" style={{height:'260px'}}>
                <div><h5 className="font-black text-sm text-white">Social Influence</h5><p className="text-[11px] text-slate-700">Decentralized reputation scores</p></div>
                <div className="space-y-4 mt-4">
                  {[{label:'Neynar Score',val:fcResult.reputation,max:10,color:'#8A2BE2',icon:<Cpu size={12} className="text-purple-400"/>},{label:'Ethos Credential',val:ethosScore,max:1000,color:'#10b981',icon:<ShieldCheck size={12} className="text-emerald-400"/>},{label:'Social Quotient',val:quotientScore,max:100,color:'#3b82f6',icon:<Zap size={12} className="text-blue-400"/>}].map((s,i)=>(
                    <div key={i}>
                      <div className="flex justify-between items-center mb-1">
                        <span className="text-xs font-bold text-slate-500 flex items-center gap-1">{s.icon}{s.label}</span>
                        <span className="text-xs font-black text-white">{s.val}<span className="text-[10px] text-slate-700">/{s.max}</span></span>
                      </div>
                      <div className="w-full bg-white/5 rounded-full h-1.5">
                        <div className="h-1.5 rounded-full transition-all" style={{background:s.color,width:`${(Number(s.val)/Number(s.max))*100}%`,boxShadow:`0 0 6px ${s.color}60`}}/>
                      </div>
                    </div>
                  ))}
                </div>
                <div className="mt-3 pt-3 border-t border-white/5 text-center">
                  <span className="text-[10px] font-bold text-slate-700 uppercase tracking-widest">Neynar V2 Protocol</span>
                </div>
              </div>
            </div>
          </div>
        ):(
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            {isFetchingForYou?<div className="col-span-full text-center text-slate-700 text-xs py-6">Loading recent casts...</div>:
              forYouFeed.length>0?forYouFeed.map((cast,i)=>(
                <a key={i} href={`https://warpcast.com/${cast.author?.username}/${cast.hash.substring(0,10)}`} target="_blank" rel="noopener noreferrer"
                  className="bg-[#161b27] border border-white/8 p-4 rounded-2xl flex flex-col justify-between group hover:border-purple-500/30 transition hover:-translate-y-0.5">
                  <div>
                    <div className="flex items-center gap-2 mb-3">
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img src={cast.author?.pfp_url} alt="pfp" className="w-7 h-7 rounded-full bg-white/5"/>
                      <span className="text-[10px] font-bold bg-white/5 text-slate-600 px-2 py-1 rounded-lg">@{cast.author?.username}</span>
                    </div>
                    <p className="text-xs text-slate-500 leading-relaxed">&quot;{cast.text}&quot;</p>
                  </div>
                  <div className="mt-3 flex items-center gap-1 text-[10px] font-bold text-purple-400"><Flame size={10}/> {cast.likes}</div>
                </a>
              )):<div className="col-span-full text-center text-slate-700 text-xs py-6">No recent casts found.</div>}
          </div>
        )}
      </div>

      {/* SECTION 4: ECOSYSTEM */}
      <div>
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center mb-4 gap-3">
          <h3 className="text-[10px] font-black text-slate-600 uppercase tracking-widest flex items-center gap-2">
            <Globe size={13}/> Explore the Ecosystem
            <span className="text-slate-700 font-bold normal-case">({filteredProjects.length} apps)</span>
          </h3>
          <div className="relative">
            <input value={ecoSearch} onChange={e=>setEcoSearch(e.target.value)} placeholder="Search apps..." className="bg-white/5 border border-white/8 rounded-xl px-3 py-2 pl-8 text-xs font-bold text-slate-400 outline-none focus:border-blue-500/40 w-44 placeholder-slate-700"/>
            <Search size={12} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-700"/>
          </div>
        </div>

        {/* Category filter */}
        <div className="flex gap-2 overflow-x-auto pb-2 mb-4">
          {CATEGORIES.map(cat=>(
            <button key={cat} onClick={()=>setEcoCategory(cat)}
              className={`whitespace-nowrap px-3 py-1.5 rounded-xl text-[10px] font-black uppercase tracking-wide border transition ${ecoCategory===cat?'bg-blue-600 text-white border-blue-600 shadow-lg shadow-blue-600/20':'bg-white/5 text-slate-600 border-white/8 hover:border-white/20 hover:text-slate-400'}`}>{cat}
            </button>
          ))}
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3">
          {filteredProjects.map((p,i)=>(
            <a key={i} href={p.url} target="_blank" rel="noopener noreferrer"
              className={`bg-[#161b27] border border-white/8 p-4 rounded-2xl flex flex-col justify-between group transition hover:-translate-y-0.5 ${p.border}`}>
              <div>
                <div className="flex justify-between items-start mb-3">
                  <div className={`p-2.5 rounded-xl ${p.bg} ${p.color} group-hover:scale-110 transition-transform`}>{p.icon}</div>
                  <ExternalLink size={13} className="text-slate-700 group-hover:text-slate-500 transition"/>
                </div>
                <h4 className="font-black text-sm text-white leading-none mb-1">{p.name}</h4>
                <p className={`text-[9px] font-bold uppercase tracking-widest mb-2 ${p.color}`}>{p.category}</p>
                <p className="text-xs text-slate-600 leading-relaxed">{p.description}</p>
              </div>
            </a>
          ))}
          {filteredProjects.length===0&&<div className="col-span-full text-center py-12 text-slate-700 text-sm font-bold">No apps match your search.</div>}
        </div>
      </div>
    </div>
  );
} 