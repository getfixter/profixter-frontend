"use client";

import Image from "next/image";
import { useEffect, useMemo, useState } from "react";
import axios from "axios";

type Booking = {
  _id: string;
  bookingNumber?: string;
  userId?: string;
  name?: string;

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
  subscription?: string;
  defaultAddressId?: string;
  addresses?: Array<any>;
};

function statusBadge(status: string) {
  const s = (status || "").toLowerCase();
  const map: Record<string, string> = {
    pending: "bg-yellow-100 text-yellow-800 border-yellow-200",
    confirmed: "bg-blue-100 text-blue-800 border-blue-200",
    "in-progress": "bg-purple-100 text-purple-800 border-purple-200",
    completed: "bg-green-100 text-green-800 border-green-200",
    cancelled: "bg-red-100 text-red-800 border-red-200",
  };
  return map[s] || "bg-gray-100 text-gray-800 border-gray-200";
}

function formatNY(iso: string) {
  const d = new Date(iso);
  return d.toLocaleString("en-US", {
    timeZone: "America/New_York",
    weekday: "long",
    month: "long",
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
  return phone.replace(/[^\d+]/g, "");
}

function Gallery({ images = [] }: { images?: string[] }) {
  const [open, setOpen] = useState<string | null>(null);

  if (!images?.length) return null;

  return (
    <>
      <div className="grid grid-cols-3 sm:grid-cols-4 gap-2">
        {images.slice(0, 8).map((src, i) => (
          <button
            key={src + i}
            type="button"
            onClick={() => setOpen(src)}
            className="relative w-full aspect-square rounded-[12px] overflow-hidden border border-[#C5CBD8] bg-white hover:opacity-95"
            title="View photo"
          >
            <Image src={src} alt={`Photo ${i + 1}`} fill className="object-cover" />
          </button>
        ))}
      </div>

      {open && (
        <div
          className="fixed inset-0 z-[9999] bg-black/70 flex items-center justify-center p-4"
          onClick={() => setOpen(null)}
        >
          <div
            className="relative w-full max-w-[900px] bg-black rounded-[16px] overflow-hidden"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="relative w-full h-[70vh]">
              <Image src={open} alt="Photo" fill className="object-contain" />
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

export default function BookingsSection() {
  const [loading, setLoading] = useState(true);
  const [me, setMe] = useState<MeResponse | null>(null);
  const [bookings, setBookings] = useState<Booking[]>([]);
  const [error, setError] = useState("");

  const apiBase = process.env.NEXT_PUBLIC_API_URL || "";

  useEffect(() => {
    const token = localStorage.getItem("token");
    if (!token) {
      setLoading(false);
      setError("Please sign in.");
      return;
    }

    const headers = { Authorization: `Bearer ${token}` };

    (async () => {
      try {
        setLoading(true);
        setError("");

        // 1) Get me
        const meRes = await axios.get(`${apiBase}/api/auth/me`, { headers });
        const meData: MeResponse = meRes.data;
        setMe(meData);

        // 2) Get my bookings (customer endpoint)
        // ✅ EXPECTED BACKEND ROUTE: GET /api/bookings/my
        // If your backend uses a different route, change ONLY this URL.
        const bRes = await axios.get(`${apiBase}/api/bookings/my`, { headers });
        const list: Booking[] = Array.isArray(bRes.data) ? bRes.data : bRes.data?.bookings || [];
        setBookings(list);
      } catch (e: any) {
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
      .filter((b) => activeStatuses.has((b.status || "").toLowerCase()))
      .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime()); // soonest first

    const completed = sorted.find((b) => (b.status || "").toLowerCase() === "completed") || null;

    return { active: activeList, lastCompleted: completed };
  }, [bookings]);

  return (
    <div>
      <h2 className="text-xl sm:text-2xl font-semibold text-[#313234] mb-6 sm:mb-10">
        My bookings
      </h2>

      {/* Top help bar */}
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
          </div>

          <div className="flex flex-col sm:flex-row gap-3">
            <a
              href="https://buy.stripe.com/eVq8wO3W98O03NL3ASawo00"
              target="_blank"
              rel="noreferrer"
              className="inline-flex items-center justify-center px-4 py-3 rounded-[14px] bg-white border border-[#C5CBD8] text-[#313234] font-semibold hover:bg-[#f8f9ff] transition"
            >
              Leave a tip ❤️
            </a>
            <a
              href="https://maps.app.goo.gl/Zgf97uUDCh6HBK5o8"
              target="_blank"
              rel="noreferrer"
              className="inline-flex items-center justify-center px-4 py-3 rounded-[14px] bg-[#306EEC] text-white font-semibold hover:bg-[#2557C7] transition"
            >
              Leave a Google review ⭐
            </a>
          </div>
        </div>

        <div className="mt-3 text-xs text-[#6A6D71]">
          Thank you for supporting your Fixter tech — tips and reviews help a lot.
        </div>
      </div>

      {/* Loading / Error */}
      {loading && (
        <div className="text-[#6A6D71] text-sm">Loading your bookings...</div>
      )}
      {!loading && error && (
        <div className="text-red-600 text-sm bg-red-50 border border-red-200 rounded-lg p-3">
          {error}
        </div>
      )}

      {!loading && !error && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* ACTIVE */}
          <div
            className="bg-white border border-[#C5CBD8] rounded-[14px] p-4 sm:p-6"
            style={{ boxShadow: "0px 0px 200px 0px rgba(0,0,0,0.08)" }}
          >
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg sm:text-xl font-semibold text-[#313234]">
                Active bookings
              </h3>
              <span className="text-sm text-[#6A6D71]">
                {active.length} total
              </span>
            </div>

            {active.length === 0 ? (
              <div className="text-[#6A6D71] text-sm">
                No active bookings right now.
              </div>
            ) : (
              <div className="space-y-4">
                {active.map((b) => {
                  const addr = formatAddress(b);
                  return (
                    <div
                      key={b._id}
                      className="bg-[#EEF2FF] border border-[#C5CBD8] rounded-[14px] p-4"
                    >
                      <div className="flex items-start justify-between gap-3">
                        <div>
                          <div className="font-semibold text-[#313234]">
                            Booking #{b.bookingNumber || b._id.slice(-6)}
                          </div>
                          <div className="text-sm text-[#6A6D71] mt-1">
                            {formatNY(b.date)}
                          </div>
                        </div>
                        <span
                          className={`px-3 py-1 rounded-[12px] text-xs font-semibold border ${statusBadge(
                            b.status
                          )}`}
                        >
                          {b.status}
                        </span>
                      </div>

                      <div className="mt-3 grid grid-cols-1 sm:grid-cols-2 gap-3">
                        <div className="bg-white rounded-[12px] border border-[#C5CBD8] p-3">
                          <div className="text-xs font-semibold text-[#6A6D71] uppercase">
                            Service
                          </div>
                          <div className="font-semibold text-[#313234]">
                            {b.service || "—"}
                          </div>
                        </div>
                        <div className="bg-white rounded-[12px] border border-[#C5CBD8] p-3">
                          <div className="text-xs font-semibold text-[#6A6D71] uppercase">
                            Plan
                          </div>
                          <div className="font-semibold text-[#313234] capitalize">
                            {(b.subscription || me?.subscription || "—") as any}
                          </div>
                        </div>
                      </div>

                      {addr && (
                        <div className="mt-3 bg-white rounded-[12px] border border-[#C5CBD8] p-3">
                          <div className="text-xs font-semibold text-[#6A6D71] uppercase">
                            Address
                          </div>
                          <div className="text-sm text-[#313234] mt-1">
                            {addr}
                          </div>
                        </div>
                      )}

                      {b.note && (
                        <div className="mt-3 bg-white rounded-[12px] border border-[#C5CBD8] p-3">
                          <div className="text-xs font-semibold text-[#6A6D71] uppercase">
                            Note
                          </div>
                          <div className="text-sm text-[#313234] mt-1 whitespace-pre-wrap">
                            {b.note}
                          </div>
                        </div>
                      )}

                      {b.images?.length ? (
                        <div className="mt-3 bg-white rounded-[12px] border border-[#C5CBD8] p-3">
                          <div className="text-xs font-semibold text-[#6A6D71] uppercase mb-2">
                            Photos ({b.images.length})
                          </div>
                          <Gallery images={b.images} />
                        </div>
                      ) : null}

                      {(b.phone || me?.phone) && (
                        <div className="mt-3 flex items-center justify-between gap-3">
                          <div className="text-sm text-[#6A6D71]">
                            Need help? Call{" "}
                            <a
                              className="text-[#306EEC] font-semibold"
                              href={`tel:${sanitizeTel(b.phone || me?.phone || "")}`}
                            >
                              {b.phone || me?.phone}
                            </a>
                          </div>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          {/* LAST COMPLETED */}
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
              <div className="text-[#6A6D71] text-sm">
                No completed bookings yet.
              </div>
            ) : (
              <div className="bg-[#EEF2FF] border border-[#C5CBD8] rounded-[14px] p-4">
                <div className="font-semibold text-[#313234]">
                  Booking #{lastCompleted.bookingNumber || lastCompleted._id.slice(-6)}
                </div>
                <div className="text-sm text-[#6A6D71] mt-1">
                  {formatNY(lastCompleted.date)}
                </div>

                <div className="mt-3 grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div className="bg-white rounded-[12px] border border-[#C5CBD8] p-3">
                    <div className="text-xs font-semibold text-[#6A6D71] uppercase">
                      Service
                    </div>
                    <div className="font-semibold text-[#313234]">
                      {lastCompleted.service || "—"}
                    </div>
                  </div>
                  <div className="bg-white rounded-[12px] border border-[#C5CBD8] p-3">
                    <div className="text-xs font-semibold text-[#6A6D71] uppercase">
                      Plan
                    </div>
                    <div className="font-semibold text-[#313234] capitalize">
                      {(lastCompleted.subscription || me?.subscription || "—") as any}
                    </div>
                  </div>
                </div>

                {formatAddress(lastCompleted) && (
                  <div className="mt-3 bg-white rounded-[12px] border border-[#C5CBD8] p-3">
                    <div className="text-xs font-semibold text-[#6A6D71] uppercase">
                      Address
                    </div>
                    <div className="text-sm text-[#313234] mt-1">
                      {formatAddress(lastCompleted)}
                    </div>
                  </div>
                )}

                {lastCompleted.note && (
                  <div className="mt-3 bg-white rounded-[12px] border border-[#C5CBD8] p-3">
                    <div className="text-xs font-semibold text-[#6A6D71] uppercase">
                      Note
                    </div>
                    <div className="text-sm text-[#313234] mt-1 whitespace-pre-wrap">
                      {lastCompleted.note}
                    </div>
                  </div>
                )}

                {lastCompleted.images?.length ? (
                  <div className="mt-3 bg-white rounded-[12px] border border-[#C5CBD8] p-3">
                    <div className="text-xs font-semibold text-[#6A6D71] uppercase mb-2">
                      Photos ({lastCompleted.images.length})
                    </div>
                    <Gallery images={lastCompleted.images} />
                  </div>
                ) : null}

                <div className="mt-4 flex flex-col sm:flex-row gap-3">
                  <a
                    href="https://buy.stripe.com/eVq8wO3W98O03NL3ASawo00"
                    target="_blank"
                    rel="noreferrer"
                    className="inline-flex items-center justify-center px-4 py-3 rounded-[14px] bg-white border border-[#C5CBD8] text-[#313234] font-semibold hover:bg-[#f8f9ff] transition"
                  >
                    Say thanks with a tip ❤️
                  </a>
                  <a
                    href="https://maps.app.goo.gl/Zgf97uUDCh6HBK5o8"
                    target="_blank"
                    rel="noreferrer"
                    className="inline-flex items-center justify-center px-4 py-3 rounded-[14px] bg-[#306EEC] text-white font-semibold hover:bg-[#2557C7] transition"
                  >
                    Leave a review ⭐
                  </a>
                </div>

                <div className="mt-3 text-xs text-[#6A6D71]">
                  Thank you for choosing Mr. Fixter — we appreciate you.
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Bottom CTA */}
      {!loading && !error && (
        <div className="mt-6 text-sm text-[#6A6D71]">
          Need a new visit? Go to{" "}
          <a className="text-[#306EEC] font-semibold" href="/#pick-day">
            Pick day
          </a>{" "}
          and book your next appointment.
        </div>
      )}
    </div>
  );
}
