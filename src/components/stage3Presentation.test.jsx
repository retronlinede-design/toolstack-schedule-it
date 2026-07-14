import { readFileSync } from "node:fs";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";
import PreviewWorkspace from "./preview/PreviewWorkspace";
import ImportantInfoView from "./ImportantInfoView";
import ExportPanel from "./ExportPanel";

describe("stage 3 presentation", () => {
  it("renders semantic preview tabs, selected panel, actions, and descriptive frame", () => {
    const html = renderToStaticMarkup(<PreviewWorkspace tabs={[{ id: "executive", label: "Full Executive Programme" }, { id: "driver", label: "Driver" }]} selectedView="executive" onViewChange={vi.fn()} scheduleDays={[{ date: "2026-07-12" }]} documentTitle="Official Programme" srcDoc="<p>Programme</p>" onPrint={vi.fn()} onCopy={vi.fn()} onClose={vi.fn()} />);
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

  it("removes global integrity presentation while keeping output actions available", () => {
    const appSource = readFileSync(new URL("../App.jsx", import.meta.url), "utf8");
    const html = renderToStaticMarkup(<ExportPanel selectedDriverName="Greg" hasDrivers onClose={vi.fn()} onPrintView={vi.fn()} onCopyHtml={vi.fn()} onExportJson={vi.fn()} onImportJson={vi.fn()} onReplaceJson={vi.fn()} onApplyHtmlImport={vi.fn()} />);
    expect(appSource).not.toContain("Schedule Integrity");
    expect(appSource).not.toContain("IntegrityPanel");
    expect(html).not.toContain("Review Issues");
    expect(html).not.toContain("integrity");
    expect(html).toContain("Print Full Executive Programme");
    expect(html).toContain("Copy Full Executive HTML");
  });
});
