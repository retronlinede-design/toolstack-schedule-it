import { describe, expect, it } from "vitest";
import { validState } from "../import/testFixtures";
import { analyzeScheduleIntegrity, canProduceOfficialOutput, validateMovementCandidate } from "./scheduleValidation";
import { duplicateMovementForSchedule } from "./schedulingMutations";

function cleanState() {
  const state = validState();
  state.vehicleHandoverNotes = [];
  state.movements[0] = { ...state.movements[0], driverStart: "08:00", departureTime: "", arrivalTime: "", eventStartTime: "", eventEndTime: "", endTime: "09:00", continuesOvernight: false, conflictOverrides: [] };
  return state;
}

describe("runtime integrity", () => {
  it("detects duplicate IDs and every movement/default-vehicle orphan", () => {
    const state = cleanState();
    state.movements.push({ ...state.movements[0] });
    state.movements[0].scheduleDayId = "missing";
    state.movements[0].driverId = "missing";
    state.movements[0].vehicleId = "missing";
    state.drivers[0].defaultVehicle = "missing";
    const result = analyzeScheduleIntegrity(state);
    expect(result.errors.some((issue) => issue.type === "DUPLICATE_ID")).toBe(true);
    expect(result.summary.orphanReferences).toBeGreaterThanOrEqual(4);
  });

  it("is deterministic and non-mutating", () => {
    const state = cleanState();
    const before = JSON.stringify(state);
    expect(analyzeScheduleIntegrity(state)).toEqual(analyzeScheduleIntegrity(state));
    expect(JSON.stringify(state)).toBe(before);
  });

  it("blocks chronology and unresolved overlaps, but permits valid overrides", () => {
    const state = cleanState();
    const invalid = { ...state.movements[0], id: "invalid", driverStart: "10:00", departureTime: "09:00" };
    expect(validateMovementCandidate(state, invalid).blocking.some((issue) => issue.type === "CHRONOLOGY_ERROR")).toBe(true);
    const overlap = { ...state.movements[0], id: "overlap", driverStart: "08:30", endTime: "09:30", vehicleId: "vehicle-bmw" };
    const unresolved = validateMovementCandidate(state, overlap);
    const conflict = unresolved.blocking.find((issue) => issue.type === "DRIVER_OVERLAP");
    expect(conflict).toBeTruthy();
    overlap.conflictOverrides = [{ conflictKey: conflict.conflictKey, reason: "Shared standby movement", acknowledgedAt: "2026-01-01T00:00:00.000Z" }];
    expect(validateMovementCandidate(state, overlap).blocking.some((issue) => issue.type === "DRIVER_OVERLAP")).toBe(false);
  });

  it("requires an override reason and clears overrides on duplicate", () => {
    const source = { ...cleanState().movements[0], conflictOverrides: [{ conflictKey: "key", reason: "short" }] };
    const state = cleanState(); state.movements.push(source);
    expect(analyzeScheduleIntegrity(state).errors.some((issue) => issue.type === "DRIVER_OVERLAP")).toBe(true);
    expect(duplicateMovementForSchedule(source, "copy", 20).conflictOverrides).toEqual([]);
  });

  it("enforces official-output safeguards for errors but allows warnings and overrides", () => {
    const valid = analyzeScheduleIntegrity(cleanState());
    expect(canProduceOfficialOutput(valid)).toBe(true);
    const adjacentState = cleanState(); adjacentState.movements.push({ ...adjacentState.movements[0], id: "adjacent", driverStart: "09:00", endTime: "10:00", vehicleId: "vehicle-bmw" });
    const warningOnly = analyzeScheduleIntegrity(adjacentState);
    expect(warningOnly.errors).toHaveLength(0);
    expect(warningOnly.warnings.length).toBeGreaterThan(0);
    expect(canProduceOfficialOutput(warningOnly)).toBe(true);
    const broken = cleanState(); broken.movements[0].endTime = "07:00";
    expect(canProduceOfficialOutput(analyzeScheduleIntegrity(broken))).toBe(false);
  });
});
