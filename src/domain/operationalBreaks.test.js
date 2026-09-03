import { describe, expect, it } from "vitest";
import { createFullBackup } from "../import/backupSchema";
import { prepareBackupImport } from "../import/prepareBackup";
import { validState } from "../import/testFixtures";
import { validateMovementCandidate } from "./scheduleValidation";
import { hasMovementTiming } from "./timeIntervals";
import {
  breakInsertionContext,
  createOperationalBreakMovement,
  insertMovementIntoDay,
  validateOperationalBreakInput,
} from "./operationalBreaks";

function validInput(state, overrides = {}) {
  return {
    scheduleDayId: state.scheduleDays[0].id,
    driverId: state.movements[0].driverId,
    vehicleId: state.movements[0].vehicleId,
    previousMovementId: state.movements[0].id,
    nextMovementId: "",
    eventStartTime: "10:00",
    eventEndTime: "11:00",
    engagementDetails: "Lunch",
    venue: "Restaurant",
    address: "Main Street 1",
    ...overrides,
  };
}

describe("Operational break creation", () => {
  it("requires valid positive times, description, location, and inherited resources", () => {
    const state = validState();
    const issues = validateOperationalBreakInput({ scheduleDayId: "missing", driverId: "missing", vehicleId: "missing", eventStartTime: "", eventEndTime: "09:00", engagementDetails: "", venue: "" }, state);
    expect(issues.map((issue) => issue.field)).toEqual(expect.arrayContaining(["eventStartTime", "engagementDetails", "venue", "scheduleDayId", "driverId", "vehicleId"]));
    expect(validateOperationalBreakInput(validInput(state, { eventStartTime: "11:00", eventEndTime: "11:00" }), state)).toContainEqual(expect.objectContaining({ field: "eventEndTime" }));
    expect(validateOperationalBreakInput(validInput(state), state)).toEqual([]);
  });

  it("inherits context before, between, and after movements", () => {
    const entries = [
      { id: "first", scheduleDayId: "day", driverId: "driver", vehicleId: "car-a" },
      { id: "second", scheduleDayId: "day", driverId: "driver", vehicleId: "car-b" },
    ];
    expect(breakInsertionContext(entries, 0)).toEqual({ scheduleDayId: "day", driverId: "driver", vehicleId: "car-a", previousMovementId: "", nextMovementId: "first" });
    expect(breakInsertionContext(entries, 1)).toEqual({ scheduleDayId: "day", driverId: "driver", vehicleId: "car-a", previousMovementId: "first", nextMovementId: "second" });
    expect(breakInsertionContext(entries, 2)).toEqual({ scheduleDayId: "day", driverId: "driver", vehicleId: "car-b", previousMovementId: "second", nextMovementId: "" });
  });

  it("creates an ordinary Operational-only break movement with no transport fields", () => {
    const state = validState();
    const movement = createOperationalBreakMovement(validInput(state), "break-1");
    expect(movement).toMatchObject({
      id: "break-1",
      scheduleDayId: "day-1",
      driverId: state.movements[0].driverId,
      vehicleId: state.movements[0].vehicleId,
      driverStart: "",
      pickups: [],
      departureTime: "",
      arrivalTime: "",
      eventStartTime: "10:00",
      eventEndTime: "11:00",
      endTime: "",
      engagementDetails: "Lunch",
      venue: "Restaurant",
      address: "Main Street 1",
      workClassification: "break",
      continuesOvernight: false,
      conflictOverrides: [],
      audiences: { executive: false, operational: true, cg: false, marida: false, driverIds: [] },
      isExecutiveVisible: false,
      isOperationalVisible: true,
    });
  });

  it("inserts exactly at the requested position and renumbers only the target day", () => {
    const day = { id: "day-1", date: "2026-01-01" };
    const existing = [
      { id: "a", scheduleDayId: "day-1", driverId: "d1", sortOrder: 10 },
      { id: "b", scheduleDayId: "day-1", driverId: "d2", sortOrder: 20 },
      { id: "c", scheduleDayId: "day-1", driverId: "d1", sortOrder: 30 },
      { id: "other-day", scheduleDayId: "day-2", driverId: "d1", sortOrder: 77 },
    ];
    const inserted = insertMovementIntoDay(existing, { id: "break", scheduleDayId: "day-1", driverId: "d1" }, day, "a", "c");
    expect(inserted.filter((item) => item.scheduleDayId === "day-1").sort((a, b) => a.sortOrder - b.sortOrder).map((item) => item.id)).toEqual(["a", "b", "break", "c"]);
    expect(inserted.find((item) => item.id === "other-day").sortOrder).toBe(77);
    expect(existing.map((item) => item.sortOrder)).toEqual([10, 20, 30, 77]);
  });

  it("accepts event-only timing, rejects resource conflicts, and round-trips through backups", () => {
    const state = validState();
    state.vehicleHandoverNotes = [];
    expect(hasMovementTiming({ eventStartTime: "10:00", eventEndTime: "11:00", pickups: [] })).toBe(true);
    const conflict = createOperationalBreakMovement(validInput(state, { eventStartTime: "08:15", eventEndTime: "08:45" }), "break-conflict");
    expect(validateMovementCandidate(state, conflict).blocking.some((issue) => issue.type === "DRIVER_OVERLAP")).toBe(true);

    const movement = { ...createOperationalBreakMovement(validInput(state), "break-valid"), sortOrder: 20 };
    state.movements.push(movement);
    const prepared = prepareBackupImport({ raw: JSON.stringify(createFullBackup(state)), currentState: validState() });
    expect(prepared.ok).toBe(true);
    expect(prepared.candidate.movements.find((item) => item.id === movement.id)).toMatchObject({
      eventStartTime: "10:00",
      eventEndTime: "11:00",
      workClassification: "break",
      audiences: { executive: false, operational: true, cg: false, marida: false, driverIds: [] },
    });
  });
});
