"use client";

import { useCallback, useSyncExternalStore } from "react";
import { registerAnchor } from "./lab-page-anchors";
import {
  getSettledVersion,
  isObjectLatched,
  subscribeObjectSettled,
} from "./lab-object-state";
import { ROW_JOBS } from "./lab-page-jobs";

/**
 * A mock of the Profixter homepage, for the Lab only.
 *
 * Deliberately a copy rather than the real thing. It imports nothing from
 * app/components/sections, takes no props from production, and renders no live
 * data — so there is no path, however indirect, by which experimenting here can
 * reach the page customers see. Duplication is the isolation.
 *
 * It is close enough in type, colour and rhythm to answer the only question
 * being asked: would a small person walking around this page look like he
 * belongs, or like a widget somebody dropped on top of it. Every element a job
 * hangs from registers itself as an anchor; nothing else about it is special.
 *
 * One deliberate omission: the real page reveals sections on scroll with a
 * transform. Anchors are measured from layout, so an element that slides into
 * place would drag its job with it. Everything here is statically positioned.
 */

/* ------------------------------------------------------------------ pieces */

function useAnchor(id: string) {
  return useCallback(
    (element: HTMLElement | null) => {
      /* Stamped as well as registered, so the anchor a job hangs from can be
         found from outside — in a browser inspector, or a test. */
      if (element) element.setAttribute("data-fx-anchor", id);
      registerAnchor(id, element);
    },
    [id]
  );
}

function Logo() {
  return (
    <span className="inline-flex flex-col rounded-[6px] bg-[#0B1628] px-2.5 py-1.5 leading-none">
      <span className="text-[15px] font-extrabold tracking-[-0.02em]">
        <span className="text-[#306EEC]">PRO</span>
        <span className="text-white">FIXTER</span>
      </span>
      <span className="mt-0.5 text-[7px] font-medium text-white/70">
        Long Island
      </span>
    </span>
  );
}

function Eyebrow({
  children,
  tone = "dark",
  anchorId,
}: {
  children: React.ReactNode;
  tone?: "dark" | "light";
  anchorId?: string;
}) {
  const ref = useAnchor(anchorId ?? "");
  return (
    <p
      ref={anchorId ? ref : undefined}
      className={`text-[11px] font-semibold uppercase tracking-[0.14em] sm:text-[12px] ${
        tone === "light" ? "text-[#8FB6FF]" : "text-[#306EEC]"
      }`}
    >
      {children}
    </p>
  );
}

function H2({ children }: { children: React.ReactNode }) {
  return (
    <h2 className="mt-4 text-balance text-[23px] font-semibold leading-[1.1] tracking-[-0.03em] text-[#111111] sm:text-[30px] lg:text-[32px]">
      {children}
    </h2>
  );
}

function Lede({ children }: { children: React.ReactNode }) {
  return (
    <p className="mt-5 max-w-[48ch] text-pretty text-[16px] leading-[1.55] text-[#6E6E73] sm:text-[17px]">
      {children}
    </p>
  );
}

/**
 * A checklist row.
 *
 * The box ticks itself when the Fixter finishes the job that belongs to this
 * row. It is the one place where the 3D layer reaches back into the DOM, and it
 * is the whole argument for the experiment: the character is not decorating the
 * page, he is changing it.
 */
function ListRow({
  text,
  anchorId,
  done,
}: {
  text: string;
  anchorId?: string;
  done: boolean;
}) {
  const ref = useAnchor(anchorId ?? "");
  return (
    <li ref={anchorId ? ref : undefined}>
      {/*
          The right padding is the lane. On a phone a full-measure row runs
          almost to the edge and there is nowhere for him to work without
          standing on the last two words; a slightly smaller type size and
          ninety pixels of margin give him somewhere to be. It costs the page
          nothing, and it is the difference between a character living here and
          a character in the way.
        */}
        <span className="flex items-center gap-3 border-b border-[#EDEDF0] py-2.5 pr-[92px] text-[15px] leading-[1.35] text-[#1D1D1F] sm:py-3 sm:text-[17px] lg:py-[18px] lg:pr-0 lg:text-[18px]">
        <span
          aria-hidden="true"
          className={`flex h-[19px] w-[19px] flex-none items-center justify-center rounded-[6px] border-[1.5px] transition-colors duration-500 ${
            done
              ? "border-[#306EEC] bg-[#306EEC]"
              : "border-[#D8D8DD] bg-transparent"
          }`}
        >
          <svg
            viewBox="0 0 12 12"
            className={`h-[11px] w-[11px] text-white transition-opacity duration-300 ${
              done ? "opacity-100" : "opacity-0"
            }`}
            fill="none"
            stroke="currentColor"
            strokeWidth="2.2"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <path d="M2.5 6.4 4.8 8.7 9.5 3.6" />
          </svg>
        </span>
        <span
          className={`transition-colors duration-500 ${
            done ? "text-[#A1A1A6] line-through decoration-[#D8D8DD]" : ""
          }`}
        >
          {text}
        </span>
      </span>
    </li>
  );
}

/** The booking widget from the real hero, as a still. */
function BookingCard() {
  const ref = useAnchor("hero-card");
  return (
    <div
      ref={ref}
      className="w-full max-w-[380px] overflow-hidden rounded-[14px] bg-white shadow-[0_30px_70px_-30px_rgba(0,0,0,0.6)]"
    >
      <div className="border-b border-[#EDEDF0] px-5 py-3.5 text-[14px] font-semibold text-[#111111]">
        Book your visit
      </div>
      <div className="px-5 py-4">
        <div className="flex items-center justify-between">
          <span className="text-[13px] font-semibold text-[#111111]">
            August
          </span>
          <span className="flex gap-1">
            <span className="h-1.5 w-1.5 rounded-full bg-[#D8D8DD]" />
            <span className="h-1.5 w-1.5 rounded-full bg-[#D8D8DD]" />
          </span>
        </div>
        <div className="mt-3 grid grid-cols-7 gap-y-1.5 text-center text-[11px]">
          {["S", "M", "T", "W", "T", "F", "S"].map((d, i) => (
            <span key={i} className="text-[#A1A1A6]">
              {d}
            </span>
          ))}
          {Array.from({ length: 31 }, (_, i) => i + 1).map((day) => {
            const open = day % 7 !== 0 && day % 7 !== 2;
            const picked = day === 13;
            return (
              <span
                key={day}
                className={`mx-auto flex h-[22px] w-[22px] items-center justify-center rounded-[6px] tabular-nums ${
                  picked
                    ? "bg-[#306EEC] font-semibold text-white"
                    : open
                      ? "font-medium text-[#306EEC]"
                      : "text-[#C7C7CC]"
                }`}
              >
                {day}
              </span>
            );
          })}
        </div>
        <div className="mt-4 flex gap-2">
          {["8:00 AM", "10:00 AM", "12:00 PM"].map((t, i) => (
            <span
              key={t}
              className={`flex-1 rounded-[6px] px-2 py-1.5 text-center text-[11px] font-semibold ${
                i === 0
                  ? "bg-[#0B1628] text-white"
                  : "border border-[#E5E5EA] text-[#6E6E73]"
              }`}
            >
              {t}
            </span>
          ))}
        </div>
        <div className="mt-4 rounded-[8px] bg-[#F5F5F7] px-3.5 py-3">
          <p className="text-[9.5px] font-semibold uppercase tracking-[0.12em] text-[#A1A1A6]">
            What needs doing
          </p>
          <p className="mt-1 text-[13px] text-[#111111]">
            Bedroom door doesn&rsquo;t close right
          </p>
        </div>
      </div>
      <div className="flex items-center justify-between bg-[#306EEC] px-5 py-3">
        <span className="text-[14px] font-semibold text-white">Book visit</span>
        <span className="text-[14px] font-semibold text-white">$0</span>
      </div>
    </div>
  );
}

/* -------------------------------------------------------------------- page */

/**
 * The checklist, ordered so the three rows that host a job land in the same
 * column and two apart.
 *
 * The grid fills row-wise, so items 2, 4 and 6 are the right-hand column on a
 * wide screen — the one with clear space to the right of the text and nothing
 * underneath it. Put a job in the left column instead and he ends up standing
 * on "None of it is worth hunting down a contractor for."
 */
const THE_LIST: { text: string; anchorId?: string }[] = [
  { text: "A door that doesn't close right", anchorId: "row-door" },
  { text: "A cabinet handle working loose", anchorId: "row-cabinet" },
  { text: "Caulk around the tub gone grey" },
  { text: "A light fixture you meant to swap", anchorId: "row-lamp" },
  { text: "The TV still waiting to go up" },
  { text: "The shelf still in its box", anchorId: "row-shelf" },
];

const STEPS = [
  { n: "01", title: "Book it", body: "Pick a day and time, say what needs doing, add a photo." },
  { n: "02", title: "We come", body: "The same local team arrives ready, with the right tools." },
  { n: "03", title: "It's done", body: "One less thing on the list. Book the next when you're ready." },
];

const MEMBERSHIP_VALUE = [
  "Book online whenever something comes up",
  "The same local team, learning your home",
  "Small fixes and maintenance, no estimates",
  "One predictable monthly price",
  "Benefits that get better the longer you stay",
];

export default function LabHomepage() {
  const heroCta = useAnchor("hero-cta");
  const membershipHeading = useAnchor("membership-heading");

  /*
   * One subscription for the whole list. The store fires when an object crosses
   * the line between broken and mended — twice a job, not sixty times a second
   * — so the rows can be ordinary React without costing anything.
   */
  useSyncExternalStore(
    subscribeObjectSettled,
    getSettledVersion,
    () => 0
  );

  return (
    <div className="bg-white text-[#111111]">
      {/* ============================== HEADER ============================ */}
      {/*
        z-50, above the 3D layer's z-40. A sticky header is chrome: the
        character and his props have to slide underneath it, not over it.
        Without this a wall outlet drifts across the navigation on a phone.
      */}
      <header className="sticky top-0 z-50 border-b border-[#EDEDF0] bg-white/95 backdrop-blur">
        <div className="mx-auto flex max-w-[1120px] items-center justify-between gap-4 px-5 py-2.5 sm:px-6">
          <Logo />
          <nav className="hidden items-center gap-7 text-[14px] font-semibold text-[#1D1D1F] lg:flex">
            {["Membership", "What we do", "Book", "Projects", "About Us"].map(
              (item) => (
                <button key={item} type="button" className="hover:text-[#306EEC]">
                  {item}
                </button>
              )
            )}
          </nav>
          <div className="flex items-center gap-2">
            <button
              type="button"
              className="hidden min-h-[38px] items-center rounded-[8px] bg-[#306EEC] px-4 text-[14px] font-semibold text-white hover:bg-[#2558C9] sm:inline-flex"
            >
              Book your free visit
            </button>
            <button
              type="button"
              className="inline-flex min-h-[38px] items-center rounded-[8px] border border-[#D2D2D7] px-4 text-[14px] font-semibold text-[#1D1D1F] hover:bg-[#F5F5F7]"
            >
              Log In
            </button>
          </div>
        </div>
      </header>

      {/* =============================== HERO ============================= */}
      <section className="relative bg-[#080E18]">
        <div
          aria-hidden="true"
          className="absolute inset-0 bg-[radial-gradient(120%_80%_at_50%_0%,rgba(48,110,236,0.20)_0%,transparent_60%)]"
        />
        <div /*
              Extra bottom padding on a phone only. A mobile hero is packed
              solid — eyebrow, headline, paragraph, button, small print — and
              the character had nowhere to stand that was not on top of a
              sentence. The page gives him a strip of its own.
            */
            className="relative mx-auto grid max-w-[1120px] gap-8 px-5 pb-32 pt-12 sm:px-6 sm:pb-16 sm:pt-16 lg:grid-cols-[1.05fr_0.95fr] lg:items-start lg:gap-10 lg:pb-24 lg:pt-20">
          <div>
            <Eyebrow tone="light" anchorId="hero-eyebrow">
              Handyman membership · Long Island
            </Eyebrow>
            <h1 className="mt-3.5 text-balance text-[30px] font-semibold leading-[1.06] tracking-[-0.035em] text-white sm:text-[36px] lg:text-[40px]">
              A handyman you don&rsquo;t have to find.
            </h1>
            <p className="mt-3.5 max-w-[42ch] text-pretty text-[15.5px] leading-[1.5] text-white/65 sm:mt-4 sm:text-[17px]">
              Small jobs keep coming up around a house. Book them whenever they
              do, and the same local team takes care of them.
            </p>

            <div
              ref={heroCta}
              className="mt-6 flex flex-col gap-3 sm:mt-7 sm:flex-row sm:items-center"
            >
              <button
                type="button"
                className="inline-flex min-h-[44px] w-full items-center justify-center rounded-[8px] bg-[#306EEC] px-5 text-[15px] font-semibold text-white shadow-[0_12px_28px_-8px_rgba(48,110,236,0.55)] hover:bg-[#2558C9] sm:w-auto"
              >
                Book your free visit
              </button>
              <button
                type="button"
                className="hidden min-h-[44px] items-center justify-center rounded-[8px] border border-white/25 px-5 text-[15px] font-semibold text-white hover:bg-white/10 sm:inline-flex"
              >
                How it works
              </button>
            </div>

            <p className="mt-4 text-[13.5px] leading-[1.5] text-white/45">
              Your first 90-minute visit is free. No card required.
            </p>
          </div>

          <div className="hidden lg:flex lg:justify-end">
            <div className="relative">
              <div
                aria-hidden="true"
                className="absolute -inset-8 rounded-full bg-[#306EEC]/18 blur-3xl"
              />
              <div className="relative">
                <BookingCard />
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ============================ THE LIST ============================ */}
      <section className="px-5 py-11 sm:px-6 sm:py-14">
        <div className="mx-auto max-w-[1120px]">
          <Eyebrow>The list</Eyebrow>
          <H2>There&rsquo;s always something.</H2>

          {/*
            Two columns at lg, not at sm. The real page splits at 640px; at that
            width each column is barely wider than its own text and there is
            nowhere for him to stand. One column until there is room for two and
            a lane.
          */}
          <ul className="mt-7 grid grid-cols-1 gap-x-14 sm:mt-8 lg:grid-cols-2">
            {THE_LIST.map((item) => (
              <ListRow
                key={item.text}
                text={item.text}
                anchorId={item.anchorId}
                done={
                  item.anchorId
                    ? isObjectLatched(ROW_JOBS[item.anchorId] ?? "")
                    : false
                }
              />
            ))}
          </ul>

          <p className="mt-7 max-w-[46ch] text-[16px] leading-[1.55] text-[#6E6E73] sm:text-[17px]">
            None of it is worth hunting down a contractor for. So it waits.
          </p>
        </div>
      </section>

      {/* =========================== MEMBERSHIP =========================== */}
      <section className="bg-[#080F1E] px-5 py-12 sm:px-6 sm:py-16">
        <div className="mx-auto max-w-[1120px] text-white">
          <Eyebrow tone="light">Membership</Eyebrow>
          <h2
            ref={membershipHeading}
            className="mt-4 max-w-[18ch] text-balance text-[26px] font-semibold leading-[1.08] tracking-[-0.035em] sm:text-[34px] lg:text-[36px]"
          >
            One team that already knows your house.
          </h2>
          <p className="mt-5 max-w-[52ch] text-pretty text-[17px] leading-[1.5] text-white/60 sm:text-[19px]">
            Instead of finding someone each time, you have a company already set
            up for your home &mdash; mounting, repairs, installations,
            replacements, adjustments and maintenance.
          </p>
        </div>
      </section>

      {/* ========================== HOW IT WORKS ========================== */}
      <section className="bg-[#F5F5F7] px-5 py-11 sm:px-6 sm:py-14">
        <div className="mx-auto max-w-[1120px]">
          <Eyebrow>How it works</Eyebrow>
          <H2>Book it. We come. It&rsquo;s done.</H2>
          <ol className="mt-7 max-w-[640px] sm:mt-9">
            {STEPS.map((s) => (
              <li key={s.n}>
                <span className="flex gap-5 border-t border-[#DEDEE3] py-5 sm:py-7">
                  <span className="pt-0.5 text-[13px] font-semibold tabular-nums text-[#306EEC]">
                    {s.n}
                  </span>
                  <span className="block">
                    <span className="block text-[19px] font-semibold tracking-[-0.02em] text-[#111111] sm:text-[21px]">
                      {s.title}
                    </span>
                    <span className="mt-1.5 block max-w-[34ch] text-[16px] leading-[1.5] text-[#6E6E73]">
                      {s.body}
                    </span>
                  </span>
                </span>
              </li>
            ))}
          </ol>
        </div>
      </section>

      {/* ========================== WHAT IT COSTS ========================= */}
      <section className="px-5 py-11 sm:px-6 sm:py-14">
        <div className="mx-auto max-w-[820px]">
          <Eyebrow>What it costs</Eyebrow>
          <H2>Membership starts at $149 a month.</H2>
          <Lede>
            Month to month, cancel any time. What you are paying for is not a
            discount on a call-out &mdash; it is not having to find, vet and
            brief somebody every time the house needs something.
          </Lede>
          <ul className="mt-7 grid gap-x-8 gap-y-3 sm:grid-cols-2">
            {MEMBERSHIP_VALUE.map((item) => (
              <li
                key={item}
                className="flex items-start gap-2.5 text-[15px] leading-[1.5] text-[#3C4453]"
              >
                <span
                  aria-hidden="true"
                  className="mt-[8px] h-1.5 w-1.5 shrink-0 rounded-full bg-[#306EEC]"
                />
                {item}
              </li>
            ))}
          </ul>
          <div className="mt-7 flex flex-col gap-3 sm:flex-row">
            <button
              type="button"
              className="inline-flex min-h-[44px] items-center justify-center rounded-[8px] border border-[#D2D2D7] px-5 text-[15px] font-semibold text-[#1D1D1F] hover:bg-[#F5F5F7]"
            >
              Compare plans
            </button>
            <button
              type="button"
              className="inline-flex min-h-[44px] items-center justify-center rounded-[8px] border border-[#D2D2D7] px-5 text-[15px] font-semibold text-[#1D1D1F] hover:bg-[#F5F5F7]"
            >
              See Loyalty Benefits
            </button>
          </div>
        </div>
      </section>

      {/* ============================== TRUST ============================= */}
      <section className="px-5 pb-14 sm:px-6 sm:pb-16">
        <div className="mx-auto max-w-[1120px]">
          <Eyebrow>Who comes to your home</Eyebrow>
          <H2>A local company, not a marketplace.</H2>
          <Lede>
            ProFixter is based near Babylon and serves Nassau and Suffolk. You
            work with the same company each time, so nobody has to learn your
            house twice.
          </Lede>
          <dl className="mt-6 grid grid-cols-1 gap-px overflow-hidden rounded-[8px] border border-[#E5E5EA] bg-[#E5E5EA] sm:grid-cols-3">
            {[
              ["Licensed", "NY HIC HI-71484"],
              ["Insured", "For in-home work"],
              ["Serving", "Nassau & Suffolk"],
            ].map(([k, v]) => (
              <div key={k} className="bg-white px-5 py-4">
                <dt className="text-[12px] font-semibold uppercase tracking-[0.1em] text-[#A1A1A6]">
                  {k}
                </dt>
                <dd className="mt-1 text-[15px] font-semibold text-[#111111]">
                  {v}
                </dd>
              </div>
            ))}
          </dl>
        </div>
      </section>

      {/* ============================= FOOTER ============================= */}
      <footer className="border-t border-[#EDEDF0] bg-[#F5F5F7] px-5 py-9 sm:px-6">
        <div className="mx-auto flex max-w-[1120px] flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <Logo />
          <p className="text-[13px] text-[#6E6E73]">
            Lab mock &middot; not the production homepage
          </p>
        </div>
      </footer>
    </div>
  );
}
