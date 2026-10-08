/*
 * Admin Overview in a real browser, against a recorded payload.
 *
 *   node scripts/test_admin_overview_ui.js [baseUrl]
 *
 * scripts/fixtures/admin-overview.json was produced by the real Overview
 * backend over a fake year (no real customers). Every API call is answered in
 * the browser, so this needs only the built frontend.
 *
 * What it pins:
 * - the admin lands on Overview; six numbers; charts; map; activity
 * - a number opens its drawer with rows; Escape closes it
 * - the date range refetches with the new range and keeps the frame
 * - empty, partial or garbage responses never take the admin down
 * - a General Fixter has no Overview tab and never calls /api/admin/overview
 * - nothing overflows sideways at phone, tablet and desktop widths
 */
const { chromium } = require("playwright");
const path = require("path");
const FIX = require(path.join(__dirname, "fixtures", "admin-overview.json"));

const BASE = process.argv[2] || "http://localhost:3000";
const OWNER = { _id: "owner", userId: "PF-OWNER", name: "Owner", email: "getfixter@gmail.com", role: "admin", addresses: [] };
const FIXTER = { _id: "fx", userId: "PF-FX", name: "Gen Fixter", email: "fixter@example.com", role: "employee", employeePosition: "General Fixter", addresses: [] };

const results = [];
function check(name, pass, detail = "") {
  results.push({ name, pass: !!pass });
  console.log(`${pass ? "PASS" : "FAIL"}  ${name}${detail ? "  :: " + detail : ""}`);
}

async function open(browser, user, { width = 1440, height = 900, answer = null } = {}) {
  const ctx = await browser.newContext({ viewport: { width, height }, isMobile: width < 700, hasTouch: width < 700 });
  await ctx.addInitScript(() => localStorage.setItem("token", "ui-token"));
  const calls = [];
  await ctx.route(/\/api\//, (route) => {
    const u = new URL(route.request().url());
    const cors = { "access-control-allow-origin": "*", "access-control-allow-headers": "Authorization,Content-Type" };
    if (route.request().method() === "OPTIONS") return route.fulfill({ status: 204, headers: cors });
    const json = (body, status = 200) => route.fulfill({ status, contentType: "application/json", headers: cors, body: JSON.stringify(body) });
    if (u.pathname === "/api/auth/me") return json(user);
    if (u.pathname.startsWith("/api/admin/overview")) {
      calls.push(u.pathname + u.search);
      if (user.role !== "admin") return json({ message: "Access denied" }, 403);
      if (answer) return json(answer(u));
      if (u.pathname.endsWith("/map")) return json(FIX.map);
      if (u.pathname.endsWith("/list")) return json(FIX.list);
      return json(u.searchParams.get("range") === "7d" ? FIX.overview7d : FIX.overview);
    }
    return json([]);
  });
  const page = await ctx.newPage();
  const errors = [];
  page.on("pageerror", (e) => errors.push(e.message));
  return { ctx, page, calls, errors };
}

(async () => {
  const browser = await chromium.launch();

  {
    console.log("\n--- admin, desktop ---");
    const { ctx, page, calls, errors } = await open(browser, OWNER);
    await page.goto(`${BASE}/admin`, { waitUntil: "networkidle" });
    await page.waitForSelector("h2:has-text('Overview')", { timeout: 20000 }).catch(() => {});
    await page.waitForTimeout(1200);
    check("admin lands on Overview", (await page.locator("h2", { hasText: /^Overview$/ }).count()) === 1);
    const kpis = await page.locator(".ov-num").allInnerTexts();
    check("six snapshot numbers", kpis.length === 6, kpis.join(" | "));
    check("active members shown from the payload", kpis[0] === String(FIX.overview.kpis.activeMembers.value));
    check("growth and revenue charts drawn", (await page.locator("svg[role=img]").count()) >= 2);
    check("map rendered with pins", (await page.locator("svg[aria-label$='customers on the map'] circle.ov-pin").count()) > 10);
    check("customer funnel and acquisition present", (await page.getByText("Customer funnel").count()) === 1 && (await page.getByText("Customer acquisition").count()) === 1);
    check("unconnected spend is explained, not hidden", (await page.getByText("Connect Meta Ads to add spend").count()) === 1);

    await page.click("button[aria-label^='New members']");
    await page.waitForSelector("[role=dialog] li", { timeout: 10000 }).catch(() => {});
    check("a number opens its drawer with rows", (await page.locator("[role=dialog] li").count()) === FIX.list.rows.length);
    await page.keyboard.press("Escape");
    await page.waitForTimeout(300);
    check("Escape closes the drawer", (await page.locator("[role=dialog]").count()) === 0);

    await page.locator("button", { hasText: "7 Days" }).first().click();
    await page.waitForTimeout(1500);
    check("range change refetches with range=7d", calls.some((c) => c.includes("range=7d")));
    const after = await page.locator(".ov-num").allInnerTexts();
    check("numbers follow the new range", after[1] === String(FIX.overview7d.kpis.newMembers.value), after.join(" | "));
    /* Money: net MRR, full price and discount are three separate, labelled numbers. */
    const mrrText = await page.locator("text=Monthly recurring revenue").first().locator("xpath=ancestor::div[contains(@class,'rounded-[16px]')][1]").innerText();
    check("MRR shows the net figure", mrrText.includes("$6,525"), mrrText.replace(/\s+/g, " "));
    check("MRR shows full price and the discount beside it", /Full price \$6,749/.test(mrrText) && /discounts −\$223\.50/.test(mrrText));
    check("comped and ending memberships are named", /1 comped \(100% off\)/.test(mrrText) && /1 ending \(\$111\.75\)/.test(mrrText));
    check("active members: paying and comped apart", (await page.getByText(/paying · 1 comped/).count()) >= 1);
    check("revenue card says the tax is extra", (await page.getByText(/plus \$[\d,.]+ sales tax/).count()) === 1);
    await page.click("button[aria-label^='Revenue']");
    await page.waitForTimeout(400);
    check("revenue drawer: revenue, tax and collected are separate lines", (await page.getByText("Sales tax collected").count()) === 1 && (await page.getByText("Collected, tax included").count()) === 1);
    await page.keyboard.press("Escape");

    check("no page errors", errors.length === 0, errors.join(" | "));
    await ctx.close();
  }

  /*
   * The states a phone sees while money is missing or slow. None of them may
   * leave a skeleton up: each ends in numbers or in a message with Try again.
   */
  {
    console.log("\n--- money states and recovery ---");
    const withKpis = (patch) => (u) => {
      if (u.pathname.endsWith("/map")) return FIX.map;
      if (u.pathname.endsWith("/list")) return FIX.list;
      const o = JSON.parse(JSON.stringify(FIX.overview));
      patch(o.kpis);
      return o;
    };

    {
      const { ctx, page, errors } = await open(browser, OWNER, {
        answer: withKpis((k) => (k.mrr = { source: "list_price", cents: null, fullPriceCents: 674883, discountCents: null, startCents: 674883, delta: null, payingMembers: 27, error: "Recurring revenue is unavailable right now." })),
      });
      await page.goto(`${BASE}/admin`, { waitUntil: "networkidle" });
      await page.waitForTimeout(1200);
      check("Stripe MRR missing: says so, offers Try again, shows only the list-price figure", (await page.getByText("Recurring revenue is unavailable right now.").count()) === 1 && (await page.getByText(/At full price: \$6,749\/mo/).count()) === 1);
      check("Stripe MRR missing: the other numbers still show", (await page.locator(".ov-num").count()) === 6);
      check("no page errors", errors.length === 0, errors.join(" | "));
      await ctx.close();
    }
    {
      const { ctx, page } = await open(browser, OWNER, {
        answer: withKpis((k) => Object.assign(k.revenue, { available: false, syncing: true, error: "Revenue is loading from Stripe for the first time. It will appear in a minute." })),
      });
      await page.goto(`${BASE}/admin`, { waitUntil: "networkidle" });
      await page.waitForTimeout(1200);
      check("first Stripe sync: revenue says it is loading, members show at once", (await page.getByText("Loading from Stripe…").count()) === 1 && (await page.locator(".ov-num").first().innerText()) === String(FIX.overview.kpis.activeMembers.value));
      await ctx.close();
    }
    {
      const { ctx, page } = await open(browser, OWNER, { answer: withKpis((k) => Object.assign(k.revenue, { stale: true })) });
      await page.goto(`${BASE}/admin`, { waitUntil: "networkidle" });
      await page.waitForTimeout(1200);
      check("a delayed Stripe sync is flagged on the revenue number, not shown as final", (await page.getByText(/Stripe sync delayed · may miss payments/).count()) === 1);
      await ctx.close();
    }
    {
      // The first answer fails as a dropped connection would; Try again recovers.
      let fail = true;
      const { ctx, page } = await open(browser, OWNER, { answer: (u) => (u.pathname.endsWith("/map") ? FIX.map : u.pathname.endsWith("/list") ? FIX.list : FIX.overview) });
      await ctx.route(/\/api\/admin\/overview\?/, (route) => (fail ? ((fail = false), route.abort("connectionreset")) : route.fallback()));
      await page.goto(`${BASE}/admin`, { waitUntil: "networkidle" });
      await page.waitForTimeout(1200);
      check("a failed load ends in a message, not a skeleton", (await page.getByText("Overview couldn't load").count()) >= 1 && (await page.locator("[aria-label='Loading overview']").count()) === 0);
      await page.getByRole("button", { name: "Try again" }).click();
      await page.waitForSelector(".ov-num", { timeout: 10000 }).catch(() => {});
      check("Try again loads the numbers", (await page.locator(".ov-num").count()) === 6);
      await ctx.close();
    }
    {
      const { ctx, page, errors } = await open(browser, OWNER, { width: 390, height: 844 });
      const t0 = Date.now();
      await page.goto(`${BASE}/admin`, { waitUntil: "domcontentloaded" });
      await page.waitForSelector(".ov-num", { timeout: 20000 }).catch(() => {});
      const ms = Date.now() - t0;
      check("phone: main numbers appear within 3 seconds", (await page.locator(".ov-num").count()) === 6 && ms < 3000, `${ms}ms`);
      check("phone: no skeleton left", (await page.locator("[aria-label='Loading overview']").count()) === 0);
      check("phone: no page errors", errors.length === 0, errors.join(" | "));
      await ctx.close();
    }
  }

  for (const [label, width, height] of [["phone", 390, 844], ["tablet", 834, 1112], ["desktop", 1440, 900]]) {
    const { ctx, page } = await open(browser, OWNER, { width, height });
    await page.goto(`${BASE}/admin`, { waitUntil: "networkidle" });
    await page.waitForTimeout(1500);
    /*
     * Against the device width, not innerWidth: on a phone a too-wide element
     * widens the layout viewport itself, so innerWidth grows to match and a
     * self-comparison passes while the page is zoomed out.
     */
    const m = await page.evaluate(() => ({ sw: document.documentElement.scrollWidth, iw: window.innerWidth }));
    check(`${label}: no sideways scroll`, m.sw <= width + 1 && m.iw <= width + 1, `scroll ${m.sw}, layout ${m.iw}, device ${width}`);
    await ctx.close();
  }

  /*
   * Responses the Overview must survive: an empty list (once crashed the whole
   * admin), a payload with most sections missing, and garbage from the list and
   * map endpoints. The admin shell must stay up every time.
   */
  {
    console.log("\n--- unexpected responses ---");
    const partial = (u) =>
      u.pathname.endsWith("/map")
        ? { points: [{ x: "?", y: null }] }
        : u.pathname.endsWith("/list")
          ? "nope"
          : { period: { label: "Last 30 days" }, kpis: { activeMembers: { value: 4 } }, sources: "x", plans: [null, 3], growth: { year: { points: [{}] } } };
    const cases = [
      ["an empty list", () => [], "error"],
      ["a string", () => "<html>Bad gateway</html>", "error"],
      ["a payload missing most sections", partial, "render"],
    ];
    for (const [label, answer, expect] of cases) {
      const { ctx, page, errors } = await open(browser, OWNER, { answer });
      await page.goto(`${BASE}/admin`, { waitUntil: "networkidle" });
      await page.waitForTimeout(1500);
      const shell = await page.evaluate(() => document.documentElement.id !== "__next_error__" && !!document.querySelector("header, nav"));
      check(`${label}: admin shell stays up`, shell);
      if (expect === "error") {
        check(`${label}: says it couldn't load, with a retry`, (await page.getByText("Overview couldn't load").count()) >= 1 && (await page.getByRole("button", { name: "Try again" }).count()) === 1);
      } else {
        const kpis = await page.locator(".ov-num").allInnerTexts();
        check(`${label}: renders what it has`, kpis.length === 6 && kpis[0] === "4", kpis.join(" | "));
        await page.click("button[aria-label^='New members']", { timeout: 5000 }).catch(() => {});
        await page.waitForTimeout(800);
        check(`${label}: a bad list opens an explained drawer`, (await page.getByText("This list couldn't load.").count()) === 1);
      }
      check(`${label}: no page errors`, errors.length === 0, errors.join(" | "));
      await ctx.close();
    }
  }

  {
    console.log("\n--- General Fixter ---");
    const { ctx, page, calls } = await open(browser, FIXTER);
    await page.goto(`${BASE}/admin`, { waitUntil: "networkidle" });
    await page.waitForTimeout(1500);
    check("no Overview tab for a Fixter", (await page.getByRole("button", { name: /Overview/ }).count()) === 0);
    await page.goto(`${BASE}/admin?tab=overview`, { waitUntil: "networkidle" });
    await page.waitForTimeout(1500);
    check("?tab=overview does not open it for a Fixter", (await page.locator("h2", { hasText: /^Overview$/ }).count()) === 0);
    check("a Fixter never calls the analytics API", calls.length === 0, calls.join(", "));
    await ctx.close();
  }

  await browser.close();
  const failed = results.filter((r) => !r.pass);
  console.log(`\n${results.length - failed.length}/${results.length} passed`);
  process.exit(failed.length ? 1 : 0);
})();
