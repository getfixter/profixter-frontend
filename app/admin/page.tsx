"use client";

import React, { useEffect, useState, useCallback, useMemo } from "react";
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
import { toYMDNY } from "@/lib/utils/timezone-helpers";
import {
  getAllUsers,
  getAllBookings,
  getBlacklist,
  updateBookingStatus,
  updateBookingAdmin, // ✅ NEW
  setAddressPlan,
  setAddressCancellationDate,
  addToBlacklist,
  removeFromBlacklist,
} from "@/lib/admin-service";
import type { User, Booking, BlacklistEntry } from "@/lib/admin-service";
import AdminCalendarSettings from "@/app/components/admin/AdminCalendarSettings";

const ADMIN_EMAIL = "getfixter@gmail.com";

// ✅ NY "today" helper (YYYY-MM-DD)
function todayNY() {
  return new Intl.DateTimeFormat("en-CA", { timeZone: "America/New_York" }).format(new Date());
}
function addDaysYMD(ymd: string, days: number) {
  // ymd is YYYY-MM-DD in NY; treat as local date string
  const [y, m, d] = ymd.split("-").map(Number);
  const dt = new Date(y, m - 1, d);
  dt.setDate(dt.getDate() + days);
  const yyyy = dt.getFullYear();
  const mm = String(dt.getMonth() + 1).padStart(2, "0");
  const dd = String(dt.getDate()).padStart(2, "0");
  return `${yyyy}-${mm}-${dd}`;
}

export default function AdminPage() {
  const { user, isLoading: authLoading } = useAuth();
  const router = useRouter();

  const [active, setActive] = useState("bookings");
  const [users, setUsers] = useState<User[]>([]);
  const [bookings, setBookings] = useState<Booking[]>([]);
  const [blacklist, setBlacklist] = useState<BlacklistEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [q, setQ] = useState(""); // search query
  const [statusFilter, setStatusFilter] = useState("");
  const [selectedDate, setSelectedDate] = useState<string | null>(() => todayNY()); // ✅ DEFAULT = TODAY NY

  // ✅ mobile comfort: hide filter row when scrolling / toggle
  const [showFilters, setShowFilters] = useState(false);
  const [showCalendarMobile, setShowCalendarMobile] = useState(false);

  const isAdmin = user?.email?.toLowerCase() === ADMIN_EMAIL.toLowerCase();

  const fetchAll = useCallback(async () => {
    setLoading(true);
    try {
      const [usersData, bookingsData, blacklistData] = await Promise.all([
        getAllUsers(),
        getAllBookings(),
        getBlacklist().catch(() => []),
      ]);

      setUsers(usersData);
      setBookings(bookingsData);
      setBlacklist(blacklistData);
    } catch (error: unknown) {
      console.error("Failed to fetch admin data:", error);
      const status = typeof error === "object" && error !== null && "response" in error
        ? (error as { response?: { status?: number } }).response?.status
        : undefined;

      if (status === 403) {
        alert("Access denied. Admin only.");
        router.push("/signin");
      }
    } finally {
      setLoading(false);
    }
  }, [router]);

  useEffect(() => {
    if (authLoading) return;

    if (!user) {
      router.push("/signin");
      return;
    }

    if (!isAdmin) {
      alert("Access denied. Admin only.");
      router.push("/");
      return;
    }

    // ✅ Ensure default is always "today" when admin opens tab again
    setSelectedDate((prev) => prev || todayNY());
    fetchAll();
  }, [user, isAdmin, authLoading, router, fetchAll]);

  // ✅ Auto-hide filters row while scrolling on mobile
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

  // Update booking status
  const handleUpdateBookingStatus = async (bookingId: string, status: string) => {
    try {
      await updateBookingStatus(bookingId, status);
      fetchAll();
    } catch (error) {
      console.error("Failed to update booking:", error);
      alert("Failed to update booking status");
    }
  };

  // ✅ Update booking note/date
  const handleUpdateBooking = async (bookingId: string, patch: { note?: string; date?: string }) => {
    try {
      await updateBookingAdmin(bookingId, patch);
      fetchAll();
    } catch (error) {
      console.error("Failed to update booking fields:", error);
      alert("Failed to save booking changes");
    }
  };

  // Set per-address subscription plan
  const handleSetAddressPlan = async (userId: string, addressId: string, plan: string) => {
    try {
      await setAddressPlan(userId, addressId, plan);
      fetchAll();
    } catch (error) {
      console.error("Failed to update plan:", error);
      alert("Failed to update subscription plan");
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
    } catch (error) {
      console.error("Failed to update scheduled cancellation:", error);
      alert("Failed to save cancellation date");
    }
  };

  // Blacklist/unblacklist user
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

  // Filter logic
  const qlc = q.trim().toLowerCase();

  const filteredUsers = useMemo(
    () =>
      users.filter((u) =>
        [u.userId, u.name, u.email]
          .map((v) => String(v || "").toLowerCase())
          .some((s) => s.includes(qlc))
      ),
    [users, qlc]
  );

  const filteredBookings = useMemo(() => {
    let list = bookings;

    // Search filter
    if (qlc) {
      list = list.filter((b) =>
        [b.userId, b.name, b.service, b.status].some((v) => String(v || "").toLowerCase().includes(qlc))
      );
    }

    // Status filter
    if (statusFilter) {
      list = list.filter((b) => String(b.status || "").toLowerCase() === statusFilter);
    }

    // Date filter (default today)
    if (selectedDate) {
      list = list.filter((b) => toYMDNY(new Date(b.date)) === selectedDate);
    }

    return list.sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());
  }, [bookings, qlc, statusFilter, selectedDate]);

  const subscribedUsers = useMemo(() => {
    return users.filter((u) => {
      const addresses = u.addressesDetailed || [];
      return addresses.some((a) => !!a.plan);
    });
  }, [users]);

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

  if (!isAdmin) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-lg">Access Denied</div>
      </div>
    );
  }

  const today = todayNY();
  const tomorrow = addDaysYMD(today, 1);

  return (
    <div className="min-h-screen bg-gray-50">
      <AdminHeader />

      {/* Top toolbar */}
        <div className="border-b border-slate-200 bg-white shadow-sm">
        <div className="px-3 md:px-8 py-3 md:py-4">
          <AdminTabs active={active} onChange={setActive} />
          <BottomNav active={active} onChange={setActive} />
          <div className="mt-3 md:hidden rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3">
            <div className="flex items-start justify-between gap-3">
              <div>
                <div className="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-400">
                  {active === "bookings" ? "Tech mode" : "Admin workspace"}
                </div>
                <div className="mt-1 text-sm font-semibold text-slate-900 capitalize">
                  {active === "subscribed" ? "Subscribed users" : active}
                </div>
              </div>

              {active === "bookings" && (
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => setShowCalendarMobile((value) => !value)}
                    className={`rounded-xl border px-3 py-2 text-xs font-semibold ${
                      showCalendarMobile
                        ? "border-slate-900 bg-slate-900 text-white"
                        : "border-slate-200 bg-white text-slate-700"
                    }`}
                  >
                    Cal
                  </button>
                  <button
                    type="button"
                    onClick={() => setShowFilters((v) => !v)}
                    className={`rounded-xl border px-3 py-2 text-xs font-semibold ${
                      showFilters
                        ? "border-slate-900 bg-slate-900 text-white"
                        : "border-slate-200 bg-white text-slate-700"
                    }`}
                  >
                    Flt
                  </button>
                </div>
              )}
            </div>
          </div>

          {/* ✅ Quick day buttons only in bookings */}
          {active === "bookings" && (
            <div className="mt-3 flex items-center gap-2 flex-wrap">
              <button
                type="button"
                onClick={() => setSelectedDate(today)}
                className={`px-3 py-2 rounded-xl text-xs md:text-sm font-semibold border ${
                  selectedDate === today ? "bg-blue-600 text-white border-blue-600" : "bg-white text-gray-800 border-gray-300"
                }`}
              >
                <span className="hidden sm:inline">Today (NY)</span>
                <span className="sm:hidden">Tdy</span>
              </button>
              <button
                type="button"
                onClick={() => setSelectedDate(tomorrow)}
                className={`px-3 py-2 rounded-xl text-xs md:text-sm font-semibold border ${
                  selectedDate === tomorrow ? "bg-blue-600 text-white border-blue-600" : "bg-white text-gray-800 border-gray-300"
                }`}
              >
                <span className="hidden sm:inline">Tomorrow</span>
                <span className="sm:hidden">Tmr</span>
              </button>
              <button
                type="button"
                onClick={() => setSelectedDate(null)}
                className={`px-3 py-2 rounded-xl text-xs md:text-sm font-semibold border ${
                  selectedDate === null ? "bg-slate-900 text-white border-slate-900" : "bg-white text-gray-800 border-gray-300"
                }`}
              >
                All
              </button>
              <button
                type="button"
                onClick={fetchAll}
                className="md:hidden rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs font-semibold text-slate-700"
              >
                Ref
              </button>

              <button
                type="button"
                onClick={() => setShowFilters((v) => !v)}
                className="ml-auto hidden md:inline-flex px-3 py-2 rounded-lg text-sm font-semibold border border-gray-300 bg-white text-gray-800"
              >
                {showFilters ? "Hide Filters" : "Filters"}
              </button>
            </div>
          )}

          {/* ✅ Filters row (collapsible for mobile comfort) */}
          <div className={`${active === "bookings" ? (showFilters ? "block" : "hidden md:block") : ""}`}>
            <div className="grid gap-2 md:gap-3 grid-cols-1 md:grid-cols-3 mt-3 md:mt-4">
              <div className="relative">
                <svg
                  className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 md:w-5 md:h-5 text-gray-400"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                </svg>
                <input
                  className="w-full pl-9 md:pl-10 pr-3 md:pr-4 py-2 md:py-2.5 text-sm md:text-base border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all"
                  placeholder="Search..."
                  value={q}
                  onChange={(e) => setQ(e.target.value)}
                />
              </div>

              {active === "bookings" && (
                <>
                  <select
                    className="px-3 md:px-4 py-2 md:py-2.5 text-sm md:text-base border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all bg-white"
                    value={statusFilter}
                    onChange={(e) => setStatusFilter(e.target.value)}
                  >
                    <option value="">All statuses</option>
                    <option value="pending">Pending</option>
                    <option value="confirmed">Confirmed</option>
                    <option value="completed">Completed</option>
                    <option value="canceled">Canceled</option>
                  </select>

                  <button
                    className="px-4 md:px-6 py-2 md:py-2.5 bg-gradient-to-r from-blue-500 to-blue-600 text-white rounded-lg text-sm md:text-base font-medium hover:shadow-lg active:scale-95 md:hover:scale-105 transition-all flex items-center justify-center gap-2"
                    onClick={fetchAll}
                  >
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                    </svg>
                    <span className="hidden sm:inline">Refresh</span>
                    <span className="sm:hidden">↻</span>
                  </button>
                </>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Content */}
      <div className="max-w-[1400px] mx-auto px-3 pb-8 pt-3 md:px-8 md:py-6">
        {loading ? (
          <div className="bg-white rounded-xl shadow-lg p-12 text-center">
            <div className="inline-block animate-spin rounded-full h-12 w-12 border-4 border-blue-500 border-t-transparent"></div>
            <p className="mt-4 text-gray-600 font-medium">Loading admin data...</p>
          </div>
        ) : (
          <>
            <QuickStats active={active} users={users} bookings={bookings} blacklistCount={blacklist.length} />

            {active === "users" && (
              <UsersTable
                users={filteredUsers}
                onSetAddressPlan={handleSetAddressPlan}
                onSetAddressCancellationDate={handleSetAddressCancellationDate}
                blacklistByUserId={blacklistByUserId}
                onBlacklist={handleBlacklist}
                onUnblacklist={handleUnblacklist}
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
              />
            )}

            {active === "bookings" && (
              <div className="space-y-6">
                {/* Calendar on top - full width */}
                <div className={showCalendarMobile ? "block" : "hidden md:block"}>
                  <BookingsCalendar bookings={bookings} selectedDate={selectedDate} onChange={setSelectedDate} />
                </div>

                {/* Bookings below */}
                <BookingsTable
  bookings={filteredBookings}
  updateStatus={handleUpdateBookingStatus}
  users={users}
  onUpdateBooking={handleUpdateBooking}
/>

              </div>
            )}

            {active === "emails" && <EmailComposer />}

            {active === "blacklist" && <BlacklistTable blacklist={blacklist} onUnblacklist={handleUnblacklist} />}

            {active === "calendar" && <AdminCalendarSettings />}
          </>
        )}
      </div>
    </div>
  );
}
