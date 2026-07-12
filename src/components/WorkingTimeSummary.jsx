import { calculateWorkingTimeSummary } from "../utils/calculations";
import { formatLongDate, minutesToDuration } from "../utils/time";
import { normalizeWorkingTimePolicy } from "../domain/workingTimePolicy";
import AlertBanner from "./ui/AlertBanner";
import Badge from "./ui/Badge";
import SharedEmptyState from "./ui/EmptyState";

function WorkingEmptyState() {
  return <SharedEmptyState title="No working-time rows" description="Add driver start/end times, or departure/arrival fallback times, to calculate duty hours." />;
}

function Section({ title, children, secondary = false }) {
  return (
    <section className={`min-w-0 max-w-full space-y-3 ${secondary ? "pt-2" : ""}`}>
      <h3 className="text-xs font-black uppercase tracking-widest text-neutral-500">{title}</h3>
      <div className="min-w-0 max-w-full overflow-x-auto">{children}</div>
    </section>
  );
}

function Notes({ notes }) {
  if (!notes?.length) return <span className="text-neutral-400">-</span>;

  return (
    <div className="flex flex-wrap gap-1">
      {notes.map((note) => (
        <span key={note} className={`rounded-full px-2 py-1 text-xs font-semibold ${note === "Short rest" ? "bg-red-50 text-red-700" : "bg-amber-50 text-amber-700"}`}>
          {note}
        </span>
      ))}
    </div>
  );
}

function groupDriverSummaries(driverDaySummaries, overallDriverTotals) {
  const totalsByDriver = new Map(overallDriverTotals.map((summary) => [summary.driverId, summary]));

  return [...driverDaySummaries]
    .reduce((groups, summary) => {
      if (!groups.has(summary.driverId)) {
        groups.set(summary.driverId, {
          driverId: summary.driverId,
          driverName: summary.driverName,
          vehicleName: summary.vehicleName,
          total: totalsByDriver.get(summary.driverId),
          days: [],
        });
      }
      groups.get(summary.driverId).days.push(summary);
      return groups;
    }, new Map())
    .values();
}

function groupDailySummaries(driverDaySummaries, dailyTotals) {
  const totalsByDate = new Map(dailyTotals.map((summary) => [summary.date, summary]));

  return [
    ...driverDaySummaries
      .reduce((groups, summary) => {
        const key = summary.date || summary.dayTitle || "missing-date";
        if (!groups.has(key)) {
          groups.set(key, {
            key,
            date: summary.date,
            total: totalsByDate.get(summary.date),
            drivers: [],
          });
        }
        groups.get(key).drivers.push(summary);
        return groups;
      }, new Map())
      .values(),
  ];
}

function MetricCard({ label, value, alert = false }) {
  return (
    <div className={`min-w-0 max-w-full rounded-2xl border p-4 ${alert ? "border-red-100 bg-red-50/60" : "border-neutral-200 bg-neutral-50"}`}>
      <div className="text-[10px] font-black uppercase tracking-widest text-neutral-500">{label}</div>
      <div className={`mt-1 text-lg font-black ${alert ? "text-red-700" : "text-neutral-900"}`}>{value || "-"}</div>
    </div>
  );
}

export default function WorkingTimeSummary({ movements, drivers, vehicles, scheduleDays, integrity, workingTimePolicy, onWorkingTimePolicyChange }) {
  const policy = normalizeWorkingTimePolicy(workingTimePolicy);
  const { driverDaySummaries, dailyTotals, overallDriverTotals } = calculateWorkingTimeSummary(movements, drivers, vehicles, scheduleDays, policy);
  const driverGroups = [...groupDriverSummaries(driverDaySummaries, overallDriverTotals)];
  const dailyGroups = groupDailySummaries(driverDaySummaries, dailyTotals);
  const dayDateById = new Map(scheduleDays.map((day) => [day.id, day.date]));
  const movementMeta = (driverId, date) => {
    const records = movements.filter((movement) => movement.driverId === driverId && dayDateById.get(movement.scheduleDayId) === date);
    return { count: records.length, overnight: records.some((movement) => movement.continuesOvernight) };
  };

  return (
    <div className="space-y-8">
      <AlertBanner tone="info"><p>Working-time results are based on recorded movement intervals and the configured policy. Breaks, standby, travel, and split duties are calculated from explicit movement classifications.</p><p className="mt-1 font-semibold">This is an operational planning summary, not a legal compliance determination.</p></AlertBanner>
      <details className="ts-card p-4"><summary className="cursor-pointer font-semibold">Working-Time Settings</summary><div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {[['standardDailyMinutes', 'Standard daily hours'], ['shortRestThresholdMinutes', 'Rest warning threshold (hours)'], ['splitDutyGapThresholdMinutes', 'Split-duty gap threshold (hours)']].map(([key, label]) => <label key={key} className="text-sm font-medium">{label}<input className="ts-input mt-1" type="number" min="0" step="0.25" value={policy[key] / 60} onChange={(event) => onWorkingTimePolicyChange?.({ ...policy, [key]: Math.round(Number(event.target.value) * 60) })} /></label>)}
        <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={policy.standbyCountsAsWorkingTime} onChange={(event) => onWorkingTimePolicyChange?.({ ...policy, standbyCountsAsWorkingTime: event.target.checked })} />Standby counts as working time</label>
        <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={policy.travelCountsAsWorkingTime} onChange={(event) => onWorkingTimePolicyChange?.({ ...policy, travelCountsAsWorkingTime: event.target.checked })} />Travel counts as working time</label>
      </div></details>
      {driverDaySummaries.length === 0 ? <WorkingEmptyState /> : null}
      {integrity?.summary?.chronologyErrors > 0 ? <AlertBanner tone="danger"><strong>Results may be unreliable.</strong> Unresolved chronology conflicts affect the recorded duty spans.</AlertBanner> : null}
      {driverGroups.map((group) => (
        <section key={group.driverId} className="min-w-0 max-w-full rounded-3xl border border-neutral-200 bg-white p-4 shadow-sm">
          <div className="mb-4 border-b border-neutral-100 pb-3">
            <p className="text-xs font-black uppercase tracking-widest text-neutral-400">Driver</p>
            <h3 className="text-2xl font-black text-neutral-900">{group.driverName}</h3>
            <p className="text-sm text-neutral-500">Vehicle: {group.vehicleName || "-"}</p>
          </div>
          <div className="mb-5 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            <MetricCard label="Counted Working Time" value={group.total?.totalDuration} />
            <MetricCard label="Overtime" value={group.total?.overtimeDuration} />
            <MetricCard label="Short Rest Count" value={group.total?.shortRestCount} alert={Number(group.total?.shortRestCount) > 0} />
            <MetricCard label="Minimum Rest Period" value={group.total?.minimumRestDuration} alert={Number(group.total?.shortRestCount) > 0} />
          </div>
          <div className="grid gap-3 lg:hidden print:hidden">{group.days.map((summary) => <article key={`card-${summary.driverId}-${summary.date}`} className="ts-card p-4"><div className="flex flex-wrap items-center justify-between gap-2"><h4 className="font-semibold">{formatLongDate(summary.date)}</h4>{summary.overnight ? <Badge tone="info">Overnight</Badge> : null}</div><dl className="mt-3 grid grid-cols-2 gap-3 text-sm"><div><dt className="text-neutral-500">Duty</dt><dd>{summary.startTime}–{summary.endTime}</dd></div><div><dt className="text-neutral-500">Total span</dt><dd>{minutesToDuration(summary.totalSpanMinutes)}</dd></div><div><dt className="text-neutral-500">Counted work</dt><dd>{summary.totalDuration}</dd></div><div><dt className="text-neutral-500">Overtime</dt><dd>{summary.overtimeDuration}</dd></div><div><dt className="text-neutral-500">Active / travel</dt><dd>{minutesToDuration(summary.activeMinutes)} / {minutesToDuration(summary.travelMinutes)}</dd></div><div><dt className="text-neutral-500">Standby / breaks</dt><dd>{minutesToDuration(summary.standbyMinutes)} / {minutesToDuration(summary.effectiveBreakMinutes)}</dd></div><div><dt className="text-neutral-500">Duty segments</dt><dd>{summary.dutySegmentCount}</dd></div><div><dt className="text-neutral-500">Rest before next</dt><dd>{summary.restBeforeNextDutyMinutes == null ? "-" : minutesToDuration(summary.restBeforeNextDutyMinutes)}</dd></div></dl><div className="mt-3"><Notes notes={summary.notes} /></div></article>)}</div>
          <div className="hidden min-w-0 max-w-full overflow-x-auto lg:block print:block">
            <table className="min-w-[760px] w-full border-collapse border border-neutral-200 bg-white text-sm shadow-sm">
              <caption className="sr-only">Working-time rows for {group.driverName}</caption>
              <thead className="bg-neutral-50 text-[10px] uppercase tracking-tighter text-neutral-500">
                <tr>
                  {['Date', 'Start', 'End', 'Counted Working Time', 'Overtime', 'Rest Before Next Duty', 'Notes'].map((label) => <th key={label} scope="col" className="border border-neutral-200 p-3 text-left">{label}</th>)}
                </tr>
              </thead>
              <tbody>
                {group.days.map((summary) => (
                  <tr key={`${summary.driverId}-${summary.date}`} className={`border-t border-neutral-100 ${summary.shortRest ? "bg-red-50/40" : ""}`}>
                    <td className="border border-neutral-200 p-3 font-semibold text-neutral-900">{formatLongDate(summary.date)}</td>
                    <td className="border border-neutral-200 p-3 text-neutral-600">{summary.startTime}</td>
                    <td className="border border-neutral-200 p-3 text-neutral-600">{summary.endTime}</td>
                    <td className="border border-neutral-200 p-3 font-semibold text-neutral-900"><div>{summary.totalDuration}</div><div className="mt-1 text-xs font-normal text-neutral-500">Span {minutesToDuration(summary.totalSpanMinutes)} · Active {minutesToDuration(summary.activeMinutes)} · Travel {minutesToDuration(summary.travelMinutes)} · Standby {minutesToDuration(summary.standbyMinutes)} · Breaks {minutesToDuration(summary.effectiveBreakMinutes)} · {summary.dutySegmentCount} segment{summary.dutySegmentCount === 1 ? "" : "s"}</div></td>
                    <td className="border border-neutral-200 p-3 text-neutral-600">{summary.overtimeDuration}</td>
                    <td className="border border-neutral-200 p-3">
                      <span className="text-neutral-600">{summary.restBeforeNextDutyMinutes == null ? "-" : minutesToDuration(summary.restBeforeNextDutyMinutes)}</span>
                    </td>
                    <td className="border border-neutral-200 p-3">
                      <div className="flex flex-wrap gap-1"><Notes notes={summary.notes} /><Badge>{movementMeta(summary.driverId, summary.date).count} movements</Badge>{movementMeta(summary.driverId, summary.date).overnight ? <Badge tone="info">Overnight</Badge> : null}</div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      ))}

      {dailyGroups.length ? <Section title="Daily Totals" secondary>
        <div className="space-y-5">
          {dailyGroups.map((group) => (
            <section key={group.key} className="min-w-0 max-w-full rounded-2xl border border-neutral-200 bg-white p-4 shadow-sm">
              <div className="mb-3 flex flex-col gap-1 border-b border-neutral-100 pb-3 sm:flex-row sm:items-end sm:justify-between">
                <h4 className="text-lg font-black text-neutral-900">{formatLongDate(group.date) || "Missing date"}</h4>
                <p className="text-xs font-semibold uppercase tracking-widest text-neutral-400">
                  {group.drivers.length} {group.drivers.length === 1 ? "driver" : "drivers"}
                </p>
              </div>
              <table className="min-w-[760px] w-full border-collapse border border-neutral-200 bg-white text-sm shadow-sm">
                <caption className="sr-only">Daily working-time totals for {formatLongDate(group.date)}</caption>
                <thead className="bg-neutral-50 text-[10px] uppercase tracking-tighter text-neutral-500">
                  <tr>
                    {['Driver', 'Vehicle', 'Counted Working Time', 'Overtime', 'Rest Before Next Duty', 'Notes'].map((label) => <th key={label} scope="col" className="border border-neutral-200 p-3 text-left">{label}</th>)}
                  </tr>
                </thead>
                <tbody>
                  {group.drivers.map((summary) => (
                    <tr key={`${summary.driverId}-${summary.date || group.key}`} className={summary.shortRest ? "bg-red-50/40" : ""}>
                      <td className="border border-neutral-200 p-3 font-semibold text-neutral-900">{summary.driverName}</td>
                      <td className="border border-neutral-200 p-3 text-neutral-600">{summary.vehicleName || "-"}</td>
                      <td className="border border-neutral-200 p-3 font-bold text-neutral-900">{summary.totalDuration}</td>
                      <td className="border border-neutral-200 p-3 text-neutral-600">{summary.overtimeDuration}</td>
                      <td className="border border-neutral-200 p-3">
                        <span className="text-neutral-600">{summary.restBeforeNextDutyMinutes == null ? "-" : minutesToDuration(summary.restBeforeNextDutyMinutes)}</span>
                      </td>
                      <td className="border border-neutral-200 p-3">
                        <Notes notes={summary.notes} />
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
              <div className="mt-3 grid gap-3 sm:grid-cols-3">
                <MetricCard label="Combined Duty Time" value={group.total?.totalDuration} />
                <MetricCard label="Combined Overtime" value={group.total?.overtimeDuration} />
                <MetricCard label="Short Rest Count" value={group.total?.shortRestCount} alert={Number(group.total?.shortRestCount) > 0} />
              </div>
            </section>
          ))}
        </div>
      </Section> : null}
    </div>
  );
}
