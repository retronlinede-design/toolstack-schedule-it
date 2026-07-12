export function duplicateMovementForSchedule(movement, id, sortOrder) {
  return { ...movement, id, sortOrder, conflictOverrides: [] };
}
