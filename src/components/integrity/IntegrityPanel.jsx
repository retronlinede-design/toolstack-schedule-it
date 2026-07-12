import { ChevronDown } from "lucide-react";
import { useEffect, useMemo, useReducer, useRef, useState } from "react";
import Badge from "../ui/Badge";
import { Button } from "../ui/Button";
import EmptyState from "../ui/EmptyState";
import { createIntegrityDisclosureState, integrityDisclosureReducer } from "./integrityDisclosure";

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
  const [disclosure, dispatch] = useReducer(integrityDisclosureReducer, integrity.errors.length > 0, createIntegrityDisclosureState);
  const contentRef = useRef(null);
  const focusIssuesRef = useRef(false);
  const issues = useMemo(() => [...integrity.errors, ...integrity.warnings], [integrity]);
  const groups = groupIntegrityIssues(filterIntegrityIssues(issues, filter));

  useEffect(() => {
    if (!disclosure.expanded || !focusIssuesRef.current) return;
    focusIssuesRef.current = false;
    contentRef.current?.querySelector("[data-integrity-issue]")?.focus();
  }, [disclosure.expanded]);

  function reviewIssues() {
    focusIssuesRef.current = true;
    dispatch({ type: "show" });
  }

  return <section id="schedule-integrity" className="ts-card p-4" aria-labelledby="integrity-title">
    <div className="flex flex-wrap items-center justify-between gap-3">
      <div className="min-w-0"><h2 id="integrity-title" className="ts-card-title">Schedule Integrity</h2><div className="mt-1 flex flex-wrap items-center gap-2" aria-live="polite">{issues.length ? <><Badge tone={integrity.errors.length ? "danger" : "neutral"}>{integrity.errors.length} errors</Badge><Badge tone={integrity.warnings.length ? "warning" : "neutral"}>{integrity.warnings.length} warnings</Badge></> : <span className="text-sm text-[var(--ts-text-muted)]">No issues found</span>}{integrity.errors.length ? <Badge tone="danger">Official export blocked</Badge> : null}</div></div>
      <Button id="schedule-integrity-toggle" variant="ghost" className="min-h-11 shrink-0" aria-expanded={disclosure.expanded} aria-controls="schedule-integrity-content" aria-label={disclosure.expanded ? "Hide schedule issues" : "Show schedule issues"} onClick={disclosure.expanded ? () => dispatch({ type: "toggle" }) : reviewIssues}>{disclosure.expanded ? "Hide Issues" : "Review Issues"}<ChevronDown className={`h-4 w-4 transition-transform ${disclosure.expanded ? "rotate-180" : ""}`} aria-hidden="true" /></Button>
    </div>
    {disclosure.expanded ? <div ref={contentRef} id="schedule-integrity-content" role="region" aria-labelledby="integrity-title">
      <div className="mt-4 flex flex-wrap gap-2" aria-label="Integrity issue filters">{FILTERS.map((item) => <Button key={item} variant={filter === item ? "primary" : "secondary"} className="min-h-10" aria-pressed={filter === item} onClick={() => setFilter(item)}>{item}</Button>)}</div>
      <div className="mt-4 space-y-4">{groups.length ? groups.map((group) => <section key={group.title}><h3 className="mb-2 text-sm font-semibold">{group.title}</h3><div className="grid gap-2">{group.issues.map((issue, index) => <article key={`${issue.type}-${issue.conflictKey || issue.handoverId || issue.movementIds?.join("-")}-${index}`} data-integrity-issue tabIndex={-1} className={`ts-alert ${issue.severity === "error" ? "ts-alert--danger" : "ts-alert--warning"}`}><div className="flex flex-wrap items-start justify-between gap-2"><div><Badge tone={issue.severity === "error" ? "danger" : "warning"}>{issue.overridden ? "Overridden" : issue.severity === "error" ? "Error" : "Warning"}</Badge><p className="mt-2 font-semibold">{issue.message}</p><p className="mt-1 text-xs opacity-80">{[issue.type, issue.driverId, issue.vehicleId, issue.dayIds?.join(", ")].filter(Boolean).join(" · ")}</p></div>{issue.movementIds?.[0] && onReviewIssue ? <Button variant="secondary" onClick={() => onReviewIssue(issue)}>Review / edit</Button> : null}</div></article>)}</div></section>) : <EmptyState title="No schedule issues" description="No issues match the selected filter." />}</div>
    </div> : null}
  </section>;
}
