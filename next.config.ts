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
  /*
   * The 3D assets are content-addressed by hand and never change in place.
   *
   * Next gives everything in public/ `max-age=0, must-revalidate`, which is the
   * right default for a logo and the wrong one for a six megabyte model: every
   * visit pays a round trip before a single byte of it can be used, and on a
   * phone that round trip happens on a high-latency link while the page shows
   * nothing at all. They are replaced by writing a new file, so they can be
   * immutable.
   *
   * Scoped to /3d/ only. Nothing the public site serves is affected.
   */
  async headers() {
    return [
      {
        source: "/3d/:path*",
        headers: [
          {
            key: "Cache-Control",
            value: "public, max-age=31536000, immutable",
          },
        ],
      },
    ];
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
