import type { Metadata } from "next";
import { absoluteUrl, DEFAULT_OG_IMAGE } from "@/lib/seo";

export const metadata: Metadata = {
  title: {
    absolute: "Profixter Membership | Home Maintenance on Long Island",
  },
  description:
    "Stop chasing handymen. Become a Member for ongoing Long Island home maintenance, small repairs, priority benefits, and better value over time.",
  alternates: {
    canonical: "/membership",
  },
  openGraph: {
    title: "Profixter Membership | Home Maintenance on Long Island",
    description:
      "Ongoing home maintenance support for Long Island homeowners who want one trusted team for small repairs and practical home care.",
    url: absoluteUrl("/membership"),
    type: "website",
    images: [DEFAULT_OG_IMAGE],
  },
  twitter: {
    card: "summary_large_image",
    title: "Profixter Membership | Home Maintenance on Long Island",
    description:
      "Become a Member for ongoing home maintenance, small repairs, priority benefits, and better value over time.",
    images: [DEFAULT_OG_IMAGE.url],
  },
};

export default function MembershipLayout({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}
