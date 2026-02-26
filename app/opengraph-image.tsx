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
          flexDirection: 'row', // Split into left and right columns
          alignItems: 'center',
          justifyContent: 'space-between',
          backgroundColor: '#000510',
          backgroundImage: 'radial-gradient(circle at 80% 50%, #001f70 0%, #000510 60%)',
          fontFamily: 'sans-serif',
          padding: '60px',
        }}
      >
        {/* ================= LEFT SIDE: COPY & BRAND ================= */}
        <div style={{ display: 'flex', flexDirection: 'column', width: '55%', height: '100%', justifyContent: 'space-between' }}>
          
          <div style={{ display: 'flex', flexDirection: 'column' }}>
            {/* Top Brand Tag */}
            <div style={{ display: 'flex', alignItems: 'center', marginBottom: '30px' }}>
              <div style={{ display: 'flex', width: '32px', height: '32px', borderRadius: '16px', backgroundColor: '#0052FF', alignItems: 'center', justifyContent: 'center', marginRight: '12px' }}>
                <div style={{ width: '12px', height: '12px', borderRadius: '6px', backgroundColor: 'white' }} />
              </div>
              <span style={{ color: '#60A5FA', fontSize: '22px', fontWeight: 800, textTransform: 'uppercase', letterSpacing: '3px' }}>
                Base Analytics
              </span>
            </div>

            {/* Main Title - Hardcoded wraps to prevent any overflow */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '5px' }}>
              <span style={{ fontSize: '72px', fontWeight: 900, color: 'white', lineHeight: 1.1, letterSpacing: '-0.02em' }}>
                Mint Your True
              </span>
              <span style={{ fontSize: '72px', fontWeight: 900, color: '#60A5FA', lineHeight: 1.1, letterSpacing: '-0.02em' }}>
                Onchain Identity
              </span>
            </div>

            <span style={{ fontSize: '28px', color: 'rgba(255, 255, 255, 0.7)', marginTop: '25px', fontWeight: 500 }}>
              Track your stats. Claim your badges.
              Flex your Base status gasless.
            </span>
          </div>

          {/* Social Accounts - Explicitly separated as requested */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '12px', borderTop: '2px solid rgba(255,255,255,0.1)', paddingTop: '30px' }}>
            <div style={{ display: 'flex', alignItems: 'center' }}>
              <span style={{ color: 'rgba(255, 255, 255, 0.5)', fontSize: '22px', fontWeight: 600, width: '130px' }}>X (Twitter):</span>
              <span style={{ color: '#60A5FA', fontSize: '22px', fontWeight: 800 }}>@TamilCrypt0</span>
            </div>
            <div style={{ display: 'flex', alignItems: 'center' }}>
              <span style={{ color: 'rgba(255, 255, 255, 0.5)', fontSize: '22px', fontWeight: 600, width: '130px' }}>Farcaster:</span>
              <span style={{ color: '#60A5FA', fontSize: '22px', fontWeight: 800 }}>suryaprakash.farcaster.eth</span>
            </div>
          </div>
        </div>

        {/* ================= RIGHT SIDE: VISUAL DASHBOARD ================= */}
        <div style={{ display: 'flex', flexDirection: 'column', width: '40%', height: '100%', justifyContent: 'center', gap: '30px' }}>
          
          {/* Card 1: Simulated Onchain Score Dial */}
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', backgroundColor: 'rgba(255, 255, 255, 0.05)', border: '2px solid rgba(255, 255, 255, 0.1)', borderRadius: '30px', padding: '40px 30px', boxShadow: '0 20px 40px rgba(0,0,0,0.5)' }}>
            <span style={{ color: 'rgba(255, 255, 255, 0.6)', fontSize: '18px', fontWeight: 800, textTransform: 'uppercase', letterSpacing: '2px', marginBottom: '20px' }}>Onchain Score</span>
            
            <div style={{ display: 'flex', position: 'relative', width: '180px', height: '180px', alignItems: 'center', justifyContent: 'center' }}>
              {/* SVG Circular Progress Bar */}
              <svg width="180" height="180" viewBox="0 0 180 180" style={{ position: 'absolute' }}>
                <circle cx="90" cy="90" r="75" stroke="rgba(255,255,255,0.1)" strokeWidth="16" fill="none" />
                <circle cx="90" cy="90" r="75" stroke="#0052FF" strokeWidth="16" fill="none" strokeDasharray="471" strokeDashoffset="70" strokeLinecap="round" />
              </svg>
              <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
                <span style={{ fontSize: '64px', fontWeight: 900, color: 'white', lineHeight: 1 }}>88</span>
                <span style={{ fontSize: '16px', fontWeight: 700, color: '#60A5FA' }}>/ 100</span>
              </div>
            </div>
          </div>

          {/* Card 2: Simulated Minted Badges */}
          <div style={{ display: 'flex', flexDirection: 'column', backgroundColor: 'rgba(255, 255, 255, 0.05)', border: '2px solid rgba(255, 255, 255, 0.1)', borderRadius: '30px', padding: '30px', boxShadow: '0 20px 40px rgba(0,0,0,0.5)' }}>
            <span style={{ color: 'rgba(255, 255, 255, 0.6)', fontSize: '16px', fontWeight: 800, textTransform: 'uppercase', letterSpacing: '2px', marginBottom: '15px' }}>Recent Badges</span>
            <div style={{ display: 'flex', justifyContent: 'space-between' }}>
              
              {/* Fake Badge 1 (Base God Crown representation) */}
              <div style={{ display: 'flex', width: '80px', height: '80px', backgroundColor: '#0052FF', borderRadius: '20px', alignItems: 'center', justifyContent: 'center' }}>
                <svg width="40" height="40" viewBox="0 0 24 24" fill="white" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <polygon points="12 2 15 8 22 9 17 14 18 21 12 17 6 21 7 14 2 9 9 8 12 2" />
                </svg>
              </div>

              {/* Fake Badge 2 (Diamond Hands representation) */}
              <div style={{ display: 'flex', width: '80px', height: '80px', backgroundColor: 'rgba(255,255,255,0.1)', border: '2px solid rgba(255,255,255,0.2)', borderRadius: '20px', alignItems: 'center', justifyContent: 'center' }}>
                <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="#60A5FA" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M6 3h12l4 6-10 12L2 9l4-6z" />
                  <path d="M2 9h20" />
                  <path d="M12 21V9" />
                </svg>
              </div>

              {/* Fake Badge 3 (Whale representation) */}
              <div style={{ display: 'flex', width: '80px', height: '80px', backgroundColor: 'rgba(255,255,255,0.1)', border: '2px solid rgba(255,255,255,0.2)', borderRadius: '20px', alignItems: 'center', justifyContent: 'center' }}>
                <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="#60A5FA" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
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