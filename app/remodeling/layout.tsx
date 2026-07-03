import type { Metadata } from "next";
import { absoluteUrl } from "@/lib/seo";

const bathroomImage = {
  url: "/images/projects/Bathroom%20Project.jpg",
  width: 1200,
  height: 630,
  alt: "Long Island bathroom remodeling project by Profixter",
};

export const metadata: Metadata = {
  title: "Bathroom Remodeling Long Island | Profixter",
  description:
    "Complete bathroom remodeling for Long Island homeowners, including tile, shower, vanity, fixtures, waterproofing details, and project coordination.",
  alternates: {
    canonical: "/renovations/bathroom-remodeling",
  },
  openGraph: {
    title: "Bathroom Remodeling Long Island | Profixter",
    description:
      "Complete bathroom renovation planning and project coordination for Long Island homeowners.",
    url: absoluteUrl("/renovations/bathroom-remodeling"),
    siteName: "Profixter",
    type: "website",
    images: [bathroomImage],
  },
  twitter: {
    card: "summary_large_image",
    title: "Bathroom Remodeling Long Island | Profixter",
    description:
      "Complete bathroom renovation planning and project coordination for Long Island homeowners.",
    images: [bathroomImage.url],
  },
};

export default function RemodelingLayout({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}
