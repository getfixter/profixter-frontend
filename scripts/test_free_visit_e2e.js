/**
 * First Visit Free — end-to-end booking through the real UI.
 *
 * Drives a browser through the acquisition flow against the LOCAL stack and
 * asserts the booking completes with the free-visit confirmation.
 *
 *   BASE_URL=http://localhost:3000 node scripts/test_free_visit_e2e.js
 */

const { chromium } = require("playwright");
const path = require("path");

const BASE = process.env.BASE_URL || "http://localhost:3000";
const OUT = path.join(__dirname, "..", "screenshots", "free-visit");

if (!/localhost|127\.0\.0\.1/.test(BASE)) {
  throw new Error("REFUSING TO RUN: BASE_URL must be local.");
}

let passed = 0;
const failures = [];

function check(name, condition) {
  if (condition) {
    passed += 1;
    console.log(`  PASS  ${name}`);
  } else {
    failures.push(name);
    console.log(`  FAIL  ${name}`);
  }
}

async function login(page, email) {
  await page.goto(`${BASE}/signin`, { waitUntil: "domcontentloaded" });
  await page.waitForTimeout(4000);
  await page.locator('input[type="email"], input[name="email"]').first().fill(email);
  await page.locator('input[type="password"]').first().fill("TestPass123!");
  await page.locator('button[type="submit"]').first().click();
  await page.waitForTimeout(8000);
}

async function run() {
  const browser = await chromium.launch();
  const context = await browser.newContext({
    viewport: { width: 390, height: 844 },
    isMobile: true,
    hasTouch: true,
    deviceScaleFactor: 2,
  });
  const page = await context.newPage();
  const errors = [];
  page.on("pageerror", (e) => errors.push(e.message));

  console.log("\nFLOW A — eligible customer books the free visit");
  await login(page, "new@fvftest.local");
  await page.goto(`${BASE}/membership`, { waitUntil: "domcontentloaded" });
  await page.waitForTimeout(9000);

  let text = await page.evaluate(() => document.body.innerText);
  check("free-visit hero renders", /your first visit is free/i.test(text));
  check("terms line renders", /no card required/i.test(text));
  check("booking section renders", /book your visit/i.test(text));
  check("photos are marked required, not optional", !/photos \(optional\)/i.test(text));

  // Pick the first enabled future day in the calendar.
  const dayClicked = await page.evaluate(() => {
    const buttons = Array.from(document.querySelectorAll("button"));
    const day = buttons.find(
      (b) => /^\d{1,2}$/.test((b.innerText || "").trim()) && !b.disabled &&
        getComputedStyle(b).pointerEvents !== "none" &&
        b.className.includes("bg-[#EEF")
    );
    if (day) { day.click(); return day.innerText.trim(); }
    const any = buttons.find((b) => /^\d{1,2}$/.test((b.innerText || "").trim()) && !b.disabled);
    if (any) { any.click(); return any.innerText.trim(); }
    return null;
  });
  check("a calendar day is selectable", !!dayClicked);
  await page.waitForTimeout(3500);

  // Pick a time slot.
  const timeClicked = await page.evaluate(() => {
    // Slot buttons read like "8:00 AM\n1 left".
    const b = Array.from(document.querySelectorAll("button"))
      .find((x) => /^\d{1,2}:\d{2}\s?(AM|PM)\b/i.test((x.innerText || "").trim()) && !x.disabled);
    if (b) { b.click(); return b.innerText.trim(); }
    return null;
  });
  check("a time slot is selectable", !!timeClicked);
  await page.waitForTimeout(1500);

  // Describe the task.
  const ta = page.locator("textarea").first();
  await ta.fill("Bedroom door doesn't close correctly");
  await page.waitForTimeout(800);

  check("photo field is marked required", /photos\s*\*/i.test(await page.evaluate(() => document.body.innerText)));
  check(
    "photo requirement is explained before submitting",
    /so your technician can review the job/i.test(await page.evaluate(() => document.body.innerText))
  );
  await page.screenshot({ path: path.join(OUT, "E2E-01-form-no-photo.png") });

  // Attempt 1: submit WITHOUT a photo - must be blocked.
  await page.evaluate(() => {
    const b = Array.from(document.querySelectorAll("button"))
      .find((x) => /^book your visit$/i.test((x.innerText || "").trim()) && !x.disabled);
    if (b) b.click();
  });
  await page.waitForTimeout(4000);

  text = await page.evaluate(() => document.body.innerText);
  check("booking WITHOUT a photo is blocked", !/visit booked/i.test(text));
  check("photo validation error is shown", /add at least one photo/i.test(text));
  await page.screenshot({ path: path.join(OUT, "E2E-02-photo-required-error.png") });

  // Attempt 2: attach a photo, then submit - must succeed.
  const png = Buffer.from(
    "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==",
    "base64"
  );
  await page.setInputFiles('input[type="file"][multiple]', {
    name: "job.png", mimeType: "image/png", buffer: png,
  });
  await page.waitForTimeout(3500);

  text = await page.evaluate(() => document.body.innerText);
  check("photo preview appears after upload", /choose photos \(1\)/i.test(text));
  await page.screenshot({ path: path.join(OUT, "E2E-03-photo-attached.png") });

  await page.evaluate(() => {
    const b = Array.from(document.querySelectorAll("button"))
      .find((x) => /^book your visit$/i.test((x.innerText || "").trim()) && !x.disabled);
    if (b) b.click();
  });
  await page.waitForTimeout(11000);

  text = await page.evaluate(() => document.body.innerText);
  check("confirmation shows 'Visit booked'", /visit booked/i.test(text));
  check("confirmation shows free-visit line", /your first visit is on us/i.test(text));
  check("confirmation shows preparation note", /have the items you.{0,3}d like us to look at ready/i.test(text));
  check("confirmation has View My Visit", /view my visit/i.test(text));
  check("no celebratory emoji in confirmation", !/🎉|🎊|✅/.test(text));
  await page.screenshot({ path: path.join(OUT, "E2E-04-confirmation.png") });

  console.log("\nFLOW A2 — second free visit is blocked");
  await page.goto(`${BASE}/membership`, { waitUntil: "domcontentloaded" });
  await page.waitForTimeout(9000);
  text = await page.evaluate(() => document.body.innerText);
  check("eligible hero no longer shown after claiming", !/your first visit is free/i.test(text));

  console.log("\nFLOW E — member regression");
  await context.clearCookies();
  await page.evaluate(() => { localStorage.clear(); sessionStorage.clear(); }).catch(() => {});
  await login(page, "member@fvftest.local");
  await page.goto(`${BASE}/membership`, { waitUntil: "domcontentloaded" });
  await page.waitForTimeout(9000);
  text = await page.evaluate(() => document.body.innerText);
  check("member reaches normal booking", /book your visit/i.test(text));
  check("member sees NO free-visit hero", !/your first visit is free/i.test(text));
  check("member sees NO $0 messaging", !/\$0 due/i.test(text));
  check("member photos still required", !/photos \(optional\)/i.test(text));
  await page.screenshot({ path: path.join(OUT, "E2E-05-member.png") });

  check("no runtime JS errors", errors.length === 0);
  if (errors.length) errors.slice(0, 3).forEach((e) => console.log(`        ${e.slice(0, 110)}`));

  await browser.close();

  console.log(`\n${passed} passed, ${failures.length} failed\n`);
  if (failures.length) {
    failures.forEach((f) => console.error(`FAILED: ${f}`));
    process.exit(1);
  }
  process.exit(0);
}

run().catch((e) => {
  console.error("E2E FAILED:", e.message);
  process.exit(1);
});
