import { parseStrictTime } from "../domain/timeIntervals";
import { WORK_CLASSIFICATIONS, validateWorkingTimePolicy } from "../domain/workingTimePolicy";
import { duplicateVehicleRegistrations } from "../domain/resourceValidation";

export const VALIDATION_LIMITS = {
  maxDepth: 20,
  text: 100_000,
  drivers: 500,
  vehicles: 500,
  scheduleDays: 10_000,
  movements: 100_000,
  vehicleHandoverNotes: 100_000,
  importantInfoItems: 100_000,
  routeNotes: 100_000,
};

const forbiddenKeys = new Set(["__proto__", "proto", "constructor", "prototype"]);
const rootKeys = new Set(["version", "profile", "drivers", "vehicles", "scheduleDays", "movements", "vehicleHandoverNotes", "importantInfoItems", "routeNotes", "workingTimePolicy"]);
const profileKeys = new Set(["missionName", "documentTitle"]);
const driverKeys = new Set(["id", "name", "defaultVehicle", "isActive", "phone", "email", "notes"]);
const vehicleKeys = new Set(["id", "name", "registration", "make", "model", "capacity", "isActive", "notes"]);
const dayKeys = new Set(["id", "date", "title"]);
const movementKeys = new Set([
  "id", "scheduleDayId", "sortOrder", "driverId", "vehicleId", "driverStart", "departureTime", "arrivalTime", "endTime",
  "eventStartTime", "eventEndTime", "engagementDetails", "venue", "address", "locationNotes", "participants", "parking",
  "internalNotes", "contactPerson", "contactPhone", "securityNotes", "protocolNotes", "dressCode", "documentsToCarry",
  "materialsOrGifts", "specialInstructions", "isExecutiveVisible", "isOperationalVisible",
  "audiences",
  "continuesOvernight", "conflictOverrides", "workClassification",
]);
const audienceKeys = new Set(["executive", "operational", "cg", "marida", "driverIds"]);
const overrideKeys = new Set(["conflictKey", "reason", "acknowledgedAt"]);
const handoverKeys = new Set(["id", "scheduleDayId", "vehicleId", "fromDriverId", "toDriverId", "visibleToDriverIds", "location", "instruction", "keyLocation", "time", "notes", "sortOrder"]);
const infoKeys = new Set(["id", "type", "title", "from", "to", "distance", "estimatedTravelTime", "name", "phone", "email", "address", "notes", "sortOrder"]);
const routeKeys = new Set(["id", "scheduleDayId", "driverId", "from", "to", "distance", "estimatedTravelTime", "notes", "sortOrder"]);
const infoTypes = new Set(["Route", "Contact", "Address", "Note"]);

function plain(value) {
  if (!value || typeof value !== "object" || Array.isArray(value)) return false;
  const prototype = Object.getPrototypeOf(value);
  return prototype === Object.prototype || prototype === null;
}

function scan(value, depth = 0) {
  if (depth > VALIDATION_LIMITS.maxDepth) return { code: "EXCESSIVE_NESTING", path: "$" };
  if (!value || typeof value !== "object") return null;
  for (const key of Object.keys(value)) {
    if (forbiddenKeys.has(key)) return { code: "FORBIDDEN_KEY", path: key };
    const nested = scan(value[key], depth + 1);
    if (nested) return nested;
  }
  return null;
}

function addUnknownWarnings(value, allowed, path, warnings) {
  Object.keys(value).filter((key) => !allowed.has(key)).forEach((key) => warnings.push(`Unknown field ${path}.${key} is present; review compatibility before replacement.`));
}

function stringField(value, name, errors, { required = false } = {}) {
  if (typeof value !== "string" || (required && !value.trim())) errors.push({ code: "INVALID_SCHEMA", path: name, message: `${name} must be ${required ? "a nonempty" : "a"} string.` });
  else if (value.length > VALIDATION_LIMITS.text) errors.push({ code: "STRING_TOO_LARGE", path: name, message: `${name} exceeds the text limit.` });
}

function boundedString(value, name, maximum, errors, required = false) {
  stringField(value, name, errors, { required });
  if (typeof value === "string" && value.length > maximum) errors.push({ code: "STRING_TOO_LARGE", path: name, message: `${name} exceeds ${maximum} characters.` });
}

function finiteOptional(value, name, errors) {
  if (value !== undefined && value !== null && !Number.isFinite(value)) errors.push({ code: "INVALID_SCHEMA", path: name, message: `${name} must be finite.` });
}

function uniqueId(item, path, seen, errors) {
  stringField(item.id, `${path}.id`, errors, { required: true });
  if (typeof item.id === "string" && item.id) {
    if (seen.has(item.id)) errors.push({ code: "DUPLICATE_ID", path: `${path}.id`, message: `Duplicate ID ${item.id}.` });
    seen.add(item.id);
  }
}

function validateCollection(root, name, allowedKeys, errors, warnings, validateItem) {
  const items = root[name];
  if (!Array.isArray(items)) {
    errors.push({ code: "INVALID_SCHEMA", path: name, message: `${name} must be an array.` });
    return [];
  }
  if (items.length > VALIDATION_LIMITS[name]) errors.push({ code: "EXCESSIVE_COUNT", path: name, message: `${name} exceeds its record limit.` });
  const seen = new Set();
  items.forEach((item, index) => {
    const path = `${name}[${index}]`;
    if (!plain(item)) return errors.push({ code: "INVALID_SCHEMA", path, message: `${path} must be a plain object.` });
    addUnknownWarnings(item, allowedKeys, path, warnings);
    uniqueId(item, path, seen, errors);
    validateItem(item, path);
  });
  return items;
}

function validDate(value) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value || "")) return false;
  const [year, month, day] = value.split("-").map(Number);
  const date = new Date(Date.UTC(year, month - 1, day));
  return date.getUTCFullYear() === year && date.getUTCMonth() === month - 1 && date.getUTCDate() === day;
}

export function validateScheduleBackupState(state) {
  const errors = [];
  const warnings = [];
  const unsafe = scan(state);
  if (unsafe) return { ok: false, errors: [{ ...unsafe, message: "The data contains a forbidden key or excessive nesting." }], warnings };
  if (!plain(state)) return { ok: false, errors: [{ code: "INVALID_SCHEMA", path: "$", message: "Schedule state must be a plain object." }], warnings };
  addUnknownWarnings(state, rootKeys, "$", warnings);
  if (state.version !== 1) errors.push({ code: "UNSUPPORTED_VERSION", path: "version", message: "Only schedule state version 1 is supported." });
  if (state.workingTimePolicy !== undefined) {
    const policyResult = validateWorkingTimePolicy(state.workingTimePolicy);
    policyResult.errors.forEach((message) => errors.push({ code: "INVALID_SCHEMA", path: "workingTimePolicy", message }));
  }
  if (!plain(state.profile)) errors.push({ code: "INVALID_SCHEMA", path: "profile", message: "Profile must be a plain object." });
  else {
    addUnknownWarnings(state.profile, profileKeys, "profile", warnings);
    stringField(state.profile.missionName, "profile.missionName", errors);
    stringField(state.profile.documentTitle, "profile.documentTitle", errors);
  }

  const vehicles = validateCollection(state, "vehicles", vehicleKeys, errors, warnings, (item, path) => {
    boundedString(item.name, `${path}.name`, 150, errors, true);
    [["registration", 50], ["make", 100], ["model", 100], ["notes", 10_000]].forEach(([field, max]) => { if (item[field] !== undefined) boundedString(item[field], `${path}.${field}`, max, errors); });
    if (item.isActive !== undefined && typeof item.isActive !== "boolean") errors.push({ code: "INVALID_SCHEMA", path: `${path}.isActive`, message: "isActive must be boolean." });
    if (item.capacity !== undefined && item.capacity !== null && (!Number.isInteger(item.capacity) || item.capacity < 1 || item.capacity > 100)) errors.push({ code: "INVALID_SCHEMA", path: `${path}.capacity`, message: "capacity must be null or an integer from 1 to 100." });
  });
  duplicateVehicleRegistrations(vehicles).forEach((registration) => errors.push({ code: "DUPLICATE_ID", path: "vehicles.registration", message: `Duplicate vehicle registration ${registration}.` }));
  const vehicleIds = new Set(vehicles.map((item) => item.id));
  const drivers = validateCollection(state, "drivers", driverKeys, errors, warnings, (item, path) => {
    boundedString(item.name, `${path}.name`, 150, errors, true);
    [["phone", 100], ["email", 254], ["notes", 10_000]].forEach(([field, max]) => { if (item[field] !== undefined) boundedString(item[field], `${path}.${field}`, max, errors); });
    if (item.isActive !== undefined && typeof item.isActive !== "boolean") errors.push({ code: "INVALID_SCHEMA", path: `${path}.isActive`, message: "isActive must be boolean." });
    if (item.defaultVehicle !== undefined) {
      stringField(item.defaultVehicle, `${path}.defaultVehicle`, errors);
      if (item.defaultVehicle && !vehicleIds.has(item.defaultVehicle)) errors.push({ code: "UNKNOWN_REFERENCE", path: `${path}.defaultVehicle`, message: "Unknown default vehicle." });
    }
  });
  const driverIds = new Set(drivers.map((item) => item.id));
  const days = validateCollection(state, "scheduleDays", dayKeys, errors, warnings, (item, path) => {
    stringField(item.date, `${path}.date`, errors);
    if (!validDate(item.date)) errors.push({ code: "INVALID_SCHEMA", path: `${path}.date`, message: "Invalid schedule date." });
    stringField(item.title, `${path}.title`, errors);
  });
  const dayIds = new Set(days.map((item) => item.id));
  const dateCounts = new Map();
  days.forEach((day) => dateCounts.set(day.date, (dateCounts.get(day.date) || 0) + 1));
  dateCounts.forEach((count, date) => { if (count > 1) warnings.push(`Duplicate schedule date ${date} appears ${count} times.`); });

  validateCollection(state, "movements", movementKeys, errors, warnings, (item, path) => {
    [["scheduleDayId", dayIds], ["driverId", driverIds], ["vehicleId", vehicleIds]].forEach(([field, known]) => {
      stringField(item[field], `${path}.${field}`, errors, { required: true });
      if (item[field] && !known.has(item[field])) errors.push({ code: "UNKNOWN_REFERENCE", path: `${path}.${field}`, message: `Unknown ${field}.` });
    });
    finiteOptional(item.sortOrder, `${path}.sortOrder`, errors);
    ["driverStart", "departureTime", "arrivalTime", "endTime", "eventStartTime", "eventEndTime"].forEach((field) => {
      if (item[field] !== undefined) {
        stringField(item[field], `${path}.${field}`, errors);
        if (typeof item[field] === "string" && item[field] && !parseStrictTime(item[field]).ok) errors.push({ code: "INVALID_SCHEMA", path: `${path}.${field}`, message: "Invalid time format." });
      }
    });
    [...movementKeys].filter((field) => !["id", "scheduleDayId", "sortOrder", "driverId", "vehicleId", "driverStart", "departureTime", "arrivalTime", "endTime", "eventStartTime", "eventEndTime", "isExecutiveVisible", "isOperationalVisible", "audiences", "continuesOvernight", "conflictOverrides", "workClassification"].includes(field))
      .forEach((field) => { if (item[field] !== undefined) stringField(item[field], `${path}.${field}`, errors); });
    ["isExecutiveVisible", "isOperationalVisible"].forEach((field) => { if (item[field] !== undefined && typeof item[field] !== "boolean") errors.push({ code: "INVALID_SCHEMA", path: `${path}.${field}`, message: `${field} must be boolean.` }); });
    if (item.audiences !== undefined) {
      if (!plain(item.audiences)) errors.push({ code: "INVALID_SCHEMA", path: `${path}.audiences`, message: "audiences must be a plain object." });
      else {
        const unknownAudienceKeys = Object.keys(item.audiences).filter((key) => !audienceKeys.has(key));
        unknownAudienceKeys.forEach((key) => errors.push({ code: "INVALID_SCHEMA", path: `${path}.audiences.${key}`, message: "Unknown audience field." }));
        ["executive", "operational", "cg", "marida"].forEach((field) => {
          if (typeof item.audiences[field] !== "boolean") errors.push({ code: "INVALID_SCHEMA", path: `${path}.audiences.${field}`, message: `${field} must be boolean.` });
        });
        if (!Array.isArray(item.audiences.driverIds)) errors.push({ code: "INVALID_SCHEMA", path: `${path}.audiences.driverIds`, message: "driverIds must be an array." });
        else {
          const seenAudienceDrivers = new Set();
          item.audiences.driverIds.forEach((id) => {
            if (typeof id !== "string" || !driverIds.has(id)) errors.push({ code: "UNKNOWN_REFERENCE", path: `${path}.audiences.driverIds`, message: "Unknown audience driver." });
            if (seenAudienceDrivers.has(id) || id === item.driverId) errors.push({ code: "DUPLICATE_ID", path: `${path}.audiences.driverIds`, message: "Additional driver IDs must be unique and exclude the assigned driver." });
            seenAudienceDrivers.add(id);
          });
          if (item.audiences.driverIds.length > drivers.length) errors.push({ code: "EXCESSIVE_COUNT", path: `${path}.audiences.driverIds`, message: "Too many additional drivers." });
        }
      }
    }
    if (item.continuesOvernight !== undefined && typeof item.continuesOvernight !== "boolean") errors.push({ code: "INVALID_SCHEMA", path: `${path}.continuesOvernight`, message: "continuesOvernight must be boolean." });
    if (item.workClassification !== undefined && !WORK_CLASSIFICATIONS.includes(item.workClassification)) errors.push({ code: "INVALID_SCHEMA", path: `${path}.workClassification`, message: "Unsupported work classification." });
    if (item.conflictOverrides !== undefined) {
      if (!Array.isArray(item.conflictOverrides)) errors.push({ code: "INVALID_SCHEMA", path: `${path}.conflictOverrides`, message: "conflictOverrides must be an array." });
      else {
        if (item.conflictOverrides.length > 100) errors.push({ code: "EXCESSIVE_COUNT", path: `${path}.conflictOverrides`, message: "Too many conflict overrides." });
        const overrideKeysSeen = new Set();
        item.conflictOverrides.forEach((override, overrideIndex) => {
          const overridePath = `${path}.conflictOverrides[${overrideIndex}]`;
          if (!plain(override)) return errors.push({ code: "INVALID_SCHEMA", path: overridePath, message: "Conflict override must be a plain object." });
          Object.keys(override).filter((key) => !overrideKeys.has(key)).forEach((key) => errors.push({ code: "INVALID_SCHEMA", path: `${overridePath}.${key}`, message: "Unknown conflict override field." }));
          stringField(override.conflictKey, `${overridePath}.conflictKey`, errors, { required: true });
          stringField(override.reason, `${overridePath}.reason`, errors, { required: true });
          if (typeof override.reason === "string" && override.reason.trim().length < 10) errors.push({ code: "INVALID_SCHEMA", path: `${overridePath}.reason`, message: "Override reason must be at least 10 characters." });
          if (override.acknowledgedAt !== undefined && (typeof override.acknowledgedAt !== "string" || !/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d{1,3})?(?:Z|[+-]\d{2}:\d{2})$/.test(override.acknowledgedAt) || Number.isNaN(Date.parse(override.acknowledgedAt)))) errors.push({ code: "INVALID_SCHEMA", path: `${overridePath}.acknowledgedAt`, message: "acknowledgedAt must be an ISO timestamp." });
          if (overrideKeysSeen.has(override.conflictKey)) errors.push({ code: "DUPLICATE_ID", path: `${overridePath}.conflictKey`, message: "Duplicate conflict override key." });
          overrideKeysSeen.add(override.conflictKey);
        });
      }
    }
  });

  validateCollection(state, "vehicleHandoverNotes", handoverKeys, errors, warnings, (item, path) => {
    if (!dayIds.has(item.scheduleDayId)) errors.push({ code: "UNKNOWN_REFERENCE", path: `${path}.scheduleDayId`, message: "Unknown schedule day." });
    if (!vehicleIds.has(item.vehicleId)) errors.push({ code: "UNKNOWN_REFERENCE", path: `${path}.vehicleId`, message: "Unknown vehicle." });
    ["fromDriverId", "toDriverId"].forEach((field) => { if (item[field] && !driverIds.has(item[field])) errors.push({ code: "UNKNOWN_REFERENCE", path: `${path}.${field}`, message: "Unknown driver." }); });
    if (!Array.isArray(item.visibleToDriverIds)) errors.push({ code: "INVALID_SCHEMA", path: `${path}.visibleToDriverIds`, message: "Visible drivers must be an array." });
    else item.visibleToDriverIds.forEach((id) => { if (!driverIds.has(id)) errors.push({ code: "UNKNOWN_REFERENCE", path: `${path}.visibleToDriverIds`, message: "Unknown visible driver." }); });
    finiteOptional(item.sortOrder, `${path}.sortOrder`, errors);
    ["scheduleDayId", "vehicleId", "fromDriverId", "toDriverId", "location", "instruction", "keyLocation", "time", "notes"].forEach((field) => { if (item[field] !== undefined) stringField(item[field], `${path}.${field}`, errors); });
    if (typeof item.time === "string" && item.time && !parseStrictTime(item.time).ok) errors.push({ code: "INVALID_SCHEMA", path: `${path}.time`, message: "Invalid handover time." });
  });

  validateCollection(state, "importantInfoItems", infoKeys, errors, warnings, (item, path) => {
    if (!infoTypes.has(item.type)) errors.push({ code: "INVALID_SCHEMA", path: `${path}.type`, message: "Unsupported information type." });
    finiteOptional(item.sortOrder, `${path}.sortOrder`, errors);
    [...infoKeys].filter((field) => !["id", "sortOrder"].includes(field)).forEach((field) => { if (item[field] !== undefined) stringField(item[field], `${path}.${field}`, errors); });
  });

  if (state.routeNotes !== undefined) validateCollection(state, "routeNotes", routeKeys, errors, warnings, (item, path) => {
    finiteOptional(item.sortOrder, `${path}.sortOrder`, errors);
    [...routeKeys].filter((field) => !["id", "sortOrder"].includes(field)).forEach((field) => { if (item[field] !== undefined) stringField(item[field], `${path}.${field}`, errors); });
  });
  return { ok: errors.length === 0, errors, warnings };
}
