import { createFreshMovementDraft, createMovementFromDraft } from "../data/schema";
import { normalizeMovementAudiences } from "./audiences";
import { validatePickups } from "./pickups";
import { validateMovementCandidate } from "./scheduleValidation";
import { hasMovementTiming } from "./timeIntervals";
import { preserveClearedTimeFields } from "./schedulingMutations";
import { getWeekday } from "../utils/time";

export function validateMovementEditorDraft(value) {
  const errors = {};
  if (!value.scheduleDayId) errors.scheduleDayId = "Schedule day is required.";
  if (!value.driverId) errors.driverId = "Driver is required.";
  if (!value.vehicleId) errors.vehicleId = "Vehicle is required.";
  if (!hasMovementTiming(value)) errors.timing = "Enter at least one timing field.";
  if (!value.engagementDetails && !value.venue) errors.engagementDetails = "Enter engagement details or a venue.";
  const pickupIssues = validatePickups(value.pickups || []);
  if (pickupIssues.length) errors.integrityIssues = pickupIssues;
  return errors;
}

export function updateMovementEditorDriver(movement, driverId, drivers) {
  const nextDriver = drivers.find((driver) => driver.id === driverId);
  const currentDriver = drivers.find((driver) => driver.id === movement.driverId);
  const shouldUseDefaultVehicle = !movement.vehicleId || movement.vehicleId === currentDriver?.defaultVehicle;
  const audiences = normalizeMovementAudiences(movement);
  return {
    ...movement,
    driverId,
    vehicleId: shouldUseDefaultVehicle ? nextDriver?.defaultVehicle || movement.vehicleId : movement.vehicleId,
    audiences: { ...audiences, driverIds: audiences.driverIds.filter((id) => id !== driverId) },
  };
}

export function movementFromEditorDraft(draft) {
  return createMovementFromDraft(draft, draft.scheduleDayId);
}

export function replaceMovementInSchedule(schedule, updatedMovement) {
  return {
    ...schedule,
    movements: schedule.movements.map((movement) =>
      movement.id === updatedMovement.id ? preserveClearedTimeFields(updatedMovement, movement) : movement,
    ),
  };
}

export function createOperationalMovementDraft(schedule, scheduleDayId, id) {
  const day = schedule.scheduleDays.find((item) => item.id === scheduleDayId);
  return {
    ...createFreshMovementDraft(schedule),
    id,
    scheduleDayId: day?.id || "",
    dayTitle: day?.title || "",
    date: day?.date || "",
    weekday: getWeekday(day?.date),
  };
}

export function nextMovementSortOrder(movements, scheduleDayId) {
  const orders = movements
    .filter((movement) => movement.scheduleDayId === scheduleDayId)
    .map((movement) => movement.sortOrder)
    .filter(Number.isFinite);
  return orders.length ? Math.max(...orders) + 10 : 10;
}

function editorErrorsAsIssues(errors) {
  return Object.entries(errors).flatMap(([field, value]) =>
    field === "integrityIssues"
      ? value
      : [{ type: "INVALID_MOVEMENT", severity: "error", field, message: value }],
  );
}

export function createMovementInSchedule(schedule, draft) {
  const editorErrors = validateMovementEditorDraft(draft);
  if (Object.keys(editorErrors).length) {
    return { ok: false, schedule, issues: editorErrorsAsIssues(editorErrors) };
  }
  if (!schedule.scheduleDays.some((day) => day.id === draft.scheduleDayId)) {
    return { ok: false, schedule, issues: [{ type: "ORPHAN_REFERENCE", severity: "error", field: "scheduleDayId", message: "Select an available schedule day." }] };
  }
  if (!draft.id || schedule.movements.some((movement) => movement.id === draft.id)) {
    return { ok: false, schedule, issues: [{ type: "DUPLICATE_ID", severity: "error", field: "id", message: "A unique movement ID is required." }] };
  }
  const movement = {
    ...movementFromEditorDraft(draft),
    sortOrder: nextMovementSortOrder(schedule.movements, draft.scheduleDayId),
  };
  const validation = validateMovementCandidate(schedule, movement, movement.id);
  if (validation.blocking.length) return { ok: false, schedule, issues: validation.issues };
  return {
    ok: true,
    schedule: { ...schedule, movements: [...schedule.movements, movement] },
    movement,
    issues: validation.issues,
  };
}
