"use client";

/**
 * Buying a membership for somebody else.
 *
 * THREE THINGS ARE DELIBERATE HERE AND WORTH READING BEFORE CHANGING ANYTHING.
 *
 * 1. NO PRICE IS WRITTEN IN THIS FILE. Every figure comes from
 *    GET /api/gifts/options, which reads the same catalogue the live
 *    memberships are billed from. If the API is unreachable there is no
 *    fallback price, because a wrong price shown confidently is worse than a
 *    screen that says it cannot load.
 *
 * 2. THE FEATURE FLAG IS THE SERVER'S. There is no public env var to consult.
 *    The options call 404s while GIFTS_ENABLED is off, and this screen renders
 *    the unavailable state — so deploying the code cannot launch the feature.
 *
 * 3. THERE IS NO COUPON FIELD. Stripe Checkout owns promotion codes and
 *    validates eligibility, expiry and redemption limits itself. A field here
 *    would either duplicate that badly or lie about what it had accepted.
 */

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";

import { useAuth } from "@/lib/useAuth";
import {
  GiftError,
  formatMoneyCents,
  createGiftCheckoutSession,
  getGiftOptions,
  monthsLabel,
  planLabel,
  type GiftOptions,
  type GiftPlan,
} from "@/lib/gift-service";

type Step = "plan" | "recipient" | "review";

const US_STATES = ["NY", "NJ", "CT", "PA"];

/*
 * min-h is not decoration. A <select> renders about two pixels shorter than an
 * <input> with identical padding, which left the State control at 43px — under
 * the 44px tap-target guideline, and visibly misaligned beside the City and ZIP
 * fields on the same row. Pinning a floor makes every control match and clear
 * the guideline regardless of how the browser measures it.
 */
const FIELD =
  "w-full min-h-[46px] rounded-[8px] border border-[#C5CBD8] bg-white px-4 py-2.5 text-sm text-[#313234] " +
  "outline-none transition focus:border-[#306EEC] focus:ring-2 focus:ring-[#306EEC]/20 " +
  "sm:px-5 sm:py-3 sm:text-base";

const LABEL = "mb-2 block text-sm font-medium text-[#313234]";

function Field({
  id,
  label,
  value,
  onChange,
  type = "text",
  placeholder,
  error,
  autoComplete,
  maxLength,
}: {
  id: string;
  label: string;
  value: string;
  onChange: (value: string) => void;
  type?: string;
  placeholder?: string;
  error?: string;
  autoComplete?: string;
  maxLength?: number;
}) {
  return (
    <div>
      <label htmlFor={id} className={LABEL}>
        {label}
      </label>
      <input
        id={id}
        name={id}
        type={type}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        autoComplete={autoComplete}
        maxLength={maxLength}
        aria-invalid={error ? true : undefined}
        aria-describedby={error ? `${id}-error` : undefined}
        className={`${FIELD} ${error ? "border-[#C0392B] focus:border-[#C0392B] focus:ring-[#C0392B]/20" : ""}`}
      />
      {error ? (
        <p id={`${id}-error`} role="alert" className="mt-1.5 text-sm text-[#C0392B]">
          {error}
        </p>
      ) : null}
    </div>
  );
}

/** The step rail. Compact on mobile, never a horizontal scroll. */
function Steps({ current }: { current: Step }) {
  const order: Step[] = ["plan", "recipient", "review"];
  const labels: Record<Step, string> = {
    plan: "Plan",
    recipient: "Recipient",
    review: "Review",
  };
  const index = order.indexOf(current);

  return (
    <ol className="mb-7 flex items-center gap-2 sm:gap-3" aria-label="Progress">
      {order.map((step, i) => {
        const done = i < index;
        const active = i === index;
        return (
          <li key={step} className="flex flex-1 items-center gap-2 sm:gap-3">
            <span
              aria-current={active ? "step" : undefined}
              className={[
                "flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-[13px] font-semibold",
                active
                  ? "bg-[#306EEC] text-white"
                  : done
                    ? "bg-[#DCE8FF] text-[#306EEC]"
                    : "bg-[#EEF2FF] text-[#9CA3AF]",
              ].join(" ")}
            >
              {i + 1}
            </span>
            <span
              className={[
                "text-[13px] font-medium sm:text-sm",
                active ? "text-[#313234]" : "text-[#9CA3AF]",
              ].join(" ")}
            >
              {labels[step]}
            </span>
            {i < order.length - 1 ? (
              <span className="ml-auto hidden h-px flex-1 bg-[#E0E6F5] sm:block" aria-hidden />
            ) : null}
          </li>
        );
      })}
    </ol>
  );
}

export default function GiftPurchaseClient() {
  const { user, isAuthenticated, isLoading: authLoading } = useAuth();

  const [options, setOptions] = useState<GiftOptions | null>(null);
  const [optionsState, setOptionsState] = useState<"loading" | "ready" | "off" | "error">("loading");

  const [step, setStep] = useState<Step>("plan");
  const [plan, setPlan] = useState<GiftPlan | null>(null);
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [email, setEmail] = useState("");
  const [line1, setLine1] = useState("");
  const [city, setCity] = useState("");
  const [state, setState] = useState("NY");
  const [zip, setZip] = useState("");

  const [errors, setErrors] = useState<Record<string, string>>({});
  const [submitError, setSubmitError] = useState<string | null>(null);

  /*
   * Double-submit protection, held in a ref as well as state.
   *
   * State alone is not enough: two clicks in the same tick both read the old
   * value and both fire, which would create two Stripe Checkout sessions and
   * risk two charges. The ref is written synchronously, so the second click
   * sees it immediately.
   */
  const [submitting, setSubmitting] = useState(false);
  const submitLock = useRef(false);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const result = await getGiftOptions();
        if (cancelled) return;
        if (!result) {
          setOptionsState("off");
          return;
        }
        setOptions(result);
        setOptionsState("ready");
      } catch {
        if (!cancelled) setOptionsState("error");
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  /* Launch offers one length. The API says which; this never assumes two. */
  const durationMonths = options?.durations?.[0] ?? null;

  const quoteFor = useCallback(
    (which: GiftPlan) => {
      const entry = options?.plans.find((p) => p.plan === which);
      if (!entry || durationMonths === null) return null;
      return entry.quotes.find((q) => q.durationMonths === durationMonths) || null;
    },
    [options, durationMonths]
  );

  const selectedQuote = useMemo(() => (plan ? quoteFor(plan) : null), [plan, quoteFor]);

  const validateRecipient = useCallback(() => {
    const next: Record<string, string> = {};
    if (!firstName.trim()) next.firstName = "Enter their first name.";
    if (!lastName.trim()) next.lastName = "Enter their last name.";

    const cleanEmail = email.trim().toLowerCase();
    if (!cleanEmail) next.email = "Enter their email address.";
    else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(cleanEmail)) next.email = "That does not look like an email address.";
    else if (user?.email && cleanEmail === String(user.email).toLowerCase()) {
      // Caught here as a courtesy; the server refuses it regardless.
      next.email = "A gift has to be for someone else. To start your own membership, choose a plan from your account.";
    }

    if (!line1.trim()) next.line1 = "Enter their street address.";
    if (!city.trim()) next.city = "Enter their city.";
    if (!/^\d{5}$/.test(zip.trim())) next.zip = "Enter a 5-digit ZIP code.";

    setErrors(next);
    return Object.keys(next).length === 0;
  }, [firstName, lastName, email, line1, city, zip, user]);

  const handlePay = useCallback(async () => {
    if (submitLock.current) return;
    if (!plan || durationMonths === null) return;

    submitLock.current = true;
    setSubmitting(true);
    setSubmitError(null);

    try {
      const { url } = await createGiftCheckoutSession({
        plan,
        durationMonths,
        recipient: { firstName: firstName.trim(), lastName: lastName.trim(), email: email.trim().toLowerCase() },
        address: { line1: line1.trim(), city: city.trim(), state, zip: zip.trim() },
      });
      // Leaving the page: the lock is never released, so a fast double click
      // during navigation cannot start a second session.
      window.location.href = url;
    } catch (error) {
      const giftError = error instanceof GiftError ? error : null;
      setSubmitError(giftError?.message || "We could not open checkout. Please try again.");
      if (giftError?.code === "SELF_GIFT_NOT_ALLOWED" || giftError?.code === "INVALID_RECIPIENT_EMAIL") {
        setErrors((prev) => ({ ...prev, email: giftError.message }));
        setStep("recipient");
      }
      submitLock.current = false;
      setSubmitting(false);
    }
  }, [plan, durationMonths, firstName, lastName, email, line1, city, state, zip]);

  /* ---------------------------------------------------------------------- */

  if (optionsState === "loading" || authLoading) {
    return (
      <div className="mx-auto max-w-2xl px-4 py-16 text-center sm:px-6">
        <div
          className="mx-auto h-8 w-8 animate-spin rounded-full border-2 border-[#E0E6F5] border-t-[#306EEC]"
          role="status"
          aria-label="Loading"
        />
      </div>
    );
  }

  /*
   * The feature is off on the server. Shown as a plain, calm message rather
   * than an error: nothing is broken, it simply is not available.
   */
  if (optionsState === "off") {
    return (
      <div className="mx-auto max-w-2xl px-4 py-16 text-center sm:px-6">
        <h1 className="text-2xl font-semibold text-[#313234] sm:text-3xl">Gift memberships</h1>
        <p className="mx-auto mt-3 max-w-md text-[15px] text-[#6A6D71]">
          Gift memberships are not available just yet. In the meantime, a ProFixter membership can
          be started at any time.
        </p>
        <Link
          href="/membership"
          className="mt-6 inline-flex min-h-[44px] items-center justify-center rounded-[8px] bg-[#306EEC] px-6 text-[15px] font-semibold text-white transition hover:bg-[#2558C4]"
        >
          See membership plans
        </Link>
      </div>
    );
  }

  if (optionsState === "error") {
    return (
      <div className="mx-auto max-w-2xl px-4 py-16 text-center sm:px-6">
        <h1 className="text-2xl font-semibold text-[#313234]">We could not load gift options</h1>
        <p className="mx-auto mt-3 max-w-md text-[15px] text-[#6A6D71]">
          Something went wrong on our side. Please try again in a moment.
        </p>
        <button
          type="button"
          onClick={() => window.location.reload()}
          className="mt-6 inline-flex min-h-[44px] items-center justify-center rounded-[8px] border border-[#C5CBD8] px-6 text-[15px] font-semibold text-[#313234] transition hover:bg-[#F8FAFF]"
        >
          Try again
        </button>
      </div>
    );
  }

  /*
   * Signed out. The intro is worth showing — somebody may have arrived from a
   * search — but buying needs an account, and the destination is preserved so
   * they land back here rather than on a generic page.
   */
  if (!isAuthenticated) {
    return (
      <div className="mx-auto max-w-2xl px-4 py-14 sm:px-6">
        <h1 className="text-[26px] font-semibold leading-tight text-[#313234] sm:text-[34px]">
          Give someone a ProFixter membership
        </h1>
        <p className="mt-3 text-[15px] leading-relaxed text-[#6A6D71] sm:text-base">
          A professional handyman at their home, for {durationMonths ? monthsLabel(durationMonths) : "a fixed term"}.
          You pay once. They book the visits. Nothing renews.
        </p>

        <div className="mt-7 rounded-[10px] border border-[#E0E6F5] bg-[#F8FAFF] p-5">
          <p className="text-sm text-[#6A6D71]">Sign in to continue. We will bring you straight back here.</p>
          <div className="mt-4 flex flex-col gap-3 sm:flex-row">
            <Link
              href="/signin?next=%2Fgift"
              className="inline-flex min-h-[44px] flex-1 items-center justify-center rounded-[8px] bg-[#306EEC] px-6 text-[15px] font-semibold text-white transition hover:bg-[#2558C4]"
            >
              Sign in
            </Link>
            <Link
              href="/signup?next=%2Fgift"
              className="inline-flex min-h-[44px] flex-1 items-center justify-center rounded-[8px] border border-[#C5CBD8] bg-white px-6 text-[15px] font-semibold text-[#313234] transition hover:bg-[#F8FAFF]"
            >
              Create an account
            </Link>
          </div>
        </div>
      </div>
    );
  }

  const plans = options?.plans ?? [];

  return (
    <div className="mx-auto max-w-3xl px-4 py-10 sm:px-6 sm:py-14">
      <header className="mb-7">
        <h1 className="text-[26px] font-semibold leading-tight text-[#313234] sm:text-[32px]">
          Gift a Membership
        </h1>
        <p className="mt-2 max-w-xl text-[15px] leading-relaxed text-[#6A6D71]">
          Choose a plan, tell us who it is for, and we will send them an invitation.
          {durationMonths ? ` Every gift is ${monthsLabel(durationMonths)}.` : ""}
        </p>
      </header>

      <Steps current={step} />

      {/* ------------------------------- Plan ------------------------------ */}
      {step === "plan" ? (
        <section aria-labelledby="plan-heading">
          <h2 id="plan-heading" className="sr-only">
            Choose a plan
          </h2>

          <div className="grid gap-3 sm:grid-cols-2">
            {plans.map((option) => {
              const quote = quoteFor(option.plan);
              if (!quote) return null;
              const selected = plan === option.plan;
              return (
                <button
                  key={option.plan}
                  type="button"
                  onClick={() => setPlan(option.plan)}
                  aria-pressed={selected}
                  className={[
                    "rounded-[10px] border p-4 text-left transition sm:p-5",
                    selected
                      ? "border-[#306EEC] bg-[#F5F9FF] ring-2 ring-[#306EEC]/20"
                      : "border-[#E0E6F5] bg-white hover:border-[#C5CBD8]",
                  ].join(" ")}
                >
                  <div className="flex items-baseline justify-between gap-3">
                    <span className="text-[17px] font-semibold text-[#313234]">{option.label}</span>
                    <span className="shrink-0 text-[13px] text-[#6A6D71]">
                      {formatMoneyCents(quote.perMonthCents)}/mo
                    </span>
                  </div>
                  <div className="mt-3 flex items-baseline gap-2">
                    <span className="text-[24px] font-semibold text-[#313234]">
                      {formatMoneyCents(quote.totalCents)}
                    </span>
                    <span className="text-[13px] text-[#6A6D71]">
                      total for {monthsLabel(quote.durationMonths)}
                    </span>
                  </div>
                  <p className="mt-1 text-[13px] text-[#9CA3AF]">
                    {formatMoneyCents(quote.perMonthCents)} &times; {quote.durationMonths}
                  </p>
                </button>
              );
            })}
          </div>

          <p className="mt-5 rounded-[8px] border border-[#E0E6F5] bg-[#F8FAFF] px-4 py-3 text-[13px] leading-relaxed text-[#6A6D71]">
            <strong className="font-semibold text-[#313234]">One-time payment.</strong> This gift
            does not automatically renew, and you will not be charged again.
          </p>

          <div className="mt-6 flex justify-end">
            <button
              type="button"
              disabled={!plan}
              onClick={() => setStep("recipient")}
              className="inline-flex min-h-[46px] w-full items-center justify-center rounded-[8px] bg-[#306EEC] px-7 text-[15px] font-semibold text-white transition hover:bg-[#2558C4] disabled:cursor-not-allowed disabled:bg-[#C5CBD8] sm:w-auto"
            >
              Continue
            </button>
          </div>
        </section>
      ) : null}

      {/* ----------------------------- Recipient --------------------------- */}
      {step === "recipient" ? (
        <section aria-labelledby="recipient-heading">
          <h2 id="recipient-heading" className="mb-4 text-[19px] font-semibold text-[#313234]">
            Who is it for?
          </h2>

          <form
            noValidate
            onSubmit={(e) => {
              e.preventDefault();
              if (validateRecipient()) setStep("review");
            }}
            className="space-y-4"
          >
            <div className="grid gap-4 sm:grid-cols-2">
              <Field
                id="firstName"
                label="First name"
                value={firstName}
                onChange={setFirstName}
                error={errors.firstName}
                autoComplete="given-name"
                maxLength={80}
              />
              <Field
                id="lastName"
                label="Last name"
                value={lastName}
                onChange={setLastName}
                error={errors.lastName}
                autoComplete="family-name"
                maxLength={80}
              />
            </div>

            <Field
              id="email"
              label="Email address"
              type="email"
              value={email}
              onChange={setEmail}
              error={errors.email}
              placeholder="them@example.com"
              autoComplete="email"
              maxLength={200}
            />

            <div className="pt-1">
              <h3 className="text-[15px] font-semibold text-[#313234]">Their property</h3>
              <p className="mt-1 text-[13px] leading-relaxed text-[#6A6D71]">
                A membership covers one home. They will confirm this address when they claim the
                gift, so an approximate answer is fine.
              </p>
            </div>

            <Field
              id="line1"
              label="Street address"
              value={line1}
              onChange={setLine1}
              error={errors.line1}
              autoComplete="address-line1"
              maxLength={200}
            />

            <div className="grid gap-4 sm:grid-cols-[1fr_120px_140px]">
              <Field
                id="city"
                label="City"
                value={city}
                onChange={setCity}
                error={errors.city}
                autoComplete="address-level2"
                maxLength={100}
              />
              <div>
                <label htmlFor="state" className={LABEL}>
                  State
                </label>
                <select
                  id="state"
                  value={state}
                  onChange={(e) => setState(e.target.value)}
                  className={FIELD}
                >
                  {US_STATES.map((s) => (
                    <option key={s} value={s}>
                      {s}
                    </option>
                  ))}
                </select>
              </div>
              <Field
                id="zip"
                label="ZIP"
                value={zip}
                onChange={(v) => setZip(v.replace(/\D/g, "").slice(0, 5))}
                error={errors.zip}
                autoComplete="postal-code"
                maxLength={5}
              />
            </div>

            <div className="flex flex-col gap-3 pt-3 sm:flex-row sm:justify-between">
              <button
                type="button"
                onClick={() => setStep("plan")}
                className="inline-flex min-h-[46px] items-center justify-center rounded-[8px] border border-[#C5CBD8] bg-white px-6 text-[15px] font-semibold text-[#313234] transition hover:bg-[#F8FAFF]"
              >
                Back
              </button>
              <button
                type="submit"
                className="inline-flex min-h-[46px] items-center justify-center rounded-[8px] bg-[#306EEC] px-7 text-[15px] font-semibold text-white transition hover:bg-[#2558C4]"
              >
                Review gift
              </button>
            </div>
          </form>
        </section>
      ) : null}

      {/* ------------------------------ Review ----------------------------- */}
      {step === "review" && plan && selectedQuote ? (
        <section aria-labelledby="review-heading">
          <h2 id="review-heading" className="mb-4 text-[19px] font-semibold text-[#313234]">
            Review your gift
          </h2>

          <dl className="divide-y divide-[#EEF2FF] rounded-[10px] border border-[#E0E6F5] bg-white">
            <div className="flex items-start justify-between gap-4 px-4 py-3.5 sm:px-5">
              <dt className="text-[13px] text-[#6A6D71]">Recipient</dt>
              <dd className="min-w-0 text-right text-[15px] font-medium text-[#313234]">
                <span className="block break-words">
                  {firstName} {lastName}
                </span>
                <span className="block break-all text-[13px] font-normal text-[#6A6D71]">{email}</span>
              </dd>
            </div>
            <div className="flex items-start justify-between gap-4 px-4 py-3.5 sm:px-5">
              <dt className="text-[13px] text-[#6A6D71]">Property</dt>
              <dd className="min-w-0 break-words text-right text-[15px] font-medium text-[#313234]">
                {line1}, {city}, {state} {zip}
              </dd>
            </div>
            <div className="flex items-start justify-between gap-4 px-4 py-3.5 sm:px-5">
              <dt className="text-[13px] text-[#6A6D71]">Plan</dt>
              <dd className="text-right text-[15px] font-medium text-[#313234]">{planLabel(plan)}</dd>
            </div>
            <div className="flex items-start justify-between gap-4 px-4 py-3.5 sm:px-5">
              <dt className="text-[13px] text-[#6A6D71]">Length</dt>
              <dd className="text-right text-[15px] font-medium text-[#313234]">
                {monthsLabel(selectedQuote.durationMonths)}
              </dd>
            </div>
            <div className="flex items-start justify-between gap-4 bg-[#F8FAFF] px-4 py-4 sm:px-5">
              <dt className="text-[15px] font-semibold text-[#313234]">Total</dt>
              <dd className="text-right">
                <span className="block text-[20px] font-semibold text-[#313234]">
                  {formatMoneyCents(selectedQuote.totalCents)}
                </span>
                <span className="block text-[12px] text-[#6A6D71]">before any discount</span>
              </dd>
            </div>
          </dl>

          <p className="mt-4 text-[13px] leading-relaxed text-[#6A6D71]">
            Have a promotion code? You can enter it on the next screen, at checkout.
          </p>

          {submitError ? (
            <p
              role="alert"
              className="mt-4 rounded-[8px] border border-[#F3C9C4] bg-[#FDF3F2] px-4 py-3 text-sm text-[#A03227]"
            >
              {submitError}
            </p>
          ) : null}

          <div className="mt-6 flex flex-col gap-3 sm:flex-row sm:justify-between">
            <button
              type="button"
              disabled={submitting}
              onClick={() => setStep("recipient")}
              className="inline-flex min-h-[46px] items-center justify-center rounded-[8px] border border-[#C5CBD8] bg-white px-6 text-[15px] font-semibold text-[#313234] transition hover:bg-[#F8FAFF] disabled:opacity-50"
            >
              Back
            </button>
            <button
              type="button"
              onClick={handlePay}
              disabled={submitting}
              aria-busy={submitting}
              className="inline-flex min-h-[46px] items-center justify-center gap-2 rounded-[8px] bg-[#306EEC] px-7 text-[15px] font-semibold text-white transition hover:bg-[#2558C4] disabled:cursor-not-allowed disabled:bg-[#8FB3F5]"
            >
              {submitting ? (
                <>
                  <span
                    className="h-4 w-4 animate-spin rounded-full border-2 border-white/40 border-t-white"
                    aria-hidden
                  />
                  Opening checkout&hellip;
                </>
              ) : (
                "Continue to payment"
              )}
            </button>
          </div>
        </section>
      ) : null}
    </div>
  );
}
