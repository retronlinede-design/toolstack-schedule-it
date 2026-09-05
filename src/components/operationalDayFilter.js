export const OPERATIONAL_FILTER_MODES = Object.freeze(["day", "week", "month", "custom", "all"]);

const WEEKDAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
const LONG_MONTHS = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];

function parseIsoDate(value) {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value || "");
  if (!match) return null;
  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);
  const date = new Date(Date.UTC(year, month - 1, day));
  if (date.getUTCFullYear() !== year || date.getUTCMonth() !== month - 1 || date.getUTCDate() !== day) return null;
  return date;
}

function isoDate(date) {
  return `${date.getUTCFullYear()}-${String(date.getUTCMonth() + 1).padStart(2, "0")}-${String(date.getUTCDate()).padStart(2, "0")}`;
}

function shiftDays(value, amount) {
  const date = parseIsoDate(value);
  if (!date) return value;
  date.setUTCDate(date.getUTCDate() + amount);
  return isoDate(date);
}

function shiftMonths(value, amount) {
  const date = parseIsoDate(value);
  if (!date) return value;
  const monthIndex = date.getUTCFullYear() * 12 + date.getUTCMonth() + amount;
  return `${Math.floor(monthIndex / 12)}-${String(((monthIndex % 12) + 12) % 12 + 1).padStart(2, "0")}-01`;
}

export function localCalendarDate(date = new Date()) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
}

export function chronologicalScheduleDays(scheduleDays) {
  return [...scheduleDays].sort((a, b) => {
    const dateCompare = (a.date || "").localeCompare(b.date || "");
    return dateCompare || (a.title || "").localeCompare(b.title || "") || (a.id || "").localeCompare(b.id || "");
  });
}

export function operationalDayLabel(day, includeTitle = true) {
  const date = parseIsoDate(day?.date);
  const dateLabel = date
    ? `${WEEKDAYS[date.getUTCDay()]} ${date.getUTCDate()} ${MONTHS[date.getUTCMonth()]} ${date.getUTCFullYear()}`
    : day?.date || "Unscheduled";
  return includeTitle && day?.title ? `${dateLabel} — ${day.title}` : dateLabel;
}

export function selectInitialOperationalDayId(scheduleDays, today = localCalendarDate()) {
  const datedDays = chronologicalScheduleDays(scheduleDays).filter((day) => parseIsoDate(day.date));
  return datedDays.find((day) => day.date === today)?.id
    || datedDays.find((day) => day.date > today)?.id
    || datedDays.at(-1)?.id
    || "";
}

export function createInitialOperationalFilter(scheduleDays, today = localCalendarDate()) {
  const orderedDays = chronologicalScheduleDays(scheduleDays);
  const dayId = selectInitialOperationalDayId(orderedDays, today);
  const selectedDate = orderedDays.find((day) => day.id === dayId)?.date || today;
  return { mode: "day", dayId, anchorDate: selectedDate, customFrom: selectedDate, customTo: selectedDate };
}

export function reconcileOperationalFilter(filter, scheduleDays, today = localCalendarDate()) {
  if (filter.mode !== "day" || scheduleDays.some((day) => day.id === filter.dayId)) return filter;
  const dayId = selectInitialOperationalDayId(scheduleDays, today);
  const anchorDate = scheduleDays.find((day) => day.id === dayId)?.date || today;
  return { ...filter, dayId, anchorDate };
}

export function adjacentOperationalDayId(selectedDayId, orderedDays, offset) {
  const currentIndex = orderedDays.findIndex((day) => day.id === selectedDayId);
  if (currentIndex < 0) return selectedDayId;
  return orderedDays[currentIndex + offset]?.id || selectedDayId;
}

export function changeOperationalFilterMode(filter, mode, scheduleDays, today = localCalendarDate()) {
  if (!OPERATIONAL_FILTER_MODES.includes(mode)) return filter;
  const selectedDay = scheduleDays.find((day) => day.id === filter.dayId);
  const anchorDate = filter.mode === "day" && selectedDay?.date
    ? selectedDay.date
    : parseIsoDate(filter.anchorDate) ? filter.anchorDate : selectedDay?.date || today;
  const dayId = filter.dayId && scheduleDays.some((day) => day.id === filter.dayId)
    ? filter.dayId
    : selectInitialOperationalDayId(scheduleDays, today);
  return { ...filter, mode, dayId, anchorDate, customFrom: filter.customFrom || anchorDate, customTo: filter.customTo || anchorDate };
}

export function navigateOperationalFilter(filter, scheduleDays, offset) {
  if (filter.mode === "day") {
    const orderedDays = chronologicalScheduleDays(scheduleDays).filter((day) => parseIsoDate(day.date));
    const dayId = adjacentOperationalDayId(filter.dayId, orderedDays, offset);
    return { ...filter, dayId, anchorDate: orderedDays.find((day) => day.id === dayId)?.date || filter.anchorDate };
  }
  if (filter.mode === "week") return { ...filter, anchorDate: shiftDays(filter.anchorDate, offset * 7) };
  if (filter.mode === "month") return { ...filter, anchorDate: shiftMonths(filter.anchorDate, offset) };
  return filter;
}

export function operationalFilterRange(filter) {
  if (filter.mode === "all" || filter.mode === "day") return { valid: true, startDate: "", endDate: "" };
  if (filter.mode === "custom") {
    if (!parseIsoDate(filter.customFrom) || !parseIsoDate(filter.customTo)) {
      return { valid: false, startDate: filter.customFrom, endDate: filter.customTo, error: "Choose valid From and To dates." };
    }
    if (filter.customFrom > filter.customTo) {
      return { valid: false, startDate: filter.customFrom, endDate: filter.customTo, error: "From date must not be after To date." };
    }
    return { valid: true, startDate: filter.customFrom, endDate: filter.customTo };
  }

  const anchor = parseIsoDate(filter.anchorDate);
  if (!anchor) return { valid: false, startDate: "", endDate: "", error: "The selected period has no valid date." };
  if (filter.mode === "month") {
    const startDate = `${anchor.getUTCFullYear()}-${String(anchor.getUTCMonth() + 1).padStart(2, "0")}-01`;
    return { valid: true, startDate, endDate: shiftDays(shiftMonths(startDate, 1), -1) };
  }

  const mondayOffset = (anchor.getUTCDay() + 6) % 7;
  const startDate = shiftDays(filter.anchorDate, -mondayOffset);
  return { valid: true, startDate, endDate: shiftDays(startDate, 6) };
}

function compactDateParts(value) {
  const date = parseIsoDate(value);
  return date ? { day: date.getUTCDate(), month: MONTHS[date.getUTCMonth()], year: date.getUTCFullYear() } : null;
}

export function operationalPeriodLabel(filter, scheduleDays) {
  if (filter.mode === "day") {
    const day = scheduleDays.find((item) => item.id === filter.dayId);
    return day ? operationalDayLabel(day, false) : "No schedule days";
  }
  if (filter.mode === "month") {
    const date = parseIsoDate(filter.anchorDate);
    return date ? `${LONG_MONTHS[date.getUTCMonth()]} ${date.getUTCFullYear()}` : "Invalid month";
  }
  if (filter.mode === "week") {
    const range = operationalFilterRange(filter);
    const start = compactDateParts(range.startDate);
    const end = compactDateParts(range.endDate);
    if (!start || !end) return "Invalid week";
    if (start.year === end.year && start.month === end.month) return `${start.day}–${end.day} ${end.month} ${end.year}`;
    if (start.year === end.year) return `${start.day} ${start.month}–${end.day} ${end.month} ${end.year}`;
    return `${start.day} ${start.month} ${start.year}–${end.day} ${end.month} ${end.year}`;
  }
  if (filter.mode === "all") return "All schedule days";
  const range = operationalFilterRange(filter);
  return range.valid ? `${range.startDate} – ${range.endDate}` : "Invalid custom range";
}

export function matchingOperationalDayIds(scheduleDays, filter) {
  if (filter.mode === "all") return new Set(scheduleDays.map((day) => day.id));
  if (filter.mode === "day") return new Set(scheduleDays.some((day) => day.id === filter.dayId) ? [filter.dayId] : []);
  const range = operationalFilterRange(filter);
  if (!range.valid) return new Set();
  return new Set(scheduleDays.filter((day) => parseIsoDate(day.date) && day.date >= range.startDate && day.date <= range.endDate).map((day) => day.id));
}

export function filterOperationalDayGroups(dayGroups, scheduleDays, filter) {
  if (filter.mode === "all") return dayGroups;
  const matchingIds = matchingOperationalDayIds(scheduleDays, filter);
  return dayGroups.filter((group) => matchingIds.has(group.day?.id || group.key));
}

export function chronologicalOperationalDayGroups(dayGroups) {
  return [...dayGroups].sort((a, b) => {
    const dateCompare = (a.day?.date || "\uffff").localeCompare(b.day?.date || "\uffff");
    return dateCompare || String(a.day?.id || a.key).localeCompare(String(b.day?.id || b.key));
  });
}
