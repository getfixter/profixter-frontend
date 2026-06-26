"use client";

import Image from "next/image";
import Link from "next/link";
import Header from "@/app/components/sections/Header";
import Footer from "@/app/components/sections/Footer";
import { trackEvent } from "@/lib/analytics";

const products = [
  {
    title: "Profixter AI",
    label: "Free home answers",
    href: "/home-support",
    body: "Photos, PDFs, quotes, repairs, maintenance, safety checks, and DIY-or-hire decisions.",
    accent: "bg-[#306EEC]",
  },
  {
    title: "Book Handyman",
    label: "$99 / 90 minutes",
    href: "/book",
    body: "One focused small job, booked first and paid securely before admin confirmation.",
    accent: "bg-[#16A34A]",
  },
  {
    title: "Membership",
    label: "Ongoing home care",
    href: "/membership",
    body: "Become a Member for recurring small-job help and a team that learns your home.",
    accent: "bg-[#0B1628]",
  },
  {
    title: "Renovation",
    label: "Larger projects",
    href: "/projects",
    body: "Bathrooms, kitchens, roofing, siding, and bigger work that needs a real estimate.",
    accent: "bg-[#D97706]",
  },
];

function ProductButton({ product }: { product: (typeof products)[number] }) {
  return (
    <Link
      href={product.href}
      onClick={() =>
        trackEvent("homepage_product_click", {
          product: product.title,
          href: product.href,
        })
      }
      className="group relative overflow-hidden rounded-[18px] border border-white/55 bg-white/88 p-4 text-left shadow-[0_18px_50px_rgba(9,22,43,0.12)] backdrop-blur-xl transition duration-300 hover:-translate-y-0.5 hover:bg-white focus:outline-none focus:ring-4 focus:ring-[#306EEC]/25 sm:p-5"
    >
      <span className={`mb-4 block h-2 w-12 rounded-full ${product.accent}`} />
      <span className="block text-lg font-black leading-tight text-[#0B1628] sm:text-xl">
        {product.title}
      </span>
      <span className="mt-1 block text-sm font-black text-[#306EEC]">
        {product.label}
      </span>
      <span className="mt-3 block text-sm leading-6 text-[#4B5A73]">
        {product.body}
      </span>
      <span className="mt-4 inline-flex items-center text-sm font-black text-[#0B1628]">
        Choose this
        <span className="ml-2 transition group-hover:translate-x-1">-&gt;</span>
      </span>
    </Link>
  );
}

export default function HomePage() {
  return (
    <main className="min-h-screen bg-[#EAF0FA] text-[#0B1628]">
      <section className="relative min-h-screen overflow-hidden">
        <Image
          src="/images/hero-bg.webp"
          alt="Long Island home supported by Profixter"
          fill
          priority
          className="object-cover"
          sizes="100vw"
        />
        <div className="absolute inset-0 bg-[linear-gradient(180deg,rgba(234,240,250,0.96)_0%,rgba(234,240,250,0.88)_34%,rgba(255,255,255,0.82)_100%)] sm:bg-[linear-gradient(110deg,rgba(234,240,250,0.98)_0%,rgba(234,240,250,0.92)_42%,rgba(255,255,255,0.62)_100%)]" />
        <div className="absolute inset-x-0 bottom-0 h-44 bg-gradient-to-t from-[#EAF0FA] to-transparent" />

        <div className="relative z-10">
          <Header />

          <div className="mx-auto flex min-h-[calc(100svh-120px)] max-w-[1200px] flex-col justify-center px-4 pb-8 pt-4 sm:px-6 lg:px-8">
            <div className="max-w-[820px]">
              <div className="inline-flex rounded-full border border-white/70 bg-white/82 px-3 py-1.5 text-[11px] font-black uppercase tracking-[0.18em] text-[#306EEC] shadow-sm backdrop-blur">
                Babylon based - Serving Nassau & Suffolk
              </div>
              <h1 className="mt-5 max-w-[780px] text-[42px] font-black leading-[0.94] text-[#0B1628] sm:text-[64px] lg:text-[78px]">
                Home help that starts in the right place.
              </h1>
              <p className="mt-5 max-w-[650px] text-base font-medium leading-7 text-[#34435C] sm:text-lg">
                Ask Profixter AI, book a small handyman job, become a Member for ongoing care, or start a renovation estimate. Clear choices for Long Island homeowners.
              </p>
            </div>

            <div className="mt-8 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
              {products.map((product) => (
                <ProductButton key={product.title} product={product} />
              ))}
            </div>

            <div className="mt-6 grid gap-2 text-xs font-black uppercase tracking-[0.14em] text-[#34435C] sm:grid-cols-3 sm:text-[11px]">
              <div className="rounded-full border border-white/60 bg-white/76 px-4 py-3 shadow-sm backdrop-blur">
                Licensed HI-71484
              </div>
              <div className="rounded-full border border-white/60 bg-white/76 px-4 py-3 shadow-sm backdrop-blur">
                Fully insured local team
              </div>
              <div className="rounded-full border border-white/60 bg-white/76 px-4 py-3 shadow-sm backdrop-blur">
                Built for real homes
              </div>
            </div>
          </div>
        </div>
      </section>

      <Footer />
    </main>
  );
}
