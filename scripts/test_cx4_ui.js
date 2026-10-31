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
 * - Customer Experience 4.2: days with no opening are not offered, the earliest
 *   opening is chosen on arrival (nothing held until Continue), another day
 *   chooses its earliest time, a remembered time that has gone is replaced with
 *   a note; job shortcuts add text without erasing; benefit-led membership copy,
 *   "Labor included" plan cards; the welcome offer's countdown and prices, its
 *   expiry, and a refusal re-pricing instead of opening checkout.
 */
const { chromium } = require("playwright");
const fs = require("fs");

const BASE = process.argv[2] || "http://localhost:3000";
const SCHEDULE = ["08:00", "10:00", "13:00", "15:30"];
// Four days out is fully booked: every time taken. It must never be offered.
const FULL_DAY_OFFSET = 4;
const WELCOME_PLANS = { basic: { monthlyCents: 14900, firstMonthCents: 11920 }, plus: { monthlyCents: 24900, firstMonthCents: 19920 }, premium: { monthlyCents: 34900, firstMonthCents: 27920 }, elite: { monthlyCents: 49900, firstMonthCents: 39920 } };
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
// Calendar days from today in New York, as the app counts them (not 24-hour steps,
// which land a day short just after midnight in a week that crosses a DST change).
function ymd(offset) {
  const [y, m, d] = new Date().toLocaleDateString("en-CA", { timeZone: "America/New_York" }).split("-").map(Number);
  return new Date(Date.UTC(y, m - 1, d + offset, 12)).toISOString().slice(0, 10);
}

async function open(browser, { width, height, me = null }) {
  const ctx = await browser.newContext({ viewport: { width, height }, isMobile: width < 700, hasTouch: width < 700 });
  await ctx.addInitScript((signedIn) => {
    try {
      if (signedIn) localStorage.setItem("token", "ui-token");
      localStorage.setItem("profixter_promotion_popup_dismissed_date", new Date().toISOString().slice(0, 10));
    } catch {}
  }, Boolean(me));
  const state = { me, freeVisits: [], callbacks: [], oneTime: [], memberships: [], bookings: [], abandons: [], homes: [], holds: [], releases: [], takenTimes: [], offer: null, offerAsks: 0, membershipRefusal: null };
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
        // The day's whole schedule, as the server sends it: 15:30 is always taken here.
        const open = i >= lead && i !== FULL_DAY_OFFSET;
        const candidateSlots = SCHEDULE.map((time) => ({ time, available: open && time !== "15:30" }));
        days.push({ date: d, open: true, available: open, slotCount: open ? 3 : 0, slots: open ? ["08:00", "10:00", "13:00"] : [], candidateSlots, taken: {} });
      }
      return json({ month, engine: "reservation", visitDurationMinutes: 90, days });
    }
    if (p === "/api/calendar/slots") {
      const date = u.searchParams.get("date");
      // Like the server: the member lead time applies to a day's own times too.
      const memberLead = u.searchParams.get("visit") === "membership" && date < ymd(7);
      const open = date !== ymd(FULL_DAY_OFFSET) && !memberLead;
      return json({ date, available: open, slots: open ? ["08:00", "10:00", "13:00"] : [], candidateSlots: SCHEDULE.map((time) => ({ time, available: open && time !== "15:30" })), taken: {}, capacityPerSlot: 2 });
    }
    if (p === "/api/stripe/checkout/welcome-offer") {
      state.offerAsks += 1;
      const o = state.offer;
      if (!o) return json({ eligible: false, serverNow: new Date().toISOString(), percentOff: 20 });
      const serverNow = new Date();
      if (serverNow >= o.expiresAt) return json({ eligible: false, serverNow: serverNow.toISOString(), percentOff: 20 });
      return json({ eligible: true, serverNow: serverNow.toISOString(), expiresAt: o.expiresAt.toISOString(), percentOff: 20, plans: WELCOME_PLANS });
    }
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
    if (p === "/api/bookings/hold/release" && m === "POST") {
      state.releases.push(JSON.parse(req.postData() || "{}").token);
      return json({ released: true });
    }
    if (p === "/api/bookings/hold" && m === "POST") {
      // Like the server: the same token and time extends; anything else is a new hold.
      const body = JSON.parse(req.postData() || "{}");
      const last = state.holds[state.holds.length - 1];
      state.holds.push(body);
      if (state.takenTimes.includes(body.requestedTime)) return json({ message: "That time was just taken. Pick another - everything else is saved.", code: "SLOT_UNAVAILABLE" }, 409);
      const same = body.token && last && last.issued === body.token && last.requestedDate === body.requestedDate && last.requestedTime === body.requestedTime;
      body.issued = same ? body.token : `h${state.holds.length}.secretsecretsecretsecretsecret`;
      return json({ held: true, token: body.issued, holdExpiresAt: new Date(Date.now() + 20 * 60000).toISOString(), minutes: 20 });
    }
    if (p === "/api/bookings/one-time/config") return json({ enabled: true, priceCents: 9900, currency: "usd", durationMinutes: 90, holdMinutes: 30 });
    if (p === "/api/bookings/one-time/checkout" && m === "POST") {
      const t = text();
      state.oneTime.push({ addressId: field(t, "addressId"), note: field(t, "note"), returnTo: field(t, "returnTo"), clientRequestId: field(t, "clientRequestId"), requestedDate: field(t, "requestedDate"), requestedTime: field(t, "requestedTime"), holdToken: field(t, "holdToken"), photos: (t.match(/name="images"; filename=/g) || []).length });
      return json({ url: "https://checkout.stripe.test/cs_one", bookingId: "b-held-1", entitlementId: "e1", holdExpiresAt: new Date(Date.now() + 1800000).toISOString() });
    }
    if (p.startsWith("/api/bookings/one-time/") && p.endsWith("/abandon")) {
      state.abandons.push(p);
      return json({ released: true });
    }
    if (p === "/api/stripe/checkout/create-checkout-session" && m === "POST") {
      const body = JSON.parse(req.postData() || "{}");
      if (state.membershipRefusal) {
        const refusal = state.membershipRefusal;
        state.membershipRefusal = null;
        state.offer = null;
        state.refused = (state.refused || 0) + 1;
        return json(refusal, 409);
      }
      state.memberships.push(body);
      return json({ url: "https://checkout.stripe.test/cs_member", sessionId: "cs_member" });
    }
    if (p === "/api/bookings" && m === "POST") {
      const t = text();
      state.bookings.push({ addressId: field(t, "addressId"), requestedDate: field(t, "requestedDate"), requestedTime: field(t, "requestedTime"), note: field(t, "note"), holdToken: field(t, "holdToken") });
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
      /* Compact (CX 4.1): the whole form and its button in the first screen on a phone, and nothing too small to tap. */
      const fit = await page.evaluate(() => {
        const r = document.querySelector("[data-action='review-free-visit']").getBoundingClientRect();
        const fields = [...document.querySelectorAll("[data-free-visit-form] input:not([type=file]), [data-free-visit-form] button")].filter((e) => e.offsetParent && !e.closest(".bk-days"));
        return { bottom: r.bottom, vh: window.innerHeight, smallest: Math.min(...fields.map((e) => e.getBoundingClientRect().height)) };
      });
      if (tag === "mobile") check(`${tag}: the Request button is on the first screen`, fit.bottom <= fit.vh, `${Math.round(fit.bottom)} of ${fit.vh}`);
      check(`${tag}: every field and button is at least 44px tall on screen`, fit.smallest >= 43.5, `smallest ${fit.smallest.toFixed(1)}`);
      const auto = await form.evaluate((el) => ["name", "phone", "email"].map((n) => { const i = el.querySelector(`input[name=${n}]`); return `${i.autocomplete}/${i.inputMode || i.type}/${i.enterKeyHint}`; }).join(" "));
      check(`${tag}: autofill and keyboard hints on name, phone and email`, auto === "name/text/next tel-national/tel/next email/email/next", auto);
      await form.locator("input[name=name]").focus();
      await page.keyboard.press("Enter");
      check(`${tag}: keyboard Next moves from name to phone, without submitting`, (await page.evaluate(() => document.activeElement?.getAttribute("name"))) === "phone" && (await form.locator(".bk-error").count()) === 0);
      await shot(page, `${tag}-free-01-empty`);
      await page.locator("[data-action='review-free-visit']").click();
      check(`${tag}: required fields are named`, (await form.locator(".bk-error").count()) >= 4);
      check(`${tag}: no sheet until the form is complete`, (await page.locator("[data-free-visit-sheet]").count()) === 0);
      await form.locator("input[name=name]").fill("Dana Lopez");
      await form.locator("input[name=phone]").fill("(516) 555-0123");
      await form.locator("input[name=email]").fill("dana@mailbox.org");
      await fillAddress(form, { line1: "12 Elm St", city: "Farmingdale", zip: "11735" });
      /* CX 4.2: only bookable days; the earliest opening is already chosen. */
      await page.locator(".bk-day[data-day]").first().waitFor({ timeout: 10000 });
      await page.locator(".bk-day[aria-pressed=true]").waitFor({ timeout: 10000 });
      const offered = await page.locator(".bk-day[data-day]").evaluateAll((els) => els.map((e) => e.getAttribute("data-day")));
      check(`${tag}: days with no opening are not offered (today, tomorrow, the fully booked day)`, !offered.includes(ymd(0)) && !offered.includes(ymd(1)) && !offered.includes(ymd(FULL_DAY_OFFSET)) && offered[0] === ymd(2), offered.slice(0, 5).join(","));
      check(`${tag}: no disabled or struck-through days in the strip`, (await page.locator(".bk-day:disabled").count()) === 0);
      check(`${tag}: days stay in date order`, offered.every((d, i) => i === 0 || offered[i - 1] < d));
      check(`${tag}: the earliest day and its earliest time are chosen on arrival`, (await page.locator(`[data-day='${ymd(2)}'][aria-pressed=true]`).count()) === 1 && (await page.locator("[data-time='08:00'][aria-pressed=true]").count()) === 1);
      await page.locator(`[data-day='${ymd(3)}']`).click();
      check(`${tag}: choosing another day chooses that day's earliest time`, (await page.locator(`[data-day='${ymd(3)}'][aria-pressed=true]`).count()) === 1 && (await page.locator("[data-time='08:00'][aria-pressed=true]").count()) === 1);
      const day = await page.locator(".bk-day[data-day]").first().getAttribute("data-day");
      await page.locator(`[data-day='${day}']`).click();
      await page.locator("[data-time='10:00']").click();
      /* The day's whole schedule: the taken time is shown, struck through, and cannot be chosen. */
      const taken = page.locator("[data-time='15:30']");
      check(`${tag}: a taken time stays visible but disabled`, (await taken.count()) === 1 && (await taken.isDisabled()) && (await taken.getAttribute("aria-label")) === "3:30 PM, unavailable");
      check(`${tag}: the taken time looks unavailable (struck through)`, /line-through/.test(await taken.evaluate((el) => getComputedStyle(el).textDecorationLine)));
      await taken.click({ force: true });
      check(`${tag}: tapping a taken time changes nothing`, (await page.locator("[data-time='10:00'][aria-pressed=true]").count()) === 1 && (await taken.getAttribute("aria-pressed")) === null);
      /* Note and photos wait behind one small optional control. */
      check(`${tag}: note and photos are folded away until asked for`, (await form.locator("textarea[name=note]").count()) === 0 && /optional/.test(await form.locator("[data-action='add-details']").innerText()));
      await form.locator("[data-action='add-details']").click();
      check(`${tag}: description and photos are optional`, (await form.locator("text=(optional)").count()) >= 1 && (await form.locator("textarea[name=note]").count()) === 1);
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
      /* Going away and coming back (reload, Back) keeps what was typed. */
      await page.reload({ waitUntil: "networkidle" });
      await form.waitFor({ timeout: 20000 });
      check(`${tag}: a reload keeps name, phone, email and address`, (await form.locator("input[name=name]").inputValue()) === "Lee Walker" && (await form.locator("input[name=email]").inputValue()) === "lee@mailbox.org" && (await form.locator("input[placeholder='Street address']").inputValue()) === "40 Birch Ln");
      const day = await page.locator(".bk-day[data-day]").nth(1).getAttribute("data-day");
      await page.locator(`[data-day='${day}']`).click();
      await page.locator("[data-time='13:00']").click();
      await page.waitForTimeout(300);
      await page.reload({ waitUntil: "networkidle" });
      await form.waitFor({ timeout: 20000 });
      await page.locator(".bk-day[aria-pressed=true]").waitFor({ timeout: 10000 });
      await page.waitForTimeout(600);
      check(`${tag}: a reload keeps the chosen day and time (not reset to the earliest)`, (await page.locator(`[data-day='${day}'][aria-pressed=true]`).count()) === 1 && (await page.locator("[data-time='13:00'][aria-pressed=true]").count()) === 1);
      await form.locator("[data-action='add-details']").click();
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
      await page.waitForTimeout(400);
      check(`${tag}: reaching the account step holds their time`, state.holds.length === 1 && state.holds[0].requestedDate === day && state.holds[0].requestedTime === "13:00", JSON.stringify(state.holds));
      await booker.locator("[data-auth-step] button:has-text('Back')").click();
      await page.locator(".bk-day[aria-pressed=true]").waitFor({ timeout: 10000 });
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
      /* CX 4.2 job shortcuts: add, never duplicate, never erase. */
      const task = booker.locator("textarea[name=task]");
      const chips = booker.locator("[data-shortcut]");
      check(`${tag}: job shortcuts offered`, (await chips.count()) >= 8, String(await chips.count()));
      const chipHeights = await chips.evaluateAll((els) => els.map((e) => e.getBoundingClientRect().height));
      check(`${tag}: every shortcut is a full tap target`, Math.min(...chipHeights) >= 43.5, chipHeights.map((h) => h.toFixed(0)).join(","));
      await booker.locator("[data-shortcut='Replace faucet']").click();
      check(`${tag}: a shortcut writes a useful description`, (await task.inputValue()) === "Replace an existing faucet.", await task.inputValue());
      await booker.locator("[data-shortcut='Replace faucet']").click();
      check(`${tag}: tapping it again does not duplicate it`, (await task.inputValue()) === "Replace an existing faucet." && (await booker.locator("[data-shortcut='Replace faucet'][aria-pressed=true]").count()) === 1);
      await task.fill("The kitchen one drips at night");
      await booker.locator("[data-shortcut='Fix door']").click();
      await booker.locator("[data-shortcut='Install shelves']").click();
      check(`${tag}: typed text survives, shortcuts are added on their own lines`, (await task.inputValue()) === "The kitchen one drips at night\nFix a door that sticks or won't latch.\nInstall wall shelves.", JSON.stringify(await task.inputValue()));
      const labels = await chips.evaluateAll((els) => els.map((e) => e.getAttribute("data-shortcut")));
      await task.fill("");
      for (const label of labels) await booker.locator(`[data-shortcut='${label}']`).click();
      const lines = (await task.inputValue()).split("\n");
      check(`${tag}: every shortcut adds its own line of at least three words`, lines.length === labels.length && lines.every((l) => l.trim().split(/\s+/).length >= 3), JSON.stringify(lines));
      await task.fill("Replace a kitchen faucet that drips");
      await fillAddress(booker, { line1: "9 Pine Ct", city: "Farmingdale", zip: "11735" });
      await booker.locator("[data-action='to-step-2']").click();
      await page.locator(".bk-day[aria-pressed=true]").waitFor({ timeout: 10000 });
      await page.waitForTimeout(500);
      check(`${tag}: When opens on the earliest opening, already chosen`, (await page.locator(`[data-day='${ymd(2)}'][aria-pressed=true]`).count()) === 1 && (await page.locator("[data-time='08:00'][aria-pressed=true]").count()) === 1);
      check(`${tag}: a default choice holds nothing (no hold until Continue)`, state.holds.length === 0, JSON.stringify(state.holds));
      check(`${tag}: the fully booked day is not offered`, (await page.locator(`[data-day='${ymd(FULL_DAY_OFFSET)}']`).count()) === 0);
      const day = await page.locator(".bk-day[data-day]").first().getAttribute("data-day");
      await page.locator(`[data-day='${day}']`).click();
      await page.locator("[data-time='08:00']").click();
      await shot(page, `${tag}-handy-02-time`);
      await booker.locator("[data-action='to-step-3']").click();
      await booker.locator("[data-auth-step]").waitFor({ timeout: 5000 });
      check(`${tag}: signed out, it asks to sign in or create an account (not payment)`, (await booker.locator("[data-action='create-account']").count()) === 1 && (await booker.locator("[data-action='sign-in']").count()) === 1);
      const firstHold = state.holds[0]?.issued;
      check(`${tag}: the chosen time is held at the sign-in step (new hold, no token yet)`, state.holds.length === 1 && state.holds[0].requestedDate === day && state.holds[0].requestedTime === "08:00" && !state.holds[0].token && !!firstHold, JSON.stringify(state.holds));
      check(`${tag}: the account step says the time is held`, /holding this time for you until/.test(await booker.locator("[data-hold-note]").innerText()));
      check(`${tag}: the hold token is saved with the draft`, (await page.evaluate(() => JSON.parse(localStorage.getItem("pf_handyman_draft") || "{}").holdToken)) === firstHold);
      await shot(page, `${tag}-handy-03-account`);
      await booker.locator("[data-action='create-account']").click();
      await page.waitForURL(/\/signup\?next=%2Fbook%2Fhandyman/, { timeout: 10000 });
      check(`${tag}: sends them to Registration 2.0 with a way back`, true);
      // They create an account (Registration 2.0 stores the token) and come back: a new customer, inside the welcome window.
      state.me = customer({ addresses: [] });
      state.offer = { expiresAt: new Date(Date.now() + 9.5 * 60000) };
      await page.evaluate(() => localStorage.setItem("token", "ui-token"));
      await page.goto(`${BASE}/book/handyman`, { waitUntil: "load" });
      await booker.waitFor({ timeout: 15000 });
      await page.locator("[data-option='one_time']").waitFor({ timeout: 10000 });
      check(`${tag}: back from sign-in, straight to how to book, draft intact`, (await booker.getAttribute("data-step")) === "4" && /9 Pine Ct/.test(await booker.locator("[data-summary]").innerText()));
      await page.waitForTimeout(400);
      check(`${tag}: back from sign-in, the same hold is extended`, state.holds.length === 2 && state.holds[1].token === firstHold && state.holds[1].issued === firstHold, JSON.stringify(state.holds.map((h) => h.token)));
      check(`${tag}: step 4 shows the hold`, /Held for you until/.test(await booker.locator("[data-summary]").innerText()));
      check(`${tag}: One-Time and Membership offered with real prices`, /\$99/.test(await page.locator("[data-option='one_time']").innerText()) && /\$149/.test(await page.locator("[data-option='membership']").innerText()));
      check(`${tag}: no included-visit option for a non-member`, (await page.locator("[data-option='member']").count()) === 0);
      const memberCard = await page.locator("[data-option='membership']").innerText();
      check(`${tag}: membership card sells benefits, not rules`, /Labor included for covered tasks/.test(memberCard) && /month-to-month/.test(memberCard) && !/7\+ days|seven|all year|more than one job/i.test(memberCard), memberCard);
      await page.locator("[data-option='membership']").click();
      check(`${tag}: membership shows the real plans`, (await page.locator("[data-plan]").count()) === 4);
      const planTexts = await page.locator("[data-plan]").allInnerTexts();
      check(`${tag}: each plan card says Labor included (no visits-at-a-time line)`, planTexts.every((t) => /Labor included/.test(t) && !/at a time/.test(t)), planTexts.join(" | "));
      check(`${tag}: See all plans is visible`, (await page.locator("[data-link='all-plans']").isVisible()) && (await page.getAttribute("[data-link='all-plans']", "href")) === "/membership/plans");
      /* The welcome offer, for a new customer: real countdown, first month struck from the regular price. */
      const banner = page.locator("[data-welcome-offer]");
      await banner.waitFor({ timeout: 8000 });
      const clock1 = await page.locator("[data-welcome-countdown]").innerText();
      check(`${tag}: welcome offer banner with the time left`, /Welcome Offer .* 20% Off Your First Month/.test(await banner.innerText()) && /^9:[0-3]\d$/.test(clock1), clock1);
      const basic = await page.locator("[data-plan='basic']").innerText();
      check(`${tag}: plan card: $149 struck, $119.20 first month`, /\$149/.test(basic) && /\$119\.20/.test(basic) && /first month/.test(basic) && (await page.locator("[data-plan='basic'] s").innerText()) === "$149", basic);
      await page.locator("[data-plan='plus']").click();
      check(`${tag}: renewal price named, taxes named`, /\$199\.20 for your first month, then \$249\/month afterward, plus applicable taxes/.test(await page.locator("[data-plan-terms]").innerText()));
      check(`${tag}: the button shows the first-month price`, /\$199\.20 first month/.test(await page.locator("[data-action='book-handyman']").innerText()));
      await page.waitForTimeout(1300);
      const clock2 = await page.locator("[data-welcome-countdown]").innerText();
      check(`${tag}: the countdown counts down`, clock2 < clock1, `${clock1} -> ${clock2}`);
      await shot(page, `${tag}-handy-04-choose`);
      check(`${tag}: choose step fits`, await noSideScroll(page));
      await page.locator("[data-option='one_time']").click();
      await page.locator("[data-action='book-handyman']").dblclick();
      await page.waitForURL(/checkout\.stripe\.test\/cs_one/, { timeout: 10000 });
      const ot = state.oneTime;
      check(`${tag}: one checkout, even on a double tap`, ot.length === 1, `${ot.length}`);
      check(`${tag}: the typed address was saved to the account first`, state.homes.length === 1 && state.homes[0].line1 === "9 Pine Ct" && ot[0].addressId === "a-new");
      check(`${tag}: checkout carries the job, time, returnTo and a press id; no photo needed`, ot[0].returnTo === "handyman" && /^hb/.test(ot[0].clientRequestId || "") && ot[0].requestedDate === day && ot[0].requestedTime === "08:00" && ot[0].photos === 0 && /faucet/.test(ot[0].note));
      check(`${tag}: checkout carries their hold so it gives way to the booking`, ot[0].holdToken === firstHold, String(ot[0].holdToken));
      // Back from Stripe without paying.
      await page.goto(`${BASE}/book/handyman?canceled=1&booking_id=b-held-1`, { waitUntil: "load" });
      await booker.waitFor({ timeout: 15000 });
      await page.locator("text=Checkout canceled").waitFor({ timeout: 5000 });
      check(`${tag}: canceled checkout: nothing charged, draft kept, hold released`, state.abandons.includes("/api/bookings/one-time/b-held-1/abandon") && /9 Pine Ct/.test(await booker.locator("[data-summary]").innerText()));
      check(`${tag}: a canceled checkout does not re-hold over its own pending booking`, state.holds.length === 2, String(state.holds.length));
      await shot(page, `${tag}-handy-05-canceled`);
      await page.locator("[data-option='membership']").click();
      await page.locator("[data-plan='plus']").click();
      const clockBefore = await page.locator("[data-welcome-countdown]").innerText();
      check(`${tag}: a reload never restarts the countdown`, clockBefore <= clock2 && state.offerAsks >= 2, `${clock2} -> ${clockBefore}`);
      /* The server says the offer has gone (another tab bought, say): nothing opens, the page re-prices. */
      state.membershipRefusal = { code: "WELCOME_OFFER_ENDED", message: "The welcome offer has ended. The prices shown now are the regular monthly prices." };
      await page.locator("[data-action='book-handyman']").click();
      await page.locator("text=The welcome offer has ended").waitFor({ timeout: 5000 });
      await page.locator("[data-welcome-offer]").waitFor({ state: "detached", timeout: 5000 });
      check(`${tag}: a refused welcome price opens nothing and re-prices to regular`, state.memberships.length === 0 && state.refused === 1 && /\$249\/mo/.test(await page.locator("[data-plan='plus']").innerText()) && (await page.locator("[data-plan-offer]").count()) === 0 && page.url().includes("/book/handyman"));
      await page.locator("[data-action='book-handyman']").click();
      await page.waitForURL(/checkout\.stripe\.test\/cs_member/, { timeout: 10000 });
      check(`${tag}: membership checkout returns to the flow`, state.memberships[0]?.returnTo === "handyman" && state.memberships[0]?.plan === "plus" && state.memberships[0]?.addressId === "a-new");
      check(`${tag}: the regular-price checkout does not ask for the welcome price`, state.memberships[0]?.welcomeOffer === false);
      check(`${tag}: handyman flow has no page errors`, errors.length === 0, errors.join(" | "));
      await ctx.close();
    }

    /* ================= Book a Handyman, the time goes while choosing ================ */
    {
      const { ctx, page, state, errors } = await open(browser, { width, height });
      state.takenTimes = ["10:00"];
      await page.goto(`${BASE}/book/handyman`, { waitUntil: "load" });
      const booker = page.locator("[data-handyman-booker]");
      await booker.waitFor({ timeout: 20000 });
      await booker.locator("textarea[name=task]").fill("Fix a running toilet upstairs");
      await fillAddress(booker, { line1: "3 Elm Rd", city: "Farmingdale", zip: "11735" });
      await booker.locator("[data-action='to-step-2']").click();
      await page.locator(".bk-day[aria-pressed=true]").waitFor({ timeout: 10000 }); // the month view has loaded
      const day = await page.locator(".bk-day[data-day]").first().getAttribute("data-day");
      await page.locator(`[data-day='${day}']`).click();
      await page.locator("[data-time='10:00']").click();
      await booker.locator("[data-action='to-step-3']").click();
      await page.locator("text=That time was just taken").waitFor({ timeout: 5000 });
      check(`${tag}: a time taken by someone else: stays on When, says so, keeps the job`, (await booker.getAttribute("data-step")) === "2" && (await page.locator("[data-time='10:00'][aria-pressed=true]").count()) === 0 && (await page.evaluate(() => JSON.parse(localStorage.getItem("pf_handyman_draft") || "{}").task)) === "Fix a running toilet upstairs");
      await page.waitForTimeout(400);
      check(`${tag}: ...and the next opening is chosen for them`, (await page.locator("[data-time='08:00'][aria-pressed=true]").count()) === 1);
      await page.locator("[data-time='13:00']").click();
      await booker.locator("[data-action='to-step-3']").click();
      await booker.locator("[data-auth-step]").waitFor({ timeout: 5000 });
      check(`${tag}: another time is held and they go on`, state.holds.length === 2 && state.holds[1].requestedTime === "13:00");
      await booker.locator("[data-auth-step] button:has-text('Back')").click();
      await page.locator(".bk-day[aria-pressed=true]").waitFor({ timeout: 10000 });
      check(`${tag}: back on When, their own held time is still shown as chosen`, (await page.locator("[data-time='13:00'][aria-pressed=true]").count()) === 1);
      await shot(page, `${tag}-handy-07-taken`);
      check(`${tag}: taken-time flow has no page errors`, errors.length === 0, errors.join(" | "));
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
      await page.locator(".bk-day[aria-pressed=true]").waitFor({ timeout: 10000 });
      await page.waitForTimeout(500);
      const first = await page.locator(".bk-day[data-day]").first().getAttribute("data-day");
      check(`${tag}: a member home sees only times its included visit can take (7+ days out)`, first >= ymd(7) && /Member visits start 7 days out/.test(await booker.innerText()), first);
      check(`${tag}: the earliest member day is chosen for them`, (await page.locator(`[data-day='${first}'][aria-pressed=true]`).count()) === 1 && first === ymd(7) && (await page.locator("[data-time='08:00'][aria-pressed=true]").count()) === 1, first);
      check(`${tag}: members are never shown the new-customer offer`, (await page.locator("[data-welcome-offer]").count()) === 0);
      await page.locator(`[data-day='${first}']`).click();
      await page.locator("[data-time='13:00']").click();
      await booker.locator("[data-action='to-step-3']").click();
      await page.locator("[data-option='member']").waitFor({ timeout: 8000 });
      check(`${tag}: a member is offered the included visit, not a new membership`, (await page.locator("[data-option='membership']").count()) === 0 && /Included/.test(await page.locator("[data-option='member']").innerText()));
      await page.locator("[data-option='member']").click();
      await page.locator("[data-action='book-handyman']").click();
      await page.locator("[data-handyman-done]").waitFor({ timeout: 8000 });
      check(`${tag}: member visit requested with the included visit, first press`, state.bookings.length === 1 && state.bookings[0].addressId === "a1" && state.bookings[0].requestedTime === "13:00" && state.bookings[0].requestedDate === first && state.oneTime.length === 0 && state.memberships.length === 0);
      check(`${tag}: signed in, Continue holds the time and the booking carries it`, state.holds.length === 1 && state.holds[0].requestedTime === "13:00" && state.bookings[0].holdToken === state.holds[0].issued, JSON.stringify(state.holds));
      check(`${tag}: it says requested and awaiting review, not confirmed`, /review it and confirm/.test(await page.locator("[data-handyman-done]").innerText()));
      await shot(page, `${tag}-handy-06b-member-done`);
      await ctx.close();
    }

    /* ======= A member whose draft already has a sooner time (picked before signing in) ======= */
    {
      const member = customer({ addresses: [{ ...ADDRESS, hasActiveSubscription: true, plan: "plus" }] });
      const { ctx, page, state } = await open(browser, { width, height, me: member });
      const soon = ymd(3);
      await ctx.addInitScript((d) => {
        try {
          localStorage.setItem("pf_handyman_draft", JSON.stringify({ task: "Patch a hole in the hallway wall", addressId: "a1", address: null, date: d.date, time: "10:00", name: "", phone: "", email: "", photoCount: 0, clientRequestId: "", choice: "", plan: "", pendingBookingId: "", holdToken: "h0.secretsecretsecretsecretsecret", holdFor: `${d.date} 10:00`, holdExpiresAt: new Date(Date.now() + 600000).toISOString(), updatedAt: Date.now() }));
        } catch {}
      }, { date: soon });
      await page.goto(`${BASE}/book/handyman`, { waitUntil: "load" });
      const booker = page.locator("[data-handyman-booker]");
      await page.locator("text=Member visits are booked at least 7 days ahead").first().waitFor({ timeout: 15000 });
      await page.waitForTimeout(500);
      await shot(page, `${tag}-handy-06a-member-soon`);
      check(`${tag}: the seven-day member rule is explained up front, back on When, nothing booked`, state.bookings.length === 0 && (await booker.getAttribute("data-step")) === "2");
      check(`${tag}: the held time the rule refuses is let go, and not held again`, state.releases.includes("h0.secretsecretsecretsecretsecret") && state.holds.length === 0, JSON.stringify({ r: state.releases, h: state.holds }));
      check(`${tag}: the job is kept`, (await page.evaluate(() => JSON.parse(localStorage.getItem("pf_handyman_draft") || "{}").task)) === "Patch a hole in the hallway wall");
      await page.locator(".bk-day[aria-pressed=true]").waitFor({ timeout: 10000 });
      await page.waitForTimeout(600);
      const picked = await page.evaluate(() => { const d = JSON.parse(localStorage.getItem("pf_handyman_draft") || "{}"); return `${d.date} ${d.time}`; });
      check(`${tag}: once membership is known, the time is revalidated to the earliest member opening`, (await page.locator(`[data-day='${ymd(7)}'][aria-pressed=true]`).count()) === 1 && (await page.locator("[data-time='08:00'][aria-pressed=true]").count()) === 1 && state.holds.length === 0, `${picked} holds=${state.holds.length} first=${await page.locator(".bk-day[data-day]").first().getAttribute("data-day")}`);
      await ctx.close();
    }

    /* ===== CX 4.2: a remembered time that has gone; an unconfirmed default is not held ===== */
    {
      const { ctx, page, state } = await open(browser, { width, height });
      await ctx.addInitScript((d) => {
        try {
          if (!sessionStorage.getItem("seeded")) {
            sessionStorage.setItem("seeded", "1");
            localStorage.setItem("pf_handyman_draft", JSON.stringify({ task: "Hang three shelves in the den", addressId: "", address: { line1: "5 Oak Ct", unit: "", city: "Farmingdale", state: "NY", zip: "11735" }, date: d, time: "10:00", name: "", phone: "", email: "", photoCount: 0, clientRequestId: "", choice: "", plan: "", pendingBookingId: "", holdToken: "", holdFor: "", holdExpiresAt: "", updatedAt: Date.now() }));
          }
        } catch {}
      }, ymd(FULL_DAY_OFFSET));
      await page.goto(`${BASE}/book/handyman`, { waitUntil: "load" });
      const booker = page.locator("[data-handyman-booker]");
      await booker.waitFor({ timeout: 20000 });
      await page.locator("[data-slot-notice]").waitFor({ timeout: 10000 });
      check(`${tag}: a saved time on a day that filled up: replaced by the earliest opening, with a short note`, (await booker.getAttribute("data-step")) === "2" && (await page.locator(`[data-day='${ymd(2)}'][aria-pressed=true]`).count()) === 1 && (await page.locator("[data-time='08:00'][aria-pressed=true]").count()) === 1 && /no longer open/.test(await page.locator("[data-slot-notice]").innerText()));
      check(`${tag}: an unconfirmed saved time does not skip ahead or hold`, state.holds.length === 0);
      await shot(page, `${tag}-handy-08-saved-gone`);
      await ctx.close();
    }

    /* ===== CX 4.2: the welcome offer runs out while they look ===== */
    {
      const { ctx, page, state } = await open(browser, { width, height, me: customer() });
      state.offer = { expiresAt: new Date(Date.now() + 6000) };
      await ctx.addInitScript((d) => {
        try {
          localStorage.setItem("pf_handyman_draft", JSON.stringify({ task: "Replace a bathroom faucet please", addressId: "a1", address: null, date: d, time: "08:00", name: "", phone: "", email: "", photoCount: 0, clientRequestId: "", choice: "membership", plan: "basic", pendingBookingId: "", holdToken: "", holdFor: "", holdExpiresAt: "", timeConfirmed: true, updatedAt: Date.now() }));
        } catch {}
      }, ymd(9));
      await page.goto(`${BASE}/book/handyman`, { waitUntil: "load" });
      await page.locator("[data-welcome-offer]").waitFor({ timeout: 10000 });
      check(`${tag}: a confirmed time and a signed-in customer go straight to choosing`, (await page.locator("[data-handyman-booker]").getAttribute("data-step")) === "4");
      check(`${tag}: inside the window the first-month price shows`, (await page.locator("[data-plan-offer]").count()) === 4);
      await page.locator("[data-welcome-offer]").waitFor({ state: "detached", timeout: 8000 });
      check(`${tag}: at zero the offer disappears and regular prices return`, (await page.locator("[data-plan-offer]").count()) === 0 && /\$149\/mo/.test(await page.locator("[data-plan='basic']").innerText()) && !/first month/.test(await page.locator("[data-action='book-handyman']").innerText()));
      await page.reload({ waitUntil: "load" });
      await page.locator("[data-plan='basic']").waitFor({ timeout: 10000 });
      await page.waitForTimeout(800);
      check(`${tag}: reloading after it ended does not bring it back`, (await page.locator("[data-welcome-offer]").count()) === 0);
      await page.locator("[data-action='book-handyman']").click();
      await page.waitForURL(/checkout\.stripe\.test\/cs_member/, { timeout: 10000 });
      check(`${tag}: after the window, checkout asks for the regular price`, state.memberships[0]?.welcomeOffer === false && state.memberships[0]?.billingCycle === "monthly");
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
