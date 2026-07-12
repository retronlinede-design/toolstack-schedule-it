const countKeys = ["drivers", "vehicles", "scheduleDays", "movements", "vehicleHandoverNotes", "importantInfoItems", "routeNotes"];

export function scheduleCounts(state) {
  return Object.fromEntries(countKeys.map((key) => [key, Array.isArray(state?.[key]) ? state[key].length : 0]));
}

export function createImportPreview(currentState, candidateState, identification, warnings = []) {
  const current = scheduleCounts(currentState);
  const imported = scheduleCounts(candidateState);
  const contentKeys = ["scheduleDays", "movements", "vehicleHandoverNotes", "importantInfoItems", "routeNotes"];
  const currentTotal = contentKeys.reduce((sum, key) => sum + current[key], 0);
  const importedTotal = contentKeys.reduce((sum, key) => sum + imported[key], 0);
  return {
    current,
    imported,
    backupType: identification.label,
    schemaVersion: identification.metadata?.schemaVersion ?? 1,
    exportedAt: identification.metadata?.exportedAt || null,
    migrationRequired: identification.migrationRequired,
    warnings,
    replacesCurrent: true,
    requiresEmptyConfirmation: currentTotal > 0 && importedTotal === 0,
  };
}
