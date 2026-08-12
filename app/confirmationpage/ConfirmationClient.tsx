"use client";

import { useEffect } from "react";
import { useSearchParams } from "next/navigation";
import { CheckCircleIcon } from "@heroicons/react/24/solid";
import { trackPurchase } from "@/lib/analytics";
import YourFixter from "@/app/components/fixter/YourFixter";
import { PUBLIC_CONTACT_EMAIL, PUBLIC_CONTACT_MAILTO } from "@/lib/contact";

export default function ConfirmationClient() {
  const searchParams = useSearchParams();
  const sessionId = searchParams.get("session_id");

  const handleBookClick = () => {
    // The member has just paid and this is their first included visit, so it
    // goes to Book like every other booking action now does.
    window.location.href = "/book?visit=membership";
  };

  useEffect(() => {
    document.body.style.opacity = "1";

    if (!sessionId) return;

    const key = "profixter_purchase_fired";
    if (sessionStorage.getItem(key)) return;

    (async () => {
      try {
        const api = process.env.NEXT_PUBLIC_API_URL || "https://api.profixter.com";

        const r = await fetch(
          `${api}/api/track/last-purchase-by-session?session_id=${encodeURIComponent(sessionId)}`,
          { cache: "no-store" }
        );

        const data = await r.json();
        if (!data?.ok) throw new Error("no data");

        trackPurchase({
          currency: data.currency || "USD",
          value: Number(data.value) || 0,
          plan: data.plan || "unknown",
          page_type: "stripe_confirmation",
        });
        sessionStorage.setItem(key, "1");
      } catch {
        // no fake purchase
      }
    })();
  }, [sessionId]);

  return (
    <main className="flex min-h-screen items-center justify-center bg-[#F5F7FB] px-5 py-10 sm:px-6 sm:py-13">
      <div className="relative w-full max-w-xl overflow-hidden rounded-[13px] border border-[#DCE3F8] bg-white p-7 text-center shadow-[0_28px_80px_rgba(15,23,42,0.12)] animate-fadeIn sm:p-10">
        <div className="absolute inset-x-0 top-0 h-1 bg-gradient-to-r from-[#306EEC] via-[#86EFAC] to-[#D4A574]" />

        <div className="mb-6 flex justify-center">
          <div className="flex h-20 w-20 items-center justify-center rounded-full bg-[#E8F1FF] shadow-inner">
            <CheckCircleIcon className="h-14 w-14 text-[#306EEC]" />
          </div>
        </div>

        <h1 className="mb-3 text-[30px] font-black leading-tight tracking-[-0.035em] text-[#0B1628] sm:text-[36px]">
          Your home is now taken care of.
        </h1>

        <p className="mx-auto mb-6 max-w-[420px] text-[15px] font-semibold leading-relaxed text-[#64748B] sm:text-base">
          Your Membership is active. Book your first Member visit and we&apos;ll start learning your home, your priorities, and your running list.
        </p>

        <div className="mb-6 rounded-[14px] border border-[#D7E0F5] bg-[#F8FAFF] p-5 text-left shadow-sm">
          <h3 className="mb-3 text-base font-black text-[#0B1628]">
            What&apos;s next
          </h3>
          <ul className="space-y-3 text-sm font-semibold text-[#64748B]">
            <li>1. Choose your first visit time</li>
            <li>2. Add notes and photos for the work</li>
            <li>3. Profixter confirms the appointment</li>
          </ul>
        </div>

        <button
          onClick={handleBookClick}
          className="h-[48px] w-full rounded-[16px] bg-[#0B1628] text-base font-black text-white shadow-[0_18px_44px_rgba(11,22,40,0.24)] transition-all hover:bg-[#17263D]"
        >
          Book Your Member Visit
        </button>

        {/*
          Introduced right after the first booking action: the member has just
          paid, and this is the moment the membership stops being a plan and
          becomes a person looking after their home.
        */}
        <YourFixter variant="welcome" className="mt-4 text-left" />

        <div className="mt-4 rounded-[13px] border border-[#E5E7EB] bg-white p-4 text-left">
          <p className="text-sm font-black text-[#0B1628]">
            How booking works as a Member
          </p>
          <p className="mt-2 text-sm leading-relaxed text-[#6A6D71]">
            Members can request visits online as needed, subject to availability and active booking rules.
          </p>
        </div>

        <p className="mt-4 text-sm text-[#6A6D71]">
          Need help? Email{" "}
          <a href={PUBLIC_CONTACT_MAILTO} className="text-[#306EEC] underline">
            {PUBLIC_CONTACT_EMAIL}
          </a>
        </p>
      </div>
    </main>
  );
}
