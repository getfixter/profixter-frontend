"use client";

import React from "react";
import type { RequestLead } from "@/lib/admin-service";

interface RequestsTableProps {
  requests: RequestLead[];
  onUpdateStatus: (
    requestId: string,
    status: "new" | "contacted" | "won" | "lost"
  ) => void | Promise<void>;
  onDeleteLead: (request: RequestLead, confirmation: string) => void | Promise<void>;
}

function formatDate(value?: string) {
  if (!value) return "-";
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return value;
  return d.toLocaleString("en-US", {
    timeZone: "America/New_York",
    month: "short",
    day: "numeric",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}

function niceServiceType(value?: string) {
  switch (value) {
    case "membership":       return "Membership";
    case "roofing":          return "Roofing";
    case "siding":           return "Siding";
    case "roofing_siding":
    case "both":             return "Roofing & Siding";
    case "bathroom":         return "Bathroom Remodel";
    case "kitchen":          return "Kitchen Remodel";
    case "kitchen-bathroom": return "Kitchen & Bathroom Remodel";
    case "full-house":       return "Full House Renovation";
    case "basement":         return "Basement Finishing";
    case "interior":         return "Interior Renovation";
    case "community-partnership": return "Community Partnership";
    case "other":            return "Other Larger Project";
    case "estimate":         return "Estimate";
    case "on_demand":        return "On Demand";
    case "general_contractor": return "General Contractor";
    case "home_improvement": return "Home Improvement";
    default:                 return value || "-";
  }
}

export default function RequestsTable({
  requests,
  onUpdateStatus,
  onDeleteLead,
}: RequestsTableProps) {
  const [deleteTarget, setDeleteTarget] = React.useState<RequestLead | null>(null);
  const [confirmation, setConfirmation] = React.useState("");
  const [error, setError] = React.useState("");
  const [deleting, setDeleting] = React.useState(false);

  const expected = deleteTarget?.name || "";

  const closeDelete = () => {
    if (deleting) return;
    setDeleteTarget(null);
    setConfirmation("");
    setError("");
  };

  const confirmDelete = async () => {
    if (!deleteTarget || confirmation !== expected) return;
    setDeleting(true);
    setError("");
    try {
      await onDeleteLead(deleteTarget, confirmation);
      setDeleteTarget(null);
      setConfirmation("");
      setError("");
    } catch (deleteError) {
      const message =
        typeof deleteError === "object" &&
        deleteError !== null &&
        "response" in deleteError
          ? (deleteError as { response?: { data?: { message?: string } } }).response?.data?.message
          : undefined;
      setError(message || (deleteError instanceof Error ? deleteError.message : "Failed to delete lead."));
    } finally {
      setDeleting(false);
    }
  };

  if (!requests.length) {
    return (
      <div className="bg-white rounded-2xl border border-slate-200 p-8 text-center text-slate-500">
        No requests yet.
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {requests.map((request) => (
        <div
          key={request._id}
          className="bg-white rounded-2xl border border-slate-200 shadow-sm p-5"
        >
          <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
            <div className="space-y-2">
              <div className="flex flex-wrap items-center gap-2">
                <h3 className="text-lg font-bold text-slate-900">
                  {request.name || "-"}
                </h3>
                <span className="inline-flex rounded-full bg-slate-100 px-2.5 py-1 text-xs font-semibold text-slate-700">
                  {niceServiceType(request.serviceType)}
                </span>
                <span className="inline-flex rounded-full bg-blue-50 px-2.5 py-1 text-xs font-semibold text-blue-700">
                  {request.status || "new"}
                </span>
              </div>

              <div className="text-sm text-slate-600 space-y-1">
                <div>
                  <strong>Email:</strong> {request.email || "-"}
                </div>
                <div>
                  <strong>Phone:</strong> {request.phone || "-"}
                </div>
                {request.address ? (
                  <div>
                    <strong>Address:</strong> {request.address}
                  </div>
                ) : null}
                <div>
                  <strong>Source:</strong> {request.sourcePage || "-"}
                </div>
                <div>
                  <strong>Created:</strong> {formatDate(request.createdAt)}
                </div>
              </div>
            </div>

            <div className="flex w-full flex-col gap-2 lg:w-auto">
              <select
                value={request.status || "new"}
                onChange={(e) =>
                  onUpdateStatus(
                    request._id,
                    e.target.value as "new" | "contacted" | "won" | "lost"
                  )
                }
                className="w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm font-medium text-slate-800 focus:outline-none focus:ring-2 focus:ring-blue-500 lg:w-[180px]"
              >
                <option value="new">New</option>
                <option value="contacted">Contacted</option>
                <option value="won">Won</option>
                <option value="lost">Lost</option>
              </select>
              <button
                type="button"
                onClick={() => {
                  setDeleteTarget(request);
                  setConfirmation("");
                  setError("");
                }}
                className="w-full rounded-xl border border-rose-200 bg-rose-50 px-3 py-2 text-sm font-bold text-rose-700 transition hover:bg-rose-100 lg:w-[180px]"
              >
                Delete
              </button>
            </div>
          </div>

          <div className="mt-4 rounded-xl border border-slate-200 bg-slate-50 p-4">
            <div className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500 mb-2">
              Message
            </div>
            <div className="whitespace-pre-wrap text-sm text-slate-700">
              {request.message || "-"}
            </div>
          </div>
        </div>
      ))}

      {deleteTarget && (
        <div
          className="fixed inset-0 z-[90] flex items-end justify-center bg-slate-950/60 px-3 py-4 backdrop-blur-sm sm:items-center"
          onClick={closeDelete}
        >
          <div
            className="w-full max-w-lg rounded-[28px] bg-white p-5 shadow-[0_28px_90px_rgba(15,23,42,0.30)] sm:p-6"
            onClick={(event) => event.stopPropagation()}
          >
            <div className="flex items-start justify-between gap-4">
              <div>
                <div className="text-xs font-bold uppercase tracking-[0.18em] text-rose-600">Delete Lead</div>
                <h3 className="mt-1 text-2xl font-black text-slate-950">Delete Lead</h3>
              </div>
              <button
                type="button"
                onClick={closeDelete}
                disabled={deleting}
                className="grid h-9 w-9 place-items-center rounded-full border border-slate-200 text-slate-500 transition hover:bg-slate-50 disabled:opacity-50"
                aria-label="Close delete lead confirmation"
              >
                ×
              </button>
            </div>
            <div className="mt-4 rounded-2xl border border-rose-200 bg-rose-50 p-4 text-sm text-rose-800">
              This action cannot be undone.
            </div>
            <div className="mt-4 space-y-2">
              <div className="text-sm text-slate-600">
                Type the lead name exactly to continue:{' '}
                <span className="font-bold text-slate-950">{expected}</span>
              </div>
              <input
                value={confirmation}
                onChange={(event) => setConfirmation(event.target.value)}
                className="w-full rounded-2xl border border-slate-300 bg-white px-4 py-3 text-sm font-semibold text-slate-950 outline-none transition focus:border-rose-400 focus:ring-4 focus:ring-rose-100"
                placeholder={expected}
                autoFocus
              />
            </div>
            {error && (
              <div className="mt-3 rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm font-semibold text-rose-700">
                {error}
              </div>
            )}
            <div className="mt-5 flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
              <button
                type="button"
                onClick={closeDelete}
                disabled={deleting}
                className="rounded-2xl border border-slate-200 px-4 py-3 text-sm font-bold text-slate-700 transition hover:bg-slate-50 disabled:opacity-50"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={confirmDelete}
                disabled={deleting || confirmation !== expected}
                className="rounded-2xl bg-rose-600 px-4 py-3 text-sm font-bold text-white transition hover:bg-rose-700 disabled:cursor-not-allowed disabled:opacity-50"
              >
                {deleting ? "Deleting..." : "Delete Lead"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
