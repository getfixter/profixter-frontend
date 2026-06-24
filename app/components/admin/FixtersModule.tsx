"use client";

import { useCallback, useEffect, useState } from "react";
import {
  createFixter,
  deleteFixter,
  getAdminActivitySummary,
  getFixters,
  setDefaultFixter,
  setFixterActive,
  setFixterAvailabilityStatus,
  updateFixter,
  type EmployeePosition,
  type EmployeeAvailabilityStatus,
  type FixterAccount,
  type AdminActivitySummary,
} from "@/lib/admin-service";

const EMPTY = {
  firstName: "",
  lastName: "",
  email: "",
  phone: "",
  employeePosition: "Fixter" as EmployeePosition,
};

const AVAILABILITY_STATUSES: EmployeeAvailabilityStatus[] = [
  "Available",
  "Busy",
  "Vacation",
  "Sick",
  "Training",
  "Inactive",
];

export default function FixtersModule() {
  const [rows, setRows] = useState<FixterAccount[]>([]);
  const [form, setForm] = useState(EMPTY);
  const [editing, setEditing] = useState<FixterAccount | null>(null);
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState<FixterAccount | null>(null);
  const [deleteConfirmation, setDeleteConfirmation] = useState("");
  const [deleteSaving, setDeleteSaving] = useState(false);
  const [historyFixter, setHistoryFixter] = useState<FixterAccount | null>(null);
  const [activitySummary, setActivitySummary] = useState<AdminActivitySummary | null>(null);

  const load = useCallback(async () => {
    try {
      const [fixters, summary] = await Promise.all([
        getFixters(),
        getAdminActivitySummary(),
      ]);
      setRows(fixters);
      setActivitySummary(summary);
    } catch {
      setError("Failed to load Fixters");
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const beginDelete = (fixter: FixterAccount) => {
    setError("");
    setDeleteConfirmation("");
    setDeleting(fixter);
  };

  const deleteConfirmationMatches = deleting
    ? [deleting.firstName, `${deleting.firstName} ${deleting.lastName}`]
        .map((value) => value.trim().toLowerCase())
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
      const response = caught as { response?: { data?: { message?: string } } };
      setError(
        response.response?.data?.message || "Failed to delete Fixter"
      );
    } finally {
      setDeleteSaving(false);
    }
  };

  const formatOffDay = (value: string) =>
    new Date(`${value}T12:00:00`).toLocaleDateString("en-US", {
      month: "short",
      day: "numeric",
      year: "numeric",
    });

  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    setSaving(true);
    setError("");
    try {
      if (editing) {
        await updateFixter(editing.id, {
          firstName: form.firstName,
          lastName: form.lastName,
          phone: form.phone,
          employeePosition: form.employeePosition,
        });
      } else {
        await createFixter(form);
      }
      setForm(EMPTY);
      setEditing(null);
      await load();
    } catch (caught) {
      const response = caught as { response?: { data?: { message?: string } } };
      setError(response.response?.data?.message || "Failed to save Fixter");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-5">
      <section className="rounded-[26px] bg-slate-950 p-6 text-white">
        <h2 className="text-2xl font-bold">Fixters</h2>
        <p className="mt-2 text-sm text-slate-300">
          Create employee logins. New accounts use temporary password <strong>11111111</strong>.
        </p>
      </section>

      <section className="grid gap-3 sm:grid-cols-3">
        {[
          ["Users deleted", activitySummary?.usersDeleted ?? 0],
          ["Leads deleted", activitySummary?.leadsDeleted ?? 0],
          ["Projects deleted", activitySummary?.projectsDeleted ?? 0],
        ].map(([label, value]) => (
          <div key={label} className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
            <div className="text-2xl font-black text-slate-950">{value}</div>
            <div className="text-xs font-semibold uppercase tracking-[0.14em] text-slate-500">
              Last 24h · {label}
            </div>
          </div>
        ))}
      </section>

      {error && <div className="rounded-xl border border-rose-200 bg-rose-50 p-3 text-sm text-rose-700">{error}</div>}

      <form onSubmit={submit} className="grid gap-3 rounded-2xl border border-slate-200 bg-white p-5 shadow-sm md:grid-cols-2">
        {(["firstName", "lastName", "phone"] as const).map((field) => (
          <input
            key={field}
            required
            value={form[field]}
            onChange={(event) => setForm((current) => ({ ...current, [field]: event.target.value }))}
            placeholder={field === "firstName" ? "First name" : field === "lastName" ? "Last name" : "Phone"}
            className="rounded-xl border border-slate-300 px-3.5 py-3 text-sm"
          />
        ))}
        <input
          required
          type="email"
          disabled={!!editing}
          value={form.email}
          onChange={(event) => setForm((current) => ({ ...current, email: event.target.value }))}
          placeholder="Email"
          className="rounded-xl border border-slate-300 px-3.5 py-3 text-sm disabled:bg-slate-100"
        />
        <select
          value={form.employeePosition}
          onChange={(event) => setForm((current) => ({ ...current, employeePosition: event.target.value as EmployeePosition }))}
          className="rounded-xl border border-slate-300 bg-white px-3.5 py-3 text-sm"
        >
          <option>Fixter</option>
          <option>General Fixter</option>
        </select>
        <div className="flex gap-2">
          <button disabled={saving} className="rounded-xl bg-blue-600 px-5 py-3 text-sm font-bold text-white">
            {saving ? "Saving..." : editing ? "Save Changes" : "Create Fixter"}
          </button>
          {editing && (
            <button type="button" onClick={() => { setEditing(null); setForm(EMPTY); }} className="rounded-xl border border-slate-300 px-4 py-3 text-sm font-bold">
              Cancel
            </button>
          )}
        </div>
      </form>

      <div className="grid gap-3">
        {rows.map((row) => (
          <section key={row.id} className="grid gap-3 rounded-2xl border border-slate-200 bg-white p-4 shadow-sm md:grid-cols-[minmax(220px,1.35fr)_130px_120px_180px_minmax(190px,1fr)] md:items-center">
            <div>
              <h3 className="font-bold text-slate-950">{row.firstName} {row.lastName}</h3>
              <p className="text-sm text-slate-500">{row.email} · {row.phone}</p>
              {row.isDefaultFixter && <span className="mt-2 mr-2 inline-block rounded-full bg-blue-50 px-2.5 py-1 text-xs font-bold text-blue-700">Default</span>}
              {row.mustChangePassword && <span className="mt-2 inline-block rounded-full bg-amber-50 px-2.5 py-1 text-xs font-bold text-amber-700">Password change required</span>}
              <p className="mt-3 text-sm font-semibold text-slate-700">
                Completed bookings: {row.completedBookingsCount}
              </p>
              <div className="mt-2 text-xs text-slate-600">
                <p className="font-bold text-slate-700">Off days</p>
                <p>
                  Upcoming: {row.offDaysSummary.upcomingCount} · Past:{" "}
                  {row.offDaysSummary.pastCount}
                </p>
                {row.offDaysSummary.recent.length ? (
                  <>
                    <p className="mt-1 line-clamp-2">
                      Latest:{" "}
                      {formatOffDay(row.offDaysSummary.recent[0].date)} —{" "}
                      {row.offDaysSummary.recent[0].reason ||
                        row.offDaysSummary.recent[0].status}
                    </p>
                    <button
                      type="button"
                      onClick={() => setHistoryFixter(row)}
                      className="mt-1 font-bold text-blue-700"
                    >
                      View history
                    </button>
                  </>
                ) : (
                  <p className="mt-1 text-slate-500">
                    No off-days recorded.
                  </p>
                )}
              </div>
            </div>
            <strong className="text-sm">{row.employeePosition}</strong>
            <span className={row.isActive ? "text-sm font-bold text-emerald-700" : "text-sm font-bold text-rose-700"}>{row.isActive ? "Active" : "Inactive"}</span>
            <label className="grid gap-1 text-xs font-semibold text-slate-500">
              Visibility status
              <select
                value={row.employeeAvailabilityStatus || "Available"}
                onChange={async (event) => {
                  await setFixterAvailabilityStatus(
                    row.id,
                    event.target.value as EmployeeAvailabilityStatus
                  );
                  await load();
                }}
                className="rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900"
              >
                {AVAILABILITY_STATUSES.map((status) => (
                  <option key={status} value={status}>
                    {status}
                  </option>
                ))}
              </select>
            </label>
            <div className="flex flex-wrap gap-2">
              <button type="button" onClick={() => { setEditing(row); setForm({ firstName: row.firstName, lastName: row.lastName, email: row.email, phone: row.phone, employeePosition: row.employeePosition }); }} className="rounded-xl border border-slate-300 px-3 py-2 text-sm font-bold">Edit</button>
              <button type="button" onClick={async () => { await setFixterActive(row.id, !row.isActive); await load(); }} className="rounded-xl bg-slate-900 px-3 py-2 text-sm font-bold text-white">{row.isActive ? "Deactivate" : "Activate"}</button>
              <button
                type="button"
                onClick={() => beginDelete(row)}
                className="rounded-xl border border-rose-200 bg-rose-50 px-3 py-2 text-sm font-bold text-rose-700"
              >
                Delete
              </button>
              {row.isActive && (
                <button
                  type="button"
                  onClick={async () => {
                    setRows(await setDefaultFixter(row.id, !row.isDefaultFixter));
                  }}
                  className="rounded-xl border border-blue-200 bg-blue-50 px-3 py-2 text-sm font-bold text-blue-700"
                >
                  {row.isDefaultFixter ? "Remove Default" : "Set Default"}
                </button>
              )}
            </div>
          </section>
        ))}
      </div>

      {deleting && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/50 p-4">
          <div className="w-full max-w-md rounded-2xl bg-white p-5 shadow-2xl">
            <h3 className="text-xl font-bold text-slate-950">
              Delete {deleting.firstName} {deleting.lastName}?
            </h3>
            <p className="mt-2 text-sm text-slate-600">
              This permanently deletes the Fixter employee account. Historical
              completed bookings remain in reporting.
            </p>
            <label className="mt-4 block text-sm font-semibold text-slate-700">
              Type <strong>{deleting.firstName}</strong> or the full name to
              confirm
              <input
                autoFocus
                value={deleteConfirmation}
                onChange={(event) =>
                  setDeleteConfirmation(event.target.value)
                }
                className="mt-2 w-full rounded-xl border border-slate-300 px-3 py-3"
              />
            </label>
            <div className="mt-5 flex justify-end gap-2">
              <button
                type="button"
                disabled={deleteSaving}
                onClick={() => setDeleting(null)}
                className="rounded-xl border border-slate-300 px-4 py-2.5 text-sm font-bold"
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={!deleteConfirmationMatches || deleteSaving}
                onClick={confirmDelete}
                className="rounded-xl bg-rose-600 px-4 py-2.5 text-sm font-bold text-white disabled:cursor-not-allowed disabled:opacity-40"
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
                <h3 className="text-xl font-bold text-slate-950">
                  {historyFixter.firstName} {historyFixter.lastName}
                </h3>
                <p className="text-sm text-slate-600">
                  Completed bookings: {historyFixter.completedBookingsCount}
                </p>
              </div>
              <button
                type="button"
                onClick={() => setHistoryFixter(null)}
                className="rounded-xl border border-slate-300 px-3 py-2 text-sm font-bold"
              >
                Close
              </button>
            </div>
            <div className="mt-4 space-y-2">
              {historyFixter.offDaysSummary.recent.map((entry, index) => (
                <div
                  key={`${entry.date}-${entry.status}-${index}`}
                  className="rounded-xl border border-slate-200 p-3 text-sm"
                >
                  <p className="font-bold text-slate-900">
                    {formatOffDay(entry.date)}
                    {entry.endDate && entry.endDate !== entry.date
                      ? ` – ${formatOffDay(entry.endDate)}`
                      : ""}
                  </p>
                  <p className="text-slate-600">
                    {entry.reason || entry.type || "No reason"} ·{" "}
                    {entry.status}
                  </p>
                </div>
              ))}
              {!historyFixter.offDaysSummary.recent.length && (
                <p className="rounded-xl bg-slate-50 p-4 text-sm text-slate-500">
                  No off-days recorded.
                </p>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
