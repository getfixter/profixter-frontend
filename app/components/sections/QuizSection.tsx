"use client";

import { useState } from "react";
import Link from "next/link";
import Button from "@/app/components/ui/Button";
import { trackEvent } from "@/lib/analytics";

export default function QuizSection() {
  const [step, setStep] = useState(0);
  const [answers, setAnswers] = useState<{
    usage?: string;
    emergency?: string;
    project?: string;
  }>({});

  const getRecommendation = () => {
    const { usage, emergency, project } = answers;

    if (project === "yes") {
      return {
        type: "service",
        slug: "/services/general-contractor",
        title: "General Contractor",
        subtitle: "Best for larger renovation or improvement projects.",
        cta: "Get Started",
      };
    }

    if (usage === "occasionally") {
      return {
        type: "plan",
        slug: "/services/subscription#basic",
        title: "Basic Subscription",
        subtitle: "Best if you want regular help without paying full hourly rates.",
        cta: "Get Started",
      };
    }

    if (usage === "monthly" || usage === "frequent") {
      if (emergency === "yes") {
        return {
          type: "plan",
          slug: "/services/subscription#premium",
          title: "Premium Subscription",
          subtitle: "Best if you want emergency support and the strongest coverage.",
          cta: "Get Started",
        };
      }

      return {
        type: "plan",
        slug: "/services/subscription#plus",
        title: "Plus Subscription",
        subtitle: "Best for most homeowners who want ongoing handyman support.",
        cta: "Get Started",
      };
    }

    return {
      type: "plan",
      slug: "/services/subscription",
      title: "Subscription",
      subtitle: "Best way to save money and always have help when you need it.",
      cta: "Get Started",
    };
  };

  const handleAnswer = (key: keyof typeof answers, value: string) => {
    setAnswers((prev) => ({ ...prev, [key]: value }));
    setStep((s) => s + 1);
  };

  const recommendation = getRecommendation();

  return (
    <section className="animate-fadeIn bg-[#eaedfa] px-5 py-10 sm:px-6 sm:py-12 lg:px-5 lg:py-14" id="quiz">
      <div className="mx-auto max-w-[1240px]">
        <div className="mx-auto max-w-3xl rounded-[22px] border border-[#C5CBD8] bg-white p-5 shadow-[0_0_160px_rgba(0,0,0,0.06)] sm:p-7 lg:p-8">
          <div className="mb-6 text-center">
            <span className="mb-4 inline-block rounded-full bg-[#EEF2FF] px-4 py-1.5 text-sm font-bold text-[#306EEC]">
              Quick Match
            </span>

            <h2 className="mb-3 text-center text-2xl font-extrabold text-gray-800 sm:text-3xl">
              Find the Right Option for Your Home
            </h2>

            <p className="mx-auto max-w-2xl text-base text-gray-600 sm:text-[17px]">
              Answer 3 quick questions and we&apos;ll show you the best fit for your home.
            </p>
          </div>

          <div className="mb-8 flex justify-center">
            {[0, 1, 2, 3].map((s) => (
              <span
                key={s}
                className={`mx-1 h-3 w-3 rounded-full transition-all ${step >= s ? "bg-[#306EEC]" : "bg-gray-300"}`}
              />
            ))}
          </div>

          {step === 0 && (
            <div className="rounded-2xl border border-gray-200 bg-white p-6 text-center shadow-sm sm:p-8">
              <h3 className="mb-4 text-xl font-semibold text-gray-800">
                How often do you need handyman help?
              </h3>

              <div className="flex flex-col justify-center gap-4 sm:flex-row">
                <Button onClick={() => handleAnswer("usage", "occasionally")} variant="secondary" className="w-full sm:w-auto px-5">
                  Occasionally
                </Button>
                <Button onClick={() => handleAnswer("usage", "monthly")} variant="secondary" className="w-full sm:w-auto px-5">
                  Monthly
                </Button>
                <Button onClick={() => handleAnswer("usage", "frequent")} variant="secondary" className="w-full sm:w-auto px-5">
                  Very Often
                </Button>
              </div>
            </div>
          )}

          {step === 1 && (
            <div className="rounded-2xl border border-gray-200 bg-white p-6 text-center shadow-sm sm:p-8">
              <h3 className="mb-4 text-xl font-semibold text-gray-800">
                Do you need emergency or after-hours support?
              </h3>

              <div className="flex flex-col justify-center gap-4 sm:flex-row">
                <Button onClick={() => handleAnswer("emergency", "yes")} variant="secondary" className="w-full sm:w-auto px-6">
                  Yes
                </Button>
                <Button onClick={() => handleAnswer("emergency", "no")} variant="secondary" className="w-full sm:w-auto px-6">
                  No
                </Button>
              </div>
            </div>
          )}

          {step === 2 && (
            <div className="rounded-2xl border border-gray-200 bg-white p-6 text-center shadow-sm sm:p-8">
              <h3 className="mb-4 text-xl font-semibold text-gray-800">
                Are you planning a bigger renovation or major project?
              </h3>

              <div className="flex flex-col justify-center gap-4 sm:flex-row">
                <Button onClick={() => handleAnswer("project", "yes")} variant="secondary" className="w-full sm:w-auto px-6">
                  Yes
                </Button>
                <Button onClick={() => handleAnswer("project", "no")} variant="secondary" className="w-full sm:w-auto px-6">
                  No
                </Button>
              </div>
            </div>
          )}

          {step >= 3 && (
            <div className="rounded-3xl border border-[#C5CBD8] bg-[#EEF2FF] p-6 text-center shadow-[0_20px_60px_rgba(48,110,236,0.12)] sm:p-10">
              <div className="mb-4 inline-flex items-center gap-2 rounded-full bg-white px-4 py-1.5 text-sm font-extrabold text-[#306EEC]">
                Recommended for You
              </div>

              <h3 className="mb-3 text-2xl font-extrabold text-gray-900 sm:text-4xl">
                {recommendation.title}
              </h3>

              <p className="mx-auto mb-3 max-w-2xl text-base text-gray-700 sm:text-lg">
                {recommendation.subtitle}
              </p>

              {recommendation.type === "plan" && (
                <p className="mb-6 text-sm font-semibold text-[#306EEC] sm:text-base">
                  Subscription is usually the best fit for ongoing home tasks.
                </p>
              )}

              <Link
                href={recommendation.slug}
                onClick={() => trackEvent("start_signup", { placement: "quiz", recommendation: recommendation.title })}
                className="inline-flex h-12 items-center justify-center rounded-[14px] bg-[#306EEC] px-6 text-base font-semibold text-white transition-colors hover:bg-[#2558c9]"
              >
                {recommendation.cta}
              </Link>
            </div>
          )}
        </div>
      </div>
    </section>
  );
}
