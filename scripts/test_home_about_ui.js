/*
 * The simplified Home and the redesigned About.
 *
 * The checks that matter most here are not layout ones. They are: that the
 * start screen is untouched, that the 3D character and three.js are no longer
 * FETCHED on Home at all (not merely hidden), and that the membership map never
 * publishes a count of anything.
 *
 *   node scripts/test_home_about_ui.js [baseUrl]
 */
const { chromium } = require("playwright");

const BASE = process.argv[2] || "http://localhost:3000";
const SHOTS = process.env.PF_SHOTS || "";
const WIDTHS = [320, 360, 375, 390, 430, 768, 1024, 1280, 1440, 1920];

const results = [];
function check(name, pass, detail) {
  results.push({ name, pass, detail });
  console.log(`${pass ? "PASS" : "FAIL"}  ${name}${detail ? "  :: " + detail : ""}`);
}

async function openPage(browser, width, height, path = "/") {
  const ctx = await browser.newContext({ viewport: { width, height }, isMobile: width < 700, hasTouch: width < 700 });
  const page = await ctx.newPage();
  const heavy = [];
  page.on("request", (r) => {
    const u = r.url();
    if (/\.glb$|\.gltf$|three|WorldScene|draco/i.test(u)) heavy.push(u.split("/").pop().slice(0, 60));
  });
  await page.goto(BASE + path, { waitUntil: "domcontentloaded", timeout: 60000 });
  await page.waitForTimeout(1500);
  return { ctx, page, heavy };
}

async function scrollThrough(page) {
  await page.evaluate(async () => {
    await new Promise((res) => {
      let y = 0;
      const step = () => {
        y += window.innerHeight * 0.8;
        window.scrollTo(0, y);
        if (y < document.documentElement.scrollHeight) setTimeout(step, 200);
        else setTimeout(res, 900);
      };
      step();
    });
  });
  await page.waitForTimeout(2500);
}

(async () => {
  const browser = await chromium.launch();

  /* ---------------- the start screen is untouched ---------------- */
  {
    const { ctx, page } = await openPage(browser, 390, 844);
    await page.waitForSelector(".start-screen__photo", { timeout: 30000 });
    const s = await page.evaluate(() => {
      const t = document.body.innerText.replace(/’/g, "'");
      const hero = document.querySelector(".start-screen").getBoundingClientRect();
      return {
        headline: t.includes("Monthly handyman") && t.includes("for your home."),
        cta: !!document.querySelector(".start-screen__cta"),
        cue: t.includes("Scroll to explore"),
        burger: !!document.querySelector(".start-menu__trigger"),
        oneViewport: Math.abs(hero.height - window.innerHeight) < 2,
        pf: document.documentElement.dataset.pfStart,
      };
    });
    check("start screen headline unchanged", s.headline, "");
    check("start screen CTA present", s.cta, "");
    check("scroll cue present", s.cue, "");
    check("hamburger present", s.burger, "");
    check("start screen is exactly one viewport", s.oneViewport, "");
    check("start screen state = covering", s.pf === "covering", s.pf);

    await page.click(".start-screen__scroll");
    await page.waitForTimeout(1800);
    const after = await page.evaluate(() => ({
      y: window.scrollY,
      heroH: document.querySelector(".start-screen").getBoundingClientRect().height,
      pf: document.documentElement.dataset.pfStart,
      recognition: document.body.innerText.replace(/’/g, "'").includes("There's always something."),
    }));
    check("Scroll to explore still enters Home", after.y >= after.heroH - 4, `y=${after.y.toFixed(0)}`);
    check("state flips to passed", after.pf === "passed", after.pf);
    check("first Home beat is the recognition strip", after.recognition, "");
    await ctx.close();
  }

  /* ---------------- the 3D is gone, and not downloaded ---------------- */
  {
    const { ctx, page, heavy } = await openPage(browser, 390, 844);
    await page.waitForSelector(".start-screen__photo", { timeout: 30000 });
    await scrollThrough(page);
    const canvas = await page.evaluate(() => !!document.querySelector("canvas"));
    check("no 3D canvas anywhere on Home", canvas === false, `canvas=${canvas}`);
    check("three.js / the character are never requested on Home", heavy.length === 0, heavy.join(", ") || "none");
    await ctx.close();
  }

  /* ---------------- Home content and actions ---------------- */
  {
    const { ctx, page } = await openPage(browser, 390, 844);
    await scrollThrough(page);
    const m = await page.evaluate(() => {
      const t = document.body.innerText.replace(/’/g, "'");
      return {
        beats: {
          recognition: t.includes("There's always something."),
          work: /real work/i.test(t),
          how: t.includes("Book it. We come. It's done."),
          map: t.includes("Homes with an active membership"),
          proof: t.includes("A local company, not a marketplace."),
          close: t.includes("Start with whatever's been waiting longest."),
        },
        photos: document.querySelectorAll('section img[src*="work"], section img[srcset]').length,
        mapSvg: !!document.querySelector('[aria-labelledby="membership-map-heading"]'),
        price: t.includes("From $149 a month"),
        membershipLink: !!document.querySelector('a[href="/membership"]'),
        aboutLink: !!document.querySelector('a[href="/about"]'),
        getStarted: !!document.querySelector('a[href^="/signup"]'),
        /* Things that must no longer be on Home. */
        gone: {
          callForm: t.includes("Request a call") || t.includes("Interested in membership?"),
          planCards: t.includes("Compare plans") && t.includes("Membership starts at"),
          bookingMock: t.includes("WHAT NEEDS DOING") || t.includes("Book your visit"),
        },
        /* The rule that must never be broken. */
        numbers: (t.match(/\b\d{2,}\s+(members?|homes?|customers?|memberships?)\b/gi) || []),
      };
    });

    for (const [k, v] of Object.entries(m.beats)) check(`Home beat present: ${k}`, v, "");
    check("real work photographs render", m.photos > 0, `${m.photos} images`);
    check("membership map renders", m.mapSvg, "");
    check("price signal present", m.price, "");
    check("Membership link present", m.membershipLink, "");
    check("About link present", m.aboutLink, "");
    check("Get Started present", m.getStarted, "");
    check("lead-capture form removed from Home", !m.gone.callForm, "");
    check("plan cards removed from Home", !m.gone.planCards, "");
    check("mock booking UI removed from Home", !m.gone.bookingMock, "");
    check("NO public member/customer count anywhere on Home", m.numbers.length === 0, m.numbers.join(", "));

    await page.click('a[href^="/signup"]');
    await page.waitForURL(/\/signup/, { timeout: 20000 });
    check("Get Started reaches signup", /\/signup/.test(page.url()), page.url());
    await ctx.close();
  }

  /* ---------------- About ---------------- */
  {
    const { ctx, page } = await openPage(browser, 390, 844, "/about");
    await scrollThrough(page);
    const a = await page.evaluate(() => {
      const t = document.body.innerText.replace(/’/g, "'");
      return {
        hero: t.includes("One company to take care of your home."),
        why: t.includes("Built because every small job started over."),
        video: !!document.querySelector('iframe[src*="youtube"]'),
        covers: t.includes("The everyday kind of work."),
        ways: t.includes("Start where it fits."),
        trust: t.includes("A local company, not a marketplace."),
        licence: t.includes("HI-71484"),
        faq: t.includes("Before you choose."),
        giftCount: Array.from(document.querySelectorAll('main h1, main h2, main h3')).filter((h) => /Give the Gift/.test(h.textContent || '')).length,
        close: t.includes("Start with whatever's been waiting longest."),
      };
    });
    check("About: hero", a.hero, "");
    check("About: why it exists", a.why, "");
    check("About: founder video present", a.video, "");
    check("About: what a membership covers (moved from Home)", a.covers, "");
    check("About: ways to work", a.ways, "");
    check("About: local + trust (moved from Home)", a.trust, "");
    check("About: licence number stated", a.licence, "");
    check("About: FAQ", a.faq, "");
    check("About: gift appears exactly once", a.giftCount === 1, `${a.giftCount}`);
    check("About: close", a.close, "");
    await ctx.close();
  }

  /* ---------------- navigation ---------------- */
  {
    const { ctx, page } = await openPage(browser, 390, 844);
    await page.waitForSelector(".start-menu__trigger", { timeout: 20000 });
    await page.click(".start-menu__trigger");
    await page.waitForTimeout(500);
    const links = await page.evaluate(() =>
      Array.from(document.querySelectorAll(".start-menu__sheet a")).map((a) => a.getAttribute("href"))
    );
    check("hamburger opens", links.length > 0, "");
    check("About reachable from the menu", links.includes("/about"), "");
    check("Membership reachable from the menu", links.includes("/membership"), "");
    await page.keyboard.press("Escape");
    await ctx.close();
  }

  /* ---------------- responsive ---------------- */
  for (const w of WIDTHS) {
    const h = w < 700 ? 844 : 900;
    for (const [path, name] of [["/", "home"], ["/about", "about"]]) {
      const { ctx, page } = await openPage(browser, w, h, path);
      await scrollThrough(page);
      const m = await page.evaluate(() => ({
        vw: window.innerWidth,
        scrollW: document.documentElement.scrollWidth,
        docH: document.documentElement.scrollHeight,
        tiny: Array.from(document.querySelectorAll("p, li, dd")).filter((e) => {
          if (e.closest(".start-screen")) return false;
          if (e.closest('[aria-labelledby="membership-map-heading"]')) return false;
          const cs = getComputedStyle(e);
          // Uppercase labels and captions are meant to be small.
          if (cs.textTransform === "uppercase") return false;
          if (parseFloat(cs.letterSpacing) > 0.5) return false;
          const txt = e.innerText.trim();
          return txt.length > 24 && parseFloat(cs.fontSize) < 13;
        }).length,
        overflowing: Array.from(document.querySelectorAll("section, img, h1, h2")).filter((e) => {
          if (e.closest(".start-screen")) return false;
          return e.getBoundingClientRect().right > window.innerWidth + 2;
        }).length,
      }));
      check(`${name} ${w}px no horizontal overflow`, m.scrollW <= m.vw + 1, `${m.scrollW}/${m.vw}`);
      check(`${name} ${w}px nothing spills past the viewport`, m.overflowing === 0, `${m.overflowing}`);
      check(`${name} ${w}px no sub-13px body text`, m.tiny === 0, `${m.tiny}`);
      if (SHOTS && [320, 390, 430, 1440, 1920].includes(w)) {
        await page.evaluate(() => window.scrollTo(0, 0));
        await page.waitForTimeout(400);
        await page.screenshot({ path: `${SHOTS}/final-${name}-${w}.png`, fullPage: true });
      }
      await ctx.close();
    }
  }

  await browser.close();
  const failed = results.filter((r) => !r.pass);
  console.log(`\n${results.length - failed.length}/${results.length} checks passed`);
  if (failed.length) {
    console.log("FAILURES:");
    failed.forEach((f) => console.log(" - " + f.name + " :: " + f.detail));
    process.exit(1);
  }
})().catch((e) => { console.error(e); process.exit(1); });
