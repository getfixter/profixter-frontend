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
    <main className="pg-book">
      <Header />
      <VisitTypeNav active={DEFAULT_VISIT_TYPE} />
      <section className="ui-container pb-12 pt-5 sm:pt-8">
        <h1 className="pg-book__title">{BOOK_HEADING}</h1>
        <p className="pg-book__sub">
          Handyman visits across Nassau and Suffolk. Not sure yet? Start with a{" "}
          <Link href="/book/free" className="font-semibold text-[color:var(--ui-accent-ink)] underline underline-offset-2">
            free visit to go over your to-do list
          </Link>
          .
        </p>
        <ul className="pg-cards pg-cards--4 mt-6">
          {options.map((option) => (
            <li key={option.name}>
              <Link href={option.href} className="ui-card ui-card--link h-full">
                <span className="flex items-baseline justify-between gap-3">
                  <span className="pg-card__title !text-[17px]">{option.name}</span>
                  <span className="ui-num text-[13px] font-semibold text-[color:var(--ui-accent-ink)]">{option.price}</span>
                </span>
                <span className="pg-card__meta block">{option.body}</span>
              </Link>
            </li>
          ))}
        </ul>
      </section>
      <Footer />
    </main>
  );
}
