import { useEffect, useMemo, useRef, useState } from "react";
import { Download, Printer, Wrench } from "lucide-react";
import ExportPanel from "./components/ExportPanel";
import PersistenceStatus from "./components/PersistenceStatus";
import OperationResult from "./components/OperationResult";
import PreviewTabs from "./components/PreviewTabs";
import ScheduleBuilder from "./components/ScheduleBuilder";
import StorageGate from "./components/StorageGate";
import { defaultProfile, defaultScheduleState } from "./data/defaultData";
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
import { analyzeScheduleIntegrity, validateMovementCandidate } from "./domain/scheduleValidation";
import { duplicateMovementForSchedule } from "./domain/schedulingMutations";
import { Button } from "./components/ui/Button";
import Card from "./components/ui/Card";
import Badge from "./components/ui/Badge";
import PreviewWorkspace from "./components/preview/PreviewWorkspace";
import IntegrityPanel from "./components/integrity/IntegrityPanel";
import ToolsWorkspace from "./components/tools/ToolsWorkspace";
import PreviewUnavailable from "./components/preview/PreviewUnavailable";
import { preparePreviewDocument } from "./components/preview/previewPreparation";
import { createStorageId } from "./storage/storage";
import { deleteDriverCandidate, deleteVehicleCandidate, reassignDriverReferences, reassignVehicleReferences } from "./domain/resourceMutations";
import { getDriverUsage, getVehicleUsage, totalUsage } from "./domain/resourceUsage";

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
  const [isToolsOpen, setIsToolsOpen] = useState(false);
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
  const previewPreparation = useMemo(
    () => preparePreviewDocument(() => getExportDocument(activeSchedule, previewView, { selectedDriverId: selectedDriver?.id })),
    [activeSchedule, previewView, selectedDriver?.id],
  );
  const previewDocument = previewPreparation.ok ? previewPreparation.document : { title: "Preview" };
  const previewSrcDoc = previewPreparation.ok ? previewPreparation.srcDoc : "";
  const visibilityCounts = useMemo(() => getVisibilityCounts(activeSchedule.movements), [activeSchedule.movements]);
  const integrity = useMemo(() => analyzeScheduleIntegrity(activeSchedule), [activeSchedule]);

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
    window.requestAnimationFrame(() => document.getElementById(`movement-${movement.id}`)?.focus({ preventScroll: true }));
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

  function saveDriver(driver) {
    const next = { ...driver, id: driver.id || createStorageId("driver") };
    setSchedule((current) => ({ ...current, drivers: [...current.drivers.filter((item) => item.id !== next.id), next] }));
  }
  function saveVehicle(vehicle) {
    const next = { ...vehicle, id: vehicle.id || createStorageId("vehicle") };
    setSchedule((current) => ({ ...current, vehicles: [...current.vehicles.filter((item) => item.id !== next.id), next] }));
  }
  function deleteDriver(id) {
    if (totalUsage(getDriverUsage(schedule, id))) return;
    if (!window.confirm("Permanently delete this unreferenced driver? A verified rollback snapshot will be retained.")) return;
    performReplacement(deleteDriverCandidate(schedule, id), "resource-change", "Driver permanently deleted.");
  }
  function deleteVehicle(id) {
    if (totalUsage(getVehicleUsage(schedule, id))) return;
    if (!window.confirm("Permanently delete this unreferenced vehicle? A verified rollback snapshot will be retained.")) return;
    performReplacement(deleteVehicleCandidate(schedule, id), "resource-change", "Vehicle permanently deleted.");
  }
  function reassignDriver(sourceId, replacementId) {
    performReplacement(reassignDriverReferences(schedule, sourceId, replacementId), "resource-change", "Driver references reassigned. Rollback is available.");
  }
  function reassignVehicle(sourceId, replacementId) {
    performReplacement(reassignVehicleReferences(schedule, sourceId, replacementId), "resource-change", "Vehicle references reassigned. Rollback is available.");
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

  function handlePrintView(view, { skipIntegrityConfirmation = false } = {}) {
    if (!skipIntegrityConfirmation && integrity.errors.length && !window.confirm("This schedule contains unresolved integrity issues.\n\nYou can continue, but the output may contain timing, driver, vehicle, or handover conflicts.")) return;
    const { fullHtml } = getExportDocument(schedule, view, { selectedDriverId: selectedDriver?.id });
    const didOpen = printHtmlDocument(fullHtml);
    setIsExportOpen(false);
    if (!didOpen) window.alert("Could not open print window. Check your browser popup settings.");
  }

  async function handleCopyHtml(view, { skipIntegrityConfirmation = false } = {}) {
    if (!skipIntegrityConfirmation && integrity.errors.length && !window.confirm("This schedule contains unresolved integrity issues.\n\nYou can continue, but the output may contain timing, driver, vehicle, or handover conflicts.")) return "Copy cancelled.";
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

  function openPreview() {
    setIsToolsOpen(false);
    setIsExportOpen(false);
    setIsPreviewOpen(true);
  }

  function reviewPreviewIssues() {
    setIsPreviewOpen(false);
    setIsExportOpen(false);
    setIsToolsOpen(false);
    window.requestAnimationFrame(() => {
      document.getElementById("schedule-integrity")?.scrollIntoView({ behavior: "smooth" });
      const toggle = document.getElementById("schedule-integrity-toggle");
      if (toggle?.getAttribute("aria-expanded") === "false") toggle.click();
      else document.querySelector("[data-integrity-issue]")?.focus();
    });
  }

  return (
    <div className="ts-app">
      <div className="ts-container">
        <Card className="ts-header no-print mb-6">
          <div className="flex min-w-0 flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
            <div className="min-w-0">
              <h1 className="ts-brand-title">Schedule-It</h1>
              <p className="mt-2 max-w-2xl text-sm text-[var(--ts-text-muted)]">
                Mission schedule and driver brief builder for official programme planning.
              </p>
            </div>
            <div className="grid w-full grid-cols-3 gap-2 sm:w-auto">
              <Button onClick={() => { setIsPreviewOpen(false); setIsExportOpen(false); setIsToolsOpen(true); }} variant="secondary">
                <Wrench className="h-4 w-4" /> Tools
              </Button>
              <Button
                onClick={openPreview}
                variant="primary"
              >
                <Printer className="h-4 w-4" /> Preview
              </Button>
              <Button
                onClick={() => { setIsPreviewOpen(false); setIsToolsOpen(false); setIsExportOpen(true); }}
                variant="secondary"
              >
                <Download className="h-4 w-4" /> Export
              </Button>
            </div>
          </div>
          <div className="mt-4 flex flex-wrap gap-x-4 gap-y-1 rounded-xl bg-neutral-50 px-3 py-2 text-xs text-neutral-600" aria-label="Programme visibility summary">
            <Badge>Executive {visibilityCounts.executive}</Badge><Badge>CG {visibilityCounts.cg}</Badge><Badge>Marida {visibilityCounts.marida}</Badge><Badge>Operational {visibilityCounts.operational}</Badge>
            <Badge tone={visibilityCounts.hidden ? "warning" : "neutral"}>Hidden {visibilityCounts.hidden}</Badge>
          </div>
          <div className={`ts-alert mt-3 ${integrity.errors.length ? "ts-alert--danger" : "ts-alert--info"}`}>
            <div className="flex flex-wrap items-center justify-between gap-2"><strong>Schedule Integrity</strong><span>{integrity.errors.length} errors · {integrity.warnings.length} warnings</span></div>
            <div className="mt-1 flex flex-wrap gap-x-3 text-xs"><span>Chronology: {integrity.summary.chronologyErrors}</span><span>Driver: {integrity.summary.driverOverlaps}</span><span>Vehicle: {integrity.summary.vehicleOverlaps}</span><span>Handover: {integrity.summary.handoverConflicts}</span><span>Orphans: {integrity.summary.orphanReferences}</span></div>
            <Button variant="ghost" className="mt-2 min-h-9 px-2" onClick={() => document.getElementById("schedule-integrity")?.scrollIntoView({ behavior: "smooth" })}>Review Issues</Button>
          </div>
          <div className="mt-4 flex justify-end">
            <div className="flex flex-col items-end gap-2">
              <PersistenceStatus persistence={persistence} onRetry={retrySave} onExport={handleExportJson} />
              <Button onClick={handleResetAll} variant="ghost" className="min-h-0 px-2 py-1 text-xs text-red-600">Clear Schedule Data</Button>
            </div>
          </div>
        </Card>

        <OperationResult
          result={operationResult}
          onRollback={handleRollback}
          onRetry={operationResult?.retry}
          onDownloadCurrent={handleExportJson}
          onDownloadCandidate={() => operationResult?.candidate && downloadJson("schedule-it-candidate-backup.json", createFullBackup(operationResult.candidate))}
        />

        <IntegrityPanel integrity={integrity} onReviewIssue={(issue) => document.getElementById(`movement-${issue.movementIds?.[0]}`)?.focus()} />

        {isExportOpen ? (
          <ExportPanel
            onClose={() => setIsExportOpen(false)}
            selectedDriverName={selectedDriver?.name || ""}
            hasDrivers={schedule.drivers.length > 0}
            hasBlockingIssues={integrity.errors.length > 0}
            onPrintView={handlePrintView}
            onCopyHtml={handleCopyHtml}
            onReviewIssues={reviewPreviewIssues}
            onExportJson={handleExportJson}
            onImportJson={handleImportJson}
            onReplaceJson={handleReplaceJson}
            onApplyHtmlImport={handleApplyHtmlImport}
          />
        ) : null}

        {isPreviewOpen && previewPreparation.ok ? (
          <PreviewWorkspace tabs={documentPreviewTabs} selectedView={previewView} onViewChange={setPreviewView} scheduleDays={schedule.scheduleDays} integrity={integrity} selectedDriverName={selectedDriver?.name || ""} documentTitle={previewDocument.title} srcDoc={previewSrcDoc} frameRef={previewFrameRef} onPrint={printPreview} onCopy={(view) => handleCopyHtml(view, { skipIntegrityConfirmation: true })} onReviewIssues={reviewPreviewIssues} onClose={() => setIsPreviewOpen(false)} />
        ) : null}

        {isPreviewOpen && !previewPreparation.ok ? <PreviewUnavailable error={previewPreparation.error} onClose={() => setIsPreviewOpen(false)} /> : null}

        {isToolsOpen ? <ToolsWorkspace
          onClose={() => setIsToolsOpen(false)}
          schedule={schedule}
          onSaveDriver={saveDriver}
          onDeleteDriver={deleteDriver}
          onReassignDriver={reassignDriver}
          onSaveVehicle={saveVehicle}
          onDeleteVehicle={deleteVehicle}
          onReassignVehicle={reassignVehicle}
          importantInfoCount={(schedule.importantInfoItems || []).length}
          handoverCount={(schedule.vehicleHandoverNotes || []).length}
          handoverConflictCount={Object.values(integrity.conflictsByHandoverId).filter((issues) => issues.some((issue) => issue.severity === "error")).length}
          builderProps={{ draft, drivers: schedule.drivers, vehicles: schedule.vehicles, scheduleDays: schedule.scheduleDays, movements: schedule.movements, vehicleHandoverNotes: schedule.vehicleHandoverNotes || [], importantInfoItems: schedule.importantInfoItems || [], integrity, errors: validationErrors, onChange: updateDraft, onSubmit: handleSubmit, onCancelEdit: () => resetDraft(), onClear: () => resetDraft(schedule.profile, schedule.scheduleDays.find((day) => day.id === draft.scheduleDayId)), onCreateDay: handleCreateDay, onSelectDay: handleSelectDay, onUpdateDay: handleUpdateDay, onDuplicateDay: handleDuplicateDay, onEditMovement: handleEdit, onUpdateMovement: handleUpdateMovement, onDuplicateMovement: handleDuplicateMovement, onMoveMovement: handleMoveMovement, onDeleteMovement: handleDelete, onSaveVehicleHandoverNote: handleSaveVehicleHandoverNote, onDuplicateVehicleHandoverNote: handleDuplicateVehicleHandoverNote, onMoveVehicleHandoverNote: handleMoveVehicleHandoverNote, onDeleteVehicleHandoverNote: handleDeleteVehicleHandoverNote, onSaveImportantInfoItem: handleSaveImportantInfoItem, onDuplicateImportantInfoItem: handleDuplicateImportantInfoItem, onMoveImportantInfoItem: handleMoveImportantInfoItem, onDeleteImportantInfoItem: handleDeleteImportantInfoItem }}
        /> : null}

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
            workingTimePolicy={schedule.workingTimePolicy}
            onWorkingTimePolicyChange={(workingTimePolicy) => setSchedule((current) => ({ ...current, workingTimePolicy }))}
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
