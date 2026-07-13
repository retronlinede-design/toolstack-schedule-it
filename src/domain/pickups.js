export const MAX_PICKUPS_PER_MOVEMENT = 50;
export const PICKUP_KEYS = ["id", "time", "location", "address", "person", "contactPhone", "notes", "sortOrder"];

export function createPickupId() {
  if (globalThis.crypto?.randomUUID) return `pickup-${globalThis.crypto.randomUUID()}`;
  return `pickup-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
}

export function emptyPickup(id = createPickupId(), sortOrder = 10) {
  return { id, time: "", location: "", address: "", person: "", contactPhone: "", notes: "", sortOrder };
}

export function sortPickups(pickups = []) {
  return [...pickups].sort((a, b) => (a.sortOrder ?? Number.MAX_SAFE_INTEGER) - (b.sortOrder ?? Number.MAX_SAFE_INTEGER) || String(a.id).localeCompare(String(b.id)));
}

export function normalizePickups(pickups, movementId = "movement") {
  if (!Array.isArray(pickups)) return [];
  const seen = new Set();
  return sortPickups(pickups).map((pickup, index) => {
    const requestedId = typeof pickup?.id === "string" && pickup.id ? pickup.id : `pickup-${movementId}-${index + 1}`;
    let id = requestedId;
    let suffix = 2;
    while (seen.has(id)) { id = `${requestedId}-${suffix}`; suffix += 1; }
    seen.add(id);
    return {
      id,
      time: typeof pickup?.time === "string" ? pickup.time : "",
      location: typeof pickup?.location === "string" ? pickup.location : "",
      address: typeof pickup?.address === "string" ? pickup.address : "",
      person: typeof pickup?.person === "string" ? pickup.person : "",
      contactPhone: typeof pickup?.contactPhone === "string" ? pickup.contactPhone : "",
      notes: typeof pickup?.notes === "string" ? pickup.notes : "",
      sortOrder: Number.isFinite(pickup?.sortOrder) ? pickup.sortOrder : (index + 1) * 10,
    };
  });
}

export function addPickup(pickups = []) {
  const ordered = normalizePickups(pickups);
  const nextSortOrder = ordered.length ? Math.max(...ordered.map((pickup) => pickup.sortOrder)) + 10 : 10;
  return [...ordered, emptyPickup(createPickupId(), nextSortOrder)];
}

export function updatePickup(pickups, id, changes) {
  return normalizePickups(pickups).map((pickup) => pickup.id === id ? { ...pickup, ...changes, id: pickup.id } : pickup);
}

export function deletePickup(pickups, id) {
  return normalizePickups(pickups).filter((pickup) => pickup.id !== id).map((pickup, index) => ({ ...pickup, sortOrder: (index + 1) * 10 }));
}

export function duplicatePickup(pickups, id) {
  const ordered = normalizePickups(pickups);
  const index = ordered.findIndex((pickup) => pickup.id === id);
  if (index < 0) return ordered;
  ordered.splice(index + 1, 0, { ...ordered[index], id: createPickupId() });
  return ordered.map((pickup, itemIndex) => ({ ...pickup, sortOrder: (itemIndex + 1) * 10 }));
}

export function movePickup(pickups, id, direction) {
  const ordered = normalizePickups(pickups);
  const index = ordered.findIndex((pickup) => pickup.id === id);
  const target = direction === "up" ? index - 1 : index + 1;
  if (index < 0 || target < 0 || target >= ordered.length) return ordered;
  [ordered[index], ordered[target]] = [ordered[target], ordered[index]];
  return ordered.map((pickup, itemIndex) => ({ ...pickup, sortOrder: (itemIndex + 1) * 10 }));
}

export function clonePickups(pickups = []) {
  return normalizePickups(pickups).map((pickup, index) => ({ ...pickup, id: createPickupId(), sortOrder: (index + 1) * 10 }));
}

export function validatePickups(pickups) {
  if (!Array.isArray(pickups)) return [{ type: "PICKUP_VALIDATION", severity: "error", field: "pickups", message: "Pickups must be an array." }];
  const issues = [];
  if (pickups.length > MAX_PICKUPS_PER_MOVEMENT) issues.push({ type: "PICKUP_VALIDATION", severity: "error", field: "pickups", message: "A movement may contain at most 50 pickups." });
  const ids = new Set();
  pickups.forEach((pickup, index) => {
    const label = `Pickup ${index + 1}`;
    const field = (name) => `pickups.${pickup?.id || index}.${name}`;
    if (!pickup || typeof pickup !== "object" || Array.isArray(pickup) || (Object.getPrototypeOf(pickup) !== Object.prototype && Object.getPrototypeOf(pickup) !== null)) {
      issues.push({ type: "PICKUP_VALIDATION", severity: "error", field: `pickups.${index}`, message: `${label} must be a plain object.` });
      return;
    }
    Object.keys(pickup).filter((key) => !PICKUP_KEYS.includes(key)).forEach((key) => issues.push({ type: "PICKUP_VALIDATION", severity: "error", pickupId: pickup.id, field: field(key), message: `${label} contains an unsupported field.` }));
    if (typeof pickup.id !== "string" || !pickup.id) issues.push({ type: "PICKUP_VALIDATION", severity: "error", field: field("id"), message: `${label} ID is required.` });
    else if (ids.has(pickup.id)) issues.push({ type: "PICKUP_VALIDATION", severity: "error", pickupId: pickup.id, field: field("id"), message: `${label} ID is duplicated.` });
    ids.add(pickup.id);
    if (typeof pickup.time !== "string" || (pickup.time && !/^([01]\d|2[0-3]):([0-5]\d)$/.test(pickup.time))) issues.push({ type: "INVALID_TIME", severity: "error", pickupId: pickup.id, field: field("time"), message: `${label} time must use HH:mm.` });
    if (typeof pickup.location !== "string" || !pickup.location.trim()) issues.push({ type: "PICKUP_VALIDATION", severity: "error", pickupId: pickup.id, field: field("location"), message: `${label} location is required.` });
    [["location", 300], ["address", 1000], ["person", 300], ["contactPhone", 100], ["notes", 5000]].forEach(([name, limit]) => {
      if (typeof pickup[name] !== "string" || pickup[name].length > limit) issues.push({ type: "PICKUP_VALIDATION", severity: "error", pickupId: pickup.id, field: field(name), message: `${label} ${name} must be a string of at most ${limit} characters.` });
    });
    if (!Number.isFinite(pickup.sortOrder)) issues.push({ type: "PICKUP_VALIDATION", severity: "error", pickupId: pickup.id, field: field("sortOrder"), message: `${label} sort order must be finite.` });
  });
  return issues;
}
