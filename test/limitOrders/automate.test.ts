import { describe, expect, it, vi } from "vitest";
import { automateLink, canAutomateStock } from "@/src/lib/limitOrders/automate";

const NVDAC = "0xb20000000000000000000078ee7ce2fe4908108c";

describe("stock auto-invest / stop-loss shortcuts", () => {
  it("opens the recurring card, or the Simple card on its stop-loss goal", () => {
    expect(automateLink(NVDAC, "auto-invest")).toBe(`/swap?mode=recurring&token=${NVDAC.toLowerCase()}`);
    expect(automateLink(NVDAC, "stop-loss")).toBe(`/trade?token=${NVDAC}&ticket=orders&goal=stop-loss`);
  });

  it("is hidden while the order book isn't deployed on mainnet, even with the feature flag on", () => {
    vi.stubEnv("NEXT_PUBLIC_LIMIT_ORDERS_ENABLED", "true");
    expect(canAutomateStock(NVDAC)).toBe(false); // BASE_MAINNET_CONFIG.orderBook is the zero address in tests
    vi.unstubAllEnvs();
  });
});
