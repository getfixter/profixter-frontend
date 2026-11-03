import type { Metadata } from "next";
import { absoluteUrl, DEFAULT_OG_IMAGE } from "@/lib/seo";

export const metadata: Metadata = {
  title: {
    absolute: "Profixter Membership | Home Maintenance on Long Island",
  },
  description:
    "A monthly handyman membership for Long Island homeowners. Book small repairs, maintenance, and installations with one trusted Profixter team.",
  /*
   * /membership/plans is the page for "handyman membership" with the plans and
   * prices; this one is a thinner overview nothing links to, and the two split
   * the query (SEO audit 2026-11-03). The page stays for every email and ad link
   * that uses it; search gets pointed at the plans. Both child routes set their
   * own canonical, so this applies to /membership only.
   */
  alternates: {
    canonical: "/membership/plans",
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
