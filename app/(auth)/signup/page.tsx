"use client";

import Link from "next/link";
import Image from "next/image";
import { useRouter } from "next/navigation";
import {
  useEffect,
  useMemo,
  useState,
  type ChangeEvent,
  type FormEvent,
  type ReactNode,
} from "react";
import { register } from "@/lib/auth-service";
import { getRoleLandingPath, safeReturnPath } from "@/lib/auth-routing";
import { useAuth } from "@/lib/useAuth";
import { extractUSNationalPhoneDigits, isValidUSNationalPhoneDigits } from "@/lib/phone";
import { trackEvent } from "@/lib/analytics";
import RoleEntryGate from "@/app/components/auth/RoleEntryGate";
import AddressField, { type AddressValue, type ServiceAreaState } from "@/app/components/address/AddressField";

type Step = 1 | 2 | 3 | 4;

const stepCopy: Record<Step, { title: string; subtitle: string }> = {
  1: {
    /*
     * One question, and nothing underneath it.
     *
     * The subtitle used to explain what an address was for. The field now says
     * "Start typing your address..." and the button says Continue, which is the
     * same information in a place the customer was already looking.
     */
    title: "What's your home address?",
    subtitle: "",
  },
  2: {
    title: "How should we call you?",
    subtitle: "Tell us whose home we are helping.",
  },
  3: {
    title: "What is your email?",
    subtitle: "Confirmations, reminders and receipts go here.",
  },
  4: {
    title: "Almost done",
    subtitle: "Set a password and choose which texts you want.",
  },
};

const initialFormData = {
  name: "",
  email: "",
  password: "",
  repeatPassword: "",
  phone: "",
  address: "",
  city: "",
  state: "NY",
  zip: "",
  county: "",
};

type FormData = typeof initialFormData;

function PasswordToggle({
  value,
  onChange,
  placeholder = "Password",
  id,
  autoComplete = "new-password",
}: {
  value: string;
  onChange: (e: ChangeEvent<HTMLInputElement>) => void;
  placeholder?: string;
  id: string;
  autoComplete?: string;
}) {
  const [show, setShow] = useState(false);
  return (
    <div className="relative">
      <input
        id={id}
        type={show ? "text" : "password"}
        value={value}
        onChange={onChange}
        placeholder={placeholder}
        autoComplete={autoComplete}
        className="h-12 w-full rounded-[6px] border border-white/[0.14] bg-white/[0.07] px-3.5 pr-11 text-[14px] text-white placeholder-white/32 outline-none transition-all focus:border-[#7BAEFF]/80 focus:bg-white/[0.10] focus:ring-4 focus:ring-[#306EEC]/20"
      />
      <button
        type="button"
        onClick={() => setShow(!show)}
        className="absolute right-3 top-1/2 -translate-y-1/2 text-white/38 transition hover:text-white/72"
        aria-label={show ? "Hide password" : "Show password"}
      >
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden="true">
          {show ? (
            <>
              <path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24" strokeLinecap="round" strokeLinejoin="round" />
              <line x1="1" y1="1" x2="23" y2="23" strokeLinecap="round" />
            </>
          ) : (
            <>
              <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" strokeLinecap="round" strokeLinejoin="round" />
              <circle cx="12" cy="12" r="3" />
            </>
          )}
        </svg>
      </button>
    </div>
  );
}

function FieldLabel({ htmlFor, children }: { htmlFor: string; children: ReactNode }) {
  return (
    <label htmlFor={htmlFor} className="mb-1.5 block text-[11px] font-bold uppercase tracking-[0.12em] text-white/58">
      {children}
    </label>
  );
}

function FieldInput({
  id,
  value,
  onChange,
  placeholder,
  type = "text",
  autoComplete,
  maxLength,
}: {
  id: string;
  value: string;
  onChange: (e: ChangeEvent<HTMLInputElement>) => void;
  placeholder: string;
  type?: string;
  autoComplete?: string;
  maxLength?: number;
}) {
  return (
    <input
      id={id}
      type={type}
      value={value}
      onChange={onChange}
      placeholder={placeholder}
      autoComplete={autoComplete}
      maxLength={maxLength}
      className="h-12 w-full rounded-[6px] border border-white/[0.14] bg-white/[0.07] px-3.5 text-[14px] text-white placeholder-white/32 outline-none transition-all focus:border-[#7BAEFF]/80 focus:bg-white/[0.10] focus:ring-4 focus:ring-[#306EEC]/20"
    />
  );
}

/**
 * One tick box, shared by all three consents on this page.
 *
 * THE THREE BOXES DELIBERATELY LOOK ALIKE.
 *
 * Terms acceptance is required and the two SMS boxes are not, but they are
 * rendered by the same component at the same weight so that nobody - customer
 * or carrier reviewer - can mistake the optional ones for fine print bolted
 * onto the required one. Bundling is the thing being disproved here, and three
 * visibly equal, visibly separate controls is what disproves it.
 */
function ConsentCheckbox({
  id,
  checked,
  onChange,
  label,
  children,
}: {
  id: string;
  checked: boolean;
  onChange: (next: boolean) => void;
  label: string;
  children?: ReactNode;
}) {
  return (
    <label
      htmlFor={id}
      className="flex cursor-pointer items-start gap-2.5 rounded-[8px] border border-white/[0.09] bg-white/[0.04] p-3"
    >
      <span className="relative mt-0.5 flex flex-shrink-0">
        <input
          id={id}
          type="checkbox"
          checked={checked}
          onChange={(e) => onChange(e.target.checked)}
          className="peer sr-only"
        />
        <span className="flex h-4 w-4 flex-shrink-0 items-center justify-center rounded-[4px] border border-white/30 transition peer-checked:border-[#306EEC] peer-checked:bg-[#306EEC]">
          {checked ? (
            <svg width="9" height="7" viewBox="0 0 9 7" fill="none" aria-hidden="true">
              <path d="M1 3.5l2 2L8 1" stroke="white" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          ) : null}
        </span>
      </span>
      <span className="text-[12px] leading-relaxed text-white/56">
        <span className="font-semibold text-white/78">{label}</span>
        {children ? <span className="mt-1 block text-white/44">{children}</span> : null}
      </span>
    </label>
  );
}

/**
 * One consent row whose visible name is the link.
 *
 * WHY THIS IS NOT ConsentCheckbox WITH AN ANCHOR PASSED IN.
 *
 * That component wraps its whole row in a <label>, and a click anywhere inside
 * a label is forwarded to the control - so a customer tapping "Service text
 * messages" to find out what it means would silently tick the box on the way
 * out of the page, and arrive at the explanation having already agreed to the
 * thing it explains. Here the <label> covers the tick target alone and the
 * anchor is its sibling: tapping the box toggles, tapping the words opens the
 * page, and neither does the other's job.
 *
 * The link opens in a new tab because the alternative is losing a part-filled
 * four-step registration in order to read a definition.
 */
function ConsentRow({
  id,
  checked,
  onChange,
  label,
  href,
  requirement,
}: {
  id: string;
  checked: boolean;
  onChange: (next: boolean) => void;
  label: string;
  href: string;
  /*
   * NOT RENDERED, AND STILL LOAD-BEARING.
   *
   * The row used to print this word beside the label. The owner removed it:
   * two names and two boxes is the whole of what the final step should look
   * like, and a customer who has to be told which one is compulsory before
   * they have tried anything is being warned rather than asked.
   *
   * The value survives because required-ness has three other jobs to do. It
   * marks the control for assistive technology, it is what the source-scanning
   * compliance tests read to prove the SERVICE box is the required one and the
   * marketing box never is, and it keeps the distinction stated in the file
   * rather than implied by which of two <ConsentRow>s came first.
   */
  requirement: "Required" | "Optional";
}) {
  return (
    <div className="flex items-center gap-2.5 rounded-[8px] border border-white/[0.09] bg-white/[0.04] px-3 py-2.5">
      {/*
        * The negative margin is what keeps this honest: the padding grows the
        * tap target to something a thumb can hit, and the -m-2 pulls the row
        * back to the height it would have had, so the control gets bigger
        * without the row getting taller.
        */}
      <label htmlFor={id} className="-m-2 flex flex-shrink-0 cursor-pointer items-center p-2">
        <input
          id={id}
          type="checkbox"
          checked={checked}
          onChange={(e) => onChange(e.target.checked)}
          /*
           * aria-required, never the HTML `required` attribute. The real one
           * would hand the browser the failure and pop its own bubble, which
           * is the one thing the inline message exists to avoid; this one only
           * announces, and leaves the reporting where we put it.
           */
          aria-required={requirement === "Required"}
          className="peer sr-only"
        />
        <span className="flex h-[18px] w-[18px] flex-shrink-0 items-center justify-center rounded-[4px] border border-white/30 transition peer-checked:border-[#306EEC] peer-checked:bg-[#306EEC] peer-focus-visible:ring-2 peer-focus-visible:ring-[#306EEC]/60">
          {checked ? (
            <svg width="10" height="8" viewBox="0 0 9 7" fill="none" aria-hidden="true">
              <path d="M1 3.5l2 2L8 1" stroke="white" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          ) : null}
        </span>
      </label>
      <span className="text-[13px] leading-snug">
        <a
          href={href}
          target="_blank"
          rel="noopener noreferrer"
          className="font-semibold text-white/82 underline decoration-white/25 underline-offset-4 transition hover:text-white"
        >
          {label}
        </a>
      </span>
    </div>
  );
}

export default function SignUpPage() {
  const router = useRouter();
  const { login: authLogin } = useAuth();
  const [step, setStep] = useState<Step>(1);
  /*
   * The address, only ever set by picking one out of the lookup (or by the
   * manual fallback). Null means "nothing we would send a Fixter to yet", which
   * is what Continue checks.
   */
  const [address, setAddress] = useState<AddressValue | null>(null);
  /*
   * Whether the chosen property is somewhere the First Visit Free offer applies.
   *
   * Kept at the page level, not inside the address field, because the promise it
   * governs is the badge at the top of every step - so once the address says the
   * offer does not apply, it has to stop being made for the rest of the flow,
   * not just on the screen where we found out.
   */
  const [serviceArea, setServiceArea] = useState<ServiceAreaState>("unknown");
  /*
   * Unchecked, deliberately.
   *
   * A pre-ticked box is not affirmative consent. TCPA/CTIA and Twilio's web
   * form opt-in standard both require the customer to perform the tick
   * themselves, and an A2P reviewer loading this page checks exactly this.
   */
  const [agreeTerms, setAgreeTerms] = useState(false);
  const [consentError, setConsentError] = useState(false);
  /* Raised only by an attempt to finish, and only by the service box. */
  const [smsConsentError, setSmsConsentError] = useState(false);
  /*
   * THE TWO SMS CONSENTS. BOTH OPTIONAL, BOTH UNCHECKED, BOTH INERT.
   *
   * Neither is read by any validator on this page. That is not an incidental
   * detail, it is the whole compliance claim: a customer can leave both alone
   * and still register, book, pay and use every part of ProFixter, and the only
   * consequence is that we never text them. Everything they need still arrives
   * by email.
   *
   * Service and marketing are two separate states rather than one, because they
   * rest on different permissions and a customer may reasonably want
   * appointment reminders and no advertising. Collapsing them into a single
   * box, or into the Terms box above, is the forced-consent defect this pair
   * exists to remove - the carrier reviewer who rejected the campaign was
   * looking at a page where service texts had no box at all.
   */
  const [smsTransactionalConsent, setSmsTransactionalConsent] = useState(false);
  const [smsMarketingConsent, setSmsMarketingConsent] = useState(false);
  const [fieldErrors, setFieldErrors] = useState<{ email?: string; phone?: string }>({});
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const [formData, setFormData] = useState<FormData>(initialFormData);

  const passwordsDoNotMatch =
    formData.password.length > 0 &&
    formData.repeatPassword.length > 0 &&
    formData.password !== formData.repeatPassword;

  const phoneDigits = useMemo(() => extractUSNationalPhoneDigits(formData.phone), [formData.phone]);
  const zipDigits = useMemo(() => formData.zip.replace(/\D/g, ""), [formData.zip]);

  useEffect(() => {
    trackEvent("view_signup", { page: "/signup" });
    trackEvent("signup_started", { page: "/signup" });
    const code = new URLSearchParams(window.location.search).get("promo")?.trim().toUpperCase() || "";
    if (code) {
      sessionStorage.setItem("pendingPromoCode", code);
    }
  }, []);

  const clearFeedback = () => {
    if (error) setError("");
    if (consentError) setConsentError(false);
  };

  const handleChange = (field: keyof FormData, value: string) => {
    setFormData((prev) => ({ ...prev, [field]: value }));
    clearFeedback();
    if (field === "email" || field === "phone") {
      setFieldErrors((prev) => ({ ...prev, [field]: "" }));
    }
  };

  const isValidEmail = (v: string) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v.trim());

  const formatPhone = (value: string) => {
    const digits = extractUSNationalPhoneDigits(value);
    if (digits.length <= 3) return digits;
    if (digits.length <= 6) return `(${digits.slice(0, 3)}) ${digits.slice(3)}`;
    return `(${digits.slice(0, 3)}) ${digits.slice(3, 6)}-${digits.slice(6)}`;
  };

  const validatePropertyStep = () => {
    /*
     * One condition now: is there an address we actually looked up?
     *
     * Typing text is not an address. The old check counted filled boxes, which
     * "123 whatever street" satisfies perfectly.
     */
    if (!address?.verified) { setError("Select your address from the list."); return false; }
    setError("");
    return true;
  };

  const validateNameStep = () => {
    if (!formData.name.trim()) { setError("Please enter your full name"); return false; }
    setError("");
    return true;
  };

  const validateContactStep = () => {
    if (!formData.email.trim()) { setFieldErrors((p) => ({ ...p, email: "Please enter your email" })); return false; }
    if (!isValidEmail(formData.email)) { setFieldErrors((p) => ({ ...p, email: "Please enter a valid email address" })); return false; }
    setError("");
    setFieldErrors({});
    return true;
  };

  const validateSecurityStep = () => {
    /* The number is collected on this step now, so it is checked on this step. */
    if (!formData.phone.trim()) { setFieldErrors((p) => ({ ...p, phone: "Please enter your phone number" })); return false; }
    if (phoneDigits.length !== 10 || !isValidUSNationalPhoneDigits(phoneDigits)) { setFieldErrors((p) => ({ ...p, phone: "Please enter a valid 10-digit US phone number" })); return false; }
    setFieldErrors((p) => ({ ...p, phone: undefined }));
    if (!formData.password) { setError("Please create a password"); return false; }
    if (formData.password.length < 8) { setError("Password must be at least 8 characters"); return false; }
    if (!formData.repeatPassword) { setError("Please repeat your password"); return false; }
    if (formData.password !== formData.repeatPassword) { setError("Passwords do not match"); return false; }
    if (!agreeTerms) {
      setConsentError(true);
      setError("You must agree to the Terms and Privacy Policy to continue.");
      return false;
    }
    /*
     * Service texts are now a condition of registration.
     *
     * Checked here AND on the server: this stops the button, routes/auth.js
     * stops the request, and neither alone is enough - a form validator is
     * trivially bypassed by posting to the endpoint directly.
     *
     * Marketing is deliberately absent from this check and must stay absent.
     */
    if (!smsTransactionalConsent) {
      /*
       * Inline, beneath the box itself, not in the banner at the foot of the
       * form. There is exactly one control that can fix this and it is six
       * pixels above the message.
       */
      setSmsConsentError(true);
      setError("");
      return false;
    }
    setError("");
    setConsentError(false);
    setSmsConsentError(false);
    return true;
  };

  const validateCurrentStep = () => {
    if (step === 1) return validatePropertyStep();
    if (step === 2) return validateNameStep();
    if (step === 3) return validateContactStep();
    return validateSecurityStep();
  };

  const scrollToTop = () => window.scrollTo({ top: 0, behavior: "smooth" });

  const handleNextStep = () => {
    if (!validateCurrentStep()) return;
    if (step < 4) {
      setStep((step + 1) as Step);
      scrollToTop();
    }
  };

  const handleBackStep = () => {
    setError("");
    setConsentError(false);
    setFieldErrors({});
    if (step > 1) {
      setStep((step - 1) as Step);
      scrollToTop();
    }
  };

  const submitHomeSetup = async () => {
    setError("");
    setConsentError(false);

    if (!validatePropertyStep()) { setStep(1); scrollToTop(); return; }
    if (!validateNameStep()) { setStep(2); scrollToTop(); return; }
    if (!validateContactStep()) { setStep(3); scrollToTop(); return; }
    if (!validateSecurityStep()) { setStep(4); return; }

    setLoading(true);
    try {
      const registrationPayload = {
        name: formData.name.trim(),
        email: formData.email.trim(),
        password: formData.password,
        phone: formData.phone.trim(),
        address: formData.address.trim(),
        city: formData.city.trim(),
        state: formData.state,
        zip: zipDigits,
        /*
         * No county. It used to be a required field derived in the browser from
         * the ZIP prefix, which is the range matching utils/serviceArea.js
         * refuses to do because Long Island ZIPs interleave with Queens. The
         * server derives it from the allowlist now.
         *
         * placeId and the coordinates are sent when the address came from a
         * lookup and omitted when it was typed by hand, which is how the server
         * tells the two apart. The coordinates are checked against the ZIP's
         * own polygon before anything is stored.
         */
        placeId: address?.placeId || "",
        lat: address?.lat ?? null,
        lng: address?.lng ?? null,
        termsAccepted: true,
        consentSource: "website_signup",
        consentAt: new Date().toISOString(),
        /*
         * The two ticks, sent exactly as the customer left them.
         *
         * Never coerced to true, and never derived from the presence of a phone
         * number or from Terms acceptance. The server records consent only when
         * one of these is literally true, and writes nothing at all when it is
         * not, so that "never asked" stays distinguishable from "said no".
         */
        smsTransactionalConsent,
        smsMarketingConsent,
      };

      const { token } = await register(registrationPayload);
      const verifiedUser = await authLogin(token);
      if (!verifiedUser) {
        throw new Error("We could not verify your new account. Please try again.");
      }
      trackEvent("signup_completed", { source: "website_signup" });
      const checkoutPromo =
        new URLSearchParams(window.location.search).get("promo")?.trim().toUpperCase() ||
        sessionStorage.getItem("pendingPromoCode") ||
        "";
      if (checkoutPromo) {
        sessionStorage.setItem("pendingPromoCode", checkoutPromo);
      }
      // Where they were heading before they were asked to create an account,
      // if anywhere. Same-site paths only; see safeReturnPath.
      const returnPath = safeReturnPath(
        new URLSearchParams(window.location.search).get("next")
      );
      const landingPath = getRoleLandingPath(verifiedUser);
      router.replace(
        returnPath || (landingPath === "/account" ? "/membership" : landingPath)
      );
    } catch (err: unknown) {
      const errorResponse = err as { response?: { data?: { message?: string } }; message?: string };
      const message = errorResponse?.response?.data?.message || errorResponse.message || "We couldn't finish setting up your home. Please try again.";
      setError(message);
      setLoading(false);
    }
  };

  const handleSubmit = (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (step < 4) {
      handleNextStep();
      return;
    }
    void submitHomeSetup();
  };

  return (
    <RoleEntryGate loadingLabel="Checking your session..." redirectLabel="Opening Your Home...">
    <div className="relative flex min-h-screen flex-col overflow-hidden bg-[#050B18] px-3.5 py-3.5 text-white sm:px-6 sm:py-6">
      <Image
        src="/images/hero-bg.webp"
        alt="Long Island home cared for by Profixter"
        fill
        priority
        sizes="100vw"
        className="pointer-events-none object-cover opacity-28"
      />
      <div className="absolute inset-0 bg-[linear-gradient(135deg,rgba(5,11,24,0.94)_0%,rgba(8,18,40,0.88)_48%,rgba(5,11,24,0.72)_100%)]" />
      <div className="absolute inset-x-0 bottom-0 h-40 bg-gradient-to-t from-[#050B18] to-transparent" />

      <div className="relative z-10 mx-auto flex w-full max-w-[1120px] flex-1 flex-col">
        <div className="flex items-center justify-end gap-3 py-1 lg:justify-between">
          <Link href="/" className="hidden items-center lg:inline-flex">
            <Image
              src="/images/logo.svg"
              alt="ProFixter"
              width={132}
              height={44}
              className="h-9 w-auto sm:h-11"
            />
          </Link>
          <Link
            href="/"
            className="inline-flex min-h-[40px] items-center rounded-[8px] border border-white/[0.13] bg-white/[0.08] px-4 text-[13px] font-bold text-white/72 transition hover:bg-white/[0.12] hover:text-white"
          >
            Back to Home
          </Link>
        </div>

        <main className="grid flex-1 items-center gap-6 py-5 lg:grid-cols-[0.82fr_1fr] lg:gap-10 lg:py-7">
          <section className="hidden max-w-[440px] lg:block">
            <div className="inline-flex items-center gap-2 rounded-[6px] border border-white/12 bg-white/[0.08] px-4 py-2 text-[11px] font-black uppercase tracking-[0.18em] text-white/58">
              <span className="h-1.5 w-1.5 rounded-full bg-[#86EFAC]" />
              Long Island home care
            </div>
            <h1 className="mt-6 text-[43px] font-black leading-[0.92] tracking-[-0.048em] text-white">
              Book your first visit free.
            </h1>
            <p className="mt-5 text-[17px] font-medium leading-8 text-white/62">
              Let&rsquo;s set up your home. Once it&rsquo;s added you can book your first
              90-minute handyman visit &mdash; no card required.
            </p>
            <div className="mt-8 grid gap-3">
              {["Licensed HI-71484", "Fully insured", "Nassau and Suffolk Counties"].map((item) => (
                <div key={item} className="flex items-center gap-3 text-[14px] font-bold text-white/68">
                  <span className="flex h-6 w-6 items-center justify-center rounded-full bg-[#86EFAC]/16 text-[#86EFAC]">
                    <svg width="11" height="9" viewBox="0 0 11 9" fill="none" aria-hidden="true">
                      <path d="M1 4.5L4 7.5L10 1.5" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                    </svg>
                  </span>
                  {item}
                </div>
              ))}
            </div>
          </section>

          <section className="mx-auto w-full max-w-[570px]">
            <div className="rounded-[8px] border border-white/[0.10] bg-white/[0.075] p-3 shadow-[0_20px_60px_rgba(0,0,0,0.20)] backdrop-blur-2xl sm:p-5 lg:p-6">
              <div className="rounded-[8px] border border-white/[0.09] bg-[#071225]/72 p-3.5 sm:p-5">
                {step > 1 ? (
                  <button
                    type="button"
                    onClick={handleBackStep}
                    className="mb-3.5 inline-flex min-h-9 items-center gap-1.5 rounded-[8px] border border-white/[0.10] bg-white/[0.05] px-3 py-1.5 text-[12px] font-bold text-white/58 transition hover:bg-white/[0.09] hover:text-white"
                  >
                    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
                      <path d="M15 18l-6-6 6-6" strokeLinecap="round" strokeLinejoin="round" />
                    </svg>
                    Back
                  </button>
                ) : null}

                {/*
                  Keeps the reason for the form visible at every step, and on
                  mobile where the left value panel is hidden.

                  Suppressed entirely once the address turns out to be outside
                  the service area. The free first visit is gated by the ZIP
                  allowlist, so for that customer this badge is not marketing,
                  it is a promise we have already decided not to keep - and it
                  was sitting directly above the line telling them so.

                  Only a confirmed "outside" hides it. "unknown" keeps it: a
                  failed service-area lookup must not quietly withdraw a real
                  offer from somebody two towns from the office.
                */}
                {serviceArea !== "outside" ? (
                <div className="mb-4 flex items-center gap-2.5 rounded-[8px] border border-[#86EFAC]/25 bg-[#86EFAC]/[0.07] px-3 py-2.5">
                  <span className="flex h-5 w-5 flex-shrink-0 items-center justify-center rounded-full bg-[#86EFAC]/18 text-[#86EFAC]">
                    <svg width="11" height="9" viewBox="0 0 11 9" fill="none" aria-hidden="true">
                      <path d="M1 4.5L4 7.5L10 1.5" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                    </svg>
                  </span>
                  <span className="text-[12px] font-bold leading-4 text-white/78 sm:text-[13px]">
                    Your first 90-minute visit is free &middot; No card required
                  </span>
                </div>
                ) : null}

                <div className="mb-4 sm:mb-5">
                  <h2 className="text-[23px] font-black leading-none tracking-[-0.03em] text-white sm:text-[30px]">
                    {stepCopy[step].title}
                  </h2>
                  {stepCopy[step].subtitle ? (
                    <p className="mt-2 max-w-[430px] text-[13px] font-medium leading-5 text-white/58 sm:text-[14px]">
                      {stepCopy[step].subtitle}
                    </p>
                  ) : null}
                </div>

                <form onSubmit={handleSubmit} className="space-y-3">
                  {step === 1 ? (
                    <AddressField
                      value={address}
                      onServiceArea={setServiceArea}
                      onChange={(next) => {
                        setAddress(next);
                        clearFeedback();
                        /*
                          formData stays the source of truth for the submit
                          payload, so the structured parts are mirrored into it
                          as they arrive. The unit rides inside the street line
                          because that is how the backend keys a property - see
                          findDuplicateAddress, where "Apt 1" and "Apt 2" are
                          deliberately two different homes.
                        */
                        setFormData((prev) => ({
                          ...prev,
                          address: next ? [next.line1, next.unit.trim()].filter(Boolean).join(" ") : "",
                          city: next?.city || "",
                          state: next?.state || "NY",
                          zip: next?.zip || "",
                        }));
                      }}
                    />
                  ) : null}

                  {step === 2 ? (
                    <div>
                      <FieldLabel htmlFor="name">Full Name</FieldLabel>
                      <FieldInput
                        id="name"
                        value={formData.name}
                        onChange={(e) => handleChange("name", e.target.value)}
                        placeholder="John Smith"
                        autoComplete="name"
                      />
                    </div>
                  ) : null}

                  {step === 3 ? (
                    <div>
                      <FieldLabel htmlFor="email">Email Address</FieldLabel>
                      <FieldInput
                        id="email"
                        type="email"
                        value={formData.email}
                        onChange={(e) => handleChange("email", e.target.value)}
                        placeholder="you@example.com"
                        autoComplete="email"
                      />
                      {fieldErrors.email ? (
                        <p className="mt-2 text-[12px] font-semibold text-red-300">{fieldErrors.email}</p>
                      ) : null}
                    </div>
                  ) : null}

                  {step === 4 ? (
                    <>
                      <div>
                        <FieldLabel htmlFor="password">Password</FieldLabel>
                        <PasswordToggle
                          id="password"
                          value={formData.password}
                          onChange={(e) => handleChange("password", e.target.value)}
                          placeholder="Minimum 8 characters"
                        />
                      </div>
                      <div>
                        <FieldLabel htmlFor="confirm-password">Confirm Password</FieldLabel>
                        <PasswordToggle
                          id="confirm-password"
                          value={formData.repeatPassword}
                          onChange={(e) => handleChange("repeatPassword", e.target.value)}
                          placeholder="Repeat password"
                          autoComplete="new-password"
                        />
                        {passwordsDoNotMatch ? (
                          <p className="mt-2 text-[12px] font-semibold text-red-300">Passwords do not match</p>
                        ) : null}
                      </div>

                      {/*
                        * THE NUMBER AND THE TWO CHOICES, ON THE LAST STEP ONLY.
                        *
                        * This used to be a bordered panel that rendered on every
                        * step, carrying a legend, two sub-headings, the phone field,
                        * an explanation of the phone field, a six-line disclosure
                        * paragraph and three document links. Somebody arriving to
                        * type their address met a compliance form before they had
                        * entered anything, which is a poor way to start and a worse
                        * way to ask permission.
                        *
                        * It is now the number and two rows, shown once, at the point
                        * the account is actually created - which is also where a
                        * consent decision belongs.
                        *
                        * WHY THE PHONE INPUT CAME WITH IT. Twilio's campaign check
                        * rejected an earlier version for having "no phone number
                        * field connected to SMS consent". Moving the boxes into this
                        * step means they no longer exist at first paint, which gives
                        * up half that fix; keeping the number beside them inside one
                        * <fieldset> keeps the other half, on the one screen where
                        * consent is actually collected. The fieldset is borderless
                        * and its legend is screen-reader-only, so the grouping is
                        * real to a parser and invisible as a panel.
                        *
                        * Its validation moved with it, from validateContactStep to
                        * validateSecurityStep - a field cannot be validated on a step
                        * that does not show it.
                        */}
                      <fieldset className="m-0 space-y-2.5 border-0 p-0">
                        <legend className="sr-only">
                          Mobile number and text message preferences
                        </legend>

                        <div>
                          <FieldLabel htmlFor="phone">Mobile Phone Number</FieldLabel>
                          <FieldInput
                            id="phone"
                            type="tel"
                            value={formData.phone}
                            onChange={(e) => handleChange("phone", formatPhone(e.target.value))}
                            placeholder="(631) 000-0000"
                            autoComplete="tel"
                          />
                          {fieldErrors.phone ? (
                            <p className="mt-2 text-[12px] font-semibold text-red-300">{fieldErrors.phone}</p>
                          ) : null}
                        </div>

                        <ConsentRow
                          id="sms-service-consent"
                          checked={smsTransactionalConsent}
                          onChange={(next) => {
                            setSmsTransactionalConsent(next);
                            if (smsConsentError) setSmsConsentError(false);
                          }}
                          label="Service text messages"
                          href="/communication-consent#service-texts"
                          requirement="Required"
                        />
                        {/*
                          * Directly beneath the box that caused it, not at the foot
                          * of the group - where it sat under "Offers & promotions"
                          * and read as though declining offers had blocked the
                          * account. Raised by an attempt to finish, never by typing,
                          * and never by the marketing box, which has no failing
                          * state to report.
                          */}
                        {smsConsentError ? (
                          <p className="text-[12px] font-semibold text-red-300">
                            Service texts are required to create your account.
                          </p>
                        ) : null}

                        <ConsentRow
                          id="sms-marketing-consent"
                          checked={smsMarketingConsent}
                          onChange={setSmsMarketingConsent}
                          label="Offers & promotions"
                          href="/communication-consent#marketing"
                          requirement="Optional"
                        />
                      </fieldset>

                      {/*
                        * The one required box, and the only one.
                        *
                        * It covers the Terms and the Privacy Policy and nothing else.
                        * No SMS consent of any kind is bundled into it: the two text
                        * message choices above are their own controls, and the
                        * fieldset boundary keeps them out of this one.
                        */}
                      <ConsentCheckbox
                        id="agree-terms"
                        checked={agreeTerms}
                        onChange={(next) => {
                          setAgreeTerms(next);
                          if (consentError) setConsentError(false);
                        }}
                        label="I agree to the Terms of Service and Privacy Policy."
                      >
                        Required to create an account.{" "}
                        <Link href="/terms" className="text-white/72 underline decoration-white/25 underline-offset-4 transition hover:text-white">
                          Terms of Service
                        </Link>
                        {" · "}
                        <Link href="/privacy" className="text-white/72 underline decoration-white/25 underline-offset-4 transition hover:text-white">
                          Privacy Policy
                        </Link>
                      </ConsentCheckbox>
                    </>
                  ) : null}


                  {error ? (
                    <div className="rounded-[6px] border border-red-400/25 bg-red-500/[0.10] px-3.5 py-2.5 text-center text-[12px] font-semibold text-red-200">
                      {error}
                    </div>
                  ) : null}

                  <button
                    type="submit"
                    disabled={loading}
                    className="mt-0.5 flex h-12 w-full items-center justify-center rounded-[8px] bg-[#306EEC] text-[14px] font-black text-white shadow-[0_10px_28px_rgba(48,110,236,0.28)] transition hover:bg-[#2558c9] disabled:cursor-not-allowed disabled:opacity-55"
                  >
                    {step === 4 ? (loading ? "Finishing..." : "Finish") : "Continue"}
                  </button>
                </form>

                

                <p className="mt-4 text-center text-[13px] text-white/48">
                  Already have an account?{" "}
                  <Link href="/signin" className="font-bold text-white transition hover:text-white/80">
                    Log In
                  </Link>
                </p>
              </div>
            </div>
          </section>
        </main>
      </div>
    </div>
    </RoleEntryGate>
  );
}
