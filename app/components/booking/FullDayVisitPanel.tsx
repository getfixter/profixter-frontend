"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { useAuth } from "@/lib/useAuth";
import { useAddHome } from "@/app/components/address/AddHomeSheet";
import { useContactCompletion } from "@/app/components/auth/ContactCompletion";
import { useServiceTextsOptIn } from "@/app/components/booking/ServiceTextsOptIn";
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
import PhotoLibraryPicker from "@/app/components/booking/PhotoLibraryPicker";

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
  const { requestHome, homeSheet } = useAddHome();
  const { ensureContact, contactSheet } = useContactCompletion();
  const { serviceTextsOptIn, applyServiceTextsOptIn } = useServiceTextsOptIn();
  const [month, setMonth] = useState(() => {
    const now = new Date();
    return new Date(now.getFullYear(), now.getMonth(), 1);
  });
  const [daysByDate, setDaysByDate] = useState<Record<string, FullDayAvailabilityDay>>({});
  const [loadingMonth, setLoadingMonth] = useState(false);
  const [selectedDate, setSelectedDate] = useState("");
  const [note, setNote] = useState("");
  const [photos, setPhotos] = useState<File[]>([]);
  // Optional, like photos on a Full Day: the closest Profixter Library example.
  const [libraryReference, setLibraryReference] = useState("");
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

    if (!(await ensureContact())) return;

    setSubmitting(true);
    try {
      const payload = {
        addressId,
        date: selectedDate,
        note: note.trim(),
        images: photos,
        libraryReference: libraryReference || undefined,
      };
      if (included) {
        trackEvent("full_day_included_booking_started", { date: selectedDate });
        const result = await bookIncludedFullDay(payload);
        /* Only now, with the day booked: the box is never a condition of it. */
        await applyServiceTextsOptIn();
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
        await applyServiceTextsOptIn();
        window.location.href = result.url;
        return;
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unable to book your Full Day.");
    } finally {
      setSubmitting(false);
    }
  }

  const changeMonth = (delta: number) => setMonth(new Date(month.getFullYear(), month.getMonth() + delta, 1));

  return (
    <section className="ui-container pg-book__head pb-10 sm:pb-14">
      <div className="max-w-[720px]">
        <p className="ui-eyebrow ui-eyebrow--accent">Full Day Fixter</p>
        <h1 className="pg-book__title">One Fixter. Your whole list. One day.</h1>
        <p className="pg-book__sub">
          Approximately {config.approximateHours} hours with one Fixter, working
          through as many small jobs as the day allows.
        </p>
        {/* Three plain facts, in the order they get asked. */}
        <ul className="pg-facts mt-3 !text-[14px]">
          <li>About {config.approximateHours} hours</li>
          <li>One Fixter, yours for the day</li>
          <li className="font-semibold text-[color:var(--ui-ink)]">
            {included ? "Included with your Elite membership" : `${priceLabel} for the day`}
          </li>
        </ul>
      </div>

      {/*
        The Elite benefit, stated once and only to people it applies to. The
        "already used" version names the date it comes back rather than saying
        "next period", which is a phrase only a billing system understands.
      */}
      {eligibility?.includedAvailable ? (
        <div className="mt-4 max-w-[720px] rounded-[var(--ui-r-md)] border border-[#cfe8d8] bg-[#f2faf5] px-4 py-3">
          <p className="text-[14px] font-semibold text-[#1f6b3d]">Included with your Elite membership</p>
          <p className="mt-0.5 text-[14px] leading-5 text-[#2f5d40]">
            Elite includes one Full Day each billing period. This one is on your
            plan, so there is nothing to pay.
          </p>
        </div>
      ) : eligibility?.includedUsed ? (
        <div className="mt-4 max-w-[720px] rounded-[var(--ui-r-md)] border border-[color:var(--ui-line)] bg-white px-4 py-3">
          <p className="text-[14px] font-semibold text-[color:var(--ui-ink)]">
            You have used this period&apos;s included Full Day
          </p>
          <p className="mt-0.5 text-[14px] leading-5 text-[color:var(--ui-text-2)]">
            Your next included Full Day
            {eligibility.periodEnd
              ? ` becomes available on ${dayLabel(eligibility.periodEnd.slice(0, 10))}`
              : " becomes available when your next billing period starts"}
            . You can book another today for {priceLabel}.
          </p>
        </div>
      ) : null}

      {booked ? (
        <div className="mt-5 max-w-[720px] rounded-[var(--ui-r-md)] border border-[#cfe8d8] bg-[#f2faf5] px-4 py-4">
          <p className="text-[15px] font-semibold text-[#1f6b3d]">
            Your Full Day is booked for {dayLabel(booked.date)}.
          </p>
          <p className="mt-1 text-[14px] leading-5 text-[#2f5d40]">
            Booking #{booked.bookingNumber}. We have emailed the details. You can
            see it any time under{" "}
            <Link href="#your-visits" className="font-semibold underline underline-offset-2">
              My Visits
            </Link>
            . Changes are handled by phone: {config.cancellationPhone}.
          </p>
        </div>
      ) : null}

      {!booked && (
        <div className="mt-5 grid grid-cols-[minmax(0,1fr)] gap-3 sm:mt-6 sm:gap-4 lg:grid-cols-[minmax(0,1fr)_minmax(0,400px)] lg:items-start lg:gap-6">
          <div className="grid grid-cols-[minmax(0,1fr)] gap-3 sm:gap-4">
            {/* Calendar */}
            <div className="pg-panel">
              <h2 className="pg-panel__title">Pick a day</h2>
              <div className="pg-cal__head">
                <button type="button" aria-label="Previous month" onClick={() => changeMonth(-1)} className="pg-cal__nav">
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" aria-hidden="true"><path d="M15 6l-6 6 6 6" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" /></svg>
                </button>
                <div className="pg-cal__month">{monthLabel(month)}</div>
                <button type="button" aria-label="Next month" onClick={() => changeMonth(1)} className="pg-cal__nav">
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" aria-hidden="true"><path d="M9 6l6 6-6 6" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" /></svg>
                </button>
              </div>

              <div className="pg-cal__wd" aria-hidden="true">
                {["S", "M", "T", "W", "T", "F", "S"].map((day, index) => (
                  <div key={`${day}-${index}`}>{day}</div>
                ))}
              </div>

              <div className="pg-cal__grid">
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
                        "pg-cal__day",
                        cell.muted ? "is-muted" : "",
                        selected ? "is-selected" : !disabled ? "is-open" : "",
                      ].join(" ")}
                    >
                      {cell.date.getDate()}
                    </button>
                  );
                })}
              </div>

              <p className="mt-3 border-t border-[color:var(--ui-line)] pt-3 text-[13px] leading-[1.45] text-[color:var(--ui-text-3)]">
                {loadingMonth
                  ? "Checking which days are free..."
                  : "Only days where one Fixter is free from start to finish can be booked."}
              </p>
            </div>

            {isLoading ? (
              <div className="pg-panel text-center text-[15px] text-[color:var(--ui-text-3)]">Loading your account...</div>
            ) : !isAuthenticated ? (
              /*
                A visitor can read everything above and pick a day; this is the
                one wall, and it is at the last step rather than the first. The
                return path is carried so signing in lands them back here.
              */
              <div className="pg-panel">
                <h2 className="ui-h3">Log in to book your Full Day</h2>
                <p className="mt-1.5 text-[14px] leading-[1.5] text-[color:var(--ui-text-2)]">
                  We need a home profile for your address, photos, reminders and
                  booking history. It takes a minute, and you will come straight
                  back here.
                </p>
                <div className="mt-4 flex flex-col gap-2 sm:flex-row">
                  <Link
                    href={`/signin?next=${encodeURIComponent(RETURN_PATH)}`}
                    onClick={() => trackEvent("full_day_login_prompted", { action: "signin" })}
                    className="ui-btn ui-btn--primary sm:min-w-[160px]"
                  >
                    Log In
                  </Link>
                  <Link
                    href={`/signup?next=${encodeURIComponent(RETURN_PATH)}`}
                    onClick={() => trackEvent("full_day_login_prompted", { action: "signup" })}
                    className="ui-btn ui-btn--secondary sm:min-w-[160px]"
                  >
                    Create Account
                  </Link>
                </div>
              </div>
            ) : (
              <>
                <div className="pg-panel">
                  <label className="pg-panel__title block" htmlFor="full-day-address">Where</label>
                  <select
                    id="full-day-address"
                    value={addressId}
                    onChange={(event) => setAddressId(event.target.value)}
                    aria-label="Full Day address"
                    className="pg-input"
                  >
                    <option value="">Choose address</option>
                    {addresses.map((address) => (
                      <option key={address._id} value={address._id}>
                        {addressLabel(address)}
                      </option>
                    ))}
                  </select>
                  {!addresses.length && (
                    <button
                      type="button"
                      onClick={async () => {
                        const home = await requestHome();
                        if (home?.address?._id) setAddressId(String(home.address._id));
                      }}
                      className="ui-link mt-1"
                    >
                      Add your home
                    </button>
                  )}
                </div>

                <div className="pg-panel">
                  <h2 className="pg-panel__title !mb-1">Your list</h2>
                  <p className="pg-hint">
                    Your Fixter works down it in the order you give, so put the important ones first.
                  </p>
                  <textarea
                    value={note}
                    onChange={(event) => setNote(event.target.value)}
                    rows={5}
                    placeholder={
                      "Mount TV in the den\nReplace two light fixtures\nFix the sticking back door\nPatch and paint the hallway"
                    }
                    className="pg-input min-h-[120px] resize-y"
                  />

                  <div className="mt-4">
                    <p className="pg-hint">Photos help your Fixter arrive with the right parts. Optional.</p>
                    <div className="pg-photo-row">
                      <button type="button" onClick={() => cameraInputRef.current?.click()} className="pg-photo-btn">
                        Take Photo
                      </button>
                      <button type="button" onClick={() => galleryInputRef.current?.click()} className="pg-photo-btn">
                        Choose Photos{photos.length > 0 ? ` (${photos.length})` : ""}
                      </button>
                    </div>
                    <PhotoLibraryPicker value={libraryReference} context="full_day" onChange={setLibraryReference} />
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
                      <div className="mt-3 grid grid-cols-4 gap-2 sm:grid-cols-5">
                        {photos.map((photo, index) => (
                          <div
                            key={`${photo.name}-${index}`}
                            className="relative overflow-hidden rounded-[var(--ui-r-sm)] border border-[color:var(--ui-line)] bg-[color:var(--ui-bg-sunk)]"
                            style={{ aspectRatio: "1" }}
                          >
                            {/* eslint-disable-next-line @next/next/no-img-element */}
                            <img src={photoUrls[index] || ""} alt={`Job photo ${index + 1}`} className="h-full w-full object-cover" />
                            <button
                              type="button"
                              onClick={() =>
                                setPhotos((current) =>
                                  current.filter((_, photoIndex) => photoIndex !== index)
                                )
                              }
                              aria-label="Remove photo"
                              className="absolute right-1 top-1 flex h-7 w-7 items-center justify-center rounded-full bg-black/60 text-[14px] leading-none text-white transition hover:bg-black/75"
                            >
                              &times;
                            </button>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              </>
            )}
          </div>

          <div className="grid grid-cols-[minmax(0,1fr)] gap-3 lg:sticky lg:top-[88px]">
            {isAuthenticated && !isLoading && (
              <div className="pg-panel">
                <h2 className="pg-panel__title">Summary</h2>
                <div className="pg-rows">
                  <div>
                    <span className="text-[color:var(--ui-text-3)]">Day</span>
                    <strong className="text-right font-medium text-[color:var(--ui-ink)]">
                      {selectedDate ? dayLabel(selectedDate) : "Not selected"}
                    </strong>
                  </div>
                  {selectedDay?.startTime && selectedDay?.endTime ? (
                    <div>
                      <span className="text-[color:var(--ui-text-3)]">Hours</span>
                      <strong className="text-right font-medium text-[color:var(--ui-ink)]">
                        {formatTime12(selectedDay.startTime)} to {formatTime12(selectedDay.endTime)}
                      </strong>
                    </div>
                  ) : null}
                  <div>
                    <span className="text-[color:var(--ui-text-3)]">Price</span>
                    <strong className="text-right font-medium text-[color:var(--ui-ink)]">
                      {included ? "Included with Elite" : priceLabel}
                    </strong>
                  </div>
                  {selectedAddress && (
                    <div>
                      <span className="text-[color:var(--ui-text-3)]">Home</span>
                      <strong className="min-w-0 truncate text-right font-medium text-[color:var(--ui-ink)]">
                        {[selectedAddress.line1, selectedAddress.city].filter(Boolean).join(", ")}
                      </strong>
                    </div>
                  )}
                </div>

                <p className="mt-3 text-[13px] leading-[1.5] text-[color:var(--ui-text-3)]">
                  Materials are separate. Full Days are for multiple small
                  jobs, not renovation work.
                </p>

                {error && <p className="pg-error mt-3">{error}</p>}

                {serviceTextsOptIn ? <div className="mt-3">{serviceTextsOptIn}</div> : null}

                <button
                  type="button"
                  onClick={submit}
                  disabled={submitting || !config.enabled}
                  className="ui-btn ui-btn--primary ui-btn--lg ui-btn--block mt-4"
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
            )}

            <details className="pg-more">
              <summary>Changes &amp; bigger projects</summary>
              <div className="pg-more__body">
                <p>
                  Changes to a booked Full Day are handled by phone. Call{" "}
                  <a href={`tel:${config.cancellationPhone}`} className="font-semibold text-[color:var(--ui-accent-ink)]">
                    {config.cancellationPhone}
                  </a>
                  .
                </p>
                {/*
                  The honest boundary of the product. Someone reading "one Fixter
                  for a whole day" may be thinking about a kitchen; naming the
                  work we do instead is more useful than a disclaimer.
                */}
                <p>
                  A Full Day is for a list of small jobs. Larger work is a project, and
                  projects start with an estimate: {BIGGER_JOBS.join(", ").toLowerCase()}.
                </p>
                <Link
                  href="/projects#estimate"
                  onClick={() => trackEvent("estimate_cta_clicked", { placement: "book_full_day" })}
                  className="ui-link"
                >
                  Request Project Estimate
                </Link>
              </div>
            </details>
          </div>
        </div>
      )}
      {homeSheet}
      {contactSheet}
    </section>
  );
}
