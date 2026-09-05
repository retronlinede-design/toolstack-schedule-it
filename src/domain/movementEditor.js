import { createMovementFromDraft } from "../data/schema";
import { normalizeMovementAudiences } from "./audiences";
import { validatePickups } from "./pickups";
import { hasMovementTiming } from "./timeIntervals";
import { preserveClearedTimeFields } from "./schedulingMutations";

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
