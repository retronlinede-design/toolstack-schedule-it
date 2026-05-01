const TIME_PATTERN = /\b([01]?\d|2[0-3]):([0-5]\d)\b/g;

function normalizeText(value) {
  return (value || "").replace(/\u00a0/g, " ").replace(/\s+/g, " ").trim();
}

function normalizeHeader(value) {
  return normalizeText(value).toLowerCase();
}

function textFrom(element) {
  return normalizeText(element?.textContent || "");
}

function getHeaderIndexes(headers) {
  return headers.reduce((acc, header, index) => {
    acc[header] = index;
    return acc;
  }, {});
}

function findIndex(headerIndexes, names) {
  for (const name of names) {
    if (Number.isInteger(headerIndexes[name])) return headerIndexes[name];
  }
  return -1;
}

function getCell(cells, index) {
  if (index < 0) return "";
  return textFrom(cells[index]);
}

function extractTimes(value) {
  return [...normalizeText(value).matchAll(TIME_PATTERN)].map((match) => `${match[1].padStart(2, "0")}:${match[2]}`);
}

function looksDriverOnly(text) {
  const value = normalizeText(text).toLowerCase();
  return value.includes("driver start") || value.includes("standby") || value.includes("end of duty");
}

function detectTableType(headers) {
  const headerSet = new Set(headers);
  if (headerSet.has("total duty time") || headerSet.has("overtime")) return "workingTime";
  if (headerSet.has("driver start") || headerSet.has("departure") || headerSet.has("departure time")) return "operational";
  if (headerSet.has("engagement") || headerSet.has("engagement details")) return "operational";
  if (headerSet.has("time") && headerSet.has("movement") && headerSet.has("details")) return "executive";
  return "unsupported";
}

function parseHeaderMetadata(document) {
  const title = textFrom(document.querySelector("h2")) || "Imported HTML Schedule";
  const metaText = textFrom(document.querySelector(".meta")) || textFrom(document.body);
  const isoDate = metaText.match(/\b\d{4}-\d{2}-\d{2}\b/)?.[0] || "";

  return {
    title,
    date: isoDate,
  };
}

function parseOperationalRow(cells, indexes, sortOrder, warnings) {
  const driverName = getCell(cells, findIndex(indexes, ["driver"]));
  const vehicleName = getCell(cells, findIndex(indexes, ["vehicle"]));
  const movement = {
    sortOrder,
    driverName,
    vehicleName,
    driverStart: getCell(cells, findIndex(indexes, ["driver start"])),
    departureTime: getCell(cells, findIndex(indexes, ["departure", "departure time"])),
    arrivalTime: getCell(cells, findIndex(indexes, ["arrival", "arrival time"])),
    endTime: getCell(cells, findIndex(indexes, ["end", "end time"])),
    engagementDetails: getCell(cells, findIndex(indexes, ["engagement", "engagement details", "details"])),
    venue: getCell(cells, findIndex(indexes, ["venue"])),
    address: getCell(cells, findIndex(indexes, ["address"])),
    locationNotes: getCell(cells, findIndex(indexes, ["location notes"])),
    parking: getCell(cells, findIndex(indexes, ["parking"])),
    participants: getCell(cells, findIndex(indexes, ["participants"])),
    internalNotes: "",
    isExecutiveVisible: true,
    isOperationalVisible: true,
  };

  if (looksDriverOnly(movement.engagementDetails)) movement.isExecutiveVisible = false;
  if (!driverName) warnings.push(`Row ${sortOrder / 10}: driver could not be detected.`);
  if (!vehicleName) warnings.push(`Row ${sortOrder / 10}: vehicle could not be detected.`);
  if (!movement.driverStart && !movement.departureTime && !movement.arrivalTime && !movement.endTime) {
    warnings.push(`Row ${sortOrder / 10}: no timing field detected.`);
  }
  if (!movement.engagementDetails && !movement.venue) {
    warnings.push(`Row ${sortOrder / 10}: missing engagement details and venue.`);
  }

  return movement;
}

function parseExecutiveRow(cells, indexes, sortOrder, warnings) {
  const timeValue = getCell(cells, findIndex(indexes, ["time"]));
  const times = extractTimes(timeValue);
  const movementLabel = getCell(cells, findIndex(indexes, ["movement"]));
  const details = getCell(cells, findIndex(indexes, ["details"]));
  const engagementDetails = details || movementLabel;
  const isDriverOnly = looksDriverOnly(engagementDetails || movementLabel);

  warnings.push(`Row ${sortOrder / 10}: imported from Executive table; driver, vehicle, parking, and operational notes may be incomplete.`);

  return {
    sortOrder,
    driverName: "",
    vehicleName: "",
    driverStart: "",
    departureTime: times[0] || "",
    arrivalTime: times.length > 1 ? times[1] : "",
    endTime: "",
    engagementDetails,
    venue: getCell(cells, findIndex(indexes, ["venue"])),
    address: getCell(cells, findIndex(indexes, ["address"])),
    locationNotes: "",
    parking: "",
    participants: "",
    internalNotes: "",
    isExecutiveVisible: !isDriverOnly,
    isOperationalVisible: true,
  };
}

function uniqueNames(values) {
  return [...new Set(values.map(normalizeText).filter(Boolean))];
}

export function parseScheduleHtml(rawHtml) {
  const errors = [];
  const warnings = [];
  const raw = rawHtml || "";

  if (!raw.trim()) {
    return {
      scheduleDayDraft: { title: "Imported HTML Schedule", date: "" },
      movements: [],
      driversToAdd: [],
      vehiclesToAdd: [],
      warnings,
      errors: ["Paste HTML before parsing."],
    };
  }

  const document = new DOMParser().parseFromString(raw, "text/html");
  const scheduleDayDraft = parseHeaderMetadata(document);
  if (!scheduleDayDraft.date) warnings.push("Date could not be detected. The imported day will need a date.");

  const movements = [];
  const tables = [...document.querySelectorAll("table")];

  tables.forEach((tableElement) => {
    const headers = [...tableElement.querySelectorAll("thead th, tr:first-child th")].map((header) => normalizeHeader(textFrom(header)));
    const tableType = detectTableType(headers);
    if (tableType === "workingTime" || tableType === "unsupported") return;

    if (tableType === "executive") warnings.push("Executive table import is lossy. Review parsed movements before applying.");

    const indexes = getHeaderIndexes(headers);
    const rows = [...tableElement.querySelectorAll("tbody tr")];

    rows.forEach((row) => {
      const cells = [...row.querySelectorAll("td")];
      if (cells.length === 0) return;
      const sortOrder = (movements.length + 1) * 10;
      const movement =
        tableType === "executive"
          ? parseExecutiveRow(cells, indexes, sortOrder, warnings)
          : parseOperationalRow(cells, indexes, sortOrder, warnings);

      movements.push(movement);
    });
  });

  if (movements.length === 0) errors.push("No supported movement rows were found.");

  return {
    scheduleDayDraft,
    movements,
    driversToAdd: uniqueNames(movements.map((movement) => movement.driverName)),
    vehiclesToAdd: uniqueNames(movements.map((movement) => movement.vehicleName)),
    warnings,
    errors,
  };
}

