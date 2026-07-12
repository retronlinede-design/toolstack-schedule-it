import { describe, expect, it, vi } from "vitest";
import { createMondayDemoState } from "../data/defaultData";
import { createClearCandidate } from "./operationCandidates";
import { replaceScheduleTransaction, rollbackScheduleTransaction } from "./importTransaction";
import { validState } from "./testFixtures";
import { memoryStorage } from "../storage/testUtils";

describe("demo and clear transactions", () => {
  it.each([["demo", createMondayDemoState()], ["clear", createClearCandidate(validState())]])("%s creates a snapshot and supports rollback", (operationType, candidate) => {
    const current = validState();
    const storage = memoryStorage();
    const replacement = replaceScheduleTransaction({ currentState: current, candidateState: candidate, operationType, storage, primaryKey: "primary" });
    expect(replacement.ok).toBe(true);
    expect(replacement.snapshotKey).toContain(`pre-${operationType}`);
    expect(rollbackScheduleTransaction({ snapshotKey: replacement.snapshotKey, currentState: replacement.storedState, storage, primaryKey: "primary" }).storedState).toEqual(current);
  });

  it("clear preserves drivers and vehicles while clearing documented records", () => {
    const current = validState();
    const cleared = createClearCandidate(current);
    expect(cleared.drivers).toEqual(current.drivers);
    expect(cleared.vehicles).toEqual(current.vehicles);
    expect(cleared.scheduleDays).toEqual([]);
    expect(cleared.movements).toEqual([]);
  });

  it("failed snapshot aborts demo and clear", () => {
    const storage = { getItem: vi.fn(), setItem: () => { throw new Error("quota"); } };
    for (const [type, candidate] of [["demo", createMondayDemoState()], ["clear", createClearCandidate(validState())]]) {
      expect(replaceScheduleTransaction({ currentState: validState(), candidateState: candidate, operationType: type, storage, primaryKey: "primary" })).toMatchObject({ ok: false, errorCode: "SNAPSHOT_FAILED" });
    }
  });
});
