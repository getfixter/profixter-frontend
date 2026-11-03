/* eslint-disable @typescript-eslint/no-require-imports -- a plain Node script, like its neighbours */
/*
 * The homepage booking panel (2026-11-03), in the browser against a mocked API.
 *
 *   node scripts/test_home_booking_ui.js [baseUrl] [screenshotDir]
 *
 * The mock answers as test_cx4_ui.js's does (BackEnd routes/freeVisitRequests.js,
 * requests.js, bookings.js, stripe.js). Nothing real is booked, charged or sent.
 *
 * - Phones (360, 390, 430): headline, the Free Visit | Book a Handyman switch
 *   and the real Free Visit form - day strip, times, Request - in the first
 *   screen; one h1; every control at least 44px; no sideways scroll.
 * - Tabs: tap, arrow keys and a sideways swipe switch; typing survives
 *   switching both ways; a swipe on the day strip, the job shortcuts or a field,
 *   or a vertical drag, never switches; Book a Handyman loads only once chosen.
 * - Free Visit on the homepage: taken times greyed, struck through and
 *   disabled; the confirmation sheet covers the whole screen; Call Us, Request a
 *   Callback; Confirm submits once as a guest (formVersion cx4) and the
 *   confirmation shows in the panel; "I Need a Handyman Instead" opens the
 *   other tab on the same details, staying on the homepage.
 * - Book a Handyman on the homepage: describe -> calendar (taken time
 *   disabled) -> Continue holds the time -> sign in / create account go to
 *   /signin|/signup?next=/book/handyman with the draft saved; signed in, the
 *   One-Time Visit and membership checkouts carry returnTo "handyman".
 * - /book/free and /book/handyman still render as standalone pages.
 * - Tablet and desktop: the panel fits, no sideways scroll.
 * - The floating Call button (every customer page): bottom-left, a 44px
 *   target around a small dot, tel: the business line, clear of the chat
 *   button; hidden while typing and on staff pages.
 */
const { chromium } = require("playwright");
const fs = require("fs");

const BASE = process.argv[2] || "http://localhost:3000";
const SHOTS = process.argv[3] || "";
if (SHOTS) fs.mkdirSync(SHOTS, { recursive: true });
const SCHEDULE = ["08:00", "10:00", "13:00", "15:30"];

const results = [];
function check(name, pass, detail = "") {
  results.push(!!pass);
  console.log(`${pass ? "PASS" : "FAIL"}  ${name}${detail ? "  :: " + detail : ""}`);
}

const ADDRESS = { _id: "a1", label: "Primary", line1: "12 Elm St", city: "Farmingdale", state: "NY", zip: "11735", hasActiveSubscription: false, plan: null };
const customer = () => ({ _id: "u1", userId: "40000001", name: "Dana Lopez", email: "dana@mailbox.org", phone: "+15165550123", role: "customer", permissions: [], addresses: [ADDRESS] });
function ymd(offset) {
  const [y, m, d] = new Date().toLocaleDateString("en-CA", { timeZone: "America/New_York" }).split("-").map(Number);
  return new Date(Date.UTC(y, m - 1, d + offset, 12)).toISOString().slice(0, 10);
}

async function open(browser, { width, height, me = null }) {
  const mobile = width < 700;
  const ctx = await browser.newContext({ viewport: { width, height }, isMobile: mobile, hasTouch: mobile });
  await ctx.addInitScript((signedIn) => {
    try {
      if (signedIn) localStorage.setItem("token", "ui-token");
      localStorage.setItem("profixter_promotion_popup_dismissed_date", new Date().toISOString().slice(0, 10));
    } catch {}
  }, Boolean(me));
  const state = { me, freeVisits: [], callbacks: [], oneTime: [], memberships: [], holds: [], configAsks: 0, unexpected: [] };
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
      const days = [];
      for (let i = 0; i < 60; i++) {
        const d = ymd(i);
        if (!d.startsWith(month)) continue;
        const open = i >= 2;
        days.push({ date: d, open: true, available: open, slotCount: open ? 3 : 0, slots: open ? ["08:00", "10:00", "13:00"] : [], candidateSlots: SCHEDULE.map((time) => ({ time, available: open && time !== "15:30" })), taken: {} });
      }
      return json({ month, engine: "reservation", visitDurationMinutes: 90, days });
    }
    if (p === "/api/calendar/slots") {
      const date = u.searchParams.get("date");
      return json({ date, available: true, slots: ["08:00", "10:00", "13:00"], candidateSlots: SCHEDULE.map((time) => ({ time, available: time !== "15:30" })), taken: {}, capacityPerSlot: 2 });
    }
    if (p === "/api/stripe/checkout/welcome-offer") return json({ eligible: false, serverNow: new Date().toISOString(), percentOff: 20 });
    if (p === "/api/service-area/check") return json({ serviceable: true });
    if (p === "/api/free-visit-requests" && m === "POST") {
      const t = text();
      state.freeVisits.push({ formVersion: field(t, "formVersion"), name: field(t, "name"), line1: field(t, "line1"), date: field(t, "requestedDate"), time: field(t, "requestedTime"), sourcePage: field(t, "sourcePage") });
      await new Promise((r) => setTimeout(r, 300));
      return json({ success: true }, 201);
    }
    if (p === "/api/requests/callback" && m === "POST") {
      state.callbacks.push(JSON.parse(req.postData() || "{}"));
      return json({ success: true }, 201);
    }
    if (p === "/api/bookings/hold/release" && m === "POST") return json({ released: true });
    if (p === "/api/bookings/hold" && m === "POST") {
      const body = JSON.parse(req.postData() || "{}");
      state.holds.push(body);
      return json({ held: true, token: `h${state.holds.length}.secretsecretsecretsecretsecret`, holdExpiresAt: new Date(Date.now() + 20 * 60000).toISOString(), minutes: 20 });
    }
    if (p === "/api/bookings/one-time/config") {
      state.configAsks += 1;
      return json({ enabled: true, priceCents: 9900, currency: "usd", durationMinutes: 90, holdMinutes: 30 });
    }
    if (p === "/api/bookings/one-time/checkout" && m === "POST") {
      const t = text();
      state.oneTime.push({ addressId: field(t, "addressId"), returnTo: field(t, "returnTo"), clientRequestId: field(t, "clientRequestId"), requestedTime: field(t, "requestedTime"), holdToken: field(t, "holdToken") });
      return json({ url: "https://checkout.stripe.test/cs_one", bookingId: "b-held-1", entitlementId: "e1", holdExpiresAt: new Date(Date.now() + 1800000).toISOString() });
    }
    if (p === "/api/stripe/checkout/create-checkout-session" && m === "POST") {
      state.memberships.push(JSON.parse(req.postData() || "{}"));
      return json({ url: "https://checkout.stripe.test/cs_member", sessionId: "cs_member" });
    }
    if (p.startsWith("/api/recent-work")) return json({ photos: [], page: 1, limit: 24, total: 0, hasMore: false });
    if (m !== "GET") state.unexpected.push(`${m} ${p}`);
    return json([]);
  });
  const page = await ctx.newPage();
  const errors = [];
  page.on("pageerror", (e) => errors.push(e.message));
  return { ctx, page, state, errors };
}

const shot = async (page, name) => {
  if (SHOTS) await page.screenshot({ path: `${SHOTS}/${name}.png` }).catch(() => {});
};
const noSideScroll = (page) => page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth + 1);
const tabOf = (page) => page.getAttribute("[data-home-booking]", "data-tab");
async function fillAddress(scope, { line1, city, zip }) {
  await scope.locator("input[placeholder='Street address']").first().fill(line1);
  await scope.locator("input[placeholder='City']").first().fill(city);
  await scope.locator("input[placeholder='ZIP']").first().fill(zip);
  await scope.locator("input[placeholder='ZIP']").first().blur();
}
/* A real touch drag, through Chrome's input pipeline (so native scrolling happens too). */
async function swipe(page, from, to, steps = 8) {
  const cdp = await page.context().newCDPSession(page);
  await cdp.send("Input.dispatchTouchEvent", { type: "touchStart", touchPoints: [{ x: from.x, y: from.y }] });
  for (let i = 1; i <= steps; i++) {
    const x = from.x + ((to.x - from.x) * i) / steps;
    const y = from.y + ((to.y - from.y) * i) / steps;
    await cdp.send("Input.dispatchTouchEvent", { type: "touchMove", touchPoints: [{ x, y }] });
    await page.waitForTimeout(16);
  }
  await cdp.send("Input.dispatchTouchEvent", { type: "touchEnd", touchPoints: [] });
  await cdp.detach();
  await page.waitForTimeout(350);
}
/* A tap through the same touch channel as swipe(). */
async function touchTap(page, selector) {
  const box = await page.locator(selector).first().boundingBox().catch(() => null);
  if (!box) return;
  const cdp = await page.context().newCDPSession(page);
  const pt = { x: box.x + box.width / 2, y: box.y + box.height / 2 };
  await cdp.send("Input.dispatchTouchEvent", { type: "touchStart", touchPoints: [pt] });
  await cdp.send("Input.dispatchTouchEvent", { type: "touchEnd", touchPoints: [] });
  await cdp.detach();
  await page.waitForTimeout(60);
}
async function centerOf(page, selector) {
  const box = await page.locator(selector).first().boundingBox();
  return { x: box.x + box.width / 2, y: box.y + box.height / 2, box };
}
async function ready(page) {
  await page.goto(`${BASE}/`, { waitUntil: "networkidle" });
  await page.locator("[data-home-booking]").waitFor({ timeout: 20000 });
  await page.locator("[data-home-booking] .bk-day[aria-pressed=true]").waitFor({ timeout: 15000 });
  await page.waitForTimeout(500);
}

(async () => {
  const browser = await chromium.launch();

  /* ============================== First screen ============================== */
  for (const [w, h] of [[360, 740], [390, 844], [430, 932]]) {
    const { ctx, page, state, errors } = await open(browser, { width: w, height: h });
    await ready(page);
    const m = await page.evaluate(() => {
      const box = (s) => {
        const e = document.querySelector(s);
        return e ? e.getBoundingClientRect() : null;
      };
      const panel = document.querySelector("[data-home-booking]");
      const controls = [...panel.querySelectorAll("input:not([type=file]):not([type=hidden]), button")].filter((e) => e.offsetParent);
      const inView = (r) => r && r.top >= 0 && r.bottom <= innerHeight + 0.5;
      return {
        vh: innerHeight,
        title: inView(box("#hm-title")),
        tabs: inView(box(".hb-tabs")),
        days: inView(box("[data-home-booking] .bk-days")),
        times: inView(box("[data-home-booking] .bk-times")),
        submit: box("[data-action='review-free-visit']")?.bottom,
        photoAfter: box(".hm-hero__media").top >= box("[data-home-booking]").bottom,
        h1: document.querySelectorAll("h1").length,
        smallest: Math.min(...controls.map((e) => e.getBoundingClientRect().height)),
      };
    });
    check(`${w}: headline, switch, days and times in the first screen`, m.title && m.tabs && m.days && m.times, JSON.stringify(m));
    check(`${w}: the Request button in the first screen`, m.submit <= m.vh, `${Math.round(m.submit)} of ${m.vh}`);
    check(`${w}: the photo comes after the panel`, m.photoAfter);
    check(`${w}: Free Visit open first`, (await tabOf(page)) === "free" && (await page.getAttribute("[data-home-tab='free']", "aria-selected")) === "true");
    check(`${w}: one h1 on the page (the forms bring none)`, m.h1 === 1, `h1=${m.h1}`);
    check(`${w}: every control in the panel at least 44px tall`, m.smallest >= 43.5, `smallest ${m.smallest.toFixed(1)}`);
    check(`${w}: no sideways scroll`, await noSideScroll(page));
    check(`${w}: Book a Handyman not loaded until chosen`, state.configAsks === 0 && (await page.locator("[data-handyman-booker]").count()) === 0);
    check(`${w}: no page errors`, errors.length === 0, errors.join(" | "));
    await shot(page, `home-${w}`);
    await ctx.close();
  }

  /* ========================= Tabs, swipes, persistence ======================= */
  {
    const { ctx, page, state, errors } = await open(browser, { width: 390, height: 844 });
    await ready(page);
    const fv = page.locator("[data-home-booking] [data-free-visit-form]");
    await fv.locator("input[name=name]").fill("Lee Walker");
    await fv.locator("input[name=phone]").fill("516-555-0188");
    await page.locator("[data-home-tab='handyman']").tap();
    await page.locator("[data-handyman-booker]").waitFor({ timeout: 10000 });
    check("tap: Book a Handyman opens in place", (await tabOf(page)) === "handyman" && page.url().replace(/\/$/, "") === BASE.replace(/\/$/, "") && !(await fv.isVisible()));
    check("Book a Handyman loads once chosen", state.configAsks === 1);
    await page.locator("[data-shortcut='Fix door']").tap();
    await page.locator("#bk-task").fill("Fix a door that sticks, and hang two shelves");
    await page.locator("[data-home-tab='free']").tap();
    check("tap back: Free Visit kept the name and phone", (await fv.locator("input[name=name]").inputValue()) === "Lee Walker" && (await fv.locator("input[name=phone]").inputValue()) === "516-555-0188");
    await shot(page, "tabs-free-kept");

    // A swipe in the panel's open space (the tab strip) switches tabs.
    const tabs = await centerOf(page, ".hb-tabs");
    await swipe(page, { x: tabs.box.x + tabs.box.width * 0.8, y: tabs.y }, { x: tabs.box.x + tabs.box.width * 0.15, y: tabs.y + 6 });
    check("swipe left: Book a Handyman", (await tabOf(page)) === "handyman");
    check("swipe: the job description survived", (await page.locator("#bk-task").inputValue()) === "Fix a door that sticks, and hang two shelves");
    // A sideways drag on the job shortcuts scrolls them, never the tabs.
    const chips = await centerOf(page, ".bk-chips");
    await swipe(page, { x: chips.box.x + chips.box.width * 0.8, y: chips.y }, { x: chips.box.x + chips.box.width * 0.1, y: chips.y });
    check("swipe on the job shortcuts does not switch tabs", (await tabOf(page)) === "handyman");
    await swipe(page, { x: tabs.box.x + tabs.box.width * 0.15, y: tabs.y }, { x: tabs.box.x + tabs.box.width * 0.85, y: tabs.y });
    check("swipe right: back to Free Visit", (await tabOf(page)) === "free");

    // The day strip scrolls under a sideways drag, and the tab stays.
    const strip = await centerOf(page, "[data-home-booking] .bk-days");
    const before = await page.locator("[data-home-booking] .bk-days").evaluate((e) => e.scrollLeft);
    await swipe(page, { x: strip.box.x + strip.box.width * 0.85, y: strip.y }, { x: strip.box.x + strip.box.width * 0.1, y: strip.y }, 12);
    const after = await page.locator("[data-home-booking] .bk-days").evaluate((e) => e.scrollLeft);
    check("swipe on the day strip scrolls the days, not the tabs", (await tabOf(page)) === "free" && after > before, `scrollLeft ${before} -> ${after}`);
    // A drag that starts in a field never switches.
    const nameBox = await centerOf(page, "[data-home-booking] input[name=email]");
    await swipe(page, { x: nameBox.box.x + nameBox.box.width * 0.9, y: nameBox.y }, { x: nameBox.box.x + 10, y: nameBox.y });
    check("swipe starting in a text field does not switch tabs", (await tabOf(page)) === "free");
    // A mostly vertical drag scrolls the page and leaves the tab alone.
    await swipe(page, { x: tabs.box.x + tabs.box.width * 0.7, y: tabs.y + 300 }, { x: tabs.box.x + tabs.box.width * 0.45, y: tabs.y - 40 });
    check("vertical drag does not switch tabs", (await tabOf(page)) === "free");
    await page.evaluate(() => window.scrollTo(0, 0));

    // Keyboard: arrows move between tabs.
    await page.locator("[data-home-tab='free']").focus();
    await page.keyboard.press("ArrowRight");
    check("ArrowRight selects Book a Handyman and moves focus", (await tabOf(page)) === "handyman" && (await page.evaluate(() => document.activeElement?.getAttribute("data-home-tab"))) === "handyman");
    await page.keyboard.press("ArrowLeft");
    check("ArrowLeft returns to Free Visit", (await tabOf(page)) === "free");
    check("tablist semantics", (await page.locator("[role=tablist] [role=tab]").count()) === 2 && (await page.getAttribute("#hb-tab-free", "aria-controls")) === "hb-pane-free");

    // Keyboard Next inside the embedded form still moves name -> phone without submitting.
    await fv.locator("input[name=name]").focus();
    await page.keyboard.press("Enter");
    check("keyboard Next: name -> phone, nothing submitted", (await page.evaluate(() => document.activeElement?.getAttribute("name"))) === "phone" && (await fv.locator(".bk-error").count()) === 0);
    check("tabs: nothing was sent", state.freeVisits.length === 0 && state.holds.length === 0 && state.unexpected.length === 0, state.unexpected.join(","));
    check("tabs: no page errors", errors.length === 0, errors.join(" | "));
    await ctx.close();
  }

  /* ======================= Free Visit, booked on the homepage ======================= */
  {
    const { ctx, page, state, errors } = await open(browser, { width: 390, height: 844 });
    await ready(page);
    const fv = page.locator("[data-home-booking] [data-free-visit-form]");
    await fv.locator("input[name=name]").fill("Dana Lopez");
    await fv.locator("input[name=phone]").fill("(516) 555-0123");
    await fv.locator("input[name=email]").fill("dana@mailbox.org");
    await fillAddress(fv, { line1: "12 Elm St", city: "Farmingdale", zip: "11735" });
    const taken = fv.locator("[data-time='15:30']");
    check("Free Visit: a taken time is shown, struck through and disabled", (await taken.isDisabled()) && /line-through/.test(await taken.evaluate((e) => getComputedStyle(e).textDecorationLine)) && (await taken.getAttribute("aria-label")) === "3:30 PM, unavailable");
    await fv.locator("[data-time='10:00']").tap();
    check("Free Visit: note and photos folded away", (await fv.locator("textarea[name=note]").count()) === 0 && (await fv.locator("[data-action='add-details']").count()) === 1);
    await page.locator("[data-action='review-free-visit']").tap();
    const sheet = page.locator("[data-free-visit-sheet]");
    await sheet.waitFor({ timeout: 5000 });
    await page.waitForTimeout(450);
    const cover = await page.evaluate(() => {
      const r = document.querySelector(".bk-sheet-backdrop").getBoundingClientRect();
      return { top: r.top, left: r.left, w: r.width, h: r.height, vw: innerWidth, vh: innerHeight };
    });
    check("the confirmation sheet covers the whole screen (not trapped in the panel)", Math.abs(cover.top) < 1 && Math.abs(cover.left) < 1 && cover.w >= cover.vw - 1 && cover.h >= cover.vh - 1, JSON.stringify(cover));
    const onTop = await page.evaluate(() => {
      const sheet = document.querySelector("[data-free-visit-sheet]");
      return [[0.5, 0.15], [0.5, 0.5], [0.5, 0.92]].every(([fx, fy]) => {
        const hit = document.elementFromPoint(innerWidth * fx, innerHeight * fy);
        return hit && (hit.closest(".bk-sheet-backdrop") || sheet.contains(hit));
      });
    });
    check("the sheet is on top of everything (nothing on the page paints over it)", onTop);
    check("sheet: labor not included, Call Us dials", /Repairs and labor\s+aren.t included/i.test(await sheet.innerText()) && (await sheet.locator("[data-action='call-us']").getAttribute("href")) === "tel:+16315991363");
    await shot(page, "free-sheet");
    await sheet.locator("[data-action='request-callback']").tap();
    await sheet.locator("[data-callback-sent]").waitFor({ timeout: 5000 });
    check("Request a Callback: one lead with what was typed", state.callbacks.length === 1 && state.callbacks[0].phone === "5165550123" && state.callbacks[0].sourcePage === "/");
    // A swipe on the open sheet is the sheet's, not the tabs'; a tap after it still works.
    await swipe(page, { x: 330, y: cover.vh - 120 }, { x: 40, y: cover.vh - 116 });
    check("swipe on the sheet does not switch tabs", (await tabOf(page)) === "free" && (await sheet.isVisible()));
    await touchTap(page, "[data-action='confirm-free-visit']");
    await touchTap(page, "[data-action='confirm-free-visit']");
    await page.locator("[data-home-booking] [data-free-visit-done]").waitFor({ timeout: 8000 });
    const sent = state.freeVisits[0] || {};
    check("Confirm: submitted once (double tap) as a guest, formVersion cx4, from the homepage", state.freeVisits.length === 1 && sent.formVersion === "cx4" && sent.line1 === "12 Elm St" && sent.time === "10:00" && sent.sourcePage === "/", JSON.stringify(sent));
    const done = page.locator("[data-home-booking] [data-free-visit-done]");
    check("the confirmation shows in the panel, as an h2, pending", (await done.locator("h2").count()) === 1 && /reserved/.test(await done.innerText()) && (await page.locator("h1").count()) === 1);
    check("Free Visit: no page errors", errors.length === 0, errors.join(" | "));
    await shot(page, "free-done");
    await ctx.close();
  }

  /* ===================== I Need a Handyman Instead, in place ===================== */
  {
    const { ctx, page, state } = await open(browser, { width: 390, height: 844 });
    await ready(page);
    const fv = page.locator("[data-home-booking] [data-free-visit-form]");
    await fv.locator("input[name=name]").fill("Sam Reyes");
    await fv.locator("input[name=phone]").fill("516-555-0177");
    await fv.locator("input[name=email]").fill("sam@mailbox.org");
    await fillAddress(fv, { line1: "8 Oak Ct", city: "Farmingdale", zip: "11735" });
    await fv.locator("[data-action='add-details']").tap();
    await fv.locator("textarea[name=note]").fill("Replace a light fixture in the hall");
    await page.locator("[data-action='review-free-visit']").tap();
    await page.locator("[data-action='need-handyman']").tap();
    await page.locator("[data-home-booking] [data-handyman-booker]").waitFor({ timeout: 10000 });
    await page.waitForTimeout(800);
    const booker = page.locator("[data-home-booking] [data-handyman-booker]");
    check("Need a Handyman: the other tab opens on the homepage", (await tabOf(page)) === "handyman" && new URL(page.url()).pathname === "/" && (await page.locator("[data-free-visit-sheet]").count()) === 0);
    check("Need a Handyman: the details came with them", /details came with you/i.test(await booker.innerText()) && state.freeVisits.length === 0);
    check("Need a Handyman: the reviewed time is held, ready to sign in", (await booker.getAttribute("data-step")) === "3" && state.holds.length === 1, `step ${await booker.getAttribute("data-step")}, holds ${state.holds.length}`);
    await shot(page, "need-handyman");
    await ctx.close();
  }

  /* ===================== Book a Handyman on the homepage (guest) ===================== */
  {
    const { ctx, page, state, errors } = await open(browser, { width: 390, height: 844 });
    await ready(page);
    await page.locator("[data-home-tab='handyman']").tap();
    const booker = page.locator("[data-home-booking] [data-handyman-booker]");
    await booker.waitFor({ timeout: 10000 });
    await shot(page, "handyman-1");
    await page.locator("[data-shortcut='Replace faucet']").tap();
    await fillAddress(booker, { line1: "21 Pine Rd", city: "Farmingdale", zip: "11735" });
    await page.locator("[data-action='to-step-2']").tap();
    await booker.locator(".bk-day[aria-pressed=true]").waitFor({ timeout: 10000 });
    await page.waitForTimeout(400);
    const taken = booker.locator("[data-time='15:30']");
    check("Handyman: step 2 shows the calendar with the taken time disabled", (await booker.getAttribute("data-step")) === "2" && (await taken.isDisabled()) && /line-through/.test(await taken.evaluate((e) => getComputedStyle(e).textDecorationLine)));
    check("Handyman: nothing held before Continue", state.holds.length === 0);
    const top = await booker.evaluate((e) => e.getBoundingClientRect().top);
    check("Handyman: step 2 starts in view", top >= 0 && top < 844, `top ${Math.round(top)}`);
    await shot(page, "handyman-2");
    await booker.locator("[data-time='13:00']").tap();
    await page.locator("[data-action='to-step-3']").tap();
    await booker.locator("[data-auth-step]").waitFor({ timeout: 5000 });
    check("Continue holds the time (20 minutes)", state.holds.length === 1 && state.holds[0].requestedTime === "13:00" && /holding this time/i.test(await booker.innerText()));
    await shot(page, "handyman-3");
    await page.locator("[data-action='create-account']").tap();
    await page.waitForURL(/\/signup\?/, { timeout: 10000 });
    const url = new URL(page.url());
    const draft = await page.evaluate(() => Object.entries(localStorage).concat(Object.entries(sessionStorage)).find(([k]) => /handyman/i.test(k))?.[1] || "");
    check("Create account: Registration 2.0 with next=/book/handyman", url.pathname === "/signup" && url.searchParams.get("next") === "/book/handyman" && url.searchParams.get("intent") === "handyman");
    check("the draft (job, address, held time) is saved for the trip", /Replace an existing faucet/.test(draft) && /21 Pine Rd/.test(draft) && /13:00/.test(draft));
    check("Handyman guest: no page errors", errors.length === 0, errors.join(" | "));
    await ctx.close();
  }

  /* =================== Book a Handyman on the homepage (signed in) =================== */
  for (const option of ["one_time", "membership"]) {
    const { ctx, page, state, errors } = await open(browser, { width: 390, height: 844, me: customer() });
    await page.goto(`${BASE}/`, { waitUntil: "networkidle" });
    await page.locator("[data-home-booking]").waitFor({ timeout: 20000 });
    check(`signed in (${option}): Free Visit knows who they are`, (await page.locator("[data-home-booking] input[name=name]").inputValue()) === "Dana Lopez");
    await page.locator("[data-home-tab='handyman']").tap();
    const booker = page.locator("[data-home-booking] [data-handyman-booker]");
    await booker.waitFor({ timeout: 10000 });
    await page.locator("[data-shortcut='Patch drywall']").tap();
    check(`signed in (${option}): their saved home is offered`, (await booker.locator("[data-input=home]").inputValue()) === "a1");
    await page.locator("[data-action='to-step-2']").tap();
    await booker.locator(".bk-day[aria-pressed=true]").waitFor({ timeout: 10000 });
    await page.waitForTimeout(400);
    await page.locator("[data-action='to-step-3']").tap();
    await booker.locator(`[data-option='${option}']`).waitFor({ timeout: 8000 });
    check(`signed in (${option}): straight to how to book, time held`, (await booker.getAttribute("data-step")) === "4" && state.holds.length === 1);
    await booker.locator(`[data-option='${option}']`).tap();
    await shot(page, `handyman-4-${option}`);
    await page.locator("[data-action='book-handyman']").tap();
    await page.waitForURL(/checkout\.stripe\.test/, { timeout: 10000 });
    if (option === "one_time") {
      const sent = state.oneTime[0] || {};
      check("One-Time Visit: checkout returns to /book/handyman, one request id, the hold", state.oneTime.length === 1 && sent.returnTo === "handyman" && sent.addressId === "a1" && !!sent.clientRequestId && /^h1\./.test(sent.holdToken || ""), JSON.stringify(sent));
    } else {
      const sent = state.memberships[0] || {};
      check("Membership: checkout returns to /book/handyman, monthly", state.memberships.length === 1 && sent.returnTo === "handyman" && sent.billingCycle === "monthly" && sent.addressId === "a1", JSON.stringify(sent));
    }
    check(`signed in (${option}): no page errors`, errors.length === 0, errors.join(" | "));
    await ctx.close();
  }

  /* ============================ Standalone pages ============================ */
  for (const [path, sel] of [["/book/free", "[data-free-visit-form]"], ["/book/handyman", "[data-handyman-booker]"]]) {
    const { ctx, page, errors } = await open(browser, { width: 390, height: 844 });
    await page.goto(`${BASE}${path}`, { waitUntil: "networkidle" });
    await page.locator(sel).waitFor({ timeout: 20000 });
    check(`${path}: still its own page, with its own h1 and full layout`, (await page.locator("h1").count()) === 1 && (await page.locator(`${sel}.bk--embedded`).count()) === 0 && (await page.locator("[data-home-booking]").count()) === 0);
    check(`${path}: no page errors`, errors.length === 0, errors.join(" | "));
    await ctx.close();
  }

  /* ============================ Tablet and desktop ============================ */
  for (const [w, h] of [[768, 1024], [1024, 768], [1440, 900], [1920, 1080], [2560, 1440]]) {
    const { ctx, page, errors } = await open(browser, { width: w, height: h });
    await ready(page);
    const m = await page.evaluate(() => {
      const r = document.querySelector("[data-home-booking]").getBoundingClientRect();
      const s = document.querySelector("[data-action='review-free-visit']").getBoundingClientRect();
      return { left: r.left, right: r.right, vw: innerWidth, vh: innerHeight, tabsTop: document.querySelector(".hb-tabs").getBoundingClientRect().top, submit: s.bottom };
    });
    check(`${w}x${h}: panel inside the page, tabs in the first screen`, m.left >= 0 && m.right <= m.vw && m.tabsTop < m.vh, JSON.stringify(m));
    if (w >= 1440) check(`${w}x${h}: the Request button in the first screen`, m.submit <= m.vh, `${Math.round(m.submit)} of ${m.vh}`);
    check(`${w}x${h}: no sideways scroll`, await noSideScroll(page));
    check(`${w}x${h}: no page errors`, errors.length === 0, errors.join(" | "));
    await shot(page, `desk-${w}`);
    await ctx.close();
  }

  /* ======================== The floating Call button ======================== */
  for (const [w, h, label] of [[360, 740, "Android"], [390, 844, "iPhone"], [820, 1180, "tablet"], [1440, 900, "desktop"]]) {
    for (const path of ["/", "/book/free", "/book/handyman", "/membership/plans", "/signup"]) {
      const { ctx, page, errors } = await open(browser, { width: w, height: h });
      await page.goto(`${BASE}${path}`, { waitUntil: "networkidle" });
      await page.waitForTimeout(500);
      const m = await page.evaluate(() => {
        const a = document.querySelector("[data-call-button]");
        if (!a) return null;
        const r = a.getBoundingClientRect();
        const dot = a.querySelector(".pf-call__dot").getBoundingClientRect();
        const chat = document.querySelector("[data-support-chat] button");
        const c = chat ? chat.getBoundingClientRect() : null;
        return { href: a.getAttribute("href"), w: r.width, h: r.height, left: r.left, bottom: innerHeight - r.bottom, vw: innerWidth, dotW: dot.width, overlapsChat: c ? !(r.right <= c.left || c.right <= r.left || r.bottom <= c.top || c.bottom <= r.top) : false, position: getComputedStyle(a).position };
      });
      const ok = m && m.href === "tel:+16315991363" && m.position === "fixed" && m.w >= 43.5 && m.h >= 43.5 && m.left < 30 && m.bottom >= 0 && m.bottom < 140 && !m.overlapsChat && m.dotW <= (w >= 1024 ? 120 : 44);
      check(`call (${label} ${path}): small, bottom-left, 44px target, dials the business line, clear of the chat`, ok, JSON.stringify(m));
      // It never sits, visible, over something to tap - at the top of the page or scrolled through it.
      const covers = [];
      for (const y of [0, 300, 700, 1200]) {
        await page.evaluate((top) => window.scrollTo({ top, behavior: "instant" }), y);
        await page.waitForTimeout(250);
        const c = await page.evaluate(() => {
          const a = document.querySelector("[data-call-button]");
          if (!a || getComputedStyle(a).visibility === "hidden") return "";
          const d = a.firstElementChild.getBoundingClientRect();
          const sel = "a[href], button, input, select, textarea, label, summary, [role='button'], [role='tab']";
          const hit = [[d.left + d.width / 2, d.top + d.height / 2], [d.left + 2, d.top + 2], [d.right - 2, d.bottom - 2]]
            .flatMap(([x, y]) => document.elementsFromPoint(x, y))
            .find((e) => !a.contains(e) && e.closest(sel) && !e.closest("[data-support-chat]"));
          return hit ? (hit.closest(sel).textContent || hit.tagName).trim().slice(0, 40) : "";
        });
        if (c) covers.push(`${y}: ${c}`);
      }
      check(`call (${label} ${path}): never visible over a button, link or field`, covers.length === 0, covers.join(" | "));
      await page.evaluate(() => window.scrollTo(0, 0));
      await page.waitForTimeout(250);
      if (path === "/") await shot(page, `call-${label}`);
      check(`call (${label} ${path}): no page errors`, errors.length === 0, errors.join(" | "));
      await ctx.close();
    }
  }
  {
    const { ctx, page } = await open(browser, { width: 390, height: 844 });
    await ready(page);
    await page.locator("[data-home-booking] input[name=email]").focus();
    check("call: steps aside while a field is being typed in", !(await page.locator("[data-call-button]").isVisible()));
    await page.locator("[data-home-booking] input[name=email]").blur();
    await page.waitForTimeout(50);
    check("call: comes back when typing ends", await page.locator("[data-call-button]").isVisible());
    // /event is the staff surface anyone can open (signed out, /admin sends you to the customer sign-in page).
    await page.goto(`${BASE}/event`, { waitUntil: "networkidle" });
    await page.waitForTimeout(500);
    check("call: not on staff pages (the event kiosk)", new URL(page.url()).pathname === "/event" && (await page.locator("[data-call-button]").count()) === 0, page.url());
    await ctx.close();
  }

  await browser.close();
  const passed = results.filter(Boolean).length;
  console.log(`\n${passed}/${results.length} passed`);
  process.exit(passed === results.length ? 0 : 1);
})().catch((e) => {
  console.error(e);
  process.exit(1);
});
