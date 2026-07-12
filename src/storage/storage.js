export function readStorageKey(storage, key) {
  if (!storage || typeof storage.getItem !== "function") {
    return { ok: false, status: "unavailable", error: new Error("Storage is unavailable.") };
  }

  let raw;
  try {
    raw = storage.getItem(key);
  } catch (error) {
    return { ok: false, status: "unavailable", error };
  }

  if (raw === null) return { ok: true, status: "missing" };

  try {
    return { ok: true, status: "found", raw, value: JSON.parse(raw) };
  } catch (error) {
    return { ok: false, status: "corrupt", raw, error };
  }
}

export function storageError(code, message, cause) {
  return { ok: false, code, message, cause };
}

export function createStorageId(prefix = "record") {
  if (globalThis.crypto?.randomUUID) return `${prefix}-${globalThis.crypto.randomUUID()}`;
  const random = Array.from({ length: 4 }, () => Math.random().toString(36).slice(2)).join("");
  return `${prefix}-${Date.now().toString(36)}-${random}`;
}

export function timestampedStorageKey(baseKey, category, now = Date.now, idFactory = createStorageId) {
  return `${baseKey}.${category}.${now()}.${idFactory("copy")}`;
}
