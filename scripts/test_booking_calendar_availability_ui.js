const assert = require("assert");
const fs = require("fs");
const path = require("path");

const source = fs.readFileSync(
  path.join(__dirname, "..", "app", "components", "sections", "BookingSection.tsx"),
  "utf8"
);
const service = fs.readFileSync(
  path.join(__dirname, "..", "lib", "booking-service.ts"),
  "utf8"
);

function includes(text, snippet, message) {
  assert(text.includes(snippet), message);
}

function excludes(text, snippet, message) {
  assert(!text.includes(snippet), message);
}

includes(service, "availableSlotCount?: number;", "API types should expose authoritative available slot counts");
includes(source, "availableSlotCount: number;", "calendar state should store authoritative available slot counts");
includes(source, "return !!info && info.availableSlotCount > 0 && info.slots.length > 0;", "day enabled state should require real backend slots");
includes(source, "return !isAvailabilityOpen(info);", "disabled-day logic should use authoritative availability");
includes(source, "getMonthAvailability(monthKey)", "reservation calendar should fetch backend month availability");
includes(source, "setDisplayedTimes(availability?.slots || [])", "selected day times should come from the same availability result");
includes(source, "const requestId = ++initializationRequestRef.current;", "initial selection should ignore stale initialization responses");
includes(source, "for (let offset = 0; offset <= maxMonths; offset += 1)", "initial selection should scan months chronologically");
includes(source, "shouldMarkLoading && latestMonthRequestRef.current === loadingRequestId", "background scans should not clear visible month loading state");
includes(source, "const showNoAvailabilityThisMonth = visibleMonthLoaded && !visibleMonthHasAvailability;", "empty month state should wait for authoritative month load");
includes(source, "if (!info || isAvailabilityOpen(info)) return;", "selected dates should be preserved only while still authoritative-open");
includes(source, "const parsed = new Date(year, (month || 1) - 1, day || 1);", "date keys should be parsed as local calendar dates");
includes(source, "const year = date.getFullYear();", "date keys should be formatted from local calendar parts");
includes(source, "No available appointments in this month.", "empty month state should be shown when backend returns no slots");
includes(source, "Next available month", "empty month state should offer next available month navigation");
excludes(source, "preloadMonth", "calendar should not preload current and next months through the old racing path");

console.log("Booking calendar availability UI source checks passed.");
