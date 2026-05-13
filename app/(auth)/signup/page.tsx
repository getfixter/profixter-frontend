"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { register } from "@/lib/auth-service";
import { trackEvent } from "@/lib/analytics";
import { GoogleButton } from "../../components/auth/GoogleButton";
import AuthLeftPanel from "../../components/auth/AuthLeftPanel";

type Step = 1 | 2;

function PasswordToggle({
  value,
  onChange,
  placeholder = "••••••••",
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
        className="w-full rounded-[12px] border border-white/[0.12] bg-white/[0.06] px-4 py-3.5 text-[15px] text-white placeholder-white/25 focus:outline-none focus:border-[#306EEC]/80 focus:bg-white/[0.09] transition-all backdrop-blur-sm pr-12"
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

function InputField({
  label,
  id,
  type = "text",
  value,
  onChange,
  placeholder,
  autoComplete,
  error,
  children,
}: {
  label: string;
  id: string;
  type?: string;
  value: string;
  onChange: (e: React.ChangeEvent<HTMLInputElement>) => void;
  placeholder: string;
  autoComplete?: string;
  error?: string;
  children?: React.ReactNode;
}) {
  return (
    <div>
      <label htmlFor={id} className="block text-[11px] font-bold uppercase tracking-[0.14em] text-white/38 mb-2">
        {label}
      </label>
      <input
        id={id}
        type={type}
        value={value}
        onChange={onChange}
        placeholder={placeholder}
        autoComplete={autoComplete}
        className="w-full rounded-[12px] border border-white/[0.12] bg-white/[0.06] px-4 py-3.5 text-[15px] text-white placeholder-white/25 focus:outline-none focus:border-[#306EEC]/80 focus:bg-white/[0.09] transition-all backdrop-blur-sm"
      />
      {error && <p className="mt-1.5 text-[11px] text-red-400">{error}</p>}
      {children}
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
  const [agreeTerms, setAgreeTerms] = useState(false);
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
      const { token, user } = await register({
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
      } as any);
      localStorage.setItem("token", token);
      localStorage.setItem("user", JSON.stringify(user));
      window.location.href = "/";
    } catch (err: any) {
      const message = err?.response?.data?.message || "Registration failed. Please try again.";
      setError(message);
      setLoading(false);
    }
  };

  return (
    <div className="relative z-10 min-h-screen flex flex-col lg:flex-row">

      {/* ── Left value panel (desktop only) ── */}
      <div className="hidden lg:block flex-1 min-h-screen">
        <AuthLeftPanel />
      </div>

      {/* ── Right form panel ── */}
      <div className="flex flex-col justify-center min-h-screen w-full lg:w-[520px] xl:w-[560px] px-6 py-24 sm:px-10 lg:px-12 xl:px-14 flex-shrink-0">
        <div className="w-full max-w-[460px] mx-auto lg:mx-0">

          {/* Back to site (mobile only) */}
          <Link
            href="/"
            className="lg:hidden inline-flex items-center gap-1.5 text-[12px] text-white/35 hover:text-white/60 transition mb-10"
          >
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" aria-hidden="true">
              <path d="M19 12H5M12 5l-7 7 7 7" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
            Back to site
          </Link>

          {/* Step progress */}
          <div className="flex items-center justify-between mb-2">
            <div>
              <h1 className="text-[28px] sm:text-[32px] font-black tracking-[-0.03em] text-white">
                {step === 1 ? "Create your account" : "Your service address"}
              </h1>
              <p className="text-[13px] text-white/38 mt-1">
                {step === 1
                  ? "Takes less than 2 minutes. No spam."
                  : "Membership is tied to one service address."}
              </p>
            </div>
            <div className="shrink-0 text-right ml-4">
              <span className="text-[11px] font-bold uppercase tracking-[0.16em] text-white/28">
                Step {step} / 2
              </span>
            </div>
          </div>

          {/* Progress bar */}
          <div className="h-1.5 w-full rounded-full bg-white/[0.08] mb-8 overflow-hidden">
            <div
              className="h-full rounded-full bg-[#306EEC] transition-all duration-500"
              style={{ width: step === 1 ? "50%" : "100%" }}
            />
          </div>

          {/* ── STEP 1 ── */}
          {step === 1 && (
            <>
              {/* Google OAuth */}
              <GoogleButton className="mb-5" spanClassName="text-[15px] font-semibold" />

              {/* Divider */}
              <div className="flex items-center gap-3 mb-6">
                <div className="flex-1 h-px bg-white/[0.09]" />
                <span className="text-[12px] font-medium text-white/28">or sign up with email</span>
                <div className="flex-1 h-px bg-white/[0.09]" />
              </div>

              <form
                onSubmit={(e) => { e.preventDefault(); handleNextStep(); }}
                className="space-y-4"
              >
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <InputField
                    label="Full Name"
                    id="name"
                    value={formData.name}
                    onChange={(e) => handleChange("name", e.target.value)}
                    placeholder="John Smith"
                    autoComplete="name"
                  />
                  <InputField
                    label="Email"
                    id="email"
                    type="email"
                    value={formData.email}
                    onChange={(e) => handleChange("email", e.target.value)}
                    placeholder="your@email.com"
                    autoComplete="email"
                    error={fieldErrors.email}
                  />
                  <InputField
                    label="Phone"
                    id="phone"
                    type="tel"
                    value={formData.phone}
                    onChange={(e) => handleChange("phone", formatPhone(e.target.value))}
                    placeholder="(631) 000-0000"
                    autoComplete="tel"
                    error={fieldErrors.phone}
                  />
                  {/* spacer on sm+ */}
                  <div className="hidden sm:block" />
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label htmlFor="password" className="block text-[11px] font-bold uppercase tracking-[0.14em] text-white/38 mb-2">
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
                    <label htmlFor="repeat-password" className="block text-[11px] font-bold uppercase tracking-[0.14em] text-white/38 mb-2">
                      Repeat Password
                    </label>
                    <PasswordToggle
                      id="repeat-password"
                      value={formData.repeatPassword}
                      onChange={(e) => handleChange("repeatPassword", e.target.value)}
                      placeholder="••••••••"
                      autoComplete="new-password"
                    />
                    {passwordsDoNotMatch && (
                      <p className="mt-1.5 text-[11px] text-red-400">Passwords do not match</p>
                    )}
                  </div>
                </div>

                {error && (
                  <div className="rounded-[10px] border border-red-500/20 bg-red-500/[0.08] px-4 py-3 text-[13px] text-red-400 text-center">
                    {error}
                  </div>
                )}

                <button
                  type="submit"
                  className="w-full h-[52px] rounded-[14px] bg-[#306EEC] text-white text-[15px] font-extrabold hover:bg-[#2558c9] transition-all mt-2"
                  style={{ boxShadow: "0 12px 32px rgba(48,110,236,0.28)" }}
                >
                  Continue →
                </button>
              </form>
            </>
          )}

          {/* ── STEP 2 ── */}
          {step === 2 && (
            <form onSubmit={handleSubmit} className="space-y-4">

              {/* Info banner */}
              <div className="rounded-[12px] border border-[#86EFAC]/15 bg-[#86EFAC]/[0.06] px-4 py-3.5 mb-2">
                <p className="text-[13px] font-semibold text-white/70">
                  <span className="text-[#86EFAC]">Why we need this:</span>{" "}
                  Your membership, bookings, and scheduling are tied to your home address.
                </p>
              </div>

              <InputField
                label="Street Address"
                id="address"
                value={formData.address}
                onChange={(e) => handleChange("address", e.target.value)}
                placeholder="123 Main St"
                autoComplete="street-address"
              />

              <div className="grid grid-cols-2 gap-4">
                <InputField
                  label="City"
                  id="city"
                  value={formData.city}
                  onChange={(e) => handleChange("city", e.target.value)}
                  placeholder="Hicksville"
                  autoComplete="address-level2"
                />
                <div>
                  <label htmlFor="zip" className="block text-[11px] font-bold uppercase tracking-[0.14em] text-white/38 mb-2">
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
                    className="w-full rounded-[12px] border border-white/[0.12] bg-white/[0.06] px-4 py-3.5 text-[15px] text-white placeholder-white/25 focus:outline-none focus:border-[#306EEC]/80 focus:bg-white/[0.09] transition-all backdrop-blur-sm"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label htmlFor="county" className="block text-[11px] font-bold uppercase tracking-[0.14em] text-white/38 mb-2">
                    County
                  </label>
                  <select
                    id="county"
                    value={formData.county}
                    onChange={(e) => handleChange("county", e.target.value)}
                    className="w-full rounded-[12px] border border-white/[0.12] bg-[#0D1A30] px-4 py-3.5 text-[15px] text-white focus:outline-none focus:border-[#306EEC]/80 transition-all"
                  >
                    <option value="">Select County</option>
                    <option value="Nassau">Nassau</option>
                    <option value="Suffolk">Suffolk</option>
                  </select>
                  {formData.zip.length === 5 && formData.county && (
                    <p className="mt-1.5 text-[11px] text-[#86EFAC]/70">
                      Auto-detected from zip ✓
                    </p>
                  )}
                </div>
                <div>
                  <label htmlFor="state" className="block text-[11px] font-bold uppercase tracking-[0.14em] text-white/38 mb-2">
                    State
                  </label>
                  <input
                    id="state"
                    type="text"
                    value={formData.state}
                    onChange={(e) => handleChange("state", e.target.value)}
                    placeholder="NY"
                    autoComplete="address-level1"
                    className="w-full rounded-[12px] border border-white/[0.12] bg-white/[0.06] px-4 py-3.5 text-[15px] text-white placeholder-white/25 focus:outline-none focus:border-[#306EEC]/80 focus:bg-white/[0.09] transition-all backdrop-blur-sm"
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
                  <div className="w-4 h-4 rounded-[4px] border border-white/25 flex items-center justify-center peer-checked:bg-[#306EEC] peer-checked:border-[#306EEC] transition">
                    {agreeTerms && (
                      <svg width="9" height="7" viewBox="0 0 9 7" fill="none" aria-hidden="true">
                        <path d="M1 3.5l2 2L8 1" stroke="white" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
                      </svg>
                    )}
                  </div>
                </div>
                <span className="text-[13px] text-white/50 leading-relaxed">
                  I agree to the{" "}
                  <Link href="/terms" className="text-white/75 underline hover:text-white transition">Terms of Service</Link>{" "}
                  and{" "}
                  <Link href="/privacy" className="text-white/75 underline hover:text-white transition">Privacy Policy</Link>.
                </span>
              </label>

              {(error || consentError) && (
                <div className="rounded-[10px] border border-red-500/20 bg-red-500/[0.08] px-4 py-3 text-[13px] text-red-400 text-center">
                  {error || "Please agree to the Terms and Privacy Policy to continue."}
                </div>
              )}

              {/* Buttons */}
              <div className="flex gap-3 pt-2">
                <button
                  type="button"
                  onClick={handleBackStep}
                  disabled={loading}
                  className="h-[52px] px-6 rounded-[14px] border border-white/[0.12] bg-white/[0.05] text-[14px] font-semibold text-white/60 hover:bg-white/[0.09] hover:text-white/80 transition disabled:opacity-50 flex-shrink-0"
                >
                  ← Back
                </button>
                <button
                  type="submit"
                  disabled={loading}
                  className="flex-1 h-[52px] rounded-[14px] bg-[#306EEC] text-white text-[15px] font-extrabold hover:bg-[#2558c9] transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                  style={{ boxShadow: "0 12px 32px rgba(48,110,236,0.28)" }}
                >
                  {loading ? "Creating account…" : "Create Account"}
                </button>
              </div>
            </form>
          )}

          {/* Sign in link */}
          <p className="mt-7 text-center text-[13px] text-white/32">
            Already have an account?{" "}
            <Link href="/signin" className="font-semibold text-white/60 hover:text-white transition">
              Sign in →
            </Link>
          </p>

        </div>
      </div>
    </div>
  );
}
