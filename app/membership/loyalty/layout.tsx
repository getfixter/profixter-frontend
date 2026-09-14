import type { Metadata } from "next";
import { absoluteUrl, DEFAULT_OG_IMAGE } from "@/lib/seo";

export const metadata: Metadata = {
  title: {
    absolute: "Loyalty Benefits | Profixter Membership",
  },
  description:
    "Stay a Profixter member and your benefits get better. Complimentary plan upgrades at 3 and 6 months, and your 13th month on us.",
  alternates: {
    canonical: "/membership/loyalty",
  },
  openGraph: {
    title: "Loyalty Benefits | Profixter Membership",
    description:
      "Monthly Profixter memberships include Loyalty Benefits: complimentary upgrades at 3 and 6 months, and a free month at 12.",
    url: absoluteUrl("/membership/loyalty"),
    siteName: "Profixter",
    type: "website",
    images: [DEFAULT_OG_IMAGE],
  },
  twitter: {
    card: "summary_large_image",
    title: "Loyalty Benefits | Profixter Membership",
    description:
      "Stay a Profixter member and your benefits get better. See the 3, 6 and 12 month rewards.",
    images: [DEFAULT_OG_IMAGE.url],
  },
};

export default function LoyaltyLayout({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}
