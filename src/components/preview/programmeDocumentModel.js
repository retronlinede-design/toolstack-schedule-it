import { getEntriesByMonth } from "../../utils/calculations";

export const PROGRAMME_VIEWS = [
  { id: "executive", label: "Full Executive" },
  { id: "executiveCg", label: "CG" },
  { id: "executiveMarida", label: "Marida" },
  { id: "operational", label: "Operational" },
  { id: "driver", label: "Driver" },
  { id: "workingTime", label: "Working Time" },
  { id: "importantInfo", label: "Important Information" },
];

export function chronologicalProgrammeDays(scheduleDays = []) {
  return scheduleDays.map((day, storedIndex) => ({ ...day, storedIndex })).sort((a, b) =>
    (a.date || "").localeCompare(b.date || "") || a.storedIndex - b.storedIndex || (a.title || "").localeCompare(b.title || "") || a.id.localeCompare(b.id));
}

export function filterScheduleForProgrammeDocument(schedule, selectedDayIds) {
  if (!selectedDayIds) return schedule;
  const selected = new Set(selectedDayIds);
  const scheduleDays = chronologicalProgrammeDays(schedule.scheduleDays).filter((day) => selected.has(day.id));
  const dayIds = new Set(scheduleDays.map((day) => day.id));
  return {
    ...schedule,
    scheduleDays,
    movements: schedule.movements.filter((movement) => dayIds.has(movement.scheduleDayId)),
    vehicleHandoverNotes: (schedule.vehicleHandoverNotes || []).filter((note) => dayIds.has(note.scheduleDayId)),
  };
}

export function createProgrammeDocumentModel(schedule, view = "executive", options = {}) {
  const filteredSchedule = filterScheduleForProgrammeDocument(schedule, options.selectedDayIds);
  return {
    view,
    label: PROGRAMME_VIEWS.find((item) => item.id === view)?.label || "Programme",
    schedule: filteredSchedule,
    entriesByMonth: getEntriesByMonth(filteredSchedule.scheduleDays, filteredSchedule.movements),
    selectedDriverId: options.selectedDriverId || "",
  };
}
