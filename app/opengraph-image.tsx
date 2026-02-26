import { ImageResponse } from 'next/og';

export const runtime = 'edge';
export const alt = 'Base Analytics - Mint Your Onchain Identity';
export const size = { width: 1200, height: 630 };
export const contentType = 'image/png';

export default async function Image() {
  return new ImageResponse(
    (
      <div
        style={{
          width: '100%',
          height: '100%',
          display: 'flex',
          flexDirection: 'row', 
          alignItems: 'center',
          justifyContent: 'space-between',
          backgroundColor: '#e2e8f0', // Clean, solid, Satori-safe Slate-200 background
          fontFamily: 'sans-serif',
          padding: '60px',
        }}
      >
        {/* ================= LEFT SIDE: COPY & BRAND ================= */}
        <div style={{ display: 'flex', flexDirection: 'column', width: '55%', height: '100%', justifyContent: 'space-between' }}>
          
          <div style={{ display: 'flex', flexDirection: 'column' }}>
            {/* Top Brand Tag */}
            <div style={{ display: 'flex', alignItems: 'center', marginBottom: '30px', backgroundColor: 'white', border: '1px solid #cbd5e1', padding: '12px 24px', borderRadius: '24px', width: '280px', boxShadow: '0 4px 10px rgba(0,0,0,0.05)' }}>
              <div style={{ display: 'flex', width: '28px', height: '28px', borderRadius: '14px', backgroundColor: '#0052FF', alignItems: 'center', justifyContent: 'center', marginRight: '12px' }}>
                <div style={{ width: '10px', height: '10px', borderRadius: '5px', backgroundColor: 'white' }} />
              </div>
              <span style={{ color: '#0052FF', fontSize: '20px', fontWeight: 900, textTransform: 'uppercase', letterSpacing: '2px' }}>
                Base Analytics
              </span>
            </div>

            {/* Main Title */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '5px' }}>
              <span style={{ fontSize: '72px', fontWeight: 900, color: '#1e293b', lineHeight: 1.1, letterSpacing: '-0.02em' }}>
                Mint Your True
              </span>
              <span style={{ fontSize: '72px', fontWeight: 900, color: '#0052FF', lineHeight: 1.1, letterSpacing: '-0.02em' }}>
                Onchain Identity
              </span>
            </div>

            <span style={{ fontSize: '28px', color: '#475569', marginTop: '25px', fontWeight: 600 }}>
              Track your stats. Claim your badges.Flex your Base status gasless.
            </span>
          </div>

          {/* Social Accounts */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '12px', borderTop: '2px solid #cbd5e1', paddingTop: '30px' }}>
            <div style={{ display: 'flex', alignItems: 'center' }}>
              <span style={{ color: '#64748b', fontSize: '22px', fontWeight: 700, width: '140px', textTransform: 'uppercase', letterSpacing: '1px' }}>Built By X:</span>
              <span style={{ color: '#0052FF', fontSize: '26px', fontWeight: 900 }}>@TamilCrypt0</span>
            </div>
            <div style={{ display: 'flex', alignItems: 'center' }}>
              <span style={{ color: '#64748b', fontSize: '22px', fontWeight: 700, width: '140px', textTransform: 'uppercase', letterSpacing: '1px' }}>Built By FC:</span>
              <span style={{ color: '#0052FF', fontSize: '26px', fontWeight: 900 }}>suryaprakash.farcaster.eth</span>
            </div>
          </div>
        </div>

        {/* ================= RIGHT SIDE: VISUAL DASHBOARD ================= */}
        <div style={{ display: 'flex', flexDirection: 'column', width: '40%', height: '100%', justifyContent: 'center', gap: '30px' }}>
          
          {/* Card 1: Simulated Onchain Score Dial */}
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', backgroundColor: 'white', border: '1px solid #cbd5e1', borderRadius: '30px', padding: '40px 30px', boxShadow: '0 10px 30px rgba(0,82,255,0.1)' }}>
            <span style={{ color: '#0052FF', fontSize: '18px', fontWeight: 900, textTransform: 'uppercase', letterSpacing: '2px', marginBottom: '20px' }}>Onchain Score</span>
            
            <div style={{ display: 'flex', position: 'relative', width: '180px', height: '180px', alignItems: 'center', justifyContent: 'center' }}>
              {/* SVG Circular Progress Bar */}
              <svg width="180" height="180" viewBox="0 0 180 180" style={{ position: 'absolute' }}>
                <circle cx="90" cy="90" r="75" stroke="#f1f5f9" strokeWidth="16" fill="none" />
                <circle cx="90" cy="90" r="75" stroke="#0052FF" strokeWidth="16" fill="none" strokeDasharray="471" strokeDashoffset="70" strokeLinecap="round" />
              </svg>
              <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
                <span style={{ fontSize: '64px', fontWeight: 900, color: '#0052FF', lineHeight: 1 }}>88</span>
                <span style={{ fontSize: '16px', fontWeight: 800, color: '#64748b' }}>/ 100</span>
              </div>
            </div>
          </div>

          {/* Card 2: Simulated Minted Badges */}
          <div style={{ display: 'flex', flexDirection: 'column', backgroundColor: 'white', border: '1px solid #cbd5e1', borderRadius: '30px', padding: '30px', boxShadow: '0 10px 30px rgba(0,82,255,0.1)' }}>
            <span style={{ color: '#0052FF', fontSize: '16px', fontWeight: 900, textTransform: 'uppercase', letterSpacing: '2px', marginBottom: '15px' }}>Minted Badges</span>
            <div style={{ display: 'flex', justifyContent: 'space-between' }}>
              
              {/* Legendary Badge (Blue) */}
              <div style={{ display: 'flex', width: '80px', height: '80px', backgroundColor: '#0052FF', borderRadius: '20px', alignItems: 'center', justifyContent: 'center' }}>
                <svg width="40" height="40" viewBox="0 0 24 24" fill="white" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <polygon points="12 2 15 8 22 9 17 14 18 21 12 17 6 21 7 14 2 9 9 8 12 2" />
                </svg>
              </div>

              {/* Gold Badge (Yellow/Amber) */}
              <div style={{ display: 'flex', width: '80px', height: '80px', backgroundColor: '#facc15', border: '2px solid #ca8a04', borderRadius: '20px', alignItems: 'center', justifyContent: 'center' }}>
                <svg width="36" height="36" viewBox="0 0 24 24" fill="none" stroke="#854d0e" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M6 3h12l4 6-10 12L2 9l4-6z" />
                  <path d="M2 9h20" />
                  <path d="M12 21V9" />
                </svg>
              </div>

              {/* Silver Badge (Slate) */}
              <div style={{ display: 'flex', width: '80px', height: '80px', backgroundColor: '#e2e8f0', border: '2px solid #94a3b8', borderRadius: '20px', alignItems: 'center', justifyContent: 'center' }}>
                <svg width="36" height="36" viewBox="0 0 24 24" fill="none" stroke="#475569" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                  <circle cx="12" cy="12" r="10" />
                  <polyline points="12 6 12 12 16 14" />
                </svg>
              </div>

            </div>
          </div>

        </div>
      </div>
    ),
    { ...size }
  );
} 