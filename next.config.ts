import type { NextConfig } from "next";
import path from "path";

const nextConfig: NextConfig = {
  images: {
    remotePatterns: [
      {
        protocol: "https",
        hostname: "res.cloudinary.com",
        port: "",
        pathname: "/**",
      },
      {
        protocol: "https",
        hostname: "**.googleusercontent.com",
        port: "",
        pathname: "/**",
      },
      {
        protocol: "https",
        hostname: "dd.dexscreener.com",
        port: "",
        pathname: "/**",
      },
      {
        protocol: "https",
        hostname: "assets.coingecko.com",
        port: "",
        pathname: "/**",
      },
      {
        protocol: "https",
        hostname: "coin-images.coingecko.com",
        port: "",
        pathname: "/**",
      },
      {
        protocol: "https",
        hostname: "tokens.1inch.io",
        port: "",
        pathname: "/**",
      },
    ],
  },
  webpack: (config, { isServer }) => {
    config.resolve ??= {};
    config.resolve.alias = {
      ...config.resolve.alias,
      "@react-native-async-storage/async-storage": path.resolve(
        process.cwd(),
        "lib/stubs/async-storage.ts"
      ),
    };
    if (!isServer) {
      config.resolve.alias = {
        ...config.resolve.alias,
        ioredis: path.resolve(process.cwd(), "lib/stubs/ioredis-stub.ts"),
      };
      config.resolve.fallback = {
        ...config.resolve.fallback,
        dns: false,
        net: false,
        tls: false,
        fs: false,
      };
    }
    // viem/chains pulls ox/tempo — webpack logs harmless "Critical dependency" traces
    config.ignoreWarnings = [
      ...(config.ignoreWarnings ?? []),
      {
        module: /node_modules[\\/]viem/,
        message: /Critical dependency/,
      },
    ];
    return config;
  },
  turbopack: {
    resolveAlias: {
      "@react-native-async-storage/async-storage": "./lib/stubs/async-storage.ts",
      ioredis: "./lib/stubs/ioredis-stub.ts",
    },
  },
  async headers() {
    return [
      {
        source: "/:path*",
        headers: [
          {
            key: "Content-Security-Policy",
            value: [
              "default-src 'self'",
              "script-src 'self' 'unsafe-eval' 'unsafe-inline'",
              "style-src 'self' 'unsafe-inline'",
              "img-src 'self' data: blob: https://res.cloudinary.com https://*.googleusercontent.com https://raw.githubusercontent.com https://basescan.org https://assets.coingecko.com https://coin-images.coingecko.com https://*.coingecko.com https://dd.dexscreener.com https://*.dexscreener.com https://tokens.1inch.io https://ipfs.io https://*.ipfs.dweb.link https://arweave.net",
              "font-src 'self' data:",
              "connect-src 'self' https://mainnet.base.org https://sepolia.base.org https://*.alchemy.com https://api.developer.coinbase.com https://keys.coinbase.com https://cca-lite.coinbase.com https://api.0x.org https://basescan.org https://*.basescan.org https://*.walletconnect.com wss://*.walletconnect.com https://*.walletconnect.org wss://*.walletconnect.org https://*.farcaster.xyz",
              "frame-src 'self' https://keys.coinbase.com https://farcaster.xyz https://warpcast.com",
              "frame-ancestors 'self' https://farcaster.xyz https://warpcast.com",
            ].join("; "),
          },
          {
            key: "X-Content-Type-Options",
            value: "nosniff",
          },
          {
            key: "Referrer-Policy",
            value: "strict-origin-when-cross-origin",
          },
          {
            key: "Permissions-Policy",
            value: "camera=(), microphone=(), geolocation=()",
          },
        ],
      },
    ];
  },
};

export default nextConfig;
