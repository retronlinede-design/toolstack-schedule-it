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
import { AUDIENCE_PRESETS, applyAudiencePreset, getAudienceBadges, getAudienceSummary, getAudienceWarnings, normalizeMovementAudiences } from "../domain/audiences";

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
      className={`min-w-0 w-full max-w-full rounded-2xl border border-neutral-300 bg-white px-3 py-2 text-sm text-neutral-900 shadow-sm outline-none transition focus:border-neutral-500 focus:ring-2 focus:ring-neutral-200 ${props.className || ""}`}
    />
  );
}

function Textarea(props) {
  return (
    <textarea
      {...props}
      className={`min-h-[88px] min-w-0 w-full max-w-full rounded-2xl border border-neutral-300 bg-white px-3 py-2 text-sm text-neutral-900 shadow-sm outline-none transition focus:border-neutral-500 focus:ring-2 focus:ring-neutral-200 ${props.className || ""}`}
    />
  );
}

function Select(props) {
  return (
    <select
      {...props}
      className={`min-w-0 w-full max-w-full rounded-2xl border border-neutral-300 bg-white px-3 py-2 text-sm text-neutral-900 shadow-sm outline-none transition focus:border-neutral-500 focus:ring-2 focus:ring-neutral-200 ${props.className || ""}`}
    />
  );
}

function SectionCard({ title, subtitle, children }) {
  return (
    <section className="min-w-0 w-full max-w-full rounded-3xl bg-white p-4 shadow-sm md:p-5">
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

function openInMaps(venue, address) {
  const query = encodeURIComponent(`${venue || ""} ${address || ""}`.trim());
  if (!query) return;
  window.open(`https://www.google.com/maps/search/?api=1&query=${query}`, "_blank");
}

function AudienceEditor({ movement, drivers, vehicles, onChange, idPrefix }) {
  const audiences = normalizeMovementAudiences(movement, drivers.map((driver) => driver.id));
  const warnings = getAudienceWarnings({ ...movement, audiences });
  const warningId = `${idPrefix}-audience-warnings`;
  const update = (next) => onChange({ ...next, driverIds: next.driverIds.filter((id) => id !== movement.driverId) });
  const toggleDriver = (driverId, checked) => update({ ...audiences, driverIds: checked ? [...audiences.driverIds, driverId] : audiences.driverIds.filter((id) => id !== driverId) });

  return (
    <fieldset className="rounded-2xl border border-neutral-200 bg-neutral-50 p-4" aria-describedby={warnings.length ? warningId : undefined}>
      <legend className="px-2 text-sm font-semibold text-neutral-900">Audience</legend>
      <div className="mb-3 flex flex-wrap gap-2">
        {Object.entries(AUDIENCE_PRESETS).map(([id, preset]) => (
          <button key={id} type="button" onClick={() => update(applyAudiencePreset(audiences, id))} className="rounded-lg border border-neutral-300 bg-white px-2 py-1 text-xs font-medium text-neutral-700">{preset.label}</button>
        ))}
      </div>
      <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
        {[["executive", "Full Executive Programme"], ["operational", "Operational Programme"], ["cg", "CG Programme"], ["marida", "Marida Programme"]].map(([key, label]) => (
          <label key={key} className="flex items-center gap-2 text-sm text-neutral-700"><input type="checkbox" checked={audiences[key]} onChange={(event) => update({ ...audiences, [key]: event.target.checked })} />{label}</label>
        ))}
      </div>
      <div className="mt-4">
        <p className="text-sm font-semibold text-neutral-900">Additional Driver Programmes</p>
        <p className="text-xs text-neutral-500">The assigned driver is included automatically when Operational Programme is enabled.</p>
        <div className="mt-2 grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
          {drivers.filter((driver) => driver.id !== movement.driverId).map((driver) => {
            const vehicle = vehicles.find((item) => item.id === driver.defaultVehicle);
            return <label key={driver.id} className="flex items-center gap-2 text-sm text-neutral-700"><input type="checkbox" checked={audiences.driverIds.includes(driver.id)} onChange={(event) => toggleDriver(driver.id, event.target.checked)} />{driver.name}{vehicle ? ` / ${vehicle.name}` : ""}</label>;
          })}
        </div>
      </div>
      {warnings.length ? <ul id={warningId} className="mt-3 list-disc space-y-1 pl-5 text-xs font-medium text-amber-700">{warnings.map((warning) => <li key={warning}>{warning}</li>)}</ul> : null}
    </fieldset>
  );
}

function ConflictIssues({ issues = [], movement, onChange }) {
  const [reasons, setReasons] = useState({});
  if (!issues.length) return null;
  function acknowledge(issue) {
    const reason = (reasons[issue.conflictKey] || "").trim();
    if (reason.length < 10 || !window.confirm("Acknowledge this overlap override with the supplied reason?")) return;
    const existing = Array.isArray(movement.conflictOverrides) ? movement.conflictOverrides.filter((item) => item.conflictKey !== issue.conflictKey) : [];
    onChange({ ...movement, conflictOverrides: [...existing, { conflictKey: issue.conflictKey, reason, acknowledgedAt: new Date().toISOString() }] });
  }
  return (
    <div className="rounded-2xl border border-red-200 bg-red-50 p-3 text-sm text-red-900" role="alert">
      <strong>Review movement conflicts</strong>
      <ul className="mt-2 space-y-3">
        {issues.map((issue, index) => {
          const eligible = ["DRIVER_OVERLAP", "VEHICLE_OVERLAP"].includes(issue.type) && issue.severity === "error";
          return <li key={`${issue.type}-${issue.conflictKey || index}`}><p>{issue.field ? `${issue.field}: ` : ""}{issue.message}</p>{eligible ? <div className="mt-2 flex flex-wrap gap-2"><input aria-label="Override reason" value={reasons[issue.conflictKey] || ""} onChange={(event) => setReasons((current) => ({ ...current, [issue.conflictKey]: event.target.value }))} placeholder="Override reason (minimum 10 characters)" className="min-w-64 flex-1 rounded-lg border border-red-300 px-2 py-1 text-sm" /><button type="button" onClick={() => acknowledge(issue)} className="rounded-lg bg-red-700 px-3 py-1 font-semibold text-white">Acknowledge override</button></div> : null}</li>;
        })}
      </ul>
    </div>
  );
}

export default function ScheduleBuilder({
  draft,
  drivers,
  vehicles,
  scheduleDays,
  movements,
  vehicleHandoverNotes = [],
  importantInfoItems = [],
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
  onSaveVehicleHandoverNote,
  onDuplicateVehicleHandoverNote,
  onMoveVehicleHandoverNote,
  onDeleteVehicleHandoverNote,
  onSaveImportantInfoItem,
  onDuplicateImportantInfoItem,
  onMoveImportantInfoItem,
  onDeleteImportantInfoItem,
  integrity,
}) {
  const [editingMovementId, setEditingMovementId] = useState(null);
  const [inlineDraft, setInlineDraft] = useState(null);
  const [inlineErrors, setInlineErrors] = useState({});
  const [handoverDraft, setHandoverDraft] = useState({
    id: null,
    scheduleDayId: "",
    vehicleId: "",
    fromDriverId: "",
    toDriverId: "",
    visibleToDriverIds: [],
    location: "",
    instruction: "",
    keyLocation: "",
    time: "",
    notes: "",
    sortOrder: null,
  });
  const [handoverErrors, setHandoverErrors] = useState({});
  const [importantInfoDraft, setImportantInfoDraft] = useState({
    id: null,
    type: "Route",
    title: "",
    from: "",
    to: "",
    distance: "",
    estimatedTravelTime: "",
    name: "",
    phone: "",
    email: "",
    address: "",
    notes: "",
    sortOrder: null,
  });
  const [importantInfoErrors, setImportantInfoErrors] = useState({});
  const selectedDay = scheduleDays.find((day) => day.id === draft.scheduleDayId);
  const selectedDayMovements = sortMovementsByDateAndTime(
    movements
      .filter((movement) => movement.scheduleDayId === draft.scheduleDayId)
      .map((movement) => ({ ...movement, day: selectedDay })),
  );
  const sortedImportantInfoItems = [...importantInfoItems].sort(
    (a, b) => (a.sortOrder ?? Number.MAX_SAFE_INTEGER) - (b.sortOrder ?? Number.MAX_SAFE_INTEGER),
  );
  const selectedDayHandoverNotes = [...vehicleHandoverNotes]
    .filter((note) => note.scheduleDayId === draft.scheduleDayId)
    .sort((a, b) => (a.sortOrder ?? Number.MAX_SAFE_INTEGER) - (b.sortOrder ?? Number.MAX_SAFE_INTEGER));

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
        audiences: { ...normalizeMovementAudiences(current), driverIds: normalizeMovementAudiences(current).driverIds.filter((id) => id !== driverId) },
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
        audiences: { ...normalizeMovementAudiences(current), driverIds: normalizeMovementAudiences(current).driverIds.filter((id) => id !== driverId) },
      };
    });
  }

  function saveInlineEdit() {
    const nextErrors = validateMovement(inlineDraft);
    setInlineErrors(nextErrors);
    if (Object.keys(nextErrors).length > 0) return;

    const result = onUpdateMovement(inlineDraft);
    if (result?.ok === false) {
      setInlineErrors({ integrityIssues: result.issues });
      return;
    }
    setEditingMovementId(null);
    setInlineDraft(null);
    setInlineErrors({});
  }

  function cancelInlineEdit() {
    setEditingMovementId(null);
    setInlineDraft(null);
    setInlineErrors({});
  }

  function updateHandoverField(name, value) {
    setHandoverDraft((current) => ({
      ...current,
      [name]: value,
    }));
  }

  function clearHandoverDraft() {
    setHandoverDraft({
      id: null,
      scheduleDayId: draft.scheduleDayId || "",
      vehicleId: draft.vehicleId || vehicles[0]?.id || "",
      fromDriverId: "",
      toDriverId: "",
      visibleToDriverIds: [],
      location: "",
      instruction: "",
      keyLocation: "",
      time: "",
      notes: "",
      sortOrder: null,
    });
    setHandoverErrors({});
  }

  function editHandover(note) {
    setHandoverDraft({ ...note, visibleToDriverIds: Array.isArray(note.visibleToDriverIds) ? note.visibleToDriverIds : [] });
    setHandoverErrors({});
  }

  function updateHandoverVisibility(value) {
    let visibleToDriverIds = [];
    if (value === "all") visibleToDriverIds = drivers.map((driver) => driver.id);
    if (value && value !== "none" && value !== "all") visibleToDriverIds = [value];
    updateHandoverField("visibleToDriverIds", visibleToDriverIds);
  }

  function handoverVisibilityValue(note = handoverDraft) {
    const visibleIds = Array.isArray(note.visibleToDriverIds) ? note.visibleToDriverIds : [];
    if (visibleIds.length === 0) return "none";
    if (drivers.length > 0 && drivers.every((driver) => visibleIds.includes(driver.id))) return "all";
    return visibleIds[0] || "none";
  }

  function saveHandover() {
    const resolvedNote = {
      ...handoverDraft,
      scheduleDayId: handoverDraft.scheduleDayId || draft.scheduleDayId,
      vehicleId: handoverDraft.vehicleId || draft.vehicleId || vehicles[0]?.id || "",
    };
    const nextErrors = {};
    if (!resolvedNote.scheduleDayId) nextErrors.scheduleDayId = "Select a schedule day before saving a handover note.";
    if (!resolvedNote.vehicleId) nextErrors.vehicleId = "Select a vehicle.";
    if (!resolvedNote.location && !resolvedNote.instruction && !resolvedNote.keyLocation && !resolvedNote.notes) {
      nextErrors.note = "Enter a location, instruction, key location, or notes.";
    }
    setHandoverErrors(nextErrors);
    if (Object.keys(nextErrors).length > 0) return;

    const result = onSaveVehicleHandoverNote(resolvedNote);
    if (result?.ok === false) {
      setHandoverErrors({ integrityIssues: result.issues });
      return;
    }
    clearHandoverDraft();
  }

  function handoverPosition(note) {
    return {
      index: selectedDayHandoverNotes.findIndex((item) => item.id === note.id),
      count: selectedDayHandoverNotes.length,
    };
  }

  function updateImportantInfoField(name, value) {
    setImportantInfoDraft((current) => ({
      ...current,
      [name]: value,
    }));
  }

  function clearImportantInfoDraft() {
    setImportantInfoDraft({
      id: null,
      type: "Route",
      title: "",
      from: "",
      to: "",
      distance: "",
      estimatedTravelTime: "",
      name: "",
      phone: "",
      email: "",
      address: "",
      notes: "",
      sortOrder: null,
    });
    setImportantInfoErrors({});
  }

  function editImportantInfoItem(item) {
    setImportantInfoDraft({ ...item });
    setImportantInfoErrors({});
  }

  function saveImportantInfoItem() {
    const nextErrors = {};
    if (!importantInfoDraft.type) nextErrors.type = "Select a type.";
    if (
      !importantInfoDraft.title &&
      !importantInfoDraft.from &&
      !importantInfoDraft.to &&
      !importantInfoDraft.name &&
      !importantInfoDraft.phone &&
      !importantInfoDraft.email &&
      !importantInfoDraft.address &&
      !importantInfoDraft.notes
    ) {
      nextErrors.item = "Enter a title or at least one useful information field.";
    }
    setImportantInfoErrors(nextErrors);
    if (Object.keys(nextErrors).length > 0) return;

    onSaveImportantInfoItem(importantInfoDraft);
    clearImportantInfoDraft();
  }

  function importantInfoPosition(item) {
    return {
      index: sortedImportantInfoItems.findIndex((current) => current.id === item.id),
      count: sortedImportantInfoItems.length,
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
        </div>

        <AudienceEditor movement={draft} drivers={drivers} vehicles={vehicles} idPrefix="main" onChange={(audiences) => onChange((current) => ({ ...current, audiences, isExecutiveVisible: audiences.executive, isOperationalVisible: audiences.operational }))} />
        <label className="flex items-center gap-2 text-sm font-medium text-neutral-700"><input type="checkbox" checked={draft.continuesOvernight === true} onChange={(event) => updateField("continuesOvernight", event.target.checked)} />Continues past midnight</label>
        <ConflictIssues issues={errors.integrityIssues} movement={draft} onChange={onChange} />

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
            <div className="flex min-w-0 gap-2">
              <Input value={draft.venue} onChange={(event) => updateField("venue", event.target.value)} className="min-w-0 flex-1" />
              <button
                type="button"
                onClick={() => openInMaps(draft.venue, draft.address)}
                disabled={!draft.venue && !draft.address}
                className="inline-flex shrink-0 items-center justify-center rounded-2xl border border-neutral-300 bg-white px-3 text-neutral-700 shadow-sm transition hover:bg-neutral-50 disabled:cursor-not-allowed disabled:opacity-40"
                title="Open in Maps"
              >
                <MapPin className="h-4 w-4" />
              </button>
            </div>
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
          <div className="min-w-0 max-w-full overflow-x-auto">
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
                  const movementIssues = integrity?.conflictsByMovementId?.[movement.id] || [];

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
                          </div>

                          <div className="mt-3"><AudienceEditor movement={inlineDraft} drivers={drivers} vehicles={vehicles} idPrefix="inline" onChange={(audiences) => setInlineDraft((current) => ({ ...current, audiences, isExecutiveVisible: audiences.executive, isOperationalVisible: audiences.operational }))} /></div>
                          <label className="mt-3 flex items-center gap-2 text-sm font-medium text-neutral-700"><input type="checkbox" checked={inlineDraft.continuesOvernight === true} onChange={(event) => updateInlineField("continuesOvernight", event.target.checked)} />Continues past midnight</label>
                          <div className="mt-3"><ConflictIssues issues={inlineErrors.integrityIssues} movement={inlineDraft} onChange={setInlineDraft} /></div>

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
                          <td className="border border-neutral-200 p-3 text-neutral-900">
                            <div>{movement.engagementDetails || "-"}</div>
                            <div className="mt-1 flex flex-wrap gap-1" aria-label={getAudienceSummary(movement)}>{getAudienceBadges(movement).map((badge) => <span key={badge} className="rounded bg-neutral-100 px-1.5 py-0.5 text-[10px] font-semibold text-neutral-600">{badge}</span>)}</div>
                            <div className="mt-1 flex flex-wrap gap-1" aria-label="Schedule integrity indicators">
                              {movementIssues.some((issue) => issue.severity === "error") ? <span className="rounded bg-red-100 px-1.5 py-0.5 text-[10px] font-semibold text-red-700">Conflict</span> : null}
                              {movementIssues.some((issue) => issue.severity === "warning") ? <span className="rounded bg-amber-100 px-1.5 py-0.5 text-[10px] font-semibold text-amber-700">Warning</span> : null}
                              {movement.continuesOvernight ? <span className="rounded bg-blue-100 px-1.5 py-0.5 text-[10px] font-semibold text-blue-700">Overnight</span> : null}
                              {(movement.conflictOverrides || []).length ? <span className="rounded bg-purple-100 px-1.5 py-0.5 text-[10px] font-semibold text-purple-700">Override</span> : null}
                            </div>
                          </td>
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

      <SectionCard title="Selected Day Vehicle Handover / Car Location" subtitle="Manual vehicle location, handover, and key instructions for drivers">
        <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-4">
          <Field label="Vehicle" error={handoverErrors.vehicleId}>
            <Select value={handoverDraft.vehicleId || draft.vehicleId || ""} onChange={(event) => updateHandoverField("vehicleId", event.target.value)}>
              <option value="">Select vehicle...</option>
              {vehicles.map((vehicle) => (
                <option key={vehicle.id} value={vehicle.id}>
                  {vehicle.name}
                </option>
              ))}
            </Select>
          </Field>
          <Field label="From Driver">
            <Select value={handoverDraft.fromDriverId || ""} onChange={(event) => updateHandoverField("fromDriverId", event.target.value)}>
              <option value="">Unknown / none</option>
              {drivers.map((driver) => (
                <option key={driver.id} value={driver.id}>
                  {driver.name}
                </option>
              ))}
            </Select>
          </Field>
          <Field label="To Driver">
            <Select value={handoverDraft.toDriverId || ""} onChange={(event) => updateHandoverField("toDriverId", event.target.value)}>
              <option value="">Unknown / none</option>
              {drivers.map((driver) => (
                <option key={driver.id} value={driver.id}>
                  {driver.name}
                </option>
              ))}
            </Select>
          </Field>
          <Field label="Time">
            <Input type="time" value={handoverDraft.time} onChange={(event) => updateHandoverField("time", event.target.value)} />
          </Field>
          <Field label="Show on driver sheet">
            <Select value={handoverVisibilityValue()} onChange={(event) => updateHandoverVisibility(event.target.value)}>
              <option value="none">Operational only</option>
              {drivers.map((driver) => (
                <option key={driver.id} value={driver.id}>
                  {driver.name}
                </option>
              ))}
              <option value="all">Both drivers</option>
            </Select>
          </Field>
        </div>
        <div className="grid gap-3 md:grid-cols-3">
          <Field label="Location" error={handoverErrors.note}>
            <Input value={handoverDraft.location} onChange={(event) => updateHandoverField("location", event.target.value)} placeholder="Consulate garage" />
          </Field>
          <Field label="Instruction">
            <Input value={handoverDraft.instruction} onChange={(event) => updateHandoverField("instruction", event.target.value)} placeholder="Leave BMW at OR after final movement" />
          </Field>
          <Field label="Key Location">
            <Input value={handoverDraft.keyLocation} onChange={(event) => updateHandoverField("keyLocation", event.target.value)} placeholder="Reception" />
          </Field>
        </div>
        <Field label="Notes">
          <Textarea value={handoverDraft.notes} onChange={(event) => updateHandoverField("notes", event.target.value)} placeholder="Rory collects BMW from airport parking P20." />
        </Field>
        {handoverErrors.scheduleDayId ? <p className="text-xs font-medium text-red-600">{handoverErrors.scheduleDayId}</p> : null}
        {handoverErrors.integrityIssues?.length ? <ul className="list-disc pl-5 text-xs font-medium text-red-700">{handoverErrors.integrityIssues.map((issue, index) => <li key={`${issue.type}-${index}`}>{issue.message}</li>)}</ul> : null}
        <div className="flex flex-wrap gap-2">
          <button onClick={saveHandover} className="inline-flex items-center gap-2 rounded-xl bg-blue-600 px-3 py-2 text-sm font-medium text-white">
            <Save className="h-4 w-4" /> {handoverDraft.id ? "Update Handover" : "Add Handover"}
          </button>
          <button onClick={clearHandoverDraft} className="inline-flex items-center gap-2 rounded-xl border border-neutral-300 bg-white px-3 py-2 text-sm font-medium text-neutral-700">
            <Eraser className="h-4 w-4" /> Clear
          </button>
        </div>

        {selectedDayHandoverNotes.length === 0 ? (
          <div className="rounded-3xl border-2 border-dashed py-8 text-center text-sm italic text-neutral-400">
            No vehicle handover notes saved for this day yet.
          </div>
        ) : (
          <div className="min-w-0 max-w-full overflow-x-auto">
            <table className="min-w-[1040px] w-full border-collapse border border-neutral-200 bg-white text-sm">
              <thead className="bg-neutral-50 text-[10px] uppercase tracking-tighter text-neutral-500">
                <tr>
                  <th className="border border-neutral-200 p-3 text-left">Time</th>
                  <th className="border border-neutral-200 p-3 text-left">Vehicle</th>
                  <th className="border border-neutral-200 p-3 text-left">From Driver</th>
                  <th className="border border-neutral-200 p-3 text-left">To Driver</th>
                  <th className="border border-neutral-200 p-3 text-left">Driver Sheet</th>
                  <th className="border border-neutral-200 p-3 text-left">Location</th>
                  <th className="border border-neutral-200 p-3 text-left">Instruction</th>
                  <th className="border border-neutral-200 p-3 text-left">Key Location</th>
                  <th className="border border-neutral-200 p-3 text-left">Notes</th>
                  <th className="border border-neutral-200 p-3 text-right">Actions</th>
                </tr>
              </thead>
              <tbody>
                {selectedDayHandoverNotes.map((note) => {
                  const position = handoverPosition(note);
                  return (
                    <tr key={note.id} className="align-top">
                      <td className="border border-neutral-200 p-3 font-semibold text-neutral-900">{note.time || "-"}</td>
                      <td className="border border-neutral-200 p-3 font-semibold text-neutral-900">{getName(vehicles, note.vehicleId)}</td>
                      <td className="border border-neutral-200 p-3">{note.fromDriverId ? getName(drivers, note.fromDriverId) : "-"}</td>
                      <td className="border border-neutral-200 p-3">{note.toDriverId ? getName(drivers, note.toDriverId) : "-"}</td>
                      <td className="border border-neutral-200 p-3">
                        {Array.isArray(note.visibleToDriverIds) && note.visibleToDriverIds.length > 0
                          ? note.visibleToDriverIds.map((id) => getName(drivers, id)).join(", ")
                          : "Operational only"}
                      </td>
                      <td className="border border-neutral-200 p-3">{note.location || "-"}</td>
                      <td className="border border-neutral-200 p-3">{note.instruction || "-"}</td>
                      <td className="border border-neutral-200 p-3">{note.keyLocation || "-"}</td>
                      <td className="border border-neutral-200 p-3 whitespace-pre-line">{note.notes || "-"}</td>
                      <td className="border border-neutral-200 p-3">
                        <div className="flex justify-end gap-1">
                          <button onClick={() => editHandover(note)} className="rounded-lg bg-blue-50 p-2 text-blue-600" title="Edit handover">
                            <Pencil className="h-4 w-4" />
                          </button>
                          <button
                            onClick={() => onMoveVehicleHandoverNote(note.id, "up")}
                            disabled={position.index <= 0}
                            className="rounded-lg bg-neutral-50 p-2 text-neutral-700 disabled:cursor-not-allowed disabled:opacity-40"
                            title="Move up"
                          >
                            <ArrowUp className="h-4 w-4" />
                          </button>
                          <button
                            onClick={() => onMoveVehicleHandoverNote(note.id, "down")}
                            disabled={position.index < 0 || position.index === position.count - 1}
                            className="rounded-lg bg-neutral-50 p-2 text-neutral-700 disabled:cursor-not-allowed disabled:opacity-40"
                            title="Move down"
                          >
                            <ArrowDown className="h-4 w-4" />
                          </button>
                          <button onClick={() => onDuplicateVehicleHandoverNote(note)} className="rounded-lg bg-neutral-50 p-2 text-neutral-600" title="Duplicate handover">
                            <Copy className="h-4 w-4" />
                          </button>
                          <button onClick={() => onDeleteVehicleHandoverNote(note.id)} className="rounded-lg bg-red-50 p-2 text-red-600" title="Delete handover">
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

      <SectionCard title="Important Info" subtitle="Mission routes, contacts, addresses, phone numbers, and notes for the separate info document">
        <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-6">
          <Field label="Type" error={importantInfoErrors.type}>
            <Select value={importantInfoDraft.type} onChange={(event) => updateImportantInfoField("type", event.target.value)}>
              <option value="Route">Route</option>
              <option value="Contact">Contact</option>
              <option value="Address">Address</option>
              <option value="Note">Note</option>
            </Select>
          </Field>
          <Field label="Title" error={importantInfoErrors.item}>
            <Input value={importantInfoDraft.title} onChange={(event) => updateImportantInfoField("title", event.target.value)} placeholder="Airport transfer" />
          </Field>
          <Field label="From">
            <Input value={importantInfoDraft.from} onChange={(event) => updateImportantInfoField("from", event.target.value)} placeholder="Hotel" />
          </Field>
          <Field label="To">
            <Input value={importantInfoDraft.to} onChange={(event) => updateImportantInfoField("to", event.target.value)} placeholder="Airport" />
          </Field>
          <Field label="Distance">
            <Input value={importantInfoDraft.distance} onChange={(event) => updateImportantInfoField("distance", event.target.value)} placeholder="38 km" />
          </Field>
          <Field label="Estimated Time">
            <Input value={importantInfoDraft.estimatedTravelTime} onChange={(event) => updateImportantInfoField("estimatedTravelTime", event.target.value)} placeholder="35-45 min" />
          </Field>
        </div>
        <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-4">
          <Field label="Name">
            <Input value={importantInfoDraft.name} onChange={(event) => updateImportantInfoField("name", event.target.value)} placeholder="Contact name" />
          </Field>
          <Field label="Phone">
            <Input value={importantInfoDraft.phone} onChange={(event) => updateImportantInfoField("phone", event.target.value)} placeholder="+49..." />
          </Field>
          <Field label="Email">
            <Input type="email" value={importantInfoDraft.email} onChange={(event) => updateImportantInfoField("email", event.target.value)} placeholder="name@example.com" />
          </Field>
          <Field label="Address">
            <Input value={importantInfoDraft.address} onChange={(event) => updateImportantInfoField("address", event.target.value)} placeholder="Street, city" />
          </Field>
        </div>
        <Field label="Notes">
          <Textarea value={importantInfoDraft.notes} onChange={(event) => updateImportantInfoField("notes", event.target.value)} placeholder="Allow extra time during peak traffic." />
        </Field>
        <div className="flex flex-wrap gap-2">
          <button onClick={saveImportantInfoItem} className="inline-flex items-center gap-2 rounded-xl bg-blue-600 px-3 py-2 text-sm font-medium text-white">
            <Save className="h-4 w-4" /> {importantInfoDraft.id ? "Update Info" : "Add Info"}
          </button>
          <button onClick={clearImportantInfoDraft} className="inline-flex items-center gap-2 rounded-xl border border-neutral-300 bg-white px-3 py-2 text-sm font-medium text-neutral-700">
            <Eraser className="h-4 w-4" /> Clear
          </button>
        </div>

        {sortedImportantInfoItems.length === 0 ? (
          <div className="rounded-3xl border-2 border-dashed py-8 text-center text-sm italic text-neutral-400">
            No important information saved yet.
          </div>
        ) : (
          <div className="min-w-0 max-w-full overflow-x-auto">
            <table className="min-w-[1180px] w-full border-collapse border border-neutral-200 bg-white text-sm">
              <thead className="bg-neutral-50 text-[10px] uppercase tracking-tighter text-neutral-500">
                <tr>
                  <th className="border border-neutral-200 p-3 text-left">Type</th>
                  <th className="border border-neutral-200 p-3 text-left">Title</th>
                  <th className="border border-neutral-200 p-3 text-left">From</th>
                  <th className="border border-neutral-200 p-3 text-left">To</th>
                  <th className="border border-neutral-200 p-3 text-left">Distance</th>
                  <th className="border border-neutral-200 p-3 text-left">Estimated Travel Time</th>
                  <th className="border border-neutral-200 p-3 text-left">Name</th>
                  <th className="border border-neutral-200 p-3 text-left">Phone</th>
                  <th className="border border-neutral-200 p-3 text-left">Email</th>
                  <th className="border border-neutral-200 p-3 text-left">Address</th>
                  <th className="border border-neutral-200 p-3 text-left">Notes</th>
                  <th className="border border-neutral-200 p-3 text-right">Actions</th>
                </tr>
              </thead>
              <tbody>
                {sortedImportantInfoItems.map((item) => {
                  const position = importantInfoPosition(item);
                  return (
                    <tr key={item.id} className="align-top">
                      <td className="border border-neutral-200 p-3 font-black uppercase tracking-wide text-neutral-700">{item.type || "-"}</td>
                      <td className="border border-neutral-200 p-3 font-semibold text-neutral-900">{item.title || "-"}</td>
                      <td className="border border-neutral-200 p-3">{item.from || "-"}</td>
                      <td className="border border-neutral-200 p-3">{item.to || "-"}</td>
                      <td className="border border-neutral-200 p-3">{item.distance || "-"}</td>
                      <td className="border border-neutral-200 p-3">{item.estimatedTravelTime || "-"}</td>
                      <td className="border border-neutral-200 p-3">{item.name || "-"}</td>
                      <td className="border border-neutral-200 p-3">{item.phone || "-"}</td>
                      <td className="border border-neutral-200 p-3">{item.email || "-"}</td>
                      <td className="border border-neutral-200 p-3">{item.address || "-"}</td>
                      <td className="border border-neutral-200 p-3 whitespace-pre-line">{item.notes || "-"}</td>
                      <td className="border border-neutral-200 p-3">
                        <div className="flex justify-end gap-1">
                          <button onClick={() => editImportantInfoItem(item)} className="rounded-lg bg-blue-50 p-2 text-blue-600" title="Edit important info">
                            <Pencil className="h-4 w-4" />
                          </button>
                          <button
                            onClick={() => onMoveImportantInfoItem(item.id, "up")}
                            disabled={position.index <= 0}
                            className="rounded-lg bg-neutral-50 p-2 text-neutral-700 disabled:cursor-not-allowed disabled:opacity-40"
                            title="Move up"
                          >
                            <ArrowUp className="h-4 w-4" />
                          </button>
                          <button
                            onClick={() => onMoveImportantInfoItem(item.id, "down")}
                            disabled={position.index < 0 || position.index === position.count - 1}
                            className="rounded-lg bg-neutral-50 p-2 text-neutral-700 disabled:cursor-not-allowed disabled:opacity-40"
                            title="Move down"
                          >
                            <ArrowDown className="h-4 w-4" />
                          </button>
                          <button onClick={() => onDuplicateImportantInfoItem(item)} className="rounded-lg bg-neutral-50 p-2 text-neutral-600" title="Duplicate important info">
                            <Copy className="h-4 w-4" />
                          </button>
                          <button onClick={() => onDeleteImportantInfoItem(item.id)} className="rounded-lg bg-red-50 p-2 text-red-600" title="Delete important info">
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
