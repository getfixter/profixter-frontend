"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import Header from "@/app/components/sections/Header";
import Footer from "@/app/components/sections/Footer";
import { useAuth } from "@/lib/useAuth";
import {
  createOneTimeVisitCheckout,
  getOneTimeVisitConfig,
  getTimeSlots,
} from "@/lib/booking-service";
import { compressImage } from "@/lib/compressImage";
import type { Address } from "@/lib/auth-service";
import type { OneTimeVisitConfig } from "@/lib/booking-service";
import { trackEvent, trackInitiateCheckout } from "@/lib/analytics";

const FALLBACK_ONE_TIME_CONFIG: OneTimeVisitConfig = {
  enabled: true,
  priceCents: 9900,
  currency: "usd",
  durationMinutes: 90,
  holdMinutes: 30,
  cancellationPhone: "631-599-1363",
  allowedServices: [
    "Replace faucet",
    "Replace light fixture",
    "Install ceiling fan",
    "Hang TV",
    "Install shelves",
    "Door adjustment",
    "Lock replacement",
    "Caulking",
    "Minor drywall repair",
    "Curtain rods",
    "Cabinet hardware",
    "Toilet repair",
    "Garbage disposal replacement",
    "Smoke detector installation",
  ],
  excludedServices: [
    "Appliance repair",
    "Painting entire rooms",
    "Full renovations",
    "Roofing",
    "Large electrical work",
    "Plumbing remodels",
    "Multi-day projects",
    "Large projects",
  ],
  promoNote: "",
};

const TRUST_POINTS = [
  "Licensed HI-71484",
  "Fully insured",
  "Local Nassau & Suffolk County service",
  "Secure Stripe Checkout",
];

function bookFaqs(config: OneTimeVisitConfig) {
  return [
    {
      q: "What happens after I pay?",
      a: "Your paid request stays Pending while our admin team reviews the details, confirms the appointment, and assigns the technician.",
    },
    {
      q: `What if the job is bigger than ${config.durationMinutes} minutes?`,
      a: "We will help identify the next step. Larger or multi-visit work should move to a Project Estimate instead of forcing it into a one-time visit.",
    },
    {
      q: "Can I cancel or reschedule online?",
      a: `Cancellation and reschedule requests require admin approval. Call ${config.cancellationPhone} so we can review the schedule and reserved slot.`,
    },
    {
      q: "Do you repair appliances?",
      a: "No. Profixter does not offer appliance repair. Manufacturer support, warranty support, or an appliance repair specialist is the better path.",
    },
  ];
}

function todayYMD() {
  const now = new Date();
  const yyyy = now.getFullYear();
  const mm = String(now.getMonth() + 1).padStart(2, "0");
  const dd = String(now.getDate()).padStart(2, "0");
  return `${yyyy}-${mm}-${dd}`;
}

function formatTime12(value: string) {
  const [hh, mm] = value.split(":").map(Number);
  if (!Number.isFinite(hh) || !Number.isFinite(mm)) return value;
  const period = hh >= 12 ? "PM" : "AM";
  const h12 = hh % 12 || 12;
  return `${h12}:${String(mm).padStart(2, "0")} ${period}`;
}

function formatPrice(cents: number, currency = "usd") {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: currency.toUpperCase(),
    maximumFractionDigits: cents % 100 === 0 ? 0 : 2,
  }).format(Math.max(0, cents) / 100);
}

function safeConfig(config: OneTimeVisitConfig) {
  return {
    ...config,
    allowedServices: config.allowedServices?.length
      ? config.allowedServices
      : FALLBACK_ONE_TIME_CONFIG.allowedServices,
    excludedServices: config.excludedServices?.length
      ? config.excludedServices
      : FALLBACK_ONE_TIME_CONFIG.excludedServices,
    cancellationPhone:
      config.cancellationPhone || FALLBACK_ONE_TIME_CONFIG.cancellationPhone,
    durationMinutes:
      Number.isFinite(config.durationMinutes) && config.durationMinutes > 0
        ? config.durationMinutes
        : FALLBACK_ONE_TIME_CONFIG.durationMinutes,
    priceCents:
      Number.isFinite(config.priceCents) && config.priceCents >= 0
        ? config.priceCents
        : FALLBACK_ONE_TIME_CONFIG.priceCents,
    currency: config.currency || FALLBACK_ONE_TIME_CONFIG.currency,
  };
}

function bookingDateFromParts(dateValue: string, timeValue: string) {
  const [year, month, day] = dateValue.split("-").map(Number);
  const [hours, minutes] = timeValue.split(":").map(Number);
  if (
    !Number.isFinite(year) ||
    !Number.isFinite(month) ||
    !Number.isFinite(day) ||
    !Number.isFinite(hours) ||
    !Number.isFinite(minutes)
  ) {
    return null;
  }
  return new Date(year, month - 1, day, hours, minutes, 0, 0);
}

function addressLabel(address: Address) {
  return `${address.label ? `${address.label}: ` : ""}${address.line1}, ${address.city} ${address.state} ${address.zip}`;
}

export default function BookPage() {
  const { user, isAuthenticated, isLoading } = useAuth();
  const addresses = useMemo(() => user?.addresses ?? [], [user?.addresses]);
  const [config, setConfig] = useState<OneTimeVisitConfig>(FALLBACK_ONE_TIME_CONFIG);
  const [configError, setConfigError] = useState("");
  const [addressId, setAddressId] = useState("");
  const [selectedTask, setSelectedTask] = useState(FALLBACK_ONE_TIME_CONFIG.allowedServices[0]);
  const [selectedDate, setSelectedDate] = useState(todayYMD());
  const [selectedTime, setSelectedTime] = useState("");
  const [slots, setSlots] = useState<string[]>([]);
  const [loadingSlots, setLoadingSlots] = useState(false);
  const [note, setNote] = useState("");
  const [photos, setPhotos] = useState<File[]>([]);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    trackEvent("book_started", { page: "/book" });
    const searchParams = new URLSearchParams(window.location.search);
    if (searchParams.get("canceled") === "true") {
      trackEvent("one_time_checkout_returned", {
        page: "/book",
        result: "canceled",
        bookingId: searchParams.get("booking_id") || "",
      });
    }
  }, []);

  useEffect(() => {
    let cancelled = false;
    getOneTimeVisitConfig()
      .then((data) => {
        if (cancelled) return;
        setConfig(safeConfig(data));
        setConfigError("");
      })
      .catch(() => {
        if (!cancelled) {
          setConfig(FALLBACK_ONE_TIME_CONFIG);
          setConfigError("Using standard one-time visit details while settings load.");
        }
      });

    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    if (!addressId && user?.defaultAddressId) {
      setAddressId(String(user.defaultAddressId));
    } else if (!addressId && addresses[0]?._id) {
      setAddressId(String(addresses[0]._id));
    }
  }, [addressId, addresses, user?.defaultAddressId]);

  useEffect(() => {
    let cancelled = false;
    setSelectedTime("");
    setSlots([]);
    if (!selectedDate) return;

    setLoadingSlots(true);
    getTimeSlots(selectedDate)
      .then((data) => {
        if (cancelled) return;
        setSlots(data.slots || []);
      })
      .catch(() => {
        if (!cancelled) setError("Unable to load available times. Please try another date.");
      })
      .finally(() => {
        if (!cancelled) setLoadingSlots(false);
      });

    return () => {
      cancelled = true;
    };
  }, [selectedDate]);

  const selectedAddress = useMemo(
    () => addresses.find((address) => String(address._id) === String(addressId)),
    [addresses, addressId]
  );
  const priceLabel = formatPrice(config.priceCents, config.currency);
  const allowedTasks = config.allowedServices;
  const excludedServices = config.excludedServices;
  const faqs = useMemo(() => bookFaqs(config), [config]);

  useEffect(() => {
    if (!allowedTasks.includes(selectedTask)) {
      setSelectedTask(allowedTasks[0] || "");
    }
  }, [allowedTasks, selectedTask]);

  async function handleFiles(files: FileList | null) {
    if (!files) return;
    const next: File[] = [];
    for (const file of Array.from(files)) {
      next.push(await compressImage(file));
    }
    setPhotos((current) => [...current, ...next].slice(0, 10));
  }

  async function submit() {
    setError("");
    if (!config.enabled) {
      setError("One-Time Handyman Visit booking is temporarily unavailable.");
      return;
    }
    if (!isAuthenticated) {
      setError("Please sign in or create an account before booking.");
      return;
    }
    if (!addressId) {
      setError("Choose an address for the visit.");
      return;
    }
    if (!selectedTask) {
      setError("Choose the task you want help with.");
      return;
    }
    if (!selectedDate || !selectedTime) {
      setError("Choose an available date and time.");
      return;
    }
    if (note.trim().split(/\s+/).filter(Boolean).length < 3) {
      setError("Describe the task in at least a few words.");
      return;
    }
    if (!photos.length) {
      setError("Add at least one photo so our team can prepare.");
      return;
    }

    const bookingDate = bookingDateFromParts(selectedDate, selectedTime);
    if (!bookingDate) {
      setError("Choose a valid date and time.");
      return;
    }

    setLoading(true);
    try {
      trackInitiateCheckout({
        product: "one_time_handyman_visit",
        selectedTask,
        price: config.priceCents / 100,
      });
      trackEvent("one_time_checkout_started", {
        selectedTask,
        date: selectedDate,
        time: selectedTime,
      });
      const result = await createOneTimeVisitCheckout({
        addressId,
        selectedTask,
        date: bookingDate.toISOString(),
        requestedDate: selectedDate,
        requestedTime: selectedTime,
        note: note.trim(),
        images: photos,
      });
      window.location.href = result.url;
    } catch (err) {
      const message = err instanceof Error ? err.message : "Unable to start checkout.";
      setError(message);
    } finally {
      setLoading(false);
    }
  }

  return (
    <main className="min-h-screen bg-[#F6F8FC] text-[#0B1628]">
      <Header />
      <section className="bg-white">
        <div className="mx-auto grid max-w-[1180px] gap-8 px-4 py-10 sm:px-6 lg:grid-cols-[0.92fr_1.08fr] lg:px-8 lg:py-14">
          <div>
            <div className="inline-flex rounded-full border border-emerald-200 bg-emerald-50 px-3 py-1 text-xs font-black uppercase tracking-[0.16em] text-emerald-700">
              One-Time Handyman Visit
            </div>
            <h1 className="mt-4 text-[40px] font-black leading-none text-slate-950 sm:text-[56px]">
              Book one small job for {priceLabel}.
            </h1>
            <p className="mt-5 text-base leading-7 text-slate-600">
              Best for one small handyman job or trying Profixter once. Your {priceLabel} visit includes {config.durationMinutes} minutes. Choose the task, pick a time, add notes and photos, then pay securely. Final approval and technician assignment come from our admin team.
            </p>
            {config.promoNote && (
              <div className="mt-4 rounded-[8px] border border-emerald-200 bg-emerald-50 p-3 text-sm font-bold text-emerald-800">
                {config.promoNote}
              </div>
            )}
            {configError && (
              <div className="mt-4 rounded-[8px] border border-amber-200 bg-amber-50 p-3 text-sm font-bold text-amber-800">
                {configError}
              </div>
            )}
            <div className="mt-6 grid gap-3 sm:grid-cols-3">
              {[`${priceLabel} visit`, `${config.durationMinutes} minutes`, `Call ${config.cancellationPhone}`].map((item) => (
                <div key={item} className="rounded-[8px] border border-slate-200 bg-slate-50 p-3 text-sm font-black text-slate-900">
                  {item}
                </div>
              ))}
            </div>
            <div className="mt-6 grid gap-2">
              {TRUST_POINTS.map((point) => (
                <div key={point} className="flex items-center gap-2 text-sm font-bold text-slate-700">
                  <span className="h-2 w-2 rounded-full bg-emerald-500" />
                  {point}
                </div>
              ))}
            </div>
            <div className="mt-7 rounded-[8px] border border-blue-100 bg-blue-50 p-4">
              <h2 className="text-sm font-black uppercase tracking-[0.14em] text-blue-700">
                Membership is better when
              </h2>
              <p className="mt-2 text-sm leading-6 text-slate-700">
                You need ongoing home maintenance, multiple tasks, priority scheduling, better long-term value, discounts on larger projects, and rush visit benefits depending on plan. Memberships allow unlimited booking requests, limited by appointment capacity and active booking rules.
              </p>
              <Link
                href="/membership"
                onClick={() => trackEvent("membership_cta_clicked", { placement: "book_upsell" })}
                className="mt-3 inline-flex text-sm font-black text-blue-700"
              >
                Compare membership plans -&gt;
              </Link>
            </div>
          </div>

          <div className="rounded-[8px] border border-slate-200 bg-white p-4 shadow-[0_18px_45px_rgba(15,23,42,0.08)] sm:p-5">
            {isLoading ? (
              <div className="py-16 text-center text-sm font-semibold text-slate-500">
                Loading your account...
              </div>
            ) : !isAuthenticated ? (
              <div className="space-y-4 py-8 text-center">
                <h2 className="text-2xl font-black text-slate-950">Sign in to book</h2>
                <p className="mx-auto max-w-[420px] text-sm leading-6 text-slate-600">
                  One-Time Visits require an account so we can save your address, photos, payment status, reminders, and appointment history.
                </p>
                <div className="flex flex-col gap-2 sm:flex-row sm:justify-center">
                  <Link href="/signin" className="rounded-[8px] bg-blue-600 px-5 py-3 text-sm font-black text-white">
                    Sign in
                  </Link>
                  <Link href="/signup" className="rounded-[8px] border border-slate-200 px-5 py-3 text-sm font-black text-slate-900">
                    Create account
                  </Link>
                </div>
              </div>
            ) : (
              <div className="space-y-5">
                <div className="rounded-[8px] border border-slate-200 bg-slate-50 p-3">
                  <div className="grid gap-2 text-sm font-bold text-slate-700 sm:grid-cols-4">
                    <span>1. Choose task</span>
                    <span>2. Pick time</span>
                    <span>3. Add details</span>
                    <span>4. Pay</span>
                  </div>
                </div>

                <div>
                  <label className="text-xs font-black uppercase tracking-[0.14em] text-slate-500">
                    Address
                  </label>
                  <select
                    value={addressId}
                    onChange={(event) => setAddressId(event.target.value)}
                    className="mt-2 w-full rounded-[8px] border border-slate-200 bg-white px-3 py-3 text-sm font-bold text-slate-900"
                  >
                    <option value="">Choose address</option>
                    {addresses.map((address) => (
                      <option key={address._id} value={address._id}>
                        {addressLabel(address)}
                      </option>
                    ))}
                  </select>
                  {!addresses.length && (
                    <Link href="/account?tab=personal" className="mt-2 inline-flex text-sm font-bold text-blue-700">
                      Add an address in your account -&gt;
                    </Link>
                  )}
                </div>

                <div>
                  <label className="text-xs font-black uppercase tracking-[0.14em] text-slate-500">
                    Task
                  </label>
                  <select
                    value={selectedTask}
                    onChange={(event) => setSelectedTask(event.target.value)}
                    className="mt-2 w-full rounded-[8px] border border-slate-200 bg-white px-3 py-3 text-sm font-bold text-slate-900"
                  >
                    {allowedTasks.map((task) => (
                      <option key={task} value={task}>
                        {task}
                      </option>
                    ))}
                  </select>
                </div>

                <div className="grid gap-4 sm:grid-cols-[0.8fr_1.2fr]">
                  <div>
                    <label className="text-xs font-black uppercase tracking-[0.14em] text-slate-500">
                      Date
                    </label>
                    <input
                      type="date"
                      min={todayYMD()}
                      value={selectedDate}
                      onChange={(event) => setSelectedDate(event.target.value)}
                      className="mt-2 w-full rounded-[8px] border border-slate-200 bg-white px-3 py-3 text-sm font-bold text-slate-900"
                    />
                  </div>
                  <div>
                    <label className="text-xs font-black uppercase tracking-[0.14em] text-slate-500">
                      Available time
                    </label>
                    <div className="mt-2 grid grid-cols-2 gap-2">
                      {loadingSlots ? (
                        <div className="col-span-2 rounded-[8px] border border-slate-200 p-3 text-sm font-semibold text-slate-500">
                          Loading times...
                        </div>
                      ) : slots.length ? (
                        slots.map((slot) => (
                          <button
                            key={slot}
                            type="button"
                            onClick={() => setSelectedTime(slot)}
                            className={`rounded-[8px] border px-3 py-3 text-sm font-black ${
                              selectedTime === slot
                                ? "border-blue-600 bg-blue-50 text-blue-700"
                                : "border-slate-200 bg-white text-slate-800"
                            }`}
                          >
                            {formatTime12(slot)}
                          </button>
                        ))
                      ) : (
                        <div className="col-span-2 rounded-[8px] border border-slate-200 p-3 text-sm font-semibold text-slate-500">
                          No times available for this date.
                        </div>
                      )}
                    </div>
                  </div>
                </div>

                <div>
                  <label className="text-xs font-black uppercase tracking-[0.14em] text-slate-500">
                    Notes
                  </label>
                  <textarea
                    value={note}
                    onChange={(event) => setNote(event.target.value)}
                    rows={4}
                    placeholder="Tell us what is happening and where the task is located."
                    className="mt-2 w-full rounded-[8px] border border-slate-200 bg-white px-3 py-3 text-sm text-slate-900"
                  />
                </div>

                <div>
                  <label className="text-xs font-black uppercase tracking-[0.14em] text-slate-500">
                    Photos
                  </label>
                  <input
                    type="file"
                    accept="image/*"
                    multiple
                    onChange={(event) => handleFiles(event.target.files)}
                    className="mt-2 w-full rounded-[8px] border border-slate-200 bg-white px-3 py-3 text-sm"
                  />
                  {photos.length > 0 && (
                    <div className="mt-2 text-xs font-bold text-slate-500">
                      {photos.length} photo{photos.length === 1 ? "" : "s"} added
                    </div>
                  )}
                </div>

                <div className="rounded-[8px] border border-amber-200 bg-amber-50 p-3 text-sm leading-6 text-amber-900">
                  Cancellation or reschedule requests require admin approval. Call {config.cancellationPhone}. Appliance repair is not offered.
                </div>

                <div className="rounded-[8px] border border-slate-200 bg-slate-50 p-4">
                  <div className="text-xs font-black uppercase tracking-[0.14em] text-slate-500">
                    Request summary
                  </div>
                  <div className="mt-3 grid gap-2 text-sm text-slate-700">
                    <div className="flex justify-between gap-4">
                      <span>Visit</span>
                      <strong className="text-right text-slate-950">{priceLabel} / {config.durationMinutes} minutes</strong>
                    </div>
                    <div className="flex justify-between gap-4">
                      <span>Task</span>
                      <strong className="text-right text-slate-950">{selectedTask}</strong>
                    </div>
                    <div className="flex justify-between gap-4">
                      <span>Time</span>
                      <strong className="text-right text-slate-950">
                        {selectedDate}
                        {selectedTime ? ` at ${formatTime12(selectedTime)}` : ""}
                      </strong>
                    </div>
                    {selectedAddress && (
                      <div className="border-t border-slate-200 pt-2 text-xs font-semibold text-slate-600">
                        Booking for {addressLabel(selectedAddress)}
                      </div>
                    )}
                  </div>
                </div>

                {error && (
                  <div className="rounded-[8px] border border-red-200 bg-red-50 p-3 text-sm font-bold text-red-700">
                    {error}
                  </div>
                )}

                <button
                  type="button"
                  onClick={submit}
                  disabled={loading || !config.enabled}
                  className="w-full rounded-[8px] bg-blue-600 px-5 py-4 text-base font-black text-white disabled:opacity-60"
                >
                  {loading
                    ? "Opening secure checkout..."
                    : config.enabled
                      ? "Continue to payment"
                      : "Booking temporarily unavailable"}
                </button>
              </div>
            )}
          </div>
        </div>
      </section>

      <section className="mx-auto grid max-w-[1180px] gap-4 px-4 py-8 sm:px-6 lg:grid-cols-2 lg:px-8">
        <div className="rounded-[8px] border border-slate-200 bg-white p-5">
          <h2 className="text-lg font-black text-slate-950">Allowed tasks</h2>
          <div className="mt-4 grid gap-2 sm:grid-cols-2">
            {allowedTasks.map((task) => (
              <div key={task} className="rounded-[8px] bg-slate-50 px-3 py-2 text-sm font-semibold text-slate-700">
                {task}
              </div>
            ))}
          </div>
        </div>
        <div className="rounded-[8px] border border-slate-200 bg-white p-5">
          <h2 className="text-lg font-black text-slate-950">Outside one-time scope</h2>
          <p className="mt-2 text-sm leading-6 text-slate-600">
            Larger jobs, appliance repair, and work that needs a licensed trade or multiple visits should start as a Project Estimate.
          </p>
          <div className="mt-4 grid gap-2 sm:grid-cols-2">
            {excludedServices.map((task) => (
              <div key={task} className="rounded-[8px] bg-slate-50 px-3 py-2 text-sm font-semibold text-slate-700">
                {task}
              </div>
            ))}
          </div>
          <Link
            href="/projects"
            onClick={() => trackEvent("estimate_cta_clicked", { placement: "book_excluded_scope" })}
            className="mt-4 inline-flex text-sm font-black text-blue-700"
          >
            Request a Project Estimate -&gt;
          </Link>
        </div>
      </section>

      <section className="bg-white">
        <div className="mx-auto grid max-w-[1180px] gap-4 px-4 py-10 sm:px-6 lg:grid-cols-3 lg:px-8">
          {[
            ["Booking first", "Pick a task, date, time, notes, and photos so the visit is scoped before payment."],
            ["Payment second", `Stripe Checkout reserves the selected slot for about ${config.holdMinutes} minutes while you complete payment.`],
            ["Confirmation last", "Payment marks the request paid, then admin confirms and assigns the technician."],
          ].map(([title, body]) => (
            <div key={title} className="rounded-[8px] border border-slate-200 bg-slate-50 p-5">
              <h2 className="text-base font-black text-slate-950">{title}</h2>
              <p className="mt-2 text-sm leading-6 text-slate-600">{body}</p>
            </div>
          ))}
        </div>
      </section>

      <section className="mx-auto max-w-[900px] px-4 py-10 sm:px-6 lg:px-8">
        <div className="text-center">
          <div className="text-xs font-black uppercase tracking-[0.16em] text-blue-700">
            Questions before checkout
          </div>
          <h2 className="mt-3 text-3xl font-black text-slate-950">Know exactly what you are buying.</h2>
        </div>
        <div className="mt-7 grid gap-3">
          {faqs.map((faq) => (
            <div key={faq.q} className="rounded-[8px] border border-slate-200 bg-white p-5">
              <h3 className="text-base font-black text-slate-950">{faq.q}</h3>
              <p className="mt-2 text-sm leading-6 text-slate-600">{faq.a}</p>
            </div>
          ))}
        </div>
      </section>
      <Footer />
    </main>
  );
}
