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
 * Account, booking and checkout endpoints are faked in the browser, so the run
 * creates no account, no booking and no Stripe session. The calendar and the
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
  const state = { bookingPosts: [], checkoutPosts: [], registerPosts: 0, bookingQueue: opts.bookingQueue || [] };
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
    const isPublic = /^\/api\/(calendar|service-area|recent-work|google|reviews|event-display|promotions?|popups?)(\/|$)/.test(p);
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

async function newContext(browser, { signedIn = false, ...opts } = {}) {
  const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true });
  await ctx.addInitScript(([token, signedIn]) => {
    try {
      localStorage.setItem("profixter_promotion_popup_dismissed_date", new Date().toISOString().slice(0, 10));
      if (signedIn) localStorage.setItem("token", token);
    } catch {}
  }, [TOKEN, signedIn]);
  const state = await fakeApi(ctx, opts);
  const page = await ctx.newPage();
  const errors = [];
  page.on("pageerror", (e) => errors.push(e.message));
  if (process.env.FUNNEL_DEBUG) page.on("response", async (r) => { if (r.url().includes("/api/calendar/slots")) console.log("      <- slots", r.status(), (await r.text().catch(() => "?")).slice(0, 160)); });
  if (process.env.FUNNEL_DEBUG) page.on("request", (r) => { if (r.url().startsWith(API) && r.method() !== "OPTIONS") console.log("      ->", r.method(), r.url().replace(API, "").slice(0, 90)); });
  return { ctx, page, state, errors };
}

async function buildVisit(page, { photo = true } = {}) {
  await page.fill('[data-fv="note"]', "The bathroom faucet drips and a towel bar fell off");
  if (photo) {
    await page.setInputFiles('[data-fv="photos"] input[type=file]', pngFile());
    await page.waitForSelector(".fv-thumb", { timeout: 10000 });
  }
  await page.locator('[data-booking-date-disabled="false"]').first().click();
  await page.waitForSelector('[data-booking-time-available="true"]', { timeout: 15000 });
  const slot = page.locator('[data-booking-time-available="true"]').first();
  const time = await slot.getAttribute("data-booking-time");
  await slot.click();
  const date = await page.locator(".fv-day--selected").getAttribute("data-booking-date");
  return { date, time };
}

async function completeSignup(page, { zip = "11758" } = {}) {
  // Step 1: address. Use the manual entry the field offers when lookup fails.
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
    check("summary assembles after a time is picked", await page.locator(".fv-summary").isVisible(), `${visit.date} ${visit.time}`);
    const taken = await page.locator('[data-booking-time-available="false"]').count();
    console.log(`      (live day ${visit.date} shows ${taken} booked slot(s) as disabled)`);

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
    await page.locator("text=Choose from Profixter Library").first().click();
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
    console.log("\n--- active member ---");
    const { ctx, page } = await newContext(browser, { signedIn: true, member: true });
    await page.goto(BASE + "/", { waitUntil: "networkidle" });
    await page.waitForTimeout(1500);
    check("member home: no free-visit booker", (await page.locator('[data-fv="note"]').count()) === 0);
    await page.goto(BASE + "/book", { waitUntil: "networkidle" });
    await page.waitForTimeout(1500);
    check("member /book: unchanged member calendar, no free booker", (await page.locator('[data-fv="note"]').count()) === 0);
    await ctx.close();
  }
  {
    console.log("\n--- anonymous /book ---");
    const { ctx, page } = await newContext(browser);
    await page.goto(BASE + "/book", { waitUntil: "networkidle" });
    await page.waitForTimeout(1200);
    check("anonymous /book opens the free-visit booker", (await page.locator('[data-fv="note"]').count()) === 1);
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

  await browser.close();
  const failed = results.filter((r) => !r.pass);
  console.log(`\n${results.length - failed.length}/${results.length} passed`);
  process.exit(failed.length ? 1 : 0);
})();
