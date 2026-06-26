import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Book a Handyman Visit",
  description:
    "Book a one-time handyman visit with Profixter for small Long Island home repairs and installations.",
  alternates: {
    canonical: "/book",
  },
  openGraph: {
    title: "Book a Handyman Visit | Profixter",
    description:
      "A focused one-time handyman visit for small jobs. Book first, pay securely, then admin confirms.",
    url: "https://www.profixter.com/book",
    type: "website",
  },
  twitter: {
    card: "summary_large_image",
    title: "Book a Handyman Visit | Profixter",
    description:
      "A focused one-time handyman visit for small jobs. Book first, pay securely, then admin confirms.",
  },
};

export default function BookLayout({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}
