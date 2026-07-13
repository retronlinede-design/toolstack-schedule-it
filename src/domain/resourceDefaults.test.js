import { describe, expect, it } from "vitest";
import { createDefaultMovementAssignment, resolveDefaultDriver, resolveDefaultVehicle } from "./resourceDefaults";
import { createDraftFromMovement, createFreshMovementDraft } from "../data/schema";

const drivers = [
  { id: "driver-greg", name: "Greg", defaultVehicle: "vehicle-vito", isActive: true },
  { id: "driver-rory", name: "Rory", defaultVehicle: "vehicle-bmw", isActive: true },
];
const vehicles = [
  { id: "vehicle-vito", name: "Vito", isActive: true },
  { id: "vehicle-bmw", name: "BMW", isActive: true },
];

describe("movement resource defaults", () => {
  it("selects Rory and Rory's configured BMW for a fresh assignment", () => {
    expect(createDefaultMovementAssignment({ drivers, vehicles })).toEqual({ driverId: "driver-rory", vehicleId: "vehicle-bmw" });
    expect(createFreshMovementDraft({ profile: { missionName: "Mission", documentTitle: "Programme" }, drivers, vehicles })).toMatchObject({ id: null, driverId: "driver-rory", vehicleId: "vehicle-bmw", pickups: [] });
  });

  it("preserves stored assignments when editing", () => {
    const draft = createDraftFromMovement({ id: "m", scheduleDayId: "day", driverId: "driver-greg", vehicleId: "vehicle-vito", pickups: [] }, { id: "day" }, { missionName: "Mission", documentTitle: "Programme" });
    expect(draft).toMatchObject({ id: "m", driverId: "driver-greg", vehicleId: "vehicle-vito" });
  });

  it("gives a valid configured default vehicle precedence over BMW matching", () => {
    const changed = drivers.map((driver) => driver.id === "driver-rory" ? { ...driver, defaultVehicle: "vehicle-vito" } : driver);
    expect(resolveDefaultVehicle({ drivers: changed, vehicles }, "driver-rory")?.id).toBe("vehicle-vito");
  });

  it("skips inactive intended resources and falls back to the first active resources", () => {
    const inactiveRory = drivers.map((driver) => driver.id === "driver-rory" ? { ...driver, isActive: false } : driver);
    expect(resolveDefaultDriver({ drivers: inactiveRory })?.id).toBe("driver-greg");
    const inactiveBmw = vehicles.map((vehicle) => vehicle.id === "vehicle-bmw" ? { ...vehicle, isActive: false } : vehicle);
    expect(resolveDefaultVehicle({ drivers, vehicles: inactiveBmw }, "driver-rory")?.id).toBe("vehicle-vito");
  });

  it("identifies BMW independently when Rory is unavailable", () => {
    expect(resolveDefaultVehicle({ drivers: [drivers[0]], vehicles }, "driver-greg")?.id).toBe("vehicle-bmw");
  });

  it("retains stable configured identity after rename and returns empty when none are active", () => {
    const renamed = drivers.map((driver) => driver.id === "driver-rory" ? { ...driver, name: "R. O'Connor" } : driver);
    expect(resolveDefaultDriver({ drivers: renamed })?.id).toBe("driver-rory");
    expect(createDefaultMovementAssignment({ drivers: drivers.map((driver) => ({ ...driver, isActive: false })), vehicles: vehicles.map((vehicle) => ({ ...vehicle, isActive: false })) })).toEqual({ driverId: "", vehicleId: "" });
  });
});
