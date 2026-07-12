import { verifiedWriteRaw, verifiedWriteSchedule } from "./persistence";
import { timestampedStorageKey } from "./storage";

export function preserveRawRecovery(storage, primaryKey, raw, options = {}) {
  const key = timestampedStorageKey(primaryKey, options.category || "recovery", options.now, options.idFactory);
  const result = verifiedWriteRaw(storage, key, raw);
  return result.ok ? { ...result, key } : { ...result, key };
}

export function replaceCorruptWithNew({ storage, primaryKey, raw, newState, confirmed, options }) {
  if (!confirmed) return { ok: false, code: "CONFIRMATION_REQUIRED", message: "Explicit confirmation is required." };
  const recovery = preserveRawRecovery(storage, primaryKey, raw, options);
  if (!recovery.ok) return { ...recovery, recovery };
  const write = verifiedWriteSchedule(storage, primaryKey, newState);
  return write.ok ? { ...write, recovery } : { ...write, recovery };
}

export function downloadRaw(filename, raw) {
  const blob = new Blob([raw], { type: "text/plain;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = filename;
  anchor.click();
  URL.revokeObjectURL(url);
}
