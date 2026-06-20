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
  | "promotion";

export type AdminTabItem = {
  id: AdminTabId;
  label: string;
  shortLabel: string;
  description: string;
};

export const ADMIN_TABS: AdminTabItem[] = [
  { id: "bookings",   label: "Jobs",       shortLabel: "Jobs",    description: "Daily bookings" },
  { id: "subscribed", label: "Members",    shortLabel: "Members", description: "Active plans" },
  { id: "users",      label: "All Users",  shortLabel: "Users",   description: "Customer CRM" },
  { id: "projects",   label: "Projects",   shortLabel: "Projects", description: "Sales pipeline" },
  { id: "requests",   label: "Leads",      shortLabel: "Leads",   description: "Estimate requests" },
  { id: "emails",     label: "Emails",     shortLabel: "Emails",  description: "Campaigns" },
  { id: "promotion",  label: "Promotion Popup", shortLabel: "Popup", description: "Visitor promotion" },
  { id: "blacklist",  label: "Blacklist",  shortLabel: "Block",   description: "Blocked users" },
  { id: "calendar",   label: "Schedule",   shortLabel: "Sched",   description: "Calendar config" },
  { id: "fixters",    label: "Fixters",    shortLabel: "Fixters", description: "Employee accounts" },
];

export function tabsForUser(role?: string, position?: string) {
  if (role === "admin") return ADMIN_TABS;
  if (role === "employee" && position === "General Fixter") {
    return ADMIN_TABS.filter((tab) =>
      ["bookings", "subscribed", "calendar"].includes(tab.id)
    );
  }
  if (role === "employee") {
    return ADMIN_TABS.filter((tab) => tab.id === "bookings");
  }
  return [];
}
