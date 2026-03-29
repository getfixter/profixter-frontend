"use client";

import { useState } from "react";
import Link from "next/link";

/**
 * QuizSection
 *
 * An interactive quiz that asks visitors about their needs and recommends the
 * appropriate subscription plan or on‑demand service.  It collects simple
 * information through multiple choice questions.  The component is mobile
 * friendly and uses minimal UI controls to keep the experience quick and
 * engaging.  At the end of the quiz it displays the recommended plan with a
 * call‑to‑action button to proceed.
 */
export default function QuizSection() {
  const [step, setStep] = useState(0);
  const [answers, setAnswers] = useState<{ usage?: string; emergency?: string; project?: string }>({});

  // Determine recommendation based on answers
  const getRecommendation = () => {
    const { usage, emergency, project } = answers;
    // If visitor plans a renovation or large project, route to general contractor
    if (project === "yes") {
      return { type: "service", slug: "/services/general-contractor", title: "General Contractor" };
    }
    if (usage === "occasionally") {
      return { type: "plan", slug: "/plans#basic", title: "Basic Plan" };
    }
    if (usage === "monthly" || usage === "frequent") {
      if (emergency === "yes") {
        return { type: "plan", slug: "/plans#premium", title: "Premium Plan" };
      }
      return { type: "plan", slug: "/plans#plus", title: "Plus Plan" };
    }
    // Fallback
    return { type: "plan", slug: "/plans", title: "Our Plans" };
  };

  const handleAnswer = (key: keyof typeof answers, value: string) => {
    setAnswers((prev) => ({ ...prev, [key]: value }));
    setStep((s) => s + 1);
  };

  const recommendation = getRecommendation();

  return (
    <section className="py-12 sm:py-16 px-4 sm:px-6 md:px-8 bg-[#F9FAFB]" id="quiz">
      <div className="max-w-3xl mx-auto">
        <h2 className="text-2xl sm:text-3xl font-extrabold text-center text-gray-800 mb-6">
          Find the Right Plan for You
        </h2>
        {/* Steps indicator */}
        <div className="flex justify-center mb-8">
          {[0, 1, 2, 3].map((s) => (
            <span
              key={s}
              className={`w-3 h-3 mx-1 rounded-full ${step >= s ? "bg-[#86EFAC]" : "bg-gray-300"}`}
            />
          ))}
        </div>
        {step === 0 && (
          <div className="text-center">
            <h3 className="text-xl font-semibold mb-4 text-gray-700">How often do you need handyman help?</h3>
            <div className="flex flex-col sm:flex-row justify-center gap-4">
              <button
                onClick={() => handleAnswer("usage", "occasionally")}
                className="px-4 py-3 rounded-lg bg-white border border-gray-300 hover:bg-gray-50 text-gray-800 font-medium"
              >
                Occasionally (few times a year)
              </button>
              <button
                onClick={() => handleAnswer("usage", "monthly")}
                className="px-4 py-3 rounded-lg bg-white border border-gray-300 hover:bg-gray-50 text-gray-800 font-medium"
              >
                Monthly
              </button>
              <button
                onClick={() => handleAnswer("usage", "frequent")}
                className="px-4 py-3 rounded-lg bg-white border border-gray-300 hover:bg-gray-50 text-gray-800 font-medium"
              >
                Weekly or more
              </button>
            </div>
          </div>
        )}
        {step === 1 && (
          <div className="text-center">
            <h3 className="text-xl font-semibold mb-4 text-gray-700">Do you need 24/7 emergency or after‑hours service?</h3>
            <div className="flex flex-col sm:flex-row justify-center gap-4">
              <button
                onClick={() => handleAnswer("emergency", "yes")}
                className="px-4 py-3 rounded-lg bg-white border border-gray-300 hover:bg-gray-50 text-gray-800 font-medium"
              >
                Yes, I need emergency visits
              </button>
              <button
                onClick={() => handleAnswer("emergency", "no")}
                className="px-4 py-3 rounded-lg bg-white border border-gray-300 hover:bg-gray-50 text-gray-800 font-medium"
              >
                No, daytime visits are fine
              </button>
            </div>
          </div>
        )}
        {step === 2 && (
          <div className="text-center">
            <h3 className="text-xl font-semibold mb-4 text-gray-700">Are you planning a major renovation or big project?</h3>
            <div className="flex flex-col sm:flex-row justify-center gap-4">
              <button
                onClick={() => handleAnswer("project", "yes")}
                className="px-4 py-3 rounded-lg bg-white border border-gray-300 hover:bg-gray-50 text-gray-800 font-medium"
              >
                Yes, I need a contractor
              </button>
              <button
                onClick={() => handleAnswer("project", "no")}
                className="px-4 py-3 rounded-lg bg-white border border-gray-300 hover:bg-gray-50 text-gray-800 font-medium"
              >
                No, just routine tasks
              </button>
            </div>
          </div>
        )}
        {step >= 3 && (
          <div className="text-center">
            <h3 className="text-2xl font-extrabold mb-4 text-gray-800">
              Recommended: {recommendation.title}
            </h3>
            <p className="text-gray-600 mb-6">
              Based on your answers, we think the {recommendation.title.replace(" Plan", "").toLowerCase()} is the best fit
              for you.
            </p>
            <Link
              href={recommendation.slug}
              className="inline-block px-6 py-3 rounded-xl bg-[#86EFAC] text-[#0B1220] font-bold text-base sm:text-lg hover:opacity-90 transition"
            >
              Continue
            </Link>
          </div>
        )}
      </div>
    </section>
  );
}