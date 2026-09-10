import Image from "next/image";
import Link from "next/link";

import GiftPromoCode from "./GiftPromoCode";

/**
 * "Give ProFixter as a gift", everywhere it appears.
 *
 * ONE COMPONENT, FOUR SHAPES, TWO AUDIENCES. Gift marketing lives across a
 * dozen pages now, and the alternative — a bespoke block per page — is how
 * the wording drifts until the homepage and the booking page are selling
 * slightly different products. Everything here can be changed centrally.
 *
 * WHY THIS IS A STATIC LINK AND NOT A GATED ONE
 *
 * The account screen's entry point asks the API whether gifting is live and
 * hides itself when it is not. That is right there — it sits inside a page
 * already making authenticated calls. Doing the same on the homepage would
 * put a network request on the site's busiest page to decide whether to draw
 * a card, and would leave a hole in the layout while it waited.
 *
 * Gifting is a live product now, and /gift answers for itself: with the
 * feature off it renders its own unavailable state rather than an error. So
 * the link is always drawn and the destination tells the truth.
 *
 * THE SHAPES
 *   band   A full marketing section. For the bottom of a long page that has
 *          room for one, where it reads as a closing offer.
 *   card   A self-contained visual card. For placing HIGH on a marketing
 *          page, where a full-width band would fight the hero.
 *   bar    A compact horizontal strip. For app surfaces — above all the
 *          booking page — where the page has a job to do and gifting must be
 *          visible without delaying it.
 *   inline One quiet sentence. For the foot of a plan comparison.
 *
 * THE AUDIENCES
 *   public  Explains what a gift membership is.
 *   member  Assumes they already know, because they are signed in and using
 *           it. A member reading "reliable handyman help for their home" is
 *           being sold something they already own.
 */

export type GiftVariant = "band" | "card" | "bar" | "inline";
export type GiftAudience = "public" | "member";

const USE_CASES = ["New homeowners", "Birthdays", "Thank-yous", "Family and friends", "Clients"];

const COPY: Record<GiftAudience, { heading: string; emphasis: string; body: string; bar: string }> = {
  public: {
    heading: "Give the Gift of",
    emphasis: "Handyman Help",
    body:
      "Give family, friends, clients or a new homeowner reliable handyman help for their home. " +
      "Choose a plan and gift 1, 2, 3, 6 or 12 months.",
    bar: "Give family, friends or a new homeowner reliable handyman help. Gift 1 to 12 months.",
  },
  member: {
    heading: "Give ProFixter to",
    emphasis: "Someone You Care About",
    body:
      "You already know the convenience of having a Fixter. Give that same help to family, " +
      "friends or someone you care about. Gift 1 to 12 months.",
    bar:
      "You already know how useful a Fixter is. Give that same help to family or friends — " +
      "gift 1 to 12 months.",
  },
};

const CTA = "Give a Membership";

export default function GiftCallout({
  variant = "band",
  audience = "public",
  className = "",
  headingId,
}: {
  variant?: GiftVariant;
  audience?: GiftAudience;
  className?: string;
  /** Override when two callouts could ever share a page, so ids stay unique. */
  headingId?: string;
}) {
  const copy = COPY[audience];

  /* ------------------------------------------------------------- inline */
  if (variant === "inline") {
    return (
      <p className={`text-[15px] leading-relaxed text-[#6E6E73] ${className}`}>
        Buying for someone else?{" "}
        <Link
          href="/gift"
          className="font-semibold text-[#306EEC] underline underline-offset-4 transition hover:text-[#2558C4]"
        >
          Give ProFixter as a gift
        </Link>{" "}
        &mdash; choose a plan, choose how many months, and we send them a digital gift.
      </p>
    );
  }

  /* ---------------------------------------------------------------- bar */
  /*
   * The compact one. Deliberately short: it sits above a booking form, and
   * every pixel it takes is a pixel of the form pushed off the first screen.
   * One row on desktop, a tight stack on a phone.
   */
  if (variant === "bar") {
    return (
      <section
        aria-labelledby={headingId || "gift-bar-heading"}
        /*
         * @container, and the children below use @md rather than md.
         *
         * This lays out from the width of its OWN container, not the
         * viewport. It sits full width on the booking page and inside a
         * ~590px column on the account, and a viewport breakpoint cannot
         * tell those apart: at 1280px wide md: applied in both, so the
         * account version became a row and squeezed its own text into a
         * strip about ten characters across.
         *
         * @3xl, not @md: Tailwind's container sizes are their own scale and
         * @md is 28rem, well under the width this row needs.
         */
        className={`@container relative isolate overflow-hidden rounded-[14px] border border-[#E4D7C3] bg-gradient-to-r from-[#FDF8F1] via-[#FCF4E9] to-[#FAEEDD] ${className}`}
      >
        {/* A single warm sweep, not a photograph: this must stay light. */}
        <div
          aria-hidden="true"
          className="pointer-events-none absolute inset-0 -z-10"
          style={{
            background:
              "radial-gradient(120% 140% at 100% 0%, rgba(212,165,116,0.22) 0%, rgba(212,165,116,0) 62%)",
          }}
        />
        <div className="flex flex-col gap-3 px-4 py-4 sm:px-5 @3xl:flex-row @3xl:items-center @3xl:justify-between @3xl:gap-5">
          <div className="flex items-start gap-3 @3xl:items-center">
            <span
              aria-hidden="true"
              className="mt-0.5 grid h-9 w-9 shrink-0 place-items-center rounded-full bg-[#D4A574]/18 text-[17px] @3xl:mt-0"
            >
              🎁
            </span>
            <div className="min-w-0">
              <h2
                id={headingId || "gift-bar-heading"}
                className="text-[15px] font-bold leading-snug text-[#2B2218] sm:text-[16px]"
              >
                {copy.heading}{" "}
                <span className="text-[#8A6A3E]">{copy.emphasis}</span>
              </h2>
              <p className="mt-1 text-[13px] leading-relaxed text-[#6B5C48] sm:text-[14px]">
                {copy.bar}
              </p>
            </div>
          </div>

          {/* No indent on mobile: the 48px gutter that lined this up under
              the text cost just enough width to push the button onto its
              own row, making the whole bar a third taller on a phone. */}
          <div className="flex shrink-0 flex-wrap items-center gap-2.5">
            <GiftPromoCode tone="light" />
            <Link
              href="/gift"
              className="gift-cta inline-flex min-h-[42px] items-center justify-center rounded-[9px] px-5 text-[14px] font-semibold text-[#1A1206]"
            >
              {CTA}
            </Link>
          </div>
        </div>
      </section>
    );
  }

  /* --------------------------------------------------------------- card */
  /*
   * The mid-page one. Contained rather than full-bleed so it can sit high on
   * a marketing page without competing with the hero for the same job.
   */
  if (variant === "card") {
    return (
      <section
        aria-labelledby={headingId || "gift-card-heading"}
        className={`relative isolate overflow-hidden rounded-[18px] bg-[#070D18] ${className}`}
      >
        <div aria-hidden="true" className="pointer-events-none absolute inset-0 -z-10 overflow-hidden">
          <Image
            src="/images/pass-bg.webp"
            alt=""
            fill
            sizes="(max-width: 1024px) 100vw, 1180px"
            className="object-cover object-center"
          />
          <div
            className="absolute inset-0"
            style={{
              background:
                "linear-gradient(100deg, rgba(7,13,24,0.94) 0%, rgba(7,13,24,0.86) 46%," +
                " rgba(7,13,24,0.64) 100%)",
            }}
          />
        </div>

        <div className="flex flex-col gap-6 px-6 py-8 sm:px-9 sm:py-10 lg:flex-row lg:items-center lg:justify-between lg:gap-10 lg:px-12">
          <div className="max-w-[36rem]">
            <p className="text-[11px] font-semibold uppercase tracking-[0.22em] text-[#D4A574]">
              Give ProFixter as a gift
            </p>
            <h2
              id={headingId || "gift-card-heading"}
              className="mt-3 text-balance text-[26px] font-light leading-[1.14] text-[#F4F7FF] sm:text-[34px]"
              style={{ fontFamily: "var(--font-gift-display), Georgia, serif" }}
            >
              {copy.heading}{" "}
              <span className="italic text-[#E8CFAE]">{copy.emphasis}</span>
            </h2>
            <p className="mt-3.5 max-w-[46ch] text-[15px] leading-[1.65] text-[#B7C7E2] sm:text-[16px]">
              {copy.body}
            </p>
          </div>

          <div className="flex shrink-0 flex-col items-start gap-3 lg:items-end">
            <Link
              href="/gift"
              className="gift-cta inline-flex min-h-[50px] w-full items-center justify-center gap-2.5 rounded-[10px] px-7 text-[15px] font-semibold tracking-[0.01em] text-[#1A1206] sm:w-auto sm:text-[16px]"
            >
              {CTA}
              <span aria-hidden="true">&rarr;</span>
            </Link>
            <GiftPromoCode tone="dark" />
            <p className="text-[12.5px] text-[#8093B5]">One payment. Nothing renews.</p>
          </div>
        </div>
      </section>
    );
  }

  /* --------------------------------------------------------------- band */
  return (
    <section
      className={`relative isolate overflow-hidden bg-[#070D18] ${className}`}
      aria-labelledby={headingId || "gift-callout-heading"}
    >
      <div aria-hidden="true" className="pointer-events-none absolute inset-0 -z-10 overflow-hidden">
        <Image
          src="/images/pass-bg.webp"
          alt=""
          fill
          sizes="100vw"
          className="object-cover object-center"
        />
        <div
          className="absolute inset-0"
          style={{
            background:
              "radial-gradient(85% 85% at 50% 45%, rgba(7,13,24,0.58) 0%," +
              " rgba(7,13,24,0.88) 60%, rgba(7,13,24,0.96) 100%)",
          }}
        />
      </div>

      <div className="mx-auto w-full max-w-[1180px] px-4 py-16 text-center sm:px-6 sm:py-20 lg:px-8">
        <p className="text-[11px] font-semibold uppercase tracking-[0.22em] text-[#D4A574]">
          Gift a membership
        </p>
        <h2
          id={headingId || "gift-callout-heading"}
          className="mx-auto mt-4 max-w-[18ch] text-balance text-[30px] font-light leading-[1.12] text-[#F4F7FF] sm:text-[40px]"
          style={{ fontFamily: "var(--font-gift-display), Georgia, serif" }}
        >
          {copy.heading} <span className="italic text-[#E8CFAE]">{copy.emphasis}</span>
        </h2>
        <p className="mx-auto mt-4 max-w-[52ch] text-[15px] leading-[1.7] text-[#B7C7E2] sm:text-[17px]">
          {copy.body} Add a personal message, and we will send them a beautiful digital gift.
        </p>

        <ul className="mx-auto mt-7 flex max-w-[640px] flex-wrap items-center justify-center gap-x-3 gap-y-2">
          {USE_CASES.map((use) => (
            <li
              key={use}
              className="rounded-full border border-white/12 px-3.5 py-1.5 text-[12px] text-[#AFC0DC] sm:text-[13px]"
            >
              {use}
            </li>
          ))}
        </ul>

        <div className="mt-9 flex flex-col items-center gap-3.5">
          <Link
            href="/gift"
            className="gift-cta inline-flex min-h-[52px] items-center justify-center gap-2.5 rounded-[10px] px-8 text-[15px] font-semibold tracking-[0.02em] text-[#1A1206] sm:text-[16px]"
          >
            {CTA}
            <span aria-hidden="true">&rarr;</span>
          </Link>
          <GiftPromoCode tone="dark" />
          <p className="text-[13px] text-[#8093B5]">
            One payment. Nothing renews. They choose when to book.
          </p>
        </div>
      </div>
    </section>
  );
}
