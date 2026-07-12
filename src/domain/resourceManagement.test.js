import { describe, expect, it } from "vitest";
import { validState } from "../import/testFixtures";
import { validateScheduleBackupState } from "../import/backupValidator";
import { normalizeState } from "../storage/state";
import { duplicateDriver, duplicateVehicle, reassignDriverReferences, reassignVehicleReferences } from "./resourceMutations";
import { getDriverUsage, getVehicleUsage, totalUsage } from "./resourceUsage";
import { duplicateDriverNames, duplicateVehicleRegistrations, normalizeRegistration } from "./resourceValidation";
import { analyzeScheduleIntegrity } from "./scheduleValidation";
import { replaceScheduleTransaction, rollbackScheduleTransaction } from "../import/importTransaction";

describe("driver resources", () => {
  it("normalizes legacy fields", () => {
    const state = validState(); delete state.drivers[0].isActive;
    expect(normalizeState(state).drivers[0]).toMatchObject({ isActive: true, phone: "", email: "", notes: "" });
  });
  it("counts every reference and blocks deletion eligibility", () => {
    const state = validState(); state.movements[0].audiences.driverIds = ["driver-rory"];
    const usage = getDriverUsage(state, "driver-rory");
    expect(usage).toMatchObject({ audiences: 1, handoverTo: 1 });
    expect(totalUsage(usage)).toBeGreaterThan(0);
  });
  it("reassigns assignments, audiences, and handovers without duplicates", () => {
    const state = validState(); state.movements[0].audiences.driverIds = ["driver-rory"];
    const candidate = reassignDriverReferences(state, "driver-rory", "driver-greg");
    expect(candidate.movements[0].audiences.driverIds).toEqual([]);
    expect(candidate.vehicleHandoverNotes[0].toDriverId).toBe("driver-greg");
    expect(new Set(candidate.vehicleHandoverNotes[0].visibleToDriverIds).size).toBe(candidate.vehicleHandoverNotes[0].visibleToDriverIds.length);
  });
  it("duplicates metadata without references and warns on duplicate names", () => {
    const driver = duplicateDriver({ id: "d", name: "Alex", isActive: false, phone: "1" }, "copy");
    expect(driver).toMatchObject({ id: "copy", name: "Alex Copy", isActive: true, phone: "1" });
    expect(duplicateDriverNames([{ name: "Alex" }, { name: " alex " }]).has("alex")).toBe(true);
  });
  it("warns only for current/future inactive assignments", () => {
    const state = validState(); state.drivers[0].isActive = false;
    expect(analyzeScheduleIntegrity(state, { today: "2025-01-01" }).warnings.some((issue) => issue.type === "INACTIVE_DRIVER_ASSIGNMENT")).toBe(true);
    expect(analyzeScheduleIntegrity(state, { today: "2027-01-01" }).warnings.some((issue) => issue.type === "INACTIVE_DRIVER_ASSIGNMENT")).toBe(false);
  });
});

describe("vehicle resources", () => {
  it("normalizes legacy fields and registration comparison", () => {
    const state = validState();
    expect(normalizeState(state).vehicles[0]).toMatchObject({ isActive: true, registration: "", capacity: null });
    expect(normalizeRegistration(" M-AB 12 ")).toBe("MAB12");
    expect(duplicateVehicleRegistrations([{ registration: "M-AB 12" }, { registration: "m ab12" }]).has("MAB12")).toBe(true);
  });
  it("counts and reassigns movement, default-driver, and handover references", () => {
    const state = validState(); const usage = getVehicleUsage(state, "vehicle-vito");
    expect(usage).toMatchObject({ movements: 1, defaultDrivers: 1, handovers: 1 });
    const candidate = reassignVehicleReferences(state, "vehicle-vito", "vehicle-bmw");
    expect(candidate.movements[0].vehicleId).toBe("vehicle-bmw");
    expect(candidate.drivers[0].defaultVehicle).toBe("vehicle-bmw");
    expect(candidate.vehicleHandoverNotes[0].vehicleId).toBe("vehicle-bmw");
  });
  it("duplicates while clearing registration", () => {
    expect(duplicateVehicle({ id: "v", name: "Car", registration: "ABC", make: "BMW", isActive: false }, "copy")).toMatchObject({ id: "copy", name: "Car Copy", registration: "", make: "BMW", isActive: true });
  });
  it("rejects duplicate registrations and invalid new fields", () => {
    const state = validState(); state.vehicles[0].registration = "M-1"; state.vehicles[1].registration = "m 1";
    expect(validateScheduleBackupState(state).errors.some((error) => error.path === "vehicles.registration")).toBe(true);
    const invalid = validState(); invalid.vehicles[0].capacity = 101; invalid.drivers[0].isActive = "yes";
    expect(validateScheduleBackupState(invalid).ok).toBe(false);
  });
});

describe("resource transactions", () => {
  it("writes reassignment transactionally and supports rollback", () => {
    const current = validState();
    const values = new Map();
    const storage = { getItem: (key) => values.get(key) ?? null, setItem: (key, value) => values.set(key, value) };
    values.set("primary", JSON.stringify(current));
    const candidate = reassignVehicleReferences(current, "vehicle-vito", "vehicle-bmw");
    const replaced = replaceScheduleTransaction({ currentState: current, candidateState: candidate, operationType: "resource-change", storage, primaryKey: "primary", now: () => 1, idFactory: () => "id" });
    expect(replaced.ok).toBe(true);
    expect(replaced.storedState.movements[0].vehicleId).toBe("vehicle-bmw");
    const rollback = rollbackScheduleTransaction({ snapshotKey: replaced.snapshotKey, currentState: replaced.storedState, storage, primaryKey: "primary", now: () => 2, idFactory: () => "rollback" });
    expect(rollback.ok).toBe(true);
    expect(rollback.storedState.movements[0].vehicleId).toBe("vehicle-vito");
  });
});
