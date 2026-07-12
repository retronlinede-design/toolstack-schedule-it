import { describe, expect, it } from "vitest";
import { buildMovementInterval, buildMovementTimeline, parseStrictTime } from "./timeIntervals";

describe("strict time parsing and timelines", () => {
  it.each([["00:00", 0], ["23:59", 1439], ["08:05", 485]])("parses %s", (value, minutes) => expect(parseStrictTime(value)).toMatchObject({ ok: true, minutes }));
  it.each(["8:00", "24:00", "12:60", "noon", 900, null])("rejects malformed time %s", (value) => expect(parseStrictTime(value).ok).toBe(false));

  it("builds valid same-day and overnight sequences", () => {
    expect(buildMovementTimeline({ departureTime: "08:00", arrivalTime: "09:00", continuesOvernight: false }).ok).toBe(true);
    const overnight = buildMovementTimeline({ departureTime: "23:30", arrivalTime: "00:20", continuesOvernight: true });
    expect(overnight).toMatchObject({ ok: true, rolloverCount: 1, values: { departureTime: 1410, arrivalTime: 1460 } });
    expect(buildMovementTimeline({ departureTime: "23:30", arrivalTime: "00:20", continuesOvernight: false }).ok).toBe(false);
    expect(buildMovementTimeline({ driverStart: "23:00", departureTime: "01:00", arrivalTime: "23:30", eventStartTime: "00:30", continuesOvernight: true }).issues.some((issue) => issue.type === "MULTIPLE_ROLLOVERS")).toBe(true);
  });

  it.each([
    [{ driverStart: "09:00", departureTime: "08:00" }, "departureTime"],
    [{ departureTime: "09:00", arrivalTime: "08:00" }, "arrivalTime"],
    [{ arrivalTime: "09:00", eventStartTime: "08:00" }, "eventStartTime"],
    [{ eventStartTime: "09:00", eventEndTime: "08:00" }, "eventEndTime"],
    [{ arrivalTime: "09:00", endTime: "08:00" }, "endTime"],
    [{ eventEndTime: "09:00", endTime: "08:00" }, "endTime"],
  ])("detects chronology errors at %s", (times, field) => {
    const result = buildMovementTimeline({ ...times, continuesOvernight: false });
    expect(result.issues.some((issue) => issue.field === field && issue.severity === "error")).toBe(true);
  });

  it("constructs deterministic priority intervals and reports incomplete timing", () => {
    const movement = { id: "m", driverStart: "08:00", departureTime: "08:15", arrivalTime: "09:00", eventStartTime: "09:10", eventEndTime: "10:00", endTime: "10:15", continuesOvernight: false };
    const first = buildMovementInterval(movement, { id: "d", date: "2026-01-01" });
    expect(first.interval).toMatchObject({ startField: "driverStart", endField: "endTime" });
    expect(buildMovementInterval(movement, { id: "d", date: "2026-01-01" })).toEqual(first);
    expect(buildMovementInterval({ id: "empty" }, { id: "d", date: "2026-01-01" }).issues.some((issue) => issue.type === "INCOMPLETE_TIMING")).toBe(true);
  });
});
