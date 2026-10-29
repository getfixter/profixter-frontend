/*
 * The auth screens: sign up, sign in, password reset (Registration 2.0).
 *
 * Every API call is answered in the browser, so this runs without a backend,
 * without Twilio and without a Google key. What it checks is the design
 * contract and where sign-in lands - Registration 2.0's own logic is covered
 * by the BackEnd auth suites and the A2P evidence tests.
 *
 * UPDATED 2026-10-29. The suite was written for the old four-step signup
 * (address, name, contact with SMS boxes, password). Registration 2.0 replaced
 * that with one screen of ways in and a one-time code, so the steps are now:
 *
 *   step 1  the ways in (phone, Google, Apple, email)      /signup
 *   step 2  the mobile number                              "Continue with phone"
 *   step 3  the six-digit code                             "Text me a code"
 *   step 4  the email address                              "Continue with email"
 *
 * The same protections carry over to each: no sideways scroll, a large
 * question, 16px inputs (no iOS zoom), a 44px+ primary action on screen, the
 * keyboard-up checks, Back keeps what was typed, an empty field is refused
 * with a short message, sign in and reset share the shell, a wrong password
 * says so once. New: the phone step has zero checkboxes and the exact
 * "terms.continue.v1" line, and sign-in lands where it should
 * (new or returning customer -> /account, ?next= wins, member -> Book).
 *
 * THE KEYBOARD CHECKS ARE THE POINT. Chromium will not raise a real keyboard,
 * so the viewport is resized to what one leaves behind - roughly 55% of a
 * phone screen - and the assertion is that the field being typed into and
 * the button that submits it are both still on screen.
 *
 *   node scripts/test_auth_redesign_ui.js [baseUrl]
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

const TERMS_LINE =
  "By continuing, you agree to the Terms and Privacy Policy and to receive a one-time verification text. Msg & data rates may apply.";

const CUSTOMER = { _id: "c1", name: "", email: "", phone: "+16315551234", role: "customer", addresses: [], phoneVerified: true, needsName: true, hasPassword: false };
const MEMBER = { _id: "m1", name: "Dana", email: "dana@example.com", phone: "+16315550000", role: "customer", hasPassword: true,
  addresses: [{ _id: "a1", line1: "12 Harbor Rd", city: "Huntington", state: "NY", zip: "11743", hasActiveSubscription: true, plan: "plus" }] };

/* A browser context whose API answers like a working backend. */
async function open(browser, width, height, path = "/signup", { me = CUSTOMER, created = true } = {}) {
  const ctx = await browser.newContext({ viewport: { width, height }, isMobile: width < 700, hasTouch: width < 700 });
  let signedIn = false;
  await ctx.route(/localhost:5001\//, (route) => {
    const req = route.request();
    const p = new URL(req.url()).pathname;
    const cors = { "access-control-allow-origin": "*", "access-control-allow-headers": "*", "access-control-allow-methods": "GET,POST,PUT,PATCH,OPTIONS" };
    if (req.method() === "OPTIONS") return route.fulfill({ status: 204, headers: cors });
    const json = (body, status = 200) => route.fulfill({ status, contentType: "application/json", headers: cors, body: JSON.stringify(body) });
    if (p === "/api/auth/otp/phone/start") return json({ phoneMasked: "(•••) •••-1234", resendAfterSeconds: 30, expiresInSeconds: 600 });
    if (p === "/api/auth/otp/email/start") return json({ emailMasked: "t•••@example.com", resendAfterSeconds: 30, expiresInSeconds: 600 });
    if (p === "/api/auth/otp/phone/verify" || p === "/api/auth/otp/email/verify") {
      signedIn = true;
      return json({ status: "signed_in", token: "test-token", created, user: me });
    }
    if (p === "/api/auth/me") return signedIn ? json(me) : json({ message: "Unauthorized" }, 401);
    if (p === "/api/auth/login") return json({ message: "Invalid email or password" }, 401);
    if (p === "/api/subscriptions/my") return json({ subscriptions: [] });
    return json({});
  });
  const page = await ctx.newPage();
  await page.goto(BASE + path, { waitUntil: "domcontentloaded", timeout: 45000 });
  await page.waitForSelector(".auth-question", { timeout: 30000 });
  await page.waitForTimeout(600);
  return { ctx, page };
}

/*
 * The control that moves each step forward. The code step has no button on
 * purpose - six digits submit themselves (CodeStep) - so its "primary action"
 * is the code box, which must be as reachable as a button would be.
 */
const PRIMARY = { 1: ".auth-method--primary", 2: ".auth-submit", 3: ".auth-otp", 4: ".auth-submit" };

async function toStep(page, n) {
  if (n === 2 || n === 3) {
    await page.click(".auth-method--primary");
    await page.waitForSelector("#phone");
  }
  if (n === 3) {
    await page.fill("#phone", "6315551234");
    await page.click(".auth-submit");
    await page.waitForSelector(".auth-otp");
    await page.waitForTimeout(300);
  }
  if (n === 4) {
    await page.click("button.auth-method:has-text('Continue with email')");
    await page.waitForSelector("#auth-email");
  }
  await page.waitForTimeout(250);
}

async function layout(page, primary) {
  return page.evaluate((primary) => {
    const q = (s) => document.querySelector(s);
    const r = (el) => { const b = el.getBoundingClientRect(); return { top: b.top, bottom: b.bottom, left: b.left, right: b.right, h: b.height }; };
    const inputs = Array.from(document.querySelectorAll(".auth-input"));
    const btn = q(primary);
    return {
      vw: innerWidth, vh: innerHeight, scrollW: document.documentElement.scrollWidth,
      question: q(".auth-question") ? r(q(".auth-question")) : null,
      questionSize: q(".auth-question") ? parseFloat(getComputedStyle(q(".auth-question")).fontSize) : 0,
      inputs: inputs.map((i) => ({ ...r(i), font: parseFloat(getComputedStyle(i).fontSize) })),
      btn: btn ? r(btn) : null,
      brand: q(".auth-brand") ? r(q(".auth-brand")) : null,
      wordmark: !!q(".auth-brand svg.ui-wordmark"),
      darkLeftovers: document.querySelectorAll('[class*="text-white"],[class*="bg-white/"]').length,
    };
  }, primary);
}

(async () => {
  const browser = await chromium.launch();

  // ---------- every width, every step ----------
  for (const w of WIDTHS) {
    const h = w < 700 ? 844 : 900;
    for (const step of [1, 2, 3, 4]) {
      const { ctx, page } = await open(browser, w, h);
      await toStep(page, step);
      const m = await layout(page, PRIMARY[step]);
      const tag = `${w}px step${step}`;

      check(`${tag} no horizontal overflow`, m.scrollW <= m.vw + 1, `${m.scrollW}/${m.vw}`);
      check(`${tag} question present and large`, m.questionSize >= 22, `${m.questionSize}px`);
      check(`${tag} every input is 16px (no iOS zoom)`, m.inputs.every((i) => i.font >= 16), m.inputs.map((i) => i.font).join(","));
      check(`${tag} every input inside the viewport`, m.inputs.every((i) => i.left >= 0 && i.right <= m.vw + 1), "");
      check(`${tag} primary action is 44px+`, m.btn && m.btn.h >= 44, m.btn ? `${m.btn.h}` : "missing");
      check(`${tag} primary action on screen`, m.btn && m.btn.bottom <= m.vh + 1 && m.btn.top >= 0, m.btn ? `${m.btn.top.toFixed(0)}..${m.btn.bottom.toFixed(0)} vh=${m.vh}` : "");
      check(`${tag} nothing above the brand bar`, !m.question || (m.brand && m.question.top > m.brand.bottom), "");
      check(`${tag} the brand is the inline wordmark`, m.wordmark, "");
      check(`${tag} no leftover dark-theme classes`, m.darkLeftovers === 0, `${m.darkLeftovers}`);

      if (SHOTS && [320, 390, 768, 1440].includes(w)) await page.screenshot({ path: `${SHOTS}/r-${w}-step${step}.png` });
      await ctx.close();
    }
  }

  // ---------- the keyboard ----------
  for (const [w, full] of [[320, 568], [375, 667], [390, 844], [430, 932]]) {
    const kb = Math.round(full * 0.55); // what's left once a keyboard is up
    for (const step of [2, 3, 4]) {
      const { ctx, page } = await open(browser, w, full);
      await toStep(page, step);
      await page.setViewportSize({ width: w, height: kb });
      await page.waitForTimeout(400);
      const m = await layout(page, PRIMARY[step]);
      const tag = `${w}x${kb} (keyboard up) step${step}`;
      check(`${tag} first field visible`, m.inputs.length > 0 && m.inputs[0].top >= 0 && m.inputs[0].bottom <= m.vh + 1,
        m.inputs[0] ? `${m.inputs[0].top.toFixed(0)}..${m.inputs[0].bottom.toFixed(0)} vh=${m.vh}` : "no input");
      check(`${tag} submit not buried`, m.btn && m.btn.bottom <= m.vh + 1, m.btn ? `${m.btn.bottom.toFixed(0)} vh=${m.vh}` : "");
      check(`${tag} no horizontal overflow`, m.scrollW <= m.vw + 1, "");
      if (SHOTS && w === 390) await page.screenshot({ path: `${SHOTS}/kb-${w}-step${step}.png` });
      await ctx.close();
    }
  }

  // ---------- landscape ----------
  {
    const { ctx, page } = await open(browser, 844, 390);
    await toStep(page, 2);
    const m = await layout(page, ".auth-submit");
    check("landscape 844x390 submit on screen", m.btn && m.btn.bottom <= m.vh + 1, m.btn ? `${m.btn.bottom.toFixed(0)}/${m.vh}` : "");
    check("landscape no horizontal overflow", m.scrollW <= m.vw + 1, "");
    await ctx.close();
  }

  // ---------- the phone step: no boxes, the exact line ----------
  {
    const { ctx, page } = await open(browser, 390, 844);
    await toStep(page, 2);
    const facts = await page.evaluate(() => {
      const line = document.querySelector("[data-terms-continue]");
      return {
        boxes: document.querySelectorAll('input[type="checkbox"]').length,
        text: line ? line.textContent.replace(/\s+/g, " ").trim() : "",
        links: line ? Array.from(line.querySelectorAll("a")).map((a) => a.getAttribute("href")) : [],
      };
    });
    check("phone step has zero checkboxes", facts.boxes === 0, `${facts.boxes}`);
    check("phone step carries the terms.continue.v1 line word for word", facts.text === TERMS_LINE, facts.text);
    check("and its three links", JSON.stringify(facts.links) === JSON.stringify(["/terms", "/privacy", "/communication-consent"]), facts.links.join(","));
    await ctx.close();
  }

  // ---------- behaviour the design must not have broken ----------
  {
    const { ctx, page } = await open(browser, 390, 844);
    await toStep(page, 4);
    await page.fill("#auth-email", "jane@example.com");
    await page.click(".auth-back"); await page.waitForTimeout(400);
    await page.click("button.auth-method:has-text('Continue with email')"); await page.waitForTimeout(400);
    const kept = await page.inputValue("#auth-email");
    check("Back preserves what was typed", kept === "jane@example.com", kept);
    await ctx.close();
  }

  {
    // Enter submits, and an empty step is refused with a short message.
    const { ctx, page } = await open(browser, 390, 844);
    await toStep(page, 2);
    await page.focus("#phone");
    await page.keyboard.press("Enter");
    await page.waitForTimeout(400);
    const stuck = await page.evaluate(() => document.body.innerText.includes("What's your mobile number?"));
    check("Enter on an empty required field does not advance", stuck, "");
    const msg = await page.evaluate(() => (document.querySelector(".auth-error") || {}).textContent || "");
    check("and says something short", msg.length > 0 && msg.length < 60, `"${msg}"`);
    await ctx.close();
  }

  {
    // The free first visit, said once, quietly, on the sign-up screen only.
    const { ctx, page } = await open(browser, 390, 844);
    const t = await page.evaluate(() => document.body.innerText);
    check("sign up states the free first visit once", (t.match(/First visit free/g) || []).length === 1, "");
    await ctx.close();
  }

  // ---------- where sign-in lands ----------
  async function landing(path, opts) {
    const { ctx, page } = await open(browser, 390, 844, path, opts);
    await toStep(page, 3);
    await page.fill(".auth-otp", "123456");
    await page.waitForTimeout(300);
    if (await page.locator(".auth-submit").isVisible().catch(() => false)) await page.click(".auth-submit").catch(() => {});
    await page.waitForURL((u) => !/\/sign(up|in)/.test(u.pathname), { timeout: 15000 }).catch(() => {});
    const url = new URL(page.url());
    await ctx.close();
    return url.pathname + url.search;
  }
  {
    const to = await landing("/signup", { me: CUSTOMER, created: true });
    check("a new customer lands on their account", to === "/account", to);
  }
  {
    const to = await landing("/signin", { me: { ...CUSTOMER, name: "Pat", needsName: false }, created: false });
    check("a returning non-member lands on their account, not the homepage", to === "/account", to);
  }
  {
    const to = await landing(`/signin?next=${encodeURIComponent("/book?visit=additional")}`, { me: CUSTOMER, created: false });
    check("?next= wins", to === "/book?visit=additional", to);
  }
  {
    const to = await landing("/signin?next=https://evil.example/", { me: CUSTOMER, created: false });
    check("an off-site ?next= is ignored", to === "/account", to);
  }
  {
    const to = await landing("/signin", { me: MEMBER, created: false });
    check("a member lands on Book", to === "/book?visit=membership", to);
  }

  // ---------- sign in and password reset share the shell ----------
  for (const [path, name, heading] of [["/signin", "sign in", "Welcome back"], ["/forgot-password", "password reset", "Reset your password"]]) {
    for (const w of [320, 390, 1440]) {
      const { ctx, page } = await open(browser, w, w < 700 ? 844 : 900, path);
      const m = await layout(page, ".auth-submit, .auth-method--primary");
      check(`${name} ${w}px uses the shared shell`, m.brand !== null && m.question !== null && m.wordmark, "");
      check(`${name} ${w}px right heading`, await page.evaluate((h) => document.body.innerText.includes(h), heading), "");
      check(`${name} ${w}px inputs are 16px`, m.inputs.every((i) => i.font >= 16), "");
      check(`${name} ${w}px no overflow`, m.scrollW <= m.vw + 1, "");
      check(`${name} ${w}px no dark leftovers`, m.darkLeftovers === 0, `${m.darkLeftovers}`);
      if (SHOTS && w === 390) await page.screenshot({ path: `${SHOTS}/r-${name.replace(/ /g, "")}-390.png` });
      await ctx.close();
    }
  }

  {
    // A wrong password says so, once, without a wall of red.
    const { ctx, page } = await open(browser, 390, 844, "/signin");
    await page.click("button:has-text('Sign in with password')");
    await page.waitForSelector("#password");
    await page.fill("#auth-email", "nobody@example.com");
    await page.fill("#password", "wrongpassword");
    await page.click(".auth-submit");
    await page.waitForTimeout(1500);
    const errs = await page.evaluate(() => Array.from(document.querySelectorAll(".auth-error")).map((e) => e.textContent || ""));
    check("failed login shows one short message", errs.length === 1 && errs[0].includes("Invalid"), JSON.stringify(errs));
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
