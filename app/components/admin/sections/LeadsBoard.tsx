"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useCallback, useEffect, useMemo, useState } from "react";
import { PROJECT_TYPES } from "@/lib/admin-service";
import { can, PERM } from "@/lib/admin-access";
import { takeQuery } from "@/lib/admin/handoff";
import { errorCode, errorMessage, errorStatus, invalidateQueries, useAdminQuery } from "@/lib/admin/query";
import { useHandoffQuery } from "@/lib/admin/useHandoffQuery";
import { formatDay } from "@/lib/admin/projects";
import {
  convertLeadToProject,
  deleteLead,
  estimateRange,
  fetchLead,
  leadKeys,
  leadStatusLabel,
  parseLeadRef,
  searchLeads,
  setLeadStatus,
  type LeadDetail,
  type LeadModel,
  type LeadRow,
  type LeadSearchBody,
} from "@/lib/admin/leads";
import { useAdmin } from "@/app/components/admin/shell/AdminContext";
import { QualificationView } from "@/app/components/admin/projects/Qualification";
import {
  Button,
  ButtonLink,
  Chip,
  ConfirmSheet,
  ContactActions,
  EmptyState,
  ErrorState,
  Field,
  FilterBar,
  PageHeader,
  SearchField,
  Select,
  Sheet,
  SkeletonRows,
  StatusBadge,
  TextInput,
  useToast,
  type StatusTone,
} from "@/app/components/admin/ui";

const PAGE_SIZE = 30;
const STATUS_FILTERS = ["new", "contacted", "qualified", "won", "lost"] as const;

function statusTone(status: string): StatusTone {
  if (status === "new" || status === "pending_confirmation") return "attention";
  if (status === "won" || status === "completed" || status === "confirmed") return "success";
  if (status === "lost" || status === "declined" || status === "canceled") return "neutral";
  return "info";
}

function useDebounced<T>(value: T, ms: number): T {
  const [out, setOut] = useState(value);
  useEffect(() => {
    const t = window.setTimeout(() => setOut(value), ms);
    return () => window.clearTimeout(t);
  }, [value, ms]);
  return out;
}

function LeadRowItem({ lead }: { lead: LeadRow }) {
  const range = estimateRange(lead.estimateLow, lead.estimateHigh);
  return (
    <li className="border-b border-adm-line last:border-b-0" data-lead-row={lead.key}>
      <Link href={`/admin/leads/${encodeURIComponent(lead.key)}`} scroll={false} className="flex w-full flex-col gap-1.5 px-4 py-3 hover:bg-adm-bg focus-visible:bg-adm-bg">
        <div className="flex min-w-0 items-start justify-between gap-3">
          <div className="min-w-0">
            <p className="adm-clamp-2 text-[15px] font-semibold leading-5 text-adm-ink">{lead.name || lead.email || "Unnamed lead"}</p>
            <p className="adm-clamp-2 text-[13px] leading-[18px] text-adm-text-2">{[lead.serviceLabel, lead.address].filter(Boolean).join(" · ") || "No details"}</p>
          </div>
          <span className="adm-num flex-none text-[13px] text-adm-text-3">{formatDay(lead.createdAt, false)}</span>
        </div>
        <div className="flex flex-wrap items-center gap-1.5">
          <StatusBadge tone={statusTone(lead.status)}>{leadStatusLabel(lead.status)}</StatusBadge>
          {lead.model === "estimate" && <StatusBadge tone="info">Estimate builder</StatusBadge>}
          {lead.projectId && <StatusBadge tone="success">Project</StatusBadge>}
          {lead.bookingId && <StatusBadge tone="info">Has a visit</StatusBadge>}
          {range && <span className="adm-num text-[13px] text-adm-text-2">{range}</span>}
        </div>
      </Link>
    </li>
  );
}

function LeadPage({ body, onTotal }: { body: LeadSearchBody; onTotal?: (n: number) => void }) {
  const q = useAdminQuery(leadKeys.list(body), (signal) => searchLeads(body, signal), { staleTime: 20_000, pollMs: body.page === 1 ? 120_000 : undefined });
  const total = q.data?.total;
  useEffect(() => {
    if (typeof total === "number") onTotal?.(total);
  }, [total, onTotal]);
  if (q.isLoading) return <SkeletonRows count={body.page === 1 ? 5 : 2} leading={false} label="Loading leads" />;
  if (q.error && !q.data) return <ErrorState title="Leads could not be loaded" message={errorMessage(q.error)} onRetry={q.refetch} />;
  return (
    <>
      {(q.data?.leads || []).map((lead) => (
        <LeadRowItem key={lead.key} lead={lead} />
      ))}
    </>
  );
}

/**
 * /admin/leads: estimate-builder leads and service requests in one list.
 * Search goes to the server in a POST body; the status filter (a view name)
 * is in the URL. /admin/leads?open=<id> opens that lead (any id form).
 */
export function LeadsBoard() {
  const router = useRouter();
  const params = useSearchParams();
  const status = STATUS_FILTERS.includes(String(params.get("status")) as never) ? String(params.get("status")) : "";
  const modelParam = params.get("model");
  const model: "" | LeadModel = modelParam === "estimate" || modelParam === "request" ? modelParam : "";
  const [q, setQ] = useState(() => (typeof window === "undefined" ? "" : takeQuery("leads")));
  useHandoffQuery("leads", setQ);
  const search = useDebounced(q.trim(), 300);
  const filterKey = `${status}|${model}|${search}`;
  const [paging, setPaging] = useState({ key: filterKey, pages: 1 });
  const pages = paging.key === filterKey ? paging.pages : 1;
  const [totals, setTotals] = useState<Record<string, number>>({});
  const total = filterKey in totals ? totals[filterKey] : null;
  const onTotal = useCallback((n: number) => setTotals((t) => (t[filterKey] === n ? t : { ...t, [filterKey]: n })), [filterKey]);

  /* ?open=<id>: "estimate-<id>", "request-<id>", "estimate:<id>" or a bare request id. */
  const openParam = params.get("open");
  useEffect(() => {
    if (!openParam) return;
    const ref = parseLeadRef(openParam);
    router.replace(ref ? `/admin/leads/${encodeURIComponent(ref.bare ? openParam : ref.key)}` : "/admin/leads", { scroll: false });
  }, [openParam, router]);

  const bodies = useMemo(() => Array.from({ length: pages }, (_, i) => ({ search, status, model, page: i + 1, limit: PAGE_SIZE }) satisfies LeadSearchBody), [pages, search, status, model]);
  const shown = Math.min(pages * PAGE_SIZE, total ?? 0);
  const href = (next: { status?: string; model?: string }) => {
    const qs = new URLSearchParams();
    const s = next.status ?? status;
    const m = next.model ?? model;
    if (s) qs.set("status", s);
    if (m) qs.set("model", m);
    const str = qs.toString();
    return `/admin/leads${str ? `?${str}` : ""}`;
  };

  return (
    <div data-section="leads">
      <PageHeader title="Leads" description="Estimate builder leads and service requests" />
      <SearchField label="Search leads" value={q} onChange={setQ} placeholder="Name, email, phone, address or message" className="mb-3" />
      <FilterBar label="Lead filters">
        <Chip href={href({ status: "", model: "" })} selected={!status && !model}>
          All
        </Chip>
        <Chip href={href({ model: model === "estimate" ? "" : "estimate" })} selected={model === "estimate"}>
          Estimate builder
        </Chip>
        <Chip href={href({ model: model === "request" ? "" : "request" })} selected={model === "request"}>
          Requests
        </Chip>
        {STATUS_FILTERS.map((s) => (
          <Chip key={s} href={href({ status: status === s ? "" : s })} selected={status === s}>
            {leadStatusLabel(s)}
          </Chip>
        ))}
      </FilterBar>
      <div className="mt-3 overflow-hidden rounded-adm-md border border-adm-line bg-adm-surface">
        <ul role="list" aria-label="Leads" data-lead-list="">
          {bodies.map((body, i) => (
            <LeadPage key={`${body.page}-${body.search}-${body.status}-${body.model}`} body={body} onTotal={i === 0 ? onTotal : undefined} />
          ))}
        </ul>
        {total === 0 && <EmptyState message={search || status || model ? "No leads match" : "No leads yet"} detail={search || status || model ? "Try another name, or clear the filters." : undefined} />}
      </div>
      {total !== null && total > shown && (
        <div className="mt-3 flex items-center justify-between gap-3">
          <p className="text-[13px] text-adm-text-3">
            Showing {shown} of {total}
          </p>
          <Button variant="secondary" onClick={() => setPaging({ key: filterKey, pages: pages + 1 })}>
            Show more
          </Button>
        </div>
      )}
    </div>
  );
}

/** Load a lead by any id form. A bare id is a Request first, then an estimate lead. */
async function loadLeadByRef(raw: string, signal: AbortSignal): Promise<LeadDetail> {
  const ref = parseLeadRef(raw);
  if (!ref) throw Object.assign(new Error("This lead link is not valid."), { response: { status: 404, data: { message: "This lead link is not valid." } } });
  try {
    return await fetchLead(ref.model, ref.id, signal);
  } catch (error) {
    if (ref.bare && errorStatus(error) === 404) return fetchLead("estimate", ref.id, signal);
    throw error;
  }
}

function LeadBody({ lead, onClose }: { lead: LeadDetail; onClose: () => void }) {
  const router = useRouter();
  const toast = useToast();
  const { user } = useAdmin();
  const canProjects = can(user, PERM.PROJECTS_MANAGE);
  const [status, setStatus] = useState(lead.status);
  const [statusError, setStatusError] = useState("");
  const [savingStatus, setSavingStatus] = useState(false);
  const [converting, setConverting] = useState(false);
  const [address, setAddress] = useState(lead.address);
  const [projectType, setProjectType] = useState("");
  const [deleting, setDeleting] = useState(false);

  useEffect(() => setStatus(lead.status), [lead.status]);
  const statuses = lead.allowedActions.statuses.includes(lead.status) ? lead.allowedActions.statuses : [lead.status, ...lead.allowedActions.statuses];

  const saveStatus = async () => {
    if (status === lead.status || savingStatus) return;
    setSavingStatus(true);
    setStatusError("");
    try {
      await setLeadStatus(lead.legacyId, status);
      toast.show(`Lead marked ${leadStatusLabel(status)}`);
      invalidateQueries("leads");
    } catch (e) {
      setStatusError(errorCode(e) === "STATUS_FOLLOWS_VISIT" ? "This lead's status follows its visit. Open the visit to confirm or decline it." : errorMessage(e, "The status could not be changed."));
      setStatus(lead.status);
    } finally {
      setSavingStatus(false);
    }
  };

  const range = estimateRange(lead.estimateLow, lead.estimateHigh);

  return (
    <div className="flex flex-col gap-4" data-lead-detail={lead.key}>
      <div className="flex flex-wrap items-center gap-1.5">
        <StatusBadge tone={statusTone(lead.status)}>{leadStatusLabel(lead.status)}</StatusBadge>
        <StatusBadge tone="info">{lead.model === "estimate" ? "Estimate builder" : "Request"}</StatusBadge>
        {lead.serviceLabel && <span className="text-[13px] text-adm-text-2">{lead.serviceLabel}</span>}
        <span className="text-[13px] text-adm-text-3">· {formatDay(lead.createdAt)}</span>
      </div>
      {lead.address && <p className="break-words text-[14px] text-adm-ink">{lead.address}</p>}
      <ContactActions phone={lead.phone} email={lead.email} address={lead.address} canText={false} />

      <div className="flex flex-wrap gap-2">
        {lead.projectId && (
          <ButtonLink href={`/admin/projects/${encodeURIComponent(lead.projectId)}`} data-action="open-project">
            Open the project
          </ButtonLink>
        )}
        {!lead.projectId && lead.allowedActions.convertToProject && canProjects && (
          <Button onClick={() => setConverting(true)} data-action="create-project">
            Create project
          </Button>
        )}
        {lead.bookingId && (
          <ButtonLink variant="secondary" href={`/admin/jobs/${encodeURIComponent(lead.bookingId)}`} data-action="open-visit">
            Open the visit
          </ButtonLink>
        )}
      </div>

      <section className="rounded-adm-md border border-adm-line bg-adm-surface p-4">
        <h3 className="text-[15px] font-semibold text-adm-ink">Status</h3>
        {lead.allowedActions.setStatus ? (
          <div className="mt-2 flex flex-col gap-2 sm:flex-row sm:items-end">
            <Field label="Lead status" className="flex-1">
              <Select value={status} onChange={(e) => setStatus(e.target.value)} options={statuses.map((s) => ({ value: s, label: leadStatusLabel(s) }))} />
            </Field>
            <Button onClick={saveStatus} busy={savingStatus} disabled={status === lead.status} data-action="save-lead-status">
              Save status
            </Button>
          </div>
        ) : (
          <p className="mt-1 text-[14px] text-adm-text-2" data-status-locked="">
            This lead&apos;s status follows its visit. Open the visit to confirm or decline it.
          </p>
        )}
        {statusError && (
          <p role="alert" className="mt-2 rounded-adm-sm bg-adm-problem-bg px-3 py-2 text-[14px] text-adm-problem">
            {statusError}
          </p>
        )}
      </section>

      <QualificationView
        q={lead.qualification ? { ...lead.qualification, notes: lead.qualification.notes || lead.message } : { notes: lead.message, contactPref: lead.contactPref, bestTime: lead.bestTime }}
        title={lead.model === "estimate" ? "Their answers" : "Their request"}
      />
      {range && !lead.qualification && <p className="text-[14px] text-adm-text-2">Price range shown: {range}</p>}

      {lead.allowedActions.delete && (
        <div className="border-t border-adm-line pt-3">
          <Button variant="destructive" onClick={() => setDeleting(true)} data-action="delete-lead">
            Delete lead
          </Button>
        </div>
      )}

      <ConfirmSheet
        open={converting}
        onClose={() => setConverting(false)}
        title="Create a project from this lead?"
        consequence={`A project is created for ${lead.name || "this customer"} with their contact details and every answer above. If one was already created from this lead, it opens instead.`}
        confirmLabel="Create project"
        onConfirm={async () => {
          const result = await convertLeadToProject(lead.model, lead.id, {
            address: address.trim() || undefined,
            projectType: projectType || undefined,
          });
          invalidateQueries("leads");
          invalidateQueries("projects");
          toast.show(result.created ? `Project ${result.project.projectNumber} created` : `This lead is already project ${result.project.projectNumber}`);
          router.push(`/admin/projects/${encodeURIComponent(result.project.id)}`);
        }}
        errorText={(e) =>
          errorCode(e) === "NOT_A_PROJECT_LEAD"
            ? "This kind of request is not a renovation lead and cannot become a project."
            : errorCode(e) === "ADDRESS_REQUIRED"
              ? "Add the property address to create the project."
              : errorMessage(e)
        }
      >
        <div className="flex flex-col gap-3">
          <Field label="Property address" required={!lead.address}>
            <TextInput value={address} onChange={(e) => setAddress(e.target.value)} autoComplete="street-address" />
          </Field>
          <Field label="Project type" help="Left blank, it follows the service they asked about.">
            <Select value={projectType} onChange={(e) => setProjectType(e.target.value)} options={[{ value: "", label: "From the service" }, ...PROJECT_TYPES.map((t) => ({ value: t, label: t }))]} />
          </Field>
        </div>
      </ConfirmSheet>

      <ConfirmSheet
        open={deleting}
        onClose={() => setDeleting(false)}
        title="Delete this lead?"
        consequence={`${lead.name || "This lead"} and their answers are deleted. This cannot be undone.${lead.projectId ? " The project created from it stays." : ""}`}
        confirmLabel="Delete lead"
        tone="danger"
        typedConfirmation={(lead.name || "").trim()}
        typedLabel={
          <>
            Type the lead&apos;s name <span className="font-mono">{(lead.name || "").trim()}</span> to confirm
          </>
        }
        onConfirm={async () => {
          await deleteLead(lead.legacyId, (lead.name || "").trim());
          invalidateQueries("leads");
          toast.show("Lead deleted");
          onClose();
        }}
      />
    </div>
  );
}

/** /admin/leads/[id]: one lead in a sheet over the list (id: "estimate-<id>", "request-<id>", "estimate:<id>" or a bare id). */
export function LeadDetailSheet({ id }: { id: string }) {
  const router = useRouter();
  const ref = parseLeadRef(id);
  const key = ref ? leadKeys.detail(ref.model, ref.id) : leadKeys.detail("invalid", id);
  const q = useAdminQuery(key, (signal) => loadLeadByRef(id, signal), { staleTime: 15_000 });
  const close = () => router.replace("/admin/leads", { scroll: false });
  const lead = q.data;
  return (
    <Sheet open onClose={close} title={lead?.name || "Lead"} size="full" data-sheet="lead">
      {q.isLoading ? (
        <SkeletonRows count={2} leading={false} label="Loading the lead" />
      ) : q.error && !lead ? (
        errorStatus(q.error) === 404 || errorStatus(q.error) === 400 ? (
          <EmptyState message="This lead was not found" detail="It may have been deleted, or the link is out of date." />
        ) : (
          <ErrorState title="The lead could not be loaded" message={errorMessage(q.error)} onRetry={q.refetch} />
        )
      ) : lead ? (
        <LeadBody lead={lead} onClose={close} />
      ) : null}
    </Sheet>
  );
}
