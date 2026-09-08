/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  output: 'standalone',
  transpilePackages: ['@kairos-crm/shared'],
  experimental: {
    typedRoutes: false,
  },
};

module.exports = nextConfig;
