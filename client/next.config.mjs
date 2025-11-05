/** @type {import('next').NextConfig} */
const nextConfig = {
  output: 'standalone',
  serverExternalPackages: ['ioredis'],
  webpack: (config, { isServer }) => {
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

    return config;
  },
};

export default nextConfig;
