/*
 * The book-first funnel, end to end, in a real browser.
 *
 *   node scripts/test_free_visit_funnel.js [baseUrl] [apiOrigin]
 *
 * What it proves:
 * - an anonymous visitor can describe a job, pick a REAL available day and time
 *   (live public calendar) and only then reach signup, with the visit shown
 * - signup returns them to /book/free, which creates the booking from the draft
 *   with nothing re-entered: note, date, time and photo all arrive in the POST
 * - a slot taken during signup sends them back to the times, everything else kept
 * - validation, refresh, ineligible, out-of-area and member states adapt
 * - a plan chosen before signup survives it and opens a confirmation, then checkout
 *
 * - Meta: a cold booker sends ONE Lead (the account) and one Schedule (the
 *   booking, relayed with the same event id); UI taps never reach Meta
 * - out of area: the email-only waitlist form, every server answer
 * - plain /signup (no ?next) lands on the free-visit booker
 *
 * Account, booking, checkout, waitlist and tracking endpoints are faked in the
 * browser, so the run creates no account, no booking, no Stripe session, no
 * waitlist row and no Meta event (fbq is a recorder). The calendar and the
 * service-area check are the real public endpoints.
 */
const { chromium } = require("playwright");
const path = require("path");
const fs = require("fs");
const zlib = require("zlib");

const BASE = process.argv[2] || "http://localhost:3000";
const API = process.argv[3] || "https://api.profixter.com";
const TOKEN = "test-token-funnel";

const results = [];
function check(name, pass, detail = "") {
  results.push({ name, pass: !!pass });
  console.log(`${pass ? "PASS" : "FAIL"}  ${name}${detail ? "  :: " + detail : ""}`);
}

/* A tiny real PNG, so the photo path exercises compressImage and IndexedDB. */
function pngFile() {
  const w = 64, h = 48;
  const raw = Buffer.alloc((w * 3 + 1) * h, 120);
  for (let y = 0; y < h; y++) raw[y * (w * 3 + 1)] = 0;
  const table = [];
  for (let n = 0; n < 256; n++) { let c = n; for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1; table[n] = c >>> 0; }
  const crc = (buf) => { let c = 0xffffffff; for (const x of buf) c = table[(c ^ x) & 255] ^ (c >>> 8); return (c ^ 0xffffffff) >>> 0; };
  const chunk = (type, data) => {
    const len = Buffer.alloc(4); len.writeUInt32BE(data.length);
    const td = Buffer.concat([Buffer.from(type), data]);
    const c = Buffer.alloc(4); c.writeUInt32BE(crc(td));
    return Buffer.concat([len, td, c]);
  };
  const ihdr = Buffer.alloc(13); ihdr.writeUInt32BE(w, 0); ihdr.writeUInt32BE(h, 4); ihdr[8] = 8; ihdr[9] = 2;
  const file = path.join(require("os").tmpdir(), "pf-funnel-job.png");
  fs.writeFileSync(file, Buffer.concat([Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]), chunk("IHDR", ihdr), chunk("IDAT", zlib.deflateSync(raw)), chunk("IEND", Buffer.alloc(0))]));
  return file;
}

function makeUser({ member = false } = {}) {
  return {
    _id: "u1", userId: "PF-TEST", name: "Test Person", email: "test@example.com", phone: "+16315550134",
    role: "customer", defaultAddressId: "addr1",
    addresses: [{ _id: "addr1", label: "Home", line1: "12 Main St", city: "Massapequa", state: "NY", zip: "11758",
      hasActiveSubscription: member, plan: member ? "plus" : null }],
  };
}

/**
 * Fake the account side of the API inside the browser. Everything else goes to
 * the real API with CORS added, so a local build on any port can read it.
 */
async function fakeApi(ctx, opts = {}) {
  const state = {
    bookingPosts: [], checkoutPosts: [], registerPosts: 0, bookingQueue: opts.bookingQueue || [],
    relays: [], waitlistPosts: [], waitlistQueue: opts.waitlistQueue || [],
  };
  const user = makeUser(opts);
  await ctx.route((url) => url.href.startsWith(API), async (route) => {
    const req = route.request();
    const url = new URL(req.url());
    const p = url.pathname;
    const origin = req.headers()["origin"] || BASE;
    const cors = {
      "access-control-allow-origin": origin, "access-control-allow-credentials": "true",
      "access-control-allow-headers": "Authorization,Content-Type", "access-control-allow-methods": "GET,POST,PUT,PATCH,DELETE,OPTIONS",
    };
    const json = (status, body) => route.fulfill({ status, contentType: "application/json", headers: cors, body: JSON.stringify(body) });
    if (req.method() === "OPTIONS") return route.fulfill({ status: 204, headers: cors });
    const authed = (req.headers()["authorization"] || "") === `Bearer ${TOKEN}`;

    /* Never reaches the real API: the Meta relay, the visit beacon, the waitlist. */
    if (p === "/api/track/meta" && req.method() === "POST") {
      state.relays.push(JSON.parse(req.postData() || "{}"));
      return route.fulfill({ status: 204, headers: cors });
    }
    if (p.startsWith("/api/track/")) return route.fulfill({ status: 204, headers: cors });
    if (p === "/api/service-area/waitlist" && req.method() === "POST") {
      state.waitlistPosts.push(JSON.parse(req.postData() || "{}"));
      const next = state.waitlistQueue.shift() || { status: 201, body: { ok: true } };
      if (next.abort) return route.abort("failed");
      return json(next.status, next.body);
    }
    if (p === "/api/auth/register" && req.method() === "POST") { state.registerPosts++; return json(201, { token: TOKEN, user }); }
    if (p === "/api/auth/me") return authed ? json(200, user) : json(401, { message: "no" });
    if (p === "/api/bookings/next") {
      return json(200, opts.next || { freeFirstVisitAvailable: true, introVisitStatus: "available", introVisitServiceable: true, hasSubscription: false, bookingLimit: 1, activeCount: 0, activeBookings: [] });
    }
    if (p === "/api/bookings" && req.method() === "POST") {
      const body = req.postDataBuffer()?.toString("latin1") || "";
      const field = (n) => (body.match(new RegExp(`name="${n}"\\r\\n\\r\\n([^\\r]*)`)) || [])[1];
      state.bookingPosts.push({
        service: field("service"), note: field("note"), addressId: field("addressId"),
        requestedDate: field("requestedDate"), requestedTime: field("requestedTime"),
        libraryReference: field("libraryReference"), images: (body.match(/name="images"/g) || []).length,
      });
      const next = state.bookingQueue.shift() || { status: 201, body: { booking: { _id: "b1", bookingNumber: "1042" } } };
      return json(next.status, next.body);
    }
    if (p === "/api/stripe/checkout/create-checkout-session") {
      state.checkoutPosts.push(JSON.parse(req.postData() || "{}"));
      return json(200, { url: `${BASE}/__stripe_stub` });
    }
    /*
     * Public data always comes from the real API, signed in or not - the
     * calendar above all, since availability is what the funnel is about.
     * Anything else a signed-in page asks for gets an empty answer, so the fake
     * token never meets the real API and logs the test user out.
     */
    const isPublic =
      /^\/api\/(calendar|service-area|google|reviews|event-display|promotions?|popups?)(\/|$)/.test(p) ||
      p === "/api/recent-work" ||
      p === "/api/recent-work/categories";
    if (authed && !isPublic) return json(200, {});
    try {
      const res = await route.fetch();
      return route.fulfill({ response: res, headers: { ...res.headers(), ...cors } });
    } catch {
      return route.abort();
    }
  });
  await ctx.route(`${BASE}/__stripe_stub`, (r) => r.fulfill({ status: 200, contentType: "text/html", body: "<h1>stripe stub</h1>" }));
  return state;
}

const activeTab = (page) =>
  page
    .locator('nav[aria-label="Visit type"] [aria-current="page"]')
    .first()
    .innerText()
    .then((t) => t.trim())
    .catch(() => "");

async function newContext(browser, { signedIn = false, ...opts } = {}) {
  const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true });
  await ctx.addInitScript(([token, signedIn]) => {
    try {
      localStorage.setItem("profixter_promotion_popup_dismissed_date", new Date().toISOString().slice(0, 10));
      if (signedIn) localStorage.setItem("token", token);
    } catch {}
  }, [TOKEN, signedIn]);
  /*
   * fbq and the dataLayer, recorded. Defining fbq first makes the pixel
   * snippet bail out, so nothing reaches Meta. Calls are also kept in
   * sessionStorage, so they survive the reloads and navigations of a funnel.
   */
  await ctx.addInitScript(() => {
    const keep = (key, entry) => {
      try {
        const list = JSON.parse(sessionStorage.getItem(key) || "[]");
        list.push(entry);
        sessionStorage.setItem(key, JSON.stringify(list));
      } catch {}
    };
    window.fbq = function (...args) { keep("__test_fbq", args); };
    window._fbq = window.fbq;
    window.fbq.queue = [];
    window.fbq.loaded = true;
    window.fbq.version = "2.0";
    window.dataLayer = window.dataLayer || [];
    const push = window.dataLayer.push.bind(window.dataLayer);
    window.dataLayer.push = function (...items) {
      items.forEach((item) => item && item.event && keep("__test_dl", item));
      return push(...items);
    };
  });
  const state = await fakeApi(ctx, opts);
  const page = await ctx.newPage();
  const errors = [];
  page.on("pageerror", (e) => errors.push(e.message));
  if (process.env.FUNNEL_DEBUG) page.on("response", async (r) => { if (r.url().includes("/api/calendar/slots")) console.log("      <- slots", r.status(), (await r.text().catch(() => "?")).slice(0, 160)); });
  if (process.env.FUNNEL_DEBUG) page.on("request", (r) => { if (r.url().startsWith(API) && r.method() !== "OPTIONS") console.log("      ->", r.method(), r.url().replace(API, "").slice(0, 90)); });
  return { ctx, page, state, errors };
}

const fbqLog = (page) => page.evaluate(() => JSON.parse(sessionStorage.getItem("__test_fbq") || "[]"));
const dlLog = (page) => page.evaluate(() => JSON.parse(sessionStorage.getItem("__test_dl") || "[]"));

async function buildVisit(page, { photo = true } = {}) {
  await page.fill('[data-fv="note"]', "The bathroom faucet drips and a towel bar fell off");
  if (photo) {
    await page.setInputFiles('[data-fv="photos"] input[type=file]', pngFile());
    await page.waitForSelector(".fv-thumb", { timeout: 10000 });
  }
  await page.locator('[data-booking-date-disabled="false"]').first().click();
  await page.waitForSelector('[data-booking-time-available="true"]', { timeout: 15000 });
  // Read the chosen day before picking a time: the compact homepage booker
  // folds day and time into one summary row as soon as the time is chosen.
  const date = await page.locator('[data-booking-date][aria-selected="true"]').first().getAttribute("data-booking-date");
  const taken = await page.locator('[data-booking-time-available="false"]').count();
  const slot = page.locator('[data-booking-time-available="true"]').first();
  const time = await slot.getAttribute("data-booking-time");
  await slot.click();
  return { date, time, taken };
}

async function completeSignup(page, { zip = "11758" } = {}) {
  // Step 1: address. Use the manual entry the field offers when lookup fails.
  // A build without a Maps key renders the manual form straight away.
  await page.waitForSelector('#pf-address, [aria-label="Street address"]', { timeout: 15000 });
  if (await page.locator("#pf-address").count()) {
    await page.fill("#pf-address", "12 Main St");
    await page.waitForTimeout(900);
    /*
     * Where Google lookup works (production), real suggestions open over the
     * button. Close them and use the field's own manual entry, so the run never
     * depends on which real address Google happens to suggest.
     */
    await page.keyboard.press("Escape");
    await page.locator("h1, h2").first().click().catch(() => {});
    await page.waitForTimeout(300);
    const fallback = page.locator("[data-auth-fallback]");
    if (await fallback.count()) await fallback.click();
  }
  if (await page.locator('[aria-label="Street address"]').count()) {
    await page.fill('[aria-label="Street address"]', "12 Main St");
    await page.fill('[aria-label="City"]', "Massapequa");
    await page.fill('[aria-label="ZIP code"]', zip);
  }
  await page.waitForTimeout(1500); // service-area check (real endpoint)
  await page.click('button[type="submit"]');
  await page.waitForTimeout(600);
  return page;
}

const SHOTS = process.env.FUNNEL_SHOTS || "";
const idbPhotos = (page) => page.evaluate(() => new Promise((res) => {
  const r = indexedDB.open("pf-booking-draft", 1);
  r.onsuccess = () => { try { const g = r.result.transaction("photos", "readonly").objectStore("photos").get("current"); g.onsuccess = () => res(g.result?.records?.length ?? -1); g.onerror = () => res(-2); } catch { res(-3); } };
  r.onerror = () => res(-4);
}));
async function shot(page, name) {
  if (SHOTS) await page.screenshot({ path: path.join(SHOTS, `${name}.png`) });
}

async function finishSignupSteps(page) {
  await shot(page, "signup-2-name");
  await page.fill("#name", "Test Person");
  await page.click('button[type="submit"]');
  await page.fill("#email", "test@example.com");
  await page.fill("#phone", "6315550134");
  await page.check("#sms-service-consent", { force: true });
  await page.click('button[type="submit"]');
  await page.fill("#password", "correct-horse-1");
  await page.check("#agree-terms", { force: true });
  await shot(page, "signup-4-password");
}

(async () => {
  const browser = await chromium.launch();

  /* 1. Anonymous: home -> booker -> signup -> booked, nothing re-entered. */
  {
    console.log("\n--- anonymous visitor books before signing up ---");
    const { ctx, page, state, errors } = await newContext(browser);
    await page.goto(BASE + "/", { waitUntil: "networkidle" });
    check("home shows the booker to a new visitor", await page.locator('[data-fv="note"]').isVisible());
    check("home H1 states the product", (await page.locator("h1").first().innerText()).includes("On demand"));
    check("no account wall: the calendar is visible signed out", (await page.locator('[data-booking-date-disabled="false"]').count()) > 0);

    // Validation: nothing filled in -> stays put, says what is missing.
    await page.click('[data-fv="book"]');
    await page.waitForTimeout(400);
    check("empty booking is stopped with a message", page.url().endsWith("/") && (await page.locator(".fv-error").count()) > 0);

    const visit = await buildVisit(page);
    check("home uses the compact booker", (await page.locator('[data-fv-variant="compact"]').count()) === 1);
    await page.waitForSelector('[data-fv="when-summary"]', { timeout: 5000 }).catch(() => {});
    const folded = await page.locator('[data-fv="when-summary"]').innerText().catch(() => "");
    check("day + time fold into one summary row", /·/.test(folded) && (await page.locator('[data-fv="days"]').count()) === 0, folded.replace(/\s+/g, " "));
    console.log(`      (live day ${visit.date} showed ${visit.taken} booked slot(s) as disabled)`);
    await page.click('[data-fv="when-summary"]');
    check("Change re-opens day and time", (await page.locator('[data-fv="days"]').count()) === 1);
    await page.locator('[data-booking-time-available="true"]').first().click();
    await page.waitForSelector('[data-fv="when-summary"]', { timeout: 5000 }).catch(() => {});

    await page.click('[data-fv="book"]');
    await page.waitForURL(/\/signup\?next=%2Fbook%2Ffree/, { timeout: 10000 });
    check("final CTA goes to signup with next=/book/free", true, page.url().replace(BASE, ""));
    await page.waitForSelector("[data-signup-carry]");
    check("signup shows the visit being booked", (await page.locator("[data-signup-carry]").innerText()).includes("Free visit"));
    await shot(page, "signup-1-carry");
    check("signup reads 'Almost done'", (await page.locator("h1,h2").first().innerText()).includes("Almost done"));
    check("signup Log In keeps the way back", ((await page.locator('a[href^="/signin"]').first().getAttribute("href")) || "").includes("next=%2Fbook%2Ffree"));

    // Refresh mid-signup: the draft survives.
    await page.reload({ waitUntil: "networkidle" });
    check("draft survives a refresh on signup", (await page.locator("[data-signup-carry]").count()) === 1);

    if (process.env.FUNNEL_DEBUG) console.log("      idb before signup:", await idbPhotos(page));
    await completeSignup(page);
    if (process.env.FUNNEL_DEBUG) console.log("      idb after address:", await idbPhotos(page));
    await finishSignupSteps(page);
    if (process.env.FUNNEL_DEBUG) console.log("      idb before submit:", await idbPhotos(page));
    await page.click('button[type="submit"]');
    await page.waitForURL((u) => u.pathname === "/book/free", { timeout: 15000 });
    if (process.env.FUNNEL_DEBUG) console.log("      idb on /book/free:", await idbPhotos(page));
    await page.waitForSelector("text=You’re booked.", { timeout: 20000 }).catch(() => {});
    await shot(page, "resume-result");
    const done = await page.locator("text=You’re booked.").count();
    if (!done) console.log("      resume state:", JSON.stringify(await page.evaluate(() => ({
      notice: document.querySelector(".fv-notice")?.textContent, error: [...document.querySelectorAll(".fv-error")].map((e) => e.textContent),
      access: document.querySelector("[data-fv-access]")?.getAttribute("data-fv-access"), draft: sessionStorage.getItem("pf_free_visit_draft"),
    }))));
    const post = state.bookingPosts[0] || {};
    check("booking created automatically after signup", done === 1 && state.bookingPosts.length === 1);
    check("POST carries the note typed before signup", post.note === "The bathroom faucet drips and a towel bar fell off");
    check("POST carries the date and time picked before signup", post.requestedDate === visit.date && post.requestedTime === visit.time, `${post.requestedDate} ${post.requestedTime}`);
    check("POST carries the photo added before signup", post.images === 1);
    check("POST is a Labor Only free visit on the new address", post.service === "Labor Only" && post.addressId === "addr1");
    const draftLeft = await page.evaluate(() => sessionStorage.getItem("pf_free_visit_draft"));
    check("draft is cleared once booked", !draftLeft);
    check("no page errors in the whole funnel", errors.length === 0, errors.join(" | "));

    /* Meta: one Lead per person, the booking is Schedule. */
    const fbq = await fbqLog(page);
    const allLeads = fbq.filter((c) => c[0] === "track" && c[1] === "Lead");
    /*
     * The transition switch (NEXT_PUBLIC_META_LEGACY_FREE_VISIT_LEAD, on unless
     * "false") keeps the old free-visit Lead alongside Schedule until the live
     * campaigns are confirmed not to depend on it. It is marked
     * lead_type "free_visit_legacy" and is the only extra Lead allowed.
     */
    const legacyOn = process.env.NEXT_PUBLIC_META_LEGACY_FREE_VISIT_LEAD !== "false";
    const legacy = allLeads.filter((l) => l[2]?.lead_type === "free_visit_legacy");
    const leads = allLeads.filter((l) => l[2]?.lead_type !== "free_visit_legacy");
    const schedules = fbq.filter((c) => c[0] === "track" && c[1] === "Schedule");
    check("cold booker: exactly one Lead, and it is the account", leads.length === 1 && leads[0][2]?.lead_type === "account" && leads[0][2]?.content_name === "account_created", JSON.stringify(leads.map((l) => l[2])));
    check(
      legacyOn ? "transition: the legacy free-visit Lead still fires once, with its old content_name and status" : "legacy free-visit Lead is retired",
      legacyOn
        ? legacy.length === 1 && legacy[0][2]?.content_name === "free_first_visit" && legacy[0][2]?.status === "free_visit_booked"
        : legacy.length === 0,
      JSON.stringify(legacy.map((l) => l[2]))
    );
    check("cold booker: the booking is one Schedule with an eventID", schedules.length === 1 && !!schedules[0][3]?.eventID && schedules[0][2]?.content_name === "free_first_visit", JSON.stringify(schedules));
    const relayed = state.relays.filter((r) => r.eventName === "Schedule");
    check("Schedule is relayed to the server with the same event id", relayed.length === 1 && relayed[0].eventId === schedules[0]?.[3]?.eventID, JSON.stringify(state.relays.map((r) => [r.eventName, r.eventId])));
    const leadRelays = state.relays.filter((r) => r.eventName === "Lead");
    check(
      "the account Lead is not relayed from the browser (registration sends it); only the legacy Lead is, as before",
      legacyOn ? leadRelays.length === 1 && leadRelays[0].eventId === legacy[0]?.[3]?.eventID : leadRelays.length === 0,
      JSON.stringify(leadRelays)
    );
    const custom = fbq.filter((c) => c[0] === "trackCustom").map((c) => c[1]);
    check("date, time and photo taps no longer reach Meta", !custom.some((n) => /^free_visit_/.test(n)), custom.join(","));
    const dl = await dlLog(page);
    check("the dataLayer still gets the free-visit funnel steps", ["free_visit_date_selected", "free_visit_time_selected", "free_visit_booked"].every((n) => dl.some((e) => e.event === n)));
    await ctx.close();
  }

  /* 1b. Plain /signup, no ?next: the new customer lands on the free-visit booker. */
  {
    console.log("\n--- plain /signup lands on the free-visit booker ---");
    const { ctx, page } = await newContext(browser);
    await page.goto(BASE + "/signup", { waitUntil: "networkidle" });
    await completeSignup(page);
    await finishSignupSteps(page);
    await page.click('button[type="submit"]');
    await page.waitForURL((u) => u.pathname === "/book/free", { timeout: 15000 }).catch(() => {});
    check("signup without ?next goes to /book/free", new URL(page.url()).pathname === "/book/free", page.url());
    await page.waitForSelector('[data-fv="book"]', { timeout: 10000 }).catch(() => {});
    check("/book/free offers the eligible new customer the booker", (await page.locator('[data-fv="book"]').count()) === 1);
    await ctx.close();
  }

  /* 2. The slot goes while they sign up. */
  {
    console.log("\n--- slot taken during signup ---");
    const { ctx, page, state } = await newContext(browser, {
      bookingQueue: [{ status: 409, body: { code: "SLOT_UNAVAILABLE", message: "This time is no longer available." } }],
    });
    await page.goto(BASE + "/", { waitUntil: "networkidle" });
    const visit = await buildVisit(page, { photo: false });
    // No photo: use the library instead, which must also carry through.
    await page.locator("[data-library-open]").or(page.getByText("Choose from Profixter Library")).first().click();
    await page.locator('[role="dialog"] button[aria-pressed]').first().click();
    await page.waitForTimeout(500);
    const lib = await page.evaluate(() => JSON.parse(sessionStorage.getItem("pf_free_visit_draft") || "{}").libraryReference);
    await page.click('[data-fv="book"]');
    await page.waitForURL(/\/signup/);
    await completeSignup(page);
    await finishSignupSteps(page);
    await page.click('button[type="submit"]');
    await page.waitForURL((u) => u.pathname === "/book/free", { timeout: 15000 });
    await page.waitForSelector(".fv-notice", { timeout: 20000 }).catch(() => {});
    check("taken slot: plain message shown", (await page.locator(".fv-notice").innerText().catch(() => "")).includes("just taken"));
    check("taken slot: note kept", (await page.inputValue('[data-fv="note"]')) === "The bathroom faucet drips and a towel bar fell off");
    check("taken slot: same day still selected, time cleared", (await page.locator(".fv-day--selected").getAttribute("data-booking-date")) === visit.date && (await page.locator(".fv-slot--selected").count()) === 0);
    check("library example carried through signup", !!lib && state.bookingPosts[0]?.libraryReference === lib, lib);
    // Choose again and book - signed in now, so it books in place.
    await page.locator('[data-booking-time-available="true"]').first().click();
    await page.click('[data-fv="book"]');
    await page.waitForSelector("text=You’re booked.", { timeout: 15000 }).catch(() => {});
    check("taken slot: re-pick books without signing up again", (await page.locator("text=You’re booked.").count()) === 1 && state.registerPosts === 1 && state.bookingPosts.length === 2);
    await ctx.close();
  }

  /* 3. Out of area, caught at the address step before an account exists. */
  {
    console.log("\n--- out-of-area address ---");
    const { ctx, page, state } = await newContext(browser);
    await page.goto(BASE + "/", { waitUntil: "networkidle" });
    await buildVisit(page);
    await page.click('[data-fv="book"]');
    await page.waitForURL(/\/signup/);
    await completeSignup(page, { zip: "10001" });
    const err = await page.locator(".auth-error").allInnerTexts();
    check("out-of-area: stopped at the address step", err.join(" ").includes("don't serve this address") && (await page.locator("#name").count()) === 0, err.join(" | "));
    check("out-of-area: no account created", state.registerPosts === 0);
    await ctx.close();
  }

  /* 4. Signed-in states. */
  {
    console.log("\n--- signed-in non-member whose free visit is used ---");
    const { ctx, page } = await newContext(browser, { signedIn: true, next: { freeFirstVisitAvailable: false, introVisitStatus: "consumed", introVisitServiceable: true, hasSubscription: false } });
    await page.goto(BASE + "/", { waitUntil: "networkidle" });
    await page.waitForSelector('[data-fv-access="used"]', { timeout: 10000 }).catch(() => {});
    check("used: booker says so and offers one-time + plans", (await page.locator('[data-fv-access="used"]').count()) === 1 && (await page.locator('[data-fv="book"]').count()) === 0);
    await ctx.close();
  }
  {
    console.log("\n--- signed-in, address outside the service area ---");
    const { ctx, page } = await newContext(browser, { signedIn: true, next: { freeFirstVisitAvailable: false, introVisitStatus: "available", introVisitServiceable: false, hasSubscription: false } });
    await page.goto(BASE + "/book/free", { waitUntil: "networkidle" });
    await page.waitForSelector('[data-fv-access="outside"]', { timeout: 10000 }).catch(() => {});
    check("outside: no promise, plain explanation", (await page.locator('[data-fv-access="outside"]').count()) === 1 && (await page.locator('[data-fv="book"]').count()) === 0);
    await ctx.close();
  }
  {
    console.log("\n--- out of area: email waitlist ---");
    const { ctx, page, state } = await newContext(browser, {
      signedIn: true,
      next: { freeFirstVisitAvailable: false, introVisitStatus: "available", introVisitServiceable: false, hasSubscription: false },
      waitlistQueue: [
        { status: 400, body: { ok: false, code: "IN_SERVICE_AREA" } },
        { status: 429, body: { ok: false } },
        { abort: true },
        { status: 201, body: { ok: true } },
      ],
    });
    await page.goto(BASE + "/book/free", { waitUntil: "networkidle" });
    await page.waitForSelector('[data-fv-waitlist="form"]', { timeout: 10000 }).catch(() => {});
    const form = page.locator('[data-fv-waitlist="form"]');
    check("waitlist: offered instead of a dead end", (await form.count()) === 1);
    check("waitlist: email only - no phone field, no SMS wording", (await form.locator('input[type="tel"]').count()) === 0 && !/sms|text message/i.test(await form.innerText()));
    check("waitlist: box starts unticked", !(await page.isChecked('[data-fv-waitlist="consent"]')));
    check("waitlist: box says exactly what it is for", (await form.innerText()).includes("Email me when Profixter starts serving my area"));
    check("waitlist: the account email is prefilled", (await page.inputValue('[data-fv-waitlist="email"]')) === "test@example.com");
    const message = () => page.locator('[data-fv-waitlist="message"]').innerText().catch(() => "");
    const submit = async () => { await page.click('[data-fv-waitlist="submit"]'); await page.waitForTimeout(700); };

    await submit();
    check("waitlist: unticked box blocks the request", /tick the box/i.test(await message()) && state.waitlistPosts.length === 0, await message());
    await page.fill('[data-fv-waitlist="email"]', "not-an-email");
    await page.check('[data-fv-waitlist="consent"]');
    await submit();
    check("waitlist: a bad email is caught before sending", /valid email/i.test(await message()) && state.waitlistPosts.length === 0, await message());
    await page.fill('[data-fv-waitlist="email"]', "pat@example.com");
    await submit();
    check("waitlist: IN_SERVICE_AREA is explained", /already serve/i.test(await message()), await message());
    await submit();
    check("waitlist: 429 says try again later", /try again later/i.test(await message()), await message());
    await submit();
    check("waitlist: a network failure is shown inline", /reach our server/i.test(await message()), await message());
    await submit();
    await page.waitForSelector('[data-fv-waitlist="done"]', { timeout: 5000 }).catch(() => {});
    check("waitlist: success shows a calm confirmation", (await page.locator('[data-fv-waitlist="done"]').count()) === 1);

    const body = state.waitlistPosts[state.waitlistPosts.length - 1] || {};
    check("waitlist: POST carries email, ZIP, consent and source", body.email === "pat@example.com" && body.zip === "11758" && body.consentEmail === true && body.source === "free_visit_booker", JSON.stringify(body));
    check("waitlist: POST carries no phone and no SMS consent", !("phone" in body) && !Object.keys(body).some((k) => /sms/i.test(k)));

    await page.reload({ waitUntil: "networkidle" });
    await page.waitForTimeout(1200);
    const dl = await dlLog(page);
    check("out_of_area_shown is recorded once per tab, not per render", dl.filter((e) => e.event === "out_of_area_shown").length === 1, String(dl.filter((e) => e.event === "out_of_area_shown").length));
    const fbq = await fbqLog(page);
    check("out_of_area_waitlist reaches the dataLayer and Meta as a custom event", dl.filter((e) => e.event === "out_of_area_waitlist").length === 1 && fbq.filter((c) => c[0] === "trackCustom" && c[1] === "out_of_area_waitlist").length === 1);
    check("out of area: never a Meta Lead or Schedule", !fbq.some((c) => c[0] === "track" && (c[1] === "Lead" || c[1] === "Schedule")));
    await ctx.close();
  }
  {
    console.log("\n--- active member ---");
    const { ctx, page } = await newContext(browser, { signedIn: true, member: true });
    await page.goto(BASE + "/", { waitUntil: "networkidle" });
    await page.waitForTimeout(1500);
    check("member home: no free-visit booker", (await page.locator('[data-fv="note"]').count()) === 0);
    await page.goto(BASE + "/book", { waitUntil: "networkidle" });
    await page.waitForTimeout(1500);
    check("member /book: still signed in, on /book", new URL(page.url()).pathname === "/book", page.url());
    check("member /book: Book Fixter is the member calendar", /Book Your Visit/i.test(await page.locator("body").innerText()) && (await page.locator('[data-booking-date]').count()) > 0);
    check("member /book: no plans, no free booker", (await page.locator("[data-plan-picker]").count()) === 0 && (await page.locator('[data-fv="note"]').count()) === 0);
    await ctx.close();
  }
  {
    console.log("\n--- anonymous /book ---");
    const { ctx, page } = await newContext(browser);
    await page.goto(BASE + "/book", { waitUntil: "networkidle" });
    await page.waitForTimeout(1200);
    check("anonymous /book opens on Book Fixter", (await activeTab(page)) === "Book Fixter", await activeTab(page));
    check("anonymous /book: four plans, no essay", (await page.locator("[data-plan-option]").count()) === 4 && !/Get a Fixter for your home/i.test(await page.locator("body").innerText()));
    check("anonymous /book: free visit one line away", (await page.locator('a[data-book-free-visit][href="/book/free"]').count()) === 1);
    await page.goto(BASE + "/book?visit=additional", { waitUntil: "networkidle" });
    await page.waitForTimeout(1200);
    check("explicit ?visit=additional still opens One-Time", (await page.locator('[data-fv="note"]').count()) === 0 && (await page.content()).includes("$99"));
    await ctx.close();
  }

  /* 5. Refresh on the booker keeps the work. */
  {
    console.log("\n--- refresh keeps the draft ---");
    const { ctx, page } = await newContext(browser);
    await page.goto(BASE + "/book/free", { waitUntil: "networkidle" });
    const visit = await buildVisit(page);
    await page.reload({ waitUntil: "networkidle" });
    await page.waitForTimeout(1500);
    check("refresh: note restored", (await page.inputValue('[data-fv="note"]')).startsWith("The bathroom faucet"));
    check("refresh: day and time restored", (await page.locator(".fv-day--selected").getAttribute("data-booking-date").catch(() => "")) === visit.date && (await page.locator(".fv-slot--selected").getAttribute("data-booking-time").catch(() => "")) === visit.time);
    check("refresh: photo restored", (await page.locator(".fv-thumb").count()) === 1);
    await ctx.close();
  }

  /* 6. Plans: chosen before signup, confirmed after it, then checkout. */
  {
    console.log("\n--- plan survives signup ---");
    const { ctx, page, state } = await newContext(browser);
    await page.goto(BASE + "/", { waitUntil: "networkidle" });
    const plansLink = page.locator('a[href="/membership/plans"]').first();
    check("plans are one tap from the landing", (await plansLink.count()) > 0);
    await page.goto(BASE + "/membership/plans", { waitUntil: "networkidle" });
    await page.getByRole("button", { name: /^Annual/ }).first().click();
    await page.getByRole("tab", { name: /Premium/ }).first().click();
    await page.getByRole("button", { name: /Choose Premium|Start with Premium/ }).first().click();
    await page.waitForURL(/\/signup\?next=/, { timeout: 10000 });
    await shot(page, "signup-plan-carry");
    const carry = await page.locator("[data-signup-carry]").innerText().catch(() => "");
    check("signup shows the chosen plan and its price", carry.includes("Premium") && carry.includes("Annual") && carry.includes("$3,490/year"), carry);
    await completeSignup(page);
    await finishSignupSteps(page);
    await page.click('button[type="submit"]');
    await page.waitForURL((u) => u.pathname === "/membership/plans", { timeout: 15000 });
    await page.waitForSelector("[data-plan-resume]", { timeout: 15000 }).catch(() => {});
    await shot(page, "plan-sheet");
    const sheet = await page.locator("[data-plan-resume]").innerText().catch(() => "");
    check("back on plans: confirmation, not the grid", sheet.includes("Premium · Annual") && sheet.includes("3,490"), sheet.replace(/\s+/g, " ").slice(0, 120));
    await page.click("[data-plan-resume-continue]");
    await page.waitForURL(/__stripe_stub/, { timeout: 15000 }).catch(() => {});
    const body = state.checkoutPosts[0] || {};
    check("checkout opened for premium annual on the new address", body.plan === "premium" && body.billingCycle === "annual" && body.addressId === "addr1", JSON.stringify(body));
    await ctx.close();
  }
  {
    console.log("\n--- member opening plans with a stale pending plan ---");
    const { ctx, page } = await newContext(browser, { signedIn: true, member: true });
    await page.addInitScript(() => sessionStorage.setItem("pendingCheckoutPlan", JSON.stringify({ plan: "premium", billingCycle: "annual", planName: "Premium" })));
    await page.goto(BASE + "/membership/plans?plan=premium&billingCycle=annual&resume=1", { waitUntil: "networkidle" });
    await page.waitForTimeout(2500);
    check("member: no new-customer checkout sheet", (await page.locator("[data-plan-resume]").count()) === 0);
    await ctx.close();
  }

  /* 7. Book is membership-first: a non-member buys a plan right on the tab. */
  for (const [planName, cycle] of [["Basic", "monthly"], ["Plus", "monthly"], ["Premium", "monthly"], ["Elite", "monthly"], ["Premium", "annual"]]) {
    console.log(`\n--- registered non-member buys ${planName} ${cycle} from Book ---`);
    const { ctx, page, state } = await newContext(browser, { signedIn: true, next: { freeFirstVisitAvailable: false, introVisitStatus: "consumed", introVisitServiceable: true, hasSubscription: false } });
    await page.goto(BASE + "/book", { waitUntil: "networkidle" });
    await page.waitForSelector("[data-plan-picker]", { timeout: 15000 }).catch(() => {});
    if (planName === "Basic" && cycle === "monthly") {
      check("non-member /book opens on Book Fixter", (await activeTab(page)) === "Book Fixter", await activeTab(page));
      check("non-member /book: four plans immediately", (await page.locator("[data-plan-option]").count()) === 4);
      check("non-member /book: no membership essay, no See plans detour", !/Get a Fixter for your home/i.test(await page.locator("body").innerText()));
      check("non-member /book: visit history still here", (await page.locator("#your-visits").count()) === 1);
    }
    if (cycle === "annual") await page.getByRole("button", { name: /^Annual/ }).first().click();
    await page.click(`[data-plan-option="${planName}"]`);
    await page.click("[data-plan-picker-continue]");
    await page.waitForSelector("[data-plan-resume]", { timeout: 10000 }).catch(() => {});
    const sheet = (await page.locator("[data-plan-resume]").innerText().catch(() => "")).replace(/\s+/g, " ");
    check(`${planName} ${cycle}: confirmation shows plan and cycle`, sheet.includes(`${planName} · ${cycle === "annual" ? "Annual" : "Monthly"}`), sheet.slice(0, 80));
    await page.click("[data-plan-resume-continue]");
    await page.waitForURL(/__stripe_stub/, { timeout: 15000 }).catch(() => {});
    const body = state.checkoutPosts[0] || {};
    check(`${planName} ${cycle}: checkout gets the plan chosen on Book`, body.plan === planName.toLowerCase() && body.billingCycle === cycle && body.addressId === "addr1", JSON.stringify(body));
    await ctx.close();
  }
  {
    console.log("\n--- anonymous: plan chosen on Book survives signup, back to Book ---");
    const { ctx, page, state } = await newContext(browser);
    await page.goto(BASE + "/book", { waitUntil: "networkidle" });
    await page.getByRole("button", { name: /^Annual/ }).first().click();
    await page.click('[data-plan-option="Elite"]');
    await page.click("[data-plan-picker-continue]");
    await page.waitForURL(/\/signup\?next=/, { timeout: 10000 });
    const carry = (await page.locator("[data-signup-carry]").innerText().catch(() => "")).replace(/\s+/g, " ");
    check("signup shows Elite annual chosen on Book", carry.includes("Elite") && carry.includes("$4,990/year"), carry);
    await completeSignup(page);
    await finishSignupSteps(page);
    await page.click('button[type="submit"]');
    await page.waitForURL((u) => u.pathname === "/book", { timeout: 15000 }).catch(() => {});
    check("signup returns to Book", new URL(page.url()).pathname === "/book", page.url());
    await page.waitForSelector("[data-plan-resume]", { timeout: 15000 }).catch(() => {});
    await page.click("[data-plan-resume-continue]").catch(() => {});
    await page.waitForURL(/__stripe_stub/, { timeout: 15000 }).catch(() => {});
    const body = state.checkoutPosts[0] || {};
    check("checkout gets Elite annual, chosen once", body.plan === "elite" && body.billingCycle === "annual", JSON.stringify(body));
    await ctx.close();
  }

  /* 8. One-Time, Full Day and Priority are still there when chosen; back and logout behave. */
  {
    console.log("\n--- tabs, back button, logout ---");
    const { ctx, page } = await newContext(browser, { signedIn: true, next: { freeFirstVisitAvailable: false, introVisitStatus: "consumed", introVisitServiceable: true, hasSubscription: false } });
    await page.goto(BASE + "/book", { waitUntil: "networkidle" });
    await page.waitForSelector("[data-plan-picker]", { timeout: 15000 }).catch(() => {});
    for (const [label, expectInUrl] of [["One-Time", "visit=additional"], ["Full Day", "visit=full-day"], ["Priority", "visit=priority"]]) {
      await page.locator('nav[aria-label="Visit type"] a', { hasText: label }).first().click();
      await page.waitForURL(new RegExp(expectInUrl), { timeout: 10000 }).catch(() => {});
      await page.waitForTimeout(800);
      check(`${label} tab opens when chosen`, page.url().includes(expectInUrl) && (await activeTab(page)) === label && (await page.locator("[data-plan-picker]").count()) === 0, page.url());
    }
    check("One-Time still shows its $99 visit", await page.goto(BASE + "/book?visit=additional", { waitUntil: "networkidle" }).then(async () => { await page.waitForTimeout(800); return (await page.content()).includes("$99"); }));
    await page.goto(BASE + "/book", { waitUntil: "networkidle" });
    await page.locator('nav[aria-label="Visit type"] a', { hasText: "One-Time" }).first().click();
    await page.waitForURL(/visit=additional/, { timeout: 10000 }).catch(() => {});
    await page.goBack({ waitUntil: "networkidle" });
    await page.waitForTimeout(800);
    check("back from One-Time returns to Book Fixter", (await activeTab(page)) === "Book Fixter", page.url());
    await page.evaluate(() => localStorage.removeItem("token"));
    await page.reload({ waitUntil: "networkidle" });
    await page.waitForTimeout(1200);
    check("after logout /book still opens Book Fixter with plans", (await activeTab(page)) === "Book Fixter" && (await page.locator("[data-plan-option]").count()) === 4);
    await ctx.close();
  }

  await browser.close();
  const failed = results.filter((r) => !r.pass);
  console.log(`\n${results.length - failed.length}/${results.length} passed`);
  process.exit(failed.length ? 1 : 0);
})();
