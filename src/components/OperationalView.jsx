import { GripVertical, Pencil, Trash2 } from "lucide-react";
import { useState } from "react";
import { sortMovementsByDateAndTime } from "../utils/calculations";
import { selectMovementsForView } from "../domain/audiences";
import { formatLongDate } from "../utils/time";
import { operationalPickupText } from "../domain/pickupPresentation";

const EMPTY = "-";
const HANDOVER_DND_TYPE = "application/x-scheduleit-handover";

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

function ensureHandoverDayGroups(dayGroups, vehicleHandoverNotes, scheduleDays, selectedDriverId) {
  const groupsByKey = new Map(dayGroups.map((group) => [group.key, group]));

  vehicleHandoverNotes
    .filter((note) => !selectedDriverId || handoverVisibleToDriver(note, selectedDriverId))
    .forEach((note) => {
      const day = scheduleDays.find((item) => item.id === note.scheduleDayId);
      const key = note.scheduleDayId || day?.date || "unscheduled";
      if (!groupsByKey.has(key)) {
        const group = {
          key,
          day,
          driverGroups: [],
          driverGroupsByKey: new Map(),
        };
        groupsByKey.set(key, group);
        dayGroups.push(group);
      }
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
      <td className="whitespace-pre-line border border-neutral-200 p-3 font-semibold text-neutral-900">{[entry.engagementDetails || EMPTY, operationalPickupText(entry)].filter(Boolean).join("\n\n")}</td>
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
    <div className="min-w-0 max-w-full overflow-x-auto">
      <table className="min-w-[1120px] w-full border-collapse border border-neutral-200 bg-white text-xs shadow-sm">
        <thead>
          <tr className="bg-neutral-50 text-[10px] uppercase font-black tracking-tighter text-neutral-500">
            <th className="no-print border border-neutral-200 p-3 text-center">Order</th>
            <th className="border border-neutral-200 p-3 text-left">Driver Start</th>
            <th className="border border-neutral-200 p-3 text-left">Official Departure</th>
            <th className="border border-neutral-200 p-3 text-left">Arrival Time</th>
            <th className="border border-neutral-200 p-3 text-left">Duty End</th>
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

function handoverRowsFor(vehicleHandoverNotes, scheduleDayId, selectedDriverId) {
  return [...(vehicleHandoverNotes || [])]
    .filter((note) => note.scheduleDayId === scheduleDayId)
    .filter((note) => !selectedDriverId || handoverVisibleToDriver(note, selectedDriverId))
    .sort((a, b) => (a.sortOrder ?? Number.MAX_SAFE_INTEGER) - (b.sortOrder ?? Number.MAX_SAFE_INTEGER));
}

function handoverVisibleToDriver(note, selectedDriverId) {
  return (
    (Array.isArray(note.visibleToDriverIds) && note.visibleToDriverIds.includes(selectedDriverId)) ||
    note.fromDriverId === selectedDriverId ||
    note.toDriverId === selectedDriverId
  );
}

function HandoverTable({
  notes,
  driversById,
  vehiclesById,
  canDragHandovers,
  draggedHandoverId,
  handoverDragOverId,
  onHandoverDragStart,
  onHandoverDragEnd,
  onHandoverRowDragOver,
  onHandoverRowDrop,
}) {
  if (notes.length === 0) return null;

  return (
    <div className="mt-4 min-w-0 max-w-full overflow-x-auto">
      <div className="mb-2 text-xs font-black uppercase tracking-widest text-neutral-500">Vehicle Handover / Car Location</div>
      <table className="min-w-[920px] w-full border-collapse border border-neutral-200 bg-white text-xs shadow-sm">
        <thead>
          <tr className="bg-neutral-50 text-[10px] uppercase font-black tracking-tighter text-neutral-500">
            {canDragHandovers ? <th className="no-print border border-neutral-200 p-3 text-center">Move</th> : null}
            <th className="border border-neutral-200 p-3 text-left">Time</th>
            <th className="border border-neutral-200 p-3 text-left">Vehicle</th>
            <th className="border border-neutral-200 p-3 text-left">From Driver</th>
            <th className="border border-neutral-200 p-3 text-left">To Driver</th>
            <th className="border border-neutral-200 p-3 text-left">Location</th>
            <th className="border border-neutral-200 p-3 text-left">Instruction</th>
            <th className="border border-neutral-200 p-3 text-left">Key Location</th>
            <th className="border border-neutral-200 p-3 text-left">Notes</th>
          </tr>
        </thead>
        <tbody>
          {notes.map((note) => (
            <tr
              key={note.id}
              onDragOver={(event) => onHandoverRowDragOver?.(event, note)}
              onDragLeave={() => {
                if (handoverDragOverId === `handover-${note.id}`) onHandoverDragEnd?.(false);
              }}
              onDrop={(event) => onHandoverRowDrop?.(event, note)}
              className={`align-top transition-colors ${
                handoverDragOverId === `handover-${note.id}` ? "bg-amber-50 ring-2 ring-inset ring-amber-200" : ""
              } ${draggedHandoverId === note.id ? "opacity-50" : ""}`}
            >
              {canDragHandovers ? (
                <td className="no-print border border-neutral-200 p-3 text-center">
                  <button
                    draggable
                    onDragStart={(event) => onHandoverDragStart(event, note)}
                    onDragEnd={() => onHandoverDragEnd()}
                    className="inline-flex cursor-grab rounded-lg bg-amber-50 p-2 text-amber-700 active:cursor-grabbing"
                    title="Drag vehicle handover to another day or driver section"
                  >
                    <GripVertical className="h-4 w-4" />
                  </button>
                </td>
              ) : null}
              <td className="border border-neutral-200 p-3 font-semibold text-neutral-900">{note.time || EMPTY}</td>
              <td className="border border-neutral-200 p-3 font-semibold text-neutral-900">{vehiclesById.get(note.vehicleId)?.name || EMPTY}</td>
              <td className="border border-neutral-200 p-3">{driversById.get(note.fromDriverId)?.name || EMPTY}</td>
              <td className="border border-neutral-200 p-3">{driversById.get(note.toDriverId)?.name || EMPTY}</td>
              <td className="border border-neutral-200 p-3">{note.location || EMPTY}</td>
              <td className="border border-neutral-200 p-3">{note.instruction || EMPTY}</td>
              <td className="border border-neutral-200 p-3">{note.keyLocation || EMPTY}</td>
              <td className="border border-neutral-200 p-3 whitespace-pre-line">{note.notes || EMPTY}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export default function OperationalView({
  entriesByMonth,
  vehicleHandoverNotes = [],
  drivers,
  vehicles,
  scheduleDays = [],
  onEdit,
  onDelete,
  onReorderMovements,
  groupByDriver = true,
  selectedDriverId = "",
  onMoveVehicleHandoverInOperational,
}) {
  const [draggedHandover, setDraggedHandover] = useState(null);
  const [handoverDragOverId, setHandoverDragOverId] = useState(null);
  const driversById = buildLookup(drivers);
  const vehiclesById = buildLookup(vehicles);
  const entries = sortMovementsByDateAndTime(
    selectMovementsForView(Object.values(entriesByMonth).flat(), selectedDriverId ? "driver" : "operational", { selectedDriverId }),
  );
  const dayGroups = ensureHandoverDayGroups(groupEntries(entries, driversById, vehiclesById, groupByDriver), vehicleHandoverNotes, scheduleDays, selectedDriverId);
  const visibleHandoverNotes = vehicleHandoverNotes.filter(
    (note) => !selectedDriverId || handoverVisibleToDriver(note, selectedDriverId),
  );
  const canDragHandovers = groupByDriver && Boolean(onMoveVehicleHandoverInOperational);

  function isHandoverDrag(event) {
    return Boolean(draggedHandover || Array.from(event.dataTransfer.types).includes(HANDOVER_DND_TYPE));
  }

  function handleHandoverDragStart(event, note) {
    setDraggedHandover(note);
    event.dataTransfer.effectAllowed = "move";
    event.dataTransfer.setData(HANDOVER_DND_TYPE, note.id);
  }

  function clearHandoverDragState(clearDragged = true) {
    if (clearDragged) setDraggedHandover(null);
    setHandoverDragOverId(null);
  }

  function handleHandoverTargetDragOver(event, targetId) {
    if (!canDragHandovers || !isHandoverDrag(event)) return;
    event.preventDefault();
    event.stopPropagation();
    event.dataTransfer.dropEffect = "move";
    setHandoverDragOverId(targetId);
  }

  function handleHandoverDrop(event, { targetScheduleDayId, targetDriverId = "", targetHandoverId = "" }) {
    if (!canDragHandovers || !isHandoverDrag(event)) return;
    event.preventDefault();
    event.stopPropagation();

    const handoverId = draggedHandover?.id || event.dataTransfer.getData(HANDOVER_DND_TYPE);
    onMoveVehicleHandoverInOperational?.({
      handoverId,
      targetScheduleDayId,
      targetDriverId,
      targetHandoverId,
    });
    clearHandoverDragState();
  }

  function handleHandoverRowDragOver(event, note) {
    if (draggedHandover?.id === note.id) return;
    handleHandoverTargetDragOver(event, `handover-${note.id}`);
  }

  if (entries.length === 0 && visibleHandoverNotes.length === 0) {
    return (
      <div className="py-12 text-center text-neutral-400 border-2 border-dashed rounded-3xl italic">
        No operational-visible movements yet.
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {dayGroups.map((dayGroup) => (
        <section
          key={dayGroup.key}
          onDragOver={(event) => handleHandoverTargetDragOver(event, `day-${dayGroup.day?.id || dayGroup.key}`)}
          onDragLeave={() => {
            if (handoverDragOverId === `day-${dayGroup.day?.id || dayGroup.key}`) clearHandoverDragState(false);
          }}
          onDrop={(event) =>
            handleHandoverDrop(event, {
              targetScheduleDayId: dayGroup.day?.id || dayGroup.key,
            })
          }
          className={`min-w-0 max-w-full rounded-2xl border bg-white p-3 transition-colors ${
            handoverDragOverId === `day-${dayGroup.day?.id || dayGroup.key}`
              ? "border-amber-300 bg-amber-50/40"
              : "border-neutral-200"
          }`}
        >
          <div className="mb-3 border-b border-neutral-200 pb-3">
            <h3 className="text-sm font-black uppercase tracking-widest text-neutral-900">
              {formatLongDate(dayGroup.day?.date) || "Unscheduled"}
            </h3>
            {dayGroup.day?.title ? <p className="mt-1 text-sm font-semibold text-neutral-500">{dayGroup.day.title}</p> : null}
          </div>
          <div className="space-y-4">
            {dayGroup.driverGroups.map((driverGroup) => (
              <div
                key={driverGroup.key}
                onDragOver={(event) => handleHandoverTargetDragOver(event, `driver-${dayGroup.day?.id || dayGroup.key}-${driverGroup.driverId}`)}
                onDragLeave={() => {
                  if (handoverDragOverId === `driver-${dayGroup.day?.id || dayGroup.key}-${driverGroup.driverId}`) {
                    clearHandoverDragState(false);
                  }
                }}
                onDrop={(event) =>
                  handleHandoverDrop(event, {
                    targetScheduleDayId: dayGroup.day?.id || dayGroup.key,
                    targetDriverId: driverGroup.driverId,
                  })
                }
                className={`min-w-0 max-w-full rounded-xl transition-colors ${
                  handoverDragOverId === `driver-${dayGroup.day?.id || dayGroup.key}-${driverGroup.driverId}`
                    ? "bg-amber-50 ring-2 ring-inset ring-amber-200"
                    : ""
                }`}
              >
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
          <HandoverTable
            notes={handoverRowsFor(vehicleHandoverNotes, dayGroup.day?.id || dayGroup.key, selectedDriverId)}
            driversById={driversById}
            vehiclesById={vehiclesById}
            canDragHandovers={canDragHandovers}
            draggedHandoverId={draggedHandover?.id}
            handoverDragOverId={handoverDragOverId}
            onHandoverDragStart={handleHandoverDragStart}
            onHandoverDragEnd={clearHandoverDragState}
            onHandoverRowDragOver={handleHandoverRowDragOver}
            onHandoverRowDrop={(event, note) =>
              handleHandoverDrop(event, {
                targetScheduleDayId: note.scheduleDayId,
                targetHandoverId: note.id,
              })
            }
          />
        </section>
      ))}
    </div>
  );
}
