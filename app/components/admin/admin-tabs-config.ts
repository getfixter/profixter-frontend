export type AdminTabId =
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
  | "jarvis"
  | "promotion"
  | "activity";

export type AdminTabItem = {
  id: AdminTabId;
  label: string;
  shortLabel: string;
  description: string;
};

export const ADMIN_TABS: AdminTabItem[] = [
  { id: "bookings",   label: "Jobs",       shortLabel: "Jobs",    description: "Daily bookings" },
  { id: "tips",       label: "Tips",       shortLabel: "Tips",    description: "What customers left" },
  { id: "subscribed", label: "Members",    shortLabel: "Members", description: "Active plans" },
  { id: "users",      label: "All Users",  shortLabel: "Users",   description: "Customer CRM" },
  { id: "projects",   label: "Projects",   shortLabel: "Projects", description: "Sales pipeline" },
  { id: "requests",   label: "Leads",      shortLabel: "Leads",   description: "Estimate requests" },
  { id: "emails",     label: "Emails",     shortLabel: "Emails",  description: "Campaigns & history" },
  { id: "jarvis",     label: "Jarvis",     shortLabel: "Jarvis",  description: "GHL AI Commander" },
  { id: "promotion",  label: "Promotion Popup", shortLabel: "Popup", description: "Visitor promotion" },
  { id: "activity",   label: "Activity Log", shortLabel: "Activity", description: "Admin audit trail" },
  { id: "blacklist",  label: "Blacklist",  shortLabel: "Block",   description: "Blocked users" },
  { id: "calendar",   label: "Schedule",   shortLabel: "Sched",   description: "Calendar config" },
  { id: "fixters",    label: "Fixters",    shortLabel: "Fixters", description: "Employee accounts" },
];

/**
 * Tips are visible to every employee on purpose: a Fixter seeing what they
 * earned is the point of the feature. The tab is the same one the admin sees;
 * the API decides whose tips come back, so a Fixter can only ever see their own.
 */
export function tabsForUser(role?: string, position?: string) {
  if (role === "admin") return ADMIN_TABS;
  if (role === "employee" && position === "General Fixter") {
    return ADMIN_TABS.filter((tab) =>
      ["bookings", "tips", "subscribed", "calendar"].includes(tab.id)
    );
  }
  if (role === "employee") {
    return ADMIN_TABS.filter((tab) => ["bookings", "tips"].includes(tab.id));
  }
  return [];
}
