import type { Metadata } from "next";
import { absoluteUrl, DEFAULT_OG_IMAGE } from "@/lib/seo";

export const metadata: Metadata = {
  title: {
    absolute: "Profixter AI | Home Repair Questions, Photos & Quotes",
  },
  description:
    "Ask a free home AI about repairs, maintenance, safety, materials, contractor quotes, or renovation questions before you hire anyone.",
  alternates: {
    canonical: "/home-support",
  },
  openGraph: {
    title: "Profixter AI | Home Repair Questions, Photos & Quotes",
    description:
      "Upload photos, PDFs, quotes, or agreements and get practical home guidance before you hire anyone.",
    url: absoluteUrl("/home-support"),
    type: "website",
    images: [DEFAULT_OG_IMAGE],
  },
  twitter: {
    card: "summary_large_image",
    title: "Profixter AI | Home Repair Questions, Photos & Quotes",
    description:
      "Ask a free home AI about repairs, maintenance, safety, materials, quotes, and DIY-or-hire decisions.",
    images: [DEFAULT_OG_IMAGE.url],
  },
};

export default function HomeSupportLayout({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}
