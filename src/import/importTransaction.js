import { verifiedWriteRaw } from "../storage/persistence";
import { timestampedStorageKey } from "../storage/storage";
import { normalizeState } from "../storage/state";
import { APP_KEY } from "../utils/storage";
import { validateScheduleBackupState } from "./backupValidator";

function failure(errorCode, details, extra = {}) {
  return { ok: false, errorCode, details, ...extra };
}

function validateState(state) {
  const result = validateScheduleBackupState(state);
  return result.ok ? { ok: true, state } : failure("INVALID_SCHEMA", result.errors, { validation: result });
}

function restorePrimary(storage, primaryKey, raw) {
  const result = verifiedWriteRaw(storage, primaryKey, raw);
  return result.ok ? { ok: true } : { ok: false, error: result };
}

export function replaceScheduleTransaction({
  currentState,
  candidateState,
  operationType,
  storage = globalThis.localStorage,
  primaryKey = APP_KEY,
  now,
  idFactory,
}) {
  const currentValidation = validateState(currentState);
  if (!currentValidation.ok) return failure("CURRENT_STATE_INVALID", currentValidation.details);
  const normalizedCandidate = normalizeState(candidateState);
  const candidateValidation = validateState(normalizedCandidate);
  if (!candidateValidation.ok) return failure("INVALID_SCHEMA", candidateValidation.details);

  let currentRaw;
  let candidateRaw;
  try {
    currentRaw = JSON.stringify(currentState);
    candidateRaw = JSON.stringify(normalizedCandidate);
  } catch (error) {
    return failure("SERIALIZE_FAILED", error.message);
  }

  const snapshotKey = timestampedStorageKey(primaryKey, `pre-${operationType}`, now, idFactory);
  const snapshot = verifiedWriteRaw(storage, snapshotKey, currentRaw);
  if (!snapshot.ok) return failure("SNAPSHOT_FAILED", snapshot, { snapshotKey });

  const candidateWrite = verifiedWriteRaw(storage, primaryKey, candidateRaw);
  if (!candidateWrite.ok) {
    const restoration = restorePrimary(storage, primaryKey, currentRaw);
    return failure(candidateWrite.code === "READBACK_MISMATCH" ? "CANDIDATE_VERIFY_FAILED" : "CANDIDATE_WRITE_FAILED", candidateWrite, { snapshotKey, restoration });
  }

  let storedState;
  try {
    storedState = JSON.parse(candidateWrite.raw);
  } catch (error) {
    const restoration = restorePrimary(storage, primaryKey, currentRaw);
    return failure("CANDIDATE_VERIFY_FAILED", error.message, { snapshotKey, restoration });
  }
  const storedValidation = validateState(storedState);
  if (!storedValidation.ok) {
    const restoration = restorePrimary(storage, primaryKey, currentRaw);
    return failure("CANDIDATE_VERIFY_FAILED", storedValidation.details, { snapshotKey, restoration });
  }

  return { ok: true, snapshotKey, storedState, operationType };
}

export function rollbackScheduleTransaction({ snapshotKey, currentState, storage = globalThis.localStorage, primaryKey = APP_KEY, now, idFactory }) {
  let raw;
  try {
    raw = storage.getItem(snapshotKey);
  } catch (error) {
    return failure("SNAPSHOT_READ_FAILED", error.message, { snapshotKey });
  }
  if (raw === null) return failure("SNAPSHOT_READ_FAILED", "The rollback snapshot is missing.", { snapshotKey });
  let previousState;
  try {
    previousState = JSON.parse(raw);
  } catch (error) {
    return failure("SNAPSHOT_INVALID", error.message, { snapshotKey });
  }
  const validation = validateState(previousState);
  if (!validation.ok) return failure("SNAPSHOT_INVALID", validation.details, { snapshotKey });
  return replaceScheduleTransaction({ currentState, candidateState: previousState, operationType: "rollback", storage, primaryKey, now, idFactory });
}
