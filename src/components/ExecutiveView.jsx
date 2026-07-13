import { Pencil, Trash2 } from "lucide-react";
import { useState } from "react";
import { sortMovementsByDateAndTime } from "../utils/calculations";
import { selectMovementsForView } from "../domain/audiences";
import { formatLongDate } from "../utils/time";
import { executivePickupText } from "../domain/pickupPresentation";

const EMPTY = "-";

const variants = [
  { id: "executive", label: "Full Executive Programme" },
  { id: "executiveCg", label: "CG Programme" },
  { id: "executiveMarida", label: "Marida Programme" },
];

function buildLookup(items) {
  return new Map(items.map((item) => [item.id, item]));
}

function timeRange(...times) {
  const values = times.filter(Boolean);
  if (values.length === 0) return EMPTY;
  if (values.length === 1) return values[0];
  return `${values[0]}-${values[values.length - 1]}`;
}

function movementLabel(value) {
  const text = value || "";
  if (text.toLowerCase().includes("transfer")) return "Transfer";
  if (text.toLowerCase().includes("meeting")) return "Meeting";
  if (text.toLowerCase().includes("driver start")) return "Standby";
  if (text.toLowerCase().includes("end of duty")) return "End of Duty";
  return text || EMPTY;
}

function isTransfer(entry) {
  const text = `${entry.engagementDetails || ""} ${movementLabel(entry.engagementDetails)}`.toLowerCase();
  return text.includes("transfer");
}

function meaningfulEventTimes(entry) {
  const eventStart = entry.eventStartTime || "";
  const eventEnd = entry.eventEndTime || "";
  const hasExplicitEventStart = eventStart && eventStart !== entry.departureTime;
  const hasExplicitEventEnd = eventEnd && eventEnd !== entry.endTime;
  const hasOnlyEventTimes = (eventStart || eventEnd) && !entry.departureTime && !entry.arrivalTime && !entry.endTime;

  return hasExplicitEventStart || hasExplicitEventEnd || hasOnlyEventTimes ? [eventStart, eventEnd].filter(Boolean) : [];
}

function executiveTimeDisplay(entry) {
  const eventTimes = meaningfulEventTimes(entry);
  if (eventTimes.length > 0) {
    return {
      display: timeRange(...eventTimes),
      needsConfirmation: eventTimes.length < 2,
    };
  }

  const preferredTimes = isTransfer(entry)
    ? [entry.departureTime, entry.arrivalTime].filter(Boolean)
    : [entry.arrivalTime, entry.endTime].filter(Boolean);
  const fallbackTimes = [entry.departureTime, entry.arrivalTime, entry.endTime].filter(Boolean);
  const times = preferredTimes.length > 0 ? preferredTimes : fallbackTimes;

  return {
    display: timeRange(...times),
    needsConfirmation: times.length < 2,
  };
}

function executiveNotes(entry, needsConfirmation) {
  return [executivePickupText(entry), entry.locationNotes, needsConfirmation ? "Timing to confirm" : ""].filter(Boolean).join("\n");
}

function groupByDay(entries) {
  const groups = [];
  const groupsByKey = new Map();

  entries.forEach((entry) => {
    const key = entry.day?.id || entry.day?.date || "unscheduled";
    if (!groupsByKey.has(key)) {
      const group = { key, day: entry.day, entries: [] };
      groupsByKey.set(key, group);
      groups.push(group);
    }
    groupsByKey.get(key).entries.push(entry);
  });

  return groups;
}

export default function ExecutiveView({ entriesByMonth, profile, drivers = [], vehicles = [], onEdit, onDelete }) {
  const [variant, setVariant] = useState("executive");
  const driversById = buildLookup(drivers);
  const vehiclesById = buildLookup(vehicles);
  const allEntries = Object.values(entriesByMonth).flat();
  const executiveEntries = selectMovementsForView(allEntries, "executive");
  const entries = sortMovementsByDateAndTime(selectMovementsForView(allEntries, variant));
  const dayGroups = groupByDay(entries);
  const personFilteredEmpty = entries.length === 0 && executiveEntries.length > 0 && variant !== "executive";

  return (
    <div className="bg-white">
      <div className="mb-6 border-b border-neutral-100 pb-4 text-center">
        <h3 className="text-2xl font-black uppercase tracking-widest text-neutral-900">{profile.missionName || "Mission Name"}</h3>
        <p className="text-md font-bold uppercase text-neutral-500 underline">{variants.find((item) => item.id === variant)?.label || "Executive Programme"}</p>
      </div>

      <div className="mb-5 flex flex-wrap justify-center gap-2">
        {variants.map((item) => (
          <button
            key={item.id}
            onClick={() => setVariant(item.id)}
            className={`rounded-xl px-3 py-2 text-xs font-semibold transition ${
              variant === item.id ? "bg-neutral-900 text-white" : "border border-neutral-200 bg-white text-neutral-600 hover:bg-neutral-50"
            }`}
          >
            {item.label}
          </button>
        ))}
      </div>

      {entries.length === 0 ? (
        <div className="rounded-3xl border-2 border-dashed py-12 text-center italic text-neutral-400">
          {personFilteredEmpty ? "No programme items matched this person. Add the person name to Participants." : "No executive-visible movements yet."}
        </div>
      ) : (
        <div className="space-y-8">
          {dayGroups.map((dayGroup) => (
            <section key={dayGroup.key}>
              <div className="mb-3 border-b-2 border-neutral-900 pb-1">
                <h3 className="text-sm font-black uppercase underline">{formatLongDate(dayGroup.day?.date) || "Unscheduled"}</h3>
                {dayGroup.day?.title ? <p className="mt-1 text-xs font-semibold text-neutral-500">{dayGroup.day.title}</p> : null}
              </div>
              <div className="overflow-x-auto">
                <table className="min-w-[980px] w-full table-fixed border-collapse border border-neutral-200 bg-white text-sm shadow-sm">
                  <thead>
                    <tr className="bg-neutral-50 text-[10px] font-black uppercase tracking-tighter text-neutral-500">
                      <th className="border border-neutral-200 p-3 text-left">Time</th>
                      <th className="border border-neutral-200 p-3 text-left">Engagement / Movement</th>
                      <th className="border border-neutral-200 p-3 text-left">Venue</th>
                      <th className="border border-neutral-200 p-3 text-left">Address</th>
                      <th className="border border-neutral-200 p-3 text-left">Driver</th>
                      <th className="border border-neutral-200 p-3 text-left">Vehicle</th>
                      <th className="border border-neutral-200 p-3 text-left">Notes</th>
                      <th className="no-print border border-neutral-200 p-3 text-right">Manage</th>
                    </tr>
                  </thead>
                  <tbody>
                    {dayGroup.entries.map((entry) => {
                      const time = executiveTimeDisplay(entry);
                      return (
                        <tr key={entry.id} className="group align-top transition-colors hover:bg-neutral-50/50">
                          <td className="border border-neutral-200 p-3 font-bold text-neutral-900">{time.display}</td>
                          <td className="border border-neutral-200 p-3 font-semibold text-neutral-900">{entry.engagementDetails || EMPTY}</td>
                          <td className="border border-neutral-200 p-3 font-bold text-neutral-900">{entry.venue || EMPTY}</td>
                          <td className="border border-neutral-200 p-3 text-xs text-neutral-700">{entry.address || EMPTY}</td>
                          <td className="border border-neutral-200 p-3 text-neutral-700">{driversById.get(entry.driverId)?.name || EMPTY}</td>
                          <td className="border border-neutral-200 p-3 text-neutral-700">{vehiclesById.get(entry.vehicleId)?.name || EMPTY}</td>
                          <td className="whitespace-pre-line border border-neutral-200 p-3 text-neutral-700">
                            {executiveNotes(entry, time.needsConfirmation) || EMPTY}
                          </td>
                          <td className="no-print border border-neutral-200 p-3 text-right">
                            <div className="flex justify-end gap-1 opacity-0 transition-all group-hover:opacity-100">
                              <button onClick={() => onEdit(entry)} className="rounded-lg bg-blue-50 p-2 text-blue-600" title="Edit">
                                <Pencil className="h-4 w-4" />
                              </button>
                              <button onClick={() => onDelete(entry.id)} className="rounded-lg bg-red-50 p-2 text-red-600" title="Delete">
                                <Trash2 className="h-4 w-4" />
                              </button>
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </section>
          ))}
        </div>
      )}
    </div>
  );
}
