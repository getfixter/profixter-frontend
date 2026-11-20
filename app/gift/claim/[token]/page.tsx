import type { Metadata } from "next";

import Header from "@/app/components/sections/Header";
import Footer from "@/app/components/sections/Footer";
import GiftClaimClient from "./GiftClaimClient";

/**
 * The gift claim page.
 *
 * The URL contains a credential, so this route is noindex/nofollow and must
 * never appear in a sitemap — the same treatment the signing route gets for
 * the same reason.
 */
export const metadata: Metadata = {
  title: "Claim your gift | ProFixter",
  robots: { index: false, follow: false, nocache: true },
  /*
   * 2026-11-20: no Referer from this page. A full-page move to the sign-in
   * pages (which load GTM and the Meta Pixel) would otherwise hand them this
   * URL, token included, as the page referrer - as /visit already prevents.
   */
  referrer: "no-referrer",
};

/** Rendered per-request: a claim token must never be cached or prerendered. */
export const dynamic = "force-dynamic";

export default async function GiftClaimPage({
  params,
}: {
  params: Promise<{ token: string }>;
}) {
  const { token } = await params;
  return (
    <div className="min-h-screen bg-white">
      <div className="sticky top-0 z-50">
        <Header />
      </div>
      <main className="min-h-[70vh] bg-white">
        <GiftClaimClient token={token} />
      </main>
      <Footer compact />
    </div>
  );
}
