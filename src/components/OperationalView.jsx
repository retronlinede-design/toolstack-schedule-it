import { GripVertical, Pencil, Trash2 } from "lucide-react";
import { useState } from "react";
import { sortMovementsByDateAndTime } from "../utils/calculations";
import { formatLongDate } from "../utils/time";

const EMPTY = "-";

function buildLookup(items) {
  return new Map(items.map((item) => [item.id, item]));
}

function groupEntries(entries, driversById, vehiclesById, groupByDriver) {
  const dayGroups = [];
  const dayGroupsByKey = new Map();

  entries.forEach((entry) => {
    const dayKey = entry.day?.id || entry.day?.date || "unscheduled";
    if (!dayGroupsByKey.has(dayKey)) {
      const group = {
        key: dayKey,
        day: entry.day,
        driverGroups: [],
        driverGroupsByKey: new Map(),
      };
      dayGroupsByKey.set(dayKey, group);
      dayGroups.push(group);
    }

    const dayGroup = dayGroupsByKey.get(dayKey);
    const driverKey = groupByDriver ? entry.driverId || "unassigned" : "all";
    if (!dayGroup.driverGroupsByKey.has(driverKey)) {
      const driver = driversById.get(entry.driverId);
      const vehicle = vehiclesById.get(entry.vehicleId);
      const group = {
        key: driverKey,
        label: groupByDriver ? `${driver?.name || EMPTY} / ${vehicle?.name || EMPTY}` : "",
        driverId: entry.driverId,
        entries: [],
      };
      dayGroup.driverGroupsByKey.set(driverKey, group);
      dayGroup.driverGroups.push(group);
    }

    dayGroup.driverGroupsByKey.get(driverKey).entries.push(entry);
  });

  return dayGroups;
}

function OperationalRows({ entries, driversById, vehiclesById, onEdit, onDelete, onReorderMovements }) {
  const [draggedEntry, setDraggedEntry] = useState(null);
  const [dragOverId, setDragOverId] = useState(null);

  function canDropOn(entry) {
    return Boolean(
      draggedEntry &&
        draggedEntry.id !== entry.id &&
        draggedEntry.scheduleDayId === entry.scheduleDayId &&
        draggedEntry.driverId === entry.driverId,
    );
  }

  function handleDragStart(event, entry) {
    setDraggedEntry(entry);
    event.dataTransfer.effectAllowed = "move";
    event.dataTransfer.setData("text/plain", entry.id);
  }

  function handleDragOver(event, entry) {
    if (!canDropOn(entry)) return;
    event.preventDefault();
    event.dataTransfer.dropEffect = "move";
    setDragOverId(entry.id);
  }

  function clearDragState() {
    setDraggedEntry(null);
    setDragOverId(null);
  }

  function handleDrop(event, entry) {
    event.preventDefault();
    if (canDropOn(entry)) {
      onReorderMovements?.({
        draggedId: draggedEntry.id,
        targetId: entry.id,
        scheduleDayId: entry.scheduleDayId,
        driverId: entry.driverId,
      });
    }
    clearDragState();
  }

  return entries.map((entry) => (
    <tr
      key={entry.id}
      onDragOver={(event) => handleDragOver(event, entry)}
      onDragLeave={() => {
        if (dragOverId === entry.id) setDragOverId(null);
      }}
      onDrop={(event) => handleDrop(event, entry)}
      className={`group align-top transition-colors ${
        dragOverId === entry.id ? "bg-blue-50 ring-2 ring-inset ring-blue-200" : "hover:bg-neutral-50/50"
      } ${draggedEntry?.id === entry.id ? "opacity-50" : ""}`}
    >
      <td className="no-print border border-neutral-200 p-3 text-center">
        <button
          draggable={Boolean(onReorderMovements)}
          onDragStart={(event) => handleDragStart(event, entry)}
          onDragEnd={clearDragState}
          disabled={!onReorderMovements}
          className="inline-flex cursor-grab rounded-lg bg-neutral-50 p-2 text-neutral-500 active:cursor-grabbing disabled:cursor-not-allowed disabled:opacity-40"
          title="Drag to reorder within this driver group"
        >
          <GripVertical className="h-4 w-4" />
        </button>
      </td>
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
  ));
}

function OperationalTable({ entries, driversById, vehiclesById, onEdit, onDelete, onReorderMovements }) {
  return (
    <div className="overflow-x-auto">
      <table className="min-w-[1120px] w-full border-collapse border border-neutral-200 bg-white text-xs shadow-sm">
        <thead>
          <tr className="bg-neutral-50 text-[10px] uppercase font-black tracking-tighter text-neutral-500">
            <th className="no-print border border-neutral-200 p-3 text-center">Order</th>
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
          <OperationalRows
            entries={entries}
            driversById={driversById}
            vehiclesById={vehiclesById}
            onEdit={onEdit}
            onDelete={onDelete}
            onReorderMovements={onReorderMovements}
          />
        </tbody>
      </table>
    </div>
  );
}

export default function OperationalView({ entriesByMonth, drivers, vehicles, onEdit, onDelete, onReorderMovements, groupByDriver = true }) {
  const driversById = buildLookup(drivers);
  const vehiclesById = buildLookup(vehicles);
  const entries = sortMovementsByDateAndTime(
    Object.values(entriesByMonth)
      .flat()
      .filter((entry) => entry.isOperationalVisible !== false),
  );
  const dayGroups = groupEntries(entries, driversById, vehiclesById, groupByDriver);

  if (entries.length === 0) {
    return (
      <div className="py-12 text-center text-neutral-400 border-2 border-dashed rounded-3xl italic">
        No operational-visible movements yet.
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {dayGroups.map((dayGroup) => (
        <section key={dayGroup.key} className="rounded-2xl border border-neutral-200 bg-white p-3">
          <div className="mb-3 border-b border-neutral-200 pb-3">
            <h3 className="text-sm font-black uppercase tracking-widest text-neutral-900">
              {formatLongDate(dayGroup.day?.date) || "Unscheduled"}
            </h3>
            {dayGroup.day?.title ? <p className="mt-1 text-sm font-semibold text-neutral-500">{dayGroup.day.title}</p> : null}
          </div>
          <div className="space-y-4">
            {dayGroup.driverGroups.map((driverGroup) => (
              <div key={driverGroup.key}>
                {groupByDriver ? (
                  <div className="mb-2 rounded-xl bg-neutral-100 px-3 py-2 text-xs font-black uppercase tracking-widest text-neutral-700">
                    {driverGroup.label}
                  </div>
                ) : null}
                <OperationalTable
                  entries={driverGroup.entries}
                  driversById={driversById}
                  vehiclesById={vehiclesById}
                  onEdit={onEdit}
                  onDelete={onDelete}
                  onReorderMovements={onReorderMovements}
                />
              </div>
            ))}
          </div>
        </section>
      ))}
    </div>
  );
}
