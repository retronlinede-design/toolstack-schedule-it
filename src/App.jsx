import { useEffect, useMemo, useRef, useState } from "react";
import { Download, Play, Printer, X } from "lucide-react";
import ExportPanel from "./components/ExportPanel";
import PersistenceStatus from "./components/PersistenceStatus";
import OperationResult from "./components/OperationResult";
import PreviewTabs from "./components/PreviewTabs";
import ScheduleBuilder from "./components/ScheduleBuilder";
import StorageGate from "./components/StorageGate";
import { createMondayDemoState, defaultProfile, defaultScheduleState } from "./data/defaultData";
import {
  createDraftFromMovement,
  createMovementFromDraft,
  createScheduleDayFromDraft,
  emptyDraft,
} from "./data/schema";
import { getEntriesByMonth, sortMovementsByDateAndTime } from "./utils/calculations";
import { getExportDocument } from "./utils/exportHtml";
import { downloadJson, initializeScheduleStorage, normalizeState, saveScheduleState } from "./utils/storage";
import { getWeekday } from "./utils/time";
import { shouldWarnBeforeUnload } from "./storage/persistence";
import { createFullBackup, fullBackupFilename } from "./import/backupSchema";
import { prepareBackupImport } from "./import/prepareBackup";
import { replaceScheduleTransaction, rollbackScheduleTransaction } from "./import/importTransaction";
import { buildHtmlImportCandidate } from "./import/htmlCandidate";
import { createClearCandidate } from "./import/operationCandidates";
import { getVisibilityCounts } from "./domain/audiences";
import { analyzeScheduleIntegrity, canProduceOfficialOutput, validateMovementCandidate } from "./domain/scheduleValidation";
import { duplicateMovementForSchedule } from "./domain/schedulingMutations";

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

function nextVehicleHandoverSortOrder(vehicleHandoverNotes, scheduleDayId) {
  const orders = vehicleHandoverNotes
    .filter((note) => note.scheduleDayId === scheduleDayId)
    .map((note) => note.sortOrder)
    .filter(Number.isFinite);

  return orders.length === 0 ? 10 : Math.max(...orders) + 10;
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

let cachedStartupResult;
function getInitialStorageResult() {
  if (!cachedStartupResult) cachedStartupResult = initializeScheduleStorage();
  return cachedStartupResult;
}

export default function ScheduleItApp() {
  const previewFrameRef = useRef(null);
  const [startup, setStartup] = useState(getInitialStorageResult);
  const [schedule, setSchedule] = useState(() => startup.ok ? startup.value : null);
  const [draft, setDraft] = useState(() => createInitialDraft(startup.ok ? startup.value.profile : defaultProfile));
  const [validationErrors, setValidationErrors] = useState({});
  const [isPreviewOpen, setIsPreviewOpen] = useState(false);
  const [isExportOpen, setIsExportOpen] = useState(false);
  const [previewView, setPreviewView] = useState("executive");
  const [selectedDriverId, setSelectedDriverId] = useState(() => startup.ok ? startup.value.drivers[0]?.id || "" : "");
  const [persistence, setPersistence] = useState(() => ({
    status: startup.ok && !startup.needsInitialSave ? "saved" : "initializing",
    persistedRevision: 0,
    currentRevision: 0,
    savedAt: startup.savedAt || null,
  }));
  const revisionRef = useRef(0);
  const firstPersistenceEffect = useRef(true);
  const saveTimerRef = useRef(null);
  const latestScheduleRef = useRef(schedule);
  const volatileRef = useRef(false);
  const skipNextPersistenceRef = useRef(false);
  const [operationResult, setOperationResult] = useState(null);

  useEffect(() => {
    latestScheduleRef.current = schedule;
    if (!schedule || volatileRef.current) return undefined;
    if (skipNextPersistenceRef.current) {
      skipNextPersistenceRef.current = false;
      return undefined;
    }
    const isInitial = firstPersistenceEffect.current;
    firstPersistenceEffect.current = false;
    if (isInitial && !startup.needsInitialSave) return undefined;

    revisionRef.current += 1;
    const revision = revisionRef.current;
    setPersistence((current) => ({ ...current, status: "saving", currentRevision: revision }));
    if (saveTimerRef.current) clearTimeout(saveTimerRef.current);
    saveTimerRef.current = window.setTimeout(() => {
      const result = saveScheduleState(latestScheduleRef.current);
      if (revision !== revisionRef.current) return;
      setPersistence((current) => result.ok
        ? { status: "saved", currentRevision: revision, persistedRevision: revision, savedAt: result.savedAt, error: null }
        : { status: "failed", currentRevision: revision, persistedRevision: current.persistedRevision, error: result });
    }, 250);
    return () => clearTimeout(saveTimerRef.current);
  }, [schedule, startup.needsInitialSave]);

  useEffect(() => {
    function warnBeforeUnload(event) {
      if (shouldWarnBeforeUnload(persistence.status)) {
        event.preventDefault();
        event.returnValue = "";
      }
    }
    window.addEventListener("beforeunload", warnBeforeUnload);
    return () => window.removeEventListener("beforeunload", warnBeforeUnload);
  }, [persistence.status]);

  function applyStartupResult(result) {
    setStartup(result);
    if (!result.ok) return;
    cachedStartupResult = result;
    volatileRef.current = false;
    firstPersistenceEffect.current = true;
    revisionRef.current = 0;
    setSchedule(result.value);
    setSelectedDriverId(result.value.drivers[0]?.id || "");
    setDraft(createInitialDraft(result.value.profile));
    setPersistence({ status: result.needsInitialSave ? "initializing" : "saved", currentRevision: 0, persistedRevision: 0, savedAt: result.savedAt || null });
  }

  function retryStartup() {
    applyStartupResult(initializeScheduleStorage());
  }

  function useVolatileState(value) {
    volatileRef.current = true;
    const normalized = normalizeState(value);
    setStartup({ ok: true, status: "volatile", value: normalized });
    setSchedule(normalized);
    setDraft(createInitialDraft(normalized.profile));
    setSelectedDriverId(normalized.drivers[0]?.id || "");
    setPersistence({ status: "unavailable", currentRevision: 0, persistedRevision: null, error: startup });
  }

  function retrySave() {
    if (!latestScheduleRef.current || volatileRef.current) return;
    const revision = revisionRef.current;
    setPersistence((current) => ({ ...current, status: "saving" }));
    const result = saveScheduleState(latestScheduleRef.current);
    setPersistence(result.ok
      ? { status: "saved", currentRevision: revision, persistedRevision: revision, savedAt: result.savedAt, error: null }
      : { status: "failed", currentRevision: revision, persistedRevision: persistence.persistedRevision, error: result });
  }

  function applyTransactionalState(result, message, targetDay) {
    skipNextPersistenceRef.current = true;
    latestScheduleRef.current = result.storedState;
    setSchedule(result.storedState);
    const firstDay = targetDay || result.storedState.scheduleDays[0];
    const nextDriverId = result.storedState.drivers.some((driver) => driver.id === selectedDriverId) ? selectedDriverId : result.storedState.drivers[0]?.id || "";
    setSelectedDriverId(nextDriverId);
    resetDraft(result.storedState.profile, firstDay);
    setPersistence((current) => ({ ...current, status: "saved", savedAt: new Date().toISOString(), error: null }));
    setOperationResult({ ok: true, snapshotKey: result.snapshotKey, message, operationType: result.operationType });
  }

  function performReplacement(candidate, operationType, message, targetDay) {
    const result = replaceScheduleTransaction({ currentState: schedule, candidateState: candidate, operationType });
    if (!result.ok) {
      setOperationResult({ ...result, ok: false, candidate, message: "Replacement failed. The current React state was retained.", retry: () => performReplacement(candidate, operationType, message, targetDay) });
      return result;
    }
    applyTransactionalState(result, message, targetDay);
    return result;
  }

  function handleRollback() {
    if (!operationResult?.snapshotKey) return;
    const result = rollbackScheduleTransaction({ snapshotKey: operationResult.snapshotKey, currentState: schedule });
    if (!result.ok) {
      setOperationResult({ ...result, ok: false, message: "Rollback failed. Both retained snapshots were left intact." });
      return;
    }
    applyTransactionalState(result, "Previous schedule restored.");
  }

  const activeSchedule = schedule || defaultScheduleState;
  const entriesByMonth = useMemo(
    () => getEntriesByMonth(activeSchedule.scheduleDays, activeSchedule.movements),
    [activeSchedule.scheduleDays, activeSchedule.movements],
  );
  const selectedDriver = activeSchedule.drivers.find((driver) => driver.id === selectedDriverId) || activeSchedule.drivers[0];
  const previewDocument = useMemo(
    () => getExportDocument(activeSchedule, previewView, { selectedDriverId: selectedDriver?.id }),
    [activeSchedule, previewView, selectedDriver?.id],
  );
  const previewSrcDoc = useMemo(
    () => `<!doctype html><html><head><meta charset="utf-8"><title>${previewDocument.title}</title><style>${previewDocument.styles}</style></head><body>${previewDocument.bodyHtml}</body></html>`,
    [previewDocument],
  );
  const visibilityCounts = useMemo(() => getVisibilityCounts(activeSchedule.movements), [activeSchedule.movements]);
  const integrity = useMemo(() => analyzeScheduleIntegrity(activeSchedule), [activeSchedule]);
  const officialOutputAllowed = canProduceOfficialOutput(integrity);

  if (!schedule) return <StorageGate startup={startup} onRetry={retryStartup} onResolved={applyStartupResult} onVolatile={useVolatileState} />;

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
    const workingDraft = draft.id ? draft : { ...draft, id: createId("movement") };
    const errors = validateDraft(workingDraft);
    setValidationErrors(errors);
    if (Object.keys(errors).length > 0) return;
    const profile = { missionName: workingDraft.missionName || defaultProfile.missionName, documentTitle: workingDraft.documentTitle || defaultProfile.documentTitle };
    const existingDay = findOrCreateDay(schedule.scheduleDays, workingDraft);
    const day = createScheduleDayFromDraft(workingDraft, existingDay);
    const movement = { ...createMovementFromDraft(workingDraft, day.id), sortOrder: Number.isFinite(workingDraft.sortOrder) ? workingDraft.sortOrder : nextSortOrder(schedule.movements, day.id) };
    const scheduleDays = existingDay ? schedule.scheduleDays.map((item) => (item.id === day.id ? day : item)) : [...schedule.scheduleDays, day];
    const validation = validateMovementCandidate({ ...schedule, scheduleDays }, movement, workingDraft.id);
    if (validation.blocking.length > 0) {
      setDraft(workingDraft);
      setValidationErrors({ integrityIssues: validation.issues });
      return;
    }
    setSchedule({ ...schedule, profile, scheduleDays, movements: [...schedule.movements.filter((item) => item.id !== movement.id), movement] });

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
    const copiedVehicleHandoverNotes = (schedule.vehicleHandoverNotes || [])
      .filter((note) => note.scheduleDayId === sourceDay.id)
      .map((note) => ({
        ...note,
        id: createId("handover"),
        scheduleDayId: nextDay.id,
      }));

    setSchedule((current) => ({
      ...current,
      scheduleDays: [...current.scheduleDays, nextDay],
      movements: [...current.movements, ...copiedMovements],
      vehicleHandoverNotes: [...(current.vehicleHandoverNotes || []), ...copiedVehicleHandoverNotes],
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
    const nextMovement = duplicateMovementForSchedule(movement, createId("movement"), nextSortOrder(schedule.movements, movement.scheduleDayId));

    setSchedule((current) => ({
      ...current,
      movements: [...current.movements, nextMovement],
    }));
  }

  function handleUpdateMovement(updatedMovement) {
    const validation = validateMovementCandidate(schedule, updatedMovement, updatedMovement.id);
    if (validation.blocking.length > 0) return { ok: false, issues: validation.issues };
    setSchedule((current) => ({
      ...current,
      movements: current.movements.map((movement) =>
        movement.id === updatedMovement.id ? preserveClearedTimeFields(updatedMovement, movement) : movement,
      ),
    }));
    return { ok: true, issues: validation.issues };
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

  function handleSaveVehicleHandoverNote(noteDraft) {
    if (!noteDraft.scheduleDayId || !noteDraft.vehicleId || (!noteDraft.location && !noteDraft.instruction && !noteDraft.keyLocation && !noteDraft.notes)) {
      return { ok: false, issues: [{ message: "Complete the required handover fields." }] };
    }
    const note = {
      id: noteDraft.id || createId("handover"), scheduleDayId: noteDraft.scheduleDayId, vehicleId: noteDraft.vehicleId,
      fromDriverId: noteDraft.fromDriverId || "", toDriverId: noteDraft.toDriverId || "",
      visibleToDriverIds: Array.isArray(noteDraft.visibleToDriverIds) ? noteDraft.visibleToDriverIds : [], location: noteDraft.location || "",
      instruction: noteDraft.instruction || "", keyLocation: noteDraft.keyLocation || "", time: noteDraft.time || "", notes: noteDraft.notes || "",
      sortOrder: Number.isFinite(noteDraft.sortOrder) ? noteDraft.sortOrder : nextVehicleHandoverSortOrder(schedule.vehicleHandoverNotes || [], noteDraft.scheduleDayId),
    };
    const nextSchedule = { ...schedule, vehicleHandoverNotes: [...(schedule.vehicleHandoverNotes || []).filter((item) => item.id !== note.id), note] };
    const analysis = analyzeScheduleIntegrity(nextSchedule);
    const blocking = (analysis.conflictsByHandoverId[note.id] || []).filter((issue) => issue.severity === "error");
    if (blocking.length) return { ok: false, issues: analysis.conflictsByHandoverId[note.id] };
    setSchedule(nextSchedule);
    return { ok: true, issues: analysis.conflictsByHandoverId[note.id] || [] };
  }

  function handleDuplicateVehicleHandoverNote(note) {
    setSchedule((current) => ({
      ...current,
      vehicleHandoverNotes: [
        ...(current.vehicleHandoverNotes || []),
        {
          ...note,
          id: createId("handover"),
          sortOrder: nextVehicleHandoverSortOrder(current.vehicleHandoverNotes || [], note.scheduleDayId),
        },
      ],
    }));
  }

  function handleMoveVehicleHandoverNote(id, direction) {
    setSchedule((current) => {
      const note = (current.vehicleHandoverNotes || []).find((item) => item.id === id);
      if (!note) return current;

      const orderedNotes = [...(current.vehicleHandoverNotes || [])]
        .filter((item) => item.scheduleDayId === note.scheduleDayId)
        .sort((a, b) => (a.sortOrder ?? Number.MAX_SAFE_INTEGER) - (b.sortOrder ?? Number.MAX_SAFE_INTEGER));
      const currentIndex = orderedNotes.findIndex((item) => item.id === id);
      const nextIndex = direction === "up" ? currentIndex - 1 : currentIndex + 1;
      if (currentIndex < 0 || nextIndex < 0 || nextIndex >= orderedNotes.length) return current;

      const reordered = [...orderedNotes];
      const [moved] = reordered.splice(currentIndex, 1);
      reordered.splice(nextIndex, 0, moved);
      const sortOrdersById = new Map(reordered.map((item, index) => [item.id, (index + 1) * 10]));

      return {
        ...current,
        vehicleHandoverNotes: (current.vehicleHandoverNotes || []).map((item) =>
          item.scheduleDayId === note.scheduleDayId
            ? {
                ...item,
                sortOrder: sortOrdersById.get(item.id),
              }
            : item,
        ),
      };
    });
  }

  function handleMoveVehicleHandoverInOperational({ handoverId, targetScheduleDayId, targetDriverId = "", targetHandoverId = "" }) {
    if (!handoverId || !targetScheduleDayId) return;

    setSchedule((current) => {
      const notes = current.vehicleHandoverNotes || [];
      const dragged = notes.find((note) => note.id === handoverId);
      const targetNote = targetHandoverId ? notes.find((note) => note.id === targetHandoverId) : null;
      const resolvedTargetDayId = targetNote?.scheduleDayId || targetScheduleDayId;

      if (!dragged) return current;
      if (targetHandoverId && !targetNote) return current;
      if (!current.scheduleDays.some((day) => day.id === resolvedTargetDayId)) return current;

      const sourceDayId = dragged.scheduleDayId;
      const visibleToDriverIds = Array.isArray(dragged.visibleToDriverIds) ? [...dragged.visibleToDriverIds] : [];
      if (targetDriverId && !visibleToDriverIds.includes(targetDriverId)) {
        visibleToDriverIds.push(targetDriverId);
      }

      const movedNote = {
        ...dragged,
        scheduleDayId: resolvedTargetDayId,
        visibleToDriverIds,
      };
      const notesWithoutMoved = notes.filter((note) => note.id !== handoverId);
      const targetDayNotes = notesWithoutMoved
        .filter((note) => note.scheduleDayId === resolvedTargetDayId)
        .sort((a, b) => (a.sortOrder ?? Number.MAX_SAFE_INTEGER) - (b.sortOrder ?? Number.MAX_SAFE_INTEGER));
      const targetIndex = targetHandoverId ? targetDayNotes.findIndex((note) => note.id === targetHandoverId) : -1;

      if (targetIndex >= 0) {
        targetDayNotes.splice(targetIndex, 0, movedNote);
      } else {
        targetDayNotes.push(movedNote);
      }

      const sortOrdersById = new Map(targetDayNotes.map((note, index) => [note.id, (index + 1) * 10]));

      if (sourceDayId !== resolvedTargetDayId) {
        notesWithoutMoved
          .filter((note) => note.scheduleDayId === sourceDayId)
          .sort((a, b) => (a.sortOrder ?? Number.MAX_SAFE_INTEGER) - (b.sortOrder ?? Number.MAX_SAFE_INTEGER))
          .forEach((note, index) => {
            sortOrdersById.set(note.id, (index + 1) * 10);
          });
      }

      return {
        ...current,
        vehicleHandoverNotes: notes.map((note) => {
          if (note.id === handoverId) {
            return {
              ...movedNote,
              sortOrder: sortOrdersById.get(note.id) ?? movedNote.sortOrder,
            };
          }

          if (sortOrdersById.has(note.id)) {
            return {
              ...note,
              sortOrder: sortOrdersById.get(note.id),
            };
          }

          return note;
        }),
      };
    });
  }

  function handleDeleteVehicleHandoverNote(id) {
    if (!window.confirm("Delete this vehicle handover note?")) return;

    setSchedule((current) => ({
      ...current,
      vehicleHandoverNotes: (current.vehicleHandoverNotes || []).filter((note) => note.id !== id),
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
    const counts = `${schedule.scheduleDays.length} days, ${schedule.movements.length} movements, ${(schedule.vehicleHandoverNotes || []).length} handovers, and ${(schedule.importantInfoItems || []).length} information items`;
    if (!window.confirm(`Clear Schedule Data? This will clear ${counts}. Profile resets to its existing default behavior; drivers and vehicles are retained.`)) return;

    const nextSchedule = createClearCandidate(schedule);
    performReplacement(nextSchedule, "clear", "Schedule data cleared. Drivers and vehicles were retained.");
  }

  function handleLoadMondayDemo() {
    if (!window.confirm("Replace with Demo Schedule? A verified snapshot of the current schedule will be retained.")) return;

    const nextSchedule = createMondayDemoState();
    const result = performReplacement(nextSchedule, "demo", "Demo schedule loaded.", nextSchedule.scheduleDays[0]);
    if (result.ok) setSelectedDriverId("driver-greg");
  }

  function handleExportJson() {
    downloadJson(fullBackupFilename(), createFullBackup(schedule));
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
    if (!officialOutputAllowed) {
      document.getElementById("schedule-integrity")?.scrollIntoView({ behavior: "smooth" });
      window.alert("Review Schedule Issues before producing official output.");
      return;
    }
    const { fullHtml } = getExportDocument(schedule, view, { selectedDriverId: selectedDriver?.id });
    const didOpen = printHtmlDocument(fullHtml);
    setIsExportOpen(false);
    if (!didOpen) window.alert("Could not open print window. Check your browser popup settings.");
  }

  async function handleCopyHtml(view) {
    if (!officialOutputAllowed) return "Review Schedule Issues before producing official output.";
    const { fullHtml } = getExportDocument(schedule, view, { selectedDriverId: selectedDriver?.id });
    try {
      await navigator.clipboard.writeText(fullHtml);
      return "HTML copied to clipboard.";
    } catch {
      return "Could not copy HTML. Your browser may require clipboard permission.";
    }
  }

  async function handleImportJson(file) {
    if (file.size > 10 * 1024 * 1024) return { ok: false, code: "FILE_TOO_LARGE", message: "The backup exceeds the 10 MiB limit." };
    return prepareBackupImport({ raw: await file.text(), size: file.size, currentState: schedule });
  }

  async function handleReplaceJson(prepared) {
    if (!prepared?.ok) return "Backup preparation is invalid.";
    if (prepared.preview.requiresEmptyConfirmation && !window.confirm("The imported schedule is empty while the current schedule contains data. Replace it anyway?")) return "Replacement cancelled.";
    if (!window.confirm("Replace Current Schedule with this validated backup? A verified pre-import snapshot will be retained.")) return "Replacement cancelled.";
    const result = performReplacement(prepared.candidate, "import", "Backup restored successfully.");
    setIsExportOpen(false);
    if (!result.ok) return `${result.errorCode}: replacement failed.`;
    setPreviewView("executive");
    return "Backup restored. Rollback is available from the operation panel.";
  }

  function handleApplyHtmlImport(result, mode) {
    if (!result || result.errors?.length) return "Resolve parser errors before applying import.";
    if (mode === "replace" && !window.confirm("Replace Current Schedule using lossy HTML data? A verified snapshot will be retained.")) {
      return "HTML import cancelled.";
    }
    const built = buildHtmlImportCandidate(schedule, result, mode);
    if (!built.ok) return `${built.code}: ${built.message}`;
    if (built.duplicate) return "This HTML import was already appended; no duplicate rows were added.";
    if (mode === "replace") {
      const transaction = performReplacement(built.candidate, "html-import", "HTML replacement completed.", built.targetDay);
      setIsExportOpen(false);
      return transaction.ok ? "HTML replacement completed. Rollback is available." : `${transaction.errorCode}: HTML replacement failed.`;
    }
    setSchedule(built.candidate);
    resetDraft(schedule.profile, built.targetDay);
    return "HTML import appended to a new schedule day.";
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
    <div className="min-h-screen overflow-x-hidden bg-neutral-100 text-neutral-900">
      <div className="mx-auto w-full max-w-full px-3 py-4 md:max-w-7xl md:p-6">
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
                disabled={!officialOutputAllowed}
                className="inline-flex items-center justify-center gap-2 rounded-xl bg-neutral-900 px-4 py-2 text-sm font-medium text-white shadow-sm transition hover:bg-neutral-800 disabled:cursor-not-allowed disabled:opacity-40"
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
          <div className="mt-4 flex flex-wrap gap-x-4 gap-y-1 rounded-xl bg-neutral-50 px-3 py-2 text-xs text-neutral-600" aria-label="Programme visibility summary">
            <span>Executive: {visibilityCounts.executive}</span><span>CG: {visibilityCounts.cg}</span><span>Marida: {visibilityCounts.marida}</span><span>Operational: {visibilityCounts.operational}</span>
            <span className={visibilityCounts.hidden ? "font-bold text-amber-700" : ""}>Hidden: {visibilityCounts.hidden}</span>
          </div>
          <div id="schedule-integrity" className={`mt-3 rounded-xl border p-3 text-sm ${integrity.errors.length ? "border-red-300 bg-red-50 text-red-900" : "border-neutral-200 bg-neutral-50 text-neutral-700"}`}>
            <div className="flex flex-wrap items-center justify-between gap-2"><strong>Schedule Integrity</strong><span>{integrity.errors.length} errors · {integrity.warnings.length} warnings</span></div>
            <div className="mt-1 flex flex-wrap gap-x-3 text-xs"><span>Chronology: {integrity.summary.chronologyErrors}</span><span>Driver: {integrity.summary.driverOverlaps}</span><span>Vehicle: {integrity.summary.vehicleOverlaps}</span><span>Handover: {integrity.summary.handoverConflicts}</span><span>Orphans: {integrity.summary.orphanReferences}</span></div>
            {(integrity.errors.length || integrity.warnings.length) ? <details className="mt-2"><summary className="cursor-pointer font-semibold">Review Schedule Issues</summary><ul className="mt-2 list-disc space-y-1 pl-5 text-xs">{[...integrity.errors, ...integrity.warnings].map((issue, index) => <li key={`${issue.type}-${issue.conflictKey || issue.handoverId || issue.movementIds?.join("-")}-${index}`}><strong>{issue.severity === "error" ? "Conflict" : "Warning"}:</strong> {issue.message}</li>)}</ul></details> : null}
          </div>
          <div className="mt-4 flex justify-end">
            <div className="flex flex-col items-end gap-2">
              <PersistenceStatus persistence={persistence} onRetry={retrySave} onExport={handleExportJson} />
              <button onClick={handleResetAll} className="text-xs text-neutral-400 hover:text-red-500 transition underline">Clear All Data</button>
            </div>
          </div>
        </div>

        <OperationResult
          result={operationResult}
          onRollback={handleRollback}
          onRetry={operationResult?.retry}
          onDownloadCurrent={handleExportJson}
          onDownloadCandidate={() => operationResult?.candidate && downloadJson("schedule-it-candidate-backup.json", createFullBackup(operationResult.candidate))}
        />

        {isExportOpen ? (
          <ExportPanel
            onClose={() => setIsExportOpen(false)}
            selectedDriverName={selectedDriver?.name || ""}
            hasDrivers={schedule.drivers.length > 0}
            hasBlockingIssues={!officialOutputAllowed}
            onPrintView={handlePrintView}
            onCopyHtml={handleCopyHtml}
            onExportJson={handleExportJson}
            onImportJson={handleImportJson}
            onReplaceJson={handleReplaceJson}
            onApplyHtmlImport={handleApplyHtmlImport}
          />
        ) : null}

        {isPreviewOpen ? (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-2 sm:p-4 no-print">
            <div className="relative h-full w-full max-w-full overflow-y-auto rounded-3xl bg-white p-4 shadow-2xl sm:max-w-5xl sm:p-8">
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

        <div className="grid min-w-0 gap-6 xl:grid-cols-1">
          <ScheduleBuilder
            draft={draft}
            drivers={schedule.drivers}
            vehicles={schedule.vehicles}
            scheduleDays={schedule.scheduleDays}
            movements={schedule.movements}
            vehicleHandoverNotes={schedule.vehicleHandoverNotes || []}
            importantInfoItems={schedule.importantInfoItems || []}
            integrity={integrity}
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
            onSaveVehicleHandoverNote={handleSaveVehicleHandoverNote}
            onDuplicateVehicleHandoverNote={handleDuplicateVehicleHandoverNote}
            onMoveVehicleHandoverNote={handleMoveVehicleHandoverNote}
            onDeleteVehicleHandoverNote={handleDeleteVehicleHandoverNote}
            onSaveImportantInfoItem={handleSaveImportantInfoItem}
            onDuplicateImportantInfoItem={handleDuplicateImportantInfoItem}
            onMoveImportantInfoItem={handleMoveImportantInfoItem}
            onDeleteImportantInfoItem={handleDeleteImportantInfoItem}
          />
          <PreviewTabs
            entriesByMonth={entriesByMonth}
            profile={schedule.profile}
            movements={schedule.movements}
            integrity={integrity}
            vehicleHandoverNotes={schedule.vehicleHandoverNotes || []}
            importantInfoItems={schedule.importantInfoItems || []}
            drivers={schedule.drivers}
            vehicles={schedule.vehicles}
            scheduleDays={schedule.scheduleDays}
            selectedDriverId={selectedDriver?.id || ""}
            onSelectedDriverChange={setSelectedDriverId}
            onEdit={handleEdit}
            onDelete={handleDelete}
            onReorderMovements={handleReorderOperationalMovements}
            onMoveVehicleHandoverInOperational={handleMoveVehicleHandoverInOperational}
          />
        </div>
      </div>
    </div>
  );
}
