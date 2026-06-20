"use client";

import Link from "next/link";
import { FormEvent, Suspense, useState } from "react";
import { useSearchParams } from "next/navigation";

type ProjectType =
  | "bathroom"
  | "kitchen"
  | "basement"
  | "interior"
  | "roofing"
  | "siding"
  | "other";

type ContactPreference = "call" | "text" | "email";

const PROJECT_OPTIONS: Array<{ value: ProjectType; label: string }> = [
  { value: "bathroom", label: "Bathroom Remodeling" },
  { value: "kitchen", label: "Kitchen Remodeling" },
  { value: "basement", label: "Basement Finishing" },
  { value: "interior", label: "Interior Renovations" },
  { value: "roofing", label: "Roofing" },
  { value: "siding", label: "Siding" },
  { value: "other", label: "Other Larger Project" },
];

const VALID_PROJECT_TYPES = new Set<ProjectType>(
  PROJECT_OPTIONS.map((option) => option.value)
);

function projectTypeFromQuery(value: string | null): ProjectType {
  const normalized = String(value || "").toLowerCase() as ProjectType;
  return VALID_PROJECT_TYPES.has(normalized) ? normalized : "bathroom";
}

const fieldClass =
  "h-[52px] w-full rounded-[12px] border border-[#CBD5E1] bg-white px-4 text-[15px] text-[#0B1628] outline-none transition placeholder:text-[#94A3B8] focus:border-[#306EEC] focus:ring-4 focus:ring-[#306EEC]/10";

const selectClass = `${fieldClass} appearance-none`;

function EstimateRequestForm() {
  const searchParams = useSearchParams();
  const initialProjectType = projectTypeFromQuery(searchParams.get("type"));
  const [form, setForm] = useState({
    name: "",
    phone: "",
    email: "",
    address: "",
    service: initialProjectType,
    notes: "",
    contactPref: "call" as ContactPreference,
    timeline: "",
    budgetRange: "",
  });
  const [status, setStatus] = useState<
    "idle" | "submitting" | "success" | "error"
  >("idle");
  const [message, setMessage] = useState("");

  const update = (field: keyof typeof form, value: string) => {
    setForm((current) => ({ ...current, [field]: value }));
    if (status === "error") {
      setStatus("idle");
      setMessage("");
    }
  };

  const submit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    if (
      !form.name.trim() ||
      !form.phone.trim() ||
      !form.email.trim() ||
      !form.address.trim() ||
      !form.notes.trim()
    ) {
      setStatus("error");
      setMessage("Please complete all required fields.");
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
      setMessage("Please enter the project address.");
      return;
    }

    setStatus("submitting");
    setMessage("");

    try {
      const apiUrl = process.env.NEXT_PUBLIC_API_URL ?? "";
      const response = await fetch(`${apiUrl}/api/estimates`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...form,
          name: form.name.trim(),
          phone: form.phone.trim(),
          email: form.email.trim(),
          address: form.address.trim(),
          notes: form.notes.trim(),
          source: "larger_project_request",
          sourcePage: `/estimate?type=${form.service}`,
        }),
      });
      const body = (await response.json().catch(() => ({}))) as {
        message?: string;
      };

      if (!response.ok) {
        setStatus("error");
        setMessage(
          body.message ||
            "We could not send your request. Please call 631-599-1363."
        );
        return;
      }

      setStatus("success");
      setMessage(
        "Thanks — your project request was sent. We’ll review it and get back to you."
      );
    } catch {
      setStatus("error");
      setMessage(
        "We could not send your request. Please call 631-599-1363."
      );
    }
  };

  if (status === "success") {
    return (
      <div className="rounded-[24px] border border-[#BBE4C8] bg-[#F1FBF4] p-7 sm:p-9">
        <div className="flex h-12 w-12 items-center justify-center rounded-full bg-[#DCFCE7] text-[#15803D]">
          <svg width="24" height="24" viewBox="0 0 24 24" fill="none">
            <path
              d="M5 12.5l4 4 10-10"
              stroke="currentColor"
              strokeWidth="2.4"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </svg>
        </div>
        <h2 className="mt-5 text-[26px] font-black text-[#0B1628]">
          Request received
        </h2>
        <p className="mt-2 text-[15px] leading-relaxed text-[#475569]">
          {message}
        </p>
        <div className="mt-6 flex flex-col gap-3 sm:flex-row">
          <Link
            href="/"
            className="inline-flex h-12 items-center justify-center rounded-[12px] bg-[#0B1628] px-5 text-[14px] font-bold text-white"
          >
            Return home
          </Link>
          <a
            href="tel:+16315991363"
            className="inline-flex h-12 items-center justify-center rounded-[12px] border border-[#CBD5E1] bg-white px-5 text-[14px] font-bold text-[#0B1628]"
          >
            Call 631-599-1363
          </a>
        </div>
      </div>
    );
  }

  return (
    <form
      onSubmit={submit}
      className="rounded-[24px] border border-[#D7DEE9] bg-white p-5 shadow-[0_24px_80px_rgba(15,23,42,0.10)] sm:p-7 lg:p-8"
    >
      <div className="mb-6">
        <div className="text-[11px] font-black uppercase tracking-[0.18em] text-[#306EEC]">
          Project details
        </div>
        <h2 className="mt-2 text-[24px] font-black leading-tight text-[#0B1628] sm:text-[28px]">
          Request a project estimate
        </h2>
        <p className="mt-2 text-[14px] leading-relaxed text-[#64748B]">
          Share the basics. A real person will review your request.
        </p>
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <label className="block">
          <span className="mb-1.5 block text-[13px] font-bold text-[#334155]">
            Name *
          </span>
          <input
            value={form.name}
            onChange={(event) => update("name", event.target.value)}
            className={fieldClass}
            autoComplete="name"
          />
        </label>
        <label className="block">
          <span className="mb-1.5 block text-[13px] font-bold text-[#334155]">
            Phone *
          </span>
          <input
            value={form.phone}
            onChange={(event) => update("phone", event.target.value)}
            className={fieldClass}
            type="tel"
            autoComplete="tel"
          />
        </label>
        <label className="block">
          <span className="mb-1.5 block text-[13px] font-bold text-[#334155]">
            Email *
          </span>
          <input
            value={form.email}
            onChange={(event) => update("email", event.target.value)}
            className={fieldClass}
            type="email"
            autoComplete="email"
          />
        </label>
        <label className="block">
          <span className="mb-1.5 block text-[13px] font-bold text-[#334155]">
            Preferred contact *
          </span>
          <select
            value={form.contactPref}
            onChange={(event) => update("contactPref", event.target.value)}
            className={selectClass}
          >
            <option value="call">Phone call</option>
            <option value="text">Text message</option>
            <option value="email">Email</option>
          </select>
        </label>
      </div>

      <label className="mt-4 block">
        <span className="mb-1.5 block text-[13px] font-bold text-[#334155]">
          Project address *
        </span>
        <input
          value={form.address}
          onChange={(event) => update("address", event.target.value)}
          className={fieldClass}
          autoComplete="street-address"
          placeholder="Street, city, state, ZIP"
        />
      </label>

      <label className="mt-4 block">
        <span className="mb-1.5 block text-[13px] font-bold text-[#334155]">
          Project type *
        </span>
        <select
          value={form.service}
          onChange={(event) => update("service", event.target.value)}
          className={selectClass}
        >
          {PROJECT_OPTIONS.map((option) => (
            <option key={option.value} value={option.value}>
              {option.label}
            </option>
          ))}
        </select>
      </label>

      <label className="mt-4 block">
        <span className="mb-1.5 block text-[13px] font-bold text-[#334155]">
          Tell us about the project *
        </span>
        <textarea
          value={form.notes}
          onChange={(event) => update("notes", event.target.value)}
          className={`${fieldClass} min-h-[118px] resize-y py-3`}
          placeholder="What are you planning, and what would you like to change?"
        />
      </label>

      <div className="mt-4 grid gap-4 sm:grid-cols-2">
        <label className="block">
          <span className="mb-1.5 block text-[13px] font-bold text-[#334155]">
            Timeline <span className="font-normal text-[#94A3B8]">(optional)</span>
          </span>
          <select
            value={form.timeline}
            onChange={(event) => update("timeline", event.target.value)}
            className={selectClass}
          >
            <option value="">Not sure yet</option>
            <option value="asap">As soon as possible</option>
            <option value="1month">Within one month</option>
            <option value="1-3months">Within 1–3 months</option>
            <option value="planning">Planning ahead</option>
          </select>
        </label>
        <label className="block">
          <span className="mb-1.5 block text-[13px] font-bold text-[#334155]">
            Budget range{" "}
            <span className="font-normal text-[#94A3B8]">(optional)</span>
          </span>
          <select
            value={form.budgetRange}
            onChange={(event) => update("budgetRange", event.target.value)}
            className={selectClass}
          >
            <option value="">Not sure yet</option>
            <option value="under-15k">Under $15,000</option>
            <option value="15k-30k">$15,000–$30,000</option>
            <option value="30k-60k">$30,000–$60,000</option>
            <option value="60k-100k">$60,000–$100,000</option>
            <option value="100k-plus">$100,000+</option>
          </select>
        </label>
      </div>

      {status === "error" ? (
        <div className="mt-5 rounded-[12px] border border-red-200 bg-red-50 px-4 py-3 text-[13px] font-semibold text-red-700">
          {message}
        </div>
      ) : null}

      <button
        type="submit"
        disabled={status === "submitting"}
        className="mt-6 inline-flex h-[54px] w-full items-center justify-center rounded-[14px] bg-[#306EEC] px-6 text-[15px] font-extrabold text-white shadow-[0_14px_36px_rgba(48,110,236,0.25)] transition hover:bg-[#2558C9] disabled:cursor-not-allowed disabled:opacity-60"
      >
        {status === "submitting" ? "Sending request..." : "Request Project Estimate"}
      </button>

      <p className="mt-3 text-center text-[12px] leading-relaxed text-[#94A3B8]">
        No obligation. Profixter is licensed and insured and serves Nassau and
        Suffolk Counties.
      </p>
    </form>
  );
}

export default function EstimatePage() {
  return (
    <main className="min-h-screen bg-[#F3F6FA]">
      <header className="border-b border-[#DDE4EE] bg-white">
        <div className="mx-auto flex h-[72px] max-w-[1180px] items-center justify-between px-5 sm:px-8">
          <Link href="/" className="text-[20px] font-black text-[#0B1628]">
            Profixter
          </Link>
          <a
            href="tel:+16315991363"
            className="text-[13px] font-bold text-[#306EEC]"
          >
            631-599-1363
          </a>
        </div>
      </header>

      <section className="relative overflow-hidden">
        <div className="absolute inset-x-0 top-0 h-[430px] bg-[#0B1628]" />
        <div className="relative mx-auto grid max-w-[1180px] gap-10 px-5 py-12 sm:px-8 sm:py-16 lg:grid-cols-[0.82fr_1.18fr] lg:items-start lg:gap-14 lg:py-20">
          <div className="pt-2 text-white lg:sticky lg:top-8">
            <div className="inline-flex rounded-full border border-white/15 bg-white/[0.07] px-3 py-1.5 text-[10px] font-black uppercase tracking-[0.18em] text-white/70">
              General Contractor · Larger Projects
            </div>
            <h1 className="mt-6 text-[38px] font-black leading-[1.02] tracking-[-0.035em] sm:text-[52px]">
              Tell us what you’re planning.
            </h1>
            <p className="mt-5 max-w-[500px] text-[17px] leading-relaxed text-white/68">
              We’ll review the project and get back to you.
            </p>

            <div className="mt-8 rounded-[18px] border border-white/12 bg-white/[0.06] p-5">
              <div className="text-[13px] font-extrabold text-white">
                Projects we can review
              </div>
              <div className="mt-4 grid gap-2 text-[13px] text-white/65 sm:grid-cols-2 lg:grid-cols-1">
                {PROJECT_OPTIONS.slice(0, 6).map((option) => (
                  <div key={option.value} className="flex items-center gap-2">
                    <span className="h-1.5 w-1.5 rounded-full bg-[#7FB1FF]" />
                    {option.label}
                  </div>
                ))}
              </div>
            </div>

            <p className="mt-6 max-w-[500px] text-[13px] leading-relaxed text-white/50">
              Get up to 12 months of Profixter membership included with eligible
              larger projects.
            </p>
          </div>

          <Suspense
            fallback={
              <div className="min-h-[620px] animate-pulse rounded-[24px] bg-white/80" />
            }
          >
            <EstimateRequestForm />
          </Suspense>
        </div>
      </section>
    </main>
  );
}
