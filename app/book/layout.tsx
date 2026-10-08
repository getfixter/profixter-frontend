import type { Metadata } from "next";
import { absoluteUrl, DEFAULT_OG_IMAGE } from "@/lib/seo";

export const metadata: Metadata = {
  title: {
    absolute: "Book a Handyman on Long Island | Profixter",
  },
  description:
    "Book a Profixter handyman visit on Long Island: a $99 One-Time Visit for one small job (up to 90 minutes), a $499 Full Day, member visits from $149/month, or a free first visit for new Nassau and Suffolk customers.",
  alternates: {
    canonical: "/book",
  },
  openGraph: {
    title: "Book a Handyman on Long Island | Profixter",
    description:
      "A $99 One-Time Visit, a $499 Full Day, member visits from $149/month, or a free first visit for new customers. Nassau and Suffolk.",
    url: absoluteUrl("/book"),
    type: "website",
    images: [DEFAULT_OG_IMAGE],
  },
  twitter: {
    card: "summary_large_image",
    title: "Book a Handyman on Long Island | Profixter",
    description:
      "A $99 One-Time Visit, a $499 Full Day, or member visits from $149/month. Nassau and Suffolk.",
    images: [DEFAULT_OG_IMAGE.url],
  },
};

export default function BookLayout({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}
