import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";
import { createOperationalBreakMovement } from "../domain/operationalBreaks";
import { getExportDocument } from "../utils/exportHtml";
import { validState } from "../import/testFixtures";
import DriverView from "./DriverView";
import ExecutiveView from "./ExecutiveView";
import OperationalBreakDialog from "./OperationalBreakDialog";
import OperationalView from "./OperationalView";

const noop = vi.fn();

function viewProps(state, entries) {
  return {
    entriesByMonth: { January: entries },
    vehicleHandoverNotes: [],
    drivers: state.drivers,
    vehicles: state.vehicles,
    scheduleDays: state.scheduleDays,
    onEdit: noop,
    onDelete: noop,
  };
}

describe("Operational Add Break UI", () => {
  it("renders insertion controls before, between, and after a driver sequence only in Operational", () => {
    const state = validState();
    const first = { ...state.movements[0], id: "first", sortOrder: 10, engagementDetails: "First", day: state.scheduleDays[0] };
    const second = { ...state.movements[0], id: "second", sortOrder: 20, engagementDetails: "Second", day: state.scheduleDays[0] };
    const operational = renderToStaticMarkup(<OperationalView {...viewProps(state, [first, second])} onCreateOperationalBreak={noop} />);
    expect(operational.match(/Add Break/g)).toHaveLength(3);
    expect(operational.indexOf("Add Break")).toBeLessThan(operational.indexOf("First"));
    expect(operational.lastIndexOf("Add Break")).toBeGreaterThan(operational.indexOf("Second"));

    const driver = renderToStaticMarkup(<DriverView {...viewProps(state, [first, second])} selectedDriverId={first.driverId} onSelectedDriverChange={noop} />);
    expect(driver).not.toContain("Add Break");
  });

  it("shows required break fields and the inherited driver and vehicle", () => {
    const state = validState();
    const movement = state.movements[0];
    const html = renderToStaticMarkup(
      <OperationalBreakDialog
        context={{ scheduleDayId: movement.scheduleDayId, driverId: movement.driverId, vehicleId: movement.vehicleId, previousMovementId: movement.id, nextMovementId: "" }}
        day={state.scheduleDays[0]}
        driver={state.drivers.find((item) => item.id === movement.driverId)}
        vehicle={state.vehicles.find((item) => item.id === movement.vehicleId)}
        schedule={state}
        onSave={noop}
        onClose={noop}
      />,
    );
    ["Break start", "Break end", "Description / title", "Location / venue", "Address (optional)", "Greg", "Vito"].forEach((value) => expect(html).toContain(value));
    expect(html).toContain("autofocus");
    expect(html.match(/required/g)).toHaveLength(4);
  });

  it("renders an event-only break in Operational and its assigned Driver but no Executive output", () => {
    const state = validState();
    state.vehicleHandoverNotes = [];
    const source = state.movements[0];
    const input = {
      scheduleDayId: source.scheduleDayId,
      driverId: source.driverId,
      vehicleId: source.vehicleId,
      eventStartTime: "11:20",
      eventEndTime: "13:00",
      engagementDetails: "Lunch",
      venue: "Restaurant",
      address: "Main Street 1",
    };
    const movement = { ...createOperationalBreakMovement(input, "break-1"), sortOrder: 10 };
    state.movements = [movement];
    const entry = { ...movement, day: state.scheduleDays[0] };
    const operational = renderToStaticMarkup(<OperationalView {...viewProps(state, [entry])} />);
    const driver = renderToStaticMarkup(<DriverView {...viewProps(state, [entry])} selectedDriverId={movement.driverId} onSelectedDriverChange={noop} />);
    [operational, driver, getExportDocument(state, "operational").fullHtml, getExportDocument(state, "driver", { selectedDriverId: movement.driverId }).fullHtml].forEach((output) => {
      expect(output).toContain("11:20–13:00");
      expect(output).toContain("Lunch");
      expect(output).toContain("Restaurant");
      expect(output).not.toContain("Driver Start");
      expect(output).not.toContain("Departure");
      expect(output).not.toContain("Arrival");
      expect(output).not.toContain("Add Break");
    });

    const executive = renderToStaticMarkup(<ExecutiveView entriesByMonth={{ January: [entry] }} profile={state.profile} drivers={state.drivers} vehicles={state.vehicles} onEdit={noop} onDelete={noop} />);
    [executive, ...["executive", "executiveCg", "executiveMarida"].map((view) => getExportDocument(state, view).fullHtml)].forEach((output) => expect(output).not.toContain("Lunch"));
  });
});
