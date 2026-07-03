import type { Metadata } from "next";
import { absoluteUrl, DEFAULT_OG_IMAGE } from "@/lib/seo";

export const metadata: Metadata = {
  title: {
    absolute: "How Profixter Membership Works | Long Island Home Care",
  },
  description:
    "See how Profixter Membership helps Long Island homeowners keep up with repairs, maintenance, small tasks, and ongoing home care.",
  alternates: {
    canonical: "/membership",
  },
  openGraph: {
    title: "How Profixter Membership Works | Long Island Home Care",
    description:
      "A practical look at Profixter Membership for ongoing home maintenance, small repairs, and better long-term home care.",
    url: absoluteUrl("/membership"),
    siteName: "Profixter",
    type: "website",
    images: [DEFAULT_OG_IMAGE],
  },
  twitter: {
    card: "summary_large_image",
    title: "How Profixter Membership Works | Long Island Home Care",
    description:
      "See how Profixter Membership helps Long Island homeowners keep up with repairs and maintenance.",
    images: [DEFAULT_OG_IMAGE.url],
  },
};

export default function MembershipInfoLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return <>{children}</>;
}
