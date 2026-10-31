import type { Metadata } from "next";

/*
 * The Halloween 2026 promotion's landing page. A dated, campaign-only offer,
 * so it is kept out of search results: nobody should find it next spring.
 */
export const metadata: Metadata = {
  title: { absolute: "Happy Halloween: 20% Off Your First Membership Payment | Profixter" },
  description: "A Halloween treat from Profixter: 20% off the first payment on any membership plan, monthly or annual.",
  robots: { index: false, follow: false },
  alternates: { canonical: "/halloween" },
};

export default function HalloweenLayout({ children }: { children: React.ReactNode }) {
  return children;
}
