import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import GiftCallout from "@/app/components/gift/GiftCallout";
import Header from "@/app/components/sections/Header";
import Footer from "@/app/components/sections/Footer";
import MembershipCtaLink from "@/app/components/membership/MembershipCtaLink";
import { absoluteUrl, DEFAULT_OG_IMAGE } from "@/lib/seo";
import { CORE_PRODUCTS, HOME_SUPPORT_AI } from "@/lib/site-architecture";

export const metadata: Metadata = {
  title: {
    absolute: "About Profixter | Long Island's Modern Home Platform",
  },
  description:
    "Meet the local team behind Profixter: Membership, $99 handyman visits, Profixter AI, and renovation estimates for Long Island homeowners.",
  alternates: {
    canonical: "/about",
  },
  openGraph: {
    title: "About Profixter | Long Island's Modern Home Platform",
    description:
      "Learn why Profixter was built to make home ownership simpler with Membership, $99 visits, AI guidance, and renovation estimates.",
    url: absoluteUrl("/about"),
    siteName: "Profixter",
    type: "website",
    images: [DEFAULT_OG_IMAGE],
  },
  twitter: {
    card: "summary_large_image",
    title: "About Profixter | Long Island's Modern Home Platform",
    description:
      "Meet the local team behind Profixter: membership, handyman visits, home projects, and Profixter AI on Long Island.",
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
    href: CORE_PRODUCTS[0].href,
    cta: CORE_PRODUCTS[0].cta,
    body: "One local team that learns your home and keeps the list moving, month after month.",
    featured: true,
  },
  {
    title: CORE_PRODUCTS[1].shortTitle,
    role: "One job, one visit",
    href: CORE_PRODUCTS[1].href,
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
    title: HOME_SUPPORT_AI.shortTitle,
    role: "Before you hire anyone",
    href: HOME_SUPPORT_AI.href,
    cta: HOME_SUPPORT_AI.cta,
    body: "Free guidance on repairs, materials, quotes and whether a job is worth doing yourself.",
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
  ["Licensed", "NY HIC HI-71484, held by Premium Island Homes Inc."],
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
    q: "What is Profixter AI?",
    a: "Free guidance before you hire anyone: repairs, maintenance, safety, materials, reading a contractor's quote, and whether a job is worth doing yourself.",
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

function Tick() {
  return (
    <span className="mt-0.5 flex h-[18px] w-[18px] flex-none items-center justify-center rounded-full bg-[#E6EEFE] text-[#306EEC]">
      <svg width="9" height="7" viewBox="0 0 9 7" fill="none" aria-hidden="true">
        <path d="M1 3.5l2 2L8 1" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
    </span>
  );
}

/**
 * ABOUT — the page for somebody who chose to learn more.
 *
 * Home shows; this explains. That division is the whole point of the redesign:
 * the homepage stopped being a manual so that the information in it could live
 * somewhere a person arrives at on purpose, rather than somewhere they have to
 * scroll through eleven screens of on their way to a button.
 *
 * It uses the same type scale and rhythm as Home (the mk- primitives), so it
 * reads as the same product at a different density - denser, because the
 * visitor asked for density by coming here.
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
        {/* ============================ HERO ============================ */}
        <section className="mk-beat">
          <div className="mk-wrap">
            <p className="mk-eyebrow">About Profixter</p>
            <h1 className="mk-h2">One company to take care of your home.</h1>
            <p className="mk-lede">
              Instead of finding somebody new every time something breaks, you have a local
              team that already knows the house.
            </p>
          </div>
        </section>

        {/* ======================= WHY IT EXISTS ======================== */}
        {/*
          The founder, in his own voice, near the top.

          This is the one thing on the site nobody else can copy, and it answers
          the question About exists to answer better than any paragraph we could
          write around it.
        */}
        <section className="mk-beat pt-0" aria-labelledby="about-why">
          <div className="mk-wrap">
            <div className="grid gap-8 lg:grid-cols-[0.95fr_1.05fr] lg:items-center lg:gap-12">
              <div>
                <p className="mk-eyebrow">Why it exists</p>
                <h2 id="about-why" className="mk-h2">
                  Built because every small job started over.
                </h2>
                <p className="mk-lede">
                  Searching, explaining, waiting, and hoping somebody turns up. Profixter
                  was built so a homeowner only has to do that once.
                </p>
                <figure className="mt-7 flex items-center gap-3.5">
                  <Image
                    src="/images/Taras.png"
                    alt=""
                    width={48}
                    height={48}
                    className="h-12 w-12 flex-none rounded-full object-cover object-top"
                  />
                  <figcaption className="text-[14px] leading-snug">
                    <span className="block font-semibold text-[#0B1628]">Taras Bandura</span>
                    <span className="block text-[#8A94A6]">Founder</span>
                  </figcaption>
                </figure>
              </div>

              <div className="aspect-video overflow-hidden rounded-[14px] border border-[#E2E8F4] bg-black shadow-[0_18px_50px_rgba(11,22,40,0.14)]">
                <iframe
                  src="https://www.youtube.com/embed/HQoAkLNGI9c?rel=0"
                  title="Why Profixter was built"
                  loading="lazy"
                  allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                  allowFullScreen
                  className="h-full w-full"
                />
              </div>
            </div>
          </div>
        </section>

        {/* =================== WHAT A MEMBERSHIP COVERS ================== */}
        <section className="mk-beat bg-[#F6F8FC]" aria-labelledby="about-covers">
          <div className="mk-wrap">
            <p className="mk-eyebrow">What it covers</p>
            <h2 id="about-covers" className="mk-h2">
              The everyday kind of work.
            </h2>
            <p className="mk-lede">
              The jobs that are too small to call a contractor about and too annoying to
              leave. Larger work is quoted separately.
            </p>

            <ul className="mt-8 grid gap-x-8 gap-y-3.5 sm:grid-cols-2 lg:grid-cols-3">
              {COVERED.map((item) => (
                <li key={item} className="flex items-start gap-2.5 text-[16px] text-[#20304A]">
                  <Tick />
                  {item}
                </li>
              ))}
            </ul>

            <p className="mt-8 text-[15px]">
              <Link href="/recent-work" className="font-semibold text-[#306EEC] underline-offset-4 hover:underline">
                See real finished jobs
              </Link>
            </p>
          </div>
        </section>

        {/* ======================== WAYS TO WORK ========================= */}
        <section id="ways-to-work" className="mk-beat scroll-mt-[110px]" aria-labelledby="about-ways">
          <div className="mk-wrap">
            <p className="mk-eyebrow">Ways to work with us</p>
            <h2 id="about-ways" className="mk-h2">
              Start where it fits.
            </h2>

            <div className="mt-9 grid gap-4 sm:grid-cols-2">
              {WAYS.map((w) => (
                <div
                  key={w.title}
                  className={`flex flex-col rounded-[14px] border p-6 ${
                    w.featured
                      ? "border-[#306EEC]/35 bg-[#F4F8FF]"
                      : "border-[#E2E8F4] bg-white"
                  }`}
                >
                  <p className="text-[11px] font-bold uppercase tracking-[0.13em] text-[#8A94A6]">
                    {w.role}
                  </p>
                  <h3 className="mt-2.5 text-[22px] font-bold tracking-[-0.03em] text-[#0B1628]">
                    {w.title}
                  </h3>
                  <p className="mt-2.5 flex-1 text-[15px] leading-[1.55] text-[#5B6577]">{w.body}</p>
                  <Link
                    href={w.href}
                    className="mt-5 inline-flex items-center gap-1.5 text-[15px] font-semibold text-[#306EEC] underline-offset-4 hover:underline"
                  >
                    {w.cta}
                    <svg width="6" height="10" viewBox="0 0 7 12" aria-hidden="true">
                      <path d="M1 1l5 5-5 5" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round" fill="none" />
                    </svg>
                  </Link>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* ========================= LOCAL + TRUST ====================== */}
        <section className="mk-beat bg-[#0B1628] text-white" aria-labelledby="about-trust">
          <div className="mk-wrap">
            <p className="mk-eyebrow !text-white/45">Who you are dealing with</p>
            <h2 id="about-trust" className="mk-h2 !text-white">
              A local company, not a marketplace.
            </h2>
            <p className="mk-lede !text-white/60">
              You are not being matched with whoever is free. You work with the same
              company each time, and nobody has to learn your house twice.
            </p>

            <dl className="mt-9 grid gap-x-10 gap-y-7 sm:grid-cols-2">
              {TRUST.map(([k, v]) => (
                <div key={k}>
                  <dt className="text-[11px] font-bold uppercase tracking-[0.14em] text-white/40">{k}</dt>
                  <dd className="mt-2 text-[16px] leading-[1.5] text-white/82">{v}</dd>
                </div>
              ))}
            </dl>
          </div>
        </section>

        {/* ============================= FAQ ============================ */}
        <section className="mk-beat" aria-labelledby="about-faq">
          <div className="mk-wrap">
            <p className="mk-eyebrow">Questions</p>
            <h2 id="about-faq" className="mk-h2">
              Before you choose.
            </h2>

            <dl className="mt-8 divide-y divide-[#E6EBF4] border-t border-[#E6EBF4]">
              {faqs.map((faq) => (
                <div key={faq.q} className="py-6">
                  <dt className="text-[17px] font-bold tracking-[-0.02em] text-[#0B1628]">{faq.q}</dt>
                  <dd className="mt-2.5 max-w-[62ch] text-[16px] leading-[1.55] text-[#5B6577]">{faq.a}</dd>
                </div>
              ))}
            </dl>
          </div>
        </section>

        {/* ============================ GIFT ============================ */}
        {/* Once. It was on this page twice - once near the top and again in the
            middle of the product cards.

            Rendered bare: GiftCallout's band variant is a full-bleed section of
            its own, so wrapping it in another section produced two nested
            sections saying the same thing, which is how it came back. */}
        <GiftCallout />

        {/* ============================ CLOSE =========================== */}
        <section className="home-close" aria-labelledby="about-close">
          <div className="mk-wrap">
            <h2 id="about-close" className="mk-h2">
              Start with whatever&rsquo;s been waiting longest.
            </h2>
            <p className="mk-lede">Your first 90-minute visit is free. No card required.</p>
            <div className="mt-8 flex flex-wrap items-center gap-4">
              <MembershipCtaLink className="home-cta !mt-0">
                Get Started
              </MembershipCtaLink>
              <p className="home-quiet !mt-0">
                <Link href="/membership">See what&rsquo;s included</Link>
              </p>
            </div>
          </div>
        </section>
      </main>

      <Footer />
    </div>
  );
}
