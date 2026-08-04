import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  images: {
    remotePatterns: [
      { protocol: 'https', hostname: 'cricheroes.com' },
      { protocol: 'https', hostname: 'storage.cricheroes.in' },
    ],
  },
};

export default nextConfig;
