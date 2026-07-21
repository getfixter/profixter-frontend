const assert = require("assert");

async function loadPlaywright() {
  try {
    return require("playwright");
  } catch {
    throw new Error(
      "Playwright is not installed. Run with: npx -p playwright node scripts/test_booking_calendar_browser_refresh.js"
    );
  }
}

function delay(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function monthResponse(month) {
  const days =
    month === "2026-07"
      ? [
          { date: "2026-07-22", time: "09:00" },
          { date: "2026-07-23", time: "10:00" },
          { date: "2026-07-24", time: "11:00" },
        ]
      : month === "2026-08"
        ? [{ date: "2026-08-01", time: "09:00" }]
        : [];

  return {
    month,
    engine: "reservation",
    visitDurationMinutes: 90,
    days: days.map((entry) => ({
      date: entry.date,
      available: true,
      availableSlotCount: 1,
      open: true,
      slotCount: 1,
      slots: [{ time: entry.time, available: true }],
      taken: {},
      remaining: { [entry.time]: 1 },
      capacityPerSlot: 1,
    })),
  };
}

async function main() {
  const { chromium } = await loadPlaywright();
  const baseUrl = process.env.BOOKING_CALENDAR_URL || "http://localhost:3000";
  const runs = Number(process.env.BOOKING_CALENDAR_BROWSER_RUNS || 20);
  const browser = await chromium.launch({ headless: true });

  try {
    const context = await browser.newContext();
    await context.addInitScript(() => {
      window.localStorage.setItem("token", "browser-refresh-test-token");
      window.localStorage.removeItem("user");
    });

    const page = await context.newPage();
    const requestedMonths = [];
    const createdBookings = [];

    await page.route("**/api/auth/me", async (route) => {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        headers: { "Cache-Control": "no-store" },
        body: JSON.stringify({
          _id: "user-1",
          userId: "USR-1",
          name: "Calendar Test",
          email: "calendar-test@example.com",
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
        }),
      });
    });

    await page.route("**/api/calendar/config", async (route) => {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        headers: { "Cache-Control": "no-store" },
        body: JSON.stringify({
          timezone: "America/New_York",
          slotMinutes: 60,
          minLeadDays: 0,
          closedWeekdays: [],
          handymanCapacity: 1,
          defaultHours: [],
          overrides: {},
          holidays: [],
          engine: "reservation",
          visitDurationMinutes: 90,
          maxAdvanceDays: 62,
        }),
      });
    });

    await page.route("**/api/bookings/next**", async (route) => {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        headers: { "Cache-Control": "no-store" },
        body: JSON.stringify({
          hasSubscription: true,
          plan: "basic",
          bookingLimit: 1,
          activeCount: 0,
          activeBookings: [],
          future: null,
        }),
      });
    });

    await page.route("**/api/bookings", async (route) => {
      createdBookings.push(route.request().postData() || "");
      await route.fulfill({
        status: 201,
        contentType: "application/json",
        body: JSON.stringify({
          message: "Booking created",
          booking: {
            bookingNumber: "BK-FUTURE-1",
            service: "Labor Only",
            date: "2026-08-01",
            time: "09:00",
          },
        }),
      });
    });

    await page.route("**/api/calendar/month**", async (route) => {
      const url = new URL(route.request().url());
      const month = url.searchParams.get("month") || "";
      requestedMonths.push(month);
      await delay(Math.floor(Math.random() * 501));
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        headers: { "Cache-Control": "no-store" },
        body: JSON.stringify(monthResponse(month)),
      });
    });

    await page.route("**/api/calendar/slots**", async (route) => {
      const url = new URL(route.request().url());
      const date = url.searchParams.get("date") || "";
      const month = date.slice(0, 7);
      const day = monthResponse(month).days.find((entry) => entry.date === date);
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        headers: { "Cache-Control": "no-store" },
        body: JSON.stringify(day || {
          date,
          available: false,
          availableSlotCount: 0,
          slots: [],
          taken: {},
          remaining: {},
          capacityPerSlot: 1,
        }),
      });
    });

    for (let i = 0; i < runs; i += 1) {
      requestedMonths.length = 0;
      await page.goto(`${baseUrl}/membership#pick-day`, { waitUntil: "networkidle" });
      await page.waitForSelector('#pick-day[data-calendar-mode="ready"][data-selected-date="2026-07-22"]', {
        timeout: 15000,
      });

      const state = await page.locator("#pick-day").evaluate((node) => ({
        visibleMonth: node.getAttribute("data-visible-month"),
        selectedDate: node.getAttribute("data-selected-date"),
        availableTimes: node.getAttribute("data-available-times"),
      }));
      assert.equal(state.visibleMonth, "2026-07", `run ${i} visible month`);
      assert.equal(state.selectedDate, "2026-07-22", `run ${i} selected date`);
      assert(state.availableTimes && state.availableTimes.includes("09:00"), `run ${i} visible slots`);

      const enabledDates = await page
        .locator('[data-booking-date^="2026-07"][data-booking-date-muted="false"][data-booking-date-disabled="false"]')
        .evaluateAll((nodes) => nodes.map((node) => node.getAttribute("data-booking-date")));
      assert.deepEqual(enabledDates, ["2026-07-22", "2026-07-23", "2026-07-24"]);

      for (const date of enabledDates) {
        await page.locator(`[data-booking-date="${date}"]`).click();
        const visibleTimeCount = await page.locator('[data-booking-time][data-booking-time-available="true"]').count();
        assert(visibleTimeCount > 0, `${date} should show at least one available time`);
      }

      await page.getByRole("button", { name: "Next month" }).click();
      await page.waitForSelector('#pick-day[data-calendar-mode="ready"][data-visible-month="2026-08"]', {
        timeout: 15000,
      });
      assert(
        requestedMonths.includes("2026-08"),
        `run ${i} should request availability with month=2026-08`
      );

      const augustFirst = page.locator('[data-booking-date="2026-08-01"]');
      await augustFirst.waitFor({ state: "visible" });
      assert.equal(
        await augustFirst.getAttribute("data-booking-date-disabled"),
        "false",
        `run ${i} August 1 should be enabled`
      );
      await augustFirst.click();
      await page.waitForSelector('#pick-day[data-selected-date="2026-08-01"][data-available-times*="09:00"]');
      assert(
        await page.locator('[data-booking-time][data-booking-time-available="true"]').count() > 0,
        `run ${i} August 1 should show a bookable time`
      );
      await page.locator('[data-booking-time="09:00"]').click();
      await page.getByPlaceholder("Describe your task. If we need to bring any materials or special tools, please let us know.").fill("Repair the loose kitchen cabinet");
      await page.locator('input[type="file"]').nth(1).setInputFiles({
        name: "booking-test.png",
        mimeType: "image/png",
        buffer: Buffer.from("iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII=", "base64"),
      });
      const bookButton = page.getByRole("button", { name: "Book Your Visit" });
      await bookButton.waitFor({ state: "visible" });
      await page.waitForFunction(() => {
        const button = document.querySelector('[data-track="booking-cta"]');
        return button instanceof HTMLButtonElement && !button.disabled;
      });
      await bookButton.click();
      await page.getByRole("heading", { name: "Visit booked" }).waitFor();
      assert(
        createdBookings.at(-1)?.includes("2026-08-01"),
        `run ${i} booking submission should preserve requestedDate=2026-08-01`
      );

      await page.reload({ waitUntil: "networkidle" });
    }

    console.log(`Booking calendar browser hard-refresh tests passed: ${runs}/${runs}.`);
  } finally {
    await browser.close();
  }
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
