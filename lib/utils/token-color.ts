/**
 * Deterministic color and avatar generator for tokens on Base.
 * Derives stable, accessible, high-contrast HSL color palettes from token addresses.
 */

export interface TokenColorPalette {
  hue: number;
  bg: string;
  gradient: string;
  text: string;
  border: string;
  accent: string;
}

/**
 * FNV-1a hash algorithm for deterministic uniform distribution from address strings.
 */
function hashString(str: string): number {
  let hash = 2166136261;
  const clean = str.trim().toLowerCase();
  for (let i = 0; i < clean.length; i++) {
    hash ^= clean.charCodeAt(i);
    // 32-bit FNV prime multiplication
    hash = Math.imul(hash, 16777619);
  }
  return Math.abs(hash);
}

/**
 * Derives a deterministic color palette from a token address or symbol.
 */
export function getDeterministicTokenColor(addressOrKey?: string | null): TokenColorPalette {
  const seed = (addressOrKey && addressOrKey.trim().length > 0)
    ? addressOrKey.trim().toLowerCase()
    : "0x0000000000000000000000000000000000000000";

  const hash = hashString(seed);
  const hue = hash % 360;
  const secondaryHue = (hue + 32) % 360;

  // Curated saturation & lightness for premium, high-contrast dark-mode & light-mode look
  const bg = `hsl(${hue}, 68%, 38%)`;
  const bgSecondary = `hsl(${secondaryHue}, 74%, 28%)`;
  const gradient = `linear-gradient(135deg, ${bg} 0%, ${bgSecondary} 100%)`;
  const text = "#FFFFFF";
  const border = `hsla(${hue}, 80%, 65%, 0.35)`;
  const accent = `hsl(${hue}, 85%, 60%)`;

  return {
    hue,
    bg,
    gradient,
    text,
    border,
    accent,
  };
}

/**
 * Clean and extract 1-2 letters for token initials.
 */
export function getDeterministicTokenInitials(symbol?: string | null): string {
  if (!symbol) return "TK";
  // Remove non-alphanumeric chars (like $, #, etc.)
  const clean = symbol.replace(/[^a-zA-Z0-9]/g, "").toUpperCase();
  if (!clean) return "TK";
  return clean.slice(0, 2);
}

/**
 * Generates an SVG string representation of the deterministic token badge.
 * Suitable for proxy route image responses or standalone SVG rendering.
 */
export function generateTokenPlaceholderSvg(
  address: string,
  symbol: string,
  size: number = 64
): string {
  const { text, border } = getDeterministicTokenColor(address || symbol);
  const initials = getDeterministicTokenInitials(symbol);
  const fontSize = Math.round(size * 0.42);

  // Escape XML characters
  const safeInitials = initials
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");

  return `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 ${size} ${size}" fill="none">
  <defs>
    <linearGradient id="g_${hashString(address || symbol)}" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" stop-color="${getDeterministicTokenColor(address).bg}" />
      <stop offset="100%" stop-color="hsl(${(getDeterministicTokenColor(address).hue + 32) % 360}, 74%, 28%)" />
    </linearGradient>
  </defs>
  <circle cx="${size / 2}" cy="${size / 2}" r="${size / 2 - 1}" fill="url(#g_${hashString(address || symbol)})" stroke="${border}" stroke-width="1.5" />
  <text x="50%" y="54%" text-anchor="middle" dominant-baseline="middle" fill="${text}" font-family="system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif" font-weight="800" font-size="${fontSize}px" letter-spacing="0.5px">${safeInitials}</text>
</svg>`;
}
