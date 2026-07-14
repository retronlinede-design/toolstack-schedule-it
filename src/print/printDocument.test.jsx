import { readFileSync } from "node:fs";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import PreviewTabs from "../components/PreviewTabs";
import ProgrammeDocument from "../components/preview/ProgrammeDocument";
import { createProgrammeDocumentModel } from "../components/preview/programmeDocumentModel";
import { validState } from "../import/testFixtures";
import { renderProgrammeDocumentMarkup } from "./renderProgrammeDocument";

function pickupState() {
  const state = validState();
  state.movements[0].pickups = [{ id: "pickup-1", time: "07:30", location: "Hotel", address: "Pickup address", person: "Ambassador", contactPhone: "+49 123", notes: "Use side door", sortOrder: 10 }];
  return state;
}

describe("shared programme printing", () => {
  it("uses the same ProgrammeDocument component in the page preview, modal, Print Manager, and static markup", () => {
    for (const file of ["../components/PreviewTabs.jsx", "../components/preview/PreviewWorkspace.jsx", "../components/tools/PrintManager.jsx", "./renderProgrammeDocument.jsx"]) {
      expect(readFileSync(new URL(file, import.meta.url), "utf8")).toContain("ProgrammeDocument");
    }
    const state = validState();
    const model = createProgrammeDocumentModel(state, "executive");
    expect(renderProgrammeDocumentMarkup(state, "executive").bodyHtml).toBe(renderToStaticMarkup(<ProgrammeDocument model={model} showControls={false} />));
    expect(renderToStaticMarkup(<PreviewTabs schedule={state} />)).toContain(state.movements[0].engagementDetails);
  });

  it("preserves identical pickup formatting in shared React and generated markup", () => {
    const state = pickupState();
    const direct = renderToStaticMarkup(<ProgrammeDocument model={createProgrammeDocumentModel(state, "operational")} showControls={false} />);
    const generated = renderProgrammeDocumentMarkup(state, "operational").bodyHtml;
    expect(generated).toBe(direct);
    for (const text of ["Ambassador", "Hotel", "Pickup address", "+49 123", "Use side door"]) expect(generated).toContain(text);
  });

  it("filters selected days before rendering and preserves duplicate-date days once", () => {
    const state = validState();
    state.scheduleDays.push({ id: "day-2", date: state.scheduleDays[0].date, title: "Second same-date day" });
    state.movements.push({ ...state.movements[0], id: "movement-2", scheduleDayId: "day-2", engagementDetails: "Only second engagement" });
    const model = createProgrammeDocumentModel(state, "executive", { selectedDayIds: ["day-2"] });
    const html = renderToStaticMarkup(<ProgrammeDocument model={model} />);
    expect(model.schedule.scheduleDays.map((day) => day.id)).toEqual(["day-2"]);
    expect((html.match(/Only second engagement/g) || [])).toHaveLength(1);
    expect(html).not.toContain(state.movements[0].engagementDetails);
  });

  it("keeps density structural-neutral and page breaks between days only", () => {
    const css = readFileSync(new URL("./printOverrides.css", import.meta.url), "utf8");
    expect(css).toContain(".print-layout-separate .programme-day + .programme-day");
    expect(css).not.toContain(".print-layout-separate .programme-day {");
    expect(css).toContain(".print-layout-continuous .programme-day");
    expect(css).not.toContain(".programme-day {\n    break-inside: avoid");
    expect(css).toContain(".print-density-compact");
    expect(css).not.toMatch(/grid-template-columns|display:\s*none[^}]*print-density-compact/);
  });

  it("has no alternate export or Print Manager programme template", () => {
    const manager = readFileSync(new URL("../components/tools/PrintManager.jsx", import.meta.url), "utf8");
    expect(manager).not.toMatch(/ExecutiveRow|OperationalCard|DriverTimeline|srcDoc/);
    expect(manager).toContain("<ProgrammeDocument");
  });
});
