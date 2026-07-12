import { detectHandoverConflicts } from "./handoverConflicts";
import { detectResourceConflicts } from "./resourceConflicts";
import { buildMovementInterval, buildMovementTimeline } from "./timeIntervals";

function duplicateIssues(items, entity) {
  const seen = new Set();
  const duplicates = new Set();
  items.forEach((item) => { if (seen.has(item.id)) duplicates.add(item.id); seen.add(item.id); });
  return [...duplicates].sort().map((id) => ({ type: "DUPLICATE_ID", severity: "error", entity, entityId: id, message: `Duplicate ${entity} ID ${id}.` }));
}

function addIndexed(target, ids, issue) {
  ids.filter(Boolean).forEach((id) => {
    if (!target[id]) target[id] = [];
    target[id].push(issue);
  });
}

export function analyzeScheduleIntegrity(schedule) {
  const allIssues = [];
  const days = new Map(schedule.scheduleDays.map((day) => [day.id, day]));
  const drivers = new Set(schedule.drivers.map((driver) => driver.id));
  const vehicles = new Set(schedule.vehicles.map((vehicle) => vehicle.id));
  const intervalsById = new Map();

  [[schedule.drivers, "driver"], [schedule.vehicles, "vehicle"], [schedule.scheduleDays, "schedule day"], [schedule.movements, "movement"], [schedule.vehicleHandoverNotes || [], "handover"], [schedule.importantInfoItems || [], "important information"]]
    .forEach(([items, entity]) => allIssues.push(...duplicateIssues(items, entity)));

  schedule.drivers.forEach((driver) => {
    if (driver.defaultVehicle && !vehicles.has(driver.defaultVehicle)) allIssues.push({ type: "ORPHAN_REFERENCE", severity: "error", driverId: driver.id, message: `Driver ${driver.name || driver.id} has an unknown default vehicle.` });
  });

  schedule.movements.forEach((movement) => {
    const day = days.get(movement.scheduleDayId);
    if (!day) allIssues.push({ type: "ORPHAN_REFERENCE", severity: "error", movementIds: [movement.id], message: "Movement references an unknown schedule day." });
    if (!drivers.has(movement.driverId)) allIssues.push({ type: "ORPHAN_REFERENCE", severity: "error", movementIds: [movement.id], driverId: movement.driverId, message: "Movement references an unknown driver." });
    if (!vehicles.has(movement.vehicleId)) allIssues.push({ type: "ORPHAN_REFERENCE", severity: "error", movementIds: [movement.id], vehicleId: movement.vehicleId, message: "Movement references an unknown vehicle." });
    const timeline = buildMovementTimeline(movement);
    timeline.issues.forEach((issue) => allIssues.push({ ...issue, movementIds: [movement.id], dayIds: [movement.scheduleDayId] }));
    const built = buildMovementInterval(movement, day);
    if (built.interval) intervalsById.set(movement.id, built.interval);
    if (!built.interval && !built.issues.some((issue) => issue.severity === "error")) built.issues.filter((issue) => issue.type === "INCOMPLETE_TIMING").forEach((issue) => allIssues.push({ ...issue, movementIds: [movement.id], dayIds: [movement.scheduleDayId] }));
  });

  allIssues.push(...detectResourceConflicts(schedule.movements, intervalsById, "driverId", "DRIVER"));
  allIssues.push(...detectResourceConflicts(schedule.movements, intervalsById, "vehicleId", "VEHICLE"));
  allIssues.push(...detectHandoverConflicts(schedule, intervalsById));

  const errors = allIssues.filter((issue) => issue.severity === "error");
  const warnings = allIssues.filter((issue) => issue.severity === "warning");
  const conflictsByMovementId = {};
  const conflictsByHandoverId = {};
  allIssues.forEach((issue) => {
    addIndexed(conflictsByMovementId, issue.movementIds || [], issue);
    addIndexed(conflictsByHandoverId, issue.handoverIds || (issue.handoverId ? [issue.handoverId] : []), issue);
  });
  return {
    errors,
    warnings,
    conflictsByMovementId,
    conflictsByHandoverId,
    summary: {
      chronologyErrors: errors.filter((issue) => ["INVALID_TIME", "CHRONOLOGY_ERROR", "MULTIPLE_ROLLOVERS"].includes(issue.type)).length,
      driverOverlaps: allIssues.filter((issue) => issue.type === "DRIVER_OVERLAP").length,
      vehicleOverlaps: allIssues.filter((issue) => issue.type === "VEHICLE_OVERLAP").length,
      handoverConflicts: errors.filter((issue) => issue.type.startsWith("HANDOVER_")).length,
      orphanReferences: errors.filter((issue) => ["ORPHAN_REFERENCE", "DUPLICATE_ID"].includes(issue.type) || issue.type.includes("UNKNOWN")).length,
      warnings: warnings.length,
    },
  };
}

export function canProduceOfficialOutput(analysis) {
  return analysis.errors.length === 0;
}

export function validateMovementCandidate(schedule, candidate, editingId = candidate.id) {
  const candidateId = editingId || candidate.id || "draft-movement";
  const movement = { ...candidate, id: candidateId };
  const nextSchedule = { ...schedule, movements: [...schedule.movements.filter((item) => item.id !== editingId), movement] };
  const analysis = analyzeScheduleIntegrity(nextSchedule);
  return { analysis, issues: analysis.conflictsByMovementId[candidateId] || [], blocking: (analysis.conflictsByMovementId[candidateId] || []).filter((issue) => issue.severity === "error") };
}
