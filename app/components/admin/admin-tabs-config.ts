export type AdminTabId =
  | "bookings"
  | "users"
  | "subscribed"
  | "emails"
  | "blacklist"
  | "calendar"
  | "techs";

export type AdminTabConfig = {
  id: AdminTabId;
  label: string;
  shortLabel: string;
  description: string;
  colorClass: string;
  badgeClass: string;
};

export const ADMIN_TABS: AdminTabConfig[] = [
  {
    id: "bookings",
    label: "Bookings",
    shortLabel: "BK",
    description: "Schedule and jobs",
    colorClass: "from-blue-500 to-cyan-500",
    badgeClass: "bg-blue-100 text-blue-800 border-blue-200",
  },
  {
    id: "users",
    label: "Users",
    shortLabel: "US",
    description: "All customers",
    colorClass: "from-violet-500 to-purple-500",
    badgeClass: "bg-violet-100 text-violet-800 border-violet-200",
  },
  {
    id: "subscribed",
    label: "Subscribed",
    shortLabel: "SU",
    description: "Active plans",
    colorClass: "from-emerald-500 to-green-500",
    badgeClass: "bg-emerald-100 text-emerald-800 border-emerald-200",
  },
  {
    id: "emails",
    label: "Emails",
    shortLabel: "EM",
    description: "Campaigns",
    colorClass: "from-orange-500 to-amber-500",
    badgeClass: "bg-orange-100 text-orange-800 border-orange-200",
  },
  {
    id: "blacklist",
    label: "Blacklist",
    shortLabel: "BL",
    description: "Blocked users",
    colorClass: "from-rose-500 to-red-500",
    badgeClass: "bg-rose-100 text-rose-800 border-rose-200",
  },
  {
    id: "calendar",
    label: "Calendar",
    shortLabel: "CA",
    description: "Availability",
    colorClass: "from-indigo-500 to-blue-500",
    badgeClass: "bg-indigo-100 text-indigo-800 border-indigo-200",
  },
  {
    id: "techs",
    label: "Technicians",
    shortLabel: "TE",
    description: "Team setup",
    colorClass: "from-teal-500 to-cyan-500",
    badgeClass: "bg-teal-100 text-teal-800 border-teal-200",
  },
];

export const PRIMARY_MOBILE_TABS: AdminTabId[] = ["bookings", "users", "emails", "calendar"];
