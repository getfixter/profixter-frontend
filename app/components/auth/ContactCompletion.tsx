"use client";

import { useCallback, useEffect, useRef, useState, type FormEvent, type ReactNode } from "react";
import Link from "next/link";
import Sheet from "@/app/components/ui/Sheet";
import CodeStep, { outcomeFromError, type CodeOutcome } from "./CodeStep";
import { useAuth } from "@/lib/useAuth";
import type { User } from "@/lib/auth-service";
import {
  formatPhoneInput,
  isValidEmail,
  maskPhoneForDisplay,
  missingContact,
  otpErrorMessage,
  phoneToE164,
  readApiError,
  startEmailOtp,
  startPhoneOtp,
  updateProfileName,
  verifyEmailOtp,
  verifyPhoneOtp,
} from "@/lib/auth2";

/**
 * Contact completion before a booking or checkout.
 *
 * A Booking needs a phone AND an email, and an account made with one of them
 * (or with Google/Apple) may lack the other. Before submitting, a booking flow
 * calls `await ensureContact()`: if nothing is missing it resolves true at once
 * and the customer never sees this; otherwise a sheet asks for exactly what is
 * missing, verifies it with a code (mode:"attach", signed in), and resolves
 * true so the booking continues. Closing the sheet resolves false.
 *
 * Nothing already on the account is asked for again.
 */
type Stage = "name" | "phone" | "phone-code" | "email" | "email-code";

function ContactSheet({
  open,
  needs,
  onDone,
  onCancel,
}: {
  open: boolean;
  needs: { name: boolean; phone: boolean; email: boolean };
  onDone: () => void;
  onCancel: () => void;
}) {
  const { refreshUser, updateUser } = useAuth();
  const [stage, setStage] = useState<Stage>(needs.name ? "name" : needs.phone ? "phone" : "email");
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [email, setEmail] = useState("");
  const [masked, setMasked] = useState("");
  const [resendAt, setResendAt] = useState(0);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const attached = async (user: User | undefined, nextStage: Stage | null) => {
    if (user) updateUser(user);
    const fresh = await refreshUser().catch(() => null);
    const stillMissing = missingContact(fresh || user || null);
    if (nextStage === "email" && stillMissing.email) {
      setStage("email");
      return;
    }
    onDone();
  };

  /* The name the Fixter asks for at the door; then whatever else is still missing. */
  const saveName = async (e: FormEvent) => {
    e.preventDefault();
    if (loading) return;
    if (!name.trim()) {
      setError("Please enter your name.");
      return;
    }
    setLoading(true);
    setError("");
    try {
      const { user } = await updateProfileName(name);
      updateUser(user);
      const still = missingContact(user);
      if (needs.phone && still.phone) setStage("phone");
      else if (needs.email && still.email) setStage("email");
      else onDone();
    } catch (err) {
      setError(readApiError(err).message || "Couldn't save your name. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  const sendPhone = async (e: FormEvent) => {
    e.preventDefault();
    if (loading) return;
    const e164 = phoneToE164(phone);
    if (!e164) {
      setError("Enter a valid mobile number, like (631) 555-0123.");
      return;
    }
    setLoading(true);
    setError("");
    try {
      const res = await startPhoneOtp({ phone: e164 });
      setMasked(res.phoneMasked || maskPhoneForDisplay(e164));
      setResendAt(Date.now() + (res.resendAfterSeconds || 30) * 1000);
      setStage("phone-code");
    } catch (err) {
      setError(otpErrorMessage(readApiError(err), "phone"));
    } finally {
      setLoading(false);
    }
  };

  const sendEmail = async (e: FormEvent) => {
    e.preventDefault();
    if (loading) return;
    if (!isValidEmail(email)) {
      setError("Enter a valid email address.");
      return;
    }
    setLoading(true);
    setError("");
    try {
      const res = await startEmailOtp(email);
      setMasked(res.emailMasked || email.trim().toLowerCase());
      setResendAt(Date.now() + (res.resendAfterSeconds || 30) * 1000);
      setStage("email-code");
    } catch (err) {
      setError(otpErrorMessage(readApiError(err), "email"));
    } finally {
      setLoading(false);
    }
  };

  const verify = async (code: string): Promise<CodeOutcome> => {
    const channel = stage === "phone-code" ? "phone" : "email";
    try {
      const res =
        channel === "phone"
          ? await verifyPhoneOtp({ phone: phoneToE164(phone) || phone, code, mode: "attach" })
          : await verifyEmailOtp({ email, code, mode: "attach" });
      if (res.status !== "attached" && res.status !== "signed_in") {
        return { error: "Something went wrong. Please try again." };
      }
      await attached(res.user, channel === "phone" && needs.email ? "email" : null);
      return null;
    } catch (err) {
      return outcomeFromError(err, channel);
    }
  };

  const resend = async (): Promise<CodeOutcome> => {
    const channel = stage === "phone-code" ? "phone" : "email";
    try {
      const res =
        channel === "phone"
          ? await startPhoneOtp({ phone: phoneToE164(phone) || phone })
          : await startEmailOtp(email);
      setResendAt(Date.now() + (res.resendAfterSeconds || 30) * 1000);
      return null;
    } catch (err) {
      return outcomeFromError(err, channel);
    }
  };

  const title =
    stage === "name"
      ? "What's your name?"
      : stage === "phone" || stage === "phone-code"
        ? "Add your mobile number"
        : "Add your email";

  return (
    <Sheet open={open} onClose={onCancel} title={title}>
      {stage === "name" ? (
        <form onSubmit={saveName} noValidate className="mt-2 space-y-3">
          <p className="text-[14.5px] text-[#5b6577]">So your Fixter knows who to ask for.</p>
          <label htmlFor="contact-name" className="sr-only">
            Your name
          </label>
          <input
            id="contact-name"
            type="text"
            autoComplete="name"
            autoCapitalize="words"
            value={name}
            onChange={(e) => {
              setName(e.target.value);
              if (error) setError("");
            }}
            placeholder="Your name"
            className="auth-input"
          />
          <div aria-live="polite">{error ? <p className="auth-error" role="alert">{error}</p> : null}</div>
          <button type="submit" className="auth-submit !mt-3" disabled={loading}>
            {loading ? <span className="auth-spinner" aria-hidden="true" /> : null}
            Continue
          </button>
        </form>
      ) : null}
      {stage === "phone" ? (
        <form onSubmit={sendPhone} noValidate className="mt-2 space-y-3">
          <p className="text-[14.5px] text-[#5b6577]">Your Fixter uses it to reach you on the day of the visit.</p>
          <label htmlFor="contact-phone" className="sr-only">
            Mobile number
          </label>
          <input
            id="contact-phone"
            type="tel"
            inputMode="tel"
            autoComplete="tel"
            value={phone}
            onChange={(e) => {
              setPhone(formatPhoneInput(e.target.value));
              if (error) setError("");
            }}
            placeholder="(631) 555-0123"
            aria-describedby="contact-terms-continue"
            className="auth-input"
          />
          <div aria-live="polite">{error ? <p className="auth-error" role="alert">{error}</p> : null}</div>
          <button type="submit" className="auth-submit !mt-3" disabled={loading}>
            {loading ? <span className="auth-spinner" aria-hidden="true" /> : null}
            {loading ? "Sending code" : "Text me a code"}
          </button>
          {/*
            * Consent version "terms.continue.v1", word for word, as on sign-up.
            * No checkbox: the code is a one-time text the person requests
            * (Twilio Verify), and service texts are offered at the booking step.
            */}
          <p id="contact-terms-continue" className="auth-fineprint !mt-2.5" data-terms-continue>
            By continuing, you agree to the{" "}
            <Link href="/terms" target="_blank" rel="noopener noreferrer">
              Terms
            </Link>{" "}
            and{" "}
            <Link href="/privacy" target="_blank" rel="noopener noreferrer">
              Privacy Policy
            </Link>{" "}
            and to receive a one-time{" "}
            <Link href="/communication-consent" target="_blank" rel="noopener noreferrer">
              verification text
            </Link>
            . Msg &amp; data rates may apply.
          </p>
        </form>
      ) : null}

      {stage === "email" ? (
        <form onSubmit={sendEmail} noValidate className="mt-2 space-y-3">
          <p className="text-[14.5px] text-[#5b6577]">We send your booking confirmation and receipts here.</p>
          <label htmlFor="contact-email" className="sr-only">
            Email address
          </label>
          <input
            id="contact-email"
            type="email"
            inputMode="email"
            autoComplete="email"
            autoCapitalize="none"
            spellCheck={false}
            value={email}
            onChange={(e) => {
              setEmail(e.target.value);
              if (error) setError("");
            }}
            placeholder="you@example.com"
            className="auth-input"
          />
          <div aria-live="polite">{error ? <p className="auth-error" role="alert">{error}</p> : null}</div>
          <button type="submit" className="auth-submit !mt-3" disabled={loading}>
            {loading ? <span className="auth-spinner" aria-hidden="true" /> : null}
            {loading ? "Sending code" : "Email me a code"}
          </button>
        </form>
      ) : null}

      {stage === "phone-code" || stage === "email-code" ? (
        <CodeStep
          key={stage}
          compact
          idPrefix="contact"
          channel={stage === "phone-code" ? "phone" : "email"}
          destination={masked}
          resendAt={resendAt}
          onVerify={verify}
          onResend={resend}
          onChangeDestination={() => {
            setError("");
            setStage(stage === "phone-code" ? "phone" : "email");
          }}
          changeLabel={stage === "phone-code" ? "Change number" : "Change email"}
        />
      ) : null}
    </Sheet>
  );
}

/**
 * `const ok = await ensureContact()` before submitting; render `contactSheet`.
 * Pass `{ fields: ["email"] }` when only some details are needed (a gift needs
 * an email for its receipt, not a phone), so nobody is asked for more.
 */
type ContactField = "name" | "phone" | "email";

export function useContactCompletion(): {
  ensureContact: (options?: { fields?: ContactField[] }) => Promise<boolean>;
  contactSheet: ReactNode;
} {
  const { user, isAuthenticated } = useAuth();
  const userRef = useRef(user);
  useEffect(() => {
    userRef.current = user;
  }, [user]);
  const [needs, setNeeds] = useState<{ name: boolean; phone: boolean; email: boolean } | null>(null);
  const [sheetKey, setSheetKey] = useState(0);
  const resolver = useRef<((ok: boolean) => void) | null>(null);

  const ensureContact = useCallback(async (options?: { fields?: ContactField[] }) => {
    /* Anonymous flows collect contact details themselves. */
    if (!isAuthenticated || !userRef.current) return true;
    const wanted = options?.fields ?? ["name", "phone", "email"];
    const all = missingContact(userRef.current);
    const missing = {
      name: all.name && wanted.includes("name"),
      phone: all.phone && wanted.includes("phone"),
      email: all.email && wanted.includes("email"),
    };
    if (!missing.name && !missing.phone && !missing.email) return true;
    resolver.current?.(false);
    setSheetKey((k) => k + 1);
    setNeeds(missing);
    return new Promise<boolean>((resolve) => {
      resolver.current = resolve;
    });
  }, [isAuthenticated]);

  const settle = (ok: boolean) => {
    setNeeds(null);
    resolver.current?.(ok);
    resolver.current = null;
  };

  const contactSheet = needs ? (
    <ContactSheet key={sheetKey} open needs={needs} onDone={() => settle(true)} onCancel={() => settle(false)} />
  ) : null;

  return { ensureContact, contactSheet };
}
