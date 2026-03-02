"use client";

import Image from "next/image";
import { useMemo, useState } from "react";
import { faqs } from "@/app/data/content";

function Chevron({ open }: { open: boolean }) {
  return (
    <svg
      className={`w-5 h-5 transition-transform duration-200 ${
        open ? "rotate-180" : ""
      }`}
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
      className={[
        bgColor,
        "w-full rounded-[20px] p-5 sm:p-6 border border-[#C5CBD8]/70 text-left",
        "shadow-none sm:shadow-[0_10px_60px_rgba(0,0,0,0.18)]",
        // avoid hover scaling that can jitter on iOS/Safari; use subtle lift instead
        "transition-[transform,box-shadow] duration-200",
        "hover:-translate-y-[2px] hover:shadow-[0_18px_70px_rgba(0,0,0,0.25)]",
        "active:translate-y-0",
        "focus:outline-none focus:ring-2 focus:ring-[#306EEC]/60",
      ].join(" ")}
      aria-expanded={isOpen}
    >
      <div className="flex items-start justify-between gap-4">
        <h3
          className={[
            "text-lg sm:text-xl font-semibold leading-tight font-montserrat",
            textColor,
          ].join(" ")}
        >
          {faq.question}
        </h3>

        <div className={`${textColor} mt-1 shrink-0`}>
          <Chevron open={isOpen} />
        </div>
      </div>

      {/* smoother + more consistent than grid-rows trick */}
      <div
        className={[
          "transition-[max-height,opacity,transform] duration-300 ease-out",
          isOpen
            ? "max-h-[240px] opacity-100 translate-y-0 mt-3"
            : "max-h-0 opacity-0 -translate-y-[2px] mt-0",
        ].join(" ")}
      >
        <div className="overflow-hidden">
          <p
            className={[
              "text-sm sm:text-base font-medium leading-[140%] font-montserrat",
              descColor,
            ].join(" ")}
          >
            {faq.answer}
          </p>
        </div>
      </div>

      <div className="flex justify-end mt-4">
        <span
          className={[
            "text-5xl sm:text-6xl font-bold leading-none font-montserrat",
            numberColor,
          ].join(" ")}
        >
          {faq.id}
        </span>
      </div>
    </button>
  );
}

export default function ServicesSection() {
  const items = useMemo(() => faqs, []);
  const [openId, setOpenId] = useState<string | null>("01");

  // ✅ Contact form state (kept for future API wiring)
  const [contact, setContact] = useState({
    firstName: "",
    lastName: "",
    email: "",
    phone: "",
  });

  // ✅ two separate consents
  const [smsServiceOptIn, setSmsServiceOptIn] = useState(false);
  const [smsMarketingOptIn, setSmsMarketingOptIn] = useState(false);

  const [showPopup, setShowPopup] = useState(false);

  const onContactChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target;
    setContact((prev) => ({ ...prev, [name]: value }));
  };

  const onContactSubmit = (e: React.FormEvent) => {
    e.preventDefault();

    console.log("Contact request:", {
      ...contact,
      smsServiceOptIn,
      smsMarketingOptIn,
      consentSource: "contact_form",
      consentAt: new Date().toISOString(),
    });

    setShowPopup(true);

    setContact({ firstName: "", lastName: "", email: "", phone: "" });
    setSmsServiceOptIn(false);
    setSmsMarketingOptIn(false);

    window.setTimeout(() => setShowPopup(false), 4500);
  };

  return (
    <section
      id="services"
      className="w-full bg-[#313234] py-12 sm:py-16 lg:py-24 relative overflow-hidden"
    >
      {/* Background glow */}
      <div
        className="hidden lg:block absolute -top-40 left-1/2 -translate-x-1/2 w-[1460px] h-[1460px] rounded-full z-0"
        style={{
          background:
            "radial-gradient(circle, rgba(48, 110, 236, 0.12) 0%, transparent 70%)",
        }}
      />

      <div className="container mx-auto px-5 sm:px-6 lg:px-5 max-w-[1240px] relative z-10">
        <div className="grid lg:grid-cols-12 gap-8 lg:gap-10 items-start">
          {/* Right (desktop) / top (mobile): title block */}
          <div className="lg:col-span-4 order-1 lg:order-2">
            <div className="relative rounded-[24px] border border-white/10 bg-white/5 p-6 sm:p-7">
              <h2 className="text-3xl sm:text-5xl lg:text-[54px] font-bold uppercase leading-tight">
                <span className="text-white">FAQ</span>
                <br />
                <span className="text-[#306eec]">Questions</span>
              </h2>

              <p className="text-[#c5cbd8] text-base sm:text-lg font-medium mt-3">
                Simple answers about your unlimited handyman service before you book.
              </p>

              <div className="mt-6 flex justify-center">
                <Image
                  src="/images/lampa.png"
                  alt="Light bulb"
                  width={420}
                  height={220}
                  className="object-contain drop-shadow-[0_40px_70px_rgba(42,30,15,0.25)]"
                  priority={false}
                />
              </div>

              {/* Optional helper text on desktop */}
              <div className="hidden lg:block mt-4 text-sm text-[#C5CBD8]">
                Click a card to expand.
              </div>

              {/* NOTE: contact form kept wired (not rendered here).
                  If you want it shown inside this section, tell me and I’ll place it. */}
            </div>
          </div>

          {/* FAQ grid */}
          <div className="lg:col-span-8 order-2 lg:order-1">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-5 sm:gap-6">
              {items.map((faq) => (
                <FaqCard
                  key={faq.id}
                  faq={faq}
                  isOpen={openId === faq.id}
                  onToggle={() =>
                    setOpenId((prev) => (prev === faq.id ? null : faq.id))
                  }
                />
              ))}
            </div>

            {/* CTA: encourage users to view plans */}
            <div className="mt-8 text-center">
              <a
                href="#plans"
                className="inline-flex px-6 py-3 bg-[#306EEC] text-white rounded-[14px] font-extrabold text-sm sm:text-base hover:bg-[#2558c9] transition"
              >
                See Plans
              </a>
            </div>

            <div className="lg:hidden mt-6 text-center">
              <p className="text-[#C5CBD8] text-sm">
                Tap a card to expand the answer.
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* ✅ Professional popup */}
      {showPopup && (
        <div className="fixed bottom-6 right-6 z-[9999] max-w-[360px] rounded-[16px] bg-[#0B1220] text-white border border-white/10 shadow-[0_20px_80px_rgba(0,0,0,0.55)] p-4">
          <p className="font-semibold font-montserrat text-white">
            Thank you - we received your request.
          </p>
          <p className="text-sm text-[#C5CBD8] font-montserrat mt-1 leading-[140%]">
            We’ll contact you shortly from{' '}
            <span className="text-white font-semibold">631-599-1363</span>.
          </p>
        </div>
      )}
    </section>
  );
}