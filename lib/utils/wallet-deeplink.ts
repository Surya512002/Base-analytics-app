/**
 * wallet-deeplink.ts
 * Universal deep links for mobile crypto wallets (MetaMask, Coinbase Wallet).
 */

export function isMobileDevice(ua?: string): boolean {
  if (typeof window === "undefined" && !ua) return false;
  const userAgent = ua || (typeof navigator !== "undefined" ? navigator.userAgent : "");
  return /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(userAgent);
}

export function getMobileWalletDeepLink(
  type: "metamask" | "coinbase",
  currentUrl?: string
): string {
  const rawUrl =
    currentUrl ||
    (typeof window !== "undefined" ? window.location.href : "https://base-analytics-app.vercel.app");

  if (type === "metamask") {
    // MetaMask app.link expects the domain and path without protocol scheme
    const cleanUrl = rawUrl.replace(/^https?:\/\//, "");
    return `https://metamask.app.link/dapp/${cleanUrl}`;
  }

  if (type === "coinbase") {
    return `https://go.cb-w.com/dapp?cb_url=${encodeURIComponent(rawUrl)}`;
  }

  return rawUrl;
}
