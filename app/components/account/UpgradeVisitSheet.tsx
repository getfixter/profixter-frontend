"use client";

import { useEffect, useMemo, useState } from "react";
import Sheet from "@/app/components/ui/Sheet";
import { buttonClass } from "@/app/components/ui/Button";
import WelcomeOfferBanner from "@/app/components/membership/WelcomeOfferBanner";
import { useContactCompletion } from "@/app/components/auth/ContactCompletion";
import { readApiError } from "@/lib/auth2";
import { formatCents, offerPrice, useWelcomeOffer, WELCOME_OFFER_ERROR_CODES } from "@/lib/welcome-offer";
import {
  dollars,
  fetchUpgradeOptions,
  startUpgradeCheckout,
  UPGRADE_PHONE,
  type UpgradeCycle,
  type UpgradeKind,
  type UpgradeOptions,
} from "@/lib/visit-upgrade";

/*
 * "Upgrade to a handyman visit", from the customer's own free-visit card.
 *
 * Everything known is reused: the visit's day, time and address are kept,
 * the account's name, email and phone are used, and only a missing contact
 * detail is asked for (useContactCompletion, as every booking does). The
 * customer chooses an offer, reads and ticks its terms, and pays on their own
 * Stripe page. Nothing about the visit changes until Stripe confirms.
 *
 * The 20% first-payment offer shows here exactly when it shows on the plans
 * page: the server decides (lib/welcome-offer), and checkout asks again.
 */
export default function UpgradeVisitSheet({
  bookingId,
  open,
  onClose,
  returnedUnpaid = false,
}: {
  bookingId: string;
  open: boolean;
  onClose: () => void;
  /** Back from Stripe without paying. */
  /* Only after the server verified with Stripe that nothing was paid (BookingsSection, customerPaymentStatus). */
  returnedUnpaid?: boolean;
}) {
  const [options, setOptions] = useState<UpgradeOptions | null>(null);
  const [loadError, setLoadError] = useState("");
  const [kind, setKind] = useState<UpgradeKind | null>(null);
  const [plan, setPlan] = useState("basic");
  const [cycle, setCycle] = useState<UpgradeCycle>("monthly");
  /* The exact terms ticked: a different choice or price shows different terms, which must be ticked again. */
  const [acceptedTerms, setAcceptedTerms] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  /* The server says a payment for this visit already went through: never offered again from here. */
  const [paidLock, setPaidLock] = useState(false);
  const { ensureContact, contactSheet } = useContactCompletion();

  useEffect(() => {
    if (!open) return;
    let alive = true;
    /* Mounted fresh each time the sheet opens (My Visits renders it only while open). */
    fetchUpgradeOptions(bookingId)
      .then((data) => {
        if (!alive) return;
        setOptions(data);
        const membershipOk = !data.offers.membership.blocker && data.offers.membership.plans.some((p) => p.available);
        setKind((k) => k ?? (membershipOk ? "membership" : data.offers.oneTime.enabled ? "one_time" : null));
        const firstAvailable = data.offers.membership.plans.find((p) => p.available);
        if (firstAvailable) setPlan((p) => (data.offers.membership.plans.find((x) => x.key === p)?.available ? p : firstAvailable.key));
      })
      .catch((err) => alive && setLoadError(readApiError(err).message || "We couldn't load your upgrade options. Please try again."));
    return () => {
      alive = false;
    };
  }, [open, bookingId]);

  const address = options ? (options.booking.addressId ? { addressId: options.booking.addressId } : { line1: options.booking.line1, zip: options.booking.zip }) : null;
  const offer = useWelcomeOffer(open && Boolean(options?.upgradable), address);

  const membership = options?.offers.membership;
  const membershipUsable = Boolean(membership && !membership.blocker && membership.plans.some((p) => p.available));
  const chosenPlan = membership?.plans.find((p) => p.key === plan);
  const welcomePrice = kind === "membership" ? offerPrice(offer, plan, cycle) : null;

  const terms = useMemo(() => {
    if (!options || !kind) return "";
    if (kind === "one_time") return options.terms.one_time;
    const t = options.terms.membership[plan]?.[cycle];
    return t ? (welcomePrice ? t.welcome : t.regular) : "";
  }, [options, kind, plan, cycle, welcomePrice]);

  const accepted = Boolean(terms) && acceptedTerms === terms;

  const canPay = Boolean(!paidLock && options?.upgradable && kind && terms && accepted && !busy && (kind === "one_time" ? options?.offers.oneTime.enabled : membershipUsable && chosenPlan?.available));

  async function pay() {
    if (!options || !kind) return;
    setError("");
    if (!(await ensureContact())) return;
    setBusy(true);
    try {
      const { url } = await startUpgradeCheckout(bookingId, {
        kind,
        ...(kind === "membership" ? { plan, billingCycle: cycle } : {}),
        termsVersion: options.termsVersion,
        welcomeOffer: Boolean(welcomePrice),
      });
      window.location.assign(url);
    } catch (err) {
      const e = readApiError(err);
      if (WELCOME_OFFER_ERROR_CODES.includes(e.code)) offer.refresh();
      if (e.code === "CONTACT_REQUIRED") await ensureContact();
      if (e.code === "ALREADY_PAID" || e.code === "CONVERSION_IN_PROGRESS") {
        setPaidLock(true);
        setError(`${e.message || "We've received a payment for this visit."} Please don't pay again; your visit will update here shortly.`);
        setBusy(false);
        return;
      }
      setError(e.message || "We couldn't open the secure checkout. Please try again.");
      setBusy(false);
    }
  }

  const call = (
    <a href={`tel:${UPGRADE_PHONE}`} className="font-semibold text-[#306EEC]">
      {UPGRADE_PHONE}
    </a>
  );

  let body: React.ReactNode;
  if (loadError) {
    body = <p className="text-[14px] text-red-700">{loadError}</p>;
  } else if (!options) {
    body = (
      <div className="flex items-center gap-3 py-6 text-[#6A6D71]">
        <div className="h-5 w-5 animate-spin rounded-full border-2 border-[#306EEC] border-t-transparent" />
        <span className="text-[14px]">Loading your options...</span>
      </div>
    );
  } else if (!options.upgradable) {
    body = (
      <p className="text-[14px] leading-[1.5] text-[#313234]" data-upgrade-problem={options.problem?.code || ""}>
        {options.problem?.message || "This visit can't be upgraded online."} Questions? Call {call}.
      </p>
    );
  } else {
    body = (
      <div className="space-y-4" data-upgrade-sheet="">
        <div className="rounded-[8px] border border-[#E0E6F5] bg-[#F8FAFF] p-3 text-[13.5px] leading-[1.45]">
          <div className="font-semibold text-[#313234]">{options.booking.whenLabel}</div>
          <div className="text-[#6A6D71]">{options.booking.address}</div>
          <div className="mt-1.5 text-[12.5px] text-[#6A6D71]">
            Same day, time and address, with your notes and photos. Nothing changes until your payment goes through.
          </div>
        </div>

        {returnedUnpaid ? (
          <p className="rounded-[8px] border border-[#E0E6F5] bg-white px-3 py-2 text-[13px] text-[#6A6D71]" role="status">
            Payment not completed. Nothing was charged, and your free visit is still booked.
          </p>
        ) : null}

        <fieldset className="space-y-2">
          <legend className="mb-1 text-[12px] font-bold uppercase tracking-[0.08em] text-[#9CA3AF]">Choose your visit</legend>

          <label
            className={`flex cursor-pointer items-start gap-3 rounded-[8px] border p-3 ${kind === "membership" ? "border-[#306EEC] bg-[#F0F7FF]" : "border-[#E0E6F5] bg-white"} ${membershipUsable ? "" : "cursor-not-allowed opacity-60"}`}
          >
            <input type="radio" name="upgrade-kind" className="mt-1 accent-[#306EEC]" checked={kind === "membership"} disabled={!membershipUsable} onChange={() => setKind("membership")} data-upgrade-kind="membership" />
            <span className="min-w-0">
              <span className="block text-[14px] font-semibold text-[#313234]">Membership</span>
              <span className="block text-[12.5px] text-[#6A6D71]">This visit, then book whenever you need us. Cancel anytime.</span>
              {membership?.blocker ? (
                <span className="mt-1 block text-[12.5px] font-semibold text-amber-700" data-upgrade-blocker={membership.blocker.code}>
                  {membership.blocker.message}
                </span>
              ) : null}
            </span>
          </label>

          {kind === "membership" && membership && membershipUsable ? (
            <div className="space-y-2 pl-1">
              <WelcomeOfferBanner offer={offer} />
              <div className="flex gap-1.5" role="group" aria-label="Billing">
                {(["monthly", "annual"] as const).map((c) => (
                  <button
                    key={c}
                    type="button"
                    onClick={() => setCycle(c)}
                    aria-pressed={cycle === c}
                    className={`min-h-[max(44px,var(--tap,44px))] flex-1 rounded-[6px] text-[13px] font-semibold ${cycle === c ? "bg-[#306EEC] text-white" : "border border-[#E0E6F5] bg-white text-[#6A6D71]"}`}
                    data-upgrade-cycle={c}
                  >
                    {c === "monthly" ? "Monthly" : "Annual"}
                  </button>
                ))}
              </div>
              <div className="grid grid-cols-2 gap-2">
                {membership.plans.map((p) => {
                  const regular = cycle === "annual" ? p.annual : p.monthly;
                  const w = offerPrice(offer, p.key, cycle);
                  return (
                    <button
                      key={p.key}
                      type="button"
                      disabled={!p.available}
                      onClick={() => setPlan(p.key)}
                      aria-pressed={plan === p.key}
                      className={`min-h-[max(44px,var(--tap,44px))] rounded-[8px] border p-2.5 text-left disabled:cursor-not-allowed disabled:opacity-50 ${plan === p.key ? "border-[#306EEC] bg-[#F0F7FF]" : "border-[#E0E6F5] bg-white"}`}
                      data-upgrade-plan={p.key}
                    >
                      <span className="block text-[13.5px] font-semibold text-[#313234]">{p.label}</span>
                      <span className="block text-[12.5px] text-[#6A6D71]">
                        {w ? (
                          <>
                            <b className="text-[#313234]">{formatCents(w.firstCents)}</b> first {cycle === "annual" ? "year" : "month"}, then {dollars(regular)}
                          </>
                        ) : (
                          <>
                            {dollars(regular)}/{cycle === "annual" ? "yr" : "mo"}
                          </>
                        )}
                      </span>
                      {!p.available ? <span className="block text-[11.5px] text-[#9CA3AF]">Your home already has the visits this plan allows</span> : null}
                    </button>
                  );
                })}
              </div>
              {membership.firstVisitException ? (
                <p className="text-[12.5px] text-[#6A6D71]">Member visits are usually booked 7 days ahead. As your first member visit, this one keeps its time.</p>
              ) : null}
            </div>
          ) : null}

          <label
            className={`flex cursor-pointer items-start gap-3 rounded-[8px] border p-3 ${kind === "one_time" ? "border-[#306EEC] bg-[#F0F7FF]" : "border-[#E0E6F5] bg-white"} ${options.offers.oneTime.enabled ? "" : "cursor-not-allowed opacity-60"}`}
          >
            <input type="radio" name="upgrade-kind" className="mt-1 accent-[#306EEC]" checked={kind === "one_time"} disabled={!options.offers.oneTime.enabled} onChange={() => setKind("one_time")} data-upgrade-kind="one_time" />
            <span className="min-w-0">
              <span className="block text-[14px] font-semibold text-[#313234]">One-Time Visit · {formatCents(options.offers.oneTime.priceCents)}</span>
              <span className="block text-[12.5px] text-[#6A6D71]">One 90-minute paid visit. No membership, nothing recurring.</span>
            </span>
          </label>
        </fieldset>

        {terms ? (
          <div className="flex items-start gap-2.5" data-upgrade-terms="">
            <input id={`upgrade-terms-${bookingId}`} type="checkbox" checked={accepted} onChange={(e) => setAcceptedTerms(e.target.checked ? terms : "")} className="mt-[3px] h-[20px] w-[20px] flex-shrink-0 cursor-pointer accent-[#0B1628]" />
            <div className="min-w-0 text-[13px] leading-[1.45] text-[#4B5563]">
              <label htmlFor={`upgrade-terms-${bookingId}`} className="cursor-pointer">
                {terms}
              </label>{" "}
              <a href="/terms" target="_blank" rel="noopener noreferrer" className="font-semibold text-[#313234] underline underline-offset-2">
                Read the terms
              </a>
            </div>
          </div>
        ) : null}

        {error ? (
          <p className="text-[13px] font-semibold text-red-700" role="alert">
            {error}
          </p>
        ) : null}

        <button type="button" className={buttonClass({ variant: "primary", block: true })} disabled={!canPay} onClick={pay} data-action="upgrade-pay">
          {busy ? "Opening secure checkout..." : "Continue to secure checkout"}
        </button>
        <p className="text-center text-[12px] text-[#9CA3AF]">Payments are processed securely by Stripe. Questions? Call {call}.</p>
      </div>
    );
  }

  return (
    <>
      <Sheet open={open} onClose={() => !busy && onClose()} title="Upgrade to a handyman visit">
        {body}
      </Sheet>
      {contactSheet}
    </>
  );
}
