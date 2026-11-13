/**
 * In-list search, moved unchanged from the old app/admin/page.tsx so the
 * mounted sections behave exactly as before (name, phone, email, address,
 * zip, booking number, ids). Server-side search (audit C-05) replaces these
 * per section in the later tracks.
 */
import type { Booking, RequestLead, User } from "@/lib/admin-service";

type Normalized = { q: string; digits: string; bookingQ: string; idQ: string };

export function normalizeQuery(query: string): Normalized {
  const q = query.trim().toLowerCase();
  return { q, digits: q.replace(/\D/g, ""), bookingQ: q.replace(/^#+/, ""), idQ: q.replace(/[^a-z0-9]/g, "") };
}

const stripCountry = (digits: string) => (digits.length === 11 && digits.startsWith("1") ? digits.slice(1) : digits);

export function bookingMatches(booking: Booking, n: Normalized): boolean {
  if (!n.q) return true;
  const phoneDigits = String(booking.phone || "").replace(/\D/g, "");
  const bookingNumber = String(booking.bookingNumber || "").toLowerCase();
  const fullAddress = [booking.address, booking.city, booking.state, booking.zip].filter(Boolean).join(" ").toLowerCase();
  const nameParts = String(booking.name || "").toLowerCase().split(/\s+/).filter(Boolean);
  const text = [
    booking._id,
    booking.userId,
    booking.bookingNumber,
    booking.service,
    booking.bookingType,
    booking.accessType,
    booking.paymentState,
    booking.selectedTask,
    booking.entitlementId,
    booking.reservationIssue?.status,
    booking.reservationIssue?.message,
    booking.bookingType === "one_time_handyman_visit" || booking.accessType === "one_time"
      ? "one-time one time one-time visit book a handyman paid pending failed reservation review"
      : "membership subscription",
    booking.status,
    booking.name,
    booking.email,
    booking.phone,
    booking.address,
    booking.city,
    booking.zip,
    fullAddress,
  ]
    .map((v) => String(v || "").toLowerCase())
    .join(" ");
  if (text.includes(n.q)) return true;
  if (nameParts.some((part) => part.includes(n.q))) return true;
  if (String(booking._id || "").toLowerCase().includes(n.bookingQ)) return true;
  if (bookingNumber.includes(n.q) || bookingNumber.replace(/^#+/, "").includes(n.bookingQ)) return true;
  if (n.digits.length >= 3 && (phoneDigits.includes(n.digits) || stripCountry(phoneDigits).includes(stripCountry(n.digits)))) return true;
  return false;
}

export function userMatches(candidate: User, n: Normalized): boolean {
  if (!n.q) return true;
  const record = candidate as User & Record<string, unknown>;
  const addresses = [...(candidate.addressesDetailed || []), ...(candidate.addresses || [])];
  const phoneDigits = String(candidate.phone || "").replace(/\D/g, "");
  const nameParts = String(candidate.name || "").toLowerCase().split(/\s+/).filter(Boolean);
  const addressText = addresses
    .map((a) =>
      [a._id, a.label, a.line1, a.city, a.state, a.zip, "county" in a ? a.county : "", "plan" in a ? a.plan : ""].filter(Boolean).join(" ")
    )
    .join(" ");
  const ids = [
    candidate._id,
    candidate.userId,
    candidate.defaultAddressId,
    record.customerId,
    record.stripeCustomerId,
    record.subscriptionId,
    record.stripeSubscriptionId,
    record.currentSubscriptionId,
    ...addresses.map((a) => a._id),
  ];
  const text = [candidate._id, candidate.userId, candidate.name, candidate.email, candidate.phone, candidate.subscription, candidate.defaultAddressId, addressText, ...ids]
    .map((v) => String(v || "").toLowerCase())
    .join(" ");
  if (text.includes(n.q)) return true;
  if (nameParts.some((part) => part.includes(n.q))) return true;
  if (n.digits.length >= 3 && (phoneDigits.includes(n.digits) || stripCountry(phoneDigits).includes(stripCountry(n.digits)))) return true;
  if (n.idQ && ids.map((v) => String(v || "").toLowerCase().replace(/[^a-z0-9]/g, "")).some((v) => v.includes(n.idQ))) return true;
  return false;
}

export function leadMatches(lead: RequestLead, n: Normalized): boolean {
  if (!n.q) return true;
  return [lead.name, lead.email, lead.phone, lead.serviceType, lead.sourcePage, lead.message, lead.status].some((v) => String(v || "").toLowerCase().includes(n.q));
}

/** A job nobody is going to (live jobs only; history is not a hole in the schedule). */
export function isUnassignedActive(booking: Booking): boolean {
  const status = String(booking.status || "").toLowerCase();
  if (["completed", "canceled", "cancelled"].includes(status)) return false;
  return !String(booking.assignedFixterName || "").trim();
}

/** Today in New York, YYYY-MM-DD. */
export function todayNY(): string {
  return new Intl.DateTimeFormat("en-CA", { timeZone: "America/New_York" }).format(new Date());
}

export function addDaysYMD(ymd: string, days: number): string {
  const [y, m, d] = ymd.split("-").map(Number);
  const date = new Date(Date.UTC(y, m - 1, d + days));
  return date.toISOString().slice(0, 10);
}
