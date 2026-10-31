/*
 * The homepage, personalised (2026-10-30): visitor, registered non-member,
 * former member and member each get the right page; the public membership map
 * is gone and never requested; nothing wrong flashes while the account loads.
 * The account side of the API is stubbed in the browser; nothing is written.
 *
 *   node scripts/test_home_personal_ui.js [baseUrl]
 */
const { chromium } = require("playwright");

const BASE = process.argv[2] || "http://localhost:3000";
const results = [];
function check(name, pass, detail = "") {
  results.push(!!pass);
  console.log(`${pass ? "PASS" : "FAIL"}  ${name}${detail ? "  :: " + detail : ""}`);
}

const USER = (member) => ({
  _id: "u1", userId: "PF-1", name: "Dana Reed", email: "dana@example.com", phone: "+16315550199", role: "customer",
  defaultAddressId: "a1",
  addresses: [{ _id: "a1", label: "Home", line1: "12 Main St", city: "Massapequa", state: "NY", zip: "11758", hasActiveSubscription: member, plan: member ? "plus" : null }],
});

async function open(browser, { who = "visitor", subscriptions = [], meDelay = 0, width = 390 } = {}) {
  const ctx = await browser.newContext({ viewport: { width, height: 844 }, isMobile: width < 700, hasTouch: width < 700 });
  await ctx.addInitScript((signed) => {
    try {
      localStorage.setItem("profixter_promotion_popup_dismissed_date", new Date().toISOString().slice(0, 10));
      if (signed) localStorage.setItem("token", "home-token");
    } catch {}
    window.fbq = function () {};
  }, who !== "visitor");
  const seen = { map: 0, posts: 0 };
  await ctx.route(/(localhost:5001|api\.profixter\.com)\//, async (route) => {
    const req = route.request();
    const p = new URL(req.url()).pathname;
    const cors = { "access-control-allow-origin": "*", "access-control-allow-headers": "*", "access-control-allow-methods": "GET,POST,OPTIONS" };
    const json = (b, s = 200) => route.fulfill({ status: s, contentType: "application/json", headers: cors, body: JSON.stringify(b) });
    if (req.method() === "OPTIONS") return route.fulfill({ status: 204, headers: cors });
    if (p === "/api/membership-map") { seen.map += 1; return json({ points: [] }); }
    if (req.method() !== "GET") { seen.posts += 1; return route.fulfill({ status: 204, headers: cors }); }
    if (p === "/api/auth/me") {
      if (who === "visitor") return json({ message: "no" }, 401);
      if (meDelay) await new Promise((r) => setTimeout(r, meDelay));
      return json(USER(who === "member"));
    }
    if (p === "/api/subscriptions/my") return json({ subscriptions });
    if (p === "/api/bookings/next") return json({ freeFirstVisitAvailable: false, introVisitStatus: "consumed", introVisitServiceable: true, hasSubscription: who === "member", activeBookings: [] });
    return json({});
  });
  const page = await ctx.newPage();
  const errors = [];
  page.on("pageerror", (e) => errors.push(e.message));
  return { ctx, page, seen, errors };
}

const text = (page) => page.locator("main").first().innerText().catch(() => "");

(async () => {
  const browser = await chromium.launch();

  console.log("\n--- visitor ---");
  {
    const { ctx, page, seen, errors } = await open(browser);
    await page.goto(BASE + "/", { waitUntil: "networkidle" });
    await page.waitForTimeout(800);
    check("visitor: the visitor homepage", /Your home\.\s*Your handyman\./.test(await text(page)));
    check("visitor: no membership promotion, no signed-in extras", (await page.locator("[data-home-promo]").count()) === 0 && (await page.locator("[data-home-extra]").count()) === 0);
    // Customer Experience 4.0: the two ways to start, as links to their own pages (no form on the homepage).
    check("visitor: Free Visit and Book a Handyman in the hero", (await page.locator("[data-hero-cta='free-visit'][href='/book/free']").count()) === 1 && (await page.locator("[data-hero-cta='book-handyman'][href='/book/handyman']").count()) === 1);
    check("no membership map anywhere, never requested", (await page.locator("#membership-map-heading").count()) === 0 && seen.map === 0, `requests=${seen.map}`);
    check("visitor: no page errors", errors.length === 0, errors.join(" | "));
    await ctx.close();
  }

  console.log("\n--- registered, never a member ---");
  {
    const { ctx, page, seen } = await open(browser, { who: "registered" });
    await page.goto(BASE + "/", { waitUntil: "networkidle" });
    await page.waitForSelector("[data-home-promo]", { timeout: 10000 }).catch(() => {});
    const promo = page.locator("[data-home-promo]");
    check("non-member: membership promotion shown", (await promo.getAttribute("data-home-promo")) === "none" && /Your home deserves a dedicated handyman\./.test(await promo.innerText()));
    check("non-member: Explore Memberships goes to the plans", (await promo.locator('a[href="/membership/plans"]').innerText()).includes("Explore Memberships"));
    const hrefs = await page.locator("[data-home-extra]").evaluateAll((els) => els.map((e) => e.getAttribute("href")));
    check("non-member: Gift, Kitchen & Bathroom, Full Day", JSON.stringify(hrefs) === JSON.stringify(["/gift", "/kitchen-bathroom", "/book?visit=full-day"]), JSON.stringify(hrefs));
    const promoH = await promo.evaluate((e) => Math.round(e.getBoundingClientRect().height));
    check("non-member: promotion stays compact", promoH < 140, `${promoH}px`);
    check("non-member: no map request", seen.map === 0);
    await ctx.close();
  }

  console.log("\n--- former member ---");
  {
    const { ctx, page } = await open(browser, { who: "registered", subscriptions: [{ status: "canceled", subscriptionType: "Plus" }] });
    await page.goto(BASE + "/", { waitUntil: "networkidle" });
    await page.waitForSelector("[data-home-promo]", { timeout: 10000 }).catch(() => {});
    const promo = page.locator("[data-home-promo]");
    check("former member: renewal wording, not the first-timer pitch", (await promo.getAttribute("data-home-promo")) === "lapsed" && /Welcome back/.test(await promo.innerText()) && /See Memberships/.test(await promo.innerText()));
    await ctx.close();
  }

  console.log("\n--- renewal failed (past due) ---");
  {
    const { ctx, page } = await open(browser, { who: "registered", subscriptions: [{ status: "past_due", subscriptionType: "basic" }] });
    await page.goto(BASE + "/", { waitUntil: "networkidle" });
    await page.waitForSelector("[data-home-promo]", { timeout: 10000 }).catch(() => {});
    const promo = page.locator("[data-home-promo]");
    const t = await promo.innerText().catch(() => "");
    check("past due: sent to fix the payment, never to buy again", (await promo.getAttribute("data-home-promo")) === "attention" && /payment needs attention/i.test(t) && !/See Memberships|Explore Memberships|Restart/.test(t), t);
    check("past due: the button goes to the plan tab", (await promo.locator('a[href="/account?tab=plan"]').count()) === 1);
    await ctx.close();
  }

  console.log("\n--- member ---");
  {
    const { ctx, page, seen, errors } = await open(browser, { who: "member" });
    await page.goto(BASE + "/", { waitUntil: "networkidle" });
    await page.waitForSelector(".hm-shortcuts", { timeout: 10000 }).catch(() => {});
    const t = await text(page);
    check("member: their homepage, by name", /Welcome back, Dana\./.test(t));
    check("member: no membership purchase pitch", (await page.locator("[data-home-promo]").count()) === 0 && !/Explore Memberships|Your home deserves/.test(t));
    const shortcuts = await page.locator(".hm-shortcut").evaluateAll((els) => els.map((e) => [e.querySelector(".hm-shortcut__label").textContent.trim(), e.getAttribute("href")]));
    check("member: book, upcoming, manage, loyalty", JSON.stringify(shortcuts) === JSON.stringify([
      ["Book a visit", "/book?visit=membership"], ["Upcoming visits", "/book#your-visits"], ["Manage membership", "/account?tab=plan"], ["Loyalty rewards", "/membership/loyalty"],
    ]), JSON.stringify(shortcuts));
    check("member: the extras row is there", (await page.locator("[data-home-extra]").count()) === 3);
    check("member: no map section, no map request", (await page.locator("#membership-map-heading").count()) === 0 && seen.map === 0, `requests=${seen.map}`);
    check("member: nothing sent", seen.posts === 0, String(seen.posts));
    check("member: no page errors", errors.length === 0, errors.join(" | "));
    await ctx.close();
  }

  console.log("\n--- no wrong flash while the account loads ---");
  {
    const { ctx, page } = await open(browser, { who: "member", meDelay: 1500 });
    // Sample every frame from the first paint until the member page is up: the visitor hero must never be visible.
    await page.addInitScript(() => {
      window.__sawLanding = 0;
      const tick = () => {
        const h1 = [...document.querySelectorAll("h1")].find((e) => (e.textContent || "").includes("One membership."));
        if (h1) {
          const gate = h1.closest(".hm-gate");
          const hidden = gate && getComputedStyle(gate).visibility === "hidden";
          if (!hidden && h1.getBoundingClientRect().height > 0) window.__sawLanding += 1;
        }
        if (!document.querySelector(".hm-shortcuts")) requestAnimationFrame(tick);
      };
      requestAnimationFrame(tick);
    });
    await page.goto(BASE + "/", { waitUntil: "domcontentloaded" });
    await page.waitForSelector(".hm-shortcuts", { timeout: 15000 }).catch(() => {});
    const saw = await page.evaluate(() => window.__sawLanding);
    check("while loading: the visitor page is never shown to a member", saw === 0, `visible frames=${saw}`);
    const after = await page.evaluate(() => getComputedStyle(document.querySelector(".hm-gate")).visibility);
    check("once known: the member page shows", after === "visible" && (await page.locator(".hm-shortcuts").count()) === 1, after);
    await ctx.close();
  }

  console.log("\n--- the links go somewhere real ---");
  for (const href of ["/gift", "/kitchen-bathroom", "/book?visit=full-day", "/membership/loyalty", "/membership/plans", "/account?tab=plan"]) {
    const res = await fetch(BASE + href, { redirect: "manual" });
    check(`${href} answers`, res.status === 200, String(res.status));
  }

  console.log("\n--- layouts ---");
  for (const width of [390, 768, 1440]) {
    const { ctx, page } = await open(browser, { who: "registered", width });
    await page.goto(BASE + "/", { waitUntil: "networkidle" });
    await page.waitForSelector("[data-home-promo]", { timeout: 10000 }).catch(() => {});
    const ovf = await page.evaluate(() => document.documentElement.scrollWidth > window.innerWidth + 1);
    check(`${width}px: no sideways scroll`, !ovf);
    if (process.env.HOME_SHOTS) {
      await page.locator("[data-home-promo]").scrollIntoViewIfNeeded().catch(() => {});
      await page.screenshot({ path: `${process.env.HOME_SHOTS}/nonmember-${width}.png` });
      await page.locator(".hm-extras").scrollIntoViewIfNeeded().catch(() => {});
      await page.screenshot({ path: `${process.env.HOME_SHOTS}/extras-${width}.png` });
    }
    await ctx.close();
    if (process.env.HOME_SHOTS) {
      const m = await open(browser, { who: "member", width });
      await m.page.goto(BASE + "/", { waitUntil: "networkidle" });
      await m.page.waitForSelector(".hm-shortcuts", { timeout: 10000 }).catch(() => {});
      await m.page.waitForTimeout(600);
      await m.page.screenshot({ path: `${process.env.HOME_SHOTS}/member-${width}.png` });
      await m.ctx.close();
    }
  }

  await browser.close();
  const failed = results.filter((r) => !r).length;
  console.log(`\n${results.length - failed}/${results.length} passed`);
  process.exit(failed ? 1 : 0);
})();
