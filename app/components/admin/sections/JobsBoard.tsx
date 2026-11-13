"use client";

import { ArrowPathIcon, CalendarDaysIcon, ExclamationTriangleIcon, PlusIcon } from "@heroicons/react/24/outline";
import { useRouter, useSearchParams } from "next/navigation";
import { useCallback, useMemo, useState } from "react";
import BookingsCalendar from "@/app/components/admin/BookingsCalendar";
import BookingsTable from "@/app/components/admin/BookingsTable";
import FreeVisitReviewPanel from "@/app/components/admin/FreeVisitReviewPanel";
import CreateVisitSheet from "@/app/components/admin/tools/CreateVisitSheet";
import { can, PERM } from "@/lib/admin-access";
import { toYMDNY } from "@/lib/utils/timezone-helpers";
import { fetchAssignees, fetchBookings, fetchCustomers, fetchMembers, keys, type BookingScope } from "@/lib/admin/fetchers";
import { errorMessage, invalidateQueries, useAdminQuery } from "@/lib/admin/query";
import { isFieldFixter } from "@/lib/admin/sections";
import { bookingMatches, isUnassignedActive, normalizeQuery, todayNY } from "@/lib/admin/search";
import { useHandoffQuery } from "@/lib/admin/useHandoffQuery";
import { Button, Chip, ErrorState, FilterBar, IconButton, PageHeader, SearchField, Select, SkeletonRows } from "@/app/components/admin/ui";
import { useAdmin } from "@/app/components/admin/shell/AdminContext";
import { useBookingActions } from "./useBookingActions";

type View = "today" | "pending" | "unassigned" | "upcoming" | "confirmed" | "completed" | "day" | "all";
const VIEWS: View[] = ["today", "pending", "unassigned", "upcoming", "confirmed", "completed", "day", "all"];
const STATUS_OPTIONS = [
  { value: "", label: "All statuses" },
  { value: "pending", label: "Pending" },
  { value: "pending confirmation", label: "Pending confirmation" },
  { value: "confirmed", label: "Confirmed" },
  { value: "completed", label: "Completed" },
  { value: "canceled", label: "Canceled" },
];

/**
 * Jobs, as it works today, inside the new shell (temporary until the Jobs
 * track's redesign, F.1). Everything the old Jobs tab could do is here: the
 * scope (assigned to me / all), quick views, the calendar, status filter,
 * search, + Visit, free-visit review, and every action on the job cards.
 *
 * What changed: the view, date, status and scope live in the URL
 * (router.replace, no history entry per chip), the list loads only bookings
 * (customers load only when + Visit opens), saves update the cached list
 * instead of reloading the screen, and search mode hides the chips.
 */
export function JobsBoard() {
  const { user } = useAdmin();
  const router = useRouter();
  const params = useSearchParams();
  const field = isFieldFixter(user);
  const today = todayNY();

  const view: View = VIEWS.includes(params.get("view") as View) ? (params.get("view") as View) : "today";
  const date = /^\d{4}-\d{2}-\d{2}$/.test(params.get("date") || "") ? (params.get("date") as string) : today;
  const status = STATUS_OPTIONS.some((o) => o.value === params.get("status")) ? (params.get("status") as string) : "";
  const scope: BookingScope = field || params.get("scope") === "me" ? "me" : "all";

  const setParams = useCallback(
    (next: Record<string, string | null>) => {
      const sp = new URLSearchParams(params.toString());
      for (const [k, v] of Object.entries(next)) {
        if (v === null || v === "") sp.delete(k);
        else sp.set(k, v);
      }
      const qs = sp.toString();
      router.replace(qs ? `/admin/jobs?${qs}` : "/admin/jobs", { scroll: false });
    },
    [params, router]
  );

  const canAssign = can(user, PERM.BOOKINGS_ASSIGN);
  const canWrite = can(user, PERM.BOOKINGS_WRITE);
  const canCustomers = can(user, PERM.CUSTOMERS_MANAGE);
  const canMembers = can(user, PERM.MEMBERS_READ);

  const bookingsQ = useAdminQuery(keys.bookings(scope), (signal) => fetchBookings(scope, signal), { pollMs: 120_000 });
  const assigneesQ = useAdminQuery(keys.assignees, fetchAssignees, { enabled: canAssign, staleTime: 5 * 60_000 });
  const { updateStatus, updateBooking, notify } = useBookingActions();

  const [q, setQ] = useState("");
  const [searching, setSearching] = useState(false);
  const [showCalendar, setShowCalendar] = useState(false);
  const [showFilters, setShowFilters] = useState(Boolean(status));
  const [reviewId, setReviewId] = useState<string | null>(null);
  const [creating, setCreating] = useState(false);
  useHandoffQuery("jobs", setQ);

  // Customers only for + Visit's customer picker, and only once it opens.
  const customersQ = useAdminQuery(canCustomers ? keys.customers : keys.members, canCustomers ? fetchCustomers : fetchMembers, {
    enabled: creating && (canCustomers || canMembers),
    staleTime: 5 * 60_000,
  });

  const bookings = useMemo(() => bookingsQ.data || [], [bookingsQ.data]);
  const counts = useMemo(() => {
    const live = (b: (typeof bookings)[number]) => !["completed", "canceled", "cancelled"].includes(String(b.status || "").toLowerCase());
    const st = (b: (typeof bookings)[number]) => String(b.status || "").toLowerCase();
    return {
      pending: bookings.filter((b) => ["pending", "pending confirmation"].includes(st(b))).length,
      confirmed: bookings.filter((b) => st(b) === "confirmed").length,
      completed: bookings.filter((b) => st(b) === "completed").length,
      upcoming: bookings.filter((b) => toYMDNY(new Date(b.date)) >= today && live(b)).length,
      unassigned: bookings.filter(isUnassignedActive).length,
    };
  }, [bookings, today]);

  const visible = useMemo(() => {
    const n = normalizeQuery(q);
    let list = bookings;
    if (n.q) list = list.filter((b) => bookingMatches(b, n));
    const st = (b: (typeof bookings)[number]) => String(b.status || "").toLowerCase();
    if (view === "unassigned") list = list.filter(isUnassignedActive);
    if (view === "upcoming") list = list.filter((b) => toYMDNY(new Date(b.date)) >= today && !["completed", "canceled", "cancelled"].includes(st(b)));
    if (view === "pending") list = list.filter((b) => st(b) === "pending" || st(b) === "pending confirmation");
    if (view === "confirmed") list = list.filter((b) => st(b) === "confirmed");
    if (view === "completed") list = list.filter((b) => st(b) === "completed");
    if (status) list = list.filter((b) => st(b) === status || (status === "pending" && st(b) === "pending confirmation"));
    if (view === "today") list = list.filter((b) => toYMDNY(new Date(b.date)) === today);
    if (view === "day") list = list.filter((b) => toYMDNY(new Date(b.date)) === date);
    return [...list].sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());
  }, [bookings, q, view, status, today, date]);

  const chip = (v: View, label: string, count?: number, attention = false) => (
    <Chip onClick={() => setParams({ view: v === "today" ? null : v, date: null })} selected={view === v} count={count} tone={attention ? "attention" : "default"}>
      {label}
    </Chip>
  );

  return (
    <div data-section="jobs">
      <PageHeader
        title="Jobs"
        actions={
          <>
            <IconButton label="Refresh" icon={<ArrowPathIcon />} onClick={() => void bookingsQ.refetch()} />
            {canWrite && !field && (
              <Button icon={<PlusIcon className="h-5 w-5" aria-hidden="true" />} onClick={() => setCreating(true)} data-action="open-create-visit-jobs">
                Visit
              </Button>
            )}
          </>
        }
      />

      <SearchField
        label="Search jobs"
        placeholder="Search name, phone, email, address, zip, booking #"
        value={q}
        onChange={setQ}
        onSearchModeChange={setSearching}
        className="mb-1"
      />

      {!searching && (
        <FilterBar label="Job views">
          {!field && (
            <div className="flex flex-none rounded-full border border-adm-line-2 bg-adm-surface p-0.5" role="group" aria-label="Whose jobs">
              {(["me", "all"] as const).map((s) => (
                <button
                  key={s}
                  type="button"
                  aria-pressed={scope === s}
                  onClick={() => setParams({ scope: s === "me" ? "me" : null })}
                  className={`h-[34px] rounded-full px-3 text-[13px] font-semibold ${scope === s ? "bg-adm-ink text-white" : "text-adm-text-2"}`}
                >
                  {s === "me" ? "Mine" : "All"}
                </button>
              ))}
            </div>
          )}
          <Chip onClick={() => setShowCalendar((v) => !v)} selected={showCalendar} icon={<CalendarDaysIcon className="h-4 w-4" aria-hidden="true" />}>
            {view === "day" ? date : "Calendar"}
          </Chip>
          {chip("today", "Today")}
          {chip("pending", "Pending", counts.pending, true)}
          {counts.unassigned > 0 && (
            <Chip
              onClick={() => setParams({ view: "unassigned", date: null })}
              selected={view === "unassigned"}
              count={counts.unassigned}
              tone="attention"
              icon={<ExclamationTriangleIcon className="h-4 w-4" aria-hidden="true" />}
            >
              Unassigned
            </Chip>
          )}
          {chip("upcoming", "Upcoming", counts.upcoming)}
          {chip("confirmed", "Confirmed", counts.confirmed)}
          {chip("completed", "Completed", counts.completed)}
          {chip("all", "All", bookings.length)}
          <Chip onClick={() => setShowFilters((v) => !v)} selected={showFilters}>
            Filter
          </Chip>
        </FilterBar>
      )}

      {!searching && showFilters && (
        <div className="mb-3 max-w-xs">
          <Select aria-label="Status" value={status} options={STATUS_OPTIONS} onChange={(e) => setParams({ status: e.target.value || null })} />
        </div>
      )}

      {!searching && showCalendar && (
        <div className="mb-4">
          <BookingsCalendar
            bookings={bookings}
            selectedDate={view === "day" ? date : view === "today" ? today : null}
            onChange={(d) => setParams(d ? { view: "day", date: d } : { view: "all", date: null })}
          />
        </div>
      )}

      <div className="mt-2">
        {bookingsQ.isLoading ? (
          <SkeletonRows count={6} label="Loading jobs" />
        ) : bookingsQ.error && !bookingsQ.data ? (
          <ErrorState title="Jobs could not be loaded" message={errorMessage(bookingsQ.error)} onRetry={bookingsQ.refetch} />
        ) : (
          <BookingsTable
            bookings={visible}
            updateStatus={updateStatus}
            onReviewFreeVisit={setReviewId}
            onToast={notify}
            users={customersQ.data || []}
            onUpdateBooking={updateBooking}
            assignees={assigneesQ.data || []}
            canAssign={canAssign}
            emptyMessage={scope === "me" ? "No jobs are assigned to you in this view" : "No jobs in this view"}
          />
        )}
      </div>

      {reviewId && (
        <FreeVisitReviewPanel
          bookingId={reviewId}
          onClose={() => {
            setReviewId(null);
            invalidateQueries("bookings");
          }}
          onChanged={(message) => notify(message)}
        />
      )}
      {/* The customer picker needs the list first (it chooses "existing" vs "guest" when it opens). */}
      {creating && (customersQ.data || customersQ.error || !(canCustomers || canMembers)) && (
        <CreateVisitSheet
          customers={customersQ.data || []}
          onClose={() => setCreating(false)}
          onCreated={(note) => {
            setCreating(false);
            notify(note);
            invalidateQueries("bookings");
          }}
        />
      )}
    </div>
  );
}
