"use client";

import Image from "next/image";
import Link from "next/link";
import { FormEvent, Suspense, useState } from "react";
import { useSearchParams } from "next/navigation";
import Header from "@/app/components/sections/Header";
import Footer from "@/app/components/sections/Footer";
import MembershipCtaLink from "@/app/components/membership/MembershipCtaLink";

type ProjectType =
  | "roofing"
  | "siding"
  | "kitchen"
  | "bathroom"
  | "build-new-house"
  | "other";

type ContactPreference = "call" | "text" | "email";
type ServiceKey = ProjectType | "full-house";

const PROJECT_OPTIONS: Array<{ value: ProjectType; label: string }> = [
  { value: "roofing", label: "Roofing" },
  { value: "siding", label: "Siding" },
  { value: "kitchen", label: "Kitchen" },
  { value: "bathroom", label: "Bathroom" },
  { value: "build-new-house", label: "Build New House" },
  { value: "other", label: "Other" },
];

const PROJECT_TYPES = new Set<ProjectType>(
  PROJECT_OPTIONS.map((option) => option.value)
);

const LEGACY_TYPE_MAP: Record<string, ProjectType> = {
  "full-house": "other",
  basement: "other",
  interior: "other",
  "new-house": "build-new-house",
  "new-construction": "build-new-house",
};

const PROJECT_IMAGES = {
  roof: "/images/projects/Roof%20Project.jpg",
  siding: "/images/projects/Siding%20Project.jpg",
  kitchen: "/images/projects/Kitchen%20Project.jpg",
  bathroom: "/images/projects/Bathroom%20Project.jpg",
  fullHouse: "/images/projects/Full%20House%20Project.avif",
  newHouse: "/images/projects/New%20House%20Project.jpg",
};

const SERVICES: Array<{
  id: string;
  type: ServiceKey;
  estimateType?: ProjectType;
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
    title: "Get New Roofing",
    description:
      "Profixter plans roof replacements and larger roofing work with a clear scope, strong cleanup standards, and professional project coordination. Most standard roof replacements are usually completed in 1 day and include a 5-year labor warranty.",
    details: [
      "Usually completed in 1 day for standard roof replacements",
      "5-year labor warranty",
      "Shingle, ventilation, flashing, and material guidance",
      "Clean tear-off, installation, and final cleanup coordination",
    ],
    cta: "Get Roofing Estimate",
    image: PROJECT_IMAGES.roof,
    imagePosition: "center",
  },
  {
    id: "siding",
    type: "siding",
    eyebrow: "Siding",
    title: "Get New Siding",
    description:
      "New siding should protect the home and make the exterior feel custom, not generic. We help homeowners compare unique siding options, trim details, colors, and finishing choices, with a 5-year labor warranty on qualifying siding work.",
    details: [
      "Unique siding options and custom exterior looks",
      "5-year labor warranty",
      "Trim, soffit, fascia, and detail coordination",
      "Color, profile, and curb-appeal planning",
    ],
    cta: "Get Siding Estimate",
    image: PROJECT_IMAGES.siding,
    imagePosition: "center",
    dark: true,
  },
  {
    id: "kitchen",
    type: "kitchen",
    eyebrow: "Kitchen Remodeling",
    title: "Get a New Kitchen",
    description:
      "Kitchen projects work best when layout, cabinets, counters, backsplash, lighting, plumbing, finish choices, and trade coordination are planned before demolition starts.",
    details: [
      "Cabinets, counters, backsplash, and finish planning",
      "Layout and storage improvements",
      "Lighting, plumbing, and trade coordination",
      "A cleaner path from idea to written scope",
    ],
    cta: "Get Kitchen Estimate",
    image: PROJECT_IMAGES.kitchen,
    imagePosition: "center",
    dark: true,
  },
  {
    id: "bathroom",
    type: "bathroom",
    eyebrow: "Bathroom Remodeling",
    title: "Get a New Bathroom",
    description:
      "A bathroom remodel has to work in a small space with many moving parts. Profixter coordinates the tile, shower, vanity, fixtures, waterproofing, finishes, and schedule into one practical project plan.",
    details: [
      "Shower, tub, vanity, tile, and finish planning",
      "Waterproofing and wet-area details reviewed carefully",
      "Fixture, lighting, and layout coordination",
      "Clear estimate path before work begins",
    ],
    cta: "Get Bathroom Estimate",
    image: PROJECT_IMAGES.bathroom,
    imagePosition: "center",
  },
  {
    id: "full-house",
    type: "full-house",
    estimateType: "other",
    eyebrow: "Whole Home Renovation",
    title: "Full House Renovation",
    description:
      "For whole-home and multi-room renovations, Profixter helps organize priorities, sequencing, trade coordination, finishes, and phasing so the project feels manageable from the first conversation.",
    details: [
      "Multi-room renovation planning",
      "Kitchen, bathroom, flooring, walls, and finish coordination",
      "Phased or full-scope project planning",
      "One General Contractor relationship",
    ],
    cta: "Discuss Full House Renovation",
    image: PROJECT_IMAGES.fullHouse,
    imagePosition: "center",
  },
  {
    id: "build-new-house",
    type: "build-new-house",
    eyebrow: "New Construction",
    title: "Build New House",
    description:
      "We build houses from start to finish as a General Contractor. Profixter/Premium Island Homes can handle the whole project as the GC, from planning and coordination to construction management.",
    details: [
      "General Contractor project leadership",
      "Planning, permitting, and trade coordination",
      "Construction management from start to finish",
      "A single accountable team for the build",
    ],
    cta: "Discuss a New House",
    image: PROJECT_IMAGES.newHouse,
    imagePosition: "center",
    dark: true,
  },
];

const fieldClass =
  "h-[52px] w-full rounded-[12px] border border-[#CBD5E1] bg-white px-4 text-[15px] text-[#0B1628] outline-none transition placeholder:text-[#94A3B8] focus:border-[#306EEC] focus:ring-4 focus:ring-[#306EEC]/10";

function projectTypeFromQuery(value: string | null): ProjectType {
  const normalized = String(value || "").toLowerCase();
  const mapped = LEGACY_TYPE_MAP[normalized] || normalized;
  return PROJECT_TYPES.has(mapped as ProjectType) ? (mapped as ProjectType) : "roofing";
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
        "Thanks - your project request was received. We will review the details and get back to you."
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
          Renovation estimate
        </div>
        <h2 className="mt-2 text-[27px] font-black leading-tight text-[#0B1628] sm:text-[32px]">
          Tell us what you want built.
        </h2>
        <p className="mt-2 text-[14px] leading-relaxed text-[#64748B]">
          Pick a project type, share the basics, and a real person will review the request.
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

      <fieldset className="mt-5">
        <legend className="mb-2 block text-[13px] font-bold text-[#334155]">
          Project type *
        </legend>
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
          {PROJECT_OPTIONS.map((option) => {
            const active = form.service === option.value;
            return (
              <button
                key={option.value}
                type="button"
                onClick={() => update("service", option.value)}
                className={`min-h-[48px] rounded-[14px] border px-3 text-left text-[13px] font-extrabold transition ${
                  active
                    ? "border-[#306EEC] bg-[#EEF4FF] text-[#1648A8] shadow-[0_10px_24px_rgba(48,110,236,0.16)]"
                    : "border-[#D7DEE9] bg-[#F8FAFC] text-[#334155] hover:border-[#AFC3DF] hover:bg-white"
                }`}
                aria-pressed={active}
              >
                {option.label}
              </button>
            );
          })}
        </div>
      </fieldset>

      <label className="mt-4 block">
        <span className="mb-1.5 block text-[13px] font-bold text-[#334155]">
          Tell us about the project *
        </span>
        <textarea
          value={form.notes}
          onChange={(event) => update("notes", event.target.value)}
          className={`${fieldClass} min-h-[116px] resize-y py-3`}
          placeholder="What are you planning? Include goals, rooms, exterior areas, timing, and anything you already know."
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
            <option value="1-3months">Within 1-3 months</option>
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
            <option value="15k-30k">$15,000-$30,000</option>
            <option value="30k-60k">$30,000-$60,000</option>
            <option value="60k-100k">$60,000-$100,000</option>
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
        className="mt-6 inline-flex h-[50px] w-full items-center justify-center rounded-[14px] bg-[#306EEC] px-5 text-[14px] font-extrabold text-white shadow-[0_14px_36px_rgba(48,110,236,0.25)] transition hover:bg-[#2558C9] disabled:opacity-60 sm:h-[54px] sm:px-6 sm:text-[15px]"
      >
        {status === "submitting" ? "Sending request..." : "Request Renovation Estimate"}
      </button>
      <p className="mt-3 text-center text-[12px] leading-relaxed text-[#94A3B8]">
        Renovation estimates are separate from One-Time Handyman Visits. No obligation. Licensed and insured.
      </p>
    </form>
  );
}

function ServiceSection({ service, index }: { service: (typeof SERVICES)[number]; index: number }) {
  const dark = service.dark;
  const estimateType = service.estimateType || (service.type as ProjectType);

  return (
    <section
      id={service.id}
      className={`scroll-mt-[96px] py-12 sm:py-20 lg:py-24 ${
        dark ? "bg-[#0B1628] text-white" : "bg-[#F6F8FC] text-[#0B1628]"
      }`}
    >
      <div
        className={`mx-auto grid max-w-[1220px] items-center gap-9 px-5 sm:px-8 lg:grid-cols-2 lg:gap-16 ${
          index % 2 ? "lg:[&>*:first-child]:order-2" : ""
        }`}
      >
        <div className="relative min-h-[260px] overflow-hidden rounded-[24px] shadow-[0_24px_64px_rgba(15,23,42,0.16)] sm:min-h-[440px] sm:rounded-[28px] sm:shadow-[0_30px_80px_rgba(15,23,42,0.18)]">
          <Image
            src={service.image}
            alt={`${service.title} project by Profixter`}
            fill
            className="object-cover"
            style={{ objectPosition: service.imagePosition }}
            sizes="(max-width: 1024px) 92vw, 590px"
          />
          <div className="absolute inset-0 bg-gradient-to-t from-[#07101F]/65 via-transparent to-transparent" />
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
          <h2 className="mt-3 text-[36px] font-black leading-[0.98] tracking-[-0.036em] sm:mt-4 sm:text-[58px] sm:leading-[0.94] sm:tracking-[-0.045em] lg:text-[64px]">
            {service.title}
          </h2>
          <p
            className={`mt-4 text-[15px] leading-relaxed sm:mt-5 sm:text-[17px] ${
              dark ? "text-white/70" : "text-[#475569]"
            }`}
          >
            {service.description}
          </p>
          <div className="mt-6 grid gap-2.5 sm:mt-7 sm:gap-3">
            {service.details.map((detail) => (
              <div key={detail} className="flex items-start gap-3">
                <span
                  className={`mt-0.5 flex h-6 w-6 flex-shrink-0 items-center justify-center rounded-full ${
                    dark ? "bg-white/10 text-[#86EFAC]" : "bg-[#E8F8EE] text-[#16834B]"
                  }`}
                >
                  <CheckIcon />
                </span>
                <span className={`text-[14px] font-semibold leading-6 ${dark ? "text-white/80" : "text-[#334155]"}`}>
                  {detail}
                </span>
              </div>
            ))}
          </div>
          <p className={`mt-6 text-[13px] ${dark ? "text-white/50" : "text-[#64748B]"}`}>
            Members may receive project discounts. Eligible larger projects may include up to 12 months of Profixter Membership.
          </p>
          <Link
            href={`/projects?type=${estimateType}#estimate`}
            className={`mt-6 inline-flex min-h-[48px] items-center justify-center gap-2 rounded-[14px] px-5 text-[14px] font-extrabold transition sm:mt-7 sm:min-h-[52px] sm:px-6 ${
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
  const selectedType = projectTypeFromQuery(searchParams.get("type"));

  return (
    <div className="min-h-screen overflow-x-hidden bg-[#F6F8FC]">
      <div className="sticky top-0 z-50">
        <Header />
      </div>

      <main>
        <section className="relative overflow-hidden bg-[#07101F] text-white">
          <div className="absolute inset-0">
            <Image
              src={PROJECT_IMAGES.fullHouse}
              alt=""
              fill
              priority
              className="object-cover opacity-[0.42]"
              sizes="100vw"
            />
            <div className="absolute inset-0 bg-[linear-gradient(90deg,rgba(7,16,31,0.96)_0%,rgba(7,16,31,0.84)_48%,rgba(7,16,31,0.48)_100%)]" />
          </div>
          <div className="relative mx-auto max-w-[1220px] px-4 py-12 sm:px-8 sm:py-24 lg:py-28">
            <div className="max-w-[820px]">
              <div className="inline-flex items-center gap-2 rounded-full border border-white/15 bg-white/[0.08] px-4 py-2 text-[10px] font-black uppercase tracking-[0.18em] text-white/80">
                General Contractor Long Island
              </div>
              <h1 className="mt-5 text-[38px] font-black leading-[0.96] tracking-[-0.04em] sm:mt-7 sm:text-[70px] sm:leading-[0.92] sm:tracking-[-0.05em] lg:text-[84px]">
                Renovation and home projects, handled by one team.
              </h1>
              <p className="mt-4 max-w-[700px] text-[15px] leading-relaxed text-white/75 sm:mt-6 sm:text-[19px]">
                Profixter is a General Contractor for larger Long Island home projects: roofing, siding, kitchens, bathrooms, full-house renovations, and new house builds. Renovation estimates are separate from One-Time Handyman Visits.
              </p>
              <div className="mt-6 flex flex-wrap gap-2 sm:mt-8 sm:gap-2.5">
                {[
                  ["Roofing", "#roofing"],
                  ["Siding", "#siding"],
                  ["Kitchen", "#kitchen"],
                  ["Bathroom", "#bathroom"],
                  ["Full House", "#full-house"],
                  ["Build New House", "#build-new-house"],
                ].map(([label, href]) => (
                  <Link
                    key={href}
                    href={href}
                    className="rounded-full border border-white/15 bg-white/[0.07] px-4 py-2 text-[12px] font-bold text-white/80 transition hover:bg-white/[0.14] hover:text-white"
                  >
                    {label}
                  </Link>
                ))}
              </div>
              <div className="mt-7 flex flex-col gap-2.5 sm:mt-9 sm:flex-row sm:gap-3">
                <Link
                  href="#estimate"
                  className="inline-flex min-h-[50px] items-center justify-center gap-2 rounded-[14px] bg-[#306EEC] px-6 text-[14px] font-extrabold text-white shadow-[0_16px_40px_rgba(48,110,236,0.32)] transition hover:bg-[#2558C9] sm:min-h-[56px] sm:rounded-[15px] sm:px-7 sm:text-[15px]"
                >
                  Request Renovation Estimate
                  <ArrowIcon />
                </Link>
                <a
                  href="tel:+16315991363"
                  className="inline-flex min-h-[50px] items-center justify-center rounded-[14px] border border-white/20 bg-white/[0.07] px-6 text-[14px] font-bold text-white sm:min-h-[56px] sm:rounded-[15px] sm:px-7 sm:text-[15px]"
                >
                  Call 631-599-1363
                </a>
              </div>
            </div>

            <div className="mt-9 grid max-w-[940px] gap-2.5 sm:mt-12 sm:grid-cols-3 sm:gap-3">
              {[
                [
                  "Member discounts",
                  "Members get better long-term value and may receive discounts on larger work.",
                  "/membership",
                  "Learn about Membership",
                ],
                [
                  "Membership included",
                  "Some larger projects may include up to 12 months of Profixter Membership.",
                  "/membership#plans",
                  "Become a Member",
                ],
                [
                  "Not handyman visits",
                  "Project estimates are for larger work, not $99 One-Time Handyman Visits.",
                  "/book",
                  "Book a small visit",
                ],
              ].map(([title, body, href, cta]) => (
                <div key={title} className="rounded-[20px] border border-white/15 bg-white/[0.08] p-4 backdrop-blur">
                  <div className="text-[13px] font-extrabold text-white">{title}</div>
                  <p className="mt-1.5 text-[13px] leading-relaxed text-white/65">{body}</p>
                  {cta === "Become a Member" ? (
                    <MembershipCtaLink className="mt-3 inline-flex text-[12px] font-black text-white underline decoration-white/30 underline-offset-4 transition hover:text-white/80">
                      {cta}
                    </MembershipCtaLink>
                  ) : (
                    <Link
                      href={href}
                      className="mt-3 inline-flex text-[12px] font-black text-white underline decoration-white/30 underline-offset-4 transition hover:text-white/80"
                    >
                      {cta}
                    </Link>
                  )}
                </div>
              ))}
            </div>
          </div>
        </section>

        <section className="border-b border-[#DDE4EE] bg-white py-8">
          <div className="mx-auto grid max-w-[1220px] gap-4 px-5 sm:grid-cols-3 sm:px-8">
            {[
              ["General Contractor", "A single team to plan, coordinate, and manage larger work."],
              ["Clear estimate path", "A practical scope conversation before you commit to a project."],
              ["Long Island focused", "Built for Nassau and Suffolk homeowners who want accountable local help."],
            ].map(([title, body]) => (
              <div key={title} className="rounded-[10px] border-l-2 border-[#CBD5E1] bg-[#F8FAFC] px-4 py-3.5">
                <div className="text-[14px] font-extrabold text-[#0B1628]">{title}</div>
                <p className="mt-1.5 text-[13px] leading-relaxed text-[#64748B]">{body}</p>
              </div>
            ))}
          </div>
        </section>

        {SERVICES.map((service, index) => (
          <ServiceSection key={service.id} service={service} index={index} />
        ))}

        <section id="estimate" className="scroll-mt-[90px] bg-[#EAF0F8] py-12 sm:py-20 lg:py-24">
          <div className="mx-auto grid max-w-[1220px] gap-8 px-4 sm:px-8 lg:grid-cols-[0.78fr_1.22fr] lg:items-start lg:gap-14">
            <div className="lg:sticky lg:top-28">
              <div className="text-[11px] font-black uppercase tracking-[0.18em] text-[#306EEC]">
                Start the conversation
              </div>
              <h2 className="mt-3 text-[32px] font-black leading-[1.02] tracking-[-0.035em] text-[#0B1628] sm:mt-4 sm:text-[50px] sm:leading-[0.98] sm:tracking-[-0.04em]">
                Get a real project estimate.
              </h2>
              <p className="mt-4 text-[15px] leading-relaxed text-[#475569] sm:mt-5 sm:text-[16px]">
                We review larger projects personally. Tell us the project type, address, and what you want done, then we will follow up with the right next step.
              </p>
              <div className="mt-7 space-y-3">
                {[
                  "General Contractor for larger home projects",
                  "Roofing, siding, kitchens, bathrooms, new builds",
                  "Members may receive project discounts",
                  "Separate from One-Time Handyman Visits",
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
