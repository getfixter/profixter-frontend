/* eslint-disable @typescript-eslint/no-require-imports -- a plain Node script, like the other scripts/ */
/*
 * Read-only smoke test of Jobs, the job sheet, My day and Schedule against the
 * LOCAL preview backend (reports/PREVIEW-STACK.md, http://localhost:5055).
 * Never production: only localhost:5055 and the local frontend are allowed;
 * everything else is aborted. It opens screens and confirmation steps but
 * never submits one, so the shared preview data is left as it was.
 *
 *   NEXT_PUBLIC_API_URL=http://localhost:5055 npx next dev -p 3115
 *   node scripts/smoke_admin_jobs_preview.js http://localhost:3115
 */
const { chromium } = require("playwright");

const FRONT = (process.argv[2] || "http://localhost:3115").replace(/\/$/, "");
const API = "http://localhost:5055";
const results = [];
const check = (name, pass, d = "") => {
  results.push(pass);
  console.log(`${pass ? "PASS" : "FAIL"}  ${name}${d ? "  :: " + d : ""}`);
};

async function login(email, password) {
  const r = await fetch(`${API}/api/auth/login`, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ email, password }) });
  return (await r.json()).token;
}

async function context(browser, token) {
  const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true, serviceWorkers: "block" });
  await ctx.addInitScript((t) => location.pathname.startsWith("/admin") && localStorage.setItem("token", t), token);
  const blocked = [];
  const mutations = [];
  await ctx.route("**/*", async (route) => {
    const u = new URL(route.request().url());
    if (u.origin === API) {
      const m = route.request().method();
      const cors = { "access-control-allow-origin": new URL(FRONT).origin, "access-control-allow-headers": "Authorization,Content-Type", "access-control-allow-methods": "GET,POST,PUT,PATCH,DELETE,OPTIONS" };
      // The preview's CORS list names another track's port; answer the preflight here and forward from Node.
      if (m === "OPTIONS") return route.fulfill({ status: 204, headers: cors });
      if (!["GET", "HEAD"].includes(m) && !/\/api\/admin\/jobs\/search$/.test(u.pathname)) {
        mutations.push(`${m} ${u.pathname}`);
        return route.abort();
      }
      const response = await route.fetch();
      return route.fulfill({ response, headers: { ...response.headers(), ...cors } });
    }
    if (u.origin === new URL(FRONT).origin) return route.continue();
    blocked.push(u.href);
    return route.abort();
  });
  const page = await ctx.newPage();
  const errors = [];
  page.on("pageerror", (e) => errors.push(e.message));
  return { ctx, page, blocked, mutations, errors };
}

(async () => {
  const browser = await chromium.launch();
  const owner = await login("owner@preview.test", "preview-owner-1");
  const fixter = await login("fixter1@preview.test", "preview-fixter-1");
  check("preview logins work", Boolean(owner && fixter));

  {
    const { ctx, page, blocked, mutations, errors } = await context(browser, owner);
    await page.goto(`${FRONT}/admin/jobs`, { waitUntil: "domcontentloaded" });
    await page.waitForSelector("[data-needs-action], [data-section=jobs] [role=status]", { timeout: 60000 });
    await page.waitForSelector("[data-needs-action]", { timeout: 30000 }).catch(() => null);
    const chips = (await page.locator("[aria-label='Job views'] button").allInnerTexts()).map((t) => t.replace(/\s+/g, " "));
    const counts = await (await fetch(`${API}/api/admin/jobs?view=needs_action`, { headers: { authorization: `Bearer ${owner}` } })).json();
    check("Needs action renders from the real API", (await page.locator("[data-needs-group]").count()) > 0, chips.join(" | "));
    check("chip counts equal the server's counts", chips[0].includes(String(counts.counts.needsAction)) && chips[3].includes(String(counts.counts.week)), JSON.stringify(counts.counts));
    const groups = await page.locator("[data-needs-group]").evaluateAll((els) => els.map((e) => e.getAttribute("data-needs-group")));
    check("job, member, project and lead groups present", groups.some((g) => ["requests", "unassigned", "not-closed", "problems"].includes(g)) && groups.includes("member-payment") && groups.includes("projects"), groups.join(","));
    const badge = (await page.locator("[data-adm-bottomnav] a[data-nav=jobs]").innerText()).replace(/\s+/g, " ");
    check("Jobs badge equals counts.needsAction (real envelope)", badge.includes(String(counts.counts.needsAction > 9 ? "9+" : counts.counts.needsAction)), badge);
    await page.screenshot({ path: require("path").join(__dirname, "..", "..", "reports", "shots", "jobs", "preview-needs-action-390x844.png") });

    // Today / Week
    await page.locator("[aria-label='Job views'] button", { hasText: "Week" }).click();
    await page.waitForSelector("[data-day] [data-job-row]", { timeout: 30000 });
    check("Week lists the seeded jobs", (await page.locator("[data-job-row]").count()) === counts.counts.week, `${await page.locator("[data-job-row]").count()} vs ${counts.counts.week}`);

    // Search (POST body; read-only)
    await page.fill("input[type=search]", "Demo");
    await page.waitForSelector("[data-search-results], [data-search-scope]", { timeout: 30000 });
    await page.waitForTimeout(1500);
    check("search all dates returns grouped results", (await page.locator("[data-search-day]").count()) > 0, await page.locator("[data-search-scope]").innerText());
    await page.fill("input[type=search]", "");
    await page.locator("input[type=search]").blur();

    // A job sheet: open a Pending one and the confirm step (not submitted).
    await page.goto(`${FRONT}/admin/jobs`, { waitUntil: "domcontentloaded" });
    await page.waitForSelector("[data-needs-action] [data-job-row] a", { timeout: 60000 });
    await page.locator("[data-needs-group=requests] [data-job-row] a, [data-needs-action] [data-job-row] a").first().click();
    await page.waitForSelector("[role=dialog][data-sheet=job] [data-job-body]", { timeout: 30000 });
    const sheet = page.locator("[role=dialog][data-sheet=job]");
    check("job sheet loads the JobDetail DTO", /Job #/.test(await sheet.innerText()));
    const primary = await sheet.locator("[data-primary]").getAttribute("data-primary").catch(() => null);
    check("one primary action from allowedActions", Boolean(primary), primary || "none");
    if (primary === "confirm") {
      await sheet.locator("[data-primary=confirm]").click();
      await page.waitForSelector("[data-tech-picker]", { timeout: 30000 });
      check("Confirm & assign picker reads assignment-options", (await page.locator("[data-tech-option]").count()) > 0);
      await page.screenshot({ path: require("path").join(__dirname, "..", "..", "reports", "shots", "jobs", "preview-confirm-390x844.png") });
    }
    await page.keyboard.press("Escape");

    // Schedule
    await page.goto(`${FRONT}/admin/schedule?mode=week`, { waitUntil: "domcontentloaded" });
    await page.waitForSelector("[data-week-agenda]", { timeout: 60000 });
    check("Schedule week renders from /api/admin/schedule", (await page.locator("[data-week-day]").count()) === 7);
    check("owner: no write was attempted", mutations.length === 0, mutations.join(" "));
    check("owner: nothing outside localhost", blocked.length === 0, blocked.slice(0, 3).join(" "));
    check("owner: no page errors", errors.length === 0, errors.join(" | "));
    await ctx.close();
  }
  {
    const { ctx, page, blocked, errors } = await context(browser, fixter);
    await page.goto(`${FRONT}/admin/jobs`, { waitUntil: "domcontentloaded" });
    await page.waitForURL(/\/admin\/my-day/, { timeout: 60000 });
    await page.waitForSelector("[data-section=my-day]", { timeout: 60000 });
    await page.waitForTimeout(2000);
    const md = await (await fetch(`${API}/api/admin/my-day`, { headers: { authorization: `Bearer ${fixter}` } })).json();
    const n = md.today.rows.length + md.tomorrow.rows.length;
    check("Fixter: My day shows the server-scoped rows", (await page.locator("[data-job-row]").count()) === n, `${n} rows`);
    if (n) {
      await page.locator("[data-job-row] a").first().click();
      await page.waitForSelector("[role=dialog][data-sheet=job] [data-job-body]", { timeout: 30000 });
      const sheet = page.locator("[role=dialog][data-sheet=job]");
      check("Fixter sheet: no money, no customer link, no More", (await sheet.locator("[data-customer-link]").count()) === 0 && (await sheet.locator("[data-job-more]").count()) === 0 && !/Money/.test(await sheet.innerText()));
    }
    check("Fixter: nothing outside localhost", blocked.length === 0, blocked.slice(0, 3).join(" "));
    check("Fixter: no page errors", errors.length === 0, errors.join(" | "));
    await ctx.close();
  }
  await browser.close();
  const failed = results.filter((r) => !r).length;
  console.log(`\n${results.length - failed}/${results.length} passed`);
  process.exit(failed ? 1 : 0);
})().catch((e) => {
  console.error(e);
  process.exit(1);
});
