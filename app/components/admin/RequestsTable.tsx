"use client";

import React from "react";
import type { RequestLead } from "@/lib/admin-service";

interface RequestsTableProps {
  requests: RequestLead[];
  onUpdateStatus: (
    requestId: string,
    status: "new" | "contacted" | "won" | "lost"
  ) => void | Promise<void>;
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
    case "on_demand":
      return "On Demand";
    case "general_contractor":
      return "General Contractor";
    case "home_improvement":
      return "Home Improvement";
    default:
      return value || "-";
  }
}

export default function RequestsTable({
  requests,
  onUpdateStatus,
}: RequestsTableProps) {
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
                <div>
                  <strong>Source:</strong> {request.sourcePage || "-"}
                </div>
                <div>
                  <strong>Created:</strong> {formatDate(request.createdAt)}
                </div>
              </div>
            </div>

            <div className="w-full lg:w-auto">
              <select
                value={request.status || "new"}
                onChange={(e) =>
                  onUpdateStatus(
                    request._id,
                    e.target.value as "new" | "contacted" | "won" | "lost"
                  )
                }
                className="w-full lg:w-[180px] rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm font-medium text-slate-800 focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                <option value="new">New</option>
                <option value="contacted">Contacted</option>
                <option value="won">Won</option>
                <option value="lost">Lost</option>
              </select>
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
    </div>
  );
}