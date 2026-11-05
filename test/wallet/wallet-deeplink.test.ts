import { describe, it, expect } from "vitest";
import { isMobileDevice, getMobileWalletDeepLink } from "@/lib/utils/wallet-deeplink";

describe("Mobile Wallet Deep Linking", () => {
  it("detects mobile devices from user agents", () => {
    const iphoneUa = "Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15";
    const androidUa = "Mozilla/5.0 (Linux; Android 14; Pixel 7) AppleWebKit/537.36";
    const macUa = "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36";

    expect(isMobileDevice(iphoneUa)).toBe(true);
    expect(isMobileDevice(androidUa)).toBe(true);
    expect(isMobileDevice(macUa)).toBe(false);
  });

  it("constructs correct MetaMask mobile universal link without https:// scheme", () => {
    const appUrl = "https://base-analytics-app.vercel.app/explore";
    const link = getMobileWalletDeepLink("metamask", appUrl);
    expect(link).toBe("https://metamask.app.link/dapp/base-analytics-app.vercel.app/explore");
  });

  it("constructs correct Coinbase Wallet mobile universal link with encoded cb_url", () => {
    const appUrl = "https://base-analytics-app.vercel.app/swap?buy=0x4200";
    const link = getMobileWalletDeepLink("coinbase", appUrl);
    expect(link).toBe(
      "https://go.cb-w.com/dapp?cb_url=https%3A%2F%2Fbase-analytics-app.vercel.app%2Fswap%3Fbuy%3D0x4200"
    );
  });
});
