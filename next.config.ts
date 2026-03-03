import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  experimental: {
    // Bulk media upload jde přes /api/upload/media; default clone limit 10 MB nestačí.
    proxyClientMaxBodySize: "200mb",
  },
  images: {
    remotePatterns: [
      {
        protocol: "https",
        hostname: "eu-central-2.storage.impossibleapi.net",
      },
      {
        protocol: "https",
        hostname: "*.supabase.co",
      },
    ],
  },
};

export default nextConfig;
