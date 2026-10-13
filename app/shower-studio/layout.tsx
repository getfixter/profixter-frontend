import type { Metadata } from "next";
import { absoluteUrl, SITE_NAME } from "@/lib/seo";

/**
 * The public Shower Studio. NOT launched yet: kept out of search (noindex),
 * the sitemap and the site navigation until the owner approves going live.
 */
const TITLE = "Shower Studio: Design Your New Shower | Profixter";
const DESCRIPTION =
  "Upload a photo of your bathtub or shower, choose wall panels, bases, doors and accessories, see the new look and an estimated price, and request installation.";

export const metadata: Metadata = {
  title: { absolute: TITLE },
  description: DESCRIPTION,
  alternates: { canonical: "/shower-studio" },
  openGraph: { title: TITLE, description: DESCRIPTION, url: absoluteUrl("/shower-studio"), siteName: SITE_NAME, type: "website", locale: "en_US" },
  robots: { index: false, follow: false },
};

export default function ShowerStudioLayout({ children }: { children: React.ReactNode }) {
  return children;
}
