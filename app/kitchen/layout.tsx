import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Full Kitchen Remodeling | Long Island Licensed Contractor | Profixter",
  description: "Complete kitchen renovation on Long Island — custom cabinetry, countertops, and layout changes from start to finish. Free in-home consultation and written estimate. Licensed HI-71484, fully insured. Nassau & Suffolk County.",
  openGraph: {
    title: "Full Kitchen Remodeling | Long Island | Profixter",
    description: "Complete kitchen renovation by Long Island's licensed contractor. Custom cabinetry, countertops, layout — start to finish. Free consultation. Licensed HI-71484.",
    type: "website",
  },
};

export default function KitchenLayout({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}
