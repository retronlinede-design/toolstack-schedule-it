import { defaultScheduleState } from "../data/defaultData";

export function validState() {
  return JSON.parse(JSON.stringify({
    ...defaultScheduleState,
    scheduleDays: [{ id: "day-1", date: "2026-01-01", title: "Day" }],
    movements: [{
      id: "movement-1", scheduleDayId: "day-1", sortOrder: 10, driverId: "driver-greg", vehicleId: "vehicle-vito",
      driverStart: "08:00", departureTime: "", arrivalTime: "", endTime: "09:00", engagementDetails: "Test", venue: "Venue",
      address: "", locationNotes: "", participants: "", parking: "", internalNotes: "", isExecutiveVisible: true, isOperationalVisible: true,
      audiences: { executive: true, operational: true, cg: false, marida: false, driverIds: [] },
    }],
    vehicleHandoverNotes: [{ id: "handover-1", scheduleDayId: "day-1", vehicleId: "vehicle-vito", fromDriverId: "driver-greg", toDriverId: "driver-rory", visibleToDriverIds: ["driver-greg"], location: "Garage", instruction: "", keyLocation: "", time: "09:00", notes: "", sortOrder: 10 }],
    importantInfoItems: [{ id: "info-1", type: "Note", title: "Info", from: "", to: "", distance: "", estimatedTravelTime: "", name: "", phone: "", email: "", address: "", notes: "Text", sortOrder: 10 }],
    routeNotes: [],
  }));
}
