"use client";

import {
  CalendarDaysIcon,
  CheckBadgeIcon,
  ClipboardDocumentCheckIcon,
  HomeModernIcon,
  MapPinIcon,
} from "@heroicons/react/24/outline";

const trustPoints = [
  {
    title: "Local service",
    text: "Built for homeowners across Long Island.",
    Icon: MapPinIcon,
  },
  {
    title: "Easy online booking",
    text: "Book your visit on the website in minutes.",
    Icon: CalendarDaysIcon,
  },
  {
    title: "No surprise invoices",
    text: "Clear plan pricing and predictable visits.",
    Icon: ClipboardDocumentCheckIcon,
  },
  {
    title: "Fully insured",
    text: "Professional service with peace of mind.",
    Icon: CheckBadgeIcon,
  },
  {
    title: "Reliable scheduling",
    text: "Simple booking with clear next steps.",
    Icon: HomeModernIcon,
  },
] as const;

export default function TrustSection() {
  return (
    <section className="w-full bg-[#eaedfa] py-10 sm:py-12 lg:py-14">
      <div className="mx-auto max-w-[1240px] px-5 lg:px-5">
        <div className="rounded-[22px] border border-[#C5CBD8] bg-white p-5 shadow-[0_0_200px_rgba(0,0,0,0.06)] sm:p-6 lg:p-8">
          <div className="grid gap-6 lg:grid-cols-[0.95fr_1.25fr] lg:items-center">
            <div className="max-w-[460px]">
              <div className="inline-flex items-center gap-2 rounded-full bg-[#EEF2FF] px-3 py-1.5 text-[12px] font-bold uppercase tracking-[0.2em] text-[#306EEC]">
                Long Island Service
              </div>

              <h2 className="mt-3 text-[28px] font-extrabold leading-tight tracking-[-0.03em] text-[#313234] sm:text-[34px]">
                Trusted by Long Island homeowners
              </h2>

              <p className="mt-3 text-[15px] leading-relaxed text-[#6A6D71] sm:text-[16px]">
                Personal handyman help designed to feel clear, local, and dependable from the first visit.
              </p>

              <div className="mt-5 flex items-center gap-4 rounded-[18px] border border-[#D9E4FF] bg-[#F8FAFF] px-4 py-4">
                <div className="flex -space-x-3">
                  {[0, 1, 2].map((idx) => (
                    <div
                      key={idx}
                      className="flex h-10 w-10 items-center justify-center rounded-full border-2 border-white bg-[#CFE0FF] text-[12px] font-bold text-[#306EEC]"
                    >
                      LI
                    </div>
                  ))}
                </div>
                <div className="text-[14px] font-medium leading-relaxed text-[#313234]">
                  Serving homes across Suffolk & Nassau
                </div>
              </div>
            </div>

            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-3">
              {trustPoints.map((item) => (
                <div
                  key={item.title}
                  className="rounded-[18px] border border-[#E6E8EF] bg-[#F8FAFF] p-4"
                >
                  <div className="flex h-11 w-11 items-center justify-center rounded-[14px] bg-white text-[#306EEC] shadow-sm">
                    <item.Icon className="h-5 w-5" />
                  </div>
                  <div className="mt-4 text-[15px] font-semibold text-[#313234]">{item.title}</div>
                  <div className="mt-1 text-[13px] leading-relaxed text-[#6A6D71]">{item.text}</div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
