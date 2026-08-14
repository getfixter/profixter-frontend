"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { useAuth } from "@/lib/useAuth";
import { compressImage } from "@/lib/compressImage";
import { trackEvent, trackInitiateCheckout } from "@/lib/analytics";
import {
  bookIncludedFullDay,
  createFullDayCheckout,
  getFullDayAvailability,
  getFullDayConfig,
  getFullDayEligibility,
  type FullDayAvailabilityDay,
  type FullDayConfig,
  type FullDayEligibility,
} from "@/lib/booking-service";
import type { Address } from "@/lib/auth-service";

/**
 * Full Day Fixter: one Fixter, one day, the whole list.
 *
 * The whole panel turns on one question the customer cannot answer for
 * themselves: is this day included with their plan or is it $499. That is a
 * server answer, because it depends on their billing period and on whether they
 * have already used this period's day, so nothing here guesses from the plan
 * name. Until the answer arrives the panel shows the price, which is the
 * honest default: worst case a member is briefly shown a price and then told it
 * is included, never the other way round.
 */

const FALLBACK_CONFIG: FullDayConfig = {
  enabled: true,
  priceCents: 49900,
  currency: "usd",
  approximateHours: 8,
  holdMinutes: 30,
  cancellationPhone: "631-599-1363",
};

/** Where a visitor comes back to after signing in. */
const RETURN_PATH = "/book?visit=full-day";

const BIGGER_JOBS = [
  "Kitchen remodeling",
  "Bathroom remodeling",
  "Roofing",
  "Siding",
  "Larger renovations",
];

function formatYMD(date: Date) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(
    date.getDate()
  ).padStart(2, "0")}`;
}

function monthKeyOf(date: Date) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}`;
}

function monthLabel(date: Date) {
  return date.toLocaleDateString("en-US", { month: "long", year: "numeric" });
}

function dayLabel(value: string) {
  const [year, month, day] = value.split("-").map(Number);
  if (!Number.isFinite(year)) return value;
  return new Date(year, month - 1, day).toLocaleDateString("en-US", {
    weekday: "long",
    month: "long",
    day: "numeric",
  });
}

function formatTime12(value: string) {
  const [hh, mm] = value.split(":").map(Number);
  if (!Number.isFinite(hh) || !Number.isFinite(mm)) return value;
  const period = hh >= 12 ? "PM" : "AM";
  return `${hh % 12 || 12}:${String(mm).padStart(2, "0")} ${period}`;
}

function formatPrice(cents: number, currency = "usd") {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: currency.toUpperCase(),
    maximumFractionDigits: cents % 100 === 0 ? 0 : 2,
  }).format(Math.max(0, cents) / 100);
}

function addressLabel(address: Address) {
  return `${address.label ? `${address.label}: ` : ""}${address.line1}, ${address.city} ${address.state} ${address.zip}`;
}

function calendarGrid(month: Date) {
  const first = new Date(month.getFullYear(), month.getMonth(), 1);
  const start = new Date(first);
  start.setDate(first.getDate() - first.getDay());
  return Array.from({ length: 42 }, (_, index) => {
    const date = new Date(start);
    date.setDate(start.getDate() + index);
    return {
      date,
      ymd: formatYMD(date),
      muted: date.getMonth() !== month.getMonth(),
    };
  });
}

function monthRange(month: Date) {
  const first = new Date(month.getFullYear(), month.getMonth(), 1);
  const last = new Date(month.getFullYear(), month.getMonth() + 1, 0);
  return { from: formatYMD(first), to: formatYMD(last) };
}

export default function FullDayVisitPanel() {
  const { user, isAuthenticated, isLoading } = useAuth();
  const addresses = useMemo(() => user?.addresses ?? [], [user?.addresses]);

  const [config, setConfig] = useState<FullDayConfig>(FALLBACK_CONFIG);
  const [eligibility, setEligibility] = useState<FullDayEligibility | null>(null);
  const [addressId, setAddressId] = useState("");
  const [month, setMonth] = useState(() => {
    const now = new Date();
    return new Date(now.getFullYear(), now.getMonth(), 1);
  });
  const [daysByDate, setDaysByDate] = useState<Record<string, FullDayAvailabilityDay>>({});
  const [loadingMonth, setLoadingMonth] = useState(false);
  const [selectedDate, setSelectedDate] = useState("");
  const [note, setNote] = useState("");
  const [photos, setPhotos] = useState<File[]>([]);
  const [error, setError] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [booked, setBooked] = useState<{ bookingNumber: string; date: string } | null>(null);
  const cameraInputRef = useRef<HTMLInputElement | null>(null);
  const galleryInputRef = useRef<HTMLInputElement | null>(null);
  const loadedMonths = useRef<Set<string>>(new Set());

  useEffect(() => {
    trackEvent("book_started", { page: "/book", visit: "full-day" });
  }, []);

  useEffect(() => {
    let cancelled = false;
    getFullDayConfig()
      .then((data) => {
        if (!cancelled) setConfig(data);
      })
      .catch(() => {
        if (!cancelled) setConfig(FALLBACK_CONFIG);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    if (!addressId && user?.defaultAddressId) setAddressId(String(user.defaultAddressId));
    else if (!addressId && addresses[0]?._id) setAddressId(String(addresses[0]._id));
  }, [addressId, addresses, user?.defaultAddressId]);

  useEffect(() => {
    if (!isAuthenticated || !addressId) {
      setEligibility(null);
      return;
    }
    let cancelled = false;
    getFullDayEligibility(addressId)
      .then((data) => {
        if (!cancelled) setEligibility(data);
      })
      .catch(() => {
        if (!cancelled) setEligibility(null);
      });
    return () => {
      cancelled = true;
    };
  }, [isAuthenticated, addressId]);

  // Availability is public: a visitor should be able to see which days are open
  // before being asked to make an account.
  useEffect(() => {
    const key = monthKeyOf(month);
    if (loadedMonths.current.has(key)) return;
    loadedMonths.current.add(key);

    let cancelled = false;
    const { from, to } = monthRange(month);
    setLoadingMonth(true);
    getFullDayAvailability(from, to)
      .then((data) => {
        if (cancelled) return;
        setDaysByDate((current) => {
          const next = { ...current };
          for (const day of data.days || []) next[day.date] = day;
          return next;
        });
      })
      .catch(() => {
        if (!cancelled) loadedMonths.current.delete(key);
      })
      .finally(() => {
        if (!cancelled) setLoadingMonth(false);
      });

    return () => {
      cancelled = true;
    };
  }, [month]);

  const photoUrls = useMemo(() => photos.map((file) => URL.createObjectURL(file)), [photos]);
  useEffect(() => {
    return () => photoUrls.forEach((url) => URL.revokeObjectURL(url));
  }, [photoUrls]);

  const today = formatYMD(new Date());
  const grid = useMemo(() => calendarGrid(month), [month]);
  const selectedAddress = addresses.find((address) => String(address._id) === String(addressId));
  const selectedDay = selectedDate ? daysByDate[selectedDate] : undefined;
  const wordCount = note.trim().split(/\s+/).filter(Boolean).length;
  const priceLabel = formatPrice(config.priceCents, config.currency);
  const included = !!eligibility?.includedAvailable;

  async function handleFiles(files: FileList | null) {
    if (!files) return;
    const next: File[] = [];
    for (const file of Array.from(files)) next.push(await compressImage(file));
    setPhotos((current) => [...current, ...next].slice(0, 10));
  }

  async function submit() {
    setError("");
    if (!config.enabled) {
      setError("Full Day booking is temporarily unavailable.");
      return;
    }
    if (!addressId) {
      setError("Choose an address for the day.");
      return;
    }
    if (!selectedDate) {
      setError("Choose an available day.");
      return;
    }
    if (wordCount < 3) {
      setError("Tell us what you would like done, in at least a few words.");
      return;
    }

    setSubmitting(true);
    try {
      const payload = { addressId, date: selectedDate, note: note.trim(), images: photos };
      if (included) {
        trackEvent("full_day_included_booking_started", { date: selectedDate });
        const result = await bookIncludedFullDay(payload);
        setBooked({ bookingNumber: result.bookingNumber, date: selectedDate });
        // The benefit is spent, so the panel must stop offering it.
        setEligibility((current) =>
          current ? { ...current, includedAvailable: false, includedUsed: true } : current
        );
      } else {
        trackInitiateCheckout({
          product: "full_day_visit",
          selectedTask: "Full Day Fixter",
          price: config.priceCents / 100,
        });
        trackEvent("full_day_checkout_started", { date: selectedDate });
        const result = await createFullDayCheckout(payload);
        window.location.href = result.url;
        return;
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unable to book your Full Day.");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <section className="mx-auto w-full max-w-[1280px] px-4 pb-16 pt-5 sm:px-6 sm:pb-20 sm:pt-8 lg:px-8">
      <div className="max-w-[820px]">
        <p className="text-[11px] font-bold uppercase tracking-[0.18em] text-[#306EEC]">
          Full Day Fixter
        </p>
        <h1 className="mt-2 text-[26px] font-semibold leading-[1.1] tracking-[-0.035em] text-[#0B1628] sm:text-[32px]">
          One Fixter. Your whole list. One day.
        </h1>
        <p className="mt-3 text-[15px] leading-6 text-[#4A5462] sm:text-[17px] sm:leading-7">
          Approximately {config.approximateHours} hours with one Fixter, working
          through as many small jobs as the day allows. Best for the list that
          has been building up rather than a single repair.
        </p>
      </div>

      {/*
        Three plain facts, in the order they get asked. A card grid here would
        have dressed up an answer that is three short sentences long.
      */}
      <div className="mt-6 max-w-[820px] overflow-hidden rounded-[8px] border border-[#E4E9F2]">
        {[
          { label: "How long", value: `About ${config.approximateHours} hours` },
          { label: "Who comes", value: "One Fixter, yours for the day" },
          {
            label: "Price",
            value: included
              ? "Included with your Elite membership"
              : `${priceLabel} for the day`,
          },
        ].map((row) => (
          <div
            key={row.label}
            className="flex items-baseline justify-between gap-3 border-b border-[#EDF1F7] px-4 py-3.5 last:border-b-0"
          >
            <span className="text-[13px] text-[#6E6E73]">{row.label}</span>
            <span className="text-right text-[15px] font-semibold text-[#0B1628]">
              {row.value}
            </span>
          </div>
        ))}
      </div>

      {/*
        The Elite benefit, stated once and only to people it applies to. The
        "already used" version names the date it comes back rather than saying
        "next period", which is a phrase only a billing system understands.
      */}
      {eligibility?.includedAvailable ? (
        <div className="mt-4 max-w-[820px] rounded-[8px] border border-[#D9E7D2] bg-[#F4F9F1] px-4 py-3.5">
          <p className="text-[14px] font-semibold text-[#1E4620]">
            Included with your Elite membership
          </p>
          <p className="mt-1 text-[13px] leading-5 text-[#41603F]">
            Elite includes one Full Day each billing period. This one is on your
            plan, so there is nothing to pay.
          </p>
        </div>
      ) : eligibility?.includedUsed ? (
        <div className="mt-4 max-w-[820px] rounded-[8px] border border-[#E4E9F2] bg-[#F8FAFF] px-4 py-3.5">
          <p className="text-[14px] font-semibold text-[#0B1628]">
            You have used this period&apos;s included Full Day
          </p>
          <p className="mt-1 text-[13px] leading-5 text-[#4A5462]">
            Your next included Full Day
            {eligibility.periodEnd
              ? ` becomes available on ${dayLabel(eligibility.periodEnd.slice(0, 10))}`
              : " becomes available when your next billing period starts"}
            . You can book another today for {priceLabel}.
          </p>
        </div>
      ) : null}

      {booked ? (
        <div className="mt-6 max-w-[820px] rounded-[8px] border border-[#D9E7D2] bg-[#F4F9F1] px-4 py-4">
          <p className="text-[15px] font-semibold text-[#1E4620]">
            Your Full Day is booked for {dayLabel(booked.date)}.
          </p>
          <p className="mt-1 text-[13px] leading-5 text-[#41603F]">
            Booking #{booked.bookingNumber}. We have emailed the details. You can
            see it any time under{" "}
            <Link href="#your-visits" className="font-semibold underline underline-offset-2">
              My Visits
            </Link>
            .
          </p>
        </div>
      ) : null}

      {!booked && (
        <div className="mt-8 grid max-w-[1100px] grid-cols-1 gap-4 lg:grid-cols-12 lg:gap-6">
          {/* Calendar */}
          <div className="lg:col-span-5">
            <div className="rounded-[8px] border border-[#E5E9F2] bg-white p-2 shadow-[0_10px_30px_rgba(15,23,42,0.05)] sm:p-4">
              <div className="mb-2 flex items-center justify-between">
                <button
                  type="button"
                  aria-label="Previous month"
                  onClick={() =>
                    setMonth(new Date(month.getFullYear(), month.getMonth() - 1, 1))
                  }
                  // A standalone control, so it gets a full 44px target rather
                  // than the tighter geometry the day grid has to live with.
                  className="grid h-11 w-11 place-items-center rounded-[6px] border border-[#E5E9F2] bg-[#F8FAFF] text-[13px] text-[#475569] transition hover:border-[#D9E4FF] hover:bg-[#EEF5FF]"
                >
                  &lt;
                </button>
                <div className="text-[13px] font-extrabold text-[#0B1628] sm:text-[17px]">
                  {monthLabel(month)}
                </div>
                <button
                  type="button"
                  aria-label="Next month"
                  onClick={() =>
                    setMonth(new Date(month.getFullYear(), month.getMonth() + 1, 1))
                  }
                  // A standalone control, so it gets a full 44px target rather
                  // than the tighter geometry the day grid has to live with.
                  className="grid h-11 w-11 place-items-center rounded-[6px] border border-[#E5E9F2] bg-[#F8FAFF] text-[13px] text-[#475569] transition hover:border-[#D9E4FF] hover:bg-[#EEF5FF]"
                >
                  &gt;
                </button>
              </div>

              <div className="grid grid-cols-7 text-center">
                {["Su", "Mo", "Tu", "We", "Th", "Fr", "Sa"].map((day, index) => (
                  <div
                    key={day}
                    className={`text-[9px] font-bold sm:text-[11px] ${index === 0 ? "text-[#EF4444]" : "text-[#94A3B8]"}`}
                  >
                    {day}
                  </div>
                ))}
              </div>

              <div className="grid grid-cols-7">
                {grid.map((cell) => {
                  const day = daysByDate[cell.ymd];
                  // Unknown days stay disabled rather than optimistic: offering
                  // a day we have not checked would sell one we may not have.
                  const disabled = cell.ymd < today || !day?.available;
                  const selected = cell.ymd === selectedDate;
                  return (
                    <button
                      key={cell.ymd}
                      type="button"
                      disabled={disabled}
                      title={day && !day.available ? day.reason : undefined}
                      onClick={() => {
                        setError("");
                        setSelectedDate(cell.ymd);
                      }}
                      className={[
                        // 40px at every width. Seven of these plus the card
                        // padding is 296px, so it fits at 375 without the
                        // 28px squeeze the older calendar settles for.
                        "mx-auto grid h-10 w-10 place-items-center rounded-[6px] text-[13px] font-semibold transition-all duration-150 sm:text-[14px]",
                        cell.muted ? "text-[#C5CBD8]" : "",
                        disabled ? "cursor-not-allowed text-[#C5CBD8]" : "",
                        !disabled && !selected
                          ? "bg-[#EEF5FF] text-[#1D4ED8] hover:bg-[#DBEAFE]"
                          : "",
                        selected
                          ? "bg-[#306EEC] text-white shadow-[0_8px_24px_rgba(48,110,236,0.35)]"
                          : "",
                      ].join(" ")}
                    >
                      {cell.date.getDate()}
                    </button>
                  );
                })}
              </div>

              <p className="mt-3 border-t border-[#EDF1F7] pt-3 text-[12px] leading-4 text-[#6E6E73]">
                {loadingMonth
                  ? "Checking which days are free..."
                  : "Only days where one Fixter is free from start to finish can be booked."}
              </p>
            </div>
          </div>

          {/* Details */}
          <div className="flex flex-col gap-4 lg:col-span-7">
            {isLoading ? (
              <div className="rounded-[8px] border border-[#E5E9F2] bg-white p-6 text-center text-[14px] font-semibold text-[#64748B]">
                Loading your account...
              </div>
            ) : !isAuthenticated ? (
              /*
                A visitor can read everything above and pick a day; this is the
                one wall, and it is at the last step rather than the first. The
                return path is carried so signing in lands them back here.
              */
              <div className="rounded-[8px] border border-[#E5E9F2] bg-white p-5 shadow-[0_10px_30px_rgba(15,23,42,0.05)]">
                <h2 className="text-[16px] font-semibold text-[#0B1628]">
                  Log in to book your Full Day
                </h2>
                <p className="mt-1.5 text-[13.5px] leading-5 text-[#4A5462]">
                  We need a home profile for your address, photos, reminders and
                  booking history. It takes a minute, and you will come straight
                  back here.
                </p>
                <div className="mt-4 flex flex-col gap-2 sm:flex-row">
                  <Link
                    href={`/signin?next=${encodeURIComponent(RETURN_PATH)}`}
                    onClick={() => trackEvent("full_day_login_prompted", { action: "signin" })}
                    className="inline-flex min-h-[46px] items-center justify-center rounded-[8px] bg-[#306EEC] px-6 text-[15px] font-semibold text-white transition hover:bg-[#2558C9] sm:min-w-[160px]"
                  >
                    Log In
                  </Link>
                  <Link
                    href={`/signup?next=${encodeURIComponent(RETURN_PATH)}`}
                    onClick={() => trackEvent("full_day_login_prompted", { action: "signup" })}
                    className="inline-flex min-h-[46px] items-center justify-center rounded-[8px] border border-[#D7DEE9] bg-white px-6 text-[15px] font-semibold text-[#0B1628] transition hover:bg-[#F8FAFF]"
                  >
                    Create Account
                  </Link>
                </div>
              </div>
            ) : (
              <>
                <div className="rounded-[8px] border border-[#E5E9F2] bg-white p-3 shadow-[0_10px_30px_rgba(15,23,42,0.05)] sm:p-4">
                  <h2 className="mb-2 text-[13px] font-extrabold text-[#0B1628] sm:text-[15px]">
                    Where
                  </h2>
                  <select
                    value={addressId}
                    onChange={(event) => setAddressId(event.target.value)}
                    aria-label="Full Day address"
                    className="min-h-11 w-full rounded-[6px] border border-[#C5CBD8] bg-[#F8FAFF] px-2 text-[13px] font-semibold text-[#0B1628] outline-none transition focus:border-[#306EEC] focus:ring-4 focus:ring-[#306EEC]/15"
                  >
                    <option value="">Choose address</option>
                    {addresses.map((address) => (
                      <option key={address._id} value={address._id}>
                        {addressLabel(address)}
                      </option>
                    ))}
                  </select>
                  {!addresses.length && (
                    <Link
                      href="/account?tab=personal"
                      className="mt-2 inline-flex text-[13px] font-bold text-[#306EEC]"
                    >
                      Add an address in your account -&gt;
                    </Link>
                  )}
                </div>

                <div className="rounded-[8px] border border-[#E5E9F2] bg-white p-3 shadow-[0_10px_30px_rgba(15,23,42,0.05)] sm:p-4">
                  <h2 className="mb-1 text-[13px] font-extrabold text-[#0B1628] sm:text-[15px]">
                    Your list
                  </h2>
                  <p className="mb-2 text-[12px] leading-4 text-[#6E6E73]">
                    List everything you would like done. Your Fixter works down
                    it in the order you give, so put the important ones first.
                  </p>
                  <textarea
                    value={note}
                    onChange={(event) => setNote(event.target.value)}
                    rows={5}
                    placeholder={
                      "Mount TV in the den\nReplace two light fixtures\nFix the sticking back door\nPatch and paint the hallway"
                    }
                    className="min-h-[110px] w-full resize-y rounded-[6px] border border-[#C5CBD8] bg-[#F8FAFF] p-2.5 text-[13.5px] text-[#0B1628] outline-none transition placeholder:text-[#94A3B8] focus:border-[#306EEC] focus:ring-4 focus:ring-[#306EEC]/15"
                  />

                  <div className="mt-3">
                    <div className="mb-1.5 text-[11px] font-semibold text-[#6E6E73]">
                      Photos help your Fixter arrive with the right parts. Optional.
                    </div>
                    <div className="flex gap-2">
                      <button
                        type="button"
                        onClick={() => cameraInputRef.current?.click()}
                        className="flex h-11 flex-1 items-center justify-center rounded-[6px] border border-[#C5CBD8] bg-[#F8FAFF] text-[12.5px] font-semibold text-[#475569] transition hover:border-[#306EEC] hover:bg-white hover:text-[#306EEC]"
                      >
                        Take Photo
                      </button>
                      <button
                        type="button"
                        onClick={() => galleryInputRef.current?.click()}
                        className="flex h-11 flex-1 items-center justify-center rounded-[6px] border border-[#C5CBD8] bg-[#F8FAFF] text-[12.5px] font-semibold text-[#475569] transition hover:border-[#306EEC] hover:bg-white hover:text-[#306EEC]"
                      >
                        Choose Photos{photos.length > 0 ? ` (${photos.length})` : ""}
                      </button>
                    </div>
                    <input
                      ref={cameraInputRef}
                      type="file"
                      accept="image/*"
                      capture="environment"
                      onChange={(event) => {
                        handleFiles(event.target.files);
                        event.currentTarget.value = "";
                      }}
                      className="hidden"
                    />
                    <input
                      ref={galleryInputRef}
                      type="file"
                      accept="image/*"
                      multiple
                      onChange={(event) => {
                        handleFiles(event.target.files);
                        event.currentTarget.value = "";
                      }}
                      className="hidden"
                    />
                    {photos.length > 0 && (
                      <div className="mt-3 grid grid-cols-3 gap-2 sm:grid-cols-4 lg:grid-cols-5">
                        {photos.map((photo, index) => (
                          <div
                            key={`${photo.name}-${index}`}
                            className="relative overflow-hidden rounded-[8px] border border-[#E5E9F2] bg-[#F8FAFF]"
                            style={{ aspectRatio: "1" }}
                          >
                            {/* eslint-disable-next-line @next/next/no-img-element */}
                            <img
                              src={photoUrls[index] || ""}
                              alt={`Job photo ${index + 1}`}
                              className="h-full w-full object-cover"
                            />
                            <button
                              type="button"
                              onClick={() =>
                                setPhotos((current) =>
                                  current.filter((_, photoIndex) => photoIndex !== index)
                                )
                              }
                              aria-label="Remove photo"
                              className="absolute right-1.5 top-1.5 flex h-6 w-6 items-center justify-center rounded-full bg-black/60 text-[12px] font-bold leading-none text-white transition hover:bg-black/75"
                            >
                              &times;
                            </button>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                </div>

                <div className="rounded-[8px] border border-[#E5E9F2] bg-white p-3 shadow-[0_10px_30px_rgba(15,23,42,0.05)] sm:p-4">
                  <h2 className="mb-2 text-[13px] font-extrabold text-[#0B1628] sm:text-[15px]">
                    Summary
                  </h2>
                  <div className="grid gap-1.5 text-[12.5px] text-[#475569]">
                    <div className="flex justify-between gap-2 rounded-[6px] bg-[#F8FAFF] px-2.5 py-2">
                      <span>Day</span>
                      <strong className="text-right text-[#0B1628]">
                        {selectedDate ? dayLabel(selectedDate) : "Not selected"}
                      </strong>
                    </div>
                    {selectedDay?.startTime && selectedDay?.endTime ? (
                      <div className="flex justify-between gap-2 rounded-[6px] bg-[#F8FAFF] px-2.5 py-2">
                        <span>Hours</span>
                        <strong className="text-right text-[#0B1628]">
                          {formatTime12(selectedDay.startTime)} to{" "}
                          {formatTime12(selectedDay.endTime)}
                        </strong>
                      </div>
                    ) : null}
                    <div className="flex justify-between gap-2 rounded-[6px] bg-[#F8FAFF] px-2.5 py-2">
                      <span>Price</span>
                      <strong className="text-right text-[#0B1628]">
                        {included ? "Included with Elite" : priceLabel}
                      </strong>
                    </div>
                    {selectedAddress && (
                      <div className="truncate rounded-[6px] bg-[#F8FAFF] px-2.5 py-2 font-semibold text-[#64748B]">
                        {addressLabel(selectedAddress)}
                      </div>
                    )}
                  </div>

                  <p className="mt-2 text-[11.5px] leading-4 text-[#6E6E73]">
                    Materials are separate. Full Days are for multiple small
                    jobs, not renovation work.
                  </p>

                  {error && (
                    <div className="mt-2 rounded-[6px] border border-red-200 bg-red-50 px-2.5 py-2 text-[12.5px] font-semibold text-red-700">
                      {error}
                    </div>
                  )}

                  <button
                    type="button"
                    onClick={submit}
                    disabled={submitting || !config.enabled}
                    className="mt-3 h-12 w-full rounded-[8px] bg-[#306EEC] text-[14.5px] font-semibold text-white transition hover:bg-[#2558C9] disabled:cursor-not-allowed disabled:opacity-50"
                  >
                    {submitting
                      ? included
                        ? "Booking your day..."
                        : "Opening secure checkout..."
                      : !config.enabled
                        ? "Booking temporarily unavailable"
                        : included
                          ? "Book my included Full Day"
                          : `Continue to payment - ${priceLabel}`}
                  </button>
                </div>
              </>
            )}
          </div>
        </div>
      )}

      {/*
        The honest boundary of the product. Someone reading "one Fixter for a
        whole day" may well be thinking about a kitchen, and a Full Day is the
        wrong thing to sell them. Naming the work we do instead is more useful
        than a disclaimer saying what a Full Day is not.
      */}
      <div className="mt-10 max-w-[820px] rounded-[8px] border border-[#D9E4FF] bg-[#F4F8FF] px-4 py-4 sm:px-5 sm:py-5">
        <h2 className="text-[16px] font-semibold text-[#0B1628]">
          Planning something bigger?
        </h2>
        <p className="mt-1.5 text-[13.5px] leading-5 text-[#4A5462]">
          A Full Day is for a list of small jobs. Larger work is a project, and
          projects start with an estimate.
        </p>
        <ul className="mt-3 flex flex-wrap gap-x-4 gap-y-1.5">
          {BIGGER_JOBS.map((job) => (
            <li key={job} className="text-[13px] font-semibold text-[#0B1628]">
              {job}
            </li>
          ))}
        </ul>
        <Link
          href="/projects#estimate"
          onClick={() => trackEvent("estimate_cta_clicked", { placement: "book_full_day" })}
          className="mt-4 inline-flex min-h-[44px] items-center justify-center rounded-[8px] bg-[#0B1628] px-5 text-[14px] font-semibold text-white transition hover:bg-[#172033]"
        >
          Request Project Estimate
        </Link>
      </div>

      <p className="mt-6 max-w-[820px] text-[13px] leading-5 text-[#6E6E73]">
        Changes to a booked Full Day are handled by phone. Call{" "}
        {config.cancellationPhone}.
      </p>
    </section>
  );
}
