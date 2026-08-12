/**
 * Customer experience QA - Home navigation, Your Fixter, booking sections.
 *
 * Drives the real production build in a browser with the API stubbed, so the
 * assertions are about what a customer actually sees rather than what the JSX
 * suggests. Auth is simulated by stubbing /api/auth/me, which is the single
 * call useAuth uses to hydrate a session.
 *
 * Requires the production server: `npx next start -p <port>` then
 *   QA_BASE_URL=http://127.0.0.1:<port> node scripts/test_customer_experience_qa.js
 */

const { chromium } = require("playwright");

const BASE = process.env.QA_BASE_URL || "http://127.0.0.1:3000";

const VIEWPORTS = [
  { name: "phone-375", width: 375, height: 667 },
  { name: "phone-390", width: 390, height: 844 },
  { name: "phone-430", width: 430, height: 932 },
  { name: "desktop-1440", width: 1440, height: 900 },
  { name: "desktop-1920", width: 1920, height: 1080 },
];

const MEMBER = {
  _id: "qa-member-1",
  name: "Dana Whitfield-Castellanos",
  email: "member@qa.test",
  role: "customer",
  addresses: [
    { _id: "a1", formattedAddress: "12 Ocean Ave, Lindenhurst NY", hasActiveSubscription: true },
  ],
};

const NON_MEMBER = { ...MEMBER, _id: "qa-cust-2", addresses: [{ _id: "a2", hasActiveSubscription: false }] };

const results = [];
function record(scope, ok, detail) {
  results.push({ scope, ok, detail });
  if (!ok) console.log(`  DEFECT  ${scope}: ${detail}`);
}

async function makeContext(browser, viewport, user) {
  const context = await browser.newContext({
    viewport: { width: viewport.width, height: viewport.height },
    hasTouch: viewport.width < 1024,
  });
  await context.route("**/api/auth/me", (route) =>
    route.fulfill({
      status: 200,
      contentType: "application/json",
      headers: { "Access-Control-Allow-Origin": "*" },
      body: JSON.stringify(user || {}),
    })
  );
  // Everything else the pages fetch is irrelevant to layout and must not hang.
  await context.route("**/api/**", (route) => {
    if (route.request().url().includes("/api/auth/me")) return route.fallback();
    return route.fulfill({
      status: 200,
      contentType: "application/json",
      headers: { "Access-Control-Allow-Origin": "*" },
      body: JSON.stringify({}),
    });
  });
  if (user) {
    await context.addInitScript((u) => {
      window.localStorage.setItem("token", "qa-token");
      window.localStorage.setItem("user", JSON.stringify(u));
    }, user);
  }
  return context;
}

async function noHorizontalOverflow(page, scope) {
  const overflow = await page.evaluate(() => {
    const client = document.documentElement.clientWidth;
    let worst = null;
    const inScroller = (el) => {
      for (let n = el.parentElement; n && n !== document.body; n = n.parentElement) {
        const ox = getComputedStyle(n).overflowX;
        if (ox === "auto" || ox === "scroll" || ox === "hidden") return true;
      }
      return false;
    };
    for (const el of Array.from(document.querySelectorAll("*"))) {
      const r = el.getBoundingClientRect();
      if (r.width === 0 || inScroller(el)) continue;
      if (r.right > client + 1 && (!worst || r.right > worst.right)) {
        worst = { right: Math.round(r.right), tag: el.tagName.toLowerCase(), cls: String(el.className || "").slice(0, 60) };
      }
    }
    return { scroll: document.documentElement.scrollWidth, client, worst };
  });
  record(
    `${scope}/overflow`,
    overflow.scroll <= overflow.client + 1,
    `scrollWidth ${overflow.scroll} > ${overflow.client}; ${JSON.stringify(overflow.worst)}`
  );
}

async function run() {
  const browser = await chromium.launch();

  for (const vp of VIEWPORTS) {
    const phone = vp.width < 1024;

    /* ---------------- logged out ---------------- */
    {
      const ctx = await makeContext(browser, vp, null);
      const page = await ctx.newPage();
      await page.goto(`${BASE}/`, { waitUntil: "domcontentloaded" });
      await page.waitForTimeout(1500);
      record(`${vp.name}/logged-out/home-renders`, page.url().replace(/\/$/, "") === BASE.replace(/\/$/, ""), `landed on ${page.url()}`);
      const body = await page.evaluate(() => document.body.innerText);
      record(`${vp.name}/logged-out/no-fixter`, !body.includes("Your primary Fixter"), "Your Fixter must not appear to anonymous visitors");
      if (phone) {
        const membershipTab = await page.locator('nav[aria-label="Customer site navigation"] a', { hasText: "Membership" }).count();
        record(`${vp.name}/logged-out/membership-tab-kept`, membershipTab > 0, "logged-out nav must be unchanged");
      }
      await noHorizontalOverflow(page, `${vp.name}/logged-out/home`);
      await ctx.close();
    }

    /* ---------------- member ---------------- */
    {
      const ctx = await makeContext(browser, vp, MEMBER);
      const page = await ctx.newPage();

      // Home must resolve to the membership dashboard, not bounce.
      await page.goto(`${BASE}/membership`, { waitUntil: "domcontentloaded" });
      await page.waitForTimeout(2200);

      if (phone) {
        const nav = page.locator('nav[aria-label="Customer site navigation"]');
        const labels = await nav.locator("a").allInnerTexts();
        const clean = labels.map((l) => l.trim());
        record(`${vp.name}/member/nav-items`, clean.length === 4, `nav is ${JSON.stringify(clean)}`);
        record(`${vp.name}/member/no-membership-tab`, !clean.includes("Membership"), `Membership tab still present: ${JSON.stringify(clean)}`);
        const homeHref = await nav.locator("a").first().getAttribute("href");
        record(`${vp.name}/member/home-href`, homeHref === "/membership", `Home points at ${homeHref}`);
        const homeActive = await nav.locator('a[aria-current="page"]').first().innerText().catch(() => "");
        record(`${vp.name}/member/home-active`, homeActive.trim() === "Home", `active tab is "${homeActive.trim()}"`);
      } else {
        const logoHref = await page.locator('a[aria-label="Profixter home"]').first().getAttribute("href");
        record(`${vp.name}/member/logo-home-href`, logoHref === "/membership", `logo points at ${logoHref}`);
        const navText = await page.locator('nav[aria-label="Main navigation"]').innerText().catch(() => "");
        record(`${vp.name}/member/desktop-no-membership-link`, !navText.includes("Membership"), `desktop nav still lists Membership: ${navText.replace(/\s+/g, " ")}`);
      }

      // Your Fixter on the dashboard.
      const dash = await page.evaluate(() => document.body.innerText);
      record(`${vp.name}/member/fixter-present`, /your fixter/i.test(dash) && dash.includes("Roman"), "Your Fixter block missing from the dashboard");
      record(`${vp.name}/member/fixter-relationship`, dash.includes("Your primary Fixter"), "relationship line missing");
      record(`${vp.name}/member/care-number`, dash.includes("631-599-1363"), "Customer Care number missing");
      record(`${vp.name}/member/no-scheduling-invite`, !/call .*roman.* to (schedule|book)/i.test(dash), "copy must not invite scheduling through the Fixter");

      const callHref = await page.locator('a[href^="tel:+1253"]').first().getAttribute("href").catch(() => null);
      const textHref = await page.locator('a[href^="sms:+1253"]').first().getAttribute("href").catch(() => null);
      record(`${vp.name}/member/call-roman`, callHref === "tel:+12532549380", `call href is ${callHref}`);
      record(`${vp.name}/member/text-roman`, textHref === "sms:+12532549380", `text href is ${textHref}`);
      record(`${vp.name}/member/roman-not-care-number`, callHref !== "tel:+16315991363", "Roman must not use the company number");

      const portrait = await page.locator('img[alt*="primary Fixter"]').first().boundingBox().catch(() => null);
      record(`${vp.name}/member/portrait`, !!portrait && portrait.width > 40, `portrait box ${JSON.stringify(portrait)}`);
      await noHorizontalOverflow(page, `${vp.name}/member/dashboard`);

      /* ---------------- booking sections ---------------- */
      for (const visit of ["membership", "additional", "priority"]) {
        await page.goto(`${BASE}/book?visit=${visit}`, { waitUntil: "domcontentloaded" });
        await page.waitForTimeout(2200);

        const tabs = page.locator('nav[aria-label="Visit type"] a');
        record(`${vp.name}/book/${visit}/tabs`, (await tabs.count()) === 3, `expected 3 tabs, found ${await tabs.count()}`);
        const current = await page.locator('nav[aria-label="Visit type"] a[aria-current="page"]').innerText().catch(() => "");
        record(`${vp.name}/book/${visit}/active-tab`, current.trim().length > 0, "no tab marked current");
        await noHorizontalOverflow(page, `${vp.name}/book/${visit}`);

        const text = await page.evaluate(() => document.body.innerText);
        if (visit === "priority") {
          // The whole point: no way to create an appointment from here.
          record(`${vp.name}/book/priority/no-calendar`, !/Select a (date|time)|Choose a day/i.test(text), "a calendar appears on Priority Visit");
          const bookingControls = await page.locator('input[type="file"], button:has-text("Continue to checkout"), button:has-text("Confirm")').count();
          record(`${vp.name}/book/priority/no-booking-controls`, bookingControls === 0, `${bookingControls} booking controls present`);
          record(`${vp.name}/book/priority/no-guarantee`, !/guarantee/i.test(text), "Priority copy must not guarantee availability");
          record(`${vp.name}/book/priority/not-emergency`, !/emergency/i.test(text), "Priority must not be framed as emergency service");
          record(`${vp.name}/book/priority/call-cta`, (await page.locator('a[href="tel:+16315991363"]').count()) > 0, "missing Call ProFixter action");
          record(`${vp.name}/book/priority/may-be-available`, /may be available/i.test(text), "missing the availability caveat");
        }
        if (visit === "additional") {
          record(`${vp.name}/book/additional/price`, text.includes("$99") || text.includes("99"), "the $99 price is not visible");
        }
        if (visit === "membership") {
          record(`${vp.name}/book/membership/heading`, text.includes("Membership Visit"), "Membership Visit heading missing");
          record(`${vp.name}/book/membership/included`, /Included with your membership/i.test(text), "the included-with-membership line is missing");
        }
      }

      // Tabs are real navigation: back must return to the previous section.
      await page.goto(`${BASE}/book?visit=membership`, { waitUntil: "domcontentloaded" });
      await page.waitForTimeout(1800);
      await page.locator('nav[aria-label="Visit type"] a', { hasText: "Priority" }).first().click();
      await page.waitForTimeout(1500);
      record(`${vp.name}/book/tab-navigates`, page.url().includes("visit=priority"), `url is ${page.url()}`);
      await page.goBack();
      await page.waitForTimeout(1500);
      record(`${vp.name}/book/back-works`, page.url().includes("visit=membership"), `after back, url is ${page.url()}`);

      await ctx.close();
    }

    /* ---------------- authenticated non-member ---------------- */
    {
      const ctx = await makeContext(browser, vp, NON_MEMBER);
      const page = await ctx.newPage();
      await page.goto(`${BASE}/book`, { waitUntil: "domcontentloaded" });
      await page.waitForTimeout(2000);
      const tabs = await page.locator('nav[aria-label="Visit type"]').count();
      record(`${vp.name}/non-member/no-tabs`, tabs === 0, "a non-member must see the one-time page unchanged, with no tabs");
      const text = await page.evaluate(() => document.body.innerText);
      record(`${vp.name}/non-member/one-time-flow`, /one-time|One-Time/i.test(text), "the existing one-time page did not render");
      await ctx.close();
    }

    console.log(`  viewport ${vp.name} inspected`);
  }

  await browser.close();

  const defects = results.filter((r) => !r.ok);
  console.log(`\n${results.length} customer-experience checks, ${defects.length} defects.`);
  if (defects.length) {
    for (const d of defects.slice(0, 25)) console.log(`  - ${d.scope}: ${d.detail}`);
    process.exit(1);
  }
}

run().catch((error) => {
  console.error(error.message);
  process.exit(1);
});
