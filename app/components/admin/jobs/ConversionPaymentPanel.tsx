"use client";

/**
 * Settling a paid free-visit conversion by hand (BackEnd
 * utils/freeVisit/paymentResolution.js): a payment that needs attention
 * ("close"), or a converted visit that was canceled afterwards ("resolve").
 *
 * It shows the payment and, for a membership, the subscription it started -
 * as Stripe has them now - and records what Admin did. Nothing is refunded or
 * canceled from here: a refund is made in Stripe, a membership is canceled on
 * the customer's profile. The server checks the record against Stripe, so a
 * refund that is not there, or a membership that still bills, is refused.
 */
import { ArrowTopRightOnSquareIcon, ExclamationTriangleIcon } from "@heroicons/react/24/outline";
import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { errorCode, errorMessage } from "@/lib/admin/query";
import {
  closeConversion,
  fetchConversionPayment,
  money,
  resolveConversionPayment,
  type Conversion,
  type PaymentFacts,
  type PaymentResolutionKind,
} from "@/lib/admin/visitConversion";
import { Button, Field, SkeletonRows, Textarea, cx } from "@/app/components/admin/ui";

type Props = {
  bookingId: string;
  conversion: Conversion;
  mode: "close" | "resolve";
  onDone: (conversion: Conversion) => void;
  setBusy?: (busy: boolean) => void;
};

function day(iso: string | null | undefined) {
  if (!iso) return "";
  return new Date(iso).toLocaleDateString("en-US", { timeZone: "America/New_York", month: "short", day: "numeric", year: "numeric" });
}

function membershipState(m: NonNullable<PaymentFacts["membership"]>): { text: string; bills: boolean | null } {
  if (!m.status) return { text: "Not found in Stripe or in our records. Check Stripe before deciding.", bills: null };
  if (m.billsAgain === false) {
    if (m.status === "canceled" || m.status === "expired" || m.status === "incomplete_expired") return { text: `Ended${m.endedAt ? ` on ${day(m.endedAt)}` : ""}: it will not bill again.`, bills: false };
    return { text: `Set to end${m.cancelAt ? ` on ${day(m.cancelAt)}` : m.nextPaymentAt ? ` on ${day(m.nextPaymentAt)}` : ""}: it will not bill again.`, bills: false };
  }
  return { text: `${m.status === "active" ? "Active" : m.status.replace(/_/g, " ")}: it bills again${m.nextPaymentAt ? ` on ${day(m.nextPaymentAt)}` : ""} unless it is canceled.`, bills: true };
}

const CHOICES: Record<"one_time" | "membership", { value: PaymentResolutionKind; label: string; help: string }[]> = {
  one_time: [
    { value: "refunded", label: "Refunded in Stripe", help: "Stripe must already show the refund." },
    { value: "kept", label: "Kept, no refund", help: "For example: the customer is rebooking with it. Say why below." },
  ],
  membership: [
    { value: "membership_canceled", label: "Membership canceled", help: "Cancel it on the customer's profile first. Stripe must show it will not bill again." },
    { value: "membership_kept", label: "The customer keeps the membership", help: "They stay a member and book their visits as one. Say why below." },
  ],
};

export function ConversionPaymentPanel({ bookingId, conversion, mode, onDone, setBusy }: Props) {
  const [facts, setFacts] = useState<PaymentFacts | null>(null);
  const [loadError, setLoadError] = useState("");
  const [choice, setChoice] = useState<PaymentResolutionKind | "">("");
  const [refunded, setRefunded] = useState<"" | "yes" | "no">("");
  const [note, setNote] = useState("");
  const [busy, setLocalBusy] = useState(false);
  const [error, setError] = useState<{ code: string; message: string } | null>(null);

  const load = useCallback(async () => {
    try {
      const res = await fetchConversionPayment(bookingId, conversion.id);
      setFacts(res.facts);
      setLoadError("");
    } catch (e) {
      setLoadError(errorMessage(e, "Could not load the payment."));
    }
  }, [bookingId, conversion.id]);

  useEffect(() => {
    void load();
  }, [load]);

  const submit = async () => {
    if (!choice) return;
    setLocalBusy(true);
    setBusy?.(true);
    setError(null);
    try {
      const input = { resolution: choice, reason: note.trim(), ...(choice === "membership_canceled" ? { firstPaymentRefunded: refunded === "yes" } : {}) };
      const res = mode === "close" ? await closeConversion(bookingId, conversion.id, input) : await resolveConversionPayment(bookingId, conversion.id, input);
      onDone(res.conversion);
    } catch (e) {
      setError({ code: errorCode(e) || "error", message: errorMessage(e, "Could not record the decision.") });
      void load();
    } finally {
      setLocalBusy(false);
      setBusy?.(false);
    }
  };

  const kind = conversion.kind;
  const m = facts?.membership;
  const state = m ? membershipState(m) : null;
  const ready = Boolean(choice) && note.trim().length >= 3 && (choice !== "membership_canceled" || refunded !== "");

  return (
    <div className="flex flex-col gap-3 rounded-adm-sm border border-adm-line p-3" data-convert-payment={mode} data-convert-payment-kind={kind}>
      <p className="text-[15px] font-semibold text-adm-ink">{mode === "close" ? "Settle the payment, then close" : "The payment still needs your decision"}</p>
      {loadError ? (
        <div className="text-[14px] text-adm-problem" role="alert">
          {loadError}{" "}
          <button type="button" className="font-semibold underline" onClick={() => void load()}>
            Try again
          </button>
        </div>
      ) : !facts ? (
        <SkeletonRows count={2} label="Checking the payment with Stripe" />
      ) : (
        <div className="flex flex-col gap-2 text-[14px] text-adm-ink" data-convert-payment-facts="">
          <div>
            Paid <strong>{facts.amountCents != null ? money(facts.amountCents) : "(amount in Stripe)"}</strong>
            {facts.paidAt ? ` on ${day(facts.paidAt)}` : ""} for {facts.offerLabel || (kind === "one_time" ? "a One-Time Visit" : "a membership")}.
          </div>
          {kind === "one_time" && facts.oneTime && (
            <div data-convert-refund={facts.oneTime.refund}>
              Refund in Stripe:{" "}
              <strong>
                {facts.oneTime.refund === "none"
                  ? "none yet"
                  : facts.oneTime.refund === "full"
                    ? `refunded in full (${money(facts.oneTime.refundedCents)})`
                    : facts.oneTime.refund === "partial"
                      ? `partly refunded (${money(facts.oneTime.refundedCents)})`
                      : "unknown"}
              </strong>
              {facts.oneTime.paymentUrl && (
                <a href={facts.oneTime.paymentUrl} target="_blank" rel="noreferrer" className="ml-2 inline-flex items-center gap-1 font-semibold text-adm-accent underline">
                  Open the payment in Stripe <ArrowTopRightOnSquareIcon className="h-4 w-4" aria-hidden="true" />
                </a>
              )}
            </div>
          )}
          {kind === "membership" && m && state && (
            <>
              <div className={cx("rounded-adm-sm px-3 py-2", state.bills ? "bg-adm-attn-bg" : "bg-adm-surface-2")} data-convert-subscription={state.bills === null ? "unknown" : state.bills ? "billing" : "ended"}>
                <div>
                  Subscription{m.source === "record" ? " (our record; Stripe could not be asked)" : ""}: <strong>{state.text}</strong>
                </div>
                <div className="mt-1 flex flex-wrap gap-x-4 gap-y-1">
                  {m.customerProfileHref && (
                    <Link href={m.customerProfileHref} className="font-semibold text-adm-accent underline" data-convert-profile="">
                      Customer profile (cancel the membership there)
                    </Link>
                  )}
                  {m.subscriptionUrl && (
                    <a href={m.subscriptionUrl} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 font-semibold text-adm-accent underline">
                      Subscription in Stripe <ArrowTopRightOnSquareIcon className="h-4 w-4" aria-hidden="true" />
                    </a>
                  )}
                </div>
              </div>
              <p className="flex items-start gap-2 text-[13.5px]" data-convert-refund-warning="">
                <ExclamationTriangleIcon className="mt-0.5 h-5 w-5 flex-none text-adm-attn" aria-hidden="true" />
                Refunding the first payment in Stripe does not stop the membership&apos;s next payment. To stop billing, cancel the membership on the customer&apos;s profile.
              </p>
            </>
          )}
          {!facts.checkedWithStripe && <p className="text-[13px] text-adm-text-2">Stripe could not be asked just now, so this may be out of date. A decision is only recorded once Stripe can be checked.</p>}
        </div>
      )}

      <fieldset className="flex flex-col gap-1">
        <legend className="mb-1 text-[14px] font-semibold text-adm-ink">What happened</legend>
        {CHOICES[kind].map((c) => (
          <label key={c.value} className={cx("flex min-h-[44px] items-start gap-2 rounded-adm-sm border px-3 py-2 text-[14px]", choice === c.value ? "border-adm-accent bg-adm-accent-soft" : "border-adm-line")}>
            <input type="radio" name={`resolution-${conversion.id}`} className="mt-0.5 h-5 w-5 accent-[var(--adm-accent)]" checked={choice === c.value} onChange={() => setChoice(c.value)} data-convert-resolution={c.value} />
            <span>
              <span className="font-semibold text-adm-ink">{c.label}</span>
              <span className="block text-[13px] text-adm-text-2">{c.help}</span>
            </span>
          </label>
        ))}
      </fieldset>

      {choice === "membership_canceled" && (
        <fieldset className="flex flex-col gap-1" data-convert-first-refund="">
          <legend className="mb-1 text-[14px] font-semibold text-adm-ink">Was the first payment refunded in Stripe?</legend>
          {(
            [
              ["yes", "Yes, refunded in Stripe"],
              ["no", "No, not refunded"],
            ] as const
          ).map(([value, label]) => (
            <label key={value} className="flex min-h-[44px] items-center gap-2 text-[14px]">
              <input type="radio" name={`first-refund-${conversion.id}`} className="h-5 w-5 accent-[var(--adm-accent)]" checked={refunded === value} onChange={() => setRefunded(value)} data-convert-first-refund-answer={value} />
              {label}
            </label>
          ))}
        </fieldset>
      )}

      <Field label="Note (recorded with your name)" help="What was agreed with the customer.">
        <Textarea value={note} onChange={(e) => setNote(e.target.value)} maxLength={300} data-convert-close-reason="" />
      </Field>

      {error && (
        <div role="alert" className="flex items-start gap-2 rounded-adm-sm bg-adm-problem-bg px-3 py-2.5 text-[14px] text-adm-problem" data-convert-error={error.code}>
          <ExclamationTriangleIcon className="mt-0.5 h-5 w-5 flex-none" aria-hidden="true" />
          <div>{error.message}</div>
        </div>
      )}

      <div>
        <Button variant="secondary" large onClick={() => void submit()} busy={busy} disabled={busy || !ready} data-convert-close={mode === "close" ? "" : undefined} data-convert-resolve={mode === "resolve" ? "" : undefined}>
          {mode === "close" ? "Record and close" : "Record decision"}
        </Button>
      </div>
    </div>
  );
}
