import type { NextConfig } from 'next';

const nextConfig: NextConfig = {
  reactStrictMode: true,
  outputFileTracingIncludes: {
    '/api/admin/send-license': ['./public/carbonmate-logo.png'],
  },
};

export default nextConfig;
