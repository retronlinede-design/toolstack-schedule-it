import { createStorageId } from "../storage/storage";
import { normalizeMovementAudiences } from "./audiences";

export function duplicateDriver(driver, id = createStorageId("driver")) {
  return { ...driver, id, name: `${driver.name} Copy`, isActive: true };
}

export function duplicateVehicle(vehicle, id = createStorageId("vehicle")) {
  return { ...vehicle, id, name: `${vehicle.name} Copy`, registration: "", isActive: true };
}

export function reassignDriverReferences(schedule, sourceId, replacementId) {
  return {
    ...schedule,
    movements: schedule.movements.map((movement) => {
      const driverId = movement.driverId === sourceId ? replacementId : movement.driverId;
      const audiences = normalizeMovementAudiences({ ...movement, driverId, audiences: { ...movement.audiences, driverIds: (movement.audiences?.driverIds || []).map((id) => id === sourceId ? replacementId : id) } });
      return { ...movement, driverId, audiences };
    }),
    vehicleHandoverNotes: (schedule.vehicleHandoverNotes || []).map((note) => ({ ...note, fromDriverId: note.fromDriverId === sourceId ? replacementId : note.fromDriverId, toDriverId: note.toDriverId === sourceId ? replacementId : note.toDriverId, visibleToDriverIds: [...new Set((note.visibleToDriverIds || []).map((id) => id === sourceId ? replacementId : id))] })),
  };
}

export function reassignVehicleReferences(schedule, sourceId, replacementId) {
  return { ...schedule, movements: schedule.movements.map((item) => item.vehicleId === sourceId ? { ...item, vehicleId: replacementId } : item), drivers: schedule.drivers.map((item) => item.defaultVehicle === sourceId ? { ...item, defaultVehicle: replacementId } : item), vehicleHandoverNotes: (schedule.vehicleHandoverNotes || []).map((item) => item.vehicleId === sourceId ? { ...item, vehicleId: replacementId } : item) };
}

export const deleteDriverCandidate = (schedule, id) => ({ ...schedule, drivers: schedule.drivers.filter((item) => item.id !== id) });
export const deleteVehicleCandidate = (schedule, id) => ({ ...schedule, vehicles: schedule.vehicles.filter((item) => item.id !== id) });
