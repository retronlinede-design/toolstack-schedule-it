import { describe, expect, it } from "vitest";
import { createMovementFromDraft, emptyDraft } from "../data/schema";
import { normalizeState } from "../storage/state";
import { renderProgrammeDocumentMarkup } from "../print/renderProgrammeDocument";
import {
  applyAudiencePreset,
  getAudienceWarnings,
  getVisibilityCounts,
  isMovementVisibleInView,
  normalizeMovementAudiences,
  selectMovementsForView,
} from "./audiences";
import { validState } from "../import/testFixtures";
import { createMondayDemoState } from "../data/defaultData";
import { prepareBackupImport } from "../import/prepareBackup";

function movement(overrides = {}) {
  return {
    id: "m", driverId: "driver-a", participants: "", isExecutiveVisible: true, isOperationalVisible: true,
    audiences: { executive: true, operational: true, cg: false, marida: false, driverIds: [] },
    ...overrides,
  };
}

describe("audience normalization and migration", () => {
  it("gives new movements documented defaults", () => {
    expect(createMovementFromDraft({ ...emptyDraft, id: null }, "day").audiences).toEqual({ executive: true, operational: true, cg: false, marida: false, driverIds: [] });
  });

  it("migrates old visibility flags and legacy CG/Marida text once", () => {
    expect(normalizeMovementAudiences({ driverId: "d", isExecutiveVisible: false, isOperationalVisible: false, participants: "CG and Marida" })).toEqual({ executive: false, operational: false, cg: true, marida: true, driverIds: [] });
  });

  it("explicit values override heuristics and text edits never recompute them", () => {
    const explicit = movement({ participants: "CG Marida", audiences: { executive: false, operational: true, cg: false, marida: false, driverIds: [] } });
    expect(normalizeMovementAudiences(explicit)).toEqual(explicit.audiences);
    expect(normalizeMovementAudiences({ ...explicit, participants: "Completely changed" })).toEqual(explicit.audiences);
  });

  it("is idempotent and removes duplicate, assigned, and unknown additional drivers", () => {
    const state = validState();
    state.movements[0].audiences.driverIds = [state.movements[0].driverId, "driver-rory", "driver-rory", "unknown"];
    const once = normalizeState(state);
    const twice = normalizeState(once);
    expect(once.movements[0].audiences.driverIds).toEqual(["driver-rory"]);
    expect(twice).toEqual(once);
  });

  it("migrates legacy backups while preserving explicit audiences in current backups", () => {
    const legacy = validState();
    delete legacy.movements[0].audiences;
    legacy.movements[0].participants = "CG";
    const prepared = prepareBackupImport({ raw: JSON.stringify(legacy), currentState: validState() });
    expect(prepared.ok).toBe(true);
    expect(prepared.candidate.movements[0].audiences.cg).toBe(true);
  });

  it("gives every demo movement explicit audiences", () => {
    createMondayDemoState().movements.forEach((item) => expect(item.audiences).toEqual(expect.objectContaining({ executive: expect.any(Boolean), operational: true, cg: false, marida: false, driverIds: [] })));
  });
});

describe("audience selectors", () => {
  const records = [
    movement({ id: "executive", participants: "Marida CG", audiences: { executive: true, operational: false, cg: false, marida: false, driverIds: [] } }),
    movement({ id: "cg", participants: "Nobody", audiences: { executive: false, operational: false, cg: true, marida: false, driverIds: [] } }),
    movement({ id: "marida", participants: "Nobody", audiences: { executive: false, operational: false, cg: false, marida: true, driverIds: [] } }),
    movement({ id: "operational", driverId: "driver-a", audiences: { executive: false, operational: true, cg: false, marida: false, driverIds: ["driver-b"] } }),
    movement({ id: "hidden", participants: "CG Marida", audiences: { executive: false, operational: false, cg: false, marida: false, driverIds: ["driver-b"] } }),
  ];

  it("filters every programme only by explicit audiences", () => {
    expect(selectMovementsForView(records, "executive").map((item) => item.id)).toEqual(["executive"]);
    expect(selectMovementsForView(records, "executiveCg").map((item) => item.id)).toEqual(["cg"]);
    expect(selectMovementsForView(records, "executiveMarida").map((item) => item.id)).toEqual(["marida"]);
    expect(selectMovementsForView(records, "operational").map((item) => item.id)).toEqual(["operational"]);
  });

  it("includes assigned and additional drivers only when operational is enabled", () => {
    const operational = records.find((item) => item.id === "operational");
    expect(isMovementVisibleInView(operational, "driver", { selectedDriverId: "driver-a" })).toBe(true);
    expect(isMovementVisibleInView(operational, "driver", { selectedDriverId: "driver-b" })).toBe(true);
    expect(isMovementVisibleInView(records.find((item) => item.id === "hidden"), "driver", { selectedDriverId: "driver-b" })).toBe(false);
  });

  it("calculates deterministic visibility and hidden counts", () => {
    expect(getVisibilityCounts(records)).toEqual({ executive: 1, cg: 1, marida: 1, operational: 1, hidden: 1 });
  });
});

describe("presets and warnings", () => {
  it("populates editable presets", () => {
    expect(applyAudiencePreset({}, "cgOnly")).toEqual({ executive: true, operational: true, cg: true, marida: false, driverIds: [] });
    expect(applyAudiencePreset({}, "hidden")).toEqual({ executive: false, operational: false, cg: false, marida: false, driverIds: [] });
  });

  it("warns for hidden and ineffective additional-driver combinations", () => {
    const warnings = getAudienceWarnings(movement({ audiences: { executive: false, operational: false, cg: false, marida: false, driverIds: ["driver-b"] } }));
    expect(warnings).toContain("This movement will not appear in any programme output.");
    expect(warnings).toContain("Additional driver visibility has no effect while Operational Programme is disabled.");
  });
});

describe("HTML export parity", () => {
  it.each([["executive", "Executive item"], ["executiveCg", "CG item"], ["executiveMarida", "Marida item"], ["operational", "Operational item"]])("exports the same explicit selection for %s", (view, visibleLabel) => {
    const state = validState();
    const templates = [
      ["Executive item", { executive: true, operational: false, cg: false, marida: false, driverIds: [] }],
      ["CG item", { executive: false, operational: false, cg: true, marida: false, driverIds: [] }],
      ["Marida item", { executive: false, operational: false, cg: false, marida: true, driverIds: [] }],
      ["Operational item", { executive: false, operational: true, cg: false, marida: false, driverIds: [] }],
    ];
    state.movements = templates.map(([label, audiences], index) => ({ ...state.movements[0], id: `m-${index}`, engagementDetails: label, participants: "CG Marida", audiences }));
    const selected = selectMovementsForView(state.movements, view);
    const html = renderProgrammeDocumentMarkup(state, view).bodyHtml;
    expect(selected.map((item) => item.engagementDetails)).toEqual([visibleLabel]);
    expect(html).toContain(visibleLabel);
    templates.filter(([label]) => label !== visibleLabel).forEach(([label]) => expect(html).not.toContain(label));
  });
});
