"use client";

/**
 * Level 2 of the Overview: the rows behind a number.
 *
 * A side panel on desktop and a bottom sheet on a phone, so the dashboard
 * stays where it was. A row opens the customer's full record (level 3) in the
 * All Users tab.
 */

import { useEffect, useRef, type ReactNode } from "react";
import { customerHref, planLabel, shortDate, type ListRow } from "@/lib/admin-overview";
import MaybeLink from "./MaybeLink";

export type DrawerState =
  | { kind: "list"; title: string; subtitle?: string; loading: boolean; error?: string; rows: ListRow[]; showConverted?: boolean }
  | { kind: "custom"; title: string; subtitle?: string; body: ReactNode }
  | null;

export default function OverviewDrawer({ state, onClose, linkCustomers = false }: { state: DrawerState; onClose: () => void; linkCustomers?: boolean }) {
  const panelRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!state) return;
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    panelRef.current?.focus();
    return () => {
      window.removeEventListener("keydown", onKey);
      document.body.style.overflow = prev;
    };
  }, [state, onClose]);

  if (!state) return null;

  return (
    <div className="fixed inset-0 z-[90] flex items-end justify-end bg-slate-950/40 backdrop-blur-[2px] md:items-stretch" onClick={onClose}>
      <div
        ref={panelRef}
        tabIndex={-1}
        role="dialog"
        aria-modal="true"
        aria-label={state.title}
        onClick={(e) => e.stopPropagation()}
        className="ov-drawer flex max-h-[88vh] w-full flex-col overflow-hidden rounded-t-[24px] bg-white shadow-[0_-20px_60px_-20px_rgba(11,22,40,0.4)] outline-none md:max-h-none md:w-[560px] md:rounded-none md:rounded-l-[24px]"
      >
        <div className="flex items-start justify-between gap-4 border-b border-slate-100 px-5 pb-4 pt-5 md:px-6">
          <div className="min-w-0">
            <h3 className="text-[20px] font-bold tracking-[-0.02em] text-slate-900">{state.title}</h3>
            {state.subtitle ? <p className="mt-0.5 text-[13px] text-slate-500">{state.subtitle}</p> : null}
          </div>
          <button type="button" onClick={onClose} className="flex h-10 w-10 flex-none items-center justify-center rounded-full text-[22px] text-slate-400 hover:bg-slate-100 hover:text-slate-700" aria-label="Close">
            ×
          </button>
        </div>
        <div className="flex-1 overflow-y-auto px-3 pb-6 pt-2 md:px-4">
          {state.kind === "custom" ? (
            <div className="px-2 pt-2">{state.body}</div>
          ) : state.loading ? (
            <div className="space-y-2 px-2 pt-3">
              {Array.from({ length: 6 }).map((_, i) => (
                <div key={i} className="ov-skel h-14 rounded-[12px]" />
              ))}
            </div>
          ) : state.error ? (
            <p className="px-2 pt-6 text-[14px] text-rose-600">{state.error}</p>
          ) : state.rows.length === 0 ? (
            <p className="px-2 pt-8 text-center text-[14px] text-slate-500">Nobody here for this period.</p>
          ) : (
            <ul className="divide-y divide-slate-100">
              {state.rows.map((r) => (
                <li key={r.userId + (r.date || "")}>
                  <MaybeLink href={linkCustomers && r.email ? customerHref(r.email) : null} className={`flex items-center gap-3 rounded-[12px] px-2 py-3 ${linkCustomers ? "transition hover:bg-slate-50" : ""}`}>
                    <span className="flex h-9 w-9 flex-none items-center justify-center rounded-full bg-slate-100 text-[13px] font-bold text-slate-600">
                      {(r.name || r.email || "?").trim()[0]?.toUpperCase()}
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-[14px] font-semibold text-slate-900">{r.name || r.email}</span>
                      <span className="block truncate text-[12px] text-slate-500">
                        {[r.city, r.source, r.campaign].filter(Boolean).join(" · ")}
                      </span>
                    </span>
                    <span className="flex-none text-right">
                      <span className="block text-[12px] font-semibold text-slate-700">
                        {r.plan ? planLabel(r.plan) : r.status || (r.hadFreeVisit ? "Free Visit" : "—")}
                      </span>
                      <span className="block text-[11px] text-slate-400">
                        {shortDate(r.date || r.registeredAt)}
                        {state.showConverted && r.converted !== undefined ? (r.converted ? " · became member" : " · not yet") : ""}
                      </span>
                    </span>
                  </MaybeLink>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>
    </div>
  );
}
