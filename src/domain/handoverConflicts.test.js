import { describe, expect, it } from "vitest";
import { validState } from "../import/testFixtures";
import { analyzeScheduleIntegrity } from "./scheduleValidation";

function stateWithHandover(overrides = {}) {
  const state = validState();
  state.movements[0] = { ...state.movements[0], driverStart: "08:00", endTime: "10:00", continuesOvernight: false, conflictOverrides: [] };
  state.vehicleHandoverNotes = [{ ...state.vehicleHandoverNotes[0], time: "10:30", ...overrides }];
  return state;
}

describe("handover validation", () => {
  it.each([
    ["malformed time", { time: "9:00" }, "HANDOVER_INVALID_TIME"],
    ["unknown day", { scheduleDayId: "missing" }, "HANDOVER_UNKNOWN_DAY"],
    ["unknown vehicle", { vehicleId: "missing" }, "HANDOVER_UNKNOWN_VEHICLE"],
    ["unknown driver", { toDriverId: "missing" }, "HANDOVER_UNKNOWN_DRIVER"],
    ["same driver", { fromDriverId: "driver-greg", toDriverId: "driver-greg" }, "HANDOVER_SAME_DRIVER"],
    ["vehicle movement overlap", { time: "09:00" }, "HANDOVER_VEHICLE_OVERLAP"],
    ["destination driver overlap", { time: "09:00", toDriverId: "driver-greg" }, "HANDOVER_DRIVER_OVERLAP"],
  ])("detects %s", (_label, overrides, type) => expect(analyzeScheduleIntegrity(stateWithHandover(overrides)).errors.some((issue) => issue.type === type)).toBe(true));

  it("detects duplicate handovers and short transitions", () => {
    const duplicate = stateWithHandover({ time: "10:30" });
    duplicate.vehicleHandoverNotes.push({ ...duplicate.vehicleHandoverNotes[0], id: "handover-2" });
    expect(analyzeScheduleIntegrity(duplicate).errors.some((issue) => issue.type === "HANDOVER_OVERLAP")).toBe(true);
    const short = stateWithHandover({ time: "10:10" });
    expect(analyzeScheduleIntegrity(short).warnings.some((issue) => issue.type === "HANDOVER_SHORT_TRANSITION")).toBe(true);
  });
});
