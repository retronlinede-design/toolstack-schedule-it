import { useMemo, useState } from "react";
import Badge from "../ui/Badge";
import { Button } from "../ui/Button";
import EmptyState from "../ui/EmptyState";

const FILTERS = ["All", "Errors", "Warnings", "Overridden"];
const category = (issue) => issue.type?.includes("CHRONOLOGY") || issue.type?.includes("TIME_SEQUENCE") ? "Chronology" : issue.type?.startsWith("DRIVER_") ? "Driver conflicts" : issue.type?.startsWith("VEHICLE_") ? "Vehicle conflicts" : issue.handoverId || issue.type?.includes("HANDOVER") ? "Handovers" : issue.type?.includes("UNKNOWN") || issue.type?.includes("ORPHAN") || issue.type?.includes("DUPLICATE_ID") ? "Orphan references" : "Warnings";

function filterIntegrityIssues(issues, filter) {
  if (filter === "Errors") return issues.filter((issue) => issue.severity === "error");
  if (filter === "Warnings") return issues.filter((issue) => issue.severity !== "error" && !issue.overridden);
  if (filter === "Overridden") return issues.filter((issue) => issue.overridden);
  return issues;
}

function groupIntegrityIssues(issues) {
  const groups = issues.reduce((result, issue) => {
    const title = category(issue);
    if (!result.has(title)) result.set(title, []);
    result.get(title).push(issue);
    return result;
  }, new Map());
  return [...groups].map(([title, grouped]) => ({ title, issues: grouped }));
}

export default function IntegrityPanel({ integrity, onReviewIssue }) {
  const [filter, setFilter] = useState("All");
  const issues = useMemo(() => [...integrity.errors, ...integrity.warnings], [integrity]);
  const groups = groupIntegrityIssues(filterIntegrityIssues(issues, filter));
  return <section id="schedule-integrity" className="ts-card p-4" aria-labelledby="integrity-title">
    <div className="flex flex-wrap items-center justify-between gap-3"><div><h2 id="integrity-title" className="ts-card-title">Schedule Integrity</h2><p className="text-sm text-[var(--ts-text-muted)]">{integrity.errors.length} errors · {integrity.warnings.length} warnings</p></div><Badge tone={integrity.errors.length ? "danger" : "success"}>{integrity.errors.length ? "Official export blocked" : "Ready for official output"}</Badge></div>
    <div className="mt-4 flex flex-wrap gap-2" aria-label="Integrity issue filters">{FILTERS.map((item) => <Button key={item} variant={filter === item ? "primary" : "secondary"} className="min-h-10" aria-pressed={filter === item} onClick={() => setFilter(item)}>{item}</Button>)}</div>
    <div className="mt-4 space-y-4">{groups.length ? groups.map((group) => <section key={group.title}><h3 className="mb-2 text-sm font-semibold">{group.title}</h3><div className="grid gap-2">{group.issues.map((issue, index) => <article key={`${issue.type}-${issue.conflictKey || issue.handoverId || issue.movementIds?.join("-")}-${index}`} className={`ts-alert ${issue.severity === "error" ? "ts-alert--danger" : "ts-alert--warning"}`}><div className="flex flex-wrap items-start justify-between gap-2"><div><Badge tone={issue.severity === "error" ? "danger" : "warning"}>{issue.overridden ? "Overridden" : issue.severity === "error" ? "Error" : "Warning"}</Badge><p className="mt-2 font-semibold">{issue.message}</p><p className="mt-1 text-xs opacity-80">{[issue.type, issue.driverId, issue.vehicleId, issue.dayIds?.join(", ")].filter(Boolean).join(" · ")}</p></div>{issue.movementIds?.[0] && onReviewIssue ? <Button variant="secondary" onClick={() => onReviewIssue(issue)}>Review / edit</Button> : null}</div></article>)}</div></section>) : <EmptyState title="No schedule issues" description="No issues match the selected filter." />}</div>
  </section>;
}
