import { createMovementFromDraft, emptyDraft } from "../data/schema";
import { sortMovementsByDateAndTime } from "../utils/calculations";
import { parseStrictTime } from "./timeIntervals";

export const OPERATIONAL_BREAK_AUDIENCES = Object.freeze({
  executive: false,
  operational: true,
  cg: false,
  marida: false,
  driverIds: Object.freeze([]),
});

export function breakInsertionContext(entries, insertionIndex) {
  const previous = entries[insertionIndex - 1] || null;
  const next = entries[insertionIndex] || null;
  const assignment = previous || next;
  if (!assignment) return null;
  return {
    scheduleDayId: assignment.scheduleDayId,
    driverId: assignment.driverId,
    vehicleId: assignment.vehicleId,
    previousMovementId: previous?.id || "",
    nextMovementId: next?.id || "",
  };
}

export function validateOperationalBreakInput(input, schedule) {
  const issues = [];
  const start = parseStrictTime(input?.eventStartTime);
  const end = parseStrictTime(input?.eventEndTime);
  if (!start.ok) issues.push({ field: "eventStartTime", message: "Enter a valid break start time." });
  if (!end.ok) issues.push({ field: "eventEndTime", message: "Enter a valid break end time." });
  if (start.ok && end.ok && end.minutes <= start.minutes) {
    issues.push({ field: "eventEndTime", message: "Break end must be later than break start." });
  }
  if (!input?.engagementDetails?.trim()) issues.push({ field: "engagementDetails", message: "Enter a break description." });
  if (!input?.venue?.trim()) issues.push({ field: "venue", message: "Enter a break location." });
  if (!schedule?.scheduleDays?.some((day) => day.id === input?.scheduleDayId)) issues.push({ field: "scheduleDayId", message: "The target schedule day is unavailable." });
  if (!schedule?.drivers?.some((driver) => driver.id === input?.driverId)) issues.push({ field: "driverId", message: "The inherited driver is unavailable." });
  if (!schedule?.vehicles?.some((vehicle) => vehicle.id === input?.vehicleId)) issues.push({ field: "vehicleId", message: "The inherited vehicle is unavailable." });
  return issues;
}

export function createOperationalBreakMovement(input, id) {
  return createMovementFromDraft({
    ...emptyDraft,
    id,
    scheduleDayId: input.scheduleDayId,
    driverId: input.driverId,
    vehicleId: input.vehicleId,
    driverStart: "",
    pickups: [],
    departureTime: "",
    arrivalTime: "",
    eventStartTime: input.eventStartTime,
    eventEndTime: input.eventEndTime,
    endTime: "",
    engagementDetails: input.engagementDetails.trim(),
    venue: input.venue.trim(),
    address: input.address?.trim() || "",
    workClassification: "break",
    continuesOvernight: false,
    conflictOverrides: [],
    audiences: { ...OPERATIONAL_BREAK_AUDIENCES, driverIds: [] },
    isExecutiveVisible: false,
    isOperationalVisible: true,
  }, input.scheduleDayId);
}

export function insertMovementIntoDay(movements, movement, day, previousMovementId, nextMovementId) {
  const dayMovements = sortMovementsByDateAndTime(
    movements
      .filter((item) => item.scheduleDayId === movement.scheduleDayId)
      .map((item) => ({ ...item, day })),
  );
  let insertionIndex = nextMovementId ? dayMovements.findIndex((item) => item.id === nextMovementId) : -1;
  if (insertionIndex < 0 && previousMovementId) {
    const previousIndex = dayMovements.findIndex((item) => item.id === previousMovementId);
    if (previousIndex >= 0) insertionIndex = previousIndex + 1;
  }
  if (insertionIndex < 0) return null;

  const ordered = [...dayMovements];
  ordered.splice(insertionIndex, 0, movement);
  const sortOrders = new Map(ordered.map((item, index) => [item.id, (index + 1) * 10]));
  return [
    ...movements.map((item) => item.scheduleDayId === movement.scheduleDayId ? { ...item, sortOrder: sortOrders.get(item.id) } : item),
    { ...movement, sortOrder: sortOrders.get(movement.id) },
  ];
}
