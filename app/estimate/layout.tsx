import type { Metadata } from "next";
import { absoluteUrl, DEFAULT_OG_IMAGE } from "@/lib/seo";

export const metadata: Metadata = {
  title: "Larger Project Estimate | Long Island | Profixter",
  description:
    "Request an estimate for roofing, siding, bathroom remodeling, kitchen remodeling, full house renovation, build new house projects, and other larger work on Long Island.",
  alternates: {
    canonical: "/projects",
  },
  openGraph: {
    title: "Larger Project Estimate | Profixter Long Island",
    description:
      "Tell us what you are planning. Profixter reviews roofing, siding, kitchen, bathroom, full renovation, and new house projects across Nassau and Suffolk Counties.",
    url: absoluteUrl("/projects"),
    siteName: "Profixter",
    type: "website",
    images: [DEFAULT_OG_IMAGE],
  },
  twitter: {
    card: "summary_large_image",
    title: "Larger Project Estimate | Profixter Long Island",
    description:
      "Request an estimate for roofing, siding, kitchen, bathroom, full renovation, and new house projects across Nassau and Suffolk Counties.",
    images: [DEFAULT_OG_IMAGE.url],
  },
};

export default function EstimateLayout({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}
