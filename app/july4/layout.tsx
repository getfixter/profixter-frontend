import type { Metadata } from "next";
import { absoluteUrl, DEFAULT_OG_IMAGE } from "@/lib/seo";

export const metadata: Metadata = {
  title: "One Less Thing to Worry About | Profixter Basic",
  description:
    "Reliable local handyman help for Babylon-area homeowners. Try Profixter Basic free for your first month with JULY4, then $149/month. Cancel anytime.",
  alternates: {
    canonical: "/july4",
  },
  openGraph: {
    title: "One Trusted Solution for Your Home To-Do List",
    description:
      "Stop chasing contractors for every small job. Try Profixter Basic free for your first month with JULY4.",
    url: absoluteUrl("/july4"),
    siteName: "Profixter",
    type: "website",
    images: [DEFAULT_OG_IMAGE],
  },
  twitter: {
    card: "summary_large_image",
    title: "One Trusted Solution for Your Home To-Do List",
    description:
      "Stop chasing contractors for every small job. Try Profixter Basic free for your first month with JULY4.",
    images: [DEFAULT_OG_IMAGE.url],
  },
};

export default function July4Layout({ children }: { children: React.ReactNode }) {
  return children;
}
