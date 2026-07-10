import { FIXED_LAUNCH_SUPPLY } from "@/lib/launchpad/launch-config";

export function formatUsdSubscript(price: number): string {
  if (!Number.isFinite(price) || price <= 0) return "$0";
  if (price >= 0.01) return `$${price.toFixed(4)}`;
  const str = price.toFixed(12);
  const match = str.match(/^0\.(0*)([1-9]\d?)/);
  if (!match) return `$${price.toExponential(2)}`;
  const zeros = match[1].length;
  const tail = match[2].padEnd(5, "0").slice(0, 5);
  const sub = String(zeros).split("").map((d) => String.fromCharCode(0x2080 + parseInt(d, 10))).join("");
  return `$0.0${sub}${tail}`;
}

export function formatEthSubscript(eth: number): string {
  if (!Number.isFinite(eth) || eth <= 0) return "0 ETH";
  if (eth >= 0.0001) return `${eth.toFixed(6)} ETH`;
  const str = eth.toFixed(18);
  const match = str.match(/^0\.(0*)([1-9]\d?)/);
  if (!match) return `${eth.toExponential(2)} ETH`;
  const zeros = match[1].length;
  const tail = match[2].padEnd(5, "0").slice(0, 5);
  const sub = String(zeros).split("").map((d) => String.fromCharCode(0x2080 + parseInt(d, 10))).join("");
  return `0.0${sub}${tail} ETH`;
}

export function computeLaunchEconomics(
  startPriceUsd: string,
  ethUsd: number
): {
  priceUsd: number;
  priceEth: number;
  marketCapUsd: number;
  marketCapEth: number;
  priceUsdLabel: string;
  priceEthLabel: string;
  marketCapUsdLabel: string;
  marketCapEthLabel: string;
} {
  const priceUsd = parseFloat(startPriceUsd) || 0;
  const supply = parseFloat(FIXED_LAUNCH_SUPPLY);
  const priceEth = ethUsd > 0 ? priceUsd / ethUsd : 0;
  const marketCapUsd = priceUsd * supply;
  const marketCapEth = priceEth * supply;

  const fmtK = (n: number) => {
    if (n >= 1e9) return `$${(n / 1e9).toFixed(2)}B`;
    if (n >= 1e6) return `$${(n / 1e6).toFixed(2)}M`;
    if (n >= 1e3) return `$${(n / 1e3).toFixed(2)}K`;
    return `$${n.toFixed(2)}`;
  };

  return {
    priceUsd,
    priceEth,
    marketCapUsd,
    marketCapEth,
    priceUsdLabel: formatUsdSubscript(priceUsd),
    priceEthLabel: formatEthSubscript(priceEth),
    marketCapUsdLabel: fmtK(marketCapUsd),
    marketCapEthLabel: marketCapEth >= 1 ? `${marketCapEth.toFixed(3)} ETH` : formatEthSubscript(marketCapEth),
  };
}
