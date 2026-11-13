/**
 * Cancellable fetchers for the existing admin endpoints, for useAdminQuery.
 * Same endpoints and shapes as lib/admin-service.ts (which stays the home of
 * mutations); these only add the AbortSignal and one cache key per request,
 * so each screen loads only what it shows and nothing loads twice.
 */
import API from "@/lib/api";
import type { BlacklistEntry, Booking, BookingAssignee, RequestLead, User } from "@/lib/admin-service";

export type BookingScope = "all" | "me";

export const keys = {
  bookings: (scope: BookingScope) => ["bookings", scope] as const,
  assignees: ["booking-assignees"] as const,
  customers: ["customers", "all"] as const,
  members: ["customers", "members"] as const,
  blacklist: ["blacklist"] as const,
  leads: ["leads"] as const,
};

export async function fetchBookings(scope: BookingScope, signal: AbortSignal): Promise<Booking[]> {
  const response = await API.get("/api/admin/bookings", { params: scope === "me" ? { assigned: "me" } : undefined, signal });
  return Array.isArray(response.data) ? response.data : [];
}

export async function fetchAssignees(signal: AbortSignal): Promise<BookingAssignee[]> {
  const response = await API.get("/api/admin/booking-assignees", { signal });
  return response.data?.fixters || [];
}

export async function fetchCustomers(signal: AbortSignal): Promise<User[]> {
  const response = await API.get("/api/admin/users", { signal });
  return Array.isArray(response.data) ? response.data : [];
}

export async function fetchMembers(signal: AbortSignal): Promise<User[]> {
  const response = await API.get("/api/admin/members", { signal });
  return Array.isArray(response.data) ? response.data : [];
}

export async function fetchBlacklist(signal: AbortSignal): Promise<BlacklistEntry[]> {
  const response = await API.get("/api/admin/blacklist", { signal });
  return Array.isArray(response.data) ? response.data : [];
}

export async function fetchLeads(signal: AbortSignal): Promise<RequestLead[]> {
  const response = await API.get("/api/admin/requests", { signal });
  return Array.isArray(response.data) ? response.data : [];
}
