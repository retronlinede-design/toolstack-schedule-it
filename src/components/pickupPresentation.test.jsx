import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";
import DriverView from "./DriverView";
import ExecutiveView from "./ExecutiveView";
import OperationalView from "./OperationalView";
import { executivePickupText, formatOperationalEventTime } from "../domain/pickupPresentation";
import { getExportDocument } from "../utils/exportHtml";
import { validState } from "../import/testFixtures";

function stateWithPickup() {
  const state = validState();
  state.movements[0] = {
    ...state.movements[0],
    eventStartTime: "09:30",
    eventEndTime: "11:00",
    pickups: [
      { id: "p-later", time: "08:20", location: "Consulate", address: "Second Street 2", person: "Delegation", contactPhone: "+49 456", notes: "Meet at reception", sortOrder: 20 },
      { id: "p-first", time: "08:00", location: "Hotel Bayerischer Hof", address: "Promenadeplatz 2", person: "Ambassador", contactPhone: "+49 123", notes: "Use side entrance", sortOrder: 10 },
    ],
  };
  return state;
}

describe("pickup presentation parity", () => {
  it("uses executive-safe pickup content in React and standalone HTML", () => {
    const state = stateWithPickup();
    const entry = { ...state.movements[0], day: state.scheduleDays[0] };
    const react = renderToStaticMarkup(<ExecutiveView entriesByMonth={{ January: [entry] }} profile={state.profile} drivers={state.drivers} vehicles={state.vehicles} onEdit={vi.fn()} onDelete={vi.fn()} />);
    const html = getExportDocument(state, "executive").fullHtml;
    const safe = executivePickupText(entry);
    expect(react).toContain(safe); expect(html).toContain(safe);
    expect(react).not.toContain("+49 123"); expect(html).not.toContain("+49 123");
    expect(html).not.toContain("Use side entrance");
  });

  it("uses full operational and driver pickup content", () => {
    const state = stateWithPickup();
    const entry = { ...state.movements[0], day: state.scheduleDays[0] };
    const react = renderToStaticMarkup(<OperationalView entriesByMonth={{ January: [entry] }} vehicleHandoverNotes={[]} drivers={state.drivers} vehicles={state.vehicles} scheduleDays={state.scheduleDays} onEdit={vi.fn()} onDelete={vi.fn()} />);
    const operational = getExportDocument(state, "operational").fullHtml;
    const driver = getExportDocument(state, "driver", { selectedDriverId: entry.driverId }).fullHtml;
    [react, operational, driver].forEach((output) => {
      expect(output).toContain("Pickups");
      expect(output).toContain("08:00");
      expect(output).toContain("08:20");
      expect(output.indexOf("08:00")).toBeLessThan(output.indexOf("08:20"));
      expect(output).toContain("Ambassador");
      expect(output).toContain("Hotel Bayerischer Hof");
      expect(output).toContain("Promenadeplatz 2");
      expect(output).toContain("+49 123");
      expect(output).toContain("Use side entrance");
      expect(output).toContain("Event / Meeting Time");
      expect(output).toContain("09:30–11:00");
    });
    expect(operational).toContain("operational-pickups");
  });

  it("shows a distinct event range for every movement on the same day", () => {
    const state = validState();
    const ranges = [["09:30", "11:00", "Meeting 1"], ["11:30", "13:00", "Lunch"], ["14:00", "16:00", "Meeting 2"]];
    const entries = ranges.map(([eventStartTime, eventEndTime, engagementDetails], index) => ({
      ...state.movements[0],
      id: `movement-${index + 1}`,
      sortOrder: (index + 1) * 10,
      eventStartTime,
      eventEndTime,
      engagementDetails,
      day: state.scheduleDays[0],
    }));
    const react = renderToStaticMarkup(<OperationalView entriesByMonth={{ January: entries }} vehicleHandoverNotes={[]} drivers={state.drivers} vehicles={state.vehicles} scheduleDays={state.scheduleDays} onEdit={vi.fn()} onDelete={vi.fn()} />);
    ["09:30–11:00", "11:30–13:00", "14:00–16:00", "Meeting 1", "Lunch", "Meeting 2"].forEach((value) => expect(react).toContain(value));
  });

  it("keeps Driver filtering while reusing the improved Operational presentation", () => {
    const state = stateWithPickup();
    const selected = { ...state.movements[0], day: state.scheduleDays[0], engagementDetails: "Selected meeting" };
    const other = {
      ...state.movements[0],
      id: "movement-other",
      driverId: "driver-rory",
      engagementDetails: "Other driver meeting",
      eventStartTime: "14:00",
      eventEndTime: "16:00",
      day: state.scheduleDays[0],
    };
    const react = renderToStaticMarkup(
      <DriverView
        entriesByMonth={{ January: [selected, other] }}
        vehicleHandoverNotes={[]}
        drivers={state.drivers}
        vehicles={state.vehicles}
        scheduleDays={state.scheduleDays}
        selectedDriverId="driver-greg"
        onSelectedDriverChange={vi.fn()}
        onEdit={vi.fn()}
        onDelete={vi.fn()}
      />,
    );
    state.movements = [selected, other];
    const standalone = getExportDocument(state, "driver", { selectedDriverId: "driver-greg" }).fullHtml;
    [react, standalone].forEach((output) => {
      expect(output).toContain("Selected meeting");
      expect(output).toContain("09:30–11:00");
      expect(output).toContain("Hotel Bayerischer Hof");
      expect(output).not.toContain("Other driver meeting");
      expect(output).not.toContain("14:00–16:00");
    });
  });

  it("formats complete, partial, and absent event times from stored values", () => {
    expect(formatOperationalEventTime({ eventStartTime: "09:30", eventEndTime: "11:00" })).toBe("09:30–11:00");
    expect(formatOperationalEventTime({ eventStartTime: "09:30", eventEndTime: "" })).toBe("09:30");
    expect(formatOperationalEventTime({ eventStartTime: "", eventEndTime: "11:00" })).toBe("11:00");
    expect(formatOperationalEventTime({ eventStartTime: "", eventEndTime: "" })).toBe("-");
  });
});
