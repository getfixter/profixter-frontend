"use client";

/**
 * Meta tracking — one pixel, one event id, one place.
 *
 * WHY THIS FILE EXISTS.
 *
 * Tracking was spread across four places that did not agree with each other:
 * the pixel id came from an env var, GTM fired its own Subscribe off a URL
 * match, the Stripe webhook sent a server event called "Purchase" for a
 * membership, and two server relay endpoints existed that nothing ever called.
 * The result was events that double-counted, were named wrong, or never
 * arrived. Everything Meta-related now goes through this module.
 *
 * THE PIXEL ID IS HARDCODED, DELIBERATELY.
 *
 * It used to read NEXT_PUBLIC_FB_PIXEL_ID, which is how the wrong pixel ended
 * up live: the value was set once in a dashboard nobody reads and drifted. A
 * pixel id is a public identifier - it ships in the page source either way -
 * so there is nothing gained by hiding it in config and quite a lot lost. One
 * constant here means the id cannot differ between environments, cannot be
 * changed without a code review, and cannot be silently wrong.
 *
 * DEDUPLICATION IS THE WHOLE POINT.
 *
 * Every conversion is sent twice on purpose: once from the browser, where it
 * may be blocked, and once from our server, where it cannot be. Meta collapses
 * the pair into one conversion ONLY if both carry the same event_id. So an id
 * is minted once per real-world action and then travels - to fbq as `eventID`,
 * and to our own server, which forwards it to the Conversions API.
 *
 * NOTHING HERE MAY THROW.
 *
 * A tracking failure must never cost a signup or a payment. Every export is
 * wrapped, every network call is fire-and-forget, and every one of them is
 * safe to call during SSR, where `window` does not exist.
 */

/*
 * Re-exported so callers have one import, but DECLARED in lib/meta-config.ts,
 * which carries no "use client". The root layout is a Server Component and
 * needs the literal to interpolate into the pixel snippet; a constant imported
 * from a client module reaches it as a client reference and renders as nothing.
 */
export { META_PIXEL_ID } from "./meta-config";
import { META_PIXEL_ID } from "./meta-config";

const API_BASE = process.env.NEXT_PUBLIC_API_URL || "";

type Params = Record<string, string | number | boolean | null | undefined>;

declare global {
  interface Window {
    fbq?: (...args: any[]) => void;
    dataLayer?: any[];
  }
}

/** A unique id for one real-world action, shared by the browser and the server. */
export function newEventId(): string {
  try {
    if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") {
      return crypto.randomUUID();
    }
  } catch {
    /* falls through */
  }
  return `pf_${Date.now()}_${Math.random().toString(16).slice(2)}${Math.random()
    .toString(16)
    .slice(2)}`;
}

function readCookie(name: string): string {
  if (typeof document === "undefined") return "";
  const match = document.cookie.match(new RegExp("(^|;\\s*)" + name + "=([^;]*)"));
  return match ? decodeURIComponent(match[2]) : "";
}

/**
 * The two cookies Meta uses to tie a browser to a click.
 *
 * _fbc is only written by the pixel when the visitor arrives with an fbclid.
 * If the pixel was blocked or the landing happened before the pixel loaded, the
 * cookie is missing and the click would be lost - so it is rebuilt from the
 * fbclid we captured at landing, in the exact format Meta specifies:
 * `fb.1.<timestamp-ms>.<fbclid>`.
 */
export function getFbCookies(): { fbp: string; fbc: string } {
  const fbp = readCookie("_fbp");
  let fbc = readCookie("_fbc");

  if (!fbc) {
    try {
      const stored = getAttribution();
      if (stored.fbclid) {
        fbc = `fb.1.${stored.fbclidAt || Date.now()}.${stored.fbclid}`;
      }
    } catch {
      /* attribution is optional */
    }
  }

  return { fbp: fbp || "", fbc: fbc || "" };
}

/* ------------------------------------------------------------------ */
/* Ad attribution: captured once at landing, carried through signup    */
/* ------------------------------------------------------------------ */

export type Attribution = {
  utmSource?: string;
  utmCampaign?: string;
  utmContent?: string;
  utmMedium?: string;
  utmTerm?: string;
  fbclid?: string;
  fbclidAt?: number;
  gclid?: string;
  /* Meta's ids/names, from the ad's URL parameters ({{campaign.id}}, {{ad.name}}...). */
  campaignId?: string;
  adsetId?: string;
  adsetName?: string;
  adId?: string;
  adName?: string;
  /* ?source= on our own links: the event kiosk QR, referral links. */
  refSource?: string;
  landingPath?: string;
  referrer?: string;
  /* The first page this browser ever saw, tagged or not, and when. */
  firstLandingPath?: string;
  firstReferrer?: string;
  firstSeenAt?: number;
  /* Anonymous browser id; links the account to its first visit record. */
  visitorId?: string;
};

const ATTRIBUTION_KEY = "pf_attribution";
const FIRST_SEEN_KEY = "pf_first_seen";
const VISITOR_KEY = "pf_vid";
const VISIT_SENT_KEY = "pf_visit_sent";

const MARKETING_PARAMS: Array<[keyof Attribution, string]> = [
  ["utmSource", "utm_source"],
  ["utmCampaign", "utm_campaign"],
  ["utmContent", "utm_content"],
  ["utmMedium", "utm_medium"],
  ["utmTerm", "utm_term"],
  ["fbclid", "fbclid"],
  ["gclid", "gclid"],
  ["campaignId", "campaign_id"],
  ["adsetId", "adset_id"],
  ["adsetName", "adset_name"],
  ["adId", "ad_id"],
  ["adName", "ad_name"],
  ["refSource", "source"],
];

function readJson<T>(key: string): T | null {
  try {
    const raw = window.localStorage.getItem(key);
    return raw ? (JSON.parse(raw) as T) : null;
  } catch {
    return null;
  }
}

function visitorId(): string {
  let id = "";
  try {
    id = window.localStorage.getItem(VISITOR_KEY) || "";
    if (!/^[A-Za-z0-9_-]{12,64}$/.test(id)) {
      id = `v_${newEventId().replace(/[^A-Za-z0-9]/g, "").slice(0, 32)}`;
      window.localStorage.setItem(VISITOR_KEY, id);
    }
  } catch {
    /* storage blocked: no id, no visit record - nothing breaks */
  }
  return id;
}

/**
 * Record this browser's first visit with the server, once.
 *
 * It is the "Visitors" step of the admin funnel: anonymous (a random id, the
 * landing page, the referrer, the tags in the URL), never sent twice from the
 * same browser, skipped for automation. Fire-and-forget like the rest of this
 * module.
 */
function recordFirstVisit(incoming: Attribution) {
  try {
    if (!API_BASE || window.localStorage.getItem(VISIT_SENT_KEY)) return;
    if ((navigator as Navigator & { webdriver?: boolean }).webdriver) return;
    const id = visitorId();
    if (!id) return;
    window.localStorage.setItem(VISIT_SENT_KEY, "1");
    void fetch(`${API_BASE}/api/track/visit`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ visitorId: id, ...incoming, landingPath: window.location.pathname, referrer: document.referrer || undefined }),
      keepalive: true,
    }).catch(() => {});
  } catch {
    /* never throws */
  }
}

/**
 * Remember where this visitor came from, once.
 *
 * FIRST TOUCH WINS. A visitor who lands from an ad, wanders to /about and then
 * starts signup has one campaign, not none - and if a later internal page
 * overwrote the record with empty values the campaign would be lost exactly
 * when it starts mattering. So a stored record is never replaced by a visit
 * that carries no parameters of its own.
 *
 * localStorage rather than a cookie: it is not needed by the server on every
 * request, only at the moment an account is created, when it is sent explicitly.
 */
export function captureAttribution(): void {
  try {
    if (typeof window === "undefined") return;

    const params = new URLSearchParams(window.location.search);
    const incoming: Attribution = {};
    for (const [field, param] of MARKETING_PARAMS) {
      const value = params.get(param);
      if (value) (incoming as Record<string, string>)[field] = value.slice(0, 300);
    }

    /*
     * The very first page, every time it is the first - tagged or not - so a
     * customer who never clicked an ad still has a landing page and referrer
     * (that is how Google Organic and Direct are told apart). Separate from
     * the marketing touch below and, like it, never overwritten.
     */
    if (!readJson(FIRST_SEEN_KEY)) {
      window.localStorage.setItem(
        FIRST_SEEN_KEY,
        JSON.stringify({ firstLandingPath: window.location.pathname, firstReferrer: document.referrer || undefined, firstSeenAt: Date.now() })
      );
    }
    recordFirstVisit(incoming);

    const hasAny = Object.values(incoming).some(Boolean);
    if (!hasAny) return;

    if (incoming.fbclid) incoming.fbclidAt = Date.now();
    incoming.landingPath = window.location.pathname;
    incoming.referrer = document.referrer || undefined;

    const existing = readJson<Attribution>(ATTRIBUTION_KEY) || {};
    const existingHasAny = Object.values(existing).some(Boolean);
    if (existingHasAny) return;

    window.localStorage.setItem(ATTRIBUTION_KEY, JSON.stringify(incoming));
  } catch {
    /* private mode, blocked storage - tracking is never load-bearing */
  }
}

/** Everything known about how this browser arrived: first marketing touch, first page, visitor id. */
export function getAttribution(): Attribution {
  try {
    if (typeof window === "undefined") return {};
    const marketing = readJson<Attribution>(ATTRIBUTION_KEY) || {};
    const first = readJson<Attribution>(FIRST_SEEN_KEY) || {};
    const id = window.localStorage.getItem(VISITOR_KEY) || undefined;
    return { ...first, ...marketing, ...(id ? { visitorId: id } : {}) };
  } catch {
    return {};
  }
}

/* ------------------------------------------------------------------ */
/* Advanced matching                                                   */
/* ------------------------------------------------------------------ */

/**
 * Re-init the pixel with who this person is, once we know.
 *
 * Meta hashes these in the browser itself when they are passed to `init`, so
 * no plaintext leaves the page and we do not hash them here - passing an
 * already-hashed value would break the match, because Meta would hash it again.
 *
 * Calling init a second time with the same pixel id is the documented way to
 * add advanced matching to a session already in progress; it does not create a
 * second pixel and does not re-fire PageView.
 */
export function identify(user: { email?: string | null; phone?: string | null } | null): void {
  try {
    if (typeof window === "undefined" || typeof window.fbq !== "function") return;
    const em = String(user?.email || "").trim().toLowerCase();
    const ph = String(user?.phone || "").replace(/\D/g, "");
    if (!em && !ph) return;

    const matching: Record<string, string> = {};
    if (em) matching.em = em;
    if (ph) matching.ph = ph.length === 10 ? `1${ph}` : ph;

    window.fbq("init", META_PIXEL_ID, matching);
  } catch {
    /* never throws */
  }
}

/* ------------------------------------------------------------------ */
/* Sending                                                             */
/* ------------------------------------------------------------------ */

function pushDataLayer(name: string, params?: Params) {
  try {
    if (typeof window === "undefined") return;
    window.dataLayer = window.dataLayer || [];
    window.dataLayer.push({ event: name, ...(params || {}) });
  } catch {
    /* never throws */
  }
}

/**
 * Hand the same event to our own server so it can reach Meta a second way.
 *
 * keepalive, because three of these fire immediately before a redirect - to
 * Stripe, or to the dashboard - and a normal fetch is cancelled when the page
 * goes away. The response is ignored entirely: if the relay is down, or the
 * token is not configured, or the user is offline, the browser event still
 * stands on its own and the customer notices nothing.
 */
function relayToServer(payload: Record<string, unknown>) {
  try {
    if (typeof window === "undefined" || !API_BASE) return;
    const token = (() => {
      try {
        return window.localStorage.getItem("token") || "";
      } catch {
        return "";
      }
    })();

    void fetch(`${API_BASE}/api/track/meta`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
      },
      body: JSON.stringify(payload),
      keepalive: true,
      credentials: "include",
    }).catch(() => {});
  } catch {
    /* never throws */
  }
}

type SendOptions = {
  /** Standard Meta event (`track`) or one of ours (`trackCustom`). */
  custom?: boolean;
  /** Mirror this event to the Conversions API. Conversions only. */
  server?: boolean;
  /** dataLayer name, which is snake_case and independent of Meta's name. */
  dataLayerEvent?: string;
  /** Reuse an id minted elsewhere - a Stripe checkout, say. */
  eventId?: string;
};

function send(eventName: string, params: Params, options: SendOptions = {}): string {
  const eventId = options.eventId || newEventId();

  try {
    if (options.dataLayerEvent) {
      pushDataLayer(options.dataLayerEvent, { ...params, event_id: eventId });
    }

    if (typeof window !== "undefined" && typeof window.fbq === "function") {
      window.fbq(options.custom ? "trackCustom" : "track", eventName, params, { eventID: eventId });
    }

    if (options.server) {
      const { fbp, fbc } = getFbCookies();
      relayToServer({
        eventName,
        eventId,
        eventSourceUrl: typeof window !== "undefined" ? window.location.href : undefined,
        customData: params,
        fbp,
        fbc,
        attribution: getAttribution(),
      });
    }
  } catch {
    /* never throws */
  }

  return eventId;
}

/* ------------------------------------------------------------------ */
/* The five events                                                     */
/* ------------------------------------------------------------------ */

/** Step 1 of signup: the visitor has given us a verified home address. */
export function trackStartSignup(params: Params = {}): string {
  return send("StartSignup", params, { custom: true, dataLayerEvent: "start_signup" });
}

/**
 * How a conversion reaches the Conversions API.
 *
 * `relay: false` does NOT mean "browser only". It means the server is already
 * sending this event from somewhere it knows more than the browser does - the
 * registration handler, or the Stripe webhook - where the real email, phone and
 * address are in hand rather than whatever the page happens to hold. The
 * browser still fires fbq with the same event_id, and Meta still collapses the
 * pair. Leaving the relay on as well would send the event to Meta twice from
 * the server with one id, which is wasteful rather than wrong, but it is also
 * how a second conversion appears the day somebody changes the id.
 */
type ConversionOptions = {
  eventId?: string;
  relay?: boolean;
  /**
   * Lead only. Override the dataLayer event name, or pass null to push nothing.
   * The contact and estimate forms pass null: they are not a free visit, and
   * they already push their own dataLayer events.
   */
  dataLayerEvent?: string | null;
};

/**
 * The event the ad account optimises against.
 *
 * Fired for an account being created AND for a free first visit being booked,
 * because both are the same thing commercially: a new customer we can reach.
 */
export function trackLead(params: Params = {}, opts: ConversionOptions = {}): string {
  return send("Lead", params, {
    server: opts.relay !== false,
    dataLayerEvent:
      opts.dataLayerEvent === undefined ? "free_visit_booked" : opts.dataLayerEvent || undefined,
    eventId: opts.eventId,
  });
}

/** A paid membership has started. `value` is the amount actually charged. */
export function trackSubscribe(
  params: { value: number; currency?: string; content_name?: string } & Params,
  opts: ConversionOptions = {}
): string {
  return send(
    "Subscribe",
    { currency: "USD", ...params },
    { server: opts.relay !== false, dataLayerEvent: "subscribe", eventId: opts.eventId }
  );
}

/** A one-time visit has been paid for. */
export function trackPurchase(
  params: { value: number; currency?: string } & Params,
  opts: ConversionOptions = {}
): string {
  return send(
    "Purchase",
    { currency: "USD", ...params },
    { server: opts.relay !== false, dataLayerEvent: "purchase", eventId: opts.eventId }
  );
}

/** Someone tapped the phone number. Browser only - there is no server truth. */
export function trackPhoneClick(params: Params = {}): string {
  return send("Contact", params, { dataLayerEvent: "phone_click" });
}
