/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  transpilePackages: ['@bharattunnel/shared'],
  async rewrites() {
    const apiServer = process.env.API_SERVER_URL || process.env.NEXT_PUBLIC_API_URL || 'http://137.23.44.209:4000';
    return [
      {
        source: '/api/:path*',
        destination: `${apiServer}/api/:path*`,
      },
    ];
  },
};

export default nextConfig;
