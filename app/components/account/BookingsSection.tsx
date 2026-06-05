"use client";

import Image from "next/image";
import { useEffect, useMemo, useState } from "react";
import axios from "axios";

type Booking = {
  _id: string;
  bookingNumber?: string;
  date: string;
  status: string;
  service?: string;
  note?: string;
  phone?: string;
  address?: string;
  city?: string;
  state?: string;
  zip?: string;
  subscription?: string;
  images?: string[];
};

type MeResponse = {
  name?: string;
  email?: string;
  phone?: string;
  subscription?: string | null;
};

type FilterKey = "all" | "active" | "completed" | "cancelled";

function normalizeStatus(status: string) {
  return String(status || "").trim().toLowerCase();
}

function canCancel(status: string) {
  const s = normalizeStatus(status);
  return s === "pending" || s === "confirmed";
}

function isActiveStatus(status: string) {
  const s = normalizeStatus(status);
  return s === "pending" || s === "confirmed" || s === "in-progress";
}

function isCompletedStatus(status: string) {
  return normalizeStatus(status) === "completed";
}

function isCancelledStatus(status: string) {
  const s = normalizeStatus(status);
  return s === "cancelled" || s === "canceled";
}

function statusBadge(status: string) {
  const s = normalizeStatus(status);
  const map: Record<string, string> = {
    pending: "bg-amber-50 text-amber-700 border-amber-200",
    confirmed: "bg-[#EEF5FF] text-[#1D4ED8] border-[#C7D9FF]",
    "in-progress": "bg-[#F3F0FF] text-[#6D28D9] border-[#DDD6FE]",
    completed: "bg-[#F0FDF4] text-[#166534] border-[#BBF7D0]",
    cancelled: "bg-[#FFF1F2] text-[#9F1239] border-[#FECDD3]",
    canceled: "bg-[#FFF1F2] text-[#9F1239] border-[#FECDD3]",
  };
  return map[s] || "bg-[#F8FAFF] text-[#475569] border-[#E2E8F0]";
}

function statusLabel(status: string) {
  const s = normalizeStatus(status);
  if (s === "in-progress") return "In Progress";
  return s.charAt(0).toUpperCase() + s.slice(1);
}

function formatNY(iso: string) {
  const d = new Date(iso);
  return d.toLocaleString("en-US", {
    timeZone: "America/New_York",
    weekday: "short",
    month: "short",
    day: "numeric",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function formatAddress(b: Booking) {
  const parts = [
    b.address?.trim(),
    [b.city?.trim(), b.state?.trim(), b.zip?.trim()].filter(Boolean).join(" "),
  ].filter(Boolean);
  return parts.join(", ");
}

function sanitizeTel(phone: string) {
  return String(phone || "").replace(/[^\d+]/g, "");
}

function Gallery({ images = [] }: { images?: string[] }) {
  const [open, setOpen] = useState<string | null>(null);
  const safe = (images || []).filter((u) => u && !u.startsWith("local://"));

  if (!safe.length) return null;

  return (
    <>
      <div className="grid grid-cols-3 sm:grid-cols-4 gap-2">
        {safe.slice(0, 8).map((src, i) => (
          <button
            key={src + i}
            type="button"
            onClick={() => setOpen(src)}
            className="relative w-full aspect-square rounded-[10px] overflow-hidden border border-[#E0E6F5] bg-white active:scale-[0.97] transition"
            title="View photo"
          >
            <Image
              src={src}
              alt={`Photo ${i + 1}`}
              fill
              className="object-cover"
              sizes="(max-width: 640px) 33vw, 25vw"
            />
          </button>
        ))}
      </div>

      {open && (
        <div
          className="fixed inset-0 z-[9999] bg-black/75 flex items-center justify-center p-3 sm:p-6"
          onClick={() => setOpen(null)}
        >
          <div
            className="relative w-full max-w-[900px] bg-black rounded-[16px] overflow-hidden"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="relative w-full h-[72vh]">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={open} alt="Photo" className="w-full h-full object-contain" />
            </div>
            <div className="p-3 flex justify-end bg-black/60">
              <button
                type="button"
                onClick={() => setOpen(null)}
                className="px-4 py-2 rounded-[10px] bg-white text-[#313234] font-semibold text-sm"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}

function CancelModal({
  open,
  booking,
  loading,
  error,
  onClose,
  onConfirm,
}: {
  open: boolean;
  booking: Booking | null;
  loading: boolean;
  error: string;
  onClose: () => void;
  onConfirm: () => void;
}) {
  if (!open || !booking) return null;

  return (
    <div
      className="fixed inset-0 z-[9999] bg-black/55 flex items-end sm:items-center justify-center sm:p-4"
      onClick={onClose}
    >
      <div
        className="w-full sm:max-w-[460px] bg-white rounded-t-[24px] sm:rounded-[20px] border border-[#E0E6F5] p-5 sm:p-6"
        onClick={(e) => e.stopPropagation()}
        style={{ boxShadow: "0 -8px 60px rgba(0,0,0,0.18)" }}
      >
        <div className="flex justify-center mb-4 sm:hidden">
          <div className="w-10 h-1 rounded-full bg-[#E2E8F0]" />
        </div>

        <div className="text-[18px] font-bold text-[#313234] mb-1">Cancel this booking?</div>
        <div className="text-[14px] text-[#6A6D71] mb-4">
          <div className="mt-1.5">
            <span className="font-semibold text-[#313234]">When:</span>{" "}
            {formatNY(booking.date)}
          </div>
          <div className="mt-1">
            <span className="font-semibold text-[#313234]">Service:</span>{" "}
            {booking.service || "—"}
          </div>
        </div>

        {error && (
          <div className="mb-3 rounded-[12px] bg-red-50 border border-red-200 text-red-700 px-3 py-2 text-[13px]">
            {error}
          </div>
        )}

        <div className="flex gap-3">
          <button
            type="button"
            onClick={onClose}
            disabled={loading}
            className="flex-1 py-3 rounded-[14px] border border-[#E0E6F5] bg-white text-[#313234] font-semibold text-[14px] hover:bg-[#F8FAFF] transition disabled:opacity-60"
          >
            Keep booking
          </button>
          <button
            type="button"
            onClick={onConfirm}
            disabled={loading}
            className="flex-1 py-3 rounded-[14px] bg-red-500 text-white font-semibold text-[14px] hover:bg-red-600 transition disabled:opacity-60 disabled:cursor-not-allowed"
          >
            {loading ? "Canceling…" : "Yes, cancel"}
          </button>
        </div>

        <div className="mt-3 text-[12px] text-[#9CA3AF] text-center">
          Need help? Call{" "}
          <a className="text-[#306EEC] font-semibold" href="tel:631-599-1363">631-599-1363</a>
        </div>
      </div>
    </div>
  );
}

function BookingCard({
  booking,
  me,
  onCancelClick,
  cancelLoading,
}: {
  booking: Booking;
  me: MeResponse | null;
  onCancelClick: (b: Booking) => void;
  cancelLoading: boolean;
}) {
  const addr = formatAddress(booking);
  const phone = booking.phone || me?.phone;
  const showCancel = canCancel(booking.status);
  const bookingId = booking.bookingNumber || booking._id.slice(-6).toUpperCase();

  return (
    <div className="bg-white border border-[#E0E6F5] rounded-[16px] overflow-hidden transition hover:border-[#C7D9FF]">
      {/* Card header */}
      <div className="flex items-center justify-between px-4 pt-4 pb-3 border-b border-[#F0F4FF]">
        <div>
          <div className="text-[12px] font-bold uppercase tracking-[0.1em] text-[#9CA3AF]">
            Booking #{bookingId}
          </div>
          <div className="text-[14px] font-semibold text-[#313234] mt-0.5">
            {formatNY(booking.date)}
          </div>
        </div>
        <span className={`px-2.5 py-1 rounded-[10px] text-[11px] font-bold border ${statusBadge(booking.status)}`}>
          {statusLabel(booking.status)}
        </span>
      </div>

      {/* Card body */}
      <div className="p-4 space-y-2.5">
        {/* Service */}
        <div className="flex items-start gap-2.5">
          <div className="flex-shrink-0 w-6 h-6 rounded-full bg-[#EEF2FF] flex items-center justify-center mt-0.5">
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="#306EEC" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M14.7 6.3a1 1 0 0 0 0 1.4l1.6 1.6a1 1 0 0 0 1.4 0l3.77-3.77a6 6 0 0 1-7.94 7.94l-6.91 6.91a2.12 2.12 0 0 1-3-3l6.91-6.91a6 6 0 0 1 7.94-7.94l-3.76 3.76z" />
            </svg>
          </div>
          <div>
            <div className="text-[11px] font-semibold text-[#9CA3AF] uppercase tracking-[0.08em]">Service</div>
            <div className="text-[13px] font-semibold text-[#313234] leading-snug">{booking.service || "—"}</div>
          </div>
        </div>

        {/* Address */}
        {addr && (
          <div className="flex items-start gap-2.5">
            <div className="flex-shrink-0 w-6 h-6 rounded-full bg-[#EEF2FF] flex items-center justify-center mt-0.5">
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="#306EEC" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z" />
                <circle cx="12" cy="10" r="3" />
              </svg>
            </div>
            <div>
              <div className="text-[11px] font-semibold text-[#9CA3AF] uppercase tracking-[0.08em]">Address</div>
              <div className="text-[13px] text-[#313234] leading-snug">{addr}</div>
            </div>
          </div>
        )}

        {/* Note */}
        {booking.note && (
          <div className="flex items-start gap-2.5">
            <div className="flex-shrink-0 w-6 h-6 rounded-full bg-[#EEF2FF] flex items-center justify-center mt-0.5">
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="#306EEC" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
                <polyline points="14 2 14 8 20 8" />
              </svg>
            </div>
            <div>
              <div className="text-[11px] font-semibold text-[#9CA3AF] uppercase tracking-[0.08em]">Note</div>
              <div className="text-[13px] text-[#313234] whitespace-pre-wrap leading-snug">{booking.note}</div>
            </div>
          </div>
        )}

        {/* Photos */}
        {!!booking.images?.length && (
          <div>
            <div className="text-[11px] font-semibold text-[#9CA3AF] uppercase tracking-[0.08em] mb-2">
              Photos ({booking.images.length})
            </div>
            <Gallery images={booking.images} />
          </div>
        )}

        {/* Actions */}
        <div className="flex gap-2 pt-1">
          {showCancel && (
            <button
              type="button"
              onClick={() => onCancelClick(booking)}
              disabled={cancelLoading}
              className="flex-1 py-2.5 rounded-[12px] text-[13px] font-semibold border border-red-200 text-red-600 bg-red-50 hover:bg-red-100 transition disabled:opacity-60 disabled:cursor-not-allowed"
            >
              {cancelLoading ? "…" : "Cancel booking"}
            </button>
          )}
          {isCompletedStatus(booking.status) && (
            <>
              <a
                href="https://buy.stripe.com/eVq8wO3W98O03NL3ASawo00"
                target="_blank"
                rel="noreferrer"
                className="flex-1 py-2.5 rounded-[12px] text-[13px] font-semibold border border-[#E0E6F5] text-[#313234] bg-white hover:bg-[#F8FAFF] transition text-center"
              >
                Tip ❤️
              </a>
              <a
                href="https://maps.app.goo.gl/Zgf97uUDCh6HBK5o8"
                target="_blank"
                rel="noreferrer"
                className="flex-1 py-2.5 rounded-[12px] text-[13px] font-semibold bg-[#306EEC] text-white hover:bg-[#2557C7] transition text-center"
              >
                Review ⭐
              </a>
            </>
          )}
          {phone && (
            <a
              href={`tel:${sanitizeTel(phone)}`}
              className="flex-shrink-0 w-10 h-10 rounded-[12px] border border-[#E0E6F5] bg-white flex items-center justify-center hover:bg-[#F8FAFF] transition"
              title={`Call ${phone}`}
            >
              <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="#306EEC" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07A19.5 19.5 0 0 1 4.69 13.6a19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 3.6 3h3a2 2 0 0 1 2 1.72 12.84 12.84 0 0 0 .7 2.81 2 2 0 0 1-.45 2.11L8 10.91a16 16 0 0 0 6 6l1.27-.85a2 2 0 0 1 2.11-.45 12.84 12.84 0 0 0 2.81.7A2 2 0 0 1 22 18.09z" />
              </svg>
            </a>
          )}
        </div>
      </div>
    </div>
  );
}

const FILTER_TABS: { key: FilterKey; label: string }[] = [
  { key: "all", label: "All" },
  { key: "active", label: "Active" },
  { key: "completed", label: "Completed" },
  { key: "cancelled", label: "Cancelled" },
];

export default function BookingsSection() {
  const [loading, setLoading] = useState(true);
  const [me, setMe] = useState<MeResponse | null>(null);
  const [bookings, setBookings] = useState<Booking[]>([]);
  const [error, setError] = useState("");
  const [filter, setFilter] = useState<FilterKey>("all");

  const [cancelTarget, setCancelTarget] = useState<Booking | null>(null);
  const [cancelLoading, setCancelLoading] = useState(false);
  const [cancelError, setCancelError] = useState("");

  const apiBase = process.env.NEXT_PUBLIC_API_URL || "";

  const authHeaders = () => {
    const token = typeof window !== "undefined" ? localStorage.getItem("token") : null;
    return token ? { Authorization: `Bearer ${token}` } : null;
  };

  useEffect(() => {
    const headers = authHeaders();
    if (!headers) {
      setLoading(false);
      setError("Please sign in.");
      return;
    }

    (async () => {
      try {
        setLoading(true);
        setError("");

        const [meRes, bRes] = await Promise.all([
          axios.get(`${apiBase}/api/auth/me`, { headers }),
          axios.get(`${apiBase}/api/bookings`, { headers }),
        ]);

        setMe(meRes.data || null);

        const list: Booking[] = Array.isArray(bRes.data)
          ? bRes.data
          : bRes.data?.bookings || [];

        // Sort newest first
        const sorted = [...list].sort(
          (a, b) => new Date(b.date).getTime() - new Date(a.date).getTime()
        );
        setBookings(sorted);
      } catch (e) {
        console.error("Bookings load failed:", e);
        setError("Could not load your bookings. Please try again.");
      } finally {
        setLoading(false);
      }
    })();
  }, [apiBase]);

  const filtered = useMemo(() => {
    if (filter === "active") return bookings.filter((b) => isActiveStatus(b.status));
    if (filter === "completed") return bookings.filter((b) => isCompletedStatus(b.status));
    if (filter === "cancelled") return bookings.filter((b) => isCancelledStatus(b.status));
    return bookings;
  }, [bookings, filter]);

  const counts = useMemo(() => ({
    all: bookings.length,
    active: bookings.filter((b) => isActiveStatus(b.status)).length,
    completed: bookings.filter((b) => isCompletedStatus(b.status)).length,
    cancelled: bookings.filter((b) => isCancelledStatus(b.status)).length,
  }), [bookings]);

  const openCancel = (b: Booking) => {
    setCancelError("");
    setCancelTarget(b);
  };

  const cancelBooking = async () => {
    if (!cancelTarget) return;

    const headers = authHeaders();
    if (!headers) {
      setCancelError("Please sign in again.");
      return;
    }

    setCancelLoading(true);
    setCancelError("");

    try {
      await axios.post(`${apiBase}/api/bookings/cancel/${cancelTarget._id}`, null, { headers });

      setBookings((prev) =>
        prev.map((b) =>
          b._id === cancelTarget._id ? { ...b, status: "cancelled" } : b
        )
      );
      setCancelTarget(null);
    } catch (e: unknown) {
      const error = e as { response?: { data?: { message?: string } }; message?: string };
      const msg =
        error?.response?.data?.message || error?.message || "Failed to cancel. Please call us.";
      setCancelError(msg);
    } finally {
      setCancelLoading(false);
    }
  };

  return (
    <div className="w-full">
      {/* Header */}
      <div className="mb-5">
        <h2 className="text-[22px] font-bold text-[#313234]">My Visits</h2>
        <p className="text-[13px] text-[#6A6D71] mt-0.5">Upcoming and past home visits</p>
      </div>

      {/* CTA strip */}
      <div className="bg-white border border-[#E0E6F5] rounded-[16px] p-4 mb-5 flex flex-col sm:flex-row sm:items-center gap-4 justify-between">
        <div>
          <div className="text-[14px] font-semibold text-[#313234]">Questions or changes?</div>
          <div className="text-[13px] text-[#6A6D71] mt-0.5">
            Call{" "}
            <a className="text-[#306EEC] font-semibold" href="tel:631-599-1363">
              631-599-1363
            </a>{" "}
            — we&apos;ll help right away.
          </div>
        </div>

        <div className="flex gap-2.5 flex-shrink-0">
          <a
            href="https://buy.stripe.com/eVq8wO3W98O03NL3ASawo00"
            target="_blank"
            rel="noreferrer"
            className="inline-flex items-center justify-center px-4 py-2.5 rounded-[12px] bg-white border border-[#E0E6F5] text-[#313234] font-semibold text-[13px] hover:bg-[#F8FAFF] transition"
          >
            Leave a tip ❤️
          </a>
          <a
            href="https://maps.app.goo.gl/Zgf97uUDCh6HBK5o8"
            target="_blank"
            rel="noreferrer"
            className="inline-flex items-center justify-center px-4 py-2.5 rounded-[12px] bg-[#306EEC] text-white font-semibold text-[13px] hover:bg-[#2557C7] transition"
          >
            Google review ⭐
          </a>
        </div>
      </div>

      {/* Status filter tabs */}
      {!loading && !error && (
        <div className="flex gap-1.5 mb-4 overflow-x-auto scrollbar-none pb-0.5">
          {FILTER_TABS.map((t) => (
            <button
              key={t.key}
              type="button"
              onClick={() => setFilter(t.key)}
              className={`flex-shrink-0 flex items-center gap-1.5 px-3.5 py-2 rounded-[10px] text-[13px] font-semibold transition ${
                filter === t.key
                  ? "bg-[#306EEC] text-white"
                  : "bg-white border border-[#E0E6F5] text-[#6A6D71] hover:text-[#313234] hover:border-[#C7D9FF]"
              }`}
            >
              {t.label}
              <span className={`text-[11px] font-bold px-1.5 py-0.5 rounded-[6px] ${
                filter === t.key ? "bg-white/20 text-white" : "bg-[#EEF2FF] text-[#6A6D71]"
              }`}>
                {counts[t.key]}
              </span>
            </button>
          ))}
        </div>
      )}

      {/* States */}
      {loading && (
        <div className="flex items-center gap-3 py-12 justify-center text-[#6A6D71]">
          <div className="w-5 h-5 border-2 border-[#306EEC] border-t-transparent rounded-full animate-spin" />
          <span className="text-[14px]">Loading your bookings…</span>
        </div>
      )}

      {!loading && error && (
        <div className="bg-red-50 border border-red-200 rounded-[14px] p-4 text-[14px] text-red-700">
          {error}
        </div>
      )}

      {!loading && !error && filtered.length === 0 && (
        <div className="bg-white border border-[#E0E6F5] rounded-[16px] p-8 text-center">
          <div className="text-[32px] mb-3">📅</div>
          <div className="text-[15px] font-semibold text-[#313234] mb-1">
            {filter === "all" ? "No bookings yet" : `No ${filter} bookings`}
          </div>
          <div className="text-[13px] text-[#6A6D71]">
            {filter === "all"
              ? "Your visit history will appear here once you book."
              : `Switch to \"All\" to see your full history.`}
          </div>
          {filter === "all" && (
            <a
              href="/membership"
              className="inline-flex items-center justify-center mt-4 px-5 py-2.5 rounded-[12px] bg-[#306EEC] text-white font-semibold text-[13px] hover:bg-[#2557C7] transition"
            >
              Book a visit
            </a>
          )}
        </div>
      )}

      {!loading && !error && filtered.length > 0 && (
        <div className="space-y-3">
          {filtered.map((b) => (
            <BookingCard
              key={b._id}
              booking={b}
              me={me}
              onCancelClick={openCancel}
              cancelLoading={cancelLoading && cancelTarget?._id === b._id}
            />
          ))}
        </div>
      )}

      {/* Book new visit footer */}
      {!loading && !error && bookings.length > 0 && (
        <div className="mt-5 text-[13px] text-[#6A6D71] text-center">
          Need a new visit?{" "}
          <a className="text-[#306EEC] font-semibold hover:underline" href="/membership">
            Book another visit →
          </a>
        </div>
      )}

      <CancelModal
        open={!!cancelTarget}
        booking={cancelTarget}
        loading={cancelLoading}
        error={cancelError}
        onClose={() => {
          if (!cancelLoading) {
            setCancelTarget(null);
            setCancelError("");
          }
        }}
        onConfirm={cancelBooking}
      />
    </div>
  );
}
