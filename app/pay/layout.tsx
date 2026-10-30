import type { Metadata } from "next";

/* A payment link is for one person: never indexed, never followed. */
export const metadata: Metadata = {
  title: "Secure payment",
  robots: { index: false, follow: false },
};

export default function PayLayout({ children }: { children: React.ReactNode }) {
  return children;
}
