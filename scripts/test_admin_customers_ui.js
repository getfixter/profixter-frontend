/* eslint-disable @typescript-eslint/no-require-imports -- a plain Node script, like the other scripts/ */
/*
 * Admin Customers (track FE-CUST, 2026-11-13) in a real browser.
 *
 *   npx next start -p 3112          (after npm run build)
 *   npm run test:admin-customers    (or: node scripts/test_admin_customers_ui.js http://localhost:3112)
 *
 * FULL NETWORK JAIL: the local server passes; every URL with /api/ in its
 * path, on ANY host, is answered here by a small stateful fake of the BE-CUST
 * contract (reports/BE-CUST.md: lean rows, POST search, profile with
 * allowedActions, plan-change preview/confirm, cancellation, complimentary,
 * block, archive, notes, consent); everything else is aborted and recorded.
 * Fake people only (@example.test).
 *
 * What it pins:
 * - filters (All, Members, Payment issue, Ending, Blocked, Archived for the
 *   owner) in the URL, cursor paging, compact rows with plan state chips
 * - search mode: POST body only (never a URL), phone in any format, results
 *   directly under the field, Enter closes the keyboard, ?q= hand-off
 * - the profile: header, action row, every tab; Back keeps the list
 * - plan change: preview -> confirm with an idempotency key; expiry countdown;
 *   409 STALE re-previews automatically; a double tap confirms once
 * - complimentary: owner only, refused beside a live membership, reason +
 *   confirmation; cancellation needs its confirm step
 * - block / unblock need a reason and show history; archive and restore
 * - the unit: edit sheet splits it out, create sends it, copy prints it once
 * - the consent block: STOP banner, locked switch, Text action off
 * - no sideways overflow at 7 sizes, sheet close buttons on screen, 44px
 *   action targets, no text under 12px; screenshots
 */
const { chromium } = require("playwright");
const fs = require("fs");
const path = require("path");

const BASE = (process.argv[2] || "http://localhost:3112").replace(/\/$/, "");
const SHOTS = process.env.SHOTS_DIR || path.join(__dirname, "..", "..", "reports", "shots", "customers");
fs.mkdirSync(SHOTS, { recursive: true });

const OWNER = { _id: "owner1", userId: "PF-OWNER", name: "Owner Test", email: "owner@example.test", phone: "5550100", role: "admin", addresses: [] };
const STAFF = {
  _id: "st1",
  userId: "PF-ST",
  name: "Sam Staff",
  email: "sam@example.test",
  phone: "5550102",
  role: "employee",
  employeePosition: null,
  isActive: true,
  permissions: ["customers.manage", "members.read", "bookings.read", "bookings.write", "blacklist.manage", "projects.manage"],
  addresses: [],
};

const SIZES = [
  { name: "320x568", width: 320, height: 568 },
  { name: "375x667", width: 375, height: 667 },
  { name: "390x844", width: 390, height: 844 },
  { name: "430x932", width: 430, height: 932 },
  { name: "844x390-landscape", width: 844, height: 390, touch: true },
  { name: "820x1180-tablet", width: 820, height: 1180, touch: true },
  { name: "1440x900-desktop", width: 1440, height: 900, touch: false },
];

const results = [];
function check(name, pass, detail = "") {
  results.push({ name, pass: !!pass });
  console.log(`${pass ? "PASS" : "FAIL"}  ${name}${detail ? "  :: " + detail : ""}`);
}

/* ---------------------------------------------------------------- fixtures */

const iso = (d) => new Date(d).toISOString();
const inDays = (n) => iso(Date.now() + n * 86400000);

function address(over = {}) {
  return {
    id: "a0",
    label: "Primary",
    line1: "1 Demo St",
    unit: "",
    town: "Testville",
    state: "NY",
    zip: "11700",
    formatted: "1 Demo St, Testville, NY 11700",
    isDefault: true,
    plan: null,
    billingCycle: null,
    planStatus: "none",
    statusDetail: "",
    renewsAt: null,
    endsAt: null,
    currentPeriodEnd: null,
    cancelAt: null,
    complimentary: false,
    stripeManaged: false,
    ...over,
  };
}

function baseRows() {
  const rows = [];
  rows.push({
    id: "c1",
    userId: "20000001",
    name: "Casey Customer",
    phone: "(516) 555-0101",
    email: "casey@example.test",
    town: "Massapequa",
    addresses: [
      address({ id: "a1", line1: "12 Oak St", unit: "Apt 2", town: "Massapequa", zip: "11758", formatted: "12 Oak St, Apt 2, Massapequa, NY 11758", plan: "plus", billingCycle: "monthly", planStatus: "active", renewsAt: "2026-12-01T05:00:00.000Z", currentPeriodEnd: "2026-12-01T05:00:00.000Z", stripeManaged: true }),
      address({ id: "a2", label: "Beach house", line1: "40 Elm Ave", isDefault: false, town: "Babylon", zip: "11702", formatted: "40 Elm Ave, Babylon, NY 11702" }),
    ],
    blocked: false,
    archived: false,
    visitsCompleted: 4,
  });
  rows.push({ id: "c2", userId: "20000002", name: "Pat Pastdue", phone: "(631) 555-0202", email: "pat@example.test", town: "Islip", addresses: [address({ id: "b1", plan: "basic", billingCycle: "monthly", planStatus: "payment_issue", statusDetail: "past_due", stripeManaged: true })], blocked: false, archived: false, visitsCompleted: 1 });
  rows.push({ id: "c3", userId: "20000003", name: "Erin Ending", phone: "(631) 555-0303", email: "erin@example.test", town: "Bay Shore", addresses: [address({ id: "e1", plan: "premium", billingCycle: "annual", planStatus: "ending", endsAt: "2026-11-30T05:00:00.000Z", cancelAt: "2026-11-30T05:00:00.000Z", stripeManaged: true })], blocked: false, archived: false, visitsCompleted: 7 });
  rows.push({ id: "c4", userId: "20000004", name: "Bo Blocked", phone: "(631) 555-0404", email: "bo@example.test", town: "Lindenhurst", addresses: [address({ id: "k1" })], blocked: true, archived: false, visitsCompleted: 0 });
  for (let i = 5; i <= 60; i++) {
    rows.push({ id: `c${i}`, userId: `2000${String(i).padStart(4, "0")}`, name: `Test Customer ${i}`, phone: `(631) 555-${String(1000 + i)}`, email: `t${i}@example.test`, town: "Testville", addresses: [address({ id: `x${i}`, ...(i % 3 === 0 ? { plan: "basic", billingCycle: "monthly", planStatus: "active", renewsAt: inDays(20), stripeManaged: true } : {}) })], blocked: false, archived: false, visitsCompleted: i % 5 });
  }
  rows.push({ id: "c99", userId: "20000099", name: "Archie Archived", phone: "(631) 555-0999", email: "archie@example.test", town: "Amityville", addresses: [address({ id: "z1" })], blocked: false, archived: true, visitsCompleted: 2 });
  return rows;
}

function digitsOf(s) {
  let d = String(s || "").replace(/\D/g, "");
  if (d.length === 11 && d.startsWith("1")) d = d.slice(1);
  return d;
}

function makeState() {
  return {
    rows: baseRows(),
    calls: [],
    previews: 0,
    confirms: [],
    previewTtlMs: 10 * 60 * 1000,
    staleNext: false,
    confirmDelayMs: 0,
    cancellations: [],
    complimentary: [],
    blocks: [],
    unblocks: [],
    archives: [],
    unarchives: [],
    notes: [{ id: "n1", text: "Prefers morning visits.", authorName: "Owner Test", at: inDays(-3) }],
    patches: [],
    created: [],
    stop: false,
    billingDown: false,
    blockHistory: [],
  };
}

function allowedFor(who, row) {
  const owner = who === "owner";
  return {
    editProfile: true,
    editContact: owner,
    changePlan: true,
    scheduleCancellation: true,
    grantComplimentary: owner,
    sellMembership: true,
    createVisit: true,
    addNote: true,
    block: !row.blocked,
    unblock: row.blocked,
    archive: owner && !row.archived,
    unarchive: owner && row.archived,
    viewBilling: true,
    changeCommunication: true,
    // Only an account still waiting for its first password (BE gap fix).
    resendAccess: row.id === "c1",
  };
}

function profileOf(state, who, row) {
  return {
    customer: { id: row.id, userId: row.userId, name: row.name, firstName: row.name.split(" ")[0], lastName: row.name.split(" ").slice(1).join(" "), email: row.email, phone: `+1${digitsOf(row.phone)}`, phoneFormatted: row.phone, signupMethod: "web", customerSince: "2025-03-14T15:00:00.000Z", updatedAt: "2026-10-01T00:00:00.000Z", archivedAt: row.archived ? inDays(-1) : null },
    addresses: row.addresses.map((a) => ({ ...a, introVisitStatus: a.id === "a1" ? "consumed" : null, loyalty: a.planStatus === "active" ? { standing: "On track", standingKey: "on_track", countedMonths: 2, nextMilestone: 3, monthsRemaining: 1, nextReward: { headline: "A free Full Day" }, expectedDate: "2026-12-01T05:00:00.000Z", benefitsEarned: 0 } : null })),
    visits: {
      completed: row.visitsCompleted,
      next: { id: "bk1", bookingNumber: "#1201", date: inDays(5), service: "Handyman visit", status: "confirmed", accessType: "membership", bookingType: "membership", paymentState: null, addressId: "a1", address: "12 Oak St, Apt 2, Massapequa, NY 11758", assignedFixterName: "Field Fixter", href: "/admin/jobs/bk1" },
      last: { id: "bk0", bookingNumber: "#1100", date: inDays(-20), service: "Handyman visit", status: "completed", accessType: "membership", bookingType: "membership", paymentState: null, addressId: "a1", address: "12 Oak St, Apt 2, Massapequa, NY 11758", assignedFixterName: "Field Fixter", href: "/admin/jobs/bk0" },
    },
    flags: { blocked: row.blocked, blockedReason: row.blocked ? "Abusive calls" : undefined, phoneVerified: true, emailVerified: true, textsOk: !state.stop, offersByTextOk: false, archived: row.archived, hasStripeCustomer: true },
    blockHistory: state.blockHistory,
    notesCount: state.notes.length,
    allowedActions: allowedFor(who, row),
  };
}

function communicationState(state) {
  return {
    service: { email: { enabled: true, locked: null, changedAt: null, source: "" }, sms: { enabled: !state.stop, locked: state.stop ? "stopped" : null, changedAt: inDays(-40), source: "signup_web_form" } },
    marketing: {
      email: { enabled: true, locked: null, changedAt: null, source: "", delivery: { sending: true, reason: null } },
      sms: { enabled: true, locked: state.stop ? "stopped" : null, changedAt: inDays(-10), source: "admin", consent: { status: "needs_confirmation", basis: "", method: "phone_call", evidence: "", confirmRequestedAt: null }, delivery: { sending: false, reason: null } },
    },
  };
}

function legacyProfile(row) {
  return {
    profile: {
      _id: row.id, userId: row.userId, name: row.name, firstName: row.name.split(" ")[0], lastName: row.name.split(" ").slice(1).join(" "), email: row.email, phone: `+1${digitsOf(row.phone)}`,
      emailVerifiedAt: inDays(-100), phoneVerifiedAt: inDays(-100), emailIsAppleRelay: false, hasGoogle: false, hasApple: false, hasPassword: true, signInMethods: ["email", "phone"], stripeCustomer: true, updatedAt: "2026-10-01T00:00:00.000Z", defaultAddressId: row.addresses[0]?.id || null,
      // As the legacy profile route returns it: line1 still carries the unit, and unit on its own.
      addresses: row.addresses.map((a) => ({ _id: a.id, label: a.label, line1: [a.line1, a.unit].filter(Boolean).join(" "), unit: a.unit, city: a.town, state: a.state, zip: a.zip, county: "Nassau", placeId: "", isDefault: a.isDefault, introVisitStatus: null, hasHistory: true, hasActivePlan: a.planStatus === "active" })),
    },
    access: { canEditContact: true, canEditDetails: true },
  };
}

/* ------------------------------------------------------------- the jail */

async function open(browser, who, { width = 390, height = 844, touch, state = makeState(), fakeViewport = false } = {}) {
  const mobile = touch ?? width < 1024;
  const ctx = await browser.newContext({ viewport: { width, height }, isMobile: mobile, hasTouch: mobile, serviceWorkers: "block" });
  await ctx.addInitScript(() => {
    if (location.pathname.startsWith("/admin")) localStorage.setItem("token", "ui-token");
    window.__copied = [];
    try {
      Object.defineProperty(navigator, "clipboard", { value: { writeText: async (t) => void window.__copied.push(t) }, configurable: true });
    } catch {
      /* ignore */
    }
  });
  if (fakeViewport) {
    await ctx.addInitScript(() => {
      const vv = new EventTarget();
      let h = null;
      Object.defineProperties(vv, {
        height: { get: () => (h === null ? window.innerHeight : h) },
        width: { get: () => window.innerWidth },
        offsetTop: { get: () => 0 },
        offsetLeft: { get: () => 0 },
        pageTop: { get: () => window.scrollY },
        scale: { get: () => 1 },
      });
      Object.defineProperty(window, "visualViewport", { get: () => vv, configurable: true });
      window.__setKeyboard = (px) => {
        h = px ? window.innerHeight - px : null;
        vv.dispatchEvent(new Event("resize"));
      };
    });
  }
  const external = [];
  const local = new URL(BASE);
  await ctx.route("**/*", async (route) => {
    const req = route.request();
    const u = new URL(req.url());
    if (!u.pathname.includes("/api/")) {
      if (u.origin === local.origin) return route.continue();
      external.push(u.href);
      return route.abort();
    }
    const cors = { "access-control-allow-origin": "*", "access-control-allow-headers": "Authorization,Content-Type", "access-control-allow-methods": "GET,POST,PUT,PATCH,DELETE,OPTIONS" };
    if (req.method() === "OPTIONS") return route.fulfill({ status: 204, headers: cors });
    const json = (body, status = 200) => route.fulfill({ status, contentType: "application/json", headers: cors, body: JSON.stringify(body) });
    const p = u.pathname.replace(/^.*?(\/api\/)/, "/api/");
    const m = req.method();
    let body = {};
    try {
      body = JSON.parse(req.postData() || "{}");
    } catch {
      body = {};
    }
    state.calls.push({ m, p, url: u.href, body });
    const rowById = (id) => state.rows.find((r) => r.id === id);

    if (p === "/api/auth/me") return json(who === "owner" ? OWNER : STAFF);
    if (p === "/api/admin/needs-action") return json({ groups: [{ key: "members", count: 2, items: [] }] });

    /* lists */
    if (p === "/api/admin/customers" && m === "GET") {
      const filter = u.searchParams.get("filter") || "all";
      const live = (r) => r.addresses.some((a) => ["active", "trialing", "payment_issue", "ending"].includes(a.planStatus));
      const pick = {
        all: (r) => !r.archived,
        members: (r) => !r.archived && live(r),
        payment_issue: (r) => !r.archived && r.addresses.some((a) => a.planStatus === "payment_issue"),
        ending: (r) => !r.archived && r.addresses.some((a) => a.planStatus === "ending"),
        blocked: (r) => !r.archived && r.blocked,
        archived: (r) => r.archived,
      }[filter];
      if (!pick) return json({ message: "Invalid filter", code: "INVALID_FILTER" }, 400);
      const plan = u.searchParams.get("plan");
      if (plan && !["basic", "plus", "premium", "elite"].includes(plan)) return json({ message: "Unknown plan", code: "INVALID_PLAN" }, 400);
      const onPlan = (r) => !plan || r.addresses.some((a) => a.plan === plan && ["active", "trialing", "payment_issue", "ending"].includes(a.planStatus));
      const pickers = { all: (r) => !r.archived, members: (r) => !r.archived && live(r), payment_issue: (r) => !r.archived && r.addresses.some((a) => a.planStatus === "payment_issue"), ending: (r) => !r.archived && r.addresses.some((a) => a.planStatus === "ending"), blocked: (r) => !r.archived && r.blocked, archived: (r) => r.archived };
      const list = state.rows.filter((r) => pick(r) && onPlan(r));
      const first = !u.searchParams.get("cursor");
      const counts = first ? Object.fromEntries(Object.entries(pickers).filter(([k]) => k !== "archived" || who === "owner").map(([k, fn]) => [k, state.rows.filter((r) => fn(r) && onPlan(r)).length])) : null;
      const start = u.searchParams.get("cursor") === "p2" ? 50 : 0;
      const items = list.slice(start, start + 50);
      return json({ filter, plan: plan || null, items, nextCursor: start === 0 && list.length > 50 ? "p2" : null, counts });
    }
    if (p === "/api/admin/customers" && m === "POST") {
      state.created.push(body);
      return json({ customer: { id: "c200", userId: "20000200", name: `${body.firstName} ${body.lastName}`.trim(), email: body.email, phone: body.phone }, delivery: { email: "sent", sms: "not_requested" }, temporaryPasswordExpiresAt: inDays(3), warnings: [] }, 201);
    }
    if (p === "/api/admin/customers/search") {
      const q = String(body.q || "").trim().toLowerCase();
      const d = digitsOf(q);
      const wordsQ = q.split(/\s+/).filter(Boolean);
      const items = state.rows.filter((r) => {
        if (r.archived && !body.includeArchived) return false;
        if (d.length >= 4 && /^[\d\s()+.-]+$/.test(q)) return digitsOf(r.phone).includes(d);
        const hay = [r.name, r.email, r.town, ...r.addresses.map((a) => a.formatted)].join(" ").toLowerCase();
        return wordsQ.every((w) => hay.includes(w));
      });
      return json({ filter: body.filter || null, query: body.q, items: items.slice(0, 25) });
    }
    if (/^\/api\/admin\/customers\/[^/]+\/projects$/.test(p)) {
      const cid = p.split("/")[4];
      return json({ moneyVisible: who === "owner" || STAFF.permissions.includes("projects.manage"), items: cid === "c1" ? [{ id: "p1", projectNumber: "P-104", title: "Kitchen remodel", projectType: "Kitchen", status: "in_progress", derivedStage: { key: "in_progress", label: "In progress" }, executedValueCents: 1250000, paidCents: 400000, outstandingCents: 850000, createdAt: inDays(-30), href: "/admin/projects/p1" }] : [] });
    }
    if (p === "/api/admin/search") return json({ query: body.q, customers: [], jobs: [], projects: body.q === "casey@example.test" ? [{ id: "p1", projectNumber: "P-104", projectType: "Kitchen", customerName: "Casey Customer", status: "in_progress", address: "12 Oak St", href: "/admin/projects/p1" }] : [], scopes: { customers: true, jobs: "all", projects: true } });

    /* profile and its parts */
    let mm = /^\/api\/admin\/customers\/([^/]+)(\/.*)?$/.exec(p);
    if (mm) {
      const row = rowById(mm[1]);
      const rest = mm[2] || "";
      if (!row) return json({ message: "Customer not found", code: "NOT_FOUND" }, 404);
      if (!rest && m === "GET") return json(profileOf(state, who, row));
      if (rest === "/visits") return json({ items: [profileOf(state, who, row).visits.next, profileOf(state, who, row).visits.last, { ...profileOf(state, who, row).visits.last, id: "bk00", bookingNumber: "#1001", date: inDays(-60) }], nextCursor: null });
      if (rest === "/billing") {
        if (state.billingDown) return json({ available: false, reason: "stripe_unavailable" });
        return json({
          available: true,
          cachedAt: iso(Date.now()),
          customers: [{ id: "cus_test1", deleted: false, defaultPaymentMethod: { brand: "visa", last4: "4242", expMonth: 4, expYear: 2028 }, dashboardUrl: "https://dashboard.stripe.com/test/customers/cus_test1" }],
          subscriptions: [{ id: "sub_test1", status: "active", plan: "plus", billingCycle: "monthly", priceCents: 4900, addressId: "a1", cancelAtPeriodEnd: false, cancelAt: null, currentPeriodEnd: "2026-12-01T05:00:00.000Z", createdAt: inDays(-90), dashboardUrl: "https://dashboard.stripe.com/test/subscriptions/sub_test1" }],
          invoices: [{ id: "in_1", number: "PFX-0001", status: "paid", billingReason: "subscription_cycle", totalCents: 4900, amountDueCents: 4900, amountPaidCents: 4900, amountRemainingCents: 0, currency: "usd", createdAt: inDays(-12), periodStart: inDays(-12), periodEnd: inDays(18), attemptCount: 1, nextPaymentAttempt: null, subscriptionId: "sub_test1", dashboardUrl: "https://dashboard.stripe.com/test/invoices/in_1" }],
          payments: [{ id: "ch_1", paymentIntentId: "pi_1", amountCents: 4900, amountRefundedCents: 0, refunded: false, currency: "usd", status: "succeeded", paid: true, failureCode: null, failureMessage: null, description: "Subscription update", createdAt: inDays(-12), card: { brand: "visa", last4: "4242" }, dashboardUrl: "https://dashboard.stripe.com/test/payments/pi_1" }],
          upcoming: [{ customerId: "cus_test1", amountDueCents: 4900, currency: "usd", nextPaymentAttempt: "2026-12-01T05:00:00.000Z", periodEnd: "2026-12-01T05:00:00.000Z", subscriptionId: "sub_test1" }],
          refundsNote: "Refunds are made in Stripe.",
        });
      }
      if (rest === "/gifts") return json({ items: [{ id: "g1", giftNumber: "GIFT-7", role: "received", plan: "basic", durationMonths: 3, status: "claimed", purchaserName: "Gina Giver", recipientName: row.name, recipientEmail: row.email, addressId: "a1", purchasedAt: inDays(-200), claimedAt: inDays(-190) }] });
      if (rest === "/payment-links") return json({ items: [{ id: "pl1", kind: "membership", itemLabel: "Plus membership", status: "expired", plan: "plus", billingCycle: "monthly", addressId: "a1", bookingId: null, bookingNumber: null, sentVia: ["email", "sms"], expiresAt: inDays(-1), openedCount: 1, lastOpenedAt: inDays(-2), paidAt: null, createdAt: inDays(-4), createdByName: "Owner Test" }] });
      if (rest === "/notes" && m === "GET") return json({ items: state.notes });
      if (rest === "/notes" && m === "POST") {
        const note = { id: `n${state.notes.length + 1}`, text: body.text, authorName: who === "owner" ? "Owner Test" : "Sam Staff", at: iso(Date.now()) };
        state.notes.unshift(note);
        return json({ note }, 201);
      }
      if (rest === "/consent") {
        return json({
          switches: communicationState(state),
          evidence: {
            serviceSms: { enabled: !state.stop, at: inDays(-40), source: "signup_web_form" },
            marketingSms: { enabled: true, at: inDays(-10), source: "admin", method: "phone_call", evidence: "" },
            serviceEmail: { enabled: true, changedAt: null, source: "" },
            marketingEmail: { at: inDays(-40), source: "signup_web_form" },
          },
          stop: state.stop ? { phoneOptedOut: true, scope: "all", at: inDays(-2), source: "twilio_inbound" } : { phoneOptedOut: false, scope: "", at: null, source: "" },
          history: [{ id: "ce1", at: inDays(-40), channel: "sms", purpose: "service", action: "granted", source: "signup_web_form", method: "", evidence: "", consentText: "Texts about my visits", detail: "", recordedByName: "" }],
        });
      }
      if (rest === "/block" && m === "POST") {
        if (String(body.reason || "").trim().length < 3) return json({ message: "Say why.", code: "REASON_REQUIRED" }, 400);
        state.blocks.push(body);
        row.blocked = true;
        state.blockHistory.unshift({ id: `bl${state.blockHistory.length + 1}`, reason: body.reason, blockedAt: iso(Date.now()), blockedByName: "Sam Staff", liftedAt: null, liftedByName: "", liftReason: "", active: true });
        return json({ blocked: true, block: state.blockHistory[0], history: state.blockHistory }, 201);
      }
      if (rest === "/block" && m === "DELETE") {
        state.unblocks.push(body);
        row.blocked = false;
        state.blockHistory = state.blockHistory.map((b) => (b.active ? { ...b, active: false, liftedAt: iso(Date.now()), liftedByName: "Sam Staff", liftReason: body.reason || "" } : b));
        return json({ blocked: false, history: state.blockHistory });
      }
      if (rest === "/archive") {
        state.archives.push(body);
        row.archived = true;
        return json({ archived: true, archivedAt: iso(Date.now()) });
      }
      if (rest === "/unarchive") {
        state.unarchives.push(body);
        row.archived = false;
        return json({ archived: false });
      }
      mm = /^\/addresses\/([^/]+)\/(plan-change\/preview|plan-change\/confirm|cancellation|complimentary)$/.exec(rest);
      if (mm) {
        const [, addressId, action] = mm;
        if (action === "plan-change/preview") {
          state.previews += 1;
          return json({
            previewToken: `tok${state.previews}`,
            expiresAt: iso(Date.now() + state.previewTtlMs),
            changeType: "upgrade",
            current: { plan: "plus", cycle: "monthly", priceCents: 4900, status: "active", currentPeriodEnd: "2026-12-01T05:00:00.000Z" },
            requested: { plan: body.plan, cycle: body.cycle, priceCents: 7900 },
            amountDueNowCents: 1832,
            creditCents: 0,
            nextRenewalDate: "2026-12-01T05:00:00.000Z",
            nextRenewalAmountCents: 7900,
            effective: "now",
            warnings: [{ code: "CHARGES_NOW", message: "Stripe charges $18.32 now for the rest of this period." }],
            _addressId: addressId,
          });
        }
        if (action === "plan-change/confirm") {
          state.confirms.push(body);
          if (state.confirmDelayMs) await new Promise((r) => setTimeout(r, state.confirmDelayMs));
          if (!body.idempotencyKey) return json({ message: "Missing key", code: "IDEMPOTENCY_KEY_REQUIRED" }, 400);
          if (state.staleNext) {
            state.staleNext = false;
            return json({ message: "The membership changed since the preview. Preview the change again.", code: "STALE" }, 409);
          }
          return json({ message: "Upgraded to Premium. Stripe charged $18.32.", changeType: "upgrade", effective: "now", addressPlan: { plan: "premium", planStatus: "active" } });
        }
        if (action === "cancellation") {
          // Membership receipts: a key belongs to one customer + home (409 KEY_REUSED otherwise).
          state.keyTargets = state.keyTargets || new Map();
          const target = `${p.split("/")[4]}:${addressId}`;
          if (body.idempotencyKey && state.keyTargets.has(body.idempotencyKey) && state.keyTargets.get(body.idempotencyKey) !== target) {
            return json({ code: "KEY_REUSED", message: "This idempotency key was already used for a different customer or home. Nothing was changed." }, 409);
          }
          if (state.keyReusedNext) {
            state.keyReusedNext = false;
            return json({ code: "KEY_REUSED", message: "This idempotency key was already used for a different customer or home. Nothing was changed." }, 409);
          }
          if (state.pendingPlanChange && (body.mode === "date" || body.mode === "clear") && body.releasePendingPlanChange !== true) {
            state.cancellationRefusals = (state.cancellationRefusals || 0) + 1;
            return json({ code: "PENDING_PLAN_CHANGE", message: "A plan change is scheduled. Release it first.", pendingPlanChange: { plan: "basic", billingCycle: "monthly", effectiveDate: "2026-12-01T05:00:00.000Z" } }, 409);
          }
          if (body.idempotencyKey) state.keyTargets.set(body.idempotencyKey, target);
          state.cancellations.push({ addressId, ...body });
          return json({ message: "Cancellation scheduled for Dec 1.", before: { cancelAt: null, cancelAtPeriodEnd: false }, after: { cancelAt: "2026-12-01T05:00:00.000Z", cancelAtPeriodEnd: true }, addressPlan: { planStatus: "ending" } });
        }
        if (action === "complimentary") {
          if (who !== "owner") return json({ message: "Owner only.", code: "OWNER_ONLY" }, 403);
          state.complimentary.push({ addressId, ...body });
          return json({ message: "Complimentary Plus granted.", addressPlan: { planStatus: "active", complimentary: true } }, 201);
        }
      }
      if (rest === "/resend-access") return json({ delivery: { email: "sent", sms: "sent" }, temporaryPasswordExpiresAt: inDays(3) });
      return json({ message: "Not in the fake", code: "NOT_FOUND" }, 404);
    }

    /* legacy panels the profile mounts */
    mm = /^\/api\/admin\/users\/([^/]+)\/(.+)$/.exec(p);
    if (mm) {
      const row = rowById(mm[1]) || state.rows[0];
      const what = mm[2];
      if (what === "profile" && m === "GET") return json(legacyProfile(row));
      if (what === "profile" && m === "PATCH") {
        state.patches.push(body);
        return json({ message: "Customer updated.", changes: [{ field: "addresses", label: "Address changed", from: "", to: "" }], notices: [], user: { _id: row.id, name: row.name } });
      }
      if (what === "communication" && m === "GET") return json(communicationState(state));
      if (what === "communication" && m === "PUT") return json({ changed: true, state: communicationState(state) });
      if (what === "loyalty") return json({ programActive: true, programStartedAt: null, completedBookings: 4, addresses: [] });
      if (what === "activity") return json({ user: { _id: row.id }, limit: 10, total: 2, items: [{ id: "ac1", type: "subscription_created", title: "Membership started", description: "Plus · monthly", timestamp: inDays(-90), source: "stripe", actorName: "System", actorRole: "system", relatedBookingNumber: "", status: "active" }, { id: "ac2", type: "booking_status", title: "Visit completed", description: "", timestamp: inDays(-20), source: "booking", actorName: "Field Fixter", actorRole: "fixter", relatedBookingNumber: "1100", status: "completed" }], unavailableSources: [] });
      if (what === "reviewed-us") return json({ reviewedUs: null, lastAskedAt: null, canEdit: who === "owner" });
      if (what === "profile-history") return json({ items: [], masked: false });
      return json({});
    }
    if (p.startsWith("/api/admin/communications/customers/")) return json({ records: [] });
    if (p === "/api/admin/blacklist") return json([]);
    if (p === "/api/admin/users" || p === "/api/admin/members") return json([]);
    return json(p.includes("summary") || p.includes("settings") ? {} : []);
  });
  const page = await ctx.newPage();
  const errors = [];
  page.on("pageerror", (e) => errors.push(e.message));
  return { ctx, page, external, errors, state };
}

const noSideScroll = (page) => page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth + 1);
const callsTo = (state, re, method) => state.calls.filter((c) => re.test(c.p) && (!method || c.m === method));
const wait = (ms) => new Promise((r) => setTimeout(r, ms));
async function waitFor(fn, timeout = 8000) {
  const end = Date.now() + timeout;
  while (Date.now() < end) {
    if (await fn()) return true;
    await wait(100);
  }
  return false;
}
async function gotoList(page, query = "") {
  await page.goto(`${BASE}/admin/customers${query}`, { waitUntil: "domcontentloaded" });
  await page.waitForSelector("[data-customers-list] ul[role=list] li, [data-customers-list] [data-empty-state], [data-customers-list] .adm-empty", { timeout: 20000 }).catch(() => {});
}
async function openProfile(page, id = "c1", tab = "") {
  await page.goto(`${BASE}/admin/customers/${id}${tab ? `?tab=${tab}` : ""}`, { waitUntil: "domcontentloaded" });
  await page.waitForSelector(`[data-customer-profile="${id}"]`, { timeout: 20000 });
}
async function openMore(page) {
  await page.click('[data-profile-actions] [data-action="more"]');
  await page.waitForSelector('[role="menu"]', { timeout: 5000 });
}
async function menuItem(page, label) {
  await page.locator('[role="menu"] [role="menuitem"]', { hasText: label }).first().click();
}
async function closeVisible(page, selector) {
  return page.evaluate((sel) => {
    const sheet = document.querySelector(sel);
    const btn = sheet && sheet.querySelector("[data-sheet-close]");
    if (!btn) return { ok: false, why: "no close button" };
    const r = btn.getBoundingClientRect();
    return { ok: r.width >= 43.5 && r.height >= 43.5 && r.top >= 0 && r.left >= 0 && r.right <= window.innerWidth && r.bottom <= window.innerHeight, w: r.width, h: r.height, top: r.top, right: r.right };
  }, selector);
}
async function minFontPx(page, rootSel) {
  return page.evaluate((sel) => {
    const root = document.querySelector(sel);
    if (!root) return 0;
    let min = 99;
    const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT);
    while (walker.nextNode()) {
      const n = walker.currentNode;
      if (!n.textContent.trim()) continue;
      const el = n.parentElement;
      if (!el || el.closest(".sr-only") || !el.offsetParent) continue;
      const fs = parseFloat(getComputedStyle(el).fontSize);
      if (fs < min) min = fs;
    }
    return min;
  }, rootSel);
}

(async () => {
  const browser = await chromium.launch();

  /* ------------------------------------------------ filters and paging */
  console.log("\n--- filters, rows and paging ---");
  {
    const { ctx, page, state, errors, external } = await open(browser, "staff");
    await gotoList(page);
    const rows = await page.locator("[data-customers-list] ul[role=list] > li").count();
    check("All: first page of 50 rows from GET /api/admin/customers?filter=all", rows === 50 && callsTo(state, /^\/api\/admin\/customers$/, "GET").some((c) => c.url.includes("filter=all")), `rows=${rows}`);
    const rowBox = await page.locator("[data-customers-list] ul[role=list] > li").first().boundingBox();
    check("rows are compact (64-72px)", rowBox && rowBox.height >= 64 && rowBox.height <= 72, `h=${rowBox && rowBox.height}`);
    const first = await page.locator("[data-customers-list] ul[role=list] > li").first().innerText();
    check("row: name, phone as text, town and 'Plus · renews Dec 1'", /Casey Customer/.test(first) && /\(516\) 555-0101/.test(first) && /Massapequa/.test(first) && /Plus · renews Dec 1/.test(first), first.replace(/\n/g, " | "));
    check("no buttons inside rows (no money or destructive controls)", (await page.locator("[data-customers-list] ul[role=list] > li button").count()) === 0);
    check("staff: no Archived filter", (await page.locator('[data-customers-list] .adm-filterbar a', { hasText: "Archived" }).count()) === 0);
    await page.click('[data-action="load-more"]');
    await waitFor(async () => (await page.locator("[data-customers-list] ul[role=list] > li").count()) > 50);
    const after = await page.locator("[data-customers-list] ul[role=list] > li").count();
    check("Show more loads the next page with the cursor", after === 60 && callsTo(state, /^\/api\/admin\/customers$/, "GET").some((c) => c.url.includes("cursor=p2")), `rows=${after}`);
    check("no Show more after the last page", (await page.locator('[data-action="load-more"]').count()) === 0);

    for (const [label, filter, expectText] of [
      ["Members", "members", /Casey Customer/],
      ["Payment issue", "payment_issue", /Payment issue/],
      ["Ending", "ending", /Premium · ends Nov 30/],
      ["Blocked", "blocked", /Blocked/],
    ]) {
      await page.locator(".adm-filterbar a", { hasText: label }).first().click();
      await page.waitForURL((u) => u.search.includes(`filter=${filter}`), { timeout: 8000 }).catch(() => {});
      await waitFor(async () => callsTo(state, /^\/api\/admin\/customers$/, "GET").some((c) => c.url.includes(`filter=${filter}`)) && (await page.locator("[data-customers-list] ul[role=list] > li").count()) > 0);
      const text = await page.locator("[data-customers-list] ul[role=list]").first().innerText().catch(() => "");
      check(`${label}: ?filter=${filter} in the URL and its own server list`, page.url().includes(`filter=${filter}`) && expectText.test(text), text.slice(0, 80).replace(/\n/g, " | "));
    }
    check("filters: no page errors, nothing left the machine", !errors.length && !external.length, errors.concat(external).join("; "));
    await ctx.close();
  }
  /* per-filter counts and the plan filter (backend gap fix) */
  {
    const { ctx, page, state, errors } = await open(browser, "staff");
    await gotoList(page, "?filter=members");
    await page.waitForSelector("[data-customers-list] ul[role=list] > li", { timeout: 15000 });
    const chipText = async (label) => (await page.locator(".adm-filterbar a", { hasText: label }).first().innerText()).replace(/\s+/g, " ");
    const live = (r) => !r.archived && r.addresses.some((a) => ["active", "trialing", "payment_issue", "ending"].includes(a.planStatus));
    const expected = { All: state.rows.filter((r) => !r.archived).length, Members: state.rows.filter(live).length, "Payment issue": 1, Ending: 1, Blocked: 1 };
    const shown = {};
    for (const label of Object.keys(expected)) shown[label] = await chipText(label);
    check("chips show the server's per-filter totals", Object.entries(expected).every(([label, n]) => shown[label].includes(String(n))), JSON.stringify(shown));
    const line = await page.locator("[data-list-count]").innerText();
    check("the count line shows the exact total, not the loaded rows", line.includes(`${expected.Members} customers`), line);
    await page.locator('[aria-label="Plan filter"] a', { hasText: "Basic" }).click();
    await page.waitForURL((u) => u.search.includes("plan=basic"), { timeout: 8000 }).catch(() => {});
    await waitFor(async () => callsTo(state, /^\/api\/admin\/customers$/, "GET").some((c) => c.url.includes("plan=basic")));
    await page.waitForTimeout(300);
    const basicRows = state.rows.filter((r) => live(r) && r.addresses.some((a) => a.plan === "basic"));
    const listText = await page.locator("[data-customers-list] ul[role=list]").first().innerText();
    const call = callsTo(state, /^\/api\/admin\/customers$/, "GET").filter((c) => c.url.includes("plan=basic")).pop();
    check("plan filter: ?plan=basic in the URL and sent to the server with the filter", page.url().includes("plan=basic") && page.url().includes("filter=members") && call && call.url.includes("filter=members"), page.url());
    check("plan filter: only Basic members listed", /Pat Pastdue/.test(listText) && !/Casey Customer/.test(listText) && (await page.locator("[data-customers-list] ul[role=list] > li").count()) === basicRows.length, `${basicRows.length} expected`);
    check("plan filter: the count line names the plan", /on Basic/.test(await page.locator("[data-list-count]").innerText()));
    await page.locator(".adm-filterbar a", { hasText: "Payment issue" }).first().click();
    await page.waitForURL((u) => u.search.includes("filter=payment_issue"), { timeout: 8000 }).catch(() => {});
    check("plan filter carries over to Payment issue", page.url().includes("plan=basic"), page.url());
    await page.locator('[aria-label="Plan filter"] a', { hasText: "Any plan" }).click();
    await page.waitForURL((u) => !u.search.includes("plan="), { timeout: 8000 }).catch(() => {});
    check("Any plan clears it", !page.url().includes("plan="), page.url());
    check("counts/plan: no page errors", !errors.length, errors.join("; "));
    await ctx.close();
  }
  {
    const { ctx, page, state } = await open(browser, "owner");
    await gotoList(page, "?filter=archived");
    const text = await page.locator("[data-customers-list] ul[role=list]").first().innerText().catch(() => "");
    check("owner: Archived filter lists archived customers", /Archie Archived/.test(text) && callsTo(state, /^\/api\/admin\/customers$/, "GET").some((c) => c.url.includes("filter=archived")));
    await ctx.close();
  }

  /* ------------------------------------------------------------ search */
  console.log("\n--- search mode ---");
  {
    const { ctx, page, state } = await open(browser, "staff", { fakeViewport: true });
    await gotoList(page);
    for (const q of ["(516) 555-0101", "5165550101", "+1 516 555 0101", "516.555.0101", "0101"]) {
      await page.fill("input[type=search]", q);
      await waitFor(async () => callsTo(state, /\/api\/admin\/customers\/search$/).some((c) => c.body.q === q));
      await page.waitForSelector("[data-search-results] ul li", { timeout: 6000 }).catch(() => {});
      const text = await page.locator("[data-search-results]").innerText().catch(() => "");
      check(`search "${q}" finds the customer (POST body)`, /Casey Customer/.test(text), text.slice(0, 60).replace(/\n/g, " | "));
    }
    const leaked = state.calls.some((c) => /0101|516/.test(decodeURIComponent(c.url)) && c.m === "GET");
    check("search text never sent in a URL", !leaked && !page.url().includes("0101"));
    check("search mode hides the filter chips", (await page.locator("[data-customers-list] .adm-filterbar").count()) === 0);
    const gap = await page.evaluate(() => {
      const f = document.querySelector("[data-customers-list] input[type=search]").getBoundingClientRect();
      const r = document.querySelector("[data-search-results] ul li");
      return r ? r.getBoundingClientRect().top - f.bottom : 999;
    });
    check("results sit directly under the field", gap >= 0 && gap < 40, `gap=${gap}`);
    await page.evaluate(() => window.__setKeyboard(320));
    await page.waitForTimeout(200);
    const visible = await page.evaluate(() => {
      const r = document.querySelector("[data-search-results] ul li");
      return r ? r.getBoundingClientRect().bottom <= window.visualViewport.height : false;
    });
    check("with the keyboard up the first result is above it", visible);
    await page.focus("input[type=search]");
    await page.keyboard.press("Enter");
    check("Enter closes the keyboard (field blurs)", await page.evaluate(() => document.activeElement?.type !== "search"));
    await page.evaluate(() => window.__setKeyboard(0));
    await page.fill("input[type=search]", "massapequa casey");
    await waitFor(async () => callsTo(state, /\/api\/admin\/customers\/search$/).some((c) => c.body.q === "massapequa casey"));
    await page.waitForTimeout(300);
    check("multi-word search goes to the server as typed", /Casey Customer/.test(await page.locator("[data-search-results]").innerText()));
    await page.screenshot({ path: path.join(SHOTS, "search-390x844.png") });
    await ctx.close();
  }
  {
    const { ctx, page, state } = await open(browser, "staff");
    await page.goto(`${BASE}/admin?tab=users&q=casey%40example.test`, { waitUntil: "domcontentloaded" });
    await page.waitForURL((u) => u.pathname === "/admin/customers", { timeout: 15000 }).catch(() => {});
    await waitFor(async () => callsTo(state, /\/api\/admin\/customers\/search$/).some((c) => c.body.q === "casey@example.test"));
    check("old ?q= link: handed to search (POST), never back in the URL", (await page.inputValue("input[type=search]")) === "casey@example.test" && !page.url().includes("casey") && callsTo(state, /\/api\/admin\/customers\/search$/).some((c) => c.body.q === "casey@example.test"));
    await ctx.close();
  }

  /* ----------------------------------------------------------- profile */
  console.log("\n--- profile and tabs ---");
  {
    const { ctx, page, state, errors } = await open(browser, "staff");
    await gotoList(page);
    await page.locator('[data-customers-list] a[href="/admin/customers/c1"]').click();
    await page.waitForSelector('[data-customer-profile="c1"]', { timeout: 15000 });
    check("row opens /admin/customers/c1", new URL(page.url()).pathname === "/admin/customers/c1");
    const header = await page.locator("[data-customer-profile] header").innerText();
    check("header: name, chips, next/last visit, visits done, customer since", /Casey Customer/.test(header) && /Plus · renews Dec 1/.test(header) && /Phone verified/.test(header) && /Next visit/i.test(header) && /Last visit/i.test(header) && /Visits done/i.test(header) && /Customer since/i.test(header) && /Mar 14, 2025/.test(header), header.replace(/\n/g, " | ").slice(0, 200));
    const actions = await page.locator("[data-profile-actions] > *").allInnerTexts();
    check("action row: Call · Text · Email · Copy · Visit · More", actions.map((t) => t.trim()).join(",") === "Call,Text,Email,Copy,Visit,More", actions.join(","));
    const sizes = await page.locator("[data-profile-actions] > *").evaluateAll((els) => els.map((e) => e.getBoundingClientRect().height));
    check("action targets are at least 44px", sizes.every((h) => h >= 44), sizes.join(","));
    check("Call is a tel: link with the number", (await page.getAttribute('[data-action="call"]', "href")) === "tel:+15165550101");
    for (const [tab, re] of [
      ["visits", /Upcoming[\s\S]*#1201[\s\S]*Past/],
      ["billing", /Memberships[\s\S]*Billing from Stripe[\s\S]*Invoices[\s\S]*Gifts[\s\S]*Payment links/],
      ["messages", /Messages & consent[\s\S]*Service messages[\s\S]*Marketing messages/i],
      ["projects", /P-104/],
      ["activity", /Membership started/],
      ["notes", /Prefers morning visits[\s\S]*Owner Test/],
      ["overview", /Homes[\s\S]*12 Oak St, Apt 2, Massapequa, NY 11758[\s\S]*Internal notes/],
    ]) {
      await page.locator(`[data-customer-profile] a[data-tab]`, { hasText: { visits: "Visits", billing: "Membership", messages: "Messages", projects: "Projects", activity: "Activity", notes: "Notes", overview: "Overview" }[tab] }).first().click();
      await page.waitForSelector(`[data-tab-panel="${tab}"]`, { timeout: 8000 }).catch(() => {});
      await page.waitForTimeout(400);
      const text = await page.locator(`[data-tab-panel="${tab}"]`).innerText().catch(() => "");
      check(`tab ${tab}: shown, in the URL`, re.test(text) && (tab === "overview" ? !page.url().includes("tab=") : page.url().includes(`tab=${tab}`)), text.slice(0, 120).replace(/\n/g, " | "));
    }
    check("projects tab reads GET /customers/:id/projects (by customerId), not a text search", callsTo(state, /^\/api\/admin\/customers\/c1\/projects$/, "GET").length >= 1 && callsTo(state, /^\/api\/admin\/search$/).length === 0);
    await page.goto(`${BASE}/admin/customers/c1?tab=projects`, { waitUntil: "domcontentloaded" });
    await page.waitForSelector("[data-customer-projects] li", { timeout: 8000 }).catch(() => {});
    const projText = await page.locator("[data-tab-panel=projects]").innerText().catch(() => "");
    check("projects tab: stage label and money (projects.manage)", /In progress/.test(projText) && /\$12,500/.test(projText) && /\$8,500 outstanding/.test(projText) && (await page.locator('[data-customer-projects] a[href="/admin/projects/p1"]').count()) === 1, projText.replace(/\n/g, " | ").slice(0, 160));
    await page.goto(`${BASE}/admin/customers/c1`, { waitUntil: "domcontentloaded" });
    await page.waitForSelector('[data-tab-panel="overview"] [data-copy="address"]', { timeout: 10000 });
    await page.click('[data-tab-panel="overview"] [data-copy="address"]');
    const copied = await page.evaluate(() => window.__copied.slice(-1)[0]);
    check("Copy address prints the unit once (formatter)", copied === "12 Oak St, Apt 2, Massapequa, NY 11758", copied);
    await page.click('[data-tab-panel="overview"] >> text=Loyalty progress and benefits').catch(() => {});
    check("visits tab rows open the job", (await page.goto(`${BASE}/admin/customers/c1?tab=visits`).then(() => page.waitForSelector('[data-tab-panel="visits"] a[href="/admin/jobs/bk1"]', { timeout: 8000 }).then(() => true).catch(() => false))));
    // notes: add with author/time
    await openProfile(page, "c1", "notes");
    await page.fill('[data-input="note"]', "Gate code 4411.");
    await page.click('[data-action="add-note"]');
    await waitFor(async () => /Gate code 4411/.test(await page.locator('[data-tab-panel="notes"]').innerText()));
    const notes = await page.locator('[data-tab-panel="notes"] [data-note]').first().innerText();
    check("notes: added note shows first with author and time", /Gate code 4411/.test(notes) && /Sam Staff/.test(notes) && callsTo(state, /\/notes$/, "POST").length === 1, notes.replace(/\n/g, " | "));
    // back keeps the list
    await gotoList(page);
    await page.click('[data-action="load-more"]');
    await waitFor(async () => (await page.locator("[data-customers-list] ul[role=list] > li").count()) > 50);
    const listCalls = callsTo(state, /^\/api\/admin\/customers$/, "GET").length;
    await page.locator('[data-customers-list] a[href="/admin/customers/c30"]').scrollIntoViewIfNeeded();
    const yBefore = await page.evaluate(() => window.scrollY);
    await page.locator('[data-customers-list] a[href="/admin/customers/c30"]').click();
    await page.waitForSelector('[data-customer-profile="c30"]', { timeout: 15000 });
    await page.click('[data-action="back-to-list"]');
    await page.waitForURL((u) => u.pathname === "/admin/customers", { timeout: 8000 }).catch(() => {});
    await page.waitForTimeout(300);
    const kept = await page.locator("[data-customers-list] ul[role=list] > li").count();
    const yAfter = await page.evaluate(() => window.scrollY);
    check("Back to the list keeps loaded pages (no reload) and the scroll position", kept === 60 && callsTo(state, /^\/api\/admin\/customers$/, "GET").length === listCalls && Math.abs(yAfter - yBefore) < 30, `rows=${kept} y ${yBefore}->${yAfter}`);
    check("profile: no page errors", !errors.length, errors.join("; "));
    await ctx.close();
  }

  /* -------------------------------------------------- plan change flows */
  console.log("\n--- plan change: preview, confirm, expiry, STALE, double tap ---");
  {
    const { ctx, page, state, errors } = await open(browser, "staff");
    await openProfile(page, "c1", "billing");
    await page.click('[data-tab-panel="billing"] [data-action="change-plan"]');
    await page.waitForSelector('[data-sheet="change-plan"]');
    check("Change plan is a sheet with choices, never a dropdown", (await page.locator('[data-sheet="change-plan"] select').count()) === 0 && (await page.locator('[data-sheet="change-plan"] input[type=radio][name=plan]').count()) === 4);
    const close = await closeVisible(page, '[data-sheet="change-plan"]');
    check("plan sheet: close button visible and 44px", close.ok, JSON.stringify(close));
    check("current plan + cycle is not selectable", await page.locator('[data-sheet="change-plan"] input[name=plan][value=plus]').isDisabled());
    await page.locator('[data-sheet="change-plan"] input[name=plan][value=premium]').check({ force: true });
    await page.click('[data-action="preview-plan"]');
    await page.waitForSelector("[data-plan-preview]");
    const pv = await page.locator("[data-plan-preview]").innerText();
    check("preview: current vs new, charged now, takes effect, next renewal, warnings, countdown", /Current[\s\S]*Plus · monthly[\s\S]*New[\s\S]*Premium · monthly[\s\S]*Takes effect[\s\S]*Now[\s\S]*Charged now[\s\S]*\$18\.32[\s\S]*Next renewal[\s\S]*Dec 1[\s\S]*\$79/.test(pv) && /Stripe charges \$18\.32 now/.test(pv) && /valid for 9:5\d|valid for 10:00/.test(pv), pv.replace(/\n/g, " | "));
    check("preview request carried plan and cycle", callsTo(state, /plan-change\/preview$/).slice(-1)[0]?.body?.plan === "premium" && callsTo(state, /plan-change\/preview$/).slice(-1)[0]?.body?.cycle === "monthly");
    check("confirm button repeats the money: 'Charge $18.32 and upgrade'", /Charge \$18\.32 and upgrade/.test(await page.innerText('[data-action="confirm-plan"]')));
    // double tap
    state.confirmDelayMs = 700;
    await page.locator('[data-action="confirm-plan"]').dblclick();
    await page.locator('[data-action="confirm-plan"]').click({ timeout: 300 }).catch(() => {});
    await waitFor(async () => (await page.locator('[data-sheet="change-plan"]').count()) === 0, 6000);
    check("double tap: one confirm request, with previewToken and an idempotency key", state.confirms.length === 1 && state.confirms[0].previewToken === "tok1" && /^[0-9a-f-]{36}$/.test(state.confirms[0].idempotencyKey || ""), JSON.stringify(state.confirms));
    const toast = await page.waitForSelector("[data-toast]", { timeout: 4000 }).then((el) => el.innerText()).catch(() => "");
    check("success toast says what the server said", /Upgraded to Premium/.test(toast), toast);
    state.confirmDelayMs = 0;

    // STALE: re-preview automatically, then confirm with a fresh key
    state.staleNext = true;
    await page.click('[data-tab-panel="billing"] [data-action="change-plan"]');
    await page.locator('[data-sheet="change-plan"] input[name=plan][value=elite]').check({ force: true });
    await page.click('[data-action="preview-plan"]');
    await page.waitForSelector("[data-plan-preview]");
    const previewsBefore = state.previews;
    await page.click('[data-action="confirm-plan"]');
    await waitFor(async () => state.previews === previewsBefore + 1);
    await page.waitForTimeout(300);
    const staleText = await page.locator("[data-plan-preview]").innerText().catch(() => "");
    check("409 STALE: previewed again automatically with an explanation", state.previews === previewsBefore + 1 && /membership changed since the preview[\s\S]*nothing was charged/i.test(staleText), staleText.slice(0, 160).replace(/\n/g, " | "));
    await page.click('[data-action="confirm-plan"]');
    await waitFor(async () => (await page.locator('[data-sheet="change-plan"]').count()) === 0, 6000);
    const [k1, k2] = state.confirms.slice(-2).map((c) => c.idempotencyKey);
    check("after STALE the new preview confirms with its own token and key", state.confirms.slice(-1)[0].previewToken === `tok${state.previews}` && k1 && k2 && k1 !== k2, JSON.stringify(state.confirms.slice(-2)));

    // expiry
    state.previewTtlMs = 2500;
    await page.click('[data-tab-panel="billing"] [data-action="change-plan"]');
    await page.locator('[data-sheet="change-plan"] input[name=plan][value=premium]').check({ force: true });
    await page.click('[data-action="preview-plan"]');
    await page.waitForSelector("[data-preview-countdown]");
    await page.waitForSelector("[data-preview-expired]", { timeout: 6000 }).catch(() => {});
    check("preview expiry: countdown runs out, confirm is replaced by Preview again", (await page.locator("[data-preview-expired]").count()) === 1 && (await page.locator('[data-action="confirm-plan"]').count()) === 0 && (await page.locator('[data-action="repreview"]').count()) === 1);
    const confirmsBefore = state.confirms.length;
    state.previewTtlMs = 10 * 60 * 1000;
    await page.click('[data-action="repreview"]');
    await page.waitForSelector('[data-action="confirm-plan"]', { timeout: 5000 }).catch(() => {});
    check("Preview again gets a fresh preview; nothing was confirmed meanwhile", state.confirms.length === confirmsBefore && (await page.locator('[data-action="confirm-plan"]').count()) === 1);
    await page.click('[data-sheet="change-plan"] [data-sheet-close]');
    check("plan flows: no page errors", !errors.length, errors.join("; "));
    await ctx.close();
  }

  /* --------------------------------------------- cancellation, complimentary */
  console.log("\n--- cancellation and complimentary ---");
  {
    const { ctx, page, state } = await open(browser, "staff");
    await openProfile(page, "c1", "billing");
    await page.click('[data-tab-panel="billing"] [data-action="cancellation"]');
    await page.waitForSelector('[data-sheet="cancellation"]');
    await page.locator('[data-sheet="cancellation"] input[name=cancel-mode][value=period_end]').check({ force: true });
    await page.click('[data-action="review-cancellation"]');
    await page.waitForSelector("[data-cancel-confirm]");
    const text = await page.locator("[data-cancel-confirm]").innerText();
    check("cancellation: a confirm step says what will happen, no refund", /ends at the end of the period already paid, on Dec 1/.test(text) && /does not refund/.test(text) && state.cancellations.length === 0, text.replace(/\n/g, " | "));
    await page.click('[data-action="confirm-cancellation"]');
    await waitFor(async () => state.cancellations.length === 1);
    const c = state.cancellations[0] || {};
    check("cancellation POST: mode, confirm:true, idempotency key", c.mode === "period_end" && c.confirm === true && /^[0-9a-f-]{36}$/.test(c.idempotencyKey || "") && c.addressId === "a1", JSON.stringify(c));
    await page.waitForTimeout(200);
    await openMore(page);
    const items = await page.locator('[role="menu"] [role="menuitem"]').allInnerTexts();
    check("staff: no Complimentary or Archive in More (allowedActions)", !items.some((t) => /Complimentary|Archive/.test(t)) && items.some((t) => /Block/.test(t)), items.join(" / "));
    check("Resend sign-in details shows when allowedActions.resendAccess is true", items.some((t) => /Resend sign-in details/.test(t)), items.join(" / "));
    await page.keyboard.press("Escape");
    await openProfile(page, "c2");
    await openMore(page);
    const items2 = await page.locator('[role="menu"] [role="menuitem"]').allInnerTexts();
    check("...and is hidden when it is false (the customer has a password)", !items2.some((t) => /Resend sign-in details/.test(t)) && items2.some((t) => /Block/.test(t)), items2.join(" / "));
    await page.keyboard.press("Escape");
    await ctx.close();
  }
  /* review fixes: a pending plan change blocks a dated cancellation until it is dropped; KEY_REUSED */
  {
    const state = makeState();
    state.pendingPlanChange = true;
    const { ctx, page } = await open(browser, "staff", { state });
    await openProfile(page, "c1", "billing");
    await page.click('[data-tab-panel="billing"] [data-action="cancellation"]');
    await page.waitForSelector('[data-sheet="cancellation"]');
    await page.locator('[data-sheet="cancellation"] input[name=cancel-mode][value=date]').check({ force: true });
    const day = new Date(Date.now() + 10 * 86400000).toISOString().slice(0, 10);
    await page.locator('[data-sheet="cancellation"] input[type=date]').fill(day);
    await page.click('[data-action="review-cancellation"]');
    await page.waitForSelector("[data-cancel-confirm]");
    await page.click('[data-action="confirm-cancellation"]');
    await page.waitForSelector("[data-pending-plan-change]", { timeout: 6000 }).catch(() => {});
    const note = await page.locator("[data-pending-plan-change]").innerText().catch(() => "");
    check("PENDING_PLAN_CHANGE: the sheet says a plan change is scheduled and will be dropped", /Basic/.test(note) && /scheduled/.test(note) && /dropped/.test(note) && state.cancellations.length === 0, note.replace(/\s+/g, " "));
    check("...and offers a confirmed retry, not the plain button", (await page.locator('[data-action="confirm-release-plan-change"]').count()) === 1 && (await page.locator('[data-action="confirm-cancellation"]').count()) === 0);
    await page.click('[data-action="confirm-release-plan-change"]');
    await waitFor(async () => state.cancellations.length === 1);
    const c = state.cancellations[0] || {};
    check("the retry sends releasePendingPlanChange:true with a fresh key", c.releasePendingPlanChange === true && c.mode === "date" && c.date === day && /^[0-9a-f-]{36}$/.test(c.idempotencyKey || ""), JSON.stringify(c));
    await ctx.close();
  }
  {
    const state = makeState();
    const { ctx, page } = await open(browser, "staff", { state });
    await openProfile(page, "c1", "billing");
    await page.click('[data-tab-panel="billing"] [data-action="cancellation"]');
    await page.waitForSelector('[data-sheet="cancellation"]');
    await page.locator('[data-sheet="cancellation"] input[name=cancel-mode][value=period_end]').check({ force: true });
    await page.click('[data-action="review-cancellation"]');
    await page.waitForSelector("[data-cancel-confirm]");
    state.keyReusedNext = true;
    await page.click('[data-action="confirm-cancellation"]');
    await page.waitForSelector('[data-cancel-confirm] [role="alert"]', { timeout: 6000 }).catch(() => {});
    const msg = await page.locator('[data-cancel-confirm] [role="alert"]').innerText().catch(() => "");
    check("KEY_REUSED: says nothing was changed", /Nothing was changed/.test(msg) && state.cancellations.length === 0, msg);
    const firstKey = (state.calls.filter((x) => /\/cancellation$/.test(x.p)).pop() || {}).body?.idempotencyKey;
    await page.click('[data-action="confirm-cancellation"]');
    await waitFor(async () => state.cancellations.length === 1);
    check("the next attempt uses a fresh key and goes through", state.cancellations.length === 1 && state.cancellations[0].idempotencyKey !== firstKey, `${firstKey} -> ${state.cancellations[0]?.idempotencyKey}`);
    await ctx.close();
  }
  {
    const { ctx, page, state } = await open(browser, "owner");
    await openProfile(page, "c1", "billing");
    await page.locator('[data-home="a1"] [data-action="complimentary"]').click();
    await page.waitForSelector('[data-sheet="complimentary"]');
    check("complimentary beside a live membership: disabled with the reason", (await page.locator("[data-comp-disabled]").count()) === 1 && (await page.locator('[data-action="review-complimentary"]').isDisabled()));
    await page.locator('[data-sheet="complimentary"] input[name=comp-home][value=a2]').check({ force: true });
    await page.locator('[data-sheet="complimentary"] input[name=comp-plan][value=plus]').check({ force: true });
    check("complimentary needs a reason first", await page.locator('[data-action="review-complimentary"]').isDisabled());
    await page.fill('[data-sheet="complimentary"] textarea', "Thank-you for the referral program pilot");
    check("…and the 'not billed' acknowledgement", await page.locator('[data-action="review-complimentary"]').isDisabled());
    await page.locator("[data-comp-understood]").check({ force: true });
    await page.click('[data-action="review-complimentary"]');
    await page.waitForSelector("[data-comp-confirm]");
    check("complimentary: confirmation step before anything is sent", state.complimentary.length === 0 && /free Plus membership starts now[\s\S]*open-ended[\s\S]*not billed/.test(await page.innerText("[data-comp-confirm]")));
    await page.click('[data-action="confirm-complimentary"]');
    await waitFor(async () => state.complimentary.length === 1);
    const body = state.complimentary[0] || {};
    check("complimentary POST: plan, reason, confirm:true, the home without a membership", body.plan === "plus" && body.confirm === true && /referral/.test(body.reason) && body.addressId === "a2", JSON.stringify(body));
    await ctx.close();
  }

  /* --------------------------------------------------- block and archive */
  console.log("\n--- block, unblock, archive ---");
  {
    const { ctx, page, state } = await open(browser, "owner");
    await openProfile(page, "c1");
    await openMore(page);
    await menuItem(page, "Block");
    await page.waitForSelector('[data-sheet="block"]');
    check("block sheet: close visible", (await closeVisible(page, '[data-sheet="block"]')).ok);
    check("block needs a reason", await page.locator('[data-action="confirm-block"]').isDisabled());
    await page.fill('[data-input="block-reason"]', "Abusive calls to staff");
    await page.click('[data-action="confirm-block"]');
    await waitFor(async () => state.blocks.length === 1);
    await page.waitForSelector('[data-profile-chips] >> text=Blocked', { timeout: 6000 }).catch(() => {});
    check("block POST carries the reason; profile shows Blocked", state.blocks[0]?.reason === "Abusive calls to staff" && (await page.locator("[data-profile-chips]").innerText()).includes("Blocked"));
    await openMore(page);
    await menuItem(page, "Unblock");
    await page.waitForSelector('[data-sheet="unblock"]');
    const hist = await page.locator('[data-sheet="unblock"] [data-block-history]').innerText().catch(() => "");
    check("unblock sheet shows the block history", /Abusive calls to staff/.test(hist), hist.replace(/\n/g, " | "));
    check("unblock needs a reason too", await page.locator('[data-action="confirm-unblock"]').isDisabled());
    await page.fill('[data-input="block-reason"]', "Apologised, owner agreed");
    await page.click('[data-action="confirm-unblock"]');
    await waitFor(async () => state.unblocks.length === 1);
    check("unblock DELETE carries the reason", state.unblocks[0]?.reason === "Apologised, owner agreed");
    await openProfile(page, "c1", "activity");
    const act = await page.locator('[data-tab-panel="activity"]').innerText();
    check("activity shows block history with the lift", /Lifted[\s\S]*Abusive calls to staff[\s\S]*Unblocked[\s\S]*Apologised/.test(act), act.slice(0, 200).replace(/\n/g, " | "));

    await openMore(page);
    await menuItem(page, "Archive");
    await page.waitForSelector("[data-confirm]");
    await page.fill('[data-input="archive-reason"]', "Duplicate account");
    await page.click("[data-confirm]");
    await waitFor(async () => state.archives.length === 1);
    check("archive (owner): confirm sheet, POST with reason", state.archives[0]?.reason === "Duplicate account");
    await gotoList(page, "?filter=archived");
    await waitFor(async () => /Casey Customer/.test(await page.locator("[data-customers-list]").innerText()));
    check("archived customer appears under the Archived filter", /Casey Customer/.test(await page.locator("[data-customers-list]").innerText()));
    await page.locator('[data-customers-list] a[href="/admin/customers/c1"]').click();
    await page.waitForSelector('[data-customer-profile="c1"]');
    await openMore(page);
    await menuItem(page, "Restore from archive");
    await page.waitForSelector("[data-confirm]");
    await page.click("[data-confirm]");
    await waitFor(async () => state.unarchives.length === 1);
    check("restore path: Restore from archive calls unarchive", state.unarchives.length === 1);
    await ctx.close();
  }

  /* ------------------------------------------------------------- the unit */
  console.log("\n--- unit in edit and create ---");
  {
    const { ctx, page, state } = await open(browser, "owner");
    await openProfile(page, "c1");
    await openMore(page);
    await menuItem(page, "Edit details");
    await page.waitForSelector('[data-testid="address-card"]', { timeout: 10000 });
    const card = page.locator('[data-testid="address-card"]').first();
    const street = await card.locator('label:has-text("Street address") input').inputValue();
    const unit = await card.locator('input[placeholder="Optional"]').inputValue();
    check("edit sheet: street and Apt/Unit as two fields (unit split out of line1)", street === "12 Oak St" && unit === "Apt 2", `${street} | ${unit}`);
    await card.locator('input[placeholder="Optional"]').fill("Apt 3");
    await page.click("text=Save changes");
    await waitFor(async () => state.patches.length === 1);
    const a0 = state.patches[0]?.addresses?.[0] || {};
    check("edit save sends street and unit separately, with the stale guard", a0.line1 === "12 Oak St" && a0.unit === "Apt 3" && state.patches[0].expectedUpdatedAt === "2026-10-01T00:00:00.000Z", JSON.stringify(a0));
    await page.click("text=Done").catch(() => {});

    await gotoList(page);
    await page.click('[data-action="open-create-customer"]');
    await page.waitForSelector('[data-address-with-unit="new-address"]');
    await page.fill('input[name="firstName"]', "Nina");
    await page.fill('input[name="lastName"]', "New");
    await page.fill('input[name="email"]', "nina@example.test");
    await page.fill('[aria-label="Street address"]', "77 Pine Rd");
    await page.fill('[aria-label="City"]', "Massapequa");
    await page.fill('[aria-label="ZIP code"]', "11758");
    await page.fill('[data-input="new-address-unit"]', "Unit B");
    await page.click('[data-testid="create-customer-submit"], button:has-text("Create customer")');
    await waitFor(async () => state.created.length === 1);
    const ad = state.created[0]?.addresses?.[0] || {};
    check("create customer: Apt/Unit field always there, sent as unit", ad.line1 === "77 Pine Rd" && ad.unit === "Unit B", JSON.stringify(ad));
    await ctx.close();
  }

  /* ---------------------------------------------------------- consent STOP */
  console.log("\n--- messages & consent ---");
  {
    const state = makeState();
    state.stop = true;
    const { ctx, page, errors } = await open(browser, "staff", { state });
    await openProfile(page, "c1", "messages");
    await page.waitForSelector("[data-stop-banner]", { timeout: 8000 }).catch(() => {});
    const banner = await page.locator("[data-stop-banner]").innerText().catch(() => "");
    check("STOP banner states it outranks every switch", /STOP from this phone[\s\S]*receives no texts of any kind/.test(banner), banner);
    check("service texts switch locked (Texted STOP) and cannot be turned on", (await page.locator('[data-switch="service.sms"]').isDisabled()) && /Texted STOP/.test(await page.locator('[data-comm-row="service.sms"]').innerText()));
    check("header: Text action off and 'Texted STOP' chip", (await page.locator('[data-action="text"]').isDisabled()) && /Texted STOP/.test(await page.locator("[data-profile-chips]").innerText()));
    const mk = await page.locator('[data-comm-row="marketing.sms"]').innerText();
    check("marketing SMS keeps the 'needs confirmation' wording (no manufactured consent)", /Phone call recorded\. Offer texts start when the customer confirms/.test(mk), mk.replace(/\n/g, " | "));
    check("evidence line under service texts", /Agreed|Previously agreed/.test(await page.locator('[data-comm-row="service.sms"]').innerText()));
    check("one merged block (no 'Read-only. Only the customer can change these' panel)", (await page.locator("[data-consent-block]").count()) === 1 && !(await page.locator("body").innerText()).includes("Only the customer can change these"));
    check("consent history listed", /service sms · granted/i.test(await page.locator("[data-consent-history]").innerText().catch(() => "")));
    check("messages: no page errors", !errors.length, errors.join("; "));
    await ctx.close();
  }
  {
    const state = makeState();
    state.billingDown = true;
    const { ctx, page } = await open(browser, "staff", { state });
    await openProfile(page, "c1", "billing");
    check("billing: Stripe down shows the available:false state, page still works", await page.waitForSelector("[data-billing-unavailable]", { timeout: 8000 }).then(() => true).catch(() => false));
    await ctx.close();
  }

  /* --------------------------------------------- sizes, overflow, screenshots */
  console.log("\n--- sizes ---");
  for (const size of SIZES) {
    const { ctx, page, errors, external } = await open(browser, "owner", { width: size.width, height: size.height, touch: size.touch });
    await gotoList(page);
    const listOk = await noSideScroll(page);
    await page.screenshot({ path: path.join(SHOTS, `list-${size.name}.png`) });
    await openProfile(page, "c1");
    const profOk = await noSideScroll(page);
    const minFs = await minFontPx(page, "[data-customer-profile]");
    await page.screenshot({ path: path.join(SHOTS, `profile-${size.name}.png`) });
    let tabsOk = true;
    for (const t of ["visits", "billing", "messages", "activity", "notes"]) {
      await page.goto(`${BASE}/admin/customers/c1?tab=${t}`, { waitUntil: "domcontentloaded" });
      await page.waitForSelector(`[data-tab-panel="${t}"]`, { timeout: 10000 }).catch(() => {});
      await page.waitForTimeout(250);
      if (!(await noSideScroll(page))) tabsOk = false;
      if (size.name === "390x844" || size.name === "1440x900-desktop") await page.screenshot({ path: path.join(SHOTS, `profile-${t}-${size.name}.png`) });
    }
    await page.goto(`${BASE}/admin/customers/c1?tab=billing`, { waitUntil: "domcontentloaded" });
    await page.waitForSelector('[data-tab-panel="billing"] [data-action="change-plan"]', { timeout: 10000 });
    await page.click('[data-tab-panel="billing"] [data-action="change-plan"]');
    await page.locator('[data-sheet="change-plan"] input[name=plan][value=premium]').check({ force: true });
    await page.click('[data-action="preview-plan"]');
    await page.waitForSelector("[data-plan-preview]", { timeout: 8000 });
    const sheetClose = await closeVisible(page, '[data-sheet="change-plan"]');
    const sheetOk = await noSideScroll(page);
    await page.screenshot({ path: path.join(SHOTS, `plan-preview-${size.name}.png`) });
    check(`${size.name}: no sideways scroll (list, profile, tabs, plan sheet)`, listOk && profOk && tabsOk && sheetOk, `list=${listOk} profile=${profOk} tabs=${tabsOk} sheet=${sheetOk}`);
    check(`${size.name}: sheet close button on screen, 44px`, sheetClose.ok, JSON.stringify(sheetClose));
    check(`${size.name}: no text under 12px in the profile`, minFs >= 12, `min=${minFs}`);
    check(`${size.name}: no errors, nothing external`, !errors.length && !external.length, errors.concat(external).join("; "));
    await ctx.close();
  }

  await browser.close();
  const failed = results.filter((r) => !r.pass);
  console.log(`\n${results.length - failed.length}/${results.length} passed`);
  if (failed.length) {
    console.log("FAILED:\n" + failed.map((f) => "  - " + f.name).join("\n"));
    process.exit(1);
  }
})().catch((error) => {
  console.error(error);
  process.exit(1);
});
