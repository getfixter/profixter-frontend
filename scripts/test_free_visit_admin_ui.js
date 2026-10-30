/*
 * Admin: a homepage free-visit request, held as Pending Confirmation, reviewed
 * and confirmed from Jobs or from Leads. The API is stubbed (statefully) so
 * this checks the screens and exactly what they send.
 *
 *   node scripts/test_free_visit_admin_ui.js [baseUrl]
 */
const { chromium } = require("playwright");

const BASE = process.argv[2] || "http://localhost:3000";
const results = [];
function check(name, pass, detail = "") {
  results.push({ name, pass: !!pass });
  console.log(`${pass ? "PASS" : "FAIL"}  ${name}${detail ? "  :: " + detail : ""}`);
}

const OWNER = { _id: "o", userId: "1", name: "Owner", email: "getfixter@gmail.com", role: "customer", isOwner: true, permissions: [], addresses: [] };
const DAY = (() => {
  const d = new Date(Date.now() + 5 * 864e5);
  return d.toISOString().slice(0, 10);
})();
const AT = (time) => new Date(`${DAY}T${time}:00-04:00`).toISOString();

function freshState(eligibility = { decision: "eligible", code: "", reasons: [], matches: [] }) {
  return {
    calls: [],
    booking: {
      _id: "gb1", bookingNumber: "55501234", userId: "", name: "Jane Doe", email: "jane.doe@example.com", phone: "+16315550142",
      date: AT("10:30"), service: "Labor Only", accessType: "free_first_visit", status: "Pending Confirmation",
      guestRequestId: "rq1", address: "", city: "", state: "", zip: "", note: "The faucet drips and a towel bar fell off",
      images: ["https://test-bucket.s3.amazonaws.com/uploads/free-visit-requests/rq1/1-1.jpg"], assignedFixterName: "Fixter 1",
    },
    /* Free Visit 2.0: booked online from an account, complete, waiting for approval. */
    online: {
      _id: "ob1", bookingNumber: "55507777", user: "u9", userId: "9", name: "Olive Online", email: "olive@example.com", phone: "+16315550177",
      date: AT("08:00"), service: "Labor Only", accessType: "free_first_visit", status: "Pending Confirmation", freeVisitChannel: "online",
      address: "5 Pine Rd", city: "Babylon", state: "NY", zip: "11702", note: "Hang three shelves in the den", images: [], libraryReference: "shelves",
      assignedFixterName: "Fixter 1",
    },
    eligibility,
  };
}

function onlineDetail(state) {
  const b = state.online;
  return {
    booking: { ...b, channel: "online", missing: [], requestedDate: DAY, requestedTime: "08:00", hasAddress: true, reserved: true, review: null, confirmation: null },
    lead: null,
    eligibility: b.status === "Pending Confirmation" ? { decision: "eligible", code: "", reasons: [], matches: [] } : null,
  };
}

function detail(state) {
  const b = state.booking;
  return {
    booking: {
      ...b, channel: "callback", missing: b.address && b.city && /^\d{5}$/.test(b.zip) ? [] : ["address"],
      requestedDate: DAY, requestedTime: new Date(b.date).toISOString() === AT("15:30") ? "15:30" : "10:30",
      hasAddress: !!(b.address && b.city && /^\d{5}$/.test(b.zip)), reserved: true, review: null, confirmation: null,
    },
    lead: { _id: "rq1", status: b.status === "Confirmed" ? "confirmed" : "pending_confirmation", createdAt: new Date().toISOString(), attribution: { url: { utm_source: "fb", utm_medium: "paid" } } },
    eligibility: b.status === "Confirmed" ? null : state.eligibility,
  };
}

async function open(browser, { width = 390, height = 844, eligibility } = {}) {
  const ctx = await browser.newContext({ viewport: { width, height }, isMobile: width < 700, hasTouch: width < 700 });
  await ctx.addInitScript(() => {
    localStorage.setItem("token", "ui-token");
    window.__fbq = [];
    window.fbq = function (...args) { window.__fbq.push(args); };
  });
  const state = freshState(eligibility);
  await ctx.route(/\/api\//, async (route) => {
    const req = route.request();
    const u = new URL(req.url());
    const cors = { "access-control-allow-origin": "*", "access-control-allow-headers": "Authorization,Content-Type", "access-control-allow-methods": "GET,POST,PUT,PATCH,DELETE,OPTIONS" };
    if (req.method() === "OPTIONS") return route.fulfill({ status: 204, headers: cors });
    const json = (body, status = 200) => route.fulfill({ status, contentType: "application/json", headers: cors, body: JSON.stringify(body) });
    const p = u.pathname;
    if (p.startsWith("/api/admin/free-visits/") || p.startsWith("/api/admin/bookings") || p.startsWith("/api/admin/requests")) {
      state.calls.push({ method: req.method(), path: p, body: req.postData() ? JSON.parse(req.postData()) : null });
    }
    if (p === "/api/auth/me") return json(OWNER);
    if (p === "/api/admin/bookings") {
      return json([
        state.booking,
        state.online,
        { _id: "rb1", bookingNumber: "55509999", userId: "77", name: "Regular Member", email: "m@example.com", phone: "+16315559999", date: AT("13:00"), service: "Handyman visit", accessType: "membership", status: "Confirmed", address: "9 Oak Ave", city: "Babylon", state: "NY", zip: "11702" },
      ]);
    }
    if (p === "/api/admin/requests") {
      return json([{ _id: "rq1", name: "Jane Doe", email: "jane.doe@example.com", phone: "+16315550142", serviceType: "free_visit_request", status: state.booking.status === "Confirmed" ? "confirmed" : "pending_confirmation", bookingId: "gb1", requestedDate: DAY, requestedTime: "10:30", message: state.booking.note, createdAt: new Date().toISOString() }]);
    }
    if (p === "/api/admin/free-visits/gb1" && req.method() === "GET") return json(detail(state));
    if (p === "/api/admin/free-visits/ob1" && req.method() === "GET") return json(onlineDetail(state));
    if (p === "/api/admin/free-visits/ob1" && req.method() === "PUT") return json(onlineDetail(state));
    if (p === "/api/admin/free-visits/ob1/confirm") {
      state.online.status = "Confirmed";
      return json({ ...onlineDetail(state), notified: true });
    }
    if (p === "/api/admin/free-visits/ob1/decline") {
      state.online.status = "Canceled";
      return json(onlineDetail(state));
    }
    if (p === "/api/admin/free-visits/gb1" && req.method() === "PUT") {
      const body = JSON.parse(req.postData() || "{}");
      if (body.address) Object.assign(state.booking, { address: body.address.unit ? `${body.address.line1}, Unit ${body.address.unit}` : body.address.line1, city: body.address.city, state: body.address.state, zip: body.address.zip });
      if (body.time) state.booking.date = AT(body.time);
      return json(detail(state));
    }
    if (p === "/api/admin/free-visits/gb1/confirm") {
      const body = JSON.parse(req.postData() || "{}");
      if (!state.booking.address) return json({ code: "ADDRESS_REQUIRED", message: "Add and save the customer's service address before confirming." }, 400);
      if (state.eligibility.decision === "review" && !body.acknowledgeReview) return json({ code: "REVIEW_REQUIRED", message: "Possible repeat", eligibility: state.eligibility }, 409);
      state.booking.status = "Confirmed";
      return json({ ...detail(state), notified: true });
    }
    if (p === "/api/admin/free-visits/gb1/decline") {
      state.booking.status = "Canceled";
      return json(detail(state));
    }
    if (p === "/api/calendar/slots") {
      return json({ date: u.searchParams.get("date"), slots: ["08:00", "15:30"], candidateSlots: [
        { time: "08:00", available: true }, { time: "10:30", available: false }, { time: "13:00", available: false }, { time: "15:30", available: true },
      ] });
    }
    if (p === "/api/admin/activity-log/summary") return json({ usersDeleted: 0, leadsDeleted: 0, projectsDeleted: 0 });
    return json([]);
  });
  const page = await ctx.newPage();
  const errors = [];
  page.on("pageerror", (e) => errors.push(e.message));
  page.on("dialog", (d) => d.accept(""));
  return { ctx, page, state, errors };
}

const card = (page, number) => page.locator("article").filter({ hasText: `#${number}` });
const SHOTS = process.env.ADMIN_SHOTS || "";
const shot = async (page, name) => { if (SHOTS) await page.screenshot({ path: `${SHOTS}/${name}.png` }); };

(async () => {
  const browser = await chromium.launch();

  console.log("\n--- Jobs: a held request looks and acts different ---");
  {
    const { ctx, page, state, errors } = await open(browser);
    await page.goto(`${BASE}/admin?tab=bookings`, { waitUntil: "networkidle" });
    const pendingChip = page.getByRole("button", { name: /All Pending/ });
    check("All Pending counts both held free visits", /2/.test(await pendingChip.innerText()), await pendingChip.innerText());
    await page.getByRole("button", { name: /Upcoming/ }).click();
    await page.waitForSelector("article", { timeout: 15000 });
    const guest = card(page, "55501234");
    const member = card(page, "55509999");
    check("the held request is on the Jobs list", (await guest.count()) === 1);
    check("it says Pending Confirmation", (await guest.innerText()).includes("Pending Confirmation"));
    check("its card is dashed amber, unlike a confirmed job", /border-dashed/.test((await guest.getAttribute("class")) || "") && !/border-dashed/.test((await member.getAttribute("class")) || ""));
    check("it has one action: review & confirm", (await guest.locator("[data-review-free-visit]").count()) === 1);
    check("it is labelled Callback Needed — Awaiting Contact", (await guest.locator('[data-free-visit-kind="callback"]').innerText()).includes("Callback Needed — Awaiting Contact"));
    check("no generic Confirm or status buttons on it", !/Confirm \/ Approve/.test(await guest.innerText()) && (await guest.locator("button", { hasText: /^Done$/ }).count()) === 0);
    check("a normal job keeps its status buttons", (await member.locator("button", { hasText: /^Done$/ }).count()) === 1);

    await guest.locator("[data-review-free-visit]").click();
    await page.waitForSelector("[data-free-visit-panel] [data-free-visit-eligibility]", { timeout: 10000 });
    const panel = page.locator("[data-free-visit-panel]");
    const text = await panel.innerText();
    const values = await panel.locator("input, textarea").evaluateAll((els) => els.map((e) => e.value).join(" "));
    const shown = text + " " + values;
    check("the review shows who, what, when and where they came from", ["Jane Doe", "+16315550142", "jane.doe@example.com", "faucet", "utm_source=fb"].every((t) => shown.includes(t)), shown.slice(0, 200).replace(/\s+/g, " "));
    check("the lifetime check reads eligible", (await panel.locator('[data-free-visit-eligibility="eligible"]').count()) === 1);
    check("the uploaded photo is shown", (await panel.locator("img").count()) === 1);
    const layout = await page.evaluate(() => ({ scroll: document.documentElement.scrollWidth, width: window.innerWidth }));
    check("the review fits a phone (no sideways scroll)", layout.scroll <= layout.width, JSON.stringify(layout));

    await panel.locator("[data-free-visit-confirm]").click();
    await page.waitForTimeout(300);
    check("Confirm without an address is stopped in the browser", /service address/i.test(await panel.locator("[data-free-visit-error]").innerText().catch(() => "")) && !state.calls.some((c) => c.path.endsWith("/confirm")));

    await panel.locator('[data-free-visit-field="line1"]').fill("12 Main St");
    await panel.locator('[data-free-visit-field="unit"]').fill("2");
    await panel.locator('[data-free-visit-field="city"]').fill("Babylon");
    await panel.locator('[data-free-visit-field="zip"]').fill("11702");
    await panel.locator('[data-free-visit-field="time"]').selectOption("15:30");
    check("a taken time cannot be picked", (await panel.locator('[data-free-visit-field="time"] option[value="13:00"]').isDisabled()));
    await panel.locator("[data-free-visit-confirm]").click();
    await page.waitForSelector('[data-free-visit-status]:has-text("Confirmed")', { timeout: 10000 }).catch(() => {});
    const put = state.calls.find((c) => c.method === "PUT" && c.path === "/api/admin/free-visits/gb1");
    const post = state.calls.find((c) => c.method === "POST" && c.path === "/api/admin/free-visits/gb1/confirm");
    check("Confirm saves the address and the new time first", !!put && put.body.address?.line1 === "12 Main St" && put.body.address?.unit === "2" && put.body.address?.zip === "11702" && put.body.time === "15:30", JSON.stringify(put?.body));
    check("...then confirms", !!post && state.calls.indexOf(post) > state.calls.indexOf(put));
    check("the panel shows Confirmed", (await panel.locator("[data-free-visit-status]").innerText()).includes("Confirmed"));
    check("never through the generic status endpoint", !state.calls.some((c) => c.path === "/api/admin/bookings/gb1/status"));
    const fbq = await page.evaluate(() => window.__fbq);
    check("confirming fires no Meta event", !fbq.some((c) => c[0] === "track" && c[1] === "Lead"), JSON.stringify(fbq));
    check("no page errors", errors.length === 0, errors.join(" | "));
    await ctx.close();
  }

  console.log("\n--- Jobs: an online booking awaiting approval ---");
  {
    const { ctx, page, state, errors } = await open(browser);
    await page.goto(`${BASE}/admin?tab=bookings`, { waitUntil: "networkidle" });
    await page.getByRole("button", { name: /All Pending/ }).click();
    await page.waitForSelector("article", { timeout: 15000 });
    const online = card(page, "55507777");
    check("the online booking is on the Jobs list", (await online.count()) === 1);
    check("it is labelled Online Booking — Awaiting Approval", (await online.locator('[data-free-visit-kind="online"]').innerText()).includes("Online Booking — Awaiting Approval"));
    check("its one action is Review & approve, no generic status buttons", (await online.locator("[data-review-free-visit]").innerText()).includes("Review & approve") && (await online.locator("button", { hasText: /^Done$/ }).count()) === 0);
    await online.locator("[data-review-free-visit]").click();
    await page.waitForSelector('[data-free-visit-panel] [data-free-visit-channel="online"]', { timeout: 10000 });
    const panel = page.locator("[data-free-visit-panel]");
    const text = await panel.innerText();
    check("the review says booked online, awaiting approval", /Online booking · awaiting approval/i.test(text) && (await panel.locator("[data-free-visit-online]").count()) === 1, text.slice(0, 120));
    const shown = text + " " + (await panel.locator("input").evaluateAll((els) => els.map((e) => e.value).join(" ")));
    check("full customer info and the submitted address are shown", ["Olive Online", "+16315550177", "olive@example.com", "5 Pine Rd", "11702"].every((t) => shown.includes(t)), shown.slice(0, 160));
    check("contact and address come from the account: read-only here", await panel.locator('[data-free-visit-field="line1"]').isDisabled());
    check("nothing is listed as missing", (await panel.locator("[data-free-visit-missing]").count()) === 0);
    await shot(page, "admin-online-review");
    check("the button says Approve", /Approve/.test(await panel.locator("[data-free-visit-confirm]").innerText()));
    await panel.locator("[data-free-visit-confirm]").click();
    await page.waitForSelector('[data-free-visit-status]:has-text("Confirmed")', { timeout: 10000 }).catch(() => {});
    check("approving goes through the free-visit review", state.calls.some((c) => c.method === "POST" && c.path === "/api/admin/free-visits/ob1/confirm"));
    check("and sends no contact or address changes", !state.calls.some((c) => c.method === "PUT" && c.path === "/api/admin/free-visits/ob1" && (c.body?.address || c.body?.phone || c.body?.email || c.body?.name)));
    check("never through the generic status endpoint", !state.calls.some((c) => c.path === "/api/admin/bookings/ob1/status"));
    check("no page errors", errors.length === 0, errors.join(" | "));
    await ctx.close();
  }
  {
    const { ctx, page, state } = await open(browser);
    await page.goto(`${BASE}/admin?tab=bookings`, { waitUntil: "networkidle" });
    await page.getByRole("button", { name: /All Pending/ }).click();
    await page.waitForSelector("article", { timeout: 15000 });
    await card(page, "55507777").locator("[data-review-free-visit]").click();
    await page.waitForSelector("[data-free-visit-decline]", { timeout: 10000 });
    await page.locator("[data-free-visit-decline]").click();
    await page.waitForTimeout(500);
    check("an online booking can be declined", state.calls.some((c) => c.path === "/api/admin/free-visits/ob1/decline"));
    await ctx.close();
  }
  {
    const { ctx, page } = await open(browser);
    await page.goto(`${BASE}/admin?tab=bookings`, { waitUntil: "networkidle" });
    await page.getByRole("button", { name: /All Pending/ }).click();
    await page.waitForSelector("article", { timeout: 15000 });
    await card(page, "55501234").locator("[data-review-free-visit]").click();
    await page.waitForSelector("[data-free-visit-missing]", { timeout: 10000 }).catch(() => {});
    const missing = await page.locator("[data-free-visit-missing]").innerText().catch(() => "");
    check("a callback names what is still missing", /service address/.test(missing), missing);
    check("a callback's header says callback needed", /Callback needed · awaiting contact/i.test(await page.locator('[data-free-visit-channel="callback"]').innerText().catch(() => "")));
    await shot(page, "admin-callback-review");
    await ctx.close();
  }

  console.log("\n--- Leads: the same visit, from its lead ---");
  {
    const { ctx, page, state } = await open(browser);
    await page.goto(`${BASE}/admin?tab=requests`, { waitUntil: "networkidle" });
    await page.waitForSelector("[data-review-free-visit-lead]", { timeout: 15000 });
    const leadCard = page.locator("div.rounded-2xl").filter({ hasText: "Jane Doe" }).first();
    check("the lead says Pending confirmation, slot reserved", /Pending confirmation/.test(await leadCard.innerText()) && /slot reserved/.test(await leadCard.innerText()));
    check("its status follows the visit: no hand-set dropdown", (await leadCard.locator("select").count()) === 0);
    await page.locator("[data-review-free-visit-lead]").click();
    await page.waitForSelector("[data-free-visit-panel] [data-free-visit-eligibility]", { timeout: 10000 });
    check("it opens the same visit", state.calls.some((c) => c.method === "GET" && c.path === "/api/admin/free-visits/gb1"));
    await page.locator("[data-free-visit-decline]").click();
    await page.waitForTimeout(500);
    check("Decline releases through the visit", state.calls.some((c) => c.path === "/api/admin/free-visits/gb1/decline"));
    await ctx.close();
  }

  console.log("\n--- a possible repeat customer ---");
  {
    const review = { decision: "review", code: "FREE_VISIT_REVIEW", reasons: ["same_address_different_person"], matches: [{ source: "booking", bookingNumber: "40001111", state: "consumed", status: "Completed", matchedOn: ["address"], strength: "review" }] };
    const { ctx, page, state } = await open(browser, { eligibility: review });
    await page.goto(`${BASE}/admin?tab=bookings`, { waitUntil: "networkidle" });
    await page.getByRole("button", { name: /All Pending/ }).click();
    await page.waitForSelector("[data-review-free-visit]", { timeout: 15000 });
    await card(page, "55501234").locator("[data-review-free-visit]").click();
    await page.waitForSelector('[data-free-visit-eligibility="review"]', { timeout: 10000 });
    const panel = page.locator("[data-free-visit-panel]");
    check("the review explains the match", /Same address as an earlier free visit/.test(await panel.innerText()) && /40001111/.test(await panel.innerText()));
    check("Confirm waits for the owner's verification", await panel.locator("[data-free-visit-confirm]").isDisabled());
    await panel.locator('[data-free-visit-field="line1"]').fill("40 Elm St");
    await panel.locator('[data-free-visit-field="city"]').fill("Babylon");
    await panel.locator('[data-free-visit-field="zip"]').fill("11702");
    await panel.locator("[data-free-visit-ack]").check();
    await panel.locator("[data-free-visit-confirm]").click();
    await page.waitForTimeout(800);
    const post = state.calls.find((c) => c.path.endsWith("/confirm"));
    check("the confirmation records the verification", post?.body?.acknowledgeReview === true, JSON.stringify(post?.body));
    await ctx.close();
  }

  console.log("\n--- not eligible ---");
  {
    const blocked = { decision: "blocked", code: "FREE_VISIT_USED", reasons: ["completed_free_visit"], matches: [{ source: "booking", bookingNumber: "40002222", state: "consumed", status: "Completed", matchedOn: ["phone", "email"], strength: "strong" }] };
    const { ctx, page } = await open(browser, { eligibility: blocked });
    await page.goto(`${BASE}/admin?tab=bookings`, { waitUntil: "networkidle" });
    await page.getByRole("button", { name: /All Pending/ }).click();
    await page.waitForSelector("[data-review-free-visit]", { timeout: 15000 });
    await card(page, "55501234").locator("[data-review-free-visit]").click();
    await page.waitForSelector('[data-free-visit-eligibility="blocked"]', { timeout: 10000 });
    check("a used free visit cannot be confirmed", await page.locator("[data-free-visit-confirm]").isDisabled());
    await ctx.close();
  }

  console.log("\n--- desktop calendar ---");
  {
    const { ctx, page } = await open(browser, { width: 1280, height: 900 });
    await page.goto(`${BASE}/admin?tab=bookings`, { waitUntil: "networkidle" });
    await page.waitForSelector(".bk-cal-dot", { timeout: 15000 }).catch(() => {});
    check("the calendar marks the day holding a pending request", (await page.locator(".bk-cal-dot--pending").count()) >= 1);
    await ctx.close();
  }

  await browser.close();
  const failed = results.filter((r) => !r.pass);
  console.log(`\n${results.length - failed.length}/${results.length} passed`);
  process.exit(failed.length ? 1 : 0);
})();
