/**
 * Admin > Referrals (owner only): BackEnd routes/adminReferrals.js.
 * Approve and Mailed re-read Stripe on the server and answer 409 with what
 * changed; the screens show that rather than retrying.
 */
import API from "@/lib/api";

export type RewardStatus = "attributed" | "pending" | "eligible" | "approved" | "mailed" | "void" | "not_eligible";
export type RewardFilter = "ready" | "pending" | "approved" | "mailed" | "closed" | "all";

type Person = { id: string; name: string; email: string; phone: string; userId: string } | null;

export type RewardRow = {
  id: string;
  status: RewardStatus;
  statusLabel: string;
  referrer: Person;
  referred: Person;
  amountCents: number;
  plan: string | null;
  cycle: string | null;
  firstPaidAt: string | null;
  secondPaidAt: string | null;
  flagCount: number;
  flagsCleared: boolean;
  attention: string;
  payeeConfirmed: boolean;
  createdAt: string;
  updatedAt: string;
};

export type RewardInvoice = {
  invoiceId: string;
  subscriptionId: string;
  chargeId: string | null;
  billingReason: string;
  paidAt: string;
  plan: string;
  cycle: string;
  baseCents: number;
  discountCents: number;
  taxCents: number;
  amountPaidCents: number;
  paidPreTaxCents: number;
  refundedCents: number;
  refundedPreTaxCents: number;
  disputed: boolean;
  discountSource: string;
  promoCode: string;
  stripeUrl: string;
};

export type RewardFlag = { code: string; strength: "same_person" | "household" | "payment" | "review" | "info"; text: string; at: string; reviewed: boolean };

export type RewardDetail = RewardRow & {
  code: string;
  via: string;
  reason: string;
  capCents: number;
  first: RewardInvoice | null;
  second: RewardInvoice | null;
  flags: RewardFlag[];
  flagsReview: { at: string; note: string; codes: string[] } | null;
  payee: { name: string; line1: string; line2: string; city: string; state: string; zip: string; confirmedAt: string; confirmedBy: "customer" | "owner"; note: string } | null;
  approval: { at: string; amountCents: number } | null;
  check: { reference: string; mailedAt: string; note: string } | null;
  lastRecheck: { at: string; ok: boolean; changes: string[] } | null;
  /** Which rule decides: monthly - the second paid invoice; annual - 60 days of active membership. */
  rule: "monthly" | "annual";
  qualifiesAt: string | null;
  membership: { status: string | null; endedAt: string | null; checkedAt: string } | null;
  history: { at: string; event: string; by: string; detail: string }[];
  canApprove: boolean;
};

export type RewardList = { status: RewardFilter; counts: { ready: number; pending: number; approved: number; attention: number }; rewards: RewardRow[] };

const base = "/api/admin/referral-rewards";

export const fetchRewards = async (status: RewardFilter, signal?: AbortSignal) => (await API.get<RewardList>(base, { params: { status }, signal })).data;
export const fetchReward = async (id: string, signal?: AbortSignal) => (await API.get<{ reward: RewardDetail }>(`${base}/${encodeURIComponent(id)}`, { signal })).data.reward;

type Act<T = object> = (id: string, body?: T) => Promise<{ reward: RewardDetail; ok?: boolean; changes?: string[] }>;
const post = <T,>(path: string): Act<T> => async (id, body) => (await API.post(`${base}/${encodeURIComponent(id)}/${path}`, body || {})).data;

export const recheckReward = post("recheck");
export const clearRewardFlags = post<{ note: string }>("flags/clear");
export const confirmRewardPayee = post<{ name: string; line1: string; line2?: string; city: string; state: string; zip: string; note: string }>("payee");
export const approveReward = post<{ expectedAmountCents: number; payeeConfirmed: boolean }>("approve");
export const markRewardMailed = post<{ reference: string; mailedAt?: string; note?: string }>("mailed");
export const voidReward = post<{ reason: string }>("void");
export const acknowledgeReward = post<{ note?: string }>("acknowledge");

/** A 409 from Approve/Mailed: the server's message, what Stripe showed, and the record as it is now. */
export function readRewardError(err: unknown): { code: string; message: string; changes: string[]; reward: RewardDetail | null } {
  const e = err as { response?: { data?: { code?: string; message?: string; changes?: string[]; reward?: RewardDetail } } };
  const d = e?.response?.data || {};
  return { code: d.code || "", message: d.message || "Something went wrong. Nothing was changed.", changes: d.changes || [], reward: d.reward || null };
}

export const cents = (c: number | null | undefined) => `$${((Number(c) || 0) / 100).toFixed(2)}`;
