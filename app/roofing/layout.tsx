import type { Metadata } from "next";
import { absoluteUrl } from "@/lib/seo";

const roofingImage = {
  url: "/images/projects/Roof%20Project.jpg",
  width: 1200,
  height: 630,
  alt: "Long Island roofing project by Profixter",
};

export const metadata: Metadata = {
  title: "Roof Replacement Long Island | Profixter",
  description:
    "Roof replacement planning for Long Island homeowners with clear estimate support, project coordination, and service across Nassau and Suffolk County.",
  alternates: {
    canonical: "/renovations/roofing",
  },
  openGraph: {
    title: "Roof Replacement Long Island | Profixter",
    description:
      "Premium roof replacement for Long Island homeowners with local licensed project support.",
    url: absoluteUrl("/renovations/roofing"),
    siteName: "Profixter",
    type: "website",
    images: [roofingImage],
  },
  twitter: {
    card: "summary_large_image",
    title: "Roof Replacement Long Island | Profixter",
    description:
      "Premium roof replacement for Long Island homeowners with local licensed project support.",
    images: [roofingImage.url],
  },
};

export default function RoofingLayout({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}
