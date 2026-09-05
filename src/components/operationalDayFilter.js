export const ALL_OPERATIONAL_DAYS = "";

export function chronologicalScheduleDays(scheduleDays) {
  return [...scheduleDays].sort((a, b) => {
    const dateCompare = (a.date || "").localeCompare(b.date || "");
    return dateCompare || (a.title || "").localeCompare(b.title || "") || (a.id || "").localeCompare(b.id || "");
  });
}

export function operationalDayLabel(day) {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(day?.date || "");
  let dateLabel = day?.date || "Unscheduled";

  if (match) {
    const date = new Date(Date.UTC(Number(match[1]), Number(match[2]) - 1, Number(match[3])));
    const weekdays = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
    const months = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
    dateLabel = `${weekdays[date.getUTCDay()]} ${date.getUTCDate()} ${months[date.getUTCMonth()]} ${date.getUTCFullYear()}`;
  }

  return day?.title ? `${dateLabel} — ${day.title}` : dateLabel;
}

export function resolveOperationalDayId(selectedDayId, orderedDays) {
  return selectedDayId && orderedDays.some((day) => day.id === selectedDayId) ? selectedDayId : ALL_OPERATIONAL_DAYS;
}

export function adjacentOperationalDayId(selectedDayId, orderedDays, offset) {
  const currentIndex = orderedDays.findIndex((day) => day.id === selectedDayId);
  if (currentIndex < 0) return ALL_OPERATIONAL_DAYS;
  return orderedDays[currentIndex + offset]?.id || selectedDayId;
}

export function filterOperationalDayGroups(dayGroups, selectedDayId) {
  if (!selectedDayId) return dayGroups;
  return dayGroups.filter((group) => (group.day?.id || group.key) === selectedDayId);
}
