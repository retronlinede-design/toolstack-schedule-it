import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";
import WorkingTimeSummary from "../components/WorkingTimeSummary";
import { createDraftFromMovement, createMovementFromDraft, emptyDraft } from "../data/schema";
import { defaultProfile } from "../data/defaultData";
import { validateScheduleBackupState } from "../import/backupValidator";
import { buildHtmlImportCandidate } from "../import/htmlCandidate";
import { validState } from "../import/testFixtures";
import { duplicateMovementForSchedule } from "./schedulingMutations";
import { normalizeState } from "../storage/state";
import { getExportDocument } from "../utils/exportHtml";

describe("working-time compatibility and presentation", () => {
  it("defaults legacy movements to active and preserves classification through editing and duplication", () => {
    const legacy = validState();
    delete legacy.movements[0].workClassification;
    expect(normalizeState(legacy).movements[0].workClassification).toBe("active");
    const draft = { ...emptyDraft, workClassification: "standby" };
    const movement = createMovementFromDraft(draft, "day-1");
    expect(createDraftFromMovement(movement, { id: "day-1" }, defaultProfile).workClassification).toBe("standby");
    expect(duplicateMovementForSchedule(movement, "copy", 20).workClassification).toBe("standby");
  });

  it("validates classification and policy and accepts valid current data", () => {
    const state = validState();
    expect(validateScheduleBackupState(state).ok).toBe(true);
    state.movements[0].workClassification = "mystery";
    expect(validateScheduleBackupState(state).errors.some((error) => error.path.endsWith("workClassification"))).toBe(true);
    const invalidPolicy = validState(); invalidPolicy.workingTimePolicy.standardDailyMinutes = 10;
    expect(validateScheduleBackupState(invalidPolicy).errors.some((error) => error.path === "workingTimePolicy")).toBe(true);
  });

  it("defaults HTML candidates to active duty", () => {
    const candidate = buildHtmlImportCandidate(validState(), { scheduleDayDraft: { date: "2026-01-02", title: "Imported" }, movements: [{ engagementDetails: "Imported", driverName: "Greg", vehicleName: "Vito" }], driversToAdd: [], vehiclesToAdd: [], warnings: [], errors: [] }, "appendNewDay");
    expect(candidate.candidate.movements.at(-1).workClassification).toBe("active");
  });

  it("renders classifications, policy settings, assumptions, and no compliance claim", () => {
    const state = validState();
    const html = renderToStaticMarkup(<WorkingTimeSummary movements={state.movements} drivers={state.drivers} vehicles={state.vehicles} scheduleDays={state.scheduleDays} workingTimePolicy={state.workingTimePolicy} onWorkingTimePolicyChange={vi.fn()} integrity={{ summary: { chronologyErrors: 0 } }} />);
    expect(html).toContain("Working-Time Settings");
    expect(html).toContain("recorded movement intervals");
    expect(html).toContain("operational planning summary");
    expect(html).not.toContain("legally compliant");
    expect(html).toContain("Counted Working Time");
  });

  it("uses shared totals in standalone working-time HTML", () => {
    const state = validState();
    const html = getExportDocument(state, "workingTime").fullHtml;
    expect(html).toContain("Counted Working Time");
    expect(html).toContain("active 1h 00m");
    expect(html).toContain("not a legal compliance determination");
    expect(html).not.toContain("Overtime After 16:30");
  });
});
