import Link from "next/link";
import Header from "@/app/components/sections/Header";
import Footer from "@/app/components/sections/Footer";
import VisitTypeNav, { DEFAULT_VISIT_TYPE } from "@/app/components/booking/VisitTypeNav";
import { plans } from "@/app/data/content";
import { FULL_DAY_FALLBACK, ONE_TIME_FALLBACK, STANDARD_VISIT_MINUTES } from "@/lib/business";

/**
 * What /book is, before JavaScript decides which tab to open.
 *
 * /book reads the URL and the visitor's membership in the browser, so its
 * served HTML is whatever the Suspense fallback renders. That used to be the
 * One-Time booking form - so search engines indexed "Book a one-time handyman
 * visit", while every real visitor to bare /book is shown the Book Fixter tab.
 * The page said two different things depending on who was reading.
 *
 * This is the honest middle: the same tab bar, the same heading the live page
 * uses, and the four ways to get a visit with their published prices. It is
 * visible for the moment before the booker hydrates, and it is the whole page
 * for anything that reads HTML without running scripts.
 *
 * Prices are the published fallbacks; scripts/test_seo_foundation.js checks
 * them against the live booking settings so they cannot drift unnoticed.
 */
export const BOOK_HEADING = "Book a Profixter handyman visit";

export default function BookOverview() {
  const lowest = Math.min(...plans.map((plan) => plan.price));
  const options = [
    {
      name: "Book Fixter",
      price: `Members · from $${lowest}/mo`,
      body: `${STANDARD_VISIT_MINUTES}-minute visits for the running list, booked as often as you need. Your plan sets how many visits you can have booked at the same time.`,
      href: "/book?visit=membership",
    },
    {
      name: "Full Day",
      price: `$${FULL_DAY_FALLBACK.priceDollars}`,
      body: `About ${FULL_DAY_FALLBACK.hours} hours of handyman work in one day, for a long list or a bigger job.`,
      href: "/book?visit=full-day",
    },
    {
      name: "One-Time Visit",
      price: `$${ONE_TIME_FALLBACK.priceDollars}`,
      body: `Up to ${ONE_TIME_FALLBACK.minutes} minutes for one small job from a set list. No membership needed.`,
      href: "/book?visit=additional",
    },
    {
      name: "Priority Visit",
      price: "Premium & Elite",
      body: "For something that can't wait for the next regular slot. Subject to availability.",
      href: "/book?visit=priority",
    },
  ];

  return (
    <main className="min-h-screen bg-[#F8F7F2] text-[#0B1628]">
      <Header />
      <VisitTypeNav active={DEFAULT_VISIT_TYPE} />
      <section className="mx-auto w-full max-w-[1280px] px-4 pb-10 pt-5 sm:px-6 sm:pt-8 lg:px-8">
        <h1 className="text-[26px] font-black leading-tight tracking-[-0.035em] text-[#071325] sm:text-[36px] lg:text-[40px]">
          {BOOK_HEADING}
        </h1>
        <p className="mt-2 max-w-[640px] text-[14px] leading-6 text-[#475569] sm:text-[16px]">
          Handyman visits across Nassau and Suffolk. New customers can start with a{" "}
          <Link href="/book/free" className="font-semibold text-[#306EEC] underline underline-offset-2">
            free first {STANDARD_VISIT_MINUTES}-minute visit
          </Link>
          .
        </p>
        <ul className="mt-6 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          {options.map((option) => (
            <li key={option.name}>
              <Link
                href={option.href}
                className="block h-full rounded-[12px] border border-[#E3E8F1] bg-white p-4 transition hover:border-[#C9D6EE]"
              >
                <span className="flex items-baseline justify-between gap-3">
                  <span className="text-[16px] font-black">{option.name}</span>
                  <span className="text-[13px] font-bold text-[#306EEC]">{option.price}</span>
                </span>
                <span className="mt-1.5 block text-[14px] leading-6 text-[#5C6672]">{option.body}</span>
              </Link>
            </li>
          ))}
        </ul>
      </section>
      <Footer />
    </main>
  );
}
