"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { PasswordField } from "../../components/auth/PasswordField";
import { register } from "@/lib/auth-service";
import { trackEvent } from "@/lib/analytics";

type Step = 1 | 2;

export default function SignUpPage() {
  const [activeTab, setActiveTab] = useState<"signin" | "signup">("signup");
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

  const phoneDigits = useMemo(
    () => formData.phone.replace(/\D/g, ""),
    [formData.phone]
  );

  const zipDigits = useMemo(
    () => formData.zip.replace(/\D/g, ""),
    [formData.zip]
  );

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

  const isValidEmail = (value: string) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value.trim());

  const formatPhone = (value: string) => {
    const digits = value.replace(/\D/g, "").slice(0, 10);

    if (digits.length <= 3) return digits;
    if (digits.length <= 6) return `(${digits.slice(0, 3)}) ${digits.slice(3)}`;
    return `(${digits.slice(0, 3)}) ${digits.slice(3, 6)}-${digits.slice(6)}`;
  };

  const validateStep1 = () => {
    if (!formData.name.trim()) {
      setError("Please enter your full name");
      return false;
    }

    if (!formData.email.trim()) {
      setFieldErrors((prev) => ({ ...prev, email: "Please enter your email" }));
      return false;
    }

    if (!isValidEmail(formData.email)) {
      setFieldErrors((prev) => ({ ...prev, email: "Please enter a valid email address" }));
      return false;
    }

    if (!formData.phone.trim()) {
      setFieldErrors((prev) => ({ ...prev, phone: "Please enter your phone number" }));
      return false;
    }

    if (phoneDigits.length !== 10) {
      setFieldErrors((prev) => ({ ...prev, phone: "Please enter a valid 10-digit phone number" }));
      return false;
    }

    if (!formData.password) {
      setError("Please create a password");
      return false;
    }

    if (formData.password.length < 8) {
      setError("Password must be at least 8 characters");
      return false;
    }

    if (!formData.repeatPassword) {
      setError("Please repeat your password");
      return false;
    }

    if (formData.password !== formData.repeatPassword) {
      setError("Passwords do not match");
      return false;
    }

    setError("");
    setFieldErrors({});
    return true;
  };

  const validateStep2 = () => {
    if (!formData.address.trim()) {
      setError("Please enter your full address");
      return false;
    }

    if (!formData.city.trim()) {
      setError("Please enter your city");
      return false;
    }

    if (!formData.zip.trim()) {
      setError("Please enter your zip code");
      return false;
    }

    if (zipDigits.length !== 5) {
      setError("Zip code must be 5 digits");
      return false;
    }

    if (!formData.county.trim()) {
      setError("Please select your county");
      return false;
    }

    if (!agreeTerms) {
      setConsentError(true);
      setError("You must agree to the Terms and Privacy Policy to continue.");
      return false;
    }

    setError("");
    setConsentError(false);
    return true;
  };

  const handleNextStep = () => {
    if (!validateStep1()) return;
    setStep(2);
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  const handleBackStep = () => {
    setError("");
    setConsentError(false);
    setStep(1);
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setConsentError(false);

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
      console.error("Registration failed:", err);
      const message =
        err?.response?.data?.message || "Registration failed. Please try again.";
      setError(message);
      setLoading(false);
    }
  };

  const Checkbox = ({
    checked,
    onChange,
    children,
  }: {
    checked: boolean;
    onChange: (v: boolean) => void;
    children: React.ReactNode;
  }) => (
    <label className="flex cursor-pointer items-start gap-3">
      <div className="relative mt-0.5">
        <input
          type="checkbox"
          checked={checked}
          onChange={(e) => onChange(e.target.checked)}
          className="sr-only peer"
        />
        <div className="flex h-4 w-4 items-center justify-center rounded border-2 border-white sm:h-5 sm:w-5 peer-checked:border-white peer-checked:bg-transparent">
          {checked && (
            <svg width="12" height="10" viewBox="0 0 14 11" fill="none">
              <path d="M1 5.5L5 9.5L13 1.5" stroke="white" strokeWidth="2" />
            </svg>
          )}
        </div>
      </div>

      <span className="text-sm leading-relaxed text-white sm:text-base">
        {children}
      </span>
    </label>
  );

  return (
    <div className="relative z-10 flex min-h-screen items-center justify-center px-4 py-24 sm:py-32">
      <div
        className="w-full max-w-[760px] rounded-[20px] p-6 backdrop-blur-[10px] sm:p-8 lg:p-12"
        style={{
          background:
            "linear-gradient(180deg, rgba(49, 50, 52, 0.4) 0%, rgba(49, 50, 52, 0.3) 50%, rgba(49, 50, 52, 0.3) 100%), rgba(238, 242, 255, 0.1)",
          boxShadow: "0px 0px 80px 0px rgba(0, 0, 0, 0.25)",
        }}
      >
        <div className="mb-5 inline-flex rounded-full border border-[#86EFAC]/25 bg-[#86EFAC]/10 px-4 py-2 text-[12px] font-semibold uppercase tracking-[0.18em] text-[#DDFBE8] sm:mb-6">
          Takes less than 1 minute
        </div>

        <div className="mb-8 flex gap-6 sm:mb-10 sm:gap-8">
          <Link
            href="/signin"
            className="pb-2 text-xl font-medium text-white/60 transition-colors hover:text-white sm:text-2xl"
          >
            Sign in
          </Link>

          <button
            onClick={() => setActiveTab("signup")}
            className={`relative pb-2 text-xl font-medium transition-colors sm:text-2xl ${
              activeTab === "signup" ? "text-white" : "text-white/60"
            }`}
            type="button"
          >
            Sign up
            {activeTab === "signup" && (
              <span className="absolute bottom-0 left-0 h-[3px] w-full bg-[#306EEC]" />
            )}
          </button>
        </div>

        <div className="mb-8">
          <div className="mb-3 flex items-start justify-between gap-4">
            <div>
              <p className="text-xl font-semibold text-white sm:text-2xl">
                {step === 1 ? "Create your account" : "Where should we service your home?"}
              </p>
              <p className="mt-1 text-sm text-white/70 sm:text-base">
                {step === 1
                  ? "Step 1 of 2 - this only takes a minute."
                  : "Step 2 of 2 - your membership is tied to one service address."}
              </p>
              {step === 1 && (
                <p className="mt-2 text-[13px] leading-relaxed text-[#D6DBE5] sm:text-sm">
                  No spam. Just your account and booking access.
                </p>
              )}
            </div>

            <div className="shrink-0 text-right">
              <p className="text-sm font-bold text-white sm:text-base">Step {step} / 2</p>
            </div>
          </div>

          <div className="h-2 w-full overflow-hidden rounded-full bg-white/15">
            <div
              className={`h-full rounded-full bg-[#306EEC] transition-all duration-300 ${
                step === 1 ? "w-1/2" : "w-full"
              }`}
            />
          </div>
        </div>

        <form className="space-y-6 sm:space-y-8" onSubmit={handleSubmit}>
          {step === 1 && (
            <>
              <div className="grid grid-cols-1 gap-6 sm:gap-x-12 sm:gap-y-8 lg:grid-cols-2">
                <div>
                  <input
                    type="text"
                    id="name"
                    value={formData.name}
                    onChange={(e) => handleChange("name", e.target.value)}
                    className="glass-input w-full border-b border-white bg-transparent pb-2 text-sm text-white placeholder-white/40 transition-colors focus:border-[#306EEC] focus:outline-none sm:pb-3 sm:text-base"
                    placeholder="Full name"
                    aria-label="Full name"
                    autoComplete="name"
                  />
                </div>

                <div>
                  <input
                    type="email"
                    id="email"
                    value={formData.email}
                    onChange={(e) => handleChange("email", e.target.value)}
                    className="glass-input w-full border-b border-white bg-transparent pb-2 text-sm text-white placeholder-white/40 transition-colors focus:border-[#306EEC] focus:outline-none sm:pb-3 sm:text-base"
                    placeholder="Email"
                    aria-label="Email"
                    autoComplete="email"
                  />
                  {fieldErrors.email ? (
                    <p className="mt-1 text-xs text-red-400">{fieldErrors.email}</p>
                  ) : null}
                </div>

                <div>
                  <input
                    type="tel"
                    id="phone"
                    value={formData.phone}
                    onChange={(e) => handleChange("phone", formatPhone(e.target.value))}
                    className="glass-input w-full border-b border-white bg-transparent pb-2 text-sm text-white placeholder-white/40 transition-colors focus:border-[#306EEC] focus:outline-none sm:pb-3 sm:text-base"
                    placeholder="Phone number"
                    aria-label="Phone number"
                    autoComplete="tel"
                  />
                  {fieldErrors.phone ? (
                    <p className="mt-1 text-xs text-red-400">{fieldErrors.phone}</p>
                  ) : null}
                </div>

                <div className="hidden lg:block" />

                <div>
                  <PasswordField
                    id="password"
                    value={formData.password}
                    onChange={(e) => handleChange("password", e.target.value)}
                    placeholder="Create password"
                    inputClassName="glass-input w-full pb-2 sm:pb-3 text-sm sm:text-base"
                    iconSize={20}
                  />
                </div>

                <div>
                  <PasswordField
                    id="repeat-password"
                    value={formData.repeatPassword}
                    onChange={(e) => handleChange("repeatPassword", e.target.value)}
                    placeholder="Repeat password"
                    inputClassName="glass-input w-full pb-2 sm:pb-3 text-sm sm:text-base"
                    iconSize={20}
                  />
                  {passwordsDoNotMatch && (
                    <p className="mt-1 text-xs text-red-400">Passwords do not match.</p>
                  )}
                </div>
              </div>

              <div className="rounded-2xl border border-white/15 bg-white/5 p-4 sm:p-5">
                <p className="text-sm font-semibold text-white sm:text-base">Why we ask for this</p>
                <p className="mt-1 text-sm leading-relaxed text-white/70 sm:text-base">
                  We create your account first, then connect your membership to the correct home on the next step.
                </p>
              </div>

              {error && (
                <div className="rounded-lg border border-red-500/20 bg-red-500/10 p-3 text-center text-sm text-red-400">
                  {error}
                </div>
              )}

              <div className="flex justify-center pt-2 sm:pt-4">
                <button
                  type="button"
                  onClick={handleNextStep}
                  className="w-full rounded-[14px] bg-[#306EEC] py-3 text-base font-medium text-white transition-colors hover:bg-[#2557C7] sm:max-w-[355px] sm:py-4"
                >
                  Continue
                </button>
              </div>
            </>
          )}

          {step === 2 && (
            <>
              <div className="rounded-2xl border border-[#86EFAC]/20 bg-[#86EFAC]/10 p-4 sm:p-5">
                <p className="text-sm font-semibold text-white sm:text-base">
                  One membership = one service address
                </p>
                <p className="mt-1 text-sm leading-relaxed text-white/75 sm:text-base">
                  This helps us confirm service area, manage bookings correctly, and tie your plan to the right home.
                </p>
              </div>

              <div className="rounded-[20px] border border-white/12 bg-white/5 p-4 sm:p-5 lg:p-6">
                <div className="mb-5">
                  <p className="text-base font-semibold text-white sm:text-lg">Service address</p>
                  <p className="mt-1 text-sm leading-relaxed text-white/70 sm:text-base">
                    This is where your membership and future bookings will be linked.
                  </p>
                </div>

                <div className="grid grid-cols-1 gap-6 sm:gap-7 lg:grid-cols-2 lg:gap-x-12 lg:gap-y-8">
                  <div className="lg:col-span-2">
                    <input
                      type="text"
                      id="address"
                      value={formData.address}
                      onChange={(e) => handleChange("address", e.target.value)}
                      className="glass-input w-full border-b border-white bg-transparent pb-2 text-sm text-white placeholder-white/40 transition-colors focus:border-[#306EEC] focus:outline-none sm:pb-3 sm:text-base"
                      placeholder="Full address"
                      aria-label="Full address"
                      autoComplete="street-address"
                    />
                  </div>

                  <div>
                    <input
                      type="text"
                      id="city"
                      value={formData.city}
                      onChange={(e) => handleChange("city", e.target.value)}
                      className="glass-input w-full border-b border-white bg-transparent pb-2 text-sm text-white placeholder-white/40 transition-colors focus:border-[#306EEC] focus:outline-none sm:pb-3 sm:text-base"
                      placeholder="City"
                      aria-label="City"
                      autoComplete="address-level2"
                    />
                  </div>

                  <div>
                    <select
                      id="county"
                      value={formData.county}
                      onChange={(e) => handleChange("county", e.target.value)}
                      className="glass-input w-full border-b border-white bg-transparent pb-2 text-sm text-white transition-colors focus:border-[#306EEC] focus:outline-none sm:pb-3 sm:text-base"
                      aria-label="County"
                    >
                      <option value="" className="bg-[#313234] text-white">
                        Select County
                      </option>
                      <option value="Nassau" className="bg-[#313234] text-white">
                        Nassau
                      </option>
                      <option value="Suffolk" className="bg-[#313234] text-white">
                        Suffolk
                      </option>
                    </select>
                  </div>

                  <div>
                    <input
                      type="text"
                      id="zip"
                      value={formData.zip}
                      onChange={(e) =>
                        handleChange("zip", e.target.value.replace(/\D/g, "").slice(0, 5))
                      }
                      className="glass-input w-full border-b border-white bg-transparent pb-2 text-sm text-white placeholder-white/40 transition-colors focus:border-[#306EEC] focus:outline-none sm:pb-3 sm:text-base"
                      placeholder="Zip code"
                      aria-label="Zip code"
                      autoComplete="postal-code"
                    />
                  </div>

                  <div>
                    <input
                      type="text"
                      id="state"
                      value={formData.state}
                      onChange={(e) => handleChange("state", e.target.value)}
                      className="glass-input w-full border-b border-white bg-transparent pb-2 text-sm text-white placeholder-white/40 transition-colors focus:border-[#306EEC] focus:outline-none sm:pb-3 sm:text-base"
                      placeholder="State"
                      aria-label="State"
                      autoComplete="address-level1"
                    />
                  </div>
                </div>
              </div>

              <div className="flex flex-col gap-3 pt-2">
                <Checkbox checked={agreeTerms} onChange={setAgreeTerms}>
                  I agree to the{" "}
                  <Link href="/terms" className="text-white underline hover:text-[#93c5fd]">
                    Terms of Service
                  </Link>{" "}
                  and{" "}
                  <Link href="/privacy" className="text-white underline hover:text-[#93c5fd]">
                    Privacy Policy
                  </Link>
                  .
                </Checkbox>

                {consentError && (
                  <p className="text-xs text-red-400">
                    Please agree to the Terms and Privacy Policy to continue.
                  </p>
                )}
              </div>

              {error && (
                <div className="rounded-lg border border-red-500/20 bg-red-500/10 p-3 text-center text-sm text-red-400">
                  {error}
                </div>
              )}

              <div className="flex flex-col justify-center gap-3 pt-4 sm:flex-row">
                <button
                  type="button"
                  onClick={handleBackStep}
                  disabled={loading}
                  className="w-full rounded-[14px] bg-white/10 py-3 text-base font-medium text-white transition-colors hover:bg-white/15 disabled:opacity-50 sm:w-[180px] sm:py-4"
                >
                  Back
                </button>

                <button
                  type="submit"
                  disabled={loading}
                  className="w-full rounded-[14px] bg-[#306EEC] py-3 text-base font-medium text-white transition-colors hover:bg-[#2557C7] disabled:cursor-not-allowed disabled:opacity-50 sm:w-[260px] sm:py-4"
                >
                  {loading ? "Creating account..." : "Create account"}
                </button>
              </div>
            </>
          )}
        </form>
      </div>
    </div>
  );
}
