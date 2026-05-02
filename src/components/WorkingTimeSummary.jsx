import { calculateWorkingTimeSummary } from "../utils/calculations";
import { formatLongDate } from "../utils/time";

function EmptyState() {
  return (
    <div className="py-12 text-center text-neutral-400 border-2 border-dashed rounded-3xl italic">
      No working time records yet. Add driver start/end times, or departure/arrival fallback times, to calculate duty hours.
    </div>
  );
}

function Section({ title, children }) {
  return (
    <section className="space-y-3">
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

export default function WorkingTimeSummary({ movements, drivers, vehicles, scheduleDays }) {
  const { driverDaySummaries, dailyTotals, overallDriverTotals } = calculateWorkingTimeSummary(movements, drivers, vehicles, scheduleDays);

  if (driverDaySummaries.length === 0) return <EmptyState />;

  return (
    <div className="space-y-8">
      <Section title="Daily Totals">
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

      <Section title="Driver Totals Per Day">
        <table className="min-w-[860px] w-full border-collapse border border-neutral-200 bg-white text-sm shadow-sm">
          <thead className="bg-neutral-50 text-[10px] uppercase tracking-tighter text-neutral-500">
            <tr>
              <th className="border border-neutral-200 p-3 text-left">Date</th>
              <th className="border border-neutral-200 p-3 text-left">Driver</th>
              <th className="border border-neutral-200 p-3 text-left">Vehicle</th>
              <th className="border border-neutral-200 p-3 text-left">Start</th>
              <th className="border border-neutral-200 p-3 text-left">End</th>
              <th className="border border-neutral-200 p-3 text-left">Total Duty Time</th>
              <th className="border border-neutral-200 p-3 text-left">Overtime After 16:30</th>
              <th className="border border-neutral-200 p-3 text-left">Rest Since Previous Duty</th>
              <th className="border border-neutral-200 p-3 text-left">Notes</th>
            </tr>
          </thead>
          <tbody>
            {driverDaySummaries.map((summary) => (
              <tr key={`${summary.driverId}-${summary.date}`} className={`border-t border-neutral-100 ${summary.shortRest ? "bg-red-50/40" : ""}`}>
                <td className="border border-neutral-200 p-3 font-semibold text-neutral-900">{formatLongDate(summary.date)}</td>
                <td className="border border-neutral-200 p-3 font-bold text-neutral-900">{summary.driverName}</td>
                <td className="border border-neutral-200 p-3 text-neutral-600">{summary.vehicleName}</td>
                <td className="border border-neutral-200 p-3 text-neutral-600">{summary.startTime}</td>
                <td className="border border-neutral-200 p-3 text-neutral-600">{summary.endTime}</td>
                <td className="border border-neutral-200 p-3 text-neutral-600">{summary.totalDuration}</td>
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
      </Section>

      <Section title="Overall Driver Totals">
        <table className="min-w-[620px] w-full border-collapse border border-neutral-200 bg-white text-sm shadow-sm">
          <thead className="bg-neutral-50 text-[10px] uppercase tracking-tighter text-neutral-500">
            <tr>
              <th className="border border-neutral-200 p-3 text-left">Driver</th>
              <th className="border border-neutral-200 p-3 text-left">Days</th>
              <th className="border border-neutral-200 p-3 text-left">Total Duty Time</th>
              <th className="border border-neutral-200 p-3 text-left">Overtime After 16:30</th>
              <th className="border border-neutral-200 p-3 text-left">Short Rest Count</th>
              <th className="border border-neutral-200 p-3 text-left">Minimum Rest Period</th>
            </tr>
          </thead>
          <tbody>
            {overallDriverTotals.map((summary) => (
              <tr key={summary.driverId}>
                <td className="border border-neutral-200 p-3 font-bold text-neutral-900">{summary.driverName}</td>
                <td className="border border-neutral-200 p-3 text-neutral-600">{summary.dayCount}</td>
                <td className="border border-neutral-200 p-3 font-bold text-neutral-900">{summary.totalDuration}</td>
                <td className="border border-neutral-200 p-3 text-neutral-600">{summary.overtimeDuration}</td>
                <td className="border border-neutral-200 p-3 text-neutral-600">{summary.shortRestCount}</td>
                <td className="border border-neutral-200 p-3 text-neutral-600">{summary.minimumRestDuration}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </Section>
    </div>
  );
}
