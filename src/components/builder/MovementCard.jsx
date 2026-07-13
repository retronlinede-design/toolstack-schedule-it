import { ArrowDown, ArrowUp, Copy, Pencil, Trash2 } from "lucide-react";
import { useState } from "react";
import Badge from "../ui/Badge";
import { Button, IconButton } from "../ui/Button";
import { getAudienceBadges, getAudienceSummary } from "../../domain/audiences";
import { pickupBadge, pickupViewModels } from "../../domain/pickupPresentation";

function name(items, id) { return items.find((item) => item.id === id)?.name || "Unassigned"; }
function Detail({ label, value }) { return value ? <div><dt className="text-xs font-semibold text-[var(--ts-text-muted)]">{label}</dt><dd className="mt-0.5 whitespace-pre-line text-sm">{value}</dd></div> : null; }
export function PickupDetails({ movement }) {
  const pickups = pickupViewModels(movement);
  if (!pickups.length) return null;
  return <section className="mt-4"><h4 className="text-sm font-semibold">Pickups</h4><ol className="mt-2 space-y-2 text-sm">{pickups.map((pickup) => <li key={pickup.id} className="rounded-lg bg-white p-2"><strong>{pickup.sequence}. {pickup.time || "Time missing"} — {pickup.location || "Location missing"}</strong>{pickup.person ? <p>{pickup.person}</p> : null}{pickup.address ? <p className="text-[var(--ts-text-muted)]">{pickup.address}</p> : null}{pickup.contactPhone ? <p>Contact: {pickup.contactPhone}</p> : null}{pickup.notes ? <p className="whitespace-pre-line">{pickup.notes}</p> : null}</li>)}</ol></section>;
}

export default function MovementCard({ movement, index, count, drivers, vehicles, issues = [], editing, showInlineEditor, onQuickEdit, onFullEdit, onDuplicate, onMove, onDelete, children }) {
  const [expanded, setExpanded] = useState(false);
  const mainTime = movement.driverStart || movement.departureTime || movement.arrivalTime || movement.eventStartTime || movement.endTime || "—";
  const operationalValues = [movement.contactPerson, movement.contactPhone, movement.parking, movement.locationNotes, movement.internalNotes, movement.securityNotes, movement.protocolNotes, movement.dressCode, movement.documentsToCarry, movement.materialsOrGifts, movement.specialInstructions].filter(Boolean);
  return <article id={`movement-${movement.id}`} tabIndex={-1} className={`ts-card overflow-hidden ${editing ? "border-l-4 border-l-[#b1d400] bg-[var(--ts-accent-soft)]" : ""}`}>
    <div className="flex flex-col gap-3 p-4 sm:flex-row sm:items-start">
      <div className="flex items-center gap-3 sm:w-24"><Badge tone="accent">#{index + 1}</Badge><span className="font-mono text-base font-semibold">{mainTime}</span></div>
      <button type="button" aria-expanded={expanded} aria-controls={`movement-details-${movement.id}`} onClick={() => setExpanded((value) => !value)} className="min-w-0 flex-1 rounded-lg text-left focus-visible:outline-offset-4">
        <span className="block truncate text-base font-semibold">{movement.engagementDetails || "Untitled movement"}</span>
        <span className="mt-1 block text-sm text-[var(--ts-text-muted)]">{movement.venue || movement.address || "No venue"} · {name(drivers, movement.driverId)} · {name(vehicles, movement.vehicleId)}</span>
        <span className="mt-2 flex flex-wrap gap-1" aria-label={getAudienceSummary(movement)}>{getAudienceBadges(movement).map((badge) => <Badge key={badge}>{badge}</Badge>)}{pickupBadge(movement) ? <Badge tone="info">{pickupBadge(movement)}</Badge> : null}{issues.some((issue) => issue.severity === "error") ? <Badge tone="danger">Conflict</Badge> : null}{issues.some((issue) => issue.severity === "warning") ? <Badge tone="warning">Warning</Badge> : null}{movement.continuesOvernight ? <Badge tone="info">Overnight</Badge> : null}{movement.conflictOverrides?.length ? <Badge tone="accent">Override</Badge> : null}</span>
      </button>
      <div className="flex flex-wrap gap-1">
        <IconButton label={`Move ${movement.engagementDetails || "movement"} up`} onClick={() => onMove(movement.id, "up")} disabled={index === 0}><ArrowUp className="h-4 w-4" /></IconButton>
        <IconButton label={`Move ${movement.engagementDetails || "movement"} down`} onClick={() => onMove(movement.id, "down")} disabled={index === count - 1}><ArrowDown className="h-4 w-4" /></IconButton>
      </div>
    </div>
    {showInlineEditor && children ? <div className="border-t border-[var(--ts-border)] bg-white p-4">{children}</div> : null}
    {expanded ? <div id={`movement-details-${movement.id}`} className="border-t border-[var(--ts-border)] bg-[var(--ts-surface-muted)] p-4"><dl className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3"><Detail label="Timing" value={[movement.driverStart && `Driver ${movement.driverStart}`, movement.departureTime && `Depart ${movement.departureTime}`, movement.arrivalTime && `Arrive ${movement.arrivalTime}`, movement.eventStartTime && `Event ${movement.eventStartTime}`, movement.eventEndTime && `Event end ${movement.eventEndTime}`, movement.endTime && `Duty end ${movement.endTime}`].filter(Boolean).join(" · ")} /><Detail label="Participants" value={movement.participants} /><Detail label="Address" value={movement.address} /><Detail label="Operational details" value={operationalValues.join(" · ")} /><Detail label="Audience" value={getAudienceSummary(movement)} /><Detail label="Overrides" value={movement.conflictOverrides?.map((item) => item.reason).join("\n")} /></dl><PickupDetails movement={movement} />{issues.length ? <div className="ts-alert ts-alert--warning mt-4 text-xs"><strong>Movement warnings</strong><ul className="mt-1 list-disc pl-5">{issues.map((issue, issueIndex) => <li key={`${issue.type}-${issueIndex}`}>{issue.message}</li>)}</ul></div> : null}<div className="mt-4 flex flex-wrap gap-2"><Button onClick={() => onQuickEdit(movement)}><Pencil className="h-4 w-4" /> Quick edit</Button><Button onClick={() => onFullEdit(movement)}><Pencil className="h-4 w-4" /> Full editor</Button><Button onClick={() => onDuplicate(movement)}><Copy className="h-4 w-4" /> Duplicate</Button><Button variant="danger" onClick={() => onDelete(movement.id)}><Trash2 className="h-4 w-4" /> Delete</Button></div></div> : null}
  </article>;
}
