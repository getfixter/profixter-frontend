"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type FormEvent,
  type ReactNode,
} from "react";
import { useAuth } from "@/lib/useAuth";
import { safeReturnPath } from "@/lib/auth-routing";
import { trackEvent } from "@/lib/analytics";
import { newEventId, trackLead, trackStartSignup } from "@/lib/meta";
import {
  appleSignIn,
  choosePhoneAccount,
  clearPendingFlow,
  conversionFields,
  createAccountForPhone,
  formatPhoneInput,
  googleSignIn,
  isValidEmail,
  loadPendingFlow,
  maskPhoneForDisplay,
  otpErrorMessage,
  passwordLogin,
  phoneToE164,
  readApiError,
  savePendingFlow,
  startEmailOtp,
  startPhoneOtp,
  verifyEmailOtp,
  verifyPhoneOtp,
  type ChooseAccountResult,
  type LinkRequiredResult,
  type PendingAuthFlow,
} from "@/lib/auth2";
import RoleEntryGate from "@/app/components/auth/RoleEntryGate";
import AuthScreen, { AuthHeading, AuthSubmit } from "@/app/components/auth/AuthScreen";
import CodeStep, { outcomeFromError, type CodeOutcome } from "@/app/components/auth/CodeStep";
import {
  ChooseAccountStep,
  EmailStep,
  LinkRequiredStep,
  MethodChooser,
  PasswordStep,
  type AccountChoice,
} from "@/app/components/auth/AuthSteps";
import type { AppleCredential } from "@/app/components/auth/AppleAuth";
import { useCompleteSignIn, type AuthMethod } from "@/app/components/auth/useCompleteSignIn";
import { hasBookableDraft, loadDraft } from "@/lib/booking-draft";

/*
 * Registration & Authentication 2.0.
 *
 * One screen of four ways in - phone (primary), Google, Apple, email - and
 * nothing else to fill in: no address, no plan, no password. The same page
 * serves /signin (app/(auth)/signin/page.tsx re-exports it), where returning
 * customers also get "Sign in with password".
 *
 * STEPS AND SCREENS. `step` is what the A2P evidence tests read: step 1 is the
 * choice of method and step 2 is the phone number, in this file's only form.
 * The remaining screens (the code, email, "we found your account", password)
 * are components that render once a number or address has been given.
 *
 * NO CHECKBOXES, ON PURPOSE. The registered A2P campaign makes text consent
 * optional and asks for none at sign-up. The code this screen sends is a
 * one-time text the person requests, delivered by Twilio Verify outside that
 * campaign, so it needs no box. Continuing accepts the Terms and Privacy Policy
 * (consent version "terms.continue.v1" in BackEnd utils/consent/consentText.js,
 * word for word in the line under the button). Service texts are offered later,
 * as one optional unticked box at the booking step (ServiceTextsOptIn) and in
 * account settings; marketing texts only in account settings. Nothing about
 * texting is asked, or bundled, here.
 */
type Screen = "methods" | "phone" | "code" | "email" | "link" | "password" | "choose";

type Carry = { kind: "free-visit"; when: string } | { kind: "plan"; label: string } | null;

/** The label, kept for assistive technology and not drawn: the heading is the label. */
function FieldLabel({ htmlFor, children }: { htmlFor: string; children: ReactNode }) {
  return (
    <label htmlFor={htmlFor} className="sr-only">
      {children}
    </label>
  );
}

export default function SignUpPage() {
  const pathname = usePathname();
  const mode: "signup" | "signin" = pathname?.startsWith("/signin") ? "signin" : "signup";
  const { isAuthenticated, isLoading } = useAuth();
  const completeSignIn = useCompleteSignIn();

  const [screen, setScreen] = useState<Screen>("methods");
  /* What the A2P tests call the step: 1 = choose a method, 2 = the phone number. */
  const step = screen === "methods" ? 1 : screen === "phone" ? 2 : 0;

  const [phone, setPhone] = useState("");
  const [email, setEmail] = useState("");
  const [codeChannel, setCodeChannel] = useState<"phone" | "email">("phone");
  const [masked, setMasked] = useState("");
  const [resendAt, setResendAt] = useState(0);
  const [linkToken, setLinkToken] = useState("");
  const [hint, setHint] = useState<LinkRequiredResult["hint"] | null>(null);
  const [accountChoices, setAccountChoices] = useState<AccountChoice[]>([]);
  const [choiceToken, setChoiceToken] = useState("");
  const [householdAccounts, setHouseholdAccounts] = useState<ChooseAccountResult["accounts"]>([]);
  const [choosingId, setChoosingId] = useState("");

  const [fieldErrors, setFieldErrors] = useState<{ email?: string; phone?: string }>({});
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [offerEmail, setOfferEmail] = useState(false);

  const [returnTo, setReturnTo] = useState("");
  const [carry, setCarry] = useState<Carry>(null);
  const restored = useRef(false);
  const busy = useRef(false);

  /* What the visitor was in the middle of, and a refresh in the middle of a code. */
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const next = safeReturnPath(params.get("next")) || "";
    let nextCarry: Carry = null;
    if (next.startsWith("/book/free")) {
      const draft = loadDraft();
      if (hasBookableDraft(draft)) {
        const [y, m, d] = draft.requestedDate.split("-").map(Number);
        const day = new Date(Date.UTC(y, m - 1, d)).toLocaleDateString("en-US", {
          weekday: "short", month: "short", day: "numeric", timeZone: "UTC",
        });
        const [hh, mm] = draft.requestedTime.split(":").map(Number);
        const time = `${hh % 12 === 0 ? 12 : hh % 12}:${String(mm).padStart(2, "0")} ${hh >= 12 ? "PM" : "AM"}`;
        nextCarry = { kind: "free-visit", when: `${day} · ${time}` };
      }
    } else if (next.startsWith("/membership/plans") || next.startsWith("/book?visit=membership")) {
      try {
        const pending = JSON.parse(sessionStorage.getItem("pendingCheckoutPlan") || "null");
        if (pending?.summary) nextCarry = { kind: "plan", label: String(pending.summary) };
      } catch {
        /* no plan to show */
      }
    }
    const code = params.get("promo")?.trim().toUpperCase() || "";
    if (code) sessionStorage.setItem("pendingPromoCode", code);

    const flow = loadPendingFlow();
    queueMicrotask(() => {
      setReturnTo(next);
      setCarry(nextCarry);
      if (flow) {
        setPhone(flow.phone || "");
        setEmail(flow.email || "");
        setMasked(flow.masked || "");
        setCodeChannel(flow.channel || "phone");
        setResendAt(flow.resendAt || 0);
        setLinkToken(flow.linkToken || "");
        setHint(flow.hint || null);
        setChoiceToken(flow.choiceToken || "");
        setHouseholdAccounts(flow.accounts || []);
        /* An expired code is not worth returning to: go back to where it is asked for. */
        const expired = flow.screen === "code" && flow.expiresAt && flow.expiresAt < Date.now();
        setScreen(expired ? (flow.channel === "email" ? "email" : "phone") : flow.screen);
      }
      restored.current = true;
    });
    trackEvent(mode === "signin" ? "view_login" : "view_signup", { page: mode === "signin" ? "/signin" : "/signup" });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  /* Keep the unfinished flow in this tab's session, never the password. */
  const persist = useCallback(
    (patch: Partial<Omit<PendingAuthFlow, "savedAt">> & { screen: PendingAuthFlow["screen"] }) => {
      savePendingFlow({
        phone,
        email,
        masked,
        channel: codeChannel,
        resendAt,
        linkToken: linkToken || undefined,
        hint: hint || undefined,
        ...patch,
      });
    },
    [phone, email, masked, codeChannel, resendAt, linkToken, hint]
  );

  const go = useCallback(
    (next: Screen) => {
      setError("");
      setFieldErrors({});
      setOfferEmail(false);
      setAccountChoices([]);
      setScreen(next);
      if (next === "methods") clearPendingFlow();
      else persist({ screen: next });
    },
    [persist]
  );

  /* Focus follows the screen, so a keyboard or screen reader lands on the question. */
  const firstScreen = useRef(true);
  useEffect(() => {
    if (firstScreen.current) {
      firstScreen.current = false;
      return;
    }
    const selector =
      screen === "phone" ? "#phone" : screen === "email" || screen === "password" ? "#auth-email" : screen === "code" ? null : ".auth-question";
    if (selector) document.querySelector<HTMLElement>(selector)?.focus({ preventScroll: true });
    window.scrollTo({ top: 0 });
  }, [screen]);

  const choose = (method: AuthMethod) => {
    trackEvent("signup_started", { page: mode === "signin" ? "/signin" : "/signup", method });
    if (mode === "signup") trackStartSignup({ content_name: "signup_method", method });
  };

  const finish = async (token: string, created: boolean, eventId: string, method: AuthMethod) => {
    await completeSignIn({
      token,
      created,
      eventId,
      method,
      /*
       * The Lead, for a NEW account only, after identify() has run so it
       * carries the matching identifiers. relay: false - the server already
       * sent this to the Conversions API with the same event id.
       */
      onCreated: () =>
        trackLead(
          { content_name: "account_created", status: "new_account", lead_type: "account" },
          { eventId, relay: false }
        ),
    });
  };

  /* --------------------------------------------------------------- phone */

  /*
   * The step validators. Each answers one question about what is on screen and
   * reports it beside the control that can fix it. There is no consent to
   * validate: sign-up asks for none.
   */
  const validatePhoneNumberStep = () => {
    if (!phone.trim()) {
      setFieldErrors({ phone: "Enter your mobile number." });
      return false;
    }
    if (!phoneToE164(phone)) {
      setFieldErrors({ phone: "Enter a valid mobile number, like (631) 555-0123." });
      return false;
    }
    return true;
  };

  const validateEmailStep = () => {
    if (!isValidEmail(email)) {
      setFieldErrors({ email: email.trim() ? "Enter a valid email address." : "Enter your email." });
      return false;
    }
    return true;
  };

  const sendPhoneCode = async (e?: FormEvent<HTMLFormElement>) => {
    e?.preventDefault();
    if (busy.current) return;
    setError("");
    setOfferEmail(false);
    if (!validatePhoneNumberStep()) return;
    const e164 = phoneToE164(phone) as string;
    busy.current = true;
    setLoading(true);
    try {
      const res = await startPhoneOtp({ phone: e164 });
      const nextMasked = res.phoneMasked || maskPhoneForDisplay(e164);
      const nextResendAt = Date.now() + (res.resendAfterSeconds || 30) * 1000;
      setMasked(nextMasked);
      setResendAt(nextResendAt);
      setCodeChannel("phone");
      setScreen("code");
      persist({
        screen: "code",
        channel: "phone",
        masked: nextMasked,
        resendAt: nextResendAt,
        expiresAt: Date.now() + (res.expiresInSeconds || 600) * 1000,
      });
    } catch (err) {
      const parsed = readApiError(err);
      if (parsed.code === "INVALID_PHONE") setFieldErrors({ phone: otpErrorMessage(parsed, "phone") });
      else {
        setError(otpErrorMessage(parsed, "phone"));
        setOfferEmail(parsed.code === "SMS_UNAVAILABLE");
      }
    } finally {
      busy.current = false;
      setLoading(false);
    }
  };

  /* --------------------------------------------------------------- email */

  const sendEmailCode = async () => {
    if (busy.current) return;
    setError("");
    if (!validateEmailStep()) return;
    busy.current = true;
    setLoading(true);
    try {
      const res = await startEmailOtp(email);
      const nextMasked = res.emailMasked || email.trim().toLowerCase();
      const nextResendAt = Date.now() + (res.resendAfterSeconds || 30) * 1000;
      setMasked(nextMasked);
      setResendAt(nextResendAt);
      setCodeChannel("email");
      setScreen("code");
      persist({
        screen: "code",
        channel: "email",
        masked: nextMasked,
        resendAt: nextResendAt,
        expiresAt: Date.now() + (res.expiresInSeconds || 600) * 1000,
      });
    } catch (err) {
      setFieldErrors({ email: otpErrorMessage(readApiError(err), "email") });
    } finally {
      busy.current = false;
      setLoading(false);
    }
  };

  /* ---------------------------------------------------------------- code */

  const verifyCode = async (code: string): Promise<CodeOutcome> => {
    const eventId = newEventId();
    try {
      if (codeChannel === "phone") {
        const e164 = phoneToE164(phone) || phone;
        const res = await verifyPhoneOtp({ phone: e164, code, ...conversionFields(eventId) });
        if (res.status === "link_required") {
          setLinkToken(res.linkToken);
          setHint(res.hint);
          setScreen("link");
          persist({ screen: "link", linkToken: res.linkToken, hint: res.hint });
          return null;
        }
        if (res.status === "choose_account") {
          setChoiceToken(res.choiceToken);
          setHouseholdAccounts(res.accounts || []);
          setScreen("choose");
          persist({ screen: "choose", choiceToken: res.choiceToken, accounts: res.accounts || [] });
          return null;
        }
        if (res.status === "signed_in") {
          await finish(res.token, res.created, eventId, "phone");
          return null;
        }
        return { error: "Something went wrong. Please try again." };
      }
      const res = await verifyEmailOtp({
        email,
        code,
        ...(linkToken ? { linkToken } : {}),
        ...conversionFields(eventId),
      });
      if (res.status === "signed_in") {
        await finish(res.token, res.created, eventId, "email");
        return null;
      }
      return { error: "Something went wrong. Please try again." };
    } catch (err) {
      if (err instanceof Error && !("response" in err) && err.message.startsWith("We couldn't open")) {
        return { error: err.message, keepCode: true };
      }
      return outcomeFromError(err, codeChannel);
    }
  };

  const resendCode = async (): Promise<CodeOutcome> => {
    try {
      if (codeChannel === "phone") {
        const e164 = phoneToE164(phone) || phone;
        const res = await startPhoneOtp({ phone: e164 });
        const nextResendAt = Date.now() + (res.resendAfterSeconds || 30) * 1000;
        setResendAt(nextResendAt);
        persist({ screen: "code", resendAt: nextResendAt, expiresAt: Date.now() + (res.expiresInSeconds || 600) * 1000 });
      } else {
        const res = await startEmailOtp(email);
        const nextResendAt = Date.now() + (res.resendAfterSeconds || 30) * 1000;
        setResendAt(nextResendAt);
        persist({ screen: "code", resendAt: nextResendAt, expiresAt: Date.now() + (res.expiresInSeconds || 600) * 1000 });
      }
      return null;
    } catch (err) {
      return outcomeFromError(err, codeChannel);
    }
  };

  /* ------------------------------------------------------- choose_account */

  const chooseHouseholdAccount = async (accountId: string) => {
    if (busy.current || !choiceToken) return;
    busy.current = true;
    setChoosingId(accountId);
    setError("");
    try {
      const res = await choosePhoneAccount({ choiceToken, accountId });
      await finish(res.token, false, "", "phone");
    } catch (err) {
      const parsed = readApiError(err);
      setChoosingId("");
      if (parsed.code === "LINK_EXPIRED") {
        setChoiceToken("");
        setHouseholdAccounts([]);
        go("phone");
        setError(otpErrorMessage(parsed, "phone"));
      } else {
        setError(otpErrorMessage(parsed, "phone"));
      }
    } finally {
      busy.current = false;
    }
  };

  /* -------------------------------------------------------- link_required */

  const createNewAccount = async () => {
    if (busy.current || !linkToken) return;
    busy.current = true;
    setLoading(true);
    setError("");
    const eventId = newEventId();
    try {
      const res = await createAccountForPhone({ linkToken, ...conversionFields(eventId) });
      await finish(res.token, true, eventId, "phone");
    } catch (err) {
      const parsed = readApiError(err);
      setError(
        parsed.code === "CODE_EXPIRED" || parsed.status === 410
          ? "That took a little too long. Please confirm your number again."
          : otpErrorMessage(parsed, "phone")
      );
      setLoading(false);
    } finally {
      busy.current = false;
    }
  };

  /* ------------------------------------------------------------ password */

  const signInWithPassword = async (password: string, accountRole?: "customer" | "employee") => {
    if (busy.current) return;
    if (!isValidEmail(email) || !password) {
      setError("Enter your email and password.");
      return;
    }
    busy.current = true;
    setLoading(true);
    setError("");
    try {
      const res = await passwordLogin({
        email,
        password,
        ...(linkToken ? { linkToken } : {}),
        ...(accountRole ? { accountRole } : {}),
      });
      try {
        localStorage.setItem("rememberedEmail", email.trim());
      } catch {
        /* not essential */
      }
      await finish(res.token, false, "", "password");
    } catch (err) {
      const parsed = readApiError(err);
      if (parsed.code === "ACCOUNT_CHOICE_REQUIRED") {
        setAccountChoices(parsed.accounts || []);
      } else {
        setError(parsed.message || (parsed.code === "NETWORK" ? otpErrorMessage(parsed, "email") : "Invalid email or password"));
      }
      setLoading(false);
    } finally {
      busy.current = false;
    }
  };

  /* ------------------------------------------------------- Google / Apple */

  const signInWithGoogle = async (idToken: string) => {
    if (busy.current) return;
    choose("google");
    busy.current = true;
    setLoading(true);
    setError("");
    const eventId = newEventId();
    try {
      const res = await googleSignIn({ idToken, ...conversionFields(eventId) });
      await finish(res.token, Boolean(res.created), eventId, "google");
    } catch (err) {
      setError(readApiError(err).message || "Google sign-in didn't finish. Please try again.");
      setLoading(false);
    } finally {
      busy.current = false;
    }
  };

  const signInWithApple = async (credential: AppleCredential) => {
    if (busy.current) return;
    busy.current = true;
    setLoading(true);
    setError("");
    const eventId = newEventId();
    try {
      const res = await appleSignIn({ ...credential, ...conversionFields(eventId) });
      await finish(res.token, Boolean(res.created), eventId, "apple");
    } catch (err) {
      setError(readApiError(err).message || "Apple sign-in didn't finish. Please try again.");
      setLoading(false);
    } finally {
      busy.current = false;
    }
  };

  /* ---------------------------------------------------------------- copy */

  const heading = (() => {
    switch (screen) {
      case "methods":
        if (mode === "signin") return "Welcome back";
        return carry?.kind === "free-visit" ? "Almost done. Create your account to book." : "Create your account";
      case "phone":
        return "What's your mobile number?";
      case "code":
        return codeChannel === "phone" ? "Check your texts" : "Check your email";
      case "email":
        return linkToken ? "Confirm it's you" : "What's your email?";
      case "link":
        return "We found an existing Profixter account for this number";
      case "password":
        return "Sign in with password";
      case "choose":
        return "Which account?";
    }
  })();

  const sub =
    screen === "methods"
      ? mode === "signin"
        ? "Use the way you signed up. No password needed."
        : "It takes seconds. No password, no forms."
      : screen === "link"
        ? "Confirm it's yours to open it, or start a new account."
        : screen === "choose"
          ? "More than one Profixter account uses this number. Choose yours."
          : undefined;

  const back = (() => {
    switch (screen) {
      case "phone":
        return () => go("methods");
      case "code":
        return () => go(codeChannel === "phone" ? (linkToken ? "link" : "phone") : "email");
      case "email":
        return () => go(linkToken ? "link" : "methods");
      case "link":
      case "choose":
        return () => go("phone");
      case "password":
        return () => go(linkToken ? "link" : "methods");
      default:
        return undefined;
    }
  })();

  const altHref = mode === "signin"
    ? returnTo ? `/signup?next=${encodeURIComponent(returnTo)}` : "/signup"
    : returnTo ? `/signin?next=${encodeURIComponent(returnTo)}` : "/signin";

  return (
    <RoleEntryGate loadingLabel="Checking your session..." redirectLabel="Opening Your Home...">
      <AuthScreen altLabel={mode === "signin" ? "Create account" : "Log In"} altHref={altHref}>
        {carry && screen === "methods" ? (
          <p className="auth-carry" data-signup-carry={carry.kind}>
            {carry.kind === "free-visit" ? (
              <>
                <b>Free visit</b> {carry.when}
              </>
            ) : (
              <>
                <b>Your plan</b> {carry.label}
              </>
            )}
          </p>
        ) : null}

        <AuthHeading onBack={back} sub={sub}>
          {heading}
        </AuthHeading>

        {step === 1 ? (
          <MethodChooser
            mode={mode}
            busy={loading}
            oneTap={!isAuthenticated && !isLoading && screen === "methods"}
            onPhone={() => {
              choose("phone");
              go("phone");
            }}
            onEmail={() => {
              choose("email");
              setLinkToken("");
              setHint(null);
              go("email");
            }}
            onPassword={() => {
              choose("password");
              setLinkToken("");
              setHint(null);
              try {
                setEmail((prev) => prev || localStorage.getItem("rememberedEmail") || "");
              } catch {
                /* nothing remembered */
              }
              go("password");
            }}
            onGoogle={(idToken) => void signInWithGoogle(idToken)}
            onApple={(credential) => void signInWithApple(credential)}
            onAppleStart={() => choose("apple")}
            onProviderError={setError}
          />
        ) : null}

        {step === 2 ? (
          <form onSubmit={sendPhoneCode} className="auth-fields" noValidate>
            <div>
              <FieldLabel htmlFor="phone">Mobile Phone Number</FieldLabel>
              <input
                id="phone"
                type="tel"
                inputMode="tel"
                autoComplete="tel"
                enterKeyHint="send"
                value={phone}
                onChange={(e) => {
                  setPhone(formatPhoneInput(e.target.value));
                  if (fieldErrors.phone) setFieldErrors({});
                  if (error) setError("");
                }}
                placeholder="(631) 555-0123"
                aria-invalid={fieldErrors.phone ? true : undefined}
                aria-describedby={fieldErrors.phone ? "phone-error" : "terms-continue"}
                className="auth-input"
              />
              <div aria-live="polite">
                {fieldErrors.phone ? (
                  <p id="phone-error" className="auth-error">
                    {fieldErrors.phone}
                  </p>
                ) : null}
              </div>
            </div>

            <div aria-live="polite">
              {error ? (
                <p className="auth-error auth-error--form" role="alert">
                  {error}
                  {offerEmail ? (
                    <>
                      {" "}
                      <button
                        type="button"
                        className="font-bold underline underline-offset-[3px]"
                        onClick={() => {
                          setLinkToken("");
                          go("email");
                        }}
                      >
                        Use email
                      </button>
                    </>
                  ) : null}
                </p>
              ) : null}
            </div>

            <AuthSubmit disabled={loading} loading={loading}>
              {loading ? "Sending code" : "Text me a code"}
            </AuthSubmit>

            {/*
              * The whole disclosure, and the only one: consent version
              * "terms.continue.v1", word for word. No checkbox - continuing is
              * the acceptance - and no marketing of any kind. The links open in
              * a new tab so reading them never loses the number typed above.
              */}
            <p id="terms-continue" className="auth-fineprint" data-terms-continue>
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

        {screen === "code" ? (
          <CodeStep
            key={`${codeChannel}-${masked}`}
            idPrefix="auth"
            channel={codeChannel}
            destination={masked}
            resendAt={resendAt}
            onVerify={verifyCode}
            onResend={resendCode}
            onChangeDestination={() => go(codeChannel === "phone" ? "phone" : "email")}
            changeLabel={codeChannel === "phone" ? "Change number" : "Change email"}
          />
        ) : null}

        {screen === "email" ? (
          <EmailStep
            email={email}
            onEmail={(value) => {
              setEmail(value);
              if (fieldErrors.email) setFieldErrors({});
            }}
            onSubmit={() => void sendEmailCode()}
            loading={loading}
            error={fieldErrors.email || ""}
            maskedHint={linkToken ? hint?.maskedEmail || null : null}
          />
        ) : null}

        {screen === "link" ? (
          <LinkRequiredStep
            maskedEmail={hint?.maskedEmail || null}
            hasPassword={Boolean(hint?.hasPassword)}
            loading={loading}
            onEmailCode={() => {
              setEmail("");
              go("email");
            }}
            onPassword={() => {
              setEmail("");
              go("password");
            }}
            onNewAccount={() => void createNewAccount()}
          />
        ) : null}

        {screen === "password" ? (
          <PasswordStep
            email={email}
            onEmail={(value) => {
              setEmail(value);
              if (error) setError("");
            }}
            onSubmit={(password) => void signInWithPassword(password)}
            onChoose={(role, password) => void signInWithPassword(password, role)}
            loading={loading}
            error={error}
            choices={accountChoices}
          />
        ) : null}

        {screen === "choose" ? (
          <ChooseAccountStep accounts={householdAccounts} loadingId={choosingId} onChoose={(id) => void chooseHouseholdAccount(id)} />
        ) : null}

        {(screen === "methods" || screen === "link" || screen === "choose") && error ? (
          <p className="auth-error auth-error--form" role="alert" aria-live="assertive">
            {error}
          </p>
        ) : null}

        {screen === "methods" && carry?.kind !== "plan" && mode === "signup" ? (
          <p className="auth-reassure">
            <b>First visit free.</b> No card required.
          </p>
        ) : null}
      </AuthScreen>
    </RoleEntryGate>
  );
}
