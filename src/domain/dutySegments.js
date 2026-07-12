export function unionIntervals(intervals) {
  const sorted = intervals.filter((item) => Number.isFinite(item.start) && Number.isFinite(item.end) && item.end >= item.start).map((item) => ({ ...item })).sort((a, b) => a.start - b.start || a.end - b.end || String(a.movementId || "").localeCompare(String(b.movementId || "")));
  return sorted.reduce((merged, interval) => {
    const previous = merged.at(-1);
    if (!previous || interval.start > previous.end) merged.push({ start: interval.start, end: interval.end, movementIds: interval.movementId ? [interval.movementId] : [] });
    else {
      previous.end = Math.max(previous.end, interval.end);
      if (interval.movementId && !previous.movementIds.includes(interval.movementId)) previous.movementIds.push(interval.movementId);
    }
    return merged;
  }, []);
}

export const intervalMinutes = (intervals) => unionIntervals(intervals).reduce((total, interval) => total + interval.end - interval.start, 0);

export function intersectIntervals(left, right) {
  const intersections = [];
  unionIntervals(left).forEach((a) => unionIntervals(right).forEach((b) => {
    const start = Math.max(a.start, b.start);
    const end = Math.min(a.end, b.end);
    if (end > start) intersections.push({ start, end });
  }));
  return unionIntervals(intersections);
}

export function buildDutySegments(intervals, thresholdMinutes) {
  const ordered = unionIntervals(intervals);
  return ordered.reduce((segments, interval) => {
    const previous = segments.at(-1);
    const gap = previous ? interval.start - previous.end : null;
    if (!previous || gap > thresholdMinutes) segments.push({ start: interval.start, end: interval.end, intervals: [interval], gapBeforeMinutes: gap });
    else { previous.end = Math.max(previous.end, interval.end); previous.intervals.push(interval); }
    return segments;
  }, []);
}
