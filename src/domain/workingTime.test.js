import { describe, expect, it } from "vitest";
import { unionIntervals } from "./dutySegments";
import { calculateWorkingTime } from "./workingTime";
import { DEFAULT_WORKING_TIME_POLICY, normalizeWorkingTimePolicy, validateWorkingTimePolicy } from "./workingTimePolicy";

const day = (id, date) => ({ id, date, title: date });
const movement = (id, dayId, start, end, classification = "active", extra = {}) => ({ id, scheduleDayId: dayId, driverId: "d", vehicleId: "v", driverStart: start, endTime: end, continuesOvernight: false, workClassification: classification, ...extra });
const schedule = (movements, policy, days = [day("day", "2026-07-12")]) => ({ drivers: [{ id: "d", name: "Driver" }], vehicles: [{ id: "v", name: "Car" }], scheduleDays: days, movements, workingTimePolicy: policy });

describe("working-time policy", () => {
  it("normalizes defaults and preserves valid custom values", () => {
    expect(normalizeWorkingTimePolicy()).toEqual(DEFAULT_WORKING_TIME_POLICY);
    expect(normalizeWorkingTimePolicy({ standardDailyMinutes: 360 }).standardDailyMinutes).toBe(360);
  });
  it("rejects invalid bounds and types", () => {
    expect(validateWorkingTimePolicy({ ...DEFAULT_WORKING_TIME_POLICY, standardDailyMinutes: 10 }).ok).toBe(false);
    expect(validateWorkingTimePolicy({ ...DEFAULT_WORKING_TIME_POLICY, standbyCountsAsWorkingTime: "yes" }).ok).toBe(false);
  });
});

describe("interval union", () => {
  it("merges overlap, nesting, and adjacency deterministically", () => {
    expect(unionIntervals([{ start: 90, end: 120, movementId: "b" }, { start: 0, end: 100, movementId: "a" }, { start: 20, end: 30, movementId: "c" }, { start: 120, end: 140, movementId: "d" }])).toEqual([{ start: 0, end: 140, movementIds: ["a", "c", "b", "d"] }]);
  });
});

describe("daily working-time engine", () => {
  it("avoids double counting and calculates policy-based overtime", () => {
    const result = calculateWorkingTime(schedule([movement("a", "day", "08:00", "10:00"), movement("b", "day", "09:30", "11:00")], { ...DEFAULT_WORKING_TIME_POLICY, standardDailyMinutes: 120 }));
    expect(result.dailySummaries[0]).toMatchObject({ totalSpanMinutes: 180, countedWorkingMinutes: 180, overtimeMinutes: 60, dutySegmentCount: 1 });
  });
  it("deduplicates and subtracts overlapping breaks", () => {
    const result = calculateWorkingTime(schedule([movement("a", "day", "08:00", "12:00"), movement("b1", "day", "09:00", "10:00", "break"), movement("b2", "day", "09:30", "10:30", "break")]));
    expect(result.dailySummaries[0]).toMatchObject({ recordedBreakMinutes: 90, effectiveBreakMinutes: 90, countedWorkingMinutes: 150 });
  });
  it("warns about breaks outside duty and breaks without duty", () => {
    const outside = calculateWorkingTime(schedule([movement("a", "day", "08:00", "09:00"), movement("b", "day", "10:00", "11:00", "break")])).dailySummaries[0];
    expect(outside.warnings.join(" ")).toContain("outside");
    const onlyBreak = calculateWorkingTime(schedule([movement("b", "day", "10:00", "11:00", "break")])).dailySummaries[0];
    expect(onlyBreak.warnings.join(" ")).toContain("without a duty");
  });
  it("retains standby and travel totals while applying count policies", () => {
    const records = [movement("a", "day", "08:00", "09:00"), movement("t", "day", "09:00", "10:00", "travel"), movement("s", "day", "10:00", "11:00", "standby")];
    const counted = calculateWorkingTime(schedule(records)).dailySummaries[0];
    const excluded = calculateWorkingTime(schedule(records, { ...DEFAULT_WORKING_TIME_POLICY, travelCountsAsWorkingTime: false, standbyCountsAsWorkingTime: false })).dailySummaries[0];
    expect(counted).toMatchObject({ activeMinutes: 60, travelMinutes: 60, standbyMinutes: 60, countedWorkingMinutes: 180 });
    expect(excluded).toMatchObject({ travelMinutes: 60, standbyMinutes: 60, countedWorkingMinutes: 60 });
  });
  it("creates split-duty segments only above the configured threshold", () => {
    const records = [movement("a", "day", "06:00", "10:00"), movement("b", "day", "12:00", "14:00")];
    expect(calculateWorkingTime(schedule(records)).dailySummaries[0].dutySegmentCount).toBe(1);
    const split = calculateWorkingTime(schedule([movement("a", "day", "06:00", "10:00"), movement("b", "day", "15:00", "19:00")])).dailySummaries[0];
    expect(split).toMatchObject({ dutySegmentCount: 2, splitDutyGapMinutes: 300, totalSpanMinutes: 780, countedWorkingMinutes: 480 });
    expect(split.segments.map((segment) => segment.activeMinutes)).toEqual([240, 240]);
  });
  it("attributes overnight duty to its schedule date and uses absolute rest boundaries", () => {
    const days = [day("one", "2026-07-12"), day("two", "2026-07-13")];
    const records = [movement("night", "one", "23:00", "01:00", "active", { continuesOvernight: true }), movement("next", "two", "12:00", "13:00")];
    const summaries = calculateWorkingTime(schedule(records, DEFAULT_WORKING_TIME_POLICY, days)).dailySummaries;
    expect(summaries[0]).toMatchObject({ date: "2026-07-12", overnight: true, countedWorkingMinutes: 120 });
    expect(summaries[1].restMinutes).toBe(660);
    expect(summaries[1].shortRest).toBe(false);
  });
  it("warns using configured short-rest wording and remains deterministic", () => {
    const days = [day("one", "2026-07-12"), day("two", "2026-07-13")];
    const records = [movement("a", "one", "18:00", "23:00"), movement("b", "two", "06:00", "07:00")];
    const first = calculateWorkingTime(schedule(records, DEFAULT_WORKING_TIME_POLICY, days));
    const second = calculateWorkingTime(schedule(records, DEFAULT_WORKING_TIME_POLICY, days));
    expect(first.dailySummaries[1].warnings).toContain("Rest period is below the configured threshold.");
    expect(second).toEqual(first);
    expect(records[0].driverStart).toBe("18:00");
  });
  it("uses the first pickup as interval start while preserving movement classification", () => {
    const record = movement("pickup", "day", "", "08:00", "standby", { pickups: [{ id: "p", time: "06:45", location: "Hotel", address: "", person: "", contactPhone: "", notes: "", sortOrder: 10 }], departureTime: "07:30" });
    const summary = calculateWorkingTime(schedule([record])).dailySummaries[0];
    expect(summary).toMatchObject({ dutyStartTime: "06:45", standbyMinutes: 75, countedWorkingMinutes: 75 });
  });
});
