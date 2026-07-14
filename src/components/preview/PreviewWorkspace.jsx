import { Clipboard, Printer } from "lucide-react";
import { useRef, useState } from "react";
import { Button } from "../ui/Button";
import ModalShell from "../ui/ModalShell";
import ProgrammeDocument from "./ProgrammeDocument";

function dateRange(days) {
  const dates = days.map((day) => day.date).filter(Boolean).sort();
  if (!dates.length) return "No programme dates";
  return dates[0] === dates.at(-1) ? dates[0] : `${dates[0]} – ${dates.at(-1)}`;
}

function nextTabIndex(index, key, length) {
  return (index + (key === "ArrowRight" ? 1 : -1) + length) % length;
}

export default function PreviewWorkspace({ tabs, selectedView, onViewChange, scheduleDays, selectedDriverName, documentTitle, documentModel, onPrint, onCopy, onClose }) {
  const tabRefs = useRef([]);
  const [message, setMessage] = useState("");
  function keyDown(event, index) {
    if (!["ArrowLeft", "ArrowRight"].includes(event.key)) return;
    event.preventDefault();
    const next = nextTabIndex(index, event.key, tabs.length);
    onViewChange(tabs[next].id);
    tabRefs.current[next]?.focus();
  }
  async function runCopy() { setMessage(await onCopy(selectedView)); }
  const selected = tabs.find((tab) => tab.id === selectedView);
  return <ModalShell title="Document Preview" subtitle={`${selected?.label || documentTitle} · ${dateRange(scheduleDays)}`} onClose={onClose}>
    <div className="mb-4 flex flex-wrap items-center justify-between gap-3"><div className="text-sm text-[var(--ts-text-muted)]">{selectedView === "driver" && selectedDriverName ? `Driver: ${selectedDriverName}` : selected?.label}</div><div className="flex flex-wrap gap-2"><Button onClick={runCopy}><Clipboard className="h-4 w-4" /> Copy programme</Button><Button onClick={onPrint} variant="primary"><Printer className="h-4 w-4" /> Print / Save PDF</Button></div></div>
    {message ? <div className="ts-alert ts-alert--info mb-4">{message}</div> : null}
    <div role="tablist" aria-label="Programme preview views" className="-mx-1 mb-4 overflow-x-auto px-1 pb-2"><div className="flex min-w-max gap-2">{tabs.map((tab, index) => <Button key={tab.id} ref={(node) => { tabRefs.current[index] = node; }} role="tab" id={`preview-tab-${tab.id}`} aria-selected={selectedView === tab.id} aria-controls={`preview-panel-${tab.id}`} tabIndex={selectedView === tab.id ? 0 : -1} variant={selectedView === tab.id ? "primary" : "secondary"} className="min-h-10 whitespace-nowrap" onClick={() => onViewChange(tab.id)} onKeyDown={(event) => keyDown(event, index)}>{tab.label}</Button>)}</div></div>
    <section role="tabpanel" id={`preview-panel-${selectedView}`} aria-labelledby={`preview-tab-${selectedView}`} aria-label={`${documentTitle} — ${selected?.label || "Programme"} preview`} className="max-h-[68vh] overflow-auto rounded-[14px] border border-[var(--ts-border)] bg-white p-4 md:p-5">
      <ProgrammeDocument model={documentModel} showControls={false} />
    </section>
  </ModalShell>;
}
