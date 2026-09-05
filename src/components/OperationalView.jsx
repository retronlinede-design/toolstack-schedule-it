import { ChevronLeft, ChevronRight, GripVertical, Pencil, Plus, Trash2 } from "lucide-react";
import { Fragment, useState } from "react";
import { sortMovementsByDateAndTime } from "../utils/calculations";
import { selectMovementsForView } from "../domain/audiences";
import { formatLongDate } from "../utils/time";
import { operationalTimelineViewModel } from "../domain/pickupPresentation";
import { breakInsertionContext } from "../domain/operationalBreaks";
import OperationalBreakDialog from "./OperationalBreakDialog";
import MovementEditorDialog from "./MovementEditorDialog";
import {
  OPERATIONAL_FILTER_MODES,
  changeOperationalFilterMode,
  chronologicalScheduleDays,
  chronologicalOperationalDayGroups,
  createInitialOperationalFilter,
  filterOperationalDayGroups,
  localCalendarDate,
  navigateOperationalFilter,
  operationalDayLabel,
  operationalFilterRange,
  operationalPeriodLabel,
  reconcileOperationalFilter,
} from "./operationalDayFilter";

const EMPTY = "-";
const HANDOVER_DND_TYPE = "application/x-scheduleit-handover";

export function OperationalDateNavigation({ orderedDays, filter, onChange, todayDate }) {
  const selectedIndex = orderedDays.findIndex((day) => day.id === filter.dayId);
  const range = operationalFilterRange(filter);
  const showPeriodNavigation = filter.mode === "day" || filter.mode === "week" || filter.mode === "month";

  function changeMode(mode) {
    onChange((current) => changeOperationalFilterMode(current, mode, orderedDays, todayDate));
  }

  function navigate(offset) {
    onChange((current) => navigateOperationalFilter(current, orderedDays, offset));
  }

  return (
    <div className="no-print w-full space-y-2 rounded-xl border border-neutral-200 bg-neutral-50 p-2" aria-label="Operational date navigation">
      <div className="flex flex-wrap gap-1" role="group" aria-label="Operational date filter mode">
        {OPERATIONAL_FILTER_MODES.map((mode) => (
          <button
            key={mode}
            type="button"
            onClick={() => changeMode(mode)}
            aria-pressed={filter.mode === mode}
            className={`min-h-9 flex-1 rounded-lg border px-2 py-1.5 text-xs font-bold capitalize sm:flex-none sm:px-3 ${
              filter.mode === mode ? "border-[var(--ts-accent)] bg-[var(--ts-accent)] text-neutral-900" : "border-neutral-200 bg-white text-neutral-600"
            }`}
          >
            {mode[0].toUpperCase() + mode.slice(1)}
          </button>
        ))}
      </div>

      {showPeriodNavigation ? (
        <div className="flex min-w-0 items-center gap-2">
          <button
            type="button"
            onClick={() => navigate(-1)}
            disabled={filter.mode === "day" && selectedIndex <= 0}
            className="ts-button ts-button--secondary ts-icon-button min-h-10 h-10 w-10 min-w-10 p-0"
            aria-label={`Previous ${filter.mode}`}
            title={`Previous ${filter.mode}`}
          >
            <ChevronLeft className="h-4 w-4" />
          </button>
          {filter.mode === "day" ? (
            <label className="min-w-0 flex-1">
              <span className="sr-only">Operational day</span>
              <select
                value={filter.dayId}
                onChange={(event) => {
                  const day = orderedDays.find((item) => item.id === event.target.value);
                  onChange((current) => ({ ...current, dayId: event.target.value, anchorDate: day?.date || current.anchorDate }));
                }}
                className="ts-control min-h-10 h-10 truncate py-1.5 text-center font-semibold"
                aria-label="Operational day"
                disabled={orderedDays.length === 0}
              >
                {orderedDays.length === 0 ? <option value="">No schedule days</option> : null}
                {orderedDays.map((day) => <option key={day.id} value={day.id}>{operationalDayLabel(day)}</option>)}
              </select>
            </label>
          ) : (
            <div className="min-w-0 flex-1 truncate px-2 text-center text-sm font-bold text-neutral-900" aria-live="polite">
              {operationalPeriodLabel(filter, orderedDays)}
            </div>
          )}
          <button
            type="button"
            onClick={() => navigate(1)}
            disabled={filter.mode === "day" && (selectedIndex < 0 || selectedIndex === orderedDays.length - 1)}
            className="ts-button ts-button--secondary ts-icon-button min-h-10 h-10 w-10 min-w-10 p-0"
            aria-label={`Next ${filter.mode}`}
            title={`Next ${filter.mode}`}
          >
            <ChevronRight className="h-4 w-4" />
          </button>
        </div>
      ) : null}

      {filter.mode === "custom" ? (
        <div>
          <div className="grid gap-2 sm:grid-cols-2">
            <label className="text-xs font-semibold text-neutral-700">From
              <input type="date" value={filter.customFrom} onChange={(event) => onChange((current) => ({ ...current, customFrom: event.target.value }))} className="ts-control mt-1 min-h-10 h-10 py-1.5" aria-invalid={!range.valid} />
            </label>
            <label className="text-xs font-semibold text-neutral-700">To
              <input type="date" value={filter.customTo} onChange={(event) => onChange((current) => ({ ...current, customTo: event.target.value }))} className="ts-control mt-1 min-h-10 h-10 py-1.5" aria-invalid={!range.valid} />
            </label>
          </div>
          {!range.valid ? <p className="mt-2 text-xs font-semibold text-red-700" role="alert">{range.error}</p> : null}
        </div>
      ) : null}

      {filter.mode === "all" ? <p className="px-1 text-sm font-semibold text-neutral-700">All schedule days</p> : null}
    </div>
  );
}

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

function TimelineItem({ label, value, emphasis = false }) {
  return (
    <div className={`rounded-lg px-2 py-1.5 ${emphasis ? "bg-[var(--ts-accent-soft)]" : "bg-neutral-50"}`}>
      <div className="text-[9px] font-black uppercase tracking-wide text-neutral-500">{label}</div>
      <div className={`mt-0.5 font-mono text-xs tabular-nums text-neutral-900 ${emphasis ? "font-black" : "font-semibold"}`}>{value}</div>
    </div>
  );
}

function OperationalTimeline({ movement }) {
  const timeline = operationalTimelineViewModel(movement);

  return (
    <div className="min-w-52 space-y-1.5" aria-label="Movement timeline">
      {timeline.driverStart ? <TimelineItem label="Driver Start" value={timeline.driverStart} /> : null}
      {timeline.pickups.length ? (
        <section className="rounded-lg border border-blue-200 bg-blue-50/70 p-2" aria-label="Pickups">
          <div className="text-[9px] font-black uppercase tracking-wide text-blue-700">Pickups</div>
          <ol className="mt-1.5 space-y-2">
            {timeline.pickups.map((pickup) => (
              <li key={pickup.id} className="rounded-md border border-blue-100 bg-white p-2 text-xs text-neutral-800">
                <div className="flex flex-wrap items-baseline gap-x-1.5 gap-y-0.5">
                  <strong className="font-mono tabular-nums text-neutral-950">{pickup.time || "Time missing"}</strong>
                  {pickup.person ? <span className="font-bold text-neutral-900">{pickup.person}</span> : null}
                  <span className="font-semibold text-neutral-800">{pickup.location || "Location missing"}</span>
                </div>
                {pickup.address ? <div className="mt-1 text-[11px] text-neutral-600">{pickup.address}</div> : null}
                {pickup.contactPhone ? <div className="mt-1 text-[11px] font-semibold text-neutral-700">Contact: {pickup.contactPhone}</div> : null}
                {pickup.notes ? <div className="mt-1 whitespace-pre-line text-[11px] text-neutral-600">{pickup.notes}</div> : null}
              </li>
            ))}
          </ol>
        </section>
      ) : null}
      {timeline.departureTime ? <TimelineItem label="Departure" value={timeline.departureTime} /> : null}
      {timeline.arrivalTime ? <TimelineItem label="Arrival" value={timeline.arrivalTime} /> : null}
      {timeline.eventTime ? <TimelineItem label="Event / Meeting Time" value={timeline.eventTime} emphasis /> : null}
    </div>
  );
}

function AddBreakRow({ onClick }) {
  return (
    <tr className="no-print">
      <td colSpan="11" className="border-x border-neutral-200 px-3 py-1 text-center">
        <button type="button" onClick={onClick} className="inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-[10px] font-bold text-neutral-500 transition hover:bg-[var(--ts-accent-soft)] hover:text-neutral-900">
          <Plus className="h-3 w-3" /> Add Break
        </button>
      </td>
    </tr>
  );
}

function OperationalRows({ entries, driversById, vehiclesById, onEdit, onDelete, onReorderMovements, onRequestBreak }) {
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

  return (
    <>
      {entries.map((entry, index) => (
        <Fragment key={entry.id}>
          {onRequestBreak ? <AddBreakRow onClick={() => onRequestBreak(breakInsertionContext(entries, index))} /> : null}
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
      <td className="border border-neutral-200 p-2"><OperationalTimeline movement={entry} /></td>
      <td className="whitespace-pre-line border border-neutral-200 p-3 font-semibold text-neutral-900">{entry.engagementDetails || EMPTY}</td>
      <td className="border border-neutral-200 p-3">{entry.venue || EMPTY}</td>
      <td className="border border-neutral-200 p-3">{entry.address || EMPTY}</td>
      <td className="border border-neutral-200 p-3">{entry.locationNotes || EMPTY}</td>
      <td className="border border-neutral-200 p-3">{entry.parking || EMPTY}</td>
      <td className="border border-neutral-200 p-3">{entry.participants || EMPTY}</td>
      <td className="border border-neutral-200 p-3">{driversById.get(entry.driverId)?.name || EMPTY}</td>
      <td className="border border-neutral-200 p-3">{vehiclesById.get(entry.vehicleId)?.name || EMPTY}</td>
      <td className="no-print border border-neutral-200 p-3 text-right">
        <div className="flex justify-end gap-1">
          <button onClick={() => onEdit?.(entry)} className="inline-flex min-h-10 min-w-10 items-center justify-center rounded-lg bg-blue-50 p-2 text-blue-600" title="Edit" aria-label={`Edit ${entry.engagementDetails || "movement"}`}>
            <Pencil className="h-4 w-4" />
          </button>
          <button onClick={() => onDelete?.(entry.id)} className="inline-flex min-h-10 min-w-10 items-center justify-center rounded-lg bg-red-50 p-2 text-red-600" title="Delete" aria-label={`Delete ${entry.engagementDetails || "movement"}`}>
            <Trash2 className="h-4 w-4" />
          </button>
        </div>
      </td>
          </tr>
        </Fragment>
      ))}
      {onRequestBreak && entries.length ? <AddBreakRow onClick={() => onRequestBreak(breakInsertionContext(entries, entries.length))} /> : null}
    </>
  );
}

function OperationalTable({ entries, driversById, vehiclesById, onEdit, onDelete, onReorderMovements, onRequestBreak }) {
  return (
    <div className="min-w-0 max-w-full overflow-x-auto">
      <table className="min-w-[1040px] w-full border-collapse border border-neutral-200 bg-white text-xs shadow-sm">
        <thead>
          <tr className="bg-neutral-50 text-[10px] uppercase font-black tracking-tighter text-neutral-500">
            <th className="no-print border border-neutral-200 p-3 text-center">Order</th>
            <th className="border border-neutral-200 p-3 text-left">Timeline</th>
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
            onRequestBreak={onRequestBreak}
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
  profile,
  vehicleHandoverNotes = [],
  drivers,
  vehicles,
  scheduleDays = [],
  onEdit,
  onUpdateMovement,
  onCreateMovementDraft,
  onCreateMovement,
  onDelete,
  onReorderMovements,
  onCreateOperationalBreak,
  groupByDriver = true,
  selectedDriverId = "",
  onMoveVehicleHandoverInOperational,
  enableDayFilter = false,
  initialFilterState,
  initialEditingMovementId = null,
  initialCreatingDraft = null,
  todayDate = localCalendarDate(),
}) {
  const [draggedHandover, setDraggedHandover] = useState(null);
  const [handoverDragOverId, setHandoverDragOverId] = useState(null);
  const [breakContext, setBreakContext] = useState(null);
  const [editingMovementId, setEditingMovementId] = useState(initialEditingMovementId);
  const [creatingDraft, setCreatingDraft] = useState(initialCreatingDraft);
  const [dateFilter, setDateFilter] = useState(() => ({
    ...createInitialOperationalFilter(scheduleDays, todayDate),
    ...initialFilterState,
  }));
  const [availableDaysSignature, setAvailableDaysSignature] = useState(null);
  const driversById = buildLookup(drivers);
  const vehiclesById = buildLookup(vehicles);
  const entries = sortMovementsByDateAndTime(
    selectMovementsForView(Object.values(entriesByMonth).flat(), selectedDriverId ? "driver" : "operational", { selectedDriverId }),
  );
  const dayGroups = ensureHandoverDayGroups(groupEntries(entries, driversById, vehiclesById, groupByDriver), vehicleHandoverNotes, scheduleDays, selectedDriverId);
  const orderedDays = chronologicalScheduleDays(scheduleDays);
  const orderedDayGroups = enableDayFilter ? chronologicalOperationalDayGroups(dayGroups) : dayGroups;
  const nextAvailableDaysSignature = orderedDays.map((day) => `${day.id}:${day.date || ""}`).join("\u001f");
  const resolvedDateFilter = reconcileOperationalFilter(dateFilter, orderedDays, todayDate);
  if (enableDayFilter && availableDaysSignature !== nextAvailableDaysSignature) {
    setAvailableDaysSignature(nextAvailableDaysSignature);
    if (dateFilter !== resolvedDateFilter) setDateFilter(resolvedDateFilter);
  }
  const displayedDayGroups = enableDayFilter ? filterOperationalDayGroups(orderedDayGroups, orderedDays, resolvedDateFilter) : orderedDayGroups;
  const visibleHandoverNotes = vehicleHandoverNotes.filter(
    (note) => !selectedDriverId || handoverVisibleToDriver(note, selectedDriverId),
  );
  const canDragHandovers = groupByDriver && Boolean(onMoveVehicleHandoverInOperational);
  const canCreateBreak = groupByDriver && !selectedDriverId && Boolean(onCreateOperationalBreak);
  const editingMovement = entries.find((entry) => entry.id === editingMovementId);

  function handleEditRequest(movement) {
    if (onUpdateMovement) {
      setCreatingDraft(null);
      setEditingMovementId(movement.id);
    }
    else onEdit?.(movement);
  }

  function handleCreateRequest() {
    if (!onCreateMovementDraft) return;
    const scheduleDayId = resolvedDateFilter.mode === "day" ? resolvedDateFilter.dayId : "";
    setEditingMovementId(null);
    setCreatingDraft(onCreateMovementDraft(scheduleDayId));
  }

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

  if (!enableDayFilter && entries.length === 0 && visibleHandoverNotes.length === 0) {
    return (
      <div className="py-12 text-center text-neutral-400 border-2 border-dashed rounded-3xl italic">
        No operational-visible movements yet.
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {enableDayFilter ? (
        <OperationalDateNavigation orderedDays={orderedDays} filter={resolvedDateFilter} onChange={setDateFilter} todayDate={todayDate} />
      ) : null}
      {enableDayFilter && onCreateMovementDraft && onCreateMovement ? (
        <div className="no-print flex flex-wrap items-center justify-between gap-2 rounded-xl border border-neutral-200 bg-white p-2">
          <p className="min-w-0 text-xs font-medium text-neutral-600">
            {resolvedDateFilter.mode === "day" && resolvedDateFilter.dayId
              ? `New movements will start on ${operationalDayLabel(orderedDays.find((day) => day.id === resolvedDateFilter.dayId))}.`
              : "Choose the target schedule day in the movement editor."}
          </p>
          <button
            type="button"
            onClick={handleCreateRequest}
            disabled={orderedDays.length === 0}
            className="ts-button ts-button--primary min-h-11 shrink-0"
            aria-label={resolvedDateFilter.mode === "day" && resolvedDateFilter.dayId ? `Add movement to ${operationalDayLabel(orderedDays.find((day) => day.id === resolvedDateFilter.dayId))}` : "Add movement"}
          >
            <Plus className="h-4 w-4" /> Add Movement
          </button>
        </div>
      ) : null}
      {enableDayFilter && displayedDayGroups.length === 0 ? (
        <div className="py-12 text-center text-neutral-400 border-2 border-dashed rounded-3xl italic">
          {orderedDays.length ? "No operational-visible movements for this period." : "No schedule days are available yet."}
        </div>
      ) : null}
      {displayedDayGroups.map((dayGroup) => (
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
                  onEdit={handleEditRequest}
                  onDelete={onDelete}
                  onReorderMovements={onReorderMovements}
                  onRequestBreak={canCreateBreak ? setBreakContext : null}
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
      {breakContext ? (
        <OperationalBreakDialog
          context={breakContext}
          day={scheduleDays.find((day) => day.id === breakContext.scheduleDayId)}
          driver={driversById.get(breakContext.driverId)}
          vehicle={vehiclesById.get(breakContext.vehicleId)}
          schedule={{ scheduleDays, drivers, vehicles }}
          onSave={onCreateOperationalBreak}
          onClose={() => setBreakContext(null)}
        />
      ) : null}
      {editingMovement && onUpdateMovement ? (
        <MovementEditorDialog
          key={editingMovement.id}
          movement={editingMovement}
          day={scheduleDays.find((day) => day.id === editingMovement.scheduleDayId)}
          profile={profile}
          scheduleDays={scheduleDays}
          drivers={drivers}
          vehicles={vehicles}
          onSave={onUpdateMovement}
          onClose={() => setEditingMovementId(null)}
        />
      ) : null}
      {creatingDraft && onCreateMovement ? (
        <MovementEditorDialog
          key={creatingDraft.id}
          mode="create"
          initialDraft={creatingDraft}
          day={orderedDays.find((day) => day.id === creatingDraft.scheduleDayId)}
          profile={profile}
          scheduleDays={orderedDays}
          drivers={drivers}
          vehicles={vehicles}
          onSave={onCreateMovement}
          onClose={() => setCreatingDraft(null)}
        />
      ) : null}
    </div>
  );
}
