/**
 * The public event kiosk (/event) in a real browser, against a mocked API and
 * generated photos.
 *
 *   npm run dev            (in another terminal)
 *   node scripts/test_event_display_browser.js [baseUrl] [--shots=dir] [--minutes=30]
 *
 * Nothing here touches production: /api/* on the configured API URL is
 * answered by the test, photos are JPEGs drawn by sharp, and every other
 * third-party request (GTM, Meta) is aborted. Time is Playwright's fake clock,
 * so half an hour of playback runs in a minute or two.
 */

const { chromium, devices } = require("playwright");
const sharp = require("sharp");
const crypto = require("crypto");
const fs = require("fs");
const path = require("path");

const args = process.argv.slice(2);
const BASE = args.find((a) => !a.startsWith("--")) || "http://localhost:3000";
const SHOTS = (args.find((a) => a.startsWith("--shots=")) || "").slice(8) || null;
const MINUTES = Number((args.find((a) => a.startsWith("--minutes=")) || "--minutes=30").slice(10));
const API = process.env.NEXT_PUBLIC_API_URL || "http://localhost:5001";
const IMG = `${API}/api/event-display/photos/`;

let passed = 0;
const failures = [];
function check(name, ok, detail = "") {
  if (ok) {
    passed += 1;
    console.log(`  PASS  ${name}`);
  } else {
    failures.push(name);
    console.log(`  FAIL  ${name}${detail ? `\n        ${detail}` : ""}`);
  }
}
function section(title) {
  console.log(`\n--- ${title} ---`);
}

/* ---------------- fixtures ---------------- */

const COLORS = ["#7a4b2a", "#4f6b7a", "#8a8f5a", "#6d3d4f", "#2f5d50", "#9a6b3c", "#55606e", "#7d5a8a"];
const images = new Map();
const hex = (s) => crypto.createHash("sha256").update(s).digest("hex");

async function drawPhoto(i, w, h) {
  const bg = COLORS[i % COLORS.length];
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}">
    <rect width="100%" height="100%" fill="${bg}"/>
    <circle cx="${w / 2}" cy="${h / 2}" r="${Math.min(w, h) * 0.07}" fill="#fff" fill-opacity="0.8"/>
    <text x="50%" y="${h * 0.3}" font-family="Arial" font-size="${Math.min(w, h) * 0.12}" fill="#fff" text-anchor="middle">#${i}</text>
  </svg>`;
  return sharp(Buffer.from(svg)).jpeg({ quality: 70 }).toBuffer();
}

async function buildLibrary(n) {
  const photos = [];
  for (let i = 1; i <= n; i += 1) {
    const shape = i % 3 === 0 ? [1200, 1600] : i % 5 === 0 ? [1200, 1200] : [1600, 1200];
    const id = hex(`p${i}`).slice(0, 20);
    images.set(id, await drawPhoto(i, ...shape));
    photos.push({ id, group: hex(`g${Math.ceil(i / 2)}`).slice(0, 12) });
  }
  const broken = hex("broken").slice(0, 20);
  const tiny = hex("tiny").slice(0, 20);
  images.set(tiny, await drawPhoto(999, 300, 200));
  photos.push({ id: broken, group: "aaaaaaaaaaaa" }, { id: tiny, group: "bbbbbbbbbbbb" });
  return { photos, forbidden: [IMG + broken + "/image", IMG + tiny + "/image"] };
}

// The admin is admin by email even though the stored role is "customer", as in production.
const USERS = {
  "admin-token": { _id: "u1", userId: "1", name: "Admin", email: "getfixter@gmail.com", role: "customer" },
  "customer-token": { _id: "u2", userId: "2", name: "Customer", email: "c@example.com", role: "customer" },
  "fixter-token": { _id: "u3", userId: "3", name: "Fixter", email: "f@example.com", role: "employee", employeePosition: "General Fixter", isActive: true },
};

/* ---------------- harness ---------------- */

async function open(browser, { token, photos, device, viewport, path: route = "/event", clock = true }) {
  const context = await browser.newContext({ ...(device || {}), ...(viewport ? { viewport } : {}) });
  const page = await context.newPage();
  const state = { feedCalls: 0, adminCalls: 0, authHeadersOnFeed: 0, photos };

  await context.route("**/*", async (route) => {
    const req = route.request();
    const url = req.url();
    if (url.startsWith(BASE)) return route.continue();
    if (url.startsWith(API)) {
      const auth = req.headers()["authorization"] || "";
      const user = USERS[auth.replace("Bearer ", "")];
      const cors = { "access-control-allow-origin": "*", "access-control-allow-headers": "*", "access-control-allow-methods": "*" };
      const json = (status, body) => route.fulfill({ status, contentType: "application/json", headers: cors, body: JSON.stringify(body) });
      if (req.method() === "OPTIONS") return route.fulfill({ status: 204, headers: cors });
      if (url.startsWith(IMG)) {
        const id = url.slice(IMG.length).split("/")[0];
        const body = images.get(id);
        return body ? route.fulfill({ status: 200, contentType: "image/jpeg", headers: cors, body }) : route.fulfill({ status: 404, headers: cors, body: "" });
      }
      if (url.includes("/api/event-display/photos")) {
        state.feedCalls += 1;
        if (auth) state.authHeadersOnFeed += 1;
        return json(200, { photos: state.photos, total: state.photos.length });
      }
      if (url.includes("/api/admin/")) {
        state.adminCalls += 1;
        return json(403, { message: "Access denied" });
      }
      if (url.includes("/api/auth/me")) return user ? json(200, user) : json(401, { message: "no" });
      return json(404, {});
    }
    return route.abort();
  });

  if (clock) await page.clock.install({ time: new Date("2026-10-03T15:00:00Z") });
  await page.addInitScript((t) => {
    // Only on the first document of this test; later navigations keep whatever the app did.
    if (!sessionStorage.getItem("__seeded")) {
      sessionStorage.setItem("__seeded", "1");
      if (t) localStorage.setItem("token", t);
    }
  }, token);
  await page.goto(`${BASE}${route}`);
  return { context, page, state };
}

/** Advance fake time in steps, letting real image loads and renders happen between. */
async function run(page, ms, step = 500, onStep) {
  for (let t = 0; t < ms; t += step) {
    await page.clock.runFor(step);
    await page.waitForTimeout(15);
    if (onStep) await onStep(t);
  }
}

const snapshot = (page) =>
  page.evaluate(() => {
    const layers = [...document.querySelectorAll(".ed-layer")];
    const root = document.querySelector(".ed-root");
    const cta = document.querySelector(".ed-cta");
    const r = cta ? cta.getBoundingClientRect() : null;
    return {
      layers: layers.length,
      kinds: layers.map((l) => l.getAttribute("data-scene")),
      top: layers.length ? layers[layers.length - 1].getAttribute("data-scene") : null,
      srcs: [...document.querySelectorAll(".ed-layer img")].map((i) => i.getAttribute("src")),
      nodes: document.getElementsByTagName("*").length,
      animations: document.getAnimations().length,
      ctaText: cta ? cta.textContent.trim() : "",
      ctaRect: r ? [Math.round(r.x), Math.round(r.y), Math.round(r.width), Math.round(r.height)].join(",") : "",
      links: [...document.querySelectorAll("a")].map((a) => a.getAttribute("href")),
      buttons: [...document.querySelectorAll("button")].map((b) => b.textContent.trim()),
      anyAdminText: /review|admin|pause|shuffle|refresh/i.test(document.body.innerText),
      selectable: root ? getComputedStyle(root).userSelect : "",
      touchAction: root ? getComputedStyle(root).touchAction : "",
      imgPointer: [...document.querySelectorAll(".ed-layer img")].every((i) => getComputedStyle(i).pointerEvents === "none"),
      imgDraggable: [...document.querySelectorAll(".ed-layer img")].some((i) => i.draggable),
      scrollY: window.scrollY,
      docScrollable: document.documentElement.scrollHeight > window.innerHeight + 1,
      path: location.pathname + location.search,
      token: localStorage.getItem("token"),
      cachedUser: localStorage.getItem("user"),
      kiosk: sessionStorage.getItem("profixterEventKiosk"),
    };
  });

async function heapAfterGc(page) {
  const cdp = await page.context().newCDPSession(page);
  await cdp.send("Performance.enable");
  await cdp.send("HeapProfiler.collectGarbage");
  const { metrics } = await cdp.send("Performance.getMetrics");
  await cdp.detach();
  return metrics.find((m) => m.name === "JSHeapUsedSize")?.value || 0;
}

async function shot(page, name) {
  if (!SHOTS) return;
  fs.mkdirSync(SHOTS, { recursive: true });
  await page.waitForTimeout(1600); // let CSS entrances finish in real time
  await page.screenshot({ path: path.join(SHOTS, `${name}.png`) });
}

async function swipe(page, fromX, toX, y = 600, steps = 8) {
  await page.mouse.move(fromX, y);
  await page.mouse.down();
  for (let i = 1; i <= steps; i += 1) {
    await page.mouse.move(fromX + ((toX - fromX) * i) / steps, y + i);
  }
  await page.mouse.up();
}

const hasPanel = (s) => s.buttons.some((b) => /pause|play|shuffle|refresh|fullscreen|close/i.test(b));

/* ---------------- tests ---------------- */

(async () => {
  const browser = await chromium.launch();
  const { photos, forbidden } = await buildLibrary(48);
  const ipad = devices["iPad Pro 11"];

  try {
    section("Public: opens without login, asks only the public feed");
    {
      const { context, page, state } = await open(browser, { token: null, photos, device: ipad });
      await run(page, 1500);
      let s = await snapshot(page);
      check("opens on the brand moment, with the call to action", s.top === "brand" && s.ctaText === "Get My First Visit Free", `${s.top} / ${s.ctaText}`);
      await shot(page, "portrait-brand");
      await run(page, 9000);
      s = await snapshot(page);
      check("plays photos with nobody signed in", s.srcs.some((u) => u.startsWith(IMG)), s.kinds.join(","));
      check("never calls an admin API", state.adminCalls === 0, `adminCalls=${state.adminCalls}`);
      check("sends no Authorization header to the public feed", state.authHeadersOnFeed === 0);
      check("every image comes from our API, never a storage URL", s.srcs.every((u) => u.startsWith(IMG)), s.srcs.join(" "));
      check("there are no links on the page", s.links.length === 0, s.links.join(","));
      check("the only button is the call to action", s.buttons.length === 1 && s.buttons[0] === "Get My First Visit Free", s.buttons.join(" | "));
      check("no admin wording anywhere", !s.anyAdminText);
      check("text cannot be selected; browser gestures are off", s.selectable === "none" && s.touchAction === "none", `${s.selectable} ${s.touchAction}`);
      check("photos are not clickable or draggable", s.imgPointer && !s.imgDraggable);

      // Keys and the corner long-press that used to drive the admin panel.
      for (const key of [" ", "p", "r", "s", "f", "Escape"]) await page.keyboard.press(key);
      await run(page, 800);
      s = await snapshot(page);
      check("admin keys open nothing", s.buttons.length === 1 && !hasPanel(s), s.buttons.join("|"));
      const { width } = page.viewportSize();
      await page.mouse.move(width - 30, 30);
      await page.mouse.down();
      await run(page, 1200, 300);
      await page.mouse.up();
      s = await snapshot(page);
      check("long-press in the corner opens nothing", s.buttons.length === 1 && !hasPanel(s));

      const prevented = await page.evaluate(() => {
        const e = new MouseEvent("contextmenu", { bubbles: true, cancelable: true });
        document.querySelector(".ed-layer")?.dispatchEvent(e);
        return e.defaultPrevented;
      });
      check("the context menu on a photo is suppressed", prevented);
      await page.mouse.wheel(0, 800);
      await run(page, 300);
      s = await snapshot(page);
      check("the page does not scroll", s.scrollY === 0 && !s.docScrollable, `scrollY=${s.scrollY}`);
      await context.close();
    }

    section("Portrait iPad: autoplay and compositions");
    {
      const { context, page, state } = await open(browser, { token: null, photos, device: ipad });
      await run(page, 1000);
      const seen = new Set();
      const shots = new Set();
      const ctaRects = new Set();
      let maxLayers = 0;
      let forbiddenShown = false;
      await run(page, 150000, 500, async () => {
        const s = await snapshot(page);
        maxLayers = Math.max(maxLayers, s.layers);
        if (s.top) seen.add(s.top);
        ctaRects.add(s.ctaRect);
        if (s.srcs.some((u) => forbidden.includes(u))) forbiddenShown = true;
        if (s.layers === 1 && s.top && !shots.has(s.top)) {
          shots.add(s.top);
          await page.clock.runFor(2500);
          await shot(page, `portrait-${s.top}`);
        }
      });
      check("plays on its own", seen.has("hero"), [...seen].join(","));
      check("varies the composition", ["pair", "trio", "wall"].filter((k) => seen.has(k)).length >= 2, [...seen].join(","));
      check("returns to the brand between groups", seen.has("brand"));
      check("never more than two scenes mounted", maxLayers <= 2, `max=${maxLayers}`);
      check("a broken or tiny photo never reaches the screen", !forbiddenShown);
      check("the call to action never moves", ctaRects.size === 1, [...ctaRects].join(" | "));
      check("feed fetched on load, not per scene", state.feedCalls <= 2, `calls=${state.feedCalls}`);

      section("Swipe");
      await run(page, 2500);
      const before = await snapshot(page);
      await swipe(page, 640, 260);
      await run(page, 200);
      const mid = await snapshot(page);
      const topClass = await page.evaluate(() => [...document.querySelectorAll(".ed-layer")].pop()?.className || "");
      check("a swipe slides the next photo in", mid.layers === 2 && /slide-next/.test(topClass), `${mid.kinds} / ${topClass}`);
      await run(page, 900);
      const afterLeft = await snapshot(page);
      check("swipe left lands on a single new photo", afterLeft.top === "hero" && afterLeft.srcs.join() !== before.srcs.join());
      const leftSrc = afterLeft.srcs[afterLeft.srcs.length - 1];

      await swipe(page, 200, 620);
      await run(page, 1100);
      const afterRight = await snapshot(page);
      check("swipe right goes back to an earlier photo", afterRight.top === "hero" && afterRight.srcs[afterRight.srcs.length - 1] !== leftSrc);

      const settled = (await snapshot(page)).srcs.join();
      await swipe(page, 400, 380, 600, 4);
      await run(page, 600);
      check("a tiny drag springs back without changing photo", (await snapshot(page)).srcs.join() === settled);

      await page.mouse.move(400, 300);
      await page.mouse.down();
      await page.mouse.move(405, 900, { steps: 8 });
      await page.mouse.up();
      await run(page, 600);
      const vert = await snapshot(page);
      check("a vertical drag neither swipes nor scrolls", vert.srcs.join() === settled && vert.scrollY === 0);

      let rapidMax = 0;
      for (let i = 0; i < 6; i += 1) {
        await swipe(page, 640, 240, 600, 3);
        await run(page, 120, 60);
        rapidMax = Math.max(rapidMax, (await snapshot(page)).layers);
      }
      await run(page, 1200);
      const rapid = await snapshot(page);
      check("six rapid swipes: at most two scenes, ending on one photo", rapidMax <= 2 && rapid.layers === 1 && rapid.top === "hero", `max=${rapidMax} end=${rapid.kinds}`);
      await shot(page, "portrait-after-swipes");

      const held = (await snapshot(page)).srcs.join();
      await run(page, 10000);
      check("autoplay waits while someone is browsing", (await snapshot(page)).srcs.join() === held);
      await run(page, 4000);
      check("autoplay resumes about 12s after the last touch", (await snapshot(page)).srcs.join() !== held);

      section(`Long run (${MINUTES} simulated minutes)`);
      const start = await snapshot(page);
      let peakNodes = 0;
      let peakAnimations = 0;
      let peakLayers = 0;
      const samples = [];
      await run(page, MINUTES * 60000, 1000, async (t) => {
        const s = await snapshot(page);
        peakNodes = Math.max(peakNodes, s.nodes);
        peakAnimations = Math.max(peakAnimations, s.animations);
        peakLayers = Math.max(peakLayers, s.layers);
        if (t % 60000 === 0) samples.push(await heapAfterGc(page));
      });
      console.log(`        heap per minute (MB): ${samples.map((b) => (b / 1048576).toFixed(1)).join(" ")}`);
      const end = await snapshot(page);
      check("still playing at the end", end.srcs.some((u) => u.startsWith(IMG)) || end.top === "brand");
      check("DOM stays bounded", peakNodes < start.nodes + 120, `start=${start.nodes} peak=${peakNodes}`);
      check("animations do not pile up", peakAnimations < 60, `peak=${peakAnimations}`);
      check("never more than two scenes mounted (long run)", peakLayers <= 2, `peak=${peakLayers}`);
      const half = Math.ceil(samples.length / 2);
      const avg = (xs) => xs.reduce((a, b) => a + b, 0) / Math.max(1, xs.length);
      const growth = avg(samples.slice(half)) - avg(samples.slice(1, half));
      check("heap was measured", samples.length > 2 && samples.every((b) => b > 0));
      check("JS heap does not trend upward", growth < 8 * 1024 * 1024, `growth=${(growth / 1048576).toFixed(1)}MB`);
      check("library re-fetched on the 30-minute schedule", state.feedCalls >= 1 + Math.floor(MINUTES / 30), `calls=${state.feedCalls}`);
      await context.close();
    }

    section("Call to action: every kind of session ends signed out, on registration");
    for (const [who, token] of [
      ["signed out", null],
      ["customer", "customer-token"],
      ["General Fixter", "fixter-token"],
      ["admin", "admin-token"],
    ]) {
      const { context, page, state } = await open(browser, { token, photos, device: ipad, clock: false });
      await page.waitForTimeout(2500);
      await page.evaluate(() => {
        sessionStorage.setItem("pendingCheckoutPlan", "premium");
        sessionStorage.setItem("pendingPromoCode", "OLDCODE");
        localStorage.setItem("rememberedEmail", "someone@example.com");
      });
      const before = await snapshot(page);
      check(`${who}: session present before the tap = ${!!token}`, !!before.token === !!token);
      // Tap during a transition: swipe, then tap straight away.
      await swipe(page, 640, 260);
      await page.locator(".ed-cta").click();
      await page.waitForURL(/\/signup/, { timeout: 15000 });
      await page.waitForTimeout(3000);
      const after = await snapshot(page);
      const leftovers = await page.evaluate(() => ({
        plan: sessionStorage.getItem("pendingCheckoutPlan"),
        promo: sessionStorage.getItem("pendingPromoCode"),
        remembered: localStorage.getItem("rememberedEmail"),
      }));
      const onForm = await page.evaluate(() => location.pathname === "/signup" && !!document.querySelector("form input"));
      check(`${who}: lands on /signup?source=event`, after.path === "/signup?source=event", after.path);
      check(`${who}: signed out (no token, no cached user)`, !after.token && !after.cachedUser);
      check(`${who}: the registration form shows (not bounced by the session gate)`, onForm);
      check(`${who}: the previous visitor's plan, promo and remembered email are gone`, !leftovers.plan && !leftovers.promo && !leftovers.remembered, JSON.stringify(leftovers));
      check(`${who}: this tab is marked as a kiosk session`, after.kiosk === "1");
      check(`${who}: no admin API was called`, state.adminCalls === 0, String(state.adminCalls));
      if (who === "admin") {
        await shot(page, "signup-with-back-to-event");
        const back = page.getByRole("button", { name: "Back to event" });
        check("signup in a kiosk tab offers 'Back to event'", (await back.count()) === 1);
        await back.click();
        await page.getByRole("button", { name: "Keep going" }).click();
        check("'Keep going' stays on registration", /\/signup/.test(page.url()));
        // Pretend the visitor has registered: a session exists again.
        await page.evaluate(() => localStorage.setItem("token", "customer-token"));
        await back.click();
        await page.getByRole("button", { name: /Sign out/ }).click();
        await page.waitForURL(/\/event$/, { timeout: 15000 });
        await page.waitForTimeout(1500);
        const home = await snapshot(page);
        check("'Sign out & return' signs out and comes back to /event", !home.token && home.path === "/event", home.path);
        check("back on the kiosk, the 'Back to event' control is gone", home.kiosk === null && !home.buttons.includes("Back to event"));
      }
      await context.close();
    }

    section("The return control stays out of ordinary browsing");
    {
      const { context, page } = await open(browser, { token: null, photos, device: ipad, path: "/signup", clock: false });
      await page.waitForTimeout(3000);
      check("plain /signup has no 'Back to event'", (await page.getByRole("button", { name: "Back to event" }).count()) === 0);
      await context.close();
    }

    section("Old admin URL");
    {
      const { context, page } = await open(browser, { token: null, photos, device: ipad, path: "/admin/event-display", clock: false });
      await page.waitForTimeout(2500);
      check("/admin/event-display redirects to /event", new URL(page.url()).pathname === "/event", page.url());
      await context.close();
    }

    section("Landscape tablet, desktop, phone");
    for (const [name, viewport] of [
      ["landscape", { width: 1194, height: 834 }],
      ["desktop", { width: 1440, height: 900 }],
      ["phone", { width: 390, height: 844 }],
    ]) {
      const { context, page } = await open(browser, { token: null, photos, viewport });
      const seen = new Set();
      const taken = new Set();
      const ctaRects = new Set();
      await run(page, 120000, 500, async () => {
        const s = await snapshot(page);
        if (s.top) seen.add(s.top);
        ctaRects.add(s.ctaRect);
        if (s.layers === 1 && s.top && !taken.has(s.top) && ["hero", "pair", "brand"].includes(s.top)) {
          taken.add(s.top);
          await page.clock.runFor(2500);
          await shot(page, `${name}-${s.top}`);
        }
      });
      const fit = await page.evaluate(() => {
        const r = document.querySelector(".ed-cta").getBoundingClientRect();
        const c = document.querySelector(".ed-caption-text")?.getBoundingClientRect();
        return {
          overflow: document.documentElement.scrollWidth > window.innerWidth,
          ctaInside: r.left >= 0 && r.right <= window.innerWidth && r.bottom <= window.innerHeight,
          captionInside: !c || (c.left >= -1 && c.right <= window.innerWidth + 1),
        };
      });
      check(`${name}: plays photos`, seen.has("hero"), [...seen].join(","));
      check(`${name}: no horizontal scroll; CTA and caption fit`, !fit.overflow && fit.ctaInside && fit.captionInside, JSON.stringify(fit));
      check(`${name}: the CTA never moves`, ctaRects.size === 1, [...ctaRects].join(" | "));
      await context.close();
    }
  } finally {
    await browser.close();
  }

  console.log(`\n${passed} passed, ${failures.length} failed`);
  process.exit(failures.length ? 1 : 0);
})().catch((error) => {
  console.error(error);
  process.exit(1);
});
