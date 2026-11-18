"use client";

/**
 * The page Stripe returns to after paying for a One-Time Visit or a Full Day -
 * signed in or not (2026-11-17).
 *
 * NEVER SUCCESS BEFORE THE SERVER SAYS SO. This page used to print "Payment
 * received" the moment it loaded, whatever had happened. It now asks the
 * server where this Stripe session stands (GET /api/bookings/guest/status,
 * which returns nothing personal) and shows exactly that:
 *   awaiting_payment / payment_processing  -> "confirming your payment", polling
 *   pending_approval                         -> paid; the owner reviews it
 *   confirmed                                -> approved
 *   not_completed / canceled                 -> said plainly, with a way back
 *
 * Once paid: the booking draft that led here is cleared (so Back cannot start
 * the same visit again), the homepage is told, and Clarity records
 * booking_payment_confirmed_<type> once per session.
 */

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { useAuth } from "@/lib/useAuth";
import { getCheckoutStatus, type CheckoutStatus } from "@/lib/guest-checkout";
import { clearHandymanDraft } from "@/lib/handyman-draft";
import { clarityBookingEvent } from "@/lib/clarity";
import { announceBookingSucceeded } from "@/lib/booking-events";

const PHONE = "631-599-1363";
const POLL_FAST_MS = 2000;
const POLL_SLOW_MS = 8000;
const POLL_FAST_FOR_MS = 60 * 1000;
const POLL_GIVE_UP_MS = 4 * 60 * 1000;

function whenLabel(st: CheckoutStatus) {
  const [y, m, d] = st.date.split("-").map(Number);
  const day = new Date(Date.UTC(y, m - 1, d, 12)).toLocaleDateString("en-US", { weekday: "long", month: "long", day: "numeric", timeZone: "UTC" });
  if (!st.time) return day;
  const [hh, mm] = st.time.split(":").map(Number);
  return `${day} at ${hh % 12 || 12}:${String(mm).padStart(2, "0")} ${hh >= 12 ? "PM" : "AM"}`;
}

const KIND_LABEL: Record<CheckoutStatus["kind"], string> = { one_time: "One-Time Visit", full_day: "Full Day Fixter", other: "Visit" };
const PAID = new Set(["pending_approval", "confirmed"]);

export default function PaidVisitStatus({ sessionId }: { sessionId?: string }) {
  const { user } = useAuth();
  const [st, setSt] = useState<CheckoutStatus | null>(null);
  const [phase, setPhase] = useState<"loading" | "known" | "unknown" | "slow">(sessionId ? "loading" : "unknown");
  const settled = useRef(false);

  useEffect(() => {
    if (!sessionId) return;
    let alive = true;
    let timer = 0;
    const startedAt = Date.now();
    const ask = async () => {
      const next = await getCheckoutStatus(sessionId);
      if (!alive) return;
      if (next) {
        setSt(next);
        setPhase("known");
      }
      const waiting = !next || next.status === "awaiting_payment" || next.status === "payment_processing";
      const age = Date.now() - startedAt;
      if (!waiting) return;
      if (age > POLL_GIVE_UP_MS) {
        setPhase(next ? "slow" : "unknown");
        return;
      }
      timer = window.setTimeout(ask, age < POLL_FAST_FOR_MS ? POLL_FAST_MS : POLL_SLOW_MS);
    };
    void ask();
    return () => {
      alive = false;
      window.clearTimeout(timer);
    };
  }, [sessionId]);

  /* Paid, as the server says: tidy up once, and say so to Clarity and the page. */
  useEffect(() => {
    if (!st || settled.current || !PAID.has(st.status)) return;
    settled.current = true;
    const type = st.kind === "full_day" ? "full_day" : "handyman";
    clarityBookingEvent("booking_payment_confirmed", type, sessionId);
    announceBookingSucceeded(type);
    if (st.kind === "one_time") void clearHandymanDraft();
    try {
      window.sessionStorage.removeItem("pf_full_day_guest");
    } catch {
      /* private mode */
    }
  }, [st, sessionId]);

  const manage = st?.guest && !user ? (
    <>
      <p className="ui-body mt-4 text-[15px]">
        To see and manage this visit online, create an account or sign in with the <b>same mobile number or email</b> you just used - it appears under My Visits.
      </p>
      <div className="pg-actions pg-actions--stack">
        <Link href={`/signup?next=${encodeURIComponent("/book#your-visits")}`} className="ui-btn ui-btn--primary" data-action="create-account-after-payment">
          Create my account
        </Link>
        <Link href={`/signin?next=${encodeURIComponent("/book#your-visits")}`} className="ui-btn ui-btn--secondary">
          I have an account
        </Link>
      </div>
    </>
  ) : (
    <div className="pg-actions pg-actions--stack">
      <Link href="/book#your-visits" className="ui-btn ui-btn--primary">
        View my visits
      </Link>
    </div>
  );

  if (phase === "loading" || (phase === "known" && st && (st.status === "awaiting_payment" || st.status === "payment_processing"))) {
    return (
      <Card tone="wait" eyebrow={st ? KIND_LABEL[st.kind] : "Your visit"} title="Confirming your payment…" status={st?.status || "loading"}>
        <p className="ui-body mt-3">
          {st?.status === "payment_processing"
            ? "Stripe has your payment. We’re recording it now - this usually takes a few seconds."
            : "We’re checking your payment with Stripe. This usually takes a few seconds; you don’t need to do anything."}
        </p>
        {st ? <Facts st={st} statusLabel="Payment being confirmed" /> : null}
      </Card>
    );
  }

  if (!st || phase === "unknown") {
    return (
      <Card tone="warn" eyebrow="Your visit" title="We can't show this payment here" status="unknown">
        <p className="ui-body mt-3">
          If you paid, you&apos;ll get a confirmation email within a few minutes. Questions: call or text{" "}
          <a href={`tel:${PHONE}`} className="font-semibold text-[color:var(--ui-accent-ink)]">{PHONE}</a>.
        </p>
      </Card>
    );
  }

  if (phase === "slow") {
    return (
      <Card tone="warn" eyebrow={KIND_LABEL[st.kind]} title="Your payment is taking longer than usual" status={st.status}>
        <p className="ui-body mt-3">
          Nothing more to do here. If the payment went through you&apos;ll get a confirmation email; if not, nothing was charged. Questions: call or text{" "}
          <a href={`tel:${PHONE}`} className="font-semibold text-[color:var(--ui-accent-ink)]">{PHONE}</a>.
        </p>
        <Facts st={st} statusLabel="Payment not confirmed yet" />
      </Card>
    );
  }

  if (st.status === "not_completed") {
    return (
      <Card tone="warn" eyebrow={KIND_LABEL[st.kind]} title="Payment not completed" status={st.status}>
        <p className="ui-body mt-3">Nothing was charged and the time was released. Your details are saved if you&apos;d like to try again.</p>
        <div className="pg-actions pg-actions--stack">
          <Link href={st.kind === "full_day" ? "/book?visit=full-day" : "/book/handyman"} className="ui-btn ui-btn--primary">
            Back to booking
          </Link>
        </div>
      </Card>
    );
  }

  if (st.status === "canceled") {
    return (
      <Card tone="warn" eyebrow={KIND_LABEL[st.kind]} title="This visit was canceled" status={st.status}>
        <p className="ui-body mt-3">
          If you were charged, the refund is handled by our team. Questions: call or text{" "}
          <a href={`tel:${PHONE}`} className="font-semibold text-[color:var(--ui-accent-ink)]">{PHONE}</a>.
        </p>
      </Card>
    );
  }

  const confirmed = st.status === "confirmed";
  return (
    <Card tone="ok" eyebrow={`${KIND_LABEL[st.kind]} · Paid`} title={confirmed ? "Your visit is confirmed." : "Payment received. Your request is pending approval."} status={st.status}>
      <p className="ui-body mt-3 max-w-[60ch]">
        {confirmed
          ? "We'll see you then. You'll get a reminder the day before."
          : "Profixter reviews every paid request - the job, the photos and the time - and confirms it with you shortly by text or email."}
      </p>
      <Facts st={st} statusLabel={confirmed ? "Confirmed" : "Paid - waiting for approval"} />
      <p className="mt-4 rounded-[var(--ui-r-sm)] bg-[color:var(--ui-bg-soft)] px-4 py-3 text-[14px] leading-[1.55] text-[color:var(--ui-text-2)]">
        If we cannot approve the job, cannot complete it within the visit&apos;s scope, or need to cancel before service, you will receive a full refund.
      </p>
      <p className="mt-3 text-[14px] text-[color:var(--ui-text-3)]">
        To change or cancel, call or text{" "}
        <a href={`tel:${PHONE}`} className="font-semibold text-[color:var(--ui-accent-ink)]">{PHONE}</a>.
      </p>
      {manage}
    </Card>
  );
}

function Facts({ st, statusLabel }: { st: CheckoutStatus; statusLabel: string }) {
  return (
    <dl className="mt-5 grid gap-0 border-t border-[color:var(--ui-line)] text-[15px]" data-paid-facts>
      {[
        ["Visit", KIND_LABEL[st.kind]],
        ["When", whenLabel(st)],
        ["Status", statusLabel],
        ["Booking", `#${st.bookingNumber}`],
      ].map(([k, v]) => (
        <div key={k} className="flex justify-between gap-4 border-b border-[color:var(--ui-line)] py-2.5">
          <dt className="text-[color:var(--ui-text-3)]">{k}</dt>
          <dd className="text-right font-medium text-[color:var(--ui-ink)]" data-fact={k.toLowerCase()}>{v}</dd>
        </div>
      ))}
    </dl>
  );
}

function Card({ tone, eyebrow, title, status, children }: { tone: "ok" | "wait" | "warn"; eyebrow: string; title: string; status: string; children: React.ReactNode }) {
  const icon =
    tone === "ok" ? (
      <path d="M5 12.5l4.5 4.5L19 7.5" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" />
    ) : tone === "wait" ? (
      <path d="M12 7v5l3 2" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" />
    ) : (
      <path d="M12 8v5M12 16.5v.5" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" />
    );
  return (
    <div className="ui-card ui-card--raised !p-6 sm:!p-9" data-paid-status={status} aria-live="polite">
      <div className="flex items-center gap-3">
        <span
          className={`flex h-10 w-10 flex-none items-center justify-center rounded-full ${tone === "ok" ? "bg-[#e7f5ec] text-[#1f8a4c]" : tone === "wait" ? "bg-[#eef3fb] text-[#2f5ea8]" : "bg-[#fdf3e4] text-[#9a5b00]"}`}
          aria-hidden="true"
        >
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none">{icon}</svg>
        </span>
        <p className="ui-eyebrow !mb-0">{eyebrow}</p>
      </div>
      <h1 className="ui-h2 mt-5">{title}</h1>
      {children}
    </div>
  );
}
