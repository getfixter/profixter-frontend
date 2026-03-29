"use client";

import { useState } from "react";
import Link from "next/link";

/**
 * QuizSection
 *
 * This version makes the subscription path much more visible and persuasive.
 * Instead of sending users to /plans, it sends them to /services/subscription.
 * The final recommendation is also much stronger visually so people do not ignore it.
 */
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
        cta: "See Project Service",
      };
    }

    if (usage === "occasionally") {
      return {
        type: "plan",
        slug: "/services/subscription#basic",
        title: "Basic Subscription",
        subtitle: "Best if you want regular help without paying full hourly rates.",
        cta: "Get Basic Subscription",
      };
    }

    if (usage === "monthly" || usage === "frequent") {
      if (emergency === "yes") {
        return {
          type: "plan",
          slug: "/services/subscription#premium",
          title: "Premium Subscription",
          subtitle: "Best if you want emergency support and the strongest coverage.",
          cta: "Get Premium Subscription",
        };
      }

      return {
        type: "plan",
        slug: "/services/subscription#plus",
        title: "Plus Subscription",
        subtitle: "Best for most homeowners who want ongoing handyman support.",
        cta: "Get Plus Subscription",
      };
    }

    return {
      type: "plan",
      slug: "/services/subscription",
      title: "Subscription",
      subtitle: "Best way to save money and always have help when you need it.",
      cta: "See Subscription Options",
    };
  };

  const handleAnswer = (key: keyof typeof answers, value: string) => {
    setAnswers((prev) => ({ ...prev, [key]: value }));
    setStep((s) => s + 1);
  };

  const recommendation = getRecommendation();

  return (
    <section className="py-12 sm:py-16 px-4 sm:px-6 md:px-8 bg-[#F9FAFB] animate-fadeIn" id="quiz">
      <div className="max-w-3xl mx-auto">
        <div className="text-center mb-6">
          <span className="inline-block px-4 py-1.5 rounded-full bg-[#E8F7EE] text-[#1F7A45] text-sm font-bold mb-4">
            Quick Match
          </span>

          <h2 className="text-2xl sm:text-3xl font-extrabold text-center text-gray-800 mb-3">
            Find the Right Option for Your Home
          </h2>

          <p className="text-gray-600 text-base sm:text-lg max-w-2xl mx-auto">
            Answer 3 quick questions and we’ll show you the best fit — for most homeowners, that means the right subscription.
          </p>
        </div>

        {/* Steps indicator */}
        <div className="flex justify-center mb-8">
          {[0, 1, 2, 3].map((s) => (
            <span
              key={s}
              className={`w-3 h-3 mx-1 rounded-full transition-all ${
                step >= s ? "bg-[#86EFAC]" : "bg-gray-300"
              }`}
            />
          ))}
        </div>

        {step === 0 && (
          <div className="text-center rounded-2xl bg-white border border-gray-200 shadow-sm p-6 sm:p-8">
            <h3 className="text-xl font-semibold mb-4 text-gray-800">
              How often do you need handyman help?
            </h3>

            <div className="flex flex-col sm:flex-row justify-center gap-4">
              <button
                onClick={() => handleAnswer("usage", "occasionally")}
                className="px-4 py-3 rounded-lg bg-white border border-gray-300 hover:bg-gray-50 hover:border-[#86EFAC] text-gray-800 font-medium transition"
              >
                Occasionally
              </button>

              <button
                onClick={() => handleAnswer("usage", "monthly")}
                className="px-4 py-3 rounded-lg bg-white border border-gray-300 hover:bg-gray-50 hover:border-[#86EFAC] text-gray-800 font-medium transition"
              >
                Monthly
              </button>

              <button
                onClick={() => handleAnswer("usage", "frequent")}
                className="px-4 py-3 rounded-lg bg-white border border-gray-300 hover:bg-gray-50 hover:border-[#86EFAC] text-gray-800 font-medium transition"
              >
                Very Often
              </button>
            </div>
          </div>
        )}

        {step === 1 && (
          <div className="text-center rounded-2xl bg-white border border-gray-200 shadow-sm p-6 sm:p-8">
            <h3 className="text-xl font-semibold mb-4 text-gray-800">
              Do you need emergency or after-hours support?
            </h3>

            <div className="flex flex-col sm:flex-row justify-center gap-4">
              <button
                onClick={() => handleAnswer("emergency", "yes")}
                className="px-4 py-3 rounded-lg bg-white border border-gray-300 hover:bg-gray-50 hover:border-[#86EFAC] text-gray-800 font-medium transition"
              >
                Yes
              </button>

              <button
                onClick={() => handleAnswer("emergency", "no")}
                className="px-4 py-3 rounded-lg bg-white border border-gray-300 hover:bg-gray-50 hover:border-[#86EFAC] text-gray-800 font-medium transition"
              >
                No
              </button>
            </div>
          </div>
        )}

        {step === 2 && (
          <div className="text-center rounded-2xl bg-white border border-gray-200 shadow-sm p-6 sm:p-8">
            <h3 className="text-xl font-semibold mb-4 text-gray-800">
              Are you planning a bigger renovation or major project?
            </h3>

            <div className="flex flex-col sm:flex-row justify-center gap-4">
              <button
                onClick={() => handleAnswer("project", "yes")}
                className="px-4 py-3 rounded-lg bg-white border border-gray-300 hover:bg-gray-50 hover:border-[#86EFAC] text-gray-800 font-medium transition"
              >
                Yes
              </button>

              <button
                onClick={() => handleAnswer("project", "no")}
                className="px-4 py-3 rounded-lg bg-white border border-gray-300 hover:bg-gray-50 hover:border-[#86EFAC] text-gray-800 font-medium transition"
              >
                No
              </button>
            </div>
          </div>
        )}

        {step >= 3 && (
          <div className="text-center rounded-3xl border-2 border-[#86EFAC] bg-gradient-to-br from-[#F4FFF7] to-white shadow-[0_20px_60px_rgba(134,239,172,0.18)] p-6 sm:p-10">
            <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-[#E8F7EE] text-[#1F7A45] text-sm font-extrabold mb-4">
              Recommended for You
            </div>

            <h3 className="text-2xl sm:text-4xl font-extrabold mb-3 text-gray-900">
              {recommendation.title}
            </h3>

            <p className="text-gray-700 text-base sm:text-lg mb-3 max-w-2xl mx-auto">
              {recommendation.subtitle}
            </p>

            {recommendation.type === "plan" && (
              <p className="text-sm sm:text-base text-[#1F7A45] font-semibold mb-6">
                Subscription is usually the smartest choice if you want ongoing help and lower service costs.
              </p>
            )}

            <Link
              href={recommendation.slug}
              className="inline-block px-7 py-3.5 rounded-xl bg-[#86EFAC] text-[#0B1220] font-extrabold text-base sm:text-lg hover:opacity-90 transition shadow-md"
            >
              {recommendation.cta}
            </Link>
          </div>
        )}
      </div>
    </section>
  );
}