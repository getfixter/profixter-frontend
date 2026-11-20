/* eslint-disable @typescript-eslint/no-require-imports -- a plain Node script, like its neighbours */
/*
 * Customer Experience 4.0, in the browser against a mocked API (2026-10-30).
 *
 *   node scripts/test_cx4_ui.js [baseUrl] [screenshotDir]
 *
 * The mock answers as BackEnd routes/freeVisitRequests.js, requests.js,
 * bookings.js and stripe.js do (pinned by BackEnd scripts/test_cx4_integration.js).
 *
 * - Homepage: both tabs of the booking panel (Free Visit, Book a Handyman) are
 *   inside the first screen at common phone sizes, the Free Visit form open;
 *   headline readable; no sideways scroll (the panel itself:
 *   test_home_booking_ui.js).
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
// The guest consent line, word for word (BackEnd routes/freeVisitRequests.js CONTACT_CONSENT_TEXT).
const GUEST_CHECKOUT_LINE = "By booking, you agree that ProFixter may call or text you about this visit. Message frequency varies. Msg & data rates may apply. Reply STOP to opt out or HELP for help.";
const GUEST_LINE = "By requesting a visit, you agree that ProFixter may call or text you about this visit. Message frequency varies. Msg & data rates may apply. Reply STOP to opt out or HELP for help.";
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
  const state = { me, freeVisits: [], callbacks: [], oneTime: [], memberships: [], bookings: [], abandons: [], homes: [], holds: [], releases: [], takenTimes: [], offer: null, offerAsks: 0, membershipRefusal: null, steps: [], rejectFreeVisit: 0,
    // 2026-11-17 guest checkout: what the guest endpoints were sent, queued replies, the status page's answers, Clarity calls.
    guestCheckouts: [], guestFullDays: [], guestAbandons: [], guestReplies: [], fvReplies: [], statusQueue: [], statusAsks: 0, clarity: [] };
  await ctx.exposeBinding("__pfClarity", (_src, args) => state.clarity.push(args));
  /*
   * 2026-11-17 acquisition audit: the Meta Pixel is a recorder (no request
   * reaches Meta), and navigator.webdriver reads false so the funnel steps
   * (lib/meta trackStep, skipped for automation) are sent to the mock below.
   */
  await ctx.route(/connect\.facebook\.net|facebook\.com\/tr|googletagmanager\.com|clarity\.ms|google-analytics\.com/, (r) => r.abort());
  await ctx.addInitScript(() => {
    try {
      Object.defineProperty(Navigator.prototype, "webdriver", { get: () => false });
      // 2026-11-19: this suite tests the homepage itself, not the welcome entry (lib/welcome-entry), and its
      // funnel beacons go to the mock below, which off profixter.com needs the test opt-in (lib/tracking-scope).
      try {
        localStorage.setItem("pf_welcome", "home");
        localStorage.setItem("pf_trackers_allow_host", "1");
      } catch {}
    } catch {}
    const calls = [];
    window.__fbqCalls = calls;
    window.fbq = function (...args) {
      calls.push(args);
    };
    window._fbq = window.fbq;
    window.fbq.queue = [];
    window.fbq.loaded = true;
    window.fbq.version = "2.0";
    // Microsoft Clarity, recorded (GTM's real one never loads here): lib/clarity calls window.clarity("set" | "event", ...).
    window.clarity = function (...args) {
      try {
        window.__pfClarity(args);
      } catch {}
    };
    window.clarity.q = [];
  });
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
    if (p === "/api/track/step" && m === "POST") {
      state.steps.push(JSON.parse(req.postData() || "{}").step);
      return route.fulfill({ status: 204, headers: cors });
    }
    if (p === "/api/free-visit-requests" && m === "POST" && state.rejectFreeVisit > 0) {
      state.rejectFreeVisit -= 1;
      return json({ success: false, code: "TRANSACTIONS_UNAVAILABLE", message: "Booking is temporarily unavailable. Please try again, or call or text 631-599-1363." }, 503);
    }
    if (p === "/api/free-visit-requests" && m === "POST" && state.fvReplies.length) {
      const reply = state.fvReplies.shift();
      return json(reply.body, reply.status);
    }
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
    if (p === "/api/bookings/guest/one-time/checkout" && m === "POST") {
      const t = text();
      state.guestCheckouts.push({ auth: req.headers()["authorization"] || "", name: field(t, "name"), phone: field(t, "phone"), email: field(t, "email"), line1: field(t, "line1"), city: field(t, "city"), zip: field(t, "zip"), note: field(t, "note"), requestedDate: field(t, "requestedDate"), requestedTime: field(t, "requestedTime"), holdToken: field(t, "holdToken"), clientRequestId: field(t, "clientRequestId"), consentText: field(t, "consentText"), photos: (t.match(/name="images"; filename=/g) || []).length });
      const reply = state.guestReplies.shift();
      if (reply) return json(reply.body, reply.status);
      await new Promise((r) => setTimeout(r, 300));
      return json({ url: "https://checkout.stripe.test/cs_guest_1", bookingId: "g-held-1", holdExpiresAt: new Date(Date.now() + 1800000).toISOString() });
    }
    if (p === "/api/bookings/guest/full-day/checkout" && m === "POST") {
      const t = text();
      state.guestFullDays.push({ auth: req.headers()["authorization"] || "", name: field(t, "name"), phone: field(t, "phone"), email: field(t, "email"), line1: field(t, "line1"), zip: field(t, "zip"), note: field(t, "note"), date: field(t, "date"), clientRequestId: field(t, "clientRequestId"), consentText: field(t, "consentText") });
      const reply = state.guestReplies.shift();
      if (reply) return json(reply.body, reply.status);
      return json({ url: "https://checkout.stripe.test/cs_guest_fd", bookingId: "g-fd-1", holdExpiresAt: new Date(Date.now() + 1800000).toISOString() });
    }
    if (p === "/api/bookings/guest/abandon" && m === "POST") {
      state.guestAbandons.push(JSON.parse(req.postData() || "{}"));
      return json({ released: true });
    }
    if (p === "/api/bookings/guest/status") {
      state.statusAsks += 1;
      const next = state.statusQueue.length > 1 ? state.statusQueue.shift() : state.statusQueue[0];
      return next ? json(next) : json({ message: "Not found" }, 404);
    }
    if (p === "/api/bookings/full-day/config") return json({ enabled: true, priceCents: 49900, currency: "usd", approximateHours: 8, holdMinutes: 30, cancellationPhone: "631-599-1363" });
    if (p === "/api/bookings/full-day/availability") {
      const from = u.searchParams.get("from");
      const to = u.searchParams.get("to") || from;
      const days = [];
      for (let i = 0; i < 70; i++) {
        const d = ymd(i);
        if (d < from || d > to) continue;
        days.push({ date: d, available: i >= 3, startTime: "08:00", endTime: "16:00", reason: i >= 3 ? "" : "Too soon" });
      }
      return json({ days });
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
    /* Homepage booking panel (2026-11-03): both tabs and the open Free Visit form are in the first screen. */
    const free = await inFirstScreen(page, "[data-home-tab='free']");
    const handy = await inFirstScreen(page, "[data-home-tab='handyman']");
    check(`${name}: Free Visit visible without scrolling`, free.ok, JSON.stringify(free));
    check(`${name}: Book a Handyman visible without scrolling`, handy.ok, JSON.stringify(handy));
    const title = await inFirstScreen(page, "#hm-title");
    const size = await page.evaluate(() => parseFloat(getComputedStyle(document.querySelector("#hm-title")).fontSize));
    check(`${name}: headline on screen and readable`, title.ok && size >= 22, `font ${size}`);
    check(`${name}: Free Visit is open first, with the real form`, (await page.getAttribute("[data-home-tab='free']", "aria-selected")) === "true" && (await page.locator("[data-home-booking] [data-free-visit-form].bk--embedded").count()) === 1);
    check(`${name}: no sideways scroll`, await noSideScroll(page));
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
      /* 2026-11-03: the consent line under the button, word for word, with its documents; no checkbox. */
      const consentLine = page.locator("[data-action='review-free-visit'] + [data-contact-consent]");
      check(`${tag}: the consent line sits right under the Request button, word for word`, (await consentLine.count()) === 1 && (await consentLine.innerText()).replace(/\s+/g, " ").trim() === `${GUEST_LINE} SMS Terms · Privacy`, await consentLine.innerText().catch(() => ""));
      check(`${tag}: it links the SMS Terms and Privacy in a new tab`, (await consentLine.locator("a[href='/communication-consent#service-texts'][target=_blank]").count()) === 1 && (await consentLine.locator("a[href='/privacy'][target=_blank]").count()) === 1);
      check(`${tag}: no checkbox on the Free Visit form`, (await form.locator("input[type=checkbox]").count()) === 0);
      await shot(page, `${tag}-free-01-empty`);
      await page.locator("[data-action='review-free-visit']").click();
      check(`${tag}: required fields are named`, (await form.locator(".bk-error").count()) >= 4);
      check(`${tag}: no sheet until the form is complete`, (await page.locator("[data-free-visit-sheet]").count()) === 0);
      /*
       * Each field clicked, then filled, then read back (2026-11-17): filling
       * straight after the keyboard-Next check above sent the phone into the
       * name field, so the form refused it and the suite stopped here.
       */
      for (const [n, v] of [["name", "Dana Lopez"], ["phone", "(516) 555-0123"], ["email", "dana@mailbox.org"]]) {
        const input = form.locator(`input[name=${n}]`);
        await input.click();
        await input.fill(v);
        if ((await input.inputValue()) !== v) await input.fill(v);
      }
      check(`${tag}: name, phone and email hold what was typed`, (await form.locator("input[name=name]").inputValue()) === "Dana Lopez" && (await form.locator("input[name=phone]").inputValue()).replace(/\D/g, "") === "5165550123");
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
      /* 2026-11-17: a refused submission is a failed step, never a Lead; the retry is the one Lead. */
      const leads = () => page.evaluate(() => (window.__fbqCalls || []).filter((c) => c[0] === "track" && c[1] === "Lead"));
      state.rejectFreeVisit = 1;
      await sheet.locator("[data-action='confirm-free-visit']").click();
      await page.locator(".bk-banner--warn").first().waitFor({ timeout: 8000 });
      check(`${tag}: a refused submission says so and keeps the form`, /temporarily unavailable/.test(await page.locator(".bk-banner--warn").first().innerText()) && (await form.locator("input[name=name]").inputValue()) === "Dana Lopez");
      await page.waitForTimeout(300);
      check(`${tag}: a refused submission fires no Lead`, (await leads()).length === 0);
      check(`${tag}: a refused submission is recorded as request_failed`, state.steps.includes("request_failed"), state.steps.join(","));
      await page.locator("[data-action='review-free-visit']").click();
      await sheet.waitFor({ timeout: 5000 });
      await page.waitForTimeout(500);
      await sheet.locator("[data-action='confirm-free-visit']").dblclick();
      await page.locator("[data-free-visit-done]").waitFor({ timeout: 8000 });
      check(`${tag}: Confirm submits once, even on a double tap`, state.freeVisits.length === 1);
      const sent = state.freeVisits[0];
      check(`${tag}: the new form version with the address, date and time`, sent.formVersion === "cx4" && sent.line1 === "12 Elm St" && sent.zip === "11735" && sent.date === day && sent.time === "10:00");
      check(`${tag}: the request carries exactly the consent line it showed`, sent.consent === GUEST_LINE, sent.consent);
      const doneText = await page.locator("[data-free-visit-done]").innerText();
      check(`${tag}: success says reserved and pending - never confirmed`, /reserved/.test(doneText) && /confirm it with you shortly/.test(doneText) && !/is confirmed/i.test(doneText));
      const sentLeads = await leads();
      check(`${tag}: exactly one browser Lead after the accepted retry, lead_type free_visit_request`, sentLeads.length === 1 && sentLeads[0][2]?.lead_type === "free_visit_request", JSON.stringify(sentLeads));
      check(`${tag}: no Schedule and no second Lead for a guest request`, !(await page.evaluate(() => (window.__fbqCalls || []).some((c) => c[0] === "track" && c[1] === "Schedule"))));
      await page.reload({ waitUntil: "networkidle" });
      await page.waitForTimeout(600);
      check(`${tag}: a reload after success sends no Lead`, (await leads()).length === 0);
      for (const step of ["booking_page_view", "booker_started", "slot_selected", "request_submitted"]) check(`${tag}: funnel step ${step} sent`, state.steps.includes(step), state.steps.join(","));
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
      // Everything is already there - job, address, time and the contact typed on the Free Visit - so it goes straight to how to book.
      await page.locator("[data-option='one_time']").waitFor({ timeout: 8000 });
      check(`${tag}: switching skips to how to book with the details shown (no account wall)`, (await booker.getAttribute("data-step")) === "4" && /40 Birch Ln/.test(await booker.innerText()));
      check(`${tag}: nothing was booked as a free visit`, state.freeVisits.length === 0);
      await page.waitForTimeout(400);
      check(`${tag}: reaching how to book holds their time`, state.holds.length === 1 && state.holds[0].requestedDate === day && state.holds[0].requestedTime === "13:00", JSON.stringify(state.holds));
      check(`${tag}: a guest can pay for the One-Time Visit right here`, (await page.locator("[data-option='one_time'][aria-pressed=true]").count()) === 1 && /Continue to payment/.test(await booker.locator("[data-action='book-handyman']").innerText()));
      await booker.locator("[data-summary] button:has-text('Change')").first().click();
      await page.locator(".bk-day[aria-pressed=true]").waitFor({ timeout: 10000 });
      check(`${tag}: the time carried over`, (await page.locator(`[data-day='${day}'][aria-pressed=true]`).count()) === 1 && (await page.locator("[data-time='13:00'][aria-pressed=true]").count()) === 1);
      await booker.locator("button:has-text('Back')").first().click();
      check(`${tag}: the job and address carried over`, (await booker.locator("textarea[name=task]").inputValue()) === "Mount a TV and hang two shelves" && (await booker.locator("input[placeholder='Street address']").inputValue()) === "40 Birch Ln");
      await shot(page, `${tag}-handy-00-from-free-visit`);
      await ctx.close();
    }

    /* =============== Book a Handyman: a guest pays with no account (2026-11-17) =============== */
    {
      const { ctx, page, state, errors } = await open(browser, { width, height });
      await page.goto(`${BASE}/book/handyman`, { waitUntil: "load" });
      const booker = page.locator("[data-handyman-booker]");
      await booker.waitFor({ timeout: 20000 });
      check(`${tag}: the address field says how it works before Continue`, /If suggestions appear, tap yours/.test(await booker.locator("[data-address-hint]").innerText()));
      await booker.locator("[data-shortcut='Replace faucet']").click();
      // A street with no city or ZIP: the message says what is missing, the field is brought into focus, nothing typed is lost.
      await booker.locator("input[placeholder='Street address']").first().fill("9 Pine Ct");
      await booker.locator("[data-action='to-step-2']").click();
      await page.waitForTimeout(400);
      const addrErr = await booker.locator("[data-address-field] .bk-error").innerText().catch(() => "");
      await shot(page, `${tag}-handy-guest-01-address-error`);
      check(`${tag}: a half-typed address says exactly what is missing`, /street, city and a 5-digit ZIP/.test(addrErr), addrErr);
      check(`${tag}: the address error is brought to focus`, await page.evaluate(() => !!document.activeElement?.closest("[data-address-field]")));
      check(`${tag}: the job typed so far is kept`, (await booker.locator("textarea[name=task]").inputValue()) === "Replace an existing faucet.");
      check(`${tag}: still on the job step (no jump)`, (await booker.getAttribute("data-step")) === "1");
      await fillAddress(booker, { line1: "9 Pine Ct", city: "Farmingdale", zip: "11735" });
      await booker.locator("[data-action='to-step-2']").click();
      await page.locator(".bk-day[aria-pressed=true]").waitFor({ timeout: 10000 });
      const day = await page.locator(".bk-day[data-day]").first().getAttribute("data-day");
      await page.locator("[data-time='10:00']").click();
      await booker.locator("[data-action='to-step-3']").click();
      await booker.locator("[data-guest-details]").waitFor({ timeout: 5000 });
      for (const [n, v] of [["name", "Sam Ortiz"], ["phone", "631-555-0144"], ["email", "sam@mailbox.org"]]) {
        await booker.locator(`[data-guest-details] input[name=${n}]`).click();
        await booker.locator(`[data-guest-details] input[name=${n}]`).fill(v);
      }
      await booker.locator("[data-action='guest-continue']").click();
      await page.locator("[data-option='one_time'][aria-pressed=true]").waitFor({ timeout: 5000 });
      await shot(page, `${tag}-handy-guest-04-pay`);
      // The first press is refused (Stripe down): it says so and keeps everything.
      state.guestReplies.push({ status: 503, body: { code: "STRIPE_NOT_CONFIGURED", message: "Secure checkout is temporarily unavailable. Please try again shortly." } });
      await booker.locator("[data-action='book-handyman']").click();
      await page.locator(".bk-banner--warn").waitFor({ timeout: 8000 });
      check(`${tag}: a refused checkout says why and keeps everything`, /temporarily unavailable/.test(await page.locator(".bk-banner--warn").innerText()) && (await booker.getAttribute("data-step")) === "4");
      await booker.locator("[data-action='book-handyman']").dblclick();
      await page.waitForURL(/checkout\.stripe\.test\/cs_guest_1/, { timeout: 10000 });
      check(`${tag}: a double tap opens one guest checkout`, state.guestCheckouts.length === 2, String(state.guestCheckouts.length));
      const g = state.guestCheckouts[1] || {};
      check(`${tag}: the guest checkout carries no sign-in, the contact, address, day, time and hold`, !g.auth && g.name === "Sam Ortiz" && g.phone === "6315550144" && g.email === "sam@mailbox.org" && g.line1 === "9 Pine Ct" && g.zip === "11735" && g.requestedDate === day && g.requestedTime === "10:00" && !!g.holdToken && !!g.clientRequestId, JSON.stringify(g));
      check(`${tag}: it carries exactly the consent line the page showed`, g.consentText === GUEST_CHECKOUT_LINE);
      const names = state.clarity.filter((c) => c[0] === "event").map((c) => c[1]);
      check(`${tag}: Clarity: started, details completed, request submitted - once each`, ["booking_started_handyman", "booking_details_completed_handyman", "booking_request_submitted_handyman"].every((n) => names.filter((x) => x === n).length === 1), names.join(","));
      check(`${tag}: Clarity never receives personal details`, !JSON.stringify(state.clarity).match(/Sam|Ortiz|6315550144|mailbox|Pine|faucet/i), JSON.stringify(state.clarity));
      // Back from Stripe with "cancel": the held time is released with the press's own id.
      await page.goto(`${BASE}/book/handyman?canceled=1&booking_id=g-held-1`, { waitUntil: "load" });
      await booker.waitFor({ timeout: 15000 });
      await page.locator(".bk-banner").first().waitFor({ timeout: 8000 });
      await page.waitForTimeout(400);
      check(`${tag}: canceling on Stripe releases the time with the press's own id`, state.guestAbandons.length === 1 && state.guestAbandons[0].bookingId === "g-held-1" && state.guestAbandons[0].clientRequestId === g.clientRequestId, JSON.stringify(state.guestAbandons));
      check(`${tag}: back from a canceled checkout: told so, everything kept, ready to pay`, /Checkout canceled/.test(await page.locator(".bk-banner").first().innerText()) && (await booker.getAttribute("data-step")) === "4" && /9 Pine Ct/.test(await booker.locator("[data-summary]").innerText()));
      // A press the server says is already paid (Back from the success page): its status, never a second checkout.
      state.guestReplies.push({ status: 200, body: { alreadyPaid: true, bookingId: "g-held-1", sessionId: "cs_test_paidguest1" } });
      state.statusQueue = [{ kind: "one_time", status: "pending_approval", bookingNumber: "55501234", date: day, time: "10:00", guest: true }];
      await booker.locator("[data-action='book-handyman']").click();
      await page.waitForURL(/\/book\/confirmation\?booking_id=g-held-1&session_id=cs_test_paidguest1/, { timeout: 10000 });
      await page.locator("[data-paid-status='pending_approval']").waitFor({ timeout: 10000 });
      check(`${tag}: an already-paid press lands on its status, not a second checkout`, !/checkout\.stripe\.test/.test(page.url()));
      check(`${tag}: guest handyman has no page errors`, errors.length === 0, errors.join(" | "));
      await ctx.close();
    }

    /* ======== After paying: the status page says only what the server has said (2026-11-17) ======== */
    {
      const { ctx, page, state, errors } = await open(browser, { width, height });
      const base = { kind: "one_time", bookingNumber: "55501234", date: ymd(3), time: "10:00", guest: true };
      state.statusQueue = [{ ...base, status: "awaiting_payment" }, { ...base, status: "payment_processing" }, { ...base, status: "pending_approval" }];
      await page.goto(`${BASE}/book/confirmation?booking_id=g1&session_id=cs_test_statusflow1`, { waitUntil: "load" });
      await page.evaluate(() => localStorage.setItem("pf_handyman_draft", JSON.stringify({ task: "Replace an existing faucet.", updatedAt: Date.now() })));
      await page.locator("[data-paid-status]").waitFor({ timeout: 15000 });
      await shot(page, `${tag}-paid-01-confirming`);
      const before = await page.locator("[data-paid-status]").innerText();
      check(`${tag}: before the server records the payment, it says confirming - never received`, /Confirming your payment/.test(before) && !/Payment received/.test(before), before.slice(0, 120));
      await page.locator("[data-paid-status='pending_approval']").waitFor({ timeout: 20000 });
      await shot(page, `${tag}-paid-02-pending-approval-guest`);
      const paid = (await page.locator("[data-paid-status]").innerText()).replace(/\s+/g, " ");
      check(`${tag}: once recorded: paid and pending approval, with visit type, day and time, booking number`, /Payment received\. Your request is pending approval\./.test(paid) && /One-Time Visit/.test(paid) && /10:00 AM/.test(paid) && /#55501234/.test(paid), paid.slice(0, 300));
      check(`${tag}: a guest is offered an account with the same phone or email to manage it`, (await page.locator("[data-action='create-account-after-payment']").count()) === 1 && /same mobile number or email/.test(paid));
      check(`${tag}: no competing ways to book on the success screen`, !/See membership plans|Ways to book/.test(await page.locator("main").innerText()));
      check(`${tag}: the booking draft is cleared once paid, so Back cannot start it again`, (await page.evaluate(() => localStorage.getItem("pf_handyman_draft"))) === null);
      const confirmedEvents = () => state.clarity.filter((c) => c[0] === "event" && c[1] === "booking_payment_confirmed_handyman").length;
      check(`${tag}: Clarity: payment confirmed once`, confirmedEvents() === 1);
      await page.reload({ waitUntil: "load" });
      await page.locator("[data-paid-status='pending_approval']").waitFor({ timeout: 15000 });
      check(`${tag}: a reload of the success page is not a second payment event`, confirmedEvents() === 1);
      state.statusQueue = [{ ...base, kind: "full_day", time: null, status: "not_completed" }];
      await page.goto(`${BASE}/book/confirmation?booking_id=g2&session_id=cs_test_notpaid1`, { waitUntil: "load" });
      await page.locator("[data-paid-status='not_completed']").waitFor({ timeout: 15000 });
      await shot(page, `${tag}-paid-03-not-completed`);
      check(`${tag}: an unpaid checkout says nothing was charged, with the way back to that booking`, /Nothing was charged/.test(await page.locator("[data-paid-status]").innerText()) && (await page.locator("[data-paid-status] a[href='/book?visit=full-day']").count()) === 1);
      state.me = customer({});
      await page.evaluate(() => localStorage.setItem("token", "ui-token"));
      state.statusQueue = [{ ...base, guest: false, status: "confirmed" }];
      await page.goto(`${BASE}/book/confirmation?booking_id=g3&session_id=cs_test_member1`, { waitUntil: "load" });
      await page.locator("[data-paid-status='confirmed']").waitFor({ timeout: 15000 });
      check(`${tag}: signed in: confirmed, managed from My Visits`, /Your visit is confirmed/.test(await page.locator("[data-paid-status]").innerText()) && (await page.locator("[data-paid-status] a[href='/book#your-visits']").count()) === 1);
      check(`${tag}: status page has no page errors`, errors.length === 0, errors.join(" | "));
      await ctx.close();
    }

    /* ====================== Full Day: a guest pays with no account ====================== */
    {
      const { ctx, page, state, errors } = await open(browser, { width, height });
      await page.goto(`${BASE}/book?visit=full-day`, { waitUntil: "load" });
      const panel = page.locator("[data-full-day-panel]");
      await panel.waitFor({ timeout: 20000 });
      check(`${tag}: Full Day: no sign-in wall for a guest`, (await page.getByText("Log in to book your Full Day").count()) === 0 && (await panel.locator("[data-full-day-guest]").count()) === 1);
      await panel.locator(".pg-cal__day.is-open").first().waitFor({ timeout: 15000 });
      await panel.locator(".pg-cal__day.is-open").first().click();
      const chosen = await panel.locator(".pg-cal__day.is-selected").innerText();
      await panel.locator("button:has-text('Continue to payment')").click();
      await page.waitForTimeout(400);
      await shot(page, `${tag}-fullday-01-errors`);
      check(`${tag}: Full Day: each missing detail is named, the day is kept`, (await panel.locator(".pg-error").count()) >= 4 && (await panel.locator(".pg-cal__day.is-selected").innerText()) === chosen);
      for (const [n, v] of [["name", "Ana Ruiz"], ["phone", "516-555-0166"], ["email", "ana@mailbox.org"]]) {
        await panel.locator(`[data-full-day-guest] input[name=${n}]`).click();
        await panel.locator(`[data-full-day-guest] input[name=${n}]`).fill(v);
      }
      await fillAddress(panel, { line1: "5 Maple Rd", city: "Massapequa", zip: "11758" });
      await panel.locator("textarea").first().fill("Hang shelves, fix two doors and patch the hall");
      await shot(page, `${tag}-fullday-02-filled`);
      check(`${tag}: Full Day: the guest consent line is shown`, ((await panel.locator("[data-contact-consent]").innerText()) || "").startsWith(GUEST_CHECKOUT_LINE));
      await panel.locator("button:has-text('Continue to payment')").click();
      await page.waitForURL(/checkout\.stripe\.test\/cs_guest_fd/, { timeout: 10000 });
      const fd = state.guestFullDays[0] || {};
      check(`${tag}: Full Day guest checkout: no sign-in, contact, address, day, list, consent`, state.guestFullDays.length === 1 && !fd.auth && fd.name === "Ana Ruiz" && fd.phone === "5165550166" && fd.zip === "11758" && /^\d{4}-\d{2}-\d{2}$/.test(fd.date) && /Hang shelves/.test(fd.note) && fd.consentText === GUEST_CHECKOUT_LINE, JSON.stringify(fd));
      check(`${tag}: Full Day: Clarity request submitted once`, state.clarity.filter((c) => c[0] === "event" && c[1] === "booking_request_submitted_full_day").length === 1);
      check(`${tag}: Full Day guest has no page errors`, errors.length === 0, errors.join(" | "));
      await ctx.close();
    }

    /* =========== Homepage: after a request, its confirmation stands alone (2026-11-17) =========== */
    {
      const { ctx, page, state, errors } = await open(browser, { width, height });
      await page.goto(`${BASE}/`, { waitUntil: "networkidle" });
      const form = page.locator("[data-home-booking] [data-free-visit-form]");
      await form.waitFor({ timeout: 20000 });
      check(`${tag}: home: ways to book are shown before a request`, await page.locator("[data-ways-to-book]").isVisible());
      for (const [n, v] of [["name", "Kim Lee"], ["phone", "(516) 555-0199"], ["email", "kim@mailbox.org"]]) {
        await form.locator(`input[name=${n}]`).click();
        await form.locator(`input[name=${n}]`).fill(v);
      }
      await fillAddress(form, { line1: "3 Cedar St", city: "Farmingdale", zip: "11735" });
      await page.locator(".bk-day[aria-pressed=true]").waitFor({ timeout: 10000 });
      await form.locator("[data-action='add-details']").click();
      await form.locator("input[type=file]").first().setInputFiles({ name: "door.png", mimeType: "image/png", buffer: Buffer.from("iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==", "base64") }).catch(() => {});
      await page.locator("[data-home-booking] [data-action='review-free-visit']").click();
      const sheet = page.locator("[data-free-visit-sheet]");
      await sheet.waitFor({ timeout: 5000 });
      await page.waitForTimeout(500);
      // The photo cannot be used: a clear way on without it, nothing else lost.
      state.fvReplies.push({ status: 400, body: { code: "PHOTO_REJECTED", field: "photos", message: "That file isn't a photo we can use." } });
      await sheet.locator("[data-action='confirm-free-visit']").click();
      await page.locator("[data-photo-error]").waitFor({ timeout: 8000 });
      await shot(page, `${tag}-home-01-photo-refused`);
      check(`${tag}: home: a refused photo says so, offers to continue without it, keeps the rest`, /isn't a photo we can use/.test(await page.locator("[data-photo-error]").innerText()) && (await form.locator("input[name=name]").inputValue()) === "Kim Lee");
      check(`${tag}: home: no success is shown before the server accepts`, (await page.locator("[data-free-visit-done]").count()) === 0);
      await page.locator("[data-action='send-without-photos']").click();
      await page.locator("[data-home-booking] [data-action='review-free-visit']").click();
      await sheet.waitFor({ timeout: 5000 });
      await page.waitForTimeout(500);
      await sheet.locator("[data-action='confirm-free-visit']").click();
      await page.locator("[data-free-visit-done]").waitFor({ timeout: 8000 });
      await shot(page, `${tag}-home-02-success`);
      const doneText = (await page.locator("[data-free-visit-done]").innerText()).replace(/\s+/g, " ");
      check(`${tag}: home: success states the visit, when, its status and what happens next`, /Free Visit/.test(doneText) && /Reserved - waiting for our confirmation/.test(doneText) && /To change or cancel, call or text/.test(doneText), doneText.slice(0, 300));
      check(`${tag}: home: the other ways to book and the tabs are gone from the success state`, !(await page.locator("[data-ways-to-book]").isVisible()) && !(await page.locator("[data-home-tab='handyman']").isVisible()));
      check(`${tag}: home: Clarity request submitted once for the free visit`, state.clarity.filter((c) => c[0] === "event" && c[1] === "booking_request_submitted_free_visit").length === 1);
      const posts = state.freeVisits.length;
      await page.reload({ waitUntil: "networkidle" });
      await page.locator("[data-free-visit-done]").waitFor({ timeout: 10000 });
      check(`${tag}: home: a refresh shows the same success, sends nothing, keeps the other ways hidden`, state.freeVisits.length === posts && !(await page.locator("[data-ways-to-book]").isVisible()));
      check(`${tag}: home: no page errors`, errors.length === 0, errors.join(" | "));
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
      await booker.locator("[data-guest-details]").waitFor({ timeout: 5000 });
      check(`${tag}: signed out, it asks for contact details - no account wall`, (await booker.locator("[data-guest-details] input[name=name]").count()) === 1 && (await booker.locator("[data-action='create-account']").count()) === 0 && (await booker.locator("[data-guest-details] [data-action='sign-in']").count()) === 1);
      const firstHold = state.holds[0]?.issued;
      check(`${tag}: the chosen time is held at the details step (new hold, no token yet)`, state.holds.length === 1 && state.holds[0].requestedDate === day && state.holds[0].requestedTime === "08:00" && !state.holds[0].token && !!firstHold, JSON.stringify(state.holds));
      // The hold countdown (2026-11-03): "Held for you · 29:58".
      check(`${tag}: the details step says the time is held`, /Held for you · \d+:\d\d/.test(await booker.locator("[data-hold-note]").innerText()));
      check(`${tag}: the hold token is saved with the draft`, (await page.evaluate(() => JSON.parse(localStorage.getItem("pf_handyman_draft") || "{}").holdToken)) === firstHold);
      await shot(page, `${tag}-handy-03-details`);
      await booker.locator("[data-action='guest-continue']").click();
      check(`${tag}: the details step names each missing field`, (await booker.locator("[data-guest-details] .bk-error").count()) === 3);
      for (const [n, v] of [["name", "Sam Ortiz"], ["phone", "631-555-0144"], ["email", "sam@mailbox.org"]]) {
        await booker.locator(`[data-guest-details] input[name=${n}]`).click();
        await booker.locator(`[data-guest-details] input[name=${n}]`).fill(v);
      }
      await booker.locator("[data-action='guest-continue']").click();
      await page.locator("[data-option='one_time']").waitFor({ timeout: 5000 });
      check(`${tag}: guest how-to-book: One-Time chosen, Membership offered, no member option`, (await page.locator("[data-option='one_time'][aria-pressed=true]").count()) === 1 && (await page.locator("[data-option='membership']").count()) === 1 && (await page.locator("[data-option='member']").count()) === 0);
      check(`${tag}: the consent line for a guest payment is shown word for word`, ((await booker.locator("[data-contact-consent]").innerText()) || "").startsWith(GUEST_CHECKOUT_LINE));
      await page.locator("[data-option='membership']").click();
      check(`${tag}: a membership asks for the account at this step, with everything kept`, /Create account and continue/.test(await booker.locator("[data-action='book-handyman']").innerText()) && (await page.locator("[data-membership-needs-account]").count()) === 1);
      await booker.locator("[data-action='book-handyman']").click();
      await page.waitForURL(/\/signup\?next=%2Fbook%2Fhandyman/, { timeout: 10000 });
      check(`${tag}: sends them to Registration 2.0 with a way back`, true);
      check(`${tag}: no guest checkout was opened for a membership`, state.guestCheckouts.length === 0);
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
      check(`${tag}: step 4 shows the hold`, /Held for you · \d+:\d\d/.test(await booker.locator("[data-summary]").innerText()));
      check(`${tag}: One-Time and Membership offered with real prices`, /\$99/.test(await page.locator("[data-option='one_time']").innerText()) && /\$149/.test(await page.locator("[data-option='membership']").innerText()));
      check(`${tag}: no included-visit option for a non-member`, (await page.locator("[data-option='member']").count()) === 0);
      /* 2026-11-03 (sms_service.booking.v2): the optional box above the button, unticked, with its documents. */
      const textsBox = page.locator("[data-service-texts-optin]");
      const textsLine = ((await textsBox.innerText().catch(() => "")) || "").replace(/\s+/g, " ").trim();
      check(`${tag}: the texts box is offered above the button, unticked, word for word`,
        (await textsBox.count()) === 1 && !(await textsBox.locator("input[type=checkbox]").isChecked()) &&
          textsLine === "Text me about my ProFixter visits Optional. Booking confirmations, appointment reminders and arrival updates. Message frequency varies. Message and data rates may apply. Reply STOP to opt out or HELP for help. SMS Terms · Privacy · Terms", textsLine);
      check(`${tag}: the texts box links the SMS Terms, Privacy and Terms in a new tab`,
        (await textsBox.locator("a[href='/communication-consent#service-texts'][target=_blank]").count()) === 1 &&
          (await textsBox.locator("a[href='/privacy'][target=_blank]").count()) === 1 && (await textsBox.locator("a[href='/terms'][target=_blank]").count()) === 1);
      const memberCard = await page.locator("[data-option='membership']").innerText();
      check(`${tag}: membership card sells benefits, not rules`, /Labor included for covered tasks/.test(memberCard) && /Monthly, or annual/.test(memberCard) && !/7\+ days|seven|all year|more than one job/i.test(memberCard), memberCard);
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
      await booker.locator("[data-guest-details]").waitFor({ timeout: 5000 });
      check(`${tag}: another time is held and they go on`, state.holds.length === 2 && state.holds[1].requestedTime === "13:00");
      await booker.locator("[data-guest-details] button:has-text('Back')").click();
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
