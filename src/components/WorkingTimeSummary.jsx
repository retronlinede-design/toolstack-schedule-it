import { calculateWorkingTimeSummary } from "../utils/calculations";
import { formatLongDate } from "../utils/time";

function EmptyState() {
  return (
    <div className="py-12 text-center text-neutral-400 border-2 border-dashed rounded-3xl italic">
      No working time records yet. Add driver start/end times, or departure/arrival fallback times, to calculate duty hours.
    </div>
  );
}

function Section({ title, children, secondary = false }) {
  return (
    <section className={`space-y-3 ${secondary ? "pt-2" : ""}`}>
      <h3 className="text-xs font-black uppercase tracking-widest text-neutral-500">{title}</h3>
      <div className="overflow-x-auto">{children}</div>
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

function MetricCard({ label, value, alert = false }) {
  return (
    <div className={`rounded-2xl border p-4 ${alert ? "border-red-100 bg-red-50/60" : "border-neutral-200 bg-neutral-50"}`}>
      <div className="text-[10px] font-black uppercase tracking-widest text-neutral-500">{label}</div>
      <div className={`mt-1 text-lg font-black ${alert ? "text-red-700" : "text-neutral-900"}`}>{value || "-"}</div>
    </div>
  );
}

export default function WorkingTimeSummary({ movements, drivers, vehicles, scheduleDays }) {
  const { driverDaySummaries, dailyTotals, overallDriverTotals } = calculateWorkingTimeSummary(movements, drivers, vehicles, scheduleDays);
  const driverGroups = [...groupDriverSummaries(driverDaySummaries, overallDriverTotals)];

  if (driverDaySummaries.length === 0) return <EmptyState />;

  return (
    <div className="space-y-8">
      {driverGroups.map((group) => (
        <section key={group.driverId} className="rounded-3xl border border-neutral-200 bg-white p-4 shadow-sm">
          <div className="mb-4 border-b border-neutral-100 pb-3">
            <p className="text-xs font-black uppercase tracking-widest text-neutral-400">Driver</p>
            <h3 className="text-2xl font-black text-neutral-900">{group.driverName}</h3>
            <p className="text-sm text-neutral-500">Vehicle: {group.vehicleName || "-"}</p>
          </div>
          <div className="mb-5 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            <MetricCard label="Total Duty Time" value={group.total?.totalDuration} />
            <MetricCard label="Overtime After 16:30" value={group.total?.overtimeDuration} />
            <MetricCard label="Short Rest Count" value={group.total?.shortRestCount} alert={Number(group.total?.shortRestCount) > 0} />
            <MetricCard label="Minimum Rest Period" value={group.total?.minimumRestDuration} alert={Number(group.total?.shortRestCount) > 0} />
          </div>
          <div className="overflow-x-auto">
            <table className="min-w-[760px] w-full border-collapse border border-neutral-200 bg-white text-sm shadow-sm">
              <thead className="bg-neutral-50 text-[10px] uppercase tracking-tighter text-neutral-500">
                <tr>
                  <th className="border border-neutral-200 p-3 text-left">Date</th>
                  <th className="border border-neutral-200 p-3 text-left">Start</th>
                  <th className="border border-neutral-200 p-3 text-left">End</th>
                  <th className="border border-neutral-200 p-3 text-left">Duty Time</th>
                  <th className="border border-neutral-200 p-3 text-left">Overtime After 16:30</th>
                  <th className="border border-neutral-200 p-3 text-left">Rest Since Previous Duty</th>
                  <th className="border border-neutral-200 p-3 text-left">Notes</th>
                </tr>
              </thead>
              <tbody>
                {group.days.map((summary) => (
                  <tr key={`${summary.driverId}-${summary.date}`} className={`border-t border-neutral-100 ${summary.shortRest ? "bg-red-50/40" : ""}`}>
                    <td className="border border-neutral-200 p-3 font-semibold text-neutral-900">{formatLongDate(summary.date)}</td>
                    <td className="border border-neutral-200 p-3 text-neutral-600">{summary.startTime}</td>
                    <td className="border border-neutral-200 p-3 text-neutral-600">{summary.endTime}</td>
                    <td className="border border-neutral-200 p-3 font-semibold text-neutral-900">{summary.totalDuration}</td>
                    <td className="border border-neutral-200 p-3 text-neutral-600">{summary.overtimeDuration}</td>
                    <td className="border border-neutral-200 p-3">
                      <span className={summary.shortRest ? "font-bold text-red-700" : "text-neutral-600"}>{summary.restDuration}</span>
                    </td>
                    <td className="border border-neutral-200 p-3">
                      <Notes notes={summary.notes} />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      ))}

      <Section title="Daily Totals" secondary>
        <table className="min-w-[620px] w-full border-collapse border border-neutral-200 bg-white text-sm shadow-sm">
          <thead className="bg-neutral-50 text-[10px] uppercase tracking-tighter text-neutral-500">
            <tr>
              <th className="border border-neutral-200 p-3 text-left">Date</th>
              <th className="border border-neutral-200 p-3 text-left">Drivers</th>
              <th className="border border-neutral-200 p-3 text-left">Total Duty Time</th>
              <th className="border border-neutral-200 p-3 text-left">Overtime After 16:30</th>
              <th className="border border-neutral-200 p-3 text-left">Short Rest Count</th>
            </tr>
          </thead>
          <tbody>
            {dailyTotals.map((summary) => (
              <tr key={summary.date}>
                <td className="border border-neutral-200 p-3 font-semibold text-neutral-900">{formatLongDate(summary.date)}</td>
                <td className="border border-neutral-200 p-3 text-neutral-600">{summary.driverCount}</td>
                <td className="border border-neutral-200 p-3 font-bold text-neutral-900">{summary.totalDuration}</td>
                <td className="border border-neutral-200 p-3 text-neutral-600">{summary.overtimeDuration}</td>
                <td className="border border-neutral-200 p-3 text-neutral-600">{summary.shortRestCount}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </Section>
    </div>
  );
}
