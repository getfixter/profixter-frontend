/**
 * Calendar helpers: candidate slots and the member's earliest bookable date.
 *
 *   node scripts/test_booking_calendar_member_window_unit.js
 *
 * No server needed — the helper module is transpiled in place, the same way
 * test_booking_calendar_initialization_race.js loads it.
 */
const assert = require("assert");
const fs = require("fs");
const path = require("path");
const ts = require("typescript");

function loadController() {
  const source = fs.readFileSync(
    path.join(__dirname, "..", "lib", "booking-calendar-availability.ts"),
    "utf8"
  );
  const output = ts.transpileModule(source, {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020 },
  }).outputText;
  const mod = { exports: {} };
  new Function("exports", "require", "module", output)(mod.exports, require, mod);
  return mod.exports;
}

const {
  firstBookableDateInMonth,
  formatDateYMDLocal,
  getBookableSlots,
  isBookableDay,
  normalizeDayAvailability,
  resolveInitialCalendarSelection,
} = loadController();

const TIMES = ["08:00", "10:30", "13:00", "15:30"];
function apiDay(date, booked) {
  const candidateSlots = TIMES.map((time) => ({ time, available: !booked.includes(time) }));
  const slots = candidateSlots.filter((s) => s.available).map((s) => s.time);
  return {
    date,
    available: slots.length > 0,
    availableSlotCount: slots.length,
    slots,
    candidateSlots,
    taken: {},
    remaining: {},
    capacityPerSlot: 1,
  };
}

async function run() {
  /* 3. Two of four booked: four listed, two bookable, day open. */
  const partly = normalizeDayAvailability(apiDay("2026-10-09", ["08:00", "13:00"]));
  assert.equal(partly.hasCandidateSlots, true);
  assert.deepEqual(partly.slots.map((s) => s.time), TIMES);
  assert.deepEqual(getBookableSlots(partly).map((s) => s.time), ["10:30", "15:30"]);
  assert.equal(isBookableDay(partly), true);

  /* 4. All booked: still listed, but no bookable slot, so the day is closed. */
  const full = normalizeDayAvailability(apiDay("2026-10-10", TIMES));
  assert.equal(full.slots.length, 4);
  assert.equal(isBookableDay(full), false);

  /* A visible candidate never counts as availability on its own word. */
  const disagree = normalizeDayAvailability({
    ...apiDay("2026-10-11", []),
    slots: ["10:30"],
    availableSlotCount: 1,
  });
  assert.deepEqual(getBookableSlots(disagree).map((s) => s.time), ["10:30"]);

  /* An older API with no candidate list behaves exactly as before. */
  const legacy = normalizeDayAvailability({
    date: "2026-10-12",
    slots: ["10:30"],
    taken: {},
    capacityPerSlot: 1,
  });
  assert.equal(legacy.hasCandidateSlots, false);
  assert.deepEqual(legacy.slots, [{ time: "10:30", available: true }]);

  /* 5. Auto-selection respects the earliest date, even if a day before it looks open. */
  const now = new Date(2026, 9, 1, 10, 0, 0);
  const october = {
    "2026-10-05": normalizeDayAvailability(apiDay("2026-10-05", [])),
    "2026-10-08": normalizeDayAvailability(apiDay("2026-10-08", TIMES)),
    "2026-10-09": partly,
  };
  const monthDate = new Date(2026, 9, 1);
  assert.equal(
    formatDateYMDLocal(firstBookableDateInMonth(monthDate, october, now)),
    "2026-10-05",
    "without an earliest date the helper behaves as before"
  );
  assert.equal(
    formatDateYMDLocal(firstBookableDateInMonth(monthDate, october, now, "2026-10-08")),
    "2026-10-09"
  );

  /* ...including when the window spills into the next month. */
  const lateSeptember = new Date(2026, 8, 28, 10, 0, 0);
  const septemberDays = {
    "2026-09-29": normalizeDayAvailability(apiDay("2026-09-29", [])),
    "2026-09-30": normalizeDayAvailability(apiDay("2026-09-30", [])),
  };
  const result = await resolveInitialCalendarSelection({
    generation: 1,
    getCurrentGeneration: () => 1,
    signal: new AbortController().signal,
    startMonth: new Date(2026, 8, 1),
    maxAdvanceDays: 60,
    now: lateSeptember,
    earliestBookableDate: "2026-10-05",
    loadMonth: async (date) => {
      const month = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}`;
      return {
        status: "success",
        month,
        source: "network",
        data: month === "2026-09" ? septemberDays : october,
      };
    },
  });
  assert.equal(result.status, "success");
  assert.equal(result.ymd, "2026-10-05", "September is entirely inside the window");
  assert.ok(result.slots.every((slot) => slot.available === true), "only bookable slots are carried");

  /* The selection the init hands over never includes a booked time. */
  const fromPartly = await resolveInitialCalendarSelection({
    generation: 1,
    getCurrentGeneration: () => 1,
    signal: new AbortController().signal,
    startMonth: monthDate,
    maxAdvanceDays: 60,
    now,
    earliestBookableDate: "2026-10-08",
    loadMonth: async () => ({ status: "success", month: "2026-10", source: "network", data: october }),
  });
  assert.equal(fromPartly.ymd, "2026-10-09");
  assert.deepEqual(fromPartly.slots.map((s) => s.time), ["10:30", "15:30"]);

  console.log("member booking window (unit): all assertions passed");
}

run().catch((error) => {
  console.error(error);
  process.exit(1);
});
