import type { OgCardData } from "./types";
import { shortenAddress } from "./types";

const TABS = ["Dashboard", "Badges", "Quests", "Rankings", "Voucher"] as const;

function formatTxs(n: number): string {
  if (n >= 1000) return `${(n / 1000).toFixed(1).replace(/\.0$/, "")}k`;
  return n.toLocaleString();
}

function glassPanel(extra?: Record<string, string | number>) {
  return {
    background: "rgba(255,255,255,0.06)",
    border: "1px solid rgba(255,255,255,0.12)",
    borderRadius: 20,
    ...extra,
  };
}

export function renderOgCard(data: OgCardData = {}) {
  const score = data.score ?? 72;
  const rank = data.rank ?? "Base Shark";
  const badges = data.badges ?? 3;
  const days = data.days ?? 91;
  const xp = data.xp ?? 120;
  const streak = data.streak ?? 5;
  const activeDays = data.activeDays ?? 47;
  const txs = data.txs ?? 1248;
  const healthScore = data.healthScore ?? score;
  const address = shortenAddress(
    data.address || "0x3799cafa388da047cAF7c999e31c844705FadfAe"
  );
  const variant = data.variant ?? "default";
  const isPersonal =
    variant === "score" || variant === "badge" || Boolean(data.title);

  const ringR = 38;
  const ringC = 2 * Math.PI * ringR;
  const ringOffset = ringC * (1 - healthScore / 100);

  const ctaText = isPersonal ? "Challenge this wallet" : "Connect & scan free";
  const headline = isPersonal
    ? data.title || (variant === "badge" ? "Badges minted on Base" : "Live wallet dashboard")
    : "Your connected Base dashboard";

  return (
    <div
      style={{
        width: "100%",
        height: "100%",
        display: "flex",
        flexDirection: "column",
        position: "relative",
        overflow: "hidden",
        fontFamily: "system-ui, -apple-system, BlinkMacSystemFont, sans-serif",
        background: "#071220",
      }}
    >
      {/* Aurora background */}
      <div
        style={{
          position: "absolute",
          inset: 0,
          background:
            "radial-gradient(ellipse 80% 50% at 50% -20%, rgba(0,82,255,0.35), transparent), radial-gradient(ellipse 60% 40% at 100% 100%, rgba(255,51,102,0.2), transparent), #071220",
          display: "flex",
        }}
      />

      <div
        style={{
          display: "flex",
          flexDirection: "column",
          width: "100%",
          height: "100%",
          padding: "28px 36px 32px",
          position: "relative",
          gap: 14,
        }}
      >
        {/* App header — connected wallet */}
        <div
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            ...glassPanel({ borderRadius: 16, padding: "12px 18px" }),
          }}
        >
          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            <div
              style={{
                width: 32,
                height: 32,
                borderRadius: 10,
                background: "linear-gradient(135deg, #0052FF, #00E5FF)",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
              }}
            >
              <span style={{ fontSize: 16, fontWeight: 900, color: "#fff" }}>B</span>
            </div>
            <span style={{ color: "#fff", fontSize: 15, fontWeight: 900 }}>
              BASE<span style={{ color: "#22d3ee" }}>.</span>ANALYTICS
            </span>
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            <div
              style={{
                display: "flex",
                alignItems: "center",
                gap: 6,
                background: "rgba(16,185,129,0.12)",
                border: "1px solid rgba(16,185,129,0.35)",
                borderRadius: 100,
                padding: "6px 12px",
              }}
            >
              <div
                style={{
                  width: 7,
                  height: 7,
                  borderRadius: 4,
                  background: "#10b981",
                  boxShadow: "0 0 8px #10b981",
                  display: "flex",
                }}
              />
              <span style={{ color: "#6ee7b7", fontSize: 11, fontWeight: 800 }}>
                Connected
              </span>
            </div>
            <span
              style={{
                color: "#94a3b8",
                fontSize: 12,
                fontWeight: 700,
                fontFamily: "monospace",
              }}
            >
              {address}
            </span>
            <div
              style={{
                display: "flex",
                alignItems: "center",
                gap: 4,
                ...glassPanel({ borderRadius: 12, padding: "6px 10px" }),
              }}
            >
              <span style={{ color: "#22d3ee", fontSize: 11, fontWeight: 900 }}>
                ⚡ {xp} XP
              </span>
            </div>
          </div>
        </div>

        {/* Tab bar */}
        <div
          style={{
            display: "flex",
            gap: 6,
            ...glassPanel({ borderRadius: 16, padding: 6 }),
          }}
        >
          {TABS.map((tab, i) => (
            <div
              key={tab}
              style={{
                display: "flex",
                flex: 1,
                alignItems: "center",
                justifyContent: "center",
                padding: "10px 8px",
                borderRadius: 12,
                fontSize: 11,
                fontWeight: 800,
                color: i === 0 ? "#fff" : "#94a3b8",
                background:
                  i === 0
                    ? "linear-gradient(135deg, #ff4d7a, #3d7bff)"
                    : "transparent",
              }}
            >
              {tab}
            </div>
          ))}
        </div>

        {/* Dashboard hero strip */}
        <div
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            ...glassPanel({
              borderRadius: 18,
              padding: "14px 20px",
              border: "1px solid rgba(34,211,238,0.2)",
            }),
          }}
        >
          <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
            <span
              style={{
                color: "#22d3ee",
                fontSize: 10,
                fontWeight: 900,
                letterSpacing: 3,
              }}
            >
              ONCHAIN ANALYSIS
            </span>
            <span style={{ color: "#fff", fontSize: 22, fontWeight: 900 }}>
              Your <span style={{ color: "#60a5fa" }}>Base Profile</span>
            </span>
          </div>
          <span style={{ color: "#64748b", fontSize: 13, fontWeight: 600, maxWidth: 280 }}>
            {headline}
          </span>
        </div>

        {/* Main dashboard row */}
        <div style={{ display: "flex", flex: 1, gap: 14, minHeight: 0 }}>
          {/* Health + score panel */}
          <div
            style={{
              display: "flex",
              flexDirection: "column",
              flex: 1.4,
              ...glassPanel({ padding: "20px 22px" }),
              overflow: "hidden",
            }}
          >
            <div
              style={{
                height: 3,
                width: "100%",
                background: "linear-gradient(90deg, #ff4d7a, #22d3ee, #3b82f6)",
                borderRadius: 2,
                marginBottom: 16,
                display: "flex",
              }}
            />
            <div style={{ display: "flex", alignItems: "center", gap: 20 }}>
              {/* Score ring */}
              <div
                style={{
                  display: "flex",
                  position: "relative",
                  width: 88,
                  height: 88,
                  alignItems: "center",
                  justifyContent: "center",
                }}
              >
                <svg width="88" height="88" viewBox="0 0 88 88" style={{ position: "absolute" }}>
                  <circle
                    cx="44"
                    cy="44"
                    r={ringR}
                    fill="none"
                    stroke="rgba(0,229,255,0.12)"
                    strokeWidth="7"
                  />
                  <circle
                    cx="44"
                    cy="44"
                    r={ringR}
                    fill="none"
                    stroke="#00E5FF"
                    strokeWidth="7"
                    strokeLinecap="round"
                    strokeDasharray={ringC}
                    strokeDashoffset={ringOffset}
                    transform="rotate(-90 44 44)"
                  />
                </svg>
                <span
                  style={{
                    color: "#60a5fa",
                    fontSize: 18,
                    fontWeight: 800,
                    fontFamily: "monospace",
                  }}
                >
                  {healthScore}
                </span>
              </div>
              <div style={{ display: "flex", flexDirection: "column", gap: 6, flex: 1 }}>
                <span
                  style={{
                    color: "rgba(34,211,238,0.65)",
                    fontSize: 10,
                    fontWeight: 900,
                    letterSpacing: 2,
                  }}
                >
                  WALLET HEALTH
                </span>
                <div style={{ display: "flex", alignItems: "baseline", gap: 4 }}>
                  <span
                    style={{
                      fontSize: 64,
                      fontWeight: 900,
                      color: "#fff",
                      lineHeight: 0.95,
                      letterSpacing: -2,
                    }}
                  >
                    {score}
                  </span>
                  <span style={{ fontSize: 22, color: "#475569", fontWeight: 800 }}>
                    /100
                  </span>
                </div>
                <span style={{ color: "#22d3ee", fontSize: 18, fontWeight: 900 }}>
                  {rank}
                </span>
              </div>
            </div>
            {/* Mini stat row */}
            <div style={{ display: "flex", gap: 10, marginTop: 18 }}>
              {[
                { label: "Active Days", value: String(activeDays) },
                { label: "Total Txs", value: formatTxs(txs) },
                { label: "Streak", value: `${streak}d` },
              ].map((s) => (
                <div
                  key={s.label}
                  style={{
                    display: "flex",
                    flexDirection: "column",
                    flex: 1,
                    alignItems: "center",
                    background: "rgba(255,255,255,0.04)",
                    border: "1px solid rgba(255,255,255,0.1)",
                    borderRadius: 14,
                    padding: "12px 8px",
                  }}
                >
                  <span style={{ color: "#22d3ee", fontSize: 22, fontWeight: 900 }}>
                    {s.value}
                  </span>
                  <span
                    style={{
                      color: "#64748b",
                      fontSize: 9,
                      fontWeight: 800,
                      textTransform: "uppercase",
                      marginTop: 4,
                    }}
                  >
                    {s.label}
                  </span>
                </div>
              ))}
            </div>
          </div>

          {/* Right column — badges + season */}
          <div
            style={{
              display: "flex",
              flexDirection: "column",
              flex: 0.85,
              gap: 12,
            }}
          >
            <div
              style={{
                display: "flex",
                flexDirection: "column",
                flex: 1,
                ...glassPanel({ padding: "18px 20px" }),
              }}
            >
              <span
                style={{
                  color: "#64748b",
                  fontSize: 10,
                  fontWeight: 900,
                  letterSpacing: 2,
                  marginBottom: 12,
                }}
              >
                MINTED BADGES
              </span>
              <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                {["👑", "🐋", "🏗️", "🦄"].slice(0, Math.max(badges, 1)).map((emoji, i) => (
                  <div
                    key={i}
                    style={{
                      width: 48,
                      height: 48,
                      borderRadius: 14,
                      background: "rgba(255,255,255,0.06)",
                      border: "1px solid rgba(255,255,255,0.12)",
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      fontSize: 24,
                    }}
                  >
                    {emoji}
                  </div>
                ))}
              </div>
              <span style={{ color: "#94a3b8", fontSize: 13, fontWeight: 700, marginTop: 12 }}>
                {badges} badge{badges === 1 ? "" : "s"} on Base
              </span>
            </div>
            <div
              style={{
                display: "flex",
                flexDirection: "column",
                gap: 8,
                background: "linear-gradient(135deg, rgba(255,77,122,0.15), rgba(0,82,255,0.2))",
                border: "1px solid rgba(34,211,238,0.25)",
                borderRadius: 18,
                padding: "16px 18px",
              }}
            >
              <span style={{ color: "#fda4af", fontSize: 10, fontWeight: 900, letterSpacing: 2 }}>
                SEASON 1 · GENESIS
              </span>
              <span style={{ color: "#fff", fontSize: 16, fontWeight: 900 }}>
                {days} days left · {xp} XP this week
              </span>
              <span style={{ color: "#64748b", fontSize: 12, fontWeight: 600 }}>
                Quests · Leaderboard · Base Voucher
              </span>
            </div>
          </div>
        </div>

        {/* Footer CTA */}
        <div
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            background: "linear-gradient(90deg, rgba(0,82,255,0.3), rgba(255,51,102,0.22))",
            border: "1px solid rgba(34,211,238,0.3)",
            borderRadius: 16,
            padding: "14px 24px",
          }}
        >
          <div style={{ display: "flex", flexDirection: "column", gap: 2 }}>
            <span style={{ color: "#fff", fontSize: 17, fontWeight: 900 }}>
              {ctaText}
            </span>
            <span style={{ color: "#94a3b8", fontSize: 13, fontWeight: 600 }}>
              base-analytics-app.vercel.app
            </span>
          </div>
          <div
            style={{
              display: "flex",
              alignItems: "center",
              background: "linear-gradient(135deg, #ff4d7a, #3d7bff)",
              borderRadius: 12,
              padding: "12px 24px",
            }}
          >
            <span style={{ color: "#fff", fontSize: 15, fontWeight: 900 }}>
              {isPersonal ? "BEAT MY SCORE →" : "CONNECT WALLET →"}
            </span>
          </div>
        </div>
      </div>
    </div>
  );
}
