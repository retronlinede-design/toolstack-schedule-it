import { absoluteTimeForDay, SHORT_TURNAROUND_MINUTES } from "./timeIntervals";

export function detectHandoverConflicts(schedule, intervalsById) {
  const issues = [];
  const days = new Map(schedule.scheduleDays.map((day) => [day.id, day]));
  const drivers = new Set(schedule.drivers.map((driver) => driver.id));
  const vehicles = new Set(schedule.vehicles.map((vehicle) => vehicle.id));
  const movements = schedule.movements;
  const timedHandovers = [];

  for (const note of schedule.vehicleHandoverNotes || []) {
    const day = days.get(note.scheduleDayId);
    const add = (type, message, severity = "error", extra = {}) => issues.push({ type, severity, handoverId: note.id, dayIds: [note.scheduleDayId].filter(Boolean), message, ...extra });
    if (!day) add("HANDOVER_UNKNOWN_DAY", "Handover references an unknown schedule day.");
    if (!vehicles.has(note.vehicleId)) add("HANDOVER_UNKNOWN_VEHICLE", "Handover references an unknown vehicle.");
    if (note.fromDriverId && !drivers.has(note.fromDriverId)) add("HANDOVER_UNKNOWN_DRIVER", "Handover source driver is unknown.");
    if (note.toDriverId && !drivers.has(note.toDriverId)) add("HANDOVER_UNKNOWN_DRIVER", "Handover destination driver is unknown.");
    if (note.fromDriverId && note.fromDriverId === note.toDriverId) add("HANDOVER_SAME_DRIVER", "Handover source and destination drivers must differ.");
    if (!note.time) continue;
    const absolute = day ? absoluteTimeForDay(day.date, note.time) : null;
    if (absolute === null) {
      add("HANDOVER_INVALID_TIME", "Handover time must use strict HH:mm format.");
      continue;
    }
    timedHandovers.push({ note, absolute });

    movements.forEach((movement) => {
      const interval = intervalsById.get(movement.id);
      if (!interval) return;
      if (movement.vehicleId === note.vehicleId) {
        if (absolute >= interval.start && absolute < interval.end) add("HANDOVER_VEHICLE_OVERLAP", "Vehicle handover occurs while the vehicle is assigned to a movement.", "error", { movementIds: [movement.id], vehicleId: note.vehicleId });
        else {
          const gap = Math.min(Math.abs(absolute - interval.start), Math.abs(absolute - interval.end));
          if (gap < SHORT_TURNAROUND_MINUTES) add("HANDOVER_SHORT_TRANSITION", `Vehicle handover is only ${gap} minutes from a movement.`, "warning", { movementIds: [movement.id], vehicleId: note.vehicleId });
        }
      }
      if (note.toDriverId && movement.driverId === note.toDriverId && absolute >= interval.start && absolute < interval.end) add("HANDOVER_DRIVER_OVERLAP", "Destination driver is assigned to another movement at the handover time.", "error", { movementIds: [movement.id], driverId: note.toDriverId });
    });
  }

  timedHandovers.sort((a, b) => a.absolute - b.absolute || a.note.id.localeCompare(b.note.id));
  for (let left = 0; left < timedHandovers.length; left += 1) {
    for (let right = left + 1; right < timedHandovers.length; right += 1) {
      const a = timedHandovers[left];
      const b = timedHandovers[right];
      if (a.note.vehicleId !== b.note.vehicleId) continue;
      const gap = b.absolute - a.absolute;
      if (gap >= SHORT_TURNAROUND_MINUTES) continue;
      issues.push({
        type: gap === 0 ? "HANDOVER_OVERLAP" : "HANDOVER_SHORT_TRANSITION",
        severity: gap === 0 ? "error" : "warning",
        handoverIds: [a.note.id, b.note.id].sort(),
        vehicleId: a.note.vehicleId,
        dayIds: [a.note.scheduleDayId, b.note.scheduleDayId].sort(),
        message: gap === 0 ? "Multiple handovers for the same vehicle occur at the same time." : `Vehicle handovers are only ${gap} minutes apart.`,
      });
    }
  }
  return issues;
}
