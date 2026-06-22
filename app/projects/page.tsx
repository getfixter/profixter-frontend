"use client";

import Image from "next/image";
import Link from "next/link";
import { FormEvent, Suspense, useState } from "react";
import { useSearchParams } from "next/navigation";
import Header from "@/app/components/sections/Header";
import Footer from "@/app/components/sections/Footer";
import { ChatWidget } from "@/app/components/ChatWidget";

type ProjectType =
  | "roofing"
  | "siding"
  | "bathroom"
  | "kitchen"
  | "full-house"
  | "basement"
  | "interior"
  | "other";

type ContactPreference = "call" | "text" | "email";

const PROJECT_OPTIONS: Array<{ value: ProjectType; label: string }> = [
  { value: "roofing", label: "Roofing" },
  { value: "siding", label: "Siding" },
  { value: "bathroom", label: "Bathroom Remodeling" },
  { value: "kitchen", label: "Kitchen Remodeling" },
  { value: "full-house", label: "Full House Renovation" },
  { value: "basement", label: "Basement Finishing" },
  { value: "interior", label: "Interior Renovations" },
  { value: "other", label: "Other Larger Project" },
];

const PROJECT_TYPES = new Set<ProjectType>(
  PROJECT_OPTIONS.map((option) => option.value)
);

const SERVICES: Array<{
  id: string;
  type: ProjectType;
  eyebrow: string;
  title: string;
  description: string;
  details: string[];
  cta: string;
  image: string;
  imagePosition?: string;
  dark?: boolean;
}> = [
  {
    id: "roofing",
    type: "roofing",
    eyebrow: "Roofing",
    title: "A clear path from roof concern to completed work.",
    description:
      "We help Long Island homeowners plan roof repairs and replacements with a straightforward estimate process, practical material guidance, and clean project coordination.",
    details: [
      "Roof replacement and repair",
      "Shingle and material options",
      "Clear scope and estimate review",
    ],
    cta: "Get Roofing Estimate",
    image: "/images/projects/p7.jpg",
    imagePosition: "center",
  },
  {
    id: "siding",
    type: "siding",
    eyebrow: "Siding",
    title: "Protect the house and make the exterior feel finished.",
    description:
      "From damaged areas to full replacement, we help plan siding work around protection, curb appeal, materials, colors, trim, and the details that bring the exterior together.",
    details: [
      "Siding replacement and repair",
      "Material and color planning",
      "Trim and exterior coordination",
    ],
    cta: "Get Siding Estimate",
    image: "/images/projects/p4.jpg",
    imagePosition: "center",
    dark: true,
  },
  {
    id: "bathroom",
    type: "bathroom",
    eyebrow: "Bathroom Remodeling",
    title: "A better bathroom, planned as one complete project.",
    description:
      "We coordinate the moving parts of a bathroom remodel so the finished room feels intentional—from the shower and tile to the vanity, fixtures, and plumbing details.",
    details: [
      "Shower, tub, vanity, and tile",
      "Fixture and plumbing coordination",
      "Clean scope and finish planning",
    ],
    cta: "Get Bathroom Estimate",
    image: "/images/projects/p5.jpg",
    imagePosition: "center",
  },
  {
    id: "kitchen",
    type: "kitchen",
    eyebrow: "Kitchen Remodeling",
    title: "Bring the layout, finishes, and trades into one plan.",
    description:
      "Kitchen projects work best when cabinets, counters, backsplash, plumbing, electrical needs, and layout decisions are coordinated before work begins.",
    details: [
      "Cabinets, counters, and backsplash",
      "Layout and finish planning",
      "Plumbing and electrical coordination",
    ],
    cta: "Get Kitchen Estimate",
    image: "/images/projects/p2.jpg",
    imagePosition: "center",
    dark: true,
  },
  {
    id: "full-house",
    type: "full-house",
    eyebrow: "Full House Renovation",
    title: "One relationship for a multi-room renovation.",
    description:
      "For larger renovations, we help organize the priorities, sequence, and scope across rooms. Work can be planned as one project or in practical phases.",
    details: [
      "Multi-room updates",
      "Phased renovation planning",
      "One coordinated project relationship",
    ],
    cta: "Discuss Full House Renovation",
    image: "/images/projects/p8.jpg",
    imagePosition: "center",
  },
  {
    id: "basement-interior",
    type: "basement",
    eyebrow: "Basement & Interior Renovations",
    title: "Make underused space work harder for the household.",
    description:
      "We review basement finishing and interior renovation projects with the same practical approach: understand the space, define the result, and build a realistic plan.",
    details: [
      "Basement finishing",
      "Interior room renovations",
      "Functional layout improvements",
    ],
    cta: "Request Renovation Estimate",
    image: "/images/projects/p3.jpg",
    imagePosition: "center",
    dark: true,
  },
];

const fieldClass =
  "h-[52px] w-full rounded-[12px] border border-[#CBD5E1] bg-white px-4 text-[15px] text-[#0B1628] outline-none transition placeholder:text-[#94A3B8] focus:border-[#306EEC] focus:ring-4 focus:ring-[#306EEC]/10";

function projectTypeFromQuery(value: string | null): ProjectType {
  const normalized = String(value || "").toLowerCase() as ProjectType;
  return PROJECT_TYPES.has(normalized) ? normalized : "roofing";
}

function CheckIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <path
        d="M5 12.5l4 4 10-10"
        stroke="currentColor"
        strokeWidth="2.4"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function ArrowIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <path
        d="M5 12h14M13 6l6 6-6 6"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function EstimateForm() {
  const searchParams = useSearchParams();
  const initialType = projectTypeFromQuery(searchParams.get("type"));
  const [form, setForm] = useState({
    name: "",
    phone: "",
    email: "",
    address: "",
    service: initialType,
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
          source: "projects_page",
          sourcePage: `/projects?type=${form.service}#estimate`,
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
        "Thanks — your project request was received. We’ll review the details and get back to you."
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
      <div className="rounded-[26px] border border-[#B9E2C5] bg-[#F1FBF4] p-7 shadow-[0_24px_70px_rgba(15,23,42,0.08)] sm:p-10">
        <span className="flex h-12 w-12 items-center justify-center rounded-full bg-[#DCFCE7] text-[#15803D]">
          <CheckIcon />
        </span>
        <div className="mt-5 text-[11px] font-black uppercase tracking-[0.18em] text-[#15803D]">
          Successfully submitted
        </div>
        <h2 className="mt-2 text-[28px] font-black text-[#0B1628]">
          Request received
        </h2>
        <p className="mt-3 max-w-[560px] text-[15px] leading-relaxed text-[#475569]">
          {message}
        </p>
        <div className="mt-7 flex flex-col gap-3 sm:flex-row">
          <Link
            href="/"
            className="inline-flex h-12 items-center justify-center rounded-[12px] bg-[#0B1628] px-6 text-[14px] font-bold text-white"
          >
            Return home
          </Link>
          <a
            href="tel:+16315991363"
            className="inline-flex h-12 items-center justify-center rounded-[12px] border border-[#CBD5E1] bg-white px-6 text-[14px] font-bold text-[#0B1628]"
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
      className="rounded-[26px] border border-[#D7DEE9] bg-white p-5 shadow-[0_28px_90px_rgba(15,23,42,0.12)] sm:p-8"
    >
      <div className="mb-6">
        <div className="text-[11px] font-black uppercase tracking-[0.18em] text-[#306EEC]">
          Project details
        </div>
        <h2 className="mt-2 text-[27px] font-black leading-tight text-[#0B1628] sm:text-[32px]">
          Request a project estimate
        </h2>
        <p className="mt-2 text-[14px] leading-relaxed text-[#64748B]">
          Share the basics. A real person will review your request.
        </p>
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <label>
          <span className="mb-1.5 block text-[13px] font-bold text-[#334155]">Name *</span>
          <input
            value={form.name}
            onChange={(event) => update("name", event.target.value)}
            className={fieldClass}
            autoComplete="name"
          />
        </label>
        <label>
          <span className="mb-1.5 block text-[13px] font-bold text-[#334155]">Phone *</span>
          <input
            value={form.phone}
            onChange={(event) => update("phone", event.target.value)}
            className={fieldClass}
            type="tel"
            autoComplete="tel"
          />
        </label>
        <label>
          <span className="mb-1.5 block text-[13px] font-bold text-[#334155]">Email *</span>
          <input
            value={form.email}
            onChange={(event) => update("email", event.target.value)}
            className={fieldClass}
            type="email"
            autoComplete="email"
          />
        </label>
        <label>
          <span className="mb-1.5 block text-[13px] font-bold text-[#334155]">
            Preferred contact *
          </span>
          <select
            value={form.contactPref}
            onChange={(event) => update("contactPref", event.target.value)}
            className={fieldClass}
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
          className={fieldClass}
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
          className={`${fieldClass} min-h-[112px] resize-y py-3`}
          placeholder="What are you planning, and what would you like to change?"
        />
      </label>

      <div className="mt-4 grid gap-4 sm:grid-cols-2">
        <label>
          <span className="mb-1.5 block text-[13px] font-bold text-[#334155]">
            Timeline <span className="font-normal text-[#94A3B8]">(optional)</span>
          </span>
          <select
            value={form.timeline}
            onChange={(event) => update("timeline", event.target.value)}
            className={fieldClass}
          >
            <option value="">Not sure yet</option>
            <option value="asap">As soon as possible</option>
            <option value="1month">Within one month</option>
            <option value="1-3months">Within 1–3 months</option>
            <option value="planning">Planning ahead</option>
          </select>
        </label>
        <label>
          <span className="mb-1.5 block text-[13px] font-bold text-[#334155]">
            Budget range <span className="font-normal text-[#94A3B8]">(optional)</span>
          </span>
          <select
            value={form.budgetRange}
            onChange={(event) => update("budgetRange", event.target.value)}
            className={fieldClass}
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
        className="mt-6 inline-flex h-[54px] w-full items-center justify-center rounded-[14px] bg-[#306EEC] px-6 text-[15px] font-extrabold text-white shadow-[0_14px_36px_rgba(48,110,236,0.25)] transition hover:bg-[#2558C9] disabled:opacity-60"
      >
        {status === "submitting" ? "Sending request..." : "Request Project Estimate"}
      </button>
      <p className="mt-3 text-center text-[12px] leading-relaxed text-[#94A3B8]">
        No obligation. Licensed and insured. Serving Nassau and Suffolk Counties.
      </p>
    </form>
  );
}

function ServiceSection({ service, index }: { service: (typeof SERVICES)[number]; index: number }) {
  const dark = service.dark;
  return (
    <section
      id={service.id}
      className={`scroll-mt-[96px] py-16 sm:py-20 lg:py-24 ${
        dark ? "bg-[#0B1628] text-white" : "bg-[#F6F8FC] text-[#0B1628]"
      }`}
    >
      <div
        className={`mx-auto grid max-w-[1180px] items-center gap-9 px-5 sm:px-8 lg:grid-cols-2 lg:gap-16 ${
          index % 2 ? "lg:[&>*:first-child]:order-2" : ""
        }`}
      >
        <div className="relative min-h-[300px] overflow-hidden rounded-[24px] sm:min-h-[390px]">
          <Image
            src={service.image}
            alt={`${service.eyebrow} project by Profixter`}
            fill
            className="object-cover"
            style={{ objectPosition: service.imagePosition }}
            sizes="(max-width: 1024px) 92vw, 560px"
          />
          <div className="absolute inset-0 bg-gradient-to-t from-[#07101F]/60 via-transparent to-transparent" />
          <div className="absolute bottom-5 left-5 rounded-full border border-white/20 bg-[#07101F]/70 px-4 py-2 text-[11px] font-bold uppercase tracking-[0.16em] text-white backdrop-blur">
            Long Island, NY
          </div>
        </div>

        <div>
          <div
            className={`text-[11px] font-black uppercase tracking-[0.2em] ${
              dark ? "text-[#93C5FD]" : "text-[#306EEC]"
            }`}
          >
            {service.eyebrow}
          </div>
          <h2 className="mt-4 text-[34px] font-black leading-[1.02] tracking-[-0.035em] sm:text-[46px]">
            {service.title}
          </h2>
          <p
            className={`mt-5 text-[16px] leading-relaxed ${
              dark ? "text-white/62" : "text-[#475569]"
            }`}
          >
            {service.description}
          </p>
          <div className="mt-6 space-y-3">
            {service.details.map((detail) => (
              <div key={detail} className="flex items-center gap-3">
                <span
                  className={`flex h-6 w-6 items-center justify-center rounded-full ${
                    dark ? "bg-white/10 text-[#86EFAC]" : "bg-[#E8F8EE] text-[#16834B]"
                  }`}
                >
                  <CheckIcon />
                </span>
                <span className={`text-[14px] font-semibold ${dark ? "text-white/75" : "text-[#334155]"}`}>
                  {detail}
                </span>
              </div>
            ))}
          </div>
          <p className={`mt-6 text-[13px] ${dark ? "text-white/42" : "text-[#64748B]"}`}>
            Eligible larger projects may include up to 12 months of Profixter membership.
          </p>
          <Link
            href={`/projects?type=${service.type}#estimate`}
            className={`mt-7 inline-flex min-h-[52px] items-center justify-center gap-2 rounded-[14px] px-6 text-[14px] font-extrabold transition ${
              dark
                ? "bg-white text-[#0B1628] hover:bg-[#EAF1FF]"
                : "bg-[#0B1628] text-white hover:bg-[#17263D]"
            }`}
          >
            {service.cta}
            <ArrowIcon />
          </Link>
        </div>
      </div>
    </section>
  );
}

function ProjectsContent() {
  const searchParams = useSearchParams();
  const selectedType = searchParams.get("type") || "roofing";

  return (
    <div className="min-h-screen overflow-x-hidden bg-[#F6F8FC]">
      <div className="sticky top-0 z-50">
        <Header />
      </div>

      <main>
        <section className="relative overflow-hidden bg-[#07101F] text-white">
          <div className="absolute inset-0">
            <Image
              src="/images/hero-bg.webp"
              alt=""
              fill
              priority
              className="object-cover opacity-25"
            />
            <div className="absolute inset-0 bg-[linear-gradient(90deg,rgba(7,16,31,0.97)_0%,rgba(7,16,31,0.84)_52%,rgba(7,16,31,0.55)_100%)]" />
          </div>
          <div className="relative mx-auto max-w-[1180px] px-5 py-16 sm:px-8 sm:py-24 lg:py-28">
            <div className="max-w-[790px]">
              <div className="inline-flex items-center gap-2 rounded-full border border-white/15 bg-white/[0.06] px-4 py-2 text-[10px] font-black uppercase tracking-[0.18em] text-white/70">
                Local Long Island team · Licensed &amp; insured
              </div>
              <h1 className="mt-7 text-[44px] font-black leading-[0.94] tracking-[-0.045em] sm:text-[66px] lg:text-[78px]">
                One team for the project—and the home after.
              </h1>
              <p className="mt-6 max-w-[680px] text-[17px] leading-relaxed text-white/65 sm:text-[19px]">
                Roofing, siding, bathrooms, kitchens, and full-house renovations
                planned with one contractor relationship. After the work is done,
                Profixter can keep helping maintain the home.
              </p>
              <div className="mt-8 flex flex-wrap gap-2.5">
                {[
                  ["Roofing", "#roofing"],
                  ["Siding", "#siding"],
                  ["Bathroom", "#bathroom"],
                  ["Kitchen", "#kitchen"],
                  ["Full House Renovation", "#full-house"],
                ].map(([label, href]) => (
                  <Link
                    key={href}
                    href={href}
                    className="rounded-full border border-white/15 bg-white/[0.06] px-4 py-2 text-[12px] font-bold text-white/75 transition hover:bg-white/[0.12] hover:text-white"
                  >
                    {label}
                  </Link>
                ))}
              </div>
              <div className="mt-9 flex flex-col gap-3 sm:flex-row">
                <Link
                  href="#estimate"
                  className="inline-flex min-h-[56px] items-center justify-center gap-2 rounded-[15px] bg-[#306EEC] px-7 text-[15px] font-extrabold text-white shadow-[0_16px_40px_rgba(48,110,236,0.32)] transition hover:bg-[#2558C9]"
                >
                  Get Project Estimate
                  <ArrowIcon />
                </Link>
                <a
                  href="tel:+16315991363"
                  className="inline-flex min-h-[56px] items-center justify-center rounded-[15px] border border-white/18 bg-white/[0.07] px-7 text-[15px] font-bold text-white"
                >
                  Call 631-599-1363
                </a>
              </div>
            </div>

            <div className="mt-12 max-w-[720px] rounded-[20px] border border-[#D4A574]/25 bg-[#D4A574]/10 p-5 backdrop-blur-sm sm:flex sm:items-center sm:justify-between sm:gap-6">
              <div>
                <div className="text-[11px] font-black uppercase tracking-[0.17em] text-[#F1D3A9]">
                  Project benefit
                </div>
                <p className="mt-1.5 text-[14px] font-semibold leading-relaxed text-white/78">
                  Eligible larger projects may include up to 12 months of Profixter membership.
                </p>
              </div>
              <Link
                href="#estimate"
                className="mt-4 inline-flex shrink-0 items-center gap-2 text-[13px] font-bold text-white sm:mt-0"
              >
                Ask about eligibility <ArrowIcon />
              </Link>
            </div>
          </div>
        </section>

        <section className="border-b border-[#DDE4EE] bg-white py-8">
          <div className="mx-auto grid max-w-[1180px] gap-4 px-5 sm:grid-cols-3 sm:px-8">
            {[
              ["One relationship", "A single team to discuss the larger project and ongoing home care."],
              ["Clear planning", "A practical scope, estimate review, and next-step conversation."],
              ["Support after", "Eligible projects can transition into ongoing Profixter maintenance."],
            ].map(([title, body]) => (
              <div key={title} className="rounded-[16px] border border-[#E2E8F0] bg-[#F8FAFC] p-4">
                <div className="text-[14px] font-extrabold text-[#0B1628]">{title}</div>
                <p className="mt-1.5 text-[13px] leading-relaxed text-[#64748B]">{body}</p>
              </div>
            ))}
          </div>
        </section>

        {SERVICES.map((service, index) => (
          <ServiceSection key={service.id} service={service} index={index} />
        ))}

        <section id="estimate" className="scroll-mt-[90px] bg-[#EAF0F8] py-16 sm:py-20 lg:py-24">
          <div className="mx-auto grid max-w-[1180px] gap-10 px-5 sm:px-8 lg:grid-cols-[0.78fr_1.22fr] lg:items-start lg:gap-14">
            <div className="lg:sticky lg:top-28">
              <div className="text-[11px] font-black uppercase tracking-[0.18em] text-[#306EEC]">
                Start the conversation
              </div>
              <h2 className="mt-4 text-[38px] font-black leading-[0.98] tracking-[-0.04em] text-[#0B1628] sm:text-[50px]">
                Tell us what you’re planning.
              </h2>
              <p className="mt-5 text-[16px] leading-relaxed text-[#475569]">
                We’ll review the project and get back to you. No oversized
                questionnaire and no obligation.
              </p>
              <div className="mt-7 space-y-3">
                {[
                  "Local Long Island team",
                  "Licensed and insured",
                  "Nassau and Suffolk Counties",
                  "Straightforward personal follow-up",
                ].map((item) => (
                  <div key={item} className="flex items-center gap-3 text-[14px] font-semibold text-[#334155]">
                    <span className="flex h-6 w-6 items-center justify-center rounded-full bg-white text-[#16834B]">
                      <CheckIcon />
                    </span>
                    {item}
                  </div>
                ))}
              </div>
            </div>

            <Suspense fallback={<div className="min-h-[660px] animate-pulse rounded-[26px] bg-white/70" />}>
              <EstimateForm key={selectedType} />
            </Suspense>
          </div>
        </section>
      </main>

      <Footer />
      <ChatWidget />
    </div>
  );
}

export default function ProjectsPage() {
  return (
    <Suspense fallback={<div className="min-h-screen bg-[#07101F]" />}>
      <ProjectsContent />
    </Suspense>
  );
}
