"use client";

import {
  BoltIcon,
  BuildingOffice2Icon,
  HomeModernIcon,
  KeyIcon,
  LightBulbIcon,
  PaintBrushIcon,
  RectangleGroupIcon,
  Squares2X2Icon,
  SwatchIcon,
  TvIcon,
  WrenchScrewdriverIcon,
} from "@heroicons/react/24/outline";
import { useAuth } from "@/lib/useAuth";
import PopularTaskCard from "./PopularTaskCard";

export const POPULAR_TASKS = [
  {
    title: "TV Mounting",
    subtitle: "Mounts, shelves, and wall installs",
    Icon: TvIcon,
  },
  {
    title: "Light Fixtures",
    subtitle: "Simple swaps and installs",
    Icon: LightBulbIcon,
  },
  {
    title: "Faucets & Minor Leaks",
    subtitle: "Common bathroom and kitchen fixes",
    Icon: WrenchScrewdriverIcon,
  },
  {
    title: "Doors & Locks",
    subtitle: "Handles, alignment, and hardware",
    Icon: KeyIcon,
  },
  {
    title: "Drywall Patches",
    subtitle: "Small holes, dents, and touch-ups",
    Icon: SwatchIcon,
  },
  {
    title: "Caulking & Sealing",
    subtitle: "Bathrooms, kitchens, and trim",
    Icon: BoltIcon,
  },
  {
    title: "Furniture Assembly",
    subtitle: "Common home setup jobs",
    Icon: Squares2X2Icon,
  },
  {
    title: "Shelves & Wall Hardware",
    subtitle: "Secure, level, and clean installs",
    Icon: RectangleGroupIcon,
  },
  {
    title: "Paint Touch-Ups",
    subtitle: "Small refresh jobs",
    Icon: PaintBrushIcon,
  },
  {
    title: "Home Maintenance Punch Lists",
    subtitle: "Small fixes around the house",
    Icon: HomeModernIcon,
  },
  {
    title: "Other Small Home Tasks",
    subtitle: "If it fits the visit, we can usually help",
    Icon: BuildingOffice2Icon,
  },
] as const;

export default function PopularTasksSection() {
  const { user, isAuthenticated } = useAuth();

  const isSubscribed =
    !!isAuthenticated &&
    !!user?.addresses?.some((addr) => addr.hasActiveSubscription);

  const handleTaskClick = () => {
    const targetId = isSubscribed ? "pick-day" : "plans";
    const el = document.getElementById(targetId);
    if (!el) return;

    const HEADER_OFFSET = window.innerWidth >= 1024 ? 160 : 120;
    const y = el.getBoundingClientRect().top + window.scrollY - HEADER_OFFSET;

    window.scrollTo({ top: y, behavior: "smooth" });
    history.replaceState(null, "", `#${targetId}`);
  };

  return (
    <section className="w-full bg-[#eaedfa] py-10 sm:py-12 lg:py-14">
      <div className="mx-auto max-w-[1240px] px-5 lg:px-5">
        <div className="rounded-[22px] border border-[#C5CBD8] bg-[#EEF2FF] p-5 sm:p-7 lg:p-8 shadow-[0_0_200px_rgba(0,0,0,0.08)]">
          <div className="max-w-[760px]">
            <div className="text-[12px] uppercase tracking-wider text-[#6A6D71] font-bold">
              Examples, Not a Full Catalog
            </div>
            <h2 className="mt-2 text-[28px] sm:text-[36px] lg:text-[42px] font-extrabold leading-tight tracking-[-0.03em] text-[#313234]">
              Popular Tasks We Handle
            </h2>
            <p className="mt-3 text-[#6A6D71] text-[15px] sm:text-[16px] leading-relaxed">
              Common handyman tasks members book. Availability depends on your plan, task type, and time needed.
            </p>
            <p className="mt-2 text-[#6A6D71] text-[13px] sm:text-[14px] leading-relaxed">
              Each visit covers up to 90 minutes of work.
            </p>
          </div>

          <div className="mt-6 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 sm:gap-4">
            {POPULAR_TASKS.map((task) => (
              <PopularTaskCard
                key={task.title}
                title={task.title}
                subtitle={task.subtitle}
                Icon={task.Icon}
                onClick={handleTaskClick}
              />
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}
