import { PROGRAMME_VIEWS } from "../components/preview/programmeDocumentModel";

export const PRINT_VIEWS = PROGRAMME_VIEWS;

export function createDefaultPrintConfig(view = "executive", context = {}) {
  return {
    view,
    driverId: view === "driver" ? context.driverId || "" : "",
    scope: "all",
    currentDayId: context.currentDayId || "",
    selectedDayIds: [],
    layout: "continuous",
    density: "standard",
  };
}

export function validatePrintConfig(config) {
  const errors = {};
  if (!PRINT_VIEWS.some((view) => view.id === config.view)) errors.view = "Select a programme.";
  if (config.view === "driver" && !config.driverId) errors.driverId = "Select a driver for the Driver Programme.";
  if (config.scope === "selected" && !config.selectedDayIds.length) errors.selectedDayIds = "Select at least one programme day.";
  if (config.scope === "current" && !config.currentDayId) errors.currentDayId = "No current programme day is selected.";
  return { ok: Object.keys(errors).length === 0, errors };
}
