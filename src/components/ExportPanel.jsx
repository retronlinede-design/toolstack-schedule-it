import { Clipboard, Code, FileJson, FileUp, Printer, X } from "lucide-react";
import { useRef, useState } from "react";
import HtmlImportPanel from "./HtmlImportPanel";

const printActions = [
  ["executive", "Print Full Executive Programme"],
  ["executiveCg", "Print CG Programme"],
  ["executiveMarida", "Print Marida Programme"],
  ["operational", "Print Operational View"],
  ["workingTime", "Print Working Time Summary"],
  ["importantInfo", "Print Important Info"],
];

const copyActions = [
  ["executive", "Copy Full Executive HTML"],
  ["executiveCg", "Copy CG Programme HTML"],
  ["executiveMarida", "Copy Marida Programme HTML"],
  ["operational", "Copy Operational HTML"],
  ["workingTime", "Copy Working Time HTML"],
  ["importantInfo", "Copy Important Info HTML"],
];

function PanelButton({ icon, label, description, onClick, disabled = false }) {
  const Icon = icon;

  return (
    <button
      onClick={onClick}
      disabled={disabled}
      className="flex items-center gap-4 w-full p-4 rounded-2xl border border-neutral-100 hover:border-neutral-200 hover:bg-neutral-50 transition text-left disabled:cursor-not-allowed disabled:opacity-50"
    >
      <div className="p-3 bg-neutral-50 rounded-xl text-neutral-700">
        <Icon className="h-5 w-5" />
      </div>
      <div>
        <p className="font-semibold text-neutral-900">{label}</p>
        {description ? <p className="text-xs text-neutral-500">{description}</p> : null}
      </div>
    </button>
  );
}

export default function ExportPanel({ selectedDriverName, hasDrivers, onClose, onPrintView, onCopyHtml, onExportJson, onImportJson, onReplaceJson, onApplyHtmlImport }) {
  const inputRef = useRef(null);
  const [message, setMessage] = useState("");
  const [isHtmlImportOpen, setIsHtmlImportOpen] = useState(false);
  const [jsonPreparation, setJsonPreparation] = useState(null);

  async function handleCopy(view) {
    const result = await onCopyHtml(view);
    setMessage(result);
  }

  async function handleImport(event) {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (!file) return;

    const result = await onImportJson(file);
    setJsonPreparation(result);
    setMessage(result.ok ? "Backup validated. Review replacement consequences below." : `${result.code}: ${result.message}`);
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-2 sm:p-4 no-print">
      <div className="max-h-full min-w-0 w-full max-w-full overflow-y-auto rounded-3xl bg-white p-4 shadow-2xl sm:max-w-3xl sm:p-6">
        {isHtmlImportOpen ? (
          <HtmlImportPanel onBack={() => setIsHtmlImportOpen(false)} onApply={onApplyHtmlImport} />
        ) : (
          <>
        <div className="mb-6 flex items-center justify-between">
          <h2 className="text-xl font-semibold text-neutral-900">Export Schedule</h2>
          <button onClick={onClose} className="text-neutral-400 hover:text-neutral-600 transition">
            <X className="h-5 w-5" />
          </button>
        </div>

        {message ? <div className="mb-4 rounded-2xl bg-neutral-50 px-4 py-3 text-sm text-neutral-700">{message}</div> : null}

        {jsonPreparation?.ok ? (
          <div className="mb-5 rounded-2xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-950">
            <h3 className="font-bold">Replacement preview — {jsonPreparation.preview.backupType}</h3>
            <p className="mt-1">Schema {jsonPreparation.preview.schemaVersion}{jsonPreparation.preview.exportedAt ? ` · Exported ${jsonPreparation.preview.exportedAt}` : ""}</p>
            {jsonPreparation.preview.migrationRequired ? <p className="mt-2 font-semibold">Legacy backup: migration/normalization is required before storage.</p> : null}
            <div className="mt-3 overflow-x-auto">
              <table className="w-full min-w-[520px] text-left text-xs"><thead><tr><th>Records</th><th>Current</th><th>Imported</th></tr></thead><tbody>
                {Object.keys(jsonPreparation.preview.current).map((key) => <tr key={key}><td className="py-1">{key}</td><td>{jsonPreparation.preview.current[key]}</td><td>{jsonPreparation.preview.imported[key]}</td></tr>)}
              </tbody></table>
            </div>
            {jsonPreparation.preview.warnings.length ? <ul className="mt-3 list-disc pl-5">{jsonPreparation.preview.warnings.map((warning) => <li key={warning}>{warning}</li>)}</ul> : null}
            <p className="mt-3 font-semibold">All current schedule data will be replaced.</p>
            <button onClick={async () => setMessage(await onReplaceJson(jsonPreparation))} className="mt-3 rounded-xl bg-red-700 px-4 py-2 font-semibold text-white">Replace Current Schedule</button>
          </div>
        ) : null}

        <div className="grid gap-5 lg:grid-cols-2">
          <div>
            <h3 className="mb-2 text-xs font-black uppercase tracking-widest text-neutral-400">Print</h3>
            <div className="grid gap-3">
              {printActions.map(([view, label]) => (
                <PanelButton key={view} icon={Printer} label={label} description="Non-restorable report output for print/PDF." onClick={() => onPrintView(view)} />
              ))}
              <PanelButton
                icon={Printer}
                label={hasDrivers ? `Print Driver View: ${selectedDriverName}` : "Print Driver View"}
                description={hasDrivers ? "Non-restorable selected-driver report." : "No drivers available."}
                onClick={() => onPrintView("driver")}
                disabled={!hasDrivers}
              />
            </div>
          </div>

          <div>
            <h3 className="mb-2 text-xs font-black uppercase tracking-widest text-neutral-400">Copy HTML</h3>
            <div className="grid gap-3">
              {copyActions.map(([view, label]) => (
                <PanelButton key={view} icon={Clipboard} label={label} description="Copy non-restorable report HTML." onClick={() => handleCopy(view)} />
              ))}
              <PanelButton
                icon={Clipboard}
                label={hasDrivers ? `Copy Driver HTML: ${selectedDriverName}` : "Copy Driver HTML"}
                description={hasDrivers ? "Copy selected driver HTML." : "No drivers available."}
                onClick={() => handleCopy("driver")}
                disabled={!hasDrivers}
              />
            </div>
          </div>
        </div>

        <div className="mt-5 grid gap-3 lg:grid-cols-2">
          <PanelButton icon={FileJson} label="Full Backup — restorable" description="Download a metadata-labelled Schedule-It backup." onClick={onExportJson} />
          <PanelButton icon={FileUp} label="Select Full Backup" description="Validate and preview a restorable Schedule-It backup." onClick={() => inputRef.current?.click()} />
          <PanelButton icon={Code} label="Import from HTML" description="Paste schedule HTML and preview parsed rows." onClick={() => setIsHtmlImportOpen(true)} />
        </div>

        <input ref={inputRef} type="file" accept="application/json,.json" onChange={handleImport} className="hidden" />
          </>
        )}
      </div>
    </div>
  );
}
