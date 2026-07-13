import { describe, expect, it } from "vitest";
import { PRINT_PRESETS, applyPrintPreset, createDefaultPrintConfig, validatePrintConfig } from "./printConfig";

describe("simplified print configuration", () => {
  it("defaults to smart, standard, portrait with broad programme details", () => {
    expect(createDefaultPrintConfig("executive", { currentDayId: "day-1" })).toMatchObject({
      view: "executive", currentDayId: "day-1", scope: "all", layout: "smart", density: "standard", orientation: "portrait",
      include: { pickups: true, addresses: true, participants: true, parkingNotes: true, handovers: true },
    });
    expect(createDefaultPrintConfig("driver", { driverId: "driver-1" }).driverId).toBe("driver-1");
  });

  it("retains only Daily and Combined presets", () => {
    expect(Object.keys(PRINT_PRESETS)).toEqual(["daily", "combined"]);
    expect(applyPrintPreset(createDefaultPrintConfig(), "daily")).toMatchObject({ layout: "separate", density: "standard", orientation: "portrait" });
    expect(applyPrintPreset(createDefaultPrintConfig(), "combined")).toMatchObject({ layout: "continuous", density: "compact", orientation: "portrait" });
  });

  it("validates only driver and simple day-scope requirements", () => {
    expect(validatePrintConfig({ ...createDefaultPrintConfig("driver"), driverId: "" }).errors.driverId).toBeTruthy();
    expect(validatePrintConfig({ ...createDefaultPrintConfig(), scope: "selected" }).errors.selectedDayIds).toBeTruthy();
    expect(validatePrintConfig({ ...createDefaultPrintConfig(), scope: "current", currentDayId: "" }).errors.currentDayId).toBeTruthy();
    expect(validatePrintConfig(createDefaultPrintConfig()).ok).toBe(true);
  });
});
