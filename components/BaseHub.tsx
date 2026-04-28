"use client";
import { useState, useEffect, useMemo } from 'react';
import { useAccount } from 'wagmi';
import {
  ExternalLink, Globe, Coins, Palette, MessageCircle, Fingerprint,
  Gamepad2, Layers, TrendingUp, Cpu, LineChart, TrendingDown,
  Activity, RefreshCcw, ShoppingCart, Flame, Search, Award, Users, Send, Twitter, Code, Lock,
  BarChart3, MessageSquare, Repeat, ShieldCheck, Zap, Calendar, Clock, Hash,
  Star, Target, Heart, ArrowUp, ArrowDown
} from 'lucide-react';

interface CoinData { id:string; symbol:string; name:string; price:number; change24h:number; change7d:number; change30d:number; volume:number; }
interface FarcasterData {
  username:string; fid:number; followers:number; following:number;
  reputation:string; tier:string; topFollower:string;
  fidAgeMonths:number; fidAgeLabel:string; joinedDate:string;
  pfpUrl:string; bio:string; verifications:number;
  powerBadge:boolean;
}
interface FarcasterCast { hash:string; text:string; author:{username:string;pfp_url:string;}; likes:number; }
interface RawCast { hash:string; text:string; timestamp?:string; author?:{username?:string;pfp_url?:string;pfp?:{url?:string}}; reactions?:{likes_count?:number;recasts_count?:number}; replies?:{count?:number}; }

const ECOSYSTEM_PROJECTS = [
  { name:"Aerodrome",     category:"DeFi / DEX",         description:"The central trading and liquidity hub on Base. The most liquid DEX.",      url:"https://aerodrome.finance/",             icon:<Coins size={18}/>,     color:"text-blue-400",   bg:"bg-blue-500/10",    border:"hover:border-blue-500/30" },
  { name:"Uniswap",       category:"DeFi / DEX",         description:"World's largest DEX. Swap any token with deep liquidity on Base.",          url:"https://app.uniswap.org/",               icon:<Globe size={18}/>,     color:"text-pink-400",   bg:"bg-pink-500/10",    border:"hover:border-pink-500/30" },
  { name:"Alien Base",    category:"DeFi / DEX",         description:"Base-native DEX with high-yield farming and staking rewards.",              url:"https://alienbase.xyz/",                 icon:<Coins size={18}/>,     color:"text-green-400",  bg:"bg-green-500/10",   border:"hover:border-green-500/30" },
  { name:"BaseSwap",      category:"DeFi / DEX",         description:"Community-driven DEX built natively for the Base ecosystem.",               url:"https://baseswap.fi/",                   icon:<ArrowR size={18}/>,    color:"text-orange-400", bg:"bg-orange-500/10",  border:"hover:border-orange-500/30" },
  { name:"Dackieswap",    category:"DeFi / DEX",         description:"Cute duck-themed DEX with competitive fees and farming on Base.",           url:"https://www.dackieswap.xyz/",            icon:<Coins size={18}/>,     color:"text-yellow-400", bg:"bg-yellow-500/10",  border:"hover:border-yellow-500/30" },
  { name:"SynthSwap",     category:"DeFi / DEX",         description:"Decentralized exchange with liquidity incentives on Base.",                 url:"https://synthswap.io/",                  icon:<Coins size={18}/>,     color:"text-cyan-400",   bg:"bg-cyan-500/10",    border:"hover:border-cyan-500/30" },
  { name:"Aave",          category:"DeFi / Lending",     description:"Gold-standard DeFi lending. Supply crypto to earn or borrow against.",      url:"https://app.aave.com/",                  icon:<TrendingUp size={18}/>,color:"text-cyan-400",   bg:"bg-cyan-500/10",    border:"hover:border-cyan-500/30" },
  { name:"Morpho",        category:"DeFi / Lending",     description:"Highly efficient peer-to-peer lending scaling rapidly on Base.",            url:"https://app.morpho.org/",                icon:<Layers size={18}/>,    color:"text-blue-400",   bg:"bg-blue-600/10",    border:"hover:border-blue-500/30" },
  { name:"Moonwell",      category:"DeFi / Lending",     description:"Premier open lending and borrowing protocol built natively on Base.",        url:"https://moonwell.fi/",                   icon:<TrendingUp size={18}/>,color:"text-indigo-400", bg:"bg-indigo-500/10",  border:"hover:border-indigo-500/30" },
  { name:"Seamless",      category:"DeFi / Lending",     description:"First decentralized native lending and borrowing protocol on Base.",         url:"https://seamlessprotocol.com/",          icon:<TrendingUp size={18}/>,color:"text-blue-300",   bg:"bg-blue-400/10",    border:"hover:border-blue-400/30" },
  { name:"Compound",      category:"DeFi / Lending",     description:"Algorithmic, autonomous interest rate protocol deployed on Base.",           url:"https://app.compound.finance/",          icon:<TrendingUp size={18}/>,color:"text-green-400",  bg:"bg-green-500/10",   border:"hover:border-green-500/30" },
  { name:"Silo Finance",  category:"DeFi / Lending",     description:"Isolated lending markets for safer borrowing with any token.",               url:"https://app.silo.finance/",              icon:<Layers size={18}/>,    color:"text-amber-400",  bg:"bg-amber-500/10",   border:"hover:border-amber-500/30" },
  { name:"Synthetix",     category:"DeFi / Derivatives", description:"Trade perpetual futures and synthetic assets with deep liquidity.",          url:"https://synthetix.io/",                  icon:<LineChart size={18}/>, color:"text-indigo-400", bg:"bg-indigo-400/10",  border:"hover:border-indigo-400/30" },
  { name:"Kwenta",        category:"DeFi / Derivatives", description:"Advanced perpetual futures trading powered by Synthetix on Base.",           url:"https://kwenta.eth.limo/",               icon:<LineChart size={18}/>, color:"text-yellow-400", bg:"bg-yellow-500/10",  border:"hover:border-yellow-500/30" },
  { name:"GMX",           category:"DeFi / Derivatives", description:"Decentralized spot and perpetual exchange with low swap fees on Base.",       url:"https://gmx.io/",                        icon:<LineChart size={18}/>, color:"text-blue-400",   bg:"bg-blue-500/10",    border:"hover:border-blue-500/30" },
  { name:"Contango",      category:"DeFi / Derivatives", description:"Trade leveraged fixed-rate positions using lending protocols.",               url:"https://contango.xyz/",                  icon:<LineChart size={18}/>, color:"text-purple-400", bg:"bg-purple-500/10",  border:"hover:border-purple-500/30" },
  { name:"Warpcast",      category:"Social",             description:"Premier Farcaster client. Decentralized social network on Base.",            url:"https://warpcast.com/",                  icon:<MessageCircle size={18}/>,color:"text-purple-400",bg:"bg-purple-500/10", border:"hover:border-purple-500/30" },
  { name:"Farcaster",     category:"Social",             description:"Decentralized social protocol. Build your onchain identity and network.",    url:"https://www.farcaster.xyz/",             icon:<MessageCircle size={18}/>,color:"text-purple-300",bg:"bg-purple-400/10", border:"hover:border-purple-400/30" },
  { name:"Supercast",     category:"Social",             description:"A beautiful, power-user Farcaster client with advanced features.",           url:"https://supercast.xyz/",                 icon:<MessageCircle size={18}/>,color:"text-pink-400",  bg:"bg-pink-500/10",    border:"hover:border-pink-500/30" },
  { name:"Paragraph",     category:"Social / Publishing",description:"Publish newsletters, build communities, and mint writing as NFTs.",           url:"https://paragraph.xyz/",                 icon:<Activity size={18}/>,  color:"text-orange-400", bg:"bg-orange-500/10",  border:"hover:border-orange-500/30" },
  { name:"Bountycaster",  category:"Social",             description:"Create and complete crypto bounties across the Farcaster network.",          url:"https://www.bountycaster.xyz/",          icon:<Layers size={18}/>,    color:"text-emerald-400",bg:"bg-emerald-500/10", border:"hover:border-emerald-500/30" },
  { name:"Blackbird",     category:"Social / Loyalty",   description:"Earn crypto rewards for visiting your favorite restaurants onchain.",         url:"https://blackbird.xyz/",                 icon:<Award size={18}/>,     color:"text-slate-300",  bg:"bg-white/5",        border:"hover:border-white/20" },
  { name:"Zora",          category:"NFTs / Creators",    description:"Mint, collect, and create beautiful onchain media and NFT collections.",     url:"https://zora.co/",                       icon:<Palette size={18}/>,   color:"text-rose-400",   bg:"bg-rose-500/10",    border:"hover:border-rose-500/30" },
  { name:"Sound.xyz",     category:"Music / NFTs",       description:"Discover new music. Collect songs directly from artists onchain.",           url:"https://www.sound.xyz/",                 icon:<Palette size={18}/>,   color:"text-purple-400", bg:"bg-purple-500/10",  border:"hover:border-purple-500/30" },
  { name:"BasePaint",     category:"NFTs / Art",         description:"Collaborative pixel art canvas where artists share mint revenue.",           url:"https://basepaint.xyz/",                 icon:<Palette size={18}/>,   color:"text-blue-400",   bg:"bg-blue-400/10",    border:"hover:border-blue-400/30" },
  { name:"Magic Eden",    category:"NFT Marketplace",    description:"Discover, trade, and collect top trending NFTs on the Base network.",        url:"https://magiceden.io/base",              icon:<Globe size={18}/>,     color:"text-fuchsia-400",bg:"bg-fuchsia-500/10", border:"hover:border-fuchsia-500/30" },
  { name:"OpenSea",       category:"NFT Marketplace",    description:"The world's largest NFT marketplace, fully integrated with Base.",           url:"https://opensea.io/",                    icon:<Globe size={18}/>,     color:"text-blue-400",   bg:"bg-blue-500/10",    border:"hover:border-blue-500/30" },
  { name:"Foundation",    category:"NFTs / Art",         description:"Premier destination to discover and collect exclusive digital art.",          url:"https://foundation.app/",                icon:<Palette size={18}/>,   color:"text-slate-300",  bg:"bg-white/5",        border:"hover:border-white/20" },
  { name:"Manifold",      category:"NFTs / Creators",    description:"Professional NFT creation tools. Launch your own smart contract.",           url:"https://manifold.xyz/",                  icon:<Palette size={18}/>,   color:"text-orange-400", bg:"bg-orange-500/10",  border:"hover:border-orange-500/30" },
  { name:"Highlight",     category:"NFTs / Creators",    description:"Create, mint, and distribute NFTs at scale with powerful tools.",            url:"https://highlight.xyz/",                 icon:<Palette size={18}/>,   color:"text-yellow-400", bg:"bg-yellow-500/10",  border:"hover:border-yellow-500/30" },
  { name:"Decent",        category:"NFTs / Commerce",    description:"Buy, sell, and trade NFTs across chains. Cross-chain NFT infrastructure.",   url:"https://decent.xyz/",                    icon:<Globe size={18}/>,     color:"text-pink-400",   bg:"bg-pink-500/10",    border:"hover:border-pink-500/30" },
  { name:"Layer3",        category:"Quests / Gaming",    description:"Complete interactive quests to learn Web3 skills and earn rewards.",         url:"https://layer3.xyz/",                    icon:<Gamepad2 size={18}/>,  color:"text-yellow-400", bg:"bg-yellow-500/10",  border:"hover:border-yellow-500/30" },
  { name:"Frenpet",       category:"Gaming",             description:"Tamagotchi meets crypto. Adopt, feed, and battle digital pets onchain.",     url:"https://frenpet.com/",                   icon:<Gamepad2 size={18}/>,  color:"text-orange-400", bg:"bg-orange-500/10",  border:"hover:border-orange-500/30" },
  { name:"Parallel",      category:"Gaming / TCG",       description:"Sci-fi collectible card game with true onchain asset ownership.",            url:"https://parallel.life/",                 icon:<Gamepad2 size={18}/>,  color:"text-indigo-400", bg:"bg-indigo-400/10",  border:"hover:border-indigo-400/30" },
  { name:"Words3",        category:"Gaming",             description:"Competitive multiplayer word game powered by Base smart contracts.",          url:"https://www.words3.xyz/",                icon:<Gamepad2 size={18}/>,  color:"text-cyan-400",   bg:"bg-cyan-500/10",    border:"hover:border-cyan-500/30" },
  { name:"Moxy",          category:"Gaming / E-Sports",  description:"Compete in skill-based games and tournaments to win real crypto.",           url:"https://moxy.io/",                       icon:<Gamepad2 size={18}/>,  color:"text-red-400",    bg:"bg-red-500/10",     border:"hover:border-red-500/30" },
  { name:"Onchain Heroes",category:"Gaming / RPG",       description:"Browser-based onchain RPG with tokenized heroes and quests.",                url:"https://www.onchainhero.io/",            icon:<Gamepad2 size={18}/>,  color:"text-amber-400",  bg:"bg-amber-500/10",   border:"hover:border-amber-500/30" },
  { name:"Isekai Meta",   category:"Gaming / RPG",       description:"Onchain anime RPG with character NFTs and battle mechanics on Base.",        url:"https://isekaimeta.com/",                icon:<Gamepad2 size={18}/>,  color:"text-purple-400", bg:"bg-purple-500/10",  border:"hover:border-purple-500/30" },
  { name:"Basenames",     category:"Identity",           description:"Claim your unique .base.eth username and build your onchain reputation.",    url:"https://www.base.org/names",             icon:<Fingerprint size={18}/>,color:"text-blue-400",  bg:"bg-blue-500/10",    border:"hover:border-blue-500/30" },
  { name:"ENS",           category:"Identity",           description:"Ethereum Name Service. Your .eth identity works everywhere on Base.",        url:"https://app.ens.domains/",               icon:<Fingerprint size={18}/>,color:"text-blue-300",  bg:"bg-blue-400/10",    border:"hover:border-blue-400/30" },
  { name:"Coinbase ID",   category:"Identity",           description:"Verified onchain identity backed by Coinbase. One click verification.",      url:"https://www.coinbase.com/onchain-verify",icon:<Fingerprint size={18}/>,color:"text-blue-500",  bg:"bg-blue-600/10",    border:"hover:border-blue-600/30" },
  { name:"Neynar",        category:"Dev Tools",          description:"The ultimate Farcaster developer hub. Build social AI agents instantly.",    url:"https://neynar.com/",                    icon:<Cpu size={18}/>,       color:"text-yellow-400", bg:"bg-yellow-500/10",  border:"hover:border-yellow-500/30" },
  { name:"Thirdweb",      category:"Dev Tools",          description:"Complete Web3 dev framework. Deploy contracts and build dApps in minutes.",  url:"https://thirdweb.com/",                  icon:<Code size={18}/>,      color:"text-fuchsia-400",bg:"bg-fuchsia-600/10", border:"hover:border-fuchsia-500/30" },
  { name:"Privy",         category:"Dev Tools",          description:"Drop-in Web3 auth. Let users sign in with email, social, or wallets.",       url:"https://www.privy.io/",                  icon:<Fingerprint size={18}/>,color:"text-sky-400",   bg:"bg-sky-500/10",     border:"hover:border-sky-500/30" },
  { name:"Coinbase CDP",  category:"Dev Tools",          description:"Coinbase Developer Platform. Build secure scalable onchain applications.",   url:"https://portal.cdp.coinbase.com/",       icon:<Cpu size={18}/>,       color:"text-blue-400",   bg:"bg-blue-500/10",    border:"hover:border-blue-500/30" },
  { name:"Alchemy",       category:"Dev Tools",          description:"Web3 development platform. Reliable Base RPC, NFT APIs, and indexing.",      url:"https://www.alchemy.com/",               icon:<Cpu size={18}/>,       color:"text-blue-300",   bg:"bg-blue-400/10",    border:"hover:border-blue-400/30" },
  { name:"QuickNode",     category:"Dev Tools",          description:"Fast Base RPC provider with analytics, alerts, and add-ons.",                url:"https://www.quicknode.com/",             icon:<Cpu size={18}/>,       color:"text-orange-400", bg:"bg-orange-500/10",  border:"hover:border-orange-500/30" },
  { name:"Hardhat",       category:"Dev Tools",          description:"Ethereum dev environment with Base network support. Test and deploy easily.", url:"https://hardhat.org/",                   icon:<Code size={18}/>,      color:"text-yellow-500", bg:"bg-yellow-500/10",  border:"hover:border-yellow-500/30" },
  { name:"Foundry",       category:"Dev Tools",          description:"Blazing fast Solidity testing framework. The go-to for Base devs.",          url:"https://getfoundry.sh/",                 icon:<Code size={18}/>,      color:"text-red-400",    bg:"bg-red-500/10",     border:"hover:border-red-500/30" },
  { name:"Guild",         category:"Community Tools",    description:"Automate membership and create token-gated roles for any community.",        url:"https://guild.xyz/base",                 icon:<Users size={18}/>,     color:"text-slate-400",  bg:"bg-white/5",        border:"hover:border-white/20" },
  { name:"Superfluid",    category:"Dev Tools",          description:"Real-time finance protocol. Stream tokens by the second on Base.",           url:"https://www.superfluid.finance/",        icon:<Layers size={18}/>,    color:"text-green-400",  bg:"bg-green-500/10",   border:"hover:border-green-500/30" },
  { name:"Base Bridge",   category:"Bridge",             description:"Official Coinbase bridge. Move ETH and tokens between Ethereum and Base.",   url:"https://bridge.base.org/",               icon:<ArrowR size={18}/>,    color:"text-blue-400",   bg:"bg-blue-500/10",    border:"hover:border-blue-500/30" },
  { name:"Across",        category:"Bridge",             description:"Fastest token bridge powered by UMA's optimistic oracle on Base.",           url:"https://across.to/",                     icon:<ArrowR size={18}/>,    color:"text-green-400",  bg:"bg-green-500/10",   border:"hover:border-green-500/30" },
  { name:"Stargate",      category:"Bridge",             description:"Fully composable native asset bridge with unified liquidity pools.",         url:"https://stargate.finance/",              icon:<ArrowR size={18}/>,    color:"text-blue-300",   bg:"bg-blue-400/10",    border:"hover:border-blue-400/30" },
  { name:"Socket",        category:"Bridge",             description:"Cross-chain interoperability protocol. Move assets anywhere.",               url:"https://www.socket.tech/",               icon:<ArrowR size={18}/>,    color:"text-purple-400", bg:"bg-purple-500/10",  border:"hover:border-purple-500/30" },
  { name:"Relay",         category:"Bridge",             description:"Instant cross-chain bridge with gasless execution on Base.",                 url:"https://relay.link/",                    icon:<ArrowR size={18}/>,    color:"text-cyan-400",   bg:"bg-cyan-500/10",    border:"hover:border-cyan-500/30" },
  { name:"Circle USDC",   category:"Stablecoins",        description:"Native USDC on Base. The most trusted stablecoin, natively issued.",         url:"https://www.circle.com/usdc",            icon:<Coins size={18}/>,     color:"text-blue-400",   bg:"bg-blue-500/10",    border:"hover:border-blue-500/30" },
  { name:"Coinbase Pay",  category:"Payments",           description:"Onramp fiat to crypto instantly. Buy Base ETH with card or bank.",           url:"https://pay.coinbase.com/",              icon:<Coins size={18}/>,     color:"text-blue-500",   bg:"bg-blue-600/10",    border:"hover:border-blue-600/30" },
  { name:"Dune Analytics",category:"Data",               description:"Query, visualize, and share Base blockchain data with SQL.",                 url:"https://dune.com/",                      icon:<BarChart3 size={18}/>, color:"text-orange-400", bg:"bg-orange-500/10",  border:"hover:border-orange-500/30" },
  { name:"Dexscreener",   category:"Data",               description:"Live price charts, trending tokens, and DEX analytics on Base.",             url:"https://dexscreener.com/base",           icon:<LineChart size={18}/>, color:"text-green-400",  bg:"bg-green-500/10",   border:"hover:border-green-500/30" },
  { name:"Basescan",      category:"Data",               description:"Official Base block explorer. Track transactions, addresses, and contracts.", url:"https://basescan.org/",                  icon:<Globe size={18}/>,     color:"text-blue-400",   bg:"bg-blue-500/10",    border:"hover:border-blue-500/30" },
  { name:"DefiLlama",     category:"Data",               description:"Trustless, accurate DeFi TVL data and analytics for Base protocols.",        url:"https://defillama.com/chain/Base",       icon:<BarChart3 size={18}/>, color:"text-teal-400",   bg:"bg-teal-500/10",    border:"hover:border-teal-500/30" },
];

function ArrowR({size}:{size:number}){return(<svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="m9 18 6-6-6-6"/></svg>);}

const CATEGORIES=['All','DeFi / DEX','DeFi / Lending','DeFi / Derivatives','NFTs / Creators','NFT Marketplace','Gaming','Social','Identity','Dev Tools','Bridge','Data'];

const NEYNAR_API_KEY='C47D2A28-6050-485E-8C4B-E49945213403';

function getFidAgeMonths(fid:number):number {
  // Approximate FID registration date based on FID ranges
  // FID 1-1000: ~Jan 2023, FID 100k: ~Aug 2023, FID 500k: ~Feb 2024, FID 1M+: ~Aug 2024
  const now = new Date();
  let joinDate: Date;
  if (fid < 1000) joinDate = new Date('2023-01-15');
  else if (fid < 5000) joinDate = new Date('2023-02-15');
  else if (fid < 10000) joinDate = new Date('2023-03-15');
  else if (fid < 20000) joinDate = new Date('2023-04-15');
  else if (fid < 50000) joinDate = new Date('2023-06-15');
  else if (fid < 100000) joinDate = new Date('2023-08-15');
  else if (fid < 200000) joinDate = new Date('2023-11-15');
  else if (fid < 300000) joinDate = new Date('2024-01-15');
  else if (fid < 500000) joinDate = new Date('2024-03-15');
  else if (fid < 750000) joinDate = new Date('2024-06-15');
  else joinDate = new Date('2024-09-15');
  const months = (now.getFullYear()-joinDate.getFullYear())*12+(now.getMonth()-joinDate.getMonth());
  return Math.max(1, months);
}

function getJoinedDate(fid:number):string {
  if (fid < 1000) return 'Jan 2023';
  if (fid < 5000) return 'Feb 2023';
  if (fid < 10000) return 'Mar 2023';
  if (fid < 20000) return 'Apr 2023';
  if (fid < 50000) return 'Jun 2023';
  if (fid < 100000) return 'Aug 2023';
  if (fid < 200000) return 'Nov 2023';
  if (fid < 300000) return 'Jan 2024';
  if (fid < 500000) return 'Mar 2024';
  if (fid < 750000) return 'Jun 2024';
  return 'Sep 2024';
}

const fetchNeynarScore=async(fid:number):Promise<number>=>{
  try{
    const res=await fetch(`https://api.neynar.com/v2/farcaster/user/bulk?fids=${fid}`,{headers:{'accept':'application/json','x-api-key':NEYNAR_API_KEY}});
    const data=await res.json();
    const user=data?.users?.[0];
    const score=user?.experimental?.neynar_user_score??user?.score;
    if(score!==null&&score!==undefined){let n=Number(score);if(n<=1.0&&n>0)n*=10;return Math.min(10,parseFloat(n.toFixed(2)));}
    const fidBonus=fid<1000?3.5:fid<10000?2.5:fid<100000?1.5:0.5;
    const followerBonus=Math.min(3.5,(user?.follower_count||0)/1000);
    return Math.min(9.9,parseFloat((4.0+fidBonus+followerBonus).toFixed(2)));
  }catch{return 0;}
};

const fetchTopFollower=async(fid:number):Promise<string>=>{
  try{
    const res=await fetch(`https://api.neynar.com/v2/farcaster/followers?fid=${fid}&limit=50`,{headers:{'accept':'application/json','x-api-key':NEYNAR_API_KEY}});
    const data=await res.json();
    if(data.users&&data.users.length>0){const sorted=data.users.sort((a:{follower_count:number},b:{follower_count:number})=>b.follower_count-a.follower_count);return`@${sorted[0].username}`;}
  }catch{}
  return'None found';
};

const buildFcResult=async(user:Record<string,unknown>):Promise<FarcasterData>=>{
  const fid=Number(user.fid);
  const followers=Number(user.follower_count)||0;
  const following=Number(user.following_count)||0;
  const score=await fetchNeynarScore(fid);
  const topFollower=await fetchTopFollower(fid);
  const fidAgeMonths=getFidAgeMonths(fid);
  const tier=score>8.0?'Power User':score>6.0?'Active Caster':score>4.0?'Regular':'Newcomer';
  return{
    username:`@${user.username}`,fid,followers,following,
    reputation:score.toFixed(1),tier,topFollower,
    fidAgeMonths, fidAgeLabel:`${fidAgeMonths} months`,
    joinedDate:getJoinedDate(fid),
    pfpUrl:String(user.pfp_url||''),
    bio:String((user.profile as Record<string,Record<string,unknown>>|undefined)?.bio?.text||''),
    verifications:Number((user.verifications as string[]|undefined)?.length||0),
    powerBadge:Boolean(user.power_badge),
  };
};

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
  const[scannedAddress,setScannedAddress]=useState('');

  const[analyticsTimeframe,setAnalyticsTimeframe]=useState<'24h'|'3d'|'7d'|'14d'|'30d'>('7d');
  const[userCastsHistory,setUserCastsHistory]=useState<RawCast[]>([]);
  const[forYouFeed,setForYouFeed]=useState<FarcasterCast[]>([]);
  const[globalFeed,setGlobalFeed]=useState<FarcasterCast[]>([]);
  const[isFetchingHistory,setIsFetchingHistory]=useState(false);
  const[isFetchingForYou,setIsFetchingForYou]=useState(false);
  const[isFetchingGlobal,setIsFetchingGlobal]=useState(false);
  const[feedTab,setFeedTab]=useState<'stats'|'casts'>('stats');

  const[ecoCategory,setEcoCategory]=useState('All');
  const[ecoSearch,setEcoSearch]=useState('');

  const filteredProjects=useMemo(()=>ECOSYSTEM_PROJECTS.filter(p=>{
    const mc=ecoCategory==='All'||p.category===ecoCategory||p.category.startsWith(ecoCategory);
    const ms=ecoSearch===''||p.name.toLowerCase().includes(ecoSearch.toLowerCase())||p.description.toLowerCase().includes(ecoSearch.toLowerCase());
    return mc&&ms;
  }),[ecoCategory,ecoSearch]);

  useEffect(()=>{
    const fetchPrices=async()=>{
      try{
        const IDS='degen-base,aerodrome-finance,based-brett,higher,toshi,virtual-protocol,moonwell,seamless-protocol,alien-base,mfercoin,base-god,doginme,frenpet,ski-mask-dog,mister-miggles,keyboard-cat-2,basenji,wow-3,luna-virtuals,ben-dog,roost,mumu-the-bull';
        const res=await fetch(`https://api.coingecko.com/api/v3/coins/markets?vs_currency=usd&ids=${IDS}&order=volume_desc&price_change_percentage=24h,7d,30d`);
        const data=await res.json();
        if(data&&data.length>0){setAllCoins(data.map((c:Record<string,unknown>)=>({id:String(c.id),symbol:String(c.symbol).toUpperCase(),name:String(c.name),price:Number(c.current_price)||0,change24h:Number(c.price_change_percentage_24h_in_currency)||0,change7d:Number(c.price_change_percentage_7d_in_currency)||0,change30d:Number(c.price_change_percentage_30d_in_currency)||0,volume:Number(c.total_volume)||0})));}
      }catch(e){console.error(e);}finally{setIsFetchingCoins(false);}
    };
    fetchPrices();const t=setInterval(fetchPrices,60000);return()=>clearInterval(t);
  },[]);

  useEffect(()=>{
    if(!address||address===scannedAddress)return;
    const auto=async()=>{
      setScannedAddress(address);setIsScanningFc(true);setFcError('');
      try{
        const res=await fetch(`https://api.neynar.com/v2/farcaster/user/bulk-by-address?addresses=${address}`,{headers:{'accept':'application/json','x-api-key':NEYNAR_API_KEY}});
        const data=await res.json();
        const lower=address.toLowerCase();
        if(data&&data[lower]&&data[lower].length>0){setFcResult(await buildFcResult(data[lower][0]));}
      }catch(e){console.error(e);}finally{setIsScanningFc(false);}
    };
    auto();
  },[address,scannedAddress]);

  useEffect(()=>{
    if(!fcResult?.fid)return;
    const fetch2=async()=>{
      setIsFetchingHistory(true);
      try{const res=await fetch(`https://api.neynar.com/v2/farcaster/feed/user/casts?fid=${fcResult.fid}&limit=100`,{headers:{'accept':'application/json','x-api-key':NEYNAR_API_KEY}});const data=await res.json();if(data.casts)setUserCastsHistory(data.casts);}
      catch{}finally{setIsFetchingHistory(false);}
    };
    fetch2();
  },[fcResult?.fid]);

  useEffect(()=>{
    if(feedTab!=='casts'||!fcResult?.fid)return;
    const fetch3=async()=>{
      setIsFetchingForYou(true);
      try{const res=await fetch(`https://api.neynar.com/v2/farcaster/feed/user/casts?fid=${fcResult.fid}&limit=10`,{headers:{'accept':'application/json','x-api-key':NEYNAR_API_KEY}});const data=await res.json();const casts=data.casts||(data.result&&data.result.casts);if(casts&&Array.isArray(casts)&&casts.length>0){setForYouFeed(casts.slice(0,6).map((c:RawCast)=>({hash:c.hash,text:c.text?c.text.substring(0,140)+(c.text.length>140?'...':''):'',author:{username:c.author?.username||'unknown',pfp_url:c.author?.pfp_url||c.author?.pfp?.url||''},likes:c.reactions?.likes_count||0})));}else setForYouFeed([]);}
      catch{}finally{setIsFetchingForYou(false);}
    };
    fetch3();
  },[feedTab,fcResult?.fid]);

  useEffect(()=>{
    const fetch4=async()=>{
      setIsFetchingGlobal(true);
      try{const res=await fetch(`https://api.neynar.com/v2/farcaster/feed/user/casts?fid=289309&limit=10`,{headers:{'accept':'application/json','x-api-key':NEYNAR_API_KEY}});if(!res.ok)return;const data=await res.json();const casts=data.casts||(data.result&&data.result.casts);if(casts&&Array.isArray(casts)&&casts.length>0){setGlobalFeed(casts.slice(0,4).map((c:RawCast)=>({hash:c.hash,text:c.text?c.text.substring(0,120)+(c.text.length>120?'...':''):'',author:{username:c.author?.username||'unknown',pfp_url:c.author?.pfp_url||c.author?.pfp?.url||''},likes:c.reactions?.likes_count||0})));}}
      catch{}finally{setIsFetchingGlobal(false);}
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
      if(data&&data.user){setFcResult(await buildFcResult(data.user));}else{setFcError('User not found. Check the username.');}
    }catch{setFcError('Failed to fetch. Try again.');}
    finally{setIsScanningFc(false);}
  };

  // ── COMPUTED ANALYTICS FROM CAST HISTORY ──────────────────────────────────
  const castAnalytics=useMemo(()=>{
    if(!userCastsHistory.length)return null;
    const now=new Date().getTime();
    const daysMap:Record<string,number>={'24h':1,'3d':3,'7d':7,'14d':14,'30d':30};
    const days=daysMap[analyticsTimeframe]||7;
    const cutoff=now-(days*86400000);
    const filtered=userCastsHistory.filter(c=>c.timestamp&&new Date(c.timestamp).getTime()>=cutoff);

    const totalLikes=filtered.reduce((s,c)=>s+(c.reactions?.likes_count||0),0);
    const totalRecasts=filtered.reduce((s,c)=>s+(c.reactions?.recasts_count||0),0);
    const totalReplies=filtered.reduce((s,c)=>s+(c.replies?.count||0),0);
    const totalCasts=filtered.length;

    // Active cast days (unique days with at least 1 cast)
    const castDays=new Set(filtered.map(c=>c.timestamp?.split('T')[0]).filter((d):d is string=>typeof d==='string'));

    // Longest streak calculation
    const sortedDays=Array.from(castDays).sort();
    let longest=0,current=0,prev='';
    for(const d of sortedDays){
      if(prev){const diff=(new Date(d).getTime()-new Date(prev).getTime())/86400000;if(Math.round(diff)===1)current++;else current=1;}else current=1;
      longest=Math.max(longest,current);prev=d;
    }
    // Current streak
    const todayStr=new Date().toISOString().split('T')[0];
    const yesterdayStr=new Date(Date.now()-86400000).toISOString().split('T')[0];
    let currentStreak=0;
    if(castDays.has(todayStr)||castDays.has(yesterdayStr)){
      let check=castDays.has(todayStr)?todayStr:yesterdayStr;
      while(castDays.has(check)){currentStreak++;const prev2=new Date(new Date(check).getTime()-86400000).toISOString().split('T')[0];check=prev2;}
    }

    // Most liked cast
    const mostLiked=filtered.reduce((best,c)=>(c.reactions?.likes_count||0)>(best.reactions?.likes_count||0)?c:best,filtered[0]);

    // Avg casts per day
    const avgPerDay=days>0?Math.round((totalCasts/days)*10)/10:0;
    // Engagement rate
    const engRate=totalCasts>0?Math.round(((totalLikes+totalRecasts+totalReplies)/totalCasts)*10)/10:0;
    // Best day of week
    const dayCount:Record<string,number>={Mon:0,Tue:0,Wed:0,Thu:0,Fri:0,Sat:0,Sun:0};
    const dayKeys=['Sun','Mon','Tue','Wed','Thu','Fri','Sat'];
    filtered.forEach(c=>{if(c.timestamp){const d=new Date(c.timestamp);dayCount[dayKeys[d.getDay()]]=(dayCount[dayKeys[d.getDay()]]||0)+1;}});
    const bestDay=Object.entries(dayCount).sort((a,b)=>b[1]-a[1])[0]?.[0]||'N/A';

    return{totalCasts,totalLikes,totalRecasts,totalReplies,castDays:castDays.size,longestStreak:longest,currentStreak,avgPerDay,engRate,bestDay,mostLiked};
  },[userCastsHistory,analyticsTimeframe]);

  const getDisplayedCoins=()=>{
    const sorted=[...allCoins];
    const key=timeframe==='24h'?'change24h':timeframe==='7d'?'change7d':'change30d';
    if(tokenTab==='gainers')sorted.sort((a,b)=>b[key]-a[key]);
    else if(tokenTab==='losers')sorted.sort((a,b)=>a[key]-b[key]);
    return sorted.slice(0,12);
  };

  const ethosScore=fcResult?Math.min(1000,500+(fcResult.followers*0.05)+(Number(fcResult.reputation)*30)).toFixed(0):'0';
  const quotientScore=fcResult?Math.min(99.9,40+(Number(fcResult.reputation)*5)).toFixed(1):'0';
  const neynarScore=fcResult?Number(fcResult.reputation):0;

  // Neynar score tier color
  const scoreColor=neynarScore>=8?'text-yellow-400':neynarScore>=6?'text-blue-400':neynarScore>=4?'text-purple-400':'text-slate-400';
  const scoreBg=neynarScore>=8?'bg-yellow-500/10 border-yellow-500/25':neynarScore>=6?'bg-blue-500/10 border-blue-500/25':neynarScore>=4?'bg-purple-500/10 border-purple-500/25':'bg-white/5 border-white/8';

  const APP_WEBSITE_URL='https://base-analytics-app.vercel.app/';
  const FARCASTER_MINI_APP_URL='https://farcaster.xyz/miniapps/lYFXQz4s1wsq/base-analytics';
  const shareMsg=fcResult?`I scored ${fcResult.reputation}/10 Neynar Score on Base Analytics! 🔵🚀`:'';
  const xLink=`https://twitter.com/intent/tweet?text=${encodeURIComponent(shareMsg)}&url=${encodeURIComponent(APP_WEBSITE_URL)}`;
  const fcLink=`https://warpcast.com/~/compose?text=${encodeURIComponent(shareMsg)}&embeds[]=${encodeURIComponent(FARCASTER_MINI_APP_URL)}`;

  const coins=getDisplayedCoins();

  return(
    <div className="pb-12 space-y-8 w-full">

      {/* ── SECTION 1: TOKENS ── */}
      <div className="w-full">
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
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-6 gap-3">
          {coins.map((coin,idx)=>{
            const change=timeframe==='24h'?coin.change24h:timeframe==='7d'?coin.change7d:coin.change30d;
            const up=change>=0;
            return(
              <div key={idx} className="bg-[#13182a] border border-white/6 rounded-2xl p-4 flex flex-col items-center text-center relative group hover:border-blue-500/30 transition-colors">
                <span className="text-[9px] font-bold text-slate-700 uppercase tracking-widest mb-1 truncate w-full">{coin.name}</span>
                <h4 className="font-black text-base text-white tracking-tight leading-none mb-2">{coin.symbol}</h4>
                <p className="text-sm font-black text-slate-300 mb-2">${coin.price<0.01?coin.price.toFixed(4):coin.price.toFixed(2)}</p>
                <div className={`flex items-center gap-1 text-[10px] font-black px-2 py-1 rounded-lg ${up?'bg-green-500/10 text-green-400':'bg-red-500/10 text-red-400'}`}>
                  {up?<ArrowUp size={9}/>:<ArrowDown size={9}/>}{Math.abs(change).toFixed(1)}%
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

      {/* ── SECTION 2: FARCASTER IDENTITY — styled like the Farcoin image ── */}
      <div className="w-full">
        <h3 className="text-[10px] font-black text-slate-600 uppercase tracking-widest flex items-center gap-2 mb-4">
          <MessageCircle size={13}/> Farcaster Identity {isScanningFc&&<RefreshCcw size={11} className="animate-spin text-slate-700"/>}
        </h3>

        {/* Search bar */}
        <form onSubmit={handleScanFarcaster} className="flex gap-3 mb-5">
          <div className="relative flex-1">
            <div className="absolute inset-y-0 left-3 flex items-center pointer-events-none"><span className="text-slate-600 font-bold text-sm">@</span></div>
            <input type="text" value={fcUsername} onChange={e=>setFcUsername(e.target.value.replace('@',''))} placeholder="Search any Farcaster username..." className="w-full bg-white/4 border border-white/6 text-white text-sm font-bold rounded-2xl focus:border-purple-500/50 focus:ring-1 focus:ring-purple-500/20 pl-8 pr-4 py-3.5 placeholder-slate-600 outline-none transition"/>
          </div>
          <button type="submit" disabled={isScanningFc} className="bg-purple-600 hover:bg-purple-500 text-white font-black px-6 py-3.5 rounded-2xl flex items-center gap-2 disabled:opacity-50 transition shrink-0">
            {isScanningFc?<RefreshCcw size={16} className="animate-spin"/>:<Search size={16}/>} Scan
          </button>
        </form>
        {fcError&&<p className="text-red-400 text-xs mb-4 font-bold">{fcError}</p>}

        {fcResult?(
          <div className="space-y-4">
            {/* ── Profile header card (like Farcoin top) ── */}
            <div className="bg-[#13182a] border border-white/6 rounded-3xl p-5 sm:p-6">
              <div className="flex items-start gap-4 mb-5">
                {fcResult.pfpUrl?(
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={fcResult.pfpUrl} alt="pfp" className="w-14 h-14 sm:w-16 sm:h-16 rounded-2xl bg-white/5 shrink-0 object-cover"/>
                ):(
                  <div className="w-14 h-14 sm:w-16 sm:h-16 rounded-2xl bg-purple-600/20 flex items-center justify-center shrink-0"><MessageCircle size={28} className="text-purple-400"/></div>
                )}
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2 mb-1">
                    <h4 className="font-black text-xl text-white">{fcResult.username}</h4>
                    {fcResult.powerBadge&&<span className="text-[9px] font-black bg-yellow-500/15 text-yellow-400 border border-yellow-500/25 px-2 py-0.5 rounded-full flex items-center gap-1"><Star size={8}/>Power Badge</span>}
                  </div>
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="text-[10px] font-black bg-white/5 text-slate-400 border border-white/8 px-2 py-1 rounded-lg">FID #{fcResult.fid}</span>
                    <span className={`text-[10px] font-black px-2 py-1 rounded-lg border ${fcResult.tier==='Power User'?'bg-yellow-500/10 text-yellow-400 border-yellow-500/20':fcResult.tier==='Active Caster'?'bg-blue-500/10 text-blue-400 border-blue-500/20':fcResult.tier==='Regular'?'bg-purple-500/10 text-purple-400 border-purple-500/20':'bg-white/5 text-slate-500 border-white/8'}`}>{fcResult.tier}</span>
                    <span className="text-[10px] font-black bg-white/5 text-slate-400 border border-white/8 px-2 py-1 rounded-lg flex items-center gap-1"><Calendar size={9}/>Joined {fcResult.joinedDate}</span>
                  </div>
                  {fcResult.bio&&<p className="text-xs text-slate-500 mt-2 line-clamp-2 leading-relaxed">{fcResult.bio}</p>}
                </div>
                <div className="flex gap-2 shrink-0">
                  <a href={fcLink} target="_blank" rel="noopener noreferrer" className="bg-purple-600 hover:bg-purple-500 text-white p-2.5 rounded-xl transition"><Send size={14}/></a>
                  <a href={xLink} target="_blank" rel="noopener noreferrer" className="bg-slate-800 hover:bg-slate-700 text-white p-2.5 rounded-xl transition"><Twitter size={14}/></a>
                </div>
              </div>

              {/* Top 3 stat pills like Farcoin header */}
              <div className="grid grid-cols-3 gap-3 mb-5">
                {[
                  {label:'FOLLOWERS',value:fcResult.followers.toLocaleString(),icon:<Users size={13}/>,color:'text-blue-400'},
                  {label:'FOLLOWING',value:fcResult.following.toLocaleString(),icon:<Users size={13}/>,color:'text-purple-400'},
                  {label:'FID AGE',value:fcResult.fidAgeLabel,icon:<Clock size={13}/>,color:'text-green-400'},
                ].map((s,i)=>(
                  <div key={i} className="bg-white/4 border border-white/6 rounded-2xl p-3 sm:p-4 text-center">
                    <div className={`flex items-center justify-center gap-1 mb-1 ${s.color}`}>{s.icon}<span className="text-[9px] font-black uppercase tracking-widest text-slate-600">{s.label}</span></div>
                    <p className={`font-black text-base sm:text-xl ${s.color}`}>{s.value}</p>
                  </div>
                ))}
              </div>

              {/* ── NEYNAR SCORE big card (like Farcoin's TOTAL FAR SCORE) ── */}
              <div className={`rounded-2xl border p-4 sm:p-5 mb-4 ${scoreBg}`}>
                <p className="text-[10px] font-black uppercase tracking-widest text-slate-500 mb-2">NEYNAR REPUTATION SCORE</p>
                <p className={`text-5xl sm:text-6xl font-black tracking-tight ${scoreColor}`}>{fcResult.reputation}<span className="text-xl text-slate-600">/10</span></p>
              </div>

              {/* ── Metric rows (like Farcoin's FID age / Followers rows) ── */}
              <div className="space-y-2">
                {[
                  {icon:<Clock size={15} className="text-blue-400"/>,label:`FID Age: ${fcResult.fidAgeMonths} months`,value:`+${Math.round(fcResult.fidAgeMonths*200)} XP`,color:'text-green-400'},
                  {icon:<Users size={15} className="text-purple-400"/>,label:`Followers: ${fcResult.followers.toLocaleString()}`,value:fcResult.followers>5000?`+${Math.round(fcResult.followers/50)} XP`:'Grow your audience',color:fcResult.followers>5000?'text-green-400':'text-slate-500'},
                  {icon:<Hash size={15} className="text-orange-400"/>,label:`FID Number: #${fcResult.fid.toLocaleString()}`,value:fcResult.fid<10000?'OG Early Adopter 🛸':fcResult.fid<100000?'Early Member':'Standard',color:fcResult.fid<10000?'text-yellow-400':fcResult.fid<100000?'text-blue-400':'text-slate-500'},
                  {icon:<ShieldCheck size={15} className="text-green-400"/>,label:`Verifications: ${fcResult.verifications}`,value:fcResult.verifications>0?'Verified ✓':'Not verified',color:fcResult.verifications>0?'text-green-400':'text-slate-500'},
                  {icon:<Star size={15} className="text-yellow-400"/>,label:'Most Influential Follower',value:fcResult.topFollower,color:'text-blue-300'},
                ].map((row,i)=>(
                  <div key={i} className="flex items-center justify-between bg-white/3 hover:bg-white/5 border border-white/5 rounded-xl p-3 sm:p-4 transition-colors">
                    <div className="flex items-center gap-2.5 min-w-0">
                      {row.icon}
                      <span className="text-xs sm:text-sm text-slate-300 font-bold truncate">{row.label}</span>
                    </div>
                    <span className={`text-xs sm:text-sm font-black shrink-0 ml-2 ${row.color}`}>{row.value}</span>
                  </div>
                ))}
              </div>
            </div>

            {/* ── DEEP ANALYTICS SECTION ── */}
            <div className="bg-[#13182a] border border-white/6 rounded-3xl p-5 sm:p-6">
              {/* Timeframe + tab switcher */}
              <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 mb-5">
                <div>
                  <h4 className="font-black text-white text-base sm:text-lg">Cast Analytics</h4>
                  <p className="text-xs text-slate-600 mt-0.5">Calculated from your recent cast history {isFetchingHistory&&<RefreshCcw size={10} className="animate-spin inline ml-1"/>}</p>
                </div>
                <div className="flex gap-2 flex-wrap">
                  <div className="flex bg-white/5 border border-white/8 rounded-xl p-1">
                    {['24h','3d','7d','14d','30d'].map(tf=>(
                      <button key={tf} onClick={()=>setAnalyticsTimeframe(tf as typeof analyticsTimeframe)}
                        className={`px-2.5 py-1.5 text-[10px] font-black uppercase rounded-lg transition ${analyticsTimeframe===tf?'bg-white/10 text-white':'text-slate-600 hover:text-slate-400'}`}>{tf}</button>
                    ))}
                  </div>
                  <div className="flex bg-white/5 border border-white/8 rounded-xl p-1">
                    <button onClick={()=>setFeedTab('stats')} className={`px-3 py-1.5 text-[10px] font-black uppercase rounded-lg transition ${feedTab==='stats'?'bg-blue-600 text-white':'text-slate-600 hover:text-slate-400'}`}>Stats</button>
                    <button onClick={()=>setFeedTab('casts')} className={`px-3 py-1.5 text-[10px] font-black uppercase rounded-lg transition ${feedTab==='casts'?'bg-purple-600 text-white':'text-slate-600 hover:text-slate-400'}`}>Casts</button>
                  </div>
                </div>
              </div>

              {feedTab==='stats'&&castAnalytics?(
                <div className="space-y-4">
                  {/* 4 top stat cards */}
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                    {[
                      {icon:<MessageCircle size={18}/>,label:'Total Casts',val:castAnalytics.totalCasts,c:'text-blue-400',bg:'bg-blue-500/10'},
                      {icon:<Heart size={18}/>,label:'Total Likes',val:castAnalytics.totalLikes,c:'text-red-400',bg:'bg-red-500/10'},
                      {icon:<Repeat size={18}/>,label:'Recasts',val:castAnalytics.totalRecasts,c:'text-green-400',bg:'bg-green-500/10'},
                      {icon:<MessageSquare size={18}/>,label:'Replies',val:castAnalytics.totalReplies,c:'text-purple-400',bg:'bg-purple-500/10'},
                    ].map((s,i)=>(
                      <div key={i} className="bg-white/4 border border-white/6 rounded-2xl p-4 text-center">
                        <div className={`p-2 ${s.bg} ${s.c} rounded-xl mb-2 w-fit mx-auto`}>{s.icon}</div>
                        <p className={`font-black text-2xl ${s.c}`}>{s.val.toLocaleString()}</p>
                        <p className="text-[10px] text-slate-600 uppercase font-bold tracking-wide mt-1">{s.label}</p>
                      </div>
                    ))}
                  </div>

                  {/* ── Metric rows styled like Farcoin ── */}
                  <div className="space-y-2">
                    <p className="text-[10px] font-black text-slate-600 uppercase tracking-widest mb-3">Detailed Breakdown</p>
                    {[
                      {icon:<Calendar size={15} className="text-blue-400"/>,label:'Active Cast Days',value:`${castAnalytics.castDays} days`,sub:`out of ${analyticsTimeframe==='24h'?1:analyticsTimeframe==='3d'?3:analyticsTimeframe==='7d'?7:analyticsTimeframe==='14d'?14:30} days`,positive:castAnalytics.castDays>0},
                      {icon:<Flame size={15} className="text-orange-400"/>,label:'Longest Streak',value:`${castAnalytics.longestStreak} days`,sub:'consecutive days casting',positive:castAnalytics.longestStreak>3},
                      {icon:<Zap size={15} className="text-yellow-400"/>,label:'Current Streak',value:`${castAnalytics.currentStreak} days`,sub:castAnalytics.currentStreak>0?'keep it going!':'streak broken',positive:castAnalytics.currentStreak>0},
                      {icon:<BarChart3 size={15} className="text-cyan-400"/>,label:'Avg Casts / Day',value:`${castAnalytics.avgPerDay}`,sub:'over selected period',positive:castAnalytics.avgPerDay>1},
                      {icon:<Target size={15} className="text-purple-400"/>,label:'Engagement Rate',value:`${castAnalytics.engRate}x`,sub:'avg reactions per cast',positive:castAnalytics.engRate>2},
                      {icon:<Star size={15} className="text-yellow-400"/>,label:'Best Day to Cast',value:castAnalytics.bestDay,sub:'most active weekday',positive:true},
                      {icon:<Heart size={15} className="text-red-400"/>,label:'Most Liked Cast',value:`${castAnalytics.mostLiked?.reactions?.likes_count||0} likes`,sub:castAnalytics.mostLiked?.text?.substring(0,40)+'...'||'',positive:(castAnalytics.mostLiked?.reactions?.likes_count||0)>5},
                    ].map((row,i)=>(
                      <div key={i} className="flex items-center justify-between bg-white/3 hover:bg-white/5 border border-white/5 rounded-xl p-3 sm:p-4 transition-colors gap-3">
                        <div className="flex items-center gap-2.5 min-w-0 flex-1">
                          {row.icon}
                          <div className="min-w-0">
                            <p className="text-xs sm:text-sm text-white font-bold truncate">{row.label}</p>
                            {row.sub&&<p className="text-[10px] text-slate-600 truncate">{row.sub}</p>}
                          </div>
                        </div>
                        <span className={`text-sm sm:text-base font-black shrink-0 ${row.positive?'text-green-400':'text-slate-500'}`}>{row.value}</span>
                      </div>
                    ))}
                  </div>

                  {/* Social influence scores */}
                  <div className="bg-white/3 border border-white/5 rounded-2xl p-4 sm:p-5">
                    <p className="text-[10px] font-black text-slate-600 uppercase tracking-widest mb-4">Reputation Scores</p>
                    <div className="space-y-4">
                      {[
                        {label:'Neynar Score',val:fcResult.reputation,max:10,color:'#8A2BE2',icon:<Cpu size={12} className="text-purple-400"/>,desc:'Farcaster network trust score'},
                        {label:'Ethos Credential',val:ethosScore,max:1000,color:'#10b981',icon:<ShieldCheck size={12} className="text-emerald-400"/>,desc:'Onchain reputation credential'},
                        {label:'Social Quotient',val:quotientScore,max:100,color:'#3b82f6',icon:<Zap size={12} className="text-blue-400"/>,desc:'Overall social influence index'},
                      ].map((s,i)=>(
                        <div key={i}>
                          <div className="flex justify-between items-center mb-1.5">
                            <div className="flex items-center gap-1.5">
                              {s.icon}
                              <div>
                                <span className="text-xs font-bold text-slate-300">{s.label}</span>
                                <span className="text-[10px] text-slate-600 ml-2">{s.desc}</span>
                              </div>
                            </div>
                            <span className="text-sm font-black text-white">{s.val}<span className="text-[10px] text-slate-700">/{s.max}</span></span>
                          </div>
                          <div className="w-full bg-white/5 rounded-full h-1.5 overflow-hidden">
                            <div className="h-full rounded-full transition-all duration-1000" style={{background:s.color,width:`${(Number(s.val)/Number(s.max))*100}%`,boxShadow:`0 0 8px ${s.color}60`}}/>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              ):feedTab==='stats'?(
                <div className="text-center py-8">
                  <RefreshCcw className="animate-spin text-blue-500 mx-auto mb-3" size={24}/>
                  <p className="text-slate-500 text-sm">Loading cast analytics...</p>
                </div>
              ):(
                /* Recent casts view */
                <div>
                  <p className="text-[10px] font-black text-slate-600 uppercase tracking-widest mb-3">Recent Casts</p>
                  {isFetchingForYou?(
                    <div className="text-center py-6"><RefreshCcw className="animate-spin text-slate-600 mx-auto" size={20}/></div>
                  ):forYouFeed.length>0?(
                    <div className="space-y-2">
                      {forYouFeed.map((cast,i)=>(
                        <a key={i} href={`https://warpcast.com/${cast.author?.username}/${cast.hash.substring(0,10)}`} target="_blank" rel="noopener noreferrer"
                          className="flex items-start gap-3 bg-white/3 hover:bg-white/5 border border-white/5 p-3 sm:p-4 rounded-xl transition group">
                          {cast.author?.pfp_url&&(
                            // eslint-disable-next-line @next/next/no-img-element
                            <img src={cast.author.pfp_url} alt="pfp" className="w-8 h-8 rounded-xl bg-white/5 shrink-0 object-cover"/>
                          )}
                          <div className="flex-1 min-w-0">
                            <p className="text-xs text-slate-300 leading-relaxed">{cast.text}</p>
                            <div className="flex items-center gap-3 mt-2">
                              <span className="flex items-center gap-1 text-[10px] text-red-400 font-bold"><Heart size={9}/>{cast.likes}</span>
                              <span className="text-[10px] text-slate-600 group-hover:text-blue-400 transition">View on Warpcast ↗</span>
                            </div>
                          </div>
                        </a>
                      ))}
                    </div>
                  ):(
                    <p className="text-slate-600 text-sm text-center py-6">No recent casts found.</p>
                  )}
                </div>
              )}
            </div>
          </div>
        ):(
          /* No result yet — show ecosystem radar */
          <div className="bg-[#13182a] border border-white/6 rounded-3xl p-6">
            <div className="bg-white/3 border-2 border-dashed border-white/8 rounded-2xl p-8 flex flex-col items-center justify-center text-center mb-4">
              <Lock size={28} className="text-slate-700 mb-3"/>
              <h4 className="font-black text-slate-400 mb-1">Analytics Locked</h4>
              <p className="text-sm text-slate-600">Connect your wallet or search a username above to unlock the full Farcaster dashboard.</p>
            </div>
            {isFetchingGlobal?(
              <div className="text-center py-6"><RefreshCcw className="animate-spin text-slate-600 mx-auto" size={20}/></div>
            ):(
              <div>
                <p className="text-[10px] font-black text-slate-600 uppercase tracking-widest mb-3">🌐 Ecosystem Radar</p>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  {globalFeed.map((cast,i)=>(
                    <a key={i} href={`https://warpcast.com/${cast.author?.username}/${cast.hash.substring(0,10)}`} target="_blank" rel="noopener noreferrer"
                      className="bg-white/3 border border-white/5 p-4 rounded-2xl flex flex-col justify-between group hover:border-purple-500/25 transition">
                      <div>
                        <div className="flex items-center gap-2 mb-3">
                          {cast.author?.pfp_url&&<img src={cast.author.pfp_url} alt="pfp" className="w-7 h-7 rounded-xl bg-white/5"/>}
                          <span className="text-[10px] font-bold text-slate-500">@{cast.author?.username}</span>
                        </div>
                        <p className="text-xs text-slate-500 leading-relaxed">&quot;{cast.text}&quot;</p>
                      </div>
                      <div className="mt-3 flex items-center gap-1 text-[10px] font-bold text-purple-400"><Flame size={10}/> {cast.likes}</div>
                    </a>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}
      </div>

      {/* ── SECTION 3: ECOSYSTEM ── */}
      <div className="w-full">
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center mb-4 gap-3">
          <h3 className="text-[10px] font-black text-slate-600 uppercase tracking-widest flex items-center gap-2">
            <Globe size={13}/> Explore the Ecosystem <span className="text-slate-700 font-bold normal-case">({filteredProjects.length} apps)</span>
          </h3>
          <div className="relative w-full sm:w-auto">
            <input value={ecoSearch} onChange={e=>setEcoSearch(e.target.value)} placeholder="Search apps..." className="w-full sm:w-48 bg-white/4 border border-white/6 rounded-xl px-3 py-2 pl-8 text-xs font-bold text-slate-400 outline-none focus:border-blue-500/40 placeholder-slate-700"/>
            <Search size={12} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-700"/>
          </div>
        </div>
        <div className="flex gap-2 overflow-x-auto pb-2 mb-4 no-scrollbar">
          {CATEGORIES.map(cat=>(
            <button key={cat} onClick={()=>setEcoCategory(cat)}
              className={`whitespace-nowrap px-3 py-1.5 rounded-xl text-[10px] font-black uppercase tracking-wide border transition ${ecoCategory===cat?'bg-blue-600 text-white border-blue-600 shadow-lg shadow-blue-600/20':'bg-white/4 text-slate-600 border-white/6 hover:border-white/15 hover:text-slate-400'}`}>{cat}
            </button>
          ))}
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3">
          {filteredProjects.map((p,i)=>(
            <a key={i} href={p.url} target="_blank" rel="noopener noreferrer"
              className={`bg-[#13182a] border border-white/6 p-4 rounded-2xl flex flex-col justify-between group transition hover:-translate-y-0.5 ${p.border}`}>
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

      <style>{`.no-scrollbar::-webkit-scrollbar{display:none}.no-scrollbar{-ms-overflow-style:none;scrollbar-width:none}`}</style>
    </div>
  );
}