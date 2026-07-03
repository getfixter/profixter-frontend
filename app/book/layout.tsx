import type { Metadata } from "next";
import { absoluteUrl, DEFAULT_OG_IMAGE } from "@/lib/seo";

export const metadata: Metadata = {
  title: "Book a Handyman | $99 One-Time Visit",
  description:
    "Book a $99 One-Time Handyman Visit with Profixter for small Long Island home repairs and installations. Choose the task, date, time, notes, and photos before checkout.",
  alternates: {
    canonical: "/book",
  },
  openGraph: {
    title: "Book a Handyman | $99 One-Time Visit | Profixter",
    description:
      "A focused 90-minute handyman visit for one small job. Book first, pay securely, then Profixter reviews and confirms.",
    url: absoluteUrl("/book"),
    type: "website",
    images: [DEFAULT_OG_IMAGE],
  },
  twitter: {
    card: "summary_large_image",
    title: "Book a Handyman | $99 One-Time Visit | Profixter",
    description:
      "Book a focused 90-minute handyman visit for one small Long Island home task.",
    images: [DEFAULT_OG_IMAGE.url],
  },
};

export default function BookLayout({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}
