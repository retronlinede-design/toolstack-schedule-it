import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import IntegrityPanel from "./IntegrityPanel";
import { createIntegrityDisclosureState, integrityDisclosureReducer } from "./integrityDisclosure";

const warning = { type: "VEHICLE_SHORT_TURNAROUND", severity: "warning", message: "Short turnaround" };
const error = { type: "DRIVER_OVERLAP", severity: "error", message: "Driver overlaps", movementIds: ["a", "b"] };

describe("integrity disclosure", () => {
  it("defaults no-issue and warning-only panels to collapsed", () => {
    const empty = renderToStaticMarkup(<IntegrityPanel integrity={{ errors: [], warnings: [] }} />);
    const warnings = renderToStaticMarkup(<IntegrityPanel integrity={{ errors: [], warnings: [warning] }} />);
    expect(empty).toContain('aria-expanded="false"');
    expect(empty).toContain("No issues found");
    expect(empty).not.toContain("Integrity issue filters");
    expect(warnings).toContain('aria-expanded="false"');
    expect(warnings).not.toContain("Short turnaround");
  });

  it("defaults blocking errors to expanded and keeps export blocking visible", () => {
    const html = renderToStaticMarkup(<IntegrityPanel integrity={{ errors: [error], warnings: [] }} />);
    expect(html).toContain('aria-expanded="true"');
    expect(html).toContain("Official export blocked");
    expect(html).toContain("Integrity issue filters");
    expect(html).toContain("Driver overlaps");
  });

  it("handles manual disclosure and preserves it during the same blocking state", () => {
    let state = createIntegrityDisclosureState(true);
    state = integrityDisclosureReducer(state, { type: "toggle" });
    expect(state.expanded).toBe(false);
    expect(state.manuallyCollapsed).toBe(true);
    state = integrityDisclosureReducer(state, { type: "sync", hasBlockingErrors: true });
    expect(state.expanded).toBe(false);
    state = integrityDisclosureReducer(state, { type: "show" });
    expect(state.expanded).toBe(true);
  });

  it("expands once when blocking errors first appear", () => {
    let state = createIntegrityDisclosureState(false);
    state = integrityDisclosureReducer(state, { type: "sync", hasBlockingErrors: true });
    expect(state.expanded).toBe(true);
    state = integrityDisclosureReducer(state, { type: "toggle" });
    state = integrityDisclosureReducer(state, { type: "sync", hasBlockingErrors: true });
    expect(state.expanded).toBe(false);
  });
});
