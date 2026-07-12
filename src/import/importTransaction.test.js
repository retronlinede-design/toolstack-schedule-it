import { describe, expect, it, vi } from "vitest";
import { replaceScheduleTransaction, rollbackScheduleTransaction } from "./importTransaction";
import { validState } from "./testFixtures";
import { memoryStorage } from "../storage/testUtils";

function changedState() {
  const state = validState();
  state.profile.missionName = "Imported Mission";
  return state;
}

describe("replacement transaction", () => {
  it("creates and verifies a snapshot before candidate write", () => {
    const storage = memoryStorage();
    const result = replaceScheduleTransaction({ currentState: validState(), candidateState: changedState(), operationType: "import", storage, primaryKey: "primary", now: () => 10, idFactory: () => "id" });
    expect(result).toMatchObject({ ok: true, snapshotKey: "primary.pre-import.10.id" });
    expect(storage.setItem.mock.calls[0][0]).toBe(result.snapshotKey);
    expect(storage.setItem.mock.calls[1][0]).toBe("primary");
    expect(result.storedState.profile.missionName).toBe("Imported Mission");
  });

  it("aborts when snapshot creation fails", () => {
    const storage = { getItem: vi.fn(), setItem: () => { throw new Error("quota"); } };
    expect(replaceScheduleTransaction({ currentState: validState(), candidateState: changedState(), operationType: "import", storage, primaryKey: "primary" })).toMatchObject({ ok: false, errorCode: "SNAPSHOT_FAILED" });
  });

  it("preserves the current state and snapshot when candidate write fails", () => {
    const storage = memoryStorage({ primary: JSON.stringify(validState()) });
    let writes = 0;
    storage.setItem.mockImplementation((key, value) => { writes += 1; if (writes === 2) throw new Error("candidate failed"); storage.values.set(key, value); });
    const result = replaceScheduleTransaction({ currentState: validState(), candidateState: changedState(), operationType: "import", storage, primaryKey: "primary" });
    expect(result).toMatchObject({ ok: false, errorCode: "CANDIDATE_WRITE_FAILED" });
    expect([...storage.values.keys()].some((key) => key.includes("pre-import"))).toBe(true);
    expect(JSON.parse(storage.values.get("primary")).profile.missionName).not.toBe("Imported Mission");
  });

  it("aborts on candidate read-back mismatch", () => {
    const storage = memoryStorage();
    const normalGet = storage.getItem;
    storage.getItem = vi.fn((key) => key === "primary" ? "mismatch" : normalGet(key));
    expect(replaceScheduleTransaction({ currentState: validState(), candidateState: changedState(), operationType: "import", storage, primaryKey: "primary" })).toMatchObject({ ok: false, errorCode: "CANDIDATE_VERIFY_FAILED" });
  });

  it("restores current primary after post-write validation failure", () => {
    const candidate = changedState();
    candidate.toJSON = () => ({});
    const storage = memoryStorage({ primary: JSON.stringify(validState()) });
    const result = replaceScheduleTransaction({ currentState: validState(), candidateState: candidate, operationType: "import", storage, primaryKey: "primary" });
    expect(result).toMatchObject({ ok: false, errorCode: "CANDIDATE_VERIFY_FAILED", restoration: { ok: true } });
    expect(JSON.parse(storage.values.get("primary")).profile.missionName).not.toBe("Imported Mission");
  });

  it("rolls back while retaining pre-import and pre-rollback generations", () => {
    const storage = memoryStorage();
    const current = validState();
    const replacement = replaceScheduleTransaction({ currentState: current, candidateState: changedState(), operationType: "import", storage, primaryKey: "primary" });
    const rollback = rollbackScheduleTransaction({ snapshotKey: replacement.snapshotKey, currentState: replacement.storedState, storage, primaryKey: "primary" });
    expect(rollback.ok).toBe(true);
    expect(rollback.storedState).toEqual(current);
    expect(storage.values.has(replacement.snapshotKey)).toBe(true);
    expect([...storage.values.keys()].some((key) => key.includes("pre-rollback"))).toBe(true);
  });

  it("failed rollback preserves the original snapshot", () => {
    const storage = memoryStorage({ snapshot: JSON.stringify(validState()) });
    storage.setItem.mockImplementation(() => { throw new Error("quota"); });
    const result = rollbackScheduleTransaction({ snapshotKey: "snapshot", currentState: changedState(), storage, primaryKey: "primary" });
    expect(result.ok).toBe(false);
    expect(storage.values.get("snapshot")).toBe(JSON.stringify(validState()));
  });
});
