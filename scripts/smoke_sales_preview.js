/* eslint-disable @typescript-eslint/no-require-imports -- a plain Node script, like the other scripts/ */
/*
 * Sales desk against the REAL backend (the local preview stack), not a fake:
 * real login, real routes, real database, real permission checks.
 *
 *   BackEnd:  node scripts/preview/start.js --reset --port 5066 --mongo-port 27566 --frontend http://localhost:3150
 *   FrontEnd: NEXT_PUBLIC_API_URL=http://localhost:5066 npm run build && npx next start -p 3150
 *   node scripts/smoke_sales_preview.js http://localhost:3150 http://localhost:5066
 *
 * Jail: only the two local origins are allowed; anything else is aborted and
 * reported. Preview accounts only (invented people, fake Stripe, no messages).
 */
const { chromium } = require("playwright");
const fs = require("fs");
const path = require("path");

const WEB = (process.argv[2] || "http://localhost:3150").replace(/\/$/, "");
const API = (process.argv[3] || "http://localhost:5066").replace(/\/$/, "");
const SHOTS = process.env.SHOTS_DIR || path.join(__dirname, "..", "..", "reports", "shots", "sales-desk", "real-backend");
fs.mkdirSync(SHOTS, { recursive: true });

let passed = 0;
let failed = 0;
const check = (name, ok, extra = "") => {
  if (ok) passed++;
  else failed++;
  console.log(`${ok ? "PASS" : "FAIL"}  ${name}${ok || !extra ? "" : `\n      ${extra}`}`);
};
async function login(email, password) {
  const r = await fetch(`${API}/api/auth/login`, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ email, password }) });
  const j = await r.json();
  if (!j.token) throw new Error(`login failed for ${email}`);
  return j.token;
}
const api = (token, p, init = {}) => fetch(`${API}${p}`, { ...init, headers: { "content-type": "application/json", authorization: `Bearer ${token}`, ...(init.headers || {}) } }).then(async (r) => ({ status: r.status, body: await r.json().catch(() => ({})) }));

(async () => {
  const tele = await login("tele@preview.test", "preview-tele-1");
  const owner = await login("owner@preview.test", "preview-owner-1");
  const blocked = [];
  const browser = await chromium.launch();
  async function open(token, viewport = { width: 390, height: 844 }) {
    const ctx = await browser.newContext({ viewport });
    await ctx.addInitScript((t) => localStorage.setItem("token", t), token);
    await ctx.route("**/*", (route) => {
      const u = route.request().url();
      if (u.startsWith(WEB) || u.startsWith(API) || u.startsWith("data:") || u.startsWith("blob:")) return route.continue();
      blocked.push(u);
      return route.abort();
    });
    const page = await ctx.newPage();
    const errors = [];
    page.on("pageerror", (e) => errors.push(String(e.message || e)));
    return { ctx, page, errors };
  }
  const settle = (page) => page.waitForLoadState("networkidle").catch(() => {});

  // Telemarketer, phone.
  {
    const { ctx, page, errors } = await open(tele);
    await page.goto(`${WEB}/admin/sales-today`, { waitUntil: "domcontentloaded" });
    await page.locator("[data-today-bonus]").waitFor({ timeout: 20000 });
    await settle(page);
    const me = (await api(tele, "/api/sales/me")).body.day.bonus;
    const text = await page.locator("[data-today-bonus]").innerText();
    check("Today shows the real bonus figures", text.includes(`${me.verifiedCount} of ${me.threshold}`), text.slice(0, 200));
    await page.screenshot({ path: path.join(SHOTS, "today-real-390x844.png") });

    await page.goto(`${WEB}/admin/sales-leads`, { waitUntil: "domcontentloaded" });
    await page.locator("[data-lead-list] li").first().waitFor({ timeout: 20000 });
    const leads = (await api(tele, "/api/sales/leads")).body.leads;
    check("Leads list shows exactly the telemarketer's own leads", (await page.locator("[data-lead-list] li").count()) === leads.length, `${await page.locator("[data-lead-list] li").count()} vs ${leads.length}`);
    await page.locator("[data-lead-list] li").first().click();
    await page.locator("[data-sheet=sales-lead]").waitFor({ timeout: 15000 });
    await settle(page);
    await page.screenshot({ path: path.join(SHOTS, "lead-real-390x844.png") });
    const leadId = await page.locator("[data-sales-lead]").first().getAttribute("data-sales-lead");
    await page.locator("[data-sales-lead]").first().waitFor({ timeout: 15000 });
    const before = (await api(tele, `/api/sales/leads/${leadId}`)).body.lead.timeline.filter((t) => t.kind === "voicemail").length;
    const vm = page.locator('[data-outcome="voicemail"]');
    if (await vm.count()) {
      await vm.first().click();
      await page.locator("[data-outcome-save]").click();
      await page.waitForTimeout(1500);
    }
    const after = (await api(tele, `/api/sales/leads/${leadId}`)).body.lead.timeline.filter((t) => t.kind === "voicemail").length;
    check("Logging 'Left voicemail' in the browser is saved by the real server", after === before + 1, `${before} -> ${after}`);
    const denied = await page.goto(`${WEB}/admin/customers`, { waitUntil: "domcontentloaded" });
    await page.waitForTimeout(2500);
    check("A telemarketer cannot open All Users", (await page.locator("[data-customer-profile], [data-customers-list]").count()) === 0 && Boolean(denied));
    check("Telemarketer pages: no page errors", errors.length === 0, errors.join(" | "));
    await ctx.close();
  }

  // Owner approves the pending credit request (real API), then both views agree.
  {
    const reviews = (await api(owner, "/api/admin/sales-desk/reviews")).body.requests;
    const req = reviews[0];
    const r = await api(owner, `/api/admin/sales-desk/credit-requests/${req.id}/decide`, { method: "POST", body: JSON.stringify({ action: "approved", reason: "Preview: confirmed in GHL" }) });
    check("Owner approves the credit request on the real server", r.status === 200, JSON.stringify(r.body));
    const { ctx, page, errors } = await open(owner, { width: 1440, height: 900 });
    await page.goto(`${WEB}/admin/sales-desk`, { waitUntil: "domcontentloaded" });
    await page.locator("[data-team-row]").first().waitFor({ timeout: 20000 });
    await settle(page);
    const team = (await api(owner, "/api/admin/sales-desk/overview")).body.rows.find((x) => x.employee.name === "Tess Telemarketer");
    const mine = (await api(tele, "/api/sales/bonus")).body.bonus;
    check("Owner and employee bonus counts are identical after the approval", team.bonus.verifiedCount === mine.verifiedCount, `${team.bonus.verifiedCount} vs ${mine.verifiedCount}`);
    const rowText = await page.locator(`[data-team-row="${team.employee.id}"]`).first().innerText().catch(() => "");
    check("The owner's Team row shows that count", rowText.includes(String(mine.verifiedCount)), rowText.slice(0, 200));
    await page.screenshot({ path: path.join(SHOTS, "owner-team-real-1440x900.png") });
    check("Owner pages: no page errors", errors.length === 0, errors.join(" | "));
    await ctx.close();
  }
  // Self-referral (seeded: Theo lives at one customer's address) and the ledger check, on the real server.
  {
    const theo = await login("tele2@preview.test", "preview-tele-2");
    const reviews = (await api(owner, "/api/admin/sales-desk/reviews")).body.reviews;
    const flagged = reviews.find((r) => r.kind === "credit_hold" && r.effects?.selfReferral?.length);
    check("The real server held the household sale for review (not refused)", Boolean(flagged) && flagged.effects.selfReferral[0].signals.some((x) => x.code === "same_home_address" && x.strength === "household"), JSON.stringify(reviews.map((r) => r.summary)).slice(0, 300));
    const mine = (await api(theo, "/api/sales/earnings")).body;
    check("The employee sees only a neutral reason, never the word self-referral", !/self.?referral/i.test(JSON.stringify(mine)) && /routine owner check/.test(JSON.stringify(mine)), JSON.stringify(mine).slice(0, 300));
    const { ctx, page, errors } = await open(owner, { width: 1440, height: 900 });
    if (flagged) {
      await page.goto(`${WEB}/admin/sales-desk?tab=reviews&review=${flagged.id}`, { waitUntil: "domcontentloaded" });
      await page.locator("[data-self-referral]").waitFor({ timeout: 20000 });
      await settle(page);
      check("The owner review shows the household signal as a flag", /Possible household member/.test(await page.locator("[data-self-referral]").innerText()));
      await page.screenshot({ path: path.join(SHOTS, "owner-self-referral-real-1440x900.png") });
    }
    await page.goto(`${WEB}/admin/sales-desk?tab=payouts`, { waitUntil: "domcontentloaded" });
    await page.locator("[data-ledger-check=ok]").waitFor({ timeout: 20000 });
    check("The real ledger check passes after the seeded weeks were approved oldest first", (await api(owner, "/api/admin/sales-desk/payouts")).body.integrity.ok === true);
    await page.screenshot({ path: path.join(SHOTS, "owner-payouts-ledger-check-real-1440x900.png") });
    check("Self-referral and payouts pages: no page errors", errors.length === 0, errors.join(" | "));
    await ctx.close();
  }
  await browser.close();
  check("Nothing outside the two local origins was requested", blocked.length === 0, blocked.slice(0, 5).join(" "));
  console.log(`\n${passed}/${passed + failed} passed`);
  process.exit(failed ? 1 : 0);
})().catch((e) => {
  console.error(e);
  process.exit(1);
});
