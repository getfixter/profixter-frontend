import API from "./api";

/* Types mirror BackEnd/utils/analytics/overview.js - keep the two in step. */

export type RangeKey = "today" | "7d" | "30d" | "month" | "lastmonth" | "custom";

export type Delta = { abs: number; pct: number | null } | null;

export type OverviewPeriod = {
  key: RangeKey;
  label: string;
  from: string;
  to: string;
  fromYmd: string;
  toYmd: string;
  prevFrom: string;
  prevTo: string;
  days: number;
  timezone: string;
};

export type PlanRow = {
  plan: "basic" | "plus" | "premium" | "elite";
  active: number;
  paying: number;
  gifts: number;
  newInPeriod: number;
  canceledInPeriod: number;
  mrrCents: number;
  share: number | null;
};

export type GrowthPoint = { key: string; from: string; active: number; new: number; canceled: number; customers: number };
export type RevenuePoint = { key: string; from: string; membershipCents: number; visitCents: number };
export type Series<T> = { granularity: "day" | "week" | "month"; points: T[] };

export type SourceRow = {
  key: string;
  label: string;
  visitors: number;
  registrations: number;
  freeVisits: number;
  members: number;
  revenueCents: number;
  spendCents: number | null;
  conversion: number | null;
  share: number | null;
  costPerRegistrationCents: number | null;
  costPerMemberCents: number | null;
  roas: number | null;
};

export type CampaignNode = {
  name: string;
  registrations: number;
  freeVisits: number;
  members: number;
  revenueCents: number;
  conversion: number | null;
  spendCents: number | null;
  roas: number | null;
  costPerMemberCents: number | null;
  plans?: Record<string, number>;
  campaignId?: string | null;
  adsets?: CampaignNode[];
  ads?: CampaignNode[];
};

export type ActivityItem = { at: string; type: string; text: string; who: string; userId: string; ref?: string };
export type AttentionItem = { key: string; count: number; tone: "info" | "warning" | "critical"; text: string };

export type Overview = {
  generatedAt: string;
  period: OverviewPeriod;
  kpis: {
    totalCustomers: { value: number };
    activeMembers: { value: number; prev: number; delta: Delta; paying: number; gifts: number };
    newMembers: { value: number; prev: number; delta: Delta };
    cancellations: { value: number; prev: number; delta: Delta; scheduled: number };
    newCustomers: { value: number; prev: number; delta: Delta };
    revenue: {
      available: boolean;
      error: string | null;
      truncated: boolean;
      membershipCents: number;
      oneTimeCents: number;
      fullDayCents: number;
      giftCents: number;
      otherCents: number;
      refundedCents: number;
      totalCents: number;
      prevTotalCents: number;
      delta: Delta;
    };
    mrr: { cents: number; startCents: number; delta: Delta; payingMembers: number };
    freeVisits: { booked: number; prevBooked: number; delta: Delta; completed: number; upcoming: number; canceled: number; noShow: number; noShowTracked: boolean };
    conversion: { completed: number; converted: number; rate: number | null; prevRate: number | null };
    oneTime: { booked: number; completed: number; canceled: number; revenueCents: number; converted: number; fullDayBooked: number; fullDayRevenueCents: number };
  };
  plans: PlanRow[];
  growth: { period: Series<GrowthPoint>; year: Series<GrowthPoint> };
  revenueSeries: { period: Series<RevenuePoint>; year: Series<RevenuePoint> } | null;
  funnel: { visitors: number; prevVisitors: number; visitorsTrackingSince: string | null; registered: number; freeVisitBooked: number; freeVisitCompleted: number; members: number };
  sources: SourceRow[];
  unmatchedRevenueCents: number;
  campaigns: CampaignNode[];
  spend: { connected: boolean };
  topAreas: Array<{ city: string; customers: number; members: number; newInPeriod: number }>;
  activity: ActivityItem[];
  attention: AttentionItem[];
};

export type ListRow = {
  userId: string;
  name: string;
  email: string;
  city: string;
  plan: string | null;
  membership: string | null;
  registeredAt: string;
  source: string;
  campaign: string | null;
  ad: string | null;
  hadFreeVisit: boolean;
  date?: string;
  status?: string;
  converted?: boolean;
};

export type OverviewList = { title: string; period: { label: string; fromYmd: string; toYmd: string }; rows: ListRow[] };

export type MapPoint = {
  id: string;
  /* The customer's account number (PF-...), which the All Users search finds. */
  ref: string;
  x: number;
  y: number;
  precise: boolean;
  name: string;
  city: string;
  plan: string | null;
  member: boolean;
  gift: boolean;
  freeVisit: boolean;
  oneTime: boolean;
  joinedAt: string;
  memberSince: string | null;
  source: string;
  lastVisit: string | null;
  nextVisit: string | null;
};

export type OverviewMap = { generatedAt: string; total: number; placed: number; points: MapPoint[] };

export type RangeQuery = { range: RangeKey; from?: string; to?: string };

export async function getOverview(q: RangeQuery): Promise<Overview> {
  const res = await API.get<Overview>("/api/admin/overview", { params: q, timeout: 45000 });
  return res.data;
}

export async function getOverviewList(q: RangeQuery & { metric: string; param?: string }): Promise<OverviewList> {
  const res = await API.get<OverviewList>("/api/admin/overview/list", { params: q, timeout: 45000 });
  return res.data;
}

export async function getOverviewMap(): Promise<OverviewMap> {
  const res = await API.get<OverviewMap>("/api/admin/overview/map", { timeout: 45000 });
  return res.data;
}

/* ---------------- formatting ---------------- */

export function money(cents: number | null | undefined, { compact = false } = {}): string {
  if (cents === null || cents === undefined) return "—";
  const dollars = cents / 100;
  if (compact && Math.abs(dollars) >= 10000) return `$${(dollars / 1000).toFixed(dollars >= 100000 ? 0 : 1)}K`;
  return dollars.toLocaleString("en-US", { style: "currency", currency: "USD", maximumFractionDigits: dollars % 1 === 0 || Math.abs(dollars) >= 1000 ? 0 : 2 });
}

export function num(n: number | null | undefined): string {
  if (n === null || n === undefined) return "—";
  return n.toLocaleString("en-US");
}

export function planLabel(plan: string | null | undefined): string {
  if (!plan) return "—";
  return plan[0].toUpperCase() + plan.slice(1);
}

export function shortDate(iso: string | null | undefined): string {
  if (!iso) return "—";
  return new Date(iso).toLocaleDateString("en-US", { month: "short", day: "numeric", timeZone: "America/New_York" });
}

export function ymdLabel(ymd: string): string {
  const [y, m, d] = ymd.split("-").map(Number);
  return new Date(Date.UTC(y, m - 1, d)).toLocaleDateString("en-US", { month: "short", day: "numeric", timeZone: "UTC" });
}

/** Level 3: the customer's full record, found by email or account number in All Users. */
export function customerHref(query: string): string {
  return `/admin?tab=users&q=${encodeURIComponent(query)}`;
}
