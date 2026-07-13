export const APPLICATION_DEFAULT_DRIVER_ID = "driver-rory";
export const APPLICATION_DEFAULT_VEHICLE_ID = "vehicle-bmw";

const normalized = (value) => String(value || "").trim().toLocaleLowerCase();
const active = (item) => item?.isActive !== false;

export function resolveDefaultDriver(schedule) {
  const drivers = Array.isArray(schedule?.drivers) ? schedule.drivers : [];
  return drivers.find((driver) => active(driver) && driver.isDefault === true)
    || drivers.find((driver) => active(driver) && normalized(driver.name) === "rory")
    || drivers.find((driver) => active(driver) && driver.id === APPLICATION_DEFAULT_DRIVER_ID)
    || drivers.find(active)
    || null;
}

function identifiesBmw(vehicle) {
  return [vehicle?.name, vehicle?.make, vehicle?.model, vehicle?.registration]
    .some((value) => /(^|[^a-z])bmw([^a-z]|$)/i.test(String(value || "")));
}

export function resolveDefaultVehicle(schedule, driverId) {
  const vehicles = Array.isArray(schedule?.vehicles) ? schedule.vehicles : [];
  const drivers = Array.isArray(schedule?.drivers) ? schedule.drivers : [];
  const selectedDriver = drivers.find((item) => item.id === driverId);
  const rory = (selectedDriver && (selectedDriver.id === APPLICATION_DEFAULT_DRIVER_ID || normalized(selectedDriver.name) === "rory") ? selectedDriver : null)
    || drivers.find((driver) => driver.id === APPLICATION_DEFAULT_DRIVER_ID || normalized(driver.name) === "rory");
  return vehicles.find((vehicle) => active(vehicle) && vehicle.id === rory?.defaultVehicle)
    || vehicles.find((vehicle) => active(vehicle) && identifiesBmw(vehicle))
    || vehicles.find((vehicle) => active(vehicle) && vehicle.id === APPLICATION_DEFAULT_VEHICLE_ID)
    || vehicles.find((vehicle) => active(vehicle) && vehicle.id === selectedDriver?.defaultVehicle)
    || vehicles.find(active)
    || null;
}

export function createDefaultMovementAssignment(schedule) {
  const driver = resolveDefaultDriver(schedule);
  const vehicle = resolveDefaultVehicle(schedule, driver?.id);
  return { driverId: driver?.id || "", vehicleId: vehicle?.id || "" };
}
