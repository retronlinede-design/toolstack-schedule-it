export const DEFAULT_MOVEMENT_AUDIENCES = Object.freeze({
  executive: true,
  operational: true,
  cg: false,
  marida: false,
  driverIds: Object.freeze([]),
});

export const AUDIENCE_PRESETS = Object.freeze({
  allInternal: { label: "All internal", audiences: { executive: true, operational: true, cg: true, marida: true, driverIds: [] } },
  cgOnly: { label: "CG only", audiences: { executive: true, operational: true, cg: true, marida: false, driverIds: [] } },
  maridaOnly: { label: "Marida only", audiences: { executive: true, operational: true, cg: false, marida: true, driverIds: [] } },
  operationalOnly: { label: "Operational only", audiences: { executive: false, operational: true, cg: false, marida: false, driverIds: [] } },
  hidden: { label: "Hidden from outputs", audiences: { executive: false, operational: false, cg: false, marida: false, driverIds: [] } },
});

// Legacy migration only. Do not use for runtime filtering.
export function inferLegacyCgAudience(movement) {
  const participants = (movement.participants || "").toLowerCase();
  return participants.includes("cg") || participants.includes("consul-general") || participants.includes("consul general");
}

// Legacy migration only. Do not use for runtime filtering.
export function inferLegacyMaridaAudience(movement) {
  return (movement.participants || "").toLowerCase().includes("marida");
}

export function normalizeMovementAudiences(movement, knownDriverIds) {
  const explicit = movement?.audiences && typeof movement.audiences === "object" && !Array.isArray(movement.audiences) ? movement.audiences : {};
  const allowedDrivers = knownDriverIds ? new Set(knownDriverIds) : null;
  const driverIds = Array.isArray(explicit.driverIds)
    ? [...new Set(explicit.driverIds.filter((id) => typeof id === "string" && id && id !== movement.driverId && (!allowedDrivers || allowedDrivers.has(id))))]
    : [];
  return {
    executive: typeof explicit.executive === "boolean" ? explicit.executive : movement.isExecutiveVisible !== false,
    operational: typeof explicit.operational === "boolean" ? explicit.operational : movement.isOperationalVisible !== false,
    cg: typeof explicit.cg === "boolean" ? explicit.cg : inferLegacyCgAudience(movement),
    marida: typeof explicit.marida === "boolean" ? explicit.marida : inferLegacyMaridaAudience(movement),
    driverIds,
  };
}

export function withNormalizedAudiences(movement, knownDriverIds) {
  const audiences = normalizeMovementAudiences(movement, knownDriverIds);
  return { ...movement, audiences, isExecutiveVisible: audiences.executive, isOperationalVisible: audiences.operational };
}

export function isMovementVisibleInView(movement, view, options = {}) {
  const audiences = normalizeMovementAudiences(movement);
  if (view === "executive") return audiences.executive;
  if (view === "executiveCg") return audiences.cg;
  if (view === "executiveMarida") return audiences.marida;
  if (view === "operational") return audiences.operational;
  if (view === "driver") {
    const selectedDriverId = options.selectedDriverId;
    return Boolean(selectedDriverId && audiences.operational && (movement.driverId === selectedDriverId || audiences.driverIds.includes(selectedDriverId)));
  }
  return true;
}

export function selectMovementsForView(movements, view, options = {}) {
  return movements.filter((movement) => isMovementVisibleInView(movement, view, options));
}

export function getAudienceWarnings(movement) {
  const audiences = normalizeMovementAudiences(movement);
  const warnings = [];
  if (audiences.cg && !audiences.executive) warnings.push("This movement appears in the CG Programme but not in the Full Executive Programme.");
  if (audiences.marida && !audiences.executive) warnings.push("This movement appears in the Marida Programme but not in the Full Executive Programme.");
  if (!audiences.operational && audiences.driverIds.length > 0) warnings.push("Additional driver visibility has no effect while Operational Programme is disabled.");
  if (![audiences.executive, audiences.operational, audiences.cg, audiences.marida].some(Boolean)) warnings.push("This movement will not appear in any programme output.");
  return warnings;
}

export function applyAudiencePreset(current, presetId) {
  const preset = AUDIENCE_PRESETS[presetId];
  return preset ? { ...current, ...preset.audiences, driverIds: [...preset.audiences.driverIds] } : current;
}

export function getAudienceBadges(movement) {
  const audiences = normalizeMovementAudiences(movement);
  return [
    audiences.executive ? "Executive" : null,
    audiences.operational ? "Operational" : null,
    audiences.cg ? "CG" : null,
    audiences.marida ? "Marida" : null,
    audiences.driverIds.length ? `Driver +${audiences.driverIds.length}` : null,
  ].filter(Boolean);
}

export function getAudienceSummary(movement) {
  const badges = getAudienceBadges(movement);
  return badges.length ? `Visible in ${badges.join(", ")}` : "Hidden from all outputs";
}

export function getVisibilityCounts(movements) {
  return {
    executive: movements.filter((movement) => isMovementVisibleInView(movement, "executive")).length,
    cg: movements.filter((movement) => isMovementVisibleInView(movement, "executiveCg")).length,
    marida: movements.filter((movement) => isMovementVisibleInView(movement, "executiveMarida")).length,
    operational: movements.filter((movement) => isMovementVisibleInView(movement, "operational")).length,
    hidden: movements.filter((movement) => {
      const audiences = normalizeMovementAudiences(movement);
      return !audiences.executive && !audiences.operational && !audiences.cg && !audiences.marida;
    }).length,
  };
}
