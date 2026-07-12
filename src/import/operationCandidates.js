import { defaultProfile } from "../data/defaultData";

export function createClearCandidate(current) {
  return {
    ...current,
    profile: defaultProfile,
    scheduleDays: [],
    movements: [],
    vehicleHandoverNotes: [],
    importantInfoItems: [],
    routeNotes: [],
  };
}
