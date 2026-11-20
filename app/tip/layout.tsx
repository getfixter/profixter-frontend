import type { Metadata } from "next";

/*
 * The tip page (2026-11-20). A completion email links here with ?t=<token>
 * naming the booking and the Fixter: no page or site it
 * moves to (Stripe included) is told the URL.
 */
export const metadata: Metadata = {
  referrer: "no-referrer",
};

export default function TipLayout({ children }: { children: React.ReactNode }) {
  return children;
}
