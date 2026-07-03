import type { Metadata } from "next";
import { absoluteUrl } from "@/lib/seo";

const sidingImage = {
  url: "/images/projects/Siding%20Project.jpg",
  width: 1200,
  height: 630,
  alt: "Long Island siding project by Profixter",
};

export const metadata: Metadata = {
  title: "Siding Replacement Long Island | Profixter",
  description:
    "Premium siding replacement for Long Island homeowners with custom exterior options, local project support, and service across Nassau and Suffolk County.",
  alternates: {
    canonical: "/renovations/siding",
  },
  openGraph: {
    title: "Siding Replacement Long Island | Profixter",
    description:
      "Premium siding replacement for Long Island homeowners with custom exterior options and licensed project support.",
    url: absoluteUrl("/renovations/siding"),
    siteName: "Profixter",
    type: "website",
    images: [sidingImage],
  },
  twitter: {
    card: "summary_large_image",
    title: "Siding Replacement Long Island | Profixter",
    description:
      "Premium siding replacement for Long Island homeowners with custom exterior options.",
    images: [sidingImage.url],
  },
};

export default function SidingLayout({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}
