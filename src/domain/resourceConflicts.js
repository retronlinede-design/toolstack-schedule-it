import { SHORT_TURNAROUND_MINUTES } from "./timeIntervals";

export function createConflictKey(type, movementA, movementB, resourceId, intervalA, intervalB) {
  const movements = [movementA.id, movementB.id].sort();
  const days = [movementA.scheduleDayId, movementB.scheduleDayId].sort();
  return [type, resourceId, ...movements, ...days, intervalA.start, intervalA.end, intervalB.start, intervalB.end].join("|");
}

export function hasValidOverride(movements, conflictKey) {
  return movements.some((movement) => Array.isArray(movement.conflictOverrides) && movement.conflictOverrides.some((override) => override.conflictKey === conflictKey && typeof override.reason === "string" && override.reason.trim().length >= 10));
}

export function detectResourceConflicts(movements, intervalsById, resourceField, resourceName) {
  const conflicts = [];
  const grouped = new Map();
  movements.forEach((movement) => {
    const resourceId = movement[resourceField];
    const interval = intervalsById.get(movement.id);
    if (!resourceId || !interval) return;
    if (!grouped.has(resourceId)) grouped.set(resourceId, []);
    grouped.get(resourceId).push({ movement, interval });
  });
  grouped.forEach((items, resourceId) => {
    items.sort((a, b) => a.interval.start - b.interval.start || a.movement.id.localeCompare(b.movement.id));
    for (let left = 0; left < items.length; left += 1) {
      for (let right = left + 1; right < items.length; right += 1) {
        const a = items[left];
        const b = items[right];
        const gap = b.interval.start - a.interval.end;
        if (gap >= SHORT_TURNAROUND_MINUTES) break;
        const overlapMinutes = Math.max(0, Math.min(a.interval.end, b.interval.end) - Math.max(a.interval.start, b.interval.start));
        const type = overlapMinutes > 0 ? `${resourceName}_OVERLAP` : `${resourceName}_SHORT_TURNAROUND`;
        const key = createConflictKey(type, a.movement, b.movement, resourceId, a.interval, b.interval);
        const overridden = overlapMinutes > 0 && hasValidOverride([a.movement, b.movement], key);
        conflicts.push({
          type,
          severity: overlapMinutes > 0 && !overridden ? "error" : "warning",
          conflictKey: key,
          overridden,
          resourceId,
          [`${resourceField}`]: resourceId,
          movementIds: [a.movement.id, b.movement.id].sort(),
          dayIds: [a.movement.scheduleDayId, b.movement.scheduleDayId].sort(),
          overlapMinutes,
          turnaroundMinutes: overlapMinutes ? null : gap,
          message: overlapMinutes > 0 ? `${resourceName.toLowerCase()} assignments overlap by ${overlapMinutes} minutes${overridden ? " (override acknowledged)" : ""}.` : gap === 0 ? `${resourceName.toLowerCase()} assignments are exactly adjacent.` : `${resourceName.toLowerCase()} turnaround is only ${gap} minutes.`,
        });
      }
    }
  });
  return conflicts;
}
