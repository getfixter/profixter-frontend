import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import GiftCallout from "@/app/components/gift/GiftCallout";
import Header from "@/app/components/sections/Header";
import Footer from "@/app/components/sections/Footer";
import Reveal from "@/app/components/ui/Reveal";
import { absoluteUrl, DEFAULT_OG_IMAGE } from "@/lib/seo";
import { BOOKING_LINKS, CORE_PRODUCTS } from "@/lib/site-architecture";

export const metadata: Metadata = {
  title: {
    absolute: "About Profixter | Long Island's Modern Home Platform",
  },
  description:
    "Meet the local team behind Profixter: Membership, $99 handyman visits, and renovation estimates for Long Island homeowners.",
  alternates: {
    canonical: "/about",
  },
  openGraph: {
    title: "About Profixter | Long Island's Modern Home Platform",
    description:
      "Learn why Profixter was built to make home ownership simpler with Membership, $99 visits, and renovation estimates.",
    url: absoluteUrl("/about"),
    siteName: "Profixter",
    type: "website",
    images: [DEFAULT_OG_IMAGE],
  },
  twitter: {
    card: "summary_large_image",
    title: "About Profixter | Long Island's Modern Home Platform",
    description:
      "Meet the local team behind Profixter: membership, handyman visits, and home projects on Long Island.",
    images: [DEFAULT_OG_IMAGE.url],
  },
};

/**
 * What a membership is actually for, moved here from the homepage.
 *
 * The homepage used to carry this as a paragraph - "mounting, repairs,
 * installations, replacements, adjustments and maintenance" - underneath a
 * heading, above photographs that already showed it. It is genuinely useful to
 * somebody deciding, and this is the page they are on when they decide.
 */
const COVERED = [
  "Mounting and hanging",
  "Small repairs",
  "Installations",
  "Replacements",
  "Adjustments",
  "Seasonal maintenance",
];

const WAYS = [
  {
    title: CORE_PRODUCTS[0].shortTitle,
    role: "The main way people work with us",
    href: BOOKING_LINKS.memberships.href,
    cta: CORE_PRODUCTS[0].cta,
    body: "One local team that learns your home and keeps the list moving, month after month.",
    featured: true,
  },
  {
    title: CORE_PRODUCTS[1].shortTitle,
    role: "One job, one visit",
    // Straight to the One-Time flow; a bare /book opens on Book Fixter.
    href: BOOKING_LINKS.oneTime.href,
    cta: CORE_PRODUCTS[1].cta,
    body: "A single focused visit when a membership is not the right fit today.",
    featured: false,
  },
  {
    title: CORE_PRODUCTS[2].shortTitle,
    role: "When the work is larger",
    href: CORE_PRODUCTS[2].href,
    cta: CORE_PRODUCTS[2].cta,
    body: "Bathrooms, kitchens, roofing, siding and remodels, quoted separately through an estimate.",
    featured: false,
  },
  {
    title: "Full Day Fixter",
    role: "A longer list, one day",
    href: BOOKING_LINKS.fullDay.href,
    cta: "Book a full day",
    body: "One Fixter for about eight hours, working through the whole list.",
    featured: false,
  },
] as const;

/**
 * The trust facts, consolidated.
 *
 * ProFixter is a trading name of Premium Island Homes Inc. That is the entity
 * on the licence, on the invoices and on our carrier-registered messaging
 * brand, and About is the first place a customer - or a reviewer checking that
 * this website belongs to that company - will look for it.
 */
const TRUST: Array<[string, string]> = [
  ["Licensed", "Suffolk County home improvement license HI-71484"],
  ["Insured", "Covered for work inside your home."],
  ["Local", "Based near Babylon, serving Nassau and Suffolk."],
  ["Same team", "The people who come back already know your house."],
];

/*
 * The questions, minus the ones the page above now answers.
 *
 * "Are you local?" and "How do I get started?" were both here and both
 * answered two sections higher up - the first by the Local card, the second by
 * the four ways to work. A FAQ that repeats the page it is on is how a page
 * gets to a thousand words without saying anything new.
 */
const faqs = [
  {
    q: "Can I book one visit instead of joining?",
    a: "Yes. Book a visit when you only need one small job handled, and join later if it turns out to be useful.",
  },
  {
    q: "Do you do renovations?",
    a: "Yes. Bathrooms, kitchens, roofing, siding and multi-day work start with a project estimate rather than a membership visit, handled by the same local company.",
  },
  {
    q: "What is the Free Visit?",
    a: "A free in-person visit: a Profixter team member goes over your to-do list, explains what we handle and which tasks suit a membership, and answers your questions. Repairs and labor aren't part of the Free Visit. No account needed.",
  },
  {
    q: "Do you repair appliances?",
    a: "No. For an appliance, use the manufacturer, the warranty provider, or an appliance repair specialist.",
  },
];

const faqJsonLd = {
  "@context": "https://schema.org",
  "@type": "FAQPage",
  mainEntity: faqs.map((faq) => ({
    "@type": "Question",
    name: faq.q,
    acceptedAnswer: { "@type": "Answer", text: faq.a },
  })),
};

/**
 * ABOUT — the page for somebody who chose to learn more.
 *
 * Home shows; this explains. It wears the same design system as Home, at a
 * slightly higher density, because the visitor asked for density by coming
 * here. Every section the page has always had is still here, shorter.
 */
export default function AboutPage() {
  return (
    <div className="min-h-screen bg-white">
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(faqJsonLd) }}
      />
      <div className="sticky top-0 z-50">
        <Header />
      </div>

      <main>
        {/* ======================= HERO + WHY IT EXISTS ======================= */}
        {/*
          The founder, in his own voice, beside the headline: the one thing on
          the site nobody else can copy, and the best answer to who we are.
        */}
        <section className="ui-section ui-section--tight" aria-labelledby="about-why">
          <div className="ui-container grid gap-8 lg:grid-cols-[0.95fr_1.05fr] lg:items-center lg:gap-14">
            <div className="ui-rise">
              <p className="ui-eyebrow ui-eyebrow--accent">About Profixter</p>
              <h1 className="ui-display">One company to take care of your home.</h1>
              <p className="ui-lede">
                Instead of finding somebody new every time something breaks, you have a local
                team that already knows the house.
              </p>
              <h2 id="about-why" className="ui-h3 mt-7">
                Built because every small job started over.
              </h2>
              <p className="ui-body mt-1.5 max-w-[52ch]">
                Searching, explaining, waiting, and hoping somebody turns up. Profixter
                was built so a homeowner only has to do that once.
              </p>
              <figure className="mt-5 flex items-center gap-3">
                <Image
                  src="/images/Taras.png"
                  alt=""
                  width={44}
                  height={44}
                  className="h-11 w-11 flex-none rounded-full object-cover object-top"
                />
                <figcaption className="text-[14px] leading-snug">
                  <span className="block font-semibold text-[color:var(--ui-ink)]">Taras Bandura</span>
                  <span className="block text-[color:var(--ui-text-3)]">Founder</span>
                </figcaption>
              </figure>
            </div>

            <div className="ui-media ui-rise aspect-video bg-black shadow-[var(--ui-shadow-3)]" style={{ animationDelay: "60ms" }}>
              <iframe
                src="https://www.youtube.com/embed/HQoAkLNGI9c?rel=0"
                title="Why Profixter was built"
                loading="lazy"
                allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                allowFullScreen
                className="absolute inset-0 h-full w-full"
              />
            </div>
          </div>
        </section>

        {/* =================== WHAT A MEMBERSHIP COVERS ================== */}
        <section className="ui-section ui-section--soft ui-section--tight" aria-labelledby="about-covers">
          <div className="ui-container grid gap-6 lg:grid-cols-[0.95fr_1.05fr] lg:gap-14">
            <Reveal>
              <p className="ui-eyebrow">What it covers</p>
              <h2 id="about-covers" className="ui-h2">The everyday kind of work.</h2>
              <p className="ui-lede">
                The jobs that are too small to call a contractor about and too annoying to
                leave. Larger work is quoted separately.
              </p>
            </Reveal>
            <Reveal delay={60}>
              <ul className="ui-checks sm:grid-cols-2 lg:pt-8">
                {COVERED.map((item) => (
                  <li key={item} className="!text-[15px]">{item}</li>
                ))}
              </ul>
              <Link href="/recent-work" className="ui-link mt-4">
                See real finished jobs
              </Link>
            </Reveal>
          </div>
        </section>

        {/* ======================== WAYS TO WORK ========================= */}
        <section id="ways-to-work" className="ui-section ui-section--tight scroll-mt-[90px]" aria-labelledby="about-ways">
          <div className="ui-container">
            <div className="ui-head">
              <p className="ui-eyebrow">Ways to work with us</p>
              <h2 id="about-ways" className="ui-h2">Start where it fits.</h2>
            </div>
            <div className="pg-cards pg-cards--4">
              {WAYS.map((w, index) => (
                <Reveal key={w.title} delay={index * 50}>
                  <Link
                    href={w.href}
                    className={`ui-card ui-card--link flex h-full flex-col ${w.featured ? "ui-card--dark" : ""}`}
                  >
                    <span className={`text-[13px] font-medium ${w.featured ? "text-[color:var(--ui-on-dark-2)]" : "text-[color:var(--ui-text-3)]"}`}>
                      {w.role}
                    </span>
                    <span className={`mt-1.5 text-[19px] font-semibold tracking-[-0.02em] ${w.featured ? "text-white" : "text-[color:var(--ui-ink)]"}`}>
                      {w.title}
                    </span>
                    <span className={`mt-1.5 flex-1 text-[14px] leading-[1.5] ${w.featured ? "text-[color:var(--ui-on-dark-2)]" : "text-[color:var(--ui-text-2)]"}`}>
                      {w.body}
                    </span>
                    <span className={`ui-link mt-3 ${w.featured ? "!text-white" : ""}`}>{w.cta}</span>
                  </Link>
                </Reveal>
              ))}
            </div>
          </div>
        </section>

        {/* ========================= LOCAL + TRUST ====================== */}
        <section className="ui-section ui-section--tight bg-[color:var(--ui-ink)] text-white" aria-labelledby="about-trust">
          <div className="ui-container grid gap-8 lg:grid-cols-[0.95fr_1.05fr] lg:gap-14">
            <Reveal>
              <p className="ui-eyebrow !text-[color:var(--ui-on-dark-2)]">Who you are dealing with</p>
              <h2 id="about-trust" className="ui-h2 !text-white">A local company, not a marketplace.</h2>
              <p className="ui-lede !text-[color:var(--ui-on-dark-2)]">
                You are not being matched with whoever is free. You work with the same
                company each time, and nobody has to learn your house twice.
              </p>
            </Reveal>
            <Reveal delay={60}>
              <dl className="grid gap-x-8 gap-y-5 sm:grid-cols-2 lg:pt-8">
                {TRUST.map(([k, v]) => (
                  <div key={k} className="border-t border-white/15 pt-3">
                    <dt className="text-[12px] font-semibold uppercase tracking-[0.14em] text-[color:var(--ui-on-dark-2)]">{k}</dt>
                    <dd className="mt-1 text-[15px] leading-[1.5] text-[color:var(--ui-on-dark)]">{v}</dd>
                  </div>
                ))}
              </dl>
            </Reveal>
          </div>
        </section>

        {/* ============================= FAQ ============================ */}
        <section className="ui-section ui-section--tight" aria-labelledby="about-faq">
          <div className="ui-container ui-container--narrow">
            <p className="ui-eyebrow">Questions</p>
            <h2 id="about-faq" className="ui-h2">Before you choose.</h2>
            <div className="ui-faq mt-5">
              {faqs.map((faq) => (
                <details key={faq.q}>
                  <summary>{faq.q}</summary>
                  <p className="ui-faq__a">{faq.a}</p>
                </details>
              ))}
            </div>
          </div>
        </section>

        {/* ============================ GIFT ============================ */}
        {/* Once, and rendered bare: GiftCallout's band is a section of its own. */}
        <GiftCallout />

        {/* ============================ CLOSE =========================== */}
        <section className="ui-section ui-section--tight ui-section--soft" aria-labelledby="about-close">
          <div className="ui-container text-center">
            <h2 id="about-close" className="ui-h2">Start with whatever&rsquo;s been waiting longest.</h2>
            <p className="ui-lede mx-auto">Let&rsquo;s take a look at your to-do list. The visit is free, no account needed.</p>
            {/*
              An explicit Get Started, not MembershipCtaLink: that component
              picks its own label (See plans, for visitors) and would silently
              discard this one. About closes the way Home does.
            */}
            <div className="pg-actions justify-center">
              <Link href="/signup?source=about" className="ui-btn ui-btn--primary ui-btn--lg">
                Get Started
              </Link>
              <Link href="/membership/plans" className="ui-btn ui-btn--secondary ui-btn--lg">
                See plans
              </Link>
            </div>
          </div>
        </section>
      </main>

      <Footer />
    </div>
  );
}
