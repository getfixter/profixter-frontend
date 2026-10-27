/*
 * Account > Personal info: the marketing choices, in a real browser.
 *
 *   node scripts/test_account_consent_ui.js [baseUrl]
 *
 * Every API call is answered in the browser - nothing reaches a server.
 *
 * What it pins:
 * - the email switch shows the server's state and saves exactly what was ticked
 * - a blocked address (bounce/complaint) is shown locked, not as a choice
 * - staff/excluded accounts see no email switch at all
 * - the SMS switches are still there and still separate
 * - no page errors, no sideways scroll on a phone
 */
const { chromium } = require("playwright");

const BASE = process.argv[2] || "http://localhost:3000";
const CUSTOMER = { _id: "c1", userId: "PF-C1", name: "Pat Homeowner", email: "pat@homeowner-mail.net", phone: "+16315551234", role: "customer", addresses: [] };

const results = [];
function check(name, pass, detail = "") {
  results.push({ name, pass: !!pass });
  console.log(`${pass ? "PASS" : "FAIL"}  ${name}${detail ? "  :: " + detail : ""}`);
}

async function open(browser, emailPrefs, { width = 1280, height = 900 } = {}) {
  const ctx = await browser.newContext({ viewport: { width, height }, isMobile: width < 700, hasTouch: width < 700 });
  await ctx.addInitScript(() => localStorage.setItem("token", "ui-token"));
  const puts = [];
  let current = { ...emailPrefs };
  await ctx.route(/\/api\//, (route) => {
    const req = route.request();
    const u = new URL(req.url());
    const cors = { "access-control-allow-origin": "*", "access-control-allow-headers": "Authorization,Content-Type", "access-control-allow-methods": "GET,PUT,POST,OPTIONS" };
    if (req.method() === "OPTIONS") return route.fulfill({ status: 204, headers: cors });
    const json = (body, status = 200) => route.fulfill({ status, contentType: "application/json", headers: cors, body: JSON.stringify(body) });
    if (u.pathname === "/api/auth/me") return json(CUSTOMER);
    if (u.pathname === "/api/users/me/sms-preferences") return json({ transactionalEnabled: true, marketingEnabled: false, phoneOptedOut: false, phoneOptOutScope: "" });
    if (u.pathname === "/api/users/me/email-preferences") {
      if (req.method() === "PUT") {
        const body = JSON.parse(req.postData() || "{}");
        puts.push(body);
        current = { ...current, marketingEnabled: body.marketingEnabled, status: body.marketingEnabled ? "opted_in" : "unsubscribed" };
      }
      return json(current);
    }
    if (req.method() !== "GET") puts.push({ other: `${req.method()} ${u.pathname}` });
    return json([]);
  });
  const page = await ctx.newPage();
  const errors = [];
  page.on("pageerror", (e) => errors.push(e.message));
  await page.goto(`${BASE}/account?tab=personal`, { waitUntil: "networkidle" });
  await page.waitForTimeout(1200);
  return { ctx, page, errors, puts };
}

(async () => {
  const browser = await chromium.launch();

  {
    console.log("\n--- a customer who never unsubscribed ---");
    const { ctx, page, errors, puts } = await open(browser, { marketingEnabled: true, status: "existing_customer", canChange: true });
    const box = page.locator("[data-testid=email-preferences] input[type=checkbox]");
    check("the email switch is shown", (await box.count()) === 1);
    check("it shows the server's state (on)", await box.isChecked());
    check("the SMS switches are still there", (await page.getByText("Text me occasional ProFixter offers.").count()) === 1);
    await box.uncheck();
    await page.waitForTimeout(500);
    check("turning it off saves exactly false", puts.length === 1 && puts[0].marketingEnabled === false, JSON.stringify(puts));
    check("and shows it off", !(await box.isChecked()));
    await box.check();
    await page.waitForTimeout(500);
    check("turning it on saves exactly true", puts.length === 2 && puts[1].marketingEnabled === true, JSON.stringify(puts));
    check("no page errors", errors.length === 0, errors.join("; "));
    await ctx.close();
  }

  {
    console.log("\n--- a bounced address ---");
    const { ctx, page, errors, puts } = await open(browser, { marketingEnabled: false, status: "blocked", canChange: false });
    const box = page.locator("[data-testid=email-preferences] input[type=checkbox]");
    check("shown locked", (await box.count()) === 1 && (await box.isDisabled()));
    check("and explained", (await page.getByText("Marketing email is blocked for this address").count()) === 1);
    check("nothing saved", puts.length === 0);
    check("no page errors", errors.length === 0, errors.join("; "));
    await ctx.close();
  }

  {
    console.log("\n--- a staff or excluded account ---");
    const { ctx, page, errors } = await open(browser, { marketingEnabled: false, status: "not_marketable", canChange: false });
    check("no email switch at all", (await page.locator("[data-testid=email-preferences]").count()) === 0);
    check("no page errors", errors.length === 0, errors.join("; "));
    await ctx.close();
  }

  {
    console.log("\n--- phone ---");
    const { ctx, page, errors } = await open(browser, { marketingEnabled: true, status: "existing_customer", canChange: true }, { width: 390, height: 844 });
    const overflow = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
    check("no sideways scroll", overflow <= 1, `${overflow}px`);
    check("the switch shows", (await page.locator("[data-testid=email-preferences]").count()) === 1);
    check("no page errors", errors.length === 0, errors.join("; "));
    await ctx.close();
  }

  await browser.close();
  const failed = results.filter((r) => !r.pass);
  console.log(`\n${results.length - failed.length}/${results.length} passed`);
  process.exit(failed.length ? 1 : 0);
})();
