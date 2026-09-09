import type { Metadata } from "next";

import GiftPurchaseClient from "./GiftPurchaseClient";

/**
 * /gift — give somebody a ProFixter membership.
 *
 * The page itself is public so somebody arriving from a link or a search sees
 * what it is; buying requires an account, and the client preserves the
 * destination through sign-in so they come back here rather than landing on a
 * generic page.
 *
 * Whether the feature is live at all is the SERVER's answer, not this file's:
 * the client asks the API and renders an unavailable state when gifts are off.
 * There is deliberately no public env var, which could drift out of step with
 * the backend and offer a purchase flow that cannot complete.
 */
export const metadata: Metadata = {
  title: "Gift a Membership | ProFixter",
  description:
    "Give someone a ProFixter membership. A professional handyman at their home, prepaid for a fixed term. One-time payment, nothing renews.",
};

export default function GiftPage() {
  return (
    <main className="min-h-[70vh] bg-white">
      <GiftPurchaseClient />
    </main>
  );
}
