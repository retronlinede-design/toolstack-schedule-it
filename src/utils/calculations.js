import { minutesToDuration, parseTimeToMinutes } from "./time";

const DUTY_DAY_MINUTES = 8 * 60;

function durationBetween(start, end) {
  if (start === null || end === null) return null;
  return end >= start ? end - start : end + 24 * 60 - start;
}

export function sortMovementsByDateAndTime(movements) {
  return [...movements].sort((a, b) => {
    const dateCompare = (a.day?.date || "").localeCompare(b.day?.date || "");
    if (dateCompare !== 0) return dateCompare;

    const aHasSortOrder = Number.isFinite(a.sortOrder);
    const bHasSortOrder = Number.isFinite(b.sortOrder);
    if (aHasSortOrder && bHasSortOrder && a.sortOrder !== b.sortOrder) return a.sortOrder - b.sortOrder;
    if (aHasSortOrder && !bHasSortOrder) return -1;
    if (!aHasSortOrder && bHasSortOrder) return 1;

    const aTime = parseTimeToMinutes(a.driverStart || a.departureTime || a.arrivalTime || a.endTime) ?? Number.MAX_SAFE_INTEGER;
    const bTime = parseTimeToMinutes(b.driverStart || b.departureTime || b.arrivalTime || b.endTime) ?? Number.MAX_SAFE_INTEGER;
    return aTime - bTime;
  });
}

export function calculateDriverSummary(movements, drivers, vehicles = [], scheduleDays = []) {
  const daysById = new Map(scheduleDays.map((day) => [day.id, day]));
  const vehiclesById = new Map(vehicles.map((vehicle) => [vehicle.id, vehicle]));
  const driversById = new Map(drivers.map((driver) => [driver.id, driver]));
  const groups = new Map();

  movements.forEach((movement) => {
    const start = parseTimeToMinutes(movement.driverStart);
    const end = parseTimeToMinutes(movement.endTime);
    if (start === null && end === null) return;

    const day = daysById.get(movement.scheduleDayId) || movement.day;
    const date = day?.date;
    if (!date) return;

    const key = `${movement.driverId}:${date}`;
    const current = groups.get(key) || {
      driverId: movement.driverId,
      driverName: driversById.get(movement.driverId)?.name || "Unassigned",
      vehicleId: movement.vehicleId,
      vehicleName: vehiclesById.get(movement.vehicleId)?.name || "-",
      date,
      start,
      end,
    };

    groups.set(key, {
      ...current,
      vehicleId: current.vehicleId || movement.vehicleId,
      vehicleName: current.vehicleName !== "-" ? current.vehicleName : vehiclesById.get(movement.vehicleId)?.name || "-",
      start: current.start === null || start === null ? current.start ?? start : Math.min(current.start, start),
      end: current.end === null || end === null ? current.end ?? end : Math.max(current.end, end),
    });
  });

  return [...groups.values()]
    .filter((summary) => summary.start !== null && summary.end !== null)
    .sort((a, b) => a.date.localeCompare(b.date) || a.driverName.localeCompare(b.driverName))
    .map((summary) => {
      const totalMinutes = durationBetween(summary.start, summary.end) || 0;
      const overtimeMinutes = Math.max(totalMinutes - DUTY_DAY_MINUTES, 0);

      return {
        ...summary,
        startTime: `${String(Math.floor(summary.start / 60)).padStart(2, "0")}:${String(summary.start % 60).padStart(2, "0")}`,
        endTime: `${String(Math.floor(summary.end / 60)).padStart(2, "0")}:${String(summary.end % 60).padStart(2, "0")}`,
        totalMinutes,
        totalDuration: minutesToDuration(totalMinutes),
        overtimeMinutes,
        overtimeDuration: minutesToDuration(overtimeMinutes),
      };
    });
}

export function calculateLegacyDriverTotals(movements, drivers) {
  return drivers.map((driver) => {
    const driverMovements = movements.filter((movement) => movement.driverId === driver.id);
    const totalMinutes = driverMovements.reduce((total, movement) => {
      const duration = durationBetween(parseTimeToMinutes(movement.driverStart || movement.departureTime), parseTimeToMinutes(movement.endTime || movement.eventEndTime));
      return duration === null ? total : total + duration;
    }, 0);

    return {
      driverId: driver.id,
      driverName: driver.name,
      movementCount: driverMovements.length,
      totalMinutes,
      totalDuration: minutesToDuration(totalMinutes),
    };
  });
}

export function getEntriesByMonth(scheduleDays, movements) {
  const daysById = new Map(scheduleDays.map((day) => [day.id, day]));
  const sorted = sortMovementsByDateAndTime(
    movements.map((movement) => ({
      ...movement,
      day: daysById.get(movement.scheduleDayId),
    })),
  );

  return sorted.reduce((acc, movement) => {
    const day = movement.day;
    const monthKey = day?.date
      ? new Date(`${day.date}T12:00:00`)
          .toLocaleDateString(undefined, { month: "long", year: "numeric" })
          .toUpperCase()
      : "UNSCHEDULED";

    if (!acc[monthKey]) acc[monthKey] = [];
    acc[monthKey].push({ ...movement, day });
    return acc;
  }, {});
}
