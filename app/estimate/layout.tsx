import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Larger Project Estimate | Long Island | Profixter",
  description: "Request an estimate for roofing, siding, bathroom or kitchen remodeling, basement finishing, and interior renovations. Licensed and insured in Nassau and Suffolk Counties.",
  openGraph: {
    title: "Larger Project Estimate | Profixter Long Island",
    description: "Tell us what you are planning. Profixter reviews larger projects across Nassau and Suffolk Counties.",
    type: "website",
  },
};

export default function EstimateLayout({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}
