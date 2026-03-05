import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Allow large audio file uploads (200MB)
  experimental: {
    serverActions: {
      bodySizeLimit: '200mb',
    },
  },
};

export default nextConfig;
