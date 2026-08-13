"use client";

/**
 * "This sounds interesting. Call me and explain it."
 *
 * The lowest-friction way into membership. Two fields, because the person this
 * is for does not want to read a plan comparison or make an account yet; they
 * want a human to explain it. Everything else can be asked on the call.
 *
 * It is deliberately not a hero of its own. It sits beside the proposition as a
 * quiet companion, so the primary CTA keeps its place and the page does not
 * turn into a form. On a phone that means a compact block under the buttons; on
 * a desktop it takes the column the product preview would otherwise fill.
 *
 * The copy carries the whole reassurance: a call, not a purchase, not an
 * account. No consent checkbox, because the site has no existing consent
 * mechanism for a phone number given expressly so we can ring it back, and
 * inventing legal-looking clutter here would cost conversions without adding
 * protection. If a consent record is ever required, it belongs on the lead.
 */

import { useState } from "react";
import { submitMembershipLead } from "@/lib/contact";
import { trackEvent } from "@/lib/analytics";

type Phase = "idle" | "sending" | "done";

export default function MembershipCallbackForm({
  className = "",
  tone = "dark",
}: {
  className?: string;
  /** "dark" sits on the hero. "light" is for a pale surface. */
  tone?: "dark" | "light";
}) {
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [phase, setPhase] = useState<Phase>("idle");
  const [error, setError] = useState("");

  const dark = tone === "dark";

  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    // The guard that stops a double tap becoming two leads before the request
    // has even left. The server refuses the rest.
    if (phase === "sending" || phase === "done") return;

    const cleanName = name.trim();
    const cleanPhone = phone.trim();
    if (cleanName.length < 2) {
      setError("Please enter your name.");
      return;
    }
    if (cleanPhone.replace(/\D/g, "").length < 10) {
      setError("Please enter a valid phone number.");
      return;
    }

    setError("");
    setPhase("sending");
    const result = await submitMembershipLead({
      name: cleanName,
      phone: cleanPhone,
      sourcePage: typeof window === "undefined" ? "/" : window.location.pathname,
    });

    if (result.ok) {
      trackEvent("membership_callback_requested", { placement: "home_hero" });
      setPhase("done");
      return;
    }
    setError(result.message);
    setPhase("idle");
  };

  if (phase === "done") {
    return (
      <div
        className={`rounded-[8px] border p-4 sm:p-5 ${
          dark ? "border-white/15 bg-white/[0.07]" : "border-[#DCE3EE] bg-white"
        } ${className}`}
      >
        <p className={`text-[15px] font-semibold ${dark ? "text-white" : "text-[#0B1628]"}`}>
          Got it. We will call you soon.
        </p>
        <p className={`mt-1 text-[13px] leading-5 ${dark ? "text-white/60" : "text-[#6E6E73]"}`}>
          No account was created and nothing was charged.
        </p>
      </div>
    );
  }

  const fieldClass = [
    "h-[46px] w-full rounded-[6px] border px-3.5 text-[15px] outline-none transition",
    dark
      ? "border-white/15 bg-white/[0.07] text-white placeholder:text-white/40 focus:border-white/35"
      : "border-[#D7DEE9] bg-white text-[#0B1628] placeholder:text-[#9AA3B2] focus:border-[#306EEC]",
  ].join(" ");

  return (
    <form
      onSubmit={submit}
      noValidate
      className={`rounded-[8px] border p-4 sm:p-5 ${
        dark ? "border-white/15 bg-white/[0.06]" : "border-[#DCE3EE] bg-white"
      } ${className}`}
    >
      <p className={`text-[15px] font-semibold ${dark ? "text-white" : "text-[#0B1628]"}`}>
        Interested in membership?
      </p>
      <p className={`mt-0.5 text-[13px] leading-5 ${dark ? "text-white/60" : "text-[#6E6E73]"}`}>
        Leave your number and we will call to explain it. No account, no card.
      </p>

      <div className="mt-3 flex flex-col gap-2 sm:flex-row lg:flex-col">
        <label className="sr-only" htmlFor="callback-name">
          Your name
        </label>
        <input
          id="callback-name"
          name="name"
          type="text"
          autoComplete="name"
          placeholder="Name"
          value={name}
          onChange={(event) => setName(event.target.value)}
          className={fieldClass}
        />
        <label className="sr-only" htmlFor="callback-phone">
          Your phone number
        </label>
        <input
          id="callback-phone"
          name="phone"
          type="tel"
          inputMode="tel"
          autoComplete="tel"
          placeholder="Phone"
          value={phone}
          onChange={(event) => setPhone(event.target.value)}
          className={fieldClass}
        />
      </div>

      {error ? (
        <p
          role="alert"
          className={`mt-2 text-[12.5px] font-medium ${dark ? "text-[#FFB4B4]" : "text-[#B42318]"}`}
        >
          {error}
        </p>
      ) : null}

      <button
        type="submit"
        disabled={phase === "sending"}
        className={`mt-3 inline-flex h-[46px] w-full items-center justify-center rounded-[6px] text-[15px] font-semibold transition disabled:opacity-60 ${
          dark
            ? "bg-white text-[#0B1628] hover:bg-[#F1F4F9]"
            : "bg-[#306EEC] text-white hover:bg-[#2558C9]"
        }`}
      >
        {phase === "sending" ? "Sending..." : "Request a call"}
      </button>
    </form>
  );
}
