/*
 * The gift purchase form, the confirmation receipt and the claim screen, in a
 * browser against a running frontend.
 *
 *   node scripts/test_gift_purchase_ui.js [baseUrl]
 *
 * The API is mocked with route(): options, purchased gifts and the claim
 * preview are shaped like BackEnd routes/gifts.js returns them, and the
 * checkout call is captured instead of reaching Stripe. Analytics requests
 * are aborted so test traffic never reaches the real accounts.
 *
 * What it pins:
 * - required first: recipient, then the gift, then the optional section
 * - the optional section starts closed and holds occasion, message, address
 * - the mobile number is offered as "Add another contact", and Remove clears it
 * - Pay with nothing filled in reports every required field and sends nothing
 * - email stays required even with a phone number (the server's rule)
 * - the summary shows plan, length, price, the annual saving, promo code and
 *   sales tax "at checkout", and the total from the server's quote
 * - the checkout payload is exactly the existing contract
 * - the confirmation receipt shows Stripe's subtotal, discount, tax and total
 * - no sideways scrolling and no console errors at 320, 375, 390 and 1440
 */
const { chromium } = require("playwright");

const BASE = process.argv[2] || "http://localhost:3000";

const results = [];
function check(name, pass, detail = "") {
  results.push({ name, pass: !!pass });
  console.log(`${pass ? "PASS" : "FAIL"}  ${name}${detail ? "  :: " + detail : ""}`);
}

const USER = {
  _id: "c1", userId: "PF-C1", name: "Pat Homeowner", email: "pat@homeowner-mail.net", phone: "+16315551234",
  role: "customer", addresses: [{ _id: "a1", line1: "12 Harbor Rd", city: "Huntington", state: "NY", zip: "11743" }],
  defaultAddressId: "a1", phoneVerified: true, emailVerified: true, subscription: null,
};

/* GET /api/gifts/options, as the server builds it from quoteGift(). */
const PER_MONTH = { basic: 14900, plus: 24900, premium: 34900, elite: 49900 };
const DURATIONS = [1, 2, 3, 6, 12];
const OPTIONS = {
  plans: Object.entries(PER_MONTH).map(([plan, perMonthCents]) => ({
    plan,
    label: plan[0].toUpperCase() + plan.slice(1),
    quotes: DURATIONS.map((months) => ({
      durationMonths: months,
      perMonthCents,
      totalCents: months === 12 ? perMonthCents * 10 : perMonthCents * months,
      pricingBasis: months === 12 ? "annual" : "monthly",
      savingsCents: months === 12 ? perMonthCents * 2 : 0,
    })),
  })),
  durations: DURATIONS,
  defaultDurationMonths: 2,
  currency: "usd",
};

/* A completed gift with a promo code and tax, as Stripe reported them. */
const PURCHASED = {
  giftNumber: "GFT-24117", plan: "plus", durationMonths: 2, recipientEmail: "jordan.rivera@example.com",
  recipientName: "Jordan Rivera", recipientFirstName: "Jordan", recipientLastName: "Rivera",
  occasion: "new_home", personalMessage: "Welcome!", status: "purchased", state: "unclaimed",
  amountSubtotalCents: 49800, discountCents: 4980, taxCents: 3906, amountPaidCents: 48726, currency: "usd",
  automaticTaxStatus: "complete", refundStatus: "", invitationExpiresAt: null, invitationExpired: false,
  purchasedAt: "2026-10-29T12:00:00.000Z", claimedAt: null,
};

const TRACKERS = /(google|doubleclick|bing\.com|clarity\.ms|facebook)/;

async function open(browser, width) {
  const ctx = await browser.newContext({
    viewport: { width, height: 900 },
    isMobile: width < 1024,
    hasTouch: width < 1024,
  });
  await ctx.addInitScript((u) => {
    localStorage.setItem("token", "test-token");
    localStorage.setItem("user", JSON.stringify(u));
  }, USER);
  await ctx.route(TRACKERS, (r) => r.abort());
  const sessions = [];
  await ctx.route(/localhost:5001\//, (route) => {
    const req = route.request();
    const cors = {
      "access-control-allow-origin": "*",
      "access-control-allow-headers": "*",
      "access-control-allow-methods": "GET,PUT,POST,OPTIONS",
    };
    if (req.method() === "OPTIONS") return route.fulfill({ status: 204, headers: cors });
    const json = (body, status = 200) =>
      route.fulfill({ status, contentType: "application/json", headers: cors, body: JSON.stringify(body) });
    const p = new URL(req.url()).pathname;
    if (p === "/api/auth/me") return json(USER);
    if (p === "/api/gifts/options") return json(OPTIONS);
    if (p === "/api/gifts/purchased") return json({ gifts: [PURCHASED] });
    if (p === "/api/gifts/checkout-session") {
      sessions.push(JSON.parse(req.postData() || "{}"));
      return json({ url: `${BASE}/gift/confirmation?session_id=cs_test_1`, sessionId: "cs_test_1" });
    }
    return json([]);
  });
  const page = await ctx.newPage();
  const errors = [];
  page.on("pageerror", (e) => errors.push(e.message));
  page.on("console", (m) => {
    if (m.type() !== "error") return;
    // Aborted analytics calls report as failed resources; nothing else is expected.
    if (/ERR_FAILED|ERR_CONNECTION_RESET/.test(m.text())) return;
    errors.push(m.text());
  });
  return { ctx, page, errors, sessions };
}

async function noSidewaysScroll(page) {
  return page.evaluate(() => {
    document.documentElement.style.overflowX = "visible";
    document.body.style.overflowX = "visible";
    const ok = document.documentElement.scrollWidth <= window.innerWidth;
    document.documentElement.style.overflowX = "";
    document.body.style.overflowX = "";
    return ok;
  });
}

const text = (page, sel) => page.locator(sel).first().innerText();

(async () => {
  const browser = await chromium.launch();
  try {
    /* ---------------------------- Desktop flow ---------------------------- */
    {
      const { ctx, page, errors, sessions } = await open(browser, 1440);
      await page.goto(`${BASE}/gift`, { waitUntil: "networkidle" });
      await page.waitForSelector("#gift-form");

      const order = await page.evaluate(() =>
        ["#firstName", "#email", 'input[name="gift-plan"]', 'input[name="gift-length"]', "#gift-occasion", "#line1"].map(
          (sel) => {
            const el = document.querySelector(sel);
            return el ? el.compareDocumentPosition(document.querySelector("#firstName")) : -1;
          }
        )
      );
      // Every later field is after #firstName (DOCUMENT_POSITION_PRECEDING = 2).
      check("required fields come first: recipient, then the gift", order.slice(1).every((n) => n === 2), JSON.stringify(order));

      check("the optional section starts closed", await page.locator("#gift-more").isHidden());
      check("its toggle says it is optional", /Add a message or details\s*\(optional\)/.test(await text(page, ".gf-more__toggle")));
      check("occasion, message and address are inside it", await page.evaluate(() =>
        ["#gift-occasion", "#gift-message", "#line1", "#city", "#zip"].every((s) => document.querySelector("#gift-more").contains(document.querySelector(s)))
      ));

      check("one contact field is shown, with why", (await page.locator("#phone").count()) === 0 &&
        /We email them a link to claim it\./.test(await text(page, "#email-hint")));

      // Pay with nothing filled in.
      await page.getByRole("button", { name: "Continue to payment" }).click();
      await page.waitForTimeout(300);
      const firstErr = await page.locator("#firstName-error").count();
      const emailErr = await page.locator("#email-error").count();
      const planErr = await page.locator("#plan-error").count();
      check("an empty form reports name, email and plan, and sends nothing",
        firstErr && emailErr && planErr && sessions.length === 0);
      check("focus moves to the first problem", await page.evaluate(() => document.activeElement?.id === "firstName"));

      // Add another contact, then remove it.
      await page.getByRole("button", { name: /Add another contact/ }).click();
      check("Add another contact reveals the mobile field, focused",
        (await page.locator("#phone").isVisible()) && (await page.evaluate(() => document.activeElement?.id === "phone")));
      await page.fill("#phone", "631555");
      await page.getByRole("button", { name: "Remove mobile number" }).click();
      check("Remove hides the field again", (await page.locator("#phone").count()) === 0);

      // A phone does not stand in for the email.
      await page.fill("#firstName", "Jordan");
      await page.fill("#lastName", "Rivera");
      await page.getByRole("button", { name: /Add another contact/ }).click();
      await page.fill("#phone", "(631) 555-0134");
      await page.check('input[name="gift-plan"][value="plus"]');
      await page.getByRole("button", { name: "Continue to payment" }).click();
      await page.waitForTimeout(300);
      check("email is still required with a phone number", (await page.locator("#email-error").count()) === 1 && sessions.length === 0);

      // Summary for the server's default length.
      const total2 = await text(page, '[data-testid="gift-total"]');
      check("summary total is the server's quote (Plus, 2 months: $498)", total2.startsWith("$498"), total2);
      const summary = await text(page, ".gf-summary");
      check("summary names plan and length", /Plan\s+Plus/.test(summary) && /Length\s+2 months/.test(summary));
      check("promo code and sales tax are settled at checkout, with no invented figure",
        /Promo code\s+Enter at checkout/.test(summary) && /Sales tax\s+Added at checkout/.test(summary) &&
        /before tax and any promo code/.test(summary));

      // Twelve months: annual pricing and its saving.
      await page.check('input[name="gift-length"][value="12"]');
      const summary12 = await text(page, ".gf-summary");
      check("twelve months shows the annual price and saving",
        /Price\s+\$2,490/.test(summary12) && /You save \$498/.test(summary12), summary12.replace(/\s+/g, " "));

      // Optional details, then pay.
      await page.fill("#email", "jordan.rivera@example.com");
      await page.getByRole("button", { name: /Add a message or details/ }).click();
      check("the optional section opens", await page.locator("#gift-more").isVisible());
      await page.selectOption("#gift-occasion", "birthday");
      await page.fill("#gift-message", "Happy birthday!");
      await page.getByRole("button", { name: "Continue to payment" }).click();
      await page.waitForURL(/\/gift\/confirmation/, { timeout: 15000 });

      const sent = sessions[0] || {};
      const expected = {
        plan: "plus",
        durationMonths: 12,
        recipient: { firstName: "Jordan", lastName: "Rivera", email: "jordan.rivera@example.com", phone: "(631) 555-0134" },
        address: { line1: "", city: "", state: "NY", zip: "" },
        occasion: "birthday",
        personalMessage: "Happy birthday!",
      };
      check("one checkout session, with the unchanged payload", sessions.length === 1 &&
        JSON.stringify(sent) === JSON.stringify(expected), JSON.stringify(sent));

      // The receipt with Stripe's own figures.
      await page.waitForSelector('[data-testid="gift-total-paid"]');
      const receipt = (await text(page, ".gf-summary")).replace(/\s+/g, " ");
      check("receipt shows subtotal, promo discount, tax and total paid",
        /Subtotal \$498/.test(receipt) && /Discount −\$49\.80/.test(receipt) &&
        /Sales tax \$39\.06/.test(receipt) && /Total paid \$487\.26/.test(receipt), receipt);

      check("no console errors on desktop", errors.length === 0, errors.join(" | "));
      await ctx.close();
    }

    /* --------------------------- Phone widths ---------------------------- */
    for (const width of [320, 375, 390]) {
      const { ctx, page, errors } = await open(browser, width);
      await page.goto(`${BASE}/gift`, { waitUntil: "networkidle" });
      await page.waitForSelector("#gift-form");
      await page.getByRole("button", { name: /Add another contact/ }).click();
      await page.check('input[name="gift-plan"][value="elite"]');
      await page.check('input[name="gift-length"][value="12"]');
      await page.getByRole("button", { name: /Add a message or details/ }).click();
      await page.fill("#gift-message", "x".repeat(200));
      check(`${width}px: no sideways scrolling on the purchase form`, await noSidewaysScroll(page));
      const order = await page.evaluate(() => {
        const s = document.querySelector(".gf-aside .ui-card").getBoundingClientRect().top;
        const c = document.querySelector(".gf-preview").getBoundingClientRect().top;
        return s < c;
      });
      check(`${width}px: the summary and pay button come before the card preview`, order);
      await page.goto(`${BASE}/gift/confirmation?session_id=cs_test_1`, { waitUntil: "networkidle" });
      await page.waitForSelector('[data-testid="gift-total-paid"]');
      check(`${width}px: no sideways scrolling on the confirmation`, await noSidewaysScroll(page));
      check(`${width}px: no console errors`, errors.length === 0, errors.join(" | "));
      await ctx.close();
    }
  } finally {
    await browser.close();
  }

  const failed = results.filter((r) => !r.pass);
  console.log(`\n${results.length - failed.length} passed, ${failed.length} failed.`);
  process.exit(failed.length ? 1 : 0);
})().catch((error) => {
  console.error(error);
  process.exit(1);
});
