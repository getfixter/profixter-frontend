"use client";

import { FormEvent, useEffect, useState } from "react";

type ProjectType = "roofing" | "siding" | "both";

type Props = {
  defaultProject: ProjectType;
  accentLabel: string;
};

const INITIAL_FORM = {
  name: "",
  phone: "",
  email: "",
  address: "",
  projectType: "roofing" as ProjectType,
  contactPref: "call" as "call" | "text" | "email",
  bestTime: "any" as string,
  notes: "",
};

function projectLabel(value: ProjectType) {
  if (value === "roofing") return "Roofing";
  if (value === "siding") return "Siding";
  return "Roofing & Siding (Both)";
}

const inputClass =
  "h-[52px] w-full rounded-[14px] border border-white/12 bg-white/[0.07] px-4 text-[15px] text-white outline-none placeholder:text-white/32 focus:border-[#D4A574] transition-colors";

const selectClass =
  "h-[52px] w-full rounded-[14px] border border-white/12 bg-[#101A2B] px-4 text-[15px] text-white outline-none focus:border-[#D4A574] transition-colors appearance-none";

export default function ExteriorLeadForm({ defaultProject, accentLabel }: Props) {
  const [form, setForm] = useState({ ...INITIAL_FORM, projectType: defaultProject });
  const [status, setStatus] = useState<"idle" | "loading" | "success" | "error">("idle");
  const [message, setMessage] = useState("");
  const [sourcePage, setSourcePage] = useState("");

  useEffect(() => {
    setSourcePage(window.location.pathname);
  }, []);

  const update = (key: keyof typeof form, value: string) => {
    setForm((current) => ({ ...current, [key]: value }));
    if (status !== "idle") {
      setStatus("idle");
      setMessage("");
    }
  };

  const submit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    if (!form.name.trim() || !form.phone.trim() || !form.email.trim() || !form.address.trim()) {
      setStatus("error");
      setMessage("Please complete all required fields so we can review your project.");
      return;
    }

    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.email.trim())) {
      setStatus("error");
      setMessage("Please enter a valid email address.");
      return;
    }

    if (form.phone.replace(/\D/g, "").length < 10) {
      setStatus("error");
      setMessage("Please enter a valid phone number.");
      return;
    }

    if (form.address.trim().length < 6) {
      setStatus("error");
      setMessage("Please enter your project address.");
      return;
    }

    setStatus("loading");
    setMessage("");

    try {
      const apiUrl = process.env.NEXT_PUBLIC_API_URL ?? "";
      const response = await fetch(`${apiUrl}/api/estimates`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          service: form.projectType,
          source: "exterior_landing",
          name: form.name.trim(),
          phone: form.phone.trim(),
          email: form.email.trim(),
          address: form.address.trim(),
          contactPref: form.contactPref,
          bestTime: form.bestTime,
          notes: form.notes.trim(),
          sourcePage: sourcePage || "/exterior",
        }),
      });

      const body = (await response.json().catch(() => ({}))) as { message?: string };

      if (!response.ok) {
        setStatus("error");
        setMessage(body.message || "We could not send your request. Please call 631-599-1363.");
        return;
      }

      setStatus("success");
      setMessage("Thanks - your request was sent. A real person will review it and follow up shortly.");
      setForm({ ...INITIAL_FORM, projectType: defaultProject });
    } catch {
      setStatus("error");
      setMessage("We could not send your request. Please call 631-599-1363.");
    }
  };

  return (
    <form
      onSubmit={submit}
      className="rounded-[28px] border border-white/10 bg-white/[0.06] p-5 shadow-[0_24px_90px_rgba(0,0,0,0.28)] backdrop-blur-md sm:p-7"
    >
      <div className="mb-6">
        <div className="text-[10px] font-bold uppercase tracking-[0.22em] text-[#E8C49A]">{accentLabel}</div>
        <h3 className="mt-2 text-[24px] font-black leading-tight text-white">Request your free estimate</h3>
        <p className="mt-1.5 text-[13px] leading-relaxed text-white/50">
          Share the basics. A real person will review the project and follow up.
        </p>
      </div>

      {/* Name + Phone */}
      <div className="grid gap-3 sm:grid-cols-2">
        <input
          value={form.name}
          onChange={(e) => update("name", e.target.value)}
          placeholder="Full name *"
          autoComplete="name"
          className={inputClass}
        />
        <input
          value={form.phone}
          onChange={(e) => update("phone", e.target.value)}
          placeholder="Phone number *"
          type="tel"
          inputMode="tel"
          autoComplete="tel"
          className={inputClass}
        />
      </div>

      {/* Email */}
      <input
        value={form.email}
        onChange={(e) => update("email", e.target.value)}
        placeholder="Email address *"
        type="email"
        inputMode="email"
        autoComplete="email"
        className={`mt-3 ${inputClass}`}
      />

      {/* Address */}
      <input
        value={form.address}
        onChange={(e) => update("address", e.target.value)}
        placeholder="Project address *"
        autoComplete="street-address"
        className={`mt-3 ${inputClass}`}
      />

      {/* Project type + Contact preference */}
      <div className="mt-3 grid gap-3 sm:grid-cols-2">
        <div className="relative">
          <select
            value={form.projectType}
            onChange={(e) => update("projectType", e.target.value)}
            className={selectClass}
            aria-label="Project type"
          >
            <option value="roofing">{projectLabel("roofing")}</option>
            <option value="siding">{projectLabel("siding")}</option>
            <option value="both">{projectLabel("both")}</option>
          </select>
          <svg
            className="pointer-events-none absolute right-4 top-1/2 -translate-y-1/2 text-white/35"
            width="14"
            height="14"
            viewBox="0 0 24 24"
            fill="none"
            aria-hidden="true"
          >
            <path d="M6 9l6 6 6-6" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        </div>

        <div className="relative">
          <select
            value={form.contactPref}
            onChange={(e) => update("contactPref", e.target.value)}
            className={selectClass}
            aria-label="Preferred contact method"
          >
            <option value="call">Preferred: Call</option>
            <option value="text">Preferred: Text</option>
            <option value="email">Preferred: Email</option>
          </select>
          <svg
            className="pointer-events-none absolute right-4 top-1/2 -translate-y-1/2 text-white/35"
            width="14"
            height="14"
            viewBox="0 0 24 24"
            fill="none"
            aria-hidden="true"
          >
            <path d="M6 9l6 6 6-6" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        </div>
      </div>

      {/* Best time to contact */}
      <div className="relative mt-3">
        <select
          value={form.bestTime}
          onChange={(e) => update("bestTime", e.target.value)}
          className={selectClass}
          aria-label="Best time to contact"
        >
          <option value="any">Best time to reach you: Any time</option>
          <option value="morning">Morning (8am – 12pm)</option>
          <option value="afternoon">Afternoon (12pm – 5pm)</option>
          <option value="evening">Evening (5pm – 8pm)</option>
        </select>
        <svg
          className="pointer-events-none absolute right-4 top-1/2 -translate-y-1/2 text-white/35"
          width="14"
          height="14"
          viewBox="0 0 24 24"
          fill="none"
          aria-hidden="true"
        >
          <path d="M6 9l6 6 6-6" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      </div>

      {/* Notes */}
      <textarea
        value={form.notes}
        onChange={(e) => update("notes", e.target.value)}
        placeholder="Message / notes (optional - describe the project or any concerns)"
        rows={3}
        className="mt-3 w-full resize-none rounded-[14px] border border-white/12 bg-white/[0.07] px-4 py-3 text-[15px] text-white outline-none placeholder:text-white/32 focus:border-[#D4A574] transition-colors"
      />

      {/* Status message */}
      {message ? (
        <div
          className={`mt-4 rounded-[13px] border px-4 py-3 text-[13px] font-semibold ${
            status === "success"
              ? "border-emerald-300/28 bg-emerald-300/10 text-emerald-100"
              : "border-red-300/28 bg-red-300/10 text-red-100"
          }`}
        >
          {message}
        </div>
      ) : null}

      <button
        type="submit"
        disabled={status === "loading"}
        className="mt-5 inline-flex min-h-[58px] w-full items-center justify-center rounded-[16px] bg-[#D4A574] px-6 text-[16px] font-extrabold text-[#111827] shadow-[0_12px_32px_rgba(212,165,116,0.22)] transition hover:-translate-y-0.5 hover:bg-[#E0B886] disabled:cursor-not-allowed disabled:opacity-65"
      >
        {status === "loading" ? (
          <span className="flex items-center gap-2">
            <svg className="animate-spin" width="16" height="16" viewBox="0 0 24 24" fill="none" aria-hidden="true">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="3" />
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
            </svg>
            Sending…
          </span>
        ) : (
          "Send Estimate Request"
        )}
      </button>

      <p className="mt-3 text-center text-[11px] text-white/28">
        Free estimate · No commitment · We respond within 1 business day
      </p>
    </form>
  );
}
