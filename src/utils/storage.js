import { defaultScheduleState, STORAGE_KEY } from "../data/defaultData";
import { createMovementFromDraft, createScheduleDayFromDraft, emptyDraft } from "../data/schema";
import { parseTimeToMinutes } from "./time";

const APP_KEY = `${STORAGE_KEY}.app_v1`;
const LEGACY_FORM_KEY = `${STORAGE_KEY}.form_v2`;
const LEGACY_ENTRIES_KEY = `${STORAGE_KEY}.entries_v2`;

function readJson(key) {
  try {
    const raw = localStorage.getItem(key);
    return raw ? JSON.parse(raw) : null;
  } catch (error) {
    console.error(`Error reading ${key}`, error);
    return null;
  }
}

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

  return Object.values(grouped).flatMap((dayMovements) =>
    [...dayMovements]
      .sort((a, b) => {
        const dateCompare = (daysById.get(a.scheduleDayId)?.date || "").localeCompare(daysById.get(b.scheduleDayId)?.date || "");
        if (dateCompare !== 0) return dateCompare;

        const aHasSortOrder = Number.isFinite(a.sortOrder);
        const bHasSortOrder = Number.isFinite(b.sortOrder);
        if (aHasSortOrder && bHasSortOrder && a.sortOrder !== b.sortOrder) return a.sortOrder - b.sortOrder;

        return fallbackTime(a) - fallbackTime(b);
      })
      .map((movement, index) => ({
        ...movement,
        sortOrder: (index + 1) * 10,
      })),
  );
}

function contextNoteForRoute(route, scheduleDays, drivers) {
  const day = scheduleDays.find((item) => item.id === route.scheduleDayId);
  const driver = drivers.find((item) => item.id === route.driverId);
  const context = [day?.title || day?.date, driver?.name].filter(Boolean).join(" / ");
  return context ? `Imported from legacy route note: ${context}` : "Imported from legacy route note.";
}

function migrateRouteNotesToImportantInfo(routeNotes, scheduleDays, drivers) {
  return routeNotes.map((route, index) => {
    const contextNote = contextNoteForRoute(route, scheduleDays, drivers);
    const existingNotes = route.notes || "";

    return {
      id: route.id ? `info-${route.id}` : `info-route-${index + 1}`,
      type: "Route",
      title: route.from && route.to ? `${route.from} to ${route.to}` : route.from || route.to || "Route",
      from: route.from || "",
      to: route.to || "",
      distance: route.distance || "",
      estimatedTravelTime: route.estimatedTravelTime || "",
      name: "",
      phone: "",
      email: "",
      address: "",
      notes: [contextNote, existingNotes].filter(Boolean).join("\n"),
      sortOrder: Number.isFinite(route.sortOrder) ? route.sortOrder : (index + 1) * 10,
    };
  });
}

export function normalizeState(state) {
  const scheduleDays = state?.scheduleDays || [];
  const movements = withSortOrders(scheduleDays, state?.movements || []);
  const routeNotes = Array.isArray(state?.routeNotes) ? state.routeNotes : [];
  const drivers = state?.drivers?.length ? state.drivers : defaultScheduleState.drivers;
  const importantInfoItems = Array.isArray(state?.importantInfoItems)
    ? state.importantInfoItems
    : migrateRouteNotesToImportantInfo(routeNotes, scheduleDays, drivers);
  const vehicleHandoverNotes = Array.isArray(state?.vehicleHandoverNotes) ? state.vehicleHandoverNotes : [];

  return {
    ...defaultScheduleState,
    ...state,
    profile: {
      ...defaultScheduleState.profile,
      ...state?.profile,
    },
    drivers,
    vehicles: state?.vehicles?.length ? state.vehicles : defaultScheduleState.vehicles,
    scheduleDays,
    movements,
    vehicleHandoverNotes,
    importantInfoItems,
    routeNotes,
  };
}

export function validateScheduleState(value) {
  return Boolean(
    value &&
      typeof value === "object" &&
      value.profile &&
      typeof value.profile === "object" &&
      Array.isArray(value.drivers) &&
      Array.isArray(value.vehicles) &&
      Array.isArray(value.scheduleDays) &&
      Array.isArray(value.movements),
  );
}

function migrateLegacyState() {
  const legacyForm = readJson(LEGACY_FORM_KEY);
  const legacyEntries = readJson(LEGACY_ENTRIES_KEY);
  const entries = Array.isArray(legacyEntries) ? legacyEntries : [];

  if (!legacyForm && entries.length === 0) {
    return defaultScheduleState;
  }

  const profile = {
    missionName: legacyForm?.missionName || defaultScheduleState.profile.missionName,
    documentTitle: legacyForm?.documentTitle || defaultScheduleState.profile.documentTitle,
  };

  const scheduleDays = [];
  const movements = [];

  entries.forEach((entry) => {
    const draft = { ...emptyDraft, ...entry };
    const existingDay = scheduleDays.find((day) => day.date === draft.date);
    const day = createScheduleDayFromDraft(draft, existingDay);

    if (!existingDay) scheduleDays.push(day);
    movements.push(createMovementFromDraft(draft, day.id));
  });

  return normalizeState({
    profile,
    scheduleDays,
    movements,
  });
}

export function loadScheduleState() {
  const savedState = readJson(APP_KEY);
  if (savedState) return normalizeState(savedState);

  return migrateLegacyState();
}

export function saveScheduleState(state) {
  localStorage.setItem(APP_KEY, JSON.stringify(normalizeState(state)));
}

export function downloadJson(filename, data) {
  const blob = new Blob([JSON.stringify(data, null, 2)], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = filename;
  anchor.click();
  URL.revokeObjectURL(url);
}
