import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Profixter for Communities | HOA, Condo & 55+ Home Maintenance Partner",
  description:
    "Partner with Profixter to offer Long Island residents a trusted home maintenance and handyman resource for everyday repairs, small projects, and ongoing support.",
  openGraph: {
    title: "Profixter for Communities | HOA, Condo & 55+ Home Maintenance Partner",
    description:
      "Partner with Profixter to offer Long Island residents a trusted home maintenance and handyman resource for everyday repairs, small projects, and ongoing support.",
    url: "https://www.profixter.com/communities",
    siteName: "Profixter",
    type: "website",
  },
};

export default function CommunitiesLayout({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}
