export const PRINT_VIEWS = [
  { id: "executive", label: "Full Executive Programme" },
  { id: "executiveCg", label: "CG Programme" },
  { id: "executiveMarida", label: "Marida Programme" },
  { id: "operational", label: "Operational Programme" },
  { id: "driver", label: "Driver Programme" },
  { id: "workingTime", label: "Working Time" },
  { id: "importantInfo", label: "Important Information" },
];

export const DEFAULT_INCLUDE = Object.freeze({
  missionHeader: true, documentTitle: true, dayTitle: true, date: true, driver: true, vehicle: true,
  pickups: true, pickupAddresses: true, pickupContacts: false, pickupNotes: false, venue: true, address: true,
  participants: true, parking: true, locationNotes: true, handovers: true, importantInformation: false, pageNumbers: false,
});

export function createDefaultPrintConfig(view = "executive", context = {}) {
  const operational = view === "operational" || view === "driver";
  return {
    view,
    driverId: view === "driver" ? context.driverId || "" : "",
    scope: "all",
    currentDayId: context.currentDayId || "",
    selectedDayIds: [],
    rangeStart: "",
    rangeEnd: "",
    layout: "smart",
    density: "standard",
    orientation: "portrait",
    driverGrouping: "continuous",
    include: { ...DEFAULT_INCLUDE, pickupContacts: operational, pickupNotes: operational, importantInformation: view === "importantInfo" },
    keepMovementTogether: true,
    keepDayHeadingWithFirstMovement: true,
    repeatTableHeaders: true,
  };
}

export const PRINT_PRESETS = Object.freeze({
  dailyFormal: { label: "Daily formal", values: { layout: "separate", density: "standard", orientation: "portrait" } },
  combinedProgramme: { label: "Combined programme", values: { layout: "continuous", density: "standard", orientation: "portrait" } },
  smartMultiDay: { label: "Smart multi-day", values: { layout: "smart", density: "standard", orientation: "portrait" } },
  compactOverview: { label: "Compact overview", values: { layout: "compact", density: "compact", orientation: "portrait", include: { pickupAddresses: false, pickupContacts: false, pickupNotes: false, address: false, locationNotes: false, parking: false, participants: false, handovers: false } } },
  operationalLandscape: { label: "Operational landscape", values: { layout: "smart", density: "compact", orientation: "landscape" } },
});

export function applyPrintPreset(config, presetId) {
  const preset = PRINT_PRESETS[presetId];
  if (!preset) return config;
  return { ...config, ...preset.values, include: { ...config.include, ...(preset.values.include || {}) } };
}

export function validatePrintConfig(config) {
  const errors = {};
  if (!PRINT_VIEWS.some((view) => view.id === config.view)) errors.view = "Select a programme.";
  if (config.view === "driver" && !config.driverId) errors.driverId = "Select a driver for the Driver Programme.";
  if (config.scope === "selected" && !config.selectedDayIds.length) errors.selectedDayIds = "Select at least one programme day.";
  if (config.scope === "current" && !config.currentDayId) errors.currentDayId = "No current programme day is selected.";
  if (config.scope === "range") {
    if (!config.rangeStart || !config.rangeEnd) errors.range = "Enter a start and end date.";
    else if (config.rangeStart > config.rangeEnd) errors.range = "Start date must not be after end date.";
  }
  return { ok: Object.keys(errors).length === 0, errors };
}

export function hasDriverGrouping(view) {
  return view === "operational" || view === "driver";
}
