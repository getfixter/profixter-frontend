import type { Metadata } from "next";
import type { ReactNode } from "react";
import { absoluteUrl } from "@/lib/seo";

/**
 * /signup is the one auth page that must be publicly verifiable.
 *
 * The (auth) layout above this marks everything under it `noindex, nofollow`,
 * which is right for /signin and /forgot-password and wrong for exactly one
 * page. /signup is where ProFixter collects SMS consent, and an A2P 10DLC
 * reviewer has to be able to reach it, read it, and see that both SMS
 * checkboxes are optional and unchecked before they will approve the campaign.
 * A page marked `nofollow` and disallowed in robots.txt is a page a vetting
 * crawler is instructed to ignore.
 *
 * Nested metadata wins over the parent layout's, so this file re-opens that one
 * route and leaves its siblings shut. It also gives the page a title of its
 * own: it previously inherited the marketing homepage's, which made every
 * reviewer screenshot of the consent form say "Handyman Membership for Long
 * Island Homes" at the top.
 *
 * Nothing private is published by this. The page is an empty form.
 */
export const metadata: Metadata = {
  title: {
    absolute: "Create your ProFixter account",
  },
  description:
    "Create a ProFixter account. Text messages are optional: service texts and marketing texts are two separate, unchecked choices, and neither is required to register, book or buy.",
  alternates: {
    canonical: "/signup",
  },
  robots: {
    index: true,
    follow: true,
  },
  openGraph: {
    title: "Create your ProFixter account",
    description:
      "Create a ProFixter account. Text messages are optional and separate from the Terms of Service.",
    url: absoluteUrl("/signup"),
    siteName: "ProFixter",
  },
};

export default function SignupLayout({ children }: { children: ReactNode }) {
  return children;
}
