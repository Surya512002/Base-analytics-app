import { ImageResponse } from 'next/og';

export const runtime = 'edge';

export const alt = 'Base Analytics - Onchain Identity';
export const size = { width: 1200, height: 630 };
export const contentType = 'image/png';

export default async function Image() {
  return new ImageResponse(
    (
      <div
        style={{
          background: 'linear-gradient(to bottom right, #0052FF, #001f70)',
          width: '100%',
          height: '100%',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          fontFamily: 'sans-serif',
          position: 'relative',
          overflow: 'hidden',
        }}
      >
        {/* Decorative Background Elements */}
        <div style={{ position: 'absolute', top: -100, left: -100, width: 400, height: 400, background: 'rgba(255,255,255,0.05)', borderRadius: '50%' }} />
        <div style={{ position: 'absolute', bottom: -150, right: -50, width: 600, height: 600, background: 'rgba(255,255,255,0.03)', borderRadius: '50%' }} />

        {/* Main Content */}
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', zIndex: 10 }}>
          <div
            style={{
              background: 'white',
              padding: '20px 40px',
              borderRadius: '20px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              marginBottom: '30px',
              boxShadow: '0 20px 40px rgba(0,0,0,0.3)',
            }}
          >
            <h1 style={{ fontSize: '80px', fontWeight: 900, color: '#0052FF', margin: 0, letterSpacing: '-0.05em' }}>
              BASE ANALYTICS
            </h1>
          </div>
          
          <h2 style={{ fontSize: '40px', fontWeight: 700, color: 'white', margin: '0 0 20px 0', textAlign: 'center' }}>
            Mint Your Onchain Identity 🏆
          </h2>
          <p style={{ fontSize: '28px', color: 'rgba(255,255,255,0.8)', margin: 0, textAlign: 'center', maxWidth: '800px' }}>
            Discover your stats, unlock 40+ unique achievements, and farm XP entirely gasless.
          </p>
        </div>

        {/* Footer Badge */}
        <div style={{ position: 'absolute', bottom: 40, display: 'flex', alignItems: 'center', background: 'rgba(0,0,0,0.2)', padding: '10px 24px', borderRadius: '40px' }}>
           <span style={{ fontSize: '24px', color: '#60A5FA', fontWeight: 'bold' }}>Built by @suryaprakash.farcaster.eth</span>
        </div>
      </div>
    ),
    { ...size }
  );
}