"use client";
import { useState, useEffect, useMemo } from 'react';
import { fetchNeynar } from "@/lib/api/neynar";
import { parseNeynarUsersByAddress } from "@/lib/api/neynar-users";
import { APP_URL_WEB, MINIAPP_URL } from "@/lib/constants/env";
import { SHARE_HASHTAGS, SHARE_TAGLINE, twitterShare, warpcast } from "@/lib/utils/share";
import {
  MessageCircle,
  RefreshCcw, Send, Twitter, Lock,
  BarChart3, MessageSquare, Repeat, ShieldCheck, Zap, Calendar, Clock, Hash,
  Star, Target, Heart, Search, Users, Cpu, Flame
} from 'lucide-react';

interface FarcasterData {
  username:string; fid:number; followers:number; following:number;
  reputation:string; tier:string; topFollower:string;
  fidAgeMonths:number; fidAgeLabel:string; joinedDate:string;
  pfpUrl:string; bio:string; verifications:number;
  powerBadge:boolean; castCount:number;
}
interface FarcasterCast { hash:string; text:string; author:{username:string;pfp_url:string;}; likes:number; }
interface RawCast { hash:string; text:string; timestamp?:string; author?:{username?:string;pfp_url?:string;pfp?:{url?:string}}; reactions?:{likes_count?:number;recasts_count?:number}; replies?:{count?:number}; }

const TIMEFRAME_DAYS: Record<'24h'|'3d'|'7d'|'14d'|'30d', number> = {
  '24h': 1,
  '3d': 3,
  '7d': 7,
  '14d': 14,
  '30d': 30,
};

function castDayKey(timestamp?: string): string | null {
  if (!timestamp) return null;
  return timestamp.split('T')[0] ?? null;
}

function uniqueCastDays(casts: RawCast[]): Set<string> {
  const days = new Set<string>();
  for (const cast of casts) {
    const day = castDayKey(cast.timestamp);
    if (day) days.add(day);
  }
  return days;
}

function getPeriodDayTrack(
  periodDays: number,
  activeDays: Set<string>
): { key: string; label: string; active: boolean }[] {
  const track: { key: string; label: string; active: boolean }[] = [];
  for (let offset = periodDays - 1; offset >= 0; offset--) {
    const date = new Date(Date.now() - offset * 86400000);
    const key = date.toISOString().split('T')[0];
    const label =
      periodDays <= 7
        ? date.toLocaleDateString(undefined, { weekday: 'short' }).slice(0, 3)
        : date.toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
    track.push({ key, label, active: activeDays.has(key) });
  }
  return track;
}

const RECENT_CAST_WINDOW_MS = 30 * 86400000;
const CAST_PAGE_LIMIT = 150;
const CAST_MAX_PAGES = 20;

type CastHistoryFetch = {
  recentCasts: RawCast[];
  allTimeActiveDays: Set<string>;
  firstCastAt: string | null;
  totalScanned: number;
  complete: boolean;
  unavailable: boolean;
};

async function fetchFullCastAnalytics(
  fid: number,
  profileCastCount = 0
): Promise<CastHistoryFetch> {
  const allTimeActiveDays = new Set<string>();
  const recentCasts: RawCast[] = [];
  const recentCutoff = Date.now() - RECENT_CAST_WINDOW_MS;
  let firstCastAt: string | null = null;
  let totalScanned = 0;
  let cursor: string | undefined;
  let unavailable = false;
  let complete = true;

  for (let page = 0; page < CAST_MAX_PAGES; page++) {
    const params: Record<string, string | number> = {
      fid,
      limit: CAST_PAGE_LIMIT,
    };
    if (cursor) params.cursor = cursor;

    const { ok, data, unavailable: up } = await fetchNeynar(
      "v2/farcaster/feed/user/casts",
      params
    );
    if (up) {
      unavailable = true;
      complete = false;
      break;
    }
    if (!ok) {
      complete = false;
      break;
    }

    const casts = data.casts as RawCast[] | undefined;
    if (!casts?.length) break;

    for (const cast of casts) {
      totalScanned++;
      const day = castDayKey(cast.timestamp);
      if (day) allTimeActiveDays.add(day);
      if (cast.timestamp) {
        if (!firstCastAt || cast.timestamp < firstCastAt) {
          firstCastAt = cast.timestamp;
        }
        if (new Date(cast.timestamp).getTime() >= recentCutoff) {
          recentCasts.push(cast);
        }
      }
    }

    const next = (data.next as { cursor?: string } | undefined)?.cursor;
    if (!next) break;
    cursor = next;

    if (profileCastCount > 0 && totalScanned >= profileCastCount) break;
  }

  if (profileCastCount > 0 && totalScanned < profileCastCount) {
    complete = false;
  }

  return {
    recentCasts,
    allTimeActiveDays,
    firstCastAt,
    totalScanned,
    complete,
    unavailable,
  };
}

function getFidAgeMonths(fid:number):number {
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
    const { ok, data, unavailable }=await fetchNeynar("v2/farcaster/user/bulk",{fids:fid});
    if(unavailable||!ok)return 0;
    const users=data?.users as Record<string,unknown>[]|undefined;
    const user=users?.[0];
    const score=user?.experimental?(user.experimental as Record<string,unknown>).neynar_user_score:user?.score;
    if(score!==null&&score!==undefined){let n=Number(score);if(n<=1.0&&n>0)n*=10;return Math.min(10,parseFloat(n.toFixed(2)));}
    const fidBonus=fid<1000?3.5:fid<10000?2.5:fid<100000?1.5:0.5;
    const followerBonus=Math.min(3.5,(Number(user?.follower_count)||0)/1000);
    return Math.min(9.9,parseFloat((4.0+fidBonus+followerBonus).toFixed(2)));
  }catch{return 0;}
};

const fetchTopFollower=async(fid:number):Promise<string>=>{
  try{
    const { ok, data, unavailable }=await fetchNeynar("v2/farcaster/followers",{fid,limit:50});
    if(unavailable||!ok)return'None found';
    const users=data.users as {follower_count:number;username:string}[]|undefined;
    if(users&&users.length>0){const sorted=users.sort((a,b)=>b.follower_count-a.follower_count);return`@${sorted[0].username}`;}
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
    castCount:Number(user.cast_count)||0,
  };
};

export default function FarcasterAnalytics({
  address,
  unlocked,
  unlockLoading,
  onUnlock,
}: {
  address: string;
  unlocked: boolean;
  unlockLoading: boolean;
  onUnlock: () => void;
}) {

  const[fcUsername,setFcUsername]=useState('');
  const[isScanningFc,setIsScanningFc]=useState(false);
  const[fcResult,setFcResult]=useState<FarcasterData|null>(null);
  const[fcError,setFcError]=useState('');
  const[scannedAddress,setScannedAddress]=useState('');

  const[analyticsTimeframe,setAnalyticsTimeframe]=useState<'24h'|'3d'|'7d'|'14d'|'30d'>('7d');
  const[userCastsHistory,setUserCastsHistory]=useState<RawCast[]>([]);
  const[allTimeActiveDayKeys,setAllTimeActiveDayKeys]=useState<string[]>([]);
  const[firstCastDate,setFirstCastDate]=useState<string|null>(null);
  const[castHistoryMeta,setCastHistoryMeta]=useState({
    scanned:0,complete:true,profileCastCount:0,
  });
  const[forYouFeed,setForYouFeed]=useState<FarcasterCast[]>([]);
  const[globalFeed,setGlobalFeed]=useState<FarcasterCast[]>([]);
  const[isFetchingHistory,setIsFetchingHistory]=useState(false);
  const[isFetchingForYou,setIsFetchingForYou]=useState(false);
  const[isFetchingGlobal,setIsFetchingGlobal]=useState(false);
  const[feedTab,setFeedTab]=useState<'stats'|'casts'>('stats');
  const[neynarUnavailable,setNeynarUnavailable]=useState(false);

  useEffect(()=>{
    if(unlocked)return;
    setFcUsername('');
    setFcResult(null);
    setFcError('');
    setScannedAddress('');
    setUserCastsHistory([]);
    setAllTimeActiveDayKeys([]);
    setFirstCastDate(null);
    setCastHistoryMeta({scanned:0,complete:true,profileCastCount:0});
    setForYouFeed([]);
    setFeedTab('stats');
  },[unlocked]);

  useEffect(()=>{
    if(!unlocked||!address||address===scannedAddress||neynarUnavailable)return;
    const auto=async()=>{
      setScannedAddress(address);setIsScanningFc(true);setFcError('');
      try{
        const { ok, data, unavailable }=await fetchNeynar("v2/farcaster/user/bulk-by-address",{addresses:address});
        if(unavailable){setNeynarUnavailable(true);setFcError('Farcaster analytics need NEYNAR_API_KEY in .env.local (server).');return;}
        if(!ok)return;
        const users=parseNeynarUsersByAddress(data,address);
        if(users.length>0){setFcResult(await buildFcResult(users[0]));}
      }catch(e){console.error(e);}finally{setIsScanningFc(false);}
    };
    auto();
  },[address,scannedAddress,neynarUnavailable,unlocked]);

  useEffect(()=>{
    if(!unlocked||!fcResult?.fid||neynarUnavailable)return;
    const fetch2=async()=>{
      setIsFetchingHistory(true);
      setUserCastsHistory([]);
      setAllTimeActiveDayKeys([]);
      setFirstCastDate(null);
      try{
        const result=await fetchFullCastAnalytics(
          fcResult.fid,
          fcResult.castCount
        );
        if(result.unavailable){setNeynarUnavailable(true);return;}
        setUserCastsHistory(result.recentCasts);
        setAllTimeActiveDayKeys(Array.from(result.allTimeActiveDays).sort());
        setFirstCastDate(result.firstCastAt);
        setCastHistoryMeta({
          scanned:result.totalScanned,
          complete:result.complete,
          profileCastCount:fcResult.castCount,
        });
      }catch{}finally{setIsFetchingHistory(false);}
    };
    fetch2();
  },[fcResult?.fid,fcResult?.castCount,neynarUnavailable,unlocked]);

  useEffect(()=>{
    if(!unlocked||feedTab!=='casts'||!fcResult?.fid||neynarUnavailable)return;
    const fetch3=async()=>{
      setIsFetchingForYou(true);
      try{
        const { ok, data, unavailable }=await fetchNeynar("v2/farcaster/feed/user/casts",{fid:fcResult.fid,limit:10});
        if(unavailable){setNeynarUnavailable(true);return;}
        if(!ok)return;
        const casts=(data.casts||(data.result as Record<string,unknown>|undefined)?.casts) as RawCast[]|undefined;
        if(casts&&Array.isArray(casts)&&casts.length>0){setForYouFeed(casts.slice(0,6).map((c:RawCast)=>({hash:c.hash,text:c.text?c.text.substring(0,140)+(c.text.length>140?'...':''):'',author:{username:c.author?.username||'unknown',pfp_url:c.author?.pfp_url||c.author?.pfp?.url||''},likes:c.reactions?.likes_count||0})));}else setForYouFeed([]);
      }catch{}finally{setIsFetchingForYou(false);}
    };
    fetch3();
  },[feedTab,fcResult?.fid,neynarUnavailable,unlocked]);

  useEffect(()=>{
    if(!unlocked||neynarUnavailable)return;
    const fetch4=async()=>{
      setIsFetchingGlobal(true);
      try{
        const { ok, data, unavailable }=await fetchNeynar("v2/farcaster/feed/user/casts",{fid:289309,limit:10});
        if(unavailable){setNeynarUnavailable(true);return;}
        if(!ok)return;
        const casts=(data.casts||(data.result as Record<string,unknown>|undefined)?.casts) as RawCast[]|undefined;
        if(casts&&Array.isArray(casts)&&casts.length>0){setGlobalFeed(casts.slice(0,4).map((c:RawCast)=>({hash:c.hash,text:c.text?c.text.substring(0,120)+(c.text.length>120?'...':''):'',author:{username:c.author?.username||'unknown',pfp_url:c.author?.pfp_url||c.author?.pfp?.url||''},likes:c.reactions?.likes_count||0})));}
      }catch{}finally{setIsFetchingGlobal(false);}
    };
    fetch4();
  },[neynarUnavailable,unlocked]);

  const handleScanFarcaster=async(e:React.FormEvent)=>{
    e.preventDefault();
    if(!unlocked){onUnlock();return;}
    if(!fcUsername||neynarUnavailable)return;
    setIsScanningFc(true);setFcResult(null);setFcError('');
    setUserCastsHistory([]);setAllTimeActiveDayKeys([]);setFirstCastDate(null);
    setCastHistoryMeta({scanned:0,complete:true,profileCastCount:0});
    try{
      const clean=fcUsername.replace('@','');
      const { ok, data, unavailable }=await fetchNeynar("v2/farcaster/user/by_username",{username:clean,viewer_fid:3});
      if(unavailable){setNeynarUnavailable(true);setFcError('Farcaster analytics need NEYNAR_API_KEY in .env.local (server).');return;}
      const user=data.user as Record<string,unknown>|undefined;
      if(ok&&user){setFcResult(await buildFcResult(user));}else{setFcError('User not found. Check the username.');}
    }catch{setFcError('Failed to fetch. Try again.');}
    finally{setIsScanningFc(false);}
  };

  const castAnalytics=useMemo(()=>{
    if(!allTimeActiveDayKeys.length&&!userCastsHistory.length)return null;
    const days=TIMEFRAME_DAYS[analyticsTimeframe]||7;
    const cutoff=Date.now()-(days*86400000);
    const filtered=userCastsHistory.filter(c=>c.timestamp&&new Date(c.timestamp).getTime()>=cutoff);

    const totalLikes=filtered.reduce((s,c)=>s+(c.reactions?.likes_count||0),0);
    const totalRecasts=filtered.reduce((s,c)=>s+(c.reactions?.recasts_count||0),0);
    const totalReplies=filtered.reduce((s,c)=>s+(c.replies?.count||0),0);
    const totalCasts=filtered.length;

    const periodActiveDays=uniqueCastDays(filtered);
    const activeDays=periodActiveDays.size;
    const allTimeDays=allTimeActiveDayKeys.length;
    const activeDayPct=days>0?Math.round((activeDays/days)*100):0;
    const periodTrack=getPeriodDayTrack(days,periodActiveDays);

    const firstCastLabel=firstCastDate
      ?new Date(firstCastDate).toLocaleDateString(undefined,{month:'short',day:'numeric',year:'numeric'})
      :null;
    const daysSinceFirstCast=firstCastDate
      ?Math.max(1,Math.ceil((Date.now()-new Date(firstCastDate).getTime())/86400000)+1)
      :null;
    const allTimePostingPct=daysSinceFirstCast
      ?Math.round((allTimeDays/daysSinceFirstCast)*100)
      :0;

    const sortedDays=Array.from(periodActiveDays).sort();
    let longest=0,current=0,prev='';
    for(const d of sortedDays){
      if(prev){const diff=(new Date(d).getTime()-new Date(prev).getTime())/86400000;if(Math.round(diff)===1)current++;else current=1;}else current=1;
      longest=Math.max(longest,current);prev=d;
    }
    const todayStr=new Date().toISOString().split('T')[0];
    const yesterdayStr=new Date(Date.now()-86400000).toISOString().split('T')[0];
    let currentStreak=0;
    if(periodActiveDays.has(todayStr)||periodActiveDays.has(yesterdayStr)){
      let check=periodActiveDays.has(todayStr)?todayStr:yesterdayStr;
      while(periodActiveDays.has(check)){currentStreak++;const prev2=new Date(new Date(check).getTime()-86400000).toISOString().split('T')[0];check=prev2;}
    }

    const mostLiked=filtered.length
      ?filtered.reduce((best,c)=>(c.reactions?.likes_count||0)>(best.reactions?.likes_count||0)?c:best,filtered[0])
      :null;

    const avgPerDay=days>0?Math.round((totalCasts/days)*10)/10:0;
    const engRate=totalCasts>0?Math.round(((totalLikes+totalRecasts+totalReplies)/totalCasts)*10)/10:0;
    const dayCount:Record<string,number>={Mon:0,Tue:0,Wed:0,Thu:0,Fri:0,Sat:0,Sun:0};
    const dayKeys=['Sun','Mon','Tue','Wed','Thu','Fri','Sat'];
    filtered.forEach(c=>{if(c.timestamp){const d=new Date(c.timestamp);dayCount[dayKeys[d.getDay()]]=(dayCount[dayKeys[d.getDay()]]||0)+1;}});
    const bestDay=Object.entries(dayCount).sort((a,b)=>b[1]-a[1])[0]?.[0]||'N/A';

    return{
      totalCasts,totalLikes,totalRecasts,totalReplies,
      activeDays,allTimeDays,activeDayPct,periodTrack,periodDays:days,
      firstCastLabel,daysSinceFirstCast,allTimePostingPct,
      castDays:activeDays,
      longestStreak:longest,currentStreak,avgPerDay,engRate,bestDay,mostLiked,
      castsScanned:castHistoryMeta.scanned,
      historyComplete:castHistoryMeta.complete,
      profileCastCount:castHistoryMeta.profileCastCount,
    };
  },[userCastsHistory,analyticsTimeframe,allTimeActiveDayKeys,firstCastDate,castHistoryMeta]);

  const ethosScore=fcResult?Math.min(1000,500+(fcResult.followers*0.05)+(Number(fcResult.reputation)*30)).toFixed(0):'0';
  const quotientScore=fcResult?Math.min(99.9,40+(Number(fcResult.reputation)*5)).toFixed(1):'0';
  const neynarScore=fcResult?Number(fcResult.reputation):0;

  const scoreColor=neynarScore>=8?'text-amber-600':neynarScore>=6?'text-[var(--ink)]':neynarScore>=4?'text-[var(--ink-muted)]':'text-[var(--ink-dim)]';
  const scoreBg=neynarScore>=8?'bg-amber-500/10 border-amber-500/30':'bg-[var(--surface-2)] border-[var(--border-subtle)]';

  const APP_WEBSITE_URL = APP_URL_WEB;
  const shareMsg = fcResult
    ? `Neynar Score ${fcResult.reputation}/10 on Base Analytics.\n\nExplore B20 tokens, swap Uniswap & Aerodrome in-app, scan your wallet free.\n\n${SHARE_TAGLINE}\n${SHARE_HASHTAGS}`
    : "";
  const sharePageUrl = fcResult
    ? `${APP_WEBSITE_URL}/share?score=${Math.round(Number(fcResult.reputation) * 10)}&rank=Neynar+${fcResult.reputation}%2F10&title=Neynar+Score+${fcResult.reputation}%2F10&v=score`
    : "";
  const xLink = twitterShare(shareMsg, sharePageUrl || APP_WEBSITE_URL);
  const fcLink = warpcast(shareMsg, sharePageUrl || MINIAPP_URL);

  return(
    <div className="space-y-4 w-full relative">
      <div
        className={`space-y-4 w-full transition-[filter] duration-300 ${
          unlocked ? "" : "blur-[5px] pointer-events-none select-none"
        }`}
      >
        <h3 className="text-[10px] font-black text-[var(--ink-muted)] uppercase tracking-widest flex items-center gap-2 mb-4">
          <MessageCircle size={13}/> Farcaster Identity {isScanningFc&&<RefreshCcw size={11} className="animate-spin text-[var(--ink-muted)]"/>}
        </h3>

        <form onSubmit={handleScanFarcaster} className="flex gap-3 mb-5">
          <div className="relative flex-1">
            <div className="absolute inset-y-0 left-3 flex items-center pointer-events-none"><span className="text-[var(--ink-muted)] font-bold text-sm">@</span></div>
            <input type="text" value={fcUsername} onChange={e=>setFcUsername(e.target.value.replace('@',''))} placeholder="Search any Farcaster username..." className="w-full bg-[var(--surface)] border border-[var(--border-subtle)] text-[var(--ink)] text-sm font-bold rounded-2xl focus:border-[var(--border-focus)] pl-8 pr-4 py-3.5 placeholder:text-[var(--ink-dim)] outline-none transition"/>
          </div>
          <button type="submit" disabled={isScanningFc} className="btn-primary font-black px-6 py-3.5 rounded-2xl flex items-center gap-2 disabled:opacity-50 transition shrink-0">
            {isScanningFc?<RefreshCcw size={16} className="animate-spin"/>:<Search size={16}/>} Scan
          </button>
        </form>
        {fcError&&<p className="text-amber-600 text-xs mb-4 font-bold">{fcError}</p>}
        {neynarUnavailable&&!fcResult&&(
          <p className="text-xs text-[var(--ink-muted)] mb-4 leading-relaxed">
            Get a free key at{" "}
            <a href="https://dev.neynar.com" target="_blank" rel="noopener noreferrer" className="text-[var(--brand-dark)] font-bold hover:underline">
              dev.neynar.com
            </a>
            , add <span className="font-mono text-[var(--ink-dim)]">NEYNAR_API_KEY=...</span> to <span className="font-mono text-[var(--ink-dim)]">.env.local</span>, then restart <span className="font-mono text-[var(--ink-dim)]">npm run dev</span>.
          </p>
        )}

        {fcResult?(
          <div className="space-y-4">
            <div className="bg-[var(--surface)] border border-[var(--border-subtle)] rounded-3xl p-5 sm:p-6 shadow-[var(--shadow-card)]">
              <div className="flex items-start gap-4 mb-5">
                {fcResult.pfpUrl?(
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={fcResult.pfpUrl} alt="pfp" className="w-14 h-14 sm:w-16 sm:h-16 rounded-2xl bg-[var(--surface-2)] shrink-0 object-cover"/>
                ):(
                  <div className="w-14 h-14 sm:w-16 sm:h-16 rounded-2xl bg-[var(--surface-2)] flex items-center justify-center shrink-0"><MessageCircle size={28} className="text-[var(--ink-muted)]"/></div>
                )}
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2 mb-1">
                    <h4 className="font-black text-xl text-[var(--ink)]">{fcResult.username}</h4>
                    {fcResult.powerBadge&&<span className="text-[9px] font-black bg-amber-500/15 text-amber-700 border border-amber-500/30 px-2 py-0.5 rounded-full flex items-center gap-1"><Star size={8}/>Power Badge</span>}
                  </div>
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="text-[10px] font-black bg-[var(--surface-2)] text-[var(--ink-muted)] border border-[var(--border-subtle)] px-2 py-1 rounded-lg">FID #{fcResult.fid}</span>
                    <span className={`text-[10px] font-black px-2 py-1 rounded-lg border ${fcResult.tier==='Power User'?'bg-amber-500/10 text-amber-700 border-amber-500/25':fcResult.tier==='Active Caster'?'bg-[var(--brand-soft)] text-[var(--brand-dark)] border-[var(--brand)]/30':fcResult.tier==='Regular'?'bg-[var(--surface-2)] text-[var(--ink-muted)] border-[var(--border-subtle)]':'bg-[var(--surface-2)] text-[var(--ink-dim)] border-[var(--border-subtle)]'}`}>{fcResult.tier}</span>
                    <span className="text-[10px] font-black bg-[var(--surface-2)] text-[var(--ink-muted)] border border-[var(--border-subtle)] px-2 py-1 rounded-lg flex items-center gap-1"><Calendar size={9}/>Joined {fcResult.joinedDate}</span>
                  </div>
                  {fcResult.bio&&<p className="text-xs text-[var(--ink-dim)] mt-2 line-clamp-2 leading-relaxed">{fcResult.bio}</p>}
                </div>
                <div className="flex gap-2 shrink-0">
                  <a href={fcLink} target="_blank" rel="noopener noreferrer" className="bg-[var(--surface-2)] hover:bg-[var(--bg-hover)] border border-[var(--border-subtle)] text-[var(--ink)] p-2.5 rounded-xl transition"><Send size={14}/></a>
                  <a href={xLink} target="_blank" rel="noopener noreferrer" className="bg-[var(--ink)] hover:opacity-90 text-white p-2.5 rounded-xl transition"><Twitter size={14}/></a>
                </div>
              </div>

              <div className="grid grid-cols-3 gap-3 mb-5">
                {[
                  {label:'FOLLOWERS',value:fcResult.followers.toLocaleString(),icon:<Users size={13}/>,color:'text-[var(--ink)]'},
                  {label:'FOLLOWING',value:fcResult.following.toLocaleString(),icon:<Users size={13}/>,color:'text-[var(--ink)]'},
                  {label:'FID AGE',value:fcResult.fidAgeLabel,icon:<Clock size={13}/>,color:'text-emerald-600'},
                ].map((s,i)=>(
                  <div key={i} className="bg-[var(--surface-2)] border border-[var(--border-subtle)] rounded-2xl p-3 sm:p-4 text-center">
                    <div className={`flex items-center justify-center gap-1 mb-1 ${s.color}`}>{s.icon}<span className="text-[9px] font-black uppercase tracking-widest text-[var(--ink-muted)]">{s.label}</span></div>
                    <p className={`font-black text-base sm:text-xl ${s.color}`}>{s.value}</p>
                  </div>
                ))}
              </div>

              <div className={`rounded-2xl border p-4 sm:p-5 mb-4 ${scoreBg}`}>
                <p className="text-[10px] font-black uppercase tracking-widest text-[var(--ink-muted)] mb-2">NEYNAR REPUTATION SCORE</p>
                <p className={`text-5xl sm:text-6xl font-black tracking-tight ${scoreColor}`}>{fcResult.reputation}<span className="text-xl text-[var(--ink-muted)]">/10</span></p>
              </div>

              <div className="space-y-2">
                {[
                  {icon:<Clock size={15} className="text-[var(--ink-muted)]"/>,label:`FID Age: ${fcResult.fidAgeMonths} months`,value:`+${Math.round(fcResult.fidAgeMonths*200)} XP`,color:'text-emerald-600'},
                  {icon:<Users size={15} className="text-[var(--ink-muted)]"/>,label:`Followers: ${fcResult.followers.toLocaleString()}`,value:fcResult.followers>5000?`+${Math.round(fcResult.followers/50)} XP`:'Grow your audience',color:fcResult.followers>5000?'text-emerald-600':'text-[var(--ink-muted)]'},
                  {icon:<Hash size={15} className="text-orange-500"/>,label:`FID Number: #${fcResult.fid.toLocaleString()}`,value:fcResult.fid<10000?'OG Early Adopter 🛸':fcResult.fid<100000?'Early Member':'Standard',color:fcResult.fid<10000?'text-amber-600':fcResult.fid<100000?'text-[var(--ink)]':'text-[var(--ink-muted)]'},
                  {icon:<ShieldCheck size={15} className="text-emerald-600"/>,label:`Verifications: ${fcResult.verifications}`,value:fcResult.verifications>0?'Verified ✓':'Not verified',color:fcResult.verifications>0?'text-emerald-600':'text-[var(--ink-muted)]'},
                  {icon:<Star size={15} className="text-amber-500"/>,label:'Most Influential Follower',value:fcResult.topFollower,color:'text-[var(--ink)]'},
                ].map((row,i)=>(
                  <div key={i} className="flex items-center justify-between bg-[var(--surface-2)] hover:bg-[var(--bg-hover)] border border-[var(--border-subtle)] rounded-xl p-3 sm:p-4 transition-colors">
                    <div className="flex items-center gap-2.5 min-w-0">
                      {row.icon}
                      <span className="text-xs sm:text-sm text-[var(--ink)] font-bold truncate">{row.label}</span>
                    </div>
                    <span className={`text-xs sm:text-sm font-black shrink-0 ml-2 ${row.color}`}>{row.value}</span>
                  </div>
                ))}
              </div>
            </div>

            <div className="bg-[var(--surface)] border border-[var(--border-subtle)] rounded-3xl p-5 sm:p-6 shadow-[var(--shadow-card)]">
              <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 mb-5">
                <div>
                  <h4 className="font-black text-[var(--ink)] text-base sm:text-lg">Cast Analytics</h4>
                  <p className="text-xs text-[var(--ink-muted)] mt-0.5">
                    {isFetchingHistory
                      ? "Scanning full cast history from first post…"
                      : castAnalytics?.historyComplete
                        ? "Full history scanned from first cast to today"
                        : "Partial history — still loading or capped"}
                    {isFetchingHistory&&<RefreshCcw size={10} className="animate-spin inline ml-1"/>}
                  </p>
                </div>
                <div className="flex gap-2 flex-wrap">
                  <div className="flex max-w-full overflow-x-auto no-scrollbar gap-0.5 rounded-xl border border-[var(--border-subtle)] bg-[var(--surface-2)] p-1">
                    {(['24h','3d','7d','14d','30d'] as const).map(tf=>(
                      <button
                        key={tf}
                        type="button"
                        aria-pressed={analyticsTimeframe===tf}
                        onClick={()=>setAnalyticsTimeframe(tf)}
                        className={`shrink-0 min-h-[32px] px-2.5 py-1.5 text-[10px] font-black uppercase rounded-lg transition ${
                          analyticsTimeframe===tf ? "preset-chip-active" : "preset-chip"
                        }`}
                      >
                        {tf}
                      </button>
                    ))}
                  </div>
                  <div className="flex gap-0.5 rounded-xl border border-[var(--border-subtle)] bg-[var(--surface-2)] p-1">
                    <button
                      type="button"
                      aria-pressed={feedTab==='stats'}
                      onClick={()=>setFeedTab('stats')}
                      className={`min-h-[32px] px-3 py-1.5 text-[10px] font-black uppercase rounded-lg transition ${
                        feedTab==='stats' ? "preset-chip-active" : "preset-chip"
                      }`}
                    >
                      Stats
                    </button>
                    <button
                      type="button"
                      aria-pressed={feedTab==='casts'}
                      onClick={()=>setFeedTab('casts')}
                      className={`min-h-[32px] px-3 py-1.5 text-[10px] font-black uppercase rounded-lg transition ${
                        feedTab==='casts' ? "preset-chip-active" : "preset-chip"
                      }`}
                    >
                      Casts
                    </button>
                  </div>
                </div>
              </div>

              {feedTab==='stats'&&castAnalytics?(
                <div className="space-y-4">
                  <div className="bg-[var(--surface)] border border-[var(--border-subtle)] rounded-2xl p-4 sm:p-5 shadow-[var(--shadow-card)]">
                    <div className="flex flex-wrap items-start justify-between gap-4 mb-4">
                      <div>
                        <p className="text-[10px] font-black text-[var(--ink-muted)] uppercase tracking-widest flex items-center gap-1.5">
                          <Calendar size={12} className="text-[var(--brand-dark)]" />
                          Active days
                        </p>
                        <p className="text-xs text-[var(--ink-dim)] mt-1 max-w-md">
                          Each day you post at least one cast counts as 1 active day.
                        </p>
                      </div>
                      <div className="text-right">
                        <p className="text-4xl sm:text-5xl font-black text-[var(--ink)] tabular-nums leading-none">
                          {castAnalytics.activeDays}
                        </p>
                        <p className="text-[11px] font-bold text-[var(--ink-muted)] mt-1">
                          of {castAnalytics.periodDays} days ({analyticsTimeframe})
                        </p>
                      </div>
                    </div>

                    <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 mb-4">
                      <div className="rounded-xl bg-[var(--surface-2)] border border-[var(--border-subtle)] p-3 text-center">
                        <p className="text-xl font-black text-emerald-600 tabular-nums">{castAnalytics.activeDayPct}%</p>
                        <p className="text-[9px] text-[var(--ink-muted)] uppercase font-bold mt-1">Posting consistency</p>
                      </div>
                      <div className="rounded-xl bg-[var(--surface-2)] border border-[var(--border-subtle)] p-3 text-center">
                        <p className="text-xl font-black text-[var(--ink)] tabular-nums">{castAnalytics.allTimeDays}</p>
                        <p className="text-[9px] text-[var(--ink-muted)] uppercase font-bold mt-1">All-time active days</p>
                        {castAnalytics.firstCastLabel&&(
                          <p className="text-[9px] text-[var(--ink-dim)] mt-1 leading-snug">
                            Since {castAnalytics.firstCastLabel}
                            {castAnalytics.daysSinceFirstCast
                              ? ` · ${castAnalytics.daysSinceFirstCast}d span`
                              : ""}
                          </p>
                        )}
                      </div>
                      <div className="rounded-xl bg-[var(--surface-2)] border border-[var(--border-subtle)] p-3 text-center col-span-2 sm:col-span-1">
                        <p className="text-xl font-black text-[var(--ink)] tabular-nums">{castAnalytics.castsScanned.toLocaleString()}</p>
                        <p className="text-[9px] text-[var(--ink-muted)] uppercase font-bold mt-1">Casts scanned</p>
                        {castAnalytics.profileCastCount>0&&(
                          <p className="text-[9px] text-[var(--ink-dim)] mt-1">
                            of {castAnalytics.profileCastCount.toLocaleString()} total
                            {!castAnalytics.historyComplete?" · partial":""}
                          </p>
                        )}
                      </div>
                    </div>

                    <div className="rounded-xl border border-[var(--border-subtle)] bg-[var(--surface-2)] p-3">
                      <div className="flex items-center justify-between gap-2 mb-2">
                        <p className="text-[9px] font-black text-[var(--ink-muted)] uppercase tracking-widest">
                          {analyticsTimeframe} activity track
                        </p>
                        <span className="text-[10px] font-black text-[var(--ink)] tabular-nums">
                          {castAnalytics.activeDays}/{castAnalytics.periodDays}
                        </span>
                      </div>
                      <div
                        className="grid gap-1.5"
                        style={{
                          gridTemplateColumns: `repeat(${Math.min(castAnalytics.periodTrack.length, 14)}, minmax(0, 1fr))`,
                        }}
                      >
                        {castAnalytics.periodTrack.map((day) => (
                          <div
                            key={day.key}
                            title={day.key}
                            className={`aspect-square max-h-12 rounded-lg flex flex-col items-center justify-center gap-0.5 border ${
                              day.active
                                ? "border-emerald-500/50 bg-emerald-500/15"
                                : "border-[var(--border-subtle)] bg-[var(--surface)]"
                            }`}
                          >
                            <span
                              className={`text-[8px] font-black uppercase ${
                                day.active ? "text-emerald-700" : "text-[var(--ink-muted)]"
                              }`}
                            >
                              {day.label}
                            </span>
                            {day.active && <span className="text-[10px] leading-none text-emerald-700">✓</span>}
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>

                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                    {[
                      {icon:<MessageCircle size={18}/>,label:'Total Casts',val:castAnalytics.totalCasts,c:'text-[var(--ink)]',bg:'bg-[var(--bg-elevated)]'},
                      {icon:<Heart size={18}/>,label:'Total Likes',val:castAnalytics.totalLikes,c:'text-red-400',bg:'bg-red-500/10'},
                      {icon:<Repeat size={18}/>,label:'Recasts',val:castAnalytics.totalRecasts,c:'text-green-400',bg:'bg-green-500/10'},
                      {icon:<MessageSquare size={18}/>,label:'Replies',val:castAnalytics.totalReplies,c:'text-[var(--ink)]',bg:'bg-[var(--bg-elevated)]'},
                    ].map((s,i)=>(
                      <div key={i} className="bg-[var(--surface)] border border-[var(--border-subtle)] rounded-2xl p-4 text-center shadow-[var(--shadow-card)]">
                        <div className={`p-2 ${s.bg} ${s.c} rounded-xl mb-2 w-fit mx-auto`}>{s.icon}</div>
                        <p className={`font-black text-2xl ${s.c}`}>{s.val.toLocaleString()}</p>
                        <p className="text-[10px] text-[var(--ink-muted)] uppercase font-bold tracking-wide mt-1">{s.label}</p>
                      </div>
                    ))}
                  </div>

                  <div className="space-y-2">
                    <p className="text-[10px] font-black text-[var(--ink-muted)] uppercase tracking-widest mb-3">Detailed Breakdown</p>
                    {[
                      {icon:<Flame size={15} className="text-orange-500"/>,label:'Longest Streak',value:`${castAnalytics.longestStreak} days`,sub:'consecutive days casting',positive:castAnalytics.longestStreak>3},
                      {icon:<Zap size={15} className="text-amber-500"/>,label:'Current Streak',value:`${castAnalytics.currentStreak} days`,sub:castAnalytics.currentStreak>0?'keep it going!':'streak broken',positive:castAnalytics.currentStreak>0},
                      {icon:<BarChart3 size={15} className="text-[var(--ink-muted)]"/>,label:'Avg Casts / Day',value:`${castAnalytics.avgPerDay}`,sub:'over selected period',positive:castAnalytics.avgPerDay>1},
                      {icon:<Target size={15} className="text-[var(--ink-muted)]"/>,label:'Engagement Rate',value:`${castAnalytics.engRate}x`,sub:'avg reactions per cast',positive:castAnalytics.engRate>2},
                      {icon:<Star size={15} className="text-amber-500"/>,label:'Best Day to Cast',value:castAnalytics.bestDay,sub:'most active weekday',positive:true},
                      {icon:<Heart size={15} className="text-red-500"/>,label:'Most Liked Cast',value:`${castAnalytics.mostLiked?.reactions?.likes_count||0} likes`,sub:castAnalytics.mostLiked?.text?.substring(0,40)+'...'||'No casts in period',positive:(castAnalytics.mostLiked?.reactions?.likes_count||0)>5},
                    ].map((row,i)=>(
                      <div key={i} className="flex items-center justify-between bg-[var(--surface)] hover:bg-[var(--surface-2)] border border-[var(--border-subtle)] rounded-xl p-3 sm:p-4 transition-colors gap-3">
                        <div className="flex items-center gap-2.5 min-w-0 flex-1">
                          {row.icon}
                          <div className="min-w-0">
                            <p className="text-xs sm:text-sm text-[var(--ink)] font-bold truncate">{row.label}</p>
                            {row.sub&&<p className="text-[10px] text-[var(--ink-dim)] truncate">{row.sub}</p>}
                          </div>
                        </div>
                        <span className={`text-sm sm:text-base font-black shrink-0 ${row.positive?'text-emerald-600':'text-[var(--ink-muted)]'}`}>{row.value}</span>
                      </div>
                    ))}
                  </div>

                  <div className="bg-[var(--surface)] border border-[var(--border-subtle)] rounded-2xl p-4 sm:p-5 shadow-[var(--shadow-card)]">
                    <p className="text-[10px] font-black text-[var(--ink-muted)] uppercase tracking-widest mb-4">Reputation Scores</p>
                    <div className="space-y-4">
                      {[
                        {label:'Neynar Score',val:fcResult.reputation,max:10,icon:<Cpu size={12} className="text-[var(--ink-muted)]"/>,desc:'Farcaster network trust score'},
                        {label:'Ethos Credential',val:ethosScore,max:1000,icon:<ShieldCheck size={12} className="text-[var(--ink-muted)]"/>,desc:'Onchain reputation credential'},
                        {label:'Social Quotient',val:quotientScore,max:100,icon:<Zap size={12} className="text-[var(--ink-muted)]"/>,desc:'Overall social influence index'},
                      ].map((s,i)=>(
                        <div key={i}>
                          <div className="flex justify-between items-center mb-1.5 gap-2">
                            <div className="flex items-center gap-1.5 min-w-0">
                              {s.icon}
                              <div className="min-w-0">
                                <span className="text-xs font-bold text-[var(--ink)]">{s.label}</span>
                                <span className="text-[10px] text-[var(--ink-dim)] ml-2">{s.desc}</span>
                              </div>
                            </div>
                            <span className="text-sm font-black text-[var(--ink)] shrink-0">{s.val}<span className="text-[10px] text-[var(--ink-muted)]">/{s.max}</span></span>
                          </div>
                          <div className="w-full bg-[var(--surface-2)] rounded-full h-1.5 overflow-hidden border border-[var(--border-subtle)]">
                            <div className="h-full rounded-full transition-all duration-1000 bg-[var(--brand)]" style={{width:`${(Number(s.val)/Number(s.max))*100}%`}}/>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              ):feedTab==='stats'?(
                <div className="text-center py-8">
                  <RefreshCcw className="animate-spin text-rose-400 mx-auto mb-3" size={24}/>
                  <p className="text-[var(--ink-muted)] text-sm">Loading cast analytics...</p>
                </div>
              ):(
                <div>
                  <p className="text-[10px] font-black text-[var(--ink-muted)] uppercase tracking-widest mb-3">Recent Casts</p>
                  {isFetchingForYou?(
                    <div className="text-center py-6"><RefreshCcw className="animate-spin text-[var(--ink-muted)] mx-auto" size={20}/></div>
                  ):forYouFeed.length>0?(
                    <div className="space-y-2">
                      {forYouFeed.map((cast,i)=>(
                        <a key={i} href={`https://warpcast.com/${cast.author?.username}/${cast.hash.substring(0,10)}`} target="_blank" rel="noopener noreferrer"
                          className="flex items-start gap-3 bg-[var(--surface)] hover:bg-[var(--surface-2)] border border-[var(--border-subtle)] p-3 sm:p-4 rounded-xl transition group">
                          {cast.author?.pfp_url&&(
                            // eslint-disable-next-line @next/next/no-img-element
                            <img src={cast.author.pfp_url} alt="pfp" className="w-8 h-8 rounded-xl bg-[var(--surface-2)] shrink-0 object-cover"/>
                          )}
                          <div className="flex-1 min-w-0">
                            <p className="text-xs text-[var(--ink)] leading-relaxed">{cast.text}</p>
                            <div className="flex items-center gap-3 mt-2">
                              <span className="flex items-center gap-1 text-[10px] text-red-500 font-bold"><Heart size={9}/>{cast.likes}</span>
                              <span className="text-[10px] text-[var(--ink-dim)] group-hover:text-[var(--brand-dark)] transition">View on Warpcast ↗</span>
                            </div>
                          </div>
                        </a>
                      ))}
                    </div>
                  ):(
                    <p className="text-[var(--ink-muted)] text-sm text-center py-6">No recent casts found.</p>
                  )}
                </div>
              )}
            </div>
          </div>
        ):(
          <div className="bg-[var(--surface)] border border-[var(--border-subtle)] rounded-3xl p-6 shadow-[var(--shadow-card)]">
            <div className="bg-[var(--surface-2)] border-2 border-dashed border-[var(--border-subtle)] rounded-2xl p-8 flex flex-col items-center justify-center text-center mb-4">
              <Lock size={28} className="text-[var(--ink-muted)] mb-3"/>
              <h4 className="font-black text-[var(--ink)] mb-1">Analytics Locked</h4>
              <p className="text-sm text-[var(--ink-muted)]">Connect your wallet or search a username above to unlock the full Farcaster dashboard.</p>
            </div>
            {isFetchingGlobal?(
              <div className="text-center py-6"><RefreshCcw className="animate-spin text-[var(--ink-muted)] mx-auto" size={20}/></div>
            ):(
              <div>
                <p className="text-[10px] font-black text-[var(--ink-muted)] uppercase tracking-widest mb-3">Trending on Farcaster</p>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  {globalFeed.map((cast,i)=>(
                    <a key={i} href={`https://warpcast.com/${cast.author?.username}/${cast.hash.substring(0,10)}`} target="_blank" rel="noopener noreferrer"
                      className="bg-[var(--surface)] border border-[var(--border-subtle)] p-4 rounded-2xl flex flex-col justify-between group hover:border-[var(--border-strong)] transition">
                      <div>
                        <div className="flex items-center gap-2 mb-3">
                          {cast.author?.pfp_url&&<img src={cast.author.pfp_url} alt="pfp" className="w-7 h-7 rounded-xl bg-[var(--surface-2)]"/>}
                          <span className="text-[10px] font-bold text-[var(--ink-muted)]">@{cast.author?.username}</span>
                        </div>
                        <p className="text-xs text-[var(--ink-dim)] leading-relaxed">&quot;{cast.text}&quot;</p>
                      </div>
                      <div className="mt-3 flex items-center gap-1 text-[10px] font-bold text-[var(--ink-muted)]"><Flame size={10}/> {cast.likes}</div>
                    </a>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}
      </div>

      {!unlocked && (
        <div className="absolute inset-0 z-20 flex items-center justify-center rounded-3xl bg-[var(--surface)]/55 p-4">
          <div className="max-w-sm w-full bg-[var(--surface)] border border-[var(--border-strong)] rounded-2xl p-6 text-center shadow-[0_18px_50px_rgba(11,21,38,0.16)]">
            <div className="w-12 h-12 rounded-2xl bg-[var(--bg-elevated)] border border-[var(--border-subtle)] flex items-center justify-center mx-auto mb-4">
              <Lock size={22} className="text-[var(--ink-muted)]" />
            </div>
            <p className="text-[10px] font-black text-[var(--ink-muted)] uppercase tracking-widest">
              x402 · Base mainnet
            </p>
            <h4 className="text-lg font-black text-[var(--ink)] mt-2">Unlock Farcaster Analysis</h4>
            <p className="text-sm text-[var(--ink-muted)] mt-2 leading-relaxed">
              Pay once per session to view your linked Farcaster profile, cast analytics, and username search results.
            </p>
            <p className="text-2xl font-black text-[var(--ink)] mt-4 tabular-nums">$0.10 USDC</p>
            <p className="text-[11px] text-[var(--ink-dim)] mt-1">via x402 on Base · session unlock only</p>
            <button
              type="button"
              onClick={onUnlock}
              disabled={unlockLoading}
              className="w-full mt-5 py-3.5 rounded-xl font-black text-sm btn-primary text-white disabled:opacity-50 flex items-center justify-center gap-2"
            >
              {unlockLoading ? (
                <>
                  <RefreshCcw size={16} className="animate-spin" />
                  Confirming payment…
                </>
              ) : (
                <>
                  <Zap size={16} />
                  Pay 0.10 USDC to unlock
                </>
              )}
            </button>
            <p className="text-[10px] text-[var(--ink-dim)] mt-3 leading-relaxed">
              Disconnecting or refreshing requires payment again.
            </p>
          </div>
        </div>
      )}
    </div>
  );
}
