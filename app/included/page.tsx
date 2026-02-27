"use client";

import Link from "next/link";
import { useMemo, useState } from "react";

type TimeBand = "10–30 min" | "30–60 min" | "60–90 min";

type Item = {
  title: string;
  desc: string;
  category:
    | "Repairs"
    | "Assembly"
    | "Install"
    | "Plumbing"
    | "Electrical"
    | "Walls"
    | "Doors & Windows"
    | "Kitchen & Bath"
    | "Exterior"
    | "Smart Home"
    | "Maintenance"
    | "Seasonal"
    | "Commercial"
    | "Other";
  time: TimeBand;
  popular?: boolean;
  tags?: string[];
};

const CATEGORIES: Array<Item["category"] | "All"> = [
  "All",
  "Repairs",
  "Assembly",
  "Install",
  "Plumbing",
  "Electrical",
  "Walls",
  "Doors & Windows",
  "Kitchen & Bath",
  "Exterior",
  "Smart Home",
  "Maintenance",
  "Seasonal",
  "Commercial",
  "Other",
];

const INCLUDED: Item[] = [
  // ✅ POPULAR
  {
    title: "TV Mount (standard)",
    desc: "Mount TV + bracket on studs when possible. Basic cable tidy (in-wall extra).",
    category: "Install",
    time: "60–90 min",
    popular: true,
    tags: ["tv", "mount", "bracket"],
  },
  {
    title: "Fix a running toilet (basic)",
    desc: "Adjust/replace flapper/chain, fill valve swap if standard (parts extra).",
    category: "Plumbing",
    time: "30–60 min",
    popular: true,
    tags: ["toilet", "running", "flapper"],
  },
  {
    title: "Hang pictures / mirrors (secure + level)",
    desc: "Anchors/studs, align and level, safe mounting.",
    category: "Install",
    time: "10–30 min",
    popular: true,
    tags: ["mirror", "picture", "hang"],
  },
  {
    title: "Replace light fixture (standard swap)",
    desc: "Swap fixture where wiring is safe/standard (fixture extra).",
    category: "Electrical",
    time: "30–60 min",
    popular: true,
    tags: ["light", "fixture"],
  },
  {
    title: "Curtain rods / blinds (basic install)",
    desc: "Install rods/blinds, level + secure.",
    category: "Install",
    time: "30–60 min",
    popular: true,
    tags: ["curtain", "blinds", "rod"],
  },
  {
    title: "Door won’t close / sticky door adjustment",
    desc: "Minor alignment, strike plate adjust, latch issues, squeaks.",
    category: "Doors & Windows",
    time: "30–60 min",
    popular: true,
    tags: ["door", "sticky", "squeak"],
  },

  // Repairs
  {
    title: "Tighten / replace handles, hinges, hardware",
    desc: "Fix wobble, align hardware, adjust fit.",
    category: "Repairs",
    time: "10–30 min",
    tags: ["hinge", "handle", "cabinet", "door"],
  },
  {
    title: "Re-caulk small areas",
    desc: "Tub edge, sink edge, small gaps in bath/kitchen (basic caulk).",
    category: "Kitchen & Bath",
    time: "30–60 min",
    tags: ["caulk", "bathroom", "kitchen"],
  },

  // Walls
  {
    title: "Patch small holes & dents",
    desc: "Small drywall patches, nail holes, minor touch-ups (paint may be extra).",
    category: "Walls",
    time: "30–60 min",
    tags: ["drywall", "hole", "patch", "spackle"],
  },

  // Assembly
  {
    title: "Furniture assembly (typical items)",
    desc: "Chairs, small tables, nightstands, dressers (time depends on item).",
    category: "Assembly",
    time: "60–90 min",
    tags: ["ikea", "furniture", "assembly"],
  },
  {
    title: "Install shelves (simple)",
    desc: "Install standard shelves and brackets into studs/anchors.",
    category: "Install",
    time: "30–60 min",
    tags: ["shelf", "mount", "bracket"],
  },

  // Plumbing (light)
  {
    title: "Replace faucet (simple swap)",
    desc: "Swap kitchen/bath faucet if accessible (parts extra).",
    category: "Plumbing",
    time: "60–90 min",
    tags: ["faucet", "sink"],
  },
  {
    title: "Replace showerhead",
    desc: "Install new showerhead, tape/seal, check for small leaks.",
    category: "Plumbing",
    time: "10–30 min",
    tags: ["shower", "showerhead"],
  },
  {
    title: "Unclog sink drain (simple)",
    desc: "Basic clog clearing (severe clogs may need plumber).",
    category: "Plumbing",
    time: "30–60 min",
    tags: ["clog", "drain", "sink"],
  },

  // Electrical (light)
  {
    title: "Replace switches / outlets (basic)",
    desc: "Swap 1–2 outlets/switches if wiring is standard (parts extra).",
    category: "Electrical",
    time: "30–60 min",
    tags: ["outlet", "switch"],
  },

  // Smart Home
  {
    title: "Install smart doorbell / camera (basic)",
    desc: "Mount and connect device + basic setup help.",
    category: "Smart Home",
    time: "30–60 min",
    tags: ["ring", "camera", "doorbell"],
  },

  // Kitchen & Bath
  {
    title: "Replace bathroom accessories",
    desc: "Towel bars, paper holders, hooks, small wall accessories.",
    category: "Kitchen & Bath",
    time: "30–60 min",
    tags: ["towel", "holder", "hook"],
  },

  // Exterior
  {
    title: "Replace door weatherstripping",
    desc: "Reduce drafts, improve seal, basic adjustments.",
    category: "Exterior",
    time: "30–60 min",
    tags: ["weather", "draft", "door"],
  },
  {
    title: "Install house numbers / mailbox (basic)",
    desc: "Secure numbers/mailbox, align and mount.",
    category: "Exterior",
    time: "30–60 min",
    tags: ["mailbox", "numbers"],
  },

  // Maintenance
  {
    title: "Replace air filters + simple maintenance",
    desc: "Filter swaps, tighten/adjust small issues.",
    category: "Maintenance",
    time: "10–30 min",
    tags: ["filter", "maintenance"],
  },
  {
    title: "Mount smoke/CO detectors (battery type)",
    desc: "Mount + test (devices extra).",
    category: "Maintenance",
    time: "10–30 min",
    tags: ["smoke", "co", "detector"],
  },

  // Seasonal
  {
    title: "Weather prep (basic)",
    desc: "Draft blockers, small sealing, tighten doors/windows.",
    category: "Seasonal",
    time: "30–60 min",
    tags: ["winter", "draft"],
  },
  {
    title: "Shovel light snow from walkway/steps",
    desc: "Light clearing for safety (heavy storms may need extra/quote).",
    category: "Seasonal",
    time: "60–90 min",
    tags: ["snow", "shovel"],
  },

  // Commercial
  {
    title: "Small office fixes (basic)",
    desc: "Mount small items, adjust doors, minor repairs.",
    category: "Commercial",
    time: "60–90 min",
    tags: ["office", "commercial"],
  },

  // Other
  {
    title: "“The small annoying thing” visit",
    desc: "If it’s a small fix and fits in 90 minutes — it’s included.",
    category: "Other",
    time: "30–60 min",
    tags: ["small", "quick"],
  },

  // ===================== EXPANDED COMMON HOMEOWNER MAINTENANCE (NO APPLIANCE REPAIR) =====================

  // Doors & Windows
  {
    title: "Fix squeaky hinges / doors",
    desc: "Lubricate hinges, tighten screws, minor adjustments to reduce squeaks.",
    category: "Doors & Windows",
    time: "10–30 min",
    tags: ["squeaky", "hinge", "door"],
  },
  {
    title: "Replace / adjust interior door knob (standard)",
    desc: "Swap knob/lever and ensure latch closes correctly (hardware extra).",
    category: "Doors & Windows",
    time: "30–60 min",
    tags: ["knob", "handle", "door", "lock"],
  },
  {
    title: "Install / adjust door sweep",
    desc: "Add/adjust door bottom sweep to reduce drafts and bugs (parts extra).",
    category: "Exterior",
    time: "30–60 min",
    tags: ["door", "sweep", "draft"],
  },
  {
    title: "Replace basic window locks / latches",
    desc: "Swap common window latches/locks when compatible (parts extra).",
    category: "Doors & Windows",
    time: "30–60 min",
    tags: ["window", "lock", "latch"],
  },
  {
    title: "Install child safety locks (cabinet / drawer)",
    desc: "Install standard child locks to keep cabinets/drawers secure.",
    category: "Maintenance",
    time: "30–60 min",
    tags: ["child", "safety", "cabinet", "drawer"],
  },

  // Walls / mounting
  {
    title: "Mount heavy mirror (secure)",
    desc: "Proper anchors/studs and safe mounting (mirror/hardware extra).",
    category: "Install",
    time: "30–60 min",
    tags: ["mirror", "heavy", "mount"],
  },
  {
    title: "Hang TV (small/medium) + soundbar mount (basic)",
    desc: "Mount TV and a basic soundbar bracket when feasible (hardware extra).",
    category: "Install",
    time: "60–90 min",
    tags: ["tv", "soundbar", "mount"],
  },
  {
    title: "Mount curtain rods (2 windows)",
    desc: "Install rods for up to two standard windows, level + secure.",
    category: "Install",
    time: "60–90 min",
    tags: ["curtain", "rod", "windows"],
  },
  {
    title: "Install floating shelves (standard)",
    desc: "Mount floating shelves securely into studs/anchors (shelves extra).",
    category: "Install",
    time: "60–90 min",
    tags: ["floating", "shelf", "mount"],
  },
  {
    title: "Mount baby gate hardware (wall-mounted)",
    desc: "Install wall-mounted baby gate brackets safely (gate extra).",
    category: "Install",
    time: "30–60 min",
    tags: ["baby", "gate", "safety"],
  },
  {
    title: "Anchor furniture to wall (anti-tip)",
    desc: "Secure dresser/bookcase to reduce tip risk (hardware extra).",
    category: "Maintenance",
    time: "30–60 min",
    tags: ["anchor", "anti-tip", "dresser", "bookcase"],
  },

  // Kitchen & Bath
  {
    title: "Fix loose towel bar / toilet paper holder",
    desc: "Re-anchor properly so it won’t pull out again (anchors extra if needed).",
    category: "Kitchen & Bath",
    time: "10–30 min",
    tags: ["towel", "toilet", "paper", "holder"],
  },
  {
    title: "Replace garbage disposal (standard swap)",
    desc: "Remove old and install new disposal when plumbing/electrical is standard (unit extra).",
    category: "Plumbing",
    time: "60–90 min",
    tags: ["disposal", "garbage", "sink"],
  },
  {
    title: "Install kitchen/bath sink strainer / drain (basic)",
    desc: "Replace strainer/drain hardware if accessible (parts extra).",
    category: "Plumbing",
    time: "30–60 min",
    tags: ["strainer", "drain", "sink"],
  },
  {
    title: "Replace toilet seat",
    desc: "Install new toilet seat and ensure proper fit (seat extra).",
    category: "Plumbing",
    time: "10–30 min",
    tags: ["toilet", "seat"],
  },
  {
    title: "Fix minor toilet leak at base (assessment + basic)",
    desc: "Inspect and tighten; if wax ring needed, we’ll advise (parts extra).",
    category: "Plumbing",
    time: "30–60 min",
    tags: ["toilet", "leak", "base"],
  },
  {
    title: "Replace bathroom fan switch / timer (basic)",
    desc: "Swap standard switch/timer where wiring is standard (parts extra).",
    category: "Electrical",
    time: "30–60 min",
    tags: ["bathroom", "fan", "timer", "switch"],
  },
  {
    title: "Replace shower valve trim (cosmetic trim only)",
    desc: "Replace trim plate/handle when compatible (not inside-wall valve work).",
    category: "Kitchen & Bath",
    time: "30–60 min",
    tags: ["shower", "trim", "handle"],
  },
  {
    title: "Re-caulk tub / shower edge (standard)",
    desc: "Remove failing caulk in small area and re-caulk for clean seal (basic caulk).",
    category: "Kitchen & Bath",
    time: "60–90 min",
    tags: ["caulk", "tub", "shower"],
  },

  // Electrical (light)
  {
    title: "Install ceiling fan (swap existing fixture)",
    desc: "Install fan where existing box/wiring is suitable (fan extra).",
    category: "Electrical",
    time: "60–90 min",
    tags: ["ceiling", "fan"],
  },
  {
    title: "Replace smoke/CO detector (hardwired swap)",
    desc: "Swap compatible hardwired detector (device extra).",
    category: "Electrical",
    time: "30–60 min",
    tags: ["smoke", "co", "hardwired"],
  },
  {
    title: "Install dimmer switch (basic)",
    desc: "Install compatible dimmer for standard lighting (parts extra).",
    category: "Electrical",
    time: "30–60 min",
    tags: ["dimmer", "switch"],
  },
  {
    title: "Replace light switch plate / outlet cover (multiple)",
    desc: "Swap multiple plates/covers for a clean look (covers extra).",
    category: "Electrical",
    time: "10–30 min",
    tags: ["plate", "cover", "outlet", "switch"],
  },

  // Plumbing (light)
  {
    title: "Fix dripping faucet (basic)",
    desc: "Tighten/adjust and replace simple cartridge/washer if standard (parts extra).",
    category: "Plumbing",
    time: "30–60 min",
    tags: ["drip", "faucet", "leak"],
  },
  {
    title: "Replace P-trap (accessible under sink)",
    desc: "Swap standard trap when accessible (parts extra).",
    category: "Plumbing",
    time: "30–60 min",
    tags: ["ptrap", "trap", "sink"],
  },
  {
    title: "Replace supply lines (sink/toilet) - basic",
    desc: "Replace standard flexible supply lines when accessible (parts extra).",
    category: "Plumbing",
    time: "30–60 min",
    tags: ["supply", "line", "toilet", "sink"],
  },

  // Smart home / tech installs
  {
    title: "Install smart thermostat (swap existing)",
    desc: "Install and help connect/app setup when compatible (thermostat extra).",
    category: "Smart Home",
    time: "60–90 min",
    tags: ["thermostat", "nest", "ecobee"],
  },
  {
    title: "Install smart lock (standard door)",
    desc: "Install compatible smart lock and basic setup (lock extra).",
    category: "Smart Home",
    time: "60–90 min",
    tags: ["smart", "lock"],
  },
  {
    title: "Wi-Fi extender / mesh setup help (basic)",
    desc: "Place device and help with basic configuration (equipment extra).",
    category: "Smart Home",
    time: "30–60 min",
    tags: ["wifi", "mesh", "extender"],
  },

  // Exterior / seasonal / maintenance
  {
    title: "Replace mailbox (post-mounted, basic)",
    desc: "Swap standard mailbox when post is solid (mailbox extra).",
    category: "Exterior",
    time: "30–60 min",
    tags: ["mailbox", "post"],
  },
  {
    title: "Install ring doorbell (wired or battery)",
    desc: "Mount doorbell and basic setup assistance (device extra).",
    category: "Smart Home",
    time: "30–60 min",
    tags: ["ring", "doorbell"],
  },
  {
    title: "Replace exterior light fixture (standard swap)",
    desc: "Swap a porch/garage light where wiring is standard (fixture extra).",
    category: "Electrical",
    time: "30–60 min",
    tags: ["exterior", "porch", "light"],
  },
  {
    title: "Weatherstrip windows/doors (basic gaps)",
    desc: "Minor sealing for drafts on accessible areas (materials may be extra).",
    category: "Seasonal",
    time: "60–90 min",
    tags: ["draft", "seal", "weatherstrip"],
  },
  {
    title: "Gutter downspout re-attach (basic)",
    desc: "Reattach a loose downspout / strap when accessible (hardware extra).",
    category: "Exterior",
    time: "30–60 min",
    tags: ["gutter", "downspout"],
  },

  // Assembly / installs
  {
    title: "Assemble shelving unit / storage rack (typical)",
    desc: "Assemble standard storage rack or shelving unit (time depends on item).",
    category: "Assembly",
    time: "60–90 min",
    tags: ["shelving", "rack", "storage", "assembly"],
  },
  {
    title: "Install wall-mounted coat hooks / rack",
    desc: "Secure hooks/rack into studs/anchors (rack extra).",
    category: "Install",
    time: "30–60 min",
    tags: ["coat", "hook", "rack"],
  },

  // Appliance installs (NOT repair)
  {
    title: "Install microwave (countertop or basic over-range)",
    desc: "Install microwave when mount/power is ready and standard (unit extra).",
    category: "Install",
    time: "60–90 min",
    tags: ["microwave", "install"],
  },
  {
    title: "Install dishwasher (basic hookup if ready)",
    desc: "Install dishwasher when plumbing/electric is prepared (unit/parts extra).",
    category: "Plumbing",
    time: "60–90 min",
    tags: ["dishwasher", "install"],
  },
];

const NOT_INCLUDED = [
  {
    title: "Big projects / renovations",
    desc: "Kitchens, bathrooms, full remodels, large carpentry — separate quote.",
  },
  {
    title: "Anything that exceeds 90 minutes",
    desc: "We’ll continue on another visit OR quote it as a project.",
  },
  {
    title: "Major electrical / major plumbing / gas work",
    desc: "Panels, new circuits, major leaks, sewer issues, gas — separate quote / specialist.",
  },
  {
    title: "Roof / structural work",
    desc: "Structural framing, roof repairs, foundation issues — separate quote.",
  },
  {
    title: "Permit-required work (when applicable)",
    desc: "If permits are required, we’ll guide you and quote appropriately.",
  },
  {
    title: "Appliance repair",
    desc: "We don’t repair appliances. We can often install/replace them if the site is ready.",
  },
];

const TIME_BADGE: Record<TimeBand, { label: string; className: string }> = {
  "10–30 min": {
    label: "10–30 min",
    className: "bg-[#ECFDF3] border-[#ABEFC6] text-[#067647]",
  },
  "30–60 min": {
    label: "30–60 min",
    className: "bg-[#EFF8FF] border-[#B2DDFF] text-[#175CD3]",
  },
  "60–90 min": {
    label: "60–90 min",
    className: "bg-[#FFF7ED] border-[#FED7AA] text-[#9A3412]",
  },
};

function includesText(item: Item, q: string) {
  const hay =
    `${item.title} ${item.desc} ${item.category} ${item.time} ${(item.tags || []).join(" ")}`.toLowerCase();
  return hay.includes(q.toLowerCase());
}

export default function IncludedPage() {
  const [query, setQuery] = useState("");
  const [cat, setCat] = useState<(typeof CATEGORIES)[number]>("All");

  const popular = useMemo(() => INCLUDED.filter((x) => x.popular), []);

  const filtered = useMemo(() => {
    return INCLUDED.filter((i) => {
      if (cat !== "All" && i.category !== cat) return false;
      if (query.trim() && !includesText(i, query.trim())) return false;
      return true;
    });
  }, [query, cat]);

  return (
    <div className="min-h-screen bg-white">
      {/* HERO */}
      <div className="bg-[#313234] text-white">
        <div className="max-w-[1240px] mx-auto px-4 sm:px-6 lg:px-[20px] py-12 sm:py-16">
          <div className="flex flex-col gap-5">
            <div className="text-[12px] uppercase tracking-wider text-white/70">
              Mr. Fixter • What’s Included
            </div>

            <h1 className="text-[34px] sm:text-[46px] lg:text-[58px] font-bold leading-[92%] uppercase tracking-[-0.03em]">
              Everything included
              <br />
              <span className="text-[#5E8BFF]">in your plan</span>
            </h1>

            <p className="max-w-[860px] text-white/80 text-[15px] sm:text-[17px] leading-[145%]">
              People get confused because every handyman is different. We make it
              simple:
              <span className="text-white font-semibold">
                {" "}
                no matter the task, each visit is up to 90 minutes.
              </span>{" "}
              If it fits in 90 minutes — it’s included.
            </p>

            <div className="flex flex-col sm:flex-row gap-3 pt-2">
              <a
                href="/#plans"
                className="h-[54px] px-6 rounded-[14px] bg-[#306EEC] hover:bg-[#2558c9] transition-colors font-semibold text-[16px] inline-flex items-center justify-center"
              >
                See plans
              </a>

              <Link
                href="/"
                className="h-[54px] px-6 rounded-[14px] bg-white/10 hover:bg-white/20 transition-colors font-semibold text-[16px] inline-flex items-center justify-center border border-white/20"
              >
                Back to main website
              </Link>
            </div>
          </div>
        </div>
      </div>

      {/* Controls (NOT sticky on mobile; sticky from md+) */}
      <div className="relative md:sticky md:top-0 z-30 bg-white/95 backdrop-blur border-b border-[#E6E8EF]">
        <div className="max-w-[1240px] mx-auto px-4 sm:px-6 lg:px-[20px] py-3 flex flex-col lg:flex-row gap-3 items-stretch lg:items-center justify-between">
          <div className="flex gap-2 flex-wrap">
            {CATEGORIES.map((c) => (
              <button
                key={c}
                onClick={() => setCat(c)}
                className={[
                  "h-[40px] px-4 rounded-full border text-[13px] font-semibold transition",
                  c === cat
                    ? "bg-[#EEF2FF] border-[#306EEC] text-[#306EEC]"
                    : "bg-white border-[#E6E8EF] text-[#313234] hover:bg-[#F6F7FB]",
                ].join(" ")}
              >
                {c}
              </button>
            ))}
          </div>

          <div className="flex gap-2 items-center">
            <div className="relative w-full lg:w-[360px]">
              <input
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder='Search: "tv", "toilet", "door", "caulk"...'
                className="w-full h-[44px] rounded-[14px] border border-[#E6E8EF] px-4 text-[14px] outline-none focus:border-[#306EEC]"
              />
            </div>

            <button
              onClick={() => {
                setQuery("");
                setCat("All");
              }}
              className="h-[44px] px-4 rounded-[14px] border border-[#E6E8EF] bg-white hover:bg-[#F6F7FB] text-[13px] font-semibold"
            >
              Reset
            </button>
          </div>
        </div>
      </div>

      {/* 90 MIN RULE CARD */}
      <div className="max-w-[1240px] mx-auto px-4 sm:px-6 lg:px-[20px] py-8">
        <div className="rounded-[18px] border border-[#C5CBD8] bg-[#EEF2FF] p-6 sm:p-8">
          <div className="text-[#306EEC] text-[12px] font-bold uppercase tracking-wider">
            The rule that makes it simple
          </div>
          <div className="mt-2 text-[#313234] text-[22px] sm:text-[26px] font-bold leading-tight">
            Every visit is up to{" "}
            <span className="text-[#306EEC]">90 minutes</span> — no matter the
            task.
          </div>
          <div className="mt-3 text-[#6A6D71] text-[14px] sm:text-[15px] leading-relaxed">
            If your task fits inside a 90-minute visit, it’s included. If it
            takes longer, we can:
            <span className="text-[#313234] font-semibold">
              {" "}
              continue on another visit
            </span>{" "}
            or
            <span className="text-[#313234] font-semibold">
              {" "}
              quote it as a bigger project
            </span>
            .
          </div>

          <div className="mt-5 flex flex-col sm:flex-row gap-3">
            <a
              href="/#plans"
              className="h-[50px] px-5 rounded-[14px] bg-[#306EEC] hover:bg-[#2558c9] transition-colors font-semibold text-[15px] text-white inline-flex items-center justify-center"
            >
              Start with a plan
            </a>
            <Link
              href="/"
              className="h-[50px] px-5 rounded-[14px] border border-[#C5CBD8] bg-white hover:bg-[#F6F7FB] transition-colors font-semibold text-[15px] text-[#313234] inline-flex items-center justify-center"
            >
              Back to main website
            </Link>
          </div>
        </div>
      </div>

      {/* MOST POPULAR */}
      <div className="max-w-[1240px] mx-auto px-4 sm:px-6 lg:px-[20px] pb-4">
        <div className="flex items-end justify-between gap-4 flex-wrap">
          <div>
            <div className="text-[22px] sm:text-[28px] font-bold text-[#313234]">
              Most popular included fixes
            </div>
            <div className="text-[13px] sm:text-[14px] text-[#6A6D71] mt-1">
              These are the top things people book Mr. Fixter for.
            </div>
          </div>
          <a
            href="/#plans"
            className="h-[44px] px-4 rounded-[14px] bg-[#306EEC] hover:bg-[#2558c9] transition-colors text-white text-[13px] font-semibold inline-flex items-center justify-center"
          >
            Start trial
          </a>
        </div>

        <div className="mt-5 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {popular.map((i, idx) => (
            <div
              key={`${i.title}-${idx}`}
              className="rounded-[18px] border border-[#E6E8EF] bg-white p-5 shadow-sm hover:shadow-md transition-shadow"
            >
              <div className="flex items-start justify-between gap-3">
                <div className="text-[16px] font-bold text-[#313234] leading-snug">
                  {i.title}
                </div>
                <div
                  className={`shrink-0 px-3 py-1 rounded-full border text-[12px] font-semibold ${TIME_BADGE[i.time].className}`}
                >
                  {TIME_BADGE[i.time].label}
                </div>
              </div>

              <div className="mt-2 text-[14px] text-[#6A6D71] leading-relaxed">
                {i.desc}
              </div>

              <div className="mt-4 flex items-center justify-between gap-2">
                <div className="px-3 py-1 rounded-full bg-[#EEF2FF] border border-[#C5CBD8] text-[12px] font-semibold text-[#306EEC]">
                  {i.category}
                </div>
                <div className="text-[12px] text-[#6A6D71]">
                  Included if within{" "}
                  <span className="font-semibold text-[#313234]">
                    90 minutes
                  </span>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* MATERIALS POLICY */}
      <div className="max-w-[1240px] mx-auto px-4 sm:px-6 lg:px-[20px] py-10">
        <div className="rounded-[18px] border border-[#E6E8EF] bg-white p-6 sm:p-8">
          <div className="text-[#306EEC] text-[12px] font-bold uppercase tracking-wider">
            Materials policy (very clear)
          </div>

          <div className="mt-2 text-[#313234] text-[22px] sm:text-[26px] font-bold leading-tight">
            Your plan covers the work. You pay only for materials if needed.
          </div>

          <div className="mt-3 text-[#6A6D71] text-[14px] sm:text-[15px] leading-relaxed max-w-[920px]">
            Most tasks require little or no materials. If something needs parts
            (example: faucet, outlet, wall anchors), we’ll tell you before we
            install it. You can provide the items, or we can help pick the right
            ones.
          </div>

          <div className="mt-6 grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="rounded-[16px] border border-[#E6E8EF] bg-[#F6F7FB] p-5">
              <div className="font-bold text-[#313234]">Included</div>
              <div className="mt-2 text-[14px] text-[#6A6D71] leading-relaxed">
                Labor/time during your 90-minute visit, tools, basic
                troubleshooting, mounting/adjusting, minor fixes.
              </div>
            </div>

            <div className="rounded-[16px] border border-[#E6E8EF] bg-[#F6F7FB] p-5">
              <div className="font-bold text-[#313234]">Customer pays</div>
              <div className="mt-2 text-[14px] text-[#6A6D71] leading-relaxed">
                Parts/materials: fixtures, faucets, outlets/switches, shelves,
                brackets, caulk/paint, etc.
              </div>
            </div>

            <div className="rounded-[16px] border border-[#E6E8EF] bg-[#F6F7FB] p-5">
              <div className="font-bold text-[#313234]">No surprises</div>
              <div className="mt-2 text-[14px] text-[#6A6D71] leading-relaxed">
                If anything looks like a bigger project or over 90 minutes, we
                stop and explain the options.
              </div>
            </div>
          </div>

          <div className="mt-6 flex flex-col sm:flex-row gap-3">
            <a
              href="/#plans"
              className="h-[50px] px-5 rounded-[14px] bg-[#306EEC] hover:bg-[#2558c9] transition-colors font-semibold text-[15px] text-white inline-flex items-center justify-center"
            >
              See plans
            </a>
            <Link
              href="/"
              className="h-[50px] px-5 rounded-[14px] border border-[#E6E8EF] bg-white hover:bg-[#F6F7FB] transition-colors font-semibold text-[15px] text-[#313234] inline-flex items-center justify-center"
            >
              Back to main website
            </Link>
          </div>
        </div>
      </div>

      {/* INCLUDED GRID (searchable) */}
      <div className="max-w-[1240px] mx-auto px-4 sm:px-6 lg:px-[20px] pb-12">
        <div className="flex items-end justify-between gap-4 flex-wrap">
          <div>
            <div className="text-[22px] sm:text-[28px] font-bold text-[#313234]">
              Full included list (searchable)
            </div>
            <div className="text-[13px] sm:text-[14px] text-[#6A6D71] mt-1">
              Type what you need. If it fits in 90 minutes — it’s included.
            </div>
          </div>
          <div className="text-[13px] text-[#6A6D71]">
            Showing{" "}
            <span className="font-semibold text-[#313234]">
              {filtered.length}
            </span>{" "}
            items
          </div>
        </div>

        <div className="mt-6 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {filtered.map((i, idx) => (
            <div
              key={`${i.title}-${idx}`}
              className="rounded-[18px] border border-[#E6E8EF] bg-white p-5 shadow-sm hover:shadow-md transition-shadow"
            >
              <div className="flex items-start justify-between gap-3">
                <div className="text-[16px] font-bold text-[#313234] leading-snug">
                  {i.title}
                </div>

                <div
                  className={`shrink-0 px-3 py-1 rounded-full border text-[12px] font-semibold ${TIME_BADGE[i.time].className}`}
                >
                  {TIME_BADGE[i.time].label}
                </div>
              </div>

              <div className="mt-2 text-[14px] text-[#6A6D71] leading-relaxed">
                {i.desc}
              </div>

              <div className="mt-4 flex items-center justify-between gap-2">
                <div className="px-3 py-1 rounded-full bg-[#EEF2FF] border border-[#C5CBD8] text-[12px] font-semibold text-[#306EEC]">
                  {i.category}
                </div>
                <div className="text-[12px] text-[#6A6D71]">
                  Included if within{" "}
                  <span className="font-semibold text-[#313234]">
                    90 minutes
                  </span>
                </div>
              </div>
            </div>
          ))}
        </div>

        {filtered.length === 0 ? (
          <div className="mt-8 rounded-[18px] border border-[#E6E8EF] bg-[#F6F7FB] p-6 text-[#313234]">
            <div className="font-bold text-[16px]">No matches.</div>
            <div className="text-[14px] text-[#6A6D71] mt-1">
              Try another keyword (example:{" "}
              <span className="font-semibold">“outlet”</span>,{" "}
              <span className="font-semibold">“mirror”</span>,{" "}
              <span className="font-semibold">“caulk”</span>). Or hit Reset.
            </div>
          </div>
        ) : null}
      </div>

      {/* NOT INCLUDED */}
      <div className="bg-[#F6F7FB] border-t border-[#E6E8EF]">
        <div className="max-w-[1240px] mx-auto px-4 sm:px-6 lg:px-[20px] py-12">
          <div className="text-[22px] sm:text-[28px] font-bold text-[#313234]">
            Not included (needs a quote)
          </div>
          <div className="text-[14px] text-[#6A6D71] mt-2 max-w-[820px]">
            We’re transparent. Bigger/high-risk items usually need more time,
            permits, or a specialist. We can still help — it just becomes a
            separate quote.
          </div>

          <div className="mt-6 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {NOT_INCLUDED.map((x, idx) => (
              <div
                key={`${x.title}-${idx}`}
                className="rounded-[18px] border border-[#E6E8EF] bg-white p-5"
              >
                <div className="text-[16px] font-bold text-[#313234]">
                  {x.title}
                </div>
                <div className="mt-2 text-[14px] text-[#6A6D71] leading-relaxed">
                  {x.desc}
                </div>
              </div>
            ))}
          </div>

          <div className="mt-8 flex flex-col sm:flex-row gap-3">
            <Link
              href="/"
              className="h-[52px] px-6 rounded-[14px] border border-[#C5CBD8] bg-white hover:bg-[#F6F7FB] transition-colors font-semibold text-[15px] text-[#313234] inline-flex items-center justify-center"
            >
              Back to main website
            </Link>
            <a
              href="/#plans"
              className="h-[52px] px-6 rounded-[14px] bg-[#306EEC] hover:bg-[#2558c9] transition-colors font-semibold text-[15px] text-white inline-flex items-center justify-center"
            >
              Choose a plan
            </a>
          </div>
        </div>
      </div>

      {/* FOOTER NOTE */}
      <div className="max-w-[1240px] mx-auto px-4 sm:px-6 lg:px-[20px] py-10">
        <div className="rounded-[18px] border border-[#E6E8EF] bg-white p-6">
          <div className="text-[16px] font-bold text-[#313234]">Still unsure?</div>
          <div className="mt-1 text-[14px] text-[#6A6D71]">
            The rule is simple: if it fits in{" "}
            <span className="font-semibold text-[#313234]">90 minutes</span>,
            it’s included. If it needs more time — we continue next visit or
            quote it.
          </div>

          <div className="mt-4 flex flex-col sm:flex-row gap-3">
            <a
              href="/#plans"
              className="h-[50px] px-5 rounded-[14px] bg-[#306EEC] hover:bg-[#2558c9] transition-colors font-semibold text-[15px] text-white inline-flex items-center justify-center"
            >
              See plans
            </a>
            <a
              href="tel:631-599-1363"
              className="h-[50px] px-5 rounded-[14px] border border-[#E6E8EF] bg-white hover:bg-[#F6F7FB] transition-colors font-semibold text-[15px] text-[#313234] inline-flex items-center justify-center"
            >
              Call Taras: 631-599-1363
            </a>
          </div>
        </div>
      </div>
    </div>
  );
}