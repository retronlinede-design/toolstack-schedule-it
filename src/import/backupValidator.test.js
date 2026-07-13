import { describe, expect, it } from "vitest";
import { validateScheduleBackupState, VALIDATION_LIMITS } from "./backupValidator";
import { validState } from "./testFixtures";

function hasCode(result, code) {
  return result.errors.some((error) => error.code === code);
}

describe("strict schedule validation", () => {
  it("accepts a valid current/legacy state", () => expect(validateScheduleBackupState(validState()).ok).toBe(true));

  it.each([
    ["drivers", "driver-greg"], ["vehicles", "vehicle-vito"], ["scheduleDays", "day-1"], ["movements", "movement-1"],
    ["vehicleHandoverNotes", "handover-1"], ["importantInfoItems", "info-1"],
  ])("rejects duplicate IDs in %s", (collection, id) => {
    const state = validState();
    state[collection].push({ ...state[collection][0], id });
    expect(hasCode(validateScheduleBackupState(state), "DUPLICATE_ID")).toBe(true);
  });

  it.each([
    ["unknown day", (state) => { state.movements[0].scheduleDayId = "missing"; }],
    ["unknown driver", (state) => { state.movements[0].driverId = "missing"; }],
    ["unknown vehicle", (state) => { state.movements[0].vehicleId = "missing"; }],
    ["unknown visible driver", (state) => { state.vehicleHandoverNotes[0].visibleToDriverIds = ["missing"]; }],
  ])("rejects %s references", (_label, mutate) => {
    const state = validState(); mutate(state);
    expect(hasCode(validateScheduleBackupState(state), "UNKNOWN_REFERENCE")).toBe(true);
  });

  it("rejects malformed collections, time types, and visibility types", () => {
    const malformed = validState(); malformed.movements = {};
    expect(hasCode(validateScheduleBackupState(malformed), "INVALID_SCHEMA")).toBe(true);
    const types = validState(); types.movements[0].departureTime = 900; types.movements[0].isExecutiveVisible = "yes";
    expect(validateScheduleBackupState(types).ok).toBe(false);
  });

  it("rejects excessive counts, nesting, strings, and forbidden keys", () => {
    const counts = validState(); counts.drivers = Array.from({ length: VALIDATION_LIMITS.drivers + 1 }, (_, index) => ({ id: `d-${index}`, name: "D" }));
    expect(hasCode(validateScheduleBackupState(counts), "EXCESSIVE_COUNT")).toBe(true);
    const nesting = validState(); let cursor = nesting; for (let i = 0; i < 22; i += 1) { cursor.extra = {}; cursor = cursor.extra; }
    expect(hasCode(validateScheduleBackupState(nesting), "EXCESSIVE_NESTING")).toBe(true);
    const strings = validState(); strings.profile.missionName = "x".repeat(VALIDATION_LIMITS.text + 1);
    expect(hasCode(validateScheduleBackupState(strings), "STRING_TOO_LARGE")).toBe(true);
    const forbidden = JSON.parse('{"version":1,"__proto__":{},"profile":{},"drivers":[],"vehicles":[],"scheduleDays":[],"movements":[],"vehicleHandoverNotes":[],"importantInfoItems":[]}');
    expect(hasCode(validateScheduleBackupState(forbidden), "FORBIDDEN_KEY")).toBe(true);
  });

  it("warns, rather than rejects, duplicate dates", () => {
    const state = validState(); state.scheduleDays.push({ id: "day-2", date: "2026-01-01", title: "Parallel" });
    const result = validateScheduleBackupState(state);
    expect(result.ok).toBe(true);
    expect(result.warnings.some((warning) => warning.includes("Duplicate schedule date"))).toBe(true);
  });

  it("strictly validates movement-owned pickups while accepting legacy absence", () => {
    const legacy = validState(); delete legacy.movements[0].pickups;
    expect(validateScheduleBackupState(legacy).ok).toBe(true);
    const state = validState();
    state.movements[0].pickups = [{ id: "pickup-1", time: "06:45", location: "Hotel", address: "Address", person: "Delegation", contactPhone: "+49", notes: "Wait", sortOrder: 10 }];
    expect(validateScheduleBackupState(state).ok).toBe(true);
    const mutations = [
      (pickups) => { pickups[0].location = ""; },
      (pickups) => { pickups[0].time = "6:45"; },
      (pickups) => { pickups.push({ ...pickups[0] }); },
      (pickups) => { pickups[0].sortOrder = Infinity; },
      (pickups) => { pickups[0].unknown = true; },
    ];
    mutations.forEach((mutate) => { const invalid = structuredClone(state); mutate(invalid.movements[0].pickups); expect(validateScheduleBackupState(invalid).ok).toBe(false); });
    const forbidden = JSON.parse(JSON.stringify(state).replace('"location":"Hotel"', '"__proto__":{},"location":"Hotel"'));
    expect(hasCode(validateScheduleBackupState(forbidden), "FORBIDDEN_KEY")).toBe(true);
  });
});
