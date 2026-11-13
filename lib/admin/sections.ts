/**
 * The admin's sections: one registry for routes, navigation and permission.
 *
 * Who may see a section comes from the server (/api/auth/me `permissions`,
 * computed by BackEnd utils/adminAccess.js). This file only decides what to
 * SHOW; every API behind a section checks the same permission on the server,
 * so hiding is never the protection. It reuses lib/admin-access (PERM, can,
 * doesFieldWork) with the same rules the old tab strip used.
 *
 * Plain module (no React), so the old-link redirects and the tests can use it.
 */
import type { User } from "@/lib/auth-service";
import { isAdminUser } from "@/lib/auth-routing";
import { can, doesFieldWork, PERM } from "@/lib/admin-access";

export type SectionId =
  | "jobs"
  | "my-day"
  | "schedule"
  | "customers"
  | "projects"
  | "leads"
  | "overview"
  | "communications"
  | "tips"
  | "team"
  | "recent-work"
  | "work-photos"
  | "promotion"
  | "activity"
  | "assistant"
  | "more";

export type SectionIcon =
  | "jobs"
  | "day"
  | "schedule"
  | "customers"
  | "projects"
  | "leads"
  | "overview"
  | "communications"
  | "tips"
  | "team"
  | "photos"
  | "promotion"
  | "activity"
  | "assistant"
  | "more";

export type Section = {
  id: SectionId;
  href: string;
  label: string;
  /** One line under the label on the More page. */
  description: string;
  icon: SectionIcon;
};

export const SECTIONS: Record<SectionId, Section> = {
  jobs: { id: "jobs", href: "/admin/jobs", label: "Jobs", description: "Today, upcoming and requests to review", icon: "jobs" },
  "my-day": { id: "my-day", href: "/admin/my-day", label: "My day", description: "Your jobs today and tomorrow", icon: "day" },
  schedule: { id: "schedule", href: "/admin/schedule", label: "Schedule", description: "Calendar and availability", icon: "schedule" },
  customers: { id: "customers", href: "/admin/customers", label: "Customers", description: "Customers, members and blocked accounts", icon: "customers" },
  projects: { id: "projects", href: "/admin/projects", label: "Projects", description: "Estimates, agreements and invoices", icon: "projects" },
  leads: { id: "leads", href: "/admin/leads", label: "Leads", description: "Estimate and service requests", icon: "leads" },
  overview: { id: "overview", href: "/admin/overview", label: "Overview", description: "Members, revenue and acquisition", icon: "overview" },
  communications: { id: "communications", href: "/admin/communications", label: "Communications", description: "Email and text templates and history", icon: "communications" },
  tips: { id: "tips", href: "/admin/tips", label: "Tips", description: "What customers left", icon: "tips" },
  team: { id: "team", href: "/admin/team", label: "Team", description: "Employees and their access", icon: "team" },
  "recent-work": { id: "recent-work", href: "/admin/recent-work", label: "Recent Work", description: "The public work gallery", icon: "photos" },
  "work-photos": { id: "work-photos", href: "/admin/work-photos", label: "Photos", description: "Send photos of finished work", icon: "photos" },
  promotion: { id: "promotion", href: "/admin/promotion", label: "Promotion Popup", description: "The visitor promotion", icon: "promotion" },
  activity: { id: "activity", href: "/admin/activity", label: "Activity Log", description: "Who changed what", icon: "activity" },
  assistant: { id: "assistant", href: "/admin/assistant", label: "Assistant", description: "Growth agents, approvals and capacity", icon: "assistant" },
  more: { id: "more", href: "/admin/more", label: "More", description: "Everything else", icon: "more" },
};

/** Has a seat in Admin at all: the owner, or an active employee. */
export function hasWorkspace(user: User | null | undefined): boolean {
  if (!user) return false;
  if (isAdminUser(user)) return true;
  return user.role === "employee" && user.isActive !== false;
}

/**
 * A field Fixter (owner decision Q-1): position Fixter without the Jobs
 * section (bookings.assign). The server scopes their bookings to their own;
 * the UI gives them My day instead of the full Jobs board.
 */
export function isFieldFixter(user: User | null | undefined): boolean {
  if (!user || isAdminUser(user)) return false;
  return user.role === "employee" && user.employeePosition === "Fixter" && !can(user, PERM.BOOKINGS_ASSIGN);
}

/** May this person open the section? The old tab strip's rules, unchanged. */
export function canOpen(user: User | null | undefined, id: SectionId): boolean {
  if (!hasWorkspace(user)) return false;
  const owner = isAdminUser(user);
  switch (id) {
    case "jobs":
      return can(user, PERM.BOOKINGS_READ);
    case "my-day":
      return can(user, PERM.BOOKINGS_READ) && (owner || doesFieldWork(user));
    case "schedule":
      return !isFieldFixter(user) && (can(user, PERM.BOOKINGS_READ) || can(user, PERM.SCHEDULE_READ));
    case "customers":
      return can(user, PERM.CUSTOMERS_MANAGE) || can(user, PERM.MEMBERS_READ) || can(user, PERM.BLACKLIST_MANAGE);
    case "projects":
      return can(user, PERM.PROJECTS_MANAGE);
    case "leads":
      return can(user, PERM.LEADS_MANAGE);
    case "overview":
      return can(user, PERM.ANALYTICS_READ);
    case "communications":
      return can(user, PERM.COMMUNICATIONS_MANAGE);
    case "tips":
      return can(user, PERM.TIPS_READ);
    case "team":
      return owner;
    case "recent-work":
      return can(user, PERM.RECENT_WORK_MANAGE);
    case "work-photos":
      return !owner && doesFieldWork(user);
    case "promotion":
      return can(user, PERM.PROMOTION_MANAGE);
    case "activity":
      return can(user, PERM.ACTIVITY_READ);
    case "assistant":
      return can(user, PERM.GROWTH_READ);
    case "more":
      return true;
    default:
      return false;
  }
}

/** Schedule › Availability needs schedule.read on top of the section. */
export function canOpenAvailability(user: User | null | undefined): boolean {
  return can(user, PERM.SCHEDULE_READ);
}

/* Order matters: it is the order of the bottom bar, the sidebar and More. */
const PRIMARY_ORDER: SectionId[] = ["jobs", "schedule", "customers", "projects"];
const FIELD_PRIMARY_ORDER: SectionId[] = ["my-day", "tips", "work-photos"];
const MORE_ORDER: SectionId[] = [
  "my-day",
  "overview",
  "leads",
  "communications",
  "tips",
  "team",
  "recent-work",
  "work-photos",
  "promotion",
  "activity",
  "assistant",
];

export type Navigation = {
  /** The bottom bar (and the top of the sidebar): at most four, plus More when needed. */
  primary: Section[];
  /** One level, monthly or configuration work. */
  more: Section[];
};

export function navigationFor(user: User | null | undefined): Navigation {
  if (!hasWorkspace(user)) return { primary: [], more: [] };
  const field = isFieldFixter(user);
  const order = field ? FIELD_PRIMARY_ORDER : PRIMARY_ORDER;
  const primary = order.filter((id) => canOpen(user, id)).map((id) => SECTIONS[id]);
  const taken = new Set<SectionId>(primary.map((s) => s.id));
  const rest = MORE_ORDER.filter((id) => !taken.has(id) && canOpen(user, id)).map((id) => SECTIONS[id]);
  // A short bar is filled from More, so nobody gets a bar of one icon and a list.
  while (primary.length < 4 && rest.length && primary.length + rest.length > 4) {
    primary.push(rest.shift() as Section);
  }
  if (primary.length + rest.length <= 4) {
    return { primary: [...primary, ...rest], more: [] };
  }
  return { primary, more: rest };
}

/** Where /admin sends this person (owner decision: Jobs first; field Fixters to My day). */
export function landingPathFor(user: User | null | undefined): string | null {
  if (!hasWorkspace(user)) return null;
  if (isFieldFixter(user) && canOpen(user, "my-day")) return SECTIONS["my-day"].href;
  if (canOpen(user, "jobs")) return SECTIONS.jobs.href;
  const nav = navigationFor(user);
  const first = nav.primary[0] || nav.more[0];
  return first ? first.href : null;
}

/** The section a pathname belongs to ("/admin/jobs/123" -> "jobs"). */
export function sectionForPath(pathname: string): SectionId | null {
  const match = /^\/admin\/([^/?#]+)/.exec(pathname || "");
  if (!match) return null;
  const id = match[1] as SectionId;
  return id in SECTIONS ? id : null;
}
