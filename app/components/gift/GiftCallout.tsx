import Image from "next/image";
import Link from "next/link";

/**
 * "Give ProFixter as a gift", for the public marketing pages.
 *
 * WHY THIS IS A STATIC LINK AND NOT A GATED ONE
 *
 * The account screen's entry point asks the API whether gifting is live and
 * hides itself when it is not. That is right there — it sits inside a page
 * that is already making authenticated calls. Doing the same on the homepage
 * would put a network request on the site's busiest page to decide whether
 * to draw a card, and would leave a hole in the layout while it waited.
 *
 * Gifting is a live product now, and /gift answers for itself: with the
 * feature off it renders its own unavailable state rather than an error. So
 * the link is always drawn and the destination tells the truth.
 *
 * Two shapes, because the same offer has to sit in two very different
 * places: "band" is the full marketing block for a page that has room, and
 * "inline" is one quiet line for the bottom of a plan comparison.
 */

const USE_CASES = ["New homeowners", "Birthdays", "Thank-yous", "Family and friends", "Clients"];

export default function GiftCallout({
  variant = "band",
  className = "",
}: {
  variant?: "band" | "inline";
  className?: string;
}) {
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
        — choose a plan, choose how many months, and we send them a digital gift.
      </p>
    );
  }

  return (
    <section
      className={`relative isolate overflow-hidden bg-[#070D18] ${className}`}
      aria-labelledby="gift-callout-heading"
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
          id="gift-callout-heading"
          className="mx-auto mt-4 max-w-[18ch] text-balance text-[30px] font-light leading-[1.12] text-[#F4F7FF] sm:text-[40px]"
          style={{ fontFamily: "var(--font-gift-display), Georgia, serif" }}
        >
          Give ProFixter as a <span className="italic text-[#E8CFAE]">gift</span>
        </h2>
        <p className="mx-auto mt-4 max-w-[52ch] text-[15px] leading-[1.7] text-[#B7C7E2] sm:text-[17px]">
          Give someone reliable handyman help for their home. Choose a plan, choose how many
          months, add a personal message, and we will send them a beautiful digital gift.
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

        <div className="mt-9">
          <Link
            href="/gift"
            className="gift-cta inline-flex min-h-[52px] items-center justify-center gap-2.5 rounded-[10px] px-8 text-[15px] font-semibold tracking-[0.02em] text-[#1A1206] sm:text-[16px]"
          >
            Give a membership
            <span aria-hidden="true">&rarr;</span>
          </Link>
          <p className="mt-3.5 text-[13px] text-[#8093B5]">
            One payment. Nothing renews. They choose when to book.
          </p>
        </div>
      </div>
    </section>
  );
}
