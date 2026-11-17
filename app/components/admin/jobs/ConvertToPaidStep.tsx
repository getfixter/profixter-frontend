"use client";

/**
 * Convert to paid visit (job sheet step): a free visit becomes a membership or
 * One-Time visit once the customer pays a secure link themselves.
 *
 * Make the link (nothing is sent), copy it or Send it by email/text (each
 * once), and follow it: checkout pending, paid and converted, or needs
 * attention (retry, with an explicit seven-day override where that is the
 * reason, or close after settling the payment: ConversionPaymentPanel), and a
 * converted visit canceled afterwards, whose payment - and membership - wait
 * for Admin's decision. The visit stays exactly as
 * it is until Stripe confirms the payment. Every rule is the server's
 * (utils/freeVisit/conversion.js); this only collects and shows.
 */
import { ArrowPathIcon, CheckCircleIcon, ClipboardDocumentIcon, ExclamationTriangleIcon, PaperAirplaneIcon } from "@heroicons/react/24/outline";
import { useCallback, useEffect, useMemo, useState, type ReactNode } from "react";
import { createPortal } from "react-dom";
import { errorCode, errorMessage, invalidateQueries } from "@/lib/admin/query";
import { jobKeys, refreshJobLists, type JobDetail } from "@/lib/admin/jobs";
import { ConversionPaymentPanel } from "@/app/components/admin/jobs/ConversionPaymentPanel";
import {
  cancelConversionLink,
  conversionStatusText,
  createConversionLink,
  deliveryWords,
  fetchConversionOptions,
  money,
  retryConversion,
  sendConversionLink,
  type Conversion,
  type ConversionKind,
  type ConversionOptions,
  type CreateConversion,
} from "@/lib/admin/visitConversion";
import { writeToClipboard } from "@/lib/utils/clipboard";
import { Button, Field, Select, SkeletonRows, StatusBadge, TextInput, Textarea, cx, useToast } from "@/app/components/admin/ui";

type Props = {
  job: JobDetail;
  footer: HTMLElement | null;
  onBack: () => void;
  setBusy: (busy: boolean) => void;
  setDirty: (dirty: boolean) => void;
  /** The caller may link, create or add a home to customer accounts (Customers section). */
  canCreateAccounts: boolean;
};

function Footer({ el, children }: { el: HTMLElement | null; children: ReactNode }) {
  return el ? createPortal(children, el) : null;
}

function Problem({ children, code }: { children: ReactNode; code?: string }) {
  return (
    <div role="alert" className="flex items-start gap-2 rounded-adm-sm bg-adm-problem-bg px-3 py-2.5 text-[14px] text-adm-problem" data-convert-error={code || "error"}>
      <ExclamationTriangleIcon className="mt-0.5 h-5 w-5 flex-none" aria-hidden="true" />
      <div>{children}</div>
    </div>
  );
}

function Note({ children, tone = "info", ...rest }: { children: ReactNode; tone?: "info" | "ok" | "warn" } & Record<`data-${string}`, string>) {
  return (
    <div
      className={cx(
        "rounded-adm-sm px-3 py-2.5 text-[14px]",
        tone === "ok" ? "bg-adm-ok-bg text-adm-ok" : tone === "warn" ? "bg-adm-attn-bg text-adm-ink" : "bg-adm-surface-2 text-adm-ink"
      )}
      {...rest}
    >
      {children}
    </div>
  );
}

function when(iso: string | null | undefined) {
  if (!iso) return "";
  return new Date(iso).toLocaleString("en-US", { timeZone: "America/New_York", weekday: "short", month: "short", day: "numeric", hour: "numeric", minute: "2-digit" });
}

const RULE_TEXT: Record<string, string> = {
  none: "The visit is 7 or more days away, so the member seven-day rule is met.",
  first_visit_exemption: "A new membership's first visit: the seven-day rule does not apply (the existing first-visit rule).",
  admin_override: "Seven-day rule overridden",
};

const EVENT_TEXT: Record<string, string> = {
  link_created: "Link made",
  customer_started: "Customer started the upgrade from their account",
  link_sent: "Link sent",
  account_linked: "Visit's account chosen",
  account_created: "Account created",
  home_added_to_account: "Home added to the account",
  lead_time_overridden: "Seven-day rule overridden",
  lead_time_rule_changed: "Seven-day rule re-checked",
  terms_accepted: "Customer accepted the terms",
  checkout_opened: "Customer opened the Stripe page",
  checkout_expired: "Stripe page expired unpaid",
  checkout_refused: "Checkout refused",
  paid: "Paid",
  converted: "Visit converted",
  needs_attention: "Needs attention",
  retry_requested: "Retry",
  replaced: "Replaced by a newer link",
  canceled: "Link withdrawn",
  expired: "Link expired",
  closed: "Closed",
  visit_canceled_after_payment: "Visit canceled after it was paid",
  payment_resolved: "Payment decision recorded",
};

const RESOLUTION_TEXT: Record<string, string> = {
  refunded: "Refunded in Stripe",
  kept: "Payment kept",
  membership_canceled: "Membership canceled",
  membership_kept: "The customer kept the membership",
  visit_reinstated: "The visit was reinstated",
};

export function ConvertToPaidStep({ job, footer, onBack, setBusy, setDirty, canCreateAccounts }: Props) {
  const toast = useToast();
  const [options, setOptions] = useState<ConversionOptions | null>(null);
  const [loadError, setLoadError] = useState("");
  const [error, setError] = useState<{ code: string; message: string } | null>(null);
  const [busy, setLocalBusy] = useState<"" | "create" | "send" | "cancel" | "retry">("");
  /* The link as it was made in this sheet: the only time the server returns it. */
  const [made, setMade] = useState<{ conversionId: string; payUrl: string; token: string } | null>(null);
  const [making, setMaking] = useState(false);

  const [kind, setKind] = useState<ConversionKind>("membership");
  const [plan, setPlan] = useState("basic");
  const [cycle, setCycle] = useState<"monthly" | "annual">("monthly");
  const [task, setTask] = useState("");
  const [accountChoice, setAccountChoice] = useState("");
  const [names, setNames] = useState({ firstName: "", lastName: "" });
  const [sharedPhone, setSharedPhone] = useState(false);
  const [samePerson, setSamePerson] = useState(false);
  const [acceptCurrent, setAcceptCurrent] = useState(false);
  const [override, setOverride] = useState(false);
  const [overrideReason, setOverrideReason] = useState("");
  const [channels, setChannels] = useState<("email" | "sms")[]>(["email", "sms"]);
  const [retryReason, setRetryReason] = useState("");

  const bookingId = job.id;
  const load = useCallback(async () => {
    setLoadError("");
    try {
      const next = await fetchConversionOptions(bookingId);
      setOptions(next);
      return next;
    } catch (e) {
      setLoadError(errorMessage(e));
      return null;
    }
  }, [bookingId]);

  useEffect(() => {
    void load().then((o) => {
      if (!o) return;
      const t = o.booking.selectedTask && !/^free\s*(first\s*)?visit/i.test(o.booking.selectedTask) ? o.booking.selectedTask : "";
      setTask(t);
      const [first, ...rest] = String(o.booking.name || "").trim().split(/\s+/);
      setNames({ firstName: first || "", lastName: rest.join(" ") });
      if (!o.offers.oneTime.enabled) setKind("membership");
      if (o.account.mode === "guest") {
        const byEmail = o.account.candidates.find((c) => c.matchedOn.includes("email"));
        setAccountChoice(!canCreateAccounts ? "" : byEmail ? byEmail.id : o.account.candidates.length ? "" : "create");
      }
      setMaking(!o.current && o.convertible);
    });
  }, [load, canCreateAccounts]);

  useEffect(() => {
    setBusy(Boolean(busy));
  }, [busy, setBusy]);
  useEffect(() => {
    setDirty(making && Boolean(task || overrideReason));
  }, [making, task, overrideReason, setDirty]);

  const refreshJob = useCallback(() => {
    invalidateQueries(jobKeys.detail(bookingId));
    refreshJobLists();
  }, [bookingId]);

  const run = async (what: typeof busy, fn: () => Promise<void>) => {
    setLocalBusy(what);
    setError(null);
    try {
      await fn();
    } catch (e) {
      setError({ code: errorCode(e) || "error", message: errorMessage(e) });
    } finally {
      setLocalBusy("");
    }
  };

  const current = options?.current || null;
  const plans = options?.offers.membership.plans || [];
  const chosenPlan = plans.find((p) => p.key === plan);
  const membershipPrice = chosenPlan ? (cycle === "annual" ? `$${chosenPlan.annual} a year` : `$${chosenPlan.monthly} a month`) : "";
  const lead = options?.leadTime;
  const needsOverride = kind === "membership" && Boolean(lead?.insideMemberLeadTime) && (options?.account.mode === "booking" ? !lead?.exemptionEligible : false);
  const guestOverrideMaybe = kind === "membership" && Boolean(lead?.insideMemberLeadTime) && options?.account.mode === "guest" && accountChoice !== "create" && accountChoice !== "";

  const body = useMemo<CreateConversion>(() => {
    const out: CreateConversion = { kind, task: task.trim() };
    if (kind === "membership") {
      out.plan = plan;
      out.billingCycle = cycle;
      if (options?.account.mode === "guest") {
        out.account = accountChoice === "create" ? { mode: "create", ...names, allowSharedPhone: sharedPhone } : { mode: "link", userId: accountChoice, ...(samePerson ? { confirmDifferentEmail: true } : {}) };
      }
      if (override && overrideReason.trim()) out.overrideLeadTimeReason = overrideReason.trim();
    }
    return out;
  }, [kind, task, plan, cycle, options, accountChoice, names, sharedPhone, samePerson, override, overrideReason]);

  const create = () =>
    run("create", async () => {
      const res = await createConversionLink(bookingId, body);
      setMade({ conversionId: res.conversion.id, payUrl: res.payUrl, token: res.token });
      setMaking(false);
      setDirty(false);
      await load();
      refreshJob();
      toast.show("Payment link ready. Nothing has been sent yet.");
    });

  const send = () =>
    run("send", async () => {
      if (!made || !current) return;
      /* Only channels that can actually be used: a disabled box may still be ticked from the default. */
      const usable = channels.filter((c) => (c === "email" ? Boolean(current.contact.email) : Boolean(options?.smsAvailable && current.contact.phone)));
      const res = await sendConversionLink(bookingId, current.id, made.token, usable);
      await load();
      refreshJob();
      const words = [res.delivery.email && res.delivery.email !== "not_requested" ? `email ${deliveryWords(res.delivery.email)}` : "", res.delivery.sms && res.delivery.sms !== "not_requested" ? `text ${deliveryWords(res.delivery.sms)}` : ""].filter(Boolean);
      toast.show(`Link ${words.join(", ") || "sent"}`);
    });

  const withdraw = () =>
    run("cancel", async () => {
      if (!current) return;
      await cancelConversionLink(bookingId, current.id, "Withdrawn in Admin");
      setMade(null);
      await load();
      refreshJob();
      toast.show("Link withdrawn. The visit is unchanged.");
    });

  const retry = () =>
    run("retry", async () => {
      if (!current) return;
      const res = await retryConversion(bookingId, current.id, retryReason.trim(), acceptCurrent);
      await load();
      refreshJob();
      toast.show(res.conversion.status === "converted" ? "Converted. The customer has been sent one confirmation." : "Still not converted: see the reason.");
    });

  const settled = async (after: Conversion) => {
    await load();
    refreshJob();
    toast.show(`${RESOLUTION_TEXT[after.resolution?.kind || ""] || "Recorded"}. ${after.status === "closed" ? "Closed." : "Off Needs action."}`);
  };

  if (loadError) return <Problem>{loadError}</Problem>;
  if (!options) return <SkeletonRows count={3} label="Loading the conversion options" />;

  const visitFacts = (
    <Note data-convert-visit="">
      <div className="font-semibold">
        #{options.booking.bookingNumber} · {options.booking.whenLabel}
      </div>
      <div>{options.booking.address}</div>
      <div className="mt-1 text-adm-text-2">
        {options.booking.status}
        {options.booking.assignedFixterName ? ` · ${options.booking.assignedFixterName}` : ""} · {options.booking.photos} {options.booking.photos === 1 ? "photo" : "photos"}
      </div>
      <div className="mt-1 text-adm-text-2">The same booking, day, time, Fixter, notes and photos are kept. Nothing changes until the customer has paid.</div>
    </Note>
  );

  /* ------------------------------ the form ------------------------------ */
  if (making) {
    const guest = options.account.mode === "guest" ? options.account : null;
    const canSubmit =
      !busy &&
      (kind === "one_time" ? options.offers.oneTime.enabled : Boolean(chosenPlan) && (!guest || Boolean(accountChoice))) &&
      (!override || overrideReason.trim().length >= 5);
    return (
      <div className="flex flex-col gap-4" data-convert-step="form">
        {visitFacts}
        <fieldset className="flex flex-col gap-2">
          <legend className="mb-1 text-[13px] font-semibold text-adm-ink">Convert to</legend>
          {(
            [
              { key: "membership", label: "Membership", hint: "A plan and billing frequency; renews until cancelled", ok: true },
              { key: "one_time", label: "One-Time Visit", hint: options.offers.oneTime.enabled ? `${money(options.offers.oneTime.priceCents)}, one 90-minute visit, no subscription` : "Switched off", ok: options.offers.oneTime.enabled },
            ] as const
          ).map((o) => (
            <label key={o.key} className={cx("flex min-h-[44px] items-start gap-3 rounded-adm-sm border px-3 py-2.5", kind === o.key ? "border-adm-accent bg-adm-accent-soft" : "border-adm-line", !o.ok && "opacity-60")}>
              <input type="radio" name="convert-kind" className="mt-1 h-5 w-5 accent-[var(--adm-accent)]" checked={kind === o.key} disabled={!o.ok} onChange={() => setKind(o.key)} data-convert-kind={o.key} />
              <span>
                <span className="block text-[15px] font-semibold text-adm-ink">{o.label}</span>
                <span className="block text-[13px] text-adm-text-2">{o.hint}</span>
              </span>
            </label>
          ))}
        </fieldset>

        {kind === "membership" && (
          <>
            <div className="grid grid-cols-2 gap-3">
              <Field label="Plan">
                <Select value={plan} onChange={(e) => setPlan(e.target.value)} options={plans.map((p) => ({ value: p.key, label: `${p.label} · $${cycle === "annual" ? p.annual + "/yr" : p.monthly + "/mo"}` }))} data-convert-plan="" />
              </Field>
              <Field label="Billing">
                <Select value={cycle} onChange={(e) => setCycle(e.target.value as "monthly" | "annual")} options={[{ value: "monthly", label: "Monthly" }, { value: "annual", label: "Annual" }]} data-convert-cycle="" />
              </Field>
            </div>
            {options.offers.membership.blocker && <Problem code={options.offers.membership.blocker.code}>{options.offers.membership.blocker.message}</Problem>}
            {chosenPlan && chosenPlan.limit === 1 && <p className="text-[13px] text-adm-text-2">Basic allows one booked visit at a time at this home.</p>}

            {guest ? (
              <fieldset className="flex flex-col gap-2" data-convert-account="">
                <legend className="mb-1 text-[13px] font-semibold text-adm-ink">Whose membership</legend>
                <p className="text-[13px] text-adm-text-2">This visit is not on an account yet. A membership belongs to one. Nothing is merged; the visit moves to the account only once paid.</p>
                {guest.candidates.map((c) => (
                  <label key={c.id} className={cx("flex min-h-[44px] items-start gap-3 rounded-adm-sm border px-3 py-2.5", accountChoice === c.id ? "border-adm-accent bg-adm-accent-soft" : "border-adm-line")}>
                    <input type="radio" name="convert-account" className="mt-1 h-5 w-5 accent-[var(--adm-accent)]" checked={accountChoice === c.id} disabled={!canCreateAccounts} onChange={() => { setAccountChoice(c.id); setSamePerson(false); }} data-convert-account-option={c.id} />
                    <span className="text-[14px]">
                      <span className="block font-semibold text-adm-ink">{c.name || "Customer"}</span>
                      <span className="block text-adm-text-2">
                        {c.email}
                        {c.phoneLast4 ? ` · phone …${c.phoneLast4}` : ""} · same {c.matchedOn.join(" + ")}
                        {c.hasThisHome ? " · has this home" : ""}
                      </span>
                    </span>
                  </label>
                ))}
                {canCreateAccounts ? (
                  <label className={cx("flex min-h-[44px] items-start gap-3 rounded-adm-sm border px-3 py-2.5", accountChoice === "create" ? "border-adm-accent bg-adm-accent-soft" : "border-adm-line")}>
                    <input type="radio" name="convert-account" className="mt-1 h-5 w-5 accent-[var(--adm-accent)]" checked={accountChoice === "create"} onChange={() => setAccountChoice("create")} data-convert-account-option="create" />
                    <span className="text-[14px]">
                      <span className="block font-semibold text-adm-ink">Create an account from this visit</span>
                      <span className="block text-adm-text-2">
                        {options.booking.name} · {options.booking.email} · {options.booking.phone}. Creating it sends their sign-in details by email{options.booking.phone ? " and text" : ""}, as creating a customer always does.
                      </span>
                    </span>
                  </label>
                ) : (
                  <Problem code="NO_ACCOUNT">Putting this visit on a customer account, or creating one, needs the Customers section. Ask the owner, or offer the One-Time Visit.</Problem>
                )}
                {(error?.code === "ACCOUNT_EMAIL_DIFFERS" || samePerson) && accountChoice !== "create" && (
                  <label className="flex min-h-[44px] items-center gap-2 text-[14px] font-semibold" data-convert-same-person="">
                    <input type="checkbox" className="h-5 w-5" checked={samePerson} onChange={(e) => setSamePerson(e.target.checked)} />
                    I checked: this account is the same person, despite the different email
                  </label>
                )}
                {accountChoice === "create" && (
                  <>
                    <div className="grid grid-cols-2 gap-3">
                      <Field label="First name">
                        <TextInput value={names.firstName} onChange={(e) => setNames((n) => ({ ...n, firstName: e.target.value }))} autoCapitalize="words" />
                      </Field>
                      <Field label="Last name">
                        <TextInput value={names.lastName} onChange={(e) => setNames((n) => ({ ...n, lastName: e.target.value }))} autoCapitalize="words" />
                      </Field>
                    </div>
                    {error?.code === "PHONE_IN_USE" && (
                      <label className="flex min-h-[44px] items-center gap-2 text-[14px]">
                        <input type="checkbox" className="h-5 w-5" checked={sharedPhone} onChange={(e) => setSharedPhone(e.target.checked)} />I checked: this is a different person who shares the phone
                      </label>
                    )}
                  </>
                )}
              </fieldset>
            ) : (
              <p className="text-[14px] text-adm-text-2" data-convert-account="booking">
                On {options.account.mode === "booking" ? options.account.name || "their" : ""} account{options.account.mode === "booking" && !options.account.hasThisHome ? (canCreateAccounts ? " (this address is added as one of their homes)" : ". This address is not one of their homes yet; adding it needs the Customers section") : ""}.
              </p>
            )}

            {lead?.insideMemberLeadTime && (
              <div className="flex flex-col gap-2" data-convert-lead-time="">
                {!needsOverride && !guestOverrideMaybe ? (
                  <Note tone="ok">{RULE_TEXT.first_visit_exemption}</Note>
                ) : (
                  <Note tone="warn">
                    This visit is before {lead.earliestMemberDate}, inside the member seven-day rule.{" "}
                    {needsOverride ? "This customer already has a membership, so the first-visit exception does not apply." : "If the chosen account already has a membership, the exception does not apply and you must override."}
                  </Note>
                )}
                {(needsOverride || guestOverrideMaybe || error?.code === "LEAD_TIME_OVERRIDE_REQUIRED") && (
                  <>
                    <label className="flex min-h-[44px] items-center gap-2 text-[14px] font-semibold">
                      <input type="checkbox" className="h-5 w-5" checked={override} onChange={(e) => setOverride(e.target.checked)} data-convert-override="" />
                      Override the seven-day rule for this visit
                    </label>
                    {override && (
                      <Field label="Reason (recorded with your name)" required help="At least a few words.">
                        <Textarea value={overrideReason} onChange={(e) => setOverrideReason(e.target.value)} maxLength={300} data-convert-override-reason="" />
                      </Field>
                    )}
                  </>
                )}
              </div>
            )}
          </>
        )}

        <Field label="What the paid visit is for" help="Shown as the job's task. The customer's own notes are kept as they are.">
          <TextInput value={task} onChange={(e) => setTask(e.target.value)} maxLength={120} placeholder="Handyman visit" data-convert-task="" />
        </Field>

        <Note>
          The customer pays {kind === "one_time" ? `${money(options.offers.oneTime.priceCents)} for a One-Time Visit` : `${membershipPrice} for ${chosenPlan?.label || ""}`} themselves at Stripe, after accepting the terms. You choose
          whether to send the link after it is made. {options.booking.status === "Pending Confirmation" ? "The visit will still await your approval." : "The visit stays Confirmed."}
        </Note>
        {error && <Problem code={error.code}>{error.message}</Problem>}

        <Footer el={footer}>
          <Button variant="secondary" large onClick={current ? () => setMaking(false) : onBack} disabled={Boolean(busy)}>
            Back
          </Button>
          <Button large onClick={create} busy={busy === "create"} disabled={!canSubmit} data-convert-create="">
            Create payment link
          </Button>
        </Footer>
      </div>
    );
  }

  /* --------------------------- the live link ---------------------------- */
  if (current) {
    const sentChannels = new Set(current.sends.map((s) => s.channel));
    const linkHere = made && made.conversionId === current.id ? made : null;
    return (
      <div className="flex flex-col gap-4" data-convert-step="status" data-convert-status={current.status}>
        {visitFacts}
        <div className="flex flex-col gap-1">
          <div className="flex flex-wrap items-center gap-2">
            <StatusBadge tone={current.status === "needs_attention" || current.followUp === "after_cancel" ? "problem" : current.status === "open" ? "info" : "success"}>
              {current.status === "needs_attention"
                ? "Needs attention"
                : current.followUp === "after_cancel"
                  ? "Paid, then canceled"
                  : current.status === "open"
                    ? current.checkoutOpen
                      ? "Checkout pending"
                      : current.source === "customer"
                        ? "Started by customer"
                        : "Link ready"
                    : "Paid"}
            </StatusBadge>
            <span className="text-[15px] font-semibold text-adm-ink">
              {current.offerLabel}
              {current.priceCents != null ? ` · ${money(current.priceCents)}${current.kind === "membership" ? (current.billingCycle === "annual" ? "/yr" : "/mo") : ""}` : ""}
            </span>
          </div>
          <p className="text-[14px] text-adm-text-2" data-convert-status-text="">
            {conversionStatusText(current)}
          </p>
          {current.leadTime.rule && current.kind === "membership" && (
            <p className="text-[13px] text-adm-text-2">
              {current.leadTime.rule === "admin_override" && current.leadTime.override
                ? `Seven-day rule overridden by ${current.leadTime.override.byName}: ${current.leadTime.override.reason}`
                : RULE_TEXT[current.leadTime.rule] || ""}
            </p>
          )}
        </div>

        {current.status === "open" && (
          <>
            {linkHere ? (
              <div className="flex flex-col gap-3 rounded-adm-sm border border-adm-line p-3" data-convert-link="">
                <p className="break-all text-[14px] text-adm-ink">{linkHere.payUrl}</p>
                <Button variant="secondary" icon={<ClipboardDocumentIcon className="h-4 w-4" aria-hidden="true" />} onClick={() => void writeToClipboard(linkHere.payUrl).then((ok) => toast.show(ok ? "Link copied" : "Could not copy the link"))} data-convert-copy="">
                  Copy link
                </Button>
                <p className="text-[13px] text-adm-text-2">Nothing has been sent. Send it now, or copy it into your own message. This link is shown only here, now.</p>
                <div className="grid grid-cols-2 gap-2" data-convert-channels="">
                  {(
                    [
                      { key: "email", label: "Email", to: current.contact.email },
                      { key: "sms", label: "Text", to: options.smsAvailable ? current.contact.phone : "" },
                    ] as const
                  ).map((c) => {
                    const done = sentChannels.has(c.key);
                    return (
                      <label key={c.key} className={cx("flex min-h-[44px] items-center gap-2 rounded-adm-sm border px-3 text-[15px]", done || !c.to ? "border-adm-line text-adm-text-3" : channels.includes(c.key) ? "border-adm-accent bg-adm-accent-soft text-adm-ink" : "border-adm-line text-adm-ink")}>
                        <input type="checkbox" className="h-5 w-5 accent-[var(--adm-accent)]" disabled={done || !c.to} checked={!done && channels.includes(c.key) && Boolean(c.to)} onChange={(e) => setChannels((v) => (e.target.checked ? [...v, c.key] : v.filter((x) => x !== c.key)))} />
                        {c.label}
                        {done ? <span className="text-[12px]">(sent)</span> : !c.to ? <span className="text-[12px]">{c.key === "sms" && !options.smsAvailable ? "(not for this guest)" : "(none)"}</span> : null}
                      </label>
                    );
                  })}
                </div>
              </div>
            ) : current.source === "customer" ? (
              <Note data-convert-customer-started="">
                The customer started this upgrade themselves, signed in to their account, so there is no link to send.
                {current.welcomeOfferApplied ? " Their page carries the 20% first-payment offer they were eligible for." : ""} Making a link here replaces it and closes their page.
              </Note>
            ) : (
              <Note data-convert-link-hidden="">The link was shown when it was made. To send it from here again, make a new link (the old one stops working).</Note>
            )}
            {current.sends.length > 0 && (
              <ul className="flex flex-col gap-1 text-[13px] text-adm-text-2" data-convert-sends="">
                {current.sends.map((s, i) => (
                  <li key={i}>
                    {s.channel === "email" ? "Emailed" : "Texted"} to {s.to} · {deliveryWords(s.result) || s.result} · {when(s.at)} · {s.byName}
                  </li>
                ))}
              </ul>
            )}
            {current.linkExpiresAt && <p className="text-[13px] text-adm-text-2">The link works until {when(current.linkExpiresAt)}.</p>}
          </>
        )}

        {(current.status === "paid" || current.status === "converting") && (
          <Note>
            Paid {current.payment ? `${money(current.payment.amountCents)} on ${when(current.payment.paidAt)}` : ""}. The visit is being converted now.{" "}
            <button type="button" className="font-semibold underline" onClick={() => void load()}>
              Refresh
            </button>
          </Note>
        )}

        {current.status === "needs_attention" && (
          <div className="flex flex-col gap-3" data-convert-attention={current.attention?.reason || ""}>
            <Problem code={current.attention?.reason}>
              The customer paid{current.payment ? ` ${money(current.payment.amountCents)}` : ""}, but the visit was not changed because {current.attention?.message || "it could not be converted safely"}. They were told their payment arrived and that their visit has not changed yet.
            </Problem>
            {current.attention?.reason === "visit_changed" && options.convertible && (
              <label className="flex min-h-[44px] items-start gap-2 text-[14px] font-semibold" data-convert-accept-current="">
                <input type="checkbox" className="mt-0.5 h-5 w-5" checked={acceptCurrent} onChange={(e) => setAcceptCurrent(e.target.checked)} />
                The visit was moved: convert it as it is now ({options.booking.whenLabel})
              </label>
            )}
            {current.attention?.reason === "lead_time" && (
              <Field label="Override the seven-day rule (reason, recorded with your name)" help="Leave empty to retry without overriding.">
                <Textarea value={retryReason} onChange={(e) => setRetryReason(e.target.value)} maxLength={300} data-convert-retry-reason="" />
              </Field>
            )}
            <ConversionPaymentPanel bookingId={bookingId} conversion={current} mode="close" onDone={(after) => void settled(after)} setBusy={setBusy} />
          </div>
        )}

        {current.status === "converted" && current.followUp === "after_cancel" && (
          <div className="flex flex-col gap-3" data-convert-after-cancel="">
            <Problem code="canceled_after_payment">
              This visit was canceled after the customer paid{current.payment ? ` ${money(current.payment.amountCents)}` : ""}
              {current.afterCancel ? ` (${when(current.afterCancel.at)}${current.afterCancel.byName ? `, ${current.afterCancel.byName}` : ""}${current.afterCancel.reason ? `: ${current.afterCancel.reason}` : ""})` : ""}. Canceling did not refund anything
              {current.kind === "membership" ? " and did not cancel the membership it started" : ""}. It stays under Needs action until you record what you did.
            </Problem>
            <ConversionPaymentPanel bookingId={bookingId} conversion={current} mode="resolve" onDone={(after) => void settled(after)} setBusy={setBusy} />
          </div>
        )}

        <History items={current.history} />
        {error && <Problem code={error.code}>{error.message}</Problem>}

        <Footer el={footer}>
          {current.status === "open" ? (
            <>
              <Button variant="destructive" large onClick={withdraw} busy={busy === "cancel"} disabled={Boolean(busy) && busy !== "cancel"} data-convert-withdraw="">
                Withdraw
              </Button>
              {linkHere ? (
                <Button large icon={<PaperAirplaneIcon className="h-4 w-4" aria-hidden="true" />} onClick={send} busy={busy === "send"} disabled={Boolean(busy) || !channels.some((c) => !sentChannels.has(c) && (c === "email" ? current.contact.email : options.smsAvailable && current.contact.phone))} data-convert-send="">
                  Send
                </Button>
              ) : (
                <Button large variant="secondary" onClick={() => setMaking(true)} disabled={Boolean(busy) || !options.convertible} data-convert-new-link="">
                  Make a new link
                </Button>
              )}
            </>
          ) : current.status === "needs_attention" ? (
            <>
              <Button variant="secondary" large onClick={onBack} disabled={Boolean(busy)}>
                Back
              </Button>
              <Button large icon={<ArrowPathIcon className="h-4 w-4" aria-hidden="true" />} onClick={retry} busy={busy === "retry"} disabled={Boolean(busy)} data-convert-retry="">
                Retry conversion
              </Button>
            </>
          ) : (
            <Button variant="secondary" large onClick={onBack}>
              Back
            </Button>
          )}
        </Footer>
      </div>
    );
  }

  /* ------------------------- nothing live, not convertible ------------------------- */
  return (
    <div className="flex flex-col gap-4" data-convert-step="none">
      {visitFacts}
      {options.problem ? <Problem code={options.problem.code}>{options.problem.message}</Problem> : null}
      {options.earlier[0]?.status === "converted" && (
        <Note tone="ok">
          <CheckCircleIcon className="mr-1 inline h-5 w-5" aria-hidden="true" />
          Converted to {options.earlier[0].offerLabel} on {when(options.earlier[0].convertedAt)}.
        </Note>
      )}
      {options.earlier[0]?.resolution && (
        <Note data-convert-resolution-recorded={options.earlier[0].resolution.kind}>
          Payment: {RESOLUTION_TEXT[options.earlier[0].resolution.kind] || options.earlier[0].resolution.kind}
          {options.earlier[0].resolution.kind === "membership_canceled" && options.earlier[0].resolution.firstPaymentRefunded !== null
            ? options.earlier[0].resolution.firstPaymentRefunded
              ? ", first payment refunded"
              : ", first payment not refunded"
            : ""}{" "}
          · {when(options.earlier[0].resolution.at)}
          {options.earlier[0].resolution.byName ? ` · ${options.earlier[0].resolution.byName}` : ""}
          {options.earlier[0].resolution.note ? ` · ${options.earlier[0].resolution.note}` : ""}
        </Note>
      )}
      {options.earlier.length > 0 && <History items={options.earlier[0].history} />}
      <Footer el={footer}>
        <Button variant="secondary" large onClick={onBack}>
          Back
        </Button>
        {options.convertible && (
          <Button large onClick={() => setMaking(true)} data-convert-new-link="">
            Make a payment link
          </Button>
        )}
      </Footer>
    </div>
  );
}

function History({ items }: { items: Conversion["history"] }) {
  if (!items?.length) return null;
  return (
    <details className="text-[13px] text-adm-text-2" data-convert-history="">
      <summary className="min-h-[44px] cursor-pointer py-2 font-semibold text-adm-ink">History ({items.length})</summary>
      <ul className="flex flex-col gap-1">
        {items.map((h, i) => (
          <li key={i}>
            {when(h.at)} · {EVENT_TEXT[h.event] || h.event}
            {h.byName ? ` · ${h.byName}` : ""}
            {h.detail && typeof h.detail.reason === "string" ? ` · ${h.detail.reason}` : ""}
          </li>
        ))}
      </ul>
    </details>
  );
}
