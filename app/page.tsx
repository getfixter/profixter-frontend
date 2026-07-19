"use client";

import Image from "next/image";
import Link from "next/link";
import Header from "@/app/components/sections/Header";
import Footer from "@/app/components/sections/Footer";
import RoleEntryGate from "@/app/components/auth/RoleEntryGate";
import { trackEvent } from "@/lib/analytics";
import { CORE_PRODUCTS, HOME_SUPPORT_AI } from "@/lib/site-architecture";

const products = [
  {
    ...CORE_PRODUCTS[0],
    title: "Membership",
    label: "One trusted handyman team for ongoing home care.",
  },
  {
    ...CORE_PRODUCTS[1],
    title: "Book Handyman",
    label: "One visit whenever you need help.",
  },
  {
    ...CORE_PRODUCTS[2],
    title: "Renovation",
    label: "Larger home improvements.",
  },
];

const trustItems = [
  {
    label: "Licensed",
    value: "HI-71484",
    icon: "shield",
  },
  {
    label: "Insured",
    value: "In-home work",
    icon: "check",
  },
  {
    label: "Serving",
    value: "Long Island",
    icon: "pin",
  },
  {
    label: "Google",
    value: "4.9 Reviews",
    icon: "star",
  },
  {
    label: "Support",
    value: "631-599-1363",
    icon: "phone",
  },
];

function TrustIcon({ name }: { name: string }) {
  if (name === "star") {
    return <path d="m12 3 2.6 5.3 5.9.9-4.3 4.1 1 5.8-5.2-2.7-5.2 2.7 1-5.8-4.3-4.1 5.9-.9L12 3Z" stroke="currentColor" strokeWidth="1.7" strokeLinejoin="round" />;
  }
  if (name === "phone") {
    return <path d="M7.2 3.5H4.8c-.7 0-1.3.6-1.2 1.3.8 8.1 7.3 14.6 15.4 15.4.7.1 1.3-.5 1.3-1.2v-2.4c0-.6-.4-1.1-1-1.2l-3.2-.7c-.5-.1-1 .1-1.3.5l-.7 1a13.2 13.2 0 0 1-6.3-6.3l1-.7c.4-.3.6-.8.5-1.3l-.7-3.2c-.2-.7-.7-1.2-1.4-1.2Z" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" />;
  }
  if (name === "pin") {
    return <><path d="M19 10c0 5-7 11-7 11S5 15 5 10a7 7 0 1 1 14 0Z" stroke="currentColor" strokeWidth="1.7" /><circle cx="12" cy="10" r="2.2" stroke="currentColor" strokeWidth="1.7" /></>;
  }
  if (name === "check") {
    return <><circle cx="12" cy="12" r="8.5" stroke="currentColor" strokeWidth="1.7" /><path d="m8.5 12 2.2 2.2 4.8-5" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" /></>;
  }
  return <><path d="M12 3.5 19 6v5.5c0 4.3-2.9 7.5-7 9-4.1-1.5-7-4.7-7-9V6l7-2.5Z" stroke="currentColor" strokeWidth="1.7" strokeLinejoin="round" /><path d="m8.8 11.8 2 2 4.4-4.5" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" /></>;
}

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
      className="group relative min-h-[118px] overflow-hidden rounded-[18px] border border-white/55 bg-white/92 p-4 pr-12 text-left shadow-[0_10px_30px_rgba(9,22,43,0.07)] backdrop-blur-xl transition duration-200 ease-out hover:-translate-y-0.5 hover:bg-white hover:shadow-[0_12px_34px_rgba(9,22,43,0.09)] active:scale-[0.99] focus:outline-none focus:ring-2 focus:ring-[#306EEC]/35 motion-reduce:transform-none motion-reduce:transition-none sm:min-h-[148px] sm:rounded-[20px] sm:p-5 sm:pr-14"
    >
      <span className="mb-3 block h-1 w-8 rounded-full bg-[#306EEC] sm:mb-4 sm:w-10" />
      <span className="block text-[20px] font-semibold leading-tight tracking-[-0.025em] text-[#0B1628] sm:text-[28px]">
        {product.title}
      </span>
      <span className="mt-2 block max-w-[220px] text-[12px] font-medium leading-[1.45] text-[#526078] sm:mt-2.5 sm:text-[13px]">
        {product.label}
      </span>
      <span className="absolute bottom-4 right-4 text-[19px] font-medium text-[#306EEC] transition-transform duration-200 ease-out group-hover:translate-x-1 motion-reduce:transform-none motion-reduce:transition-none sm:bottom-5 sm:right-5">
        -&gt;
      </span>
    </Link>
  );
}

export default function HomePage() {
  return (
    <RoleEntryGate>
      <main className="min-h-screen bg-[#F4F7FB] text-[#0B1628]">
        <section className="relative min-h-[92svh] overflow-hidden sm:min-h-[94svh]">
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

            <div className="mx-auto flex min-h-[calc(92svh-84px)] max-w-[1260px] flex-col justify-center px-4 pb-5 pt-3 sm:min-h-[calc(94svh-104px)] sm:px-6 sm:pb-6 sm:pt-6 lg:px-8">
              <div className="max-w-[980px]">
                <h1 className="max-w-[940px] text-[42px] font-semibold leading-[0.94] tracking-[-0.05em] text-white sm:text-[76px] sm:leading-[0.9] sm:tracking-[-0.06em] lg:text-[96px]">
                  Handyman for your home.
                </h1>
                <p className="mt-4 max-w-[700px] text-[15px] font-medium leading-[1.5] text-white/88 sm:mt-5 sm:text-[18px] sm:leading-7">
                  Membership for ongoing home care, one-time handyman visits, and larger home projects, all from one trusted local team.
                </p>
              </div>

              <div className="mt-6 grid gap-2 sm:mt-8 sm:grid-cols-3 sm:gap-3">
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
                className="group mt-2 inline-flex w-full items-center justify-between gap-4 rounded-[16px] border border-white/20 bg-white/12 px-4 py-3 text-left text-white shadow-[0_8px_24px_rgba(2,6,23,0.10)] backdrop-blur-xl transition duration-200 ease-out hover:-translate-y-0.5 hover:bg-white/18 active:scale-[0.99] focus:outline-none focus:ring-2 focus:ring-white/35 motion-reduce:transform-none motion-reduce:transition-none sm:mt-3 sm:w-auto sm:min-w-[380px] sm:rounded-[18px] sm:px-5 sm:py-3.5"
              >
                <span>
                  <span className="block text-[10px] font-semibold uppercase tracking-[0.14em] text-white/62">
                    Profixter AI
                  </span>
                  <span className="mt-1 block text-[14px] font-semibold text-white sm:text-[16px]">
                    Get expert advice before hiring.
                  </span>
                </span>
                <span className="flex-shrink-0 text-[19px] font-medium text-white transition-transform duration-200 ease-out group-hover:translate-x-1 motion-reduce:transform-none motion-reduce:transition-none">
                  -&gt;
                </span>
              </Link>
            </div>
          </div>
        </section>

        <section className="border-y border-[#E6EAF2] bg-[#F8FAFD]">
          <div className="mx-auto grid max-w-[1260px] grid-cols-2 gap-2 px-4 py-5 sm:grid-cols-5 sm:px-6 sm:py-6 lg:px-8">
            {trustItems.map((item, index) => (
              <div key={item.label} className={`flex min-h-[88px] items-center gap-3 rounded-[16px] border border-[#E7EAF0] bg-white px-3 py-3 shadow-[0_6px_20px_rgba(9,22,43,0.035)] sm:min-h-[92px] sm:flex-col sm:justify-center sm:gap-2 sm:text-center ${index === trustItems.length - 1 ? "col-span-2 sm:col-span-1" : ""}`}>
                <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-[10px] bg-[#EEF4FF] text-[#306EEC]">
                  <svg width="17" height="17" viewBox="0 0 24 24" fill="none" aria-hidden="true"><TrustIcon name={item.icon} /></svg>
                </span>
                <div className="min-w-0">
                <div className="text-[9px] font-semibold uppercase tracking-[0.14em] text-[#7B8798]">
                  {item.label}
                </div>
                <div className="mt-0.5 break-words text-[12px] font-semibold text-[#0B1628] sm:text-[13px]">
                  {item.value}
                </div>
                </div>
              </div>
            ))}
          </div>
        </section>
      </main>
      <Footer compact />
    </RoleEntryGate>
  );
}
