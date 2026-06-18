import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Basic Plan First Month Free | Profixter",
  description:
    "Babylon-area homeowners can get the first month of the Profixter Basic Plan free with promo code JULY4. Then $149/month unless canceled.",
  openGraph: {
    title: "Get Your First Month of Profixter Basic Free",
    description:
      "A local handyman membership for Babylon and surrounding communities. Use promo code JULY4 for the Basic Plan.",
    type: "website",
  },
};

export default function July4Layout({ children }: { children: React.ReactNode }) {
  return children;
}
