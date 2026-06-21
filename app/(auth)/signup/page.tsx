"use client";

import Link from "next/link";
import Image from "next/image";
import { useEffect, useMemo, useState } from "react";
import { register } from "@/lib/auth-service";
import { trackEvent } from "@/lib/analytics";

type Step = 1 | 2;

function PasswordToggle({
  value,
  onChange,
  placeholder = "â€¢â€¢â€¢â€¢â€¢â€¢â€¢â€¢",
  id,
  autoComplete = "new-password",
}: {
  value: string;
  onChange: (e: React.ChangeEvent<HTMLInputElement>) => void;
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
        className="w-full rounded-[10px] border border-white/[0.12] bg-white/[0.04] px-4 py-3 text-[15px] text-white placeholder-white/30 focus:outline-none focus:border-[#306EEC]/60 focus:bg-white/[0.08] transition-all pr-12"
      />
      <button
        type="button"
        onClick={() => setShow(!show)}
        className="absolute right-3.5 top-1/2 -translate-y-1/2 text-white/35 hover:text-white/65 transition"
        aria-label={show ? "Hide password" : "Show password"}
      >
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
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

export default function SignUpPage() {
  const [step, setStep] = useState<Step>(1);
  const [agreeTerms, setAgreeTerms] = useState(true);
  const [consentError, setConsentError] = useState(false);
  const [fieldErrors, setFieldErrors] = useState<{ email?: string; phone?: string }>({});
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const [formData, setFormData] = useState({
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
  });

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

  const handleChange = (field: keyof typeof formData, value: string) => {
    setFormData((prev) => ({ ...prev, [field]: value }));
    if (error) setError("");
    if (consentError) setConsentError(false);
    if (field === "email" || field === "phone") {
      setFieldErrors((prev) => ({ ...prev, [field]: "" }));
    }
  };

  const handleZipChange = (value: string) => {
    const digits = value.replace(/\D/g, "").slice(0, 5);
    const county = digits.length === 5 ? detectCounty(digits) : formData.county;
    setFormData((prev) => ({ ...prev, zip: digits, county: county || prev.county }));
  };

  const isValidEmail = (v: string) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v.trim());

  const formatPhone = (value: string) => {
    const digits = value.replace(/\D/g, "").slice(0, 10);
    if (digits.length <= 3) return digits;
    if (digits.length <= 6) return `(${digits.slice(0, 3)}) ${digits.slice(3)}`;
    return `(${digits.slice(0, 3)}) ${digits.slice(3, 6)}-${digits.slice(6)}`;
  };

  const validateStep1 = () => {
    if (!formData.name.trim()) { setError("Please enter your full name"); return false; }
    if (!formData.email.trim()) { setFieldErrors((p) => ({ ...p, email: "Please enter your email" })); return false; }
    if (!isValidEmail(formData.email)) { setFieldErrors((p) => ({ ...p, email: "Please enter a valid email address" })); return false; }
    if (!formData.phone.trim()) { setFieldErrors((p) => ({ ...p, phone: "Please enter your phone number" })); return false; }
    if (phoneDigits.length !== 10) { setFieldErrors((p) => ({ ...p, phone: "Please enter a valid 10-digit phone number" })); return false; }
    if (!formData.password) { setError("Please create a password"); return false; }
    if (formData.password.length < 8) { setError("Password must be at least 8 characters"); return false; }
    if (!formData.repeatPassword) { setError("Please repeat your password"); return false; }
    if (formData.password !== formData.repeatPassword) { setError("Passwords do not match"); return false; }
    setError(""); setFieldErrors({});
    return true;
  };

  const validateStep2 = () => {
    if (!formData.address.trim()) { setError("Please enter your full address"); return false; }
    if (!formData.city.trim()) { setError("Please enter your city"); return false; }
    if (!formData.zip.trim()) { setError("Please enter your zip code"); return false; }
    if (zipDigits.length !== 5) { setError("Zip code must be 5 digits"); return false; }
    if (!formData.county.trim()) { setError("Please select your county"); return false; }
    if (!agreeTerms) { setConsentError(true); setError("You must agree to the Terms and Privacy Policy to continue."); return false; }
    setError(""); setConsentError(false);
    return true;
  };

  const handleNextStep = () => {
    if (!validateStep1()) return;
    setStep(2);
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  const handleBackStep = () => {
    setError(""); setConsentError(false);
    setStep(1);
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(""); setConsentError(false);
    if (!validateStep2()) return;
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
      const error = err as { response?: { data?: { message?: string } } };
      const message = error?.response?.data?.message || "Registration failed. Please try again.";
      setError(message);
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-[#0a0e27] via-[#1a1f42] to-[#0f1429] flex flex-col items-center justify-center px-4 py-5 sm:px-6 sm:py-10">
      {/* Container */}
      <div className="w-full max-w-[520px]">
        
        {/* Logo */}
        <div className="mb-5 text-center sm:mb-8">
          <Link href="/" className="inline-block">
            <Image
              src="/images/logo.svg"
              alt="Fixter"
              width={120}
              height={40}
              className="h-8 w-auto sm:h-10"
            />
          </Link>
        </div>

        {/* Card */}
        <div className="rounded-[16px] border border-white/[0.08] bg-white/[0.03] backdrop-blur-xl p-5 sm:p-8">
          
          {/* Step Progress */}
          {step === 2 && (
            <button
              type="button"
              onClick={handleBackStep}
              className="mb-5 flex items-center gap-2 text-[13px] font-medium text-white/50 transition hover:text-white/70 sm:mb-8"
            >
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M15 18l-6-6 6-6" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
              Back
            </button>
          )}

          <Link
            href="/"
            className="mb-5 inline-flex min-h-[40px] items-center rounded-[12px] border border-white/[0.10] bg-white/[0.04] px-3.5 text-[13px] font-semibold text-white/60 transition hover:border-white/[0.18] hover:bg-white/[0.07] hover:text-white sm:mb-6"
          >
            ← Back to Home
          </Link>

          {/* Heading */}
          <div className="mb-5 text-center sm:mb-7">
            <h1 className="mb-1.5 text-[27px] font-black tracking-[-0.02em] text-white sm:text-[36px]">
              {step === 1 ? "Create Your Account" : "Your Service Address"}
            </h1>
            <p className="text-[14px] text-white/50 sm:text-[15px]">
              {step === 1 ? "It takes less than a minute." : "We deliver to one address per account."}
            </p>
          </div>

          {/* Progress bar */}
          <div className="mb-5 h-1 w-full overflow-hidden rounded-full bg-white/[0.08] sm:mb-8">
            <div
              className="h-full rounded-full bg-[#306EEC] transition-all duration-500"
              style={{ width: step === 1 ? "50%" : "100%" }}
            />
          </div>

          {/* â”€â”€ STEP 1 â”€â”€ */}
          {step === 1 && (
            <>
              <form
                onSubmit={(e) => { e.preventDefault(); handleNextStep(); }}
                className="space-y-3 sm:space-y-4"
              >
                {/* Name & Email */}
                <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 sm:gap-4">
                  <div>
                    <label htmlFor="name" className="block text-[12px] font-semibold text-white/60 mb-2">
                      Full Name
                    </label>
                    <input
                      id="name"
                      type="text"
                      value={formData.name}
                      onChange={(e) => handleChange("name", e.target.value)}
                      placeholder="John Smith"
                      autoComplete="name"
                      className="w-full rounded-[10px] border border-white/[0.12] bg-white/[0.04] px-4 py-3 text-[15px] text-white placeholder-white/30 focus:outline-none focus:border-[#306EEC]/60 focus:bg-white/[0.08] transition-all"
                    />
                  </div>
                  <div>
                    <label htmlFor="email" className="block text-[12px] font-semibold text-white/60 mb-2">
                      Email
                    </label>
                    <input
                      id="email"
                      type="email"
                      value={formData.email}
                      onChange={(e) => handleChange("email", e.target.value)}
                      placeholder="you@example.com"
                      autoComplete="email"
                      className="w-full rounded-[10px] border border-white/[0.12] bg-white/[0.04] px-4 py-3 text-[15px] text-white placeholder-white/30 focus:outline-none focus:border-[#306EEC]/60 focus:bg-white/[0.08] transition-all"
                    />
                    {fieldErrors.email && <p className="mt-1.5 text-[11px] text-red-400">{fieldErrors.email}</p>}
                  </div>
                </div>

                {/* Phone */}
                <div>
                  <label htmlFor="phone" className="block text-[12px] font-semibold text-white/60 mb-2">
                    Phone
                  </label>
                  <input
                    id="phone"
                    type="tel"
                    value={formData.phone}
                    onChange={(e) => handleChange("phone", formatPhone(e.target.value))}
                    placeholder="(631) 000-0000"
                    autoComplete="tel"
                    className="w-full rounded-[10px] border border-white/[0.12] bg-white/[0.04] px-4 py-3 text-[15px] text-white placeholder-white/30 focus:outline-none focus:border-[#306EEC]/60 focus:bg-white/[0.08] transition-all"
                  />
                  {fieldErrors.phone && <p className="mt-1.5 text-[11px] text-red-400">{fieldErrors.phone}</p>}
                </div>

                {/* Password & Confirm */}
                <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 sm:gap-4">
                  <div>
                    <label htmlFor="password" className="block text-[12px] font-semibold text-white/60 mb-2">
                      Password
                    </label>
                    <PasswordToggle
                      id="password"
                      value={formData.password}
                      onChange={(e) => handleChange("password", e.target.value)}
                      placeholder="Min 8 characters"
                    />
                  </div>
                  <div>
                    <label htmlFor="confirm-password" className="block text-[12px] font-semibold text-white/60 mb-2">
                      Confirm Password
                    </label>
                    <PasswordToggle
                      id="confirm-password"
                      value={formData.repeatPassword}
                      onChange={(e) => handleChange("repeatPassword", e.target.value)}
                      placeholder="Repeat password"
                      autoComplete="new-password"
                    />
                    {passwordsDoNotMatch && (
                      <p className="mt-1.5 text-[11px] text-red-400">Passwords do not match</p>
                    )}
                  </div>
                </div>

                {/* Error */}
                {error && (
                  <div className="rounded-[10px] border border-red-500/20 bg-red-500/[0.08] px-4 py-3 text-[13px] text-red-400 text-center">
                    {error}
                  </div>
                )}

                {/* Submit */}
                <button
                  type="submit"
                  className="mt-2 h-12 w-full rounded-[12px] bg-[#306EEC] text-[15px] font-bold text-white transition-all hover:bg-[#2558c9] disabled:cursor-not-allowed disabled:opacity-50"
                  style={{ boxShadow: "0 12px 32px rgba(48,110,236,0.28)" }}
                >
                  Continue
                </button>
              </form>
            </>
          )}

          {/* â”€â”€ STEP 2 â”€â”€ */}
          {step === 2 && (
            <form onSubmit={handleSubmit} className="space-y-3 sm:space-y-4">

              {/* Address */}
              <div>
                <label htmlFor="address" className="block text-[12px] font-semibold text-white/60 mb-2">
                  Street Address
                </label>
                <input
                  id="address"
                  type="text"
                  value={formData.address}
                  onChange={(e) => handleChange("address", e.target.value)}
                  placeholder="123 Main St"
                  autoComplete="street-address"
                  className="w-full rounded-[10px] border border-white/[0.12] bg-white/[0.04] px-4 py-3 text-[15px] text-white placeholder-white/30 focus:outline-none focus:border-[#306EEC]/60 focus:bg-white/[0.08] transition-all"
                />
              </div>

              {/* City & Zip */}
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 sm:gap-4">
                <div>
                  <label htmlFor="city" className="block text-[12px] font-semibold text-white/60 mb-2">
                    City
                  </label>
                  <input
                    id="city"
                    type="text"
                    value={formData.city}
                    onChange={(e) => handleChange("city", e.target.value)}
                    placeholder="Hicksville"
                    autoComplete="address-level2"
                    className="w-full rounded-[10px] border border-white/[0.12] bg-white/[0.04] px-4 py-3 text-[15px] text-white placeholder-white/30 focus:outline-none focus:border-[#306EEC]/60 focus:bg-white/[0.08] transition-all"
                  />
                </div>
                <div>
                  <label htmlFor="zip" className="block text-[12px] font-semibold text-white/60 mb-2">
                    Zip Code
                  </label>
                  <input
                    id="zip"
                    type="text"
                    value={formData.zip}
                    onChange={(e) => handleZipChange(e.target.value)}
                    placeholder="11801"
                    autoComplete="postal-code"
                    maxLength={5}
                    className="w-full rounded-[10px] border border-white/[0.12] bg-white/[0.04] px-4 py-3 text-[15px] text-white placeholder-white/30 focus:outline-none focus:border-[#306EEC]/60 focus:bg-white/[0.08] transition-all"
                  />
                </div>
              </div>

              {/* County & State */}
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 sm:gap-4">
                <div>
                  <label htmlFor="county" className="block text-[12px] font-semibold text-white/60 mb-2">
                    County
                  </label>
                  <select
                    id="county"
                    value={formData.county}
                    onChange={(e) => handleChange("county", e.target.value)}
                    autoComplete="address-level3"
                    className="auth-dark-select h-[50px] w-full rounded-[10px] border border-white/[0.12] bg-white/[0.04] px-4 text-[15px] text-white focus:border-[#306EEC]/60 focus:bg-white/[0.08] focus:outline-none transition-all"
                  >
                    <option value="">Select County</option>
                    <option value="Nassau">Nassau</option>
                    <option value="Suffolk">Suffolk</option>
                  </select>
                  {formData.zip.length === 5 && formData.county && (
                    <p className="mt-1.5 text-[11px] text-[#86EFAC]/70">
                      Auto-detected âœ“
                    </p>
                  )}
                </div>
                <div>
                  <label htmlFor="state" className="block text-[12px] font-semibold text-white/60 mb-2">
                    State
                  </label>
                  <input
                    id="state"
                    type="text"
                    value={formData.state}
                    onChange={(e) => handleChange("state", e.target.value)}
                    placeholder="NY"
                    autoComplete="address-level1"
                    className="w-full rounded-[10px] border border-white/[0.12] bg-white/[0.04] px-4 py-3 text-[15px] text-white placeholder-white/30 focus:outline-none focus:border-[#306EEC]/60 focus:bg-white/[0.08] transition-all"
                  />
                </div>
              </div>

              {/* Terms */}
              <label className="flex cursor-pointer items-start gap-3 pt-1">
                <div className="relative flex-shrink-0 mt-0.5">
                  <input
                    type="checkbox"
                    checked={agreeTerms}
                    onChange={(e) => { setAgreeTerms(e.target.checked); if (consentError) setConsentError(false); }}
                    className="sr-only peer"
                  />
                  <div className="w-4 h-4 rounded-[4px] border border-white/25 flex items-center justify-center peer-checked:bg-[#306EEC] peer-checked:border-[#306EEC] transition flex-shrink-0">
                    {agreeTerms && (
                      <svg width="9" height="7" viewBox="0 0 9 7" fill="none" aria-hidden="true">
                        <path d="M1 3.5l2 2L8 1" stroke="white" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
                      </svg>
                    )}
                  </div>
                </div>
                <span className="text-[13px] text-white/50 leading-relaxed">
                  I agree to the{" "}
                  <Link href="/terms" className="text-white/75 underline hover:text-white transition">
                    Terms of Service
                  </Link>
                  {" "}and{" "}
                  <Link href="/privacy" className="text-white/75 underline hover:text-white transition">
                    Privacy Policy
                  </Link>.
                </span>
              </label>

              {/* Error */}
              {error && (
                <div className="rounded-[10px] border border-red-500/20 bg-red-500/[0.08] px-4 py-3 text-[13px] text-red-400 text-center">
                  {error}
                </div>
              )}

              {/* Submit */}
              <button
                type="submit"
                disabled={loading}
                className="mt-2 h-12 w-full rounded-[12px] bg-[#306EEC] text-[15px] font-bold text-white transition-all hover:bg-[#2558c9] disabled:cursor-not-allowed disabled:opacity-50"
                style={{ boxShadow: "0 12px 32px rgba(48,110,236,0.28)" }}
              >
                {loading ? "Creating Account..." : "Create Account"}
              </button>
            </form>
          )}

          {/* Sign in link */}
          <p className="mt-5 text-center text-[14px] text-white/50">
            Already have an account?{" "}
            <Link
              href="/signin"
              className="font-semibold text-white hover:text-white/80 transition"
            >
              Sign In
            </Link>
          </p>
        </div>

        {/* Trust Strip */}
        <div className="mt-7 grid grid-cols-3 gap-3 text-center sm:mt-12 sm:gap-4">
          <div className="flex flex-col items-center gap-2">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" className="text-white/40">
              <path d="M9 16.17L4.83 12l-1.42 1.41L9 19 21 7l-1.41-1.41L9 16.17z" fill="currentColor" />
            </svg>
            <p className="text-[12px] font-medium text-white/50">Licensed HI-71484</p>
          </div>
          <div className="flex flex-col items-center gap-2">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" className="text-white/40">
              <path d="M9 16.17L4.83 12l-1.42 1.41L9 19 21 7l-1.41-1.41L9 16.17z" fill="currentColor" />
            </svg>
            <p className="text-[12px] font-medium text-white/50">Fully Insured</p>
          </div>
          <div className="flex flex-col items-center gap-2">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" className="text-white/40">
              <path d="M9 16.17L4.83 12l-1.42 1.41L9 19 21 7l-1.41-1.41L9 16.17z" fill="currentColor" />
            </svg>
            <p className="text-[12px] font-medium text-white/50">Long Island Local</p>
          </div>
        </div>
      </div>
    </div>
  );
}
