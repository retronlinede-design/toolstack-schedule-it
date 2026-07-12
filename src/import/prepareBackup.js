import { normalizeState } from "../storage/state";
import { parseBackupText } from "./backupSchema";
import { validateScheduleBackupState } from "./backupValidator";
import { createImportPreview } from "./importPreview";

export function prepareBackupImport({ raw, size, currentState }) {
  const identification = parseBackupText(raw, size);
  if (!identification.ok) return identification;
  const sourceValidation = validateScheduleBackupState(identification.data);
  if (!sourceValidation.ok) return { ok: false, code: sourceValidation.errors[0]?.code || "INVALID_SCHEMA", message: "The backup state is structurally invalid.", validation: sourceValidation };
  const candidate = normalizeState(identification.data);
  const candidateValidation = validateScheduleBackupState(candidate);
  if (!candidateValidation.ok) return { ok: false, code: "INVALID_SCHEMA", message: "The normalized backup is structurally invalid.", validation: candidateValidation };
  const warnings = [...sourceValidation.warnings, ...candidateValidation.warnings.filter((warning) => !sourceValidation.warnings.includes(warning))];
  return { ok: true, identification, candidate, preview: createImportPreview(currentState, candidate, identification, warnings), raw };
}
