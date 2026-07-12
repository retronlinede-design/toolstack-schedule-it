import { defaultScheduleState } from "../data/defaultData";
import { createMovementFromDraft, createScheduleDayFromDraft, emptyDraft } from "../data/schema";
import { normalizeState, validateScheduleState } from "./state";
import { verifiedWriteRaw, verifiedWriteSchedule } from "./persistence";
import { readStorageKey, timestampedStorageKey } from "./storage";
export { migrateRouteNotesToImportantInfo } from "./routeMigration";

function migrationFailure(code, message, sources, cause, candidate) {
  return { ok: false, status: "migration-failed", code, message, sources, cause, candidate };
}

function stablePart(value) {
  return encodeURIComponent(String(value ?? "route")).replaceAll("%", "_");
}

export function buildLegacyCandidate(legacyForm, legacyEntries) {
  const entries = Array.isArray(legacyEntries) ? legacyEntries : [];
  const profile = {
    missionName: legacyForm?.missionName || defaultScheduleState.profile.missionName,
    documentTitle: legacyForm?.documentTitle || defaultScheduleState.profile.documentTitle,
  };
  const scheduleDays = [];
  const movements = [];

  entries.forEach((entry, index) => {
    const draft = { ...emptyDraft, ...entry };
    const existingDay = scheduleDays.find((day) => day.date === draft.date);
    const day = createScheduleDayFromDraft(draft, existingDay);
    if (!existingDay) scheduleDays.push({ ...day, id: `legacy-day-${stablePart(draft.date || "undated")}-${scheduleDays.length + 1}` });
    const resolvedDay = existingDay || scheduleDays.at(-1);
    movements.push({ ...createMovementFromDraft(draft, resolvedDay.id), id: `legacy-movement-${index + 1}` });
  });

  return normalizeState({ profile, scheduleDays, movements });
}

export function migrateLegacyTransaction({ storage, primaryKey, formKey, entriesKey, pendingKey = `${primaryKey}.migration-pending`, now, idFactory }) {
  const form = readStorageKey(storage, formKey);
  const entries = readStorageKey(storage, entriesKey);
  const sources = { form, entries };

  for (const [name, source] of Object.entries(sources)) {
    if (!source.ok) return migrationFailure(`LEGACY_${name.toUpperCase()}_${source.status.toUpperCase()}`, `Legacy ${name} data is ${source.status}.`, sources, source.error);
  }
  if (form.status === "missing" && entries.status === "missing") return { ok: true, status: "missing", sources };
  if (entries.status === "found" && !Array.isArray(entries.value)) {
    return migrationFailure("LEGACY_ENTRIES_INVALID", "Legacy entries data is not an array.", sources);
  }

  const candidate = buildLegacyCandidate(form.value, entries.value);
  if (!validateScheduleState(candidate)) return migrationFailure("MIGRATED_STATE_INVALID", "Migrated data failed validation.", sources);

  const pendingRaw = JSON.stringify({ status: "pending", startedAt: new Date().toISOString() });
  const pendingWrite = verifiedWriteRaw(storage, pendingKey, pendingRaw);
  if (!pendingWrite.ok) return migrationFailure(pendingWrite.code, `Migration marker failed: ${pendingWrite.message}`, sources, pendingWrite.cause, candidate);

  const primaryWrite = verifiedWriteSchedule(storage, primaryKey, candidate);
  if (!primaryWrite.ok) return migrationFailure(primaryWrite.code, primaryWrite.message, sources, primaryWrite.cause, candidate);

  const backups = [];
  for (const [name, source] of Object.entries(sources)) {
    if (source.status !== "found") continue;
    const key = timestampedStorageKey(primaryKey, `migration-backup.${name}`, now, idFactory);
    const backup = verifiedWriteRaw(storage, key, source.raw);
    if (!backup.ok) return migrationFailure(backup.code, `Migration backup for ${name} failed: ${backup.message}`, sources, backup.cause, candidate);
    backups.push({ name, key, raw: source.raw });
  }

  try {
    storage.removeItem(pendingKey);
    if (storage.getItem(pendingKey) !== null) return migrationFailure("MIGRATION_MARKER_CLEAR_FAILED", "Migration completion could not be verified.", sources, null, candidate);
  } catch (error) {
    return migrationFailure("MIGRATION_MARKER_CLEAR_FAILED", "Migration completion could not be verified.", sources, error, candidate);
  }

  return { ok: true, status: "migrated", value: primaryWrite.value, sources, backups, savedAt: primaryWrite.savedAt };
}
