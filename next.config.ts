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
    ],
  },
  webpack: (config) => {
    config.resolve ??= {};
    config.resolve.alias = {
      ...config.resolve.alias,
      "@react-native-async-storage/async-storage": path.resolve(
        process.cwd(),
        "lib/stubs/async-storage.ts"
      ),
    };
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
    },
  },
};

export default nextConfig;
