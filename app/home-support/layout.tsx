import type { Metadata } from "next";

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
    url: "https://www.profixter.com/home-support",
    type: "website",
  },
  twitter: {
    card: "summary_large_image",
    title: "Profixter AI | Your Personal AI for Home Questions",
    description:
      "A free homeowner AI assistant for photos, PDFs, quotes, maintenance questions, safety checks, and practical next steps before you hire anyone.",
  },
};

export default function HomeSupportLayout({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}
