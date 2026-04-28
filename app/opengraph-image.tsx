import { ImageResponse } from 'next/og';

export const runtime = 'edge';
export const alt = 'Base Analytics — Season 1: Genesis. Mint Your Onchain Identity.';
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
          backgroundColor: '#0a0f1e',
          fontFamily: 'sans-serif',
          position: 'relative',
          overflow: 'hidden',
        }}
      >
        {/* Background grid pattern */}
        <div style={{
          position: 'absolute', inset: 0,
          backgroundImage: 'linear-gradient(rgba(0,82,255,0.07) 1px, transparent 1px), linear-gradient(90deg, rgba(0,82,255,0.07) 1px, transparent 1px)',
          backgroundSize: '60px 60px',
          display: 'flex',
        }} />

        {/* Blue glow top-left */}
        <div style={{
          position: 'absolute', top: '-120px', left: '-80px',
          width: '500px', height: '500px', borderRadius: '250px',
          background: 'radial-gradient(circle, rgba(0,82,255,0.35) 0%, transparent 70%)',
          display: 'flex',
        }} />
        {/* Purple glow bottom-right */}
        <div style={{
          position: 'absolute', bottom: '-100px', right: '-60px',
          width: '400px', height: '400px', borderRadius: '200px',
          background: 'radial-gradient(circle, rgba(138,43,226,0.3) 0%, transparent 70%)',
          display: 'flex',
        }} />

        {/* Main content */}
        <div style={{ display: 'flex', width: '100%', height: '100%', padding: '56px 64px', alignItems: 'stretch', gap: '48px' }}>

          {/* LEFT */}
          <div style={{ display: 'flex', flexDirection: 'column', flex: 1, justifyContent: 'space-between' }}>

            {/* Logo + brand */}
            <div style={{ display: 'flex', alignItems: 'center', gap: '14px' }}>
              <div style={{
                width: '48px', height: '48px', borderRadius: '24px',
                background: '#0052FF', display: 'flex', alignItems: 'center', justifyContent: 'center',
                boxShadow: '0 0 24px rgba(0,82,255,0.6)',
              }}>
                <div style={{ width: '20px', height: '20px', borderRadius: '10px', background: 'white', display: 'flex' }} />
              </div>
              <span style={{ color: '#ffffff', fontSize: '22px', fontWeight: 900, letterSpacing: '3px', textTransform: 'uppercase' }}>
                BASE ANALYTICS
              </span>
            </div>

            {/* Season badge */}
            <div style={{
              display: 'flex', alignItems: 'center', gap: '10px',
              background: 'rgba(0,82,255,0.15)', border: '1px solid rgba(0,82,255,0.4)',
              borderRadius: '12px', padding: '8px 16px', width: 'fit-content',
            }}>
              <div style={{ width: '8px', height: '8px', borderRadius: '4px', background: '#0052FF', display: 'flex' }} />
              <span style={{ color: '#60a5fa', fontSize: '15px', fontWeight: 800, letterSpacing: '2px', textTransform: 'uppercase' }}>
                Season 1: Genesis — Future Rewards Locked In
              </span>
            </div>

            {/* Main headline */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
              <span style={{ fontSize: '68px', fontWeight: 900, color: '#ffffff', lineHeight: 1.05, letterSpacing: '-1px' }}>
                Mint Your True
              </span>
              <span style={{
                fontSize: '68px', fontWeight: 900, lineHeight: 1.05, letterSpacing: '-1px',
                color: '#0052FF',
              }}>
                Onchain Identity
              </span>
            </div>

            {/* Subtext */}
            <span style={{ fontSize: '24px', color: '#94a3b8', fontWeight: 600, lineHeight: 1.4 }}>
              Track stats · Climb the leaderboard · Claim gasless badges · Earn Season XP
            </span>

            {/* Bottom row: stats */}
            <div style={{ display: 'flex', gap: '16px' }}>
              {[
                { label: 'Onchain Badges', value: '11' },
                { label: 'XP Quests', value: '6' },
                { label: 'Season Days', value: '91' },
              ].map((s, i) => (
                <div key={i} style={{
                  display: 'flex', flexDirection: 'column', alignItems: 'center',
                  background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)',
                  borderRadius: '16px', padding: '16px 24px',
                }}>
                  <span style={{ color: '#0052FF', fontSize: '32px', fontWeight: 900 }}>{s.value}</span>
                  <span style={{ color: '#64748b', fontSize: '13px', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '1px' }}>{s.label}</span>
                </div>
              ))}
            </div>
          </div>

          {/* RIGHT */}
          <div style={{ display: 'flex', flexDirection: 'column', width: '340px', gap: '20px', justifyContent: 'center' }}>

            {/* Score card */}
            <div style={{
              display: 'flex', flexDirection: 'column', alignItems: 'center',
              background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(0,82,255,0.3)',
              borderRadius: '28px', padding: '32px 24px',
              boxShadow: '0 0 40px rgba(0,82,255,0.15)',
            }}>
              <span style={{ color: '#0052FF', fontSize: '13px', fontWeight: 900, letterSpacing: '3px', textTransform: 'uppercase', marginBottom: '16px' }}>Onchain Score</span>
              <div style={{ display: 'flex', position: 'relative', width: '150px', height: '150px', alignItems: 'center', justifyContent: 'center' }}>
                <svg width="150" height="150" viewBox="0 0 150 150" style={{ position: 'absolute' }}>
                  <circle cx="75" cy="75" r="62" stroke="rgba(255,255,255,0.06)" strokeWidth="14" fill="none" />
                  <circle cx="75" cy="75" r="62" stroke="#0052FF" strokeWidth="14" fill="none"
                    strokeDasharray="390" strokeDashoffset="55" strokeLinecap="round"
                    style={{ filter: 'drop-shadow(0 0 8px rgba(0,82,255,0.8))' }} />
                </svg>
                <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
                  <span style={{ fontSize: '54px', fontWeight: 900, color: '#ffffff', lineHeight: 1 }}>88</span>
                  <span style={{ fontSize: '14px', fontWeight: 700, color: '#64748b' }}>/100</span>
                </div>
              </div>
              <span style={{ color: '#60a5fa', fontSize: '16px', fontWeight: 800, marginTop: '12px' }}>Base God 👑</span>
            </div>

            {/* Badges row */}
            <div style={{
              display: 'flex', flexDirection: 'column',
              background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)',
              borderRadius: '24px', padding: '20px',
            }}>
              <span style={{ color: '#94a3b8', fontSize: '12px', fontWeight: 900, letterSpacing: '2px', textTransform: 'uppercase', marginBottom: '14px' }}>Minted Badges</span>
              <div style={{ display: 'flex', gap: '12px', justifyContent: 'space-between' }}>
                {[
                  { bg: 'linear-gradient(135deg,#0052FF,#8A2BE2)', emoji: '👑' },
                  { bg: 'linear-gradient(135deg,#f59e0b,#d97706)', emoji: '🐋' },
                  { bg: 'linear-gradient(135deg,#6b7280,#4b5563)', emoji: '🏗️' },
                  { bg: 'linear-gradient(135deg,#10b981,#059669)', emoji: '🦄' },
                ].map((b, i) => (
                  <div key={i} style={{
                    width: '62px', height: '62px', borderRadius: '16px',
                    background: b.bg, display: 'flex', alignItems: 'center', justifyContent: 'center',
                    fontSize: '26px', boxShadow: '0 4px 16px rgba(0,0,0,0.3)',
                  }}>
                    {b.emoji}
                  </div>
                ))}
              </div>
            </div>

            {/* Referral pill */}
            <div style={{
              display: 'flex', alignItems: 'center', gap: '12px',
              background: 'rgba(138,43,226,0.12)', border: '1px solid rgba(138,43,226,0.3)',
              borderRadius: '16px', padding: '14px 18px',
            }}>
              <span style={{ fontSize: '20px' }}>🎁</span>
              <div style={{ display: 'flex', flexDirection: 'column' }}>
                <span style={{ color: '#c084fc', fontSize: '13px', fontWeight: 900, textTransform: 'uppercase', letterSpacing: '1px' }}>Referral Bonus</span>
                <span style={{ color: '#94a3b8', fontSize: '12px', fontWeight: 600 }}>+50 XP when friends join</span>
              </div>
            </div>

          </div>
        </div>
      </div>
    ),
    { ...size }
  );
}
 