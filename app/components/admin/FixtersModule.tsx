"use client";

import { useEffect, useState } from "react";
import {
  createFixter,
  getFixters,
  setFixterActive,
  updateFixter,
  type EmployeePosition,
  type FixterAccount,
} from "@/lib/admin-service";

const EMPTY = {
  firstName: "",
  lastName: "",
  email: "",
  phone: "",
  employeePosition: "Fixter" as EmployeePosition,
};

export default function FixtersModule() {
  const [rows, setRows] = useState<FixterAccount[]>([]);
  const [form, setForm] = useState(EMPTY);
  const [editing, setEditing] = useState<FixterAccount | null>(null);
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);

  const load = async () => {
    try {
      setRows(await getFixters());
    } catch {
      setError("Failed to load Fixters");
    }
  };

  useEffect(() => {
    load();
  }, []);

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
          <section key={row.id} className="grid gap-3 rounded-2xl border border-slate-200 bg-white p-4 shadow-sm md:grid-cols-[1fr_180px_130px_180px] md:items-center">
            <div>
              <h3 className="font-bold text-slate-950">{row.firstName} {row.lastName}</h3>
              <p className="text-sm text-slate-500">{row.email} · {row.phone}</p>
              {row.mustChangePassword && <span className="mt-2 inline-block rounded-full bg-amber-50 px-2.5 py-1 text-xs font-bold text-amber-700">Password change required</span>}
            </div>
            <strong className="text-sm">{row.employeePosition}</strong>
            <span className={row.isActive ? "text-sm font-bold text-emerald-700" : "text-sm font-bold text-rose-700"}>{row.isActive ? "Active" : "Inactive"}</span>
            <div className="flex gap-2">
              <button type="button" onClick={() => { setEditing(row); setForm({ firstName: row.firstName, lastName: row.lastName, email: row.email, phone: row.phone, employeePosition: row.employeePosition }); }} className="rounded-xl border border-slate-300 px-3 py-2 text-sm font-bold">Edit</button>
              <button type="button" onClick={async () => { await setFixterActive(row.id, !row.isActive); await load(); }} className="rounded-xl bg-slate-900 px-3 py-2 text-sm font-bold text-white">{row.isActive ? "Deactivate" : "Activate"}</button>
            </div>
          </section>
        ))}
      </div>
    </div>
  );
}
