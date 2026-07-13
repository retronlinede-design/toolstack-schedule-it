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
  state.movements = state.scheduleDays.map((day, index) => ({ ...state.movements[0], id: `movement-${index}`, scheduleDayId: day.id, engagementDetails: `Engagement ${day.id}` }));
  return state;
}

describe("simple print day selection", () => {
  it("sorts chronologically and preserves duplicate-date days", () => {
    expect(chronologicalDays(multiDayState()).map((day) => day.id)).toEqual(["day-a", "day-a2", "day-b"]);
  });

  it("supports all, current, and selected day scopes", () => {
    const state = multiDayState();
    const base = createDefaultPrintConfig();
    expect(selectPrintDays(state, base).map((day) => day.id)).toEqual(["day-a", "day-a2", "day-b"]);
    expect(selectPrintDays(state, { ...base, scope: "current", currentDayId: "day-b" }).map((day) => day.id)).toEqual(["day-b"]);
    expect(selectPrintDays(state, { ...base, scope: "selected", selectedDayIds: ["day-b", "day-a"] }).map((day) => day.id)).toEqual(["day-a", "day-b"]);
  });

  it("reports empty selections and applies broad detail choices without altering assignments", () => {
    const state = multiDayState();
    Object.assign(state.movements[0], { address: "Address", participants: "Guests", parking: "Rear", locationNotes: "Call ahead", pickups: [{ id: "p", time: "07:00", location: "Hotel", address: "Pickup address", person: "Guest", contactPhone: "123", notes: "Internal", sortOrder: 10 }] });
    const base = createDefaultPrintConfig();
    expect(validatePrintSelection(state, { ...base, scope: "selected", selectedDayIds: [] }).ok).toBe(false);
    const selected = createPrintSchedule(state, { ...base, scope: "selected", selectedDayIds: ["day-b"], include: { ...base.include, addresses: false, participants: false, parkingNotes: false } });
    expect(selected.movements[0]).toMatchObject({ driverId: "driver-greg", address: "", participants: "", parking: "", locationNotes: "" });
    expect(selected.movements[0].pickups[0]).toMatchObject({ address: "", notes: "", contactPhone: "123" });
    expect(selected.drivers[0].name).toBe("Greg");
  });
});
