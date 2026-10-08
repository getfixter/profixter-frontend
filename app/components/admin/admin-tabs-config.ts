import type { User } from "@/lib/auth-service";
import { isAdminUser } from "@/lib/auth-routing";
import { can, doesFieldWork, PERM, type Permission } from "@/lib/admin-access";

export type AdminTabId =
  | "overview"
  | "bookings"
  | "users"
  | "subscribed"
  | "projects"
  | "requests"
  | "emails"
  | "blacklist"
  | "calendar"
  | "fixters"
  | "tips"
  | "promotion"
  | "recent-work"
  | "work-photos"
  | "activity";

/*
 * Who sees a tab:
 * - `permission`: anyone the server granted it (the owner always is)
 * - `access: "owner"`: the owner only - managing staff is never delegated
 * - `access: "field"`: Fixters and General Fixters, not the owner
 *
 * Adding a section: give it a permission here that matches the section in
 * BackEnd utils/adminAccess.js, and guard its routes with the same one.
 */
export type AdminTabItem = {
  id: AdminTabId;
  label: string;
  shortLabel: string;
  description: string;
  permission?: Permission;
  access?: "owner" | "field";
};

export const ADMIN_TABS: AdminTabItem[] = [
  /* First, so it is where the owner lands. */
  { id: "overview",   label: "Overview",   shortLabel: "Overview", description: "Business at a glance", permission: PERM.ANALYTICS_READ },
  { id: "bookings",   label: "Jobs",       shortLabel: "Jobs",    description: "Daily bookings", permission: PERM.BOOKINGS_READ },
  { id: "tips",       label: "Tips",       shortLabel: "Tips",    description: "What customers left", permission: PERM.TIPS_READ },
  { id: "subscribed", label: "Members",    shortLabel: "Members", description: "Active plans", permission: PERM.MEMBERS_READ },
  { id: "users",      label: "All Users",  shortLabel: "Users",   description: "Customer CRM", permission: PERM.CUSTOMERS_MANAGE },
  { id: "projects",   label: "Projects",   shortLabel: "Projects", description: "Sales pipeline", permission: PERM.PROJECTS_MANAGE },
  { id: "requests",   label: "Leads",      shortLabel: "Leads",   description: "Estimate requests", permission: PERM.LEADS_MANAGE },
  { id: "emails",     label: "Communications", shortLabel: "Comms", description: "Email & SMS templates, history", permission: PERM.COMMUNICATIONS_MANAGE },
  { id: "recent-work", label: "Recent Work", shortLabel: "Photos", description: "Public work gallery", permission: PERM.RECENT_WORK_MANAGE },
  { id: "promotion",  label: "Promotion Popup", shortLabel: "Popup", description: "Visitor promotion", permission: PERM.PROMOTION_MANAGE },
  { id: "activity",   label: "Activity Log", shortLabel: "Activity", description: "Admin audit trail", permission: PERM.ACTIVITY_READ },
  { id: "blacklist",  label: "Blacklist",  shortLabel: "Block",   description: "Blocked users", permission: PERM.BLACKLIST_MANAGE },
  { id: "calendar",   label: "Schedule",   shortLabel: "Sched",   description: "Calendar config", permission: PERM.SCHEDULE_READ },
  { id: "fixters",    label: "Employees",  shortLabel: "Team",    description: "Staff and their access", access: "owner" },
  /*
   * Work Photos is the contributor screen for people who do the jobs. The
   * owner (and anyone granted Recent Work) has Recent Work: the same photos
   * plus moderation, so they do not get a second, weaker door to them.
   */
  { id: "work-photos", label: "Work Photos", shortLabel: "Photos", description: "Send photos of finished work", access: "field" },
];

export function tabsForUser(user: User | null | undefined): AdminTabItem[] {
  if (!user) return [];
  const owner = isAdminUser(user);
  if (!owner && (user.role !== "employee" || user.isActive === false)) return [];
  return ADMIN_TABS.filter((tab) => {
    if (tab.access === "owner") return owner;
    if (tab.access === "field") return !owner && doesFieldWork(user);
    return tab.permission ? can(user, tab.permission) : owner;
  });
}
