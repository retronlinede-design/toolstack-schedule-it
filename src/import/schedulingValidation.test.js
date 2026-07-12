import { describe, expect, it } from "vitest";
import { createMondayDemoState } from "../data/defaultData";
import { normalizeState } from "../storage/state";
import { validateScheduleBackupState } from "./backupValidator";
import { buildHtmlImportCandidate } from "./htmlCandidate";
import { validState } from "./testFixtures";

describe("scheduling backup compatibility", () => {
  it("accepts valid overnight and override metadata", () => {
    const state = validState();
    state.movements[0].continuesOvernight = true;
    state.movements[0].conflictOverrides = [{ conflictKey: "DRIVER_OVERLAP|stable", reason: "Provisional shared record", acknowledgedAt: "2026-01-01T00:00:00.000Z" }];
    expect(validateScheduleBackupState(state).ok).toBe(true);
  });

  it.each([
    ["malformed overnight", (movement) => { movement.continuesOvernight = "yes"; }],
    ["non-array overrides", (movement) => { movement.conflictOverrides = {}; }],
    ["short override reason", (movement) => { movement.conflictOverrides = [{ conflictKey: "key", reason: "short" }]; }],
    ["invalid acknowledged time", (movement) => { movement.conflictOverrides = [{ conflictKey: "key", reason: "Long enough reason", acknowledgedAt: "never" }]; }],
    ["duplicate override key", (movement) => { movement.conflictOverrides = [{ conflictKey: "key", reason: "Long enough reason" }, { conflictKey: "key", reason: "Another valid reason" }]; }],
  ])("rejects %s", (_label, mutate) => {
    const state = validState(); mutate(state.movements[0]);
    expect(validateScheduleBackupState(state).ok).toBe(false);
  });

  it("defaults legacy movements safely", () => {
    const state = validState(); delete state.movements[0].continuesOvernight; delete state.movements[0].conflictOverrides;
    expect(validateScheduleBackupState(state).ok).toBe(true);
    expect(normalizeState(state).movements[0]).toMatchObject({ continuesOvernight: false, conflictOverrides: [] });
  });

  it("gives HTML and demo movements explicit defaults", () => {
    const current = validState();
    const parsed = { scheduleDayDraft: { date: "2026-02-01", title: "HTML" }, driversToAdd: [], vehiclesToAdd: [], errors: [], movements: [{ driverName: "Greg", vehicleName: "Vito", driverStart: "08:00", departureTime: "", arrivalTime: "", endTime: "09:00", engagementDetails: "HTML", venue: "", address: "", locationNotes: "", parking: "", participants: "", internalNotes: "", isExecutiveVisible: true, isOperationalVisible: true, audiences: { executive: true, operational: true, cg: false, marida: false, driverIds: [] } }] };
    expect(buildHtmlImportCandidate(current, parsed, "appendNewDay").candidate.movements.at(-1)).toMatchObject({ continuesOvernight: false, conflictOverrides: [] });
    createMondayDemoState().movements.forEach((movement) => expect(movement).toMatchObject({ continuesOvernight: false, conflictOverrides: [] }));
  });
});
