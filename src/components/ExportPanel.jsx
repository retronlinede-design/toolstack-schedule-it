import { Clipboard, Code, FileJson, FileUp, Printer } from "lucide-react";
import { useRef, useState } from "react";
import HtmlImportPanel from "./HtmlImportPanel";
import ModalShell from "./ui/ModalShell";
import AlertBanner from "./ui/AlertBanner";
import { Button } from "./ui/Button";

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
      className="ts-card ts-card--interactive flex min-h-11 w-full items-center gap-4 p-4 text-left disabled:cursor-not-allowed disabled:opacity-50"
    >
      <div className="p-3 bg-neutral-50 rounded-xl text-neutral-700">
        <Icon className="h-5 w-5" />
      </div>
      <div className="min-w-0">
        <p className="font-semibold text-neutral-900">{label}</p>
        {description ? <p className="text-xs text-neutral-500">{description}</p> : null}
      </div>
    </button>
  );
}

export default function ExportPanel({ selectedDriverName, hasDrivers, hasBlockingIssues = false, onClose, onPrintView, onCopyHtml, onExportJson, onImportJson, onReplaceJson, onApplyHtmlImport }) {
  const inputRef = useRef(null);
  const [message, setMessage] = useState("");
  const [isHtmlImportOpen, setIsHtmlImportOpen] = useState(false);
  const [jsonPreparation, setJsonPreparation] = useState(null);
  const [selectedFileName, setSelectedFileName] = useState("");

  async function handleCopy(view) {
    const result = await onCopyHtml(view);
    setMessage(result);
  }

  async function handleImport(event) {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (!file) return;
    setSelectedFileName(file.name);

    const result = await onImportJson(file);
    setJsonPreparation(result);
    setMessage(result.ok ? "Backup validated. Review replacement consequences below." : `${result.code}: ${result.message}`);
  }

  return (
    <ModalShell title="Export Schedule" subtitle="Print reports, create backups, or restore validated data" onClose={onClose} maxWidth="max-w-3xl">
        {isHtmlImportOpen ? (
          <HtmlImportPanel onBack={() => setIsHtmlImportOpen(false)} onApply={onApplyHtmlImport} />
        ) : (
          <>
        {message ? <AlertBanner tone="info" className="mb-4">{message}</AlertBanner> : null}
        {hasBlockingIssues ? <AlertBanner tone="danger" className="mb-4"><strong>Official output is disabled.</strong> Review Schedule Issues in the builder.</AlertBanner> : null}

        {jsonPreparation?.ok ? (
          <div className="mb-5 rounded-2xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-950">
            <h3 className="font-bold">Replacement preview — {jsonPreparation.preview.backupType}</h3>
            <p className="mt-1 break-all">Selected file: {selectedFileName}</p>
            <p className="mt-1">Schema {jsonPreparation.preview.schemaVersion}{jsonPreparation.preview.exportedAt ? ` · Exported ${jsonPreparation.preview.exportedAt}` : ""}</p>
            {jsonPreparation.preview.migrationRequired ? <p className="mt-2 font-semibold">Legacy backup: migration/normalization is required before storage.</p> : null}
            <div className="mt-3 overflow-x-auto">
              <table className="w-full min-w-[520px] text-left text-xs"><thead><tr><th>Records</th><th>Current</th><th>Imported</th></tr></thead><tbody>
                {Object.keys(jsonPreparation.preview.current).map((key) => <tr key={key}><td className="py-1">{key}</td><td>{jsonPreparation.preview.current[key]}</td><td>{jsonPreparation.preview.imported[key]}</td></tr>)}
              </tbody></table>
            </div>
            {jsonPreparation.preview.warnings.length ? <ul className="mt-3 list-disc pl-5">{jsonPreparation.preview.warnings.map((warning) => <li key={warning}>{warning}</li>)}</ul> : null}
            <p className="mt-3 font-semibold">All current schedule data will be replaced.</p>
            <Button onClick={async () => setMessage(await onReplaceJson(jsonPreparation))} variant="danger-strong" className="mt-3">Replace Current Schedule</Button>
          </div>
        ) : null}

        <section aria-labelledby="official-outputs-title">
          <h3 id="official-outputs-title" className="ts-card-title mb-1">Official programme outputs</h3>
          <p className="mb-3 text-sm text-[var(--ts-text-muted)]">Print / Save PDF or copy a non-restorable programme document.</p>
        <div className="grid gap-5 lg:grid-cols-2">
          <div>
            <h4 className="mb-2 text-sm font-semibold text-neutral-700">Print / Save PDF</h4>
            <div className="grid gap-3">
              {printActions.map(([view, label]) => (
                <PanelButton key={view} icon={Printer} label={label} description="Non-restorable report output for print/PDF." onClick={() => onPrintView(view)} disabled={hasBlockingIssues} />
              ))}
              <PanelButton
                icon={Printer}
                label={hasDrivers ? `Print Driver View: ${selectedDriverName}` : "Print Driver View"}
                description={hasDrivers ? "Non-restorable selected-driver report." : "No drivers available."}
                onClick={() => onPrintView("driver")}
                disabled={!hasDrivers || hasBlockingIssues}
              />
            </div>
          </div>

          <div>
            <h4 className="mb-2 text-sm font-semibold text-neutral-700">Copy programme · Not restorable</h4>
            <div className="grid gap-3">
              {copyActions.map(([view, label]) => (
                <PanelButton key={view} icon={Clipboard} label={label} description="Copy non-restorable report HTML." onClick={() => handleCopy(view)} disabled={hasBlockingIssues} />
              ))}
              <PanelButton
                icon={Clipboard}
                label={hasDrivers ? `Copy Driver HTML: ${selectedDriverName}` : "Copy Driver HTML"}
                description={hasDrivers ? "Copy selected driver HTML." : "No drivers available."}
                onClick={() => handleCopy("driver")}
                disabled={!hasDrivers || hasBlockingIssues}
              />
            </div>
          </div>
        </div>
        </section>

        <section className="mt-6" aria-labelledby="restorable-title"><h3 id="restorable-title" className="ts-card-title mb-1">Restorable data</h3><p className="mb-3 text-sm text-[var(--ts-text-muted)]">Verified full backups preserve the complete Schedule-It state.</p><div className="grid gap-3 lg:grid-cols-2">
          <PanelButton icon={FileJson} label="Full Backup — restorable" description="Download a metadata-labelled Schedule-It backup." onClick={onExportJson} />
          <PanelButton icon={FileUp} label="Import Full Backup" description="Validate, preview, snapshot, then replace the current schedule." onClick={() => inputRef.current?.click()} />
        </div></section>
        <section className="mt-6" aria-labelledby="lossy-title"><h3 id="lossy-title" className="ts-card-title mb-1">Non-restorable imports and reports</h3><p className="mb-3 text-sm text-[var(--ts-text-muted)]">HTML is a lossy import format, not a backup.</p><PanelButton icon={Code} label="HTML import · Lossy import" description="Paste schedule HTML and preview parsed rows before append or replacement." onClick={() => setIsHtmlImportOpen(true)} /></section>

        <input ref={inputRef} type="file" accept="application/json,.json" onChange={handleImport} className="hidden" />
          </>
        )}
    </ModalShell>
  );
}
