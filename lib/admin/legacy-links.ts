/**
 * Old admin links (/admin?tab=...) to the new routes.
 *
 * Emails already sent, Stripe return URLs and bookmarks use the old format,
 * so every one of them keeps working (audit K.2). The query (`q`) is never
 * put back into a URL: it is handed to the destination's search field
 * through sessionStorage (lib/admin/handoff.ts), so a customer's email does
 * not end up in browser history or in a referrer.
 *
 * Pure function, no browser APIs: app/admin/page.tsx applies the result and
 * scripts/test_admin_shell_ui.js checks every mapping in a real browser.
 */
import type { SectionId } from "./sections";

export type LegacyTarget = {
  /** The new route; null means "this person's landing section". */
  path: string | null;
  /** The section the path belongs to (for the permission check). */
  section: SectionId | null;
  /** Search text for the destination's search field, handed over out of the URL. */
  query?: string;
  /** A one-off message to show on arrival (Stripe returns). */
  toast?: string;
  /** An invoice to resolve to its project before redirecting. */
  invoiceId?: string;
};

const ID = /^[A-Za-z0-9_-]{1,64}$/;
const cleanId = (value: string | null) => {
  const v = String(value || "").trim();
  return ID.test(v) ? v : "";
};
const enc = encodeURIComponent;

/** Messages for the Stripe returns, worded as before (true at this moment, never "activated"). */
export const RETURN_TOASTS: Record<string, string> = {
  "gift:paid": "Payment received. The gift invitation goes to the customer as soon as Stripe confirms it.",
  "gift:canceled": "Gift checkout canceled. Nothing was charged.",
  "paid:membership": "Payment received. The membership turns on as soon as Stripe confirms it.",
  "paid:visit": "Payment received. The visit is confirmed as soon as Stripe confirms it.",
};

export function returnToast(params: URLSearchParams): string | undefined {
  const gift = params.get("gift");
  if (gift === "paid" || gift === "canceled") return RETURN_TOASTS[`gift:${gift}`];
  const paid = params.get("paid");
  if (paid === "membership" || paid === "visit") return RETURN_TOASTS[`paid:${paid}`];
  return undefined;
}

export function resolveLegacyAdminLink(params: URLSearchParams): LegacyTarget {
  const tab = String(params.get("tab") || "").trim().toLowerCase();
  const q = String(params.get("q") || "").trim() || undefined;
  const bookingId = cleanId(params.get("bookingId"));
  const userId = cleanId(params.get("userId"));
  const invoiceId = cleanId(params.get("invoiceId"));
  const projectId = cleanId(params.get("projectId"));
  const leadId = cleanId(params.get("leadId"));
  const toast = returnToast(params);

  const out = (path: string | null, section: SectionId | null, extra: Partial<LegacyTarget> = {}): LegacyTarget => {
    const target: LegacyTarget = { path, section, ...extra };
    if (toast) target.toast = toast;
    return target;
  };

  switch (tab) {
    case "bookings":
    case "jobs":
      return bookingId ? out(`/admin/jobs/${enc(bookingId)}`, "jobs") : out("/admin/jobs", "jobs", { query: q });
    case "users":
    case "customers":
      return userId ? out(`/admin/customers/${enc(userId)}`, "customers") : out("/admin/customers", "customers", { query: q });
    case "subscribed":
    case "members":
      return userId
        ? out(`/admin/customers/${enc(userId)}?filter=members`, "customers")
        : out("/admin/customers?filter=members", "customers", { query: q });
    case "blacklist":
    case "blocked":
      return out("/admin/customers?filter=blocked", "customers", { query: q });
    case "requests":
    case "leads":
      return leadId ? out(`/admin/leads/${enc(leadId)}`, "leads") : out("/admin/leads", "leads", { query: q });
    case "projects":
      return projectId ? out(`/admin/projects/${enc(projectId)}`, "projects") : out("/admin/projects", "projects", { query: q });
    case "invoices":
      return invoiceId
        ? out("/admin/projects", "projects", { invoiceId })
        : projectId
          ? out(`/admin/projects/${enc(projectId)}`, "projects")
          : out("/admin/projects", "projects");
    case "emails":
    case "communications":
      return out("/admin/communications", "communications");
    case "fixters":
    case "employees":
    case "team":
      return out("/admin/team", "team");
    case "calendar":
    case "schedule":
      return out("/admin/schedule/availability", "schedule");
    case "overview":
      return out("/admin/overview", "overview");
    case "growth":
    case "assistant":
      return out("/admin/assistant", "assistant");
    case "tips":
      return out("/admin/tips", "tips");
    case "recent-work":
      return out("/admin/recent-work", "recent-work", { query: q });
    case "work-photos":
      return out("/admin/work-photos", "work-photos");
    case "promotion":
      return out("/admin/promotion", "promotion");
    case "activity":
      return out("/admin/activity", "activity");
    default:
      break;
  }

  // No (or an unknown) tab: an id alone still says where to go.
  if (bookingId) return out(`/admin/jobs/${enc(bookingId)}`, "jobs");
  if (userId) return out(`/admin/customers/${enc(userId)}`, "customers");
  if (invoiceId) return out("/admin/projects", "projects", { invoiceId });
  if (projectId) return out(`/admin/projects/${enc(projectId)}`, "projects");
  return out(null, null, q ? { query: q } : {});
}

/** True when the URL carries anything the redirect handler must act on. */
export function isLegacyAdminLink(params: URLSearchParams): boolean {
  return ["tab", "q", "bookingId", "userId", "invoiceId", "projectId", "leadId", "gift", "paid", "session_id"].some((k) => params.has(k));
}
