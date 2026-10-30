/* eslint-disable @typescript-eslint/no-require-imports -- a plain Node script, like its neighbours */
/*
 * Admin phone tools, in the browser, against a mocked API (2026-10-30).
 *
 *   node scripts/test_admin_tools_ui.js [baseUrl] [screenshotDir]
 *
 * The mock answers the way BackEnd routes/adminCustomers.js, adminSales.js and
 * pay.js do (pinned by BackEnd scripts/test_admin_tools_integration.js).
 * At a phone (390) and a desktop (1440) width it checks:
 * - Create customer: field errors, the shared-phone confirmation, all four
 *   message switches on and sent, a visible confirmation
 * - customer details: the Messages panel (service/marketing x email/SMS) toggles
 * - Buy membership: pay by phone opens Stripe's page; send link confirms
 * - Create visit from Jobs: guest + Free Visit — Admin with a photo; existing
 *   customer + One-Time Visit paid by phone
 * - the customer's forced new-password screen, and the /pay link page
 * - nothing scrolls sideways
 */
const { chromium } = require("playwright");
const fs = require("fs");
const path = require("path");
const os = require("os");

const BASE = process.argv[2] || "http://localhost:3000";
const SHOTS = process.argv[3] || "";
if (SHOTS) fs.mkdirSync(SHOTS, { recursive: true });

const results = [];
function check(name, pass, detail = "") {
  results.push({ name, pass: !!pass });
  console.log(`${pass ? "PASS" : "FAIL"}  ${name}${detail ? "  :: " + detail : ""}`);
}

const OWNER = { _id: "o", userId: "1", name: "Owner", email: "getfixter@gmail.com", role: "customer", isOwner: true, permissions: [], addresses: [] };
const ADDRESS = { _id: "a1", label: "Primary", line1: "12 Oak Street", city: "Massapequa", state: "NY", zip: "11758", county: "Nassau" };
const ROW = {
  _id: "c1",
  userId: "20000001",
  name: "Casey Customer",
  email: "casey@example.com",
  phone: "+16315550101",
  createdAt: "2026-01-01T00:00:00Z",
  addresses: [ADDRESS],
  defaultAddressId: "a1",
  addressesDetailed: [{ ...ADDRESS, isDefault: true, plan: "basic", scheduledCancellationDate: null }],
  completedBookings: 4,
};
const OPTIONS = {
  plans: [
    { key: "basic", label: "Basic", monthly: 149, annual: 1490 },
    { key: "plus", label: "Plus", monthly: 249, annual: 2490 },
    { key: "premium", label: "Premium", monthly: 349, annual: 3490 },
    { key: "elite", label: "Elite", monthly: 499, annual: 4990 },
  ],
  oneTime: { enabled: true, priceCents: 14900 },
  fullDay: { enabled: true, priceCents: 49900 },
};
const sw = (enabled, locked = null) => ({ enabled, locked, changedAt: null, source: "admin_phone" });

function dayAhead(n) {
  const d = new Date(Date.now() + n * 86400000);
  return d.toISOString().slice(0, 10);
}

async function open(browser, width, me = OWNER) {
  const ctx = await browser.newContext({ viewport: { width, height: width < 700 ? 844 : 900 }, isMobile: width < 700, hasTouch: width < 700 });
  await ctx.addInitScript(() => {
    localStorage.setItem("token", "ui-token");
    localStorage.setItem("profixter_promotion_popup_dismissed_date", new Date().toISOString().slice(0, 10));
    // Record new tabs instead of opening them.
    window.__opened = [];
    window.open = () => {
      const tab = { opener: null, closed: false, close() { this.closed = true; }, location: { set href(v) { window.__opened.push(v); }, get href() { return ""; } } };
      return tab;
    };
  });
  const state = {
    me,
    creates: [],
    commPuts: [],
    comm: { service: { email: sw(true), sms: sw(true) }, marketing: { email: sw(true), sms: sw(true) } },
    sales: [],
    visits: [],
    passwordPosts: [],
    payPosts: 0,
    payStatus: "open",
  };
  await ctx.route("https://checkout.stripe.test/**", (route) => route.fulfill({ status: 200, contentType: "text/html", body: "<h1>Stripe test checkout</h1>" }));
  await ctx.route(/\/api\//, async (route) => {
    const req = route.request();
    const u = new URL(req.url());
    const cors = { "access-control-allow-origin": "*", "access-control-allow-headers": "Authorization,Content-Type", "access-control-allow-methods": "GET,POST,PUT,PATCH,DELETE,OPTIONS" };
    if (req.method() === "OPTIONS") return route.fulfill({ status: 204, headers: cors });
    const json = (body, status = 200) => route.fulfill({ status, contentType: "application/json", headers: cors, body: JSON.stringify(body) });
    const p = u.pathname;
    const m = req.method();
    if (p === "/api/auth/me") return json(state.me);
    if (p === "/api/admin/users" && m === "GET") return json([ROW]);
    if (p === "/api/admin/members") return json([ROW]);
    if (p === "/api/admin/bookings") return json([]);
    if (p === "/api/admin/customers" && m === "POST") {
      const body = JSON.parse(req.postData() || "{}");
      state.creates.push(body);
      if (!body.firstName) return json({ code: "INVALID", message: "Please check the highlighted fields.", errors: { firstName: "Enter the first name.", lastName: "Enter the last name.", phone: "Enter a valid US phone number.", email: "Enter a valid email address." } }, 400);
      if (!body.allowSharedPhone) return json({ code: "PHONE_IN_USE", message: "This phone number is already on another customer's account.", errors: { phone: "Already on another account." }, existing: [{ id: "c9", name: "Dana Smith", email: "da***@example.com" }] }, 409);
      return json({ customer: { _id: "c2", userId: "30000001", name: `${body.firstName} ${body.lastName}`, email: body.email, phone: body.phone, addresses: [] }, delivery: { email: "sent", sms: "sent" }, temporaryPasswordExpiresAt: new Date(Date.now() + 72 * 3600000).toISOString(), warnings: [] }, 201);
    }
    if (p === "/api/admin/users/c1/communication" && m === "GET") return json(state.comm);
    if (p === "/api/admin/users/c1/communication" && m === "PUT") {
      const body = JSON.parse(req.postData() || "{}");
      state.commPuts.push(body);
      const [purpose, channel] = body.key.split(".");
      state.comm = { ...state.comm, [purpose]: { ...state.comm[purpose], [channel]: sw(body.enabled) } };
      return json({ changed: true, state: state.comm });
    }
    if (p === "/api/admin/sales/options") return json(OPTIONS);
    if (p === "/api/admin/customers/c1/membership-options") return json({ homes: [{ addressId: "a1", label: "Primary", line: "12 Oak Street, Massapequa, NY, 11758", current: null, canBuy: true, blocked: null }, { addressId: "a2", label: "Rental", line: "8 Bay Rd, Babylon, NY, 11702", current: { plan: "plus", billingCycle: "monthly", status: "active" }, canBuy: false, blocked: { code: "ADDRESS_ALREADY_SUBSCRIBED", message: "This address already has an active plan." } }], hasEmail: true, hasPhone: true });
    if (p === "/api/admin/customers/c1/membership-sale") {
      const body = JSON.parse(req.postData() || "{}");
      state.sales.push(body);
      return body.method === "phone"
        ? json({ method: "phone", url: "https://checkout.stripe.test/cs_member", billingStartsAt: null })
        : json({ method: "link", payUrl: "https://www.profixter.com/pay/AbCdEfGhIjKlMnOpQrStUv", delivery: { email: "sent", sms: "sent" }, expiresAt: new Date().toISOString(), linkDays: 7 });
    }
    if (p === "/api/calendar/slots") return json({ date: u.searchParams.get("date"), available: true, slots: [{ time: "08:00", available: true }, { time: "10:00", available: true }, { time: "13:00", available: true }] });
    if (p === "/api/bookings/full-day/availability") return json({ timezone: "America/New_York", engine: "reservation", days: [{ date: u.searchParams.get("from"), available: true, fixtersAvailable: 1, startTime: "08:00", endTime: "16:00", hours: 8, reason: "" }] });
    if (p === "/api/admin/visits" && m === "POST") {
      const raw = req.postDataBuffer() || Buffer.alloc(0);
      const text = raw.toString("latin1");
      const field = (name) => {
        const match = text.match(new RegExp(`name="${name}"\\r\\n\\r\\n([^\\r]*)`));
        return match ? match[1] : undefined;
      };
      const visit = { type: field("type"), mode: field("mode"), date: field("date"), time: field("time"), task: field("task"), payment: field("payment"), guestName: field("guestName"), guestSmsConsent: field("guestSmsConsent"), userId: field("userId"), addressId: field("addressId"), photos: (text.match(/name="images"; filename=/g) || []).length };
      state.visits.push(visit);
      const booking = { _id: `b${state.visits.length}`, bookingNumber: "12345678", date: new Date().toISOString(), service: visit.task, status: "Pending", accessType: visit.type === "admin_free" ? "admin" : "one_time", bookingType: "membership_visit", paymentState: visit.type === "admin_free" ? "not_required" : "pending", images: [] };
      if (visit.type === "one_time" || visit.type === "full_day") {
        return json({ booking, payment: visit.payment === "link" ? { method: "link", payUrl: "https://www.profixter.com/pay/x", delivery: { email: "sent", sms: "sent" }, expiresAt: new Date().toISOString(), linkId: "l1" } : { method: "phone", url: "https://checkout.stripe.test/cs_visit", expiresAt: new Date().toISOString() } }, 201);
      }
      return json({ booking, payment: null }, 201);
    }
    if (p === "/api/auth/change-password" && m === "POST") {
      state.passwordPosts.push(JSON.parse(req.postData() || "{}"));
      state.me = { ...state.me, mustChangePassword: false, temporaryPassword: false };
      return json({ message: "Password updated successfully", user: state.me });
    }
    if (p === "/api/pay/TokTokTokTokTokTokTok1") return json({ status: state.payStatus, kind: "membership", itemLabel: "your Basic membership (monthly)", expiresAt: new Date(Date.now() + 86400000).toISOString() });
    if (p === "/api/pay/TokTokTokTokTokTokTok1/checkout") {
      state.payPosts += 1;
      return json({ url: "https://checkout.stripe.test/cs_link" });
    }
    if (p === "/api/pay/ExpiredExpiredExpired1") return json({ status: "expired", kind: "one_time", itemLabel: "your One-Time Visit on Tue, Nov 10" });
    if (p.startsWith("/api/admin/users/c1/activity")) return json({ user: ROW, limit: 10, total: 0, items: [] });
    if (p === "/api/admin/users/c1/sms-consent") return json({ transactionalEnabled: true, marketingEnabled: true, phoneOptedOut: false });
    if (p === "/api/admin/users/c1/profile-history") return json({ items: [], masked: false });
    if (p === "/api/admin/users/c1/loyalty") return json({ programActive: true, programStartedAt: null, completedBookings: 4, addresses: [] });
    if (p === "/api/admin/members/loyalty") return json({ programActive: true, programStartedAt: null, rows: [] });
    if (p.startsWith("/api/admin/communications")) return json({ items: [], total: 0 });
    if (p === "/api/admin/activity-log/summary") return json({ usersDeleted: 0, leadsDeleted: 0, projectsDeleted: 0 });
    return json([]);
  });
  const page = await ctx.newPage();
  const errors = [];
  page.on("pageerror", (e) => errors.push(e.message));
  page.on("dialog", (d) => d.dismiss());
  return { ctx, page, state, errors };
}

const noSideScroll = (page) => page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth + 1);
const shot = async (page, name) => {
  if (SHOTS) await page.screenshot({ path: `${SHOTS}/${name}.png` }).catch(() => {});
};
const visible = (page, selector) => page.locator(selector).locator("visible=true");

(async () => {
  const browser = await chromium.launch();
  const photoPath = path.join(os.tmpdir(), "admin-tools-photo.png");
  fs.writeFileSync(photoPath, Buffer.from("iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==", "base64"));

  for (const width of [390, 1440]) {
    const tag = width < 700 ? "mobile" : "desktop";
    console.log(`\n--- owner, ${width}px ---`);
    const { ctx, page, state, errors } = await open(browser, width);

    /* ---------------- Create customer ---------------- */
    await page.goto(`${BASE}/admin?tab=users`, { waitUntil: "networkidle" });
    await visible(page, "text=Casey Customer").first().waitFor({ timeout: 20000 });
    const createBtn = page.locator("[data-action=open-create-customer]");
    check(`${tag}: Create customer button on All Users`, await createBtn.isVisible());
    await createBtn.click();
    const cc = page.locator("[data-admin-sheet=create-customer]");
    await cc.waitFor();
    check(`${tag}: all four message switches start on`, (await cc.locator("[role=switch][aria-checked=true]").count()) === 4);
    await shot(page, `${tag}-01-create-customer`);
    check(`${tag}: create sheet fits without sideways scroll`, await noSideScroll(page));
    await cc.locator("[data-action=create-customer-submit]").click();
    await cc.locator("text=Enter the first name.").waitFor({ timeout: 5000 });
    check(`${tag}: server field errors shown next to fields`, (await cc.locator("text=Enter a valid US phone number.").count()) === 1);
    await cc.locator("input[name=firstName]").fill("Rosa");
    await cc.locator("input[name=lastName]").fill("Diaz");
    await cc.locator("input[name=phone]").fill("(516) 555-0142");
    await cc.locator("input[name=email]").fill("rosa@example.com");
    await cc.locator("[data-switch='new-marketing.sms']").click();
    await cc.locator("[data-action=create-customer-submit]").click();
    await cc.locator("[data-action=create-customer-shared-phone]").waitFor({ timeout: 5000 });
    check(`${tag}: a shared phone asks for confirmation, naming the other account`, (await cc.locator("text=Dana Smith").count()) === 1);
    await shot(page, `${tag}-02-shared-phone`);
    await cc.locator("[data-action=create-customer-shared-phone]").click();
    await page.locator("text=/Rosa Diaz created/").waitFor({ timeout: 5000 });
    const sent = state.creates[state.creates.length - 1];
    check(`${tag}: create sends names, phone, email, chosen switches, shared-phone ok`, sent.firstName === "Rosa" && sent.email === "rosa@example.com" && sent.allowSharedPhone === true && sent.communication["marketing.sms"] === false && sent.communication["service.sms"] === true);
    check(`${tag}: confirmation says the email and text went`, (await page.locator("text=/Email sent · Text sent/").count()) >= 1);
    await shot(page, `${tag}-03-created`);

    /* ---------------- Customer details: messages ---------------- */
    await visible(page, "button:text-is('History'), button:text-is('View history')").first().click();
    await page.locator("text=Customer activity").first().waitFor();
    const panel = page.locator("[data-communication-panel]");
    await panel.locator("[data-comm-value='marketing.sms']:has-text('On')").waitFor({ timeout: 5000 });
    check(`${tag}: Messages panel shows service and marketing, email and SMS`, (await panel.locator("[data-comm-row]").count()) === 4 && (await panel.locator("text=Service messages").count()) === 1 && (await panel.locator("text=Marketing messages").count()) === 1);
    await panel.scrollIntoViewIfNeeded();
    await shot(page, `${tag}-04-messages`);
    await panel.locator("[data-switch='marketing.sms']").click();
    await panel.locator("[data-comm-value='marketing.sms']:has-text('Off')").waitFor({ timeout: 5000 });
    check(`${tag}: toggling sends one change and shows it`, JSON.stringify(state.commPuts[0]) === JSON.stringify({ key: "marketing.sms", enabled: false }));
    check(`${tag}: details view offers Membership and Visit`, (await page.locator("[data-action=open-buy-membership]").count()) === 1 && (await page.locator("[data-action=open-create-visit]").count()) === 1);

    /* ---------------- Buy membership ---------------- */
    await page.locator("[data-action=open-buy-membership]").click();
    const bm = page.locator("[data-admin-sheet=buy-membership]");
    await bm.locator("[data-home=a1]").waitFor({ timeout: 5000 });
    check(`${tag}: an already-billed home is shown and cannot be chosen`, await bm.locator("[data-home=a2]").isDisabled());
    await bm.locator("[data-choice=basic]").click();
    check(`${tag}: pay-by-phone button shows the price`, (await bm.locator("[data-action=buy-membership-submit]:has-text('$149')").count()) === 1);
    await shot(page, `${tag}-05-buy-membership`);
    check(`${tag}: membership sheet fits without sideways scroll`, await noSideScroll(page));
    await bm.locator("[data-action=buy-membership-submit]").click();
    await bm.locator("[data-action=open-stripe]").waitFor({ timeout: 5000 });
    const opened = await page.evaluate(() => window.__opened);
    check(`${tag}: Stripe's checkout opens in a new tab`, opened.includes("https://checkout.stripe.test/cs_member"));
    check(`${tag}: phone sale sent plan, cycle, home, method`, JSON.stringify(state.sales[0]) === JSON.stringify({ addressId: "a1", plan: "basic", billingCycle: "monthly", method: "phone", channels: ["email", "sms"] }));
    await shot(page, `${tag}-06-pay-by-phone`);
    await bm.locator("button:has-text('Done')").click();
    await page.locator("[data-action=open-buy-membership]").click();
    await bm.locator("[data-choice=plus]").waitFor();
    await bm.locator("[data-choice=plus]").click();
    await bm.locator("[data-choice=annual]").click();
    await bm.locator("[data-choice=link]").click();
    await bm.locator("[data-action=buy-membership-submit]").click();
    await page.locator("text=/Payment link sent/").waitFor({ timeout: 5000 });
    check(`${tag}: send link confirms delivery`, state.sales[1].method === "link" && state.sales[1].billingCycle === "annual" && state.sales[1].plan === "plus");
    await page.keyboard.press("Escape");

    /* ---------------- Create visit from Jobs ---------------- */
    await page.goto(`${BASE}/admin?tab=bookings`, { waitUntil: "networkidle" });
    const jobsVisit = page.locator("[data-action=open-create-visit-jobs]");
    await jobsVisit.waitFor({ timeout: 15000 });
    check(`${tag}: + Visit on Jobs`, await jobsVisit.isVisible());
    await jobsVisit.click();
    const cv = page.locator("[data-admin-sheet=create-visit]");
    await cv.waitFor();
    await cv.locator("[data-choice=guest]").click();
    await cv.locator("[data-input=guest-name]").fill("Lee Walker");
    await cv.locator("[data-input=guest-phone]").fill("516-555-0188");
    await cv.locator("[data-input=guest-email]").fill("lee@example.com");
    const manualToggle = cv.locator("button:has-text('Enter it manually'), button:has-text('enter it manually'), button:has-text('Enter manually')");
    if (await manualToggle.count()) await manualToggle.first().click();
    const streetInput = cv.locator("input[autocomplete='address-line1'], input[placeholder*='treet']").first();
    await streetInput.fill("40 Birch Ln");
    const cityInput = cv.locator("input[autocomplete='address-level2'], input[placeholder*='ity']").first();
    if (await cityInput.count()) await cityInput.fill("Farmingdale");
    const zipInput = cv.locator("input[autocomplete='postal-code'], input[placeholder*='ZIP'], input[inputmode=numeric]").first();
    if (await zipInput.count()) await zipInput.fill("11735");
    check(`${tag}: Membership Visit is not offered to a guest`, await cv.locator("[data-choice=membership]").isDisabled());
    await cv.locator("[data-choice=admin_free]").click();
    await cv.locator("[data-input=date]").fill(dayAhead(5));
    await cv.locator("[data-slot='10:00']").waitFor({ timeout: 5000 });
    await cv.locator("[data-slot='10:00']").click();
    await cv.locator("[data-input=task]").fill("Fix squeaky door");
    await cv.locator("[data-input=photos]").setInputFiles(photoPath);
    await cv.locator("[data-photo-count='1']").waitFor({ timeout: 10000 });
    check(`${tag}: camera capture offered for photos`, (await cv.locator("[data-input=camera][capture=environment]").count()) === 1);
    await shot(page, `${tag}-07-create-visit`);
    check(`${tag}: visit sheet fits without sideways scroll`, await noSideScroll(page));
    const submitVisit = cv.locator("[data-action=create-visit-submit]");
    const guestReady = await submitVisit.isEnabled();
    check(`${tag}: guest visit can be submitted`, guestReady);
    if (guestReady) {
      await submitVisit.click();
      await page.locator("text=/Visit #12345678 created/").waitFor({ timeout: 8000 });
      const v = state.visits[state.visits.length - 1];
      check(`${tag}: guest Admin free visit sent with its photo, time and consent`, v.type === "admin_free" && v.mode === "guest" && v.time === "10:00" && v.photos === 1 && v.guestSmsConsent === "true" && !v.payment);
    }

    await jobsVisit.click();
    await cv.waitFor();
    await cv.locator("[data-input=customer-search]").fill("Casey");
    await cv.locator("[data-customer-hit=c1]").click();
    check(`${tag}: a member's home offers Membership Visit`, await cv.locator("[data-choice=membership]").isEnabled());
    await cv.locator("[data-choice=one_time]").click();
    await cv.locator("[data-input=date]").fill(dayAhead(6));
    await cv.locator("[data-slot='13:00']").click();
    await cv.locator("[data-input=task]").fill("Replace faucet");
    check(`${tag}: paid visit offers pay by phone or link`, (await cv.locator("[data-choice=phone]").count()) === 1 && (await cv.locator("[data-choice=link]").count()) === 1);
    await cv.locator("[data-action=create-visit-submit]").click();
    await cv.locator("[data-action=open-stripe]").waitFor({ timeout: 8000 });
    const v2 = state.visits[state.visits.length - 1];
    check(`${tag}: One-Time Visit paid by phone opens Stripe`, v2.type === "one_time" && v2.payment === "phone" && v2.userId === "c1" && v2.addressId === "a1" && (await page.evaluate(() => window.__opened)).includes("https://checkout.stripe.test/cs_visit"));
    await shot(page, `${tag}-08-visit-pay-by-phone`);

    check(`${tag}: no page errors in Admin`, errors.length === 0, errors.join(" | "));
    await ctx.close();

    /* ---------------- Customer: forced new password ---------------- */
    const temp = await open(browser, width, { _id: "c2", userId: "30000001", name: "Rosa Diaz", email: "rosa@example.com", role: "customer", mustChangePassword: true, temporaryPassword: true, addresses: [], permissions: [] });
    await temp.page.goto(`${BASE}/account`, { waitUntil: "networkidle" });
    await temp.page.waitForURL(/\/set-password/, { timeout: 15000 });
    check(`${tag}: a temporary-password session lands on Create your password`, (await temp.page.locator("text=Create your password").count()) >= 1);
    await shot(temp.page, `${tag}-09-set-password`);
    check(`${tag}: password screen fits without sideways scroll`, await noSideScroll(temp.page));
    await temp.page.locator("#new-password").fill("short");
    await temp.page.locator("button:has-text('Save and continue')").click();
    check(`${tag}: too-short password refused on the screen`, (await temp.page.locator("text=Use at least 8 characters.").count()) === 1 && temp.state.passwordPosts.length === 0);
    await temp.page.locator("#new-password").fill("Garden-Gate-42");
    await temp.page.locator("button:has-text('Save and continue')").click();
    await temp.page.waitForURL((url) => !url.pathname.startsWith("/set-password"), { timeout: 10000 });
    check(`${tag}: new password sent alone, then the customer continues`, JSON.stringify(temp.state.passwordPosts[0]) === JSON.stringify({ newPassword: "Garden-Gate-42" }));
    await temp.ctx.close();

    /* ---------------- Customer: payment link ---------------- */
    const pay = await open(browser, width, null);
    await pay.ctx.clearCookies();
    await pay.page.goto(`${BASE}/pay/TokTokTokTokTokTokTok1`, { waitUntil: "networkidle" });
    await pay.page.locator("[data-pay-state=open]").waitFor({ timeout: 15000 });
    check(`${tag}: link page names what is being paid for`, (await pay.page.locator("text=/Basic membership/").count()) >= 1);
    check(`${tag}: nothing opened at Stripe just by loading the link`, pay.state.payPosts === 0);
    await shot(pay.page, `${tag}-10-pay-link`);
    check(`${tag}: pay page fits without sideways scroll`, await noSideScroll(pay.page));
    await pay.page.locator("[data-action=pay]").click();
    await pay.page.waitForURL(/checkout\.stripe\.test/, { timeout: 10000 });
    check(`${tag}: Pay opens Stripe`, pay.state.payPosts === 1);
    pay.state.payStatus = "paid";
    await pay.page.goto(`${BASE}/pay/TokTokTokTokTokTokTok1?paid=1`, { waitUntil: "networkidle" });
    await pay.page.locator("[data-pay-state=paid]").waitFor({ timeout: 10000 });
    check(`${tag}: back from Stripe says thank you`, (await pay.page.locator("text=Thank you!").count()) === 1);
    await pay.page.goto(`${BASE}/pay/ExpiredExpiredExpired1`, { waitUntil: "networkidle" });
    await pay.page.locator("[data-pay-state=expired]").waitFor({ timeout: 10000 });
    check(`${tag}: an expired link says so and offers the phone number`, (await pay.page.locator("text=631-599-1363").count()) >= 1);
    await shot(pay.page, `${tag}-11-pay-expired`);
    await pay.ctx.close();
  }

  await browser.close();
  const failed = results.filter((r) => !r.pass).length;
  console.log(`\n${results.length - failed}/${results.length} passed`);
  process.exit(failed ? 1 : 0);
})().catch((error) => {
  console.error(error);
  process.exit(1);
});
