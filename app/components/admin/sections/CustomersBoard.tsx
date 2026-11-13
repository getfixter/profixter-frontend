"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { useCallback, useMemo, useState } from "react";
import BlacklistTable from "@/app/components/admin/BlacklistTable";
import UsersTable from "@/app/components/admin/UsersTable";
import { addToBlacklist, deleteUser, removeFromBlacklist, setAddressCancellationDate, setAddressPlan, type User } from "@/lib/admin-service";
import { can, PERM } from "@/lib/admin-access";
import { isAdminUser } from "@/lib/auth-routing";
import { fetchBlacklist, fetchCustomers, fetchMembers, keys } from "@/lib/admin/fetchers";
import { errorMessage, invalidateQueries, setQueryData, useAdminQuery } from "@/lib/admin/query";
import { normalizeQuery, userMatches } from "@/lib/admin/search";
import { useHandoffQuery } from "@/lib/admin/useHandoffQuery";
import { Chip, ErrorState, FilterBar, PageHeader, SearchField, SkeletonRows, useToast } from "@/app/components/admin/ui";
import { useAdmin } from "@/app/components/admin/shell/AdminContext";

type Filter = "all" | "members" | "blocked";

/**
 * Customers (All Users, Members and Blacklist in one section, audit G.1),
 * mounted from the existing UsersTable and BlacklistTable with every action
 * they have, until the Customers track's redesign. The filter is in the URL;
 * the search text never is (it arrives by hand-off from old ?q= links and the
 * header search). /admin/customers/[id] opens that customer's detail over
 * the list.
 *
 * Changes from the old tab: each filter loads only its own list, edits patch
 * the cached row, and the retired GoHighLevel "Fix GHL" button is gone (Q-6).
 */
export function CustomersBoard({ customerId }: { customerId?: string }) {
  const { user } = useAdmin();
  const router = useRouter();
  const params = useSearchParams();
  const toast = useToast();
  const owner = isAdminUser(user);
  const canCustomers = can(user, PERM.CUSTOMERS_MANAGE);
  const canMembers = can(user, PERM.MEMBERS_READ);
  const canBlacklist = can(user, PERM.BLACKLIST_MANAGE);
  const canBookingsWrite = can(user, PERM.BOOKINGS_WRITE);

  const allowed: Filter[] = [canCustomers && "all", canMembers && "members", canBlacklist && "blocked"].filter(Boolean) as Filter[];
  const requested = params.get("filter") as Filter | null;
  const filter: Filter = requested && allowed.includes(requested) ? requested : allowed[0] || "members";

  const usersKey = filter === "all" ? keys.customers : keys.members;
  const usersQ = useAdminQuery(usersKey, filter === "all" ? fetchCustomers : fetchMembers, { enabled: filter !== "blocked" });
  const blacklistQ = useAdminQuery(keys.blacklist, fetchBlacklist, { enabled: canBlacklist });

  const [q, setQ] = useState("");
  const [searching, setSearching] = useState(false);
  useHandoffQuery("customers", setQ);

  const users = useMemo(() => usersQ.data || [], [usersQ.data]);
  const shown = useMemo(() => {
    const n = normalizeQuery(q);
    return users.filter((u) => (filter === "members" ? (u.addressesDetailed || []).some((a) => !!a.plan) : true) && userMatches(u, n));
  }, [users, q, filter]);
  const blacklistByUserId = useMemo(() => new Map((blacklistQ.data || []).map((e) => [String(e.userId), e._id])), [blacklistQ.data]);
  const blockedShown = useMemo(() => {
    const t = q.trim().toLowerCase();
    const list = blacklistQ.data || [];
    return t ? list.filter((e) => JSON.stringify(e).toLowerCase().includes(t)) : list;
  }, [blacklistQ.data, q]);

  const refreshLists = useCallback(() => {
    invalidateQueries("customers");
    invalidateQueries("blacklist");
  }, []);

  const run = async (action: () => Promise<unknown>, done: string, failed: string) => {
    try {
      await action();
      refreshLists();
      if (done) toast.show(done);
    } catch (error) {
      toast.show(errorMessage(error, failed));
    }
  };

  const filterHref = (f: Filter) => `/admin/customers${f === allowed[0] ? "" : `?filter=${f}`}`;
  const counts = { blocked: blacklistQ.data?.length };

  return (
    <div data-section="customers">
      <PageHeader title="Customers" />
      <SearchField label="Search customers" placeholder="Search name, email, phone, address, zip, plan or ID" value={q} onChange={setQ} onSearchModeChange={setSearching} className="mb-1" />
      {!searching && allowed.length > 1 && (
        <FilterBar label="Customer filters">
          {allowed.includes("all") && (
            <Chip href={filterHref("all")} selected={filter === "all"}>
              All customers
            </Chip>
          )}
          {allowed.includes("members") && (
            <Chip href={filterHref("members")} selected={filter === "members"}>
              Members
            </Chip>
          )}
          {allowed.includes("blocked") && (
            <Chip href={filterHref("blocked")} selected={filter === "blocked"} count={counts.blocked}>
              Blocked
            </Chip>
          )}
        </FilterBar>
      )}

      <div className="mt-2">
        {filter === "blocked" ? (
          blacklistQ.isLoading ? (
            <SkeletonRows count={4} label="Loading blocked customers" />
          ) : blacklistQ.error && !blacklistQ.data ? (
            <ErrorState title="Blocked customers could not be loaded" message={errorMessage(blacklistQ.error)} onRetry={blacklistQ.refetch} />
          ) : (
            <BlacklistTable blacklist={blockedShown} onUnblacklist={(id) => void run(() => removeFromBlacklist(id), "Customer unblocked", "Failed to unblock")} />
          )
        ) : usersQ.isLoading ? (
          <SkeletonRows count={6} label="Loading customers" />
        ) : usersQ.error && !usersQ.data ? (
          <ErrorState title="Customers could not be loaded" message={errorMessage(usersQ.error)} onRetry={usersQ.refetch} />
        ) : (
          <UsersTable
            users={shown}
            onSetAddressPlan={(userId, addressId, plan) => void run(() => setAddressPlan(userId, addressId, plan), "Plan updated", "Failed to update subscription plan")}
            onSetAddressCancellationDate={(userId, addressId, date) =>
              void run(() => setAddressCancellationDate(userId, addressId, date), "Cancellation date saved", "Failed to save cancellation date")
            }
            blacklistByUserId={blacklistByUserId}
            onBlacklist={(userId) => void run(() => addToBlacklist(userId, "Admin action"), "Customer blocked", "Failed to block")}
            onUnblacklist={(id) => void run(() => removeFromBlacklist(id), "Customer unblocked", "Failed to unblock")}
            onDeleteUser={async (target: User, confirmation: string) => {
              await deleteUser(target._id, confirmation);
              refreshLists();
              toast.show("User deleted");
            }}
            readOnly={filter === "members" && !canCustomers}
            canBlacklist={canBlacklist && canCustomers}
            canDelete={owner}
            showCustomerPanels={canCustomers}
            showLoyalty={filter === "members" && canMembers}
            canViewLoyalty={canMembers}
            canGift={owner}
            canEdit={canCustomers}
            onUserUpdated={(saved) => {
              setQueryData<User[]>(usersKey, (list = []) => list.map((u) => (u._id === saved._id ? { ...u, ...saved } : u)));
              toast.show("Customer updated");
            }}
            canCreateCustomer={canCustomers}
            canSellMembership={canCustomers}
            canCreateVisit={canBookingsWrite}
            onCustomerCreated={refreshLists}
            onNotify={toast.show}
            openHistoryForId={customerId}
            onHistoryClosed={() => router.replace(filter === allowed[0] ? "/admin/customers" : `/admin/customers?filter=${filter}`, { scroll: false })}
          />
        )}
      </div>
    </div>
  );
}
