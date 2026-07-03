import type { Metadata } from "next";
import { absoluteUrl, DEFAULT_OG_IMAGE } from "@/lib/seo";

export const metadata: Metadata = {
  title: {
    absolute: "Request a Renovation Estimate on Long Island | Profixter",
  },
  description:
    "Tell Profixter about your roofing, siding, kitchen, bathroom, full-home renovation, or new construction project and get the right next step.",
  alternates: {
    canonical: "/projects",
  },
  openGraph: {
    title: "Request a Renovation Estimate on Long Island | Profixter",
    description:
      "Tell us what you are planning. Profixter reviews roofing, siding, kitchen, bathroom, full renovation, and new house projects across Nassau and Suffolk Counties.",
    url: absoluteUrl("/projects"),
    siteName: "Profixter",
    type: "website",
    images: [DEFAULT_OG_IMAGE],
  },
  twitter: {
    card: "summary_large_image",
    title: "Request a Renovation Estimate on Long Island | Profixter",
    description:
      "Tell Profixter about your larger home project and get the right next step.",
    images: [DEFAULT_OG_IMAGE.url],
  },
};

export default function EstimateLayout({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}
