/**
 * One-Time Visit shows every scheduled time, booked ones disabled, and keeps
 * its own lead time (the member seven-day rule does not apply to it).
 *
 *   npm run dev            (in another terminal)
 *   node scripts/test_booking_one_time_slots.js
 *
 * Clock frozen at Thursday 1 October 2026, New York; every API call mocked.
 *
 *   Oct 5   10:30 and 13:00 booked  -> auto-selected (inside the member window,
 *                                      which must not matter here)
 *   Oct 6   every slot booked       -> disabled
 *   Oct 7   all free
 *
 * Then a checkout refused with SLOT_UNAVAILABLE reloads the day; the chosen
 * time is now booked, so it shows disabled and is no longer selected.
 */
const assert = require("assert");
const { chromium } = require("playwright");

const BASE_URL = process.env.BOOKING_CALENDAR_URL || "http://localhost:3000";
const NOW = new Date("2026-10-01T14:00:00Z");
const TIMES = ["08:00", "10:30", "13:00", "15:30"];

function dayPayload(date, bookedTimes) {
  const candidateSlots = TIMES.map((time) => ({ time, available: !bookedTimes.includes(time) }));
  const slots = candidateSlots.filter((slot) => slot.available).map((slot) => slot.time);
  return {
    date,
    available: slots.length > 0,
    availableSlotCount: slots.length,
    open: slots.length > 0,
    slotCount: slots.length,
    slots,
    candidateSlots,
    taken: {},
    remaining: {},
    capacityPerSlot: 1,
  };
}

const json = (route, body, status = 200) =>
  route.fulfill({ status, contentType: "application/json", body: JSON.stringify(body) });

async function main() {
  const booked = {
    "2026-10-05": ["10:30", "13:00"],
    "2026-10-06": [...TIMES],
    "2026-10-07": [],
  };
  const requests = [];
  const checkouts = [];
  const browser = await chromium.launch({ headless: true });
  try {
    const context = await browser.newContext({
      viewport: { width: 1280, height: 900 },
      timezoneId: "America/New_York",
    });
    await context.addInitScript(() => window.localStorage.setItem("token", "one-time-test-token"));
    const page = await context.newPage();
    await page.clock.setFixedTime(NOW);

    await page.route("**/api/**", (route) => json(route, {}, 404));
    await page.route("**/api/auth/me", (route) =>
      json(route, {
        _id: "user-1",
        name: "One Time",
        email: "one-time@example.com",
        role: "customer",
        defaultAddressId: "addr-1",
        addresses: [{ _id: "addr-1", label: "Home", line1: "1 Test Ave", city: "Lindenhurst", state: "NY", zip: "11757" }],
      })
    );
    await page.route("**/api/bookings/next**", (route) =>
      json(route, { hasSubscription: false, freeFirstVisitAvailable: false, introVisitStatus: "consumed", bookingLimit: 1, activeCount: 0, activeBookings: [] })
    );
    await page.route("**/api/bookings/one-time/config", (route) =>
      json(route, {
        enabled: true,
        priceCents: 9900,
        currency: "usd",
        durationMinutes: 90,
        holdMinutes: 30,
        cancellationPhone: "631-599-1363",
        allowedServices: ["TV Mounting", "Small Fix"],
        excludedServices: [],
      })
    );
    await page.route("**/api/calendar/month**", (route) => {
      const url = new URL(route.request().url());
      requests.push(url.search);
      const month = url.searchParams.get("month") || "";
      return json(route, {
        month,
        engine: "reservation",
        visitDurationMinutes: 90,
        days: Object.keys(booked).filter((d) => d.startsWith(month)).map((d) => dayPayload(d, booked[d])),
      });
    });
    await page.route("**/api/calendar/slots**", (route) => {
      const url = new URL(route.request().url());
      requests.push(url.search);
      const date = url.searchParams.get("date") || "";
      return json(route, dayPayload(date, booked[date] || TIMES));
    });
    await page.route("**/api/bookings/one-time/checkout", (route) => {
      checkouts.push(route.request().postData() || "");
      /* Somebody else took 08:00 a moment ago. */
      booked["2026-10-05"].push("08:00");
      return json(route, { code: "SLOT_UNAVAILABLE", message: "This time is no longer available. Please choose another time." }, 409);
    });

    await page.goto(`${BASE_URL}/book?visit=additional`, { waitUntil: "networkidle" });

    const cell = (ymd) => page.locator(`[data-booking-date="${ymd}"][data-booking-date-muted="false"]`);
    const slot = (time) => page.locator(`[data-booking-time="${time}"]`);

    /* 3 & 5. Auto-selection: the 5th, inside the member window — One-Time keeps its own lead time. */
    await page.waitForSelector('[data-booking-date="2026-10-05"][data-booking-date-selected="true"]', { timeout: 20000 });
    assert.ok(requests.length > 0 && requests.every((s) => !s.includes("visit=")), `One-Time must not send the member flag: ${requests}`);

    /* 1. Partly booked: enabled, all four shown, booked ones disabled. */
    await page.waitForFunction(() => document.querySelectorAll("[data-booking-time]").length === 4);
    assert.equal(await cell("2026-10-05").isDisabled(), false);
    for (const [time, free] of [["08:00", true], ["10:30", false], ["13:00", false], ["15:30", true]]) {
      assert.equal(await slot(time).isDisabled(), !free, `${time} disabled=${!free}`);
      assert.equal(await slot(time).getAttribute("data-booking-time-available"), String(free));
    }
    assert.match(await slot("10:30").innerText(), /Unavailable/i);
    /* Auto-selection picked a date, never a time — and so never a disabled one. */
    assert.equal(await page.locator('[data-booking-time][class*="ring-2"]').count(), 0);

    await slot("10:30").click({ force: true });
    assert.equal(await page.locator('[data-booking-time][class*="ring-2"]').count(), 0, "a booked time cannot be selected");

    /* 2. Every slot booked: the whole date is disabled. */
    assert.equal(await cell("2026-10-06").isDisabled(), true);
    assert.equal(await cell("2026-10-07").isDisabled(), false);

    if (process.env.BOOKING_CALENDAR_SCREENSHOT) {
      await page.screenshot({ path: process.env.BOOKING_CALENDAR_SCREENSHOT, fullPage: false });
    }

    /* A refusal reloads the day; the now-booked selection is dropped. */
    await slot("08:00").click();
    assert.equal(await page.locator('[data-booking-time="08:00"][class*="ring-2"]').count(), 1);
    const summary = page.locator("span", { hasText: /^Date & time$/ }).locator("xpath=following-sibling::strong");
    assert.match(await summary.innerText(), /at 8:00 AM/, "the summary shows the chosen time");
    await page.locator('button[aria-expanded]').filter({ hasText: /Choose|Select|Small|task/i }).first().click().catch(() => {});
    await page.locator("button", { hasText: /^TV Mounting$/ }).first().click();
    await page.locator("textarea").first().fill("Mount a television on the living room wall please");
    await page.locator('input[type="file"]').last().setInputFiles({
      name: "p.png",
      mimeType: "image/png",
      buffer: Buffer.from("iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==", "base64"),
    });
    await page.waitForTimeout(1500);
    await page.locator("button", { hasText: /Continue to payment|Checkout|Pay|Book/ }).last().click();
    await page.waitForFunction(() => document.querySelector('[data-booking-time="08:00"]')?.hasAttribute("disabled"), null, { timeout: 15000 });
    assert.equal(checkouts.length, 1, "the checkout was attempted");
    assert.ok(checkouts[0].includes("08:00"), "the submitted time was the selected available one");
    assert.equal(await slot("08:00").isDisabled(), true, "08:00 now shows as unavailable");
    assert.equal(await page.locator('[data-booking-time][class*="ring-2"]').count(), 0, "the stale selection is cleared");
    await page.waitForTimeout(500);
    assert.doesNotMatch(await summary.innerText(), / at /, "the selected time itself is cleared, not just un-highlighted");
    assert.equal(await slot("15:30").isDisabled(), false);

    console.log("one-time visit slots (browser): all assertions passed");
  } finally {
    await browser.close();
  }
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
