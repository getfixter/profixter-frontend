"use client";

import Image from "next/image";
import Link from "next/link";
import { useEffect, useState } from "react";

export default function Footer() {
  const [formData, setFormData] = useState({
    name: "",
    email: "",
    phone: "",
    smsMarketingConsent: false,
    smsServiceConsent: false,
  });

  const [showPopup, setShowPopup] = useState(false);
  const [error, setError] = useState("");

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value, type, checked } = e.target;

    setFormData((p) => ({
      ...p,
      [name]: type === "checkbox" ? checked : value,
    }));
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setError("");

    const phoneDigits = formData.phone.replace(/\D/g, "");

    if (!formData.name.trim() || !formData.email.trim() || !phoneDigits) {
      setError("Please fill in your name, email, and phone number.");
      return;
    }

    if (phoneDigits.length !== 10) {
      setError("Phone number must be 10 digits.");
      return;
    }

    console.log("Contact request:", {
      ...formData,
      consentSource: "website_contact_footer",
      consentAt: new Date().toISOString(),
    });

    setShowPopup(true);

    setFormData({
      name: "",
      email: "",
      phone: "",
      smsMarketingConsent: false,
      smsServiceConsent: false,
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
      <div className="absolute inset-0">
        <Image
          src="/images/footer-bg.png"
          alt="Footer background"
          fill
          className="object-cover"
          priority={false}
        />
        <div className="absolute inset-0 bg-black/55" />
        <div className="absolute inset-0 bg-gradient-to-b from-black/10 via-transparent to-black/30" />
      </div>

      <div className="relative mx-auto max-w-[1240px] px-5 sm:px-6 lg:px-5 py-10 sm:py-12 lg:py-14">
        <div className="mb-10 sm:mb-12 lg:mb-14">
          <div className="rounded-[24px] border border-white/15 bg-white/10 backdrop-blur-md p-5 sm:p-7 lg:p-8 shadow-[0_20px_80px_rgba(0,0,0,0.35)]">
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 lg:gap-10 items-start">
              <div className="lg:col-span-5">
                <div className="inline-flex items-center rounded-full border border-[#306EEC]/40 bg-[#306EEC]/15 px-3 py-1 text-xs sm:text-sm font-medium text-[#B9D2FF]">
                  Contact us
                </div>

                <h2 className="mt-4 text-white text-[28px] sm:text-[34px] lg:text-[40px] font-extrabold leading-tight">
                  Tell us what you need.
                  <br />
                  We’ll reach out shortly.
                </h2>

                <p className="mt-4 text-[#C5CBD8] text-sm sm:text-base leading-relaxed max-w-[520px]">
                  Leave your name, email, and phone number and our team will
                  follow up about handyman services, scheduling, and next steps.
                </p>

                <div className="mt-5 text-xs sm:text-sm text-white/55 leading-relaxed max-w-[560px]">
                  By submitting this form, you agree that Premium Island Homes
                  INC (Profixter) may contact you regarding your inquiry. SMS
                  consent is optional and not required to submit this form.
                </div>
              </div>

              <div className="lg:col-span-7">
                <form onSubmit={handleSubmit} className="space-y-5">
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    <input
                      type="text"
                      name="name"
                      value={formData.name}
                      onChange={handleChange}
                      placeholder="Full name"
                      aria-label="Full name"
                      className="w-full rounded-[14px] border border-white/15 bg-white/10 px-4 py-3 text-white placeholder:text-white/40 outline-none focus:border-[#306EEC] focus:bg-white/12 transition"
                      required
                    />

                    <input
                      type="email"
                      name="email"
                      value={formData.email}
                      onChange={handleChange}
                      placeholder="Email address"
                      aria-label="Email address"
                      className="w-full rounded-[14px] border border-white/15 bg-white/10 px-4 py-3 text-white placeholder:text-white/40 outline-none focus:border-[#306EEC] focus:bg-white/12 transition"
                      required
                    />

                    <input
                      type="tel"
                      name="phone"
                      value={formData.phone}
                      onChange={handleChange}
                      placeholder="Phone number"
                      aria-label="Phone number"
                      className="w-full rounded-[14px] border border-white/15 bg-white/10 px-4 py-3 text-white placeholder:text-white/40 outline-none focus:border-[#306EEC] focus:bg-white/12 transition"
                      required
                    />
                  </div>

                  <div className="rounded-[18px] border border-white/10 bg-black/15 p-4 sm:p-5 space-y-4">
                    <label className="flex items-start gap-3 cursor-pointer">
                      <input
                        type="checkbox"
                        name="smsMarketingConsent"
                        checked={formData.smsMarketingConsent}
                        onChange={handleChange}
                        className="mt-1 h-4 w-4 rounded border-white/30 bg-transparent accent-[#306EEC]"
                      />
                      <span className="text-white/90 text-sm leading-relaxed">
                        I agree to receive marketing text messages from Premium
                        Island Homes INC (Profixter), including promotional
                        offers and service-related updates. Consent is not
                        required to purchase. Message frequency may vary. Msg &
                        data rates may apply. Reply HELP for help or STOP to opt
                        out.
                      </span>
                    </label>

                    <label className="flex items-start gap-3 cursor-pointer">
                      <input
                        type="checkbox"
                        name="smsServiceConsent"
                        checked={formData.smsServiceConsent}
                        onChange={handleChange}
                        className="mt-1 h-4 w-4 rounded border-white/30 bg-transparent accent-[#306EEC]"
                      />
                      <span className="text-white/90 text-sm leading-relaxed">
                        I agree to receive non-marketing text messages from
                        Premium Island Homes INC (Profixter) related to my
                        inquiry, scheduling, appointment reminders, service
                        updates, and customer support. Consent is not required
                        to purchase. Message frequency may vary. Msg & data
                        rates may apply. Reply HELP for help or STOP to opt out.
                      </span>
                    </label>

                    <div className="text-xs text-white/50 leading-relaxed">
                      Your information is handled according to our{" "}
                      <Link
                        href="/privacy"
                        className="underline underline-offset-2 hover:text-white transition"
                      >
                        Privacy Policy
                      </Link>{" "}
                      and{" "}
                      <Link
                        href="/terms"
                        className="underline underline-offset-2 hover:text-white transition"
                      >
                        Terms of Service
                      </Link>
                      .
                    </div>

                    <div className="text-xs text-white/40 leading-relaxed">
                      Premium Island Homes INC operates as Profixter.
                    </div>
                  </div>

                  {error && (
                    <div className="text-red-300 text-sm bg-red-500/10 border border-red-500/20 rounded-[14px] px-4 py-3">
                      {error}
                    </div>
                  )}

                  <div className="flex flex-col sm:flex-row sm:items-center gap-3">
                    <button
                      type="submit"
                      className="inline-flex items-center justify-center rounded-[14px] bg-[#306EEC] px-6 py-3.5 text-white font-semibold hover:bg-[#2557C7] transition shadow-[0_10px_30px_rgba(48,110,236,0.35)]"
                    >
                      Request a Call Back
                    </button>

                    <div className="text-sm text-white/55">
                      Fast response for Suffolk & Nassau homeowners.
                    </div>
                  </div>
                </form>
              </div>
            </div>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 lg:gap-10">
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
                Our goal is to make home repairs and maintenance hassle-free
                with unlimited handyman visits under one subscription, so you
                can focus on what matters most.
              </p>
            </div>
          </div>

          <div className="lg:col-span-3">
            <div className="text-white font-semibold mb-3">Explore</div>

            <nav className="grid grid-cols-2 sm:grid-cols-1 gap-y-3 gap-x-6 lg:text-right">
              <button
                type="button"
                onClick={() => scrollToHash("#how-it-works")}
                className="text-left text-[#EEF2FF] hover:text-[#306EEC] transition-colors"
              >
                How it works
              </button>

              <button
                type="button"
                onClick={() => scrollToHash("#plans")}
                className="text-left text-[#EEF2FF] hover:text-[#306EEC] transition-colors"
              >
                Plans
              </button>

              <button
                type="button"
                onClick={() => scrollToHash("#pick-day")}
                className="text-left text-[#EEF2FF] hover:text-[#306EEC] transition-colors"
              >
                Pick day
              </button>

              <button
                type="button"
                onClick={() => scrollToHash("#projects")}
                className="text-left text-[#EEF2FF] hover:text-[#306EEC] transition-colors"
              >
                Projects
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

          <div className="lg:col-span-2">
            <div className="rounded-[18px] border border-white/15 bg-white/10 backdrop-blur-md p-5 sm:p-6 shadow-[0_20px_80px_rgba(0,0,0,0.35)] max-w-full overflow-hidden">
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

                <div className="mt-3 text-xs text-white/50 leading-relaxed">
                  Serving Suffolk & Nassau. Licensed & insured.
                </div>
              </div>
            </div>
          </div>
        </div>

        <div className="mt-10 pt-6 border-t border-white/10 flex flex-col sm:flex-row gap-2 sm:gap-4 items-center justify-between">
          <p className="text-[#6A6D71] text-sm">© 2025 All rights reserved.</p>
          <p className="text-[#6A6D71] text-sm">License HI-71484 • Insured</p>
        </div>
      </div>

      {showPopup && (
        <div className="fixed left-1/2 -translate-x-1/2 bottom-5 sm:left-auto sm:translate-x-0 sm:right-6 sm:bottom-6 z-[999999] w-[92vw] sm:w-[380px]">
          <div className="bg-white text-[#111827] p-4 rounded-[16px] shadow-2xl border border-black/10">
            <div className="flex items-start gap-3">
              <div className="text-2xl">✅</div>
              <div className="flex-1">
                <p className="font-extrabold">Thank you for contacting ProFixter!</p>
                <p className="text-sm mt-1">
                  We received your request. Our team will contact you shortly.
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