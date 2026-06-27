"use client";
import { useState, useEffect, useMemo } from 'react';
import { useAccount } from 'wagmi';
import { fetchNeynar } from "@/lib/api/neynar";
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
  powerBadge:boolean;
}
interface FarcasterCast { hash:string; text:string; author:{username:string;pfp_url:string;}; likes:number; }
interface RawCast { hash:string; text:string; timestamp?:string; author?:{username?:string;pfp_url?:string;pfp?:{url?:string}}; reactions?:{likes_count?:number;recasts_count?:number}; replies?:{count?:number}; }

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
  };
};

export default function FarcasterAnalytics(){
  const{address}=useAccount();

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
  const[neynarUnavailable,setNeynarUnavailable]=useState(false);

  useEffect(()=>{
    if(!address||address===scannedAddress||neynarUnavailable)return;
    const auto=async()=>{
      setScannedAddress(address);setIsScanningFc(true);setFcError('');
      try{
        const { ok, data, unavailable }=await fetchNeynar("v2/farcaster/user/bulk-by-address",{addresses:address});
        if(unavailable){setNeynarUnavailable(true);setFcError('Farcaster analytics need NEYNAR_API_KEY in .env.local (server).');return;}
        if(!ok)return;
        const lower=address.toLowerCase();
        const users=(data[lower] as Record<string,unknown>[]|undefined);
        if(users&&users.length>0){setFcResult(await buildFcResult(users[0]));}
      }catch(e){console.error(e);}finally{setIsScanningFc(false);}
    };
    auto();
  },[address,scannedAddress,neynarUnavailable]);

  useEffect(()=>{
    if(!fcResult?.fid||neynarUnavailable)return;
    const fetch2=async()=>{
      setIsFetchingHistory(true);
      try{
        const { ok, data, unavailable }=await fetchNeynar("v2/farcaster/feed/user/casts",{fid:fcResult.fid,limit:100});
        if(unavailable){setNeynarUnavailable(true);return;}
        if(ok&&data.casts)setUserCastsHistory(data.casts as RawCast[]);
      }catch{}finally{setIsFetchingHistory(false);}
    };
    fetch2();
  },[fcResult?.fid,neynarUnavailable]);

  useEffect(()=>{
    if(feedTab!=='casts'||!fcResult?.fid||neynarUnavailable)return;
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
  },[feedTab,fcResult?.fid,neynarUnavailable]);

  useEffect(()=>{
    if(neynarUnavailable)return;
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
  },[neynarUnavailable]);

  const handleScanFarcaster=async(e:React.FormEvent)=>{
    e.preventDefault();if(!fcUsername||neynarUnavailable)return;
    setIsScanningFc(true);setFcResult(null);setFcError('');setUserCastsHistory([]);
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

    const castDays=new Set(filtered.map(c=>c.timestamp?.split('T')[0]).filter((d):d is string=>typeof d==='string'));

    const sortedDays=Array.from(castDays).sort();
    let longest=0,current=0,prev='';
    for(const d of sortedDays){
      if(prev){const diff=(new Date(d).getTime()-new Date(prev).getTime())/86400000;if(Math.round(diff)===1)current++;else current=1;}else current=1;
      longest=Math.max(longest,current);prev=d;
    }
    const todayStr=new Date().toISOString().split('T')[0];
    const yesterdayStr=new Date(Date.now()-86400000).toISOString().split('T')[0];
    let currentStreak=0;
    if(castDays.has(todayStr)||castDays.has(yesterdayStr)){
      let check=castDays.has(todayStr)?todayStr:yesterdayStr;
      while(castDays.has(check)){currentStreak++;const prev2=new Date(new Date(check).getTime()-86400000).toISOString().split('T')[0];check=prev2;}
    }

    const mostLiked=filtered.reduce((best,c)=>(c.reactions?.likes_count||0)>(best.reactions?.likes_count||0)?c:best,filtered[0]);

    const avgPerDay=days>0?Math.round((totalCasts/days)*10)/10:0;
    const engRate=totalCasts>0?Math.round(((totalLikes+totalRecasts+totalReplies)/totalCasts)*10)/10:0;
    const dayCount:Record<string,number>={Mon:0,Tue:0,Wed:0,Thu:0,Fri:0,Sat:0,Sun:0};
    const dayKeys=['Sun','Mon','Tue','Wed','Thu','Fri','Sat'];
    filtered.forEach(c=>{if(c.timestamp){const d=new Date(c.timestamp);dayCount[dayKeys[d.getDay()]]=(dayCount[dayKeys[d.getDay()]]||0)+1;}});
    const bestDay=Object.entries(dayCount).sort((a,b)=>b[1]-a[1])[0]?.[0]||'N/A';

    return{totalCasts,totalLikes,totalRecasts,totalReplies,castDays:castDays.size,longestStreak:longest,currentStreak,avgPerDay,engRate,bestDay,mostLiked};
  },[userCastsHistory,analyticsTimeframe]);

  const ethosScore=fcResult?Math.min(1000,500+(fcResult.followers*0.05)+(Number(fcResult.reputation)*30)).toFixed(0):'0';
  const quotientScore=fcResult?Math.min(99.9,40+(Number(fcResult.reputation)*5)).toFixed(1):'0';
  const neynarScore=fcResult?Number(fcResult.reputation):0;

  const scoreColor=neynarScore>=8?'text-yellow-400':neynarScore>=6?'text-cyan-400':neynarScore>=4?'text-purple-400':'text-slate-400';
  const scoreBg=neynarScore>=8?'bg-yellow-500/10 border-yellow-500/25':neynarScore>=6?'bg-cyan-500/10 border-cyan-500/20':neynarScore>=4?'bg-purple-500/10 border-purple-500/25':'bg-white/5 border-white/8';

  const APP_WEBSITE_URL='https://base-analytics-app.vercel.app';
  const FARCASTER_MINI_APP_URL='https://farcaster.xyz/miniapps/lYFXQz4s1wsq/base-analytics';
  const shareMsg=fcResult?`I scored ${fcResult.reputation}/10 Neynar Score on Base Analytics! 🔵🚀`:'';
  const sharePageUrl=fcResult?`${APP_WEBSITE_URL}/share?score=${Math.round(Number(fcResult.reputation)*10)}&rank=Neynar+${fcResult.reputation}%2F10&title=Neynar+Score+${fcResult.reputation}%2F10&v=score`:'';
  const xLink=`https://twitter.com/intent/tweet?text=${encodeURIComponent(shareMsg)}&url=${encodeURIComponent(sharePageUrl||APP_WEBSITE_URL)}`;
  const fcLink=`https://warpcast.com/~/compose?text=${encodeURIComponent(shareMsg)}&embeds[]=${encodeURIComponent(sharePageUrl||FARCASTER_MINI_APP_URL)}`;

  return(
    <div className="space-y-4 w-full">

      <div className="w-full">
        <h3 className="text-[10px] font-black text-slate-600 uppercase tracking-widest flex items-center gap-2 mb-4">
          <MessageCircle size={13}/> Farcaster Identity {isScanningFc&&<RefreshCcw size={11} className="animate-spin text-slate-700"/>}
        </h3>

        <form onSubmit={handleScanFarcaster} className="flex gap-3 mb-5">
          <div className="relative flex-1">
            <div className="absolute inset-y-0 left-3 flex items-center pointer-events-none"><span className="text-slate-600 font-bold text-sm">@</span></div>
            <input type="text" value={fcUsername} onChange={e=>setFcUsername(e.target.value.replace('@',''))} placeholder="Search any Farcaster username..." className="w-full bg-white/4 border border-white/6 text-white text-sm font-bold rounded-2xl focus:border-purple-500/50 focus:ring-1 focus:ring-purple-500/20 pl-8 pr-4 py-3.5 placeholder-slate-600 outline-none transition"/>
          </div>
          <button type="submit" disabled={isScanningFc} className="bg-purple-600 hover:bg-purple-500 text-white font-black px-6 py-3.5 rounded-2xl flex items-center gap-2 disabled:opacity-50 transition shrink-0">
            {isScanningFc?<RefreshCcw size={16} className="animate-spin"/>:<Search size={16}/>} Scan
          </button>
        </form>
        {fcError&&<p className="text-amber-400/90 text-xs mb-4 font-bold">{fcError}</p>}
        {neynarUnavailable&&!fcResult&&(
          <p className="text-xs text-slate-500 mb-4 leading-relaxed">
            Get a free key at{" "}
            <a href="https://dev.neynar.com" target="_blank" rel="noopener noreferrer" className="text-cyan-400 font-bold hover:text-cyan-300">
              dev.neynar.com
            </a>
            , add <span className="font-mono text-slate-400">NEYNAR_API_KEY=...</span> to <span className="font-mono text-slate-400">.env.local</span>, then restart <span className="font-mono text-slate-400">npm run dev</span>.
          </p>
        )}

        {fcResult?(
          <div className="space-y-4">
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
                    <span className={`text-[10px] font-black px-2 py-1 rounded-lg border ${fcResult.tier==='Power User'?'bg-yellow-500/10 text-yellow-400 border-yellow-500/20':fcResult.tier==='Active Caster'?'bg-cyan-500/10 text-cyan-400 border-cyan-500/18':fcResult.tier==='Regular'?'bg-purple-500/10 text-purple-400 border-purple-500/20':'bg-white/5 text-slate-500 border-white/8'}`}>{fcResult.tier}</span>
                    <span className="text-[10px] font-black bg-white/5 text-slate-400 border border-white/8 px-2 py-1 rounded-lg flex items-center gap-1"><Calendar size={9}/>Joined {fcResult.joinedDate}</span>
                  </div>
                  {fcResult.bio&&<p className="text-xs text-slate-500 mt-2 line-clamp-2 leading-relaxed">{fcResult.bio}</p>}
                </div>
                <div className="flex gap-2 shrink-0">
                  <a href={fcLink} target="_blank" rel="noopener noreferrer" className="bg-purple-600 hover:bg-purple-500 text-white p-2.5 rounded-xl transition"><Send size={14}/></a>
                  <a href={xLink} target="_blank" rel="noopener noreferrer" className="bg-slate-800 hover:bg-slate-700 text-white p-2.5 rounded-xl transition"><Twitter size={14}/></a>
                </div>
              </div>

              <div className="grid grid-cols-3 gap-3 mb-5">
                {[
                  {label:'FOLLOWERS',value:fcResult.followers.toLocaleString(),icon:<Users size={13}/>,color:'text-cyan-400'},
                  {label:'FOLLOWING',value:fcResult.following.toLocaleString(),icon:<Users size={13}/>,color:'text-purple-400'},
                  {label:'FID AGE',value:fcResult.fidAgeLabel,icon:<Clock size={13}/>,color:'text-green-400'},
                ].map((s,i)=>(
                  <div key={i} className="bg-white/4 border border-white/6 rounded-2xl p-3 sm:p-4 text-center">
                    <div className={`flex items-center justify-center gap-1 mb-1 ${s.color}`}>{s.icon}<span className="text-[9px] font-black uppercase tracking-widest text-slate-600">{s.label}</span></div>
                    <p className={`font-black text-base sm:text-xl ${s.color}`}>{s.value}</p>
                  </div>
                ))}
              </div>

              <div className={`rounded-2xl border p-4 sm:p-5 mb-4 ${scoreBg}`}>
                <p className="text-[10px] font-black uppercase tracking-widest text-slate-500 mb-2">NEYNAR REPUTATION SCORE</p>
                <p className={`text-5xl sm:text-6xl font-black tracking-tight ${scoreColor}`}>{fcResult.reputation}<span className="text-xl text-slate-600">/10</span></p>
              </div>

              <div className="space-y-2">
                {[
                  {icon:<Clock size={15} className="text-cyan-400"/>,label:`FID Age: ${fcResult.fidAgeMonths} months`,value:`+${Math.round(fcResult.fidAgeMonths*200)} XP`,color:'text-green-400'},
                  {icon:<Users size={15} className="text-purple-400"/>,label:`Followers: ${fcResult.followers.toLocaleString()}`,value:fcResult.followers>5000?`+${Math.round(fcResult.followers/50)} XP`:'Grow your audience',color:fcResult.followers>5000?'text-green-400':'text-slate-500'},
                  {icon:<Hash size={15} className="text-orange-400"/>,label:`FID Number: #${fcResult.fid.toLocaleString()}`,value:fcResult.fid<10000?'OG Early Adopter 🛸':fcResult.fid<100000?'Early Member':'Standard',color:fcResult.fid<10000?'text-yellow-400':fcResult.fid<100000?'text-cyan-400':'text-slate-500'},
                  {icon:<ShieldCheck size={15} className="text-green-400"/>,label:`Verifications: ${fcResult.verifications}`,value:fcResult.verifications>0?'Verified ✓':'Not verified',color:fcResult.verifications>0?'text-green-400':'text-slate-500'},
                  {icon:<Star size={15} className="text-yellow-400"/>,label:'Most Influential Follower',value:fcResult.topFollower,color:'text-cyan-300'},
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

            <div className="bg-[#13182a] border border-white/6 rounded-3xl p-5 sm:p-6">
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
                    <button onClick={()=>setFeedTab('stats')} className={`px-3 py-1.5 text-[10px] font-black uppercase rounded-lg transition ${feedTab==='stats'?'btn-primary text-white':'text-slate-600 hover:text-slate-400'}`}>Stats</button>
                    <button onClick={()=>setFeedTab('casts')} className={`px-3 py-1.5 text-[10px] font-black uppercase rounded-lg transition ${feedTab==='casts'?'bg-purple-600 text-white':'text-slate-600 hover:text-slate-400'}`}>Casts</button>
                  </div>
                </div>
              </div>

              {feedTab==='stats'&&castAnalytics?(
                <div className="space-y-4">
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                    {[
                      {icon:<MessageCircle size={18}/>,label:'Total Casts',val:castAnalytics.totalCasts,c:'text-cyan-400',bg:'bg-cyan-500/10'},
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

                  <div className="space-y-2">
                    <p className="text-[10px] font-black text-slate-600 uppercase tracking-widest mb-3">Detailed Breakdown</p>
                    {[
                      {icon:<Calendar size={15} className="text-cyan-400"/>,label:'Active Cast Days',value:`${castAnalytics.castDays} days`,sub:`out of ${analyticsTimeframe==='24h'?1:analyticsTimeframe==='3d'?3:analyticsTimeframe==='7d'?7:analyticsTimeframe==='14d'?14:30} days`,positive:castAnalytics.castDays>0},
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

                  <div className="bg-white/3 border border-white/5 rounded-2xl p-4 sm:p-5">
                    <p className="text-[10px] font-black text-slate-600 uppercase tracking-widest mb-4">Reputation Scores</p>
                    <div className="space-y-4">
                      {[
                        {label:'Neynar Score',val:fcResult.reputation,max:10,color:'#8A2BE2',icon:<Cpu size={12} className="text-purple-400"/>,desc:'Farcaster network trust score'},
                        {label:'Ethos Credential',val:ethosScore,max:1000,color:'#10b981',icon:<ShieldCheck size={12} className="text-emerald-400"/>,desc:'Onchain reputation credential'},
                        {label:'Social Quotient',val:quotientScore,max:100,color:'#00E5FF',icon:<Zap size={12} className="text-cyan-400"/>,desc:'Overall social influence index'},
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
                  <RefreshCcw className="animate-spin text-rose-400 mx-auto mb-3" size={24}/>
                  <p className="text-slate-500 text-sm">Loading cast analytics...</p>
                </div>
              ):(
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
                              <span className="text-[10px] text-slate-600 group-hover:text-cyan-400 transition">View on Warpcast ↗</span>
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
                <p className="text-[10px] font-black text-slate-600 uppercase tracking-widest mb-3">Trending on Farcaster</p>
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
    </div>
  );
}
