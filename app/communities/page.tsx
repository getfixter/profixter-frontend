"use client";

import { FormEvent, useState } from "react";
import Footer from "@/app/components/sections/Footer";
import Header from "@/app/components/sections/Header";
import { PUBLIC_CONTACT_EMAIL as CONTACT_EMAIL } from "@/lib/contact";

const CONTACT_PHONE_DISPLAY = "631-599-1363";
const CONTACT_PHONE_TEL = "tel:6315991363";
const SUCCESS_MESSAGE = "Thank you — we received your request. We’ll reach out shortly.";

type FormState = {
  communityName: string;
  contactName: string;
  roleTitle: string;
  email: string;
  phone: string;
  location: string;
  homesUnits: string;
  message: string;
};

const initialForm: FormState = {
  communityName: "",
  contactName: "",
  roleTitle: "",
  email: "",
  phone: "",
  location: "",
  homesUnits: "",
  message: "",
};

const trustItems = [
  "Local Long Island Company",
  "Professional Scheduling System",
  "Simple Resident Experience",
  "Ongoing Home Maintenance Support",
  "Responsive Service",
  "Modern Technology Platform",
];

const reasons = [
  {
    title: "Reduce Resident Frustration",
    text: "Residents often struggle to find reliable help for small projects, repairs, and maintenance tasks.",
  },
  {
    title: "Provide A Trusted Resource",
    text: "Give homeowners a vetted local option instead of sending them to random contractor searches.",
  },
  {
    title: "Improve Resident Experience",
    text: "Make it easier for residents to handle everyday home needs without adding work for management.",
  },
  {
    title: "Modern Booking Experience",
    text: "Residents get simple scheduling, clear communication, and a more organized service process.",
  },
  {
    title: "Flexible Support",
    text: "From small repairs to larger improvement conversations, Profixter can be a practical first call.",
  },
  {
    title: "Local Presence",
    text: "A Long Island based team focused on Nassau and Suffolk homeowners.",
  },
];

const services = [
  "TV Mounting",
  "Light Fixtures",
  "Ceiling Fans",
  "Door Repairs",
  "Drywall Repairs",
  "Caulking",
  "Shelving",
  "Furniture Assembly",
  "Trim Work",
  "Minor Carpentry",
  "Bathroom Repairs",
  "Home Maintenance Tasks",
];

const benefits = [
  "Resident discount opportunities",
  "Priority scheduling programs",
  "Educational maintenance workshops",
  "Seasonal home maintenance guidance",
  "Reliable local contact",
  "Dedicated community support",
];

const faqs = [
  {
    q: "Is there any cost to the community?",
    a: "A conversation costs nothing. Partnership structure depends on what your board or management team wants to offer residents.",
  },
  {
    q: "Do residents need memberships?",
    a: "Not necessarily. We can discuss the simplest way for residents to access Profixter based on your community goals.",
  },
  {
    q: "Can communities offer resident discounts?",
    a: "Yes, resident discount opportunities can be discussed as part of a community partnership.",
  },
  {
    q: "Do you handle larger projects?",
    a: "Yes. We can review larger project requests separately while keeping everyday maintenance support easy for residents.",
  },
  {
    q: "What areas do you serve?",
    a: "Profixter serves Long Island, with a focus on Nassau and Suffolk Counties.",
  },
  {
    q: "Can we schedule a meeting?",
    a: `Yes. Send the form or call ${CONTACT_PHONE_DISPLAY} and we can set up a partnership conversation.`,
  },
];

const fieldClass =
  "mt-1.5 h-12 w-full rounded-[14px] border border-[#CBD5E1] bg-white px-4 text-[14px] font-semibold text-[#0B1628] outline-none transition placeholder:text-[#94A3B8] focus:border-[#306EEC] focus:ring-4 focus:ring-[#306EEC]/12";

function IconMark() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <path d="M5 12.5l4 4 10-10" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function PartnershipIllustration() {
  return (
    <div className="relative mx-auto max-w-[520px]">
      <div className="absolute -inset-8 rounded-[44px] bg-[#306EEC]/10 blur-3xl" />
      <div className="relative overflow-hidden rounded-[34px] border border-white/15 bg-white/[0.08] p-5 shadow-[0_34px_120px_rgba(0,0,0,0.28)] backdrop-blur">
        <div className="rounded-[28px] bg-[#F8FAFC] p-5">
          <div className="mb-5 flex items-center justify-between">
            <div>
              <div className="text-[11px] font-black uppercase tracking-[0.18em] text-[#306EEC]">Community Support</div>
              <div className="mt-1 text-[20px] font-black text-[#0B1628]">Resident Care Hub</div>
            </div>
            <div className="rounded-full bg-[#DCFCE7] px-3 py-1 text-[11px] font-black text-[#15803D]">Trusted</div>
          </div>

          <div className="grid gap-3 sm:grid-cols-3">
            {["HOA", "Condo", "55+"].map((label, index) => (
              <div key={label} className="rounded-[18px] border border-[#E2E8F0] bg-white p-3 shadow-sm">
                <div className="mb-3 h-12 rounded-[14px] bg-gradient-to-br from-[#DBEAFE] to-[#F8FAFC]" />
                <div className="text-[12px] font-black text-[#0B1628]">{label} Residents</div>
                <div className="mt-2 h-1.5 rounded-full bg-[#E2E8F0]">
                  <div className="h-1.5 rounded-full bg-[#306EEC]" style={{ width: `${68 + index * 10}%` }} />
                </div>
              </div>
            ))}
          </div>

          <div className="mt-4 rounded-[22px] border border-[#D9E4FF] bg-[#EEF5FF] p-4">
            <div className="flex items-center gap-3">
              <div className="grid h-12 w-12 place-items-center rounded-[16px] bg-[#306EEC] text-white">
                <IconMark />
              </div>
              <div>
                <div className="text-[14px] font-black text-[#0B1628]">Maintenance request handled</div>
                <div className="text-[12px] font-semibold text-[#64748B]">Scheduling, communication, and follow-up in one place.</div>
              </div>
            </div>
          </div>

          <div className="mt-4 grid grid-cols-2 gap-3">
            <div className="rounded-[18px] bg-[#0B1628] p-4 text-white">
              <div className="text-[24px] font-black">Local</div>
              <div className="text-[11px] font-semibold text-white/55">Nassau & Suffolk</div>
            </div>
            <div className="rounded-[18px] border border-[#E2E8F0] bg-white p-4">
              <div className="text-[24px] font-black text-[#0B1628]">Easy</div>
              <div className="text-[11px] font-semibold text-[#64748B]">Resident-first booking</div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

export default function CommunitiesPage() {
  const [form, setForm] = useState<FormState>(initialForm);
  const [status, setStatus] = useState<"idle" | "submitting" | "success" | "error">("idle");
  const [message, setMessage] = useState("");

  const update = (key: keyof FormState, value: string) => {
    setForm((prev) => ({ ...prev, [key]: value }));
    if (status === "error") {
      setStatus("idle");
      setMessage("");
    }
  };

  const submit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setStatus("submitting");
    setMessage("");

    const notes = [
      `Community / Company Name: ${form.communityName.trim()}`,
      `Contact Name: ${form.contactName.trim()}`,
      `Role / Title: ${form.roleTitle.trim()}`,
      `Community Location: ${form.location.trim()}`,
      form.homesUnits.trim() ? `Number of Homes / Units: ${form.homesUnits.trim()}` : "",
      "",
      "What would you like to discuss?",
      form.message.trim(),
    ]
      .filter((line) => line !== "")
      .join("\n");

    try {
      const apiUrl = process.env.NEXT_PUBLIC_API_URL ?? "";
      const response = await fetch(`${apiUrl}/api/estimates`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          service: "community-partnership",
          name: form.contactName.trim(),
          phone: form.phone.trim(),
          email: form.email.trim(),
          address: form.location.trim(),
          contactPref: "phone",
          notes,
          source: "/communities",
          sourcePage: "/communities",
        }),
      });

      const body = (await response.json().catch(() => ({}))) as { message?: string };
      if (!response.ok) {
        setStatus("error");
        setMessage(body.message || `We could not send your request. Please call ${CONTACT_PHONE_DISPLAY}.`);
        return;
      }

      setStatus("success");
      setMessage("Thank you — we received your request. We’ll reach out shortly.");
      setMessage(SUCCESS_MESSAGE);
      setForm(initialForm);
    } catch {
      setStatus("error");
      setMessage(`We could not send your request. Please call ${CONTACT_PHONE_DISPLAY}.`);
    }
  };

  return (
    <main className="min-h-screen bg-[#F5F7FB] text-[#0B1628]">
      <section className="relative overflow-hidden bg-[#07111F] px-4 pb-20 pt-4 text-white sm:px-6 sm:pb-24 lg:px-8">
        <div className="relative z-20 -mx-4 sm:-mx-6 lg:-mx-8">
          <Header />
        </div>
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_left,rgba(48,110,236,0.28),transparent_34%),radial-gradient(circle_at_80%_10%,rgba(212,165,116,0.18),transparent_28%)]" />
        <div className="absolute inset-x-0 bottom-0 h-32 bg-gradient-to-t from-[#F5F7FB] to-transparent" />
        <div className="pointer-events-none absolute inset-0 opacity-[0.035]" style={{ backgroundImage: "radial-gradient(circle, #fff 1px, transparent 1px)", backgroundSize: "30px 30px" }} />
        <div className="relative mx-auto grid max-w-[1240px] gap-12 pt-14 sm:pt-18 lg:grid-cols-[1.05fr_0.95fr] lg:items-center lg:pt-20">
          <div>
            <div className="mb-6 inline-flex rounded-full border border-white/12 bg-white/8 px-4 py-2 text-[11px] font-black uppercase tracking-[0.18em] text-[#BFD2FF]">
              HOA • Condo • 55+ • Property Management
            </div>
            <h1 className="max-w-[760px] text-[44px] font-black leading-[0.95] tracking-[-0.05em] sm:text-[64px] lg:text-[78px]">
              A Trusted Home Maintenance Resource For Your Community
            </h1>
            <p className="mt-7 max-w-[640px] text-[17px] leading-8 text-white/70 sm:text-[20px]">
              Help residents stay ahead of home repairs, maintenance, and everyday household issues with a local Long Island handyman partner they can trust.
            </p>
            <div className="mt-9 flex flex-col gap-3 sm:flex-row">
              <a href="#partnership-form" className="inline-flex h-14 items-center justify-center rounded-[16px] bg-[#306EEC] px-7 text-[15px] font-black text-white shadow-[0_18px_52px_rgba(48,110,236,0.35)] transition hover:-translate-y-0.5 hover:bg-[#2558c9]">
                Schedule A Conversation
              </a>
              <a href={CONTACT_PHONE_TEL} className="inline-flex h-14 items-center justify-center rounded-[16px] border border-white/16 bg-white/8 px-7 text-[15px] font-black text-white transition hover:-translate-y-0.5 hover:bg-white/12">
                Call {CONTACT_PHONE_DISPLAY}
              </a>
            </div>
            <div className="mt-8 grid max-w-[620px] gap-3 text-[13px] font-bold text-white/62 sm:grid-cols-3">
              {["No burden on management", "Resident-first support", "Long Island based"].map((item) => (
                <div key={item} className="rounded-[16px] border border-white/10 bg-white/[0.06] px-4 py-3">
                  {item}
                </div>
              ))}
            </div>
          </div>
          <PartnershipIllustration />
        </div>
      </section>

      <section className="px-4 py-10 sm:px-6 lg:px-8">
        <div className="mx-auto max-w-[1240px]">
          <div className="-mt-14 mb-8 rounded-[28px] border border-white/70 bg-white/85 p-5 shadow-[0_24px_80px_rgba(15,23,42,0.12)] backdrop-blur sm:p-6 lg:p-7">
            <div className="grid gap-5 lg:grid-cols-[0.9fr_1.1fr] lg:items-center">
              <div>
                <div className="text-[11px] font-black uppercase tracking-[0.18em] text-[#306EEC]">
                  For Long Island communities
                </div>
                <h2 className="mt-2 text-[24px] font-black leading-tight tracking-[-0.03em] text-[#0B1628] sm:text-[30px]">
                  Built for HOA boards, condo associations, property managers, and 55+ communities.
                </h2>
              </div>
              <p className="text-[14px] leading-7 text-[#64748B] sm:text-[15px]">
                Profixter gives residents a clear local resource for everyday repairs, small projects, and ongoing maintenance support across Nassau and Suffolk Counties.
              </p>
            </div>
          </div>

          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-6">
            {trustItems.map((item) => (
              <div key={item} className="rounded-[18px] border border-[#E2E8F0] bg-white p-4 shadow-sm transition hover:-translate-y-0.5 hover:shadow-[0_16px_40px_rgba(15,23,42,0.08)]">
                <div className="mb-3 grid h-9 w-9 place-items-center rounded-[12px] bg-[#EEF5FF] text-[#306EEC]">
                  <IconMark />
                </div>
                <div className="text-[13px] font-black leading-snug text-[#0B1628]">{item}</div>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="px-4 py-12 sm:px-6 lg:px-8">
        <div className="mx-auto max-w-[1240px]">
          <div className="max-w-[720px]">
            <div className="text-[11px] font-black uppercase tracking-[0.2em] text-[#306EEC]">Why communities partner with Profixter</div>
            <h2 className="mt-3 text-[34px] font-black tracking-[-0.04em] text-[#0B1628] sm:text-[52px]">Useful for residents. Simple for management.</h2>
          </div>
          <div className="mt-8 grid gap-4 md:grid-cols-2 lg:grid-cols-3">
            {reasons.map((reason) => (
              <div key={reason.title} className="rounded-[24px] border border-[#DDE5F0] bg-white p-6 shadow-[0_18px_54px_rgba(15,23,42,0.06)]">
                <h3 className="text-[19px] font-black text-[#0B1628]">{reason.title}</h3>
                <p className="mt-3 text-[14px] leading-7 text-[#64748B]">{reason.text}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="px-4 py-12 sm:px-6 lg:px-8">
        <div className="mx-auto max-w-[1240px] rounded-[34px] bg-[#0B1628] p-6 text-white shadow-[0_28px_90px_rgba(15,23,42,0.18)] sm:p-9 lg:p-12">
          <div className="grid gap-8 lg:grid-cols-[0.8fr_1.2fr] lg:items-start">
            <div>
              <div className="text-[11px] font-black uppercase tracking-[0.2em] text-[#93C5FD]">Resident services</div>
              <h2 className="mt-3 text-[32px] font-black leading-tight tracking-[-0.04em] sm:text-[46px]">Everyday help homeowners actually need.</h2>
              <p className="mt-4 text-[15px] leading-7 text-white/60">
                Practical maintenance support for the small things residents often postpone.
              </p>
            </div>
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {services.map((service) => (
                <div key={service} className="rounded-[18px] border border-white/10 bg-white/[0.06] p-4">
                  <div className="mb-3 h-9 w-9 rounded-[12px] bg-white/10 text-[#93C5FD] grid place-items-center">
                    <IconMark />
                  </div>
                  <div className="text-[14px] font-bold text-white/90">{service}</div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      <section className="px-4 py-12 sm:px-6 lg:px-8">
        <div className="mx-auto grid max-w-[1240px] gap-8 lg:grid-cols-3">
          {[
            ["1", "Community Introduces Profixter", "We align on the best way to present Profixter as a resident resource."],
            ["2", "Residents Contact Profixter Directly", "Homeowners reach out when they need help, without creating extra work for management."],
            ["3", "We Handle Scheduling And Service", "Our team manages communication, scheduling, and service coordination."],
          ].map(([step, title, text]) => (
            <div key={step} className="rounded-[28px] border border-[#DDE5F0] bg-white p-7 shadow-sm">
              <div className="mb-6 grid h-12 w-12 place-items-center rounded-[16px] bg-[#306EEC] text-[18px] font-black text-white">{step}</div>
              <h3 className="text-[21px] font-black text-[#0B1628]">{title}</h3>
              <p className="mt-3 text-[14px] leading-7 text-[#64748B]">{text}</p>
            </div>
          ))}
        </div>
      </section>

      <section className="px-4 py-12 sm:px-6 lg:px-8">
        <div className="mx-auto grid max-w-[1240px] gap-8 lg:grid-cols-[0.9fr_1.1fr] lg:items-center">
          <div>
            <div className="text-[11px] font-black uppercase tracking-[0.2em] text-[#306EEC]">Partnership opportunities</div>
            <h2 className="mt-3 text-[34px] font-black tracking-[-0.04em] sm:text-[52px]">Community value without adding operational burden.</h2>
            <p className="mt-5 text-[16px] leading-8 text-[#64748B]">
              Many homeowners struggle finding trustworthy help, postpone maintenance, and feel overwhelmed by small projects. Communities benefit when residents have access to dependable local resources.
            </p>
          </div>
          <div className="grid gap-3 sm:grid-cols-2">
            {benefits.map((benefit) => (
              <div key={benefit} className="rounded-[20px] border border-[#DDE5F0] bg-white p-5 shadow-sm">
                <div className="mb-3 text-[#306EEC]"><IconMark /></div>
                <div className="text-[15px] font-black text-[#0B1628]">{benefit}</div>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="px-4 py-12 sm:px-6 lg:px-8">
        <div className="mx-auto max-w-[1240px] rounded-[34px] border border-[#DDE5F0] bg-white p-6 shadow-[0_24px_80px_rgba(15,23,42,0.07)] sm:p-9 lg:p-12">
          <div className="grid gap-8 lg:grid-cols-[0.7fr_1.3fr] lg:items-center">
            <div className="rounded-[28px] bg-gradient-to-br from-[#0B1628] to-[#1D3557] p-7 text-white">
              <div className="text-[48px] font-black leading-none tracking-[-0.06em]">TB</div>
              <div className="mt-5 text-[22px] font-black">Taras Bandura</div>
              <div className="mt-1 text-[13px] font-bold text-white/50">Founder, Profixter</div>
            </div>
            <div>
              <div className="text-[11px] font-black uppercase tracking-[0.2em] text-[#306EEC]">About Profixter</div>
              <h2 className="mt-3 text-[32px] font-black tracking-[-0.04em] sm:text-[48px]">Built locally for a better home service experience.</h2>
              <p className="mt-5 text-[16px] leading-8 text-[#64748B]">
                Profixter was created by Taras Bandura to make home maintenance easier for Long Island homeowners. With a construction and home services background, the focus is reliability, organization, and a resident experience communities can feel comfortable recommending.
              </p>
            </div>
          </div>
        </div>
      </section>

      <section id="partnership-form" className="px-4 py-12 sm:px-6 lg:px-8">
        <div className="mx-auto grid max-w-[1240px] gap-8 lg:grid-cols-[0.85fr_1.15fr] lg:items-start">
          <div className="lg:sticky lg:top-8">
            <div className="text-[11px] font-black uppercase tracking-[0.2em] text-[#306EEC]">Start the conversation</div>
            <h2 className="mt-3 text-[34px] font-black tracking-[-0.04em] sm:text-[52px]">Let’s explore whether Profixter is a good fit for your community.</h2>
            <p className="mt-5 text-[16px] leading-8 text-[#64748B]">
              We would love to learn more about your residents and discuss ways we may be able to provide value.
            </p>
            <div className="mt-7 grid gap-3 sm:grid-cols-2 lg:grid-cols-1">
              <a
                href={CONTACT_PHONE_TEL}
                className="rounded-[20px] border border-[#D9E4FF] bg-white p-4 shadow-sm transition hover:-translate-y-0.5 hover:border-[#306EEC]/35 hover:shadow-[0_18px_44px_rgba(48,110,236,0.10)]"
              >
                <div className="text-[11px] font-black uppercase tracking-[0.18em] text-[#64748B]">Phone</div>
                <div className="mt-1 text-[18px] font-black text-[#0B1628]">{CONTACT_PHONE_DISPLAY}</div>
              </a>
              <a
                href={`mailto:${CONTACT_EMAIL}`}
                className="rounded-[20px] border border-[#D9E4FF] bg-white p-4 shadow-sm transition hover:-translate-y-0.5 hover:border-[#306EEC]/35 hover:shadow-[0_18px_44px_rgba(48,110,236,0.10)]"
              >
                <div className="text-[11px] font-black uppercase tracking-[0.18em] text-[#64748B]">Email</div>
                <div className="mt-1 break-all text-[18px] font-black text-[#0B1628]">{CONTACT_EMAIL}</div>
              </a>
            </div>
          </div>

          {status === "success" ? (
            <div className="rounded-[28px] border border-[#BBE6C7] bg-[#F1FBF4] p-7 shadow-[0_24px_80px_rgba(15,23,42,0.08)] sm:p-9">
              <div className="grid h-12 w-12 place-items-center rounded-full bg-[#DCFCE7] text-[#15803D]">
                <IconMark />
              </div>
              <h3 className="mt-5 text-[28px] font-black text-[#0B1628]">Request received</h3>
              <p className="mt-3 text-[16px] leading-7 text-[#475569]">{message}</p>
              <button
                type="button"
                onClick={() => {
                  setStatus("idle");
                  setMessage("");
                }}
                className="mt-7 inline-flex h-12 items-center justify-center rounded-[14px] bg-[#0B1628] px-6 text-[14px] font-black text-white"
              >
                Send another request
              </button>
            </div>
          ) : (
            <form onSubmit={submit} className="rounded-[28px] border border-[#D7DEE9] bg-white p-5 shadow-[0_28px_90px_rgba(15,23,42,0.12)] sm:p-8">
              <div className="mb-6">
                <div className="text-[11px] font-black uppercase tracking-[0.18em] text-[#306EEC]">Partnership inquiry</div>
                <h3 className="mt-2 text-[28px] font-black text-[#0B1628]">Request A Partnership Conversation</h3>
              </div>

              <div className="grid gap-4 sm:grid-cols-2">
                <label className="block">
                  <span className="text-[13px] font-bold text-[#334155]">Community / Company Name *</span>
                  <input required value={form.communityName} onChange={(e) => update("communityName", e.target.value)} className={fieldClass} />
                </label>
                <label className="block">
                  <span className="text-[13px] font-bold text-[#334155]">Contact Name *</span>
                  <input required value={form.contactName} onChange={(e) => update("contactName", e.target.value)} className={fieldClass} autoComplete="name" />
                </label>
                <label className="block">
                  <span className="text-[13px] font-bold text-[#334155]">Role / Title *</span>
                  <input required value={form.roleTitle} onChange={(e) => update("roleTitle", e.target.value)} className={fieldClass} />
                </label>
                <label className="block">
                  <span className="text-[13px] font-bold text-[#334155]">Email *</span>
                  <input required type="email" value={form.email} onChange={(e) => update("email", e.target.value)} className={fieldClass} autoComplete="email" />
                </label>
                <label className="block">
                  <span className="text-[13px] font-bold text-[#334155]">Phone *</span>
                  <input required type="tel" value={form.phone} onChange={(e) => update("phone", e.target.value)} className={fieldClass} autoComplete="tel" />
                </label>
                <label className="block">
                  <span className="text-[13px] font-bold text-[#334155]">Community Location *</span>
                  <input required value={form.location} onChange={(e) => update("location", e.target.value)} className={fieldClass} placeholder="Town, community, or property location" />
                </label>
                <label className="block sm:col-span-2">
                  <span className="text-[13px] font-bold text-[#334155]">Number of Homes / Units <span className="font-normal text-[#94A3B8]">(optional)</span></span>
                  <input value={form.homesUnits} onChange={(e) => update("homesUnits", e.target.value)} className={fieldClass} inputMode="numeric" />
                </label>
              </div>

              <label className="mt-4 block">
                <span className="text-[13px] font-bold text-[#334155]">What would you like to discuss? *</span>
                <textarea
                  required
                  value={form.message}
                  onChange={(e) => update("message", e.target.value)}
                  className={`${fieldClass} min-h-[130px] resize-y py-3`}
                  placeholder="Tell us about your community, resident needs, or what kind of partnership you want to explore."
                />
              </label>

              {status === "error" && (
                <div className="mt-4 rounded-[16px] border border-rose-200 bg-rose-50 px-4 py-3 text-[14px] font-semibold text-rose-700">
                  {message}
                </div>
              )}

              <button
                type="submit"
                disabled={status === "submitting"}
                className="mt-6 inline-flex h-14 w-full items-center justify-center rounded-[16px] bg-[#306EEC] px-6 text-[15px] font-black text-white shadow-[0_18px_48px_rgba(48,110,236,0.28)] transition hover:bg-[#2558c9] disabled:cursor-not-allowed disabled:opacity-60 sm:w-auto"
              >
                {status === "submitting" ? "Sending..." : "Request A Partnership Conversation"}
              </button>
            </form>
          )}
        </div>
      </section>

      <section className="px-4 py-12 sm:px-6 lg:px-8">
        <div className="mx-auto max-w-[1240px]">
          <div className="mb-7 max-w-[720px]">
            <div className="text-[11px] font-black uppercase tracking-[0.2em] text-[#306EEC]">FAQ</div>
            <h2 className="mt-3 text-[34px] font-black tracking-[-0.04em] sm:text-[48px]">Questions boards and managers usually ask.</h2>
          </div>
          <div className="grid gap-4 md:grid-cols-2">
            {faqs.map((faq) => (
              <div key={faq.q} className="rounded-[24px] border border-[#DDE5F0] bg-white p-6 shadow-sm">
                <h3 className="text-[17px] font-black text-[#0B1628]">{faq.q}</h3>
                <p className="mt-3 text-[14px] leading-7 text-[#64748B]">{faq.a}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      <Footer />
    </main>
  );
}
