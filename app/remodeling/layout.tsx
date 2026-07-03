import type { Metadata } from "next";
import { absoluteUrl } from "@/lib/seo";

const bathroomImage = {
  url: "/images/projects/Bathroom%20Project.jpg",
  width: 1200,
  height: 630,
  alt: "Long Island bathroom remodeling project by Profixter",
};

export const metadata: Metadata = {
  title: {
    absolute: "Bathroom Remodeling on Long Island | Profixter",
  },
  description:
    "Plan a Long Island bathroom remodel with a clear estimate path for tile, shower, vanity, fixtures, waterproofing, and project coordination.",
  alternates: {
    canonical: "/renovations/bathroom-remodeling",
  },
  openGraph: {
    title: "Bathroom Remodeling on Long Island | Profixter",
    description:
      "Plan tile, shower, vanity, fixtures, waterproofing, and project coordination before the work starts.",
    url: absoluteUrl("/renovations/bathroom-remodeling"),
    siteName: "Profixter",
    type: "website",
    images: [bathroomImage],
  },
  twitter: {
    card: "summary_large_image",
    title: "Bathroom Remodeling on Long Island | Profixter",
    description:
      "Plan tile, shower, vanity, fixtures, waterproofing, and project coordination.",
    images: [bathroomImage.url],
  },
};

export default function RemodelingLayout({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}
