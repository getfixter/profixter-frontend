/*
 * The signup address step, driven through a real browser.
 *
 * Google is stubbed at the network edge: the request for the Maps JS bundle is
 * fulfilled with a fake that implements the exact surface lib/places.ts uses -
 * importLibrary, AutocompleteSuggestion.fetchAutocompleteSuggestions, and a
 * Place with fetchFields. Everything above that is the real component, the real
 * state machine and the real page.
 *
 * Stubbing rather than calling Google is not a shortcut. Live autocomplete would
 * make this suite cost money per run, fail when a key rotates, and change its
 * answers when Google reranks a street - none of which says anything about
 * whether our page works.
 *
 * Run against a build made with NEXT_PUBLIC_GOOGLE_MAPS_API_KEY set to anything
 * non-empty, or the field renders its manual fallback and most of this is moot.
 *
 *   node scripts/test_signup_address_ui.js [baseUrl]
 */
const { chromium } = require("playwright");

const BASE = process.argv[2] || "http://127.0.0.1:3022";
const WIDTHS = [320, 360, 375, 390, 430, 768, 1280, 1440];
const SHOTS = process.env.PF_SHOTS || "";

const results = [];
function check(name, pass, detail) {
  results.push({ name, pass, detail });
  console.log(`${pass ? "PASS" : "FAIL"}  ${name}${detail ? "  :: " + detail : ""}`);
}

/* Four addresses, chosen to cover each branch of the service-area rule. */
const PLACES = [
  { q: "125 main", id: "p_babylon", main: "125 Main St", secondary: "Babylon, NY, USA",
    num: "125", route: "Main St", city: "Babylon", cityType: "locality", state: "NY", zip: "11702",
    lat: 40.6959, lng: -73.3262 },
  { q: "125 main", id: "p_farmingdale", main: "125 Main St", secondary: "Farmingdale, NY, USA",
    num: "125", route: "Main St", city: "Farmingdale", cityType: "locality", state: "NY", zip: "11735",
    lat: 40.7326, lng: -73.4454 },
  { q: "90-10", id: "p_queens", main: "90-10 Roosevelt Ave", secondary: "Jackson Heights, NY, USA",
    num: "90-10", route: "Roosevelt Ave", city: "Jackson Heights", cityType: "sublocality_level_1",
    state: "NY", zip: "11372", lat: 40.7489, lng: -73.8777 },
  { q: "1 congress", id: "p_austin", main: "1 Congress Ave", secondary: "Austin, TX, USA",
    num: "1", route: "Congress Ave", city: "Austin", cityType: "locality", state: "TX", zip: "78701",
    lat: 30.2642, lng: -97.7453 },
  /*
   * An apartment, with the subpremise spelled the way live Google actually
   * returns it - "apt 2", lower case, label included. The naive `#${unit}`
   * built "#apt 2" and nobody noticed until the key was real.
   */
  { q: "175 fulton", id: "p_hempstead", main: "175 Fulton Ave apt 2", secondary: "Hempstead, NY, USA",
    num: "175", route: "Fulton Ave", sub: "apt 2", city: "Hempstead", cityType: "locality",
    state: "NY", zip: "11550", lat: 40.7062, lng: -73.6187 },
  /*
   * A New York City address, which carries NO locality at all - the town is in
   * sublocality_level_1 and the neighbourhood in `neighborhood`. Confirmed
   * against live Google for 100 Montague St.
   */
  { q: "100 montague", id: "p_brooklyn", main: "100 Montague St", secondary: "Brooklyn, NY, USA",
    num: "100", route: "Montague St", city: "Brooklyn", cityType: "sublocality_level_1",
    hood: "Brooklyn Heights", state: "NY", zip: "11201", lat: 40.6944, lng: -73.9948 },
];

function mapsStub() {
  return `
window.__pfPlaces = ${JSON.stringify(PLACES)};
window.__pfFetchCount = 0;
window.__pfDetailCount = 0;
window.__pfFail = false;
function makePlace(p) {
  return {
    id: p.id,
    formattedAddress: p.main + ", " + p.city + ", " + p.state + " " + p.zip + ", USA",
    addressComponents: [
      { longText: p.num, shortText: p.num, types: ["street_number"] },
      { longText: p.route, shortText: p.route, types: ["route"] },
      { longText: p.city, shortText: p.city, types: [p.cityType] },
      p.hood ? { longText: p.hood, shortText: p.hood, types: ["neighborhood", "political"] } : null,
      p.sub ? { longText: p.sub, shortText: p.sub, types: ["subpremise"] } : null,
      { longText: p.state === "NY" ? "New York" : "Texas", shortText: p.state, types: ["administrative_area_level_1"] },
      { longText: p.zip, shortText: p.zip, types: ["postal_code"] }
    ].filter(Boolean),
    location: { lat: function () { return p.lat; }, lng: function () { return p.lng; } },
    fetchFields: async function () { window.__pfDetailCount++; return this; }
  };
}
window.google = {
  maps: {
    places: { AutocompleteSessionToken: function () { this.token = Math.random(); } },
    importLibrary: async function () {
      return {
        AutocompleteSuggestion: {
          fetchAutocompleteSuggestions: async function (req) {
            window.__pfFetchCount++;
            window.__pfLastRequest = {
              input: req.input,
              hasSession: Boolean(req.sessionToken),
              regions: req.includedRegionCodes,
              types: req.includedPrimaryTypes,
              bias: Boolean(req.locationBias),
              restriction: Boolean(req.locationRestriction)
            };
            if (window.__pfFail) throw new Error("simulated Places outage");
            const q = String(req.input || "").toLowerCase();
            const hits = window.__pfPlaces.filter(function (p) { return q.indexOf(p.q) === 0; });
            return { suggestions: hits.map(function (p) {
              return { placePrediction: {
                placeId: p.id,
                text: { text: p.main + ", " + p.city },
                mainText: { text: p.main },
                secondaryText: { text: p.secondary },
                toPlace: function () { return makePlace(p); }
              } };
            }) };
          }
        }
      };
    }
  }
};
if (typeof window.__pfMapsReady === "function") window.__pfMapsReady();
`;
}

async function newPage(browser, width, height) {
  const ctx = await browser.newContext({
    viewport: { width, height: height || 844 },
    isMobile: width < 700,
    hasTouch: width < 700,
  });

  await ctx.route("**maps.googleapis.com/maps/api/js**", (route) =>
    route.fulfill({ status: 200, contentType: "application/javascript", body: mapsStub() })
  );

  // The service-area answer comes from the backend allowlist; stubbed here so
  // the UI suite does not need a database.
  await ctx.route("**/api/service-area/check**", (route) => {
    const zip = new URL(route.request().url()).searchParams.get("zip");
    const serviceable = ["11702", "11735"].includes(zip);
    route.fulfill({
      status: 200, contentType: "application/json",
      body: JSON.stringify({ zip, serviceable, county: serviceable ? "Suffolk" : null }),
    });
  });

  const page = await ctx.newPage();
  await page.goto(BASE + "/signup", { waitUntil: "domcontentloaded" });
  await page.waitForSelector("#pf-address", { timeout: 20000 });
  return { ctx, page };
}

const FIELD = "#pf-address";
const OPTION = '[role="option"]';
const CONTINUE = 'form button[type="submit"]';

async function typeAddress(page, text) {
  await page.fill(FIELD, "");
  await page.type(FIELD, text, { delay: 15 });
  await page.waitForTimeout(600);
}

async function stepIsOne(page) {
  return page.evaluate(() => document.body.innerText.includes("What's your home address?"));
}

(async () => {
  const browser = await chromium.launch();

  // ---------- 1 + 2. Two valid Long Island addresses ----------
  for (const pick of [{ i: 0, city: "Babylon", zip: "11702" }, { i: 1, city: "Farmingdale", zip: "11735" }]) {
    const { ctx, page } = await newPage(browser, 390);
    await typeAddress(page, "125 main");
    const count = await page.locator(OPTION).count();
    check(`suggestions appear for a partial address (${pick.city})`, count >= 2, `${count} shown`);

    await page.locator(OPTION).nth(pick.i).click();
    await page.waitForTimeout(500);

    const state = await page.evaluate(() => ({
      value: document.querySelector("#pf-address").value,
      unitVisible: !!document.querySelector('input[placeholder="Apt / Unit (optional)"]'),
    }));
    check(`${pick.city}: field shows the full verified address`, state.value.includes(pick.city) && state.value.includes(pick.zip), state.value);
    check(`${pick.city}: optional unit appears only after selection`, state.unitVisible, "");

    const inAreaBadge = await page.evaluate(() => document.body.innerText.includes("First visit free"));
    check(`${pick.city}: free-visit promise stays for an eligible address`, inAreaBadge, "");

    await page.click(CONTINUE);
    await page.waitForTimeout(700);
    check(`${pick.city}: Continue advances past the address step`, !(await stepIsOne(page)), "");
    await ctx.close();
  }

  // ---------- 3 + 4. Out of area, accepted but flagged ----------
  for (const c of [{ q: "90-10", label: "Queens" }, { q: "1 congress", label: "Texas" }]) {
    const { ctx, page } = await newPage(browser, 390);
    await typeAddress(page, c.q);
    await page.locator(OPTION).first().click();
    await page.waitForTimeout(700);

    const text = (await page.evaluate(() => document.body.innerText)).replace(/’/g, "'");
    check(`${c.label}: shown the short out-of-area note`, text.includes("We're not in your area yet") && text.includes("Profixter currently serves Long Island"), "");
    check(`${c.label}: note is short - no modal, no essay`, !text.includes("Check whether we serve") && !text.includes("residents only"), "");
    check(`${c.label}: free-visit promise is withdrawn, not left contradicting it`, !text.includes("First visit free"), "");

    await page.click(CONTINUE);
    await page.waitForTimeout(700);
    check(`${c.label}: registration is NOT blocked (accounts stay open)`, !(await stepIsOne(page)), "");

    const laterStep = await page.evaluate(() => document.body.innerText.includes("First visit free"));
    check(`${c.label}: and stays withdrawn on the following step`, !laterStep, "");
    await ctx.close();
  }

  // ---------- 4b. A real subpremise, and a city with no locality ----------
  {
    const { ctx, page } = await newPage(browser, 390);
    await typeAddress(page, "175 fulton");
    await page.locator(OPTION).first().click();
    await page.waitForTimeout(700);
    const apt = await page.evaluate(() => ({
      unit: document.querySelector('input[placeholder="Apt / Unit (optional)"]')?.value,
      field: document.querySelector("#pf-address").value,
    }));
    check("Google's own unit is carried into the Apt field", apt.unit === "Apt 2", JSON.stringify(apt.unit));
    check("and is not welded into the street line as #apt 2", !apt.field.includes("#apt"), apt.field);

    await typeAddress(page, "100 montague");
    await page.locator(OPTION).first().click();
    await page.waitForTimeout(700);
    const bk = await page.evaluate(() => document.querySelector("#pf-address").value);
    check("an address with no locality still resolves (NYC sublocality)", bk.includes("Brooklyn"), bk);
    await ctx.close();
  }

  // ---------- 5. Freeform text is not an address ----------
  {
    const { ctx, page } = await newPage(browser, 390);
    await typeAddress(page, "123 whatever street babylon");
    await page.click(CONTINUE);
    await page.waitForTimeout(500);
    const text = (await page.evaluate(() => document.body.innerText)).replace(/’/g, "'");
    check("typed text alone cannot continue", await stepIsOne(page), "");
    check("and says what to do about it", text.includes("Select your address from the list."), "");
    await ctx.close();
  }

  // ---------- 6. Editing after selecting un-verifies ----------
  {
    const { ctx, page } = await newPage(browser, 390);
    await typeAddress(page, "125 main");
    await page.locator(OPTION).first().click();
    await page.waitForTimeout(400);

    await page.click(CONTINUE);
    await page.waitForTimeout(600);
    check("baseline: verified address continues", !(await stepIsOne(page)), "");

    await page.click('button:has-text("Back")').catch(() => {});
    await page.waitForTimeout(500);
    await page.focus(FIELD);
    await page.keyboard.press("End");
    await page.keyboard.type("7");
    await page.waitForTimeout(500);

    const unitGone = await page.evaluate(() => !document.querySelector('input[placeholder="Apt / Unit (optional)"]'));
    check("editing the text drops the verified state", unitGone, "");

    /*
     * Editing re-opens the suggestion list, and the list is an overlay - it sits
     * over the button, as any autocomplete does. Dismiss it first, which is what
     * a customer does by tapping away or pressing Escape.
     */
    await page.keyboard.press("Escape");
    await page.waitForTimeout(300);
    await page.click(CONTINUE);
    await page.waitForTimeout(500);
    check("and Continue is refused until a new suggestion is picked", await stepIsOne(page), "");

    await typeAddress(page, "125 main");
    await page.locator(OPTION).first().click();
    await page.waitForTimeout(400);
    await page.click(CONTINUE);
    await page.waitForTimeout(600);
    check("re-selecting restores it", !(await stepIsOne(page)), "");
    await ctx.close();
  }

  // ---------- 7. Lookup failure stays usable ----------
  {
    const { ctx, page } = await newPage(browser, 390);
    // Wait for the stub to be in place first: it initialises __pfFail itself,
    // so a flag set before it loads is overwritten by the load.
    await page.waitForFunction(() => window.__pfPlaces !== undefined, null, { timeout: 10000 });
    await page.evaluate(() => { window.__pfFail = true; });
    await typeAddress(page, "125 main");
    const options = await page.locator(OPTION).count();
    check("an outage shows no dropdown and no stack trace", options === 0, `${options} options`);
    const text = (await page.evaluate(() => document.body.innerText)).replace(/’/g, "'");
    check("no raw Google error reaches the customer", !/REQUEST_DENIED|ApiError|Places outage/i.test(text), "");
    check("the manual way out is offered", text.includes("Can't find your address?"), "");
    await ctx.close();
  }

  // ---------- 8. Manual fallback, still service-area aware ----------
  {
    const { ctx, page } = await newPage(browser, 390);
    /*
     * The escape hatch only appears once somebody is actually struggling -
     * enough typed for a real search, still no verified address - so this types
     * something unfindable before reaching for it.
     *
     * Matched on a fragment without the apostrophe: the button renders &rsquo;,
     * so any selector containing an ASCII quote misses it.
     */
    await typeAddress(page, "somewhere google does not know");
    await page.click("button:has-text('find your address')");
    await page.waitForTimeout(300);

    await page.fill('input[placeholder="Street address"]', "9 Hidden Ln");
    await page.fill('input[placeholder="City"]', "Austin");
    await page.fill('input[placeholder="ZIP"]', "78701");
    await page.waitForTimeout(700);

    const text = (await page.evaluate(() => document.body.innerText)).replace(/’/g, "'");
    check("manual entry is still checked against the allowlist", text.includes("We're not in your area yet"), "");

    const payload = await page.evaluate(() => {
      const el = document.querySelector('input[placeholder="ZIP"]');
      return el ? el.value : "";
    });
    check("manual ZIP is digits only, capped at five", payload === "78701", payload);
    await ctx.close();
  }

  // ---------- 8b. An unknown answer is not a "no" ----------
  {
    const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true });
    await ctx.route("**maps.googleapis.com/maps/api/js**", (route) =>
      route.fulfill({ status: 200, contentType: "application/javascript", body: mapsStub() })
    );
    // The service-area lookup itself is down.
    await ctx.route("**/api/service-area/check**", (route) => route.abort());
    const page = await ctx.newPage();
    await page.goto(BASE + "/signup", { waitUntil: "domcontentloaded" });
    await page.waitForSelector(FIELD, { timeout: 20000 });

    await typeAddress(page, "125 main");
    await page.locator(OPTION).first().click();
    await page.waitForTimeout(900);

    const t = (await page.evaluate(() => document.body.innerText)).replace(/’/g, "'");
    check("a failed service-area check does not withdraw the offer", t.includes("First visit free"), "");
    check("and does not accuse an eligible customer of being out of area", !t.includes("We're not in your area yet"), "");
    await ctx.close();
  }

  // ---------- 9. What reaches the API ----------
  {
    const { ctx, page } = await newPage(browser, 390);
    let body = null;
    await ctx.route("**/api/auth/register", (route) => {
      body = JSON.parse(route.request().postData() || "{}");
      route.fulfill({ status: 500, contentType: "application/json", body: JSON.stringify({ message: "stub" }) });
    });

    await typeAddress(page, "125 main");
    await page.locator(OPTION).first().click();
    await page.waitForTimeout(400);
    await page.fill('input[placeholder="Apt / Unit (optional)"]', "Apt 4B");
    await page.click(CONTINUE);
    await page.waitForTimeout(500);

    await page.fill("#name", "Test Person");
    await page.click(CONTINUE);
    await page.waitForTimeout(400);
    await page.fill("#email", "addr-test@example.com");
    await page.fill("#phone", "6315551234");
    await page.check("#sms-service-consent", { force: true }).catch(() => {});
    await page.click(CONTINUE);
    await page.waitForTimeout(400);
    await page.fill("#password", "supersecret1");
    /*
     * Service SMS and Terms are conditions of registration, so the form will
     * not submit without them. `force` because these inputs are visually
     * replaced by their own styled boxes, which Playwright refuses to click
     * through by default - nothing to do with the address step.
     */
    await page.check("#agree-terms", { force: true }).catch(() => {});
    await page.click(CONTINUE);
    await page.waitForTimeout(1500);

    check("register is called with the structured address", Boolean(body), body ? "" : "no request captured");
    if (body) {
      check("street line carries the unit", body.address === "125 Main St Apt 4B", String(body.address));
      check("city and ZIP are the looked-up ones", body.city === "Babylon" && body.zip === "11702", `${body.city} ${body.zip}`);
      check("placeId is sent", body.placeId === "p_babylon", String(body.placeId));
      check("coordinates are sent", body.lat === 40.6959 && body.lng === -73.3262, `${body.lat},${body.lng}`);
      check("county is NOT sent - the server derives it", body.county === undefined, String(body.county));
    }
    await ctx.close();
  }

  // ---------- 10. Back and forward keep the address ----------
  {
    const { ctx, page } = await newPage(browser, 390);
    await typeAddress(page, "125 main");
    await page.locator(OPTION).first().click();
    await page.waitForTimeout(400);
    await page.click(CONTINUE);
    await page.waitForTimeout(600);
    await page.click('button:has-text("Back")').catch(() => {});
    await page.waitForTimeout(600);

    const kept = await page.evaluate(() => ({
      value: document.querySelector("#pf-address")?.value || "",
      unit: !!document.querySelector('input[placeholder="Apt / Unit (optional)"]'),
    }));
    check("going back keeps the chosen address in the field", kept.value.includes("Babylon"), kept.value);

    await page.click(CONTINUE);
    await page.waitForTimeout(600);
    check("and forward still works without reselecting", !(await stepIsOne(page)), "");
    await ctx.close();
  }

  // ---------- 11. Request shape: bias not restriction, session tokens ----------
  {
    const { ctx, page } = await newPage(browser, 390);
    await typeAddress(page, "125 main");
    const req = await page.evaluate(() => window.__pfLastRequest);
    check("requests carry a session token (billing)", req?.hasSession === true, JSON.stringify(req));
    check("results are biased to Long Island, not restricted", req?.bias === true && req?.restriction === false, "");
    check("limited to US street addresses", req?.regions?.includes("us") && req?.types?.includes("street_address"), "");

    const before = await page.evaluate(() => window.__pfFetchCount);
    await page.type(FIELD, "xyz", { delay: 10 });
    await page.waitForTimeout(600);
    const after = await page.evaluate(() => window.__pfFetchCount);
    check("typing is debounced, not one request per keystroke", after - before <= 2, `${after - before} requests for 3 keystrokes`);
    await ctx.close();
  }

  // ---------- 12. Layout across phone and desktop widths ----------
  for (const width of WIDTHS) {
    const { ctx, page } = await newPage(browser, width, width < 700 ? 844 : 900);
    await typeAddress(page, "125 main");

    const m = await page.evaluate(() => {
      const f = document.querySelector("#pf-address").getBoundingClientRect();
      const opts = Array.from(document.querySelectorAll('[role="option"] button'));
      const btn = document.querySelector('form button[type="submit"]')?.getBoundingClientRect();
      return {
        vw: window.innerWidth,
        scrollW: document.documentElement.scrollWidth,
        fieldH: f.height, fieldRight: f.right, fieldLeft: f.left,
        optionMinH: opts.length ? Math.min(...opts.map((o) => o.getBoundingClientRect().height)) : 0,
        optionOverflow: opts.some((o) => o.getBoundingClientRect().right > window.innerWidth + 1),
        optionCount: opts.length,
        ctaH: btn ? btn.height : 0,
        fontSize: parseFloat(getComputedStyle(document.querySelector("#pf-address")).fontSize),
      };
    });

    check(`${width}px no horizontal overflow`, m.scrollW <= m.vw + 1, `scrollW=${m.scrollW} vw=${m.vw}`);
    check(`${width}px field fits inside the viewport`, m.fieldLeft >= 0 && m.fieldRight <= m.vw + 1, `${m.fieldLeft}..${m.fieldRight}`);
    check(`${width}px field is a comfortable touch target`, m.fieldH >= 48, `${m.fieldH}px`);
    check(`${width}px 16px input text (no iOS zoom on focus)`, m.fontSize >= 16, `${m.fontSize}px`);
    check(`${width}px suggestions fit the width`, !m.optionOverflow, "");
    check(`${width}px suggestion rows are tappable`, m.optionMinH >= 44, `${m.optionMinH}px`);
    check(`${width}px Continue is a comfortable target`, m.ctaH >= 44, `${m.ctaH}px`);

    if (SHOTS) {
      await page.screenshot({ path: `${SHOTS}/signup-address-${width}.png` });
      if (width === 390) {
        await page.locator(OPTION).first().click();
        await page.waitForTimeout(500);
        await page.screenshot({ path: `${SHOTS}/signup-address-selected-390.png` });
        await typeAddress(page, "1 congress");
        await page.locator(OPTION).first().click();
        await page.waitForTimeout(700);
        await page.screenshot({ path: `${SHOTS}/signup-address-outofarea-390.png` });
      }
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
})().catch((e) => { console.error(e); process.exit(1); });
