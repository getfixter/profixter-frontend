/**
 * First Visit Free — mobile-first visual inspection.
 *
 * Drives the real logged-in journey at phone widths and captures screenshots.
 * Local only. Requires the local backend + frontend to be running.
 *
 *   node scripts/capture_free_visit_journey.js
 */

const { chromium, devices } = require("playwright");
const fs = require("fs");
const path = require("path");

const BASE = process.env.BASE_URL || "http://localhost:3000";
const OUT = path.join(__dirname, "..", "screenshots", "free-visit");

if (!/127\.0\.0\.1|localhost/.test(BASE)) {
  throw new Error("REFUSING TO RUN: BASE_URL must be local.");
}

const VIEWPORTS = [
  { name: "375-iphone-se", width: 375, height: 812, mobile: true },
  { name: "390-iphone-14", width: 390, height: 844, mobile: true },
  { name: "430-iphone-pro-max", width: 430, height: 932, mobile: true },
  { name: "1440-desktop", width: 1440, height: 900, mobile: false },
];

const ACCOUNTS = {
  free: { email: "new@fvftest.local", password: "TestPass123!" },
  member: { email: "member@fvftest.local", password: "TestPass123!" },
  consumed: { email: "legacy@fvftest.local", password: "TestPass123!" },
};

const findings = [];

function note(viewport, page, severity, text) {
  findings.push({ viewport, page, severity, text });
}

async function shot(page, viewport, name) {
  fs.mkdirSync(OUT, { recursive: true });
  const file = path.join(OUT, `${viewport}__${name}.png`);
  await page.screenshot({ path: file, fullPage: false });
  return file;
}

async function login(page, account) {
  await page.goto(`${BASE}/signin`, { waitUntil: "domcontentloaded" });
  await page.waitForTimeout(1200);
  const email = page.locator('input[type="email"], input[name="email"]').first();
  const pw = page.locator('input[type="password"]').first();
  await email.fill(account.email);
  await pw.fill(account.password);
  await page.locator('button[type="submit"]').first().click();
  await page.waitForTimeout(7500);
}

/** Measure tappable controls that fall below the 44px accessibility floor. */
async function auditTouchTargets(page) {
  return page.evaluate(() => {
    const bad = [];
    const els = document.querySelectorAll("button, a[href], [role='button'], input, select");
    els.forEach((el) => {
      const r = el.getBoundingClientRect();
      if (r.width === 0 || r.height === 0) return;
      const style = window.getComputedStyle(el);
      if (style.visibility === "hidden" || style.display === "none") return;
      if (r.height < 44) {
        const label = (el.innerText || el.getAttribute("aria-label") || el.tagName)
          .trim().slice(0, 45).replace(/\s+/g, " ");
        bad.push({ label, h: Math.round(r.height), w: Math.round(r.width) });
      }
    });
    return bad.slice(0, 14);
  });
}

/** Find text smaller than 12px, which reads as squinty on a phone. */
async function auditTinyText(page) {
  return page.evaluate(() => {
    const bad = [];
    document.querySelectorAll("*").forEach((el) => {
      if (!el.childNodes.length) return;
      const hasText = Array.from(el.childNodes).some(
        (n) => n.nodeType === 3 && n.textContent.trim().length > 3
      );
      if (!hasText) return;
      const size = parseFloat(window.getComputedStyle(el).fontSize);
      if (size && size < 12) {
        bad.push({
          size: Math.round(size * 10) / 10,
          text: el.innerText.trim().slice(0, 50).replace(/\s+/g, " "),
        });
      }
    });
    return bad.slice(0, 12);
  });
}

async function auditHorizontalScroll(page) {
  return page.evaluate(() => ({
    scrollW: document.documentElement.scrollWidth,
    clientW: document.documentElement.clientWidth,
    overflows: document.documentElement.scrollWidth > document.documentElement.clientWidth + 1,
  }));
}

async function run() {
  const browser = await chromium.launch();
  const results = [];

  for (const vp of VIEWPORTS) {
    const context = await browser.newContext({
      viewport: { width: vp.width, height: vp.height },
      deviceScaleFactor: 2,
      isMobile: vp.mobile,
      hasTouch: vp.mobile,
      userAgent: vp.mobile
        ? devices["iPhone 13"].userAgent
        : undefined,
    });
    const page = await context.newPage();
    page.on("pageerror", (e) => note(vp.name, "runtime", "error", `JS error: ${e.message.slice(0, 90)}`));

    console.log(`\n=== ${vp.name} (${vp.width}x${vp.height}) ===`);

    /* --- 1. signin --- */
    await page.goto(`${BASE}/signin`, { waitUntil: "domcontentloaded" });
    await page.waitForTimeout(1500);
    await shot(page, vp.name, "01-signin");
    let ov = await auditHorizontalScroll(page);
    if (ov.overflows) note(vp.name, "signin", "blocking", `horizontal overflow ${ov.scrollW}px > ${ov.clientW}px`);

    /* --- 2. eligible free-visit customer --- */
    await login(page, ACCOUNTS.free);
    await page.goto(`${BASE}/membership`, { waitUntil: "domcontentloaded" });
    await page.waitForTimeout(7000);
    await shot(page, vp.name, "02-membership-booking-top");

    const bodyText = await page.evaluate(() => document.body.innerText);
    const hasOffer = /first 90-minute handyman visit is on us/i.test(bodyText);
    const hasZero = /\$0 due for your first eligible visit/i.test(bodyText);
    const hasNoCard = /no credit card needed/i.test(bodyText);
    const hasDisclaimer = /one free visit per property/i.test(bodyText);
    console.log(`  offer headline: ${hasOffer} | $0: ${hasZero} | no-card: ${hasNoCard} | disclaimer: ${hasDisclaimer}`);
    if (!hasOffer) note(vp.name, "booking", "blocking", "First Visit Free headline not rendered for eligible customer");

    // How far down the page is the offer?
    const offerY = await page.evaluate(() => {
      const el = Array.from(document.querySelectorAll("div"))
        .find((d) => /first 90-minute handyman visit is on us/i.test(d.innerText || ""));
      if (!el) return null;
      return Math.round(el.getBoundingClientRect().top + window.scrollY);
    });
    if (offerY !== null) {
      console.log(`  offer appears at y=${offerY}px (viewport height ${vp.height})`);
      if (vp.mobile && offerY > vp.height * 1.5) {
        note(vp.name, "booking", "major", `First Visit Free offer sits ${offerY}px down — below the fold on a phone`);
      }
    }

    const touch = await auditTouchTargets(page);
    if (touch.length) {
      console.log(`  touch targets under 44px: ${touch.length}`);
      touch.slice(0, 6).forEach((t) => console.log(`     ${t.h}px  "${t.label}"`));
      if (vp.mobile) note(vp.name, "booking", "major", `${touch.length} tap targets under 44px (smallest ${Math.min(...touch.map((t) => t.h))}px)`);
    }

    const tiny = await auditTinyText(page);
    if (tiny.length && vp.mobile) {
      console.log(`  text under 12px: ${tiny.length}`);
      tiny.slice(0, 5).forEach((t) => console.log(`     ${t.size}px  "${t.text}"`));
      note(vp.name, "booking", "major", `${tiny.length} text runs under 12px (smallest ${Math.min(...tiny.map((t) => t.size))}px)`);
    }

    ov = await auditHorizontalScroll(page);
    if (ov.overflows) note(vp.name, "booking", "blocking", `horizontal overflow ${ov.scrollW}px > ${ov.clientW}px`);

    // Scroll to the calendar and capture it.
    await page.evaluate(() => {
      const el = document.getElementById("pick-day") || document.querySelector("[class*='calendar']");
      if (el) el.scrollIntoView({ block: "start" });
      else window.scrollTo(0, 900);
    });
    await page.waitForTimeout(1800);
    await shot(page, vp.name, "03-calendar");

    await page.evaluate(() => window.scrollBy(0, 700));
    await page.waitForTimeout(1200);
    await shot(page, vp.name, "04-calendar-times");

    /* --- 3. consumed customer: membership CTA --- */
    await page.goto(`${BASE}/account`, { waitUntil: "domcontentloaded" }).catch(() => {});
    await page.context().clearCookies();
    await page.evaluate(() => { localStorage.clear(); sessionStorage.clear(); }).catch(() => {});
    await login(page, ACCOUNTS.consumed);
    await page.goto(`${BASE}/membership`, { waitUntil: "domcontentloaded" });
    await page.waitForTimeout(4000);
    await shot(page, vp.name, "05-consumed-membership-cta");
    const consumedText = await page.evaluate(() => document.body.innerText);
    const hasKeep = /keep the same team/i.test(consumedText);
    const hasPlansCta = /see membership plans/i.test(consumedText);
    console.log(`  post-visit CTA: keep="${hasKeep}" plansCta="${hasPlansCta}"`);
    if (!hasKeep) note(vp.name, "post-visit", "major", "membership continuation state not shown to consumed customer");

    /* --- 4. member regression --- */
    await page.context().clearCookies();
    await page.evaluate(() => { localStorage.clear(); sessionStorage.clear(); }).catch(() => {});
    await login(page, ACCOUNTS.member);
    await page.goto(`${BASE}/membership`, { waitUntil: "domcontentloaded" });
    await page.waitForTimeout(4000);
    await shot(page, vp.name, "06-member-booking");
    const memberText = await page.evaluate(() => document.body.innerText);
    const memberSeesOffer = /first visit free|visit is on us|\$0 due/i.test(memberText);
    console.log(`  member sees acquisition messaging: ${memberSeesOffer}`);
    if (memberSeesOffer) note(vp.name, "member", "blocking", "MEMBER SEES FIRST VISIT FREE MESSAGING — regression");

    results.push({ viewport: vp.name, hasOffer, hasZero, hasNoCard, hasDisclaimer, offerY, touchIssues: touch.length, tinyText: tiny.length, memberSeesOffer });

    await context.close();
  }

  await browser.close();

  console.log("\n\n================ FINDINGS ================");
  if (!findings.length) console.log("No issues detected.");
  const bySeverity = { blocking: [], major: [], error: [] };
  findings.forEach((f) => (bySeverity[f.severity] = bySeverity[f.severity] || []).push(f));
  for (const sev of ["blocking", "error", "major"]) {
    (bySeverity[sev] || []).forEach((f) => console.log(`  [${sev.toUpperCase()}] ${f.viewport} / ${f.page}: ${f.text}`));
  }
  console.log("\nScreenshots written to screenshots/free-visit/");
  fs.writeFileSync(path.join(OUT, "summary.json"), JSON.stringify({ results, findings }, null, 2));
}

run().catch((e) => {
  console.error("CAPTURE FAILED:", e.message);
  process.exit(1);
});
