import { selectMovementsForView } from "../domain/audiences";

export function chronologicalDays(schedule) {
  return schedule.scheduleDays.map((day, storedIndex) => ({ ...day, storedIndex })).sort((a, b) =>
    (a.date || "").localeCompare(b.date || "") || a.storedIndex - b.storedIndex || (a.title || "").localeCompare(b.title || "") || a.id.localeCompare(b.id));
}

function movementsForView(schedule, config) {
  if (config.view === "importantInfo") return [];
  if (config.view === "workingTime") return schedule.movements;
  return selectMovementsForView(schedule.movements, config.view, { selectedDriverId: config.driverId });
}

export function movementCountForPrintDay(schedule, config, dayId) {
  return movementsForView(schedule, config).filter((movement) => movement.scheduleDayId === dayId).length;
}

export function printableDayIds(schedule, config) {
  const ids = new Set(movementsForView(schedule, config).map((movement) => movement.scheduleDayId));
  if (config.include.handovers && (config.view === "operational" || config.view === "driver")) {
    (schedule.vehicleHandoverNotes || []).forEach((note) => {
      if (config.view !== "driver" || note.visibleToDriverIds?.includes(config.driverId) || note.fromDriverId === config.driverId || note.toDriverId === config.driverId) ids.add(note.scheduleDayId);
    });
  }
  return chronologicalDays(schedule).filter((day) => ids.has(day.id)).map((day) => day.id);
}

export function selectPrintDays(schedule, config) {
  const printable = new Set(printableDayIds(schedule, config));
  let requested;
  if (config.scope === "current") requested = [config.currentDayId];
  else if (config.scope === "selected") requested = config.selectedDayIds;
  else requested = [...printable];
  const selected = new Set(requested.filter((id) => printable.has(id)));
  return chronologicalDays(schedule).filter((day) => selected.has(day.id));
}

function filterPickup(pickup, include) {
  return {
    ...pickup,
    address: include.addresses ? pickup.address : "",
    notes: include.parkingNotes ? pickup.notes : "",
  };
}

function filterMovement(movement, include) {
  return {
    ...movement,
    pickups: include.pickups ? (movement.pickups || []).map((pickup) => filterPickup(pickup, include)) : [],
    address: include.addresses ? movement.address : "",
    participants: include.participants ? movement.participants : "",
    parking: include.parkingNotes ? movement.parking : "",
    locationNotes: include.parkingNotes ? movement.locationNotes : "",
  };
}

export function createPrintSchedule(schedule, config) {
  if (config.view === "importantInfo") return { ...schedule, scheduleDays: [], movements: [], vehicleHandoverNotes: [] };
  const selectedDays = selectPrintDays(schedule, config);
  const dayIds = new Set(selectedDays.map((day) => day.id));
  return {
    ...schedule,
    scheduleDays: selectedDays,
    movements: schedule.movements.filter((movement) => dayIds.has(movement.scheduleDayId)).map((movement) => filterMovement(movement, config.include)),
    vehicleHandoverNotes: config.include.handovers ? (schedule.vehicleHandoverNotes || []).filter((note) => dayIds.has(note.scheduleDayId)) : [],
  };
}

export function validatePrintSelection(schedule, config) {
  if (config.view === "importantInfo") return (schedule.importantInfoItems || []).length ? { ok: true, message: "" } : { ok: false, message: "No Important Information records are available." };
  const selectedDays = selectPrintDays(schedule, config);
  if (!selectedDays.length) return { ok: false, message: "No printable programme days match this selection." };
  const derived = createPrintSchedule(schedule, config);
  const matching = movementsForView(derived, config);
  const hasHandovers = config.include.handovers && derived.vehicleHandoverNotes.length && (config.view === "operational" || config.view === "driver");
  if (!matching.length && !hasHandovers) return { ok: false, message: config.view === "driver" ? "The selected driver has no matching output." : "The selected programme has no matching movements." };
  return { ok: true, message: "" };
}
