/* eslint-disable @typescript-eslint/no-require-imports -- a plain Node script, like the other scripts/ */
/*
 * "Upgrade to a handyman visit" in a real browser: the customer's own
 * free-visit card in My Visits (/book#your-visits), the upgrade sheet, the
 * 20% welcome offer, and the way back from Stripe.
 *
 *   npx next start -p 3111          (after npm run build)
 *   node scripts/test_visit_upgrade_ui.js http://localhost:3111
 *
 * FULL NETWORK JAIL, as in test_free_visit_conversion_ui.js: the local
 * server passes; every URL with /api/ in its path, on ANY host
 * (api.profixter.com included), is answered here from fixtures shaped like
 * the backend DTOs (utils/freeVisit/conversion.js customerUpgradeOptions,
 * customerConversionView; routes/stripe.js welcome-offer); everything else is
 * aborted and recorded. Fake people only (@example.test). Nothing is sent,
 * paid or booked: the fake server only records what the page asked for.
 */
const { chromium } = require("playwright");
const fs = require("fs");
const path = require("path");

const BASE = (process.argv[2] || "http://localhost:3111").replace(/\/$/, "");
const SHOTS = process.env.SHOTS_DIR || path.join(__dirname, "..", "..", "reports", "shots", "visit-upgrade");
fs.mkdirSync(SHOTS, { recursive: true });

/* The public site loads its tag manager and pixel; here they are blocked (aborted), never fetched. */
const TAGS = /^https:\/\/(www\.googletagmanager\.com|connect\.facebook\.net|www\.google-analytics\.com)\//;
const TZ = "America/New_York";
const ymdNY = (d) => new Intl.DateTimeFormat("en-CA", { timeZone: TZ }).format(d);
const TODAY = ymdNY(new Date());
const addDays = (ymd, n) => {
  const [y, m, d] = ymd.split("-").map(Number);
  return new Date(Date.UTC(y, m - 1, d + n)).toISOString().slice(0, 10);
};
const iso = (ymd, h) => new Date(`${ymd}T${h}:00-05:00`).toISOString();

const CUSTOMER = {
  _id: "cust1",
  userId: "42000001",
  name: "Carla Customer",
  email: "carla@example.test",
  phone: "+16315550142",
  phoneVerified: true,
  role: "customer",
  phoneRequired: false,
  addresses: [{ _id: "addr1", label: "Home", line1: "12 Demo Lane", city: "Testville", state: "NY", zip: "11735", hasActiveSubscription: false }],
};

function visit(id, o = {}) {
  return {
    _id: id,
    bookingNumber: o.number || "55500201",
    addressId: "addr1",
    date: iso(o.day || addDays(TODAY, 12), "10:00"),
    status: o.status || "Pending Confirmation",
    service: "Free Visit",
    selectedTask: "Free Visit",
    accessType: o.accessType || "free_first_visit",
    note: "Dripping faucet, loose towel bar.",
    address: "12 Demo Lane",
    city: "Testville",
    state: "NY",
    zip: "11735",
    images: [],
    upgrade: o.upgrade === undefined ? { freeVisit: true, converted: false, current: null } : o.upgrade,
  };
}

const plans = [
  { key: "basic", label: "Basic", monthly: 149, annual: 1490, limit: 1, available: true },
  { key: "plus", label: "Plus", monthly: 249, annual: 2490, limit: 2, available: true },
  { key: "premium", label: "Premium", monthly: 349, annual: 3490, limit: 2, available: true },
  { key: "elite", label: "Elite", monthly: 499, annual: 4990, limit: 2, available: true },
];
const termsFor = (plan, cycle, welcome) => {
  const p = plans.find((x) => x.key === plan);
  const price = cycle === "annual" ? p.annual : p.monthly;
  const period = cycle === "annual" ? "year" : "month";
  return welcome
    ? `I agree to the Profixter Terms of Service. My ${p.label} membership's first payment is $${(price * 0.8).toFixed(2)} (20% off), then $${price} per ${period} plus any applicable tax; it renews automatically.`
    : `I agree to the Profixter Terms of Service. My ${p.label} membership costs $${price} per ${period} plus any applicable tax and renews automatically.`;
};
function options(id, o = {}) {
  const membershipTerms = {};
  for (const p of plans) membershipTerms[p.key] = { monthly: { regular: termsFor(p.key, "monthly", false), welcome: termsFor(p.key, "monthly", true) }, annual: { regular: termsFor(p.key, "annual", false), welcome: termsFor(p.key, "annual", true) } };
  return {
    booking: { id, bookingNumber: "55500201", status: "Pending Confirmation", whenLabel: "Saturday, November 28 at 10:00 AM", address: "12 Demo Lane, Testville, NY, 11735", line1: "12 Demo Lane", zip: "11735", addressId: "addr1", task: "" },
    upgradable: o.upgradable ?? true,
    problem: o.problem || null,
    termsVersion: "paid_visit_conversion.v1",
    offers: {
      membership: { plans, blocker: o.blocker || null, firstVisitException: Boolean(o.firstVisitException) },
      oneTime: { enabled: true, priceCents: 9900 },
    },
    terms: { one_time: "I agree to the Profixter Terms of Service. This is a single 90-minute One-Time Visit for $99, with no membership and no recurring charge.", membership: membershipTerms },
    current: o.current || null,
  };
}

function makeServer({ welcome = true } = {}) {
  /* payment: per visit, the replies GET /payment gives in turn (the last one repeats); "abort" is a network error. */
  const state = { calls: [], welcomeAsks: 0, checkoutReply: null, optionsById: new Map(), payment: new Map(), paymentAsks: 0 };
  state.optionsById.set("b1", options("b1"));
  state.optionsById.set("b2", options("b2", { upgradable: false, problem: { code: "VISIT_TOO_SOON", message: "Your visit is less than two hours away, so it can't be upgraded online. Call us at 631-599-1363 and we'll help." } }));
  state.optionsById.set("b5", options("b5", { blocker: { code: "LEAD_TIME", message: "Membership visits are booked at least 7 days ahead, and your account has already used its one exception for a first visit. A One-Time Visit keeps this time." } }));
  const bookings = [
    visit("b1"),
    visit("b2", { number: "55500202", day: addDays(TODAY, 13) }),
    visit("b3", { number: "55500203", day: addDays(TODAY, 14), upgrade: { freeVisit: true, converted: false, current: { status: "processing", kind: "one_time", offerLabel: "One-Time Visit", startedBy: "customer", checkoutOpen: false, convertedStatus: "" } } }),
    visit("b4", { number: "55500204", day: addDays(TODAY, 15), status: "Pending", accessType: "membership", upgrade: { freeVisit: false, converted: true, current: { status: "converted", kind: "membership", offerLabel: "Plus membership (monthly)", startedBy: "customer", checkoutOpen: false, convertedStatus: "Pending" } } }),
    visit("b5", { number: "55500205", day: addDays(TODAY, 4) }),
  ];
  /* A visit booked as a guest, joined to the account on this load (BackEnd guestLink, via "my_visits"). */
  bookings[4].linkedJustNow = true;
  function handle(method, p, sp, body) {
    if (p === "/api/auth/me") return [200, CUSTOMER];
    if (p === "/api/bookings" && method === "GET") return [200, bookings];
    if (p.startsWith("/api/bookings/next")) return [200, { plan: "", hasSubscription: false, freeFirstVisitAvailable: false, bookingLimit: 0, activeCount: 0, activeBookings: [], future: null }];
    if (p === "/api/stripe/checkout/welcome-offer") {
      state.welcomeAsks += 1;
      if (!welcome) return [200, { eligible: false, serverNow: new Date().toISOString(), percentOff: 20 }];
      const plansCents = {};
      for (const pl of plans) plansCents[pl.key] = { monthlyCents: pl.monthly * 100, firstMonthCents: pl.monthly * 80, annualCents: pl.annual * 100, firstYearCents: pl.annual * 80 };
      return [200, { eligible: true, serverNow: new Date().toISOString(), expiresAt: new Date(Date.now() + 8 * 60 * 1000).toISOString(), percentOff: 20, label: "Welcome Offer", cycles: ["monthly", "annual"], plans: plansCents }];
    }
    const pm = /^\/api\/visit-upgrade\/([^/]+)\/payment$/.exec(p);
    if (pm) {
      state.paymentAsks += 1;
      const queue = state.payment.get(pm[1]) || [[404, { code: "BOOKING_NOT_FOUND", message: "This visit was not found." }]];
      const reply = queue.length > 1 ? queue.shift() : queue[0];
      return reply;
    }
    const m = /^\/api\/visit-upgrade\/([^/]+)(\/checkout)?$/.exec(p);
    if (m) {
      const opt = state.optionsById.get(m[1]);
      if (!opt) return [404, { code: "BOOKING_NOT_FOUND", message: "This visit was not found." }];
      if (!m[2]) {
        state.calls.push({ method, p, action: "options", id: m[1] });
        return [200, opt];
      }
      state.calls.push({ method, p, body, action: "checkout", id: m[1] });
      if (state.checkoutReply) {
        const reply = state.checkoutReply;
        state.checkoutReply = null;
        return reply;
      }
      if (body?.acceptTerms !== true || body?.termsVersion !== opt.termsVersion) return [400, { code: "TERMS_REQUIRED", message: "Please read and accept the terms to continue." }];
      return [200, { url: `${BASE}/stripe-checkout-fake`, welcomeOfferApplied: Boolean(body.welcomeOffer) }];
    }
    return [200, p.includes("summary") || p.includes("settings") || p.includes("config") ? {} : []];
  }
  return { state, handle };
}

/* ---------------- harness ---------------- */
const results = [];
function check(name, pass, detailText = "") {
  results.push({ name, pass: !!pass });
  console.log(`${pass ? "PASS" : "FAIL"}  ${name}${detailText ? "  :: " + detailText : ""}`);
}

async function open(browser, { width = 390, height = 844 } = {}, serverOptions = {}) {
  const mobile = width < 1024;
  const ctx = await browser.newContext({ viewport: { width, height }, isMobile: mobile, hasTouch: mobile, serviceWorkers: "block", reducedMotion: "reduce" });
  await ctx.addInitScript(() => localStorage.setItem("token", "ui-token"));
  const server = makeServer(serverOptions);
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
      const [status, json, how = {}] = server.handle(req.method(), p, u.searchParams, body);
      if (how.delay) await new Promise((r) => setTimeout(r, how.delay));
      if (status === "abort") return route.abort("connectionreset");
      return route.fulfill({ status, contentType: "application/json", headers: cors, body: JSON.stringify(json) });
    }
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

const card = (page, number) => page.locator("#your-visits div.bg-white.border", { hasText: `Visit #${number}` }).first();
async function openVisits(page, query = "") {
  await page.goto(`${BASE}/book${query}#your-visits`, { waitUntil: "domcontentloaded" });
  await page.locator("[data-action=upgrade-visit]").first().waitFor({ timeout: 30000 });
}
async function smallTargets(page, sel) {
  return page.evaluate((sel) => {
    const out = [];
    for (const el of document.querySelectorAll(`${sel} button, ${sel} input[type=radio]`)) {
      /* At the phone zoom (0.82) a 44 CSS-px target draws smaller: measure what a finger gets. */
      const box = (el.closest("label") || el).getBoundingClientRect();
      if (box.width && box.height < 43.5) out.push(`${el.tagName}:${(el.textContent || el.getAttribute("name") || "").trim().slice(0, 20)}:${Math.round(box.height)}`);
    }
    return out;
  }, sel);
}

(async () => {
  const browser = await chromium.launch();

  for (const size of [{ name: "390", width: 390, height: 844 }, { name: "1440", width: 1440, height: 900 }]) {
    console.log(`\n--- My Visits at ${size.name} ---`);
    const { ctx, page, server, external, errors } = await open(browser, size);
    await openVisits(page);

    const c1 = card(page, "55500201");
    const c1Text = await c1.innerText();
    check(`${size.name}: the free visit's card says Free Visit and offers the upgrade`, /Free Visit/.test(c1Text) && (await c1.locator("[data-action=upgrade-visit]").count()) === 1, c1Text.slice(0, 200));
    const c3 = card(page, "55500203");
    check(`${size.name}: a visit with a payment under way says so, with no upgrade button`, /Payment received/.test(await c3.innerText()) && (await c3.locator("[data-action=upgrade-visit]").count()) === 0);
    const c4 = card(page, "55500204");
    check(`${size.name}: an upgraded visit says what it became, with no upgrade button`, /Upgraded from your free visit: now a Plus membership visit/.test(await c4.innerText()) && (await c4.locator("[data-action=upgrade-visit]").count()) === 0);
    await page.screenshot({ path: path.join(SHOTS, `visits-${size.name}.png`) });

    /* The sheet. */
    await c1.locator("[data-action=upgrade-visit]").click();
    const sheet = page.locator("[data-upgrade-sheet]");
    await sheet.waitFor({ timeout: 15000 });
    const sheetText = await sheet.innerText();
    check(`${size.name}: the sheet shows the visit it keeps and that nothing changes until paid`, /November 28 at 10:00 AM/.test(sheetText) && /12 Demo Lane/.test(sheetText) && /Nothing changes until your payment goes through/.test(sheetText));
    check(`${size.name}: no contact details are asked for when the account has them`, (await page.locator("input[type=email], input[type=tel]").count()) === 0);
    check(`${size.name}: the welcome offer shows, as on the plans page`, (await page.locator("[data-welcome-offer]").count()) === 1 && /\$119\.20.*first month/.test(await page.locator("[data-upgrade-plan=basic]").innerText()));
    const pay = page.locator("[data-action=upgrade-pay]");
    check(`${size.name}: Continue is off until the terms are ticked`, await pay.isDisabled());
    const termsText = await page.locator("[data-upgrade-terms]").innerText();
    check(`${size.name}: the terms shown are the welcome-priced ones for Basic monthly`, /\$119\.20 \(20% off\), then \$149 per month/.test(termsText), termsText);
    await page.locator("[data-upgrade-terms] input[type=checkbox]").check();
    check(`${size.name}: ticked, Continue is on`, await pay.isEnabled());
    await page.locator("[data-upgrade-cycle=annual]").click();
    check(`${size.name}: changing the choice shows its own terms, unticked again`, /\$1490 per year/.test(await page.locator("[data-upgrade-terms]").innerText()) && !(await page.locator("[data-upgrade-terms] input[type=checkbox]").isChecked()) && (await pay.isDisabled()));
    if (size.name === "390") {
      const small = await smallTargets(page, "[data-upgrade-sheet]");
      check("390: every control in the sheet is a 44px target", small.length === 0, small.join(", "));
    }
    await page.screenshot({ path: path.join(SHOTS, `sheet-${size.name}.png`) });

    /* The offer ended meanwhile: refused, told, re-asked. */
    await page.locator("[data-upgrade-cycle=monthly]").click();
    await page.locator("[data-upgrade-terms] input[type=checkbox]").check();
    const asksBefore = server.state.welcomeAsks;
    server.state.checkoutReply = [409, { code: "WELCOME_OFFER_ENDED", message: "The 20% offer has ended. The prices shown now are the regular prices." }];
    await pay.click();
    await page.locator("[data-upgrade-sheet] [role=alert]").waitFor({ timeout: 10000 });
    check(`${size.name}: an ended offer is explained and the price asked again`, /has ended/.test(await page.locator("[data-upgrade-sheet] [role=alert]").innerText()) && server.state.welcomeAsks > asksBefore && /stripe-checkout-fake/.test(page.url()) === false);

    /* Membership with the offer: what is sent. */
    await pay.click();
    await page.waitForURL(/stripe-checkout-fake/, { timeout: 15000 });
    const sentM = server.state.calls.filter((c) => c.action === "checkout").pop();
    check(`${size.name}: Continue sends the exact choice, the terms version and that the offer was shown`, sentM && sentM.body.kind === "membership" && sentM.body.plan === "basic" && sentM.body.billingCycle === "monthly" && sentM.body.acceptTerms === true && sentM.body.termsVersion === "paid_visit_conversion.v1" && sentM.body.welcomeOffer === true, JSON.stringify(sentM?.body));

    /* One-Time. */
    await openVisits(page);
    await card(page, "55500201").locator("[data-action=upgrade-visit]").click();
    await page.locator("[data-upgrade-sheet]").waitFor({ timeout: 15000 });
    await page.locator("[data-upgrade-kind=one_time]").check();
    check(`${size.name}: One-Time shows its own terms`, /One-Time Visit for \$99/.test(await page.locator("[data-upgrade-terms]").innerText()) && (await page.locator("[data-welcome-offer]").count()) === 0);
    await page.locator("[data-upgrade-terms] input[type=checkbox]").check();
    await page.locator("[data-action=upgrade-pay]").click();
    await page.waitForURL(/stripe-checkout-fake/, { timeout: 15000 });
    const sentO = server.state.calls.filter((c) => c.action === "checkout").pop();
    check(`${size.name}: One-Time sends no plan and no welcome offer`, sentO && sentO.body.kind === "one_time" && !sentO.body.plan && sentO.body.welcomeOffer === false, JSON.stringify(sentO?.body));

    /* A visit the server says cannot be upgraded. */
    await openVisits(page);
    await card(page, "55500202").locator("[data-action=upgrade-visit]").click();
    const prob = page.locator("[data-upgrade-problem]");
    await prob.waitFor({ timeout: 15000 });
    check(`${size.name}: the server's no is shown with its reason and no Pay`, /less than two hours away/.test(await prob.innerText()) && (await page.locator("[data-action=upgrade-pay]").count()) === 0);
    await page.keyboard.press("Escape");

    /* Inside the seven days for an existing member: membership is off and says why; One-Time is chosen. */
    await card(page, "55500205").locator("[data-action=upgrade-visit]").click();
    await page.locator("[data-upgrade-sheet]").waitFor({ timeout: 15000 });
    check(
      `${size.name}: a refused membership is off with its reason, One-Time preselected`,
      (await page.locator("[data-upgrade-kind=membership]").isDisabled()) && /A One-Time Visit keeps this time/.test(await page.locator("[data-upgrade-blocker=LEAD_TIME]").innerText()) && (await page.locator("[data-upgrade-kind=one_time]").isChecked())
    );
    await page.keyboard.press("Escape");

    /* The guest visit just joined to this account is announced, once. */
    check(`${size.name}: a guest visit joined on this load is announced`, /We found the free visit you booked for .* with your verified phone or email, and added it here\./.test(await page.locator("[data-guest-linked]").innerText()));

    /* A payment already received (its webhook still on the way): Continue is refused and stays off. */
    await card(page, "55500201").locator("[data-action=upgrade-visit]").click();
    await page.locator("[data-upgrade-sheet]").waitFor({ timeout: 15000 });
    await page.locator("[data-upgrade-kind=one_time]").check();
    await page.locator("[data-upgrade-terms] input[type=checkbox]").check();
    server.state.checkoutReply = [409, { code: "CONVERSION_IN_PROGRESS", message: "We've received a payment for this visit and are updating it now." }];
    await page.locator("[data-action=upgrade-pay]").click();
    await page.locator("[data-upgrade-sheet] [role=alert]").waitFor({ timeout: 15000 });
    check(
      `${size.name}: "already paid" from the server: told not to pay again, and Continue stays off`,
      /don't pay again/.test(await page.locator("[data-upgrade-sheet] [role=alert]").innerText()) && (await page.locator("[data-action=upgrade-pay]").isDisabled()) && !/stripe-checkout-fake/.test(page.url())
    );
    await page.keyboard.press("Escape");

    /* Back from Stripe: the server is asked (and asks Stripe). The return URL proves nothing. */
    const processing = { bookingId: "b1", state: "processing", kind: "membership", offerLabel: "Basic membership (monthly)", stripeConfirmed: true };
    const converted = { bookingId: "b1", state: "converted", kind: "membership", offerLabel: "Basic membership (monthly)", approvalPending: true, bookingStatus: "Pending" };
    const unpaid = { bookingId: "b1", state: "unpaid", kind: "one_time", offerLabel: "One-Time Visit", openPage: true };
    const noticeText = () => page.locator("[data-upgrade-notice]").innerText();
    const noSheet = async () => (await page.locator("[data-upgrade-sheet]").count()) === 0;

    server.state.payment.set("b1", [[200, processing, { delay: 1500 }], [200, processing], [200, converted]]);
    await page.goto(`${BASE}/book?upgraded=b1#your-visits`, { waitUntil: "domcontentloaded" });
    await page.locator("[data-payment-state=checking]").waitFor({ timeout: 30000 });
    check(`${size.name}: on return it first says "Checking payment status", nothing else`, /^Checking payment status/.test(await noticeText()) && !/charged/i.test(await noticeText()));
    await page.locator("[data-payment-state=processing]").waitFor({ timeout: 15000 });
    const proc = await noticeText();
    check(
      `${size.name}: paid, webhook slow: "Payment received", don't pay again, no sheet, never "Nothing was charged"`,
      /Payment received/.test(proc) && /don't pay again/.test(proc) && !/Nothing was charged/.test(proc) && (await page.locator("[data-action=payment-reopen]").count()) === 0 && (await noSheet())
    );
    await page.locator("[data-payment-state=converted]").waitFor({ timeout: 20000 });
    const conv = await noticeText();
    check(`${size.name}: then the verified conversion: what it became, waiting for approval, address bar clean`, /now a Basic membership visit/.test(conv) && /waiting for our confirmation/.test(conv) && !/upgraded=/.test(page.url()), conv);

    /* Backed out (cancel URL) but the payment went through: still "received", never "nothing charged". */
    server.state.payment.set("b1", [[200, processing]]);
    await page.goto(`${BASE}/book?upgrade=b1#your-visits`, { waitUntil: "domcontentloaded" });
    await page.locator("[data-payment-state=processing]").waitFor({ timeout: 30000 });
    check(`${size.name}: cancel URL with a payment received: no "Nothing was charged", no sheet to pay again`, !/Nothing was charged/.test(await noticeText()) && (await noSheet()));

    /* The server cannot be reached: unknown, never unpaid; Check again works. */
    server.state.payment.set("b1", [["abort", null]]);
    await page.goto(`${BASE}/book?upgrade=b1#your-visits`, { waitUntil: "domcontentloaded" });
    await page.locator("[data-payment-state=error]").waitFor({ timeout: 30000 });
    const err = await noticeText();
    check(`${size.name}: a network error says it couldn't confirm, don't pay again, never "Nothing was charged"`, /couldn't confirm your payment status/.test(err) && /don't pay again/.test(err) && !/Nothing was charged/.test(err) && (await noSheet()), err);
    server.state.payment.set("b1", [[200, unpaid]]);
    await page.locator("[data-action=payment-check-again]").click();
    await page.locator("[data-payment-state=unpaid]").waitFor({ timeout: 20000 });
    check(`${size.name}: Check again asks the server again: verified unpaid`, /Nothing was charged, and your free visit is still booked/.test(await noticeText()));

    /* Verified unpaid: only now is the sheet offered again (the same Stripe page, still open). */
    check(`${size.name}: verified unpaid offers "Return to payment"`, /Return to payment/.test(await page.locator("[data-action=payment-reopen]").innerText()));
    await page.locator("[data-action=payment-reopen]").click();
    await page.locator("[data-upgrade-sheet]").waitFor({ timeout: 15000 });
    check(`${size.name}: the sheet reopens saying nothing was charged and the free visit is kept`, /Nothing was charged, and your free visit is still booked\./.test(await page.locator("[data-upgrade-sheet]").innerText()));
    await page.screenshot({ path: path.join(SHOTS, `returned-${size.name}.png`) });
    await page.keyboard.press("Escape");

    check(`${size.name}: nothing left the network jail: the only outside requests were the site tags, blocked`, external.every((u) => TAGS.test(u)), external.filter((u) => !TAGS.test(u)).slice(0, 5).join(" "));
    check(`${size.name}: no page errors`, errors.length === 0, errors.slice(0, 3).join(" | "));
    await ctx.close();
  }

  /* No offer: regular prices, no banner, regular terms, welcomeOffer false. */
  {
    console.log("\n--- Not eligible for the welcome offer ---");
    const { ctx, page, server, external, errors } = await open(browser, { width: 390, height: 844 }, { welcome: false });
    await openVisits(page);
    await card(page, "55500201").locator("[data-action=upgrade-visit]").click();
    await page.locator("[data-upgrade-sheet]").waitFor({ timeout: 15000 });
    check("no offer: no banner, regular price and terms", (await page.locator("[data-welcome-offer]").count()) === 0 && /\$149\/mo/.test(await page.locator("[data-upgrade-plan=basic]").innerText()) && /costs \$149 per month/.test(await page.locator("[data-upgrade-terms]").innerText()));
    await page.locator("[data-upgrade-terms] input[type=checkbox]").check();
    await page.locator("[data-action=upgrade-pay]").click();
    await page.waitForURL(/stripe-checkout-fake/, { timeout: 15000 });
    const sent = server.state.calls.filter((c) => c.action === "checkout").pop();
    check("no offer: the checkout says the offer was not shown", sent && sent.body.welcomeOffer === false, JSON.stringify(sent?.body));
    check("no offer: nothing left the network jail", external.every((u) => TAGS.test(u)), external.filter((u) => !TAGS.test(u)).slice(0, 5).join(" "));
    check("no offer: no page errors", errors.length === 0, errors.slice(0, 3).join(" | "));
    await ctx.close();
  }

  await browser.close();
  const failedCount = results.filter((r) => !r.pass).length;
  console.log(`\n${results.length - failedCount} passed, ${failedCount} failed.`);
  process.exitCode = failedCount ? 1 : 0;
})().catch((error) => {
  console.error(error);
  process.exit(1);
});
