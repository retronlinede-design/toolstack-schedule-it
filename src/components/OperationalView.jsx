import { Pencil, Trash2 } from "lucide-react";
import { sortMovementsByDateAndTime } from "../utils/calculations";
import { formatLongDate } from "../utils/time";

const EMPTY = "-";

function buildLookup(items) {
  return new Map(items.map((item) => [item.id, item]));
}

export default function OperationalView({ entriesByMonth, drivers, vehicles, onEdit, onDelete }) {
  const driversById = buildLookup(drivers);
  const vehiclesById = buildLookup(vehicles);
  const entries = sortMovementsByDateAndTime(
    Object.values(entriesByMonth)
      .flat()
      .filter((entry) => entry.isOperationalVisible !== false),
  );

  if (entries.length === 0) {
    return (
      <div className="py-12 text-center text-neutral-400 border-2 border-dashed rounded-3xl italic">
        No operational-visible movements yet.
      </div>
    );
  }

  return (
    <div className="overflow-x-auto">
      <table className="min-w-[1180px] w-full border-collapse border border-neutral-200 bg-white text-xs shadow-sm">
        <thead>
          <tr className="bg-neutral-50 text-[10px] uppercase font-black tracking-tighter text-neutral-500">
            <th className="border border-neutral-200 p-3 text-left">Date</th>
            <th className="border border-neutral-200 p-3 text-left">Driver Start</th>
            <th className="border border-neutral-200 p-3 text-left">Departure Time</th>
            <th className="border border-neutral-200 p-3 text-left">Arrival Time</th>
            <th className="border border-neutral-200 p-3 text-left">End Time</th>
            <th className="border border-neutral-200 p-3 text-left">Engagement Details</th>
            <th className="border border-neutral-200 p-3 text-left">Venue</th>
            <th className="border border-neutral-200 p-3 text-left">Address</th>
            <th className="border border-neutral-200 p-3 text-left">Location Notes</th>
            <th className="border border-neutral-200 p-3 text-left">Parking</th>
            <th className="border border-neutral-200 p-3 text-left">Participants</th>
            <th className="border border-neutral-200 p-3 text-left">Driver</th>
            <th className="border border-neutral-200 p-3 text-left">Vehicle</th>
            <th className="no-print border border-neutral-200 p-3 text-right">Manage</th>
          </tr>
        </thead>
        <tbody>
          {entries.map((entry) => (
            <tr key={entry.id} className="group align-top transition-colors hover:bg-neutral-50/50">
              <td className="border border-neutral-200 p-3 font-semibold text-neutral-900">{formatLongDate(entry.day?.date) || EMPTY}</td>
              <td className="border border-neutral-200 p-3 font-bold text-neutral-900">{entry.driverStart || EMPTY}</td>
              <td className="border border-neutral-200 p-3">{entry.departureTime || EMPTY}</td>
              <td className="border border-neutral-200 p-3">{entry.arrivalTime || EMPTY}</td>
              <td className="border border-neutral-200 p-3">{entry.endTime || EMPTY}</td>
              <td className="border border-neutral-200 p-3 font-semibold text-neutral-900">{entry.engagementDetails || EMPTY}</td>
              <td className="border border-neutral-200 p-3">{entry.venue || EMPTY}</td>
              <td className="border border-neutral-200 p-3">{entry.address || EMPTY}</td>
              <td className="border border-neutral-200 p-3">{entry.locationNotes || EMPTY}</td>
              <td className="border border-neutral-200 p-3">{entry.parking || EMPTY}</td>
              <td className="border border-neutral-200 p-3">{entry.participants || EMPTY}</td>
              <td className="border border-neutral-200 p-3">{driversById.get(entry.driverId)?.name || EMPTY}</td>
              <td className="border border-neutral-200 p-3">{vehiclesById.get(entry.vehicleId)?.name || EMPTY}</td>
              <td className="no-print border border-neutral-200 p-3 text-right">
                <div className="flex justify-end gap-1 opacity-0 transition-all group-hover:opacity-100">
                  <button onClick={() => onEdit(entry)} className="p-2 bg-blue-50 text-blue-600 rounded-lg" title="Edit">
                    <Pencil className="h-4 w-4" />
                  </button>
                  <button onClick={() => onDelete(entry.id)} className="p-2 bg-red-50 text-red-600 rounded-lg" title="Delete">
                    <Trash2 className="h-4 w-4" />
                  </button>
                </div>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

