import type { MetadataRoute } from "next";
import { absoluteUrl } from "@/lib/seo";

/**
 * What crawlers may fetch.
 *
 * WHAT IS DELIBERATELY *NOT* BLOCKED.
 *
 * /signin, /account and /forgot-password carry `noindex, nofollow` in their own
 * layout, and Disallow was fighting it. Disallow does not de-index: it says do
 * not FETCH, so Google never read the noindex and could still list a bare URL
 * it found linked from the header of every page on the site - while reporting
 * the whole set as "Blocked by robots.txt". Letting the crawler in is what lets
 * noindex do its job. Nothing private is exposed by that: these pages render a
 * form, and the signed-in surfaces behind them are protected by a session, not
 * by a robots rule.
 *
 * /signup is likewise open, and is in the sitemap. It is the one page where SMS
 * consent is collected, so an A2P reviewer - human or automated - has to be
 * able to fetch it and see that the two SMS checkboxes are optional and
 * unchecked. A disallowed page hands a vetting crawler nothing, which is a
 * rejection waiting to happen.
 *
 * GONE: /login and the four *-preview routes, every one of which now returns
 * 404. A rule for a page that does not exist tells a crawler nothing and only
 * makes the real rules harder to read.
 *
 * WHAT STAYS BLOCKED. /admin (which covers /admin/lab) and /api are where real
 * customer data lives. /register is a legacy redirect into /signup, which is
 * itself crawlable, so nothing is lost. The confirmation, review and tip routes
 * are one-shot transactional pages reached from an email or an SMS; they are
 * not search results and are not meant to be.
 */
export default function robots(): MetadataRoute.Robots {
  return {
    rules: {
      userAgent: "*",
      allow: "/",
      disallow: [
        "/admin",
        "/api",
        "/register",
        "/book/confirmation",
        "/confirmationpage",
        "/review",
        "/tip",
      ],
    },
    sitemap: absoluteUrl("/sitemap.xml"),
  };
}
