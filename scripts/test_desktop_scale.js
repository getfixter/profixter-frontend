/*
 * The customer site from tablet to 2560px: one fluid type system, no sideways
 * scroll, nothing cut off.
 *
 *   node scripts/test_desktop_scale.js [baseUrl]
 *
 * What it pins:
 * - app/desktop-scale.css matches what scripts/build_desktop_scale.js builds
 * - a headline is its designed size from 1440px wide on a normal-height
 *   screen, smaller on a laptop, smaller still at 150% zoom, never larger
 * - phones keep the phone scale (app/mobile-scale.css)
 * - the admin and the /event kiosk are never scaled
 * - no page scrolls sideways from 1024px up, or at 125/150/200% zoom
 * - the homepage job suggestions wrap instead of running off the card
 *
 * PF_CORS_PROXY=<path to a module(ctx)> routes API calls for a local build on
 * a port the API's CORS list does not include.
 */
const { chromium } = require("playwright");
const { execFileSync } = require("child_process");
const path = require("path");

const OVERVIEW = require(path.join(__dirname, "fixtures", "admin-overview.json"));
const BASE = process.argv[2] || "http://localhost:3000";

const results = [];
function check(name, pass, detail = "") {
  results.push({ name, pass: !!pass });
  console.log(`${pass ? "PASS" : "FAIL"}  ${name}${detail ? "  :: " + detail : ""}`);
}

const ADMIN = { _id: "owner", userId: "PF-OWNER", name: "Owner", email: "owner@example.com", role: "admin", addresses: [] };

async function open(browser, width, height, url, { admin = false } = {}) {
  const ctx = await browser.newContext({ viewport: { width, height }, isMobile: width < 700, hasTouch: width < 700 });
  await ctx.addInitScript(() => {
    try { localStorage.setItem("profixter_promotion_popup_dismissed_date", new Date().toISOString().slice(0, 10)); } catch {}
  });
  if (admin) {
    /* Signed out, /admin sends you to sign-in, a site page. Answer as an admin. */
    await ctx.addInitScript(() => localStorage.setItem("token", "scale-token"));
    await ctx.route(/\/api\//, (route) => {
      const cors = { "access-control-allow-origin": "*", "access-control-allow-headers": "Authorization,Content-Type" };
      if (route.request().method() === "OPTIONS") return route.fulfill({ status: 204, headers: cors });
      const p = new URL(route.request().url()).pathname;
      const body = p === "/api/auth/me" ? ADMIN : p === "/api/admin/overview/map" ? OVERVIEW.map : p === "/api/admin/overview" ? OVERVIEW.overview : [];
      return route.fulfill({ status: 200, contentType: "application/json", headers: cors, body: JSON.stringify(body) });
    });
  } else if (process.env.PF_CORS_PROXY) await require(process.env.PF_CORS_PROXY)(ctx);
  const page = await ctx.newPage();
  await page.goto(BASE + url, { waitUntil: "domcontentloaded", timeout: 60000 });
  await page.waitForTimeout(1500);
  return { ctx, page };
}

const h1Size = (page) => page.evaluate(() => {
  const h = [...document.querySelectorAll("h1")].find((e) => e.getBoundingClientRect().height > 0);
  return h ? Math.round(parseFloat(getComputedStyle(h).fontSize)) : null;
});

/* A probe with a class the site uses, so the size comes from the real CSS. */
const probe = (page, cls) => page.evaluate((c) => {
  const el = document.createElement("div");
  el.className = c;
  el.textContent = "Probe";
  document.body.appendChild(el);
  const size = Math.round(parseFloat(getComputedStyle(el).fontSize));
  el.remove();
  return { size, surface: document.documentElement.dataset.surface };
}, cls);

(async () => {
  try {
    execFileSync(process.execPath, [path.join(__dirname, "build_desktop_scale.js"), "--check"], { stdio: "pipe" });
    check("desktop-scale.css is up to date with its generator", true);
  } catch (e) {
    check("desktop-scale.css is up to date with its generator", false, String(e.stderr || e.message).trim());
  }

  const browser = await chromium.launch();

  console.log("\n--- one headline across screens ---");
  const sizes = {};
  for (const [label, w, h] of [["phone", 390, 844], ["laptop", 1024, 768], ["1280", 1280, 800], ["1440", 1440, 900], ["1920", 1920, 1080], ["2560", 2560, 1300], ["150% zoom", 911, 430]]) {
    const { ctx, page } = await open(browser, w, h, "/");
    sizes[label] = await h1Size(page);
    await ctx.close();
  }
  console.log("   home h1:", JSON.stringify(sizes));
  check("phone keeps the phone display size", sizes.phone === 30, `${sizes.phone}px`);
  check("designed size from 1440px wide", sizes["1440"] === 64, `${sizes["1440"]}px`);
  check("never above the designed size", sizes["1920"] === 64 && sizes["2560"] === 64);
  check("a laptop gets a smaller headline", sizes.laptop < sizes["1280"] && sizes["1280"] < sizes["1440"], `${sizes.laptop} < ${sizes["1280"]} < ${sizes["1440"]}`);
  check("150% zoom gets smaller still", sizes["150% zoom"] < sizes.laptop && sizes["150% zoom"] >= 45, `${sizes["150% zoom"]}px`);

  console.log("\n--- staff surfaces are not scaled ---");
  for (const [url, surface] of [["/about", "site"], ["/event", "staff"], ["/admin", "staff"]]) {
    const { ctx, page } = await open(browser, 1024, 600, url, { admin: url === "/admin" });
    const p = await probe(page, "lg:text-[54px]");
    if (surface === "site") check(`${url}: a 54px heading is fluid`, p.surface === "site" && p.size < 54, `${p.size}px`);
    else check(`${url}: a 54px heading stays 54px`, p.surface === "staff" && p.size === 54, `${p.surface} ${p.size}px`);
    await ctx.close();
  }

  console.log("\n--- no sideways scroll, nothing off the card ---");
  const PAGES = ["/", "/book", "/book/free", "/membership", "/membership/plans", "/about", "/projects", "/kitchen-bathroom", "/handyman-membership", "/gift", "/services", "/signup", "/signin"];
  const VIEWPORTS = [[1024, 768], [1280, 720], [1366, 657], [1536, 730], [1920, 969], [2560, 1271], [1093, 520], [911, 430], [683, 320]];
  for (const url of PAGES) {
    const bad = [];
    for (const [w, h] of VIEWPORTS) {
      const { ctx, page } = await open(browser, w, h, url);
      const sw = await page.evaluate(() => document.documentElement.scrollWidth);
      if (sw > w + 1) bad.push(`${w}x${h}: ${sw}`);
      await ctx.close();
    }
    check(`${url}: no sideways scroll at ${VIEWPORTS.length} desktop and zoom sizes`, bad.length === 0, bad.join(", "));
  }

  for (const [w, h] of [[1024, 768], [1366, 657], [1920, 969]]) {
    const { ctx, page } = await open(browser, w, h, "/");
    const out = await page.evaluate(() => {
      const strip = document.querySelector("[aria-label='Common jobs']");
      if (!strip) return null;
      const box = strip.getBoundingClientRect();
      return [...strip.children].filter((c) => c.getBoundingClientRect().right > box.right + 1).map((c) => c.textContent.trim());
    });
    check(`${w}x${h}: every job suggestion is inside the card`, Array.isArray(out) && out.length === 0, out ? out.join(", ") : "strip not found");
    await ctx.close();
  }

  await browser.close();
  const failed = results.filter((r) => !r.pass);
  console.log(`\n${results.length - failed.length}/${results.length} passed`);
  process.exit(failed.length ? 1 : 0);
})();
