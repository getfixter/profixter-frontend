"use client";

/**
 * Employees: every staff account and what each one can open in Admin.
 *
 * Owner only (the tab and every API behind it). An employee has a title the
 * owner types (display only), optional field work - Fixter or General Fixter,
 * the job access those always had - and Admin sections switched on one by
 * one. Nothing here is a role: two people titled "Marketing Manager" can have
 * completely different access. The server (BackEnd utils/adminAccess.js)
 * holds the list of sections and enforces every one of them.
 */

import { useCallback, useEffect, useMemo, useState } from "react";
import {
  createFixter,
  deleteFixter,
  getAccessRegistry,
  getAdminActivitySummary,
  getFixters,
  setDefaultFixter,
  setFixterActive,
  setFixterAvailabilityStatus,
  updateFixter,
  type AccessRegistry,
  type AdminActivitySummary,
  type EmployeeAvailabilityStatus,
  type FieldWork,
  type FixterAccount,
} from "@/lib/admin-service";

type Form = {
  firstName: string;
  lastName: string;
  email: string;
  phone: string;
  employeeTitle: string;
  employeePosition: FieldWork;
  adminSections: string[];
};

const EMPTY: Form = {
  firstName: "",
  lastName: "",
  email: "",
  phone: "",
  employeeTitle: "",
  employeePosition: null,
  adminSections: [],
};

const AVAILABILITY_STATUSES: EmployeeAvailabilityStatus[] = ["Available", "Busy", "Vacation", "Sick", "Training", "Inactive"];

const FIELD_WORK: Array<{ value: FieldWork; label: string; hint: string }> = [
  { value: null, label: "None", hint: "Office, marketing, sales - Admin sections only" },
  { value: "Fixter", label: "Fixter", hint: "Does jobs: their own jobs, tips and work photos" },
  { value: "General Fixter", label: "General Fixter", hint: "Runs all jobs, assigns Fixters, members and schedule" },
];

/* Older accounts may have only a full name, or only an email. */
const displayName = (row: FixterAccount) => `${row.firstName || ""} ${row.lastName || ""}`.trim() || row.name || row.email;

const firstWord = (value: string) => value.trim().split(" ")[0] || "";

const errorMessage = (caught: unknown, fallback: string) =>
  (caught as { response?: { data?: { message?: string } } })?.response?.data?.message || fallback;

function Switch({ on, disabled, onChange, label }: { on: boolean; disabled?: boolean; onChange: (next: boolean) => void; label: string }) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={on}
      aria-label={label}
      disabled={disabled}
      onClick={() => onChange(!on)}
      className={`relative h-[26px] w-[44px] flex-none rounded-full p-0 transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 focus-visible:ring-offset-2 disabled:cursor-not-allowed ${
        on ? "bg-blue-600" : "bg-slate-300"
      } ${disabled ? "opacity-50" : ""}`}
    >
      <span className={`absolute left-0 top-[3px] h-5 w-5 rounded-full bg-white shadow transition-transform ${on ? "translate-x-[21px]" : "translate-x-[3px]"}`} />
    </button>
  );
}

export default function FixtersModule() {
  const [rows, setRows] = useState<FixterAccount[]>([]);
  const [registry, setRegistry] = useState<AccessRegistry | null>(null);
  const [activitySummary, setActivitySummary] = useState<AdminActivitySummary | null>(null);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");

  const [editorOpen, setEditorOpen] = useState(false);
  const [editing, setEditing] = useState<FixterAccount | null>(null);
  const [form, setForm] = useState<Form>(EMPTY);
  const [formError, setFormError] = useState("");
  const [saving, setSaving] = useState(false);

  const [deleting, setDeleting] = useState<FixterAccount | null>(null);
  const [deleteConfirmation, setDeleteConfirmation] = useState("");
  const [deleteSaving, setDeleteSaving] = useState(false);
  const [historyFixter, setHistoryFixter] = useState<FixterAccount | null>(null);

  const load = useCallback(async () => {
    try {
      const [fixters, summary, reg] = await Promise.all([getFixters(), getAdminActivitySummary(), getAccessRegistry()]);
      setRows(fixters);
      setActivitySummary(summary);
      setRegistry(reg);
    } catch (caught) {
      setError(errorMessage(caught, "Employees couldn't load. Try again."));
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const sectionLabel = useMemo(() => new Map((registry?.sections || []).map((s) => [s.id, s.label])), [registry]);
  const included = useMemo(
    () => new Set(form.employeePosition ? registry?.includedByPosition[form.employeePosition] || [] : []),
    [registry, form.employeePosition]
  );

  /* ------------------------------ editor ------------------------------ */
  const openNew = () => {
    setEditing(null);
    setForm(EMPTY);
    setFormError("");
    setEditorOpen(true);
  };
  const openEdit = (row: FixterAccount) => {
    setEditing(row);
    setForm({
      firstName: row.firstName,
      lastName: row.lastName,
      email: row.email,
      phone: row.phone,
      employeeTitle: row.employeeTitle || "",
      employeePosition: row.employeePosition || null,
      adminSections: row.adminSections || [],
    });
    setFormError("");
    setEditorOpen(true);
  };
  const closeEditor = () => {
    if (saving) return;
    setEditorOpen(false);
    setEditing(null);
  };

  useEffect(() => {
    if (!editorOpen) return;
    const onKey = (event: KeyboardEvent) => event.key === "Escape" && closeEditor();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [editorOpen, saving]);

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
  const selectAll = () => setForm((current) => ({ ...current, adminSections: (registry?.sections || []).map((s) => s.id) }));
  const clearAll = () => setForm((current) => ({ ...current, adminSections: [] }));

  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
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
        setNotice(`${form.firstName}'s access is saved. It applies from their next action.`);
      } else {
        await createFixter({ ...payload, email: form.email });
        setNotice(`${form.firstName} can sign in with the temporary password 11111111 and will be asked to change it.`);
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
  const toggleActive = async (row: FixterAccount) => {
    setError("");
    try {
      await setFixterActive(row.id, !row.isActive);
      setNotice(row.isActive ? `${row.firstName} is disabled and can no longer open Admin.` : `${row.firstName} is active again.`);
      await load();
    } catch (caught) {
      setError(errorMessage(caught, "Couldn't change the status."));
    }
  };

  /* Type the first name or the full name. Never satisfied by an empty box, even for an account with no first name. */
  const deleteConfirmationMatches = deleting
    ? !!deleteConfirmation.trim() &&
      [firstWord(displayName(deleting)), displayName(deleting)]
        .map((value) => value.trim().toLowerCase())
        .filter(Boolean)
        .includes(deleteConfirmation.trim().toLowerCase())
    : false;

  const confirmDelete = async () => {
    if (!deleting || !deleteConfirmationMatches) return;
    setDeleteSaving(true);
    setError("");
    try {
      await deleteFixter(deleting.id);
      setDeleting(null);
      setDeleteConfirmation("");
      await load();
    } catch (caught) {
      setError(errorMessage(caught, "Failed to delete the employee"));
    } finally {
      setDeleteSaving(false);
    }
  };

  const formatOffDay = (value: string) =>
    new Date(`${value}T12:00:00`).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });

  const accessSummary = (row: FixterAccount) => {
    const names = (row.adminSections || []).map((id) => sectionLabel.get(id) || id);
    const parts = [] as string[];
    if (row.employeePosition) parts.push(`${row.employeePosition} jobs`);
    if (names.length) parts.push(names.length <= 3 ? names.join(", ") : `${names.length} sections`);
    return parts.length ? parts.join(" · ") : "No Admin sections";
  };

  return (
    <div className="space-y-4">
      <section className="flex flex-wrap items-center justify-between gap-3 rounded-[22px] bg-slate-950 px-5 py-5 text-white sm:px-6">
        <div className="min-w-0">
          <h2 className="text-[22px] font-bold leading-tight">Employees</h2>
          <p className="mt-1 text-[13px] text-slate-300">Each person sees only the sections you switch on. Titles are just labels.</p>
        </div>
        <button type="button" onClick={openNew} className="h-11 rounded-xl bg-white px-4 text-[14px] font-bold text-slate-950 hover:bg-slate-100">
          + Add Employee
        </button>
      </section>

      <section className="grid grid-cols-3 gap-2 sm:gap-3">
        {[
          ["Users deleted", activitySummary?.usersDeleted ?? 0],
          ["Leads deleted", activitySummary?.leadsDeleted ?? 0],
          ["Projects deleted", activitySummary?.projectsDeleted ?? 0],
        ].map(([label, value]) => (
          <div key={label} className="rounded-2xl border border-slate-200 bg-white px-3 py-3 sm:px-4">
            <div className="text-[20px] font-black text-slate-950">{value}</div>
            <div className="text-[10px] font-semibold uppercase tracking-[0.12em] text-slate-500 sm:text-[11px]">Last 24h · {label}</div>
          </div>
        ))}
      </section>

      {error && <div className="rounded-xl border border-rose-200 bg-rose-50 p-3 text-[14px] text-rose-700">{error}</div>}
      {notice && (
        <div className="flex items-start justify-between gap-3 rounded-xl border border-emerald-200 bg-emerald-50 p-3 text-[14px] text-emerald-800">
          <span>{notice}</span>
          <button type="button" onClick={() => setNotice("")} className="font-bold" aria-label="Dismiss">
            ×
          </button>
        </div>
      )}

      <ul className="grid grid-cols-[minmax(0,1fr)] gap-2.5" aria-label="Employees">
        {rows.map((row) => (
          <li key={row.id} className="min-w-0 rounded-2xl border border-slate-200 bg-white p-4">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <button type="button" onClick={() => openEdit(row)} className="min-w-0 flex-1 text-left" aria-label={`Edit ${displayName(row)}`}>
                <div className="flex flex-wrap items-center gap-2">
                  <h3 className="break-words text-[16px] font-bold text-slate-950">{displayName(row)}</h3>
                  <span className={`rounded-full px-2 py-0.5 text-[11px] font-bold ${row.isActive ? "bg-emerald-50 text-emerald-700" : "bg-rose-50 text-rose-700"}`}>
                    {row.isActive ? "Active" : "Disabled"}
                  </span>
                  {row.isDefaultFixter && <span className="rounded-full bg-blue-50 px-2 py-0.5 text-[11px] font-bold text-blue-700">Default</span>}
                  {row.mustChangePassword && <span className="rounded-full bg-amber-50 px-2 py-0.5 text-[11px] font-bold text-amber-700">Temporary password</span>}
                </div>
                <p className="mt-0.5 break-words text-[14px] font-semibold text-slate-700">{row.employeeTitle || row.employeePosition || "No title"}</p>
                <p className="mt-0.5 truncate text-[13px] text-slate-500">{accessSummary(row)}</p>
                <p className="mt-0.5 truncate text-[12px] text-slate-400">
                  {row.email}
                  {row.phone ? ` · ${row.phone}` : ""}
                </p>
              </button>
              <div className="flex flex-wrap gap-2">
                <button type="button" onClick={() => openEdit(row)} className="h-9 rounded-xl border border-slate-300 px-3 text-[13px] font-bold">
                  Edit
                </button>
                <button type="button" onClick={() => toggleActive(row)} className="h-9 rounded-xl bg-slate-900 px-3 text-[13px] font-bold text-white">
                  {row.isActive ? "Disable" : "Enable"}
                </button>
              </div>
            </div>

            {/* Field work only: the job calendar, default assignee and off days, as before. */}
            {row.employeePosition ? (
              <div className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-2 border-t border-slate-100 pt-3 text-[12px] text-slate-600">
                <label className="flex items-center gap-2 font-semibold text-slate-500">
                  Status
                  <select
                    value={row.employeeAvailabilityStatus || "Available"}
                    onChange={async (event) => {
                      await setFixterAvailabilityStatus(row.id, event.target.value as EmployeeAvailabilityStatus);
                      await load();
                    }}
                    className="h-8 rounded-lg border border-slate-300 bg-white px-2 text-[13px] text-slate-900"
                  >
                    {AVAILABILITY_STATUSES.map((status) => (
                      <option key={status} value={status}>
                        {status}
                      </option>
                    ))}
                  </select>
                </label>
                <span>Completed jobs: {row.completedBookingsCount}</span>
                <span>
                  Off days: {row.offDaysSummary.upcomingCount} upcoming
                  {row.offDaysSummary.recent.length ? (
                    <>
                      {" · "}
                      <button type="button" onClick={() => setHistoryFixter(row)} className="font-bold text-blue-700">
                        History
                      </button>
                    </>
                  ) : null}
                </span>
                {row.isActive && (
                  <button
                    type="button"
                    onClick={async () => setRows(await setDefaultFixter(row.id, !row.isDefaultFixter))}
                    className="font-bold text-blue-700"
                  >
                    {row.isDefaultFixter ? "Remove default" : "Make default for new jobs"}
                  </button>
                )}
              </div>
            ) : null}
          </li>
        ))}
        {!rows.length && !error ? <li className="rounded-2xl border border-dashed border-slate-300 p-6 text-center text-[14px] text-slate-500">No employees yet.</li> : null}
      </ul>

      {/* ------------------------------ editor ------------------------------ */}
      {editorOpen && (
        <div className="fixed inset-0 z-50 flex items-end justify-center bg-slate-950/50 sm:items-center sm:p-4" onClick={closeEditor}>
          <form
            onSubmit={submit}
            onClick={(event) => event.stopPropagation()}
            role="dialog"
            aria-modal="true"
            aria-label={editing ? `Edit ${editing.firstName}` : "Add Employee"}
            className="flex max-h-[92dvh] w-full max-w-[640px] flex-col rounded-t-[22px] bg-white shadow-2xl sm:rounded-[22px]"
          >
            <div className="flex items-center justify-between gap-3 border-b border-slate-100 px-5 py-4">
              <h3 className="text-[18px] font-bold text-slate-950">{editing ? displayName(editing) : "Add Employee"}</h3>
              <button type="button" onClick={closeEditor} className="h-9 w-9 rounded-full text-[20px] text-slate-500 hover:bg-slate-100" aria-label="Close">
                ×
              </button>
            </div>

            <div className="min-h-0 flex-1 space-y-5 overflow-y-auto px-5 py-4">
              <fieldset>
                <legend className="text-[12px] font-bold uppercase tracking-[0.12em] text-slate-500">Employee</legend>
                <div className="mt-2 grid grid-cols-1 gap-2.5 sm:grid-cols-2">
                  <input required value={form.firstName} onChange={(e) => setForm({ ...form, firstName: e.target.value })} placeholder="First name" aria-label="First name" className="h-11 rounded-xl border border-slate-300 px-3.5 text-[15px]" />
                  <input required value={form.lastName} onChange={(e) => setForm({ ...form, lastName: e.target.value })} placeholder="Last name" aria-label="Last name" className="h-11 rounded-xl border border-slate-300 px-3.5 text-[15px]" />
                  <input
                    required
                    type="email"
                    disabled={!!editing}
                    value={form.email}
                    onChange={(e) => setForm({ ...form, email: e.target.value })}
                    placeholder="Email (their login)"
                    aria-label="Email"
                    className="h-11 rounded-xl border border-slate-300 px-3.5 text-[15px] disabled:bg-slate-100 disabled:text-slate-500"
                  />
                  <input
                    type="tel"
                    required={!!form.employeePosition}
                    value={form.phone}
                    onChange={(e) => setForm({ ...form, phone: e.target.value })}
                    placeholder={form.employeePosition ? "Phone" : "Phone (optional)"}
                    aria-label="Phone"
                    className="h-11 rounded-xl border border-slate-300 px-3.5 text-[15px]"
                  />
                  <input
                    value={form.employeeTitle}
                    maxLength={80}
                    onChange={(e) => setForm({ ...form, employeeTitle: e.target.value })}
                    placeholder="Title, e.g. Marketing Manager"
                    aria-label="Title"
                    className="h-11 rounded-xl border border-slate-300 px-3.5 text-[15px] sm:col-span-2"
                  />
                </div>
                <p className="mt-1.5 text-[12px] text-slate-500">The title is only a label. Access is set below.</p>
              </fieldset>

              <fieldset>
                <legend className="text-[12px] font-bold uppercase tracking-[0.12em] text-slate-500">Field work</legend>
                <div className="mt-2 grid grid-cols-1 gap-2 sm:grid-cols-3">
                  {FIELD_WORK.map((option) => {
                    const selected = (form.employeePosition || null) === option.value;
                    return (
                      <button
                        key={option.label}
                        type="button"
                        aria-pressed={selected}
                        onClick={() => setForm({ ...form, employeePosition: option.value })}
                        className={`rounded-xl border px-3 py-2.5 text-left transition ${selected ? "border-blue-600 bg-blue-50" : "border-slate-200 hover:border-slate-300"}`}
                      >
                        <span className={`block text-[14px] font-bold ${selected ? "text-blue-700" : "text-slate-900"}`}>{option.label}</span>
                        <span className="block text-[12px] leading-4 text-slate-500">{option.hint}</span>
                      </button>
                    );
                  })}
                </div>
              </fieldset>

              <fieldset>
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <legend className="text-[12px] font-bold uppercase tracking-[0.12em] text-slate-500">Admin access</legend>
                  <div className="flex gap-1.5">
                    <button type="button" onClick={selectAll} className="h-8 rounded-lg border border-slate-300 px-2.5 text-[12px] font-bold text-slate-700">
                      Select all
                    </button>
                    <button type="button" onClick={clearAll} className="h-8 rounded-lg border border-slate-300 px-2.5 text-[12px] font-bold text-slate-700">
                      Clear all
                    </button>
                  </div>
                </div>
                {!registry ? (
                  <p className="mt-3 text-[13px] text-slate-500">Loading sections…</p>
                ) : (
                  <div className="mt-2 space-y-3">
                    {registry.groups.map((group) => {
                      const sections = registry.sections.filter((s) => s.group === group.id);
                      if (!sections.length) return null;
                      return (
                        <div key={group.id} className="rounded-2xl border border-slate-200">
                          <div className="border-b border-slate-100 px-3.5 py-2 text-[12px] font-bold text-slate-700">{group.label}</div>
                          <ul className="divide-y divide-slate-100">
                            {sections.map((s) => {
                              const viaFieldWork = included.has(s.id);
                              const needs = s.requires && !form.adminSections.includes(s.requires) && !included.has(s.requires);
                              const on = viaFieldWork || form.adminSections.includes(s.id);
                              return (
                                <li key={s.id} className="flex items-center gap-3 px-3.5 py-2.5">
                                  <div className="min-w-0 flex-1">
                                    <div className="text-[14px] font-semibold text-slate-900">{s.label}</div>
                                    <div className="text-[12px] leading-4 text-slate-500">
                                      {viaFieldWork
                                        ? `Included with ${form.employeePosition}`
                                        : needs
                                          ? `Needs ${sectionLabel.get(s.requires as string)} on`
                                          : s.description}
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
                    <p className="text-[12px] leading-5 text-slate-500">
                      Managing employees and system settings stay with the owner account.
                    </p>
                  </div>
                )}
              </fieldset>

              {editing ? (
                <div className="rounded-2xl border border-rose-100 bg-rose-50/40 px-3.5 py-3">
                  <button
                    type="button"
                    onClick={() => {
                      setEditorOpen(false);
                      setDeleteConfirmation("");
                      setDeleting(editing);
                    }}
                    className="text-[13px] font-bold text-rose-700"
                  >
                    Delete this employee…
                  </button>
                  <p className="text-[12px] text-slate-500">To pause access instead, use Disable. Their history is kept either way.</p>
                </div>
              ) : null}

              {formError && <div className="rounded-xl border border-rose-200 bg-rose-50 p-3 text-[14px] text-rose-700">{formError}</div>}
            </div>

            <div className="flex gap-2 border-t border-slate-100 px-5 py-3.5">
              <button type="button" onClick={closeEditor} className="h-11 flex-1 rounded-xl border border-slate-300 text-[14px] font-bold sm:flex-none sm:px-5">
                Cancel
              </button>
              <button disabled={saving} className="h-11 flex-[2] rounded-xl bg-blue-600 text-[14px] font-bold text-white disabled:opacity-60 sm:flex-none sm:px-6">
                {saving ? "Saving…" : editing ? "Save" : "Save Employee"}
              </button>
            </div>
          </form>
        </div>
      )}

      {deleting && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/50 p-4">
          <div className="w-full max-w-md rounded-2xl bg-white p-5 shadow-2xl">
            <h3 className="text-[20px] font-bold text-slate-950">
              Delete {displayName(deleting)}?
            </h3>
            <p className="mt-2 text-[14px] text-slate-600">
              This permanently deletes the employee account. Completed jobs stay in reporting. To pause access instead, use Disable.
            </p>
            <label className="mt-4 block text-[14px] font-semibold text-slate-700">
              Type <strong>{firstWord(displayName(deleting))}</strong> or the full name to confirm
              <input autoFocus value={deleteConfirmation} onChange={(event) => setDeleteConfirmation(event.target.value)} className="mt-2 w-full rounded-xl border border-slate-300 px-3 py-3" />
            </label>
            <div className="mt-5 flex justify-end gap-2">
              <button type="button" disabled={deleteSaving} onClick={() => setDeleting(null)} className="rounded-xl border border-slate-300 px-4 py-2.5 text-[14px] font-bold">
                Cancel
              </button>
              <button
                type="button"
                disabled={!deleteConfirmationMatches || deleteSaving}
                onClick={confirmDelete}
                className="rounded-xl bg-rose-600 px-4 py-2.5 text-[14px] font-bold text-white disabled:cursor-not-allowed disabled:opacity-40"
              >
                {deleteSaving ? "Deleting..." : "Permanently Delete"}
              </button>
            </div>
          </div>
        </div>
      )}

      {historyFixter && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/50 p-4">
          <div className="max-h-[85vh] w-full max-w-lg overflow-y-auto rounded-2xl bg-white p-5 shadow-2xl">
            <div className="flex items-start justify-between gap-4">
              <div>
                <h3 className="text-[20px] font-bold text-slate-950">
                  {displayName(historyFixter)}
                </h3>
                <p className="text-[14px] text-slate-600">Completed jobs: {historyFixter.completedBookingsCount}</p>
              </div>
              <button type="button" onClick={() => setHistoryFixter(null)} className="rounded-xl border border-slate-300 px-3 py-2 text-[14px] font-bold">
                Close
              </button>
            </div>
            <div className="mt-4 space-y-2">
              {historyFixter.offDaysSummary.recent.map((entry, index) => (
                <div key={`${entry.date}-${entry.status}-${index}`} className="rounded-xl border border-slate-200 p-3 text-[14px]">
                  <p className="font-bold text-slate-900">
                    {formatOffDay(entry.date)}
                    {entry.endDate && entry.endDate !== entry.date ? ` – ${formatOffDay(entry.endDate)}` : ""}
                  </p>
                  <p className="text-slate-600">
                    {entry.reason || entry.type || "No reason"} · {entry.status}
                  </p>
                </div>
              ))}
              {!historyFixter.offDaysSummary.recent.length && <p className="rounded-xl bg-slate-50 p-4 text-[14px] text-slate-500">No off-days recorded.</p>}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
