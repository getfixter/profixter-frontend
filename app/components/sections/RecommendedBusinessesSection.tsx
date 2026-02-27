import Image from "next/image";
import {
  RECOMMENDED_BUSINESSES,
  RECOMMENDED_MAGIC_WORD,
  type RecommendedBusiness,
} from "@/app/data/recommendedBusinesses";

function CategoryPill({ label }: { label: string }) {
  return (
    <div className="inline-flex items-center h-[28px] px-3 rounded-full bg-[#EEF2FF] border border-[#C5CBD8] text-[12px] font-semibold text-[#306EEC]">
      {label}
    </div>
  );
}

function CallButton({ tel }: { tel: string }) {
  return (
    <a
      href={`tel:${tel}`}
      className="shrink-0 h-[40px] px-4 rounded-[14px] bg-[#306EEC] hover:bg-[#2558c9] transition-colors text-white text-[13px] font-semibold inline-flex items-center justify-center"
    >
      Call
    </a>
  );
}

function BusinessCard({ b }: { b: RecommendedBusiness }) {
  return (
    <div className="rounded-[18px] border border-[#E6E8EF] bg-white shadow-sm hover:shadow-md transition-shadow overflow-hidden">
      {/* Image */}
      <div className="relative w-full h-[190px] bg-[#F6F7FB]">
        <Image
          src={b.photoSrc}
          alt={`${b.name} - ${b.category}`}
          fill
          className="object-cover"
          sizes="(max-width: 768px) 100vw, (max-width: 1200px) 50vw, 33vw"
        />
      </div>

      {/* Content */}
      <div className="p-5">
        {/* TOP: TRADE */}
        <div className="text-[12px] uppercase tracking-wider text-[#6A6D71] font-semibold">
          {b.category}
        </div>

        {/* LICENSED BADGE */}
<div className="mt-2 inline-flex items-center gap-2 px-3 py-1 rounded-full bg-[#ECFDF3] border border-[#ABEFC6] text-[#067647] text-[11px] font-semibold">
  Licensed & Insured
</div>

        {/* NAME */}
        <div className="mt-2 text-[18px] font-bold text-[#313234]">
          {b.name}
        </div>

        {/* Call button aligned right */}
        <div className="mt-3 flex justify-end">
          <CallButton tel={b.phoneTel} />
        </div>

        {/* Description */}
        <div className="mt-3 text-[14px] text-[#6A6D71] leading-relaxed">
          {b.description}
        </div>

        {/* Discount box */}
        <div className="mt-4 rounded-[14px] border border-[#E6E8EF] bg-[#F6F7FB] p-4">
          <div className="text-[11px] uppercase tracking-wider text-[#6A6D71] font-semibold">
            For discount say
          </div>
          <div className="mt-1 text-[16px] font-extrabold text-[#313234]">
            “{RECOMMENDED_MAGIC_WORD}”
          </div>
        </div>

        {/* Phone line */}
        <div className="mt-4 flex items-center justify-between gap-3">
          <div className="text-[13px] text-[#6A6D71]">
            Phone:{" "}
            <a
              href={`tel:${b.phoneTel}`}
              className="font-semibold text-[#313234] hover:underline"
            >
              {b.phoneDisplay}
            </a>
          </div>

          <a
            href={`tel:${b.phoneTel}`}
            className="text-[13px] font-semibold text-[#306EEC] hover:underline"
          >
            Tap to call
          </a>
        </div>
      </div>
    </div>
  );
}

export default function RecommendedBusinessesSection() {
  return (
    <section className="bg-white">
      <div className="max-w-[1240px] mx-auto px-4 sm:px-6 lg:px-[20px] py-12 sm:py-16">
        <div className="flex items-end justify-between gap-4 flex-wrap">
          <div>
            <div className="text-[12px] uppercase tracking-wider text-[#6A6D71] font-semibold">
              Trusted Local Network
            </div>

            <h2 className="mt-2 text-[26px] sm:text-[34px] font-extrabold text-[#313234] leading-[110%]">
              Professionals We Recommend
            </h2>

            <p className="mt-3 max-w-[920px] text-[14px] sm:text-[15px] text-[#6A6D71] leading-[150%]">
              When a job needs a licensed specialist or bigger scope,
              we connect you with trusted local professionals.
              <span className="text-[#313234] font-semibold">
                {" "}
                For discount say “{RECOMMENDED_MAGIC_WORD}”.
              </span>
            </p>
          </div>

          <a
            href="tel:631-599-1363"
            className="h-[46px] px-5 rounded-[14px] bg-[#EEF2FF] border border-[#C5CBD8] hover:bg-[#E6ECFF] transition-colors text-[#306EEC] text-[14px] font-semibold inline-flex items-center justify-center"
          >
            Need guidance? Call us
          </a>
        </div>

        <div className="mt-8 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {RECOMMENDED_BUSINESSES.map((b) => (
            <BusinessCard key={`${b.category}-${b.name}`} b={b} />
          ))}
        </div>

        <div className="mt-8 rounded-[18px] border border-[#E6E8EF] bg-[#F6F7FB] p-6">
          <div className="text-[14px] text-[#313234] font-semibold">
            Independent Professionals
          </div>
          <div className="mt-1 text-[14px] text-[#6A6D71] leading-relaxed">
            These businesses operate independently from Mr. Fixter.
            Pricing and discounts are determined by each provider.
          </div>
        </div>
      </div>
    </section>
  );
}