import type { Metadata } from "next";
import { plans } from "@/app/data/content";
import { absoluteUrl, DEFAULT_OG_IMAGE, SITE_NAME } from "@/lib/seo";

/**
 * The prices page speaks for itself.
 *
 * It used to inherit /membership's layout metadata, because the page is a client
 * component and cannot export its own - so it shipped /membership's title and
 * description and a canonical pointing at /membership. In other words it told
 * every search engine that the one page carrying all four prices was a copy of
 * a teaser page, and asked to be dropped in its favour.
 *
 * /membership is the member's own destination (it becomes the dashboard after
 * joining); this is the comparison. They are different pages with different
 * jobs, so each now says so.
 */
const lowest = Math.min(...plans.map((plan) => plan.price));
const highest = Math.max(...plans.map((plan) => plan.price));

const TITLE = "Handyman Membership Plans & Prices | Profixter Long Island";
const DESCRIPTION = `Compare Profixter's four handyman membership plans, from $${lowest} to $${highest} a month or 12 months for the price of 10. 90-minute visits, the same local team, Priority Visits and project time. Nassau and Suffolk.`;

export const metadata: Metadata = {
  title: { absolute: TITLE },
  description: DESCRIPTION,
  alternates: { canonical: "/membership/plans" },
  openGraph: {
    title: TITLE,
    description: DESCRIPTION,
    url: absoluteUrl("/membership/plans"),
    siteName: SITE_NAME,
    type: "website",
    images: [DEFAULT_OG_IMAGE],
  },
  twitter: {
    card: "summary_large_image",
    title: TITLE,
    description: DESCRIPTION,
    images: [DEFAULT_OG_IMAGE.url],
  },
};

export default function MembershipPlansLayout({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}
