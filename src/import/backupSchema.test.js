import { describe, expect, it } from "vitest";
import { createFullBackup, fullBackupFilename, identifyBackup, parseBackupText } from "./backupSchema";
import { prepareBackupImport } from "./prepareBackup";
import { validState } from "./testFixtures";

describe("backup identification", () => {
  it("accepts current and positively identified legacy full backups", () => {
    expect(identifyBackup(createFullBackup(validState()))).toMatchObject({ ok: true, type: "current" });
    expect(identifyBackup(validState())).toMatchObject({ ok: true, type: "legacy", label: "Legacy Schedule-It backup", migrationRequired: true });
  });

  it.each([
    ["wrong app", { metadata: { appId: "other", exportType: "full-backup", schemaVersion: 1 }, data: {} }, "WRONG_APP"],
    ["future version", { metadata: { appId: "scheduleit", exportType: "full-backup", schemaVersion: 2 }, data: {} }, "UNSUPPORTED_VERSION"],
    ["report", { metadata: { appId: "scheduleit", exportType: "report-html", schemaVersion: 1 }, data: {} }, "REPORT_NOT_RESTORABLE"],
    ["unknown export", { metadata: { appId: "scheduleit", exportType: "mystery", schemaVersion: 1 }, data: {} }, "UNKNOWN_EXPORT_TYPE"],
    ["unknown json", { movements: [], scheduleDays: [] }, "UNKNOWN_JSON"],
  ])("rejects %s", (_label, value, code) => expect(identifyBackup(value)).toMatchObject({ ok: false, code }));

  it("rejects malformed and oversized input", () => {
    expect(parseBackupText("{")).toMatchObject({ ok: false, code: "INVALID_JSON" });
    expect(parseBackupText("{}", 10 * 1024 * 1024 + 1)).toMatchObject({ ok: false, code: "FILE_TOO_LARGE" });
  });

  it("exports metadata, filename, and round-trips every field", () => {
    const state = validState();
    state.movements[0] = {
      ...state.movements[0],
      continuesOvernight: true,
      workClassification: "standby",
      audiences: { executive: true, operational: true, cg: true, marida: false, driverIds: [] },
      conflictOverrides: [{ conflictKey: "DRIVER_OVERLAP|stable", reason: "Approved shared standby record", acknowledgedAt: "2026-07-12T09:00:00.000Z" }],
    };
    const backup = createFullBackup(state, { now: () => new Date("2026-07-12T10:00:00.000Z"), appVersion: "1.2.3" });
    expect(backup.metadata).toEqual({ appId: "scheduleit", exportType: "full-backup", schemaVersion: 1, exportedAt: "2026-07-12T10:00:00.000Z", appVersion: "1.2.3" });
    expect(fullBackupFilename(new Date("2026-07-12T10:00:00.000Z"))).toBe("schedule-it-full-backup-2026-07-12.json");
    const prepared = prepareBackupImport({ raw: JSON.stringify(backup), currentState: state });
    expect(prepared.ok).toBe(true);
    expect(prepared.candidate).toEqual(state);
    expect(prepared.candidate.movements[0]).toMatchObject({
      continuesOvernight: true,
      workClassification: "standby",
      audiences: state.movements[0].audiences,
      conflictOverrides: state.movements[0].conflictOverrides,
    });
  });
});
