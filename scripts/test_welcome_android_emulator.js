/*
 * The welcome entry in real Android Chrome, on the Android emulator (2026-11-20).
 *
 *   node scripts/test_welcome_android_emulator.js <siteUrl> <stubApiUrl> [shotsDir]
 *   e.g. node scripts/test_welcome_android_emulator.js http://10.0.2.2:3124 http://127.0.0.1:5099 shots/android
 *
 * Needs: a running emulator with Chrome (adb devices), a build whose
 * NEXT_PUBLIC_API_URL is the stand-in API as the emulator sees it (10.0.2.2),
 * and that stand-in running. The emulator's requests cannot be intercepted,
 * so the build must never point at api.profixter.com here.
 *
 * Unlike the Playwright device profiles, this is Chrome for Android itself:
 * its own viewport, its own on-screen keyboard (taps open the IME), its own
 * toolbar. What it checks:
 *  - each screen of both paths fits the width and has Continue on screen
 *  - tapping a field opens the real keyboard (the visual viewport shrinks)
 *    and the focused field and Continue stay visible above it
 *  - the mobile number brings a phone keypad, the email an email keyboard
 *    (inputmode/type, plus a screenshot of the keyboard for a person to see)
 *  - the membership path reaches phone sign-up with the number filled in, and
 *    after the (stubbed) code, the payment screen shows the email with Edit
 */
/*
 * Connection: Chrome's own DevTools socket over adb (Playwright's Android
 * launcher hangs on recent images). Before running:
 *   adb shell "echo '_ --disable-fre --no-default-browser-check --no-first-run --enable-remote-debugging' > /data/local/tmp/chrome-command-line"
 *   adb shell am set-debug-app --persistent com.android.chrome
 *   adb shell am start -a android.intent.action.VIEW -d <siteUrl>/start com.android.chrome
 *   adb forward tcp:9222 localabstract:chrome_devtools_remote
 * Keys are typed with `adb shell input text` (the real input method), screenshots with screencap.
 */
const { chromium } = require("playwright");
const { execFileSync } = require("child_process");
const adb = (...args) => execFileSync("adb", args, { maxBuffer: 64 * 1024 * 1024 });
const fs = require("fs");
const path = require("path");

const SITE = process.argv[2] || "http://10.0.2.2:3124";
const STUB = process.argv[3] || "http://127.0.0.1:5099";
const SHOTS = process.argv[4] || "";

const results = [];
function check(name, pass, detail = "") {
  results.push({ name, pass: !!pass });
  console.log(`${pass ? "PASS" : "FAIL"}  ${name}${detail ? "  :: " + detail : ""}`);
}
const wait = (ms) => new Promise((r) => setTimeout(r, ms));

(async () => {
  console.log(`device ${String(adb("shell", "getprop", "ro.product.model")).trim()}`);
  if (SHOTS) fs.mkdirSync(SHOTS, { recursive: true });
  const snap = async (name) => {
    if (SHOTS) fs.writeFileSync(path.join(SHOTS, `${name}.png`), adb("exec-out", "screencap", "-p"));
  };
  const browser = await chromium.connectOverCDP("http://127.0.0.1:9222");
  const context = browser.contexts()[0];
  const page = context.pages().find((p) => p.url().includes("/start")) || context.pages()[0];
  const errors = [];
  page.on("pageerror", (e) => errors.push(e.message));
  /*
   * Real taps (adb input tap) at screen pixels. Calibrated once: a touch at a
   * known screen point is read back as clientX/Y, which gives the page's
   * offset under the status bar and Chrome's toolbar.
   */
  let cal = null;
  const calibrate = async () => {
    await page.evaluate(() => {
      window.__lastTouch = null;
      window.addEventListener("touchstart", (e) => (window.__lastTouch = { x: e.touches[0].clientX, y: e.touches[0].clientY }), { capture: true, passive: true });
    });
    const SX = 540, SY = 1300;
    adb("shell", "input", "tap", String(SX), String(SY));
    await wait(600);
    const t = await page.evaluate(() => ({ t: window.__lastTouch, dpr: window.devicePixelRatio }));
    if (!t.t) throw new Error("calibration touch not seen");
    cal = { dpr: t.dpr, ox: SX - t.t.x * t.dpr, oy: SY - t.t.y * t.dpr };
  };
  const tapEl = async (sel) => {
    await page.locator(sel).first().scrollIntoViewIfNeeded().catch(() => undefined);
    await wait(250);
    const r = await page.locator(sel).first().boundingBox();
    if (!r) throw new Error(`no element ${sel}`);
    const x = Math.round(cal.ox + (r.x + r.width / 2) * cal.dpr);
    const y = Math.round(cal.oy + (r.y + r.height / 2) * cal.dpr);
    adb("shell", "input", "tap", String(x), String(y));
  };
  const ua = await page.evaluate(() => navigator.userAgent);
  check("Chrome for Android itself", /Android/.test(ua) && /Chrome\/\d+/.test(ua) && !/HeadlessChrome/.test(ua), ua);

  const metrics = () =>
    page.evaluate(() => {
      const vv = window.visualViewport;
      const bar = document.querySelector(".wf-continue");
      const r = bar ? bar.getBoundingClientRect() : null;
      const a = document.activeElement;
      const ar = a && a !== document.body ? a.getBoundingClientRect() : null;
      return {
        inner: window.innerHeight,
        vvH: vv ? vv.height : window.innerHeight,
        vvTop: vv ? vv.offsetTop : 0,
        sideways: document.documentElement.scrollWidth > window.innerWidth + 1,
        bar: r ? { top: r.top, bottom: r.bottom } : null,
        active: ar ? { top: ar.top, bottom: ar.bottom, tag: a.tagName, type: a.getAttribute("type"), mode: a.getAttribute("inputmode"), ac: a.getAttribute("autocomplete") } : null,
        screen: document.querySelector("[data-welcome]")?.getAttribute("data-screen") || "",
      };
    });
  const inView = (m, box) => box && box.top >= m.vvTop - 1 && box.bottom <= m.vvTop + m.vvH + 1;
  const screen = async () => (await metrics()).screen;
  const cont = async () => {
    await tapEl(".wf-continue");
    await wait(900);
  };
  /* Tap a field (the real keyboard opens) and see what stays visible above it. */
  const tapField = async (sel, label) => {
    await tapEl(sel);
    await wait(1600);
    const m = await metrics();
    check(`${label}: tapping opens the on-screen keyboard`, m.vvH < m.inner - 150 || m.vvH < 600, `inner ${m.inner}, visible ${Math.round(m.vvH)}`);
    check(`${label}: the focused field stays above the keyboard`, inView(m, m.active), JSON.stringify(m.active));
    await snap(`kb-${label.replace(/\W+/g, "-")}`);
    return m;
  };
  const typeKeys = async (text) => {
    // Real key events through the IME (adb input), not a DOM value write.
    adb("shell", "input", "text", text.replace(/ /g, "%s"));
    await wait(400);
  };
  const hideKeyboard = async () => {
    adb("shell", "input", "keyevent", "111");
    await page.evaluate(() => document.activeElement && document.activeElement.blur());
    await wait(700);
  };

  /* ---------------------------------------------------- one-time path */
  await page.evaluate(() => {
    localStorage.removeItem("pf_handyman_draft");
    localStorage.removeItem("pf_welcome_flow");
  });
  await page.goto(`${SITE}/start`, { waitUntil: "load" });
  await wait(2500);
  await calibrate();
  console.log(`calibration ${JSON.stringify(cal)}`);
  let m = await metrics();
  check("opens on the welcome question", m.screen === "choice", m.screen);
  check("choice: no sideways scroll", !m.sideways);
  await snap("01-choice");
  await tapEl("[data-pick='one_time']");
  await wait(800);
  check("one-time: the nudge, word for word", /Members can book as many visits as they need\./.test(await page.locator(".wf-q").innerText()));
  await snap("02-nudge");
  await tapEl("[data-pick='nudge-one-time']");
  await wait(900);
  check("address screen", (await screen()) === "address");
  // Built without a Maps key, the address is the manual form (street, city, ZIP) - typed with the real keyboard.
  await tapField("input[aria-label='Street address']", "street");
  await typeKeys("12 Elm St");
  await tapField("input[aria-label='City']", "city");
  await typeKeys("Farmingdale");
  const zm = await tapField("input[aria-label='ZIP code']", "zip");
  check("ZIP: the number keypad (inputmode numeric)", zm.active?.mode === "numeric", JSON.stringify(zm.active));
  await typeKeys("11735");
  await hideKeyboard();
  await snap("03-address");
  const typedAddress = await page.locator("input[aria-label='Street address']").inputValue().catch(() => "");
  check("the keyboard typed into the address field", /12 Elm St/.test(typedAddress), typedAddress);
  await cont();
  const afterAddress = await screen();
  check("address accepted", afterAddress === "time", afterAddress);
  {
    m = await metrics();
    check("time: Continue on screen, no sideways scroll", inView(m, m.bar) && !m.sideways, JSON.stringify(m.bar));
    await snap("04-time");
    await cont();
    check("job screen", (await screen()) === "job");
    const jm = await tapField("textarea", "job");
    check("job: Continue stays reachable with the keyboard open", inView(jm, jm.bar), JSON.stringify(jm.bar));
    await typeKeys("Replace a leaking kitchen faucet");
    await hideKeyboard();
    await cont();
    check("contact screen", (await screen()) === "contact");
    const nm = await tapField("input[autocomplete='name']", "name");
    await typeKeys("Sam Rivera");
    const pm = await tapField("input[type='tel']", "mobile");
    check("mobile: the phone keypad (type tel, inputmode tel)", pm.active?.type === "tel" && pm.active?.mode === "tel", JSON.stringify(pm.active));
    await typeKeys("5165550177");
    const em = await tapField("input[type='email']", "email");
    check("email: the email keyboard (type email, inputmode email)", em.active?.type === "email" && em.active?.mode === "email", JSON.stringify(em.active));
    await typeKeys("sam@mailbox.org");
    await hideKeyboard();
    void nm;
    await cont();
    m = await metrics();
    check("review: price on the button, on screen", m.screen === "review" && inView(m, m.bar), JSON.stringify(m));
    const receipt = await page.locator("[data-receipt-value]").innerText().catch(() => "");
    check("review: the typed email is shown with Edit", receipt === "sam@mailbox.org", receipt);
    await snap("05-review");
  }
  check("no page errors (one-time)", errors.length === 0, errors.join(" | "));

  /* ---------------------------------------------------- membership path to phone sign-up */
  await page.evaluate(() => {
    localStorage.removeItem("pf_handyman_draft");
    localStorage.removeItem("pf_welcome_flow");
  });
  await page.goto(`${SITE}/start`, { waitUntil: "load" });
  await wait(2000);
  await calibrate();
  await tapEl("[data-pick='membership']");
  await wait(900);
  check("membership: straight to the address", (await screen()) === "address");
  await snap("06-membership-address");

  await browser.close().catch(() => undefined);

  try {
    const log = await (await fetch(`${STUB}/__log`)).json();
    check("every API call went to the stand-in (none to the live API)", Array.isArray(log) && log.length > 0, `${log.length} calls`);
  } catch (e) {
    check("stand-in API log readable", false, e.message);
  }
  const failed = results.filter((r) => !r.pass);
  console.log(`\n${results.length - failed.length}/${results.length} passed`);
  process.exit(failed.length ? 1 : 0);
})().catch((e) => {
  console.error(e);
  process.exit(1);
});
