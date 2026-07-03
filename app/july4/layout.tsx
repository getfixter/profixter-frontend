import type { Metadata } from "next";
import { absoluteUrl, DEFAULT_OG_IMAGE } from "@/lib/seo";

export const metadata: Metadata = {
  title: {
    absolute: "Long Island Home Maintenance Offer | Profixter Basic",
  },
  description:
    "A simpler way to handle the home to-do list. Join Profixter Basic for ongoing maintenance support from a local Long Island team.",
  alternates: {
    canonical: "/july4",
  },
  openGraph: {
    title: "Long Island Home Maintenance Offer | Profixter Basic",
    description:
      "Profixter Basic gives Long Island homeowners a simpler way to keep up with small home maintenance tasks.",
    url: absoluteUrl("/july4"),
    siteName: "Profixter",
    type: "website",
    images: [DEFAULT_OG_IMAGE],
  },
  twitter: {
    card: "summary_large_image",
    title: "Long Island Home Maintenance Offer | Profixter Basic",
    description:
      "Join Profixter Basic for recurring home maintenance support from a local Long Island team.",
    images: [DEFAULT_OG_IMAGE.url],
  },
};

export default function July4Layout({ children }: { children: React.ReactNode }) {
  return children;
}
