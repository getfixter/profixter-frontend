"use client";

import Link from "next/link";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { GoogleButton } from "../../components/auth/GoogleButton";
import { PasswordField } from "../../components/auth/PasswordField";
import { register } from "@/lib/auth-service";

// NOTE: Moved into (auth) route group without style changes.
export default function SignUpPage() {
  const [activeTab, setActiveTab] = useState<"signin" | "signup">("signup");

  // ✅ Single combined consent checkbox
  const [agreeToAll, setAgreeToAll] = useState(false);
  const [consentError, setConsentError] = useState(false);

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const router = useRouter();

  // Form fields
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

  const handleChange = (field: string, value: string) => {
    setFormData((prev) => ({ ...prev, [field]: value }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");

    // Validation
    if (
      !formData.name ||
      !formData.email ||
      !formData.password ||
      !formData.phone ||
      !formData.address ||
      !formData.city ||
      !formData.zip ||
      !formData.county
    ) {
      setError("Please fill in all required fields");
      return;
    }

    if (formData.password.length < 8) {
      setError("Password must be at least 8 characters");
      return;
    }

    if (formData.password !== formData.repeatPassword) {
      setError("Passwords do not match");
      return;
    }

    // ✅ Single checkbox validation
    setConsentError(false);
    if (!agreeToAll) {
      setConsentError(true);
      setError("You must agree before continuing.");
      return;
    }

    const phoneDigits = formData.phone.replace(/\D/g, "");
    if (phoneDigits.length !== 10) {
      setError("Phone number must be 10 digits");
      return;
    }

    if (formData.zip.length !== 5) {
      setError("Zip code must be 5 digits");
      return;
    }

    setLoading(true);

    try {
      const { token, user } = await register({
        name: formData.name,
        email: formData.email,
        password: formData.password,
        phone: formData.phone,
        address: formData.address,
        city: formData.city,
        state: formData.state,
        zip: formData.zip,
        county: formData.county,
      });

      // Save token and user data
      localStorage.setItem("token", token);
      localStorage.setItem("user", JSON.stringify(user));

      // Redirect
      window.location.href = "/";
    } catch (err: any) {
      console.error("Registration failed:", err);
      const message =
        err?.response?.data?.message || "Registration failed. Please try again.";
      setError(message);
      setLoading(false);
    }
  };

  return (
    <div className="relative z-10 min-h-screen flex items-center justify-center px-4 py-24 sm:py-32">
      <div
        className="w-full max-w-[860px] rounded-[20px] p-6 sm:p-8 lg:p-12 backdrop-blur-[10px]"
        style={{
          background:
            "linear-gradient(180deg, rgba(49, 50, 52, 0.4) 0%, rgba(49, 50, 52, 0.3) 50%, rgba(49, 50, 52, 0.3) 100%), rgba(238, 242, 255, 0.1)",
          boxShadow: "0px 0px 80px 0px rgba(0, 0, 0, 0.25)",
        }}
      >
        <div className="flex gap-6 sm:gap-8 mb-8 sm:mb-12">
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
          >
            Sign up
            {activeTab === "signup" && (
              <span className="absolute bottom-0 left-0 w-full h-[3px] bg-[#306EEC]" />
            )}
          </button>
        </div>

        <form className="space-y-6 sm:space-y-8" onSubmit={handleSubmit}>
          <GoogleButton className="w-full max-w-[318px]" spanClassName="text-base" />

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 sm:gap-x-12 sm:gap-y-8">
            <div>
              <input
                type="text"
                id="name"
                value={formData.name}
                onChange={(e) => handleChange("name", e.target.value)}
                className="glass-input w-full pb-2 sm:pb-3 bg-transparent border-b border-white text-white text-sm sm:text-base placeholder-white/40 focus:outline-none focus:border-[#306EEC] transition-colors"
                placeholder="Full Name"
                aria-label="Full Name"
                required
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
                required
              />
            </div>

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

            <div>
              <input
                type="tel"
                id="phone"
                value={formData.phone}
                onChange={(e) => handleChange("phone", e.target.value)}
                className="glass-input w-full pb-2 sm:pb-3 bg-transparent border-b border-white text-white text-sm sm:text-base placeholder-white/40 focus:outline-none focus:border-[#306EEC] transition-colors"
                placeholder="Phone number"
                aria-label="Phone number"
                required
              />
            </div>

            <div>
              <input
                type="text"
                id="zip"
                value={formData.zip}
                onChange={(e) => handleChange("zip", e.target.value)}
                className="glass-input w-full pb-2 sm:pb-3 bg-transparent border-b border-white text-white text-sm sm:text-base placeholder-white/40 focus:outline-none focus:border-[#306EEC] transition-colors"
                placeholder="Zip code"
                aria-label="Zip code"
                required
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
                required
              />
            </div>

            <div>
              <select
                id="county"
                value={formData.county}
                onChange={(e) => handleChange("county", e.target.value)}
                className="glass-input w-full pb-2 sm:pb-3 bg-transparent border-b border-white text-white text-sm sm:text-base placeholder-white/40 focus:outline-none focus:border-[#306EEC] transition-colors"
                aria-label="County"
                required
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

            <div className="lg:col-span-2">
              <input
                type="text"
                id="address"
                value={formData.address}
                onChange={(e) => handleChange("address", e.target.value)}
                className="glass-input w-full pb-2 sm:pb-3 bg-transparent border-b border-white text-white text-sm sm:text-base placeholder-white/40 focus:outline-none focus:border-[#306EEC] transition-colors"
                placeholder="Full address"
                aria-label="Full address"
                required
              />
            </div>
          </div>

          {/* ✅ ONE CHECKBOX FOR BOTH TERMS + SMS */}
          <div className="flex flex-col gap-1 pt-4">
            <label className="flex items-start gap-3 cursor-pointer">
              <div className="relative mt-0.5">
                <input
                  type="checkbox"
                  checked={agreeToAll}
                  onChange={(e) => {
                    setAgreeToAll(e.target.checked);
                    setConsentError(false);
                  }}
                  className="sr-only peer"
                />
                <div
                  className={`w-4 h-4 sm:w-5 sm:h-5 border-2 rounded flex items-center justify-center
                  ${consentError ? "border-red-500" : "border-white"}
                  peer-checked:bg-transparent peer-checked:border-white`}
                >
                  {agreeToAll && (
                    <svg width="12" height="10" viewBox="0 0 14 11" fill="none">
                      <path d="M1 5.5L5 9.5L13 1.5" stroke="white" strokeWidth="2" />
                    </svg>
                  )}
                </div>
              </div>

              <span className="text-white text-sm sm:text-base leading-relaxed">
                I agree to the{" "}
                <Link href="/terms" className="underline text-white hover:text-[#93c5fd]">
                  Terms &amp; Privacy Notice
                </Link>{" "}
                and I consent to receive{" "}
                <Link
                  href="/communication-consent"
                  className="underline text-white hover:text-[#93c5fd]"
                >
                  SMS/phone/email communications
                </Link>{" "}
                (reply STOP to opt out of texts). I understand Profixter may contact me from
                different numbers, and the main number is{" "}
                <span className="font-semibold">631-599-1363</span>.
              </span>
            </label>

            {consentError && (
              <p className="text-red-400 text-xs mt-1">Please check this box to continue.</p>
            )}
          </div>

          {error && (
            <div className="text-red-400 text-sm text-center bg-red-500/10 border border-red-500/20 rounded-lg p-3">
              {error}
            </div>
          )}

          <div className="flex justify-center pt-6 sm:pt-8">
            <button
              type="submit"
              disabled={loading}
              className="w-full sm:max-w-[355px] py-3 sm:py-4 bg-[#306EEC] text-white rounded-[14px] text-base font-medium hover:bg-[#2557C7] transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {loading ? "Creating account..." : "Sign up"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
