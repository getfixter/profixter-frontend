export type AdminTabId =
  | "bookings"
  | "users"
  | "subscribed"
  | "emails"
  | "blacklist"
  | "calendar"
  | "techs";

export type AdminTabItem = {
  id: AdminTabId;
  label: string;
  shortLabel: string;
  description: string;
};

export const ADMIN_TABS: AdminTabItem[] = [
  { id: "bookings", label: "Bookings", shortLabel: "BK", description: "Jobs" },
  { id: "users", label: "Users", shortLabel: "US", description: "Customers" },
  { id: "subscribed", label: "Subscribed", shortLabel: "SU", description: "Plans" },
  { id: "emails", label: "Emails", shortLabel: "EM", description: "Campaigns" },
  { id: "blacklist", label: "Blacklist", shortLabel: "BL", description: "Blocked" },
  { id: "calendar", label: "Calendar", shortLabel: "CA", description: "Schedule" },
  { id: "techs", label: "Techs", shortLabel: "TE", description: "Crew" },
];
