import {
  PHASE_DEVELOPMENT_SERVER,
  PHASE_PRODUCTION_BUILD,
  PHASE_PRODUCTION_SERVER,
} from 'next/constants.js';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const workspaceRoot = resolve(__dirname, '..');

/**
 * @param {string} phase
 * @returns {import('next').NextConfig}
 */
const createConfig = (phase) => {
  const isDevPhase = phase === PHASE_DEVELOPMENT_SERVER;
  const isProdBuild = phase === PHASE_PRODUCTION_BUILD;
  const isProdServer = phase === PHASE_PRODUCTION_SERVER;

  return {
    output: 'standalone',
    outputFileTracingRoot: workspaceRoot,
    serverExternalPackages: ['ioredis'],
    webpack: (config, { isServer, dev }) => {
      if (!isServer) {
        config.resolve.fallback = {
          ...config.resolve.fallback,
          dns: false,
          net: false,
          tls: false,
        };
        config.resolve.alias = {
          ...config.resolve.alias,
          ioredis: false,
        };
      }

      if (!dev && (isProdBuild || isProdServer)) {
        config.devtool = false;
        config.optimization = {
          ...config.optimization,
          minimize: true,
          runtimeChunk: 'single',
          splitChunks: {
            ...config.optimization?.splitChunks,
            chunks: 'all',
            maxInitialRequests: 25,
            cacheGroups: {
              ...config.optimization?.splitChunks?.cacheGroups,
              vendors: {
                test: /[\\/]node_modules[\\/]/,
                name: 'vendors',
                chunks: 'all',
              },
            },
          },
        };
      }

      return config;
    },
  };
};

export default createConfig;
