import { describe, expect, it } from "vitest";
import { defaultScheduleState } from "../data/defaultData";
import { preserveRawRecovery, replaceCorruptWithNew } from "./recovery";
import { memoryStorage } from "./testUtils";

describe("recovery", () => {
  it("preserves the exact raw value under unique timestamped keys without deleting copies", () => {
    const storage = memoryStorage({ existing: "keep" });
    const a = preserveRawRecovery(storage, "primary", "{broken", { now: () => 10, idFactory: () => "a" });
    const b = preserveRawRecovery(storage, "primary", "{broken", { now: () => 11, idFactory: () => "b" });
    expect(a).toMatchObject({ ok: true, key: "primary.recovery.10.a", raw: "{broken" });
    expect(b.key).not.toBe(a.key);
    expect(storage.values.get(a.key)).toBe("{broken");
    expect(storage.values.get(b.key)).toBe("{broken");
    expect(storage.values.get("existing")).toBe("keep");
  });

  it("requires confirmation and blocks replacement when recovery verification fails", () => {
    const storage = memoryStorage({ primary: "{broken" });
    expect(replaceCorruptWithNew({ storage, primaryKey: "primary", raw: "{broken", newState: defaultScheduleState, confirmed: false })).toMatchObject({ code: "CONFIRMATION_REQUIRED" });
    storage.getItem.mockImplementation((key) => key === "primary" ? "{broken" : null);
    expect(replaceCorruptWithNew({ storage, primaryKey: "primary", raw: "{broken", newState: defaultScheduleState, confirmed: true })).toMatchObject({ ok: false, code: "READBACK_FAILED" });
    expect(storage.values.get("primary")).toBe("{broken");
  });
});
