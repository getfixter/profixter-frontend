import type { Metadata } from "next";
import { absoluteUrl, SITE_NAME } from "@/lib/seo";

/**
 * The landing page for paid search on kitchen and bathroom terms.
 *
 * One canonical URL, /kitchen-bathroom, and it is the same URL the ads point
 * at - no tracking variant, no duplicate under /renovations. The title carries
 * "Remodeling" and the H1 carries "Renovations" because homeowners search both
 * and there is no reason to pick one and lose the other.
 */
const OG_IMAGE = {
  url: "/images/kitchen-bath/og.jpg",
  width: 1200,
  height: 630,
  alt: "Renovated bathroom by Profixter with a freestanding tub, tiled walk-in shower and white shiplap walls.",
};

const TITLE = "Kitchen & Bathroom Remodeling in the Hamptons | Profixter";
const DESCRIPTION =
  "Profixter renovates kitchens and bathrooms across the Hamptons and Long Island. See real completed projects, then request an estimate. Licensed HI-71484, fully insured.";

export const metadata: Metadata = {
  title: { absolute: TITLE },
  description: DESCRIPTION,
  alternates: {
    canonical: "/kitchen-bathroom",
  },
  keywords: [
    "kitchen renovation Hamptons",
    "bathroom renovation Hamptons",
    "kitchen remodeling Long Island",
    "bathroom remodeling Long Island",
    "kitchen and bathroom contractor",
    "shower renovation Long Island",
    "Southampton kitchen remodel",
    "East Hampton bathroom remodel",
  ],
  openGraph: {
    title: TITLE,
    description: DESCRIPTION,
    url: absoluteUrl("/kitchen-bathroom"),
    siteName: SITE_NAME,
    type: "website",
    locale: "en_US",
    images: [OG_IMAGE],
  },
  twitter: {
    card: "summary_large_image",
    title: TITLE,
    description: DESCRIPTION,
    images: [OG_IMAGE.url],
  },
  robots: {
    index: true,
    follow: true,
  },
};

export default function KitchenBathroomLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return <>{children}</>;
}
