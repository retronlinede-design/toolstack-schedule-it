import { readFileSync } from "node:fs";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";
import { emptyDraft } from "../../data/schema";
import ScheduleBuilder from "../ScheduleBuilder";
import ToolsWorkspace from "./ToolsWorkspace";
import { canLeaveTools, initialToolsNavigation, toolsNavigationReducer } from "./toolsNavigation";

const noop = vi.fn();
const integrity = { errors: [], warnings: [], conflictsByMovementId: {}, conflictsByHandoverId: {}, summary: {} };
function builderProps() {
  return {
    draft: { ...emptyDraft, scheduleDayId: "day", date: "2026-07-12", dayTitle: "Sunday" }, drivers: [{ id: "driver-greg", name: "Greg" }], vehicles: [{ id: "vehicle-vito", name: "Vito" }], scheduleDays: [{ id: "day", date: "2026-07-12", title: "Sunday" }], movements: [], vehicleHandoverNotes: [{ id: "h", scheduleDayId: "day", vehicleId: "vehicle-vito", fromDriverId: "driver-greg", toDriverId: "", visibleToDriverIds: [], location: "Garage", time: "09:00" }], importantInfoItems: [{ id: "i", type: "Contact", title: "Duty contact", name: "Officer", sortOrder: 10 }], integrity, errors: {}, onChange: noop, onSubmit: noop, onCancelEdit: noop, onClear: noop, onCreateDay: noop, onSelectDay: noop, onUpdateDay: noop, onDuplicateDay: noop, onEditMovement: noop, onUpdateMovement: noop, onDuplicateMovement: noop, onMoveMovement: noop, onDeleteMovement: noop, onSaveVehicleHandoverNote: noop, onDuplicateVehicleHandoverNote: noop, onMoveVehicleHandoverNote: noop, onDeleteVehicleHandoverNote: noop, onSaveImportantInfoItem: noop, onDuplicateImportantInfoItem: noop, onMoveImportantInfoItem: noop, onDeleteImportantInfoItem: noop,
  };
}

describe("Tools navigation", () => {
  it("renders exactly the four intended tool choices without global conflict status", () => {
    const props = builderProps();
    const html = renderToStaticMarkup(<ToolsWorkspace onClose={noop} builderProps={props} schedule={{ drivers: props.drivers, vehicles: props.vehicles }} importantInfoCount={1} handoverCount={2} />);
    expect(html).toContain('role="dialog"');
    expect(html).toContain("Important Information");
    expect(html).toContain("Driver Manager");
    expect(html).toContain("Vehicle Manager");
    expect(html).toContain("1 record");
    expect(html).toContain("2 handovers");
    expect(html).not.toContain("unresolved conflict");
    expect((html.match(/aria-label="Open /g) || []).length).toBe(4);
    expect(html).toContain('aria-label="Open Important Information"');
    expect(html).toContain('aria-label="Open Vehicle Handover"');
  });

  it("opens each workspace and returns to the Tools menu through navigation state", () => {
    const info = toolsNavigationReducer(initialToolsNavigation, { type: "open", tool: "importantInfo" });
    const handover = toolsNavigationReducer(initialToolsNavigation, { type: "open", tool: "handover" });
    expect(info.activeTool).toBe("importantInfo");
    expect(handover.activeTool).toBe("handover");
    expect(toolsNavigationReducer(info, { type: "back" })).toEqual(initialToolsNavigation);
  });

  it("warns before abandoning dirty drafts and respects cancellation", () => {
    const cancel = vi.fn(() => false);
    expect(canLeaveTools(true, cancel)).toBe(false);
    expect(cancel).toHaveBeenCalledWith("Discard unsaved tool changes?");
    expect(canLeaveTools(false, cancel)).toBe(true);
  });
});

describe("tool presentation modes", () => {
  it("removes management sections from the primary builder", () => {
    const html = renderToStaticMarkup(<ScheduleBuilder {...builderProps()} mode="builder" />);
    expect(html).not.toContain("Selected Day Vehicle Handover / Car Location");
    expect(html).not.toContain("Mission routes, contacts, addresses, phone numbers");
    expect(html).toContain("Movement Editor");
  });

  it("renders existing Important Information CRUD only in its tool workspace", () => {
    const html = renderToStaticMarkup(<ScheduleBuilder {...builderProps()} mode="importantInfo" />);
    expect(html).toContain("Important Information");
    expect(html).toContain("Duty contact");
    expect(html).toContain("Add Info");
    expect(html).toContain('aria-expanded="false"');
    expect(html).not.toContain("Movement Editor");
  });

  it("renders existing handover CRUD and conflicts only in its tool workspace", () => {
    const props = builderProps();
    props.integrity = { ...integrity, conflictsByHandoverId: { h: [{ severity: "error", message: "Vehicle conflict" }] } };
    const html = renderToStaticMarkup(<ScheduleBuilder {...props} mode="handover" />);
    expect(html).toContain("Vehicle Handover");
    expect(html).toContain("Garage");
    expect(html).toContain("Conflict");
    expect(html).toContain("Add Handover");
    expect(html).not.toContain("Movement Editor");
  });

  it("does not expose the Demo action from the application header", () => {
    const source = readFileSync(new URL("../../App.jsx", import.meta.url), "utf8");
    expect(source).toContain("Tools");
    expect(source).not.toContain("Load Monday Demo");
    expect(source).not.toContain("handleLoadMondayDemo");
  });
});
