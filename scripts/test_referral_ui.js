/*
 * The referral program in a real browser (2026-11-20).
 *
 *   node scripts/test_referral_ui.js [baseUrl]      SHOTS_DIR=... for screenshots
 *
 * Every API call is answered in the browser: api.profixter.com is stubbed and
 * any other outside host is refused, so nothing reaches production.
 *
 * What it pins:
 * - the popup's exact copy, $149 as the focal point, one blue Share button,
 *   How it works (payout, qualifying payments, discounts) behind a link;
 *   a bottom sheet on phones, a centred card on desktop; no sideways scroll
 * - Share my link opens the native share sheet with the personal link; a
 *   closed sheet is not an error; without Web Share it copies the link
 * - it opens by itself once on the account, not again on the next visit
 * - /r/<code> lands on the homepage with the welcome flow and keeps the code;
 *   the 2025 ?ref=<8 digits> link is kept; a telemarketer code is not
 * - the code rides on the phone sign-up verify call, a signed-in browser
 *   claims it once and forgets it, and the membership checkout carries it
 * - rewards in the account: Pending, Ready with "Confirm where to mail it",
 *   which asks for a code first (REAUTH_REQUIRED) and then saves
 * - Admin > Referrals: owner only; list, flags, payee, approve (with the
 *   server's recheck refusal shown), mark mailed with a check number
 */
const fs = require("fs");
const { chromium, devices } = require("playwright");

const BASE = process.argv[2] || "http://localhost:3123";
const LOCAL = new URL(BASE).host;
const SHOTS = process.env.SHOTS_DIR || "";
if (SHOTS) fs.mkdirSync(SHOTS, { recursive: true });

const results = [];
function check(name, pass, detail = "") {
  results.push(!!pass);
  console.log(`${pass ? "PASS" : "FAIL"}  ${name}${detail && !pass ? "  :: " + detail : ""}`);
}
const shot = async (page, name) => {
  if (SHOTS) await page.screenshot({ path: `${SHOTS}/${name}.png` }).catch(() => {});
};
const wait = (ms) => new Promise((r) => setTimeout(r, ms));

const CODE = "maria-7k2m";
const URL_ = `https://www.profixter.com/r/${CODE}`;
const CUSTOMER = { _id: "c1", userId: "83000001", name: "Maria Lopez", firstName: "Maria", email: "maria@example.test", emailVerified: true, phone: "+16315551234", phoneVerified: true, phoneVerifiedAt: new Date().toISOString(), role: "customer", addresses: [{ _id: "a1", line1: "12 Oak Street", city: "Huntington", state: "NY", zip: "11743" }], defaultAddressId: "a1" };
const OWNER = { _id: "owner1", userId: "PF-OWNER", name: "Owner Test", email: "owner@example.test", role: "admin", addresses: [] };
const STAFF = { _id: "e1", userId: "PF-E1", name: "Gina General", email: "gf@example.test", role: "employee", employeePosition: "General Fixter", isActive: true, permissions: ["bookings.read"], addresses: [] };

function rewardsFixture() {
  return [
    { id: "r1", friend: "Ann B.", status: "eligible", statusLabel: "Ready", amountCents: 14900, plan: "Basic", joinedAt: "2026-10-01T12:00:00Z", firstPaidAt: "2026-10-02T12:00:00Z", secondPaidAt: "2026-11-02T12:00:00Z", mailedAt: null, note: "", payee: { confirmed: false }, needsPayee: true, canEditPayee: true },
    { id: "r2", friend: "Ben P.", status: "pending", statusLabel: "Pending", amountCents: 13410, plan: "Basic", joinedAt: "2026-11-10T12:00:00Z", firstPaidAt: "2026-11-11T12:00:00Z", secondPaidAt: null, mailedAt: null, note: "Ready after their second membership payment.", payee: { confirmed: false }, needsPayee: true, canEditPayee: true },
  ];
}

function adminReward(over = {}) {
  return {
    id: "rw1", status: "eligible", statusLabel: "Ready", referrer: { id: "c1", name: "Maria Lopez", email: "maria@example.test", phone: "+16315551234", userId: "83000001" },
    referred: { id: "c2", name: "Ann Baker", email: "ann@example.test", phone: "+16315550000", userId: "83000002" },
    amountCents: 13410, plan: "Basic", cycle: "monthly", firstPaidAt: "2026-10-02T12:00:00Z", secondPaidAt: "2026-11-02T12:00:00Z", flagCount: 1, flagsCleared: false, attention: "", payeeConfirmed: false,
    createdAt: "2026-10-01T12:00:00Z", updatedAt: new Date().toISOString(), code: CODE, via: "signup", reason: "", capCents: 14900,
    first: { invoiceId: "in_1", subscriptionId: "sub_1", chargeId: "ch_1", billingReason: "subscription_create", paidAt: "2026-10-02T12:00:00Z", plan: "Basic", cycle: "monthly", baseCents: 14900, discountCents: 1490, taxCents: 1157, amountPaidCents: 14567, paidPreTaxCents: 13410, refundedCents: 0, refundedPreTaxCents: 0, disputed: false, discountSource: "Promotion code SAVE10", promoCode: "SAVE10", stripeUrl: "https://dashboard.stripe.com/invoices/in_1" },
    second: { invoiceId: "in_2", subscriptionId: "sub_1", chargeId: "ch_2", billingReason: "subscription_cycle", paidAt: "2026-11-02T12:00:00Z", plan: "Basic", cycle: "monthly", baseCents: 14900, discountCents: 0, taxCents: 1285, amountPaidCents: 16185, paidPreTaxCents: 14900, refundedCents: 0, refundedPreTaxCents: 0, disputed: false, discountSource: "", promoCode: "", stripeUrl: "https://dashboard.stripe.com/invoices/in_2" },
    flags: [{ code: "existing_account", strength: "review", text: "The friend's account existed before the referral was recorded. Check that the referrer really brought them in.", at: "2026-11-02T12:00:00Z", reviewed: false }],
    flagsReview: null, payee: null, approval: null, check: null, lastRecheck: null,
    history: [{ at: "2026-11-02T12:00:00Z", event: "eligible", by: "system", detail: "Ready: $134.10." }], canApprove: false,
    ...over,
  };
}

async function open(browser, { device = null, viewport = { width: 390, height: 844 }, me = null, share = "native", welcome = false, initial = {}, rewards = rewardsFixture() } = {}) {
  const mobile = viewport.width < 700;
  const ctx = await browser.newContext(device ? { ...device } : { viewport, isMobile: mobile, hasTouch: mobile });
  await ctx.grantPermissions(["clipboard-read", "clipboard-write"], { origin: BASE }).catch(() => {});
  await ctx.addInitScript(({ signedIn, share: mode, welcome: w, initial: init }) => {
    try {
      if (signedIn) localStorage.setItem("token", "ui-token");
      if (w) localStorage.setItem("pf_welcome_test", "1");
      localStorage.setItem("profixter_promotion_popup_dismissed_date", new Date().toISOString().slice(0, 10));
      for (const [k, v] of Object.entries(init || {})) if (!sessionStorage.getItem(`__init_${k}`)) {
        localStorage.setItem(k, v);
        sessionStorage.setItem(`__init_${k}`, "1");
      }
    } catch {}
    window.__shares = [];
    if (mode === "native" || mode === "abort") {
      Object.defineProperty(Navigator.prototype, "share", {
        configurable: true,
        value: function share(data) {
          window.__shares.push(data);
          return mode === "abort" ? Promise.reject(new DOMException("Share canceled", "AbortError")) : Promise.resolve();
        },
      });
      Object.defineProperty(Navigator.prototype, "canShare", { configurable: true, value: () => true });
    } else {
      try {
        delete Navigator.prototype.share;
        delete Navigator.prototype.canShare;
      } catch {}
    }
  }, { signedIn: Boolean(me), share, welcome, initial });

  const state = { me, rewards, claims: [], payees: [], verifies: [], checkouts: [], outside: [], admin: { reward: adminReward(), calls: [] } };
  await ctx.route("**/*", async (route) => {
    const req = route.request();
    const u = new URL(req.url());
    if (u.host === LOCAL) return route.continue();
    if (u.host !== "api.profixter.com" && !/^(localhost|127\.0\.0\.1):5001$/.test(u.host)) {
      state.outside.push(u.host);
      return route.abort();
    }
    const cors = { "access-control-allow-origin": "*", "access-control-allow-headers": "*", "access-control-allow-methods": "GET,POST,PUT,PATCH,DELETE,OPTIONS" };
    if (req.method() === "OPTIONS") return route.fulfill({ status: 204, headers: cors });
    const json = (body, status = 200) => route.fulfill({ status, contentType: "application/json", headers: cors, body: JSON.stringify(body) });
    const p = u.pathname;
    const m = req.method();
    const body = () => JSON.parse(req.postData() || "{}");
    if (p === "/api/auth/me") return state.me ? json(state.me) : json({ message: "No token" }, 401);
    if (p === "/api/referrals/me") {
      if (state.me?.role !== "customer") return json({ eligible: false, code: null, url: null, rewards: [] });
      return json({ eligible: true, code: CODE, url: URL_, rewards: state.rewards, totals: { pendingCents: 13410, readyCents: 14900, mailedCents: 0 } });
    }
    if (p === "/api/referrals/claim" && m === "POST") {
      state.claims.push(body());
      return json({ recorded: true, reason: "recorded" });
    }
    const payee = p.match(/^\/api\/referrals\/rewards\/([^/]+)\/payee$/);
    if (payee && m === "POST") {
      const b = body();
      state.payees.push(b);
      if (!b.reauthToken) return json({ code: "REAUTH_REQUIRED", message: "Please confirm it's you first." }, 403);
      const r = state.rewards.find((x) => x.id === payee[1]);
      const next = { ...r, payee: { confirmed: true, name: b.name, address: `${b.line1}${b.line2 ? `, ${b.line2}` : ""}, ${b.city}, ${b.state.toUpperCase()} ${b.zip}` }, needsPayee: false };
      state.rewards = state.rewards.map((x) => (x.id === r.id ? next : x));
      return json({ reward: next });
    }
    if (p === "/api/auth/reauth/start" && m === "POST") return json({ ok: true, channel: body().channel, destination: "(•••) •••-1234", resendAfterSeconds: 30, expiresInSeconds: 600 });
    if (p === "/api/auth/reauth/verify" && m === "POST") return json({ ok: true, reauthToken: "reauth-proof", expiresInSeconds: 600 });
    if (p === "/api/auth/otp/phone/start" && m === "POST") return json({ phoneMasked: "(•••) •••-1234", resendAfterSeconds: 30, expiresInSeconds: 600 });
    if (p === "/api/auth/otp/phone/verify" && m === "POST") {
      state.verifies.push(body());
      state.me = { ...CUSTOMER, _id: "new1", userId: "83000099", name: "", firstName: "" };
      return json({ status: "signed_in", token: "ui-token", created: true, user: state.me });
    }
    if (p === "/api/stripe/checkout/create-checkout-session" && m === "POST") {
      state.checkouts.push(body());
      return json({ url: `${BASE}/__stripe_test`, sessionId: "cs_test" });
    }
    if (p === "/api/subscriptions/my") return json({ subscriptions: [] });
    if (p === "/api/stripe/checkout/welcome-offer") return json({ eligible: false, serverNow: new Date().toISOString(), percentOff: 20 });
    // Admin
    if (p === "/api/admin/needs-action") return json({ generatedAt: new Date().toISOString(), total: 1, sections: [], items: [] });
    if (p.startsWith("/api/admin/referral-rewards")) {
      if (state.me?.role !== "admin") return json({ message: "Only the owner can see referral rewards.", code: "FORBIDDEN" }, 403);
      const a = state.admin;
      const rest = p.slice("/api/admin/referral-rewards".length);
      if (m === "GET" && (rest === "" || rest === "/")) {
        const { first, second, flags, history, ...row } = a.reward;
        return json({ status: u.searchParams.get("status") || "ready", counts: { ready: 1, pending: 2, approved: 0, attention: 0 }, rewards: [row] });
      }
      if (m === "GET") return json({ reward: a.reward });
      const action = rest.split("/").slice(2).join("/");
      const b = body();
      a.calls.push({ action, body: b });
      const touch = (over) => {
        a.reward = { ...a.reward, ...over, updatedAt: new Date(Date.now() + a.calls.length * 1000).toISOString() };
        return json({ reward: a.reward });
      };
      if (action === "flags/clear") return touch({ flags: a.reward.flags.map((f) => ({ ...f, reviewed: true })), flagsCleared: true, flagsReview: { at: new Date().toISOString(), note: b.note, codes: ["existing_account"] }, canApprove: Boolean(a.reward.payee) });
      if (action === "payee") return touch({ payee: { name: b.name, line1: b.line1, line2: b.line2 || "", city: b.city, state: b.state, zip: b.zip, confirmedAt: new Date().toISOString(), confirmedBy: "owner", note: b.note }, payeeConfirmed: true, canApprove: a.reward.flagsCleared });
      if (action === "approve") {
        // The first attempt: the server's recheck found a refund Stripe shows (as the backend test proves).
        if (!a.refusedOnce) {
          a.refusedOnce = true;
          a.reward = { ...a.reward, amountCents: 12500, updatedAt: new Date(Date.now() + 5000).toISOString() };
          return json({ code: "RECHECK_CHANGED", message: "Stripe shows something different now. Review the changes before approving.", changes: ["The reward is now $125.00 (was $134.10)."], reward: a.reward }, 409);
        }
        if (b.expectedAmountCents !== a.reward.amountCents || b.payeeConfirmed !== true) return json({ code: "AMOUNT_CHANGED", message: "amount" }, 409);
        return touch({ status: "approved", statusLabel: "Approved", approval: { at: new Date().toISOString(), amountCents: a.reward.amountCents } });
      }
      if (action === "mailed") return touch({ status: "mailed", statusLabel: "Mailed", check: { reference: b.reference, mailedAt: b.mailedAt, note: b.note || "" } });
      if (action === "recheck") return json({ ok: true, changes: [], reward: a.reward });
      return json({ message: "unexpected" }, 400);
    }
    return json(m === "GET" ? [] : {});
  });
  const page = await ctx.newPage();
  const errors = [];
  page.on("pageerror", (e) => errors.push(e.message));
  return { ctx, page, state, errors };
}

const box = (page, sel) => page.evaluate((s) => {
  const el = document.querySelector(s);
  if (!el) return null;
  const r = el.getBoundingClientRect();
  return { top: r.top, bottom: r.bottom, left: r.left, right: r.right, width: r.width, height: r.height };
}, sel);
const style = (page, sel, prop) => page.evaluate(([s, p]) => (document.querySelector(s) ? getComputedStyle(document.querySelector(s))[p] : ""), [sel, prop]);
const zoom = (page) => page.evaluate(() => parseFloat(getComputedStyle(document.body).zoom || "1") || 1);

(async () => {
  const browser = await chromium.launch();
  try {
    /* ------------------------------------------- the popup on a phone */
    {
      const { ctx, page, state, errors } = await open(browser, { device: devices["Pixel 7"], me: CUSTOMER });
      await page.goto(`${BASE}/account`, { waitUntil: "networkidle" });
      await page.waitForSelector("[data-referral-popup]", { timeout: 8000 }).catch(() => {});
      check("phone: the popup opens by itself on the account", await page.locator("[data-referral-popup]").isVisible().catch(() => false));
      const title = (await page.locator("[data-referral-title]").innerText()).replace(/\s+/g, " ").trim();
      check("exact heading: Get up to $149 per referral", title === "Get up to $149 per referral", title);
      const lead = (await page.locator(".rf-lead").innerText()).trim();
      check("exact line: Refer a friend to Profixter. The Basic plan qualifies, too.", lead === "Refer a friend to Profixter. The Basic plan qualifies, too.", lead);
      check("exact primary button: Share my link", (await page.locator("[data-referral-share]").innerText()).trim() === "Share my link");
      check("exact secondary link: How it works", (await page.locator("[data-referral-how]").innerText()).trim() === "How it works");
      const sizes = await page.evaluate(() => [...document.querySelectorAll(".rf-sheet *")].filter((e) => e.childNodes.length && [...e.childNodes].some((n) => n.nodeType === 3 && n.textContent.trim())).map((e) => ({ t: e.textContent.trim().slice(0, 20), s: parseFloat(getComputedStyle(e).fontSize) })).sort((a, b) => b.s - a.s));
      check("$149 is the largest text in the popup, by far", sizes[0]?.t === "$149" && sizes[0].s >= 2.5 * (sizes[1]?.s || 99), JSON.stringify(sizes.slice(0, 3)));
      const buttons = await page.evaluate(() => [...document.querySelectorAll(".rf-sheet button")].filter((b) => getComputedStyle(b).backgroundColor === "rgb(48, 110, 236)").length);
      check("one blue button (ProFixter blue), and it is Share my link", buttons === 1 && (await style(page, "[data-referral-share]", "backgroundColor")) === "rgb(48, 110, 236)");
      const z = await zoom(page);
      const sb = await box(page, "[data-referral-share]");
      const vw = await page.evaluate(() => window.innerWidth);
      // getBoundingClientRect is already in screen pixels under the site's CSS zoom (z is reported only).
      check("Share my link is a big thumb target (48px+ on screen, nearly full width)", sb && sb.height >= 47 && sb.width > vw * 0.8, JSON.stringify({ sb, z, vw }));
      const sheet = await box(page, ".rf-sheet");
      const vh = await page.evaluate(() => window.innerHeight);
      check("a bottom sheet: anchored to the bottom, edge to edge", sheet && Math.abs(sheet.bottom - vh) < 3 && sheet.left < 1 && Math.abs(sheet.right - vw) < 1, JSON.stringify({ sheet, vh, vw }));
      const over = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
      check("no sideways scroll", over <= 1, String(over));
      check("the rules are folded away at first", !(await page.locator("[data-referral-rules]").isVisible()));
      await shot(page, "01-popup-phone");
      await page.click("[data-referral-how]");
      await wait(200);
      const rules = await page.locator("[data-referral-rules]").innerText();
      check("How it works: qualifying plans, one-time visit excluded", /Basic, Plus, Premium or Elite/.test(rules) && /one-time visit doesn.t qualify/i.test(rules));
      check("How it works: Pending after the first payment, ready after the second, mailed check", /Pending/.test(rules) && /second membership payment clears/.test(rules) && /mail you a check/.test(rules));
      check("How it works: the lesser of $149 or what was paid, after discounts and refunds, tax excluded, with the two examples", /lesser of \$149/.test(rules) && /discounts, promo codes and refunds/.test(rules) && /Tax/.test(rules) && /\$149\.00/.test(rules) && /\$134\.10/.test(rules));
      check("How it works: one per new household, not yourself", /One reward per new household/.test(rules) && /own account or home/.test(rules));
      check("How it works is announced as expanded", (await page.getAttribute("[data-referral-how]", "aria-expanded")) === "true");
      await page.locator("[data-referral-rules]").scrollIntoViewIfNeeded();
      await shot(page, "02-popup-how-it-works-phone");
      // Share: the native share sheet, with the personal link.
      await page.locator("[data-referral-share]").scrollIntoViewIfNeeded();
      await page.click("[data-referral-share]");
      await wait(300);
      const shares = await page.evaluate(() => window.__shares);
      check("Share my link opens the phone's share sheet with the personal link", shares.length === 1 && shares[0].url === URL_ && /Profixter/.test(shares[0].text), JSON.stringify(shares));
      check("after sharing: a thank-you, no copy fallback", (await page.locator("[data-referral-status='shared']").isVisible()) && !(await page.locator("[data-referral-url]").count()));
      await shot(page, "03-popup-shared-phone");
      await page.keyboard.press("Escape");
      await wait(200);
      check("Escape closes it", !(await page.locator("[data-referral-popup]").count()));
      check("no page errors", errors.length === 0, errors.join(" | "));
      check("no request left the machine", state.outside.length === 0, [...new Set(state.outside)].join(","));
      // Not again on the next visit.
      await page.reload({ waitUntil: "networkidle" });
      await wait(2000);
      check("it does not open by itself again on the next visit", !(await page.locator("[data-referral-popup]").count()));

      /* ---- the account card: rewards and the payee, with confirm-it's-you ---- */
      const card = page.locator("[data-account-referrals]");
      await card.scrollIntoViewIfNeeded();
      check("the account card: Refer a friend, up to $149, Share my link", /Refer a friend/.test(await card.innerText()) && /\$149/.test(await card.innerText()) && (await page.locator("[data-open-referral]").isVisible()));
      const items = await page.locator("[data-referral-reward]").allInnerTexts();
      check("the rewards: Ready $149.00 and Pending $134.10", items.length === 2 && /Ready/.test(items[0]) && /\$149\.00/.test(items[0]) && /Pending/.test(items[1]) && /\$134\.10/.test(items[1]), JSON.stringify(items));
      await shot(page, "04-account-referrals-phone");
      await page.locator("[data-referral-reward='eligible'] [data-referral-payee-open]").click();
      check("Confirm where to mail it: prefilled with the account's name and home", (await page.inputValue("[data-referral-payee-form] input[autocomplete='name']")) === "Maria Lopez" && (await page.inputValue("[data-referral-payee-form] input[autocomplete='address-line1']")) === "12 Oak Street");
      await page.fill("[data-referral-payee-form] input[autocomplete='address-line2']", "Apt 2");
      await page.click("[data-referral-payee-form] button[type='submit']");
      await page.waitForSelector("[data-referral-reauth]", { timeout: 5000 }).catch(() => {});
      check("saving asks to confirm it's you first (the server said REAUTH_REQUIRED)", (await page.locator("[data-referral-reauth]").isVisible()) && state.payees.length === 1 && !state.payees[0].reauthToken);
      await page.click("[data-referral-reauth] button:has-text('Text me a code')");
      await page.fill("[data-referral-reauth] input[autocomplete='one-time-code']", "123456");
      await page.click("[data-referral-reauth] button:has-text('Confirm and save')");
      await wait(500);
      check("after the code, it saves with the proof and shows where the check goes", state.payees.length === 2 && state.payees[1].reauthToken === "reauth-proof" && /Check to Maria Lopez, 12 Oak Street, Apt 2, Huntington, NY 11743/.test(await page.locator("[data-referral-reward='eligible']").innerText()), JSON.stringify(state.payees.at(-1)));
      await shot(page, "05-account-payee-saved-phone");
      check("no page errors (account)", errors.length === 0, errors.join(" | "));
      await ctx.close();
    }

    /* ------------------------------------------- a closed share sheet, and no Web Share at all */
    {
      const { ctx, page, errors } = await open(browser, { device: devices["iPhone 13"], me: CUSTOMER, share: "abort" });
      await page.goto(`${BASE}/account`, { waitUntil: "networkidle" });
      await page.waitForSelector("[data-referral-popup]", { timeout: 8000 });
      await shot(page, "06-popup-iphone");
      await page.click("[data-referral-share]");
      await wait(300);
      check("iPhone: closing the share sheet is not an error, and nothing else happens", (await page.evaluate(() => window.__shares.length)) === 1 && !(await page.locator("[data-referral-status]").count()) && errors.length === 0);
      await ctx.close();
    }
    {
      const { ctx, page, errors } = await open(browser, { viewport: { width: 1280, height: 860 }, me: CUSTOMER, share: "none" });
      await page.goto(`${BASE}/account`, { waitUntil: "networkidle" });
      await page.waitForSelector("[data-referral-popup]", { timeout: 8000 });
      const sheet = await box(page, ".rf-sheet");
      const vw = await page.evaluate(() => window.innerWidth);
      const vh = await page.evaluate(() => window.innerHeight);
      check("desktop: a centred card, not a sheet", sheet && Math.abs((sheet.left + sheet.right) / 2 - vw / 2) < 4 && Math.abs((sheet.top + sheet.bottom) / 2 - vh / 2) < 6 && sheet.width < 520, JSON.stringify({ sheet, vw, vh }));
      await shot(page, "07-popup-desktop");
      await page.click("[data-referral-share]");
      await wait(400);
      const clip = await page.evaluate(() => navigator.clipboard.readText().catch(() => ""));
      check("no Web Share: Copy link instead, and it says so", (await page.locator("[data-referral-status='copied']").isVisible()) && clip === URL_, clip);
      check("the link is shown too, to select by hand", (await page.inputValue("[data-referral-url]")) === URL_);
      await shot(page, "08-popup-copied-desktop");
      await page.click("[data-referral-close]");
      check("the close button closes it", !(await page.locator("[data-referral-popup]").count()));
      check("no page errors (desktop)", errors.length === 0, errors.join(" | "));
      await ctx.close();
    }

    /* ------------------------------------------- the friend's side: the link */
    {
      const { ctx, page, state, errors } = await open(browser, { device: devices["Pixel 7"], welcome: true });
      await page.goto(`${BASE}/r/${CODE}`, { waitUntil: "networkidle" });
      const u = new URL(page.url());
      check("/r/<code> lands on the homepage as a referral visit", u.pathname === "/" && u.searchParams.get("source") === "referral" && u.searchParams.get("ref") === CODE, page.url());
      check("a new visitor gets the welcome flow", await page.locator("[data-welcome]").isVisible().catch(() => false));
      const held = await page.evaluate(() => JSON.parse(localStorage.getItem("pf_referral") || "null"));
      check("the browser keeps the referral code", held?.code === CODE && Boolean(held.capturedAt), JSON.stringify(held));
      const touch = await page.evaluate(() => JSON.parse(localStorage.getItem("pf_touch") || "null"));
      check("first-touch attribution records it as a referral (unchanged mechanism)", touch?.refSource === "referral" && touch?.refCode === CODE, JSON.stringify(touch));
      await shot(page, "09-friend-lands-welcome");
      // The phone sign-up carries it.
      await page.goto(`${BASE}/signup`, { waitUntil: "networkidle" });
      await page.click(".auth-method--primary");
      await page.fill("#phone", "6315550123");
      await page.click(".auth-submit");
      await page.waitForSelector(".auth-otp");
      await page.fill(".auth-otp", "123456");
      await wait(400);
      if (await page.locator(".auth-submit").isVisible().catch(() => false)) await page.click(".auth-submit").catch(() => {});
      await wait(1500);
      check("the phone sign-up sends the referral with the new account", state.verifies.length >= 1 && state.verifies[0].referral?.code === CODE, JSON.stringify(state.verifies[0]?.referral));
      check("signed in, the browser claims it once and then forgets it", state.claims.length === 1 && state.claims[0].referral?.code === CODE && (await page.evaluate(() => localStorage.getItem("pf_referral"))) === null, JSON.stringify(state.claims));
      check("no page errors (friend)", errors.length === 0, errors.join(" | "));
      check("no request left the machine (friend)", state.outside.length === 0, [...new Set(state.outside)].join(","));
      await ctx.close();
    }
    {
      const { ctx, page } = await open(browser, { viewport: { width: 1280, height: 860 } });
      await page.goto(`${BASE}/?ref=83000001`, { waitUntil: "networkidle" });
      check("the 2025 link /?ref=<8-digit account number> is still kept", (await page.evaluate(() => JSON.parse(localStorage.getItem("pf_referral") || "{}").code)) === "83000001");
      await page.goto(`${BASE}/?source=referral&ref=MIKE1234`, { waitUntil: "networkidle" });
      check("a telemarketer's sales code is not a customer referral (the earlier code is kept)", (await page.evaluate(() => JSON.parse(localStorage.getItem("pf_referral") || "{}").code)) === "83000001");
      await page.goto(`${BASE}/?source=event&ref=${CODE}`, { waitUntil: "networkidle" });
      check("a ref on an event link is not a referral", (await page.evaluate(() => JSON.parse(localStorage.getItem("pf_referral") || "{}").code)) === "83000001");
      await ctx.close();
    }
    {
      // A friend who already has an account, signed in, the claim failing (server trouble): the code is kept.
      // (The membership checkout then carries it: pinned in test_welcome_flow_ui, membership path.)
      const { ctx, page, state } = await open(browser, { viewport: { width: 1280, height: 900 }, me: { ...CUSTOMER, _id: "c9", userId: "83000009", name: "Cara Checkout" }, initial: { pf_referral: JSON.stringify({ code: CODE, capturedAt: new Date().toISOString() }) } });
      await ctx.route(/api\.profixter\.com\/api\/referrals\/claim/, (route) => route.fulfill({ status: 503, headers: { "access-control-allow-origin": "*" }, body: "{}" }));
      await page.goto(`${BASE}/membership/plans`, { waitUntil: "networkidle" });
      await wait(800);
      check("a failed claim keeps the code for later", (await page.evaluate(() => JSON.parse(localStorage.getItem("pf_referral") || "{}").code)) === CODE);
      await ctx.close();
    }

    /* ------------------------------------------- Admin > Referrals */
    {
      const { ctx, page } = await open(browser, { viewport: { width: 1280, height: 900 }, me: STAFF });
      await page.goto(`${BASE}/admin/referrals`, { waitUntil: "networkidle" });
      await wait(800);
      check("Admin > Referrals: staff see a permission screen, not the rewards", !(await page.locator("[data-referral-list]").count()));
      await ctx.close();
    }
    {
      const { ctx, page, state, errors } = await open(browser, { device: devices["Pixel 7"], me: OWNER });
      await page.goto(`${BASE}/admin/more`, { waitUntil: "networkidle" });
      check("owner: Referrals is listed under More", (await page.locator("a[href='/admin/referrals']").count()) >= 1);
      await page.goto(`${BASE}/admin/referrals`, { waitUntil: "networkidle" });
      await page.waitForSelector("[data-referral-list]", { timeout: 10000 });
      const row = await page.locator("[data-referral-list] li").first().innerText();
      check("the list: referrer, friend, plan, amount, Ready, flag count", /Maria Lopez/.test(row) && /Ann Baker/.test(row) && /Basic/.test(row) && /\$134\.10/.test(row) && /Ready/.test(row) && /1 flag/.test(row), row);
      await shot(page, "10-admin-list-phone");
      await page.locator("[data-referral-list] li a").first().click();
      await page.waitForSelector("[data-referral-detail]", { timeout: 10000 });
      const detail = await page.locator("[data-referral-detail]").innerText();
      check("the detail: both payments with the promotion code, tax not counted, the reward as the lesser of", /SAVE10/.test(detail) && /Tax \(not counted\)/.test(detail) && /Reward \(the lesser\)/.test(detail) && /\$134\.10/.test(detail) && /2nd payment/.test(detail));
      check("approve is disabled until the flags and payee are done", await page.locator("[data-approve]").isDisabled());
      await shot(page, "11-admin-detail-phone");
      await page.fill("[data-flag-note]", "Ann told me Maria sent her the link");
      await page.click("[data-clear-flags]");
      await wait(400);
      await page.click("button:has-text('Enter it after confirming with them')");
      await page.fill("[data-owner-payee-form] input >> nth=0", "Maria Lopez");
      await page.fill("[data-owner-payee-form] input >> nth=1", "12 Oak Street");
      await page.fill("[data-owner-payee-form] input >> nth=3", "Huntington");
      await page.fill("[data-owner-payee-form] input >> nth=5", "11743");
      await page.fill("[data-owner-payee-form] input >> nth=6", "Called Maria at her account number");
      await page.click("[data-owner-payee-form] button:has-text('Save payee')");
      await wait(500);
      check("flags checked and payee saved: the owner's note is required and sent", state.admin.calls.some((c) => c.action === "flags/clear" && /Maria sent/.test(c.body.note)) && state.admin.calls.some((c) => c.action === "payee" && /Called Maria/.test(c.body.note)));
      await page.check("[data-payee-checked]");
      await page.click("[data-approve]");
      await wait(600);
      const changes = await page.locator("[data-referral-changes]").innerText().catch(() => "");
      check("approve: the server's recheck refusal is shown with what Stripe changed", /\$125\.00/.test(changes), changes);
      check("and the new amount is on the button", /\$125\.00/.test(await page.locator("[data-approve]").innerText()));
      await page.click("[data-approve]");
      await wait(600);
      const approved = state.admin.calls.filter((c) => c.action === "approve");
      check("approve again sends the amount the owner now sees and the payee tick", approved.length === 2 && approved[1].body.expectedAmountCents === 12500 && approved[1].body.payeeConfirmed === true, JSON.stringify(approved));
      await page.waitForSelector("[data-check-reference]", { timeout: 5000 });
      await page.fill("[data-check-reference]", "Check 1042");
      await page.click("[data-mark-mailed]");
      await wait(600);
      check("mark mailed with the check number", state.admin.calls.some((c) => c.action === "mailed" && c.body.reference === "Check 1042") && /Check 1042/.test(await page.locator("[data-referral-check]").innerText()));
      await shot(page, "12-admin-mailed-phone");
      const over = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
      check("Admin on a phone: no sideways scroll", over <= 1, String(over));
      check("no page errors (admin)", errors.length === 0, errors.join(" | "));
      await ctx.close();
    }
  } finally {
    await browser.close();
  }
  console.log(`\n${results.filter(Boolean).length}/${results.length} passed`);
  process.exit(results.every(Boolean) ? 0 : 1);
})().catch((e) => {
  console.error(e);
  process.exit(1);
});
