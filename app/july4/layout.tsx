import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "One Less Thing to Worry About | Profixter Basic",
  description:
    "Reliable local handyman help for Babylon-area homeowners. Try Profixter Basic free for your first month with JULY4, then $149/month. Cancel anytime.",
  openGraph: {
    title: "One Trusted Solution for Your Home To-Do List",
    description:
      "Stop chasing contractors for every small job. Try Profixter Basic free for your first month with JULY4.",
    type: "website",
  },
};

export default function July4Layout({ children }: { children: React.ReactNode }) {
  return children;
}
