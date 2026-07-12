import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

describe("responsive application structure", () => {
  const css = readFileSync(new URL("./index.css", import.meta.url), "utf8");
  const app = readFileSync(new URL("./App.jsx", import.meta.url), "utf8");
  const builder = readFileSync(new URL("./components/ScheduleBuilder.jsx", import.meta.url), "utf8");
  const dayNavigator = readFileSync(new URL("./components/builder/DayNavigator.jsx", import.meta.url), "utf8");

  it("uses a compact shrinkable shell without a page-level minimum width", () => {
    expect(css).toContain("max-width: 1220px");
    expect(css).toContain(".ts-container { width: 100%; min-width: 0;");
    expect(css).not.toMatch(/^body\s*\{[^}]*min-width:/m);
  });

  it("wraps header actions before they force overflow", () => {
    expect(app).toContain("lg:flex-row");
    expect(app).toContain("grid w-full grid-cols-3");
  });

  it("uses later wide-grid breakpoints while preserving deliberate scroll containers", () => {
    expect(builder).toContain("md:grid-cols-2 xl:grid-cols-4");
    expect(dayNavigator).toContain("overflow-x-auto");
    expect(builder).toContain("min-w-[760px]");
  });
});
