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
          background: 'linear-gradient(to bottom right, #000510, #001f70, #0052FF)',
          fontFamily: 'sans-serif',
          position: 'relative',
          overflow: 'hidden',
        }}
      >
        {/* Futuristic Background Rings */}
        <div style={{ position: 'absolute', top: -200, left: -200, width: 800, height: 800, border: '40px solid rgba(255, 255, 255, 0.03)', borderRadius: '50%' }} />
        <div style={{ position: 'absolute', bottom: -300, right: -100, width: 1000, height: 1000, border: '60px solid rgba(255, 255, 255, 0.03)', borderRadius: '50%' }} />

        {/* Main Glass Card */}
        <div
          style={{
            display: 'flex',
            flexDirection: 'column',
            justifyContent: 'center',
            background: 'rgba(255, 255, 255, 0.05)',
            padding: '60px 80px',
            borderRadius: '30px',
            border: '2px solid rgba(255, 255, 255, 0.1)',
            boxShadow: '0 30px 60px rgba(0,0,0,0.8)',
            width: '85%',
            zIndex: 10,
          }}
        >
          {/* Top Brand Tag */}
          <div style={{ display: 'flex', alignItems: 'center', marginBottom: '20px' }}>
            <div style={{ width: '24px', height: '24px', borderRadius: '12px', background: '#93C5FD', marginRight: '15px', boxShadow: '0 0 15px #93C5FD' }} />
            <span style={{ fontSize: '28px', fontWeight: 800, color: '#93C5FD', letterSpacing: '3px', textTransform: 'uppercase' }}>
              Base Analytics
            </span>
          </div>
          
          {/* Main Headline */}
          <h1
            style={{
              fontSize: '85px',
              fontWeight: 900,
              color: 'white',
              margin: '0 0 15px 0',
              lineHeight: 1.1,
              letterSpacing: '-0.04em',
            }}
          >
            Mint Your True<br />
            <span style={{ color: '#60A5FA' }}>Onchain Identity</span>
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
              <span style={{ fontSize: '24px', fontWeight: 800, color: 'white' }}>40+ Unique Badges</span>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', background: 'rgba(255,255,255,0.1)', padding: '15px 30px', borderRadius: '20px', border: '2px solid rgba(255,255,255,0.2)' }}>
              <span style={{ fontSize: '24px', fontWeight: 800, color: 'white' }}>100% Gasless</span>
            </div>
          </div>
        </div>

        {/* Footer Credit */}
        <div style={{ position: 'absolute', bottom: '40px', right: '60px', display: 'flex', alignItems: 'center' }}>
          <div style={{ width: '40px', height: '40px', borderRadius: '20px', background: '#0052FF', marginRight: '15px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <div style={{ width: '16px', height: '16px', borderRadius: '8px', background: 'white' }} />
          </div>
          <span style={{ fontSize: '24px', color: 'rgba(255,255,255,0.5)', fontWeight: 600, letterSpacing: '1px' }}>
            Built by @TamilCrypt0 & @suryaprakash.farcaster.eth
          </span>
        </div>
      </div>
    ),
    { ...size }
  );
} 