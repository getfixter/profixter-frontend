import type { Metadata } from "next";
import { absoluteUrl } from "@/lib/seo";

const kitchenImage = {
  url: "/images/projects/Kitchen%20Project.jpg",
  width: 1200,
  height: 630,
  alt: "Long Island kitchen remodeling project by Profixter",
};

export const metadata: Metadata = {
  title: {
    absolute: "Kitchen Remodeling on Long Island | Profixter",
  },
  description:
    "Plan a Long Island kitchen remodel with a clear estimate path for layout, cabinets, counters, backsplash, lighting, and coordination.",
  alternates: {
    canonical: "/renovations/kitchen-remodeling",
  },
  openGraph: {
    title: "Kitchen Remodeling on Long Island | Profixter",
    description:
      "Plan layout, cabinets, counters, backsplash, lighting, and project coordination before demolition starts.",
    url: absoluteUrl("/renovations/kitchen-remodeling"),
    siteName: "Profixter",
    type: "website",
    images: [kitchenImage],
  },
  twitter: {
    card: "summary_large_image",
    title: "Kitchen Remodeling on Long Island | Profixter",
    description:
      "Plan layout, cabinets, counters, backsplash, lighting, and project coordination.",
    images: [kitchenImage.url],
  },
};

export default function KitchenLayout({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}
