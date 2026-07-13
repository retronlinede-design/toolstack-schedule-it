import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { validState } from "../import/testFixtures";
import { createDefaultPrintConfig } from "./printConfig";
import { createPrintDocument } from "./printDocument";
import { createPrintStyles, PRINT_DENSITY_MINIMUM } from "./printStyles";

function pickupState() {
  const state = validState();
  state.movements[0].address = "Main destination address";
  state.movements[0].locationNotes = "Report to the side entrance";
  state.movements[0].pickups = [{ id: "pickup-1", time: "07:30", location: "Hotel", address: "Pickup address", person: "Ambassador", contactPhone: "+49 123", notes: "Use side door", sortOrder: 10 }];
  return state;
}

describe("repaired print document generation", () => {
  it.each([["separate", "print-layout-separate"], ["continuous", "print-layout-continuous"], ["smart", "print-layout-smart"]])("applies only the %s day-layout class", (layout, cssClass) => {
    const result = createPrintDocument(validState(), { ...createDefaultPrintConfig(), layout });
    expect(result.ok).toBe(true);
    expect(result.fullHtml).toContain(cssClass);
    expect(result.fullHtml).toContain('class="print-day executive-day-section');
    expect(result.fullHtml).not.toContain("print-driver-grouping-");
  });

  it("breaks only later days, keeps continuous days free, and never creates a leading break", () => {
    const styles = createPrintStyles(createDefaultPrintConfig());
    expect(styles).toContain(".print-layout-separate .print-day + .print-day");
    expect(styles).not.toContain(".print-layout-separate .print-day {");
    expect(styles).toContain(".print-layout-continuous .print-day");
    expect(styles).toContain("page-break-before: auto");
    expect(styles).toContain(".print-layout-smart .print-day");
    expect(styles).toContain("overflow: visible");
  });

  it("uses restrained heading variables and natural wrapping", () => {
    const styles = createPrintStyles(createDefaultPrintConfig());
    expect(styles).toContain("--print-document-title: 16pt");
    expect(styles).toContain("--print-day-title: 12.5pt");
    expect(styles).toContain("--print-section-title: 11pt");
    expect(styles).toContain("overflow-wrap: anywhere");
    expect(styles).toContain("hyphens: auto");
    expect(styles).not.toContain("white-space: nowrap");
    const state = validState();
    state.profile.documentTitle = "A deliberately long official programme heading that must wrap naturally across the printable page";
    state.scheduleDays[0].title = "A long programme day heading with delegation and venue context";
    state.movements[0].engagementDetails = "Extended bilateral engagement title with operational context";
    state.movements[0].venue = "A venue name long enough to require natural wrapping";
    const output = createPrintDocument(state, createDefaultPrintConfig());
    expect(output.bodyHtml).toContain(state.profile.documentTitle);
    expect(output.bodyHtml).toContain(state.scheduleDays[0].title);
    expect(output.bodyHtml).toContain(state.movements[0].engagementDetails);
    expect(output.bodyHtml).toContain(state.movements[0].venue);
  });

  it("uses auto-layout tables, flexible grids, and no fixed pixel-width print columns", () => {
    const exporter = readFileSync(new URL("../utils/exportHtml.js", import.meta.url), "utf8");
    const styles = `${exporter}\n${createPrintStyles(createDefaultPrintConfig())}`;
    expect(styles).toContain("table-layout: auto");
    expect(styles).not.toContain("table-layout: fixed");
    expect(styles).not.toMatch(/(?:min-)?width:\s*\d+px/);
    expect(styles).toContain("minmax(0, 1fr)");
    expect(styles).toContain("min-width: 0");
  });

  it("keeps compact density structural output identical while reducing type and spacing", () => {
    expect(PRINT_DENSITY_MINIMUM).toBe("8.75pt");
    const standardConfig = createDefaultPrintConfig("operational");
    const compactConfig = { ...standardConfig, density: "compact" };
    const standard = createPrintDocument(validState(), standardConfig);
    const compact = createPrintDocument(validState(), compactConfig);
    const stripGeneratedTime = (html) => html.replace(/Generated [^<]+/, "Generated");
    expect(stripGeneratedTime(standard.bodyHtml)).toBe(stripGeneratedTime(compact.bodyHtml));
    expect(createPrintStyles(standardConfig)).toContain("--print-body-size: 9.5pt");
    expect(createPrintStyles(compactConfig)).toContain("--print-body-size: 8.75pt");
    expect(createPrintStyles(compactConfig)).toContain("--print-row-padding: 4px 5px");
  });

  it("keeps executive pickups concise while broad address controls still affect destinations", () => {
    const state = pickupState();
    const normal = createPrintDocument(state, createDefaultPrintConfig("executive"));
    expect(normal.bodyHtml).toContain("Ambassador");
    expect(normal.bodyHtml).toContain("Hotel");
    expect(normal.bodyHtml).toContain("Main destination address");
    expect(normal.bodyHtml).not.toContain("Pickup address");
    expect(normal.bodyHtml).not.toContain("+49 123");
    expect(normal.bodyHtml).not.toContain("Use side door");
    const withoutAddresses = createPrintDocument(state, { ...createDefaultPrintConfig("executive"), include: { ...createDefaultPrintConfig().include, addresses: false } });
    expect(withoutAddresses.bodyHtml).not.toContain("Main destination address");
  });

  it("retains full operational and driver pickup details", () => {
    const state = pickupState();
    const operational = createPrintDocument(state, createDefaultPrintConfig("operational"));
    const driver = createPrintDocument(state, createDefaultPrintConfig("driver", { driverId: "driver-greg" }));
    for (const output of [operational.bodyHtml, driver.bodyHtml]) {
      expect(output).toContain("1. 07:30");
      expect(output).toContain("Pickup address");
      expect(output).toContain("+49 123");
      expect(output).toContain("Use side door");
      expect(output).toContain("Main destination address");
      expect(output).toContain("Vito");
    }
    expect(driver.bodyHtml).toContain("Engagement / Pickups");
    expect(driver.bodyHtml).toContain("Destination");
    expect(driver.bodyHtml).toContain("Instructions");
    expect(driver.bodyHtml).not.toContain("Participants</th><th>Driver");
  });

  it("keeps working-time tables wrappable and Important Information card-based", () => {
    const working = createPrintDocument(validState(), createDefaultPrintConfig("workingTime"));
    const information = createPrintDocument(validState(), createDefaultPrintConfig("importantInfo"));
    expect(working.bodyHtml).toContain("working-driver-section");
    expect(working.styles).toContain("white-space: normal");
    expect(information.bodyHtml).toContain("important-info-card-list");
    expect(information.bodyHtml).not.toContain("important-info-table");
  });

  it("uses the exact generated HTML and styles for preview and final printing", () => {
    const result = createPrintDocument(validState(), createDefaultPrintConfig());
    expect(result.fullHtml).toContain(`<style>${result.styles}</style>`);
    expect(result.fullHtml).toContain(result.bodyHtml);
  });

  it("preserves duplicate-date days exactly once in continuous output", () => {
    const state = validState();
    state.scheduleDays.push({ id: "day-2", date: "2026-01-01", title: "Second same-date day" });
    state.movements.push({ ...state.movements[0], id: "movement-2", scheduleDayId: "day-2", engagementDetails: "Only second engagement" });
    const result = createPrintDocument(state, { ...createDefaultPrintConfig(), layout: "continuous" });
    expect(result.selectedDays.map((day) => day.id)).toEqual(["day-1", "day-2"]);
    expect((result.bodyHtml.match(/Only second engagement/g) || [])).toHaveLength(1);
  });
});
