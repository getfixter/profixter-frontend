"use client";

/**
 * Two more page shapes, so the character can be judged against more than one.
 *
 * The homepage mock is a generous layout: a wide dark hero, a big empty
 * right-hand column, short list rows. It is the easy case, and a system tuned
 * only against it would look intelligent for entirely accidental reasons.
 *
 * These are the awkward cases. The article is a single narrow measure of dense
 * prose with almost no horizontal slack — the place where "stand somewhere
 * empty" nearly runs out of answers. The pricing page is the opposite problem:
 * plenty of room, but nearly all of it inside cards with a button at the bottom,
 * where the empty-looking gaps are the ones a reader is about to click through.
 *
 * Neither is pretty and neither is meant to be. They exist to answer one
 * question: does he stay clear of what matters when the page underneath him is
 * shaped nothing like the one he was built against?
 *
 * Lab only. Nothing here is imported by the public site.
 */

const PARAS = [
  "A loose hinge is rarely just a loose hinge. By the time a door starts catching on its frame the screws have usually been working themselves out for months, and the fix is less about force than about patience: back the screw out, plug the hole, and drive it again into something solid.",
  "The same is true of almost everything on this list. Nothing here is difficult in isolation. What makes them pile up is that each one needs a trip, a tool and half an afternoon, and none of them is ever quite urgent enough to be the thing you do on a Saturday.",
  "That is the whole argument for having someone who already knows the house. The second visit is faster than the first, and the fifth faster still, because nobody has to work out where the stopcock is or which breaker feeds the kitchen.",
  "We keep a short written record of every visit: what was done, what was noticed, and what is worth watching. It is not a formal survey. It is the sort of thing a good neighbour would mention on the way out.",
  "Most of what we are called for costs less in parts than it does in attention. A washer, a bracket, a length of sealant. The expensive part was always the finding, the scheduling and the waiting in.",
];

function Para({ children }: { children: React.ReactNode }) {
  return <p className="mb-5 text-[17px] leading-[1.65] text-[#333]">{children}</p>;
}

/** A long, narrow, text-heavy page: the hardest case for finding free space. */
export function LabArticlePage() {
  return (
    <div className="bg-white text-[#111]">
      <header className="sticky top-0 z-20 border-b border-[#EDEDF0] bg-white/95 px-5 py-3 backdrop-blur">
        <div className="mx-auto flex max-w-[780px] items-center justify-between">
          <span className="text-[15px] font-extrabold tracking-[-0.02em]">
            <span className="text-[#306EEC]">PRO</span>FIXTER
          </span>
          <nav className="hidden gap-6 text-[14px] text-[#555] sm:flex">
            <span>Guides</span>
            <span>Membership</span>
            <span>Book</span>
          </nav>
        </div>
      </header>

      <article className="mx-auto max-w-[780px] px-5 py-10">
        <p className="mb-3 text-[12px] font-bold uppercase tracking-[0.14em] text-[#306EEC]">
          Guide
        </p>
        <h1 className="mb-6 text-[34px] font-extrabold leading-[1.15] tracking-[-0.02em] sm:text-[44px]">
          The jobs that never quite reach the top of the list
        </h1>
        <p className="mb-8 border-l-2 border-[#306EEC] pl-4 text-[19px] leading-[1.55] text-[#444]">
          Six small repairs, why they wait, and what it actually takes to clear
          them in an afternoon.
        </p>

        {PARAS.map((text, index) => (
          <div key={index}>
            <Para>{text}</Para>
            {index === 1 && (
              <div className="my-8 aspect-[16/9] w-full rounded-xl bg-gradient-to-br from-[#1a2740] to-[#0B1628]" />
            )}
            {index === 3 && (
              <h2 className="mb-4 mt-10 text-[26px] font-bold tracking-[-0.01em]">
                What we check on a first visit
              </h2>
            )}
          </div>
        ))}

        <ul className="mb-10 text-[17px] text-[#333]">
          {[
            "Doors and hinges",
            "Visible plumbing",
            "Accessible electrics",
            "Sealant and grout",
            "Anything mounted to a wall",
          ].map((item) => (
            <li key={item} className="border-b border-[#EDEDF0] py-2.5">
              {item}
            </li>
          ))}
        </ul>

        <Para>{PARAS[0]}</Para>
        <Para>{PARAS[2]}</Para>

        <div className="my-10 rounded-2xl bg-[#F5F5F7] p-6">
          <p className="mb-3 text-[18px] font-bold">Book a first visit</p>
          <p className="mb-5 text-[15px] text-[#555]">
            Ninety minutes, free, no card required.
          </p>
          <button
            type="button"
            className="min-h-[44px] rounded-xl bg-[#306EEC] px-5 text-[15px] font-semibold text-white"
          >
            Book your free visit
          </button>
        </div>

        <Para>{PARAS[4]}</Para>
        <Para>{PARAS[1]}</Para>
      </article>

      <footer className="border-t border-[#EDEDF0] bg-[#F5F5F7] px-5 py-10">
        <div className="mx-auto max-w-[780px] text-[13px] text-[#777]">
          Profixter · Long Island
        </div>
      </footer>
    </div>
  );
}

function Plan({
  name,
  price,
  features,
  featured,
}: {
  name: string;
  price: string;
  features: string[];
  featured?: boolean;
}) {
  return (
    <div
      className={`flex flex-col rounded-2xl border p-6 ${
        featured
          ? "border-[#306EEC] bg-[#0B1628] text-white"
          : "border-[#E5E5EA] bg-white"
      }`}
    >
      <p className="text-[13px] font-bold uppercase tracking-[0.1em] opacity-70">
        {name}
      </p>
      <p className="mb-1 mt-3 text-[38px] font-extrabold leading-none">{price}</p>
      <p className={`mb-5 text-[13px] ${featured ? "text-white/60" : "text-[#777]"}`}>
        per month
      </p>
      <ul className="mb-6 flex-1 text-[14px]">
        {features.map((feature) => (
          <li
            key={feature}
            className={`py-1.5 ${featured ? "text-white/85" : "text-[#444]"}`}
          >
            {feature}
          </li>
        ))}
      </ul>
      <button
        type="button"
        className={`min-h-[44px] w-full rounded-xl text-[15px] font-semibold ${
          featured
            ? "bg-[#306EEC] text-white"
            : "border border-[#0B1628] text-[#0B1628]"
        }`}
      >
        Choose {name}
      </button>
    </div>
  );
}

/** A card grid with a control in every card: lots of space, little of it free. */
export function LabPricingPage() {
  return (
    <div className="bg-white text-[#111]">
      <header className="border-b border-[#EDEDF0] px-5 py-3">
        <div className="mx-auto flex max-w-[1120px] items-center justify-between">
          <span className="text-[15px] font-extrabold tracking-[-0.02em]">
            <span className="text-[#306EEC]">PRO</span>FIXTER
          </span>
          <button
            type="button"
            className="min-h-[38px] rounded-lg border border-[#D8D8DD] px-4 text-[14px] font-semibold"
          >
            Log In
          </button>
        </div>
      </header>

      <section className="bg-[#F5F5F7] px-5 py-14 text-center">
        <h1 className="mx-auto mb-4 max-w-[760px] text-[34px] font-extrabold leading-[1.15] tracking-[-0.02em] sm:text-[46px]">
          One plan, the whole house
        </h1>
        <p className="mx-auto max-w-[560px] text-[17px] leading-[1.55] text-[#555]">
          Every plan includes the same team, the same record of your home, and
          the same promise about turning up.
        </p>
      </section>

      <section className="px-5 py-12">
        <div className="mx-auto grid max-w-[1120px] gap-5 sm:grid-cols-2 lg:grid-cols-3">
          <Plan
            name="Basic"
            price="$39"
            features={["Two visits a year", "Small repairs included", "Parts at cost"]}
          />
          <Plan
            name="Home"
            price="$79"
            featured
            features={[
              "Four visits a year",
              "Priority scheduling",
              "Parts at cost",
              "Written record of every visit",
            ]}
          />
          <Plan
            name="Full"
            price="$129"
            features={[
              "Monthly visits",
              "Same-week callouts",
              "Parts at cost",
              "Seasonal checks",
            ]}
          />
        </div>
      </section>

      <section className="px-5 pb-16">
        <div className="mx-auto max-w-[1120px] overflow-hidden rounded-2xl border border-[#E5E5EA]">
          <div className="grid grid-cols-4 bg-[#F5F5F7] px-5 py-3 text-[13px] font-bold">
            <span>What is included</span>
            <span>Basic</span>
            <span>Home</span>
            <span>Full</span>
          </div>
          {[
            ["Visits a year", "2", "4", "12"],
            ["Priority scheduling", "—", "Yes", "Yes"],
            ["Same-week callouts", "—", "—", "Yes"],
            ["Written visit record", "—", "Yes", "Yes"],
            ["Seasonal checks", "—", "—", "Yes"],
          ].map((row) => (
            <div
              key={row[0]}
              className="grid grid-cols-4 border-t border-[#EDEDF0] px-5 py-3 text-[15px]"
            >
              {row.map((cell, index) => (
                <span key={index} className={index === 0 ? "text-[#333]" : "text-[#666]"}>
                  {cell}
                </span>
              ))}
            </div>
          ))}
        </div>
      </section>

      <footer className="border-t border-[#EDEDF0] bg-[#F5F5F7] px-5 py-10">
        <div className="mx-auto max-w-[1120px] text-[13px] text-[#777]">
          Profixter · Long Island
        </div>
      </footer>
    </div>
  );
}
