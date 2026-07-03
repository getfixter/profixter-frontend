import type { Metadata } from "next";
import { absoluteUrl, DEFAULT_OG_IMAGE } from "@/lib/seo";

export const metadata: Metadata = {
  title: {
    absolute: "Home Maintenance Partner for HOAs & Communities | Profixter",
  },
  description:
    "Give residents one trusted Long Island resource for maintenance help, handyman visits, and larger project coordination through Profixter.",
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
    title: "Home Maintenance Partner for HOAs & Communities | Profixter",
    description:
      "A modern home maintenance partner for HOAs, condos, 55+ communities, and property teams on Long Island.",
    url: absoluteUrl("/communities"),
    siteName: "Profixter",
    type: "website",
    images: [DEFAULT_OG_IMAGE],
  },
  twitter: {
    card: "summary_large_image",
    title: "Home Maintenance Partner for HOAs & Communities | Profixter",
    description:
      "Give residents one trusted Long Island resource for maintenance, handyman visits, and project coordination.",
    images: [DEFAULT_OG_IMAGE.url],
  },
};

export default function CommunitiesLayout({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}
