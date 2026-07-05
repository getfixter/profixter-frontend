"use client";

import Link from "next/link";
import Image from "next/image";
import {
  useEffect,
  useMemo,
  useState,
  type ChangeEvent,
  type FormEvent,
  type ReactNode,
} from "react";
import { register } from "@/lib/auth-service";
import { trackEvent } from "@/lib/analytics";
import RoleEntryGate from "@/app/components/auth/RoleEntryGate";

type Step = 1 | 2 | 3 | 4;

const onboardingSteps: Array<{ id: Step; label: string }> = [
  { id: 1, label: "Property" },
  { id: 2, label: "You" },
  { id: 3, label: "Contact" },
  { id: 4, label: "Security" },
];

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
    subtitle: "Create a secure password to manage your home, appointments and membership.",
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
        className="w-full rounded-[14px] border border-white/[0.14] bg-white/[0.07] px-4 py-3.5 pr-12 text-[15px] text-white placeholder-white/32 outline-none transition-all focus:border-[#7BAEFF]/80 focus:bg-white/[0.10] focus:ring-4 focus:ring-[#306EEC]/20"
      />
      <button
        type="button"
        onClick={() => setShow(!show)}
        className="absolute right-3.5 top-1/2 -translate-y-1/2 text-white/38 transition hover:text-white/72"
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
    <label htmlFor={htmlFor} className="mb-2 block text-[12px] font-bold uppercase tracking-[0.13em] text-white/58">
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
      className="w-full rounded-[14px] border border-white/[0.14] bg-white/[0.07] px-4 py-3.5 text-[15px] text-white placeholder-white/32 outline-none transition-all focus:border-[#7BAEFF]/80 focus:bg-white/[0.10] focus:ring-4 focus:ring-[#306EEC]/20"
    />
  );
}

export default function SignUpPage() {
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

  const phoneDigits = useMemo(() => formData.phone.replace(/\D/g, ""), [formData.phone]);
  const zipDigits = useMemo(() => formData.zip.replace(/\D/g, ""), [formData.zip]);

  useEffect(() => {
    trackEvent("view_signup", { page: "/signup" });
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
    const digits = value.replace(/\D/g, "").slice(0, 10);
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
    if (phoneDigits.length !== 10) { setFieldErrors((p) => ({ ...p, phone: "Please enter a valid 10-digit phone number" })); return false; }
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

      const { token, user } = await register(registrationPayload);
      localStorage.setItem("token", token);
      localStorage.setItem("user", JSON.stringify(user));
      const checkoutPromo =
        new URLSearchParams(window.location.search).get("promo")?.trim().toUpperCase() ||
        sessionStorage.getItem("pendingPromoCode") ||
        "";
      window.location.href = checkoutPromo
        ? `/?promo=${encodeURIComponent(checkoutPromo)}#plans`
        : "/";
    } catch (err: unknown) {
      const errorResponse = err as { response?: { data?: { message?: string } } };
      const message = errorResponse?.response?.data?.message || "We couldn't finish setting up your home. Please try again.";
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
    <RoleEntryGate loadingLabel="Checking your session..." redirectLabel="Opening your dashboard...">
    <div className="relative flex min-h-screen flex-col overflow-hidden bg-[#050B18] px-4 py-5 text-white sm:px-6 sm:py-8">
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
        <div className="flex items-center justify-between gap-4 py-2">
          <Link href="/" className="inline-flex items-center">
            <Image
              src="/images/logo.svg"
              alt="Profixter"
              width={132}
              height={44}
              className="h-8 w-auto sm:h-10"
            />
          </Link>
          <Link
            href="/"
            className="inline-flex min-h-[40px] items-center rounded-full border border-white/[0.13] bg-white/[0.08] px-4 text-[13px] font-bold text-white/72 transition hover:bg-white/[0.12] hover:text-white"
          >
            Back to Home
          </Link>
        </div>

        <main className="grid flex-1 items-center gap-8 py-8 lg:grid-cols-[0.82fr_1fr] lg:gap-12 lg:py-10">
          <section className="hidden max-w-[440px] lg:block">
            <div className="inline-flex items-center gap-2 rounded-full border border-white/12 bg-white/[0.08] px-4 py-2 text-[11px] font-black uppercase tracking-[0.18em] text-white/58">
              <span className="h-1.5 w-1.5 rounded-full bg-[#86EFAC]" />
              Long Island home care
            </div>
            <h1 className="mt-6 text-[58px] font-black leading-[0.92] tracking-[-0.048em] text-white">
              Let us get your home ready.
            </h1>
            <p className="mt-5 text-[17px] font-medium leading-8 text-white/62">
              Add the property once, then book visits, manage Membership, and keep your home details in one calm place.
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
            <div className="rounded-[28px] border border-white/[0.10] bg-white/[0.075] p-4 shadow-[0_28px_90px_rgba(0,0,0,0.24)] backdrop-blur-2xl sm:p-6 lg:p-7">
              <div className="rounded-[22px] border border-white/[0.09] bg-[#071225]/72 p-4 sm:p-6">
                <nav aria-label="Home setup progress" className="mb-6">
                  <ol className="flex flex-wrap items-center gap-2 text-[11px] font-black uppercase tracking-[0.13em] text-white/35 sm:flex-nowrap sm:gap-2.5">
                    {onboardingSteps.map((item, index) => {
                      const active = item.id === step;
                      const complete = item.id < step;

                      return (
                        <li key={item.id} className="flex items-center gap-2">
                          <span
                            aria-current={active ? "step" : undefined}
                            className={[
                              "rounded-full px-2.5 py-1.5 transition",
                              active
                                ? "bg-white text-[#0B1628]"
                                : complete
                                  ? "bg-[#86EFAC]/16 text-[#86EFAC]"
                                  : "bg-white/[0.06] text-white/40",
                            ].join(" ")}
                          >
                            {item.label}
                          </span>
                          {index < onboardingSteps.length - 1 ? (
                            <span className="text-white/22" aria-hidden="true">
                              -&gt;
                            </span>
                          ) : null}
                        </li>
                      );
                    })}
                  </ol>
                </nav>

                {step > 1 ? (
                  <button
                    type="button"
                    onClick={handleBackStep}
                    className="mb-5 inline-flex items-center gap-2 rounded-full border border-white/[0.10] bg-white/[0.05] px-3.5 py-2 text-[13px] font-bold text-white/58 transition hover:bg-white/[0.09] hover:text-white"
                  >
                    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
                      <path d="M15 18l-6-6 6-6" strokeLinecap="round" strokeLinejoin="round" />
                    </svg>
                    Back
                  </button>
                ) : null}

                <div className="mb-5 sm:mb-6">
                  <h2 className="text-[31px] font-black leading-[0.98] tracking-[-0.035em] text-white sm:text-[40px]">
                    {stepCopy[step].title}
                  </h2>
                  <p className="mt-3 max-w-[430px] text-[14px] font-medium leading-6 text-white/58 sm:text-[15px]">
                    {stepCopy[step].subtitle}
                  </p>
                </div>

                <form onSubmit={handleSubmit} className="space-y-4">
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

                      <div className="grid gap-4 sm:grid-cols-2">
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

                      <div className="grid gap-4 sm:grid-cols-2">
                        <div>
                          <FieldLabel htmlFor="county">County</FieldLabel>
                          <select
                            id="county"
                            value={formData.county}
                            onChange={(e) => handleChange("county", e.target.value)}
                            autoComplete="address-level3"
                            className="auth-dark-select h-[51px] w-full rounded-[14px] border border-white/[0.14] bg-white/[0.07] px-4 text-[15px] text-white outline-none transition-all focus:border-[#7BAEFF]/80 focus:bg-white/[0.10] focus:ring-4 focus:ring-[#306EEC]/20"
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

                      <label className="flex cursor-pointer items-start gap-3 rounded-[16px] border border-white/[0.09] bg-white/[0.04] p-3.5">
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
                        <span className="text-[13px] leading-relaxed text-white/56">
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
                    <div className="rounded-[14px] border border-red-400/25 bg-red-500/[0.10] px-4 py-3 text-center text-[13px] font-semibold text-red-200">
                      {error}
                    </div>
                  ) : null}

                  <button
                    type="submit"
                    disabled={loading}
                    className="mt-1 flex h-[52px] w-full items-center justify-center rounded-[16px] bg-[#306EEC] text-[15px] font-black text-white shadow-[0_16px_42px_rgba(48,110,236,0.34)] transition hover:bg-[#2558c9] disabled:cursor-not-allowed disabled:opacity-55"
                  >
                    {step === 4 ? (loading ? "Finishing..." : "Finish") : "Continue"}
                  </button>
                </form>

                <p className="mt-5 text-center text-[14px] text-white/48">
                  Already with Profixter?{" "}
                  <Link href="/signin" className="font-bold text-white transition hover:text-white/80">
                    My Home
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
