"use client";

import Link from "next/link";
import Image from "next/image";
import { useEffect, useMemo, useRef, useState } from "react";
import { useAuth } from "@/lib/useAuth";
import { useRouter } from "next/navigation";

// Navigation items for the header. We replaced the old anchor links with
// dedicated pages and meaningful anchors that match the new site structure.
const NAV = [
  // Dedicated subscription plan page where visitors can compare memberships
  // One‑time service booking page
  { href: "/on-demand", label: "On Demand" },
  // Service categories. These pages explain each department in detail
  { href: "/services/subscription", label: "Subscription" },
  { href: "/services/general-contractor", label: "General Contractor" },
  { href: "/services/home-improvement", label: "Home Improvement" },
  // Anchored sections on the home page for social proof and contact
  { href: "#testimonials", label: "Testimonials" },
  { href: "#contact-us", label: "Contact" },
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

  // ✅ offset scroll so anchors never hide under the sticky header
  const scrollToHash = (hash: string) => {
    const id = hash.replace("#", "");
    const el = document.getElementById(id);
    if (!el) return;

    const HEADER_OFFSET = window.innerWidth >= 1024 ? 120 : 100;

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

  // Esc closes mobile menu
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setIsMenuOpen(false);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  return (
    <header className="w-full py-[14px] relative z-50">
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
        {/* Close Button (moved down a bit so it doesn’t block sign buttons) */}
        <button
          onClick={() => setIsMenuOpen(false)}
          aria-label="Close menu"
          className="absolute top-14 right-5 w-10 h-10 rounded-full bg-white/95 border border-[#E6E8EF] shadow-[0_10px_30px_rgba(17,24,39,0.15)] flex items-center justify-center text-[#111827] text-xl font-semibold z-[80] hover:bg-[#F6F7FB] transition"
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
            {/* Mobile sign in / sign up at top */}
            {!isAuthenticated && (
              <div className="flex flex-col gap-3 w-full max-w-xs">
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
              </div>
            )}

            {/* Navigation items */}
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
            {/* Auth buttons or profile at bottom */}
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
              ) : null}
            </div>
          </nav>
        </div>
      </div>
    </header>
  );
}
