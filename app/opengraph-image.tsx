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
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          background: 'linear-gradient(135deg, #0052FF 0%, #001f70 100%)',
          fontFamily: 'sans-serif',
          position: 'relative',
          overflow: 'hidden',
        }}
      >
        {/* Futuristic Background Rings */}
        <div style={{ position: 'absolute', top: -150, left: -150, width: 600, height: 600, border: '40px solid rgba(255, 255, 255, 0.05)', borderRadius: '50%' }} />
        <div style={{ position: 'absolute', bottom: -200, right: -100, width: 800, height: 800, border: '60px solid rgba(255, 255, 255, 0.05)', borderRadius: '50%' }} />

        {/* Main Floating Card */}
        <div
          style={{
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            background: 'rgba(255, 255, 255, 0.1)',
            padding: '60px 80px',
            borderRadius: '40px',
            border: '2px solid rgba(255, 255, 255, 0.2)',
            boxShadow: '0 30px 60px rgba(0,0,0,0.4)',
            zIndex: 10,
          }}
        >
          <h1
            style={{
              fontSize: '85px',
              fontWeight: 900,
              color: 'white',
              margin: 0,
              letterSpacing: '-0.05em',
              textShadow: '0 10px 30px rgba(0,82,255,0.8)',
            }}
          >
            BASE ANALYTICS
          </h1>
          
          <p
            style={{
              fontSize: '36px',
              color: '#93C5FD',
              marginTop: '15px',
              marginBottom: '50px',
              fontWeight: 700,
              textAlign: 'center',
            }}
          >
            Mint Your Onchain Identity 🏆
          </p>

          {/* Feature Pills */}
          <div style={{ display: 'flex', gap: '20px' }}>
            <div style={{ display: 'flex', alignItems: 'center', background: 'white', padding: '15px 30px', borderRadius: '20px', boxShadow: '0 10px 20px rgba(0,0,0,0.2)' }}>
              <span style={{ fontSize: '28px', fontWeight: 800, color: '#0052FF' }}>40+ Badges</span>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', background: 'white', padding: '15px 30px', borderRadius: '20px', boxShadow: '0 10px 20px rgba(0,0,0,0.2)' }}>
              <span style={{ fontSize: '28px', fontWeight: 800, color: '#0052FF' }}>Gasless Mints</span>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', background: 'white', padding: '15px 30px', borderRadius: '20px', boxShadow: '0 10px 20px rgba(0,0,0,0.2)' }}>
              <span style={{ fontSize: '28px', fontWeight: 800, color: '#0052FF' }}>XP Booster</span>
            </div>
          </div>
        </div>

        {/* Footer Credit */}
        <div
          style={{
            position: 'absolute',
            bottom: '40px',
            display: 'flex',
            alignItems: 'center',
            background: 'rgba(0,0,0,0.3)',
            padding: '12px 30px',
            borderRadius: '50px',
          }}
        >
          <span style={{ fontSize: '24px', color: '#93C5FD', fontWeight: 700, letterSpacing: '1px' }}>Built by @TamilCrypt0 & @suryaprakash.farcaster.eth</span>
        </div>
      </div>
    ),
    { ...size }
  );
}