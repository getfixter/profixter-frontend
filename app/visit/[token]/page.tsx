"use client";

/*
 * profixter.com/visit/<token>: the private link a guest gets by email after
 * paying for a One-Time Visit or a Full Day with no account (BackEnd
 * utils/guestVisitLink). It shows that one visit and where it stands, and
 * lets them ask for it to be cancelled.
 *
 * Asking is a request, by our existing rule for paid visits: staff cancel it
 * (which frees the time) and settle any refund in Stripe. The page says so,
 * before and after the request. No trackers run here (lib/tracking-scope).
 */

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { useParams } from "next/navigation";
import Header from "@/app/components/sections/Header";

const API_BASE = process.env.NEXT_PUBLIC_API_URL || "";
const PHONE = "631-599-1363";

type Visit = {
  kind: "one_time" | "full_day";
  state: "pending_approval" | "confirmed" | "completed" | "canceled" | "payment_not_recorded";
  bookingNumber: string;
  date: string;
  time: string | null;
  name: string;
  address: string;
  job: string;
  paid: boolean;
  cancellationRequestedAt: string | null;
  canRequestCancellation: boolean;
  phone: string;
};

const STATE_LABEL: Record<Visit["state"], string> = {
  pending_approval: "Paid - waiting for our approval",
  confirmed: "Confirmed",
  completed: "Completed",
  canceled: "Canceled",
  payment_not_recorded: "Payment not recorded yet",
};

function whenLabel(v: Visit) {
  const [y, m, d] = v.date.split("-").map(Number);
  const day = new Date(Date.UTC(y, m - 1, d, 12)).toLocaleDateString("en-US", { weekday: "long", month: "long", day: "numeric", timeZone: "UTC" });
  if (!v.time) return `${day} (all day)`;
  const [hh, mm] = v.time.split(":").map(Number);
  return `${day} at ${hh % 12 || 12}:${String(mm).padStart(2, "0")} ${hh >= 12 ? "PM" : "AM"}`;
}

export default function GuestVisitPage() {
  const params = useParams<{ token: string }>();
  const token = String(params?.token || "");
  const [visit, setVisit] = useState<Visit | null>(null);
  const [missing, setMissing] = useState(false);
  const [asking, setAsking] = useState(false);
  const [reason, setReason] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  const load = useCallback(async () => {
    try {
      const res = await fetch(`${API_BASE}/api/bookings/guest/visit/${encodeURIComponent(token)}`, { cache: "no-store" });
      if (!res.ok) {
        setMissing(true);
        return;
      }
      setVisit((await res.json()) as Visit);
    } catch {
      setError("We couldn't load your visit. Check your connection and try again.");
    }
  }, [token]);

  useEffect(() => {
    let alive = true;
    (async () => {
      if (alive) await load();
    })();
    return () => {
      alive = false;
    };
  }, [load]);

  const requestCancel = async () => {
    if (busy) return;
    setBusy(true);
    setError("");
    try {
      const res = await fetch(`${API_BASE}/api/bookings/guest/visit/${encodeURIComponent(token)}/cancel-request`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ reason: reason.trim() }),
      });
      const body = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(body.message || `Please call or text ${PHONE}.`);
        return;
      }
      setVisit(body as Visit);
      setAsking(false);
    } catch {
      setError("We couldn't send that. Check your connection and try again.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <main className="min-h-screen bg-[color:var(--ui-bg-soft)] text-[color:var(--ui-ink)]">
      <Header />
      <section className="ui-section ui-section--tight">
        <div className="ui-container ui-container--narrow">
          <div className="ui-card ui-card--raised !p-6 sm:!p-9" data-guest-visit={visit?.state || (missing ? "missing" : "loading")}>
            {missing ? (
              <>
                <h1 className="ui-h2">This link isn&apos;t valid any more</h1>
                <p className="ui-body mt-3">
                  Call or text <a href={`tel:${PHONE}`} className="font-semibold text-[color:var(--ui-accent-ink)]">{PHONE}</a> and we&apos;ll help with your visit.
                </p>
              </>
            ) : !visit ? (
              <p className="ui-body" aria-busy="true">{error || "Loading your visit…"}</p>
            ) : (
              <>
                <p className="ui-eyebrow !mb-0">{visit.kind === "full_day" ? "Full Day Fixter" : "One-Time Visit"} · #{visit.bookingNumber}</p>
                <h1 className="ui-h2 mt-3">{STATE_LABEL[visit.state]}</h1>
                <dl className="mt-5 grid gap-0 border-t border-[color:var(--ui-line)] text-[15px]">
                  {[
                    ["When", whenLabel(visit)],
                    ["Where", visit.address],
                    ["Job", visit.job],
                    ["Payment", visit.paid ? "Paid" : "Not recorded yet"],
                  ].map(([k, v]) => (
                    <div key={k} className="flex justify-between gap-4 border-b border-[color:var(--ui-line)] py-2.5">
                      <dt className="flex-none text-[color:var(--ui-text-3)]">{k}</dt>
                      <dd className="text-right font-medium" data-fact={k.toLowerCase()}>{v}</dd>
                    </div>
                  ))}
                </dl>

                {visit.cancellationRequestedAt && visit.state !== "canceled" ? (
                  <p className="mt-4 rounded-[var(--ui-r-sm)] bg-[#fdf3e4] px-4 py-3 text-[14px] leading-[1.55] text-[#7a4a00]" data-cancel-requested>
                    We received your cancellation request. Our team will contact you to confirm it and any refund. Until then the visit is still booked.
                  </p>
                ) : null}
                {visit.state === "canceled" ? (
                  <p className="mt-4 text-[14px] leading-[1.55] text-[color:var(--ui-text-2)]">
                    This visit is canceled. Refund questions: call or text <a href={`tel:${PHONE}`} className="font-semibold">{PHONE}</a>.
                  </p>
                ) : null}

                {visit.canRequestCancellation ? (
                  asking ? (
                    <div className="mt-5" data-cancel-form>
                      <p className="text-[14px] leading-[1.55] text-[color:var(--ui-text-2)]">
                        Paid visits are canceled by our team: we&apos;ll contact you to confirm, free the time, and arrange any refund. If we cancel before
                        service, you receive a full refund.
                      </p>
                      <label className="mt-3 block text-[14px] font-medium" htmlFor="cancel-reason">
                        Reason <span className="text-[color:var(--ui-text-3)]">(optional)</span>
                      </label>
                      <textarea id="cancel-reason" className="pg-input mt-1 min-h-[80px]" maxLength={500} value={reason} onChange={(e) => setReason(e.target.value)} data-clarity-mask="true" />
                      <div className="pg-actions pg-actions--stack">
                        <button type="button" className="ui-btn ui-btn--primary" onClick={requestCancel} disabled={busy} data-action="send-cancel-request">
                          {busy ? "Sending…" : "Send cancellation request"}
                        </button>
                        <button type="button" className="ui-btn ui-btn--secondary" onClick={() => setAsking(false)} disabled={busy}>
                          Keep my visit
                        </button>
                      </div>
                    </div>
                  ) : (
                    <div className="pg-actions pg-actions--stack">
                      <button type="button" className="ui-btn ui-btn--secondary" onClick={() => setAsking(true)} data-action="ask-to-cancel">
                        Ask to cancel this visit
                      </button>
                    </div>
                  )
                ) : null}
                {error ? <p className="pg-error mt-3">{error}</p> : null}

                <p className="mt-5 text-[14px] text-[color:var(--ui-text-3)]">
                  To reschedule or ask anything, call or text <a href={`tel:${PHONE}`} className="font-semibold text-[color:var(--ui-accent-ink)]">{PHONE}</a>. Want to see all
                  your visits? <Link href={`/signup?next=${encodeURIComponent("/book#your-visits")}`} className="font-semibold">Create an account</Link> with the same
                  phone or email.
                </p>
              </>
            )}
          </div>
        </div>
      </section>
    </main>
  );
}
