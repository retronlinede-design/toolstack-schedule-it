import { describe, expect, it } from "vitest";
import { buildHtmlImportCandidate } from "./htmlCandidate";
import { replaceScheduleTransaction, rollbackScheduleTransaction } from "./importTransaction";
import { validState } from "./testFixtures";
import { memoryStorage } from "../storage/testUtils";

function parsedHtml() {
  return {
    scheduleDayDraft: { date: "2026-02-01", title: "HTML Day" },
    driversToAdd: ["New Driver"], vehiclesToAdd: ["New Car"], errors: [],
    movements: [{ driverName: "New Driver", vehicleName: "New Car", driverStart: "08:00", departureTime: "", arrivalTime: "", endTime: "09:00", engagementDetails: "HTML event", venue: "Venue", address: "", locationNotes: "", parking: "", participants: "", internalNotes: "", isExecutiveVisible: true, isOperationalVisible: true, sortOrder: 10 }],
  };
}

describe("HTML candidates", () => {
  it("validates replacement and creates a rollback snapshot", () => {
    const current = validState();
    const built = buildHtmlImportCandidate(current, parsedHtml(), "replace");
    expect(built.ok).toBe(true);
    expect(built.candidate.movements[0].audiences).toEqual({ executive: true, operational: true, cg: false, marida: false, driverIds: [] });
    const storage = memoryStorage();
    const replacement = replaceScheduleTransaction({ currentState: current, candidateState: built.candidate, operationType: "html-import", storage, primaryKey: "primary" });
    expect(replacement.ok).toBe(true);
    expect(replacement.snapshotKey).toContain("pre-html-import");
    expect(rollbackScheduleTransaction({ snapshotKey: replacement.snapshotKey, currentState: replacement.storedState, storage, primaryKey: "primary" }).storedState).toEqual(current);
  });

  it("rejects invalid parsed output", () => expect(buildHtmlImportCandidate(validState(), { errors: ["bad"] }, "replace")).toMatchObject({ ok: false }));

  it("append preserves records and repeated append does not duplicate rows", () => {
    const current = validState();
    const first = buildHtmlImportCandidate(current, parsedHtml(), "appendNewDay");
    expect(first.candidate.movements).toHaveLength(current.movements.length + 1);
    expect(first.candidate.importantInfoItems).toEqual(current.importantInfoItems);
    const repeated = buildHtmlImportCandidate(first.candidate, parsedHtml(), "appendNewDay");
    expect(repeated).toMatchObject({ ok: true, duplicate: true });
    expect(repeated.candidate.movements).toHaveLength(first.candidate.movements.length);
  });
});
