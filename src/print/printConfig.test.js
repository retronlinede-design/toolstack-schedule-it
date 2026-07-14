import { describe, expect, it } from "vitest";
import { createDefaultPrintConfig, validatePrintConfig } from "./printConfig";

describe("simplified print configuration", () => {
  it("defaults to the current programme with all days, continuous flow, and standard density", () => {
    expect(createDefaultPrintConfig("executive", { currentDayId: "day-1" })).toEqual({
      view: "executive", driverId: "", currentDayId: "day-1", selectedDayIds: [], scope: "all", layout: "continuous", density: "standard",
    });
    expect(createDefaultPrintConfig("driver", { driverId: "driver-1" }).driverId).toBe("driver-1");
  });

  it("validates only driver and simple day-scope requirements", () => {
    expect(validatePrintConfig({ ...createDefaultPrintConfig("driver"), driverId: "" }).errors.driverId).toBeTruthy();
    expect(validatePrintConfig({ ...createDefaultPrintConfig(), scope: "selected" }).errors.selectedDayIds).toBeTruthy();
    expect(validatePrintConfig({ ...createDefaultPrintConfig(), scope: "current", currentDayId: "" }).errors.currentDayId).toBeTruthy();
    expect(validatePrintConfig(createDefaultPrintConfig()).ok).toBe(true);
  });
});
