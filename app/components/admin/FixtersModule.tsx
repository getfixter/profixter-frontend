"use client";

/**
 * Team: every staff account and what each one can open in Admin.
 *
 * Owner only (the section and every API behind it). An employee has a title the
 * owner types (display only), optional field work - Fixter or General Fixter,
 * the job access those always had - and Admin sections switched on one by
 * one. Nothing here is a role: two people titled "Marketing Manager" can have
 * completely different access. The server (BackEnd utils/adminAccess.js)
 * holds the list of sections and enforces every one of them.
 *
 * DISABLING (audit J-21). Disabling never touches anyone's jobs, but the
 * owner is told how many upcoming jobs still name the person and can move
 * them in one step through POST /fixters/:id/reassign-future-jobs, which goes
 * through the reservation engine (availability and double-booking rules as
 * usual). One sheet walks through the steps, so no dialog opens over another.
 */

import { useCallback, useEffect, useMemo, useState } from "react";
import {
  createFixter,
  deleteFixter,
  getAccessRegistry,
  getAdminActivitySummary,
  getFixters,
  setDefaultFixter,
  setFixterAvailabilityStatus,
  updateFixter,
  type AccessRegistry,
  type AdminActivitySummary,
  type EmployeeAvailabilityStatus,
  type FieldWork,
  type FixterAccount,
} from "@/lib/admin-service";
import {
  getFixterFutureJobs,
  reassignFixterFutureJobs,
  setFixterActiveWithJobs,
  type FutureJob,
  type ReassignResult,
} from "@/lib/admin/sections-api";
import {
  Button,
  EmptyState,
  ErrorState,
  Field,
  Select,
  Sheet,
  SkeletonRows,
  StatusBadge,
  TextInput,
  cx,
  useToast,
} from "@/app/components/admin/ui";

type Form = {
  firstName: string;
  lastName: string;
  email: string;
  phone: string;
  employeeTitle: string;
  employeePosition: FieldWork;
  adminSections: string[];
};

const EMPTY: Form = { firstName: "", lastName: "", email: "", phone: "", employeeTitle: "", employeePosition: null, adminSections: [] };

const AVAILABILITY_STATUSES: EmployeeAvailabilityStatus[] = ["Available", "Busy", "Vacation", "Sick", "Training", "Inactive"];

const FIELD_WORK: Array<{ value: FieldWork; label: string; hint: string }> = [
  { value: null, label: "None", hint: "Office, marketing, sales - Admin sections only" },
  { value: "Fixter", label: "Fixter", hint: "Does jobs: their own jobs, tips and work photos" },
  { value: "General Fixter", label: "General Fixter", hint: "Runs all jobs, assigns Fixters, members and schedule" },
];

/* Older accounts may have only a full name, or only an email. */
const displayName = (row: FixterAccount) => `${row.firstName || ""} ${row.lastName || ""}`.trim() || row.name || row.email;
const firstWord = (value: string) => value.trim().split(" ")[0] || "";
const errorMessage = (caught: unknown, fallback: string) => (caught as { response?: { data?: { message?: string } } })?.response?.data?.message || fallback;

const jobDate = (iso: string) => {
  const d = new Date(iso);
  return Number.isNaN(d.getTime())
    ? ""
    : d.toLocaleString("en-US", { timeZone: "America/New_York", weekday: "short", month: "short", day: "numeric", hour: "numeric", minute: "2-digit" });
};
const formatOffDay = (value: string) => new Date(`${value}T12:00:00`).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });

function Switch({ on, disabled, onChange, label }: { on: boolean; disabled?: boolean; onChange: (next: boolean) => void; label: string }) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={on}
      aria-label={label}
      disabled={disabled}
      onClick={() => onChange(!on)}
      className={cx("relative flex h-11 w-[52px] flex-none items-center justify-center disabled:cursor-not-allowed", disabled && "opacity-50")}
    >
      <span className={cx("relative block h-[26px] w-[44px] rounded-full transition-colors motion-reduce:transition-none", on ? "bg-adm-accent" : "bg-adm-line-2")}>
        <span className={cx("absolute left-0 top-[3px] h-5 w-5 rounded-full bg-adm-surface transition-transform motion-reduce:transition-none", on ? "translate-x-[21px]" : "translate-x-[3px]")} />
      </span>
    </button>
  );
}

/* ------------------------------------------------------------------ */
/* disable + reassign, one sheet with steps                            */
/* ------------------------------------------------------------------ */

type Flow =
  | { step: "disable"; row: FixterAccount; jobs: FutureJob[] | null; loadError: string }
  | { step: "reassign"; row: FixterAccount; jobs: FutureJob[] | null; loadError: string; justDisabled: boolean }
  | { step: "confirm-move"; row: FixterAccount; jobs: FutureJob[]; target: string }
  | { step: "result"; row: FixterAccount; result: ReassignResult };

function JobList({ jobs }: { jobs: FutureJob[] }) {
  const shown = jobs.slice(0, 6);
  return (
    <ul className="mt-3 divide-y divide-adm-line rounded-adm-sm border border-adm-line" data-future-jobs>
      {shown.map((j) => (
        <li key={j.id} className="px-3 py-2 text-[14px]">
          <span className="font-semibold text-adm-ink">{jobDate(j.date)}</span>
          <span className="block text-[13px] text-adm-text-2">
            {j.customerName || "Customer"}
            {j.bookingNumber ? ` · #${String(j.bookingNumber).replace(/^#/, "")}` : ""}
            {j.status ? ` · ${j.status}` : ""}
          </span>
        </li>
      ))}
      {jobs.length > shown.length ? <li className="px-3 py-2 text-[13px] text-adm-text-2">and {jobs.length - shown.length} more</li> : null}
    </ul>
  );
}

function DisableFlow({
  flow,
  setFlow,
  targets,
  onChanged,
}: {
  flow: Flow;
  setFlow: (next: Flow | null) => void;
  targets: FixterAccount[];
  onChanged: () => Promise<void>;
}) {
  const toast = useToast();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [target, setTarget] = useState("auto");
  const name = displayName(flow.row);
  const first = flow.row.firstName || firstWord(name);
  const others = targets.filter((t) => t.id !== flow.row.id && t.isActive && t.employeePosition);
  const targetName = (id: string) => (id === "auto" ? "the best free Fixter for each job" : displayName(others.find((o) => o.id === id) || flow.row));

  const close = () => {
    if (busy) return;
    setError("");
    setFlow(null);
  };

  const run = async (fn: () => Promise<void>) => {
    if (busy) return;
    setBusy(true);
    setError("");
    try {
      await fn();
    } catch (caught) {
      setError(errorMessage(caught, "That did not work. Nothing was changed. Try again."));
    } finally {
      setBusy(false);
    }
  };

  const disable = () =>
    run(async () => {
      const { futureAssignedJobs } = await setFixterActiveWithJobs(flow.row.id, false);
      await onChanged();
      const jobs = flow.step === "disable" ? flow.jobs : null;
      const count = futureAssignedJobs ?? jobs?.length ?? 0;
      if (count > 0) {
        let fresh: FutureJob[] | null = jobs;
        try {
          fresh = (await getFixterFutureJobs(flow.row.id)).jobs;
        } catch {
          /* keep what we had */
        }
        setFlow({ step: "reassign", row: { ...flow.row, isActive: false }, jobs: fresh, loadError: "", justDisabled: true });
      } else {
        toast.show(`${first} is disabled and can no longer open Admin.`);
        setFlow(null);
      }
    });

  const move = () =>
    run(async () => {
      if (flow.step !== "confirm-move") return;
      const result = await reassignFixterFutureJobs(flow.row.id, flow.target);
      await onChanged();
      setFlow({ step: "result", row: flow.row, result });
    });

  let title = "";
  let body: React.ReactNode = null;
  let footer: React.ReactNode = null;

  if (flow.step === "disable") {
    const count = flow.jobs?.length ?? 0;
    title = `Disable ${name}?`;
    body = (
      <>
        <p className="text-[15px] leading-relaxed text-adm-ink">
          {first} can no longer open Admin and stops being offered for new jobs. Their history is kept.
        </p>
        {flow.jobs === null && !flow.loadError ? (
          <p className="mt-3 text-[14px] text-adm-text-2">Checking their upcoming jobs…</p>
        ) : flow.loadError ? (
          <p className="mt-3 rounded-adm-sm bg-adm-attn-bg px-3 py-2 text-[14px] text-adm-attn">Could not check their upcoming jobs ({flow.loadError}). You can still disable; you will see the count afterwards.</p>
        ) : count ? (
          <>
            <p className="mt-3 text-[15px] font-semibold text-adm-attn" data-future-count>
              {count} upcoming {count === 1 ? "job is" : "jobs are"} assigned to {first}.
            </p>
            <p className="text-[14px] text-adm-text-2">They stay assigned until you move them. You can move them in the next step.</p>
            <JobList jobs={flow.jobs || []} />
          </>
        ) : (
          <p className="mt-3 text-[14px] text-adm-text-2" data-future-count>
            No upcoming jobs are assigned to {first}.
          </p>
        )}
      </>
    );
    footer = (
      <>
        <Button variant="secondary" large onClick={close} disabled={busy}>
          Cancel
        </Button>
        <Button variant="danger" large busy={busy} onClick={disable} disabled={flow.jobs === null && !flow.loadError} data-confirm-disable>
          {`Disable ${first}`}
        </Button>
      </>
    );
  } else if (flow.step === "reassign") {
    const jobs = flow.jobs || [];
    title = `Move ${first}'s upcoming jobs`;
    body = (
      <>
        {flow.justDisabled ? <p className="mb-3 rounded-adm-sm bg-adm-ok-bg px-3 py-2 text-[14px] text-adm-ok">{first} is disabled.</p> : null}
        {flow.jobs === null && !flow.loadError ? (
          <p className="text-[14px] text-adm-text-2">Loading their upcoming jobs…</p>
        ) : flow.loadError ? (
          <ErrorState message={flow.loadError} />
        ) : !jobs.length ? (
          <p className="text-[15px] text-adm-ink">No upcoming jobs are assigned to {first}.</p>
        ) : (
          <>
            <p className="text-[15px] text-adm-ink" data-future-count>
              {jobs.length} upcoming {jobs.length === 1 ? "job still names" : "jobs still name"} {first}.
            </p>
            <JobList jobs={jobs} />
            <Field label="Who takes them" className="mt-4">
              <Select
                value={target}
                onChange={(e) => setTarget(e.target.value)}
                options={[{ value: "auto", label: "Best free Fixter for each job" }, ...others.map((o) => ({ value: o.id, label: displayName(o) }))]}
                data-reassign-target
              />
            </Field>
          </>
        )}
      </>
    );
    footer = (
      <>
        <Button variant="secondary" large onClick={close} disabled={busy}>
          {jobs.length ? "Not now" : "Done"}
        </Button>
        {jobs.length ? (
          <Button large onClick={() => setFlow({ step: "confirm-move", row: flow.row, jobs, target })} data-reassign>
            {`Move ${jobs.length} ${jobs.length === 1 ? "job" : "jobs"}`}
          </Button>
        ) : null}
      </>
    );
  } else if (flow.step === "confirm-move") {
    const n = flow.jobs.length;
    title = `Move ${n} ${n === 1 ? "job" : "jobs"}?`;
    body = (
      <>
        <p className="text-[15px] leading-relaxed text-adm-ink" data-move-consequence>
          {n} upcoming {n === 1 ? "job moves" : "jobs move"} from {first} to {targetName(flow.target)}, checked against availability like any assignment. Confirmed customers get the usual text naming their new Fixter where texting is allowed. A job that cannot move stays with {first} and is listed.
        </p>
      </>
    );
    footer = (
      <>
        <Button variant="secondary" large onClick={() => setFlow({ step: "reassign", row: flow.row, jobs: flow.jobs, loadError: "", justDisabled: false })} disabled={busy}>
          Back
        </Button>
        <Button large busy={busy} onClick={move} data-confirm-move>
          {`Move ${n} ${n === 1 ? "job" : "jobs"}`}
        </Button>
      </>
    );
  } else {
    const { moved, failed, total } = flow.result;
    title = failed.length ? "Some jobs did not move" : "Jobs moved";
    body = (
      <div data-reassign-result>
        <p className="text-[15px] text-adm-ink">
          {moved.length} of {total} {total === 1 ? "job" : "jobs"} moved.
        </p>
        {moved.length ? (
          <ul className="mt-3 divide-y divide-adm-line rounded-adm-sm border border-adm-line">
            {moved.map((m) => (
              <li key={m.id} className="px-3 py-2 text-[14px]">
                <span className="text-adm-ink">{jobDate(m.date)}</span>
                <span className="block text-[13px] text-adm-ok">Now with {m.toFixterName || "another Fixter"}</span>
              </li>
            ))}
          </ul>
        ) : null}
        {failed.length ? (
          <ul className="mt-3 divide-y divide-adm-line rounded-adm-sm border border-adm-line" data-reassign-failed>
            {failed.map((m) => (
              <li key={m.id} className="px-3 py-2 text-[14px]">
                <span className="text-adm-ink">{jobDate(m.date)}</span>
                {m.bookingNumber ? <span className="text-adm-text-2"> · #{String(m.bookingNumber).replace(/^#/, "")}</span> : null}
                <span className="block text-[13px] text-adm-problem">{m.message || "Could not move this job"}. It stays with {first}; open the job to assign it.</span>
              </li>
            ))}
          </ul>
        ) : null}
      </div>
    );
    footer = (
      <Button large block onClick={close}>
        Done
      </Button>
    );
  }

  return (
    <Sheet open onClose={close} title={title} busy={busy} variant="dialog" footer={footer}>
      {body}
      {error ? (
        <p role="alert" className="mt-4 rounded-adm-sm bg-adm-problem-bg px-3 py-2 text-[14px] font-medium text-adm-problem">
          {error}
        </p>
      ) : null}
    </Sheet>
  );
}

/* ------------------------------------------------------------------ */
/* the module                                                          */
/* ------------------------------------------------------------------ */

export default function FixtersModule() {
  const toast = useToast();
  const [rows, setRows] = useState<FixterAccount[] | null>(null);
  const [registry, setRegistry] = useState<AccessRegistry | null>(null);
  const [activitySummary, setActivitySummary] = useState<AdminActivitySummary | null>(null);
  const [error, setError] = useState("");
  const [rowError, setRowError] = useState("");

  const [editorOpen, setEditorOpen] = useState(false);
  const [editing, setEditing] = useState<FixterAccount | null>(null);
  const [form, setForm] = useState<Form>(EMPTY);
  const [initialForm, setInitialForm] = useState<Form>(EMPTY);
  const [formError, setFormError] = useState("");
  const [saving, setSaving] = useState(false);

  const [deleting, setDeleting] = useState<FixterAccount | null>(null);
  const [deleteConfirmation, setDeleteConfirmation] = useState("");
  const [deleteSaving, setDeleteSaving] = useState(false);
  const [deleteError, setDeleteError] = useState("");
  const [historyFixter, setHistoryFixter] = useState<FixterAccount | null>(null);
  const [flow, setFlow] = useState<Flow | null>(null);

  const load = useCallback(async () => {
    try {
      const [fixters, summary, reg] = await Promise.all([getFixters(), getAdminActivitySummary(), getAccessRegistry()]);
      setRows(Array.isArray(fixters) ? fixters : []);
      setActivitySummary(summary);
      setRegistry(reg);
      setError("");
    } catch (caught) {
      setError(errorMessage(caught, "Employees couldn't load. Try again."));
    }
  }, []);

  useEffect(() => {
     
    void load();
  }, [load]);

  const sectionLabel = useMemo(() => new Map((registry?.sections || []).map((s) => [s.id, s.label])), [registry]);
  const included = useMemo(() => new Set(form.employeePosition ? registry?.includedByPosition?.[form.employeePosition] || [] : []), [registry, form.employeePosition]);

  /* ------------------------------ editor ------------------------------ */
  const openNew = () => {
    setEditing(null);
    setForm(EMPTY);
    setInitialForm(EMPTY);
    setFormError("");
    setEditorOpen(true);
  };
  const openEdit = (row: FixterAccount) => {
    const next: Form = {
      firstName: row.firstName,
      lastName: row.lastName,
      email: row.email,
      phone: row.phone,
      employeeTitle: row.employeeTitle || "",
      employeePosition: row.employeePosition || null,
      adminSections: row.adminSections || [],
    };
    setEditing(row);
    setForm(next);
    setInitialForm(next);
    setFormError("");
    setEditorOpen(true);
  };
  const closeEditor = () => {
    if (saving) return;
    setEditorOpen(false);
    setEditing(null);
  };
  const dirty = JSON.stringify(form) !== JSON.stringify(initialForm);

  const toggleSection = (id: string, on: boolean) =>
    setForm((current) => {
      const next = new Set(current.adminSections);
      if (on) next.add(id);
      else {
        next.delete(id);
        // A section that needs this one goes with it (Customer Map needs Overview).
        for (const s of registry?.sections || []) if (s.requires === id) next.delete(s.id);
      }
      return { ...current, adminSections: (registry?.sections || []).map((s) => s.id).filter((sid) => next.has(sid)) };
    });

  const submit = async (event?: React.FormEvent) => {
    event?.preventDefault();
    if (saving) return;
    if (!form.firstName.trim() || !form.lastName.trim() || (!editing && !form.email.trim()) || (form.employeePosition && !form.phone.trim())) {
      setFormError(form.employeePosition && !form.phone.trim() ? "Field staff need a phone number." : "First name, last name and email are required.");
      return;
    }
    setSaving(true);
    setFormError("");
    try {
      const payload = {
        firstName: form.firstName,
        lastName: form.lastName,
        phone: form.phone,
        employeePosition: form.employeePosition,
        employeeTitle: form.employeeTitle,
        adminSections: form.adminSections,
      };
      if (editing) {
        await updateFixter(editing.id, payload);
        toast.show(`${form.firstName}'s access is saved. It applies from their next action.`);
      } else {
        await createFixter({ ...payload, email: form.email });
        toast.show(`${form.firstName} can sign in with the temporary password 11111111 and will be asked to change it.`, { duration: 8000 });
      }
      setEditorOpen(false);
      setEditing(null);
      await load();
    } catch (caught) {
      setFormError(errorMessage(caught, "Couldn't save. Check the details and try again."));
    } finally {
      setSaving(false);
    }
  };

  /* ------------------------------ row actions ------------------------------ */
  const startDisable = (row: FixterAccount) => {
    setRowError("");
    setFlow({ step: "disable", row, jobs: null, loadError: "" });
    getFixterFutureJobs(row.id)
      .then(({ jobs }) => setFlow((f) => (f && f.step === "disable" && f.row.id === row.id ? { ...f, jobs } : f)))
      .catch((caught) => setFlow((f) => (f && f.step === "disable" && f.row.id === row.id ? { ...f, jobs: [], loadError: errorMessage(caught, "the check failed") } : f)));
  };
  const startReassign = (row: FixterAccount) => {
    setFlow({ step: "reassign", row, jobs: null, loadError: "", justDisabled: false });
    getFixterFutureJobs(row.id)
      .then(({ jobs }) => setFlow((f) => (f && f.step === "reassign" && f.row.id === row.id ? { ...f, jobs } : f)))
      .catch((caught) => setFlow((f) => (f && f.step === "reassign" && f.row.id === row.id ? { ...f, loadError: errorMessage(caught, "Could not load their upcoming jobs.") } : f)));
  };
  const enable = async (row: FixterAccount) => {
    setRowError("");
    try {
      await setFixterActiveWithJobs(row.id, true);
      toast.show(`${row.firstName || displayName(row)} is active again.`);
      await load();
    } catch (caught) {
      setRowError(errorMessage(caught, "Couldn't change the status."));
    }
  };
  const changeAvailability = async (row: FixterAccount, status: EmployeeAvailabilityStatus) => {
    setRowError("");
    try {
      await setFixterAvailabilityStatus(row.id, status);
      await load();
    } catch (caught) {
      setRowError(errorMessage(caught, "Couldn't change the availability."));
    }
  };
  const toggleDefault = async (row: FixterAccount) => {
    setRowError("");
    try {
      setRows(await setDefaultFixter(row.id, !row.isDefaultFixter));
    } catch (caught) {
      setRowError(errorMessage(caught, "Couldn't change the default Fixter."));
    }
  };

  /* Type the first name or the full name. Never satisfied by an empty box. */
  const deleteConfirmationMatches = deleting
    ? !!deleteConfirmation.trim() &&
      [firstWord(displayName(deleting)), displayName(deleting)]
        .map((value) => value.trim().toLowerCase())
        .filter(Boolean)
        .includes(deleteConfirmation.trim().toLowerCase())
    : false;

  const confirmDelete = async () => {
    if (!deleting || !deleteConfirmationMatches || deleteSaving) return;
    setDeleteSaving(true);
    setDeleteError("");
    try {
      await deleteFixter(deleting.id);
      toast.show(`${displayName(deleting)} was deleted.`);
      setDeleting(null);
      setDeleteConfirmation("");
      await load();
    } catch (caught) {
      setDeleteError(errorMessage(caught, "Failed to delete the employee"));
    } finally {
      setDeleteSaving(false);
    }
  };

  const accessSummary = (row: FixterAccount) => {
    const names = (row.adminSections || []).map((id) => sectionLabel.get(id) || id);
    const parts = [] as string[];
    if (row.employeePosition) parts.push(`${row.employeePosition} jobs`);
    if (names.length) parts.push(names.length <= 3 ? names.join(", ") : `${names.length} sections`);
    return parts.length ? parts.join(" · ") : "No Admin sections";
  };

  return (
    <div className="space-y-4" data-team>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="min-w-0 flex-1 text-[14px] text-adm-text-2">Each person sees only the sections you switch on. Titles are just labels.</p>
        <Button onClick={openNew}>Add employee</Button>
      </div>

      <dl className="grid grid-cols-3 gap-2" aria-label="Deletions in the last 24 hours">
        {(
          [
            ["Users deleted", activitySummary?.usersDeleted ?? 0],
            ["Leads deleted", activitySummary?.leadsDeleted ?? 0],
            ["Projects deleted", activitySummary?.projectsDeleted ?? 0],
          ] as Array<[string, number]>
        ).map(([label, value]) => (
          <div key={label} className="min-w-0 rounded-adm-md border border-adm-line bg-adm-surface px-3 py-2">
            <dd className="adm-num text-[18px] font-semibold text-adm-ink">{value}</dd>
            <dt className="text-[12px] text-adm-text-2">{label} · 24h</dt>
          </div>
        ))}
      </dl>

      {rowError ? (
        <p role="alert" className="rounded-adm-sm bg-adm-problem-bg px-3 py-2 text-[14px] text-adm-problem">
          {rowError}
        </p>
      ) : null}

      {error && !rows ? (
        <ErrorState message={error} onRetry={load} />
      ) : !rows ? (
        <SkeletonRows count={4} />
      ) : !rows.length ? (
        <EmptyState message="No employees yet." action={<Button onClick={openNew}>Add employee</Button>} />
      ) : (
        <ul role="list" className="overflow-hidden rounded-adm-md border border-adm-line bg-adm-surface" aria-label="Employees">
          {rows.map((row) => (
            <li key={row.id} className="min-w-0 border-b border-adm-line last:border-b-0" data-employee={row.id}>
              <div className="flex items-start gap-3 px-4 py-3">
                <button type="button" onClick={() => openEdit(row)} className="min-h-11 min-w-0 flex-1 text-left" aria-label={`Edit ${displayName(row)}`}>
                  <span className="flex flex-wrap items-center gap-1.5">
                    <span className="break-words text-[15px] font-semibold text-adm-ink">{displayName(row)}</span>
                    {row.isActive ? <StatusBadge tone="success">Active</StatusBadge> : <StatusBadge tone="neutral">Disabled</StatusBadge>}
                    {row.isDefaultFixter ? <StatusBadge tone="info">Default</StatusBadge> : null}
                    {row.mustChangePassword ? <StatusBadge tone="attention">Temporary password</StatusBadge> : null}
                  </span>
                  <span className="mt-0.5 block break-words text-[14px] text-adm-text-2">{row.employeeTitle || row.employeePosition || "No title"}</span>
                  <span className="mt-0.5 block truncate text-[13px] text-adm-text-2">{accessSummary(row)}</span>
                  <span className="mt-0.5 block truncate text-[12px] text-adm-text-3">
                    {row.email}
                    {row.phone ? ` · ${row.phone}` : ""}
                  </span>
                </button>
                <div className="flex shrink-0 flex-col items-end gap-1">
                  {row.isActive ? (
                    <Button variant="secondary" onClick={() => startDisable(row)} data-disable={row.id}>
                      Disable
                    </Button>
                  ) : (
                    <Button variant="secondary" onClick={() => enable(row)}>
                      Enable
                    </Button>
                  )}
                </div>
              </div>

              {/* Field work only: availability, default assignee and off days, as before. */}
              {row.employeePosition ? (
                <div className="flex flex-wrap items-center gap-x-4 gap-y-1 border-t border-adm-line bg-adm-sunk px-4 py-2 text-[13px] text-adm-text-2">
                  <label className="flex items-center gap-2">
                    <span className="font-semibold">Status</span>
                    <select
                      value={row.employeeAvailabilityStatus || "Available"}
                      onChange={(event) => changeAvailability(row, event.target.value as EmployeeAvailabilityStatus)}
                      className="h-11 rounded-adm-sm border border-adm-line-2 bg-adm-surface px-2 text-[14px] text-adm-ink sm:h-9"
                      aria-label={`Availability of ${displayName(row)}`}
                    >
                      {AVAILABILITY_STATUSES.map((status) => (
                        <option key={status} value={status}>
                          {status}
                        </option>
                      ))}
                    </select>
                  </label>
                  <span className="adm-num">Completed jobs: {row.completedBookingsCount}</span>
                  <span className="adm-num">Off days: {row.offDaysSummary?.upcomingCount ?? 0} upcoming</span>
                  {row.offDaysSummary?.recent?.length ? (
                    <Button variant="tertiary" onClick={() => setHistoryFixter(row)}>
                      Off-day history
                    </Button>
                  ) : null}
                  {row.isActive ? (
                    <Button variant="tertiary" onClick={() => toggleDefault(row)}>
                      {row.isDefaultFixter ? "Remove default" : "Make default for new jobs"}
                    </Button>
                  ) : (
                    <Button variant="tertiary" onClick={() => startReassign(row)} data-move-jobs={row.id}>
                      Move upcoming jobs
                    </Button>
                  )}
                </div>
              ) : null}
            </li>
          ))}
        </ul>
      )}

      {/* ------------------------------ editor ------------------------------ */}
      <Sheet
        open={editorOpen}
        onClose={closeEditor}
        title={editing ? displayName(editing) : "Add employee"}
        dirty={dirty}
        busy={saving}
        width="wide"
        footer={
          <>
            <Button variant="secondary" large onClick={closeEditor} disabled={saving}>
              Cancel
            </Button>
            <Button large busy={saving} onClick={() => submit()}>
              {editing ? "Save" : "Save employee"}
            </Button>
          </>
        }
      >
        <form onSubmit={submit} className="space-y-5" aria-label={editing ? `Edit ${editing.firstName}` : "Add employee"}>
          <fieldset>
            <legend className="text-[13px] font-semibold text-adm-text-2">Employee</legend>
            <div className="mt-2 grid grid-cols-1 gap-3 sm:grid-cols-2">
              <Field label="First name" required>
                <TextInput required value={form.firstName} onChange={(e) => setForm({ ...form, firstName: e.target.value })} autoComplete="off" />
              </Field>
              <Field label="Last name" required>
                <TextInput required value={form.lastName} onChange={(e) => setForm({ ...form, lastName: e.target.value })} autoComplete="off" />
              </Field>
              <Field label="Email (their login)" required={!editing}>
                <TextInput required type="email" inputMode="email" autoCapitalize="none" disabled={!!editing} value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} autoComplete="off" />
              </Field>
              <Field label={form.employeePosition ? "Phone" : "Phone (optional)"} required={!!form.employeePosition}>
                <TextInput type="tel" inputMode="tel" required={!!form.employeePosition} value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} autoComplete="off" />
              </Field>
              <Field label="Title" help="Only a label, e.g. Marketing Manager. Access is set below." className="sm:col-span-2">
                <TextInput value={form.employeeTitle} maxLength={80} onChange={(e) => setForm({ ...form, employeeTitle: e.target.value })} />
              </Field>
            </div>
          </fieldset>

          <fieldset>
            <legend className="text-[13px] font-semibold text-adm-text-2">Field work</legend>
            <div className="mt-2 grid grid-cols-1 gap-2 sm:grid-cols-3">
              {FIELD_WORK.map((option) => {
                const selected = (form.employeePosition || null) === option.value;
                return (
                  <button
                    key={option.label}
                    type="button"
                    aria-pressed={selected}
                    onClick={() => setForm({ ...form, employeePosition: option.value })}
                    className={cx("min-h-11 rounded-adm-sm border px-3 py-2.5 text-left", selected ? "border-adm-accent bg-adm-accent-soft" : "border-adm-line hover:border-adm-line-2")}
                  >
                    <span className={cx("block text-[14px] font-semibold", selected ? "text-adm-accent-ink" : "text-adm-ink")}>{option.label}</span>
                    <span className="block text-[12px] leading-4 text-adm-text-2">{option.hint}</span>
                  </button>
                );
              })}
            </div>
          </fieldset>

          <fieldset>
            <div className="flex flex-wrap items-center justify-between gap-2">
              <legend className="text-[13px] font-semibold text-adm-text-2">Admin access</legend>
              <div className="flex gap-1.5">
                <Button variant="secondary" onClick={() => setForm((c) => ({ ...c, adminSections: (registry?.sections || []).map((s) => s.id) }))}>
                  Select all
                </Button>
                <Button variant="secondary" onClick={() => setForm((c) => ({ ...c, adminSections: [] }))}>
                  Clear all
                </Button>
              </div>
            </div>
            {!registry ? (
              <p className="mt-3 text-[14px] text-adm-text-2">Loading sections…</p>
            ) : (
              <div className="mt-2 space-y-3">
                {(registry.groups || []).map((group) => {
                  const sections = (registry.sections || []).filter((s) => s.group === group.id);
                  if (!sections.length) return null;
                  return (
                    <div key={group.id} className="rounded-adm-md border border-adm-line">
                      <div className="border-b border-adm-line px-3 py-2 text-[13px] font-semibold text-adm-ink">{group.label}</div>
                      <ul className="divide-y divide-adm-line">
                        {sections.map((s) => {
                          const viaFieldWork = included.has(s.id);
                          const needs = s.requires && !form.adminSections.includes(s.requires) && !included.has(s.requires);
                          const on = viaFieldWork || form.adminSections.includes(s.id);
                          return (
                            <li key={s.id} className="flex items-center gap-3 pl-3 pr-1">
                              <div className="min-w-0 flex-1 py-2">
                                <div className="text-[14px] font-semibold text-adm-ink">{s.label}</div>
                                <div className="text-[12px] leading-4 text-adm-text-2">
                                  {viaFieldWork ? `Included with ${form.employeePosition}` : needs ? `Needs ${sectionLabel.get(s.requires as string)} on` : s.description}
                                </div>
                              </div>
                              <Switch on={on} disabled={viaFieldWork || !!needs} onChange={(next) => toggleSection(s.id, next)} label={s.label} />
                            </li>
                          );
                        })}
                      </ul>
                    </div>
                  );
                })}
                <p className="text-[12px] text-adm-text-2">Managing employees and system settings stay with the owner account.</p>
              </div>
            )}
          </fieldset>

          {editing ? (
            <div className="rounded-adm-md border border-adm-line px-3 py-3">
              <Button
                variant="destructive"
                onClick={() => {
                  setEditorOpen(false);
                  setDeleteConfirmation("");
                  setDeleteError("");
                  setDeleting(editing);
                }}
              >
                Delete this employee…
              </Button>
              <p className="mt-1 text-[13px] text-adm-text-2">To pause access instead, use Disable. Their history is kept either way.</p>
            </div>
          ) : null}

          {formError ? (
            <p role="alert" className="rounded-adm-sm bg-adm-problem-bg px-3 py-2 text-[14px] text-adm-problem">
              {formError}
            </p>
          ) : null}
          <button type="submit" hidden aria-hidden tabIndex={-1} />
        </form>
      </Sheet>

      {/* ------------------------------ delete (typed name) ------------------------------ */}
      <Sheet
        open={!!deleting}
        onClose={() => !deleteSaving && setDeleting(null)}
        title={deleting ? `Delete ${displayName(deleting)}?` : "Delete"}
        variant="dialog"
        busy={deleteSaving}
        footer={
          <>
            <Button variant="secondary" large disabled={deleteSaving} onClick={() => setDeleting(null)}>
              Cancel
            </Button>
            <Button variant="danger" large busy={deleteSaving} disabled={!deleteConfirmationMatches} onClick={confirmDelete} data-confirm-delete>
              Permanently delete
            </Button>
          </>
        }
      >
        {deleting ? (
          <>
            <p className="text-[15px] leading-relaxed text-adm-ink">This permanently deletes the employee account. Completed jobs stay in reporting. To pause access instead, use Disable.</p>
            <Field label={<>Type <strong>{firstWord(displayName(deleting))}</strong> or the full name to confirm</>} className="mt-4">
              <TextInput value={deleteConfirmation} onChange={(e) => setDeleteConfirmation(e.target.value)} autoComplete="off" autoCapitalize="none" autoCorrect="off" spellCheck={false} />
            </Field>
            {deleteError ? (
              <p role="alert" className="mt-4 rounded-adm-sm bg-adm-problem-bg px-3 py-2 text-[14px] text-adm-problem">
                {deleteError}
              </p>
            ) : null}
          </>
        ) : null}
      </Sheet>

      {/* ------------------------------ off-day history ------------------------------ */}
      <Sheet open={!!historyFixter} onClose={() => setHistoryFixter(null)} title={historyFixter ? displayName(historyFixter) : "Off days"} description={historyFixter ? `Completed jobs: ${historyFixter.completedBookingsCount}` : undefined}>
        {historyFixter ? (
          historyFixter.offDaysSummary?.recent?.length ? (
            <ul className="divide-y divide-adm-line rounded-adm-sm border border-adm-line">
              {historyFixter.offDaysSummary.recent.map((entry, index) => (
                <li key={`${entry.date}-${entry.status}-${index}`} className="px-3 py-2 text-[14px]">
                  <p className="font-semibold text-adm-ink">
                    {formatOffDay(entry.date)}
                    {entry.endDate && entry.endDate !== entry.date ? ` – ${formatOffDay(entry.endDate)}` : ""}
                  </p>
                  <p className="text-adm-text-2">
                    {entry.reason || entry.type || "No reason"} · {entry.status}
                  </p>
                </li>
              ))}
            </ul>
          ) : (
            <EmptyState message="No off-days recorded." />
          )
        ) : null}
      </Sheet>

      {flow ? <DisableFlow key={flow.row.id} flow={flow} setFlow={setFlow} targets={rows || []} onChanged={load} /> : null}
    </div>
  );
}
