"use client";

/*
 * One assigned lead, for its telemarketer (GET /api/sales/leads/:id): a sheet
 * on phones, a side panel on desktop. Call, log the outcome, set the next
 * step, see the customer's verified journey and sales, and ask for sales
 * credit. The full number is shown only on request (POST /phone, logged).
 *
 * The credit request is a step INSIDE this sheet (never a sheet over a
 * sheet): kind, explanation, GHL references, a note, then one optional file
 * (multipart `file`, PDF/PNG/JPEG up to 5 MB). The proposed amount and bonus
 * eligibility shown afterwards are the server's.
 */
import { ArrowTopRightOnSquareIcon, PaperClipIcon, PhoneIcon, PlusIcon } from "@heroicons/react/24/outline";
import { useRouter, useSearchParams } from "next/navigation";
import { useRef, useState } from "react";
import { errorCode, errorMessage, errorStatus, invalidateQueries, useAdminMutation, useAdminQuery } from "@/lib/admin/query";
import {
  EVIDENCE_MAX,
  EVIDENCE_TYPES,
  OUTCOMES,
  REQUEST_KINDS,
  SALE_STATUS,
  TASK_KINDS,
  addTask,
  createRequest,
  dateText,
  dateTimeText,
  fetchMyLead,
  isoToNyLocal,
  logActivity,
  money,
  nyDayAt,
  nyLocalToIso,
  revealPhone,
  salesKeys,
  setGhl,
  taskKindLabel,
  updateTask,
  uploadEvidence,
  type CreditRequest,
  type LeadDetail,
  type LeadSale,
  type OutcomeKind,
  type RequestKind,
} from "@/lib/admin/sales";
import { Button, ButtonLink, EmptyState, ErrorState, Field, Select, Sheet, SkeletonRows, StatusBadge, TextInput, Textarea, cx, useToast } from "@/app/components/admin/ui";
import { formatPhone } from "@/app/components/admin/ui";
import { Notice, Problem, StageBadge, SuppressionBanner, Timeline, useNow, UnknownBadge } from "./parts";

function H({ children }: { children: React.ReactNode }) {
  return <h3 className="mb-2 text-[13px] font-semibold uppercase tracking-[0.02em] text-adm-text-2">{children}</h3>;
}

export function SalesLeadSheet({ id }: { id: string }) {
  const router = useRouter();
  const params = useSearchParams();
  const q = useAdminQuery(salesKeys.lead(id), (signal) => fetchMyLead(id, signal), { staleTime: 15_000 });
  const [step, setStep] = useState<{ kind: "lead" } | { kind: "credit"; sale: LeadSale }>({ kind: "lead" });
  const [dirty, setDirty] = useState(false);
  const stage = params.get("stage");
  const close = () => router.replace(`/admin/sales-leads${stage ? `?stage=${stage}` : ""}`, { scroll: false });
  const lead = q.data;
  return (
    <Sheet
      open
      onClose={close}
      title={step.kind === "credit" ? "Request sales credit" : lead?.name || "Lead"}
      size="full"
      width="wide"
      dirty={dirty}
      data-sheet="sales-lead"
    >
      {q.isLoading ? (
        <SkeletonRows count={3} leading={false} label="Loading the lead" />
      ) : q.error && !lead ? (
        errorStatus(q.error) === 404 ? (
          <EmptyState message="This lead isn't assigned to you" detail="It may have been reassigned, or the link is out of date." />
        ) : (
          <ErrorState title="The lead could not be loaded" message={errorMessage(q.error)} onRetry={q.refetch} />
        )
      ) : lead ? (
        step.kind === "credit" ? (
          <CreditRequestStep
            lead={lead}
            sale={step.sale}
            onDirty={setDirty}
            onDone={() => {
              setDirty(false);
              setStep({ kind: "lead" });
            }}
          />
        ) : (
          <LeadBody lead={lead} onDirty={setDirty} onRequestCredit={(sale) => setStep({ kind: "credit", sale })} />
        )
      ) : null}
    </Sheet>
  );
}

function LeadBody({ lead, onDirty, onRequestCredit }: { lead: LeadDetail; onDirty: (d: boolean) => void; onRequestCredit: (s: LeadSale) => void }) {
  const toast = useToast();
  const [phone, setPhone] = useState<string | null>(null);
  const reveal = useAdminMutation(() => revealPhone(lead.id), { onSuccess: (p) => setPhone(p) });
  const blockedCall = lead.suppression.call;
  return (
    <div className="space-y-5" data-sales-lead={lead.id}>
      {/* header */}
      <div className="space-y-2">
        <div className="flex flex-wrap items-center gap-1.5">
          <StageBadge stage={lead.stage} />
          {lead.linked ? <StatusBadge tone="info">Has a Profixter account</StatusBadge> : <StatusBadge tone="neutral">No account linked yet</StatusBadge>}
        </div>
        <p className="text-[14px] text-adm-text-2">{lead.town || "Town not given"}</p>
        <div className="flex flex-wrap items-center gap-2">
          {phone ? (
            blockedCall ? (
              <span className="adm-num text-[17px] font-semibold text-adm-text-2 line-through" data-phone-full="">
                {formatPhone(phone)}
              </span>
            ) : (
              <ButtonLink href={`tel:${phone}`} variant="primary" icon={<PhoneIcon className="h-5 w-5" />} data-phone-full="">
                Call {formatPhone(phone)}
              </ButtonLink>
            )
          ) : (
            <>
              <span className="adm-num text-[17px] font-semibold text-adm-ink" data-phone-masked="">
                ••••{lead.phoneLast4}
              </span>
              <Button variant="secondary" busy={reveal.busy} onClick={() => reveal.mutate(undefined)} data-show-number="">
                Show number
              </Button>
            </>
          )}
        </div>
        {reveal.error ? <Problem>{errorMessage(reveal.error)}</Problem> : null}
        <p className="text-[13px] text-adm-text-2" data-sales-credit="">
          {lead.salesCredit}
        </p>
      </div>

      <SuppressionBanner s={lead.suppression} />

      <GhlBlock lead={lead} />

      <OutcomeForm lead={lead} onDirty={onDirty} onLogged={() => toast.show("Logged.")} />

      <TasksBlock lead={lead} />

      <section data-journey="">
        <H>Journey</H>
        {lead.journey ? (
          <ul className="space-y-1.5 text-[14px]">
            <li className="flex flex-wrap items-center gap-1.5">
              <StatusBadge tone="info">System</StatusBadge> Registered {dateText(lead.journey.registeredAt)}
            </li>
            <li className="flex flex-wrap items-center gap-1.5">
              <StatusBadge tone={lead.journey.phoneVerified ? "info" : "neutral"}>{lead.journey.phoneVerified ? "System" : "Not yet"}</StatusBadge> {lead.journey.phoneVerified ? "Phone verified" : "Phone not verified"}
            </li>
            {lead.journey.freeVisits.map((v, i) => (
              <li key={i} className="flex flex-wrap items-center gap-1.5" data-free-visit={v.status}>
                {v.verified ? <StatusBadge tone="info">System</StatusBadge> : <UnknownBadge />} Free visit {v.date ? dateTimeText(v.date) : `requested ${dateText(v.requestedAt)}`}: {v.label}{v.detail ? <span className="text-adm-text-2"> · {v.detail}</span> : null}
              </li>
            ))}
            <li className="flex flex-wrap items-center gap-1.5" data-membership="">
              {lead.journey.membership ? (
                <>
                  <StatusBadge tone={lead.journey.membership.state === "active" ? "success" : "neutral"}>Membership</StatusBadge>
                  {lead.journey.membership.plan} {lead.journey.membership.cycle} · {lead.journey.membership.state.replace(/_/g, " ")} since {dateText(lead.journey.membership.startDate)}
                </>
              ) : (
                <>
                  <StatusBadge tone="neutral">Membership</StatusBadge> None yet
                </>
              )}
            </li>
          </ul>
        ) : (
          <p className="text-[14px] text-adm-text-2">This lead is not linked to a customer account yet, so there is no verified journey. The owner links accounts.</p>
        )}
      </section>

      <section data-lead-sales="">
        <H>Sales on this account</H>
        {lead.sales.length ? (
          <ul className="space-y-2">
            {lead.sales.map((s) => (
              <li key={s.id} className="rounded-adm-sm border border-adm-line px-3 py-2" data-lead-sale={s.id} data-sale-status={s.status}>
                <div className="flex flex-wrap items-center gap-1.5">
                  <span className="text-[14px] font-semibold text-adm-ink">{s.label}</span>
                  <StatusBadge tone="info">Verified payment</StatusBadge>
                  <span className="adm-num ml-auto text-[13px] text-adm-text-2">{money(s.paidPreTaxCents)} excl. tax</span>
                </div>
                <p className="mt-0.5 text-[13px] text-adm-text-2">
                  Paid {dateText(s.paidAt)} · {SALE_STATUS[s.status] || s.status.replace(/_/g, " ")}
                </p>
                {s.claimable && (
                  <Button variant="secondary" className="mt-2" onClick={() => onRequestCredit(s)} data-request-credit={s.id}>
                    Request sales credit
                  </Button>
                )}
              </li>
            ))}
          </ul>
        ) : (
          <p className="text-[14px] text-adm-text-2">No paid sales on this account.</p>
        )}
      </section>

      <section>
        <H>Timeline</H>
        <Timeline items={lead.timeline} />
      </section>
    </div>
  );
}

function GhlBlock({ lead }: { lead: LeadDetail }) {
  const toast = useToast();
  const [value, setValue] = useState("");
  const [editing, setEditing] = useState(!lead.ghl.contactId);
  const save = useAdminMutation(() => setGhl(lead.id, value.trim()), {
    onSuccess: () => {
      setValue("");
      setEditing(false);
      toast.show("GHL contact linked.");
    },
    invalidates: [salesKeys.lead(lead.id)],
  });
  return (
    <section data-ghl-block="">
      <H>GoHighLevel</H>
      <div className="flex flex-wrap gap-2">
        {lead.ghl.contact && (
          <ButtonLink href={lead.ghl.contact} target="_blank" rel="noopener noreferrer" icon={<ArrowTopRightOnSquareIcon className="h-5 w-5" />} data-ghl-contact="">
            Open contact
          </ButtonLink>
        )}
        {lead.ghl.conversation && (
          <ButtonLink href={lead.ghl.conversation} target="_blank" rel="noopener noreferrer" icon={<ArrowTopRightOnSquareIcon className="h-5 w-5" />} data-ghl-conversation="">
            Open conversation
          </ButtonLink>
        )}
        {lead.ghl.contactId && !editing && (
          <Button variant="tertiary" onClick={() => setEditing(true)}>
            Change GHL contact
          </Button>
        )}
      </div>
      {!lead.ghl.contact && lead.ghl.note && <p className="mt-1 text-[13px] text-adm-text-3">{lead.ghl.note}</p>}
      {editing && (
        <form
          className="mt-2 flex flex-col gap-2 sm:flex-row sm:items-end"
          onSubmit={(e) => {
            e.preventDefault();
            if (value.trim()) void save.mutate(undefined);
          }}
        >
          <Field label="Link GHL contact" help="Paste the contact's GHL link (or its contact id)." className="min-w-0 flex-1">
            <TextInput name="ghl-contact" value={value} onChange={(e) => setValue(e.target.value)} autoComplete="off" placeholder="https://app.gohighlevel.com/v2/location/…/contacts/detail/…" />
          </Field>
          <Button type="submit" variant="secondary" busy={save.busy} disabled={!value.trim()} data-ghl-save="">
            Link
          </Button>
        </form>
      )}
      {save.error ? <div className="mt-2"><Problem code={errorCode(save.error)}>{errorMessage(save.error)}</Problem></div> : null}
    </section>
  );
}

const QUICK = [
  { label: "Tomorrow 10 AM", value: () => nyDayAt(1, 10) },
  { label: "In 3 days", value: () => nyDayAt(3, 10) },
  { label: "Next week", value: () => nyDayAt(7, 10) },
];

function OutcomeForm({ lead, onDirty, onLogged }: { lead: LeadDetail; onDirty: (d: boolean) => void; onLogged: () => void }) {
  const [kind, setKind] = useState<OutcomeKind | null>(null);
  const [body, setBody] = useState("");
  const [channel, setChannel] = useState<"all" | "call" | "sms">("all");
  const [follow, setFollow] = useState("");
  const [followKind, setFollowKind] = useState("call");
  const blockedCall = lead.suppression.call;
  const reset = () => {
    setKind(null);
    setBody("");
    setFollow("");
    setChannel("all");
    onDirty(false);
  };
  const save = useAdminMutation(
    () =>
      logActivity(lead.id, {
        kind: kind as OutcomeKind,
        ...(body.trim() ? { body: body.trim() } : {}),
        ...(kind === "do_not_contact" ? { channel } : {}),
        ...(follow && kind !== "do_not_contact" ? { followUpAt: nyLocalToIso(follow) || undefined, followUpKind: followKind } : {}),
      }),
    {
      onSuccess: () => {
        reset();
        onLogged();
        invalidateQueries(salesKeys.all);
      },
    }
  );
  const needsText = kind === "note";
  const canSave = Boolean(kind) && (!needsText || body.trim().length > 0) && (!follow || Boolean(nyLocalToIso(follow)));
  const choose = (k: OutcomeKind) => {
    setKind(k === kind ? null : k);
    onDirty(k !== kind);
  };
  return (
    <section data-outcome-form="">
      <H>Log what happened</H>
      {blockedCall && <p className="mb-2 text-[13px] font-semibold text-adm-problem" data-calls-blocked="">Calls are blocked for this person. You can still add a note.</p>}
      <div className="flex flex-wrap gap-2" role="group" aria-label="Outcome">
        {OUTCOMES.map((o) => {
          const disabled = blockedCall && o.contact;
          return (
            <button
              key={o.id}
              type="button"
              aria-pressed={kind === o.id}
              disabled={disabled}
              onClick={() => choose(o.id)}
              data-outcome={o.id}
              className={cx(
                "adm-chip",
                kind === o.id && "!border-adm-ink !bg-adm-ink !text-white",
                o.id === "do_not_contact" && kind !== o.id && "!text-adm-problem",
                disabled && "cursor-not-allowed line-through opacity-50"
              )}
            >
              {o.label}
            </button>
          );
        })}
      </div>
      {kind && (
        <div className="mt-3 space-y-3 rounded-adm-md border border-adm-line bg-adm-sunk p-3" data-outcome-details={kind}>
          {kind === "do_not_contact" && (
            <Field label="Do not contact by">
              <Select name="dnc-channel" value={channel} onChange={(e) => setChannel(e.target.value as "all" | "call" | "sms")} options={[{ value: "all", label: "Calls and texts" }, { value: "call", label: "Calls only" }, { value: "sms", label: "Texts only" }]} />
            </Field>
          )}
          <Field label={needsText ? "Note" : kind === "do_not_contact" ? "What they said (optional)" : "Note (optional)"} required={needsText}>
            <Textarea name="outcome-note" value={body} onChange={(e) => setBody(e.target.value)} rows={2} />
          </Field>
          {kind === "do_not_contact" ? (
            <p className="text-[13px] text-adm-problem">This stops calls or texts to this number for everyone, and cancels open follow-ups. Only the owner can lift it.</p>
          ) : (
            <div className="space-y-2" data-follow-up="">
              <p className="text-[13px] font-semibold text-adm-text-2">Follow up (optional)</p>
              <div className="flex flex-wrap gap-2">
                {QUICK.map((qk) => (
                  <button key={qk.label} type="button" className="adm-chip" aria-pressed={follow === qk.value()} onClick={() => setFollow(qk.value())} data-quick-follow={qk.label}>
                    {qk.label}
                  </button>
                ))}
              </div>
              <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
                <Field label="When (New York time)">
                  <TextInput name="follow-up-at" type="datetime-local" value={follow} onChange={(e) => setFollow(e.target.value)} />
                </Field>
                <Field label="Follow up by">
                  <Select name="follow-up-kind" value={followKind} onChange={(e) => setFollowKind(e.target.value)} options={TASK_KINDS.map((t) => ({ value: t.id, label: t.label }))} />
                </Field>
              </div>
            </div>
          )}
          {save.error ? <Problem code={errorCode(save.error)}>{errorMessage(save.error)}</Problem> : null}
          <div className="flex flex-wrap gap-2">
            <Button busy={save.busy} disabled={!canSave} onClick={() => save.mutate(undefined)} data-outcome-save="">
              {follow && kind !== "do_not_contact" ? "Save and set follow-up" : "Save"}
            </Button>
            <Button variant="secondary" onClick={reset} disabled={save.busy}>
              Cancel
            </Button>
          </div>
        </div>
      )}
    </section>
  );
}

function TasksBlock({ lead }: { lead: LeadDetail }) {
  const toast = useToast();
  const now = useNow();
  const [adding, setAdding] = useState(false);
  const [due, setDue] = useState(() => nyDayAt(1, 10));
  const [kind, setKind] = useState("call");
  const [note, setNote] = useState("");
  const after = () => invalidateQueries(salesKeys.all);
  const done = useAdminMutation((id: string) => updateTask(id, { status: "done" }), { onSuccess: () => (toast.show("Follow-up done."), after()) });
  const snooze = useAdminMutation((t: { id: string; dueAt: string }) => {
    const next = new Date(Math.max(Date.now(), new Date(t.dueAt).getTime()) + 86400000);
    return updateTask(t.id, { dueAt: nyLocalToIso(isoToNyLocal(next)) || next.toISOString() });
  }, { onSuccess: () => (toast.show("Moved to tomorrow."), after()) });
  const add = useAdminMutation(() => addTask(lead.id, { dueAt: nyLocalToIso(due) || "", kind, note: note.trim() }), {
    onSuccess: () => {
      setAdding(false);
      setNote("");
      toast.show("Follow-up added.");
      after();
    },
  });
  return (
    <section data-tasks="">
      <div className="flex items-center justify-between gap-2">
        <H>Follow-ups</H>
        {!adding && (
          <Button variant="tertiary" icon={<PlusIcon className="h-5 w-5" />} onClick={() => setAdding(true)} data-task-add="">
            Add
          </Button>
        )}
      </div>
      {lead.tasks.length ? (
        <ul className="space-y-2">
          {lead.tasks.map((t) => {
            const overdue = new Date(t.dueAt).getTime() < now;
            return (
              <li key={t.id} className="flex flex-wrap items-center gap-2 rounded-adm-sm border border-adm-line px-3 py-2" data-task={t.id}>
                <div className="min-w-0 flex-1">
                  <p className="text-[14px] font-semibold text-adm-ink">
                    {taskKindLabel(t.kind)} · {dateTimeText(t.dueAt)} {overdue && <StatusBadge tone="problem">Overdue</StatusBadge>}
                  </p>
                  {t.note && <p className="break-words text-[13px] text-adm-text-2">{t.note}</p>}
                </div>
                <Button variant="secondary" onClick={() => done.mutate(t.id)} data-task-done={t.id}>
                  Done
                </Button>
                <Button variant="tertiary" onClick={() => snooze.mutate(t)} data-task-snooze={t.id}>
                  Tomorrow
                </Button>
              </li>
            );
          })}
        </ul>
      ) : (
        !adding && <p className="text-[14px] text-adm-text-2">No open follow-ups.</p>
      )}
      {(done.error || snooze.error) ? <div className="mt-2"><Problem>{errorMessage(done.error || snooze.error)}</Problem></div> : null}
      {adding && (
        <div className="mt-2 space-y-2 rounded-adm-md border border-adm-line bg-adm-sunk p-3" data-task-form="">
          <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
            <Field label="When (New York time)">
              <TextInput name="task-due" type="datetime-local" value={due} onChange={(e) => setDue(e.target.value)} />
            </Field>
            <Field label="Kind">
              <Select name="task-kind" value={kind} onChange={(e) => setKind(e.target.value)} options={TASK_KINDS.map((t) => ({ value: t.id, label: t.label }))} />
            </Field>
          </div>
          <Field label="Note (optional)">
            <TextInput name="task-note" value={note} onChange={(e) => setNote(e.target.value)} />
          </Field>
          {add.error ? <Problem>{errorMessage(add.error)}</Problem> : null}
          <div className="flex gap-2">
            <Button busy={add.busy} disabled={!nyLocalToIso(due)} onClick={() => add.mutate(undefined)} data-task-save="">
              Add follow-up
            </Button>
            <Button variant="secondary" onClick={() => setAdding(false)}>
              Cancel
            </Button>
          </div>
        </div>
      )}
    </section>
  );
}

/* ------------------------------------------------------------------ */
/* request sales credit                                                */
/* ------------------------------------------------------------------ */

function checkFile(f: File | null): string {
  if (!f) return "";
  if (!EVIDENCE_TYPES.includes(f.type)) return "Attach a PDF, PNG or JPEG.";
  if (f.size > EVIDENCE_MAX) return "Files can be up to 5 MB.";
  return "";
}

function CreditRequestStep({ lead, sale, onDone, onDirty }: { lead: LeadDetail; sale: LeadSale; onDone: () => void; onDirty: (d: boolean) => void }) {
  const [kind, setKind] = useState<RequestKind | null>(sale.kind === "membership_change_paid" ? "upgrade" : null);
  const [explanation, setExplanation] = useState("");
  const [refs, setRefs] = useState<string[]>([""]);
  const [note, setNote] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const [created, setCreated] = useState<CreditRequest | null>(null);
  const [uploadError, setUploadError] = useState("");
  const [uploaded, setUploaded] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);
  const fileProblem = checkFile(file);
  const mark = () => onDirty(true);

  const upload = async (requestId: string) => {
    if (!file) return;
    setUploadError("");
    try {
      const r = await uploadEvidence(requestId, file);
      setCreated(r);
      setUploaded(true);
    } catch (e) {
      setUploadError(errorMessage(e, "The file could not be uploaded."));
    }
  };

  const submit = useAdminMutation(
    () => createRequest({ leadId: lead.id, saleId: sale.id, kind: kind as RequestKind, explanation: explanation.trim(), ghlReferences: refs.map((r) => r.trim()).filter(Boolean), ...(note.trim() ? { note: note.trim() } : {}) }),
    {
      onSuccess: async (r) => {
        setCreated(r);
        onDirty(false);
        invalidateQueries(salesKeys.all);
        if (file) await upload(r.id);
      },
    }
  );

  if (created) {
    return (
      <div className="space-y-4" data-credit-result={created.id}>
        <Notice tone="ok">Sent to the owner. You&apos;ll see the decision under More › Credit requests.</Notice>
        <dl className="grid grid-cols-1 gap-2 text-[14px]">
          <div className="rounded-adm-sm border border-adm-line px-3 py-2" data-credit-proposed="">
            <dt className="text-adm-text-2">Proposed commission (the owner may change it)</dt>
            <dd className="adm-num text-[18px] font-semibold text-adm-ink">{money(created.proposed.amountCents)}</dd>
            {created.proposed.detail && <dd className="mt-0.5 break-words text-[13px] text-adm-text-2">{created.proposed.detail}</dd>}
          </div>
          <div className="rounded-adm-sm border border-adm-line px-3 py-2" data-credit-bonus="">
            <dt className="text-adm-text-2">Bonus</dt>
            <dd className="text-[14px] text-adm-ink">{created.proposed.countsForBonusDefault ? "If approved, this sale counts toward your 20-membership bonus." : "This sale does not count toward the bonus unless the owner decides so."}</dd>
          </div>
        </dl>
        <p className="text-[13px] text-adm-text-3">This is a claim, not earnings, until the owner approves it.</p>
        {file && (
          <div data-credit-upload={uploaded ? "done" : uploadError ? "failed" : "running"}>
            {uploaded ? (
              <p className="flex items-center gap-2 text-[14px] text-adm-ok">
                <PaperClipIcon className="h-5 w-5" aria-hidden="true" /> {file.name} attached.
              </p>
            ) : uploadError ? (
              <div className="space-y-2">
                <Problem code="UPLOAD">The request was sent, but the file was not attached: {uploadError}</Problem>
                <Button variant="secondary" onClick={() => upload(created.id)}>
                  Try the upload again
                </Button>
              </div>
            ) : (
              <p className="text-[14px] text-adm-text-2">Uploading {file.name}…</p>
            )}
          </div>
        )}
        <Button large onClick={onDone} data-credit-done="">
          Back to the lead
        </Button>
      </div>
    );
  }

  const canSend = Boolean(kind) && explanation.trim().length >= 10 && !fileProblem;
  return (
    <form
      className="space-y-4"
      onSubmit={(e) => {
        e.preventDefault();
        if (canSend) void submit.mutate(undefined);
      }}
      data-credit-form={sale.id}
    >
      <div className="rounded-adm-sm border border-adm-line px-3 py-2">
        <p className="text-[14px] font-semibold text-adm-ink">{sale.label}</p>
        <p className="text-[13px] text-adm-text-2">
          {lead.name} · paid {dateText(sale.paidAt)} · {money(sale.paidPreTaxCents)} excl. tax
        </p>
        <p className="text-[13px] text-adm-text-2">{SALE_STATUS[sale.status] || sale.status}</p>
      </div>
      <fieldset>
        <legend className="mb-2 text-[13px] font-semibold text-adm-text-2">What kind of credit?</legend>
        <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
          {REQUEST_KINDS.map((k) => (
            <button
              key={k.id}
              type="button"
              aria-pressed={kind === k.id}
              onClick={() => {
                setKind(k.id);
                mark();
              }}
              data-credit-kind={k.id}
              className={cx("min-h-11 rounded-adm-sm border px-3 py-2 text-left", kind === k.id ? "border-adm-accent bg-adm-accent-soft" : "border-adm-line hover:border-adm-line-2")}
            >
              <span className="block text-[14px] font-semibold text-adm-ink">{k.label}</span>
              <span className="block text-[12px] leading-4 text-adm-text-2">{k.hint}</span>
            </button>
          ))}
        </div>
      </fieldset>
      <Field label="What did you do for this sale?" required help="At least a sentence. The owner reads this first.">
        <Textarea
          name="credit-explanation"
          value={explanation}
          rows={4}
          onChange={(e) => {
            setExplanation(e.target.value);
            mark();
          }}
        />
      </Field>
      <fieldset className="space-y-2">
        <legend className="text-[13px] font-semibold text-adm-text-2">GHL references (calls, texts, notes)</legend>
        {refs.map((r, i) => (
          <TextInput
            key={i}
            name={`credit-ref-${i}`}
            aria-label={`GHL reference ${i + 1}`}
            value={r}
            placeholder="A GHL link or what to look for, e.g. call on Nov 10 at 2 PM"
            onChange={(e) => {
              setRefs(refs.map((x, j) => (j === i ? e.target.value : x)));
              mark();
            }}
          />
        ))}
        {refs.length < 10 && (
          <Button variant="tertiary" icon={<PlusIcon className="h-5 w-5" />} onClick={() => setRefs([...refs, ""])} data-credit-add-ref="">
            Add another reference
          </Button>
        )}
      </fieldset>
      <Field label="Note (optional)">
        <TextInput name="credit-note" value={note} onChange={(e) => setNote(e.target.value)} />
      </Field>
      <Field label="Attach a file (optional)" help="One PDF, PNG or JPEG, up to 5 MB: a screenshot of the conversation, for example." error={fileProblem || undefined}>
        <input
          ref={fileRef}
          name="credit-file"
          type="file"
          accept="application/pdf,image/png,image/jpeg"
          onChange={(e) => setFile(e.target.files?.[0] || null)}
          className="block w-full min-w-0 text-[14px] text-adm-ink file:mr-3 file:min-h-[44px] file:rounded-adm-sm file:border file:border-adm-line-2 file:bg-adm-surface file:px-3 file:text-[14px] file:font-semibold"
        />
      </Field>
      {submit.error ? <Problem code={errorCode(submit.error)}>{errorMessage(submit.error)}</Problem> : null}
      <div className="flex flex-wrap gap-2">
        <Button large type="submit" busy={submit.busy} disabled={!canSend} data-credit-submit="">
          Send to the owner
        </Button>
        <Button
          large
          variant="secondary"
          onClick={() => {
            onDirty(false);
            onDone();
          }}
          disabled={submit.busy}
        >
          Back
        </Button>
      </div>
    </form>
  );
}

/** Add one file to an open request (from the Credit requests list). */
export function EvidenceUpload({ requestId }: { requestId: string }) {
  const toast = useToast();
  const ref = useRef<HTMLInputElement>(null);
  const [error, setError] = useState("");
  const send = useAdminMutation((f: File) => uploadEvidence(requestId, f), {
    onSuccess: () => {
      toast.show("File attached.");
      invalidateQueries(salesKeys.requests);
    },
    onError: (e) => setError(errorMessage(e, "The file could not be uploaded.")),
  });
  return (
    <>
      <input
        ref={ref}
        type="file"
        className="sr-only"
        accept="application/pdf,image/png,image/jpeg"
        aria-label="Attach a file"
        data-evidence-input={requestId}
        onChange={(e) => {
          const f = e.target.files?.[0] || null;
          e.target.value = "";
          const problem = checkFile(f);
          setError(problem);
          if (f && !problem) void send.mutate(f);
        }}
      />
      <Button variant="secondary" icon={<PaperClipIcon className="h-5 w-5" />} busy={send.busy} onClick={() => ref.current?.click()}>
        Attach a file
      </Button>
      {error ? <Problem>{error}</Problem> : null}
    </>
  );
}
