import type { Metadata } from "next";
import { absoluteUrl, DEFAULT_OG_IMAGE } from "@/lib/seo";

export const metadata: Metadata = {
  title: "Profixter for Communities | HOA, Condo & 55+ Home Maintenance Partner",
  description:
    "Partner with Profixter to offer Long Island residents a trusted home maintenance and handyman resource for everyday repairs, small projects, and ongoing support.",
  alternates: {
    canonical: "/communities",
  },
  keywords: [
    "HOA handyman partner Long Island",
    "condo association maintenance partner",
    "55+ community home maintenance",
    "Long Island property management handyman",
    "community home maintenance partner",
  ],
  openGraph: {
    title: "Profixter for Communities | HOA, Condo & 55+ Home Maintenance Partner",
    description:
      "Partner with Profixter to offer Long Island residents a trusted home maintenance and handyman resource for everyday repairs, small projects, and ongoing support.",
    url: absoluteUrl("/communities"),
    siteName: "Profixter",
    type: "website",
    images: [DEFAULT_OG_IMAGE],
  },
  twitter: {
    card: "summary_large_image",
    title: "Profixter for Communities | HOA, Condo & 55+ Home Maintenance Partner",
    description:
      "A trusted Long Island home maintenance and handyman resource for HOA, condo, 55+, and residential communities.",
    images: [DEFAULT_OG_IMAGE.url],
  },
};

export default function CommunitiesLayout({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}
