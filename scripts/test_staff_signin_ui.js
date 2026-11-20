/*
 * Signing in to an account Admin created on a call (2026-11-20).
 *
 *   node scripts/test_staff_signin_ui.js [baseUrl]
 *
 * Staff typed the email, so it opens nothing until the customer proves it
 * (BackEnd utils/auth/accounts inboxOpensAccount). The customer enters their
 * mobile number, the code, then the temporary password Admin texted them; the
 * server accepts that password only together with the phone code (linkToken).
 * The API is answered in the browser; nothing reaches the live API.
 */
const { chromium } = require("playwright");

const BASE = process.argv[2] || "http://localhost:3000";
const results = [];
function check(name, pass, detail = "") {
  results.push({ name, pass: !!pass });
  console.log(`${pass ? "PASS" : "FAIL"}  ${name}${detail ? "  :: " + detail : ""}`);
}

async function run(browser, { emailCodeOpens, temporaryPassword }) {
  const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true });
  const state = { login: null, outside: [] };
  await ctx.route("**/*", (route) => {
    const req = route.request();
    const u = new URL(req.url());
    if (u.hostname === "localhost" || u.hostname === "127.0.0.1") return route.continue();
    if (u.hostname !== "api.profixter.com") {
      state.outside.push(u.hostname);
      return route.abort();
    }
    const cors = { "access-control-allow-origin": "*", "access-control-allow-headers": "*", "access-control-allow-methods": "GET,POST,PUT,PATCH,OPTIONS" };
    if (req.method() === "OPTIONS") return route.fulfill({ status: 204, headers: cors });
    const json = (body, status = 200) => route.fulfill({ status, contentType: "application/json", headers: cors, body: JSON.stringify(body) });
    const p = u.pathname;
    if (p === "/api/auth/otp/phone/start") return json({ phoneMasked: "(•••) •••-0142", resendAfterSeconds: 30, expiresInSeconds: 600 });
    if (p === "/api/auth/otp/phone/verify") {
      return json({ status: "link_required", linkToken: "link-proof-1", hint: { maskedEmail: "ro•••@mailbox.org", hasPassword: true, emailCodeOpens, temporaryPassword } });
    }
    if (p === "/api/auth/login") {
      state.login = JSON.parse(req.postData() || "{}");
      return json({ token: "t1", user: { _id: "u1", name: "Rosa Diaz", email: "rosa.diaz@mailbox.org", role: "customer", mustChangePassword: true, temporaryPassword: true, addresses: [] } });
    }
    if (p === "/api/auth/me") return json({ _id: "u1", name: "Rosa Diaz", email: "rosa.diaz@mailbox.org", role: "customer", mustChangePassword: true, temporaryPassword: true, addresses: [] });
    return json({});
  });
  const page = await ctx.newPage();
  await page.goto(`${BASE}/signin`, { waitUntil: "domcontentloaded" });
  await page.waitForSelector(".auth-question", { timeout: 30000 });
  await page.click(".auth-method--primary");
  await page.waitForSelector("#phone");
  await page.fill("#phone", "5165550142");
  await page.click(".auth-submit");
  await page.waitForSelector(".auth-otp");
  await page.locator(".auth-otp").first().fill("123456");
  await page.waitForSelector(".auth-options", { timeout: 10000 });
  return { ctx, page, state };
}

(async () => {
  const browser = await chromium.launch();

  {
    const { ctx, page, state } = await run(browser, { emailCodeOpens: false, temporaryPassword: true });
    const options = await page.locator(".auth-options").innerText();
    check("staff-typed email: no 'Confirm with email code' option", !/Confirm with email code/.test(options), options.replace(/\s+/g, " "));
    check("the temporary password is offered, naming the account's email", /Enter your temporary password/.test(options) && /ro•••@mailbox\.org/.test(options));
    await page.click("[data-link-password]");
    await page.waitForSelector("#auth-email");
    await page.fill("#auth-email", "rosa.diaz@mailbox.org");
    await page.fill("input[type='password']", "(516) 555-0142");
    await page.click(".auth-submit");
    await page.waitForTimeout(1500);
    check("the password is sent together with the phone proof", state.login?.linkToken === "link-proof-1" && state.login?.email === "rosa.diaz@mailbox.org", JSON.stringify({ ...state.login, password: state.login?.password ? "•" : "" }));
    check("then the forced password change", /set-password/.test(page.url()), page.url());
    check("no request to any outside host", state.outside.length === 0, state.outside.join(","));
    await ctx.close();
  }
  {
    const { ctx, page } = await run(browser, { emailCodeOpens: true, temporaryPassword: false });
    const options = await page.locator(".auth-options").innerText();
    check("an email the customer proved: the email code is still offered", /Confirm with email code/.test(options));
    check("and the usual password wording", /Sign in with password/.test(options));
    await ctx.close();
  }

  await browser.close();
  const failed = results.filter((r) => !r.pass);
  console.log(`\n${results.length - failed.length}/${results.length} passed`);
  process.exit(failed.length ? 1 : 0);
})().catch((e) => {
  console.error(e);
  process.exit(1);
});
