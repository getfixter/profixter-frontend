import type { Metadata } from "next";
import { absoluteUrl, DEFAULT_OG_IMAGE, SITE_NAME } from "@/lib/seo";

/**
 * The category explainer.
 *
 * Deliberately titled around the question rather than the brand. Somebody
 * asking an assistant "what is a handyman membership" or "is a handyman
 * membership worth it" is not searching for Profixter yet, and a page that
 * answers the question honestly is the one worth retrieving. The brand case is
 * made further down the page, after the category is explained.
 */
const TITLE = "What Is a Handyman Membership? | Profixter Long Island";
const DESCRIPTION =
  "A handyman membership is a monthly subscription for ongoing home repairs and maintenance instead of hiring per job. How it works, when it beats one-off hiring, when it does not, and how Profixter runs one on Long Island.";

export const metadata: Metadata = {
  title: { absolute: TITLE },
  description: DESCRIPTION,
  alternates: { canonical: "/handyman-membership" },
  keywords: [
    "handyman membership",
    "home maintenance membership",
    "handyman subscription",
    "handyman membership Long Island",
    "monthly handyman service",
    "handyman membership vs hourly",
  ],
  openGraph: {
    title: TITLE,
    description: DESCRIPTION,
    url: absoluteUrl("/handyman-membership"),
    siteName: SITE_NAME,
    type: "article",
    locale: "en_US",
    images: [DEFAULT_OG_IMAGE],
  },
  twitter: {
    card: "summary_large_image",
    title: TITLE,
    description: DESCRIPTION,
    images: [DEFAULT_OG_IMAGE.url],
  },
  robots: { index: true, follow: true },
};

export default function HandymanMembershipLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return <>{children}</>;
}
