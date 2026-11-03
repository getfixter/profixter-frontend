/* eslint-disable @typescript-eslint/no-require-imports -- a plain Node script, like its neighbours */
/*
 * Book first, then buy the membership (2026-11-03), in the browser against a
 * mocked API. Nothing real is booked, charged or texted.
 *
 *   node scripts/test_membership_first_visit_ui.js [baseUrl] [screenshotDir]
 *
 * The mock answers as BackEnd routes/bookings.js (hold), routes/stripe.js
 * (create-checkout-session with firstVisit) and routes/auth.js (/me with
 * address.firstVisitExempt and user.phoneRequired) do; the server side is
 * pinned by BackEnd scripts/test_membership_first_visit.js.
 *
 * - A plan button for a non-member lands on Book a Handyman with that plan and
 *   cycle chosen; job -> time -> Continue holds it (30 min) -> plans (annual
 *   prices, the switch) with a countdown -> checkout asks for the plan, the
 *   cycle and the held visit (firstVisit), and keeps a renewed hold token.
 * - /book?visit=membership for a non-member is the same booking flow.
 * - The visit (job, home, photos, time, hold) is saved on the server before
 *   Stripe (POST /api/bookings/first-visit-draft) and the checkout names it.
 * - Back from Stripe the page only shows what the server booked (the Stripe
 *   webhook books it, BackEnd utils/membershipFirstVisitFulfillment.js): it
 *   never posts a booking itself; a slow webhook gets one "finish it" request;
 *   a time the server could not keep sends them to pick another, explained;
 *   a payment still being confirmed says so and that they need not wait.
 * - An older checkout with no saved draft still books on return (old tabs).
 * - A taken time at checkout sends them back to pick another, details kept.
 * - A new account without a verified phone gets "Add your mobile number",
 *   which cannot be dismissed; verifying it lets them carry on. It asks for no
 *   text consent (service texts stay an optional box at booking).
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
function ymd(offset) {
  const [y, m, d] = new Date().toLocaleDateString("en-CA", { timeZone: "America/New_York" }).split("-").map(Number);
  return new Date(Date.UTC(y, m - 1, d + offset, 12)).toISOString().slice(0, 10);
}
const ADDRESS = { _id: "a1", label: "Primary", line1: "12 Elm St", city: "Farmingdale", state: "NY", zip: "11735", hasActiveSubscription: false, plan: null };
const customer = (over = {}) => ({ _id: "u1", userId: "40000001", name: "Dana Lopez", email: "dana@mailbox.org", phone: "+15165550123", phoneVerified: true, role: "customer", permissions: [], addresses: [ADDRESS], ...over });

async function open(browser, { width = 390, height = 844, me = null, draft = null, checkout = null, serverDraft = null } = {}) {
  const mobile = width < 700;
  const ctx = await browser.newContext({ viewport: { width, height }, isMobile: mobile, hasTouch: mobile });
  await ctx.addInitScript(
    ({ signedIn, draftJson }) => {
      try {
        if (signedIn) localStorage.setItem("token", "ui-token");
        localStorage.setItem("profixter_promotion_popup_dismissed_date", new Date().toISOString().slice(0, 10));
        if (draftJson && !sessionStorage.getItem("__seeded")) {
          localStorage.setItem("pf_handyman_draft", draftJson);
          sessionStorage.setItem("__seeded", "1");
        }
      } catch {}
    },
    { signedIn: Boolean(me), draftJson: draft ? JSON.stringify(draft) : "" }
  );
  const state = { me, holds: [], checkouts: [], bookings: [], drafts: [], draftViews: 0, draftFinishes: 0, otpStarts: [], otpVerifies: [], unexpected: [] };
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
      const lead = u.searchParams.get("visit") === "membership" ? 7 : 2;
      const days = [];
      for (let i = 0; i < 60; i++) {
        const d = ymd(i);
        if (!d.startsWith(month)) continue;
        const open = i >= lead;
        days.push({ date: d, open: true, available: open, slotCount: open ? 3 : 0, slots: open ? ["08:00", "10:00", "13:00"] : [], candidateSlots: SCHEDULE.map((time) => ({ time, available: open && time !== "15:30" })), taken: {} });
      }
      return json({ month, engine: "reservation", visitDurationMinutes: 90, days });
    }
    if (p === "/api/calendar/slots") {
      const date = u.searchParams.get("date");
      const open = !(u.searchParams.get("visit") === "membership" && date < ymd(7));
      return json({ date, available: open, slots: open ? ["08:00", "10:00", "13:00"] : [], candidateSlots: SCHEDULE.map((time) => ({ time, available: open && time !== "15:30" })), taken: {}, capacityPerSlot: 1 });
    }
    if (p === "/api/stripe/checkout/welcome-offer") return json({ eligible: false, serverNow: new Date().toISOString(), percentOff: 20 });
    if (p === "/api/service-area/check") return json({ serviceable: true });
    if (p === "/api/bookings/hold/release" && m === "POST") return json({ released: true });
    if (p === "/api/bookings/hold" && m === "POST") {
      const body = JSON.parse(req.postData() || "{}");
      state.holds.push(body);
      return json({ held: true, token: body.token || `h${state.holds.length}.secretsecretsecretsecretsecret`, holdExpiresAt: new Date(Date.now() + 30 * 60000).toISOString(), minutes: 30 });
    }
    if (p === "/api/bookings/one-time/config") return json({ enabled: true, priceCents: 9900, currency: "usd", durationMinutes: 90, holdMinutes: 30 });
    if (p === "/api/stripe/checkout/create-checkout-session" && m === "POST") {
      const body = JSON.parse(req.postData() || "{}");
      state.checkouts.push(body);
      if (checkout?.refuse) return json({ code: "SLOT_UNAVAILABLE", message: "That time was just taken. Pick another - everything else is saved." }, 409);
      return json({ url: "https://checkout.stripe.test/cs_member", sessionId: "cs_member", holdToken: "h9.renewedrenewedrenewedrenewed", holdExpiresAt: new Date(Date.now() + 41 * 60000).toISOString(), firstVisitExempt: true });
    }
    if (p === "/api/bookings/first-visit-draft" && m === "POST") {
      const t = text();
      state.drafts.push({ addressId: field(t, "addressId"), note: field(t, "note"), requestedDate: field(t, "requestedDate"), requestedTime: field(t, "requestedTime"), holdToken: field(t, "holdToken"), photos: (t.match(/name="images"; filename=/g) || []).length });
      return json({ draftId: "d0000000000000000000001" }, 201);
    }
    if (p.startsWith("/api/bookings/first-visit-draft/") && m === "GET") {
      state.draftViews += 1;
      return json(serverDraft ? serverDraft(state) : { status: "booked", requestedDate: ymd(3), requestedTime: "10:00", booking: { bookingNumber: "55554444" } });
    }
    if (p.startsWith("/api/bookings/first-visit-draft/") && p.endsWith("/fulfill") && m === "POST") {
      state.draftFinishes += 1;
      return json(serverDraft ? serverDraft(state) : { status: "booked", requestedDate: ymd(3), requestedTime: "10:00", booking: { bookingNumber: "55554444" } });
    }
    if (p === "/api/bookings" && m === "POST") {
      const t = text();
      state.bookings.push({ addressId: field(t, "addressId"), requestedDate: field(t, "requestedDate"), requestedTime: field(t, "requestedTime"), holdToken: field(t, "holdToken") });
      return json({ message: "Booking created", booking: { bookingNumber: "12345678", status: "Pending" } });
    }
    if (p === "/api/auth/otp/phone/start" && m === "POST") {
      state.otpStarts.push(JSON.parse(req.postData() || "{}"));
      return json({ status: "sent", phoneMasked: "(•••) •••-0188", resendAfterSeconds: 30 });
    }
    if (p === "/api/auth/otp/phone/verify" && m === "POST") {
      const body = JSON.parse(req.postData() || "{}");
      state.otpVerifies.push(body);
      state.me = { ...state.me, phone: "+15165550188", phoneVerified: true, phoneRequired: false };
      return json({ status: "attached", user: state.me });
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

(async () => {
  const browser = await chromium.launch();

  /* ===================== A plan button -> book first -> plans -> checkout ===================== */
  for (const [w, h] of [[390, 844], [1440, 900]]) {
    const tag = w < 700 ? "mobile" : "desktop";
    const { ctx, page, state, errors } = await open(browser, { width: w, height: h, me: customer() });
    await page.goto(`${BASE}/membership/plans`, { waitUntil: "networkidle" });
    await page.waitForSelector(".plan-box", { timeout: 20000 });
    await page.click("#plan-tab-Plus");
    await page.waitForTimeout(500);
    await page.click('.plan-box__cycle:has-text("Annual")');
    await page.waitForTimeout(500);
    await page.click(".plan-box__cta");
    await page.waitForURL(/\/book\/handyman/, { timeout: 20000 });
    const url = new URL(page.url());
    check(`${tag}: a plan button opens the booking flow first, with the plan and cycle`, url.searchParams.get("membership") === "plus" && url.searchParams.get("cycle") === "annual", page.url());
    const booker = page.locator("[data-handyman-booker]");
    await booker.waitFor({ timeout: 15000 });
    check(`${tag}: step 1 is the job`, (await booker.getAttribute("data-step")) === "1" && (await page.locator("#bk-task").count()) === 1);
    await page.locator("[data-shortcut='Replace faucet']").click();
    check(`${tag}: their saved home is offered`, (await booker.locator("[data-input=home]").inputValue()) === "a1");
    await page.locator("[data-action='to-step-2']").click();
    await booker.locator(".bk-day[aria-pressed=true]").waitFor({ timeout: 10000 });
    await page.waitForTimeout(400);
    const firstDay = await booker.locator(".bk-day[aria-pressed=true]").getAttribute("data-day");
    check(`${tag}: a non-member sees the non-member calendar (2 days out, not 7)`, firstDay === ymd(2), firstDay);
    const taken = booker.locator("[data-time='15:30']");
    check(`${tag}: taken times shown disabled and struck through`, (await taken.isDisabled()) && /line-through/.test(await taken.evaluate((e) => getComputedStyle(e).textDecorationLine)));
    await shot(page, `${tag}-1-calendar`);
    await page.locator("[data-action='to-step-3']").click();
    await booker.locator("[data-option='membership']").waitFor({ timeout: 8000 });
    check(`${tag}: Continue held the time`, state.holds.length === 1 && state.holds[0].requestedDate === ymd(2));
    check(`${tag}: the membership is chosen, Plus, annual`, (await booker.locator("[data-option='membership']").getAttribute("aria-pressed")) === "true" && (await booker.locator("[data-plan='plus']").getAttribute("aria-checked")) === "true" && (await booker.locator("[data-cycle='annual']").getAttribute("aria-checked")) === "true");
    check(`${tag}: annual prices (pay for 10 months)`, /\$2,490/.test(await booker.locator("[data-plan='plus']").innerText()), await booker.locator("[data-plan='plus']").innerText());
    const left = Number(await booker.locator("[data-hold-note]").getAttribute("data-hold-left"));
    check(`${tag}: a compact countdown shows the hold`, left > 1700 && left <= 1800 && /Held for you/.test(await booker.locator("[data-hold-note]").innerText()), `${left}`);
    await page.locator("[data-cycle='monthly']").click();
    check(`${tag}: switching to monthly shows monthly prices`, /\$249\/mo/.test(await booker.locator("[data-plan='plus']").innerText()));
    await page.locator("[data-cycle='annual']").click();
    await shot(page, `${tag}-2-plans`);
    await page.locator("[data-action='book-handyman']").click();
    await page.waitForURL(/checkout\.stripe\.test/, { timeout: 10000 });
    const body = state.checkouts[0] || {};
    const saved0 = state.drafts[0] || {};
    check(`${tag}: the visit is saved on the server first (job, home, time, hold)`, state.drafts.length === 1 && saved0.addressId === "a1" && /faucet/i.test(saved0.note || "") && saved0.requestedDate === ymd(2) && /^h1\./.test(saved0.holdToken || ""), JSON.stringify(saved0));
    check(`${tag}: checkout asks for the plan, the cycle and the saved, held visit`, body.plan === "plus" && body.billingCycle === "annual" && body.returnTo === "handyman" && body.firstVisit && body.firstVisit.draftId === "d0000000000000000000001" && body.firstVisit.requestedDate === ymd(2) && /^h1\./.test(body.firstVisit.holdToken || ""), JSON.stringify(body));
    // Read back on the site's own origin (the page is now at the Stripe test origin).
    await page.goto(`${BASE}/terms`, { waitUntil: "domcontentloaded" });
    const saved = await page.evaluate(() => JSON.parse(localStorage.getItem("pf_handyman_draft") || "{}"));
    check(`${tag}: the renewed hold token is kept for the way back`, saved.holdToken === "h9.renewedrenewedrenewedrenewed" && saved.cycle === "annual" && saved.choice === "membership", JSON.stringify({ t: saved.holdToken, c: saved.cycle }));
    check(`${tag}: no page errors`, errors.length === 0, errors.join(" | "));
    await ctx.close();
  }

  /* ===================== /book?visit=membership is the same flow ===================== */
  {
    const { ctx, page, errors } = await open(browser, { me: customer() });
    await page.goto(`${BASE}/book?visit=membership`, { waitUntil: "networkidle" });
    const booker = page.locator("[data-membership-booker] [data-handyman-booker]");
    await booker.waitFor({ timeout: 20000 });
    check("/book?visit=membership: a non-member gets the booking flow, not a checkout", (await booker.getAttribute("data-step")) === "1" && (await page.locator(".plan-box__cta").count()) === 0);
    check("/book?visit=membership: one h1", (await page.locator("h1").count()) === 1);
    check("/book?visit=membership: no page errors", errors.length === 0, errors.join(" | "));
    await shot(page, "book-membership-tab");
    await ctx.close();
  }

  /* ===================== A taken time at checkout: pick another, details kept ===================== */
  {
    const draft = { task: "Replace an existing faucet.", addressId: "a1", address: null, date: ymd(2), time: "10:00", name: "", phone: "", email: "", photoCount: 0, clientRequestId: "", choice: "membership", plan: "basic", cycle: "monthly", pendingBookingId: "", holdToken: "h1.secretsecretsecretsecretsecret", holdFor: `${ymd(2)} 10:00`, holdExpiresAt: new Date(Date.now() + 20 * 60000).toISOString(), timeConfirmed: true, updatedAt: Date.now() };
    const { ctx, page, state } = await open(browser, { me: customer(), draft, checkout: { refuse: true } });
    await page.goto(`${BASE}/book/handyman`, { waitUntil: "networkidle" });
    const booker = page.locator("[data-handyman-booker]");
    await booker.locator("[data-option='membership']").waitFor({ timeout: 15000 });
    await page.locator("[data-action='book-handyman']").click();
    await page.waitForTimeout(1200);
    check("taken at checkout: back to the calendar, with a plain reason", (await booker.getAttribute("data-step")) === "2" && /just taken/i.test(await booker.innerText()), await booker.getAttribute("data-step"));
    check("taken at checkout: the job is kept", /Replace an existing faucet/.test(await page.evaluate(() => localStorage.getItem("pf_handyman_draft") || "")));
    check("taken at checkout: nothing opened at Stripe", !/stripe/.test(page.url()) && state.checkouts.length === 1);
    await ctx.close();
  }

  /* ===================== Back from Stripe: the page shows what the server booked ===================== */
  const returning = (over = {}) => ({ task: "Replace an existing faucet.", addressId: "a1", address: null, date: ymd(3), time: "10:00", name: "", phone: "", email: "", photoCount: 0, clientRequestId: "fv-1", choice: "membership", plan: "plus", cycle: "annual", pendingBookingId: "", holdToken: "h9.renewedrenewedrenewedrenewed", holdFor: `${ymd(3)} 10:00`, holdExpiresAt: new Date(Date.now() + 30 * 60000).toISOString(), timeConfirmed: true, firstVisitDraftId: "d0000000000000000000001", updatedAt: Date.now(), ...over });
  const activeMember = customer({ addresses: [{ ...ADDRESS, hasActiveSubscription: true, plan: "plus", firstVisitExempt: false }] });
  {
    const { ctx, page, state, errors } = await open(browser, { me: activeMember, draft: returning() });
    await page.goto(`${BASE}/book/handyman?resume=membership`, { waitUntil: "networkidle" });
    await page.locator("[data-handyman-done]").waitFor({ timeout: 15000 });
    check("back from Stripe: the server's booking is shown", /review it and confirm/i.test(await page.locator("[data-handyman-done]").innerText()) && state.draftViews >= 1);
    check("back from Stripe: the page books nothing itself", state.bookings.length === 0, JSON.stringify(state.bookings));
    check("back from Stripe: the draft is cleared once shown", (await page.evaluate(() => localStorage.getItem("pf_handyman_draft"))) === null);
    check("back from Stripe: no page errors", errors.length === 0, errors.join(" | "));
    await shot(page, "back-from-stripe");
    await ctx.close();
  }
  {
    // The webhook is late: after a short wait the page asks the server once to finish it.
    let calls = 0;
    const serverDraft = (state) => (state.draftFinishes ? { status: "booked", requestedDate: ymd(3), requestedTime: "10:00", booking: { bookingNumber: "55554444" } } : (calls++, { status: "checkout_open", requestedDate: ymd(3), requestedTime: "10:00" }));
    const { ctx, page, state } = await open(browser, { me: activeMember, draft: returning(), serverDraft });
    await page.goto(`${BASE}/book/handyman?resume=membership`, { waitUntil: "networkidle" });
    await page.locator("[data-handyman-done]").waitFor({ timeout: 30000 });
    check("slow webhook: the page asks the server to finish it (once), then shows the booking", state.draftFinishes === 1 && state.bookings.length === 0 && calls >= 1, `${state.draftFinishes} ${calls}`);
    await ctx.close();
  }
  {
    // The server could not keep the time (taken before the payment came through).
    const serverDraft = () => ({ status: "needs_admin", reason: "slot_unavailable", requestedDate: ymd(3), requestedTime: "10:00" });
    const member = customer({ addresses: [{ ...ADDRESS, hasActiveSubscription: true, plan: "plus", firstVisitExempt: true }] });
    const { ctx, page, state } = await open(browser, { me: member, draft: returning(), serverDraft });
    await page.goto(`${BASE}/book/handyman?resume=membership`, { waitUntil: "networkidle" });
    const booker = page.locator("[data-handyman-booker]");
    await booker.locator(".bk-banner").waitFor({ timeout: 20000 });
    check("time not kept: membership active, pick another time, explained", (await booker.getAttribute("data-step")) === "2" && /membership is active/i.test(await booker.innerText()) && /just taken/i.test(await booker.innerText()) && state.bookings.length === 0);
    const day = await booker.locator(".bk-day[aria-pressed=true]").getAttribute("data-day").catch(() => "");
    check("time not kept: the calendar still offers soon times (the exemption is theirs)", day && day < ymd(7), day);
    await ctx.close();
  }
  {
    // Paid, but the server has not finished yet: they are told it will be booked and emailed.
    const serverDraft = () => ({ status: "paid", requestedDate: ymd(3), requestedTime: "10:00" });
    const { ctx, page, state } = await open(browser, { me: activeMember, draft: returning(), serverDraft });
    await page.goto(`${BASE}/book/handyman?resume=membership`, { waitUntil: "networkidle" });
    await page.locator("[data-done-pending]").waitFor({ timeout: 40000 });
    check("still confirming: told the visit is being booked and emailed, no need to wait", /Payment received/.test(await page.locator("[data-done-pending]").innerText()) && state.bookings.length === 0);
    await ctx.close();
  }
  {
    // An older tab (checkout opened before this release, no saved draft) still books on return, inside the seven days.
    const member = customer({ addresses: [{ ...ADDRESS, hasActiveSubscription: true, plan: "plus", firstVisitExempt: true }] });
    const { ctx, page, state } = await open(browser, { me: member, draft: returning({ firstVisitDraftId: "" }) });
    await page.goto(`${BASE}/book/handyman?resume=membership`, { waitUntil: "networkidle" });
    await page.locator("[data-handyman-done]").waitFor({ timeout: 15000 });
    const b = state.bookings[0] || {};
    check("older tab: booked at the held time on return", state.bookings.length === 1 && b.requestedDate === ymd(3) && b.requestedTime === "10:00", JSON.stringify(state.bookings));
    await ctx.close();
  }
  {
    // An existing member (no exemption) still keeps the seven days: the held time inside it is not booked.
    const soon = ymd(3);
    const draft = { task: "Replace an existing faucet.", addressId: "a1", address: null, date: soon, time: "10:00", name: "", phone: "", email: "", photoCount: 0, clientRequestId: "", choice: "member", plan: "", cycle: "monthly", pendingBookingId: "", holdToken: "h1.secretsecretsecretsecretsecret", holdFor: `${soon} 10:00`, holdExpiresAt: new Date(Date.now() + 20 * 60000).toISOString(), timeConfirmed: true, updatedAt: Date.now() };
    const member = customer({ addresses: [{ ...ADDRESS, hasActiveSubscription: true, plan: "plus", firstVisitExempt: false }] });
    const { ctx, page, state } = await open(browser, { me: member, draft });
    await page.goto(`${BASE}/book/handyman`, { waitUntil: "networkidle" });
    const booker = page.locator("[data-handyman-booker]");
    await booker.waitFor({ timeout: 15000 });
    await page.waitForTimeout(1500);
    const day = await booker.locator(".bk-day[aria-pressed=true]").getAttribute("data-day").catch(() => "");
    check("an existing member keeps the seven days: back to the member calendar", (await booker.getAttribute("data-step")) === "2" && day >= ymd(7) && state.bookings.length === 0, `${await booker.getAttribute("data-step")} ${day}`);
    await ctx.close();
  }

  /* ===================== A new account's mobile number ===================== */
  {
    const fresh = customer({ phone: "", phoneVerified: false, phoneRequired: true, name: "Lee Walker", addresses: [] });
    const { ctx, page, state, errors } = await open(browser, { me: fresh });
    await page.goto(`${BASE}/`, { waitUntil: "networkidle" });
    const sheet = page.locator('.pf-sheet[role="dialog"]');
    await sheet.waitFor({ state: "visible", timeout: 15000 });
    const text = await sheet.innerText();
    check("phone required: Add your mobile number, the Fixter line, Text me a code", /Add your mobile number/.test(text) && /reach you on the day of the visit/.test(text) && /Text me a code/.test(text));
    // The registered phone-step line (terms.continue.v1): a one-time verification text, no text consent, no offers.
    check("phone required: the line under the button is the registered one, no text consent, no offers", /to receive a one-time verification text/.test(text) && !/texts about your visits|offer|promotion|marketing/i.test(text), text.replace(/\s+/g, " ").slice(0, 300));
    check("phone required: no checkbox", (await sheet.locator("input[type=checkbox]").count()) === 0);
    await page.keyboard.press("Escape");
    await page.waitForTimeout(400);
    check("phone required: it cannot be dismissed", await sheet.isVisible());
    check("phone required: Sign out is offered instead", (await sheet.locator("[data-action='phone-required-sign-out']").count()) === 1);
    await shot(page, "phone-required");
    await sheet.locator("#contact-phone").fill("5165550188");
    await sheet.locator("button[type=submit]").click();
    await page.waitForTimeout(600);
    const otp = sheet.locator("input[autocomplete='one-time-code'], input[inputmode='numeric']").first();
    await otp.waitFor({ timeout: 8000 });
    await otp.fill("123456");
    await page.waitForTimeout(1500);
    check("phone required: the code goes to Verify in attach mode", state.otpStarts.length === 1 && state.otpVerifies.length === 1 && state.otpVerifies[0].mode === "attach", JSON.stringify(state.otpVerifies));
    check("phone required: verified, the sheet goes away", !(await sheet.isVisible().catch(() => false)));
    check("phone required: no page errors", errors.length === 0, errors.join(" | "));
    await ctx.close();
  }
  {
    // An established customer with a verified phone is never asked.
    const { ctx, page } = await open(browser, { me: customer() });
    await page.goto(`${BASE}/`, { waitUntil: "networkidle" });
    await page.waitForTimeout(1500);
    check("a verified customer is never asked for a phone", (await page.locator('.pf-sheet[role="dialog"]').count()) === 0);
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
