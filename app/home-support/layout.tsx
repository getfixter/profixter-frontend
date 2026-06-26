import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Home Support AI",
  description:
    "Free AI assistant for homeowners. Upload photos, PDFs, contractor quotes, and agreements; ask repair, maintenance, safety, material, and DIY-or-hire questions.",
  alternates: {
    canonical: "/home-support",
  },
  openGraph: {
    title: "Profixter Home Support AI",
    description:
      "A free homeowner AI assistant for photos, PDFs, quotes, maintenance questions, safety checks, and practical next steps.",
    url: "https://www.profixter.com/home-support",
    type: "website",
  },
  twitter: {
    card: "summary_large_image",
    title: "Profixter Home Support AI",
    description:
      "A free homeowner AI assistant for photos, PDFs, quotes, maintenance questions, safety checks, and practical next steps.",
  },
};

export default function HomeSupportLayout({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}
