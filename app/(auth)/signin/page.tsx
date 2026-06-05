"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import Image from "next/image";
import { login } from "@/lib/auth-service";
import { useAuth } from "@/lib/useAuth";
import { trackEvent } from "@/lib/analytics";

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

export default function SignInPage() {
  const [email, setEmail] = useState(() => {
    if (typeof window === "undefined") return "";
    return localStorage.getItem("rememberedEmail") || "";
  });
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const router = useRouter();
  const { login: authLogin } = useAuth();

  useEffect(() => {
    trackEvent("view_login", { page: "/signin" });
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setLoading(true);
    try {
      const { token, user } = await login({
        email: email.toLowerCase().trim(),
        password,
      });
      authLogin(token, user);
      localStorage.setItem("rememberedEmail", email);
      if (user.email.toLowerCase() === "getfixter@gmail.com") router.replace("/admin");
      else router.replace("/");
    } catch (err: unknown) {
      const error = err as { response?: { data?: { message?: string } } };
      const message = error.response?.data?.message || "Invalid email or password";
      setError(message);
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-[#0a0e27] via-[#1a1f42] to-[#0f1429] flex flex-col items-center justify-center px-6 py-12">
      {/* Container */}
      <div className="w-full max-w-[440px]">
        
        {/* Logo */}
        <div className="text-center mb-12">
          <Link href="/" className="inline-block">
            <Image
              src="/images/logo.svg"
              alt="Fixter"
              width={120}
              height={40}
              className="h-10 w-auto"
            />
          </Link>
        </div>

        {/* Card */}
        <div className="rounded-[20px] border border-white/[0.08] bg-white/[0.03] backdrop-blur-xl p-8 sm:p-10">
          
          {/* Heading */}
          <div className="mb-8 text-center">
            <h1 className="text-[32px] sm:text-[36px] font-black tracking-[-0.02em] text-white mb-2">
              Welcome Back
            </h1>
            <p className="text-[15px] text-white/50">
              Sign in to manage your home visits
            </p>
          </div>

          {/* Form */}
          <form onSubmit={handleSubmit} className="space-y-4">
            {/* Email */}
            <div>
              <label htmlFor="email" className="block text-[12px] font-semibold text-white/60 mb-2">
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
                className="w-full rounded-[10px] border border-white/[0.12] bg-white/[0.04] px-4 py-3 text-[15px] text-white placeholder-white/30 focus:outline-none focus:border-[#306EEC]/60 focus:bg-white/[0.08] transition-all"
              />
            </div>

            {/* Password */}
            <div>
              <label htmlFor="password" className="block text-[12px] font-semibold text-white/60 mb-2">
                Password
              </label>
              <PasswordToggle
                id="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
              />
            </div>

            {/* Error */}
            {error && (
              <div className="rounded-[10px] border border-red-500/20 bg-red-500/[0.08] px-4 py-3 text-[13px] text-red-400 text-center">
                {error}
              </div>
            )}

            {/* Forgot Password */}
            <div className="text-right pt-1">
              <Link
                href="/forgot-password"
                className="text-[13px] font-medium text-[#7BAEFF] hover:text-white transition"
              >
                Forgot password?
              </Link>
            </div>

            {/* Submit */}
            <button
              type="submit"
              disabled={loading}
              className="w-full h-12 rounded-[12px] bg-[#306EEC] text-white text-[15px] font-bold hover:bg-[#2558c9] transition-all disabled:opacity-50 disabled:cursor-not-allowed mt-3"
              style={{ boxShadow: "0 12px 32px rgba(48,110,236,0.28)" }}
            >
              {loading ? "Signing in…" : "Sign In"}
            </button>
          </form>

          {/* Sign up link */}
          <p className="mt-6 text-center text-[14px] text-white/50">
            New to Profixter?{" "}
            <Link
              href="/signup"
              className="font-semibold text-white hover:text-white/80 transition"
            >
              Create Account
            </Link>
          </p>
        </div>

        {/* Trust Strip */}
        <div className="mt-12 grid grid-cols-3 gap-4 text-center">
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
