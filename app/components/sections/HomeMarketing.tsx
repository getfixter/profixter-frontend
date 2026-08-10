"use client";

import Image from "next/image";
import Link from "next/link";
import { useAuth } from "@/lib/useAuth";
import { trackEvent } from "@/lib/analytics";
import { plans } from "@/app/data/content";
import Reveal from "@/app/components/ui/Reveal";
import BookingPreview from "@/app/components/sections/BookingPreview";

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
      className={`text-balance text-[30px] font-semibold leading-[1.08] tracking-[-0.035em] text-[#111111] sm:text-[42px] lg:text-[48px] ${className}`}
    >
      {children}
    </h2>
  );
}

function Lede({ children, className = "" }: { children: React.ReactNode; className?: string }) {
  return (
    <p className={`text-pretty text-[17px] leading-[1.5] text-[#6E6E73] sm:text-[19px] ${className}`}>
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
}: {
  href: string;
  placement: string;
  tone?: "accent" | "light";
  className?: string;
}) {
  return (
    <Link
      href={href}
      onClick={() => trackEvent("free_visit_cta_clicked", { placement })}
      className={[
        "inline-flex min-h-[54px] w-full items-center justify-center rounded-full px-8 text-[16px] font-semibold transition-transform duration-200 active:scale-[0.985] sm:w-auto",
        tone === "accent"
          ? "bg-[#306EEC] text-white shadow-[0_12px_28px_-8px_rgba(48,110,236,0.55)] hover:bg-[#2558C9]"
          : "bg-white text-[#0B1628] shadow-[0_12px_28px_-10px_rgba(0,0,0,0.45)] hover:bg-[#F5F5F7]",
        className,
      ].join(" ")}
    >
      Book your free visit
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
      className={`inline-flex min-h-[54px] w-full items-center justify-center rounded-full border px-8 text-[16px] font-semibold transition sm:w-auto ${
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
  const { isAuthenticated } = useAuth();

  // Signed-in customers go straight to booking, which resolves their own
  // eligibility. Everyone else sets up their home first.
  const bookHref = isAuthenticated ? "/membership" : "/signup?redirect=%2Fmembership";

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

        <div className="relative mx-auto grid max-w-[1120px] gap-12 px-5 pb-14 pt-10 sm:px-8 sm:pb-24 sm:pt-20 lg:grid-cols-[1.05fr_0.95fr] lg:items-center lg:gap-10 lg:pb-28 lg:pt-24">
          <div>
            <Reveal>
              <Eyebrow tone="light">Handyman membership · Long Island</Eyebrow>
            </Reveal>

            <Reveal delay={70}>
              <h1 className="mt-4 text-balance text-[38px] font-semibold leading-[1.04] tracking-[-0.04em] text-white sm:text-[58px] lg:text-[66px]">
                A handyman you don&rsquo;t have to find.
              </h1>
            </Reveal>

            <Reveal delay={140}>
              <p className="mt-4 max-w-[40ch] text-pretty text-[16.5px] leading-[1.45] text-white/65 sm:mt-5 sm:text-[20px]">
                Small jobs keep coming up around a house. Book them whenever they do &mdash;
                the same local team takes care of them.
              </p>
            </Reveal>

            <Reveal delay={210}>
              <div className="mt-7 flex flex-col gap-3 sm:mt-8 sm:flex-row sm:items-center">
                <BookFree href={bookHref} placement="hero" />
                <Link
                  href="#how-it-works"
                  onClick={() => trackEvent("membership_explainer_clicked", { placement: "hero" })}
                  className="hidden min-h-[54px] items-center justify-center rounded-full border border-white/25 px-8 text-[16px] font-semibold text-white transition hover:bg-white/10 sm:inline-flex"
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

            <Reveal delay={280}>
              <p className="mt-5 text-[14px] leading-[1.5] text-white/45">
                Your first 90-minute visit is free. No card required.
              </p>
            </Reveal>
          </div>

          {/* Product, not a stock photo. */}
          <Reveal delay={200} className="hidden justify-center lg:flex lg:justify-end">
            <div className="relative">
              <div
                aria-hidden="true"
                className="absolute -inset-8 rounded-full bg-[#306EEC]/18 blur-3xl"
              />
              <BookingPreview className="relative" />
            </div>
          </Reveal>
        </div>
      </section>

      {/* ========================= RECOGNITION ========================= */}
      <section className="px-5 py-16 sm:px-8 sm:py-28">
        <div className="mx-auto max-w-[1120px]">
          <Reveal>
            <Eyebrow>The list</Eyebrow>
            <H2 className="mt-4 max-w-[16ch]">There&rsquo;s always something.</H2>
          </Reveal>

          <ul className="mt-10 grid grid-cols-1 gap-x-14 sm:mt-12 sm:grid-cols-2">
            {THE_LIST.map((item, i) => (
              <Reveal as="li" key={item} delay={Math.min(i, 5) * 45}>
                <span className="flex items-center gap-3.5 border-b border-[#EDEDF0] py-4 text-[17px] leading-[1.35] text-[#1D1D1F] sm:text-[18px]">
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
            <Lede className="mt-10 max-w-[46ch]">
              None of it is worth hunting down a contractor for. So it waits.
            </Lede>
          </Reveal>
        </div>
      </section>

      {/* ========================== HOW IT WORKS ======================= */}
      <section id="how-it-works" className="scroll-mt-2 bg-[#F5F5F7] px-5 py-16 sm:px-8 sm:py-28">
        <div className="mx-auto max-w-[1120px]">
          <Reveal>
            <Eyebrow>How it works</Eyebrow>
            <H2 className="mt-4 max-w-[18ch]">Book it. We come. It&rsquo;s done.</H2>
          </Reveal>

          <div className="mt-10 grid gap-10 sm:mt-14 lg:grid-cols-[0.9fr_1.1fr] lg:items-center lg:gap-16">
            <Reveal className="flex justify-center lg:order-2 lg:hidden">
              <BookingPreview />
            </Reveal>

            <ol className="lg:order-1">
              {STEPS.map((s, i) => (
                <Reveal as="li" key={s.n} delay={i * 70}>
                  <span className="flex gap-5 border-t border-[#DEDEE3] py-6 sm:py-7">
                    <span className="pt-0.5 text-[13px] font-semibold tabular-nums text-[#306EEC]">
                      {s.n}
                    </span>
                    <span className="block">
                      <span className="block text-[20px] font-semibold tracking-[-0.02em] text-[#111111] sm:text-[22px]">
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

      {/* =========================== MEMBERSHIP ======================== */}
      <section className="bg-[#0B1628] px-5 py-20 text-white sm:px-8 sm:py-28">
        <div className="mx-auto max-w-[1120px]">
          <Reveal>
            <Eyebrow tone="light">Membership</Eyebrow>
            <h2 className="mt-4 max-w-[17ch] text-balance text-[30px] font-semibold leading-[1.08] tracking-[-0.035em] sm:text-[42px] lg:text-[48px]">
              One membership. Help around your home.
            </h2>
            <p className="mt-5 max-w-[46ch] text-pretty text-[17px] leading-[1.5] text-white/60 sm:text-[19px]">
              Instead of finding someone each time, you have a company already set up for
              your home. Mounting, repairs, installations, drywall, caulking, fixtures &mdash;
              book as often as you need. There&rsquo;s no monthly visit count.
            </p>
          </Reveal>

          <div className="mt-11 grid gap-3 sm:mt-14 sm:grid-cols-2 lg:grid-cols-4">
            {plans.map((plan, i) => (
              <Reveal key={plan.name} delay={i * 60}>
                {/* Compact row on phones so four plans stay scannable; a card
                    from sm up, where the grid has room to breathe. */}
                <div className="flex h-full items-center justify-between gap-4 rounded-[16px] border border-white/[0.10] bg-white/[0.04] px-5 py-4 sm:flex-col sm:items-start sm:justify-start sm:rounded-[20px] sm:p-6">
                  <div className="min-w-0">
                    <p className="text-[16px] font-semibold tracking-[-0.015em] sm:text-[17px]">
                      {plan.displayName}
                    </p>
                    <p className="mt-1 text-[13.5px] leading-[1.35] text-white/50 sm:mt-1.5 sm:min-h-[40px] sm:text-[14px] sm:leading-[1.4]">
                      {plan.tagline}
                    </p>
                  </div>
                  <p className="flex-none text-[22px] font-semibold tracking-[-0.03em] tabular-nums sm:mt-5 sm:text-[30px]">
                    ${plan.price}
                    <span className="text-[13px] font-medium text-white/45 sm:text-[15px]">/mo</span>
                  </p>
                </div>
              </Reveal>
            ))}
          </div>

          <Reveal delay={80}>
            <div className="mt-9 flex flex-col gap-3 sm:flex-row sm:items-center">
              <QuietLink href="/membership" placement="membership_band" tone="light">
                See membership
              </QuietLink>
              <p className="text-[14px] text-white/40 sm:ml-2">Month to month. Cancel any time.</p>
            </div>
          </Reveal>
        </div>
      </section>

      {/* =========================== FREE VISIT ======================== */}
      <section className="px-5 py-16 sm:px-8 sm:py-28">
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
            <dl className="mt-10 divide-y divide-[#EDEDF0] border-y border-[#EDEDF0]">
              {[
                ["Cost", "$0. No card needed to book."],
                ["Length", "One 90-minute visit of standard handyman work."],
                ["We'll need", "A photo of the job, so your technician arrives prepared."],
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
            <div className="mt-10">
              <BookFree href={bookHref} placement="offer_section" />
            </div>
          </Reveal>
        </div>
      </section>

      {/* ========================== BIGGER PROJECTS ==================== */}
      <section className="bg-[#F5F5F7] px-5 py-16 sm:px-8 sm:py-24">
        <div className="mx-auto max-w-[1120px]">
          <Reveal>
            <Eyebrow>Bigger projects</Eyebrow>
            <H2 className="mt-4 max-w-[20ch]">Small fix today. Bigger project later.</H2>
            <Lede className="mt-5 max-w-[46ch]">
              The same company that hangs your shelf also does kitchens, bathrooms, roofing
              and siding. Work at that scale gets its own estimate.
            </Lede>
          </Reveal>

          <div className="mt-10 grid gap-3 sm:mt-12 sm:grid-cols-3">
            {PROJECTS.map((p, i) => (
              <Reveal key={p.label} delay={i * 70}>
                <figure className="group relative overflow-hidden rounded-[20px] bg-[#E5E5EA]">
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
              <QuietLink href="/projects" placement="projects_band">
                See projects
              </QuietLink>
            </div>
          </Reveal>
        </div>
      </section>

      {/* ========================= TRUST + CLOSE ======================= */}
      <section className="px-5 py-16 sm:px-8 sm:py-28">
        <div className="mx-auto max-w-[1120px]">
          <div className="grid gap-12 lg:grid-cols-[1fr_380px] lg:gap-16">
            <Reveal>
              <Eyebrow>Who comes to your home</Eyebrow>
              <H2 className="mt-4 max-w-[16ch]">A local company, not a marketplace.</H2>
              <Lede className="mt-5 max-w-[46ch]">
                ProFixter is based near Babylon and serves Nassau and Suffolk. You work with
                the same company each time, so nobody has to learn your house twice.
              </Lede>

              <dl className="mt-9 grid grid-cols-1 gap-px overflow-hidden rounded-[16px] border border-[#E5E5EA] bg-[#E5E5EA] sm:grid-cols-3">
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
            </Reveal>

            <Reveal delay={90}>
              <figure className="overflow-hidden rounded-[22px] bg-[#F5F5F7]">
                <div className="relative aspect-[4/3]">
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
                    &ldquo;Every small job used to mean starting over &mdash; searching,
                    explaining, waiting. We built ProFixter so it doesn&rsquo;t.&rdquo;
                  </p>
                </figcaption>
              </figure>
            </Reveal>
          </div>

          {/* Close */}
          <Reveal delay={60}>
            <div className="mt-20 border-t border-[#EDEDF0] pt-14 text-center sm:mt-24 sm:pt-16">
              <H2 className="mx-auto max-w-[17ch]">Start with whatever&rsquo;s been waiting longest.</H2>
              <p className="mx-auto mt-4 max-w-[38ch] text-[17px] leading-[1.5] text-[#6E6E73]">
                Your first 90-minute visit is free. No card required.
              </p>
              <div className="mt-8 flex justify-center">
                <BookFree href={bookHref} placement="final" className="sm:min-w-[280px]" />
              </div>
              <p className="mt-7 text-[15px] text-[#A1A1A6]">
                Not ready for a membership?{" "}
                <Link
                  href="/book"
                  onClick={() => trackEvent("one_time_link_clicked", { placement: "final" })}
                  className="inline-block py-1 font-semibold text-[#306EEC] underline-offset-4 hover:underline"
                >
                  Book a one-time visit
                </Link>
              </p>
            </div>
          </Reveal>
        </div>
      </section>
    </main>
  );
}
