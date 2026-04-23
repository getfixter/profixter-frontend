"use client";

import dynamic from "next/dynamic";
import Link from "next/link";
import Image from "next/image";
import { useEffect, useRef, useState } from "react";
import Button from "@/app/components/ui/Button";
import PlansSection from "@/app/components/sections/PlansSection";
import { trackEvent } from "@/lib/analytics";

const PopularTasksSection = dynamic(
  () => import("@/app/components/sections/PopularTasksSection"),
  {
    loading: () => (
      <section className="w-full bg-[#eaedfa] py-10 sm:py-12 lg:py-14">
        <div className="mx-auto max-w-[1240px] px-5 lg:px-5">
          <div className="min-h-[520px] rounded-[22px] border border-[#C5CBD8] bg-[#EEF2FF] p-5 shadow-[0_0_200px_rgba(0,0,0,0.08)] sm:min-h-[560px] sm:p-7 lg:min-h-[600px] lg:p-8">
            <div className="max-w-[760px] animate-pulse">
              <div className="h-4 w-40 rounded-full bg-white/70" />
              <div className="mt-4 h-10 w-full max-w-[420px] rounded-full bg-white/70" />
              <div className="mt-3 h-4 w-full max-w-[620px] rounded-full bg-white/60" />
              <div className="mt-2 h-4 w-full max-w-[420px] rounded-full bg-white/60" />
            </div>
          </div>
        </div>
      </section>
    ),
  }
);

const trustItems = [
  "Serving Suffolk & Nassau",
  "Fully insured",
  "Reliable scheduling",
];

const steps = [
  {
    number: "01",
    title: "Choose a plan",
    text: "Pick the monthly option that fits your home and schedule.",
  },
  {
    number: "02",
    title: "Book online",
    text: "Choose your visit on the website with simple next steps.",
  },
  {
    number: "03",
    title: "We handle your home tasks",
    text: "Get reliable help for the small jobs that keep piling up.",
  },
];

export default function LandingPage() {
  const engagedTrackedRef = useRef(false);
  const heroRef = useRef<HTMLElement | null>(null);
  const finalCtaRef = useRef<HTMLElement | null>(null);
  const [showStickyCta, setShowStickyCta] = useState(false);

  useEffect(() => {
    trackEvent("view_landing", { page: "/landing" });
  }, []);

  useEffect(() => {
    const handleScroll = () => {
      if (engagedTrackedRef.current) return;

      const scrollTop = window.scrollY || document.documentElement.scrollTop;
      const viewportHeight = window.innerHeight;
      const docHeight = document.documentElement.scrollHeight;
      const scrollable = docHeight - viewportHeight;
      if (scrollable <= 0) return;

      const progress = scrollTop / scrollable;
      if (progress >= 0.5) {
        engagedTrackedRef.current = true;
        trackEvent("engaged_user", { page: "/landing", depth: "50%" });
      }
    };

    window.addEventListener("scroll", handleScroll, { passive: true });
    handleScroll();
    return () => window.removeEventListener("scroll", handleScroll);
  }, []);

  useEffect(() => {
    const updateStickyCta = () => {
      if (window.innerWidth >= 640) {
        setShowStickyCta(false);
        return;
      }

      const heroBottom = heroRef.current?.getBoundingClientRect().bottom ?? 0;
      const finalTop = finalCtaRef.current?.getBoundingClientRect().top ?? Number.POSITIVE_INFINITY;
      const viewportHeight = window.innerHeight;

      const pastHero = heroBottom < 0;
      const nearFinalCta = finalTop < viewportHeight * 1.15;

      setShowStickyCta(pastHero && !nearFinalCta);
    };

    window.addEventListener("scroll", updateStickyCta, { passive: true });
    window.addEventListener("resize", updateStickyCta);
    updateStickyCta();

    return () => {
      window.removeEventListener("scroll", updateStickyCta);
      window.removeEventListener("resize", updateStickyCta);
    };
  }, []);

  const scrollToPlans = () => {
    const el = document.getElementById("plans");
    if (!el) return;

    const headerOffset = window.innerWidth >= 1024 ? 120 : 100;
    const y = el.getBoundingClientRect().top + window.scrollY - headerOffset;

    window.scrollTo({ top: y, behavior: "smooth" });
    history.replaceState(null, "", "#plans");
  };

  return (
    <main className="min-h-screen overflow-x-hidden bg-[#eaedfa]">
      <section className="bg-[#EEF2FF] px-5 pt-4 sm:px-6 sm:pt-5 lg:px-5 lg:pt-6">
        <div className="mx-auto max-w-[1240px]">
          <div className="flex items-center justify-between rounded-[18px] border border-[#C5CBD8] bg-white/90 px-4 py-3 shadow-sm backdrop-blur-md sm:px-5">
            <Link href="/" className="flex items-center">
              <Image
                src="/images/logo3.png"
                alt="Profixter Long Island"
                width={96}
                height={38}
                sizes="96px"
                priority
              />
            </Link>

            <Link
              href="/signup"
              className="inline-flex h-[46px] items-center justify-center rounded-[14px] bg-[#306EEC] px-5 text-[15px] font-semibold text-white transition hover:bg-[#2558c9]"
            >
              Get Started
            </Link>
          </div>
        </div>
      </section>

      <section ref={heroRef} className="bg-[#EEF2FF] px-5 py-12 sm:px-6 sm:py-16 lg:px-5 lg:py-20">
        <div className="mx-auto max-w-[1240px]">
          <div className="mx-auto max-w-[920px] rounded-[28px] border border-[#C5CBD8] bg-white p-6 text-center shadow-[0_20px_80px_rgba(48,110,236,0.10)] sm:min-h-[430px] sm:p-10 lg:min-h-[460px] lg:p-12">
            <div className="inline-flex rounded-full bg-[#EEF2FF] px-4 py-1.5 text-[12px] font-bold uppercase tracking-[0.2em] text-[#306EEC]">
              Long Island Homeowners
            </div>

            <h1 className="mt-4 text-[34px] font-extrabold leading-[1.02] tracking-[-0.04em] text-[#313234] sm:text-[48px] lg:text-[64px]">
              Personal Handyman Subscription for Long Island Homeowners
            </h1>

            <p className="mx-auto mt-4 max-w-[720px] text-[16px] leading-relaxed text-[#6A6D71] sm:text-[18px]">
              Simple monthly pricing. Easy booking. No estimates. No surprises.
            </p>

            <div className="mt-8 flex flex-col justify-center gap-3 sm:flex-row">
              <Link
                href="/signup"
                className="inline-flex h-[54px] items-center justify-center rounded-[16px] bg-[#306EEC] px-7 text-[16px] font-semibold text-white transition hover:bg-[#2558c9]"
              >
                Get Started
              </Link>

              <Button
                type="button"
                variant="secondary"
                size="md"
                onClick={() => {
                  trackEvent("interested_no_checkout", { page: "/landing", source: "hero_view_plans" });
                  scrollToPlans();
                }}
                className="h-[54px] rounded-[16px] px-7"
              >
                View Plans
              </Button>
            </div>
          </div>
        </div>
      </section>

      <PlansSection />

      <section className="bg-[#eaedfa] px-5 py-6 sm:px-6 sm:py-8 lg:px-5 lg:py-10">
        <div className="mx-auto max-w-[1240px]">
          <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
            <div className="rounded-[18px] border border-[#C5CBD8] bg-white px-5 py-4 text-center text-[15px] font-semibold text-[#313234] shadow-sm">
              Limited booking availability each month
            </div>
            <div className="rounded-[18px] border border-[#C5CBD8] bg-white px-5 py-4 text-center text-[15px] font-semibold text-[#313234] shadow-sm">
              Popular times fill quickly
            </div>
          </div>
        </div>
      </section>

      <section className="bg-[#eaedfa] px-5 py-6 sm:px-6 sm:py-8 lg:px-5 lg:py-10">
        <div className="mx-auto max-w-[1240px]">
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
            {trustItems.map((item) => (
              <div
                key={item}
                className="rounded-[18px] border border-[#C5CBD8] bg-white px-5 py-4 text-center text-[15px] font-semibold text-[#313234] shadow-sm"
              >
                {item}
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="bg-[#eaedfa] px-5 py-10 sm:px-6 sm:py-12 lg:px-5 lg:py-14">
        <div className="mx-auto max-w-[1240px]">
          <div className="rounded-[24px] border border-[#C5CBD8] bg-white p-6 shadow-[0_0_160px_rgba(0,0,0,0.06)] sm:p-8">
            <div className="max-w-[760px]">
              <div className="text-[12px] font-bold uppercase tracking-[0.2em] text-[#306EEC]">
                How It Works
              </div>
              <h2 className="mt-3 text-[30px] font-extrabold leading-tight tracking-[-0.03em] text-[#313234] sm:text-[40px]">
                A simpler way to handle home tasks
              </h2>
            </div>

            <div className="mt-8 grid grid-cols-1 gap-4 md:grid-cols-3">
              {steps.map((step) => (
                <div
                  key={step.number}
                  className="rounded-[20px] border border-[#E6E8EF] bg-[#F8FAFF] p-5"
                >
                  <div className="text-[40px] font-extrabold leading-none text-[#306EEC]/25">
                    {step.number}
                  </div>
                  <div className="mt-3 text-[20px] font-bold text-[#313234]">{step.title}</div>
                  <p className="mt-2 text-[14px] leading-relaxed text-[#6A6D71]">{step.text}</p>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      <PopularTasksSection />

      <section className="bg-[#eaedfa] px-5 py-6 sm:px-6 sm:py-8 lg:px-5 lg:py-10">
        <div className="mx-auto max-w-[1240px]">
          <div className="rounded-[20px] border border-[#C5CBD8] bg-white px-5 py-4 text-center text-[15px] font-medium text-[#313234] shadow-sm sm:text-[16px]">
            Most members book one visit per month for ongoing home tasks.
          </div>
        </div>
      </section>

      <section ref={finalCtaRef} className="bg-[#eaedfa] px-5 py-10 sm:px-6 sm:py-12 lg:px-5 lg:py-16">
        <div className="mx-auto max-w-[1240px]">
          <div className="rounded-[24px] border border-[#2558c9]/20 bg-[#306EEC] px-6 py-8 text-white shadow-[0_24px_80px_rgba(48,110,236,0.24)] sm:px-8 sm:py-10 lg:px-10 lg:py-12">
            <div className="max-w-[760px]">
              <div className="text-[12px] font-bold uppercase tracking-[0.2em] text-white/75">
                Final Step
              </div>
              <h2 className="mt-3 text-[30px] font-extrabold leading-[1.02] tracking-[-0.04em] sm:text-[42px]">
                Stop searching for a handyman every time
              </h2>
              <p className="mt-4 max-w-[620px] text-[16px] leading-relaxed text-white/85">
                Get reliable home help with simple monthly pricing.
              </p>
            </div>

            <div className="mt-6 flex flex-col gap-3 sm:flex-row">
              <Link
                href="/signup"
                className="inline-flex h-[54px] items-center justify-center rounded-[16px] bg-white px-7 text-[16px] font-semibold text-[#306EEC] transition hover:bg-[#EEF2FF]"
              >
                Get Started
              </Link>

              <Button
                type="button"
                variant="ghost"
                size="md"
                onClick={() => {
                  trackEvent("interested_no_checkout", { page: "/landing", source: "final_view_plans" });
                  scrollToPlans();
                }}
                className="h-[54px] rounded-[16px] border-white px-7 text-white hover:bg-white/15"
              >
                View Plans
              </Button>
            </div>
          </div>
        </div>
      </section>

      {showStickyCta && (
        <div className="fixed inset-x-0 bottom-3 z-40 px-4 sm:hidden">
          <div className="mx-auto max-w-[420px] rounded-[18px] border border-[#C5CBD8] bg-white/95 p-3 shadow-[0_18px_60px_rgba(17,24,39,0.18)] backdrop-blur-md">
            <Link
              href="/signup"
              onClick={() => trackEvent("sticky_cta_click", { page: "/landing" })}
              className="flex w-full items-center justify-center rounded-[14px] bg-[#306EEC] px-5 py-3 text-[15px] font-semibold text-white transition hover:bg-[#2558c9]"
            >
              Get Started
            </Link>
            <div className="mt-2 text-center text-[12px] font-medium text-[#6A6D71]">
              Plans start at $149/month
            </div>
          </div>
        </div>
      )}
    </main>
  );
}
