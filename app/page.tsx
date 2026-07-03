"use client";

import Image from "next/image";
import Link from "next/link";
import Header from "@/app/components/sections/Header";
import Footer from "@/app/components/sections/Footer";
import { trackEvent } from "@/lib/analytics";
import { CORE_PRODUCTS, HOME_SUPPORT_AI } from "@/lib/site-architecture";

const products = [
  {
    ...CORE_PRODUCTS[0],
    title: "Membership",
    label: "I want someone every month.",
    accent: "bg-[#0B1628]",
    badge: "Best long-term value",
  },
  {
    ...CORE_PRODUCTS[1],
    title: "Book Handyman",
    label: "I need something fixed.",
    accent: "bg-[#16A34A]",
    badge: "$99 / 90 minutes",
  },
  {
    ...CORE_PRODUCTS[2],
    title: "Renovation",
    label: "I want to renovate.",
    accent: "bg-[#D97706]",
    badge: "Real estimates",
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
      className="group relative min-h-[124px] overflow-hidden rounded-[24px] bg-white/90 p-4 text-left shadow-[0_18px_54px_rgba(9,22,43,0.10)] backdrop-blur-xl transition duration-300 hover:-translate-y-1 hover:bg-white focus:outline-none focus:ring-4 focus:ring-[#306EEC]/25 sm:min-h-[190px] sm:rounded-[28px] sm:p-6"
    >
      <span className={`mb-4 block h-1.5 w-12 rounded-full sm:mb-6 sm:w-14 ${product.accent}`} />
      <span className="mb-3 inline-flex rounded-full bg-[#EEF4FF] px-3 py-1 text-[10px] font-black uppercase tracking-[0.12em] text-[#306EEC]">
        {product.badge}
      </span>
      <span className="block text-[22px] font-black leading-[0.98] tracking-[-0.025em] text-[#0B1628] sm:text-[34px] sm:leading-[0.96] sm:tracking-[-0.03em]">
        {product.title}
      </span>
      <span className="mt-3 block max-w-[190px] text-[13px] font-bold leading-5 text-[#526078] sm:mt-4 sm:text-sm">
        {product.label}
      </span>
      <span className="mt-2 hidden max-w-[230px] text-[13px] font-semibold leading-5 text-[#6B7280] sm:block">
        {product.summary}
      </span>
      <span className="absolute bottom-4 right-4 flex h-9 w-9 items-center justify-center rounded-full bg-[#0B1628] text-white transition group-hover:scale-105 sm:bottom-5 sm:right-5 sm:h-10 sm:w-10">
        -&gt;
      </span>
    </Link>
  );
}

export default function HomePage() {
  return (
    <>
      <main className="min-h-screen bg-[#F4F7FB] text-[#0B1628]">
        <section className="relative min-h-screen overflow-hidden">
          <Image
            src="/images/hero-bg.webp"
            alt="Long Island home supported by Profixter"
            fill
            priority
            className="object-cover"
            sizes="100vw"
          />
          <div className="absolute inset-0 bg-[linear-gradient(180deg,rgba(2,6,23,0.56)_0%,rgba(2,6,23,0.36)_46%,rgba(2,6,23,0.18)_100%)] sm:bg-[linear-gradient(105deg,rgba(2,6,23,0.66)_0%,rgba(2,6,23,0.42)_46%,rgba(2,6,23,0.18)_100%)]" />
          <div className="absolute inset-x-0 bottom-0 h-28 bg-gradient-to-t from-[#071325]/45 to-transparent" />

          <div className="relative z-10">
            <Header />

            <div className="mx-auto flex min-h-[calc(100svh-92px)] max-w-[1260px] flex-col justify-center px-4 pb-6 pt-4 sm:min-h-[calc(100svh-112px)] sm:px-6 sm:pb-8 sm:pt-8 lg:px-8">
              <div className="max-w-[980px]">
                <h1 className="max-w-[940px] text-[44px] font-black leading-[0.9] tracking-[-0.055em] text-white sm:text-[86px] sm:leading-[0.86] sm:tracking-[-0.07em] lg:text-[112px]">
                  Home ownership, finally simple.
                </h1>
                <p className="mt-5 max-w-[660px] text-[16px] font-semibold leading-6 text-white/88 sm:mt-7 sm:text-xl sm:leading-7">
                  Become a Member for ongoing care, book a handyman for one small fix, or request a renovation estimate for bigger work.
                </p>
              </div>

              <div className="mt-7 grid gap-2.5 sm:mt-10 sm:grid-cols-3 sm:gap-3">
                {products.map((product) => (
                  <ProductButton key={product.title} product={product} />
                ))}
              </div>

              <Link
                href={HOME_SUPPORT_AI.href}
                onClick={() =>
                  trackEvent("homepage_product_click", {
                    product: HOME_SUPPORT_AI.title,
                    href: HOME_SUPPORT_AI.href,
                  })
                }
                className="mt-3 inline-flex w-full items-center justify-between gap-4 rounded-[20px] border border-white/18 bg-white/12 px-4 py-3 text-left text-white shadow-[0_16px_44px_rgba(2,6,23,0.12)] backdrop-blur-xl transition hover:bg-white/18 focus:outline-none focus:ring-4 focus:ring-white/25 sm:mt-4 sm:w-auto sm:min-w-[420px] sm:rounded-[22px] sm:px-5 sm:py-4"
              >
                <span>
                  <span className="block text-[13px] font-black uppercase tracking-[0.14em] text-white/62">
                    Not sure where to start?
                  </span>
                  <span className="mt-1 block text-[16px] font-black text-white sm:text-[18px]">
                    Ask Profixter AI before you hire anyone.
                  </span>
                </span>
                <span className="flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-full bg-white text-[#0B1628]">
                  -&gt;
                </span>
              </Link>
            </div>
          </div>
        </section>
      </main>
      <Footer />
    </>
  );
}
