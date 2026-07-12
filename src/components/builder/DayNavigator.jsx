import { CalendarDays } from "lucide-react";
import Badge from "../ui/Badge";

export default function DayNavigator({ days, selectedDayId, movements, integrity, onSelect }) {
  const ordered = [...days].sort((a, b) => (a.date || "").localeCompare(b.date || "") || a.id.localeCompare(b.id));
  if (!ordered.length) return <div className="ts-empty"><p className="font-semibold">No programme days</p><p className="mt-1 text-sm">Enter a date and create the first schedule day.</p></div>;
  return <nav aria-label="Programme days" className="-mx-1 overflow-x-auto px-1 pb-2"><div className="flex min-w-max gap-2">{ordered.map((day) => {
    const count = movements.filter((movement) => movement.scheduleDayId === day.id).length;
    const issues = Object.entries(integrity?.conflictsByMovementId || {}).filter(([movementId]) => movements.some((movement) => movement.id === movementId && movement.scheduleDayId === day.id)).reduce((sum, [, values]) => sum + values.filter((issue) => issue.severity === "error").length, 0);
    const selected = day.id === selectedDayId;
    const weekday = day.date ? new Date(`${day.date}T12:00:00`).toLocaleDateString(undefined, { weekday: "short" }) : "No date";
    return <button key={day.id} type="button" onClick={() => onSelect(day.id)} aria-current={selected ? "date" : undefined} className={`min-h-[94px] w-56 rounded-[14px] border p-3 text-left transition-colors ${selected ? "border-l-4 border-l-[#b1d400] border-[var(--ts-border-strong)] bg-[var(--ts-accent-soft)]" : "border-[var(--ts-border)] bg-white hover:bg-[var(--ts-accent-hover)]"}`}>
      <div className="flex items-start justify-between gap-2"><span className="flex items-center gap-1.5 text-xs font-semibold text-[var(--ts-text-muted)]"><CalendarDays className="h-3.5 w-3.5" />{weekday} · {day.date || "Undated"}</span>{issues ? <Badge tone="danger">{issues} issues</Badge> : null}</div>
      <p className="mt-2 line-clamp-2 text-sm font-semibold text-[var(--ts-text)]">{day.title || day.date || "Untitled day"}</p>
      <p className="mt-1 text-xs text-[var(--ts-text-muted)]">{count ? `${count} movement${count === 1 ? "" : "s"}` : "Empty day"}</p>
    </button>;
  })}</div></nav>;
}
