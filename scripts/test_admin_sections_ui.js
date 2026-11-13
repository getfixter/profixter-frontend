/* eslint-disable @typescript-eslint/no-require-imports -- a plain Node script, like the other scripts/ */
/*
 * The More sections of the admin in a real browser (FE-SECTIONS, 2026-11-13).
 *
 *   npx next start -p 3114           (after TURBOPACK_ROOT=... npm run build)
 *   npm run test:admin-sections      (or: node scripts/test_admin_sections_ui.js http://localhost:3114)
 *
 * FULL NETWORK JAIL on every context: the local server passes; every URL with
 * /api/ in its path, on ANY host (api.profixter.com included), is answered
 * here from fixtures shaped like the backend DTOs; everything else is aborted
 * and recorded, and must stay empty. Nothing is ever sent: the campaign
 * "send" is a fixture answer. Fake people only (@example.test).
 *
 * What it pins:
 * - each section renders with data, with empty data and with a server error,
 *   and the shell survives all three (Overview, Communications, Tips, Team,
 *   Recent Work, Promotion, Activity, Assistant, Work Photos)
 * - Communications survives malformed templates and review summaries
 * - campaign: confirm sheet names segment and count -> one POST with an
 *   idempotency key even on a double tap -> progress polls GET
 *   /campaigns/:id to Sent; a failed request retried reuses its key; Resume
 * - Team: Disable shows the future jobs, then the one-step reassignment
 *   with its own confirmation; typed-name delete stays guarded
 * - Tips: rows on a phone, the period table on desktop; Fixter scope
 * - no window.alert/confirm/prompt anywhere; no 1s re-render ticker in Recent Work
 * - password sheet: autocomplete hints, inline error, closes on success
 * - no sideways overflow at 7 viewports in every section
 * - screenshots (fake data) into reports/shots/sections
 */
const { chromium } = require("playwright");
const fs = require("fs");
const path = require("path");

const BASE = (process.argv[2] || "http://localhost:3114").replace(/\/$/, "");
const SHOTS = process.env.SHOTS_DIR || path.join(__dirname, "..", "..", "reports", "shots", "sections");
fs.mkdirSync(SHOTS, { recursive: true });
const OVERVIEW = require(path.join(__dirname, "fixtures", "admin-overview.json"));

const OWNER = { _id: "owner1", userId: "PF-OWNER", name: "Owner Test", email: "owner@example.test", phone: "5550100", role: "admin", addresses: [] };
const FIELD = { _id: "fx1", userId: "PF-FX", name: "Field Fixter", email: "fixter@example.test", phone: "5550101", role: "employee", employeePosition: "Fixter", isActive: true, permissions: ["bookings.read", "bookings.write", "tips.read"], addresses: [] };

const iso = (d) => new Date(Date.now() + d * 86400000).toISOString();
const day = (d) => iso(d).slice(0, 10);

/* ------------------------------------------------------------------ */
/* fixtures                                                            */
/* ------------------------------------------------------------------ */

const SMS_TEMPLATES = [
  { channel: "sms", templateKey: "booking_confirmed", label: "Booking confirmed", channelClass: "transactional", editable: true, defaultBody: "Hi {{firstName}}", body: "Hi {{firstName}}, you're booked.", hasOverride: true, updatedAt: iso(-2), updatedByName: "Owner Test", variables: ["firstName", "date"], preview: { body: "Hi Ann, you're booked.", characters: 22, encoding: "GSM-7", segments: 1, multiSegment: false, maxLength: 320 } },
  { channel: "sms", templateKey: "reminder_24h", label: "Reminder 24h", channelClass: "transactional", editable: true, defaultBody: "", body: "Reminder", hasOverride: false, updatedAt: null, variables: ["firstName"], preview: { body: "Reminder for Ann", characters: 16, encoding: "GSM-7", segments: 1, multiSegment: false, maxLength: 320 } },
];
const EMAIL_TEMPLATES = [
  { channel: "email", templateKey: "welcome", label: "Welcome", channelClass: "transactional", editable: true, subject: "Welcome to Profixter", body: "", hasOverride: false, variables: ["firstName"], protectedTokens: [], disposition: "editable" },
  { channel: "email", templateKey: "admin_booking_alert", label: "Admin booking alert", channelClass: "internal", editable: false, subject: "", trigger: "A booking is created", audience: "Owner", source: "routes/bookings", protectedNote: "Built from the booking", disposition: "visible" },
];
const SEGMENTS = { all: 40, subscribed: 12, not_subscribed: 28, basic: 5, plus: 4, premium: 2, elite: 1 };
const RECIPIENTS = Array.from({ length: 4 }, (_, i) => ({ id: `r${i}`, userId: `PF-R${i}`, name: `Recipient ${i}`, email: `r${i}@example.test`, plans: [], subscriptionStatuses: [] }));
const EMAIL_LOGS = { items: [{ _id: "e1", templateKey: "welcome", subject: "Welcome to Profixter", recipientEmail: "ann@example.test", recipientName: "Ann Example", status: "sent", emailType: "transactional", sentAt: iso(-1), createdAt: iso(-1) }, { _id: "e2", templateKey: "reminder", subject: "Reminder", recipientEmail: "bob@example.test", status: "failed", errorMessage: "Mailbox full", createdAt: iso(-1) }], total: 2, page: 1, limit: 25, totalPages: 1 };
const SMS_MESSAGES = { items: [{ _id: "s1", notificationType: "booking_confirmed", channelClass: "transactional", status: "delivered", recipientName: "Ann Example", toPhone: "+15550101234", bookingNumber: "1001", body: "Hi Ann, you're booked.", segments: 1, createdAt: iso(-1) }], total: 1, page: 1, limit: 25, totalPages: 1 };

const PERIODS = [0, 1, 2, 3, 4, 5, 6, 7].map((i) => ({ start: day(-7 * (i + 1)), end: day(-7 * i - 1), payday: day(-7 * i) }));
const TIPS = {
  scope: "admin",
  payPeriods: PERIODS,
  currentPeriod: PERIODS[0],
  closingPeriod: PERIODS[1],
  totals: { allTimeCents: 52000, currentPeriodCents: 4000, closingPeriodCents: 6500, count: 14 },
  unassignedTotals: { allTimeCents: 1500, currentPeriodCents: 0, closingPeriodCents: 0, count: 1 },
  fixters: [
    { fixterId: "fx1", name: "Field Fixter", position: "Fixter", isActive: true, allTimeCents: 32000, currentPeriodCents: 2000, closingPeriodCents: 4500, count: 9, byPeriod: { [PERIODS[0].start]: 2000, [PERIODS[1].start]: 4500 } },
    { fixterId: "fx2", name: "Second Fixter", position: "General Fixter", isActive: true, allTimeCents: 20000, currentPeriodCents: 2000, closingPeriodCents: 2000, count: 5, byPeriod: { [PERIODS[0].start]: 2000 } },
  ],
  transactions: [{ id: "t1", receivedAt: iso(-2), amountCents: 2000, refundedCents: 0, netCents: 2000, currency: "usd", status: "succeeded", fixterId: "fx1", fixterName: "Field Fixter", tipperName: "Ann Example", bookingNumber: "1001", assignmentStatus: "attributed" }],
  unassigned: [{ id: "t9", receivedAt: iso(-3), amountCents: 1500, refundedCents: 0, netCents: 1500, currency: "usd", status: "succeeded", fixterId: "", fixterName: "", tipperName: "Visitor", bookingNumber: "", unassignedReason: "No booking on the link", assignmentStatus: "unassigned" }],
  assignableFixters: [{ id: "fx1", name: "Field Fixter", position: "Fixter", isActive: true }],
  truncated: false,
};
const TIPS_FIELD = { ...TIPS, scope: "fixter", fixters: [TIPS.fixters[0]], unassigned: [], assignableFixters: [] };
const EMPTY_TIPS = { ...TIPS, totals: { allTimeCents: 0, currentPeriodCents: 0, closingPeriodCents: 0, count: 0 }, fixters: [], transactions: [], unassigned: [] };

const employee = (id, first, last, extra = {}) => ({ id, firstName: first, lastName: last, name: `${first} ${last}`, email: `${first.toLowerCase()}@example.test`, phone: "5550111", role: "employee", employeePosition: "Fixter", employeeTitle: "", adminSections: [], isActive: true, mustChangePassword: false, isDefaultFixter: false, employeeAvailabilityStatus: "Available", completedBookingsCount: 12, offDaysSummary: { upcomingCount: 1, pastCount: 2, recent: [{ date: day(5), reason: "Vacation", status: "approved" }] }, createdAt: iso(-90), updatedAt: iso(-1), ...extra });
const FIXTERS = [employee("fx1", "Field", "Fixter"), employee("fx2", "Second", "Fixter", { employeePosition: "General Fixter" }), employee("of1", "Office", "Person", { employeePosition: null, employeeTitle: "Marketing Manager", adminSections: ["overview"] })];
const REGISTRY = { groups: [{ id: "work", label: "Daily work" }], sections: [{ id: "overview", group: "work", label: "Overview", description: "Business numbers", requires: null }], positions: ["Fixter", "General Fixter"], includedByPosition: { Fixter: [], "General Fixter": [] } };
const FUTURE_JOBS = { count: 2, jobs: [{ id: "b1", bookingNumber: "#1001", date: iso(2), status: "Confirmed", customerName: "Ann Example" }, { id: "b2", bookingNumber: "#1002", date: iso(4), status: "Pending", customerName: "Bob Example" }] };

const photo = (id, status, extra = {}) => ({ id, title: `Kitchen ${id}`, caption: "Cabinet repair", category: "kitchen", location: "Testville", featured: false, thumbUrl: "/images/profixter-hammer-mark.png", imageUrl: "/images/profixter-hammer-mark.png", fullUrl: "/images/profixter-hammer-mark.png", width: 800, height: 600, kind: "photo", status, uploaderType: "admin", uploadedByName: "Owner Test", uploadedByRole: "admin", bookingNumber: "", internalNote: "", publishAt: null, firstPublishedAt: null, unpublishedAt: null, reviewedByName: "", reviewedAt: null, rejectionReason: "", batchId: "b", createdAt: iso(-3), sourceWidth: 800, sourceHeight: 600, bytes: 1000, ...extra });
const GALLERY = { view: "published", page: 1, limit: 60, total: 3, photos: [photo("p1", "published"), photo("p2", "scheduled", { publishAt: iso(0.02) }), photo("p3", "pending")], counts: { pending: 1, scheduled: 1, published: 1, rejected: 0, library: 3 }, categories: [{ slug: "kitchen", label: "Kitchen" }] };
const PROMO = { _id: "pp1", enabled: true, eyebrow: "Profixter update", title: "Winter tune-up", message: "Book before December.", promoCode: "WINTER", ctaText: "Book", ctaUrl: "https://profixter.com/book", secondaryText: "", secondaryUrl: "", startAt: null, endAt: null, target: "homepage", internalNote: "", updatedAt: iso(-1) };
const ACTIVITY = { items: [{ _id: "a1", action: "Employee Disabled", entityType: "employee", entityId: "fx9", entityName: "Old Fixter", actorName: "Owner Test", actorRole: "admin", details: { title: "Fixter" }, createdAt: iso(-1) }, { _id: "a2", action: "email_campaign_queued", entityType: "EmailCampaign", entityId: "c1", entityName: "EML-2026-00001", actorName: "Owner Test", actorRole: "admin", details: { segment: "all" }, createdAt: iso(-2) }], total: 2, page: 1, limit: 25, totalPages: 1 };
const GROWTH = {
  generatedAt: iso(0),
  engineEnabled: false,
  capacity: { signal: "unknown", days: 21 },
  queue: { pending: [], recent: [], shadow: [], last7Days: {} },
  policies: [{ type: "seo_page", label: "SEO page", description: "Drafts a page for owner review.", riskTier: "low", mode: "supervised", defaultMode: "shadow", maxMode: "supervised", promoteAfter: null, perDay: 1, streak: 4, verifiedSuccesses: 4, failures: 0, setBy: "owner", setNote: "", setAt: iso(-5), promotedAt: null, demotedAt: null }],
  outcomes: { checkoutRecovery: { windowDays: 7, sent: 0, recovered: 0, stillInWindow: 0 } },
  waitlist: { waiting: 0, last30Days: 0, topZips: [] },
  alerts: [],
  acquisition: {
    firstFreeVisits: { last7: 2, prev7: 3, last30: 9, prev30: 8 },
    newFreeVisits: { last7: 7, prev7: 4, last30: 15, prev30: 8, last7Pending: 3, last7Confirmed: 4, last30Pending: 4, last30Confirmed: 11, fromAccounts30: 9, fromRequests30: 6 },
    visitors30: 900,
    registrations30: 30,
    bySource30: [{ key: "google", label: "Google", visitors: 300, registrations: 10, freeVisits: 5 }],
    funnel30: { booking_page_view: 120, booker_started: 40, slot_selected: 18, signup_view: 0, oneStepRequests: 5, firstFreeVisits: 1, since: "2026-10-27", flowSince: "2026-10-27", trackingSince: "2026-10-09" },
    funnelBefore: { booking_page_view: 800, booker_started: 260, slot_selected: 110, signup_view: 64, firstFreeVisits: 8, since: "2026-10-09", through: "2026-10-26" },
    costPerFirstFreeVisitCents: null,
  },
};
const JOBS = { jobs: [{ bookingNumber: "1001", date: iso(-1), service: "Handyman visit", status: "completed", city: "Testville" }] };
const SUBMISSIONS = { photos: [photo("w1", "pending", { bookingNumber: "1001" })], items: [photo("w1", "pending", { bookingNumber: "1001" })] };

/* Per-test behaviour: mode "data" | "empty" | "error", plus overrides. */
function answer(p, method, url, body, opts) {
  const mode = opts.mode || "data";
  const error = mode === "error";
  const empty = mode === "empty";
  const fail = () => ({ status: 500, body: { message: "Server error (fixture)", code: "SERVER_ERROR" } });
  const ok = (b) => ({ status: 200, body: b });
  if (opts.override) {
    const o = opts.override(p, method, url, body);
    if (o) return o;
  }
  if (p === "/api/auth/me") return opts.user ? ok(opts.user) : { status: 401, body: { message: "No token" } };
  if (p === "/api/admin/needs-action") return ok({ sections: [] });
  if (p === "/api/auth/change-password") return body && body.currentPassword === "right-password" ? ok({ message: "ok" }) : { status: 400, body: { message: "Current password is incorrect" } };
  if (p.startsWith("/api/admin/overview")) {
    if (error) return fail();
    if (p.endsWith("/map")) return ok(empty ? { points: [] } : OVERVIEW.map);
    if (p.endsWith("/list")) return ok(empty ? { rows: [] } : OVERVIEW.list);
    return ok(empty ? {} : OVERVIEW.overview);
  }
  if (p === "/api/admin/communications/templates") return error ? fail() : ok(empty ? { sms: [], email: [], protectedContent: [] } : { sms: SMS_TEMPLATES, email: EMAIL_TEMPLATES, protectedContent: [{ id: "stop", applies: "marketing", text: "Reply STOP to opt out", enforcement: "Added by the server" }] });
  if (p === "/api/admin/communications/preview") return ok({ body: "Preview body", characters: 12, encoding: "GSM-7", segments: 1, multiSegment: false, maxLength: 320, subject: "Preview", html: "<p>Preview</p>", validation: { errors: [] } });
  if (p.startsWith("/api/admin/communications/templates/")) return ok({ settings: { trigger: "Booking confirmed", ghlOverlap: "None: legacy field" }, revisions: [] });
  if (p.startsWith("/api/admin/review-requests/summary")) return error ? fail() : ok({ days: 30, sent: 8, skipped: { customer_cooldown: 2 }, linkOpens: { email: 3 }, reviewedCustomers: 4 });
  if (p === "/api/admin/segments") return error ? fail() : ok(empty ? { all: 0, subscribed: 0, not_subscribed: 0, basic: 0, plus: 0, premium: 0, elite: 0 } : SEGMENTS);
  if (p === "/api/admin/campaigns/variables") return ok([{ id: "customer", label: "Customer", variables: [{ key: "firstName", tag: "{{firstName}}", description: "First name" }] }]);
  if (p === "/api/admin/campaigns/recipients") {
    const rec = empty ? [] : RECIPIENTS;
    return ok({ segment: url.searchParams.get("segment") || "not_subscribed", includedCount: rec.length, excludedCount: 0, eligibleBeforeExclusions: rec.length, recipients: rec, excludedRecipients: [] });
  }
  if (p === "/api/admin/campaigns/preview") return ok({ segment: "not_subscribed", recipientCount: 4, subject: "S", html: "<p>x</p>", text: "x", sampleValues: { firstName: "Ann" } });
  if (p === "/api/admin/email-logs") return error ? fail() : ok(empty ? { items: [], total: 0, page: 1, limit: 25, totalPages: 1 } : EMAIL_LOGS);
  if (p === "/api/admin/sms/config") return ok({ config: { smsEnabled: true, smsMarketingEnabled: false, twilioConfigured: true }, pendingRetries: 0, optOuts: 1, phones: { undeliverable: 0, valid: 3 } });
  if (p === "/api/admin/sms/messages") return error ? fail() : ok(empty ? { items: [], total: 0, page: 1, limit: 25, totalPages: 1 } : SMS_MESSAGES);
  if (p === "/api/admin/sms/failures") return ok({ sinceHours: 24, items: [], byReason: [] });
  if (p === "/api/admin/sms/opt-outs") return ok({ items: [{ _id: "o1", phone: "+15550109999", scope: "marketing", source: "inbound_stop", keyword: "STOP", optedOutAt: iso(-4) }], total: 1, page: 1, limit: 25 });
  if (p === "/api/admin/tips") return error ? fail() : ok(empty ? EMPTY_TIPS : opts.user && opts.user.role !== "admin" ? TIPS_FIELD : TIPS);
  if (p === "/api/admin/fixters/access-registry") return ok(REGISTRY);
  if (p === "/api/admin/activity-log/summary") return ok({ since: iso(-1), usersDeleted: 0, leadsDeleted: 1, projectsDeleted: 0 });
  if (p === "/api/admin/fixters") return error ? fail() : ok({ fixters: empty ? [] : FIXTERS });
  if (/^\/api\/admin\/fixters\/[^/]+\/future-jobs$/.test(p)) return ok(FUTURE_JOBS);
  if (/^\/api\/admin\/fixters\/[^/]+\/status$/.test(p)) return ok({ fixter: { ...FIXTERS[0], isActive: body && body.isActive }, templateReady: true, futureAssignedJobs: body && body.isActive === false ? 2 : 0 });
  if (/^\/api\/admin\/fixters\/[^/]+\/reassign-future-jobs$/.test(p)) return ok({ total: 2, moved: [{ id: "b1", bookingNumber: "#1001", date: FUTURE_JOBS.jobs[0].date, toFixterName: "Second Fixter", notification: { sent: true } }], failed: [{ id: "b2", bookingNumber: "#1002", date: FUTURE_JOBS.jobs[1].date, code: "SLOT_UNAVAILABLE", message: "No other Fixter is free at this time" }] });
  if (p === "/api/admin/recent-work") return error ? fail() : ok(empty ? { ...GALLERY, total: 0, photos: [], counts: { pending: 0, scheduled: 0, published: 0, rejected: 0, library: 0 } } : GALLERY);
  if (p === "/api/admin/promotion-popup") return error ? fail() : ok({ popup: empty ? { enabled: false, eyebrow: "", title: "", message: "", promoCode: "", ctaText: "", ctaUrl: "", secondaryText: "", secondaryUrl: "", startAt: null, endAt: null, target: "homepage" } : PROMO });
  if (p === "/api/admin/activity-log") return error ? fail() : ok(empty ? { items: [], total: 0, page: 1, limit: 25, totalPages: 1 } : ACTIVITY);
  if (p === "/api/admin/growth/summary") return error ? fail() : ok(GROWTH);
  /* Like test_admin_growth_ui: the panels not under test answer 503 and show their own "could not load". */
  if (p.startsWith("/api/admin/growth/")) return { status: 503, body: { message: "not in this test" } };
  if (p === "/api/recent-work/my-jobs") return error ? fail() : ok(empty ? { jobs: [] } : JOBS);
  if (p === "/api/recent-work/my-submissions") return error ? fail() : ok(empty ? { photos: [], items: [] } : SUBMISSIONS);
  if (p.startsWith("/api/event") || p.startsWith("/api/public")) return ok({});
  return ok(p.includes("summary") || p.includes("settings") ? {} : []);
}

/* ------------------------------------------------------------------ */
/* harness                                                             */
/* ------------------------------------------------------------------ */

const results = [];
function check(name, pass, detail = "") {
  results.push({ name, pass: !!pass });
  console.log(`${pass ? "PASS" : "FAIL"}  ${name}${detail ? "  :: " + detail : ""}`);
}

const EXTERNAL = [];
/* /event is a public page that keeps its trackers (FE-FOUNDATION); its aborted tracker requests are not counted. */
let countExternal = true;
const DIALOGS = [];

async function open(browser, opts = {}) {
  const { width = 390, height = 844 } = opts;
  const mobile = opts.touch ?? width < 1024;
  const ctx = await browser.newContext({ viewport: { width, height }, isMobile: mobile, hasTouch: mobile, serviceWorkers: "block", reducedMotion: "reduce" });
  if (opts.user !== null) await ctx.addInitScript(() => location.pathname.startsWith("/admin") && localStorage.setItem("token", "ui-token"));
  await ctx.addInitScript(() => {
    /* Record short intervals (the Recent Work 1s ticker regression). */
    const orig = window.setInterval;
    window.__intervals = [];
    window.setInterval = function (fn, ms, ...rest) {
      window.__intervals.push({ ms: Number(ms) || 0, at: location.pathname, stack: String(new Error().stack || "").split("\n").slice(2, 5).join(" | ") });
      return orig.call(window, fn, ms, ...rest);
    };
  });
  const api = [];
  const local = new URL(BASE);
  await ctx.route("**/*", async (route) => {
    const req = route.request();
    const u = new URL(req.url());
    if (u.pathname.includes("/api/")) {
      const cors = { "access-control-allow-origin": "*", "access-control-allow-headers": "Authorization,Content-Type,Idempotency-Key", "access-control-allow-methods": "GET,POST,PUT,PATCH,DELETE,OPTIONS" };
      if (req.method() === "OPTIONS") return route.fulfill({ status: 204, headers: cors });
      const p = u.pathname.replace(/^.*?(\/api\/)/, "/api/");
      let body = null;
      try {
        body = req.postDataJSON();
      } catch {
        body = null;
      }
      api.push({ method: req.method(), path: p, search: u.search, body, headers: req.headers() });
      const res = answer(p, req.method(), u, body, opts);
      if (res.delay) await new Promise((r) => setTimeout(r, res.delay));
      return route.fulfill({ status: res.status, contentType: "application/json", headers: cors, body: JSON.stringify(res.body) });
    }
    if (u.origin === local.origin) return route.continue();
    if (countExternal) EXTERNAL.push(u.href);
    return route.abort();
  });
  const page = await ctx.newPage();
  const errors = [];
  page.on("pageerror", (e) => errors.push(e.message));
  page.on("dialog", (d) => {
    DIALOGS.push(`${d.type()}: ${d.message()}`);
    d.dismiss().catch(() => {});
  });
  return { ctx, page, api, errors };
}

async function go(page, route, ready, timeout = 20000) {
  await page.goto(`${BASE}${route}`, { waitUntil: "domcontentloaded" });
  if (ready) await page.waitForSelector(ready, { timeout }).catch(() => {});
  await page.waitForTimeout(700);
}

async function overflow(page) {
  return page.evaluate(() => {
    const doc = document.documentElement;
    const over = doc.scrollWidth - doc.clientWidth;
    if (over <= 1) return { over: 0, culprits: [] };
    const culprits = [];
    for (const el of document.querySelectorAll("body *")) {
      const r = el.getBoundingClientRect();
      if (r.right > doc.clientWidth + 1 && r.width > 0 && getComputedStyle(el).position !== "fixed") {
        culprits.push(`${el.tagName.toLowerCase()}.${String(el.className).slice(0, 60)} → ${Math.round(r.right)}`);
        if (culprits.length > 4) break;
      }
    }
    return { over, culprits };
  });
}

const SECTIONS = [
  { id: "overview", route: "/admin/overview", ready: ".ov-num", user: OWNER, dataText: /Active members|Customer funnel/i },
  { id: "communications", route: "/admin/communications", ready: "[data-template]", user: OWNER, dataText: /Booking confirmed/ },
  { id: "tips", route: "/admin/tips", ready: "[data-tips]", user: OWNER, dataText: /Field Fixter/ },
  { id: "team", route: "/admin/team", ready: "[data-employee]", user: OWNER, dataText: /Second Fixter/ },
  { id: "recent-work", route: "/admin/recent-work", ready: "img", user: OWNER, dataText: /Kitchen p1/ },
  { id: "promotion", route: "/admin/promotion", ready: "[data-promotion-editor]", user: OWNER, dataText: /Winter tune-up/ },
  { id: "activity", route: "/admin/activity", ready: "[data-activity-log]", user: OWNER, dataText: /Employee Disabled|Old Fixter/ },
  { id: "assistant", route: "/admin/assistant", ready: "[data-view-toggle]", user: OWNER, dataText: /SEO page/ },
  { id: "work-photos", route: "/admin/work-photos", ready: "[data-section=work-photos]", user: FIELD, dataText: /1001/ },
];

const VIEWPORTS = [
  { w: 320, h: 568, label: "320x568" },
  { w: 375, h: 667, label: "375x667" },
  { w: 390, h: 844, label: "390x844" },
  { w: 430, h: 932, label: "430x932" },
  { w: 844, h: 390, label: "844x390-landscape", touch: true },
  { w: 820, h: 1180, label: "820x1180-tablet", touch: true },
  { w: 1440, h: 900, label: "1440x900-desktop", touch: false },
];

(async () => {
  const browser = await chromium.launch();

  /* ---------------- data / empty / error per section ---------------- */
  for (const s of SECTIONS) {
    console.log(`\n--- ${s.id}: data, empty, error ---`);
    for (const mode of ["data", "empty", "error"]) {
      const { ctx, page, errors } = await open(browser, { user: s.user, mode, width: 1440, height: 900 });
      await go(page, s.route, mode === "data" ? s.ready : "[data-section]");
      await page.waitForTimeout(mode === "data" ? 300 : 900);
      if (mode === "data") {
        /* Wait (up to 8s) until the data is on screen, inputs included (Promotion shows it in fields). */
        await page
          .waitForFunction((src) => new RegExp(src.s, src.f).test(document.body.innerText + " " + [...document.querySelectorAll("input,textarea")].map((e) => e.value).join(" ")), { s: s.dataText.source, f: s.dataText.flags }, { timeout: 8000 })
          .catch(() => {});
      }
      const text = (await page.locator("main, body").first().innerText()) + " " + (await page.locator("input, textarea").evaluateAll((els) => els.map((e) => e.value).join(" ")));
      const shell = (await page.locator(".adm-header").count()) > 0;
      if (mode === "data") {
        check(`${s.id}: renders its data`, s.dataText.test(text), text.replace(/\s+/g, " ").slice(0, 140));
      } else if (mode === "empty") {
        check(`${s.id}: empty data renders without a crash`, shell && !/Something went wrong|could not show|hit a problem/i.test(text) && (await page.locator("[data-section]").count()) > 0, text.replace(/\s+/g, " ").slice(0, 140));
      } else {
        const said = (await page.locator("[role=alert]").count()) > 0 || /couldn|could not|failed|try again|retry|error/i.test(text);
        check(`${s.id}: a server error is shown, the shell stays`, shell && said, text.replace(/\s+/g, " ").slice(0, 160));
      }
      check(`${s.id} (${mode}): no page errors`, errors.length === 0, errors.join(" | "));
      await ctx.close();
    }
  }

  /* ---------------- communications: malformed data ---------------- */
  {
    console.log("\n--- communications: malformed data ---");
    const malformed = (p) => {
      if (p === "/api/admin/communications/templates")
        return { status: 200, body: { sms: [{ templateKey: "broken_one" }, { label: null, preview: null, variables: null, templateKey: "broken_two" }, null, "nonsense"], email: [{ templateKey: "e_broken", subject: null, variables: "x" }, { label: 5 }], protectedContent: "bad" } };
      if (p.startsWith("/api/admin/review-requests/summary")) return { status: 200, body: { days: 30, sent: "7", skipped: null, linkOpens: null } };
      return null;
    };
    const { ctx, page, errors } = await open(browser, { user: OWNER, override: malformed, width: 390, height: 844 });
    await go(page, "/admin/communications", "[data-template]");
    check("malformed: template rows still render", (await page.locator("[data-template]").count()) >= 3);
    check("malformed: review summary renders with nulls", (await page.locator("[data-review-summary]").count()) === 1);
    await page.locator("input[type=search]").first().fill("broken");
    await page.waitForTimeout(300);
    check("malformed: search over missing previews does not crash", (await page.locator("[data-template]").count()) >= 1);
    await page.locator("[data-template] button[aria-expanded]").first().click();
    await page.waitForTimeout(600);
    await page.getByRole("tab", { name: /Emails/ }).click();
    await page.locator("input[type=search]").first().fill("");
    await page.waitForTimeout(300);
    await page.locator("[data-template] button[aria-expanded]").first().click();
    await page.waitForTimeout(500);
    check("malformed: no 'GHL overlap' text anywhere", !/GHL overlap/i.test(await page.locator("body").innerText()));
    check("malformed: the shell and section survive", (await page.locator(".adm-header").count()) === 1 && (await page.locator("[data-communications]").count()) === 1);
    check("malformed: no page errors", errors.length === 0, errors.join(" | "));
    await ctx.close();
  }

  /* ---------------- communications: settings never show GHL overlap; SMS log ---------------- */
  {
    console.log("\n--- communications: settings, SMS log ---");
    const { ctx, page, errors, api } = await open(browser, { user: OWNER, width: 1440, height: 900 });
    await go(page, "/admin/communications", "[data-template]");
    await page.locator("[data-template=booking_confirmed] button[aria-expanded]").click();
    await page.getByRole("button", { name: "Settings" }).click();
    await page.waitForSelector("[data-settings-panel]", { timeout: 5000 }).catch(() => {});
    const panel = await page.locator("[data-settings-panel]").innerText().catch(() => "");
    check("settings panel shows the trigger", /Booking confirmed/.test(panel));
    check("settings panel drops the stale GHL overlap row", !/GHL/i.test(panel), panel.replace(/\s+/g, " "));
    await page.getByRole("button", { name: "Reset to default" }).click();
    await page.waitForSelector("[role=dialog]", { timeout: 4000 }).catch(() => {});
    check("reset asks in a sheet, not window.confirm", (await page.locator("[role=dialog]").count()) === 1);
    await page.keyboard.press("Escape");
    await page.getByRole("tab", { name: "SMS log" }).click();
    await page.waitForSelector("[data-sms-row]", { timeout: 6000 }).catch(() => {});
    const log = await page.locator("[data-sms-log]").innerText();
    check("owner sees the SMS log rows", (await page.locator("[data-sms-row]").count()) === 1);
    check("SMS log masks phone numbers", log.includes("•••• 1234") && !log.includes("5550101234"));
    check("SMS log is read-only (no send/clear button)", (await page.locator("[data-sms-log] button", { hasText: /send|clear|text now/i }).count()) === 0);
    await page.locator("[data-sms-log] button", { hasText: "Opt-outs" }).click();
    await page.waitForSelector("[data-optout-row]", { timeout: 5000 }).catch(() => {});
    check("opt-outs view lists opt-outs", (await page.locator("[data-optout-row]").count()) === 1);
    check("SMS log never puts names or numbers in the URL", api.filter((a) => a.path.startsWith("/api/admin/sms/")).every((a) => !/phone=|search=|user=/.test(a.search)));
    check("settings/SMS log: no page errors", errors.length === 0, errors.join(" | "));
    await page.screenshot({ path: path.join(SHOTS, "communications-smslog-1440x900.png") });
    await ctx.close();

    const field = await open(browser, { user: { ...OWNER, role: "employee", employeePosition: null, isActive: true, permissions: ["communications.manage"] }, width: 1440, height: 900 });
    await go(field.page, "/admin/communications", "[data-template]");
    check("a non-owner with Communications does not get the SMS log tab", (await field.page.getByRole("tab", { name: "SMS log" }).count()) === 0);
    await field.ctx.close();
  }

  /* ---------------- campaign: confirm -> queued -> progress ---------------- */
  {
    console.log("\n--- campaign send ---");
    let sends = 0;
    let polls = 0;
    const override = (p, method, url, body) => {
      if (p === "/api/admin/campaigns/send" && method === "POST") {
        sends += 1;
        return { status: 200, delay: 700, body: { campaignId: "EML-2026-00042", campaignNumber: "EML-2026-00042", id: "c42", segment: body.segment, total: 4, sent: 1, failed: 0, skipped: 0, excluded: 0, adminCopySent: true, status: "sending", errors: [], pending: 3, finished: false, queued: true } };
      }
      if (p === "/api/admin/campaigns/c42" && method === "GET") {
        polls += 1;
        const done = polls >= 2;
        return { status: 200, body: { campaign: { _id: "c42", campaignNumber: "EML-2026-00042", status: done ? "completed_with_errors" : "sending", subject: "Winter offer", segment: "not_subscribed", total: 4, sent: done ? 3 : 2, failed: done ? 1 : 0, skipped: 0, excluded: 0, pending: done ? 0 : 2, adminCopySent: true, actorName: "Owner Test", finished: done }, recentFailures: done ? [{ email: "r3@example.test", error: "Mailbox full", at: iso(0) }] : [], allowedActions: { resume: false } } };
      }
      return null;
    };
    const { ctx, page, errors, api } = await open(browser, { user: OWNER, override, width: 390, height: 844 });
    await go(page, "/admin/communications", "[data-template]");
    await page.getByRole("tab", { name: "Campaign" }).click();
    await page.waitForSelector("[data-campaign-composer]", { timeout: 8000 });
    await page.waitForFunction(() => /4 included/.test(document.querySelector("[data-recipient-summary]")?.textContent || ""), null, { timeout: 8000 }).catch(() => {});
    await page.getByLabel("Subject", { exact: true }).fill("Winter offer");
    await page.getByLabel("Message", { exact: true }).fill("Hello {{firstName}}, winter is coming.");
    await page.locator("[data-send-campaign]").click();
    await page.waitForSelector("[role=dialog]", { timeout: 4000 });
    const sheet = await page.locator("[role=dialog]").innerText();
    check("confirm sheet states the segment", sheet.includes("Not Subscribed"), sheet.replace(/\s+/g, " "));
    check("confirm sheet states the recipient count", /4 people/.test(sheet));
    check("confirm button repeats the verb and count", (await page.locator("[role=dialog] [data-confirm]").innerText()).includes("Send to 4 people"));
    check("nothing is sent before confirming", sends === 0);
    await page.screenshot({ path: path.join(SHOTS, "communications-campaign-confirm-390x844.png") });
    const confirm = page.locator("[role=dialog] [data-confirm]");
    await confirm.click();
    await confirm.click({ force: true, timeout: 500 }).catch(() => {});
    await confirm.click({ force: true, timeout: 500 }).catch(() => {});
    await page.waitForSelector("[data-campaign-progress]", { timeout: 8000 }).catch(() => {});
    check("double tap sends exactly one request", sends === 1, `sends=${sends}`);
    const sendCall = api.find((a) => a.path === "/api/admin/campaigns/send");
    const key = sendCall && sendCall.body && sendCall.body.idempotencyKey;
    check("send carries an idempotency key in body and header", !!key && sendCall.headers["idempotency-key"] === key, key);
    check("queued campaign shows the progress view", (await page.locator("[data-campaign-progress]").count()) === 1);
    await page.waitForFunction(() => document.querySelector("[data-campaign-progress]")?.getAttribute("data-status") === "completed_with_errors", null, { timeout: 15000 }).catch(() => {});
    check("progress polls GET /api/admin/campaigns/:id", polls >= 2, `polls=${polls}`);
    const prog = await page.locator("[data-campaign-progress]").innerText();
    check("progress ends with sent counts and failures", /3 of 4 sent/.test(prog) && /Sent with failures/.test(prog) && /Failed addresses \(1\)/.test(prog), prog.replace(/\s+/g, " ").slice(0, 200));
    await page.screenshot({ path: path.join(SHOTS, "communications-campaign-progress-390x844.png") });
    const pollsAtEnd = polls;
    await page.waitForTimeout(4000);
    check("polling stops once the campaign is finished", polls === pollsAtEnd, `${pollsAtEnd} -> ${polls}`);
    await page.reload({ waitUntil: "domcontentloaded" });
    await page.waitForSelector("[role=tab]", { timeout: 10000 });
    await page.getByRole("tab", { name: "Campaign" }).click();
    await page.waitForSelector("[data-campaign-progress]", { timeout: 8000 }).catch(() => {});
    check("returning shows the watched campaign again", (await page.locator("[data-campaign-progress]").count()) === 1);
    await page.locator("[data-new-campaign]").click();
    await page.waitForSelector("[data-campaign-composer]", { timeout: 5000 }).catch(() => {});
    check("New campaign returns to an empty composer", (await page.locator("[data-campaign-composer]").count()) === 1 && (await page.getByLabel("Subject", { exact: true }).inputValue()) === "");
    check("campaign: no page errors", errors.length === 0, errors.join(" | "));
    await ctx.close();
  }

  {
    console.log("\n--- campaign: failure, retry keeps the key, resume ---");
    let attempt = 0;
    const keys = [];
    let resumed = 0;
    const override = (p, method, url, body) => {
      if (p === "/api/admin/campaigns/send" && method === "POST") {
        attempt += 1;
        keys.push(body.idempotencyKey);
        if (attempt === 1) return { status: 503, body: { message: "Email provider unavailable", code: "CAMPAIGN_SEND_FAILED" } };
        return { status: 200, body: { campaignNumber: "EML-2026-00043", campaignId: "EML-2026-00043", id: "c43", segment: "all", total: 4, sent: 1, failed: 0, excluded: 0, adminCopySent: true, status: "failed", pending: 3, finished: true, duplicate: true } };
      }
      if (p === "/api/admin/campaigns/c43" && method === "GET")
        return { status: 200, body: { campaign: { _id: "c43", campaignNumber: "EML-2026-00043", status: resumed ? "completed" : "failed", subject: "S", segment: "all", total: 4, sent: resumed ? 4 : 1, failed: 0, pending: resumed ? 0 : 3, adminCopySent: true, finished: true }, recentFailures: [], allowedActions: { resume: !resumed } } };
      if (p === "/api/admin/campaigns/c43/resume" && method === "POST") {
        resumed += 1;
        return { status: 200, body: { campaignNumber: "EML-2026-00043", id: "c43", segment: "all", total: 4, sent: 4, failed: 0, adminCopySent: true, status: "completed", pending: 0, finished: true } };
      }
      return null;
    };
    const { ctx, page, errors } = await open(browser, { user: OWNER, override, width: 1440, height: 900 });
    await go(page, "/admin/communications", "[role=tab]");
    await page.getByRole("tab", { name: "Campaign" }).click();
    await page.waitForSelector("[data-campaign-composer]", { timeout: 8000 });
    await page.waitForTimeout(800);
    await page.getByLabel("Subject", { exact: true }).fill("S");
    await page.getByLabel("Message", { exact: true }).fill("B");
    await page.locator("[data-send-campaign]").click();
    await page.locator("[role=dialog] [data-confirm]").click();
    await page.waitForSelector("[role=dialog] [role=alert]", { timeout: 5000 }).catch(() => {});
    check("a failed send stays in the sheet with the server's message", /Email provider unavailable/.test(await page.locator("[role=dialog]").innerText()));
    await page.locator("[role=dialog] [data-confirm]").click();
    await page.waitForSelector("[data-campaign-progress]", { timeout: 8000 }).catch(() => {});
    check("retrying the same campaign reuses its idempotency key", keys.length === 2 && keys[0] === keys[1], keys.join(" , "));
    check("a duplicate answer is explained", (await page.locator("[data-duplicate]").count()) === 1);
    await page.waitForSelector("[data-resume]", { timeout: 6000 }).catch(() => {});
    check("a stopped campaign offers Resume", (await page.locator("[data-resume]").count()) === 1);
    await page.locator("[data-resume]").click();
    const rs = await page.locator("[role=dialog]").innerText();
    check("resume confirmation says nobody is emailed twice", /never emailed again/.test(rs) && /Resume sending to 3/.test(rs));
    await page.locator("[role=dialog] [data-confirm]").click();
    await page.waitForFunction(() => document.querySelector("[data-campaign-progress]")?.getAttribute("data-status") === "completed", null, { timeout: 8000 }).catch(() => {});
    check("resume posts once and the campaign completes", resumed === 1 && (await page.locator("[data-campaign-progress]").getAttribute("data-status")) === "completed", `resumed=${resumed}`);
    check("campaign failure/resume: no page errors", errors.length === 0, errors.join(" | "));
    await ctx.close();
  }

  {
    console.log("\n--- campaign: nothing sent when the admin copy fails ---");
    const override = (p, method) => {
      if (p === "/api/admin/campaigns/send" && method === "POST") return { status: 200, body: { campaignNumber: "EML-2026-00044", id: "c44", segment: "all", total: 4, sent: 0, failed: 0, adminCopySent: false, status: "failed", pending: 0, finished: true } };
      if (p === "/api/admin/campaigns/c44") return { status: 200, body: { campaign: { _id: "c44", campaignNumber: "EML-2026-00044", status: "failed", total: 4, sent: 0, failed: 0, pending: 0, adminCopySent: false, finished: true }, recentFailures: [], allowedActions: { resume: false } } };
      return null;
    };
    const { ctx, page, errors } = await open(browser, { user: OWNER, override, width: 390, height: 844 });
    await go(page, "/admin/communications", "[role=tab]");
    await page.getByRole("tab", { name: "Campaign" }).click();
    await page.waitForSelector("[data-campaign-composer]", { timeout: 8000 });
    await page.waitForTimeout(800);
    await page.getByLabel("Subject", { exact: true }).fill("S");
    await page.getByLabel("Message", { exact: true }).fill("B");
    await page.locator("[data-send-campaign]").click();
    await page.locator("[role=dialog] [data-confirm]").click();
    await page.waitForSelector("[data-nothing-sent]", { timeout: 6000 }).catch(() => {});
    check("admin copy failure says nothing went to customers", (await page.locator("[data-nothing-sent]").count()) === 1);
    check("admin copy failure: no page errors", errors.length === 0, errors.join(" | "));
    await ctx.close();
  }

  /* ---------------- team: disable -> future jobs -> reassign ---------------- */
  {
    console.log("\n--- team: disable and reassign ---");
    const { ctx, page, errors, api } = await open(browser, { user: OWNER, width: 390, height: 844 });
    await go(page, "/admin/team", "[data-employee]");
    await page.locator("[data-disable=fx1]").click();
    await page.waitForSelector("[role=dialog] [data-future-count]", { timeout: 6000 }).catch(() => {});
    const d1 = await page.locator("[role=dialog]").innerText();
    check("disable shows the count of future assigned jobs", /2 upcoming jobs are assigned to Field/.test(d1), d1.replace(/\s+/g, " ").slice(0, 200));
    check("disable lists the jobs", (await page.locator("[role=dialog] [data-future-jobs] li").count()) === 2);
    check("nothing changes before confirming", !api.some((a) => a.method === "PATCH"));
    await page.screenshot({ path: path.join(SHOTS, "team-disable-390x844.png") });
    await page.locator("[data-confirm-disable]").click();
    await page.waitForSelector("[data-reassign]", { timeout: 6000 }).catch(() => {});
    const patch = api.find((a) => a.method === "PATCH" && /\/fixters\/fx1\/status$/.test(a.path));
    check("disable calls PATCH /fixters/:id/status with isActive false", !!patch && patch.body && patch.body.isActive === false);
    check("after disabling, the sheet offers reassignment", (await page.locator("[data-reassign]").count()) === 1);
    check("only one dialog at a time", (await page.locator("[role=dialog]").count()) === 1);
    await page.locator("[data-reassign-target]").selectOption("fx2");
    await page.locator("[data-reassign]").click();
    await page.waitForSelector("[data-move-consequence]", { timeout: 4000 }).catch(() => {});
    const c = await page.locator("[data-move-consequence]").innerText();
    check("reassign has its own confirmation naming the target", /2 upcoming jobs move from Field to Second Fixter/.test(c), c);
    check("no reassignment before confirming", !api.some((a) => /reassign-future-jobs/.test(a.path)));
    await page.screenshot({ path: path.join(SHOTS, "team-reassign-confirm-390x844.png") });
    const move = page.locator("[data-confirm-move]");
    await move.click();
    await move.click({ force: true, timeout: 400 }).catch(() => {});
    await page.waitForSelector("[data-reassign-result]", { timeout: 6000 }).catch(() => {});
    const posts = api.filter((a) => /\/fixters\/fx1\/reassign-future-jobs$/.test(a.path));
    check("reassign posts once to the owner endpoint with the chosen Fixter", posts.length === 1 && posts[0].body.toFixterId === "fx2", JSON.stringify(posts.map((x) => x.body)));
    const r = await page.locator("[data-reassign-result]").innerText();
    check("result lists moved and failed jobs", /1 of 2 jobs moved/.test(r) && /No other Fixter is free/.test(r));
    await page.getByRole("button", { name: "Done" }).click();
    await page.waitForTimeout(300);
    /* typed-name delete */
    await page.getByRole("button", { name: "Edit Second Fixter" }).click();
    await page.getByRole("button", { name: /Delete this employee/ }).click();
    await page.waitForSelector("[data-confirm-delete]", { timeout: 4000 });
    check("delete is disabled until the name is typed", await page.locator("[data-confirm-delete]").isDisabled());
    await page.locator("[role=dialog] input").fill("wrong");
    check("a wrong name keeps delete disabled", await page.locator("[data-confirm-delete]").isDisabled());
    await page.locator("[role=dialog] input").fill("second");
    check("the first name (any case) enables delete", !(await page.locator("[data-confirm-delete]").isDisabled()));
    await page.keyboard.press("Escape");
    check("team: no page errors", errors.length === 0, errors.join(" | "));
    await ctx.close();
  }

  /* ---------------- tips: phone rows, desktop table, Fixter scope ---------------- */
  {
    console.log("\n--- tips layout ---");
    const phone = await open(browser, { user: OWNER, width: 390, height: 844 });
    await go(phone.page, "/admin/tips", "[data-tips]");
    check("phone: Fixters are rows", (await phone.page.locator("[data-fixter-tips]").filter({ visible: true }).count()) === 2);
    check("phone: the period table is hidden", !(await phone.page.locator("[data-tips-table]").isVisible()));
    await phone.page.locator("[data-fixter-tips] summary").first().click();
    check("phone: a Fixter row opens to its pay periods", (await phone.page.locator("[data-fixter-tips] details[open] li").count()) === PERIODS.length);
    check("phone: no sideways scroll", (await overflow(phone.page)).over === 0);
    await phone.ctx.close();
    const desk = await open(browser, { user: OWNER, width: 1440, height: 900 });
    await go(desk.page, "/admin/tips", "[data-tips]");
    check("desktop: the period table shows", await desk.page.locator("[data-tips-table]").isVisible());
    await desk.ctx.close();
    const fx = await open(browser, { user: FIELD, width: 390, height: 844 });
    await go(fx.page, "/admin/tips", "[data-tips]");
    check("Fixter: scope comes from the server", (await fx.page.locator("[data-tips][data-scope=fixter]").count()) === 1 && /Your tips/.test(await fx.page.locator("[data-tips]").innerText()));
    check("Fixter: no unassigned pile, no assign control", (await fx.page.locator("[data-unassigned-tips]").count()) === 0);
    await fx.ctx.close();
  }

  /* ---------------- recent work: no 1s ticker ---------------- */
  {
    console.log("\n--- recent work ticker ---");
    const { ctx, page, errors } = await open(browser, { user: OWNER, width: 1440, height: 900 });
    await go(page, "/admin/recent-work", "img");
    await page.waitForTimeout(2500);
    /* The site-wide FloatingCallButton polls at 700ms (not an admin component); the regression was a 1000ms re-render ticker. */
    const intervals = await page.evaluate(() => window.__intervals.filter((i) => i.ms === 1000));
    check("no 1s re-render ticker while a photo is scheduled", intervals.length === 0, JSON.stringify(intervals).slice(0, 300));
    check("recent work: no page errors", errors.length === 0, errors.join(" | "));
    await ctx.close();
  }

  /* ---------------- assistant ---------------- */
  {
    console.log("\n--- assistant ---");
    const { ctx, page, errors } = await open(browser, { user: OWNER, width: 390, height: 844 });
    await go(page, "/admin/assistant", "[data-view-toggle]");
    const t = await page.locator("body").innerText();
    check("assistant opens on the classic panel", (await page.locator("[data-view-toggle=office]").count()) === 1);
    check("the 3D office toggle is labelled optional", /Open the 3D office \(optional\)/.test(t));
    check("no automatic-promotion countdown", !/until it runs on its own|Will run on its own/.test(t));
    check("backend capability text is shown as sent", /Drafts a page for owner review/.test(t));
    check("assistant: no page errors", errors.length === 0, errors.join(" | "));
    await ctx.close();
  }

  /* ---------------- password sheet ---------------- */
  {
    console.log("\n--- password sheet ---");
    const { ctx, page, errors } = await open(browser, { user: OWNER, width: 390, height: 844 });
    await go(page, "/admin/tips", "[data-account-button]");
    await page.locator("[data-account-button]").click();
    await page.getByRole("menuitem", { name: "Change password" }).or(page.getByRole("button", { name: "Change password" })).first().click();
    await page.waitForSelector("[role=dialog] input[type=password]", { timeout: 5000 });
    const ac = await page.locator("[role=dialog] input[type=password]").evaluateAll((els) => els.map((e) => e.getAttribute("autocomplete")));
    check("password inputs carry current-password / new-password", ac.join(",") === "current-password,new-password", ac.join(","));
    const pw = page.locator("[role=dialog] input[type=password]");
    await pw.nth(0).fill("wrong-password");
    await pw.nth(1).fill("new-password-1");
    await page.locator("[role=dialog] footer button, [role=dialog] [data-sheet-footer] button").filter({ hasText: "Change password" }).last().click().catch(async () => page.getByRole("button", { name: "Change password" }).last().click());
    await page.waitForTimeout(800);
    check("a wrong password shows the error inline and keeps the sheet", (await page.locator("[role=dialog]").count()) === 1 && /incorrect/i.test(await page.locator("[role=dialog]").innerText()));
    await pw.nth(0).fill("right-password");
    await page.getByRole("button", { name: "Change password" }).last().click();
    await page.waitForTimeout(900);
    check("success closes the sheet", (await page.locator("[role=dialog] input[type=password]").count()) === 0);
    check("password: no page errors", errors.length === 0, errors.join(" | "));
    await ctx.close();
  }

  /* ---------------- kiosk untouched ---------------- */
  {
    console.log("\n--- event kiosk ---");
    countExternal = false;
    const { ctx, page, errors } = await open(browser, { user: null, width: 1440, height: 900 });
    const res = await page.goto(`${BASE}/event`, { waitUntil: "domcontentloaded" });
    await page.waitForTimeout(800);
    check("/event still serves", res && res.status() === 200);
    const r2 = await page.goto(`${BASE}/admin/event-display`, { waitUntil: "domcontentloaded" });
    await page.waitForTimeout(800);
    check("/admin/event-display still serves", r2 && r2.status() === 200);
    check("kiosk: no page errors", errors.length === 0, errors.join(" | "));
    await ctx.close();
    countExternal = true;
  }

  /* ---------------- overflow at 7 viewports + screenshots ---------------- */
  for (const s of SECTIONS) {
    console.log(`\n--- ${s.id}: viewports ---`);
    const bad = [];
    for (const v of VIEWPORTS) {
      const { ctx, page, errors } = await open(browser, { user: s.user, width: v.w, height: v.h, touch: v.touch });
      await go(page, s.route, s.ready);
      const o = await overflow(page);
      if (o.over > 0) bad.push(`${v.label}: +${o.over}px ${o.culprits.join("; ")}`);
      if (errors.length) bad.push(`${v.label}: errors ${errors.join(" | ")}`);
      if (v.label === "390x844" || v.label === "1440x900-desktop" || (s.id === "overview" && v.label === "320x568")) {
        await page.screenshot({ path: path.join(SHOTS, `${s.id}-${v.label}.png`) });
      }
      await ctx.close();
    }
    check(`${s.id}: no sideways overflow at 320-1440 and landscape`, bad.length === 0, bad.join(" || "));
  }

  check("no window.alert/confirm/prompt opened anywhere", DIALOGS.length === 0, DIALOGS.join(" | "));
  check("no request left the machine", EXTERNAL.length === 0, EXTERNAL.slice(0, 5).join(" | "));

  await browser.close();
  const failed = results.filter((r) => !r.pass);
  console.log(`\n${results.length - failed.length}/${results.length} passed`);
  process.exit(failed.length ? 1 : 0);
})().catch((e) => {
  console.error(e);
  process.exit(1);
});
