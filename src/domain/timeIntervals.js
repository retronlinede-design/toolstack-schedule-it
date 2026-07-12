export const MINUTES_PER_DAY = 1440;
export const SHORT_TURNAROUND_MINUTES = 15;
export const MOVEMENT_TIME_FIELDS = ["driverStart", "departureTime", "arrivalTime", "eventStartTime", "eventEndTime", "endTime"];

export function parseStrictTime(value) {
  if (typeof value !== "string" || !/^([01]\d|2[0-3]):([0-5]\d)$/.test(value)) return { ok: false, code: "INVALID_TIME", value };
  const [hours, minutes] = value.split(":").map(Number);
  return { ok: true, minutes: hours * 60 + minutes };
}

export function dateToDayNumber(value) {
  if (typeof value !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return null;
  const [year, month, day] = value.split("-").map(Number);
  const date = new Date(Date.UTC(year, month - 1, day));
  if (date.getUTCFullYear() !== year || date.getUTCMonth() !== month - 1 || date.getUTCDate() !== day) return null;
  return Math.floor(date.getTime() / 86_400_000);
}

export function buildMovementTimeline(movement) {
  const errors = [];
  const values = {};
  let rollover = 0;
  let previous = null;
  let previousField = null;

  for (const field of MOVEMENT_TIME_FIELDS) {
    const raw = movement[field];
    if (raw === "" || raw === undefined || raw === null) continue;
    const parsed = parseStrictTime(raw);
    if (!parsed.ok) {
      errors.push({ type: "INVALID_TIME", severity: "error", field, message: `${field} must use strict HH:mm format.` });
      continue;
    }
    let adjusted = parsed.minutes + rollover * MINUTES_PER_DAY;
    if (previous !== null && adjusted < previous) {
      if (!movement.continuesOvernight) {
        errors.push({ type: "CHRONOLOGY_ERROR", severity: "error", field, previousField, message: `${field} occurs before ${previousField}; enable Continues past midnight only when intentional.` });
      } else if (rollover === 0) {
        rollover = 1;
        adjusted += MINUTES_PER_DAY;
      } else {
        errors.push({ type: "MULTIPLE_ROLLOVERS", severity: "error", field, previousField, message: "A movement cannot roll past midnight more than once." });
      }
    }
    values[field] = adjusted;
    previous = adjusted;
    previousField = field;
  }
  if (movement.continuesOvernight && rollover === 0 && Object.keys(values).length > 1) {
    errors.push({ type: "AMBIGUOUS_OVERNIGHT", severity: "warning", field: "continuesOvernight", message: "Continues past midnight is enabled but no midnight rollover is present." });
  }
  return { ok: !errors.some((issue) => issue.severity === "error"), values, rolloverCount: rollover, issues: errors };
}

export function buildMovementInterval(movement, day) {
  const timeline = buildMovementTimeline(movement);
  const dayNumber = dateToDayNumber(day?.date);
  if (dayNumber === null) return { ok: false, interval: null, issues: [...timeline.issues, { type: "INCOMPLETE_TIMING", severity: "warning", message: "A valid schedule date is required for resource conflict detection." }] };
  const startFields = ["driverStart", "departureTime", "arrivalTime", "eventStartTime"];
  const endFields = ["endTime", "eventEndTime", "eventStartTime", "arrivalTime", "departureTime"];
  const startField = startFields.find((field) => timeline.values[field] !== undefined);
  const endField = endFields.find((field) => timeline.values[field] !== undefined);
  if (!timeline.ok || !startField || !endField) return { ok: false, interval: null, issues: [...timeline.issues, ...(!startField || !endField ? [{ type: "INCOMPLETE_TIMING", severity: "warning", message: "A reliable operational interval could not be constructed." }] : [])] };
  const start = dayNumber * MINUTES_PER_DAY + timeline.values[startField];
  const end = dayNumber * MINUTES_PER_DAY + timeline.values[endField];
  if (end < start) return { ok: false, interval: null, issues: [...timeline.issues, { type: "CHRONOLOGY_ERROR", severity: "error", message: "The derived movement interval ends before it starts." }] };
  return { ok: true, interval: { movementId: movement.id, dayId: day.id, start, end, startField, endField }, issues: timeline.issues };
}

export function absoluteTimeForDay(date, time) {
  const dayNumber = dateToDayNumber(date);
  const parsed = parseStrictTime(time);
  return dayNumber === null || !parsed.ok ? null : dayNumber * MINUTES_PER_DAY + parsed.minutes;
}
