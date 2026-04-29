import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Home Improvement Projects | Roofing, Bathroom & Kitchen Remodeling | Profixter",
  description: "Licensed home improvement contractor on Long Island. 1-Day roof replacement, full bathroom remodeling, and complete kitchen renovation. Free on-site estimate. Licensed HI-71484, fully insured. Nassau & Suffolk County.",
  openGraph: {
    title: "Home Improvement Projects | Profixter Long Island",
    description: "Roofing, bathroom, and kitchen remodeling by Long Island's licensed contractor. Free estimate. Licensed HI-71484, fully insured.",
    type: "website",
  },
};

export default function ProjectsLayout({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}
