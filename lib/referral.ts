/**
 * The customer referral program, in the browser (BackEnd utils/referrals).
 *
 * A friend opens a personal link, profixter.com/r/<code>. The site redirects it
 * to /?source=referral&ref=<code> (next.config.ts), so the welcome flow and
 * first-touch attribution see an ordinary referral landing, and this module
 * keeps the code (pf_referral) apart from attribution: attribution is first
 * touch for life, while a referral link opened by somebody who browsed here
 * before must still count.
 *
 * The code then rides along with every call that can create an account
 * (lib/auth2 conversionFields) and with the membership checkout
 * (referralField), and a signed-in browser claims it once
 * (ReferralClaim). The server records the FIRST referral for an account and
 * decides everything else; this module only carries the code.
 *
 * The 2025 links (/?ref=<8-digit account number>) are still read.
 */
import API from "@/lib/api";

const KEY = "pf_referral";
const MAX_AGE_MS = 90 * 24 * 60 * 60 * 1000;
const CODE_RE = /^[a-z]{1,12}-[a-z0-9]{4}$/;
const LEGACY_RE = /^\d{8}$/;

export type StoredReferral = { code: string; capturedAt: string };

function normalize(raw: string | null): string {
  const s = String(raw || "").trim();
  if (LEGACY_RE.test(s)) return s;
  const lower = s.toLowerCase();
  return CODE_RE.test(lower) ? lower : "";
}

/** On every landing: keep a referral code from the URL (the latest link opened wins in this browser). */
export function captureReferral(): void {
  try {
    if (typeof window === "undefined") return;
    const params = new URLSearchParams(window.location.search);
    const ref = params.get("ref");
    if (!ref) return;
    const source = (params.get("source") || "").toLowerCase();
    const code = normalize(ref);
    // A customer code, or an old 8-digit link. Telemarketer codes (upper case, no hyphen) are the sales desk's.
    if (!code || (source && source !== "referral")) return;
    const existing = getReferral();
    if (existing?.code === code) return;
    window.localStorage.setItem(KEY, JSON.stringify({ code, capturedAt: new Date().toISOString() }));
  } catch {
    /* storage blocked: the referral is not carried, nothing else changes */
  }
}

export function getReferral(): StoredReferral | null {
  try {
    if (typeof window === "undefined") return null;
    const raw = JSON.parse(window.localStorage.getItem(KEY) || "null") as StoredReferral | null;
    if (!raw?.code || !normalize(raw.code)) return null;
    if (Date.now() - Date.parse(raw.capturedAt) > MAX_AGE_MS) {
      window.localStorage.removeItem(KEY);
      return null;
    }
    return raw;
  } catch {
    return null;
  }
}

export function clearReferral(): void {
  try {
    window.localStorage.removeItem(KEY);
  } catch {
    /* nothing to clear */
  }
}

/** Spread into a request body: `{ ...referralField() }`. */
export function referralField(): { referral?: StoredReferral } {
  const r = getReferral();
  return r ? { referral: r } : {};
}

/* ------------------------------------------------------------------ API */

export type ReferralStatus = "attributed" | "pending" | "eligible" | "approved" | "mailed" | "void" | "not_eligible";

export type ReferralReward = {
  id: string;
  friend: string;
  status: ReferralStatus;
  statusLabel: string;
  amountCents: number;
  plan: string | null;
  joinedAt: string;
  firstPaidAt: string | null;
  secondPaidAt: string | null;
  mailedAt: string | null;
  note: string;
  payee: { confirmed: true; name: string; address: string } | { confirmed: false };
  needsPayee: boolean;
  canEditPayee: boolean;
};

export type MyReferrals = {
  eligible: boolean;
  code: string | null;
  url: string | null;
  rewards: ReferralReward[];
  totals?: { pendingCents: number; readyCents: number; mailedCents: number };
};

export async function getMyReferrals(): Promise<MyReferrals> {
  return (await API.get<MyReferrals>("/api/referrals/me")).data;
}

export async function claimReferral(r: StoredReferral): Promise<{ recorded: boolean; reason: string }> {
  return (await API.post("/api/referrals/claim", { referral: r })).data;
}

export type PayeeInput = { name: string; line1: string; line2?: string; city: string; state: string; zip: string };

export async function savePayee(id: string, payee: PayeeInput, reauthToken?: string): Promise<{ reward: ReferralReward }> {
  return (await API.post(`/api/referrals/rewards/${encodeURIComponent(id)}/payee`, { ...payee, ...(reauthToken ? { reauthToken } : {}) })).data;
}

export const money = (cents: number) => `$${(Math.round(cents) / 100).toFixed(2)}`;

/* ------------------------------------------------------------------ the site-wide popup's memory */

/** Shown or dismissed in this browser: not again for 30 days (owner 2026-11-20). */
const POPUP_KEY = "pf_referral_popup_at";
export const POPUP_QUIET_MS = 30 * 24 * 60 * 60 * 1000;

/** May the popup open by itself now? False when storage is blocked (it would open on every page otherwise). */
export function popupDue(now = Date.now()): boolean {
  try {
    // Automated browsers (navigator.webdriver) never get it by surprise, like the welcome entry (lib/welcome-entry):
    // the site's own browser suites keep testing their pages; a test of this popup opts in.
    if (navigator.webdriver && window.localStorage.getItem("pf_referral_popup_test") !== "1") return false;
    const at = Number(window.localStorage.getItem(POPUP_KEY) || 0);
    return !(at > 0 && now - at < POPUP_QUIET_MS);
  } catch {
    return false;
  }
}

export function rememberPopup(now = Date.now()): void {
  try {
    window.localStorage.setItem(POPUP_KEY, String(now));
  } catch {
    /* not remembered */
  }
}

/** Where a signed-out visitor's "Get my referral link" goes: sign in (or create an account), then the referral card. */
export const REFERRAL_CARD_PATH = "/account?referrals=1";
export const SIGNED_OUT_REFERRAL_HREF = `/signin?next=${encodeURIComponent(REFERRAL_CARD_PATH)}`;

/** The message the share sheet and Copy link carry. */
export function shareMessage(url: string): string {
  return `I use Profixter for handyman help at home. Here's my link if you want to try a membership: ${url}`;
}
