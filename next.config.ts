import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Lets a local side-by-side build use its own output folder; unset everywhere else.
  ...(process.env.NEXT_DIST_DIR ? { distDir: process.env.NEXT_DIST_DIR } : {}),
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
        /*
         * Never let a phone hold on to a version of the Lab that no longer
         * exists. The served HTML is a placeholder either way, so a stale shell
         * and a broken experiment look identical — and nobody should have to
         * clear a cache to tell them apart.
         */
        source: "/admin/lab",
        headers: [
          { key: "Cache-Control", value: "no-store, must-revalidate" },
          { key: "Pragma", value: "no-cache" },
        ],
      },
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
      /*
       * Retired for good: /book has been the booking page for months. Permanent
       * so search engines move any remaining signal across; the destination
       * and any query string are unchanged.
       */
      { source: "/on-demand", destination: "/book", permanent: true },

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

      /*
       * Retired for good (2026-10). /home-support was the standalone "Profixter
       * AI" page; the services hub answers the same "where do I start" question
       * and the floating support chat is on every customer page. The Shower
       * Studio never launched (it was noindex throughout); its URLs go to the
       * kitchen and bath page, which sells the real work. Permanent so any
       * signal moves across and nobody lands on a 404.
       */
      { source: "/home-support", destination: "/services", permanent: true },
      { source: "/home-support/:path*", destination: "/services", permanent: true },
      { source: "/shower-studio", destination: "/kitchen-bathroom", permanent: true },
      { source: "/shower-studio/:path*", destination: "/kitchen-bathroom", permanent: true },
    ];
  },
};

export default nextConfig;
