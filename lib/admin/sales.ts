/**
 * The sales desk: the Telemarketer workspace (/api/sales/*) and the owner's
 * Sales desk (/api/admin/sales-desk/*). Types mirror BackEnd utils/sales/views.js,
 * utils/sales/bonus.js bonusProgress() and the two route files; the server is
 * the source of truth for every figure (this file never computes money or
 * bonus progress, it only formats what the server sent).
 *
 * Money arrives as integer cents. Dates are shown in America/New_York.
 * Idempotency keys travel in the request BODY (the CORS allow-list has no
 * header for them).
 */
import API from "@/lib/api";

export const TZ = "America/New_York";

/* ------------------------------------------------------------------ */
/* formatting                                                          */
/* ------------------------------------------------------------------ */

/** $1,234.56 from integer cents, always two decimals; negative as −$12.00. */
export function money(cents: number | null | undefined): string {
  if (cents === null || cents === undefined || !Number.isFinite(cents)) return "—";
  const text = (Math.abs(cents) / 100).toLocaleString("en-US", { style: "currency", currency: "USD", minimumFractionDigits: 2, maximumFractionDigits: 2 });
  return cents < 0 ? `−${text}` : text;
}

/** $500 for a round prize, $512.50 otherwise (the bonus headline). */
export function prize(cents: number | null | undefined): string {
  if (cents === null || cents === undefined || !Number.isFinite(cents)) return "—";
  return cents % 100 === 0 ? `$${(cents / 100).toLocaleString("en-US")}` : money(cents);
}

/** Signed dollars typed by the owner ("-12.50", "40") to integer cents, or null. */
export function dollarsToCents(value: string, { allowNegative = false } = {}): number | null {
  const v = String(value || "").replace(/[$,\s]/g, "").replace(/^−/, "-");
  const m = /^(-)?(\d{1,6})(?:\.(\d{1,2}))?$/.exec(v);
  if (!m) return null;
  if (m[1] && !allowNegative) return null;
  const cents = Number(m[2]) * 100 + Number((m[3] || "").padEnd(2, "0"));
  return m[1] ? -cents : cents;
}

const fmt = (iso: string | Date | null | undefined, opts: Intl.DateTimeFormatOptions) => {
  if (!iso) return "";
  const d = new Date(iso);
  return Number.isNaN(d.getTime()) ? "" : d.toLocaleString("en-US", { timeZone: TZ, ...opts });
};
export const dateText = (iso: string | Date | null | undefined) => fmt(iso, { month: "short", day: "numeric", year: "numeric" });
export const shortDate = (iso: string | Date | null | undefined) => fmt(iso, { month: "short", day: "numeric" });
export const dateTimeText = (iso: string | Date | null | undefined) => fmt(iso, { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" });
export const timeText = (iso: string | Date | null | undefined) => fmt(iso, { hour: "numeric", minute: "2-digit" });

/** A calendar day key (YYYY-MM-DD, already a New York day) as "Fri, Nov 13". */
export function dayText(key: string | null | undefined, { weekday = true, year = false } = {}): string {
  if (!key || !/^\d{4}-\d{2}-\d{2}/.test(key)) return key || "";
  const d = new Date(`${key.slice(0, 10)}T12:00:00Z`);
  return d.toLocaleDateString("en-US", { timeZone: "UTC", ...(weekday ? { weekday: "short" } : {}), month: "short", day: "numeric", ...(year ? { year: "numeric" } : {}) });
}

/** A Friday–Thursday pay week: "Fri, Nov 13 – Thu, Nov 19". */
export const weekText = (week: string, lastDay: string) => `${dayText(week)} – ${dayText(lastDay)}`;

/** "12 days 4 hours left" from milliseconds. */
export function timeLeft(ms: number | null | undefined): string {
  if (ms === null || ms === undefined || ms <= 0) return "Period ended";
  const hours = Math.floor(ms / 3600000);
  const days = Math.floor(hours / 24);
  const h = hours % 24;
  if (days >= 1) return `${days} day${days === 1 ? "" : "s"}${h ? ` ${h} hour${h === 1 ? "" : "s"}` : ""} left`;
  if (hours >= 1) return `${hours} hour${hours === 1 ? "" : "s"} left`;
  return "Less than an hour left";
}

/** New York wall-clock "YYYY-MM-DDTHH:mm" (a datetime-local value) to an ISO instant. */
export function nyLocalToIso(local: string): string | null {
  const m = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})$/.exec(local || "");
  if (!m) return null;
  const wall = Date.UTC(+m[1], +m[2] - 1, +m[3], +m[4], +m[5]);
  const offsetAt = (ms: number) => {
    const parts = Object.fromEntries(new Intl.DateTimeFormat("en-US", { timeZone: TZ, hourCycle: "h23", year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit" }).formatToParts(new Date(ms)).map((p) => [p.type, p.value]));
    return Date.UTC(+parts.year, +parts.month - 1, +parts.day, +parts.hour, +parts.minute) - ms;
  };
  let guess = wall - offsetAt(wall);
  guess = wall - offsetAt(guess);
  return new Date(guess).toISOString();
}

/** An ISO instant as a New York datetime-local value. */
export function isoToNyLocal(iso: string | Date): string {
  const parts = Object.fromEntries(new Intl.DateTimeFormat("en-US", { timeZone: TZ, hourCycle: "h23", year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit" }).formatToParts(new Date(iso)).map((p) => [p.type, p.value]));
  return `${parts.year}-${parts.month}-${parts.day}T${parts.hour}:${parts.minute}`;
}

/** Today in New York as YYYY-MM-DD. */
export function nyToday(): string {
  return isoToNyLocal(new Date()).slice(0, 10);
}

/** A New York day N days from now at a given hour, as datetime-local. */
export function nyDayAt(daysFromNow: number, hour: number): string {
  const base = new Date(`${nyToday()}T12:00:00Z`);
  base.setUTCDate(base.getUTCDate() + daysFromNow);
  return `${base.toISOString().slice(0, 10)}T${String(hour).padStart(2, "0")}:00`;
}

export function newKey(): string {
  try {
    if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") return crypto.randomUUID();
  } catch {
    /* insecure context */
  }
  return `k${Date.now().toString(36)}${Math.random().toString(36).slice(2, 12)}`;
}

/* ------------------------------------------------------------------ */
/* labels                                                              */
/* ------------------------------------------------------------------ */

export type Stage = "new" | "contacted" | "interested" | "not_interested" | "lost";
export const STAGES: { id: Stage; label: string }[] = [
  { id: "new", label: "New" },
  { id: "contacted", label: "Contacted" },
  { id: "interested", label: "Interested" },
  { id: "not_interested", label: "Not interested" },
  { id: "lost", label: "Do not contact" },
];
export const stageLabel = (s: string) => STAGES.find((x) => x.id === s)?.label || s;

export type OutcomeKind = "attempt" | "voicemail" | "reached_interested" | "reached_not_interested" | "call_back" | "wrong_number" | "do_not_contact" | "note";
export const OUTCOMES: { id: OutcomeKind; label: string; contact: boolean }[] = [
  { id: "attempt", label: "No answer", contact: true },
  { id: "voicemail", label: "Left voicemail", contact: true },
  { id: "reached_interested", label: "Reached: interested", contact: true },
  { id: "reached_not_interested", label: "Reached: not interested", contact: true },
  { id: "call_back", label: "Asked to call back", contact: true },
  { id: "wrong_number", label: "Wrong number", contact: true },
  { id: "do_not_contact", label: "Do not contact", contact: false },
  { id: "note", label: "Note", contact: false },
];

const ACTIVITY_LABEL: Record<string, string> = {
  attempt: "Called, no answer",
  voicemail: "Left a voicemail",
  reached_interested: "Reached, interested",
  reached_not_interested: "Reached, not interested",
  call_back: "Asked to call back",
  wrong_number: "Wrong number",
  do_not_contact: "Asked not to be contacted",
  note: "Note",
  coaching: "Coaching note",
  correction: "Correction",
  assigned: "Assigned",
  reassigned: "Reassigned",
  linked: "Linked to account",
  intake_approved: "Approved from intake",
  ghl_call: "GHL call",
  ghl_sms: "GHL text",
  ghl_dnd: "GHL do-not-disturb",
  registered: "Registered",
  phone_verified: "Phone verified",
  free_visit_requested: "Free visit requested",
};
export function activityLabel(kind: string): string {
  if (ACTIVITY_LABEL[kind]) return ACTIVITY_LABEL[kind];
  if (kind.startsWith("free_visit_")) return "Free visit";
  if (kind.startsWith("membership_")) return "Membership payment";
  if (kind === "full_day_paid") return "Full Day payment";
  return kind.replace(/_/g, " ");
}

export const TASK_KINDS = [
  { id: "call", label: "Call" },
  { id: "text", label: "Text" },
  { id: "check_booking", label: "Check booking" },
  { id: "other", label: "Other" },
];
export const taskKindLabel = (k: string) => TASK_KINDS.find((t) => t.id === k)?.label || k;

export const REQUEST_KINDS = [
  { id: "recovery", label: "Recovery", hint: "I brought back a customer who had lapsed or abandoned checkout" },
  { id: "upgrade", label: "Upgrade", hint: "I talked the customer into a bigger plan" },
  { id: "missed_link", label: "Missed link", hint: "This is my lead, but the sale was not linked to me" },
  { id: "other", label: "Other", hint: "Something else: explain below" },
] as const;
export type RequestKind = (typeof REQUEST_KINDS)[number]["id"];
export const requestKindLabel = (k: string) => REQUEST_KINDS.find((x) => x.id === k)?.label || k;

export const REQUEST_STATUS: Record<string, { label: string; tone: "attention" | "info" | "success" | "neutral" | "problem" }> = {
  pending: { label: "Waiting for the owner", tone: "attention" },
  needs_info: { label: "Owner asked a question", tone: "problem" },
  approved: { label: "Approved", tone: "success" },
  rejected: { label: "Not approved", tone: "neutral" },
  withdrawn: { label: "Withdrawn", tone: "neutral" },
};

export const SALE_STATUS: Record<string, string> = {
  credited_to_you: "Credited to you",
  credited_to_someone_else: "Credited to someone else",
  held_for_review: "Held for the owner's review",
  no_credit: "No sales credit (owner decision)",
  returning_customer: "Returning customer: no automatic credit",
  plan_change: "Plan change: no automatic credit",
  unattributed: "Not credited to anyone",
  requested_by_someone_else: "Another employee asked for credit",
  your_request_pending: "Your credit request is waiting",
  your_request_needs_info: "The owner asked about your request",
};

export const ATTRIBUTION: Record<string, { label: string; tone: "attention" | "info" | "success" | "neutral" | "problem" }> = {
  approved: { label: "Credited to you", tone: "success" },
  pending_review: { label: "Held for review", tone: "attention" },
  request_pending: { label: "Your request: waiting", tone: "attention" },
  request_needs_info: { label: "Your request: question", tone: "problem" },
  request_approved: { label: "Request approved", tone: "success" },
  request_rejected: { label: "Request not approved", tone: "neutral" },
  request_withdrawn: { label: "Request withdrawn", tone: "neutral" },
  credited: { label: "Credited", tone: "success" },
  held: { label: "Held for review", tone: "attention" },
  rejected: { label: "No credit", tone: "neutral" },
  none: { label: "No credit", tone: "neutral" },
};

export const STATEMENT_STATUS: Record<string, { label: string; tone: "attention" | "info" | "success" | "neutral" | "problem" }> = {
  this_week: { label: "This week (still adding up)", tone: "info" },
  awaiting_approval: { label: "Waiting for the owner's approval", tone: "attention" },
  approved: { label: "Approved, not yet paid", tone: "info" },
  paid: { label: "Paid", tone: "success" },
};

export const PAYOUT_STATUS: Record<string, { label: string; tone: "attention" | "info" | "success" | "neutral" | "problem" }> = {
  accruing: { label: "This week (still adding up)", tone: "info" },
  ready: { label: "Ready to approve", tone: "attention" },
  approved: { label: "Approved", tone: "success" },
};

export const PRODUCT_LABEL: Record<string, string> = {
  membership_monthly: "Monthly membership",
  membership_annual: "Annual membership",
  full_day: "Full Day",
  bonus: "Bonus",
  adjustment: "Adjustment",
};

/* ------------------------------------------------------------------ */
/* employee types                                                      */
/* ------------------------------------------------------------------ */

export type Bonus = {
  started: boolean;
  anchorDate?: string;
  period?: { index: number; number: number; firstDay: string; lastDay: string; startsAt: string; endsAt: string; msLeft: number };
  threshold: number;
  amountCents: number;
  verifiedCount?: number;
  pendingCount: number;
  pendingItems?: { kind: string; paidAt: string }[];
  inBlock?: number;
  remaining?: number;
  nextBonusAt?: number;
  bonusesThisPeriod?: number;
  earnedThisPeriodCents?: number;
  paidThisPeriodCents?: number;
  awaitingPaymentThisPeriodCents?: number;
  milestones?: { at: number; reached: boolean }[];
  countedSales?: { entry: string; sale: string; user: string; product: string; paidAt: string }[];
  allTime: { earnedCents: number; paidCents: number; awaitingPaymentCents: number; count: number };
  message: string;
};

export type Claim = { type: "held_credit" | "credit_request"; requestId?: string; saleId: string; label: string; paidAt: string; proposedCents: number; why?: string; status?: string; countsForBonus: boolean };

export type Earnings = {
  earnedCents: number;
  commissionCents: number;
  bonusCents: number;
  adjustmentCents: number;
  onOpenStatementsCents: number;
  approvedUnpaidCents: number;
  paidCents: number;
  pendingClaimsCents: number;
  pendingClaimsCount: number;
  claims: Claim[];
};

export type TaskRow = { id: string; leadId: string; name: string; town: string; dueAt: string; kind: string; note: string; overdue: boolean };
export type Goals = { weeklyMemberships: number; weeklyFreeVisits: number; note: string };

export type MyDay = {
  tasks: TaskRow[];
  overdueCount: number;
  newAssignments: { leadId: string; name: string; town: string; assignedAt: string }[];
  upcomingVisits: { leadId: string; name: string; date: string; status: string; label: string; verified: boolean }[];
  leadsCount: number;
  bonus: Bonus;
  earnings: Earnings;
};

export type SalesMe = { me: { id: string; name: string; firstName: string }; referral: { code: string; url: string }; day: MyDay; goals: Goals };

export type LeadCard = {
  id: string;
  name: string;
  town: string;
  phoneLast4: string;
  stage: Stage;
  linked: boolean;
  assignedAt: string | null;
  creditWithMe: boolean;
  doNotCall: boolean;
  doNotText: boolean;
  lastActivityAt: string | null;
  nextTask: { id: string; dueAt: string; kind: string; note: string } | null;
};

export type Suppression = { call: boolean; sms: boolean; reasons: { channel: string; source: string; reason: string; at: string }[] };
export type GhlLinks = { contact: string | null; conversation: string | null; note?: string; contactId: string | null };

export type TimelineItem = { at: string; kind: string; text: string; by?: string; origin: "employee" | "system" | "ghl" | "unknown"; visibility?: string; id?: string; corrects?: string | null };

/** status "unknown": the date passed and no outcome was recorded (Profixter does not record no-shows). Never an estimate. */
export type FreeVisit = { date: string | null; requestedAt: string; status: string; label: string; detail?: string; verified: boolean };

/** One self-referral signal (owner only). A flag for review, never a verdict. */
export type SelfReferralSignal = { code: string; strength: "same_person" | "payment" | "household" | string; text: string };
export type IntakeFlag = { code: string; text: string };
export type HomeAddress = { line1: string; unit: string; city: string; zip: string };
export type MembershipState = { plan: string; cycle: string; state: string; startDate: string; endsOn: string | null; endedOn: string | null };

export type LeadSale = { id: string; kind: string; label: string; plan: string | null; cycle: string | null; paidAt: string; paidPreTaxCents: number; status: string; claimable: boolean };

export type LeadDetail = {
  id: string;
  name: string;
  town: string;
  phoneLast4: string;
  stage: Stage;
  source: string;
  assignedAt: string | null;
  salesCredit: string;
  suppression: Suppression;
  ghl: GhlLinks;
  linked: boolean;
  journey: { registeredAt: string; phoneVerified: boolean; freeVisits: FreeVisit[]; membership: MembershipState | null; membershipHistory: MembershipState[] } | null;
  sales: LeadSale[];
  tasks: { id: string; dueAt: string; kind: string; note: string }[];
  timeline: TimelineItem[];
};

export type Calc = { regularCents: number; discountCents: number; discountSource: string; paidPreTaxCents: number; taxCents: number; explain: string; rule: { key: string; version: number } | null };

export type Entry = {
  id: string;
  kind: "commission" | "bonus" | "adjustment";
  product: string;
  amountCents: number;
  customer: string;
  paidAt: string | null;
  earnedAt: string;
  earnedWeek: string;
  statementWeek: string;
  late: boolean;
  status: "open" | "approved" | "paid";
  countsForBonus: boolean;
  calc: Calc;
  reason: string;
  bonus: { periodIndex: number; block: number; counted: number } | null;
};

export type SaleRow = {
  saleId: string;
  label: string;
  customer: string;
  paidAt: string;
  verified: boolean;
  attribution: string;
  commission: Entry | null;
  amounts: { regularCents: number; discountCents: number; discountSource: string; paidPreTaxCents: number; taxCents: number };
  refunds: { kind: string; amountCents: number; at: string; status: string | null }[];
};

export type StatementRow = { week: string; lastDay: string; payday: string; status: "this_week" | "awaiting_approval" | "approved" | "paid"; totalCents: number; entries: number; paidOn: string | null; method: string | null };
export type Statement = {
  week: string;
  lastDay: string;
  payday: string;
  frozen: boolean;
  approvedAt: string | null;
  payment: { status: string; paidOn: string; method: string; reference: string } | null;
  totals: { commissionCents: number; bonusCents: number; adjustmentCents: number; totalCents: number };
  items: Entry[];
};

export type Proposed = { amountCents: number; method: string; detail: string; countsForBonusDefault: boolean };
export type CreditRequest = {
  id: string;
  leadId: string | null;
  saleId: string;
  kind: string;
  explanation: string;
  status: "pending" | "needs_info" | "approved" | "rejected" | "withdrawn";
  proposed: Proposed;
  evidence: { id: string; kind: "ghl_reference" | "note" | "file"; text: string; fileName?: string; size?: number; addedAt: string }[];
  decisions: { action: string; by: string; reason: string; amountCents?: number | null; countsForBonus?: boolean | null; at: string }[];
  createdAt: string;
  employee?: { id: string; name: string };
};

export type IntakeRow = { id: string; name: string; town: string; phoneLast4: string; status: string; submittedAt: string; decision: { at: string; reason: string } | null };

/* ------------------------------------------------------------------ */
/* employee API                                                        */
/* ------------------------------------------------------------------ */

const S = "/api/sales";
const enc = encodeURIComponent;

export const salesKeys = {
  all: ["sales"] as const,
  me: ["sales", "me"] as const,
  leads: (stage: string, q: string) => ["sales", "leads", stage, q] as const,
  lead: (id: string) => ["sales", "lead", id] as const,
  intake: ["sales", "intake"] as const,
  sales: ["sales", "sales"] as const,
  bonus: ["sales", "bonus"] as const,
  statements: ["sales", "statements"] as const,
  statement: (week: string) => ["sales", "statement", week] as const,
  requests: ["sales", "requests"] as const,
};

export const fetchSalesMe = async (signal: AbortSignal): Promise<SalesMe> => (await API.get(`${S}/me`, { signal })).data;
export const fetchMyLeads = async (stage: string, q: string, signal: AbortSignal): Promise<LeadCard[]> =>
  (await API.get(`${S}/leads`, { signal, params: { ...(stage ? { stage } : {}), ...(q ? { q } : {}) } })).data?.leads || [];
export const fetchMyLead = async (id: string, signal: AbortSignal): Promise<LeadDetail> => (await API.get(`${S}/leads/${enc(id)}`, { signal })).data.lead;
export const revealPhone = async (id: string): Promise<string> => (await API.post(`${S}/leads/${enc(id)}/phone`, {})).data.phone;
export const logActivity = async (id: string, body: { kind: OutcomeKind; body?: string; channel?: string; followUpAt?: string; followUpKind?: string; followUpNote?: string }) =>
  (await API.post(`${S}/leads/${enc(id)}/activities`, body)).data;
export const addTask = async (id: string, body: { dueAt: string; kind: string; note?: string }) => (await API.post(`${S}/leads/${enc(id)}/tasks`, body)).data.task;
export const updateTask = async (taskId: string, body: { status?: "done" | "canceled" | "open"; dueAt?: string; note?: string }) => (await API.patch(`${S}/tasks/${enc(taskId)}`, body)).data.task;
export const setGhl = async (id: string, contact: string): Promise<{ ghlContactId: string | null; links: GhlLinks }> => (await API.put(`${S}/leads/${enc(id)}/ghl`, { contact })).data;
export const submitIntake = async (body: { name: string; phone: string; email?: string; town?: string; zip?: string; note?: string }) => (await API.post(`${S}/intake`, body)).data.lead;
export const fetchIntake = async (signal: AbortSignal): Promise<IntakeRow[]> => (await API.get(`${S}/intake`, { signal })).data?.intake || [];
export const fetchMySales = async (signal: AbortSignal): Promise<SaleRow[]> => (await API.get(`${S}/sales`, { signal })).data?.sales || [];
export const fetchMyBonus = async (signal: AbortSignal): Promise<Bonus> => (await API.get(`${S}/bonus`, { signal })).data.bonus;
export const fetchMyStatements = async (signal: AbortSignal): Promise<StatementRow[]> => (await API.get(`${S}/statements`, { signal })).data?.statements || [];
export const fetchMyStatement = async (week: string, signal: AbortSignal): Promise<Statement> => (await API.get(`${S}/statements/${enc(week)}`, { signal })).data.statement;
export const fetchMyRequests = async (signal: AbortSignal): Promise<CreditRequest[]> => (await API.get(`${S}/credit-requests`, { signal })).data?.requests || [];
export const createRequest = async (body: { leadId: string; saleId: string; kind: RequestKind; explanation: string; ghlReferences: string[]; note?: string }): Promise<CreditRequest> =>
  (await API.post(`${S}/credit-requests`, body)).data.request;
export async function uploadEvidence(requestId: string, file: File, text = ""): Promise<CreditRequest> {
  const form = new FormData();
  form.append("file", file);
  if (text) form.append("text", text);
  return (await API.post(`${S}/credit-requests/${enc(requestId)}/evidence`, form, { timeout: 60000 })).data.request;
}
export const replyRequest = async (requestId: string, text: string): Promise<CreditRequest> => (await API.post(`${S}/credit-requests/${enc(requestId)}/reply`, { text })).data.request;
export const withdrawRequest = async (requestId: string, reason = ""): Promise<CreditRequest> => (await API.post(`${S}/credit-requests/${enc(requestId)}/withdraw`, { reason })).data.request;

/** An authenticated download (CSV, evidence file): the token goes in the header, never the URL. */
export async function downloadAuthed(path: string, fallbackName: string): Promise<void> {
  const res = await API.get(path, { responseType: "blob", timeout: 60000 });
  const disposition = String(res.headers?.["content-disposition"] || "");
  const name = /filename="?([^";]+)"?/i.exec(disposition)?.[1] || fallbackName;
  const url = URL.createObjectURL(res.data as Blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = name;
  a.rel = "noopener";
  document.body.appendChild(a);
  a.click();
  a.remove();
  window.setTimeout(() => URL.revokeObjectURL(url), 30000);
}

export const EVIDENCE_TYPES = ["application/pdf", "image/png", "image/jpeg"];
export const EVIDENCE_MAX = 5 * 1024 * 1024;

/* ------------------------------------------------------------------ */
/* owner types                                                         */
/* ------------------------------------------------------------------ */

export type Metrics = {
  newLeads: number;
  assignedInPeriod: number;
  leadsContacted: number;
  leadsReached: number;
  registrations: number;
  freeVisitsBooked: number;
  freeVisitsCompleted: number;
  freeVisitsDue: number;
  firstPaidMemberships: number;
  annualSales: number;
  fullDaySales: number;
  refunds: { count: number; amountCents: number };
  netVerifiedSales: number;
  commissionEarnedCents: number;
  commissionPayableCents: number;
  commissionPaidCents: number;
  pendingClaims: number;
  followUpsOverdue: number;
  rates: { contactRate: number | null; reachRate: number | null; showRate: number | null; closeRate: number | null };
};

export type TeamRow = { employee: { id: string; name: string; active: boolean }; metrics: Metrics; bonus: Bonus; openLeads: number };
export type Queues = { unassigned: number; intake: number; reviews: number; requests: number; leadsWithInactiveEmployee: number };
export type TeamOverview = { from: string; to: string; rows: TeamRow[]; queues: Queues; definitions: Record<string, string> };

export type EmployeeDetail = {
  employee: { id: string; name: string; active: boolean; email: string; homeAddress?: HomeAddress };
  metrics: Metrics;
  from: string;
  to: string;
  definitions: Record<string, string>;
  bonus: Bonus;
  earnings: Earnings;
  statements: StatementRow[];
  sales: SaleRow[];
  leads: LeadCard[];
  goals: Goals;
  coaching: string;
};

export type OwnerLeadRow = {
  id: string;
  name: string;
  phone: string;
  town: string;
  status: string;
  stage: Stage;
  source: string;
  sourcedBy: string;
  linked: boolean;
  intakeFlags?: IntakeFlag[];
  assignee: { id: string; name: string; since: string } | null;
  creditHolder: { id: string; name: string } | null;
  doNotCall: boolean;
  doNotText: boolean;
  lastActivityAt: string | null;
  createdAt: string;
};

export type AccountSuggestion = { id: string; name: string; userId: string; phoneVerified: boolean; town: string; since: string };

export type OwnerSale = {
  id: string;
  kind: string;
  label: string;
  paidAt: string;
  identity: string;
  amounts: { regularCents: number; discountCents: number; paidPreTaxCents: number; taxCents: number; amountCents: number };
  discount: { source?: string; code?: string } | null;
  returningCustomer: boolean;
  credit: { status: string; employee: string | null; reason: string; ownerAssisted: boolean } | null;
};

export type OwnerLeadDetail = {
  id: string;
  name: string;
  phone: string;
  email: string | null;
  town: string;
  zip: string;
  status: string;
  stage: Stage;
  source: string;
  sourceNote: string;
  sourcedBy: string | null;
  intakeFlags?: IntakeFlag[];
  ghl: GhlLinks;
  link: { method: string | null; at: string | null; reason: string } | null;
  linkedAccount: { id: string; name: string; userId: string; since: string } | null;
  referral: { employee: string; code: string; at: string } | null;
  suggestions: AccountSuggestion[];
  suppression: Suppression;
  assignments: { employee: string; employeeId: string; creditEmployee: string; creditDecision: string; startedAt: string; startedBy: string; reason: string; endedAt: string | null; endReason: string | null }[];
  journey: { registeredAt: string; phoneVerifiedAt: string | null; freeVisits: (FreeVisit & { id: string })[]; otherVisits: number; memberships: MembershipState[]; purchases: { id: string; kind: string; label: string; paidAt: string; amountCents: number }[] } | null;
  sales: OwnerSale[];
  tasks: { id: string; dueAt: string; kind: string; note: string; assignee: string }[];
  timeline: TimelineItem[];
};

export type Review = {
  id: string;
  kind: "credit_hold" | "refund" | "dispute";
  summary: string;
  effects: {
    holdReasons?: string[];
    claimants?: { employee: string; basis: string; name: string }[];
    found?: boolean;
    sale?: { id: string; kind: string; plan: string; cycle: string; paidAt: string; paidPreTaxCents: number };
    commissions?: { id: string; employee: string; amountCents: number; status: string; statementWeek: string }[];
    bonuses?: { id: string; employee: string; amountCents: number; status: string; periodIndex: number }[];
    note?: string;
    selfReferral?: { employee: string; employeeName: string; signals: SelfReferralSignal[] }[];
  };
  status: string;
  resolution?: unknown;
  createdAt: string;
};

export type Reviews = { reviews: Review[]; requests: (CreditRequest & { employee: { id: string; name: string } })[] };

export type CreditRequestDetail = {
  request: CreditRequest & { employee: { id: string; name: string }; selfReferral?: SelfReferralSignal[] };
  customer: { id: string; name: string; userId: string; since: string } | null;
  sale: { id: string; kind: string; label: string; plan: string; cycle: string; paidAt: string; identity: string; amounts: OwnerSale["amounts"]; discount: OwnerSale["discount"]; returningCustomer: boolean; stripe: { invoiceId: string; billingReason: string } } | null;
  currentCredit: { status: string; reason: string } | null;
  membershipHistory: { plan: string; cycle: string; status: string; startDate: string; endedOn: string | null; complimentary: boolean }[];
  previousCommissions: { id: string; employee: string; kind: string; product: string; amountCents: number; paidAt: string; status: string; explain: string }[];
  previousSales: { id: string; kind: string; label: string; paidAt: string; amountCents: number }[];
  bonusEffect: string;
};

export type OwnerEntry = Entry & { employee: { id: string; name: string } | string; createdByName?: string };

export type PayoutWeekRow = { week: string; lastDay: string; payday: string; status: "accruing" | "ready" | "approved"; totalCents: number; employees: number; unpaid: number | null };
export type PayoutLine = {
  employee: string;
  employeeName: string;
  commissionCents: number;
  bonusCents: number;
  adjustmentCents: number;
  totalCents: number;
  entries: string[];
  payment?: { status: "unpaid" | "paid"; paidOn?: string; method?: string; reference?: string; recordedByName?: string; recordedAt?: string } | null;
};
export type PayoutWeek = {
  week: string;
  startsAt: string;
  endsAt: string;
  lastDay: string;
  payday: string;
  status: "accruing" | "ready" | "approved";
  approvedAt?: string;
  approvedByName?: string;
  lines: PayoutLine[];
  entries: (Entry & { employee: string })[];
};

export type GhlStatus = {
  enabled: boolean;
  signatureKeyConfigured: boolean;
  locationConfigured: boolean;
  liveVerified: boolean;
  liveNote: string;
  counts: Record<string, number>;
  lastReceivedAt: string | null;
  failures: { _id: string; eventId: string; type: string; contactId: string; attempts: number; lastError: string; nextAttemptAt: string | null; receivedAt: string }[];
  unmapped: { contactId: string; events: number; lastAt: string }[];
};

export type CustomerHit = { id: string; name: string; userId: string; phoneLast4: string; phoneVerified: boolean; town: string; since: string };

/* ------------------------------------------------------------------ */
/* owner API                                                           */
/* ------------------------------------------------------------------ */

const D = "/api/admin/sales-desk";

export const deskKeys = {
  all: ["desk"] as const,
  overview: (from: string, to: string) => ["desk", "overview", from, to] as const,
  employees: ["desk", "employees"] as const,
  employee: (id: string, from: string, to: string) => ["desk", "employee", id, from, to] as const,
  leads: (view: string, q: string, employee: string) => ["desk", "leads", view, q, employee] as const,
  lead: (id: string) => ["desk", "lead", id] as const,
  reviews: (status: string) => ["desk", "reviews", status] as const,
  request: (id: string) => ["desk", "request", id] as const,
  commissions: (employee: string, week: string) => ["desk", "commissions", employee, week] as const,
  payouts: ["desk", "payouts"] as const,
  payoutsCheck: ["desk", "payouts", "check"] as const,
  payout: (week: string) => ["desk", "payout", week] as const,
  ghl: ["desk", "ghl"] as const,
};

const range = (from: string, to: string) => (from && to ? { from, to } : {});
export const fetchOverview = async (from: string, to: string, signal: AbortSignal): Promise<TeamOverview> => (await API.get(`${D}/overview`, { signal, params: range(from, to) })).data;
export const fetchTelemarketers = async (signal: AbortSignal): Promise<{ id: string; name: string; active: boolean }[]> => (await API.get(`${D}/employees`, { signal })).data?.employees || [];
export const fetchEmployee = async (id: string, from: string, to: string, signal: AbortSignal): Promise<EmployeeDetail> => (await API.get(`${D}/employees/${enc(id)}`, { signal, params: range(from, to) })).data;
export const saveGoals = async (id: string, body: Goals) => (await API.put(`${D}/employees/${enc(id)}/goals`, body)).data.goals;
export const saveHomeAddress = async (id: string, body: HomeAddress): Promise<HomeAddress> => (await API.put(`${D}/employees/${enc(id)}/home-address`, body)).data.homeAddress;
export const fetchDeskLeads = async (view: string, q: string, employee: string, signal: AbortSignal): Promise<OwnerLeadRow[]> =>
  (await API.get(`${D}/leads`, { signal, params: { view, ...(q ? { q } : {}), ...(employee ? { employee } : {}) } })).data?.leads || [];
export const createDeskLead = async (body: { name: string; phone?: string; email?: string; town?: string; zip?: string; note?: string; userId?: string; assignTo?: string; reason?: string }) =>
  (await API.post(`${D}/leads`, body)).data.lead;
export const fetchDeskLead = async (id: string, signal: AbortSignal): Promise<OwnerLeadDetail> => (await API.get(`${D}/leads/${enc(id)}`, { signal })).data.lead;
export const assignDeskLead = async (id: string, body: { employeeId: string; reason: string; creditDecision?: "keep_previous" | "new_assignee" }) => (await API.post(`${D}/leads/${enc(id)}/assign`, body)).data;
export const bulkAssign = async (body: { leadIds: string[]; employeeId: string; reason: string }): Promise<{ assigned: string[]; skipped: { id: string; reason: string }[] }> =>
  (await API.post(`${D}/leads/bulk-assign`, body)).data;
export const unassignDeskLead = async (id: string, reason: string) => (await API.post(`${D}/leads/${enc(id)}/unassign`, { reason })).data;
export const linkDeskLead = async (id: string, userId: string, reason: string) => (await API.post(`${D}/leads/${enc(id)}/link`, { userId, reason })).data;
export const addDeskNote = async (id: string, kind: "note" | "coaching", body: string) => (await API.post(`${D}/leads/${enc(id)}/notes`, { kind, body })).data;
export const addDeskTask = async (id: string, body: { dueAt: string; kind: string; note?: string; assignee?: string }) => (await API.post(`${D}/leads/${enc(id)}/tasks`, body)).data;
export const setDeskGhl = async (id: string, contact: string) => (await API.put(`${D}/leads/${enc(id)}/ghl`, { contact })).data;
export const archiveDeskLead = async (id: string, reason: string) => (await API.post(`${D}/leads/${enc(id)}/archive`, { reason })).data;
export const decideIntake = async (id: string, body: { approve: boolean; reason: string; assignTo?: string | null }) => (await API.post(`${D}/intake/${enc(id)}/decide`, body)).data;
export const searchCustomers = async (q: string, signal: AbortSignal): Promise<CustomerHit[]> => (await API.get(`${D}/customers/search`, { signal, params: { q } })).data?.customers || [];
export const liftSuppression = async (body: { phone: string; channel: "call" | "sms" | "all"; reason: string }) => (await API.post(`${D}/suppressions/lift`, body)).data;
export const fetchReviews = async (status: string, signal: AbortSignal): Promise<Reviews> => (await API.get(`${D}/reviews`, { signal, params: status === "resolved" ? { status } : {} })).data;
export const resolveReview = async (id: string, body: Record<string, unknown>) => (await API.post(`${D}/reviews/${enc(id)}/resolve`, body)).data;
export const fetchRequestDetail = async (id: string, signal: AbortSignal): Promise<CreditRequestDetail> => (await API.get(`${D}/credit-requests/${enc(id)}`, { signal })).data;
export const decideRequest = async (id: string, body: { action: "approved" | "rejected" | "needs_info"; reason: string; amountCents?: number; countsForBonus?: boolean; selfReferralCleared?: boolean }) =>
  (await API.post(`${D}/credit-requests/${enc(id)}/decide`, body)).data;
export const fetchCommissions = async (employee: string, week: string, signal: AbortSignal): Promise<OwnerEntry[]> =>
  (await API.get(`${D}/commissions`, { signal, params: { ...(employee ? { employee } : {}), ...(week ? { week } : {}) } })).data?.entries || [];
export const addAdjustment = async (body: { employeeId: string; amountCents: number; reason: string; idempotencyKey: string }) => (await API.post(`${D}/adjustments`, body)).data.entry;
/**
 * The ledger self-check (nothing omitted, nothing paid twice). `ok` is the live
 * check; `paused` is a stored failure (nightly job or a refused write) that only
 * a passing full check lifts. While `blocked`, the SERVER refuses approving,
 * recording payments and the payroll export; the screen only mirrors that.
 */
export type LedgerIntegrity = {
  ok: boolean;
  paused: boolean;
  blocked: boolean;
  problems: string[];
  approvedWeeks: number;
  checkedAt: string | null;
  failedSince: string | null;
  source: string | null;
};
export const recheckLedger = async (): Promise<LedgerIntegrity> => (await API.post(`${D}/payouts/check`, {})).data.integrity;
export const fetchPayouts = async (signal: AbortSignal): Promise<PayoutWeekRow[]> => (await API.get(`${D}/payouts`, { signal })).data?.payouts || [];
export const fetchPayoutsWithCheck = async (signal: AbortSignal): Promise<{ payouts: PayoutWeekRow[]; integrity: LedgerIntegrity | null }> => {
  const data = (await API.get(`${D}/payouts`, { signal })).data || {};
  return { payouts: data.payouts || [], integrity: data.integrity || null };
};
export const fetchPayout = async (week: string, signal: AbortSignal): Promise<PayoutWeek> => (await API.get(`${D}/payouts/${enc(week)}`, { signal })).data.payout;
export const approvePayout = async (week: string) => (await API.post(`${D}/payouts/${enc(week)}/approve`, {})).data.payout;
export const recordPayout = async (week: string, employeeId: string, body: { paidOn: string; method: string; reference: string }) =>
  (await API.post(`${D}/payouts/${enc(week)}/lines/${enc(employeeId)}/paid`, body)).data.payout;
export const fetchGhl = async (signal: AbortSignal): Promise<GhlStatus> => (await API.get(`${D}/ghl`, { signal })).data.ghl;
export const retryGhl = async (id: string) => (await API.post(`${D}/ghl/events/${enc(id)}/retry`, {})).data.event;
export const deskPaths = {
  payoutCsv: (week: string) => `${D}/payouts/${enc(week)}/csv`,
  requestFile: (id: string, fileId: string) => `${D}/credit-requests/${enc(id)}/files/${enc(fileId)}`,
  statementCsv: (week: string) => `${S}/statements/${enc(week)}/csv`,
};

export const KPI_COLUMNS: { key: keyof Metrics; label: string; def: string; money?: boolean }[] = [
  { key: "newLeads", label: "New leads", def: "newLeads" },
  { key: "leadsContacted", label: "Contacted", def: "leadsContacted" },
  { key: "leadsReached", label: "Reached", def: "leadsReached" },
  { key: "registrations", label: "Registered", def: "registrations" },
  { key: "freeVisitsBooked", label: "Free visits booked", def: "freeVisitsBooked" },
  { key: "freeVisitsCompleted", label: "Free visits done", def: "freeVisitsCompleted" },
  { key: "firstPaidMemberships", label: "Memberships", def: "firstPaidMemberships" },
  { key: "annualSales", label: "Annual", def: "annualSales" },
  { key: "fullDaySales", label: "Full Days", def: "fullDaySales" },
  { key: "netVerifiedSales", label: "Net verified", def: "netVerifiedSales" },
  { key: "commissionEarnedCents", label: "Earned", def: "commissionEarned", money: true },
  { key: "pendingClaims", label: "Pending claims", def: "pendingClaims" },
  { key: "followUpsOverdue", label: "Overdue", def: "followUpsOverdue" },
];

/** The Team table's columns: the ones that fit a desktop row. Every KPI is in the employee detail. */
export const TEAM_TABLE_KEYS: (keyof Metrics)[] = ["newLeads", "leadsContacted", "leadsReached", "freeVisitsBooked", "firstPaidMemberships", "fullDaySales", "commissionEarnedCents", "pendingClaims", "followUpsOverdue"];

export const pct = (v: number | null | undefined) => (v === null || v === undefined ? "—" : `${Math.round(v * 100)}%`);
