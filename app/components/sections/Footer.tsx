"use client";

import Image from "next/image";
import Link from "next/link";
import { useState } from "react";

export default function Footer() {
  const [formData, setFormData] = useState({
    firstName: "",
    lastName: "",
    email: "",
    phone: "",
  });

  const [showPopup, setShowPopup] = useState(false);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setFormData({
      ...formData,
      [e.target.name]: e.target.value,
    });
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();

    // Here later you can connect real API
    console.log("Contact request:", formData);

    setShowPopup(true);

    // Reset form
    setFormData({
      firstName: "",
      lastName: "",
      email: "",
      phone: "",
    });

    setTimeout(() => {
      setShowPopup(false);
    }, 5000);
  };

  return (
    <footer
      id="contact-us"
      className="relative min-h-[350px] sm:min-h-[400px] lg:h-[437px] overflow-hidden"
    >
      {/* Background Image */}
      <div className="absolute inset-0">
        <Image
          src="/images/footer-bg.png"
          alt="Footer background"
          fill
          className="object-cover"
        />
        <div className="absolute inset-0 bg-black/65" />
      </div>

      {/* Content */}
      <div className="relative h-full max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 flex flex-col justify-between py-8 sm:py-10 lg:py-12">
        {/* Top Section */}
        <div className="flex flex-col lg:flex-row justify-between items-start gap-6 sm:gap-8 lg:gap-2">
          {/* Left - Logo and Description */}
          <div className="flex flex-col sm:flex-row items-start gap-4 sm:gap-6 lg:gap-8 w-full lg:w-auto">
            <div className="flex flex-col">
              <Image
                src="/images/logo-footer.svg"
                alt="Profixter"
                width={360}
                height={76}
              />
            </div>

            <p className="text-[#C5CBD8] text-sm sm:text-base leading-[120%] max-w-[500px] lg:pt-2">
              Our goal is to make home repairs and maintenance hassle-free, so
              you can focus on what matters most.
            </p>
          </div>

          {/* Right - Navigation */}
          <div className="flex-shrink-0 w-full sm:w-auto">
            <nav className="flex flex-row sm:flex-col gap-4 sm:gap-4 flex-wrap sm:flex-nowrap sm:text-right">
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
            </nav>
          </div>
        </div>

        {/* NEW CONTACT FORM SECTION */}
<div className="mt-8 w-full">
  <div className="w-full max-w-[680px] rounded-[16px] bg-black/55 border border-white/10 backdrop-blur-xl shadow-[0_20px_90px_rgba(0,0,0,0.55)] p-6 sm:p-7">
    <h3 className="text-[22px] sm:text-[24px] font-semibold text-[#306EEC] mb-4">
      Contact Us
    </h3>

    <form onSubmit={handleSubmit} className="space-y-3">
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <input
          required
          type="text"
          name="firstName"
          placeholder="First Name"
          value={formData.firstName}
          onChange={handleChange}
          className="w-full h-[44px] px-3 rounded-[10px] bg-[#0B1220]/80 border border-white/15 text-white placeholder-white/50 outline-none focus:border-[#306EEC] focus:ring-2 focus:ring-[#306EEC]/25"
        />
        <input
          required
          type="text"
          name="lastName"
          placeholder="Last Name"
          value={formData.lastName}
          onChange={handleChange}
          className="w-full h-[44px] px-3 rounded-[10px] bg-[#0B1220]/80 border border-white/15 text-white placeholder-white/50 outline-none focus:border-[#306EEC] focus:ring-2 focus:ring-[#306EEC]/25"
        />
      </div>

      <input
        required
        type="email"
        name="email"
        placeholder="Email"
        value={formData.email}
        onChange={handleChange}
        className="w-full h-[44px] px-3 rounded-[10px] bg-[#0B1220]/80 border border-white/15 text-white placeholder-white/50 outline-none focus:border-[#306EEC] focus:ring-2 focus:ring-[#306EEC]/25"
      />

      <input
        required
        type="tel"
        name="phone"
        placeholder="Phone Number"
        value={formData.phone}
        onChange={handleChange}
        className="w-full h-[44px] px-3 rounded-[10px] bg-[#0B1220]/80 border border-white/15 text-white placeholder-white/50 outline-none focus:border-[#306EEC] focus:ring-2 focus:ring-[#306EEC]/25"
      />

      <button
        type="submit"
        className="w-full h-[46px] rounded-[12px] bg-[#306EEC] text-white font-semibold hover:brightness-110 transition shadow-[0_10px_30px_rgba(48,110,236,0.25)]"
      >
        Submit Request
      </button>

      <p className="text-xs text-white/55 pt-1">
        We typically respond quickly. Calls come from <span className="text-white/80 font-medium">631-599-1363</span>.
      </p>
    </form>
  </div>
</div>


        {/* Existing Get in Touch Card */}
        <div className="mt-6 w-full sm:w-auto">
          <div className="relative w-full sm:w-[300px]">
            <div className="relative w-full rounded-[14px] bg-white/1 backdrop-blur-sm p-5 sm:p-6">
              <h3 className="text-[22px] sm:text-[24px] font-semibold text-[#306EEC] mb-4">
                Get in Touch
              </h3>

              <div className="space-y-3">
                <Link
                  href="https://instagram.com/mrfixter.ny"
                  target="_blank"
                  className="flex items-center gap-3 text-[#C5CBD8] hover:text-[#306EEC]"
                >
                  Instagram: mrfixter.ny
                </Link>

                <Link
                  href="mailto:my@profixter.com"
                  className="flex items-center gap-3 text-[#C5CBD8] hover:text-[#306EEC]"
                >
                  my@profixter.com
                </Link>
              </div>
            </div>
          </div>
        </div>

        {/* Bottom Section */}
        <div className="flex flex-col sm:flex-row justify-between items-center mt-6">
          <p className="text-[#6A6D71]">© 2025 All rights reserved.</p>
          <p className="text-[#6A6D71]">License HI-71484 Insured</p>
        </div>
      </div>

      {/* POPUP CONFIRMATION */}
      {showPopup && (
        <div className="fixed bottom-6 right-6 bg-white text-black p-4 rounded shadow-lg">
          <p className="font-semibold">
            Thank you for contacting ProFixter!
          </p>
          <p className="text-sm">
            We have received your request. Our team will call you shortly from  
            <strong> 631-599-1363</strong>.
          </p>
        </div>
      )}
    </footer>
  );
}
