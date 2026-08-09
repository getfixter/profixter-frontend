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
import { getRoleLandingPath } from "@/lib/auth-routing";
import { useAuth } from "@/lib/useAuth";
import { extractUSNationalPhoneDigits, isValidUSNationalPhoneDigits } from "@/lib/phone";
import { trackEvent } from "@/lib/analytics";
import RoleEntryGate from "@/app/components/auth/RoleEntryGate";

type Step = 1 | 2 | 3 | 4;

const stepCopy: Record<Step, { title: string; subtitle: string }> = {
  1: {
    title: "Where should we come?",
    subtitle: "What is the address of the property you'd like us to help with?",
  },
  2: {
    title: "How should we call you?",
    subtitle: "Tell us whose home we are helping.",
  },
  3: {
    title: "How should we reach you?",
    subtitle: "We'll only use this to contact you about your appointments and service.",
  },
  4: {
    title: "Almost done",
    subtitle: "Create a secure password for your account.",
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
        className="h-12 w-full rounded-[11px] border border-white/[0.14] bg-white/[0.07] px-3.5 pr-11 text-[14px] text-white placeholder-white/32 outline-none transition-all focus:border-[#7BAEFF]/80 focus:bg-white/[0.10] focus:ring-4 focus:ring-[#306EEC]/20"
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

function detectCounty(zip: string): string {
  const prefix = zip.substring(0, 3);
  if (prefix === "115") return "Nassau";
  if (["117", "118", "119"].includes(prefix)) return "Suffolk";
  return "";
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
      className="h-12 w-full rounded-[11px] border border-white/[0.14] bg-white/[0.07] px-3.5 text-[14px] text-white placeholder-white/32 outline-none transition-all focus:border-[#7BAEFF]/80 focus:bg-white/[0.10] focus:ring-4 focus:ring-[#306EEC]/20"
    />
  );
}

export default function SignUpPage() {
  const router = useRouter();
  const { login: authLogin } = useAuth();
  const [step, setStep] = useState<Step>(1);
  const [agreeTerms, setAgreeTerms] = useState(true);
  const [consentError, setConsentError] = useState(false);
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

  const handleZipChange = (value: string) => {
    const digits = value.replace(/\D/g, "").slice(0, 5);
    const county = digits.length === 5 ? detectCounty(digits) : formData.county;
    setFormData((prev) => ({ ...prev, zip: digits, county: county || prev.county }));
    clearFeedback();
  };

  const isValidEmail = (v: string) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v.trim());

  const formatPhone = (value: string) => {
    const digits = extractUSNationalPhoneDigits(value);
    if (digits.length <= 3) return digits;
    if (digits.length <= 6) return `(${digits.slice(0, 3)}) ${digits.slice(3)}`;
    return `(${digits.slice(0, 3)}) ${digits.slice(3, 6)}-${digits.slice(6)}`;
  };

  const validatePropertyStep = () => {
    if (!formData.address.trim()) { setError("Please enter your full address"); return false; }
    if (!formData.city.trim()) { setError("Please enter your city"); return false; }
    if (!formData.zip.trim()) { setError("Please enter your zip code"); return false; }
    if (zipDigits.length !== 5) { setError("Zip code must be 5 digits"); return false; }
    if (!formData.county.trim()) { setError("Please select your county"); return false; }
    setError("");
    return true;
  };

  const validateNameStep = () => {
    if (!formData.name.trim()) { setError("Please enter your full name"); return false; }
    setError("");
    return true;
  };

  const validateContactStep = () => {
    if (!formData.phone.trim()) { setFieldErrors((p) => ({ ...p, phone: "Please enter your phone number" })); return false; }
    if (phoneDigits.length !== 10 || !isValidUSNationalPhoneDigits(phoneDigits)) { setFieldErrors((p) => ({ ...p, phone: "Please enter a valid 10-digit US phone number" })); return false; }
    if (!formData.email.trim()) { setFieldErrors((p) => ({ ...p, email: "Please enter your email" })); return false; }
    if (!isValidEmail(formData.email)) { setFieldErrors((p) => ({ ...p, email: "Please enter a valid email address" })); return false; }
    setError("");
    setFieldErrors({});
    return true;
  };

  const validateSecurityStep = () => {
    if (!formData.password) { setError("Please create a password"); return false; }
    if (formData.password.length < 8) { setError("Password must be at least 8 characters"); return false; }
    if (!formData.repeatPassword) { setError("Please repeat your password"); return false; }
    if (formData.password !== formData.repeatPassword) { setError("Passwords do not match"); return false; }
    if (!agreeTerms) {
      setConsentError(true);
      setError("You must agree to the Terms and Privacy Policy to continue.");
      return false;
    }
    setError("");
    setConsentError(false);
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
        county: formData.county,
        termsAccepted: true,
        consentSource: "website_signup",
        consentAt: new Date().toISOString(),
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
      const landingPath = getRoleLandingPath(verifiedUser);
      router.replace(landingPath === "/account" ? "/membership" : landingPath);
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
              alt="Profixter"
              width={132}
              height={44}
              className="h-9 w-auto sm:h-11"
            />
          </Link>
          <Link
            href="/"
            className="inline-flex min-h-[40px] items-center rounded-full border border-white/[0.13] bg-white/[0.08] px-4 text-[13px] font-bold text-white/72 transition hover:bg-white/[0.12] hover:text-white"
          >
            Back to Home
          </Link>
        </div>

        <main className="grid flex-1 items-center gap-6 py-5 lg:grid-cols-[0.82fr_1fr] lg:gap-10 lg:py-7">
          <section className="hidden max-w-[440px] lg:block">
            <div className="inline-flex items-center gap-2 rounded-full border border-white/12 bg-white/[0.08] px-4 py-2 text-[11px] font-black uppercase tracking-[0.18em] text-white/58">
              <span className="h-1.5 w-1.5 rounded-full bg-[#86EFAC]" />
              Long Island home care
            </div>
            <h1 className="mt-6 text-[58px] font-black leading-[0.92] tracking-[-0.048em] text-white">
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
            <div className="rounded-[22px] border border-white/[0.10] bg-white/[0.075] p-3 shadow-[0_20px_60px_rgba(0,0,0,0.20)] backdrop-blur-2xl sm:p-5 lg:p-6">
              <div className="rounded-[17px] border border-white/[0.09] bg-[#071225]/72 p-3.5 sm:p-5">
                {step > 1 ? (
                  <button
                    type="button"
                    onClick={handleBackStep}
                    className="mb-3.5 inline-flex min-h-9 items-center gap-1.5 rounded-full border border-white/[0.10] bg-white/[0.05] px-3 py-1.5 text-[12px] font-bold text-white/58 transition hover:bg-white/[0.09] hover:text-white"
                  >
                    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
                      <path d="M15 18l-6-6 6-6" strokeLinecap="round" strokeLinejoin="round" />
                    </svg>
                    Back
                  </button>
                ) : null}

                {/* Keeps the reason for the form visible at every step, and on
                    mobile where the left value panel is hidden. */}
                <div className="mb-4 flex items-center gap-2.5 rounded-[12px] border border-[#86EFAC]/25 bg-[#86EFAC]/[0.07] px-3 py-2.5">
                  <span className="flex h-5 w-5 flex-shrink-0 items-center justify-center rounded-full bg-[#86EFAC]/18 text-[#86EFAC]">
                    <svg width="11" height="9" viewBox="0 0 11 9" fill="none" aria-hidden="true">
                      <path d="M1 4.5L4 7.5L10 1.5" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                    </svg>
                  </span>
                  <span className="text-[12px] font-bold leading-4 text-white/78 sm:text-[13px]">
                    Your first 90-minute visit is free &middot; No card required
                  </span>
                </div>

                <div className="mb-4 sm:mb-5">
                  <h2 className="text-[27px] font-black leading-none tracking-[-0.03em] text-white sm:text-[34px]">
                    {stepCopy[step].title}
                  </h2>
                  <p className="mt-2 max-w-[430px] text-[13px] font-medium leading-5 text-white/58 sm:text-[14px]">
                    {stepCopy[step].subtitle}
                  </p>
                </div>

                <form onSubmit={handleSubmit} className="space-y-3">
                  {step === 1 ? (
                    <>
                      <div>
                        <FieldLabel htmlFor="address">Property Address</FieldLabel>
                        <FieldInput
                          id="address"
                          value={formData.address}
                          onChange={(e) => handleChange("address", e.target.value)}
                          placeholder="123 Main St"
                          autoComplete="street-address"
                        />
                      </div>

                      <div className="grid gap-3 sm:grid-cols-2">
                        <div>
                          <FieldLabel htmlFor="city">City</FieldLabel>
                          <FieldInput
                            id="city"
                            value={formData.city}
                            onChange={(e) => handleChange("city", e.target.value)}
                            placeholder="Babylon"
                            autoComplete="address-level2"
                          />
                        </div>
                        <div>
                          <FieldLabel htmlFor="zip">Zip Code</FieldLabel>
                          <FieldInput
                            id="zip"
                            value={formData.zip}
                            onChange={(e) => handleZipChange(e.target.value)}
                            placeholder="11702"
                            autoComplete="postal-code"
                            maxLength={5}
                          />
                        </div>
                      </div>

                      <div className="grid gap-3 sm:grid-cols-2">
                        <div>
                          <FieldLabel htmlFor="county">County</FieldLabel>
                          <select
                            id="county"
                            value={formData.county}
                            onChange={(e) => handleChange("county", e.target.value)}
                            autoComplete="address-level3"
                            className="auth-dark-select h-12 w-full rounded-[11px] border border-white/[0.14] bg-white/[0.07] px-3.5 text-[14px] text-white outline-none transition-all focus:border-[#7BAEFF]/80 focus:bg-white/[0.10] focus:ring-4 focus:ring-[#306EEC]/20"
                          >
                            <option value="">Select County</option>
                            <option value="Nassau">Nassau</option>
                            <option value="Suffolk">Suffolk</option>
                          </select>
                          {formData.zip.length === 5 && formData.county ? (
                            <p className="mt-2 text-[11px] font-semibold text-[#86EFAC]/78">
                              Auto-detected from zip code
                            </p>
                          ) : null}
                        </div>
                        <div>
                          <FieldLabel htmlFor="state">State</FieldLabel>
                          <FieldInput
                            id="state"
                            value={formData.state}
                            onChange={(e) => handleChange("state", e.target.value)}
                            placeholder="NY"
                            autoComplete="address-level1"
                          />
                        </div>
                      </div>
                    </>
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
                    <>
                      <div>
                        <FieldLabel htmlFor="phone">Phone Number</FieldLabel>
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
                    </>
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

                      <label className="flex cursor-pointer items-start gap-2.5 rounded-[12px] border border-white/[0.09] bg-white/[0.04] p-3">
                        <span className="relative mt-0.5 flex flex-shrink-0">
                          <input
                            type="checkbox"
                            checked={agreeTerms}
                            onChange={(e) => {
                              setAgreeTerms(e.target.checked);
                              if (consentError) setConsentError(false);
                            }}
                            className="peer sr-only"
                          />
                          <span className="flex h-4 w-4 flex-shrink-0 items-center justify-center rounded-[4px] border border-white/30 transition peer-checked:border-[#306EEC] peer-checked:bg-[#306EEC]">
                            {agreeTerms ? (
                              <svg width="9" height="7" viewBox="0 0 9 7" fill="none" aria-hidden="true">
                                <path d="M1 3.5l2 2L8 1" stroke="white" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
                              </svg>
                            ) : null}
                          </span>
                        </span>
                        <span className="text-[12px] leading-relaxed text-white/56">
                          I agree to the{" "}
                          <Link href="/terms" className="text-white/82 underline decoration-white/30 underline-offset-4 transition hover:text-white">
                            Terms of Service
                          </Link>
                          {" "}and{" "}
                          <Link href="/privacy" className="text-white/82 underline decoration-white/30 underline-offset-4 transition hover:text-white">
                            Privacy Policy
                          </Link>.
                        </span>
                      </label>
                    </>
                  ) : null}

                  {error ? (
                    <div className="rounded-[11px] border border-red-400/25 bg-red-500/[0.10] px-3.5 py-2.5 text-center text-[12px] font-semibold text-red-200">
                      {error}
                    </div>
                  ) : null}

                  <button
                    type="submit"
                    disabled={loading}
                    className="mt-0.5 flex h-12 w-full items-center justify-center rounded-[12px] bg-[#306EEC] text-[14px] font-black text-white shadow-[0_10px_28px_rgba(48,110,236,0.28)] transition hover:bg-[#2558c9] disabled:cursor-not-allowed disabled:opacity-55"
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
