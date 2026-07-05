"use client";

import { useEffect } from "react";
import { useSearchParams } from "next/navigation";
import { CheckCircleIcon } from "@heroicons/react/24/solid";
import { trackPurchase } from "@/lib/analytics";

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
    <main className="min-h-screen flex items-center justify-center px-6 py-20 bg-gradient-to-b from-[#F4F6FF] to-[#E6EBFF]">
      <div className="relative w-full max-w-lg rounded-[24px] border border-[#DCE3F8] bg-white p-10 text-center shadow-[0_20px_60px_rgba(0,0,0,0.1)] animate-fadeIn">
        <div className="absolute -top-6 left-1/2 -translate-x-1/2 text-5xl">🎉</div>

        <div className="mb-6 flex justify-center">
          <div className="flex h-20 w-20 items-center justify-center rounded-full bg-[#E8F1FF] shadow-inner">
            <CheckCircleIcon className="h-14 w-14 text-[#306EEC]" />
          </div>
        </div>

        <h1 className="mb-3 text-3xl font-bold tracking-tight text-[#313234]">
          You&apos;re all set
        </h1>

        <p className="mb-6 text-lg leading-relaxed text-[#6A6D71]">
          Your Membership is now{" "}
          <span className="font-semibold text-[#306EEC]">active</span>. Thanks
          for becoming part of the Mr. Fixter family.
        </p>

        <div className="mb-6 rounded-xl border border-[#D7E0F5] bg-[#F4F7FF] p-5 text-left shadow-sm">
          <h3 className="mb-2 text-lg font-semibold text-[#306EEC]">
            What&apos;s next
          </h3>
          <ul className="space-y-2 text-[#6A6D71]">
            <li>1. Your Membership is active</li>
            <li>2. Book your first visit</li>
            <li>3. We&apos;ll confirm your appointment</li>
          </ul>
        </div>

        <button
          onClick={handleBookClick}
          className="h-[56px] w-full rounded-xl bg-[#306EEC] text-lg font-semibold text-white shadow-lg shadow-[#306EEC]/30 transition-all hover:bg-[#2558c9]"
        >
          Book Your First Visit
        </button>

        <div className="mt-4 rounded-[16px] border border-[#D7E0F5] bg-[#F8FAFF] p-4 text-left">
          <p className="text-sm font-semibold text-[#313234]">
            Most members book one visit per month
          </p>
          <p className="mt-2 text-sm leading-relaxed text-[#6A6D71]">
            You can always schedule your next visit after completion.
          </p>
        </div>

        <div className="mt-4 rounded-[16px] border border-[#D7E0F5] bg-[#F8FAFF] p-4 text-left">
          <p className="text-sm font-semibold text-[#313234]">
            Invite a friend and share simple monthly home help
          </p>
        </div>

        <p className="mt-4 text-sm text-[#6A6D71]">
          Need help? Email{" "}
          <a href="mailto:my@profixter.com" className="text-[#306EEC] underline">
            my@profixter.com
          </a>
        </p>
      </div>
    </main>
  );
}
