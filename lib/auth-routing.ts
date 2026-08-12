import type { User } from "./auth-service";

const ADMIN_EMAIL = "getfixter@gmail.com";
export type RoleLandingKind = "admin" | "general_fixter" | "fixter" | "customer" | "anonymous";

export function isAdminUser(user: User | null | undefined) {
  if (!user) return false;
  return (
    user.role === "admin" ||
    String(user.email || "").trim().toLowerCase() === ADMIN_EMAIL
  );
}

export function isEmployeeUser(user: User | null | undefined) {
  return user?.role === "employee";
}

export function getRoleLandingKind(user: User | null | undefined): RoleLandingKind {
  if (!user) return "anonymous";
  if (isAdminUser(user)) return "admin";
  if (user.role === "employee" && user.employeePosition === "General Fixter") return "general_fixter";
  if (user.role === "employee") return "fixter";
  return "customer";
}

export function getRoleLandingPath(user: User | null | undefined) {
  const kind = getRoleLandingKind(user);
  if (kind === "admin") return "/admin";
  if (kind === "general_fixter" || kind === "fixter") return "/admin?tab=bookings";
  if (kind === "customer") return "/account";
  return "/";
}

export function hasActiveMembership(user: User | null | undefined) {
  if (!user || getRoleLandingKind(user) !== "customer") return false;
  return Boolean(user.addresses?.some((address) => address.hasActiveSubscription === true));
}

/**
 * Where the Home affordance should take this user.
 *
 * Always the public homepage. Booking lives under Book, so Home no longer needs
 * to double as a member dashboard, and a member is still entitled to browse the
 * company site like anyone else.
 */
export function getCustomerHomePath(user: User | null | undefined) {
  // Home is Home. A member is still allowed to browse the company site, and a
  // Home control that quietly meant "membership dashboard" was the reason it
  // felt broken. Booking lives under Book; this points at the actual homepage.
  void user;
  return "/";
}

/** Destination used only for automatic app entry and successful sign-in. */
export function getAutomaticEntryPath(user: User | null | undefined) {
  const kind = getRoleLandingKind(user);
  if (kind === "admin") return "/admin";
  if (kind === "general_fixter" || kind === "fixter") return "/admin?tab=bookings";
  if (kind === "customer" && hasActiveMembership(user)) return "/membership";
  return "/";
}
