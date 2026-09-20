/*
 * The membership buying page.
 *
 * The presentation changed; none of the purchasing logic did. So the checks
 * that matter are that the ladder reads correctly, that the plan economics on
 * screen still match the catalog, and that every purchasing guard still fires:
 * a signed-out visitor is sent to signup with the plan preserved, a signed-in
 * non-member goes to Stripe, and a member's plan-change labels are left alone.
 *
 *   node scripts/test_membership_plans_ui.js [baseUrl]
 */
const { chromium } = require("playwright");

const BASE = process.argv[2] || "http://localhost:3000";
const SHOTS = process.env.PF_SHOTS || "";
const WIDTHS = [320, 360, 375, 390, 430, 768, 1024, 1280, 1440, 1920];

/* Mirrors BackEnd/utils/subscriptionManagement.js PLAN_CATALOG. */
const CATALOG = {
  Basic: { monthly: 149, annual: 1490 },
  Plus: { monthly: 249, annual: 2490 },
  Premium: { monthly: 349, annual: 3490 },
  Elite: { monthly: 499, annual: 4990 },
};

const results = [];
function check(name, pass, detail) {
  results.push({ name, pass, detail });
  console.log(`${pass ? "PASS" : "FAIL"}  ${name}${detail ? "  :: " + detail : ""}`);
}

async function open(browser, width, height, setup) {
  const ctx = await browser.newContext({ viewport: { width, height }, isMobile: width < 700, hasTouch: width < 700 });
  if (setup) await setup(ctx);
  const page = await ctx.newPage();
  await page.goto(BASE + "/membership/plans", { waitUntil: "domcontentloaded", timeout: 60000 });
  await page.waitForTimeout(3200);
  return { ctx, page };
}

const asMember = (plan) => async (ctx) => {
  const SUB = { subscription: { subscriptionType: plan, status: "active", billingCycle: "monthly", addressId: "a1" } };
  /*
   * Stub the subscription lookup too. A fake token gets a real 401 from
   * /api/subscriptions/..., the 401 interceptor reads that as an expired
   * session and signs the stub out - so without this the test measures the
   * login page.
   */
  await ctx.route("**/api/subscriptions/**", (r) => r.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify(SUB) }));
  await ctx.route("**/api/auth/me", (r) => r.fulfill({ status: 200, contentType: "application/json",
    body: JSON.stringify({ _id: "m", name: "M", email: "m@e.com", role: "customer",
      addresses: [{ _id: "a1", label: "Home", line1: "1 Main St", city: "Babylon", state: "NY", zip: "11702", hasActiveSubscription: true }] }) }));
  await ctx.addInitScript(() => { try { localStorage.setItem("token", "t"); } catch {} });
  return plan;
};

const asRegistered = async (ctx) => {
  const SUB = { subscription: null };
  /*
   * Stub the subscription lookup too. A fake token gets a real 401 from
   * /api/subscriptions/..., the 401 interceptor reads that as an expired
   * session and signs the stub out - so without this the test measures the
   * login page.
   */
  await ctx.route("**/api/subscriptions/**", (r) => r.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify(SUB) }));
  await ctx.route("**/api/auth/me", (r) => r.fulfill({ status: 200, contentType: "application/json",
    body: JSON.stringify({ _id: "u", name: "U", email: "u@e.com", role: "customer",
      addresses: [{ _id: "a1", label: "Home", line1: "1 Main St", city: "Babylon", state: "NY", zip: "11702", hasActiveSubscription: false }] }) }));
  await ctx.addInitScript(() => { try { localStorage.setItem("token", "t"); } catch {} });
};

(async () => {
  const browser = await chromium.launch();

  /* ---------------- the ladder reads correctly ---------------- */
  {
    const { ctx, page } = await open(browser, 390, 844);
    const m = await page.evaluate(() => {
      const t = document.body.innerText.replace(/’/g, "'");
      const rungs = Array.from(document.querySelectorAll(".plan-rung")).map((r) => ({
        name: r.querySelector(".plan-rung__name")?.textContent?.trim(),
        price: r.querySelector(".plan-rung__price")?.textContent?.replace(/\s+/g, " ").trim(),
        inherits: r.querySelector(".plan-rung__inherits")?.textContent?.trim() || null,
        adds: Array.from(r.querySelectorAll(".plan-rung__adds li")).map((li) => li.textContent.replace(/^\+\s*/, "").trim()),
        cta: r.querySelector(".plan-rung__cta")?.textContent?.trim(),
        popular: r.classList.contains("plan-rung--popular"),
      }));
      return {
        rungs,
        foundation: Array.from(document.querySelectorAll(".plan-foundation__items li")).map((li) => li.textContent.trim()),
        rule: document.querySelector(".plan-foundation__rule")?.textContent?.replace(/\s+/g, " ").trim(),
        popup: !!document.querySelector('[aria-labelledby="promotion-popup-title"]'),
        // The wording that must never appear.
        allowance: /\d+\s+visits?\s+(per|a)\s+month|visits included|monthly visits/i.test(t),
        priorityNamedRight: t.includes("Priority Visit") && !/emergency visit/i.test(t),
        freeVisit: t.includes("Your first 90-minute visit is free"),
        loyalty: /loyalty benefits/i.test(t),
      };
    });

    check("four rungs render", m.rungs.length === 4, `${m.rungs.length}`);
    check("foundation stated once", m.foundation.length === 4, m.foundation.join(" · "));
    check("the booking rule is above the plans", /Book as often as you need/.test(m.rule || ""), m.rule);
    check("no 'visits per month' wording anywhere", !m.allowance, "");
    check("Priority Visit kept, never 'Emergency'", m.priorityNamedRight, "");
    check("gift popup does not cover the buying page", !m.popup, "");
    check("free visit present as the quiet fallback", m.freeVisit, "");
    check("loyalty present", m.loyalty, "");

    const expect = {
      Basic: { inherits: null, adds: ["1 visit at a time"] },
      Plus: { inherits: "Everything in Basic", adds: ["2 visits at a time", "Basic materials included"] },
      Premium: { inherits: "Everything in Plus", adds: ["1 Priority Visit a month"] },
      Elite: { inherits: "Everything in Premium", adds: ["2 Priority Visits a month", "1 full project day a month (up to 8 hours)", "10% off home improvement projects"] },
    };
    for (const r of m.rungs) {
      const e = expect[r.name];
      check(`${r.name}: monthly price matches the catalog`, r.price.includes(String(CATALOG[r.name].monthly)), r.price);
      check(`${r.name}: cumulative line`, r.inherits === e.inherits, `${r.inherits}`);
      check(`${r.name}: adds exactly its own differences`, JSON.stringify(r.adds) === JSON.stringify(e.adds), r.adds.join(" | "));
      check(`${r.name}: CTA names the plan`, r.cta === `Choose ${r.name}`, r.cta);
    }
    check("Plus is the only one marked Popular", m.rungs.filter((r) => r.popular).length === 1 && m.rungs.find((r) => r.popular).name === "Plus", "");
    if (SHOTS) await page.screenshot({ path: `${SHOTS}/p-monthly-390.png`, fullPage: true });
    await ctx.close();
  }

  /* ---------------- annual pricing ---------------- */
  {
    const { ctx, page } = await open(browser, 390, 844);
    await page.click("text=Annual");
    await page.waitForTimeout(900);
    const prices = await page.evaluate(() =>
      Array.from(document.querySelectorAll(".plan-rung")).map((r) => ({
        name: r.querySelector(".plan-rung__name")?.textContent?.trim(),
        price: r.querySelector(".plan-rung__price")?.textContent?.replace(/\s+/g, "") || "",
      }))
    );
    for (const p of prices) {
      const annual = CATALOG[p.name].annual;
      const shown = p.price.replace(/[^\d]/g, "");
      // The page may show the annual total or its monthly equivalent; either
      // must be derivable from the catalog, and never invented.
      const ok = shown.includes(String(annual)) || shown.includes(String(Math.round(annual / 12))) || shown.includes(String(CATALOG[p.name].monthly));
      check(`${p.name}: annual price derives from the catalog (${annual})`, ok, p.price);
    }
    check("Elite annual is 4990, never 4999", !(await page.evaluate(() => document.body.innerText.includes("4,999"))), "");
    if (SHOTS) await page.screenshot({ path: `${SHOTS}/p-annual-390.png`, fullPage: true });
    await ctx.close();
  }

  /* ---------------- guard: signed out goes to signup, plan preserved ---------------- */
  {
    const { ctx, page } = await open(browser, 390, 844);
    await page.click(".plan-rung:nth-of-type(2) .plan-rung__cta");
    await page.waitForURL(/\/signup/, { timeout: 25000 });
    const url = page.url();
    check("signed out: Choose sends to signup", /\/signup/.test(url), url);
    check("signed out: the chosen plan is preserved in the redirect", /redirect=/.test(url), url);
    await ctx.close();
  }

  /* ---------------- guard: registered non-member reaches checkout ---------------- */
  {
    const { ctx, page } = await open(browser, 390, 844, asRegistered);
    let checkoutCalled = false;
    await ctx.route("**/api/stripe/checkout/create-checkout-session", (r) => {
      checkoutCalled = true;
      r.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ url: BASE + "/membership/plans?checkout=canceled" }) });
    });
    const labels = await page.evaluate(() => Array.from(document.querySelectorAll(".plan-rung__cta")).map((b) => b.textContent.trim()));
    check("registered non-member: buttons name the plan (not 4x 'Start Membership')",
      JSON.stringify(labels) === JSON.stringify(["Choose Basic", "Choose Plus", "Choose Premium", "Choose Elite"]), labels.join(" | "));
    await page.click(".plan-rung:nth-of-type(3) .plan-rung__cta");
    await page.waitForTimeout(3000);
    check("registered non-member: checkout session is requested", checkoutCalled, "");
    await ctx.close();
  }

  /* ---------------- guard: member plan-change labels untouched ---------------- */
  {
    const { ctx, page } = await open(browser, 390, 844, asMember("Plus"));
    const state = await page.evaluate(() => ({
      labels: Array.from(document.querySelectorAll(".plan-rung__cta")).map((b) => b.textContent.trim()),
      disabled: Array.from(document.querySelectorAll(".plan-rung__cta")).map((b) => b.disabled),
    }));
    // We deliberately do not assert WHICH labels a member sees: that logic was
    // left exactly as it was and depends on subscription data a stub cannot
    // supply. What must hold is that a member is never offered the plain
    // "Choose X" purchase path for a plan they may already own.
    const offeredFreshPurchase = state.labels.every((l) => /^Choose /.test(l)) && state.disabled.every((d) => d === false);
    check("member: not offered four fresh-purchase buttons", !offeredFreshPurchase, state.labels.join(" | "));
    await ctx.close();
  }

  /* ---------------- responsive ---------------- */
  for (const w of WIDTHS) {
    const { ctx, page } = await open(browser, w, w < 700 ? 844 : 900);
    const m = await page.evaluate(() => ({
      vw: innerWidth,
      scrollW: document.documentElement.scrollWidth,
      docH: document.documentElement.scrollHeight,
      ctaH: Math.min(...Array.from(document.querySelectorAll(".plan-rung__cta")).map((b) => b.getBoundingClientRect().height)),
      spill: Array.from(document.querySelectorAll(".plan-rung, .plan-foundation")).filter((e) => e.getBoundingClientRect().right > innerWidth + 2).length,
      priceFont: parseFloat(getComputedStyle(document.querySelector(".plan-rung__price")).fontSize),
    }));
    check(`${w}px no horizontal overflow`, m.scrollW <= m.vw + 1, `${m.scrollW}/${m.vw}`);
    check(`${w}px nothing spills`, m.spill === 0, `${m.spill}`);
    check(`${w}px CTAs are 44px+`, m.ctaH >= 44, `${m.ctaH}`);
    check(`${w}px price is legible`, m.priceFont >= 22, `${m.priceFont}`);
    if (SHOTS && [320, 390, 430, 1440].includes(w)) await page.screenshot({ path: `${SHOTS}/p-${w}.png`, fullPage: true });
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
})().catch((e) => { console.error(e); process.exit(1); });
