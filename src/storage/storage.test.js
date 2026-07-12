import { describe, expect, it, vi } from "vitest";
import { defaultScheduleState } from "../data/defaultData";
import { readStorageKey } from "./storage";
import { verifiedWriteSchedule, verifyScheduleReadback } from "./persistence";
import { memoryStorage } from "./testUtils";

describe("structured storage reads", () => {
  it("distinguishes missing, valid, corrupt, and unavailable values", () => {
    expect(readStorageKey(memoryStorage(), "key")).toEqual({ ok: true, status: "missing" });
    const valid = readStorageKey(memoryStorage({ key: '{"a":1}' }), "key");
    expect(valid).toMatchObject({ ok: true, status: "found", raw: '{"a":1}', value: { a: 1 } });
    const corrupt = readStorageKey(memoryStorage({ key: "{" }), "key");
    expect(corrupt).toMatchObject({ ok: false, status: "corrupt", raw: "{" });
    expect(readStorageKey(null, "key")).toMatchObject({ ok: false, status: "unavailable" });
  });

  it("reports a throwing getter as unavailable", () => {
    expect(readStorageKey({ getItem: () => { throw new Error("blocked"); } }, "key")).toMatchObject({ ok: false, status: "unavailable" });
  });
});

describe("verified writes", () => {
  it("writes, reads back exactly, parses, and validates", () => {
    const storage = memoryStorage();
    expect(verifiedWriteSchedule(storage, "key", defaultScheduleState)).toMatchObject({ ok: true, status: "saved" });
  });

  it.each([
    ["setItem throws", { getItem: vi.fn(), setItem: () => { throw new Error("quota"); } }, "WRITE_FAILED"],
    ["silent failure", { getItem: () => null, setItem: vi.fn() }, "READBACK_FAILED"],
    ["missing readback", { getItem: () => null, setItem: vi.fn() }, "READBACK_FAILED"],
    ["mismatched readback", { getItem: () => "other", setItem: vi.fn() }, "READBACK_MISMATCH"],
    ["readback throws", { getItem: () => { throw new Error("blocked"); }, setItem: vi.fn() }, "READBACK_FAILED"],
  ])("detects %s", (_label, storage, code) => {
    expect(verifiedWriteSchedule(storage, "key", defaultScheduleState)).toMatchObject({ ok: false, code });
  });

  it("distinguishes invalid JSON and invalid state during verification", () => {
    expect(verifyScheduleReadback("{")).toMatchObject({ ok: false, code: "READBACK_INVALID_JSON" });
    expect(verifyScheduleReadback("{}" )).toMatchObject({ ok: false, code: "READBACK_INVALID_STATE" });
  });
});
