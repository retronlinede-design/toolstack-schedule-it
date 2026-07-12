import { describe, expect, it } from "vitest";
import { defaultScheduleState } from "../data/defaultData";
import { migrateLegacyTransaction } from "./migration";
import { migrateRouteNotesToImportantInfo } from "./routeMigration";
import { normalizeState } from "./state";
import { memoryStorage } from "./testUtils";

const keys = { primaryKey: "primary", formKey: "form", entriesKey: "entries" };
const formRaw = JSON.stringify({ missionName: "Mission", documentTitle: "Programme" });
const entriesRaw = JSON.stringify([
  { date: "2026-01-01", engagementDetails: "One", driverStart: "08:00" },
  { date: "2026-01-01", engagementDetails: "Two", endTime: "10:00" },
]);

describe("legacy transaction", () => {
  it("writes and verifies primary, backs up exact sources, and preserves same-date movements once", () => {
    const storage = memoryStorage({ form: formRaw, entries: entriesRaw });
    const result = migrateLegacyTransaction({ storage, ...keys, now: () => 10, idFactory: (prefix) => `${prefix}-id` });
    expect(result).toMatchObject({ ok: true, status: "migrated" });
    expect(result.value.scheduleDays).toHaveLength(1);
    expect(result.value.movements).toHaveLength(2);
    expect(result.backups.map((item) => item.raw)).toEqual([formRaw, entriesRaw]);
    expect(storage.values.get("form")).toBe(formRaw);
    expect(storage.values.get("entries")).toBe(entriesRaw);
  });

  it.each([["form", "{"], ["entries", "{"]])("blocks corrupt %s safely", (key, raw) => {
    const storage = memoryStorage({ form: formRaw, entries: entriesRaw, [key]: raw });
    const result = migrateLegacyTransaction({ storage, ...keys });
    expect(result).toMatchObject({ ok: false, status: "migration-failed" });
    expect(storage.values.get(key)).toBe(raw);
    expect(storage.values.has("primary")).toBe(false);
  });

  it("leaves legacy sources intact after primary write or read-back failure", () => {
    const storage = memoryStorage({ form: formRaw, entries: entriesRaw });
    storage.setItem.mockImplementation((key, value) => { if (key !== "primary") storage.values.set(key, value); });
    const result = migrateLegacyTransaction({ storage, ...keys });
    expect(result).toMatchObject({ ok: false, status: "migration-failed", code: "READBACK_FAILED" });
    expect(storage.values.get("form")).toBe(formRaw);
    expect(storage.values.get("entries")).toBe(entriesRaw);
  });

  it("is idempotent once a verified primary exists", async () => {
    const storage = memoryStorage({ form: formRaw, entries: entriesRaw });
    const first = migrateLegacyTransaction({ storage, ...keys });
    expect(first.ok).toBe(true);
    const { initializeScheduleStorage, APP_KEY, LEGACY_FORM_KEY, LEGACY_ENTRIES_KEY } = await import("../utils/storage");
    storage.values.set(APP_KEY, storage.values.get("primary"));
    storage.values.set(LEGACY_FORM_KEY, formRaw);
    storage.values.set(LEGACY_ENTRIES_KEY, entriesRaw);
    const second = initializeScheduleStorage(storage);
    expect(second).toMatchObject({ ok: true, status: "found" });
    expect(second.value.movements).toHaveLength(2);
  });
});

describe("route-note migration", () => {
  it("creates unique deterministic IDs for duplicate legacy route IDs", () => {
    const routes = [{ id: "same", from: "A", notes: "exact one" }, { id: "same", from: "B", notes: "exact two" }];
    const first = migrateRouteNotesToImportantInfo(routes, [], []);
    const second = migrateRouteNotesToImportantInfo(routes, [], []);
    expect(first).toEqual(second);
    expect(new Set(first.map((item) => item.id)).size).toBe(2);
    expect(first[0].notes).toContain("exact one");
    expect(first[1].notes).toContain("exact two");
  });

  it("does not duplicate route notes during repeated normalization", () => {
    const state = { ...defaultScheduleState, importantInfoItems: undefined, routeNotes: [{ id: "r", from: "A", to: "B" }] };
    const once = normalizeState(state);
    const twice = normalizeState(once);
    expect(twice.importantInfoItems).toEqual(once.importantInfoItems);
    expect(twice.importantInfoItems).toHaveLength(1);
  });
});
