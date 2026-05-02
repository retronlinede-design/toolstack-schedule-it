import { useEffect, useMemo, useRef, useState } from "react";
import { Download, Play, Printer, X } from "lucide-react";
import ExportPanel from "./components/ExportPanel";
import PreviewTabs from "./components/PreviewTabs";
import ScheduleBuilder from "./components/ScheduleBuilder";
import { createMondayDemoState, defaultProfile } from "./data/defaultData";
import {
  createDraftFromMovement,
  createMovementFromDraft,
  createScheduleDayFromDraft,
  emptyDraft,
} from "./data/schema";
import { getEntriesByMonth, sortMovementsByDateAndTime } from "./utils/calculations";
import { getExportDocument } from "./utils/exportHtml";
import { downloadJson, loadScheduleState, normalizeState, saveScheduleState, validateScheduleState } from "./utils/storage";
import { getWeekday } from "./utils/time";

function createId(prefix) {
  return `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

function createInitialDraft(profile) {
  return {
    ...emptyDraft,
    missionName: profile.missionName,
    documentTitle: profile.documentTitle,
  };
}

function findOrCreateDay(scheduleDays, draft) {
  return scheduleDays.find((day) => day.id === draft.scheduleDayId);
}

function nextSortOrder(movements, scheduleDayId) {
  const dayOrders = movements
    .filter((movement) => movement.scheduleDayId === scheduleDayId)
    .map((movement) => movement.sortOrder)
    .filter(Number.isFinite);

  return dayOrders.length === 0 ? 10 : Math.max(...dayOrders) + 10;
}

function nextImportantInfoSortOrder(importantInfoItems) {
  const orders = importantInfoItems
    .map((item) => item.sortOrder)
    .filter(Number.isFinite);

  return orders.length === 0 ? 10 : Math.max(...orders) + 10;
}

function nameKey(value) {
  return (value || "").trim().toLowerCase();
}

function preserveClearedTimeFields(updatedMovement, previousMovement) {
  return {
    ...updatedMovement,
    eventStartTime:
      updatedMovement.departureTime === "" && updatedMovement.eventStartTime === previousMovement.departureTime
        ? ""
        : updatedMovement.eventStartTime || "",
    eventEndTime:
      updatedMovement.endTime === "" && updatedMovement.eventEndTime === previousMovement.endTime ? "" : updatedMovement.eventEndTime || "",
  };
}

const documentPreviewTabs = [
  { id: "executive", label: "Full Executive Programme" },
  { id: "executiveCg", label: "CG Programme" },
  { id: "executiveMarida", label: "Marida Programme" },
  { id: "operational", label: "Operational" },
  { id: "driver", label: "Driver" },
  { id: "workingTime", label: "Working Time" },
  { id: "importantInfo", label: "Important Info" },
];

export default function ScheduleItApp() {
  const previewFrameRef = useRef(null);
  const [schedule, setSchedule] = useState(() => loadScheduleState());
  const [draft, setDraft] = useState(() => createInitialDraft(loadScheduleState().profile));
  const [validationErrors, setValidationErrors] = useState({});
  const [isPreviewOpen, setIsPreviewOpen] = useState(false);
  const [isExportOpen, setIsExportOpen] = useState(false);
  const [previewView, setPreviewView] = useState("executive");
  const [selectedDriverId, setSelectedDriverId] = useState(() => loadScheduleState().drivers[0]?.id || "");

  useEffect(() => {
    saveScheduleState(schedule);
  }, [schedule]);

  const entriesByMonth = useMemo(
    () => getEntriesByMonth(schedule.scheduleDays, schedule.movements),
    [schedule.scheduleDays, schedule.movements],
  );
  const selectedDriver = schedule.drivers.find((driver) => driver.id === selectedDriverId) || schedule.drivers[0];
  const previewDocument = useMemo(
    () => getExportDocument(schedule, previewView, { selectedDriverId: selectedDriver?.id }),
    [schedule, previewView, selectedDriver?.id],
  );
  const previewSrcDoc = useMemo(
    () => `<!doctype html><html><head><meta charset="utf-8"><title>${previewDocument.title}</title><style>${previewDocument.styles}</style></head><body>${previewDocument.bodyHtml}</body></html>`,
    [previewDocument],
  );

  function updateDraft(nextDraft) {
    setDraft((current) => {
      const resolved = typeof nextDraft === "function" ? nextDraft(current) : nextDraft;
      return {
        ...resolved,
        weekday: getWeekday(resolved.date),
      };
    });
  }

  function resetDraft(profile = schedule.profile, scheduleDay) {
    setDraft({
      ...createInitialDraft(profile),
      scheduleDayId: scheduleDay?.id || null,
      dayTitle: scheduleDay?.title || "",
      date: scheduleDay?.date || "",
      weekday: getWeekday(scheduleDay?.date),
    });
    setValidationErrors({});
  }

  function validateDraft(value) {
    const errors = {};
    if (!value.scheduleDayId) errors.scheduleDayId = "Select or create a schedule day.";
    if (!value.driverId) errors.driverId = "Select a driver.";
    if (!value.vehicleId) errors.vehicleId = "Select a vehicle.";
    if (!value.driverStart && !value.departureTime && !value.arrivalTime && !value.endTime) {
      errors.timing = "Enter at least one timing field.";
    }
    if (!value.engagementDetails && !value.venue) {
      errors.engagementDetails = "Enter engagement details or a venue.";
    }
    return errors;
  }

  function handleSubmit() {
    const errors = validateDraft(draft);
    setValidationErrors(errors);
    if (Object.keys(errors).length > 0) return;

    setSchedule((current) => {
      const profile = {
        missionName: draft.missionName || defaultProfile.missionName,
        documentTitle: draft.documentTitle || defaultProfile.documentTitle,
      };
      const existingDay = findOrCreateDay(current.scheduleDays, draft);
      const day = createScheduleDayFromDraft(draft, existingDay);
      const movement = {
        ...createMovementFromDraft(draft, day.id),
        sortOrder: Number.isFinite(draft.sortOrder) ? draft.sortOrder : nextSortOrder(current.movements, day.id),
      };
      const scheduleDays = existingDay
        ? current.scheduleDays.map((item) => (item.id === day.id ? day : item))
        : [...current.scheduleDays, day];
      const movements = [...current.movements.filter((item) => item.id !== movement.id), movement];

      return {
        ...current,
        profile,
        scheduleDays,
        movements,
      };
    });

    resetDraft(
      {
        missionName: draft.missionName,
        documentTitle: draft.documentTitle,
      },
      {
        id: draft.scheduleDayId,
        title: draft.dayTitle,
        date: draft.date,
      },
    );
  }

  function handleCreateDay() {
    const errors = {};
    if (!draft.date) errors.date = "Enter a date before creating a day.";
    if (Object.keys(errors).length > 0) {
      setValidationErrors(errors);
      return;
    }

    const day = {
      id: createId("day"),
      date: draft.date,
      title: draft.dayTitle || draft.date,
    };

    setSchedule((current) => ({
      ...current,
      scheduleDays: [...current.scheduleDays, day],
    }));
    updateDraft((current) => ({
      ...current,
      scheduleDayId: day.id,
      dayTitle: day.title,
      date: day.date,
    }));
    setValidationErrors({});
  }

  function handleSelectDay(scheduleDayId) {
    const day = schedule.scheduleDays.find((item) => item.id === scheduleDayId);
    updateDraft((current) => ({
      ...current,
      scheduleDayId: day?.id || null,
      dayTitle: day?.title || "",
      date: day?.date || "",
    }));
    setValidationErrors((current) => ({ ...current, scheduleDayId: undefined }));
  }

  function handleUpdateDay() {
    if (!draft.scheduleDayId) {
      setValidationErrors((current) => ({ ...current, scheduleDayId: "Select a schedule day before updating it." }));
      return;
    }
    if (!draft.date) {
      setValidationErrors((current) => ({ ...current, date: "Enter a date before updating the day." }));
      return;
    }

    setSchedule((current) => ({
      ...current,
      scheduleDays: current.scheduleDays.map((day) =>
        day.id === draft.scheduleDayId
          ? {
              ...day,
              date: draft.date,
              title: draft.dayTitle || draft.date,
            }
          : day,
      ),
    }));
    setValidationErrors({});
  }

  function handleDuplicateDay() {
    const sourceDay = schedule.scheduleDays.find((day) => day.id === draft.scheduleDayId);
    if (!sourceDay) {
      setValidationErrors((current) => ({ ...current, scheduleDayId: "Select a schedule day before duplicating it." }));
      return;
    }

    const nextDay = {
      ...sourceDay,
      id: createId("day"),
      title: `${sourceDay.title || sourceDay.date} Copy`,
    };
    const copiedMovements = schedule.movements
      .filter((movement) => movement.scheduleDayId === sourceDay.id)
      .map((movement) => ({
        ...movement,
        id: createId("movement"),
        scheduleDayId: nextDay.id,
      }));

    setSchedule((current) => ({
      ...current,
      scheduleDays: [...current.scheduleDays, nextDay],
      movements: [...current.movements, ...copiedMovements],
    }));
    updateDraft((current) => ({
      ...current,
      scheduleDayId: nextDay.id,
      dayTitle: nextDay.title,
      date: nextDay.date,
    }));
  }

  function handleEdit(movement) {
    if (draft.engagementDetails && !window.confirm("Overwrite current form data to edit this entry?")) {
      return;
    }

    const day = schedule.scheduleDays.find((item) => item.id === movement.scheduleDayId);
    setDraft(createDraftFromMovement(movement, day, schedule.profile));
    setValidationErrors({});
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  function handleDuplicateMovement(movement) {
    const nextMovement = {
      ...movement,
      id: createId("movement"),
      sortOrder: nextSortOrder(schedule.movements, movement.scheduleDayId),
    };

    setSchedule((current) => ({
      ...current,
      movements: [...current.movements, nextMovement],
    }));
  }

  function handleUpdateMovement(updatedMovement) {
    setSchedule((current) => ({
      ...current,
      movements: current.movements.map((movement) =>
        movement.id === updatedMovement.id ? preserveClearedTimeFields(updatedMovement, movement) : movement,
      ),
    }));
  }

  function handleMoveMovement(id, direction) {
    setSchedule((current) => {
      const movement = current.movements.find((item) => item.id === id);
      if (!movement) return current;

      const day = current.scheduleDays.find((item) => item.id === movement.scheduleDayId);
      const orderedDayMovements = sortMovementsByDateAndTime(
        current.movements
          .filter((item) => item.scheduleDayId === movement.scheduleDayId)
          .map((item) => ({ ...item, day })),
      );
      const currentIndex = orderedDayMovements.findIndex((item) => item.id === id);
      const nextIndex = direction === "up" ? currentIndex - 1 : currentIndex + 1;

      if (currentIndex < 0 || nextIndex < 0 || nextIndex >= orderedDayMovements.length) return current;

      const reordered = [...orderedDayMovements];
      const [moved] = reordered.splice(currentIndex, 1);
      reordered.splice(nextIndex, 0, moved);

      const sortOrdersById = new Map(reordered.map((item, index) => [item.id, (index + 1) * 10]));

      return {
        ...current,
        movements: current.movements.map((item) =>
          item.scheduleDayId === movement.scheduleDayId
            ? {
                ...item,
                sortOrder: sortOrdersById.get(item.id),
              }
            : item,
        ),
      };
    });
  }

  function handleReorderOperationalMovements({ draggedId, targetId, scheduleDayId, driverId }) {
    if (!draggedId || !targetId || draggedId === targetId) return;

    setSchedule((current) => {
      const dragged = current.movements.find((item) => item.id === draggedId);
      const target = current.movements.find((item) => item.id === targetId);
      if (!dragged || !target) return current;
      if (dragged.scheduleDayId !== scheduleDayId || target.scheduleDayId !== scheduleDayId) return current;
      if (dragged.driverId !== driverId || target.driverId !== driverId) return current;

      const day = current.scheduleDays.find((item) => item.id === scheduleDayId);
      const orderedDayMovements = sortMovementsByDateAndTime(
        current.movements
          .filter((item) => item.scheduleDayId === scheduleDayId)
          .map((item) => ({ ...item, day })),
      );
      const dayMovementIds = orderedDayMovements.map((movement) => movement.id);
      const orderedDriverIds = orderedDayMovements.filter((movement) => movement.driverId === driverId).map((movement) => movement.id);
      const draggedIndex = orderedDriverIds.indexOf(draggedId);
      const targetIndex = orderedDriverIds.indexOf(targetId);
      if (draggedIndex < 0 || targetIndex < 0) return current;

      const reorderedDriverIds = [...orderedDriverIds];
      const [moved] = reorderedDriverIds.splice(draggedIndex, 1);
      reorderedDriverIds.splice(targetIndex, 0, moved);

      let driverCursor = 0;
      const nextDayMovementIds = dayMovementIds.map((id) => {
        const movement = current.movements.find((item) => item.id === id);
        if (movement?.driverId !== driverId) return id;
        const nextId = reorderedDriverIds[driverCursor];
        driverCursor += 1;
        return nextId;
      });
      const sortOrdersById = new Map(nextDayMovementIds.map((id, index) => [id, (index + 1) * 10]));

      return {
        ...current,
        movements: current.movements.map((movement) =>
          movement.scheduleDayId === scheduleDayId
            ? {
                ...movement,
                sortOrder: sortOrdersById.get(movement.id),
              }
            : movement,
        ),
      };
    });
  }

  function handleDelete(id) {
    if (!window.confirm("Are you sure you want to delete this event?")) return;

    setSchedule((current) => ({
      ...current,
      movements: current.movements.filter((movement) => movement.id !== id),
    }));
  }

  function handleSaveImportantInfoItem(infoDraft) {
    if (
      !infoDraft.type ||
      (!infoDraft.title &&
        !infoDraft.from &&
        !infoDraft.to &&
        !infoDraft.name &&
        !infoDraft.phone &&
        !infoDraft.email &&
        !infoDraft.address &&
        !infoDraft.notes)
    ) {
      return;
    }

    setSchedule((current) => {
      const item = {
        id: infoDraft.id || createId("info"),
        type: infoDraft.type || "Note",
        title: infoDraft.title || "",
        from: infoDraft.from || "",
        to: infoDraft.to || "",
        distance: infoDraft.distance || "",
        estimatedTravelTime: infoDraft.estimatedTravelTime || "",
        name: infoDraft.name || "",
        phone: infoDraft.phone || "",
        email: infoDraft.email || "",
        address: infoDraft.address || "",
        notes: infoDraft.notes || "",
        sortOrder: Number.isFinite(infoDraft.sortOrder)
          ? infoDraft.sortOrder
          : nextImportantInfoSortOrder(current.importantInfoItems || []),
      };

      return {
        ...current,
        importantInfoItems: [...(current.importantInfoItems || []).filter((currentItem) => currentItem.id !== item.id), item],
      };
    });
  }

  function handleDuplicateImportantInfoItem(item) {
    setSchedule((current) => ({
      ...current,
      importantInfoItems: [
        ...(current.importantInfoItems || []),
        {
          ...item,
          id: createId("info"),
          sortOrder: nextImportantInfoSortOrder(current.importantInfoItems || []),
        },
      ],
    }));
  }

  function handleMoveImportantInfoItem(id, direction) {
    setSchedule((current) => {
      const orderedItems = [...(current.importantInfoItems || [])].sort(
        (a, b) => (a.sortOrder ?? Number.MAX_SAFE_INTEGER) - (b.sortOrder ?? Number.MAX_SAFE_INTEGER),
      );
      const currentIndex = orderedItems.findIndex((item) => item.id === id);
      const nextIndex = direction === "up" ? currentIndex - 1 : currentIndex + 1;
      if (currentIndex < 0 || nextIndex < 0 || nextIndex >= orderedItems.length) return current;

      const reordered = [...orderedItems];
      const [moved] = reordered.splice(currentIndex, 1);
      reordered.splice(nextIndex, 0, moved);
      const sortOrdersById = new Map(reordered.map((item, index) => [item.id, (index + 1) * 10]));

      return {
        ...current,
        importantInfoItems: (current.importantInfoItems || []).map((item) =>
          sortOrdersById.has(item.id)
            ? {
                ...item,
                sortOrder: sortOrdersById.get(item.id),
              }
            : item,
        ),
      };
    });
  }

  function handleDeleteImportantInfoItem(id) {
    if (!window.confirm("Delete this important info item?")) return;

    setSchedule((current) => ({
      ...current,
      importantInfoItems: (current.importantInfoItems || []).filter((item) => item.id !== id),
    }));
  }

  function handleResetAll() {
    if (!window.confirm("Clear the current schedule and reset all fields?")) return;

    const nextSchedule = {
      ...schedule,
      profile: defaultProfile,
      scheduleDays: [],
      movements: [],
      importantInfoItems: [],
      routeNotes: [],
    };
    setSchedule(nextSchedule);
    resetDraft(nextSchedule.profile);
  }

  function handleLoadMondayDemo() {
    if (!window.confirm("Load the Monday demo schedule? This will replace the current schedule data.")) return;

    const nextSchedule = createMondayDemoState();
    setSchedule(nextSchedule);
    setSelectedDriverId("driver-greg");
    resetDraft(nextSchedule.profile, nextSchedule.scheduleDays[0]);
  }

  function handleExportJson() {
    downloadJson("mission-schedule-backup.json", schedule);
  }

  function printHtmlDocument(html) {
    const printWindow = window.open("", "_blank");
    if (!printWindow) return false;

    printWindow.document.open();
    printWindow.document.write(html);
    printWindow.document.close();
    printWindow.focus();
    printWindow.setTimeout(() => {
      printWindow.print();
    }, 100);
    return true;
  }

  function handlePrintView(view) {
    const { fullHtml } = getExportDocument(schedule, view, { selectedDriverId: selectedDriver?.id });
    const didOpen = printHtmlDocument(fullHtml);
    setIsExportOpen(false);
    if (!didOpen) window.alert("Could not open print window. Check your browser popup settings.");
  }

  async function handleCopyHtml(view) {
    const { fullHtml } = getExportDocument(schedule, view, { selectedDriverId: selectedDriver?.id });
    try {
      await navigator.clipboard.writeText(fullHtml);
      return "HTML copied to clipboard.";
    } catch {
      return "Could not copy HTML. Your browser may require clipboard permission.";
    }
  }

  async function handleImportJson(file) {
    let parsed;
    try {
      parsed = JSON.parse(await file.text());
    } catch {
      return "Import failed: invalid JSON file.";
    }

    if (!validateScheduleState(parsed)) {
      return "Import failed: file is not a valid ScheduleIt export.";
    }

    if (!window.confirm("Importing this file will replace the current ScheduleIt data. Continue?")) {
      return "Import cancelled.";
    }

    const nextSchedule = normalizeState(parsed);
    setSchedule(nextSchedule);
    resetDraft(nextSchedule.profile);
    return "Import complete. Current schedule data was replaced.";
  }

  function handleApplyHtmlImport(result, mode) {
    if (!result || result.errors?.length) return "Resolve parser errors before applying import.";
    if (mode === "replace" && !window.confirm("Replace the current schedule with imported HTML data?")) {
      return "HTML import cancelled.";
    }

    const targetDay = {
      id: createId("day"),
      date: result.scheduleDayDraft.date || "",
      title: result.scheduleDayDraft.title || "Imported HTML Schedule",
    };
    let nextSelectedDriverId = selectedDriver?.id || "";

    setSchedule((current) => {
      const vehicles = [...current.vehicles];
      const drivers = [...current.drivers];
      const vehicleByName = new Map(vehicles.map((vehicle) => [nameKey(vehicle.name), vehicle]));
      const driverByName = new Map(drivers.map((driver) => [nameKey(driver.name), driver]));

      result.vehiclesToAdd.forEach((vehicleName) => {
        if (!vehicleByName.has(nameKey(vehicleName))) {
          const vehicle = { id: createId("vehicle"), name: vehicleName };
          vehicles.push(vehicle);
          vehicleByName.set(nameKey(vehicleName), vehicle);
        }
      });

      result.driversToAdd.forEach((driverName) => {
        if (!driverByName.has(nameKey(driverName))) {
          const firstVehicleName = result.movements.find((movement) => nameKey(movement.driverName) === nameKey(driverName))?.vehicleName;
          const defaultVehicle = vehicleByName.get(nameKey(firstVehicleName))?.id || vehicles[0]?.id || "";
          const driver = { id: createId("driver"), name: driverName, defaultVehicle };
          drivers.push(driver);
          driverByName.set(nameKey(driverName), driver);
        }
      });

      const importedMovements = result.movements.map((movement, index) => {
        const driver = driverByName.get(nameKey(movement.driverName)) || drivers[0];
        const vehicle =
          vehicleByName.get(nameKey(movement.vehicleName)) ||
          vehicles.find((item) => item.id === driver?.defaultVehicle) ||
          vehicles[0];
        const movementFields = { ...movement };
        delete movementFields.driverName;
        delete movementFields.vehicleName;
        if (!nextSelectedDriverId && driver?.id) nextSelectedDriverId = driver.id;

        return {
          ...movementFields,
          id: createId("movement"),
          scheduleDayId: targetDay.id,
          sortOrder: (index + 1) * 10,
          driverId: driver?.id || "",
          vehicleId: vehicle?.id || "",
        };
      });

      return {
        ...current,
        drivers,
        vehicles,
        scheduleDays: mode === "replace" ? [targetDay] : [...current.scheduleDays, targetDay],
        movements: mode === "replace" ? importedMovements : [...current.movements, ...importedMovements],
        importantInfoItems: current.importantInfoItems || [],
        routeNotes: current.routeNotes || [],
      };
    });

    setSelectedDriverId(nextSelectedDriverId);
    resetDraft(schedule.profile, targetDay);
    return mode === "replace" ? "HTML import applied. Current schedule was replaced." : "HTML import applied to a new schedule day.";
  }

  function printPreview() {
    const frameWindow = previewFrameRef.current?.contentWindow;
    if (frameWindow) {
      frameWindow.focus();
      frameWindow.print();
      return;
    }

    const didOpen = printHtmlDocument(previewSrcDoc);
    if (!didOpen) window.alert("Could not open print window. Check your browser popup settings.");
  }

  return (
    <div className="min-h-screen bg-neutral-100 text-neutral-900">
      <div className="mx-auto max-w-7xl p-4 md:p-6">
        <div className="no-print mb-6 rounded-3xl bg-white p-5 shadow-lg">
          <div className="flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
            <div>
              <h1 className="text-5xl md:text-6xl font-black tracking-tighter text-neutral-800 leading-none">Schedule-It</h1>
              <p className="mt-3 max-w-3xl text-sm text-neutral-600 font-medium">
                Basic mission schedule and driver brief builder. Enter the event details on the left and use the live preview on the
                right as the starting point for your official template workflow.
              </p>
            </div>
            <div className="grid grid-cols-2 gap-2 md:grid-cols-3">
              <button
                onClick={handleLoadMondayDemo}
                className="inline-flex items-center justify-center gap-2 rounded-xl border border-blue-200 bg-blue-50 px-4 py-2 text-sm font-medium text-blue-700 shadow-sm transition hover:bg-blue-100"
              >
                <Play className="h-4 w-4" /> Load Monday Demo
              </button>
              <button
                onClick={() => setIsPreviewOpen(true)}
                className="inline-flex items-center justify-center gap-2 rounded-xl bg-neutral-900 px-4 py-2 text-sm font-medium text-white shadow-sm transition hover:bg-neutral-800"
              >
                <Printer className="h-4 w-4" /> Preview
              </button>
              <button
                onClick={() => setIsExportOpen(true)}
                className="inline-flex items-center justify-center gap-2 rounded-xl border border-neutral-300 bg-white px-4 py-2 text-sm font-medium text-neutral-900 shadow-sm transition hover:bg-neutral-50"
              >
                <Download className="h-4 w-4" /> Export
              </button>
            </div>
          </div>
          <div className="mt-4 flex justify-end">
            <button onClick={handleResetAll} className="text-xs text-neutral-400 hover:text-red-500 transition underline">
              Clear All Data
            </button>
          </div>
        </div>

        {isExportOpen ? (
          <ExportPanel
            onClose={() => setIsExportOpen(false)}
            selectedDriverName={selectedDriver?.name || ""}
            hasDrivers={schedule.drivers.length > 0}
            onPrintView={handlePrintView}
            onCopyHtml={handleCopyHtml}
            onExportJson={handleExportJson}
            onImportJson={handleImportJson}
            onApplyHtmlImport={handleApplyHtmlImport}
          />
        ) : null}

        {isPreviewOpen ? (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4 no-print">
            <div className="relative h-full w-full max-w-5xl overflow-y-auto rounded-3xl bg-white shadow-2xl p-8">
              <div className="sticky top-0 mb-6 flex items-center justify-between border-b border-neutral-200 bg-white pb-4 z-10">
                <div>
                  <h2 className="text-xl font-semibold text-neutral-900">Document Preview</h2>
                  <p className="text-sm text-neutral-500">Review before printing</p>
                </div>
                <div className="flex gap-3">
                  <button
                    onClick={printPreview}
                    className="inline-flex items-center gap-2 rounded-xl bg-blue-600 px-4 py-2 text-sm font-medium text-white shadow-sm hover:bg-blue-700 transition"
                  >
                    <Printer className="h-4 w-4" /> Print
                  </button>
                  <button
                    onClick={() => setIsPreviewOpen(false)}
                    className="inline-flex items-center gap-2 rounded-xl border border-neutral-300 bg-white px-4 py-2 text-sm font-medium text-neutral-700 hover:bg-neutral-50 transition"
                  >
                    <X className="h-4 w-4" /> Close
                  </button>
                </div>
              </div>
              <div className="mb-5 flex flex-wrap gap-2">
                {documentPreviewTabs.map((tab) => (
                  <button
                    key={tab.id}
                    onClick={() => setPreviewView(tab.id)}
                    className={`rounded-xl px-3 py-2 text-xs font-semibold transition ${
                      previewView === tab.id
                        ? "bg-neutral-900 text-white"
                        : "border border-neutral-200 bg-white text-neutral-600 hover:bg-neutral-50"
                    }`}
                  >
                    {tab.label}
                  </button>
                ))}
              </div>
              <iframe
                ref={previewFrameRef}
                title={`${previewDocument.title} Preview`}
                srcDoc={previewSrcDoc}
                className="h-[70vh] w-full rounded-2xl border border-neutral-100 bg-white"
              />
            </div>
          </div>
        ) : null}

        <div className="grid gap-6 xl:grid-cols-1">
          <ScheduleBuilder
            draft={draft}
            drivers={schedule.drivers}
            vehicles={schedule.vehicles}
            scheduleDays={schedule.scheduleDays}
            movements={schedule.movements}
            importantInfoItems={schedule.importantInfoItems || []}
            errors={validationErrors}
            onChange={updateDraft}
            onSubmit={handleSubmit}
            onCancelEdit={() => resetDraft()}
            onClear={() => resetDraft(schedule.profile, schedule.scheduleDays.find((day) => day.id === draft.scheduleDayId))}
            onCreateDay={handleCreateDay}
            onSelectDay={handleSelectDay}
            onUpdateDay={handleUpdateDay}
            onDuplicateDay={handleDuplicateDay}
            onEditMovement={handleEdit}
            onUpdateMovement={handleUpdateMovement}
            onDuplicateMovement={handleDuplicateMovement}
            onMoveMovement={handleMoveMovement}
            onDeleteMovement={handleDelete}
            onSaveImportantInfoItem={handleSaveImportantInfoItem}
            onDuplicateImportantInfoItem={handleDuplicateImportantInfoItem}
            onMoveImportantInfoItem={handleMoveImportantInfoItem}
            onDeleteImportantInfoItem={handleDeleteImportantInfoItem}
          />
          <PreviewTabs
            entriesByMonth={entriesByMonth}
            profile={schedule.profile}
            movements={schedule.movements}
            importantInfoItems={schedule.importantInfoItems || []}
            drivers={schedule.drivers}
            vehicles={schedule.vehicles}
            scheduleDays={schedule.scheduleDays}
            selectedDriverId={selectedDriver?.id || ""}
            onSelectedDriverChange={setSelectedDriverId}
            onEdit={handleEdit}
            onDelete={handleDelete}
            onReorderMovements={handleReorderOperationalMovements}
          />
        </div>
      </div>
    </div>
  );
}
