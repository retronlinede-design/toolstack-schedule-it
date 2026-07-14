import { ArrowLeft, Printer } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import ProgrammeDocument from "../preview/ProgrammeDocument";
import { createProgrammeDocumentModel } from "../preview/programmeDocumentModel";
import { PRINT_VIEWS, createDefaultPrintConfig, validatePrintConfig } from "../../print/printConfig";
import { chronologicalDays, createPrintSchedule, movementCountForPrintDay, selectPrintDays, validatePrintSelection } from "../../print/printSelection";
import AlertBanner from "../ui/AlertBanner";
import { Button } from "../ui/Button";

const scopeOptions = [["all", "All days"], ["current", "Current day"], ["selected", "Selected days"]];
const layoutOptions = [["separate", "One day per page"], ["continuous", "Continuous"]];

function RadioGroup({ legend, name, value, options, onChange }) {
  return <fieldset><legend className="font-semibold text-neutral-900">{legend}</legend><div className="mt-2 flex flex-wrap gap-3">{options.map(([id, label]) => <label key={id} className="flex items-center gap-2 text-sm"><input type="radio" name={name} value={id} checked={value === id} onChange={() => onChange(id)} /> {label}</label>)}</div></fieldset>;
}

export default function PrintManager({ schedule, initialView = "executive", currentDayId = "", selectedDriverId = "", onClose }) {
  const initialContext = useMemo(() => ({ currentDayId, driverId: selectedDriverId }), [currentDayId, selectedDriverId]);
  const [config, setConfig] = useState(() => createDefaultPrintConfig(initialView, initialContext));
  const [stage, setStage] = useState("settings");
  const [previewDocument, setPreviewDocument] = useState(null);
  const [message, setMessage] = useState("");
  const days = useMemo(() => chronologicalDays(schedule), [schedule]);
  const referencedDriverIds = useMemo(() => new Set(schedule.movements.map((movement) => movement.driverId)), [schedule.movements]);
  const drivers = schedule.drivers.filter((driver) => driver.isActive || referencedDriverIds.has(driver.id));
  const configValidation = validatePrintConfig(config);
  const selectionValidation = configValidation.ok ? validatePrintSelection(schedule, config) : { ok: false, message: Object.values(configValidation.errors)[0] };
  const update = (change) => setConfig((current) => ({ ...current, ...change }));

  useEffect(() => {
    if (stage !== "preview") return undefined;
    globalThis.document.body.classList.add("print-manager-active");
    return () => globalThis.document.body.classList.remove("print-manager-active");
  }, [stage]);

  function preview() {
    const selectedDays = selectPrintDays(schedule, config);
    const printSchedule = createPrintSchedule(schedule, config);
    setPreviewDocument({ model: createProgrammeDocumentModel(printSchedule, config.view, { selectedDriverId: config.driverId }), selectedDayCount: config.view === "importantInfo" ? 0 : selectedDays.length });
    setStage("preview");
    setMessage("");
  }

  if (stage === "preview" && previewDocument) return <section aria-labelledby="print-preview-title" className="min-w-0">
    <div className="print-manager-chrome mb-4 flex flex-wrap items-start justify-between gap-3"><div><h2 id="print-preview-title" className="text-xl font-bold">Print preview</h2><p className="text-sm text-neutral-600">{previewDocument.model.label} · {previewDocument.selectedDayCount} {previewDocument.selectedDayCount === 1 ? "day" : "days"} · {layoutOptions.find((item) => item[0] === config.layout)?.[1]} · {config.density}</p></div><Button variant="ghost" onClick={() => setStage("settings")}><ArrowLeft className="h-4 w-4" /> Back</Button></div>
    {message ? <AlertBanner tone="warning" className="print-manager-chrome mb-3">{message}</AlertBanner> : null}
    <div className={`programme-print-preview programme-print-document print-layout-${config.layout} print-density-${config.density} rounded-xl border border-neutral-200 bg-white p-4 md:p-5`}>
      <ProgrammeDocument model={previewDocument.model} showControls={false} />
    </div>
    <div className="print-manager-chrome mt-4 flex flex-wrap justify-end gap-2"><Button variant="secondary" onClick={() => setStage("settings")}>Back</Button><Button onClick={() => window.print()}><Printer className="h-4 w-4" /> Print / Save PDF</Button><Button variant="ghost" onClick={onClose}>Close</Button></div>
  </section>;

  return <section aria-labelledby="print-manager-title" className="min-w-0">
    <div className="mb-4"><h2 id="print-manager-title" className="text-xl font-bold">Print Manager</h2><p className="text-sm text-neutral-600">Select the programme, days, and page flow.</p></div>
    {message ? <AlertBanner tone="info" className="mb-4">{message}</AlertBanner> : null}
    <div className="grid min-w-0 gap-5 lg:grid-cols-2">
      <fieldset className="ts-card p-4"><legend className="px-1 font-semibold">Programme</legend><label className="mt-2 block text-sm" htmlFor="print-programme">Programme view</label><select id="print-programme" value={config.view} onChange={(event) => update({ view: event.target.value, driverId: event.target.value === "driver" ? config.driverId || selectedDriverId : "" })} className="mt-1 w-full rounded-lg border border-neutral-300 p-2">{PRINT_VIEWS.map((view) => <option key={view.id} value={view.id}>{view.label}</option>)}</select>{config.view === "driver" ? <><label className="mt-3 block text-sm" htmlFor="print-driver">Driver</label><select id="print-driver" value={config.driverId} onChange={(event) => update({ driverId: event.target.value })} aria-describedby={configValidation.errors.driverId ? "print-driver-error" : undefined} className="mt-1 w-full rounded-lg border border-neutral-300 p-2"><option value="">Select a driver</option>{drivers.map((driver) => <option key={driver.id} value={driver.id}>{driver.name}{driver.isActive ? "" : " (inactive)"}</option>)}</select>{configValidation.errors.driverId ? <p id="print-driver-error" className="mt-1 text-sm text-red-700">{configValidation.errors.driverId}</p> : null}</> : null}</fieldset>
      <fieldset className="ts-card p-4"><legend className="px-1 font-semibold">Days</legend><div className="mt-2 space-y-2">{scopeOptions.map(([id, label]) => <label key={id} className="flex items-center gap-2 text-sm"><input type="radio" name="print-scope" checked={config.scope === id} onChange={() => update({ scope: id })} /> {label}</label>)}</div>{config.scope === "selected" ? <div className="mt-3"><div className="mb-2 flex gap-2"><Button variant="secondary" onClick={() => update({ selectedDayIds: days.map((day) => day.id) })}>Select all</Button><Button variant="ghost" onClick={() => update({ selectedDayIds: [] })}>Clear selection</Button></div><div className="max-h-56 space-y-1 overflow-y-auto rounded-lg border border-neutral-200 p-2" aria-describedby={!selectionValidation.ok ? "print-scope-error" : undefined}>{days.map((day) => <label key={day.id} className="flex items-start gap-2 p-1 text-sm"><input type="checkbox" checked={config.selectedDayIds.includes(day.id)} onChange={(event) => update({ selectedDayIds: event.target.checked ? [...config.selectedDayIds, day.id] : config.selectedDayIds.filter((id) => id !== day.id) })} /><span>{day.date || "No date"} · {day.title || "Untitled"} · {movementCountForPrintDay(schedule, config, day.id)} movements</span></label>)}</div></div> : null}{!selectionValidation.ok ? <p id="print-scope-error" role="alert" className="mt-2 text-sm text-red-700">{selectionValidation.message}</p> : null}</fieldset>
      <div className="ts-card p-4"><RadioGroup legend="Page layout" name="print-layout" value={config.layout} options={layoutOptions} onChange={(layout) => update({ layout })} /></div>
      <div className="ts-card p-4"><RadioGroup legend="Density" name="print-density" value={config.density} options={[["standard", "Standard"], ["compact", "Compact"]]} onChange={(density) => update({ density })} /></div>
    </div>
    <div className="mt-5 flex flex-wrap justify-end gap-2"><Button onClick={preview} disabled={!selectionValidation.ok}><Printer className="h-4 w-4" /> Preview</Button><Button variant="ghost" onClick={onClose}>Close</Button></div>
  </section>;
}
