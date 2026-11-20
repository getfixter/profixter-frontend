/*
 * The gift claim's sign-in detour without the token in any URL (2026-11-19).
 *
 * /gift/claim/<token> is tracker-free, but its "Sign in" and "Create account"
 * links used to carry ?next=/gift/claim/<token>, and the sign-in pages do load
 * GTM, the Meta Pixel and Clarity - which record the full URL. Now the token
 * waits in this browser and the links say /gift/claim/resume. Six hours, the
 * same browser only; opening the email link again always works.
 */
const KEY = "pf_gift_claim";
const TTL_MS = 6 * 60 * 60 * 1000;
export const GIFT_CLAIM_RESUME = "resume";
export const GIFT_CLAIM_RETURN_PATH = `/gift/claim/${GIFT_CLAIM_RESUME}`;

export function rememberGiftClaimToken(token: string): void {
  try {
    if (!token || token === GIFT_CLAIM_RESUME) return;
    window.localStorage.setItem(KEY, JSON.stringify({ token, at: Date.now() }));
  } catch {
    /* storage blocked: the email link still works */
  }
}

export function recallGiftClaimToken(): string {
  try {
    const raw = JSON.parse(window.localStorage.getItem(KEY) || "null");
    if (!raw?.token || typeof raw.at !== "number" || Date.now() - raw.at > TTL_MS) return "";
    return String(raw.token);
  } catch {
    return "";
  }
}

export function forgetGiftClaimToken(): void {
  try {
    window.localStorage.removeItem(KEY);
  } catch {
    /* nothing to forget */
  }
}
