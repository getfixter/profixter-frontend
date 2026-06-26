"use client";

import Image from "next/image";
import Link from "next/link";
import Header from "@/app/components/sections/Header";
import { trackEvent } from "@/lib/analytics";

const products = [
  {
    title: "Profixter AI",
    label: "Ask anything about your home",
    href: "/home-support",
    accent: "bg-[#306EEC]",
  },
  {
    title: "Book Handyman",
    label: "$99 for one small job",
    href: "/book",
    accent: "bg-[#16A34A]",
  },
  {
    title: "Membership",
    label: "Ongoing home support",
    href: "/membership",
    accent: "bg-[#0B1628]",
  },
  {
    title: "Renovation",
    label: "Bigger work, real estimates",
    href: "/projects",
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
      className="group relative min-h-[150px] overflow-hidden rounded-[28px] bg-white/90 p-5 text-left shadow-[0_24px_70px_rgba(9,22,43,0.10)] backdrop-blur-xl transition duration-300 hover:-translate-y-1 hover:bg-white focus:outline-none focus:ring-4 focus:ring-[#306EEC]/25 sm:min-h-[190px] sm:p-6"
    >
      <span className={`mb-6 block h-1.5 w-14 rounded-full ${product.accent}`} />
      <span className="block text-[26px] font-black leading-[0.96] tracking-[-0.03em] text-[#0B1628] sm:text-[34px]">
        {product.title}
      </span>
      <span className="mt-4 block max-w-[190px] text-sm font-bold leading-5 text-[#526078]">
        {product.label}
      </span>
      <span className="absolute bottom-5 right-5 flex h-10 w-10 items-center justify-center rounded-full bg-[#0B1628] text-white transition group-hover:scale-105">
        -&gt;
      </span>
    </Link>
  );
}

export default function HomePage() {
  return (
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

          <div className="mx-auto flex min-h-[calc(100svh-112px)] max-w-[1260px] flex-col justify-center px-4 pb-8 pt-8 sm:px-6 lg:px-8">
            <div className="max-w-[980px]">
              <h1 className="max-w-[940px] text-[54px] font-black leading-[0.86] tracking-[-0.07em] text-white sm:text-[86px] lg:text-[112px]">
                Home ownership, finally simple.
              </h1>
              <p className="mt-7 max-w-[660px] text-lg font-semibold leading-7 text-white/88 sm:text-xl">
                Ask AI, book help, become a Member, or start a renovation. One modern platform for the home.
              </p>
            </div>

            <div className="mt-10 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
              {products.map((product) => (
                <ProductButton key={product.title} product={product} />
              ))}
            </div>
          </div>
        </div>
      </section>
    </main>
  );
}
