import type { Metadata } from "next";

/* A payment link is for one person: never indexed, never followed. */
export const metadata: Metadata = {
  title: "Secure payment",
  robots: { index: false, follow: false },
  /* 2026-11-20: the URL is the payment link's secret; no page or site it moves to (Stripe included) is told it. */
  referrer: "no-referrer",
};

export default function PayLayout({ children }: { children: React.ReactNode }) {
  return children;
}
