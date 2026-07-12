import { describe, expect, it } from "vitest";
import { APP_KEY, initializeScheduleStorage } from "../utils/storage";
import { memoryStorage } from "./testUtils";

describe("primary initialization protection", () => {
  it("preserves corrupt raw data and never overwrites the primary", () => {
    const storage = memoryStorage({ [APP_KEY]: "{broken" });
    const result = initializeScheduleStorage(storage);
    expect(result).toMatchObject({ ok: false, status: "recovery-required", raw: "{broken", recovery: { ok: true } });
    expect(storage.values.get(APP_KEY)).toBe("{broken");
    expect([...storage.values.keys()].some((key) => key.startsWith(`${APP_KEY}.recovery.`))).toBe(true);
  });

  it("blocks when storage access is unavailable", () => {
    const result = initializeScheduleStorage({ getItem: () => { throw new Error("blocked"); } });
    expect(result).toMatchObject({ ok: false, status: "unavailable" });
  });
});
