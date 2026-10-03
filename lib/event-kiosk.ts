/**
 * Shared state between the public event kiosk (/event) and the pages a
 * visitor goes through after tapping its call to action.
 *
 * KIOSK_RETURN_KEY marks this browser tab as having come from the kiosk. While
 * it is set, a small "Back to event" control is offered (KioskReturn), which
 * signs the visitor out with the site's normal logout and returns to /event.
 * It lives in sessionStorage: one tab, gone when the tab is closed, and never
 * sent to a server.
 */

export const KIOSK_RETURN_KEY = "profixterEventKiosk";
export const KIOSK_PATH = "/event";

/**
 * Leftovers from whoever used this tab before: a plan picked but not paid for,
 * a promo code, a just-logged-in marker. Normal logout leaves these alone
 * because on a personal device they are the same person's; on a shared kiosk
 * they are not, so the next visitor starts clean.
 */
const CARRY_OVER_KEYS = ["pendingCheckoutPlan", "pendingPromoCode", "justLoggedIn"];

export function clearKioskCarryOver() {
  try {
    for (const key of CARRY_OVER_KEYS) window.sessionStorage.removeItem(key);
  } catch {}
}

export function isKioskSession() {
  try {
    return window.sessionStorage.getItem(KIOSK_RETURN_KEY) === "1";
  } catch {
    return false;
  }
}
