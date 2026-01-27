"use client";

import Image from "next/image";
import Link from "next/link";
import { useMemo, useState } from "react";
import { faqs } from "@/app/data/content";

function Chevron({ open }: { open: boolean }) {
  return (
    <svg
      className={`w-5 h-5 transition-transform duration-200 ${open ? "rotate-180" : ""}`}
      viewBox="0 0 24 24"
      fill="none"
      aria-hidden="true"
    >
      <path
        d="M6 9l6 6 6-6"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function FaqCard({
  faq,
  isOpen,
  onToggle,
}: {
  faq: (typeof faqs)[number];
  isOpen: boolean;
  onToggle: () => void;
}) {
  const bgColor =
    faq.color === "blue"
      ? "bg-gradient-to-b from-[#306EEC] to-[#1B3E86]"
      : faq.color === "light"
      ? "bg-[#EEF2FF]"
      : "bg-[#3A3C3E]";

  const textColor = faq.color === "light" ? "text-[#313234]" : "text-white";
  const descColor = faq.color === "light" ? "text-[#6A6D71]" : "text-[#C5CBD8]";
  const numberColor = faq.color === "light" ? "text-[#313234]" : "text-white";

  return (
    <button
      type="button"
      onClick={onToggle}
      className={`${bgColor} w-full rounded-[20px] p-5 sm:p-6 border border-[#C5CBD8] text-left
        shadow-none sm:shadow-[0_10px_60px_rgba(0,0,0,0.20)]
        transition-transform hover:scale-[1.02] active:scale-[0.99]
        focus:outline-none focus:ring-2 focus:ring-[#306EEC]/60`}
      aria-expanded={isOpen}
    >
      <div className="flex items-start justify-between gap-4">
        <h3 className={`text-lg sm:text-xl font-semibold ${textColor} leading-tight font-montserrat`}>
          {faq.question}
        </h3>

        <div className={`${textColor} mt-1 shrink-0`}>
          <Chevron open={isOpen} />
        </div>
      </div>

      <div
        className={`grid transition-[grid-template-rows,opacity] duration-300 ease-in-out mt-3 ${
          isOpen ? "grid-rows-[1fr] opacity-100" : "grid-rows-[0fr] opacity-90"
        }`}
      >
        <div className="overflow-hidden">
          <p className={`text-sm sm:text-base font-medium ${descColor} leading-[140%] font-montserrat`}>
            {faq.answer}
          </p>
        </div>
      </div>

      <div className="flex justify-end mt-4">
        <span className={`text-5xl sm:text-6xl font-bold leading-none ${numberColor} font-montserrat`}>
          {faq.id}
        </span>
      </div>
    </button>
  );
}

export default function ServicesSection() {
  const [openId, setOpenId] = useState<string | null>("01");
  const items = useMemo(() => faqs, []);

  // ✅ Contact form state
  const [contact, setContact] = useState({
    firstName: "",
    lastName: "",
    email: "",
    phone: "",
  });

  // ✅ Match “how it should look”: two separate consents
  const [smsServiceOptIn, setSmsServiceOptIn] = useState(false); // non-marketing (service)
  const [smsMarketingOptIn, setSmsMarketingOptIn] = useState(false); // marketing

  const [showPopup, setShowPopup] = useState(false);

  const onContactChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target;
    setContact((prev) => ({ ...prev, [name]: value }));
  };

  const onContactSubmit = (e: React.FormEvent) => {
    e.preventDefault();

    // Later you can connect API here
    console.log("Contact request:", {
      ...contact,
      smsServiceOptIn,
      smsMarketingOptIn,
      consentSource: "contact_form",
      consentAt: new Date().toISOString(),
    });

    setShowPopup(true);

    // reset
    setContact({ firstName: "", lastName: "", email: "", phone: "" });
    setSmsServiceOptIn(false);
    setSmsMarketingOptIn(false);

    window.setTimeout(() => setShowPopup(false), 4500);
  };

  return (
    <section className="w-full bg-[#313234] py-12 sm:py-16 lg:py-24 relative overflow-hidden">
      <div
        className="hidden lg:block absolute -top-40 left-1/2 -translate-x-1/2 w-[1460px] h-[1460px] rounded-full z-0"
        style={{
          background: "radial-gradient(circle, rgba(48, 110, 236, 0.12) 0%, transparent 70%)",
        }}
      />

      <div className="container mx-auto px-[20px] max-w-[1240px] relative z-10">
        <div className="grid lg:grid-cols-12 gap-8 lg:gap-10 items-start">
          <div className="lg:col-span-4 order-1 lg:order-2">
            <div className="relative rounded-[24px] border border-white/10 bg-white/5 p-6 sm:p-7">
              <h2 className="text-3xl sm:text-5xl lg:text-[54px] font-bold uppercase leading-tight">
                <span className="text-white">FAQ</span>
                <br />
                <span className="text-[#306eec]">Questions</span>
              </h2>
              <p className="text-[#c5cbd8] text-base sm:text-lg font-medium mt-3">
                Simple answers before you book.
              </p>

              <div className="mt-6 flex justify-center">
                <Image
                  src="/images/lampa.png"
                  alt="Light bulb"
                  width={420}
                  height={220}
                  className="object-contain drop-shadow-[0_40px_70px_rgba(42,30,15,0.25)]"
                />
              </div>
            </div>
          </div>

          <div className="lg:col-span-8 order-2 lg:order-1">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-5 sm:gap-6">
              {items.map((faq) => (
                <FaqCard
                  key={faq.id}
                  faq={faq}
                  isOpen={openId === faq.id}
                  onToggle={() => setOpenId((prev) => (prev === faq.id ? null : faq.id))}
                />
              ))}
            </div>

            <div className="lg:hidden mt-6 text-center">
              <p className="text-[#C5CBD8] text-sm">Tap a card to expand the answer.</p>
            </div>
          </div>
        </div>
      </div>

      {/* ✅ Professional popup */}
      {showPopup && (
        <div className="fixed bottom-6 right-6 z-[9999] max-w-[360px] rounded-[16px] bg-[#0B1220] text-white border border-white/10 shadow-[0_20px_80px_rgba(0,0,0,0.55)] p-4">
          <p className="font-semibold font-montserrat text-white">Thank you — we received your request.</p>
          <p className="text-sm text-[#C5CBD8] font-montserrat mt-1 leading-[140%]">
            We’ll contact you shortly from <span className="text-white font-semibold">631-599-1363</span>.
          </p>
        </div>
      )}
    </section>
  );
}
