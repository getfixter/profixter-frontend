/* eslint-disable @typescript-eslint/no-require-imports -- a plain Node script, like its neighbours */
/*
 * Customer experience 5 (2026-11-03), in a real browser against a mocked API.
 * Nothing real is booked, charged, texted or emailed: every /api/ call (on any
 * host) is answered here, Maps is blocked, Google and Stripe are stubbed.
 *
 *   node scripts/test_cx5_ui.js [baseUrl] [screenshotDir]
 *
 * - After a paid membership, "See my visits" opens Book's visit list
 *   (/book#your-visits), waits honestly while the server is still booking,
 *   and never posts a booking or opens a checkout.
 * - The Membership teaser shows the exact first-month price with the regular
 *   price struck through while the server's offer runs, and the regular price
 *   the moment it ends - no reload; an ineligible customer and a monthly-only
 *   offer on annual billing see regular prices.
 * - "Add your mobile number" has one optional, unticked offers box; only a
 *   tick sends consent, with the code; a STOP is explained.
 * - Personal info: Edit name, email (confirm it's you first) and phone (both
 *   boxes offered, unticked); cancelling changes nothing.
 * - Required fields are brought into view and focused; a calendar is not.
 * - While typing on a phone the bars step aside and the field stays above a
 *   shrunken viewport (Android's keyboard resize), on the page and in a sheet.
 * - /review counts the open (text/plain, with where it came from) and goes on
 *   to Google's review form; visit history links there.
 * Widths: 360, 390, 430, tablet 820, desktop 1440.
 */
const { chromium } = require("playwright");
const fs = require("fs");

const BASE = process.argv[2] || "http://localhost:3000";
const SHOTS = process.argv[3] || "";
if (SHOTS) fs.mkdirSync(SHOTS, { recursive: true });
const SCHEDULE = ["08:00", "10:00", "13:00"];
const results = [];
function check(name, pass, detail = "") {
  results.push(!!pass);
  console.log(`${pass ? "PASS" : "FAIL"}  ${name}${detail ? "  :: " + detail : ""}`);
}
function ymd(offset) {
  const [y, m, d] = new Date().toLocaleDateString("en-CA", { timeZone: "America/New_York" }).split("-").map(Number);
  return new Date(Date.UTC(y, m - 1, d + offset, 12)).toISOString().slice(0, 10);
}
const HOME = { _id: "a1", label: "Primary", line1: "12 Elm St", city: "Farmingdale", state: "NY", zip: "11735", hasActiveSubscription: false, plan: null };
const MEMBER_HOME = { ...HOME, hasActiveSubscription: true, plan: "basic" };
const customer = (over = {}) => ({ _id: "u1", userId: "40000001", name: "Dana Lopez", email: "dana@mailbox.org", emailVerified: true, phone: "+15165550123", phoneVerified: true, role: "customer", permissions: [], addresses: [HOME], ...over });
const PRICES = { basic: { monthlyCents: 14900, firstMonthCents: 11920, annualCents: 149000, firstYearCents: 119200 }, plus: { monthlyCents: 24900, firstMonthCents: 19920, annualCents: 249000, firstYearCents: 199200 } };
const shot = async (page, name) => {
  if (SHOTS) await page.screenshot({ path: `${SHOTS}/${name}.png` }).catch(() => {});
};

async function open(browser, { width = 390, height = 844, me = null, draft = null, offer = null, serverDraft = null, bookings = [], webdriver = true, reducedMotion = "no-preference", verify = null } = {}) {
  const mobile = width < 700;
  const ctx = await browser.newContext({ viewport: { width, height }, isMobile: mobile, hasTouch: mobile, reducedMotion });
  await ctx.addInitScript(
    ({ signedIn, draftJson, hideWebdriver }) => {
      try {
        if (hideWebdriver) Object.defineProperty(Navigator.prototype, "webdriver", { get: () => false });
        if (signedIn) localStorage.setItem("token", "ui-token");
        localStorage.setItem("profixter_promotion_popup_dismissed_date", new Date().toISOString().slice(0, 10));
        localStorage.setItem("pf_vid", "v_testvisitor00000001");
        if (draftJson && !sessionStorage.getItem("__seeded")) {
          localStorage.setItem("pf_handyman_draft", draftJson);
          sessionStorage.setItem("__seeded", "1");
        }
      } catch {}
    },
    { signedIn: Boolean(me), draftJson: draft ? JSON.stringify(draft) : "", hideWebdriver: !webdriver }
  );
  const state = { me, checkouts: [], bookingPosts: [], draftViews: 0, otpStarts: [], otpVerifies: [], emailStarts: [], emailVerifies: [], reauthStarts: [], reauthVerifies: [], profile: [], reviewOpens: [], unexpected: [] };
  await ctx.route(/maps\.googleapis\.com|places\.googleapis\.com/, (r) => r.abort());
  await ctx.route(/search\.google\.com/, (r) => r.fulfill({ status: 200, contentType: "text/html", body: "<h1>Google review form</h1>" }));
  await ctx.route(/\/api\//, async (route) => {
    const req = route.request();
    const u = new URL(req.url());
    const cors = { "access-control-allow-origin": "*", "access-control-allow-headers": "Authorization,Content-Type", "access-control-allow-methods": "GET,POST,PUT,PATCH,DELETE,OPTIONS" };
    if (req.method() === "OPTIONS") return route.fulfill({ status: 204, headers: cors });
    const json = (body, status = 200) => route.fulfill({ status, contentType: "application/json", headers: cors, body: JSON.stringify(body) });
    const p = u.pathname;
    const m = req.method();
    const body = () => {
      try {
        return JSON.parse(req.postData() || "{}");
      } catch {
        return {};
      }
    };
    if (p === "/api/auth/me") return state.me ? json(state.me) : json({ message: "No token" }, 401);
    if (p === "/api/calendar/month") {
      const month = u.searchParams.get("month");
      const days = [];
      for (let i = 0; i < 60; i++) {
        const d = ymd(i);
        if (!d.startsWith(month)) continue;
        days.push({ date: d, open: true, available: i >= 2, slotCount: i >= 2 ? 3 : 0, slots: i >= 2 ? SCHEDULE : [], candidateSlots: SCHEDULE.map((time) => ({ time, available: i >= 2 })), taken: {} });
      }
      return json({ month, engine: "reservation", visitDurationMinutes: 90, days });
    }
    if (p === "/api/calendar/slots") return json({ date: u.searchParams.get("date"), available: true, slots: SCHEDULE, candidateSlots: SCHEDULE.map((time) => ({ time, available: true })), taken: {}, capacityPerSlot: 1 });
    if (p === "/api/stripe/checkout/welcome-offer") return json(offer ? offer() : { eligible: false, serverNow: new Date().toISOString(), percentOff: 20 });
    if (p === "/api/service-area/check") return json({ serviceable: true });
    if (p === "/api/bookings/hold" && m === "POST") return json({ held: true, token: "h1.secretsecretsecretsecretsecret", holdExpiresAt: new Date(Date.now() + 30 * 60000).toISOString(), minutes: 30 });
    if (p === "/api/bookings/hold/release") return json({ released: true });
    if (p === "/api/bookings/one-time/config") return json({ enabled: true, priceCents: 9900, currency: "usd", durationMinutes: 90, holdMinutes: 30 });
    if (p.startsWith("/api/bookings/first-visit-draft/") && m === "GET") {
      state.draftViews += 1;
      return json(serverDraft ? serverDraft(state) : { status: "booked", requestedDate: ymd(9), requestedTime: "10:00", booking: { bookingNumber: "55554444" } });
    }
    if (p.endsWith("/fulfill") && m === "POST") return json(serverDraft ? serverDraft(state) : { status: "booked", requestedDate: ymd(9), requestedTime: "10:00" });
    if (p === "/api/stripe/checkout/create-checkout-session") {
      state.checkouts.push(body());
      return json({ url: "about:blank" });
    }
    if (p === "/api/bookings" && m === "POST") {
      state.bookingPosts.push(1);
      return json({ booking: { bookingNumber: "1" } });
    }
    if (p === "/api/bookings" && m === "GET") return json(bookings);
    if (p === "/api/users/me/sms-preferences") return json({ transactionalEnabled: Boolean(state.me?.smsServiceTexts), marketingEnabled: Boolean(state.me?.smsMarketingTexts), phoneOptedOut: false, phoneOptOutScope: "" });
    if (p === "/api/users/me/email-preferences") return json({ marketingEnabled: false, status: "not_set", blocked: false, eligible: true });
    if (p === "/api/users/me/profile" && m === "PATCH") {
      const b = body();
      state.profile.push(b);
      state.me = { ...state.me, name: b.name };
      return json({ user: state.me });
    }
    if (p === "/api/auth/otp/phone/start") {
      state.otpStarts.push(body());
      return json({ ok: true, phoneMasked: "(•••) •••-0188", resendAfterSeconds: 30 });
    }
    if (p === "/api/auth/otp/phone/verify") {
      const b = body();
      state.otpVerifies.push(b);
      if (verify) return json(...verify(state, b));
      state.me = { ...state.me, phone: "+15165550188", phoneVerified: true, phoneRequired: false, smsMarketingTexts: b.smsOptIn?.marketing === true };
      return json({ status: "attached", user: state.me, smsOptIn: { marketing: b.smsOptIn?.marketing === true, service: b.smsOptIn?.service === true } });
    }
    if (p === "/api/auth/otp/email/start") {
      state.emailStarts.push(body());
      return json({ ok: true, emailMasked: "ne•••@mailbox.org", resendAfterSeconds: 30 });
    }
    if (p === "/api/auth/otp/email/verify") {
      const b = body();
      state.emailVerifies.push(b);
      if (!b.reauthToken) return json({ code: "REAUTH_REQUIRED", message: "Please confirm it's you first." }, 403);
      state.me = { ...state.me, email: b.email, emailVerified: true };
      return json({ status: "attached", user: state.me });
    }
    if (p === "/api/auth/reauth/start") {
      state.reauthStarts.push(body());
      return json({ ok: true, channel: body().channel, destination: body().channel === "sms" ? "••• ••• 0123" : "da•••@mailbox.org", resendAfterSeconds: 30 });
    }
    if (p === "/api/auth/reauth/verify") {
      state.reauthVerifies.push(body());
      return json({ ok: true, reauthToken: "reauth-proof", expiresInSeconds: 600 });
    }
    if (p === "/api/track/review-open") {
      state.reviewOpens.push({ type: req.headers()["content-type"], body: req.postData() });
      return route.fulfill({ status: 204, headers: cors });
    }
    if (p.startsWith("/api/track/")) return route.fulfill({ status: 204, headers: cors });
    if (p.startsWith("/api/recent-work")) return json({ photos: [], page: 1, limit: 24, total: 0, hasMore: false });
    if (m !== "GET") state.unexpected.push(`${m} ${p}`);
    return json([]);
  });
  const page = await ctx.newPage();
  const errors = [];
  page.on("pageerror", (e) => errors.push(e.message));
  return { ctx, page, state, errors };
}

const returning = (over = {}) => ({ task: "Replace an existing faucet.", addressId: "a1", address: null, date: ymd(9), time: "10:00", name: "", phone: "", email: "", photoCount: 0, clientRequestId: "fv-1", choice: "membership", plan: "basic", cycle: "monthly", pendingBookingId: "", holdToken: "h9.renewedrenewedrenewedrenewed", holdFor: `${ymd(9)} 10:00`, holdExpiresAt: new Date(Date.now() + 30 * 60000).toISOString(), timeConfirmed: true, firstVisitDraftId: "d0000000000000000000001", updatedAt: Date.now(), ...over });

/* Is the element fully inside what the person can see (the visual viewport)? */
async function inView(page, selector) {
  return page.evaluate((sel) => {
    const el = document.querySelector(sel);
    if (!el) return false;
    const r = el.getBoundingClientRect();
    const vv = window.visualViewport;
    const bottom = vv ? vv.offsetTop + vv.height : window.innerHeight;
    return r.top >= 0 && r.bottom <= bottom + 1;
  }, selector);
}

(async () => {
  const browser = await chromium.launch();

  /* ===================== 1. After paying: See my visits ===================== */
  for (const [w, h] of [[360, 740], [1440, 900]]) {
    const tag = `${w}px`;
    const member = customer({ addresses: [MEMBER_HOME] });
    const { ctx, page, state, errors } = await open(browser, { width: w, height: h, me: member, draft: returning(), bookings: [{ _id: "b1", bookingNumber: "55554444", status: "Pending", date: `${ymd(9)}T14:00:00.000Z`, service: "Replace an existing faucet.", address: "12 Elm St" }] });
    await page.goto(`${BASE}/book/handyman?resume=membership`, { waitUntil: "networkidle" });
    const done = page.locator("[data-handyman-done]");
    await done.waitFor({ timeout: 15000 });
    const link = done.locator("[data-see-visits='ready']");
    check(`${tag}: See my visits opens Book's visit list, not Account`, (await link.getAttribute("href")) === "/book#your-visits", await link.getAttribute("href"));
    await shot(page, `cx5-${tag}-done`);
    await link.click();
    await page.waitForURL(/\/book#your-visits$/, { timeout: 15000 });
    await page.locator("#your-visits").waitFor({ timeout: 15000 });
    await page.waitForTimeout(1200);
    const top = await page.evaluate(() => document.getElementById("your-visits")?.getBoundingClientRect().top ?? 9999);
    check(`${tag}: it lands on the visit list`, top < 200 && top > -50, `top=${Math.round(top)}`);
    check(`${tag}: the saved visit is listed`, /55554444|Replace an existing faucet/.test(await page.locator("#your-visits").innerText()));
    check(`${tag}: no booking posted, no checkout opened`, state.bookingPosts.length === 0 && state.checkouts.length === 0, JSON.stringify({ b: state.bookingPosts.length, c: state.checkouts.length }));
    check(`${tag}: no page errors`, errors.length === 0, errors.join(" | "));
    await shot(page, `cx5-${tag}-visits`);
    await ctx.close();
  }
  {
    // The webhook is slow: the button waits, honestly, then becomes the link.
    let views = 0;
    const member = customer({ addresses: [MEMBER_HOME] });
    const { ctx, page, state } = await open(browser, { me: member, draft: returning(), serverDraft: () => (++views < 11 ? { status: "paid", requestedDate: ymd(9), requestedTime: "10:00" } : { status: "booked", requestedDate: ymd(9), requestedTime: "10:00" }) });
    await page.goto(`${BASE}/book/handyman?resume=membership`, { waitUntil: "networkidle" });
    const done = page.locator("[data-handyman-done]");
    await done.waitFor({ timeout: 40000 });
    check("pending: says payment received and we are booking it", /Payment received/.test(await done.innerText()));
    const waiting = done.locator("[data-see-visits='waiting']");
    check("pending: the button waits and cannot be pressed", (await waiting.count()) === 1 && (await waiting.isDisabled()), await done.innerText());
    await done.locator("[data-see-visits='ready']").waitFor({ timeout: 20000 });
    check("pending: once booked, the normal confirmation and the link", /review it and confirm/i.test(await done.innerText()) && (await done.locator("[data-see-visits='ready']").getAttribute("href")) === "/book#your-visits");
    check("pending: only read-only checks, nothing booked or paid", state.bookingPosts.length === 0 && state.checkouts.length === 0 && state.unexpected.filter((x) => !/fulfill/.test(x)).length === 0, JSON.stringify(state.unexpected));
    await ctx.close();
  }

  /* ===================== 2. The Membership teaser follows the server's offer ===================== */
  {
    const started = Date.now();
    const offer = () => ({ eligible: true, serverNow: new Date().toISOString(), expiresAt: new Date(started + 14000).toISOString(), percentOff: 20, label: "Welcome Offer", plans: PRICES });
    const draft = returning({ firstVisitDraftId: "", choice: "", holdToken: "", holdFor: "", holdExpiresAt: "" });
    const { ctx, page, errors } = await open(browser, { me: customer(), draft, offer });
    await page.goto(`${BASE}/book/handyman`, { waitUntil: "networkidle" });
    const teaser = page.locator("[data-option='membership']");
    await teaser.waitFor({ timeout: 15000 });
    await page.locator("[data-membership-teaser='offer']").waitFor({ timeout: 8000 });
    const t = await teaser.innerText();
    check("offer: $119.20 first month, exact cents", /\$119\.20/.test(t) && /first month/.test(t), t.replace(/\s+/g, " "));
    check("offer: $149 struck through", (await teaser.locator("s.wo-was").innerText()) === "$149");
    check("offer: says it is the first monthly payment only, then $149/mo", /first monthly payment only; then \$149\/mo/.test(t));
    check("offer: the banner says First Payment when the server prices annual too", /20% Off Your First Payment/.test(await page.locator("[data-welcome-offer]").innerText()));
    await shot(page, "cx5-offer-on");
    await teaser.click();
    await page.locator("[data-cycle='annual']").click();
    const ta = await teaser.innerText();
    check("offer, annual: the server's first-year price for annual (server offers annual)", /\$1,192/.test(ta) && (await teaser.locator("s.wo-was").innerText()) === "$1,490", ta.replace(/\s+/g, " "));
    await page.locator("[data-cycle='monthly']").click();
    await page.locator("[data-membership-teaser='regular']").waitFor({ timeout: 20000 });
    const after = await teaser.innerText();
    check("expired: regular price back, no reload, nothing struck through", /from \$149\/mo/.test(after) && (await teaser.locator("s").count()) === 0 && !/off 1st/.test(after), after.replace(/\s+/g, " "));
    check("expired: checkout button shows no discount", !/119\.20/.test(await page.locator("[data-action='book-handyman']").innerText()));
    check("offer: no page errors", errors.length === 0, errors.join(" | "));
    await ctx.close();
  }
  {
    const draft = returning({ firstVisitDraftId: "", choice: "", holdToken: "", holdFor: "", holdExpiresAt: "" });
    const { ctx, page } = await open(browser, { me: customer(), draft });
    await page.goto(`${BASE}/book/handyman`, { waitUntil: "networkidle" });
    await page.locator("[data-option='membership']").waitFor({ timeout: 15000 });
    await page.waitForTimeout(800);
    check("ineligible: regular price only", (await page.locator("[data-membership-teaser='regular']").count()) === 1 && (await page.locator("[data-membership-teaser='offer']").count()) === 0);
    await ctx.close();
  }
  {
    // A monthly-only offer (no annual price from the server) never discounts annual.
    const monthlyOnly = { basic: { monthlyCents: 14900, firstMonthCents: 11920 } };
    const offer = () => ({ eligible: true, serverNow: new Date().toISOString(), expiresAt: new Date(Date.now() + 600000).toISOString(), percentOff: 20, label: "Welcome Offer", plans: monthlyOnly });
    const draft = returning({ firstVisitDraftId: "", choice: "membership", cycle: "annual", holdToken: "", holdFor: "", holdExpiresAt: "" });
    const { ctx, page } = await open(browser, { me: customer(), draft, offer });
    await page.goto(`${BASE}/book/handyman`, { waitUntil: "networkidle" });
    await page.locator("[data-option='membership']").waitFor({ timeout: 15000 });
    await page.waitForTimeout(800);
    check("monthly-only offer: the banner says First Month", /20% Off Your First Month/.test(await page.locator("[data-welcome-offer]").innerText().catch(() => "")));
    check("monthly-only offer on annual: no discount shown", (await page.locator("[data-membership-teaser='offer']").count()) === 0 && !/1,192/.test(await page.locator("[data-handyman-booker]").innerText()));
    await ctx.close();
  }

  /* ===================== 3. Offers box on "Add your mobile number" ===================== */
  for (const tick of [false, true]) {
    const tag = tick ? "ticked" : "left unticked";
    const { ctx, page, state, errors } = await open(browser, { width: 360, height: 740, me: customer({ phone: "", phoneVerified: false, phoneRequired: true }) });
    await page.goto(`${BASE}/`, { waitUntil: "networkidle" });
    const sheet = page.locator('.pf-sheet[role="dialog"]');
    await sheet.waitFor({ state: "visible", timeout: 15000 });
    const box = sheet.locator("#contact-sms-offers");
    check(`phone screen (${tag}): one optional offers box, unticked`, (await sheet.locator("input[type=checkbox]").count()) === 1 && !(await box.isChecked()));
    const text = await sheet.innerText();
    check(`phone screen (${tag}): label, STOP/HELP line, SMS Terms and Privacy`, /Text me ProFixter offers, too\./.test(text) && /Reply STOP to opt out, HELP for help\./.test(text) && (await sheet.locator('a[href="/communication-consent#marketing"]').count()) === 1 && (await sheet.locator('a[href="/privacy"]').count()) >= 1);
    const fits = await page.evaluate(() => {
      const s = document.querySelector(".pf-sheet");
      return s ? s.scrollHeight <= s.clientHeight + 2 : false;
    });
    check(`phone screen (${tag}): compact - fits a 360x740 phone without scrolling`, fits);
    if (!tick) await shot(page, "cx5-phone-screen");
    if (tick) await sheet.locator("label[for='contact-sms-offers']").click();
    await sheet.locator("#contact-phone").fill("5165550188");
    await sheet.locator("button[type=submit]").click();
    const otp = sheet.locator("input[autocomplete='one-time-code'], input[inputmode='numeric']").first();
    await otp.waitFor({ timeout: 8000 });
    await otp.fill("123456");
    await page.waitForTimeout(1500);
    check(`phone screen (${tag}): the request for a code carries the number only`, Object.keys(state.otpStarts[0] || {}).join() === "phone", JSON.stringify(state.otpStarts));
    check(`phone screen (${tag}): consent sent with the code only if ticked`, state.otpVerifies[0]?.smsOptIn?.marketing === tick && state.otpVerifies[0]?.smsOptIn?.service === false, JSON.stringify(state.otpVerifies[0]));
    check(`phone screen (${tag}): they carry on either way`, !(await sheet.isVisible().catch(() => false)));
    check(`phone screen (${tag}): no page errors`, errors.length === 0, errors.join(" | "));
    await ctx.close();
  }
  {
    const { ctx, page } = await open(browser, { me: customer({ phone: "", phoneVerified: false, phoneRequired: true }), verify: (state) => {
      // As the server does: the number is saved and verified; the STOP stands, so nothing is switched on.
      state.me = { ...state.me, phone: "+15165550188", phoneVerified: true, phoneRequired: false };
      return [{ status: "attached", user: state.me, smsOptIn: { marketing: false, service: false, blocked: "stopped" } }];
    } });
    await page.goto(`${BASE}/`, { waitUntil: "networkidle" });
    const sheet = page.locator('.pf-sheet[role="dialog"]');
    await sheet.waitFor({ state: "visible", timeout: 15000 });
    await sheet.locator("label[for='contact-sms-offers']").click();
    await sheet.locator("#contact-phone").fill("5165550188");
    await sheet.locator("button[type=submit]").click();
    const otp = sheet.locator("input[autocomplete='one-time-code'], input[inputmode='numeric']").first();
    await otp.waitFor({ timeout: 8000 });
    await otp.fill("123456");
    await sheet.locator("[data-contact-notice]").waitFor({ timeout: 8000 }).catch(() => {});
    check("STOP on that phone: explained, not pretended", /replied STOP/.test(await sheet.innerText().catch(() => "")) && /START/.test(await sheet.innerText().catch(() => "")));
    await sheet.locator("[data-contact-notice] button").click().catch(() => {});
    await sheet.waitFor({ state: "detached", timeout: 8000 }).catch(() => {});
    check("STOP on that phone: Done carries on with the number saved", !(await sheet.isVisible().catch(() => false)));
    await ctx.close();
  }
  {
    // Someone already receiving offers is not asked again.
    const { ctx, page } = await open(browser, { me: customer({ phone: "", phoneVerified: false, phoneRequired: true, smsMarketingTexts: true }) });
    await page.goto(`${BASE}/`, { waitUntil: "networkidle" });
    const sheet = page.locator('.pf-sheet[role="dialog"]');
    await sheet.waitFor({ state: "visible", timeout: 15000 });
    check("already receiving offers: no box", (await sheet.locator("input[type=checkbox]").count()) === 0);
    await ctx.close();
  }

  /* ===================== 4. Editing my own details ===================== */
  for (const [w, h] of [[390, 844], [820, 1180]]) {
    const tag = `${w}px`;
    const { ctx, page, state, errors } = await open(browser, { width: w, height: h, me: customer() });
    await page.goto(`${BASE}/account?tab=personal`, { waitUntil: "networkidle" });
    await page.locator("[data-acct-edit='name']").waitFor({ timeout: 15000 });
    check(`${tag}: no "call us to change it" line any more`, !/Call 631-599-1363 and we/.test(await page.locator("#acct-contact").locator("..").innerText()));
    check(`${tag}: Edit for name, email and mobile`, (await page.locator("[data-acct-edit]").count()) === 3);
    await shot(page, `cx5-${tag}-personal`);
    // Name
    await page.locator("[data-acct-edit='name']").click();
    const sheet = page.locator('.pf-sheet[role="dialog"]');
    await sheet.waitFor({ state: "visible" });
    check(`${tag}: name starts with the current name`, (await sheet.locator("#contact-name").inputValue()) === "Dana Lopez");
    await sheet.locator("#contact-name").fill("");
    await sheet.locator("button[type=submit]").click();
    await page.waitForTimeout(300);
    check(`${tag}: an empty name is refused, focused, with a short error`, /Please enter your name/.test(await sheet.innerText()) && (await page.evaluate(() => document.activeElement?.id)) === "contact-name");
    await sheet.locator("#contact-name").fill("Dana M. Lopez");
    await sheet.locator("button[type=submit]").click();
    await sheet.waitFor({ state: "detached", timeout: 8000 });
    check(`${tag}: the name is saved and shown at once`, state.profile.at(-1)?.name === "Dana M. Lopez" && /Dana M\. Lopez/.test(await page.locator("[data-acct-field='name']").innerText()));
    // Email: confirm it's you first (this session is not a fresh sign-in)
    await page.locator("[data-acct-edit='email']").click();
    await sheet.waitFor({ state: "visible" });
    check(`${tag}: changing a verified email asks to confirm it's you`, /Confirm it.s you/.test(await sheet.innerText()) && (await sheet.locator("[data-contact-confirm]").count()) === 1);
    await sheet.locator("[data-action='confirm-send']").click();
    let otp = sheet.locator("input[autocomplete='one-time-code'], input[inputmode='numeric']").first();
    await otp.waitFor({ timeout: 8000 });
    await otp.fill("111111");
    await sheet.locator("#contact-email").waitFor({ timeout: 8000 });
    check(`${tag}: the confirmation code went to the account's own phone`, state.reauthStarts[0]?.channel === "sms" && state.reauthVerifies.length === 1);
    check(`${tag}: the old email is still shown while changing`, /dana@mailbox\.org/.test(await page.locator("[data-acct-field='email']").innerText()));
    await sheet.locator("#contact-email").fill("dana.new@mailbox.org");
    await sheet.locator("button[type=submit]").click();
    otp = sheet.locator("input[autocomplete='one-time-code'], input[inputmode='numeric']").first();
    await otp.waitFor({ timeout: 8000 });
    await otp.fill("222222");
    await sheet.waitFor({ state: "detached", timeout: 8000 });
    check(`${tag}: the new email is verified with its code, the proof attached`, state.emailStarts.at(-1)?.mode === "attach" && state.emailVerifies.at(-1)?.reauthToken === "reauth-proof" && /dana\.new@mailbox\.org/.test(await page.locator("[data-acct-field='email']").innerText()));
    check(`${tag}: no page errors`, errors.length === 0, errors.join(" | "));
    await ctx.close();
  }
  {
    // Phone: both boxes offered, unticked; cancelling leaves everything as it was.
    const { ctx, page, state } = await open(browser, { me: customer() });
    await page.goto(`${BASE}/account?tab=personal`, { waitUntil: "networkidle" });
    await page.locator("[data-acct-edit='phone']").click();
    const sheet = page.locator('.pf-sheet[role="dialog"]');
    await sheet.waitFor({ state: "visible" });
    await sheet.locator("[data-action='confirm-other']").click().catch(() => {});
    await sheet.locator("[data-action='confirm-send']").click();
    const otp = sheet.locator("input[autocomplete='one-time-code'], input[inputmode='numeric']").first();
    await otp.waitFor({ timeout: 8000 });
    await otp.fill("111111");
    await sheet.locator("#contact-phone").waitFor({ timeout: 8000 });
    check("change phone: titled as a change, both boxes offered and unticked", /Change your mobile number/.test(await sheet.innerText()) && !(await sheet.locator("#contact-sms-offers").isChecked()) && !(await sheet.locator("#contact-sms-visits").isChecked()));
    await shot(page, "cx5-change-phone");
    await page.keyboard.press("Escape");
    await sheet.waitFor({ state: "detached", timeout: 5000 });
    check("change phone, cancelled: the number is unchanged and nothing was verified", state.otpVerifies.length === 0 && /516/.test(await page.locator("[data-acct-field='phone']").innerText()));
    await ctx.close();
  }

  /* ===================== 5. Taken to what needs attention ===================== */
  for (const [w, h, motion] of [[360, 640, "no-preference"], [430, 932, "reduce"], [1440, 900, "no-preference"]]) {
    const tag = `${w}px${motion === "reduce" ? " reduced motion" : ""}`;
    const { ctx, page } = await open(browser, { width: w, height: h, me: customer(), reducedMotion: motion });
    await page.goto(`${BASE}/book/handyman`, { waitUntil: "networkidle" });
    await page.locator("[data-action='to-step-2']").waitFor({ timeout: 15000 });
    await page.locator("[data-action='to-step-2']").scrollIntoViewIfNeeded();
    await page.locator("[data-action='to-step-2']").click();
    await page.waitForTimeout(motion === "reduce" ? 300 : 900);
    check(`${tag}: Book a Handyman - the empty job field is focused and in view`, (await page.evaluate(() => document.activeElement?.id)) === "bk-task" && (await inView(page, "#bk-task")));
    check(`${tag}: with a short error`, /Tell us in a few words/.test(await page.locator("[data-handyman-booker]").innerText()));
    await ctx.close();
  }
  {
    const { ctx, page } = await open(browser, { width: 390, height: 700 });
    await page.goto(`${BASE}/book/free`, { waitUntil: "networkidle" });
    const submit = page.locator("button:has-text('Review'), button:has-text('Request')").first();
    await submit.waitFor({ timeout: 15000 });
    await submit.scrollIntoViewIfNeeded();
    await submit.click();
    await page.waitForTimeout(900);
    const active = await page.evaluate(() => (document.activeElement && (document.activeElement.getAttribute("name") || document.activeElement.id)) || "");
    check("Free Visit: the first missing field is focused and in view", Boolean(active) && (await page.evaluate(() => {
      const el = document.activeElement;
      if (!el || el === document.body) return false;
      const r = el.getBoundingClientRect();
      return r.top >= 0 && r.bottom <= window.innerHeight;
    })), active);
    await ctx.close();
  }
  {
    // Typing does not scroll the page about.
    const { ctx, page } = await open(browser, { width: 390, height: 844, me: customer() });
    await page.goto(`${BASE}/book/handyman`, { waitUntil: "networkidle" });
    await page.locator("#bk-task").waitFor({ timeout: 15000 });
    await page.locator("#bk-task").click();
    const before = await page.evaluate(() => window.scrollY);
    await page.keyboard.type("Fix a squeaky door", { delay: 15 });
    const after = await page.evaluate(() => window.scrollY);
    check("typing in a field never moves the page", Math.abs(after - before) < 2, `${before} -> ${after}`);
    await ctx.close();
  }

  /* ===================== 6. The keyboard ===================== */
  for (const [w, h] of [[360, 740], [390, 844], [430, 932]]) {
    const tag = `${w}px`;
    const { ctx, page } = await open(browser, { width: w, height: h, me: customer() });
    await page.goto(`${BASE}/book/free`, { waitUntil: "networkidle" });
    const field = page.locator("input[name='email']").first();
    await field.waitFor({ timeout: 15000 });
    await field.scrollIntoViewIfNeeded();
    await field.tap();
    await page.waitForTimeout(200);
    check(`${tag}: typing hides the tab bar and Call button`, (await page.evaluate(() => document.documentElement.dataset.keyboard)) === "open" && (await page.evaluate(() => {
      const bars = [...document.querySelectorAll(".csn, .pf-call")];
      return bars.every((b) => getComputedStyle(b).visibility === "hidden");
    })));
    // Android's keyboard: the page shrinks (interactive-widget=resizes-content).
    await page.setViewportSize({ width: w, height: Math.round(h * 0.55) });
    await page.waitForTimeout(400);
    check(`${tag}: the focused field stays above the keyboard`, await inView(page, "input[name='email']:focus"));
    await page.setViewportSize({ width: w, height: h });
    await page.locator("body").click({ position: { x: 5, y: 5 } }).catch(() => {});
    await page.evaluate(() => document.activeElement instanceof HTMLElement && document.activeElement.blur());
    await page.waitForTimeout(250);
    check(`${tag}: keyboard gone, the bars are back`, !(await page.evaluate(() => document.documentElement.dataset.keyboard)) && (await page.evaluate(() => [...document.querySelectorAll(".csn")].every((b) => getComputedStyle(b).visibility !== "hidden"))));
    await ctx.close();
  }
  {
    // In a sheet: the phone field on "Add your mobile number" at a small, shrunken screen.
    const { ctx, page } = await open(browser, { width: 360, height: 740, me: customer({ phone: "", phoneVerified: false, phoneRequired: true }) });
    await page.goto(`${BASE}/`, { waitUntil: "networkidle" });
    const sheet = page.locator('.pf-sheet[role="dialog"]');
    await sheet.waitFor({ state: "visible", timeout: 15000 });
    await sheet.locator("#contact-phone").tap();
    await page.setViewportSize({ width: 360, height: 380 });
    await page.waitForTimeout(400);
    check("sheet: the phone field stays visible above the keyboard", await inView(page, "#contact-phone"));
    check("sheet: its button can still be reached by scrolling the sheet", await page.evaluate(() => {
      const s = document.querySelector(".pf-sheet");
      return Boolean(s) && s.getBoundingClientRect().top >= 0 && s.getBoundingClientRect().bottom <= window.innerHeight + 1;
    }));
    await ctx.close();
  }

  /* ===================== 7. /review ===================== */
  for (const [path, via] of [["/review?via=email", "email"], ["/review", "other"]]) {
    const { ctx, page, state } = await open(browser, { webdriver: false });
    await page.goto(`${BASE}${path}`, { waitUntil: "domcontentloaded" });
    await page.waitForURL(/search\.google\.com\/local\/writereview\?placeid=ChIJjZtSCtd1XogR0kdxepnQJu8/, { timeout: 15000 });
    await page.waitForTimeout(300);
    const sent = state.reviewOpens[0];
    check(`${path}: opens Google's review form for ProFixter`, /writereview/.test(page.url()));
    check(`${path}: the open is counted as "${via}", text/plain, nothing personal`, Boolean(sent) && /text\/plain/.test(sent.type) && JSON.parse(sent.body).via === via && Object.keys(JSON.parse(sent.body)).sort().join() === "via,visitorId", JSON.stringify(sent));
    await ctx.close();
  }
  {
    const member = customer({ addresses: [MEMBER_HOME] });
    const { ctx, page } = await open(browser, { me: member, bookings: [{ _id: "b2", bookingNumber: "77778888", status: "Completed", date: `${ymd(-5)}T14:00:00.000Z`, service: "Hang shelves", address: "12 Elm St" }] });
    await page.goto(`${BASE}/book#your-visits`, { waitUntil: "networkidle" });
    // The list opens on Active; finished visits are under Completed.
    await page.locator("#your-visits button:has-text('Completed')").first().click({ timeout: 15000 }).catch(() => {});
    await page.locator("[data-review-link='account']").first().waitFor({ timeout: 15000 }).catch(() => {});
    check("visit history: Leave a review goes through /review", (await page.locator("[data-review-link='account']").first().getAttribute("href").catch(() => "")) === "/review?via=account");
    await ctx.close();
  }

  await browser.close();
  const passed = results.filter(Boolean).length;
  console.log(`\n${passed}/${results.length} passed`);
  process.exit(passed === results.length ? 0 : 1);
})();
