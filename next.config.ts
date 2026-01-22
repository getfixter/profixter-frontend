import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  images: {
    remotePatterns: [
      // AWS S3 (virtual-hosted)
      { protocol: "https", hostname: "**.s3.amazonaws.com" },
      // AWS S3 (regional)
      { protocol: "https", hostname: "**.s3.*.amazonaws.com" },
      // CloudFront (if you use it later)
      { protocol: "https", hostname: "**.cloudfront.net" },
      // Your own domains (optional but safe)
      { protocol: "https", hostname: "www.profixter.com" },
      { protocol: "https", hostname: "profixter.com" },
    ],
  },
};

export default nextConfig;
