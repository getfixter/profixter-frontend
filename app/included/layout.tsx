import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "What's Included in Your Membership | Profixter Long Island",
  description:
    "See every task covered by your Profixter home care membership — from leaky faucets and door adjustments to caulking, minor electrical, and seasonal prep. Nassau & Suffolk County. Licensed HI-71484.",
  openGraph: {
    title: "What's Included | Profixter Home Care Membership",
    description:
      "Full list of tasks covered under your monthly membership. No estimates, no per-visit surprises. Long Island's licensed handyman team.",
    type: "website",
  },
};

export default function IncludedLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return <>{children}</>;
}
