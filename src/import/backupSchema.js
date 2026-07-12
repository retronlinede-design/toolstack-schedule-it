export const BACKUP_APP_ID = "scheduleit";
export const BACKUP_EXPORT_TYPE = "full-backup";
export const BACKUP_SCHEMA_VERSION = 1;
export const MAX_BACKUP_FILE_SIZE = 10 * 1024 * 1024;

export function createFullBackup(state, { now = () => new Date(), appVersion = "0.0.0" } = {}) {
  return {
    metadata: {
      appId: BACKUP_APP_ID,
      exportType: BACKUP_EXPORT_TYPE,
      schemaVersion: BACKUP_SCHEMA_VERSION,
      exportedAt: now().toISOString(),
      appVersion,
    },
    data: state,
  };
}

export function fullBackupFilename(now = new Date()) {
  return `schedule-it-full-backup-${now.toISOString().slice(0, 10)}.json`;
}

export function identifyBackup(value) {
  if (!value || typeof value !== "object" || Array.isArray(value)) return { ok: false, code: "UNKNOWN_JSON", message: "The file is not a Schedule-It backup." };
  if (value.metadata) {
    const metadata = value.metadata;
    if (!metadata || typeof metadata !== "object" || Array.isArray(metadata)) return { ok: false, code: "INVALID_SCHEMA", message: "Backup metadata is invalid." };
    if (metadata.appId !== BACKUP_APP_ID) return { ok: false, code: "WRONG_APP", message: "This backup belongs to another application." };
    if (metadata.exportType !== BACKUP_EXPORT_TYPE) {
      return metadata.exportType?.includes("report")
        ? { ok: false, code: "REPORT_NOT_RESTORABLE", message: "Report exports are not restorable backups." }
        : { ok: false, code: "UNKNOWN_EXPORT_TYPE", message: "The export type is not restorable." };
    }
    if (metadata.schemaVersion > BACKUP_SCHEMA_VERSION) return { ok: false, code: "UNSUPPORTED_VERSION", message: "This backup uses a newer unsupported schema." };
    if (metadata.schemaVersion !== BACKUP_SCHEMA_VERSION) return { ok: false, code: "UNSUPPORTED_VERSION", message: "This backup schema is unsupported." };
    if (!("data" in value)) return { ok: false, code: "INVALID_SCHEMA", message: "Backup data is missing." };
    return { ok: true, type: "current", label: "Schedule-It full backup", metadata, data: value.data, migrationRequired: false };
  }

  const required = ["profile", "drivers", "vehicles", "scheduleDays", "movements"];
  const secondary = ["vehicleHandoverNotes", "importantInfoItems", "routeNotes"].filter((key) => Array.isArray(value[key]));
  if (required.every((key) => key in value) && value.version === 1 && secondary.length >= 2) {
    return { ok: true, type: "legacy", label: "Legacy Schedule-It backup", metadata: { schemaVersion: 1 }, data: value, migrationRequired: true };
  }
  return { ok: false, code: "UNKNOWN_JSON", message: "The JSON cannot be positively identified as a Schedule-It backup." };
}

export function parseBackupText(raw, size = new TextEncoder().encode(raw).byteLength) {
  if (size > MAX_BACKUP_FILE_SIZE) return { ok: false, code: "FILE_TOO_LARGE", message: "The backup exceeds the 10 MiB limit." };
  let value;
  try {
    value = JSON.parse(raw);
  } catch (error) {
    return { ok: false, code: "INVALID_JSON", message: "The file is not valid JSON.", error };
  }
  return { ...identifyBackup(value), raw };
}
