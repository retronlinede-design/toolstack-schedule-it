export const DEFAULT_WORKING_TIME_POLICY = Object.freeze({
  standardDailyMinutes: 480,
  shortRestThresholdMinutes: 660,
  shortTurnaroundMinutes: 15,
  standbyCountsAsWorkingTime: true,
  travelCountsAsWorkingTime: true,
  breakCountsAsWorkingTime: false,
  splitDutyGapThresholdMinutes: 120,
});

export const WORK_CLASSIFICATIONS = Object.freeze(["active", "standby", "break", "travel", "nonWorking"]);

const BOUNDS = {
  standardDailyMinutes: [60, 1440],
  shortRestThresholdMinutes: [0, 1440],
  shortTurnaroundMinutes: [0, 720],
  splitDutyGapThresholdMinutes: [0, 720],
};

export function normalizeWorkingTimePolicy(policy) {
  const source = policy && typeof policy === "object" && !Array.isArray(policy) ? policy : {};
  return Object.fromEntries(Object.entries(DEFAULT_WORKING_TIME_POLICY).map(([key, fallback]) => {
    const value = source[key];
    if (typeof fallback === "boolean") return [key, typeof value === "boolean" ? value : fallback];
    const [minimum, maximum] = BOUNDS[key];
    return [key, Number.isFinite(value) && value >= minimum && value <= maximum ? value : fallback];
  }));
}

export function normalizeWorkClassification(value) {
  return WORK_CLASSIFICATIONS.includes(value) ? value : "active";
}

export function validateWorkingTimePolicy(policy) {
  if (!policy || typeof policy !== "object" || Array.isArray(policy)) return { ok: false, errors: ["Working-time policy must be a plain object."] };
  const errors = [];
  const allowed = new Set(Object.keys(DEFAULT_WORKING_TIME_POLICY));
  Object.keys(policy).filter((key) => !allowed.has(key)).forEach((key) => errors.push(`Unknown working-time policy field: ${key}.`));
  Object.entries(DEFAULT_WORKING_TIME_POLICY).forEach(([key, fallback]) => {
    const value = policy[key];
    if (typeof fallback === "boolean") { if (typeof value !== "boolean") errors.push(`${key} must be boolean.`); return; }
    const [minimum, maximum] = BOUNDS[key];
    if (!Number.isFinite(value) || value < minimum || value > maximum) errors.push(`${key} must be between ${minimum} and ${maximum}.`);
  });
  return { ok: errors.length === 0, errors };
}
