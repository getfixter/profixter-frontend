import type { Metadata } from "next";
import { absoluteUrl } from "@/lib/seo";

const kitchenImage = {
  url: "/images/projects/Kitchen%20Project.jpg",
  width: 1200,
  height: 630,
  alt: "Long Island kitchen remodeling project by Profixter",
};

export const metadata: Metadata = {
  title: "Kitchen Remodeling Long Island | Profixter",
  description:
    "Complete kitchen remodeling for Long Island homeowners, including layout planning, cabinetry, counters, backsplash, lighting, and project coordination.",
  alternates: {
    canonical: "/renovations/kitchen-remodeling",
  },
  openGraph: {
    title: "Kitchen Remodeling Long Island | Profixter",
    description:
      "Complete kitchen renovation planning and project coordination for Long Island homeowners.",
    url: absoluteUrl("/renovations/kitchen-remodeling"),
    siteName: "Profixter",
    type: "website",
    images: [kitchenImage],
  },
  twitter: {
    card: "summary_large_image",
    title: "Kitchen Remodeling Long Island | Profixter",
    description:
      "Complete kitchen renovation planning and project coordination for Long Island homeowners.",
    images: [kitchenImage.url],
  },
};

export default function KitchenLayout({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}
