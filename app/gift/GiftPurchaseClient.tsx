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
 * 3. THERE IS NO COUPON FIELD, AND NO TAX FIGURE. Stripe Checkout owns
 *    promotion codes and validates eligibility, expiry and redemption limits
 *    itself, and it computes sales tax from the billing address it collects.
 *    A field here would either duplicate that badly or lie about what it had
 *    accepted, so the summary names both and says where they are settled.
 *
 * ONE SCREEN, FOUR QUESTIONS. This used to be a four-step wizard (plan,
 * length, recipient, review). A purchaser only needs to answer who it is for,
 * which gift, and see what it costs and how they pay, so all of it is one
 * form: the required fields first, everything optional behind one closed
 * disclosure, and the summary beside the pay button. The payload sent to
 * /api/gifts/checkout-session is unchanged.
 */

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import DigitalGiftCard from "@/app/components/gift/DigitalGiftCard";
import GiftPromoCode from "@/app/components/gift/GiftPromoCode";
import {
  MESSAGE_MAX_LENGTH,
  OCCASIONS,
  OCCASION_ORDER,
  type GiftOccasion,
} from "@/app/components/gift/giftPresentation";

import { useAuth } from "@/lib/useAuth";
import { useContactCompletion } from "@/app/components/auth/ContactCompletion";
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
import "./gift.css";

const US_STATES = ["NY", "NJ", "CT", "PA"];

/** The order errors are reported in, which is the order the form reads. */
const FIELD_ORDER = ["firstName", "lastName", "email", "phone", "plan", "line1", "city", "zip"];

function Field({
  id,
  label,
  value,
  onChange,
  type = "text",
  placeholder,
  error,
  hint,
  autoComplete,
  maxLength,
  inputMode,
}: {
  id: string;
  label: string;
  value: string;
  onChange: (value: string) => void;
  type?: string;
  placeholder?: string;
  error?: string;
  hint?: string;
  autoComplete?: string;
  maxLength?: number;
  inputMode?: React.HTMLAttributes<HTMLInputElement>["inputMode"];
}) {
  const describedBy = [error ? `${id}-error` : "", hint ? `${id}-hint` : ""].filter(Boolean).join(" ");
  return (
    <div>
      <label htmlFor={id} className="gf-label">
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
        inputMode={inputMode}
        aria-invalid={error ? true : undefined}
        aria-describedby={describedBy || undefined}
        className="gf-input"
      />
      {error ? (
        <p id={`${id}-error`} role="alert" className="gf-error">
          {error}
        </p>
      ) : hint ? (
        <p id={`${id}-hint`} className="gf-hint">
          {hint}
        </p>
      ) : null}
    </div>
  );
}

export default function GiftPurchaseClient() {
  const { user, isAuthenticated, isLoading: authLoading } = useAuth();
  const { ensureContact, contactSheet } = useContactCompletion();

  const [options, setOptions] = useState<GiftOptions | null>(null);
  const [optionsState, setOptionsState] = useState<"loading" | "ready" | "off" | "error">("loading");

  const [plan, setPlan] = useState<GiftPlan | null>(null);
  const [chosenDuration, setChosenDuration] = useState<number | null>(null);
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [email, setEmail] = useState("");
  /*
   * The second contact, behind "Add a mobile number".
   *
   * Email is the one required way to reach the recipient (see validateRecipient
   * for why). The phone is a second channel, so it starts hidden and appears
   * only for somebody who wants the link texted as well.
   */
  const [phoneOpen, setPhoneOpen] = useState(false);
  const [phone, setPhone] = useState("");
  const [line1, setLine1] = useState("");
  const [city, setCity] = useState("");
  const [state, setState] = useState("NY");
  const [zip, setZip] = useState("");

  /*
   * Everything optional lives in one closed disclosure: the occasion, the
   * personal message and the recipient's address. None of it reaches pricing,
   * duration or entitlement — the server ignores the first two for everything
   * but the words on the card (and sanitises both), and the address is only a
   * hint for the recipient at claim time.
   */
  const [moreOpen, setMoreOpen] = useState(false);

  /* The signed-in purchaser is who the gift is from. Shown on the preview
   * so it matches the card the recipient will actually open. */
  const purchaserName = String(user?.name || "").trim();

  const [occasion, setOccasion] = useState<GiftOccasion>("neutral");
  const [personalMessage, setPersonalMessage] = useState("");

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

  /*
   * Plans are fetched for everybody, signed in or not.
   *
   * This was once gated on being signed in, for a good reason: the route
   * required authentication, and the shared axios client treats ANY 401 as a
   * dead session — it clears the token and sends the browser to /signin. So
   * asking for options while signed out bounced anonymous visitors straight
   * off this page. (It went unnoticed until launch because the route
   * answered 404 while the feature was off, and 404 does not trip that
   * interceptor.)
   *
   * /gifts/options is public now. It returns plan names, lengths and prices
   * — the same figures printed on the membership pages — so there is nothing
   * to protect, and somebody deciding whether to buy a present should not
   * have to create an account to find out what it costs.
   */
  useEffect(() => {
    if (authLoading) return undefined;
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
  }, [authLoading]);

  /*
   * The chosen length, defaulting to the one the server nominates.
   *
   * Derived rather than copied into state by an effect: the default arrives
   * with the options, and mirroring it would mean a render where the two
   * disagree. `chosenDuration` is only set once somebody picks.
   */
  const durationMonths =
    chosenDuration ?? options?.defaultDurationMonths ?? options?.durations?.[0] ?? null;

  /** Any plan at any offered length, straight from the server's quotes. */
  const quoteForDuration = useCallback(
    (which: GiftPlan | null, months: number | null) => {
      if (!which || months === null) return null;
      const entry = options?.plans.find((p) => p.plan === which);
      return entry?.quotes.find((q) => q.durationMonths === months) || null;
    },
    [options]
  );

  const selectedQuote = useMemo(
    () => quoteForDuration(plan, durationMonths),
    [quoteForDuration, plan, durationMonths]
  );

  const validateRecipient = useCallback(() => {
    const next: Record<string, string> = {};
    if (!firstName.trim()) next.firstName = "Enter their first name.";
    if (!lastName.trim()) next.lastName = "Enter their last name.";

    /*
     * EMAIL IS REQUIRED, and the server enforces the same rule
     * (validateGiftPurchase: invalid_recipient_email). It is what claim
     * identity binds on — the recipient proves the gift is theirs by signing
     * in with the address the invitation went to. Nothing verifies a phone
     * number typed by the purchaser, so a phone-only gift would be claimable
     * by anybody holding the link.
     */
    const cleanEmail = email.trim().toLowerCase();
    if (!cleanEmail) next.email = "Enter their email address.";
    else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(cleanEmail)) next.email = "That does not look like an email address.";
    else if (user?.email && cleanEmail === String(user.email).toLowerCase()) {
      // Caught here as a courtesy; the server refuses it regardless.
      next.email = "A gift has to be for someone else. To start your own membership, choose a plan from your account.";
    }

    /*
     * A phone number is optional, but a HALF-TYPED one is not acceptable:
     * somebody who started entering a number expects it to be used, and
     * silently dropping it would have them believe a text went out.
     */
    const digits = phone.replace(/\D/g, "");
    if (digits && !/^1?\d{10}$/.test(digits)) {
      next.phone = "Enter a 10-digit US phone number, or leave it blank.";
    }

    if (!plan) next.plan = "Choose a plan.";

    /*
     * THE ADDRESS IS OPTIONAL, and this is the point of the section.
     *
     * A purchaser buying for a colleague, a client or a sister-in-law very
     * often does not know their street address, and being stopped at that
     * question is where the sale was being lost. The recipient chooses the
     * property themselves at claim time on their own account, and THAT is
     * the address entitlement uses — what is typed here is only a hint to
     * help them recognise which home the gift was meant for.
     *
     * So: nothing is required. But a partly-filled address is still refused,
     * because half an address is worse than none on the claim screen.
     */
    const anyAddress = Boolean(line1.trim() || city.trim() || zip.trim());
    if (anyAddress) {
      if (!line1.trim()) next.line1 = "Add the street, or clear the address.";
      if (!city.trim()) next.city = "Add the city, or clear the address.";
      if (!/^\d{5}$/.test(zip.trim())) next.zip = "Enter a 5-digit ZIP, or clear the address.";
    }

    setErrors(next);
    return next;
  }, [firstName, lastName, email, phone, plan, line1, city, zip, user]);

  /*
   * Take the purchaser to the first problem. An error message they cannot
   * see is no help on a phone, where the pay button sits far below the
   * fields. Hidden sections holding the error are opened first.
   */
  const revealError = useCallback((found: Record<string, string>) => {
    const first = FIELD_ORDER.find((key) => found[key]);
    if (!first) return;
    if (first === "phone") setPhoneOpen(true);
    if (["line1", "city", "zip"].includes(first)) setMoreOpen(true);
    window.requestAnimationFrame(() => {
      const target =
        first === "plan"
          ? document.querySelector<HTMLInputElement>('input[name="gift-plan"]')
          : document.getElementById(first);
      if (!target) return;
      target.scrollIntoView({ behavior: "smooth", block: "center" });
      target.focus({ preventScroll: true });
    });
  }, []);

  const handlePay = useCallback(async () => {
    if (submitLock.current) return;
    const found = validateRecipient();
    if (Object.keys(found).length) {
      revealError(found);
      return;
    }
    if (!plan || durationMonths === null) return;
    // The receipt goes to the purchaser's email; ask for it here if missing.
    if (!(await ensureContact({ fields: ["email"] }))) return;

    submitLock.current = true;
    setSubmitting(true);
    setSubmitError(null);

    try {
      const { url } = await createGiftCheckoutSession({
        plan,
        durationMonths,
        recipient: {
          firstName: firstName.trim(),
          lastName: lastName.trim(),
          email: email.trim().toLowerCase(),
          phone: phone.trim(),
        },
        address: { line1: line1.trim(), city: city.trim(), state, zip: zip.trim() },
        occasion,
        personalMessage: personalMessage.trim(),
      });
      // Leaving the page: the lock is never released, so a fast double click
      // during navigation cannot start a second session.
      window.location.href = url;
    } catch (error) {
      const giftError = error instanceof GiftError ? error : null;
      setSubmitError(giftError?.message || "We could not open checkout. Please try again.");
      // The server's refusal is shown on the field that caused it.
      if (giftError?.code === "SELF_GIFT_NOT_ALLOWED" || giftError?.code === "INVALID_RECIPIENT_EMAIL") {
        const fieldError = { email: giftError.message };
        setErrors((prev) => ({ ...prev, ...fieldError }));
        revealError(fieldError);
      }
      submitLock.current = false;
      setSubmitting(false);
    }
  }, [
    validateRecipient,
    revealError,
    ensureContact,
    plan,
    durationMonths,
    firstName,
    lastName,
    email,
    phone,
    line1,
    city,
    state,
    zip,
    occasion,
    personalMessage,
  ]);

  /* ---------------------------------------------------------------------- */

  /* Everyone waits for the same fetch now, signed in or not. */
  if (authLoading || optionsState === "loading") {
    return (
      <div className="py-16 text-center">
        <div className="gf-spinner" role="status" aria-label="Loading" />
      </div>
    );
  }

  /*
   * The feature is off on the server. Shown as a plain, calm message rather
   * than an error: nothing is broken, it simply is not available.
   */
  if (optionsState === "off") {
    return (
      <div className="ui-card ui-card--soft max-w-[560px]">
        <h2 className="ui-h3">Gift memberships are not available just yet</h2>
        <p className="ui-body mt-2 text-[color:var(--ui-text-2)]">
          In the meantime, a ProFixter membership can be started at any time.
        </p>
        <Link href="/membership/plans" className="ui-btn ui-btn--primary mt-5">
          See membership plans
        </Link>
      </div>
    );
  }

  if (optionsState === "error") {
    return (
      <div className="ui-card ui-card--soft max-w-[560px]">
        <h2 className="ui-h3">We could not load gift options</h2>
        <p className="ui-body mt-2 text-[color:var(--ui-text-2)]">
          Something went wrong on our side. Please try again in a moment.
        </p>
        <button
          type="button"
          onClick={() => window.location.reload()}
          className="ui-btn ui-btn--secondary mt-5"
        >
          Try again
        </button>
      </div>
    );
  }

  /*
   * Signed out. Prices are shown rather than withheld: someone weighing up a
   * present wants to know what it costs, and making them create an account
   * to find out loses them. Buying still needs an account — a gift has a
   * purchaser and a recipient address behind it — and the destination is
   * preserved so they land back here rather than on a generic page.
   */
  if (!isAuthenticated) {
    const preview = options?.plans ?? [];

    return (
      <div className="max-w-[560px]">
        {preview.length > 0 ? (
          <div className="ui-card p-0">
            <div className="flex items-baseline justify-between gap-4 border-b border-[color:var(--ui-line)] px-5 py-3">
              <p className="ui-eyebrow">Plans</p>
              <p className="ui-small">Per month of the gift</p>
            </div>
            <ul>
              {preview.map((entry) => (
                <li
                  key={entry.plan}
                  className="flex items-baseline justify-between gap-4 border-b border-[color:var(--ui-line)] px-5 py-3 last:border-b-0"
                >
                  <span className="ui-body font-semibold text-[color:var(--ui-ink)]">{entry.label}</span>
                  <span className="ui-body ui-num text-[color:var(--ui-ink)]">
                    {formatMoneyCents(entry.quotes[0]?.perMonthCents ?? 0)}
                    <span className="text-[color:var(--ui-text-3)]">/mo</span>
                  </span>
                </li>
              ))}
            </ul>
          </div>
        ) : null}

        <p className="ui-small mt-3">
          Choose the length when you buy. Tax is added at checkout.
        </p>

        <div className="ui-card ui-card--soft mt-6">
          <p className="ui-body text-[color:var(--ui-text-2)]">
            Sign in to buy a gift. We will bring you straight back here.
          </p>
          <div className="mt-4 flex flex-col gap-3 sm:flex-row">
            <Link href="/signin?next=%2Fgift" className="ui-btn ui-btn--primary min-h-[48px] flex-1">
              Sign in
            </Link>
            <Link href="/signup?next=%2Fgift" className="ui-btn ui-btn--secondary min-h-[48px] flex-1">
              Create an account
            </Link>
          </div>
        </div>
      </div>
    );
  }

  const plans = options?.plans ?? [];
  const durations = options?.durations ?? [];
  const messageLeft = MESSAGE_MAX_LENGTH - personalMessage.length;

  return (
    <div className="gf-layout">
      {contactSheet}

      <form
        noValidate
        onSubmit={(e) => {
          e.preventDefault();
          handlePay();
        }}
        aria-label="Gift details"
        id="gift-form"
      >
        {/* --------------------------- 1. Recipient --------------------------- */}
        <section className="gf-block" aria-labelledby="gift-recipient-heading">
          <h2 id="gift-recipient-heading" className="gf-block__title">
            <span className="gf-block__num" aria-hidden="true">1</span>
            Who is it for?
          </h2>

          <div className="gf-stack">
            <div className="gf-row gf-row--2">
              <Field
                id="firstName"
                label="First name"
                value={firstName}
                onChange={setFirstName}
                error={errors.firstName}
                autoComplete="off"
                maxLength={80}
              />
              <Field
                id="lastName"
                label="Last name"
                value={lastName}
                onChange={setLastName}
                error={errors.lastName}
                autoComplete="off"
                maxLength={80}
              />
            </div>

            <Field
              id="email"
              label="Their email"
              type="email"
              value={email}
              onChange={setEmail}
              error={errors.email}
              hint="We email them a link to claim it."
              placeholder="name@example.com"
              autoComplete="off"
              inputMode="email"
              maxLength={200}
            />

            {/*
              The second contact. Optional, so it is offered rather than shown:
              a purchaser who adds it also gets the link texted to the
              recipient. "Remove" clears the number as well as hiding the
              field, so a hidden number is never sent.
            */}
            {phoneOpen ? (
              <div>
                <Field
                  id="phone"
                  label="Their mobile number"
                  type="tel"
                  value={phone}
                  onChange={setPhone}
                  error={errors.phone}
                  hint="We text them the link too."
                  placeholder="(631) 555-0134"
                  autoComplete="off"
                  inputMode="tel"
                  maxLength={20}
                />
                <button
                  type="button"
                  className="gf-textbtn gf-textbtn--muted"
                  onClick={() => {
                    setPhone("");
                    setPhoneOpen(false);
                    setErrors((prev) => {
                      const rest = { ...prev };
                      delete rest.phone;
                      return rest;
                    });
                  }}
                >
                  Remove mobile number
                </button>
              </div>
            ) : (
              <button
                type="button"
                className="gf-textbtn"
                onClick={() => {
                  setPhoneOpen(true);
                  window.requestAnimationFrame(() => document.getElementById("phone")?.focus());
                }}
              >
                <span aria-hidden="true">+</span> Add another contact (mobile number)
              </button>
            )}
          </div>
        </section>

        {/* ----------------------------- 2. Gift ----------------------------- */}
        <section className="gf-block" aria-labelledby="gift-choice-heading">
          <h2 id="gift-choice-heading" className="gf-block__title">
            <span className="gf-block__num" aria-hidden="true">2</span>
            Choose the gift
          </h2>

          <fieldset>
            <legend className="gf-legend">Plan</legend>
            <div
              className="gf-choices gf-choices--plans"
              aria-invalid={errors.plan ? true : undefined}
              aria-describedby={errors.plan ? "plan-error" : undefined}
            >
              {plans.map((option) => {
                const perMonth = option.quotes[0]?.perMonthCents;
                if (perMonth === undefined) return null;
                return (
                  <label key={option.plan} className="gf-choice">
                    <input
                      type="radio"
                      name="gift-plan"
                      value={option.plan}
                      checked={plan === option.plan}
                      onChange={() => {
                        setPlan(option.plan);
                        setErrors((prev) => {
                          const rest = { ...prev };
                          delete rest.plan;
                          return rest;
                        });
                      }}
                    />
                    <span className="gf-choice__name">{option.label}</span>
                    <span className="gf-choice__meta">{formatMoneyCents(perMonth)}/mo</span>
                  </label>
                );
              })}
            </div>
            {errors.plan ? (
              <p id="plan-error" role="alert" className="gf-error">
                {errors.plan}
              </p>
            ) : null}
          </fieldset>

          {/*
            Length. Each tile shows its own total once a plan is chosen.

            Twelve months is sold at the annual rate, so printing "per month
            times months" beside it would be arithmetic that does not reach
            the price shown. The server says which basis it used; the saving
            is the honest thing to show in its place.
          */}
          <fieldset className="mt-5">
            <legend className="gf-legend">Length</legend>
            <div
              className="gf-choices gf-choices--lengths"
              style={{ ["--gf-cols" as string]: String(Math.min(Math.max(durations.length, 1), 5)) }}
            >
              {durations.map((months) => {
                const quote = quoteForDuration(plan, months);
                return (
                  <label key={months} className="gf-choice">
                    <input
                      type="radio"
                      name="gift-length"
                      value={months}
                      checked={durationMonths === months}
                      onChange={() => setChosenDuration(months)}
                    />
                    <span className="gf-choice__name">{monthsLabel(months)}</span>
                    {quote ? (
                      <>
                        <span className="gf-choice__meta">{formatMoneyCents(quote.totalCents)}</span>
                        {quote.pricingBasis === "annual" && quote.savingsCents ? (
                          <span className="gf-choice__save">Save {formatMoneyCents(quote.savingsCents)}</span>
                        ) : null}
                      </>
                    ) : null}
                  </label>
                );
              })}
            </div>
          </fieldset>
        </section>

        {/* ---------------------------- Optional ----------------------------- */}
        {/*
          What the gift SAYS, kept apart from what the gift IS, plus the
          address hint. All optional, all closed by default, and none of it
          changes the plan, the length or the price.
        */}
        <section className="gf-block">
          <div className="gf-more">
            <button
              type="button"
              className="gf-more__toggle"
              aria-expanded={moreOpen}
              aria-controls="gift-more"
              onClick={() => setMoreOpen((open) => !open)}
            >
              <span>
                Add a message or details <span className="gf-opt">(optional)</span>
              </span>
            </button>

            <div id="gift-more" hidden={!moreOpen} className="gf-more__body">
              <div className="gf-stack">
                <div>
                  <label htmlFor="gift-occasion" className="gf-label">
                    Occasion
                  </label>
                  <select
                    id="gift-occasion"
                    value={occasion}
                    onChange={(e) => setOccasion(e.target.value as GiftOccasion)}
                    className="gf-input"
                  >
                    {OCCASION_ORDER.map((key) => (
                      <option key={key} value={key}>
                        {OCCASIONS[key].label}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <div className="flex items-baseline justify-between gap-3">
                    <label htmlFor="gift-message" className="gf-label">
                      Personal message
                    </label>
                    <span className="ui-num text-[13px] text-[color:var(--ui-text-3)]" aria-live="polite">
                      {messageLeft} left
                    </span>
                  </div>
                  <textarea
                    id="gift-message"
                    value={personalMessage}
                    maxLength={MESSAGE_MAX_LENGTH}
                    rows={3}
                    onChange={(e) => setPersonalMessage(e.target.value.slice(0, MESSAGE_MAX_LENGTH))}
                    placeholder="Congratulations on your new home!"
                    className="gf-input"
                  />
                </div>
              </div>

              {/*
                THE ADDRESS IS OPTIONAL. Most people buying a present for a
                colleague, a client or a sister-in-law do not know their street
                address, and being asked for it is where the purchase was being
                abandoned. The recipient picks the property on their own
                account when they claim, and that is the one entitlement uses;
                anything entered here is only a hint so they recognise which
                home it was meant for.
              */}
              <p className="gf-subhead">Their address</p>
              <p className="gf-hint mt-0 mb-3">Only if you know it. They choose the home when they claim.</p>
              <div className="gf-stack">
                <Field
                  id="line1"
                  label="Street address"
                  value={line1}
                  onChange={setLine1}
                  error={errors.line1}
                  autoComplete="off"
                  maxLength={200}
                />
                <div className="gf-row gf-row--address">
                  <Field
                    id="city"
                    label="City"
                    value={city}
                    onChange={setCity}
                    error={errors.city}
                    autoComplete="off"
                    maxLength={100}
                  />
                  <div>
                    <label htmlFor="state" className="gf-label">
                      State
                    </label>
                    <select
                      id="state"
                      value={state}
                      onChange={(e) => setState(e.target.value)}
                      className="gf-input"
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
                    autoComplete="off"
                    inputMode="numeric"
                    maxLength={5}
                  />
                </div>
              </div>
            </div>
          </div>
        </section>
      </form>

      {/* ------------------------- Summary and pay ------------------------- */}
      <aside className="gf-aside" aria-labelledby="gift-summary-heading">
        {/*
          The real card, not a mock of it.

          This is the same DigitalGiftCard the recipient opens, given the same
          props, so the promise "this is what they will receive" is true by
          construction rather than by somebody remembering to keep two designs
          in step. Compact, and only once a plan is chosen: before that there
          is no gift to show.
        */}
        {plan && durationMonths !== null ? (
          <div className="gf-preview">
            <p className="gf-preview__label">What they will receive</p>
            <DigitalGiftCard
              occasion={occasion}
              plan={plan}
              durationMonths={durationMonths}
              recipientFirstName={firstName}
              recipientLastName={lastName}
              from={purchaserName}
              personalMessage={personalMessage}
              size="compact"
              previewNote="Preview only."
            />
          </div>
        ) : null}

        <div className="ui-card">
          <h2 id="gift-summary-heading" className="ui-h3">
            Summary
          </h2>

          <dl className="gf-summary mt-2">
            <div className="gf-summary__row">
              <dt>Plan</dt>
              <dd className={plan ? "" : "gf-muted"}>{plan ? planLabel(plan) : "Choose a plan"}</dd>
            </div>
            <div className="gf-summary__row">
              <dt>Length</dt>
              <dd>{durationMonths !== null ? monthsLabel(durationMonths) : "—"}</dd>
            </div>
            <div className="gf-summary__row">
              <dt>Price</dt>
              <dd className={selectedQuote ? "" : "gf-muted"}>
                {selectedQuote ? formatMoneyCents(selectedQuote.totalCents) : "—"}
              </dd>
            </div>
            {selectedQuote?.pricingBasis === "annual" && selectedQuote.savingsCents ? (
              <div className="gf-summary__row">
                <dt>12 for the price of 10</dt>
                <dd className="gf-discount">You save {formatMoneyCents(selectedQuote.savingsCents)}</dd>
              </div>
            ) : null}
            <div className="gf-summary__row">
              <dt>Promo code</dt>
              <dd className="gf-muted">Enter at checkout</dd>
            </div>
            <div className="gf-summary__row">
              <dt>Sales tax</dt>
              <dd className="gf-muted">Added at checkout</dd>
            </div>
            <div className="gf-summary__row gf-summary__total">
              <dt>Total</dt>
              <dd data-testid="gift-total">
                {selectedQuote ? formatMoneyCents(selectedQuote.totalCents) : "—"}
                <small>before tax and any promo code</small>
              </dd>
            </div>
          </dl>

          <div className="mt-3 flex flex-wrap items-center gap-x-3 gap-y-2">
            <GiftPromoCode tone="light" />
          </div>

          {submitError ? (
            <p role="alert" className="gf-alert mt-4">
              {submitError}
            </p>
          ) : null}

          <button
            type="submit"
            form="gift-form"
            disabled={submitting}
            aria-busy={submitting}
            className="ui-btn ui-btn--primary ui-btn--lg ui-btn--block mt-5"
          >
            {submitting ? (
              <>
                <span className="gf-spinner gf-spinner--sm" aria-hidden="true" />
                Opening checkout&hellip;
              </>
            ) : (
              "Continue to payment"
            )}
          </button>

          <p className="ui-small mt-3 text-center">
            Pay by card on Stripe&apos;s secure checkout. One-time payment: it does not
            automatically renew.
          </p>
        </div>
      </aside>
    </div>
  );
}
