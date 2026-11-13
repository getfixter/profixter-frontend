"use client";

import { ChevronRightIcon } from "@heroicons/react/20/solid";
import Link from "next/link";
import type { ReactNode } from "react";
import { ButtonLink, EmptyState, StatusBadge, cx } from "@/app/components/admin/ui";
import type { JobRow, NeedsAction, NeedsItem } from "@/lib/admin/jobs";
import { JobRowItem } from "./JobRows";
import { markOpenedFromList } from "./openedFrom";

type Group = { id: string; title: string; reason: string; kinds: string[]; section: string; seeAll?: { href: string; label: string } };

/* Most urgent first (F.1 "Needs action view"). */
const GROUPS: Group[] = [
  { id: "requests", title: "Requests to review", reason: "Customer bookings and free-visit requests waiting for you to confirm or decline.", kinds: ["job_request"], section: "bookings" },
  { id: "unassigned", title: "No Fixter assigned", reason: "Upcoming jobs with nobody to do them.", kinds: ["job_unassigned"], section: "bookings" },
  { id: "not-closed", title: "Not closed", reason: "Confirmed jobs more than 2 hours past their start that nobody marked done.", kinds: ["job_not_closed"], section: "bookings" },
  { id: "problems", title: "Payment or slot problems", reason: "A payment failed or expired, or the reservation needs a look.", kinds: ["job_payment_problem", "job_reservation_issue"], section: "bookings" },
  { id: "inquiries", title: "New inquiries", reason: "Estimate and renovation requests nobody has answered.", kinds: ["estimate_lead_new", "renovation_request_new"], section: "project_leads", seeAll: { href: "/admin/leads", label: "All leads" } },
  {
    id: "projects",
    title: "Projects waiting on you",
    reason: "A signed agreement with no deposit invoice, a declined or expired signature, or an overdue invoice.",
    kinds: ["project_deposit_not_invoiced", "project_signature_declined", "project_signature_expired", "project_invoice_overdue"],
    section: "projects",
    seeAll: { href: "/admin/projects", label: "All projects" },
  },
  { id: "member-payment", title: "Member payment issues", reason: "A membership payment failed or is past due.", kinds: ["member_payment_issue"], section: "members", seeAll: { href: "/admin/customers?filter=members", label: "All members" } },
  { id: "member-ending", title: "Memberships ending", reason: "Memberships set to end within 30 days.", kinds: ["member_ending"], section: "members", seeAll: { href: "/admin/customers?filter=members", label: "All members" } },
];

const OTHER_SECTION_LIMIT = 5;

/**
 * Needs action (J-02, F.1): one grouped list built from the server's
 * collectors. Each item appears once (the server dedupes by kind + id and
 * gives a job its most serious reason). Job items use the Jobs list rows
 * (the same filter as the badge), so the Jobs count here equals the Jobs
 * badge. Other sections show up to five items and link to their screen.
 */
export function NeedsActionView({
  needs,
  jobRows,
  jobsCount,
  hrefFor,
  todayCount,
  onToday,
}: {
  needs: NeedsAction | null;
  jobRows: JobRow[];
  jobsCount: number;
  hrefFor: (row: JobRow) => string;
  todayCount: number | null;
  onToday: () => void;
}) {
  const byId = new Map(jobRows.map((r) => [r.id, r]));
  const sectionOf = (key: string) => needs?.sections.find((s) => s.key === key);
  const claimed = new Set<string>();

  const blocks: ReactNode[] = [];
  for (const group of GROUPS) {
    const section = sectionOf(group.section);
    if (group.section !== "bookings" && !section) continue;
    if (group.section !== "bookings" && section?.error) {
      if (GROUPS.find((g) => g.section === group.section)?.id === group.id) {
        blocks.push(
          <section key={group.id} className="flex flex-col gap-2" data-needs-group={group.section} data-error="">
            <h2 className="px-1 text-[15px] font-semibold text-adm-ink">{group.title}</h2>
            <p className="rounded-adm-md border border-adm-line bg-adm-surface px-4 py-3 text-[14px] text-adm-problem" role="status">
              {section.error.message || "This section could not be loaded."}
            </p>
          </section>
        );
      }
      continue;
    }
    if (group.section === "bookings") {
      const items = (sectionOf("bookings")?.items || []).filter((i) => group.kinds.includes(i.kind));
      const rows: JobRow[] = [];
      const loose: NeedsItem[] = [];
      for (const item of items) {
        claimed.add(item.id);
        const row = byId.get(item.id);
        if (row) rows.push(row);
        else loose.push(item);
      }
      // Without the aggregator's job section (older backend, or it failed) the job list fills the groups by flag.
      if (!needs || !section || section.error) {
        for (const row of jobRows) {
          if (claimed.has(row.id) || !rowInGroup(row, group.id)) continue;
          claimed.add(row.id);
          rows.push(row);
        }
      }
      if (!rows.length && !loose.length) continue;
      blocks.push(
        <NeedsGroup key={group.id} group={group} count={rows.length + loose.length}>
          {rows.map((row) => (
            <JobRowItem key={row.id} row={row} href={hrefFor(row)} showDate />
          ))}
          {loose.map((item) => (
            <ItemRow key={`${item.kind}:${item.id}`} item={item} />
          ))}
        </NeedsGroup>
      );
      continue;
    }
    const items = (section?.items || []).filter((i) => group.kinds.includes(i.kind));
    if (!items.length) continue;
    // The section's count can be larger than the items it sent; say so instead of pretending.
    const sectionTotal = Number(section?.count) || items.length;
    const sameSection = GROUPS.filter((g) => g.section === group.section);
    const total = sameSection.length > 1 ? items.length : Math.max(items.length, sectionTotal);
    blocks.push(
      <NeedsGroup key={group.id} group={group} count={total} shown={Math.min(items.length, OTHER_SECTION_LIMIT)}>
        {items.slice(0, OTHER_SECTION_LIMIT).map((item) => (
          <ItemRow key={`${item.kind}:${item.id}`} item={item} />
        ))}
      </NeedsGroup>
    );
  }

  // A job in the list with no aggregator item (the aggregator failed or limited): never hide it.
  const leftover = jobRows.filter((r) => !claimed.has(r.id));
  if (leftover.length && needs && !sectionOf("bookings")?.error) {
    blocks.push(
      <NeedsGroup key="other" group={{ id: "other", title: "Other jobs needing a look", reason: "Flagged by the job list.", kinds: [], section: "bookings" }} count={leftover.length}>
        {leftover.map((row) => (
          <JobRowItem key={row.id} row={row} href={hrefFor(row)} showDate />
        ))}
      </NeedsGroup>
    );
  }

  if (!blocks.length) {
    return (
      <EmptyState
        message="Nothing needs you right now"
        detail={todayCount === null ? undefined : `${todayCount} ${todayCount === 1 ? "job" : "jobs"} today.`}
        action={
          <button type="button" onClick={onToday} className="adm-btn adm-btn--secondary">
            See today
          </button>
        }
      />
    );
  }

  return (
    <div className="flex flex-col gap-5" data-needs-action="" data-jobs-count={jobsCount}>
      {blocks}
    </div>
  );
}

function rowInGroup(row: JobRow, groupId: string): boolean {
  const keys = new Set((row.flags || []).map((f) => String(f.key)));
  if (groupId === "problems") return keys.has("payment_problem") || keys.has("reservation_issue");
  if (groupId === "not-closed") return keys.has("not_closed");
  if (groupId === "requests") return keys.has("request_review");
  if (groupId === "unassigned") return keys.has("unassigned");
  return false;
}

function NeedsGroup({ group, count, shown, children }: { group: Group; count: number; shown?: number; children: ReactNode }) {
  const headingId = `needs-${group.id}`;
  return (
    <section className="flex flex-col gap-2" aria-labelledby={headingId} data-needs-group={group.id}>
      <div className="flex min-h-[36px] items-end justify-between gap-3 px-1">
        <div className="min-w-0">
          <h2 id={headingId} className="text-[15px] font-semibold text-adm-ink">
            {group.title}
            <span className="adm-num font-normal text-adm-text-2"> · {count}</span>
          </h2>
          <p className="text-[13px] text-adm-text-2">{group.reason}</p>
        </div>
        {group.seeAll && (
          <ButtonLink href={group.seeAll.href} variant="tertiary" className="flex-none">
            {shown !== undefined && shown < count ? `See all ${count}` : group.seeAll.label}
          </ButtonLink>
        )}
      </div>
      <ul role="list" className="overflow-hidden rounded-adm-md border border-adm-line bg-adm-surface">
        {children}
      </ul>
    </section>
  );
}

/** A Needs-action item that is not a job row (a member, a project, a lead), or a job the list did not include. */
function ItemRow({ item }: { item: NeedsItem }) {
  return (
    <li className="border-b border-adm-line last:border-b-0" data-needs-item={item.kind}>
      <Link href={item.href} onClick={item.href.startsWith("/admin/jobs/") ? markOpenedFromList : undefined} className="flex min-h-[64px] items-center gap-3 px-4 py-2.5 hover:bg-adm-bg">
        <span className="flex min-w-0 flex-1 flex-col gap-0.5">
          <span className="truncate text-[15px] font-semibold text-adm-ink">{item.title}</span>
          {item.subtitle && <span className="truncate text-[13px] text-adm-text-2">{item.subtitle}</span>}
          {item.reason && <span className={cx("text-[13px]", item.severity === "problem" ? "text-adm-problem" : "text-adm-attn")}>{item.reason}</span>}
        </span>
        <StatusBadge tone={item.severity === "problem" ? "problem" : "attention"} className="hidden sm:inline-flex">
          {item.severity === "problem" ? "Problem" : "Look"}
        </StatusBadge>
        <ChevronRightIcon className="h-5 w-5 flex-none text-adm-text-3" aria-hidden="true" />
      </Link>
    </li>
  );
}
