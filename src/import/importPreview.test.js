import { describe, expect, it } from "vitest";
import { createImportPreview } from "./importPreview";
import { validState } from "./testFixtures";
import { defaultScheduleState } from "../data/defaultData";

describe("import preview", () => {
  it("reports current/imported counts and legacy warnings", () => {
    const preview = createImportPreview(defaultScheduleState, validState(), { label: "Legacy Schedule-It backup", metadata: { schemaVersion: 1 }, migrationRequired: true }, ["Duplicate schedule date"]);
    expect(preview.imported).toMatchObject({ scheduleDays: 1, movements: 1, vehicleHandoverNotes: 1, importantInfoItems: 1 });
    expect(preview.migrationRequired).toBe(true);
    expect(preview.warnings).toContain("Duplicate schedule date");
  });

  it("requires second confirmation for empty-over-nonempty", () => {
    expect(createImportPreview(validState(), defaultScheduleState, { label: "Backup", metadata: {}, migrationRequired: false }).requiresEmptyConfirmation).toBe(true);
  });
});
