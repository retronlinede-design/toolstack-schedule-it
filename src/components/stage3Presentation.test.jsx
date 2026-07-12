import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";
import PreviewWorkspace from "./preview/PreviewWorkspace";
import ImportantInfoView from "./ImportantInfoView";
import IntegrityPanel from "./integrity/IntegrityPanel";

describe("stage 3 presentation", () => {
  it("renders semantic preview tabs, selected panel, actions, and descriptive frame", () => {
    const html = renderToStaticMarkup(<PreviewWorkspace tabs={[{ id: "executive", label: "Full Executive Programme" }, { id: "driver", label: "Driver" }]} selectedView="executive" onViewChange={vi.fn()} scheduleDays={[{ date: "2026-07-12" }]} integrity={{ errors: [] }} documentTitle="Official Programme" srcDoc="<p>Programme</p>" onPrint={vi.fn()} onCopy={vi.fn()} onClose={vi.fn()} />);
    expect(html).toContain('role="tablist"');
    expect(html).toContain('role="tab"');
    expect(html).toContain('aria-selected="true"');
    expect(html).toContain('role="tabpanel"');
    expect(html).toContain("Print / Save PDF");
    expect(html).toContain("Official Programme");
  });

  it("renders all important contact fields", () => {
    const html = renderToStaticMarkup(<ImportantInfoView items={[{ id: "i", type: "Contact", name: "Duty Officer", phone: "+49 123", email: "duty@example.test", notes: "Call first" }]} />);
    expect(html).toContain("Duty Officer");
    expect(html).toContain("+49 123");
    expect(html).toContain("duty@example.test");
  });

  it("groups integrity issues and communicates export blocking without colour alone", () => {
    const html = renderToStaticMarkup(<IntegrityPanel integrity={{ errors: [{ type: "DRIVER_OVERLAP", severity: "error", message: "Driver overlaps", driverId: "d", movementIds: ["a", "b"] }], warnings: [{ type: "VEHICLE_SHORT_TURNAROUND", severity: "warning", message: "Short turnaround" }] }} />);
    expect(html).toContain("1 errors");
    expect(html).toContain("1 warnings");
    expect(html).toContain("Official export blocked");
    expect(html).toContain('aria-expanded="false"');
  });
});
