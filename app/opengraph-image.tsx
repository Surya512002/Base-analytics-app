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
          background: '#000510', 
          backgroundImage: 'linear-gradient(135deg, #000510 0%, #001f70 50%, #0052FF 100%)',
          fontFamily: 'sans-serif',
          position: 'relative',
          overflow: 'hidden',
        }}
      >
        {/* Giant Background Floating Badges */}
        <div style={{ display: 'flex', position: 'absolute', top: -50, right: -20, opacity: 0.15, fontSize: '250px' }}>👑</div>
        <div style={{ display: 'flex', position: 'absolute', bottom: -50, left: -20, opacity: 0.15, fontSize: '250px' }}>💎</div>

        {/* Main Glass Card */}
        <div
          style={{
            display: 'flex',
            flexDirection: 'column',
            justifyContent: 'center',
            background: 'rgba(255, 255, 255, 0.05)',
            padding: '60px 80px',
            borderRadius: '30px',
            border: '2px solid rgba(255, 255, 255, 0.15)',
            boxShadow: '0 30px 60px rgba(0,0,0,0.6)',
            width: '85%',
            zIndex: 10,
          }}
        >
          {/* Top Brand Tag */}
          <div style={{ display: 'flex', alignItems: 'center', marginBottom: '20px' }}>
            <div style={{ width: '30px', height: '30px', borderRadius: '15px', background: '#93C5FD', marginRight: '15px' }} />
            <span style={{ fontSize: '30px', fontWeight: 800, color: '#93C5FD', letterSpacing: '2px', textTransform: 'uppercase' }}>
              Base Analytics
            </span>
          </div>
          
          {/* Main Headline */}
          <h1
            style={{
              fontSize: '80px',
              fontWeight: 900,
              color: 'white',
              margin: '0 0 20px 0',
              lineHeight: 1.1,
              letterSpacing: '-0.03em',
            }}
          >
            Mint Your True<br />
            <span style={{ color: '#93C5FD' }}>Onchain Identity</span>
          </h1>
          
          {/* Subheadline */}
          <p
            style={{
              fontSize: '32px',
              color: 'rgba(255,255,255,0.7)',
              margin: '0 0 50px 0',
              fontWeight: 500,
            }}
          >
            Check your score. Claim your badges. Flex your status.
          </p>

          {/* Feature Pills */}
          <div style={{ display: 'flex', gap: '20px' }}>
            <div style={{ display: 'flex', alignItems: 'center', background: '#0052FF', padding: '15px 30px', borderRadius: '20px' }}>
              <span style={{ fontSize: '28px', marginRight: '12px' }}>🏅</span>
              <span style={{ fontSize: '24px', fontWeight: 800, color: 'white' }}>40+ Unique Badges</span>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', background: 'rgba(255,255,255,0.1)', padding: '15px 30px', borderRadius: '20px', border: '2px solid rgba(255,255,255,0.2)' }}>
              <span style={{ fontSize: '28px', marginRight: '12px' }}>⛽</span>
              <span style={{ fontSize: '24px', fontWeight: 800, color: 'white' }}>100% Gasless</span>
            </div>
          </div>
        </div>

        {/* Footer Credit */}
        <div style={{ position: 'absolute', bottom: '30px', right: '50px' }}>
          <span style={{ fontSize: '22px', color: 'rgba(255,255,255,0.4)', fontWeight: 600, letterSpacing: '1px' }}>
            Built by X-@TamilCrypt0 || @suryaprakash.farcaster.eth
          </span>
        </div>
      </div>
    ),
    { ...size }
  );
} 