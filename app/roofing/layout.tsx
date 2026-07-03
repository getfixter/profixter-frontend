import type { Metadata } from "next";
import { absoluteUrl } from "@/lib/seo";

const roofingImage = {
  url: "/images/projects/Roof%20Project.jpg",
  width: 1200,
  height: 630,
  alt: "Long Island roofing project by Profixter",
};

export const metadata: Metadata = {
  title: {
    absolute: "Roof Replacement on Long Island | Profixter",
  },
  description:
    "Need a new roof? Profixter helps Long Island homeowners plan roof replacement with clear scope, cleanup expectations, and estimate support.",
  alternates: {
    canonical: "/renovations/roofing",
  },
  openGraph: {
    title: "Roof Replacement on Long Island | Profixter",
    description:
      "Plan roof replacement with clear scope, cleanup expectations, and estimate support from Profixter.",
    url: absoluteUrl("/renovations/roofing"),
    siteName: "Profixter",
    type: "website",
    images: [roofingImage],
  },
  twitter: {
    card: "summary_large_image",
    title: "Roof Replacement on Long Island | Profixter",
    description:
      "Plan roof replacement with clear scope, cleanup expectations, and estimate support from Profixter.",
    images: [roofingImage.url],
  },
};

export default function RoofingLayout({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}
