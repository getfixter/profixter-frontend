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
    compilerOptions: {
      module: ts.ModuleKind.CommonJS,
      target: ts.ScriptTarget.ES2020,
      esModuleInterop: true,
    },
  }).outputText;
  const mod = { exports: {} };
  const fn = new Function("exports", "require", "module", output);
  fn(mod.exports, require, mod);
  return mod.exports;
}

const {
  addMonthsLocal,
  formatDateYMDLocal,
  getMonthKeyLocal,
  normalizeDayAvailability,
  resolveInitialCalendarSelection,
} = loadController();

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function day(date, times) {
  return [
    date,
    normalizeDayAvailability({
      date,
      available: times.length > 0,
      availableSlotCount: times.length,
      slots: times.map((time) => ({ time, available: true })),
      taken: {},
      remaining: Object.fromEntries(times.map((time) => [time, 1])),
      capacityPerSlot: 1,
    }),
  ];
}

function monthData(entries) {
  return Object.fromEntries(entries);
}

const JULY = monthData([
  day("2026-07-20", ["09:00"]),
  day("2026-07-21", ["10:00"]),
  day("2026-07-22", ["11:00"]),
]);
const EMPTY_JULY = monthData([]);
const AUGUST = monthData([day("2026-08-01", ["09:00"])]);

async function runInitialization({
  julyData = JULY,
  julyDelay = 0,
  augustDelay = 0,
  failJuly = false,
  abortAfterMs = null,
  generationRef = { current: 1 },
} = {}) {
  const controller = new AbortController();
  if (abortAfterMs !== null) {
    setTimeout(() => controller.abort(), abortAfterMs);
  }

  const requestedMonths = [];
  const result = await resolveInitialCalendarSelection({
    generation: generationRef.current,
    getCurrentGeneration: () => generationRef.current,
    signal: controller.signal,
    startMonth: new Date(2026, 6, 1),
    maxAdvanceDays: 62,
    now: new Date(2026, 6, 16, 12, 0, 0),
    visibleMonthBefore: "2026-07",
    selectedDateBefore: null,
    loadMonth: async (monthDate) => {
      const month = `${monthDate.getFullYear()}-${String(monthDate.getMonth() + 1).padStart(2, "0")}`;
      requestedMonths.push(month);
      if (month === "2026-07") {
        await sleep(julyDelay);
        if (controller.signal.aborted) return { status: "aborted", month };
        if (failJuly) {
          return { status: "error", month, error: new Error("July failed") };
        }
        return { status: "success", month, data: julyData, source: "network" };
      }
      if (month === "2026-08") {
        await sleep(augustDelay);
        if (controller.signal.aborted) return { status: "aborted", month };
        return { status: "success", month, data: AUGUST, source: "cache" };
      }
      return { status: "success", month, data: {}, source: "network" };
    },
  });

  return { result, requestedMonths };
}

async function main() {
  const january = addMonthsLocal(new Date(2026, 11, 1), 1);
  assert.equal(getMonthKeyLocal(january), "2027-01", "December navigation should cross into January");
  assert.equal(formatDateYMDLocal(new Date(2027, 0, 1)), "2027-01-01", "January dates should remain local date-only values");

  for (let i = 0; i < 100; i += 1) {
    const julyDelay = Math.floor(Math.random() * 501);
    const augustDelay = Math.floor(Math.random() * 501);
    const { result, requestedMonths } = await runInitialization({ julyDelay, augustDelay });
    assert.equal(result.status, "success", `run ${i} should select a date`);
    assert.equal(result.ymd, "2026-07-20", `run ${i} selected ${result.ymd}`);
    assert.equal(result.month, "2026-07", `run ${i} opened ${result.month}`);
    assert.deepEqual(requestedMonths, ["2026-07"], `run ${i} should not request August when July is available`);
  }

  {
    const fastJuly = await runInitialization({ julyDelay: 0, augustDelay: 500 });
    assert.equal(fastJuly.result.status, "success");
    assert.equal(fastJuly.result.ymd, "2026-07-20");
  }

  {
    const slowJuly = await runInitialization({ julyDelay: 500, augustDelay: 0 });
    assert.equal(slowJuly.result.status, "success");
    assert.equal(slowJuly.result.ymd, "2026-07-20");
  }

  {
    const generationRef = { current: 1 };
    const first = runInitialization({ julyDelay: 50, abortAfterMs: 5, generationRef });
    setTimeout(() => {
      generationRef.current = 2;
    }, 5);
    const firstResult = await first;
    assert(
      ["aborted", "stale"].includes(firstResult.result.status),
      `aborted first init returned ${firstResult.result.status}`
    );

    const second = await runInitialization({ julyDelay: 0, generationRef });
    assert.equal(second.result.status, "success");
    assert.equal(second.result.ymd, "2026-07-20");
  }

  {
    const strictFirst = await runInitialization({ julyDelay: 10, abortAfterMs: 0 });
    assert(["aborted", "stale"].includes(strictFirst.result.status));
    const strictSecond = await runInitialization({ julyDelay: 0 });
    assert.equal(strictSecond.result.status, "success");
    assert.equal(strictSecond.result.ymd, "2026-07-20");
  }

  {
    const cachedAugust = await runInitialization({ julyDelay: 250, augustDelay: 0 });
    assert.equal(cachedAugust.result.status, "success");
    assert.equal(cachedAugust.result.ymd, "2026-07-20");
    assert.deepEqual(cachedAugust.requestedMonths, ["2026-07"]);
  }

  {
    const failedJuly = await runInitialization({ failJuly: true, augustDelay: 0 });
    assert.equal(failedJuly.result.status, "error");
    assert.deepEqual(failedJuly.requestedMonths, ["2026-07"]);
  }

  {
    const emptyJuly = await runInitialization({ julyData: EMPTY_JULY, augustDelay: 0 });
    assert.equal(emptyJuly.result.status, "success");
    assert.equal(emptyJuly.result.ymd, "2026-08-01");
    assert.deepEqual(emptyJuly.requestedMonths, ["2026-07", "2026-08"]);
  }

  console.log("Booking calendar initialization race tests passed: 100/100 selected 2026-07-20.");
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
