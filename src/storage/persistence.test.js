import { describe, expect, it, vi } from "vitest";
import { createPersistenceController, shouldWarnBeforeUnload } from "./persistence";

describe("persistence controller", () => {
  it("moves saving to saved only after a verified result", () => {
    const statuses = [];
    const controller = createPersistenceController({ save: () => ({ ok: true, savedAt: "now" }), onStatus: (value) => statuses.push(value), setTimer: vi.fn(() => 1), clearTimer: vi.fn() });
    controller.schedule({ value: 1 }, 1);
    controller.flush();
    expect(statuses.map((item) => item.status)).toEqual(["saving", "saving", "saved"]);
  });

  it("keeps failed state and retries the latest revision", () => {
    const statuses = [];
    const saved = [];
    let fail = true;
    const controller = createPersistenceController({
      save: (state) => { saved.push(state); return fail ? { ok: false, code: "WRITE_FAILED" } : { ok: true, savedAt: "now" }; },
      onStatus: (value) => statuses.push(value), setTimer: vi.fn(() => 1), clearTimer: vi.fn(),
    });
    controller.schedule({ value: 1 }, 1);
    controller.schedule({ value: 2 }, 2);
    controller.flush();
    expect(statuses.at(-1).status).toBe("failed");
    expect(statuses.some((item) => item.status === "saved")).toBe(false);
    fail = false;
    controller.retry();
    expect(saved.at(-1)).toEqual({ value: 2 });
    expect(statuses.at(-1)).toMatchObject({ status: "saved", persistedRevision: 2 });
  });

  it("does not let a stale revision mark a newer one saved", () => {
    const statuses = [];
    let controller;
    controller = createPersistenceController({
      save: () => { controller.schedule({ value: 2 }, 2); return { ok: true, savedAt: "old" }; },
      onStatus: (value) => statuses.push(value), setTimer: vi.fn(() => 1), clearTimer: vi.fn(),
    });
    controller.schedule({ value: 1 }, 1);
    controller.flush();
    expect(statuses.at(-1)).toMatchObject({ status: "saving", currentRevision: 2, stale: true });
  });

  it("warns before unload whenever data is not verified saved", () => {
    expect(shouldWarnBeforeUnload("saved")).toBe(false);
    expect(shouldWarnBeforeUnload("saving")).toBe(true);
    expect(shouldWarnBeforeUnload("failed")).toBe(true);
  });
});
