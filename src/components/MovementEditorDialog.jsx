import { ChevronDown, Plus } from "lucide-react";
import { useState } from "react";
import { createDraftFromMovement } from "../data/schema";
import {
  AUDIENCE_PRESETS,
  applyAudiencePreset,
  getAudienceWarnings,
  normalizeMovementAudiences,
} from "../domain/audiences";
import {
  addPickup,
  deletePickup,
  movePickup,
  sortPickups,
  updatePickup,
} from "../domain/pickups";
import {
  movementFromEditorDraft,
  updateMovementEditorDriver,
  validateMovementEditorDraft,
} from "../domain/movementEditor";
import { Button } from "./ui/Button";
import { Input, Select, Textarea } from "./ui/FormControls";
import ModalShell from "./ui/ModalShell";

function Field({ label, error, children }) {
  return <label className="ts-label"><span className="ts-label-text">{label}</span>{children}{error ? <span className="ts-field-error">{error}</span> : null}</label>;
}

function Section({ title, children }) {
  return <section className="rounded-2xl border border-[var(--ts-border)] bg-white p-4"><h3 className="mb-4 text-sm font-bold text-[var(--ts-text)]">{title}</h3>{children}</section>;
}

function AudienceEditor({ movement, drivers, vehicles, onChange }) {
  const audiences = normalizeMovementAudiences(movement, drivers.map((driver) => driver.id));
  const warnings = getAudienceWarnings({ ...movement, audiences });
  const update = (next) => onChange({
    ...next,
    driverIds: next.driverIds.filter((id) => id !== movement.driverId),
  });

  return <fieldset className="ts-fieldset">
    <legend className="px-2 text-sm font-semibold">Audience</legend>
    <div className="mb-3 flex flex-wrap gap-2">
      {Object.entries(AUDIENCE_PRESETS).map(([id, preset]) => <Button key={id} onClick={() => update(applyAudiencePreset(audiences, id))} className="min-h-0 px-2 py-1 text-xs">{preset.label}</Button>)}
    </div>
    <div className="grid gap-2 sm:grid-cols-2">
      {[["executive", "Full Executive Programme"], ["operational", "Operational Programme"], ["cg", "CG Programme"], ["marida", "Marida Programme"]].map(([key, label]) => <label key={key} className="flex min-h-10 items-center gap-2 text-sm"><input type="checkbox" checked={audiences[key]} onChange={(event) => update({ ...audiences, [key]: event.target.checked })} />{label}</label>)}
    </div>
    <div className="mt-4">
      <p className="text-sm font-semibold">Additional Driver Programmes</p>
      <p className="text-xs text-[var(--ts-text-muted)]">The assigned driver is included automatically when Operational Programme is enabled.</p>
      <div className="mt-2 grid gap-2 sm:grid-cols-2">
        {drivers.filter((driver) => driver.id !== movement.driverId && (driver.isActive !== false || audiences.driverIds.includes(driver.id))).map((driver) => {
          const vehicle = vehicles.find((item) => item.id === driver.defaultVehicle);
          return <label key={driver.id} className="flex min-h-10 items-center gap-2 text-sm"><input type="checkbox" checked={audiences.driverIds.includes(driver.id)} onChange={(event) => update({ ...audiences, driverIds: event.target.checked ? [...audiences.driverIds, driver.id] : audiences.driverIds.filter((id) => id !== driver.id) })} />{driver.name}{vehicle ? ` / ${vehicle.name}` : ""}</label>;
        })}
      </div>
    </div>
    {warnings.length ? <ul className="mt-3 list-disc pl-5 text-xs font-medium text-amber-700">{warnings.map((warning) => <li key={warning}>{warning}</li>)}</ul> : null}
  </fieldset>;
}

function PickupEditor({ movement, issues, onChange }) {
  const pickups = sortPickups(movement.pickups || []);
  const pickupIssues = issues.filter((issue) => issue.pickupId || String(issue.field || "").startsWith("pickups"));
  const [open, setOpen] = useState(pickups.length > 0);
  const expanded = open || pickupIssues.length > 0;
  const replace = (next) => onChange({ ...movement, pickups: next });
  const update = (id, changes) => replace(updatePickup(pickups, id, changes));
  const add = () => { setOpen(true); replace(addPickup(pickups)); };

  return <section className="rounded-2xl border border-[var(--ts-border)] bg-[var(--ts-surface-muted)]">
    <button type="button" aria-expanded={expanded} onClick={() => setOpen((value) => !value)} className="flex min-h-12 w-full items-center justify-between gap-3 rounded-2xl px-4 py-3 text-left">
      <span><strong className="block text-sm">Pre-departure pickups</strong><span className="text-xs text-[var(--ts-text-muted)]">{pickups.length ? `${pickups.length} pickup${pickups.length === 1 ? "" : "s"}` : "No pickups"}</span></span>
      <ChevronDown className={`h-4 w-4 ${expanded ? "rotate-180" : ""}`} aria-hidden="true" />
    </button>
    {expanded ? <div className="space-y-3 border-t border-[var(--ts-border)] p-4">
      {pickupIssues.filter((issue) => !issue.pickupId).map((issue, index) => <p key={`${issue.type}-${index}`} className="ts-field-error">{issue.message}</p>)}
      {pickups.map((pickup, index) => <article key={pickup.id} className="rounded-xl border border-[var(--ts-border)] bg-white p-3">
        <div className="mb-3 flex flex-wrap items-center justify-between gap-2"><strong>Pickup {index + 1}</strong><div className="flex flex-wrap gap-1"><Button onClick={() => replace(movePickup(pickups, pickup.id, "up"))} disabled={index === 0}>Move up</Button><Button onClick={() => replace(movePickup(pickups, pickup.id, "down"))} disabled={index === pickups.length - 1}>Move down</Button><Button variant="danger" onClick={() => replace(deletePickup(pickups, pickup.id))}>Remove</Button></div></div>
        <div className="grid gap-3 sm:grid-cols-3"><Field label="Pickup time"><Input type="time" value={pickup.time} onChange={(event) => update(pickup.id, { time: event.target.value })} /></Field><Field label="Location"><Input value={pickup.location} onChange={(event) => update(pickup.id, { location: event.target.value })} /></Field><Field label="Person / group"><Input value={pickup.person} onChange={(event) => update(pickup.id, { person: event.target.value })} /></Field></div>
        <details className="mt-3"><summary className="cursor-pointer text-sm font-semibold">More pickup details</summary><div className="mt-3 grid gap-3 sm:grid-cols-2"><Field label="Address"><Input value={pickup.address} onChange={(event) => update(pickup.id, { address: event.target.value })} /></Field><Field label="Contact phone"><Input type="tel" value={pickup.contactPhone} onChange={(event) => update(pickup.id, { contactPhone: event.target.value })} /></Field><div className="sm:col-span-2"><Field label="Notes"><Textarea value={pickup.notes} onChange={(event) => update(pickup.id, { notes: event.target.value })} /></Field></div></div></details>
        {pickupIssues.filter((issue) => issue.pickupId === pickup.id).map((issue, issueIndex) => <p key={`${issue.type}-${issueIndex}`} className="mt-2 ts-field-error">{issue.message}</p>)}
      </article>)}
      <Button onClick={add}><Plus className="h-4 w-4" /> Add Pickup</Button>
    </div> : null}
  </section>;
}

function ConflictIssues({ issues, movement, onChange }) {
  const [reasons, setReasons] = useState({});
  const visible = issues.filter((issue) => !issue.pickupId && !String(issue.field || "").startsWith("pickups"));
  if (!visible.length) return null;
  function acknowledge(issue) {
    const reason = (reasons[issue.conflictKey] || "").trim();
    if (reason.length < 10 || !window.confirm("Acknowledge this overlap override with the supplied reason?")) return;
    const existing = (movement.conflictOverrides || []).filter((item) => item.conflictKey !== issue.conflictKey);
    onChange({ ...movement, conflictOverrides: [...existing, { conflictKey: issue.conflictKey, reason, acknowledgedAt: new Date().toISOString() }] });
  }
  return <div className="ts-alert ts-alert--danger" role="alert"><strong>Review movement conflicts</strong><ul className="mt-2 space-y-3">{visible.map((issue, index) => {
    const eligible = ["DRIVER_OVERLAP", "VEHICLE_OVERLAP"].includes(issue.type) && issue.severity === "error";
    return <li key={`${issue.type}-${issue.conflictKey || index}`}><p>{issue.field ? `${issue.field}: ` : ""}{issue.message}</p>{eligible ? <div className="mt-2 grid gap-2 sm:grid-cols-[1fr_auto]"><Input aria-label="Override reason" value={reasons[issue.conflictKey] || ""} onChange={(event) => setReasons((current) => ({ ...current, [issue.conflictKey]: event.target.value }))} placeholder="Override reason (minimum 10 characters)" /><Button variant="danger" onClick={() => acknowledge(issue)}>Acknowledge override</Button></div> : null}</li>;
  })}</ul></div>;
}

export default function MovementEditorDialog({ movement, day, profile, scheduleDays, drivers, vehicles, onSave, onClose }) {
  const [draft, setDraft] = useState(() => createDraftFromMovement(movement, day, profile));
  const [errors, setErrors] = useState({});
  const issues = errors.integrityIssues || [];
  const updateField = (name, value) => setDraft((current) => ({ ...current, [name]: value }));
  const updateAudiences = (audiences) => setDraft((current) => ({ ...current, audiences, isExecutiveVisible: audiences.executive, isOperationalVisible: audiences.operational }));

  function submit(event) {
    event.preventDefault();
    const nextErrors = validateMovementEditorDraft(draft);
    setErrors(nextErrors);
    if (Object.keys(nextErrors).length) return;
    const result = onSave(movementFromEditorDraft(draft));
    if (result?.ok === false) { setErrors({ integrityIssues: result.issues }); return; }
    onClose();
  }

  return <ModalShell title="Edit movement" subtitle={day?.date ? `${day.date}${day.title ? ` - ${day.title}` : ""}` : "Update the existing schedule movement"} onClose={onClose} maxWidth="max-w-5xl" bodyClassName="p-0">
    <form onSubmit={submit} className="space-y-4 p-4 md:p-6">
      <Section title="Assignment"><div className="grid gap-3 sm:grid-cols-3">
        <Field label="Schedule day" error={errors.scheduleDayId}><Select value={draft.scheduleDayId || ""} invalid={Boolean(errors.scheduleDayId)} onChange={(event) => updateField("scheduleDayId", event.target.value)}>{scheduleDays.map((item) => <option key={item.id} value={item.id}>{item.date}{item.title ? ` - ${item.title}` : ""}</option>)}</Select></Field>
        <Field label="Driver" error={errors.driverId}><Select value={draft.driverId || ""} invalid={Boolean(errors.driverId)} onChange={(event) => setDraft((current) => updateMovementEditorDriver(current, event.target.value, drivers))}><option value="">Select driver</option>{drivers.filter((item) => item.isActive !== false || item.id === draft.driverId).map((item) => <option key={item.id} value={item.id}>{item.name}{item.isActive === false ? " - Inactive" : ""}</option>)}</Select></Field>
        <Field label="Vehicle" error={errors.vehicleId}><Select value={draft.vehicleId || ""} invalid={Boolean(errors.vehicleId)} onChange={(event) => updateField("vehicleId", event.target.value)}><option value="">Select vehicle</option>{vehicles.filter((item) => item.isActive !== false || item.id === draft.vehicleId).map((item) => <option key={item.id} value={item.id}>{item.name}{item.isActive === false ? " - Inactive" : ""}</option>)}</Select></Field>
      </div></Section>
      <Section title="Timing"><div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">{[["driverStart", "Driver Start"], ["departureTime", "Official Departure"], ["arrivalTime", "Arrival"], ["eventStartTime", "Event Start"], ["eventEndTime", "Event End"], ["endTime", "Duty End"]].map(([name, label]) => <Field key={name} label={label}><Input type="time" value={draft[name]} onChange={(event) => updateField(name, event.target.value)} /></Field>)}</div>{errors.timing ? <p className="mt-2 ts-field-error">{errors.timing}</p> : null}<div className="mt-4"><PickupEditor movement={draft} issues={issues} onChange={setDraft} /></div><label className="mt-4 flex min-h-11 items-center gap-2 text-sm font-medium"><input type="checkbox" checked={draft.continuesOvernight} onChange={(event) => updateField("continuesOvernight", event.target.checked)} />Continues past midnight</label></Section>
      <Section title="Engagement / Location"><div className="grid gap-3 sm:grid-cols-2"><Field label="Engagement Details" error={errors.engagementDetails}><Input value={draft.engagementDetails} invalid={Boolean(errors.engagementDetails)} onChange={(event) => updateField("engagementDetails", event.target.value)} /></Field><Field label="Venue"><Input value={draft.venue} onChange={(event) => updateField("venue", event.target.value)} /></Field><Field label="Address"><Input value={draft.address} onChange={(event) => updateField("address", event.target.value)} /></Field><Field label="Parking"><Input value={draft.parking} onChange={(event) => updateField("parking", event.target.value)} /></Field><Field label="Location Notes"><Textarea value={draft.locationNotes} onChange={(event) => updateField("locationNotes", event.target.value)} /></Field><Field label="Participants"><Textarea value={draft.participants} onChange={(event) => updateField("participants", event.target.value)} /></Field></div><details className="mt-4"><summary className="cursor-pointer text-sm font-semibold">Additional operational details</summary><div className="mt-3 grid gap-3 sm:grid-cols-2">{[["contactPerson", "Contact person"], ["contactPhone", "Contact phone"], ["securityNotes", "Security notes"], ["protocolNotes", "Protocol notes"], ["dressCode", "Dress code"], ["documentsToCarry", "Documents to carry"], ["materialsOrGifts", "Materials / gifts"], ["specialInstructions", "Special instructions"], ["internalNotes", "Internal notes"]].map(([name, label]) => <Field key={name} label={label}><Textarea value={draft[name] || ""} onChange={(event) => updateField(name, event.target.value)} /></Field>)}</div></details></Section>
      <Section title="Audience / Classification"><AudienceEditor movement={draft} drivers={drivers} vehicles={vehicles} onChange={updateAudiences} /><div className="mt-4 max-w-sm"><Field label="Working-time classification"><Select value={draft.workClassification || "active"} onChange={(event) => updateField("workClassification", event.target.value)}><option value="active">Active duty</option><option value="travel">Travel / driving</option><option value="standby">Standby</option><option value="break">Break</option><option value="nonWorking">Do not count</option></Select></Field></div><div className="mt-4"><ConflictIssues issues={issues} movement={draft} onChange={setDraft} /></div></Section>
      <div className="sticky bottom-0 -mx-4 -mb-4 flex flex-wrap justify-end gap-2 border-t border-[var(--ts-border)] bg-white/95 p-4 backdrop-blur md:-mx-6 md:-mb-6"><Button onClick={onClose}>Cancel</Button><Button type="submit" variant="primary">Save movement</Button></div>
    </form>
  </ModalShell>;
}
