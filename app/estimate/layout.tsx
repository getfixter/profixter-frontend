import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Larger Project Estimate | Long Island | Profixter",
  description:
    "Request an estimate for roofing, siding, bathroom remodeling, kitchen remodeling, full house renovation, build new house projects, and other larger work on Long Island.",
  openGraph: {
    title: "Larger Project Estimate | Profixter Long Island",
    description:
      "Tell us what you are planning. Profixter reviews roofing, siding, kitchen, bathroom, full renovation, and new house projects across Nassau and Suffolk Counties.",
    type: "website",
  },
};

export default function EstimateLayout({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}
