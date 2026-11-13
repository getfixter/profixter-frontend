"use client";

/**
 * Level 2 of the Overview: the rows behind a number.
 *
 * A side panel on desktop and a bottom sheet on a phone, so the dashboard
 * stays where it was. A row opens the customer's full record (level 3) in the
 * All Users tab.
 */

import type { ReactNode } from "react";
import { customerHandoff, customerHref, planLabel, shortDate, type ListRow } from "@/lib/admin-overview";
import { EmptyState, ErrorState, Sheet, SkeletonRows } from "@/app/components/admin/ui";
import MaybeLink from "./MaybeLink";

export type DrawerState =
  | { kind: "list"; title: string; subtitle?: string; loading: boolean; error?: string; rows: ListRow[]; showConverted?: boolean }
  | { kind: "custom"; title: string; subtitle?: string; body: ReactNode }
  | null;

/* The kit Sheet: bottom sheet on a phone, side panel on desktop, focus trap, Escape, focus returns. */
export default function OverviewDrawer({ state, onClose, linkCustomers = false }: { state: DrawerState; onClose: () => void; linkCustomers?: boolean }) {
  return (
    <Sheet open={!!state} onClose={onClose} title={state?.title ?? ""} description={state?.subtitle} width="wide">
      {!state ? null : state.kind === "custom" ? (
        <div>{state.body}</div>
      ) : state.loading ? (
        <SkeletonRows count={6} label="Loading the list" />
      ) : state.error ? (
        <ErrorState title={state.error} message="Close this and try the number again in a moment." />
      ) : state.rows.length === 0 ? (
        <EmptyState message="Nobody here for this period." />
      ) : (
            <ul className="divide-y divide-adm-line">
              {state.rows.map((r) => (
                <li key={r.userId + (r.date || "")}>
                  <MaybeLink href={linkCustomers && r.email ? customerHref(r.email) : null} onClick={r.email ? customerHandoff(r.email) : undefined} className={`flex items-center gap-3 rounded-adm-md px-2 py-3 ${linkCustomers ? "transition hover:bg-adm-sunk" : ""}`}>
                    <span className="flex h-9 w-9 flex-none items-center justify-center rounded-full bg-adm-sunk text-[13px] font-semibold text-adm-text-2">
                      {(r.name || r.email || "?").trim()[0]?.toUpperCase()}
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-[14px] font-semibold text-adm-ink">{r.name || r.email}</span>
                      <span className="block truncate text-[12px] text-adm-text-3">
                        {[r.city, r.source, r.campaign].filter(Boolean).join(" · ")}
                      </span>
                    </span>
                    <span className="flex-none text-right">
                      <span className="block text-[12px] font-semibold text-adm-text-2">
                        {r.plan ? planLabel(r.plan) : r.status || (r.hadFreeVisit ? "Free Visit" : "—")}
                      </span>
                      <span className="block text-[12px] text-adm-text-3">
                        {shortDate(r.date || r.registeredAt)}
                        {state.showConverted && r.converted !== undefined ? (r.converted ? " · became member" : " · not yet") : ""}
                      </span>
                    </span>
                  </MaybeLink>
                </li>
              ))}
            </ul>
      )}
    </Sheet>
  );
}
