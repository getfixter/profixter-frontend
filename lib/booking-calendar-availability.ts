export type CalendarMode = "initializing" | "ready" | "manual-navigation";

export type AvailabilitySlot = {
  time: string;
  available: boolean;
};

export type RawAvailabilitySlot =
  | string
  | {
      time?: string;
      available?: boolean;
    };

export type DayAvailabilityInput = {
  date?: string;
  available?: boolean;
  availableSlotCount?: number;
  slotCount?: number;
  slots?: RawAvailabilitySlot[];
  taken?: Record<string, number>;
  capacity?: number;
  capacityPerSlot?: number;
  remaining?: Record<string, number>;
};

export type DayAvailability = {
  date?: string;
  available: boolean;
  availableSlotCount: number;
  taken: Record<string, number>;
  capacity: number;
  slots: AvailabilitySlot[];
  remaining?: Record<string, number>;
};

export type MonthAvailabilityMap = Record<string, DayAvailability>;

export type MonthLoadSource = "network" | "cache";

export type MonthLoadState =
  | {
      status: "loading";
      month: string;
    }
  | {
      status: "success";
      month: string;
      data: MonthAvailabilityMap;
      source: MonthLoadSource;
    }
  | {
      status: "error";
      month: string;
      error: Error;
    }
  | {
      status: "aborted";
      month: string;
    }
  | {
      status: "stale";
      month: string;
    };

export type AvailabilityCacheKeyInput = {
  yearMonth: string;
  addressId?: string | null;
  serviceType?: string | null;
  membershipId?: string | null;
  userId?: string | null;
  timezone?: string | null;
};

export const CACHE_TTL_MS = 30_000;

export function formatDateYMDLocal(date: Date): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

export function dateFromYMDLocal(ymd: string): Date {
  const [year, month, day] = ymd.split("-").map(Number);
  const parsed = new Date(year, (month || 1) - 1, day || 1);
  parsed.setHours(0, 0, 0, 0);
  return parsed;
}

export function monthStartLocal(date: Date): Date {
  return new Date(date.getFullYear(), date.getMonth(), 1);
}

export function addMonthsLocal(date: Date, months: number): Date {
  return new Date(date.getFullYear(), date.getMonth() + months, 1);
}

export function getMonthKeyLocal(date: Date): string {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}`;
}

export function buildAvailabilityCacheKey(input: AvailabilityCacheKeyInput): string {
  return [
    input.yearMonth,
    input.addressId || "no-address",
    input.serviceType || "no-service",
    input.membershipId || "no-membership",
    input.userId || "anonymous",
    input.timezone || "America/New_York",
  ].join("|");
}

export function normalizeDayAvailability(data: DayAvailabilityInput): DayAvailability {
  const normalizedSlots = (Array.isArray(data.slots) ? data.slots : [])
    .map((slot): AvailabilitySlot | null => {
      if (typeof slot === "string") {
        return slot ? { time: slot, available: true } : null;
      }

      const time = typeof slot?.time === "string" ? slot.time : "";
      if (!time) return null;
      return {
        time,
        available: slot.available === true,
      };
    })
    .filter((slot): slot is AvailabilitySlot => Boolean(slot));
  const inferredBookableCount = normalizedSlots.filter((slot) => slot.available === true).length;
  const count = Number(data.availableSlotCount ?? data.slotCount ?? inferredBookableCount);
  const availableSlotCount = Number.isFinite(count) ? count : inferredBookableCount;
  const available =
    data.available === true ||
    (data.available === undefined && availableSlotCount > 0 && inferredBookableCount > 0);

  return {
    date: data.date,
    available,
    availableSlotCount,
    taken: data.taken || {},
    capacity: data.capacity ?? data.capacityPerSlot ?? 1,
    slots: normalizedSlots,
    remaining: data.remaining || {},
  };
}

export function getBookableSlots(day?: DayAvailability | null): AvailabilitySlot[] {
  if (!day || day.available !== true || day.availableSlotCount <= 0) return [];
  return day.slots.filter((slot) => slot.available === true && Boolean(slot.time));
}

export function isBookableDay(day?: DayAvailability | null): boolean {
  return getBookableSlots(day).length > 0;
}

export function firstBookableDateInMonth(
  monthDate: Date,
  monthAvailability: MonthAvailabilityMap,
  now = new Date()
): Date | null {
  const monthKey = getMonthKeyLocal(monthDate);
  const today = new Date(now);
  today.setHours(0, 0, 0, 0);

  const first = Object.entries(monthAvailability)
    .filter(([ymd, info]) => ymd.startsWith(monthKey) && isBookableDay(info))
    .map(([ymd]) => dateFromYMDLocal(ymd))
    .filter((date) => date >= today)
    .sort((a, b) => a.getTime() - b.getTime())[0];

  return first || null;
}

export type InitializationDiagnostics = {
  initializationId: string;
  requestId: number;
  requestedMonth: string;
  responseMonth?: string;
  requestStartedAt: number;
  requestFinishedAt?: number;
  isStaleResponse: boolean;
  visibleMonthBefore?: string;
  selectedDateBefore?: string | null;
  availableDates?: string[];
  earliestAvailableDate?: string | null;
  selectedDateAfter?: string | null;
  visibleMonthAfter?: string | null;
  source?: MonthLoadSource;
  status?: MonthLoadState["status"];
};

export type InitialSelectionResult =
  | {
      status: "success";
      month: string;
      date: Date;
      ymd: string;
      slots: AvailabilitySlot[];
      diagnostics: InitializationDiagnostics[];
    }
  | {
      status: "none";
      diagnostics: InitializationDiagnostics[];
    }
  | {
      status: "error";
      error: Error;
      diagnostics: InitializationDiagnostics[];
    }
  | {
      status: "aborted" | "stale";
      diagnostics: InitializationDiagnostics[];
    };

export async function resolveInitialCalendarSelection({
  generation,
  getCurrentGeneration,
  signal,
  startMonth,
  maxAdvanceDays,
  loadMonth,
  now = new Date(),
  visibleMonthBefore,
  selectedDateBefore,
  initializationId = `booking-calendar-init-${generation}`,
}: {
  generation: number;
  getCurrentGeneration: () => number;
  signal: AbortSignal;
  startMonth: Date;
  maxAdvanceDays: number;
  loadMonth: (monthDate: Date, requestId: number) => Promise<MonthLoadState>;
  now?: Date;
  visibleMonthBefore?: string;
  selectedDateBefore?: string | null;
  initializationId?: string;
}): Promise<InitialSelectionResult> {
  const diagnostics: InitializationDiagnostics[] = [];
  const maxMonths = Math.max(1, Math.ceil(maxAdvanceDays / 31) + 1);

  for (let offset = 0; offset <= maxMonths; offset += 1) {
    if (signal.aborted) return { status: "aborted", diagnostics };
    if (generation !== getCurrentGeneration()) return { status: "stale", diagnostics };

    const candidateMonth = addMonthsLocal(startMonth, offset);
    const requestedMonth = getMonthKeyLocal(candidateMonth);
    const requestStartedAt = Date.now();
    const requestId = offset + 1;
    const state = await loadMonth(candidateMonth, requestId);
    const requestFinishedAt = Date.now();
    const isStaleResponse = generation !== getCurrentGeneration() || signal.aborted;

    if (isStaleResponse) {
      diagnostics.push({
        initializationId,
        requestId,
        requestedMonth,
        responseMonth: "month" in state ? state.month : undefined,
        requestStartedAt,
        requestFinishedAt,
        isStaleResponse,
        visibleMonthBefore,
        selectedDateBefore,
        selectedDateAfter: null,
        visibleMonthAfter: null,
        status: state.status,
        source: state.status === "success" ? state.source : undefined,
      });
      return { status: signal.aborted ? "aborted" : "stale", diagnostics };
    }

    if (state.status === "aborted" || state.status === "stale") {
      diagnostics.push({
        initializationId,
        requestId,
        requestedMonth,
        responseMonth: state.month,
        requestStartedAt,
        requestFinishedAt,
        isStaleResponse: state.status === "stale",
        visibleMonthBefore,
        selectedDateBefore,
        selectedDateAfter: null,
        visibleMonthAfter: null,
        status: state.status,
      });
      return { status: state.status, diagnostics };
    }

    if (state.status === "error") {
      diagnostics.push({
        initializationId,
        requestId,
        requestedMonth,
        responseMonth: state.month,
        requestStartedAt,
        requestFinishedAt,
        isStaleResponse: false,
        visibleMonthBefore,
        selectedDateBefore,
        selectedDateAfter: null,
        visibleMonthAfter: requestedMonth,
        status: state.status,
      });
      return { status: "error", error: state.error, diagnostics };
    }

    if (state.status !== "success" || state.month !== requestedMonth) {
      const error = new Error("Availability month response did not match the requested month.");
      diagnostics.push({
        initializationId,
        requestId,
        requestedMonth,
        responseMonth: "month" in state ? state.month : undefined,
        requestStartedAt,
        requestFinishedAt,
        isStaleResponse: false,
        visibleMonthBefore,
        selectedDateBefore,
        selectedDateAfter: null,
        visibleMonthAfter: requestedMonth,
        status: state.status,
      });
      return { status: "error", error, diagnostics };
    }

    const availableDates = Object.entries(state.data)
      .filter(([, info]) => isBookableDay(info))
      .map(([ymd]) => ymd)
      .sort();
    const firstAvailable = firstBookableDateInMonth(candidateMonth, state.data, now);
    const earliestAvailableDate = firstAvailable ? formatDateYMDLocal(firstAvailable) : null;
    diagnostics.push({
      initializationId,
      requestId,
      requestedMonth,
      responseMonth: state.month,
      requestStartedAt,
      requestFinishedAt,
      isStaleResponse: false,
      visibleMonthBefore,
      selectedDateBefore,
      availableDates,
      earliestAvailableDate,
      selectedDateAfter: earliestAvailableDate,
      visibleMonthAfter: earliestAvailableDate ? requestedMonth : null,
      source: state.source,
      status: state.status,
    });

    if (firstAvailable) {
      const ymd = formatDateYMDLocal(firstAvailable);
      const slots = getBookableSlots(state.data[ymd]);
      if (!slots.length) {
        return {
          status: "error",
          error: new Error("Selected date no longer has bookable slots."),
          diagnostics,
        };
      }

      return {
        status: "success",
        month: requestedMonth,
        date: firstAvailable,
        ymd,
        slots,
        diagnostics,
      };
    }
  }

  return { status: "none", diagnostics };
}
