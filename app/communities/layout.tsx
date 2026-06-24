import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Profixter for Communities | HOA, Condo & 55+ Home Maintenance Partner",
  description:
    "Partner with Profixter to offer Long Island residents a trusted home maintenance and handyman resource for everyday repairs, small projects, and ongoing support.",
  alternates: {
    canonical: "https://www.profixter.com/communities",
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
    url: "https://www.profixter.com/communities",
    siteName: "Profixter",
    type: "website",
  },
  twitter: {
    card: "summary_large_image",
    title: "Profixter for Communities | HOA, Condo & 55+ Home Maintenance Partner",
    description:
      "A trusted Long Island home maintenance and handyman resource for HOA, condo, 55+, and residential communities.",
  },
};

export default function CommunitiesLayout({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}
