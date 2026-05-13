import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "One Roof For Life | Roof Replacement Long Island | Profixter",
  description: "Premium roof replacement for Long Island homeowners. Stop paying for temporary repairs — 50-year warranty options, financing available, licensed HI-71484, fully insured. Free estimate. Nassau & Suffolk County.",
  openGraph: {
    title: "One Roof For Life | Roof Replacement Long Island | Profixter",
    description: "50-year warranty options. Financing available. Licensed HI-71484, fully insured. Local Long Island team. Free estimate — no commitment.",
    type: "website",
  },
};

export default function RoofingLayout({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}
