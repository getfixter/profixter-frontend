"use client";

import Image from "next/image";
import { useEffect, useMemo, useState } from "react";
import axios from "axios";

type Booking = {
  _id: string;
  bookingNumber?: string;

  date: string; // ISO
  status: string;
  service?: string;
  note?: string;

  phone?: string;

  address?: string;
  city?: string;
  state?: string;
  zip?: string;

  subscription?: string;
  images?: string[]; // URLs
};

type MeResponse = {
  name?: string;
  email?: string;
  phone?: string;
  subscription?: string | null;
};

function normalizeStatus(status: string) {
  return String(status || "").trim().toLowerCase();
}

function canCancel(status: string) {
  const s = normalizeStatus(status);
  return s === "pending" || s === "confirmed";
}

function statusBadge(status: string) {
  const s = normalizeStatus(status);
  const map: Record<string, string> = {
    pending: "bg-yellow-100 text-yellow-800 border-yellow-200",
    confirmed: "bg-blue-100 text-blue-800 border-blue-200",
    "in-progress": "bg-purple-100 text-purple-800 border-purple-200",
    completed: "bg-green-100 text-green-800 border-green-200",
    cancelled: "bg-red-100 text-red-800 border-red-200",
    canceled: "bg-red-100 text-red-800 border-red-200",
  };
  return map[s] || "bg-gray-100 text-gray-800 border-gray-200";
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
      <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
        {safe.slice(0, 9).map((src, i) => (
          <button
            key={src + i}
            type="button"
            onClick={() => setOpen(src)}
            className="relative w-full aspect-square rounded-[12px] overflow-hidden border border-[#C5CBD8] bg-white active:scale-[0.98] transition"
            title="View photo"
          >
            <Image
              src={src}
              alt={`Photo ${i + 1}`}
              fill
              className="object-cover"
              sizes="(max-width: 640px) 50vw, 33vw"
            />
          </button>
        ))}
      </div>

      {open && (
        <div
          className="fixed inset-0 z-[9999] bg-black/70 flex items-center justify-center p-3 sm:p-6"
          onClick={() => setOpen(null)}
        >
          <div
            className="relative w-full max-w-[920px] bg-black rounded-[16px] overflow-hidden"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="relative w-full h-[70vh] bg-black">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={open} alt="Photo" className="w-full h-full object-contain" />
            </div>
            <div className="p-3 flex justify-end">
              <button
                type="button"
                onClick={() => setOpen(null)}
                className="px-4 py-2 rounded-[12px] bg-white text-[#313234] font-semibold"
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
  onClose,
  onConfirm,
}: {
  open: boolean;
  booking: Booking | null;
  loading: boolean;
  onClose: () => void;
  onConfirm: () => void;
}) {
  if (!open || !booking) return null;

  return (
    <div
      className="fixed inset-0 z-[9999] bg-black/50 flex items-center justify-center p-4"
      onClick={onClose}
    >
      <div
        className="w-full max-w-[460px] bg-white rounded-[16px] border border-[#C5CBD8] p-5 sm:p-6"
        onClick={(e) => e.stopPropagation()}
        style={{ boxShadow: "0px 0px 200px 0px rgba(0,0,0,0.16)" }}
      >
        <div className="text-xl font-semibold text-[#313234]">Cancel booking?</div>
        <div className="mt-2 text-sm text-[#6A6D71]">
          This will cancel your appointment.
          <div className="mt-2">
            <span className="font-semibold text-[#313234]">When:</span>{" "}
            {formatNY(booking.date)}
          </div>
          <div className="mt-1">
            <span className="font-semibold text-[#313234]">Service:</span>{" "}
            {booking.service || "—"}
          </div>
        </div>

        <div className="mt-5 flex gap-3">
          <button
            type="button"
            onClick={onClose}
            className="w-full py-3 rounded-[14px] border border-[#C5CBD8] bg-white text-[#313234] font-semibold hover:bg-[#f8f9ff] transition"
            disabled={loading}
          >
            Keep booking
          </button>

          <button
            type="button"
            onClick={onConfirm}
            disabled={loading}
            className="w-full py-3 rounded-[14px] bg-[#ef4444] text-white font-semibold hover:bg-[#dc2626] transition disabled:opacity-60 disabled:cursor-not-allowed"
          >
            {loading ? "Canceling..." : "Yes, cancel"}
          </button>
        </div>

        <div className="mt-3 text-xs text-[#6A6D71]">
          Need help? Call 631-599-1363.
        </div>
      </div>
    </div>
  );
}

function BookingCard({
  title,
  booking,
  me,
  onCancelClick,
  cancelLoading,
}: {
  title: string;
  booking: Booking;
  me: MeResponse | null;
  onCancelClick: (b: Booking) => void;
  cancelLoading: boolean;
}) {
  const addr = formatAddress(booking);
  const phone = booking.phone || me?.phone;

  const showCancel = canCancel(booking.status);

  return (
    <div
      className="bg-[#EEF2FF] border border-[#C5CBD8] rounded-[14px] p-4 sm:p-5"
      style={{ boxShadow: "0px 0px 200px 0px rgba(0,0,0,0.06)" }}
    >
      <div className="flex items-start justify-between gap-3">
        <div>
          <div className="font-semibold text-[#313234]">
            {title} #{booking.bookingNumber || booking._id.slice(-6)}
          </div>
          <div className="text-sm text-[#6A6D71] mt-1">{formatNY(booking.date)}</div>
        </div>

        <div className="flex flex-col items-end gap-2">
          <span
            className={`shrink-0 px-3 py-1 rounded-[12px] text-xs font-semibold border ${statusBadge(
              booking.status
            )}`}
          >
            {booking.status}
          </span>

          {showCancel && (
            <button
              type="button"
              onClick={() => onCancelClick(booking)}
              disabled={cancelLoading}
              className="px-3 py-2 rounded-[12px] text-xs font-semibold border border-[#ef4444] text-[#ef4444] bg-white hover:bg-red-50 transition disabled:opacity-60 disabled:cursor-not-allowed"
              title="Cancel booking"
            >
              {cancelLoading ? "..." : "Cancel"}
            </button>
          )}
        </div>
      </div>

      <div className="mt-3 grid grid-cols-1 sm:grid-cols-2 gap-3">
        <div className="bg-white rounded-[12px] border border-[#C5CBD8] p-3">
          <div className="text-[11px] font-semibold text-[#6A6D71] uppercase">
            Service
          </div>
          <div className="font-semibold text-[#313234] leading-snug">
            {booking.service || "—"}
          </div>
        </div>

        <div className="bg-white rounded-[12px] border border-[#C5CBD8] p-3">
          <div className="text-[11px] font-semibold text-[#6A6D71] uppercase">
            Plan
          </div>
          <div className="font-semibold text-[#313234] capitalize">
            {(booking.subscription || me?.subscription || "—") as any}
          </div>
        </div>
      </div>

      {addr && (
        <div className="mt-3 bg-white rounded-[12px] border border-[#C5CBD8] p-3">
          <div className="text-[11px] font-semibold text-[#6A6D71] uppercase">
            Address
          </div>
          <div className="text-sm text-[#313234] mt-1 leading-snug">{addr}</div>
        </div>
      )}

      {booking.note && (
        <div className="mt-3 bg-white rounded-[12px] border border-[#C5CBD8] p-3">
          <div className="text-[11px] font-semibold text-[#6A6D71] uppercase">
            Note
          </div>
          <div className="text-sm text-[#313234] mt-1 whitespace-pre-wrap leading-snug">
            {booking.note}
          </div>
        </div>
      )}

      {!!booking.images?.length && (
        <div className="mt-3 bg-white rounded-[12px] border border-[#C5CBD8] p-3">
          <div className="text-[11px] font-semibold text-[#6A6D71] uppercase mb-2">
            Photos ({booking.images.length})
          </div>
          <Gallery images={booking.images} />
        </div>
      )}

      {phone && (
        <div className="mt-3 text-sm text-[#6A6D71]">
          Need help? Call{" "}
          <a className="text-[#306EEC] font-semibold" href={`tel:${sanitizeTel(phone)}`}>
            {phone}
          </a>
        </div>
      )}
    </div>
  );
}

export default function BookingsSection() {
  const [loading, setLoading] = useState(true);
  const [me, setMe] = useState<MeResponse | null>(null);
  const [bookings, setBookings] = useState<Booking[]>([]);
  const [error, setError] = useState("");

  // cancel state
  const [cancelTarget, setCancelTarget] = useState<Booking | null>(null);
  const [cancelLoading, setCancelLoading] = useState(false);
  const [cancelError, setCancelError] = useState("");

  const apiBase = process.env.NEXT_PUBLIC_API_URL || "";

  const authHeaders = () => {
    const token = localStorage.getItem("token");
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

        const meRes = await axios.get(`${apiBase}/api/auth/me`, { headers });
        setMe(meRes.data || null);

        const bRes = await axios.get(`${apiBase}/api/bookings`, { headers });
        const list: Booking[] = Array.isArray(bRes.data) ? bRes.data : bRes.data?.bookings || [];
        setBookings(list);
      } catch (e) {
        console.error("Bookings load failed:", e);
        setError("Could not load your bookings. Please try again.");
      } finally {
        setLoading(false);
      }
    })();
  }, [apiBase]);

  const { active, lastCompleted } = useMemo(() => {
    const sorted = [...bookings].sort(
      (a, b) => new Date(b.date).getTime() - new Date(a.date).getTime()
    );

    const activeStatuses = new Set(["pending", "confirmed", "in-progress"]);
    const activeList = sorted
      .filter((b) => activeStatuses.has(normalizeStatus(b.status)))
      .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());

    const completed = sorted.find((b) => normalizeStatus(b.status) === "completed") || null;

    return { active: activeList, lastCompleted: completed };
  }, [bookings]);

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
      // ✅ uses same endpoint style you already use elsewhere
      await axios.post(`${apiBase}/api/bookings/cancel/${cancelTarget._id}`, null, {
        headers,
      });

      // ✅ update status in UI
      setBookings((prev) =>
        prev.map((b) =>
          b._id === cancelTarget._id
            ? { ...b, status: "cancelled" }
            : b
        )
      );

      setCancelTarget(null);
    } catch (e: any) {
      console.error("Cancel failed:", e);
      const msg =
        e?.response?.data?.message ||
        e?.message ||
        "Failed to cancel booking. Please call us.";
      setCancelError(msg);
    } finally {
      setCancelLoading(false);
    }
  };

  return (
    <div className="w-full">
      <div className="flex items-start justify-between gap-4 mb-5 sm:mb-8">
        <h2 className="text-xl sm:text-2xl font-semibold text-[#313234]">My bookings</h2>
      </div>

      <div
        className="w-full bg-[#EEF2FF] border border-[#C5CBD8] rounded-[14px] p-4 sm:p-6 mb-6"
        style={{ boxShadow: "0px 0px 200px 0px rgba(0,0,0,0.08)" }}
      >
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
          <div>
            <div className="text-[#313234] font-semibold text-base sm:text-lg">
              Questions or changes?
            </div>
            <div className="text-[#6A6D71] text-sm sm:text-base">
              Call{" "}
              <a className="text-[#306EEC] font-semibold" href="tel:631-599-1363">
                631-599-1363
              </a>{" "}
              and we’ll help right away.
            </div>
            <div className="mt-2 text-xs text-[#6A6D71]">
              Thank you for supporting your Fixter tech — tips and reviews help a lot.
            </div>
          </div>

          <div className="grid grid-cols-2 sm:flex gap-3">
            <a
              href="https://buy.stripe.com/eVq8wO3W98O03NL3ASawo00"
              target="_blank"
              rel="noreferrer"
              className="inline-flex items-center justify-center px-3 sm:px-4 py-3 rounded-[14px] bg-white border border-[#C5CBD8] text-[#313234] font-semibold hover:bg-[#f8f9ff] transition text-sm"
            >
              Leave a tip ❤️
            </a>
            <a
              href="https://maps.app.goo.gl/Zgf97uUDCh6HBK5o8"
              target="_blank"
              rel="noreferrer"
              className="inline-flex items-center justify-center px-3 sm:px-4 py-3 rounded-[14px] bg-[#306EEC] text-white font-semibold hover:bg-[#2557C7] transition text-sm"
            >
              Google review ⭐
            </a>
          </div>
        </div>
      </div>

      {loading && <div className="text-[#6A6D71] text-sm">Loading your bookings...</div>}

      {!loading && error && (
        <div className="text-red-600 text-sm bg-red-50 border border-red-200 rounded-lg p-3">
          {error}
        </div>
      )}

      {!loading && !error && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-5 sm:gap-6">
          <div
            className="bg-white border border-[#C5CBD8] rounded-[14px] p-4 sm:p-6"
            style={{ boxShadow: "0px 0px 200px 0px rgba(0,0,0,0.08)" }}
          >
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg sm:text-xl font-semibold text-[#313234]">
                Active bookings
              </h3>
              <span className="text-sm text-[#6A6D71]">{active.length} total</span>
            </div>

            {active.length === 0 ? (
              <div className="text-[#6A6D71] text-sm">No active bookings right now.</div>
            ) : (
              <div className="space-y-4">
                {active.map((b) => (
                  <BookingCard
                    key={b._id}
                    title="Booking"
                    booking={b}
                    me={me}
                    onCancelClick={openCancel}
                    cancelLoading={cancelLoading && cancelTarget?._id === b._id}
                  />
                ))}
              </div>
            )}
          </div>

          <div
            className="bg-white border border-[#C5CBD8] rounded-[14px] p-4 sm:p-6"
            style={{ boxShadow: "0px 0px 200px 0px rgba(0,0,0,0.08)" }}
          >
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg sm:text-xl font-semibold text-[#313234]">
                Last completed
              </h3>
              {lastCompleted && (
                <span
                  className={`px-3 py-1 rounded-[12px] text-xs font-semibold border ${statusBadge(
                    lastCompleted.status
                  )}`}
                >
                  {lastCompleted.status}
                </span>
              )}
            </div>

            {!lastCompleted ? (
              <div className="text-[#6A6D71] text-sm">No completed bookings yet.</div>
            ) : (
              <div className="space-y-3">
                <BookingCard
                  title="Booking"
                  booking={lastCompleted}
                  me={me}
                  onCancelClick={openCancel}
                  cancelLoading={false}
                />

                <div className="grid grid-cols-2 gap-3">
                  <a
                    href="https://buy.stripe.com/eVq8wO3W98O03NL3ASawo00"
                    target="_blank"
                    rel="noreferrer"
                    className="inline-flex items-center justify-center px-3 py-3 rounded-[14px] bg-white border border-[#C5CBD8] text-[#313234] font-semibold hover:bg-[#f8f9ff] transition text-sm"
                  >
                    Tip ❤️
                  </a>
                  <a
                    href="https://maps.app.goo.gl/Zgf97uUDCh6HBK5o8"
                    target="_blank"
                    rel="noreferrer"
                    className="inline-flex items-center justify-center px-3 py-3 rounded-[14px] bg-[#306EEC] text-white font-semibold hover:bg-[#2557C7] transition text-sm"
                  >
                    Review ⭐
                  </a>
                </div>

                <div className="text-xs text-[#6A6D71]">
                  Thank you for choosing Mr. Fixter — we appreciate you.
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {!loading && !error && (
        <div className="mt-6 text-sm text-[#6A6D71]">
          Need a new visit? Go to{" "}
          <a className="text-[#306EEC] font-semibold" href="/#pick-day">
            Pick day
          </a>{" "}
          and book your next appointment.
        </div>
      )}

      {/* Cancel confirm modal */}
      <CancelModal
        open={!!cancelTarget}
        booking={cancelTarget}
        loading={cancelLoading}
        onClose={() => {
          if (!cancelLoading) setCancelTarget(null);
          setCancelError("");
        }}
        onConfirm={cancelBooking}
      />

      {/* Cancel error toast-ish */}
      {!!cancelError && (
        <div className="fixed bottom-4 left-1/2 -translate-x-1/2 z-[9999] w-[92%] max-w-[520px]">
          <div className="bg-red-50 border border-red-200 text-red-700 rounded-[14px] p-3 text-sm flex items-start justify-between gap-3">
            <div>{cancelError}</div>
            <button
              type="button"
              className="px-3 py-1 rounded-[12px] bg-white border border-red-200 font-semibold"
              onClick={() => setCancelError("")}
            >
              Close
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
