import { defaultScheduleState, STORAGE_KEY } from "../data/defaultData";
import { migrateLegacyTransaction } from "../storage/migration";
import { verifiedWriteSchedule } from "../storage/persistence";
import { preserveRawRecovery } from "../storage/recovery";
import { readStorageKey } from "../storage/storage";
import { normalizeState, validateScheduleState } from "../storage/state";

export { normalizeState, validateScheduleState } from "../storage/state";

export const APP_KEY = `${STORAGE_KEY}.app_v1`;
export const LEGACY_FORM_KEY = `${STORAGE_KEY}.form_v2`;
export const LEGACY_ENTRIES_KEY = `${STORAGE_KEY}.entries_v2`;
export const MIGRATION_PENDING_KEY = `${APP_KEY}.migration-pending`;

export function initializeScheduleStorage(storage = globalThis.localStorage) {
  const primary = readStorageKey(storage, APP_KEY);
  if (!primary.ok && primary.status === "unavailable") return { ok: false, status: "unavailable", error: primary.error };
  if (!primary.ok && primary.status === "corrupt") {
    const recovery = preserveRawRecovery(storage, APP_KEY, primary.raw);
    return { ok: false, status: "recovery-required", raw: primary.raw, error: primary.error, recovery };
  }
  if (primary.status === "found") {
    if (!validateScheduleState(primary.value)) {
      const recovery = preserveRawRecovery(storage, APP_KEY, primary.raw);
      return { ok: false, status: "recovery-required", raw: primary.raw, error: new Error("Primary data is not a valid Schedule-It state."), recovery };
    }
    const pending = readStorageKey(storage, MIGRATION_PENDING_KEY);
    if (!pending.ok) return { ok: false, status: "migration-failed", code: "MIGRATION_MARKER_UNAVAILABLE", message: "Migration completion could not be determined.", error: pending.error };
    if (pending.status === "missing") return { ok: true, status: "found", value: normalizeState(primary.value), raw: primary.raw };
  }

  const migration = migrateLegacyTransaction({ storage, primaryKey: APP_KEY, formKey: LEGACY_FORM_KEY, entriesKey: LEGACY_ENTRIES_KEY, pendingKey: MIGRATION_PENDING_KEY });
  if (!migration.ok) return migration;
  if (migration.status === "migrated") return { ok: true, status: "migrated", value: migration.value, migration, savedAt: migration.savedAt };
  return { ok: true, status: "new", value: normalizeState(defaultScheduleState), needsInitialSave: true };
}

export function saveScheduleState(state, storage = globalThis.localStorage) {
  return verifiedWriteSchedule(storage, APP_KEY, state);
}

export function loadScheduleState(storage = globalThis.localStorage) {
  const result = initializeScheduleStorage(storage);
  return result.ok ? result.value : null;
}

export function downloadJson(filename, data) {
  const blob = new Blob([JSON.stringify(data, null, 2)], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = filename;
  anchor.click();
  URL.revokeObjectURL(url);
}
