"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useCallback, useRef, useState } from "react";
import { ArrowLeftIcon, EllipsisHorizontalIcon } from "@heroicons/react/20/solid";
import ProjectChangeOrders from "@/app/components/admin/ProjectChangeOrders";
import ProjectContracts from "@/app/components/admin/ProjectContracts";
import ProjectEstimates from "@/app/components/admin/ProjectEstimates";
import ProjectFinancialSummary from "@/app/components/admin/ProjectFinancialSummary";
import ProjectInvoices from "@/app/components/admin/ProjectInvoices";
import { deleteProject, updateProject, type ProjectInput } from "@/lib/admin-service";
import { errorMessage, errorStatus, invalidateQueries, setQueryData, useAdminQuery } from "@/lib/admin/query";
import {
  PROJECT_TABS,
  fetchProjectOverview,
  fetchProjectRecord,
  formatDay,
  normalizeTab,
  projectKeys,
  type ProjectOverview,
  type ProjectTab,
} from "@/lib/admin/projects";
import {
  Button,
  ConfirmSheet,
  ContactActions,
  EmptyState,
  ErrorState,
  IconButton,
  Menu,
  MoneyBlock,
  SkeletonRows,
  StatusBadge,
  Tabs,
  formatCents,
  useToast,
  type MoneyRow,
} from "@/app/components/admin/ui";
import { AttentionBadge, ManualStatusBadge, StageBadge } from "./badges";
import { NextSteps } from "./NextSteps";
import { ProjectCloseout } from "./ProjectCloseout";
import { ProjectFormSheet, projectToInput } from "./ProjectFormSheet";
import { ProjectStatusSheet } from "./ProjectStatusSheet";
import { ProjectVisits } from "./ProjectVisits";
import { QualificationView } from "./Qualification";

const TAB_LABELS: Record<ProjectTab, string> = {
  overview: "Overview",
  estimate: "Estimate",
  agreement: "Agreement",
  "change-orders": "Change orders",
  invoices: "Invoices",
  visits: "Visits",
  closeout: "Closeout",
};

/**
 * The money, with each figure named for what it is. A signed agreement plus
 * executed change orders is the agreed value; an issued but unsigned
 * agreement and unsigned change orders are only "awaiting signature";
 * invoices are what was asked for; payments are what arrived.
 */
export function FinancialSummaryCard({ overview }: { overview: ProjectOverview }) {
  const f = overview.financials;
  const rows: MoneyRow[] = [
    f.agreementSigned
      ? { label: "Signed value", cents: f.executedValueCents, strong: true, note: "Signed agreement plus executed change orders" }
      : { label: "Signed value", text: "Not signed yet", tone: "muted", note: "Nothing is agreed until the customer signs" },
  ];
  if (f.proposedValueCents > 0 && !f.agreementSigned) rows.push({ label: "Proposed, awaiting signature", cents: f.proposedValueCents, tone: "muted", note: "Issued agreement, not signed" });
  if (f.pendingChangeOrderCents) rows.push({ label: "Change orders awaiting signature", text: `${f.pendingChangeOrderCents > 0 ? "+" : "−"}${formatCents(Math.abs(f.pendingChangeOrderCents))}`, tone: "muted", note: "Not agreed and not billable until signed" });
  rows.push(
    { label: "Invoiced", cents: f.invoicedCents, note: "Asked for on issued invoices" },
    { label: "Paid", cents: f.paidCents, tone: "success", note: "Payments received" },
    { label: "Outstanding", cents: f.outstandingCents, strong: true, tone: f.outstandingCents > 0 ? "default" : "muted", note: "Invoiced and not paid yet" }
  );
  if (f.agreementSigned) rows.push({ label: "Signed, not invoiced yet", cents: f.uninvoicedExecutedCents, tone: f.uninvoicedExecutedCents > 0 ? "default" : "muted" });
  return (
    <div data-financials="">
      <MoneyBlock title="Money" rows={rows} footer="Payments made online are kept as Stripe recorded them. Refunds are made in Stripe." />
    </div>
  );
}

function DocumentsList({ overview, onTab }: { overview: ProjectOverview; onTab: (tab: ProjectTab, extra?: Record<string, string>) => void }) {
  const { agreements, changeOrders, invoices } = overview.documents;
  if (!agreements.length && !changeOrders.length && !invoices.length) return null;
  const sigWord = (s: ProjectOverview["documents"]["agreements"][number]["signature"]) => {
    if (!s) return "";
    if (s.status === "Completed") return `signed ${formatDay(s.completedAt, false)}`;
    if (s.status === "Declined") return `declined ${formatDay(s.declinedAt, false)}`;
    if (s.status === "Expired") return "link expired";
    if (s.live) return s.openedAt ? "opened, not signed" : `sent ${formatDay(s.sentAt, false)}`;
    return "";
  };
  const toneFor = (status: string, s?: { status: string } | null) =>
    s?.status === "Declined" || s?.status === "Expired" ? ("problem" as const) : status === "Signed" || status === "Executed" || status === "Paid in Full" ? ("success" as const) : status === "Canceled" || status === "Voided" || status === "Superseded" ? ("neutral" as const) : ("attention" as const);
  const row = (key: string, label: string, status: string, note: string, tone: ReturnType<typeof toneFor>, onClick: () => void, extra?: string) => (
    <li key={key} className="border-b border-adm-line last:border-b-0">
      <button type="button" onClick={onClick} className="flex min-h-[52px] w-full items-center justify-between gap-3 px-4 py-2 text-left hover:bg-adm-bg" data-document={key}>
        <span className="min-w-0">
          <span className="block truncate text-[14px] font-semibold text-adm-ink">{label}</span>
          {(note || extra) && <span className="block truncate text-[13px] text-adm-text-2">{[note, extra].filter(Boolean).join(" · ")}</span>}
        </span>
        <StatusBadge tone={tone}>{status}</StatusBadge>
      </button>
    </li>
  );
  return (
    <section className="flex flex-col gap-2">
      <h2 className="px-1 text-[15px] font-semibold text-adm-ink">Documents</h2>
      <ul role="list" className="overflow-hidden rounded-adm-md border border-adm-line bg-adm-surface" data-documents="">
        {agreements.map((a) =>
          row(`agreement-${a.id}`, `Agreement #${String(a.contractNumber).replace(/^#/, "")} v${a.version}${a.current ? "" : " (old version)"}`, a.signature?.status === "Declined" ? "Declined" : a.status, sigWord(a.signature), toneFor(a.status, a.signature), () => onTab("agreement"), formatCents(a.priceCents))
        )}
        {changeOrders.map((c) =>
          row(`co-${c.id}`, `Change order ${c.changeOrderNumber}${c.title ? ` · ${c.title}` : ""}`, c.signature?.status === "Declined" ? "Declined" : c.status, sigWord(c.signature), toneFor(c.status, c.signature), () => onTab("change-orders"), `${c.netAdjustmentCents >= 0 ? "+" : "−"}${formatCents(Math.abs(c.netAdjustmentCents))}`)
        )}
        {invoices.map((i) =>
          row(
            `invoice-${i.id}`,
            `Invoice #${i.invoiceNumber}`,
            i.overdue ? "Overdue" : i.status,
            i.balanceCents > 0 ? `${formatCents(i.balanceCents)} due${i.dueDate ? ` ${formatDay(i.dueDate, false)}` : ""}` : "Paid",
            i.overdue ? "problem" : toneFor(i.status),
            () => onTab("invoices", { invoice: i.id }),
            formatCents(i.totalCents)
          )
        )}
      </ul>
    </section>
  );
}

function Overview({ overview, onTab, notes }: { overview: ProjectOverview; onTab: (tab: ProjectTab, extra?: Record<string, string>) => void; notes: string }) {
  const [breakdown, setBreakdown] = useState(false);
  return (
    <div className="flex flex-col gap-4" data-tab-panel="overview">
      <DocumentsList overview={overview} onTab={onTab} />
      <QualificationView q={overview.project.qualification} />
      {notes && (
        <section className="rounded-adm-md border border-adm-line bg-adm-surface p-4">
          <h3 className="text-[15px] font-semibold text-adm-ink">Notes</h3>
          <p className="mt-1 whitespace-pre-wrap break-words text-[14px] text-adm-ink">{notes}</p>
        </section>
      )}
      <div>
        <Button variant="tertiary" onClick={() => setBreakdown((b) => !b)} aria-expanded={breakdown} data-action="breakdown">
          {breakdown ? "Hide the breakdown" : "Where the money figures come from"}
        </Button>
        {breakdown && (
          <div className="mt-2">
            <ProjectFinancialSummary projectId={overview.project.id} />
          </div>
        )}
      </div>
    </div>
  );
}

/**
 * /admin/projects/[id]: compact header (customer, address, derived stage
 * beside the manual status), the money, the server's next steps and the
 * documents, then tabs in work order. The tab is in the URL (?tab=), and an
 * invoice deep link (?tab=invoices&invoice=<id>, or the older ?invoiceId=)
 * opens that invoice.
 */
export function ProjectDetail({ id }: { id: string }) {
  const router = useRouter();
  const params = useSearchParams();
  const toast = useToast();
  const invoiceParam = params.get("invoice") || params.get("invoiceId") || "";
  const tab: ProjectTab = params.get("tab") ? normalizeTab(params.get("tab")) : invoiceParam ? "invoices" : "overview";
  const overviewQ = useAdminQuery(projectKeys.overview(id), (signal) => fetchProjectOverview(id, signal), { staleTime: 15_000 });
  const recordQ = useAdminQuery(projectKeys.record(id), (signal) => fetchProjectRecord(id, signal), { staleTime: 60_000 });
  const [editing, setEditing] = useState(false);
  const [statusOpen, setStatusOpen] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const menuRef = useRef<HTMLButtonElement>(null);

  const tabHref = useCallback(
    (next: string, extra: Record<string, string> = {}) => {
      const qs = new URLSearchParams();
      if (next !== "overview") qs.set("tab", next);
      for (const [k, v] of Object.entries(extra)) if (v) qs.set(k, v);
      const s = qs.toString();
      return `/admin/projects/${encodeURIComponent(id)}${s ? `?${s}` : ""}`;
    },
    [id]
  );
  const goTab = useCallback(
    (next: string, extra?: Record<string, string>) => {
      invalidateQueries(projectKeys.overview(id));
      router.replace(tabHref(normalizeTab(next), extra), { scroll: false });
    },
    [id, router, tabHref]
  );
  const docsChanged = useCallback(() => {
    invalidateQueries(projectKeys.overview(id));
    invalidateQueries(["projects", "search"]);
  }, [id]);

  const overview = overviewQ.data;
  const record = recordQ.data;

  if (overviewQ.isLoading) {
    return (
      <div data-project-detail="loading">
        <SkeletonRows count={3} leading={false} label="Loading the project" />
      </div>
    );
  }
  if (overviewQ.error && !overview) {
    const status = errorStatus(overviewQ.error);
    return (
      <div data-project-detail="error" className="flex flex-col gap-3">
        <Link href="/admin/projects" className="inline-flex min-h-[44px] items-center gap-1 text-[14px] font-semibold text-adm-text-2">
          <ArrowLeftIcon className="h-5 w-5" aria-hidden="true" /> Projects
        </Link>
        {status === 404 || status === 400 ? (
          <EmptyState message="This project was not found" detail="It may have been deleted, or the link is out of date." />
        ) : (
          <ErrorState title="The project could not be loaded" message={errorMessage(overviewQ.error)} onRetry={overviewQ.refetch} />
        )}
      </div>
    );
  }
  if (!overview) return null;
  const p = overview.project;

  const tabs = PROJECT_TABS.map((t) => ({
    id: t,
    label: TAB_LABELS[t],
    href: tabHref(t),
    count:
      t === "change-orders"
        ? overview.documents.changeOrders.length || undefined
        : t === "invoices"
          ? overview.documents.invoices.length || undefined
          : t === "visits"
            ? overview.linkedBookings.length || undefined
            : t === "closeout"
              ? p.punchList.filter((i) => !i.done).length || undefined
              : undefined,
  }));

  const docTab = (node: (r: NonNullable<typeof record>) => React.ReactNode) =>
    record ? node(record) : recordQ.error ? <ErrorState title="The project documents could not be loaded" message={errorMessage(recordQ.error)} onRetry={recordQ.refetch} /> : <SkeletonRows count={2} leading={false} label="Loading" />;

  return (
    <div data-project-detail={p.id} className="flex min-w-0 flex-col gap-4">
      <header className="flex flex-col gap-3">
        <div className="flex items-center justify-between gap-2">
          <Link href="/admin/projects" className="inline-flex min-h-[44px] items-center gap-1 text-[14px] font-semibold text-adm-text-2 hover:text-adm-ink">
            <ArrowLeftIcon className="h-5 w-5" aria-hidden="true" /> Projects
          </Link>
          <div className="flex items-center gap-1">
            {overview.allowedActions.edit && (
              <Button variant="secondary" onClick={() => setEditing(true)} disabled={!record} data-action="edit-project">
                Edit details
              </Button>
            )}
            <IconButton ref={menuRef} label="More project actions" icon={<EllipsisHorizontalIcon className="h-5 w-5" />} onClick={() => setMenuOpen(true)} />
          </div>
        </div>
        <div className="min-w-0">
          <p className="adm-num text-[13px] text-adm-text-3">
            {p.projectNumber} · {p.projectType}
          </p>
          <h1 className="break-words text-[22px] font-semibold leading-tight text-adm-ink" data-project-customer="">
            {p.customerId ? (
              <Link href={`/admin/customers/${encodeURIComponent(p.customerId)}`} className="hover:underline">
                {p.customerName}
              </Link>
            ) : (
              p.customerName
            )}
          </h1>
          <p className="break-words text-[14px] text-adm-text-2">{p.address}</p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <StageBadge stage={overview.derivedStage} />
          <ManualStatusBadge status={overview.manualStatus} />
          {overview.allowedActions.edit && (
            <Button variant="tertiary" onClick={() => setStatusOpen(true)} data-action="change-status">
              Change status
            </Button>
          )}
          {overview.lead && (
            <Link href={overview.lead.href} className="text-[13px] font-semibold text-adm-accent-ink hover:underline" data-lead-link="">
              From a lead
            </Link>
          )}
          {p.isDeleted && <AttentionBadge severity="problem">Deleted project</AttentionBadge>}
        </div>
        <ContactActions phone={p.phone} email={p.email} address={p.address} canText={false} />
      </header>

      <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_360px]">
        <section className="order-2 flex min-w-0 flex-col gap-2 lg:order-1">
          <h2 className="px-1 text-[15px] font-semibold text-adm-ink">Next steps</h2>
          <NextSteps overview={overview} onTab={goTab} />
        </section>
        <div className="order-1 lg:order-2">
          <FinancialSummaryCard overview={overview} />
        </div>
      </div>

      <Tabs label="Project sections" items={tabs} value={tab} className="adm-sticky bg-adm-bg" />

      <div className="min-w-0" key={tab}>
        {tab === "overview" && <Overview overview={overview} onTab={goTab} notes={p.notes} />}
        {tab === "estimate" && docTab((r) => <ProjectEstimates project={r} />)}
        {tab === "agreement" && docTab((r) => <ProjectContracts project={r} onChanged={docsChanged} />)}
        {tab === "change-orders" && docTab((r) => <ProjectChangeOrders project={r} onChanged={docsChanged} />)}
        {tab === "invoices" && docTab((r) => <ProjectInvoices project={r} onChanged={docsChanged} initialInvoiceId={invoiceParam || undefined} />)}
        {tab === "visits" && <ProjectVisits overview={overview} />}
        {tab === "closeout" && <ProjectCloseout overview={overview} />}
      </div>

      {statusOpen && <ProjectStatusSheet open onClose={() => setStatusOpen(false)} overview={overview} />}

      {record && (
        <ProjectFormSheet
          open={editing}
          mode="edit"
          title={`Edit ${p.projectNumber}`}
          initial={projectToInput(record)}
          onClose={() => setEditing(false)}
          onSubmit={async (data: ProjectInput) => {
            // The status is never sent from here: it changes only through Change status (with history).
            const { status: _status, ...rest } = data;
            void _status;
            const saved = await updateProject(p.id, rest);
            setQueryData(projectKeys.record(p.id), saved);
            invalidateQueries(projectKeys.overview(p.id));
            invalidateQueries(["projects", "search"]);
            setEditing(false);
            toast.show("Project saved");
          }}
        />
      )}

      <Menu
        open={menuOpen}
        onClose={() => setMenuOpen(false)}
        anchorRef={menuRef}
        title={p.projectNumber}
        items={[{ label: "Delete project", tone: "destructive", onSelect: () => setDeleting(true), disabled: p.isDeleted }]}
      />

      <ConfirmSheet
        open={deleting}
        onClose={() => setDeleting(false)}
        title={`Delete ${p.projectNumber}?`}
        consequence="The project leaves the Projects list. Its agreements, change orders, invoices, files and history are kept for the record."
        confirmLabel="Delete project"
        tone="danger"
        typedConfirmation={p.projectNumber}
        typedLabel={
          <>
            Type the project number <span className="font-mono">{p.projectNumber}</span> to confirm
          </>
        }
        onConfirm={async () => {
          await deleteProject(p.id, "DELETE");
          invalidateQueries("projects");
          toast.show("Project deleted. Its documents were kept.");
          router.push("/admin/projects", { scroll: false });
        }}
      />
    </div>
  );
}
