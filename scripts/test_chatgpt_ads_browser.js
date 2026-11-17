/* eslint-disable @typescript-eslint/no-require-imports -- a plain Node script, like its neighbours */
/*
 * What the ChatGPT Ads pixel actually receives in a real browser.
 *
 * NOTHING LEAVES THE MACHINE. bzrcdn.openai.com is either blocked (the SDK
 * "cannot load") or answered with a FAKE SDK that drains the documented stub
 * queue (window.oaiq.q) into window.__oaiqSent and records later calls there
 * too - standing in for a real SDK that loaded. bzr.openai.com is blocked.
 * Every /api/ call is answered by the mock below, as the BackEnd routes do;
 * Meta, GTM and Google Maps are blocked.
 *
 * So this proves what the site HANDS the pixel, and when. It does not prove
 * that OpenAI received anything: that is only shown by the ChatGPT Ads Event
 * Stream (Ads Manager > Conversions > Data Source > Test).
 *
 *   npm run build && npx next start -p 3187
 *   node scripts/test_chatgpt_ads_browser.js http://localhost:3187
 */
const { chromium } = require("playwright");

const BASE = process.argv[2] || "http://localhost:3000";
const PIXEL = "RTqbVHz1coRZKU6LyhJo3b";
const SESSION = "cs_test_a1B2c3D4e5F6g7H8i9J0";
const TOKEN = "chatgpt-ads-test-token";

const results = [];
function check(name, pass, detail) {
  results.push({ name, pass: !!pass });
  console.log(`${pass ? "PASS" : "FAIL"}  ${name}${detail ? "  :: " + detail : ""}`);
}

/* Records fbq without loading Meta (same trick as test_meta_browser.js). */
const FBQ_RECORDER = () => {
  window.__fbq_calls = [];
  window.fbq = function (...args) {
    window.__fbq_calls.push(args);
  };
  window._fbq = window.fbq;
  window.fbq.queue = [];
  window.fbq.loaded = true;
};

/* A stand-in SDK: takes over the queue like a loaded oaiq.min.js would. Nothing is sent anywhere. */
const FAKE_SDK = `(function(){var w=window;w.__oaiqSent=w.__oaiqSent||[];var q=(w.oaiq&&w.oaiq.q)||[];
for(var i=0;i<q.length;i++)w.__oaiqSent.push(JSON.parse(JSON.stringify(Array.prototype.slice.call(q[i]))));
w.oaiq=function(){w.__oaiqSent.push(JSON.parse(JSON.stringify(Array.prototype.slice.call(arguments))))};w.oaiq.q=[];})();`;

const ADDRESS = { _id: "a1", label: "Home", line1: "12 Elm St", city: "Farmingdale", state: "NY", zip: "11735", hasActiveSubscription: false, plan: null };
const USER = { _id: "u1", userId: "40000001", name: "Dana Lopez", email: "dana@mailbox.org", phone: "+15165550123", role: "customer", permissions: [], defaultAddressId: "a1", addresses: [ADDRESS] };
const SCHEDULE = ["08:00", "10:00", "13:00"];

function ymd(offset) {
  const [y, m, d] = new Date().toLocaleDateString("en-CA", { timeZone: "America/New_York" }).split("-").map(Number);
  return new Date(Date.UTC(y, m - 1, d + offset, 12)).toISOString().slice(0, 10);
}

/**
 * A browser context with every external call answered locally.
 *
 * opts.sdk: "load" (fake SDK loads), "block" (SDK cannot load), or a function
 *   returning either, read on every request (so a test can switch mid-run).
 * opts.signedIn: a token in localStorage and /api/auth/me answering USER.
 * opts.gpc: the browser sends Global Privacy Control.
 * opts.api: { "<METHOD> <path>": (state, req) => [status, body] } overrides.
 */
async function context(browser, opts = {}) {
  const ctx = await browser.newContext({ viewport: { width: 1280, height: 900 } });
  await ctx.addInitScript(FBQ_RECORDER);
  await ctx.addInitScript(
    ({ token, gpc }) => {
      try {
        if (token) localStorage.setItem("token", token);
        localStorage.setItem("profixter_promotion_popup_dismissed_date", new Date().toISOString().slice(0, 10));
      } catch {}
      if (gpc) Object.defineProperty(Navigator.prototype, "globalPrivacyControl", { get: () => true, configurable: true });
    },
    { token: opts.signedIn ? TOKEN : "", gpc: !!opts.gpc }
  );
  const sdkMode = () => (typeof opts.sdk === "function" ? opts.sdk() : opts.sdk || "load");
  const state = { sdkRequests: 0, posts: {}, me: opts.signedIn ? { ...USER } : null };
  await ctx.route("**bzrcdn.openai.com/**", (r) => {
    state.sdkRequests += 1;
    return sdkMode() === "load" ? r.fulfill({ status: 200, contentType: "application/javascript", body: FAKE_SDK }) : r.abort();
  });
  await ctx.route("**bzr.openai.com/**", (r) => r.abort());
  await ctx.route("**connect.facebook.net/**", (r) => r.abort());
  await ctx.route("**googletagmanager.com/**", (r) => r.abort());
  await ctx.route("**facebook.com/tr**", (r) => r.abort());
  await ctx.route(/maps\.googleapis\.com|places\.googleapis\.com/, (r) => r.abort());
  await ctx.route(/\/api\//, async (route) => {
    const req = route.request();
    const u = new URL(req.url());
    const p = u.pathname;
    const m = req.method();
    const cors = { "access-control-allow-origin": "*", "access-control-allow-headers": "Authorization,Content-Type", "access-control-allow-methods": "GET,POST,PUT,PATCH,DELETE,OPTIONS" };
    if (m === "OPTIONS") return route.fulfill({ status: 204, headers: cors });
    const json = (status, body) => route.fulfill({ status, contentType: "application/json", headers: cors, body: JSON.stringify(body) });
    const key = `${m} ${p}`;
    (state.posts[key] = state.posts[key] || []).push({ url: req.url(), body: req.postDataBuffer()?.toString("latin1") || "", auth: req.headers()["authorization"] || "" });
    const custom = opts.api && opts.api[key];
    if (custom) {
      const [status, body] = custom(state, req, u);
      return json(status, body);
    }
    const authed = (req.headers()["authorization"] || "") === `Bearer ${TOKEN}`;
    if (p === "/api/auth/me") return authed && state.me ? json(200, state.me) : json(401, { message: "No token" });
    if (p === "/api/calendar/config") return json(200, { timezone: "America/New_York", slotMinutes: 60, minLeadDays: 0, closedWeekdays: [], handymanCapacity: 1, defaultHours: [], overrides: {}, holidays: [], engine: "reservation", visitDurationMinutes: 90, maxAdvanceDays: 62 });
    if (p === "/api/calendar/month") {
      const month = u.searchParams.get("month");
      const days = [];
      for (let i = 2; i < 60; i++) {
        const d = ymd(i);
        if (!d.startsWith(month)) continue;
        days.push({ date: d, open: true, available: true, availableSlotCount: 3, slotCount: 3, slots: SCHEDULE.map((time) => ({ time, available: true })), candidateSlots: SCHEDULE.map((time) => ({ time, available: true })), taken: {}, remaining: Object.fromEntries(SCHEDULE.map((t) => [t, 1])), capacityPerSlot: 1 });
      }
      return json(200, { month, engine: "reservation", visitDurationMinutes: 90, days });
    }
    if (p === "/api/calendar/slots") {
      const date = u.searchParams.get("date");
      return json(200, { date, available: true, availableSlotCount: 3, slots: SCHEDULE.map((time) => ({ time, available: true })), candidateSlots: SCHEDULE.map((time) => ({ time, available: true })), taken: {}, remaining: Object.fromEntries(SCHEDULE.map((t) => [t, 1])), capacityPerSlot: 1 });
    }
    if (p === "/api/service-area/check") return json(200, { serviceable: true });
    if (p === "/api/bookings/next") return json(200, { hasSubscription: false, freeFirstVisitAvailable: true, introVisitStatus: "available", introVisitServiceable: true, bookingLimit: 1, activeCount: 0, activeBookings: [], future: null });
    if (p.startsWith("/api/track/")) return route.fulfill({ status: p.includes("-by-session") ? 404 : 204, headers: cors, contentType: "application/json", body: p.includes("-by-session") ? '{"ok":false}' : "" });
    if (p.startsWith("/api/recent-work")) return json(200, { photos: [], page: 1, limit: 24, total: 0, hasMore: false });
    return json(200, []);
  });
  const page = await ctx.newPage();
  const errors = [];
  page.on("pageerror", (e) => errors.push(e.message));
  return { ctx, page, state, errors };
}

/* Everything handed to the pixel on this page: still queued, plus taken by the fake SDK. */
const handed = (page) =>
  page.evaluate(() => {
    const q = window.oaiq && window.oaiq.q ? Array.from(window.oaiq.q, (a) => JSON.parse(JSON.stringify(Array.from(a)))) : [];
    return [...(window.__oaiqSent || []), ...q];
  });
const measures = async (page, name) => (await handed(page)).filter((c) => c[0] === "measure" && c[1] === name);
const fbq = (page) => page.evaluate(() => window.__fbq_calls || []);
const metaTrack = async (page, name) => (await fbq(page)).filter((c) => c[0] === "track" && c[1] === name);

async function go(page, path, settle = 2500) {
  await page.goto(BASE + path, { waitUntil: "domcontentloaded", timeout: 60000 });
  await page.waitForTimeout(settle);
}
const field = (body, name) => (body.match(new RegExp(`name="${name}"\\r\\n\\r\\n([^\\r]*)`)) || [])[1];

(async () => {
  const browser = await chromium.launch();

  /* ======================= install + page views ======================= */
  {
    const { ctx, page } = await context(browser);
    await go(page, "/");
    const all = await handed(page);
    const inits = all.filter((c) => c[0] === "init");
    check("one init on the homepage", inits.length === 1, JSON.stringify(inits));
    check("init uses the Profixter pixel id", inits[0]?.[1]?.pixelId === PIXEL);
    check("debug is off in a production build", inits[0]?.[1]?.debug === undefined);
    const views = await measures(page, "page_viewed");
    check("one page_viewed on load, contents shape", views.length === 1 && views[0]?.[2]?.type === "contents" && views[0]?.[2]?.contents?.[0]?.id === "/", JSON.stringify(views));
    check("loader is installed exactly once", (await page.evaluate(() => document.querySelectorAll("#oaiq-pixel").length)) === 1);
    const target = await page.evaluate(() => {
      const a = Array.from(document.querySelectorAll('a[href^="/"]')).find((el) => /^\/(about|projects|membership\/plans|services)(\/|$|\?)/.test(el.getAttribute("href") || ""));
      if (!a) return null;
      a.click();
      return a.getAttribute("href");
    });
    await page.waitForTimeout(3000);
    const after = await measures(page, "page_viewed");
    const path = await page.evaluate(() => location.pathname);
    check("client-side navigation sends one more page_viewed for the new path", !!target && after.length === 2 && after[1]?.[2]?.contents?.[0]?.id === path, `link=${target} path=${path} views=${after.length}`);
    check("navigation does not re-init the pixel", (await handed(page)).filter((c) => c[0] === "init").length === 1);
    await ctx.close();
  }

  /* ======================= excluded pages ======================= */
  for (const path of ["/admin", "/event", "/team-setup", "/set-password", "/pay/abc123token", "/tip?t=abc"]) {
    const { ctx, page, state } = await context(browser);
    await go(page, path, 2000);
    check(`no pixel on ${path}`, (await page.evaluate(() => typeof window.oaiq)) === "undefined" && state.sdkRequests === 0);
    await ctx.close();
  }

  /* ======================= Global Privacy Control ======================= */
  {
    const { ctx, page, state } = await context(browser, { gpc: true });
    await go(page, "/");
    check("GPC: the ChatGPT pixel never loads (no stub, no SDK request)", (await page.evaluate(() => typeof window.oaiq)) === "undefined" && state.sdkRequests === 0);
    const metaInit = (await fbq(page)).filter((c) => c[0] === "init");
    check("GPC: Meta behaviour is unchanged (still initialised, as before)", metaInit.length === 1);
    await ctx.close();
  }
  {
    // A confirmed paid visit under GPC: no conversion, and the proof is never even requested.
    const { ctx, page, state } = await context(browser, {
      gpc: true,
      signedIn: true,
      api: { [`GET /api/track/paid-visit-by-session`]: () => [200, { ok: true, product: "one_time_visit", amountCents: 9900, currency: "USD" }] },
    });
    await go(page, `/book/confirmation?booking_id=b1&session_id=${SESSION}`, 4000);
    check("GPC: no order_created and no proof request", (await page.evaluate(() => typeof window.oaiq)) === "undefined" && !(state.posts["GET /api/track/paid-visit-by-session"] || []).length);
    await ctx.close();
  }

  /* ======================= order_created ======================= */
  const visitProof = (status = 200, body = { ok: true, product: "one_time_visit", amountCents: 9900, currency: "USD" }) => ({ "GET /api/track/paid-visit-by-session": () => [status, body] });
  {
    const { ctx, page, state } = await context(browser, { signedIn: true, api: visitProof() });
    await go(page, `/book/confirmation?booking_id=b1&session_id=${SESSION}`, 4000);
    const orders = await measures(page, "order_created");
    const o = orders[0] || [];
    check("paid visit: one order_created", orders.length === 1, JSON.stringify(orders));
    check("order_created: cents, USD, contents shape, session event_id", o[2]?.type === "contents" && o[2]?.amount === 9900 && o[2]?.currency === "USD" && o[2]?.contents?.[0]?.quantity === 1 && o[3]?.event_id === `sess_${SESSION}`, JSON.stringify(o));
    const proofCalls = state.posts["GET /api/track/paid-visit-by-session"] || [];
    check("the proof request carries the customer's sign-in", proofCalls.length >= 1 && proofCalls[0].auth === `Bearer ${TOKEN}`);
    check("Meta Purchase still fires on the same page", (await metaTrack(page, "Purchase")).length === 1);
    await go(page, `/book/confirmation?booking_id=b1&session_id=${SESSION}`, 4000);
    check("refresh after delivery: no second order_created", (await measures(page, "order_created")).length === 0);
    const tab = await ctx.newPage();
    await go(tab, `/book/confirmation?booking_id=b1&session_id=${SESSION}`, 4000);
    check("second tab after delivery: no second order_created", (await measures(tab, "order_created")).length === 0);
    await ctx.close();
  }
  {
    const { ctx, page } = await context(browser, { signedIn: true, api: visitProof(404, { ok: false }) });
    await go(page, `/book/confirmation?booking_id=b1&session_id=${SESSION}`, 25000);
    check("unpaid / refunded / someone else's session: no order_created", (await measures(page, "order_created")).length === 0);
    await ctx.close();
  }
  {
    const { ctx, page, state } = await context(browser, { signedIn: false, api: visitProof() });
    await go(page, `/book/confirmation?booking_id=b1&session_id=${SESSION}`, 4000);
    check("signed out: no proof request, no order_created", !(state.posts["GET /api/track/paid-visit-by-session"] || []).length && (await measures(page, "order_created")).length === 0);
    const parked = await page.evaluate(() => localStorage.getItem("pf_oaiq_pending") || "");
    check("signed out: the Stripe session is parked for after sign-in", parked.includes(SESSION) && parked.includes('"order"'), parked);
    // The owner signs in on this browser and moves on to another page.
    await page.evaluate((t) => localStorage.setItem("token", t), TOKEN);
    state.me = { ...USER };
    await go(page, "/about", 5000);
    const recovered = await measures(page, "order_created");
    check("after sign-in: the parked order is proven and sent once, same event_id", recovered.length === 1 && recovered[0]?.[3]?.event_id === `sess_${SESSION}` && recovered[0]?.[2]?.amount === 9900, JSON.stringify(recovered));
    check("after sign-in: the proof request carries the new sign-in", (state.posts["GET /api/track/paid-visit-by-session"] || []).some((c) => c.auth === `Bearer ${TOKEN}`));
    check("after sign-in: nothing is left parked", !(await page.evaluate(() => localStorage.getItem("pf_oaiq_pending"))));
    await go(page, "/membership/plans", 4000);
    check("a later page: no second order_created", (await measures(page, "order_created")).length === 0);
    await ctx.close();
  }
  {
    // Signed out on return; a DIFFERENT account then signs in here. The server refuses it.
    const { ctx, page, state } = await context(browser, { signedIn: false, api: visitProof(404, { ok: false }) });
    await go(page, `/book/confirmation?booking_id=b1&session_id=${SESSION}`, 3000);
    await page.evaluate((t) => localStorage.setItem("token", t), TOKEN);
    state.me = { ...USER, _id: "u2" };
    await go(page, "/about", 12000);
    check("someone else signs in: proof refused, no order_created", (state.posts["GET /api/track/paid-visit-by-session"] || []).length >= 1 && (await measures(page, "order_created")).length === 0);
    const pend = () => page.evaluate(() => JSON.parse(localStorage.getItem("pf_oaiq_pending") || "[]"));
    check("someone else signs in: one refusal is counted, the session kept for now", (await pend())[0]?.misses === 1, JSON.stringify(await pend()));
    await go(page, "/about", 7000);
    await go(page, "/about", 7000);
    check("refused three times: the parked session is dropped, still no order_created", (await pend()).length === 0 && (await measures(page, "order_created")).length === 0, JSON.stringify(await pend()));
    await ctx.close();
  }
  {
    // Signed in, but the server (or Stripe behind it) is failing: nothing sent, nothing discarded.
    let status = 503;
    const { ctx, page, state } = await context(browser, {
      signedIn: true,
      api: { "GET /api/track/paid-visit-by-session": () => (status === 200 ? [200, { ok: true, product: "one_time_visit", amountCents: 9900, currency: "USD" }] : [status, { ok: false }]) },
    });
    await go(page, `/book/confirmation?booking_id=b1&session_id=${SESSION}`, 40000);
    const calls = (state.posts["GET /api/track/paid-visit-by-session"] || []).length;
    const parkedNow = await page.evaluate(() => JSON.parse(localStorage.getItem("pf_oaiq_pending") || "[]"));
    check("server failing for the whole check: no order_created", calls >= 8 && (await measures(page, "order_created")).length === 0, `calls=${calls}`);
    check("server failing: the session stays parked, with no refusal counted", parkedNow.length === 1 && parkedNow[0].sessionId === SESSION && !parkedNow[0].misses, JSON.stringify(parkedNow));
    status = 429;
    await go(page, "/about", 7000);
    check("rate-limited on the retry: still parked, still unsent", (await page.evaluate(() => localStorage.getItem("pf_oaiq_pending") || "")).includes(SESSION) && (await measures(page, "order_created")).length === 0);
    status = 200;
    await go(page, "/membership/plans", 5000);
    const sent = await measures(page, "order_created");
    check("server back: the parked order is sent once, same event_id", sent.length === 1 && sent[0]?.[3]?.event_id === `sess_${SESSION}`, JSON.stringify(sent));
    check("server back: nothing left parked", !(await page.evaluate(() => localStorage.getItem("pf_oaiq_pending"))));
    await ctx.close();
  }
  {
    // A token that looks fine locally but the server does not accept (revoked): treated as signed out.
    const { ctx, page } = await context(browser, { signedIn: true, api: visitProof(401, { ok: false }) });
    await go(page, `/book/confirmation?booking_id=b1&session_id=${SESSION}`, 4000);
    const p = await page.evaluate(() => JSON.parse(localStorage.getItem("pf_oaiq_pending") || "[]"));
    check("401 from the server: no order_created, parked without a refusal", (await measures(page, "order_created")).length === 0 && p[0]?.sessionId === SESSION && !p[0]?.misses, JSON.stringify(p));
    await ctx.close();
  }
  {
    // An expired session token on return counts as signed out: parked, not sent to the server.
    const b64 = (o) => Buffer.from(JSON.stringify(o)).toString("base64url");
    const expired = `${b64({ alg: "HS256", typ: "JWT" })}.${b64({ id: "u1", exp: Math.floor(Date.now() / 1000) - 3600 })}.sig`;
    const { ctx, page, state } = await context(browser, { signedIn: false, api: visitProof() });
    await page.goto(BASE + "/about", { waitUntil: "domcontentloaded" });
    await page.evaluate((t) => localStorage.setItem("token", t), expired);
    await go(page, `/book/confirmation?booking_id=b1&session_id=${SESSION}`, 3000);
    check("expired sign-in on return: no proof request, session parked", !(state.posts["GET /api/track/paid-visit-by-session"] || []).length && (await page.evaluate(() => localStorage.getItem("pf_oaiq_pending") || "")).includes(SESSION));
    await ctx.close();
  }
  {
    const { ctx, page } = await context(browser, { signedIn: true });
    await go(page, "/book/confirmation", 3000);
    check("no session id: no order_created", (await measures(page, "order_created")).length === 0);
    await ctx.close();
  }

  /* ============ item 6: an event the SDK never took is not suppressed ============ */
  {
    let sdk = "block";
    const { ctx, page } = await context(browser, { signedIn: true, sdk: () => sdk, api: visitProof() });
    await go(page, `/book/confirmation?booking_id=b1&session_id=${SESSION}`, 4000);
    const queued = await measures(page, "order_created");
    const remembered = await page.evaluate(() => localStorage.getItem("pf_oaiq_sent") || "");
    check("SDK blocked: the order is queued once", queued.length === 1);
    check("SDK blocked: it is NOT remembered as sent", !remembered.includes(`order_created:sess_${SESSION}`), remembered);
    sdk = "load";
    await go(page, `/book/confirmation?booking_id=b1&session_id=${SESSION}`, 4000);
    const resent = await measures(page, "order_created");
    check("SDK loads on the next view: the same order is sent again, same event_id", resent.length === 1 && resent[0]?.[3]?.event_id === `sess_${SESSION}`);
    check("...and only now is it remembered", (await page.evaluate(() => localStorage.getItem("pf_oaiq_sent") || "")).includes(`order_created:sess_${SESSION}`));
    await go(page, `/book/confirmation?booking_id=b1&session_id=${SESSION}`, 4000);
    check("...so a further reload sends nothing", (await measures(page, "order_created")).length === 0);
    await ctx.close();
  }

  /* ======================= subscription_created ======================= */
  const memberProof = (status = 200, body = { ok: true, planId: "basic_monthly", amountCents: 14900, currency: "USD" }) => ({
    "GET /api/track/membership-by-session": () => [status, body],
    "GET /api/track/last-purchase-by-session": () => [200, { ok: true, plan: "basic", value: 149, currency: "USD", billingCycle: "monthly", eventId: "evt_sub_1" }],
  });
  {
    const { ctx, page, state } = await context(browser, { signedIn: true, api: memberProof() });
    await go(page, `/confirmationpage?session_id=${SESSION}`, 5000);
    const subs = await measures(page, "subscription_created");
    const s = subs[0] || [];
    check("paid active membership: one subscription_created", subs.length === 1, JSON.stringify(subs));
    check("subscription_created: plan_enrollment, 14900 cents, plan id, session event_id", s[2]?.type === "plan_enrollment" && s[2]?.amount === 14900 && s[2]?.currency === "USD" && s[2]?.plan_id === "basic_monthly" && s[3]?.event_id === `sub_${SESSION}`, JSON.stringify(s));
    check("the membership proof carries the customer's sign-in", (state.posts["GET /api/track/membership-by-session"] || [])[0]?.auth === `Bearer ${TOKEN}`);
    check("Meta Subscribe still fires (from the checkout record, as before)", (await metaTrack(page, "Subscribe")).length === 1);
    const tab = await ctx.newPage();
    await go(tab, `/confirmationpage?session_id=${SESSION}`, 5000);
    check("same checkout in a new tab: no second subscription_created", (await measures(tab, "subscription_created")).length === 0);
    await ctx.close();
  }
  {
    // The checkout record exists (Meta fires) but the server has no paid, active membership.
    const { ctx, page } = await context(browser, { signedIn: true, api: memberProof(404, { ok: false }) });
    await go(page, `/confirmationpage?session_id=${SESSION}`, 40000);
    check("checkout record only (unpaid, $0, inactive): no subscription_created", (await measures(page, "subscription_created")).length === 0);
    check("...while Meta's Subscribe behaves exactly as before", (await metaTrack(page, "Subscribe")).length === 1);
    await ctx.close();
  }
  {
    const { ctx, page } = await context(browser, { signedIn: true, api: memberProof(200, { ok: true, planId: "basic_monthly", amountCents: 0, currency: "USD" }) });
    await go(page, `/confirmationpage?session_id=${SESSION}`, 5000);
    check("a $0 proof is still not a subscription_created", (await measures(page, "subscription_created")).length === 0);
    await ctx.close();
  }
  {
    // Membership checkout returned signed out, recovered after the owner signs in.
    const { ctx, page, state } = await context(browser, { signedIn: false, api: memberProof() });
    await go(page, `/confirmationpage?session_id=${SESSION}`, 4000);
    check("membership, signed out: no proof request, no subscription_created", !(state.posts["GET /api/track/membership-by-session"] || []).length && (await measures(page, "subscription_created")).length === 0);
    await page.evaluate((t) => localStorage.setItem("token", t), TOKEN);
    state.me = { ...USER };
    await go(page, "/about", 5000);
    const subs = await measures(page, "subscription_created");
    check("membership, after sign-in: one subscription_created, same event_id", subs.length === 1 && subs[0]?.[3]?.event_id === `sub_${SESSION}` && subs[0]?.[2]?.amount === 14900, JSON.stringify(subs));
    await ctx.close();
  }

  /* ======================= registration_completed ======================= */
  async function signUp({ verify }, existing) {
    const { ctx, page, state } = existing || await context(browser, {
      api: {
        "POST /api/auth/otp/phone/start": () => [200, { ok: true, phoneMasked: "(•••) •••-0134", resendAfterSeconds: 30, expiresInSeconds: 600 }],
        "POST /api/auth/otp/phone/verify": (st) => {
          const [status, body] = verify(st);
          if (status === 200 && body.token) st.me = { ...USER };
          return [status, body];
        },
      },
    });
    // /api/auth/me answers once signed in: the mock reads the token the app stored.
    await go(page, "/signup", 3000);
    await page.getByRole("button", { name: /Continue with phone/ }).first().click();
    await page.fill("#phone", "6315550134");
    await page.getByRole("button", { name: /Text me a code/ }).click();
    const code = page.locator('input[autocomplete="one-time-code"]');
    await code.waitFor({ timeout: 10000 });
    await code.fill("123456");
    await page.waitForTimeout(4000);
    return { ctx, page, state };
  }
  {
    const { ctx, page } = await signUp({ verify: () => [200, { status: "signed_in", token: TOKEN, user: USER, created: true }] });
    const regs = await measures(page, "registration_completed");
    check("new account: one registration_completed", regs.length === 1, JSON.stringify(regs));
    check("registration_completed: customer_action, keyed to the account", regs[0]?.[2]?.type === "customer_action" && regs[0]?.[3]?.event_id === "reg_u1", JSON.stringify(regs[0]));
    const metaLead = await metaTrack(page, "Lead");
    check("Meta account Lead still fires once", metaLead.length === 1 && metaLead[0]?.[2]?.lead_type === "account");
    await ctx.close();
  }
  {
    const verify = () => [200, { status: "signed_in", token: TOKEN, user: USER, created: true }];
    const run = await signUp({ verify });
    await run.page.evaluate(() => localStorage.removeItem("token"));
    run.state.me = null;
    const again = await signUp({ verify }, run);
    check("the same new account reported twice in one browser: one registration_completed in total", (await measures(again.page, "registration_completed")).length === 0);
    await run.ctx.close();
  }
  {
    const { ctx, page } = await signUp({ verify: () => [200, { status: "signed_in", token: TOKEN, user: USER, created: false }] });
    check("returning sign-in: no registration_completed", (await measures(page, "registration_completed")).length === 0);
    await ctx.close();
  }
  {
    const { ctx, page } = await signUp({ verify: () => [400, { code: "OTP_INVALID", message: "That code is not right." }] });
    check("failed code: no registration_completed", (await measures(page, "registration_completed")).length === 0);
    check("failed code: no Meta Lead either", (await metaTrack(page, "Lead")).length === 0);
    await ctx.close();
  }

  /* ======================= Free Visit request + callback ======================= */
  async function fillFreeVisit(page) {
    await go(page, "/book/free", 2500);
    const form = page.locator("[data-free-visit-form]");
    await form.waitFor({ timeout: 20000 });
    await form.locator("input[name=name]").fill("Dana Lopez");
    await form.locator("input[name=phone]").fill("(516) 555-0123");
    await form.locator("input[name=email]").fill("dana@mailbox.org");
    await form.locator("input[placeholder='Street address']").first().fill("12 Elm St");
    await form.locator("input[placeholder='City']").first().fill("Farmingdale");
    await form.locator("input[placeholder='ZIP']").first().fill("11735");
    await form.locator("input[placeholder='ZIP']").first().blur();
    await page.locator(".bk-day[aria-pressed=true]").waitFor({ timeout: 10000 });
    await page.locator("[data-action='review-free-visit']").click();
    const sheet = page.locator("[data-free-visit-sheet]");
    await sheet.waitFor({ timeout: 5000 });
    await page.waitForTimeout(500);
    return sheet;
  }
  const freeVisitApi = (status, body) => ({ "POST /api/free-visit-requests": () => [status, body] });
  {
    const { ctx, page, state } = await context(browser, { api: freeVisitApi(201, { success: true }) });
    const sheet = await fillFreeVisit(page);
    await sheet.locator("[data-action='confirm-free-visit']").dblclick();
    await page.locator("[data-free-visit-done]").waitFor({ timeout: 8000 });
    await page.waitForTimeout(800);
    const posts = state.posts["POST /api/free-visit-requests"] || [];
    const leads = await measures(page, "lead_created");
    const sentId = field(posts[0]?.body || "", "eventId");
    check("free-visit request (double tap): one POST, one lead_created", posts.length === 1 && leads.length === 1, `posts=${posts.length} leads=${leads.length}`);
    check("lead_created uses the event id the server got", leads[0]?.[3]?.event_id === sentId && !!sentId, `${leads[0]?.[3]?.event_id} vs ${sentId}`);
    const metaLead = await metaTrack(page, "Lead");
    check("Meta free-visit Lead still fires once, same id", metaLead.length === 1 && metaLead[0]?.[3]?.eventID === sentId);
    await ctx.close();
  }
  {
    const { ctx, page } = await context(browser, { api: freeVisitApi(409, { success: false, code: "SLOT_UNAVAILABLE", message: "That time was just taken." }) });
    const sheet = await fillFreeVisit(page);
    await sheet.locator("[data-action='confirm-free-visit']").click();
    await page.waitForTimeout(2500);
    check("rejected free-visit request: no lead_created", (await measures(page, "lead_created")).length === 0);
    check("rejected free-visit request: no Meta Lead", (await metaTrack(page, "Lead")).length === 0);
    await ctx.close();
  }
  {
    const { ctx, page } = await context(browser, { api: freeVisitApi(500, { success: false, message: "Server error" }) });
    const sheet = await fillFreeVisit(page);
    await sheet.locator("[data-action='confirm-free-visit']").click();
    await page.waitForTimeout(2500);
    check("server error on a free-visit request: no lead_created", (await measures(page, "lead_created")).length === 0);
    await ctx.close();
  }
  const callbackApi = (status, body) => ({ "POST /api/requests/callback": () => [status, body] });
  {
    const { ctx, page, state } = await context(browser, { api: callbackApi(201, { success: true }) });
    const sheet = await fillFreeVisit(page);
    await sheet.locator("[data-action='request-callback']").click();
    await sheet.locator("[data-callback-sent]").waitFor({ timeout: 5000 });
    await page.waitForTimeout(500);
    const leads = await measures(page, "lead_created");
    check("callback saved: one lead_created", (state.posts["POST /api/requests/callback"] || []).length === 1 && leads.length === 1 && /^callback_/.test(leads[0]?.[3]?.event_id || ""), JSON.stringify(leads));
    await ctx.close();
  }
  {
    const { ctx, page } = await context(browser, { api: callbackApi(200, { success: true, duplicate: true }) });
    const sheet = await fillFreeVisit(page);
    await sheet.locator("[data-action='request-callback']").click();
    await sheet.locator("[data-callback-sent]").waitFor({ timeout: 5000 });
    await page.waitForTimeout(500);
    check("callback the server already had (duplicate): no lead_created", (await measures(page, "lead_created")).length === 0);
    await ctx.close();
  }
  {
    const { ctx, page } = await context(browser, { api: callbackApi(400, { success: false, field: "phone", message: "Please enter a valid US phone number." }) });
    const sheet = await fillFreeVisit(page);
    await sheet.locator("[data-action='request-callback']").click();
    await page.waitForTimeout(2000);
    check("rejected callback: no lead_created", (await measures(page, "lead_created")).length === 0);
    await ctx.close();
  }

  /* ======================= signed-in free booking (/membership BookingSection) ======================= */
  async function bookFree(api, existing) {
    const { ctx, page, state, errors } = existing || (await context(browser, { signedIn: true, api }));
    const result = { ctx, page, state, errors, reached: false };
    // A full page load: a hash-only goto would keep the last booking's dialog open.
    if (existing) await go(page, "/about", 1500);
    await go(page, "/membership#pick-day", 3500);
    const day = page.locator('[data-booking-date-disabled="false"][data-booking-date-muted="false"]').first();
    await day.waitFor({ timeout: 20000 }).catch(() => {});
    if (!(await day.count())) return result;
    await day.click();
    await page.locator('[data-booking-time][data-booking-time-available="true"]').first().click();
    await page.getByPlaceholder(/Describe your task/).fill("Fix the loose kitchen cabinet");
    await page.locator('input[type="file"]').nth(1).setInputFiles({ name: "t.png", mimeType: "image/png", buffer: Buffer.from("iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII=", "base64") });
    await page.waitForFunction(() => {
      const b = document.querySelector('[data-track="booking-cta"]');
      return b instanceof HTMLButtonElement && !b.disabled;
    }, null, { timeout: 10000 }).catch(() => {});
    await page.locator('[data-track="booking-cta"]').click();
    await page.waitForTimeout(3500);
    result.reached = true;
    return result;
  }
  const booking = (number) => ({ "POST /api/bookings": () => [201, { message: "Booking created", booking: { bookingNumber: number, status: "Pending", date: ymd(3), time: "08:00" } }] });
  {
    const r = await bookFree(booking("12345678"));
    const leads = await measures(r.page, "lead_created");
    check("signed-in free booking: the form was driven to submission", r.reached && (r.state.posts["POST /api/bookings"] || []).length === 1, `reached=${r.reached} posts=${(r.state.posts["POST /api/bookings"] || []).length} errors=${r.errors.join("|")}`);
    check("signed-in free booking: one lead_created keyed to the booking", leads.length === 1 && leads[0]?.[3]?.event_id === "free_visit_12345678", JSON.stringify(leads));
    check("Meta Schedule still fires once", (await metaTrack(r.page, "Schedule")).length === 1);
    /*
     * The same browser submits again and the server resolves it to the SAME
     * booking (a replayed or retried submission): no second lead_created.
     */
    const again = await bookFree(null, r);
    check("replayed booking (same booking number): no second lead_created", again.reached && (await measures(again.page, "lead_created")).length === 0);
    await r.ctx.close();
  }
  {
    const r = await bookFree({ "POST /api/bookings": () => [409, { message: "That time was just taken.", code: "SLOT_UNAVAILABLE" }] });
    check("signed-in free booking refused (slot taken): no lead_created", r.reached && (await measures(r.page, "lead_created")).length === 0);
    check("...and no Meta Schedule", (await metaTrack(r.page, "Schedule")).length === 0);
    await r.ctx.close();
  }

  /* ======================= estimate form ======================= */
  async function submitEstimate(status) {
    const { ctx, page } = await context(browser, { api: { "POST /api/estimates": () => [status, status < 300 ? { success: true } : { message: "nope" }] } });
    await go(page, "/projects", 2500);
    const form = page.locator("#estimate");
    await form.locator('input[autocomplete="name"]').fill("Test Person");
    await form.locator('input[autocomplete="tel"]').fill("6315550123");
    await form.locator('input[autocomplete="email"]').fill("test@example.com");
    await form.locator('input[autocomplete="street-address"]').fill("1 Main St, Huntington, NY 11743");
    await form.locator("textarea").first().fill("Kitchen remodel");
    await form.locator('button[type="submit"]').click();
    await page.waitForTimeout(2500);
    const leads = await measures(page, "lead_created");
    const metaLeads = await metaTrack(page, "Lead");
    await ctx.close();
    return { leads, metaLeads };
  }
  {
    const ok = await submitEstimate(201);
    check("saved estimate: one lead_created sharing the Meta Lead's id", ok.leads.length === 1 && ok.metaLeads.length === 1 && ok.metaLeads[0]?.[3]?.eventID === ok.leads[0]?.[3]?.event_id);
    const failed = await submitEstimate(400);
    check("rejected estimate: no lead_created", failed.leads.length === 0);
  }

  await browser.close();
  const failed = results.filter((r) => !r.pass);
  console.log(`\n${results.length - failed.length}/${results.length} passed`);
  process.exit(failed.length ? 1 : 0);
})().catch((error) => {
  console.error(error);
  process.exit(1);
});
