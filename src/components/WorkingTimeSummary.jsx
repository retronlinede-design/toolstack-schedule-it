import { calculateDriverSummary } from "../utils/calculations";
import { formatLongDate } from "../utils/time";

export default function WorkingTimeSummary({ movements, drivers, vehicles, scheduleDays }) {
  const summaries = calculateDriverSummary(movements, drivers, vehicles, scheduleDays);

  if (summaries.length === 0) {
    return (
      <div className="py-12 text-center text-neutral-400 border-2 border-dashed rounded-3xl italic">
        No complete driver start and end time records yet.
      </div>
    );
  }

  return (
    <div className="overflow-x-auto">
      <table className="min-w-[760px] w-full border-collapse border border-neutral-200 bg-white text-sm shadow-sm">
        <thead className="bg-neutral-50 text-[10px] uppercase tracking-tighter text-neutral-500">
          <tr>
            <th className="border border-neutral-200 p-3 text-left">Date</th>
            <th className="border border-neutral-200 p-3 text-left">Driver</th>
            <th className="border border-neutral-200 p-3 text-left">Vehicle</th>
            <th className="border border-neutral-200 p-3 text-left">Start</th>
            <th className="border border-neutral-200 p-3 text-left">End</th>
            <th className="border border-neutral-200 p-3 text-left">Total Duty Time</th>
            <th className="border border-neutral-200 p-3 text-left">Overtime</th>
          </tr>
        </thead>
        <tbody>
          {summaries.map((summary) => (
            <tr key={`${summary.driverId}-${summary.date}`} className="border-t border-neutral-100">
              <td className="border border-neutral-200 p-3 font-semibold text-neutral-900">{formatLongDate(summary.date)}</td>
              <td className="border border-neutral-200 p-3 font-bold text-neutral-900">{summary.driverName}</td>
              <td className="border border-neutral-200 p-3 text-neutral-600">{summary.vehicleName}</td>
              <td className="border border-neutral-200 p-3 text-neutral-600">{summary.startTime}</td>
              <td className="border border-neutral-200 p-3 text-neutral-600">{summary.endTime}</td>
              <td className="border border-neutral-200 p-3 text-neutral-600">{summary.totalDuration}</td>
              <td className="border border-neutral-200 p-3 text-neutral-600">{summary.overtimeDuration}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

