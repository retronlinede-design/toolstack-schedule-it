import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { validState } from "../import/testFixtures";
import { applyPrintPreset, createDefaultPrintConfig } from "./printConfig";
import { createPrintDocument } from "./printDocument";
import { createPrintStyles, PRINT_DENSITY_MINIMUM } from "./printStyles";

function pickupState() {
  const state = validState();
  state.movements[0].pickups = [{ id: "pickup-1", time: "07:30", location: "Hotel", address: "Long address", person: "Ambassador", contactPhone: "+49 123", notes: "Use side door", sortOrder: 10 }];
  return state;
}

describe("shared print document generation", () => {
  it.each([
    ["separate", "print-layout-separate"], ["continuous", "print-layout-continuous"], ["smart", "print-layout-smart"], ["compact", "print-layout-compact"],
  ])("applies the %s layout to the generated preview/final document", (layout, cssClass) => {
    const result = createPrintDocument(validState(), { ...createDefaultPrintConfig(), layout });
    expect(result.ok).toBe(true);
    expect(result.fullHtml).toContain(cssClass);
    expect(result.fullHtml).toContain('class="print-day executive-day-section');
  });

  it("adds only sibling day breaks, smart keep-together rules, and no leading page break", () => {
    const separate = createPrintStyles({ ...createDefaultPrintConfig(), layout: "separate" });
    expect(separate).toContain(".print-day + .print-day");
    expect(separate).not.toContain(".print-layout-separate .print-day {");
    expect(createPrintStyles(createDefaultPrintConfig())).toContain("break-inside: avoid");
    const exporter = readFileSync(new URL("../utils/exportHtml.js", import.meta.url), "utf8");
    expect(exporter).not.toContain(".day-section:not(.first-day-section)");
  });

  it("renders selected duplicate-date days exactly once in one continuous document", () => {
    const state = validState();
    state.scheduleDays.push({ id: "day-2", date: "2026-01-01", title: "Second same-date day" });
    state.movements.push({ ...state.movements[0], id: "movement-2", scheduleDayId: "day-2", engagementDetails: "Only second engagement" });
    const result = createPrintDocument(state, { ...createDefaultPrintConfig(), layout: "continuous" });
    expect(result.selectedDays.map((day) => day.id)).toEqual(["day-1", "day-2"]);
    expect((result.bodyHtml.match(/Only second engagement/g) || [])).toHaveLength(1);
    expect((result.bodyHtml.match(/class="print-day executive-day-section/g) || [])).toHaveLength(2);
  });

  it("applies all densities, orientation, and the readable compact minimum", () => {
    expect(PRINT_DENSITY_MINIMUM).toBe("9.5pt");
    for (const density of ["spacious", "standard", "compact"]) expect(createPrintStyles({ ...createDefaultPrintConfig(), density })).toContain(`print-body-size:`);
    expect(createPrintStyles({ ...createDefaultPrintConfig(), orientation: "landscape" })).toContain("A4 landscape");
    expect(createPrintStyles(createDefaultPrintConfig())).toContain("A4 portrait");
  });

  it("filters pickup sensitivity by programme defaults and selected content options", () => {
    const state = pickupState();
    const executive = createPrintDocument(state, createDefaultPrintConfig("executive"));
    expect(executive.bodyHtml).toContain("Ambassador");
    expect(executive.bodyHtml).toContain("Long address");
    expect(executive.bodyHtml).not.toContain("+49 123");
    expect(executive.bodyHtml).not.toContain("Use side door");
    const concise = createPrintDocument(state, { ...createDefaultPrintConfig("executive"), include: { ...createDefaultPrintConfig("executive").include, pickupAddresses: false } });
    expect(concise.bodyHtml).not.toContain("Long address");
    const operational = createPrintDocument(state, createDefaultPrintConfig("operational"));
    expect(operational.bodyHtml).toContain("+49 123");
    expect(operational.bodyHtml).toContain("Use side door");
    const hidden = createPrintDocument(state, { ...createDefaultPrintConfig("operational"), include: { ...createDefaultPrintConfig("operational").include, pickups: false, handovers: false } });
    expect(hidden.bodyHtml).not.toContain("Ambassador");
    expect(hidden.bodyHtml).not.toContain("Vehicle handover");
  });

  it("supports driver grouping, appended information, compact output, and one shared HTML model", () => {
    const state = pickupState();
    const config = { ...applyPrintPreset(createDefaultPrintConfig("operational"), "compactOverview"), driverGrouping: "driverDay", include: { ...createDefaultPrintConfig("operational").include, importantInformation: true } };
    const result = createPrintDocument(state, config);
    expect(result.fullHtml).toContain("print-driver-grouping-driverDay");
    expect(result.fullHtml).toContain("print-layout-compact");
    expect(result.bodyHtml).toContain("Important Information");
    expect(result.fullHtml).toContain(result.bodyHtml);
    expect(result.selectedDays).toHaveLength(1);
  });

  it.each(["continuous", "driver", "driverDay"])("emits the %s driver grouping class", (driverGrouping) => {
    const result = createPrintDocument(validState(), { ...createDefaultPrintConfig("operational"), driverGrouping });
    expect(result.fullHtml).toContain(`print-driver-grouping-${driverGrouping}`);
  });
});
