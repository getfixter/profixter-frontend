/* eslint-disable @typescript-eslint/no-require-imports -- a plain Node script, like the other scripts/ */
/*
 * "Convert to paid visit" in a real browser: the job sheet step (Admin) and
 * the customer's payment page /pay/<token>.
 *
 *   npx next start -p 3111          (after npm run build)
 *   node scripts/test_free_visit_conversion_ui.js http://localhost:3111
 *
 * FULL NETWORK JAIL, as in test_admin_jobs_ui.js: the local server passes;
 * every URL with /api/ in its path, on ANY host (api.profixter.com included),
 * is answered here from fixtures shaped like the backend DTOs
 * (utils/freeVisit/conversion.js presentConversion / describeConversionLink,
 * utils/jobs/jobQueries.js conversionSummary); everything else is aborted and
 * recorded (and must stay empty). Fake people only (@example.test). Nothing
 * is sent, paid or booked: the fake server only records what the UI asked for.
 */
const { chromium } = require("playwright");
const fs = require("fs");
const path = require("path");

const BASE = (process.argv[2] || "http://localhost:3111").replace(/\/$/, "");
const SHOTS = process.env.SHOTS_DIR || path.join(__dirname, "..", "..", "reports", "shots", "conversion");
fs.mkdirSync(SHOTS, { recursive: true });

const OWNER = { _id: "owner1", userId: "PF-OWNER", name: "Owner Test", email: "owner@example.test", phone: "5550100", role: "admin", addresses: [] };
const TZ = "America/New_York";
const ymdNY = (d) => new Intl.DateTimeFormat("en-CA", { timeZone: TZ }).format(d);
const TODAY = ymdNY(new Date());
const addDays = (ymd, n) => {
  const [y, m, d] = ymd.split("-").map(Number);
  return new Date(Date.UTC(y, m - 1, d + n)).toISOString().slice(0, 10);
};
const iso = (ymd, h) => new Date(`${ymd}T${h}:00-05:00`).toISOString();
const SOON = addDays(TODAY, 3);

/* ---------------- jobs ---------------- */
function job(id, o) {
  return {
    id,
    bookingNumber: o.number,
    date: iso(o.day || SOON, "10:00"),
    endEstimate: iso(o.day || SOON, "11:30"),
    status: o.status || "Pending Confirmation",
    type: o.type || "free_visit",
    typeLabel: o.typeLabel || "Free Visit · To-do review",
    customer: { id: o.guest ? null : `u-${id}`, name: o.name, phone: "(631) 555-0142", phoneE164: "+16315550142", email: `${id}@example.test`, guest: Boolean(o.guest) },
    address: { line1: "12 Demo Lane", city: "Testville", state: "NY", zip: "11735", full: "12 Demo Lane, Testville, NY 11735" },
    addressShort: "12 Demo Lane",
    town: "Testville",
    technician: { id: "fx1", name: "Field Fixter" },
    flags: [],
    timing: null,
    service: "Free Visit",
    selectedTask: "Free Visit",
    description: "Dripping faucet, loose towel bar.",
    adminNote: "",
    photos: [],
    libraryReference: "",
    money: { kind: "free", label: "Free visit" },
    staffNotes: [],
    freeVisit: o.converted ? null : { channel: o.guest ? "callback" : "online", purpose: "consultation", reviewRequired: false },
    conversion: o.conversion || null,
    reservationIssue: null,
    cancellationReason: "",
    completedAt: null,
    createdAt: iso(addDays(TODAY, -5), "12:00"),
    updatedAt: new Date().toISOString(),
    allowedActions: o.allowed || ["addInternalNote", "addPhotos", "reviewFreeVisit", "cancel", "convertToPaid"],
    history: { href: `/api/admin/bookings/${id}/history` },
  };
}

function conversion(o) {
  return {
    id: o.id,
    status: o.status || "open",
    kind: o.kind || "one_time",
    plan: o.plan || "",
    billingCycle: o.billingCycle || "",
    offerLabel: o.kind === "membership" ? "Basic membership (monthly)" : "One-Time Visit",
    priceCents: o.kind === "membership" ? 14900 : 9900,
    task: "Fix the faucet",
    accountSource: "booking",
    userId: "u-1",
    contact: { name: "Jane Doe", email: "jane@example.test", phone: "+16315550142" },
    leadTime: { rule: o.rule || "", earliestMemberDate: addDays(TODAY, 7), override: null },
    linkExpiresAt: iso(addDays(TODAY, 2), "08:00"),
    checkoutOpen: Boolean(o.checkoutOpen),
    checkoutOpenedAt: null,
    termsAcceptedAt: null,
    sends: o.sends || [],
    payment: o.status === "needs_attention" || o.paid ? { paidAt: new Date().toISOString(), amountCents: o.kind === "membership" ? 14900 : 9900, currency: "usd", sessionId: "cs_test_1" } : null,
    convertedAt: null,
    attention: o.status === "needs_attention" ? { reason: o.reason || "visit_changed", message: "the visit was cancelled, completed, moved or edited while the customer was paying", at: new Date().toISOString() } : null,
    afterCancel: o.afterCancel ? { at: new Date().toISOString(), byName: "Owner Test", reason: "Declined: outside what we do", resolvedAt: null } : null,
    resolution: null,
    followUp: o.status === "needs_attention" ? "attention" : o.afterCancel ? "after_cancel" : null,
    history: [{ at: new Date().toISOString(), event: "link_created", byName: "Owner Test", detail: null }],
    createdAt: new Date().toISOString(),
    createdByName: "Owner Test",
  };
}

function options(j, o = {}) {
  return {
    booking: { id: j.id, bookingNumber: j.bookingNumber, status: j.status, date: j.date, whenLabel: "Thursday, December 3 at 10:00 AM", address: j.address.full, name: "Jane Doe", email: "jane@example.test", phone: "+16315550142", service: "Free Visit", selectedTask: "Free Visit", note: j.description, photos: 2, assignedFixterName: "Field Fixter", converted: null },
    convertible: o.convertible ?? true,
    problem: o.problem || null,
    smsAvailable: o.account?.mode !== "guest",
    offers: {
      membership: { plans: [{ key: "basic", label: "Basic", monthly: 149, annual: 1490, limit: 1 }, { key: "plus", label: "Plus", monthly: 249, annual: 2490, limit: 2 }], blocker: null },
      oneTime: { enabled: true, priceCents: 9900 },
    },
    account: o.account || { mode: "booking", id: "u-1", name: "Jane Doe", email: "jane@example.test", hasThisHome: true },
    leadTime: { visitDate: SOON, earliestMemberDate: addDays(TODAY, 7), insideMemberLeadTime: true, exemptionEligible: o.exemptionEligible ?? true, overrideRequired: o.exemptionEligible === false },
    current: o.current || null,
    earlier: [],
  };
}

function makeServer() {
  const state = { calls: [], jobs: new Map(), options: new Map(), pay: new Map() };
  const add = (j, opt) => {
    state.jobs.set(j.id, j);
    state.options.set(j.id, opt);
  };
  /* j1: a guest callback request, no account match: One-Time, then Send. */
  add(job("j1", { number: "55500101", name: "Jane Guest", guest: true }), null);
  state.options.set("j1", options(state.jobs.get("j1"), { account: { mode: "guest", candidates: [] } }));
  /* j2: an existing member's free visit inside the seven days: membership needs an explicit override. */
  add(job("j2", { number: "55500102", name: "Mel Member", status: "Confirmed" }), null);
  state.options.set("j2", options(state.jobs.get("j2"), { exemptionEligible: false }));
  /* j3: paid, needs attention. */
  const c3 = conversion({ id: "c3", status: "needs_attention", kind: "one_time" });
  add(job("j3", { number: "55500103", name: "Sam Attention", status: "Canceled", allowed: ["addInternalNote", "convertToPaid"], conversion: { converted: null, live: { id: "c3", status: "needs_attention", kind: "one_time", plan: "", billingCycle: "", linkExpiresAt: null, checkoutOpen: false, sent: ["email"], attention: { reason: "visit_changed", message: c3.attention.message } } } }), null);
  state.options.set("j3", options(state.jobs.get("j3"), { convertible: false, problem: { code: "VISIT_CLOSED", message: "This visit is Canceled; it cannot be converted." }, current: c3 }));
  /* j4: converted. */
  add(
    job("j4", {
      number: "55500104", name: "Cora Converted", status: "Pending", type: "member", typeLabel: "Membership visit", converted: true,
      allowed: ["addInternalNote", "addPhotos", "confirm", "cancel", "reschedule", "reassign", "edit"],
      conversion: { converted: { kind: "membership", plan: "basic", billingCycle: "monthly", convertedAt: new Date().toISOString(), leadTimeRule: "first_visit_exemption", fromStatus: "Pending Confirmation", fromChannel: "callback" }, live: null },
    }),
    null
  );

  /* j5: converted to a membership, then canceled: its payment and subscription wait for a decision. */
  const c5 = conversion({ id: "c5", status: "converted", kind: "membership", plan: "basic", billingCycle: "monthly", paid: true, afterCancel: true });
  add(
    job("j5", {
      number: "55500105", name: "Mona Member", status: "Canceled", type: "member", typeLabel: "Membership visit", converted: true,
      allowed: ["addInternalNote", "reinstate", "convertToPaid"],
      conversion: { converted: { conversionId: "c5", followUp: "after_cancel", resolution: null, kind: "membership", plan: "basic", billingCycle: "monthly", convertedAt: new Date().toISOString(), leadTimeRule: "none", fromStatus: "Pending Confirmation", fromChannel: "online" }, live: null },
    }),
    null
  );
  state.options.set("j5", options(state.jobs.get("j5"), { convertible: false, problem: { code: "ALREADY_CONVERTED", message: "This visit is already a paid visit." }, current: c5 }));
  const nextBill = iso(addDays(TODAY, 30), "12:00");
  state.facts = {
    c3: { kind: "one_time", offerLabel: "One-Time Visit", amountCents: 9900, currency: "usd", paidAt: new Date().toISOString(), checkedWithStripe: true, stripeError: "", oneTime: { paymentIntentId: "pi_test_c3", paymentUrl: "https://dashboard.stripe.com/test/payments/pi_test_c3", refundedCents: 0, refund: "none" } },
    c5: {
      kind: "membership", offerLabel: "Basic membership (monthly)", amountCents: 14900, currency: "usd", paidAt: new Date().toISOString(), checkedWithStripe: true, stripeError: "",
      membership: { stripeSubscriptionId: "sub_test_c5", subscriptionUrl: "https://dashboard.stripe.com/test/subscriptions/sub_test_c5", customerProfileHref: "/admin/customers/u-j5", plan: "basic", billingCycle: "monthly", status: "active", cancelAtPeriodEnd: false, cancelAt: null, nextPaymentAt: nextBill, billsAgain: true, source: "stripe" },
    },
  };
  /* The next close/resolve gets this reply first (a Stripe check the server refuses). */
  state.refuseNext = null;

  /* Payment pages. */
  const terms = { version: "paid_visit_conversion.v1", text: "I agree to the Profixter Terms of Service (https://www.profixter.com/terms). This is a single 90-minute One-Time Visit for $99, with no membership and no recurring charge. My visit on Thursday, December 3 at 10:00 AM becomes this paid visit." };
  const pc = (over = {}) => ({ kind: "one_time", offerLabel: "One-Time Visit", priceCents: 9900, billingCycle: "", firstName: "Jane", whenLabel: "Thursday, December 3 at 10:00 AM", street: "12 Demo Lane, Testville", task: "Fix the faucet", convertedStatus: "", ...over });
  state.pay.set("tokOpen0000000000000000", { status: "open", kind: "visit_conversion", itemLabel: "your One-Time Visit", conversion: pc({ terms }) });
  state.pay.set("tokConverted00000000000", { status: "converted", kind: "visit_conversion", conversion: pc({ kind: "membership", offerLabel: "Basic membership (monthly)", priceCents: 14900, billingCycle: "monthly", convertedStatus: "Confirmed" }) });
  state.pay.set("tokAttention00000000000", { status: "paid_attention", kind: "visit_conversion", conversion: pc() });
  state.pay.set("tokUnavailable000000000", { status: "unavailable", kind: "visit_conversion", conversion: pc() });
  state.pay.set("tokProcessing0000000000", { status: "processing", kind: "visit_conversion", conversion: pc(), _flipTo: "converted" });

  function handle(method, p, sp, body) {
    if (p === "/api/auth/me") return [200, OWNER];
    if (p === "/api/admin/needs-action") return [200, { generatedAt: new Date().toISOString(), total: 0, sections: [], items: [] }];
    if (p === "/api/admin/jobs" && method === "GET") return [200, { view: sp.get("view") || "today", from: TODAY, to: TODAY, total: 0, rows: [], nextCursor: null, counts: { today: 0, tomorrow: 0, week: 0, needsAction: 0 } }];
    let m = /^\/api\/admin\/jobs\/([^/]+)$/.exec(p);
    if (m) {
      const j = state.jobs.get(m[1]);
      return j ? [200, { job: j }] : [404, { code: "BOOKING_NOT_FOUND", message: "Job not found" }];
    }
    m = /^\/api\/admin\/free-visit-conversions\/bookings\/([^/]+)(?:\/([^/]+)\/(send|cancel|retry|close|payment|resolve))?$/.exec(p);
    if (m) {
      const [, bookingId, convId, action] = m;
      state.calls.push({ method, p, body, action: action || (method === "POST" ? "create" : "get"), bookingId, convId });
      const opt = state.options.get(bookingId);
      if (!opt) return [404, { code: "BOOKING_NOT_FOUND", message: "Not found" }];
      if (method === "GET" && action === "payment") return [200, { conversion: opt.current, facts: state.facts[convId], followUp: opt.current?.followUp || null }];
      if (method === "GET") return [200, opt];
      if ((action === "close" || action === "resolve") && state.refuseNext) {
        const reply = state.refuseNext;
        state.refuseNext = null;
        return reply;
      }
      if (!action) {
        if (body.kind === "membership" && opt.leadTime.overrideRequired && !body.overrideLeadTimeReason) {
          return [409, { code: "LEAD_TIME_OVERRIDE_REQUIRED", message: "Member visits are booked at least 7 days ahead.", earliestMemberDate: opt.leadTime.earliestMemberDate }];
        }
        const conv = conversion({ id: `c-${bookingId}`, kind: body.kind, plan: body.plan, billingCycle: body.billingCycle, rule: body.overrideLeadTimeReason ? "admin_override" : body.kind === "membership" ? "first_visit_exemption" : "" });
        if (body.overrideLeadTimeReason) conv.leadTime.override = { byName: "Owner Test", at: new Date().toISOString(), reason: body.overrideLeadTimeReason };
        opt.current = conv;
        return [200, { conversion: conv, payUrl: "https://www.profixter.com/pay/tokNew0000000000000000", token: "tokNew0000000000000000" }];
      }
      const conv = opt.current;
      if (action === "send") {
        const fresh = body.channels.filter((c) => !conv.sends.some((s) => s.channel === c));
        if (!fresh.length) return [409, { code: "ALREADY_SENT", message: "Already sent that way." }];
        conv.sends.push(...fresh.map((c) => ({ channel: c, to: c === "email" ? conv.contact.email : conv.contact.phone, result: "sent", at: new Date().toISOString(), byName: "Owner Test" })));
        return [200, { conversion: conv, delivery: { email: fresh.includes("email") ? "sent" : "not_requested", sms: fresh.includes("sms") ? "sent" : "not_requested" } }];
      }
      if (action === "cancel") {
        conv.status = "canceled";
        opt.current = null;
        return [200, { conversion: conv }];
      }
      if (action === "retry") return [200, { conversion: conv }];
      if (action === "close" || action === "resolve") {
        if (action === "close") conv.status = "closed";
        conv.resolution = { kind: body.resolution, for: action === "close" ? "attention" : "after_cancel", note: body.reason, at: new Date().toISOString(), byName: "Owner Test", firstPaymentRefunded: body.firstPaymentRefunded ?? null, verified: null };
        conv.followUp = null;
        opt.current = null;
        opt.earlier = [conv];
        return [200, { conversion: conv }];
      }
    }
    m = /^\/api\/pay\/([^/]+)(\/checkout)?$/.exec(p);
    if (m) {
      const s = state.pay.get(m[1]);
      if (!s) return [404, { status: "not_found" }];
      if (m[2]) {
        state.calls.push({ method, p, body, action: "pay" });
        if (body?.acceptTerms !== true || body?.termsVersion !== s.conversion?.terms?.version) return [400, { code: "TERMS_REQUIRED", message: "Please read and accept the terms to continue." }];
        return [200, { url: `${BASE}/stripe-checkout-fake` }];
      }
      const out = { ...s };
      if (s._flipTo) {
        s.status = s._flipTo;
        delete s._flipTo;
      }
      delete out._flipTo;
      return [200, out];
    }
    return [200, p.includes("summary") || p.includes("settings") ? {} : []];
  }
  return { state, handle };
}

/* ---------------- harness ---------------- */
const results = [];
function check(name, pass, detailText = "") {
  results.push({ name, pass: !!pass });
  console.log(`${pass ? "PASS" : "FAIL"}  ${name}${detailText ? "  :: " + detailText : ""}`);
}

async function open(browser, { width = 390, height = 844 } = {}) {
  const mobile = width < 1024;
  const ctx = await browser.newContext({ viewport: { width, height }, isMobile: mobile, hasTouch: mobile, serviceWorkers: "block", reducedMotion: "reduce" });
  await ctx.addInitScript(() => {
    if (location.pathname.startsWith("/admin")) localStorage.setItem("token", "ui-token");
  });
  const server = makeServer();
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
      const [status, json] = server.handle(req.method(), p, u.searchParams, body);
      return route.fulfill({ status, contentType: "application/json", headers: cors, body: JSON.stringify(json) });
    }
    /* Stands in for Stripe's own page: never part of the site, so never its tags. */
    if (u.origin === local.origin && u.pathname === "/stripe-checkout-fake") return route.fulfill({ status: 200, contentType: "text/html", body: "<!doctype html><title>Stripe (fake)</title><p>Stripe</p>" });
    if (u.origin === local.origin) return route.continue();
    external.push(u.href);
    return route.abort();
  });
  const page = await ctx.newPage();
  const errors = [];
  page.on("pageerror", (e) => errors.push(e.message));
  return { ctx, page, server, external, errors };
}

const jobSheet = (page) => page.locator("[role=dialog][data-sheet=job]");
async function openJob(page, id) {
  await page.goto(`${BASE}/admin/jobs/${id}`, { waitUntil: "domcontentloaded" });
  await jobSheet(page).locator(`[data-job-body=${id}]`).waitFor({ timeout: 20000 });
}
async function openConvert(page) {
  await jobSheet(page).locator("[data-job-more]").click();
  await page.getByRole("menuitem", { name: /Convert to paid visit|Paid visit link/ }).click();
}
/* Every button and field in the step is a 44px target on a phone. */
async function smallTargets(page, sel) {
  return page.evaluate((sel) => {
    const out = [];
    for (const el of document.querySelectorAll(`${sel} button, ${sel} input[type=radio], ${sel} select, ${sel} input[type=text], ${sel} [data-step-footer] button`)) {
      const box = (el.closest("label") || el).getBoundingClientRect();
      if (box.width && box.height < 43.5) out.push(`${el.tagName}:${(el.textContent || el.getAttribute("name") || "").trim().slice(0, 20)}:${Math.round(box.height)}`);
    }
    return out;
  }, sel);
}

(async () => {
  const browser = await chromium.launch();

  for (const size of [{ name: "390", width: 390, height: 844 }, { name: "1440", width: 1440, height: 900 }]) {
    console.log(`\n--- Admin: job sheet at ${size.name} ---`);
    const { ctx, page, server, external, errors } = await open(browser, size);

    /* One-Time for a guest: make the link, nothing sent; then Send. */
    await openJob(page, "j1");
    await openConvert(page);
    await page.locator("[data-convert-step=form]").waitFor({ timeout: 15000 });
    const formText = await page.locator("[data-convert-step=form]").innerText();
    check(`${size.name}: the form shows the visit it keeps (time, address, Fixter)`, /December 3 at 10:00 AM/.test(formText) && /12 Demo Lane/.test(formText) && /Field Fixter/.test(formText));
    check(`${size.name}: it says nothing changes until paid`, /Nothing changes until the customer has paid/.test(formText));
    if (size.name === "390") {
      const small = await smallTargets(page, "[data-convert-step=form]");
      check("390: every control in the form is a 44px target", small.length === 0, small.join(", "));
    }
    await page.locator("[data-convert-kind=one_time]").check();
    await page.locator("[data-convert-task]").fill("Fix the faucet");
    await page.screenshot({ path: path.join(SHOTS, `form-${size.name}.png`) });
    await page.locator("[data-convert-create]").click();
    await page.locator("[data-convert-link]").waitFor({ timeout: 10000 });
    const create = server.state.calls.find((c) => c.action === "create" && c.bookingId === "j1");
    check(`${size.name}: Create sends the choice (One-Time, task) and nothing else`, create && create.body.kind === "one_time" && create.body.task === "Fix the faucet" && !create.body.plan, JSON.stringify(create?.body));
    check(`${size.name}: making the link sent nothing`, !server.state.calls.some((c) => c.action === "send"));
    const linkText = await page.locator("[data-convert-link]").innerText();
    check(`${size.name}: the link is shown once, with Copy, and says nothing was sent`, /profixter\.com\/pay\/tokNew/.test(linkText) && /Nothing has been sent/.test(linkText) && (await page.locator("[data-convert-copy]").count()) === 1);
    await page.screenshot({ path: path.join(SHOTS, `link-${size.name}.png`) });
    await page.locator("[data-convert-send]").click();
    await page.locator("[data-convert-sends]").waitFor({ timeout: 10000 });
    const send = server.state.calls.find((c) => c.action === "send");
    check(`${size.name}: a homepage guest's link is sent by email only; Text says why`, send && send.body.token === "tokNew0000000000000000" && send.body.channels.join() === "email", JSON.stringify(send?.body));
    const chText = await page.locator("[data-convert-channels]").innerText();
    check(`${size.name}: after sending, email shows sent, Text is unavailable, and Send is off`, /\(sent\)/.test(chText) && /not for this guest/.test(chText) && (await page.locator("[data-convert-send]").isDisabled()));

    /* Membership for an existing member inside the seven days: the override is explicit. */
    await openJob(page, "j2");
    await openConvert(page);
    await page.locator("[data-convert-step=form]").waitFor({ timeout: 15000 });
    await page.locator("[data-convert-kind=membership]").check();
    const lt = await page.locator("[data-convert-lead-time]").innerText();
    check(`${size.name}: inside the seven days, an existing member's override is offered, not assumed`, /already has a membership/.test(lt) && (await page.locator("[data-convert-override]").isChecked()) === false);
    await page.locator("[data-convert-override]").check();
    check(`${size.name}: an override needs a reason before Create`, await page.locator("[data-convert-create]").isDisabled());
    await page.locator("[data-convert-override-reason]").fill("Agreed on the call with the customer");
    await page.locator("[data-convert-create]").click();
    await page.locator("[data-convert-step=status]").waitFor({ timeout: 10000 });
    const c2 = server.state.calls.filter((c) => c.action === "create" && c.bookingId === "j2").pop();
    check(`${size.name}: the membership choice and the override reason are sent`, c2 && c2.body.kind === "membership" && c2.body.plan === "basic" && c2.body.billingCycle === "monthly" && /Agreed on the call/.test(c2.body.overrideLeadTimeReason), JSON.stringify(c2?.body));
    check(`${size.name}: the status shows who overrode the rule and why`, /overridden by Owner Test: Agreed on the call/.test(await page.locator("[data-convert-step=status]").innerText()));

    /* Paid but not converted: the notice, Retry and Close. */
    await openJob(page, "j3");
    const notice = await jobSheet(page).locator("[data-conversion-notice=needs_attention]").innerText();
    check(`${size.name}: the job says it was paid but not converted`, /Paid for One-Time Visit, but not converted/.test(notice));
    await jobSheet(page).locator("[data-conversion-open]").click();
    await page.locator("[data-convert-attention]").waitFor({ timeout: 10000 });
    const att = await page.locator("[data-convert-step=status]").innerText();
    check(`${size.name}: needs attention says the visit was not changed and the customer was told`, /visit was not changed/.test(att) && /They were told their payment arrived/.test(att));
    await page.locator("[data-convert-payment-facts]").waitFor({ timeout: 10000 });
    check(`${size.name}: the payment is shown as Stripe has it: paid $99, no refund yet, with the Stripe link`, /Paid \$99/.test(await page.locator("[data-convert-payment-facts]").innerText()) && (await page.locator("[data-convert-refund=none]").count()) === 1);
    check(`${size.name}: Close needs a resolution and a note`, await page.locator("[data-convert-close]").isDisabled());
    await page.locator("[data-convert-retry]").click();
    await page.waitForTimeout(300);
    check(`${size.name}: Retry calls the server`, server.state.calls.some((c) => c.action === "retry" && c.convId === "c3"));
    await page.locator("[data-convert-resolution=refunded]").check();
    await page.locator("[data-convert-close-reason]").fill("Refunded in Stripe");
    server.state.refuseNext = [409, { code: "NOT_REFUNDED", message: "Stripe shows no refund on this payment yet. Refund it in Stripe first, then record it here." }];
    await page.locator("[data-convert-close]").click();
    await page.locator("[data-convert-error=NOT_REFUNDED]").waitFor({ timeout: 10000 });
    check(`${size.name}: a refund Stripe does not show is refused, and the reason is shown`, /Refund it in Stripe first/.test(await page.locator("[data-convert-error=NOT_REFUNDED]").innerText()));
    await page.locator("[data-convert-close]").click();
    await page.waitForTimeout(400);
    const close = server.state.calls.filter((c) => c.action === "close").pop();
    check(`${size.name}: Close sends the resolution and the note`, close && close.body.reason === "Refunded in Stripe" && close.body.resolution === "refunded", JSON.stringify(close?.body));
    await page.screenshot({ path: path.join(SHOTS, `attention-${size.name}.png`) });

    /* Converted: the job says where it came from. */
    await openJob(page, "j4");
    const conv = await jobSheet(page).locator("[data-conversion-notice=converted]").innerText();
    check(`${size.name}: a converted visit says it came from a free visit and what it is now`, /Converted from a free visit/.test(conv) && /Basic membership visit/.test(conv) && /was Pending Confirmation/.test(conv));
    check(`${size.name}: a converted visit offers no Convert action`, !(await (async () => {
      await jobSheet(page).locator("[data-job-more]").click();
      const n = await page.getByRole("menuitem", { name: /Convert to paid visit/ }).count();
      await page.keyboard.press("Escape");
      return n;
    })()));

    /* Converted to a membership: the Cancel step warns that the membership is not canceled. */
    await openJob(page, "j4");
    await jobSheet(page).locator("[data-job-more]").click();
    await page.getByRole("menuitem", { name: /Cancel job/ }).click();
    await page.locator("[data-cancel-converted]").waitFor({ timeout: 10000 });
    const warn = await page.locator("[data-cancel-converted]").innerText();
    check(`${size.name}: canceling a converted membership visit warns it does not cancel the membership or refund`, /does not cancel the membership or refund/.test(warn) && /a refund in Stripe alone does not stop it/.test(warn) && /Needs action/.test(warn), warn);
    await page.keyboard.press("Escape");

    /* Canceled after it was paid as a membership: payment, subscription, and an explicit decision. */
    await openJob(page, "j5");
    const ac = await jobSheet(page).locator("[data-conversion-notice=after_cancel]").innerText();
    check(`${size.name}: the job says it was canceled after payment and the membership still bills`, /Canceled after it was paid/.test(ac) && /still bills/.test(ac), ac);
    await jobSheet(page).locator("[data-conversion-open]").click();
    await page.locator("[data-convert-after-cancel]").waitFor({ timeout: 10000 });
    await page.locator("[data-convert-payment-facts]").waitFor({ timeout: 10000 });
    const facts = await page.locator("[data-convert-payment-facts]").innerText();
    check(`${size.name}: it shows the payment and that the subscription bills again, with the profile link`, /Paid \$149/.test(facts) && (await page.locator("[data-convert-subscription=billing]").count()) === 1 && /bills again on/.test(facts) && (await page.locator("[data-convert-profile]").count()) === 1, facts);
    check(`${size.name}: it says a refund alone does not stop the next payment`, /does not stop the membership.s next payment/.test(await page.locator("[data-convert-refund-warning]").innerText()));
    await page.locator("[data-convert-resolution=membership_canceled]").check();
    await page.locator("[data-convert-close-reason]").fill("Canceled on the profile, refunded the first month");
    check(`${size.name}: "Membership canceled" asks whether the first payment was refunded before recording`, (await page.locator("[data-convert-first-refund]").count()) === 1 && (await page.locator("[data-convert-resolve]").isDisabled()));
    await page.locator("[data-convert-first-refund-answer=yes]").check();
    server.state.refuseNext = [409, { code: "MEMBERSHIP_STILL_BILLING", message: "The membership is still active in Stripe and will bill again. Cancel it on the customer's profile first. A refund alone does not stop the next payment." }];
    await page.locator("[data-convert-resolve]").click();
    await page.locator("[data-convert-error=MEMBERSHIP_STILL_BILLING]").waitFor({ timeout: 10000 });
    check(`${size.name}: a membership that still bills is refused with the reason`, /A refund alone does not stop the next payment/.test(await page.locator("[data-convert-error=MEMBERSHIP_STILL_BILLING]").innerText()));
    if (size.name === "390") {
      const small = await smallTargets(page, "[data-convert-payment]");
      check("390: every control in the payment panel is a 44px target", small.length === 0, small.join(", "));
    }
    await page.screenshot({ path: path.join(SHOTS, `after-cancel-${size.name}.png`) });
    await page.locator("[data-convert-resolve]").click();
    await page.locator("[data-convert-resolution-recorded=membership_canceled]").waitFor({ timeout: 10000 });
    const res = server.state.calls.filter((c) => c.action === "resolve").pop();
    check(`${size.name}: Record sends the decision, the refund answer and the note`, res && res.body.resolution === "membership_canceled" && res.body.firstPaymentRefunded === true && /Canceled on the profile/.test(res.body.reason), JSON.stringify(res?.body));
    check(`${size.name}: no call ever asked the server to refund or cancel`, !server.state.calls.some((c) => /refund|subscription/i.test(c.p) && c.method !== "GET"));

    check(`${size.name}: no page errors`, errors.length === 0, errors.join(" | "));
    check(`${size.name}: no request left the machine`, external.length === 0, external.slice(0, 3).join(" "));
    await ctx.close();
  }

  console.log("\n--- Customer: /pay/<token> ---");
  {
    const { ctx, page, server, external, errors } = await open(browser, { width: 390, height: 844 });
    await page.goto(`${BASE}/pay/tokOpen0000000000000000`, { waitUntil: "domcontentloaded" });
    await page.locator("[data-conversion-terms]").waitFor({ timeout: 20000 });
    const text = await page.locator("[data-pay-state=open]").innerText();
    check("pay: shows the visit's day, time and street, and the offer and price", /December 3 at 10:00 AM/.test(text) && /12 Demo Lane/.test(text) && /One-Time Visit · \$99/.test(text));
    check("pay: shows no email or phone", !/@example\.test|555-0142/.test(text));
    check("pay: Pay is off until the terms are ticked", await page.locator("[data-action=pay]").isDisabled());
    check("pay: the terms say what is agreed and link to them", /no membership and no recurring charge/.test(text) && (await page.locator("[data-conversion-terms] a[href='/terms']").count()) === 1);
    await page.screenshot({ path: path.join(SHOTS, "pay-open-390.png") });
    await page.locator("#conversion-terms").check();
    await Promise.all([page.waitForURL(/stripe-checkout-fake/, { timeout: 10000 }).catch(() => null), page.locator("[data-action=pay]").click()]);
    const pay = server.state.calls.find((c) => c.action === "pay");
    check("pay: Pay sends the accepted terms version, then goes to Stripe", pay && pay.body.acceptTerms === true && pay.body.termsVersion === "paid_visit_conversion.v1" && /stripe-checkout-fake/.test(page.url()), JSON.stringify(pay?.body));

    await page.goto(`${BASE}/pay/tokConverted00000000000`, { waitUntil: "domcontentloaded" });
    await page.locator("[data-pay-state=converted]").waitFor({ timeout: 15000 });
    const done = await page.locator("[data-pay-state=converted]").innerText();
    check("pay: converted says what the visit is now, and that it is confirmed", /now a Basic membership visit/.test(done) && /confirmed/.test(done));
    await page.screenshot({ path: path.join(SHOTS, "pay-converted-390.png") });

    await page.goto(`${BASE}/pay/tokAttention00000000000`, { waitUntil: "domcontentloaded" });
    await page.locator("[data-pay-state=paid_attention]").waitFor({ timeout: 15000 });
    const att = await page.locator("[data-pay-state=paid_attention]").innerText();
    check("pay: paid but not converted never claims an upgrade", /We received your payment/.test(att) && /nothing about it has changed yet/.test(att) && !/is now/.test(att));

    await page.goto(`${BASE}/pay/tokUnavailable000000000`, { waitUntil: "domcontentloaded" });
    await page.locator("[data-pay-state=unavailable]").waitFor({ timeout: 15000 });
    check("pay: a changed visit cannot be paid here", /changed since this link was sent/.test(await page.locator("[data-pay-state=unavailable]").innerText()) && (await page.locator("[data-action=pay]").count()) === 0);

    await page.goto(`${BASE}/pay/tokProcessing0000000000?paid=1`, { waitUntil: "domcontentloaded" });
    await page.locator("[data-pay-state=processing]").waitFor({ timeout: 15000 });
    check("pay: back from Stripe it says it is confirming", /Almost done/.test(await page.locator("[data-pay-state=processing]").innerText()));
    await page.locator("[data-pay-state=converted]").waitFor({ timeout: 10000 }).catch(() => null);
    check("pay: and then shows the conversion once the server has it", (await page.locator("[data-pay-state=converted]").count()) === 1);

    check("pay: no page errors", errors.length === 0, errors.join(" | "));
    check("pay: no request left the machine", external.length === 0, external.slice(0, 3).join(" "));
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
