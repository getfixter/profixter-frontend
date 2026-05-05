import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  images: {
    remotePatterns: [
      { protocol: "https", hostname: "**.s3.amazonaws.com" },
      { protocol: "https", hostname: "**.s3.*.amazonaws.com" },
      { protocol: "https", hostname: "**.cloudfront.net" },
      { protocol: "https", hostname: "www.profixter.com" },
      { protocol: "https", hostname: "profixter.com" },
    ],
  },
  async redirects() {
    return [
      { source: "/roofing", destination: "/membership", permanent: true },
      { source: "/remodeling", destination: "/membership", permanent: true },
      { source: "/kitchen", destination: "/membership", permanent: true },
      { source: "/projects", destination: "/membership", permanent: true },
      { source: "/estimate", destination: "/membership", permanent: true },
      { source: "/on-demand", destination: "/membership", permanent: true },
    ];
  },
};

export default nextConfig;
