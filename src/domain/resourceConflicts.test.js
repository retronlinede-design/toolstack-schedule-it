import { describe, expect, it } from "vitest";
import { createConflictKey, detectResourceConflicts } from "./resourceConflicts";

function item(id, driverId, vehicleId, start, end, day = "day", conflictOverrides = []) {
  return { movement: { id, scheduleDayId: day, driverId, vehicleId, conflictOverrides }, interval: { start, end } };
}

function detect(items, field = "driverId", name = "DRIVER") {
  const movements = items.map((entry) => entry.movement);
  return detectResourceConflicts(movements, new Map(items.map((entry) => [entry.movement.id, entry.interval])), field, name);
}

describe("resource conflicts", () => {
  it("ignores separated and different-driver movements", () => {
    expect(detect([item("a", "d", "v1", 0, 30), item("b", "d", "v2", 50, 80)])).toEqual([]);
    expect(detect([item("a", "d1", "v", 0, 30), item("b", "d2", "v", 10, 20)])).toEqual([]);
  });

  it("classifies adjacency, short turnaround, and overlap", () => {
    expect(detect([item("a", "d", "v1", 0, 30), item("b", "d", "v2", 30, 50)])[0]).toMatchObject({ type: "DRIVER_SHORT_TURNAROUND", severity: "warning", turnaroundMinutes: 0 });
    expect(detect([item("a", "d", "v1", 0, 30), item("b", "d", "v2", 40, 50)])[0]).toMatchObject({ severity: "warning", turnaroundMinutes: 10 });
    expect(detect([item("a", "d", "v1", 0, 30), item("b", "d", "v2", 20, 50)])[0]).toMatchObject({ type: "DRIVER_OVERLAP", severity: "error", overlapMinutes: 10 });
  });

  it("detects cross-midnight and same-vehicle conflicts across drivers", () => {
    expect(detect([item("a", "d", "v1", 1430, 1460), item("b", "d", "v2", 1450, 1470)])[0].type).toBe("DRIVER_OVERLAP");
    expect(detect([item("a", "d1", "v", 0, 30), item("b", "d2", "v", 20, 40)], "vehicleId", "VEHICLE")[0].type).toBe("VEHICLE_OVERLAP");
  });

  it("honors a matching override and ignores a stale key", () => {
    const a = item("a", "d", "v1", 0, 30);
    const b = item("b", "d", "v2", 20, 50);
    const key = createConflictKey("DRIVER_OVERLAP", a.movement, b.movement, "d", a.interval, b.interval);
    a.movement.conflictOverrides = [{ conflictKey: key, reason: "Shared standby record", acknowledgedAt: "2026-01-01T00:00:00.000Z" }];
    expect(detect([a, b])[0]).toMatchObject({ severity: "warning", overridden: true });
    b.interval.start = 19;
    expect(detect([a, b])[0]).toMatchObject({ severity: "error", overridden: false });
  });
});
