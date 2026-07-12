import { defaultScheduleState } from "../data/defaultData";
import { parseTimeToMinutes } from "../utils/time";
import { migrateRouteNotesToImportantInfo } from "./routeMigration";
import { withNormalizedAudiences } from "../domain/audiences";

function fallbackTime(movement) {
  return parseTimeToMinutes(movement.driverStart || movement.departureTime || movement.arrivalTime || movement.endTime) ?? Number.MAX_SAFE_INTEGER;
}

function withSortOrders(scheduleDays, movements) {
  const daysById = new Map(scheduleDays.map((day) => [day.id, day]));
  const grouped = movements.reduce((acc, movement) => {
    const key = movement.scheduleDayId || "unscheduled";
    if (!acc[key]) acc[key] = [];
    acc[key].push(movement);
    return acc;
  }, {});
  return Object.values(grouped).flatMap((items) => [...items].sort((a, b) => {
    const dateCompare = (daysById.get(a.scheduleDayId)?.date || "").localeCompare(daysById.get(b.scheduleDayId)?.date || "");
    if (dateCompare) return dateCompare;
    if (Number.isFinite(a.sortOrder) && Number.isFinite(b.sortOrder) && a.sortOrder !== b.sortOrder) return a.sortOrder - b.sortOrder;
    return fallbackTime(a) - fallbackTime(b);
  }).map((movement, index) => ({ ...movement, sortOrder: (index + 1) * 10 })));
}

export function normalizeState(state) {
  const scheduleDays = state?.scheduleDays || [];
  const routeNotes = Array.isArray(state?.routeNotes) ? state.routeNotes : [];
  const drivers = Array.isArray(state?.drivers) ? state.drivers : defaultScheduleState.drivers;
  return {
    ...defaultScheduleState,
    ...state,
    profile: { ...defaultScheduleState.profile, ...state?.profile },
    drivers,
    vehicles: Array.isArray(state?.vehicles) ? state.vehicles : defaultScheduleState.vehicles,
    scheduleDays,
    movements: withSortOrders(scheduleDays, state?.movements || []).map((movement) => ({
      ...withNormalizedAudiences(movement, drivers.map((driver) => driver.id)),
      continuesOvernight: movement.continuesOvernight === true,
      conflictOverrides: Array.isArray(movement.conflictOverrides) ? movement.conflictOverrides : [],
    })),
    vehicleHandoverNotes: (Array.isArray(state?.vehicleHandoverNotes) ? state.vehicleHandoverNotes : []).map((note) => ({
      ...note,
      visibleToDriverIds: Array.isArray(note.visibleToDriverIds) ? note.visibleToDriverIds : [note.fromDriverId, note.toDriverId].filter(Boolean),
    })),
    importantInfoItems: Array.isArray(state?.importantInfoItems)
      ? state.importantInfoItems
      : migrateRouteNotesToImportantInfo(routeNotes, scheduleDays, drivers),
    routeNotes,
  };
}

export function validateScheduleState(value) {
  return Boolean(value && typeof value === "object" && value.profile && typeof value.profile === "object" &&
    Array.isArray(value.drivers) && Array.isArray(value.vehicles) && Array.isArray(value.scheduleDays) && Array.isArray(value.movements));
}
