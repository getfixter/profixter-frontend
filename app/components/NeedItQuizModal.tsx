"use client";

import { useEffect, useMemo, useState } from "react";

type Props = {
  open: boolean;
  onClose: () => void;
  onGoToPlans: () => void;
  ctaLabel?: string; // "Start 7-day Free Trial"
};

type OptionId = "good" | "wrong";

type Option = {
  id: OptionId;
  label: string;
  feedback: string; // shown after click
};

type Question = {
  id: string;
  title: string;
  sub?: string;
  options: [Option, Option]; // EXACTLY 2 options
};

const QUESTIONS: readonly Question[] = [
  {
    id: "q1",
    title: "Be honest — do you have at least 3 small things in your home that annoy you?",
    sub: "Loose handle, dripping faucet, squeaky door, hole in wall, shelves, caulk, drafts, etc.",
    options: [
      {
        id: "good",
        label: "Yes — at least 3 things",
        feedback:
          "That’s exactly who this is for. Those “small” issues stack up fast — and they usually get worse when ignored.",
      },
      {
        id: "wrong",
        label: "No — everything is perfect",
        feedback:
          "That’s not realistic for most homeowners. Even “perfect” homes have small issues over time — that’s why prevention and quick fixes matter.",
      },
    ],
  },
  {
    id: "q2",
    title: "Which is closer to your real life?",
    sub: "Most people either pay a lot per visit or keep putting it off.",
    options: [
      {
        id: "good",
        label: "I keep postponing because it’s annoying to deal with",
        feedback:
          "Exactly. You’re not lazy — it’s just friction. A simple system is what turns “later” into “done.”",
      },
      {
        id: "wrong",
        label: "I love hunting for handymen and scheduling",
        feedback:
          "That’s not the best answer. If you truly enjoy spending time searching, negotiating, and waiting — you may not need a membership.",
      },
    ],
  },
  {
    id: "q3",
    title: "When something breaks, what do you want most?",
    sub: "Pick the option that sounds like the smart move for your household.",
    options: [
      {
        id: "good",
        label: "A reliable person I can book quickly (no stress)",
        feedback:
          "Correct. Reliability and speed beat “cheapest” — because the cheapest usually becomes the most expensive over time.",
      },
      {
        id: "wrong",
        label: "I’d rather gamble on whoever is available",
        feedback:
          "Not the best choice. Random contractors = inconsistent quality, wasted time, and often repeat fixes.",
      },
    ],
  },
  {
    id: "q4",
    title: "Does this sound useful?",
    sub: "One visit is up to 90 minutes — perfect for knocking out a bunch of small tasks.",
    options: [
      {
        id: "good",
        label: "Yes — that’s exactly what I need",
        feedback:
          "Perfect. Most homeowners get the biggest relief from consistent “small fixes” that remove daily stress.",
      },
      {
        id: "wrong",
        label: "No — I only do massive renovations",
        feedback:
          "Not the best fit for the membership visits. Large projects can be quoted separately, but the membership is built for quick wins.",
      },
    ],
  },
  {
    id: "q5",
    title: "If you could wave a magic wand and fix 5 small problems this week… would you?",
    sub: "This is about reducing stress and protecting the home from bigger costs.",
    options: [
      {
        id: "good",
        label: "Yes — I want it handled",
        feedback:
          "Great. That mindset is how you stay ahead. Small fixes prevent big repairs — and you feel the difference immediately.",
      },
      {
        id: "wrong",
        label: "No — I prefer living with problems",
        feedback:
          "That’s not the best answer. Living with issues costs more long-term and adds daily irritation you don’t need.",
      },
    ],
  },
  {
    id: "q6",
    title: "Last one: want to see plans and start the 7-day free trial?",
    sub: "No pressure — you can cancel anytime.",
    options: [
      {
        id: "good",
        label: "Yes — show me plans",
        feedback:
          "Perfect. You’re going to pick the plan that matches your home and start the trial.",
      },
      {
        id: "wrong",
        label: "No — I want to talk first",
        feedback:
          "That’s fair. A quick call is best if you want to confirm what’s included and availability — call us now.",
      },
    ],
  },
] as const;

export default function NeedItQuizModal({
  open,
  onClose,
  onGoToPlans,
  ctaLabel = "Start 7-day Free Trial",
}: Props) {
  const [step, setStep] = useState(0);

  // feedback state
  const [feedback, setFeedback] = useState("");
  const [pickedWrong, setPickedWrong] = useState(false);

  // lock body scroll
  useEffect(() => {
    if (!open) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = prev;
    };
  }, [open]);

  // ESC close
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  // reset when reopened
  useEffect(() => {
    if (!open) return;
    setStep(0);
    setFeedback("");
    setPickedWrong(false);
  }, [open]);

  const q = QUESTIONS[step];

  const progress = useMemo(() => {
    const pct = Math.round(((step + 1) / QUESTIONS.length) * 100);
    return Math.min(100, Math.max(0, pct));
  }, [step]);

  const goBack = () => {
    setStep((s) => Math.max(0, s - 1));
    setFeedback("");
    setPickedWrong(false);
  };

  const pick = (opt: Option) => {
    setFeedback(opt.feedback);

    // WRONG: do not advance
    if (opt.id === "wrong") {
      setPickedWrong(true);

      // if last question wrong => call
      if (q.id === "q6") {
        window.setTimeout(() => {
          window.location.href = "tel:631-599-1363";
        }, 350);
      }
      return;
    }

    // GOOD: advance
    setPickedWrong(false);

    // last step GOOD => go to plans
    if (q.id === "q6") {
      window.setTimeout(() => {
        onClose();
        setTimeout(() => onGoToPlans(), 60);
      }, 250);
      return;
    }

    window.setTimeout(() => {
      setStep((s) => Math.min(QUESTIONS.length - 1, s + 1));
      setFeedback("");
      setPickedWrong(false);
    }, 250);
  };

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-[200] flex items-center justify-center">
      {/* Backdrop */}
      <div className="absolute inset-0 bg-black/55" onClick={onClose} />

      {/* Modal */}
      <div className="relative w-[92vw] max-w-[760px] max-h-[85vh] overflow-auto rounded-[20px] border border-[#c5cbd8] bg-[#EEF2FF] shadow-[0_0_200px_rgba(0,0,0,0.20)]">
        {/* Header */}
        <div className="px-5 sm:px-7 pt-5 sm:pt-7 pb-4 border-b border-[#c5cbd8]">
          <div className="flex items-start justify-between gap-4">
            <div>
              <div className="text-[12px] font-bold text-[#306EEC] uppercase tracking-wider">
                Quick Check
              </div>
              <div className="text-[22px] sm:text-[28px] font-bold text-[#313234] leading-tight mt-1">
                Quick questions — see if Mr. Fixter fits your home
              </div>
              <div className="text-[13px] sm:text-[14px] text-[#6A6D71] mt-2">
                7-day free trial • cancel anytime • visits up to 90 minutes
              </div>
            </div>

            <button
              onClick={onClose}
              className="w-10 h-10 rounded-[12px] border border-[#c5cbd8] bg-white/60 grid place-items-center text-[#313234] hover:bg-white"
              aria-label="Close"
            >
              ✕
            </button>
          </div>

          {/* Progress */}
          <div className="mt-4">
            <div className="h-[10px] rounded-full bg-white/60 border border-[#c5cbd8] overflow-hidden">
              <div className="h-full bg-[#306EEC]" style={{ width: `${progress}%` }} />
            </div>
            <div className="mt-2 text-[12px] text-[#6A6D71]">
              Step {step + 1} of {QUESTIONS.length}
            </div>
          </div>
        </div>

        {/* Body */}
        <div className="px-5 sm:px-7 py-6">
          <div className="text-[18px] sm:text-[22px] font-semibold text-[#313234] leading-snug">
            {q.title}
          </div>

          {q.sub ? (
            <div className="mt-2 text-[13px] sm:text-[14px] text-[#6A6D71]">
              {q.sub}
            </div>
          ) : null}

          {/* feedback */}
          {feedback ? (
            <div
              className={[
                "mt-4 rounded-[14px] border p-4",
                pickedWrong
                  ? "border-[#f1b5b5] bg-white/60"
                  : "border-[#c5cbd8] bg-white/60",
              ].join(" ")}
            >
              <div className="text-[14px] sm:text-[15px] text-[#313234]">
                {feedback}
              </div>
              {pickedWrong ? (
                <div className="mt-2 text-[12px] text-[#6A6D71]">
                  Choose the better option to continue.
                </div>
              ) : null}
            </div>
          ) : null}

          {/* options (2 only) */}
          <div className="mt-5 grid grid-cols-1 sm:grid-cols-2 gap-3">
            {q.options.map((opt) => (
              <button
                key={opt.id}
                onClick={() => pick(opt)}
                className="h-[56px] rounded-[14px] border border-[#313234] bg-white/50 text-[#313234] text-[15px] sm:text-[16px] font-semibold hover:bg-white transition-colors"
              >
                {opt.label}
              </button>
            ))}
          </div>

          {/* Navigation */}
          <div className="mt-6 flex items-center justify-between gap-3">
            <button
              onClick={goBack}
              disabled={step === 0}
              className="h-[46px] px-5 rounded-[14px] border border-[#c5cbd8] bg-white/60 text-[#313234] text-[14px] font-semibold hover:bg-white disabled:opacity-40 disabled:cursor-not-allowed"
            >
              Back
            </button>

            <div className="text-[12px] text-[#6A6D71] text-right">
              Prefer to talk?{" "}
              <a className="text-[#306EEC] font-semibold" href="tel:631-599-1363">
                631-599-1363
              </a>
            </div>
          </div>

          {/* Final CTA hint */}
          {q.id === "q6" ? (
            <div className="mt-6 rounded-[14px] border border-[#c5cbd8] bg-white/60 p-4">
              <div className="text-[14px] font-semibold text-[#313234]">
                If you choose “Yes — show me plans”
              </div>
              <div className="text-[13px] text-[#6A6D71] mt-1">
                we’ll take you to plans to {ctaLabel.toLowerCase()}.
              </div>
            </div>
          ) : null}
        </div>

        {/* Footer strip */}
        <div className="px-5 sm:px-7 py-4 border-t border-[#c5cbd8] bg-white/30">
          <div className="text-[12px] text-[#6A6D71]">
            Simple • predictable • no stress
          </div>
        </div>
      </div>
    </div>
  );
}
