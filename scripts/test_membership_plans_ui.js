/*
 * The membership buying page: one box, four tabs, seven rows.
 *
 * The presentation changed completely; none of the purchasing logic did. So
 * this suite checks three separate things and keeps them separate:
 *
 *  1. THE MATRIX. Every row, for every plan, on both cycles, against a table
 *     mirrored from the backend rules - so a copy edit that quietly promises
 *     something the system does not do fails here.
 *  2. THE MECHANIC. That the rows hold their positions, that the box does not
 *     resize when the plan changes (a CTA that moves is a CTA that swallows
 *     taps), that nothing is ever marked with a cross, and that Elite is the
 *     only complete state.
 *  3. THE GUARDS. Signed out goes to signup with the plan preserved, a signed-in
 *     non-member with complete contact reaches Stripe, one missing a phone is
 *     asked for it first (Registration 2.0) with nothing sent to Stripe behind
 *     the sheet, and a member's plan-change labels are left alone.
 *
 *   node scripts/test_membership_plans_ui.js [baseUrl]
 */
const { chromium } = require("playwright");

const BASE = process.argv[2] || "http://localhost:3000";
const SHOTS = process.env.PF_SHOTS || "";
const WIDTHS = [320, 360, 375, 390, 430, 768, 1024, 1280, 1440, 1920];
const PLANS = ["Basic", "Plus", "Premium", "Elite"];

/* Mirrors BackEnd/utils/subscriptionManagement.js PLAN_CATALOG. */
const CATALOG = {
  Basic: { monthly: 149, annual: 1490 },
  Plus: { monthly: 249, annual: 2490 },
  Premium: { monthly: 349, annual: 3490 },
  Elite: { monthly: 499, annual: 4990 },
};

/*
 * The seven rows, in order, and what each plan is entitled to.
 *
 * Checked against the system, not against the marketing:
 *   pace     routes/bookings.js `plan === "basic" ? 1 : plan ? 2 : 0`
 *   fullDay  one per MEMBERSHIP MONTH - annual members included, since
 *            entitlementPeriod slices an annual period into months
 *   priority no backend entitlement at all; copy is the whole definition
 */
const MATRIX = [
  { on: { Basic: 1, Plus: 1, Premium: 1, Elite: 1 }, text: "90-minute visits, any home task" },
  { on: { Basic: 1, Plus: 1, Premium: 1, Elite: 1 }, text: "The same local team every time" },
  {
    on: { Basic: 1, Plus: 1, Premium: 1, Elite: 1 },
    perPlan: {
      Basic: "Book 1 visit at a time",
      Plus: "Book up to 2 visits at a time",
      Premium: "Book up to 2 visits at a time",
      Elite: "Book up to 2 visits at a time",
    },
  },
  { on: { Basic: 0, Plus: 1, Premium: 1, Elite: 1 }, text: "Small supplies included" },
  {
    on: { Basic: 0, Plus: 0, Premium: 1, Elite: 1 },
    perPlan: {
      Basic: "Priority Visits",
      Plus: "Priority Visits",
      Premium: "1 Priority Visit / month",
      Elite: "2 Priority Visits / month",
    },
  },
  {
    on: { Basic: 0, Plus: 0, Premium: 0, Elite: 1 },
    perPlan: {
      Basic: "A Full Day of work",
      Plus: "A Full Day of work",
      Premium: "A Full Day of work",
      Elite: "1 Full Day / month",
    },
  },
  { on: { Basic: 0, Plus: 0, Premium: 0, Elite: 1 }, text: "10% off larger projects" },
];

const ON_COUNT = { Basic: 3, Plus: 4, Premium: 5, Elite: 7 };

const results = [];
function check(name, pass, detail) {
  results.push({ name, pass, detail });
  console.log(`${pass ? "PASS" : "FAIL"}  ${name}${detail ? "  :: " + detail : ""}`);
}

async function open(browser, width, height, setup) {
  const ctx = await browser.newContext({
    viewport: { width, height },
    isMobile: width < 700,
    hasTouch: width < 700,
  });
  if (setup) await setup(ctx);
  const page = await ctx.newPage();
  await page.goto(BASE + "/membership/plans", { waitUntil: "domcontentloaded", timeout: 60000 });
  await page.waitForSelector(".plan-box", { timeout: 30000 });
  await page.waitForTimeout(2600);
  return { ctx, page };
}

/* Read the panel that is actually on screen. */
async function readActive(page) {
  return page.evaluate(() => {
    const active = document.querySelector(".plan-box__benefits.is-active");
    const tab = document.querySelector(".plan-box__tab.is-active");
    return {
      plan: tab ? tab.textContent.trim() : null,
      figure: document.querySelector(".plan-box__figure")?.textContent?.trim() || "",
      unit: document.querySelector(".plan-box__unit")?.textContent?.trim() || "",
      terms: document.querySelector(".plan-box__terms")?.innerText?.replace(/\s+/g, " ").trim() || "",
      popular: !!document.querySelector(".plan-box__popular"),
      rows: Array.from(active ? active.querySelectorAll(".plan-box__row") : []).map((li) => ({
        on: li.classList.contains("is-on"),
        name: li.querySelector(".plan-box__name")?.textContent?.trim() || "",
        detail: li.querySelector(".plan-box__detail")?.textContent?.trim() || null,
        hasCheck: !!li.querySelector("svg"),
        hasDash: !!li.querySelector(".plan-box__dash"),
      })),
      cta: document.querySelector(".plan-box__cta")?.textContent?.trim() || "",
      boxHeight: Math.round(document.querySelector(".plan-box").getBoundingClientRect().height),
      ctaTop: Math.round(document.querySelector(".plan-box__cta").getBoundingClientRect().top),
    };
  });
}

async function selectPlan(page, plan) {
  await page.click(`#plan-tab-${plan}`);
  await page.waitForTimeout(700);
}

async function selectCycle(page, cycle) {
  await page.click(`.plan-box__cycle:has-text("${cycle}")`);
  await page.waitForTimeout(700);
}

const asMember = (plan) => async (ctx) => {
  const SUB = {
    subscription: {
      subscriptionType: plan,
      status: "active",
      billingCycle: "monthly",
      addressId: "a1",
    },
  };
  // The welcome offer needs a real session; a stubbed account is never new. (Routes added later win, so 8c can override.)
  await ctx.route("**/api/stripe/checkout/welcome-offer**", (r) =>
    r.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ eligible: false, serverNow: new Date().toISOString(), percentOff: 20 }) })
  );
  await ctx.route("**/api/subscriptions/**", (r) =>
    r.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify(SUB) })
  );
  await ctx.route("**/api/auth/me", (r) =>
    r.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({
        _id: "m", name: "M", email: "m@e.com", role: "customer",
        addresses: [{ _id: "a1", label: "Home", line1: "1 Main St", city: "Babylon", state: "NY", zip: "11702", hasActiveSubscription: true }],
      }),
    })
  );
  await ctx.addInitScript(() => { try { localStorage.setItem("token", "t"); } catch {} });
};

/*
 * A registered non-member. Registration 2.0 lets an account exist with only
 * one verified identifier, and checkout asks for whatever contact is missing
 * (ContactCompletion) before it creates a Stripe session. `complete` is an
 * account with name, verified mobile and email: it goes straight to Stripe.
 * Without a phone, the contact sheet must come first and no checkout session
 * may be requested behind it.
 */
const asRegistered = (complete = true) => async (ctx) => {
  // The welcome offer needs a real session; a stubbed account is never new. (Routes added later win, so 8c can override.)
  await ctx.route("**/api/stripe/checkout/welcome-offer**", (r) =>
    r.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ eligible: false, serverNow: new Date().toISOString(), percentOff: 20 }) })
  );
  await ctx.route("**/api/subscriptions/**", (r) =>
    r.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ subscription: null }) })
  );
  await ctx.route("**/api/auth/me", (r) =>
    r.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({
        _id: "u", name: "U", email: "u@e.com", role: "customer",
        ...(complete ? { phone: "+16315550123", phoneVerified: true, emailVerified: true } : {}),
        addresses: [{ _id: "a1", label: "Home", line1: "1 Main St", city: "Babylon", state: "NY", zip: "11702", hasActiveSubscription: false }],
      }),
    })
  );
  await ctx.addInitScript(() => { try { localStorage.setItem("token", "t"); } catch {} });
};

(async () => {
  const browser = await chromium.launch();

  /* ============ 1. the matrix, every plan, every row ============ */
  {
    const { ctx, page } = await open(browser, 390, 844);

    check("one box, not four cards", (await page.$$(".plan-box")).length === 1, "");
    check("four tabs", (await page.$$(".plan-box__tab")).length === 4, "");
    check("opens on Plus", (await readActive(page)).plan.startsWith("Plus"), "");

    for (const plan of PLANS) {
      await selectPlan(page, plan);
      const m = await readActive(page);

      check(`${plan}: seven rows, always`, m.rows.length === 7, `${m.rows.length}`);
      check(
        `${plan}: monthly price is the catalog price`,
        m.figure === `$${CATALOG[plan].monthly}`,
        m.figure
      );
      check(`${plan}: price is per month`, m.unit === "/ month", m.unit);

      let onCount = 0;
      MATRIX.forEach((row, i) => {
        const actual = m.rows[i] || {};
        const shouldBeOn = !!row.on[plan];
        const expectedText = row.perPlan ? row.perPlan[plan] : row.text;
        if (shouldBeOn) onCount += 1;
        check(
          `${plan} row ${i + 1}: ${shouldBeOn ? "included" : "not included"}`,
          actual.on === shouldBeOn,
          `on=${actual.on}`
        );
        check(`${plan} row ${i + 1}: "${expectedText}"`, actual.name === expectedText, actual.name);
        check(
          `${plan} row ${i + 1}: ${shouldBeOn ? "a check" : "a dash"}`,
          shouldBeOn ? actual.hasCheck && !actual.hasDash : actual.hasDash && !actual.hasCheck,
          `check=${actual.hasCheck} dash=${actual.hasDash}`
        );
      });

      check(`${plan}: ${ON_COUNT[plan]} rows switched on`, onCount === ON_COUNT[plan], `${onCount}`);
      check(`${plan}: CTA names the plan`, m.cta === `Choose ${plan}`, m.cta);
      check(`${plan}: "Popular" shown only on Plus`, m.popular === (plan === "Plus"), `${m.popular}`);
    }

    /* Elite is the complete state: nothing greyed out. */
    await selectPlan(page, "Elite");
    const elite = await readActive(page);
    check("Elite has no muted rows at all", elite.rows.every((r) => r.on), "");
    check(
      "Elite says 1 Full Day / month, with the 8-hour line",
      elite.rows[5].name === "1 Full Day / month" &&
        /8 hours/.test(elite.rows[5].detail || ""),
      `${elite.rows[5].name} / ${elite.rows[5].detail}`
    );

    /* Basic must not be a wall of dashes with nothing of its own. */
    await selectPlan(page, "Basic");
    const basic = await readActive(page);
    check("Basic still shows three real benefits", basic.rows.filter((r) => r.on).length === 3, "");
    check("Basic books 1 at a time", basic.rows[2].name === "Book 1 visit at a time", basic.rows[2].name);

    await ctx.close();
  }

  /* ============ 2. wording rules that must never break ============ */
  {
    const { ctx, page } = await open(browser, 390, 844);
    const t = await page.evaluate(() => document.body.innerText.replace(/[’]/g, "'"));

    check("no 'visits per month' wording for standard visits", !/\d+\s+visits?\s+(per|a)\s+month/i.test(t), "");
    check("never 'unlimited visits'", !/unlimited visits/i.test(t), "");
    check("never 'no monthly visit limit'", !/no monthly visit limit/i.test(t), "");
    check("never the internal term 'active booking'", !/active booking/i.test(t), "");
    check("the approved allowance sentence is present once", (t.match(/no monthly visit allowance/gi) || []).length === 1, "");
    check("Priority Visit kept, never renamed 'Emergency'", /Priority Visit/.test(t) && !/emergency visit/i.test(t), "");
    check("'Small supplies', never 'Basic supplies'", /Small supplies included/.test(t) && !/Basic supplies/i.test(t), "");
    check("gift popup does not cover the buying page", !(await page.$('[aria-labelledby="promotion-popup-title"]')), "");
    check("free visit still reachable, quietly (a to-do list visit since 2026-10-30)", /take a look at your to-do list/i.test(t) && !/90-minute visit is free/i.test(t), "");
    check("loyalty still present", /loyalty benefits/i.test(t), "");

    /* Nothing may ever be marked with a cross, in any plan. */
    const crosses = await page.evaluate(() =>
      Array.from(document.querySelectorAll(".plan-box__row")).filter((li) =>
        /[✕✖❌×x]/.test(li.querySelector(".plan-box__mark")?.textContent || "")
      ).length
    );
    check("no crosses anywhere, on any plan", crosses === 0, `${crosses}`);

    const reds = await page.evaluate(() =>
      Array.from(document.querySelectorAll(".plan-box__row.is-off")).filter((li) => {
        const c = getComputedStyle(li.querySelector(".plan-box__name")).color;
        const m = c.match(/\d+/g);
        return m && Number(m[0]) > 150 && Number(m[1]) < 90 && Number(m[2]) < 90;
      }).length
    );
    check("muted rows are grey, never red", reds === 0, `${reds}`);
    await ctx.close();
  }

  /* ============ 3. the box never moves ============ */
  for (const w of [320, 360, 375, 390, 430, 1440]) {
    const { ctx, page } = await open(browser, w, w < 700 ? 844 : 900);
    const heights = [];
    const ctaTops = [];
    for (const plan of PLANS) {
      await selectPlan(page, plan);
      const m = await readActive(page);
      heights.push(m.boxHeight);
      ctaTops.push(m.ctaTop);
    }
    check(
      `${w}px: the box is the same height on all four plans`,
      new Set(heights).size === 1,
      heights.join(" / ")
    );
    check(
      `${w}px: the CTA never moves when the plan changes`,
      new Set(ctaTops).size === 1,
      ctaTops.join(" / ")
    );

    // And the cycle toggle must not shift it either.
    await selectPlan(page, "Plus");
    const monthly = await readActive(page);
    await selectCycle(page, "Annual");
    const annual = await readActive(page);
    check(
      `${w}px: Monthly <-> Annual does not move the CTA`,
      Math.abs(monthly.ctaTop - annual.ctaTop) <= 1,
      `${monthly.ctaTop} vs ${annual.ctaTop}`
    );
    await ctx.close();
  }

  /* ============ 4. annual pricing ============ */
  {
    const { ctx, page } = await open(browser, 390, 844);
    await selectCycle(page, "Annual");

    for (const plan of PLANS) {
      await selectPlan(page, plan);
      const m = await readActive(page);
      const expected = `$${CATALOG[plan].annual.toLocaleString("en-US")}`;
      check(`${plan}: annual price is the real charge (${expected})`, m.figure === expected, m.figure);
      check(`${plan}: annual price is labelled per year`, m.unit === "/ year", m.unit);
      check(
        `${plan}: the annual deal is stated plainly`,
        /Pay for 10 months, get 12/.test(m.terms),
        m.terms
      );
      /*
       * CX 4.2: no "about $X a month" under an annual price - the owner's brief
       * is that a yearly charge must never read as a monthly one. The terms say
       * how it is billed instead.
       */
      const perMonth = Math.round(CATALOG[plan].annual / 12);
      check(
        `${plan}: annual terms say billed once a year, with no per-month figure`,
        /Billed once a year/.test(m.terms) && !m.terms.includes(`$${perMonth}`),
        m.terms
      );
    }

    check("Elite annual is 4,990, never 4,999",
      !(await page.evaluate(() => document.body.innerText.includes("4,999"))), "");

    /* "Cancel anytime" is true month-to-month and NOT true of a prepaid year. */
    const annualText = await page.evaluate(() => document.querySelector(".plan-box").innerText);
    check("annual never claims 'Cancel anytime'", !/cancel anytime/i.test(annualText), "");

    await selectCycle(page, "Monthly");
    const monthlyText = await page.evaluate(() => document.querySelector(".plan-box").innerText);
    check("monthly does say 'Cancel anytime'", /cancel anytime/i.test(monthlyText), "");

    /* The Full Day is monthly on BOTH cycles now the backend grants it monthly. */
    await selectCycle(page, "Annual");
    await selectPlan(page, "Elite");
    const eliteAnnual = await readActive(page);
    check(
      "annual Elite still gets 1 Full Day / month",
      eliteAnnual.rows[5].name === "1 Full Day / month",
      eliteAnnual.rows[5].name
    );
    if (SHOTS) await page.screenshot({ path: `${SHOTS}/sel-annual-elite-390.png`, fullPage: true });
    await ctx.close();
  }

  /* ============ 5. keyboard ============ */
  {
    const { ctx, page } = await open(browser, 1280, 900);
    await page.focus("#plan-tab-Plus");
    await page.keyboard.press("ArrowRight");
    await page.waitForTimeout(500);
    check("ArrowRight moves to Premium", (await readActive(page)).plan.startsWith("Premium"), "");
    await page.keyboard.press("End");
    await page.waitForTimeout(500);
    check("End jumps to Elite", (await readActive(page)).plan.startsWith("Elite"), "");
    await page.keyboard.press("Home");
    await page.waitForTimeout(500);
    check("Home jumps to Basic", (await readActive(page)).plan.startsWith("Basic"), "");
    await ctx.close();
  }

  /* ============ 6. desktop keeps ONE box ============ */
  for (const w of [1024, 1440, 1920]) {
    const { ctx, page } = await open(browser, w, 900);
    const d = await page.evaluate(() => ({
      boxes: document.querySelectorAll(".plan-box").length,
      tabs: document.querySelectorAll(".plan-box__tab").length,
      ctas: document.querySelectorAll(".plan-box__cta").length,
      width: Math.round(document.querySelector(".plan-box").getBoundingClientRect().width),
    }));
    check(`${w}px: still exactly one box`, d.boxes === 1, `${d.boxes}`);
    check(`${w}px: still one CTA, not four`, d.ctas === 1, `${d.ctas}`);
    check(`${w}px: still four tabs`, d.tabs === 4, `${d.tabs}`);
    // Desktop zoom grows with the screen (app/site-scale.css), so "focused" is a share of it, not a fixed pixel cap.
    check(`${w}px: the box stays focused, not full-bleed`, d.width <= Math.max(640, w * 0.4), `${d.width}`);
    await ctx.close();
  }

  /*
   * ============ 7. book first (2026-11-03): signed out -> the booking flow, plan preserved ============
   * Somebody without a membership describes the job and picks a held time
   * before paying (Book a Handyman, membership); signing in comes inside that
   * flow. The plan and cycle chosen here come along.
   */
  {
    const { ctx, page } = await open(browser, 390, 844);
    await selectPlan(page, "Elite");
    await page.click(".plan-box__cta");
    await page.waitForURL(/\/book\/handyman/, { timeout: 25000 });
    const url = new URL(page.url());
    check("signed out: Choose opens the booking flow first", url.pathname === "/book/handyman", page.url());
    check("signed out: the chosen plan and cycle survive the redirect", url.searchParams.get("membership") === "elite" && url.searchParams.get("cycle") === "monthly", page.url());
    await ctx.close();
  }

  /* ============ 8. book first: a registered non-member books the visit before Stripe ============ */
  {
    const { ctx, page } = await open(browser, 390, 844, asRegistered(true));
    let checkoutBody = null;
    await ctx.route("**/api/stripe/checkout/create-checkout-session", (r) => {
      try { checkoutBody = JSON.parse(r.request().postData() || "{}"); } catch { checkoutBody = {}; }
      r.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({ url: BASE + "/membership/plans?canceled=true" }),
      });
    });

    await selectPlan(page, "Premium");
    check("registered non-member: CTA names the plan", (await readActive(page)).cta === "Choose Premium", "");
    await page.click(".plan-box__cta");
    await page.waitForURL(/\/book\/handyman/, { timeout: 25000 });
    const url = new URL(page.url());
    check("registered non-member: Choose opens the booking flow with the plan", url.searchParams.get("membership") === "premium", page.url());
    check("registered non-member: no checkout from the plans page before the visit is booked", !checkoutBody, JSON.stringify(checkoutBody || {}).slice(0, 120));
    await ctx.close();
  }

  /* ============ 8b. guard: a non-member without a phone is not sent to Stripe from here ============ */
  {
    const { ctx, page } = await open(browser, 390, 844, asRegistered(false));
    let requested = false;
    await ctx.route("**/api/stripe/checkout/create-checkout-session", (r) => {
      requested = true;
      r.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ url: BASE + "/membership/plans?canceled=true" }) });
    });
    await selectPlan(page, "Plus");
    check("no phone on file: CTA still names the plan", (await readActive(page)).cta === "Choose Plus", "");
    await page.click(".plan-box__cta");
    await page.waitForURL(/\/book\/handyman/, { timeout: 25000 });
    // The booking flow asks for missing contact details before its own checkout (test_home_booking_ui / test_cx4_ui).
    check("no phone on file: the booking flow opens, with the plan", new URL(page.url()).searchParams.get("membership") === "plus", page.url());
    check("no phone on file: no checkout session from the plans page", !requested, "");
    await ctx.close();
  }

  /* ============ 8c. CX 4.2: the welcome offer, the annual comparison, the CTA reach ============ */
  {
    const WELCOME = {
      basic: { monthlyCents: 14900, firstMonthCents: 11920, annualCents: 149000, firstYearCents: 119200 },
      plus: { monthlyCents: 24900, firstMonthCents: 19920, annualCents: 249000, firstYearCents: 199200 },
      premium: { monthlyCents: 34900, firstMonthCents: 27920, annualCents: 349000, firstYearCents: 279200 },
      elite: { monthlyCents: 49900, firstMonthCents: 39920, annualCents: 499000, firstYearCents: 399200 },
    };
    const offerState = { eligible: true, asks: 0, bodies: [], refuse: false };
    const { ctx, page } = await open(browser, 390, 844, async (c) => {
      await asRegistered(true)(c);
      await c.route("**/api/stripe/checkout/welcome-offer**", (r) => {
        offerState.asks += 1;
        const body = offerState.eligible
          ? { eligible: true, serverNow: new Date().toISOString(), expiresAt: new Date(Date.now() + 7 * 60000).toISOString(), percentOff: 20, plans: WELCOME }
          : { eligible: false, serverNow: new Date().toISOString(), percentOff: 20 };
        r.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify(body) });
      });
      await c.route("**/api/stripe/checkout/create-checkout-session", (r) => {
        const body = JSON.parse(r.request().postData() || "{}");
        offerState.bodies.push(body);
        if (offerState.refuse) {
          offerState.refuse = false;
          offerState.eligible = false;
          return r.fulfill({ status: 409, contentType: "application/json", body: JSON.stringify({ code: "WELCOME_OFFER_ENDED", message: "The welcome offer has ended. The prices shown now are the regular monthly prices." }) });
        }
        r.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ url: BASE + "/membership/plans?canceled=true" }) });
      });
    });
    await page.waitForSelector("[data-welcome-offer]", { timeout: 10000 }).catch(() => {});
    let m = await readActive(page);
    check("welcome: eligible new customer sees the offer and its countdown", (await page.locator("[data-welcome-offer]").count()) === 1 && /^[0-9]:\d\d$/.test(await page.locator("[data-welcome-countdown]").innerText()), "");
    check("welcome: Plus shows $199.20 first month", m.figure === "$199.20" && m.unit === "first month", `${m.figure} ${m.unit}`);
    check("welcome: the regular $249 is struck through above it", (await page.locator("[data-welcome-regular] s").innerText()) === "$249", "");
    check("welcome: renewal price and taxes named", /Then \$249\/month afterward, plus applicable taxes/.test(m.terms), m.terms);
    await selectPlan(page, "Elite");
    m = await readActive(page);
    check("welcome: Elite shows $399.20 first month", m.figure === "$399.20", m.figure);
    await selectCycle(page, "Annual");
    m = await readActive(page);
    check("welcome: annual Elite is 20% off the first year ($4,990 -> $3,992)", m.figure === "$3,992" && m.unit === "first year" && (await page.locator("[data-welcome-regular] s").innerText()) === "$4,990", `${m.figure} ${m.unit}`);
    check("welcome: annual still says pay for 10 get 12, billed once a year, renewal named", /Pay for 10 months, get 12/.test(m.terms) && /Then \$4,990\/year afterward, billed once a year, plus applicable taxes/.test(m.terms), m.terms);
    // Book first: the annual Elite choice goes to the booking flow, which shows the same offer and asks for it at its checkout (test_home_booking_ui).
    await page.click(".plan-box__cta");
    await page.waitForURL(/\/book\/handyman/, { timeout: 25000 });
    const handoff = new URL(page.url());
    check("welcome: the annual Elite choice is carried into the booking flow", handoff.searchParams.get("membership") === "elite" && handoff.searchParams.get("cycle") === "annual", page.url());
    check("welcome: no checkout opened from the plans page", offerState.bodies.length === 0, JSON.stringify(offerState.bodies[0] || {}));
    await ctx.close();
  }
  {
    // Signed out: never an offer; the annual comparison; the CTA within the first phone screen.
    const { ctx, page } = await open(browser, 360, 640);
    check("signed out: no welcome offer", (await page.locator("[data-welcome-offer]").count()) === 0, "");
    const reach = await page.evaluate(() => Math.round(document.querySelector(".plan-box__cta").getBoundingClientRect().bottom + scrollY));
    check("360x640: Choose is on the first screen", reach <= 640, `${reach}`);
    await selectCycle(page, "Annual");
    for (const plan of PLANS) {
      await selectPlan(page, plan);
      const m = await readActive(page);
      const regular = (await page.locator("[data-annual-regular] s").innerText()).trim();
      check(`annual ${plan}: 12-month total struck, 10-month total charged, billed yearly`, regular === `$${(CATALOG[plan].monthly * 12).toLocaleString("en-US")}` && m.figure === `$${CATALOG[plan].annual.toLocaleString("en-US")}` && m.unit === "/ year" && /Pay for 10 months, get 12/.test(m.terms) && /Billed once a year/.test(m.terms) && !/a month/.test(m.terms), `${regular} ${m.figure} ${m.terms}`);
    }
    await ctx.close();
  }

  /* ============ 8d. Halloween campaign: landing page, activation once signed in ============ */
  {
    const { ctx, page } = await open(browser, 390, 844);
    await page.goto(BASE + "/halloween?c=sms", { waitUntil: "domcontentloaded" });
    await page.waitForSelector("[data-halloween]", { timeout: 20000 });
    await page.waitForTimeout(1200);
    const text = await page.locator("[data-halloween]").innerText();
    // The campaign ended 2026-11-03 04:59:59Z: from then on the page says so and offers nothing (app/halloween/page.tsx).
    if (Date.now() > Date.parse("2026-11-03T04:59:59Z")) {
      check("halloween (after the end): the page says the offer has ended and offers no claim", (await page.locator("[data-campaign-ended]").count()) === 1 && (await page.locator("[data-action='claim-halloween']").count()) === 0, text.slice(0, 160));
      check("halloween (after the end): no offer prices, terms or 20% headline", (await page.locator("[data-halloween-prices]").count()) === 0 && (await page.locator("[data-halloween-terms]").count()) === 0 && !/20% off/i.test(await page.locator("h1").innerText()), "");
      // An old campaign link to the plans page shows the regular page: no Halloween note, regular prices.
      await page.goto(BASE + "/membership/plans?offer=halloween", { waitUntil: "domcontentloaded" });
      await page.waitForSelector(".plan-box", { timeout: 20000 });
      await page.waitForTimeout(1200);
      check("halloween (after the end): an old link to the plans page shows no Halloween offer", (await page.locator("[data-campaign-note]").count()) === 0 && !/Halloween/i.test(await page.locator(".plan-box").innerText()), "");
      await ctx.close();
    } else {
    check("halloween: the landing page states the offer and its terms", /20% off your first membership payment/i.test(text) && /renewals are at the regular price/i.test(text) && /through November 2, 2026/.test(text) && /timer starts when you open the offer/i.test(text), "");
    const prices = await page.locator("[data-halloween-prices]").innerText();
    check("halloween: every plan priced, monthly and annual, from the live prices", /\$149\s*\$119\.20/.test(prices) && /\$499\s*\$399\.20/.test(prices) && /\$1,490\s*\$1,192/.test(prices) && /\$4,990\s*\$3,992/.test(prices), prices.replace(/\s+/g, " "));
    check("halloween: signed out, an existing customer can sign in", (await page.getAttribute("[data-action='signin-halloween']", "href")) === "/signin?next=%2Fmembership%2Fplans%3Foffer%3Dhalloween");
    await page.waitForTimeout(4000); // the gift popup's own delay, so its absence is real
    check("halloween: no gift popup on top of the campaign page", (await page.locator("#promotion-popup-title").count()) === 0, "");
    check("halloween: the page is kept out of search", (await page.locator('meta[name="robots"]').getAttribute("content").catch(() => "")).includes("noindex"), "");
    await page.click("[data-action='claim-halloween']");
    await page.waitForURL(/\/membership\/plans\?offer=halloween/, { timeout: 15000 });
    await page.waitForSelector(".plan-box", { timeout: 20000 });
    await page.waitForTimeout(1500);
    check("halloween: signed out on the plans page, the offer is explained (no timer yet)", (await page.locator("[data-campaign-note]").count()) === 1 && (await page.locator("[data-welcome-offer]").count()) === 0, "");
    await ctx.close();
    }
  }
  if (Date.now() > Date.parse("2026-11-03T04:59:59Z")) {
    // After the end: a remembered Halloween campaign opens nothing.
    const activations = [];
    const { ctx, page } = await open(browser, 390, 844, async (c) => {
      await asRegistered(true)(c);
      await c.route("**/api/stripe/checkout/welcome-offer/activate", (r) => {
        activations.push(JSON.parse(r.request().postData() || "{}"));
        r.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ eligible: false, serverNow: new Date().toISOString(), percentOff: 20 }) });
      });
      await c.addInitScript(() => { try { sessionStorage.setItem("pf_offer_campaign", "halloween-2026"); } catch {} });
    });
    await page.waitForTimeout(2500);
    check("halloween (after the end): a remembered campaign asks the server for nothing", activations.length === 0, JSON.stringify(activations));
    await ctx.close();
  } else {
    const activations = [];
    const { ctx, page } = await open(browser, 390, 844, async (c) => {
      await asRegistered(true)(c);
      const expiresAt = new Date(Date.now() + 10 * 60000).toISOString();
      await c.route("**/api/stripe/checkout/welcome-offer/activate", (r) => {
        activations.push(JSON.parse(r.request().postData() || "{}"));
        r.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ eligible: true, serverNow: new Date().toISOString(), expiresAt, percentOff: 20, label: "Halloween Offer", plans: { basic: { monthlyCents: 14900, firstMonthCents: 11920, annualCents: 149000, firstYearCents: 119200 }, plus: { monthlyCents: 24900, firstMonthCents: 19920, annualCents: 249000, firstYearCents: 199200 }, premium: { monthlyCents: 34900, firstMonthCents: 27920, annualCents: 349000, firstYearCents: 279200 }, elite: { monthlyCents: 49900, firstMonthCents: 39920, annualCents: 499000, firstYearCents: 399200 } } }) });
      });
      await c.addInitScript(() => { try { sessionStorage.setItem("pf_offer_campaign", "halloween-2026"); } catch {} });
    });
    await page.waitForSelector("[data-welcome-offer]", { timeout: 15000 }).catch(() => {});
    check("halloween: a signed-in customer who came through the campaign has it opened by the server", activations.length >= 1 && activations[0].campaign === "halloween-2026", JSON.stringify(activations[0] || {}));
    check("halloween: banner says Halloween Offer, first payment, monthly or annual", /Halloween Offer .* 20% Off Your First Payment/.test(await page.locator("[data-welcome-offer]").innerText().catch(() => "")) && /monthly or annual/.test(await page.locator("[data-welcome-offer]").innerText().catch(() => "")), "");
    check("halloween: Plus at $199.20 first month", (await readActive(page)).figure === "$199.20", (await readActive(page)).figure);
    await ctx.close();
  }

  /* ============ 9. guard: member plan-change logic untouched ============ */
  for (const plan of ["Basic", "Plus", "Elite"]) {
    const { ctx, page } = await open(browser, 390, 844, asMember(plan));
    const labels = [];
    for (const target of PLANS) {
      await selectPlan(page, target);
      const m = await readActive(page);
      labels.push(`${target}:${m.cta}`);
    }
    /*
     * We deliberately do not assert WHICH labels a member sees - that logic is
     * untouched and depends on subscription data a stub cannot fully supply.
     * What must hold is that a member is never shown four plain fresh-purchase
     * buttons, which would mean the member path had been bypassed.
     */
    const allFreshPurchase = labels.every((l) => /:Choose /.test(l));
    check(`member on ${plan}: not offered four fresh-purchase buttons`, !allFreshPurchase, labels.join(" | "));
    await ctx.close();
  }

  /* ============ 10. responsive hygiene ============ */
  for (const w of WIDTHS) {
    const { ctx, page } = await open(browser, w, w < 700 ? 844 : 900);
    const m = await page.evaluate(() => {
      const box = document.querySelector(".plan-box");
      const tabs = Array.from(document.querySelectorAll(".plan-box__tab"));
      return {
        vw: innerWidth,
        scrollW: document.documentElement.scrollWidth,
        tabsScroll: document.querySelector(".plan-box__tabs").scrollWidth >
          document.querySelector(".plan-box__tabs").clientWidth + 1,
        smallTaps: tabs.filter((t) => t.getBoundingClientRect().height < 32).length,
        ctaH: Math.round(document.querySelector(".plan-box__cta").getBoundingClientRect().height),
        spill: box.getBoundingClientRect().right > innerWidth + 1,
        tiny: Array.from(document.querySelectorAll(".plan-box__name, .plan-box__detail")).filter(
          (e) => parseFloat(getComputedStyle(e).fontSize) < 12.5
        ).length,
        figure: parseFloat(getComputedStyle(document.querySelector(".plan-box__figure")).fontSize),
      };
    });
    check(`${w}px: no horizontal page overflow`, m.scrollW <= m.vw + 1, `${m.scrollW}/${m.vw}`);
    check(`${w}px: the box fits the viewport`, !m.spill, "");
    check(`${w}px: the tab strip never scrolls sideways`, !m.tabsScroll, "");
    check(`${w}px: tabs are at least 32px tall (compact scale)`, m.smallTaps === 0, `${m.smallTaps}`);
    check(`${w}px: CTA is at least 40px tall (compact scale)`, m.ctaH >= 40, `${m.ctaH}`);
    check(`${w}px: no sub-12.5px benefit text`, m.tiny === 0, `${m.tiny}`);
    check(`${w}px: the price stays the biggest thing (>=44px)`, m.figure >= 44, `${m.figure}`);
    if (SHOTS && [320, 390, 430, 1440].includes(w)) {
      await page.screenshot({ path: `${SHOTS}/sel-${w}.png`, fullPage: true });
    }
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
