import { minutesToDuration, parseTimeToMinutes } from "./time";

const DUTY_DAY_MINUTES = 8 * 60;

function durationBetween(start, end) {
  if (start === null || end === null) return null;
  return end >= start ? end - start : end + 24 * 60 - start;
}

function formatMinutesAsTime(value) {
  if (value === null || !Number.isFinite(value)) return "-";
  const normalized = value % (24 * 60);
  return `${String(Math.floor(normalized / 60)).padStart(2, "0")}:${String(normalized % 60).padStart(2, "0")}`;
}

function addMinutes(current, value, mode) {
  if (value === null) return current;
  if (current === null) return value;
  return mode === "min" ? Math.min(current, value) : Math.max(current, value);
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

export function calculateWorkingTimeSummary(movements, drivers, vehicles = [], scheduleDays = []) {
  const daysById = new Map(scheduleDays.map((day) => [day.id, day]));
  const vehiclesById = new Map(vehicles.map((vehicle) => [vehicle.id, vehicle]));
  const driversById = new Map(drivers.map((driver) => [driver.id, driver]));
  const groups = new Map();

  movements.forEach((movement) => {
    const driverStart = parseTimeToMinutes(movement.driverStart);
    const departure = parseTimeToMinutes(movement.departureTime);
    const arrival = parseTimeToMinutes(movement.arrivalTime);
    const endTime = parseTimeToMinutes(movement.endTime);
    if (driverStart === null && departure === null && arrival === null && endTime === null) return;

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
      dayTitle: day?.title || "",
      primaryStart: null,
      fallbackStart: null,
      primaryEnd: null,
      fallbackEnd: null,
    };

    groups.set(key, {
      ...current,
      vehicleId: current.vehicleId || movement.vehicleId,
      vehicleName: current.vehicleName !== "-" ? current.vehicleName : vehiclesById.get(movement.vehicleId)?.name || "-",
      primaryStart: addMinutes(current.primaryStart, driverStart, "min"),
      fallbackStart: addMinutes(addMinutes(current.fallbackStart, departure, "min"), arrival, "min"),
      primaryEnd: addMinutes(current.primaryEnd, endTime, "max"),
      fallbackEnd: addMinutes(current.fallbackEnd, arrival, "max"),
    });
  });

  const driverDaySummaries = [...groups.values()]
    .map((summary) => {
      const start = summary.primaryStart ?? summary.fallbackStart;
      const end = summary.primaryEnd ?? summary.fallbackEnd;
      const usedFallback = (summary.primaryStart === null && summary.fallbackStart !== null) || (summary.primaryEnd === null && summary.fallbackEnd !== null);
      const isComplete = start !== null && end !== null;
      const totalMinutes = durationBetween(start, end) || 0;
      const overtimeMinutes = Math.max(totalMinutes - DUTY_DAY_MINUTES, 0);

      return {
        driverId: summary.driverId,
        driverName: summary.driverName,
        vehicleId: summary.vehicleId,
        vehicleName: summary.vehicleName,
        date: summary.date,
        dayTitle: summary.dayTitle,
        start,
        end,
        startTime: formatMinutesAsTime(start),
        endTime: formatMinutesAsTime(end),
        totalMinutes,
        totalDuration: minutesToDuration(totalMinutes),
        overtimeMinutes,
        overtimeDuration: minutesToDuration(overtimeMinutes),
        status: isComplete ? (usedFallback ? "Estimated" : "Complete") : "Incomplete",
      };
    })
    .sort((a, b) => a.date.localeCompare(b.date) || a.driverName.localeCompare(b.driverName));

  const dailyTotals = [...driverDaySummaries.reduce((acc, summary) => {
    const current = acc.get(summary.date) || {
      date: summary.date,
      driverCount: 0,
      totalMinutes: 0,
      overtimeMinutes: 0,
      incompleteCount: 0,
    };

    current.driverCount += 1;
    current.totalMinutes += summary.totalMinutes;
    current.overtimeMinutes += summary.overtimeMinutes;
    if (summary.status === "Incomplete") current.incompleteCount += 1;
    acc.set(summary.date, current);
    return acc;
  }, new Map()).values()]
    .sort((a, b) => a.date.localeCompare(b.date))
    .map((summary) => ({
      ...summary,
      totalDuration: minutesToDuration(summary.totalMinutes),
      overtimeDuration: minutesToDuration(summary.overtimeMinutes),
      status: summary.incompleteCount > 0 ? `${summary.incompleteCount} incomplete` : "Complete",
    }));

  const overallDriverTotals = [...driverDaySummaries.reduce((acc, summary) => {
    const current = acc.get(summary.driverId) || {
      driverId: summary.driverId,
      driverName: summary.driverName,
      dayCount: 0,
      totalMinutes: 0,
      overtimeMinutes: 0,
      incompleteCount: 0,
    };

    current.dayCount += 1;
    current.totalMinutes += summary.totalMinutes;
    current.overtimeMinutes += summary.overtimeMinutes;
    if (summary.status === "Incomplete") current.incompleteCount += 1;
    acc.set(summary.driverId, current);
    return acc;
  }, new Map()).values()]
    .sort((a, b) => a.driverName.localeCompare(b.driverName))
    .map((summary) => ({
      ...summary,
      totalDuration: minutesToDuration(summary.totalMinutes),
      overtimeDuration: minutesToDuration(summary.overtimeMinutes),
      status: summary.incompleteCount > 0 ? `${summary.incompleteCount} incomplete` : "Complete",
    }));

  return {
    driverDaySummaries,
    dailyTotals,
    overallDriverTotals,
  };
}

export function calculateDriverSummary(movements, drivers, vehicles = [], scheduleDays = []) {
  return calculateWorkingTimeSummary(movements, drivers, vehicles, scheduleDays).driverDaySummaries.filter((summary) => summary.status !== "Incomplete");
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
