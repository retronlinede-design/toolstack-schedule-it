import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";
import { createDraftFromMovement } from "../data/schema";
import { validState } from "../import/testFixtures";
import { addPickup, deletePickup, updatePickup } from "../domain/pickups";
import { validateMovementCandidate } from "../domain/scheduleValidation";
import {
  movementFromEditorDraft,
  replaceMovementInSchedule,
  updateMovementEditorDriver,
  validateMovementEditorDraft,
} from "../domain/movementEditor";
import OperationalView from "./OperationalView";
import DriverView from "./DriverView";
import ExecutiveView from "./ExecutiveView";

function viewProps(state, filter = { mode: "all" }) {
  return {
    entriesByMonth: {
      Schedule: state.movements.map((movement) => ({
        ...movement,
        day: state.scheduleDays.find((day) => day.id === movement.scheduleDayId),
      })),
    },
    profile: state.profile,
    vehicleHandoverNotes: state.vehicleHandoverNotes,
    drivers: state.drivers,
    vehicles: state.vehicles,
    scheduleDays: state.scheduleDays,
    onEdit: vi.fn(),
    onUpdateMovement: vi.fn(() => ({ ok: true, issues: [] })),
    onDelete: vi.fn(),
    enableDayFilter: true,
    initialFilterState: filter,
    initialEditingMovementId: state.movements[0].id,
    todayDate: "2026-01-01",
  };
}

describe("Operational movement editor", () => {
  it("opens directly over Operational and populates current values", () => {
    const state = validState();
    const movement = state.movements[0];
    movement.pickups = [{ id: "pickup-1", time: "07:30", location: "Hotel", address: "1 Main St", person: "Party", contactPhone: "123", notes: "Lobby", sortOrder: 10 }];
    const html = renderToStaticMarkup(<OperationalView {...viewProps(state)} />);
    expect(html).toContain('role="dialog"');
    expect(html).toContain("Edit movement");
    ["Test", "Venue", "08:00", "09:00", "Hotel", "Party", "Working-time classification"].forEach((value) => expect(html).toContain(value));
    expect(html).toContain("Save movement");
    expect(html).toContain("Cancel");
  });

  it.each([
    ["day", { mode: "day", dayId: "day-1", anchorDate: "2026-01-01" }],
    ["week", { mode: "week", anchorDate: "2026-01-01" }],
    ["month", { mode: "month", anchorDate: "2026-01-01" }],
    ["custom", { mode: "custom", customFrom: "2026-01-01", customTo: "2026-01-01", anchorDate: "2026-01-01" }],
    ["all", { mode: "all" }],
  ])("keeps the direct editor inside %s results", (_mode, filter) => {
    const state = validState();
    const html = renderToStaticMarkup(<OperationalView {...viewProps(state, filter)} />);
    expect(html).toContain("Edit movement");
    expect(html).toContain("Test");
  });

  it("keeps Edit and Delete visible and accessible without hover", () => {
    const state = validState();
    const props = viewProps(state);
    delete props.initialEditingMovementId;
    const html = renderToStaticMarkup(<OperationalView {...props} />);
    expect(html).toContain('aria-label="Edit Test"');
    expect(html).toContain('aria-label="Delete Test"');
    expect(html).not.toContain("group-hover:opacity-100");
  });

  it("does not introduce the direct editor into Driver or Executive views", () => {
    const state = validState();
    const entriesByMonth = viewProps(state).entriesByMonth;
    const driverHtml = renderToStaticMarkup(<DriverView entriesByMonth={entriesByMonth} vehicleHandoverNotes={state.vehicleHandoverNotes} drivers={state.drivers} vehicles={state.vehicles} scheduleDays={state.scheduleDays} selectedDriverId={state.movements[0].driverId} onSelectedDriverChange={vi.fn()} onEdit={vi.fn()} onDelete={vi.fn()} />);
    const executiveHtml = renderToStaticMarkup(<ExecutiveView entriesByMonth={entriesByMonth} profile={state.profile} drivers={state.drivers} vehicles={state.vehicles} onEdit={vi.fn()} onDelete={vi.fn()} />);
    expect(driverHtml).not.toContain('role="dialog"');
    expect(executiveHtml).not.toContain('role="dialog"');
  });
});

describe("shared movement editing model", () => {
  it("normalizes a draft and updates only the intended canonical movement", () => {
    const state = validState();
    state.movements.push({ ...state.movements[0], id: "movement-2", engagementDetails: "Untouched", sortOrder: 20 });
    const draft = createDraftFromMovement(state.movements[0], state.scheduleDays[0], state.profile);
    const candidate = movementFromEditorDraft({ ...draft, engagementDetails: "Updated" });
    const next = replaceMovementInSchedule(state, candidate);
    expect(next.movements[0].engagementDetails).toBe("Updated");
    expect(next.movements[1]).toBe(state.movements[1]);
    expect(state.movements[0].engagementDetails).toBe("Test");
    expect(candidate).not.toHaveProperty("missionName");
  });

  it("keeps Cancel-style drafts isolated and validation failures non-mutating", () => {
    const state = validState();
    const snapshot = structuredClone(state);
    const draft = createDraftFromMovement(state.movements[0], state.scheduleDays[0], state.profile);
    const invalid = { ...draft, driverId: "", driverStart: "", endTime: "", eventStartTime: "", eventEndTime: "", pickups: [] };
    expect(validateMovementEditorDraft(invalid)).toMatchObject({ driverId: "Driver is required.", timing: "Enter at least one timing field." });
    expect(state).toEqual(snapshot);
  });

  it("edits, adds, removes, and preserves pickup ordering through the save candidate", () => {
    const state = validState();
    let draft = createDraftFromMovement(state.movements[0], state.scheduleDays[0], state.profile);
    draft = { ...draft, pickups: addPickup(draft.pickups) };
    const firstId = draft.pickups[0].id;
    draft = { ...draft, pickups: updatePickup(draft.pickups, firstId, { time: "07:30", location: "Hotel" }) };
    draft = { ...draft, pickups: addPickup(draft.pickups) };
    const secondId = draft.pickups[1].id;
    draft = { ...draft, pickups: updatePickup(draft.pickups, secondId, { time: "07:45", location: "Office" }) };
    let candidate = movementFromEditorDraft(draft);
    expect(candidate.pickups.map((pickup) => pickup.location)).toEqual(["Hotel", "Office"]);
    candidate = movementFromEditorDraft({ ...draft, pickups: deletePickup(draft.pickups, firstId) });
    expect(candidate.pickups.map((pickup) => pickup.location)).toEqual(["Office"]);
  });

  it("preserves audience flags and supports classification and event-only timing", () => {
    const state = validState();
    const draft = createDraftFromMovement({ ...state.movements[0], audiences: { executive: false, operational: true, cg: true, marida: true, driverIds: ["driver-rory"] } }, state.scheduleDays[0], state.profile);
    const candidate = movementFromEditorDraft({ ...draft, driverStart: "", endTime: "", eventStartTime: "12:00", eventEndTime: "13:00", workClassification: "standby" });
    expect(validateMovementEditorDraft(candidate)).toEqual({});
    expect(candidate.audiences).toEqual({ executive: false, operational: true, cg: true, marida: true, driverIds: ["driver-rory"] });
    expect(candidate.workClassification).toBe("standby");
  });

  it("uses Builder-equivalent driver defaults and canonical conflict validation", () => {
    const state = validState();
    const draft = createDraftFromMovement(state.movements[0], state.scheduleDays[0], state.profile);
    const reassigned = updateMovementEditorDriver(draft, "driver-rory", state.drivers);
    expect(reassigned.driverId).toBe("driver-rory");
    expect(reassigned.audiences.driverIds).not.toContain("driver-rory");

    state.movements.push({ ...state.movements[0], id: "other", driverStart: "08:30", endTime: "09:30", vehicleId: "vehicle-bmw" });
    const candidate = movementFromEditorDraft({ ...draft, driverStart: "08:15", endTime: "08:45" });
    expect(validateMovementCandidate(state, candidate, candidate.id).blocking.some((issue) => issue.type === "DRIVER_OVERLAP")).toBe(true);
  });
});
