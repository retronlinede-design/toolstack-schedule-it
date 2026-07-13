import { describe, expect, it } from "vitest";
import { validState } from "../import/testFixtures";
import { createDefaultPrintConfig } from "./printConfig";
import { chronologicalDays, createPrintSchedule, selectPrintDays, validatePrintSelection } from "./printSelection";

function multiDayState() {
  const state = validState();
  state.scheduleDays = [
    { id: "day-b", date: "2026-01-02", title: "Second" },
    { id: "day-a", date: "2026-01-01", title: "First A" },
    { id: "day-a2", date: "2026-01-01", title: "First B" },
  ];
  state.movements = state.scheduleDays.map((day, index) => ({ ...state.movements[0], id: `movement-${index}`, scheduleDayId: day.id, sortOrder: 10, engagementDetails: `Engagement ${day.id}` }));
  return state;
}

describe("print day selection", () => {
  it("sorts chronologically and preserves duplicate-date days separately", () => {
    expect(chronologicalDays(multiDayState()).map((day) => day.id)).toEqual(["day-a", "day-a2", "day-b"]);
  });

  it("selects all, current, selected, range, and exact preview scopes", () => {
    const state = multiDayState();
    const base = createDefaultPrintConfig();
    expect(selectPrintDays(state, base).map((day) => day.id)).toEqual(["day-a", "day-a2", "day-b"]);
    expect(selectPrintDays(state, { ...base, scope: "current", currentDayId: "day-b" }).map((day) => day.id)).toEqual(["day-b"]);
    expect(selectPrintDays(state, { ...base, scope: "selected", selectedDayIds: ["day-b", "day-a"] }).map((day) => day.id)).toEqual(["day-a", "day-b"]);
    expect(selectPrintDays(state, { ...base, scope: "range", rangeStart: "2026-01-01", rangeEnd: "2026-01-01" }).map((day) => day.id)).toEqual(["day-a", "day-a2"]);
    expect(selectPrintDays(state, { ...base, scope: "preview" }, { previewDayIds: ["day-a2"] }).map((day) => day.id)).toEqual(["day-a2"]);
  });

  it("reports empty selections and removes excluded presentation details without losing identity", () => {
    const state = multiDayState();
    state.movements[0].pickups = [{ id: "p", time: "07:00", location: "Hotel", address: "Secret address", person: "Guest", contactPhone: "123", notes: "Internal", sortOrder: 10 }];
    const config = { ...createDefaultPrintConfig(), scope: "selected", selectedDayIds: [], include: { ...createDefaultPrintConfig().include, driver: false, pickups: true, pickupContacts: false, pickupNotes: false } };
    expect(validatePrintSelection(state, config).ok).toBe(false);
    const selected = createPrintSchedule(state, { ...config, selectedDayIds: ["day-b"] });
    expect(selected.movements[0].driverId).toBe("driver-greg");
    expect(selected.drivers[0].name).toBe("");
  });
});
