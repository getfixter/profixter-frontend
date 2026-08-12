"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import Image from "next/image";
import { login, type AccountChoice } from "@/lib/auth-service";
import { useAuth } from "@/lib/useAuth";
import { getAutomaticEntryPath } from "@/lib/auth-routing";
import { trackEvent } from "@/lib/analytics";
import RoleEntryGate from "@/app/components/auth/RoleEntryGate";

function PasswordToggle({
  value,
  onChange,
  placeholder = "••••••••",
  id,
}: {
  value: string;
  onChange: (e: React.ChangeEvent<HTMLInputElement>) => void;
  placeholder?: string;
  id: string;
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
        autoComplete="current-password"
        className="h-12 w-full rounded-[10px] border border-white/[0.12] bg-white/[0.06] px-3.5 pr-11 text-[14px] text-white placeholder-white/25 transition-all backdrop-blur-sm focus:border-[#306EEC]/80 focus:bg-white/[0.09] focus:outline-none"
      />
      <button
        type="button"
        onClick={() => setShow(!show)}
        className="absolute right-3 top-1/2 -translate-y-1/2 text-white/35 transition hover:text-white/65"
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

export default function SignInPage() {
  const [email, setEmail] = useState(() => {
    if (typeof window === "undefined") return "";
    return localStorage.getItem("rememberedEmail") || "";
  });
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  /*
   * Only ever set when the server says one email has two accounts and the same
   * password opens both. The server refuses to guess, so this asks.
   */
  const [accountChoices, setAccountChoices] = useState<AccountChoice[]>([]);
  const [loading, setLoading] = useState(false);
  const router = useRouter();
  const { login: authLogin } = useAuth();

  useEffect(() => {
    trackEvent("view_login", { page: "/signin" });
  }, []);

  const signIn = async (accountRole?: "customer" | "employee") => {
    setError("");
    setLoading(true);
    try {
      const { token } = await login({
        email: email.toLowerCase().trim(),
        password,
        ...(accountRole ? { accountRole } : {}),
      });
      const verifiedUser = await authLogin(token);
      if (!verifiedUser) {
        throw new Error("We could not verify your account. Please try again.");
      }
      localStorage.setItem("rememberedEmail", email);
      router.replace(getAutomaticEntryPath(verifiedUser));
    } catch (err: unknown) {
      const error = err as {
        response?: { status?: number; data?: { message?: string; code?: string; accounts?: AccountChoice[] } };
        message?: string;
      };
      // One email, two accounts, one password. Ask rather than pick.
      if (error.response?.data?.code === "ACCOUNT_CHOICE_REQUIRED") {
        setAccountChoices(error.response.data.accounts || []);
        setLoading(false);
        return;
      }
      const message = error.response?.data?.message || error.message || "Invalid email or password";
      setError(message);
      setLoading(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setAccountChoices([]);
    await signIn();
  };

  return (
    <RoleEntryGate loadingLabel="Checking your session..." redirectLabel="Opening Your Home...">
    <div className="flex min-h-screen flex-col items-center justify-center bg-gradient-to-br from-[#0a0e27] via-[#1a1f42] to-[#0f1429] px-4 py-8 sm:px-6 sm:py-10">
      {/* Container */}
      <div className="w-full max-w-[440px]">
        
        {/* Logo */}
        <div className="mb-7 text-center sm:mb-8">
          <Link href="/" className="inline-block">
            <Image
              src="/images/logo.svg"
              alt="Profixter"
              width={132}
              height={44}
              className="h-11 w-auto"
            />
          </Link>
        </div>

        {/* Card */}
        <div className="rounded-[13px] border border-white/[0.08] bg-white/[0.03] p-5 shadow-[0_20px_60px_rgba(0,0,0,0.18)] backdrop-blur-xl sm:p-7">
          <Link
            href="/"
            className="mb-4 inline-flex min-h-[40px] items-center rounded-[10px] border border-white/[0.10] bg-white/[0.04] px-3 text-[12px] font-semibold text-white/60 transition hover:border-white/[0.18] hover:bg-white/[0.07] hover:text-white sm:mb-5"
          >
            ← Back to Home
          </Link>
          
          {/* Heading */}
          <div className="mb-5 text-center sm:mb-6">
            <h1 className="mb-1.5 text-[26px] font-black tracking-[-0.02em] text-white sm:text-[30px]">
              Welcome Back
            </h1>
            <p className="text-[13px] text-white/50 sm:text-[14px]">
              Sign in to access your account.
            </p>
          </div>

          {/* Form */}
          <form onSubmit={handleSubmit} className="space-y-3">
            {/* Email */}
            <div>
              <label htmlFor="email" className="mb-1.5 block text-[11px] font-semibold text-white/60">
                Email Address
              </label>
              <input
                id="email"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="you@example.com"
                autoComplete="email"
                required
                className="h-12 w-full rounded-[10px] border border-white/[0.12] bg-white/[0.04] px-3.5 text-[14px] text-white placeholder-white/30 transition-all focus:border-[#306EEC]/60 focus:bg-white/[0.08] focus:outline-none"
              />
            </div>

            {/* Password */}
            <div>
              <label htmlFor="password" className="mb-1.5 block text-[11px] font-semibold text-white/60">
                Password
              </label>
              <PasswordToggle
                id="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
              />
            </div>

            {/* Error */}
            {accountChoices.length > 0 && (
              <div className="rounded-xl border border-white/20 bg-white/5 p-3">
                <div className="text-sm font-bold text-white">
                  This email has more than one account
                </div>
                <div className="mt-1 text-xs text-white/60">
                  Choose which one to open.
                </div>
                <div className="mt-3 space-y-2">
                  {accountChoices.map((choice) => (
                    <button
                      key={choice.accountRole}
                      type="button"
                      disabled={loading}
                      onClick={() => void signIn(choice.accountRole)}
                      className="w-full rounded-lg bg-white px-4 py-2.5 text-sm font-bold text-[#0a0e27] disabled:opacity-50"
                    >
                      {choice.label}
                    </button>
                  ))}
                </div>
              </div>
            )}

            {error && (
              <div className="rounded-[10px] border border-red-500/20 bg-red-500/[0.08] px-4 py-3 text-[13px] text-red-400 text-center">
                {error}
              </div>
            )}

            {/* Forgot Password */}
            <div className="text-right">
              <Link
                href="/forgot-password"
                className="text-[12px] font-medium text-[#7BAEFF] transition hover:text-white"
              >
                Forgot password?
              </Link>
            </div>

            {/* Submit */}
            <button
              type="submit"
              disabled={loading}
              className="mt-2 h-12 w-full rounded-[11px] bg-[#306EEC] text-[14px] font-bold text-white transition-all hover:bg-[#2558c9] disabled:cursor-not-allowed disabled:opacity-50"
              style={{ boxShadow: "0 10px 24px rgba(48,110,236,0.24)" }}
            >
              {loading ? "Logging In..." : "Log In"}
            </button>
          </form>

          {/* Add property link */}
          <p className="mt-4 text-center text-[13px] text-white/50">
            Don&apos;t have an account?{" "}
            <Link
              href="/signup"
              className="font-semibold text-white hover:text-white/80 transition"
            >
              Create Account
            </Link>
          </p>
        </div>

        {/* Trust Strip */}
        <div className="mt-7 grid grid-cols-3 gap-3 text-center sm:mt-8">
          <div className="flex flex-col items-center gap-1.5">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" className="text-white/40">
              <path d="M9 16.17L4.83 12l-1.42 1.41L9 19 21 7l-1.41-1.41L9 16.17z" fill="currentColor" />
            </svg>
            <p className="text-[11px] font-medium text-white/50">Licensed HI-71484</p>
          </div>
          <div className="flex flex-col items-center gap-1.5">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" className="text-white/40">
              <path d="M9 16.17L4.83 12l-1.42 1.41L9 19 21 7l-1.41-1.41L9 16.17z" fill="currentColor" />
            </svg>
            <p className="text-[11px] font-medium text-white/50">Fully Insured</p>
          </div>
          <div className="flex flex-col items-center gap-1.5">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" className="text-white/40">
              <path d="M9 16.17L4.83 12l-1.42 1.41L9 19 21 7l-1.41-1.41L9 16.17z" fill="currentColor" />
            </svg>
            <p className="text-[11px] font-medium text-white/50">Long Island Local</p>
          </div>
        </div>
      </div>
    </div>
    </RoleEntryGate>
  );
}
