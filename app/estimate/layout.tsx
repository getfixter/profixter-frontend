import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Free Home Improvement Estimate | Long Island | Profixter",
  description: "Get a free estimate for roofing, bathroom remodeling, or kitchen renovation on Long Island. Licensed HI-71484, fully insured. No obligation. Nassau & Suffolk County.",
  openGraph: {
    title: "Free Home Improvement Estimate | Profixter Long Island",
    description: "Free estimate for roofing, bathroom, or kitchen renovation. Licensed HI-71484, fully insured. No obligation. Long Island.",
    type: "website",
  },
};

export default function EstimateLayout({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}
