"use client";

import { useEffect } from "react";
import { useSearchParams } from "next/navigation";
import { CheckCircleIcon } from "@heroicons/react/24/solid";

declare global {
  interface Window {
    dataLayer?: any[];
  }
}

export default function ConfirmationClient() {
  const searchParams = useSearchParams();
  const sessionId = searchParams.get("session_id");

  const handleBookClick = () => {
    window.location.href = "/#pick-day";
  };

  useEffect(() => {
    document.body.style.opacity = "1";

    if (!sessionId) return;

    const key = "profixter_purchase_fired";
    if (sessionStorage.getItem(key)) return;

    const push = (payload: any) => {
      window.dataLayer = window.dataLayer || [];
      window.dataLayer.push(payload);
      sessionStorage.setItem(key, "1");
    };

    (async () => {
      try {
        const api = process.env.NEXT_PUBLIC_API_URL || "https://api.profixter.com";

        const r = await fetch(
          `${api}/api/track/last-purchase-by-session?session_id=${encodeURIComponent(sessionId)}`,
          { cache: "no-store" }
        );

        const data = await r.json();
        if (!data?.ok) throw new Error("no data");

        push({
          event: "purchase",
          currency: data.currency || "USD",
          value: Number(data.value) || 0,
          plan: data.plan || "unknown",
          page_type: "stripe_confirmation",
        });
      } catch {
        // no fake purchase
      }
    })();
  }, [sessionId]);

  return (
    <main className="min-h-screen flex items-center justify-center px-6 py-20 bg-gradient-to-b from-[#F4F6FF] to-[#E6EBFF]">
      <div className="relative bg-white rounded-[24px] shadow-[0_20px_60px_rgba(0,0,0,0.1)] w-full max-w-lg p-10 text-center border border-[#DCE3F8] animate-fadeIn">
        <div className="absolute -top-6 left-1/2 -translate-x-1/2 text-5xl">
          🎉
        </div>

        <div className="flex justify-center mb-6">
          <div className="w-20 h-20 rounded-full bg-[#E8F1FF] flex items-center justify-center shadow-inner">
            <CheckCircleIcon className="w-14 h-14 text-[#306EEC]" />
          </div>
        </div>

        <h1 className="text-3xl font-bold text-[#313234] mb-3 tracking-tight">
          You’re All Set!
        </h1>

        <p className="text-[#6A6D71] text-lg mb-6 leading-relaxed">
          Your subscription is now{" "}
          <span className="font-semibold text-[#306EEC]">active</span>. Thanks
          for becoming part of the Mr. Fixter family!
        </p>

        <div className="bg-[#F4F7FF] border border-[#D7E0F5] rounded-xl p-5 mb-6 text-left shadow-sm">
          <h3 className="text-[#306EEC] text-lg font-semibold mb-2">
            What’s Next?
          </h3>
          <ul className="text-[#6A6D71] space-y-2">
            <li>✔ Book your first home visit</li>
            <li>✔ Prepare any fixtures or materials</li>
            <li>✔ Your Fixter arrives ready to help</li>
          </ul>
        </div>

        <button
          onClick={handleBookClick}
          className="w-full h-[56px] bg-[#306EEC] hover:bg-[#2558c9] transition-all rounded-xl text-white text-lg font-semibold shadow-lg shadow-[#306EEC]/30"
        >
          Book Your First Visit
        </button>

        <p className="text-sm text-[#6A6D71] mt-4">
          Need help? Email{" "}
          <a
            href="mailto:my@profixter.com"
            className="text-[#306EEC] underline"
          >
            my@profixter.com
          </a>
        </p>
      </div>
    </main>
  );
}
