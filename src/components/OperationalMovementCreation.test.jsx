import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";
import { validState } from "../import/testFixtures";
import { addPickup, updatePickup } from "../domain/pickups";
import {
  createMovementInSchedule,
  createOperationalMovementDraft,
} from "../domain/movementEditor";
import DriverView from "./DriverView";
import ExecutiveView from "./ExecutiveView";
import OperationalView from "./OperationalView";

function entriesByMonth(state) {
  return {
    Schedule: state.movements.map((movement) => ({
      ...movement,
      day: state.scheduleDays.find((day) => day.id === movement.scheduleDayId),
    })),
  };
}

function validCreateDraft(state, overrides = {}) {
  return {
    ...createOperationalMovementDraft(state, "day-1", "movement-new"),
    driverStart: "10:00",
    endTime: "11:00",
    engagementDetails: "New movement",
    venue: "New venue",
    ...overrides,
  };
}

function viewProps(state, filter, initialCreatingDraft = null) {
  return {
    entriesByMonth: entriesByMonth(state),
    profile: state.profile,
    vehicleHandoverNotes: state.vehicleHandoverNotes,
    drivers: state.drivers,
    vehicles: state.vehicles,
    scheduleDays: state.scheduleDays,
    onEdit: vi.fn(),
    onUpdateMovement: vi.fn(),
    onCreateMovementDraft: vi.fn((dayId) => createOperationalMovementDraft(state, dayId, "movement-new")),
    onCreateMovement: vi.fn(),
    onDelete: vi.fn(),
    onCreateOperationalBreak: vi.fn(),
    enableDayFilter: true,
    initialFilterState: filter,
    initialCreatingDraft,
    todayDate: "2026-01-01",
  };
}

describe("Operational movement creation UI", () => {
  it("shows a visible, touch-friendly Add Movement action in live Operational", () => {
    const state = validState();
    const html = renderToStaticMarkup(<OperationalView {...viewProps(state, { mode: "day", dayId: "day-1", anchorDate: "2026-01-01" })} />);
    expect(html).toContain("Add Movement");
    expect(html).toContain('aria-label="Add movement to Thu 1 Jan 2026');
    expect(html).toContain("min-h-11");
  });

  it("opens create mode in the shared editor with the Day-mode day preselected", () => {
    const state = validState();
    const draft = validCreateDraft(state);
    const html = renderToStaticMarkup(<OperationalView {...viewProps(state, { mode: "day", dayId: "day-1", anchorDate: "2026-01-01" }, draft)} />);
    expect(html).toContain('role="dialog"');
    expect(html).toContain("Add movement");
    expect(html).toMatch(/<option value="day-1" selected="">2026-01-01 - Day<\/option>/);
    expect(html).toContain("New movement");
  });

  it("requires explicit target-day selection when creation starts from a broader mode", () => {
    const state = validState();
    state.scheduleDays.push({ id: "day-2", date: "2026-01-02", title: "Second day" });
    const draft = createOperationalMovementDraft(state, "", "movement-new");
    const html = renderToStaticMarkup(<OperationalView {...viewProps(state, { mode: "week", anchorDate: "2026-01-01" }, draft)} />);
    expect(html).toContain("Choose a schedule day, then complete the movement details.");
    expect(html).toMatch(/<option value="" selected="">Select schedule day<\/option>/);
    expect(html).toContain("2026-01-01 - Day");
    expect(html).toContain("2026-01-02 - Second day");
  });

  it.each([
    ["day", { mode: "day", dayId: "day-1", anchorDate: "2026-01-01" }],
    ["week", { mode: "week", anchorDate: "2026-01-01" }],
    ["month", { mode: "month", anchorDate: "2026-01-01" }],
    ["custom", { mode: "custom", customFrom: "2026-01-01", customTo: "2026-01-01", anchorDate: "2026-01-01" }],
    ["all", { mode: "all" }],
  ])("keeps create mode inside the active %s filter", (_mode, filter) => {
    const state = validState();
    const targetDay = filter.mode === "day" ? "day-1" : "";
    const draft = createOperationalMovementDraft(state, targetDay, "movement-new");
    const html = renderToStaticMarkup(<OperationalView {...viewProps(state, filter, draft)} />);
    expect(html).toContain('role="dialog"');
    expect(html).toMatch(new RegExp(`aria-pressed="true"[^>]*>${filter.mode[0].toUpperCase() + filter.mode.slice(1)}</button>`));
  });

  it("does not expose creation in Driver or Executive and leaves Add Break available", () => {
    const state = validState();
    const common = { entriesByMonth: entriesByMonth(state), drivers: state.drivers, vehicles: state.vehicles, onEdit: vi.fn(), onDelete: vi.fn() };
    const driverHtml = renderToStaticMarkup(<DriverView {...common} vehicleHandoverNotes={state.vehicleHandoverNotes} scheduleDays={state.scheduleDays} selectedDriverId={state.movements[0].driverId} onSelectedDriverChange={vi.fn()} />);
    const executiveHtml = renderToStaticMarkup(<ExecutiveView {...common} profile={state.profile} />);
    const operationalHtml = renderToStaticMarkup(<OperationalView {...viewProps(state, { mode: "day", dayId: "day-1", anchorDate: "2026-01-01" })} />);
    expect(driverHtml).not.toContain("Add Movement");
    expect(executiveHtml).not.toContain("Add Movement");
    expect(operationalHtml).toContain("Add Break");
  });
});

describe("canonical Operational movement creation", () => {
  it("uses current defaults and appends exactly one movement with the next day sortOrder", () => {
    const state = validState();
    const draft = validCreateDraft(state);
    expect(draft).toMatchObject({ id: "movement-new", scheduleDayId: "day-1", driverId: "driver-rory", vehicleId: "vehicle-bmw", workClassification: "active", pickups: [] });
    const result = createMovementInSchedule(state, draft);
    expect(result.ok).toBe(true);
    expect(result.schedule.movements).toHaveLength(state.movements.length + 1);
    expect(result.movement).toMatchObject({ id: "movement-new", scheduleDayId: "day-1", sortOrder: 20 });
    expect(state.movements).toHaveLength(1);
  });

  it("creates nothing on cancel-style abandonment, validation failure, or conflict rejection", () => {
    const state = validState();
    const snapshot = structuredClone(state);
    createOperationalMovementDraft(state, "day-1", "unused-id");
    expect(state).toEqual(snapshot);

    const invalid = createMovementInSchedule(state, validCreateDraft(state, { driverStart: "", endTime: "", eventStartTime: "", eventEndTime: "" }));
    expect(invalid.ok).toBe(false);
    expect(invalid.schedule).toBe(state);

    const conflictDraft = validCreateDraft(state, { driverId: "driver-greg", vehicleId: "vehicle-vito", driverStart: "08:15", endTime: "08:45" });
    const conflict = createMovementInSchedule(state, conflictDraft);
    expect(conflict.ok).toBe(false);
    expect(conflict.schedule).toBe(state);
    expect(conflict.issues.some((issue) => issue.type === "DRIVER_OVERLAP")).toBe(true);
    expect(state).toEqual(snapshot);
  });

  it("supports conflict overrides using the stable App-issued movement ID", () => {
    const state = validState();
    const draft = validCreateDraft(state, { driverId: "driver-greg", vehicleId: "vehicle-vito", driverStart: "08:15", endTime: "08:45" });
    const rejected = createMovementInSchedule(state, draft);
    const conflictOverrides = rejected.issues
      .filter((issue) => ["DRIVER_OVERLAP", "VEHICLE_OVERLAP"].includes(issue.type) && issue.severity === "error")
      .map((issue) => ({ conflictKey: issue.conflictKey, reason: "Approved shared duty overlap", acknowledgedAt: "2026-01-01T00:00:00.000Z" }));
    const accepted = createMovementInSchedule(state, { ...draft, conflictOverrides });
    expect(accepted.ok).toBe(true);
    expect(accepted.movement.conflictOverrides).toHaveLength(2);
  });

  it("preserves event-only timing, pickups and ordering, audiences, and work classification", () => {
    const state = validState();
    let pickups = addPickup([]);
    pickups = updatePickup(pickups, pickups[0].id, { time: "09:15", location: "Hotel" });
    pickups = addPickup(pickups);
    pickups = updatePickup(pickups, pickups[1].id, { time: "09:30", location: "Office" });
    const audiences = { executive: false, operational: true, cg: true, marida: false, driverIds: ["driver-greg"] };
    const draft = validCreateDraft(state, { driverStart: "", endTime: "", eventStartTime: "10:00", eventEndTime: "11:00", pickups, audiences, isExecutiveVisible: false, isOperationalVisible: true, workClassification: "standby" });
    const result = createMovementInSchedule(state, draft);
    expect(result.ok).toBe(true);
    expect(result.movement).toMatchObject({ eventStartTime: "10:00", eventEndTime: "11:00", audiences, workClassification: "standby" });
    expect(result.movement.pickups.map((pickup) => [pickup.location, pickup.sortOrder])).toEqual([["Hotel", 10], ["Office", 20]]);
  });
});
