import { detectHandoverConflicts } from "./handoverConflicts";
import { calculateWorkingTime } from "./workingTime";
import { detectResourceConflicts } from "./resourceConflicts";
import { buildMovementInterval, buildMovementTimeline } from "./timeIntervals";
import { duplicateDriverNames, duplicateVehicleRegistrations } from "./resourceValidation";

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

export function analyzeScheduleIntegrity(schedule, { today = new Date().toISOString().slice(0, 10) } = {}) {
  const allIssues = [];
  const days = new Map(schedule.scheduleDays.map((day) => [day.id, day]));
  const drivers = new Set(schedule.drivers.map((driver) => driver.id));
  const vehicles = new Set(schedule.vehicles.map((vehicle) => vehicle.id));
  const intervalsById = new Map();

  [[schedule.drivers, "driver"], [schedule.vehicles, "vehicle"], [schedule.scheduleDays, "schedule day"], [schedule.movements, "movement"], [schedule.vehicleHandoverNotes || [], "handover"], [schedule.importantInfoItems || [], "important information"]]
    .forEach(([items, entity]) => allIssues.push(...duplicateIssues(items, entity)));

  schedule.drivers.forEach((driver) => {
    if (driver.defaultVehicle && !vehicles.has(driver.defaultVehicle)) allIssues.push({ type: "ORPHAN_REFERENCE", severity: "error", driverId: driver.id, message: `Driver ${driver.name || driver.id} has an unknown default vehicle.` });
    if (!driver.name?.trim()) allIssues.push({ type: "INVALID_DRIVER", severity: "error", driverId: driver.id, message: "Driver name is required." });
    const defaultVehicle = schedule.vehicles.find((item) => item.id === driver.defaultVehicle);
    if (defaultVehicle && !defaultVehicle.isActive) allIssues.push({ type: "INACTIVE_DEFAULT_VEHICLE", severity: "warning", driverId: driver.id, vehicleId: defaultVehicle.id, message: `${driver.name} uses an inactive default vehicle.` });
  });
  duplicateDriverNames(schedule.drivers).forEach((name) => allIssues.push({ type: "DUPLICATE_DRIVER_NAME", severity: "warning", message: `Duplicate driver name: ${name}.` }));
  duplicateVehicleRegistrations(schedule.vehicles).forEach((registration) => allIssues.push({ type: "DUPLICATE_VEHICLE_REGISTRATION", severity: "error", message: `Duplicate vehicle registration: ${registration}.` }));
  schedule.vehicles.forEach((vehicle) => {
    if (!vehicle.name?.trim()) allIssues.push({ type: "INVALID_VEHICLE", severity: "error", vehicleId: vehicle.id, message: "Vehicle name is required." });
    if (vehicle.capacity !== null && vehicle.capacity !== undefined && (!Number.isInteger(vehicle.capacity) || vehicle.capacity < 1 || vehicle.capacity > 100)) allIssues.push({ type: "INVALID_VEHICLE_CAPACITY", severity: "error", vehicleId: vehicle.id, message: `${vehicle.name || vehicle.id} has invalid capacity.` });
  });

  schedule.movements.forEach((movement) => {
    const day = days.get(movement.scheduleDayId);
    if (!day) allIssues.push({ type: "ORPHAN_REFERENCE", severity: "error", movementIds: [movement.id], message: "Movement references an unknown schedule day." });
    if (!drivers.has(movement.driverId)) allIssues.push({ type: "ORPHAN_REFERENCE", severity: "error", movementIds: [movement.id], driverId: movement.driverId, message: "Movement references an unknown driver." });
    if (!vehicles.has(movement.vehicleId)) allIssues.push({ type: "ORPHAN_REFERENCE", severity: "error", movementIds: [movement.id], vehicleId: movement.vehicleId, message: "Movement references an unknown vehicle." });
    const movementDate = day?.date || "";
    const assignedDriver = schedule.drivers.find((item) => item.id === movement.driverId);
    const assignedVehicle = schedule.vehicles.find((item) => item.id === movement.vehicleId);
    if (movementDate >= today && assignedDriver && !assignedDriver.isActive) allIssues.push({ type: "INACTIVE_DRIVER_ASSIGNMENT", severity: "warning", movementIds: [movement.id], driverId: assignedDriver.id, message: `${assignedDriver.name} is inactive but assigned to a current or future movement.` });
    if (movementDate >= today && assignedVehicle && !assignedVehicle.isActive) allIssues.push({ type: "INACTIVE_VEHICLE_ASSIGNMENT", severity: "warning", movementIds: [movement.id], vehicleId: assignedVehicle.id, message: `${assignedVehicle.name} is inactive but assigned to a current or future movement.` });
    const timeline = buildMovementTimeline(movement);
    timeline.issues.forEach((issue) => allIssues.push({ ...issue, movementIds: [movement.id], dayIds: [movement.scheduleDayId] }));
    const built = buildMovementInterval(movement, day);
    if (built.interval) intervalsById.set(movement.id, built.interval);
    if (!built.interval && !built.issues.some((issue) => issue.severity === "error")) built.issues.filter((issue) => issue.type === "INCOMPLETE_TIMING").forEach((issue) => allIssues.push({ ...issue, movementIds: [movement.id], dayIds: [movement.scheduleDayId] }));
  });

  allIssues.push(...detectResourceConflicts(schedule.movements, intervalsById, "driverId", "DRIVER"));
  allIssues.push(...detectResourceConflicts(schedule.movements, intervalsById, "vehicleId", "VEHICLE"));
  allIssues.push(...detectHandoverConflicts(schedule, intervalsById));
  allIssues.push(...calculateWorkingTime(schedule).warnings.filter((issue) => issue.type === "WORKING_TIME_WARNING"));

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
