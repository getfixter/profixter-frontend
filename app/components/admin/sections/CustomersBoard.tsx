"use client";

import { ArrowDownTrayIcon, UserPlusIcon } from "@heroicons/react/24/outline";
import { usePathname, useSearchParams } from "next/navigation";
import { useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import CreateCustomerSheet from "@/app/components/admin/tools/CreateCustomerSheet";
import { removeFromBlacklist, type BlacklistEntry } from "@/lib/admin-service";
import { can, PERM } from "@/lib/admin-access";
import { isAdminUser } from "@/lib/auth-routing";
import { fetchBlacklist, keys } from "@/lib/admin/fetchers";
import { errorMessage, getQueryData, invalidateQueries, setQueryData, useAdminQuery } from "@/lib/admin/query";
import { useHandoffQuery } from "@/lib/admin/useHandoffQuery";
import { rememberListHref } from "@/lib/admin/customer-nav";
import { formatAddressLine } from "@/lib/admin/address";
import {
  customerKeys,
  fetchCustomerPage,
  headlineAddress,
  isPlanKey,
  PLAN_KEYS,
  planChip,
  planLabel,
  searchCustomers,
  type CustomerCounts,
  type CustomerFilter,
  type PlanKey,
  type CustomerPage,
  type CustomerRow,
} from "@/lib/admin/customers";
import {
  Button,
  Chip,
  ConfirmSheet,
  EmptyState,
  ErrorState,
  FilterBar,
  ListRow,
  PageHeader,
  SearchField,
  SkeletonRows,
  StatusBadge,
  useToast,
} from "@/app/components/admin/ui";
import { useAdmin } from "@/app/components/admin/shell/AdminContext";

const FILTER_LABEL: Record<CustomerFilter, string> = {
  all: "All",
  members: "Members",
  payment_issue: "Payment issue",
  ending: "Ending",
  blocked: "Blocked",
  archived: "Archived",
};

/* Filters a plan can narrow (the server also accepts it on the others, but there it reads oddly). */
const PLAN_FILTERS: CustomerFilter[] = ["all", "members", "payment_issue", "ending"];

const EMPTY_MESSAGE: Record<CustomerFilter, string> = {
  all: "No customers yet",
  members: "No members",
  payment_issue: "No payment issues",
  ending: "No memberships ending",
  blocked: "Nobody is blocked",
  archived: "No archived customers",
};

/** Debounce for search-as-you-type: fast enough to feel live, slow enough not to send every keystroke. */
const SEARCH_DEBOUNCE_MS = 250;

function useDebounced(value: string, ms: number): string {
  const [out, setOut] = useState(value);
  useEffect(() => {
    const t = window.setTimeout(() => setOut(value), ms);
    return () => window.clearTimeout(t);
  }, [value, ms]);
  return out;
}

/** One compact row: name, plan chip with its state, phone as text, town. No actions (they live in the profile). */
function CustomerListRow({ row }: { row: CustomerRow }) {
  const head = headlineAddress(row.addresses);
  const chip = head ? planChip(head) : null;
  const memberHomes = row.addresses.filter((a) => planChip(a)).length;
  const subtitle = [row.phone, row.town || (head ? head.town : "")].filter(Boolean).join(" · ") || row.email || "No contact details";
  return (
    <ListRow
      href={`/admin/customers/${encodeURIComponent(row.id)}`}
      title={row.name || "Unnamed customer"}
      subtitle={<span className="adm-num">{subtitle}</span>}
      trailing={
        <span className="flex max-w-[52vw] flex-col items-end gap-1 sm:max-w-none" data-row-chips="">
          {row.blocked && <StatusBadge tone="problem">Blocked</StatusBadge>}
          {row.archived && <StatusBadge tone="neutral">Archived</StatusBadge>}
          {chip ? (
            <StatusBadge tone={chip.tone} className="max-w-full [&>span:last-child]:truncate">
              {chip.text}
              {memberHomes > 1 ? ` +${memberHomes - 1}` : ""}
            </StatusBadge>
          ) : !row.blocked && !row.archived ? (
            <span className="text-[12px] text-adm-text-3">No plan</span>
          ) : null}
        </span>
      }
    />
  );
}

function exportCsv(rows: CustomerRow[], filter: CustomerFilter) {
  const headers = ["User ID", "Name", "Email", "Phone", "Addresses", "Membership", "Completed visits", "Blocked", "Archived"];
  const escapeCell = (value: unknown) => `"${String(value ?? "").replace(/"/g, '""')}"`;
  const lines = rows.map((r) =>
    [
      r.userId,
      r.name,
      r.email,
      r.phone,
      r.addresses.map((a) => formatAddressLine(a)).join(" | "),
      r.addresses
        .map((a) => planChip(a)?.text)
        .filter(Boolean)
        .join(" | ") || "No plan",
      r.visitsCompleted,
      r.blocked ? "Yes" : "No",
      r.archived ? "Yes" : "No",
    ]
      .map(escapeCell)
      .join(",")
  );
  const blob = new Blob([[headers.map(escapeCell).join(","), ...lines].join("\n")], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = `customers-${filter}-${new Date().toISOString().slice(0, 10)}.csv`;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}

/**
 * Customers (audit G.1): All · Members · Payment issue · Ending · Blocked
 * (and Archived for the owner), read page by page from the server, compact
 * rows, and server search in search mode. The filter is in the URL; the
 * search text never is (it arrives by hand-off from old ?q= links and the
 * header search, and is sent in a POST body).
 *
 * The list stays mounted (hidden) while a profile is open, so Back returns
 * to the same rows, pages, search and scroll position.
 */
export function CustomersBoard({ hidden = false }: { hidden?: boolean }) {
  const { user } = useAdmin();
  const params = useSearchParams();
  const pathname = usePathname();
  const toast = useToast();
  const owner = isAdminUser(user);
  const canCustomers = can(user, PERM.CUSTOMERS_MANAGE);
  const canMembers = can(user, PERM.MEMBERS_READ);
  const canBlacklist = can(user, PERM.BLACKLIST_MANAGE);
  const canList = canCustomers || canMembers;

  const allowed = useMemo(
    () =>
      (
        [
          canCustomers && "all",
          canList && "members",
          canList && "payment_issue",
          canList && "ending",
          canList && (canBlacklist || canCustomers) && "blocked",
          canList && owner && "archived",
        ] as (CustomerFilter | false)[]
      ).filter(Boolean) as CustomerFilter[],
    [canCustomers, canList, canBlacklist, owner]
  );
  const requested = (params.get("filter") || "").replace("-", "_") as CustomerFilter;
  const urlFilter: CustomerFilter = allowed.includes(requested) ? requested : allowed[0] || "members";
  const rawPlan = params.get("plan");
  const urlPlan: PlanKey | null = PLAN_FILTERS.includes(urlFilter) && isPlanKey(rawPlan) ? rawPlan : null;
  // While a profile is open the URL is /admin/customers/:id (no filter): keep the list's own.
  const [kept, setKept] = useState<{ filter: CustomerFilter; plan: PlanKey | null }>({ filter: urlFilter, plan: urlPlan });
  if (!hidden && (kept.filter !== urlFilter || kept.plan !== urlPlan)) setKept({ filter: urlFilter, plan: urlPlan });
  const filter = hidden ? kept.filter : urlFilter;
  const plan = hidden ? kept.plan : urlPlan;
  const filterHref = (f: CustomerFilter, p: PlanKey | null = PLAN_FILTERS.includes(f) ? plan : null) => {
    const qs = new URLSearchParams();
    if (f !== allowed[0]) qs.set("filter", f);
    if (p && PLAN_FILTERS.includes(f)) qs.set("plan", p);
    const s = qs.toString();
    return `/admin/customers${s ? `?${s}` : ""}`;
  };

  useEffect(() => {
    if (!hidden && pathname === "/admin/customers") rememberListHref(filterHref(filter));
    // eslint-disable-next-line react-hooks/exhaustive-deps -- filterHref derives from allowed, already a dependency through filter
  }, [hidden, pathname, filter, plan]);

  /*
   * The list scrolls back to where it was when the profile closes. The
   * position is tracked while the list is on screen: by the time the profile
   * replaces it, the page is shorter and the browser has already clamped
   * scrollY.
   */
  const savedScroll = useRef<number | null>(null);
  const lastY = useRef(0);
  useEffect(() => {
    if (hidden) return;
    const onScroll = () => {
      lastY.current = window.scrollY;
    };
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, [hidden]);
  useLayoutEffect(() => {
    if (hidden) {
      savedScroll.current = lastY.current;
      // "instant": the site sets smooth scrolling, and the list should simply be where it was.
      window.scrollTo({ top: 0, behavior: "instant" });
    } else if (savedScroll.current !== null) {
      const y = savedScroll.current;
      savedScroll.current = null;
      window.scrollTo({ top: y, behavior: "instant" });
    }
  }, [hidden]);

  /* ------------------------------ list pages ------------------------------ */
  const listKey = customerKeys.list(filter, plan);
  const listQ = useAdminQuery<CustomerPage>(listKey, (signal) => fetchCustomerPage(filter, null, signal, plan), {
    enabled: canList,
    // Extra pages live in the same entry: a background refresh would drop them under the reader.
    refetchOnFocus: false,
    staleTime: 60_000,
  });
  const [loadingMore, setLoadingMore] = useState(false);
  const [moreError, setMoreError] = useState("");
  const loadMore = async () => {
    const cursor = listQ.data?.nextCursor;
    if (!cursor || loadingMore) return;
    setLoadingMore(true);
    setMoreError("");
    try {
      const next = await fetchCustomerPage(filter, cursor, undefined, plan);
      setQueryData<CustomerPage>(listKey, (current) => {
        const seen = new Set((current?.items || []).map((r) => r.id));
        // Totals come with the first page only: keep them.
        return { filter, plan, items: [...(current?.items || []), ...next.items.filter((r) => !seen.has(r.id))], nextCursor: next.nextCursor, counts: current?.counts ?? null };
      });
    } catch (error) {
      setMoreError(errorMessage(error, "More customers could not be loaded."));
    } finally {
      setLoadingMore(false);
    }
  };

  /* -------------------------------- search -------------------------------- */
  const [q, setQ] = useState("");
  const [searching, setSearching] = useState(false);
  useHandoffQuery("customers", setQ);
  const term = useDebounced(q.trim(), SEARCH_DEBOUNCE_MS);
  const searchOn = term.length >= 2;
  const searchQ = useAdminQuery(customerKeys.search(filter === "archived" ? "archived" : "all", term), (signal) => searchCustomers(term, filter, signal), {
    enabled: canList && searchOn,
    refetchOnFocus: false,
    staleTime: 30_000,
  });

  /* ------------------------------ create/export ------------------------------ */
  const [creating, setCreating] = useState(false);

  if (!canList) return <LegacyBlockedList canBlacklist={canBlacklist} />;

  const rows = listQ.data?.items || [];
  /* Per-filter totals from the server (first page). While another filter loads, the last known totals for this plan stay. */
  const counts: CustomerCounts | null =
    listQ.data?.counts ||
    allowed
      .filter((f) => !plan || PLAN_FILTERS.includes(f))
      .map((f) => getQueryData<CustomerPage>(customerKeys.list(f, PLAN_FILTERS.includes(f) ? plan : null))?.counts)
      .find(Boolean) ||
    null;
  const total = counts && typeof counts[filter] === "number" ? (counts[filter] as number) : null;
  const showingSearch = q.trim().length > 0;
  const results = searchQ.data?.items || [];

  return (
    <div data-section="customers" hidden={hidden} data-customers-list="">
      <PageHeader title="Customers" />
      <div className="adm-sticky z-[2] mb-1 bg-adm-bg pb-1">
        <SearchField label="Search customers" placeholder="Name, phone, email, address, ZIP or booking #" value={q} onChange={setQ} onSearchModeChange={setSearching} />
      </div>

      {showingSearch ? (
        <div className="mt-1" data-search-results="" aria-live="polite">
          {!searchOn ? (
            <p className="px-1 py-3 text-[13px] text-adm-text-3">Type at least 2 characters.</p>
          ) : searchQ.isLoading || (searchQ.isFetching && !searchQ.data) ? (
            <SkeletonRows count={3} label="Searching" />
          ) : searchQ.error && !searchQ.data ? (
            <ErrorState title="Search did not work" message={errorMessage(searchQ.error)} onRetry={searchQ.refetch} />
          ) : results.length === 0 ? (
            <EmptyState message="No customers match" detail="Try part of the phone number, the street, the ZIP or a booking number." />
          ) : (
            <ul role="list" className="overflow-hidden rounded-adm-md border border-adm-line bg-adm-surface" aria-label="Search results">
              {results.map((row) => (
                <CustomerListRow key={row.id} row={row} />
              ))}
            </ul>
          )}
          {searchOn && results.length >= 25 && <p className="px-1 py-2 text-[13px] text-adm-text-3">Showing the first 25. Add a word to narrow it down.</p>}
        </div>
      ) : (
        <>
          {!searching && allowed.length > 1 && (
            <FilterBar label="Customer filters">
              {allowed.map((f) => (
                <Chip
                  key={f}
                  href={filterHref(f)}
                  selected={filter === f}
                  tone={f === "payment_issue" ? "attention" : "default"}
                  count={counts && (!plan || PLAN_FILTERS.includes(f)) ? counts[f] : undefined}
                >
                  {FILTER_LABEL[f]}
                </Chip>
              ))}
            </FilterBar>
          )}

          {!searching && PLAN_FILTERS.includes(filter) && (
            <div className="mt-1">
              <FilterBar label="Plan filter" sticky={false}>
                <Chip href={filterHref(filter, null)} selected={!plan}>
                  Any plan
                </Chip>
                {PLAN_KEYS.map((k) => (
                  <Chip key={k} href={filterHref(filter, k)} selected={plan === k}>
                    {planLabel(k)}
                  </Chip>
                ))}
              </FilterBar>
            </div>
          )}

          {!searching && (
            <div className="mt-2 flex flex-wrap items-center justify-between gap-2 px-1">
              <p className="adm-num text-[13px] text-adm-text-2" data-list-count="">
                {listQ.data
                  ? total !== null
                    ? `${total} ${total === 1 ? "customer" : "customers"}${plan ? ` on ${planLabel(plan)}` : ""}${rows.length < total ? ` · showing ${rows.length}` : ""}`
                    : `${rows.length}${listQ.data.nextCursor ? "+" : ""} ${rows.length === 1 ? "customer" : "customers"}`
                  : ""}
              </p>
              <div className="flex gap-2">
                {rows.length > 0 && (
                  <Button variant="tertiary" icon={<ArrowDownTrayIcon className="h-5 w-5" aria-hidden="true" />} onClick={() => exportCsv(rows, filter)} data-action="export-csv">
                    Export CSV
                  </Button>
                )}
                {canCustomers && (
                  <Button variant="secondary" icon={<UserPlusIcon className="h-5 w-5" aria-hidden="true" />} onClick={() => setCreating(true)} data-action="open-create-customer">
                    New customer
                  </Button>
                )}
              </div>
            </div>
          )}

          <div className="mt-2">
            {listQ.isLoading ? (
              <SkeletonRows count={6} label="Loading customers" />
            ) : listQ.error && !listQ.data ? (
              <ErrorState title="Customers could not be loaded" message={errorMessage(listQ.error)} onRetry={listQ.refetch} />
            ) : rows.length === 0 ? (
              <EmptyState message={EMPTY_MESSAGE[filter]} />
            ) : (
              <>
                <ul role="list" className="overflow-hidden rounded-adm-md border border-adm-line bg-adm-surface" aria-label={`${FILTER_LABEL[filter]} customers`}>
                  {rows.map((row) => (
                    <CustomerListRow key={row.id} row={row} />
                  ))}
                </ul>
                {listQ.data?.nextCursor && (
                  <div className="mt-3 flex flex-col items-center gap-2">
                    <Button variant="secondary" busy={loadingMore} onClick={loadMore} data-action="load-more">
                      Show more customers
                    </Button>
                    {moreError && (
                      <p role="alert" className="text-[13px] text-adm-problem">
                        {moreError}
                      </p>
                    )}
                  </div>
                )}
              </>
            )}
          </div>
        </>
      )}

      {creating && (
        <CreateCustomerSheet
          onClose={() => setCreating(false)}
          onCreated={(_customer, note) => {
            setCreating(false);
            toast.show(note);
            invalidateQueries("customer-list");
            invalidateQueries("customer-search");
          }}
        />
      )}
    </div>
  );
}

/**
 * Someone with the Blocked section only (blacklist.manage without All Users
 * or Members) cannot read the customer list or profiles; they keep the old
 * Blacklist tab's list and its Unblock, which now lifts the block and keeps
 * its history (BE-CUST).
 */
function LegacyBlockedList({ canBlacklist }: { canBlacklist: boolean }) {
  const toast = useToast();
  const q = useAdminQuery<BlacklistEntry[]>(keys.blacklist, fetchBlacklist, { enabled: canBlacklist });
  const [target, setTarget] = useState<BlacklistEntry | null>(null);
  return (
    <div data-section="customers">
      <PageHeader title="Blocked customers" />
      {q.isLoading ? (
        <SkeletonRows count={4} label="Loading blocked customers" />
      ) : q.error && !q.data ? (
        <ErrorState title="Blocked customers could not be loaded" message={errorMessage(q.error)} onRetry={q.refetch} />
      ) : !(q.data || []).length ? (
        <EmptyState message="Nobody is blocked" />
      ) : (
        <ul role="list" className="overflow-hidden rounded-adm-md border border-adm-line bg-adm-surface">
          {(q.data || []).map((e) => (
            <ListRow
              key={e._id}
              chevron={false}
              title={e.name || e.email || "Blocked customer"}
              subtitle={[e.phone, e.reason].filter(Boolean).join(" · ")}
              trailing={
                <Button variant="secondary" onClick={() => setTarget(e)}>
                  Unblock
                </Button>
              }
            />
          ))}
        </ul>
      )}
      <ConfirmSheet
        open={!!target}
        onClose={() => setTarget(null)}
        title="Unblock this customer?"
        consequence="They can book, buy and claim gifts online again. The block stays in their history."
        confirmLabel="Unblock"
        onConfirm={async () => {
          if (!target) return;
          await removeFromBlacklist(target._id);
          setQueryData<BlacklistEntry[]>(keys.blacklist, (list = []) => list.filter((x) => x._id !== target._id));
          toast.show("Customer unblocked");
        }}
      />
    </div>
  );
}
