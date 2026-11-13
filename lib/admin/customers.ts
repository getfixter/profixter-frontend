/**
 * The redesigned Customers API (backend track BE-CUST, routes/adminCustomerDirectory.js),
 * typed exactly as reports/BE-CUST.md documents it. Reads are cancellable
 * fetchers for useAdminQuery; writes are plain functions the sheets call.
 *
 * Rules carried here:
 * - Search text only ever travels in a POST body, never in a URL.
 * - Money-moving and externally visible actions carry an idempotency key.
 * - Every response is read defensively: a field the server leaves out reads
 *   as empty, never as a crash.
 */
import API from "@/lib/api";

/* ------------------------------------------------------------------ types */

export type CustomerFilter = "all" | "members" | "payment_issue" | "ending" | "blocked" | "archived";
export type PlanKey = "basic" | "plus" | "premium" | "elite";
export type BillingCycle = "monthly" | "annual";
export type PlanStatus = "active" | "trialing" | "payment_issue" | "ending" | "ended" | "none";

export type CustomerAddress = {
  id: string;
  label: string;
  /** Street without the unit. */
  line1: string;
  unit: string;
  town: string;
  state: string;
  zip: string;
  formatted: string;
  isDefault: boolean;
  plan: PlanKey | null;
  billingCycle: BillingCycle | null;
  planStatus: PlanStatus;
  statusDetail: string;
  renewsAt: string | null;
  endsAt: string | null;
  currentPeriodEnd: string | null;
  cancelAt: string | null;
  complimentary: boolean;
  stripeManaged: boolean;
};

export type CustomerRow = {
  id: string;
  userId: string;
  name: string;
  /** Formatted by the server: "(516) 555-1234". */
  phone: string;
  email: string;
  town: string;
  addresses: CustomerAddress[];
  blocked: boolean;
  archived: boolean;
  visitsCompleted: number;
};

/** Per-filter totals (first page only; `archived` for the owner only). */
export type CustomerCounts = Partial<Record<CustomerFilter, number>>;

export type CustomerPage = { filter: CustomerFilter; plan: PlanKey | null; items: CustomerRow[]; nextCursor: string | null; counts: CustomerCounts | null };

export const isPlanKey = (v: unknown): v is PlanKey => typeof v === "string" && ["basic", "plus", "premium", "elite"].includes(v);
export type CustomerSearchResult = { filter: CustomerFilter | null; query: string; items: CustomerRow[] };

export type Visit = {
  id: string;
  bookingNumber: string;
  date: string;
  service: string;
  status: string;
  accessType: string | null;
  bookingType: string | null;
  paymentState: string | null;
  addressId: string | null;
  address: string;
  assignedFixterName: string;
  href: string;
};

export type ProfileLoyalty = {
  standing: string;
  standingKey: string;
  countedMonths: number;
  nextMilestone: number | null;
  monthsRemaining: number | null;
  nextReward: { headline?: string; detail?: string } | null;
  expectedDate: string | null;
  benefitsEarned: number;
};

export type ProfileAddress = CustomerAddress & { introVisitStatus: string | null; loyalty: ProfileLoyalty | null };

export type Block = {
  id: string;
  reason: string;
  blockedAt: string | null;
  blockedByName: string;
  liftedAt: string | null;
  liftedByName: string;
  liftReason: string;
  active: boolean;
};

export type AllowedActions = {
  editProfile: boolean;
  editContact: boolean;
  changePlan: boolean;
  scheduleCancellation: boolean;
  grantComplimentary: boolean;
  sellMembership: boolean;
  createVisit: boolean;
  addNote: boolean;
  block: boolean;
  unblock: boolean;
  archive: boolean;
  unarchive: boolean;
  viewBilling: boolean;
  changeCommunication: boolean;
  /** Resend sign-in details: only while the account still waits for its first password. */
  resendAccess: boolean;
};

export type CustomerProfileSummary = {
  customer: {
    id: string;
    userId: string;
    name: string;
    firstName: string;
    lastName: string;
    email: string;
    phone: string;
    phoneFormatted: string;
    signupMethod: string | null;
    customerSince: string | null;
    updatedAt: string | null;
    archivedAt: string | null;
  };
  addresses: ProfileAddress[];
  visits: { completed: number; next: Visit | null; last: Visit | null };
  flags: {
    blocked: boolean;
    blockedReason?: string;
    phoneVerified: boolean;
    emailVerified: boolean;
    textsOk: boolean;
    offersByTextOk: boolean;
    archived: boolean;
    hasStripeCustomer: boolean;
  };
  blockHistory?: Block[];
  notesCount: number;
  allowedActions: AllowedActions;
};

export type BillingAvailable = {
  available: true;
  cachedAt: string | null;
  cached?: boolean;
  customers: { id: string; deleted: boolean; defaultPaymentMethod: { brand: string; last4: string; expMonth: number; expYear: number } | null; dashboardUrl: string }[];
  subscriptions: {
    id: string;
    status: string;
    plan: string | null;
    billingCycle: string | null;
    priceCents: number | null;
    addressId: string | null;
    cancelAtPeriodEnd: boolean;
    cancelAt: string | null;
    currentPeriodEnd: string | null;
    createdAt: string | null;
    dashboardUrl: string;
  }[];
  invoices: {
    id: string;
    number: string | null;
    status: string;
    billingReason: string | null;
    totalCents: number;
    amountDueCents: number;
    amountPaidCents: number;
    amountRemainingCents: number;
    currency: string;
    createdAt: string | null;
    periodStart: string | null;
    periodEnd: string | null;
    attemptCount: number;
    nextPaymentAttempt: string | null;
    subscriptionId: string | null;
    dashboardUrl: string;
  }[];
  payments: {
    id: string;
    paymentIntentId: string | null;
    amountCents: number;
    amountRefundedCents: number;
    refunded: boolean;
    currency: string;
    status: string;
    paid: boolean;
    failureCode: string | null;
    failureMessage: string | null;
    description: string | null;
    createdAt: string | null;
    card: { brand: string; last4: string } | null;
    dashboardUrl: string;
    /** A Charge extra payment: labelled here, never listed twice. */
    extraCharge?: { id: string; number: string; bookingId: string; bookingNumber: string; description: string };
  }[];
  /** Charge extra records of this account; inPayments = already one of the payments above. */
  additionalCharges?: {
    id: string;
    number: string;
    bookingId: string;
    bookingNumber: string;
    description: string;
    status: string;
    totalCents: number;
    taxCents: number;
    refundedCents: number;
    paidAt: string | null;
    createdAt: string;
    inPayments: boolean;
    stripeUrl: string | null;
  }[];
  upcoming: { customerId: string; amountDueCents: number; currency: string; nextPaymentAttempt: string | null; periodEnd: string | null; subscriptionId: string | null }[];
  refundsNote?: string;
};
export type Billing = BillingAvailable | { available: false; reason: "stripe_unavailable" | "stripe_not_configured" | string };

export type Gift = {
  id: string;
  giftNumber: string;
  role: "purchased" | "received";
  plan: string;
  durationMonths: number;
  status: string;
  purchaserName: string;
  recipientName: string;
  recipientEmail: string;
  addressId: string | null;
  purchasedAt: string | null;
  claimedAt: string | null;
};

export type PaymentLink = {
  id: string;
  kind: string;
  itemLabel: string;
  status: "sent" | "paid" | "expired" | "canceled";
  plan: string | null;
  billingCycle: string | null;
  addressId: string | null;
  bookingId: string | null;
  bookingNumber: string | null;
  sentVia: string[];
  expiresAt: string | null;
  openedCount: number;
  lastOpenedAt: string | null;
  paidAt: string | null;
  createdAt: string | null;
  createdByName: string;
};

export type Note = { id: string; text: string; authorName: string; at: string };

export type ConsentHistoryItem = {
  id: string;
  at: string;
  channel: string;
  purpose: string;
  action: string;
  source: string;
  method: string;
  evidence: string;
  consentText: string;
  detail: string;
  recordedByName: string;
  ip?: string;
};

export type ConsentRead = {
  evidence: {
    serviceSms: { enabled: boolean; at: string | null; source: string };
    marketingSms: { enabled: boolean; at: string | null; source: string; method: string; evidence: string };
    serviceEmail: { enabled: boolean; changedAt: string | null; source: string };
    marketingEmail: { at: string | null; source: string };
  };
  stop: { phoneOptedOut: boolean; scope: string; at: string | null; source: string };
  history: ConsentHistoryItem[];
};

export type PlanPreview = {
  previewToken: string;
  expiresAt: string;
  changeType: "upgrade" | "downgrade";
  current: { plan: string; cycle: string; priceCents: number | null; status: string; currentPeriodEnd: string | null };
  requested: { plan: string; cycle: string; priceCents: number | null };
  amountDueNowCents: number | null;
  creditCents: number | null;
  nextRenewalDate: string | null;
  nextRenewalAmountCents: number | null;
  effective: "now" | "period_end";
  warnings: { code: string; message: string }[];
};

export type AddressPlanSummary = {
  plan: string | null;
  billingCycle: string | null;
  planStatus: PlanStatus;
  cancelAt: string | null;
  renewsAt: string | null;
  endsAt: string | null;
  pendingPlan: string | null;
  pendingChangeEffectiveDate: string | null;
};

/** A project of this customer (GET /customers/:id/projects, matched by customerId). Money is null without projects.manage. */
export type CustomerProject = {
  id: string;
  projectNumber: string;
  title: string;
  projectType: string;
  status: string;
  derivedStage: { key: string; label: string } | null;
  executedValueCents: number | null;
  paidCents: number | null;
  outstandingCents: number | null;
  createdAt: string | null;
  href: string;
};
export type CustomerProjects = { items: CustomerProject[]; moneyVisible: boolean };

/* ------------------------------------------------------------- read safely */

const str = (v: unknown) => (typeof v === "string" ? v : v === null || v === undefined ? "" : String(v));
const arr = <T>(v: unknown): T[] => (Array.isArray(v) ? (v as T[]) : []);

function readAddress(a: Partial<CustomerAddress> | null | undefined): CustomerAddress {
  const x = a || {};
  return {
    id: str(x.id),
    label: str(x.label),
    line1: str(x.line1),
    unit: str(x.unit),
    town: str(x.town),
    state: str(x.state),
    zip: str(x.zip),
    formatted: str(x.formatted),
    isDefault: Boolean(x.isDefault),
    plan: (x.plan as PlanKey) || null,
    billingCycle: (x.billingCycle as BillingCycle) || null,
    planStatus: (x.planStatus as PlanStatus) || "none",
    statusDetail: str(x.statusDetail),
    renewsAt: x.renewsAt || null,
    endsAt: x.endsAt || null,
    currentPeriodEnd: x.currentPeriodEnd || null,
    cancelAt: x.cancelAt || null,
    complimentary: Boolean(x.complimentary),
    stripeManaged: Boolean(x.stripeManaged),
  };
}

export function readRow(r: Partial<CustomerRow> | null | undefined): CustomerRow {
  const x = r || {};
  return {
    id: str(x.id),
    userId: str(x.userId),
    name: str(x.name),
    phone: str(x.phone),
    email: str(x.email),
    town: str(x.town),
    addresses: arr<Partial<CustomerAddress>>(x.addresses).map(readAddress),
    blocked: Boolean(x.blocked),
    archived: Boolean(x.archived),
    visitsCompleted: Number(x.visitsCompleted) || 0,
  };
}

/* ------------------------------------------------------------------ keys */

export const customerKeys = {
  list: (filter: CustomerFilter, plan: PlanKey | null = null) => ["customer-list", filter, plan || "any"] as const,
  search: (filter: CustomerFilter, q: string) => ["customer-search", filter, q] as const,
  profile: (id: string) => ["customer", id, "profile"] as const,
  visits: (id: string) => ["customer", id, "visits"] as const,
  billing: (id: string) => ["customer", id, "billing"] as const,
  gifts: (id: string) => ["customer", id, "gifts"] as const,
  paymentLinks: (id: string) => ["customer", id, "payment-links"] as const,
  notes: (id: string) => ["customer", id, "notes"] as const,
  consent: (id: string) => ["customer", id, "consent"] as const,
  activity: (id: string, limit: 10 | "all") => ["customer", id, "activity", limit] as const,
  loyalty: (id: string) => ["customer", id, "loyalty"] as const,
  projects: (id: string) => ["customer", id, "projects"] as const,
};

const enc = encodeURIComponent;

/* ------------------------------------------------------------------ reads */

export async function fetchCustomerPage(filter: CustomerFilter, cursor: string | null, signal?: AbortSignal, plan: PlanKey | null = null): Promise<CustomerPage> {
  const params: Record<string, string> = { filter, limit: "50" };
  if (cursor) params.cursor = cursor;
  if (plan) params.plan = plan;
  const { data } = await API.get("/api/admin/customers", { params, signal });
  return { filter, plan, items: arr<Partial<CustomerRow>>(data?.items).map(readRow), nextCursor: data?.nextCursor || null, counts: readCounts(data?.counts) };
}

function readCounts(raw: unknown): CustomerCounts | null {
  if (!raw || typeof raw !== "object") return null;
  const out: CustomerCounts = {};
  for (const [k, v] of Object.entries(raw as Record<string, unknown>)) {
    if (["all", "members", "payment_issue", "ending", "blocked", "archived"].includes(k) && typeof v === "number" && Number.isFinite(v) && v >= 0) out[k as CustomerFilter] = v;
  }
  return out;
}

/** Search in the body, never the URL (audit X-11). */
export async function searchCustomers(q: string, filter: CustomerFilter, signal?: AbortSignal): Promise<CustomerSearchResult> {
  const body: Record<string, unknown> = { q, limit: 25 };
  if (filter === "archived") {
    body.filter = "archived";
    body.includeArchived = true;
  }
  const { data } = await API.post("/api/admin/customers/search", body, { signal });
  return { filter: data?.filter || null, query: str(data?.query), items: arr<Partial<CustomerRow>>(data?.items).map(readRow) };
}

export async function fetchProfile(id: string, signal?: AbortSignal): Promise<CustomerProfileSummary> {
  const { data } = await API.get(`/api/admin/customers/${enc(id)}`, { signal });
  if (!data || typeof data !== "object" || !data.customer) throw Object.assign(new Error("This customer could not be loaded."), { code: "BAD_RESPONSE" });
  const allowed = (data.allowedActions || {}) as Record<string, boolean>;
  return {
    customer: { ...data.customer, name: str(data.customer.name), email: str(data.customer.email), phone: str(data.customer.phone), phoneFormatted: str(data.customer.phoneFormatted) },
    addresses: arr<Partial<ProfileAddress>>(data.addresses).map((a) => ({ ...readAddress(a), introVisitStatus: a.introVisitStatus || null, loyalty: a.loyalty || null })),
    visits: { completed: Number(data.visits?.completed) || 0, next: data.visits?.next || null, last: data.visits?.last || null },
    flags: {
      blocked: Boolean(data.flags?.blocked),
      blockedReason: data.flags?.blockedReason,
      phoneVerified: Boolean(data.flags?.phoneVerified),
      emailVerified: Boolean(data.flags?.emailVerified),
      textsOk: Boolean(data.flags?.textsOk),
      offersByTextOk: Boolean(data.flags?.offersByTextOk),
      archived: Boolean(data.flags?.archived),
      hasStripeCustomer: Boolean(data.flags?.hasStripeCustomer),
    },
    blockHistory: Array.isArray(data.blockHistory) ? data.blockHistory : undefined,
    notesCount: Number(data.notesCount) || 0,
    allowedActions: {
      editProfile: !!allowed.editProfile,
      editContact: !!allowed.editContact,
      changePlan: !!allowed.changePlan,
      scheduleCancellation: !!allowed.scheduleCancellation,
      grantComplimentary: !!allowed.grantComplimentary,
      sellMembership: !!allowed.sellMembership,
      createVisit: !!allowed.createVisit,
      // The report names it addInternalNote; the route returns addNote. Either is honoured.
      addNote: !!(allowed.addNote || allowed.addInternalNote),
      block: !!allowed.block,
      unblock: !!allowed.unblock,
      archive: !!allowed.archive,
      unarchive: !!allowed.unarchive,
      viewBilling: !!allowed.viewBilling,
      changeCommunication: !!allowed.changeCommunication,
      resendAccess: !!allowed.resendAccess,
    },
  };
}

export async function fetchVisits(id: string, cursor: string | null, signal?: AbortSignal): Promise<{ items: Visit[]; nextCursor: string | null }> {
  const params: Record<string, string> = { limit: "25" };
  if (cursor) params.cursor = cursor;
  const { data } = await API.get(`/api/admin/customers/${enc(id)}/visits`, { params, signal });
  return { items: arr<Visit>(data?.items), nextCursor: data?.nextCursor || null };
}

export async function fetchBilling(id: string, signal?: AbortSignal, fresh = false): Promise<Billing> {
  const { data } = await API.get(`/api/admin/customers/${enc(id)}/billing`, { params: fresh ? { fresh: "1" } : undefined, signal });
  if (!data || data.available !== true) return { available: false, reason: str(data?.reason) || "stripe_unavailable" };
  return {
    ...data,
    customers: arr(data.customers),
    subscriptions: arr(data.subscriptions),
    invoices: arr(data.invoices),
    payments: arr(data.payments),
    additionalCharges: arr(data.additionalCharges),
    upcoming: arr(data.upcoming),
  } as BillingAvailable;
}

export async function fetchGifts(id: string, signal?: AbortSignal): Promise<Gift[]> {
  const { data } = await API.get(`/api/admin/customers/${enc(id)}/gifts`, { signal });
  return arr<Gift>(data?.items);
}

export async function fetchPaymentLinks(id: string, signal?: AbortSignal): Promise<PaymentLink[]> {
  const { data } = await API.get(`/api/admin/customers/${enc(id)}/payment-links`, { signal });
  return arr<PaymentLink>(data?.items);
}

export async function fetchNotes(id: string, signal?: AbortSignal): Promise<Note[]> {
  const { data } = await API.get(`/api/admin/customers/${enc(id)}/notes`, { signal });
  return arr<Note>(data?.items);
}

export async function fetchConsent(id: string, signal?: AbortSignal): Promise<ConsentRead> {
  const { data } = await API.get(`/api/admin/customers/${enc(id)}/consent`, { signal });
  const ev = data?.evidence || {};
  return {
    evidence: {
      serviceSms: { enabled: !!ev.serviceSms?.enabled, at: ev.serviceSms?.at || null, source: str(ev.serviceSms?.source) },
      marketingSms: { enabled: !!ev.marketingSms?.enabled, at: ev.marketingSms?.at || null, source: str(ev.marketingSms?.source), method: str(ev.marketingSms?.method), evidence: str(ev.marketingSms?.evidence) },
      serviceEmail: { enabled: ev.serviceEmail?.enabled !== false, changedAt: ev.serviceEmail?.changedAt || null, source: str(ev.serviceEmail?.source) },
      marketingEmail: { at: ev.marketingEmail?.at || null, source: str(ev.marketingEmail?.source) },
    },
    stop: { phoneOptedOut: !!data?.stop?.phoneOptedOut, scope: str(data?.stop?.scope), at: data?.stop?.at || null, source: str(data?.stop?.source) },
    history: arr<ConsentHistoryItem>(data?.history),
  };
}

/** This customer's projects, by customerId (not by matching text). */
export async function fetchCustomerProjects(id: string, signal?: AbortSignal): Promise<CustomerProjects> {
  const { data } = await API.get(`/api/admin/customers/${enc(id)}/projects`, { signal });
  const num = (v: unknown) => (typeof v === "number" && Number.isFinite(v) ? v : null);
  return {
    moneyVisible: Boolean(data?.moneyVisible),
    items: arr<Record<string, unknown>>(data?.items).map((p) => {
      const stage = p.derivedStage && typeof p.derivedStage === "object" ? (p.derivedStage as Record<string, unknown>) : null;
      const id = str(p.id);
      const href = str(p.href);
      return {
        id,
        projectNumber: str(p.projectNumber),
        title: str(p.title),
        projectType: str(p.projectType),
        status: str(p.status),
        derivedStage: stage ? { key: str(stage.key), label: str(stage.label) } : null,
        executedValueCents: num(p.executedValueCents),
        paidCents: num(p.paidCents),
        outstandingCents: num(p.outstandingCents),
        createdAt: p.createdAt ? str(p.createdAt) : null,
        href: /^\/admin\/projects\/[A-Za-z0-9_-]+$/.test(href) ? href : `/admin/projects/${enc(id)}`,
      };
    }),
  };
}

/* ----------------------------------------------------------------- writes */

/** A client UUID for an idempotency key (crypto.randomUUID needs a secure context). */
export function newIdempotencyKey(): string {
  const c = typeof globalThis !== "undefined" ? (globalThis.crypto as Crypto | undefined) : undefined;
  if (c?.randomUUID) {
    try {
      return c.randomUUID();
    } catch {
      /* not a secure context: fall through */
    }
  }
  const bytes = new Uint8Array(16);
  if (c?.getRandomValues) c.getRandomValues(bytes);
  else for (let i = 0; i < 16; i++) bytes[i] = Math.floor(Math.random() * 256);
  bytes[6] = (bytes[6] & 0x0f) | 0x40;
  bytes[8] = (bytes[8] & 0x3f) | 0x80;
  const hex = Array.from(bytes, (b) => b.toString(16).padStart(2, "0")).join("");
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`;
}

const home = (id: string, addressId: string) => `/api/admin/customers/${enc(id)}/addresses/${enc(addressId)}`;

export async function previewPlanChange(id: string, addressId: string, body: { plan: PlanKey; cycle: BillingCycle }): Promise<PlanPreview> {
  const { data } = await API.post(`${home(id, addressId)}/plan-change/preview`, body);
  return { ...data, warnings: arr(data?.warnings) } as PlanPreview;
}

export async function confirmPlanChange(id: string, addressId: string, body: { previewToken: string; idempotencyKey: string }) {
  const { data } = await API.post(`${home(id, addressId)}/plan-change/confirm`, body);
  return data as { message: string; changeType: string; effective: string; addressPlan: AddressPlanSummary; replayed?: boolean };
}

/**
 * Set, move or clear a cancellation. With a plan change already scheduled on
 * the subscription, "date" and "clear" answer 409 PENDING_PLAN_CHANGE
 * ({pendingPlanChange: {plan, billingCycle, effectiveDate}}) until the admin
 * confirms dropping it: `releasePendingPlanChange: true`.
 */
export async function scheduleCancellation(
  id: string,
  addressId: string,
  body: { mode: "period_end" | "date" | "clear"; date?: string; idempotencyKey: string; releasePendingPlanChange?: boolean }
) {
  const { data } = await API.post(`${home(id, addressId)}/cancellation`, { ...body, confirm: true });
  return data as { message: string; addressPlan: AddressPlanSummary };
}

export async function grantComplimentary(id: string, addressId: string, body: { plan: PlanKey; reason: string; endsOn?: string }) {
  const { data } = await API.post(`${home(id, addressId)}/complimentary`, { ...body, confirm: true });
  return data as { message: string; addressPlan: AddressPlanSummary };
}

export async function blockCustomer(id: string, reason: string) {
  const { data } = await API.post(`/api/admin/customers/${enc(id)}/block`, { reason });
  return data as { blocked: true; block: Block; history: Block[] };
}

export async function unblockCustomer(id: string, reason: string) {
  const { data } = await API.delete(`/api/admin/customers/${enc(id)}/block`, { data: { reason } });
  return data as { blocked: false; history: Block[] };
}

export async function archiveCustomer(id: string, reason: string) {
  const { data } = await API.post(`/api/admin/customers/${enc(id)}/archive`, reason ? { reason } : {});
  return data as { archived: boolean; archivedAt?: string };
}

export async function unarchiveCustomer(id: string) {
  const { data } = await API.post(`/api/admin/customers/${enc(id)}/unarchive`, {});
  return data as { archived: boolean };
}

export async function addNote(id: string, text: string): Promise<Note> {
  const { data } = await API.post(`/api/admin/customers/${enc(id)}/notes`, { text });
  return data?.note as Note;
}

/* ----------------------------------------------------------- presentation */

export const PLAN_LABEL: Record<string, string> = { basic: "Basic", plus: "Plus", premium: "Premium", elite: "Elite" };
export const PLAN_KEYS: PlanKey[] = ["basic", "plus", "premium", "elite"];
export const planLabel = (plan: string | null | undefined) => (plan ? PLAN_LABEL[plan] || plan[0].toUpperCase() + plan.slice(1) : "No plan");

/** "Dec 1" in New York (with the year when it is not this year). */
export function shortDate(value: string | null | undefined): string {
  if (!value) return "";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  const thisYear = new Intl.DateTimeFormat("en-US", { timeZone: "America/New_York", year: "numeric" }).format(new Date());
  const year = new Intl.DateTimeFormat("en-US", { timeZone: "America/New_York", year: "numeric" }).format(date);
  return new Intl.DateTimeFormat("en-US", { timeZone: "America/New_York", month: "short", day: "numeric", ...(year !== thisYear ? { year: "numeric" } : {}) }).format(date);
}

export function dateTime(value: string | null | undefined): string {
  if (!value) return "";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  return new Intl.DateTimeFormat("en-US", { timeZone: "America/New_York", month: "short", day: "numeric", year: "numeric", hour: "numeric", minute: "2-digit" }).format(date);
}

/** True for a home whose membership is not over: complimentary is refused beside it. */
export const hasLiveMembership = (a: Pick<CustomerAddress, "planStatus">) => ["active", "trialing", "payment_issue", "ending"].includes(a.planStatus);

/** The membership chip text and tone for one home, e.g. "Plus · renews Dec 1". */
export function planChip(a: CustomerAddress): { text: string; tone: "info" | "attention" | "problem" | "neutral" | "success" } | null {
  const plan = planLabel(a.plan);
  switch (a.planStatus) {
    case "payment_issue":
      return { text: "Payment issue", tone: "problem" };
    case "ending":
      return { text: `${plan} · ends ${shortDate(a.endsAt || a.cancelAt) || "soon"}`, tone: "attention" };
    case "trialing":
      return { text: `${plan} · trial${a.renewsAt ? ` · renews ${shortDate(a.renewsAt)}` : ""}`, tone: "info" };
    case "active":
      if (a.complimentary) return { text: `${plan} · complimentary${a.endsAt ? ` · ends ${shortDate(a.endsAt)}` : ""}`, tone: "success" };
      return { text: a.renewsAt ? `${plan} · renews ${shortDate(a.renewsAt)}` : plan, tone: "info" };
    default:
      return null;
  }
}

const RANK: Record<PlanStatus, number> = { payment_issue: 0, ending: 1, active: 2, trialing: 2, ended: 3, none: 4 };

/** The one home to summarise a customer by in a list row: the one needing attention first. */
export function headlineAddress(addresses: CustomerAddress[]): CustomerAddress | null {
  if (!addresses.length) return null;
  return [...addresses].sort((a, b) => RANK[a.planStatus] - RANK[b.planStatus] || Number(b.isDefault) - Number(a.isDefault))[0];
}

/** A plain sentence for one home's membership state (Overview and Billing). */
export function membershipSentence(a: CustomerAddress): string {
  const plan = planLabel(a.plan);
  const cycle = a.billingCycle === "annual" ? "annual" : a.billingCycle === "monthly" ? "monthly" : "";
  const head = [plan, cycle].filter(Boolean).join(" · ");
  switch (a.planStatus) {
    case "active":
      if (a.complimentary) return `${head} · complimentary${a.endsAt ? `, ends ${shortDate(a.endsAt)}` : ", open-ended"}`;
      return a.renewsAt ? `${head} · renews ${shortDate(a.renewsAt)}` : `${head} · active`;
    case "trialing":
      return `${head} · in trial${a.renewsAt ? `, first charge ${shortDate(a.renewsAt)}` : ""}`;
    case "ending":
      return `${head} · ends ${shortDate(a.endsAt || a.cancelAt) || "at period end"}`;
    case "payment_issue":
      return `${head} · payment issue${a.statusDetail ? ` (${a.statusDetail.replace(/_/g, " ")})` : ""}`;
    case "ended":
      return "Membership ended";
    default:
      return "No membership";
  }
}
