"use client";

import Link from "next/link";
import Image from "next/image";
import { useEffect, useMemo, useRef, useState } from "react";
import { useAuth } from "@/lib/useAuth";
import { useRouter } from "next/navigation";

export default function Header() {
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const [isProfileMenuOpen, setIsProfileMenuOpen] = useState(false);

  const { user, isAuthenticated, logout } = useAuth();
  const profileMenuRef = useRef<HTMLDivElement>(null);
  const router = useRouter();

  const firstName = useMemo(() => user?.name?.split(" ")[0] || "User", [user?.name]);
  const navItems = useMemo(
    () => [
      { href: "/membership-info", label: "Membership" },
      { href: "/communities", label: "Communities" },
      { href: "/roofing", label: "Roofing" },
      { href: "/siding", label: "Siding" },
      ...(isAuthenticated ? [{ href: "/account", label: "Account" }] : []),
    ],
    [isAuthenticated]
  );

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

  const handleLogout = () => {
    logout();
    setIsProfileMenuOpen(false);
    setIsMenuOpen(false);
    router.push("/");
  };

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setIsMenuOpen(false);
    };

    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  return (
    <header className="relative z-50 w-full py-[14px]">
      <div className="mx-3 rounded-[18px] border border-white/30 bg-white/75 shadow-[0_10px_60px_rgba(0,0,0,0.18)] backdrop-blur-md sm:mx-5">
        <div className="mx-auto flex max-w-[1240px] items-center justify-between px-[14px] py-[10px] sm:px-[18px]">
          <Link href="/" className="relative z-50 flex items-center">
            <Image src="/images/logo.svg" alt="Profixter Long Island" width={80} height={32} priority className="brightness-0" />
          </Link>

          <nav className="hidden items-center gap-7 lg:flex">
            {navItems.map((item) => (
              <Link
                key={item.href}
                href={item.href}
                className="group relative pb-2 text-[15px] font-medium text-[#111827] transition-colors hover:text-[#306EEC]"
              >
                {item.label}
                <span className="absolute -bottom-1 left-0 h-0.5 w-full origin-left scale-x-0 bg-[#306EEC] transition-transform duration-300 group-hover:scale-x-100" />
              </Link>
            ))}
          </nav>

          <div className="hidden items-center gap-4 lg:flex">
            {isAuthenticated ? (
              <div className="relative" ref={profileMenuRef}>
                <button
                  onClick={() => setIsProfileMenuOpen((v) => !v)}
                  className="flex items-center gap-3 transition-opacity hover:opacity-90"
                  aria-label="Open profile menu"
                >
                  <span className="text-base text-[#111827]">{firstName}</span>
                  <div className="flex h-11 w-11 items-center justify-center rounded-full border border-white/40 bg-[#C5CBD8]">
                    <svg width="31" height="28" viewBox="0 0 31 28" fill="none">
                      <path
                        d="M15.5 14C18.5376 14 21 11.5376 21 8.5C21 5.46243 18.5376 3 15.5 3C12.4624 3 10 5.46243 10 8.5C10 11.5376 12.4624 14 15.5 14Z"
                        fill="#EEF2FF"
                      />
                      <path
                        d="M15.5 16C9.70101 16 5 19.134 5 23C5 24.1046 5.89543 25 7 25H24C25.1046 25 26 24.1046 26 23C26 19.134 21.299 16 15.5 16Z"
                        fill="#EEF2FF"
                      />
                    </svg>
                  </div>
                </button>

                {isProfileMenuOpen && (
                  <div className="absolute right-0 top-full z-50 mt-2 w-56 rounded-[14px] border border-[#E6E8EF] bg-white py-2 shadow-lg">
                    <Link
                      href="/account"
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
              <Link
                href="/signin"
                className="rounded-[14px] border border-[#C5CBD8] bg-white/90 px-5 py-3 text-base font-bold text-[#111827] transition hover:bg-white"
              >
                Register / Login
              </Link>
            )}
          </div>

          <button
            onClick={() => setIsMenuOpen((v) => !v)}
            className="relative z-[70] flex h-10 w-10 flex-col items-center justify-center gap-1.5 lg:hidden"
            aria-label={isMenuOpen ? "Close menu" : "Open menu"}
            aria-expanded={isMenuOpen}
          >
            <span
              className={`h-0.5 w-6 bg-[#111827] transition-all duration-300 ${
                isMenuOpen ? "translate-y-2 rotate-45" : ""
              }`}
            />
            <span className={`h-0.5 w-6 bg-[#111827] transition-all duration-300 ${isMenuOpen ? "opacity-0" : ""}`} />
            <span
              className={`h-0.5 w-6 bg-[#111827] transition-all duration-300 ${
                isMenuOpen ? "-translate-y-2 -rotate-45" : ""
              }`}
            />
          </button>
        </div>
      </div>

      <div className="flex items-center justify-center gap-5 px-4 pt-2.5">
        <div className="inline-flex items-center gap-2 rounded-full border border-[#D9E4FF] bg-white/80 px-4 py-1.5 shadow-sm">
          <span className="h-1.5 w-1.5 rounded-full bg-[#86EFAC] flex-shrink-0" style={{ boxShadow: "0 0 6px rgba(134,239,172,0.9)" }} />
          <span className="text-[11px] font-semibold uppercase tracking-[0.18em] text-[#306EEC]">
            Based in Babylon · Serving Nassau & Suffolk Counties
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
          className="absolute right-5 top-14 z-[80] flex h-10 w-10 items-center justify-center rounded-full border border-[#E6E8EF] bg-white/95 text-[#111827] shadow-[0_10px_30px_rgba(17,24,39,0.15)] transition hover:bg-[#F6F7FB]"
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
          <nav className="flex min-h-[100svh] flex-col items-center justify-start gap-8 px-6 pb-10 pt-24">
            <div className="flex w-full max-w-sm flex-col gap-4 rounded-[24px] border border-[#E6E8EF] bg-white p-4 shadow-[0_16px_50px_rgba(17,24,39,0.08)]">
              {isAuthenticated ? (
                <>
                  <div className="mb-2 flex items-center justify-between gap-3 rounded-[20px] border border-[#E6E8EF] bg-[#F8FAFF] p-4">
                    <div className="flex items-center gap-3">
                      <div className="flex h-14 w-14 items-center justify-center rounded-full bg-[#C5CBD8]">
                        <svg width="30" height="26" viewBox="0 0 31 28" fill="none">
                          <path
                            d="M15.5 14C18.5376 14 21 11.5376 21 8.5C21 5.46243 18.5376 3 15.5 3C12.4624 3 10 5.46243 10 8.5C10 11.5376 12.4624 14 15.5 14Z"
                            fill="#EEF2FF"
                          />
                          <path
                            d="M15.5 16C9.70101 16 5 19.134 5 23C5 24.1046 5.89543 25 7 25H24C25.1046 25 26 24.1046 26 23C26 19.134 21.299 16 15.5 16Z"
                            fill="#EEF2FF"
                          />
                        </svg>
                      </div>
                      <div>
                        <p className="text-base font-semibold text-[#111827]">{firstName}</p>
                        <p className="text-sm text-[#6B7280]">Member dashboard</p>
                      </div>
                    </div>
                  </div>
                  <button
                    onClick={handleLogout}
                    className="rounded-[16px] bg-red-600 px-6 py-4 text-base font-medium text-white transition hover:bg-red-700"
                  >
                    Log out
                  </button>
                </>
              ) : (
                <Link
                  href="/signin"
                  onClick={() => setIsMenuOpen(false)}
                  className="w-full rounded-[16px] border border-[#C5CBD8] bg-white px-6 py-4 text-center text-base font-medium text-[#111827] transition hover:bg-[#F8FAFF]"
                >
                  Register / Login
                </Link>
              )}
            </div>

            <div className="flex w-full max-w-sm flex-col gap-2 rounded-[24px] border border-[#E6E8EF] bg-white p-4 shadow-[0_16px_50px_rgba(17,24,39,0.08)]">
              {navItems.map((item) => (
                <Link
                  key={item.href}
                  href={item.href}
                  onClick={() => setIsMenuOpen(false)}
                  className="rounded-[16px] px-4 py-4 text-left text-[24px] font-medium text-[#111827] transition hover:bg-[#F4F7FF] hover:text-[#306EEC]"
                >
                  {item.label}
                </Link>
              ))}
            </div>
          </nav>
        </div>
      </div>
    </header>
  );
}
