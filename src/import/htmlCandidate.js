import { validateScheduleBackupState } from "./backupValidator";
import { DEFAULT_MOVEMENT_AUDIENCES } from "../domain/audiences";

function nameKey(value) {
  return (value || "").trim().toLowerCase();
}

function hash(value) {
  let result = 2166136261;
  for (let index = 0; index < value.length; index += 1) {
    result ^= value.charCodeAt(index);
    result = Math.imul(result, 16777619);
  }
  return (result >>> 0).toString(36);
}

export function buildHtmlImportCandidate(current, result, mode) {
  if (!result || result.errors?.length || !Array.isArray(result.movements)) return { ok: false, code: "INVALID_HTML_IMPORT", message: "Parsed HTML output is invalid." };
  const fingerprint = hash(JSON.stringify({ day: result.scheduleDayDraft, movements: result.movements }));
  const targetDay = { id: `html-day-${fingerprint}`, date: result.scheduleDayDraft?.date || "", title: result.scheduleDayDraft?.title || "Imported HTML Schedule" };
  if (mode !== "replace" && current.scheduleDays.some((day) => day.id === targetDay.id)) {
    const expectedIds = result.movements.map((_movement, index) => `html-movement-${fingerprint}-${index + 1}`);
    if (expectedIds.every((id) => current.movements.some((movement) => movement.id === id))) return { ok: true, duplicate: true, candidate: current, targetDay };
    return { ok: false, code: "ID_COLLISION", message: "Generated HTML import IDs collide with existing records." };
  }

  const vehicles = [...current.vehicles];
  const drivers = [...current.drivers];
  const vehicleByName = new Map(vehicles.map((vehicle) => [nameKey(vehicle.name), vehicle]));
  const driverByName = new Map(drivers.map((driver) => [nameKey(driver.name), driver]));
  (result.vehiclesToAdd || []).forEach((vehicleName) => {
    if (!vehicleByName.has(nameKey(vehicleName))) {
      const vehicle = { id: `html-vehicle-${hash(nameKey(vehicleName))}`, name: vehicleName };
      if (vehicles.some((item) => item.id === vehicle.id)) vehicle.id = `${vehicle.id}-${vehicles.length + 1}`;
      vehicles.push(vehicle);
      vehicleByName.set(nameKey(vehicleName), vehicle);
    }
  });
  (result.driversToAdd || []).forEach((driverName) => {
    if (!driverByName.has(nameKey(driverName))) {
      const firstVehicleName = result.movements.find((movement) => nameKey(movement.driverName) === nameKey(driverName))?.vehicleName;
      const driver = { id: `html-driver-${hash(nameKey(driverName))}`, name: driverName, defaultVehicle: vehicleByName.get(nameKey(firstVehicleName))?.id || vehicles[0]?.id || "" };
      if (drivers.some((item) => item.id === driver.id)) driver.id = `${driver.id}-${drivers.length + 1}`;
      drivers.push(driver);
      driverByName.set(nameKey(driverName), driver);
    }
  });
  const importedMovements = result.movements.map((movement, index) => {
    const driver = driverByName.get(nameKey(movement.driverName)) || drivers[0];
    const vehicle = vehicleByName.get(nameKey(movement.vehicleName)) || vehicles.find((item) => item.id === driver?.defaultVehicle) || vehicles[0];
    const { driverName: _driverName, vehicleName: _vehicleName, ...fields } = movement;
    return { ...fields, audiences: fields.audiences || { ...DEFAULT_MOVEMENT_AUDIENCES, driverIds: [] }, continuesOvernight: false, conflictOverrides: [], workClassification: "active", id: `html-movement-${fingerprint}-${index + 1}`, scheduleDayId: targetDay.id, sortOrder: (index + 1) * 10, driverId: driver?.id || "", vehicleId: vehicle?.id || "" };
  });
  const candidate = {
    ...current,
    drivers,
    vehicles,
    scheduleDays: mode === "replace" ? [targetDay] : [...current.scheduleDays, targetDay],
    movements: mode === "replace" ? importedMovements : [...current.movements, ...importedMovements],
    vehicleHandoverNotes: mode === "replace" ? [] : current.vehicleHandoverNotes || [],
    importantInfoItems: current.importantInfoItems || [],
    routeNotes: current.routeNotes || [],
  };
  const validation = validateScheduleBackupState(candidate);
  return validation.ok ? { ok: true, candidate, targetDay, fingerprint } : { ok: false, code: "INVALID_SCHEMA", message: "HTML import candidate failed validation.", validation };
}
