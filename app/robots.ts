import type { MetadataRoute } from "next";
import { absoluteUrl } from "@/lib/seo";

export default function robots(): MetadataRoute.Robots {
  return {
    rules: {
      userAgent: "*",
      allow: "/",
      disallow: [
        "/admin",
        "/account",
        "/api",
        "/login",
        "/register",
        "/signin",
        /*
         * /signup is deliberately NOT disallowed.
         *
         * It is the one page where ProFixter collects SMS consent, and an A2P
         * reviewer - human or automated - has to be able to fetch it to verify
         * that the two SMS checkboxes are optional and unchecked. Disallow does
         * not merely de-index: it tells a crawler not to request the page at
         * all, so a vetting crawler sent to verify the opt-in flow would have
         * received nothing. That is a rejection waiting to happen.
         *
         * Nothing private is exposed by allowing it. The page is a blank
         * registration form; /account and /admin stay disallowed below, and the
         * signed-in surfaces they cover are where actual customer data lives.
         */
        "/forgot-password",
        "/book/confirmation",
        "/confirmationpage",
        "/review",
        "/tip",
        "/exterior-preview",
        "/faq-preview",
        "/home-ending-preview",
        "/included-visits-preview",
      ],
    },
    sitemap: absoluteUrl("/sitemap.xml"),
  };
}
