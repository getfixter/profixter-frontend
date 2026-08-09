"use client";

import Link from "next/link";
import Image from "next/image";
import { useEffect, useMemo, useRef, useState } from "react";
import { useAuth } from "@/lib/useAuth";
import { useRouter } from "next/navigation";
import { MAIN_NAV_LINKS } from "@/lib/site-architecture";
import { getRoleLandingPath } from "@/lib/auth-routing";

export default function Header() {
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const [isProfileMenuOpen, setIsProfileMenuOpen] = useState(false);

  const { user, isAuthenticated, logout } = useAuth();
  const profileMenuRef = useRef<HTMLDivElement>(null);
  const router = useRouter();

  const accountLabel = useMemo(() => {
    const first = user?.name?.trim().split(/\s+/)[0];
    return first || "Account";
  }, [user?.name]);
  const accountHref = useMemo(() => getRoleLandingPath(user), [user]);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (profileMenuRef.current && !profileMenuRef.current.contains(event.target as Node)) {
        setIsProfileMenuOpen(false);
      }
    };

    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  useEffect(() => {
    if (isMenuOpen) document.body.style.overflow = "hidden";
    else document.body.style.overflow = "";

    return () => {
      document.body.style.overflow = "";
    };
  }, [isMenuOpen]);

  useEffect(() => {
    const close = () => setIsMenuOpen(false);
    window.addEventListener("hashchange", close);
    window.addEventListener("popstate", close);

    return () => {
      window.removeEventListener("hashchange", close);
      window.removeEventListener("popstate", close);
    };
  }, []);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setIsMenuOpen(false);
    };

    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  const handleLogout = () => {
    logout();
    setIsProfileMenuOpen(false);
    setIsMenuOpen(false);
    router.push("/");
  };

  return (
    <header className="relative z-50 w-full py-[8px] sm:py-[12px]">
      <div className="mx-2.5 rounded-[18px] border border-white/50 bg-white/92 shadow-[0_14px_48px_rgba(9,22,43,0.14)] backdrop-blur-xl sm:mx-5 sm:rounded-[20px]">
        <div className="mx-auto flex max-w-[1240px] items-center justify-between px-[12px] py-[8px] sm:px-[18px] sm:py-[10px]">
          <Link href="/" className="relative z-50 flex items-center">
            <Image src="/images/logo.svg" alt="Profixter Long Island" width={80} height={32} priority className="brightness-0" />
          </Link>

          <nav className="hidden items-center gap-1 rounded-full border border-[#E6ECF7] bg-white/72 p-1 lg:flex" aria-label="Main navigation">
            {MAIN_NAV_LINKS.map((item) => (
              <Link
                key={item.href}
                href={item.href}
                className="rounded-full px-3.5 py-2.5 text-sm font-black text-[#172033] transition-colors hover:bg-[#EEF4FF] hover:text-[#306EEC]"
              >
                {item.label}
              </Link>
            ))}
          </nav>

          <div className="hidden items-center gap-3 lg:flex">
            {isAuthenticated ? (
              <div className="relative" ref={profileMenuRef}>
                <button
                  onClick={() => setIsProfileMenuOpen((v) => !v)}
                  className="flex items-center gap-2 rounded-full border border-[#D8E2F2] bg-white/88 py-1.5 pl-4 pr-1.5 shadow-sm transition hover:bg-white"
                  aria-label="Open profile menu"
                >
                  <span className="text-sm font-black text-[#111827]">{accountLabel}</span>
                  <div className="flex h-9 w-9 items-center justify-center rounded-full bg-[#0B1628]">
                    <svg width="31" height="28" viewBox="0 0 31 28" fill="none" aria-hidden="true">
                      <path d="M15.5 14C18.5376 14 21 11.5376 21 8.5C21 5.46243 18.5376 3 15.5 3C12.4624 3 10 5.46243 10 8.5C10 11.5376 12.4624 14 15.5 14Z" fill="#EEF2FF" />
                      <path d="M15.5 16C9.70101 16 5 19.134 5 23C5 24.1046 5.89543 25 7 25H24C25.1046 25 26 24.1046 26 23C26 19.134 21.299 16 15.5 16Z" fill="#EEF2FF" />
                    </svg>
                  </div>
                </button>

                {isProfileMenuOpen && (
                  <div className="absolute right-0 top-full z-50 mt-2 w-56 rounded-[14px] border border-[#E6E8EF] bg-white py-2 shadow-lg">
                    <Link
                      href={accountHref}
                      className="block px-4 py-3 text-base text-[#111827] transition-colors hover:bg-[#EEF2FF]"
                      onClick={() => setIsProfileMenuOpen(false)}
                    >
                      My Account
                    </Link>
                    <div className="my-2 border-t border-[#E6E8EF]" />
                    <button
                      className="block w-full px-4 py-3 text-left text-base text-red-600 transition-colors hover:bg-[#EEF2FF]"
                      onClick={handleLogout}
                    >
                      Log out
                    </button>
                  </div>
                )}
              </div>
            ) : (
              <>
                <Link
                  href="/signup?redirect=%2Fmembership"
                  className="rounded-full bg-[#306EEC] px-5 py-3 text-sm font-bold text-white shadow-sm transition hover:bg-[#2558C9]"
                >
                  First Visit Free
                </Link>
                <Link
                  href="/signin"
                  className="rounded-full border border-[#C5CBD8] bg-white/90 px-5 py-3 text-sm font-black text-[#111827] shadow-sm transition hover:bg-white"
                >
                  Log In
                </Link>
              </>
            )}
          </div>

          <button
            onClick={() => setIsMenuOpen((v) => !v)}
            className="relative z-[70] flex h-9 w-9 flex-col items-center justify-center gap-1.5 lg:hidden"
            aria-label={isMenuOpen ? "Close menu" : "Open menu"}
            aria-expanded={isMenuOpen}
          >
            <span className={`h-0.5 w-6 bg-[#111827] transition-all duration-300 ${isMenuOpen ? "translate-y-2 rotate-45" : ""}`} />
            <span className={`h-0.5 w-6 bg-[#111827] transition-all duration-300 ${isMenuOpen ? "opacity-0" : ""}`} />
            <span className={`h-0.5 w-6 bg-[#111827] transition-all duration-300 ${isMenuOpen ? "-translate-y-2 -rotate-45" : ""}`} />
          </button>
        </div>
      </div>

      <div className="hidden items-center justify-center gap-5 px-4 pt-2.5 sm:flex">
        <div className="inline-flex items-center gap-2 rounded-full border border-[#D9E4FF] bg-white/80 px-4 py-1.5 shadow-sm">
          <span className="h-1.5 w-1.5 flex-shrink-0 rounded-full bg-[#86EFAC]" style={{ boxShadow: "0 0 6px rgba(134,239,172,0.9)" }} />
          <span className="text-[11px] font-semibold uppercase tracking-[0.18em] text-[#306EEC]">
            Serving Nassau & Suffolk Counties
          </span>
        </div>
      </div>

      <div
        className={`fixed inset-0 z-[65] overflow-y-auto bg-white pb-[calc(env(safe-area-inset-bottom)+120px)] pt-[env(safe-area-inset-top)] transition-all duration-300 lg:hidden ${
          isMenuOpen ? "visible opacity-100" : "invisible opacity-0"
        }`}
        role="dialog"
        aria-modal="true"
        aria-label="Mobile navigation"
      >
        <button
          onClick={() => setIsMenuOpen(false)}
          aria-label="Close menu"
          className="absolute right-4 top-11 z-[80] flex h-9 w-9 items-center justify-center rounded-full border border-[#E6E8EF] bg-white/95 text-[#111827] shadow-[0_10px_30px_rgba(17,24,39,0.15)] transition hover:bg-[#F6F7FB] sm:right-5 sm:top-14 sm:h-10 sm:w-10"
        >
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" aria-hidden="true">
            <path d="M18 6L6 18M6 6l12 12" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        </button>

        <button
          aria-label="Close menu background"
          className="absolute inset-0 h-full w-full cursor-default"
          onClick={() => setIsMenuOpen(false)}
        />

        <div className="relative z-[75]">
          <nav className="flex min-h-[100svh] flex-col items-center justify-start gap-4 px-4 pb-8 pt-20 sm:gap-5 sm:pb-10 sm:pt-24" aria-label="Mobile navigation">
            <div className="w-full max-w-sm">
              <div className="text-[11px] font-black uppercase tracking-[0.18em] text-[#306EEC]">
                Profixter Long Island
              </div>
              <h2 className="mt-2 text-2xl font-black leading-tight text-[#0B1628] sm:mt-3 sm:text-3xl">
                What does your home need?
              </h2>
            </div>

            <div className="flex w-full max-w-sm flex-col gap-2.5 rounded-[22px] border border-[#E6E8EF] bg-white p-2.5 shadow-[0_16px_50px_rgba(17,24,39,0.08)] sm:gap-3 sm:rounded-[24px] sm:p-3">
              {MAIN_NAV_LINKS.map((item) => (
                <Link
                  key={item.href}
                  href={item.href}
                  onClick={() => setIsMenuOpen(false)}
                  className="rounded-[16px] border border-[#EEF2F7] bg-[#F8FAFF] px-4 py-3.5 text-left text-[18px] font-black leading-none text-[#111827] transition hover:bg-[#EEF4FF] hover:text-[#306EEC] sm:rounded-[18px] sm:py-4 sm:text-[22px]"
                >
                  {item.label}
                </Link>
              ))}
            </div>

            <div className="flex w-full max-w-sm flex-col gap-3 rounded-[22px] border border-[#E6E8EF] bg-white p-3 shadow-[0_16px_50px_rgba(17,24,39,0.08)] sm:gap-4 sm:rounded-[24px] sm:p-4">
              {isAuthenticated ? (
                <>
                  <div className="mb-1 flex items-center justify-between gap-3 rounded-[18px] border border-[#E6E8EF] bg-[#F8FAFF] p-3 sm:mb-2 sm:rounded-[20px] sm:p-4">
                    <div className="flex items-center gap-3">
                      <div className="flex h-11 w-11 items-center justify-center rounded-full bg-[#C5CBD8] sm:h-14 sm:w-14">
                        <svg width="30" height="26" viewBox="0 0 31 28" fill="none" aria-hidden="true">
                          <path d="M15.5 14C18.5376 14 21 11.5376 21 8.5C21 5.46243 18.5376 3 15.5 3C12.4624 3 10 5.46243 10 8.5C10 11.5376 12.4624 14 15.5 14Z" fill="#EEF2FF" />
                          <path d="M15.5 16C9.70101 16 5 19.134 5 23C5 24.1046 5.89543 25 7 25H24C25.1046 25 26 24.1046 26 23C26 19.134 21.299 16 15.5 16Z" fill="#EEF2FF" />
                        </svg>
                      </div>
                      <div>
                        <p className="text-base font-semibold text-[#111827]">{accountLabel}</p>
                        <p className="text-sm text-[#6B7280]">My Account</p>
                      </div>
                    </div>
                  </div>
                  <Link
                    href={accountHref}
                    onClick={() => setIsMenuOpen(false)}
                    className="rounded-[16px] bg-[#0B1628] px-5 py-3.5 text-center text-[15px] font-black text-white transition hover:bg-[#172033] sm:px-6 sm:py-4 sm:text-base"
                  >
                    My Account
                  </Link>
                  <button
                    onClick={handleLogout}
                    className="rounded-[16px] border border-red-100 bg-red-50 px-5 py-3.5 text-[15px] font-black text-red-700 transition hover:bg-red-100 sm:px-6 sm:py-4 sm:text-base"
                  >
                    Log out
                  </button>
                </>
              ) : (
                <>
                  <Link
                    href="/signup?redirect=%2Fmembership"
                    onClick={() => setIsMenuOpen(false)}
                    className="w-full rounded-[16px] bg-[#306EEC] px-5 py-3.5 text-center text-[15px] font-bold text-white transition hover:bg-[#2558C9] sm:px-6 sm:py-4 sm:text-base"
                  >
                    Book Your First Visit Free
                  </Link>
                  <Link
                    href="/signin"
                    onClick={() => setIsMenuOpen(false)}
                    className="w-full rounded-[16px] border border-[#D7DEE9] bg-white px-5 py-3.5 text-center text-[15px] font-black text-[#0B1628] transition hover:bg-[#F8FAFF] sm:px-6 sm:py-4 sm:text-base"
                  >
                    Log In
                  </Link>
                </>
              )}
            </div>
          </nav>
        </div>
      </div>
    </header>
  );
}
