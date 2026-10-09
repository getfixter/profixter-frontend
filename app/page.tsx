import type { Metadata } from "next";
import HomePageClient from "@/app/components/home/HomePageClient";
import { absoluteUrl, DEFAULT_OG_IMAGE, SITE_NAME } from "@/lib/seo";

/**
 * The homepage's own canonical and its search snippet.
 *
 * The root layout used to declare `canonical: "/"`, which every page without
 * metadata of its own inherited - so /gift, /signup and any page added later
 * quietly asked search engines to treat it as a copy of the homepage. The
 * layout no longer sets one; the homepage says it here, for itself only.
 *
 * TITLE. The homepage is where the Google Business Profile's website link
 * lands, so it is the page Google weighs for ordinary "handyman" searches near
 * Lindenhurst. It used to be titled only for the membership ("Handyman
 * Membership for Long Island Homes"), which describes the product nobody has
 * heard of yet and undersells the plain answer to "I need a handyman". The
 * title now leads with that and keeps the membership beside it. Every fact in
 * the description is published elsewhere on the site and verified: free first
 * 90-minute visit (new customers, one per home), $99 One-Time Visit, plans from
 * $149 a month, Nassau and Suffolk.
 *
 * The page body is unchanged and still a client component.
 */
const TITLE = "Long Island Handyman & Handyman Membership | Profixter";
const DESCRIPTION =
  "A Long Island handyman for the small jobs around your home, from a local team in Lindenhurst. New Nassau and Suffolk customers get a free first 90-minute visit; after that, $99 One-Time Visits or a handyman membership from $149/month.";

export const metadata: Metadata = {
  title: { absolute: TITLE },
  description: DESCRIPTION,
  alternates: { canonical: "/" },
  openGraph: {
    title: TITLE,
    description: DESCRIPTION,
    url: absoluteUrl("/"),
    siteName: SITE_NAME,
    type: "website",
    locale: "en_US",
    images: [DEFAULT_OG_IMAGE],
  },
  twitter: {
    card: "summary_large_image",
    title: TITLE,
    description: DESCRIPTION,
    images: [DEFAULT_OG_IMAGE.url],
  },
  /* Gridinsoft domain-ownership check; it only looks at the homepage. */
  other: {
    "gridinsoft-key":
      "y6sco6rdbtvl1pk3f4gtfitfqd5ovg3o57dhag4ludnhixov36qy0d1l2g3joz6f",
  },
};

export default function HomePage() {
  return <HomePageClient />;
}
