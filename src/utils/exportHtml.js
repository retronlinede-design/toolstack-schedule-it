import { calculateWorkingTimeSummary, sortMovementsByDateAndTime } from "./calculations";
import { formatLongDate } from "./time";

const EMPTY = "-";

const viewNames = {
  executive: "Executive Programme",
  executiveCg: "CG Programme",
  executiveMarida: "Marida Programme",
  operational: "Operational Schedule",
  driver: "Driver Schedule",
  workingTime: "Working Time Summary",
  importantInfo: "Important Information",
};

const orientations = {
  executive: "portrait",
  executiveCg: "portrait",
  executiveMarida: "portrait",
  operational: "landscape",
  driver: "landscape",
  workingTime: "landscape",
  importantInfo: "portrait",
};

function escapeHtml(value) {
  return String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function lookup(items) {
  return new Map(items.map((item) => [item.id, item]));
}

function dateLabel(schedule) {
  const dates = schedule.scheduleDays.map((day) => day.date).filter(Boolean).sort();
  if (dates.length === 0) return "No schedule date";
  if (dates[0] === dates[dates.length - 1]) return formatLongDate(dates[0]);
  return `${formatLongDate(dates[0])} - ${formatLongDate(dates[dates.length - 1])}`;
}

function movementsWithDays(schedule) {
  const daysById = lookup(schedule.scheduleDays);
  return schedule.movements.map((movement) => ({
    ...movement,
    day: daysById.get(movement.scheduleDayId),
  }));
}

function timeRange(...times) {
  const values = times.filter(Boolean);
  if (values.length === 0) return EMPTY;
  if (values.length === 1) return values[0];
  return `${values[0]}-${values[values.length - 1]}`;
}

function movementLabel(value) {
  const text = value || "";
  if (text.toLowerCase().includes("transfer")) return "Transfer";
  if (text.toLowerCase().includes("meeting")) return "Meeting";
  if (text.toLowerCase().includes("driver start")) return "Standby";
  if (text.toLowerCase().includes("end of duty")) return "End of Duty";
  return text || EMPTY;
}

function table(headers, rows, className = "") {
  if (rows.length === 0) {
    return `<p class="empty">No records available for this view.</p>`;
  }

  const headerHtml = headers.map((header) => `<th>${escapeHtml(header)}</th>`).join("");
  const rowsHtml = rows
    .map((row) => `<tr>${row.map((cell) => `<td class="${cell.className || ""}">${escapeHtml(cell.value || EMPTY)}</td>`).join("")}</tr>`)
    .join("");

  return `<table class="${className}"><thead><tr>${headerHtml}</tr></thead><tbody>${rowsHtml}</tbody></table>`;
}

function cell(value, className = "") {
  return { value, className };
}

function operationalHeaders() {
  return ["Driver Start", "Departure", "Arrival", "End", "Engagement", "Venue", "Address", "Location Notes", "Parking", "Participants", "Driver", "Vehicle"];
}

function isExecutiveView(view) {
  return view === "executive" || view === "executiveCg" || view === "executiveMarida";
}

function personMatches(movement, view) {
  if (view === "executive") return true;

  const participants = (movement.participants || "").toLowerCase();
  if (view === "executiveCg") {
    return participants.includes("cg") || participants.includes("consul-general") || participants.includes("consul general");
  }
  if (view === "executiveMarida") return participants.includes("marida");
  return true;
}

function isTransfer(movement) {
  const text = `${movement.engagementDetails || ""} ${movementLabel(movement.engagementDetails)}`.toLowerCase();
  return text.includes("transfer");
}

function meaningfulEventTimes(movement) {
  const eventStart = movement.eventStartTime || "";
  const eventEnd = movement.eventEndTime || "";
  const hasExplicitEventStart = eventStart && eventStart !== movement.departureTime;
  const hasExplicitEventEnd = eventEnd && eventEnd !== movement.endTime;
  const hasOnlyEventTimes = (eventStart || eventEnd) && !movement.departureTime && !movement.arrivalTime && !movement.endTime;

  return hasExplicitEventStart || hasExplicitEventEnd || hasOnlyEventTimes ? [eventStart, eventEnd].filter(Boolean) : [];
}

function executiveTimeDisplay(movement) {
  const eventTimes = meaningfulEventTimes(movement);
  if (eventTimes.length > 0) {
    return {
      display: timeRange(...eventTimes),
      needsConfirmation: eventTimes.length < 2,
    };
  }

  const preferredTimes = isTransfer(movement)
    ? [movement.departureTime, movement.arrivalTime].filter(Boolean)
    : [movement.arrivalTime, movement.endTime].filter(Boolean);
  const fallbackTimes = [movement.departureTime, movement.arrivalTime, movement.endTime].filter(Boolean);
  const times = preferredTimes.length > 0 ? preferredTimes : fallbackTimes;

  return {
    display: timeRange(...times),
    needsConfirmation: times.length < 2,
  };
}

function executiveNotes(movement, needsConfirmation) {
  return [movement.locationNotes, needsConfirmation ? "Timing to confirm" : ""].filter(Boolean).join("\n");
}

function executiveRows(movements, driversById, vehiclesById) {
  return movements.map((movement) => {
    const time = executiveTimeDisplay(movement);

    return [
      cell(time.display, "time-cell"),
      cell(movement.engagementDetails, "details-cell"),
      cell(movement.venue, "venue-cell"),
      cell(movement.address, "address-cell"),
      cell(driversById.get(movement.driverId)?.name),
      cell(vehiclesById.get(movement.vehicleId)?.name),
      cell(executiveNotes(movement, time.needsConfirmation), "wrap-cell"),
    ];
  });
}

function executiveEmptyMessage(view, hasExecutiveRows) {
  if ((view === "executiveCg" || view === "executiveMarida") && hasExecutiveRows) {
    return "No programme items matched this person. Add the person name to Participants.";
  }
  return "No records available for this view.";
}

function executiveTable(schedule, view = "executive") {
  const driversById = lookup(schedule.drivers);
  const vehiclesById = lookup(schedule.vehicles);
  const executiveMovements = movementsWithDays(schedule).filter((movement) => movement.isExecutiveVisible !== false);
  const movements = sortMovementsByDateAndTime(executiveMovements.filter((movement) => personMatches(movement, view)));

  if (movements.length === 0) return `<p class="empty">${escapeHtml(executiveEmptyMessage(view, executiveMovements.length > 0))}</p>`;

  const dayGroups = [];
  const dayGroupsByKey = new Map();

  movements.forEach((movement) => {
    const dayKey = movement.day?.id || movement.day?.date || "unscheduled";
    if (!dayGroupsByKey.has(dayKey)) {
      const group = {
        key: dayKey,
        day: movement.day,
        movements: [],
      };
      dayGroupsByKey.set(dayKey, group);
      dayGroups.push(group);
    }
    dayGroupsByKey.get(dayKey).movements.push(movement);
  });

  return dayGroups
    .map((dayGroup, index) => {
      const dayTitle = dayGroup.day?.title ? `<div class="executive-day-title">${escapeHtml(dayGroup.day.title)}</div>` : "";
      return `
        <section class="executive-day-section${index === 0 ? " first-day-section" : ""}">
          <div class="executive-day-heading">
            <div class="executive-day-date">${escapeHtml(formatLongDate(dayGroup.day?.date) || "Unscheduled")}</div>
            ${dayTitle}
          </div>
          ${table(["Time", "Engagement / Movement", "Venue", "Address", "Driver", "Vehicle", "Notes"], executiveRows(dayGroup.movements, driversById, vehiclesById), "executive-table")}
        </section>
      `;
    })
    .join("");
}

function operationalMovementRows(movements, driversById, vehiclesById) {
  return movements.map((movement) => [
    cell(movement.driverStart, "time-cell"),
    cell(movement.departureTime, "time-cell"),
    cell(movement.arrivalTime, "time-cell"),
    cell(movement.endTime, "time-cell"),
    cell(movement.engagementDetails, "details-cell"),
    cell(movement.venue, "venue-cell"),
    cell(movement.address, "address-cell small-cell"),
    cell(movement.locationNotes, "wrap-cell"),
    cell(movement.parking, "wrap-cell"),
    cell(movement.participants, "wrap-cell"),
    cell(driversById.get(movement.driverId)?.name),
    cell(vehiclesById.get(movement.vehicleId)?.name),
  ]);
}

function groupOperationalMovements(movements, driversById, vehiclesById, groupByDriver) {
  const dayGroups = [];
  const dayGroupsByKey = new Map();

  movements.forEach((movement) => {
    const dayKey = movement.day?.id || movement.day?.date || "unscheduled";
    if (!dayGroupsByKey.has(dayKey)) {
      const group = {
        key: dayKey,
        day: movement.day,
        driverGroups: [],
        driverGroupsByKey: new Map(),
      };
      dayGroupsByKey.set(dayKey, group);
      dayGroups.push(group);
    }

    const dayGroup = dayGroupsByKey.get(dayKey);
    const driverKey = groupByDriver ? movement.driverId || "unassigned" : "all";
    if (!dayGroup.driverGroupsByKey.has(driverKey)) {
      const driver = driversById.get(movement.driverId);
      const vehicle = vehiclesById.get(movement.vehicleId);
      const group = {
        key: driverKey,
        label: `${driver?.name || EMPTY} / ${vehicle?.name || EMPTY}`,
        driverId: movement.driverId,
        movements: [],
      };
      dayGroup.driverGroupsByKey.set(driverKey, group);
      dayGroup.driverGroups.push(group);
    }

    dayGroup.driverGroupsByKey.get(driverKey).movements.push(movement);
  });

  return dayGroups;
}

function handoverRowsFor(schedule, scheduleDayId, driverId) {
  const driversById = lookup(schedule.drivers);
  const vehiclesById = lookup(schedule.vehicles);

  return [...(schedule.vehicleHandoverNotes || [])]
    .filter((note) => note.scheduleDayId === scheduleDayId)
    .filter((note) => !driverId || handoverVisibleToDriver(note, driverId))
    .sort((a, b) => (a.sortOrder ?? Number.MAX_SAFE_INTEGER) - (b.sortOrder ?? Number.MAX_SAFE_INTEGER))
    .map((note) => [
      cell(note.time, "time-cell"),
      cell(vehiclesById.get(note.vehicleId)?.name, "total-cell"),
      cell(driversById.get(note.fromDriverId)?.name),
      cell(driversById.get(note.toDriverId)?.name),
      cell(note.location),
      cell(note.instruction, "wrap-cell"),
      cell(note.keyLocation),
      cell(note.notes, "wrap-cell"),
    ]);
}

function handoverVisibleToDriver(note, driverId) {
  return (
    (Array.isArray(note.visibleToDriverIds) && note.visibleToDriverIds.includes(driverId)) ||
    note.fromDriverId === driverId ||
    note.toDriverId === driverId
  );
}

function handoverTable(schedule, scheduleDayId, driverId) {
  const rows = handoverRowsFor(schedule, scheduleDayId, driverId);
  if (rows.length === 0) return "";

  return `
    <section class="handover-section">
      <h3 class="handover-heading">Vehicle Handover / Car Location</h3>
      ${table(["Time", "Vehicle", "From Driver", "To Driver", "Location", "Instruction", "Key Location", "Notes"], rows, "handover-table")}
    </section>
  `;
}

function ensureOperationalHandoverDayGroups(dayGroups, schedule, driverId) {
  const groupsByKey = new Map(dayGroups.map((group) => [group.key, group]));

  (schedule.vehicleHandoverNotes || [])
    .filter((note) => !driverId || handoverVisibleToDriver(note, driverId))
    .forEach((note) => {
      const day = schedule.scheduleDays.find((item) => item.id === note.scheduleDayId);
      const dayKey = note.scheduleDayId || day?.date || "unscheduled";
      if (!groupsByKey.has(dayKey)) {
        const group = {
          key: dayKey,
          day,
          driverGroups: [],
          driverGroupsByKey: new Map(),
        };
        groupsByKey.set(dayKey, group);
        dayGroups.push(group);
      }
    });

  return dayGroups;
}

function operationalSections(schedule, driverId, groupByDriver) {
  const driversById = lookup(schedule.drivers);
  const vehiclesById = lookup(schedule.vehicles);
  const movements = sortMovementsByDateAndTime(
    movementsWithDays(schedule).filter((movement) => movement.isOperationalVisible !== false && (!driverId || movement.driverId === driverId)),
  );

  const visibleHandovers = (schedule.vehicleHandoverNotes || []).filter(
    (note) => !driverId || handoverVisibleToDriver(note, driverId),
  );

  if (movements.length === 0 && visibleHandovers.length === 0) return `<p class="empty">No records available for this view.</p>`;

  return ensureOperationalHandoverDayGroups(groupOperationalMovements(movements, driversById, vehiclesById, groupByDriver), schedule, driverId)
    .map((dayGroup, index) => {
      const dayTitle = dayGroup.day?.title ? `<div class="day-title">${escapeHtml(dayGroup.day.title)}</div>` : "";
      const driverSections = dayGroup.driverGroups
        .map((driverGroup) => {
          const driverHeading = groupByDriver ? `<div class="driver-section-heading">${escapeHtml(driverGroup.label)}</div>` : "";
          return `
            <section class="driver-section">
              ${driverHeading}
              ${table(operationalHeaders(), operationalMovementRows(driverGroup.movements, driversById, vehiclesById), "operational-table compact-table")}
            </section>
          `;
        })
        .join("");

      return `
        <section class="day-section${index === 0 ? " first-day-section" : ""}">
          <div class="day-heading">
            <div class="day-date">${escapeHtml(formatLongDate(dayGroup.day?.date) || "Unscheduled")}</div>
            ${dayTitle}
          </div>
          ${driverSections}
          ${handoverTable(schedule, dayGroup.day?.id || dayGroup.key, driverId)}
        </section>
      `;
    })
    .join("");
}

function operationalTable(schedule) {
  return operationalSections(schedule, null, true);
}

function driverInfo(schedule, selectedDriverId) {
  const driver = schedule.drivers.find((item) => item.id === selectedDriverId) || schedule.drivers[0];
  const vehicle = schedule.vehicles.find((item) => item.id === driver?.defaultVehicle);
  return { driver, vehicle };
}

function driverTable(schedule, selectedDriverId) {
  const { driver } = driverInfo(schedule, selectedDriverId);
  return operationalSections(schedule, driver?.id, false);
}

function workingTimeTable(schedule) {
  const { driverDaySummaries, dailyTotals, overallDriverTotals } = calculateWorkingTimeSummary(
    schedule.movements,
    schedule.drivers,
    schedule.vehicles,
    schedule.scheduleDays,
  );

  if (driverDaySummaries.length === 0) return `<p class="empty">No records available for this view.</p>`;

  const totalsByDriver = new Map(overallDriverTotals.map((summary) => [summary.driverId, summary]));
  const driverGroups = [
    ...driverDaySummaries
      .reduce((groups, summary) => {
        if (!groups.has(summary.driverId)) {
          groups.set(summary.driverId, {
            driverId: summary.driverId,
            driverName: summary.driverName,
            vehicleName: summary.vehicleName,
            total: totalsByDriver.get(summary.driverId),
            days: [],
          });
        }
        groups.get(summary.driverId).days.push(summary);
        return groups;
      }, new Map())
      .values(),
  ];

  const dailyRows = dailyTotals.map((summary) => [
    cell(formatLongDate(summary.date)),
    cell(summary.driverCount),
    cell(summary.totalDuration, "total-cell"),
    cell(summary.overtimeDuration, "total-cell"),
    cell(summary.shortRestCount),
  ]);
  const driverSections = driverGroups
    .map((group) => {
      const dayRows = group.days.map((summary) => [
        cell(formatLongDate(summary.date)),
        cell(summary.startTime, "time-cell"),
        cell(summary.endTime, "time-cell"),
        cell(summary.totalDuration, "total-cell"),
        cell(summary.overtimeDuration, "total-cell"),
        cell(summary.restDuration, summary.shortRest ? "short-rest-cell" : ""),
        cell(summary.notes?.join(", ") || "-"),
      ]);

      return `
        <section class="working-driver-section">
          <div class="working-driver-heading">
            <div>
              <span>Driver</span>
              <h3>${escapeHtml(group.driverName)}</h3>
            </div>
            <strong>Vehicle: ${escapeHtml(group.vehicleName || EMPTY)}</strong>
          </div>
          <div class="working-driver-summary">
            <div><span>Total Duty Time</span><strong>${escapeHtml(group.total?.totalDuration || EMPTY)}</strong></div>
            <div><span>Overtime After 16:30</span><strong>${escapeHtml(group.total?.overtimeDuration || EMPTY)}</strong></div>
            <div class="${Number(group.total?.shortRestCount) > 0 ? "metric-alert" : ""}"><span>Short Rest Count</span><strong>${escapeHtml(group.total?.shortRestCount ?? EMPTY)}</strong></div>
            <div class="${Number(group.total?.shortRestCount) > 0 ? "metric-alert" : ""}"><span>Minimum Rest Period</span><strong>${escapeHtml(group.total?.minimumRestDuration || EMPTY)}</strong></div>
          </div>
          ${table(["Date", "Start", "End", "Duty Time", "Overtime After 16:30", "Rest Since Previous Duty", "Notes"], dayRows, "summary-table working-driver-breakdown")}
        </section>
      `;
    })
    .join("");

  return `
    ${driverSections}
    <section class="summary-section daily-total-section">
      <h3>Daily Totals</h3>
      ${table(["Date", "Drivers", "Total Duty Time", "Overtime After 16:30", "Short Rest Count"], dailyRows, "summary-table")}
    </section>
  `;
}

function importantInfoDetail(label, value) {
  if (!value) return "";
  return `
    <div class="important-info-detail">
      <span>${escapeHtml(label)}</span>
      <strong>${escapeHtml(value)}</strong>
    </div>
  `;
}

function importantInfoCard(item) {
  return `
    <article class="important-info-card">
      <div class="important-info-card-header">
        <span class="important-info-type">${escapeHtml(item.type || "Note")}</span>
        <h3>${escapeHtml(item.title || item.name || item.from || item.address || "Important Information")}</h3>
      </div>
      <div class="important-info-details">
        ${importantInfoDetail("From", item.from)}
        ${importantInfoDetail("To", item.to)}
        ${importantInfoDetail("Distance", item.distance)}
        ${importantInfoDetail("Estimated Travel Time", item.estimatedTravelTime)}
      </div>
      ${item.address ? `<div class="important-info-address">${escapeHtml(item.address)}</div>` : ""}
      ${item.notes ? `<div class="important-info-notes">${escapeHtml(item.notes)}</div>` : ""}
    </article>
  `;
}

function importantInfoSections(schedule) {
  const typeOrder = ["Route", "Contact", "Address", "Note"];
  const items = [...(schedule.importantInfoItems || [])].sort(
    (a, b) => (a.sortOrder ?? Number.MAX_SAFE_INTEGER) - (b.sortOrder ?? Number.MAX_SAFE_INTEGER),
  );

  if (items.length === 0) return `<p class="empty">No records available for this view.</p>`;

  return typeOrder
    .map((type) => {
      const typeItems = items.filter((item) => (item.type || "Note") === type);
      if (typeItems.length === 0) return "";

      return `
        <section class="important-info-section">
          <h3 class="important-info-section-heading">${escapeHtml(type)}</h3>
          <div class="important-info-card-list">
            ${typeItems.map(importantInfoCard).join("")}
          </div>
        </section>
      `;
    })
    .join("");
}

function bodyForView(schedule, view, selectedDriverId) {
  if (isExecutiveView(view)) return executiveTable(schedule, view);
  if (view === "operational") return operationalTable(schedule);
  if (view === "driver") return driverTable(schedule, selectedDriverId);
  if (view === "importantInfo") return importantInfoSections(schedule);
  return workingTimeTable(schedule);
}

function headerTitle(schedule, view, selectedDriverId) {
  if (view !== "driver") return schedule.profile.documentTitle;
  const { driver, vehicle } = driverInfo(schedule, selectedDriverId);
  return `${schedule.profile.documentTitle}${driver ? ` - ${driver.name}` : ""}${vehicle ? ` / ${vehicle.name}` : ""}`;
}

function driverHeading(schedule, view, selectedDriverId) {
  if (view !== "driver") return "";
  const { driver, vehicle } = driverInfo(schedule, selectedDriverId);
  return `
    <div class="driver-heading">
      <strong>Driver:</strong> ${escapeHtml(driver?.name || EMPTY)}
      <span><strong>Vehicle:</strong> ${escapeHtml(vehicle?.name || EMPTY)}</span>
    </div>
  `;
}

function stylesFor(view) {
  const isExecutive = isExecutiveView(view);
  const isPortrait = view === "executive" || view === "importantInfo";
  const fontSize = isExecutive ? "11.5px" : "8.5px";
  const padding = isExecutive ? "9px 10px" : "5px 6px";

  return `
    * { box-sizing: border-box; }
    body {
      font-family: Arial, Helvetica, sans-serif;
      color: #171717;
      margin: 0;
      background: #ffffff;
      line-height: 1.35;
    }
    .page {
      width: 100%;
      max-width: ${isPortrait ? "190mm" : "277mm"};
      margin: 0 auto;
      padding: 10mm 8mm;
    }
    button, input, select, textarea, nav, .no-print { display: none !important; }
    header {
      border-bottom: 2px solid #171717;
      margin-bottom: 14px;
      padding-bottom: 10px;
    }
    h1 {
      font-size: ${isExecutive ? "22px" : "18px"};
      margin: 0;
      text-transform: uppercase;
      letter-spacing: .04em;
      font-weight: 800;
    }
    h2 {
      font-size: ${isExecutive ? "15px" : "13px"};
      margin: 5px 0 8px;
      color: #404040;
      text-transform: uppercase;
      letter-spacing: .04em;
    }
    .meta {
      display: flex;
      flex-wrap: wrap;
      gap: 10px 16px;
      font-size: 10px;
      color: #525252;
    }
    .meta-label {
      font-weight: 800;
      color: #171717;
    }
    .subtitle {
      font-weight: 700;
      color: #171717;
    }
    .driver-heading {
      margin: 0 0 12px;
      padding: 8px 10px;
      border: 1px solid #d4d4d4;
      background: #fafafa;
      font-size: 11px;
    }
    .driver-heading span { margin-left: 18px; }
    .day-section {
      margin: 0 0 16px;
      break-inside: avoid;
      page-break-inside: avoid;
    }
    .day-heading {
      margin: 0 0 8px;
      padding: 7px 9px;
      border: 1px solid #bdbdbd;
      background: #f3f3f3;
      break-after: avoid;
      page-break-after: avoid;
    }
    .day-date {
      font-size: 10px;
      font-weight: 800;
      text-transform: uppercase;
      letter-spacing: .05em;
      color: #171717;
    }
    .day-title {
      margin-top: 2px;
      font-size: 9px;
      font-weight: 700;
      color: #525252;
    }
    .driver-section {
      margin: 0 0 10px;
      break-inside: avoid;
      page-break-inside: avoid;
    }
    .driver-section-heading {
      margin: 0 0 4px;
      padding: 5px 7px;
      background: #fafafa;
      border: 1px solid #d4d4d4;
      font-size: 8.5px;
      font-weight: 800;
      text-transform: uppercase;
      letter-spacing: .04em;
      color: #262626;
      break-after: avoid;
      page-break-after: avoid;
    }
    table {
      width: 100%;
      max-width: 100%;
      border-collapse: collapse;
      table-layout: fixed;
      font-size: ${fontSize};
      page-break-inside: auto;
    }
    th, td {
      border: 1px solid #d4d4d4;
      padding: ${padding};
      text-align: left;
      vertical-align: top;
      overflow-wrap: anywhere;
      word-break: normal;
      white-space: pre-line;
    }
    th {
      background: #eeeeee;
      font-size: ${isExecutive ? "9px" : "7.5px"};
      text-transform: uppercase;
      letter-spacing: .05em;
      font-weight: 800;
      color: #262626;
    }
    tr { break-inside: avoid; page-break-inside: avoid; }
    tbody tr:nth-child(even) td { background: #fafafa; }
    .time-cell {
      text-align: center;
      white-space: nowrap;
      font-variant-numeric: tabular-nums;
      font-weight: 700;
    }
    .movement-cell { font-weight: 700; }
    .venue-cell { font-weight: 800; }
    .address-cell, .small-cell { font-size: ${isExecutive ? "10px" : "7.8px"}; color: #525252; }
    .wrap-cell { white-space: normal; }
    .total-cell { font-weight: 800; }
    .executive-page header {
      border-bottom: 1px solid #171717;
      margin-bottom: 20px;
      padding-bottom: 14px;
      text-align: center;
    }
    .executive-page h1 {
      color: #404040;
      font-size: 11px;
      line-height: 1.25;
      letter-spacing: .08em;
      font-weight: 800;
    }
    .executive-page h2 {
      margin: 6px 0 8px;
      color: #171717;
      font-size: 25px;
      line-height: 1.1;
      letter-spacing: .06em;
      font-weight: 900;
    }
    .executive-page .meta {
      justify-content: center;
      gap: 8px 14px;
      font-size: 10px;
      color: #525252;
    }
    .executive-page .meta-label {
      color: #737373;
      font-weight: 700;
    }
    .executive-day-section {
      margin: 0 0 20px;
      break-inside: avoid;
      page-break-inside: avoid;
    }
    .executive-day-heading {
      margin: 0 0 8px;
      padding: 9px 0 7px;
      border-top: 1px solid #171717;
      border-bottom: 1px solid #d4d4d4;
      background: #ffffff;
      break-after: avoid;
      page-break-after: avoid;
    }
    .executive-day-date {
      font-size: 11px;
      font-weight: 800;
      text-transform: uppercase;
      letter-spacing: .08em;
      color: #171717;
    }
    .executive-day-title {
      margin-top: 3px;
      font-size: 10.5px;
      font-weight: 700;
      color: #525252;
    }
    .executive-table {
      border-collapse: collapse;
      border-top: 1px solid #bdbdbd;
      border-bottom: 1px solid #bdbdbd;
      font-size: 11.5px;
      line-height: 1.45;
    }
    .executive-table th,
    .executive-table td {
      border-left: 0;
      border-right: 0;
      border-top: 0;
      border-bottom: 1px solid #e5e5e5;
      padding: 10px 9px;
      background: #ffffff;
    }
    .executive-table th {
      border-bottom: 1px solid #bdbdbd;
      background: #ffffff;
      color: #525252;
      font-size: 8.5px;
      letter-spacing: .08em;
      font-weight: 800;
    }
    .executive-table tbody tr:nth-child(even) td {
      background: #ffffff;
    }
    .executive-table tbody tr:last-child td {
      border-bottom: 0;
    }
    .executive-table .time-cell {
      color: #171717;
      font-size: 11px;
      font-weight: 900;
    }
    .executive-table .movement-cell {
      color: #404040;
      font-size: 10px;
      font-weight: 800;
      text-transform: uppercase;
      letter-spacing: .04em;
    }
    .executive-table .details-cell {
      color: #171717;
      font-size: 12px;
      font-weight: 700;
    }
    .executive-table .venue-cell {
      color: #171717;
      font-weight: 900;
    }
    .executive-table .address-cell {
      color: #666666;
      font-size: 10px;
      line-height: 1.35;
    }
    .executive-page footer {
      margin-top: 18px;
      border-top: 1px solid #e5e5e5;
      padding-top: 7px;
      color: #8a8a8a;
      font-size: 8px;
      text-align: center;
    }
    .executive-table th:nth-child(1), .executive-table td:nth-child(1) { width: 13%; }
    .executive-table th:nth-child(2), .executive-table td:nth-child(2) { width: 25%; }
    .executive-table th:nth-child(3), .executive-table td:nth-child(3) { width: 17%; }
    .executive-table th:nth-child(4), .executive-table td:nth-child(4) { width: 16%; }
    .executive-table th:nth-child(5), .executive-table td:nth-child(5) { width: 9%; }
    .executive-table th:nth-child(6), .executive-table td:nth-child(6) { width: 9%; }
    .executive-table th:nth-child(7), .executive-table td:nth-child(7) { width: 11%; }
    .compact-table th:nth-child(-n+4), .compact-table td:nth-child(-n+4) { width: 6.5%; }
    .compact-table th:nth-child(5), .compact-table td:nth-child(5) { width: 14%; }
    .compact-table th:nth-child(6), .compact-table td:nth-child(6) { width: 10%; }
    .compact-table th:nth-child(7), .compact-table td:nth-child(7) { width: 13%; }
    .compact-table th:nth-child(8), .compact-table td:nth-child(8) { width: 13%; }
    .compact-table th:nth-child(9), .compact-table td:nth-child(9) { width: 8%; }
    .compact-table th:nth-child(10), .compact-table td:nth-child(10) { width: 10%; }
    .compact-table th:nth-child(11), .compact-table td:nth-child(11) { width: 6%; }
    .compact-table th:nth-child(12), .compact-table td:nth-child(12) { width: 6%; }
    .summary-section {
      margin: 0 0 14px;
      break-inside: avoid;
      page-break-inside: avoid;
    }
    .summary-section h3 {
      margin: 0 0 6px;
      font-size: 10px;
      font-weight: 800;
      text-transform: uppercase;
      letter-spacing: .05em;
      color: #262626;
    }
    .summary-table th, .summary-table td { font-size: 11px; padding: 8px 10px; }
    .working-driver-section {
      margin: 0 0 16px;
      break-inside: avoid;
      page-break-inside: avoid;
    }
    .working-driver-heading {
      display: flex;
      justify-content: space-between;
      gap: 12px;
      margin: 0 0 8px;
      padding: 8px 10px;
      border: 1px solid #d4d4d4;
      background: #fafafa;
      break-after: avoid;
      page-break-after: avoid;
    }
    .working-driver-heading span {
      display: block;
      color: #737373;
      font-size: 8px;
      font-weight: 900;
      letter-spacing: .08em;
      text-transform: uppercase;
    }
    .working-driver-heading h3 {
      margin: 2px 0 0;
      color: #171717;
      font-size: 14px;
      line-height: 1.2;
    }
    .working-driver-heading strong {
      align-self: end;
      color: #525252;
      font-size: 10px;
    }
    .working-driver-summary {
      display: grid;
      grid-template-columns: repeat(4, minmax(0, 1fr));
      gap: 6px;
      margin: 0 0 8px;
      break-inside: avoid;
      page-break-inside: avoid;
    }
    .working-driver-summary div {
      border: 1px solid #d4d4d4;
      background: #ffffff;
      padding: 7px 8px;
    }
    .working-driver-summary span {
      display: block;
      color: #737373;
      font-size: 7px;
      font-weight: 900;
      letter-spacing: .05em;
      text-transform: uppercase;
    }
    .working-driver-summary strong {
      display: block;
      margin-top: 2px;
      color: #171717;
      font-size: 12px;
    }
    .working-driver-summary .metric-alert {
      border-color: #fecaca;
      background: #fef2f2;
    }
    .handover-section {
      margin: 8px 0 0;
      break-inside: avoid;
      page-break-inside: avoid;
    }
    .handover-heading {
      margin: 0 0 5px;
      color: #262626;
      font-size: 8.5px;
      font-weight: 900;
      letter-spacing: .06em;
      text-transform: uppercase;
      break-after: avoid;
      page-break-after: avoid;
    }
    .handover-table th,
    .handover-table td {
      font-size: 8px;
      padding: 5px 6px;
    }
    .handover-table th:nth-child(1), .handover-table td:nth-child(1) { width: 7%; }
    .handover-table th:nth-child(2), .handover-table td:nth-child(2) { width: 10%; }
    .handover-table th:nth-child(3), .handover-table td:nth-child(3) { width: 9%; }
    .handover-table th:nth-child(4), .handover-table td:nth-child(4) { width: 9%; }
    .handover-table th:nth-child(5), .handover-table td:nth-child(5) { width: 15%; }
    .handover-table th:nth-child(6), .handover-table td:nth-child(6) { width: 20%; }
    .handover-table th:nth-child(7), .handover-table td:nth-child(7) { width: 12%; }
    .handover-table th:nth-child(8), .handover-table td:nth-child(8) { width: 18%; }
    .short-rest-cell {
      color: #b91c1c;
      font-weight: 800;
    }
    .daily-total-section {
      margin-top: 18px;
      padding-top: 10px;
      border-top: 1px solid #d4d4d4;
    }
    .important-info-section {
      margin: 0 0 18px;
      break-inside: avoid;
      page-break-inside: avoid;
    }
    .important-info-section-heading {
      margin: 0 0 8px;
      padding: 0 0 5px;
      border-bottom: 1px solid #bdbdbd;
      color: #171717;
      font-size: 11px;
      font-weight: 900;
      letter-spacing: .08em;
      text-transform: uppercase;
      break-after: avoid;
      page-break-after: avoid;
    }
    .important-info-card-list {
      display: grid;
      gap: 9px;
    }
    .important-info-card {
      border: 1px solid #d4d4d4;
      border-radius: 4px;
      padding: 10px 11px;
      break-inside: avoid;
      page-break-inside: avoid;
    }
    .important-info-card-header {
      margin: 0 0 7px;
    }
    .important-info-type {
      display: inline-block;
      margin: 0 0 4px;
      color: #737373;
      font-size: 7.5px;
      font-weight: 900;
      letter-spacing: .1em;
      text-transform: uppercase;
    }
    .important-info-card h3 {
      margin: 0;
      color: #171717;
      font-size: 13px;
      line-height: 1.25;
      font-weight: 900;
    }
    .important-info-details {
      display: grid;
      grid-template-columns: repeat(2, minmax(0, 1fr));
      gap: 5px 12px;
      margin: 0;
    }
    .important-info-detail {
      border-top: 1px solid #eeeeee;
      padding-top: 5px;
    }
    .important-info-detail span {
      display: block;
      color: #737373;
      font-size: 7.5px;
      font-weight: 800;
      letter-spacing: .06em;
      text-transform: uppercase;
    }
    .important-info-detail strong {
      display: block;
      margin-top: 2px;
      color: #262626;
      font-size: 10px;
      line-height: 1.3;
    }
    .important-info-address {
      margin-top: 8px;
      border-top: 1px solid #eeeeee;
      padding-top: 7px;
      color: #525252;
      font-size: 9.5px;
      line-height: 1.4;
    }
    .important-info-notes {
      margin-top: 8px;
      border-top: 1px solid #eeeeee;
      padding-top: 7px;
      color: #171717;
      font-size: 10.5px;
      line-height: 1.45;
      font-weight: 700;
      white-space: pre-line;
    }
    .empty {
      border: 1px dashed #d4d4d4;
      padding: 24px;
      color: #737373;
      text-align: center;
      font-size: 12px;
    }
    footer {
      margin-top: 14px;
      font-size: 9px;
      color: #737373;
      text-align: right;
    }
    @page { size: A4 ${orientations[view]}; margin: 12mm; }
    @media print {
      body { -webkit-print-color-adjust: exact; print-color-adjust: exact; }
      .page { padding: 0; }
      .day-section:not(.first-day-section),
      .executive-day-section:not(.first-day-section) {
        break-before: page;
        page-break-before: always;
      }
      .day-heading,
      .executive-day-heading,
      .driver-section-heading,
      .handover-heading,
      .important-info-section-heading,
      .summary-section h3 {
        break-after: avoid;
        page-break-after: avoid;
      }
      .driver-section,
      .handover-section,
      .working-driver-section,
      .working-driver-summary,
      .important-info-section,
      .important-info-card,
      .summary-section {
        break-inside: avoid;
        page-break-inside: avoid;
      }
      thead { display: table-header-group; }
      tr {
        break-inside: avoid;
        page-break-inside: avoid;
      }
    }
  `;
}

export function getExportDocument(schedule, view, options = {}) {
  const generatedAt = new Date().toLocaleString();
  const title = viewNames[view];
  const isExecutive = isExecutiveView(view);
  const metaHtml = isExecutive
    ? `
          <span><span class="meta-label">Document:</span> ${escapeHtml(headerTitle(schedule, view, options.selectedDriverId))}</span>
          <span><span class="meta-label">Date:</span> ${escapeHtml(dateLabel(schedule))}</span>
        `
    : `
          <span>${escapeHtml(dateLabel(schedule))}</span>
          <span class="subtitle">${escapeHtml(title)}</span>
          <span>Generated ${escapeHtml(generatedAt)}</span>
        `;
  const headingHtml = `
    <div class="page${isExecutive ? " executive-page" : ""}">
      <header>
        <h1>${escapeHtml(schedule.profile.missionName)}</h1>
        <h2>${escapeHtml(isExecutive ? title : headerTitle(schedule, view, options.selectedDriverId))}</h2>
        <div class="meta">
          ${metaHtml}
        </div>
      </header>
      ${driverHeading(schedule, view, options.selectedDriverId)}
  `;
  const styles = stylesFor(view);
  const tableHtml = bodyForView(schedule, view, options.selectedDriverId);
  const footerHtml = "Generated by ScheduleIt";
  const bodyHtml = `${headingHtml}${tableHtml}<footer>${footerHtml}</footer></div>`;
  const fullHtml = `<!doctype html><html><head><meta charset="utf-8"><title>${escapeHtml(title)}</title><style>${styles}</style></head><body>${bodyHtml}</body></html>`;

  return {
    bodyHtml,
    fullHtml,
    orientation: orientations[view],
    styles,
    title,
  };
}
