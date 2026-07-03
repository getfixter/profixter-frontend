import type { Metadata } from "next";
import { absoluteUrl } from "@/lib/seo";

const sidingImage = {
  url: "/images/projects/Siding%20Project.jpg",
  width: 1200,
  height: 630,
  alt: "Long Island siding project by Profixter",
};

export const metadata: Metadata = {
  title: {
    absolute: "Siding Replacement on Long Island | Profixter",
  },
  description:
    "Explore siding replacement for Long Island homes with custom exterior options, trim details, color planning, and a clear estimate path.",
  alternates: {
    canonical: "/renovations/siding",
  },
  openGraph: {
    title: "Siding Replacement on Long Island | Profixter",
    description:
      "Explore custom siding options, trim details, colors, and a clear estimate path for your Long Island home.",
    url: absoluteUrl("/renovations/siding"),
    siteName: "Profixter",
    type: "website",
    images: [sidingImage],
  },
  twitter: {
    card: "summary_large_image",
    title: "Siding Replacement on Long Island | Profixter",
    description:
      "Explore custom siding options, trim details, colors, and a clear estimate path.",
    images: [sidingImage.url],
  },
};

export default function SidingLayout({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}
