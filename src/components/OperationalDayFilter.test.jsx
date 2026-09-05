import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";
import { getExportDocument } from "../utils/exportHtml";
import { validState } from "../import/testFixtures";
import DriverView from "./DriverView";
import OperationalView, { OperationalDayFilter } from "./OperationalView";
import {
  ALL_OPERATIONAL_DAYS,
  adjacentOperationalDayId,
  chronologicalScheduleDays,
  filterOperationalDayGroups,
  operationalDayLabel,
  resolveOperationalDayId,
} from "./operationalDayFilter";

function fixture() {
  const state = validState();
  state.scheduleDays = [
    { id: "later", date: "2026-09-08", title: "Berlin" },
    { id: "first", date: "2026-09-07", title: "Munich" },
  ];
  state.movements = [
    { ...state.movements[0], id: "movement-first", scheduleDayId: "first", engagementDetails: "Munich movement" },
    { ...state.movements[0], id: "movement-later", scheduleDayId: "later", engagementDetails: "Berlin movement" },
  ];
  state.vehicleHandoverNotes = [
    { ...state.vehicleHandoverNotes[0], id: "handover-first", scheduleDayId: "first", notes: "Munich handover" },
    { ...state.vehicleHandoverNotes[0], id: "handover-later", scheduleDayId: "later", notes: "Berlin handover" },
  ];
  return state;
}

describe("Operational day filter", () => {
  it("orders and labels schedule days chronologically", () => {
    const ordered = chronologicalScheduleDays(fixture().scheduleDays);
    expect(ordered.map((day) => day.id)).toEqual(["first", "later"]);
    expect(operationalDayLabel(ordered[0])).toBe("Mon 7 Sep 2026 — Munich");
  });

  it("renders All Days by default and disables Previous and Next", () => {
    const state = fixture();
    const ordered = chronologicalScheduleDays(state.scheduleDays);
    const html = renderToStaticMarkup(<OperationalDayFilter orderedDays={ordered} selectedDayId={ALL_OPERATIONAL_DAYS} onChange={vi.fn()} />);
    const operationalHtml = renderToStaticMarkup(
      <OperationalView
        entriesByMonth={{ September: state.movements.map((movement) => ({ ...movement, day: state.scheduleDays.find((day) => day.id === movement.scheduleDayId) })) }}
        vehicleHandoverNotes={state.vehicleHandoverNotes}
        drivers={state.drivers}
        vehicles={state.vehicles}
        scheduleDays={state.scheduleDays}
        onEdit={vi.fn()}
        onDelete={vi.fn()}
        enableDayFilter
      />,
    );
    expect(html).toContain("All Days");
    expect(html).toContain("Mon 7 Sep 2026 — Munich");
    expect(html.match(/disabled=""/g)).toHaveLength(2);
    expect(operationalHtml).toContain("Munich movement");
    expect(operationalHtml).toContain("Berlin movement");
    expect(operationalHtml).toContain("Munich handover");
    expect(operationalHtml).toContain("Berlin handover");
  });

  it("filters movements, handovers, and driver groups to one day without changing source data", () => {
    const groups = [
      { key: "first", day: { id: "first" }, driverGroups: [{ key: "driver-one" }], handovers: ["Munich handover"] },
      { key: "later", day: { id: "later" }, driverGroups: [{ key: "driver-two" }], handovers: ["Berlin handover"] },
    ];
    const snapshot = structuredClone(groups);
    expect(filterOperationalDayGroups(groups, ALL_OPERATIONAL_DAYS)).toEqual(groups);
    expect(filterOperationalDayGroups(groups, "first")).toEqual([groups[0]]);
    expect(filterOperationalDayGroups(groups, "first")[0].handovers).toEqual(["Munich handover"]);
    expect(groups).toEqual(snapshot);
  });

  it("moves between chronological days and disables the boundary direction", () => {
    const ordered = chronologicalScheduleDays(fixture().scheduleDays);
    expect(adjacentOperationalDayId("first", ordered, 1)).toBe("later");
    expect(adjacentOperationalDayId("later", ordered, -1)).toBe("first");

    const firstHtml = renderToStaticMarkup(<OperationalDayFilter orderedDays={ordered} selectedDayId="first" onChange={vi.fn()} />);
    const lastHtml = renderToStaticMarkup(<OperationalDayFilter orderedDays={ordered} selectedDayId="later" onChange={vi.fn()} />);
    expect(firstHtml.match(/disabled=""/g)).toHaveLength(1);
    expect(firstHtml).toMatch(/<button[^>]+disabled=""[^>]+aria-label="Previous Day"/);
    expect(lastHtml).toMatch(/<button[^>]+disabled=""[^>]+aria-label="Next Day"/);
  });

  it("falls back to All Days when the selected day disappears", () => {
    const ordered = chronologicalScheduleDays(fixture().scheduleDays);
    expect(resolveOperationalDayId("first", ordered)).toBe("first");
    expect(resolveOperationalDayId("first", ordered.filter((day) => day.id !== "first"))).toBe(ALL_OPERATIONAL_DAYS);
  });

  it("shows only the selected day's movements, handovers, driver groups, and Add Break controls", () => {
    const state = fixture();
    const scheduleSnapshot = structuredClone(state);
    const entriesByMonth = {
      September: state.movements.map((movement) => ({ ...movement, day: state.scheduleDays.find((day) => day.id === movement.scheduleDayId) })),
    };
    const html = renderToStaticMarkup(
      <OperationalView
        entriesByMonth={entriesByMonth}
        vehicleHandoverNotes={state.vehicleHandoverNotes}
        drivers={state.drivers}
        vehicles={state.vehicles}
        scheduleDays={state.scheduleDays}
        onEdit={vi.fn()}
        onDelete={vi.fn()}
        onCreateOperationalBreak={vi.fn()}
        enableDayFilter
        initialDayId="first"
      />,
    );
    expect(html).toContain("Munich movement");
    expect(html).toContain("Munich handover");
    expect(html).toContain("Greg / Vito");
    expect(html).toContain("Add Break");
    expect(html).not.toContain("Berlin movement");
    expect(html).not.toContain("Berlin handover");
    expect(state).toEqual(scheduleSnapshot);
  });

  it("leaves Driver rendering and standalone Operational export unfiltered", () => {
    const state = fixture();
    const entriesByMonth = {
      September: state.movements.map((movement) => ({ ...movement, day: state.scheduleDays.find((day) => day.id === movement.scheduleDayId) })),
    };
    const driverHtml = renderToStaticMarkup(
      <DriverView entriesByMonth={entriesByMonth} vehicleHandoverNotes={state.vehicleHandoverNotes} drivers={state.drivers} vehicles={state.vehicles} scheduleDays={state.scheduleDays} selectedDriverId={state.movements[0].driverId} onSelectedDriverChange={vi.fn()} onEdit={vi.fn()} onDelete={vi.fn()} />,
    );
    const exportHtml = getExportDocument(state, "operational").fullHtml;
    expect(driverHtml).not.toContain("Operational day filter");
    expect(driverHtml).toContain("Munich movement");
    expect(driverHtml).toContain("Berlin movement");
    expect(exportHtml).toContain("Munich movement");
    expect(exportHtml).toContain("Berlin movement");
    expect(exportHtml).not.toContain("Operational day filter");
  });
});
