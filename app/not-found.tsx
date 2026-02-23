import Link from 'next/link';
import { Activity } from 'lucide-react';

export default function NotFound() {
  return (
    <div className="min-h-screen bg-[#020410] flex flex-col items-center justify-center p-6 text-center text-white relative overflow-hidden">
      {/* Background Glow */}
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_center,#0033aa_0%,#000510_70%)] opacity-40"></div>
      
      {/* Icon */}
      <div className="w-24 h-24 bg-[#0052FF]/20 rounded-full mb-8 flex items-center justify-center border border-[#0052FF]/50 z-10">
        <Activity className="text-[#0052FF]" size={48} />
      </div>
      
      {/* Text */}
      <h2 className="text-4xl md:text-5xl font-black text-white mb-4 tracking-tighter z-10 drop-shadow-2xl">
        404 <span className="text-[#0052FF]">|</span> NOT FOUND
      </h2>
      
      {/* ✅ Fixed the apostrophe to use &apos; */}
      <p className="text-blue-200/80 mb-10 font-medium text-lg z-10 tracking-wide max-w-md">
        The analytics page you are looking for doesn&apos;t exist or has moved offchain.
      </p>
      
      {/* Return Button */}
      <Link 
        href="/" 
        className="px-8 py-4 bg-[#0052FF] text-white rounded-full font-black text-lg hover:bg-blue-600 transition active:scale-95 shadow-[0_0_40px_-10px_rgba(0,82,255,0.5)] z-10"
      >
        Return to Base
      </Link>
    </div>
  );
} 