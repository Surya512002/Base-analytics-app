import {
  OgBackground,
  OgFooter,
  OgHeader,
  OG_COLORS,
} from "@/lib/og/brand-kit";

/** Homepage-aligned OG / Farcaster image for Base Voucher redemption. */
export function renderRedeemThumbnail() {
  return (
    <div
      style={{
        width: "100%",
        height: "100%",
        display: "flex",
        flexDirection: "column",
        position: "relative",
        overflow: "hidden",
        fontFamily: "system-ui, sans-serif",
        background: OG_COLORS.bg,
      }}
    >
      <OgBackground />
      <div
        style={{
          display: "flex",
          flexDirection: "column",
          width: "100%",
          height: "100%",
          padding: "30px 40px 24px",
          position: "relative",
          gap: 22,
        }}
      >
        <OgHeader label="BASE VOUCHER" />
        <div style={{ display: "flex", flex: 1, gap: 40, alignItems: "center" }}>
          <div style={{ display: "flex", flex: 1.1, flexDirection: "column" }}>
            <span
              style={{
                color: OG_COLORS.green,
                fontSize: 13,
                fontWeight: 900,
                letterSpacing: "0.18em",
              }}
            >
              CRYPTO GIFT CARD · ONCHAIN
            </span>
            <span
              style={{
                color: OG_COLORS.text,
                fontSize: 58,
                fontWeight: 950,
                lineHeight: 0.98,
                letterSpacing: "-0.045em",
                marginTop: 16,
              }}
            >
              A gift is waiting
              <br />
              for you on Base.
            </span>
            <span
              style={{
                color: OG_COLORS.muted,
                fontSize: 19,
                fontWeight: 650,
                lineHeight: 1.4,
                marginTop: 18,
              }}
            >
              Connect your wallet and redeem ETH or USDC in one tap.
            </span>
          </div>
          <div
            style={{
              display: "flex",
              width: 390,
              height: 235,
              flexDirection: "column",
              justifyContent: "space-between",
              borderRadius: 24,
              border: "1px solid rgba(107,163,255,0.35)",
              background:
                "linear-gradient(135deg, rgba(0,82,255,0.45), rgba(52,211,153,0.14)), #07111f",
              boxShadow: "0 30px 90px rgba(0,0,0,0.48)",
              padding: 26,
              transform: "rotate(-2deg)",
            }}
          >
            <div style={{ display: "flex", justifyContent: "space-between" }}>
              <span style={{ color: OG_COLORS.text, fontSize: 15, fontWeight: 900 }}>
                BASE VOUCHER
              </span>
              <span style={{ color: OG_COLORS.green, fontSize: 11, fontWeight: 900 }}>
                REDEEMABLE
              </span>
            </div>
            <span style={{ color: OG_COLORS.text, fontSize: 55, fontWeight: 950 }}>
              $25.00
            </span>
            <div style={{ display: "flex", justifyContent: "space-between" }}>
              <span style={{ color: OG_COLORS.muted, fontSize: 12 }}>USDC · BASE</span>
              <span style={{ color: OG_COLORS.cyan, fontSize: 12, fontWeight: 800 }}>
                CARD 12-3
              </span>
            </div>
          </div>
        </div>
        <OgFooter cta="REDEEM YOUR GIFT" />
      </div>
    </div>
  );
}
