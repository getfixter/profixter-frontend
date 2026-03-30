"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { PasswordField } from "../../components/auth/PasswordField";
import { register } from "@/lib/auth-service";

type Step = 1 | 2;

export default function SignUpPage() {
  const [activeTab, setActiveTab] = useState<"signin" | "signup">("signup");
  const [step, setStep] = useState<Step>(1);

  const [agreeTerms, setAgreeTerms] = useState(false);
  const [consentError, setConsentError] = useState(false);

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

  const handleChange = (field: keyof typeof formData, value: string) => {
    setFormData((prev) => ({ ...prev, [field]: value }));

    if (error) setError("");
    if (consentError) setConsentError(false);
  };

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
      setError("Please enter your email");
      return false;
    }

    if (!formData.phone.trim()) {
      setError("Please enter your phone number");
      return false;
    }

    if (phoneDigits.length !== 10) {
      setError("Phone number must be 10 digits");
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
    <label className="flex items-start gap-3 cursor-pointer">
      <div className="relative mt-0.5">
        <input
          type="checkbox"
          checked={checked}
          onChange={(e) => onChange(e.target.checked)}
          className="sr-only peer"
        />
        <div className="w-4 h-4 sm:w-5 sm:h-5 border-2 rounded flex items-center justify-center border-white peer-checked:bg-transparent peer-checked:border-white">
          {checked && (
            <svg width="12" height="10" viewBox="0 0 14 11" fill="none">
              <path d="M1 5.5L5 9.5L13 1.5" stroke="white" strokeWidth="2" />
            </svg>
          )}
        </div>
      </div>

      <span className="text-white text-sm sm:text-base leading-relaxed">
        {children}
      </span>
    </label>
  );

  return (
    <div className="relative z-10 min-h-screen flex items-center justify-center px-4 py-24 sm:py-32">
      <div
        className="w-full max-w-[760px] rounded-[20px] p-6 sm:p-8 lg:p-12 backdrop-blur-[10px]"
        style={{
          background:
            "linear-gradient(180deg, rgba(49, 50, 52, 0.4) 0%, rgba(49, 50, 52, 0.3) 50%, rgba(49, 50, 52, 0.3) 100%), rgba(238, 242, 255, 0.1)",
          boxShadow: "0px 0px 80px 0px rgba(0, 0, 0, 0.25)",
        }}
      >
        <div className="flex gap-6 sm:gap-8 mb-8 sm:mb-10">
          <Link
            href="/signin"
            className="text-xl sm:text-2xl font-medium pb-2 text-white/60 hover:text-white transition-colors"
          >
            Sign in
          </Link>

          <button
            onClick={() => setActiveTab("signup")}
            className={`text-xl sm:text-2xl font-medium pb-2 transition-colors relative ${
              activeTab === "signup" ? "text-white" : "text-white/60"
            }`}
            type="button"
          >
            Sign up
            {activeTab === "signup" && (
              <span className="absolute bottom-0 left-0 w-full h-[3px] bg-[#306EEC]" />
            )}
          </button>
        </div>

        <div className="mb-8">
          <div className="flex items-center justify-between gap-4 mb-3">
            <div>
              <p className="text-white text-xl sm:text-2xl font-semibold">
                {step === 1 ? "Create your account" : "Where should we service your home?"}
              </p>
              <p className="text-white/70 text-sm sm:text-base mt-1">
                {step === 1
                  ? "Step 1 of 2 — this only takes a minute."
                  : "Step 2 of 2 — your membership is tied to one service address."}
              </p>
            </div>

            <div className="text-right shrink-0">
              <p className="text-white font-bold text-sm sm:text-base">
                Step {step} / 2
              </p>
            </div>
          </div>

          <div className="h-2 w-full rounded-full bg-white/15 overflow-hidden">
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
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 sm:gap-x-12 sm:gap-y-8">
                <div>
                  <input
                    type="text"
                    id="name"
                    value={formData.name}
                    onChange={(e) => handleChange("name", e.target.value)}
                    className="glass-input w-full pb-2 sm:pb-3 bg-transparent border-b border-white text-white text-sm sm:text-base placeholder-white/40 focus:outline-none focus:border-[#306EEC] transition-colors"
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
                    className="glass-input w-full pb-2 sm:pb-3 bg-transparent border-b border-white text-white text-sm sm:text-base placeholder-white/40 focus:outline-none focus:border-[#306EEC] transition-colors"
                    placeholder="Email"
                    aria-label="Email"
                    autoComplete="email"
                  />
                </div>

                <div>
                  <input
                    type="tel"
                    id="phone"
                    value={formData.phone}
                    onChange={(e) => handleChange("phone", formatPhone(e.target.value))}
                    className="glass-input w-full pb-2 sm:pb-3 bg-transparent border-b border-white text-white text-sm sm:text-base placeholder-white/40 focus:outline-none focus:border-[#306EEC] transition-colors"
                    placeholder="Phone number"
                    aria-label="Phone number"
                    autoComplete="tel"
                  />
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
                    <p className="text-red-400 text-xs mt-1">Passwords do not match.</p>
                  )}
                </div>
              </div>

              <div className="rounded-2xl border border-white/15 bg-white/5 p-4 sm:p-5">
                <p className="text-white font-semibold text-sm sm:text-base">
                  Why we ask for this
                </p>
                <p className="text-white/70 text-sm sm:text-base mt-1 leading-relaxed">
                  We create your account first, then connect your membership to the
                  correct home on the next step.
                </p>
              </div>

              {error && (
                <div className="text-red-400 text-sm text-center bg-red-500/10 border border-red-500/20 rounded-lg p-3">
                  {error}
                </div>
              )}

              <div className="flex justify-center pt-2 sm:pt-4">
                <button
                  type="button"
                  onClick={handleNextStep}
                  className="w-full sm:max-w-[355px] py-3 sm:py-4 bg-[#306EEC] text-white rounded-[14px] text-base font-medium hover:bg-[#2557C7] transition-colors"
                >
                  Continue
                </button>
              </div>
            </>
          )}

          {step === 2 && (
            <>
              <div className="rounded-2xl border border-[#86EFAC]/20 bg-[#86EFAC]/10 p-4 sm:p-5">
                <p className="text-white font-semibold text-sm sm:text-base">
                  One membership = one service address
                </p>
                <p className="text-white/75 text-sm sm:text-base mt-1 leading-relaxed">
                  This helps us confirm service area, manage bookings correctly, and tie
                  your plan to the right home.
                </p>
              </div>

              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 sm:gap-x-12 sm:gap-y-8">
                <div className="lg:col-span-2">
                  <input
                    type="text"
                    id="address"
                    value={formData.address}
                    onChange={(e) => handleChange("address", e.target.value)}
                    className="glass-input w-full pb-2 sm:pb-3 bg-transparent border-b border-white text-white text-sm sm:text-base placeholder-white/40 focus:outline-none focus:border-[#306EEC] transition-colors"
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
                    className="glass-input w-full pb-2 sm:pb-3 bg-transparent border-b border-white text-white text-sm sm:text-base placeholder-white/40 focus:outline-none focus:border-[#306EEC] transition-colors"
                    placeholder="City"
                    aria-label="City"
                    autoComplete="address-level2"
                  />
                </div>

                <div>
                  <input
                    type="text"
                    id="zip"
                    value={formData.zip}
                    onChange={(e) =>
                      handleChange("zip", e.target.value.replace(/\D/g, "").slice(0, 5))
                    }
                    className="glass-input w-full pb-2 sm:pb-3 bg-transparent border-b border-white text-white text-sm sm:text-base placeholder-white/40 focus:outline-none focus:border-[#306EEC] transition-colors"
                    placeholder="Zip code"
                    aria-label="Zip code"
                    autoComplete="postal-code"
                  />
                </div>

                <div>
                  <select
                    id="county"
                    value={formData.county}
                    onChange={(e) => handleChange("county", e.target.value)}
                    className="glass-input w-full pb-2 sm:pb-3 bg-transparent border-b border-white text-white text-sm sm:text-base focus:outline-none focus:border-[#306EEC] transition-colors"
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
                    id="state"
                    value={formData.state}
                    onChange={(e) => handleChange("state", e.target.value)}
                    className="glass-input w-full pb-2 sm:pb-3 bg-transparent border-b border-white text-white text-sm sm:text-base placeholder-white/40 focus:outline-none focus:border-[#306EEC] transition-colors"
                    placeholder="State"
                    aria-label="State"
                    autoComplete="address-level1"
                  />
                </div>
              </div>

              <div className="flex flex-col gap-3 pt-2">
                <Checkbox checked={agreeTerms} onChange={setAgreeTerms}>
                  I agree to the{" "}
                  <Link href="/terms" className="underline text-white hover:text-[#93c5fd]">
                    Terms of Service
                  </Link>{" "}
                  and{" "}
                  <Link href="/privacy" className="underline text-white hover:text-[#93c5fd]">
                    Privacy Policy
                  </Link>
                  .
                </Checkbox>

                {consentError && (
                  <p className="text-red-400 text-xs">
                    Please agree to the Terms and Privacy Policy to continue.
                  </p>
                )}
              </div>

              {error && (
                <div className="text-red-400 text-sm text-center bg-red-500/10 border border-red-500/20 rounded-lg p-3">
                  {error}
                </div>
              )}

              <div className="flex flex-col sm:flex-row justify-center gap-3 pt-4">
                <button
                  type="button"
                  onClick={handleBackStep}
                  disabled={loading}
                  className="w-full sm:w-[180px] py-3 sm:py-4 bg-white/10 text-white rounded-[14px] text-base font-medium hover:bg-white/15 transition-colors disabled:opacity-50"
                >
                  Back
                </button>

                <button
                  type="submit"
                  disabled={loading}
                  className="w-full sm:w-[260px] py-3 sm:py-4 bg-[#306EEC] text-white rounded-[14px] text-base font-medium hover:bg-[#2557C7] transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
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