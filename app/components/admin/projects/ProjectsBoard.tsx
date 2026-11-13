"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { PlusIcon } from "@heroicons/react/20/solid";
import { createProject } from "@/lib/admin-service";
import { takeQuery } from "@/lib/admin/handoff";
import { invalidateQueries, errorMessage, useAdminQuery } from "@/lib/admin/query";
import { useHandoffQuery } from "@/lib/admin/useHandoffQuery";
import {
  STAGE_LABELS,
  STAGE_ORDER,
  fetchProjectAttention,
  locateInvoice,
  projectKeys,
  searchProjects,
  type ProjectRow,
  type ProjectSearchBody,
} from "@/lib/admin/projects";
import { Button, Chip, EmptyState, ErrorState, FilterBar, PageHeader, SearchField, SkeletonRows, useToast, formatCents } from "@/app/components/admin/ui";
import { EMPTY_PROJECT, ProjectFormSheet } from "./ProjectFormSheet";
import { StageBadge, ManualStatusBadge, AttentionBadge } from "./badges";

const PAGE_SIZE = 25;

function useDebounced<T>(value: T, ms: number): T {
  const [out, setOut] = useState(value);
  useEffect(() => {
    const t = window.setTimeout(() => setOut(value), ms);
    return () => window.clearTimeout(t);
  }, [value, ms]);
  return out;
}

/** Money on a row: the signed (executed) value when there is one, else what is awaiting signature. */
function RowMoney({ row }: { row: ProjectRow }) {
  if (row.executedValueCents > 0 || row.invoicedCents > 0) {
    return (
      <dl className="grid grid-cols-3 gap-2 text-[13px]" data-row-money="">
        <div className="min-w-0">
          <dt className="text-adm-text-3">Signed value</dt>
          <dd className="adm-num truncate font-semibold text-adm-ink">{formatCents(row.executedValueCents)}</dd>
        </div>
        <div className="min-w-0">
          <dt className="text-adm-text-3">Paid</dt>
          <dd className="adm-num truncate font-semibold text-adm-ok">{formatCents(row.paidCents)}</dd>
        </div>
        <div className="min-w-0">
          <dt className="text-adm-text-3">Outstanding</dt>
          <dd className={`adm-num truncate font-semibold ${row.outstandingCents > 0 ? "text-adm-ink" : "text-adm-text-3"}`}>{formatCents(row.outstandingCents)}</dd>
        </div>
      </dl>
    );
  }
  if (row.proposedValueCents > 0) {
    return (
      <p className="text-[13px] text-adm-text-2" data-row-money="">
        Proposed <span className="adm-num font-semibold text-adm-ink">{formatCents(row.proposedValueCents)}</span> · awaiting signature
      </p>
    );
  }
  return (
    <p className="text-[13px] text-adm-text-3" data-row-money="">
      No agreement yet
    </p>
  );
}

function ProjectRowItem({ row, attention }: { row: ProjectRow; attention?: { title: string; severity: "attention" | "problem" } }) {
  return (
    <li className="border-b border-adm-line last:border-b-0" data-project-row={row.id}>
      <Link href={`/admin/projects/${encodeURIComponent(row.id)}`} scroll={false} className="flex w-full flex-col gap-2 px-4 py-3 hover:bg-adm-bg focus-visible:bg-adm-bg">
        <div className="flex min-w-0 items-start justify-between gap-3">
          <div className="min-w-0">
            <p className="truncate text-[15px] font-semibold text-adm-ink">{row.customerName || "Unnamed customer"}</p>
            <p className="truncate text-[13px] text-adm-text-2">{row.address || "No address"}</p>
          </div>
          <span className="adm-num flex-none text-[13px] text-adm-text-3">{row.projectNumber}</span>
        </div>
        <div className="flex flex-wrap items-center gap-1.5">
          <StageBadge stage={row.derivedStage} />
          <ManualStatusBadge status={row.manualStatus} />
          {attention && <AttentionBadge severity={attention.severity}>{attention.title}</AttentionBadge>}
        </div>
        <RowMoney row={row} />
      </Link>
    </li>
  );
}

function ResultPage({ body, attention, onTotal }: { body: ProjectSearchBody; attention: Record<string, { title: string; severity: "attention" | "problem" }>; onTotal?: (total: number) => void }) {
  const q = useAdminQuery(projectKeys.list(body), (signal) => searchProjects(body, signal), { staleTime: 20_000 });
  const total = q.data?.total;
  useEffect(() => {
    if (typeof total === "number") onTotal?.(total);
  }, [total, onTotal]);
  if (q.isLoading) return <SkeletonRows count={body.page === 1 ? 5 : 2} leading={false} label="Loading projects" />;
  if (q.error && !q.data) return <ErrorState title="Projects could not be loaded" message={errorMessage(q.error)} onRetry={q.refetch} />;
  return (
    <>
      {(q.data?.projects || []).map((row) => (
        <ProjectRowItem key={row.id} row={row} attention={attention[row.id]} />
      ))}
    </>
  );
}

/**
 * /admin/projects: the renovation pipeline. Search goes to the server in a
 * POST body (never in the URL); the stage filter (a view name) is in the URL.
 * Every amount comes from the financial service, never from the manual
 * "estimate" typed on the project.
 */
export function ProjectsBoard({ hidden = false }: { hidden?: boolean }) {
  const router = useRouter();
  const params = useSearchParams();
  const toast = useToast();
  const stage = STAGE_ORDER.includes(String(params.get("stage")) as never) ? String(params.get("stage")) : "";
  const [q, setQ] = useState(() => (typeof window === "undefined" ? "" : takeQuery("projects")));
  useHandoffQuery("projects", setQ);
  const search = useDebounced(q.trim(), 300);
  const [creating, setCreating] = useState(false);
  /* Paging and the total belong to one search + stage; a new filter starts again at page 1. */
  const filterKey = `${stage}|${search}`;
  const [paging, setPaging] = useState({ key: filterKey, pages: 1 });
  const pages = paging.key === filterKey ? paging.pages : 1;
  const [totals, setTotals] = useState<Record<string, number>>({});
  const total = filterKey in totals ? totals[filterKey] : null;
  const onTotal = useCallback((n: number) => setTotals((t) => (t[filterKey] === n ? t : { ...t, [filterKey]: n })), [filterKey]);

  const attentionQ = useAdminQuery(["projects", "attention"], fetchProjectAttention, { staleTime: 60_000, pollMs: 120_000 });
  const attention = attentionQ.data || {};

  /* Old invoice links: /admin/projects?invoiceId=X (or ?invoice=X) open the invoice in its project. */
  const invoiceParam = params.get("invoiceId") || params.get("invoice");
  const locating = useRef("");
  const navRef = useRef({ router, toast });
  useEffect(() => {
    navRef.current = { router, toast };
  });
  useEffect(() => {
    if (!invoiceParam || locating.current === invoiceParam) return;
    locating.current = invoiceParam;
    const controller = new AbortController();
    locateInvoice(invoiceParam, controller.signal)
      .then((projectId) => {
        if (projectId) navRef.current.router.replace(`/admin/projects/${encodeURIComponent(projectId)}?tab=invoices&invoice=${encodeURIComponent(invoiceParam)}`, { scroll: false });
        else throw new Error("not found");
      })
      .catch(() => {
        if (controller.signal.aborted) return;
        navRef.current.toast.show("That invoice could not be found. It may have been archived.");
        navRef.current.router.replace("/admin/projects", { scroll: false });
      });
  }, [invoiceParam]);

  const bodies = useMemo(
    () => Array.from({ length: pages }, (_, i) => ({ search, stage, page: i + 1, limit: PAGE_SIZE }) satisfies ProjectSearchBody),
    [pages, search, stage]
  );
  const shown = Math.min(pages * PAGE_SIZE, total ?? 0);
  const stageHref = (key: string) => (key ? `/admin/projects?stage=${key}` : "/admin/projects");

  return (
    <div data-section="projects" hidden={hidden}>
      <PageHeader
        title="Projects"
        description="Renovation work from lead to warranty"
        actions={
          <Button icon={<PlusIcon className="h-5 w-5" aria-hidden="true" />} onClick={() => setCreating(true)} data-action="new-project">
            New project
          </Button>
        }
      />
      <SearchField label="Search projects" value={q} onChange={setQ} placeholder="Name, address, phone, email or number" className="mb-3" />
      <FilterBar label="Project stage">
        <Chip href={stageHref("")} selected={!stage}>
          All
        </Chip>
        {STAGE_ORDER.map((key) => (
          <Chip key={key} href={stageHref(key)} selected={stage === key}>
            {STAGE_LABELS[key]}
          </Chip>
        ))}
      </FilterBar>

      <div className="mt-3 overflow-hidden rounded-adm-md border border-adm-line bg-adm-surface">
        <ul role="list" aria-label="Projects" data-project-list="">
          {bodies.map((body, index) => (
            <ResultPage key={`${body.page}-${body.search}-${body.stage}`} body={body} attention={attention} onTotal={index === 0 ? onTotal : undefined} />
          ))}
        </ul>
        {total === 0 && (
          <EmptyState
            message={search || stage ? "No projects match" : "No projects yet"}
            detail={search || stage ? "Try another name, or clear the stage filter." : "Create one here, or from a lead."}
          />
        )}
      </div>
      {total !== null && total > shown && (
        <div className="mt-3 flex items-center justify-between gap-3">
          <p className="text-[13px] text-adm-text-3">
            Showing {shown} of {total}
          </p>
          <Button variant="secondary" onClick={() => setPaging({ key: filterKey, pages: pages + 1 })} data-action="more-projects">
            Show more
          </Button>
        </div>
      )}

      <ProjectFormSheet
        open={creating}
        mode="create"
        title="New project"
        initial={EMPTY_PROJECT}
        onClose={() => setCreating(false)}
        onSubmit={async (data) => {
          const project = await createProject(data);
          setCreating(false);
          invalidateQueries("projects");
          toast.show(`Project ${project.projectNumber} created`);
          router.push(`/admin/projects/${encodeURIComponent(project._id)}`, { scroll: false });
        }}
      />
    </div>
  );
}
