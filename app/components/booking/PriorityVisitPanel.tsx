import { CUSTOMER_CARE } from "@/lib/fixter";

/**
 * Priority Visit.
 *
 * Deliberately not self-service. There is no calendar, no availability call, no
 * checkout and no way to create an appointment from this panel - whether a
 * request can be brought forward depends on the day, and only a person can
 * answer that. Booking one automatically would be promising something ProFixter
 * cannot reliably keep.
 *
 * The copy is careful for the same reason. It says service "may be available",
 * never guarantees a time, and never presents ProFixter as an emergency
 * response service. Calling is the primary action because this is a
 * conversation, not a transaction.
 */
export default function PriorityVisitPanel() {
  return (
    <section className="mx-auto w-full max-w-[1280px] px-4 pb-16 pt-6 sm:px-6 sm:pb-20 sm:pt-8 lg:px-8">
      <div className="max-w-[560px]">
        <p className="text-[11px] font-bold uppercase tracking-[0.18em] text-[#306EEC]">
          Priority Visit
        </p>
        <h1 className="mt-3 text-[28px] font-semibold leading-[1.1] tracking-[-0.035em] text-[#0B1628] sm:text-[38px]">
          Need us sooner?
        </h1>
        <p className="mt-4 text-[15px] leading-6 text-[#4A5462] sm:text-[16px] sm:leading-7">
          Priority Visits are for problems that cannot wait for your next regular
          appointment. Same-day or next-day service may be available depending on
          the situation and Fixter availability.
        </p>
        <p className="mt-3 text-[14px] leading-6 text-[#6E6E73]">
          Give us a call and we will tell you what is possible today.
        </p>

        <div className="mt-7 flex flex-col gap-2 sm:flex-row">
          <a
            href={CUSTOMER_CARE.callHref}
            aria-label={`Call ProFixter at ${CUSTOMER_CARE.phoneDisplay}`}
            className="inline-flex min-h-[52px] items-center justify-center gap-2 rounded-[14px] bg-[#0B1628] px-6 text-[15px] font-semibold text-white transition hover:bg-[#172033] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#306EEC] sm:min-w-[220px]"
          >
            <svg width="17" height="17" viewBox="0 0 24 24" fill="none" aria-hidden="true">
              <path
                d="M6.6 3.5h2.2l1.4 3.6-1.8 1.3a12.4 12.4 0 0 0 5.2 5.2l1.3-1.8 3.6 1.4v2.2a2 2 0 0 1-2.2 2A15.8 15.8 0 0 1 4.6 5.7a2 2 0 0 1 2-2.2Z"
                stroke="currentColor"
                strokeWidth="1.8"
                strokeLinejoin="round"
              />
            </svg>
            Call ProFixter
          </a>
          <a
            href={`sms:${CUSTOMER_CARE.phoneE164}`}
            aria-label={`Text ProFixter at ${CUSTOMER_CARE.phoneDisplay}`}
            className="inline-flex min-h-[52px] items-center justify-center rounded-[14px] border border-[#D7DEE9] bg-white px-6 text-[15px] font-semibold text-[#0B1628] transition hover:bg-[#F8FAFF] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#306EEC]"
          >
            Text ProFixter
          </a>
        </div>

        <p className="mt-4 text-[15px] font-semibold tracking-[-0.01em] text-[#0B1628]">
          {CUSTOMER_CARE.phoneDisplay}
        </p>

        <p className="mt-8 border-t border-[#E6ECF5] pt-5 text-[13px] leading-5 text-[#8A94A6]">
          For anything that is not urgent, book your Membership Visit or an
          Additional Visit above.
        </p>
      </div>
    </section>
  );
}
