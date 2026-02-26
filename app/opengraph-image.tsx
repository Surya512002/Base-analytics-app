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
          alignItems: 'center',
          justifyContent: 'center',
          backgroundColor: '#000510',
          backgroundImage: 'linear-gradient(135deg, #001f70 0%, #000510 40%, #0052FF 100%)',
          fontFamily: 'sans-serif',
        }}
      >
        {/* Ambient background glows */}
        <div style={{ position: 'absolute', top: -100, right: -100, width: 500, height: 500, backgroundColor: 'rgba(0, 82, 255, 0.4)', borderRadius: '250px' }} />
        <div style={{ position: 'absolute', bottom: -150, left: -100, width: 600, height: 600, backgroundColor: 'rgba(96, 165, 250, 0.2)', borderRadius: '300px' }} />

        {/* 🚨 SAFE ZONE CONTAINER: Prevents cut-off on Farcaster/Mobile 🚨 */}
        <div
          style={{
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'space-between',
            width: '880px', // Shrunk width so it never gets cropped
            height: '500px', // Shrunk height to protect top/bottom
            backgroundColor: 'rgba(255, 255, 255, 0.05)',
            border: '2px solid rgba(255, 255, 255, 0.1)',
            borderRadius: '32px',
            padding: '40px',
            boxShadow: '0 20px 50px rgba(0,0,0,0.5)',
          }}
        >
          {/* Top Brand Tag */}
          <div style={{ display: 'flex', alignItems: 'center', backgroundColor: 'rgba(0, 82, 255, 0.2)', padding: '8px 20px', borderRadius: '20px', border: '1px solid rgba(0, 82, 255, 0.5)' }}>
            <div style={{ width: '12px', height: '12px', borderRadius: '6px', backgroundColor: '#60A5FA', marginRight: '10px' }} />
            <span style={{ color: '#60A5FA', fontSize: '18px', fontWeight: 800, textTransform: 'uppercase', letterSpacing: '2px' }}>Base Analytics</span>
          </div>

          {/* Main Title Area */}
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
            <h1 style={{ fontSize: '66px', fontWeight: 900, color: 'white', margin: '0 0 10px 0', textAlign: 'center', lineHeight: 1.1, letterSpacing: '-0.02em' }}>
              Mint Your True<br />
              <span style={{ color: '#60A5FA' }}>Onchain Identity</span>
            </h1>
            <p style={{ fontSize: '26px', color: 'rgba(255, 255, 255, 0.7)', margin: 0, textAlign: 'center' }}>
              Check your score. Claim your badges. Flex your status.
            </p>
          </div>

          {/* Features */}
          <div style={{ display: 'flex', gap: '24px', marginTop: '10px' }}>
            <div style={{ display: 'flex', alignItems: 'center', backgroundColor: '#0052FF', padding: '12px 28px', borderRadius: '16px' }}>
              <span style={{ color: 'white', fontSize: '22px', fontWeight: 800 }}>40+ Unique Badges</span>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', backgroundColor: 'rgba(255, 255, 255, 0.1)', padding: '12px 28px', borderRadius: '16px', border: '1px solid rgba(255, 255, 255, 0.2)' }}>
              <span style={{ color: 'white', fontSize: '22px', fontWeight: 800 }}>100% Gasless</span>
            </div>
          </div>

          {/* Social Accounts Section 
            Explicitly split without '&' as requested!
          */}
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', width: '100%', borderTop: '1px solid rgba(255,255,255,0.1)', paddingTop: '20px', marginTop: '10px' }}>
            <span style={{ color: 'rgba(255, 255, 255, 0.6)', fontSize: '20px', fontWeight: 500, marginBottom: '6px' }}>
              X Account: <span style={{ color: '#60A5FA', fontWeight: 700 }}>@TamilCrypt0</span>
            </span>
            <span style={{ color: 'rgba(255, 255, 255, 0.6)', fontSize: '20px', fontWeight: 500 }}>
              Farcaster / Base Account: <span style={{ color: '#60A5FA', fontWeight: 700 }}>suryaprakash.farcaster.eth</span>
            </span>
          </div>
        </div>
      </div>
    ),
    { ...size }
  );
} 