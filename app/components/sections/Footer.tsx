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

  const scrollToHash = (hash: string) => {
    const id = hash.replace("#", "");
    const el = document.getElementById(id);
    if (!el) return;

    const HEADER_OFFSET = window.innerWidth >= 1024 ? 180 : 140;
    const y = el.getBoundingClientRect().top + window.scrollY - HEADER_OFFSET;

    window.scrollTo({ top: y, behavior: "smooth" });
    history.replaceState(null, "", hash);
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
        <div className="absolute inset-0 bg-black/65" />
        <div className="absolute inset-0 bg-gradient-to-b from-black/20 via-black/10 to-black/40" />
      </div>

      {/* Content */}
      <div className="relative mx-auto max-w-[1240px] px-5 sm:px-6 lg:px-5 py-10 sm:py-12 lg:py-14">
        {/* TOP SECTION */}
        <div className="grid grid-cols-1 xl:grid-cols-[1.35fr_0.7fr_0.95fr] gap-8 lg:gap-10 items-start">
          {/* LEFT */}
          <div className="min-w-0">
            <div className="flex flex-col gap-5">
              <div className="shrink-0">
                <Image
                  src="/images/logo-footer.svg"
                  alt="Profixter"
                  width={320}
                  height={70}
                  className="w-[220px] sm:w-[280px] lg:w-[320px] h-auto"
                />
              </div>

              <p className="text-[#D6DBE5] text-sm sm:text-base leading-relaxed max-w-[640px]">
                Our goal is to make home repairs and maintenance hassle-free with
                unlimited handyman visits under one subscription, so you can stop
                chasing contractors and keep your home handled.
              </p>
            </div>
          </div>

          {/* MIDDLE */}
          <div className="min-w-0">
            <div className="text-white font-semibold mb-4 text-base">Explore</div>

            <nav className="grid grid-cols-2 gap-x-8 gap-y-3 sm:max-w-[320px] xl:max-w-none">
              <Link
                href="/services/subscription"
                className="text-[#EEF2FF] hover:text-[#306EEC] transition-colors"
              >
                Subscription
              </Link>

              <Link
                href="/on-demand"
                className="text-[#EEF2FF] hover:text-[#306EEC] transition-colors"
              >
                On Demand
              </Link>

              <button
                type="button"
                onClick={() => scrollToHash("#departments")}
                className="text-left text-[#EEF2FF] hover:text-[#306EEC] transition-colors"
              >
                Services
              </button>

              <button
                type="button"
                onClick={() => scrollToHash("#testimonials")}
                className="text-left text-[#EEF2FF] hover:text-[#306EEC] transition-colors"
              >
                Testimonials
              </button>

              <Link
                href="/partnerships"
                className="text-[#EEF2FF] hover:text-[#306EEC] transition-colors"
              >
                Partnerships
              </Link>

              <Link
                href="/careers"
                className="text-[#EEF2FF] hover:text-[#306EEC] transition-colors"
              >
                Careers
              </Link>
            </nav>
          </div>

          {/* RIGHT */}
          <div className="min-w-0">
            <div className="rounded-[22px] border border-white/15 bg-white/10 backdrop-blur-md p-5 sm:p-6 shadow-[0_20px_80px_rgba(0,0,0,0.35)] w-full max-w-[360px] xl:ml-auto">
              <h3 className="text-[20px] sm:text-[22px] font-extrabold text-[#306EEC]">
                Get in Touch
              </h3>

              <div className="mt-4 space-y-3 text-sm sm:text-base">
                <Link
                  href="https://instagram.com/mrfixter.ny"
                  target="_blank"
                  className="block text-[#93c5fd] underline underline-offset-2 hover:text-white transition break-words"
                >
                  Instagram: <span className="font-semibold">mrfixter.ny</span>
                </Link>

                <Link
                  href="mailto:my@profixter.com"
                  className="block text-[#93c5fd] underline underline-offset-2 hover:text-white transition break-all"
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

                <div className="mt-3 text-sm text-white/75 leading-relaxed">
                  Have a question? Most answers are here{" "}
                  <Link
                    href="/included"
                    className="text-[#93c5fd] underline underline-offset-2 hover:text-white transition"
                  >
                    → What can I book?
                  </Link>
                </div>

                <div className="mt-3 text-sm text-white/75 leading-relaxed">
                  Love the service? Tell a neighbor.
                </div>

                <div className="mt-3 text-xs text-white/55 leading-relaxed">
                  Serving Suffolk & Nassau. Licensed & insured.
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* BOTTOM STRIP */}
        <div className="mt-10 pt-6 border-t border-white/10 flex flex-col sm:flex-row gap-2 sm:gap-4 items-center justify-between">
          <p className="text-[#7C8596] text-sm">© 2025 All rights reserved.</p>
          <p className="text-[#7C8596] text-sm">License HI-71484 • Insured</p>
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
