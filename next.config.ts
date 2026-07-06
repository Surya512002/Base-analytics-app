const path = require("path");

/** @type {import('next').NextConfig} */
const nextConfig = {
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
    config.resolve.alias = {
      ...config.resolve.alias,
      "@react-native-async-storage/async-storage": path.resolve(
        __dirname,
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

module.exports = nextConfig;
