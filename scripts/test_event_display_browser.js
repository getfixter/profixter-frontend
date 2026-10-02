/**
 * Event display in a real browser, against a mocked API and generated photos.
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
const fs = require("fs");
const path = require("path");

const args = process.argv.slice(2);
const BASE = args.find((a) => !a.startsWith("--")) || "http://localhost:3000";
const SHOTS = (args.find((a) => a.startsWith("--shots=")) || "").slice(8) || null;
const MINUTES = Number((args.find((a) => a.startsWith("--minutes=")) || "--minutes=30").slice(10));
const API = process.env.NEXT_PUBLIC_API_URL || "http://localhost:5001";
const BUCKET = "https://test-bucket.s3.amazonaws.com";

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

async function drawPhoto(i, w, h) {
  const bg = COLORS[i % COLORS.length];
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}">
    <rect width="100%" height="100%" fill="${bg}"/>
    <rect x="${w * 0.08}" y="${h * 0.08}" width="${w * 0.84}" height="${h * 0.84}" fill="none" stroke="#fff" stroke-opacity="0.35" stroke-width="6"/>
    <circle cx="${w / 2}" cy="${h / 2}" r="${Math.min(w, h) * 0.06}" fill="#fff" fill-opacity="0.8"/>
    <text x="50%" y="${h * 0.32}" font-family="Arial" font-size="${Math.min(w, h) * 0.12}" fill="#fff" text-anchor="middle">#${i}</text>
    <text x="50%" y="${h * 0.72}" font-family="Arial" font-size="${Math.min(w, h) * 0.05}" fill="#fff" text-anchor="middle">${w}x${h}</text>
  </svg>`;
  return sharp(Buffer.from(svg)).jpeg({ quality: 70 }).toBuffer();
}

async function buildLibrary(n) {
  const photos = [];
  for (let i = 1; i <= n; i += 1) {
    const shape = i % 3 === 0 ? [1200, 1600] : i % 5 === 0 ? [1200, 1200] : [1600, 1200];
    const url = `${BUCKET}/uploads/2026-09-01/booking-${Math.ceil(i / 2)}/${i}-customer-photo${i}.jpg`;
    images.set(url, await drawPhoto(i, ...shape));
    photos.push({ id: `p${i}`, url, group: `g${Math.ceil(i / 2)}` });
  }
  // Two that must never be on screen.
  const broken = `${BUCKET}/uploads/x/broken.jpg`;
  const tiny = `${BUCKET}/uploads/x/tiny.jpg`;
  images.set(tiny, await drawPhoto(999, 300, 200));
  photos.push({ id: "broken", url: broken, group: "gx" }, { id: "tiny", url: tiny, group: "gy" });
  return { photos, forbidden: [broken, tiny] };
}

const USERS = {
  "admin-token": { _id: "u1", userId: "1", name: "Admin", email: "admin@example.com", role: "admin" },
  "customer-token": { _id: "u2", userId: "2", name: "Customer", email: "c@example.com", role: "customer" },
};

/* ---------------- harness ---------------- */

async function open(browser, { token, photos, device, viewport, photoStatus = 200 }) {
  const context = await browser.newContext({
    ...(device || {}),
    ...(viewport ? { viewport } : {}),
  });
  const page = await context.newPage();
  const state = { photoCalls: 0, photos, photoStatus, navigations: [] };

  await context.route("**/*", async (route) => {
    const url = route.request().url();
    if (url.startsWith(BASE)) return route.continue();
    if (url.startsWith(BUCKET)) {
      const body = images.get(url.split("?")[0]);
      if (!body) return route.fulfill({ status: 404, body: "" });
      return route.fulfill({ status: 200, contentType: "image/jpeg", body });
    }
    if (url.startsWith(API)) {
      const auth = route.request().headers()["authorization"] || "";
      const user = USERS[auth.replace("Bearer ", "")];
      const json = (status, body) =>
        route.fulfill({
          status,
          contentType: "application/json",
          headers: { "access-control-allow-origin": "*", "access-control-allow-headers": "*", "access-control-allow-methods": "*" },
          body: JSON.stringify(body),
        });
      if (route.request().method() === "OPTIONS") return json(204, {});
      if (url.includes("/api/auth/me")) return user ? json(200, user) : json(401, { message: "no" });
      if (url.includes("/api/admin/event-display/photos")) {
        state.photoCalls += 1;
        if (!user || user.role !== "admin") return json(user ? 403 : 401, { message: "Access denied" });
        if (state.photoStatus !== 200) return json(state.photoStatus, { message: "Token expired" });
        return json(200, { photos: state.photos, total: state.photos.length });
      }
      return json(404, {});
    }
    return route.abort();
  });

  page.on("framenavigated", (frame) => {
    if (frame === page.mainFrame()) state.navigations.push(frame.url());
  });

  await page.clock.install({ time: new Date("2026-10-03T15:00:00Z") });
  await page.goto(`${BASE}/signin`);
  await page.evaluate((t) => {
    if (t) localStorage.setItem("token", t);
    else localStorage.removeItem("token");
  }, token);
  await page.goto(`${BASE}/admin/event-display`);
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
    return {
      layers: layers.length,
      kinds: layers.map((l) => l.getAttribute("data-scene")),
      top: layers.length ? layers[layers.length - 1].getAttribute("data-scene") : null,
      srcs: [...document.querySelectorAll(".ed-root img")].map((i) => i.getAttribute("src")),
      nodes: document.getElementsByTagName("*").length,
      animations: document.getAnimations().length,
      panel: !!document.querySelector(".ed-panel"),
      gate: document.querySelector(".ed-gate")?.textContent || "",
      brandNote: document.querySelector(".ed-brand-note")?.textContent || "",
      selectable: getComputedStyle(document.querySelector(".ed-root") || document.body).userSelect,
      touchAction: getComputedStyle(document.querySelector(".ed-root") || document.body).touchAction,
      scrollY: window.scrollY,
    };
  });

/** Live JS heap after a forced GC, via the DevTools protocol. */
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
  await page.screenshot({ path: path.join(SHOTS, `${name}.png`) });
}

/* ---------------- tests ---------------- */

(async () => {
  const browser = await chromium.launch();
  const { photos, forbidden } = await buildLibrary(48);
  const ipad = devices["iPad Pro 11"];

  try {
    section("Access");
    {
      const { context, page, state } = await open(browser, { token: null, photos, device: ipad });
      await run(page, 3000);
      const s = await snapshot(page);
      check("signed out: shows the admin-session gate", /needs an admin session/.test(s.gate), s.gate);
      check("signed out: never asks for photos", state.photoCalls === 0, `calls=${state.photoCalls}`);
      check("signed out: no photo on the page", !s.srcs.some((u) => u.startsWith(BUCKET)));
      await context.close();
    }
    {
      const { context, page, state } = await open(browser, { token: "customer-token", photos, device: ipad });
      await run(page, 3000);
      const s = await snapshot(page);
      check("customer: gate, not the display", /needs an admin session/.test(s.gate), s.gate);
      check("customer: never asks for photos", state.photoCalls === 0, `calls=${state.photoCalls}`);
      await context.close();
    }

    section("Empty library");
    {
      const { context, page } = await open(browser, { token: "admin-token", photos: [], device: ipad });
      await run(page, 8000);
      const s = await snapshot(page);
      check("no approved photos: brand frame with a way to review", /No photos are approved/.test(s.brandNote), s.brandNote);
      check("no approved photos: nothing else plays", s.kinds.every((k) => k === "brand"), s.kinds.join(","));
      await shot(page, "empty");
      await context.close();
    }

    section("Portrait tablet, autoplay");
    {
      const { context, page, state } = await open(browser, { token: "admin-token", photos, device: ipad });
      await run(page, 1000);
      let s = await snapshot(page);
      check("opens on the brand", s.top === "brand", s.top);
      check("text cannot be selected", s.selectable === "none", s.selectable);
      check("browser gestures are off on the stage", s.touchAction === "none", s.touchAction);
      await shot(page, "portrait-brand");

      const seen = new Set();
      const shotsTaken = new Set();
      let maxLayers = 0;
      let forbiddenShown = false;
      await run(page, 150000, 500, async () => {
        const now = await snapshot(page);
        maxLayers = Math.max(maxLayers, now.layers);
        if (now.top) seen.add(now.top);
        if (now.srcs.some((u) => forbidden.includes(u))) forbiddenShown = true;
        if (now.layers === 1 && now.top && !shotsTaken.has(now.top) && now.top !== "brand") {
          shotsTaken.add(now.top);
          await page.waitForTimeout(150);
          await page.clock.runFor(2500);
          await shot(page, `portrait-${now.top}`);
        }
      });
      check("plays photos on its own", seen.has("hero"), [...seen].join(","));
      check("varies the composition (pair/trio/wall seen)", ["pair", "trio", "wall"].filter((k) => seen.has(k)).length >= 2, [...seen].join(","));
      check("returns to the brand between groups", seen.has("brand"));
      check("never more than two scenes mounted", maxLayers <= 2, `max=${maxLayers}`);
      check("a broken or tiny photo never reaches the screen", !forbiddenShown);
      // Dev mode mounts effects twice (React StrictMode), hence "at most two".
      check("photo list fetched on load, not per scene", state.photoCalls <= 2, `calls=${state.photoCalls}`);

      section("Swipe and resume");
      // Let the current scene settle, then swipe left with a drag.
      await run(page, 2500);
      const before = await snapshot(page);
      const box = { x: 600, y: 700 };
      await page.mouse.move(box.x, box.y);
      await page.mouse.down();
      await page.mouse.move(box.x - 220, box.y + 10, { steps: 6 });
      await page.mouse.up();
      await run(page, 1000);
      const afterSwipe = await snapshot(page);
      check("swipe left shows another single photo", afterSwipe.top === "hero" && afterSwipe.srcs.join() !== before.srcs.join(), `${before.top} -> ${afterSwipe.top}`);
      const swipedSrc = afterSwipe.srcs.filter((u) => u.startsWith(BUCKET)).pop();

      await run(page, 9500);
      const holding = await snapshot(page);
      check("autoplay waits while someone is browsing", holding.srcs.includes(swipedSrc) && holding.layers === 1, holding.kinds.join(","));
      await run(page, 4000);
      const resumed = await snapshot(page);
      check("autoplay resumes after ~12s of no touches", !(resumed.layers === 1 && resumed.srcs.includes(swipedSrc)), resumed.kinds.join(","));

      // Swipe right goes back.
      await page.mouse.move(300, 700);
      await page.mouse.down();
      await page.mouse.move(560, 700, { steps: 6 });
      await page.mouse.up();
      await run(page, 1000);
      check("swipe right goes back to an earlier photo", (await snapshot(page)).top === "hero");

      section("Hidden controls");
      const { width } = page.viewportSize();
      await page.mouse.move(width - 30, 30);
      await page.mouse.down();
      await run(page, 1000, 250);
      await page.mouse.up();
      let p = await snapshot(page);
      check("long-press in the top-right corner opens the panel", p.panel);
      await shot(page, "portrait-panel");
      await page.getByRole("button", { name: "Pause" }).click();
      const pausedAt = (await snapshot(page)).srcs.join();
      await run(page, 40000, 1000);
      p = await snapshot(page);
      check("pause holds the frame", p.srcs.join() === pausedAt);
      check("panel tucks itself away after a while", !p.panel);
      await page.keyboard.press(" ");
      await run(page, 12000);
      check("space resumes playback", (await snapshot(page)).srcs.join() !== pausedAt);
      await page.keyboard.press("ArrowRight");
      await run(page, 800);
      check("arrow key steps to a photo", (await snapshot(page)).top === "hero");

      section("Refresh failure keeps the show on screen");
      state.photoStatus = 401;
      await page.keyboard.press("r");
      await run(page, 2000);
      const afterFail = await snapshot(page);
      check("401 on refresh does not navigate to /signin", !state.navigations.some((u) => u.includes("/signin") && state.navigations.indexOf(u) > 1));
      check("photos keep playing after a failed refresh", afterFail.srcs.some((u) => u.startsWith(BUCKET)));
      state.photoStatus = 200;

      section(`Long run (${MINUTES} simulated minutes)`);
      const start = await snapshot(page);
      let peakNodes = 0;
      let peakAnimations = 0;
      let peakLayers = 0;
      const samples = [];
      await run(page, MINUTES * 60000, 1000, async (t) => {
        const s2 = await snapshot(page);
        peakNodes = Math.max(peakNodes, s2.nodes);
        peakAnimations = Math.max(peakAnimations, s2.animations);
        peakLayers = Math.max(peakLayers, s2.layers);
        if (t % 60000 === 0) samples.push(await heapAfterGc(page));
      });
      console.log(`        heap per minute (MB): ${samples.map((b) => (b / 1048576).toFixed(1)).join(" ")}`);
      const end = await snapshot(page);
      check("still playing at the end", end.srcs.some((u) => u.startsWith(BUCKET)) || end.top === "brand");
      check("DOM stays bounded", peakNodes < start.nodes + 120, `start=${start.nodes} peak=${peakNodes}`);
      check("animations do not pile up", peakAnimations < 60, `peak=${peakAnimations}`);
      check("never more than two scenes mounted (long run)", peakLayers <= 2, `peak=${peakLayers}`);
      const firstHalf = samples.slice(1, Math.ceil(samples.length / 2));
      const secondHalf = samples.slice(Math.ceil(samples.length / 2));
      const avg = (xs) => xs.reduce((a, b) => a + b, 0) / Math.max(1, xs.length);
      const growth = avg(secondHalf) - avg(firstHalf);
      check("heap was actually measured", samples.every((b) => b > 0), `samples=${samples.length}`);
      check("JS heap does not trend upward", growth < 8 * 1024 * 1024, `growth=${(growth / 1048576).toFixed(1)}MB, samples=${samples.length}`);
      check("photo list re-fetched on the 30-minute schedule", state.photoCalls >= 1 + Math.floor(MINUTES / 30), `calls=${state.photoCalls}`);
      await context.close();
    }

    section("Landscape tablet and desktop");
    for (const [name, viewport] of [
      ["landscape", { width: 1194, height: 834 }],
      ["desktop", { width: 1440, height: 900 }],
      ["phone", { width: 390, height: 844 }],
    ]) {
      const { context, page } = await open(browser, { token: "admin-token", photos, viewport });
      const seen = new Set();
      const taken = new Set();
      await run(page, 120000, 500, async () => {
        const s = await snapshot(page);
        if (s.top) seen.add(s.top);
        if (s.layers === 1 && s.top && s.top !== "brand" && !taken.has(s.top)) {
          taken.add(s.top);
          await page.clock.runFor(2500);
          await shot(page, `${name}-${s.top}`);
        }
      });
      const overflow = await page.evaluate(() => document.documentElement.scrollWidth > window.innerWidth);
      check(`${name}: plays photos`, seen.has("hero"), [...seen].join(","));
      check(`${name}: no horizontal scroll`, !overflow);
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
