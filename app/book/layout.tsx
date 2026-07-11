import type { Metadata } from "next";
import { absoluteUrl, DEFAULT_OG_IMAGE } from "@/lib/seo";

export const metadata: Metadata = {
  title: {
    absolute: "Book a Handyman on Long Island | Profixter",
  },
  description:
    "Choose a small job, pick a time, add photos, and continue to secure checkout after selecting a slot.",
  alternates: {
    canonical: "/book",
  },
  openGraph: {
    title: "Book a Handyman on Long Island | Profixter",
    description:
      "Choose the task, date, time, notes, and photos before checkout for a focused Profixter handyman visit.",
    url: absoluteUrl("/book"),
    type: "website",
    images: [DEFAULT_OG_IMAGE],
  },
  twitter: {
    card: "summary_large_image",
    title: "Book a Handyman on Long Island | Profixter",
    description:
      "Book a focused Profixter visit for one approved Long Island handyman task.",
    images: [DEFAULT_OG_IMAGE.url],
  },
};

export default function BookLayout({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}
