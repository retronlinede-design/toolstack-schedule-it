import { minutesToDuration, parseTimeToMinutes } from "./time";
import { calculateWorkingTime } from "../domain/workingTime";

const NORMAL_DAY_END_MINUTES = 16 * 60 + 30;
const MIN_REST_MINUTES = 11 * 60;
const LONG_REST_MINUTES = 72 * 60;
const DAY_MINUTES = 24 * 60;

function durationBetween(start, end) {
  if (start === null || end === null) return null;
  return end >= start ? end - start : end + DAY_MINUTES - start;
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

function dateToDayNumber(value) {
  if (!value || typeof value !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return null;
  const [year, month, day] = value.split("-").map(Number);
  if (!Number.isInteger(year) || !Number.isInteger(month) || !Number.isInteger(day)) return null;
  const date = new Date(Date.UTC(year, month - 1, day));
  if (date.getUTCFullYear() !== year || date.getUTCMonth() !== month - 1 || date.getUTCDate() !== day) return null;
  return Math.floor(date.getTime() / (DAY_MINUTES * 60 * 1000));
}

function isValidIsoDate(value) {
  return dateToDayNumber(value) !== null;
}

function absoluteMinutes(date, time) {
  const dayNumber = dateToDayNumber(date);
  if (dayNumber === null || time === null) return null;
  return dayNumber * DAY_MINUTES + time;
}

function addTimeCandidate(current, value) {
  if (value === null) return current;
  return [...current, value];
}

function latestEndForStart(candidates, start) {
  if (candidates.length === 0) return null;
  if (start === null) return Math.max(...candidates);

  return candidates
    .map((value) => (value < start ? value + DAY_MINUTES : value))
    .reduce((latest, value) => Math.max(latest, value), Number.NEGATIVE_INFINITY);
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

export function calculateWorkingTimeSummary(movements, drivers, vehicles = [], scheduleDays = [], workingTimePolicy) {
  const result = calculateWorkingTime({ movements, drivers, vehicles, scheduleDays, workingTimePolicy });
  const driverDaySummaries = result.dailySummaries.map((summary) => ({
    ...summary,
    start: summary.dutyStart === null ? null : summary.dutyStart % DAY_MINUTES,
    end: summary.dutyEnd === null ? null : summary.dutyEnd % DAY_MINUTES,
    startTime: summary.dutyStartTime,
    endTime: summary.dutyEndTime,
    totalMinutes: summary.countedWorkingMinutes,
    totalDuration: minutesToDuration(summary.countedWorkingMinutes),
    overtimeDuration: minutesToDuration(summary.overtimeMinutes),
    dutyStartAbsolute: summary.dutyStart,
    dutyEndAbsolute: summary.dutyEnd,
    restDuration: summary.restDuration,
    notes: summary.warnings,
    hasValidDate: Boolean(summary.date),
  }));
  const dailyTotals = [...driverDaySummaries.reduce((map, summary) => {
    const total = map.get(summary.date) || { date: summary.date, driverCount: 0, totalMinutes: 0, overtimeMinutes: 0, shortRestCount: 0 };
    total.driverCount += 1; total.totalMinutes += summary.totalMinutes; total.overtimeMinutes += summary.overtimeMinutes; if (summary.shortRest) total.shortRestCount += 1;
    map.set(summary.date, total); return map;
  }, new Map()).values()].map((total) => ({ ...total, totalDuration: minutesToDuration(total.totalMinutes), overtimeDuration: minutesToDuration(total.overtimeMinutes) }));
  const overallDriverTotals = [...driverDaySummaries.reduce((map, summary) => {
    const total = map.get(summary.driverId) || { driverId: summary.driverId, driverName: summary.driverName, dayCount: 0, totalMinutes: 0, overtimeMinutes: 0, shortRestCount: 0, minimumRestMinutes: null };
    total.dayCount += 1; total.totalMinutes += summary.totalMinutes; total.overtimeMinutes += summary.overtimeMinutes; if (summary.shortRest) total.shortRestCount += 1;
    if (summary.restMinutes !== null) total.minimumRestMinutes = total.minimumRestMinutes === null ? summary.restMinutes : Math.min(total.minimumRestMinutes, summary.restMinutes);
    map.set(summary.driverId, total); return map;
  }, new Map()).values()].map((total) => ({ ...total, totalDuration: minutesToDuration(total.totalMinutes), overtimeDuration: minutesToDuration(total.overtimeMinutes), minimumRestDuration: total.minimumRestMinutes === null ? "-" : minutesToDuration(total.minimumRestMinutes) }));
  return { driverDaySummaries, dailyTotals, overallDriverTotals, warnings: result.warnings, policy: result.policy };
}

/** @deprecated Compatibility reference only. Runtime working-time output uses calculateWorkingTimeSummary. */
export function calculateLegacyWorkingTimeSummary(movements, drivers, vehicles = [], scheduleDays = []) {
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
    const rawDate = day?.date || "";
    const hasValidDate = isValidIsoDate(rawDate);
    const date = hasValidDate ? rawDate : "";

    const key = `${movement.driverId}:${hasValidDate ? date : day?.id || movement.scheduleDayId || "missing-date"}`;
    const current = groups.get(key) || {
      driverId: movement.driverId,
      driverName: driversById.get(movement.driverId)?.name || "Unassigned",
      vehicleId: movement.vehicleId,
      vehicleName: vehiclesById.get(movement.vehicleId)?.name || "-",
      date,
      hasValidDate,
      dayTitle: day?.title || "",
      primaryStart: null,
      fallbackStart: null,
      primaryEndCandidates: [],
      fallbackEndCandidates: [],
    };

    groups.set(key, {
      ...current,
      vehicleId: current.vehicleId || movement.vehicleId,
      vehicleName: current.vehicleName !== "-" ? current.vehicleName : vehiclesById.get(movement.vehicleId)?.name || "-",
      primaryStart: addMinutes(current.primaryStart, driverStart, "min"),
      fallbackStart: addMinutes(addMinutes(current.fallbackStart, departure, "min"), arrival, "min"),
      primaryEndCandidates: addTimeCandidate(current.primaryEndCandidates, endTime),
      fallbackEndCandidates: addTimeCandidate(current.fallbackEndCandidates, arrival),
    });
  });

  const driverDaySummaries = [...groups.values()]
    .map((summary) => {
      const start = summary.primaryStart ?? summary.fallbackStart;
      const primaryEnd = latestEndForStart(summary.primaryEndCandidates, start);
      const fallbackEnd = latestEndForStart(summary.fallbackEndCandidates, start);
      const adjustedEnd = primaryEnd ?? fallbackEnd;
      const end = adjustedEnd === null ? null : adjustedEnd % DAY_MINUTES;
      const notes = [];
      if (!summary.hasValidDate) notes.push("Missing date");
      if (summary.primaryStart === null && summary.fallbackStart !== null) notes.push("Estimated start");
      if (primaryEnd === null && fallbackEnd !== null) notes.push("Estimated end");
      if (start === null) notes.push("Missing start");
      if (end === null) notes.push("Missing end");
      const totalMinutes = start !== null && adjustedEnd !== null ? adjustedEnd - start : 0;
      const overtimeBoundary = start !== null && start > NORMAL_DAY_END_MINUTES ? start : NORMAL_DAY_END_MINUTES;
      const overtimeMinutes = adjustedEnd !== null ? Math.max(adjustedEnd - overtimeBoundary, 0) : 0;
      const dutyStartAbsolute = absoluteMinutes(summary.date, start);
      const dutyEndAbsolute =
        dutyStartAbsolute !== null && adjustedEnd !== null ? dutyStartAbsolute - start + adjustedEnd : absoluteMinutes(summary.date, adjustedEnd);

      return {
        driverId: summary.driverId,
        driverName: summary.driverName,
        vehicleId: summary.vehicleId,
        vehicleName: summary.vehicleName,
        date: summary.date,
        hasValidDate: summary.hasValidDate,
        dayTitle: summary.dayTitle,
        start,
        end,
        startTime: formatMinutesAsTime(start),
        endTime: formatMinutesAsTime(end),
        totalMinutes,
        totalDuration: minutesToDuration(totalMinutes),
        overtimeMinutes,
        overtimeDuration: minutesToDuration(overtimeMinutes),
        dutyStartAbsolute,
        dutyEndAbsolute,
        restMinutes: null,
        restDuration: "-",
        shortRest: false,
        notes,
      };
    })
    .sort(
      (a, b) =>
        (a.dutyStartAbsolute ?? Number.MAX_SAFE_INTEGER) - (b.dutyStartAbsolute ?? Number.MAX_SAFE_INTEGER) ||
        a.driverName.localeCompare(b.driverName) ||
        a.date.localeCompare(b.date),
    );

  const summariesByDriver = driverDaySummaries.reduce((acc, summary) => {
    if (!acc.has(summary.driverId)) acc.set(summary.driverId, []);
    acc.get(summary.driverId).push(summary);
    return acc;
  }, new Map());

  summariesByDriver.forEach((summaries) => {
    let previousValidSummary = null;
    summaries
      .sort((a, b) => (a.dutyStartAbsolute ?? Number.MAX_SAFE_INTEGER) - (b.dutyStartAbsolute ?? Number.MAX_SAFE_INTEGER))
      .forEach((summary) => {
        if (!summary.hasValidDate || summary.dutyStartAbsolute === null) {
          previousValidSummary = null;
          return;
        }

        if (!previousValidSummary || previousValidSummary.dutyEndAbsolute === null) {
          if (summary.dutyEndAbsolute !== null) previousValidSummary = summary;
          return;
        }

        const restMinutes = summary.dutyStartAbsolute - previousValidSummary.dutyEndAbsolute;
        if (restMinutes < 0) {
          summary.notes.push("Check dates");
          if (summary.dutyEndAbsolute !== null) previousValidSummary = summary;
          return;
        }

        summary.restMinutes = restMinutes;
        summary.restDuration = minutesToDuration(restMinutes);
        summary.shortRest = restMinutes < MIN_REST_MINUTES;
        if (summary.shortRest) summary.notes.push("Short rest");
        if (restMinutes > LONG_REST_MINUTES) summary.notes.push("Long gap / check dates");
        if (summary.dutyEndAbsolute !== null) previousValidSummary = summary;
      });
    });

  const dailyTotals = [...driverDaySummaries.reduce((acc, summary) => {
    const current = acc.get(summary.date) || {
      date: summary.date,
      driverCount: 0,
      totalMinutes: 0,
      overtimeMinutes: 0,
      shortRestCount: 0,
    };

    current.driverCount += 1;
    current.totalMinutes += summary.totalMinutes;
    current.overtimeMinutes += summary.overtimeMinutes;
    if (summary.shortRest) current.shortRestCount += 1;
    acc.set(summary.date, current);
    return acc;
  }, new Map()).values()]
    .sort((a, b) => a.date.localeCompare(b.date))
    .map((summary) => ({
      ...summary,
      totalDuration: minutesToDuration(summary.totalMinutes),
      overtimeDuration: minutesToDuration(summary.overtimeMinutes),
    }));

  const overallDriverTotals = [...driverDaySummaries.reduce((acc, summary) => {
    const current = acc.get(summary.driverId) || {
      driverId: summary.driverId,
      driverName: summary.driverName,
      dayCount: 0,
      totalMinutes: 0,
      overtimeMinutes: 0,
      shortRestCount: 0,
      minimumRestMinutes: null,
    };

    current.dayCount += 1;
    current.totalMinutes += summary.totalMinutes;
    current.overtimeMinutes += summary.overtimeMinutes;
    if (summary.shortRest) current.shortRestCount += 1;
    if (summary.restMinutes !== null) {
      current.minimumRestMinutes = current.minimumRestMinutes === null ? summary.restMinutes : Math.min(current.minimumRestMinutes, summary.restMinutes);
    }
    acc.set(summary.driverId, current);
    return acc;
  }, new Map()).values()]
    .sort((a, b) => a.driverName.localeCompare(b.driverName))
    .map((summary) => ({
      ...summary,
      totalDuration: minutesToDuration(summary.totalMinutes),
      overtimeDuration: minutesToDuration(summary.overtimeMinutes),
      minimumRestDuration: summary.minimumRestMinutes === null ? "-" : minutesToDuration(summary.minimumRestMinutes),
    }));

  return {
    driverDaySummaries,
    dailyTotals,
    overallDriverTotals,
  };
}

export function calculateDriverSummary(movements, drivers, vehicles = [], scheduleDays = []) {
  return calculateWorkingTimeSummary(movements, drivers, vehicles, scheduleDays).driverDaySummaries.filter((summary) => summary.start !== null && summary.end !== null);
}

export function calculateLegacyDriverTotals(movements, drivers) {
  return drivers.map((driver) => {
    const driverMovements = movements.filter((movement) => movement.driverId === driver.id);
    const totalMinutes = driverMovements.reduce((total, movement) => {
      const duration = durationBetween(parseTimeToMinutes(movement.driverStart || movement.departureTime), parseTimeToMinutes(movement.endTime));
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
