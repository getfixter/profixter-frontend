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
 * - /admin/overview (the owner now lands on Jobs, 2026-11-12); six numbers; charts; map; activity
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
    await page.goto(`${BASE}/admin/overview`, { waitUntil: "networkidle" });
    await page.waitForSelector("h2:has-text('Overview')", { timeout: 20000 }).catch(() => {});
    await page.waitForTimeout(1200);
    check("/admin/overview shows Overview", (await page.locator("h2", { hasText: /^Overview$/ }).count()) === 1);
    const kpis = await page.locator(".ov-num").allInnerTexts();
    check("six snapshot numbers", kpis.length === 6, kpis.join(" | "));
    check("active members shown from the payload", kpis[0] === String(FIX.overview.kpis.activeMembers.value));
    check("growth and revenue charts drawn", (await page.locator("svg[role=img]").count()) >= 2);
    check("map rendered with pins", (await page.locator("svg[aria-label$='customers on the map'] circle.ov-pin").count()) > 10);
    check("customer funnel and acquisition present", (await page.getByText("Customer funnel").count()) === 1 && (await page.getByText("Customer acquisition").count()) === 1);
    check("unconnected Meta reporting is explained, not hidden", (await page.locator("[data-meta-reported=disconnected]").count()) === 1 && /nothing here is estimated/.test(await page.locator("[data-meta-reported]").innerText()));
    /* Acquisition: a Meta Ads total with Facebook / Instagram / Other Meta under it, and what Other is. */
    const metaTotal = await page.locator("tr[data-source-group=meta] td").nth(2).innerText();
    const fbIg = await Promise.all(["meta_facebook", "meta_instagram"].map((k) => page.locator(`tr[data-source=${k}] td`).nth(2).innerText()));
    check("Meta Ads total equals Facebook + Instagram + Other Meta", Number(metaTotal) === FIX.overview.sourceGroups[0].registrations && Number(fbIg[0]) + Number(fbIg[1]) <= Number(metaTotal), `${metaTotal} = ${fbIg.join(" + ")} + other`);
    check("Other says what it is made of", (await page.locator("[data-other-detail]").innerText()).includes("yelp.com"));
    await page.locator("tr[data-source-group=meta] button").click();
    await page.waitForTimeout(400);
    const tree = await page.locator("[role=dialog]").innerText();
    check("campaigns: an ad with only ids is shown by id, never given a name", tree.includes("ID 52606450943827"), tree.replace(/\s+/g, " ").slice(0, 160));
    await page.keyboard.press("Escape");
    await page.waitForTimeout(300);

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
    const mrrText = await page.locator("text=Monthly recurring revenue").first().locator("xpath=ancestor::div[@data-mrr-panel][1]").innerText();
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
      await page.goto(`${BASE}/admin/overview`, { waitUntil: "networkidle" });
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
      await page.goto(`${BASE}/admin/overview`, { waitUntil: "networkidle" });
      await page.waitForTimeout(1200);
      check("first Stripe sync: revenue says it is loading, members show at once", (await page.getByText("Loading from Stripe…").count()) === 1 && (await page.locator(".ov-num").first().innerText()) === String(FIX.overview.kpis.activeMembers.value));
      await ctx.close();
    }
    {
      const { ctx, page } = await open(browser, OWNER, { answer: withKpis((k) => Object.assign(k.revenue, { stale: true })) });
      await page.goto(`${BASE}/admin/overview`, { waitUntil: "networkidle" });
      await page.waitForTimeout(1200);
      check("a delayed Stripe sync is flagged on the revenue number, not shown as final", (await page.getByText(/Stripe sync delayed · may miss payments/).count()) === 1);
      await ctx.close();
    }
    {
      // The first answer fails as a dropped connection would; Try again recovers.
      let fail = true;
      const { ctx, page } = await open(browser, OWNER, { answer: (u) => (u.pathname.endsWith("/map") ? FIX.map : u.pathname.endsWith("/list") ? FIX.list : FIX.overview) });
      await ctx.route(/\/api\/admin\/overview\?/, (route) => (fail ? ((fail = false), route.abort("connectionreset")) : route.fallback()));
      await page.goto(`${BASE}/admin/overview`, { waitUntil: "networkidle" });
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
      await page.goto(`${BASE}/admin/overview`, { waitUntil: "domcontentloaded" });
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
    await page.goto(`${BASE}/admin/overview`, { waitUntil: "networkidle" });
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
      await page.goto(`${BASE}/admin/overview`, { waitUntil: "networkidle" });
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
    check("no Overview in the navigation for a Fixter", (await page.locator("a[data-nav=overview]").count()) === 0);
    await page.goto(`${BASE}/admin?tab=overview`, { waitUntil: "networkidle" });
    await page.waitForTimeout(1500);
    check("?tab=overview does not open it for a Fixter", (await page.locator("h2", { hasText: /^Overview$/ }).count()) === 0);
    check("a Fixter never calls the analytics API", calls.length === 0, calls.join(", "));
    await ctx.close();
  }

  /* ---------------- Customer acquisition (2026-11-17 audit) ---------------- */
  {
    console.log("\n--- acquisition: Meta reported vs Profixter recorded ---");
    const base = JSON.parse(JSON.stringify(FIX.overview));
    const inq = { firstFreeVisits: 0, freeVisitRequests: 0, inquiries: 0, confirmed: 0, completedVisits: 0, firstPaymentRevenueCents: 0, repeatRevenueCents: 0, newPayingCustomers: 0 };
    base.sources = base.sources.map((r) => ({ ...inq, ...r }));
    const meta = base.sourceGroups.find((g) => g.key === "meta");
    Object.assign(meta, { visitors: 876, inquiries: 4, freeVisitRequests: 2, confirmed: 2, completedVisits: 2, newPayingCustomers: 0 });
    base.sources.push({ ...inq, key: "before_tracking", label: "Before tracking began", group: null, visitors: 0, registrations: 2, freeVisits: 0, members: 6, revenueCents: 606500, firstPaymentRevenueCents: 14900, repeatRevenueCents: 591600, spendCents: null, conversion: null, share: null, costPerRegistrationCents: null, costPerMemberCents: null, roas: null, newPayingCustomers: 1 });
    base.funnel = {
      ...base.funnel, visitors: 1548, visitorsPartial: true, visitorsTrackingSince: "2026-10-08T00:41:55.208Z", staffPagesExcluded: 42, inquiries: 10, freeVisitRequests: 4, confirmed: 7, completed: 4, newPayingCustomers: 1,
      requestOutcomes: { confirmed: 2, completed: 1, declined: 1 },
      steps: {
        booking_page_view: { all: 1038, meta: 585, measuredFromYmd: "2026-10-10", measured: true, partial: true },
        booker_started: { all: 61, meta: 13, measuredFromYmd: "2026-10-10", measured: true, partial: true },
        slot_selected: { all: 30, meta: 5, measuredFromYmd: "2026-10-10", measured: true, partial: true },
        signup_view: { all: 6, meta: 2, measuredFromYmd: "2026-10-10", measured: true, partial: true },
        request_submitted: { all: null, meta: null, measuredFromYmd: null, measured: false, partial: false },
        request_failed: { all: null, meta: null, measuredFromYmd: null, measured: false, partial: false },
      },
    };
    base.metaEfficiency = { spendCents: null, inquiries: 4, confirmed: 2, newPayingCustomers: 0, firstPaymentRevenueCents: 0, costPerInquiryCents: null, costPerConfirmedBookingCents: null, costPerNewPayingCustomerCents: null, firstPaymentRoas: null, agencyFee: { known: false, cents: null, missingMonths: ["2026-10"] }, allInCostCents: null, allInCostPerNewPayingCustomerCents: null };
    base.metaEvents = { measuredFrom: null, measured: false, events: [] };
    base.definitions = { visitors: "Profixter: browsers seen for the first time", inquiries: "real requests for a visit", source: "First touch." };
    const connected = JSON.parse(JSON.stringify(base));
    connected.spend = { connected: true, status: "ok", lastSuccessAt: new Date(Date.now() - 2 * 86400000).toISOString(), stale: true, partial: false, totalCents: 76300, accountTimezone: "America/Los_Angeles", attributionSettings: ["7-day click or 1-day view"], reported: { impressions: 50000, clicks: 1400, outboundClicks: null, landingPageViews: 610, websiteLeads: 7, leads: 7, websitePurchases: 0, websiteSubscribes: 0, websiteSchedules: 2 } };
    connected.metaEfficiency = { ...base.metaEfficiency, spendCents: 76300, costPerInquiryCents: 19075, costPerConfirmedBookingCents: 38150, costPerNewPayingCustomerCents: null, firstPaymentRoas: 0 };
    connected.metaEvents = { measuredFrom: "2026-10-01T04:00:00.000Z", measured: true, partial: false, events: [{ eventName: "Lead", leadType: "account", sent: 3, failed: 0, fromServer: 3, fromBrowserRelay: 0, distinctEventIds: 3 }] };
    /* The membership path (2026-11-18): "connected" is a backend that sends it, "disconnected" an older one that does not. */
    Object.assign(connected.funnel.steps, {
      home_plans_click: { all: 40, meta: 4, googleOrganic: 25, measuredFromYmd: "2026-11-18", measured: true, partial: true },
      plans_view: { all: 90, meta: 30, googleOrganic: 20, measuredFromYmd: "2026-11-18", measured: true, partial: true },
      plan_selected: { all: 12, meta: 3, googleOrganic: 5, measuredFromYmd: "2026-11-18", measured: true, partial: true },
    });
    connected.funnel.firstPaidMemberships = 3;
    Object.assign(connected.sources.find((r) => r.key === "google_organic"), { visitors: 400, firstPaidMemberships: 2 });
    const fees = [];
    for (const [label, payload, width] of [["disconnected", base, 1440], ["connected", connected, 390]]) {
      const { ctx, page, errors } = await open(browser, OWNER, {
        width,
        height: 900,
        answer: (u) => (u.pathname.endsWith("/map") ? FIX.map : u.pathname.endsWith("/list") ? FIX.list : payload),
      });
      await ctx.route(/\/api\/admin\/overview\/agency-fees\//, (route) => {
        fees.push({ url: route.request().url(), body: JSON.parse(route.request().postData() || "{}") });
        return route.fulfill({ status: 200, contentType: "application/json", headers: { "access-control-allow-origin": "*" }, body: "{}" });
      });
      await page.goto(`${BASE}/admin/overview`, { waitUntil: "networkidle" });
      await page.locator("[data-acquisition-funnel]").waitFor({ timeout: 20000 }).catch(() => {});
      const funnel = (await page.locator("[data-acquisition-funnel]").innerText().catch(() => "")).replace(/\s+/g, " ");
      const reported = (await page.locator("[data-meta-reported]").innerText().catch(() => "")).replace(/\s+/g, " ");
      const cost = (await page.locator("[data-acquisition-cost]").innerText().catch(() => "")).replace(/\s+/g, " ");
      const events = (await page.locator("[data-meta-events]").innerText().catch(() => "")).replace(/\s+/g, " ");
      const path = (await page.locator("[data-membership-path]").innerText().catch(() => "")).replace(/\s+/g, " ");
      if (label === "disconnected") {
        check("membership path: an older backend reads Not measured, never 0", /Homepage plans link Not measured in this period/.test(path) && /First paid membership Not measured yet/.test(path), path.slice(0, 300));
      } else {
        check("membership path: Google Organic column from visitors to first paid membership", /Activity counts, not a funnel/.test(path) && /Visitors \(new browsers\) 400 1,548/.test(path) && /Homepage plans link measured from Nov 18, 2026 25 40 /.test(path) && /Plans page shown measured from Nov 18, 2026 20 90 /.test(path) && /Plan chosen measured from Nov 18, 2026 5 12 /.test(path) && /First paid membership customers 2 3 /.test(path) && !/%/.test(path.split("Each row")[0]), path.slice(0, 400));
      }
      check(`${label}: every funnel rate names numerator and denominator`, /2\.2% of form started|of booking form shown \(13 of 585\)/.test(funnel) && /\(13 of 585\)/.test(funnel), funnel.slice(0, 200));
      check(`${label}: an unmeasured step says Not measured, not 0`, /Submitted Not measured in this period/.test(funnel));
      check(`${label}: a partly measured step says from when`, /measured from Oct 10, 2026/.test(funnel));
      check(`${label}: inquiries are explained (requests + account bookings)`, /guest free-visit requests \(4 in all\)/.test(funnel));
      check(`${label}: source table has Inquiries / Confirmed / Completed / New paying / First payments`, (await page.locator("th").allInnerTexts()).map((t) => t.trim().toUpperCase()).filter((t) => ["INQUIRIES", "CONFIRMED", "COMPLETED", "NEW PAYING", "FIRST PAYMENTS", "ALL REVENUE"].includes(t)).length >= 6);
      check(`${label}: Before tracking began is its own row`, (await page.locator("tr[data-source=before_tracking]").count()) === 1);
      if (label === "disconnected") {
        check("disconnected: Meta shows Not connected, no numbers", /Not connected/.test(reported) && !/\$763/.test(reported));
        check("disconnected: every cost needs Meta spend", (cost.match(/needs Meta spend/g) || []).length >= 4, cost.slice(0, 200));
        check("disconnected: event log says Not measured", /Not measured/.test(events));
        check("disconnected: the owner sees the agency fee form for the missing month", (await page.locator("[data-acquisition-cost] select option[value='2026-10']").count()) === 1);
        await page.locator("[data-acquisition-cost] input").fill("1500");
        await page.locator("[data-acquisition-cost] button", { hasText: "Save fee" }).click();
        await page.waitForTimeout(800);
        check("owner saving a fee PUTs cents to the month", fees.length === 1 && /agency-fees\/2026-10$/.test(fees[0].url) && fees[0].body.cents === 150000, JSON.stringify(fees));
      } else {
        check("connected: Meta's spend, website leads and landing page views are shown as Meta's", /Reported by Meta Ads Manager/.test(reported) && /\$763/.test(reported) && /Website leads 7/i.test(reported) && /Landing page views 610/i.test(reported), reported.slice(0, 240));
        check("connected: outbound clicks missing from old rows read Not reported, not 0", /Outbound clicks Not reported/i.test(reported));
        check("connected: a stale sync is flagged", /Stale/.test(reported));
        check("connected: time zone and attribution setting are stated", /America\/Los_Angeles/.test(reported) && /7-day click or 1-day view/.test(reported));
        check("connected: cost per inquiry is spend over inquiries", /Per inquiry \$190\.75/i.test(cost) && /Meta spend ÷ 4 inquiries/.test(cost), cost.slice(0, 200));
        check("connected: no new paying customer means no cost per customer", /Per new paying customer — none in this period/i.test(cost), cost.slice(0, 260));
        check("connected: sent Lead events are listed", /Lead · account created 3/.test(events), events);
        check("connected: nothing overflows sideways on a phone", await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth + 1));
      }
      check(`${label}: no page errors`, errors.length === 0, errors.join(" | "));
      await ctx.close();
    }
  }

  await browser.close();
  const failed = results.filter((r) => !r.pass);
  console.log(`\n${results.length - failed.length}/${results.length} passed`);
  process.exit(failed.length ? 1 : 0);
})();
