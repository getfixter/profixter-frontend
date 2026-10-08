/*
 * Employee access in the browser: what each person sees, and the owner's editor.
 *
 *   node scripts/test_admin_access_ui.js [baseUrl]
 *
 * /api/auth/me is answered with each kind of account; the permissions in it
 * are what the real server computes (BackEnd utils/adminAccess.js, pinned by
 * BackEnd scripts/test_admin_access.js). Section APIs answer 403 unless the
 * account holds the permission, as the server does, so a screen that loads
 * something it should not shows up here as a refused call.
 *
 * What it pins:
 * - the owner sees every section (and no empty Work Photos tab)
 * - each employee sees exactly their sections; Fixters keep their old tabs
 * - typing ?tab= for a section you do not have lands on one you do
 * - no section is ever requested without its permission
 * - zero sections: a clear message, not a broken page; disabled: no Admin
 * - access removed while signed in: the tab goes on the next check
 * - the Employees editor: title, field work, switches, Select all / Clear all,
 *   Customer Map needing Overview, and exactly those ids sent on save
 * - the editor fits a phone and a desktop without sideways scrolling
 */
const { chromium } = require("playwright");

const BASE = process.argv[2] || "http://localhost:3000";

const results = [];
function check(name, pass, detail = "") {
  results.push({ name, pass: !!pass });
  console.log(`${pass ? "PASS" : "FAIL"}  ${name}${detail ? "  :: " + detail : ""}`);
}

/* The registry the backend serves to the owner's editor (shape only). */
const REGISTRY = {
  groups: [
    { id: "business", label: "Business" },
    { id: "operations", label: "Operations" },
    { id: "marketing", label: "Website & Marketing" },
    { id: "administration", label: "Administration" },
  ],
  sections: [
    { id: "overview", group: "business", label: "Overview", description: "Business performance", requires: null },
    { id: "customer-map", group: "business", label: "Customer Map", description: "Customer locations", requires: "overview" },
    { id: "members", group: "business", label: "Members", description: "Memberships", requires: null },
    { id: "customers", group: "business", label: "All Users", description: "Customer accounts", requires: null },
    { id: "leads", group: "business", label: "Leads", description: "Estimate requests", requires: null },
    { id: "projects", group: "business", label: "Projects", description: "Projects", requires: null },
    { id: "jobs", group: "operations", label: "Jobs", description: "All bookings", requires: null },
    { id: "schedule", group: "operations", label: "Schedule", description: "Calendar", requires: null },
    { id: "recent-work", group: "marketing", label: "Recent Work / Photos", description: "Website photos", requires: null },
    { id: "communications", group: "marketing", label: "Communications", description: "Email & SMS", requires: null },
    { id: "promotion", group: "marketing", label: "Promotion Popup", description: "Popup", requires: null },
    { id: "blacklist", group: "administration", label: "Blacklist", description: "Blocked", requires: null },
    { id: "activity", group: "administration", label: "Activity Log", description: "Audit", requires: null },
  ],
  positions: ["Fixter", "General Fixter"],
  includedByPosition: { Fixter: [], "General Fixter": ["members", "jobs", "schedule"] },
};

const OWNER = { _id: "o", userId: "1", name: "Owner", email: "getfixter@gmail.com", role: "customer", isOwner: true, permissions: [], addresses: [] };
const emp = (name, permissions, extra = {}) => ({ _id: name, userId: name, name, email: `${name}@example.com`, role: "employee", isActive: true, employeePosition: null, employeeTitle: "Marketing Manager", permissions, addresses: [], ...extra });
const PEOPLE = {
  owner: OWNER,
  overview: emp("olive", ["analytics.read"]),
  photos: emp("pat", ["recentWork.manage"]),
  both: emp("bo", ["analytics.read", "analytics.map", "recentWork.manage"]),
  zero: emp("zed", []),
  disabled: emp("dee", ["analytics.read"], { isActive: false }),
  fixter: emp("fred", ["bookings.read", "bookings.write", "tips.read"], { employeePosition: "Fixter", employeeTitle: "" }),
  general: emp("gina", ["bookings.read", "bookings.write", "bookings.assign", "members.read", "schedule.read", "schedule.write", "tips.read"], { employeePosition: "General Fixter", employeeTitle: "" }),
};

/* Which permission each API prefix needs - the server's rule, in miniature. */
const API_PERMISSION = [
  [/^\/api\/admin\/overview\/map/, "analytics.map"],
  [/^\/api\/admin\/overview/, "analytics.read"],
  [/^\/api\/admin\/users(\/|$)/, "customers.manage"],
  [/^\/api\/admin\/members/, "members.read"],
  [/^\/api\/admin\/requests/, "leads.manage"],
  [/^\/api\/admin\/blacklist/, "blacklist.manage"],
  [/^\/api\/admin\/booking-assignees/, "bookings.assign"],
  [/^\/api\/admin\/bookings/, "bookings.read"],
  [/^\/api\/admin\/recent-work/, "recentWork.manage"],
  [/^\/api\/admin\/projects/, "projects.manage"],
  [/^\/api\/admin\/communications/, "communications.manage"],
  [/^\/api\/admin\/activity-log/, "activity.read"],
  [/^\/api\/admin\/calendar/, "schedule.read"],
  [/^\/api\/admin\/tips/, "tips.read"],
  [/^\/api\/admin\/fixters/, "owner"],
];

async function open(browser, who, { width = 1440, height = 900, mutate } = {}) {
  const ctx = await browser.newContext({ viewport: { width, height }, isMobile: width < 700, hasTouch: width < 700 });
  await ctx.addInitScript(() => localStorage.setItem("token", "ui-token"));
  const state = { me: JSON.parse(JSON.stringify(PEOPLE[who])), refused: [], saved: null };
  if (mutate) mutate(state);
  await ctx.route(/\/api\//, async (route) => {
    const req = route.request();
    const u = new URL(req.url());
    const cors = { "access-control-allow-origin": "*", "access-control-allow-headers": "Authorization,Content-Type", "access-control-allow-methods": "GET,POST,PUT,PATCH,DELETE,OPTIONS" };
    if (req.method() === "OPTIONS") return route.fulfill({ status: 204, headers: cors });
    const json = (body, status = 200) => route.fulfill({ status, contentType: "application/json", headers: cors, body: JSON.stringify(body) });
    const me = state.me;
    if (u.pathname === "/api/auth/me") return me.isActive === false ? json({ message: "Employee account is inactive" }, 403) : json(me);
    const rule = API_PERMISSION.find(([re]) => re.test(u.pathname));
    if (rule) {
      const owner = me.isOwner;
      const ok = owner || (rule[1] !== "owner" && (me.permissions || []).includes(rule[1]));
      if (!ok) {
        state.refused.push(`${req.method()} ${u.pathname}`);
        return json({ message: "Access denied" }, 403);
      }
      if (u.pathname === "/api/admin/fixters/access-registry") return json(REGISTRY);
      if (u.pathname === "/api/admin/fixters" && req.method() === "GET") return json({ fixters: state.fixters || [] });
      if (u.pathname.startsWith("/api/admin/fixters") && (req.method() === "POST" || req.method() === "PUT")) {
        state.saved = { method: req.method(), body: JSON.parse(req.postData() || "{}") };
        return json({ fixter: { id: "new", ...state.saved.body } }, req.method() === "POST" ? 201 : 200);
      }
      if (u.pathname === "/api/admin/overview") return json({ period: { key: "30d", label: "Last 30 days", from: "2026-09-08T04:00:00Z", to: "2026-10-08T04:00:00Z", fromYmd: "2026-09-08", toYmd: "2026-10-07" }, kpis: {} });
      if (u.pathname === "/api/admin/recent-work") return json({ photos: [], counts: {} });
      if (u.pathname === "/api/admin/activity-log/summary") return json({ usersDeleted: 0, leadsDeleted: 0, projectsDeleted: 0 });
      return json([]);
    }
    if (u.pathname === "/api/admin/activity-log/summary") return json({ usersDeleted: 0, leadsDeleted: 0, projectsDeleted: 0 });
    return json([]);
  });
  const page = await ctx.newPage();
  const errors = [];
  page.on("pageerror", (e) => errors.push(e.message));
  page.on("dialog", (d) => d.dismiss());
  return { ctx, page, state, errors };
}

async function tabs(page) {
  // The visible tab bar (desktop row or phone bottom bar): the label of each section offered.
  return page.evaluate(() =>
    [...document.querySelectorAll("[role=tablist] [role=tab][data-tab]")]
      .filter((el) => el.getBoundingClientRect().width > 0)
      .map((el) => el.getAttribute("aria-label") || (el.innerText || "").split(/\n/).map((s) => s.trim()).filter(Boolean)[1] || "")
  );
}

async function selectedTab(page) {
  return page.evaluate(() => {
    const el = [...document.querySelectorAll("[role=tab][aria-selected=true][data-tab]")].find((e) => e.getBoundingClientRect().width > 0);
    return el ? el.getAttribute("data-tab") : null;
  });
}

(async () => {
  const browser = await chromium.launch();

  console.log("\n--- who sees what ---");
  const EXPECT = {
    owner: { has: ["Overview", "Jobs", "All Users", "Projects", "Leads", "Communications", "Recent Work", "Blacklist", "Schedule", "Employees", "Activity Log"], not: ["Work Photos"] },
    overview: { has: ["Overview"], not: ["Jobs", "All Users", "Recent Work", "Employees", "Tips"] },
    photos: { has: ["Recent Work"], not: ["Overview", "Jobs", "All Users", "Employees", "Work Photos"] },
    both: { has: ["Overview", "Recent Work"], not: ["Jobs", "All Users", "Employees", "Members"] },
    fixter: { has: ["Jobs", "Tips", "Work Photos"], not: ["Overview", "Members", "Schedule", "Employees", "All Users"] },
    general: { has: ["Jobs", "Tips", "Work Photos", "Members", "Schedule"], not: ["Overview", "Employees", "All Users"] },
  };
  for (const [who, want] of Object.entries(EXPECT)) {
    const { ctx, page, state, errors } = await open(browser, who);
    await page.goto(`${BASE}/admin`, { waitUntil: "networkidle" });
    await page.waitForTimeout(1200);
    const seen = (await tabs(page)).join(" | ");
    const has = want.has.every((l) => seen.includes(l));
    const not = want.not.filter((l) => new RegExp(`(^|\\| |\\b)${l}(\\b| \\||$)`).test(seen));
    check(`${who}: sees exactly their sections`, has && !not.length, `seen: ${seen}${not.length ? " | should not: " + not.join(",") : ""}`);
    check(`${who}: never requests a section it lacks`, state.refused.length === 0, state.refused.join(", "));
    check(`${who}: no page errors`, errors.length === 0, errors.join(" | "));
    await ctx.close();
  }

  console.log("\n--- typed URLs ---");
  for (const [who, tab, expectTitle] of [["overview", "users", "Overview"], ["photos", "overview", null], ["photos", "fixters", null], ["fixter", "overview", null]]) {
    const { ctx, page, state } = await open(browser, who);
    await page.goto(`${BASE}/admin?tab=${tab}`, { waitUntil: "networkidle" });
    await page.waitForTimeout(1200);
    const landed = await selectedTab(page);
    check(`${who} typing ?tab=${tab}: not shown, nothing requested`, state.refused.length === 0 && landed !== tab, `landed on ${landed}; refused: ${state.refused.join(", ")}`);
    if (expectTitle) check(`${who}: lands on ${expectTitle} instead`, (await page.getByRole("heading", { name: expectTitle }).count()) >= 1);
    await ctx.close();
  }

  console.log("\n--- edges ---");
  {
    const { ctx, page, state } = await open(browser, "zero");
    await page.goto(`${BASE}/admin`, { waitUntil: "networkidle" });
    await page.waitForTimeout(1000);
    check("zero sections: says no sections yet, requests nothing", (await page.getByText("No Admin sections yet").count()) === 1 && state.refused.length === 0, state.refused.join(", "));
    await ctx.close();
  }
  {
    const { ctx, page } = await open(browser, "disabled");
    await page.goto(`${BASE}/admin`, { waitUntil: "networkidle" });
    await page.waitForTimeout(1500);
    const url = page.url();
    check("disabled: no Admin (signed out to sign-in)", !/\/admin/.test(url) || (await page.getByText("Access Denied").count()) === 1, url);
    await ctx.close();
  }
  {
    const { ctx, page, state } = await open(browser, "both");
    await page.goto(`${BASE}/admin?tab=recent-work`, { waitUntil: "networkidle" });
    await page.waitForTimeout(1000);
    const before = (await tabs(page)).join(" | ");
    state.me.permissions = ["analytics.read", "analytics.map"]; // the owner switched Photos off
    await page.evaluate(() => window.dispatchEvent(new Event("focus")));
    await page.waitForTimeout(1500);
    const after = (await tabs(page)).join(" | ");
    check("access removed while signed in: the tab goes on the next check", before.includes("Recent Work") && !after.includes("Recent Work") && after.includes("Overview"), `${before} -> ${after}`);
    state.me.permissions = ["analytics.read", "analytics.map", "recentWork.manage", "customers.manage"]; // and turned All Users on
    await page.evaluate(() => window.dispatchEvent(new Event("focus")));
    await page.waitForTimeout(1500);
    check("access added while signed in: the tab appears", (await tabs(page)).join(" | ").includes("All Users"));
    await ctx.close();
  }

  console.log("\n--- the owner's Employees editor ---");
  for (const [label, width, height] of [["phone", 390, 844], ["desktop", 1440, 900]]) {
    const { ctx, page, state, errors } = await open(browser, "owner", { width, height });
    await page.goto(`${BASE}/admin?tab=fixters`, { waitUntil: "networkidle" });
    await page.waitForTimeout(1200);
    await page.getByRole("button", { name: "+ Add Employee" }).click();
    const dialog = page.getByRole("dialog", { name: "Add Employee" });
    await dialog.waitFor();
    await dialog.getByLabel("First name").fill("John");
    await dialog.getByLabel("Last name").fill("Smith");
    await dialog.getByLabel("Email").fill("john@example.com");
    await dialog.getByLabel("Title").fill("Marketing Manager");
    const mapSwitch = dialog.getByRole("switch", { name: "Customer Map" });
    check(`${label}: Customer Map waits for Overview`, await mapSwitch.isDisabled());
    await dialog.getByRole("switch", { name: "Overview" }).click();
    check(`${label}: Customer Map available once Overview is on`, !(await mapSwitch.isDisabled()));
    await mapSwitch.click();
    await dialog.getByRole("switch", { name: "Recent Work / Photos" }).click();
    // Select all, then Clear all, then back to the three we want.
    await dialog.getByRole("button", { name: "Select all" }).click();
    const allOn = await dialog.getByRole("switch", { checked: true }).count();
    await dialog.getByRole("button", { name: "Clear all" }).click();
    const noneOn = await dialog.getByRole("switch", { checked: true }).count();
    check(`${label}: Select all / Clear all`, allOn === REGISTRY.sections.length && noneOn === 0, `${allOn} / ${noneOn}`);
    await dialog.getByRole("switch", { name: "Overview" }).click();
    await dialog.getByRole("switch", { name: "Customer Map" }).click();
    await dialog.getByRole("switch", { name: "Recent Work / Photos" }).click();
    const knobs = await dialog.evaluate((d) =>
      [...d.querySelectorAll("[role=switch]")].every((sw) => {
        const t = sw.getBoundingClientRect();
        const k = sw.querySelector("span").getBoundingClientRect();
        return k.left >= t.left - 0.5 && k.right <= t.right + 0.5;
      })
    );
    check(`${label}: every switch knob sits inside its track, on and off`, knobs);
    // The title is just a label: it changes no switch.
    check(`${label}: typing a title switches nothing on`, (await dialog.getByRole("switch", { checked: true }).count()) === 3);
    const m = await page.evaluate(() => ({ sw: document.documentElement.scrollWidth, iw: window.innerWidth, dlg: document.querySelector("[role=dialog]")?.getBoundingClientRect() }));
    // Against the device width: on a phone a too-wide element widens the layout itself.
    check(`${label}: editor fits, no sideways scroll`, m.sw <= width + 1 && m.iw <= width + 1 && m.dlg && m.dlg.right <= width + 1 && m.dlg.left >= -1, `scroll ${m.sw}, layout ${m.iw}, device ${width}`);
    // Optional: PF_SHOTS=<folder> keeps a picture of the editor for review.
    if (process.env.PF_SHOTS) await page.screenshot({ path: `${process.env.PF_SHOTS}/admin-access-${label}.png` }).catch(() => {});
    await dialog.getByRole("button", { name: "Save Employee" }).click();
    await page.waitForTimeout(800);
    const body = state.saved?.body || {};
    check(
      `${label}: saves exactly what was switched on`,
      state.saved?.method === "POST" && JSON.stringify(body.adminSections) === JSON.stringify(["overview", "customer-map", "recent-work"]) && body.employeeTitle === "Marketing Manager" && body.employeePosition === null,
      JSON.stringify(body)
    );
    check(`${label}: no page errors`, errors.length === 0, errors.join(" | "));
    await ctx.close();
  }
  {
    // A General Fixter's editor: Jobs / Members / Schedule shown as included, not as extra grants.
    const { ctx, page } = await open(browser, "owner", {
      mutate: (s) => {
        s.fixters = [{ id: "g1", firstName: "Gina", lastName: "General", email: "gina@example.com", phone: "+16315550101", role: "employee", employeePosition: "General Fixter", employeeTitle: "Senior Fixter", adminSections: ["recent-work"], isActive: true, mustChangePassword: false, isDefaultFixter: false, employeeAvailabilityStatus: "Available", completedBookingsCount: 12, offDaysSummary: { upcomingCount: 0, pastCount: 0, recent: [] } }];
      },
    });
    await page.goto(`${BASE}/admin?tab=fixters`, { waitUntil: "networkidle" });
    await page.waitForTimeout(1200);
    check("list shows title, status and access", (await page.getByText("Senior Fixter").count()) >= 1 && (await page.getByText(/General Fixter jobs · Recent Work \/ Photos/).count()) === 1);
    await page.getByRole("button", { name: "Edit", exact: true }).click();
    const dialog = page.getByRole("dialog");
    await dialog.waitFor();
    const jobs = dialog.getByRole("switch", { name: "Jobs" });
    check("field work shows what it already includes", (await jobs.getAttribute("aria-checked")) === "true" && (await jobs.isDisabled()) && (await dialog.getByText("Included with General Fixter").count()) === 3);
    await ctx.close();
  }
  {
    // An older account with no first/last name: shown by its full name, and deleting it still needs typing.
    const { ctx, page } = await open(browser, "owner", {
      mutate: (s) => {
        s.fixters = [{ id: "l1", name: "Legacy Larry", firstName: "", lastName: "", email: "larry@example.com", phone: "+16315550102", role: "employee", employeePosition: "Fixter", employeeTitle: "", adminSections: [], isActive: true, mustChangePassword: false, isDefaultFixter: false, employeeAvailabilityStatus: "Available", completedBookingsCount: 3, offDaysSummary: { upcomingCount: 0, pastCount: 0, recent: [] } }];
      },
    });
    await page.goto(`${BASE}/admin?tab=fixters`, { waitUntil: "networkidle" });
    await page.waitForTimeout(1200);
    check("an account with only a full name is listed by it", (await page.getByRole("heading", { name: "Legacy Larry" }).count()) === 1);
    await page.getByRole("button", { name: "Edit", exact: true }).click();
    await page.getByRole("button", { name: "Delete this employee…" }).click();
    const del = page.getByRole("button", { name: "Permanently Delete" });
    check("delete stays locked with an empty confirmation", await del.isDisabled());
    await page.keyboard.type("Legacy"); // the confirmation box has focus
    check("delete unlocks once the name is typed", !(await del.isDisabled()));
    await ctx.close();
  }

  await browser.close();
  const failed = results.filter((r) => !r.pass);
  console.log(`\n${results.length - failed.length}/${results.length} passed`);
  process.exit(failed.length ? 1 : 0);
})();
