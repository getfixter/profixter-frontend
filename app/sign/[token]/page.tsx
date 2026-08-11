import type { Metadata } from "next";
import SigningClient from "./SigningClient";

/**
 * Customer signing page.
 *
 * The URL contains a credential, so this route is marked noindex/nofollow and
 * must never appear in a sitemap. Nothing on the page links back into the
 * marketing site or the admin: it is a document-signing ceremony and nothing
 * else - no login, no signup, no navigation, no upsell.
 */
export const metadata: Metadata = {
  title: "Sign Document | Premium Island Homes",
  robots: { index: false, follow: false, nocache: true },
};

/** Rendered per-request: a signing token must never be cached or prerendered. */
export const dynamic = "force-dynamic";

export default async function SignPage({
  params,
}: {
  params: Promise<{ token: string }>;
}) {
  const { token } = await params;
  return <SigningClient token={token} />;
}
