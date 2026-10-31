/* eslint-disable @typescript-eslint/no-require-imports -- a plain Node script, like its neighbours */
/*
 * What We Do: the before/after gallery, in the browser, against a mocked API.
 *
 *   node scripts/test_what_we_do_ui.js [baseUrl] [screenshotDir]
 *
 * The mock answers GET /api/recent-work?kind=before_after the way BackEnd
 * routes/recentWork.js does (toPublicDTO: kind, group, illustrative, before*
 * URLs), with six illustrative pairs whose images are generated here - a dark
 * BEFORE and a bright AFTER - and served from a fake image host.
 *
 * What it pins on /recent-work, at a phone (390) and a desktop (1440) width:
 * - the section renders with its H1, six comparison cards and the n / total count
 * - phone: a scroll-snap carousel that settles on a card after a swipe;
 *   desktop: the page variant is a grid
 * - the automatic reveal moves the divider once, then rests at 50
 * - dragging the handle (mouse; touch on the phone) moves the divider
 * - a drag or swipe anywhere else on the picture does NOT move it, and on the
 *   phone a swipe there scrolls the carousel instead
 * - ArrowLeft / ArrowRight / Home / End move it; Before / After buttons jump
 * - the group chips filter; the illustrative note is shown
 * - analytics events: viewed, compare, filter
 * - nothing scrolls sideways; no page errors
 * With prefers-reduced-motion: no automatic movement at all.
 *
 * Admin (owner): the Recent Work tab marks pairs with Before/After and
 * Illustrative badges, and "Add before & after" posts multipart with the
 * before and after files and the pair's fields to /api/admin/recent-work/pair.
 */
const { chromium } = require("playwright");
const fs = require("fs");
const zlib = require("zlib");

const BASE = (process.argv[2] || "http://localhost:3000").replace(/\/$/, "");
const SHOTS = process.argv[3] || "";
if (SHOTS) fs.mkdirSync(SHOTS, { recursive: true });

const results = [];
function check(name, pass, detail = "") {
  results.push({ name, pass: !!pass });
  console.log(`${pass ? "PASS" : "FAIL"}  ${name}${detail ? "  :: " + detail : ""}`);
}
const wait = (ms) => new Promise((r) => setTimeout(r, ms));

/* ------------------------------------------------------------------ */
/* A tiny PNG encoder: solid colour with a band, so the halves differ.  */
/* ------------------------------------------------------------------ */
const CRC_TABLE = Array.from({ length: 256 }, (_, n) => {
  let c = n;
  for (let k = 0; k < 8; k += 1) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
  return c >>> 0;
});
function crc32(buf) {
  let c = 0xffffffff;
  for (const byte of buf) c = CRC_TABLE[(c ^ byte) & 0xff] ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
}
function chunk(type, data) {
  const len = Buffer.alloc(4);
  len.writeUInt32BE(data.length);
  const body = Buffer.concat([Buffer.from(type, "ascii"), data]);
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(crc32(body));
  return Buffer.concat([len, body, crc]);
}
function png(width, height, [r, g, b], [br, bg, bb]) {
  const rows = [];
  for (let y = 0; y < height; y += 1) {
    const row = Buffer.alloc(1 + width * 3);
    for (let x = 0; x < width; x += 1) {
      const band = y > height * 0.4 && y < height * 0.6;
      row[1 + x * 3] = band ? br : r;
      row[2 + x * 3] = band ? bg : g;
      row[3 + x * 3] = band ? bb : b;
    }
    rows.push(row);
  }
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(width, 0);
  ihdr.writeUInt32BE(height, 4);
  ihdr[8] = 8; // bit depth
  ihdr[9] = 2; // truecolour
  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    chunk("IHDR", ihdr),
    chunk("IDAT", zlib.deflateSync(Buffer.concat(rows))),
    chunk("IEND", Buffer.alloc(0)),
  ]);
}
const BEFORE_PNG = png(64, 48, [74, 56, 44], [40, 30, 24]);
const AFTER_PNG = png(64, 48, [236, 242, 252], [48, 110, 236]);

/* ------------------------------------------------------------------ */
/* Fixtures                                                            */
/* ------------------------------------------------------------------ */
const IMG = "https://img.what-we-do.test";
const PAIRS = [
  ["p1", "Outlet replacement", "A scorched outlet swapped for a new tamper-resistant one.", "Electrical", "electrical"],
  ["p2", "Light fixture swap", "A dated fixture replaced with a modern flush mount.", "Electrical", "electrical"],
  ["p3", "Tub re-caulk", "Old, mildewed caulk cut out and the tub sealed again.", "Bathroom", "general-handyman"],
  ["p4", "Showerhead upgrade", "A corroded showerhead replaced and the arm re-sealed.", "Bathroom", "general-handyman"],
  ["p5", "Door repaint", "A scuffed interior door sanded and repainted.", "Doors & Trim", "painting"],
  ["p6", "Patio pressure wash", "A green, grimy patio brought back to clean stone.", "Outdoor", "general-handyman"],
].map(([id, title, caption, group, category], index) => ({
  id,
  title,
  caption,
  category,
  location: "",
  featured: index === 0,
  thumbUrl: `${IMG}/${id}-after-480.png`,
  imageUrl: `${IMG}/${id}-after-1280.png`,
  fullUrl: `${IMG}/${id}-after-2000.png`,
  width: 1280,
  height: 960,
  kind: "before_after",
  group,
  illustrative: true,
  beforeThumbUrl: `${IMG}/${id}-before-480.png`,
  beforeImageUrl: `${IMG}/${id}-before-1280.png`,
  beforeFullUrl: `${IMG}/${id}-before-2000.png`,
}));

const OWNER = { _id: "o", userId: "1", name: "Owner", email: "getfixter@gmail.com", role: "customer", isOwner: true, permissions: [], addresses: [] };
const CATEGORIES = [
  { slug: "general-handyman", label: "General handyman" },
  { slug: "electrical", label: "Electrical" },
  { slug: "painting", label: "Painting" },
];
function adminRow(over = {}) {
  return {
    ...PAIRS[0],
    publishedAt: "2026-10-30T12:00:00Z",
    status: "published",
    uploaderType: "admin",
    uploadedByName: "Owner",
    uploadedByRole: "admin",
    bookingNumber: "",
    internalNote: "",
    publishAt: null,
    firstPublishedAt: "2026-10-30T12:00:00Z",
    unpublishedAt: null,
    reviewedByName: "",
    reviewedAt: null,
    rejectionReason: "",
    batchId: "",
    createdAt: "2026-10-30T12:00:00Z",
    sourceWidth: 1280,
    sourceHeight: 960,
    bytes: 120000,
    ...over,
  };
}

const CORS = {
  "access-control-allow-origin": "*",
  "access-control-allow-headers": "Authorization,Content-Type",
  "access-control-allow-methods": "GET,POST,PUT,PATCH,DELETE,OPTIONS",
};

async function open(browser, width, { reducedMotion = false, admin = false } = {}) {
  const mobile = width < 700;
  const ctx = await browser.newContext({
    viewport: { width, height: mobile ? 844 : 900 },
    isMobile: mobile,
    hasTouch: mobile,
    reducedMotion: reducedMotion ? "reduce" : "no-preference",
  });
  await ctx.addInitScript((signedIn) => {
    try {
      localStorage.setItem("profixter_promotion_popup_dismissed_date", new Date().toISOString().slice(0, 10));
      if (signedIn) localStorage.setItem("token", "ui-token");
    } catch {}
  }, admin);
  const state = { pairPosts: [], feedCalls: [] };

  await ctx.route(`${IMG}/**`, (route) => {
    const before = /-before-/.test(route.request().url());
    return route.fulfill({ status: 200, contentType: "image/png", body: before ? BEFORE_PNG : AFTER_PNG });
  });

  await ctx.route(/\/api\//, async (route) => {
    const req = route.request();
    const u = new URL(req.url());
    if (req.method() === "OPTIONS") return route.fulfill({ status: 204, headers: CORS });
    const json = (body, status = 200) => route.fulfill({ status, contentType: "application/json", headers: CORS, body: JSON.stringify(body) });
    const p = u.pathname;

    if (p === "/api/recent-work") {
      state.feedCalls.push(u.search);
      if (u.searchParams.get("kind") === "before_after") {
        const limit = Number(u.searchParams.get("limit")) || 24;
        const page = Number(u.searchParams.get("page")) || 1;
        const photos = PAIRS.slice((page - 1) * limit, page * limit);
        return json({ photos, page, limit, total: PAIRS.length, hasMore: page * limit < PAIRS.length });
      }
      return json({ photos: [], page: 1, limit: 24, total: 0, hasMore: false });
    }
    if (p === "/api/recent-work/categories") return json({ categories: [] });
    if (p === "/api/auth/me") return admin ? json(OWNER) : json({ message: "Not signed in" }, 401);

    if (admin) {
      if (p === "/api/admin/recent-work/pair" && req.method() === "POST") {
        state.pairPosts.push({
          contentType: req.headers()["content-type"] || "",
          body: (req.postDataBuffer() || Buffer.alloc(0)).toString("latin1"),
        });
        return json({ created: [adminRow({ id: "new-pair", title: "Outlet replacement" })], failed: [] }, 201);
      }
      if (p === "/api/admin/recent-work" && req.method() === "GET") {
        return json({
          view: u.searchParams.get("view") || "published",
          page: 1,
          limit: 60,
          total: 2,
          photos: [
            adminRow(),
            adminRow({
              id: "single",
              title: "Shelf install",
              kind: "photo",
              group: "",
              illustrative: false,
              beforeThumbUrl: undefined,
              beforeImageUrl: undefined,
              beforeFullUrl: undefined,
            }),
          ],
          counts: { pending: 0, scheduled: 0, published: 2, rejected: 0, library: 2 },
          categories: CATEGORIES,
        });
      }
      if (p === "/api/admin/activity-log/summary") return json({ usersDeleted: 0, leadsDeleted: 0, projectsDeleted: 0 });
      return json([]);
    }
    /* Anything else a public page asks for: a quiet "not here". */
    return json({ message: "not mocked" }, 404);
  });

  const page = await ctx.newPage();
  const errors = [];
  page.on("pageerror", (e) => errors.push(e.message));
  page.on("dialog", (d) => d.dismiss());
  return { ctx, page, state, errors };
}

const noSideScroll = (page) => page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth + 1);
const shot = async (page, name) => {
  if (SHOTS) await page.screenshot({ path: `${SHOTS}/${name}.png` }).catch(() => {});
};
const valueOf = async (handle) => Number(await handle.getAttribute("aria-valuenow"));
const clipRightOf = (card) =>
  card.locator(".wwd-ba__before").evaluate((img) => {
    const m = (getComputedStyle(img).clipPath || "").match(/inset\(\s*0(?:px)?\s+([\d.]+)%/);
    return m ? Number(m[1]) : NaN;
  });
const dataLayerEvents = (page) => page.evaluate(() => (window.dataLayer || []).map((e) => e && e.event).filter(Boolean));

async function mouseDrag(page, from, to) {
  await page.mouse.move(from.x, from.y);
  await page.mouse.down();
  await page.mouse.move(to.x, to.y, { steps: 10 });
  await page.mouse.up();
}
async function touchDrag(cdp, from, to, steps = 10) {
  await cdp.send("Input.dispatchTouchEvent", { type: "touchStart", touchPoints: [{ x: from.x, y: from.y }] });
  for (let i = 1; i <= steps; i += 1) {
    const x = from.x + ((to.x - from.x) * i) / steps;
    const y = from.y + ((to.y - from.y) * i) / steps;
    await cdp.send("Input.dispatchTouchEvent", { type: "touchMove", touchPoints: [{ x, y }] });
    await wait(16);
  }
  await cdp.send("Input.dispatchTouchEvent", { type: "touchEnd", touchPoints: [] });
}

/** Samples a card's divider value for `ms`, every 80ms. */
async function sample(handle, ms) {
  const values = [];
  const end = Date.now() + ms;
  while (Date.now() < end) {
    values.push(await valueOf(handle));
    await wait(80);
  }
  return values;
}

(async () => {
  /*
   * Headless Chrome does not run a touch fling to its end, so a swipe can stop
   * between cards there although real phones (and headed Chrome) snap every
   * time. The swipe-snap check runs in a headed browser; HEADLESS=1 forces
   * headless and then reports that one check as not run.
   */
  const headless = process.env.HEADLESS === "1";
  const browser = await chromium.launch({ headless });

  /* ============================ public page ============================ */
  for (const width of [390, 1440]) {
    const tag = width < 700 ? "mobile" : "desktop";
    console.log(`\n--- /recent-work, ${width}px ---`);
    const { ctx, page, state, errors } = await open(browser, width);
    await page.goto(`${BASE}/recent-work`, { waitUntil: "domcontentloaded" });

    const section = page.locator("[data-testid=what-we-do]");
    const track = page.locator("[data-testid=wwd-track]");
    const cards = track.locator(":scope > li");
    await cards.first().waitFor({ timeout: 20000 });
    const first = cards.first();
    const handle = first.locator("[data-testid=wwd-handle]");

    /* The reveal starts as soon as the first card is in view: sample at once. */
    const revealSamples = await sample(handle, 3400);
    const minSeen = Math.min(...revealSamples);
    const maxSeen = Math.max(...revealSamples);
    const distinct = new Set(revealSamples).size;
    check(
      `${tag}: automatic reveal sweeps the divider and rests at 50`,
      distinct > 3 && maxSeen >= 70 && minSeen <= 30 && revealSamples[revealSamples.length - 1] === 50,
      `min ${minSeen}, max ${maxSeen}, ${distinct} distinct, last ${revealSamples[revealSamples.length - 1]}`
    );
    check(`${tag}: reveal plays once (no loop)`, (await sample(handle, 900)).every((v) => v === 50));

    check(`${tag}: section renders with the H1 "What's Included"`, (await section.locator("h1").innerText()).trim() === "What\u2019s Included");
    check(`${tag}: six comparison cards`, (await cards.count()) === 6, String(await cards.count()));
    check(`${tag}: handle is a labelled slider`, (await handle.getAttribute("role")) === "slider" && /^Before and after comparison: Outlet replacement$/.test((await handle.getAttribute("aria-label")) || ""));
    check(`${tag}: Before and After chips on the image`, (await first.locator(".wwd-ba__chip--before").innerText()).trim().toLowerCase() === "before" && (await first.locator(".wwd-ba__chip--after").innerText()).trim().toLowerCase() === "after");
    const imgInfo = await first.locator("img").evaluateAll((imgs) => imgs.map((i) => ({ w: i.getAttribute("width"), h: i.getAttribute("height"), srcset: i.getAttribute("srcset") || "", loading: i.getAttribute("loading") })));
    check(`${tag}: images carry width/height and a thumb+display srcset`, imgInfo.length === 2 && imgInfo.every((i) => i.w === "1280" && i.h === "960" && /480w/.test(i.srcset) && /1280w/.test(i.srcset)));
    const laterLoading = await cards.nth(2).locator("img").first().getAttribute("loading");
    check(`${tag}: first card eager, later cards lazy`, imgInfo[0].loading === "eager" && laterLoading === "lazy");
    check(`${tag}: illustrative note shown`, (await page.locator("[data-testid=wwd-note]").innerText()).includes("Illustrative examples of everyday jobs we handle."));
    await section.scrollIntoViewIfNeeded();
    await shot(page, `${tag}-01-gallery`);

    const snap = await track.evaluate((el) => ({
      type: getComputedStyle(el).scrollSnapType,
      align: getComputedStyle(el.children[0]).scrollSnapAlign,
      display: getComputedStyle(el).display,
      scrolls: el.scrollWidth > el.clientWidth + 4,
      tops: Array.from(el.children).slice(0, 3).map((c) => c.getBoundingClientRect().top),
    }));
    if (tag === "mobile") {
      check(`${tag}: carousel scroll-snaps on x (mandatory, cards snap to start)`, /x/.test(snap.type) && /mandatory/.test(snap.type) && /start/.test(snap.align) && snap.scrolls, `${snap.type} / ${snap.align}`);
      check(`${tag}: count shows 1 / 6`, (await page.locator("[data-testid=wwd-count]").innerText()).replace(/\s+/g, " ").trim() === "1 / 6");
    } else {
      check(`${tag}: page variant is a grid with several cards per row`, snap.display === "grid" && Math.abs(snap.tops[0] - snap.tops[1]) < 2 && Math.abs(snap.tops[0] - snap.tops[2]) < 2, JSON.stringify(snap.tops));
    }

    /* ---- manual drag on the handle ---- */
    await first.scrollIntoViewIfNeeded();
    const stage = first.locator(".wwd-ba__stage");
    let box = await stage.boundingBox();
    let hbox = await handle.boundingBox();
    const centre = { x: hbox.x + hbox.width / 2, y: hbox.y + hbox.height / 2 };
    const target = { x: box.x + box.width * 0.2, y: centre.y };
    if (tag === "mobile") {
      const cdp = await ctx.newCDPSession(page);
      await touchDrag(cdp, centre, target);
      await wait(200);
      const afterTouch = await valueOf(handle);
      check(`${tag}: touch drag on the handle moves the divider`, Math.abs(afterTouch - 20) <= 7, `value ${afterTouch}`);
      check(`${tag}: BEFORE clip follows the divider`, Math.abs((await clipRightOf(first)) - (100 - afterTouch)) <= 2, `clip right ${await clipRightOf(first)}%`);

      /* A swipe on the picture away from the handle scrolls the carousel instead. */
      box = await stage.boundingBox();
      const held = await valueOf(handle);
      const scrollBefore = await track.evaluate((el) => el.scrollLeft);
      await touchDrag(cdp, { x: box.x + box.width * 0.85, y: box.y + box.height * 0.5 }, { x: box.x + box.width * 0.1, y: box.y + box.height * 0.52 }, 12);
      await wait(900);
      const scrollAfter = await track.evaluate((el) => el.scrollLeft);
      check(`${tag}: a swipe elsewhere on the picture does not move the divider`, (await valueOf(handle)) === held, `${held} -> ${await valueOf(handle)}`);
      check(`${tag}: ...and scrolls the carousel instead`, scrollAfter > scrollBefore + 20, `${scrollBefore} -> ${scrollAfter}`);
      // Let the swipe's momentum and the snap finish: poll rather than guess how long that takes.
      let snapped = false;
      let at = 0;
      for (let i = 0; i < 20 && !snapped; i += 1) {
        await wait(200);
        [snapped, at] = await track.evaluate((el) => {
          const kids = Array.from(el.children);
          const max = el.scrollWidth - el.clientWidth;
          return [Math.abs(el.scrollLeft - max) < 2 || kids.some((k) => Math.abs(k.offsetLeft - kids[0].offsetLeft - el.scrollLeft) < 3), el.scrollLeft];
        });
      }
      if (headless) console.log(`  (not run headless) ${tag}: the carousel settles on a card after a swipe; scrollLeft ${at}`);
      else check(`${tag}: the carousel settles on a card (snap)`, snapped, `scrollLeft ${at}`);
      if (!headless) {
        const count = (await page.locator("[data-testid=wwd-count]").innerText()).replace(/\s+/g, " ").trim();
        check(`${tag}: one swipe moves exactly one card (snap-stop)`, count === "2 / 6", count);
      }
      /* Deterministic too: left between two cards, it snaps to one. */
      const settled = await track.evaluate(async (el) => {
        const kids = Array.from(el.children);
        const step = kids[1].offsetLeft - kids[0].offsetLeft;
        el.scrollTo({ left: step * 1.4, behavior: "instant" });
        await new Promise((r) => setTimeout(r, 700));
        return kids.some((k) => Math.abs(k.offsetLeft - kids[0].offsetLeft - el.scrollLeft) < 3);
      });
      check(`${tag}: a half-way scroll snaps to a card`, settled);
      check(`${tag}: count follows the carousel`, (await page.locator("[data-testid=wwd-count]").innerText()).replace(/\s+/g, " ").trim() !== "1 / 6");
      await shot(page, `${tag}-02-swiped`);
      await track.evaluate((el) => el.scrollTo({ left: 0, behavior: "instant" }));
      await wait(300);
    } else {
      await mouseDrag(page, centre, target);
      await wait(150);
      const afterDrag = await valueOf(handle);
      check(`${tag}: mouse drag on the handle moves the divider`, Math.abs(afterDrag - 20) <= 7, `value ${afterDrag}`);
      check(`${tag}: BEFORE clip follows the divider`, Math.abs((await clipRightOf(first)) - (100 - afterDrag)) <= 2, `clip right ${await clipRightOf(first)}%`);
    }

    /* A mouse drag on the picture away from the handle changes nothing. */
    box = await stage.boundingBox();
    const held = await valueOf(handle);
    await mouseDrag(page, { x: box.x + box.width * 0.85, y: box.y + box.height * 0.4 }, { x: box.x + box.width * 0.45, y: box.y + box.height * 0.45 });
    await wait(150);
    check(`${tag}: a drag NOT on the handle does not change the comparison`, (await valueOf(handle)) === held, `${held} -> ${await valueOf(handle)}`);

    /* ---- keyboard ---- */
    await handle.focus();
    const k0 = await valueOf(handle);
    await page.keyboard.press("ArrowRight");
    const k1 = await valueOf(handle);
    await page.keyboard.press("ArrowLeft");
    await page.keyboard.press("ArrowLeft");
    const k2 = await valueOf(handle);
    await page.keyboard.press("Home");
    const kHome = await valueOf(handle);
    await page.keyboard.press("End");
    const kEnd = await valueOf(handle);
    check(`${tag}: ArrowRight +5, ArrowLeft -5, Home 0, End 100`, k1 === Math.min(100, k0 + 5) && k2 === Math.max(0, k1 - 10) && kHome === 0 && kEnd === 100, `${k0} ${k1} ${k2} ${kHome} ${kEnd}`);
    await shot(page, `${tag}-03-focused`);

    /* ---- Before / After buttons ---- */
    await first.locator("button.wwd-ba__jump", { hasText: "After" }).click();
    const jAfter = await valueOf(handle);
    await wait(650);
    const clipAfter = await clipRightOf(first);
    await first.locator("button.wwd-ba__jump", { hasText: "Before" }).click();
    const jBefore = await valueOf(handle);
    check(`${tag}: After button shows all AFTER, Before button all BEFORE`, jAfter === 0 && jBefore === 100 && Math.abs(clipAfter - 100) <= 1, `${jAfter} / ${jBefore}, clip ${clipAfter}`);

    /* ---- chips ---- */
    const chips = section.locator(".wwd-chip");
    const chipNames = (await chips.allInnerTexts()).map((t) => t.trim());
    check(`${tag}: chips are All + the groups present`, JSON.stringify(chipNames) === JSON.stringify(["All", "Electrical", "Bathroom", "Doors & Trim", "Outdoor"]), chipNames.join(", "));
    await section.locator(".wwd-chip", { hasText: "Bathroom" }).click();
    await wait(200);
    const groupsShown = await cards.evaluateAll((els) => els.map((e) => e.getAttribute("data-group")));
    check(`${tag}: Bathroom chip filters to the two bathroom pairs`, groupsShown.length === 2 && groupsShown.every((g) => g === "Bathroom"), groupsShown.join(", "));
    if (tag === "mobile") check(`${tag}: count follows the filter`, (await page.locator("[data-testid=wwd-count]").innerText()).replace(/\s+/g, " ").trim() === "1 / 2");
    await shot(page, `${tag}-04-filtered`);
    await section.locator(".wwd-chip", { hasText: "All" }).click();
    await wait(200);
    check(`${tag}: All restores the six`, (await cards.count()) === 6);

    /* ---- analytics, overflow, errors ---- */
    const events = await dataLayerEvents(page);
    check(`${tag}: analytics viewed / compare / filter`, ["what_we_do_viewed", "what_we_do_compare", "what_we_do_filter"].every((e) => events.includes(e)), events.filter((e) => /what_we_do/.test(e)).join(", "));
    check(`${tag}: compare fires once per card`, events.filter((e) => e === "what_we_do_compare").length === 1);
    check(`${tag}: pairs asked for with kind=before_after`, state.feedCalls.some((q) => /kind=before_after/.test(q)));
    check(`${tag}: no sideways scroll`, await noSideScroll(page));
    check(`${tag}: no page errors`, errors.length === 0, errors.join(" | "));
    await ctx.close();
  }

  /* ========================== reduced motion =========================== */
  {
    console.log("\n--- /recent-work, reduced motion ---");
    const { ctx, page, errors } = await open(browser, 390, { reducedMotion: true });
    await page.goto(`${BASE}/recent-work`, { waitUntil: "domcontentloaded" });
    const handle = page.locator("[data-testid=wwd-track] > li").first().locator("[data-testid=wwd-handle]");
    await handle.waitFor({ timeout: 20000 });
    const values = await sample(handle, 3200);
    check("reduced motion: no automatic movement, rests at 50", values.every((v) => v === 50), [...new Set(values)].join(","));
    const transition = await page.locator("[data-testid=wwd-track] > li").first().locator(".wwd-ba__before").evaluate((el) => getComputedStyle(el).transitionDuration);
    check("reduced motion: no transition on the comparison", /^0s(, 0s)*$/.test(transition), transition);
    check("reduced motion: no page errors", errors.length === 0, errors.join(" | "));
    await ctx.close();
  }

  /* ====================== homepage (CX 4.2) ====================== */
  for (const width of [390, 1440]) {
    const tag = width < 700 ? "home-mobile" : "home-desktop";
    console.log(`
--- homepage, ${width}px ---`);
    const { ctx, page, errors } = await open(browser, width);
    await page.goto(`${BASE}/`, { waitUntil: "domcontentloaded" });
    const section = page.locator("[data-testid=what-we-do]");
    await section.locator("[data-testid=wwd-track] > li").first().waitFor({ timeout: 20000 });
    check(`${tag}: heading says What's Included`, (await section.locator("h2").innerText()).trim() === "What’s Included");
    check(`${tag}: membership subtitle`, (await section.locator(".wwd-lede").innerText()).trim() === "Everyday home repairs and improvements, covered with your membership.");
    check(`${tag}: placed immediately before Two ways to start`, await page.evaluate(() => document.querySelector("[data-testid=what-we-do]").nextElementSibling?.id === "book"));
    check(`${tag}: one gallery, one heading`, (await page.locator("[data-testid=what-we-do]").count()) === 1 && (await page.locator("h2", { hasText: /What.s Included|What We Do/ }).count()) === 1);
    check(`${tag}: no second set of booking buttons right before the choice`, (await section.locator(".wwd-cta").count()) === 0);
    check(`${tag}: all pairs and the filters are there`, (await section.locator("[data-testid=wwd-track] > li").count()) === 6 && (await section.locator(".wwd-chip").count()) >= 2);
    check(`${tag}: illustrative disclosure visible`, await page.locator("[data-testid=wwd-note]").isVisible());
    check(`${tag}: no page errors`, errors.length === 0, errors.join(" | "));
    await ctx.close();
  }

  /* =============================== admin =============================== */
  for (const width of [390, 1440]) {
    const tag = width < 700 ? "admin-mobile" : "admin-desktop";
    console.log(`\n--- admin Recent Work, ${width}px ---`);
    const { ctx, page, state, errors } = await open(browser, width, { admin: true });
    await page.goto(`${BASE}/admin?tab=recent-work`, { waitUntil: "networkidle" });
    const addPair = page.locator("button", { hasText: "Add before & after" });
    await addPair.first().waitFor({ timeout: 20000 });
    await page.locator("text=Outlet replacement").first().waitFor({ timeout: 10000 });
    check(`${tag}: pair tile shows a Before/After badge`, (await page.locator("text=/^Before\\/After/").count()) >= 1);
    check(`${tag}: pair tile shows an Illustrative badge`, (await page.locator("span", { hasText: /^Illustrative$/ }).count()) >= 1);
    check(`${tag}: pair tile shows both thumbnails`, (await page.locator("img[alt^='Before: Outlet']").count()) >= 1 && (await page.locator("img[alt^='After: Outlet']").count()) >= 1);
    check(`${tag}: single-photo upload still offered`, (await page.locator("button", { hasText: "Add photos" }).count()) >= 1);
    await shot(page, `${tag}-01-list`);

    await addPair.first().click();
    const dialog = page.locator("[role=dialog][aria-label='Add before and after']");
    await dialog.waitFor();
    const submit = dialog.locator("button", { hasText: /continue|Upload/ }).last();
    check(`${tag}: submit disabled until both photos and a title`, await submit.isDisabled());
    await dialog.locator("[data-testid=pair-before]").setInputFiles({ name: "before.png", mimeType: "image/png", buffer: BEFORE_PNG });
    await dialog.locator("[data-testid=pair-after]").setInputFiles({ name: "after.png", mimeType: "image/png", buffer: AFTER_PNG });
    await dialog.locator("input[placeholder='Outlet replacement']").fill("Outlet replacement");
    await dialog.locator("textarea").fill("A scorched outlet swapped for a new one.");
    await dialog.locator("select").first().selectOption("Electrical");
    await dialog.locator("select").nth(1).selectOption("electrical");
    check(`${tag}: Illustrative and Publish now are on by default`, (await dialog.locator("input[type=checkbox]").nth(0).isChecked()) && (await dialog.locator("input[type=checkbox]").nth(1).isChecked()));
    check(`${tag}: pair form fits without sideways scroll`, await noSideScroll(page));
    await shot(page, `${tag}-02-form`);
    await dialog.locator("button", { hasText: "Upload and publish" }).click();
    await dialog.waitFor({ state: "detached", timeout: 10000 }).catch(() => {});

    const post = state.pairPosts[0];
    const field = (name) => (post?.body.match(new RegExp(`name="${name}"\\r\\n\\r\\n([^\\r]*)`)) || [])[1];
    check(`${tag}: pair posted as multipart`, !!post && /^multipart\/form-data; boundary=/.test(post.contentType), post?.contentType || "no request");
    check(`${tag}: before and after files both sent`, !!post && /name="before"; filename="before.png"/.test(post.body) && /name="after"; filename="after.png"/.test(post.body));
    check(
      `${tag}: pair fields sent`,
      field("title") === "Outlet replacement" && field("group") === "Electrical" && field("category") === "electrical" && field("illustrative") === "true" && field("publishNow") === "true" && /scorched outlet/.test(field("caption") || ""),
      ["title", "group", "category", "illustrative", "publishNow"].map((n) => `${n}=${field(n)}`).join(" ")
    );
    check(`${tag}: dialog closes after upload`, (await dialog.count()) === 0);
    check(`${tag}: no sideways scroll`, await noSideScroll(page));
    check(`${tag}: no page errors`, errors.length === 0, errors.join(" | "));
    await ctx.close();
  }

  await browser.close();
  const failed = results.filter((r) => !r.pass);
  console.log(`\n${results.length - failed.length}/${results.length} passed`);
  process.exit(failed.length ? 1 : 0);
})().catch((error) => {
  console.error(error);
  process.exit(1);
});
