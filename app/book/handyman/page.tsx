import type { Metadata } from "next";
import { Suspense } from "react";
import Header from "@/app/components/sections/Header";
import Footer from "@/app/components/sections/Footer";
import HandymanBooker from "@/app/components/booking4/HandymanBooker";
import { absoluteUrl, DEFAULT_OG_IMAGE } from "@/lib/seo";

export const metadata: Metadata = {
  title: "Book a Handyman | Profixter",
  description:
    "Book a Long Island handyman in minutes: describe the job, pick a time, then choose a One-Time Visit or a membership. Nassau and Suffolk counties.",
  alternates: { canonical: "/book/handyman" },
  // Its own share preview: /book's layout would otherwise lend it /book's URL and title.
  openGraph: {
    title: "Book a Handyman on Long Island | Profixter",
    description:
      "Describe the job, pick a time, then choose a One-Time Visit or a membership. Nassau and Suffolk counties.",
    url: absoluteUrl("/book/handyman"),
    type: "website",
    images: [DEFAULT_OG_IMAGE],
  },
};

/* Book a Handyman (Customer Experience 4.0): describe, pick a time, sign in, choose how to book, pay. */
export default function BookHandymanPage() {
  return (
    <div className="pg-flow min-h-screen bg-white">
      <div className="sticky top-0 z-50">
        <Header />
      </div>
      <main className="ui-section--soft">
        <Suspense fallback={<div style={{ minHeight: 480 }} />}>
          <HandymanBooker />
        </Suspense>
      </main>
      <Footer />
    </div>
  );
}
