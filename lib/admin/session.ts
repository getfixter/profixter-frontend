/**
 * Signing out of the admin, for real (owner decision Q-5).
 *
 * The server revokes the session (POST /api/auth/logout) or every session of
 * the account (POST /api/auth/logout-all, which bumps tokenVersion). An older
 * backend without those routes answers 404: the browser still forgets
 * everything, and the message says the other devices could not be signed out.
 *
 * What the browser forgets: the token and user, the remembered email, every
 * admin key (pfa:*, except device preferences pfa:pref:*), the whole
 * sessionStorage of this tab (checkout and promo hand-offs included) and the
 * in-memory query cache.
 */
import { clearQueryCache } from "./query";

const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:5001";

export type SignOutResult = {
  /** The server confirmed the session (or all sessions) ended. */
  serverConfirmed: boolean;
  /** The server does not have the endpoint yet (older backend). */
  unsupported: boolean;
};

/** Ask the server to end the session. Never throws; never redirects on 401. */
export async function revokeOnServer(scope: "current" | "all", token?: string | null): Promise<SignOutResult> {
  const bearer = token ?? readToken();
  if (!bearer) return { serverConfirmed: false, unsupported: false };
  try {
    const response = await fetch(`${API_URL}/api/auth/${scope === "all" ? "logout-all" : "logout"}`, {
      method: "POST",
      headers: { Authorization: `Bearer ${bearer}`, "Content-Type": "application/json" },
      body: "{}",
      keepalive: true,
      credentials: "omit",
    });
    // 401: the token was already invalid, which is the outcome we wanted.
    if (response.ok || response.status === 401) return { serverConfirmed: true, unsupported: false };
    return { serverConfirmed: false, unsupported: response.status === 404 || response.status === 405 };
  } catch {
    return { serverConfirmed: false, unsupported: false };
  }
}

function readToken(): string | null {
  try {
    return window.localStorage.getItem("token");
  } catch {
    return null;
  }
}

/** Every trace of the signed-in person this browser holds. */
export function clearBrowserSession(): void {
  try {
    const local = window.localStorage;
    ["token", "user", "rememberedEmail"].forEach((key) => local.removeItem(key));
    for (let i = local.length - 1; i >= 0; i -= 1) {
      const key = local.key(i);
      if (key && key.startsWith("pfa:") && !key.startsWith("pfa:pref:")) local.removeItem(key);
    }
  } catch {
    /* storage blocked */
  }
  try {
    window.sessionStorage.clear();
  } catch {
    /* storage blocked */
  }
  clearQueryCache();
}
