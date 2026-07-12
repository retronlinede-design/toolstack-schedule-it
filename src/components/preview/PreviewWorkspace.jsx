import { Clipboard, Printer } from "lucide-react";
import { useRef, useState } from "react";
import Badge from "../ui/Badge";
import { Button } from "../ui/Button";
import ModalShell from "../ui/ModalShell";

function dateRange(days) {
  const dates = days.map((day) => day.date).filter(Boolean).sort();
  if (!dates.length) return "No programme dates";
  return dates[0] === dates.at(-1) ? dates[0] : `${dates[0]} – ${dates.at(-1)}`;
}

function nextTabIndex(index, key, length) {
  return (index + (key === "ArrowRight" ? 1 : -1) + length) % length;
}

export default function PreviewWorkspace({ tabs, selectedView, onViewChange, scheduleDays, integrity, selectedDriverName, documentTitle, srcDoc, frameRef, onPrint, onCopy, onReviewIssues, onClose }) {
  const tabRefs = useRef([]);
  const [message, setMessage] = useState("");
  const [pendingAction, setPendingAction] = useState(null);
  const integrityErrors = integrity.errors || [];
  const integrityWarnings = integrity.warnings || [];
  function keyDown(event, index) {
    if (!["ArrowLeft", "ArrowRight"].includes(event.key)) return;
    event.preventDefault();
    const next = nextTabIndex(index, event.key, tabs.length);
    onViewChange(tabs[next].id);
    tabRefs.current[next]?.focus();
  }
  async function runCopy() { setMessage(await onCopy(selectedView)); }
  function requestAction(action) { if (integrityErrors.length) setPendingAction(action); else if (action === "print") onPrint(); else runCopy(); }
  function continueAction() { const action = pendingAction; setPendingAction(null); if (action === "print") onPrint(); else runCopy(); }
  const selected = tabs.find((tab) => tab.id === selectedView);
  return <ModalShell title="Document Preview" subtitle={`${selected?.label || documentTitle} · ${dateRange(scheduleDays)}`} onClose={onClose}>
    <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
      <div className="flex flex-wrap gap-2"><Badge tone={integrityErrors.length ? "danger" : "success"}>{integrityErrors.length ? `${integrityErrors.length} blocking issues` : "Integrity checked"}</Badge>{selectedView === "driver" && selectedDriverName ? <Badge tone="info">Driver: {selectedDriverName}</Badge> : null}</div>
      <div className="flex flex-wrap gap-2"><Button onClick={() => requestAction("copy")}><Clipboard className="h-4 w-4" /> Copy programme</Button><Button onClick={() => requestAction("print")} variant="primary"><Printer className="h-4 w-4" /> Print / Save PDF</Button></div>
    </div>
    {integrityErrors.length || integrityWarnings.length ? <div className={`ts-alert mb-4 ${integrityErrors.length ? "ts-alert--danger" : "ts-alert--warning"}`}><strong>Schedule contains unresolved integrity issues.</strong><p>Review the schedule before using this as an official programme.</p><div className="mt-2 flex flex-wrap items-center gap-2"><Badge tone="danger">{integrityErrors.length} errors</Badge><Badge tone="warning">{integrityWarnings.length} warnings</Badge>{onReviewIssues ? <Button variant="secondary" onClick={onReviewIssues}>Review Schedule Issues</Button> : null}</div></div> : null}
    {pendingAction ? <div className="ts-alert ts-alert--warning mb-4" role="alertdialog" aria-label="Confirm output with unresolved integrity issues"><strong>This schedule contains unresolved integrity issues.</strong><p className="mt-1">You can continue, but the output may contain timing, driver, vehicle, or handover conflicts.</p><div className="mt-3 flex flex-wrap gap-2"><Button variant="primary" onClick={continueAction}>Continue</Button><Button onClick={() => setPendingAction(null)}>Cancel</Button><Button variant="secondary" onClick={() => { setPendingAction(null); onReviewIssues(); }}>Review Issues</Button></div></div> : null}
    {message ? <div className="ts-alert ts-alert--info mb-4">{message}</div> : null}
    <div role="tablist" aria-label="Programme preview views" className="-mx-1 mb-4 overflow-x-auto px-1 pb-2"><div className="flex min-w-max gap-2">{tabs.map((tab, index) => <Button key={tab.id} ref={(node) => { tabRefs.current[index] = node; }} role="tab" id={`preview-tab-${tab.id}`} aria-selected={selectedView === tab.id} aria-controls={`preview-panel-${tab.id}`} tabIndex={selectedView === tab.id ? 0 : -1} variant={selectedView === tab.id ? "primary" : "secondary"} className="min-h-10 whitespace-nowrap" onClick={() => onViewChange(tab.id)} onKeyDown={(event) => keyDown(event, index)}>{tab.label}</Button>)}</div></div>
    <section role="tabpanel" id={`preview-panel-${selectedView}`} aria-labelledby={`preview-tab-${selectedView}`} className="rounded-[14px] border border-[var(--ts-border)] bg-[var(--ts-bg-soft)] p-2 sm:p-4">
      <iframe ref={frameRef} title={`${documentTitle} — ${selected?.label || "Programme"} preview`} srcDoc={srcDoc} className="h-[68vh] w-full rounded-[10px] border border-[var(--ts-border)] bg-white" />
    </section>
  </ModalShell>;
}
