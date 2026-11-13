"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { can, PERM } from "@/lib/admin-access";
import { getProjectCustomer } from "@/lib/admin-service";
import { fetchAssignees, keys } from "@/lib/admin/fetchers";
import { errorCode, errorMessage, invalidateQueries, useAdminQuery } from "@/lib/admin/query";
import {
  dateInputValue,
  dayToIso,
  formatDay,
  linkProjectBooking,
  projectKeys,
  saveProjectSchedule,
  searchJobs,
  unlinkProjectBooking,
  type JobSearchRow,
  type LinkedBooking,
  type ProjectOverview,
} from "@/lib/admin/projects";
import CreateVisitSheet from "@/app/components/admin/tools/CreateVisitSheet";
import { useAdmin } from "@/app/components/admin/shell/AdminContext";
import { Button, Card, ConfirmSheet, EmptyState, Field, SearchField, Sheet, StatusBadge, TextInput, bookingStatusTone, useToast } from "@/app/components/admin/ui";

type VisitCustomer = NonNullable<Parameters<typeof CreateVisitSheet>[0]["presetCustomer"]>;

function VisitRow({ booking, onUnlink, canEdit }: { booking: LinkedBooking; onUnlink: () => void; canEdit: boolean }) {
  const tone = bookingStatusTone(booking.status);
  return (
    <li className="flex flex-col gap-2 border-b border-adm-line px-4 py-3 last:border-b-0 sm:flex-row sm:items-center sm:justify-between" data-linked-booking={booking.id}>
      <Link href={`/admin/jobs/${encodeURIComponent(booking.id)}`} className="min-w-0 flex-1 hover:underline">
        <p className="text-[15px] font-semibold text-adm-ink">
          {booking.bookingNumber ? `Visit ${String(booking.bookingNumber).replace(/^#?/, "#")}` : "Visit"} · {formatDay(booking.date) || "No date"}
        </p>
        <p className="truncate text-[13px] text-adm-text-2">{booking.service || "Visit"}</p>
      </Link>
      <div className="flex flex-wrap items-center gap-2">
        {booking.isSiteVisit && <StatusBadge tone="info">Site visit</StatusBadge>}
        <StatusBadge tone={tone.tone}>{tone.label}</StatusBadge>
        {canEdit && (
          <Button variant="tertiary" onClick={onUnlink} data-action="unlink-visit">
            Unlink
          </Button>
        )}
      </div>
    </li>
  );
}

/** Pick an existing visit: server search by name, phone or address, prefilled with the project's customer. */
function LinkVisitSheet({ open, onClose, overview, onLinked }: { open: boolean; onClose: () => void; overview: ProjectOverview; onLinked: () => void }) {
  const toast = useToast();
  const [q, setQ] = useState(overview.project.customerName || overview.project.phone || "");
  const [rows, setRows] = useState<JobSearchRow[] | null>(null);
  const [error, setError] = useState("");
  const [siteVisit, setSiteVisit] = useState(!overview.linkedBookings.some((b) => b.isSiteVisit));
  const [linking, setLinking] = useState("");
  const linked = useMemo(() => new Set(overview.linkedBookings.map((b) => b.id)), [overview.linkedBookings]);

  useEffect(() => {
    if (!open) return;
    const text = q.trim();
    if (text.length < 2) {
      setRows(null);
      return;
    }
    const controller = new AbortController();
    const t = window.setTimeout(() => {
      setError("");
      searchJobs(text, controller.signal)
        .then(setRows)
        .catch((e) => {
          if (!controller.signal.aborted) setError(errorMessage(e, "Visits could not be searched."));
        });
    }, 300);
    return () => {
      controller.abort();
      window.clearTimeout(t);
    };
  }, [q, open]);

  const link = async (row: JobSearchRow) => {
    if (linking) return;
    setLinking(row.id);
    setError("");
    try {
      await linkProjectBooking(overview.project.id, row.id, siteVisit);
      toast.show(`Visit #${String(row.bookingNumber).replace(/^#/, "")} linked`);
      onLinked();
      onClose();
    } catch (e) {
      setError(errorCode(e) === "BOOKING_LINKED_ELSEWHERE" ? "That visit is already linked to another project." : errorMessage(e, "The visit could not be linked."));
    } finally {
      setLinking("");
    }
  };

  return (
    <Sheet open={open} onClose={onClose} title="Link an existing visit" size="full" busy={Boolean(linking)} data-sheet="link-visit">
      <SearchField label="Search visits" value={q} onChange={setQ} placeholder="Customer name, phone, address or visit number" />
      <label className="mt-3 flex min-h-[44px] items-center gap-3 text-[14px] text-adm-ink">
        <input type="checkbox" className="h-5 w-5" checked={siteVisit} onChange={(e) => setSiteVisit(e.target.checked)} />
        This is the project&apos;s site visit
      </label>
      {error && (
        <p role="alert" className="mt-3 rounded-adm-sm bg-adm-problem-bg px-3 py-2 text-[14px] text-adm-problem">
          {error}
        </p>
      )}
      {rows && rows.length === 0 && <EmptyState message="No visits match" detail="Try the phone number or the street." />}
      {rows && rows.length > 0 && (
        <ul role="list" className="mt-3 overflow-hidden rounded-adm-md border border-adm-line bg-adm-surface">
          {rows.map((row) => {
            const tone = bookingStatusTone(row.status);
            const already = linked.has(row.id);
            return (
              <li key={row.id} className="flex flex-col gap-2 border-b border-adm-line px-4 py-3 last:border-b-0 sm:flex-row sm:items-center sm:justify-between" data-job-result={row.id}>
                <div className="min-w-0">
                  <p className="text-[15px] font-semibold text-adm-ink">
                    #{String(row.bookingNumber).replace(/^#/, "")} · {formatDay(row.date) || "No date"}
                  </p>
                  <p className="adm-clamp-2 text-[13px] leading-[18px] text-adm-text-2">{[row.customer?.name, row.addressShort, row.town].filter(Boolean).join(" · ")}</p>
                </div>
                <div className="flex items-center gap-2">
                  <StatusBadge tone={tone.tone}>{tone.label}</StatusBadge>
                  <Button variant="secondary" disabled={already} busy={linking === row.id} onClick={() => link(row)}>
                    {already ? "Linked" : "Link"}
                  </Button>
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </Sheet>
  );
}

function ScheduleCard({ overview, canEdit }: { overview: ProjectOverview; canEdit: boolean }) {
  const toast = useToast();
  const { user } = useAdmin();
  const canSeeCrew = can(user, PERM.BOOKINGS_ASSIGN) || can(user, PERM.SCHEDULE_READ);
  const assigneesQ = useAdminQuery(keys.assignees, fetchAssignees, { enabled: canSeeCrew, staleTime: 5 * 60_000 });
  const p = overview.project;
  const [start, setStart] = useState(dateInputValue(p.scheduledStart));
  const [end, setEnd] = useState(dateInputValue(p.scheduledEnd));
  const [crew, setCrew] = useState<string[]>(p.assignedFixterIds);
  const [error, setError] = useState("");

  const dirty = start !== dateInputValue(p.scheduledStart) || end !== dateInputValue(p.scheduledEnd) || [...crew].sort().join() !== [...p.assignedFixterIds].sort().join();
  const assignees = assigneesQ.data || [];
  const known = new Set(assignees.map((a) => a.id));
  const unknownCrew = crew.filter((id) => !known.has(id));

  const save = async () => {
    setError("");
    if (start && end && end < start) {
      setError("The end date is before the start date.");
      return;
    }
    try {
      await saveProjectSchedule(p.id, {
        scheduledStart: start ? dayToIso(start) : null,
        scheduledEnd: end ? dayToIso(end) : null,
        ...(canSeeCrew ? { assignedFixterIds: crew } : {}),
        expectedUpdatedAt: p.updatedAt,
      });
      toast.show("Schedule saved");
      invalidateQueries(projectKeys.overview(p.id));
      invalidateQueries(["projects", "search"]);
    } catch (e) {
      if (errorCode(e) === "STALE") {
        setError("Someone changed this project since you opened it. The latest version is loaded; check it and save again.");
        invalidateQueries(projectKeys.overview(p.id));
      } else setError(errorMessage(e, "The schedule could not be saved."));
    }
  };

  return (
    <Card title="Schedule and crew">
      <div className="grid gap-3 sm:grid-cols-2">
        <Field label="Work starts">
          <TextInput type="date" value={start} onChange={(e) => setStart(e.target.value)} disabled={!canEdit} />
        </Field>
        <Field label="Work ends">
          <TextInput type="date" value={end} min={start || undefined} onChange={(e) => setEnd(e.target.value)} disabled={!canEdit} />
        </Field>
      </div>
      {canSeeCrew && (
        <fieldset className="mt-4">
          <legend className="text-[13px] font-semibold text-adm-ink">Crew</legend>
          {assigneesQ.isLoading ? (
            <p className="mt-2 text-[13px] text-adm-text-3">Loading the team…</p>
          ) : assignees.length === 0 ? (
            <p className="mt-2 text-[13px] text-adm-text-3">No team members to assign.</p>
          ) : (
            <ul role="list" className="mt-2 grid gap-1 sm:grid-cols-2">
              {assignees.map((a) => (
                <li key={a.id}>
                  <label className="flex min-h-[44px] items-center gap-3 text-[14px] text-adm-ink">
                    <input
                      type="checkbox"
                      className="h-5 w-5"
                      disabled={!canEdit}
                      checked={crew.includes(a.id)}
                      onChange={(e) => setCrew((c) => (e.target.checked ? [...c, a.id] : c.filter((x) => x !== a.id)))}
                    />
                    {a.name}
                  </label>
                </li>
              ))}
            </ul>
          )}
          {unknownCrew.length > 0 && <p className="mt-1 text-[13px] text-adm-text-3">{unknownCrew.length} assigned person is no longer on the active team.</p>}
        </fieldset>
      )}
      {error && (
        <p role="alert" className="mt-3 rounded-adm-sm bg-adm-problem-bg px-3 py-2 text-[14px] text-adm-problem">
          {error}
        </p>
      )}
      {canEdit && (
        <div className="mt-4 flex justify-end">
          <Button onClick={save} disabled={!dirty} data-action="save-schedule">
            Save schedule
          </Button>
        </div>
      )}
    </Card>
  );
}

/**
 * Visits tab: the schedule and crew, and the visits linked to the project
 * (the site visit and later work days). "Schedule site visit" opens the
 * normal New visit flow prefilled with the project's customer, and links
 * the visit it creates; an existing visit can be linked instead.
 */
export function ProjectVisits({ overview }: { overview: ProjectOverview }) {
  const toast = useToast();
  const { user } = useAdmin();
  const canEdit = overview.allowedActions.linkBooking;
  const canCreateVisit = can(user, PERM.BOOKINGS_WRITE) && can(user, PERM.BOOKINGS_ASSIGN);
  const canSearchVisits = can(user, PERM.BOOKINGS_READ);
  const [creating, setCreating] = useState(false);
  const [presetCustomer, setPresetCustomer] = useState<VisitCustomer | null>(null);
  const [preparing, setPreparing] = useState(false);
  const [linkingOpen, setLinkingOpen] = useState(false);
  const [unlinking, setUnlinking] = useState<LinkedBooking | null>(null);
  const [linkError, setLinkError] = useState("");
  const p = overview.project;
  const refresh = () => {
    invalidateQueries(projectKeys.overview(p.id));
  };

  const startSiteVisit = async () => {
    setPreparing(true);
    setPresetCustomer(null);
    try {
      if (p.customerId) {
        const customer = await getProjectCustomer(p.customerId, null);
        setPresetCustomer({
          _id: customer.customerId,
          userId: customer.userId,
          name: customer.name,
          email: customer.email,
          phone: customer.phone,
          addresses: customer.addresses.map((a) => ({ _id: a._id || a.id, label: a.label, line1: a.line1, city: a.city, state: a.state, zip: a.zip, county: a.county })),
        });
      }
    } catch {
      /* the visit flow still opens; the customer is chosen there */
    } finally {
      setPreparing(false);
      setCreating(true);
    }
  };

  const siteVisitLinked = overview.linkedBookings.some((b) => b.isSiteVisit);

  return (
    <div className="flex flex-col gap-4" data-tab-panel="visits">
      {/* Remounted when the project changes on the server, so the fields show the saved values. */}
      <ScheduleCard key={`${p.scheduledStart}|${p.scheduledEnd}|${p.assignedFixterIds.join(",")}`} overview={overview} canEdit={overview.allowedActions.edit} />

      <section className="flex flex-col gap-2">
        <div className="flex flex-wrap items-center justify-between gap-2 px-1">
          <h2 className="text-[15px] font-semibold text-adm-ink">
            Visits <span className="adm-num font-normal text-adm-text-3">· {overview.linkedBookings.length}</span>
          </h2>
          {canEdit && (
            <div className="flex flex-wrap gap-2">
              {canSearchVisits && (
                <Button variant="secondary" onClick={() => setLinkingOpen(true)} data-action="link-visit">
                  Link existing visit
                </Button>
              )}
              {canCreateVisit && (
                <Button busy={preparing} onClick={startSiteVisit} data-action="schedule-site-visit">
                  {siteVisitLinked ? "Schedule a visit" : "Schedule site visit"}
                </Button>
              )}
            </div>
          )}
        </div>
        {linkError && (
          <p role="alert" className="rounded-adm-sm bg-adm-problem-bg px-3 py-2 text-[14px] text-adm-problem">
            {linkError}
          </p>
        )}
        <div className="overflow-hidden rounded-adm-md border border-adm-line bg-adm-surface">
          {overview.linkedBookings.length === 0 ? (
            <EmptyState message="No visits linked" detail="Schedule the site visit here, or link a visit that is already booked." />
          ) : (
            <ul role="list">
              {overview.linkedBookings.map((b) => (
                <VisitRow key={b.id} booking={b} canEdit={canEdit} onUnlink={() => setUnlinking(b)} />
              ))}
            </ul>
          )}
        </div>
      </section>

      {linkingOpen && <LinkVisitSheet open onClose={() => setLinkingOpen(false)} overview={overview} onLinked={refresh} />}

      <ConfirmSheet
        open={Boolean(unlinking)}
        onClose={() => setUnlinking(null)}
        title="Unlink this visit?"
        consequence={
          unlinking
            ? `Visit #${String(unlinking.bookingNumber).replace(/^#/, "")} stays booked exactly as it is; it is only removed from project ${p.projectNumber}.`
            : ""
        }
        confirmLabel="Unlink visit"
        onConfirm={async () => {
          if (!unlinking) return;
          await unlinkProjectBooking(p.id, unlinking.id);
          toast.show("Visit unlinked");
          refresh();
        }}
      />

      {creating && (
        <CreateVisitSheet
          presetCustomer={presetCustomer}
          presetTask={`${siteVisitLinked ? "Visit" : "Site visit"} for project ${p.projectNumber}`}
          presetGuest={presetCustomer ? undefined : { name: p.customerName, phone: p.phone, email: p.email }}
          onBookingCreated={async (booking) => {
            try {
              await linkProjectBooking(p.id, booking._id, !siteVisitLinked);
              setLinkError("");
            } catch (e) {
              setLinkError(`Visit #${String(booking.bookingNumber).replace(/^#/, "")} was booked but could not be linked: ${errorMessage(e)} Use "Link existing visit".`);
            } finally {
              refresh();
              invalidateQueries("bookings");
            }
          }}
          onClose={() => setCreating(false)}
          onCreated={(note) => {
            setCreating(false);
            toast.show(note);
          }}
        />
      )}
    </div>
  );
}
