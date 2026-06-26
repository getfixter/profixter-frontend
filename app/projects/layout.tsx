import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "General Contractor Long Island | Roofing, Siding, Kitchen, Bathroom & New Builds",
  description:
    "Request a Long Island renovation estimate from Profixter for roofing, siding, kitchen remodeling, bathroom remodeling, full house renovation, and build new house projects.",
  alternates: {
    canonical: "/projects",
  },
  openGraph: {
    title: "Profixter Home Projects | General Contractor Long Island",
    description:
      "Roofing, siding, kitchen, bathroom, full house renovation, and new house project estimates for Long Island homeowners.",
    url: "https://www.profixter.com/projects",
    type: "website",
  },
  twitter: {
    card: "summary_large_image",
    title: "Profixter Home Projects | General Contractor Long Island",
    description:
      "Request an estimate for roofing, siding, kitchen, bathroom, full house renovation, and build new house projects.",
  },
};

export default function ProjectsLayout({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}
