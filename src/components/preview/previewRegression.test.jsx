import { readFileSync } from "node:fs";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";
import PreviewUnavailable from "./PreviewUnavailable";
import PreviewWorkspace from "./PreviewWorkspace";
import { preparePreviewDocument } from "./previewPreparation";

describe("Preview regression boundary", () => {
  it("prepares a complete iframe document without throwing", () => {
    const result = preparePreviewDocument(() => ({ title: "Programme", styles: "body{}", bodyHtml: "<main>Ready</main>" }));
    expect(result.ok).toBe(true);
    expect(result.srcDoc).toContain("<main>Ready</main>");
  });

  it("catches document-generation failures", () => {
    const result = preparePreviewDocument(() => { throw new Error("Generation failed"); });
    expect(result).toMatchObject({ ok: false, error: { message: "Generation failed" } });
  });

  it("keeps normal preview available without global issue warnings and reserves unavailable for generation errors", () => {
    const preview = renderToStaticMarkup(<PreviewWorkspace tabs={[{ id: "executive", label: "Executive" }]} selectedView="executive" onViewChange={vi.fn()} scheduleDays={[]} documentTitle="Programme" srcDoc="<main />" onPrint={vi.fn()} onCopy={vi.fn()} onClose={vi.fn()} />);
    expect(preview).not.toContain("integrity");
    expect(preview).not.toContain("Review Issues");
    expect(preview).toContain("Print / Save PDF");
    expect(preview).toContain("Copy programme");
    const failed = renderToStaticMarkup(<PreviewUnavailable error={new Error("Broken preview")} onClose={vi.fn()} />);
    expect(failed).toContain("Technical details");
    expect(failed).toContain("Broken preview");
  });

  it("retains interactive modal controls and the default tab", () => {
    const html = renderToStaticMarkup(<PreviewWorkspace tabs={[{ id: "executive", label: "Full Executive Programme" }]} selectedView="executive" onViewChange={vi.fn()} scheduleDays={[]} documentTitle="Programme" srcDoc="<main />" onPrint={vi.fn()} onCopy={vi.fn()} onClose={vi.fn()} />);
    expect(html).toContain("Document Preview");
    expect(html).toContain('aria-selected="true"');
    expect(html).toContain("Print / Save PDF");
    expect(html).toContain("Close");
  });

  it("keeps the header Preview action wired and enabled for explanatory states", () => {
    const source = readFileSync(new URL("../../App.jsx", import.meta.url), "utf8");
    expect(source).toContain("onClick={openPreview}");
    expect(source).not.toContain('disabled={!officialOutputAllowed}');
    expect(source).toContain("isPreviewOpen && previewPreparation.ok");
    expect(source).not.toContain("Official preview is unavailable until blocking");
    expect(source).not.toContain("skipIntegrityConfirmation");
    expect(source).not.toContain("reviewPreviewIssues");
    expect(source).toContain("onPrint={() => handlePrintView(previewView, schedule.scheduleDays.map((day) => day.id))}");
    expect(source).toContain('setToolsInitialTool("print")');
    expect(source).not.toContain("frameWindow.print()");
  });
});
