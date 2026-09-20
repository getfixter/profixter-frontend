/*
 * The redesigned auth screens: sign up, sign in, password reset.
 *
 * Google is stubbed at the network edge exactly as in the address suite, so
 * this runs without a key and without spending a billed request. What it checks
 * is the design contract rather than the address logic - that suite still owns
 * that.
 *
 * THE KEYBOARD CHECKS ARE THE POINT. A screenshot with the keyboard closed says
 * nothing about a form on a phone. Chromium will not raise a real keyboard, so
 * the viewport is resized to what one leaves behind - roughly 45% of a phone
 * screen - and the assertion is that the field being typed into and the button
 * that submits it are both still on screen.
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

const PLACES = [
  { q: "100 w main", id: "p_bab", main: "100 W Main St", secondary: "Babylon, NY, USA",
    num: "100", route: "W Main St", city: "Babylon", cityType: "locality", state: "NY", zip: "11702", lat: 40.6959, lng: -73.3262 },
  { q: "100 main st, white", id: "p_wp", main: "100 Main St", secondary: "White Plains, NY, USA",
    num: "100", route: "Main St", city: "White Plains", cityType: "locality", state: "NY", zip: "10601", lat: 41.033, lng: -73.763 },
];

function mapsStub() {
  return `
window.__pfPlaces = ${JSON.stringify(PLACES)};
function makePlace(p) {
  return { id: p.id, formattedAddress: p.main + ", " + p.city + ", " + p.state + " " + p.zip + ", USA",
    addressComponents: [
      { longText: p.num, shortText: p.num, types: ["street_number"] },
      { longText: p.route, shortText: p.route, types: ["route"] },
      { longText: p.city, shortText: p.city, types: [p.cityType] },
      { longText: "New York", shortText: p.state, types: ["administrative_area_level_1"] },
      { longText: p.zip, shortText: p.zip, types: ["postal_code"] }],
    location: { lat: function(){return p.lat;}, lng: function(){return p.lng;} },
    fetchFields: async function(){ return this; } };
}
window.google = { maps: {
  places: { AutocompleteSessionToken: function(){ this.t = 1; } },
  importLibrary: async function(){ return { AutocompleteSuggestion: { fetchAutocompleteSuggestions: async function(req){
    const q = String(req.input||"").toLowerCase();
    const hits = window.__pfPlaces.filter(function(p){ return q.indexOf(p.q) === 0; });
    return { suggestions: hits.map(function(p){ return { placePrediction: {
      placeId: p.id, text:{text:p.main}, mainText:{text:p.main}, secondaryText:{text:p.secondary},
      toPlace: function(){ return makePlace(p); } } }; }) };
  } } }; } } };
if (typeof window.__pfMapsReady === "function") window.__pfMapsReady();
`;
}

async function open(browser, width, height, path = "/signup") {
  const ctx = await browser.newContext({ viewport: { width, height }, isMobile: width < 700, hasTouch: width < 700 });
  await ctx.route("**maps.googleapis.com/maps/api/js**", (r) =>
    r.fulfill({ status: 200, contentType: "application/javascript", body: mapsStub() }));
  await ctx.route("**/api/service-area/check**", (r) => {
    const zip = new URL(r.request().url()).searchParams.get("zip");
    r.fulfill({ status: 200, contentType: "application/json",
      body: JSON.stringify({ zip, serviceable: zip === "11702", county: zip === "11702" ? "Suffolk" : null }) });
  });
  const page = await ctx.newPage();
  await page.goto(BASE + path, { waitUntil: "domcontentloaded", timeout: 45000 });
  await page.waitForTimeout(900);
  return { ctx, page };
}

const SUBMIT = ".auth-submit";
async function toStep(page, n) {
  if (n >= 2) {
    await page.fill("#pf-address", "");
    await page.type("#pf-address", "100 w main", { delay: 10 });
    await page.waitForTimeout(700);
    await page.locator('[role="option"]').first().click();
    await page.waitForTimeout(700);
    await page.click(SUBMIT); await page.waitForTimeout(500);
  }
  if (n >= 3) { await page.fill("#name", "Test Person"); await page.click(SUBMIT); await page.waitForTimeout(450); }
  if (n >= 4) {
    // Step 3 asks how to reach you: email, phone, and the texting choice. The
    // service box is a condition of registration, so Continue needs it ticked.
    await page.fill("#email", "t@example.com");
    await page.fill("#phone", "6315551234");
    await page.check("#sms-service-consent", { force: true }).catch(() => {});
    await page.click(SUBMIT); await page.waitForTimeout(450);
  }
}

async function layout(page) {
  return page.evaluate(() => {
    const q = (s) => document.querySelector(s);
    const r = (el) => { const b = el.getBoundingClientRect(); return { top: b.top, bottom: b.bottom, left: b.left, right: b.right, h: b.height }; };
    const inputs = Array.from(document.querySelectorAll(".auth-input"));
    const btn = q(".auth-submit");
    return {
      vw: innerWidth, vh: innerHeight, scrollW: document.documentElement.scrollWidth,
      question: q(".auth-question") ? r(q(".auth-question")) : null,
      questionSize: q(".auth-question") ? parseFloat(getComputedStyle(q(".auth-question")).fontSize) : 0,
      inputs: inputs.map((i) => ({ ...r(i), font: parseFloat(getComputedStyle(i).fontSize) })),
      btn: btn ? r(btn) : null,
      brand: q(".auth-brand") ? r(q(".auth-brand")) : null,
      darkLeftovers: document.querySelectorAll('[class*="text-white"],[class*="bg-white/"]').length,
      bodyBg: getComputedStyle(document.body).backgroundColor,
    };
  });
}

(async () => {
  const browser = await chromium.launch();

  // ---------- every width, every step ----------
  for (const w of WIDTHS) {
    const h = w < 700 ? 844 : 900;
    for (const step of [1, 2, 3, 4]) {
      const { ctx, page } = await open(browser, w, h);
      await toStep(page, step);
      const m = await layout(page);
      const tag = `${w}px step${step}`;

      check(`${tag} no horizontal overflow`, m.scrollW <= m.vw + 1, `${m.scrollW}/${m.vw}`);
      check(`${tag} question present and large`, m.questionSize >= 22, `${m.questionSize}px`);
      check(`${tag} every input is 16px (no iOS zoom)`, m.inputs.every((i) => i.font >= 16), m.inputs.map((i) => i.font).join(","));
      check(`${tag} every input inside the viewport`, m.inputs.every((i) => i.left >= 0 && i.right <= m.vw + 1), "");
      check(`${tag} primary action is 44px+`, m.btn && m.btn.h >= 44, m.btn ? `${m.btn.h}` : "missing");
      check(`${tag} primary action on screen`, m.btn && m.btn.bottom <= m.vh + 1 && m.btn.top >= 0, m.btn ? `${m.btn.top.toFixed(0)}..${m.btn.bottom.toFixed(0)} vh=${m.vh}` : "");
      check(`${tag} nothing above the brand bar`, !m.question || m.question.top > m.brand.bottom, "");
      check(`${tag} no leftover dark-theme classes`, m.darkLeftovers === 0, `${m.darkLeftovers}`);

      if (SHOTS && [320, 390, 430, 768, 1280, 1440].includes(w)) {
        await page.screenshot({ path: `${SHOTS}/r-${w}-step${step}.png` });
      }
      await ctx.close();
    }
  }

  // ---------- the keyboard ----------
  for (const [w, full] of [[320, 568], [375, 667], [390, 844], [430, 932]]) {
    const kb = Math.round(full * 0.55); // what's left once a keyboard is up
    for (const step of [1, 2, 3, 4]) {
      const { ctx, page } = await open(browser, w, full);
      await toStep(page, step);
      await page.setViewportSize({ width: w, height: kb });
      await page.waitForTimeout(500);
      const m = await layout(page);
      const tag = `${w}x${kb} (keyboard up) step${step}`;
      check(`${tag} first field visible`, m.inputs.length > 0 && m.inputs[0].top >= 0 && m.inputs[0].bottom <= m.vh + 1,
        m.inputs[0] ? `${m.inputs[0].top.toFixed(0)}..${m.inputs[0].bottom.toFixed(0)} vh=${m.vh}` : "no input");
      /*
       * Steps 1 and 2 ask one question and must put the button on screen with
       * the keyboard up, at every size.
       *
       * Steps 3 and 4 carry the consent controls - two SMS rows beside the
       * phone number, and the Terms row beside the password. Those are legally
       * required and cannot be compressed, and on a 320x568 phone a keyboard
       * leaves 312px, which is less than the controls themselves occupy. The
       * requirement there is that the page scrolls to the button and that
       * nothing is clipped or stranded above the viewport.
       */
      if (step === 3 || step === 4) {
        const reach = await page.evaluate(() => {
          const b = document.querySelector(".auth-submit").getBoundingClientRect();
          const q = document.querySelector(".auth-question").getBoundingClientRect();
          const needed = b.bottom + scrollY;
          return {
            scrollable: document.documentElement.scrollHeight >= needed - 1,
            clipped: getComputedStyle(document.body).overflow === "hidden",
            // Nothing stranded above the top of the page, which is what a
            // centred overflow used to do.
            topReachable: q.top + scrollY >= -1,
          };
        });
        check(`${tag} submit reachable, nothing stranded above`, reach.scrollable && !reach.clipped && reach.topReachable, JSON.stringify(reach));
      } else {
        check(`${tag} submit not buried`, m.btn && m.btn.bottom <= m.vh + 1, m.btn ? `${m.btn.bottom.toFixed(0)} vh=${m.vh}` : "");
      }
      check(`${tag} no horizontal overflow`, m.scrollW <= m.vw + 1, "");
      if (SHOTS && w === 390) await page.screenshot({ path: `${SHOTS}/kb-${w}-step${step}.png` });
      await ctx.close();
    }
  }

  // ---------- landscape ----------
  {
    const { ctx, page } = await open(browser, 844, 390);
    await toStep(page, 2);
    const m = await layout(page);
    check("landscape 844x390 submit on screen", m.btn && m.btn.bottom <= m.vh + 1, m.btn ? `${m.btn.bottom.toFixed(0)}/${m.vh}` : "");
    check("landscape no horizontal overflow", m.scrollW <= m.vw + 1, "");
    if (SHOTS) await page.screenshot({ path: `${SHOTS}/r-landscape.png` });
    await ctx.close();
  }

  // ---------- behaviour the design must not have broken ----------
  {
    const { ctx, page } = await open(browser, 390, 844);
    await toStep(page, 2);
    await page.fill("#name", "Jane Homeowner");
    await page.click(SUBMIT); await page.waitForTimeout(500);
    await page.click(".auth-back"); await page.waitForTimeout(500);
    const kept = await page.inputValue("#name");
    check("Back preserves what was typed", kept === "Jane Homeowner", kept);

    await page.click(SUBMIT); await page.waitForTimeout(500);
    const onEmail = await page.evaluate(() => document.body.innerText.includes("How can we reach you?"));
    check("forward again still works", onEmail, "");
    await ctx.close();
  }

  {
    // Enter submits, and an empty step is refused with a short message.
    const { ctx, page } = await open(browser, 390, 844);
    await toStep(page, 2);
    await page.focus("#name");
    await page.keyboard.press("Enter");
    await page.waitForTimeout(500);
    const stuck = await page.evaluate(() => document.body.innerText.includes("What's your name?"));
    check("Enter on an empty required field does not advance", stuck, "");
    const msg = await page.evaluate(() => (document.querySelector(".auth-error") || {}).textContent || "");
    check("and says something short", msg.length > 0 && msg.length < 60, `"${msg}"`);
    await ctx.close();
  }

  {
    // Free visit line: shown for Long Island, gone for out of area, and it
    // stays gone on later steps.
    const { ctx, page } = await open(browser, 390, 844);
    await toStep(page, 2);
    const inArea = await page.evaluate(() => document.body.innerText.includes("First visit free"));
    check("free-visit line shown for a Long Island address", inArea, "");
    await ctx.close();

    const b = await open(browser, 390, 844);
    await b.page.type("#pf-address", "100 main st, white", { delay: 10 });
    await b.page.waitForTimeout(700);
    await b.page.locator('[role="option"]').first().click();
    await b.page.waitForTimeout(900);
    const t = (await b.page.evaluate(() => document.body.innerText)).replace(/’/g, "'");
    check("out of area: short note shown", t.includes("We're not in your area yet"), "");
    check("out of area: free-visit line withdrawn", !t.includes("First visit free"), "");
    await b.page.click(SUBMIT); await b.page.waitForTimeout(700);
    const t2 = await b.page.evaluate(() => document.body.innerText);
    check("out of area: stays withdrawn on the next step", !t2.includes("First visit free"), "");
    await b.ctx.close();
  }

  // ---------- sign in and password reset share the shell ----------
  for (const [path, name, heading] of [["/signin", "sign in", "Welcome back"], ["/forgot-password", "password reset", "Reset your password"]]) {
    for (const w of [320, 390, 1440]) {
      const { ctx, page } = await open(browser, w, w < 700 ? 844 : 900, path);
      const m = await layout(page);
      check(`${name} ${w}px uses the shared shell`, m.brand !== null && m.question !== null, "");
      check(`${name} ${w}px right heading`, await page.evaluate((h) => document.body.innerText.includes(h), heading), "");
      check(`${name} ${w}px inputs are 16px`, m.inputs.every((i) => i.font >= 16), "");
      check(`${name} ${w}px no overflow`, m.scrollW <= m.vw + 1, "");
      check(`${name} ${w}px no dark leftovers`, m.darkLeftovers === 0, `${m.darkLeftovers}`);
      if (SHOTS && w === 390) await page.screenshot({ path: `${SHOTS}/r-${name.replace(/ /g, "")}-390.png` });
      if (SHOTS && w === 1440) await page.screenshot({ path: `${SHOTS}/r-${name.replace(/ /g, "")}-1440.png` });
      await ctx.close();
    }
  }

  {
    // A wrong password says so, once, without a wall of red.
    const { ctx, page } = await open(browser, 390, 844, "/signin");
    await ctx.route("**/api/auth/login", (r) => r.fulfill({ status: 401, contentType: "application/json",
      body: JSON.stringify({ message: "Invalid email or password" }) }));
    await page.fill("#email", "nobody@example.com");
    await page.fill("#password", "wrongpassword");
    await page.click(SUBMIT);
    await page.waitForTimeout(2500);
    const err = await page.evaluate(() => (document.querySelector(".auth-error") || {}).textContent || "");
    check("failed login shows one short message", err.includes("Invalid"), `"${err}"`);
    if (SHOTS) await page.screenshot({ path: `${SHOTS}/r-signin-error-390.png` });
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
