import { ArrowLeft, Car, FileText, Users } from "lucide-react";
import { useReducer, useState } from "react";
import ScheduleBuilder from "../ScheduleBuilder";
import Badge from "../ui/Badge";
import { Button } from "../ui/Button";
import ModalShell from "../ui/ModalShell";
import DriverManager from "./DriverManager";
import VehicleManager from "./VehicleManager";
import { canLeaveTools, initialToolsNavigation, toolsNavigationReducer } from "./toolsNavigation";

function ToolOption({ icon, title, description, count, status, onOpen }) {
  const ToolIcon = icon;
  return <article className="ts-card p-4"><div className="flex items-start gap-3"><div className="rounded-xl bg-[var(--ts-surface-muted)] p-3"><ToolIcon className="h-5 w-5" aria-hidden="true" /></div><div className="min-w-0 flex-1"><h3 className="ts-card-title">{title}</h3><p className="mt-1 text-sm text-[var(--ts-text-muted)]">{description}</p><div className="mt-3 flex flex-wrap items-center gap-2"><Badge>{count}</Badge>{status ? <Badge tone="danger">{status}</Badge> : null}<Button variant="secondary" className="ml-auto" onClick={onOpen} aria-label={`Open ${title}`}>Open</Button></div></div></div></article>;
}

export default function ToolsWorkspace({ onClose, builderProps, schedule = { drivers: [], vehicles: [] }, onSaveDriver, onDeleteDriver, onReassignDriver, onSaveVehicle, onDeleteVehicle, onReassignVehicle, importantInfoCount, handoverCount, handoverConflictCount }) {
  const [{ activeTool }, navigate] = useReducer(toolsNavigationReducer, initialToolsNavigation);
  const [dirty, setDirty] = useState(false);
  const title = activeTool === "drivers" ? "Driver Manager" : activeTool === "vehicles" ? "Vehicle Manager" : activeTool === "importantInfo" ? "Important Information" : activeTool === "handover" ? "Vehicle Handover" : "Tools";
  const mayLeave = () => canLeaveTools(dirty, (message) => window.confirm(message));
  const close = () => { if (mayLeave()) onClose(); };
  const back = () => { if (mayLeave()) { setDirty(false); navigate({ type: "back" }); } };
  const open = (tool) => { setDirty(false); navigate({ type: "open", tool }); };
  let workspace = null;
  if (activeTool === "drivers") workspace = <DriverManager schedule={schedule} onSave={onSaveDriver} onDelete={onDeleteDriver} onReassign={onReassignDriver} onDirtyChange={setDirty} />;
  else if (activeTool === "vehicles") workspace = <VehicleManager schedule={schedule} onSave={onSaveVehicle} onDelete={onDeleteVehicle} onReassign={onReassignVehicle} onDirtyChange={setDirty} />;
  else if (activeTool) workspace = <ScheduleBuilder {...builderProps} mode={activeTool} onToolDirtyChange={setDirty} />;

  return <ModalShell title={title} subtitle={activeTool ? "Tools workspace" : "Secondary programme utilities"} onClose={close} maxWidth="max-w-5xl">
    {activeTool ? <><div className="mb-4"><Button variant="ghost" onClick={back} aria-label="Back to Tools"><ArrowLeft className="h-4 w-4" /> Back to Tools</Button></div>{workspace}</> : <div className="grid gap-3 md:grid-cols-2">
      <ToolOption icon={Users} title="Driver Manager" description="Manage drivers, default vehicles, status, and schedule references." count={`${schedule.drivers.length} total · ${schedule.drivers.filter((item) => item.isActive).length} active · ${new Set(schedule.movements?.map((item) => item.driverId)).size} referenced`} status={[...(builderProps.integrity?.errors || []), ...(builderProps.integrity?.warnings || [])].filter((issue) => issue.driverId).length ? "Driver issues" : ""} onOpen={() => open("drivers")} />
      <ToolOption icon={Car} title="Vehicle Manager" description="Manage vehicles, registration, status, and schedule references." count={`${schedule.vehicles.length} total · ${schedule.vehicles.filter((item) => item.isActive).length} active`} status={[...(builderProps.integrity?.errors || []), ...(builderProps.integrity?.warnings || [])].filter((issue) => issue.vehicleId).length ? "Vehicle issues" : ""} onOpen={() => open("vehicles")} />
      <ToolOption icon={Car} title="Vehicle Handover" description="Manage vehicle transfers, keys, instructions, and driver visibility." count={`${handoverCount} ${handoverCount === 1 ? "handover" : "handovers"}`} status={handoverConflictCount ? `${handoverConflictCount} unresolved ${handoverConflictCount === 1 ? "conflict" : "conflicts"}` : ""} onOpen={() => open("handover")} />
      <ToolOption icon={FileText} title="Important Information" description="Manage routes, contacts, addresses, and programme notes." count={`${importantInfoCount} ${importantInfoCount === 1 ? "record" : "records"}`} onOpen={() => open("importantInfo")} />
    </div>}
  </ModalShell>;
}
