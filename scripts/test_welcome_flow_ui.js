/* eslint-disable @typescript-eslint/no-require-imports -- a plain Node script, like its neighbours */
/*
 * The welcome entry (2026-11-19), in a real browser against a mocked API.
 *
 *   node scripts/test_welcome_flow_ui.js [baseUrl] [screenshotDir]
 *
 * Every request that is not this local server is aborted and counted; the
 * API (api.profixter.com in a local build) is answered by the mock below.
 * Nothing real is booked, charged, texted or tracked.
 *
 * - "/" for a new visitor: exactly the question and the two answers,
 *   membership first; no price, description, steps or footer; logo, Log in,
 *   Menu; call and chat present and clear of the answers.
 * - The logo shows the current homepage and is remembered (reload: homepage).
 * - Signed in, a #section, a crawler, a direct link: never the welcome.
 * - One-time: the nudge (exact copy), "Show me membership" joins the
 *   membership path, "Continue with one visit" the one-time path; address ->
 *   time (held on Continue; a taken time keeps everything else) -> job ->
 *   contact (autofill tokens) -> review ($99, consent) -> guest checkout with
 *   returnTo "welcome" and the visitor id. Back and a reload keep answers.
 * - Membership: plans with each plan's limit on visits booked at once, then
 *   sign-up with the number filled in; signed in, /start?resume=pay opens the
 *   book-first membership checkout with returnTo "welcome".
 * - The Continue bar: low, full width, Continue on the right; the call and
 *   chat buttons never cover it; with the keyboard open the chat launcher
 *   steps aside; it stays on screen while the calendar scrolls.
 * - No answer in any URL; no request to any tracker host; steps fire.
 * - /start: noindex, canonical "/".
 */
const { chromium } = require("playwright");
const fs = require("fs");

const BASE = process.argv[2] || "http://localhost:3000";
const SHOTS = process.argv[3] || "";
if (SHOTS) fs.mkdirSync(SHOTS, { recursive: true });
const SCHEDULE = ["08:00", "10:30", "13:00", "15:30"];
const LOCAL = new URL(BASE).host;

const results = [];
function check(name, pass, detail = "") {
  results.push(!!pass);
  console.log(`${pass ? "PASS" : "FAIL"}  ${name}${detail ? "  :: " + detail : ""}`);
}
function ymd(offset) {
  const [y, m, d] = new Date().toLocaleDateString("en-CA", { timeZone: "America/New_York" }).split("-").map(Number);
  return new Date(Date.UTC(y, m - 1, d + offset, 12)).toISOString().slice(0, 10);
}
const ME = { _id: "u1", userId: "40000001", name: "Dana Lopez", email: "dana@mailbox.org", phone: "+15165550123", phoneVerified: true, emailVerified: true, role: "customer", permissions: [], addresses: [] };

async function open(browser, { width = 390, height = 844, me = null, welcome = true, ua, takenTime = "", device = null } = {}) {
  const mobile = width < 700;
  const ctx = await browser.newContext(device ? { ...device } : { viewport: { width, height }, isMobile: mobile, hasTouch: mobile, ...(ua ? { userAgent: ua } : {}) });
  await ctx.addInitScript(({ signedIn, welcome: w }) => {
    try {
      if (signedIn) localStorage.setItem("token", "ui-token");
      if (w) localStorage.setItem("pf_welcome_test", "1");
      localStorage.setItem("profixter_promotion_popup_dismissed_date", new Date().toISOString().slice(0, 10));
      window.__steps = [];
      window.addEventListener("pf:step", (e) => window.__steps.push(e.detail));
    } catch {}
  }, { signedIn: Boolean(me), welcome });
  const state = { me, holds: [], guest: [], firstVisit: [], memberships: [], outside: [], unexpected: [], urls: [], contactEmail: [], names: [] };
  await ctx.route("**/*", async (route) => {
    const req = route.request();
    const u = new URL(req.url());
    if (u.host === LOCAL) return route.continue();
    if (u.host === "checkout.stripe.test") return route.fulfill({ status: 200, contentType: "text/html", body: "<h1>Stripe test checkout</h1>" });
    if (u.host !== "api.profixter.com" && !/^(localhost|127\.0\.0\.1):5001$/.test(u.host)) {
      state.outside.push(u.host);
      return route.abort();
    }
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
      for (let i = 0; i < 70; i++) {
        const d = ymd(i);
        if (!d.startsWith(month)) continue;
        const ok = i >= 2;
        days.push({ date: d, open: true, available: ok, slotCount: ok ? 4 : 0, slots: ok ? SCHEDULE : [], candidateSlots: SCHEDULE.map((time) => ({ time, available: ok })), taken: {} });
      }
      return json({ month, engine: "reservation", visitDurationMinutes: 90, days });
    }
    if (p === "/api/calendar/slots") {
      const date = u.searchParams.get("date");
      // state.slotGone: a time taken by someone else after this visitor chose it (2026-11-20).
      return json({ date, available: true, slots: SCHEDULE, candidateSlots: SCHEDULE.map((time) => ({ time, available: time !== state.slotGone })), taken: {}, capacityPerSlot: 1 });
    }
    if (p === "/api/calendar/config") return json({ engine: "reservation", timezone: "America/New_York", visitDurationMinutes: 90, minLeadDays: 2, closedWeekdays: [0, 1], defaultHours: SCHEDULE });
    if (p === "/api/stripe/checkout/welcome-offer") return json({ eligible: false, serverNow: new Date().toISOString(), percentOff: 20 });
    if (p === "/api/service-area/check") return json({ serviceable: u.searchParams.get("zip") !== "10001" });
    if (p === "/api/bookings/one-time/config") return json({ enabled: true, priceCents: 9900, currency: "usd", durationMinutes: 90, holdMinutes: 30 });
    if (p === "/api/bookings/hold/release" && m === "POST") return json({ released: true });
    if (p === "/api/bookings/hold" && m === "POST") {
      const body = JSON.parse(req.postData() || "{}");
      state.holds.push(body);
      if (takenTime && body.requestedTime === takenTime && state.holds.length === 1) return json({ code: "SLOT_UNAVAILABLE", message: "taken" }, 409);
      return json({ held: true, token: `h${state.holds.length}.secretsecretsecretsecretsecret`, holdExpiresAt: new Date(Date.now() + 30 * 60000).toISOString(), minutes: 30 });
    }
    if (p === "/api/bookings/guest/one-time/checkout" && m === "POST") {
      const t = text();
      state.guest.push({ returnTo: field(t, "returnTo"), visitorId: field(t, "visitorId"), consentText: field(t, "consentText"), name: field(t, "name"), phone: field(t, "phone"), email: field(t, "email"), note: field(t, "note"), requestedTime: field(t, "requestedTime"), holdToken: field(t, "holdToken"), zip: field(t, "zip") });
      return json({ url: "https://checkout.stripe.test/cs_guest", bookingId: "b-guest-1", holdExpiresAt: new Date(Date.now() + 1800000).toISOString() });
    }
    if (p === "/api/auth/contact/email" && m === "POST") {
      const body = JSON.parse(req.postData() || "{}");
      state.contactEmail.push(body.email);
      state.me = { ...state.me, email: body.email };
      return json({ status: "saved", user: state.me });
    }
    if (p === "/api/users/me/profile" && m === "PATCH") {
      const body = JSON.parse(req.postData() || "{}");
      state.names.push(body.name);
      state.me = { ...state.me, name: body.name };
      return json({ user: state.me });
    }
    if (p === "/api/users/me/addresses" && m === "POST") {
      const body = JSON.parse(req.postData() || "{}");
      const address = { _id: "a-new", ...body, hasActiveSubscription: false };
      state.me = { ...state.me, addresses: [...(state.me?.addresses || []), address] };
      return json({ address, user: state.me });
    }
    if (p === "/api/bookings/first-visit-draft" && m === "POST") {
      const t = text();
      state.firstVisit.push({ addressId: field(t, "addressId"), note: field(t, "note"), requestedTime: field(t, "requestedTime"), holdToken: field(t, "holdToken") });
      return json({ draftId: "fvd1" });
    }
    if (p === "/api/stripe/checkout/create-checkout-session" && m === "POST") {
      state.memberships.push(JSON.parse(req.postData() || "{}"));
      return json({ url: "https://checkout.stripe.test/cs_member", sessionId: "cs_member" });
    }
    if (p === "/api/subscriptions/my") return json({ subscriptions: [{ _id: "s1", status: "active", plan: "premium", billingCycle: "annual", startDate: new Date().toISOString(), addressId: "a-new" }] });
    if (p === "/api/auth/otp/email/start" && m === "POST") {
      state.emailCodes = [...(state.emailCodes || []), JSON.parse(req.postData() || "{}")];
      return json({ ok: true, emailMasked: "da•••@mailbox.org", resendAfterSeconds: 30, expiresInSeconds: 600 });
    }
    if (p === "/api/auth/otp/email/verify" && m === "POST") {
      const body = JSON.parse(req.postData() || "{}");
      state.emailVerifies = [...(state.emailVerifies || []), body];
      state.me = { ...state.me, email: body.email, emailVerified: true };
      return json({ status: "attached", user: state.me });
    }
    if (p.startsWith("/api/recent-work")) return json({ photos: [], page: 1, limit: 24, total: 0, hasMore: false });
    if (p === "/api/referrals/claim" && m === "POST") return state.failClaim ? json({ message: "down" }, 503) : json({ recorded: false, reason: "no_code" });
    if (m !== "GET") state.unexpected.push(`${m} ${p}`);
    return json([]);
  });
  const page = await ctx.newPage();
  const errors = [];
  page.on("pageerror", (e) => errors.push(e.message));
  page.on("framenavigated", (f) => {
    if (f === page.mainFrame()) state.urls.push(f.url());
  });
  return { ctx, page, state, errors };
}

const shot = async (page, name) => {
  if (SHOTS) await page.screenshot({ path: `${SHOTS}/${name}.png` }).catch(() => {});
};
const visible = (page, sel) => page.locator(sel).first().isVisible().catch(() => false);
const steps = (page) => page.evaluate(() => window.__steps || []);
const rect = (page, sel) => page.evaluate((s) => {
  const el = document.querySelector(s);
  if (!el) return null;
  const r = el.getBoundingClientRect();
  return { top: r.top, bottom: r.bottom, left: r.left, right: r.right, width: r.width, height: r.height };
}, sel);
const overlaps = (a, b) => a && b && !(a.right <= b.left || b.right <= a.left || a.bottom <= b.top || b.bottom <= a.top);
const screenOf = (page) => page.getAttribute("[data-welcome]", "data-screen");
const pathOf = (page) => page.getAttribute("[data-welcome]", "data-path");
const cont = (page) => page.click(".wf-continue");

async function fillAddress(page, zip = "11735") {
  await page.fill('[data-welcome] input[placeholder="Street address"]', "12 Elm St");
  await page.fill('[data-welcome] input[placeholder="City"]', "Farmingdale");
  await page.fill('[data-welcome] input[placeholder="ZIP"]', zip);
  await page.locator('[data-welcome] input[placeholder="ZIP"]').blur();
  await page.waitForTimeout(400);
}

async function main() {
  const browser = await chromium.launch();
  try {
    /* ------------------------------------------------ the first screen */
    {
      const { ctx, page, state, errors } = await open(browser);
      await page.goto(BASE + "/?utm_source=fb&utm_medium=paid&fbclid=abc", { waitUntil: "networkidle" });
      await shot(page, "01-choice-390");
      const attr = await page.evaluate(() => document.documentElement.getAttribute("data-pf-welcome"));
      check("a new ad visitor on / gets the welcome entry (decided before paint)", attr === "1");
      check("the current homepage is hidden behind it", !(await visible(page, ".hm-gate")));
      const h1 = (await page.locator("[data-welcome] h1").allInnerTexts()).map((t) => t.trim());
      check("exactly one heading: I’m looking for…", h1.length === 1 && h1[0] === "I’m looking for…", JSON.stringify(h1));
      const picks = (await page.locator(".wf-pick").allInnerTexts()).map((t) => t.trim());
      check("exactly two answers, membership first", JSON.stringify(picks) === JSON.stringify(["A handyman membership", "A one-time visit"]), JSON.stringify(picks));
      const body = await page.locator(".wf-main").innerText();
      check("no prices, descriptions or steps on the first screen: just the question", body.replace(/\s+/g, " ").trim() === "I’m looking for…", body);
      const head = await rect(page, ".wf-head");
      const title = await rect(page, "[data-welcome] .wf-title");
      check("the question sits directly under the header (2026-11-20)", head && title && title.top - head.bottom < 40, JSON.stringify({ head, title }));
      check("the two answers are in the bottom bar", (await page.locator(".wf-bar .wf-pick").count()) === 2);
      check("no progress bar and no footer", !(await visible(page, ".bk-steps")) && !(await visible(page, "footer, .ft")));
      check("logo top left", Boolean(await rect(page, ".wf-head .hd__brand")) && (await rect(page, ".wf-head .hd__brand")).left < 60);
      const login = await page.locator(".wf-head a[href='/signin']").innerText().catch(() => "");
      const menu = await rect(page, ".wf-head .hd__menu");
      check("Log in and Menu top right", login.trim() === "Log in" && menu && menu.right > 300, `${login} ${JSON.stringify(menu)}`);
      const call = await rect(page, ".pf-call");
      const chat = await rect(page, "[data-support-chat] > button");
      const picksRect = await rect(page, ".wf-picks");
      check("the call and chat buttons are there", Boolean(call) && Boolean(chat));
      check("neither covers an answer", !overlaps(call, picksRect) && !overlaps(chat, picksRect), JSON.stringify({ call, chat, picksRect }));
      check("the answers sit in the lower half, in thumb reach", picksRect && picksRect.top > 844 * 0.82 * 0.45, JSON.stringify(picksRect));
      check("welcome_shown counted", (await steps(page)).includes("welcome_shown"));
      check("no request to any outside host (trackers off on a local build)", state.outside.length === 0, state.outside.join(","));
      check("no page errors", errors.length === 0, errors.join(" | "));

      // The logo: the current homepage, remembered.
      await page.click(".wf-head .hd__brand");
      await page.waitForTimeout(300);
      check("the logo shows the current homepage at once", await visible(page, ".hm-gate"));
      check("the welcome is gone", !(await visible(page, "[data-welcome]")));
      check("welcome_exit_home counted", (await steps(page)).includes("welcome_exit_home"));
      check("the choice is remembered", (await page.evaluate(() => localStorage.getItem("pf_welcome"))) === "home");
      await page.reload({ waitUntil: "networkidle" });
      check("a reload keeps the homepage", (await visible(page, ".hm-gate")) && !(await visible(page, "[data-welcome]")));
      await ctx.close();
    }

    /* ------------------------------------------------ who never sees it */
    {
      const { ctx, page } = await open(browser, { me: ME });
      await page.goto(BASE + "/", { waitUntil: "networkidle" });
      check("signed in: no welcome", !(await visible(page, "[data-welcome]")));
      await ctx.close();
    }
    {
      const { ctx, page } = await open(browser);
      await page.goto(BASE + "/#faq", { waitUntil: "networkidle" });
      check("a #section link: the homepage", !(await visible(page, "[data-welcome]")));
      await page.goto(BASE + "/membership/plans", { waitUntil: "networkidle" });
      check("a direct link to another page is untouched", !(await visible(page, "[data-welcome]")));
      await ctx.close();
    }
    {
      const { ctx, page } = await open(browser, { ua: "Mozilla/5.0 (compatible; Googlebot/2.1; +http://www.google.com/bot.html)" });
      await page.goto(BASE + "/", { waitUntil: "networkidle" });
      check("a crawler gets the homepage", (await visible(page, ".hm-gate")) && !(await visible(page, "[data-welcome]")));
      await ctx.close();
    }
    {
      const { ctx, page } = await open(browser, { welcome: false });
      await page.goto(BASE + "/", { waitUntil: "networkidle" });
      check("automation without the opt-in: the homepage (its own suites keep testing it)", await visible(page, ".hm-gate"));
      await ctx.close();
    }

    /* ------------------------------------------------ one-time path */
    {
      const { ctx, page, state, errors } = await open(browser, { takenTime: SCHEDULE[0] });
      await page.goto(BASE + "/", { waitUntil: "networkidle" });
      await page.click("[data-pick='one_time']");
      await page.waitForTimeout(200);
      await shot(page, "02-nudge");
      check("one-time: the nudge", (await screenOf(page)) === "nudge");
      const nudgeText = (await page.locator(".wf-main").innerText()).replace(/\s+/g, " ").trim();
      check("the nudge copy, exactly, under the header, then Continue with one visit", nudgeText === "Members can book as many visits as they need. Continue with one visit", nudgeText);
      const nudgeBar = (await page.locator(".wf-bar .wf-pick").allInnerTexts()).map((t) => t.trim());
      check("only Show me membership in the bottom bar", JSON.stringify(nudgeBar) === JSON.stringify(["Show me membership"]), JSON.stringify(nudgeBar));
      const alt = await rect(page, "[data-pick='nudge-one-time']");
      const sentence = await rect(page, "[data-welcome] .wf-title");
      check("Continue with one visit sits right under the sentence, at the top (owner, 2026-11-20)", alt && sentence && alt.top - sentence.bottom < 40 && alt.top < 844 * 0.82 * 0.4, JSON.stringify({ alt, sentence }));
      check("Show me membership is the primary blue button", await page.locator("[data-pick='nudge-membership']").evaluate((el) => el.classList.contains("wf-pick--primary")));
      const second = await page.locator("[data-pick='nudge-one-time']").evaluate((el) => { const cs = getComputedStyle(el); const r = el.getBoundingClientRect(); return { border: cs.borderTopColor, h: r.height, visible: cs.visibility === "visible" && cs.opacity === "1" }; });
      check("Continue with one visit: clearly visible, a full-size target", second.visible && second.h >= 44 && second.border !== "rgba(0, 0, 0, 0)", JSON.stringify(second));
      check("the step slid in forward", (await page.getAttribute(".wf-step", "data-dir")) === "fwd");
      await page.click("[data-pick='nudge-membership']");
      await page.waitForTimeout(200);
      check("Show me membership: the membership flow, the calendar first", (await screenOf(page)) === "time" && (await pathOf(page)) === "membership");
      await page.goBack();
      await page.waitForTimeout(200);
      check("browser Back returns to the nudge, sliding back", (await screenOf(page)) === "nudge" && (await page.getAttribute(".wf-step", "data-dir")) === "back");
      await page.click("[data-pick='nudge-one-time']");
      await page.waitForTimeout(200);
      check("Continue with one visit: the one-time flow, the calendar first", (await screenOf(page)) === "time" && (await pathOf(page)) === "one_time");
      const st = await steps(page);
      check("taps and nudge choices counted", ["welcome_tap_one_time", "welcome_nudge_membership", "welcome_nudge_one_time"].every((s) => st.includes(s)), st.join(","));
      check("the hidden homepage underneath counts nothing of its own", !st.includes("booking_page_view") && !st.includes("slot_selected"), st.join(","));

      await page.waitForSelector("[data-welcome] [data-slot-picker] .bk-time", { timeout: 8000 });
      check("the real calendar first, with what happens next", (await screenOf(page)) === "time" && /confirm it is still open after your address/i.test(await page.locator("[data-time-note]").innerText()));
      await shot(page, "03-time");

      // The calendar scrolls; the bar stays.
      await page.mouse.wheel(0, 600);
      await page.waitForTimeout(200);
      const barRect = await rect(page, ".wf-bar");
      const vh = await page.evaluate(() => window.innerHeight);
      check("the Continue bar stays at the bottom while the page scrolls", barRect && barRect.bottom <= vh / 0.82 + 2 && barRect.bottom > vh * 0.8, JSON.stringify({ barRect, vh }));
      const contRect = await rect(page, ".wf-continue");
      const backRect = await rect(page, ".wf-back");
      check("Continue is wide and on the right; Back small on the left", contRect && backRect && contRect.left > backRect.right && contRect.width > backRect.width * 3);
      const callRect = await rect(page, ".pf-call");
      const chatRect = await rect(page, "[data-support-chat] > button");
      check("call and chat never cover Continue", !overlaps(callRect, contRect) && !overlaps(chatRect, contRect), JSON.stringify({ callRect, chatRect, contRect }));

      // Choosing a time holds nothing: it is tentative until the address is in.
      await page.locator(`[data-welcome] .bk-time[data-time='${SCHEDULE[0]}']`).first().click().catch(() => undefined);
      await cont(page);
      await page.waitForTimeout(400);
      check("the address next, the time tentative: nothing held", (await screenOf(page)) === "address" && state.holds.length === 0, String(state.holds.length));
      check("the address screen names the chosen time, with Change", /For .+\. Change/.test((await page.locator("[data-address-note]").innerText()).replace(/\s+/g, " ")));
      // Address: out of area first.
      await fillAddress(page, "10001");
      await cont(page);
      await page.waitForTimeout(200);
      check("an address outside the area stays on the address screen", (await screenOf(page)) === "address");
      await fillAddress(page, "11735");
      await cont(page);
      await page.waitForTimeout(400);
      check("address accepted and the time re-checked: the job comes next", (await screenOf(page)) === "job" && state.holds.length === 0, String(state.holds.length));
      const jobText = await page.locator(".wf-main").innerText();
      check("the job screen says what a visit is and asks for photos briefly", /up to 90 minutes/i.test(jobText) && /Photos help us come prepared\./.test(jobText));

      await page.fill("#wf-task", "Fix the sticking back door");
      // A reload mid-flow keeps the screen and the answer.
      await page.reload({ waitUntil: "networkidle" });
      await page.waitForTimeout(300);
      check("a reload keeps the screen and what was typed", (await screenOf(page)) === "job" && (await page.inputValue("#wf-task")) === "Fix the sticking back door");
      await cont(page);
      await page.waitForTimeout(200);
      check("contact next", (await screenOf(page)) === "contact");
      const tokens = await page.evaluate(() => Array.from(document.querySelectorAll(".wf-form input")).map((i) => `${i.name}:${i.getAttribute("autocomplete")}:${i.getAttribute("enterkeyhint")}`));
      check("one form, native autofill tokens, keyboard Next/Done", JSON.stringify(tokens) === JSON.stringify(["name:name:next", "phone:tel-national:next", "email:email:done"]), JSON.stringify(tokens));

      // Keyboard open: the chat launcher steps aside, Continue stays reachable.
      await page.focus("input[name='name']");
      await page.evaluate(() => document.documentElement.setAttribute("data-keyboard", "open"));
      await page.waitForTimeout(100);
      const chatVis = await page.evaluate(() => {
        const b = document.querySelector("[data-support-chat] > button");
        return b ? getComputedStyle(b).visibility : "none";
      });
      const callVis = await page.evaluate(() => {
        const b = document.querySelector(".pf-call");
        return b ? getComputedStyle(b).visibility + "/" + getComputedStyle(b).display : "none";
      });
      check("keyboard open: chat launcher hidden", chatVis === "hidden" || chatVis === "none", chatVis);
      check("keyboard open: call button hidden", /hidden|none/.test(callVis), callVis);
      check("keyboard open: Continue still on screen", await page.locator(".wf-continue").isVisible());
      check("keyboard open: call and chat stay one tap away, in the bar", (await page.locator(".wf-bar [data-bar-call]").isVisible()) && (await page.locator(".wf-bar [data-bar-chat]").isVisible()));
      const barIcons = await rect(page, ".wf-bar [data-bar-chat]");
      const nameField = await rect(page, "input[name='name']");
      check("keyboard open: nothing covers the field being typed in", !overlaps(barIcons, nameField), JSON.stringify({ barIcons, nameField }));
      await page.evaluate(() => document.documentElement.removeAttribute("data-keyboard"));

      await page.fill("input[name='name']", "Sam Rivera");
      await page.fill("input[name='phone']", "(516) 555-0177");
      await page.fill("input[name='email']", "sam@mailbox.org");
      // Going on to the price holds the time; it was taken meanwhile.
      await cont(page);
      await page.waitForTimeout(500);
      const errText = await page.locator("[data-welcome] .bk-error").first().innerText().catch(() => "");
      check("held only on the way to the price; taken meanwhile: back to the calendar, told why", state.holds.length === 1 && (await screenOf(page)) === "time" && /taken/i.test(errText), `${state.holds.length} ${errText}`);
      await page.locator(`[data-welcome] .bk-time[data-time='${SCHEDULE[1]}']`).first().click();
      await cont(page);
      await page.waitForTimeout(300);
      check("another time, then the address again, still filled in", (await screenOf(page)) === "address");
      await cont(page);
      await page.waitForTimeout(400);
      check("another time: the job is still there", (await screenOf(page)) === "job" && (await page.inputValue("#wf-task")) === "Fix the sticking back door");
      await cont(page);
      await page.waitForTimeout(200);
      check("the details are still there", (await screenOf(page)) === "contact" && (await page.inputValue("input[name='email']")) === "sam@mailbox.org");
      await cont(page);
      await page.waitForTimeout(400);
      check("one-time review next, the new time held", (await screenOf(page)) === "review" && state.holds.length === 2 && state.holds[1].requestedTime === SCHEDULE[1]);
      await shot(page, "04-review");
      const review = await page.locator(".wf-main").innerText();
      check("review: the visit, $99, 90 minutes, owner review, consent", /One-Time Visit/.test(review) && /\$99/.test(review) && /90 minutes/.test(review) && /review every visit request/i.test(review) && /By booking, you agree/.test(review), review.slice(0, 300));
      check("the welcome flow never promises the same handyman", !/same (local )?(team|handyman|technician)|dedicated handyman|personal handyman/i.test(review));
      // Back keeps answers.
      await page.click(".wf-back");
      await page.waitForTimeout(200);
      check("Back returns with the answers kept", (await screenOf(page)) === "contact" && (await page.inputValue("input[name='email']")) === "sam@mailbox.org");
      await cont(page);
      await page.waitForTimeout(200);
      await page.click(".wf-continue");
      await page.waitForURL(/checkout\.stripe\.test/, { timeout: 8000 }).catch(() => undefined);
      const g = state.guest[0] || {};
      check("the existing guest checkout, once", state.guest.length === 1, String(state.guest.length));
      check("it returns to the welcome flow if canceled, and carries the visitor id", g.returnTo === "welcome" && /^v_/.test(g.visitorId || ""), JSON.stringify(g));
      check("the consent text and details travel; the held time is used", Boolean(g.consentText) && g.phone === "5165550177" && g.holdToken && g.requestedTime === SCHEDULE[1], JSON.stringify(g));
      const leaked = state.urls.filter((u) => /Sam|Rivera|mailbox|5550177|sticking/i.test(decodeURIComponent(u)));
      check("no answer ever in a URL", leaked.length === 0, leaked.join(" "));
      check("no request to any outside host", state.outside.length === 0, state.outside.join(","));
      check("no page errors", errors.length === 0, errors.join(" | "));
      await ctx.close();
    }

    /* ------------------------------------------------ taken while typing the address (2026-11-20) */
    {
      const { ctx, page, state, errors } = await open(browser);
      await page.goto(BASE + "/start", { waitUntil: "networkidle" });
      await page.click("[data-pick='one_time']");
      await page.click("[data-pick='nudge-one-time']");
      await page.waitForSelector("[data-welcome] [data-slot-picker] .bk-time", { timeout: 8000 });
      await page.locator(`[data-welcome] .bk-time[data-time='${SCHEDULE[3]}']`).first().click();
      await cont(page);
      await page.waitForTimeout(300);
      state.slotGone = SCHEDULE[3];
      await fillAddress(page, "11735");
      await cont(page);
      await page.waitForTimeout(500);
      const msg = await page.locator("[data-welcome] .bk-error").first().innerText().catch(() => "");
      check("taken meanwhile: back to the calendar, told why, the address saved", (await screenOf(page)) === "time" && /taken/i.test(msg) && /address/i.test(msg), msg);
      await page.locator(`[data-welcome] .bk-time[data-time='${SCHEDULE[2]}']`).first().click();
      await cont(page);
      await page.waitForTimeout(300);
      const kept = await page.locator('[data-welcome] input[placeholder="Street address"]').inputValue().catch(() => "");
      check("another time, then the address is still filled in", (await screenOf(page)) === "address" && /12 Elm St/.test(kept), kept);
      await cont(page);
      await page.waitForTimeout(400);
      check("…and on to the job", (await screenOf(page)) === "job");
      check("no page errors", errors.length === 0, errors.join(" | "));
      await ctx.close();
    }
    {
      const { ctx, page } = await open(browser);
      await page.emulateMedia({ reducedMotion: "reduce" });
      await page.goto(BASE + "/start", { waitUntil: "networkidle" });
      await page.click("[data-pick='membership']");
      await page.waitForTimeout(100);
      const anim = await page.locator(".wf-step").evaluate((el) => getComputedStyle(el).animationName);
      check("reduced motion: screens change without the slide", anim === "none", anim);
      await ctx.close();
    }
    {
      const { ctx, page } = await open(browser);
      await page.goto(BASE + "/start", { waitUntil: "networkidle" });
      let loads = 0;
      page.on("load", () => (loads += 1));
      const head = await page.locator(".wf-head").evaluate((el) => el.getBoundingClientRect().top);
      await page.click("[data-pick='one_time']");
      await page.waitForTimeout(80);
      const mid = await page.locator(".wf-step").evaluate((el) => getComputedStyle(el).animationName);
      const headAfter = await page.locator(".wf-head").evaluate((el) => el.getBoundingClientRect().top);
      const barBottom = await page.locator(".wf-bar").evaluate((el) => Math.round(el.getBoundingClientRect().bottom));
      await page.click("[data-pick='nudge-one-time']");
      await page.waitForTimeout(400);
      check("a screen change is a short slide-in, not a page load; the header holds still", /wf-in-fwd/.test(mid) && loads === 0 && head === headAfter, `${mid} loads=${loads}`);
      check("the bar stays on the bottom edge across screens", Math.abs((await page.locator(".wf-bar").evaluate((el) => Math.round(el.getBoundingClientRect().bottom))) - barBottom) <= 1);
      await ctx.close();
    }

    /* ------------------------------------------------ membership path */
    {
      const { ctx, page, state, errors } = await open(browser);
      await page.goto(BASE + "/start", { waitUntil: "networkidle" });
      const robots = await page.getAttribute("meta[name='robots']", "content");
      const canonical = await page.getAttribute("link[rel='canonical']", "href");
      check("/start: noindex, canonical the homepage", /noindex/.test(robots || "") && /^https:\/\/www\.profixter\.com\/?$/.test(canonical || ""), `${robots} ${canonical}`);
      await page.click("[data-pick='membership']");
      await page.waitForSelector("[data-welcome] [data-slot-picker] .bk-time", { timeout: 8000 });
      check("membership: the calendar first", (await screenOf(page)) === "time");
      await page.locator(`[data-welcome] .bk-time[data-time='${SCHEDULE[2]}']`).first().click();
      await cont(page);
      await page.waitForTimeout(300);
      await fillAddress(page);
      await cont(page);
      await page.waitForTimeout(400);
      await page.fill("#wf-task", "Mount a TV and patch two holes");
      await cont(page);
      await page.fill("input[name='name']", "Dana Lopez");
      await page.fill("input[name='phone']", "5165550123");
      await page.fill("input[name='email']", "dana@mailbox.org");
      await cont(page);
      await page.waitForTimeout(300);
      check("membership: plans after the details, before verification", (await screenOf(page)) === "plans");
      await shot(page, "05-plans");
      const plans = await page.locator(".wf-plan").allInnerTexts();
      const paces = await page.locator(".wf-plan [data-plan-pace]").allInnerTexts();
      check("the four existing plans and prices", plans.length === 4 && /\$149/.test(plans[0]) && /\$249/.test(plans[1]) && /\$349/.test(plans[2]) && /\$499/.test(plans[3]), JSON.stringify(plans));
      check("each plan shows its limit on visits booked at once", JSON.stringify(paces) === JSON.stringify(["Book 1 visit at a time", "Book up to 2 visits at a time", "Book up to 2 visits at a time", "Book up to 2 visits at a time"]), JSON.stringify(paces));
      const plansText = await page.locator(".wf-main").innerText();
      check("no same-handyman promise in the plans", !/same (local )?(team|handyman|technician)|dedicated|personal handyman/i.test(plansText));
      await page.click("[data-cycle='annual']");
      check("annual prices", /\$1,490/.test(await page.locator(".wf-plan").first().innerText()));
      await page.click("[data-plan='premium']");
      check("plans_view counted", (await steps(page)).includes("welcome_plans_view"));
      check("nothing held while choosing a time and a plan", state.holds.length === 0, String(state.holds.length));
      await cont(page);
      await page.waitForURL(/\/signup/, { timeout: 8000 });
      check("the time is held as they go to verify their phone", state.holds.length === 1 && state.holds[0].requestedTime === SCHEDULE[2], JSON.stringify(state.holds));
      const url = new URL(page.url());
      check("verification: the existing passwordless sign-up, back to /start?resume=pay", url.searchParams.get("next") === "/start?resume=pay", page.url());
      await page.waitForTimeout(500);
      const phone = await page.inputValue("input[type='tel']").catch(() => "");
      check("the number is already filled in", /516/.test(phone) && /0123/.test(phone), phone);
      const draft = await page.evaluate(() => JSON.parse(localStorage.getItem("pf_handyman_draft") || "{}"));
      check("the plan, time and job travel in the draft", draft.plan === "premium" && draft.cycle === "annual" && draft.time === SCHEDULE[2] && /TV/.test(draft.task), JSON.stringify({ plan: draft.plan, cycle: draft.cycle, time: draft.time }));
      check("no page errors", errors.length === 0, errors.join(" | "));

      // Signed in now by phone code, as the sign-up page leaves a new account: a verified phone, no name, no email.
      state.me = { ...ME, name: "", email: "", emailVerified: false };
      // A friend's referral the browser still holds (the claim failed): the checkout must carry it (2026-11-20).
      state.failClaim = true;
      await page.evaluate(() => {
        localStorage.setItem("token", "ui-token");
        localStorage.setItem("pf_referral", JSON.stringify({ code: "maria-7k2m", capturedAt: new Date().toISOString() }));
      });
      await page.goto(BASE + "/start?resume=pay", { waitUntil: "networkidle" });
      await page.waitForTimeout(500);
      check("back from sign-up: the payment screen", (await screenOf(page)) === "pay");
      check("the query is cleaned from the address bar", !/resume/.test(page.url()));
      await shot(page, "06-pay");
      const tabbar = await visible(page, ".csn");
      const payBar = await rect(page, ".wf-continue");
      check("signed in: the customer tab bar steps aside, nothing covers Continue", !tabbar && payBar && payBar.bottom <= (await page.evaluate(() => window.innerHeight)) / 0.82 + 2, JSON.stringify(payBar));
      const pay = await page.locator(".wf-main").innerText();
      check("pay: the plan, its limit, the price and the first visit", /Premium membership/.test(pay) && /Book up to 2 visits at a time/.test(pay) && /\$3,490/.test(pay) && /Mount a TV/.test(pay), pay.slice(0, 300));
      // The email they typed, on the final screen, with Edit (2026-11-20).
      const receipt = await page.locator("[data-receipt-value]").innerText().catch(() => "");
      check("pay: the typed email is shown for receipts, with Edit", receipt === "dana@mailbox.org" && (await visible(page, "[data-receipt-edit]")), receipt);
      await page.click("[data-receipt-edit]");
      await page.fill("#wf-receipt-email", "dana.lopez@mailbox");
      await page.click("[data-receipt-save]");
      check("Edit: a malformed email is refused in place", /valid email/.test(await page.locator("[data-receipt-email] .bk-error").innerText().catch(() => "")));
      await page.fill("#wf-receipt-email", "dana.lopez@mailbox.org");
      await page.click("[data-receipt-save]");
      await page.waitForTimeout(200);
      check("Edit: the corrected email is shown; nothing saved yet (the account has none)", (await page.locator("[data-receipt-value]").innerText().catch(() => "")) === "dana.lopez@mailbox.org" && state.contactEmail.length === 0);
      const editBox = await rect(page, "[data-receipt-edit]");
      check("Edit is a full tap target", editBox && editBox.height >= 43, JSON.stringify(editBox));
      await page.click(".wf-continue");
      await page.waitForURL(/checkout\.stripe\.test/, { timeout: 8000 }).catch(() => undefined);
      check("one code was enough: the typed name and email were saved, no email code asked", state.contactEmail.length === 1 && state.contactEmail[0] === "dana.lopez@mailbox.org" && state.names[0] === "Dana Lopez" && (await page.locator("[role='dialog']:visible").count()) === 0, JSON.stringify({ e: state.contactEmail, n: state.names }));
      const fv = state.firstVisit[0] || {};
      const mc = state.memberships[0] || {};
      check("the visit is saved on the server first (book-first)", fv.addressId === "a-new" && fv.requestedTime === SCHEDULE[2] && Boolean(fv.holdToken), JSON.stringify(fv));
      check("the existing membership checkout, returnTo welcome, with the first visit", mc.plan === "premium" && mc.billingCycle === "annual" && mc.returnTo === "welcome" && mc.firstVisit?.draftId === "fvd1", JSON.stringify(mc));
      check("the membership checkout carries the friend's referral (promotion codes stay on Stripe's page)", mc.referral?.code === "maria-7k2m", JSON.stringify(mc.referral || null));
      check("no request to any outside host", state.outside.length === 0, state.outside.join(","));

      // Back from Stripe without paying: the account now holds the typed (unconfirmed) email. Edit corrects it on the server.
      state.me = { ...state.me, email: "dana.lopez@mailbox.org", emailVerified: false };
      await page.goto(BASE + "/start?resume=pay", { waitUntil: "networkidle" });
      await page.waitForTimeout(400);
      check("back again: the account email is the one shown", (await page.locator("[data-receipt-value]").innerText().catch(() => "")) === "dana.lopez@mailbox.org");
      await page.click("[data-receipt-edit]");
      await page.fill("#wf-receipt-email", "dana.l@mailbox.org");
      await page.click("[data-receipt-save]");
      await page.waitForTimeout(400);
      check("Edit on an unconfirmed account email saves it at once, no code", state.contactEmail.at(-1) === "dana.l@mailbox.org" && (await page.locator("[data-receipt-value]").innerText().catch(() => "")) === "dana.l@mailbox.org" && (await page.locator("[role='dialog']:visible").count()) === 0, JSON.stringify(state.contactEmail));

      // A confirmed email changes with a code, in the usual sheet.
      state.me = { ...state.me, emailVerified: true };
      await page.goto(BASE + "/start?resume=pay", { waitUntil: "networkidle" });
      await page.waitForTimeout(400);
      await page.click("[data-receipt-edit]");
      await page.waitForTimeout(400);
      check("Edit on a confirmed email opens the code sheet instead", (await page.locator("[role='dialog']:visible").count()) === 1 && (await page.locator("#wf-receipt-email").count()) === 0);
      await ctx.close();
    }

    /* ------------------------------------------------ after purchase: confirm the email */
    {
      const { ctx, page, state } = await open(browser, { me: { ...ME, email: "dana.l@mailbox.org", emailVerified: false }, welcome: false });
      await page.goto(BASE + "/confirmationpage?session_id=cs_member", { waitUntil: "networkidle" });
      await page.waitForTimeout(1200);
      const offer = await page.locator("[data-confirm-email='offer']").innerText().catch(() => "");
      check("after purchase: offered to confirm the email, naming it", /Confirm your email/.test(offer) && /dana\.l@mailbox\.org/.test(offer), offer.slice(0, 160));
      await page.click("[data-confirm-email-start]");
      await page.waitForTimeout(400);
      const input = page.locator("[role='dialog'] input[type='email']");
      check("the code sheet starts with that address, still editable", (await input.inputValue().catch(() => "")) === "dana.l@mailbox.org");
      await page.locator("[role='dialog'] button[type='submit']").first().click();
      await page.waitForTimeout(500);
      check("a code is sent to it (attach mode, signed in)", state.emailCodes?.[0]?.email === "dana.l@mailbox.org" && state.emailCodes[0].mode === "attach", JSON.stringify(state.emailCodes));
      await page.locator("[role='dialog'] input[autocomplete='one-time-code']").first().fill("123456");
      await page.waitForTimeout(1200);
      const verified = state.emailVerifies?.[0];
      check("the code confirms it", verified?.code === "123456" && verified?.mode === "attach", JSON.stringify(verified));
      check("then: Email confirmed", (await page.locator("[data-confirm-email='done']").count()) === 1);
      await ctx.close();

      const confirmed = await open(browser, { me: { ...ME, email: "dana@mailbox.org", emailVerified: true }, welcome: false });
      await confirmed.page.goto(BASE + "/confirmationpage?session_id=cs_member", { waitUntil: "networkidle" });
      await confirmed.page.waitForTimeout(1200);
      check("an already confirmed email is not offered", (await confirmed.page.locator("[data-confirm-email]").count()) === 0 && /taken care of/.test(await confirmed.page.locator("main").innerText()));
      await confirmed.ctx.close();
    }

    /* ------------------------------------------------ canceled at Stripe */
    {
      const { ctx, page } = await open(browser);
      await page.goto(BASE + "/start", { waitUntil: "networkidle" });
      await page.evaluate(() => {
        localStorage.setItem("pf_handyman_draft", JSON.stringify({ task: "Fix the door please", address: { line1: "12 Elm St", city: "Farmingdale", state: "NY", zip: "11735" }, date: "2099-01-05", time: "10:30", name: "Sam Rivera", phone: "5165550177", email: "sam@mailbox.org", choice: "one_time", clientRequestId: "hbtest1", pendingBookingId: "b-guest-1", updatedAt: Date.now() }));
      });
      let abandoned = 0;
      await page.route("**/api/bookings/guest/abandon", (r) => {
        abandoned += 1;
        return r.fulfill({ status: 200, contentType: "application/json", headers: { "access-control-allow-origin": "*" }, body: "{\"released\":true}" });
      });
      await page.goto(BASE + "/start?canceled=1&booking_id=b-guest-1", { waitUntil: "networkidle" });
      await page.waitForTimeout(400);
      check("canceled at Stripe: back on the review, told nothing was charged", (await screenOf(page)) === "review" && /Nothing was charged/.test(await page.locator(".bk-banner").innerText().catch(() => "")));
      check("the held time is released by the press's own id", abandoned === 1, String(abandoned));
      await ctx.close();
    }

    /* ------------------------------------------------ desktop */
    {
      const { ctx, page } = await open(browser, { width: 1440, height: 900 });
      await page.goto(BASE + "/", { waitUntil: "networkidle" });
      await shot(page, "07-desktop");
      check("desktop: Menu shown, inline nav hidden", (await visible(page, ".wf-head .hd__menu")) && !(await visible(page, ".wf-head .hd__nav")));
      check("desktop: no sideways scroll", await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth + 1));
      await ctx.close();
    }

    /* ------------------------------------------------ trackers and the gift token */
    {
      const { ctx, page, state } = await open(browser, { welcome: false });
      await page.addInitScript(() => localStorage.setItem("pf_trackers_allow_host", "1"));
      const loaded = [];
      page.on("request", (r) => {
        const p = new URL(r.url()).pathname;
        if (p === "/__gtm-test.js" || p === "/__fbevents-test.js") loaded.push(p);
      });
      await page.goto(BASE + "/", { waitUntil: "networkidle" });
      check("test opt-in: the loaders run but fetch only same-origin test paths", loaded.includes("/__gtm-test.js") && loaded.includes("/__fbevents-test.js"), loaded.join(","));
      loaded.length = 0;
      await page.goto(BASE + "/gift/claim/tok_secret_value_123", { waitUntil: "networkidle" });
      const trackers = await page.evaluate(() => Boolean(window.__pfTrackers));
      check("/gift/claim/<token>: no tracker loads", !trackers && loaded.length === 0, loaded.join(","));
      const touch = await page.evaluate(() => localStorage.getItem("pf_touch") || "");
      check("the token is not kept as a landing page", !/tok_secret_value_123/.test(touch), touch);
      check("nothing reached an outside host", state.outside.length === 0, state.outside.join(","));
      await ctx.close();
    }
  } finally {
    await browser.close();
  }
  const passed = results.filter(Boolean).length;
  console.log(`\n${passed}/${results.length} passed`);
  if (passed !== results.length) process.exit(1);
}

if (require.main === module) {
  main().catch((error) => {
    console.error(error);
    process.exit(1);
  });
}
/* Shared with scripts/test_welcome_devices.js: the same mocked API and helpers. */
module.exports = { open, fillAddress, SCHEDULE, rect, overlaps, screenOf, visible };
