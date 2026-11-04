"use client";

import { useCallback, useEffect, useRef, useState, type FormEvent, type ReactNode } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { surfaceFor } from "@/lib/surface";
import Sheet from "@/app/components/ui/Sheet";
import CodeStep, { outcomeFromError, type CodeOutcome } from "./CodeStep";
import { useAuth } from "@/lib/useAuth";
import type { User } from "@/lib/auth-service";
import { revealField } from "@/lib/form-guide";
import {
  formatPhoneInput,
  isValidEmail,
  maskPhoneForDisplay,
  missingContact,
  otpErrorMessage,
  phoneToE164,
  readApiError,
  sessionIsFresh,
  startEmailOtp,
  startPhoneOtp,
  startReauth,
  updateProfileName,
  verifyEmailOtp,
  verifyPhoneOtp,
  verifyReauth,
} from "@/lib/auth2";

/**
 * Contact completion before a booking or checkout - and, since 2026-11-03,
 * the customer's own way to change their name, email and mobile number.
 *
 * A Booking needs a phone AND an email, and an account made with one of them
 * (or with Google/Apple) may lack the other. Before submitting, a booking flow
 * calls `await ensureContact()`: if nothing is missing it resolves true at once
 * and the customer never sees this; otherwise a sheet asks for exactly what is
 * missing, verifies it with a code (mode:"attach", signed in), and resolves
 * true so the booking continues. Closing the sheet resolves false.
 *
 * `editContact(field)` (Account → Personal info) opens the same sheet to
 * change a detail. A new email or phone replaces the old one only once its
 * code is entered, so cancelling at any point leaves the account as it was.
 * Replacing one that is already VERIFIED first asks "Confirm it's you": a code
 * to a contact the account already trusts, unless they signed in minutes ago
 * (the server decides; routes/authV2.js recentlyConfirmed).
 *
 * THE OFFERS BOX. The "Add your mobile number" screen carries one optional,
 * unticked box, "Text me ProFixter offers, too." (consent
 * sms_marketing.phone_verify.v1). Verifying a number is never consent; the box
 * is recorded by the server only after the code proves the number, and a STOP
 * from that handset still wins. It is not shown to someone already receiving
 * offers. When a number is CHANGED, text consent stays with the old number
 * (utils/sms/consentOnPhoneChange.js), so both boxes are offered, unticked.
 */
type Stage = "name" | "confirm" | "confirm-code" | "phone" | "phone-code" | "email" | "email-code" | "notice";
export type ContactField = "name" | "phone" | "email";

const FINE = "mt-1 text-[12.5px] leading-[1.45] text-[color:var(--ui-text-3)]";
const LINK = "font-semibold text-[color:var(--ui-accent-ink)] underline underline-offset-2";

function OptInBox({
  id,
  checked,
  onChange,
  label,
  details,
  termsHash,
  attr,
}: {
  id: string;
  checked: boolean;
  onChange: (next: boolean) => void;
  label: string;
  details: string;
  termsHash: string;
  attr: string;
}) {
  return (
    <div className="flex items-start gap-2.5 text-left" {...{ [attr]: "" }}>
      <input
        id={id}
        type="checkbox"
        checked={checked}
        onChange={(e) => onChange(e.target.checked)}
        className="mt-[2px] h-[18px] w-[18px] flex-shrink-0 cursor-pointer rounded border-[color:var(--ui-line-2)] accent-[#0B1628]"
      />
      <div className="min-w-0 text-[14px] leading-[1.4] text-[color:var(--ui-text-2)]">
        <label htmlFor={id} className="cursor-pointer font-medium text-[color:var(--ui-ink)]">
          {label}
        </label>
        {/* Outside the label: reading what a consent means must never tick it. */}
        <p className={FINE}>
          {details}{" "}
          <a href={`/communication-consent#${termsHash}`} target="_blank" rel="noopener noreferrer" className={LINK}>
            SMS Terms
          </a>
          {" · "}
          <a href="/privacy" target="_blank" rel="noopener noreferrer" className={LINK}>
            Privacy
          </a>
        </p>
      </div>
    </div>
  );
}

/* Word for word what sms_marketing.phone_verify.v1 and sms_service.phone_change.v1 record (BackEnd utils/consent/consentText.js). */
const OFFERS_LABEL = "Text me ProFixter offers, too.";
const OFFERS_DETAILS = "Optional, not required to buy. Msg frequency varies. Msg & data rates may apply. Reply STOP to opt out, HELP for help.";
const VISITS_LABEL = "Text me about my ProFixter visits";
const VISITS_DETAILS = "Booking confirmations, reminders and arrival updates. Msg frequency varies. Msg & data rates may apply. Reply STOP to opt out, HELP for help.";

function ContactSheet({
  open,
  needs,
  onDone,
  onCancel,
  required = false,
  change = null,
}: {
  open: boolean;
  needs: { name: boolean; phone: boolean; email: boolean };
  onDone: () => void;
  onCancel: () => void;
  /** Cannot be closed (PhoneRequiredGate); offers "Sign out" instead. */
  required?: boolean;
  /** Changing a detail the account already has (Account → Personal info). */
  change?: ContactField | null;
}) {
  const { user, refreshUser, updateUser, logout } = useAuth();
  const changingVerified =
    (change === "phone" && Boolean(user?.phone) && user?.phoneVerified === true) ||
    (change === "email" && Boolean(user?.email) && user?.emailVerified === true);
  const firstStage = (): Stage => {
    if (change === "name") return "name";
    if (change && changingVerified && !sessionIsFresh()) return "confirm";
    if (change) return change;
    return needs.name ? "name" : needs.phone ? "phone" : "email";
  };
  const [stage, setStage] = useState<Stage>(firstStage);
  const [name, setName] = useState(change === "name" ? String(user?.name || "") : "");
  const [phone, setPhone] = useState("");
  const [email, setEmail] = useState("");
  const [masked, setMasked] = useState("");
  const [resendAt, setResendAt] = useState(0);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  // The two optional boxes: unticked, never restored from anywhere.
  const [offers, setOffers] = useState(false);
  const [visitTexts, setVisitTexts] = useState(false);
  // Confirm it's you.
  const confirmChannels = ([] as Array<"sms" | "email">)
    .concat(user?.phoneVerified && user?.phone ? ["sms"] : [])
    .concat(user?.emailVerified && user?.email && !user?.emailIsAppleRelay ? ["email"] : []);
  // Changing the phone: confirm by email first when we can (the old phone may be gone), and the other way round.
  const preferred: "sms" | "email" | null =
    change === "phone" ? (confirmChannels.includes("email") ? "email" : confirmChannels[0] || null) : confirmChannels.includes("sms") ? "sms" : confirmChannels[0] || null;
  const [confirmChannel, setConfirmChannel] = useState<"sms" | "email" | null>(preferred);
  const reauthToken = useRef("");
  const pendingCode = useRef("");
  const inputRef = useRef<HTMLInputElement>(null);
  const savedUser = useRef<User | null>(null);

  const showOffers = change === "phone" || user?.smsMarketingTexts !== true;
  const showVisitTexts = change === "phone";

  const fail = (message: string) => {
    setError(message);
    revealField(inputRef.current);
  };

  const attached = async (fresh: User | undefined, nextStage: Stage | null) => {
    if (fresh) updateUser(fresh);
    const latest = await refreshUser().catch(() => null);
    const stillMissing = missingContact(latest || fresh || null);
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
    if (!name.trim()) return fail("Please enter your name.");
    setLoading(true);
    setError("");
    try {
      const { user: saved } = await updateProfileName(name);
      updateUser(saved);
      if (change === "name") return onDone();
      const still = missingContact(saved);
      if (needs.phone && still.phone) setStage("phone");
      else if (needs.email && still.email) setStage("email");
      else onDone();
    } catch (err) {
      fail(readApiError(err).message || "Couldn't save your name. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  const sendConfirm = async (channel: "sms" | "email") => {
    if (loading) return;
    setLoading(true);
    setError("");
    try {
      const res = await startReauth(channel);
      setConfirmChannel(channel);
      setMasked(res.destination);
      setResendAt(Date.now() + (res.resendAfterSeconds || 30) * 1000);
      setStage("confirm-code");
    } catch (err) {
      setError(otpErrorMessage(readApiError(err), channel === "sms" ? "phone" : "email"));
    } finally {
      setLoading(false);
    }
  };

  const sendPhone = async (e: FormEvent) => {
    e.preventDefault();
    if (loading) return;
    const e164 = phoneToE164(phone);
    if (!e164) return fail("Enter a valid mobile number, like (631) 555-0123.");
    if (change === "phone" && e164 === phoneToE164(String(user?.phone || ""))) return fail("That is the number already on your account.");
    setLoading(true);
    setError("");
    try {
      const res = await startPhoneOtp({ phone: e164 });
      setMasked(res.phoneMasked || maskPhoneForDisplay(e164));
      setResendAt(Date.now() + (res.resendAfterSeconds || 30) * 1000);
      setStage("phone-code");
    } catch (err) {
      fail(otpErrorMessage(readApiError(err), "phone"));
    } finally {
      setLoading(false);
    }
  };

  const sendEmail = async (e: FormEvent) => {
    e.preventDefault();
    if (loading) return;
    if (!isValidEmail(email)) return fail("Enter a valid email address.");
    if (change === "email" && email.trim().toLowerCase() === String(user?.email || "").toLowerCase()) return fail("That is the email already on your account.");
    setLoading(true);
    setError("");
    try {
      const res = await startEmailOtp(email, { mode: "attach" });
      setMasked(res.emailMasked || email.trim().toLowerCase());
      setResendAt(Date.now() + (res.resendAfterSeconds || 30) * 1000);
      setStage("email-code");
    } catch (err) {
      fail(otpErrorMessage(readApiError(err), "email"));
    } finally {
      setLoading(false);
    }
  };

  const verify = async (code: string): Promise<CodeOutcome> => {
    const channel = stage === "phone-code" ? "phone" : "email";
    pendingCode.current = code;
    try {
      const res =
        channel === "phone"
          ? await verifyPhoneOtp({
              phone: phoneToE164(phone) || phone,
              code,
              mode: "attach",
              ...(showOffers || showVisitTexts ? { smsOptIn: { marketing: showOffers && offers, service: showVisitTexts && visitTexts } } : {}),
              ...(reauthToken.current ? { reauthToken: reauthToken.current } : {}),
            })
          : await verifyEmailOtp({ email, code, mode: "attach", ...(reauthToken.current ? { reauthToken: reauthToken.current } : {}) });
      if (res.status !== "attached" && res.status !== "signed_in") {
        return { error: "Something went wrong. Please try again." };
      }
      if (res.status === "attached" && res.smsOptIn?.blocked === "stopped") {
        // The number is saved; the STOP stands, and they are told rather than left believing texts will come.
        // The account is refreshed when they press Done: refreshing now would close a sheet that waits for a phone.
        savedUser.current = res.user || null;
        setNotice("Your number is saved. It had replied STOP to our texts, so we can't text it until you text START to (631) 888-6340.");
        setStage("notice");
        return null;
      }
      await attached(res.user, channel === "phone" && needs.email && !change ? "email" : null);
      return null;
    } catch (err) {
      // Rare (the session aged past ten minutes on this screen): the code is not used up - confirm, then enter it again.
      if (readApiError(err).code === "REAUTH_REQUIRED") {
        setStage("confirm");
        return null;
      }
      return outcomeFromError(err, channel);
    }
  };

  const verifyConfirm = async (code: string): Promise<CodeOutcome> => {
    const channel = confirmChannel || "sms";
    try {
      const res = await verifyReauth(channel, code);
      reauthToken.current = res.reauthToken;
      setError("");
      // Came here from a refused code: back to it (still valid), otherwise on to the new number or email.
      if (pendingCode.current && (phone || email)) {
        setStage(change === "email" ? "email-code" : "phone-code");
      } else {
        setStage(change === "email" ? "email" : "phone");
      }
      return null;
    } catch (err) {
      return outcomeFromError(err, channel === "sms" ? "phone" : "email");
    }
  };

  const resend = async (): Promise<CodeOutcome> => {
    const channel = stage === "phone-code" ? "phone" : "email";
    try {
      const res = channel === "phone" ? await startPhoneOtp({ phone: phoneToE164(phone) || phone }) : await startEmailOtp(email, { mode: "attach" });
      setResendAt(Date.now() + (res.resendAfterSeconds || 30) * 1000);
      return null;
    } catch (err) {
      return outcomeFromError(err, channel);
    }
  };

  const resendConfirm = async (): Promise<CodeOutcome> => {
    const channel = confirmChannel || "sms";
    try {
      const res = await startReauth(channel);
      setResendAt(Date.now() + (res.resendAfterSeconds || 30) * 1000);
      return null;
    } catch (err) {
      return outcomeFromError(err, channel === "sms" ? "phone" : "email");
    }
  };

  const title =
    stage === "confirm" || stage === "confirm-code"
      ? "Confirm it's you"
      : stage === "notice"
        ? "Number saved"
        : stage === "name"
          ? change === "name"
            ? "Your name"
            : "What's your name?"
          : stage === "phone" || stage === "phone-code"
            ? change === "phone"
              ? "Change your mobile number"
              : "Add your mobile number"
            : change === "email"
              ? "Change your email"
              : "Add your email";

  return (
    <Sheet open={open} onClose={onCancel} title={title} dismissible={!required}>
      {stage === "name" ? (
        <form onSubmit={saveName} noValidate className="mt-2 space-y-3">
          <p className="text-[14.5px] text-[#5b6577]">{change === "name" ? "As it appears on your visits and receipts." : "So your Fixter knows who to ask for."}</p>
          <label htmlFor="contact-name" className="sr-only">
            Your name
          </label>
          <input
            ref={inputRef}
            id="contact-name"
            type="text"
            autoComplete="name"
            autoCapitalize="words"
            maxLength={120}
            value={name}
            onChange={(e) => {
              setName(e.target.value);
              if (error) setError("");
            }}
            placeholder="Your name"
            aria-invalid={error ? "true" : undefined}
            className="auth-input"
          />
          <div aria-live="polite">{error ? <p className="auth-error" role="alert">{error}</p> : null}</div>
          <button type="submit" className="auth-submit !mt-3" disabled={loading}>
            {loading ? <span className="auth-spinner" aria-hidden="true" /> : null}
            {change === "name" ? "Save" : "Continue"}
          </button>
        </form>
      ) : null}

      {stage === "confirm" ? (
        <div className="mt-2 space-y-3" data-contact-confirm>
          {confirmChannel ? (
            <>
              <p className="text-[14.5px] text-[#5b6577]">
                Before we change your {change === "email" ? "email" : "mobile number"}, we&apos;ll send a code to the{" "}
                {confirmChannel === "sms" ? "mobile number" : "email"} already on your account.
              </p>
              <div aria-live="polite">{error ? <p className="auth-error" role="alert">{error}</p> : null}</div>
              <button type="button" className="auth-submit" disabled={loading} onClick={() => void sendConfirm(confirmChannel)} data-action="confirm-send">
                {loading ? <span className="auth-spinner" aria-hidden="true" /> : null}
                {confirmChannel === "sms" ? "Text me a code" : "Email me a code"}
              </button>
              {confirmChannels.length > 1 ? (
                <button
                  type="button"
                  className="auth-text-button mx-auto block"
                  onClick={() => setConfirmChannel(confirmChannel === "sms" ? "email" : "sms")}
                  data-action="confirm-other"
                >
                  {confirmChannel === "sms" ? "Use my email instead" : "Use my phone instead"}
                </button>
              ) : null}
            </>
          ) : (
            <p className="text-[14.5px] text-[#5b6577]" role="alert">
              We can&apos;t confirm it&apos;s you online. Please call <a href="tel:+16315991363" className={LINK}>631-599-1363</a> and we&apos;ll update it for you.
            </p>
          )}
        </div>
      ) : null}

      {stage === "phone" ? (
        <form onSubmit={sendPhone} noValidate className="mt-2 space-y-3">
          <p className="text-[14.5px] text-[#5b6577]">
            {change === "phone" ? "We'll text a code to the new number. Your current number stays until you enter it." : "Your Fixter uses it to reach you on the day of the visit."}
          </p>
          <label htmlFor="contact-phone" className="sr-only">
            Mobile number
          </label>
          <input
            ref={inputRef}
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
            aria-invalid={error ? "true" : undefined}
            className="auth-input"
          />
          <div aria-live="polite">{error ? <p className="auth-error" role="alert">{error}</p> : null}</div>
          {showOffers ? (
            <OptInBox
              id="contact-sms-offers"
              checked={offers}
              onChange={setOffers}
              label={OFFERS_LABEL}
              details={OFFERS_DETAILS}
              termsHash="marketing"
              attr="data-phone-offers-optin"
            />
          ) : null}
          {showVisitTexts ? (
            <OptInBox
              id="contact-sms-visits"
              checked={visitTexts}
              onChange={setVisitTexts}
              label={VISITS_LABEL}
              details={VISITS_DETAILS}
              termsHash="service-texts"
              attr="data-phone-visits-optin"
            />
          ) : null}
          <button type="submit" className="auth-submit !mt-3" disabled={loading}>
            {loading ? <span className="auth-spinner" aria-hidden="true" /> : null}
            {loading ? "Sending code" : "Text me a code"}
          </button>
          {/*
            * Consent version "terms.continue.v1", word for word, as on sign-up.
            * The code is a one-time text the person requests (Twilio Verify);
            * it is never consent to anything else - only the boxes above are.
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
          <p className="text-[14.5px] text-[#5b6577]">
            {change === "email" ? "We'll email a code to the new address. Your current email stays until you enter it." : "We send your booking confirmation and receipts here."}
          </p>
          <label htmlFor="contact-email" className="sr-only">
            Email address
          </label>
          <input
            ref={inputRef}
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
            aria-invalid={error ? "true" : undefined}
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
            pendingCode.current = "";
            setStage(stage === "phone-code" ? "phone" : "email");
          }}
          changeLabel={stage === "phone-code" ? "Change number" : "Change email"}
        />
      ) : null}

      {stage === "confirm-code" ? (
        <CodeStep
          key="confirm"
          compact
          idPrefix="contact-confirm"
          channel={confirmChannel === "email" ? "email" : "phone"}
          destination={masked}
          resendAt={resendAt}
          onVerify={verifyConfirm}
          onResend={resendConfirm}
          onChangeDestination={() => {
            setError("");
            setStage("confirm");
          }}
          changeLabel="Use another way"
        />
      ) : null}

      {stage === "notice" ? (
        <div className="mt-2 space-y-3" data-contact-notice>
          <p className="text-[14.5px] text-[#5b6577]" role="status">
            {notice}
          </p>
          <button type="button" className="auth-submit" onClick={() => void attached(savedUser.current || undefined, null)}>
            Done
          </button>
        </div>
      ) : null}

      {required ? (
        <button type="button" className="auth-text-button mx-auto mt-3 block" onClick={logout} data-action="phone-required-sign-out">
          Sign out
        </button>
      ) : null}
    </Sheet>
  );
}

/**
 * `const ok = await ensureContact()` before submitting; render `contactSheet`.
 * Pass `{ fields: ["email"] }` when only some details are needed (a gift needs
 * an email for its receipt, not a phone), so nobody is asked for more.
 * `editContact("email")` opens the sheet to change a detail the account has.
 */
export function useContactCompletion(): {
  ensureContact: (options?: { fields?: ContactField[] }) => Promise<boolean>;
  editContact: (field: ContactField) => Promise<boolean>;
  contactSheet: ReactNode;
} {
  const { user, isAuthenticated } = useAuth();
  const userRef = useRef(user);
  useEffect(() => {
    userRef.current = user;
  }, [user]);
  const [needs, setNeeds] = useState<{ name: boolean; phone: boolean; email: boolean } | null>(null);
  const [change, setChange] = useState<ContactField | null>(null);
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
    setChange(null);
    setNeeds(missing);
    return new Promise<boolean>((resolve) => {
      resolver.current = resolve;
    });
  }, [isAuthenticated]);

  const editContact = useCallback(async (field: ContactField) => {
    if (!isAuthenticated || !userRef.current) return false;
    resolver.current?.(false);
    setSheetKey((k) => k + 1);
    setChange(field);
    setNeeds({ name: field === "name", phone: field === "phone", email: field === "email" });
    return new Promise<boolean>((resolve) => {
      resolver.current = resolve;
    });
  }, [isAuthenticated]);

  const settle = (ok: boolean) => {
    setNeeds(null);
    setChange(null);
    resolver.current?.(ok);
    resolver.current = null;
  };

  const contactSheet = needs ? (
    <ContactSheet key={sheetKey} open needs={needs} change={change} onDone={() => settle(true)} onCancel={() => settle(false)} />
  ) : null;

  return { ensureContact, editContact, contactSheet };
}

/**
 * A new account's mobile number (2026-11-03). Every customer account made from
 * today must verify one before it is set up; phone sign-ups already have, and
 * email-code, Google and Apple sign-ups are asked here, the moment they land,
 * on whatever page that is - so a booking they started stays exactly where it
 * was under the sheet. The server decides who (user.phoneRequired, BackEnd
 * routes/auth.js phoneRequiredFor): never an older account, staff, or a
 * customer who already verified a number. It cannot be closed, only completed
 * or signed out of. One mount, in the root layout.
 */
export function PhoneRequiredGate() {
  const { user, isAuthenticated, refreshUser } = useAuth();
  const pathname = usePathname() || "/";
  if (!isAuthenticated || !user?.phoneRequired || surfaceFor(pathname) !== "site") return null;
  return (
    <ContactSheet
      open
      required
      needs={{ name: false, phone: true, email: false }}
      onDone={() => void refreshUser()}
      onCancel={() => undefined}
    />
  );
}
