import { normalizeState, validateScheduleState } from "./state";
import { storageError } from "./storage";

export const WRITE_ERROR = {
  WRITE_FAILED: "WRITE_FAILED",
  READBACK_FAILED: "READBACK_FAILED",
  READBACK_MISMATCH: "READBACK_MISMATCH",
  READBACK_INVALID_JSON: "READBACK_INVALID_JSON",
  READBACK_INVALID_STATE: "READBACK_INVALID_STATE",
  STORAGE_UNAVAILABLE: "STORAGE_UNAVAILABLE",
};

export function verifiedWriteRaw(storage, key, raw) {
  if (!storage || typeof storage.setItem !== "function" || typeof storage.getItem !== "function") {
    return storageError(WRITE_ERROR.STORAGE_UNAVAILABLE, "Browser storage is unavailable.");
  }

  try {
    storage.setItem(key, raw);
  } catch (error) {
    return storageError(WRITE_ERROR.WRITE_FAILED, "The storage write failed.", error);
  }

  let readBack;
  try {
    readBack = storage.getItem(key);
  } catch (error) {
    return storageError(WRITE_ERROR.READBACK_FAILED, "The saved data could not be read back.", error);
  }

  if (readBack === null) return storageError(WRITE_ERROR.READBACK_FAILED, "The saved value was missing during verification.");
  if (readBack !== raw) return storageError(WRITE_ERROR.READBACK_MISMATCH, "The saved value did not match the intended value.");
  return { ok: true, raw: readBack };
}

export function verifiedWriteSchedule(storage, key, state) {
  let normalized;
  let raw;
  try {
    normalized = normalizeState(state);
    raw = JSON.stringify(normalized);
  } catch (error) {
    return storageError(WRITE_ERROR.WRITE_FAILED, "Schedule data could not be serialized.", error);
  }

  const write = verifiedWriteRaw(storage, key, raw);
  if (!write.ok) return write;

  const verification = verifyScheduleReadback(write.raw);
  if (!verification.ok) return verification;

  return { ok: true, status: "saved", raw, value: verification.value, normalized, savedAt: new Date().toISOString() };
}

export function verifyScheduleReadback(raw) {
  let value;
  try {
    value = JSON.parse(raw);
  } catch (error) {
    return storageError(WRITE_ERROR.READBACK_INVALID_JSON, "The verified value was not valid JSON.", error);
  }
  if (!validateScheduleState(value)) {
    return storageError(WRITE_ERROR.READBACK_INVALID_STATE, "The verified value was not a valid Schedule-It state.");
  }

  return { ok: true, value };
}

export function shouldWarnBeforeUnload(status) {
  return status !== "saved";
}

export function createPersistenceController({ save, onStatus, delay = 250, setTimer = setTimeout, clearTimer = clearTimeout }) {
  let timer = null;
  let latestRevision = 0;
  let latestState;

  function report(status) {
    onStatus?.(status);
    return status;
  }

  function flush() {
    if (timer) clearTimer(timer);
    timer = null;
    const revision = latestRevision;
    const state = latestState;
    report({ status: "saving", currentRevision: latestRevision, persistedRevision: null });
    const result = save(state);
    if (revision !== latestRevision) {
      schedule(latestState, latestRevision);
      return report({ status: "saving", currentRevision: latestRevision, persistedRevision: result.ok ? revision : null, stale: true });
    }
    return result.ok
      ? report({ status: "saved", currentRevision: revision, persistedRevision: revision, savedAt: result.savedAt })
      : report({ status: "failed", currentRevision: revision, persistedRevision: null, error: result });
  }

  function schedule(state, revision) {
    latestState = state;
    latestRevision = revision;
    if (timer) clearTimer(timer);
    report({ status: "saving", currentRevision: revision, persistedRevision: null });
    timer = setTimer(flush, delay);
  }

  return { schedule, flush, retry: flush, hasPending: () => Boolean(timer), latestRevision: () => latestRevision };
}
