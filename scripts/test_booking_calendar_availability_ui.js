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
const controller = fs.readFileSync(
  path.join(__dirname, "..", "lib", "booking-calendar-availability.ts"),
  "utf8"
);

function includes(text, snippet, message) {
  assert(text.includes(snippet), message);
}

function excludes(text, snippet, message) {
  assert(!text.includes(snippet), message);
}

includes(service, "availableSlotCount?: number;", "API types should expose authoritative available slot counts");
includes(service, "params: { month, _: Date.now() }", "month availability should bypass caches without custom request headers");
includes(service, "params: { date, _: Date.now() }", "day availability should bypass caches without custom request headers");
excludes(service, "\"Cache-Control\": \"no-store\"", "availability requests should not add custom cache headers that trigger CORS preflight");
excludes(service, "Pragma: \"no-cache\"", "availability requests should not add custom pragma headers that trigger CORS preflight");
includes(controller, "export function getBookableSlots", "bookable slots should be normalized in one helper");
includes(controller, "day.available !== true || day.availableSlotCount <= 0", "bookable helper should require authoritative availability fields");
includes(controller, "slot.available === true", "bookable helper should require slot-level availability");
includes(controller, "resolveInitialCalendarSelection", "initial calendar selection should be centralized");
includes(controller, "state.status === \"error\"", "month errors should not be treated as empty availability");
includes(controller, "generation !== getCurrentGeneration()", "stale initialization generations should be rejected");
includes(source, "const [calendarMode, setCalendarMode] = useState<CalendarMode>(\"initializing\");", "calendar should have an explicit initialization mode");
includes(source, "const generation = ++initializationGenerationRef.current;", "initialization should use generation tokens");
includes(source, "initializationAbortRef.current?.abort();", "old initialization requests should be aborted");
includes(source, "allowCache: false", "initialization should fetch fresh month availability");
includes(source, "return !isAvailabilityOpen(info);", "disabled-day logic should use authoritative availability");
includes(source, "getMonthAvailability(monthKey, { signal: options.signal })", "reservation calendar should fetch backend month availability with abort support");
includes(source, "setDisplayedTimes(result.slots.map((slot) => slot.time))", "initial selected times should come from the same availability result");
includes(source, "visibleMonthLoadState?.status === \"success\"", "empty month state should wait for authoritative success");
includes(source, "calendarMode !== \"initializing\" && visibleMonthLoaded", "empty month state should not appear during initialization");
includes(source, "data-selected-date={ymdSelected}", "browser tests should be able to assert selected date without CSS scraping");
includes(source, "const [availabilityError, setAvailabilityError] = useState(\"\");", "availability errors should not reuse the global form error banner");
includes(source, "availabilityCanSubmit", "booking submit state should require availability readiness");
includes(source, "? \"Availability Unavailable\"", "booking button should communicate availability error state");
includes(controller, "const parsed = new Date(year, (month || 1) - 1, day || 1);", "date keys should be parsed as local calendar dates");
includes(controller, "const year = date.getFullYear();", "date keys should be formatted from local calendar parts");
includes(source, "No available appointments in this month.", "empty month state should be shown when backend returns no slots");
includes(source, "Next available month", "empty month state should offer next available month navigation");
excludes(source, "preloadMonth", "calendar should not preload current and next months through the old racing path");
excludes(source, "setCurrentMonth(monthStart(closest))", "availability-map effects should not independently jump to closest cached date");
excludes(source, "return monthAvailabilityFromCache(monthKey)", "failed month requests should not be interpreted as empty cached availability");

console.log("Booking calendar availability UI source checks passed.");
