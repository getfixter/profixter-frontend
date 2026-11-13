"use client";

import { useRouter } from "next/navigation";
import { useMemo, useState } from "react";
import FreeVisitReviewPanel from "@/app/components/admin/FreeVisitReviewPanel";
import RequestsTable from "@/app/components/admin/RequestsTable";
import { deleteRequestLead, updateRequestStatus, type RequestLead, type RequestLeadStatus } from "@/lib/admin-service";
import { fetchLeads, keys } from "@/lib/admin/fetchers";
import { errorMessage, invalidateQueries, setQueryData, useAdminQuery } from "@/lib/admin/query";
import { leadMatches, normalizeQuery } from "@/lib/admin/search";
import { useHandoffQuery } from "@/lib/admin/useHandoffQuery";
import { EmptyState, ErrorState, PageHeader, SearchField, Sheet, SkeletonRows, useToast } from "@/app/components/admin/ui";

function useLeadActions() {
  const toast = useToast();
  const onUpdateStatus = async (id: string, status: RequestLeadStatus) => {
    try {
      const saved = await updateRequestStatus(id, status);
      setQueryData<RequestLead[]>(keys.leads, (list = []) => list.map((l) => (l._id === id ? { ...l, ...(saved || {}), status } : l)));
    } catch (error) {
      toast.show(errorMessage(error, "Failed to update request status"));
    }
  };
  const onDeleteLead = async (lead: RequestLead, confirmation: string) => {
    await deleteRequestLead(lead._id, confirmation);
    setQueryData<RequestLead[]>(keys.leads, (list = []) => list.filter((l) => l._id !== lead._id));
    toast.show("Lead deleted");
  };
  return { onUpdateStatus, onDeleteLead, notify: toast.show };
}

/**
 * Leads: the existing request list with its status, delete and free-visit
 * review, inside the shell (until the Projects/Leads redesign). Search is
 * local and never in the URL.
 */
export function LeadsBoard() {
  const leadsQ = useAdminQuery(keys.leads, fetchLeads, { pollMs: 120_000 });
  const { onUpdateStatus, onDeleteLead, notify } = useLeadActions();
  const [q, setQ] = useState("");
  const [reviewId, setReviewId] = useState<string | null>(null);
  useHandoffQuery("leads", setQ);
  const shown = useMemo(() => (leadsQ.data || []).filter((l) => leadMatches(l, normalizeQuery(q))), [leadsQ.data, q]);

  return (
    <div data-section="leads">
      <PageHeader title="Leads" description="Estimate and service requests" />
      <SearchField label="Search leads" value={q} onChange={setQ} className="mb-3" />
      {leadsQ.isLoading ? (
        <SkeletonRows count={5} label="Loading leads" />
      ) : leadsQ.error && !leadsQ.data ? (
        <ErrorState title="Leads could not be loaded" message={errorMessage(leadsQ.error)} onRetry={leadsQ.refetch} />
      ) : (
        <RequestsTable requests={shown} onUpdateStatus={onUpdateStatus} onDeleteLead={onDeleteLead} onReviewFreeVisit={setReviewId} />
      )}
      {reviewId && (
        <FreeVisitReviewPanel
          bookingId={reviewId}
          onClose={() => {
            setReviewId(null);
            invalidateQueries("leads");
            invalidateQueries("bookings");
          }}
          onChanged={(message) => notify(message)}
        />
      )}
    </div>
  );
}

/** /admin/leads/[id]: one lead in a sheet over the list. */
export function LeadDetailSheet({ id }: { id: string }) {
  const router = useRouter();
  const leadsQ = useAdminQuery(keys.leads, fetchLeads);
  const { onUpdateStatus, onDeleteLead, notify } = useLeadActions();
  const [reviewId, setReviewId] = useState<string | null>(null);
  const lead = (leadsQ.data || []).find((l) => l._id === id);
  return (
    <>
      <Sheet open={!reviewId} onClose={() => router.replace("/admin/leads", { scroll: false })} title={lead?.name || "Lead"} size="full" data-sheet="lead">
        {leadsQ.isLoading ? (
          <SkeletonRows count={1} label="Loading the lead" />
        ) : leadsQ.error && !leadsQ.data ? (
          <ErrorState title="The lead could not be loaded" message={errorMessage(leadsQ.error)} onRetry={leadsQ.refetch} />
        ) : !lead ? (
          <EmptyState message="This lead was not found" detail="It may have been deleted, or the link is out of date." />
        ) : (
          <RequestsTable
            requests={[lead]}
            onUpdateStatus={onUpdateStatus}
            onDeleteLead={async (l, confirmation) => {
              await onDeleteLead(l, confirmation);
              router.replace("/admin/leads", { scroll: false });
            }}
            onReviewFreeVisit={setReviewId}
          />
        )}
      </Sheet>
      {reviewId && (
        <FreeVisitReviewPanel
          bookingId={reviewId}
          onClose={() => {
            setReviewId(null);
            invalidateQueries("leads");
          }}
          onChanged={(message) => notify(message)}
        />
      )}
    </>
  );
}
