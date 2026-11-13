/* eslint-disable @typescript-eslint/no-require-imports -- a plain Node script, like the other scripts/ */
/*
 * The admin shell in a real browser (FE-FOUNDATION, 2026-11-12).
 *
 *   npx next start -p 3123          (after npm run build)
 *   npm run test:admin-shell        (or: node scripts/test_admin_shell_ui.js http://localhost:3123)
 *
 * FULL NETWORK JAIL on every context: requests to the local server pass;
 * every URL with /api/ in its path, on ANY host (api.profixter.com included),
 * is answered here from fake fixtures; everything else is aborted and
 * recorded. Nothing leaves the machine. Fake people only (@example.test).
 *
 * What it pins:
 * - every old /admin?tab= link lands on its new route; ?q= never comes back
 *   into the URL but reaches the search field; gift/paid returns toast
 * - landing per person: owner -> Jobs, field Fixter -> My day
 * - navigation at 320/375/390/430, landscape phone, tablet and desktop with
 *   no sideways overflow; bottom bar vs sidebar; screenshots
 * - the sheet: role=dialog, aria-modal, focus trapped, Escape closes and
 *   returns focus, close button visible, backdrop ignored with unsaved changes
 * - the bottom bar hides while the keyboard is open (emulated visualViewport)
 * - no third-party request at all on /admin, /tip, /pay (and the site still
 *   loads its trackers, so the guard is not over-broad)
 * - icons and both manifests are served; security headers on /admin
 * - Sign out calls POST /api/auth/logout and clears the browser session
 */
const { chromium } = require("playwright");
const fs = require("fs");
const path = require("path");

const BASE = (process.argv[2] || "http://localhost:3123").replace(/\/$/, "");
const SHOTS = process.env.SHOTS_DIR || path.join(__dirname, "..", "..", "reports", "shots", "foundation");
fs.mkdirSync(SHOTS, { recursive: true });

const OWNER = { _id: "owner1", userId: "PF-OWNER", name: "Owner Test", email: "owner@example.test", phone: "5550100", role: "admin", addresses: [] };
const FIELD = { _id: "fx1", userId: "PF-FX", name: "Field Fixter", email: "fixter@example.test", phone: "5550101", role: "employee", employeePosition: "Fixter", isActive: true, permissions: ["bookings.read", "bookings.write", "tips.read"], addresses: [] };
const GENERAL = { _id: "gf1", userId: "PF-GF", name: "General Fixter", email: "gf@example.test", phone: "5550102", role: "employee", employeePosition: "General Fixter", isActive: true, permissions: ["bookings.read", "bookings.write", "bookings.assign", "members.read", "schedule.read", "schedule.write", "tips.read"], addresses: [] };

const nyToday = new Intl.DateTimeFormat("en-CA", { timeZone: "America/New_York" }).format(new Date());
const at = (hour) => new Date(`${nyToday}T${String(hour).padStart(2, "0")}:00:00-05:00`).toISOString();
const BOOKINGS = Array.from({ length: 8 }, (_, i) => ({
  _id: `b${i + 1}`,
  bookingNumber: `#10${i + 1}`,
  userId: `u${(i % 3) + 1}`,
  name: `Test Customer ${i + 1}`,
  email: `customer${i + 1}@example.test`,
  phone: `555010${i}`,
  address: `${10 + i} Oak Demo St`,
  city: "Testville",
  state: "NY",
  zip: "11700",
  date: at(9 + i),
  status: ["pending", "confirmed", "confirmed", "completed", "pending confirmation", "confirmed", "canceled", "confirmed"][i],
  service: "Handyman visit",
  bookingType: i === 2 ? "one_time_handyman_visit" : "membership",
  assignedFixterName: i % 2 ? "Field Fixter" : "",
  assignedFixterId: i % 2 ? "fx1" : null,
  images: [],
}));
const USERS = [1, 2, 3, 4].map((n) => ({
  _id: `u${n}`,
  userId: `PF-U${n}`,
  name: `Test Customer ${n}`,
  email: `customer${n}@example.test`,
  phone: `555010${n}`,
  role: "user",
  addresses: [{ _id: `a${n}`, line1: `${n} Oak Demo St`, city: "Testville", state: "NY", zip: "11700" }],
  addressesDetailed: [{ _id: `a${n}`, line1: `${n} Oak Demo St`, city: "Testville", state: "NY", zip: "11700", plan: n % 2 ? "basic" : null }],
}));
USERS.push({ ...USERS[0], _id: "u9", userId: "PF-U9", name: "Ann Example", email: "ann@example.test" });
const LEADS = [{ _id: "l1", name: "Lead Person", email: "lead@example.test", phone: "5550199", serviceType: "Kitchen", status: "new", message: "Estimate please", createdAt: new Date().toISOString() }];

const results = [];
function check(name, pass, detail = "") {
  results.push({ name, pass: !!pass });
  console.log(`${pass ? "PASS" : "FAIL"}  ${name}${detail ? "  :: " + detail : ""}`);
}

async function open(browser, user, { width = 390, height = 844, touch, fakeViewport = false, token = true } = {}) {
  const mobile = touch ?? width < 1024;
  const ctx = await browser.newContext({ viewport: { width, height }, isMobile: mobile, hasTouch: mobile, serviceWorkers: "block" });
  // Admin pages only, so the sign-in page after Sign out shows what Sign out left behind.
  if (token) await ctx.addInitScript(() => location.pathname.startsWith("/admin") && localStorage.setItem("token", "ui-token"));
  if (fakeViewport) {
    await ctx.addInitScript(() => {
      const vv = new EventTarget();
      let h = null;
      Object.defineProperties(vv, {
        height: { get: () => (h === null ? window.innerHeight : h) },
        width: { get: () => window.innerWidth },
        offsetTop: { get: () => 0 },
        offsetLeft: { get: () => 0 },
        pageTop: { get: () => window.scrollY },
        scale: { get: () => 1 },
      });
      Object.defineProperty(window, "visualViewport", { get: () => vv, configurable: true });
      window.__setKeyboard = (px) => {
        h = px ? window.innerHeight - px : null;
        vv.dispatchEvent(new Event("resize"));
      };
    });
  }
  const external = [];
  const api = [];
  const local = new URL(BASE);
  await ctx.route("**/*", (route) => {
    const req = route.request();
    const u = new URL(req.url());
    if (u.pathname.includes("/api/")) {
      const cors = { "access-control-allow-origin": "*", "access-control-allow-headers": "Authorization,Content-Type", "access-control-allow-methods": "GET,POST,PUT,PATCH,DELETE,OPTIONS" };
      if (req.method() === "OPTIONS") return route.fulfill({ status: 204, headers: cors });
      const json = (body, status = 200) => route.fulfill({ status, contentType: "application/json", headers: cors, body: JSON.stringify(body) });
      api.push(`${req.method()} ${u.pathname}`);
      const p = u.pathname.replace(/^.*?(\/api\/)/, "/api/");
      if (p === "/api/auth/me") return user ? json(user) : json({ message: "No token" }, 401);
      if (p === "/api/auth/logout" || p === "/api/auth/logout-all") return json({ message: "Not found" }, 404);
      if (p === "/api/admin/bookings") return json(u.searchParams.get("assigned") === "me" ? BOOKINGS.filter((b) => b.assignedFixterId === "fx1") : BOOKINGS);
      if (p === "/api/admin/booking-assignees") return json({ fixters: [] });
      if (p === "/api/admin/users" || p === "/api/admin/members") return json(USERS);
      if (p === "/api/admin/blacklist") return json([]);
      if (p === "/api/admin/requests") return json(LEADS);
      if (p === "/api/admin/needs-action") return json({ groups: [{ key: "bookings", count: 3, items: [] }, { key: "members", count: 1, items: [] }] });
      if (p === "/api/admin/invoices/inv1") return json({ _id: "inv1", projectId: "p1" });
      if (p.startsWith("/api/admin/invoices/")) return json({ message: "Not found" }, 404);
      if (p === "/api/admin/projects") return json([]);
      return json(p.includes("summary") || p.includes("settings") ? {} : []);
    }
    if (u.origin === local.origin) return route.continue();
    external.push(u.href);
    return route.abort();
  });
  const page = await ctx.newPage();
  const errors = [];
  page.on("pageerror", (e) => errors.push(e.message));
  return { ctx, page, external, api, errors };
}

async function waitPath(page, re, timeout = 15000) {
  try {
    await page.waitForURL((url) => re.test(url.pathname + url.search), { timeout });
    return true;
  } catch {
    return false;
  }
}

(async () => {
  const browser = await chromium.launch();

  /* ---------------- old links ---------------- */
  console.log("\n--- old /admin?tab= links ---");
  const CASES = [
    ["", /^\/admin\/jobs$/],
    ["?tab=bookings", /^\/admin\/jobs$/],
    ["?tab=bookings&bookingId=b2", /^\/admin\/jobs\/b2$/],
    ["?bookingId=b3", /^\/admin\/jobs\/b3$/],
    ["?tab=customers&userId=u1", /^\/admin\/customers\/u1$/],
    ["?tab=users", /^\/admin\/customers$/],
    ["?tab=subscribed", /^\/admin\/customers\?filter=members$/],
    ["?tab=blacklist", /^\/admin\/customers\?filter=blocked$/],
    ["?tab=requests", /^\/admin\/leads$/],
    ["?tab=leads", /^\/admin\/leads$/],
    ["?tab=projects", /^\/admin\/projects$/],
    ["?tab=invoices&invoiceId=inv1", /^\/admin\/projects\/p1\?tab=invoices&invoice=inv1$/],
    ["?tab=invoices&invoiceId=gone1", /^\/admin\/projects$/],
    ["?tab=emails", /^\/admin\/communications$/],
    ["?tab=fixters", /^\/admin\/team$/],
    ["?tab=calendar", /^\/admin\/schedule\/availability$/],
    ["?tab=overview", /^\/admin\/overview$/],
    ["?tab=growth", /^\/admin\/assistant$/],
    ["?tab=tips", /^\/admin\/tips$/],
    ["?tab=recent-work", /^\/admin\/recent-work$/],
    ["?tab=promotion", /^\/admin\/promotion$/],
    ["?tab=activity", /^\/admin\/activity$/],
    ["?tab=something-old", /^\/admin\/jobs$/],
  ];
  {
    const { ctx, page, errors } = await open(browser, OWNER, { width: 1280, height: 860, touch: false });
    for (const [qs, re] of CASES) {
      await page.goto(`${BASE}/admin${qs}`, { waitUntil: "domcontentloaded" });
      const ok = await waitPath(page, re);
      check(`/admin${qs || ""} -> ${re.source}`, ok, new URL(page.url()).pathname + new URL(page.url()).search);
    }
    // ?q= reaches the search field and never comes back into the URL.
    await page.goto(`${BASE}/admin?tab=users&q=ann%40example.test`, { waitUntil: "domcontentloaded" });
    await waitPath(page, /^\/admin\/customers$/);
    await page.waitForSelector("input[type=search]", { timeout: 15000 });
    await page.waitForTimeout(400);
    check("?tab=users&q= lands on /admin/customers with no query in the URL", !page.url().includes("ann") && !page.url().includes("q="), page.url());
    check("the query reached the Customers search field", (await page.inputValue("input[type=search]")) === "ann@example.test");
    await page.goto(`${BASE}/admin?tab=bookings&q=%23104`, { waitUntil: "domcontentloaded" });
    await waitPath(page, /^\/admin\/jobs$/);
    await page.waitForSelector("input[type=search]", { timeout: 15000 });
    await page.waitForTimeout(300);
    check("?tab=bookings&q= hands the query to Jobs search", (await page.inputValue("input[type=search]")) === "#104" && !page.url().includes("q="));
    // Stripe returns.
    await page.goto(`${BASE}/admin?tab=users&gift=paid&session_id=cs_test_123`, { waitUntil: "domcontentloaded" });
    await waitPath(page, /^\/admin\/customers$/);
    const giftToast = await page.waitForSelector("[data-toast]", { timeout: 10000 }).then((el) => el.innerText()).catch(() => "");
    check("gift=paid: toast says what is true, session_id dropped", /gift invitation/i.test(giftToast) && !page.url().includes("session_id"), giftToast);
    await page.goto(`${BASE}/admin?tab=users&paid=membership`, { waitUntil: "domcontentloaded" });
    await waitPath(page, /^\/admin\/customers$/);
    const paidToast = await page.waitForSelector("[data-toast]", { timeout: 10000 }).then((el) => el.innerText()).catch(() => "");
    check("paid=membership: toast", /membership turns on/i.test(paidToast), paidToast);
    await page.goto(`${BASE}/admin?tab=users&gift=canceled`, { waitUntil: "domcontentloaded" });
    const cancelToast = await page.waitForSelector("[data-toast]", { timeout: 10000 }).then((el) => el.innerText()).catch(() => "");
    check("gift=canceled: toast", /Nothing was charged/.test(cancelToast), cancelToast);
    // A job link opens the job sheet over the list.
    await page.goto(`${BASE}/admin?tab=bookings&bookingId=b2`, { waitUntil: "domcontentloaded" });
    await waitPath(page, /^\/admin\/jobs\/b2$/);
    const sheet = await page.waitForSelector("[role=dialog][data-sheet=job]", { timeout: 15000 }).catch(() => null);
    check("job link opens the job sheet", Boolean(sheet) && /Test Customer 2/.test(await sheet.innerText()));
    check("the Jobs list stays mounted under the sheet", (await page.locator("[data-section=jobs]").count()) === 1);
    await page.keyboard.press("Escape");
    await waitPath(page, /^\/admin\/jobs$/);
    check("Escape closes the job sheet back to /admin/jobs", (await page.locator("[role=dialog]").count()) === 0);
    check("no page errors (owner)", errors.length === 0, errors.join(" | "));
    await ctx.close();
  }
  {
    const { ctx, page } = await open(browser, FIELD);
    await page.goto(`${BASE}/admin`, { waitUntil: "domcontentloaded" });
    check("field Fixter lands on My day", await waitPath(page, /^\/admin\/my-day$/));
    await page.goto(`${BASE}/admin?tab=users&q=ann%40example.test`, { waitUntil: "domcontentloaded" });
    check("field Fixter: a link to Customers falls back to My day", await waitPath(page, /^\/admin\/my-day$/));
    await page.waitForSelector("[data-adm-bottomnav]", { timeout: 15000 });
    const items = await page.locator("[data-adm-bottomnav] a").evaluateAll((as) => as.map((a) => a.getAttribute("data-nav")));
    check("field Fixter navigation: My day, Tips, Photos only", JSON.stringify(items) === JSON.stringify(["my-day", "tips", "work-photos"]), items.join(","));
    await page.goto(`${BASE}/admin/customers`, { waitUntil: "domcontentloaded" });
    check("field Fixter opening /admin/customers sees the permission state", await page.waitForSelector("[data-permission-state]", { timeout: 15000 }).then(() => true).catch(() => false));
    await ctx.close();
  }
  {
    const { ctx, page } = await open(browser, GENERAL);
    await page.goto(`${BASE}/admin`, { waitUntil: "domcontentloaded" });
    check("General Fixter lands on Jobs", await waitPath(page, /^\/admin\/jobs$/));
    await ctx.close();
  }
  {
    const { ctx, page } = await open(browser, null, { token: false });
    await page.goto(`${BASE}/admin/jobs`, { waitUntil: "domcontentloaded" });
    check("signed out: /admin/jobs goes to sign-in with next", await waitPath(page, /^\/signin\?next=%2Fadmin%2Fjobs$/));
    await ctx.close();
  }

  /* ---------------- navigation and overflow ---------------- */
  console.log("\n--- navigation at every size ---");
  const SIZES = [
    { name: "320x568", width: 320, height: 568, nav: "bottom" },
    { name: "375x667", width: 375, height: 667, nav: "bottom" },
    { name: "390x844", width: 390, height: 844, nav: "bottom" },
    { name: "430x932", width: 430, height: 932, nav: "bottom" },
    { name: "844x390-landscape", width: 844, height: 390, nav: "bottom" },
    { name: "820x1180-tablet", width: 820, height: 1180, nav: "bottom" },
    { name: "1440x900-desktop", width: 1440, height: 900, nav: "side", touch: false },
  ];
  for (const size of SIZES) {
    const { ctx, page, errors } = await open(browser, OWNER, size);
    for (const route of ["/admin/jobs", "/admin/customers", "/admin/more", "/admin/leads", "/admin/schedule"]) {
      await page.goto(`${BASE}${route}`, { waitUntil: "domcontentloaded" });
      await page.waitForSelector("[data-adm-shell]", { timeout: 20000 });
      await page.waitForTimeout(700);
      const m = await page.evaluate(() => {
        const vis = (sel) => {
          const el = document.querySelector(sel);
          if (!el) return false;
          const s = getComputedStyle(el);
          return s.display !== "none" && s.visibility !== "hidden" && el.getBoundingClientRect().height > 0;
        };
        const header = document.querySelector("[data-adm-header]").getBoundingClientRect();
        return {
          overflow: document.documentElement.scrollWidth - window.innerWidth,
          bottom: vis("[data-adm-bottomnav]"),
          side: vis("[data-adm-sidebar]"),
          header: Math.round(header.height),
          navItems: document.querySelectorAll("[data-adm-bottomnav] a").length,
          small: [...document.querySelectorAll("[data-adm-shell] *")].filter((el) => el.childElementCount === 0 && el.textContent.trim() && el.getBoundingClientRect().height > 0 && parseFloat(getComputedStyle(el).fontSize) < 12).length,
        };
      });
      const label = `${size.name} ${route}`;
      check(`${label}: no sideways overflow`, m.overflow <= 0, `+${m.overflow}px`);
      if (route === "/admin/jobs") {
        check(`${label}: ${size.nav === "bottom" ? "bottom bar, no sidebar" : "sidebar, no bottom bar"}`, size.nav === "bottom" ? m.bottom && !m.side : m.side && !m.bottom, JSON.stringify(m));
        check(`${label}: header height`, size.height <= 500 ? m.header === 44 : m.header === 52, `${m.header}px`);
        if (size.nav === "bottom") check(`${label}: Jobs, Schedule, Customers, Projects, More`, m.navItems === 5, `${m.navItems}`);
        check(`${label}: no text under 12px in the shell`, m.small === 0, `${m.small} elements`);
        await page.screenshot({ path: path.join(SHOTS, `jobs-${size.name}.png`) });
      }
      if (route === "/admin/more" && size.width === 390) await page.screenshot({ path: path.join(SHOTS, `more-${size.name}.png`) });
      if (route === "/admin/customers" && (size.width === 390 || size.width === 1440)) await page.screenshot({ path: path.join(SHOTS, `customers-${size.name}.png`) });
    }
    if (size.width === 390) {
      const badge = await page.locator("[data-adm-bottomnav] a[data-nav=jobs]").innerText();
      check("Jobs badge shows the Needs-action count", /3/.test(badge), badge.replace(/\s+/g, " "));
    }
    check(`${size.name}: no page errors`, errors.length === 0, errors.join(" | "));
    await ctx.close();
  }

  /* ---------------- sheet ---------------- */
  console.log("\n--- sheet: focus, Escape, close, unsaved changes ---");
  for (const size of [{ width: 390, height: 844 }, { width: 1440, height: 900, touch: false }]) {
    const { ctx, page } = await open(browser, OWNER, size);
    await page.goto(`${BASE}/admin/jobs`, { waitUntil: "domcontentloaded" });
    await page.waitForSelector("[data-global-search]", { timeout: 20000 });
    await page.click("[data-global-search]");
    const dialog = page.locator("[role=dialog]");
    await dialog.waitFor({ timeout: 5000 });
    check(`${size.width}: sheet is role=dialog aria-modal and labelled`, (await dialog.getAttribute("aria-modal")) === "true" && Boolean(await dialog.getAttribute("aria-labelledby")));
    let inside = true;
    for (let i = 0; i < 12; i++) {
      await page.keyboard.press(i % 3 === 2 ? "Shift+Tab" : "Tab");
      inside = inside && (await page.evaluate(() => Boolean(document.activeElement && document.activeElement.closest("[role=dialog]"))));
    }
    check(`${size.width}: Tab and Shift+Tab stay inside the sheet`, inside);
    const close = await page.locator("[data-sheet-close]").boundingBox();
    check(`${size.width}: close button visible and 44px`, close && close.width >= 44 && close.height >= 44 && close.y >= 0 && close.x + close.width <= size.width, JSON.stringify(close));
    if (size.width === 390) await page.screenshot({ path: path.join(SHOTS, "sheet-search-390x844.png") });
    await page.keyboard.press("Escape");
    await page.waitForTimeout(300);
    check(`${size.width}: Escape closes`, (await dialog.count()) === 0);
    check(`${size.width}: focus returns to the search button`, await page.evaluate(() => document.activeElement && document.activeElement.hasAttribute("data-global-search")));

    // Unsaved changes: Change password with typed text ignores the backdrop and asks on Escape.
    await page.click("[data-account-button]");
    await page.getByRole("menuitem", { name: /Change password/ }).click();
    await page.waitForSelector("[role=dialog] input[type=password]", { timeout: 5000 });
    await page.locator("[role=dialog] input[type=password]").first().fill("something");
    await page.mouse.click(5, 5);
    await page.waitForTimeout(350);
    check(`${size.width}: backdrop does not discard typed changes`, (await page.locator("[role=dialog] input[type=password]").count()) === 2);
    await page.keyboard.press("Escape");
    check(`${size.width}: Escape with changes asks first`, await page.getByText("Discard your changes?").isVisible());
    if (size.width === 390) await page.screenshot({ path: path.join(SHOTS, "sheet-discard-390x844.png") });
    await page.getByRole("button", { name: "Discard" }).click();
    await page.waitForTimeout(300);
    check(`${size.width}: Discard closes`, (await page.locator("[role=dialog]").count()) === 0);
    await ctx.close();
  }

  /* ---------------- keyboard ---------------- */
  console.log("\n--- keyboard ---");
  {
    const { ctx, page } = await open(browser, OWNER, { width: 390, height: 844, fakeViewport: true });
    await page.goto(`${BASE}/admin/jobs`, { waitUntil: "domcontentloaded" });
    await page.waitForSelector("input[type=search]", { timeout: 20000 });
    await page.waitForTimeout(500);
    const navBefore = await page.locator("[data-adm-bottomnav]").isVisible();
    await page.focus("input[type=search]");
    await page.evaluate(() => window.__setKeyboard(320));
    await page.waitForTimeout(300);
    const kb = await page.evaluate(() => ({
      open: document.documentElement.dataset.keyboard,
      inset: getComputedStyle(document.documentElement).getPropertyValue("--kb-inset").trim(),
      nav: getComputedStyle(document.querySelector("[data-adm-bottomnav]")).display,
      fieldBottom: document.querySelector("input[type=search]").getBoundingClientRect().bottom,
      limit: window.innerHeight - 320,
      chips: Boolean(document.querySelector("[aria-label='Job views']")),
    }));
    check("bottom bar visible before the keyboard", navBefore);
    check("keyboard open: data-keyboard=open and --kb-inset set", kb.open === "open" && kb.inset === "320px", JSON.stringify(kb));
    check("keyboard open: bottom bar hidden", kb.nav === "none");
    check("keyboard open: the search field is above the keyboard", kb.fieldBottom <= kb.limit, `${kb.fieldBottom} <= ${kb.limit}`);
    check("search mode hides the job view chips", kb.chips === false);
    await page.screenshot({ path: path.join(SHOTS, "keyboard-search-390x844.png") });
    await page.evaluate(() => {
      window.__setKeyboard(0);
      document.activeElement.blur();
    });
    await page.waitForTimeout(300);
    check("keyboard closed: bottom bar back", await page.locator("[data-adm-bottomnav]").isVisible());
    await ctx.close();
  }

  /* ---------------- trackers ---------------- */
  console.log("\n--- third-party scripts ---");
  {
    const { ctx, page, external } = await open(browser, OWNER, { width: 1280, height: 860, touch: false });
    for (const route of ["/admin", "/admin/jobs", "/admin/customers", "/admin/overview", "/admin/more"]) {
      await page.goto(`${BASE}${route}`, { waitUntil: "load" });
      await page.waitForTimeout(800);
    }
    const flags = await page.evaluate(() => ({ trackers: window.__pfTrackers || 0, fbq: typeof window.fbq, gtm: Boolean(document.querySelector("script[src*='googletagmanager']")) }));
    check("no third-party request on /admin pages", external.length === 0, external.join(" "));
    check("no GTM script, no fbq on /admin", !flags.trackers && flags.fbq === "undefined" && !flags.gtm, JSON.stringify(flags));
    external.length = 0;
    for (const route of ["/tip", "/tip?t=sometoken", "/pay/sometoken", "/sign/sometoken"]) {
      await page.goto(`${BASE}${route}`, { waitUntil: "load" }).catch(() => {});
      await page.waitForTimeout(800);
    }
    check("no third-party request on /tip, /pay, /sign", external.length === 0, external.join(" "));
    external.length = 0;
    await page.goto(`${BASE}/`, { waitUntil: "load" });
    await page.waitForTimeout(800);
    check("the customer site still loads its trackers (guard is not over-broad)", external.some((u) => u.includes("googletagmanager.com")) && external.some((u) => u.includes("connect.facebook.net")), external.slice(0, 3).join(" "));
    // Client-side navigation from the site into /admin becomes a full load without trackers.
    await page.evaluate(() => {
      const a = document.createElement("a");
      a.href = "/admin/more";
      a.textContent = "go";
      document.body.appendChild(a);
      a.click();
    });
    await waitPath(page, /^\/admin\/more$/);
    await page.waitForTimeout(800);
    check("site -> admin link: trackers gone after arrival", await page.evaluate(() => !window.__pfTrackers && typeof window.fbq === "undefined"));
    await ctx.close();
  }

  /* ---------------- icons, manifests, headers ---------------- */
  console.log("\n--- icons, manifests, headers ---");
  {
    const { ctx, page } = await open(browser, OWNER, { width: 1280, height: 860, touch: false });
    const req = page.request;
    const admin = await req.get(`${BASE}/admin/manifest.webmanifest`);
    const am = await admin.json();
    check("admin manifest: id, start_url, scope, names", am.id === "/admin" && am.start_url === "/admin/jobs" && am.scope === "/admin" && am.name === "Profixter Admin" && am.short_name === "PF Admin");
    check("admin manifest: content type", /manifest\+json/.test(admin.headers()["content-type"] || ""));
    check("admin manifest: Jobs, Schedule, Customers shortcuts", JSON.stringify(am.shortcuts.map((s) => s.url)) === JSON.stringify(["/admin/jobs", "/admin/schedule", "/admin/customers"]));
    const site = await (await req.get(`${BASE}/manifest.webmanifest`)).json();
    check("customer manifest keeps start_url / and scope /", site.start_url === "/" && site.scope === "/");
    check("customer manifest: separate maskable icons", site.icons.filter((i) => i.purpose === "maskable").every((i) => /maskable/.test(i.src)));
    const icons = [...am.icons.map((i) => i.src), ...site.icons.map((i) => i.src), "/apple-icon.png", "/icons/admin-apple-touch-180.png", "/favicon.ico", "/favicon-32.png", "/images/profixter-hammer-mark.png"];
    for (const src of icons) {
      const r = await req.get(`${BASE}${src}`);
      check(`icon served: ${src}`, r.status() === 200 && /image/.test(r.headers()["content-type"] || ""), `${r.status()} ${r.headers()["content-type"]}`);
    }
    await page.goto(`${BASE}/admin/jobs`, { waitUntil: "domcontentloaded" });
    const head = await page.evaluate(() => ({
      manifest: document.querySelector("link[rel=manifest]")?.getAttribute("href"),
      apple: document.querySelector("link[rel=apple-touch-icon]")?.getAttribute("href"),
      title: document.querySelector("meta[name=apple-mobile-web-app-title]")?.getAttribute("content"),
      titles: document.querySelectorAll("meta[name=apple-mobile-web-app-title]").length,
    }));
    check("/admin links the admin manifest, icon and app title", head.manifest === "/admin/manifest.webmanifest" && head.apple === "/icons/admin-apple-touch-180.png" && head.title === "PF Admin" && head.titles === 1, JSON.stringify(head));
    await page.goto(`${BASE}/`, { waitUntil: "domcontentloaded" });
    const siteHead = await page.evaluate(() => ({ manifest: document.querySelector("link[rel=manifest]")?.getAttribute("href"), title: document.querySelector("meta[name=apple-mobile-web-app-title]")?.getAttribute("content") }));
    check("the site keeps its own manifest and app title", siteHead.manifest === "/manifest.webmanifest" && siteHead.title === "Profixter", JSON.stringify(siteHead));
    const h = (await req.get(`${BASE}/admin/jobs`)).headers();
    check("/admin: X-Frame-Options DENY, frame-ancestors none, referrer policy, noindex", h["x-frame-options"] === "DENY" && /frame-ancestors 'none'/.test(h["content-security-policy"] || "") && h["referrer-policy"] === "strict-origin-when-cross-origin" && /noindex/.test(h["x-robots-tag"] || ""), JSON.stringify({ xfo: h["x-frame-options"], csp: h["content-security-policy"] }));
    const hs = (await req.get(`${BASE}/`)).headers();
    check("the site is not given the admin frame headers", !hs["x-frame-options"]);
    await ctx.close();
  }

  /* ---------------- loader and sign-out ---------------- */
  console.log("\n--- loader and sign-out ---");
  {
    const { ctx, page, api } = await open(browser, OWNER, { width: 390, height: 844 });
    await page.goto(`${BASE}/admin/more`, { waitUntil: "domcontentloaded" });
    await page.waitForSelector("[data-account-button]", { timeout: 20000 });
    await page.evaluate(() => {
      sessionStorage.setItem("pendingCheckoutPlan", "basic");
      localStorage.setItem("pfa:pref:maps", "apple");
      localStorage.setItem("pfa:scroll:/admin/jobs", "120");
    });
    await page.click("[data-account-button]");
    await page.getByRole("menuitem", { name: /^Sign out$/ }).click();
    await waitPath(page, /^\/signin/);
    const store = await page.evaluate(() => ({ token: localStorage.getItem("token"), maps: localStorage.getItem("pfa:pref:maps"), scroll: localStorage.getItem("pfa:scroll:/admin/jobs"), session: sessionStorage.length }));
    check("Sign out calls POST /api/auth/logout (404 from an old backend is fine)", api.includes("POST /api/auth/logout"));
    check("Sign out clears the token and session storage, keeps device preferences", !store.token && store.session === 0 && store.maps === "apple" && !store.scroll, JSON.stringify(store));
    await ctx.close();
  }
  {
    const { ctx, page } = await open(browser, OWNER, { width: 390, height: 844 });
    let release;
    const gate = new Promise((r) => (release = r));
    await page.route(/\/api\/auth\/me/, async (route) => {
      await gate;
      route.fulfill({ status: 200, contentType: "application/json", headers: { "access-control-allow-origin": "*" }, body: JSON.stringify(OWNER) });
    });
    await page.goto(`${BASE}/admin/jobs`, { waitUntil: "domcontentloaded" });
    await page.waitForTimeout(120);
    const early = await page.evaluate(() => Boolean(document.querySelector("[data-adm-loader] img")));
    await page.waitForTimeout(500);
    const later = await page.evaluate(() => {
      const el = document.querySelector("[data-adm-loader]");
      return { img: Boolean(el && el.querySelector("img")), role: el && el.getAttribute("role") };
    });
    await page.screenshot({ path: path.join(SHOTS, "loader-390x844.png") });
    release();
    check("loader hidden for the first 300ms", !early);
    check("loader shows the hammer after 300ms with role=status", later.img && later.role === "status", JSON.stringify(later));
    await ctx.close();
  }

  await browser.close();
  const failed = results.filter((r) => !r.pass);
  console.log(`\n${results.length - failed.length}/${results.length} passed`);
  if (failed.length) {
    console.log("FAILED:\n" + failed.map((f) => "  - " + f.name).join("\n"));
    process.exit(1);
  }
})().catch((error) => {
  console.error(error);
  process.exit(1);
});
