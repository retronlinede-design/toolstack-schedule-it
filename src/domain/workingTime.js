import { buildMovementInterval } from "./timeIntervals";
import { buildDutySegments, intersectIntervals, intervalMinutes, unionIntervals } from "./dutySegments";
import { DEFAULT_WORKING_TIME_POLICY, normalizeWorkClassification, normalizeWorkingTimePolicy } from "./workingTimePolicy";

const DAY_MINUTES = 1440;
const duration = (minutes) => `${Math.floor(Math.max(0, minutes) / 60)}h ${String(Math.max(0, minutes) % 60).padStart(2, "0")}m`;
const clock = (absolute) => Number.isFinite(absolute) ? `${String(Math.floor((absolute % DAY_MINUTES) / 60)).padStart(2, "0")}:${String(absolute % 60).padStart(2, "0")}` : "-";

export function deriveDutyIntervals(schedule) {
  const days = new Map((schedule.scheduleDays || []).map((day) => [day.id, day]));
  const intervals = [];
  const warnings = [];
  (schedule.movements || []).forEach((movement) => {
    const classification = normalizeWorkClassification(movement.workClassification);
    if (classification === "nonWorking") return;
    const result = buildMovementInterval(movement, days.get(movement.scheduleDayId));
    if (!result.ok || !result.interval || result.interval.end <= result.interval.start) {
      warnings.push({ type: "WORKING_TIME_EXCLUDED", severity: "warning", movementId: movement.id, message: "Movement was excluded from working-time totals because a valid interval could not be derived." });
      return;
    }
    intervals.push({ ...result.interval, driverId: movement.driverId, date: days.get(movement.scheduleDayId)?.date || "", classification, overnight: result.interval.end >= result.interval.start - (result.interval.start % DAY_MINUTES) + DAY_MINUTES });
  });
  return { intervals, warnings };
}

export function calculateWorkingTime(schedule) {
  const policy = normalizeWorkingTimePolicy(schedule.workingTimePolicy);
  const drivers = new Map((schedule.drivers || []).map((driver) => [driver.id, driver]));
  const vehicles = new Map((schedule.vehicles || []).map((vehicle) => [vehicle.id, vehicle]));
  const { intervals, warnings } = deriveDutyIntervals(schedule);
  const groups = intervals.reduce((map, interval) => {
    const key = `${interval.driverId}:${interval.date}`;
    if (!map.has(key)) map.set(key, []);
    map.get(key).push(interval);
    return map;
  }, new Map());
  const dailySummaries = [...groups].map(([, records]) => {
    const first = records[0];
    const classified = (name) => records.filter((item) => item.classification === name);
    const duty = records.filter((item) => item.classification !== "break");
    const breaks = classified("break");
    const dutyUnion = unionIntervals(duty);
    const breakUnion = unionIntervals(breaks);
    const breaksWithinDuty = intersectIntervals(breakUnion, dutyUnion);
    const segments = buildDutySegments(duty, policy.splitDutyGapThresholdMinutes);
    const activeMinutes = intervalMinutes(classified("active"));
    const travelMinutes = intervalMinutes(classified("travel"));
    const standbyMinutes = intervalMinutes(classified("standby"));
    const recordedBreakMinutes = intervalMinutes(breaks);
    const eligible = [...classified("active"), ...(policy.travelCountsAsWorkingTime ? classified("travel") : []), ...(policy.standbyCountsAsWorkingTime ? classified("standby") : []), ...(policy.breakCountsAsWorkingTime ? breaks : [])];
    const countedBeforeBreak = intervalMinutes(eligible);
    const effectiveBreakMinutes = policy.breakCountsAsWorkingTime ? 0 : intervalMinutes(intersectIntervals(breakUnion, eligible));
    const countedWorkingMinutes = Math.max(0, countedBeforeBreak - (policy.breakCountsAsWorkingTime ? 0 : effectiveBreakMinutes));
    const localWarnings = [];
    if (breaks.length && !duty.length) localWarnings.push("Break recorded without a duty interval.");
    if (recordedBreakMinutes > intervalMinutes(breaksWithinDuty)) localWarnings.push("A break falls partly or wholly outside the recorded duty span.");
    if (effectiveBreakMinutes >= countedBeforeBreak && countedBeforeBreak > 0) localWarnings.push("Break deduction was capped by counted working time.");
    if (activeMinutes + travelMinutes + standbyMinutes > intervalMinutes(dutyUnion)) localWarnings.push("Overlapping working classifications were merged to avoid double-counting.");
    if (segments.length > 3) localWarnings.push("Multiple split-duty segments may require operational review.");
    const totalSpanMinutes = dutyUnion.length ? dutyUnion.at(-1).end - dutyUnion[0].start : 0;
    const splitDutyGapMinutes = segments.slice(1).reduce((total, segment) => total + (segment.gapBeforeMinutes || 0), 0);
    return {
      driverId: first.driverId, driverName: drivers.get(first.driverId)?.name || "Unassigned", vehicleName: vehicles.get((schedule.movements || []).find((movement) => movement.id === first.movementId)?.vehicleId)?.name || "-", date: first.date,
      dutyStart: dutyUnion[0]?.start ?? null, dutyEnd: dutyUnion.at(-1)?.end ?? null, dutyStartTime: clock(dutyUnion[0]?.start), dutyEndTime: clock(dutyUnion.at(-1)?.end), totalSpanMinutes, countedWorkingMinutes,
      activeMinutes, travelMinutes, standbyMinutes, recordedBreakMinutes, effectiveBreakMinutes, splitDutyGapMinutes, dutySegmentCount: segments.length,
      overtimeMinutes: Math.max(0, countedWorkingMinutes - policy.standardDailyMinutes), overnight: duty.some((item) => item.overnight), segments: segments.map((segment) => {
        const window = [{ start: segment.start, end: segment.end }];
        return { ...segment, spanMinutes: segment.end - segment.start, startTime: clock(segment.start), endTime: clock(segment.end), activeMinutes: intervalMinutes(intersectIntervals(classified("active"), window)), travelMinutes: intervalMinutes(intersectIntervals(classified("travel"), window)), standbyMinutes: intervalMinutes(intersectIntervals(classified("standby"), window)), breakMinutes: intervalMinutes(intersectIntervals(breaks, window)) };
      }), warnings: localWarnings,
    };
  }).sort((a, b) => (a.dutyStart ?? Infinity) - (b.dutyStart ?? Infinity) || a.driverName.localeCompare(b.driverName));

  const byDriver = dailySummaries.reduce((map, summary) => { if (!map.has(summary.driverId)) map.set(summary.driverId, []); map.get(summary.driverId).push(summary); return map; }, new Map());
  byDriver.forEach((summaries) => summaries.sort((a, b) => (a.dutyStart ?? Infinity) - (b.dutyStart ?? Infinity)).forEach((summary, index) => {
    const previous = summaries[index - 1];
    summary.restMinutes = previous?.dutyEnd != null && summary.dutyStart != null ? summary.dutyStart - previous.dutyEnd : null;
    summary.restDuration = summary.restMinutes == null ? "-" : duration(summary.restMinutes);
    summary.shortRest = summary.restMinutes != null && summary.restMinutes < policy.shortRestThresholdMinutes;
    if (summary.shortRest) summary.warnings.push("Rest period is below the configured threshold.");
    if (previous) previous.restBeforeNextDutyMinutes = summary.restMinutes;
  }));
  return { policy, dailySummaries, warnings: [...warnings, ...dailySummaries.flatMap((summary) => summary.warnings.map((message) => ({ type: "WORKING_TIME_WARNING", severity: "warning", driverId: summary.driverId, date: summary.date, message })))], formatDuration: duration };
}

export { DEFAULT_WORKING_TIME_POLICY };
