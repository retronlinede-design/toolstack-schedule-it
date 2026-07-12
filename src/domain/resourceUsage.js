export function getDriverUsage(schedule, driverId) {
  return {
    movements: schedule.movements.filter((item) => item.driverId === driverId).length,
    audiences: schedule.movements.reduce((total, item) => total + (item.audiences?.driverIds || []).filter((id) => id === driverId).length, 0),
    handoverFrom: (schedule.vehicleHandoverNotes || []).filter((item) => item.fromDriverId === driverId).length,
    handoverTo: (schedule.vehicleHandoverNotes || []).filter((item) => item.toDriverId === driverId).length,
    handoverVisible: (schedule.vehicleHandoverNotes || []).reduce((total, item) => total + (item.visibleToDriverIds || []).filter((id) => id === driverId).length, 0),
  };
}

export function getVehicleUsage(schedule, vehicleId) {
  return {
    movements: schedule.movements.filter((item) => item.vehicleId === vehicleId).length,
    defaultDrivers: schedule.drivers.filter((item) => item.defaultVehicle === vehicleId).length,
    handovers: (schedule.vehicleHandoverNotes || []).filter((item) => item.vehicleId === vehicleId).length,
  };
}

export const totalUsage = (usage) => Object.values(usage).reduce((total, value) => total + value, 0);
