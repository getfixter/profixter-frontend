"use client";

import Image from "next/image";
import Link from "next/link";
import { useAuth } from "@/lib/useAuth";
import { hasActiveMembership } from "@/lib/auth-routing";
import MembershipCallbackForm from "@/app/components/home/MembershipCallbackForm";
import { trackEvent } from "@/lib/analytics";
import { plans } from "@/app/data/content";
import Reveal from "@/app/components/ui/Reveal";
import BookingPreview from "@/app/components/sections/BookingPreview";
import RecentWorkSection from "@/app/components/sections/RecentWorkSection";
import GoogleRatingCompact from "@/app/components/home/GoogleRatingCompact";
import MembershipMap from "@/app/components/home/MembershipMap";

/* ------------------------------------------------------------------ */
/* Content                                                             */
/* ------------------------------------------------------------------ */

/** The homeowner's own voice, not a service directory. */
const THE_LIST = [
  "A door that doesn't close right",
  "The TV still waiting to go up",
  "Caulk around the tub gone grey",
  "A cabinet handle working loose",
  "The shelf still in its box",
  "A drywall ding you stopped seeing",
  "Trim cracked since the spring",
  "A light fixture you meant to swap",
  "A closet door off its track",
  "A faucet you can hear at night",
];

const STEPS = [
  {
    n: "01",
    title: "Book it",
    body: "Pick a day and time, say what needs doing, add a photo.",
  },
  {
    n: "02",
    title: "We come",
    body: "The same local team arrives ready, with the right tools.",
  },
  {
    n: "03",
    title: "It's done",
    body: "One less thing on the list. Book the next when you're ready.",
  },
];


const PROJECTS = [
  { src: "/images/projects/Kitchen Project.jpg", label: "Kitchen" },
  { src: "/images/projects/Bathroom Project.jpg", label: "Bathroom" },
  { src: "/images/projects/Siding Project.jpg", label: "Siding" },
];

/**
 * The entry price, read from the plans themselves.
 *
 * Hard-coding 149 here would be one more place to forget when pricing moves,
 * and a homepage that disagrees with the plans page about what membership costs
 * is worse than one that says nothing.
 */
const startingPrice = Math.min(...plans.map((plan) => plan.price));

/**
 * Why somebody pays monthly instead of calling whoever answers.
 *
 * Drawn from what the plans actually include, not written to sell. The value of
 * this product is not a discount - it is that the finding, vetting and briefing
 * stops happening, and small jobs get done instead of accumulating.
 */
const MEMBERSHIP_VALUE = [
  "Book online whenever something comes up",
  "The same local team, learning your home",
  "Small fixes and maintenance, no estimates",
  "One predictable monthly price",
  /*
   * Loyalty, as one line among the others rather than a section of its own.
   *
   * It belongs here because it IS part of what the monthly price buys, and
   * stating it beside the other four is what makes it read as a fact about
   * membership rather than a promotion. A standalone band would have turned
   * the homepage into a Loyalty page; the detail lives one link away.
   */
  "Benefits that get better the longer you stay",
];

/* ------------------------------------------------------------------ */
/* Primitives                                                          */
/* ------------------------------------------------------------------ */

function Eyebrow({ children, tone = "dark" }: { children: React.ReactNode; tone?: "dark" | "light" }) {
  return (
    <p
      className={`text-[11px] font-semibold uppercase tracking-[0.14em] sm:text-[12px] ${
        tone === "light" ? "text-[#8FB6FF]" : "text-[#306EEC]"
      }`}
    >
      {children}
    </p>
  );
}

function H2({ children, className = "" }: { children: React.ReactNode; className?: string }) {
  return (
    <h2
      className={`text-balance text-[23px] font-semibold leading-[1.1] tracking-[-0.03em] text-[#111111] sm:text-[30px] lg:text-[32px] ${className}`}
    >
      {children}
    </h2>
  );
}

function Lede({ children, className = "" }: { children: React.ReactNode; className?: string }) {
  return (
    <p className={`text-pretty text-[16px] leading-[1.55] text-[#6E6E73] sm:text-[17px] ${className}`}>
      {children}
    </p>
  );
}

/** One CTA vocabulary, reused everywhere. */
function BookFree({
  href,
  placement,
  tone = "accent",
  className = "",
  label = "Book your free visit",
}: {
  href: string;
  placement: string;
  tone?: "accent" | "light";
  className?: string;
  /** Members are never offered a free visit, so the CTA says what they can do. */
  label?: string;
}) {
  return (
    <Link
      href={href}
      onClick={() => trackEvent("free_visit_cta_clicked", { placement })}
      className={[
        "inline-flex min-h-[44px] w-full items-center justify-center rounded-[8px] px-5 text-[15px] font-semibold transition-transform duration-200 active:scale-[0.985] sm:w-auto",
        tone === "accent"
          ? "bg-[#306EEC] text-white shadow-[0_12px_28px_-8px_rgba(48,110,236,0.55)] hover:bg-[#2558C9]"
          : "bg-white text-[#0B1628] shadow-[0_12px_28px_-10px_rgba(0,0,0,0.45)] hover:bg-[#F5F5F7]",
        className,
      ].join(" ")}
    >
      {label}
    </Link>
  );
}

function QuietLink({
  href,
  children,
  placement,
  tone = "dark",
}: {
  href: string;
  children: React.ReactNode;
  placement: string;
  tone?: "dark" | "light";
}) {
  return (
    <Link
      href={href}
      onClick={() => trackEvent("membership_explainer_clicked", { placement })}
      className={`inline-flex min-h-[44px] w-full items-center justify-center rounded-[8px] border px-5 text-[15px] font-semibold transition sm:w-auto ${
        tone === "light"
          ? "border-white/25 text-white hover:bg-white/10"
          : "border-[#D2D2D7] text-[#1D1D1F] hover:bg-[#F5F5F7]"
      }`}
    >
      {children}
    </Link>
  );
}

/* ------------------------------------------------------------------ */
/* Page                                                                */
/* ------------------------------------------------------------------ */

export default function HomeMarketing() {
  const { isAuthenticated, user } = useAuth();

  /*
   * Home stays the real Home page for everybody. What changes is only what
   * would be untrue to say to a paying member: a free first visit is an
   * acquisition offer, and telling somebody who already pays us that their
   * first visit is free reads as though we do not know who they are.
   */
  const isMember = hasActiveMembership(user);

  // Signed-in customers go straight to booking, which resolves their own
  // eligibility. Everyone else sets up their home first.
  const bookHref = isMember
    ? "/book?visit=membership"
    : isAuthenticated
      ? "/membership"
      : "/signup?redirect=%2Fmembership";

  return (
    <main className="bg-white text-[#111111]">
      {/* ============================ HERO ============================ */}
      <section className="relative isolate overflow-hidden bg-[#080E18]">
        <Image
          src="/images/hero-bg.webp"
          alt=""
          fill
          priority
          sizes="100vw"
          className="object-cover object-center opacity-[0.26]"
        />
        <div
          aria-hidden="true"
          className="absolute inset-0 bg-[radial-gradient(120%_80%_at_50%_0%,rgba(48,110,236,0.20)_0%,transparent_60%),linear-gradient(180deg,rgba(8,14,24,0.55)_0%,rgba(8,14,24,0.86)_70%,#080E18_100%)]"
        />

        {/*
         * Top aligned, not centred. The right column carries the booking
         * preview and is taller than the proposition beside it, so centring
         * pushed the H1 past the middle of a desktop viewport and left the top
         * half of the hero empty. Each
         * column now starts at the top and the right one simply runs longer.
         */}
        <div className="relative mx-auto grid max-w-[1120px] gap-8 px-5 pb-9 pt-10 sm:px-6 sm:pb-14 sm:pt-16 lg:grid-cols-[1.05fr_0.95fr] lg:items-start lg:gap-10 lg:pb-28 lg:pt-24">
          <div>
            <Reveal>
              <Eyebrow tone="light">Handyman membership · Long Island</Eyebrow>
            </Reveal>

            <Reveal delay={70}>
              <h1 className="mt-3.5 text-balance text-[30px] font-semibold leading-[1.06] tracking-[-0.035em] text-white sm:text-[36px] lg:text-[40px]">
                A handyman you don&rsquo;t have to find.
              </h1>
            </Reveal>

            <Reveal delay={140}>
              <p className="mt-3.5 max-w-[42ch] text-pretty text-[15.5px] leading-[1.5] text-white/65 sm:mt-4 sm:text-[17px]">
                Small jobs keep coming up around a house. Book them whenever they
                do, and the same local team takes care of them.
              </p>
            </Reveal>

            <Reveal delay={210}>
              <div className="mt-6 flex flex-col gap-3 sm:mt-7 sm:flex-row sm:items-center">
                <BookFree
                  href={bookHref}
                  placement="hero"
                  label={isMember ? "Book your Fixter" : "Book your free visit"}
                />
                <Link
                  href="#how-it-works"
                  onClick={() => trackEvent("membership_explainer_clicked", { placement: "hero" })}
                  className="hidden min-h-[44px] items-center justify-center rounded-[8px] border border-white/25 px-5 text-[15px] font-semibold text-white transition hover:bg-white/10 sm:inline-flex"
                >
                  How it works
                </Link>
                <Link
                  href="#how-it-works"
                  onClick={() => trackEvent("membership_explainer_clicked", { placement: "hero_inline" })}
                  className="inline-flex min-h-[44px] items-center justify-center text-[15px] font-semibold text-white/75 underline-offset-4 hover:text-white hover:underline sm:hidden"
                >
                  How it works
                </Link>
              </div>
            </Reveal>

            {!isMember && (
              <Reveal delay={280}>
                <p className="mt-4 text-[13.5px] leading-[1.5] text-white/45">
                  Your first 90-minute visit is free. No card required.
                </p>
              </Reveal>
            )}

            {/*
              The callback form used to sit here, directly under the primary
              button. Three conversions inside the first screen - book it,
              explain it, call me - is a choice a stranger cannot make yet, so
              it moved down to the membership band, where somebody is actually
              weighing the product up.
             */}
          </div>

          {/* Product, not a stock photo. The form rides with it on desktop so
              the width is used by composition rather than left empty. */}
          <Reveal delay={200} className="hidden lg:flex lg:justify-end">
            <div className="relative w-full max-w-[380px]">
              <div
                aria-hidden="true"
                className="absolute -inset-8 rounded-full bg-[#306EEC]/18 blur-3xl"
              />
              <BookingPreview className="relative mx-auto" />
            </div>
          </Reveal>
        </div>
      </section>


      {/* ========================= RECOGNITION ========================= */}
      <section className="px-5 py-9 sm:px-6 sm:py-13">
        <div className="mx-auto max-w-[1120px]">
          <Reveal>
            <Eyebrow>The list</Eyebrow>
            <H2 className="mt-4 max-w-[16ch]">There&rsquo;s always something.</H2>
          </Reveal>

          <ul className="mt-7 grid grid-cols-1 gap-x-14 sm:mt-8 sm:grid-cols-2">
            {THE_LIST.slice(0, 6).map((item, i) => (
              <Reveal as="li" key={item} delay={Math.min(i, 5) * 45}>
                <span className="flex items-center gap-3 border-b border-[#EDEDF0] py-2.5 text-[17px] leading-[1.35] text-[#1D1D1F] sm:py-3 sm:text-[18px]">
                  <span
                    aria-hidden="true"
                    className="h-[19px] w-[19px] flex-none rounded-[6px] border-[1.5px] border-[#D8D8DD]"
                  />
                  {item}
                </span>
              </Reveal>
            ))}
          </ul>

          <Reveal delay={80}>
            <Lede className="mt-7 max-w-[46ch]">
              None of it is worth hunting down a contractor for. So it waits.
            </Lede>
          </Reveal>
        </div>
      </section>


      {/* ================== MEMBERSHIP + WHAT IT HANDLES ============== */}
      {/*
        The product, then the evidence for it - as one visual block, but not
        one component.

        These were briefly merged into the gallery so there would not be two
        headings in a row. That was wrong in a way only production showed: the
        gallery correctly renders nothing when no photos are published, and it
        took the entire membership explanation down with it. A product
        description is not allowed to depend on a photo library being non-empty.

        So the words live here and always render; the photographs continue the
        same dark band underneath and disappear on their own when there is
        nothing published. One heading either way.

        It also had to stop sitting under "Small fix today. Bigger project
        later.", which quietly filed these photographs as renovation work. They
        are not - they are what membership covers.
      */}
      <section
        className="relative w-full overflow-hidden px-5 pt-11 sm:px-6 sm:pt-14"
        style={{ background: "#080F1E" }}
        aria-labelledby="membership-covers-heading"
      >
        <div
          aria-hidden="true"
          className="absolute top-0 left-0 right-0 h-px"
          style={{ background: "linear-gradient(90deg, transparent, rgba(48,110,236,0.18), transparent)" }}
        />
        <div className="mx-auto max-w-[1120px] text-white">
          <Reveal>
            <Eyebrow tone="light">Membership</Eyebrow>
            <h2
              id="membership-covers-heading"
              className="mt-4 max-w-[18ch] text-balance text-[26px] font-semibold leading-[1.08] tracking-[-0.035em] sm:text-[34px] lg:text-[36px]"
            >
              One team that already knows your house.
            </h2>
            {/*
              The last sentence is the whole job of this paragraph.

              The photographs directly below are real finished work, and for a
              long time nothing told the reader why they were there. Read as a
              portfolio they answer "are these people any good"; read as what
              they are, they answer the question somebody deciding on a
              membership is actually asking - what would I use it for. One
              sentence, because the pictures do the rest.
            */}
            <p className="mt-5 max-w-[52ch] text-pretty text-[17px] leading-[1.5] text-white/60 sm:text-[19px]">
              Instead of finding someone each time, you have a company already set up for
              your home &mdash; mounting, repairs, installations, replacements, adjustments
              and maintenance. The photos below are real examples of the everyday jobs a
              membership covers.
            </p>
          </Reveal>
        </div>
      </section>

      <RecentWorkSection variant="preview" showHeading={false} />

      {/* ========================== HOW IT WORKS ======================= */}
      <section id="how-it-works" className="scroll-mt-2 bg-[#F5F5F7] px-5 py-9 sm:px-6 sm:py-13">
        <div className="mx-auto max-w-[1120px]">
          <Reveal>
            <Eyebrow>How it works</Eyebrow>
            <H2 className="mt-4 max-w-[18ch]">Book it. We come. It&rsquo;s done.</H2>
          </Reveal>

          <div className="mt-7 grid gap-7 sm:mt-9 lg:grid-cols-[0.9fr_1.1fr] lg:items-center lg:gap-10">
            <Reveal className="flex justify-center lg:order-2 lg:hidden">
              <BookingPreview />
            </Reveal>

            <ol className="lg:order-1">
              {STEPS.map((s, i) => (
                <Reveal as="li" key={s.n} delay={i * 70}>
                  <span className="flex gap-5 border-t border-[#DEDEE3] py-5 sm:py-7">
                    <span className="pt-0.5 text-[13px] font-semibold tabular-nums text-[#306EEC]">
                      {s.n}
                    </span>
                    <span className="block">
                      <span className="block text-[19px] font-semibold tracking-[-0.02em] text-[#111111] sm:text-[21px]">
                        {s.title}
                      </span>
                      <span className="mt-1.5 block max-w-[34ch] text-[16px] leading-[1.5] text-[#6E6E73]">
                        {s.body}
                      </span>
                    </span>
                  </span>
                </Reveal>
              ))}
            </ol>
          </div>
        </div>
      </section>


      {/* =========================== FREE VISIT ========================
          Acquisition only. A member already pays us, so an offer for their
          "first" visit is both untrue and slightly insulting. */}
      {!isMember && (
      <section className="px-5 py-9 sm:px-6 sm:py-13">
        <div className="mx-auto max-w-[820px]">
          <Reveal>
            <Eyebrow>Try it first</Eyebrow>
            <H2 className="mt-4 max-w-[19ch]">Your first visit is free.</H2>
            <Lede className="mt-5 max-w-[48ch]">
              See how it works before deciding anything about membership. Set up your home,
              pick a time, and we&rsquo;ll take care of the first thing on the list.
            </Lede>
          </Reveal>

          <Reveal delay={80}>
            <dl className="mt-7 divide-y divide-[#EDEDF0] border-y border-[#EDEDF0]">
              {[
                ["Cost", "$0. No card needed to book."],
                ["Length", "One 90-minute visit of standard handyman work."],
                ["We'll need", "A photo of the job, so your Fixter arrives prepared."],
                ["Who", "New customers, one visit per home, Nassau and Suffolk."],
              ].map(([k, v]) => (
                <div key={k} className="grid gap-1 py-5 sm:grid-cols-[150px_1fr] sm:gap-8">
                  <dt className="text-[14px] font-semibold text-[#111111]">{k}</dt>
                  <dd className="text-[16px] leading-[1.5] text-[#6E6E73]">{v}</dd>
                </div>
              ))}
            </dl>
          </Reveal>

          <Reveal delay={120}>
            <div className="mt-6">
              <BookFree href={bookHref} placement="offer_section" />
            </div>
          </Reveal>
        </div>
      </section>
      )}


      {/* ========================= WHAT IT COSTS ======================= */}
      {/*
        One price, not a wall of four.

        Home used to show Basic through Elite, $149 to $499, with a one-line
        tagline each - and the taglines were interchangeable enough that nobody
        could tell why one cost more than another. That is a decision demanded
        before the value has landed. Home now says where it starts and what the
        arrangement is; comparison lives on the page built to compare, which has
        the real feature lists behind it.
      */}
      <section className="px-5 py-9 sm:px-6 sm:py-13">
        <div className="mx-auto max-w-[820px]">
          <Reveal>
            <Eyebrow>What it costs</Eyebrow>
            <H2 className="mt-4 max-w-[20ch]">Membership starts at ${startingPrice} a month.</H2>
            <Lede className="mt-5 max-w-[48ch]">
              Month to month, cancel any time. What you are paying for is not a discount
              on a call-out &mdash; it is not having to find, vet and brief somebody every
              time the house needs something.
            </Lede>
          </Reveal>

          <Reveal delay={70}>
            <ul className="mt-7 grid gap-x-8 gap-y-3 sm:grid-cols-2">
              {MEMBERSHIP_VALUE.map((item) => (
                <li
                  key={item}
                  className="flex items-start gap-2.5 text-[15px] leading-[1.5] text-[#3C4453]"
                >
                  <span
                    aria-hidden="true"
                    className="mt-[8px] h-1.5 w-1.5 shrink-0 rounded-full bg-[#306EEC]"
                  />
                  {item}
                </li>
              ))}
            </ul>
          </Reveal>

          <Reveal delay={120}>
            {/*
              One sentence and one link, sharing the row the comparison link
              already occupies. Enough for somebody weighing the monthly price
              to learn the arrangement improves, without the homepage having to
              explain milestones it has no room for.
            */}
            <p className="mt-6 max-w-[48ch] text-[15px] leading-[1.6] text-[#3C4453]">
              <span className="font-semibold text-[#111111]">Membership gets better the longer you stay.</span>{" "}
              Complimentary plan benefits at 3 and 6 months, and your next month on us
              after 12.
            </p>

            <div className="mt-6 flex flex-col gap-3 sm:flex-row sm:items-center">
              <QuietLink href="/membership/plans" placement="membership_band">
                Compare plans
              </QuietLink>
              <QuietLink href="/membership/loyalty" placement="membership_band_loyalty">
                See Loyalty Benefits
              </QuietLink>
              {!isMember && (
                <p className="text-[14px] text-[#A1A1A6] sm:ml-2">
                  Or try it first &mdash; your first visit is free.
                </p>
              )}
            </div>
          </Reveal>

          {/*
            Human help, kept as an option rather than a competitor. Somebody
            still unsure here has read the product and the price, which is
            exactly when a phone call is worth offering - and not before.
          */}
          {!isMember && (
            <Reveal delay={160}>
              <MembershipCallbackForm tone="light" className="mt-8" />
            </Reveal>
          )}
        </div>
      </section>

      {/* ============================= TRUST ========================== */}
      {/*
        Moved up out of the last fifth of the page.

        "A local company, not a marketplace" plus a real licence number is the
        argument that beats calling whoever answers the phone, and it was
        arriving at 71% - after most people had stopped scrolling. It now sits
        where the decision is being made, between the price and the ask.
      */}
      <section className="px-5 py-9 sm:px-6 sm:py-13">
        <div className="mx-auto max-w-[1120px]">
          <div className="grid gap-8 lg:grid-cols-[1fr_380px] lg:gap-10">
            <Reveal>
              <Eyebrow>Who comes to your home</Eyebrow>
              <H2 className="mt-4 max-w-[16ch]">A local company, not a marketplace.</H2>
              <Lede className="mt-5 max-w-[46ch]">
                ProFixter is based near Babylon and serves Nassau and Suffolk. You work with
                the same company each time, so nobody has to learn your house twice.
              </Lede>

              <dl className="mt-6 grid grid-cols-1 gap-px overflow-hidden rounded-[8px] border border-[#E5E5EA] bg-[#E5E5EA] sm:grid-cols-3">
                {[
                  ["Licensed", "NY HIC HI-71484"],
                  ["Insured", "For in-home work"],
                  ["Serving", "Nassau & Suffolk"],
                ].map(([k, v]) => (
                  <div key={k} className="bg-white px-5 py-4">
                    <dt className="text-[11px] font-semibold uppercase tracking-[0.1em] text-[#A1A1A6]">
                      {k}
                    </dt>
                    <dd className="mt-1 text-[15px] font-semibold text-[#111111]">{v}</dd>
                  </div>
                ))}
              </dl>

              {/*
                Licensed, insured and local are claims we make about ourselves.
                This is the only line on the homepage that is somebody else
                talking, so it sits directly under them - and it renders nothing
                at all unless Google actually returned reviews.
              */}
              <GoogleRatingCompact className="mt-4" />
            </Reveal>

            <Reveal delay={90}>
              <figure className="overflow-hidden rounded-[8px] bg-[#F5F5F7]">
                <div className="relative aspect-[16/10] sm:aspect-[4/3]">
                  <Image
                    src="/images/Taras.png"
                    alt="Taras Bandura, founder of Profixter"
                    fill
                    sizes="(max-width: 1024px) 100vw, 380px"
                    className="object-cover object-top"
                  />
                </div>
                <figcaption className="p-6">
                  <p className="text-[16px] font-semibold text-[#111111]">Taras Bandura</p>
                  <p className="text-[14px] text-[#A1A1A6]">Founder</p>
                  <p className="mt-3 text-[15px] leading-[1.5] text-[#6E6E73]">
                    &ldquo;Every small job used to mean starting over: searching,
                    explaining, waiting. We built ProFixter so it doesn&rsquo;t.&rdquo;
                  </p>
                </figcaption>
              </figure>
            </Reveal>
          </div>
        </div>
      </section>

      {/* ====================== WHERE MEMBERS ARE ===================== */}
      {/*
        Straight after the trust band, where "a real local company" has just
        been asserted and a picture of the actual footprint is the evidence
        for it. Self-contained: it fetches its own data, renders nothing at
        all when there is nothing to show, and can be moved during the larger
        homepage redesign without touching anything around it.
      */}
      <MembershipMap />

      {/* ========================== BIGGER PROJECTS ==================== */}
      <section className="bg-[#F5F5F7] px-5 py-9 sm:px-6 sm:py-9">
        <div className="mx-auto max-w-[1120px]">
          <Reveal>
            <Eyebrow>Bigger projects</Eyebrow>
            <H2 className="mt-4 max-w-[20ch]">Small fix today. Bigger project later.</H2>
            <Lede className="mt-5 max-w-[46ch]">
              The same company that hangs your shelf also does kitchens, bathrooms, roofing
              and siding. Work at that scale is quoted separately from membership.
            </Lede>
          </Reveal>

          <div className="mt-7 grid grid-cols-2 gap-2.5 sm:mt-8 sm:grid-cols-3 sm:gap-3">
            {PROJECTS.map((p, i) => (
              <Reveal key={p.label} delay={i * 70}>
                <figure className="group relative overflow-hidden rounded-[8px] bg-[#E5E5EA]">
                  <div className="relative aspect-[4/3]">
                    <Image
                      src={p.src}
                      alt={`${p.label} project completed by Profixter on Long Island`}
                      fill
                      sizes="(max-width: 640px) 100vw, 33vw"
                      className="object-cover transition-transform duration-[700ms] ease-out group-hover:scale-[1.03] motion-reduce:transition-none motion-reduce:group-hover:scale-100"
                    />
                  </div>
                  <figcaption className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/60 to-transparent px-4 pb-3.5 pt-8 text-[15px] font-semibold text-white">
                    {p.label}
                  </figcaption>
                </figure>
              </Reveal>
            ))}
          </div>

          <Reveal delay={100}>
            <div className="mt-8">
              {/*
                "See projects" promised a portfolio and opened a quote form.
                The destination asks about your project; so does the button now.
              */}
              <QuietLink href="/projects" placement="projects_band">
                Get a project estimate
              </QuietLink>
            </div>
          </Reveal>
        </div>
      </section>


      {/* ============================= CLOSE ========================== */}
      <section className="px-5 pb-11 pt-3 sm:px-6 sm:pb-14">
        <div className="mx-auto max-w-[1120px]">
          {/* Close */}
          <Reveal delay={60}>
            <div className="mt-8 border-t border-[#EDEDF0] pt-9 text-center sm:mt-9 sm:pt-11">
              <H2 className="mx-auto max-w-[17ch]">Start with whatever&rsquo;s been waiting longest.</H2>
              <p className="mx-auto mt-3.5 max-w-[38ch] text-[16px] leading-[1.5] text-[#6E6E73]">
                {isMember
                  ? "Your membership covers it. Pick a day that suits you."
                  : "Your first 90-minute visit is free. No card required."}
              </p>
              <div className="mt-7 flex justify-center">
                <BookFree
                  href={bookHref}
                  placement="final"
                  className="sm:min-w-[260px]"
                  label={isMember ? "Book your Fixter" : "Book your free visit"}
                />
              </div>
              {!isMember && (
                <p className="mt-6 text-[14px] text-[#A1A1A6]">
                  Not ready for a membership?{" "}
                  <Link
                    href="/book"
                    onClick={() => trackEvent("one_time_link_clicked", { placement: "final" })}
                    className="inline-block py-1 font-semibold text-[#306EEC] underline-offset-4 hover:underline"
                  >
                    Book a one-time visit
                  </Link>
                </p>
              )}
            </div>
          </Reveal>
        </div>
      </section>

    </main>
  );
}
