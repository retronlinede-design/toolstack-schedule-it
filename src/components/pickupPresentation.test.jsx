import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";
import ExecutiveView from "./ExecutiveView";
import OperationalView from "./OperationalView";
import { executivePickupText, operationalPickupText } from "../domain/pickupPresentation";
import { renderProgrammeDocumentMarkup } from "../print/renderProgrammeDocument";
import { validState } from "../import/testFixtures";

function stateWithPickup() {
  const state = validState();
  state.movements[0].pickups = [{ id: "p", time: "06:45", location: "Hotel Bayerischer Hof", address: "Promenadeplatz 2", person: "Ambassador", contactPhone: "+49 123", notes: "Use side entrance", sortOrder: 10 }];
  return state;
}

describe("pickup presentation parity", () => {
  it("uses executive-safe pickup content in React and standalone HTML", () => {
    const state = stateWithPickup();
    const entry = { ...state.movements[0], day: state.scheduleDays[0] };
    const react = renderToStaticMarkup(<ExecutiveView entriesByMonth={{ January: [entry] }} profile={state.profile} drivers={state.drivers} vehicles={state.vehicles} onEdit={vi.fn()} onDelete={vi.fn()} />);
    const html = renderProgrammeDocumentMarkup(state, "executive").bodyHtml;
    const safe = executivePickupText(entry);
    expect(react).toContain(safe); expect(html).toContain(safe);
    expect(react).not.toContain("+49 123"); expect(html).not.toContain("+49 123");
    expect(html).not.toContain("Use side entrance");
  });

  it("uses full operational and driver pickup content", () => {
    const state = stateWithPickup();
    const entry = { ...state.movements[0], day: state.scheduleDays[0] };
    const react = renderToStaticMarkup(<OperationalView entriesByMonth={{ January: [entry] }} vehicleHandoverNotes={[]} drivers={state.drivers} vehicles={state.vehicles} scheduleDays={state.scheduleDays} onEdit={vi.fn()} onDelete={vi.fn()} />);
    const operational = renderProgrammeDocumentMarkup(state, "operational").bodyHtml;
    const driver = renderProgrammeDocumentMarkup(state, "driver", { selectedDriverId: entry.driverId }).bodyHtml;
    [react, operational, driver].forEach((output) => { expect(output).toContain("Hotel Bayerischer Hof"); expect(output).toContain("+49 123"); expect(output).toContain("Use side entrance"); });
    expect(operational).toContain(operationalPickupText(entry));
  });
});
