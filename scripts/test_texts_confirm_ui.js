/* eslint-disable @typescript-eslint/no-require-imports -- a plain Node script, like its neighbours */
/*
 * The one-click "confirm offers by text" page (/texts/confirm), against a
 * mocked API shaped like BackEnd routes/smsConfirm.js (pinned by BackEnd
 * scripts/test_admin_marketing_consent.js). At a phone and a desktop width:
 * - opening the page reads only (GET), shows the number ending and the disclosure
 * - the button is the consent (one POST with the link's token), then "You're all set"
 * - a refused link shows the server's message and no button
 * - nothing scrolls sideways
 *
 *   node scripts/test_texts_confirm_ui.js [baseUrl]
 */
const { chromium } = require("playwright");

const BASE = process.argv[2] || "http://localhost:3000";
const results = [];
function check(name, pass, detail = "") {
  results.push({ name, pass: !!pass });
  console.log(`${pass ? "PASS" : "FAIL"}  ${name}${detail ? "  :: " + detail : ""}`);
}

async function run(browser, width) {
  const tag = width < 700 ? "phone" : "desktop";
  const ctx = await browser.newContext({ viewport: { width, height: 844 }, isMobile: width < 700 });
  await ctx.addInitScript(() => localStorage.setItem("profixter_promotion_popup_dismissed_date", new Date().toISOString().slice(0, 10)));
  const seen = { gets: 0, posts: [] };
  await ctx.route(/\/api\//, async (route) => {
    const req = route.request();
    const u = new URL(req.url());
    const cors = { "access-control-allow-origin": "*", "access-control-allow-headers": "Authorization,Content-Type", "access-control-allow-methods": "GET,POST,OPTIONS" };
    if (req.method() === "OPTIONS") return route.fulfill({ status: 204, headers: cors });
    const json = (body, status = 200) => route.fulfill({ status, contentType: "application/json", headers: cors, body: JSON.stringify(body) });
    if (u.pathname === "/api/consent/sms-confirm" && req.method() === "GET") {
      seen.gets++;
      if (u.searchParams.get("t") === "bad") return json({ code: "LINK_EXPIRED", message: "This link has expired. Call us at 631-599-1363 and we'll send a new one." }, 410);
      return json({ firstName: "Casey", phoneLast4: "4321", confirmed: false });
    }
    if (u.pathname === "/api/consent/sms-confirm" && req.method() === "POST") {
      seen.posts.push(JSON.parse(req.postData() || "{}"));
      return json({ confirmed: true, already: false });
    }
    return json({});
  });
  const page = await ctx.newPage();
  await page.goto(`${BASE}/texts/confirm?t=tok.sig`, { waitUntil: "networkidle" });
  const main = page.locator("[data-texts-confirm]");
  await main.locator("[data-action=confirm-texts]").waitFor({ timeout: 10000 });
  const text = await main.innerText();
  check(`${tag}: opening reads only, shows the number ending and the disclosure`, seen.gets === 1 && seen.posts.length === 0 && /ending in 4321/.test(text) && /Reply STOP to opt out or HELP for help/.test(text) && /Message and data rates may apply/.test(text));
  check(`${tag}: nothing scrolls sideways`, await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth + 1));
  await main.locator("[data-action=confirm-texts]").click();
  await main.locator("[data-texts-confirmed]").waitFor({ timeout: 5000 });
  check(`${tag}: the button is the consent: one POST with the link's token, then confirmed`, seen.posts.length === 1 && seen.posts[0].t === "tok.sig" && (await main.locator("text=You're all set").count()) === 1);
  await page.goto(`${BASE}/texts/confirm?t=bad`, { waitUntil: "networkidle" });
  await main.locator("[role=alert]").waitFor({ timeout: 10000 });
  check(`${tag}: a refused link shows why and offers no button`, /expired/.test(await main.innerText()) && (await main.locator("[data-action=confirm-texts]").count()) === 0);
  await ctx.close();
}

(async () => {
  const browser = await chromium.launch();
  try {
    for (const w of [390, 1440]) await run(browser, w);
  } finally {
    await browser.close();
  }
  const failed = results.filter((r) => !r.pass).length;
  console.log(`\n${results.length - failed} passed, ${failed} failed`);
  process.exit(failed ? 1 : 0);
})();
