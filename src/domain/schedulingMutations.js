import { clonePickups } from "./pickups";

export function duplicateMovementForSchedule(movement, id, sortOrder) {
  return { ...movement, id, sortOrder, pickups: clonePickups(movement.pickups), conflictOverrides: [] };
}

export function preserveClearedTimeFields(updatedMovement, previousMovement) {
  return {
    ...updatedMovement,
    eventStartTime: updatedMovement.departureTime === "" && updatedMovement.eventStartTime === previousMovement.departureTime ? "" : updatedMovement.eventStartTime || "",
    eventEndTime: updatedMovement.endTime === "" && updatedMovement.eventEndTime === previousMovement.endTime ? "" : updatedMovement.eventEndTime || "",
  };
}
