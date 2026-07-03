import type { Metadata } from "next";
import { absoluteUrl, DEFAULT_OG_IMAGE } from "@/lib/seo";

export const metadata: Metadata = {
  title: "Profixter AI | Your Personal AI for Home Questions",
  description:
    "Your personal AI for home questions. Upload photos, PDFs, contractor quotes, and agreements; ask repair, maintenance, safety, material, and DIY-or-hire questions.",
  alternates: {
    canonical: "/home-support",
  },
  openGraph: {
    title: "Profixter AI | Your Personal AI for Home Questions",
    description:
      "A free homeowner AI assistant for photos, PDFs, quotes, maintenance questions, safety checks, and practical next steps before you hire anyone.",
    url: absoluteUrl("/home-support"),
    type: "website",
    images: [DEFAULT_OG_IMAGE],
  },
  twitter: {
    card: "summary_large_image",
    title: "Profixter AI | Your Personal AI for Home Questions",
    description:
      "A free homeowner AI assistant for photos, PDFs, quotes, maintenance questions, safety checks, and practical next steps before you hire anyone.",
    images: [DEFAULT_OG_IMAGE.url],
  },
};

export default function HomeSupportLayout({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}
