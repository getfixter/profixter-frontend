/*
 * The tracking release, checked in a real browser (2026-11-20).
 *
 *   node scripts/test_tracking_release_ui.js [port]     (a production build served on 127.0.0.1:<port>, default 3123)
 *
 * The build is opened under real host names, mapped to this machine by the
 * browser (--host-resolver-rules): www.profixter.com and profixter.com (where
 * trackers must run), and preview.profixter.com / localhost (any other host:
 * a Vercel preview or a local build, where nothing may be sent).
 *
 * NOTHING LEAVES THIS MACHINE. Every request to any other host is answered here:
 * api.profixter.com by a stub, and the tracker vendors (Google, Meta, OpenAI,
 * Clarity) with an empty response, so no vendor SDK ever runs and no event is
 * sent. What a vendor WOULD read is checked where it reads it: the URL each
 * loader requests, window.dataLayer, the fbq queue, document.referrer and
 * location, and our own beacons' bodies.
 *
 * What it pins:
 *  1. Production hosts load GTM, the Meta Pixel and the visit beacon (the guard is not simply off).
 *  2. Any other host loads none of them and sends no first-party beacon or Conversions API relay.
 *  3. A gift claim link's token never appears in a tracker request, the dataLayer,
 *     the fbq queue, a beacon, the page referrer, a URL after sign-in, or stored
 *     attribution - only in the one browser key that carries it across sign-in.
 */
const { chromium } = require("playwright");

const PORT = Number(process.argv[2] || 3123);
const API = "https://api.profixter.com";
const TOKEN = "giftTok9Q7xZsecretVALUE42";
const PAY_TOKEN = "payTok5Rr8secretVALUE77";
const TIP_TOKEN = "tipTok3Kq1secretVALUE19";
const SIGN_TOKEN = "signTok8Lm2secretVALUE64";
const SESSION = "sess-tracking-release";
const HOSTS = ["www.profixter.com", "profixter.com", "preview.profixter.com"];
const UA = "Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.0 Mobile/15E148 Safari/604.1";

const results = [];
function check(name, pass, detail = "") {
  results.push({ name, pass: !!pass });
  console.log(`${pass ? "PASS" : "FAIL"}  ${name}${detail ? "  :: " + detail : ""}`);
}

const VENDOR = /(googletagmanager\.com|google-analytics\.com|googleadservices\.com|doubleclick\.net|facebook\.(net|com)|clarity\.ms|openai\.com|bing\.com)/;

async function fresh(browser, { trackersOptIn = false } = {}) {
  const ctx = await browser.newContext({ userAgent: UA, viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true });
  await ctx.addInitScript((optIn) => {
    // A real visitor's browser: webdriver off, so the beacons behave as for customers.
    Object.defineProperty(Navigator.prototype, "webdriver", { get: () => false });
    try {
      localStorage.setItem("pf_welcome", "home");
      localStorage.setItem("profixter_promotion_popup_dismissed_date", new Date().toISOString().slice(0, 10));
      if (optIn) localStorage.setItem("pf_trackers_allow_host", "1");
    } catch {}
  }, trackersOptIn);
  const log = { requests: [], vendor: [], beacons: [], external: [] };
  const user = { _id: "u1", userId: "PF-1", name: "Gift Recipient", email: "rec@example.com", emailVerified: true, phone: "+16315550199", phoneVerified: true, role: "customer", addresses: [{ _id: "a1", line1: "1 Elm St", city: "Huntington", state: "NY", zip: "11743", label: "Primary" }] };
  let claimed = false;
  await ctx.route("**/*", async (route) => {
    const req = route.request();
    const url = new URL(req.url());
    const entry = { url: req.url(), method: req.method(), body: req.postData() || "", referer: req.headers()["referer"] || "", host: url.hostname };
    log.requests.push(entry);
    if (url.hostname === "127.0.0.1" || url.hostname === "localhost" || HOSTS.includes(url.hostname)) {
      if (url.pathname === "/__gtm-test.js" || url.pathname === "/__fbevents-test.js") log.vendor.push(entry);
      return route.continue();
    }
    if (url.origin === API) {
      const cors = { "access-control-allow-origin": req.headers()["origin"] || "*", "access-control-allow-credentials": "true", "access-control-allow-headers": "Authorization,Content-Type", "access-control-allow-methods": "GET,POST,PUT,PATCH,DELETE,OPTIONS" };
      const json = (status, body) => route.fulfill({ status, contentType: "application/json", headers: cors, body: JSON.stringify(body) });
      const p = url.pathname;
      if (req.method() === "OPTIONS") return route.fulfill({ status: 204, headers: cors });
      if (p.startsWith("/api/track") || p.startsWith("/api/facebook")) {
        log.beacons.push(entry);
        return route.fulfill({ status: 204, headers: cors });
      }
      if (p === "/api/auth/me") return (req.headers()["authorization"] || "").includes(SESSION) ? json(200, user) : json(401, {});
      if (p === `/api/gifts/claim/${TOKEN}` && req.method() === "GET") {
        return json(200, { hasAccount: true, gift: { plan: "plus", durationMonths: 3, from: "Ann", recipientEmailHint: "re•@example.com", recipientFirstName: "Rec", occasion: "neutral", personalMessage: "" } });
      }
      if (p === `/api/gifts/claim/${TOKEN}/details`) return json(200, { recipientEmail: "rec@example.com", recipientLastName: "Ipient", addressSnapshot: null });
      if (p === `/api/gifts/claim/${TOKEN}` && req.method() === "POST") {
        claimed = true;
        return json(200, { message: "ok", gift: { plan: "plus", durationMonths: 3, from: "Ann", startAt: new Date().toISOString(), endAt: new Date(Date.now() + 90 * 864e5).toISOString(), activeThrough: new Date(Date.now() + 90 * 864e5).toISOString(), queued: false } });
      }
      if (p.startsWith("/api/service-area")) return json(200, { inServiceArea: true, serviceable: true, supported: true });
      // The other token pages (2026-11-20): a payment link, a tip link, a signing link.
      if (p === `/api/pay/${PAY_TOKEN}` && req.method() === "GET") return json(200, { status: "open", kind: "extra_charge", itemLabel: "Faucet parts", expiresAt: new Date(Date.now() + 864e5).toISOString() });
      if (p === `/api/pay/${PAY_TOKEN}/checkout`) return json(200, { url: "https://checkout.stripe.com/c/pay/cs_test_pay" });
      if (p === "/api/tips/session") {
        log.tipBodies = [...(log.tipBodies || []), entry.body];
        // Answered after a pause, so the page can be inspected before it moves on to Stripe.
        await new Promise((r) => setTimeout(r, 3000));
        return json(200, { url: "https://checkout.stripe.com/c/pay/cs_test_tip" });
      }
      if (p === `/api/sign/${SIGN_TOKEN}`) return json(200, { state: "expired", message: "This signing link has expired." });
      return json(200, {});
    }
    // Any vendor or other outside host: answered here, empty. Recorded, never sent.
    if (VENDOR.test(url.hostname)) log.vendor.push(entry);
    else log.external.push(entry);
    return route.fulfill({ status: 200, contentType: url.pathname.endsWith(".js") ? "application/javascript" : "text/plain", body: "" });
  });
  const page = await ctx.newPage();
  page.on("dialog", (d) => d.dismiss());
  return { ctx, page, log, claimedRef: () => claimed };
}

const at = (host, path) => `http://${host}:${PORT}${path}`;
async function open(page, url, referer) {
  await page.goto(url, { waitUntil: "load", referer }).catch(() => {});
  await page.waitForTimeout(1500);
}
async function pageState(page) {
  return page.evaluate(() => {
    const dump = (s) => {
      const out = {};
      try {
        for (let i = 0; i < s.length; i++) out[s.key(i)] = s.getItem(s.key(i));
      } catch {}
      return out;
    };
    let fbq = [];
    try {
      fbq = (window.fbq && (window.fbq.queue || [])).map((a) => Array.from(a));
    } catch {}
    let dl = [];
    try {
      dl = JSON.parse(JSON.stringify(window.dataLayer || [], (k, v) => (typeof v === "function" ? "fn" : v instanceof Node ? "node" : v)));
    } catch {}
    return { href: location.href, referrer: document.referrer, local: dump(localStorage), session: dump(sessionStorage), cookie: document.cookie, dataLayer: dl, fbq };
  });
}

(async () => {
  const browser = await chromium.launch({
    args: [`--host-resolver-rules=${HOSTS.map((h) => `MAP ${h} 127.0.0.1`).join(",")}`],
  });

  /* ---------------------------------------------------------- 1. production hosts */
  for (const host of ["www.profixter.com", "profixter.com"]) {
    const { ctx, page, log } = await fresh(browser);
    await open(page, at(host, "/membership/plans?utm_source=test"), "https://www.google.com/");
    const urls = log.vendor.map((r) => r.url);
    check(`${host}: GTM loads`, urls.some((u) => u.startsWith("https://www.googletagmanager.com/gtm.js")), urls.join(" | ").slice(0, 200));
    check(`${host}: the Meta Pixel loads`, urls.some((u) => u.includes("connect.facebook.net")));
    check(`${host}: the first-visit beacon is sent`, log.beacons.some((b) => b.url.endsWith("/api/track/visit")));
    await ctx.close();
  }

  /* ---------------------------------------------------- 2. preview and local hosts */
  for (const host of ["preview.profixter.com", "127.0.0.1"]) {
    const { ctx, page, log } = await fresh(browser);
    await open(page, at(host, "/membership/plans?utm_source=test&fbclid=FBtest"), "https://www.google.com/");
    // Move around so step and event code runs too.
    await open(page, at(host, "/"));
    await open(page, at(host, "/book/handyman"));
    const st = await pageState(page);
    check(`${host}: no tracker loader requested (GTM, Meta, Clarity, OpenAI or a test path)`, log.vendor.length === 0, log.vendor.map((r) => r.url).join(" | "));
    check(`${host}: no first-party beacon or Conversions API relay`, log.beacons.length === 0, log.beacons.map((r) => r.url).join(" | "));
    check(`${host}: no other outside host contacted`, log.external.length === 0, log.external.map((r) => r.url).join(" | ").slice(0, 300));
    check(`${host}: the fbq stub was never created`, !st.fbq.length);
    await ctx.close();
  }

  /* --------------------------------------------------------- 3. the gift claim token */
  {
    const { ctx, page, log, claimedRef } = await fresh(browser);
    // From the email (an outside referrer), with the tags an email link might carry.
    await open(page, at("www.profixter.com", `/gift/claim/${TOKEN}?utm_source=gift_email&utm_medium=email&fbclid=FBgift`), "https://mail.example.com/");
    const onClaim = await pageState(page);
    check("claim page: no tracker loader requested", log.vendor.length === 0, log.vendor.map((r) => r.url).join(" | "));
    check("claim page: no first-party beacon", log.beacons.length === 0, log.beacons.map((r) => r.url).join(" | "));
    check("claim page: the gift is shown", (await page.locator("text=Sign in to claim").count()) > 0);
    const holders = Object.entries({ ...onClaim.local, ...onClaim.session }).filter(([, v]) => String(v).includes(TOKEN)).map(([k]) => k);
    check("claim page: the token is stored under pf_gift_claim only", holders.length === 1 && holders[0] === "pf_gift_claim", holders.join(","));
    check("claim page: no cookie carries the token", !onClaim.cookie.includes(TOKEN));
    const attr = onClaim.local.pf_attribution || "";
    check("claim page: stored attribution lands on /gift/claim, without the token", !attr.includes(TOKEN), attr.slice(0, 200));
    const referrerMeta = await page.evaluate(() => document.querySelector('meta[name="referrer"]')?.getAttribute("content") || "");
    check("claim page: sends no referrer", referrerMeta === "no-referrer", referrerMeta);

    // A full-page move to sign-in (a new document: here the trackers DO load).
    await page.evaluate(() => {
      const a = Array.from(document.querySelectorAll("a")).find((x) => /Sign in to claim/.test(x.textContent || ""));
      location.assign(a.getAttribute("href"));
    });
    await page.waitForLoadState("load").catch(() => {});
    await page.waitForTimeout(2000);
    const onSignIn = await pageState(page);
    check("sign-in page: the URL carries no token", !onSignIn.href.includes(TOKEN) && onSignIn.href.includes("next=%2Fgift%2Fclaim%2Fresume"), onSignIn.href);
    check("sign-in page: trackers did load here (so the next checks mean something)", log.vendor.some((r) => r.url.startsWith("https://www.googletagmanager.com/gtm.js")));
    check("sign-in page: document.referrer carries no token", !onSignIn.referrer.includes(TOKEN), JSON.stringify(onSignIn.referrer));
    check("sign-in page: the dataLayer carries no token", !JSON.stringify(onSignIn.dataLayer).includes(TOKEN));
    check("sign-in page: the fbq queue carries no token", !JSON.stringify(onSignIn.fbq).includes(TOKEN));

    // Signed in (the stubbed session), back to the resume page; claim.
    await page.evaluate((s) => localStorage.setItem("token", s), SESSION);
    await open(page, at("www.profixter.com", "/gift/claim/resume"));
    const claimBtn = page.locator("button", { hasText: /claim/i }).last();
    await claimBtn.click({ timeout: 8000 }).catch(() => {});
    await page.waitForTimeout(1500);
    check("resume: the remembered token claims the gift", claimedRef());
    const afterClaim = await pageState(page);
    check("resume: the URL carries no token", !afterClaim.href.includes(TOKEN), afterClaim.href);
    check("after the claim: the token is gone from this browser", !JSON.stringify({ ...afterClaim.local, ...afterClaim.session }).includes(TOKEN));

    // Then an ordinary page on the live site.
    await open(page, at("www.profixter.com", "/membership/plans"));
    const later = await pageState(page);
    check("later pages: dataLayer and fbq carry no token", !JSON.stringify(later.dataLayer).includes(TOKEN) && !JSON.stringify(later.fbq).includes(TOKEN));

    // Our own pages may be requested at /gift/claim/<token> (that is the link); everything else - vendors, beacons, the rest of the API - may not see it at all.
    const ownHost = (h) => HOSTS.includes(h) || h === "127.0.0.1";
    const leaks = log.requests.filter((r) => {
      if (r.url.startsWith(`${API}/api/gifts/`)) return false;
      if (ownHost(r.host)) return new URL(r.url).pathname !== `/gift/claim/${TOKEN}` && (r.url.includes(TOKEN) || r.body.includes(TOKEN));
      return r.url.includes(TOKEN) || r.body.includes(TOKEN) || r.referer.includes(TOKEN);
    });
    check("whole journey: no request outside the gift API carries the token in its URL, body or Referer", leaks.length === 0, leaks.map((r) => `${r.method} ${r.url.slice(0, 120)} ref=${r.referer.slice(0, 80)}`).join(" | "));
    const beaconLeaks = log.beacons.filter((b) => (b.url + b.body).includes(TOKEN));
    check("whole journey: no visit/step beacon or relay carries the token", beaconLeaks.length === 0 && log.beacons.length > 0, `${log.beacons.length} beacons`);
    const visit = log.beacons.find((b) => b.url.endsWith("/api/track/visit"));
    // A browser that arrived by a gift link lands on /gift/claim, a tracker-free page, so it is not recorded as a site visit at all (lib/meta recordFirstVisit).
    check("no first-visit record carries the token", !visit || !visit.body.includes(TOKEN), visit ? visit.body.slice(0, 200) : "none sent (landing page is tracker-free)");
    await ctx.close();
  }

  /* ------------------------------------- 5. the other token pages: /pay, /tip, /sign (2026-11-20) */
  const tokenPage = async ({ label, path, secret, act, expect }) => {
    const { ctx, page, log } = await fresh(browser);
    await open(page, at("www.profixter.com", path), "https://mail.example.com/");
    const st = await pageState(page);
    check(`${label}: the link still works`, await expect(page), (await page.locator("main, body").first().innerText().catch(() => "")).slice(0, 120));
    check(`${label}: no tracker loader requested`, log.vendor.length === 0, log.vendor.map((r) => r.url).join(" | "));
    check(`${label}: no first-party beacon`, log.beacons.length === 0, log.beacons.map((r) => r.url).join(" | "));
    const meta = await page.evaluate(() => document.querySelector('meta[name="referrer"]')?.getAttribute("content") || "");
    check(`${label}: sends no referrer`, meta === "no-referrer", meta);
    const stored = JSON.stringify({ ...st.local, ...st.session }) + st.cookie;
    check(`${label}: the token is stored nowhere in the browser`, !stored.includes(secret), Object.keys({ ...st.local, ...st.session }).join(","));
    // A full-page move from the token page itself to an ordinary page on the live site, where the trackers run.
    await page.evaluate((u) => location.assign(u), at("www.profixter.com", "/membership/plans"));
    await page.waitForLoadState("load").catch(() => undefined);
    await page.waitForTimeout(1500);
    const after = await pageState(page);
    check(`${label}: the move reached a tracked page`, /membership\/plans/.test(after.href) && log.vendor.some((r) => r.url.startsWith("https://www.googletagmanager.com/gtm.js")), after.href);
    check(`${label}: the next tracked page sees no token (referrer, dataLayer, fbq, storage)`, !after.referrer.includes(secret) && !JSON.stringify(after.dataLayer).includes(secret) && !JSON.stringify(after.fbq).includes(secret) && !JSON.stringify(after.local).includes(secret), JSON.stringify(after.referrer));
    const leaks = log.requests.filter((r) => {
      if (r.url.startsWith(`${API}/api/`) && !r.url.includes("/api/track")) return false;
      if (HOSTS.includes(r.host) || r.host === "127.0.0.1") return !new URL(r.url).href.includes(path) && (r.url.includes(secret) || r.body.includes(secret));
      return r.url.includes(secret) || r.body.includes(secret) || r.referer.includes(secret);
    });
    if (act) {
      await open(page, at("www.profixter.com", path), "https://mail.example.com/");
      await act(page, log);
    }
    check(`${label}: no tracker, beacon or outside request carries the token (URL, body or Referer)`, leaks.length === 0, leaks.map((r) => `${r.url.slice(0, 90)} ref=${r.referer.slice(0, 60)}`).join(" | "));
    await ctx.close();
  };

  await tokenPage({
    label: "/pay",
    path: `/pay/${PAY_TOKEN}`,
    secret: PAY_TOKEN,
    expect: async (page) => /Faucet parts/.test(await page.locator("body").innerText()),
    act: async (page, log) => {
      const button = page.locator("button", { hasText: /Pay securely/ }).first();
      await button.click({ timeout: 5000 }).catch(() => undefined);
      await page.waitForTimeout(1500);
      const toStripe = log.requests.find((r) => r.host === "checkout.stripe.com");
      check("/pay: paying opens the Stripe page", Boolean(toStripe), page.url());
      check("/pay: Stripe is not told the payment link (no Referer)", toStripe && !toStripe.referer.includes(PAY_TOKEN), toStripe ? JSON.stringify(toStripe.referer) : "");
    },
  });
  await tokenPage({
    label: "/tip",
    path: `/tip?t=${TIP_TOKEN}`,
    secret: TIP_TOKEN,
    expect: async () => true,
    act: async (page, log) => {
      await page.waitForTimeout(3500);
      const toStripe = log.requests.find((r) => r.host === "checkout.stripe.com");
      check("/tip: the tip link opens the Stripe page with its token sent to our API", Boolean(toStripe) && (log.tipBodies || []).some((b) => b.includes(TIP_TOKEN)), page.url());
      check("/tip: Stripe is not told the tip link (no Referer)", toStripe && !toStripe.referer.includes(TIP_TOKEN), toStripe ? JSON.stringify(toStripe.referer) : "");
    },
  });
  await tokenPage({
    label: "/sign",
    path: `/sign/${SIGN_TOKEN}`,
    secret: SIGN_TOKEN,
    expect: async (page) => /Link expired/i.test(await page.locator("body").innerText()),
  });

  /* ------------------------------- 4. a browser that stored the token under an earlier build */
  {
    const { ctx, page } = await fresh(browser);
    await open(page, at("www.profixter.com", "/membership/plans"));
    await page.evaluate((t) => {
      localStorage.setItem("pf_first_seen", JSON.stringify({ firstLandingPath: `/gift/claim/${t}`, firstSeenAt: Date.now() - 864e5 }));
      localStorage.setItem("pf_touch", JSON.stringify({ landingPath: `/gift/claim/${t}`, firstSeenAt: Date.now() - 864e5 }));
    }, TOKEN);
    await open(page, at("www.profixter.com", "/"));
    const st = await pageState(page);
    check("an earlier build's stored token is cut to /gift/claim on the next page", !JSON.stringify(st.local).includes(TOKEN) && /\/gift\/claim"/.test(st.local.pf_first_seen || ""), (st.local.pf_first_seen || "").slice(0, 120));
    await ctx.close();
  }

  await browser.close();
  const failed = results.filter((r) => !r.pass);
  console.log(`\n${results.length - failed.length}/${results.length} passed`);
  process.exit(failed.length ? 1 : 0);
})().catch((e) => {
  console.error(e);
  process.exit(1);
});
