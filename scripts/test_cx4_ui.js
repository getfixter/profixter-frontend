/* eslint-disable @typescript-eslint/no-require-imports -- a plain Node script, like its neighbours */
/*
 * Customer Experience 4.0, in the browser against a mocked API (2026-10-30).
 *
 *   node scripts/test_cx4_ui.js [baseUrl] [screenshotDir]
 *
 * The mock answers as BackEnd routes/freeVisitRequests.js, requests.js,
 * bookings.js and stripe.js do (pinned by BackEnd scripts/test_cx4_integration.js).
 *
 * - Homepage: both ways to start (Free Visit, Book a Handyman) are inside the
 *   first screen at common phone sizes; headline readable; no sideways scroll.
 * - Free Visit: only name, phone, email, address, day and time are required;
 *   the sheet says labor isn't included; Confirm submits once (formVersion
 *   cx4, address fields); Call Us dials; Request a Callback creates one lead;
 *   "I Need a Handyman Instead" carries the details into Book a Handyman.
 * - Book a Handyman: describe -> time -> sign in (draft kept across the trip)
 *   -> One-Time (checkout body: returnTo, clientRequestId, no photo needed) or
 *   membership (returnTo handyman); a member uses the included visit; a
 *   canceled checkout comes back with the draft and releases the hold.
 */
const { chromium } = require("playwright");
const fs = require("fs");

const BASE = process.argv[2] || "http://localhost:3000";
const SHOTS = process.argv[3] || "";
if (SHOTS) fs.mkdirSync(SHOTS, { recursive: true });

const results = [];
function check(name, pass, detail = "") {
  results.push(!!pass);
  console.log(`${pass ? "PASS" : "FAIL"}  ${name}${detail ? "  :: " + detail : ""}`);
}

const ADDRESS = { _id: "a1", label: "Primary", line1: "12 Elm St", city: "Farmingdale", state: "NY", zip: "11735", hasActiveSubscription: false, plan: null };
function customer(over = {}) {
  return { _id: "u1", userId: "40000001", name: "Dana Lopez", email: "dana@mailbox.org", phone: "+15165550123", role: "customer", permissions: [], addresses: [ADDRESS], ...over };
}
function ymd(offset) {
  const d = new Date(Date.now() + offset * 86400000);
  return d.toLocaleDateString("en-CA", { timeZone: "America/New_York" });
}

async function open(browser, { width, height, me = null }) {
  const ctx = await browser.newContext({ viewport: { width, height }, isMobile: width < 700, hasTouch: width < 700 });
  await ctx.addInitScript((signedIn) => {
    try {
      if (signedIn) localStorage.setItem("token", "ui-token");
      localStorage.setItem("profixter_promotion_popup_dismissed_date", new Date().toISOString().slice(0, 10));
    } catch {}
  }, Boolean(me));
  const state = { me, freeVisits: [], callbacks: [], oneTime: [], memberships: [], bookings: [], abandons: [], homes: [] };
  // Google Places is real on the live site; blocking it makes the address field use its manual form, as it does without a key.
  await ctx.route(/maps\.googleapis\.com|places\.googleapis\.com/, (r) => r.abort());
  await ctx.route("https://checkout.stripe.test/**", (r) => r.fulfill({ status: 200, contentType: "text/html", body: "<h1>Stripe test checkout</h1>" }));
  await ctx.route(/\/api\//, async (route) => {
    const req = route.request();
    const u = new URL(req.url());
    const cors = { "access-control-allow-origin": "*", "access-control-allow-headers": "Authorization,Content-Type", "access-control-allow-methods": "GET,POST,PUT,PATCH,DELETE,OPTIONS" };
    if (req.method() === "OPTIONS") return route.fulfill({ status: 204, headers: cors });
    const json = (body, status = 200) => route.fulfill({ status, contentType: "application/json", headers: cors, body: JSON.stringify(body) });
    const p = u.pathname;
    const m = req.method();
    const text = () => (req.postDataBuffer() || Buffer.alloc(0)).toString("latin1");
    const field = (t, name) => {
      const match = t.match(new RegExp(`name="${name}"\\r\\n\\r\\n([^\\r]*)`));
      return match ? match[1] : undefined;
    };
    if (p === "/api/auth/me") return state.me ? json(state.me) : json({ message: "No token" }, 401);
    if (p === "/api/calendar/month") {
      const month = u.searchParams.get("month");
      // Like the server: a member visit (?visit=membership) starts seven days out.
      const lead = u.searchParams.get("visit") === "membership" ? 7 : 2;
      const days = [];
      for (let i = 0; i < 60; i++) {
        const d = ymd(i);
        if (!d.startsWith(month)) continue;
        days.push({ date: d, open: true, available: i >= lead, slotCount: 3, slots: i >= lead ? ["08:00", "10:00", "13:00"] : [], taken: {} });
      }
      return json({ month, engine: "reservation", visitDurationMinutes: 90, days });
    }
    if (p === "/api/calendar/slots") return json({ date: u.searchParams.get("date"), available: true, slots: ["08:00", "10:00", "13:00"], taken: {}, capacityPerSlot: 2 });
    if (p === "/api/service-area/check") return json({ serviceable: u.searchParams.get("zip") !== "10118" });
    if (p === "/api/free-visit-requests" && m === "POST") {
      const t = text();
      state.freeVisits.push({ formVersion: field(t, "formVersion"), name: field(t, "name"), line1: field(t, "line1"), zip: field(t, "zip"), date: field(t, "requestedDate"), time: field(t, "requestedTime"), note: field(t, "note"), consent: field(t, "consentText") });
      await new Promise((r) => setTimeout(r, 300));
      return json({ success: true }, 201);
    }
    if (p === "/api/requests/callback" && m === "POST") {
      state.callbacks.push(JSON.parse(req.postData() || "{}"));
      return json({ success: true }, 201);
    }
    if (p === "/api/bookings/one-time/config") return json({ enabled: true, priceCents: 9900, currency: "usd", durationMinutes: 90, holdMinutes: 30 });
    if (p === "/api/bookings/one-time/checkout" && m === "POST") {
      const t = text();
      state.oneTime.push({ addressId: field(t, "addressId"), note: field(t, "note"), returnTo: field(t, "returnTo"), clientRequestId: field(t, "clientRequestId"), requestedDate: field(t, "requestedDate"), requestedTime: field(t, "requestedTime"), photos: (t.match(/name="images"; filename=/g) || []).length });
      return json({ url: "https://checkout.stripe.test/cs_one", bookingId: "b-held-1", entitlementId: "e1", holdExpiresAt: new Date(Date.now() + 1800000).toISOString() });
    }
    if (p.startsWith("/api/bookings/one-time/") && p.endsWith("/abandon")) {
      state.abandons.push(p);
      return json({ released: true });
    }
    if (p === "/api/stripe/checkout/create-checkout-session" && m === "POST") {
      state.memberships.push(JSON.parse(req.postData() || "{}"));
      return json({ url: "https://checkout.stripe.test/cs_member", sessionId: "cs_member" });
    }
    if (p === "/api/bookings" && m === "POST") {
      const t = text();
      state.bookings.push({ addressId: field(t, "addressId"), requestedDate: field(t, "requestedDate"), requestedTime: field(t, "requestedTime"), note: field(t, "note") });
      return json({ message: "Booking created", booking: { bookingNumber: "12345678", status: "Pending" } });
    }
    if (p === "/api/users/me/addresses" && m === "POST") {
      const body = JSON.parse(req.postData() || "{}");
      state.homes.push(body);
      const address = { _id: "a-new", label: "Home", line1: body.line1, city: body.city, state: body.state, zip: body.zip, hasActiveSubscription: false, plan: null };
      state.me = { ...state.me, addresses: [...(state.me.addresses || []), address] };
      return json({ user: state.me, address, serviceArea: { inArea: true, county: "Nassau" } });
    }
    if (p.startsWith("/api/recent-work")) return json({ photos: [], page: 1, limit: 24, total: 0, hasMore: false });
    return json([]);
  });
  const page = await ctx.newPage();
  const errors = [];
  page.on("pageerror", (e) => errors.push(e.message));
  return { ctx, page, state, errors };
}

const noSideScroll = (page) => page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth + 1);
const shot = async (page, name) => {
  if (SHOTS) await page.screenshot({ path: `${SHOTS}/${name}.png` }).catch(() => {});
};
/* Fully inside the visible viewport (the sticky header and the bottom tab bar excluded). */
async function inFirstScreen(page, selector) {
  return page.evaluate((sel) => {
    const el = document.querySelector(sel);
    if (!el) return { ok: false, why: "missing" };
    const r = el.getBoundingClientRect();
    const tabbar = document.querySelector(".csn");
    const bottom = tabbar ? Math.min(window.innerHeight, tabbar.getBoundingClientRect().top) : window.innerHeight;
    return { ok: r.top >= 0 && r.bottom <= bottom + 0.5, top: Math.round(r.top), bottom: Math.round(r.bottom), limit: Math.round(bottom) };
  }, selector);
}
async function fillAddress(scope, { line1, city, zip }) {
  await scope.locator("input[placeholder='Street address']").first().fill(line1);
  await scope.locator("input[placeholder='City']").first().fill(city);
  await scope.locator("input[placeholder='ZIP']").first().fill(zip);
  await scope.locator("input[placeholder='ZIP']").first().blur();
}

(async () => {
  const browser = await chromium.launch();

  /* ============================== Homepage ============================== */
  for (const [w, h, name] of [[360, 640, "small-phone"], [390, 844, "phone"], [430, 932, "large-phone"], [820, 1180, "tablet"], [1440, 900, "desktop"]]) {
    const { ctx, page, errors } = await open(browser, { width: w, height: h });
    await page.goto(`${BASE}/`, { waitUntil: "networkidle" });
    await page.locator("[data-hero-choices]").waitFor({ timeout: 20000 });
    await page.waitForTimeout(700);
    const free = await inFirstScreen(page, "[data-hero-cta='free-visit']");
    const handy = await inFirstScreen(page, "[data-hero-cta='book-handyman']");
    check(`${name}: Free Visit visible without scrolling`, free.ok, JSON.stringify(free));
    check(`${name}: Book a Handyman visible without scrolling`, handy.ok, JSON.stringify(handy));
    const title = await inFirstScreen(page, "#hm-title");
    const size = await page.evaluate(() => parseFloat(getComputedStyle(document.querySelector("#hm-title")).fontSize));
    check(`${name}: headline on screen and readable`, title.ok && size >= 22, `font ${size}`);
    check(`${name}: links go to the two flows`, (await page.getAttribute("[data-hero-cta='free-visit']", "href")) === "/book/free" && (await page.getAttribute("[data-hero-cta='book-handyman']", "href")) === "/book/handyman");
    check(`${name}: no sideways scroll`, await noSideScroll(page));
    check(`${name}: no booking form competing on the homepage`, (await page.locator("form, [data-free-visit-form]").count()) === 0);
    check(`${name}: no page errors`, errors.length === 0, errors.join(" | "));
    await shot(page, `home-${name}`);
    await ctx.close();
  }

  for (const width of [390, 1440]) {
    const tag = width < 700 ? "mobile" : "desktop";
    const height = width < 700 ? 844 : 900;

    /* ============================ Free Visit ============================ */
    {
      const { ctx, page, state, errors } = await open(browser, { width, height });
      await page.goto(`${BASE}/book/free`, { waitUntil: "networkidle" });
      const form = page.locator("[data-free-visit-form]");
      await form.waitFor({ timeout: 20000 });
      check(`${tag}: Free Visit page has no inspection/labor promise`, !/inspection|90 minutes|90-minute/i.test(await form.innerText()));
      await shot(page, `${tag}-free-01-empty`);
      await page.locator("[data-action='review-free-visit']").click();
      check(`${tag}: required fields are named`, (await form.locator(".bk-error").count()) >= 4);
      check(`${tag}: no sheet until the form is complete`, (await page.locator("[data-free-visit-sheet]").count()) === 0);
      await form.locator("input[name=name]").fill("Dana Lopez");
      await form.locator("input[name=phone]").fill("(516) 555-0123");
      await form.locator("input[name=email]").fill("dana@mailbox.org");
      await fillAddress(form, { line1: "12 Elm St", city: "Farmingdale", zip: "11735" });
      const day = await page.locator(".bk-day:not([disabled])").first().getAttribute("data-day");
      await page.locator(`[data-day='${day}']`).click();
      await page.locator("[data-time='10:00']").click();
      check(`${tag}: description and photos are optional`, (await form.locator("text=(optional)").count()) >= 2);
      check(`${tag}: camera capture offered`, (await form.locator("[data-input=camera][capture=environment]").count()) === 1);
      check(`${tag}: free visit form fits`, await noSideScroll(page));
      await shot(page, `${tag}-free-02-filled`);
      await page.locator("[data-action='review-free-visit']").click();
      const sheet = page.locator("[data-free-visit-sheet]");
      await sheet.waitFor({ timeout: 5000 });
      const sheetText = await sheet.innerText();
      check(`${tag}: the sheet says labor isn't included, kindly`, /Repairs and labor\s+aren.t included/i.test(sheetText) && /right fit/i.test(sheetText));
      check(`${tag}: two main choices, two small ones`, (await sheet.locator("[data-action='confirm-free-visit']").count()) === 1 && (await sheet.locator("[data-action='need-handyman']").count()) === 1 && (await sheet.locator("[data-action='call-us']").count()) === 1 && (await sheet.locator("[data-action='request-callback']").count()) === 1);
      check(`${tag}: Call Us dials the business number`, (await sheet.locator("[data-action='call-us']").getAttribute("href")) === "tel:+16315991363");
      await page.waitForTimeout(500); // the sheet's rise animation
      await shot(page, `${tag}-free-03-sheet`);
      await sheet.locator("[data-action='request-callback']").click();
      await sheet.locator("[data-callback-sent]").waitFor({ timeout: 5000 });
      check(`${tag}: callback request uses what was typed, once`, state.callbacks.length === 1 && state.callbacks[0].phone === "5165550123" && /12 Elm St/.test(state.callbacks[0].address));
      check(`${tag}: callback booked nothing`, state.freeVisits.length === 0);
      await sheet.locator("[data-action='confirm-free-visit']").dblclick();
      await page.locator("[data-free-visit-done]").waitFor({ timeout: 8000 });
      check(`${tag}: Confirm submits once, even on a double tap`, state.freeVisits.length === 1);
      const sent = state.freeVisits[0];
      check(`${tag}: the new form version with the address, date and time`, sent.formVersion === "cx4" && sent.line1 === "12 Elm St" && sent.zip === "11735" && sent.date === day && sent.time === "10:00" && /contacted by call or text/.test(sent.consent));
      const doneText = await page.locator("[data-free-visit-done]").innerText();
      check(`${tag}: success says reserved and pending - never confirmed`, /reserved/.test(doneText) && /confirm it with you shortly/.test(doneText) && !/is confirmed/i.test(doneText));
      check(`${tag}: free visit has no page errors`, errors.length === 0, errors.join(" | "));
      await shot(page, `${tag}-free-04-done`);
      await ctx.close();
    }

    /* ====================== Free Visit -> Book a Handyman ===================== */
    {
      const { ctx, page, state } = await open(browser, { width, height });
      await page.goto(`${BASE}/book/free`, { waitUntil: "networkidle" });
      const form = page.locator("[data-free-visit-form]");
      await form.waitFor({ timeout: 20000 });
      await form.locator("input[name=name]").fill("Lee Walker");
      await form.locator("input[name=phone]").fill("516-555-0188");
      await form.locator("input[name=email]").fill("lee@mailbox.org");
      await fillAddress(form, { line1: "40 Birch Ln", city: "Farmingdale", zip: "11735" });
      const day = await page.locator(".bk-day:not([disabled])").nth(1).getAttribute("data-day");
      await page.locator(`[data-day='${day}']`).click();
      await page.locator("[data-time='13:00']").click();
      await form.locator("textarea[name=note]").fill("Mount a TV and hang two shelves");
      await page.locator("[data-action='review-free-visit']").click();
      await page.locator("[data-action='need-handyman']").click();
      await page.waitForURL(/\/book\/handyman/, { timeout: 10000 });
      const booker = page.locator("[data-handyman-booker]");
      await booker.waitFor({ timeout: 10000 });
      // Everything is already there, so it goes straight to the account step.
      await booker.locator("[data-auth-step]").waitFor({ timeout: 5000 });
      check(`${tag}: switching skips to the account step with the details shown`, /40 Birch Ln/.test(await booker.innerText()));
      check(`${tag}: nothing was booked as a free visit`, state.freeVisits.length === 0);
      await booker.locator("[data-auth-step] button:has-text('Back')").click();
      check(`${tag}: the time carried over`, (await page.locator(`[data-day='${day}'][aria-pressed=true]`).count()) === 1 && (await page.locator("[data-time='13:00'][aria-pressed=true]").count()) === 1);
      await booker.locator("button:has-text('Back')").first().click();
      check(`${tag}: the job and address carried over`, (await booker.locator("textarea[name=task]").inputValue()) === "Mount a TV and hang two shelves" && (await booker.locator("input[placeholder='Street address']").inputValue()) === "40 Birch Ln");
      await shot(page, `${tag}-handy-00-from-free-visit`);
      await ctx.close();
    }

    /* ======================= Book a Handyman, signed out ====================== */
    {
      const { ctx, page, state, errors } = await open(browser, { width, height });
      await page.goto(`${BASE}/book/handyman`, { waitUntil: "load" });
      const booker = page.locator("[data-handyman-booker]");
      await booker.waitFor({ timeout: 20000 });
      await shot(page, `${tag}-handy-01-describe`);
      await booker.locator("[data-action='to-step-2']").click();
      check(`${tag}: describe step names what is missing`, (await booker.locator(".bk-error").count()) >= 2);
      await booker.locator("textarea[name=task]").fill("Replace a kitchen faucet that drips");
      await fillAddress(booker, { line1: "9 Pine Ct", city: "Farmingdale", zip: "11735" });
      await booker.locator("[data-action='to-step-2']").click();
      const day = await page.locator(".bk-day:not([disabled])").first().getAttribute("data-day");
      await page.locator(`[data-day='${day}']`).click();
      await page.locator("[data-time='08:00']").click();
      await shot(page, `${tag}-handy-02-time`);
      await booker.locator("[data-action='to-step-3']").click();
      await booker.locator("[data-auth-step]").waitFor({ timeout: 5000 });
      check(`${tag}: signed out, it asks to sign in or create an account (not payment)`, (await booker.locator("[data-action='create-account']").count()) === 1 && (await booker.locator("[data-action='sign-in']").count()) === 1);
      await shot(page, `${tag}-handy-03-account`);
      await booker.locator("[data-action='create-account']").click();
      await page.waitForURL(/\/signup\?next=%2Fbook%2Fhandyman/, { timeout: 10000 });
      check(`${tag}: sends them to Registration 2.0 with a way back`, true);
      // They sign in (Registration 2.0 stores the token) and come back.
      state.me = customer({ addresses: [] });
      await page.evaluate(() => localStorage.setItem("token", "ui-token"));
      await page.goto(`${BASE}/book/handyman`, { waitUntil: "load" });
      await booker.waitFor({ timeout: 15000 });
      await page.locator("[data-option='one_time']").waitFor({ timeout: 10000 });
      check(`${tag}: back from sign-in, straight to how to book, draft intact`, (await booker.getAttribute("data-step")) === "4" && /9 Pine Ct/.test(await booker.locator("[data-summary]").innerText()));
      check(`${tag}: One-Time and Membership offered with real prices`, /\$99/.test(await page.locator("[data-option='one_time']").innerText()) && /\$149/.test(await page.locator("[data-option='membership']").innerText()));
      check(`${tag}: no included-visit option for a non-member`, (await page.locator("[data-option='member']").count()) === 0);
      await page.locator("[data-option='membership']").click();
      check(`${tag}: membership shows the real plans`, (await page.locator("[data-plan]").count()) === 4);
      await shot(page, `${tag}-handy-04-choose`);
      check(`${tag}: choose step fits`, await noSideScroll(page));
      await page.locator("[data-option='one_time']").click();
      await page.locator("[data-action='book-handyman']").dblclick();
      await page.waitForURL(/checkout\.stripe\.test\/cs_one/, { timeout: 10000 });
      const ot = state.oneTime;
      check(`${tag}: one checkout, even on a double tap`, ot.length === 1, `${ot.length}`);
      check(`${tag}: the typed address was saved to the account first`, state.homes.length === 1 && state.homes[0].line1 === "9 Pine Ct" && ot[0].addressId === "a-new");
      check(`${tag}: checkout carries the job, time, returnTo and a press id; no photo needed`, ot[0].returnTo === "handyman" && /^hb/.test(ot[0].clientRequestId || "") && ot[0].requestedDate === day && ot[0].requestedTime === "08:00" && ot[0].photos === 0 && /faucet/.test(ot[0].note));
      // Back from Stripe without paying.
      await page.goto(`${BASE}/book/handyman?canceled=1&booking_id=b-held-1`, { waitUntil: "load" });
      await booker.waitFor({ timeout: 15000 });
      await page.locator("text=Checkout canceled").waitFor({ timeout: 5000 });
      check(`${tag}: canceled checkout: nothing charged, draft kept, hold released`, state.abandons.includes("/api/bookings/one-time/b-held-1/abandon") && /9 Pine Ct/.test(await booker.locator("[data-summary]").innerText()));
      await shot(page, `${tag}-handy-05-canceled`);
      await page.locator("[data-option='membership']").click();
      await page.locator("[data-plan='plus']").click();
      await page.locator("[data-action='book-handyman']").click();
      await page.waitForURL(/checkout\.stripe\.test\/cs_member/, { timeout: 10000 });
      check(`${tag}: membership checkout returns to the flow`, state.memberships[0]?.returnTo === "handyman" && state.memberships[0]?.plan === "plus" && state.memberships[0]?.addressId === "a-new");
      check(`${tag}: handyman flow has no page errors`, errors.length === 0, errors.join(" | "));
      await ctx.close();
    }

    /* ====================== Book a Handyman, existing member ===================== */
    {
      const member = customer({ addresses: [{ ...ADDRESS, hasActiveSubscription: true, plan: "plus" }] });
      const { ctx, page, state } = await open(browser, { width, height, me: member });
      await page.goto(`${BASE}/book/handyman`, { waitUntil: "load" });
      const booker = page.locator("[data-handyman-booker]");
      await booker.waitFor({ timeout: 20000 });
      await booker.locator("textarea[name=task]").fill("Patch a hole in the hallway wall");
      await booker.locator("[data-action='to-step-2']").click();
      const soon = await page.locator(".bk-day:not([disabled])").first().getAttribute("data-day");
      await page.locator(`[data-day='${soon}']`).click();
      await page.locator("[data-time='10:00']").click();
      await booker.locator("[data-action='to-step-3']").click();
      await page.locator("[data-option='member']").waitFor({ timeout: 8000 });
      check(`${tag}: a member is offered the included visit, not a new membership`, (await page.locator("[data-option='membership']").count()) === 0 && /Included/.test(await page.locator("[data-option='member']").innerText()));
      await page.locator("[data-option='member']").click();
      await page.locator("[data-action='book-handyman']").click();
      await page.waitForTimeout(800);
      await shot(page, `${tag}-handy-06a-member-soon`);
      await page.locator("text=Member visits are booked at least 7 days ahead").waitFor({ timeout: 5000 });
      check(`${tag}: the seven-day member rule is explained, not silently refused`, state.bookings.length === 0);
      const later = await page.locator(".bk-day:not([disabled])").first().getAttribute("data-day");
      await page.locator(`[data-day='${later}']`).click();
      await page.locator("[data-time='13:00']").click();
      await booker.locator("[data-action='to-step-3']").click();
      await page.locator("[data-option='member']").click();
      await page.locator("[data-action='book-handyman']").click();
      await page.locator("[data-handyman-done]").waitFor({ timeout: 8000 });
      check(`${tag}: member visit requested with the included visit`, state.bookings.length === 1 && state.bookings[0].addressId === "a1" && state.bookings[0].requestedTime === "13:00" && state.oneTime.length === 0 && state.memberships.length === 0);
      check(`${tag}: it says requested and awaiting review, not confirmed`, /review it and confirm/.test(await page.locator("[data-handyman-done]").innerText()));
      await shot(page, `${tag}-handy-06b-member-done`);
      await ctx.close();
    }
  }

  await browser.close();
  const failed = results.filter((r) => !r).length;
  console.log(`\n${results.length - failed}/${results.length} passed`);
  process.exit(failed ? 1 : 0);
})().catch((error) => {
  console.error(error);
  process.exit(1);
});
