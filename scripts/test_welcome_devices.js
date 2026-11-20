/* eslint-disable @typescript-eslint/no-require-imports -- a plain Node script, like its neighbours */
/*
 * The welcome entry on emulated phones: WebKit (the engine of iPhone Safari)
 * with an iPhone profile, and Chromium with an Android (Pixel) profile.
 *
 *   node scripts/test_welcome_devices.js [baseUrl] [screenshotDir]
 *
 * The same mocked API as test_welcome_flow_ui (nothing leaves the machine).
 *
 * Emulation is not a device: it cannot open the real on-screen keyboard,
 * autofill from a saved profile, or run iOS Safari's own toolbar and safe-area
 * behaviour. What it does check, per engine:
 * - no sideways scroll on any screen; one heading per screen;
 * - every control at least 44 screen pixels tall;
 * - every text field at least 16px (iOS zooms the page into smaller fields);
 * - Continue inside the viewport on every step, and neither the call nor the
 *   chat button over it or over a focused field;
 * - a focused field is scrolled clear of the Continue bar;
 * - the right input types for the phone keyboards (tel, email) and autofill tokens;
 * - the whole flow carries data-clarity-mask (Clarity masks its text and inputs).
 */
const { chromium, webkit, devices } = require("playwright");
const fs = require("fs");
const { open, fillAddress, SCHEDULE, rect, overlaps, screenOf } = require("./test_welcome_flow_ui");

const BASE = process.argv[2] || "http://localhost:3000";
const SHOTS = process.argv[3] || "";
if (SHOTS) fs.mkdirSync(SHOTS, { recursive: true });

const results = [];
function check(name, pass, detail = "") {
  results.push(!!pass);
  console.log(`${pass ? "PASS" : "FAIL"}  ${name}${detail ? "  :: " + detail : ""}`);
}

async function screenFacts(page) {
  return page.evaluate(() => {
    const zoom = parseFloat(getComputedStyle(document.body).zoom || "1") || 1;
    const vh = window.innerHeight;
    const visibleEls = (sel) => Array.from(document.querySelectorAll(sel)).filter((el) => {
      const r = el.getBoundingClientRect();
      const st = getComputedStyle(el);
      return r.width > 0 && r.height > 0 && st.visibility !== "hidden" && st.display !== "none";
    });
    const controls = visibleEls("[data-welcome] button, [data-welcome] input:not([type=file]), [data-welcome] textarea, [data-welcome] select, [data-welcome] a[href]")
      // Links inside a sentence (the consent line's "SMS Terms") are text, not controls (WCAG 2.5.8 inline exception).
      .filter((el) => !el.closest(".hd-sheet") && !(el.tagName === "A" && el.closest("p")))
      // getBoundingClientRect is already in screen pixels under the site zoom.
      .map((el) => ({ h: el.getBoundingClientRect().height, t: (el.textContent || el.getAttribute("aria-label") || el.tagName).trim().slice(0, 30) }));
    const smallest = controls.reduce((m, c) => (c.h < m.h ? c : m), { h: 999, t: "" });
    // iOS zooms into a field whose CSS font size is under 16px; the site also sets maximum-scale=1 on iOS (lib/surface IOS_VIEWPORT_SCRIPT).
    const fields = visibleEls("[data-welcome] input:not([type=file]), [data-welcome] textarea").map((el) => parseFloat(getComputedStyle(el).fontSize));
    void zoom;
    const cont = document.querySelector(".wf-continue");
    const cr = cont ? cont.getBoundingClientRect() : null;
    return {
      sideScroll: document.documentElement.scrollWidth > window.innerWidth + 1,
      h1: visibleEls("[data-welcome] h1").length,
      smallest,
      minField: fields.length ? Math.min(...fields) : 99,
      continueInView: cr ? cr.bottom <= vh + 1 && cr.top >= 0 : true,
      iosNoZoom: /maximum-scale=1/.test(document.querySelector("meta[name=viewport]")?.getAttribute("content") || ""),
      masked: Boolean(document.querySelector("[data-welcome][data-clarity-mask='true']")),
    };
  });
}

async function walk(browserType, deviceName) {
  const browser = await browserType.launch();
  const tag = deviceName.replace(/\s+/g, "-").toLowerCase();
  try {
    const { ctx, page, state, errors } = await open(browser, { device: devices[deviceName] });
    await page.goto(BASE + "/", { waitUntil: "networkidle" });
    const facts = [];
    const look = async (name) => {
      const f = await screenFacts(page);
      facts.push([name, f]);
      if (SHOTS) await page.screenshot({ path: `${SHOTS}/${tag}-${name}.png` }).catch(() => {});
      check(`${deviceName} ${name}: no sideways scroll, one heading`, !f.sideScroll && f.h1 === 1, JSON.stringify({ side: f.sideScroll, h1: f.h1 }));
      check(`${deviceName} ${name}: every control at least 44px`, f.smallest.h >= 43.5, `${f.smallest.h.toFixed(1)} ${f.smallest.t}`);
      check(`${deviceName} ${name}: fields at least 16px (no iOS zoom)`, f.minField >= 15.9, f.minField.toFixed(1));
      if (/iPhone/.test(deviceName)) check(`${deviceName} ${name}: iOS viewport cannot zoom into a field`, f.iosNoZoom);
      check(`${deviceName} ${name}: Continue on screen`, f.continueInView);
      check(`${deviceName} ${name}: the flow is masked for Clarity`, f.masked);
      const contRect = await rect(page, ".wf-continue");
      if (contRect) {
        const call = await rect(page, ".pf-call");
        const chat = await rect(page, "[data-support-chat] > button");
        check(`${deviceName} ${name}: call and chat clear of Continue`, !overlaps(call, contRect) && !overlaps(chat, contRect), JSON.stringify({ call, chat, contRect }));
      }
    };
    check(`${deviceName}: the welcome entry shows`, (await screenOf(page)) === "choice");
    await look("choice");
    await page.tap("[data-pick='one_time']");
    await page.waitForTimeout(200);
    await look("nudge");
    await page.tap("[data-pick='nudge-one-time']");
    await page.waitForTimeout(200);
    // 2026-11-20: the calendar first, then the address.
    await page.waitForSelector("[data-welcome] [data-slot-picker] .bk-time", { timeout: 8000 });
    await look("time");
    await page.locator(`[data-welcome] .bk-time[data-time='${SCHEDULE[1]}']`).first().tap();
    await page.tap(".wf-continue");
    await page.waitForTimeout(400);
    await look("address");
    await fillAddress(page);
    await page.tap(".wf-continue");
    await page.waitForTimeout(400);
    await page.fill("#wf-task", "Fix the sticking back door");
    await look("job");
    await page.tap(".wf-continue");
    await page.waitForTimeout(300);
    await look("contact");
    // A focused field is never under the Continue bar or a floating button.
    for (const name of ["name", "phone", "email"]) {
      await page.focus(`input[name='${name}']`);
      await page.evaluate((n) => document.querySelector(`input[name='${n}']`).scrollIntoView({ block: "center" }), name);
      await page.waitForTimeout(150);
      const field = await rect(page, `input[name='${name}']`);
      const bar = await rect(page, ".wf-bar");
      const chat = await rect(page, "[data-support-chat] > button");
      check(`${deviceName}: the ${name} field is not covered while focused`, !overlaps(field, bar) && !overlaps(field, chat), JSON.stringify({ field, bar }));
    }
    const types = await page.evaluate(() => Array.from(document.querySelectorAll(".wf-form input")).map((i) => `${i.name}:${i.type}:${i.inputMode || ""}`));
    check(`${deviceName}: phone keyboard for the number, email keyboard for the email`, JSON.stringify(types) === JSON.stringify(["name:text:", "phone:tel:tel", "email:email:email"]), JSON.stringify(types));
    await page.fill("input[name='name']", "Sam Rivera");
    await page.fill("input[name='phone']", "(516) 555-0177");
    await page.fill("input[name='email']", "sam@mailbox.org");
    await page.tap(".wf-continue");
    await page.waitForTimeout(500);
    await look("review");
    check(`${deviceName}: reached the review with the time held`, (await screenOf(page)) === "review" && state.holds.length === 1);
    check(`${deviceName}: nothing reached an outside host`, state.outside.length === 0, state.outside.join(","));
    check(`${deviceName}: no page errors`, errors.length === 0, errors.join(" | "));
    await ctx.close();
  } finally {
    await browser.close();
  }
}

(async () => {
  await walk(webkit, "iPhone 14");
  await walk(webkit, "iPhone SE");
  await walk(chromium, "Pixel 7");
  await walk(chromium, "Galaxy S9+");
  const passed = results.filter(Boolean).length;
  console.log(`\n${passed}/${results.length} passed`);
  if (passed !== results.length) process.exit(1);
})().catch((error) => {
  console.error(error);
  process.exit(1);
});
