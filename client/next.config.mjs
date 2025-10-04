// File: next.config.mjs
import path from "path";

/** @type {import('next').NextConfig} */
const nextConfig = {
  // Ensure both Webpack (Node) and Turbopack (Edge) builds resolve the stubbed Recharts module.
  webpack: (config) => {
    config.resolve.alias = {
      ...(config.resolve.alias || {}),
      recharts: path.resolve(process.cwd(), "src/lib/recharts-stub.js"),
    };
    return config;
  },
  experimental: {
    turbo: {
      resolveAlias: {
        // Use a relative module path so Turbopack works across POSIX and Windows hosts.
        recharts: "./src/lib/recharts-stub.js",
      },
    },
  },
};

export default nextConfig;
