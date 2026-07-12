import { describe, expect, it } from "vitest";
import { validateScheduleBackupState } from "./backupValidator";
import { validState } from "./testFixtures";

function invalidWith(mutate) {
  const state = validState(); mutate(state.movements[0].audiences, state);
  return validateScheduleBackupState(state);
}

describe("backup audience validation", () => {
  it("accepts valid audiences and legacy movements without audiences", () => {
    expect(validateScheduleBackupState(validState()).ok).toBe(true);
    const legacy = validState(); delete legacy.movements[0].audiences;
    expect(validateScheduleBackupState(legacy).ok).toBe(true);
  });

  it.each([
    ["malformed boolean", (audiences) => { audiences.cg = "yes"; }],
    ["non-array driver IDs", (audiences) => { audiences.driverIds = "driver-rory"; }],
    ["unknown driver", (audiences) => { audiences.driverIds = ["unknown"]; }],
    ["duplicate driver", (audiences) => { audiences.driverIds = ["driver-rory", "driver-rory"]; }],
    ["assigned driver duplicate", (audiences) => { audiences.driverIds = ["driver-greg"]; }],
    ["unknown key", (audiences) => { audiences.vip = true; }],
  ])("rejects %s", (_label, mutate) => expect(invalidWith(mutate).ok).toBe(false));

  it("rejects forbidden audience keys", () => {
    const state = validState();
    state.movements[0].audiences = JSON.parse('{"executive":true,"operational":true,"cg":false,"marida":false,"driverIds":[],"__proto__":{}}');
    expect(validateScheduleBackupState(state).errors.some((error) => error.code === "FORBIDDEN_KEY")).toBe(true);
  });
});
