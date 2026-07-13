import { ArrowLeft, Printer, RotateCcw } from "lucide-react";
import { useMemo, useState } from "react";
import { PRINT_PRESETS, PRINT_VIEWS, applyPrintPreset, createDefaultPrintConfig, validatePrintConfig } from "../../print/printConfig";
import { createPrintDocument } from "../../print/printDocument";
import { chronologicalDays, movementCountForPrintDay, validatePrintSelection } from "../../print/printSelection";
import AlertBanner from "../ui/AlertBanner";
import { Button } from "../ui/Button";

const scopeOptions = [["all", "All days"], ["current", "Current day"], ["selected", "Selected days"]];
const layoutOptions = [
  ["separate", "One day per page", "Start each programme day on a new page."],
  ["continuous", "Continuous", "Allow programme days to flow without forced page breaks."],
  ["smart", "Smart grouping", "Keep short days together where the browser can do so cleanly."],
];
const detailOptions = [
  ["pickups", "Include pickups"],
  ["addresses", "Include addresses"],
  ["participants", "Include participants"],
  ["parkingNotes", "Include parking and notes"],
  ["handovers", "Include handovers"],
];

function RadioGroup({ legend, name, value, options, onChange, compact = false }) {
  return <fieldset><legend className="font-semibold text-neutral-900">{legend}</legend><div className={compact ? "mt-2 flex flex-wrap gap-3" : "mt-2 space-y-2"}>{options.map(([id, label, description]) => <label key={id} className={compact ? "flex items-center gap-2 text-sm" : "flex cursor-pointer items-start gap-2 rounded-lg border border-neutral-200 p-3"}><input type="radio" name={name} value={id} checked={value === id} onChange={() => onChange(id)} className={compact ? "" : "mt-1"} /><span><span className="block text-sm font-medium">{label}</span>{description ? <span className="block text-xs text-neutral-500">{description}</span> : null}</span></label>)}</div></fieldset>;
}

export default function PrintManager({ schedule, initialView = "executive", currentDayId = "", selectedDriverId = "", onPrintDocument, onClose }) {
  const initialContext = useMemo(() => ({ currentDayId, driverId: selectedDriverId }), [currentDayId, selectedDriverId]);
  const [config, setConfig] = useState(() => createDefaultPrintConfig(initialView, initialContext));
  const [stage, setStage] = useState("settings");
  const [document, setDocument] = useState(null);
  const [message, setMessage] = useState("");
  const days = useMemo(() => chronologicalDays(schedule), [schedule]);
  const referencedDriverIds = useMemo(() => new Set(schedule.movements.map((movement) => movement.driverId)), [schedule.movements]);
  const drivers = schedule.drivers.filter((driver) => driver.isActive || referencedDriverIds.has(driver.id));
  const configValidation = validatePrintConfig(config);
  const selectionValidation = configValidation.ok ? validatePrintSelection(schedule, config) : { ok: false, message: Object.values(configValidation.errors)[0] };
  const update = (change) => setConfig((current) => ({ ...current, ...change }));
  const updateInclude = (key, checked) => setConfig((current) => ({ ...current, include: { ...current.include, [key]: checked } }));

  function changeView(view) {
    update({ view, driverId: view === "driver" ? config.driverId || selectedDriverId : "" });
    setMessage("");
  }
  function preview() {
    const next = createPrintDocument(schedule, config);
    if (!next.ok) { setMessage(next.error); return; }
    setDocument(next);
    setStage("preview");
    setMessage("");
  }
  function reset() {
    setConfig(createDefaultPrintConfig(config.view, initialContext));
    setMessage("Print settings restored to the standard defaults.");
  }
  function print() {
    if (document?.ok && !onPrintDocument(document.fullHtml)) setMessage("Could not open the print window. Check your browser popup settings.");
  }

  if (stage === "preview" && document) {
    const landscape = config.orientation === "landscape";
    return <section aria-labelledby="print-preview-title" className="min-w-0">
      <div className="mb-4 flex flex-wrap items-start justify-between gap-3"><div><h2 id="print-preview-title" className="text-xl font-bold">Print layout preview</h2><p className="text-sm text-neutral-600">{PRINT_VIEWS.find((view) => view.id === config.view)?.label} · {document.selectedDayCount} {document.selectedDayCount === 1 ? "day" : "days"} · {layoutOptions.find((item) => item[0] === config.layout)?.[1]} · {config.density} · {config.orientation}</p></div><Button variant="ghost" onClick={() => setStage("settings")}><ArrowLeft className="h-4 w-4" /> Back to Print Settings</Button></div>
      {message ? <AlertBanner tone="warning" className="mb-3">{message}</AlertBanner> : null}
      <div className="print-manager-preview max-w-full overflow-auto rounded-xl border border-neutral-300 bg-neutral-100 p-2 sm:p-4"><iframe title={`Print preview: ${document.title}`} srcDoc={document.fullHtml} className="mx-auto block max-w-none border-0 bg-white shadow" style={{ width: landscape ? "297mm" : "210mm", height: landscape ? "210mm" : "297mm" }} /></div>
      <div className="mt-4 flex flex-wrap justify-end gap-2"><Button variant="secondary" onClick={() => setStage("settings")}>Back to Print Settings</Button><Button onClick={print}><Printer className="h-4 w-4" /> Print / Save PDF</Button><Button variant="ghost" onClick={onClose}>Close</Button></div>
    </section>;
  }

  const showMovementDetails = config.view !== "importantInfo";
  const visibleDetails = detailOptions.filter(([key]) => key !== "handovers" || config.view === "operational" || config.view === "driver");
  return <section aria-labelledby="print-manager-title" className="min-w-0">
    <div className="mb-4"><h2 id="print-manager-title" className="text-xl font-bold">Print Manager</h2><p className="text-sm text-neutral-600">Choose a programme, its days, and how days should flow across pages.</p></div>
    {message ? <AlertBanner tone="info" className="mb-4">{message}</AlertBanner> : null}
    <div className="mb-5 flex flex-wrap items-center gap-2"><span className="mr-1 text-sm font-semibold">Presets</span>{Object.entries(PRINT_PRESETS).map(([id, preset]) => <Button key={id} variant="secondary" onClick={() => setConfig((current) => applyPrintPreset(current, id))}>{preset.label}</Button>)}</div>
    <div className="grid min-w-0 gap-5 lg:grid-cols-2">
      <fieldset className="ts-card p-4"><legend className="px-1 font-semibold">Programme</legend><label className="mt-2 block text-sm" htmlFor="print-programme">Programme view</label><select id="print-programme" value={config.view} onChange={(event) => changeView(event.target.value)} className="mt-1 w-full rounded-lg border border-neutral-300 p-2">{PRINT_VIEWS.map((view) => <option key={view.id} value={view.id}>{view.label}</option>)}</select>{config.view === "driver" ? <><label className="mt-3 block text-sm" htmlFor="print-driver">Driver</label><select id="print-driver" value={config.driverId} onChange={(event) => update({ driverId: event.target.value })} aria-describedby={configValidation.errors.driverId ? "print-driver-error" : undefined} className="mt-1 w-full rounded-lg border border-neutral-300 p-2"><option value="">Select a driver</option>{drivers.map((driver) => <option key={driver.id} value={driver.id}>{driver.name}{driver.isActive ? "" : " (inactive)"}</option>)}</select>{configValidation.errors.driverId ? <p id="print-driver-error" className="mt-1 text-sm text-red-700">{configValidation.errors.driverId}</p> : null}</> : null}</fieldset>
      <fieldset className="ts-card p-4"><legend className="px-1 font-semibold">Days</legend><div className="mt-2 space-y-2">{scopeOptions.map(([id, label]) => <label key={id} className="flex items-center gap-2 text-sm"><input type="radio" name="print-scope" checked={config.scope === id} onChange={() => update({ scope: id })} /> {label}</label>)}</div>{config.scope === "selected" ? <div className="mt-3"><div className="mb-2 flex gap-2"><Button variant="secondary" onClick={() => update({ selectedDayIds: days.map((day) => day.id) })}>Select all</Button><Button variant="ghost" onClick={() => update({ selectedDayIds: [] })}>Clear selection</Button></div><div className="max-h-56 space-y-1 overflow-y-auto rounded-lg border border-neutral-200 p-2" aria-describedby={!selectionValidation.ok ? "print-scope-error" : undefined}>{days.map((day) => <label key={day.id} className="flex items-start gap-2 p-1 text-sm"><input type="checkbox" checked={config.selectedDayIds.includes(day.id)} onChange={(event) => update({ selectedDayIds: event.target.checked ? [...config.selectedDayIds, day.id] : config.selectedDayIds.filter((id) => id !== day.id) })} /><span>{day.date ? new Date(`${day.date}T12:00:00`).toLocaleDateString(undefined, { weekday: "short" }) : "Day"} · {day.date || "No date"} · {day.title || "Untitled"} · {movementCountForPrintDay(schedule, config, day.id)} movements</span></label>)}</div></div> : null}{!selectionValidation.ok ? <p id="print-scope-error" role="alert" className="mt-2 text-sm text-red-700">{selectionValidation.message}</p> : null}</fieldset>
      <div className="ts-card p-4"><RadioGroup legend="Day layout" name="print-layout" value={config.layout} options={layoutOptions} onChange={(layout) => update({ layout })} /></div>
      <div className="ts-card p-4"><div className="grid gap-5 sm:grid-cols-2"><RadioGroup legend="Density" name="print-density" value={config.density} options={[["standard", "Standard"], ["compact", "Compact"]]} onChange={(density) => update({ density })} compact /><RadioGroup legend="Orientation" name="print-orientation" value={config.orientation} options={[["portrait", "Portrait"], ["landscape", "Landscape"]]} onChange={(orientation) => update({ orientation })} compact /></div></div>
    </div>
    {showMovementDetails ? <details className="mt-5 ts-card p-4"><summary className="cursor-pointer font-semibold">Printed details</summary><fieldset className="mt-3 grid gap-2 sm:grid-cols-2"><legend className="sr-only">Printed details</legend>{visibleDetails.map(([key, label]) => <label key={key} className="flex items-center gap-2 text-sm"><input type="checkbox" checked={config.include[key]} onChange={(event) => updateInclude(key, event.target.checked)} /> {label}</label>)}</fieldset></details> : null}
    <div className="mt-5 flex flex-wrap justify-end gap-2"><Button onClick={preview} disabled={!selectionValidation.ok}><Printer className="h-4 w-4" /> Preview Print Layout</Button><Button variant="secondary" onClick={reset}><RotateCcw className="h-4 w-4" /> Reset</Button><Button variant="ghost" onClick={onClose}>Close</Button></div>
  </section>;
}
