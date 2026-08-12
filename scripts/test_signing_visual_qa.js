/**
 * Signing UI — rendered visual QA.
 *
 * Drives the real customer signing page in a real browser across the required
 * viewport matrix and MEASURES the layout rather than eyeballing it. The
 * defects this catches - horizontal overflow, a sticky bar covering the thing
 * you need to tap, a signature pad too small to sign on, tap targets under the
 * touch guideline - are all objectively measurable, and measuring them makes
 * this a regression guard instead of a one-off inspection.
 *
 * The backend is stubbed with route interception, so this runs with no server,
 * no database and no signing token.
 *
 *   npm run build && npm run test:signing-visual-qa
 *
 * Requires the production server on PORT (default 3000).
 */

const { chromium } = require("playwright");

const BASE = process.env.QA_BASE_URL || "http://127.0.0.1:3000";
const TOKEN = "qa-token-0000000000000000000000000000000000000000";

/** Realistic device sizes, not just widths. */
const VIEWPORTS = [
  { name: "phone-375", width: 375, height: 667 },
  { name: "phone-390", width: 390, height: 844 },
  { name: "phone-430", width: 430, height: 932 },
  { name: "tablet-768-portrait", width: 768, height: 1024 },
  { name: "tablet-1024-landscape", width: 1024, height: 768 },
  { name: "desktop-1440", width: 1440, height: 900 },
];

/** Deliberately awkward content: long Long Island address, long name. */
const LONG_NAME = "Konstantinos Papadopoulos-Wetherington III";
const LONG_ADDRESS =
  "1247 Old Country Road, Building C, Apartment 14B, Hauppauge, Suffolk County, New York 11788-4021";

const DISCLOSURE_SECTIONS = [
  { title: "Signing electronically", body: "You are about to sign this document electronically. ".repeat(3) },
  { title: "What this consent covers", body: "Your consent applies to this document only. ".repeat(3) },
  { title: "Getting a paper copy", body: "You may ask for a paper copy at any time at no charge. ".repeat(3) },
  { title: "If you would rather not sign electronically", body: "You can withdraw consent before signing. ".repeat(3) },
  { title: "After you sign", body: "Once you sign, this consent has done its job. ".repeat(3) },
  { title: "Keeping your contact details current", body: "Tell us if your email changes. ".repeat(3) },
  { title: "What you need to sign and keep a copy", body: "A device with an up-to-date browser. ".repeat(3) },
];

function payload(state, overrides = {}) {
  if (state !== "ready") {
    return { state, message: "This link is no longer active.", company: { legalName: "Premium Island Homes Inc.", phone: "631-599-1363", email: "x@y.com" } };
  }
  return {
    state: "ready",
    documentLabel: "Home Improvement Agreement #000010",
    documentType: "CONTRACT",
    customerName: LONG_NAME,
    propertyAddress: LONG_ADDRESS,
    company: { legalName: "Premium Island Homes Inc.", phone: "631-599-1363", email: "x@y.com" },
    disclosure: {
      version: "PIH-ESIGN-DISCLOSURE-2026-001",
      sections: DISCLOSURE_SECTIONS,
      consentLabel:
        "I have read the information above. I agree to use electronic records and an electronic signature for this document, and I confirm I can open and read the PDF on this device.",
      signIntent:
        "By selecting Sign Agreement, I am signing this document. I have reviewed it in full, I intend my electronic signature to be my signature on it, and I understand it is legally binding once both parties have signed.",
      padInstruction: "Draw your signature below using your finger, a stylus, or your mouse.",
    },
    signingMode: "REMOTE",
    expiresAt: new Date(Date.now() + 86400000).toISOString(),
    ...overrides,
  };
}

let passed = 0;
const defects = [];

function record(viewport, surface, ok, detail) {
  if (ok) {
    passed += 1;
  } else {
    defects.push(`[${viewport}] ${surface}: ${detail}`);
    console.log(`  DEFECT  [${viewport}] ${surface}: ${detail}`);
  }
}

/** The single most common mobile layout bug. */
async function checkNoHorizontalOverflow(page, viewport, surface) {
  const overflow = await page.evaluate(() => {
    const doc = document.documentElement;
    return { scroll: doc.scrollWidth, client: doc.clientWidth };
  });
  record(
    viewport,
    surface,
    overflow.scroll <= overflow.client + 1,
    `horizontal overflow: content ${overflow.scroll}px in ${overflow.client}px viewport`
  );
}

/** Any control the customer must reach has to clear the sticky bar. */
async function checkStickyBarDoesNotCover(page, viewport, surface, selector) {
  const el = page.locator(selector).first();
  if (await el.count()) await el.scrollIntoViewIfNeeded().catch(() => {});
  const result = await page.evaluate((sel) => {
    const target = document.querySelector(sel);
    const bars = Array.from(document.querySelectorAll("div")).filter((el) => {
      const style = getComputedStyle(el);
      return style.position === "fixed" && el.getBoundingClientRect().bottom >= window.innerHeight - 2;
    });
    if (!target || !bars.length) return null;
    const t = target.getBoundingClientRect();
    const bar = bars[0].getBoundingClientRect();
    return { targetBottom: t.bottom, targetTop: t.top, barTop: bar.top, visible: t.height > 0 };
  }, selector);
  if (!result || !result.visible) return;
  record(
    viewport,
    surface,
    result.targetTop < result.barTop,
    `sticky bar covers ${selector} (element top ${Math.round(result.targetTop)} vs bar top ${Math.round(result.barTop)})`
  );
}

/**
 * Refuse to run against a stale server.
 *
 * A previous `next start` holding the port will happily serve an older build,
 * which produced a false 404 "defect" during this work. Verify the route the
 * QA depends on actually exists before drawing any conclusions from it.
 */
async function assertFreshServer() {
  let response;
  try {
    response = await fetch(`${BASE}/sign/${TOKEN}`, { redirect: "manual" });
  } catch (error) {
    throw new Error(
      `No server reachable at ${BASE}. Run \`npm run build && npx next start\` first. (${error.message})`
    );
  }
  if (response.status !== 200) {
    throw new Error(
      `${BASE}/sign/:token returned ${response.status}. The running server is serving a build ` +
        "without the signing route - stop it and restart from a current build."
    );
  }
  const html = await response.text();
  // Next.js embeds the not-found boundary in every page's payload, so absence
  // of 404 text proves nothing. Look for this route's own metadata instead.
  if (!html.includes("Sign Document")) {
    throw new Error(
      "The signing route did not render its own page: the server is serving a stale build. " +
        "Stop it and restart from a current build."
    );
  }
}

async function main() {
  await assertFreshServer();
  const browser = await chromium.launch({ headless: true });

  try {
    for (const vp of VIEWPORTS) {
      const context = await browser.newContext({
        viewport: { width: vp.width, height: vp.height },
        hasTouch: vp.width < 1024,
      });
      const page = await context.newPage();

      // Stub the signing API. No server, no token, no database.
      await page.route("**/api/sign/**", async (route) => {
        const url = route.request().url();
        const request = route.request();

        /*
         * The page is served from localhost while NEXT_PUBLIC_API_URL points at
         * the production API host, so every stubbed call is cross-origin. A
         * POST carrying application/json is not a "simple" request, so the
         * browser sends an OPTIONS preflight first - and a fulfilled response
         * without CORS headers fails it, blocking the POST before it is ever
         * sent. That is a harness concern only: the real backend sets CORS.
         */
        const cors = {
          "Access-Control-Allow-Origin": "*",
          "Access-Control-Allow-Methods": "GET,POST,OPTIONS",
          "Access-Control-Allow-Headers": "Content-Type",
        };
        if (request.method() === "OPTIONS") {
          return route.fulfill({ status: 204, headers: cors, body: "" });
        }
        if (url.endsWith("/document")) {
          // A minimal valid PDF so the iframe has something real to lay out.
          return route.fulfill({
            status: 200,
            headers: cors,
            contentType: "application/pdf",
            body: Buffer.from(
              "%PDF-1.4\n1 0 obj<</Type/Catalog/Pages 2 0 R>>endobj\n2 0 obj<</Type/Pages/Kids[3 0 R]/Count 1>>endobj\n3 0 obj<</Type/Page/Parent 2 0 R/MediaBox[0 0 612 792]>>endobj\ntrailer<</Root 1 0 R>>\n%%EOF"
            ),
          });
        }
        if (route.request().method() === "POST") {
          return route.fulfill({ status: 200, headers: cors, contentType: "application/json", body: JSON.stringify({ state: "completed", message: "Thank you.", executedDocumentAvailable: true }) });
        }
        return route.fulfill({ status: 200, headers: cors, contentType: "application/json", body: JSON.stringify(payload("ready")) });
      });

      /* ---------- review ---------- */
      await page.goto(`${BASE}/sign/${TOKEN}`, { waitUntil: "domcontentloaded" });
      await page.getByRole("heading", { name: /Review your/i }).waitFor({ timeout: 20000 });
      await checkNoHorizontalOverflow(page, vp.name, "remote/review");

      // Long name and address must wrap, not push the page wide.
      const nameBox = await page.locator(`text=${LONG_NAME}`).first().boundingBox();
      record(vp.name, "remote/review", !nameBox || nameBox.width <= vp.width, `long customer name overflows (${nameBox && Math.round(nameBox.width)}px)`);

      // The document must occupy a usable share of the screen.
      const frame = await page.locator("iframe").first().boundingBox();
      record(vp.name, "remote/review", Boolean(frame) && frame.height >= 220, `PDF review area too small (${frame && Math.round(frame.height)}px tall)`);

      await page.getByRole("button", { name: "Continue to Sign" }).click();

      /* ---------- disclosure ---------- */
      await page.getByRole("heading", { name: /Signing electronically/i }).waitFor({ timeout: 15000 });
      await checkNoHorizontalOverflow(page, vp.name, "remote/disclosure");

      const consentBox = await page.locator('input[type="checkbox"]').first().boundingBox();
      record(vp.name, "remote/disclosure", Boolean(consentBox) && consentBox.width >= 16, `consent checkbox too small (${consentBox && Math.round(consentBox.width)}px)`);
      await checkStickyBarDoesNotCover(page, vp.name, "remote/disclosure", 'input[type="checkbox"]');

      // Consent must gate progression.
      const blocked = await page.getByRole("button", { name: /Agree to continue/ }).isDisabled();
      record(vp.name, "remote/disclosure", blocked, "continue button is not disabled before consent");

      await page.locator('input[type="checkbox"]').first().scrollIntoViewIfNeeded();
      await page.locator('input[type="checkbox"]').first().check();
      await page.getByRole("button", { name: "Continue" }).click();

      /* ---------- signature ---------- */
      await page.waitForSelector("canvas", { timeout: 10000 });
      await checkNoHorizontalOverflow(page, vp.name, "remote/signature");

      const canvas = await page.locator("canvas").boundingBox();
      record(vp.name, "remote/signature", Boolean(canvas) && canvas.height >= 150, `signature pad too short (${canvas && Math.round(canvas.height)}px)`);
      // The ceremony is deliberately capped at max-w-3xl (768px) so the
      // document and disclosure stay readable, so the pad is measured against
      // the content column rather than the raw viewport.
      const contentWidth = Math.min(vp.width, 768);
      record(
        vp.name,
        "remote/signature",
        Boolean(canvas) && canvas.width >= contentWidth * 0.6,
        `signature pad too narrow (${canvas && Math.round(canvas.width)}px in a ${contentWidth}px column)`
      );
      await checkStickyBarDoesNotCover(page, vp.name, "remote/signature", "canvas");

      // Undo/Clear must be tappable: 40px is the practical floor.
      for (const label of ["Undo", "Clear"]) {
        const box = await page.getByRole("button", { name: label }).boundingBox();
        record(vp.name, "remote/signature", Boolean(box) && box.height >= 40, `${label} tap target only ${box && Math.round(box.height)}px tall`);
      }

      // Draw, then confirm the submit enables.
      if (canvas) {
        await page.mouse.move(canvas.x + 30, canvas.y + canvas.height / 2);
        await page.mouse.down();
        await page.mouse.move(canvas.x + canvas.width * 0.6, canvas.y + canvas.height / 2 - 20, { steps: 12 });
        await page.mouse.up();
      }
      const signButton = page.getByRole("button", { name: /Sign Agreement/ });
      record(vp.name, "remote/signature", !(await signButton.isDisabled()), "sign button still disabled after drawing");

      /* ---------- complete ---------- */
      await signButton.click();
      await page.getByRole("heading", { name: /Signed|Declined/i }).waitFor({ timeout: 15000 });
      await checkNoHorizontalOverflow(page, vp.name, "remote/complete");

      /* ---------- terminal states ---------- */
      for (const state of ["completed", "expired", "revoked", "invalid", "declined"]) {
        await page.route("**/api/sign/**", (route) =>
          route.fulfill({
            status: state === "invalid" ? 404 : 200,
            headers: {
              "Access-Control-Allow-Origin": "*",
              "Access-Control-Allow-Methods": "GET,POST,OPTIONS",
              "Access-Control-Allow-Headers": "Content-Type",
            },
            contentType: "application/json",
            body: JSON.stringify(payload(state)),
          })
        );
        await page.goto(`${BASE}/sign/${TOKEN}`, { waitUntil: "domcontentloaded" });
        await page.waitForTimeout(300);
        await checkNoHorizontalOverflow(page, vp.name, `remote/terminal-${state}`);
        const leaks = await page.evaluate(() => document.body.innerText);
        record(vp.name, `remote/terminal-${state}`, !/sha256|s3\.|Bearer |ObjectId/i.test(leaks), "internal information visible in terminal state");
      }

      await context.close();
      console.log(`  viewport ${vp.name} inspected`);
    }
  } finally {
    await browser.close();
  }

  console.log(`\n${passed} layout checks passed, ${defects.length} defects.`);
  if (defects.length) {
    console.log("\nDefects:");
    for (const d of defects) console.log("  " + d);
    process.exit(1);
  }
  process.exit(0);
}

main().catch((error) => {
  console.error("visual QA failed to run:", error.message);
  process.exit(1);
});
