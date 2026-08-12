"use client";

const GOOD_FIT = [
  "You always have small things to fix around the house",
  "You want one trusted handyman who knows your home",
  "You prefer a predictable monthly cost over random bills",
  "You plan ahead and schedule in advance (not emergency calls)",
];

const BAD_FIT = [
  "You need same-day or emergency repairs",
  "You expect unlimited work packed into one visit",
  "You have a large renovation or structural project",
  "You only need one small job done once a year",
];

const WHY_BETTER = [
  {
    icon: (
      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" aria-hidden="true">
        <path d="M22 16.92v3a2 2 0 01-2.18 2 19.79 19.79 0 01-8.63-3.07 19.5 19.5 0 01-6-6 19.79 19.79 0 01-3.07-8.67A2 2 0 014.11 2h3a2 2 0 012 1.72c.13.96.37 1.9.72 2.81a2 2 0 01-.45 2.11L8.09 9.91a16 16 0 006 6l1.27-1.27a2 2 0 012.11-.45c.91.35 1.85.59 2.81.72A2 2 0 0122 16.92z" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
    ),
    headline: "No calling around every time something breaks",
    body: "With a normal handyman, you search, explain your home from scratch, and wait for a callback. Members just book online.",
  },
  {
    icon: (
      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" aria-hidden="true">
        <path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
        <path d="M14 2v6h6M16 13H8M16 17H8M10 9H8" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
    ),
    headline: "No waiting for estimates on small jobs",
    body: "Stop paying $150 for someone to tell you what a $40 fix costs. Membership visits are included in your monthly price.",
  },
  {
    icon: (
      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" aria-hidden="true">
        <path d="M17 21v-2a4 4 0 00-4-4H5a4 4 0 00-4 4v2" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
        <circle cx="9" cy="7" r="4" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
        <path d="M23 21v-2a4 4 0 00-3-3.87M16 3.13a4 4 0 010 7.75" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
    ),
    headline: "One trusted professional who knows your home",
    body: "The same team shows up every visit. They learn where the shutoffs are, what quirks your home has, and what you care about.",
  },
  {
    icon: (
      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" aria-hidden="true">
        <rect x="1" y="4" width="22" height="16" rx="2" ry="2" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
        <path d="M1 10h22" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
    ),
    headline: "Predictable cost instead of random bills",
    body: "Know exactly what you'll pay each month. No surprise invoices, no per-task markup, no wondering if the quote is fair.",
  },
  {
    icon: (
      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" aria-hidden="true">
        <path d="M3 9l9-7 9 7v11a2 2 0 01-2 2H5a2 2 0 01-2-2z" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
        <path d="M9 22V12h6v10" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
    ),
    headline: "Ongoing care instead of one-time fixes",
    body: "A handyman who visits once a year fixes what's already broken. A membership keeps things from breaking in the first place.",
  },
];

const EXPECTATIONS = [
  { icon: "📅", text: "Visits are scheduled in advance - not on-demand" },
  { icon: "⏱️", text: "Each visit has a 90-minute time limit" },
  { icon: "🔧", text: "Best for ongoing home care, not urgent or emergency repairs" },
  { icon: "📋", text: "Larger or more complex work may require multiple visits" },
];

export default function MembershipClaritySection() {
  return (
    <>
      {/* ── Is This Right For You? ── */}
      <section
        className="relative w-full overflow-hidden py-10 sm:py-13 lg:py-12 bg-white"
      >
        <div className="mx-auto max-w-[1280px] px-4 sm:px-6 lg:px-8">

          <div className="text-center mb-8 sm:mb-16">
            <div className="inline-flex items-center gap-2 rounded-full border border-[#D9E4FF] bg-[#EEF2FF] px-4 py-1.5 mb-5">
              <span className="text-[11px] font-bold uppercase tracking-[0.2em] text-[#306EEC]">
                Fit Check
              </span>
            </div>
            <p className="text-[13px] font-bold uppercase tracking-[0.12em] text-[#94A3B8] mb-3">
              Profixter isn&rsquo;t for everyone - and that&rsquo;s intentional.
            </p>
            <h2 className="text-[26px] sm:text-[36px] font-extrabold text-[#0B1628] leading-[1.08] tracking-[-0.03em]">
              Is This Right for You?
            </h2>
            <p className="text-[15px] sm:text-[17px] text-[#475569] mt-3 max-w-[500px] mx-auto leading-relaxed">
              We keep the team small and the service personal. That means we can only take on homeowners this model actually works for.
            </p>
          </div>

          <div className="grid md:grid-cols-2 gap-6 max-w-[900px] mx-auto">

            {/* Good fit */}
            <div className="rounded-[16px] border border-[#BBF7D0] bg-[#F0FDF4] p-8">
              <div className="flex items-center gap-3 mb-6">
                <div className="w-9 h-9 rounded-full bg-[#22C55E]/15 flex items-center justify-center flex-shrink-0">
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" aria-hidden="true">
                    <path d="M5 12.5l4 4 10-10" stroke="#16A34A" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" />
                  </svg>
                </div>
                <h3 className="text-[18px] font-extrabold text-[#166534]">Perfect for you if:</h3>
              </div>
              <ul className="space-y-3.5">
                {GOOD_FIT.map((item) => (
                  <li key={item} className="flex items-start gap-3">
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" aria-hidden="true" className="flex-shrink-0 mt-0.5">
                      <path d="M5 12.5l4 4 10-10" stroke="#16A34A" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" />
                    </svg>
                    <span className="text-[15px] text-[#166534] leading-snug">{item}</span>
                  </li>
                ))}
              </ul>
            </div>

            {/* Not ideal */}
            <div className="rounded-[16px] border border-[#FED7AA] bg-[#FFF7ED] p-8">
              <div className="flex items-center gap-3 mb-6">
                <div className="w-9 h-9 rounded-full bg-[#F97316]/15 flex items-center justify-center flex-shrink-0">
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" aria-hidden="true">
                    <path d="M18 6L6 18M6 6l12 12" stroke="#C2410C" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" />
                  </svg>
                </div>
                <h3 className="text-[18px] font-extrabold text-[#9A3412]">Not ideal if:</h3>
              </div>
              <ul className="space-y-3.5">
                {BAD_FIT.map((item) => (
                  <li key={item} className="flex items-start gap-3">
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" aria-hidden="true" className="flex-shrink-0 mt-0.5">
                      <path d="M18 6L6 18M6 6l12 12" stroke="#C2410C" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                    </svg>
                    <span className="text-[15px] text-[#9A3412] leading-snug">{item}</span>
                  </li>
                ))}
              </ul>
            </div>
          </div>
        </div>
      </section>

      {/* ── Without a system like this… ── */}
      <section
        className="relative w-full overflow-hidden py-8 sm:py-11 bg-[#0B1628]"
      >
        <div className="mx-auto max-w-[900px] px-4 sm:px-6 lg:px-8">
          <div className="grid md:grid-cols-[1fr_1fr] gap-8 items-center">
            <div>
              <p className="text-[11px] font-bold uppercase tracking-[0.2em] text-white/30 mb-3">Pain Awareness</p>
              <h3 className="text-[23px] sm:text-[26px] font-extrabold text-white leading-[1.12] tracking-[-0.025em] mb-4">
                Without a system like this&hellip;
              </h3>
              <p className="text-[14px] sm:text-[15px] text-white/45 leading-relaxed">
                Most homeowners don&rsquo;t realize what reactive home care actually costs them - in money, time, and stress.
              </p>
            </div>
            <ul className="space-y-4">
              {[
                { problem: "Small issues pile up into a long list", consequence: "Then one thing breaks and the whole list feels urgent" },
                { problem: "You delay fixes because finding someone is exhausting", consequence: "A $30 caulk job becomes a $400 water damage repair" },
                { problem: "You pay retail rates every single visit", consequence: "No relationship, no discount, no continuity" },
                { problem: "You never feel fully on top of your home", consequence: "It always feels like something is overdue" },
              ].map(({ problem, consequence }) => (
                <li key={problem} className="flex items-start gap-3">
                  <div className="w-1.5 h-1.5 rounded-full bg-red-400/50 flex-shrink-0 mt-2" />
                  <div>
                    <p className="text-[14px] font-semibold text-white/65 leading-snug">{problem}</p>
                    <p className="text-[13px] text-white/32 leading-snug mt-0.5">{consequence}</p>
                  </div>
                </li>
              ))}
            </ul>
          </div>
        </div>
      </section>

      {/* ── Why Homeowners Are Switching ── */}
      <section
        className="relative w-full overflow-hidden py-10 sm:py-13 lg:py-12"
        style={{ background: "linear-gradient(180deg, #080F1E 0%, #060C18 100%)" }}
      >
        <div
          aria-hidden="true"
          className="absolute top-0 left-0 right-0 h-px"
          style={{ background: "linear-gradient(90deg, transparent, rgba(48,110,236,0.18), transparent)" }}
        />

        <div className="mx-auto max-w-[1280px] px-4 sm:px-6 lg:px-8">

          <div className="text-center mb-8 sm:mb-16">
            <div className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/[0.04] px-4 py-1.5 mb-5">
              <span className="text-[11px] font-bold uppercase tracking-[0.2em] text-white/45">
                The Smarter System
              </span>
            </div>
            <h2 className="text-[26px] sm:text-[36px] font-extrabold text-white leading-[1.08] tracking-[-0.03em]">
              Why homeowners are
              <br className="hidden sm:block" />
              <span className="text-[#86EFAC]"> switching to membership</span>
            </h2>
            <p className="text-[15px] sm:text-[17px] text-white/45 mt-4 max-w-[500px] mx-auto leading-relaxed">
              The old way was reactive. This is proactive. Here&rsquo;s the difference in practice.
            </p>
          </div>

          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-5 max-w-[1080px] mx-auto">
            {WHY_BETTER.map(({ icon, headline, body }) => (
              <div
                key={headline}
                className="rounded-[14px] border border-white/[0.08] p-7"
                style={{ background: "rgba(255,255,255,0.03)" }}
              >
                <div
                  className="w-10 h-10 rounded-[12px] flex items-center justify-center mb-5 text-[#7BAEFF]"
                  style={{ background: "rgba(48,110,236,0.12)", border: "1px solid rgba(48,110,236,0.22)" }}
                >
                  {icon}
                </div>
                <h3 className="text-[16px] font-bold text-white mb-2 leading-snug">{headline}</h3>
                <p className="text-[14px] text-white/50 leading-[1.65]">{body}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── Why We Built Profixter ── */}
      <section
        className="relative w-full overflow-hidden py-8 sm:py-11"
        style={{ background: "linear-gradient(180deg, #060C18 0%, #080F1E 100%)" }}
      >
        <div className="mx-auto max-w-[760px] px-4 sm:px-6 lg:px-8 text-center">
          <p className="text-[11px] font-bold uppercase tracking-[0.2em] text-white/28 mb-5">The Origin</p>
          <h3 className="text-[23px] sm:text-[30px] font-extrabold text-white leading-[1.12] tracking-[-0.025em] mb-6">
            Why we built Profixter
          </h3>
          <blockquote className="text-[16px] sm:text-[18px] text-white/60 leading-[1.72] max-w-[620px] mx-auto">
            &ldquo;After years in home improvement, we saw the same problem over and over &mdash; homeowners constantly chasing handymen for small jobs, wasting time, and overpaying for each visit.
            <br /><br />
            There was no system. Just chaos every time something needed fixing.
            <br /><br />
            Profixter was built to fix that.&rdquo;
          </blockquote>
          <p className="mt-6 text-[13px] font-bold text-white/35">
            - Taras Bandura, Founder &middot; Licensed HI-71484 &middot; 9+ Years on Long Island
          </p>
        </div>
      </section>

      {/* ── Important to Know ── */}
      <section
        className="relative w-full overflow-hidden py-8 sm:py-11"
        style={{ background: "linear-gradient(180deg, #060C18 0%, #080F1E 100%)" }}
      >
        <div className="mx-auto max-w-[860px] px-4 sm:px-6 lg:px-8">
          <div
            className="rounded-[16px] border border-[#306EEC]/20 p-7 sm:p-9"
            style={{ background: "rgba(48,110,236,0.05)" }}
          >
            <div className="flex items-center gap-3 mb-6">
              <div
                className="w-9 h-9 rounded-full flex items-center justify-center flex-shrink-0"
                style={{ background: "rgba(48,110,236,0.14)", border: "1px solid rgba(48,110,236,0.25)" }}
              >
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" aria-hidden="true">
                  <circle cx="12" cy="12" r="10" stroke="#7BAEFF" strokeWidth="1.8" />
                  <path d="M12 8v4M12 16h.01" stroke="#7BAEFF" strokeWidth="2" strokeLinecap="round" />
                </svg>
              </div>
              <h3 className="text-[18px] sm:text-[19px] font-extrabold text-white">Important to Know</h3>
            </div>
            <div className="grid sm:grid-cols-2 gap-4">
              {EXPECTATIONS.map(({ icon, text }) => (
                <div key={text} className="flex items-start gap-3">
                  <span className="text-[18px] flex-shrink-0 mt-0.5">{icon}</span>
                  <span className="text-[14px] sm:text-[15px] text-white/65 leading-snug">{text}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>
    </>
  );
}
