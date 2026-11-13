/* eslint-disable @typescript-eslint/no-require-imports -- a plain Node script, like the other scripts/ */
/*
 * Charge extra in a real browser: the owner's fast path, failures, links,
 * keyboard safety and the history on the job.
 *
 *   npx next start -p 3130          (after npm run build)
 *   node scripts/test_admin_extra_charges_ui.js http://localhost:3130
 *
 * FULL NETWORK JAIL: the local server passes; every /api/ URL on any host is
 * answered here by a small stateful fake shaped like the real routes
 * (BackEnd routes/adminExtraCharges.js); everything else is aborted and must
 * stay empty. Fake people only (@example.test). Nothing is charged anywhere.
 */
const { chromium } = require("playwright");
const fs = require("fs");
const path = require("path");

const BASE = (process.argv[2] || "http://localhost:3130").replace(/\/$/, "");
const SHOTS = process.env.SHOTS_DIR || path.join(__dirname, "..", "..", "reports", "shots", "extra-charges");
fs.mkdirSync(SHOTS, { recursive: true });

const OWNER = { _id: "owner1", userId: "PF-OWNER", name: "Owner Test", email: "owner@example.test", phone: "5550100", role: "admin", addresses: [] };
const GENERAL = { _id: "gf1", userId: "PF-GF", name: "Gina General", email: "gina@example.test", phone: "5550102", role: "employee", employeePosition: "General Fixter", isActive: true, permissions: ["bookings.read", "bookings.write", "bookings.assign"], addresses: [] };

const TZ = "America/New_York";
const iso = (h) => new Date(Date.now() + h * 3600_000).toISOString();

function baseJob(id, o = {}) {
  return {
    id,
    bookingNumber: o.number || "55501234",
    date: iso(-3),
    endEstimate: iso(-1.5),
    status: o.status || "Completed",
    type: "member",
    typeLabel: "Membership visit",
    customer: { id: o.guest ? null : `u-${id}`, name: o.name || "Maria Rivera-Montgomery", phone: "(631) 555-0142", phoneE164: "+16315550142", email: o.email === undefined ? "maria@example.test" : o.email, guest: Boolean(o.guest), visitsCompleted: 4 },
    address: { line1: "1287 Old Country Road, Apt 12B", city: "Huntington Station", state: "NY", zip: "11746", full: "1287 Old Country Road, Apt 12B, Huntington Station, NY 11746" },
    addressShort: "1287 Old Country Road, Apt 12B",
    town: "Huntington Station",
    technician: { id: "fx2", name: "Gina General" },
    flags: [],
    timing: null,
    service: "Handyman visit",
    selectedTask: "Fix a leaking faucet",
    description: "The kitchen faucet drips.",
    adminNote: "",
    photos: [],
    libraryReference: "",
    money: { kind: "membership_included", label: "Included in the membership" },
    staffNotes: [],
    freeVisit: null,
    reservationIssue: null,
    cancellationReason: "",
    completedAt: iso(-1),
    createdAt: iso(-240),
    updatedAt: iso(-1),
  };
}

const money2 = (c) => `$${(c / 100).toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

/* ---------------- the fake API (mirrors the server's rules) ---------------- */
function makeServer(user, scenario = {}) {
  const owner = user.role === "admin";
  const card = scenario.card === undefined ? { brand: "visa", last4: "4242", expMonth: 12, expYear: 2030 } : scenario.card;
  const state = { charges: [], calls: [], keys: new Map(), behavior: scenario.behavior || "ok", failOnceNetwork: Boolean(scenario.failOnceNetwork) };
  const jobs = { j1: baseJob("j1", scenario.job || {}) };
  const detail = (j) => ({
    ...j,
    allowedActions: ["addInternalNote", "addPhotos", ...(owner ? ["chargeExtra"] : [])],
    ...(owner ? { extraCharges: { count: state.charges.length, paidCents: 0, open: 0 } } : {}),
    history: { href: `/api/admin/bookings/${j.id}/history` },
  });
  const tax = (cents, t) => (t === "Taxable Repair / Maintenance" ? Math.round((cents * 8.625) / 100) : 0);
  const toCents = (a) => {
    const m = String(a || "").replace(/[$,\s]/g, "").match(/^(\d{1,6})(?:\.(\d{1,2}))?$/);
    return m ? Number(m[1]) * 100 + Number((m[2] || "").padEnd(2, "0")) : null;
  };
  function preview(j, b) {
    const sub = toCents(b.amount);
    const t = b.taxTreatment;
    const tc = tax(sub, t);
    const noTax = !t || t === "Not Determined";
    const direct = scenario.guest ? { allowed: false, code: "GUEST_BOOKING", message: "This is a guest visit with no account, so there is no saved card to charge. Use a payment link." } : card ? { allowed: true } : { allowed: false, code: "NO_SAVED_CARD", message: "There is no saved card on this customer. Use a payment link." };
    const total = noTax ? null : sub + tc;
    return {
      booking: { id: j.id, number: j.bookingNumber, date: j.date, service: j.service, status: j.status },
      customer: { name: j.customer.name, guest: Boolean(scenario.guest), accountLinked: !scenario.guest, hasEmail: true, hasPhone: true },
      serviceAddress: { line1: j.address.line1, unit: "", city: j.address.city, state: "NY", zip: j.address.zip, full: j.address.full },
      card: scenario.guest ? null : card,
      description: b.description,
      subtotalCents: sub,
      taxCents: noTax ? null : tc,
      totalCents: total,
      tax: noTax ? { ok: false, treatment: "Not Determined", code: "TAX_TREATMENT_REQUIRED", message: "Choose how sales tax applies to this work before charging." } : { ok: true, treatment: t, source: tc ? "stripe_tax" : "owner_treatment", ratePercent: tc ? "8.625" : "0", taxCode: tc ? "txcd_20030000" : "" },
      direct: noTax ? { allowed: false, code: "TAX_TREATMENT_REQUIRED" } : direct,
      link: noTax ? { allowed: false } : { allowed: true, canSend: true },
      consentStatement: total ? `I confirm the customer agreed to this additional work and to the total of ${money2(total)}.` : "",
      fingerprint: `fp-${sub}-${tc}-${b.description.length}`,
    };
  }
  function record(j, b, p, method) {
    const n = state.charges.length + 1;
    const c = {
      id: `x${n}`,
      number: `${j.bookingNumber}-E${n}`,
      description: b.description,
      subtotalCents: p.subtotalCents,
      taxCents: p.taxCents,
      totalCents: p.totalCents,
      tax: { treatment: p.tax.treatment, source: p.tax.source, ratePercent: p.tax.ratePercent, taxCode: p.tax.taxCode, recorded: true, recordError: "" },
      status: "awaiting_payment",
      statusLabel: "Awaiting payment",
      method,
      createdAt: new Date().toISOString(),
      createdByName: user.name,
      consent: { statement: p.consentStatement, confirmedByName: user.name, confirmedAt: new Date().toISOString(), writtenApprovalRef: b.writtenApprovalRef || "" },
      customerName: j.customer.name,
      guest: Boolean(scenario.guest),
      card: method === "card" ? { brand: card.brand, last4: card.last4 } : null,
      paidAt: null,
      failure: null,
      refundedCents: 0,
      stripeUrl: "",
      receiptUrl: "",
      extraPayments: [],
      link: null,
      actions: [],
    };
    state.charges.push(c);
    return c;
  }
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
    } else if (state.behavior === "processing") {
      setStatus(c, "processing");
    } else {
      setStatus(c, "paid");
      c.paidAt = new Date().toISOString();
      c.stripeUrl = "https://dashboard.stripe.com/test/payments/pi_fake1";
      c.receiptUrl = "https://pay.stripe.test/receipts/pi_fake1";
    }
  }
  function handle(method, p, sp, body) {
    if (p === "/api/auth/me") return [200, user];
    if (p === "/api/admin/needs-action") return [200, { generatedAt: new Date().toISOString(), total: 0, sections: [], items: [] }];
    if (p === "/api/admin/jobs" && method === "GET") return [200, { view: "today", from: null, to: null, total: 1, rows: [detail(jobs.j1)], nextCursor: null, counts: { today: 1, tomorrow: 0, week: 1, needsAction: 0 } }];
    if (/\/history$/.test(p)) return [200, { history: [], records: [] }];
    let m = /^\/api\/admin\/jobs\/([^/]+)$/.exec(p);
    if (m && method === "GET") return jobs[m[1]] ? [200, { job: detail(jobs[m[1]]) }] : [404, { message: "Job not found", code: "BOOKING_NOT_FOUND" }];
    m = /^\/api\/admin\/jobs\/([^/]+)\/extra-charges(?:\/(preview))?$/.exec(p);
    if (m) {
      if (!owner) return [403, { code: "OWNER_ONLY", message: "Only the owner can charge extras." }];
      const j = jobs[m[1]];
      state.calls.push({ method, p, body });
      if (method === "GET") return [200, { charges: state.charges }];
      if (m[2] === "preview") return [200, { preview: preview(j, body) }];
      if (state.failOnceNetwork) {
        state.failOnceNetwork = false;
        state.lostKey = body.idempotencyKey;
        return [502, { message: "Bad gateway" }];
      }
      if (state.keys.has(body.idempotencyKey)) return [200, { charge: state.keys.get(body.idempotencyKey), replayed: true }];
      if (body.customerAgreed !== true) return [428, { code: "CONFIRMATION_REQUIRED", message: "Confirm that the customer agreed to this work and this total." }];
      const pv = preview(j, body);
      if (body.previewFingerprint !== pv.fingerprint || body.expectedTotalCents !== pv.totalCents) return [409, { code: "PREVIEW_CHANGED", message: "Something changed since you reviewed this.", preview: pv }];
      const c = record(j, body, pv, body.method);
      if (body.method === "card") chargeCard(c);
      else {
        setStatus(c, "awaiting_payment");
        c.link = { status: "open", expiresAt: iso(24 * 7), sentVia: body.send ? body.channels : [], delivery: null };
      }
      state.keys.set(body.idempotencyKey, c);
      const delivery = body.send ? { email: body.channels.includes("email") ? "sent" : "not_requested", sms: body.channels.includes("sms") ? "skipped:transactional_not_opted_in" : "not_requested" } : undefined;
      return [201, { charge: c, replayed: false, ...(body.method === "link" ? { payUrl: "https://www.profixter.com/pay/TESTTOKENabcdefghij12" } : {}), ...(delivery ? { delivery } : {}) }];
    }
    m = /^\/api\/admin\/jobs\/([^/]+)\/extra-charges\/([^/]+)\/(refresh|retry-card|payment-link|close)$/.exec(p);
    if (m) {
      if (!owner) return [403, { code: "OWNER_ONLY", message: "Only the owner can charge extras." }];
      state.calls.push({ method, p, body });
      const c = state.charges.find((x) => x.id === m[2]);
      if (!c) return [404, { code: "NOT_FOUND", message: "Charge not found" }];
      if (m[3] === "refresh") {
        if (c.status === "processing" && state.settleOnRefresh) {
          setStatus(c, "paid");
          c.paidAt = new Date().toISOString();
          c.stripeUrl = "https://dashboard.stripe.com/test/payments/pi_fake2";
        }
        return [200, { charge: c }];
      }
      if (m[3] === "payment-link") {
        setStatus(c, "awaiting_payment");
        c.link = { status: "open", expiresAt: iso(24 * 7), sentVia: body.send ? body.channels : [], delivery: null };
        return [200, { charge: c, payUrl: "https://www.profixter.com/pay/TESTTOKENzyxwvutsrq98", delivery: body.send ? { email: "sent", sms: "not_requested" } : null }];
      }
      if (m[3] === "retry-card") {
        state.behavior = "ok";
        chargeCard(c);
        return [200, { charge: c }];
      }
      if (m[3] === "close") {
        setStatus(c, "canceled");
        return [200, { charge: c }];
      }
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
async function openJob(page) {
  await page.goto(`${BASE}/admin/jobs/j1`, { waitUntil: "domcontentloaded" });
  await sheet(page).locator("[data-job-body=j1]").waitFor({ timeout: 20000 });
}
async function fill(page, { description = "Replace two GFCI outlets in the kitchen", amount = "123.45", tax = "Taxable Repair / Maintenance", approval = "" } = {}) {
  await page.locator("[data-extra-open]").click();
  await page.locator("[data-stage=enter]").waitFor();
  await page.locator("textarea[name=extra-description]").fill(description);
  await page.locator("input[name=extra-amount]").fill(amount);
  if (tax) await page.locator(`[data-extra-tax] label:has-text("${{ "Taxable Repair / Maintenance": "Taxable repair", "Capital Improvement - No Sales Tax": "Capital improvement", "Tax Exempt": "Tax exempt" }[tax]}")`).click();
  if (approval) await page.locator("input[name=extra-approval]").fill(approval);
}
async function overflow(page) {
  return page.evaluate(() => {
    const d = document.querySelector("[role=dialog][data-sheet=job]");
    const vw = document.documentElement.clientWidth;
    const bad = [];
    for (const el of d.querySelectorAll("*")) {
      const r = el.getBoundingClientRect();
      if (r.width && r.right > vw + 1) bad.push(`${el.tagName}.${String(el.className).slice(0, 30)} ${Math.round(r.right)}`);
    }
    return { vw, scroll: document.documentElement.scrollWidth > vw + 1, bad: bad.slice(0, 5) };
  });
}

(async () => {
  const browser = await chromium.launch();
  try {
    /* 1. fast path: enter -> review -> confirm -> paid */
    {
      const { ctx, page, server, external, errors } = await open(browser, OWNER);
      await openJob(page);
      check("owner: Additional charges section and Charge extra button on the job", (await page.locator("[data-extra-block] [data-extra-open]").count()) === 1);
      await fill(page);
      const pad = await page.locator("input[name=extra-amount]").evaluate((el) => parseFloat(getComputedStyle(el).paddingLeft));
      check("the $ sign never covers the amount (input padded past it)", pad >= 24, String(pad));
      const reviewBtn = page.locator("[data-extra-review]");
      check("Review is enabled once description, amount and tax are given", await reviewBtn.isEnabled());
      await page.screenshot({ path: path.join(SHOTS, "1-enter-390x844.png") });
      await reviewBtn.click();
      await page.locator("[data-stage=review]").waitFor();
      const total = 12345 + Math.round((12345 * 8.625) / 100);
      const txt = await page.locator("[data-stage=review]").innerText();
      check("review shows the customer, job number, service address and card", /Maria Rivera-Montgomery/.test(txt) && /#55501234/.test(txt) && /1287 Old Country Road, Apt 12B, Huntington Station, NY 11746/.test(txt) && /Visa •••• 4242/.test(txt), txt.slice(0, 200));
      check("review shows subtotal, tax and total", /\$123\.45/.test(txt) && /Sales tax \(8\.625%\)/.test(txt) && txt.includes(money2(total)));
      const chargeBtn = page.locator("[data-extra-charge]");
      check("the confirmation is NOT preselected and the charge button waits for it", !(await page.locator("input[name=extra-agreed]").isChecked()) && (await chargeBtn.isDisabled()));
      check(`the final button states the exact total: Charge ${money2(total)}`, (await chargeBtn.innerText()).trim() === `Charge ${money2(total)}`, await chargeBtn.innerText());
      check("the confirmation does not claim to prove the customer's consent", /does not prove the customer/.test(txt));
      await page.screenshot({ path: path.join(SHOTS, "2-review-390x844.png") });
      await page.locator("[data-extra-consent]").click();
      await page.screenshot({ path: path.join(SHOTS, "3-confirm-ticked-390x844.png") });
      await chargeBtn.click();
      await page.locator("[data-stage=result][data-extra-status=paid]").waitFor();
      check("result: Paid with the amount and the card, only after the server said paid", /Paid \$134\.10/.test(await page.locator("[data-stage=result]").innerText()) && /Visa •••• 4242/.test(await page.locator("[data-stage=result]").innerText()));
      const sent = server.state.calls.find((c) => c.method === "POST" && /extra-charges$/.test(c.p));
      check("the confirm sends no customer, Stripe customer or card id, and the key in the body", sent && !/customerId|stripeCustomer|paymentMethod|cus_|pm_/.test(JSON.stringify(sent.body)) && /^[A-Za-z0-9_.:-]{8,120}$/.test(sent.body.idempotencyKey) && sent.body.customerAgreed === true && sent.body.method === "card", JSON.stringify(sent?.body || {}));
      await page.screenshot({ path: path.join(SHOTS, "4-paid-390x844.png") });
      await page.locator("[data-extra-done]").click();
      await page.locator("[data-extra-row=paid]").waitFor();
      const row = await page.locator("[data-extra-row=paid]").innerText();
      check("history row: description, totals, status, owner, card, Stripe and receipt links", /Replace two GFCI outlets/.test(row) && /\$123\.45/.test(row) && /\$10\.65/.test(row) && /\$134\.10/.test(row) && /Paid/.test(row) && /by Owner Test/.test(row) && /Visa •••• 4242/.test(row) && (await page.locator("[data-extra-row=paid] [data-extra-stripe]").count()) === 1 && (await page.locator("[data-extra-row=paid] [data-extra-receipt]").count()) === 1, row);
      check("'Refund in Stripe' link for a paid extra", /Refund in Stripe/.test(row));
      await page.screenshot({ path: path.join(SHOTS, "5-history-390x844.png"), fullPage: false });
      await page.locator("[data-extra-block]").scrollIntoViewIfNeeded();
      await page.screenshot({ path: path.join(SHOTS, "5b-history-section-390x844.png") });
      check("no outside requests, no page errors (owner path)", external.length === 0 && errors.length === 0, [...external, ...errors].join(" | "));
      await ctx.close();
    }

    /* 2. double tap: one request carries one key; a second press does nothing */
    {
      const { ctx, page, server } = await open(browser, OWNER);
      await openJob(page);
      await fill(page, { tax: "Capital Improvement - No Sales Tax", amount: "250" });
      await page.locator("[data-extra-review]").click();
      await page.locator("[data-stage=review]").waitFor();
      check("capital improvement: tax shown as none, button Charge $250.00", (await page.locator("[data-extra-charge]").innerText()).trim() === "Charge $250.00" && /none: capital improvement/.test(await page.locator("[data-extra-totals]").innerText()));
      await page.locator("[data-extra-consent]").click();
      await page.locator("[data-extra-charge]").dblclick();
      await page.locator("[data-stage=result]").waitFor();
      const posts = server.state.calls.filter((c) => c.method === "POST" && /extra-charges$/.test(c.p));
      check("double tap: one charge request", posts.length === 1, String(posts.length));
      await ctx.close();
    }

    /* 3. network failure: details kept, the retry carries the SAME key */
    {
      const { ctx, page, server } = await open(browser, OWNER, { failOnceNetwork: true });
      await openJob(page);
      await fill(page, { approval: "Text from Maria 2:14 pm" });
      await page.locator("[data-extra-review]").click();
      await page.locator("[data-stage=review]").waitFor();
      await page.locator("[data-extra-consent]").click();
      await page.locator("[data-extra-charge]").click();
      await page.locator("[data-extra-error]").waitFor();
      check("a failed request keeps everything on screen, with a clear error", (await page.locator("[data-stage=review]").count()) === 1 && (await page.locator("input[name=extra-agreed]").isChecked()));
      await page.screenshot({ path: path.join(SHOTS, "6-network-error-390x844.png") });
      await page.locator("[data-extra-charge]").click();
      await page.locator("[data-stage=result][data-extra-status=paid]").waitFor();
      const posts = server.state.calls.filter((c) => c.method === "POST" && /extra-charges$/.test(c.p));
      check("the retry sends the same idempotency key (resolves the first attempt, never a second charge)", posts.length === 2 && posts[0].body.idempotencyKey === posts[1].body.idempotencyKey && posts[1].body.writtenApprovalRef === "Text from Maria 2:14 pm");
      await ctx.close();
    }

    /* 4. decline -> payment link from the same charge */
    {
      const { ctx, page, server } = await open(browser, OWNER, { behavior: "decline" });
      await openJob(page);
      await fill(page);
      await page.locator("[data-extra-review]").click();
      await page.locator("[data-stage=review]").waitFor();
      await page.locator("[data-extra-consent]").click();
      await page.locator("[data-extra-charge]").click();
      await page.locator("[data-stage=result][data-extra-status=failed]").waitFor();
      const t = await page.locator("[data-stage=result]").innerText();
      check("decline: Not charged, with the reason, never 'paid'", /Not charged/.test(t) && /insufficient funds/.test(t) && !/Paid/.test(t));
      await page.screenshot({ path: path.join(SHOTS, "7-declined-390x844.png") });
      await page.locator("[data-extra-result-copy]").click();
      await page.locator("[data-extra-pay-url]").waitFor();
      check("Copy payment link on the same charge shows the link and Awaiting payment", /pay\/TESTTOKEN/.test(await page.locator("[data-extra-pay-url]").innerText()) && (await page.locator("[data-extra-status=awaiting_payment]").count()) === 1);
      check("no automatic retry: one card attempt only", server.state.calls.filter((c) => /retry-card/.test(c.p)).length === 0);
      await page.screenshot({ path: path.join(SHOTS, "8-link-after-decline-390x844.png") });
      await ctx.close();
    }

    /* 5. authentication required, processing then settled */
    {
      const { ctx, page } = await open(browser, OWNER, { behavior: "auth" });
      await openJob(page);
      await fill(page);
      await page.locator("[data-extra-review]").click();
      await page.locator("[data-stage=review]").waitFor();
      await page.locator("[data-extra-consent]").click();
      await page.locator("[data-extra-charge]").click();
      await page.locator("[data-stage=result][data-extra-status=failed]").waitFor();
      check("authentication required: tells the owner to send a payment link", /approve this payment themselves/.test(await page.locator("[data-stage=result]").innerText()));
      await page.locator("[data-extra-result-send]").click();
      check("after a failure, Send waits for an explicit channel", await page.locator("[data-extra-result-send-confirm]").isDisabled());
      await page.locator("[data-extra-result-channels] label:has-text('Email')").click();
      await page.locator("[data-extra-result-send-confirm]").click();
      await page.locator("[data-stage=result][data-extra-status=awaiting_payment]").waitFor();
      check("after a failure, Send payment link reports what was sent", /Email sent/.test(await page.locator("[data-stage=result]").innerText()));
      await page.screenshot({ path: path.join(SHOTS, "7b-sent-after-auth-required-390x844.png") });
      await ctx.close();
    }
    {
      const { ctx, page, server } = await open(browser, OWNER, { behavior: "processing" });
      server.state.settleOnRefresh = false;
      await openJob(page);
      await fill(page);
      await page.locator("[data-extra-review]").click();
      await page.locator("[data-stage=review]").waitFor();
      await page.locator("[data-extra-consent]").click();
      await page.locator("[data-extra-charge]").click();
      await page.locator("[data-stage=result][data-extra-status=processing]").waitFor();
      check("processing: shown as Processing with 'do not charge again', not as success", /Processing/.test(await page.locator("[data-stage=result]").innerText()) && /Do not charge again/.test(await page.locator("[data-stage=result]").innerText()));
      await page.screenshot({ path: path.join(SHOTS, "9-processing-390x844.png") });
      server.state.settleOnRefresh = true;
      await page.locator("[data-extra-refresh]").click();
      await page.locator("[data-stage=result][data-extra-status=paid]").waitFor({ timeout: 15000 });
      check("Check now turns it into Paid once the server says so", true);
      await ctx.close();
    }

    /* 6. guest visit: no card; link sent by explicit choice */
    {
      const { ctx, page, server } = await open(browser, OWNER, { guest: true, job: { guest: true, name: "Gail Guest" } });
      await openJob(page);
      await fill(page, { tax: "Tax Exempt", amount: "40" });
      await page.locator("[data-extra-review]").click();
      await page.locator("[data-stage=review]").waitFor();
      check("guest: no Charge button, the reason shown, link actions offered", (await page.locator("[data-extra-charge]").count()) === 0 && /guest visit/.test(await page.locator("[data-extra-direct-blocked]").innerText()) && (await page.locator("[data-extra-send-link]").count()) === 1);
      await page.screenshot({ path: path.join(SHOTS, "10-guest-review-390x844.png") });
      check("link buttons wait for the confirmation too", await page.locator("[data-extra-send-link]").isDisabled());
      await page.locator("[data-extra-consent]").click();
      await page.locator("[data-extra-send-link]").click();
      await page.locator("[data-extra-channels]").waitFor();
      check("nothing is sent until a channel is chosen and Send is pressed", (await page.locator("[data-extra-send-confirm]").isDisabled()) && server.state.calls.filter((c) => c.method === "POST" && /extra-charges$/.test(c.p)).length === 0);
      await page.locator("[data-extra-channels] label:has-text('Email')").click();
      await page.screenshot({ path: path.join(SHOTS, "11-send-link-390x844.png") });
      await page.locator("[data-extra-send-confirm]").click();
      await page.locator("[data-stage=result][data-extra-status=awaiting_payment]").waitFor();
      check("sent link: what was sent is reported", /Email sent/.test(await page.locator("[data-stage=result]").innerText()));
      const post = server.state.calls.find((c) => c.method === "POST" && /extra-charges$/.test(c.p));
      check("the send request names its channels and method link", post.body.method === "link" && post.body.send === true && JSON.stringify(post.body.channels) === '["email"]');
      await ctx.close();
    }

    /* 7. not determined tax blocks; draft survives closing the sheet */
    {
      const { ctx, page } = await open(browser, OWNER);
      await openJob(page);
      await fill(page, { tax: "" });
      check("Review stays disabled until the tax treatment is chosen (nothing assumed)", await page.locator("[data-extra-review]").isDisabled());
      await page.reload({ waitUntil: "domcontentloaded" });
      await sheet(page).locator("[data-job-body=j1]").waitFor({ timeout: 20000 });
      await page.locator("[data-extra-open]").click();
      check("a reload keeps the draft (description and amount)", (await page.locator("textarea[name=extra-description]").inputValue()).startsWith("Replace two GFCI") && (await page.locator("input[name=extra-amount]").inputValue()) === "123.45");
      await page.keyboard.press("Escape");
      const prompt = await page.locator("text=Leave without saving?").count();
      check("closing with typed details asks before discarding", prompt >= 1);
      await ctx.close();
    }

    /* 8. a General Fixter has no Charge extra anywhere */
    {
      const { ctx, page, server } = await open(browser, GENERAL);
      await openJob(page);
      check("General Fixter: no Additional charges section, no Charge extra", (await page.locator("[data-extra-block]").count()) === 0 && (await page.locator("[data-extra-open]").count()) === 0);
      await page.locator("[data-job-more]").click().catch(() => {});
      check("General Fixter: Charge extra not in the More menu", (await page.locator("[role=menuitem]:has-text('Charge extra')").count()) === 0);
      check("General Fixter: no extra-charge request made", server.state.calls.length === 0);
      await ctx.close();
    }

    /* 9. sizes: no overflow, keyboard-safe footer, readable */
    for (const size of [{ w: 320, h: 568 }, { w: 390, h: 844 }, { w: 430, h: 932 }, { w: 844, h: 390 }, { w: 1440, h: 900 }]) {
      const { ctx, page } = await open(browser, OWNER, {}, { width: size.w, height: size.h });
      await openJob(page);
      await fill(page);
      const o1 = await overflow(page);
      const fs16 = await page.evaluate(() => [...document.querySelectorAll("[data-step=charge-extra] input:not([type=checkbox]):not([type=radio]), [data-step=charge-extra] textarea")].every((el) => parseFloat(getComputedStyle(el).fontSize) >= 16));
      // A phone keyboard takes ~45% of the height: the footer button must stay on screen.
      await page.locator("input[name=extra-amount]").focus();
      const footerBox = await page.locator("[data-extra-review]").boundingBox();
      await page.locator("[data-extra-review]").click();
      await page.locator("[data-stage=review]").waitFor();
      const o2 = await overflow(page);
      const btn = await page.locator("[data-extra-charge]").boundingBox();
      check(`${size.w}x${size.h}: no horizontal overflow on enter and review`, !o1.scroll && !o2.scroll && !o1.bad.length && !o2.bad.length, JSON.stringify([o1.bad, o2.bad]));
      check(`${size.w}x${size.h}: the footer action is visible and at least 44px tall`, footerBox && footerBox.y + footerBox.height <= size.h + 1 && btn && btn.height >= 43.5, JSON.stringify([footerBox, btn]));
      if (size.w < 1024) check(`${size.w}x${size.h}: inputs are 16px+ (no zoom on focus on touch)`, fs16);
      await page.screenshot({ path: path.join(SHOTS, `review-${size.w}x${size.h}.png`) });
      await ctx.close();
    }
  } finally {
    await browser.close();
  }
  const failedCount = results.filter((r) => !r.pass).length;
  console.log(`\n${results.length - failedCount}/${results.length} passed`);
  process.exit(failedCount ? 1 : 0);
})();
