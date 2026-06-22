import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Profixter Larger Projects | Roofing, Siding, Remodeling & Renovations",
  description: "Request an estimate for roofing, siding, bathroom remodeling, kitchen remodeling, and larger home renovation projects on Long Island.",
  openGraph: {
    title: "Profixter Larger Projects | Roofing, Siding, Remodeling & Renovations",
    description: "Request an estimate for roofing, siding, bathroom remodeling, kitchen remodeling, and larger home renovation projects on Long Island.",
    type: "website",
  },
};

export default function ProjectsLayout({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}
