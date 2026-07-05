"use client";

import { useState } from "react";
import Link from "next/link";
import { trackEvent } from "@/lib/analytics";

const QUESTIONS = [
  {
    key: "usage" as const,
    question: "How often do you need handyman help?",
    hint: "Think about the last 6 months",
    choices: [
      {
        value: "occasionally",
        label: "Occasionally",
        sub: "A few times a year",
        icon: (
          <svg width="22" height="22" viewBox="0 0 24 24" fill="none" aria-hidden="true">
            <path d="M8 6h13M8 12h13M8 18h13M3 6h.01M3 12h.01M3 18h.01" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        ),
      },
      {
        value: "monthly",
        label: "Monthly",
        sub: "Once or twice a month",
        icon: (
          <svg width="22" height="22" viewBox="0 0 24 24" fill="none" aria-hidden="true">
            <rect x="3" y="4" width="18" height="18" rx="2" stroke="currentColor" strokeWidth="1.8" />
            <path d="M16 2v4M8 2v4M3 10h18" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
          </svg>
        ),
      },
      {
        value: "frequent",
        label: "Very Often",
        sub: "Weekly or ongoing",
        icon: (
          <svg width="22" height="22" viewBox="0 0 24 24" fill="none" aria-hidden="true">
            <path d="M13 2L3 14h9l-1 8 10-12h-9l1-8z" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        ),
      },
    ],
  },
  {
    key: "emergency" as const,
    question: "Would you value faster scheduling when something can't wait?",
    hint: "Rush Visits don't require waiting for the next standard appointment slot.",
    choices: [
      {
        value: "yes",
        label: "Yes",
        sub: "Peace of mind matters",
        icon: (
          <svg width="22" height="22" viewBox="0 0 24 24" fill="none" aria-hidden="true">
            <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        ),
      },
      {
        value: "no",
        label: "No",
        sub: "Planned visits are fine",
        icon: (
          <svg width="22" height="22" viewBox="0 0 24 24" fill="none" aria-hidden="true">
            <path d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        ),
      },
    ],
  },
  {
    key: "project" as const,
    question: "Are you planning a larger renovation or major project?",
    hint: "Anything beyond routine upkeep",
    choices: [
      {
        value: "yes",
        label: "Yes",
        sub: "Renovation or big build",
        icon: (
          <svg width="22" height="22" viewBox="0 0 24 24" fill="none" aria-hidden="true">
            <rect x="2" y="7" width="20" height="14" rx="2" stroke="currentColor" strokeWidth="1.8" />
            <path d="M16 7V5a2 2 0 00-2-2h-4a2 2 0 00-2 2v2" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
          </svg>
        ),
      },
      {
        value: "no",
        label: "No",
        sub: "Regular upkeep & fixes",
        icon: (
          <svg width="22" height="22" viewBox="0 0 24 24" fill="none" aria-hidden="true">
            <path d="M14.7 6.3a1 1 0 010 1.4l-8 8a1 1 0 01-.4.3l-4 1a1 1 0 01-1.3-1.3l1-4a1 1 0 01.3-.4l8-8a1 1 0 011.4 0l3 3z" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        ),
      },
    ],
  },
];

function getRecommendation(answers: { usage?: string; emergency?: string; project?: string }) {
  const { usage, emergency, project } = answers;

  if (project === "yes") {
    return {
      type: "service",
      slug: "/services/general-contractor",
      title: "General Contractor",
      subtitle: "Best for larger renovation or improvement projects.",
      cta: "Request Estimate",
      color: "#D97706",
      colorBg: "rgba(217,119,6,0.08)",
      colorBorder: "rgba(217,119,6,0.20)",
    };
  }

  if (usage === "occasionally") {
    return {
      type: "plan",
      slug: "/#plans",
      title: "Basic Membership",
      subtitle: "Best if you want regular help without paying full hourly rates.",
      cta: "View Plans",
      color: "#306EEC",
      colorBg: "rgba(48,110,236,0.08)",
      colorBorder: "rgba(48,110,236,0.20)",
    };
  }

  if (usage === "monthly" || usage === "frequent") {
    if (emergency === "yes") {
      return {
        type: "plan",
        slug: "/#plans",
        title: "Premium Membership",
        subtitle: "Best if you want Rush Visits and the strongest coverage.",
        cta: "View Plans",
        color: "#306EEC",
        colorBg: "rgba(48,110,236,0.08)",
        colorBorder: "rgba(48,110,236,0.20)",
      };
    }
    return {
      type: "plan",
      slug: "/#plans",
      title: "Plus Membership",
      subtitle: "Best for most homeowners who want ongoing handyman support.",
      cta: "View Plans",
      color: "#306EEC",
      colorBg: "rgba(48,110,236,0.08)",
      colorBorder: "rgba(48,110,236,0.20)",
    };
  }

  return {
    type: "plan",
    slug: "/#plans",
    title: "Membership",
    subtitle: "Best way to save money and always have help when you need it.",
    cta: "View Plans",
    color: "#306EEC",
    colorBg: "rgba(48,110,236,0.08)",
    colorBorder: "rgba(48,110,236,0.20)",
  };
}

export default function QuizSection() {
  const [step, setStep] = useState(0);
  const [answers, setAnswers] = useState<{ usage?: string; emergency?: string; project?: string }>({});

  const handleAnswer = (key: keyof typeof answers, value: string) => {
    setAnswers((prev) => ({ ...prev, [key]: value }));
    setStep((s) => s + 1);
  };

  const recommendation = getRecommendation(answers);
  const totalSteps = QUESTIONS.length;
  const isDone = step >= totalSteps;

  return (
    <section
      id="quiz"
      className="relative w-full overflow-hidden py-16 sm:py-20 lg:py-28"
      style={{ background: "linear-gradient(160deg, #EAEDFA 0%, #E4E9F8 100%)" }}
    >
      {/* Ambient glow */}
      <div
        aria-hidden="true"
        className="pointer-events-none absolute top-0 left-1/2 -translate-x-1/2 h-[500px] w-[900px] rounded-full blur-[160px] opacity-40"
        style={{ background: "radial-gradient(circle, rgba(48,110,236,0.12), transparent 70%)" }}
      />

      <div className="relative mx-auto max-w-[1280px] px-4 sm:px-6 lg:px-8">

        {/* ── Header ── */}
        <div className="mx-auto max-w-[680px] text-center mb-12 sm:mb-14">
          <div className="inline-flex items-center gap-2.5 rounded-full border border-[#D9E4FF] bg-white px-4 py-2 mb-6 shadow-[0_2px_12px_rgba(48,110,236,0.08)]">
            <svg width="11" height="11" viewBox="0 0 24 24" fill="none" className="text-[#306EEC]" aria-hidden="true">
              <path d="M8.228 9c.549-1.165 2.03-2 3.772-2 2.21 0 4 1.343 4 3 0 1.4-1.278 2.575-3.006 2.907-.542.104-.994.54-.994 1.093m0 3h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
            <span className="text-[11px] font-bold uppercase tracking-[0.2em] text-[#306EEC]">
              Quick Match
            </span>
          </div>

          <h2 className="text-[32px] sm:text-[50px] lg:text-[60px] font-black leading-[0.92] tracking-[-0.04em] text-[#0B1628] mb-5">
            Find the right plan
            <br />
            <span className="text-[#306EEC]">for your home.</span>
          </h2>

          <p className="mx-auto max-w-[520px] text-[15px] sm:text-[17px] leading-relaxed text-[#475569]">
            Answer 3 quick questions and we&rsquo;ll recommend the best fit — no
            obligations, no sign-up required.
          </p>
        </div>

        {/* ── Card ── */}
        <div className="mx-auto max-w-[780px] rounded-[28px] border border-[#C5CBD8] bg-white shadow-[0_24px_80px_rgba(15,23,42,0.08)] overflow-hidden">

          {/* Progress bar */}
          {!isDone && (
            <div className="h-1 bg-[#EEF2FF] w-full">
              <div
                className="h-full bg-[#306EEC] transition-all duration-500 ease-out"
                style={{ width: `${(step / totalSteps) * 100}%` }}
              />
            </div>
          )}

          <div className="p-7 sm:p-10">
            {!isDone ? (
              <>
                {/* Step counter */}
                <div className="flex items-center justify-between mb-6">
                  <span className="text-[12px] font-bold uppercase tracking-[0.18em] text-[#94A3B8]">
                    Question {step + 1} of {totalSteps}
                  </span>
                  <div className="flex gap-1.5">
                    {QUESTIONS.map((_, i) => (
                      <span
                        key={i}
                        className={`h-1.5 rounded-full transition-all duration-300 ${
                          i < step
                            ? "w-6 bg-[#306EEC]"
                            : i === step
                            ? "w-6 bg-[#306EEC]/40"
                            : "w-3 bg-[#E2E8F0]"
                        }`}
                      />
                    ))}
                  </div>
                </div>

                {/* Question */}
                <div className="mb-8">
                  <h3 className="text-[22px] sm:text-[28px] font-extrabold text-[#0B1628] leading-snug mb-2">
                    {QUESTIONS[step].question}
                  </h3>
                  <p className="text-[14px] text-[#94A3B8] font-medium">
                    {QUESTIONS[step].hint}
                  </p>
                </div>

                {/* Choices */}
                <div className={`grid gap-3 ${QUESTIONS[step].choices.length === 2 ? "sm:grid-cols-2" : "sm:grid-cols-3"}`}>
                  {QUESTIONS[step].choices.map((choice) => (
                    <button
                      key={choice.value}
                      type="button"
                      onClick={() => handleAnswer(QUESTIONS[step].key, choice.value)}
                      className="group flex flex-col items-center gap-3 rounded-[20px] border border-[#E2E8F0] bg-[#F8FAFF] p-5 text-center transition-all duration-200 hover:border-[#306EEC]/40 hover:bg-[#EEF5FF] hover:shadow-[0_8px_32px_rgba(48,110,236,0.12)] focus:outline-none focus:border-[#306EEC]/50 active:scale-[0.98]"
                    >
                      <div className="flex h-12 w-12 items-center justify-center rounded-[14px] bg-white text-[#64748B] shadow-sm transition-all group-hover:bg-[#EEF2FF] group-hover:text-[#306EEC]">
                        {choice.icon}
                      </div>
                      <div>
                        <div className="text-[16px] font-bold text-[#0B1628] group-hover:text-[#306EEC] transition-colors">
                          {choice.label}
                        </div>
                        <div className="mt-0.5 text-[12px] text-[#94A3B8] font-medium leading-snug">
                          {choice.sub}
                        </div>
                      </div>
                    </button>
                  ))}
                </div>
              </>
            ) : (
              /* ── Result ── */
              <div className="text-center">
                <div
                  className="inline-flex items-center gap-2 rounded-full px-4 py-1.5 text-[12px] font-bold uppercase tracking-[0.18em] mb-6"
                  style={{
                    background: recommendation.colorBg,
                    border: `1px solid ${recommendation.colorBorder}`,
                    color: recommendation.color,
                  }}
                >
                  <svg width="11" height="11" viewBox="0 0 24 24" fill="none" aria-hidden="true">
                    <path d="M5 12.5l4 4 10-10" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" />
                  </svg>
                  Recommended for You
                </div>

                {/* Icon */}
                <div
                  className="mx-auto mb-6 flex h-20 w-20 items-center justify-center rounded-full"
                  style={{ background: recommendation.colorBg }}
                >
                  <svg width="34" height="34" viewBox="0 0 24 24" fill="none" aria-hidden="true">
                    <path
                      d="M9 12l2 2 4-4M7.835 4.697a3.42 3.42 0 001.946-.806 3.42 3.42 0 014.438 0 3.42 3.42 0 001.946.806 3.42 3.42 0 013.138 3.138 3.42 3.42 0 00.806 1.946 3.42 3.42 0 010 4.438 3.42 3.42 0 00-.806 1.946 3.42 3.42 0 01-3.138 3.138 3.42 3.42 0 00-1.946.806 3.42 3.42 0 01-4.438 0 3.42 3.42 0 00-1.946-.806 3.42 3.42 0 01-3.138-3.138 3.42 3.42 0 00-.806-1.946 3.42 3.42 0 010-4.438 3.42 3.42 0 00.806-1.946 3.42 3.42 0 013.138-3.138z"
                      stroke={recommendation.color}
                      strokeWidth="1.8"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    />
                  </svg>
                </div>

                <h3 className="text-[28px] sm:text-[38px] font-black text-[#0B1628] tracking-[-0.03em] leading-tight mb-3">
                  {recommendation.title}
                </h3>

                <p className="mx-auto max-w-[480px] text-[15px] sm:text-[17px] text-[#475569] leading-relaxed mb-8">
                  {recommendation.subtitle}
                </p>

                <div className="flex flex-col sm:flex-row gap-3 justify-center">
                  <Link
                    href={recommendation.slug}
                    onClick={() =>
                      trackEvent("start_signup", {
                        placement: "quiz",
                        recommendation: recommendation.title,
                      })
                    }
                    className="inline-flex h-[54px] items-center justify-center rounded-[16px] bg-[#306EEC] px-8 text-[16px] font-extrabold text-white transition-all hover:bg-[#2558c9] hover:-translate-y-0.5"
                    style={{ boxShadow: "0 12px 36px rgba(48,110,236,0.30)" }}
                  >
                    {recommendation.cta}
                  </Link>
                  <button
                    type="button"
                    onClick={() => { setStep(0); setAnswers({}); }}
                    className="inline-flex h-[54px] items-center justify-center rounded-[16px] border border-[#C5CBD8] bg-white px-8 text-[16px] font-semibold text-[#475569] transition-colors hover:bg-[#F6F7FB]"
                  >
                    Start over
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>

      </div>
    </section>
  );
}
