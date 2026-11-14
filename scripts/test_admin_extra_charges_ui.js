/* eslint-disable @typescript-eslint/no-require-imports -- a plain Node script, like the other scripts/ */
/*
 * Charge customer in a real browser, from BOTH entry points: open a job (or
 * the customer's profile, with no booking), type the total, press
 * "Charge $X". Failures, payment links, repeats across the two screens,
 * keyboard and sizes.
 *
 *   npx next start -p 3130          (after npm run build)
 *   node scripts/test_admin_extra_charges_ui.js http://localhost:3130
 *
 * FULL NETWORK JAIL: the local server passes; every /api/ URL on any host is
 * answered by a small stateful fake shaped like BackEnd routes/adminExtraCharges.js;
 * everything else is aborted and must stay empty. Fake people only. Nothing is charged.
 */
const { chromium } = require("playwright");
const fs = require("fs");
const path = require("path");

const BASE = (process.argv[2] || "http://localhost:3130").replace(/\/$/, "");
const SHOTS = process.env.SHOTS_DIR || path.join(__dirname, "..", "..", "reports", "shots", "extra-charges");
fs.mkdirSync(SHOTS, { recursive: true });

const OWNER = { _id: "owner1", userId: "PF-OWNER", name: "Owner Test", email: "owner@example.test", phone: "5550100", role: "admin", addresses: [] };
const MANAGER = { _id: "mg1", userId: "PF-MG", name: "Mia Manager", email: "mia@example.test", phone: "5550103", role: "employee", employeeTitle: "Manager", isActive: true, permissions: ["customers.manage", "members.read", "bookings.read", "bookings.write"], adminSections: ["customers", "members", "jobs"], addresses: [] };
const GENERAL = { _id: "gf1", userId: "PF-GF", name: "Gina General", email: "gina@example.test", phone: "5550102", role: "employee", employeePosition: "General Fixter", isActive: true, permissions: ["bookings.read", "bookings.write", "bookings.assign", "members.read", "schedule.read", "schedule.write", "tips.read"], addresses: [] };
const FIELD = { _id: "fx2", userId: "PF-FX", name: "Fred Field", email: "fred@example.test", phone: "5550104", role: "employee", employeePosition: "Fixter", isActive: true, permissions: ["bookings.read", "bookings.write", "tips.read"], addresses: [] };
const iso = (h) => new Date(Date.now() + h * 3600_000).toISOString();
const money2 = (c) => `$${(c / 100).toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

function baseJob(id, o = {}) {
  return {
    id, bookingNumber: "55501234", date: iso(-3), endEstimate: iso(-1.5), status: "Completed", type: "member", typeLabel: "Membership visit",
    customer: { id: o.guest ? null : `u-${id}`, name: o.name || "Maria Rivera-Montgomery", phone: "(631) 555-0142", phoneE164: "+16315550142", email: "maria@example.test", guest: Boolean(o.guest), visitsCompleted: 4 },
    address: { line1: "1287 Old Country Road, Apt 12B", city: "Huntington Station", state: "NY", zip: "11746", full: "1287 Old Country Road, Apt 12B, Huntington Station, NY 11746" },
    addressShort: "1287 Old Country Road, Apt 12B", town: "Huntington Station", technician: { id: "fx2", name: "Gina General" }, flags: [], timing: null,
    service: "Handyman visit", selectedTask: "Fix a leaking faucet", description: "The kitchen faucet drips.", adminNote: "", photos: [], libraryReference: "",
    money: { kind: "membership_included", label: "Included in the membership" }, staffNotes: [], freeVisit: null, reservationIssue: null, cancellationReason: "",
    completedAt: iso(-1), createdAt: iso(-240), updatedAt: iso(-1),
  };
}

function makeServer(user, scenario = {}) {
  const owner = user.role === "admin";
  const manage = owner || (user.permissions || []).includes("customers.manage"); // as the server: customers.manage
  const canCharge = owner || (user.role === "employee" && user.employeePosition === "General Fixter");
  const state = { charges: [], calls: [], keys: new Map(), behavior: scenario.behavior || "ok", failOnceNetwork: Boolean(scenario.failOnceNetwork), card: scenario.card === undefined ? { brand: "visa", last4: "4242", expMonth: 12, expYear: 2030 } : scenario.card, fp: "fp-1" };
  const j = baseJob("j1", scenario.job || {});
  const detail = () => ({ ...j, allowedActions: ["addInternalNote", "addPhotos", ...(canCharge ? ["chargeExtra"] : [])], ...(canCharge ? { extraCharges: { count: state.charges.filter((c) => c.bookingId === j.id).length, paidCents: 0, open: 0 } } : {}), history: { href: `/api/admin/bookings/${j.id}/history` } });
  const toCents = (a) => {
    const m = String(a || "").replace(/[$,\s]/g, "").match(/^(\d{1,6})(?:\.(\d{1,2}))?$/);
    return m ? Number(m[1]) * 100 + Number((m[2] || "").padEnd(2, "0")) : null;
  };
  // "job": who pays = the booking's owner. "customer": the profile u-j1, a direct charge with no booking.
  const target = (kind = "job") => ({
    scope: kind === "job" ? "booking" : "direct",
    booking: kind === "job" ? { id: j.id, number: j.bookingNumber, date: j.date, service: j.service, status: j.status } : null,
    customer: { name: j.customer.name, guest: Boolean(scenario.guest), accountLinked: !scenario.guest, hasEmail: true, hasPhone: true },
    serviceAddress: { line1: j.address.line1, unit: "", city: j.address.city, state: "NY", zip: j.address.zip, full: j.address.full },
    card: scenario.guest ? null : state.card,
    direct: scenario.guest ? { allowed: false, code: "GUEST_BOOKING", message: "This is a guest visit with no account, so there is no saved card to charge. Use a payment link." } : { allowed: true },
    link: { allowed: true, canSend: true },
    fingerprint: state.fp,
    limits: { minCents: 50, maxCents: 500000 },
  });
  const setStatus = (c, status) => {
    c.status = status;
    c.statusLabel = { paid: "Paid", failed: "Failed", processing: "Processing", awaiting_payment: "Awaiting payment", canceled: "Closed, not paid" }[status] || status;
    c.actions = ["failed", "awaiting_payment"].includes(status) ? ["retryCard", "paymentLink", "copyLink", "close"].filter((a) => a !== "retryCard" || !scenario.guest) : [];
  };
  function chargeCard(c) {
    if (state.behavior === "decline") {
      setStatus(c, "failed");
      c.failure = { code: "card_declined", declineCode: "insufficient_funds", message: "The card was declined: insufficient funds." };
    } else if (state.behavior === "auth") {
      setStatus(c, "failed");
      c.failure = { code: "authentication_required", declineCode: "", message: "The customer's bank wants them to approve this payment themselves. Send them a payment link." };
    } else if (state.behavior === "processing") setStatus(c, "processing");
    else {
      setStatus(c, "paid");
      c.paidAt = new Date().toISOString();
      c.stripeUrl = "https://dashboard.stripe.com/test/payments/pi_fake1";
      c.receiptUrl = "https://pay.stripe.test/receipts/pi_fake1";
    }
  }
  function handle(method, p, sp, body) {
    if (p === "/api/auth/me") return [200, user];
    if (p === "/api/admin/needs-action") return [200, { generatedAt: new Date().toISOString(), total: 0, sections: [], items: [] }];
    if (p === "/api/admin/jobs" && method === "GET") return [200, { view: "today", from: null, to: null, total: 1, rows: [detail()], nextCursor: null, counts: { today: 1, tomorrow: 0, week: 1, needsAction: 0 } }];
    if (/\/history$/.test(p)) return [200, { history: [], records: [] }];
    if (p === "/api/admin/jobs/j1" && method === "GET") return [200, { job: detail() }];
    const cm = /^\/api\/admin\/(jobs\/j1\/extra-charges|customers\/u-j1\/charges)(\/.*)?$/.exec(p);
    if (cm) {
      if (!canCharge) return [403, { code: "CHARGE_NOT_ALLOWED", message: "Only the owner or a General Fixter can charge customers." }];
      state.calls.push({ method, p, body });
      const kind = cm[1].startsWith("customers") ? "customer" : "job";
      const rest = cm[2] || "";
      if (rest === "/target") return [200, { target: target(kind) }];
      if (!rest && method === "GET") return [200, { charges: kind === "job" ? state.charges.filter((c) => c.bookingId === j.id) : [...state.charges].reverse() }];
      if (!rest && method === "POST") {
        if (state.failOnceNetwork) {
          state.failOnceNetwork = false;
          return [502, { message: "Bad gateway" }];
        }
        if (state.keys.has(body.idempotencyKey)) return [200, { charge: state.keys.get(body.idempotencyKey), replayed: true }];
        if (body.targetFingerprint !== state.fp) return [409, { code: "TARGET_CHANGED", message: "The customer or saved card for this visit changed since the screen opened. Check it and press Charge again.", target: target(kind) }];
        const cents = toCents(body.amount);
        // As the server: the same amount to the same CUSTOMER, from either screen, asks first.
        const recent = state.charges.find((c) => c.totalCents === cents && ["paid", "processing", "charging", "awaiting_payment"].includes(c.status));
        if (!body.allowRepeat && recent) {
          return [409, { code: "POSSIBLE_DUPLICATE", message: `${money2(cents)} was already charged for ${j.customer.name} at 2:14 PM, ${recent.bookingId ? `on job #${recent.bookingNumber}` : "as a direct charge"}. Charge it again?` }];
        }
        const n = state.charges.length + 1;
        const onJob = kind === "job";
        const c = { id: `x${n}`, number: onJob ? `${j.bookingNumber}-E${n}` : `PF-1-D${n}`, scope: onJob ? "booking" : "direct", bookingId: onJob ? j.id : null, bookingNumber: onJob ? j.bookingNumber : "", where: onJob ? `Job #${j.bookingNumber}` : "Direct charge", note: body.note || "", totalCents: cents, taxStatus: "not_calculated", status: "charging", statusLabel: "", method: body.method, createdAt: new Date().toISOString(), createdByName: user.name, confirmedByName: user.name, confirmedAt: new Date().toISOString(), customerName: j.customer.name, guest: Boolean(scenario.guest), card: body.method === "card" ? { brand: state.card.brand, last4: state.card.last4 } : null, paidAt: null, failure: null, refundedCents: 0, stripeUrl: "", receiptUrl: "", extraPayments: [], link: null, actions: [] };
        state.charges.push(c);
        if (body.method === "card") chargeCard(c);
        else {
          setStatus(c, "awaiting_payment");
          c.link = { status: "open", expiresAt: iso(24 * 7), sentVia: body.send ? body.channels : [], delivery: null };
        }
        state.keys.set(body.idempotencyKey, c);
        const delivery = body.send ? { email: body.channels.includes("email") ? "sent" : "not_requested", sms: body.channels.includes("sms") ? "skipped:transactional_not_opted_in" : "not_requested" } : undefined;
        return [201, { charge: c, replayed: false, ...(body.method === "link" ? { payUrl: "https://www.profixter.com/pay/TESTTOKENabcdefghij12" } : {}), ...(delivery ? { delivery } : {}) }];
      }
      const m = /^\/([^/]+)\/(refresh|retry-card|payment-link|close)$/.exec(rest);
      // A charge only under its own job, or its own customer.
      const c = m && state.charges.find((x) => x.id === m[1] && (kind === "customer" || x.bookingId === j.id));
      if (!c) return [404, { code: "NOT_FOUND", message: "Charge not found" }];
      if (m[2] === "refresh") {
        if (c.status === "processing" && state.settleOnRefresh) {
          setStatus(c, "paid");
          c.paidAt = new Date().toISOString();
        }
        return [200, { charge: c }];
      }
      if (m[2] === "payment-link") {
        setStatus(c, "awaiting_payment");
        c.link = { status: "open", expiresAt: iso(24 * 7), sentVia: body.send ? body.channels : [], delivery: null };
        return [200, { charge: c, payUrl: "https://www.profixter.com/pay/TESTTOKENzyxwvutsrq98", delivery: body.send ? { email: "sent", sms: "not_requested" } : null }];
      }
      if (m[2] === "close") {
        setStatus(c, "canceled");
        return [200, { charge: c }];
      }
      return [200, { charge: c }];
    }
    const pm = /^\/api\/admin\/customers\/u-j1(\/[a-z-]+)?$/.exec(p);
    if (pm && !owner && !(user.permissions || []).some((x) => x === "customers.manage" || x === "members.read")) return [403, { message: "Access denied" }];
    if (pm) {
      const rest = pm[1] || "";
      if (!rest) {
        return [200, {
          customer: { id: "u-j1", userId: "PF-1", name: j.customer.name, firstName: "Maria", lastName: "Rivera-Montgomery", email: j.customer.email, phone: j.customer.phoneE164, phoneFormatted: j.customer.phone, signupMethod: "web", customerSince: iso(-24 * 400), updatedAt: iso(-24), archivedAt: null },
          addresses: [],
          visits: { completed: 4, next: null, last: null },
          flags: { blocked: false, phoneVerified: true, emailVerified: true, textsOk: true, offersByTextOk: false, archived: false, hasStripeCustomer: true },
          notesCount: 0,
          allowedActions: { editProfile: manage, editContact: owner, changePlan: manage, scheduleCancellation: manage, grantComplimentary: owner, sellMembership: manage, createVisit: true, addNote: manage, block: false, unblock: false, archive: owner, unarchive: false, viewBilling: true, changeCommunication: true, resendAccess: false, chargeCustomer: canCharge },
        }];
      }
      if (rest === "/billing") {
        // The Stripe list, with each charge's payment labelled by its record (never a second entry).
        const paid = state.charges.filter((c) => c.status === "paid");
        return [200, {
          available: true, cachedAt: new Date().toISOString(),
          customers: [{ id: "cus_fake", deleted: false, defaultPaymentMethod: { brand: "visa", last4: "4242", expMonth: 12, expYear: 2030 }, dashboardUrl: "https://dashboard.stripe.com/test/customers/cus_fake" }],
          subscriptions: [], invoices: [], upcoming: [], refundsNote: "Refunds are made in Stripe.",
          payments: paid.map((c, i) => ({ id: `ch_${i}`, paymentIntentId: `pi_${c.id}`, amountCents: c.totalCents, amountRefundedCents: 0, refunded: false, currency: "usd", status: "succeeded", paid: true, failureCode: null, failureMessage: null, description: "", createdAt: c.createdAt, card: c.card, dashboardUrl: "https://dashboard.stripe.com/test/payments/x", extraCharge: { id: c.id, number: c.number, direct: !c.bookingId, bookingId: c.bookingId, bookingNumber: c.bookingNumber, description: c.note } })),
          additionalCharges: paid.map((c) => ({ id: c.id, number: c.number, direct: !c.bookingId, bookingId: c.bookingId, bookingNumber: c.bookingNumber, description: c.note, status: c.status, totalCents: c.totalCents, taxStatus: "not_calculated", refundedCents: 0, paidAt: c.paidAt, createdAt: c.createdAt, inPayments: true, stripeUrl: null })),
        }];
      }
      if (rest === "/consent") {
        const sw = { enabled: true, locked: null, changedAt: null, source: "" };
        return [200, { switches: { service: { email: sw, sms: sw }, marketing: { email: { ...sw, delivery: { sending: true, reason: null } }, sms: { ...sw, enabled: false, consent: { status: "none", basis: "", method: "", evidence: "", confirmRequestedAt: null }, delivery: { sending: false, reason: null } } } }, evidence: {}, stop: { phoneOptedOut: false, scope: "", at: null, source: "" }, history: [] }];
      }
      if (rest === "/visits") return [200, { items: [], nextCursor: null }];
      if (rest === "/projects") return [200, { moneyVisible: owner, items: [] }];
      return [200, { items: [] }];
    }
    return [200, p.includes("summary") || p.includes("settings") ? {} : []];
  }
  return { state, handle };
}

const results = [];
function check(name, pass, detailText = "") {
  results.push({ name, pass: !!pass });
  console.log(`${pass ? "PASS" : "FAIL"}  ${name}${detailText ? "  :: " + detailText : ""}`);
}
async function open(browser, user, scenario = {}, { width = 390, height = 844 } = {}) {
  const mobile = width < 1024;
  const ctx = await browser.newContext({ viewport: { width, height }, isMobile: mobile, hasTouch: mobile, serviceWorkers: "block", reducedMotion: "reduce" });
  await ctx.addInitScript(() => {
    if (location.pathname.startsWith("/admin")) localStorage.setItem("token", "ui-token");
  });
  const server = makeServer(user, scenario);
  const external = [];
  const local = new URL(BASE);
  await ctx.route("**/*", async (route) => {
    const req = route.request();
    const u = new URL(req.url());
    if (u.pathname.includes("/api/")) {
      const cors = { "access-control-allow-origin": "*", "access-control-allow-headers": "Authorization,Content-Type", "access-control-allow-methods": "GET,POST,PUT,PATCH,DELETE,OPTIONS" };
      if (req.method() === "OPTIONS") return route.fulfill({ status: 204, headers: cors });
      const p = u.pathname.replace(/^.*?(\/api\/)/, "/api/");
      let body = null;
      try {
        body = req.postDataJSON();
      } catch {
        body = null;
      }
      if (req.headers()["idempotency-key"]) external.push("HEADER idempotency-key (CORS would refuse it)");
      const [status, json] = server.handle(req.method(), p, u.searchParams, body);
      return route.fulfill({ status, contentType: "application/json", headers: cors, body: JSON.stringify(json) });
    }
    if (u.origin === local.origin) return route.continue();
    external.push(u.href);
    return route.abort();
  });
  const page = await ctx.newPage();
  const errors = [];
  page.on("pageerror", (e) => errors.push(e.message));
  return { ctx, page, server, external, errors };
}
const sheet = (page) => page.locator("[role=dialog][data-sheet=job]");
const chargeSheet = (page) => page.locator("[role=dialog][data-sheet=charge-customer]");
async function openCustomer(page, tab = "billing") {
  await page.goto(`${BASE}/admin/customers/u-j1${tab ? `?tab=${tab}` : ""}`, { waitUntil: "domcontentloaded" });
  await page.locator("[data-customer-profile=u-j1]").waitFor({ timeout: 20000 });
}
async function startDirect(page, amount = "80") {
  await page.locator("[data-extra-block=customer] [data-extra-open]").click();
  await chargeSheet(page).locator("[data-stage=charge]").waitFor();
  if (amount !== null) await page.locator("input[name=extra-amount]").fill(amount);
}
const customerPosts = (server) => server.state.calls.filter((c) => c.method === "POST" && /\/customers\/u-j1\/charges$/.test(c.p));
async function openJob(page) {
  await page.goto(`${BASE}/admin/jobs/j1`, { waitUntil: "domcontentloaded" });
  await sheet(page).locator("[data-job-body=j1]").waitFor({ timeout: 20000 });
}
async function startCharge(page, amount = "134.10") {
  await page.locator("[data-extra-open]").click();
  await page.locator("[data-stage=charge]").waitFor();
  if (amount !== null) await page.locator("input[name=extra-amount]").fill(amount);
}
const posts = (server) => server.state.calls.filter((c) => c.method === "POST" && /extra-charges$/.test(c.p));
async function overflow(page, which = "job") {
  return page.evaluate((which) => {
    const d = document.querySelector(`[role=dialog][data-sheet=${which}]`);
    const vw = document.documentElement.clientWidth;
    const bad = [];
    for (const el of d.querySelectorAll("*")) {
      const r = el.getBoundingClientRect();
      if (r.width && r.right > vw + 1) bad.push(`${el.tagName}.${String(el.className).slice(0, 30)} ${Math.round(r.right)}`);
    }
    return { scroll: document.documentElement.scrollWidth > vw + 1, bad: bad.slice(0, 5) };
  }, which);
}

(async () => {
  const browser = await chromium.launch();
  try {
    /* 1. the whole workflow: open, type, Charge $X, paid */
    {
      const { ctx, page, server, external, errors } = await open(browser, OWNER);
      await openJob(page);
      check("owner: Charges section with a Charge customer button", (await page.locator("[data-extra-block] [data-extra-open]").innerText()).includes("Charge customer"));
      await startCharge(page, null);
      const focused = await page.evaluate(() => document.activeElement?.getAttribute("name"));
      check("the amount field is focused straight away", focused === "extra-amount", String(focused));
      const who = await page.locator("[data-extra-identity]").innerText();
      check("shows the booking's customer, job number and the saved card's last four", /Maria Rivera-Montgomery/.test(who) && /#55501234/.test(who) && /Visa •••• 4242/.test(who), who);
      check("no tax questions, no required description, no document fields", (await page.locator("[data-extra-tax], [data-extra-basis], textarea[name=extra-description]").count()) === 0 && (await page.locator("input[name=extra-note]").count()) === 0);
      check("Charge waits for a valid amount", await page.locator("[data-extra-charge]").isDisabled());
      await page.locator("input[name=extra-amount]").fill("134.1");
      check("the button states the exact amount: Charge $134.10", (await page.locator("[data-extra-charge]").innerText()).trim() === "Charge $134.10", await page.locator("[data-extra-charge]").innerText());
      check("the amount is the total: nothing is added to it", /Nothing is added to it/.test(await page.locator("[data-stage=charge]").innerText()));
      await page.locator("[data-extra-add-note]").click();
      await page.locator("input[name=extra-note]").fill("Extra outlet in the garage");
      await page.screenshot({ path: path.join(SHOTS, "1-charge-390x844.png") });
      await page.locator("[data-extra-charge]").click();
      await page.locator("[data-stage=result][data-extra-status=paid]").waitFor();
      const res = await page.locator("[data-stage=result]").innerText();
      check("one press charges; Paid shows only once the server says paid", /Paid \$134\.10/.test(res) && /Visa •••• 4242/.test(res));
      const sent = posts(server)[0];
      check("the request carries the amount, the note, the target fingerprint and the key, and no customer/card ids", sent && sent.body.amount === "134.1" && sent.body.note === "Extra outlet in the garage" && sent.body.targetFingerprint === "fp-1" && /^[A-Za-z0-9_.:-]{8,120}$/.test(sent.body.idempotencyKey) && sent.body.method === "card" && !/customerId|stripeCustomer|paymentMethod|cus_|pm_|tax/.test(JSON.stringify(sent.body)), JSON.stringify(sent?.body || {}));
      await page.screenshot({ path: path.join(SHOTS, "2-paid-390x844.png") });
      await page.locator("[data-extra-done]").click();
      await page.locator("[data-extra-row=paid]").waitFor();
      const row = await page.locator("[data-extra-row=paid]").innerText();
      check("recorded under the booking: amount, note, owner, time, status, card, receipt", /\$134\.10/.test(row) && /Extra outlet in the garage/.test(row) && /by Owner Test/.test(row) && /Paid/.test(row) && /Visa •••• 4242/.test(row) && (await page.locator("[data-extra-row=paid] [data-extra-receipt]").count()) === 1 && /Refund in Stripe/.test(row), row);
      await page.locator("[data-extra-block]").scrollIntoViewIfNeeded();
      await page.screenshot({ path: path.join(SHOTS, "3-recorded-390x844.png") });
      check("no outside requests, no page errors", external.length === 0 && errors.length === 0, [...external, ...errors].join(" | "));
      await ctx.close();
    }

    /* 2. double tap, repeat guard, network failure, stale card */
    {
      const { ctx, page, server } = await open(browser, OWNER);
      await openJob(page);
      await startCharge(page, "250");
      await page.locator("[data-extra-charge]").dblclick();
      await page.locator("[data-stage=result]").waitFor();
      check("double tap: one charge request", posts(server).length === 1, String(posts(server).length));
      await page.locator("[data-extra-done]").click();
      await startCharge(page, "250");
      await page.locator("[data-extra-charge]").click();
      await page.locator("[data-extra-repeat]").waitFor();
      check("the same amount again soon asks first, and nothing is charged meanwhile", /already charged/.test(await page.locator("[data-extra-repeat]").innerText()) && server.state.charges.length === 1);
      await page.screenshot({ path: path.join(SHOTS, "4-repeat-guard-390x844.png") });
      await page.locator("[data-extra-repeat-confirm]").click();
      await page.locator("[data-stage=result][data-extra-status=paid]").waitFor();
      check("a deliberate second charge goes through only after Charge again", server.state.charges.length === 2 && posts(server).at(-1).body.allowRepeat === true);
      await ctx.close();
    }
    {
      const { ctx, page, server } = await open(browser, OWNER, { failOnceNetwork: true });
      await openJob(page);
      await startCharge(page, "99.95");
      await page.locator("[data-extra-charge]").click();
      await page.locator("[data-extra-error]").waitFor();
      check("a failed request keeps the amount and says so", (await page.locator("input[name=extra-amount]").inputValue()) === "99.95");
      await page.screenshot({ path: path.join(SHOTS, "5-network-error-390x844.png") });
      await page.locator("[data-extra-charge]").click();
      await page.locator("[data-stage=result][data-extra-status=paid]").waitFor();
      const p = posts(server);
      check("the retry sends the same idempotency key (resolves the first attempt, never a second charge)", p.length === 2 && p[0].body.idempotencyKey === p[1].body.idempotencyKey);
      await ctx.close();
    }
    {
      const { ctx, page, server } = await open(browser, OWNER);
      await openJob(page);
      await startCharge(page, "60");
      server.state.fp = "fp-2"; // the customer's card changed while the screen was open
      server.state.card = { brand: "mastercard", last4: "5555", expMonth: 1, expYear: 2031 };
      await page.locator("[data-extra-charge]").click();
      await page.locator("[data-extra-error=TARGET_CHANGED]").waitFor();
      check("a card that changed since the screen opened is not charged; the new card is shown", server.state.charges.length === 0 && /Mastercard •••• 5555/.test(await page.locator("[data-extra-identity]").innerText()));
      await page.locator("[data-extra-charge]").click();
      await page.locator("[data-stage=result][data-extra-status=paid]").waitFor();
      check("pressing again charges the card now shown", server.state.charges.length === 1 && server.state.charges[0].card.last4 === "5555");
      await ctx.close();
    }

    /* 3. decline and bank check: the real result, then a payment link */
    {
      const { ctx, page, server } = await open(browser, OWNER, { behavior: "decline" });
      await openJob(page);
      await startCharge(page, "75");
      await page.locator("[data-extra-charge]").click();
      await page.locator("[data-stage=result][data-extra-status=failed]").waitFor();
      const t = await page.locator("[data-stage=result]").innerText();
      check("decline: Not charged, with the bank's reason, never Paid", /Not charged/.test(t) && /insufficient funds/.test(t) && !/Paid/.test(t));
      await page.screenshot({ path: path.join(SHOTS, "6-declined-390x844.png") });
      await page.locator("[data-extra-result-copy]").click();
      await page.locator("[data-extra-pay-url]").waitFor();
      check("Copy payment link for the same charge", /pay\/TESTTOKEN/.test(await page.locator("[data-extra-pay-url]").innerText()) && (await page.locator("[data-extra-status=awaiting_payment]").count()) === 1);
      check("no automatic retry", server.state.calls.filter((c) => /retry-card/.test(c.p)).length === 0);
      await ctx.close();
    }
    {
      const { ctx, page } = await open(browser, OWNER, { behavior: "auth" });
      await openJob(page);
      await startCharge(page, "90");
      await page.locator("[data-extra-charge]").click();
      await page.locator("[data-stage=result][data-extra-status=failed]").waitFor();
      check("bank check required: says so and offers the link", /approve this payment themselves/.test(await page.locator("[data-stage=result]").innerText()));
      await page.locator("[data-extra-result-send]").click();
      check("Send waits for an explicit channel", await page.locator("[data-extra-result-send-confirm]").isDisabled());
      await page.locator("[data-extra-result-channels] label:has-text('Email')").click();
      await page.screenshot({ path: path.join(SHOTS, "7-auth-send-link-390x844.png") });
      await page.locator("[data-extra-result-send-confirm]").click();
      await page.locator("[data-stage=result][data-extra-status=awaiting_payment]").waitFor();
      check("Send payment link reports what was sent", /Email sent/.test(await page.locator("[data-stage=result]").innerText()));
      await ctx.close();
    }
    {
      const { ctx, page, server } = await open(browser, OWNER, { behavior: "processing" });
      await openJob(page);
      await startCharge(page, "40");
      await page.locator("[data-extra-charge]").click();
      await page.locator("[data-stage=result][data-extra-status=processing]").waitFor();
      check("processing: Processing with 'do not charge again', not success", /Do not charge again/.test(await page.locator("[data-stage=result]").innerText()));
      server.state.settleOnRefresh = true;
      await page.locator("[data-extra-refresh]").click();
      await page.locator("[data-stage=result][data-extra-status=paid]").waitFor({ timeout: 15000 });
      check("Check now turns it Paid once the server says so", true);
      await ctx.close();
    }

    /* 4. guest visit: no card; payment link by explicit choice */
    {
      const { ctx, page, server } = await open(browser, OWNER, { guest: true, job: { guest: true, name: "Gail Guest" } });
      await openJob(page);
      await startCharge(page, "40");
      check("guest: no Charge button, the reason shown, link actions offered", (await page.locator("[data-extra-charge]").count()) === 0 && /guest visit/.test(await page.locator("[data-extra-direct-blocked]").innerText()) && (await page.locator("[data-extra-send-link]").count()) === 1);
      await page.locator("[data-extra-send-link]").click();
      check("nothing is sent until a channel is chosen and Send is pressed", (await page.locator("[data-extra-send-confirm]").isDisabled()) && posts(server).length === 0);
      await page.locator("[data-extra-send] label:has-text('Email')").click();
      await page.screenshot({ path: path.join(SHOTS, "8-guest-link-390x844.png") });
      await page.locator("[data-extra-send-confirm]").click();
      await page.locator("[data-stage=result][data-extra-status=awaiting_payment]").waitFor();
      check("sent link: what was sent is reported", /Email sent/.test(await page.locator("[data-stage=result]").innerText()) && posts(server)[0].body.method === "link");
      await ctx.close();
    }

    /* 5. draft and discard protection */
    {
      const { ctx, page } = await open(browser, OWNER);
      await openJob(page);
      await startCharge(page, "123.45");
      await page.reload({ waitUntil: "domcontentloaded" });
      await sheet(page).locator("[data-job-body=j1]").waitFor({ timeout: 20000 });
      await startCharge(page, null);
      check("a reload keeps the typed amount", (await page.locator("input[name=extra-amount]").inputValue()) === "123.45");
      await page.keyboard.press("Escape");
      check("closing with an amount typed asks before discarding", (await page.locator("text=Leave without saving?").count()) >= 1);
      await ctx.close();
    }

    /* 6. roles: a General Fixter charges from both entry points; a field Fixter has nothing anywhere */
    {
      const { ctx, page, server, errors } = await open(browser, GENERAL);
      await openJob(page);
      check("General Fixter (job): Charges section with Charge customer", (await page.locator("[data-extra-block=job] [data-extra-open]").count()) === 1);
      await startCharge(page, "55");
      check("General Fixter (job): the customer and card last four", /Visa •••• 4242/.test(await page.locator("[data-extra-identity]").innerText()));
      await page.locator("[data-extra-charge]").click();
      await page.locator("[data-stage=result][data-extra-status=paid]").waitFor();
      check("General Fixter (job): Charge $55.00 goes through on the server's answer", posts(server).length === 1);
      await page.locator("[data-extra-done]").click();
      await openCustomer(page, "billing");
      await page.locator("[data-extra-block=customer]").waitFor();
      await startDirect(page, "56");
      check("General Fixter (profile): Direct charge · no booking, with the card", /Direct charge · no booking/.test(await chargeSheet(page).locator("[data-extra-identity]").innerText()));
      await page.locator("[data-extra-charge]").click();
      await chargeSheet(page).locator("[data-stage=result][data-extra-status=paid]").waitFor();
      check("General Fixter (profile): charged through this customer's charges", customerPosts(server).length === 1);
      await page.locator("[data-extra-done]").click();
      await chargeSheet(page).waitFor({ state: "detached" });
      await page.locator("[data-action=more]").click();
      check("General Fixter (profile): Charge customer in More; no membership selling or editing added", (await page.locator("[role=menuitem]:has-text('Charge customer')").count()) === 1 && (await page.locator("[role=menuitem]:has-text('Sell a membership')").count()) === 0 && (await page.locator("[role=menuitem]:has-text('Edit details')").count()) === 0);
      check("General Fixter: no page errors", errors.length === 0, errors.join(" | "));
      await ctx.close();
    }
    {
      const { ctx, page, server } = await open(browser, FIELD);
      await openJob(page);
      check("field Fixter (job): no Charges section, no Charge customer", (await page.locator("[data-extra-block]").count()) === 0 && (await page.locator("[data-extra-open]").count()) === 0);
      await page.locator("[data-job-more]").click().catch(() => {});
      check("field Fixter (job): not in the More menu either", (await page.locator("[role=menuitem]:has-text('Charge customer')").count()) === 0);
      await page.keyboard.press("Escape").catch(() => {});
      await page.goto(`${BASE}/admin/customers/u-j1?tab=billing`, { waitUntil: "domcontentloaded" });
      await page.waitForTimeout(2500);
      check("field Fixter (old profile link): no profile, no Charges, no Charge customer", (await page.locator("[data-customer-profile=u-j1]").count()) === 0 && (await page.locator("[data-extra-block], [data-extra-open]").count()) === 0);
      check("field Fixter: no charge request made", server.state.calls.length === 0, JSON.stringify(server.state.calls.map((c) => c.p)));
      await ctx.close();
    }

    /* 7. sizes and the keyboard */
    for (const size of [{ w: 320, h: 568 }, { w: 390, h: 844 }, { w: 430, h: 932 }, { w: 844, h: 390 }, { w: 1440, h: 900 }]) {
      const { ctx, page } = await open(browser, OWNER, {}, { width: size.w, height: size.h });
      await openJob(page);
      await startCharge(page, "134.10");
      const o = await overflow(page);
      const btn = await page.locator("[data-extra-charge]").boundingBox();
      const input = await page.locator("input[name=extra-amount]").boundingBox();
      check(`${size.w}x${size.h}: no horizontal overflow`, !o.scroll && !o.bad.length, JSON.stringify(o.bad));
      check(`${size.w}x${size.h}: Charge button on screen and at least 44px tall`, btn && btn.y + btn.height <= size.h + 1 && btn.height >= 43.5, JSON.stringify(btn));
      check(`${size.w}x${size.h}: amount field and Charge visible together (no scrolling needed)`, input && input.y >= 0 && input.y + input.height <= btn.y, JSON.stringify([input, btn]));
      if (size.w < 1024) {
        const fs16 = await page.evaluate(() => [...document.querySelectorAll("[data-step=charge-extra] input:not([type=checkbox])")].every((el) => parseFloat(getComputedStyle(el).fontSize) >= 16));
        check(`${size.w}x${size.h}: inputs 16px+ (no zoom on focus)`, fs16);
      }
      await page.screenshot({ path: path.join(SHOTS, `charge-${size.w}x${size.h}.png`) });
      await ctx.close();
    }

    /* 8. the customer profile: Charge customer with no booking */
    {
      const { ctx, page, server, external, errors } = await open(browser, OWNER);
      await openCustomer(page, "billing");
      await page.locator("[data-extra-block=customer]").waitFor();
      check("profile: the owner's Billing tab has Charges with a Charge customer button", (await page.locator("[data-extra-block=customer] [data-extra-open]").innerText()).includes("Charge customer"));
      await page.locator("[data-action=more]").click();
      check("profile: Charge customer is in More too", (await page.locator("[role=menuitem]:has-text('Charge customer')").count()) === 1);
      await page.keyboard.press("Escape");
      await startDirect(page, null);
      const focused = await page.evaluate(() => document.activeElement?.getAttribute("name"));
      check("profile: the amount field is focused straight away", focused === "extra-amount", String(focused));
      const who = await chargeSheet(page).locator("[data-extra-identity]").innerText();
      check("profile: shows the customer, 'no booking' and the saved card's last four (no job number)", /Maria Rivera-Montgomery/.test(who) && /Direct charge · no booking/.test(who) && /Visa •••• 4242/.test(who) && !/Job #/.test(who), who);
      await page.locator("input[name=extra-amount]").fill("80");
      check("profile: the button states the exact total", (await page.locator("[data-extra-charge]").innerText()).trim() === "Charge $80.00");
      await page.locator("[data-extra-add-note]").click();
      await page.locator("input[name=extra-note]").fill("Emergency call-out, burst pipe");
      await page.screenshot({ path: path.join(SHOTS, "9-profile-charge-390x844.png") });
      await page.locator("[data-extra-charge]").click();
      await chargeSheet(page).locator("[data-stage=result][data-extra-status=paid]").waitFor();
      check("profile: Paid only on the server's answer", /Paid \$80\.00/.test(await chargeSheet(page).locator("[data-stage=result]").innerText()));
      const sent = customerPosts(server)[0];
      check("profile: posted to this customer's charges, no booking, no customer or card ids in the request", sent && sent.body.amount === "80" && sent.body.note === "Emergency call-out, burst pipe" && sent.body.targetFingerprint === "fp-1" && !/bookingId|customerId|userId|stripeCustomer|paymentMethod|cus_|pm_/.test(JSON.stringify(sent.body)), JSON.stringify(sent?.body || {}));
      await page.screenshot({ path: path.join(SHOTS, "10-profile-paid-390x844.png") });
      await page.locator("[data-extra-done]").click();
      await chargeSheet(page).waitFor({ state: "detached" });
      await page.locator("[data-extra-block=customer] [data-extra-row=paid]").waitFor();
      const row = await page.locator("[data-extra-block=customer] [data-extra-row=paid]").innerText();
      check("profile: recorded under the customer as Direct charge, with note, owner, time, status and receipt", /Direct charge/.test(row) && /Emergency call-out/.test(row) && /by Owner Test/.test(row) && /Paid/.test(row) && (await page.locator("[data-extra-block=customer] [data-extra-row=paid] [data-extra-receipt]").count()) === 1, row);
      await page.reload({ waitUntil: "domcontentloaded" });
      await page.locator("[data-payment-extra=direct]").waitFor({ timeout: 15000 });
      check("billing: the Stripe payment is labelled Direct charge; no separate 'paid by link' list for the owner", /Direct charge/.test(await page.locator("[data-payment-extra=direct]").innerText()) && (await page.locator("text=Charges paid by link").count()) === 0);

      // Switching screens: the same amount from the job is caught.
      await openJob(page);
      await startCharge(page, "80");
      await page.locator("[data-extra-charge]").click();
      await page.locator("[data-extra-repeat]").waitFor();
      check("switching to the job: the same amount is caught as a repeat of the direct charge", /already charged .*as a direct charge/.test(await page.locator("[data-extra-repeat]").innerText()) && server.state.charges.length === 1);
      await page.screenshot({ path: path.join(SHOTS, "12-cross-repeat-390x844.png") });
      await page.locator("[data-extra-repeat-confirm]").click();
      await page.locator("[data-stage=result][data-extra-status=paid]").waitFor();
      await page.locator("[data-extra-done]").click();
      await page.locator("[data-extra-block=job] [data-extra-row]").first().waitFor();
      check("the job lists only its own charge, not the direct one", (await page.locator("[data-extra-block=job] [data-extra-row]").count()) === 1 && !/Direct charge/.test(await page.locator("[data-extra-block=job]").innerText()));

      // And back on the profile: both, once each, the job one linked to its job.
      await openCustomer(page, "billing");
      await page.locator("[data-extra-block=customer] [data-extra-row]").nth(1).waitFor();
      const rows = page.locator("[data-extra-block=customer] [data-extra-row]");
      const jobRow = page.locator("[data-extra-block=customer] [data-extra-row-where=job] a");
      check("profile lists every charge once: the job charge (linked to its job) and the direct one", (await rows.count()) === 2 && (await jobRow.count()) === 1 && (await jobRow.getAttribute("href")) === "/admin/jobs/j1" && (await page.locator("[data-extra-block=customer] [data-extra-row-where=direct]").count()) === 1);
      await page.locator("[data-extra-block=customer]").scrollIntoViewIfNeeded();
      await page.screenshot({ path: path.join(SHOTS, "11-profile-charges-390x844.png") });
      check("profile: no outside requests, no page errors", external.length === 0 && errors.length === 0, [...external, ...errors].join(" | "));
      await ctx.close();
    }
    {
      const { ctx, page, server } = await open(browser, OWNER);
      await openCustomer(page, "billing");
      await page.locator("[data-extra-block=customer]").waitFor();
      await startDirect(page, "45");
      await page.locator("[data-extra-charge]").dblclick();
      await chargeSheet(page).locator("[data-stage=result]").waitFor();
      check("profile: double tap makes one charge request", customerPosts(server).length === 1, String(customerPosts(server).length));
      await page.locator("[data-extra-done]").click();
      await startDirect(page, "30");
      server.state.fp = "fp-2";
      server.state.card = { brand: "mastercard", last4: "5555", expMonth: 1, expYear: 2031 };
      await page.locator("[data-extra-charge]").click();
      await page.locator("[data-extra-error=TARGET_CHANGED]").waitFor();
      check("profile: a card changed since the sheet opened is not charged; the new card is shown", server.state.charges.length === 1 && /Mastercard •••• 5555/.test(await chargeSheet(page).locator("[data-extra-identity]").innerText()));
      await page.keyboard.press("Escape");
      check("profile: closing with an amount typed asks first", (await page.locator("text=Leave without charging?").count()) >= 1);
      await ctx.close();
    }
    {
      const { ctx, page, server } = await open(browser, OWNER, { behavior: "decline" });
      await openCustomer(page, "billing");
      await page.locator("[data-extra-block=customer]").waitFor();
      await startDirect(page, "75");
      await page.locator("[data-extra-charge]").click();
      await chargeSheet(page).locator("[data-stage=result][data-extra-status=failed]").waitFor();
      check("profile: a decline shows the bank's reason, never Paid", /insufficient funds/.test(await chargeSheet(page).locator("[data-stage=result]").innerText()));
      await page.locator("[data-extra-result-copy]").click();
      await page.locator("[data-extra-pay-url]").waitFor();
      check("profile: the payment link is for this charge, through this customer's charges", server.state.calls.some((c) => c.method === "POST" && /\/customers\/u-j1\/charges\/x1\/payment-link$/.test(c.p)));
      await ctx.close();
    }
    {
      const { ctx, page, server } = await open(browser, MANAGER);
      await openCustomer(page, "billing");
      await page.locator("[data-tab-panel=billing]").waitFor();
      await page.locator("[data-action=more]").click();
      check("a manager sees no Charges block and no Charge customer, and nothing is requested", (await page.locator("[data-extra-block]").count()) === 0 && (await page.locator("[role=menuitem]:has-text('Charge customer')").count()) === 0 && server.state.calls.length === 0);
      await ctx.close();
    }
    for (const size of [{ w: 320, h: 568 }, { w: 390, h: 844 }, { w: 1440, h: 900 }]) {
      const { ctx, page } = await open(browser, OWNER, {}, { width: size.w, height: size.h });
      await openCustomer(page, "billing");
      await page.locator("[data-extra-block=customer]").waitFor();
      await startDirect(page, "134.10");
      // Measure the settled sheet, not its slide-in.
      await chargeSheet(page).evaluate((el) => Promise.all(el.getAnimations({ subtree: true }).map((x) => x.finished)));
      const o = await overflow(page, "charge-customer");
      const btn = await page.locator("[data-extra-charge]").boundingBox();
      const input = await page.locator("input[name=extra-amount]").boundingBox();
      check(`profile ${size.w}x${size.h}: no overflow; amount and Charge visible together; 44px button`, !o.scroll && !o.bad.length && btn && btn.y + btn.height <= size.h + 1 && btn.height >= 43.5 && input && input.y >= 0 && input.y + input.height <= btn.y, JSON.stringify({ o, btn, input }));
      await page.screenshot({ path: path.join(SHOTS, `profile-charge-${size.w}x${size.h}.png`) });
      await ctx.close();
    }
  } finally {
    await browser.close();
  }
  const failedCount = results.filter((r) => !r.pass).length;
  console.log(`\n${results.length - failedCount}/${results.length} passed`);
  process.exit(failedCount ? 1 : 0);
})();
