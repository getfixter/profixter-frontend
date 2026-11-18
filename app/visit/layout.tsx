import type { Metadata } from "next";

/* A guest's private visit link is for one person: never indexed, never followed, no trackers (lib/tracking-scope). */
export const metadata: Metadata = {
  title: "Your visit",
  robots: { index: false, follow: false },
  referrer: "no-referrer",
};

export default function VisitLayout({ children }: { children: React.ReactNode }) {
  return children;
}
