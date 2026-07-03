import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import Header from "@/app/components/sections/Header";
import Footer from "@/app/components/sections/Footer";
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
      "Meet the local team behind Profixter AI, Book Handyman, Membership, and Renovation.",
    images: [DEFAULT_OG_IMAGE.url],
  },
};

const productCards = [
  {
    title: CORE_PRODUCTS[0].shortTitle,
    eyebrow: "Ongoing home care",
    href: CORE_PRODUCTS[0].href,
    cta: CORE_PRODUCTS[0].cta,
    body: CORE_PRODUCTS[0].summary,
    accent: "bg-[#0B1628]",
  },
  {
    title: CORE_PRODUCTS[1].shortTitle,
    eyebrow: "$99 / 90 minutes",
    href: CORE_PRODUCTS[1].href,
    cta: CORE_PRODUCTS[1].cta,
    body: CORE_PRODUCTS[1].summary,
    accent: "bg-[#16A34A]",
  },
  {
    title: CORE_PRODUCTS[2].shortTitle,
    eyebrow: "Renovation / construction",
    href: CORE_PRODUCTS[2].href,
    cta: CORE_PRODUCTS[2].cta,
    body: CORE_PRODUCTS[2].summary,
    accent: "bg-[#D97706]",
  },
  {
    title: HOME_SUPPORT_AI.shortTitle,
    eyebrow: "Free home answers",
    href: HOME_SUPPORT_AI.href,
    cta: HOME_SUPPORT_AI.cta,
    body: HOME_SUPPORT_AI.summary,
    accent: "bg-[#306EEC]",
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
    body: "Homeowners choose the path that fits: Membership, a one-time visit, or a larger project estimate.",
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
    a: "Yes. Profixter provides handyman help for small home tasks, but it is also more than a traditional handyman company. Homeowners can become a Member for ongoing care, book one visit for a small task, or request estimates for larger renovation and construction work.",
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
    a: "Choose Membership if you want ongoing home maintenance, Book Handyman for one small job, Renovation for larger work, or Profixter AI if you are unsure what path fits.",
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

      <section className="relative overflow-hidden px-4 pb-10 pt-2 sm:px-6 sm:pb-16 sm:pt-4 lg:px-8">
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
          <div className="pt-3 sm:pt-8 lg:pt-14">
            <div className="inline-flex items-center gap-2 rounded-full border border-[#D9E4FF] bg-white/88 px-3.5 py-1.5 shadow-sm backdrop-blur sm:px-4 sm:py-2">
              <span className="h-2 w-2 rounded-full bg-[#86EFAC]" />
              <span className="text-[11px] font-black uppercase tracking-[0.18em] text-[#306EEC]">
                Babylon based - Nassau and Suffolk
              </span>
            </div>
            <h1 className="mt-4 max-w-[760px] text-[36px] font-black leading-[1] tracking-[-0.036em] text-[#0B1628] sm:mt-5 sm:text-[64px] sm:leading-[0.96] sm:tracking-[-0.045em] lg:text-[76px]">
              A better way for Long Island homeowners to get help.
            </h1>
            <p className="mt-4 max-w-[680px] text-[15px] font-medium leading-7 text-[#34435C] sm:mt-5 sm:text-[18px] sm:leading-8">
              Profixter is a modern local home service company built around three clear paths: Membership for ongoing care, Book Handyman for one small fix, and Renovation for larger projects.
            </p>
            <p className="mt-3 max-w-[640px] text-[14px] leading-6 text-[#64748B] sm:mt-4 sm:text-[15px] sm:leading-7">
              We exist because homeowners should not have to chase contractors, decode vague pricing, or start from zero every time something in the house needs attention.
            </p>

            <div className="mt-6 grid gap-2.5 sm:mt-7 sm:grid-cols-2 sm:gap-3">
              <Link
                href="/membership"
                className="inline-flex h-[50px] items-center justify-center rounded-[15px] bg-[#306EEC] px-5 text-[14px] font-extrabold text-white shadow-[0_16px_48px_rgba(48,110,236,0.30)] transition hover:-translate-y-0.5 hover:bg-[#2558c9] sm:h-[54px] sm:rounded-[16px] sm:text-[15px]"
              >
                Become a Member
              </Link>
              <Link
                href="/book"
                className="inline-flex h-[50px] items-center justify-center rounded-[15px] border border-[#C5CBD8] bg-white/92 px-5 text-[14px] font-extrabold text-[#0B1628] transition hover:border-[#306EEC] hover:text-[#306EEC] sm:h-[54px] sm:rounded-[16px] sm:text-[15px]"
              >
                Book Handyman
              </Link>
            </div>
          </div>

          <div className="rounded-[24px] border border-white/70 bg-white/86 p-3.5 shadow-[0_20px_64px_rgba(15,23,42,0.10)] backdrop-blur-xl sm:rounded-[30px] sm:p-5 sm:shadow-[0_28px_90px_rgba(15,23,42,0.12)] lg:p-6">
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

      <section className="px-4 py-10 sm:px-6 sm:py-12 lg:px-8">
        <div className="mx-auto grid max-w-[1240px] gap-6 lg:grid-cols-[0.85fr_1.15fr] lg:items-start">
          <div className="lg:sticky lg:top-8">
            <div className="text-[11px] font-black uppercase tracking-[0.2em] text-[#306EEC]">
              Founder story
            </div>
            <h2 className="mt-3 text-[29px] font-black leading-[1.06] tracking-[-0.034em] text-[#0B1628] sm:text-[52px] sm:leading-[1.02] sm:tracking-[-0.04em]">
              Built because home help became too hard to trust.
            </h2>
          </div>

          <div className="rounded-[24px] border border-[#DDE5F0] bg-white p-5 shadow-[0_18px_56px_rgba(15,23,42,0.06)] sm:rounded-[28px] sm:p-8 sm:shadow-[0_22px_70px_rgba(15,23,42,0.06)]">
            <div className="space-y-4 text-[15px] leading-7 text-[#475569] sm:space-y-5 sm:text-[16px] sm:leading-8">
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

      <section className="px-4 py-10 sm:px-6 sm:py-12 lg:px-8">
        <div className="mx-auto max-w-[1240px] overflow-hidden rounded-[26px] border border-[#DDE5F0] bg-[#0B1628] shadow-[0_22px_70px_rgba(15,23,42,0.16)] sm:rounded-[32px] sm:shadow-[0_28px_90px_rgba(15,23,42,0.18)]">
          <div className="grid gap-0 lg:grid-cols-[1.05fr_0.95fr]">
            <div className="p-5 text-white sm:p-8 lg:p-10">
              <div className="text-[11px] font-black uppercase tracking-[0.2em] text-[#7BAEFF]">
                Founder video
              </div>
              <h2 className="mt-3 text-[28px] font-black leading-tight tracking-[-0.03em] sm:text-[48px] sm:tracking-[-0.035em]">
                A place for Taras to explain Profixter in his own words.
              </h2>
              <p className="mt-4 text-[15px] leading-7 text-white/68 sm:mt-5 sm:text-[16px] sm:leading-8">
                Watch the founder story, the local mission, and how Profixter helps homeowners choose the right path before hiring.
              </p>
            </div>

            <div className="bg-[linear-gradient(145deg,#172033_0%,#0B1628_60%,#306EEC_160%)] p-5 sm:p-7 lg:p-8">
              <div className="aspect-video overflow-hidden rounded-[26px] border border-white/14 bg-black shadow-[0_18px_56px_rgba(48,110,236,0.22)]">
                <iframe
                  src="https://www.youtube.com/embed/HQoAkLNGI9c?rel=0"
                  title="Taras Bandura explains Profixter"
                  loading="lazy"
                  allow="accelerometer; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
                  referrerPolicy="strict-origin-when-cross-origin"
                  allowFullScreen
                  className="h-full w-full"
                />
              </div>
            </div>
          </div>
        </div>
      </section>

      <section className="px-4 py-10 sm:px-6 sm:py-12 lg:px-8">
        <div className="mx-auto max-w-[1240px]">
          <div className="max-w-[760px]">
            <div className="text-[11px] font-black uppercase tracking-[0.2em] text-[#306EEC]">
              What we offer
            </div>
            <h2 className="mt-3 text-[29px] font-black leading-[1.06] tracking-[-0.034em] text-[#0B1628] sm:text-[52px] sm:leading-[1.02] sm:tracking-[-0.04em]">
              Three ways to get work handled, with AI when you are unsure.
            </h2>
          </div>

          <div className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {productCards.map((product) => (
              <ProductCard key={product.title} product={product} />
            ))}
          </div>
        </div>
      </section>

      <section className="px-4 py-10 sm:px-6 sm:py-12 lg:px-8">
        <div className="mx-auto grid max-w-[1240px] gap-8 lg:grid-cols-[0.9fr_1.1fr] lg:items-start">
          <div>
            <div className="text-[11px] font-black uppercase tracking-[0.2em] text-[#306EEC]">
              Why homeowners trust Profixter
            </div>
            <h2 className="mt-3 text-[29px] font-black leading-[1.06] tracking-[-0.034em] text-[#0B1628] sm:text-[52px] sm:leading-[1.02] sm:tracking-[-0.04em]">
              Trust is built into the process, not bolted on later.
            </h2>
            <p className="mt-4 text-[15px] leading-7 text-[#64748B] sm:mt-5 sm:text-[16px] sm:leading-8">
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

      <section className="px-4 py-10 sm:px-6 sm:py-12 lg:px-8">
        <div className="mx-auto max-w-[1240px] rounded-[26px] border border-[#D9E4FF] bg-[#F0F7FF] p-5 sm:rounded-[32px] sm:p-8 lg:p-10">
          <div className="grid gap-8 lg:grid-cols-[0.85fr_1.15fr] lg:items-center">
            <div>
              <div className="text-[11px] font-black uppercase tracking-[0.2em] text-[#306EEC]">
                Service area
              </div>
              <h2 className="mt-3 text-[29px] font-black leading-tight tracking-[-0.034em] text-[#0B1628] sm:text-[48px] sm:tracking-[-0.04em]">
                Local to Long Island, built around Nassau and Suffolk homes.
              </h2>
              <p className="mt-4 text-[15px] leading-7 text-[#475569] sm:mt-5 sm:text-[16px] sm:leading-8">
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

      <section className="px-4 py-10 sm:px-6 sm:py-12 lg:px-8">
        <div className="mx-auto max-w-[980px]">
          <div className="text-center">
            <div className="text-[11px] font-black uppercase tracking-[0.2em] text-[#306EEC]">
              FAQ
            </div>
            <h2 className="mt-3 text-[29px] font-black leading-tight tracking-[-0.034em] text-[#0B1628] sm:text-[52px] sm:tracking-[-0.04em]">
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

      <section className="px-4 py-10 sm:px-6 sm:py-12 lg:px-8">
        <div className="mx-auto max-w-[1240px] rounded-[26px] bg-[#0B1628] p-5 text-white shadow-[0_22px_70px_rgba(15,23,42,0.16)] sm:rounded-[32px] sm:p-8 sm:shadow-[0_28px_90px_rgba(15,23,42,0.18)] lg:p-10">
          <div className="grid gap-8 lg:grid-cols-[0.9fr_1.1fr] lg:items-center">
            <div>
              <div className="text-[11px] font-black uppercase tracking-[0.2em] text-[#7BAEFF]">
                Start with the right path
              </div>
              <h2 className="mt-3 text-[29px] font-black leading-tight tracking-[-0.034em] sm:text-[52px] sm:tracking-[-0.04em]">
                Tell Profixter what kind of home help you need.
              </h2>
              <p className="mt-4 text-[15px] leading-7 text-white/68 sm:mt-5 sm:text-[16px] sm:leading-8">
                Become a Member for ongoing care, book one small handyman job, request a renovation estimate, or ask Profixter AI if you are unsure.
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
