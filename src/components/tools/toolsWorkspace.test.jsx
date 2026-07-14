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
  it("renders Print Manager and the four existing tool choices without global conflict status", () => {
    const props = builderProps();
    const html = renderToStaticMarkup(<ToolsWorkspace onClose={noop} builderProps={props} schedule={{ drivers: props.drivers, vehicles: props.vehicles }} importantInfoCount={1} handoverCount={2} />);
    expect(html).toContain('role="dialog"');
    expect(html).toContain("Important Information");
    expect(html).toContain("Driver Manager");
    expect(html).toContain("Vehicle Manager");
    expect(html).toContain("1 record");
    expect(html).toContain("2 handovers");
    expect(html).not.toContain("unresolved conflict");
    expect((html.match(/aria-label="Open /g) || []).length).toBe(5);
    expect(html).toContain('aria-label="Open Print Manager"');
    expect(html).toContain('aria-label="Open Important Information"');
    expect(html).toContain('aria-label="Open Vehicle Handover"');
  });

  it("opens each workspace and returns to the Tools menu through navigation state", () => {
    const info = toolsNavigationReducer(initialToolsNavigation, { type: "open", tool: "importantInfo" });
    const handover = toolsNavigationReducer(initialToolsNavigation, { type: "open", tool: "handover" });
    const print = toolsNavigationReducer(initialToolsNavigation, { type: "open", tool: "print" });
    expect(info.activeTool).toBe("importantInfo");
    expect(handover.activeTool).toBe("handover");
    expect(print.activeTool).toBe("print");
    expect(toolsNavigationReducer(info, { type: "back" })).toEqual(initialToolsNavigation);
  });

  it("opens the Print Manager workspace with accessible settings", () => {
    const props = builderProps();
    const schedule = { drivers: props.drivers.map((item) => ({ ...item, isActive: true })), vehicles: props.vehicles, scheduleDays: props.scheduleDays, movements: [{ id: "m", scheduleDayId: "day", driverId: "driver-greg", vehicleId: "vehicle-vito", audiences: { executive: true, operational: true, cg: true, marida: true, driverIds: [] }, pickups: [] }], vehicleHandoverNotes: [], importantInfoItems: props.importantInfoItems, profile: { missionName: "Mission", documentTitle: "Programme" }, workingTimePolicy: {} };
    const html = renderToStaticMarkup(<ToolsWorkspace onClose={noop} builderProps={props} schedule={schedule} initialTool="print" currentDayId="day" selectedDriverId="driver-greg" onPrintDocument={noop} importantInfoCount={1} handoverCount={0} />);
    expect(html).toContain("Print Manager");
    expect(html).toContain("All days");
    expect(html).toContain("Selected days");
    expect(html).toContain(" Preview</button>");
    expect(html).toContain("One day per page");
    expect(html).toContain("Continuous");
    expect(html).toContain("Standard");
    expect(html).toContain("Compact");
    for (const removed of ["Date range", "Smart grouping", "Orientation", "Printed details", "Preset", "Driver page grouping", "Page numbers", "Repeat table headers", "Keep movements together", "Mission header", "Pickup contacts"]) expect(html).not.toContain(removed);
  });

  it("renders the shared programme component instead of an iframe or fixed alternate layout", () => {
    const source = readFileSync(new URL("./PrintManager.jsx", import.meta.url), "utf8");
    expect(source).toContain("<ProgrammeDocument model={previewDocument.model}");
    expect(source).not.toContain("srcDoc");
    expect(source).not.toContain("mm\"");
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

  it("renders the optional pickup disclosure, summary, timeline, and accessible ordering controls", () => {
    const props = builderProps();
    props.draft = { ...props.draft, pickups: [{ id: "p", time: "06:45", location: "Hotel", address: "", person: "Ambassador", contactPhone: "", notes: "", sortOrder: 10 }], departureTime: "07:30" };
    const html = renderToStaticMarkup(<ScheduleBuilder {...props} mode="builder" />);
    expect(html).toContain("Pre-departure pickups");
    expect(html).toContain("1 pickup · First at 06:45");
    expect(html).toContain('aria-expanded="true"');
    expect(html).toContain("Pickup timeline");
    expect(html).toContain('aria-label="Move pickup 1 up"');
    expect(html).toContain("More pickup details");
    expect(html).toContain("Official Departure 07:30");
  });

  it("keeps empty pickups collapsed, expands pickup errors, and identifies a fresh default assignment", () => {
    const props = builderProps();
    props.drivers = [{ id: "driver-rory", name: "Rory", defaultVehicle: "vehicle-bmw", isActive: true }];
    props.vehicles = [{ id: "vehicle-bmw", name: "BMW", isActive: true }];
    props.draft = { ...props.draft, id: null, driverId: "driver-rory", vehicleId: "vehicle-bmw", pickups: [] };
    const collapsed = renderToStaticMarkup(<ScheduleBuilder {...props} mode="builder" />);
    expect(collapsed).toContain("No pickups");
    expect(collapsed).toContain('aria-expanded="false"');
    expect(collapsed).toContain("Default assignment: Rory · BMW");
    props.errors = { integrityIssues: [{ type: "PICKUP_VALIDATION", severity: "error", field: "pickups", message: "Pickup location is required." }] };
    const expanded = renderToStaticMarkup(<ScheduleBuilder {...props} mode="builder" />);
    expect(expanded).toContain('aria-expanded="true"');
    expect(expanded).toContain("Add Pickup");
  });
});
