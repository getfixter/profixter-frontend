import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Full Bathroom Remodeling | Long Island Licensed Contractor | Profixter",
  description: "Complete bathroom remodeling on Long Island — custom tile, fixtures, vanity, and plumbing from start to finish. Free in-home consultation and written estimate. Licensed HI-71484, fully insured. Nassau & Suffolk County.",
  openGraph: {
    title: "Full Bathroom Remodeling | Long Island | Profixter",
    description: "Complete bathroom renovation by Long Island's licensed contractor. Custom tile, fixtures, plumbing — start to finish. Free consultation. Licensed HI-71484.",
    type: "website",
  },
};

export default function RemodelingLayout({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}
