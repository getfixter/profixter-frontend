/* eslint-disable @typescript-eslint/no-require-imports -- a plain Node script, like the other scripts/ */
/*
 * Telemarketer invitation-link setup against the REAL backend (the local
 * preview stack): the owner creates the account on Team, copies and sends
 * links, and the employee sets their own password from the link.
 *
 *   BackEnd:  node scripts/preview/start.js --reset --port 5066 --mongo-port 27566 --frontend http://localhost:3150
 *   FrontEnd: NEXT_PUBLIC_API_URL=http://localhost:5066 npm run build && npx next start -p 3150
 *   node scripts/smoke_staff_setup_preview.js http://localhost:3150 http://localhost:5066
 *
 * Jail: only the two local origins are allowed. The invitation "email" lands
 * in the preview outbox (faked SES; outbound network blocked): nothing is sent.
 */
const { chromium } = require("playwright");
const fs = require("fs");
const path = require("path");

const WEB = (process.argv[2] || "http://localhost:3150").replace(/\/$/, "");
const API = (process.argv[3] || "http://localhost:5066").replace(/\/$/, "");
const SHOTS = process.env.SHOTS_DIR || path.join(__dirname, "..", "..", "reports", "shots", "staff-setup");
fs.mkdirSync(SHOTS, { recursive: true });

let passed = 0;
let failed = 0;
const check = (name, ok, extra = "") => {
  if (ok) passed++;
  else failed++;
  console.log(`${ok ? "PASS" : "FAIL"}  ${name}${ok || !extra ? "" : `\n      ${extra}`}`);
};
const post = (p, body, token) =>
  fetch(`${API}${p}`, { method: "POST", headers: { "content-type": "application/json", ...(token ? { authorization: `Bearer ${token}` } : {}) }, body: JSON.stringify(body || {}) }).then(async (r) => ({
    status: r.status,
    body: await r.json().catch(() => ({})),
  }));
const tokenOf = (link) => String(link).split("#")[1] || "";
const verify = (link) => post("/api/staff-setup/verify", { token: tokenOf(link) });

async function outboxFor(email) {
  const { items } = await (await fetch(`${API}/__preview/outbox?limit=500`)).json();
  return items.filter((m) => m.channel === "email" && m.to === email).map((m) => [m.subject, m.text || "", m.html || ""].join("\n"));
}

(async () => {
  // Preview database only: clear the sign-in/setup rate counters so repeated runs from one IP measure the feature, not the limiter.
  {
    const mongoose = require(require.resolve("mongoose", { paths: [path.join(__dirname, "..", "..", "BackEnd")] }));
    const conn = await mongoose.createConnection(process.env.PREVIEW_MONGO_URI || "mongodb://127.0.0.1:27566/?directConnection=true").asPromise();
    const dbName = process.env.PREVIEW_DB || (await conn.db.admin().listDatabases()).databases.map((d) => d.name).find((n) => !["admin", "local", "config"].includes(n));
    await conn.useDb(dbName).collection("authratecounters").deleteMany({});
    await conn.close();
  }
  const owner = (await post("/api/auth/login", { email: "owner@preview.test", password: "preview-owner-1" })).body.token;
  if (!owner) throw new Error("owner login failed");
  const stamp = Date.now().toString(36);
  const email = `nora.${stamp}@preview.test`;
  const blocked = [];
  const browser = await chromium.launch();
  async function open(token, viewport) {
    const ctx = await browser.newContext({ viewport, permissions: ["clipboard-read", "clipboard-write"] });
    if (token) await ctx.addInitScript((t) => localStorage.setItem("token", t), token);
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

  /* ------------------------------------------------ owner creates the account */
  const o = await open(owner, { width: 1440, height: 900 });
  await o.page.goto(`${WEB}/admin/team`, { waitUntil: "domcontentloaded" });
  await o.page.getByRole("button", { name: "Add employee" }).first().click();
  const form = o.page.locator("form[aria-label='Add employee']");
  await form.getByLabel("First name").fill("Nora");
  await form.getByLabel("Last name").fill("Newcaller");
  await form.getByLabel("Email (their login)").fill(email);
  await form.locator("[data-role='Telemarketer']").click();
  check("Add employee explains there is no password, only a setup link", await form.locator("[data-setup-explainer]").isVisible());
  await o.page.getByRole("button", { name: "Save employee" }).click();
  const sheet = o.page.locator("[role=dialog][data-sheet=staff-setup]");
  await sheet.waitFor({ timeout: 20000 });
  const L1 = await sheet.locator("[data-setup-link]").inputValue();
  check("After saving, the setup link is shown to copy (nothing sent yet)", /^http:\/\/localhost:3150\/team-setup#[A-Za-z0-9_-]{43}$/.test(L1) && (await sheet.innerText()).includes("Nothing has been sent yet"), L1);
  check("Nothing was emailed on creation", (await outboxFor(email)).length === 0);
  await sheet.locator("[data-setup-copy]").click();
  const clip = await o.page.evaluate(() => navigator.clipboard.readText()).catch(() => "");
  check("Copy puts the link on the clipboard", clip === L1 && (await sheet.locator("[data-setup-copy]").innerText()).includes("Copied"));
  await o.page.screenshot({ path: path.join(SHOTS, "owner-setup-link-created-1440x900.png") });

  check("The shared password 11111111 does not sign the new account in", (await post("/api/auth/login", { email, password: "11111111" })).status !== 200);

  /* ------------------------------------------------------- send and resend */
  await sheet.locator("[data-setup-send]").click();
  await sheet.locator("[data-setup-notice]").waitFor({ timeout: 20000 });
  const L2 = await sheet.locator("[data-setup-link]").inputValue();
  const mails1 = await outboxFor(email);
  check("Send invitation emails a NEW link (to the outbox only)", L2 !== L1 && mails1.length === 1 && mails1[0].includes(tokenOf(L2)) && !mails1[0].includes(tokenOf(L1)));
  check("The screen says the previous link no longer works", (await sheet.locator("[data-setup-notice]").innerText()).includes("previous link no longer works"));
  check("The first (copied) link is dead", (await verify(L1)).status === 400);
  await o.page.screenshot({ path: path.join(SHOTS, "owner-invitation-sent-1440x900.png") });
  await sheet.locator("[data-setup-send]").click();
  await o.page.waitForFunction((prev) => document.querySelector("[data-setup-link]")?.value !== prev, L2, { timeout: 20000 });
  const L3 = await sheet.locator("[data-setup-link]").inputValue();
  check("Resend emails another new link and kills the one sent before", (await outboxFor(email)).length === 2 && (await verify(L2)).status === 400 && (await verify(L3)).status === 200);
  check("The button now reads Resend invitation", (await sheet.locator("[data-setup-send]").innerText()).includes("Resend"));
  await o.page.keyboard.press("Escape");
  await sheet.waitFor({ state: "detached", timeout: 10000 }).catch(() => {});
  await o.page.reload({ waitUntil: "domcontentloaded" });
  const rowLoc = o.page.locator("li[data-employee]", { hasText: email });
  await rowLoc.waitFor({ timeout: 20000 });
  check("The Team row shows the invitation is pending, with a Setup link action", (await rowLoc.innerText()).includes("Invitation sent") && (await rowLoc.locator("[data-setup-open]").isVisible()));
  await o.page.screenshot({ path: path.join(SHOTS, "owner-team-row-pending-1440x900.png") });

  /* --------------------------------------------- before setup: no access */
  {
    const e = await open(null, { width: 390, height: 844 });
    await e.page.goto(`${WEB}/admin/sales-today`, { waitUntil: "domcontentloaded" });
    await e.page.waitForURL(/\/signin/, { timeout: 20000 }).catch(() => {});
    check("Without setup, the workspace sends them to sign-in", e.page.url().includes("/signin"));
    await e.ctx.close();
  }

  /* ------------------------------------------- the employee opens old/bad links */
  for (const [label, link] of [
    ["a link replaced by a newer one", L1],
    ["a tampered link", L3.slice(0, -3) + (L3.endsWith("AAA") ? "BBB" : "AAA")],
    ["a link with no token", `${WEB}/team-setup`],
    // A token may start with a digit or "-": the page must not treat it as a CSS selector (that crashed it once).
    ["a token starting with a digit", `${WEB}/team-setup#2${"x".repeat(42)}`],
    ["a token starting with a dash", `${WEB}/team-setup#-${"y".repeat(42)}`],
  ]) {
    const e = await open(null, { width: 390, height: 844 });
    await e.page.goto(link, { waitUntil: "domcontentloaded" });
    await e.page.locator("[data-team-setup-invalid]").waitFor({ timeout: 20000 }).catch(() => {});
    check(`The setup page refuses ${label}`, await e.page.locator("[data-team-setup-invalid]").isVisible(), e.errors.join(" | "));
    if (label.startsWith("a tampered")) await e.page.screenshot({ path: path.join(SHOTS, "employee-link-invalid-390x844.png") });
    await e.ctx.close();
  }

  /* ---------------------------------------- the employee sets up their account */
  const e = await open(null, { width: 390, height: 844 });
  await e.page.goto(L3, { waitUntil: "domcontentloaded" });
  const setupForm = e.page.locator("form[data-team-setup]");
  await setupForm.waitFor({ timeout: 20000 });
  check("The link opens a welcome screen with their email", (await e.page.innerText("body")).includes("Welcome, Nora") && (await e.page.innerText("body")).includes(email));
  check("The token is wiped from the address bar at once", !e.page.url().includes("#"), e.page.url());
  await e.page.screenshot({ path: path.join(SHOTS, "employee-choose-password-390x844.png") });
  await e.page.locator("#team-setup-password").fill("Nora-picks-this-9");
  await e.page.locator("#team-setup-confirm").fill("Nora-picks-that-9");
  await e.page.getByRole("button", { name: "Create password and continue" }).click();
  check("Mismatched passwords are caught on the page", (await e.page.innerText("body")).includes("don't match"));
  await e.page.locator("#team-setup-password").fill("11111111");
  await e.page.locator("#team-setup-confirm").fill("11111111");
  await e.page.getByRole("button", { name: "Create password and continue" }).click();
  await e.page.getByText("isn't one character repeated").waitFor({ timeout: 10000 }).catch(() => {});
  check("11111111 is refused as their password", (await e.page.innerText("body")).includes("isn't one character repeated"));
  await e.page.locator("#team-setup-password").fill("Nora-picks-this-9");
  await e.page.locator("#team-setup-confirm").fill("Nora-picks-this-9");
  await e.page.getByRole("button", { name: "Create password and continue" }).click();
  await e.page.waitForURL(/\/admin\/sales-today/, { timeout: 30000 }).catch(() => {});
  await e.page.waitForLoadState("networkidle").catch(() => {});
  check("After setup they land in their workspace, signed in", e.page.url().includes("/admin/sales-today"), e.page.url());
  await e.page.screenshot({ path: path.join(SHOTS, "employee-after-setup-390x844.png") });
  check("No page errors on the employee's side", e.errors.length === 0, e.errors.join(" | "));
  await e.ctx.close();

  /* ----------------------------------------------------------- after setup */
  check("The used link no longer works", (await verify(L3)).status === 400);
  {
    const r = await open(null, { width: 390, height: 844 });
    await r.page.goto(L3, { waitUntil: "domcontentloaded" });
    await r.page.locator("[data-team-setup-invalid]").waitFor({ timeout: 20000 }).catch(() => {});
    check("Reopening the used link shows it can't be used", await r.page.locator("[data-team-setup-invalid]").isVisible());
    await r.ctx.close();
  }
  check("They sign in with the password they chose", (await post("/api/auth/login", { email, password: "Nora-picks-this-9" })).status === 200);
  check("11111111 still does not work", (await post("/api/auth/login", { email, password: "11111111" })).status !== 200);
  const team = await (await fetch(`${API}/api/admin/fixters`, { headers: { authorization: `Bearer ${owner}` } })).json();
  const nora = team.fixters.find((f) => f.email === email);
  check("The owner cannot issue a new link once they're set up", (await post(`/api/admin/fixters/${nora.id}/setup-link`, {}, owner)).status === 409 && nora.setup?.state === "complete");
  await o.page.reload({ waitUntil: "domcontentloaded" });
  await rowLoc.waitFor({ timeout: 20000 });
  check("The Team row drops the setup badge and action", !(await rowLoc.innerText()).includes("Invitation sent") && (await rowLoc.locator("[data-setup-open]").count()) === 0);

  /* ------------------------------------------------------------ expiry */
  {
    const c = await post("/api/admin/fixters", { firstName: "Eli", lastName: "Expired", email: `eli.${stamp}@preview.test`, employeePosition: "Telemarketer" }, owner);
    const link = c.body.setupLink.link;
    const mongoose = require(require.resolve("mongoose", { paths: [path.join(__dirname, "..", "..", "BackEnd")] }));
    const conn = await mongoose.createConnection(process.env.PREVIEW_MONGO_URI || "mongodb://127.0.0.1:27566/?directConnection=true").asPromise();
    const dbName = process.env.PREVIEW_DB || (await conn.db.admin().listDatabases()).databases.map((d) => d.name).find((n) => !["admin", "local", "config"].includes(n));
    await conn.useDb(dbName).collection("users").updateOne({ email: `eli.${stamp}@preview.test`, role: "employee" }, { $set: { "staffSetup.expiresAt": new Date(Date.now() - 60000) } });
    await conn.close();
    const x = await open(null, { width: 390, height: 844 });
    await x.page.goto(link, { waitUntil: "domcontentloaded" });
    await x.page.locator("[data-team-setup-invalid]").waitFor({ timeout: 20000 }).catch(() => {});
    check("An expired link says so and offers nothing to submit", (await x.page.innerText("body")).includes("expired") && (await x.page.locator("form[data-team-setup]").count()) === 0, x.errors.join(" | "));
    await x.page.screenshot({ path: path.join(SHOTS, "employee-link-expired-390x844.png") });
    await x.ctx.close();
    await o.page.reload({ waitUntil: "domcontentloaded" });
    const eliRow = o.page.locator("li[data-employee]", { hasText: `eli.${stamp}@preview.test` });
    await eliRow.waitFor({ timeout: 20000 });
    check("The owner sees the expired link on Team", (await eliRow.innerText()).includes("Setup link expired"));
  }

  check("No page errors on the owner's side", o.errors.length === 0, o.errors.join(" | "));
  // The jail aborts everything else; the site's analytics tags are the only thing it should meet.
  const unexpected = blocked.filter((u) => !/^https:\/\/(www\.googletagmanager\.com|connect\.facebook\.net|www\.google-analytics\.com)\//.test(u));
  check("Nothing left the two local origins (only analytics tags were attempted, and blocked)", unexpected.length === 0, unexpected.slice(0, 5).join(", "));
  await browser.close();
  console.log(`\n${passed} passed, ${failed} failed`);
  process.exit(failed ? 1 : 0);
})().catch((error) => {
  console.error(error);
  process.exit(1);
});
