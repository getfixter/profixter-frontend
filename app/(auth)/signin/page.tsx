"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { login } from "@/lib/auth-service";
import { useAuth } from "@/lib/useAuth";
import { trackEvent } from "@/lib/analytics";
import { GoogleButton } from "../../components/auth/GoogleButton";
import AuthLeftPanel from "../../components/auth/AuthLeftPanel";

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
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [keepSignedIn, setKeepSignedIn] = useState(true);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const router = useRouter();
  const { login: authLogin } = useAuth();

  useEffect(() => {
    trackEvent("view_login", { page: "/signin" });
    const saved = localStorage.getItem("rememberedEmail");
    if (saved) setEmail(saved);
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
      if (keepSignedIn) localStorage.setItem("rememberedEmail", email);
      else localStorage.removeItem("rememberedEmail");
      if (user.email.toLowerCase() === "getfixter@gmail.com") router.replace("/admin");
      else router.replace("/");
    } catch (err: any) {
      const message = err.response?.data?.message || "Invalid email or password";
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
      <div className="flex flex-col justify-center min-h-screen w-full lg:w-[460px] xl:w-[500px] px-6 py-24 sm:px-10 lg:px-12 xl:px-14 flex-shrink-0">
        <div className="w-full max-w-[400px] mx-auto lg:mx-0">

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

          {/* Heading */}
          <div className="mb-8">
            <h1 className="text-[30px] sm:text-[34px] font-black tracking-[-0.03em] text-white mb-1.5">
              Welcome back
            </h1>
            <p className="text-[14px] text-white/40">
              Sign in to your Fixter account
            </p>
          </div>

          {/* Google OAuth */}
          <GoogleButton className="mb-5" spanClassName="text-[15px] font-semibold" />

          {/* Divider */}
          <div className="flex items-center gap-3 mb-6">
            <div className="flex-1 h-px bg-white/[0.09]" />
            <span className="text-[12px] font-medium text-white/28">or continue with email</span>
            <div className="flex-1 h-px bg-white/[0.09]" />
          </div>

          {/* Form */}
          <form onSubmit={handleSubmit} className="space-y-4">

            {/* Email */}
            <div>
              <label htmlFor="email" className="block text-[11px] font-bold uppercase tracking-[0.14em] text-white/38 mb-2">
                Email
              </label>
              <input
                id="email"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="your@email.com"
                autoComplete="email"
                required
                className="w-full rounded-[12px] border border-white/[0.12] bg-white/[0.06] px-4 py-3.5 text-[15px] text-white placeholder-white/25 focus:outline-none focus:border-[#306EEC]/80 focus:bg-white/[0.09] transition-all backdrop-blur-sm"
              />
              {email && (
                <p className="mt-1.5 text-[11px] text-white/30">
                  Email pre-filled from your last sign-in
                </p>
              )}
            </div>

            {/* Password */}
            <div>
              <label htmlFor="password" className="block text-[11px] font-bold uppercase tracking-[0.14em] text-white/38 mb-2">
                Password
              </label>
              <PasswordToggle
                id="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
              />
            </div>

            {/* Remember me + Forgot */}
            <div className="flex items-center justify-between pt-1">
              <label className="flex items-center gap-2.5 cursor-pointer group">
                <div className="relative flex-shrink-0">
                  <input
                    type="checkbox"
                    checked={keepSignedIn}
                    onChange={(e) => setKeepSignedIn(e.target.checked)}
                    className="sr-only peer"
                  />
                  <div className="w-4 h-4 rounded-[4px] border border-white/25 flex items-center justify-center peer-checked:bg-[#306EEC] peer-checked:border-[#306EEC] transition">
                    {keepSignedIn && (
                      <svg width="9" height="7" viewBox="0 0 9 7" fill="none" aria-hidden="true">
                        <path d="M1 3.5l2 2L8 1" stroke="white" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
                      </svg>
                    )}
                  </div>
                </div>
                <span className="text-[13px] font-medium text-white/45 group-hover:text-white/65 transition">
                  Remember me
                </span>
              </label>

              <Link
                href="/forgot-password"
                className="text-[13px] font-medium text-[#7BAEFF] hover:text-white transition"
              >
                Forgot password?
              </Link>
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
              disabled={loading}
              className="w-full h-[52px] rounded-[14px] bg-[#306EEC] text-white text-[15px] font-extrabold hover:bg-[#2558c9] transition-all disabled:opacity-50 disabled:cursor-not-allowed mt-2"
              style={{ boxShadow: "0 12px 32px rgba(48,110,236,0.28)" }}
            >
              {loading ? "Signing in…" : "Sign In"}
            </button>
          </form>

          {/* Sign up link */}
          <p className="mt-7 text-center text-[13px] text-white/32">
            New to Fixter?{" "}
            <Link
              href="/signup"
              className="font-semibold text-white/60 hover:text-white transition"
            >
              Create an account →
            </Link>
          </p>

          {/* Mobile service promo */}
          <div className="lg:hidden mt-10 pt-8 border-t border-white/[0.07]">
            <p className="text-[11px] font-bold uppercase tracking-[0.18em] text-white/25 mb-4 text-center">
              Also available
            </p>
            <div className="grid grid-cols-2 gap-3">
              <Link
                href="/roofing"
                className="rounded-[12px] border border-[#D4A574]/20 bg-[#D4A574]/[0.06] p-3.5 transition hover:bg-[#D4A574]/[0.12]"
              >
                <div className="text-[10px] font-bold uppercase tracking-[0.16em] text-[#D4A574]/60 mb-1">
                  Roofing
                </div>
                <div className="text-[12px] font-bold text-white leading-snug">Full Replacements</div>
                <div className="text-[10px] text-white/28 mt-0.5">50-yr warranty</div>
              </Link>
              <Link
                href="/siding"
                className="rounded-[12px] border border-white/[0.09] bg-white/[0.04] p-3.5 transition hover:bg-white/[0.08]"
              >
                <div className="text-[10px] font-bold uppercase tracking-[0.16em] text-white/28 mb-1">
                  Siding
                </div>
                <div className="text-[12px] font-bold text-white leading-snug">Installation</div>
                <div className="text-[10px] text-white/28 mt-0.5">50-yr warranty</div>
              </Link>
            </div>
          </div>

        </div>
      </div>
    </div>
  );
}
