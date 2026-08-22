"use client";

import { FormEvent, useRef, useState } from "react";
import { CUSTOMER_CARE } from "@/lib/fixter";
import { trackEvent } from "@/lib/analytics";
import { extractUSNationalPhoneDigits, isValidUSNationalPhoneDigits } from "@/lib/phone";
import { PAGE_ID, trackPhoneCta } from "./ctas";

type Scope = "kitchen" | "bathroom" | "kitchen-bathroom";

const SCOPES: Array<{ value: Scope; label: string }> = [
  { value: "kitchen", label: "Kitchen" },
  { value: "bathroom", label: "Bathroom" },
  { value: "kitchen-bathroom", label: "Both" },
];

const SCOPE_SENTENCE: Record<Scope, string> = {
  kitchen: "Kitchen renovation.",
  bathroom: "Bathroom renovation.",
  "kitchen-bathroom": "Kitchen and bathroom renovation.",
};

const EMPTY = {
  name: "",
  phone: "",
  email: "",
  address: "",
  scope: "kitchen" as Scope,
  notes: "",
};

const field =
  "h-[52px] w-full rounded-[10px] border border-[#DEDAD2] bg-white px-4 text-[15px] text-[#0C1117] outline-none transition-colors placeholder:text-[#A5A096] focus:border-[#306EEC] focus:ring-4 focus:ring-[#306EEC]/10";

const label = "mb-1.5 block text-[12px] font-bold tracking-[0.04em] text-[#4A5058]";

export default function ProjectInquiryForm() {
  const [form, setForm] = useState(EMPTY);
  const [status, setStatus] = useState<"idle" | "sending" | "success" | "error">("idle");
  const [message, setMessage] = useState("");
  const started = useRef(false);

  const update = (key: keyof typeof form, value: string) => {
    if (!started.current) {
      started.current = true;
      trackEvent("project_inquiry_started", { page: PAGE_ID });
    }
    setForm((current) => ({ ...current, [key]: value }));
    if (status === "error") {
      setStatus("idle");
      setMessage("");
    }
  };

  const submit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    const name = form.name.trim();
    const phone = form.phone.trim();
    const email = form.email.trim();
    const address = form.address.trim();

    if (!name || !phone || !email || !address) {
      setStatus("error");
      setMessage("Please fill in your name, phone, email and where the project is.");
      return;
    }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      setStatus("error");
      setMessage("That email address does not look right.");
      return;
    }
    if (!isValidUSNationalPhoneDigits(extractUSNationalPhoneDigits(phone))) {
      setStatus("error");
      setMessage("Please enter a 10-digit US phone number.");
      return;
    }
    // The estimates endpoint rejects anything shorter as a spam guard, so catch
    // it here where the person can still see which box to fix.
    if (address.length < 6) {
      setStatus("error");
      setMessage("Please include the town and ZIP so we know where the project is.");
      return;
    }

    setStatus("sending");
    setMessage("");

    /*
     * The lead goes to /api/estimates - the same endpoint the Projects page and
     * the exterior landing page post to. It writes an EstimateLead and emails
     * the admin, so this page shows up in the existing Leads list rather than
     * in a parallel inbox somebody has to remember to check.
     *
     * `service` carries the combined value when the homeowner picked Both. That
     * value is additive on the backend, so a frontend deployed ahead of it
     * would get a 400 back; rather than lose the lead, the catch below re-sends
     * under `kitchen` with the real scope stated at the top of the notes.
     */
    const scopeNote = `${SCOPE_SENTENCE[form.scope]}${form.notes.trim() ? ` ${form.notes.trim()}` : ""}`;

    const send = (service: string) =>
      fetch(`${process.env.NEXT_PUBLIC_API_URL ?? ""}/api/estimates`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          service,
          name,
          phone,
          email,
          address,
          notes: scopeNote,
          contactPref: "call",
          source: "kitchen_bathroom_landing",
          sourcePage: PAGE_ID,
        }),
      });

    try {
      let response = await send(form.scope);

      if (!response.ok && form.scope === "kitchen-bathroom" && response.status === 400) {
        response = await send("kitchen");
      }

      const body = (await response.json().catch(() => ({}))) as { message?: string };

      if (!response.ok) {
        setStatus("error");
        setMessage(
          body.message ||
            `We could not send that just now. Please call ${CUSTOMER_CARE.phoneDisplay}.`
        );
        return;
      }

      trackEvent("project_inquiry_submitted", { service: form.scope, page: PAGE_ID });
      setStatus("success");
      setForm(EMPTY);
    } catch {
      setStatus("error");
      setMessage(
        `We could not reach our server. Please check your connection, or call ${CUSTOMER_CARE.phoneDisplay}.`
      );
    }
  };

  if (status === "success") {
    return (
      <div className="rounded-[16px] border border-[#DEDAD2] bg-white p-7 sm:p-10">
        <span className="flex h-12 w-12 items-center justify-center rounded-full bg-[#E7F6EC] text-[#15803D]">
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" aria-hidden="true">
            <path
              d="M5 12.5l4 4 10-10"
              stroke="currentColor"
              strokeWidth="2.4"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </svg>
        </span>
        <h3 className="mt-6 text-[26px] font-bold leading-[1.1] tracking-[-0.02em] text-[#0C1117] sm:text-[32px]">
          Your project request is in.
        </h3>
        <p className="mt-3 max-w-[46ch] text-[15px] leading-relaxed text-[#5C6470]">
          A real person at Profixter reviews every request. We will read the details and get
          back to you about your kitchen or bathroom.
        </p>
        <p className="mt-6 text-[13px] text-[#5C6470]">
          Need to speak with someone sooner?
        </p>
        <a
          href={CUSTOMER_CARE.callHref}
          onClick={() => trackPhoneCta("inquiry_success")}
          className="mt-3 inline-flex min-h-[52px] items-center justify-center gap-2.5 rounded-full border border-[#0C1117] px-7 text-[15px] font-bold text-[#0C1117] transition-colors hover:bg-[#0C1117] hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#306EEC] focus-visible:ring-offset-2"
        >
          Call {CUSTOMER_CARE.phoneDisplay}
        </a>
      </div>
    );
  }

  return (
    <form
      onSubmit={submit}
      noValidate
      className="rounded-[16px] border border-[#DEDAD2] bg-white p-5 sm:p-8"
    >
      <div className="grid gap-4 sm:grid-cols-2">
        <label>
          <span className={label}>Name</span>
          <input
            value={form.name}
            onChange={(event) => update("name", event.target.value)}
            className={field}
            autoComplete="name"
            placeholder="Jane Miller"
          />
        </label>
        <label>
          <span className={label}>Phone</span>
          <input
            value={form.phone}
            onChange={(event) => update("phone", event.target.value)}
            className={field}
            type="tel"
            inputMode="tel"
            autoComplete="tel"
            placeholder="631 555 0134"
          />
        </label>
      </div>

      <label className="mt-4 block">
        <span className={label}>Email</span>
        <input
          value={form.email}
          onChange={(event) => update("email", event.target.value)}
          className={field}
          type="email"
          inputMode="email"
          autoComplete="email"
          placeholder="jane@example.com"
        />
      </label>

      <label className="mt-4 block">
        <span className={label}>Where is the project?</span>
        <input
          value={form.address}
          onChange={(event) => update("address", event.target.value)}
          className={field}
          autoComplete="street-address"
          placeholder="Town and ZIP, or full address"
        />
      </label>

      <fieldset className="mt-6">
        <legend className={label}>What are we renovating?</legend>
        <div className="grid grid-cols-3 gap-2">
          {SCOPES.map((option) => {
            const active = form.scope === option.value;
            return (
              <label
                key={option.value}
                className={[
                  "flex min-h-[52px] cursor-pointer items-center justify-center rounded-[10px] border px-2 text-[14px] font-bold transition-colors",
                  "focus-within:ring-2 focus-within:ring-[#306EEC] focus-within:ring-offset-2",
                  active
                    ? "border-[#0C1117] bg-[#0C1117] text-white"
                    : "border-[#DEDAD2] bg-white text-[#4A5058] hover:border-[#0C1117] hover:text-[#0C1117]",
                ].join(" ")}
              >
                <input
                  type="radio"
                  name="scope"
                  value={option.value}
                  checked={active}
                  onChange={() => update("scope", option.value)}
                  className="sr-only"
                />
                {option.label}
              </label>
            );
          })}
        </div>
      </fieldset>

      <label className="mt-4 block">
        <span className={label}>
          Tell us about it <span className="font-medium text-[#9A958B]">— optional</span>
        </span>
        <textarea
          value={form.notes}
          onChange={(event) => update("notes", event.target.value)}
          rows={3}
          className="w-full resize-none rounded-[10px] border border-[#DEDAD2] bg-white px-4 py-3.5 text-[15px] text-[#0C1117] outline-none transition-colors placeholder:text-[#A5A096] focus:border-[#306EEC] focus:ring-4 focus:ring-[#306EEC]/10"
          placeholder="Rough size, what you are hoping to change, when you would like to start."
        />
      </label>

      {message ? (
        <p
          role="alert"
          className="mt-4 rounded-[10px] border border-[#F0C7C7] bg-[#FDF3F3] px-4 py-3 text-[13px] font-semibold text-[#A32323]"
        >
          {message}
        </p>
      ) : null}

      <button
        type="submit"
        disabled={status === "sending"}
        className="mt-6 inline-flex min-h-[54px] w-full items-center justify-center rounded-full bg-[#306EEC] px-7 text-[15px] font-bold text-white transition-colors hover:bg-[#2558C9] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#306EEC] focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-60"
      >
        {status === "sending" ? "Sending…" : "Send project request"}
      </button>

      <p className="mt-4 text-center text-[12px] leading-relaxed text-[#8A857B]">
        A real person reviews every request. Prefer to talk?{" "}
        <a
          href={CUSTOMER_CARE.callHref}
          onClick={() => trackPhoneCta("inquiry_form_footnote")}
          className="font-bold text-[#0C1117] underline underline-offset-2"
        >
          Call {CUSTOMER_CARE.phoneDisplay}
        </a>
      </p>
    </form>
  );
}
