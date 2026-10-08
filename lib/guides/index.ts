import type { Guide } from "@/lib/guides/types";
import { guide as handymanForSmallJobs } from "@/lib/guides/content/handyman-for-small-jobs";
import { guide as honeyDoList } from "@/lib/guides/content/honey-do-list";
import { guide as ninetyMinutes } from "@/lib/guides/content/what-fits-in-a-90-minute-handyman-visit";
import { guide as helpingAParent } from "@/lib/guides/content/helping-a-parent-with-home-repairs";
import { guide as minimumCharges } from "@/lib/guides/content/handyman-minimum-charges";
import { guide as costLongIsland } from "@/lib/guides/content/handyman-cost-long-island";
import { guide as membershipVsPerJob } from "@/lib/guides/content/handyman-membership-vs-hiring-per-job";
import { guide as plansCompared } from "@/lib/guides/content/home-maintenance-plans-compared";
import { guide as calendar } from "@/lib/guides/content/long-island-home-maintenance-calendar";
import { guide as newHomeowner } from "@/lib/guides/content/new-homeowner-first-year-long-island";

/**
 * Every homeowner guide, in hub order.
 *
 * Adding a guide is: write it in content/, import it here. The route, the hub,
 * the sitemap and the structured data all follow from this list. Each guide has
 * to answer a distinct question a homeowner actually asks - this is not a list
 * to pad.
 */
export const GUIDES: Guide[] = [
  handymanForSmallJobs,
  minimumCharges,
  honeyDoList,
  ninetyMinutes,
  costLongIsland,
  membershipVsPerJob,
  plansCompared,
  newHomeowner,
  calendar,
  helpingAParent,
];

export const GUIDE_CATEGORY_LABELS: Record<Guide["category"], string> = {
  "small-jobs": "Small jobs",
  cost: "Cost",
  membership: "Membership",
  homeownership: "Homeownership",
  maintenance: "Maintenance",
};

export function getGuide(slug: string): Guide | undefined {
  return GUIDES.find((guide) => guide.slug === slug);
}

export function getGuideSitemapRoutes() {
  const newest = GUIDES.map((guide) => guide.updated).sort().at(-1) || "2026-10-08";
  return [
    { path: "/guides", changeFrequency: "weekly" as const, priority: 0.8, updated: newest },
    ...GUIDES.map((guide) => ({
      path: `/guides/${guide.slug}`,
      changeFrequency: "monthly" as const,
      priority: 0.78,
      updated: guide.updated,
    })),
  ];
}
