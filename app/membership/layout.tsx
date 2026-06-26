import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Home Care Membership | Long Island Handyman Service",
  description:
    "Ongoing handyman membership for Long Island homeowners. One trusted, licensed team for regular maintenance, priority benefits, and practical home care. Licensed HI-71484.",
  alternates: {
    canonical: "/membership",
  },
  openGraph: {
    title: "Home Care Membership | Profixter Long Island",
    description:
      "One trusted team for ongoing Long Island home maintenance, practical repairs, and membership benefits.",
    url: "https://www.profixter.com/membership",
    type: "website",
  },
  twitter: {
    card: "summary_large_image",
    title: "Profixter Membership",
    description:
      "Ongoing home maintenance for Long Island homeowners with one trusted local team.",
  },
};

export default function MembershipLayout({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}
