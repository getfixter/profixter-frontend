import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Profixter Larger Projects | Roofing, Siding, Remodeling & Renovations",
  description: "Request an estimate for roofing, siding, bathroom remodeling, kitchen remodeling, and larger home renovation projects on Long Island.",
  alternates: {
    canonical: "/projects",
  },
  openGraph: {
    title: "Profixter Larger Projects | Roofing, Siding, Remodeling & Renovations",
    description: "Request an estimate for roofing, siding, bathroom remodeling, kitchen remodeling, and larger home renovation projects on Long Island.",
    url: "https://www.profixter.com/projects",
    type: "website",
  },
  twitter: {
    card: "summary_large_image",
    title: "Profixter Home Projects",
    description: "Request an estimate for roofing, siding, remodeling, and larger Long Island home projects.",
  },
};

export default function ProjectsLayout({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}
