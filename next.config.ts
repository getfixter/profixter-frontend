import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  turbopack: {
    root: __dirname,
  },
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
      { source: "/roofing", destination: "/projects#roofing", permanent: true },
      { source: "/siding", destination: "/projects#siding", permanent: true },
      { source: "/remodeling", destination: "/projects#bathroom", permanent: true },
      { source: "/kitchen", destination: "/projects#kitchen", permanent: true },
      { source: "/services/general-contractor", destination: "/projects", permanent: true },
      { source: "/on-demand", destination: "/membership", permanent: true },
    ];
  },
};

export default nextConfig;
