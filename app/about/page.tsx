import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import Header from "@/app/components/sections/Header";
import Footer from "@/app/components/sections/Footer";

const siteUrl = "https://www.profixter.com";

export const metadata: Metadata = {
  title: "About Us | Long Island Home Support Company",
  description:
    "Learn about Profixter, a Long Island home service platform helping homeowners with Profixter AI, one-time handyman visits, Membership, and renovation estimates.",
  alternates: {
    canonical: "/about",
  },
  openGraph: {
    title: "About Profixter | Long Island Home Support Company",
    description:
      "Profixter helps Long Island homeowners get clearer home help through AI, one-time handyman visits, Membership, and larger project estimates.",
    url: `${siteUrl}/about`,
    siteName: "Profixter",
    type: "website",
    images: [
      {
        url: "/images/hero-bg.webp",
        width: 1200,
        height: 630,
        alt: "Profixter home support for Long Island homeowners",
      },
    ],
  },
  twitter: {
    card: "summary_large_image",
    title: "About Profixter | Long Island Home Support Company",
    description:
      "A local Long Island platform for home answers, handyman visits, Membership, and renovation estimates.",
    images: ["/images/hero-bg.webp"],
  },
};

const productCards = [
  {
    title: "Profixter AI",
    eyebrow: "Free home answers",
    href: "/home-support",
    cta: "Try Profixter AI",
    body: "Ask about repairs, maintenance, photos, PDFs, contractor quotes, materials, shopping lists, safety, and whether to DIY or hire.",
    accent: "bg-[#306EEC]",
  },
  {
    title: "Book Handyman",
    eyebrow: "$99 / 90 minutes",
    href: "/book",
    cta: "Book Handyman",
    body: "For one focused small job. Choose the task, date, time, notes, and photos before secure checkout and admin approval.",
    accent: "bg-[#16A34A]",
  },
  {
    title: "Membership",
    eyebrow: "Ongoing home care",
    href: "/membership",
    cta: "Become a Member",
    body: "For homeowners who want recurring support, better long-term value, and a team that learns their home over time.",
    accent: "bg-[#0B1628]",
  },
  {
    title: "Renovation",
    eyebrow: "Home Projects",
    href: "/projects",
    cta: "Request Renovation Estimate",
    body: "For larger work like bathrooms, kitchens, roofing, siding, remodeling, and projects that need a real estimate path.",
    accent: "bg-[#D97706]",
  },
];

const trustItems = [
  {
    title: "Long Island focused",
    body: "Built for Nassau and Suffolk homeowners, with a local base near Babylon and a practical understanding of real homes here.",
  },
  {
    title: "Licensed and insured",
    body: "Profixter operates with NY State Home Improvement Contractor license HI-71484 and insurance for peace of mind.",
  },
  {
    title: "Clear booking",
    body: "Homeowners choose the path that fits: free AI help, a one-time visit, Membership, or a larger project estimate.",
  },
  {
    title: "No contractor chasing",
    body: "The goal is fewer callbacks, less guessing, and a better organized way to get help at home.",
  },
  {
    title: "Online scheduling",
    body: "Small visit requests use online scheduling, photos, notes, and real admin approval before the visit is confirmed.",
  },
  {
    title: "The right scope",
    body: "Small jobs stay small. Larger or multi-day work moves to Project Estimate. Appliance repair is not offered.",
  },
];

const serviceAreas = [
  "Long Island",
  "Nassau County",
  "Suffolk County",
  "Babylon area",
  "Nearby communities",
  "Residential homeowners",
];

const faqs = [
  {
    q: "Are you a handyman company?",
    a: "Yes. Profixter provides handyman help for small home tasks, but it is also more than a traditional handyman company. Homeowners can use Profixter AI, book one visit, become a Member, or request estimates for larger work.",
  },
  {
    q: "What is Membership?",
    a: "Membership is Profixter's ongoing home care option. Members can request regular handyman help, get better long-term value than one-off visits, and work with a team that learns their home.",
  },
  {
    q: "Can I book one visit?",
    a: "Yes. Book Handyman is a one-time visit for one small job, up to 90 minutes. You choose the task, time, notes, and photos before checkout. Admin approval happens after payment.",
  },
  {
    q: "Do you do renovations?",
    a: "Yes. Larger work like bathrooms, kitchens, roofing, siding, remodeling, and multi-day projects should start through the Home Projects estimate path.",
  },
  {
    q: "What is Profixter AI?",
    a: "Profixter AI is a free homeowner assistant for questions about repairs, maintenance, safety, materials, contractor quotes, PDFs, shopping lists, and DIY-or-hire decisions.",
  },
  {
    q: "Do you repair appliances?",
    a: "No. Profixter does not offer appliance repair. For appliance issues, use the manufacturer, warranty provider, or a qualified appliance repair specialist.",
  },
  {
    q: "Are you local?",
    a: "Yes. Profixter is Long Island focused, based near Babylon, and serves homeowners across Nassau and Suffolk Counties.",
  },
  {
    q: "How do I get started?",
    a: "Start with Profixter AI if you are unsure, Book Handyman for one small job, Membership for ongoing home maintenance, or Home Projects for larger renovation work.",
  },
];

const faqJsonLd = {
  "@context": "https://schema.org",
  "@type": "FAQPage",
  mainEntity: faqs.map((faq) => ({
    "@type": "Question",
    name: faq.q,
    acceptedAnswer: {
      "@type": "Answer",
      text: faq.a,
    },
  })),
};

function CheckIcon() {
  return (
    <svg
      width="15"
      height="15"
      viewBox="0 0 24 24"
      fill="none"
      aria-hidden="true"
      className="mt-0.5 flex-shrink-0 text-[#306EEC]"
    >
      <path
        d="M5 12.5l4 4 10-10"
        stroke="currentColor"
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth="2.4"
      />
    </svg>
  );
}

function ProductCard({ product }: { product: (typeof productCards)[number] }) {
  return (
    <Link
      href={product.href}
      className="group rounded-[22px] border border-[#DDE5F0] bg-white p-5 shadow-[0_18px_54px_rgba(15,23,42,0.06)] transition hover:-translate-y-1 hover:border-[#C7D9FF] hover:shadow-[0_28px_80px_rgba(48,110,236,0.12)]"
    >
      <span className={`mb-5 block h-2 w-12 rounded-full ${product.accent}`} />
      <span className="text-[11px] font-black uppercase tracking-[0.18em] text-[#306EEC]">
        {product.eyebrow}
      </span>
      <h3 className="mt-2 text-[24px] font-black leading-tight text-[#0B1628]">
        {product.title}
      </h3>
      <p className="mt-3 text-[14px] leading-6 text-[#64748B]">{product.body}</p>
      <span className="mt-5 inline-flex text-[14px] font-black text-[#0B1628]">
        {product.cta}
        <span className="ml-2 transition group-hover:translate-x-1">-&gt;</span>
      </span>
    </Link>
  );
}

export default function AboutPage() {
  return (
    <main className="min-h-screen bg-[#F6F8FC] text-[#0B1628]">
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(faqJsonLd) }}
      />
      <Header />

      <section className="relative overflow-hidden px-4 pb-12 pt-4 sm:px-6 sm:pb-16 lg:px-8">
        <div className="absolute inset-0 -z-10">
          <Image
            src="/images/hero-bg.webp"
            alt=""
            fill
            priority
            className="object-cover"
            sizes="100vw"
          />
          <div className="absolute inset-0 bg-[linear-gradient(180deg,rgba(246,248,252,0.98)_0%,rgba(246,248,252,0.92)_45%,rgba(246,248,252,1)_100%)]" />
        </div>

        <div className="mx-auto grid max-w-[1240px] gap-8 lg:grid-cols-[1.05fr_0.95fr] lg:items-center">
          <div className="pt-4 sm:pt-8 lg:pt-14">
            <div className="inline-flex items-center gap-2 rounded-full border border-[#D9E4FF] bg-white/88 px-4 py-2 shadow-sm backdrop-blur">
              <span className="h-2 w-2 rounded-full bg-[#86EFAC]" />
              <span className="text-[11px] font-black uppercase tracking-[0.18em] text-[#306EEC]">
                Babylon based - Nassau and Suffolk
              </span>
            </div>
            <h1 className="mt-5 max-w-[760px] text-[42px] font-black leading-[0.96] tracking-[-0.045em] text-[#0B1628] sm:text-[64px] lg:text-[76px]">
              A better way for Long Island homeowners to get help.
            </h1>
            <p className="mt-5 max-w-[680px] text-[16px] font-medium leading-8 text-[#34435C] sm:text-[18px]">
              Profixter is a modern local home service company built around four clear paths: free Home Support AI, one-time handyman visits, Membership, and renovation estimates for larger projects.
            </p>
            <p className="mt-4 max-w-[640px] text-[15px] leading-7 text-[#64748B]">
              We exist because homeowners should not have to chase contractors, decode vague pricing, or start from zero every time something in the house needs attention.
            </p>

            <div className="mt-7 grid gap-3 sm:grid-cols-2">
              <Link
                href="/home-support"
                className="inline-flex h-[54px] items-center justify-center rounded-[16px] bg-[#306EEC] px-5 text-[15px] font-extrabold text-white shadow-[0_16px_48px_rgba(48,110,236,0.30)] transition hover:-translate-y-0.5 hover:bg-[#2558c9]"
              >
                Try Profixter AI
              </Link>
              <Link
                href="/book"
                className="inline-flex h-[54px] items-center justify-center rounded-[16px] border border-[#C5CBD8] bg-white/92 px-5 text-[15px] font-extrabold text-[#0B1628] transition hover:border-[#306EEC] hover:text-[#306EEC]"
              >
                Book Handyman
              </Link>
            </div>
          </div>

          <div className="rounded-[30px] border border-white/70 bg-white/86 p-4 shadow-[0_28px_90px_rgba(15,23,42,0.12)] backdrop-blur-xl sm:p-5 lg:p-6">
            <div className="overflow-hidden rounded-[24px] bg-[#0B1628]">
              <div className="relative aspect-[4/3]">
                <Image
                  src="/images/Taras.png"
                  alt="Taras Bandura, founder of Profixter"
                  fill
                  className="object-cover object-top"
                  sizes="(max-width: 1024px) 100vw, 520px"
                />
                <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-[#0B1628] via-[#0B1628]/75 to-transparent p-5 text-white">
                  <div className="text-[12px] font-black uppercase tracking-[0.18em] text-white/55">
                    Founder
                  </div>
                  <div className="mt-1 text-[28px] font-black leading-none">
                    Taras Bandura
                  </div>
                </div>
              </div>
            </div>
            <div className="mt-4 grid gap-3 sm:grid-cols-3">
              {["Licensed HI-71484", "Fully insured", "Local team"].map((item) => (
                <div key={item} className="rounded-[16px] bg-[#F8FAFF] px-4 py-3 text-[12px] font-black uppercase tracking-[0.12em] text-[#34435C]">
                  {item}
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      <section className="px-4 py-12 sm:px-6 lg:px-8">
        <div className="mx-auto grid max-w-[1240px] gap-6 lg:grid-cols-[0.85fr_1.15fr] lg:items-start">
          <div className="lg:sticky lg:top-8">
            <div className="text-[11px] font-black uppercase tracking-[0.2em] text-[#306EEC]">
              Founder story
            </div>
            <h2 className="mt-3 text-[34px] font-black leading-[1.02] tracking-[-0.04em] text-[#0B1628] sm:text-[52px]">
              Built because home help became too hard to trust.
            </h2>
          </div>

          <div className="rounded-[28px] border border-[#DDE5F0] bg-white p-6 shadow-[0_22px_70px_rgba(15,23,42,0.06)] sm:p-8">
            <div className="space-y-5 text-[16px] leading-8 text-[#475569]">
              <p>
                Profixter was built by Taras Bandura after years in construction and home services, seeing the same problem repeat: homeowners could often find someone for a major project, but struggled to find reliable help for the everyday things.
              </p>
              <p>
                A faucet leak. A loose door. A light fixture. Drywall damage. A contractor quote that does not make sense. A maintenance list that keeps growing because every small task feels like its own search.
              </p>
              <p>
                Profixter makes that easier by giving homeowners a smarter first step. Ask Profixter AI, book one small visit, become a Member for ongoing care, or request a real estimate when the work is bigger.
              </p>
              <p className="text-[19px] font-extrabold leading-8 text-[#0B1628]">
                The promise is simple: clear paths, local accountability, and a home service experience that feels organized from the start.
              </p>
            </div>

            <div className="mt-7 grid gap-3 sm:grid-cols-3">
              {["Human", "Local", "Organized"].map((word) => (
                <div key={word} className="rounded-[18px] border border-[#E5E9F2] bg-[#F8FAFF] p-4">
                  <div className="text-[20px] font-black text-[#0B1628]">{word}</div>
                  <div className="mt-1 text-[13px] leading-5 text-[#64748B]">
                    A practical standard for every homeowner interaction.
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      <section className="px-4 py-12 sm:px-6 lg:px-8">
        <div className="mx-auto max-w-[1240px] overflow-hidden rounded-[32px] border border-[#DDE5F0] bg-[#0B1628] shadow-[0_28px_90px_rgba(15,23,42,0.18)]">
          <div className="grid gap-0 lg:grid-cols-[1.05fr_0.95fr]">
            <div className="p-6 text-white sm:p-8 lg:p-10">
              <div className="text-[11px] font-black uppercase tracking-[0.2em] text-[#7BAEFF]">
                Founder video
              </div>
              <h2 className="mt-3 text-[32px] font-black leading-tight tracking-[-0.035em] sm:text-[48px]">
                A place for Taras to explain Profixter in his own words.
              </h2>
              <p className="mt-5 text-[16px] leading-8 text-white/68">
                This section is ready for a short founder video that introduces the Profixter story, the local mission, and the way we help homeowners choose the right path.
              </p>
            </div>

            <div className="bg-[linear-gradient(145deg,#172033_0%,#0B1628_60%,#306EEC_160%)] p-5 sm:p-7 lg:p-8">
              <div className="grid aspect-video place-items-center rounded-[26px] border border-white/14 bg-white/[0.06] shadow-inner">
                <div className="text-center">
                  <div className="mx-auto grid h-20 w-20 place-items-center rounded-full border border-white/25 bg-white/12 text-white shadow-[0_18px_56px_rgba(48,110,236,0.28)]">
                    <svg width="28" height="28" viewBox="0 0 24 24" fill="none" aria-hidden="true">
                      <path d="M8 5v14l11-7L8 5z" fill="currentColor" />
                    </svg>
                  </div>
                  <div className="mt-5 text-[18px] font-black text-white">
                    Founder video
                  </div>
                  <p className="mx-auto mt-2 max-w-[280px] text-[13px] leading-6 text-white/58">
                    A clean video embed can live here when the final YouTube link is ready.
                  </p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      <section className="px-4 py-12 sm:px-6 lg:px-8">
        <div className="mx-auto max-w-[1240px]">
          <div className="max-w-[760px]">
            <div className="text-[11px] font-black uppercase tracking-[0.2em] text-[#306EEC]">
              What we offer
            </div>
            <h2 className="mt-3 text-[34px] font-black leading-[1.02] tracking-[-0.04em] text-[#0B1628] sm:text-[52px]">
              Four ways to move forward without guessing.
            </h2>
          </div>

          <div className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {productCards.map((product) => (
              <ProductCard key={product.title} product={product} />
            ))}
          </div>
        </div>
      </section>

      <section className="px-4 py-12 sm:px-6 lg:px-8">
        <div className="mx-auto grid max-w-[1240px] gap-8 lg:grid-cols-[0.9fr_1.1fr] lg:items-start">
          <div>
            <div className="text-[11px] font-black uppercase tracking-[0.2em] text-[#306EEC]">
              Why homeowners trust Profixter
            </div>
            <h2 className="mt-3 text-[34px] font-black leading-[1.02] tracking-[-0.04em] text-[#0B1628] sm:text-[52px]">
              Trust is built into the process, not bolted on later.
            </h2>
            <p className="mt-5 text-[16px] leading-8 text-[#64748B]">
              Profixter is designed to reduce confusion before anyone arrives: clear service paths, photos and notes before visits, admin review, and a separate estimate path for work that should not be squeezed into a small handyman appointment.
            </p>
          </div>

          <div className="grid gap-3 sm:grid-cols-2">
            {trustItems.map((item) => (
              <div key={item.title} className="rounded-[20px] border border-[#DDE5F0] bg-white p-5 shadow-sm">
                <div className="flex gap-3">
                  <CheckIcon />
                  <div>
                    <h3 className="text-[16px] font-black text-[#0B1628]">{item.title}</h3>
                    <p className="mt-2 text-[13px] leading-6 text-[#64748B]">{item.body}</p>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="px-4 py-12 sm:px-6 lg:px-8">
        <div className="mx-auto max-w-[1240px] rounded-[32px] border border-[#D9E4FF] bg-[#F0F7FF] p-6 sm:p-8 lg:p-10">
          <div className="grid gap-8 lg:grid-cols-[0.85fr_1.15fr] lg:items-center">
            <div>
              <div className="text-[11px] font-black uppercase tracking-[0.2em] text-[#306EEC]">
                Service area
              </div>
              <h2 className="mt-3 text-[34px] font-black leading-tight tracking-[-0.04em] text-[#0B1628] sm:text-[48px]">
                Local to Long Island, built around Nassau and Suffolk homes.
              </h2>
              <p className="mt-5 text-[16px] leading-8 text-[#475569]">
                Profixter is based near Babylon and serves Long Island homeowners across Nassau and Suffolk Counties.
              </p>
            </div>

            <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
              {serviceAreas.map((area) => (
                <div key={area} className="rounded-[18px] border border-white bg-white/86 px-4 py-4 text-[14px] font-black text-[#0B1628] shadow-sm">
                  {area}
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      <section className="px-4 py-12 sm:px-6 lg:px-8">
        <div className="mx-auto max-w-[980px]">
          <div className="text-center">
            <div className="text-[11px] font-black uppercase tracking-[0.2em] text-[#306EEC]">
              FAQ
            </div>
            <h2 className="mt-3 text-[34px] font-black leading-tight tracking-[-0.04em] text-[#0B1628] sm:text-[52px]">
              Answers before you choose.
            </h2>
          </div>

          <div className="mt-8 grid gap-3">
            {faqs.map((faq) => (
              <div key={faq.q} className="rounded-[20px] border border-[#DDE5F0] bg-white p-5 shadow-sm sm:p-6">
                <h3 className="text-[18px] font-black text-[#0B1628]">{faq.q}</h3>
                <p className="mt-3 text-[14px] leading-7 text-[#64748B]">{faq.a}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="px-4 py-12 sm:px-6 lg:px-8">
        <div className="mx-auto max-w-[1240px] rounded-[32px] bg-[#0B1628] p-6 text-white shadow-[0_28px_90px_rgba(15,23,42,0.18)] sm:p-8 lg:p-10">
          <div className="grid gap-8 lg:grid-cols-[0.9fr_1.1fr] lg:items-center">
            <div>
              <div className="text-[11px] font-black uppercase tracking-[0.2em] text-[#7BAEFF]">
                Start with the right path
              </div>
              <h2 className="mt-3 text-[34px] font-black leading-tight tracking-[-0.04em] sm:text-[52px]">
                Tell Profixter what kind of home help you need.
              </h2>
              <p className="mt-5 text-[16px] leading-8 text-white/68">
                Start free with AI, book one small handyman job, become a Member, or request a renovation estimate.
              </p>
            </div>

            <div className="grid gap-3 sm:grid-cols-2">
              {productCards.map((product) => (
                <Link
                  key={product.cta}
                  href={product.href}
                  className="rounded-[18px] border border-white/12 bg-white/[0.07] px-5 py-4 text-[15px] font-black text-white transition hover:bg-white hover:text-[#0B1628]"
                >
                  {product.cta}
                </Link>
              ))}
            </div>
          </div>
        </div>
      </section>

      <Footer />
    </main>
  );
}
