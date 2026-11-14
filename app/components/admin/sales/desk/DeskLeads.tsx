"use client";

/*
 * Sales desk › Leads (owner): the lead lists, creating a lead (optionally from
 * a customer account), bulk assignment of unassigned leads, and one lead's
 * full record with assignment, credit, linking, notes, tasks, GHL and
 * do-not-contact. Reassigning ALWAYS asks who keeps sales credit: the choice
 * is required in the form when the lead is known to be assigned, and a 409
 * CREDIT_DECISION_REQUIRED from the server (the lead was assigned meanwhile)
 * brings the same choice back with the server's current credit holder.
 */
import { PlusIcon } from "@heroicons/react/24/outline";
import { useMemo, useState } from "react";
import { errorCode, errorMessage, invalidateQueries, useAdminMutation, useAdminQuery } from "@/lib/admin/query";
import {
  TASK_KINDS,
  addDeskNote,
  addDeskTask,
  archiveDeskLead,
  assignDeskLead,
  bulkAssign,
  createDeskLead,
  dateText,
  dateTimeText,
  decideIntake,
  deskKeys,
  fetchDeskLead,
  fetchDeskLeads,
  fetchTelemarketers,
  linkDeskLead,
  liftSuppression,
  money,
  nyDayAt,
  nyLocalToIso,
  searchCustomers,
  setDeskGhl,
  stageLabel,
  unassignDeskLead,
  type OwnerLeadDetail,
  type OwnerLeadRow,
} from "@/lib/admin/sales";
import { Button, ButtonLink, Chip, EmptyState, ErrorState, Field, FilterBar, SearchField, Select, Sheet, SkeletonRows, StatusBadge, TextInput, Textarea, cx, formatPhone, useToast } from "@/app/components/admin/ui";
import { Facts, Notice, Panel, Problem, StageBadge, SuppressionBadges, SuppressionBanner, Timeline } from "../parts";
import { useDeskParams } from "./SalesDesk";

const VIEWS = [
  { id: "unassigned", label: "Unassigned" },
  { id: "assigned", label: "Assigned" },
  { id: "intake", label: "Intake" },
  { id: "inactive", label: "Inactive employee" },
  { id: "archived", label: "Archived" },
  { id: "all", label: "All active" },
];

const SOURCE: Record<string, string> = { owner: "Added by the owner", employee_intake: "Added by a telemarketer", existing_customer: "Existing customer", web_request: "Website request", referral_signup: "Referral sign-up" };

export function useTelemarketers() {
  return useAdminQuery(deskKeys.employees, fetchTelemarketers, { staleTime: 60_000 });
}

function rowMatches(l: OwnerLeadRow, term: string) {
  const t = term.trim().toLowerCase();
  if (!t) return true;
  const digits = t.replace(/\D/g, "");
  return l.name.toLowerCase().includes(t) || l.town.toLowerCase().includes(t) || (digits.length >= 3 && l.phone.replace(/\D/g, "").includes(digits));
}

export function DeskLeads() {
  const { get, set } = useDeskParams();
  const view = VIEWS.find((v) => v.id === get("view"))?.id || "unassigned";
  const employee = get("emp");
  const open = get("lead");
  const [term, setTerm] = useState("");
  const [creating, setCreating] = useState(false);
  const [picked, setPicked] = useState<Set<string>>(new Set());
  const people = useTelemarketers();
  // The owner's list is at most 500 rows; search stays in the browser so typed names and numbers never go into a URL.
  const q = useAdminQuery(deskKeys.leads(view, "", employee), (signal) => fetchDeskLeads(view, "", employee, signal), { staleTime: 15_000 });
  const list = useMemo(() => (q.data || []).filter((l) => rowMatches(l, term)), [q.data, term]);
  const toggle = (id: string) =>
    setPicked((cur) => {
      const next = new Set(cur);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  return (
    <div className="space-y-3" data-desk-tab="leads">
      <div className="flex flex-wrap items-center gap-2">
        <div className="min-w-0 flex-1">
          <SearchField label="Search leads" placeholder="Name, town or phone digits" value={term} onChange={setTerm} />
        </div>
        <Button icon={<PlusIcon className="h-5 w-5" />} onClick={() => setCreating(true)} data-desk-new-lead="">
          New lead
        </Button>
      </div>
      <FilterBar label="View" sticky={false}>
        {VIEWS.map((v) => (
          <Chip key={v.id} onClick={() => (setPicked(new Set()), set({ view: v.id }))} selected={view === v.id} tone={v.id === "intake" ? "attention" : "default"}>
            {v.label}
          </Chip>
        ))}
      </FilterBar>
      {view !== "intake" && view !== "archived" && (
        <div className="max-w-[320px]">
          <Field label="Telemarketer">
            <Select name="desk-employee-filter" value={employee} onChange={(e) => set({ emp: e.target.value || null })} options={[{ value: "", label: "Everyone" }, ...(people.data || []).map((p) => ({ value: p.id, label: `${p.name}${p.active ? "" : " (disabled)"}` }))]} />
          </Field>
        </div>
      )}
      {view === "unassigned" && picked.size > 0 && <BulkAssign ids={[...picked]} onDone={() => setPicked(new Set())} />}
      {q.isLoading ? (
        <SkeletonRows count={5} label="Loading leads" />
      ) : q.error && !q.data ? (
        <ErrorState message={errorMessage(q.error)} onRetry={q.refetch} />
      ) : list.length ? (
        <ul role="list" className="overflow-hidden rounded-adm-md border border-adm-line bg-adm-surface" data-desk-lead-list={view}>
          {list.map((l) => (
            <li key={l.id} className="flex min-w-0 items-stretch border-b border-adm-line last:border-b-0" data-desk-lead={l.id}>
              {view === "unassigned" && (
                <label className="flex w-12 flex-none items-center justify-center">
                  <input type="checkbox" className="h-5 w-5 accent-[var(--adm-accent)]" checked={picked.has(l.id)} onChange={() => toggle(l.id)} aria-label={`Select ${l.name}`} data-bulk-pick={l.id} />
                </label>
              )}
              <button type="button" onClick={() => set({ lead: l.id })} className={cx("min-h-[64px] min-w-0 flex-1 py-3 pr-4 text-left hover:bg-adm-bg", view === "unassigned" ? "pl-1" : "pl-4")}>
                <span className="flex flex-wrap items-center gap-1.5">
                  <span className="text-[15px] font-semibold text-adm-ink">{l.name}</span>
                  <StageBadge stage={l.stage} />
                  {l.linked && <StatusBadge tone="info">Account linked</StatusBadge>}
                  <SuppressionBadges call={l.doNotCall} sms={l.doNotText} />
                </span>
                <span className="mt-0.5 block break-words text-[13px] text-adm-text-2">
                  {[l.town || "No town", formatPhone(l.phone), l.assignee ? `${l.assignee.name}${l.creditHolder && l.creditHolder.id !== l.assignee.id ? ` (credit: ${l.creditHolder.name})` : ""}` : l.status === "intake" ? `From ${l.sourcedBy || "a telemarketer"}` : "Unassigned"].join(" · ")}
                </span>
              </button>
            </li>
          ))}
        </ul>
      ) : (
        <EmptyState message="No leads here." />
      )}
      {creating && <CreateLeadSheet onClose={() => setCreating(false)} />}
      {open && <OwnerLeadSheet id={open} onClose={() => set({ lead: null })} />}
    </div>
  );
}

function BulkAssign({ ids, onDone }: { ids: string[]; onDone: () => void }) {
  const toast = useToast();
  const people = useTelemarketers();
  const [to, setTo] = useState("");
  const [reason, setReason] = useState("");
  const go = useAdminMutation(() => bulkAssign({ leadIds: ids, employeeId: to, reason: reason.trim() || "Bulk assignment" }), {
    onSuccess: (r) => {
      toast.show(`${r.assigned.length} assigned${r.skipped.length ? `, ${r.skipped.length} skipped (${r.skipped[0].reason})` : ""}.`, { duration: 6000 });
      onDone();
      invalidateQueries(deskKeys.all);
    },
  });
  return (
    <div className="flex flex-wrap items-end gap-2 rounded-adm-md border border-adm-accent bg-adm-accent-soft p-3" data-bulk-assign="">
      <p className="w-full text-[14px] font-semibold text-adm-ink">{ids.length} selected</p>
      <Field label="Assign to" className="min-w-[180px] flex-1">
        <Select name="bulk-employee" value={to} onChange={(e) => setTo(e.target.value)} options={[{ value: "", label: "Choose…" }, ...(people.data || []).filter((p) => p.active).map((p) => ({ value: p.id, label: p.name }))]} />
      </Field>
      <Field label="Reason" className="min-w-[180px] flex-1">
        <TextInput name="bulk-reason" value={reason} onChange={(e) => setReason(e.target.value)} placeholder="Bulk assignment" />
      </Field>
      <Button busy={go.busy} disabled={!to} onClick={() => go.mutate(undefined)} data-bulk-submit="">
        Assign {ids.length}
      </Button>
      {go.error ? <div className="w-full"><Problem>{errorMessage(go.error)}</Problem></div> : null}
    </div>
  );
}

function CustomerPicker({ value, onChange }: { value: { id: string; name: string } | null; onChange: (c: { id: string; name: string } | null) => void }) {
  const [term, setTerm] = useState("");
  const t = term.trim();
  const q = useAdminQuery(["desk", "customer-search", t], (signal) => searchCustomers(t, signal), { enabled: t.length >= 2, staleTime: 30_000 });
  if (value)
    return (
      <div className="flex flex-wrap items-center gap-2 rounded-adm-sm border border-adm-line px-3 py-2" data-picked-customer={value.id}>
        <span className="text-[14px] font-semibold text-adm-ink">{value.name}</span>
        <Button variant="tertiary" onClick={() => onChange(null)}>
          Change
        </Button>
      </div>
    );
  return (
    <div className="space-y-2">
      <SearchField label="Find a customer account" placeholder="Name, phone or customer number" value={term} onChange={setTerm} />
      {t.length >= 2 && (
        <ul className="overflow-hidden rounded-adm-sm border border-adm-line" data-customer-results="">
          {q.isLoading ? (
            <li className="px-3 py-2 text-[14px] text-adm-text-2">Searching…</li>
          ) : q.data?.length ? (
            q.data.map((c) => (
              <li key={c.id} className="border-b border-adm-line last:border-b-0">
                <button type="button" className="min-h-[44px] w-full px-3 py-2 text-left hover:bg-adm-bg" onClick={() => onChange({ id: c.id, name: c.name })} data-customer-hit={c.id}>
                  <span className="block text-[14px] font-semibold text-adm-ink">{c.name}</span>
                  <span className="block text-[12px] text-adm-text-2">
                    #{c.userId} · {c.town || "no town"} · ••••{c.phoneLast4} {c.phoneVerified ? "(verified)" : "(not verified)"} · since {dateText(c.since)}
                  </span>
                </button>
              </li>
            ))
          ) : (
            <li className="px-3 py-2 text-[14px] text-adm-text-2">No customer found.</li>
          )}
        </ul>
      )}
    </div>
  );
}

function CreateLeadSheet({ onClose }: { onClose: () => void }) {
  const toast = useToast();
  const people = useTelemarketers();
  const [f, setF] = useState({ name: "", phone: "", email: "", town: "", zip: "", note: "", assignTo: "", reason: "" });
  const [customer, setCustomer] = useState<{ id: string; name: string } | null>(null);
  const save = useAdminMutation(
    () =>
      createDeskLead({
        name: f.name.trim() || customer?.name || "",
        ...(f.phone.trim() ? { phone: f.phone.trim() } : {}),
        ...(f.email.trim() ? { email: f.email.trim() } : {}),
        ...(f.town.trim() ? { town: f.town.trim() } : {}),
        ...(f.zip.trim() ? { zip: f.zip.trim() } : {}),
        ...(f.note.trim() ? { note: f.note.trim() } : {}),
        ...(customer ? { userId: customer.id } : {}),
        ...(f.assignTo ? { assignTo: f.assignTo, reason: f.reason.trim() || "New lead" } : {}),
      }),
    {
      onSuccess: () => {
        toast.show("Lead created.");
        invalidateQueries(deskKeys.all);
        onClose();
      },
    }
  );
  const can = Boolean(f.name.trim() || customer) && (Boolean(customer) || f.phone.replace(/\D/g, "").length >= 10);
  const dirty = Object.values(f).some(Boolean) || Boolean(customer);
  return (
    <Sheet
      open
      onClose={onClose}
      title="New lead"
      dirty={dirty}
      busy={save.busy}
      width="wide"
      data-sheet="desk-new-lead"
      footer={
        <>
          <Button variant="secondary" large onClick={onClose} disabled={save.busy}>
            Cancel
          </Button>
          <Button large busy={save.busy} disabled={!can} onClick={() => save.mutate(undefined)} data-new-lead-save="">
            Create lead
          </Button>
        </>
      }
    >
      <div className="space-y-3">
        <Field label="From a customer account (optional)" help="Links the lead to the account straight away; name and phone come from it.">
          <CustomerPicker value={customer} onChange={setCustomer} />
        </Field>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <Field label="Name" required={!customer}>
            <TextInput name="new-lead-name" value={f.name} onChange={(e) => setF({ ...f, name: e.target.value })} autoComplete="off" />
          </Field>
          <Field label="Phone" required={!customer}>
            <TextInput name="new-lead-phone" type="tel" value={f.phone} onChange={(e) => setF({ ...f, phone: e.target.value })} autoComplete="off" />
          </Field>
          <Field label="Town">
            <TextInput name="new-lead-town" value={f.town} onChange={(e) => setF({ ...f, town: e.target.value })} />
          </Field>
          <Field label="ZIP">
            <TextInput name="new-lead-zip" value={f.zip} onChange={(e) => setF({ ...f, zip: e.target.value })} />
          </Field>
          <Field label="Email" className="sm:col-span-2">
            <TextInput name="new-lead-email" type="email" value={f.email} onChange={(e) => setF({ ...f, email: e.target.value })} />
          </Field>
        </div>
        <Field label="Note">
          <Textarea name="new-lead-note" value={f.note} onChange={(e) => setF({ ...f, note: e.target.value })} />
        </Field>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <Field label="Assign to (optional)">
            <Select name="new-lead-assign" value={f.assignTo} onChange={(e) => setF({ ...f, assignTo: e.target.value })} options={[{ value: "", label: "Leave unassigned" }, ...(people.data || []).filter((p) => p.active).map((p) => ({ value: p.id, label: p.name }))]} />
          </Field>
          {f.assignTo && (
            <Field label="Reason">
              <TextInput name="new-lead-reason" value={f.reason} onChange={(e) => setF({ ...f, reason: e.target.value })} placeholder="New lead" />
            </Field>
          )}
        </div>
        {save.error ? <Problem code={errorCode(save.error)}>{errorMessage(save.error)}</Problem> : null}
      </div>
    </Sheet>
  );
}

/* ------------------------------------------------------------------ */
/* one lead                                                            */
/* ------------------------------------------------------------------ */

type Step = "main" | "assign" | "unassign" | "archive" | "link" | "lift";

function OwnerLeadSheet({ id, onClose }: { id: string; onClose: () => void }) {
  const q = useAdminQuery(deskKeys.lead(id), (signal) => fetchDeskLead(id, signal), { staleTime: 10_000 });
  const [step, setStep] = useState<Step>("main");
  const lead = q.data;
  const titles: Record<Step, string> = { main: lead?.name || "Lead", assign: lead && openAssignment(lead) ? "Reassign lead" : "Assign lead", unassign: "Unassign lead", archive: "Archive lead", link: "Link to a customer account", lift: "Lift do-not-contact" };
  const back = () => setStep("main");
  const after = () => {
    invalidateQueries(deskKeys.all);
    setStep("main");
  };
  return (
    <Sheet open onClose={onClose} title={titles[step]} size="full" width="wide" data-sheet="desk-lead">
      {q.isLoading ? (
        <SkeletonRows count={3} leading={false} label="Loading the lead" />
      ) : q.error && !lead ? (
        <ErrorState message={errorMessage(q.error)} onRetry={q.refetch} />
      ) : lead ? (
        step === "assign" ? (
          <AssignStep lead={lead} onBack={back} onDone={after} />
        ) : step === "unassign" || step === "archive" ? (
          <ReasonStep
            label={step === "unassign" ? "Unassign" : "Archive"}
            help={step === "unassign" ? "The lead goes back to Unassigned. Its history stays." : "The lead leaves every list. Its history and sales records stay."}
            run={(reason) => (step === "unassign" ? unassignDeskLead(lead.id, reason) : archiveDeskLead(lead.id, reason))}
            onBack={back}
            onDone={after}
          />
        ) : step === "link" ? (
          <LinkStep lead={lead} onBack={back} onDone={after} />
        ) : step === "lift" ? (
          <LiftStep lead={lead} onBack={back} onDone={after} />
        ) : (
          <OwnerLeadBody lead={lead} go={setStep} />
        )
      ) : null}
    </Sheet>
  );
}

const openAssignment = (lead: OwnerLeadDetail) => lead.assignments.find((a) => !a.endedAt) || null;

function H({ children }: { children: React.ReactNode }) {
  return <h3 className="mb-2 text-[13px] font-semibold uppercase tracking-[0.02em] text-adm-text-2">{children}</h3>;
}

function OwnerLeadBody({ lead, go }: { lead: OwnerLeadDetail; go: (s: Step) => void }) {
  const current = openAssignment(lead);
  const blocked = lead.suppression.call || lead.suppression.sms;
  return (
    <div className="space-y-5" data-desk-lead-detail={lead.id}>
      <div className="space-y-1">
        <div className="flex flex-wrap items-center gap-1.5">
          <StageBadge stage={lead.stage} />
          <StatusBadge tone={lead.status === "active" ? "info" : lead.status === "intake" ? "attention" : "neutral"}>{lead.status === "intake" ? "Waiting for approval" : lead.status === "active" ? "Active" : lead.status}</StatusBadge>
          <SuppressionBadges call={lead.suppression.call} sms={lead.suppression.sms} />
        </div>
        <Facts
          rows={[
            ["Phone", <a key="p" href={`tel:${lead.phone}`} className="adm-num font-semibold text-adm-accent-ink" data-desk-phone="">{formatPhone(lead.phone)}</a>],
            ["Email", lead.email || "—"],
            ["Town", [lead.town, lead.zip].filter(Boolean).join(" ") || "—"],
            ["Source", `${SOURCE[lead.source] || lead.source}${lead.sourcedBy ? ` (${lead.sourcedBy})` : ""}`],
            ...(lead.sourceNote ? ([["Source note", lead.sourceNote]] as [string, string][]) : []),
            ["Assigned to", current ? `${current.employee} since ${dateText(current.startedAt)}` : "Nobody"],
            ["Sales credit", current ? <span key="c" data-credit-holder="">{current.creditEmployee}</span> : "—"],
            ["Account", lead.linkedAccount ? `${lead.linkedAccount.name} (#${lead.linkedAccount.userId})${lead.link?.reason ? `: ${lead.link.reason}` : ""}` : "Not linked"],
            ...(lead.referral ? ([["Referral", `${lead.referral.employee} (code ${lead.referral.code}, ${dateText(lead.referral.at)})`]] as [string, string][]) : []),
          ]}
        />
      </div>

      <SuppressionBanner s={lead.suppression} />
      {blocked && (
        <Button variant="destructive" onClick={() => go("lift")} data-lift-open="">
          Lift do-not-contact…
        </Button>
      )}

      {lead.status === "intake" && <IntakeDecision lead={lead} />}

      {lead.status === "active" && (
        <section data-assignment="">
          <H>Assignment</H>
          <div className="flex flex-wrap gap-2">
            <Button onClick={() => go("assign")} data-assign-open="">
              {current ? "Reassign" : "Assign"}
            </Button>
            {current && (
              <Button variant="secondary" onClick={() => go("unassign")} data-unassign-open="">
                Unassign
              </Button>
            )}
            {!lead.linkedAccount && (
              <Button variant="secondary" onClick={() => go("link")} data-link-open="">
                Link account
              </Button>
            )}
            <Button variant="destructive" onClick={() => go("archive")} data-archive-open="">
              Archive
            </Button>
          </div>
          {lead.assignments.length > 0 && (
            <ol className="mt-3 space-y-1.5 text-[13px]" data-assignment-history="">
              {[...lead.assignments].reverse().map((a, i) => (
                <li key={i} className="rounded-adm-sm border border-adm-line px-3 py-2">
                  <p className="font-semibold text-adm-ink">
                    {a.employee} · {dateText(a.startedAt)}
                    {a.endedAt ? ` – ${dateText(a.endedAt)}` : " (current)"}
                  </p>
                  <p className="text-adm-text-2">
                    {a.creditDecision === "first_assignment" ? "First assignment" : a.creditDecision === "keep_previous" ? `Credit stayed with ${a.creditEmployee}` : `Credit moved to ${a.creditEmployee}`} · by {a.startedBy}
                    {a.reason ? ` · ${a.reason}` : ""}
                    {a.endReason ? ` · ended: ${a.endReason}` : ""}
                  </p>
                </li>
              ))}
            </ol>
          )}
        </section>
      )}

      {!lead.linkedAccount && lead.suggestions.length > 0 && (
        <Notice tone="attention">
          {lead.suggestions.length} account{lead.suggestions.length === 1 ? "" : "s"} with this phone number: {lead.suggestions.map((s) => s.name).join(", ")}. Check and link it (never automatic).
        </Notice>
      )}

      <OwnerNotes lead={lead} />
      <OwnerTask lead={lead} hasAssignee={Boolean(current)} />
      <OwnerGhl lead={lead} />

      <section data-desk-journey="">
        <H>Journey and sales</H>
        {lead.journey ? (
          <ul className="space-y-1 text-[14px]">
            <li>
              <StatusBadge tone="info">System</StatusBadge> Registered {dateText(lead.journey.registeredAt)}
              {lead.journey.phoneVerifiedAt ? ` · phone verified ${dateText(lead.journey.phoneVerifiedAt)}` : " · phone not verified"}
            </li>
            {lead.journey.freeVisits.map((v) => (
              <li key={v.id}>
                {v.verified ? <StatusBadge tone="info">System</StatusBadge> : <StatusBadge tone="attention">Estimated</StatusBadge>} Free visit {v.date ? dateTimeText(v.date) : ""}: {v.label}
              </li>
            ))}
            {lead.journey.memberships.map((m, i) => (
              <li key={i}>
                <StatusBadge tone={m.state === "active" ? "success" : "neutral"}>Membership</StatusBadge> {m.plan} {m.cycle} · {m.state.replace(/_/g, " ")} since {dateText(m.startDate)}
              </li>
            ))}
          </ul>
        ) : (
          <p className="text-[14px] text-adm-text-2">Not linked to an account.</p>
        )}
        {lead.sales.length > 0 && (
          <ul className="mt-2 space-y-1.5" data-desk-lead-sales="">
            {lead.sales.map((s) => (
              <li key={s.id} className="rounded-adm-sm border border-adm-line px-3 py-2 text-[13px]">
                <p className="flex flex-wrap items-center gap-1.5">
                  <span className="font-semibold text-adm-ink">{s.label}</span>
                  <StatusBadge tone="info">{s.identity === "stripe_customer" ? "Verified: Stripe customer" : s.identity === "checkout_account" ? "Verified: checkout account" : "Unverified identity"}</StatusBadge>
                  <span className="adm-num ml-auto">{money(s.amounts.paidPreTaxCents)} excl. tax</span>
                </p>
                <p className="text-adm-text-2">
                  Paid {dateText(s.paidAt)} · credit: {s.credit ? `${s.credit.status}${s.credit.reason ? ` (${s.credit.reason.replace(/_/g, " ")})` : ""}` : "none"}
                  {s.discount?.source ? ` · discount: ${s.discount.source}` : ""}
                </p>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section>
        <H>Timeline (includes owner-only coaching)</H>
        <Timeline items={lead.timeline} />
      </section>
    </div>
  );
}

function IntakeDecision({ lead }: { lead: OwnerLeadDetail }) {
  const toast = useToast();
  const people = useTelemarketers();
  const [reason, setReason] = useState("");
  const [to, setTo] = useState("");
  const go = useAdminMutation((approve: boolean) => decideIntake(lead.id, { approve, reason: reason.trim(), assignTo: approve ? to || null : null }), {
    onSuccess: (_r, approve) => {
      toast.show(approve ? "Lead approved." : "Lead rejected.");
      invalidateQueries(deskKeys.all);
    },
  });
  return (
    <Panel title="Intake decision" data-intake-decision="">
      <p className="mb-2 text-[13px] text-adm-text-2">Added by {lead.sourcedBy || "a telemarketer"}. Approving makes it a working lead; without a choice it goes to whoever added it.</p>
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <Field label="Reason">
          <TextInput name="intake-reason" value={reason} onChange={(e) => setReason(e.target.value)} />
        </Field>
        <Field label="Assign to">
          <Select name="intake-assign" value={to} onChange={(e) => setTo(e.target.value)} options={[{ value: "", label: `Whoever added it${lead.sourcedBy ? ` (${lead.sourcedBy})` : ""}` }, ...(people.data || []).filter((p) => p.active).map((p) => ({ value: p.id, label: p.name }))]} />
        </Field>
      </div>
      {go.error ? <div className="mt-2"><Problem>{errorMessage(go.error)}</Problem></div> : null}
      <div className="mt-3 flex flex-wrap gap-2">
        <Button busy={go.busy} onClick={() => go.mutate(true)} data-intake-approve="">
          Approve
        </Button>
        <Button variant="destructive" disabled={!reason.trim() || go.busy} onClick={() => go.mutate(false)} data-intake-reject="">
          Reject
        </Button>
      </div>
    </Panel>
  );
}

function AssignStep({ lead, onBack, onDone }: { lead: OwnerLeadDetail; onBack: () => void; onDone: () => void }) {
  const toast = useToast();
  const people = useTelemarketers();
  const current = openAssignment(lead);
  const [to, setTo] = useState("");
  const [reason, setReason] = useState("");
  const [decision, setDecision] = useState<"keep_previous" | "new_assignee" | "">("");
  // Who holds credit now: from the lead as loaded, or from the server's 409 when it changed meanwhile.
  const [holder, setHolder] = useState<{ name: string } | null>(current ? { name: current.creditEmployee } : null);
  const [conflict, setConflict] = useState("");
  const toName = people.data?.find((p) => p.id === to)?.name || "the new assignee";
  const save = useAdminMutation(() => assignDeskLead(lead.id, { employeeId: to, reason: reason.trim(), ...(decision ? { creditDecision: decision } : {}) }), {
    onSuccess: () => {
      toast.show(holder ? `Reassigned to ${toName}.` : `Assigned to ${toName}.`);
      onDone();
    },
    onError: (e) => {
      if (errorCode(e) === "CREDIT_DECISION_REQUIRED") {
        const h = (e as { response?: { data?: { currentCreditHolder?: { name: string } } } }).response?.data?.currentCreditHolder;
        setHolder({ name: h?.name || "another employee" });
        setDecision("");
        setConflict("This lead was assigned meanwhile. Choose who keeps sales credit, then send again.");
      }
    },
  });
  const can = Boolean(to) && (!holder || (Boolean(decision) && reason.trim().length > 0));
  return (
    <div className="space-y-4" data-assign-step="">
      {current && (
        <p className="text-[14px] text-adm-text-2">
          Now with <strong className="text-adm-ink">{current.employee}</strong> since {dateText(current.startedAt)}.
        </p>
      )}
      <Field label={holder ? "Reassign to" : "Assign to"} required>
        <Select name="assign-employee" value={to} onChange={(e) => setTo(e.target.value)} options={[{ value: "", label: "Choose a telemarketer…" }, ...(people.data || []).filter((p) => p.active && p.id !== current?.employeeId).map((p) => ({ value: p.id, label: p.name }))]} />
      </Field>
      {conflict && <Problem code="CREDIT_DECISION_REQUIRED">{conflict}</Problem>}
      {holder && (
        <fieldset className="space-y-2 rounded-adm-md border border-adm-attn bg-adm-attn-bg p-3" data-credit-choice="">
          <legend className="sr-only">Who keeps sales credit</legend>
          <p className="text-[14px] font-semibold text-adm-ink" data-current-credit-holder="">
            Sales credit is with {holder.name} now. Who keeps it for this lead&apos;s future sales?
          </p>
          {(
            [
              ["keep_previous", `Keep with ${holder.name}`, `${holder.name} keeps credit; ${toName} works the lead.`],
              ["new_assignee", `Move to ${toName}`, `${toName} gets credit for sales from now on.`],
            ] as const
          ).map(([v, label, hint]) => (
            <label key={v} className={cx("flex min-h-[44px] cursor-pointer items-start gap-2 rounded-adm-sm border bg-adm-surface px-3 py-2", decision === v ? "border-adm-accent" : "border-adm-line")}>
              <input type="radio" name="credit-decision" value={v} checked={decision === v} onChange={() => setDecision(v)} className="mt-1 h-5 w-5 accent-[var(--adm-accent)]" data-credit-decision={v} />
              <span>
                <span className="block text-[14px] font-semibold text-adm-ink">{label}</span>
                <span className="block text-[12px] text-adm-text-2">{hint}</span>
              </span>
            </label>
          ))}
        </fieldset>
      )}
      <Field label="Reason" required={Boolean(holder)}>
        <TextInput name="assign-reason" value={reason} onChange={(e) => setReason(e.target.value)} />
      </Field>
      {save.error && errorCode(save.error) !== "CREDIT_DECISION_REQUIRED" ? <Problem code={errorCode(save.error)}>{errorMessage(save.error)}</Problem> : null}
      <div className="flex flex-wrap gap-2">
        {/* Unknown to be assigned: sendable without a credit choice; the server's 409 brings the choice back. */}
        <Button large busy={save.busy} disabled={!can} onClick={() => save.mutate(undefined)} data-assign-submit="">
          {holder ? "Reassign" : "Assign"}
        </Button>
        <Button large variant="secondary" onClick={onBack} disabled={save.busy}>
          Back
        </Button>
      </div>
    </div>
  );
}

function ReasonStep({ label, help, run, onBack, onDone }: { label: string; help: string; run: (reason: string) => Promise<unknown>; onBack: () => void; onDone: () => void }) {
  const toast = useToast();
  const [reason, setReason] = useState("");
  const go = useAdminMutation(() => run(reason.trim()), {
    onSuccess: () => {
      toast.show(`${label} done.`);
      onDone();
    },
  });
  return (
    <div className="space-y-4" data-reason-step={label.toLowerCase()}>
      <p className="text-[14px] text-adm-text-2">{help}</p>
      <Field label="Reason" required>
        <TextInput name="step-reason" value={reason} onChange={(e) => setReason(e.target.value)} />
      </Field>
      {go.error ? <Problem>{errorMessage(go.error)}</Problem> : null}
      <div className="flex flex-wrap gap-2">
        <Button large variant={label === "Archive" ? "danger" : "primary"} busy={go.busy} disabled={!reason.trim()} onClick={() => go.mutate(undefined)} data-step-submit="">
          {label}
        </Button>
        <Button large variant="secondary" onClick={onBack}>
          Back
        </Button>
      </div>
    </div>
  );
}

function LinkStep({ lead, onBack, onDone }: { lead: OwnerLeadDetail; onBack: () => void; onDone: () => void }) {
  const toast = useToast();
  const [customer, setCustomer] = useState<{ id: string; name: string } | null>(null);
  const [reason, setReason] = useState("");
  const go = useAdminMutation(() => linkDeskLead(lead.id, customer?.id || "", reason.trim()), {
    onSuccess: () => {
      toast.show("Linked. Sales on this account are reviewed for credit.");
      onDone();
    },
  });
  return (
    <div className="space-y-4" data-link-step="">
      <Notice>Linking is how sales credit finds this lead. Check it is the same person; sales made before the link are held for your review.</Notice>
      {lead.suggestions.length > 0 && !customer && (
        <div>
          <H>Same phone number</H>
          <ul className="space-y-1.5">
            {lead.suggestions.map((s) => (
              <li key={s.id}>
                <button type="button" className="min-h-[44px] w-full rounded-adm-sm border border-adm-line px-3 py-2 text-left hover:bg-adm-bg" onClick={() => setCustomer({ id: s.id, name: s.name })} data-suggestion={s.id}>
                  <span className="block text-[14px] font-semibold text-adm-ink">{s.name}</span>
                  <span className="block text-[12px] text-adm-text-2">
                    #{s.userId} · {s.town || "no town"} · {s.phoneVerified ? "phone verified" : "phone not verified"} · since {dateText(s.since)}
                  </span>
                </button>
              </li>
            ))}
          </ul>
        </div>
      )}
      <CustomerPicker value={customer} onChange={setCustomer} />
      <Field label="How you confirmed it is the same person" required>
        <TextInput name="link-reason" value={reason} onChange={(e) => setReason(e.target.value)} />
      </Field>
      {go.error ? <Problem code={errorCode(go.error)}>{errorMessage(go.error)}</Problem> : null}
      <div className="flex flex-wrap gap-2">
        <Button large busy={go.busy} disabled={!customer || !reason.trim()} onClick={() => go.mutate(undefined)} data-link-submit="">
          Link account
        </Button>
        <Button large variant="secondary" onClick={onBack}>
          Back
        </Button>
      </div>
    </div>
  );
}

function LiftStep({ lead, onBack, onDone }: { lead: OwnerLeadDetail; onBack: () => void; onDone: () => void }) {
  const toast = useToast();
  const [channel, setChannel] = useState<"call" | "sms" | "all">(lead.suppression.call && lead.suppression.sms ? "all" : lead.suppression.call ? "call" : "sms");
  const [reason, setReason] = useState("");
  const [typed, setTyped] = useState("");
  const stop = lead.suppression.reasons.some((r) => r.source === "customer");
  const go = useAdminMutation(() => liftSuppression({ phone: lead.phone, channel, reason: reason.trim() }), {
    onSuccess: () => {
      toast.show("Do-not-contact lifted.");
      onDone();
    },
  });
  return (
    <div className="space-y-4" data-lift-step="">
      <div role="alert" className="rounded-adm-sm border border-adm-problem bg-adm-problem-bg px-3 py-2.5 text-[14px] text-adm-problem">
        <p className="font-semibold">Only lift this when the customer asked to be contacted again, in writing or on a recorded call.</p>
        <p className="mt-1">It applies to {formatPhone(lead.phone)} for every lead and every employee, and it is logged with your name and reason.</p>
        {stop && <p className="mt-1">A customer who replied STOP to a Profixter text can only opt back in by texting START; lifting here does not change that.</p>}
      </div>
      <Field label="Lift for">
        <Select name="lift-channel" value={channel} onChange={(e) => setChannel(e.target.value as "call" | "sms" | "all")} options={[{ value: "all", label: "Calls and texts" }, { value: "call", label: "Calls" }, { value: "sms", label: "Texts" }]} />
      </Field>
      <Field label="Why they may be contacted again" required help="At least a few words, e.g. their written request and its date.">
        <Textarea name="lift-reason" value={reason} onChange={(e) => setReason(e.target.value)} />
      </Field>
      <Field label={<>Type <span className="font-mono">LIFT</span> to confirm</>}>
        <TextInput name="lift-typed" value={typed} onChange={(e) => setTyped(e.target.value)} autoComplete="off" autoCapitalize="characters" />
      </Field>
      {go.error ? <Problem>{errorMessage(go.error)}</Problem> : null}
      <div className="flex flex-wrap gap-2">
        <Button large variant="danger" busy={go.busy} disabled={reason.trim().length < 5 || typed.trim() !== "LIFT"} onClick={() => go.mutate(undefined)} data-lift-submit="">
          Lift do-not-contact
        </Button>
        <Button large variant="secondary" onClick={onBack}>
          Back
        </Button>
      </div>
    </div>
  );
}

function OwnerNotes({ lead }: { lead: OwnerLeadDetail }) {
  const toast = useToast();
  const [kind, setKind] = useState<"note" | "coaching">("note");
  const [body, setBody] = useState("");
  const go = useAdminMutation(() => addDeskNote(lead.id, kind, body.trim()), {
    onSuccess: () => {
      setBody("");
      toast.show(kind === "coaching" ? "Coaching note saved (owner only)." : "Note saved.");
      invalidateQueries(deskKeys.lead(lead.id));
    },
  });
  return (
    <section data-owner-notes="">
      <H>Note</H>
      <div className="mb-2 flex gap-2" role="group" aria-label="Note kind">
        <Chip onClick={() => setKind("note")} selected={kind === "note"}>
          Note (team sees it)
        </Chip>
        <Chip onClick={() => setKind("coaching")} selected={kind === "coaching"}>
          Coaching (owner only)
        </Chip>
      </div>
      <Textarea name="owner-note" aria-label="Note" value={body} onChange={(e) => setBody(e.target.value)} rows={2} />
      {go.error ? <div className="mt-2"><Problem>{errorMessage(go.error)}</Problem></div> : null}
      <Button className="mt-2" variant="secondary" busy={go.busy} disabled={!body.trim()} onClick={() => go.mutate(undefined)} data-owner-note-save="">
        Save note
      </Button>
    </section>
  );
}

function OwnerTask({ lead, hasAssignee }: { lead: OwnerLeadDetail; hasAssignee: boolean }) {
  const toast = useToast();
  const [due, setDue] = useState(() => nyDayAt(1, 10));
  const [kind, setKind] = useState("call");
  const [note, setNote] = useState("");
  const go = useAdminMutation(() => addDeskTask(lead.id, { dueAt: nyLocalToIso(due) || "", kind, note: note.trim() }), {
    onSuccess: () => {
      setNote("");
      toast.show("Task added for the assignee.");
      invalidateQueries(deskKeys.lead(lead.id));
    },
  });
  if (!hasAssignee) return null;
  return (
    <section data-owner-task="">
      <H>Task for the assignee</H>
      {lead.tasks.length > 0 && (
        <ul className="mb-2 space-y-1 text-[13px] text-adm-text-2">
          {lead.tasks.map((t) => (
            <li key={t.id}>
              {TASK_KINDS.find((k) => k.id === t.kind)?.label || t.kind} · {dateTimeText(t.dueAt)}
              {t.note ? ` · ${t.note}` : ""}
            </li>
          ))}
        </ul>
      )}
      <div className="grid grid-cols-1 gap-2 sm:grid-cols-3">
        <Field label="When (New York time)">
          <TextInput name="owner-task-due" type="datetime-local" value={due} onChange={(e) => setDue(e.target.value)} />
        </Field>
        <Field label="Kind">
          <Select name="owner-task-kind" value={kind} onChange={(e) => setKind(e.target.value)} options={TASK_KINDS.map((t) => ({ value: t.id, label: t.label }))} />
        </Field>
        <Field label="Note">
          <TextInput name="owner-task-note" value={note} onChange={(e) => setNote(e.target.value)} />
        </Field>
      </div>
      {go.error ? <div className="mt-2"><Problem>{errorMessage(go.error)}</Problem></div> : null}
      <Button className="mt-2" variant="secondary" busy={go.busy} disabled={!nyLocalToIso(due)} onClick={() => go.mutate(undefined)}>
        Add task
      </Button>
    </section>
  );
}

function OwnerGhl({ lead }: { lead: OwnerLeadDetail }) {
  const toast = useToast();
  const [value, setValue] = useState("");
  const go = useAdminMutation(() => setDeskGhl(lead.id, value.trim()), {
    onSuccess: () => {
      setValue("");
      toast.show("GHL contact mapped.");
      invalidateQueries(deskKeys.lead(lead.id));
    },
  });
  return (
    <section data-owner-ghl="">
      <H>GHL contact</H>
      <p className="text-[14px] text-adm-text-2">{lead.ghl.contactId ? `Mapped to ${lead.ghl.contactId}` : "Not mapped to a GHL contact."}</p>
      {lead.ghl.contact && (
        <ButtonLink className="mt-2" href={lead.ghl.contact} target="_blank" rel="noopener noreferrer">
          Open in GHL
        </ButtonLink>
      )}
      <div className="mt-2 flex flex-col gap-2 sm:flex-row sm:items-end">
        <Field label={lead.ghl.contactId ? "Change GHL contact" : "Map GHL contact"} help="Paste the GHL contact link or id." className="min-w-0 flex-1">
          <TextInput name="owner-ghl" value={value} onChange={(e) => setValue(e.target.value)} autoComplete="off" />
        </Field>
        <Button variant="secondary" busy={go.busy} disabled={!value.trim()} onClick={() => go.mutate(undefined)}>
          Save
        </Button>
      </div>
      {go.error ? <div className="mt-2"><Problem>{errorMessage(go.error)}</Problem></div> : null}
      <p className="mt-1 text-[12px] text-adm-text-3">Stage: {stageLabel(lead.stage)}</p>
    </section>
  );
}
