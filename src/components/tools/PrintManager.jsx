import { ArrowLeft, Printer, RotateCcw } from "lucide-react";
import { useMemo, useState } from "react";
import { PRINT_PRESETS, PRINT_VIEWS, applyPrintPreset, createDefaultPrintConfig, hasDriverGrouping, validatePrintConfig } from "../../print/printConfig";
import { createPrintDocument } from "../../print/printDocument";
import { chronologicalDays, movementCountForPrintDay, validatePrintSelection } from "../../print/printSelection";
import AlertBanner from "../ui/AlertBanner";
import { Button } from "../ui/Button";

const scopeOptions = [
  ["all", "All programme days"], ["current", "Current day"], ["selected", "Selected days"],
  ["range", "Date range"], ["preview", "Current preview results"],
];
const layoutOptions = [
  ["separate", "One day per page", "Start each programme day on a new page."],
  ["continuous", "Continuous", "Allow several programme days to flow onto the same page."],
  ["smart", "Smart grouping", "Keep each day together where possible, while allowing several short days on one page."],
  ["compact", "Compact itinerary", "Use a condensed multi-day layout with only essential programme details."],
];
const includeLabels = {
  missionHeader: "Mission header", documentTitle: "Document title", dayTitle: "Day title", date: "Date",
  driver: "Driver", vehicle: "Vehicle", pickups: "Pickups", pickupAddresses: "Pickup addresses",
  pickupContacts: "Pickup contacts", pickupNotes: "Pickup notes", venue: "Venue", address: "Address",
  participants: "Participants", parking: "Parking", locationNotes: "Location notes", handovers: "Vehicle handovers",
  importantInformation: "Important Information", pageNumbers: "Page numbers",
};

function RadioGroup({ legend, name, value, options, onChange }) {
  return <fieldset className="space-y-2"><legend className="font-semibold text-neutral-900">{legend}</legend>{options.map(([id, label, description]) => <label key={id} className="flex cursor-pointer items-start gap-2 rounded-lg border border-neutral-200 p-3"><input type="radio" name={name} value={id} checked={value === id} onChange={() => onChange(id)} className="mt-1" /><span><span className="block text-sm font-medium">{label}</span>{description ? <span className="block text-xs text-neutral-500">{description}</span> : null}</span></label>)}</fieldset>;
}

export default function PrintManager({ schedule, initialView = "executive", currentDayId = "", selectedDriverId = "", previewDayIds = [], onPrintDocument, onClose }) {
  const context = useMemo(() => ({ currentDayId, driverId: selectedDriverId, previewDayIds }), [currentDayId, selectedDriverId, previewDayIds]);
  const [config, setConfig] = useState(() => createDefaultPrintConfig(initialView, context));
  const [stage, setStage] = useState("settings");
  const [document, setDocument] = useState(null);
  const [message, setMessage] = useState("");
  const [customized, setCustomized] = useState(false);
  const days = useMemo(() => chronologicalDays(schedule), [schedule]);
  const referencedDriverIds = useMemo(() => new Set(schedule.movements.map((movement) => movement.driverId)), [schedule.movements]);
  const drivers = schedule.drivers.filter((driver) => driver.isActive || referencedDriverIds.has(driver.id));
  const configValidation = validatePrintConfig(config);
  const selectionValidation = configValidation.ok ? validatePrintSelection(schedule, config, context) : { ok: false, message: Object.values(configValidation.errors)[0] };
  const update = (change) => { setCustomized(true); setConfig((current) => ({ ...current, ...change })); };
  const updateInclude = (key, checked) => { setCustomized(true); setConfig((current) => ({ ...current, include: { ...current.include, [key]: checked } })); };

  function changeView(view) {
    if (customized && !window.confirm("Change programme and restore its view-specific print defaults?")) return;
    setConfig(createDefaultPrintConfig(view, context));
    setCustomized(false);
    setMessage("");
  }
  function changeLayout(layout) {
    if (layout !== "compact") { update({ layout }); return; }
    setCustomized(true);
    setConfig((current) => ({ ...current, layout, include: { ...current.include, pickupAddresses: false, pickupContacts: false, pickupNotes: false, address: false, locationNotes: false, parking: false, participants: false, handovers: false } }));
  }
  function preview() {
    const next = createPrintDocument(schedule, config, context);
    if (!next.ok) { setMessage(next.error); return; }
    setDocument(next);
    setStage("preview");
    setMessage("");
  }
  function reset() {
    setConfig(createDefaultPrintConfig(config.view, context));
    setCustomized(false);
    setMessage("Print settings restored to this programme's defaults.");
  }
  function print() {
    if (!document?.ok) return;
    if (!onPrintDocument(document.fullHtml)) setMessage("Could not open the print window. Check your browser popup settings.");
  }

  if (stage === "preview" && document) return <section aria-labelledby="print-preview-title" className="min-w-0">
    <div className="mb-4 flex flex-wrap items-start justify-between gap-3"><div><h2 id="print-preview-title" className="text-xl font-bold">Print layout preview</h2><p className="text-sm text-neutral-600">{PRINT_VIEWS.find((view) => view.id === config.view)?.label} · {document.selectedDayCount} {document.selectedDayCount === 1 ? "day" : "days"} · {layoutOptions.find((item) => item[0] === config.layout)?.[1]} · {config.density} · {config.orientation}</p></div><Button variant="ghost" onClick={() => setStage("settings")}><ArrowLeft className="h-4 w-4" /> Back to Print Settings</Button></div>
    {message ? <AlertBanner tone="warning" className="mb-3">{message}</AlertBanner> : null}
    <div className="print-manager-preview overflow-auto rounded-xl border border-neutral-300 bg-neutral-100 p-2 sm:p-4"><iframe title={`Print preview: ${document.title}`} srcDoc={document.fullHtml} className="mx-auto h-[65vh] min-w-[760px] w-full border-0 bg-white shadow" /></div>
    <div className="mt-4 flex flex-wrap justify-end gap-2"><Button variant="secondary" onClick={() => setStage("settings")}>Back to Print Settings</Button><Button onClick={print}><Printer className="h-4 w-4" /> Print / Save PDF</Button><Button variant="ghost" onClick={onClose}>Close</Button></div>
  </section>;

  const showMovementOptions = !["importantInfo"].includes(config.view);
  const showAssignmentOptions = !["importantInfo", "workingTime"].includes(config.view);
  const applicableIncludes = Object.keys(includeLabels).filter((key) => {
    if (["driver", "vehicle"].includes(key)) return showAssignmentOptions;
    if (["pickups", "pickupAddresses", "pickupContacts", "pickupNotes", "venue", "address", "participants", "parking", "locationNotes"].includes(key)) return showMovementOptions;
    if (key === "handovers") return hasDriverGrouping(config.view);
    if (key === "importantInformation") return config.view !== "importantInfo";
    return true;
  });

  return <section aria-labelledby="print-manager-title" className="min-w-0">
    <div className="mb-4"><h2 id="print-manager-title" className="text-xl font-bold">Print Manager</h2><p className="text-sm text-neutral-600">Configure programme scope, page layout, density, and printed details.</p></div>
    {message ? <AlertBanner tone="info" className="mb-4">{message}</AlertBanner> : null}
    <div className="mb-5"><p className="mb-2 text-sm font-semibold">Quick presets</p><div className="flex flex-wrap gap-2">{Object.entries(PRINT_PRESETS).map(([id, preset]) => <Button key={id} variant="secondary" onClick={() => { setCustomized(true); setConfig((current) => applyPrintPreset(current, id)); }}>{preset.label}</Button>)}</div></div>
    <div className="grid min-w-0 gap-5 lg:grid-cols-2">
      <fieldset className="ts-card p-4"><legend className="px-1 font-semibold">1. Programme</legend><label className="mt-2 block text-sm" htmlFor="print-programme">Programme view</label><select id="print-programme" value={config.view} onChange={(event) => changeView(event.target.value)} className="mt-1 w-full rounded-lg border border-neutral-300 p-2">{PRINT_VIEWS.map((view) => <option key={view.id} value={view.id}>{view.label}</option>)}</select>{config.view === "driver" ? <><label className="mt-3 block text-sm" htmlFor="print-driver">Driver</label><select id="print-driver" value={config.driverId} onChange={(event) => update({ driverId: event.target.value })} aria-describedby={configValidation.errors.driverId ? "print-driver-error" : undefined} className="mt-1 w-full rounded-lg border border-neutral-300 p-2"><option value="">Select a driver</option>{drivers.map((driver) => <option key={driver.id} value={driver.id}>{driver.name}{driver.isActive ? "" : " (inactive)"}</option>)}</select>{configValidation.errors.driverId ? <p id="print-driver-error" className="mt-1 text-sm text-red-700">{configValidation.errors.driverId}</p> : null}</> : null}</fieldset>
      <fieldset className="ts-card p-4"><legend className="px-1 font-semibold">2. Days to print</legend><div className="mt-2 space-y-2">{scopeOptions.filter(([id]) => id !== "preview" || previewDayIds.length > 0).map(([id, label]) => <label key={id} className="flex items-center gap-2 text-sm"><input type="radio" name="print-scope" checked={config.scope === id} onChange={() => update({ scope: id })} /> {label}</label>)}</div>
        {config.scope === "selected" ? <div className="mt-3"><div className="mb-2 flex gap-2"><Button variant="secondary" onClick={() => update({ selectedDayIds: days.map((day) => day.id) })}>Select all</Button><Button variant="ghost" onClick={() => update({ selectedDayIds: [] })}>Clear selection</Button></div><div className="max-h-56 space-y-1 overflow-y-auto rounded-lg border border-neutral-200 p-2" aria-describedby={!selectionValidation.ok ? "print-scope-error" : undefined}>{days.map((day) => <label key={day.id} className="flex items-start gap-2 p-1 text-sm"><input type="checkbox" checked={config.selectedDayIds.includes(day.id)} onChange={(event) => update({ selectedDayIds: event.target.checked ? [...config.selectedDayIds, day.id] : config.selectedDayIds.filter((id) => id !== day.id) })} /><span>{day.date ? new Date(`${day.date}T12:00:00`).toLocaleDateString(undefined, { weekday: "short" }) : "Day"} · {day.date || "No date"} · {day.title || "Untitled"} · {movementCountForPrintDay(schedule, config, day.id)} movements</span></label>)}</div></div> : null}
        {config.scope === "range" ? <div className="mt-3 grid gap-2 sm:grid-cols-2"><label className="text-sm">Start date<input type="date" value={config.rangeStart} onChange={(event) => update({ rangeStart: event.target.value })} aria-describedby={!selectionValidation.ok ? "print-scope-error" : undefined} className="mt-1 block w-full rounded-lg border border-neutral-300 p-2" /></label><label className="text-sm">End date<input type="date" value={config.rangeEnd} onChange={(event) => update({ rangeEnd: event.target.value })} aria-describedby={!selectionValidation.ok ? "print-scope-error" : undefined} className="mt-1 block w-full rounded-lg border border-neutral-300 p-2" /></label></div> : null}
        {!selectionValidation.ok ? <p id="print-scope-error" role="alert" className="mt-2 text-sm text-red-700">{selectionValidation.message}</p> : null}
      </fieldset>
      <div className="ts-card p-4"><RadioGroup legend="3. Page layout" name="print-layout" value={config.layout} options={layoutOptions} onChange={changeLayout} /></div>
      <div className="ts-card p-4"><h3 className="font-semibold">4. Density and orientation</h3><div className="mt-2 grid gap-4 sm:grid-cols-2"><RadioGroup legend="Density" name="print-density" value={config.density} options={[["spacious", "Spacious"], ["standard", "Standard"], ["compact", "Compact"]]} onChange={(density) => update({ density })} /><RadioGroup legend="Orientation" name="print-orientation" value={config.orientation} options={[["portrait", "Portrait"], ["landscape", "Landscape"]]} onChange={(orientation) => update({ orientation })} /></div></div>
      {hasDriverGrouping(config.view) ? <div className="ts-card p-4"><RadioGroup legend="5. Driver page grouping" name="driver-grouping" value={config.driverGrouping} options={[["continuous", "Continuous"], ["driver", "Start each driver on a new page"], ["driverDay", "Start each driver/day combination on a new page"]]} onChange={(driverGrouping) => update({ driverGrouping })} /></div> : null}
      <details className="ts-card p-4" open><summary className="cursor-pointer font-semibold">{hasDriverGrouping(config.view) ? "6" : "5"}. Included details</summary><fieldset className="mt-3 grid gap-2 sm:grid-cols-2"><legend className="sr-only">Included details</legend>{applicableIncludes.map((key) => <label key={key} className="flex items-center gap-2 text-sm"><input type="checkbox" checked={config.include[key]} disabled={key === "pageNumbers" || (key.startsWith("pickup") && key !== "pickups" && !config.include.pickups)} onChange={(event) => updateInclude(key, event.target.checked)} /> {includeLabels[key]}{key === "pageNumbers" ? " (unavailable in browser print)" : ""}</label>)}</fieldset></details>
    </div>
    <fieldset className="mt-5 ts-card p-4"><legend className="px-1 font-semibold">Page-break behavior</legend><div className="mt-2 grid gap-2 sm:grid-cols-3"><label className="flex gap-2 text-sm"><input type="checkbox" checked={config.keepMovementTogether} onChange={(event) => update({ keepMovementTogether: event.target.checked })} /> Keep movements together</label><label className="flex gap-2 text-sm"><input type="checkbox" checked={config.keepDayHeadingWithFirstMovement} onChange={(event) => update({ keepDayHeadingWithFirstMovement: event.target.checked })} /> Keep day heading with first movement</label><label className="flex gap-2 text-sm"><input type="checkbox" checked={config.repeatTableHeaders} onChange={(event) => update({ repeatTableHeaders: event.target.checked })} /> Repeat table headers</label></div></fieldset>
    <div className="mt-5 flex flex-wrap justify-end gap-2"><Button onClick={preview} disabled={!selectionValidation.ok}><Printer className="h-4 w-4" /> Preview Print Layout</Button><Button variant="secondary" onClick={reset}><RotateCcw className="h-4 w-4" /> Reset to Defaults</Button><Button variant="ghost" onClick={onClose}>Close</Button></div>
  </section>;
}
