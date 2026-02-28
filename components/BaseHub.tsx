"use client";
import React from 'react';
import { BookOpen, ShieldAlert, Code} from 'lucide-react';

export default function BaseHub() {
  return (
    <div className="animate-in fade-in slide-in-from-bottom-2">
      <h3 className="text-sm font-bold text-[#0052FF] mb-6 ml-2 flex items-center gap-2 uppercase tracking-widest">
        <BookOpen size={16} className="text-[#0052FF]" /> Base Hub (Learn & Build)
      </h3>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {/* Card 1: Beginners */}
        <div className="bg-slate-200 p-6 rounded-[20px] border border-slate-300 shadow-md flex flex-col items-center text-center hover:border-[#0052FF]/50 transition-all cursor-pointer">
          <div className="w-16 h-16 bg-[#0052FF]/10 text-[#0052FF] rounded-full flex items-center justify-center mb-4">
            <BookOpen size={32} />
          </div>
          <h4 className="font-black text-xl text-[#0052FF] uppercase mb-2">Web3 Basics</h4>
          <p className="text-xs font-bold text-slate-500">How to make your first transaction and understand gas fees.</p>
        </div>

        {/* Card 2: Security */}
        <div className="bg-slate-200 p-6 rounded-[20px] border border-slate-300 shadow-md flex flex-col items-center text-center hover:border-red-400 transition-all cursor-pointer">
          <div className="w-16 h-16 bg-red-500/10 text-red-500 rounded-full flex items-center justify-center mb-4">
            <ShieldAlert size={32} />
          </div>
          <h4 className="font-black text-xl text-red-500 uppercase mb-2">Scam Defense</h4>
          <p className="text-xs font-bold text-slate-500">How to identify fake websites and protect your wallet from drainers.</p>
        </div>

        {/* Card 3: Builders */}
        <div className="bg-slate-200 p-6 rounded-[20px] border border-slate-300 shadow-md flex flex-col items-center text-center hover:border-[#8A2BE2]/50 transition-all cursor-pointer">
          <div className="w-16 h-16 bg-[#8A2BE2]/10 text-[#8A2BE2] rounded-full flex items-center justify-center mb-4">
            <Code size={32} />
          </div>
          <h4 className="font-black text-xl text-[#8A2BE2] uppercase mb-2">Deploy a Contract</h4>
          <p className="text-xs font-bold text-slate-500">Step-by-step guide to deploying your first smart contract on Base.</p>
        </div>
      </div>
    </div>
  );
} 