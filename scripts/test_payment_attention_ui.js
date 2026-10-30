/*
 * A failed renewal is not an ended membership (2026-10-30).
 *
 * A member whose renewal failed was told "Your Membership ended ... Please start
 * a new Membership" and bought a second membership for the same home. This
 * checks, in a real browser, that a past-due member is sent to fix the payment
 * instead, and that a genuinely ended membership still reads as ended.
 * The API is stubbed in the browser; nothing is written.
 *
 *   node scripts/test_payment_attention_ui.js [baseUrl]
 */
const { chromium } = require("playwright");

const BASE = process.argv[2] || "http://localhost:3000";
const results = [];
function check(name, pass, detail = "") {
  results.push(!!pass);
  console.log(`${pass ? "PASS" : "FAIL"}  ${name}${detail ? "  :: " + detail : ""}`);
}

const ADDRESS = { _id: "a1", label: "Home", line1: "57 Intervale Ave", city: "Farmingdale", state: "NY", zip: "11735", hasActiveSubscription: false, plan: null };
const USER = { _id: "u1", userId: "62743132", name: "Mike", email: "mike@example.com", phone: "+15164736259", role: "customer", defaultAddressId: "a1", addresses: [ADDRESS] };
const SUB = (status, extra = {}) => ({
  _id: `s_${status}`,
  addressId: "a1",
  subscriptionType: "basic",
  billingCycle: "monthly",
  status,
  address: ADDRESS,
  currentPeriodEnd: "2026-11-22T21:48:07.000Z",
  ...extra,
});

async function open(browser, subscriptions, { width = 390 } = {}) {
  const ctx = await browser.newContext({ viewport: { width, height: 844 }, isMobile: width < 700, hasTouch: width < 700 });
  await ctx.addInitScript(() => {
    try {
      localStorage.setItem("token", "attention-token");
      localStorage.setItem("profixter_promotion_popup_dismissed_date", new Date().toISOString().slice(0, 10));
    } catch {}
    window.fbq = function () {};
  });
  const seen = { recovery: 0, checkout: 0, writes: [] };
  await ctx.route(/(localhost:5001|api\.profixter\.com)\//, async (route) => {
    const req = route.request();
    const p = new URL(req.url()).pathname;
    const cors = { "access-control-allow-origin": "*", "access-control-allow-headers": "*", "access-control-allow-methods": "GET,POST,OPTIONS" };
    const json = (b, s = 200) => route.fulfill({ status: s, contentType: "application/json", headers: cors, body: JSON.stringify(b) });
    if (req.method() === "OPTIONS") return route.fulfill({ status: 204, headers: cors });
    if (/payment-recovery$/.test(p)) {
      seen.recovery += 1;
      return json({ kind: "invoice", url: "https://invoice.stripe.test/in_oct" });
    }
    if (/create-checkout-session/.test(p)) seen.checkout += 1;
    if (req.method() !== "GET") {
      seen.writes.push(p);
      return json({});
    }
    if (p === "/api/auth/me") return json(USER);
    if (p === "/api/subscriptions/my") return json({ subscriptions });
    if (p === "/api/gifts/mine") return json({ active: null, queued: [], expired: [], billingActionsAvailable: false });
    if (p === "/api/gifts/sent") return json({ gifts: [] });
    if (p === "/api/bookings/next") return json({ freeFirstVisitAvailable: false, introVisitStatus: "consumed", introVisitServiceable: true, hasSubscription: false, activeBookings: [] });
    return json({});
  });
  await ctx.route("https://invoice.stripe.test/**", (route) => route.fulfill({ status: 200, contentType: "text/html", body: "<h1>Stripe invoice</h1>" }));
  const page = await ctx.newPage();
  const errors = [];
  page.on("pageerror", (e) => errors.push(e.message));
  return { ctx, page, seen, errors };
}

const mainText = (page) => page.locator("main").first().innerText().catch(() => "");

(async () => {
  const browser = await chromium.launch();

  console.log("\n--- past due: the plan tab ---");
  {
    const { ctx, page, seen, errors } = await open(browser, [SUB("past_due", { cancellationReason: "payment_failed" })]);
    await page.goto(BASE + "/account?tab=plan", { waitUntil: "networkidle" });
    await page.waitForSelector("[data-plan-attention]", { timeout: 15000 }).catch(() => {});
    const card = page.locator("[data-plan-attention]");
    const t = await mainText(page);
    check("the payment-attention card is shown", (await card.count()) === 1 && /payment needs attention/i.test(await card.innerText()));
    check("it says the membership has NOT ended", /has not\s+ended/i.test(await card.innerText()));
    check("no 'ended' message, no 'start a new Membership'", !/Membership ended because payment|start a new Membership/i.test(t), t.slice(0, 200));
    check("no buy-a-membership card", !/Start Membership/.test(t));
    check("Pay now and Update card are offered", (await page.locator("[data-plan-pay-now]").count()) === 1 && (await page.locator("[data-plan-update-card]").count()) === 1);
    await Promise.all([page.waitForURL(/invoice\.stripe\.test/, { timeout: 10000 }).catch(() => {}), page.locator("[data-plan-pay-now]").click()]);
    check("Pay now opens Stripe's page for the unpaid renewal", /invoice\.stripe\.test\/in_oct/.test(page.url()) && seen.recovery === 1, page.url());
    check("no checkout was started", seen.checkout === 0);
    check("no page errors", errors.length === 0, errors.join(" | "));
    await ctx.close();
  }

  console.log("\n--- past due: the account overview ---");
  {
    const { ctx, page } = await open(browser, [SUB("past_due")]);
    await page.goto(BASE + "/account", { waitUntil: "networkidle" });
    await page.waitForSelector('[data-acct-state="payment-attention"]', { timeout: 15000 }).catch(() => {});
    check("overview shows payment attention", (await page.locator('[data-acct-state="payment-attention"]').count()) === 1);
    check("overview does not say the membership ended", (await page.locator('[data-acct-state="lapsed"]').count()) === 0);
    await ctx.close();
  }

  console.log("\n--- genuinely ended: unchanged ---");
  {
    const { ctx, page } = await open(browser, [SUB("canceled", { cancellationReason: "payment_failed" })]);
    await page.goto(BASE + "/account?tab=plan", { waitUntil: "networkidle" });
    await page.waitForTimeout(1500);
    const t = await mainText(page);
    check("a canceled-for-non-payment membership still says it ended", /Membership ended because payment could not be processed/.test(t));
    check("and offers a fresh start", /Start Membership/.test(t));
    check("no payment-attention card", (await page.locator("[data-plan-attention]").count()) === 0);
    await ctx.close();
  }

  console.log("\n--- layouts ---");
  for (const width of [390, 768, 1440]) {
    const { ctx, page } = await open(browser, [SUB("past_due")], { width });
    await page.goto(BASE + "/account?tab=plan", { waitUntil: "networkidle" });
    await page.waitForSelector("[data-plan-attention]", { timeout: 15000 }).catch(() => {});
    const ovf = await page.evaluate(() => document.documentElement.scrollWidth > window.innerWidth + 1);
    check(`${width}px: no sideways scroll`, !ovf);
    if (process.env.ATTENTION_SHOTS) {
      await page.locator("[data-plan-attention]").scrollIntoViewIfNeeded().catch(() => {});
      await page.screenshot({ path: `${process.env.ATTENTION_SHOTS}/attention-${width}.png` });
    }
    await ctx.close();
  }

  await browser.close();
  const failed = results.filter((r) => !r).length;
  console.log(`\n${results.length - failed}/${results.length} passed`);
  process.exit(failed ? 1 : 0);
})();
