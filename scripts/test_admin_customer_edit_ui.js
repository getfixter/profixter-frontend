/*
 * Admin edits a customer, in the browser, against a mocked API.
 *
 *   node scripts/test_admin_customer_edit_ui.js [baseUrl] [screenshotDir]
 *
 * The mock answers the way BackEnd routes/adminCustomerProfile.js does (that
 * behaviour is pinned by BackEnd scripts/test_admin_customer_edit.js): field
 * errors as 400 { errors }, warnings as 409 CONFIRM_WARNINGS, success with
 * the updated list row.
 *
 * What it pins, at a phone (390) and a desktop (1440) width:
 * - Edit is offered on each customer row/card and inside the customer details
 * - the sheet loads the profile; Save stays disabled until something changes
 * - server field errors appear next to the field; warnings ask "Save anyway"
 * - a save shows a visible confirmation and the list updates without a reload
 * - only changed fields are sent; staff see phone/email read-only and never send them
 * - the details view lists the edit history
 * - Copy Address, Gift and the completed-bookings count are still there
 * - nothing scrolls sideways
 */
const { chromium } = require("playwright");
const fs = require("fs");

const BASE = process.argv[2] || "http://localhost:3000";
const SHOTS = process.argv[3] || "";
if (SHOTS) fs.mkdirSync(SHOTS, { recursive: true });

const results = [];
function check(name, pass, detail = "") {
  results.push({ name, pass: !!pass });
  console.log(`${pass ? "PASS" : "FAIL"}  ${name}${detail ? "  :: " + detail : ""}`);
}

const OWNER = { _id: "o", userId: "1", name: "Owner", email: "getfixter@gmail.com", role: "customer", isOwner: true, permissions: [], addresses: [] };
const STAFF = { _id: "s", userId: "2", name: "Sam Staff", email: "sam@example.com", role: "employee", isActive: true, employeePosition: null, employeeTitle: "Office", permissions: ["customers.manage", "members.read"], addresses: [] };

const ADDRESS = { _id: "a1", label: "Primary", line1: "12 Oak Street", city: "Massapequa", state: "NY", zip: "11758", county: "Nassau" };
function customerRow(over = {}) {
  return {
    _id: "c1",
    userId: "20000001",
    name: "Casey Customer",
    email: "casey@example.com",
    phone: "+16315550101",
    phoneVerifiedAt: "2026-01-01T00:00:00Z",
    emailVerifiedAt: "2026-01-01T00:00:00Z",
    authProviders: ["password", "phone"],
    createdAt: "2026-01-01T00:00:00Z",
    updatedAt: "2026-10-01T00:00:00.000Z",
    addresses: [ADDRESS],
    defaultAddressId: "a1",
    addressesDetailed: [{ ...ADDRESS, isDefault: true, plan: "plus", scheduledCancellationDate: null }],
    completedBookings: 4,
    ...over,
  };
}
function profileOf(row) {
  const [first = "", ...rest] = row.name.split(" ");
  return {
    _id: row._id, userId: row.userId, name: row.name, firstName: first, lastName: rest.join(" "),
    email: row.email, phone: row.phone, emailVerifiedAt: row.emailVerifiedAt, phoneVerifiedAt: row.phoneVerifiedAt,
    emailIsAppleRelay: false, hasGoogle: false, hasApple: false, hasPassword: true, signInMethods: ["email", "phone"],
    stripeCustomer: true, updatedAt: row.updatedAt, defaultAddressId: row.defaultAddressId,
    addresses: row.addressesDetailed.map((a) => ({ ...a, placeId: "", introVisitStatus: "consumed", hasHistory: true, hasActivePlan: true })),
  };
}

async function open(browser, who, width) {
  const ctx = await browser.newContext({ viewport: { width, height: width < 700 ? 844 : 900 }, isMobile: width < 700, hasTouch: width < 700 });
  await ctx.addInitScript(() => localStorage.setItem("token", "ui-token"));
  const state = { row: customerRow(), patches: [], usersFetches: 0, history: [] };
  await ctx.route(/\/api\//, async (route) => {
    const req = route.request();
    const u = new URL(req.url());
    const cors = { "access-control-allow-origin": "*", "access-control-allow-headers": "Authorization,Content-Type", "access-control-allow-methods": "GET,POST,PUT,PATCH,DELETE,OPTIONS" };
    if (req.method() === "OPTIONS") return route.fulfill({ status: 204, headers: cors });
    const json = (body, status = 200) => route.fulfill({ status, contentType: "application/json", headers: cors, body: JSON.stringify(body) });
    const p = u.pathname;
    if (p === "/api/auth/me") return json(who === "owner" ? OWNER : STAFF);
    if (p === "/api/admin/users" && req.method() === "GET") {
      state.usersFetches += 1;
      return json([state.row]);
    }
    if (p === "/api/admin/members") return json([state.row]);
    if (p === "/api/admin/users/c1/profile" && req.method() === "GET") {
      return json({ profile: profileOf(state.row), access: { canEditContact: who === "owner", canEditDetails: true } });
    }
    if (p === "/api/admin/users/c1/profile" && req.method() === "PATCH") {
      const body = JSON.parse(req.postData() || "{}");
      state.patches.push(body);
      if (body.phone !== undefined && body.phone.replace(/\D/g, "").length < 10) {
        return json({ code: "VALIDATION", message: "Please fix the highlighted fields.", errors: { phone: "Enter a valid US phone number." } }, 400);
      }
      if (body.addresses && body.addresses.length > state.row.addressesDetailed.length && !body.acknowledgeWarnings) {
        return json({ code: "CONFIRM_WARNINGS", message: "Please review before saving.", warnings: [{ code: "ADDRESS_OUTSIDE_SERVICE_AREA", message: "350 5th Ave, New York, NY 10118 is outside the service area." }] }, 409);
      }
      const changes = [];
      const next = { ...state.row, updatedAt: new Date().toISOString() };
      if (body.firstName !== undefined || body.lastName !== undefined) {
        const [f = "", ...r] = state.row.name.split(" ");
        next.name = `${body.firstName ?? f} ${body.lastName ?? r.join(" ")}`.trim();
        changes.push({ field: "firstName", label: "First name", from: f, to: body.firstName ?? f });
      }
      const notices = [];
      if (body.phone !== undefined) {
        changes.push({ field: "phone", label: "Phone", from: state.row.phone, to: body.phone });
        next.phone = "+1" + body.phone.replace(/\D/g, "").slice(-10);
        next.phoneVerifiedAt = null;
        notices.push("The new phone is unverified. The customer can't sign in with it by text code until they verify it themselves.");
      }
      if (body.addresses) {
        next.addressesDetailed = body.addresses.map((a, i) => ({ _id: a._id || `new${i}`, label: a.label, line1: [a.line1, a.unit].filter(Boolean).join(" "), city: a.city, state: a.state, zip: a.zip, county: "", isDefault: !!a.isDefault, plan: a._id ? "plus" : null }));
        changes.push({ field: "addresses", label: "Address added", from: "", to: "350 5th Ave, New York, NY 10118" });
      }
      state.row = next;
      state.history.unshift({ id: `h${state.history.length}`, at: new Date().toISOString(), actorName: who === "owner" ? "Owner" : "Sam Staff", actorRole: who === "owner" ? "admin" : "employee", changes, verificationCleared: { phone: body.phone !== undefined, email: false }, smsConsentReset: false, reason: "" });
      return json({ message: "Customer updated.", changes, notices, user: next });
    }
    if (p === "/api/admin/users/c1/profile-history") return json({ items: state.history, masked: who !== "owner" });
    if (p === "/api/admin/users/c1/activity") return json({ user: state.row, limit: 10, total: 0, items: [] });
    if (p === "/api/admin/users/c1/sms-consent") return json({ transactionalEnabled: false, marketingEnabled: false, phoneOptedOut: false });
    if (p === "/api/admin/users/c1/loyalty") return json({ programActive: true, programStartedAt: null, completedBookings: 4, addresses: [] });
    if (p === "/api/admin/members/loyalty") return json({ programActive: true, programStartedAt: null, rows: [] });
    if (p.startsWith("/api/admin/communications")) return json({ items: [], total: 0 });
    if (p === "/api/admin/activity-log/summary") return json({ usersDeleted: 0, leadsDeleted: 0, projectsDeleted: 0 });
    return json([]);
  });
  const page = await ctx.newPage();
  const errors = [];
  page.on("pageerror", (e) => errors.push(e.message));
  page.on("dialog", (d) => d.dismiss());
  return { ctx, page, state, errors };
}

const noSideScroll = (page) => page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth + 1);
const shot = async (page, name) => {
  if (SHOTS) await page.screenshot({ path: `${SHOTS}/${name}.png` }).catch(() => {});
};
/* The visible element among the desktop table and the phone cards. */
const visible = (page, selector) => page.locator(selector).locator("visible=true");

(async () => {
  const browser = await chromium.launch();

  for (const width of [390, 1440]) {
    const tag = width < 700 ? "mobile" : "desktop";
    console.log(`\n--- owner, ${width}px ---`);
    const { ctx, page, state, errors } = await open(browser, "owner", width);
    await page.goto(`${BASE}/admin?tab=users`, { waitUntil: "networkidle" });
    await visible(page, "text=Casey Customer").first().waitFor({ timeout: 20000 });

    const editButtons = visible(page, "button:has-text('Edit')");
    check(`${tag}: Edit on the customer row`, (await editButtons.count()) >= 1);
    check(`${tag}: Copy Address, Gift and completed bookings still shown`,
      (await visible(page, "button[aria-label*='opy']").count()) >= 1 && (await visible(page, "button:has-text('Gift')").count()) >= 1 && (await visible(page, "text=/Completed/i").count()) >= 1);
    await editButtons.first().scrollIntoViewIfNeeded();
    await shot(page, `${tag}-01-list`);

    await editButtons.first().click();
    const sheet = page.locator("[role=dialog][aria-labelledby=customer-edit-title]");
    await sheet.locator("input").first().waitFor();
    const save = sheet.locator("button:has-text('Save changes')");
    check(`${tag}: Save disabled until something changes`, await save.isDisabled());
    check(`${tag}: phone and email editable for the owner`, !(await sheet.locator("input[inputmode=tel]").isDisabled()) && !(await sheet.locator("input[type=email]").isDisabled()));
    check(`${tag}: address with history cannot be removed`, await sheet.locator("[data-testid=address-card] button:has-text('Remove')").first().isDisabled());
    await shot(page, `${tag}-02-sheet`);
    check(`${tag}: sheet fits without sideways scroll`, await noSideScroll(page));

    // Inline error from the server.
    await sheet.locator("input[inputmode=tel]").fill("123");
    await save.click();
    await sheet.locator("text=Enter a valid US phone number.").waitFor({ timeout: 5000 });
    check(`${tag}: server field error shown next to the field`, true);
    check(`${tag}: unverified warning shown while changing contact`, (await sheet.locator("text=not verified").count()) >= 1);
    await shot(page, `${tag}-03-error`);

    // Add an address: the warning flow.
    await sheet.locator("button:has-text('+ Add address')").click();
    const cards = sheet.locator("[data-testid=address-card]");
    const card = cards.nth(1);
    await card.locator("button:has-text('Close lookup')").click().catch(() => {});
    const fields = card.locator("label input:not([type=radio])");
    await fields.nth(0).fill("350 5th Ave");
    await fields.nth(2).fill("New York");
    await fields.nth(4).fill("10118");
    await sheet.locator("input[inputmode=tel]").fill("(516) 555-0142");
    await sheet.locator("input").first().fill("Cassandra");
    await sheet.locator("button:has-text('Save changes')").click();
    await sheet.locator("text=Please review before saving").waitFor({ timeout: 5000 });
    check(`${tag}: warnings ask for confirmation`, (await sheet.locator("button:has-text('Save anyway')").count()) === 1);
    await shot(page, `${tag}-04-warning`);

    const fetchesBeforeSave = state.usersFetches;
    await sheet.locator("button:has-text('Save anyway')").click();
    await sheet.locator("[role=status]:has-text('Saved')").waitFor({ timeout: 5000 });
    const last = state.patches[state.patches.length - 1];
    check(`${tag}: confirmation resend carries acknowledgeWarnings`, last.acknowledgeWarnings === true);
    check(`${tag}: only changed fields sent`, last.firstName === "Cassandra" && last.lastName === undefined && last.email === undefined && last.phone === "(516) 555-0142");
    check(`${tag}: visible success with notices`, (await sheet.locator("text=unverified").count()) >= 1);
    await shot(page, `${tag}-05-saved`);
    await sheet.locator("button:has-text('Done')").click();

    await visible(page, "text=Cassandra Customer").first().waitFor({ timeout: 5000 });
    check(`${tag}: list updated in place, no refetch`, state.usersFetches === fetchesBeforeSave, `GET /users ${fetchesBeforeSave} -> ${state.usersFetches}`);

    // The details view: Edit and the history.
    await visible(page, "button:text-is('History'), button:text-is('View history')").first().click();
    const details = page.locator("text=Customer activity").first();
    await details.waitFor();
    await page.locator("text=Profile edits").waitFor();
    check(`${tag}: details view has Edit`, (await page.locator(".fixed button:has-text('Edit')").count()) >= 1);
    check(`${tag}: details view lists the edit`, (await page.locator("text=Phone verification cleared").count()) >= 1);
    await shot(page, `${tag}-06-details-history`);
    check(`${tag}: no sideways scroll`, await noSideScroll(page));
    check(`${tag}: no page errors`, errors.length === 0, errors.join(" | "));
    await ctx.close();
  }

  console.log("\n--- All Users employee ---");
  {
    const { ctx, page, state, errors } = await open(browser, "staff", 390);
    await page.goto(`${BASE}/admin?tab=users`, { waitUntil: "networkidle" });
    await visible(page, "text=Casey Customer").first().waitFor({ timeout: 20000 });
    await visible(page, "button:has-text('Edit')").first().click();
    const sheet = page.locator("[role=dialog][aria-labelledby=customer-edit-title]");
    await sheet.locator("input").first().waitFor();
    check("staff: phone and email are read-only", (await sheet.locator("input[inputmode=tel]").isDisabled()) && (await sheet.locator("input[type=email]").isDisabled()));
    check("staff: says why", (await sheet.locator("text=Only the owner can change a phone or email").count()) === 1);
    await sheet.locator("input").nth(1).fill("Customer-Smith");
    await sheet.locator("button:has-text('Save changes')").click();
    await sheet.locator("[role=status]:has-text('Saved')").waitFor({ timeout: 5000 });
    const body = state.patches[0];
    check("staff: never sends phone or email", body.phone === undefined && body.email === undefined && body.lastName === "Customer-Smith");
    await shot(page, "staff-mobile-sheet-saved");
    check("staff: no page errors", errors.length === 0, errors.join(" | "));
    await ctx.close();
  }

  await browser.close();
  const failed = results.filter((r) => !r.pass);
  console.log(`\n${results.length - failed.length} passed, ${failed.length} failed`);
  process.exit(failed.length ? 1 : 0);
})();
