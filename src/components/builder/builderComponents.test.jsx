import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";
import DayNavigator from "./DayNavigator";
import MovementCard from "./MovementCard";
import HandoverCard from "./HandoverCard";
import ImportantInfoCard from "./ImportantInfoCard";

const noop = vi.fn();

describe("builder presentation components", () => {
  it("renders days chronologically with selected and movement counts but no global issue count", () => {
    const html = renderToStaticMarkup(<DayNavigator days={[{ id: "late", date: "2026-02-02", title: "Late" }, { id: "early", date: "2026-01-01", title: "Early" }]} selectedDayId="early" movements={[{ id: "m", scheduleDayId: "early" }]} onSelect={noop} />);
    expect(html.indexOf("Early")).toBeLessThan(html.indexOf("Late"));
    expect(html).toContain('aria-current="date"');
    expect(html).toContain("1 movement");
    expect(html).not.toContain("issues");
  });

  it("renders a collapsed movement summary, editing highlight, badges, and semantic disclosure", () => {
    const movement = { id: "m", engagementDetails: "Official meeting", venue: "Consulate", driverId: "d", vehicleId: "v", driverStart: "08:00", continuesOvernight: true, conflictOverrides: [], audiences: { executive: true, operational: true, cg: false, marida: false, driverIds: [] } };
    const html = renderToStaticMarkup(<MovementCard movement={movement} index={0} count={1} drivers={[{ id: "d", name: "Driver" }]} vehicles={[{ id: "v", name: "Vehicle" }]} issues={[{ severity: "error" }]} editing onQuickEdit={noop} onFullEdit={noop} onDuplicate={noop} onMove={noop} onDelete={noop} />);
    expect(html).toContain("Official meeting");
    expect(html).toContain("Executive");
    expect(html).toContain("Conflict");
    expect(html).toContain("Overnight");
    expect(html).toContain('aria-expanded="false"');
    expect(html).toContain("border-l-4");
  });

  it("renders semantic handover and important-information disclosures with keyboard ordering controls", () => {
    const handover = renderToStaticMarkup(<HandoverCard note={{ id: "h", time: "09:00", vehicleId: "v", fromDriverId: "a", toDriverId: "b", location: "Garage" }} index={0} count={2} drivers={[{ id: "a", name: "A" }, { id: "b", name: "B" }]} vehicles={[{ id: "v", name: "Car" }]} issues={[]} onEdit={noop} onMove={noop} onDuplicate={noop} onDelete={noop} />);
    expect(handover).toContain("A → B");
    expect(handover).toContain('aria-expanded="false"');
    expect(handover).toContain('aria-label="Move handover down"');
    const info = renderToStaticMarkup(<ImportantInfoCard item={{ id: "i", type: "Route", title: "Airport", from: "Hotel", to: "Airport" }} index={0} count={2} onEdit={noop} onMove={noop} onDuplicate={noop} onDelete={noop} />);
    expect(info).toContain("Hotel → Airport");
    expect(info).toContain('aria-label="Move information down"');
  });
});
