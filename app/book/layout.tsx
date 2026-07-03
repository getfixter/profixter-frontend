import type { Metadata } from "next";
import { absoluteUrl, DEFAULT_OG_IMAGE } from "@/lib/seo";

export const metadata: Metadata = {
  title: {
    absolute: "Book a Handyman on Long Island | $99 One-Time Visit",
  },
  description:
    "Choose a small job, pick a time, add photos, and pay after the slot is selected. A 90-minute Profixter visit for approved handyman tasks.",
  alternates: {
    canonical: "/book",
  },
  openGraph: {
    title: "Book a Handyman on Long Island | $99 One-Time Visit",
    description:
      "A focused 90-minute handyman visit for one approved small job. Choose the task, date, time, notes, and photos before checkout.",
    url: absoluteUrl("/book"),
    type: "website",
    images: [DEFAULT_OG_IMAGE],
  },
  twitter: {
    card: "summary_large_image",
    title: "Book a Handyman on Long Island | $99 One-Time Visit",
    description:
      "Book a focused 90-minute Profixter visit for one approved Long Island handyman task.",
    images: [DEFAULT_OG_IMAGE.url],
  },
};

export default function BookLayout({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}
