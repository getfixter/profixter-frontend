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

/* ---------------- response shape ---------------- */

/*
 * The API is ours, but a proxy error page, a half-deployed backend or a field
 * renamed on one side must never take the whole admin down. Every response is
 * checked here and filled to the shape the components read: numbers default
 * to 0, lists to [], nullable values to null. A payload with no period or no
 * kpis at all is not an Overview, and fails like a network error would.
 */

export class OverviewShapeError extends Error {
  constructor(what: string) {
    super(`Unexpected ${what} response`);
    this.name = "OverviewShapeError";
  }
}

type Shape = number | string | boolean | null | Shape[] | { [k: string]: Shape };

const isObj = (v: unknown): v is Record<string, unknown> => typeof v === "object" && v !== null && !Array.isArray(v);

/*
 * Fills `raw` to `shape`. A one-element array shape means "a list of these";
 * an empty one passes the list through. A null shape keeps whatever is there
 * (or null). Keys the shape does not know are kept.
 */
function fill(shape: Shape, raw: unknown): unknown {
  if (shape === null) return raw === undefined ? null : raw;
  if (Array.isArray(shape)) {
    if (!Array.isArray(raw)) return [];
    return shape.length ? raw.filter(isObj).map((item) => fill(shape[0], item)) : raw;
  }
  if (isObj(shape)) {
    const src = isObj(raw) ? raw : {};
    const out: Record<string, unknown> = { ...src };
    for (const [k, v] of Object.entries(shape)) out[k] = fill(v, src[k]);
    return out;
  }
  if (typeof shape === "number") return typeof raw === "number" && Number.isFinite(raw) ? raw : shape;
  return typeof raw === typeof shape ? raw : shape;
}

const GROWTH_SERIES: Shape = { granularity: "day", points: [{ key: "", from: "", active: 0, new: 0, canceled: 0, customers: 0 }] };
const REVENUE_SERIES: Shape = { granularity: "day", points: [{ key: "", from: "", membershipCents: 0, visitCents: 0 }] };
const SOURCE_SHAPE: Shape = {
  key: "other", label: "Other", visitors: 0, registrations: 0, freeVisits: 0, members: 0, revenueCents: 0,
  spendCents: null, conversion: null, share: null, costPerRegistrationCents: null, costPerMemberCents: null, roas: null,
};
const OVERVIEW_SHAPE: Shape = {
  generatedAt: "",
  period: { key: "30d", label: "", from: "", to: "", fromYmd: "", toYmd: "", prevFrom: "", prevTo: "", days: 0, timezone: "America/New_York" },
  kpis: {
    totalCustomers: { value: 0 },
    activeMembers: { value: 0, prev: 0, delta: null, paying: 0, gifts: 0 },
    newMembers: { value: 0, prev: 0, delta: null },
    cancellations: { value: 0, prev: 0, delta: null, scheduled: 0 },
    newCustomers: { value: 0, prev: 0, delta: null },
    revenue: {
      available: false, error: null, truncated: false, membershipCents: 0, oneTimeCents: 0, fullDayCents: 0, giftCents: 0,
      otherCents: 0, refundedCents: 0, totalCents: 0, prevTotalCents: 0, delta: null,
    },
    mrr: { cents: 0, startCents: 0, delta: null, payingMembers: 0 },
    freeVisits: { booked: 0, prevBooked: 0, delta: null, completed: 0, upcoming: 0, canceled: 0, noShow: 0, noShowTracked: false },
    conversion: { completed: 0, converted: 0, rate: null, prevRate: null },
    oneTime: { booked: 0, completed: 0, canceled: 0, revenueCents: 0, converted: 0, fullDayBooked: 0, fullDayRevenueCents: 0 },
  },
  plans: [{ plan: "basic", active: 0, paying: 0, gifts: 0, newInPeriod: 0, canceledInPeriod: 0, mrrCents: 0, share: null }],
  growth: { period: GROWTH_SERIES, year: GROWTH_SERIES },
  revenueSeries: null,
  funnel: { visitors: 0, prevVisitors: 0, visitorsTrackingSince: null, registered: 0, freeVisitBooked: 0, freeVisitCompleted: 0, members: 0 },
  sources: [SOURCE_SHAPE],
  unmatchedRevenueCents: 0,
  campaigns: [],
  spend: { connected: false },
  topAreas: [{ city: "", customers: 0, members: 0, newInPeriod: 0 }],
  activity: [{ at: "", type: "", text: "", who: "", userId: "" }],
  attention: [{ key: "", count: 0, tone: "info", text: "" }],
};

export function normalizeOverview(raw: unknown): Overview {
  if (!isObj(raw) || !isObj(raw.period) || !isObj(raw.kpis)) throw new OverviewShapeError("Overview");
  const o = fill(OVERVIEW_SHAPE, raw) as Overview;
  o.period = repairPeriod(o.period);
  // Revenue series is null when Stripe is unavailable; otherwise both spans must be drawable.
  o.revenueSeries = isObj(raw.revenueSeries)
    ? (fill({ period: REVENUE_SERIES, year: REVENUE_SERIES }, raw.revenueSeries) as Overview["revenueSeries"])
    : null;
  o.campaigns = normalizeCampaigns(raw.campaigns);
  return o;
}

const DAY = 86400000;
const validTime = (iso: string) => (iso ? new Date(iso).getTime() : NaN);
const ymdOf = (t: number) => new Date(t).toISOString().slice(0, 10);

/*
 * The charts and comparisons do date arithmetic on the period, and an invalid
 * Date throws in toISOString(). Any missing or unreadable bound falls back to
 * a coherent window: the last 30 days, and the same length just before it.
 */
function repairPeriod(p: OverviewPeriod): OverviewPeriod {
  let to = validTime(p.to);
  let from = validTime(p.from);
  if (!Number.isFinite(to)) to = Date.now();
  if (!Number.isFinite(from) || from > to) from = to - 30 * DAY;
  let prevTo = validTime(p.prevTo);
  let prevFrom = validTime(p.prevFrom);
  if (!Number.isFinite(prevTo)) prevTo = from;
  if (!Number.isFinite(prevFrom) || prevFrom > prevTo) prevFrom = prevTo - (to - from);
  const isYmd = (s: string) => /^\d{4}-\d{2}-\d{2}$/.test(s);
  return {
    ...p,
    from: new Date(from).toISOString(),
    to: new Date(to).toISOString(),
    prevFrom: new Date(prevFrom).toISOString(),
    prevTo: new Date(prevTo).toISOString(),
    fromYmd: isYmd(p.fromYmd) ? p.fromYmd : ymdOf(from),
    toYmd: isYmd(p.toYmd) ? p.toYmd : ymdOf(to - 1),
    days: p.days > 0 ? p.days : Math.max(1, Math.round((to - from) / DAY)),
  };
}

function normalizeCampaigns(raw: unknown): CampaignNode[] {
  if (!Array.isArray(raw)) return [];
  return raw.filter(isObj).map((c) => {
    const node = fill(
      { name: "", registrations: 0, freeVisits: 0, members: 0, revenueCents: 0, conversion: null, spendCents: null, roas: null, costPerMemberCents: null },
      c
    ) as CampaignNode;
    if ("adsets" in c) node.adsets = normalizeCampaigns(c.adsets);
    if ("ads" in c) node.ads = normalizeCampaigns(c.ads);
    return node;
  });
}

export function normalizeList(raw: unknown): OverviewList {
  if (!isObj(raw)) throw new OverviewShapeError("list");
  return fill(
    {
      title: "",
      period: { label: "", fromYmd: "", toYmd: "" },
      rows: [{ userId: "", name: "", email: "", city: "", plan: null, membership: null, registeredAt: "", source: "", campaign: null, ad: null, hadFreeVisit: false }],
    },
    raw
  ) as OverviewList;
}

export function normalizeMap(raw: unknown): OverviewMap {
  if (!isObj(raw)) throw new OverviewShapeError("map");
  const m = fill({ generatedAt: "", total: 0, placed: 0, points: [] }, raw) as OverviewMap;
  // A point the map cannot place is dropped, not drawn at 0,0.
  m.points = m.points
    .filter((p) => isObj(p) && Number.isFinite(p.x) && Number.isFinite(p.y))
    .map((p) => fill({ id: "", ref: "", x: 0, y: 0, precise: false, name: "", city: "", plan: null, member: false, gift: false, freeVisit: false, oneTime: false, joinedAt: "", memberSince: null, source: "", lastVisit: null, nextVisit: null }, p) as MapPoint);
  return m;
}

export async function getOverview(q: RangeQuery): Promise<Overview> {
  const res = await API.get<unknown>("/api/admin/overview", { params: q, timeout: 45000 });
  return normalizeOverview(res.data);
}

export async function getOverviewList(q: RangeQuery & { metric: string; param?: string }): Promise<OverviewList> {
  const res = await API.get<unknown>("/api/admin/overview/list", { params: q, timeout: 45000 });
  return normalizeList(res.data);
}

export async function getOverviewMap(): Promise<OverviewMap> {
  const res = await API.get<unknown>("/api/admin/overview/map", { timeout: 45000 });
  return normalizeMap(res.data);
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
