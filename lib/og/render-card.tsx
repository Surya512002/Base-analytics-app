import type { OgCardData } from "./types";
import { shortenAddress } from "./types";

const TABS = [
  { icon: "◎", label: "Explore", active: true },
  { icon: "📊", label: "Analytics", active: false },
  { icon: "🎁", label: "Rewards", active: false },
  { icon: "🚀", label: "B20", active: false },
  { icon: "🏆", label: "Badges", active: false },
] as const;

function formatTxs(n: number): string {
  if (n >= 1000) return `${(n / 1000).toFixed(1).replace(/\.0$/, "")}k`;
  return n.toLocaleString();
}

function glassPanel(extra?: Record<string, string | number>) {
  return {
    background: "rgba(255,255,255,0.06)",
    border: "1px solid rgba(255,255,255,0.12)",
    borderRadius: 16,
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
  const boosts = data.boosts ?? 12;
  const activeDays = data.activeDays ?? 47;
  const txs = data.txs ?? 1248;
  const healthScore = data.healthScore ?? score;
  const address = shortenAddress(
    data.address || "0x3799cafa388da047cAF7c999e31c844705FadfAe"
  );
  const variant = data.variant ?? "default";
  const isPersonal =
    variant === "score" || variant === "badge" || Boolean(data.title);

  const ringR = 24;
  const ringC = 2 * Math.PI * ringR;
  const ringOffset = ringC * (1 - healthScore / 100);

  const ctaText = isPersonal ? "Challenge this wallet" : "Connect & scan free";

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
          padding: "22px 32px 24px",
          position: "relative",
          gap: 10,
        }}
      >
        {/* Connected wallet header */}
        <div
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            ...glassPanel({ borderRadius: 14, padding: "10px 16px" }),
          }}
        >
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <div
              style={{
                width: 28,
                height: 28,
                borderRadius: 8,
                background: "linear-gradient(135deg, #0052FF, #00E5FF)",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
              }}
            >
              <span style={{ fontSize: 14, fontWeight: 900, color: "#fff" }}>B</span>
            </div>
            <span style={{ color: "#fff", fontSize: 14, fontWeight: 900 }}>
              BASE<span style={{ color: "#22d3ee" }}>.</span>ANALYTICS
            </span>
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <div
              style={{
                display: "flex",
                alignItems: "center",
                gap: 5,
                background: "rgba(16,185,129,0.12)",
                border: "1px solid rgba(16,185,129,0.35)",
                borderRadius: 100,
                padding: "5px 10px",
              }}
            >
              <div
                style={{
                  width: 6,
                  height: 6,
                  borderRadius: 3,
                  background: "#10b981",
                  display: "flex",
                }}
              />
              <span style={{ color: "#6ee7b7", fontSize: 10, fontWeight: 800 }}>
                Connected
              </span>
            </div>
            <span
              style={{
                color: "#94a3b8",
                fontSize: 11,
                fontWeight: 700,
                fontFamily: "monospace",
              }}
            >
              {address}
            </span>
            <span style={{ color: "#22d3ee", fontSize: 10, fontWeight: 900 }}>
              ⚡ {xp} XP
            </span>
          </div>
        </div>

        {/* Tab bar — app style, Voucher 2nd */}
        <div
          style={{
            display: "flex",
            gap: 4,
            ...glassPanel({ borderRadius: 14, padding: 4 }),
          }}
        >
          {TABS.map((tab) => (
            <div
              key={tab.label}
              style={{
                display: "flex",
                flex: 1,
                alignItems: "center",
                justifyContent: "center",
                gap: 4,
                padding: "8px 6px",
                borderRadius: 10,
                fontSize: 10,
                fontWeight: 800,
                color: tab.active ? "#fff" : "#94a3b8",
                background: tab.active
                  ? "linear-gradient(135deg, #ff4d7a, #3d7bff)"
                  : "transparent",
              }}
            >
              <span style={{ fontSize: 11 }}>{tab.icon}</span>
              <span>{tab.label}</span>
            </div>
          ))}
        </div>

        {/* Your Base Profile header */}
        <div
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            ...glassPanel({
              borderRadius: 14,
              padding: "12px 18px",
              border: "1px solid rgba(34,211,238,0.2)",
            }),
          }}
        >
          <div style={{ display: "flex", flexDirection: "column", gap: 2 }}>
            <span
              style={{
                color: "#22d3ee",
                fontSize: 9,
                fontWeight: 900,
                letterSpacing: 3,
              }}
            >
              ONCHAIN ANALYSIS
            </span>
            <span style={{ color: "#fff", fontSize: 20, fontWeight: 900 }}>
              Your <span style={{ color: "#60a5fa" }}>Base Profile</span>
            </span>
          </div>
          <span style={{ color: "#64748b", fontSize: 11, fontWeight: 600, maxWidth: 280 }}>
            B20 explore · in-app swaps · wallet scan · quests on Base.
          </span>
        </div>

        {/* Daily check-in */}
        <div
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            ...glassPanel({
              padding: "12px 16px",
              border: "1px solid rgba(34,211,238,0.25)",
            }),
          }}
        >
          <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
            <div
              style={{
                width: 40,
                height: 40,
                borderRadius: 12,
                background: "rgba(34,211,238,0.12)",
                border: "1px solid rgba(34,211,238,0.3)",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                fontSize: 20,
              }}
            >
              🔥
            </div>
            <div style={{ display: "flex", flexDirection: "column", gap: 2 }}>
              <span style={{ color: "#fff", fontSize: 14, fontWeight: 900 }}>
                Day {streak} streak 🔥
              </span>
              <span style={{ color: "#64748b", fontSize: 10, fontWeight: 600 }}>
                Sign once · earn XP · unlock multipliers
              </span>
              <div style={{ display: "flex", gap: 4, marginTop: 4 }}>
                {Array.from({ length: Math.min(streak, 5) }).map((_, i) => (
                  <div
                    key={i}
                    style={{
                      width: 18,
                      height: 18,
                      borderRadius: 6,
                      background: "rgba(34,211,238,0.12)",
                      border: "1px solid rgba(34,211,238,0.25)",
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      fontSize: 9,
                    }}
                  >
                    🔥
                  </div>
                ))}
              </div>
            </div>
          </div>
          <div
            style={{
              display: "flex",
              flexDirection: "column",
              alignItems: "center",
              gap: 4,
            }}
          >
            <div
              style={{
                display: "flex",
                background: "linear-gradient(135deg, #ff4d7a, #3d7bff)",
                borderRadius: 12,
                padding: "10px 22px",
              }}
            >
              <span style={{ color: "#fff", fontSize: 12, fontWeight: 900 }}>
                Check In
              </span>
            </div>
            <span style={{ color: "#64748b", fontSize: 8, fontWeight: 700 }}>
              ⛽ Gas Sponsored
            </span>
          </div>
        </div>

        {/* Main dashboard body */}
        <div style={{ display: "flex", flex: 1, gap: 10, minHeight: 0 }}>
          <div
            style={{
              display: "flex",
              flexDirection: "column",
              flex: 1.55,
              gap: 8,
            }}
          >
            {/* Wallet Health */}
            <div
              style={{
                display: "flex",
                flexDirection: "column",
                ...glassPanel({ padding: "14px 16px" }),
              }}
            >
              <div
                style={{
                  height: 2,
                  width: "100%",
                  background: "linear-gradient(90deg, #ff4d7a, #22d3ee, #3b82f6)",
                  borderRadius: 2,
                  marginBottom: 10,
                  display: "flex",
                }}
              />
              <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
                <div
                  style={{
                    display: "flex",
                    position: "relative",
                    width: 56,
                    height: 56,
                    alignItems: "center",
                    justifyContent: "center",
                    flexShrink: 0,
                  }}
                >
                  <svg width="56" height="56" viewBox="0 0 56 56" style={{ position: "absolute" }}>
                    <circle
                      cx="28"
                      cy="28"
                      r={ringR}
                      fill="none"
                      stroke="rgba(0,229,255,0.12)"
                      strokeWidth="5"
                    />
                    <circle
                      cx="28"
                      cy="28"
                      r={ringR}
                      fill="none"
                      stroke="#00E5FF"
                      strokeWidth="5"
                      strokeLinecap="round"
                      strokeDasharray={ringC}
                      strokeDashoffset={ringOffset}
                      transform="rotate(-90 28 28)"
                    />
                  </svg>
                  <span
                    style={{
                      color: "#60a5fa",
                      fontSize: 13,
                      fontWeight: 800,
                      fontFamily: "monospace",
                    }}
                  >
                    {healthScore}
                  </span>
                </div>
                <div style={{ display: "flex", flexDirection: "column", gap: 3, flex: 1 }}>
                  <span
                    style={{
                      color: "rgba(34,211,238,0.65)",
                      fontSize: 9,
                      fontWeight: 900,
                      letterSpacing: 2,
                    }}
                  >
                    WALLET HEALTH
                  </span>
                  <span style={{ color: "#fff", fontSize: 13, fontWeight: 800 }}>
                    {rank} · Active on Base
                  </span>
                </div>
                <div style={{ display: "flex", gap: 6 }}>
                  {[
                    { label: "Days", value: String(activeDays) },
                    { label: "Txs", value: formatTxs(txs) },
                    { label: "Streak", value: `${streak}d` },
                  ].map((s) => (
                    <div
                      key={s.label}
                      style={{
                        display: "flex",
                        flexDirection: "column",
                        alignItems: "center",
                        background: "rgba(255,255,255,0.04)",
                        border: "1px solid rgba(255,255,255,0.1)",
                        borderRadius: 10,
                        padding: "8px 10px",
                        minWidth: 52,
                      }}
                    >
                      <span style={{ color: "#22d3ee", fontSize: 16, fontWeight: 900 }}>
                        {s.value}
                      </span>
                      <span
                        style={{
                          color: "#64748b",
                          fontSize: 8,
                          fontWeight: 800,
                          textTransform: "uppercase",
                          marginTop: 2,
                        }}
                      >
                        {s.label}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            </div>

            {/* Boost + Community Vibes */}
            <div style={{ display: "flex", gap: 8 }}>
              <div
                style={{
                  display: "flex",
                  flex: 1,
                  alignItems: "center",
                  justifyContent: "space-between",
                  ...glassPanel({ padding: "12px 14px" }),
                }}
              >
                <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                  <div
                    style={{
                      width: 36,
                      height: 36,
                      borderRadius: 10,
                      background: "rgba(34,211,238,0.12)",
                      border: "1px solid rgba(34,211,238,0.2)",
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      fontSize: 18,
                    }}
                  >
                    🚀
                  </div>
                  <div style={{ display: "flex", flexDirection: "column", gap: 2 }}>
                    <span style={{ color: "#fff", fontSize: 12, fontWeight: 900 }}>
                      XP Booster
                    </span>
                    <span style={{ color: "#64748b", fontSize: 9, fontWeight: 700 }}>
                      {boosts} boosts · {streak}d streak
                    </span>
                  </div>
                </div>
                <div
                  style={{
                    display: "flex",
                    background: "linear-gradient(135deg, #ff4d7a, #3d7bff)",
                    borderRadius: 10,
                    padding: "8px 14px",
                  }}
                >
                  <span style={{ color: "#fff", fontSize: 10, fontWeight: 900 }}>
                    BOOST (+1)
                  </span>
                </div>
              </div>
              <div
                style={{
                  display: "flex",
                  flex: 1,
                  flexDirection: "column",
                  ...glassPanel({ padding: "12px 14px" }),
                }}
              >
                <span
                  style={{
                    color: "#fff",
                    fontSize: 11,
                    fontWeight: 900,
                    marginBottom: 8,
                  }}
                >
                  ⭐ Community Vibes
                </span>
                <div style={{ display: "flex", gap: 6 }}>
                  {["☀️ GM", "🌙 GN"].map((label) => (
                    <div
                      key={label}
                      style={{
                        display: "flex",
                        flex: 1,
                        alignItems: "center",
                        justifyContent: "center",
                        background: "rgba(255,255,255,0.04)",
                        border: "1px solid rgba(255,255,255,0.1)",
                        borderRadius: 10,
                        padding: "8px 0",
                        fontSize: 12,
                        fontWeight: 900,
                        color: "#fff",
                      }}
                    >
                      {label}
                    </div>
                  ))}
                </div>
              </div>
            </div>

            {/* Onchain Score */}
            <div
              style={{
                display: "flex",
                flex: 1,
                flexDirection: "column",
                ...glassPanel({ padding: "14px 16px" }),
              }}
            >
              <div
                style={{
                  height: 2,
                  width: "100%",
                  background: "linear-gradient(90deg, #ff4d7a, #22d3ee, #3b82f6)",
                  borderRadius: 2,
                  marginBottom: 8,
                  display: "flex",
                }}
              />
              <span
                style={{
                  color: "rgba(34,211,238,0.65)",
                  fontSize: 9,
                  fontWeight: 900,
                  letterSpacing: 2,
                  marginBottom: 4,
                }}
              >
                ONCHAIN SCORE
              </span>
              <div style={{ display: "flex", alignItems: "baseline", gap: 4 }}>
                <span
                  style={{
                    fontSize: 52,
                    fontWeight: 900,
                    color: "#fff",
                    lineHeight: 0.95,
                    letterSpacing: -2,
                  }}
                >
                  {score}
                </span>
                <span style={{ fontSize: 18, color: "#475569", fontWeight: 800 }}>
                  /100
                </span>
              </div>
              <span style={{ color: "#22d3ee", fontSize: 15, fontWeight: 900, marginTop: 2 }}>
                {rank}
              </span>
              <div style={{ display: "flex", gap: 8, marginTop: 10 }}>
                {[
                  { label: "Activity", pct: 78 },
                  { label: "DeFi", pct: 65 },
                  { label: "Social", pct: 82 },
                ].map((bar) => (
                  <div
                    key={bar.label}
                    style={{
                      display: "flex",
                      flexDirection: "column",
                      flex: 1,
                      gap: 4,
                    }}
                  >
                    <span style={{ color: "#64748b", fontSize: 8, fontWeight: 800 }}>
                      {bar.label}
                    </span>
                    <div
                      style={{
                        display: "flex",
                        height: 4,
                        background: "rgba(255,255,255,0.08)",
                        borderRadius: 4,
                        overflow: "hidden",
                      }}
                    >
                      <div
                        style={{
                          display: "flex",
                          width: `${bar.pct}%`,
                          background: "linear-gradient(90deg, #ff4d7a, #22d3ee)",
                          borderRadius: 4,
                        }}
                      />
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* Right column */}
          <div
            style={{
              display: "flex",
              flexDirection: "column",
              flex: 0.75,
              gap: 8,
            }}
          >
            <div
              style={{
                display: "flex",
                flexDirection: "column",
                flex: 1,
                ...glassPanel({ padding: "14px 16px" }),
              }}
            >
              <span
                style={{
                  color: "#64748b",
                  fontSize: 9,
                  fontWeight: 900,
                  letterSpacing: 2,
                  marginBottom: 10,
                }}
              >
                MINTED BADGES
              </span>
              <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
                {["👑", "🐋", "🏗️", "🦄"].slice(0, Math.max(badges, 1)).map((emoji, i) => (
                  <div
                    key={i}
                    style={{
                      width: 40,
                      height: 40,
                      borderRadius: 12,
                      background: "rgba(255,255,255,0.06)",
                      border: "1px solid rgba(255,255,255,0.12)",
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      fontSize: 20,
                    }}
                  >
                    {emoji}
                  </div>
                ))}
              </div>
              <span style={{ color: "#94a3b8", fontSize: 11, fontWeight: 700, marginTop: 10 }}>
                {badges} badge{badges === 1 ? "" : "s"} on Base
              </span>
            </div>
            <div
              style={{
                display: "flex",
                flexDirection: "column",
                gap: 6,
                background: "linear-gradient(135deg, rgba(255,77,122,0.15), rgba(0,82,255,0.2))",
                border: "1px solid rgba(34,211,238,0.25)",
                borderRadius: 14,
                padding: "14px 16px",
              }}
            >
              <span style={{ color: "#fda4af", fontSize: 9, fontWeight: 900, letterSpacing: 2 }}>
                SEASON 1 · GENESIS
              </span>
              <span style={{ color: "#fff", fontSize: 14, fontWeight: 900 }}>
                {days} days left · {xp} XP
              </span>
              <span style={{ color: "#64748b", fontSize: 10, fontWeight: 600 }}>
                Quests · B20 · In-app DEX · Voucher
              </span>
            </div>
          </div>
        </div>

        {/* Footer */}
        <div
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            background: "linear-gradient(90deg, rgba(0,82,255,0.3), rgba(255,51,102,0.22))",
            border: "1px solid rgba(34,211,238,0.3)",
            borderRadius: 12,
            padding: "10px 20px",
          }}
        >
          <div style={{ display: "flex", flexDirection: "column", gap: 1 }}>
            <span style={{ color: "#fff", fontSize: 14, fontWeight: 900 }}>
              {ctaText}
            </span>
            <span style={{ color: "#94a3b8", fontSize: 11, fontWeight: 600 }}>
              Explore · Swap · Launch B20 on Base
            </span>
          </div>
          <div
            style={{
              display: "flex",
              background: "linear-gradient(135deg, #ff4d7a, #3d7bff)",
              borderRadius: 10,
              padding: "10px 20px",
            }}
          >
            <span style={{ color: "#fff", fontSize: 13, fontWeight: 900 }}>
              {isPersonal ? "BEAT MY SCORE →" : "CONNECT WALLET →"}
            </span>
          </div>
        </div>
      </div>
    </div>
  );
}
