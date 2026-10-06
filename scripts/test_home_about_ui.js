/*
 * The simplified Home and the redesigned About.
 *
 * The checks that matter most here are not layout ones. They are: that Home
 * is the free-visit booker with no signup wall in front of it, that the 3D
 * character and three.js are never FETCHED on Home (not merely hidden), and
 * that nothing on Home publishes a count of anything.
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
  /* Optional: a local build on a port the API's CORS list does not include. */
  if (process.env.PF_CORS_PROXY) await require(process.env.PF_CORS_PROXY)(ctx);
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

  /* ---------------- the landing is the booker ---------------- */
  /*
   * The full-screen start screen and its "Get Started" -> /signup button are
   * gone on purpose: a visitor now describes the job and picks a real time
   * before any account exists. What is pinned here is that the booker is on
   * the first screen, live, and that nothing on Home sends a new visitor to a
   * signup form first.
   */
  {
    const { ctx, page } = await openPage(browser, 390, 844);
    await page.waitForSelector('[data-fv="note"]', { timeout: 30000 });
    await page.waitForSelector('[data-booking-date-disabled="false"]', { timeout: 30000 }).catch(() => {});
    const s = await page.evaluate(() => {
      const t = document.body.innerText.replace(/’/g, "'");
      const note = document.querySelector('[data-fv="note"]').getBoundingClientRect();
      return {
        headline: t.includes("Your handyman.") && t.includes("On demand."),
        offer: t.includes("First 90-minute visit"),
        bookerOnFirstScreen: note.top < window.innerHeight,
        liveCalendar: document.querySelectorAll('[data-booking-date-disabled="false"]').length > 0,
        noStartScreen: !document.querySelector(".start-screen"),
        noSignupWall: !document.querySelector('a[href^="/signup"]'),
      };
    });
    check("headline states the product", s.headline, "");
    check("free 90-minute offer stated", s.offer, "");
    check("booker starts on the first screen (390px)", s.bookerOnFirstScreen, "");
    check("real availability shown signed out", s.liveCalendar, "");
    check("old start screen removed", s.noStartScreen, "");
    check("no signup link anywhere on Home", s.noSignupWall, "");
    await ctx.close();
  }

  /* ---------------- the 3D is gone, and not downloaded ---------------- */
  {
    const { ctx, page, heavy } = await openPage(browser, 390, 844);
    await page.waitForSelector('[data-fv="note"]', { timeout: 30000 });
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
          how: t.includes("Book. We come. Done."),
          plans: t.includes("Want a handyman all year?"),
          work: /real work/i.test(t),
          proof: t.includes("A local company, not a marketplace."),
          faq: !!document.querySelector("details.lx-faq"),
        },
        photos: document.querySelectorAll('section img[src*="work"], section img[srcset]').length,
        price: t.includes("Plans from $149 a month"),
        plansLink: !!document.querySelector('a[href="/membership/plans"]'),
        aboutLink: !!document.querySelector('a[href="/about"]'),
        /* Things that must not be on Home. */
        gone: {
          callForm: t.includes("Request a call") || t.includes("Interested in membership?"),
          planCards: t.includes("Compare plans") && t.includes("Membership starts at"),
        },
        /* The rule that must never be broken. */
        numbers: (t.match(/\b\d{2,}\s+(members?|homes?|customers?|memberships?)\b/gi) || []),
        /* Membership copy is a pace, never a count. */
        badWords: (t.match(/unlimited visits|visits per month|active booking|active appointment/gi) || []),
      };
    });

    for (const [k, v] of Object.entries(m.beats)) check(`Home beat present: ${k}`, v, "");
    check("real work photographs render", m.photos > 0, `${m.photos} images`);
    check("price signal present", m.price, "");
    check("Plans link goes straight to prices", m.plansLink, "");
    check("About link present", m.aboutLink, "");
    check("lead-capture form removed from Home", !m.gone.callForm, "");
    check("plan cards removed from Home", !m.gone.planCards, "");
    check("NO public member/customer count anywhere on Home", m.numbers.length === 0, m.numbers.join(", "));
    check("membership copy never counts visits", m.badWords.length === 0, m.badWords.join(", "));

    await page.locator('a[href="/membership/plans"]:visible').first().click();
    await page.waitForURL(/\/membership\/plans/, { timeout: 20000 });
    check("See plans reaches the prices in one tap", /\/membership\/plans/.test(page.url()), page.url());
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
    await page.click('button[aria-label="Open menu"]');
    await page.waitForTimeout(500);
    const links = await page.evaluate(() =>
      Array.from(document.querySelectorAll("header a, nav a")).map((a) => a.getAttribute("href"))
    );
    check("menu opens", links.length > 0, "");
    check("About reachable from the menu", links.includes("/about"), "");
    check("Plans reachable from the menu", links.includes("/membership/plans"), "");
    check("Book free visit reachable from the menu", links.includes("/#book") || links.includes("/book/free"), "");
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
