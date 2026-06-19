export type AdminTabId =
  | "bookings"
  | "users"
  | "subscribed"
  | "projects"
  | "requests"
  | "emails"
  | "blacklist"
  | "calendar";

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
  { id: "blacklist",  label: "Blacklist",  shortLabel: "Block",   description: "Blocked users" },
  { id: "calendar",   label: "Schedule",   shortLabel: "Sched",   description: "Calendar config" },
];
