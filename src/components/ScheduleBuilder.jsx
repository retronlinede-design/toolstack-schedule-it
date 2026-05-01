import {
  CalendarDays,
  Car,
  Clock3,
  Copy,
  Eraser,
  FileText,
  MapPin,
  Pencil,
  Plus,
  Save,
  Trash2,
  ArrowDown,
  ArrowUp,
  Check,
  Users,
  X,
} from "lucide-react";
import { useState } from "react";
import { sortMovementsByDateAndTime } from "../utils/calculations";
import { getWeekday } from "../utils/time";

function Field({ label, icon: Icon, error, children }) {
  return (
    <label className="block">
      <div className="mb-2 flex items-center gap-2 text-sm text-neutral-900">
        {Icon ? <Icon className="h-4 w-4" /> : null}
        <span>{label}</span>
      </div>
      {children}
      {error ? <p className="mt-2 text-xs font-medium text-red-600">{error}</p> : null}
    </label>
  );
}

function Input(props) {
  return (
    <input
      {...props}
      className={`w-full rounded-2xl border border-neutral-300 bg-white px-3 py-2 text-sm text-neutral-900 shadow-sm outline-none transition focus:border-neutral-500 focus:ring-2 focus:ring-neutral-200 ${props.className || ""}`}
    />
  );
}

function Textarea(props) {
  return (
    <textarea
      {...props}
      className={`min-h-[88px] w-full rounded-2xl border border-neutral-300 bg-white px-3 py-2 text-sm text-neutral-900 shadow-sm outline-none transition focus:border-neutral-500 focus:ring-2 focus:ring-neutral-200 ${props.className || ""}`}
    />
  );
}

function Select(props) {
  return (
    <select
      {...props}
      className={`w-full rounded-2xl border border-neutral-300 bg-white px-3 py-2 text-sm text-neutral-900 shadow-sm outline-none transition focus:border-neutral-500 focus:ring-2 focus:ring-neutral-200 ${props.className || ""}`}
    />
  );
}

function SectionCard({ title, subtitle, children }) {
  return (
    <section className="rounded-3xl bg-white p-4 shadow-sm md:p-5">
      <div className="mb-3">
        <h2 className="text-xl font-semibold text-neutral-900">{title}</h2>
        {subtitle ? <p className="mt-1 text-sm text-neutral-700">{subtitle}</p> : null}
      </div>
      <div className="space-y-4">{children}</div>
    </section>
  );
}

function ActionButton({ children, onClick, variant = "secondary" }) {
  const styles =
    variant === "primary"
      ? "bg-blue-600 text-white hover:bg-blue-700"
      : "border border-neutral-300 bg-white text-neutral-900 hover:bg-neutral-50";

  return (
    <button onClick={onClick} className={`inline-flex items-center justify-center gap-2 rounded-xl px-4 py-2 text-sm font-medium shadow-sm transition ${styles}`}>
      {children}
    </button>
  );
}

function getName(items, id) {
  return items.find((item) => item.id === id)?.name || "-";
}

export default function ScheduleBuilder({
  draft,
  drivers,
  vehicles,
  scheduleDays,
  movements,
  routeNotes = [],
  errors = {},
  onChange,
  onSubmit,
  onCancelEdit,
  onClear,
  onCreateDay,
  onSelectDay,
  onUpdateDay,
  onDuplicateDay,
  onEditMovement,
  onUpdateMovement,
  onDuplicateMovement,
  onMoveMovement,
  onDeleteMovement,
  onSaveRouteNote,
  onDuplicateRouteNote,
  onMoveRouteNote,
  onDeleteRouteNote,
}) {
  const [editingMovementId, setEditingMovementId] = useState(null);
  const [inlineDraft, setInlineDraft] = useState(null);
  const [inlineErrors, setInlineErrors] = useState({});
  const [routeDraft, setRouteDraft] = useState({
    id: null,
    scheduleDayId: "",
    driverId: "",
    from: "",
    to: "",
    distance: "",
    estimatedTravelTime: "",
    notes: "",
    sortOrder: null,
  });
  const [routeErrors, setRouteErrors] = useState({});
  const selectedDay = scheduleDays.find((day) => day.id === draft.scheduleDayId);
  const selectedDayMovements = sortMovementsByDateAndTime(
    movements
      .filter((movement) => movement.scheduleDayId === draft.scheduleDayId)
      .map((movement) => ({ ...movement, day: selectedDay })),
  );
  const selectedDayRouteNotes = [...routeNotes]
    .filter((route) => route.scheduleDayId === draft.scheduleDayId)
    .sort((a, b) => {
      const driverCompare = getName(drivers, a.driverId).localeCompare(getName(drivers, b.driverId));
      if (driverCompare !== 0) return driverCompare;
      return (a.sortOrder ?? Number.MAX_SAFE_INTEGER) - (b.sortOrder ?? Number.MAX_SAFE_INTEGER);
    });

  function updateField(name, value) {
    onChange((current) => ({
      ...current,
      [name]: value,
      weekday: name === "date" ? getWeekday(value) : current.weekday,
    }));
  }

  function updateDriver(driverId) {
    onChange((current) => {
      const nextDriver = drivers.find((driver) => driver.id === driverId);
      const currentDriver = drivers.find((driver) => driver.id === current.driverId);
      const shouldUseDefaultVehicle = !current.vehicleId || current.vehicleId === currentDriver?.defaultVehicle;

      return {
        ...current,
        driverId,
        vehicleId: shouldUseDefaultVehicle ? nextDriver?.defaultVehicle || current.vehicleId : current.vehicleId,
      };
    });
  }

  function validateMovement(value) {
    const nextErrors = {};
    if (!value.scheduleDayId) nextErrors.scheduleDayId = "Schedule day is required.";
    if (!value.driverId) nextErrors.driverId = "Driver is required.";
    if (!value.vehicleId) nextErrors.vehicleId = "Vehicle is required.";
    if (!value.driverStart && !value.departureTime && !value.arrivalTime && !value.endTime) {
      nextErrors.timing = "Enter at least one timing field.";
    }
    if (!value.engagementDetails && !value.venue) {
      nextErrors.engagementDetails = "Enter engagement details or a venue.";
    }
    return nextErrors;
  }

  function startInlineEdit(movement) {
    if (editingMovementId && editingMovementId !== movement.id && !window.confirm("Discard unsaved inline edits and edit another row?")) {
      return;
    }
    setEditingMovementId(movement.id);
    setInlineDraft({ ...movement });
    setInlineErrors({});
  }

  function updateInlineField(name, value) {
    setInlineDraft((current) => ({
      ...current,
      [name]: value,
    }));
  }

  function updateInlineDriver(driverId) {
    setInlineDraft((current) => {
      const nextDriver = drivers.find((driver) => driver.id === driverId);
      const currentDriver = drivers.find((driver) => driver.id === current.driverId);
      const shouldUseDefaultVehicle = !current.vehicleId || current.vehicleId === currentDriver?.defaultVehicle;

      return {
        ...current,
        driverId,
        vehicleId: shouldUseDefaultVehicle ? nextDriver?.defaultVehicle || current.vehicleId : current.vehicleId,
      };
    });
  }

  function saveInlineEdit() {
    const nextErrors = validateMovement(inlineDraft);
    setInlineErrors(nextErrors);
    if (Object.keys(nextErrors).length > 0) return;

    onUpdateMovement(inlineDraft);
    setEditingMovementId(null);
    setInlineDraft(null);
    setInlineErrors({});
  }

  function cancelInlineEdit() {
    setEditingMovementId(null);
    setInlineDraft(null);
    setInlineErrors({});
  }

  function updateRouteField(name, value) {
    setRouteDraft((current) => ({
      ...current,
      [name]: value,
    }));
  }

  function clearRouteDraft() {
    setRouteDraft({
      id: null,
      scheduleDayId: draft.scheduleDayId || "",
      driverId: draft.driverId || drivers[0]?.id || "",
      from: "",
      to: "",
      distance: "",
      estimatedTravelTime: "",
      notes: "",
      sortOrder: null,
    });
    setRouteErrors({});
  }

  function editRoute(route) {
    setRouteDraft({ ...route });
    setRouteErrors({});
  }

  function saveRoute() {
    const resolvedRoute = {
      ...routeDraft,
      scheduleDayId: routeDraft.scheduleDayId || draft.scheduleDayId,
      driverId: routeDraft.driverId || draft.driverId || drivers[0]?.id || "",
    };
    const nextErrors = {};
    if (!resolvedRoute.scheduleDayId) nextErrors.scheduleDayId = "Select a schedule day before saving a route.";
    if (!resolvedRoute.driverId) nextErrors.driverId = "Select a driver.";
    if (!resolvedRoute.from && !resolvedRoute.to) nextErrors.route = "Enter at least a from or to location.";
    setRouteErrors(nextErrors);
    if (Object.keys(nextErrors).length > 0) return;

    onSaveRouteNote(resolvedRoute);
    clearRouteDraft();
  }

  function routePosition(route) {
    const peerRoutes = selectedDayRouteNotes.filter((item) => item.driverId === route.driverId);
    return {
      index: peerRoutes.findIndex((item) => item.id === route.id),
      count: peerRoutes.length,
    };
  }

  return (
    <div className="no-print space-y-5">
      <div className="grid gap-5 md:grid-cols-2">
        <SectionCard title="Profile Details" subtitle="Details on the mission">
          <div className="space-y-4">
            <Field label="Mission Name" icon={FileText}>
              <Input value={draft.missionName} onChange={(event) => updateField("missionName", event.target.value)} />
            </Field>
            <Field label="Document Title" icon={FileText}>
              <Input value={draft.documentTitle} onChange={(event) => updateField("documentTitle", event.target.value)} />
            </Field>
          </div>
        </SectionCard>

        <SectionCard title="Movement Actions" subtitle="Save, duplicate, or clear the active movement">
          <div className="grid gap-2 sm:grid-cols-2">
            <ActionButton onClick={onSubmit} variant="primary">
              <Save className="h-4 w-4" /> {draft.id ? "Update Movement" : "Save Movement"}
            </ActionButton>
            <ActionButton onClick={onClear}>
              <Eraser className="h-4 w-4" /> Clear Form
            </ActionButton>
            {draft.id ? (
              <ActionButton onClick={onCancelEdit}>
                <Plus className="h-4 w-4" /> New Movement
              </ActionButton>
            ) : null}
          </div>
        </SectionCard>
      </div>

      <SectionCard title="Schedule Day" subtitle="Create, select, duplicate, or update the day being edited">
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
          <Field label="Select Schedule Day" icon={CalendarDays} error={errors.scheduleDayId}>
            <Select value={draft.scheduleDayId || ""} onChange={(event) => onSelectDay(event.target.value)}>
              <option value="">Select a day...</option>
              {scheduleDays.map((day) => (
                <option key={day.id} value={day.id}>
                  {day.date} - {day.title}
                </option>
              ))}
            </Select>
          </Field>
          <Field label="Day Title" icon={FileText}>
            <Input value={draft.dayTitle} onChange={(event) => updateField("dayTitle", event.target.value)} placeholder="Programme day title" />
          </Field>
          <Field label="Date" icon={CalendarDays} error={errors.date}>
            <Input type="date" value={draft.date} onChange={(event) => updateField("date", event.target.value)} />
          </Field>
          <Field label="Weekday" icon={CalendarDays}>
            <Input value={draft.weekday} readOnly className="border-none bg-neutral-50 font-medium text-neutral-500" />
          </Field>
        </div>
        <div className="flex flex-wrap gap-2">
          <ActionButton onClick={onCreateDay}>
            <Plus className="h-4 w-4" /> Create Day
          </ActionButton>
          <ActionButton onClick={onUpdateDay}>
            <Save className="h-4 w-4" /> Update Day
          </ActionButton>
          <ActionButton onClick={onDuplicateDay}>
            <Copy className="h-4 w-4" /> Duplicate Day
          </ActionButton>
        </div>
      </SectionCard>

      <SectionCard title="Movement Editor" subtitle="Fields used by Executive, Operational, Driver, and Working Time views">
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
          <Field label="Schedule Day ID">
            <Input value={draft.scheduleDayId || ""} readOnly className="border-none bg-neutral-50 font-mono text-xs text-neutral-500" />
          </Field>
          <Field label="Driver" icon={Users} error={errors.driverId}>
            <Select value={draft.driverId || ""} onChange={(event) => updateDriver(event.target.value)}>
              <option value="">Select driver...</option>
              {drivers.map((driver) => (
                <option key={driver.id} value={driver.id}>
                  {driver.name}
                </option>
              ))}
            </Select>
          </Field>
          <Field label="Vehicle" icon={Car} error={errors.vehicleId}>
            <Select value={draft.vehicleId || ""} onChange={(event) => updateField("vehicleId", event.target.value)}>
              <option value="">Select vehicle...</option>
              {vehicles.map((vehicle) => (
                <option key={vehicle.id} value={vehicle.id}>
                  {vehicle.name}
                </option>
              ))}
            </Select>
          </Field>
          <div className="grid grid-cols-2 gap-3 rounded-2xl border border-neutral-200 bg-neutral-50 p-3">
            <label className="flex items-center gap-2 text-sm text-neutral-700">
              <input
                type="checkbox"
                checked={draft.isExecutiveVisible}
                onChange={(event) => updateField("isExecutiveVisible", event.target.checked)}
              />
              Executive
            </label>
            <label className="flex items-center gap-2 text-sm text-neutral-700">
              <input
                type="checkbox"
                checked={draft.isOperationalVisible}
                onChange={(event) => updateField("isOperationalVisible", event.target.checked)}
              />
              Operational
            </label>
          </div>
        </div>

        <div>
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
            <Field label="Driver Start" icon={Clock3}>
              <Input type="time" value={draft.driverStart} onChange={(event) => updateField("driverStart", event.target.value)} />
            </Field>
            <Field label="Departure Time" icon={Clock3}>
              <Input type="time" value={draft.departureTime} onChange={(event) => updateField("departureTime", event.target.value)} />
            </Field>
            <Field label="Arrival Time" icon={Clock3}>
              <Input type="time" value={draft.arrivalTime} onChange={(event) => updateField("arrivalTime", event.target.value)} />
            </Field>
            <Field label="End Time" icon={Clock3}>
              <Input type="time" value={draft.endTime} onChange={(event) => updateField("endTime", event.target.value)} />
            </Field>
          </div>
          {errors.timing ? <p className="mt-2 text-xs font-medium text-red-600">{errors.timing}</p> : null}
        </div>

        <div className="grid gap-4 md:grid-cols-2">
          <Field label="Engagement Details" icon={FileText} error={errors.engagementDetails}>
            <Input value={draft.engagementDetails} onChange={(event) => updateField("engagementDetails", event.target.value)} />
          </Field>
          <Field label="Venue" icon={MapPin}>
            <Input value={draft.venue} onChange={(event) => updateField("venue", event.target.value)} />
          </Field>
          <Field label="Address" icon={MapPin}>
            <Input value={draft.address} onChange={(event) => updateField("address", event.target.value)} />
          </Field>
          <Field label="Parking" icon={Car}>
            <Input value={draft.parking} onChange={(event) => updateField("parking", event.target.value)} />
          </Field>
        </div>

        <div className="grid gap-4 md:grid-cols-3">
          <Field label="Location Notes" icon={FileText}>
            <Textarea value={draft.locationNotes} onChange={(event) => updateField("locationNotes", event.target.value)} />
          </Field>
          <Field label="Participants" icon={Users}>
            <Textarea value={draft.participants} onChange={(event) => updateField("participants", event.target.value)} />
          </Field>
          <Field label="Internal Notes" icon={FileText}>
            <Textarea value={draft.internalNotes} onChange={(event) => updateField("internalNotes", event.target.value)} />
          </Field>
        </div>
      </SectionCard>

      <SectionCard title="Selected Day Movements" subtitle="Edit, duplicate, or delete saved movements for the selected day">
        {selectedDayMovements.length === 0 ? (
          <div className="rounded-3xl border-2 border-dashed py-8 text-center text-sm italic text-neutral-400">
            No movements saved for this day yet.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="min-w-[760px] w-full border-collapse border border-neutral-200 bg-white text-sm">
              <thead className="bg-neutral-50 text-[10px] uppercase tracking-tighter text-neutral-500">
                <tr>
                  <th className="border border-neutral-200 p-3 text-left">Time</th>
                  <th className="border border-neutral-200 p-3 text-left">Engagement</th>
                  <th className="border border-neutral-200 p-3 text-left">Venue</th>
                  <th className="border border-neutral-200 p-3 text-left">Driver</th>
                  <th className="border border-neutral-200 p-3 text-left">Vehicle</th>
                  <th className="border border-neutral-200 p-3 text-right">Actions</th>
                </tr>
              </thead>
              <tbody>
                {selectedDayMovements.map((movement, index) => {
                  const isEditing = editingMovementId === movement.id;
                  const hasActiveInlineEdit = Boolean(editingMovementId);

                  return (
                    <tr key={movement.id} className="align-top">
                      {isEditing ? (
                        <td colSpan="6" className="border border-blue-200 bg-blue-50/40 p-3">
                          <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-4">
                            <Field label="Driver Start">
                              <Input type="time" value={inlineDraft.driverStart} onChange={(event) => updateInlineField("driverStart", event.target.value)} />
                            </Field>
                            <Field label="Departure">
                              <Input type="time" value={inlineDraft.departureTime} onChange={(event) => updateInlineField("departureTime", event.target.value)} />
                            </Field>
                            <Field label="Arrival">
                              <Input type="time" value={inlineDraft.arrivalTime} onChange={(event) => updateInlineField("arrivalTime", event.target.value)} />
                            </Field>
                            <Field label="End">
                              <Input type="time" value={inlineDraft.endTime} onChange={(event) => updateInlineField("endTime", event.target.value)} />
                            </Field>
                          </div>
                          {inlineErrors.timing ? <p className="mt-2 text-xs font-medium text-red-600">{inlineErrors.timing}</p> : null}

                          <div className="mt-3 grid gap-3 md:grid-cols-2 lg:grid-cols-4">
                            <Field label="Engagement Details" error={inlineErrors.engagementDetails}>
                              <Input value={inlineDraft.engagementDetails} onChange={(event) => updateInlineField("engagementDetails", event.target.value)} />
                            </Field>
                            <Field label="Venue">
                              <Input value={inlineDraft.venue} onChange={(event) => updateInlineField("venue", event.target.value)} />
                            </Field>
                            <Field label="Address">
                              <Input value={inlineDraft.address} onChange={(event) => updateInlineField("address", event.target.value)} />
                            </Field>
                            <Field label="Parking">
                              <Input value={inlineDraft.parking} onChange={(event) => updateInlineField("parking", event.target.value)} />
                            </Field>
                          </div>

                          <div className="mt-3 grid gap-3 md:grid-cols-2 lg:grid-cols-4">
                            <Field label="Driver" error={inlineErrors.driverId}>
                              <Select value={inlineDraft.driverId || ""} onChange={(event) => updateInlineDriver(event.target.value)}>
                                <option value="">Select driver...</option>
                                {drivers.map((driver) => (
                                  <option key={driver.id} value={driver.id}>
                                    {driver.name}
                                  </option>
                                ))}
                              </Select>
                            </Field>
                            <Field label="Vehicle" error={inlineErrors.vehicleId}>
                              <Select value={inlineDraft.vehicleId || ""} onChange={(event) => updateInlineField("vehicleId", event.target.value)}>
                                <option value="">Select vehicle...</option>
                                {vehicles.map((vehicle) => (
                                  <option key={vehicle.id} value={vehicle.id}>
                                    {vehicle.name}
                                  </option>
                                ))}
                              </Select>
                            </Field>
                            <div className="grid grid-cols-2 gap-3 rounded-2xl border border-neutral-200 bg-white p-3">
                              <label className="flex items-center gap-2 text-sm text-neutral-700">
                                <input
                                  type="checkbox"
                                  checked={inlineDraft.isExecutiveVisible}
                                  onChange={(event) => updateInlineField("isExecutiveVisible", event.target.checked)}
                                />
                                Executive
                              </label>
                              <label className="flex items-center gap-2 text-sm text-neutral-700">
                                <input
                                  type="checkbox"
                                  checked={inlineDraft.isOperationalVisible}
                                  onChange={(event) => updateInlineField("isOperationalVisible", event.target.checked)}
                                />
                                Operational
                              </label>
                            </div>
                          </div>

                          <div className="mt-3 grid gap-3 md:grid-cols-3">
                            <Field label="Location Notes">
                              <Textarea value={inlineDraft.locationNotes} onChange={(event) => updateInlineField("locationNotes", event.target.value)} />
                            </Field>
                            <Field label="Participants">
                              <Textarea value={inlineDraft.participants} onChange={(event) => updateInlineField("participants", event.target.value)} />
                            </Field>
                            <Field label="Internal Notes">
                              <Textarea value={inlineDraft.internalNotes} onChange={(event) => updateInlineField("internalNotes", event.target.value)} />
                            </Field>
                          </div>
                          {inlineErrors.scheduleDayId ? <p className="mt-2 text-xs font-medium text-red-600">{inlineErrors.scheduleDayId}</p> : null}

                          <div className="mt-3 flex flex-wrap justify-end gap-2">
                            <button onClick={saveInlineEdit} className="inline-flex items-center gap-2 rounded-xl bg-blue-600 px-3 py-2 text-sm font-medium text-white">
                              <Check className="h-4 w-4" /> Save
                            </button>
                            <button onClick={cancelInlineEdit} className="inline-flex items-center gap-2 rounded-xl border border-neutral-300 bg-white px-3 py-2 text-sm font-medium text-neutral-700">
                              <X className="h-4 w-4" /> Cancel
                            </button>
                          </div>
                        </td>
                      ) : (
                        <>
                          <td className="border border-neutral-200 p-3 font-bold text-neutral-900">
                            {movement.driverStart || movement.departureTime || movement.arrivalTime || movement.endTime || "-"}
                          </td>
                          <td className="border border-neutral-200 p-3 text-neutral-900">{movement.engagementDetails || "-"}</td>
                          <td className="border border-neutral-200 p-3 text-neutral-700">{movement.venue || movement.address || "-"}</td>
                          <td className="border border-neutral-200 p-3 text-neutral-700">{getName(drivers, movement.driverId)}</td>
                          <td className="border border-neutral-200 p-3 text-neutral-700">{getName(vehicles, movement.vehicleId)}</td>
                          <td className="border border-neutral-200 p-3">
                            <div className="flex justify-end gap-1">
                              <button onClick={() => startInlineEdit(movement)} className="rounded-lg bg-emerald-50 p-2 text-emerald-700" title="Edit inline">
                                <Pencil className="h-4 w-4" />
                              </button>
                              <button
                                onClick={() => onEditMovement(movement)}
                                disabled={hasActiveInlineEdit}
                                className="rounded-lg bg-blue-50 p-2 text-blue-600 disabled:cursor-not-allowed disabled:opacity-40"
                                title="Edit in main form"
                              >
                                <Pencil className="h-4 w-4" />
                              </button>
                              <button
                                onClick={() => onMoveMovement(movement.id, "up")}
                                disabled={hasActiveInlineEdit || index === 0}
                                className="rounded-lg bg-neutral-50 p-2 text-neutral-700 disabled:cursor-not-allowed disabled:opacity-40"
                                title="Move up"
                              >
                                <ArrowUp className="h-4 w-4" />
                              </button>
                              <button
                                onClick={() => onMoveMovement(movement.id, "down")}
                                disabled={hasActiveInlineEdit || index === selectedDayMovements.length - 1}
                                className="rounded-lg bg-neutral-50 p-2 text-neutral-700 disabled:cursor-not-allowed disabled:opacity-40"
                                title="Move down"
                              >
                                <ArrowDown className="h-4 w-4" />
                              </button>
                              <button
                                onClick={() => onDuplicateMovement(movement)}
                                disabled={hasActiveInlineEdit}
                                className="rounded-lg bg-neutral-50 p-2 text-neutral-600 disabled:cursor-not-allowed disabled:opacity-40"
                                title="Duplicate movement"
                              >
                                <Copy className="h-4 w-4" />
                              </button>
                              <button
                                onClick={() => onDeleteMovement(movement.id)}
                                disabled={hasActiveInlineEdit}
                                className="rounded-lg bg-red-50 p-2 text-red-600 disabled:cursor-not-allowed disabled:opacity-40"
                                title="Delete movement"
                              >
                                <Trash2 className="h-4 w-4" />
                              </button>
                            </div>
                          </td>
                        </>
                      )}
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </SectionCard>

      <SectionCard title="Selected Day Driver Routes" subtitle="Manual route notes for common daily driver logistics">
        <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-6">
          <Field label="Driver" error={routeErrors.driverId}>
            <Select value={routeDraft.driverId || draft.driverId || ""} onChange={(event) => updateRouteField("driverId", event.target.value)}>
              <option value="">Select driver...</option>
              {drivers.map((driver) => (
                <option key={driver.id} value={driver.id}>
                  {driver.name}
                </option>
              ))}
            </Select>
          </Field>
          <Field label="From" error={routeErrors.route}>
            <Input value={routeDraft.from} onChange={(event) => updateRouteField("from", event.target.value)} placeholder="Hotel" />
          </Field>
          <Field label="To">
            <Input value={routeDraft.to} onChange={(event) => updateRouteField("to", event.target.value)} placeholder="Airport" />
          </Field>
          <Field label="Distance">
            <Input value={routeDraft.distance} onChange={(event) => updateRouteField("distance", event.target.value)} placeholder="38 km" />
          </Field>
          <Field label="Estimated Time">
            <Input value={routeDraft.estimatedTravelTime} onChange={(event) => updateRouteField("estimatedTravelTime", event.target.value)} placeholder="35-45 min" />
          </Field>
          <div className="flex items-end gap-2">
            <button onClick={saveRoute} className="inline-flex items-center gap-2 rounded-xl bg-blue-600 px-3 py-2 text-sm font-medium text-white">
              <Save className="h-4 w-4" /> {routeDraft.id ? "Update" : "Add"}
            </button>
            <button onClick={clearRouteDraft} className="inline-flex items-center gap-2 rounded-xl border border-neutral-300 bg-white px-3 py-2 text-sm font-medium text-neutral-700">
              <Eraser className="h-4 w-4" /> Clear
            </button>
          </div>
        </div>
        {routeErrors.scheduleDayId ? <p className="text-xs font-medium text-red-600">{routeErrors.scheduleDayId}</p> : null}
        <Field label="Notes">
          <Textarea value={routeDraft.notes} onChange={(event) => updateRouteField("notes", event.target.value)} placeholder="Allow extra time during peak traffic." />
        </Field>

        {selectedDayRouteNotes.length === 0 ? (
          <div className="rounded-3xl border-2 border-dashed py-8 text-center text-sm italic text-neutral-400">
            No route notes saved for this day yet.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="min-w-[860px] w-full border-collapse border border-neutral-200 bg-white text-sm">
              <thead className="bg-neutral-50 text-[10px] uppercase tracking-tighter text-neutral-500">
                <tr>
                  <th className="border border-neutral-200 p-3 text-left">Driver</th>
                  <th className="border border-neutral-200 p-3 text-left">From</th>
                  <th className="border border-neutral-200 p-3 text-left">To</th>
                  <th className="border border-neutral-200 p-3 text-left">Distance</th>
                  <th className="border border-neutral-200 p-3 text-left">Estimated Travel Time</th>
                  <th className="border border-neutral-200 p-3 text-left">Notes</th>
                  <th className="border border-neutral-200 p-3 text-right">Actions</th>
                </tr>
              </thead>
              <tbody>
                {selectedDayRouteNotes.map((route) => {
                  const position = routePosition(route);
                  return (
                    <tr key={route.id} className="align-top">
                      <td className="border border-neutral-200 p-3 font-semibold text-neutral-900">{getName(drivers, route.driverId)}</td>
                      <td className="border border-neutral-200 p-3">{route.from || "-"}</td>
                      <td className="border border-neutral-200 p-3">{route.to || "-"}</td>
                      <td className="border border-neutral-200 p-3">{route.distance || "-"}</td>
                      <td className="border border-neutral-200 p-3">{route.estimatedTravelTime || "-"}</td>
                      <td className="border border-neutral-200 p-3">{route.notes || "-"}</td>
                      <td className="border border-neutral-200 p-3">
                        <div className="flex justify-end gap-1">
                          <button onClick={() => editRoute(route)} className="rounded-lg bg-blue-50 p-2 text-blue-600" title="Edit route">
                            <Pencil className="h-4 w-4" />
                          </button>
                          <button
                            onClick={() => onMoveRouteNote(route.id, "up")}
                            disabled={position.index <= 0}
                            className="rounded-lg bg-neutral-50 p-2 text-neutral-700 disabled:cursor-not-allowed disabled:opacity-40"
                            title="Move up"
                          >
                            <ArrowUp className="h-4 w-4" />
                          </button>
                          <button
                            onClick={() => onMoveRouteNote(route.id, "down")}
                            disabled={position.index < 0 || position.index === position.count - 1}
                            className="rounded-lg bg-neutral-50 p-2 text-neutral-700 disabled:cursor-not-allowed disabled:opacity-40"
                            title="Move down"
                          >
                            <ArrowDown className="h-4 w-4" />
                          </button>
                          <button onClick={() => onDuplicateRouteNote(route)} className="rounded-lg bg-neutral-50 p-2 text-neutral-600" title="Duplicate route">
                            <Copy className="h-4 w-4" />
                          </button>
                          <button onClick={() => onDeleteRouteNote(route.id)} className="rounded-lg bg-red-50 p-2 text-red-600" title="Delete route">
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
        )}
      </SectionCard>
    </div>
  );
}
