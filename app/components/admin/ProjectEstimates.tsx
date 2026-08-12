"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import {
  ESTIMATE_STATUSES,
  createEstimate,
  deleteEstimate,
  getProjectEstimates,
  updateEstimate,
  type Estimate,
  type EstimateInput,
  type EstimateStatus,
  type Project,
} from "@/lib/admin-service";
import AdminActionBar, { type AdminAction } from "@/app/components/admin/AdminActionBar";

type EstimateView = "list" | "create" | "details" | "edit";

const ESTIMATE_STATUS_STYLES: Record<EstimateStatus, string> = {
  Draft: "border-slate-200 bg-slate-100 text-slate-700",
  Sent: "border-sky-200 bg-sky-50 text-sky-700",
  Accepted: "border-emerald-200 bg-emerald-50 text-emerald-700",
  Rejected: "border-rose-200 bg-rose-50 text-rose-700",
  Expired: "border-amber-200 bg-amber-50 text-amber-700",
};

function money(value: number) {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
  }).format(Number(value || 0));
}

function displayDate(value: string | null) {
  if (!value) return "No expiration";
  return new Intl.DateTimeFormat("en-US", {
    timeZone: "America/New_York",
    month: "short",
    day: "numeric",
    year: "numeric",
  }).format(new Date(value));
}

function errorMessage(error: unknown) {
  if (typeof error === "object" && error !== null && "response" in error) {
    const response = (error as { response?: { data?: { message?: string } } }).response;
    if (response?.data?.message) return response.data.message;
  }
  return error instanceof Error ? error.message : "Something went wrong";
}

function emptyEstimate(projectId: string): EstimateInput {
  return {
    projectId,
    status: "Draft",
    title: "",
    description: "",
    lineItems: [{ description: "", quantity: 1, unitPrice: 0 }],
    tax: 0,
    discount: 0,
    notes: "",
    expirationDate: null,
  };
}

function toEstimateInput(estimate: Estimate): EstimateInput {
  return {
    projectId: estimate.projectId,
    status: estimate.status,
    title: estimate.title,
    description: estimate.description,
    lineItems: estimate.lineItems.map((item) => ({
      description: item.description,
      quantity: item.quantity,
      unitPrice: item.unitPrice,
    })),
    tax: estimate.tax,
    discount: estimate.discount,
    notes: estimate.notes,
    expirationDate: estimate.expirationDate
      ? estimate.expirationDate.slice(0, 10)
      : null,
  };
}

function EstimateEditor({
  project,
  initial,
  estimateNumber,
  submitLabel,
  onSubmit,
  onCancel,
}: {
  project: Project;
  initial: EstimateInput;
  estimateNumber?: string;
  submitLabel: string;
  onSubmit: (input: EstimateInput) => Promise<void>;
  onCancel: () => void;
}) {
  const [form, setForm] = useState(initial);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  const subtotal = useMemo(
    () =>
      Math.round(
        form.lineItems.reduce(
          (sum, item) =>
            sum + Number(item.quantity || 0) * Number(item.unitPrice || 0),
          0
        ) * 100
      ) / 100,
    [form.lineItems]
  );
  const total =
    Math.round((subtotal + Number(form.tax || 0) - Number(form.discount || 0)) * 100) /
    100;

  const inputClass =
    "mt-1.5 w-full rounded-xl border border-slate-300 bg-white px-3.5 py-3 text-sm text-slate-900 outline-none transition focus:border-blue-500 focus:ring-4 focus:ring-blue-100";

  const updateLineItem = (
    index: number,
    field: "description" | "quantity" | "unitPrice",
    value: string | number
  ) => {
    setForm((current) => ({
      ...current,
      lineItems: current.lineItems.map((item, itemIndex) =>
        itemIndex === index ? { ...item, [field]: value } : item
      ),
    }));
  };

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    setSaving(true);
    setError("");
    try {
      await onSubmit({
        ...form,
        tax: Number(form.tax || 0),
        discount: Number(form.discount || 0),
        lineItems: form.lineItems.map((item) => ({
          description: item.description,
          quantity: Number(item.quantity || 0),
          unitPrice: Number(item.unitPrice || 0),
        })),
      });
    } catch (submitError) {
      setError(errorMessage(submitError));
    } finally {
      setSaving(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-5">
      <div className="flex flex-col gap-4 rounded-2xl bg-slate-950 p-5 text-white sm:flex-row sm:items-start sm:justify-between">
        <div>
          <button type="button" onClick={onCancel} className="text-sm font-semibold text-blue-300">
            ← Back to estimates
          </button>
          <h3 className="mt-3 text-2xl font-bold">
            {estimateNumber ? `Edit ${estimateNumber}` : "Create estimate"}
          </h3>
          <div className="mt-4 grid gap-3 text-sm text-slate-300 sm:grid-cols-3">
            <div><span className="block text-xs uppercase text-slate-500">Customer</span>{project.customerName}</div>
            <div><span className="block text-xs uppercase text-slate-500">Project</span>{project.projectNumber}</div>
            <div><span className="block text-xs uppercase text-slate-500">Estimate</span>{estimateNumber || "Assigned on save"}</div>
          </div>
        </div>
        <button
          type="submit"
          disabled={saving}
          className="rounded-xl bg-blue-600 px-5 py-3 text-sm font-bold text-white hover:bg-blue-500 disabled:opacity-60"
        >
          {saving ? "Saving..." : submitLabel}
        </button>
      </div>

      {error && <div className="rounded-xl border border-rose-200 bg-rose-50 p-3 text-sm font-medium text-rose-700">{error}</div>}

      <section className="grid gap-5 rounded-2xl border border-slate-200 bg-white p-5 shadow-sm md:grid-cols-2">
        <label className="text-sm font-semibold text-slate-700">
          Title *
          <input
            required
            maxLength={200}
            value={form.title}
            onChange={(event) => setForm((current) => ({ ...current, title: event.target.value }))}
            className={inputClass}
          />
        </label>
        <label className="text-sm font-semibold text-slate-700">
          Status
          <select
            value={form.status}
            onChange={(event) => setForm((current) => ({ ...current, status: event.target.value as EstimateStatus }))}
            className={inputClass}
          >
            {ESTIMATE_STATUSES.map((status) => <option key={status}>{status}</option>)}
          </select>
        </label>
        <label className="text-sm font-semibold text-slate-700 md:col-span-2">
          Description
          <textarea
            rows={3}
            maxLength={5000}
            value={form.description}
            onChange={(event) => setForm((current) => ({ ...current, description: event.target.value }))}
            className={inputClass}
          />
        </label>
        <label className="text-sm font-semibold text-slate-700">
          Expiration date
          <input
            type="date"
            value={form.expirationDate || ""}
            onChange={(event) => setForm((current) => ({ ...current, expirationDate: event.target.value || null }))}
            className={inputClass}
          />
        </label>
      </section>

      <section className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
        <div className="flex items-center justify-between border-b border-slate-200 p-5">
          <div>
            <h4 className="font-bold text-slate-950">Line items</h4>
            <p className="mt-1 text-xs text-slate-500">Totals are verified and recalculated by the server.</p>
          </div>
          <button
            type="button"
            onClick={() => setForm((current) => ({
              ...current,
              lineItems: [...current.lineItems, { description: "", quantity: 1, unitPrice: 0 }],
            }))}
            className="rounded-xl border border-blue-200 bg-blue-50 px-3 py-2 text-sm font-bold text-blue-700"
          >
            + Add item
          </button>
        </div>

        <div className="hidden grid-cols-[1fr_120px_150px_130px_44px] gap-3 bg-slate-50 px-5 py-3 text-xs font-bold uppercase text-slate-500 md:grid">
          <span>Description</span><span>Quantity</span><span>Unit price</span><span>Total</span><span />
        </div>

        <div className="divide-y divide-slate-100">
          {form.lineItems.map((item, index) => {
            const itemTotal = Number(item.quantity || 0) * Number(item.unitPrice || 0);
            return (
              <div key={index} className="grid gap-3 p-4 md:grid-cols-[1fr_120px_150px_130px_44px] md:items-center md:px-5">
                <label className="text-xs font-bold text-slate-500 md:text-transparent">
                  Description
                  <input
                    required
                    maxLength={500}
                    value={item.description}
                    onChange={(event) => updateLineItem(index, "description", event.target.value)}
                    className="mt-1 w-full rounded-xl border border-slate-300 px-3 py-2.5 text-sm text-slate-900"
                  />
                </label>
                <label className="text-xs font-bold text-slate-500 md:text-transparent">
                  Quantity
                  <input
                    type="number"
                    min="0"
                    step="0.01"
                    required
                    value={item.quantity}
                    onChange={(event) => updateLineItem(index, "quantity", Number(event.target.value))}
                    className="mt-1 w-full rounded-xl border border-slate-300 px-3 py-2.5 text-sm text-slate-900"
                  />
                </label>
                <label className="text-xs font-bold text-slate-500 md:text-transparent">
                  Unit price
                  <input
                    type="number"
                    min="0"
                    step="0.01"
                    required
                    value={item.unitPrice}
                    onChange={(event) => updateLineItem(index, "unitPrice", Number(event.target.value))}
                    className="mt-1 w-full rounded-xl border border-slate-300 px-3 py-2.5 text-sm text-slate-900"
                  />
                </label>
                <div className="flex items-center justify-between text-sm md:block">
                  <span className="font-bold text-slate-500 md:hidden">Total</span>
                  <span className="font-bold text-slate-900">{money(itemTotal)}</span>
                </div>
                <button
                  type="button"
                  disabled={form.lineItems.length === 1}
                  onClick={() => setForm((current) => ({
                    ...current,
                    lineItems: current.lineItems.filter((_, itemIndex) => itemIndex !== index),
                  }))}
                  aria-label={`Remove line item ${index + 1}`}
                  className="rounded-lg p-2 text-rose-600 hover:bg-rose-50 disabled:cursor-not-allowed disabled:opacity-30"
                >
                  ×
                </button>
              </div>
            );
          })}
        </div>
      </section>

      <div className="grid gap-5 lg:grid-cols-[1fr_360px]">
        <label className="rounded-2xl border border-slate-200 bg-white p-5 text-sm font-semibold text-slate-700 shadow-sm">
          Notes
          <textarea
            rows={6}
            maxLength={10000}
            value={form.notes}
            onChange={(event) => setForm((current) => ({ ...current, notes: event.target.value }))}
            className={inputClass}
          />
        </label>
        <section className="rounded-2xl bg-slate-950 p-5 text-white shadow-sm">
          <h4 className="font-bold">Estimate summary</h4>
          <div className="mt-5 space-y-4">
            <div className="flex justify-between"><span className="text-slate-400">Subtotal</span><strong>{money(subtotal)}</strong></div>
            <label className="flex items-center justify-between gap-4 text-slate-400">
              Tax
              <input
                type="number"
                min="0"
                step="0.01"
                value={form.tax}
                onChange={(event) => setForm((current) => ({ ...current, tax: Number(event.target.value) }))}
                className="w-32 rounded-lg border border-white/15 bg-white/10 px-3 py-2 text-right text-white"
              />
            </label>
            <label className="flex items-center justify-between gap-4 text-slate-400">
              Discount
              <input
                type="number"
                min="0"
                step="0.01"
                value={form.discount}
                onChange={(event) => setForm((current) => ({ ...current, discount: Number(event.target.value) }))}
                className="w-32 rounded-lg border border-white/15 bg-white/10 px-3 py-2 text-right text-white"
              />
            </label>
            <div className="flex justify-between border-t border-white/10 pt-4 text-lg">
              <span>Grand total</span>
              <strong className={total < 0 ? "text-rose-300" : ""}>{money(total)}</strong>
            </div>
          </div>
        </section>
      </div>
    </form>
  );
}

export default function ProjectEstimates({ project }: { project: Project }) {
  const [estimates, setEstimates] = useState<Estimate[]>([]);
  const [selected, setSelected] = useState<Estimate | null>(null);
  const [view, setView] = useState<EstimateView>("list");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const load = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      setEstimates(await getProjectEstimates(project._id));
    } catch (loadError) {
      setError(errorMessage(loadError));
    } finally {
      setLoading(false);
    }
  }, [project._id]);

  useEffect(() => {
    load();
  }, [load]);

  if (view === "create") {
    return (
      <EstimateEditor
        project={project}
        initial={emptyEstimate(project._id)}
        submitLabel="Create Estimate"
        onCancel={() => setView("list")}
        onSubmit={async (input) => {
          const estimate = await createEstimate(input);
          setEstimates((current) => [estimate, ...current]);
          setSelected(estimate);
          setView("details");
        }}
      />
    );
  }

  if (view === "edit" && selected) {
    return (
      <EstimateEditor
        project={project}
        initial={toEstimateInput(selected)}
        estimateNumber={selected.estimateNumber}
        submitLabel="Save Changes"
        onCancel={() => setView("details")}
        onSubmit={async (input) => {
          const estimate = await updateEstimate(selected._id, input);
          setEstimates((current) => current.map((item) => item._id === estimate._id ? estimate : item));
          setSelected(estimate);
          setView("details");
        }}
      />
    );
  }

  if (view === "details" && selected) {
    const removeEstimate = async () => {
      if (!window.confirm(`Delete ${selected.estimateNumber}? This cannot be undone.`)) return;
      try {
        await deleteEstimate(selected._id);
        setEstimates((current) => current.filter((item) => item._id !== selected._id));
        setSelected(null);
        setView("list");
      } catch (deleteError) {
        setError(errorMessage(deleteError));
      }
    };

    /* Estimates are short documents: edit it, write another, or bin it. */
    const barActions: AdminAction[] = [
      { key: "edit", label: "Edit", longLabel: "Edit Estimate", tone: "primary", onClick: () => setView("edit") },
      {
        key: "new",
        label: "New",
        longLabel: "New Estimate",
        onClick: () => {
          setSelected(null);
          setView("create");
        },
      },
      { key: "delete", label: "Delete", longLabel: "Delete Estimate", tone: "danger", onClick: () => void removeEstimate() },
    ];

    return (
      <div className="space-y-5">
        <section className="rounded-2xl bg-slate-950 p-5 text-white shadow-sm">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
            <div>
              <button type="button" onClick={() => setView("list")} className="text-sm font-semibold text-blue-300">← Back to estimates</button>
              <div className="mt-3 flex flex-wrap items-center gap-3">
                <h3 className="text-2xl font-bold">{selected.estimateNumber}</h3>
                <span className={`rounded-full border px-3 py-1 text-xs font-bold ${ESTIMATE_STATUS_STYLES[selected.status]}`}>{selected.status}</span>
              </div>
              <p className="mt-2 text-slate-300">{selected.title}</p>
              <p className="mt-4 text-sm text-slate-400">{project.customerName} · {project.projectNumber} · {displayDate(selected.expirationDate)}</p>
            </div>
            {/* Duplicated by the mobile action bar; kept for desktop only. */}
            <div className="hidden gap-2 xl:flex">
              <button type="button" onClick={() => setView("edit")} className="rounded-xl bg-blue-600 px-4 py-2.5 text-sm font-bold">Edit</button>
              <button
                type="button"
                onClick={() => void removeEstimate()}
                className="rounded-xl border border-rose-400/40 bg-rose-500/10 px-4 py-2.5 text-sm font-bold text-rose-200"
              >
                Delete
              </button>
            </div>
          </div>
        </section>

        {error && <div className="rounded-xl border border-rose-200 bg-rose-50 p-3 text-sm font-medium text-rose-700">{error}</div>}

        {selected.description && (
          <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
            <p className="text-xs font-bold uppercase tracking-[0.16em] text-slate-400">Description</p>
            <p className="mt-3 whitespace-pre-wrap text-sm leading-7 text-slate-700">{selected.description}</p>
          </section>
        )}

        <section className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
          <div className="hidden grid-cols-[1fr_120px_150px_150px] gap-3 bg-slate-950 px-5 py-4 text-xs font-bold uppercase text-white md:grid">
            <span>Description</span><span>Quantity</span><span>Unit price</span><span>Total</span>
          </div>
          <div className="divide-y divide-slate-100">
            {selected.lineItems.map((item) => (
              <div key={item._id || item.description} className="grid gap-2 p-4 text-sm md:grid-cols-[1fr_120px_150px_150px] md:px-5">
                <strong className="text-slate-900">{item.description}</strong>
                <span className="text-slate-600"><span className="md:hidden">Qty: </span>{item.quantity}</span>
                <span className="text-slate-600"><span className="md:hidden">Unit: </span>{money(item.unitPrice)}</span>
                <strong className="text-slate-900">{money(item.total)}</strong>
              </div>
            ))}
          </div>
        </section>

        <div className="grid gap-5 lg:grid-cols-[1fr_360px]">
          <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
            <p className="text-xs font-bold uppercase tracking-[0.16em] text-slate-400">Notes</p>
            <p className="mt-3 whitespace-pre-wrap text-sm leading-7 text-slate-700">{selected.notes || "No notes."}</p>
          </section>
          <section className="rounded-2xl bg-slate-950 p-5 text-white shadow-sm">
            <div className="space-y-4">
              <div className="flex justify-between"><span className="text-slate-400">Subtotal</span><strong>{money(selected.subtotal)}</strong></div>
              <div className="flex justify-between"><span className="text-slate-400">Tax</span><strong>{money(selected.tax)}</strong></div>
              <div className="flex justify-between"><span className="text-slate-400">Discount</span><strong>-{money(selected.discount)}</strong></div>
              <div className="flex justify-between border-t border-white/10 pt-4 text-lg"><span>Grand total</span><strong>{money(selected.total)}</strong></div>
            </div>
          </section>
        </div>

        <AdminActionBar actions={barActions} label="Estimate actions" />
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h3 className="text-xl font-bold text-slate-950">Estimates</h3>
          <p className="mt-1 text-sm text-slate-500">Structured estimates attached to {project.projectNumber}.</p>
        </div>
        <button type="button" onClick={() => setView("create")} className="rounded-xl bg-blue-600 px-5 py-3 text-sm font-bold text-white hover:bg-blue-700">
          + Create Estimate
        </button>
      </div>

      {error && <div className="rounded-xl border border-rose-200 bg-rose-50 p-3 text-sm font-medium text-rose-700">{error}</div>}

      {loading ? (
        <div className="rounded-2xl border border-slate-200 bg-white p-10 text-center text-slate-500">Loading estimates...</div>
      ) : estimates.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-slate-300 bg-white p-10 text-center">
          <h4 className="font-bold text-slate-900">No estimates yet</h4>
          <p className="mt-2 text-sm text-slate-500">Create the first structured estimate for this project.</p>
        </div>
      ) : (
        <div className="grid gap-3">
          {estimates.map((estimate) => (
            <button
              key={estimate._id}
              type="button"
              onClick={() => {
                setSelected(estimate);
                setView("details");
              }}
              className="grid gap-3 rounded-2xl border border-slate-200 bg-white p-4 text-left shadow-sm transition hover:border-blue-200 hover:shadow-md sm:grid-cols-[150px_1fr_130px_140px] sm:items-center"
            >
              <span className="font-bold text-blue-700">{estimate.estimateNumber}</span>
              <span><strong className="block text-slate-950">{estimate.title}</strong><span className="text-sm text-slate-500">{displayDate(estimate.expirationDate)}</span></span>
              <span className={`w-fit rounded-full border px-2.5 py-1 text-xs font-bold ${ESTIMATE_STATUS_STYLES[estimate.status]}`}>{estimate.status}</span>
              <strong className="text-slate-950 sm:text-right">{money(estimate.total)}</strong>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
