import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";
import { getExportDocument } from "../utils/exportHtml";
import { validState } from "../import/testFixtures";
import DriverView from "./DriverView";
import OperationalView, { OperationalDateNavigation } from "./OperationalView";
import PreviewTabs from "./PreviewTabs";
import {
  changeOperationalFilterMode,
  chronologicalScheduleDays,
  createInitialOperationalFilter,
  filterOperationalDayGroups,
  matchingOperationalDayIds,
  navigateOperationalFilter,
  operationalDayLabel,
  operationalFilterRange,
  operationalPeriodLabel,
  reconcileOperationalFilter,
  selectInitialOperationalDayId,
} from "./operationalDayFilter";

const TODAY = "2026-09-05";

function fixture() {
  const state = validState();
  state.scheduleDays = [
    { id: "october", date: "2026-10-02", title: "Hamburg" },
    { id: "next-week", date: "2026-09-14", title: "Cologne" },
    { id: "sunday", date: "2026-09-13", title: "Stuttgart" },
    { id: "tuesday", date: "2026-09-08", title: "Berlin" },
    { id: "monday", date: "2026-09-07", title: "Munich" },
  ];
  state.movements = state.scheduleDays.map((day, index) => ({
    ...state.movements[0],
    id: `movement-${day.id}`,
    scheduleDayId: day.id,
    sortOrder: (index + 1) * 10,
    engagementDetails: `${day.title} movement`,
  }));
  state.movements[1] = { ...state.movements[1], driverId: "driver-rory", vehicleId: "vehicle-bmw" };
  state.vehicleHandoverNotes = state.scheduleDays.map((day, index) => ({
    ...state.vehicleHandoverNotes[0],
    id: `handover-${day.id}`,
    scheduleDayId: day.id,
    notes: `${day.title} handover`,
    sortOrder: (index + 1) * 10,
  }));
  return state;
}

function entriesByMonth(state) {
  return {
    Schedule: state.movements.map((movement) => ({
      ...movement,
      day: state.scheduleDays.find((day) => day.id === movement.scheduleDayId),
    })),
  };
}

function baseFilter(overrides = {}) {
  return {
    mode: "day",
    dayId: "monday",
    anchorDate: "2026-09-07",
    customFrom: "2026-09-07",
    customTo: "2026-09-07",
    ...overrides,
  };
}

function viewProps(state) {
  return {
    entriesByMonth: entriesByMonth(state),
    vehicleHandoverNotes: state.vehicleHandoverNotes,
    drivers: state.drivers,
    vehicles: state.vehicles,
    scheduleDays: state.scheduleDays,
    onEdit: vi.fn(),
    onDelete: vi.fn(),
  };
}

describe("Operational date navigation model", () => {
  it("orders and labels schedule days chronologically", () => {
    const ordered = chronologicalScheduleDays(fixture().scheduleDays);
    expect(ordered.map((day) => day.id)).toEqual(["monday", "tuesday", "sunday", "next-week", "october"]);
    expect(operationalDayLabel(ordered[0])).toBe("Mon 7 Sep 2026 — Munich");
  });

  it("defaults to Day and selects today when present", () => {
    const state = fixture();
    state.scheduleDays.push({ id: "today", date: TODAY, title: "Today" });
    expect(createInitialOperationalFilter(state.scheduleDays, TODAY)).toMatchObject({ mode: "day", dayId: "today", anchorDate: TODAY });
  });

  it("selects the nearest future day when today is absent", () => {
    expect(selectInitialOperationalDayId(fixture().scheduleDays, TODAY)).toBe("monday");
  });

  it("selects the latest day when no future day exists and handles no days", () => {
    const days = [{ id: "old", date: "2026-01-01" }, { id: "latest", date: "2026-02-01" }];
    expect(selectInitialOperationalDayId(days, TODAY)).toBe("latest");
    expect(selectInitialOperationalDayId([], TODAY)).toBe("");
  });

  it("filters Day and navigates only through available chronological schedule days", () => {
    const days = fixture().scheduleDays;
    expect([...matchingOperationalDayIds(days, baseFilter())]).toEqual(["monday"]);
    expect(navigateOperationalFilter(baseFilter(), days, 1)).toMatchObject({ dayId: "tuesday", anchorDate: "2026-09-08" });
    expect(navigateOperationalFilter(baseFilter({ dayId: "tuesday", anchorDate: "2026-09-08" }), days, -1)).toMatchObject({ dayId: "monday" });
  });

  it("filters a Monday-Sunday week and moves by one calendar week", () => {
    const days = fixture().scheduleDays;
    const week = baseFilter({ mode: "week" });
    expect(operationalFilterRange(week)).toEqual({ valid: true, startDate: "2026-09-07", endDate: "2026-09-13" });
    expect([...matchingOperationalDayIds(days, week)]).toEqual(["sunday", "tuesday", "monday"]);
    expect(operationalPeriodLabel(week, days)).toBe("7–13 Sep 2026");
    expect(navigateOperationalFilter(week, days, 1).anchorDate).toBe("2026-09-14");
    expect(navigateOperationalFilter(week, days, -1).anchorDate).toBe("2026-08-31");
  });

  it("filters a calendar month and moves by one calendar month", () => {
    const days = fixture().scheduleDays;
    const month = baseFilter({ mode: "month" });
    expect(operationalFilterRange(month)).toEqual({ valid: true, startDate: "2026-09-01", endDate: "2026-09-30" });
    expect([...matchingOperationalDayIds(days, month)]).toEqual(["next-week", "sunday", "tuesday", "monday"]);
    expect(operationalPeriodLabel(month, days)).toBe("September 2026");
    expect(navigateOperationalFilter(month, days, 1).anchorDate).toBe("2026-10-01");
    expect(navigateOperationalFilter(month, days, -1).anchorDate).toBe("2026-08-01");
  });

  it("uses an inclusive custom range", () => {
    const days = fixture().scheduleDays;
    const custom = baseFilter({ mode: "custom", customFrom: "2026-09-08", customTo: "2026-09-14" });
    expect([...matchingOperationalDayIds(days, custom)]).toEqual(["next-week", "sunday", "tuesday"]);
  });

  it("rejects an inverted or incomplete custom range without matching data", () => {
    const days = fixture().scheduleDays;
    const inverted = baseFilter({ mode: "custom", customFrom: "2026-09-14", customTo: "2026-09-08" });
    expect(operationalFilterRange(inverted)).toMatchObject({ valid: false, error: "From date must not be after To date." });
    expect([...matchingOperationalDayIds(days, inverted)]).toEqual([]);
    expect(operationalFilterRange({ ...inverted, customFrom: "" })).toMatchObject({ valid: false });
  });

  it("shows all days in All mode and does not mutate schedule or group data when modes change", () => {
    const state = fixture();
    const snapshot = structuredClone(state);
    const groups = chronologicalScheduleDays(state.scheduleDays).map((day) => ({ key: day.id, day }));
    const all = changeOperationalFilterMode(baseFilter(), "all", state.scheduleDays, TODAY);
    expect(filterOperationalDayGroups(groups, state.scheduleDays, all)).toEqual(groups);
    expect(navigateOperationalFilter(all, state.scheduleDays, 1)).toBe(all);
    expect(state).toEqual(snapshot);
  });

  it("reselects by today's rule when the active Day disappears but leaves range modes stable", () => {
    const days = fixture().scheduleDays.filter((day) => day.id !== "monday");
    expect(reconcileOperationalFilter(baseFilter(), days, TODAY)).toMatchObject({ mode: "day", dayId: "tuesday", anchorDate: "2026-09-08" });
    const week = baseFilter({ mode: "week" });
    expect(reconcileOperationalFilter(week, days, TODAY)).toBe(week);
  });
});

describe("Operational date navigation UI and integration", () => {
  it("makes Operational the default live tab with Day as the default filter", () => {
    const state = fixture();
    const html = renderToStaticMarkup(
      <PreviewTabs
        entriesByMonth={entriesByMonth(state)} profile={state.profile} movements={state.movements}
        vehicleHandoverNotes={state.vehicleHandoverNotes} importantInfoItems={state.importantInfoItems}
        drivers={state.drivers} vehicles={state.vehicles} scheduleDays={state.scheduleDays}
        workingTimePolicy={state.workingTimePolicy} onWorkingTimePolicyChange={vi.fn()}
        selectedDriverId={state.drivers[0].id} onSelectedDriverChange={vi.fn()}
        onEdit={vi.fn()} onDelete={vi.fn()} onReorderMovements={vi.fn()}
        onCreateOperationalBreak={vi.fn()} onMoveVehicleHandoverInOperational={vi.fn()}
      />,
    );
    expect(html).toContain('aria-label="Operational date navigation"');
    expect(html).toMatch(/aria-pressed="true"[^>]*>Day<\/button>/);
    expect((html.match(/ movement/g) || []).length).toBe(1);
  });

  it("renders compact mode controls, period navigation, and custom validation", () => {
    const days = chronologicalScheduleDays(fixture().scheduleDays);
    const dayHtml = renderToStaticMarkup(<OperationalDateNavigation orderedDays={days} filter={baseFilter()} onChange={vi.fn()} todayDate={TODAY} />);
    ["Day", "Week", "Month", "Custom", "All", "Previous day", "Next day", "Mon 7 Sep 2026 — Munich"].forEach((text) => expect(dayHtml).toContain(text));
    const invalidHtml = renderToStaticMarkup(<OperationalDateNavigation orderedDays={days} filter={baseFilter({ mode: "custom", customFrom: "2026-09-14", customTo: "2026-09-08" })} onChange={vi.fn()} todayDate={TODAY} />);
    expect(invalidHtml).toContain("From date must not be after To date.");
    expect(invalidHtml).toContain('role="alert"');
  });

  it("disables Day navigation at available-day boundaries and handles no schedule days", () => {
    const days = chronologicalScheduleDays(fixture().scheduleDays);
    const firstHtml = renderToStaticMarkup(<OperationalDateNavigation orderedDays={days} filter={baseFilter()} onChange={vi.fn()} todayDate={TODAY} />);
    const lastHtml = renderToStaticMarkup(<OperationalDateNavigation orderedDays={days} filter={baseFilter({ dayId: "october", anchorDate: "2026-10-02" })} onChange={vi.fn()} todayDate={TODAY} />);
    expect(firstHtml).toMatch(/<button[^>]+disabled=""[^>]+aria-label="Previous day"/);
    expect(lastHtml).toMatch(/<button[^>]+disabled=""[^>]+aria-label="Next day"/);

    const emptyState = validState();
    emptyState.scheduleDays = [];
    emptyState.movements = [];
    emptyState.vehicleHandoverNotes = [];
    const emptyHtml = renderToStaticMarkup(<OperationalView {...viewProps(emptyState)} enableDayFilter todayDate={TODAY} />);
    expect(emptyHtml).toContain("No schedule days");
    expect(emptyHtml).toContain("No schedule days are available yet.");
  });

  it("keeps complete selected-day content, grouping, handovers, Add Break, and existing actions", () => {
    const state = fixture();
    const scheduleSnapshot = structuredClone(state);
    const html = renderToStaticMarkup(
      <OperationalView
        {...viewProps(state)} onCreateOperationalBreak={vi.fn()} onReorderMovements={vi.fn()}
        onMoveVehicleHandoverInOperational={vi.fn()} enableDayFilter todayDate={TODAY}
        initialFilterState={baseFilter({ dayId: "next-week", anchorDate: "2026-09-14" })}
      />,
    );
    expect(html).toContain("Cologne movement");
    expect(html).toContain("Cologne handover");
    expect(html).toContain("Rory / BMW");
    expect(html).toContain("Add Break");
    expect(html).toContain('title="Edit"');
    expect(html).toContain('title="Delete"');
    expect(html).toContain("Drag to reorder within this driver group");
    expect(html).not.toContain("Munich movement");
    expect(state).toEqual(scheduleSnapshot);
  });

  it("filters handovers with Week and preserves chronological day sections", () => {
    const state = fixture();
    const html = renderToStaticMarkup(<OperationalView {...viewProps(state)} enableDayFilter todayDate={TODAY} initialFilterState={baseFilter({ mode: "week" })} />);
    expect(html).toContain("Munich handover");
    expect(html).toContain("Berlin handover");
    expect(html).toContain("Stuttgart handover");
    expect(html).not.toContain("Cologne handover");
    expect(html.indexOf("Munich movement")).toBeLessThan(html.indexOf("Berlin movement"));
    expect(html.indexOf("Berlin movement")).toBeLessThan(html.indexOf("Stuttgart movement"));
  });

  it("leaves Driver and standalone Operational export/print unfiltered", () => {
    const state = fixture();
    const driverHtml = renderToStaticMarkup(<DriverView {...viewProps(state)} selectedDriverId={state.drivers[0].id} onSelectedDriverChange={vi.fn()} />);
    const output = getExportDocument(state, "operational");
    expect(driverHtml).not.toContain("Operational date navigation");
    expect(driverHtml).toContain("Munich movement");
    expect(driverHtml).toContain("Berlin movement");
    state.scheduleDays.forEach((day) => expect(output.fullHtml).toContain(`${day.title} movement`));
    expect(output.fullHtml).not.toContain("Operational date navigation");
    expect(output.styles).toMatch(/\.operational-day-section:not\(\.first-day-section\)[\s\S]*?break-before:\s*page;[\s\S]*?page-break-before:\s*always;/);
  });
});
