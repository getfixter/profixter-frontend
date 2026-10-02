/**
 * The member calendar never offers, selects or Quick Books a date the booking
 * API will refuse, and keeps booked times visible but unclickable.
 *
 * Runs against a local Next dev server with every API call mocked:
 *
 *   npm run dev            (in another terminal)
 *   node scripts/test_booking_calendar_member_window.js
 *
 * The clock is frozen at Thursday 1 October 2026, 10:00 New York time, and the
 * server's earliest member date is the 8th. The mocked month deliberately
 * reports technician capacity on the 5th — what the API returned before this
 * fix — so the test proves the page holds the line on its own too.
 *
 *   Oct 5   open slots, inside the window      -> disabled, never selected
 *   Oct 8   first legal date, every slot booked -> disabled
 *   Oct 9   4 candidate slots, 2 booked         -> auto-selected, 4 shown, 2 clickable
 */
const assert = require("assert");
const { chromium } = require("playwright");

const BASE_URL = process.env.BOOKING_CALENDAR_URL || "http://localhost:3000";
const NOW = new Date("2026-10-01T14:00:00Z");
const EARLIEST = "2026-10-08";
const TIMES = ["08:00", "10:30", "13:00", "15:30"];

function dayPayload(date, bookedTimes) {
  const candidateSlots = TIMES.map((time) => ({
    time,
    available: !bookedTimes.includes(time),
  }));
  const slots = candidateSlots.filter((slot) => slot.available).map((slot) => slot.time);
  return {
    date,
    available: slots.length > 0,
    availableSlotCount: slots.length,
    open: slots.length > 0,
    slotCount: slots.length,
    slots,
    candidateSlots,
    taken: Object.fromEntries(bookedTimes.map((time) => [time, 1])),
    remaining: Object.fromEntries(slots.map((time) => [time, 1])),
    capacityPerSlot: 1,
  };
}

const DAYS = {
  "2026-10-05": dayPayload("2026-10-05", []),
  "2026-10-08": dayPayload("2026-10-08", TIMES),
  "2026-10-09": dayPayload("2026-10-09", ["08:00", "13:00"]),
};

function monthPayload(month) {
  return {
    month,
    engine: "reservation",
    visitDurationMinutes: 90,
    days: Object.values(DAYS).filter((day) => day.date.startsWith(month)),
  };
}

const json = (route, body, status = 200) =>
  route.fulfill({ status, contentType: "application/json", body: JSON.stringify(body) });

async function scenario(browser, { member }) {
  const availabilityRequests = [];
  {
    const context = await browser.newContext({
      viewport: { width: 1280, height: 900 },
      timezoneId: "America/New_York",
    });
    await context.addInitScript(() => {
      window.localStorage.setItem("token", "member-window-test-token");
    });
    const page = await context.newPage();
    await page.clock.setFixedTime(NOW);

    /* Registered first so the specific mocks below take precedence. */
    await page.route("**/api/**", (route) => json(route, {}, 404));
    await page.route("**/api/auth/me", (route) =>
      json(route, {
        _id: "user-1",
        name: "Window Test",
        email: "window-test@example.com",
        role: "customer",
        defaultAddressId: "addr-1",
        addresses: [{
          _id: "addr-1",
          label: "Home",
          line1: "1 Test Ave",
          city: "Lindenhurst",
          state: "NY",
          zip: "11757",
          hasActiveSubscription: true,
        }],
      })
    );
    await page.route("**/api/calendar/config", (route) =>
      json(route, {
        timezone: "America/New_York",
        slotMinutes: 150,
        minLeadDays: 0,
        closedWeekdays: [],
        defaultHours: TIMES,
        overrides: {},
        holidays: [],
        engine: "reservation",
        visitDurationMinutes: 90,
        maxAdvanceDays: 60,
        earliestBookableDate: EARLIEST,
      })
    );
    await page.route("**/api/bookings/next**", (route) =>
      json(route, {
        hasSubscription: member,
        freeFirstVisitAvailable: !member,
        introVisitStatus: member ? null : "available",
        introVisitServiceable: true,
        plan: member ? "basic" : "",
        bookingLimit: 1,
        activeCount: 0,
        activeBookings: [],
        future: null,
      })
    );
    await page.route("**/api/calendar/month**", (route) => {
      const url = new URL(route.request().url());
      availabilityRequests.push(url.search);
      return json(route, monthPayload(url.searchParams.get("month") || ""));
    });
    await page.route("**/api/calendar/slots**", (route) => {
      const url = new URL(route.request().url());
      availabilityRequests.push(url.search);
      const date = url.searchParams.get("date") || "";
      return json(route, DAYS[date] || dayPayload(date, TIMES));
    });

    await page.goto(`${BASE_URL}/book?visit=membership`, { waitUntil: "networkidle" });

    if (!member) {
      /*
       * A free first visit keeps the template's own lead time: no member flag
       * is sent and the 5th is still offered and picked.
       */
      await page.waitForSelector(
        '#pick-day[data-calendar-mode="ready"][data-selected-date="2026-10-05"]',
        { timeout: 20000 }
      );
      assert.ok(
        availabilityRequests.length > 0 &&
          availabilityRequests.every((search) => !search.includes("visit=")),
        `non-member requests must not carry the member flag: ${availabilityRequests.join(" ")}`
      );
      console.log("non-member booking window (browser): unaffected");
      await context.close();
      return;
    }

    /* 5. Auto-selection skips the window and the fully booked first legal day. */
    try {
      await page.waitForSelector(
        '#pick-day[data-calendar-mode="ready"][data-selected-date="2026-10-09"]',
        { timeout: 20000 }
      );
    } catch (error) {
      const state = await page.locator("#pick-day").evaluate((node) => ({
        mode: node.getAttribute("data-calendar-mode"),
        month: node.getAttribute("data-visible-month"),
        selected: node.getAttribute("data-selected-date"),
        times: node.getAttribute("data-available-times"),
      })).catch(() => "no #pick-day");
      console.error("calendar state:", state, "requests:", availabilityRequests);
      throw error;
    }

    /* The page asked for member-visit availability, so the API can apply the rule. */
    assert.ok(
      availabilityRequests.some((search) => search.includes("visit=membership")),
      `member availability requests must carry visit=membership: ${availabilityRequests.join(" ")}`
    );

    const dateCell = (ymd) =>
      page.locator(`[data-booking-date="${ymd}"][data-booking-date-muted="false"]`);

    /* 1. Inside the window, despite technician capacity: disabled. */
    assert.equal(await dateCell("2026-10-05").getAttribute("data-booking-date-disabled"), "true");
    assert.equal(await dateCell("2026-10-05").isDisabled(), true);
    await dateCell("2026-10-05").click({ force: true });
    assert.equal(
      await page.locator("#pick-day").getAttribute("data-selected-date"),
      "2026-10-09",
      "clicking a date inside the window must not select it"
    );

    /* 4. First legal date with every slot booked: disabled. */
    assert.equal(await dateCell("2026-10-08").isDisabled(), true);

    /* 2 & 3. A legal date with capacity: enabled; all four times shown, two clickable. */
    assert.equal(await dateCell("2026-10-09").isDisabled(), false);
    const slot = (time) => page.locator(`[data-booking-time="${time}"]`);
    assert.equal(await page.locator("[data-booking-time]").count(), 4, "all four times are shown");
    for (const time of ["08:00", "13:00"]) {
      assert.equal(await slot(time).isDisabled(), true, `${time} is booked and disabled`);
      assert.equal(await slot(time).getAttribute("data-booking-time-available"), "false");
      assert.match(await slot(time).innerText(), /Unavailable/i);
    }
    for (const time of ["10:30", "15:30"]) {
      assert.equal(await slot(time).isDisabled(), false, `${time} is bookable`);
    }

    if (process.env.BOOKING_CALENDAR_SCREENSHOT) {
      await page.locator("#pick-day").screenshot({ path: process.env.BOOKING_CALENDAR_SCREENSHOT });
    }

    /* A booked time cannot be selected, even when forced. */
    await slot("08:00").click({ force: true });
    assert.equal(
      await page.locator('[data-booking-time][class*="ring-2"]').count(),
      0,
      "a disabled time must never render as selected"
    );
    await slot("15:30").click();
    assert.equal(await page.locator('[data-booking-time="15:30"][class*="ring-2"]').count(), 1);

    /* 9. Quick Book takes the first genuinely bookable date and time. */
    await page.getByRole("button", { name: /Quick Book/ }).first().click();
    await page.getByText("What can we help with?").waitFor();
    await page.locator("button", { hasText: "TV Mounting" }).last().click();
    await page.waitForSelector('#pick-day[data-selected-date="2026-10-09"]');
    assert.equal(
      await page.locator('[data-booking-time="10:30"][class*="ring-2"]').count(),
      1,
      "Quick Book must pick 10:30, the first bookable time, not the booked 08:00"
    );

    console.log("member booking window (browser): all assertions passed");
    await context.close();
  }
}

async function main() {
  const browser = await chromium.launch({ headless: true });
  try {
    await scenario(browser, { member: true });
    await scenario(browser, { member: false });
  } finally {
    await browser.close();
  }
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
