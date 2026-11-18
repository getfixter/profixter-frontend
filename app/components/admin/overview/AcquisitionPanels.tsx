"use client";

/**
 * Customer Acquisition: what Meta reports, what Profixter recorded, and what
 * it cost - kept apart, each labelled with its source, its days and what it
 * counts (2026-11-17 audit).
 *
 * THE RULES ON THIS SCREEN
 * - A number Meta reports and a number Profixter recorded are never in the
 *   same cell. Meta's are under "Reported by Meta"; ours under "Recorded by
 *   Profixter".
 * - Not connected, not measured yet, stale, and a true zero look different:
 *   "Not connected" / "Not measured" / an amber "stale" note / 0.
 * - Every rate names its numerator and denominator ("13 of 585").
 * - A cost is shown only when its spend and its count are both known.
 */

import { useState } from "react";
import { money, num, type MetaEventKind, type Overview, type SourceGroup } from "@/lib/admin-overview";

const box = "rounded-adm-md border border-adm-line p-4";
const pillTone = {
  ok: "bg-adm-sunk text-adm-text-2",
  off: "bg-adm-attn-bg text-adm-attn",
  stale: "bg-adm-attn-bg text-adm-attn",
} as const;

function Pill({ tone, children }: { tone: keyof typeof pillTone; children: React.ReactNode }) {
  return <span className={`inline-flex rounded-full px-2 py-0.5 text-[12px] font-semibold ${pillTone[tone]}`}>{children}</span>;
}

function Tile({ label, value, note, title }: { label: string; value: string; note?: string; title?: string }) {
  return (
    <div className="min-w-0" title={title}>
      <div className="text-[12px] font-semibold uppercase tracking-[0.08em] text-adm-text-3">{label}</div>
      <div className={`mt-1 text-[22px] font-semibold tabular-nums ${value === "—" || value.startsWith("Not") ? "text-adm-text-3 text-[15px]" : "text-adm-ink"}`}>{value}</div>
      {note ? <div className="mt-0.5 text-[12px] leading-4 text-adm-text-3">{note}</div> : null}
    </div>
  );
}

const ymd = (s?: string | null) => {
  if (!s) return "";
  const [y, m, d] = s.split("-").map(Number);
  return new Date(Date.UTC(y, m - 1, d)).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric", timeZone: "UTC" });
};
const when = (iso?: string | null) =>
  iso ? new Date(iso).toLocaleString("en-US", { month: "short", day: "numeric", hour: "numeric", minute: "2-digit", timeZone: "America/New_York" }) + " ET" : "";

const SPEND_STATUS_TEXT: Record<string, string> = {
  not_configured: "No Meta Ads reporting token is configured.",
  disabled: "Meta Ads reporting is not switched on.",
  never_run: "Meta Ads reporting is switched on but has not synced yet.",
  token_missing: "Meta Ads reporting is switched on but no access token is configured.",
  token_invalid: "The Meta access token is no longer valid.",
  token_missing_ads_read: "The Meta token cannot read the ad account (it lacks ads_read).",
  rate_limited: "Meta is rate-limiting reads; the next sync retries.",
  meta_unavailable: "Meta's API was unavailable at the last sync; it retries.",
  error: "Meta reporting could not be read.",
};

/* ------------------------------------------------------------------ */
/* Reported by Meta                                                    */
/* ------------------------------------------------------------------ */

export function MetaReportedPanel({ o }: { o: Overview }) {
  const s = o.spend;
  const r = s.reported || null;
  const d = o.definitions || {};
  if (!s.connected) {
    return (
      <section className={box} data-meta-reported="disconnected">
        <div className="flex flex-wrap items-center gap-2">
          <h3 className="text-[14px] font-semibold text-adm-ink">Reported by Meta Ads Manager</h3>
          <Pill tone="off">Not connected</Pill>
        </div>
        <p className="mt-2 text-[13px] leading-5 text-adm-text-2">
          {SPEND_STATUS_TEXT[s.status || "not_configured"] || SPEND_STATUS_TEXT.not_configured} Spend, outbound clicks, landing page views and Meta&apos;s
          website leads are not shown, and nothing here is estimated in their place. Connecting needs a read-only token with <b>ads_read</b> on the ad
          account, stored as META_ADS_ACCESS_TOKEN; Profixter then reads Meta every six hours and never changes the ads.
        </p>
      </section>
    );
  }
  const tzNote = s.accountTimezone && s.accountTimezone !== "America/New_York" ? `Meta's days are in ${s.accountTimezone}; Profixter's in New York.` : "Meta's days and Profixter's are both New York days.";
  return (
    <section className={box} data-meta-reported="connected">
      <div className="flex flex-wrap items-center gap-2">
        <h3 className="text-[14px] font-semibold text-adm-ink">Reported by Meta Ads Manager</h3>
        {s.stale ? <Pill tone="stale">Stale · last synced {when(s.lastSuccessAt)}</Pill> : <Pill tone="ok">Synced {when(s.lastSuccessAt)}</Pill>}
        {s.partial ? <Pill tone="stale">Synced only from {ymd(s.coverageFromYmd)}</Pill> : null}
      </div>
      <div className="mt-3 grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-6">
        <Tile label="Spend" value={money(s.totalCents ?? null)} title={d.spend} />
        <Tile label="Outbound clicks" value={r?.outboundClicks == null ? "Not reported" : num(r.outboundClicks)} note={r?.outboundClicks == null ? "not in rows synced before Nov 17" : undefined} title={d.outboundClicks} />
        <Tile label="Landing page views" value={r ? num(r.landingPageViews) : "—"} title={d.landingPageViews} />
        <Tile label="Website leads" value={r ? num(r.websiteLeads) : "—"} title={d.websiteLeads} />
        <Tile label="Subscriptions" value={r ? num(r.websiteSubscribes) : "—"} note="membership started" />
        <Tile label="Purchases" value={r ? num(r.websitePurchases) : "—"} note="paid one-time visits" />
      </div>
      <p className="mt-3 text-[12px] leading-5 text-adm-text-3">
        {d.metaReported} {tzNote} Attribution: {s.attributionSettings?.length ? s.attributionSettings.join(", ") : "as set on each ad (Meta did not say)"}. Meta counts
        every Lead event, so one person who registers and books a free visit is two website leads. A zero here is Meta reporting none.
      </p>
    </section>
  );
}

/* ------------------------------------------------------------------ */
/* Recorded by Profixter: the funnel                                   */
/* ------------------------------------------------------------------ */

type Step = { label: string; meta: number | null; all: number | null; note?: string; def?: string };

function rate(n: number | null, d: number | null) {
  if (n === null || d === null || !(d > 0)) return null;
  return `${Math.round((n / d) * 1000) / 10}%`;
}

export function AcquisitionFunnelPanel({ o }: { o: Overview }) {
  const f = o.funnel;
  const g: SourceGroup | undefined = (o.sourceGroups || []).find((x) => x.key === "meta");
  const st = f.steps || {};
  const d = o.definitions || {};
  const step = (key: string, label: string, def?: string): Step => {
    const s = st[key];
    if (!s || !s.measured) return { label, meta: null, all: null, note: "Not measured in this period", def };
    return { label, meta: s.meta, all: s.all, note: s.partial ? `measured from ${ymd(s.measuredFromYmd)}` : undefined, def };
  };
  const visitorsNote = f.visitors === null ? "Not measured: before visitor tracking began" : f.visitorsPartial && f.visitorsTrackingSince ? `counting from ${when(f.visitorsTrackingSince)}` : undefined;
  const steps: Step[] = [
    { label: "Visitors (new browsers)", meta: f.visitors === null ? null : g?.visitors ?? 0, all: f.visitors, note: visitorsNote, def: d.visitors },
    step("booking_page_view", "Booking form shown", "A browser was shown the free-visit booker (once per browser per day)."),
    step("booker_started", "Form started", "A browser typed into or tapped the booker (once per browser per day)."),
    step("slot_selected", "Time chosen", "A day and time were chosen (once per browser per day)."),
    step("request_submitted", "Submitted", "The server accepted a free-visit request (once per browser per day)."),
    { label: "Inquiries", meta: g?.inquiries ?? 0, all: f.inquiries, def: d.inquiries },
    { label: "Confirmed", meta: g?.confirmed ?? 0, all: f.confirmed, def: d.confirmed },
    { label: "Completed visits", meta: g?.completedVisits ?? 0, all: f.completed, def: d.completedVisits },
    { label: "New paying customers", meta: g?.newPayingCustomers ?? 0, all: f.newPayingCustomers, def: d.newPayingCustomers },
  ];
  const failed = st.request_failed;
  const cell = (v: number | null, prev: Step | null, pick: "meta" | "all") => {
    const pv = prev ? prev[pick] : null;
    const rt = rate(v, pv);
    return (
      <td className="px-2 py-2 text-right align-top">
        <div className={`text-[15px] font-semibold tabular-nums ${v === null ? "text-adm-text-3" : "text-adm-ink"}`}>{v === null ? "—" : num(v)}</div>
        {prev && rt ? (
          <div className="text-[11px] leading-4 text-adm-text-3">
            {rt} of {prev.label.toLowerCase()} ({num(v)} of {num(pv)})
          </div>
        ) : null}
      </td>
    );
  };
  return (
    <section className={box} data-acquisition-funnel>
      <div className="flex flex-wrap items-center gap-2">
        <h3 className="text-[14px] font-semibold text-adm-ink">Recorded by Profixter</h3>
        <span className="text-[12px] text-adm-text-3">
          {o.period.label} · {o.period.fromYmd} to {o.period.toYmd} · New York days · first-touch source
        </span>
      </div>
      <div className="-mx-2 mt-2 overflow-x-auto">
        <table className="w-full min-w-[520px] text-left">
          <thead>
            <tr className="text-[12px] font-semibold uppercase tracking-[0.08em] text-adm-text-3">
              <th className="px-2 pb-1">Step</th>
              <th className="px-2 pb-1 text-right">Meta Ads</th>
              <th className="px-2 pb-1 text-right">All sources</th>
            </tr>
          </thead>
          <tbody>
            {steps.map((s, i) => {
              // A rate only against the nearest earlier step that was measured.
              let prev: Step | null = null;
              for (let j = i - 1; j >= 0; j--) if (steps[j].all !== null) {
                prev = steps[j];
                break;
              }
              return (
                <tr key={s.label} className="border-t border-adm-line" title={s.def}>
                  <td className="px-2 py-2 align-top">
                    <div className="text-[13px] font-semibold text-adm-text-2">{s.label}</div>
                    {s.note ? <div className="text-[11px] leading-4 text-adm-text-3">{s.note}</div> : null}
                  </td>
                  {cell(s.meta, prev, "meta")}
                  {cell(s.all, prev, "all")}
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
      <p className="mt-2 text-[12px] leading-5 text-adm-text-3">
        Inquiries = guest free-visit requests ({num(f.freeVisitRequests)} in all) plus first free visits booked by accounts; Confirmed and Completed are those
        inquiries as they stand today. Form steps count each browser once a day, so a returning browser can be counted again.
        {failed?.measured ? ` Submissions refused or not delivered: ${num(failed.all)} (Meta Ads ${num(failed.meta)}).` : " Failed submissions are recorded from this release on."}
        {f.staffPagesExcluded ? ` ${num(f.staffPagesExcluded)} first visits to staff pages are left out.` : ""}
      </p>
    </section>
  );
}

/* ------------------------------------------------------------------ */
/* Cost                                                                */
/* ------------------------------------------------------------------ */

export function AcquisitionCostPanel({ o, canSetFee, onSaved }: { o: Overview; canSetFee: boolean; onSaved: () => void }) {
  const e = o.metaEfficiency;
  const [month, setMonth] = useState("");
  const [dollars, setDollars] = useState("");
  const [state, setState] = useState<"idle" | "saving" | "error">("idle");
  const [message, setMessage] = useState("");
  if (!e) return null;
  const noSpend = e.spendCents === null;
  const costNote = (count: number) => (noSpend ? "needs Meta spend" : count > 0 ? undefined : "none in this period");
  const fee = e.agencyFee;
  const missing = fee?.missingMonths || [];
  const save = async () => {
    const m = month || missing[0];
    const cents = Math.round(Number(dollars) * 100);
    if (!m || !Number.isFinite(cents) || cents < 0) {
      setState("error");
      setMessage("Enter the fee in dollars.");
      return;
    }
    setState("saving");
    try {
      const { setAgencyFee } = await import("@/lib/admin-overview");
      await setAgencyFee(m, cents);
      setState("idle");
      setDollars("");
      onSaved();
    } catch (err) {
      setState("error");
      const status = (err as { response?: { status?: number } })?.response?.status;
      setMessage(status === 403 ? "Only the owner can set the agency fee." : "The fee could not be saved. Try again.");
    }
  };
  return (
    <section className={box} data-acquisition-cost>
      <h3 className="text-[14px] font-semibold text-adm-ink">Cost of Meta Ads</h3>
      <div className="mt-3 grid grid-cols-2 gap-4 lg:grid-cols-4">
        <Tile label="Per inquiry" value={money(e.costPerInquiryCents)} note={costNote(e.inquiries) || `Meta spend ÷ ${num(e.inquiries)} inquiries`} />
        <Tile label="Per confirmed booking" value={money(e.costPerConfirmedBookingCents)} note={costNote(e.confirmed) || `Meta spend ÷ ${num(e.confirmed)} confirmed`} />
        <Tile label="Per new paying customer" value={money(e.costPerNewPayingCustomerCents)} note={costNote(e.newPayingCustomers) || `Meta spend ÷ ${num(e.newPayingCustomers)} new paying`} />
        <Tile
          label="Return on ad spend"
          value={e.firstPaymentRoas === null ? "—" : `${e.firstPaymentRoas.toFixed(2)}×`}
          note={noSpend ? "needs Meta spend" : `first payments ${money(e.firstPaymentRevenueCents)} ÷ Meta spend`}
        />
      </div>
      <div className="mt-4 border-t border-adm-line pt-3">
        {fee?.known ? (
          <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
            <Tile label="Agency fee" value={money(fee.cents)} note={(fee.breakdown || []).map((b) => `${b.month}: ${b.days}/${b.daysInMonth} days of ${money(b.monthCents)}`).join("; ")} />
            <Tile label="All-in cost" value={money(e.allInCostCents)} note={noSpend ? "needs Meta spend" : "Meta spend + agency fee"} />
            <Tile label="All-in per new paying customer" value={money(e.allInCostPerNewPayingCustomerCents)} note={noSpend ? "needs Meta spend" : e.newPayingCustomers ? undefined : "none in this period"} />
          </div>
        ) : (
          <div className="text-[13px] leading-5 text-adm-text-2">
            <b>Agency fee not on record</b>
            {missing.length ? ` for ${missing.join(", ")}` : ""}, so no all-in cost is shown.
            {canSetFee && missing.length ? (
              <div className="mt-2 flex flex-wrap items-center gap-2">
                <select value={month || missing[0]} onChange={(ev) => setMonth(ev.target.value)} className="min-h-11 rounded-adm-sm border border-adm-line bg-adm-surface px-2 text-[14px]" aria-label="Month">
                  {missing.map((m) => (
                    <option key={m} value={m}>
                      {m}
                    </option>
                  ))}
                </select>
                <label className="flex items-center gap-1 text-[14px]">
                  $
                  <input
                    inputMode="decimal"
                    value={dollars}
                    onChange={(ev) => setDollars(ev.target.value.replace(/[^0-9.]/g, ""))}
                    placeholder="Monthly fee"
                    className="min-h-11 w-32 rounded-adm-sm border border-adm-line bg-adm-surface px-2 tabular-nums"
                    aria-label="Agency fee for the month, in dollars"
                  />
                </label>
                <button type="button" onClick={save} disabled={state === "saving"} className="min-h-11 rounded-adm-sm bg-adm-accent px-4 text-[14px] font-semibold text-white disabled:opacity-60">
                  {state === "saving" ? "Saving…" : "Save fee"}
                </button>
                {state === "error" ? <span className="text-[13px] text-adm-attn">{message}</span> : null}
              </div>
            ) : null}
          </div>
        )}
      </div>
    </section>
  );
}

/* ------------------------------------------------------------------ */
/* What Profixter sent to Meta                                          */
/* ------------------------------------------------------------------ */

const KIND_LABEL: Record<string, string> = {
  "Lead|account": "Lead · account created",
  "Lead|free_visit_request": "Lead · free-visit request (no account)",
  "Lead|free_visit_legacy": "Lead · free visit booked by an account",
  "Lead|renovation_estimate": "Lead · estimate form",
  "Lead|community_partnership": "Lead · community form",
  "Schedule|": "Schedule · free visit booked",
  "Subscribe|": "Subscribe · membership paid",
  "Purchase|": "Purchase · paid visit or gift",
};

export function MetaEventsPanel({ o }: { o: Overview }) {
  const ev = o.metaEvents;
  if (!ev) return null;
  const label = (e: MetaEventKind) => KIND_LABEL[`${e.eventName}|${e.leadType || ""}`] || `${e.eventName}${e.leadType ? ` · ${e.leadType}` : ""}`;
  return (
    <section className={box} data-meta-events>
      <div className="flex flex-wrap items-center gap-2">
        <h3 className="text-[14px] font-semibold text-adm-ink">Events Profixter sent to Meta</h3>
        {!ev.measured ? <Pill tone="off">Not measured</Pill> : ev.partial ? <Pill tone="stale">from {when(ev.measuredFrom)}</Pill> : null}
      </div>
      {!ev.measured ? (
        <p className="mt-2 text-[13px] leading-5 text-adm-text-2">
          Profixter starts keeping a record of every Conversions API event with this release. Before it, only an hourly log line existed, so past periods
          cannot be matched event by event.
        </p>
      ) : ev.events.length ? (
        <div className="-mx-2 mt-2 overflow-x-auto">
          <table className="w-full min-w-[480px] text-left">
            <thead>
              <tr className="text-[12px] font-semibold uppercase tracking-[0.08em] text-adm-text-3">
                <th className="px-2 pb-1">Event</th>
                <th className="px-2 pb-1 text-right">Sent</th>
                <th className="px-2 pb-1 text-right">From server</th>
                <th className="px-2 pb-1 text-right">Relayed from page</th>
                <th className="px-2 pb-1 text-right">Not sent</th>
              </tr>
            </thead>
            <tbody>
              {ev.events.map((e) => (
                <tr key={`${e.eventName}|${e.leadType}`} className="border-t border-adm-line text-[13px]">
                  <td className="px-2 py-2 font-semibold text-adm-text-2">{label(e)}</td>
                  <td className="px-2 py-2 text-right tabular-nums text-adm-ink">{num(e.sent)}</td>
                  <td className="px-2 py-2 text-right tabular-nums">{num(e.fromServer)}</td>
                  <td className="px-2 py-2 text-right tabular-nums">{num(e.fromBrowserRelay)}</td>
                  <td className="px-2 py-2 text-right tabular-nums">{num(e.failed)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        <p className="mt-2 text-[13px] text-adm-text-2">None in this period.</p>
      )}
      <p className="mt-2 text-[12px] leading-5 text-adm-text-3">
        All traffic, not only Meta&apos;s: Meta decides which of these it attributes to an ad. The browser pixel sends the same events with the same ids, and
        Meta keeps one of each pair.
      </p>
    </section>
  );
}
