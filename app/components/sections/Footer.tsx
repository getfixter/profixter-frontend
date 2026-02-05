"use client";

import Image from "next/image";
import Link from "next/link";
import { useEffect, useState } from "react";

export default function Footer() {
  const [formData, setFormData] = useState({
    firstName: "",
    lastName: "",
    email: "",
    phone: "",
  });

  const [showPopup, setShowPopup] = useState(false);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setFormData((p) => ({
      ...p,
      [e.target.name]: e.target.value,
    }));
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    console.log("Contact request:", formData);

    setShowPopup(true);

    setFormData({
      firstName: "",
      lastName: "",
      email: "",
      phone: "",
    });

    setTimeout(() => setShowPopup(false), 5000);
  };

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setShowPopup(false);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  return (
    <footer id="contact-us" className="relative overflow-hidden">
      {/* Background */}
      <div className="absolute inset-0">
        <Image
          src="/images/footer-bg.png"
          alt="Footer background"
          fill
          className="object-cover"
          priority={false}
        />
        {/* Dark overlay */}
        <div className="absolute inset-0 bg-black/60" />
        {/* Vignette */}
        <div className="absolute inset-0 bg-gradient-to-b from-black/20 via-transparent to-black/45" />
      </div>

      {/* Content */}
      <div className="relative mx-auto max-w-[1240px] px-5 sm:px-6 lg:px-5 py-10 sm:py-12 lg:py-14">
        {/* ✅ Desktop “panel” to make it look premium + aligned */}
        <div className="lg:rounded-[26px] lg:border lg:border-white/10 lg:bg-black/25 lg:backdrop-blur-md lg:p-10">
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 lg:gap-10 items-start">
            {/* Left: logo + copy */}
            <div className="lg:col-span-7">
              <div className="flex flex-col sm:flex-row sm:items-start gap-5 sm:gap-7">
                <div className="shrink-0">
                  <Image
                    src="/images/logo-footer.svg"
                    alt="Profixter"
                    width={320}
                    height={70}
                    className="w-[240px] sm:w-[300px] lg:w-[320px] h-auto"
                  />
                </div>

                <p className="text-[#C5CBD8] text-sm sm:text-base leading-relaxed max-w-[560px] sm:pt-1">
                  Our goal is to make home repairs and maintenance hassle-free, so
                  you can focus on what matters most.
                </p>
              </div>

              {/* Optional contact form (kept logic; still hidden) */}
              {/* <form onSubmit={handleSubmit} className="mt-6 max-w-[520px]">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <input
                    name="firstName"
                    value={formData.firstName}
                    onChange={handleChange}
                    placeholder="First name"
                    className="h-11 rounded-xl px-4 bg-white/10 border border-white/15 text-white placeholder-white/50 outline-none focus:ring-4 focus:ring-[#306EEC]/20"
                  />
                  <input
                    name="lastName"
                    value={formData.lastName}
                    onChange={handleChange}
                    placeholder="Last name"
                    className="h-11 rounded-xl px-4 bg-white/10 border border-white/15 text-white placeholder-white/50 outline-none focus:ring-4 focus:ring-[#306EEC]/20"
                  />
                  <input
                    name="email"
                    value={formData.email}
                    onChange={handleChange}
                    placeholder="Email"
                    className="h-11 rounded-xl px-4 bg-white/10 border border-white/15 text-white placeholder-white/50 outline-none focus:ring-4 focus:ring-[#306EEC]/20"
                  />
                  <input
                    name="phone"
                    value={formData.phone}
                    onChange={handleChange}
                    placeholder="Phone"
                    className="h-11 rounded-xl px-4 bg-white/10 border border-white/15 text-white placeholder-white/50 outline-none focus:ring-4 focus:ring-[#306EEC]/20"
                  />
                </div>
                <button
                  type="submit"
                  className="mt-3 h-11 px-5 rounded-xl bg-[#306EEC] text-white font-semibold hover:bg-[#2558c9] transition active:scale-[0.99]"
                >
                  Send
                </button>
              </form> */}
            </div>

            {/* Middle: nav */}
            <div className="lg:col-span-3 lg:justify-self-end lg:pr-2">
              <div className="text-white font-semibold mb-3">Explore</div>

              {/* 2-column on mobile, 1-column on sm+, right-aligned on lg */}
              <nav className="grid grid-cols-2 sm:grid-cols-1 gap-y-3 gap-x-6 lg:text-right">
                <Link href="#how-it-works" className="text-[#EEF2FF] hover:text-[#306EEC] transition-colors">
                  How it works
                </Link>
                <Link href="#plans" className="text-[#EEF2FF] hover:text-[#306EEC] transition-colors">
                  Plans
                </Link>
                <Link href="#pick-day" className="text-[#EEF2FF] hover:text-[#306EEC] transition-colors">
                  Pick day
                </Link>
                <Link href="#projects" className="text-[#EEF2FF] hover:text-[#306EEC] transition-colors">
                  Projects
                </Link>
                <Link href="/partnerships" className="text-[#EEF2FF] hover:text-[#306EEC] transition-colors">
                  Partnerships
                </Link>
                <Link href="/careers" className="text-[#EEF2FF] hover:text-[#306EEC] transition-colors">
                  Careers
                </Link>
              </nav>
            </div>

            {/* Right: contact card */}
            <div className="lg:col-span-2 lg:justify-self-end">
              <div className="rounded-[18px] border border-white/15 bg-white/10 backdrop-blur-md p-5 sm:p-6 shadow-[0_20px_80px_rgba(0,0,0,0.35)]">
                <h3 className="text-[20px] sm:text-[22px] font-extrabold text-[#306EEC]">
                  Get in Touch
                </h3>

                <div className="mt-4 space-y-3 text-sm sm:text-base">
                  <Link
                    href="https://instagram.com/mrfixter.ny"
                    target="_blank"
                    className="block text-[#C5CBD8] hover:text-[#306EEC] transition-colors"
                  >
                    Instagram: <span className="font-semibold">mrfixter.ny</span>
                  </Link>

                  <Link
                    href="mailto:my@profixter.com"
                    className="block text-[#C5CBD8] hover:text-[#306EEC] transition-colors"
                  >
                    <span className="font-semibold">my@profixter.com</span>
                  </Link>
                </div>

                <div className="mt-5 pt-4 border-t border-white/15">
                  <div className="flex flex-wrap gap-x-2 gap-y-2 text-sm">
                    <Link
                      href="/privacy"
                      className="text-[#93c5fd] underline underline-offset-2 hover:text-white transition"
                    >
                      Privacy Policy
                    </Link>
                    <span className="text-white/25">|</span>
                    <Link
                      href="/terms"
                      className="text-[#93c5fd] underline underline-offset-2 hover:text-white transition"
                    >
                      Terms of Service
                    </Link>
                  </div>

                  <div className="mt-3 text-xs text-white/50 leading-relaxed">
                    Serving Suffolk & Nassau. Licensed & insured.
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Bottom strip */}
          <div className="mt-10 pt-6 border-t border-white/10 flex flex-col sm:flex-row gap-2 sm:gap-4 items-center justify-between">
            <p className="text-[#6A6D71] text-sm">© 2025 All rights reserved.</p>
            <p className="text-[#6A6D71] text-sm">License HI-71484 • Insured</p>
          </div>
        </div>
      </div>

      {/* Popup */}
      {showPopup && (
        <div className="fixed left-1/2 -translate-x-1/2 bottom-5 sm:left-auto sm:translate-x-0 sm:right-6 sm:bottom-6 z-[999999] w-[92vw] sm:w-[380px]">
          <div className="bg-white text-[#111827] p-4 rounded-[16px] shadow-2xl border border-black/10">
            <div className="flex items-start gap-3">
              <div className="text-2xl">✅</div>
              <div className="flex-1">
                <p className="font-extrabold">Thank you for contacting ProFixter!</p>
                <p className="text-sm mt-1">
                  We received your request. Our team will call you shortly from
                  <span className="font-semibold"> 631-599-1363</span>.
                </p>
              </div>
              <button
                type="button"
                onClick={() => setShowPopup(false)}
                className="ml-2 rounded-full w-9 h-9 grid place-items-center hover:bg-black/5 transition"
                aria-label="Close"
              >
                ✕
              </button>
            </div>
          </div>
        </div>
      )}
    </footer>
  );
}
