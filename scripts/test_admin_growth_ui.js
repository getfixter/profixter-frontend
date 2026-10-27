/*
 * Admin Growth tab: the booking numbers after the one-step free-visit request.
 *
 *   node scripts/test_admin_growth_ui.js [baseUrl]
 *
 * Every API call is answered in the browser (no real data, nothing sent), so
 * this needs only the built frontend.
 *
 * What it pins:
 * - the headline is account bookings + one-step requests, as the server sums them
 * - Pending Confirmation and Confirmed are shown apart, for 7 and 30 days
 * - the current funnel has no "Went to sign up" step and starts Oct 27
 * - the old sign-up funnel is kept, apart and collapsed, as history
 * - an older server without the new fields still renders (accounts only)
 * - nothing overflows sideways on a phone
 */
const { chromium } = require("playwright");

const BASE = process.argv[2] || "http://localhost:3000";
const OWNER = { _id: "owner", userId: "PF-OWNER", name: "Owner", email: "getfixter@gmail.com", role: "admin", addresses: [] };

const ACQUISITION = {
  firstFreeVisits: { last7: 2, prev7: 3, last30: 9, prev30: 8 },
  newFreeVisits: {
    last7: 7, prev7: 4, last30: 15, prev30: 8,
    last7Pending: 3, last7Confirmed: 4, last30Pending: 4, last30Confirmed: 11,
    fromAccounts30: 9, fromRequests30: 6,
  },
  visitors30: 900,
  registrations30: 30,
  bySource30: [{ key: "google", label: "Google", visitors: 300, registrations: 10, freeVisits: 5 }],
  funnel30: { booking_page_view: 120, booker_started: 40, slot_selected: 18, signup_view: 0, oneStepRequests: 5, firstFreeVisits: 1, since: "2026-10-27", flowSince: "2026-10-27", trackingSince: "2026-10-09" },
  funnelBefore: { booking_page_view: 800, booker_started: 260, slot_selected: 110, signup_view: 64, firstFreeVisits: 8, since: "2026-10-09", through: "2026-10-26" },
  costPerFirstFreeVisitCents: null,
};

const summary = (acquisition) => ({
  generatedAt: new Date().toISOString(),
  engineEnabled: false,
  capacity: { signal: "unknown", days: 21 },
  queue: { pending: [], recent: [], shadow: [], last7Days: {} },
  policies: [],
  outcomes: { checkoutRecovery: { windowDays: 7, sent: 0, recovered: 0, stillInWindow: 0 } },
  waitlist: { waiting: 0, last30Days: 0, topZips: [] },
  alerts: [],
  acquisition,
});

const results = [];
function check(name, pass, detail = "") {
  results.push({ name, pass: !!pass });
  console.log(`${pass ? "PASS" : "FAIL"}  ${name}${detail ? "  :: " + detail : ""}`);
}

async function open(browser, acquisition, { width = 1440, height = 900 } = {}) {
  const ctx = await browser.newContext({ viewport: { width, height }, isMobile: width < 700, hasTouch: width < 700 });
  await ctx.addInitScript(() => {
    localStorage.setItem("token", "ui-token");
    localStorage.setItem("profixter:growth:view", "classic"); // the Command Center, not the office game
  });
  const writes = [];
  await ctx.route(/\/api\//, (route) => {
    const req = route.request();
    const u = new URL(req.url());
    const cors = { "access-control-allow-origin": "*", "access-control-allow-headers": "Authorization,Content-Type" };
    if (req.method() === "OPTIONS") return route.fulfill({ status: 204, headers: cors });
    if (req.method() !== "GET") writes.push(`${req.method()} ${u.pathname}`);
    const json = (body, status = 200) => route.fulfill({ status, contentType: "application/json", headers: cors, body: JSON.stringify(body) });
    if (u.pathname === "/api/auth/me") return json(OWNER);
    if (u.pathname === "/api/admin/growth/summary") return json(summary(acquisition));
    // the other Growth panels are not under test: they show their own "could not load"
    if (u.pathname.startsWith("/api/admin/growth/") || u.pathname.startsWith("/api/admin/overview")) return json({ message: "not in this test" }, 503);
    return json([]);
  });
  const page = await ctx.newPage();
  const errors = [];
  page.on("pageerror", (e) => errors.push(e.message));
  await page.goto(`${BASE}/admin?tab=growth`, { waitUntil: "networkidle" });
  await page.getByText("New first free-visit bookings").first().waitFor({ timeout: 25000 }).catch(() => {});
  await page.waitForTimeout(800);
  return { ctx, page, errors, writes };
}

(async () => {
  const browser = await chromium.launch();

  {
    console.log("\n--- one-step booking numbers, desktop ---");
    const { ctx, page, errors, writes } = await open(browser, ACQUISITION);
    const card = page.locator("text=New first free-visit bookings").first().locator("xpath=ancestor::*[.//*[@data-testid='free-visit-split']][1]");
    const text = await card.innerText().catch(() => "");
    check("the card renders", text.length > 0);
    check("headline = account bookings + requests (7d 7, 30d 15)", /\b7\b/.test(text) && /\b15\b/.test(text), text.slice(0, 120).replace(/\n/g, " | "));
    const splits = await page.locator("[data-testid=free-visit-split]").allInnerTexts();
    check("Pending Confirmation and Confirmed for both windows", splits.length === 2 && /3\s*Pending Confirmation/.test(splits[0]) && /4\s*Confirmed/.test(splits[0]) && /4\s*Pending Confirmation/.test(splits[1]) && /11\s*Confirmed/.test(splits[1]), splits.join(" / ").replace(/\n/g, " "));
    check("says each visit is counted once", /each visit counted once/.test(text));
    check("the current funnel starts Oct 27", /Booking funnel since Oct 27/i.test(text));
    check("the current funnel shows requests sent", /Sent a request/.test(text));
    const old = page.locator("[data-testid=old-funnel]");
    check("the old flow is kept apart, collapsed", (await old.count()) === 1 && !(await old.evaluate((d) => d.open)));
    const visibleSignup = await page.getByText("Went to sign up").filter({ visible: true }).count();
    check("no visible 'Went to sign up' step in the current funnel", visibleSignup === 0);
    await old.locator("summary").click();
    const oldText = await old.innerText();
    check("history: the old funnel with its own sign-up step and dates", /Went to sign up/.test(oldText) && /\b64\b/.test(oldText) && /Oct 9/.test(oldText) && /Oct 26/.test(oldText), oldText.replace(/\n/g, " | ").slice(0, 160));
    check("history is not mixed into the current funnel", !/\b800\b/.test(text));
    check("no page errors", errors.length === 0, errors.join("; "));
    check("nothing was written to the server", writes.length === 0, writes.join(", "));
    await ctx.close();
  }

  {
    console.log("\n--- an older server (accounts only) ---");
    const legacy = { ...ACQUISITION, newFreeVisits: undefined, funnelBefore: undefined };
    const { ctx, page, errors } = await open(browser, legacy);
    check("still renders without the split", (await page.getByText("New first free-visit bookings").count()) >= 1 && (await page.locator("[data-testid=free-visit-split]").count()) === 0);
    check("no page errors", errors.length === 0, errors.join("; "));
    await ctx.close();
  }

  {
    console.log("\n--- phone ---");
    const { ctx, page, errors } = await open(browser, ACQUISITION, { width: 390, height: 844 });
    const overflow = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
    check("no sideways scroll on a phone", overflow <= 1, `${overflow}px`);
    check("the split shows on a phone", (await page.locator("[data-testid=free-visit-split]").count()) === 2);
    check("no page errors", errors.length === 0, errors.join("; "));
    await ctx.close();
  }

  await browser.close();
  const failed = results.filter((r) => !r.pass);
  console.log(`\n${results.length - failed.length}/${results.length} passed`);
  process.exit(failed.length ? 1 : 0);
})();
