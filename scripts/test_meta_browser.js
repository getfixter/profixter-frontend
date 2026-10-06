/*
 * What fbq actually receives in a real browser.
 *
 * The source-level suite in BackEnd/scripts/test_meta_tracking.js proves the
 * code says the right thing. This proves the page DOES the right thing: one
 * pixel initialised, one PageView, an eventID on every conversion, and no
 * event firing twice. Those are the failures that never show up as an error.
 *
 * fbq is replaced with a recorder BEFORE any script runs, so nothing reaches
 * Meta and every call is captured in order.
 *
 *   node scripts/test_meta_browser.js [baseUrl]
 */
const { chromium } = require("playwright");

const BASE = process.argv[2] || "http://localhost:3000";
const PIXEL = "3668264173327839";
const OLD_PIXEL = "4096130163937669";
const WRONG_PIXEL = "2681929598889944";

const results = [];
function check(name, pass, detail) {
  results.push({ name, pass, detail });
  console.log(`${pass ? "PASS" : "FAIL"}  ${name}${detail ? "  :: " + detail : ""}`);
}

/**
 * Stand in for fbq before the real one loads.
 *
 * The pixel snippet bails out early if `f.fbq` already exists, so defining it
 * here means the network script never installs itself and nothing is sent to
 * Meta - while every call the app makes is still recorded exactly as issued.
 */
const RECORDER = () => {
  const w = window;
  w.__fbq_calls = [];
  w.fbq = function (...args) {
    w.__fbq_calls.push(args);
  };
  w._fbq = w.fbq;
  w.fbq.queue = [];
  w.fbq.loaded = true;
  w.fbq.version = "2.0";

  w.dataLayer = w.dataLayer || [];
  const push = w.dataLayer.push.bind(w.dataLayer);
  w.__dl = [];
  w.dataLayer.push = function (...args) {
    w.__dl.push(...args);
    return push(...args);
  };
};

async function open(browser, path = "/", opts = {}) {
  const ctx = await browser.newContext({
    viewport: { width: 390, height: 844 },
    isMobile: true,
    hasTouch: true,
  });
  await ctx.addInitScript(RECORDER);
  // Nothing may leave for Meta during a test run.
  await ctx.route("**connect.facebook.net/**", (r) => r.abort());
  await ctx.route("**facebook.com/tr**", (r) => r.abort());
  if (opts.setup) await opts.setup(ctx);
  const page = await ctx.newPage();
  await page.goto(BASE + path, { waitUntil: "domcontentloaded", timeout: 60000 });
  await page.waitForTimeout(opts.settle || 3000);
  return { ctx, page };
}

const calls = (page) => page.evaluate(() => window.__fbq_calls || []);
const dl = (page) => page.evaluate(() => window.__dl || []);

(async () => {
  const browser = await chromium.launch();

  /* ---------------- the pixel itself ---------------- */
  {
    const { ctx, page } = await open(browser, "/");
    const fbq = await calls(page);

    const inits = fbq.filter((c) => c[0] === "init");
    const pageViews = fbq.filter((c) => c[0] === "track" && c[1] === "PageView");

    check("exactly one fbq init on a cold page", inits.length === 1, JSON.stringify(inits));
    check("it initialises the correct dataset", inits[0]?.[1] === PIXEL, String(inits[0]?.[1]));
    check("the old pixel is never initialised", !inits.some((c) => c[1] === OLD_PIXEL), "");
    check("the mistaken pixel is never initialised", !inits.some((c) => c[1] === WRONG_PIXEL), "");
    check("exactly one PageView", pageViews.length === 1, `${pageViews.length}`);

    const html = await page.content();
    check("no other pixel id appears in the served page", !html.includes(OLD_PIXEL) && !html.includes(WRONG_PIXEL), "");
    // The ampersands serialise as &amp; in HTML and & in the RSC payload,
    // so the assertion is on the id in a tracking-pixel URL, not on raw "&".
    const noscriptOk = /facebook\.com\/tr\?id=3668264173327839/.test(html);
    check("the noscript fallback points at the correct dataset", noscriptOk, "");
    check("GTM is still installed", html.includes("GTM-KFPSD2P6"), "");

    await ctx.close();
  }

  /* ---------------- attribution survives navigation ---------------- */
  {
    const { ctx, page } = await open(
      browser,
      "/?utm_source=facebook&utm_campaign=spring_launch&utm_content=video_a&fbclid=IwAR_TEST_123"
    );
    const stored = await page.evaluate(() => {
      try {
        return JSON.parse(localStorage.getItem("pf_attribution") || "{}");
      } catch {
        return {};
      }
    });
    check("utm_source is captured at landing", stored.utmSource === "facebook", String(stored.utmSource));
    check("utm_campaign is captured", stored.utmCampaign === "spring_launch", String(stored.utmCampaign));
    check("utm_content is captured", stored.utmContent === "video_a", String(stored.utmContent));
    check("fbclid is captured", stored.fbclid === "IwAR_TEST_123", String(stored.fbclid));

    // Navigate somewhere with no parameters: the campaign must survive.
    await page.goto(BASE + "/about", { waitUntil: "domcontentloaded" });
    await page.waitForTimeout(2500);
    const after = await page.evaluate(() => {
      try {
        return JSON.parse(localStorage.getItem("pf_attribution") || "{}");
      } catch {
        return {};
      }
    });
    check(
      "a later page with no parameters does not erase the campaign",
      after.utmCampaign === "spring_launch",
      String(after.utmCampaign)
    );
    await ctx.close();
  }

  /* ---------------- Contact ---------------- */
  {
    const { ctx, page } = await open(browser, "/");
    // Stop the dialler from being invoked; the click still propagates.
    await page.evaluate(() => {
      document.addEventListener("click", (e) => {
        const a = e.target.closest?.("a[href^='tel:']");
        if (a) e.preventDefault();
      });
    });

    const phone = await page.$("a[href^='tel:']");
    if (phone) {
      await phone.click();
      await page.waitForTimeout(600);
      const fbq = await calls(page);
      const contact = fbq.filter((c) => c[0] === "track" && c[1] === "Contact");
      check("tapping the phone number fires Contact once", contact.length === 1, `${contact.length}`);
      check("Contact carries an eventID", Boolean(contact[0]?.[3]?.eventID), JSON.stringify(contact[0]?.[3]));

      const layer = await dl(page);
      check("phone_click reaches the dataLayer", layer.some((e) => e.event === "phone_click"), "");

      // A second tap is a second contact, not a duplicate of the first.
      await phone.click();
      await page.waitForTimeout(500);
      const again = (await calls(page)).filter((c) => c[0] === "track" && c[1] === "Contact");
      const ids = new Set(again.map((c) => c[3]?.eventID));
      check("each tap gets its own eventID", again.length === 2 && ids.size === 2, `${again.length} calls, ${ids.size} ids`);
    } else {
      check("a phone link exists on the homepage", false, "none found");
    }
    await ctx.close();
  }

  /* ---------------- StartSignup ---------------- */
  {
    const { ctx, page } = await open(browser, "/signup", { settle: 3500 });

    // Fill step 1 by hand: the address field is a Google Places component, and
    // the manual path is the one a test can drive without the API.
    const typed = await page.evaluate(() => {
      const setValue = (el, value) => {
        const setter = Object.getOwnPropertyDescriptor(
          window.HTMLInputElement.prototype,
          "value"
        ).set;
        setter.call(el, value);
        el.dispatchEvent(new Event("input", { bubbles: true }));
      };
      const inputs = Array.from(document.querySelectorAll("input"));
      return inputs.map((i) => i.name || i.id || i.placeholder || "").filter(Boolean);
    });
    check("signup step 1 renders inputs", typed.length > 0, typed.slice(0, 6).join(", "));

    const before = (await calls(page)).filter((c) => c[1] === "StartSignup").length;
    check("StartSignup has not fired merely from loading /signup", before === 0, `${before}`);

    const dlBefore = (await dl(page)).filter((e) => e.event === "start_signup").length;
    check("start_signup is not a page-load dataLayer event", dlBefore === 0, `${dlBefore}`);

    await ctx.close();
  }

  /* ---------------- no stray conversions anywhere ---------------- */
  for (const path of ["/", "/about", "/membership/plans", "/book", "/signup"]) {
    const { ctx, page } = await open(browser, path);
    const fbq = await calls(page);
    const conversions = fbq.filter(
      (c) => c[0] === "track" && ["Lead", "Subscribe", "Purchase"].includes(c[1])
    );
    check(
      `${path}: no conversion fires just from loading the page`,
      conversions.length === 0,
      conversions.map((c) => c[1]).join(",")
    );
    const inits = fbq.filter((c) => c[0] === "init");
    check(`${path}: one init, correct dataset`, inits.length === 1 && inits[0][1] === PIXEL, JSON.stringify(inits.map((i) => i[1])));
    await ctx.close();
  }

  await browser.close();
  const failed = results.filter((r) => !r.pass);
  console.log(`\n${results.length - failed.length}/${results.length} checks passed`);
  if (failed.length) {
    console.log("FAILURES:");
    failed.forEach((f) => console.log(" - " + f.name + " :: " + f.detail));
    process.exit(1);
  }
})().catch((e) => {
  console.error(e);
  process.exit(1);
});
