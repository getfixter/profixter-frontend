import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "1-Day Roof Replacement | Licensed Long Island Roofing Contractor | Profixter",
  description: "Professional roof replacement on Long Island — most jobs started and finished the same day. Licensed NY State Contractor HI-71484, fully insured. Free on-site estimate. No surprises. Nassau & Suffolk County.",
  openGraph: {
    title: "1-Day Roof Replacement | Long Island | Profixter",
    description: "Most roofs started and finished the same day. Licensed HI-71484, fully insured. Free on-site estimate. Nassau & Suffolk County.",
    type: "website",
  },
};

export default function RoofingLayout({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}
