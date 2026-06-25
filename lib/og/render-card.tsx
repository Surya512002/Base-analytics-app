import type { OgCardData } from "./types";

const RANK_TIERS = [
  { emoji: "🦐", label: "Shrimp", min: 0 },
  { emoji: "🐬", label: "Dolphin", min: 30 },
  { emoji: "🦈", label: "Shark", min: 50 },
  { emoji: "🐋", label: "Whale", min: 70 },
  { emoji: "👑", label: "God", min: 85 },
];

function getActiveTier(score: number) {
  let idx = 0;
  for (let i = RANK_TIERS.length - 1; i >= 0; i--) {
    if (score >= RANK_TIERS[i].min) {
      idx = i;
      break;
    }
  }
  return idx;
}

export function renderOgCard(data: OgCardData = {}) {
  const score = data.score ?? 88;
  const rank = data.rank ?? "Base God 👑";
  const badges = data.badges ?? 4;
  const days = data.days ?? 91;
  const xp = data.xp ?? 0;
  const streak = data.streak ?? 0;
  const variant = data.variant ?? "default";
  const isPersonal =
    variant === "score" || variant === "badge" || Boolean(data.title);
  const activeTier = getActiveTier(score);

  const hookLine = isPersonal
    ? data.title || (variant === "badge" ? "BADGES UNLOCKED" : "I JUST SCORED")
    : "WHAT'S YOUR";
  const heroLine = isPersonal
    ? variant === "badge"
      ? `${badges} ON BASE`
      : `${score}`
    : "ONCHAIN RANK?";
  const heroSuffix = isPersonal && variant !== "badge" ? "/100" : "";

  return (
    <div
      style={{
        width: "100%",
        height: "100%",
        display: "flex",
        position: "relative",
        overflow: "hidden",
        fontFamily: "system-ui, -apple-system, BlinkMacSystemFont, sans-serif",
        background: "#00040d",
      }}
    >
      {/* Diagonal aurora mesh — no grid */}
      <div
        style={{
          position: "absolute",
          inset: 0,
          background:
            "linear-gradient(125deg, #001a4d 0%, #00040d 35%, #0a0018 70%, #00040d 100%)",
          display: "flex",
        }}
      />
      <div
        style={{
          position: "absolute",
          top: -200,
          right: -100,
          width: 700,
          height: 700,
          borderRadius: 350,
          background:
            "radial-gradient(circle, rgba(0,229,255,0.22) 0%, transparent 62%)",
          display: "flex",
        }}
      />
      <div
        style={{
          position: "absolute",
          bottom: -180,
          left: -120,
          width: 600,
          height: 600,
          borderRadius: 300,
          background:
            "radial-gradient(circle, rgba(255,51,102,0.18) 0%, transparent 65%)",
          display: "flex",
        }}
      />
      <div
        style={{
          position: "absolute",
          top: "55%",
          left: "30%",
          width: 500,
          height: 300,
          background:
            "radial-gradient(ellipse, rgba(0,82,255,0.15) 0%, transparent 70%)",
          display: "flex",
        }}
      />

      {/* Diagonal accent stripe */}
      <div
        style={{
          position: "absolute",
          top: -80,
          right: 120,
          width: 4,
          height: 900,
          background: "linear-gradient(180deg, transparent, #00E5FF, #FF3366, transparent)",
          transform: "rotate(25deg)",
          opacity: 0.6,
          display: "flex",
        }}
      />

      {/* Content */}
      <div
        style={{
          display: "flex",
          flexDirection: "column",
          width: "100%",
          height: "100%",
          padding: "44px 56px 40px",
          position: "relative",
          justifyContent: "space-between",
        }}
      >
        {/* Top bar */}
        <div
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
          }}
        >
          <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
            <div
              style={{
                width: 40,
                height: 40,
                borderRadius: 12,
                background: "linear-gradient(135deg, #0052FF, #00E5FF)",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                boxShadow: "0 0 24px rgba(0,229,255,0.5)",
              }}
            >
              <span style={{ fontSize: 20, fontWeight: 900, color: "#fff" }}>
                B
              </span>
            </div>
            <span
              style={{
                color: "#fff",
                fontSize: 15,
                fontWeight: 800,
                letterSpacing: 3,
              }}
            >
              BASE ANALYTICS
            </span>
          </div>
          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: 8,
              background: "rgba(255,51,102,0.15)",
              border: "1px solid rgba(255,51,102,0.4)",
              borderRadius: 100,
              padding: "8px 18px",
            }}
          >
            <div
              style={{
                width: 7,
                height: 7,
                borderRadius: 4,
                background: "#FF3366",
                boxShadow: "0 0 8px #FF3366",
                display: "flex",
              }}
            />
            <span
              style={{
                color: "#ff8fab",
                fontSize: 12,
                fontWeight: 800,
                letterSpacing: 2,
              }}
            >
              SEASON 1 LIVE
            </span>
          </div>
        </div>

        {/* Hero — center left, massive type */}
        <div
          style={{
            display: "flex",
            flex: 1,
            alignItems: "center",
            gap: 48,
            marginTop: 8,
          }}
        >
          <div
            style={{
              display: "flex",
              flexDirection: "column",
              flex: 1,
              gap: 4,
            }}
          >
            <span
              style={{
                fontSize: isPersonal && variant !== "badge" ? 28 : 36,
                fontWeight: 800,
                color: "#00E5FF",
                letterSpacing: 6,
                textTransform: "uppercase",
              }}
            >
              {hookLine}
            </span>
            <div style={{ display: "flex", alignItems: "flex-end", gap: 8 }}>
              <span
                style={{
                  fontSize:
                    isPersonal && variant !== "badge"
                      ? 160
                      : variant === "badge"
                        ? 72
                        : 88,
                  fontWeight: 900,
                  color: "#ffffff",
                  lineHeight: 0.9,
                  letterSpacing: -4,
                  textShadow: "0 0 60px rgba(0,229,255,0.35)",
                }}
              >
                {heroLine}
              </span>
              {heroSuffix && (
                <span
                  style={{
                    fontSize: 36,
                    fontWeight: 700,
                    color: "#475569",
                    marginBottom: 18,
                  }}
                >
                  {heroSuffix}
                </span>
              )}
            </div>
            {isPersonal ? (
              <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                <div
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: 12,
                    marginTop: 8,
                  }}
                >
                  <div
                    style={{
                      background: "linear-gradient(90deg, #0052FF, #00E5FF)",
                      borderRadius: 100,
                      padding: "10px 24px",
                      display: "flex",
                    }}
                  >
                    <span
                      style={{
                        color: "#fff",
                        fontSize: 22,
                        fontWeight: 900,
                      }}
                    >
                      {rank}
                    </span>
                  </div>
                  {badges > 0 && (
                    <span style={{ color: "#94a3b8", fontSize: 18, fontWeight: 700 }}>
                      {badges} badges minted
                    </span>
                  )}
                </div>
                {(xp > 0 || streak > 0) && (
                  <span style={{ color: "#64748b", fontSize: 16, fontWeight: 600 }}>
                    {xp > 0 ? `${xp} XP this week` : ""}
                    {xp > 0 && streak > 0 ? "  ·  " : ""}
                    {streak > 0 ? `${streak} day streak` : ""}
                  </span>
                )}
              </div>
            ) : (
              <span
                style={{
                  fontSize: 22,
                  color: "#94a3b8",
                  fontWeight: 600,
                  maxWidth: 520,
                  lineHeight: 1.4,
                  marginTop: 12,
                }}
              >
                Free wallet scan on Base. Mint gasless badges, farm XP, climb the
                leaderboard.
              </span>
            )}
          </div>

          {/* Rank ladder — vertical pill on right */}
          <div
            style={{
              display: "flex",
              flexDirection: "column",
              gap: 6,
              background: "rgba(255,255,255,0.04)",
              border: "1px solid rgba(255,255,255,0.08)",
              borderRadius: 24,
              padding: "20px 16px",
              minWidth: 140,
            }}
          >
            <span
              style={{
                color: "#64748b",
                fontSize: 10,
                fontWeight: 800,
                letterSpacing: 2,
                textTransform: "uppercase",
                textAlign: "center",
                marginBottom: 6,
              }}
            >
              Rank Tiers
            </span>
            {RANK_TIERS.map((t, i) => (
              <div
                key={t.label}
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: 10,
                  padding: "8px 12px",
                  borderRadius: 12,
                  background:
                    i === activeTier
                      ? "linear-gradient(90deg, rgba(0,82,255,0.35), rgba(0,229,255,0.15))"
                      : "transparent",
                  border:
                    i === activeTier
                      ? "1px solid rgba(0,229,255,0.4)"
                      : "1px solid transparent",
                }}
              >
                <span style={{ fontSize: 22 }}>{t.emoji}</span>
                <span
                  style={{
                    color: i === activeTier ? "#fff" : "#475569",
                    fontSize: 13,
                    fontWeight: i === activeTier ? 800 : 600,
                  }}
                >
                  {t.label}
                </span>
              </div>
            ))}
          </div>
        </div>

        {/* Feature chips */}
        <div style={{ display: "flex", gap: 12, marginBottom: 20 }}>
          {[
            { icon: "⛽", label: "GASLESS TXS" },
            { icon: "🏅", label: "11 BADGE TYPES" },
            { icon: "⚡", label: "XP QUESTS" },
            { icon: "📅", label: `${days}D SEASON` },
          ].map((chip) => (
            <div
              key={chip.label}
              style={{
                display: "flex",
                alignItems: "center",
                gap: 8,
                background: "rgba(255,255,255,0.05)",
                border: "1px solid rgba(255,255,255,0.1)",
                borderRadius: 100,
                padding: "10px 18px",
              }}
            >
              <span style={{ fontSize: 16 }}>{chip.icon}</span>
              <span
                style={{
                  color: "#cbd5e1",
                  fontSize: 12,
                  fontWeight: 800,
                  letterSpacing: 1,
                }}
              >
                {chip.label}
              </span>
            </div>
          ))}
        </div>

        {/* Bottom CTA bar */}
        <div
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            background: "linear-gradient(90deg, rgba(0,82,255,0.25), rgba(255,51,102,0.2))",
            border: "1px solid rgba(0,229,255,0.3)",
            borderRadius: 20,
            padding: "18px 32px",
          }}
        >
          <div style={{ display: "flex", flexDirection: "column", gap: 2 }}>
            <span
              style={{
                color: "#fff",
                fontSize: 20,
                fontWeight: 900,
              }}
            >
              {isPersonal
                ? "Can you beat this score?"
                : "Scan your wallet — it's free"}
            </span>
            <span style={{ color: "#94a3b8", fontSize: 14, fontWeight: 600 }}>
              base-analytics-app.vercel.app
            </span>
          </div>
          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: 10,
              background: "linear-gradient(135deg, #FF3366, #0052FF)",
              borderRadius: 14,
              padding: "14px 28px",
              boxShadow: "0 8px 32px rgba(255,51,102,0.35)",
            }}
          >
            <span
              style={{
                color: "#fff",
                fontSize: 17,
                fontWeight: 900,
              }}
            >
              {isPersonal ? "CHALLENGE ME →" : "GET MY SCORE →"}
            </span>
          </div>
        </div>
      </div>
    </div>
  );
}
