export const normalizeRegistration = (value) => String(value || "").trim().replace(/[\s-]+/g, "").toUpperCase();

export function normalizeDriver(driver) {
  return { ...driver, name: typeof driver?.name === "string" ? driver.name : "", defaultVehicle: typeof driver?.defaultVehicle === "string" ? driver.defaultVehicle : "", isActive: driver?.isActive !== false, phone: typeof driver?.phone === "string" ? driver.phone : "", email: typeof driver?.email === "string" ? driver.email : "", notes: typeof driver?.notes === "string" ? driver.notes : "" };
}

export function normalizeVehicle(vehicle) {
  return { ...vehicle, name: typeof vehicle?.name === "string" ? vehicle.name : "", registration: typeof vehicle?.registration === "string" ? vehicle.registration : "", make: typeof vehicle?.make === "string" ? vehicle.make : "", model: typeof vehicle?.model === "string" ? vehicle.model : "", capacity: Number.isInteger(vehicle?.capacity) ? vehicle.capacity : null, isActive: vehicle?.isActive !== false, notes: typeof vehicle?.notes === "string" ? vehicle.notes : "" };
}

export function duplicateDriverNames(drivers) {
  const counts = new Map(); drivers.forEach((item) => { const key = item.name.trim().toLocaleLowerCase(); if (key) counts.set(key, (counts.get(key) || 0) + 1); }); return new Set([...counts].filter(([, count]) => count > 1).map(([name]) => name));
}

export function duplicateVehicleRegistrations(vehicles) {
  const counts = new Map(); vehicles.forEach((item) => { const key = normalizeRegistration(item.registration); if (key) counts.set(key, (counts.get(key) || 0) + 1); }); return new Set([...counts].filter(([, count]) => count > 1).map(([registration]) => registration));
}
