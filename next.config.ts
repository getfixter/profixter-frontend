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
      { source: "/on-demand", destination: "/book", permanent: false },

      /*
       * Extra Visit, Full Day Fixter and Priority Visit are named products in
       * the business but only exist as query strings on Book, so the obvious
       * URLs 404'd. Deliberately temporary: the canonical implementation is the
       * Book tab, and a 308 cached in every browser would make it painful to
       * give any of them a real page later.
       */
      { source: "/extra", destination: "/book?visit=additional", permanent: false },
      { source: "/full-day", destination: "/book?visit=full-day", permanent: false },
      { source: "/priority", destination: "/book?visit=priority", permanent: false },

      /*
       * A third copy of the membership content, assembled entirely from the
       * same section components as /membership and /membership/plans, with an
       * empty H1 and one inbound link. Permanent because the point is to
       * consolidate the search signal onto the comparison page.
       */
      { source: "/membership-info", destination: "/membership/plans", permanent: true },
    ];
  },
};

export default nextConfig;
