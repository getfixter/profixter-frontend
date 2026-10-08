import type { User } from "./auth-service";
import { isAdminUser } from "./auth-routing";

/*
 * What the signed-in person may see in Admin.
 *
 * The server computes `permissions` (/api/auth/me) from the employee's field
 * work and the sections the owner switched on - see BackEnd
 * utils/adminAccess.js, the registry these ids come from. This file only
 * decides what to SHOW. Every API behind it checks the same permission on
 * the server, so hiding is never the protection.
 */
export const PERM = {
  ANALYTICS_READ: "analytics.read",
  ANALYTICS_MAP: "analytics.map",
  BOOKINGS_READ: "bookings.read",
  BOOKINGS_WRITE: "bookings.write",
  BOOKINGS_ASSIGN: "bookings.assign",
  MEMBERS_READ: "members.read",
  SCHEDULE_READ: "schedule.read",
  SCHEDULE_WRITE: "schedule.write",
  TIPS_READ: "tips.read",
  CUSTOMERS_MANAGE: "customers.manage",
  LEADS_MANAGE: "leads.manage",
  PROJECTS_MANAGE: "projects.manage",
  COMMUNICATIONS_MANAGE: "communications.manage",
  RECENT_WORK_MANAGE: "recentWork.manage",
  PROMOTION_MANAGE: "promotion.manage",
  BLACKLIST_MANAGE: "blacklist.manage",
  ACTIVITY_READ: "activity.read",
} as const;

export type Permission = (typeof PERM)[keyof typeof PERM];

/** The owner can do everything; anyone else only what the server listed. */
export function can(user: User | null | undefined, permission: Permission): boolean {
  if (!user) return false;
  if (isAdminUser(user)) return true;
  return user.role === "employee" && user.isActive !== false && (user.permissions || []).includes(permission);
}

/** A Fixter or General Fixter: does jobs in the field (Work Photos, own tips). */
export function doesFieldWork(user: User | null | undefined): boolean {
  return user?.role === "employee" && (user.employeePosition === "Fixter" || user.employeePosition === "General Fixter");
}
