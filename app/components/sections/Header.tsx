"use client";

import Link from "next/link";
import Image from "next/image";
import { useEffect, useMemo, useRef, useState } from "react";
import { useAuth } from "@/lib/useAuth";
import { useRouter } from "next/navigation";

// Navigation items for the header.  Keeping the same anchors for familiarity.
const NAV = [
  { href: "#how-it-works", label: "How it works" },
  { href: "#plans", label: "Plans" },
  { href: "#pick-day", label: "Pick day" },
  { href: "#services", label: "Services" },
  { href: "#recommended-pros", label: "Trusted Pros" },
  { href: "#projects", label: "Projects" },
  { href: "#contact-us", label: "Contact us" },
];

export default function Header() {
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const [isProfileMenuOpen, setIsProfileMenuOpen] = useState(false);

  const { user, isAuthenticated, logout } = useAuth();
  const profileMenuRef = useRef<HTMLDivElement>(null);

  const router = useRouter();

  const firstName = useMemo(() => user?.name?.split(" ")[0] || "User", [user?.name]);

  // Close profile menu when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (profileMenuRef.current && !profileMenuRef.current.contains(event.target as Node)) {
        setIsProfileMenuOpen(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  // ✅ offset scroll so anchors never hide under sticky header/promo
  const scrollToHash = (hash: string) => {
    const id = hash.replace("#", "");
    const el = document.getElementById(id);
    if (!el) return;

    // header + promo strip combined
    const HEADER_OFFSET = window.innerWidth >= 1024 ? 180 : 140;

    const y = el.getBoundingClientRect().top + window.scrollY - HEADER_OFFSET;
    window.scrollTo({ top: y, behavior: "smooth" });
    history.replaceState(null, "", hash);
  };

  // Lock body scroll when mobile menu open (prevents iOS weirdness)
  useEffect(() => {
    if (isMenuOpen) document.body.style.overflow = "hidden";
    else document.body.style.overflow = "";
    return () => {
      document.body.style.overflow = "";
    };
  }, [isMenuOpen]);

  // Close mobile menu on route/hash change (helps on iOS + prevents “stuck open”)
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

  // ---------- SPRING promo countdown (35 days) ----------
  const PROMO_KEY = "pf_spring_promo_start_v1";
  const PROMO_DAYS = 35;

  const [promoLeft, setPromoLeft] = useState<{
    days: number;
    hours: number;
    minutes: number;
    seconds: number;
  } | null>(null);

  useEffect(() => {
    // store a stable start time (first visitor sets it)
    let start = Number(localStorage.getItem(PROMO_KEY) || "0");
    if (!start || !Number.isFinite(start)) {
      start = Date.now();
      localStorage.setItem(PROMO_KEY, String(start));
    }

    const end = start + PROMO_DAYS * 24 * 60 * 60 * 1000;

    const tick = () => {
      const ms = end - Date.now();
      if (ms <= 0) {
        setPromoLeft({ days: 0, hours: 0, minutes: 0, seconds: 0 });
        return;
      }
      const totalSec = Math.floor(ms / 1000);
      const days = Math.floor(totalSec / 86400);
      const hours = Math.floor((totalSec % 86400) / 3600);
      const minutes = Math.floor((totalSec % 3600) / 60);
      const seconds = totalSec % 60;
      setPromoLeft({ days, hours, minutes, seconds });
    };

    tick();
    const id = window.setInterval(tick, 1000);
    return () => window.clearInterval(id);
  }, []);

  // Esc closes mobile menu
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setIsMenuOpen(false);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  const promoActive =
    promoLeft && promoLeft.days + promoLeft.hours + promoLeft.minutes + promoLeft.seconds > 0;

  return (
    <header className="w-full py-[14px] relative z-50">
      {/* ✅ Promo strip ABOVE glass header */}
      <div className="mx-3 sm:mx-5 mb-3">
        <div className="rounded-[18px] border border-[#86EFAC]/30 bg-[#0B1220]/65 backdrop-blur-md shadow-[0_10px_50px_rgba(0,0,0,0.18)]">
          <div className="px-4 sm:px-6 py-3 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
            <div className="flex items-start gap-3">
              <div className="w-10 h-10 rounded-full bg-[#86EFAC]/20 border border-[#86EFAC]/25 flex items-center justify-center flex-shrink-0">
                <span className="text-[#86EFAC] text-lg">🎁</span>
              </div>

              <div>
                {/* Updated copy to emphasize unlimited visits and 30% discount */}
                <p className="text-white font-extrabold text-sm sm:text-base leading-tight">
                  Unlimited handyman visits (2+ per month) for Long Island homes.
                  <span className="ml-1 text-[#86EFAC] font-extrabold">30% OFF</span> your first month with code
                  <span className="ml-1 text-[#86EFAC] font-extrabold">SPRING</span>
                  <span className="hidden sm:inline text-white/70 font-semibold"> • Monthly plans only</span>
                </p>

                {promoActive && promoLeft ? (
                  <p className="mt-1 text-white/70 text-[12px] sm:text-[13px] font-semibold">
                    Ends in {" "}
                    <span className="text-[#86EFAC] font-extrabold">
                      {promoLeft.days}d {String(promoLeft.hours).padStart(2, "0")}:
                      {String(promoLeft.minutes).padStart(2, "0")}:{String(promoLeft.seconds).padStart(2, "0")}
                    </span>
                  </p>
                ) : null}

                {/* Sale points emphasising unlimited visits */}
                <div className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-[12px] sm:text-[13px] text-white/75">
                  <span className="inline-flex items-center gap-1.5">
                    <span className="text-[#86EFAC]">✓</span> Unlimited visits (2+ per month)
                  </span>
                  <span className="inline-flex items-center gap-1.5">
                    <span className="text-[#86EFAC]">✓</span> Cancel anytime
                  </span>
                  <span className="inline-flex items-center gap-1.5">
                    <span className="text-[#86EFAC]">✓</span> No contracts
                  </span>
                  <span className="inline-flex items-center gap-1.5">
                    <span className="text-[#86EFAC]">✓</span> Local Long Island pros
                  </span>
                  <span className="inline-flex items-center gap-1.5">
                    <span className="text-[#86EFAC]">✓</span> Personal handyman
                  </span>
                </div>
              </div>
            </div>

            <div className="flex items-center justify-between sm:justify-end gap-3">
              <div className="hidden md:flex items-center gap-2">
                <span className="px-3 py-1 rounded-full bg-white/10 border border-white/15 text-white/80 text-xs font-semibold">
                  Best value
                </span>
                <span className="px-3 py-1 rounded-full bg-[#86EFAC]/15 border border-[#86EFAC]/25 text-[#86EFAC] text-xs font-extrabold">
                  30% OFF
                </span>
              </div>

              <button
                type="button"
                onClick={() => scrollToHash("#pick-day")}
                className="shrink-0 px-4 sm:px-5 py-2.5 rounded-xl bg-[#86EFAC] text-[#0B1220] font-extrabold text-sm sm:text-base hover:opacity-90 transition active:scale-[0.99]"
              >
                Start First Visit
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Glass wrapper */}
      <div className="mx-3 sm:mx-5 rounded-[18px] border border-white/30 bg-white/75 backdrop-blur-md shadow-[0_10px_60px_rgba(0,0,0,0.18)]">
        <div className="mx-auto max-w-[1240px] px-[14px] sm:px-[18px] py-[10px] flex items-center justify-between">
          {/* Logo */}
          <Link href="/" className="flex items-center relative z-50">
            <Image src="/images/logo3.png" alt="Profixter Long Island" width={80} height={32} priority />
          </Link>

          {/* Desktop Navigation */}
          <nav className="hidden lg:flex items-center gap-7">
            {NAV.map((item) =>
              item.href.startsWith("#") ? (
                <button
                  key={item.href}
                  type="button"
                  onClick={() => scrollToHash(item.href)}
                  className="text-[#111827] hover:text-[#306EEC] transition-colors text-[15px] font-normal relative group pb-2"
                >
                  {item.label}
                  <span className="absolute -bottom-1 left-0 w-full h-0.5 bg-[#306eec] scale-x-0 group-hover:scale-x-100 transition-transform duration-300 origin-left" />
                </button>
              ) : (
                <Link
                  key={item.href}
                  href={item.href}
                  className="text-[#111827] hover:text-[#306EEC] transition-colors text-[15px] font-normal relative group pb-2"
                >
                  {item.label}
                  <span className="absolute -bottom-1 left-0 w-full h-0.5 bg-[#306eec] scale-x-0 group-hover:scale-x-100 transition-transform duration-300 origin-left" />
                </Link>
              )
            )}
          </nav>

          {/* Desktop Auth / Profile */}
          <div className="hidden lg:flex items-center gap-4">
            {isAuthenticated ? (
              <div className="relative" ref={profileMenuRef}>
                <button
                  onClick={() => setIsProfileMenuOpen((v) => !v)}
                  className="flex items-center gap-3 cursor-pointer hover:opacity-90 transition-opacity"
                  aria-label="Open profile menu"
                >
                  <span className="text-[#111827] text-base">{firstName}</span>
                  <div className="w-11 h-11 rounded-full bg-[#C5CBD8] flex items-center justify-center border border-white/40">
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
                  <div className="absolute right-0 top-full mt-2 w-56 bg-white border border-[#E6E8EF] rounded-[14px] shadow-lg py-2 z-50">
                    <Link
                      href="/account"
                      className="block px-4 py-3 text-base text-[#111827] hover:bg-[#EEF2FF] transition-colors"
                      onClick={() => setIsProfileMenuOpen(false)}
                    >
                      My Account
                    </Link>
                    <div className="border-t border-[#E6E8EF] my-2" />
                    <button
                      className="block w-full text-left px-4 py-3 text-base text-red-600 hover:bg-[#EEF2FF] transition-colors"
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
                  href="/signin"
                  className="px-6 py-3 text-[#111827] hover:text-[#306EEC] border border-[#111827] rounded-[14px] text-base font-normal transition-colors hover:bg-black/5"
                >
                  Sign in
                </Link>
                <Link
                  href="/signup"
                  className="px-8 py-3 bg-[#eef2ff] text-[#111827] rounded-[14px] text-base font-normal transition-colors hover:bg-white border border-[#C5CBD8]"
                >
                  Sign up
                </Link>
              </>
            )}
          </div>

          {/* Mobile Menu Button */}
          <button
            onClick={() => setIsMenuOpen((v) => !v)}
            className="lg:hidden relative z-[70] w-10 h-10 flex flex-col items-center justify-center gap-1.5"
            aria-label={isMenuOpen ? "Close menu" : "Open menu"}
            aria-expanded={isMenuOpen}
          >
            <span
              className={`w-6 h-0.5 bg-[#111827] transition-all duration-300 ${
                isMenuOpen ? "rotate-45 translate-y-2" : ""
              }`}
            />
            <span
              className={`w-6 h-0.5 bg-[#111827] transition-all duration-300 ${
                isMenuOpen ? "opacity-0" : ""
              }`}
            />
            <span
              className={`w-6 h-0.5 bg-[#111827] transition-all duration-300 ${
                isMenuOpen ? "-rotate-45 -translate-y-2" : ""
              }`}
            />
          </button>
        </div>
      </div>

      {/* Mobile Menu Overlay */}
      <div
        className={`lg:hidden fixed inset-0 z-[65] bg-white transition-all duration-300 overflow-y-auto
    pt-[env(safe-area-inset-top)]
    pb-[calc(env(safe-area-inset-bottom)+120px)]
    ${isMenuOpen ? "opacity-100 visible" : "opacity-0 invisible"}`}
        role="dialog"
        aria-modal="true"
        aria-label="Mobile navigation"
      >
        {/* Close Button (always visible) */}
        <button
          onClick={() => setIsMenuOpen(false)}
          aria-label="Close menu"
          className="absolute top-5 right-5 w-10 h-10 rounded-full bg-white/95 border border-[#E6E8EF] shadow-[0_10px_30px_rgba(17,24,39,0.15)] flex items-center justify-center text-[#111827] text-xl font-semibold z-[80] hover:bg-[#F6F7FB] transition"
        >
          ×
        </button>

        {/* Optional: tap outside content closes */}
        <button
          aria-label="Close menu background"
          className="absolute inset-0 w-full h-full cursor-default"
          onClick={() => setIsMenuOpen(false)}
        />

        {/* Content */}
        <div className="relative z-[75]">
          <nav
            className={[
              "flex flex-col items-center justify-start",
              "min-h-[100svh]",
              "gap-7 px-8 pt-24 pb-10",
            ].join(" ")}
          >
            {NAV.map((item) =>
              item.href.startsWith("#") ? (
                <button
                  key={item.href}
                  type="button"
                  onClick={() => {
                    setIsMenuOpen(false);
                    requestAnimationFrame(() => scrollToHash(item.href));
                  }}
                  className="text-[#111827] hover:text-[#306EEC] text-[28px] font-normal transition-colors"
                >
                  {item.label}
                </button>
              ) : (
                <Link
                  key={item.href}
                  href={item.href}
                  onClick={() => setIsMenuOpen(false)}
                  className="text-[#111827] hover:text-[#306EEC] text-[28px] font-normal transition-colors"
                >
                  {item.label}
                </Link>
              )
            )}

            {/* Promo inside mobile menu too */}
            <button
              type="button"
              onClick={() => {
                setIsMenuOpen(false);
                requestAnimationFrame(() => scrollToHash("#pick-day"));
              }}
              className="w-full max-w-xs rounded-[16px] border border-[#86EFAC]/25 bg-[#0B1220]/90 text-white px-4 py-3 text-left"
            >
              <div className="flex items-start gap-3">
                <div className="w-10 h-10 rounded-full bg-[#86EFAC]/20 border border-[#86EFAC]/25 flex items-center justify-center">
                  <span className="text-[#86EFAC] text-lg">🎁</span>
                </div>
                <div>
                  <p className="font-extrabold text-base leading-tight">
                    Unlimited visits (2+ per month)
                  </p>
                  <p className="text-white/75 text-sm mt-1">
                    30% off first month • Use code SPRING • Monthly plans only
                  </p>

                  {promoActive && promoLeft ? (
                    <p className="text-white/70 text-[12px] mt-1 font-semibold">
                      Ends in {" "}
                      <span className="text-[#86EFAC] font-extrabold">
                        {promoLeft.days}d {String(promoLeft.hours).padStart(2, "0")}: {String(promoLeft.minutes).padStart(2, "0")}: {String(promoLeft.seconds).padStart(2, "0")}
                      </span>
                    </p>
                  ) : null}
                </div>
              </div>
            </button>

            <div className="flex flex-col gap-4 mt-1 w-full max-w-xs">
              {isAuthenticated ? (
                <>
                  <div className="flex items-center justify-center gap-3 mb-2">
                    <div className="w-16 h-16 rounded-full bg-[#C5CBD8] flex items-center justify-center">
                      <svg width="40" height="36" viewBox="0 0 31 28" fill="none">
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
                    <span className="text-[#111827] text-xl font-medium">{firstName}</span>
                  </div>

                  <Link
                    href="/account"
                    onClick={() => setIsMenuOpen(false)}
                    className="w-full text-center px-6 py-3 text-[#111827] hover:text-[#306EEC] border border-[#111827] rounded-[14px] text-base font-normal transition-colors hover:bg-black/5"
                  >
                    My Account
                  </Link>

                  <button
                    onClick={handleLogout}
                    className="w-full text-center px-8 py-3 bg-red-600 text-white rounded-[14px] text-base font-normal transition-colors hover:bg-red-700"
                  >
                    Log out
                  </button>
                </>
              ) : (
                <>
                  <Link
                    href="/signin"
                    onClick={() => setIsMenuOpen(false)}
                    className="w-full text-center px-6 py-3 text-[#111827] hover:text-[#306EEC] border border-[#111827] rounded-[14px] text-base font-normal transition-colors hover:bg-black/5"
                  >
                    Sign in
                  </Link>
                  <Link
                    href="/signup"
                    onClick={() => setIsMenuOpen(false)}
                    className="w-full text-center px-8 py-3 bg-[#eef2ff] text-[#111827] rounded-[14px] text-base font-normal transition-colors hover:bg-white border border-[#C5CBD8]"
                  >
                    Sign up
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