"use client";

import Link from "next/link";
import {
  CalendarDaysIcon,
  CheckCircleIcon,
  ExclamationCircleIcon,
} from "@heroicons/react/24/outline";
import { useAuth } from "@/lib/useAuth";
import { POPULAR_TASKS } from "@/app/components/sections/PopularTasksSection";
import { trackEvent } from "@/lib/analytics";

const HOW_VISITS_WORK = [
  "Each visit covers up to 90 minutes of work",
  "Most members book one visit per month",
];

const NOT_INCLUDED = [
  "Large projects",
  "Structural or permit-required work",
  "Anything exceeding visit scope",
];

export default function IncludedPage() {
  const { user, isAuthenticated } = useAuth();

  const isSubscribed =
    !!isAuthenticated &&
    !!user?.addresses?.some((addr) => addr.hasActiveSubscription);

  const ctaHref = isSubscribed ? "/#pick-day" : "/#plans";
  const ctaLabel = isSubscribed ? "Book Visit" : "View Plans";

  return (
    <div className="min-h-screen bg-[#F6F8FF]">
      <section className="border-b border-[#D9E4FF] bg-white">
        <div className="mx-auto max-w-[1240px] px-5 py-14 sm:px-6 sm:py-16 lg:px-5 lg:py-20">
          <div className="mx-auto max-w-[860px] text-center">
            <div className="text-[12px] font-bold uppercase tracking-[0.2em] text-[#306EEC]">
              Included With Your Plan
            </div>
            <h1 className="mt-3 text-[34px] font-extrabold leading-[1.02] tracking-[-0.04em] text-[#313234] sm:text-[48px] lg:text-[60px]">
              What can I book with my plan?
            </h1>
            <p className="mx-auto mt-4 max-w-[760px] text-[15px] leading-relaxed text-[#6A6D71] sm:text-[17px]">
              Common handyman tasks, simple visit expectations, and a clear guide to what fits your membership.
            </p>
            <div className="mt-8 flex flex-col items-center justify-center gap-3 sm:flex-row">
              <Link
                href={ctaHref}
                onClick={() =>
                  trackEvent(isSubscribed ? "start_booking" : "view_plans", {
                    placement: "included_hero",
                  })
                }
                className="inline-flex h-[54px] items-center justify-center rounded-[16px] bg-[#306EEC] px-6 text-[16px] font-semibold text-white transition-colors hover:bg-[#2558C9]"
              >
                {ctaLabel}
              </Link>
              <Link
                href="/"
                className="inline-flex h-[54px] items-center justify-center rounded-[16px] border border-[#C5CBD8] bg-white px-6 text-[16px] font-semibold text-[#313234] transition-colors hover:bg-[#F6F7FB]"
              >
                Back to homepage
              </Link>
            </div>
          </div>
        </div>
      </section>

      <section className="mx-auto max-w-[1240px] px-5 py-10 sm:px-6 sm:py-12 lg:px-5">
        <div className="grid gap-5 lg:grid-cols-[1.3fr_0.85fr_0.85fr]">
          <div className="rounded-[24px] border border-[#C5CBD8] bg-white p-6 shadow-[0_18px_60px_rgba(48,110,236,0.08)] sm:p-8">
            <div className="flex items-center gap-3">
              <div className="flex h-11 w-11 items-center justify-center rounded-[14px] bg-[#EEF2FF] text-[#306EEC]">
                <CheckCircleIcon className="h-6 w-6" />
              </div>
              <div>
                <h2 className="text-[22px] font-bold text-[#313234] sm:text-[26px]">Common tasks</h2>
                <p className="mt-1 text-[14px] leading-relaxed text-[#6A6D71]">
                  Popular examples members commonly book.
                </p>
              </div>
            </div>

            <div className="mt-6 grid gap-3 sm:grid-cols-2">
              {POPULAR_TASKS.map((task) => (
                <div
                  key={task.title}
                  className="rounded-[18px] border border-[#E6E8EF] bg-[#F8FAFF] p-4"
                >
                  <div className="flex items-start gap-3">
                    <div className="mt-0.5 flex h-10 w-10 shrink-0 items-center justify-center rounded-[12px] bg-white text-[#306EEC] shadow-sm">
                      {task.icon}
                    </div>
                    <div>
                      <div className="text-[15px] font-semibold text-[#313234]">{task.title}</div>
                      <div className="mt-1 text-[13px] leading-relaxed text-[#6A6D71]">{task.subtitle}</div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>

          <div className="rounded-[24px] border border-[#C5CBD8] bg-[#EEF2FF] p-6 sm:p-8">
            <div className="flex items-center gap-3">
              <div className="flex h-11 w-11 items-center justify-center rounded-[14px] bg-white text-[#306EEC]">
                <CalendarDaysIcon className="h-6 w-6" />
              </div>
              <div>
                <h2 className="text-[22px] font-bold text-[#313234] sm:text-[26px]">How visits work</h2>
                <p className="mt-1 text-[14px] leading-relaxed text-[#6A6D71]">
                  Simple expectations before you book.
                </p>
              </div>
            </div>

            <div className="mt-6 space-y-3">
              {HOW_VISITS_WORK.map((item) => (
                <div
                  key={item}
                  className="rounded-[18px] border border-[#D9E4FF] bg-white p-4 text-[15px] font-medium text-[#313234]"
                >
                  {item}
                </div>
              ))}
            </div>
          </div>

          <div className="rounded-[24px] border border-[#F0D5DD] bg-white p-6 sm:p-8">
            <div className="flex items-center gap-3">
              <div className="flex h-11 w-11 items-center justify-center rounded-[14px] bg-[#FFF1F3] text-[#BE123C]">
                <ExclamationCircleIcon className="h-6 w-6" />
              </div>
              <div>
                <h2 className="text-[22px] font-bold text-[#313234] sm:text-[26px]">What&apos;s not included</h2>
                <p className="mt-1 text-[14px] leading-relaxed text-[#6A6D71]">
                  Bigger work moves into project scope.
                </p>
              </div>
            </div>

            <div className="mt-6 space-y-3">
              {NOT_INCLUDED.map((item) => (
                <div
                  key={item}
                  className="rounded-[18px] border border-[#F3E8EC] bg-[#FFFBFC] p-4 text-[15px] font-medium text-[#313234]"
                >
                  {item}
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      <section className="mx-auto max-w-[1240px] px-5 pb-14 sm:px-6 sm:pb-16 lg:px-5 lg:pb-20">
        <div className="rounded-[24px] border border-[#C5CBD8] bg-[#313234] px-6 py-8 text-white shadow-[0_24px_80px_rgba(17,24,39,0.2)] sm:px-8 sm:py-10">
          <div className="max-w-[760px]">
            <div className="text-[12px] font-bold uppercase tracking-[0.2em] text-white/70">Next Step</div>
            <h2 className="mt-3 text-[28px] font-extrabold leading-tight tracking-[-0.03em] sm:text-[36px]">
              Ready to book your next visit?
            </h2>
            <p className="mt-3 text-[15px] leading-relaxed text-white/75 sm:text-[16px]">
              Choose your plan or head straight to booking if you&apos;re already active.
            </p>
          </div>

          <div className="mt-6 flex flex-col gap-3 sm:flex-row">
            <Link
              href={ctaHref}
              onClick={() =>
                trackEvent(isSubscribed ? "start_booking" : "view_plans", {
                  placement: "included_final_cta",
                })
              }
              className="inline-flex h-[54px] items-center justify-center rounded-[16px] bg-[#306EEC] px-6 text-[16px] font-semibold text-white transition-colors hover:bg-[#2558C9]"
            >
              {ctaLabel}
            </Link>
            <Link
              href="/membership"
              className="inline-flex h-[54px] items-center justify-center rounded-[16px] border border-white/20 bg-white/10 px-6 text-[16px] font-semibold text-white transition-colors hover:bg-white/15"
            >
              Compare Plans
            </Link>
          </div>
        </div>
      </section>
    </div>
  );
}
