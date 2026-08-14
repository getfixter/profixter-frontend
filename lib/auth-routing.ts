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

/**
 * Destination used only for automatic app entry and successful sign-in.
 *
 * A member lands on Book. They pay every month for a team that comes to the
 * house, so the reason they signed in is nearly always the next visit, and Book
 * is where that happens: the booking form first, then their Fixter and their
 * visit history under it. Account is where you go to change something about the
 * arrangement, which is a rarer errand, so it costs a tap instead of saving one.
 *
 * This is the automatic destination only. Home still means Home, and nothing
 * here changes where anyone lands when they choose a destination themselves.
 *
 * Only the paying member is affected: staff keep their workspace, and everybody
 * else keeps the homepage, including a registered non-member whose free first
 * visit journey starts from there.
 */
/**
 * A destination the customer asked for before they were sent to sign in.
 *
 * Only same-site paths survive this. A `next` value arrives from the URL bar,
 * so anything that could be read as another origin is discarded rather than
 * sanitized: this is the open-redirect that turns a login page into a phishing
 * hop, and the safe answer is always to fall back to the normal landing.
 */
export function safeReturnPath(value: string | null | undefined) {
  const path = String(value || "").trim();
  if (!path.startsWith("/")) return null;
  // "//evil.com" and "/\evil.com" are both read as protocol-relative URLs.
  if (path.startsWith("//") || path.startsWith("/\\")) return null;
  if (/[\r\n]/.test(path)) return null;
  return path;
}

export function getAutomaticEntryPath(user: User | null | undefined) {
  const kind = getRoleLandingKind(user);
  if (kind === "admin") return "/admin";
  if (kind === "general_fixter" || kind === "fixter") return "/admin?tab=bookings";
  if (kind === "customer" && hasActiveMembership(user)) return "/book?visit=membership";
  return "/";
}
