"use client";

import Image from "next/image";
import Link from "next/link";
import { useAuth } from "@/lib/useAuth";
import { trackEvent } from "@/lib/analytics";
import { plans } from "@/app/data/content";

/* ------------------------------------------------------------------ */
/* Content                                                             */
/* ------------------------------------------------------------------ */

/** Written in the homeowner's own voice, not as service categories. */
const THE_LIST = [
  "The door that doesn't close right",
  "The TV still waiting to be mounted",
  "Caulk around the tub that's gone grey",
  "A loose cabinet handle",
  "The drywall ding you stopped noticing",
  "The shelf still in its box",
  "Trim that's been cracked since spring",
  "A light fixture you've meant to replace",
  "The closet door off its track",
  "A faucet you can hear at night",
];

const OLD_WAY = [
  "Notice it",
  "Put it off",
  "Eventually start searching",
  "Call around",
  "Explain the job",
  "Wait for a quote",
  "Wait for a slot",
  "Do it all again next time",
];

const NEW_WAY = ["Notice it", "Open ProFixter", "Pick a day", "Handled"];

const STEPS = [
  {
    n: "1",
    title: "Set up your home",
    body: "Create your account and tell us where you need help.",
  },
  {
    n: "2",
    title: "Book what needs attention",
    body: "Choose a time, describe the job, and add a photo so your technician can prepare.",
  },
  {
    n: "3",
    title: "We take care of the list",
    body: "Your technician arrives ready and gets to work.",
  },
];

/* ------------------------------------------------------------------ */
/* Small building blocks                                               */
/* ------------------------------------------------------------------ */

function Eyebrow({ children }: { children: React.ReactNode }) {
  return (
    <p className="text-[11px] font-bold uppercase tracking-[0.16em] text-[#306EEC] sm:text-[12px]">
      {children}
    </p>
  );
}

function SectionHeading({ children }: { children: React.ReactNode }) {
  return (
    <h2 className="text-[27px] font-semibold leading-[1.12] tracking-[-0.032em] text-[#111111] sm:text-[38px] sm:leading-[1.08]">
      {children}
    </h2>
  );
}

function PrimaryCta({
  children,
  href,
  placement,
  className = "",
}: {
  children: React.ReactNode;
  href: string;
  placement: string;
  className?: string;
}) {
  return (
    <Link
      href={href}
      onClick={() => trackEvent("free_visit_cta_clicked", { placement })}
      className={`inline-flex min-h-[52px] w-full items-center justify-center rounded-full bg-[#306EEC] px-7 text-[16px] font-semibold text-white shadow-[0_10px_30px_rgba(48,110,236,0.22)] transition active:scale-[0.99] hover:bg-[#2558C9] sm:w-auto sm:min-h-[54px] ${className}`}
    >
      {children}
    </Link>
  );
}

function SecondaryCta({
  children,
  href,
  placement,
}: {
  children: React.ReactNode;
  href: string;
  placement: string;
}) {
  return (
    <Link
      href={href}
      onClick={() => trackEvent("membership_explainer_clicked", { placement })}
      className="inline-flex min-h-[52px] w-full items-center justify-center rounded-full border border-[#D2D2D7] bg-white px-7 text-[16px] font-semibold text-[#1D1D1F] transition active:scale-[0.99] hover:bg-[#F5F5F7] sm:w-auto sm:min-h-[54px]"
    >
      {children}
    </Link>
  );
}

/* ------------------------------------------------------------------ */
/* Page                                                                */
/* ------------------------------------------------------------------ */

export default function HomeMarketing() {
  const { isAuthenticated } = useAuth();

  // Anonymous visitors go to signup to claim the offer; signed-in customers go
  // straight to the booking flow, which resolves their own eligibility.
  const freeVisitHref = isAuthenticated
    ? "/membership"
    : "/signup?redirect=%2Fmembership";

  return (
    <main className="bg-white text-[#111111]">
      {/* ============ 1. HERO ============ */}
      <section className="relative overflow-hidden">
        <div className="absolute inset-0">
          <Image
            src="/images/hero-bg.webp"
            alt=""
            fill
            priority
            sizes="100vw"
            className="object-cover object-center"
          />
          <div className="absolute inset-0 bg-[linear-gradient(180deg,rgba(4,10,20,0.82)_0%,rgba(4,10,20,0.72)_55%,rgba(4,10,20,0.88)_100%)]" />
        </div>

        <div className="relative mx-auto max-w-[1120px] px-5 pb-12 pt-10 sm:px-8 sm:pb-20 sm:pt-16">
          <Eyebrow>
            <span className="text-[#8FB6FF]">Handyman Membership · Long Island</span>
          </Eyebrow>

          <h1 className="mt-4 max-w-[16ch] text-balance text-[38px] font-semibold leading-[1.03] tracking-[-0.04em] text-white sm:max-w-[22ch] sm:text-[58px] sm:leading-[1.0] lg:max-w-[26ch] lg:text-[68px]">
            Your house always has a list.
            <span className="block text-white/70">Now you have someone for it.</span>
          </h1>

          <p className="mt-5 max-w-[46ch] text-[16px] leading-[1.55] text-white/72 sm:mt-6 sm:text-[19px]">
            A handyman membership for the repairs, installations and small jobs that keep
            coming up around your home.
          </p>

          {/* The offer. Structural, not a sticker. */}
          <div className="mt-7 border-t border-white/15 pt-6 sm:mt-9">
            <p className="text-[22px] font-semibold tracking-[-0.02em] text-white sm:text-[27px]">
              Your first visit is free.
            </p>
            <p className="mt-1.5 text-[13px] leading-5 text-white/55 sm:text-[14px]">
              90-minute first visit · No card required · One per home
            </p>
          </div>

          <div className="mt-6 flex flex-col gap-3 sm:mt-7 sm:flex-row">
            <PrimaryCta href={freeVisitHref} placement="home_hero">
              Book Your First Visit Free
            </PrimaryCta>
            <Link
              href="#how-it-works"
              onClick={() => trackEvent("membership_explainer_clicked", { placement: "home_hero" })}
              className="inline-flex min-h-[52px] w-full items-center justify-center rounded-full border border-white/25 bg-white/[0.06] px-7 text-[16px] font-semibold text-white backdrop-blur-sm transition active:scale-[0.99] hover:bg-white/[0.12] sm:w-auto sm:min-h-[54px]"
            >
              See how membership works
            </Link>
          </div>
        </div>
      </section>

      {/* ============ 2. RECOGNITION ============ */}
      <section className="px-5 py-14 sm:px-8 sm:py-20">
        <div className="mx-auto max-w-[1120px]">
          <SectionHeading>You probably have a few of these right now.</SectionHeading>

          <ul className="mt-8 grid grid-cols-1 gap-x-10 gap-y-0 sm:mt-10 sm:grid-cols-2">
            {THE_LIST.map((item) => (
              <li
                key={item}
                className="flex items-start gap-3 border-b border-[#EDEDF0] py-3.5 text-[16px] leading-[1.4] text-[#1D1D1F] sm:text-[17px]"
              >
                <span
                  aria-hidden="true"
                  className="mt-[3px] h-[18px] w-[18px] flex-none rounded-[5px] border-[1.5px] border-[#D2D2D7]"
                />
                {item}
              </li>
            ))}
          </ul>

          <p className="mt-8 max-w-[52ch] text-[16px] leading-[1.55] text-[#6E6E73] sm:text-[18px]">
            None of them feels big enough to start searching for a contractor. That&rsquo;s
            exactly why they&rsquo;re still on the list.
          </p>
        </div>
      </section>

      {/* ============ 3. WHY MEMBERSHIP EXISTS ============ */}
      <section id="how-it-works" className="scroll-mt-4 bg-[#F5F5F7] px-5 py-14 sm:px-8 sm:py-20">
        <div className="mx-auto max-w-[1120px]">
          <Eyebrow>Why membership</Eyebrow>
          <SectionHeading>
            <span className="mt-3 block">You already have someone.</span>
          </SectionHeading>
          <p className="mt-4 max-w-[50ch] text-[16px] leading-[1.55] text-[#6E6E73] sm:text-[18px]">
            The work is rarely the hard part. Everything before the work is.
          </p>

          <div className="mt-8 grid gap-4 sm:mt-10 sm:grid-cols-2 sm:gap-5">
            <div className="rounded-[20px] border border-[#E5E5EA] bg-white p-6 sm:p-7">
              <p className="text-[11px] font-bold uppercase tracking-[0.14em] text-[#86868B]">
                Every time, on your own
              </p>
              <ol className="mt-4 space-y-2.5">
                {OLD_WAY.map((s) => (
                  <li key={s} className="flex items-center gap-2.5 text-[15px] text-[#6E6E73]">
                    <span aria-hidden="true" className="h-1 w-1 flex-none rounded-full bg-[#C7C7CC]" />
                    {s}
                  </li>
                ))}
              </ol>
            </div>

            <div className="rounded-[20px] border border-[#0B1628] bg-[#0B1628] p-6 text-white sm:p-7">
              <p className="text-[11px] font-bold uppercase tracking-[0.14em] text-white/50">
                With ProFixter
              </p>
              <ol className="mt-4 space-y-2.5">
                {NEW_WAY.map((s) => (
                  <li key={s} className="flex items-center gap-2.5 text-[16px] font-medium">
                    <span aria-hidden="true" className="h-1.5 w-1.5 flex-none rounded-full bg-[#86EFAC]" />
                    {s}
                  </li>
                ))}
              </ol>
              <p className="mt-6 border-t border-white/12 pt-5 text-[15px] leading-[1.55] text-white/70">
                You&rsquo;re not paying for a handyman today. You&rsquo;re paying so you never
                have to start that search again.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* ============ 4. FIRST VISIT FREE ============ */}
      <section className="px-5 py-14 sm:px-8 sm:py-20">
        <div className="mx-auto max-w-[760px]">
          <Eyebrow>First visit free</Eyebrow>
          <SectionHeading>
            <span className="mt-3 block">Not sure you&rsquo;d use it? Start with one visit on us.</span>
          </SectionHeading>
          <p className="mt-4 text-[16px] leading-[1.55] text-[#6E6E73] sm:text-[18px]">
            Try the service before you decide anything about membership. Set up your home,
            pick a time, and we&rsquo;ll take care of the first thing on your list.
          </p>

          <dl className="mt-8 divide-y divide-[#EDEDF0] border-y border-[#EDEDF0]">
            {[
              ["What it costs", "$0. No card required to book."],
              ["How long", "One 90-minute visit of standard handyman work."],
              ["What we need", "A photo of the job so your technician can review it and arrive prepared."],
              ["Who it's for", "New customers, one visit per home, subject to availability."],
            ].map(([k, v]) => (
              <div key={k} className="grid grid-cols-1 gap-1 py-4 sm:grid-cols-[190px_1fr] sm:gap-6">
                <dt className="text-[14px] font-semibold text-[#111111]">{k}</dt>
                <dd className="text-[15px] leading-[1.5] text-[#6E6E73] sm:text-[16px]">{v}</dd>
              </div>
            ))}
          </dl>

          <div className="mt-8">
            <PrimaryCta href={freeVisitHref} placement="home_offer_section">
              Book Your First Visit Free
            </PrimaryCta>
          </div>
        </div>
      </section>

      {/* ============ 5. HOW IT WORKS ============ */}
      <section className="bg-[#F5F5F7] px-5 py-14 sm:px-8 sm:py-20">
        <div className="mx-auto max-w-[1120px]">
          <SectionHeading>How it works</SectionHeading>

          <div className="mt-8 grid gap-4 sm:mt-10 sm:grid-cols-3 sm:gap-5">
            {STEPS.map((s) => (
              <div key={s.n} className="rounded-[20px] border border-[#E5E5EA] bg-white p-6">
                <span className="flex h-8 w-8 items-center justify-center rounded-full bg-[#EEF4FF] text-[14px] font-semibold text-[#306EEC]">
                  {s.n}
                </span>
                <h3 className="mt-4 text-[18px] font-semibold text-[#111111]">{s.title}</h3>
                <p className="mt-1.5 text-[15px] leading-[1.5] text-[#6E6E73]">{s.body}</p>
              </div>
            ))}
          </div>

          <p className="mt-7 max-w-[54ch] text-[15px] leading-[1.55] text-[#6E6E73] sm:text-[16px]">
            Your first visit is free. Afterward, choose a membership if you&rsquo;d like
            ProFixter available for the rest of the list.
          </p>
        </div>
      </section>

      {/* ============ 6. MEMBERSHIP ============ */}
      <section className="px-5 py-14 sm:px-8 sm:py-20">
        <div className="mx-auto max-w-[1120px]">
          <Eyebrow>Membership</Eyebrow>
          <SectionHeading>
            <span className="mt-3 block">For the rest of the list.</span>
          </SectionHeading>
          <p className="mt-4 max-w-[50ch] text-[16px] leading-[1.55] text-[#6E6E73] sm:text-[18px]">
            Members book through their account whenever something needs attention. There&rsquo;s
            no fixed monthly visit count for standard member bookings.
          </p>

          <div className="mt-8 grid gap-4 sm:mt-10 sm:grid-cols-2 lg:grid-cols-4">
            {plans.map((plan) => (
              <div
                key={plan.name}
                className="flex flex-col rounded-[20px] border border-[#E5E5EA] bg-white p-6"
              >
                <h3 className="text-[18px] font-semibold text-[#111111]">{plan.displayName}</h3>
                <p className="mt-1.5 min-h-[42px] text-[14px] leading-[1.45] text-[#6E6E73]">
                  {plan.tagline}
                </p>
                <p className="mt-4 text-[30px] font-semibold tracking-[-0.03em] text-[#111111]">
                  ${plan.price}
                  <span className="text-[15px] font-medium text-[#86868B]">/mo</span>
                </p>
                <p className="mt-4 border-t border-[#EDEDF0] pt-4 text-[14px] leading-[1.5] text-[#6E6E73]">
                  {plan.description}
                </p>
              </div>
            ))}
          </div>

          <div className="mt-8 flex flex-col gap-3 sm:flex-row">
            <SecondaryCta href="/membership" placement="home_plans">
              Compare memberships
            </SecondaryCta>
          </div>

          <p className="mt-5 text-[13px] leading-5 text-[#86868B]">
            Month to month. Cancel any time.
          </p>
        </div>
      </section>

      {/* ============ 7. TRUST ============ */}
      <section className="bg-[#0B1628] px-5 py-14 text-white sm:px-8 sm:py-20">
        <div className="mx-auto max-w-[1120px]">
          <div className="grid gap-8 lg:grid-cols-[1fr_360px] lg:gap-14">
            <div>
              <p className="text-[11px] font-bold uppercase tracking-[0.16em] text-white/45 sm:text-[12px]">
                Who comes to your home
              </p>
              <h2 className="mt-3 text-[27px] font-semibold leading-[1.12] tracking-[-0.032em] sm:text-[38px]">
                A local company, not a marketplace.
              </h2>
              <p className="mt-4 max-w-[48ch] text-[16px] leading-[1.55] text-white/65 sm:text-[18px]">
                ProFixter is based near Babylon and serves homeowners across Nassau and
                Suffolk. You work with the same company each time, so nobody has to learn
                your house from scratch.
              </p>

              <dl className="mt-8 grid grid-cols-1 gap-px overflow-hidden rounded-[16px] border border-white/12 bg-white/12 sm:grid-cols-3">
                {[
                  ["Licensed", "NY HIC HI-71484"],
                  ["Insured", "For in-home work"],
                  ["Serving", "Nassau & Suffolk"],
                ].map(([k, v]) => (
                  <div key={k} className="bg-[#0B1628] px-5 py-4">
                    <dt className="text-[11px] font-semibold uppercase tracking-[0.12em] text-white/40">
                      {k}
                    </dt>
                    <dd className="mt-1 text-[15px] font-semibold">{v}</dd>
                  </div>
                ))}
              </dl>
            </div>

            <div className="rounded-[20px] border border-white/12 bg-white/[0.04] p-6">
              <div className="relative h-[210px] overflow-hidden rounded-[14px] bg-[#152238]">
                <Image
                  src="/images/Taras.png"
                  alt="Taras Bandura, founder of ProFixter"
                  fill
                  sizes="(max-width: 1024px) 100vw, 360px"
                  className="object-cover object-top"
                />
              </div>
              <p className="mt-5 text-[16px] font-semibold">Taras Bandura</p>
              <p className="text-[13px] text-white/45">Founder</p>
              <p className="mt-3 text-[15px] leading-[1.55] text-white/65">
                &ldquo;Every small thing around a house used to mean starting over &mdash;
                searching, explaining, waiting. We built ProFixter so it doesn&rsquo;t.&rdquo;
              </p>
              <Link
                href="/about"
                className="mt-4 inline-flex text-[14px] font-semibold text-[#8FB6FF] hover:text-white"
              >
                About ProFixter
              </Link>
            </div>
          </div>
        </div>
      </section>

      {/* ============ 8. CLOSE ============ */}
      <section className="px-5 py-14 sm:px-8 sm:py-20">
        <div className="mx-auto max-w-[640px] text-center">
          <SectionHeading>Start with whatever&rsquo;s been sitting the longest.</SectionHeading>
          <p className="mt-4 text-[16px] leading-[1.55] text-[#6E6E73] sm:text-[18px]">
            Your first visit is free. No card required.
          </p>

          <div className="mt-7 flex justify-center">
            <PrimaryCta href={freeVisitHref} placement="home_final">
              Book Your First Visit Free
            </PrimaryCta>
          </div>

          <p className="mt-7 text-[14px] leading-[1.6] text-[#86868B]">
            Already used your free visit and not ready for a membership?{" "}
            <Link
              href="/book"
              onClick={() => trackEvent("one_time_link_clicked", { placement: "home_final" })}
              className="font-semibold text-[#306EEC] hover:underline"
            >
              Book a one-time visit
            </Link>
            .
          </p>
        </div>
      </section>
    </main>
  );
}
