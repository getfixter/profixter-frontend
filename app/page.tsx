"use client";

import Image from "next/image";
import Link from "next/link";
import Header from "@/app/components/sections/Header";
import Footer from "@/app/components/sections/Footer";
import { trackEvent } from "@/lib/analytics";

const products = [
  {
    title: "Home Support AI",
    prompt: "Ask before you hire.",
    href: "/home-support",
    detail:
      "Free homeowner guidance for photos, PDFs, quotes, maintenance plans, shopping lists, safety questions, and DIY-or-hire decisions.",
    accent: "bg-blue-600",
    cta: "Open AI assistant",
  },
  {
    title: "Book a Handyman",
    prompt: "$99 for one small job.",
    href: "/book",
    detail:
      "A 90-minute one-time handyman visit for focused repairs, installs, and small home tasks. Book first, pay securely, then admin confirms.",
    accent: "bg-emerald-600",
    cta: "Book a visit",
  },
  {
    title: "Membership",
    prompt: "Ongoing home care.",
    href: "/membership",
    detail:
      "Recurring handyman support for homeowners with ongoing maintenance, multiple small tasks, and the comfort of one trusted team.",
    accent: "bg-slate-950",
    cta: "Compare plans",
  },
  {
    title: "Home Projects",
    prompt: "Bigger work, clear estimate.",
    href: "/projects",
    detail:
      "Roofing, siding, bathrooms, kitchens, and larger renovations reviewed as structured project estimates.",
    accent: "bg-amber-600",
    cta: "Request estimate",
  },
];

const homeownerPaths = [
  ["My faucet leaks.", "Start with Home Support AI, then book a $99 visit if it looks like a small repair."],
  ["I need help tomorrow.", "Check Book a Handyman for open appointment times, or compare Membership for ongoing priority support."],
  ["I want a bathroom remodel.", "Go straight to Home Projects so the work is scoped and estimated properly."],
  ["I don't know if this is dangerous.", "Ask Home Support AI. Emergencies should go to 911, a utility company, or a licensed emergency provider."],
  ["I found a contractor quote.", "Upload the PDF to Home Support AI for practical questions to ask before you sign."],
  ["I have lots of small jobs.", "Membership is usually the cleanest fit when the punch list keeps growing."],
];

const trust = [
  "Licensed HI-71484",
  "Fully insured",
  "Nassau & Suffolk County",
  "Local Long Island team",
];

const faqs = [
  {
    q: "What is Profixter?",
    a: "Profixter is a Long Island home-support company with four ways to get help: free Home Support AI, a $99 one-time handyman visit, ongoing membership, and project estimates for larger work.",
  },
  {
    q: "When should I use Home Support AI?",
    a: "Use it when you are unsure what is wrong, want to review a quote or agreement, need a shopping list, want seasonal maintenance advice, or need help deciding whether a task is safe to DIY.",
  },
  {
    q: "What fits the $99 handyman visit?",
    a: "Small scoped handyman jobs that can reasonably fit in a 90-minute visit, such as minor repairs, fixture replacements, caulking, shelves, TV mounting, and similar work.",
  },
  {
    q: "When is Membership better?",
    a: "Membership is better when you have recurring maintenance, several small jobs over time, or want one team that keeps learning your home. It does not imply hard monthly visit limits.",
  },
  {
    q: "What belongs in Home Projects?",
    a: "Roofing, siding, bathroom remodeling, kitchen remodeling, multi-day work, major electrical or plumbing, and larger renovations should start with a project estimate.",
  },
];

function ProductCard({ product }: { product: (typeof products)[number] }) {
  return (
    <Link
      href={product.href}
      onClick={() =>
        trackEvent("homepage_product_click", {
          product: product.title,
          href: product.href,
        })
      }
      className="group flex min-h-[250px] flex-col justify-between rounded-[8px] border border-slate-200 bg-white p-5 shadow-[0_18px_45px_rgba(15,23,42,0.08)] transition hover:-translate-y-1 hover:border-blue-200 hover:shadow-[0_22px_60px_rgba(15,23,42,0.11)]"
    >
      <div>
        <div className={`mb-5 h-2 w-12 rounded-full ${product.accent}`} />
        <h2 className="text-xl font-black leading-tight text-slate-950">
          {product.title}
        </h2>
        <p className="mt-3 text-[15px] font-black leading-snug text-blue-700">
          {product.prompt}
        </p>
        <p className="mt-3 text-sm leading-6 text-slate-600">
          {product.detail}
        </p>
      </div>
      <div className="mt-6 inline-flex items-center text-sm font-black text-slate-950">
        {product.cta}
        <span className="ml-2 transition group-hover:translate-x-1">-&gt;</span>
      </div>
    </Link>
  );
}

export default function HomePage() {
  return (
    <main className="min-h-screen bg-[#F7F8FB] text-[#0B1628]">
      <Header />

      <section className="relative overflow-hidden bg-white">
        <Image
          src="/images/hero-bg.webp"
          alt="Comfortable Long Island home supported by Profixter"
          fill
          priority
          className="object-cover opacity-20"
          sizes="100vw"
        />
        <div className="absolute inset-0 bg-gradient-to-r from-white via-white/92 to-white/72" />

        <div className="relative mx-auto grid min-h-[calc(100svh-92px)] max-w-[1180px] content-center px-4 py-12 sm:px-6 lg:px-8">
          <div className="max-w-[790px]">
            <div className="mb-4 inline-flex rounded-full border border-blue-100 bg-white/90 px-3 py-1 text-xs font-black uppercase tracking-[0.16em] text-blue-700">
              Profixter Long Island
            </div>
            <h1 className="text-[42px] font-black leading-[0.98] tracking-normal text-slate-950 sm:text-[64px] lg:text-[78px]">
              Home help, from quick questions to real projects.
            </h1>
            <p className="mt-5 max-w-[650px] text-base leading-7 text-slate-700 sm:text-lg">
              Ask the free AI, book one small handyman job, join for ongoing maintenance, or request an estimate for larger home projects. One clear place to start.
            </p>
            <div className="mt-7 flex flex-col gap-3 sm:flex-row">
              <Link
                href="/home-support"
                className="inline-flex min-h-[54px] items-center justify-center rounded-[8px] bg-blue-600 px-6 text-sm font-black text-white shadow-[0_16px_40px_rgba(37,99,235,0.22)]"
              >
                Start with Home Support AI
              </Link>
              <Link
                href="/book"
                className="inline-flex min-h-[54px] items-center justify-center rounded-[8px] border border-slate-300 bg-white px-6 text-sm font-black text-slate-950"
              >
                Book a $99 handyman visit
              </Link>
            </div>
          </div>

          <div className="mt-9 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            {products.map((product) => (
              <ProductCard key={product.title} product={product} />
            ))}
          </div>
        </div>
      </section>

      <section className="border-y border-slate-200 bg-white">
        <div className="mx-auto grid max-w-[1180px] gap-3 px-4 py-5 sm:grid-cols-2 sm:px-6 lg:grid-cols-4 lg:px-8">
          {trust.map((item) => (
            <div key={item} className="flex items-center gap-2 text-sm font-black text-slate-700">
              <span className="h-2 w-2 rounded-full bg-emerald-500" />
              {item}
            </div>
          ))}
        </div>
      </section>

      <section className="mx-auto max-w-[1180px] px-4 py-14 sm:px-6 lg:px-8 lg:py-20">
        <div className="max-w-[720px]">
          <div className="text-xs font-black uppercase tracking-[0.16em] text-blue-700">
            Start where you are
          </div>
          <h2 className="mt-3 text-3xl font-black leading-tight text-slate-950 sm:text-5xl">
            Every homeowner question has an obvious next step.
          </h2>
        </div>
        <div className="mt-8 grid gap-3 md:grid-cols-2 lg:grid-cols-3">
          {homeownerPaths.map(([question, answer]) => (
            <div key={question} className="rounded-[8px] border border-slate-200 bg-white p-5 shadow-sm">
              <div className="text-base font-black text-slate-950">{question}</div>
              <p className="mt-3 text-sm leading-6 text-slate-600">{answer}</p>
            </div>
          ))}
        </div>
      </section>

      <section className="bg-slate-950 text-white">
        <div className="mx-auto grid max-w-[1180px] gap-8 px-4 py-14 sm:px-6 lg:grid-cols-[0.85fr_1.15fr] lg:px-8 lg:py-20">
          <div>
            <div className="text-xs font-black uppercase tracking-[0.16em] text-blue-300">
              How it works
            </div>
            <h2 className="mt-3 text-3xl font-black leading-tight sm:text-5xl">
              A cleaner way to manage a home.
            </h2>
            <p className="mt-5 text-base leading-7 text-white/65">
              Profixter separates small jobs, ongoing maintenance, and larger projects so homeowners do not have to guess which path fits.
            </p>
          </div>
          <div className="grid gap-3 sm:grid-cols-3">
            {[
              ["1", "Ask", "Use Home Support AI to understand the issue, review documents, or plan materials."],
              ["2", "Choose", "Pick one-time handyman help, membership, or project estimate based on scope."],
              ["3", "Get help", "Book, subscribe, or submit project details through the right flow."],
            ].map(([number, title, body]) => (
              <div key={title} className="rounded-[8px] border border-white/10 bg-white/[0.04] p-5">
                <div className="flex h-9 w-9 items-center justify-center rounded-full bg-white text-sm font-black text-slate-950">
                  {number}
                </div>
                <h3 className="mt-5 text-lg font-black">{title}</h3>
                <p className="mt-3 text-sm leading-6 text-white/60">{body}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="mx-auto max-w-[1180px] px-4 py-14 sm:px-6 lg:px-8 lg:py-20">
        <div className="grid gap-4 lg:grid-cols-2">
          <div className="rounded-[8px] border border-slate-200 bg-white p-6 shadow-sm">
            <div className="text-xs font-black uppercase tracking-[0.16em] text-blue-700">
              Home Support AI
            </div>
            <h2 className="mt-3 text-2xl font-black text-slate-950">
              A free home brain you can bookmark.
            </h2>
            <p className="mt-3 text-sm leading-6 text-slate-600">
              Upload photos, PDFs, contractor quotes, or agreements. Ask for maintenance schedules, tool lists, material lists, safety checks, seasonal planning, and DIY-or-hire guidance.
            </p>
            <Link href="/home-support" className="mt-5 inline-flex text-sm font-black text-blue-700">
              Try Home Support AI -&gt;
            </Link>
          </div>
          <div className="rounded-[8px] border border-slate-200 bg-white p-6 shadow-sm">
            <div className="text-xs font-black uppercase tracking-[0.16em] text-emerald-700">
              Book a Handyman
            </div>
            <h2 className="mt-3 text-2xl font-black text-slate-950">
              One small job, one clear price.
            </h2>
            <p className="mt-3 text-sm leading-6 text-slate-600">
              A $99, 90-minute visit is best for focused handyman work. Appliance repair and larger jobs are excluded so the promise stays clear.
            </p>
            <Link href="/book" className="mt-5 inline-flex text-sm font-black text-blue-700">
              Book a handyman -&gt;
            </Link>
          </div>
          <div className="rounded-[8px] border border-slate-200 bg-white p-6 shadow-sm">
            <div className="text-xs font-black uppercase tracking-[0.16em] text-slate-700">
              Membership
            </div>
            <h2 className="mt-3 text-2xl font-black text-slate-950">
              For homes that always have a list.
            </h2>
            <p className="mt-3 text-sm leading-6 text-slate-600">
              Membership is for ongoing home maintenance, recurring small jobs, priority benefits, and a team that learns your home over time.
            </p>
            <Link href="/membership" className="mt-5 inline-flex text-sm font-black text-blue-700">
              Compare membership -&gt;
            </Link>
          </div>
          <div className="rounded-[8px] border border-slate-200 bg-white p-6 shadow-sm">
            <div className="text-xs font-black uppercase tracking-[0.16em] text-amber-700">
              Home Projects
            </div>
            <h2 className="mt-3 text-2xl font-black text-slate-950">
              Bigger work deserves a real estimate.
            </h2>
            <p className="mt-3 text-sm leading-6 text-slate-600">
              Roofing, siding, bathrooms, kitchens, and renovations start with project details and human follow-up.
            </p>
            <Link href="/projects" className="mt-5 inline-flex text-sm font-black text-blue-700">
              Request estimate -&gt;
            </Link>
          </div>
        </div>
      </section>

      <section className="bg-white">
        <div className="mx-auto max-w-[1180px] px-4 py-14 sm:px-6 lg:px-8 lg:py-20">
          <div className="grid gap-4 lg:grid-cols-3">
            {[
              ["Clear and practical", "The AI helped me understand what to ask before bringing anyone in."],
              ["No confusing sales pitch", "The one-time visit made sense for a small job I did not want to overthink."],
              ["Good for real homeowners", "Membership is the first home service that matches how maintenance actually happens."],
            ].map(([title, quote]) => (
              <figure key={title} className="rounded-[8px] border border-slate-200 bg-slate-50 p-5">
                <blockquote className="text-sm leading-6 text-slate-700">
                  &ldquo;{quote}&rdquo;
                </blockquote>
                <figcaption className="mt-4 text-sm font-black text-slate-950">{title}</figcaption>
              </figure>
            ))}
          </div>
        </div>
      </section>

      <section className="mx-auto max-w-[860px] px-4 py-14 sm:px-6 lg:px-8 lg:py-20">
        <div className="text-center">
          <div className="text-xs font-black uppercase tracking-[0.16em] text-blue-700">
            FAQ
          </div>
          <h2 className="mt-3 text-3xl font-black text-slate-950 sm:text-5xl">
            Simple answers before you start.
          </h2>
        </div>
        <div className="mt-8 space-y-3">
          {faqs.map((faq) => (
            <div key={faq.q} className="rounded-[8px] border border-slate-200 bg-white p-5 shadow-sm">
              <h3 className="text-base font-black text-slate-950">{faq.q}</h3>
              <p className="mt-2 text-sm leading-6 text-slate-600">{faq.a}</p>
            </div>
          ))}
        </div>
      </section>

      <section className="bg-blue-600 text-white">
        <div className="mx-auto flex max-w-[1180px] flex-col gap-5 px-4 py-10 sm:px-6 lg:flex-row lg:items-center lg:justify-between lg:px-8">
          <div>
            <h2 className="text-2xl font-black">Start with the question in front of you.</h2>
            <p className="mt-2 text-sm leading-6 text-white/80">
              The fastest path is usually Home Support AI. If it becomes a job, Profixter will point you to the right product.
            </p>
          </div>
          <Link href="/home-support" className="inline-flex min-h-[52px] items-center justify-center rounded-[8px] bg-white px-6 text-sm font-black text-blue-700">
            Open Home Support AI
          </Link>
        </div>
      </section>

      <Footer />
    </main>
  );
}
