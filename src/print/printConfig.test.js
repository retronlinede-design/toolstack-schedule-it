import { describe, expect, it } from "vitest";
import { PRINT_PRESETS, applyPrintPreset, createDefaultPrintConfig, hasDriverGrouping, validatePrintConfig } from "./printConfig";

describe("print configuration", () => {
  it("uses view-sensitive defaults without entering schedule data", () => {
    expect(createDefaultPrintConfig("executive", { currentDayId: "day-1" })).toMatchObject({ view: "executive", currentDayId: "day-1", layout: "smart", density: "standard", orientation: "portrait", include: { pickups: true, pickupContacts: false, pickupNotes: false } });
    expect(createDefaultPrintConfig("driver", { driverId: "driver-1" })).toMatchObject({ driverId: "driver-1", include: { pickupAddresses: true, pickupContacts: true, pickupNotes: true } });
  });

  it("applies all five editable presets", () => {
    expect(Object.keys(PRINT_PRESETS)).toHaveLength(5);
    const config = createDefaultPrintConfig();
    expect(applyPrintPreset(config, "dailyFormal").layout).toBe("separate");
    expect(applyPrintPreset(config, "combinedProgramme").layout).toBe("continuous");
    expect(applyPrintPreset(config, "smartMultiDay").layout).toBe("smart");
    expect(applyPrintPreset(config, "compactOverview")).toMatchObject({ layout: "compact", density: "compact" });
    expect(applyPrintPreset(config, "operationalLandscape")).toMatchObject({ layout: "smart", density: "compact", orientation: "landscape" });
  });

  it("validates driver, selected-day, current-day, and date-range requirements", () => {
    expect(validatePrintConfig({ ...createDefaultPrintConfig("driver"), driverId: "" }).errors.driverId).toBeTruthy();
    expect(validatePrintConfig({ ...createDefaultPrintConfig(), scope: "selected" }).errors.selectedDayIds).toBeTruthy();
    expect(validatePrintConfig({ ...createDefaultPrintConfig(), scope: "current", currentDayId: "" }).errors.currentDayId).toBeTruthy();
    expect(validatePrintConfig({ ...createDefaultPrintConfig(), scope: "range", rangeStart: "2026-02-02", rangeEnd: "2026-01-01" }).errors.range).toContain("after");
    expect(hasDriverGrouping("operational")).toBe(true);
    expect(hasDriverGrouping("executive")).toBe(false);
  });
});
