/*
 * True first-touch attribution in the browser, through to the sign-up request.
 *
 *   node scripts/test_attribution_ui.js [baseUrl]
 *
 * Real pages, real lib/meta.ts. The API is answered in the browser: the visit
 * beacon and POST /api/auth/register are captured, so what is checked is the
 * exact attribution a registration sends. BackEnd scripts/test_attribution.js
 * classifies those same payloads (Facebook, Instagram, Google Ads...).
 *
 * What it pins:
 * - the first page a browser opens decides acquisition; nothing later replaces it
 * - our own ?source=home|about|start-screen never becomes, or blocks, a touch
 * - ?source=event|qr|referral and a referral-program ?ref= are kept
 * - Meta ids and names arrive in separate fields
 * - browsers that visited before this change are migrated truthfully
 * - the Meta click record (fbclid) the Conversions API falls back on is unchanged
 */
const { chromium } = require("playwright");

const BASE = process.argv[2] || "http://localhost:3000";
const API = "https://api.profixter.com";
const TOKEN = "attr-token";
const UA = "Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.0 Mobile/15E148 Safari/604.1";

const results = [];
/* Optional: ATTR_PAYLOADS_OUT=<file> keeps every registration payload, to classify with the backend rules. */
const payloads = [];
function check(name, pass, detail = "") {
  results.push({ name, pass: !!pass });
  console.log(`${pass ? "PASS" : "FAIL"}  ${name}${detail ? "  :: " + detail : ""}`);
}

const META = "utm_medium=paid&utm_campaign=52606450943827&utm_term=52606450943627&utm_content=52606954471427";

async function fresh(browser, { seed } = {}) {
  const ctx = await browser.newContext({ userAgent: UA, viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true });
  await ctx.addInitScript((seedState) => {
    Object.defineProperty(Navigator.prototype, "webdriver", { get: () => false });
    try {
      localStorage.setItem("profixter_promotion_popup_dismissed_date", new Date().toISOString().slice(0, 10));
      if (seedState && !sessionStorage.getItem("__seeded")) {
        sessionStorage.setItem("__seeded", "1");
        for (const [k, v] of Object.entries(seedState)) localStorage.setItem(k, typeof v === "string" ? v : JSON.stringify(v));
      }
    } catch {}
  }, seed || null);
  const state = { visits: [], register: null };
  const user = { _id: "u1", userId: "PF-1", name: "Test Person", email: "test@example.com", role: "customer", addresses: [] };
  await ctx.route((url) => url.href.startsWith(API), async (route) => {
    const req = route.request();
    const p = new URL(req.url()).pathname;
    const cors = { "access-control-allow-origin": req.headers()["origin"] || BASE, "access-control-allow-credentials": "true", "access-control-allow-headers": "Authorization,Content-Type", "access-control-allow-methods": "GET,POST,PUT,PATCH,DELETE,OPTIONS" };
    const json = (status, body) => route.fulfill({ status, contentType: "application/json", headers: cors, body: JSON.stringify(body) });
    if (req.method() === "OPTIONS") return route.fulfill({ status: 204, headers: cors });
    if (p === "/api/track/visit") { state.visits.push(JSON.parse(req.postData() || "{}")); return route.fulfill({ status: 204, headers: cors }); }
    if (p === "/api/auth/register" && req.method() === "POST") { state.register = JSON.parse(req.postData() || "{}"); return json(201, { token: TOKEN, user }); }
    if (p === "/api/auth/me") return (req.headers()["authorization"] || "").includes(TOKEN) ? json(200, user) : json(401, {});
    if (p.startsWith("/api/service-area")) return json(200, { inServiceArea: true, serviceable: true, county: "Nassau", supported: true });
    if (p.startsWith("/api/track")) return route.fulfill({ status: 204, headers: cors });
    return json(200, {});
  });
  const page = await ctx.newPage();
  page.on("dialog", (d) => d.dismiss());
  return { ctx, page, state };
}

async function go(page, path, referer) {
  await page.goto(BASE + path, { waitUntil: "domcontentloaded", referer }).catch(() => {});
  await page.waitForTimeout(1200);
}

/* The real sign-up form, start to finish (address, name, contact, password). */
async function register(page, state) {
  await go(page, "/signup");
  await page.waitForSelector("#pf-address", { timeout: 15000 }).catch(() => {});
  await page.fill("#pf-address", "12 Main St").catch(() => {});
  await page.waitForTimeout(700);
  await page.keyboard.press("Escape").catch(() => {});
  const fallback = page.locator("[data-auth-fallback]");
  if (await fallback.count()) await fallback.click();
  if (await page.locator('[aria-label="Street address"]').count()) {
    await page.fill('[aria-label="Street address"]', "12 Main St");
    await page.fill('[aria-label="City"]', "Massapequa");
    await page.fill('[aria-label="ZIP code"]', "11758");
  }
  await page.waitForTimeout(800);
  await page.click('button[type="submit"]');
  await page.fill("#name", "Test Person");
  await page.click('button[type="submit"]');
  await page.fill("#email", "test@example.com");
  await page.fill("#phone", "6315550134");
  await page.check("#sms-service-consent", { force: true });
  await page.click('button[type="submit"]');
  await page.fill("#password", "correct-horse-1");
  await page.check("#agree-terms", { force: true });
  await page.click('button[type="submit"]');
  for (let i = 0; i < 30 && !state.register; i++) await page.waitForTimeout(200);
  return state.register?.attribution || null;
}

const has = (a, keys) => keys.every((k) => a && a[k]);
const none = (a, keys) => keys.every((k) => !a || !a[k]);
const TAG_KEYS = ["utmSource", "utmMedium", "utmCampaign", "fbclid", "gclid", "gbraid", "campaignId", "refSource", "refCode"];
const host = (u) => { try { return new URL(u).hostname.replace(/^www\./, ""); } catch { return ""; } };

(async () => {
  const browser = await chromium.launch({ args: ["--disable-blink-features=AutomationControlled"] });

  console.log("\n--- one landing, then sign-up: what registration sends ---");
  const SINGLE = [
    ["Facebook ad", `/?utm_source=fb&${META}&fbclid=IwQfb`, "https://m.facebook.com/", (a) => a.utmSource === "fb" && a.fbclid === "IwQfb" && a.utmCampaign === "52606450943827" && a.utmTerm === "52606450943627" && a.utmContent === "52606954471427"],
    ["Instagram ad", `/?utm_source=ig&${META}&fbclid=IwQig`, "https://l.instagram.com/", (a) => a.utmSource === "ig" && a.fbclid === "IwQig" && host(a.referrer) === "l.instagram.com"],
    ["Other Meta placement (an)", `/?utm_source=an&${META}&fbclid=IwQan`, undefined, (a) => a.utmSource === "an" && !!a.fbclid],
    ["Meta names and ids in their own parameters", `/?utm_source=fb&utm_medium=paid&campaign_id=526064509438&campaign_name=Fall&adset_id=526064509436&adset_name=LI&ad_id=526069544714&ad_name=Video&fbclid=IwQn`, undefined, (a) => a.campaignId === "526064509438" && a.campaignName === "Fall" && a.adsetName === "LI" && a.adName === "Video" && a.adId === "526069544714"],
    ["Google Ads (gclid)", "/kitchen-bathroom?gclid=Cj0Ktest", "https://www.google.com/", (a) => a.gclid === "Cj0Ktest" && a.landingPath === "/kitchen-bathroom"],
    ["Google Organic", "/", "https://www.google.com/", (a) => host(a.referrer) === "google.com" && none(a, TAG_KEYS)],
    ["Direct", "/", undefined, (a) => !a.referrer && none(a, TAG_KEYS)],
    ["Event kiosk link", "/signup?source=event", undefined, (a) => a.refSource === "event" && a.landingPath === "/signup"],
    ["QR code (no referrer)", "/?source=qr", undefined, (a) => a.refSource === "qr" && !a.referrer],
    ["Referral program link ?ref=", "/?ref=12345678", undefined, (a) => a.refCode === "12345678"],
    ["Referral ?source=referral", "/?source=referral", undefined, (a) => a.refSource === "referral"],
    ["Other external referrer (Yelp)", "/", "https://www.yelp.com/biz/profixter", (a) => host(a.referrer) === "yelp.com" && none(a, TAG_KEYS)],
    ["Our own link as the very first page (?source=home)", "/signup?source=home", undefined, (a) => none(a, TAG_KEYS) && !a.referrer],
  ];
  for (const [label, path, ref, ok] of SINGLE) {
    const { ctx, page, state } = await fresh(browser);
    await go(page, path, ref);
    const beacon = state.visits[0] || null;
    const a = await register(page, state);
    payloads.push({ scenario: label, attribution: a });
    check(`${label}: registration carries its first touch`, a && ok(a), JSON.stringify(a && Object.fromEntries(Object.entries(a).filter(([k, v]) => v && k !== "visitorId" && k !== "firstSeenAt" && k !== "fbclidAt"))));
    check(`${label}: one visit beacon, never an internal ?source=`, state.visits.length === 1 && (!beacon.refSource || ["event", "qr", "referral"].includes(beacon.refSource)), `beacons ${state.visits.length}, refSource ${beacon && beacon.refSource}`);
    check(`${label}: sign-up links the account to the same browser`, a && a.visitorId && beacon && a.visitorId === beacon.visitorId);
    await ctx.close();
  }

  console.log("\n--- sequences in one browser: the first touch survives ---");
  const SEQ = [
    ["Google Organic -> Meta ad -> sign-up = Google Organic", [["/", "https://www.google.com/"], [`/?utm_source=fb&${META}&fbclid=IwQB`, "https://m.facebook.com/"]], (a) => host(a.referrer) === "google.com" && none(a, TAG_KEYS)],
    ["Meta ad -> Direct -> sign-up = Meta (Facebook)", [[`/?utm_source=fb&${META}&fbclid=IwQA`, "https://m.facebook.com/"], ["/", undefined], ["/about", undefined]], (a) => a.utmSource === "fb" && a.fbclid === "IwQA"],
    ["Direct -> Meta ad -> sign-up = Direct", [["/", undefined], [`/?utm_source=ig&${META}&fbclid=IwQC`, "https://l.instagram.com/"]], (a) => none(a, TAG_KEYS) && !a.referrer],
    ["Event -> Direct -> sign-up = Event", [["/signup?source=event", undefined], ["/", undefined]], (a) => a.refSource === "event"],
    ["Direct -> our ?source=home -> Meta ad -> sign-up = Direct", [["/", undefined], ["/signup?source=home", undefined], [`/?utm_source=fb&${META}&fbclid=IwQE`, "https://m.facebook.com/"]], (a) => none(a, TAG_KEYS)],
    ["Direct -> our ?source=about -> Google Ads -> sign-up = Direct", [["/", undefined], ["/signup?source=about", undefined], ["/kitchen-bathroom?gclid=Cj0Kabout", "https://www.google.com/"]], (a) => none(a, TAG_KEYS)],
    ["Direct -> our ?source=start-screen -> Instagram ad -> sign-up = Direct", [["/", undefined], ["/signup?source=start-screen", undefined], [`/?utm_source=ig&${META}&fbclid=IwQS`, "https://l.instagram.com/"]], (a) => none(a, TAG_KEYS)],
    ["Our ?source=home as the very first page -> Meta ad -> sign-up = Direct (first touch was untagged)", [["/signup?source=home", undefined], [`/?utm_source=fb&${META}&fbclid=IwQH`, "https://m.facebook.com/"]], (a) => none(a, TAG_KEYS)],
    ["Meta ad -> refresh -> reopen -> sign-up = Meta (Instagram)", [[`/?utm_source=ig&${META}&fbclid=IwQR`, "https://l.instagram.com/"], ["RELOAD"], ["NEWTAB"]], (a) => a.utmSource === "ig"],
  ];
  for (const [label, steps, ok] of SEQ) {
    const { ctx, page: first, state } = await fresh(browser);
    let page = first;
    for (const [path, ref] of steps) {
      if (path === "RELOAD") { await page.reload({ waitUntil: "domcontentloaded" }); await page.waitForTimeout(1000); continue; }
      if (path === "NEWTAB") { const p2 = await ctx.newPage(); await page.close(); page = p2; await go(page, "/", undefined); continue; }
      await go(page, path, ref);
    }
    const a = await register(page, state);
    payloads.push({ scenario: label, attribution: a });
    check(label, a && ok(a), JSON.stringify(a && Object.fromEntries(Object.entries(a).filter(([k, v]) => v && !["visitorId", "firstSeenAt", "fbclidAt"].includes(k)))));
    check(`${label}: still one visit beacon`, state.visits.length === 1, String(state.visits.length));
    await ctx.close();
  }

  console.log("\n--- browsers that arrived before this change ---");
  {
    // First visit was a Google search; a Meta ad came later and the old code stored it as "the" touch.
    const { ctx, page, state } = await fresh(browser, {
      seed: {
        pf_vid: "v_legacyorganic01",
        pf_visit_sent: "1",
        pf_first_seen: { firstLandingPath: "/", firstReferrer: "https://www.google.com/", firstSeenAt: Date.now() - 86400000 },
        pf_attribution: { utmSource: "fb", utmMedium: "paid", fbclid: "IwQold", fbclidAt: Date.now() - 3600000, landingPath: "/membership/plans", referrer: "https://m.facebook.com/" },
      },
    });
    await go(page, "/about");
    const a = await register(page, state);
    check("old browser: Google first, Meta later -> the first touch (Google Organic) wins", a && host(a.referrer) === "google.com" && none(a, TAG_KEYS), JSON.stringify(a));
    const metaClick = await page.evaluate(() => JSON.parse(localStorage.getItem("pf_attribution") || "{}").fbclid);
    check("...and the Meta click record the Conversions API uses is untouched", metaClick === "IwQold");
    await ctx.close();
  }
  {
    // The old code stored our own ?source=home as the touch.
    const { ctx, page, state } = await fresh(browser, {
      seed: {
        pf_vid: "v_legacyinternal1",
        pf_visit_sent: "1",
        pf_first_seen: { firstLandingPath: "/signup", firstSeenAt: Date.now() - 86400000 },
        pf_attribution: { refSource: "home", landingPath: "/signup" },
      },
    });
    await go(page, "/");
    const a = await register(page, state);
    check("old browser: a stored internal ?source=home is not a touch -> Direct", a && none(a, TAG_KEYS), JSON.stringify(a));
    await ctx.close();
  }
  {
    // The old code stored the ad from the very first landing: that is the first touch and is kept.
    const t = Date.now() - 86400000;
    const { ctx, page, state } = await fresh(browser, {
      seed: {
        pf_vid: "v_legacymetafirst",
        pf_visit_sent: "1",
        pf_first_seen: { firstLandingPath: "/", firstReferrer: "https://l.instagram.com/", firstSeenAt: t },
        pf_attribution: { utmSource: "ig", utmMedium: "paid", utmCampaign: "52606450943827", fbclid: "IwQfirst", landingPath: "/", referrer: "https://l.instagram.com/" },
      },
    });
    await go(page, "/");
    const a = await register(page, state);
    check("old browser: an ad on the very first landing is kept (Instagram)", a && a.utmSource === "ig" && a.fbclid === "IwQfirst", JSON.stringify(a));
    await ctx.close();
  }

  await browser.close();
  if (process.env.ATTR_PAYLOADS_OUT) require("fs").writeFileSync(process.env.ATTR_PAYLOADS_OUT, JSON.stringify(payloads, null, 1));
  const failed = results.filter((r) => !r.pass);
  console.log(`\n${results.length - failed.length}/${results.length} passed`);
  process.exit(failed.length ? 1 : 0);
})();
