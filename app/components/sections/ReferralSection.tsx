"use client";

import { useState } from "react";
import { useAuth } from "@/lib/useAuth";

const REFERRER_REWARD = "$50";
const REFERRED_REWARD = "$50";
const BASE_URL = "https://profixter.com";

type ReferralUser = {
  _id?: string;
  userId?: string;
};

export default function ReferralSection() {
  const { user, isAuthenticated } = useAuth();
  const [copied, setCopied] = useState(false);

  const typedUser = user as ReferralUser | null | undefined;
  const userId = typedUser?._id || typedUser?.userId || "";
  const referralLink = userId ? `${BASE_URL}/?ref=${userId}` : `${BASE_URL}/signup`;

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(referralLink);
    } catch {
      const el = document.createElement("textarea");
      el.value = referralLink;
      document.body.appendChild(el);
      el.select();
      document.execCommand("copy");
      document.body.removeChild(el);
    }
    setCopied(true);
    setTimeout(() => setCopied(false), 2500);
  };

  const shareText = `I've been using Profixter - a handyman membership on Long Island that sends the same team every month. You get ${REFERRED_REWARD} off your first month: ${referralLink}`;
  const smsHref = `sms:&body=${encodeURIComponent(shareText)}`;
  const waHref = `https://wa.me/?text=${encodeURIComponent(shareText)}`;

  return (
    <section className="relative w-full overflow-hidden py-10 sm:py-13 lg:py-12 bg-white">
      {/* Subtle tinted glow */}
      <div
        aria-hidden="true"
        className="pointer-events-none absolute top-0 left-1/2 -translate-x-1/2 h-[500px] w-[800px] rounded-full blur-[160px] opacity-30"
        style={{ background: "radial-gradient(circle, rgba(48,110,236,0.12), transparent 70%)" }}
      />

      <div className="relative mx-auto max-w-[1280px] px-4 sm:px-6 lg:px-8">

        {/* Header */}
        <div className="text-center mb-7 sm:mb-12">
          <div className="inline-flex items-center gap-2 rounded-full border border-[#D9E4FF] bg-[#EEF2FF] px-4 py-1.5 mb-5">
            <svg width="11" height="11" viewBox="0 0 24 24" fill="none" aria-hidden="true">
              <path d="M17 21v-2a4 4 0 00-4-4H5a4 4 0 00-4 4v2" stroke="#306EEC" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
              <circle cx="9" cy="7" r="4" stroke="#306EEC" strokeWidth="2" />
              <path d="M23 21v-2a4 4 0 00-3-3.87M16 3.13a4 4 0 010 7.75" stroke="#306EEC" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
            <span className="text-[11px] font-bold uppercase tracking-[0.2em] text-[#306EEC]">
              Referral Program
            </span>
          </div>

          <h2 className="text-[26px] sm:text-[34px] font-extrabold text-[#0B1628] leading-[1.08] tracking-[-0.03em] mb-3">
            Invite a Neighbor. Get Rewarded.
          </h2>
          <p className="text-[15px] sm:text-[17px] text-[#475569] max-w-[540px] mx-auto leading-relaxed">
            Profixter works best when your neighbors use it too. Invite someone and both of you benefit.
          </p>
        </div>

        {/* Reward cards */}
        <div className="grid sm:grid-cols-2 gap-4 max-w-[640px] mx-auto mb-8">
          <div className="rounded-[13px] border border-[#D9E4FF] bg-[#EEF2FF] px-6 py-5 text-center">
            <div className="text-[11px] font-bold uppercase tracking-[0.18em] text-[#306EEC] mb-2">You get</div>
            <div className="text-[34px] sm:text-[36px] font-extrabold text-[#0B1628] leading-none mb-1">
              {REFERRER_REWARD}
            </div>
            <div className="text-[13px] text-[#475569]">off your next month</div>
          </div>
          <div className="rounded-[13px] border border-[#BBF7D0] bg-[#F0FDF4] px-6 py-5 text-center">
            <div className="text-[11px] font-bold uppercase tracking-[0.18em] text-[#166534] mb-2">They get</div>
            <div className="text-[34px] sm:text-[36px] font-extrabold text-[#0B1628] leading-none mb-1">
              {REFERRED_REWARD}
            </div>
            <div className="text-[13px] text-[#475569]">off their first month</div>
          </div>
        </div>

        {/* Referral link box */}
        <div className="max-w-[640px] mx-auto mb-6">
          <p className="text-[12px] font-semibold text-[#64748B] mb-2 text-center">
            {isAuthenticated ? "Your personal referral link" : "Log in to get your personal link"}
          </p>
          <div className="flex items-center gap-2 rounded-[14px] border border-[#E2E8F0] bg-[#F8FAFF] px-4 py-3">
            <span className="flex-1 text-[13px] text-[#475569] font-mono truncate select-all">
              {referralLink}
            </span>
            <button
              type="button"
              onClick={handleCopy}
              className={`flex-shrink-0 inline-flex items-center gap-1.5 rounded-[10px] px-4 py-2 text-[13px] font-extrabold transition-all duration-200 ${
                copied
                  ? "bg-[#F0FDF4] border border-[#86EFAC] text-[#166534]"
                  : "bg-[#306EEC] text-white hover:bg-[#2558c9]"
              }`}
            >
              {copied ? (
                <>
                  <svg width="12" height="10" viewBox="0 0 12 10" fill="none" aria-hidden="true">
                    <path d="M1 5l3 3 7-7" stroke="#166534" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                  </svg>
                  Copied!
                </>
              ) : (
                <>
                  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" aria-hidden="true">
                    <rect x="9" y="9" width="13" height="13" rx="2" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                    <path d="M5 15H4a2 2 0 01-2-2V4a2 2 0 012-2h9a2 2 0 012 2v1" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                  </svg>
                  Copy link
                </>
              )}
            </button>
          </div>
        </div>

        {/* Share buttons */}
        <div className="flex flex-col sm:flex-row gap-3 max-w-[640px] mx-auto mb-7 sm:mb-12">
          <a
            href={smsHref}
            className="flex-1 inline-flex h-[48px] items-center justify-center gap-2.5 rounded-[12px] border border-[#E2E8F0] bg-white text-[14px] font-semibold text-[#0B1628] transition hover:border-[#306EEC] hover:text-[#306EEC]"
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" aria-hidden="true">
              <path d="M21 15a2 2 0 01-2 2H7l-4 4V5a2 2 0 012-2h14a2 2 0 012 2z" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
            Send via SMS
          </a>
          <a
            href={waHref}
            target="_blank"
            rel="noopener noreferrer"
            className="flex-1 inline-flex h-[48px] items-center justify-center gap-2.5 rounded-[12px] border border-[#BBF7D0] bg-[#F0FDF4] text-[14px] font-semibold text-[#166534] transition hover:bg-[#DCFCE7] hover:border-[#4ADE80]"
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" aria-hidden="true">
              <path d="M21 11.5a8.38 8.38 0 01-.9 3.8 8.5 8.5 0 01-7.6 4.7 8.38 8.38 0 01-3.8-.9L3 21l1.9-5.7a8.38 8.38 0 01-.9-3.8 8.5 8.5 0 014.7-7.6 8.38 8.38 0 013.8-.9h.5a8.48 8.48 0 018 8v.5z" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
            Share via WhatsApp
          </a>
        </div>

        {/* Social proof + micro-psychology + neighborhood effect */}
        <div className="max-w-[680px] mx-auto space-y-3">

          <div className="flex items-start gap-3 rounded-[14px] border border-[#E2E8F0] bg-[#F8FAFF] px-5 py-4">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" aria-hidden="true" className="flex-shrink-0 mt-0.5">
              <path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z" stroke="#306EEC" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
            <p className="text-[13px] text-[#475569] leading-relaxed">
              <span className="font-semibold text-[#0B1628]">Most of our members come from referrals</span> - homeowners trust recommendations from people they know.
            </p>
          </div>

          <div className="flex items-start gap-3 rounded-[14px] border border-[#E2E8F0] bg-[#F8FAFF] px-5 py-4">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" aria-hidden="true" className="flex-shrink-0 mt-0.5">
              <path d="M3 9l9-7 9 7v11a2 2 0 01-2 2H5a2 2 0 01-2-2z" stroke="#306EEC" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
              <polyline points="9 22 9 12 15 12 15 22" stroke="#306EEC" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
            <p className="text-[13px] text-[#475569] leading-relaxed">
              Help your neighbors take care of their homes - and make your life easier too.
            </p>
          </div>

          <div className="flex items-start gap-3 rounded-[14px] border border-[#D9E4FF] bg-[#EEF2FF] px-5 py-4">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" aria-hidden="true" className="flex-shrink-0 mt-0.5">
              <circle cx="12" cy="12" r="10" stroke="#306EEC" strokeWidth="1.8" />
              <path d="M12 8v4l3 3" stroke="#306EEC" strokeWidth="1.8" strokeLinecap="round" />
            </svg>
            <p className="text-[13px] text-[#475569] leading-relaxed">
              <span className="font-semibold text-[#0B1628]">Neighborhood effect:</span> When multiple homes on the same block use Profixter, scheduling becomes faster and more efficient for everyone.
            </p>
          </div>
        </div>

      </div>
    </section>
  );
}
