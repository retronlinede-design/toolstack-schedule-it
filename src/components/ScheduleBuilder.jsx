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
import Card from "./ui/Card";
import SectionHeader from "./ui/SectionHeader";
import { Button } from "./ui/Button";
import { Input as UiInput, Select as UiSelect, Textarea as UiTextarea } from "./ui/FormControls";
import Badge from "./ui/Badge";
import EmptyState from "./ui/EmptyState";
import DayNavigator from "./builder/DayNavigator";
import MovementCard from "./builder/MovementCard";
import HandoverCard from "./builder/HandoverCard";
import ImportantInfoCard from "./builder/ImportantInfoCard";
import DisclosureSection from "./builder/DisclosureSection";

function Field({ label, icon: Icon, error, children }) {
  return (
    <label className="ts-label">
      <div className="ts-label-text">
        {Icon ? <Icon className="h-4 w-4" /> : null}
        <span>{label}</span>
      </div>
      {children}
      {error ? <p className="ts-field-error">{error}</p> : null}
    </label>
  );
}

function Input(props) {
  return <UiInput {...props} />;
}

function Textarea(props) {
  return <UiTextarea {...props} />;
}

function Select(props) {
  return <UiSelect {...props} />;
}

function SectionCard({ title, subtitle, children }) {
  return (
    <Card className="w-full p-4 md:p-5">
      <SectionHeader title={title} description={subtitle} />
      <div className="space-y-4">{children}</div>
    </Card>
  );
}

function ActionButton({ children, onClick, variant = "secondary" }) {
  return (
    <Button onClick={onClick} variant={variant === "primary" ? "primary" : "secondary"}>
      {children}
    </Button>
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
    <fieldset className="ts-fieldset" aria-describedby={warnings.length ? warningId : undefined}>
      <legend className="px-2 text-sm font-semibold text-neutral-900">Audience</legend>
      <div className="mb-3 flex flex-wrap gap-2">
        {Object.entries(AUDIENCE_PRESETS).map(([id, preset]) => (
            <Button key={id} onClick={() => update(applyAudiencePreset(audiences, id))} className="min-h-0 px-2 py-1 text-xs">{preset.label}</Button>
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
    <div className="ts-alert ts-alert--danger" role="alert">
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
    window.requestAnimationFrame(() => document.getElementById(`movement-${inlineDraft.id}`)?.focus({ preventScroll: true }));
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
              <Save className="h-4 w-4" /> {draft.id ? "Update Movement" : "Add Movement"}
            </ActionButton>
            <ActionButton onClick={onClear}>
              <Eraser className="h-4 w-4" /> Reset Draft
            </ActionButton>
            {draft.id ? (
              <ActionButton onClick={onCancelEdit}>
                <X className="h-4 w-4" /> Cancel Edit
              </ActionButton>
            ) : null}
          </div>
        </SectionCard>
      </div>

      <SectionCard title="Schedule Day" subtitle="Create, select, duplicate, or update the day being edited">
        <DayNavigator days={scheduleDays} selectedDayId={draft.scheduleDayId} movements={movements} integrity={integrity} onSelect={onSelectDay} />
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
        <div className="flex flex-col gap-4">
        <div className="order-2"><h3 className="mb-3 text-base font-semibold">Assignment</h3>
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
        </div>

        <DisclosureSection className="order-4" title="Audience" summary={getAudienceSummary(draft)} forceOpen={Boolean(errors.integrityIssues?.length)}>
          <AudienceEditor movement={draft} drivers={drivers} vehicles={vehicles} idPrefix="main" onChange={(audiences) => onChange((current) => ({ ...current, audiences, isExecutiveVisible: audiences.executive, isOperationalVisible: audiences.operational }))} />
        </DisclosureSection>

        <div className="order-3">
          <h3 className="mb-3 text-base font-semibold">Timing</h3>
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
            <Field label="Event Start" icon={Clock3}>
              <Input type="time" value={draft.eventStartTime} onChange={(event) => updateField("eventStartTime", event.target.value)} />
            </Field>
            <Field label="Event End" icon={Clock3}>
              <Input type="time" value={draft.eventEndTime} onChange={(event) => updateField("eventEndTime", event.target.value)} />
            </Field>
            <Field label="End Time" icon={Clock3}>
              <Input type="time" value={draft.endTime} onChange={(event) => updateField("endTime", event.target.value)} />
            </Field>
          </div>
          <label className="mt-3 flex items-center gap-2 text-sm font-medium text-neutral-700"><input type="checkbox" checked={draft.continuesOvernight === true} onChange={(event) => updateField("continuesOvernight", event.target.checked)} />Continues past midnight</label>
          {errors.timing ? <p className="mt-2 text-xs font-medium text-red-600">{errors.timing}</p> : null}
          <div className="mt-3"><ConflictIssues issues={errors.integrityIssues} movement={draft} onChange={onChange} /></div>
        </div>

        <div className="order-1"><h3 className="mb-3 text-base font-semibold">Core details</h3>
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
          <Field label="Participants" icon={Users}>
            <Textarea value={draft.participants} onChange={(event) => updateField("participants", event.target.value)} />
          </Field>
        </div>
        </div>

        <DisclosureSection className="order-5" title="Operational details" summary={[draft.contactPerson && "Contact added", draft.parking && "Parking added", draft.securityNotes && "Security notes", draft.protocolNotes && "Protocol notes", draft.internalNotes && "Internal notes"].filter(Boolean).join(" · ") || "No additional operational details"}>
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          <Field label="Contact Person"><Input value={draft.contactPerson || ""} onChange={(event) => updateField("contactPerson", event.target.value)} /></Field>
          <Field label="Contact Phone"><Input type="tel" value={draft.contactPhone || ""} onChange={(event) => updateField("contactPhone", event.target.value)} /></Field>
          <Field label="Location Notes" icon={FileText}>
            <Textarea value={draft.locationNotes} onChange={(event) => updateField("locationNotes", event.target.value)} />
          </Field>
          <Field label="Internal Notes" icon={FileText}>
            <Textarea value={draft.internalNotes} onChange={(event) => updateField("internalNotes", event.target.value)} />
          </Field>
          <Field label="Security Notes"><Textarea value={draft.securityNotes || ""} onChange={(event) => updateField("securityNotes", event.target.value)} /></Field>
          <Field label="Protocol Notes"><Textarea value={draft.protocolNotes || ""} onChange={(event) => updateField("protocolNotes", event.target.value)} /></Field>
          <Field label="Dress Code"><Input value={draft.dressCode || ""} onChange={(event) => updateField("dressCode", event.target.value)} /></Field>
          <Field label="Documents"><Textarea value={draft.documentsToCarry || ""} onChange={(event) => updateField("documentsToCarry", event.target.value)} /></Field>
          <Field label="Materials / Gifts"><Textarea value={draft.materialsOrGifts || ""} onChange={(event) => updateField("materialsOrGifts", event.target.value)} /></Field>
          <Field label="Special Instructions"><Textarea value={draft.specialInstructions || ""} onChange={(event) => updateField("specialInstructions", event.target.value)} /></Field>
        </div>
        </DisclosureSection>
        </div>
      </SectionCard>

      <SectionCard title="Selected Day Movements" subtitle="Edit, duplicate, or delete saved movements for the selected day">
        {!draft.scheduleDayId ? (
          <EmptyState title="No day selected" description="Select or create a programme day before adding movements." />
        ) : selectedDayMovements.length === 0 ? (
          <EmptyState title="No movements saved" description="Add a movement above to begin this schedule day." />
        ) : (
          <>
          <div className="space-y-3">
            {selectedDayMovements.map((movement, index) => (
              <MovementCard key={movement.id} movement={movement} index={index} count={selectedDayMovements.length} drivers={drivers} vehicles={vehicles} issues={integrity?.conflictsByMovementId?.[movement.id] || []} editing={editingMovementId === movement.id || draft.id === movement.id} showInlineEditor={editingMovementId === movement.id} onQuickEdit={startInlineEdit} onFullEdit={onEditMovement} onDuplicate={onDuplicateMovement} onMove={onMoveMovement} onDelete={onDeleteMovement}>
                <div className="space-y-4">
                  <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                    <Field label="Engagement Details" error={inlineErrors.engagementDetails}><Input value={inlineDraft?.engagementDetails || ""} onChange={(event) => updateInlineField("engagementDetails", event.target.value)} /></Field>
                    <Field label="Driver"><Select value={inlineDraft?.driverId || ""} onChange={(event) => updateInlineDriver(event.target.value)}>{drivers.map((driver) => <option key={driver.id} value={driver.id}>{driver.name}</option>)}</Select></Field>
                    <Field label="Vehicle"><Select value={inlineDraft?.vehicleId || ""} onChange={(event) => updateInlineField("vehicleId", event.target.value)}>{vehicles.map((vehicle) => <option key={vehicle.id} value={vehicle.id}>{vehicle.name}</option>)}</Select></Field>
                  </div>
                  <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
                    {[["driverStart", "Driver Start"], ["departureTime", "Departure"], ["arrivalTime", "Arrival"], ["eventStartTime", "Event Start"], ["eventEndTime", "Event End"], ["endTime", "Duty End"]].map(([field, label]) => <Field key={field} label={label}><Input type="time" value={inlineDraft?.[field] || ""} onChange={(event) => updateInlineField(field, event.target.value)} /></Field>)}
                  </div>
                  <div className="flex flex-wrap justify-end gap-2"><Button onClick={cancelInlineEdit}>Cancel</Button><Button variant="primary" onClick={saveInlineEdit}>Save quick edit</Button></div>
                </div>
              </MovementCard>
            ))}
          </div>
          <div className="hidden" aria-hidden="true">
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
                            <div className="mt-1 flex flex-wrap gap-1" aria-label={getAudienceSummary(movement)}>{getAudienceBadges(movement).map((badge) => <Badge key={badge}>{badge}</Badge>)}</div>
                            <div className="mt-1 flex flex-wrap gap-1" aria-label="Schedule integrity indicators">
                              {movementIssues.some((issue) => issue.severity === "error") ? <Badge tone="danger">Conflict</Badge> : null}
                              {movementIssues.some((issue) => issue.severity === "warning") ? <Badge tone="warning">Warning</Badge> : null}
                              {movement.continuesOvernight ? <Badge tone="info">Overnight</Badge> : null}
                              {(movement.conflictOverrides || []).length ? <Badge tone="accent">Override</Badge> : null}
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
          </>
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

        {!draft.scheduleDayId ? (
          <EmptyState title="No day selected" description="Select a programme day to manage vehicle handovers." />
        ) : selectedDayHandoverNotes.length === 0 ? (
          <EmptyState title="No vehicle handovers" description="Handover and key-location notes for this day will appear here." />
        ) : (
          <>
          <div className="space-y-3">
            {selectedDayHandoverNotes.map((note, index) => <HandoverCard key={note.id} note={note} index={index} count={selectedDayHandoverNotes.length} drivers={drivers} vehicles={vehicles} issues={integrity?.conflictsByHandoverId?.[note.id] || []} onEdit={editHandover} onMove={onMoveVehicleHandoverNote} onDuplicate={onDuplicateVehicleHandoverNote} onDelete={onDeleteVehicleHandoverNote} />)}
          </div>
          </>
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
          <EmptyState title="No important information" description="Routes, contacts, addresses, and notes will appear here." />
        ) : (
          <>
          <div className="space-y-3">
            {sortedImportantInfoItems.map((item, index) => <ImportantInfoCard key={item.id} item={item} index={index} count={sortedImportantInfoItems.length} onEdit={editImportantInfoItem} onMove={onMoveImportantInfoItem} onDuplicate={onDuplicateImportantInfoItem} onDelete={onDeleteImportantInfoItem} />)}
          </div>
          </>
        )}
      </SectionCard>
    </div>
  );
}
