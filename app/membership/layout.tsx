import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Home Care Membership | Long Island Handyman Service | Profixter",
  description: "Monthly handyman membership for Long Island homeowners. One trusted, licensed team — same professionals every visit. Regular maintenance, priority scheduling, no per-task estimates. From $149/mo. Licensed HI-71484. Nassau & Suffolk County.",
  openGraph: {
    title: "Home Care Membership | Profixter Long Island",
    description: "One trusted team. Regular monthly maintenance. No estimates, no surprises — from $149/mo. Licensed HI-71484. Serving Long Island homeowners.",
    type: "website",
  },
};

export default function MembershipLayout({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}
