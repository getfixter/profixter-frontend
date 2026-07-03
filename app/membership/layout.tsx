import type { Metadata } from "next";
import { absoluteUrl, DEFAULT_OG_IMAGE } from "@/lib/seo";

export const metadata: Metadata = {
  title: "Membership | Long Island Home Maintenance",
  description:
    "Become a Profixter Member for ongoing Long Island home maintenance, handyman help, priority benefits, and better long-term value than repeated one-time visits.",
  alternates: {
    canonical: "/membership",
  },
  openGraph: {
    title: "Profixter Membership | Long Island Home Maintenance",
    description:
      "Ongoing home maintenance support for Long Island homeowners who want one trusted team for small repairs and practical home care.",
    url: absoluteUrl("/membership"),
    type: "website",
    images: [DEFAULT_OG_IMAGE],
  },
  twitter: {
    card: "summary_large_image",
    title: "Profixter Membership | Long Island Home Maintenance",
    description:
      "Become a Member for ongoing Long Island home maintenance, handyman help, and better long-term value.",
    images: [DEFAULT_OG_IMAGE.url],
  },
};

export default function MembershipLayout({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}
