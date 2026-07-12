import { ArrowLeft, Car, FileText } from "lucide-react";
import { useReducer, useState } from "react";
import ScheduleBuilder from "../ScheduleBuilder";
import Badge from "../ui/Badge";
import { Button } from "../ui/Button";
import ModalShell from "../ui/ModalShell";
import { canLeaveTools, initialToolsNavigation, toolsNavigationReducer } from "./toolsNavigation";

function ToolOption({ icon, title, description, count, status, onOpen }) {
  const ToolIcon = icon;
  return <article className="ts-card p-4"><div className="flex items-start gap-3"><div className="rounded-xl bg-[var(--ts-surface-muted)] p-3"><ToolIcon className="h-5 w-5" aria-hidden="true" /></div><div className="min-w-0 flex-1"><h3 className="ts-card-title">{title}</h3><p className="mt-1 text-sm text-[var(--ts-text-muted)]">{description}</p><div className="mt-3 flex flex-wrap items-center gap-2"><Badge>{count}</Badge>{status ? <Badge tone="danger">{status}</Badge> : null}<Button variant="secondary" className="ml-auto" onClick={onOpen} aria-label={`Open ${title}`}>Open</Button></div></div></div></article>;
}

export default function ToolsWorkspace({ onClose, builderProps, importantInfoCount, handoverCount, handoverConflictCount }) {
  const [{ activeTool }, navigate] = useReducer(toolsNavigationReducer, initialToolsNavigation);
  const [dirty, setDirty] = useState(false);
  const title = activeTool === "importantInfo" ? "Important Information" : activeTool === "handover" ? "Vehicle Handover" : "Tools";
  function mayLeave() { return canLeaveTools(dirty, (message) => window.confirm(message)); }
  function close() { if (mayLeave()) onClose(); }
  function back() { if (mayLeave()) { setDirty(false); navigate({ type: "back" }); } }

  return <ModalShell title={title} subtitle={activeTool ? "Tools workspace" : "Secondary programme utilities"} onClose={close} maxWidth="max-w-5xl">
    {activeTool ? <><div className="mb-4"><Button variant="ghost" onClick={back} aria-label="Back to Tools"><ArrowLeft className="h-4 w-4" /> Back to Tools</Button></div><ScheduleBuilder {...builderProps} mode={activeTool} onToolDirtyChange={setDirty} /></> : <div className="grid gap-3 md:grid-cols-2"><ToolOption icon={FileText} title="Important Information" description="Manage routes, contacts, addresses, and programme notes." count={`${importantInfoCount} ${importantInfoCount === 1 ? "record" : "records"}`} onOpen={() => navigate({ type: "open", tool: "importantInfo" })} /><ToolOption icon={Car} title="Vehicle Handover" description="Manage vehicle transfers, keys, instructions, and driver visibility." count={`${handoverCount} ${handoverCount === 1 ? "handover" : "handovers"}`} status={handoverConflictCount ? `${handoverConflictCount} unresolved ${handoverConflictCount === 1 ? "conflict" : "conflicts"}` : ""} onOpen={() => navigate({ type: "open", tool: "handover" })} /></div>}
  </ModalShell>;
}
