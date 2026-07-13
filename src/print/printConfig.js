export const PRINT_VIEWS = [
  { id: "executive", label: "Full Executive" },
  { id: "executiveCg", label: "CG" },
  { id: "executiveMarida", label: "Marida" },
  { id: "operational", label: "Operational" },
  { id: "driver", label: "Driver" },
  { id: "workingTime", label: "Working Time" },
  { id: "importantInfo", label: "Important Information" },
];

export const DEFAULT_INCLUDE = Object.freeze({
  pickups: true,
  addresses: true,
  participants: true,
  parkingNotes: true,
  handovers: true,
});

export function createDefaultPrintConfig(view = "executive", context = {}) {
  return {
    view,
    driverId: view === "driver" ? context.driverId || "" : "",
    scope: "all",
    currentDayId: context.currentDayId || "",
    selectedDayIds: [],
    layout: "smart",
    density: "standard",
    orientation: "portrait",
    include: { ...DEFAULT_INCLUDE },
  };
}

export const PRINT_PRESETS = Object.freeze({
  daily: { label: "Daily", values: { layout: "separate", density: "standard", orientation: "portrait" } },
  combined: { label: "Combined", values: { layout: "continuous", density: "compact", orientation: "portrait" } },
});

export function applyPrintPreset(config, presetId) {
  const preset = PRINT_PRESETS[presetId];
  return preset ? { ...config, ...preset.values } : config;
}

export function validatePrintConfig(config) {
  const errors = {};
  if (!PRINT_VIEWS.some((view) => view.id === config.view)) errors.view = "Select a programme.";
  if (config.view === "driver" && !config.driverId) errors.driverId = "Select a driver for the Driver Programme.";
  if (config.scope === "selected" && !config.selectedDayIds.length) errors.selectedDayIds = "Select at least one programme day.";
  if (config.scope === "current" && !config.currentDayId) errors.currentDayId = "No current programme day is selected.";
  return { ok: Object.keys(errors).length === 0, errors };
}
