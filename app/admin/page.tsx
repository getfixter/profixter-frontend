"use client";

import { useEffect, useState, useCallback, useMemo } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/lib/useAuth";
import AdminHeader from "@/app/components/admin/AdminHeader";
import AdminTabs from "@/app/components/admin/AdminTabs";
import BottomNav from "@/app/components/admin/BottomNav";
import QuickStats from "@/app/components/admin/QuickStats";
import UsersTable from "@/app/components/admin/UsersTable";
import BookingsTable from "@/app/components/admin/BookingsTable";
import BookingsCalendar from "@/app/components/admin/BookingsCalendar";
import BlacklistTable from "@/app/components/admin/BlacklistTable";
import EmailComposer from "@/app/components/admin/EmailComposer";
import RequestsTable from "@/app/components/admin/RequestsTable";
import ProjectsModule from "@/app/components/admin/ProjectsModule";
import FixtersModule from "@/app/components/admin/FixtersModule";
import PromotionPopupEditor from "@/app/components/admin/PromotionPopupEditor";
import { tabsForUser } from "@/app/components/admin/admin-tabs-config";
import { toYMDNY } from "@/lib/utils/timezone-helpers";
import {
  getAllUsers,
  getMembers,
  getAllBookings,
  getBookingAssignees,
  getBlacklist,
  getAllRequests,
  updateBookingStatus,
  updateBookingAdmin,
  updateRequestStatus,
  setAddressPlan,
  setAddressCancellationDate,
  addToBlacklist,
  removeFromBlacklist,
} from "@/lib/admin-service";
import type {
  User,
  Booking,
  BlacklistEntry,
  RequestLead,
  BookingAssignee,
} from "@/lib/admin-service";
import AdminCalendarSettings from "@/app/components/admin/AdminCalendarSettings";

const ADMIN_EMAIL = "getfixter@gmail.com";
const API_URL = process.env.NEXT_PUBLIC_API_URL || "";
type BookingQuickFilter = "today" | "upcoming" | "pending" | "confirmed" | "completed" | "custom";

// ✅ NY "today" helper (YYYY-MM-DD)
function todayNY() {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "America/New_York",
  }).format(new Date());
}

function Toast({ message, onDone }: { message: string; onDone: () => void }) {
  useEffect(() => {
    const t = setTimeout(onDone, 3200);
    return () => clearTimeout(t);
  }, [onDone]);
  return (
    <div className="fixed left-1/2 z-[99999] -translate-x-1/2 max-w-[90vw] rounded-[14px] bg-[#0B1628] px-5 py-3 text-sm font-semibold text-white shadow-[0_8px_32px_rgba(0,0,0,0.30)] animate-fadeIn" style={{ bottom: 'max(1.5rem, env(safe-area-inset-bottom))' }}>
      {message}
    </div>
  );
}

export default function AdminPage() {
  const { user, isLoading: authLoading } = useAuth();
  const router = useRouter();

  const [active, setActive] = useState("bookings");
  const [toast, setToast] = useState<string | null>(null);

  const showToast = useCallback((msg: string) => {
    setToast(msg);
  }, []);
  const [users, setUsers] = useState<User[]>([]);
  const [bookings, setBookings] = useState<Booking[]>([]);
  const [bookingAssignees, setBookingAssignees] = useState<BookingAssignee[]>([]);
  const [blacklist, setBlacklist] = useState<BlacklistEntry[]>([]);
  const [requests, setRequests] = useState<RequestLead[]>([]);
  const [loading, setLoading] = useState(true);
  const [q, setQ] = useState("");
  const [statusFilter, setStatusFilter] = useState("");
  const [selectedDate, setSelectedDate] = useState<string | null>(() => todayNY());
  const [bookingQuickFilter, setBookingQuickFilter] = useState<BookingQuickFilter>("today");

  const [showFilters, setShowFilters] = useState(false);
  const [showCalendarMobile, setShowCalendarMobile] = useState(false);
  const [assignmentScope, setAssignmentScope] = useState<"me" | "all">(
    user?.employeePosition === "Fixter" ? "me" : "all"
  );

  const isAdmin = user?.role === "admin" || user?.email?.toLowerCase() === ADMIN_EMAIL.toLowerCase();
  const isEmployee = user?.role === "employee";
  const hasWorkspaceAccess = isAdmin || isEmployee;
  const canAssignBookings = isAdmin || user?.employeePosition === "General Fixter";
  const allowedTabs = useMemo(
    () => tabsForUser(isAdmin ? "admin" : user?.role, user?.employeePosition || undefined),
    [isAdmin, user?.role, user?.employeePosition]
  );

  const fetchAll = useCallback(async () => {
    setLoading(true);
    try {
      const [usersData, bookingsData, blacklistData, requestsData, assigneesData] =
        await Promise.all([
          isAdmin
            ? getAllUsers()
            : user?.employeePosition === "General Fixter"
              ? getMembers()
              : Promise.resolve([]),
          getAllBookings(assignmentScope),
          isAdmin ? getBlacklist().catch(() => []) : Promise.resolve([]),
          isAdmin ? getAllRequests().catch(() => []) : Promise.resolve([]),
          canAssignBookings ? getBookingAssignees().catch(() => []) : Promise.resolve([]),
        ]);

      setUsers(usersData);
      setBookings(bookingsData);
      setBlacklist(blacklistData);
      setRequests(requestsData);
      setBookingAssignees(assigneesData);
    } catch (error: unknown) {
      console.error("Failed to fetch admin data:", error);
      const status =
        typeof error === "object" && error !== null && "response" in error
          ? (error as { response?: { status?: number } }).response?.status
          : undefined;

      if (status === 403) {
        alert("Access denied. Admin only.");
        router.push("/signin");
      }
    } finally {
      setLoading(false);
    }
  }, [router, isAdmin, user?.employeePosition, assignmentScope, canAssignBookings]);

  useEffect(() => {
    if (authLoading) return;

    if (!user) {
      router.push("/signin");
      return;
    }

    if (!hasWorkspaceAccess) {
      alert("Access denied.");
      router.push("/");
      return;
    }

    if (allowedTabs.length && !allowedTabs.some((tab) => tab.id === active)) {
      setActive(allowedTabs[0].id);
    }
    setSelectedDate((prev) => prev || todayNY());
    fetchAll();
  }, [user, hasWorkspaceAccess, authLoading, router, fetchAll, allowedTabs, active]);

  useEffect(() => {
    if (user?.employeePosition === "Fixter") {
      setAssignmentScope("me");
    }
  }, [user?.employeePosition]);

  useEffect(() => {
    let lastY = window.scrollY;
    const onScroll = () => {
      const y = window.scrollY;
      const down = y > lastY + 8;
      lastY = y;
      if (down) setShowFilters(false);
    };
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  const handleUpdateBookingStatus = async (
    bookingId: string,
    status: string,
    assignedFixterId?: string | null
  ) => {
    try {
      await updateBookingStatus(bookingId, status, assignedFixterId);
      fetchAll();
    } catch (error) {
      console.error("Failed to update booking:", error);
      showToast("Failed to update booking status");
    }
  };

  const handleUpdateBooking = async (
    bookingId: string,
    patch: { note?: string; date?: string; assignedFixterId?: string | null }
  ) => {
    try {
      await updateBookingAdmin(bookingId, patch);
      fetchAll();
      showToast("Booking saved");
    } catch (error) {
      console.error("Failed to update booking fields:", error);
      showToast("Failed to save booking changes");
    }
  };

  const handleUpdateRequestStatus = async (
    requestId: string,
    status: "new" | "contacted" | "won" | "lost"
  ) => {
    try {
      await updateRequestStatus(requestId, status);
      fetchAll();
    } catch (error) {
      console.error("Failed to update request status:", error);
      showToast("Failed to update request status");
    }
  };

  const handleSetAddressPlan = async (
    userId: string,
    addressId: string,
    plan: string
  ) => {
    try {
      await setAddressPlan(userId, addressId, plan);
      fetchAll();
      showToast("Plan updated");
    } catch (error) {
      console.error("Failed to update plan:", error);
      showToast("Failed to update subscription plan");
    }
  };

  const handleSetAddressCancellationDate = async (
    userId: string,
    addressId: string,
    cancelOnDate: string | null
  ) => {
    try {
      await setAddressCancellationDate(userId, addressId, cancelOnDate);
      fetchAll();
      showToast("Cancellation date saved");
    } catch (error) {
      console.error("Failed to update scheduled cancellation:", error);
      showToast("Failed to save cancellation date");
    }
  };

  const handleRunSubscriptionCleanup = async () => {
    try {
      const token = localStorage.getItem("token");

      const syncRes = await fetch(`${API_URL}/api/admin/ghl/sync-all-users`, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${token || ""}`,
          "Content-Type": "application/json",
        },
      });

      const syncData = await syncRes.json();

      if (!syncRes.ok) {
        throw new Error(syncData?.message || "Sync all users failed");
      }

      const cleanupRes = await fetch(
        `${API_URL}/api/admin/ghl/subscription-tags/cleanup`,
        {
          method: "POST",
          headers: {
            Authorization: `Bearer ${token || ""}`,
            "Content-Type": "application/json",
          },
        }
      );

      const cleanupData = await cleanupRes.json();

      if (!cleanupRes.ok) {
        throw new Error(cleanupData?.message || "Cleanup failed");
      }


      alert(
        `Fix GHL finished.\n\n` +
          `SYNC:\n` +
          `Scanned: ${syncData.scanned ?? 0}\n` +
          `Synced: ${syncData.synced ?? 0}\n` +
          `Skipped no phone: ${syncData.skippedNoPhone ?? 0}\n` +
          `Sync errors: ${(syncData.errors || []).length}\n\n` +
          `CLEANUP:\n` +
          `Scanned: ${cleanupData.scanned ?? 0}\n` +
          `Removed tags: ${cleanupData.removed ?? 0}\n` +
          `No Contact: ${cleanupData.noContact ?? 0}\n` +
          `Cleanup errors: ${(cleanupData.errors || []).length}`
      );

      await fetchAll();
    } catch (error) {
      console.error("Failed to fix GHL:", error);
      const message =
        error instanceof Error ? error.message : "Failed to fix GHL";
      alert(message);
      throw error;
    }
  };

  const handleBlacklist = async (userId: string) => {
    try {
      await addToBlacklist(userId, "Admin action");
      fetchAll();
    } catch (error) {
      console.error("Failed to blacklist:", error);
    }
  };

  const handleUnblacklist = async (blacklistId: string) => {
    try {
      await removeFromBlacklist(blacklistId);
      fetchAll();
    } catch (error) {
      console.error("Failed to unblacklist:", error);
    }
  };

  const qlc = q.trim().toLowerCase();
  const normalizedQueryDigits = qlc.replace(/\D/g, "");
  const normalizedBookingQuery = qlc.replace(/^#+/, "");
  const normalizedUserIdQuery = qlc.replace(/[^a-z0-9]/g, "");

  const bookingMatchesSearch = useCallback((booking: Booking, query: string) => {
    if (!query) return true;

    const phoneDigits = String(booking.phone || "").replace(/\D/g, "");
    const phoneWithoutCountry =
      phoneDigits.length === 11 && phoneDigits.startsWith("1")
        ? phoneDigits.slice(1)
        : phoneDigits;
    const queryPhoneWithoutCountry =
      normalizedQueryDigits.length === 11 && normalizedQueryDigits.startsWith("1")
        ? normalizedQueryDigits.slice(1)
        : normalizedQueryDigits;

    const bookingNumber = String(booking.bookingNumber || "").toLowerCase();
    const bookingNumberPlain = bookingNumber.replace(/^#+/, "");
    const bookingId = String(booking._id || "").toLowerCase();
    const fullAddress = [
      booking.address,
      booking.city,
      booking.state,
      booking.zip,
    ]
      .filter(Boolean)
      .join(" ")
      .toLowerCase();
    const name = String(booking.name || "").toLowerCase();
    const nameParts = name.split(/\s+/).filter(Boolean);

    const searchableText = [
      booking._id,
      booking.userId,
      booking.bookingNumber,
      booking.service,
      booking.status,
      booking.name,
      booking.email,
      booking.phone,
      booking.address,
      booking.city,
      booking.zip,
      fullAddress,
    ]
      .map((value) => String(value || "").toLowerCase())
      .join(" ");

    if (searchableText.includes(query)) return true;
    if (nameParts.some((part) => part.includes(query))) return true;
    if (bookingId.includes(normalizedBookingQuery)) return true;
    if (bookingNumber.includes(query) || bookingNumberPlain.includes(normalizedBookingQuery)) {
      return true;
    }
    if (
      normalizedQueryDigits.length >= 3 &&
      (phoneDigits.includes(normalizedQueryDigits) ||
        phoneWithoutCountry.includes(queryPhoneWithoutCountry))
    ) {
      return true;
    }

    return false;
  }, [normalizedBookingQuery, normalizedQueryDigits]);

  const userMatchesSearch = useCallback((candidate: User, query: string) => {
    if (!query) return true;

    const userRecord = candidate as User & Record<string, unknown>;
    const addresses = [
      ...(candidate.addressesDetailed || []),
      ...(candidate.addresses || []),
    ];
    const phoneDigits = String(candidate.phone || "").replace(/\D/g, "");
    const phoneWithoutCountry =
      phoneDigits.length === 11 && phoneDigits.startsWith("1")
        ? phoneDigits.slice(1)
        : phoneDigits;
    const queryPhoneWithoutCountry =
      normalizedQueryDigits.length === 11 && normalizedQueryDigits.startsWith("1")
        ? normalizedQueryDigits.slice(1)
        : normalizedQueryDigits;

    const name = String(candidate.name || "").toLowerCase();
    const nameParts = name.split(/\s+/).filter(Boolean);
    const addressText = addresses
      .map((address) =>
        [
          address._id,
          address.label,
          address.line1,
          address.city,
          address.state,
          address.zip,
          "county" in address ? address.county : "",
          "plan" in address ? address.plan : "",
        ]
          .filter(Boolean)
          .join(" ")
      )
      .join(" ");

    const possibleIds = [
      candidate._id,
      candidate.userId,
      candidate.defaultAddressId,
      userRecord.customerId,
      userRecord.stripeCustomerId,
      userRecord.subscriptionId,
      userRecord.stripeSubscriptionId,
      userRecord.currentSubscriptionId,
      ...addresses.map((address) => address._id),
    ];

    const searchableText = [
      candidate._id,
      candidate.userId,
      candidate.name,
      candidate.email,
      candidate.phone,
      candidate.subscription,
      candidate.defaultAddressId,
      addressText,
      ...possibleIds,
    ]
      .map((value) => String(value || "").toLowerCase())
      .join(" ");

    if (searchableText.includes(query)) return true;
    if (nameParts.some((part) => part.includes(query))) return true;

    if (
      normalizedQueryDigits.length >= 3 &&
      (phoneDigits.includes(normalizedQueryDigits) ||
        phoneWithoutCountry.includes(queryPhoneWithoutCountry))
    ) {
      return true;
    }

    if (
      normalizedUserIdQuery &&
      possibleIds
        .map((value) => String(value || "").toLowerCase().replace(/[^a-z0-9]/g, ""))
        .some((value) => value.includes(normalizedUserIdQuery))
    ) {
      return true;
    }

    return false;
  }, [normalizedQueryDigits, normalizedUserIdQuery]);

  const filteredUsers = useMemo(
    () => users.filter((candidate) => userMatchesSearch(candidate, qlc)),
    [users, qlc, userMatchesSearch]
  );

  const filteredBookings = useMemo(() => {
    let list = bookings;

    if (qlc) {
      list = list.filter((b) => bookingMatchesSearch(b, qlc));
    }

    if (bookingQuickFilter === "upcoming") {
      const today = todayNY();
      list = list.filter((b) => {
        const status = String(b.status || "").toLowerCase();
        const ymd = toYMDNY(new Date(b.date));
        return ymd >= today && !["completed", "canceled", "cancelled"].includes(status);
      });
    }

    if (statusFilter) {
      list = list.filter(
        (b) => String(b.status || "").toLowerCase() === statusFilter
      );
    }

    if (selectedDate) {
      list = list.filter((b) => toYMDNY(new Date(b.date)) === selectedDate);
    }

    return list.sort(
      (a, b) => new Date(a.date).getTime() - new Date(b.date).getTime()
    );
  }, [bookingMatchesSearch, bookings, qlc, statusFilter, selectedDate, bookingQuickFilter]);

  const filteredRequests = useMemo(() => {
    let list = requests;

    if (qlc) {
      list = list.filter((r) =>
        [
          r.name,
          r.email,
          r.phone,
          r.serviceType,
          r.sourcePage,
          r.message,
          r.status,
        ].some((v) => String(v || "").toLowerCase().includes(qlc))
      );
    }

    return list;
  }, [requests, qlc]);

  const subscribedUsers = useMemo(() => {
    return users.filter((u) => {
      const addresses = u.addressesDetailed || [];
      return addresses.some((a) => !!a.plan) && userMatchesSearch(u, qlc);
    });
  }, [qlc, userMatchesSearch, users]);

  const blacklistByUserId = useMemo(
    () => new Map(blacklist.map((entry) => [String(entry.userId), entry._id])),
    [blacklist]
  );

  if (authLoading || !user) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-lg">Loading...</div>
      </div>
    );
  }

  if (!hasWorkspaceAccess) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-lg">Access Denied</div>
      </div>
    );
  }

  const today = todayNY();
  const pendingCount = bookings.filter((booking) => String(booking.status || "").toLowerCase() === "pending").length;
  const confirmedCount = bookings.filter((booking) => String(booking.status || "").toLowerCase() === "confirmed").length;
  const completedCount = bookings.filter((booking) => String(booking.status || "").toLowerCase() === "completed").length;
  const upcomingCount = bookings.filter((booking) => {
    const status = String(booking.status || "").toLowerCase();
    return toYMDNY(new Date(booking.date)) >= today && !["completed", "canceled", "cancelled"].includes(status);
  }).length;

  const selectQuickFilter = (filter: BookingQuickFilter) => {
    setBookingQuickFilter(filter);

    if (filter === "today") {
      setSelectedDate(today);
      setStatusFilter("");
      return;
    }

    setSelectedDate(null);
    if (filter === "pending") setStatusFilter("pending");
    else if (filter === "confirmed") setStatusFilter("confirmed");
    else if (filter === "completed") setStatusFilter("completed");
    else setStatusFilter("");
  };

  return (
    <div className="min-h-screen bg-gray-50">
      <AdminHeader />

      <div className="border-b border-slate-200 bg-white shadow-sm">
        <div className="px-3 md:px-8 py-3 md:py-4">
          <AdminTabs active={active} onChange={setActive} tabs={allowedTabs} />
          <BottomNav active={active} onChange={setActive} tabs={allowedTabs} />

          {active === "bookings" && (
            <div className="sticky top-0 z-30 -mx-3 mt-3 flex items-center gap-2 overflow-x-auto border-y border-slate-100 bg-white px-3 py-2 md:static md:mx-0 md:border-0 md:bg-transparent md:p-0">
              <div className="flex flex-shrink-0 rounded-xl border border-slate-200 bg-slate-100 p-1">
                {(["me", "all"] as const).map((scope) => (
                  <button
                    key={scope}
                    type="button"
                    onClick={() => setAssignmentScope(scope)}
                    className={`rounded-lg px-3 py-2 text-xs font-bold ${
                      assignmentScope === scope ? "bg-white text-blue-700 shadow-sm" : "text-slate-500"
                    }`}
                  >
                    {scope === "me" ? "Assigned to me" : "All"}
                  </button>
                ))}
              </div>
              <button
                type="button"
                onClick={() => setShowCalendarMobile((v) => !v)}
                className={`md:hidden flex-shrink-0 rounded-xl border p-2.5 ${
                  showCalendarMobile
                    ? "border-slate-900 bg-slate-900 text-white"
                    : "border-slate-200 bg-white text-slate-600"
                }`}
                aria-label="Toggle calendar"
              >
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <rect x="3" y="4" width="18" height="18" rx="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/>
                </svg>
              </button>
              <button
                type="button"
                onClick={() => selectQuickFilter("today")}
                className={`flex-shrink-0 px-3.5 py-2.5 rounded-xl text-sm font-semibold border ${
                  bookingQuickFilter === "today" && selectedDate === today
                    ? "bg-blue-600 text-white border-blue-600"
                    : "bg-white text-gray-800 border-gray-300"
                }`}
              >
                Today
              </button>
              <button
                type="button"
                onClick={() => selectQuickFilter("upcoming")}
                className={`flex-shrink-0 px-3.5 py-2.5 rounded-xl text-sm font-semibold border ${
                  bookingQuickFilter === "upcoming"
                    ? "bg-blue-600 text-white border-blue-600"
                    : "bg-white text-gray-800 border-gray-300"
                }`}
              >
                Upcoming ({upcomingCount})
              </button>
              <button
                type="button"
                onClick={() => selectQuickFilter("pending")}
                className={`flex-shrink-0 rounded-xl border px-3.5 py-2.5 text-sm font-black shadow-sm ${
                  bookingQuickFilter === "pending"
                    ? "border-amber-500 bg-amber-500 text-white"
                    : "border-amber-200 bg-amber-50 text-amber-800"
                }`}
              >
                All Pending ({pendingCount})
              </button>
              <button
                type="button"
                onClick={() => selectQuickFilter("confirmed")}
                className={`flex-shrink-0 px-3.5 py-2.5 rounded-xl text-sm font-semibold border ${
                  bookingQuickFilter === "confirmed"
                    ? "bg-emerald-600 text-white border-emerald-600"
                    : "bg-white text-gray-800 border-gray-300"
                }`}
              >
                Confirmed ({confirmedCount})
              </button>
              <button
                type="button"
                onClick={() => selectQuickFilter("completed")}
                className={`flex-shrink-0 px-3.5 py-2.5 rounded-xl text-sm font-semibold border ${
                  bookingQuickFilter === "completed"
                    ? "bg-sky-600 text-white border-sky-600"
                    : "bg-white text-gray-800 border-gray-300"
                }`}
              >
                Completed ({completedCount})
              </button>
              <button
                type="button"
                onClick={fetchAll}
                className="flex-shrink-0 rounded-xl border border-slate-200 bg-white p-2.5 text-slate-600 hover:bg-slate-50"
                aria-label="Refresh"
              >
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"/>
                </svg>
              </button>
              <button
                type="button"
                onClick={() => setShowFilters((v) => !v)}
                className={`ml-auto flex-shrink-0 rounded-xl border px-3.5 py-2.5 text-sm font-semibold ${
                  showFilters
                    ? "border-slate-900 bg-slate-900 text-white"
                    : "border-gray-300 bg-white text-gray-800"
                }`}
              >
                {showFilters ? "Hide" : "Filter"}
              </button>
            </div>
          )}

          <div className="mt-3 grid gap-2 grid-cols-1 md:grid-cols-3">
            <div className="relative md:col-span-2">
              <svg
                className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"
                />
              </svg>
              <input
                className="w-full pl-9 pr-3 py-2.5 text-sm border border-gray-300 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all"
                placeholder={
                  active === "bookings"
                    ? "Search name, phone, email, address, zip, booking #..."
                    : active === "users" || active === "subscribed"
                    ? "Search by name, email, phone, address, zip, plan, or ID"
                    : "Search..."
                }
                value={q}
                onChange={(e) => setQ(e.target.value)}
              />
            </div>

            {active === "bookings" && showFilters && (
              <select
                className="px-3 py-2.5 text-sm border border-gray-300 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all bg-white"
                value={statusFilter}
                onChange={(e) => {
                  setBookingQuickFilter("custom");
                  setStatusFilter(e.target.value);
                }}
              >
                <option value="">All statuses</option>
                <option value="pending">Pending</option>
                <option value="confirmed">Confirmed</option>
                <option value="completed">Completed</option>
                <option value="canceled">Canceled</option>
              </select>
            )}
          </div>
        </div>
      </div>

      <div className="max-w-[1400px] mx-auto px-3 pb-8 pt-3 md:px-8 md:py-6">
        {loading ? (
          <div className="bg-white rounded-xl shadow-lg p-12 text-center">
            <div className="inline-block animate-spin rounded-full h-12 w-12 border-4 border-blue-500 border-t-transparent"></div>
            <p className="mt-4 text-gray-600 font-medium">
              Loading admin data...
            </p>
          </div>
        ) : (
          <>
            <QuickStats
              active={active}
              users={users}
              bookings={bookings}
              blacklistCount={blacklist.length}
            />

            {active === "users" && (
              <UsersTable
                users={filteredUsers}
                onSetAddressPlan={handleSetAddressPlan}
                onSetAddressCancellationDate={handleSetAddressCancellationDate}
                blacklistByUserId={blacklistByUserId}
                onBlacklist={handleBlacklist}
                onUnblacklist={handleUnblacklist}
                onRunSubscriptionCleanup={handleRunSubscriptionCleanup}
              />
            )}

            {active === "subscribed" && (
              <UsersTable
                users={subscribedUsers}
                onSetAddressPlan={handleSetAddressPlan}
                onSetAddressCancellationDate={handleSetAddressCancellationDate}
                blacklistByUserId={blacklistByUserId}
                onBlacklist={handleBlacklist}
                onUnblacklist={handleUnblacklist}
                onRunSubscriptionCleanup={handleRunSubscriptionCleanup}
                readOnly={!isAdmin}
              />
            )}

            {active === "requests" && (
              <RequestsTable
                requests={filteredRequests}
                onUpdateStatus={handleUpdateRequestStatus}
              />
            )}

            {active === "projects" && <ProjectsModule />}

            {active === "bookings" && (
              <div className="space-y-6">
                <div className={showCalendarMobile ? "block" : "hidden md:block"}>
                  <BookingsCalendar
                    bookings={bookings}
                    selectedDate={selectedDate}
                    onChange={(date) => {
                      setBookingQuickFilter("custom");
                      setSelectedDate(date);
                    }}
                  />
                </div>

                <BookingsTable
                  bookings={filteredBookings}
                  updateStatus={handleUpdateBookingStatus}
                  users={users}
                  onUpdateBooking={handleUpdateBooking}
                  assignees={bookingAssignees}
                  canAssign={canAssignBookings}
                  emptyMessage={
                    assignmentScope === "me"
                      ? "No bookings are assigned to you"
                      : "No bookings in this view"
                  }
                />
              </div>
            )}

            {active === "emails" && <EmailComposer />}
            {active === "promotion" && isAdmin && <PromotionPopupEditor />}

            {active === "blacklist" && (
              <BlacklistTable
                blacklist={blacklist}
                onUnblacklist={handleUnblacklist}
              />
            )}

            {active === "calendar" && <AdminCalendarSettings isAdmin={isAdmin} />}
            {active === "fixters" && isAdmin && <FixtersModule />}
          </>
        )}
      </div>

      {toast && <Toast message={toast} onDone={() => setToast(null)} />}
    </div>
  );
}
