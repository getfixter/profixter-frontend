"use client";

import { useState } from "react";
import {
  getCommunication,
  readFailure,
  requestSmsConfirmation,
  setCommunication,
  type CommunicationKey,
  type CommunicationState,
  type ConsentMethod,
  type SwitchState,
} from "@/lib/admin-tools-service";
import { useAdminQuery } from "@/lib/admin/query";
import { customerKeys, dateTime, fetchConsent, shortDate, type ConsentRead } from "@/lib/admin/customers";
import { Button, Card, SkeletonRows, Textarea, cx } from "@/app/components/admin/ui";
import { Notice } from "./MembershipSheets";

/*
 * Messages & consent, as ONE block (audit F8): the four switches, each with
 * its evidence line, and the STOP banner above them.
 *
 * The switches use the existing communication controls exactly as before
 * (GET/PUT /api/admin/users/:id/communication, the SMS confirmation email),
 * with the same rules and the same wording as tools/CommunicationPanel:
 * - a change applies now and the customer is not told; the server records
 *   who changed it, when and why;
 * - what the customer stopped themselves (STOP from their phone, a bounce, a
 *   spam complaint) cannot be switched back on here;
 * - switching marketing SMS on asks HOW the customer agreed, and an admin
 *   switch never manufactures marketing consent: a call stays "needs
 *   confirmation" and written permission "awaits registration" until the
 *   server says it qualifies.
 * Evidence and the STOP state are read from GET /customers/:id/consent,
 * which is read only. Nothing here decides consent.
 */

const DELIVERY_LABEL: Record<string, string> = {
  marketing_email_paused: "Not sending: marketing email is paused for everyone",
  texts_off: "Not sending: texts are switched off for everyone",
  marketing_texts_off: "Not sending: offer texts are switched off for everyone",
  phone_undeliverable: "Not sending: the carrier says this number cannot receive texts",
};

const LOCK_LABEL: Record<string, string> = {
  no_phone: "No phone",
  no_email: "No email",
  stopped: "Texted STOP",
  blocked: "Bounced / spam",
  not_marketable: "Not marketable",
  excluded: "Excluded",
};

const METHODS: Array<{ key: ConsentMethod; label: string; written: boolean }> = [
  { key: "phone_call", label: "Phone call", written: false },
  { key: "customer_email", label: "Customer emailed us", written: true },
  { key: "customer_text", label: "Customer texted us", written: true },
  { key: "signed_form", label: "Signed form", written: true },
];

const SWITCH_LABEL: Record<CommunicationKey, string> = {
  "service.email": "Service email",
  "service.sms": "Service texts",
  "marketing.email": "Marketing email",
  "marketing.sms": "Marketing texts",
};

const SWITCH_HINT: Record<CommunicationKey, string> = {
  "service.email": "Confirmations, receipts, reminders",
  "service.sms": "Visit reminders and updates",
  "marketing.email": "Offers and news (unsubscribe link in each)",
  "marketing.sms": "Offer texts",
};

const words = (v: string) => v.replace(/_/g, " ");

function Toggle({ checked, onChange, label, disabled, busy, testId }: { checked: boolean; onChange: (next: boolean) => void; label: string; disabled?: boolean; busy?: boolean; testId: string }) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      aria-label={label}
      disabled={disabled || busy}
      data-switch={testId}
      onClick={() => onChange(!checked)}
      className="relative grid h-11 w-14 flex-none place-items-center disabled:cursor-not-allowed disabled:opacity-50"
    >
      <span className={cx("relative inline-flex h-7 w-12 items-center rounded-full transition-colors", checked ? "bg-adm-ok" : "bg-adm-line-2", busy && "animate-pulse")}>
        <span className={cx("inline-block h-5 w-5 rounded-full bg-adm-surface shadow transition-transform", checked ? "translate-x-6" : "translate-x-1")} />
      </span>
    </button>
  );
}

/** The evidence line under one switch: when, how and who, from the records. */
function evidenceFor(key: CommunicationKey, item: SwitchState | undefined, consent: ConsentRead | undefined): string {
  const parts: string[] = [];
  const ev = consent?.evidence;
  if (key === "service.sms" && ev?.serviceSms) {
    if (ev.serviceSms.enabled && (ev.serviceSms.at || ev.serviceSms.source)) parts.push([["Agreed", shortDate(ev.serviceSms.at)].filter(Boolean).join(" "), ev.serviceSms.source && words(ev.serviceSms.source)].filter(Boolean).join(" · "));
    else if (!ev.serviceSms.enabled && ev.serviceSms.at) parts.push(`Previously agreed ${shortDate(ev.serviceSms.at)}`);
  }
  if (key === "marketing.sms" && ev?.marketingSms) {
    const m = ev.marketingSms;
    if (m.enabled && (m.at || m.source || m.method)) {
      parts.push(
        [["Recorded", shortDate(m.at)].filter(Boolean).join(" "), m.source && words(m.source), m.method && `method: ${words(m.method)}`].filter(Boolean).join(" · ")
      );
    } else if (!m.enabled && m.at) parts.push(`Previously recorded ${shortDate(m.at)}`);
  }
  if (key === "service.email" && ev?.serviceEmail?.changedAt) parts.push(`Changed ${shortDate(ev.serviceEmail.changedAt)}${ev.serviceEmail.source ? ` · ${words(ev.serviceEmail.source)}` : ""}`);
  if (key === "marketing.email" && ev?.marketingEmail?.at) parts.push(`Recorded ${shortDate(ev.marketingEmail.at)}${ev.marketingEmail.source ? ` · ${words(ev.marketingEmail.source)}` : ""}`);
  if (!parts.length && item?.changedAt) parts.push(`Changed ${shortDate(item.changedAt)}${item.source ? ` · ${words(item.source)}` : ""}`);
  return parts.join(" ");
}

export function ConsentBlock({ customerId, canEdit }: { customerId: string; canEdit: boolean }) {
  const stateQ = useAdminQuery<CommunicationState>(["customer", customerId, "communication"], () => getCommunication(customerId), { refetchOnFocus: true });
  const consentQ = useAdminQuery(customerKeys.consent(customerId), (signal) => fetchConsent(customerId, signal));
  const state = stateQ.data;
  const consent = consentQ.data;
  const [busy, setBusy] = useState<CommunicationKey | "confirm" | null>(null);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [form, setForm] = useState<{ method: ConsentMethod; evidence: string } | null>(null);

  const toggle = async (key: CommunicationKey, enabled: boolean, how: { method?: ConsentMethod; evidence?: string } = {}) => {
    setBusy(key);
    setError("");
    setNotice("");
    try {
      const result = await setCommunication(customerId, key, enabled, how);
      stateQ.setData(result.state);
      setForm(null);
      void consentQ.refetch();
    } catch (err) {
      setError(readFailure(err).message);
    } finally {
      setBusy(null);
    }
  };

  const emailConfirmation = async () => {
    setBusy("confirm");
    setError("");
    setNotice("");
    try {
      const result = await requestSmsConfirmation(customerId);
      stateQ.setData(result.state);
      setNotice(`Confirmation request emailed to ${result.sentTo}.`);
    } catch (err) {
      setError(readFailure(err).message);
    } finally {
      setBusy(null);
    }
  };

  const row = (purpose: "service" | "marketing", channel: "email" | "sms") => {
    const key = `${purpose}.${channel}` as CommunicationKey;
    const item = state?.[purpose]?.[channel];
    const locked = item?.locked && !item.enabled ? LOCK_LABEL[item.locked] || item.locked : "";
    const notSending = item?.enabled && item.delivery && !item.delivery.sending ? DELIVERY_LABEL[item.delivery.reason || ""] || "" : "";
    const evidence = evidenceFor(key, item, consent);
    const onChange = (next: boolean) => (key === "marketing.sms" && next ? setForm({ method: "phone_call", evidence: "" }) : toggle(key, next));
    return (
      <li className="flex flex-col py-2" data-comm-row={key}>
        <div className="flex items-center justify-between gap-3">
          <div className="min-w-0">
            <div className="text-[15px] font-semibold text-adm-ink">{SWITCH_LABEL[key]}</div>
            <div className="text-[13px] text-adm-text-3">{SWITCH_HINT[key]}</div>
          </div>
          <div className="flex flex-none items-center gap-1">
            <span className={cx("text-[13px] font-semibold", item?.enabled ? (notSending ? "text-adm-attn" : "text-adm-ok") : "text-adm-text-3")} data-comm-value={key}>
              {item ? (item.enabled ? "On" : "Off") : "…"}
            </span>
            <Toggle
              checked={!!item?.enabled}
              label={SWITCH_LABEL[key]}
              testId={key}
              disabled={!state || !canEdit || (!!item?.locked && !item.enabled)}
              busy={busy === key}
              onChange={onChange}
            />
          </div>
        </div>
        {locked && <p className="text-[13px] font-semibold text-adm-attn">{locked}</p>}
        {notSending && (
          <p className="text-[13px] font-semibold text-adm-attn" data-comm-not-sending={key}>
            {notSending}
          </p>
        )}
        {evidence && (
          <p className="text-[13px] text-adm-text-2" data-comm-evidence={key}>
            {evidence}
          </p>
        )}
        {key === "marketing.sms" && methodForm()}
        {key === "marketing.sms" && consentLine()}
      </li>
    );
  };

  function methodForm() {
    if (!form) return null;
    const written = METHODS.find((m) => m.key === form.method)?.written;
    const short = written && form.evidence.trim().length < 8;
    return (
      <div className="mt-2 rounded-adm-sm bg-adm-sunk p-3" data-sms-consent-form="">
        <fieldset>
          <legend className="text-[13px] font-semibold text-adm-ink">How did the customer agree?</legend>
          <div className="mt-2 grid grid-cols-1 gap-1 sm:grid-cols-2">
            {METHODS.map((m) => (
              <label key={m.key} className="flex min-h-[44px] items-center gap-2 text-[14px] text-adm-ink">
                <input type="radio" name={`sms-consent-method-${customerId}`} value={m.key} checked={form.method === m.key} onChange={() => setForm({ ...form, method: m.key })} className="h-4 w-4" />
                {m.label}
              </label>
            ))}
          </div>
        </fieldset>
        {written ? (
          <Textarea
            className="mt-2"
            rows={3}
            aria-label="Written permission evidence"
            placeholder="When they sent it, from which email or number, and what it said"
            value={form.evidence}
            onChange={(e) => setForm({ ...form, evidence: e.target.value })}
            data-sms-consent-evidence=""
          />
        ) : (
          <p className="mt-2 text-[13px] text-adm-text-2">The call is recorded. Offer texts start once the customer confirms; you can email them the request next.</p>
        )}
        <div className="mt-2 flex justify-end gap-2">
          <Button variant="secondary" onClick={() => setForm(null)}>
            Cancel
          </Button>
          <Button disabled={short} busy={busy === "marketing.sms"} onClick={() => toggle("marketing.sms", true, { method: form.method, evidence: form.evidence })} data-action="save-sms-consent">
            Turn on
          </Button>
        </div>
      </div>
    );
  }

  /* Under marketing SMS: can offer texts actually go out, and what is missing if not (same wording as before). */
  function consentLine() {
    const sms = state?.marketing?.sms;
    const c = sms?.consent;
    if (!sms?.enabled || !c || form) return null;
    const requested = c.confirmRequestedAt ? `Request emailed ${dateTime(c.confirmRequestedAt)}.` : "";
    const actions = canEdit && (
      <div className="mt-1 flex flex-wrap gap-x-2">
        <Button variant="tertiary" className="!px-0" busy={busy === "confirm"} onClick={emailConfirmation} data-action="email-sms-confirmation">
          Email confirmation request
        </Button>
        <Button variant="tertiary" onClick={() => setForm({ method: "customer_email", evidence: "" })} data-action="add-written-consent">
          Record written permission
        </Button>
      </div>
    );
    if (c.status === "qualifies") {
      return (
        <p className="mt-1 text-[13px] font-semibold text-adm-ok" data-sms-consent="qualifies">
          Offer texts allowed: {c.basis === "customer_electronic" ? "customer's own opt-in" : "written permission on record"}.
        </p>
      );
    }
    if (c.status === "awaiting_registration") {
      return (
        <div className="mt-1 text-[13px] text-adm-attn" data-sms-consent="awaiting_registration">
          Written permission recorded. Offer texts start once the Twilio registration is updated, or sooner if the customer confirms in their account. {requested}
          {actions}
        </div>
      );
    }
    return (
      <div className="mt-1 text-[13px] text-adm-attn" data-sms-consent="needs_confirmation">
        Phone call recorded. Offer texts start when the customer confirms. {requested}
        {actions}
      </div>
    );
  }

  const stop = consent?.stop;

  return (
    <Card
      title="Messages & consent"
      action={<span className="text-[12px] text-adm-text-3">Changes apply now · customer not notified</span>}
    >
      <div data-consent-block="" data-communication-panel="" className="flex flex-col gap-3">
        {stop?.phoneOptedOut && (
          <div role="status" className="rounded-adm-sm bg-adm-problem-bg px-3 py-2.5 text-[14px] leading-snug text-adm-problem" data-stop-banner="">
            <strong className="font-semibold">STOP from this phone.</strong> It texted STOP{stop.at ? ` on ${shortDate(stop.at)}` : ""}
            {stop.scope ? ` (${words(stop.scope)})` : ""} and receives no texts of any kind, whatever the switches say. Only a START from that phone lifts it; Admin cannot.
          </div>
        )}
        {error && (
          <Notice tone="problem" role="alert">
            {error}
          </Notice>
        )}
        {notice && <Notice role="status">{notice}</Notice>}
        {stateQ.isLoading ? (
          <SkeletonRows count={4} leading={false} label="Loading message settings" />
        ) : stateQ.error && !state ? (
          <Notice tone="problem">{readFailure(stateQ.error).message || "Message settings could not be loaded."}</Notice>
        ) : (
          <div className="grid gap-4 md:grid-cols-2">
            <div>
              <h4 className="text-[13px] font-semibold uppercase tracking-[0.04em] text-adm-text-3">Service messages</h4>
              <ul className="divide-y divide-adm-line">
                {row("service", "email")}
                {row("service", "sms")}
              </ul>
            </div>
            <div>
              <h4 className="text-[13px] font-semibold uppercase tracking-[0.04em] text-adm-text-3">Marketing messages</h4>
              <ul className="divide-y divide-adm-line">
                {row("marketing", "email")}
                {row("marketing", "sms")}
              </ul>
            </div>
          </div>
        )}
      </div>
    </Card>
  );
}

/** The consent ledger (ConsentEvent): the customer's own choices and everything recorded for them. Read only. */
export function ConsentHistory({ customerId }: { customerId: string }) {
  const q = useAdminQuery(customerKeys.consent(customerId), (signal) => fetchConsent(customerId, signal));
  const [all, setAll] = useState(false);
  const items = q.data?.history || [];
  const shown = all ? items : items.slice(0, 8);
  return (
    <Card title="Consent history">
      {q.isLoading ? (
        <SkeletonRows count={3} leading={false} label="Loading consent history" />
      ) : !items.length ? (
        <p className="text-[14px] text-adm-text-3">No consent events recorded.</p>
      ) : (
        <>
          <ol className="flex flex-col divide-y divide-adm-line" data-consent-history="">
            {shown.map((e) => (
              <li key={e.id} className="py-2">
                <div className="flex flex-wrap items-baseline justify-between gap-x-3">
                  <span className="text-[14px] font-semibold text-adm-ink">
                    {[e.purpose, e.channel].filter(Boolean).map(words).join(" ")} · {words(e.action)}
                  </span>
                  <time className="adm-num text-[13px] text-adm-text-3">{dateTime(e.at)}</time>
                </div>
                <p className="text-[13px] text-adm-text-2">
                  {[e.source && words(e.source), e.method && `method: ${words(e.method)}`, e.recordedByName && `recorded by ${e.recordedByName}`].filter(Boolean).join(" · ")}
                </p>
                {e.evidence && <p className="text-[13px] text-adm-text-2">Evidence: {e.evidence}</p>}
                {e.consentText && <p className="text-[13px] italic text-adm-text-3">“{e.consentText}”</p>}
              </li>
            ))}
          </ol>
          {items.length > 8 && (
            <Button variant="tertiary" onClick={() => setAll(!all)}>
              {all ? "Show fewer" : `Show all ${items.length}`}
            </Button>
          )}
        </>
      )}
    </Card>
  );
}
