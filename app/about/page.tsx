import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
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

const productCards = [
  {
    title: CORE_PRODUCTS[0].shortTitle,
    eyebrow: "Primary relationship",
    role: "Recommended starting point",
    href: CORE_PRODUCTS[0].href,
    cta: CORE_PRODUCTS[0].cta,
    body: "The preferred way to work with Profixter: one trusted local team that learns your home and helps keep the list moving over time.",
    accent: "bg-[#306EEC]",
    featured: true,
  },
  {
    title: CORE_PRODUCTS[1].shortTitle,
    eyebrow: "When you only need one visit",
    role: "One-time support",
    href: CORE_PRODUCTS[1].href,
    cta: CORE_PRODUCTS[1].cta,
    body: "A focused handyman visit for one small job when Membership is not the right fit today.",
    accent: "bg-[#16A34A]",
    featured: false,
  },
  {
    title: CORE_PRODUCTS[2].shortTitle,
    eyebrow: "When the work is larger",
    role: "Project path",
    href: CORE_PRODUCTS[2].href,
    cta: CORE_PRODUCTS[2].cta,
    body: "Bathrooms, kitchens, roofing, siding, remodels, and larger work handled through a clear estimate path.",
    accent: "bg-[#D97706]",
    featured: false,
  },
  {
    title: HOME_SUPPORT_AI.shortTitle,
    eyebrow: "Before you hire",
    role: "Guidance",
    href: HOME_SUPPORT_AI.href,
    cta: HOME_SUPPORT_AI.cta,
    body: "Free homeowner guidance for repairs, maintenance, quotes, materials, and DIY-or-hire decisions.",
    accent: "bg-[#306EEC]",
    featured: false,
  },
] as const;

const trustItems = [
  {
    title: "Long Island focused",
    body: "Based near Babylon and built around the way Nassau and Suffolk homeowners actually maintain their homes.",
  },
  {
    title: "Licensed and insured",
    body: "Profixter operates with NY State Home Improvement Contractor license HI-71484 and insurance for peace of mind.",
  },
  {
    title: "No contractor chasing",
    body: "The goal is fewer callbacks, less guessing, and one organized place to turn when the home list grows.",
  },
  {
    title: "The right scope",
    body: "Small jobs stay simple. Larger work moves into a project estimate instead of being forced into the wrong visit.",
  },
] as const;

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
    q: "Can I book one visit?",
    a: "Yes. Book a visit when you only need one small job handled. It is useful when Membership is not the right fit today.",
  },
  {
    q: "Do you do renovations?",
    a: "Yes. Larger work like bathrooms, kitchens, roofing, siding, remodeling, and multi-day projects starts through the project estimate path. It stays connected to the same trusted local company.",
  },
  {
    q: "What is Profixter AI?",
    a: "Profixter AI helps homeowners before they hire. It can answer questions about repairs, maintenance, safety, materials, contractor quotes, PDFs, shopping lists, and DIY-or-hire decisions.",
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
    a: "Start with Membership if you want a long-term home care company. Book a visit for one small job, use Projects for larger work, or ask Profixter AI if you are unsure what fits.",
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
  const isFeatured = product.featured;

  return (
    <Link
      href={product.href}
      className={[
        "group rounded-[8px] border p-5 shadow-[0_18px_54px_rgba(15,23,42,0.06)] transition hover:-translate-y-1 hover:border-[#C7D9FF] hover:shadow-[0_28px_80px_rgba(48,110,236,0.12)]",
        isFeatured
          ? "bg-[#0B1628] text-white sm:p-7"
          : "border-[#DDE5F0] bg-white",
      ].join(" ")}
    >
      <span className={`mb-5 block h-2 w-12 rounded-full ${product.accent}`} />
      <span className={`text-[11px] font-black uppercase tracking-[0.18em] ${isFeatured ? "text-[#7BAEFF]" : "text-[#306EEC]"}`}>
        {product.eyebrow}
      </span>
      <h3 className={`mt-2 text-[23px] font-black leading-tight ${isFeatured ? "text-white sm:text-[30px]" : "text-[#0B1628]"}`}>
        {product.title}
      </h3>
      <p className={`mt-2 text-[12px] font-black uppercase tracking-[0.14em] ${isFeatured ? "text-white/42" : "text-[#94A3B8]"}`}>
        {product.role}
      </p>
      <p className={`mt-3 text-[14px] leading-6 ${isFeatured ? "text-white/68 sm:text-[15px] sm:leading-7" : "text-[#64748B]"}`}>{product.body}</p>
      <span className={`mt-5 inline-flex text-[14px] font-black ${isFeatured ? "text-white" : "text-[#0B1628]"}`}>
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

      <section className="relative overflow-hidden px-4 pb-10 pt-2 sm:px-6 sm:pb-11 sm:pt-4 lg:px-8">
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
            <div className="inline-flex items-center gap-2 rounded-[6px] border border-[#D9E4FF] bg-white/88 px-3.5 py-1.5 shadow-sm backdrop-blur sm:px-4 sm:py-2">
              <span className="h-2 w-2 rounded-full bg-[#86EFAC]" />
              <span className="text-[11px] font-black uppercase tracking-[0.18em] text-[#306EEC]">
                Modern home care - Long Island
              </span>
            </div>
            <h1 className="mt-4 max-w-[760px] text-[32px] font-black leading-[1] tracking-[-0.036em] text-[#0B1628] sm:mt-5 sm:text-[46px] sm:leading-[0.96] sm:tracking-[-0.045em] lg:text-[50px]">
              One company to take care of your home.
            </h1>
            <p className="mt-4 max-w-[680px] text-[15px] font-medium leading-7 text-[#34435C] sm:mt-5 sm:text-[18px] sm:leading-8">
              Profixter is a modern Long Island home services company built around long-term relationships. Membership is the preferred way to work with us.
            </p>
            <p className="mt-3 max-w-[640px] text-[14px] leading-6 text-[#64748B] sm:mt-4 sm:text-[15px] sm:leading-7">
              When one visit, a renovation, or a question makes more sense, those paths stay connected to the same trusted local company.
            </p>

            <div className="mt-6 grid gap-2.5 sm:mt-7 sm:grid-cols-2 sm:gap-3">
              <MembershipCtaLink
                className="inline-flex h-[44px] items-center justify-center rounded-[8px] bg-[#306EEC] px-5 text-[14px] font-extrabold text-white shadow-[0_16px_48px_rgba(48,110,236,0.30)] transition hover:-translate-y-0.5 hover:bg-[#2558c9] sm:h-[54px] sm:text-[15px]"
              >
                Become a Member
              </MembershipCtaLink>
              <Link
                href="#ways-to-work"
                className="inline-flex h-[44px] items-center justify-center rounded-[8px] border border-[#C5CBD8] bg-white/92 px-5 text-[14px] font-extrabold text-[#0B1628] transition hover:border-[#306EEC] hover:text-[#306EEC] sm:h-[54px] sm:text-[15px]"
              >
                See How It Works
              </Link>
            </div>
          </div>

          <div className="rounded-[8px] border border-white/70 bg-white/86 p-3.5 shadow-[0_20px_64px_rgba(15,23,42,0.10)] backdrop-blur-xl sm:rounded-[10px] sm:p-5 sm:shadow-[0_28px_90px_rgba(15,23,42,0.12)] lg:p-6">
            <div className="overflow-hidden rounded-[8px] bg-[#0B1628]">
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
                  <div className="mt-1 text-[26px] font-black leading-none">
                    Taras Bandura
                  </div>
                </div>
              </div>
            </div>
            <div className="mt-4 grid gap-3 sm:grid-cols-3">
              {["Membership-first", "Licensed HI-71484", "Fully insured"].map((item) => (
                <div key={item} className="rounded-[8px] bg-[#F8FAFF] px-4 py-3 text-[12px] font-black uppercase tracking-[0.12em] text-[#34435C]">
                  {item}
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      <section className="px-4 py-10 sm:px-6 sm:py-9 lg:px-8">
        <div className="mx-auto grid max-w-[1240px] gap-6 lg:grid-cols-[0.85fr_1.15fr] lg:items-start">
          <div className="lg:sticky lg:top-8">
            <div className="text-[11px] font-black uppercase tracking-[0.2em] text-[#306EEC]">
              Founder story
            </div>
            <h2 className="mt-3 text-[26px] font-black leading-[1.06] tracking-[-0.034em] text-[#0B1628] sm:text-[40px] sm:leading-[1.02] sm:tracking-[-0.04em]">
              Built because homeowners deserved one place to turn.
            </h2>
          </div>

          <div className="rounded-[8px] border border-[#DDE5F0] bg-white p-5 shadow-[0_18px_56px_rgba(15,23,42,0.06)] sm:p-8 sm:shadow-[0_22px_70px_rgba(15,23,42,0.06)]">
            <div className="space-y-4 text-[15px] leading-7 text-[#475569] sm:space-y-5 sm:text-[16px] sm:leading-8">
              <p>
                Profixter was built by Taras Bandura after years in construction and home services, seeing the same problem repeat: every small home issue forced people to start over.
              </p>
              <p>
                A faucet leak. A loose door. A light fixture. Drywall damage. A contractor quote that does not make sense. The list grows because every item feels like its own search.
              </p>
              <p>
                Profixter simplifies that into one organized home care company: become a Member for ongoing help, book one visit when that is enough, ask Profixter AI before hiring, or move larger work into a real project estimate.
              </p>
              <p className="text-[19px] font-extrabold leading-8 text-[#0B1628]">
                The promise is simple: your home should have a company that already knows where to start.
              </p>
            </div>

            <div className="mt-7 grid gap-3 sm:grid-cols-3">
              {[
                ["Long-term", "Built for relationships, not one-off callbacks."],
                ["Local", "Based near Babylon and accountable to Long Island homeowners."],
                ["Organized", "The right path for small visits, larger projects, and questions."],
              ].map(([word, body]) => (
                <div key={word} className="rounded-[8px] border border-[#E5E9F2] bg-[#F8FAFF] p-4">
                  <div className="text-[19px] font-black text-[#0B1628]">{word}</div>
                  <div className="mt-1 text-[13px] leading-5 text-[#64748B]">
                    {body}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      <section className="px-4 py-10 sm:px-6 sm:py-9 lg:px-8">
        <div className="mx-auto max-w-[1240px] overflow-hidden rounded-[8px] border border-[#DDE5F0] bg-[#0B1628] shadow-[0_22px_70px_rgba(15,23,42,0.16)] sm:rounded-[10px] sm:shadow-[0_28px_90px_rgba(15,23,42,0.18)]">
          <div className="grid gap-0 lg:grid-cols-[1.05fr_0.95fr]">
            <div className="p-5 text-white sm:p-8 lg:p-10">
              <div className="text-[11px] font-black uppercase tracking-[0.2em] text-[#7BAEFF]">
                Founder video
              </div>
              <h2 className="mt-3 text-[26px] font-black leading-tight tracking-[-0.03em] sm:text-[36px] sm:tracking-[-0.035em]">
                Hear why Profixter was built.
              </h2>
              <p className="mt-4 text-[15px] leading-7 text-white/68 sm:mt-5 sm:text-[16px] sm:leading-8">
                Taras explains the local mission and why homeowners need a more organized way to take care of a home.
              </p>
            </div>

            <div className="bg-[linear-gradient(145deg,#172033_0%,#0B1628_60%,#306EEC_160%)] p-5 sm:p-7 lg:p-8">
              <div className="aspect-video overflow-hidden rounded-[8px] border border-white/14 bg-black shadow-[0_18px_56px_rgba(48,110,236,0.22)]">
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

      <section id="ways-to-work" className="scroll-mt-[120px] px-4 py-10 sm:px-6 sm:py-10 lg:px-8">
        <div className="mx-auto max-w-[1240px]">
          <div className="max-w-[760px]">
            <div className="text-[11px] font-black uppercase tracking-[0.2em] text-[#306EEC]">
              One company, four paths
            </div>
            <h2 className="mt-3 text-[26px] font-black leading-[1.06] tracking-[-0.034em] text-[#0B1628] sm:text-[40px] sm:leading-[1.02] sm:tracking-[-0.04em]">
              Membership first. Support for everything else.
            </h2>
            <p className="mt-4 max-w-[680px] text-[15px] leading-7 text-[#64748B] sm:text-[16px] sm:leading-8">
              These are not separate businesses. They are different ways to work with the same local home service company.
            </p>
          </div>

          <div className="mt-8 grid gap-4 lg:grid-cols-[1.08fr_1fr] lg:items-stretch">
            <ProductCard product={productCards[0]} />
            <div className="grid gap-4 sm:grid-cols-3 lg:grid-cols-1">
              {productCards.slice(1).map((product) => (
                <ProductCard key={product.title} product={product} />
              ))}
            </div>
          </div>
        </div>
      </section>

      <section className="px-4 py-10 sm:px-6 sm:py-9 lg:px-8">
        <div className="mx-auto grid max-w-[1240px] gap-8 lg:grid-cols-[0.9fr_1.1fr] lg:items-start">
          <div>
            <div className="text-[11px] font-black uppercase tracking-[0.2em] text-[#306EEC]">
              Why homeowners trust Profixter
            </div>
            <h2 className="mt-3 text-[26px] font-black leading-[1.06] tracking-[-0.034em] text-[#0B1628] sm:text-[40px] sm:leading-[1.02] sm:tracking-[-0.04em]">
              Trust is built into the relationship.
            </h2>
            <p className="mt-4 text-[15px] leading-7 text-[#64748B] sm:mt-5 sm:text-[16px] sm:leading-8">
              Profixter is designed to reduce uncertainty before anyone arrives: clear service paths, photos and notes before visits, admin review, and project routing when the work should not be squeezed into a small appointment.
            </p>
          </div>

          <div className="grid gap-3 sm:grid-cols-2">
            {trustItems.map((item) => (
              <div key={item.title} className="rounded-[8px] border border-[#DDE5F0] bg-white p-5 shadow-sm">
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

      <section className="px-4 py-10 sm:px-6 sm:py-9 lg:px-8">
        <div className="mx-auto max-w-[1240px] rounded-[8px] border border-[#D9E4FF] bg-[#F0F7FF] p-5 sm:rounded-[10px] sm:p-8 lg:p-10">
          <div className="grid gap-8 lg:grid-cols-[0.85fr_1.15fr] lg:items-center">
            <div>
              <div className="text-[11px] font-black uppercase tracking-[0.2em] text-[#306EEC]">
                Service area
              </div>
              <h2 className="mt-3 text-[26px] font-black leading-tight tracking-[-0.034em] text-[#0B1628] sm:text-[36px] sm:tracking-[-0.04em]">
                Local to Long Island. Built for real homes here.
              </h2>
              <p className="mt-4 text-[15px] leading-7 text-[#475569] sm:mt-5 sm:text-[16px] sm:leading-8">
                Profixter is based near Babylon and serves homeowners across Nassau and Suffolk Counties with a practical understanding of how local homes age, break, and improve.
              </p>
            </div>

            <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
              {serviceAreas.map((area) => (
                <div key={area} className="rounded-[8px] border border-white bg-white/86 px-4 py-4 text-[14px] font-black text-[#0B1628] shadow-sm">
                  {area}
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      <section className="px-4 py-10 sm:px-6 sm:py-9 lg:px-8">
        <div className="mx-auto max-w-[980px]">
          <div className="text-center">
            <div className="text-[11px] font-black uppercase tracking-[0.2em] text-[#306EEC]">
              FAQ
            </div>
            <h2 className="mt-3 text-[26px] font-black leading-tight tracking-[-0.034em] text-[#0B1628] sm:text-[40px] sm:tracking-[-0.04em]">
              Clear answers before you choose a path.
            </h2>
          </div>

          <div className="mt-8 grid gap-3">
            {faqs.map((faq) => (
              <div key={faq.q} className="rounded-[8px] border border-[#DDE5F0] bg-white p-5 shadow-sm sm:p-6">
                <h3 className="text-[18px] font-black text-[#0B1628]">{faq.q}</h3>
                <p className="mt-3 text-[14px] leading-7 text-[#64748B]">{faq.a}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="px-4 py-10 sm:px-6 sm:py-9 lg:px-8">
        <div className="mx-auto max-w-[1240px] rounded-[8px] bg-[#0B1628] p-5 text-white shadow-[0_22px_70px_rgba(15,23,42,0.16)] sm:rounded-[10px] sm:p-8 sm:shadow-[0_28px_90px_rgba(15,23,42,0.18)] lg:p-10">
          <div className="grid gap-8 lg:grid-cols-[0.9fr_1.1fr] lg:items-center">
            <div>
              <div className="text-[11px] font-black uppercase tracking-[0.2em] text-[#7BAEFF]">
                Start with the right path
              </div>
              <h2 className="mt-3 text-[26px] font-black leading-tight tracking-[-0.034em] sm:text-[40px] sm:tracking-[-0.04em]">
                Start with Membership. Stay with Profixter as your home changes.
              </h2>
              <p className="mt-4 text-[15px] leading-7 text-white/68 sm:mt-5 sm:text-[16px] sm:leading-8">
                The goal is simple: one trusted company that can help with the small list, the big project, and the questions in between.
              </p>
            </div>

            {/*
             * One action, not a second product menu. Every product already has
             * its own card and its own CTA in the section above, so repeating
             * all four here made the page end by asking the reader to choose
             * again rather than by closing.
             */}
            <div className="grid gap-3">
              <MembershipCtaLink className="inline-flex min-h-[48px] items-center justify-center rounded-[8px] bg-white px-5 text-[15px] font-black text-[#0B1628] transition hover:bg-[#EEF5FF]">
                Become a Member
              </MembershipCtaLink>
              <Link
                href="#ways-to-work"
                className="inline-flex min-h-[44px] items-center justify-center text-[14px] font-bold text-white/70 transition hover:text-white"
              >
                Not sure yet? See the other ways to work with us
              </Link>
            </div>
          </div>
        </div>
      </section>

      <Footer />
    </main>
  );
}
