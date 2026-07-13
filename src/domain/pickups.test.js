import { describe, expect, it } from "vitest";
import { addPickup, clonePickups, deletePickup, duplicatePickup, movePickup, normalizePickups, updatePickup, validatePickups } from "./pickups";
import { preserveClearedTimeFields } from "./schedulingMutations";

const pickup = (id, time, location, sortOrder) => ({ id, time, location, address: "", person: "", contactPhone: "", notes: "", sortOrder });

describe("movement pickups", () => {
  it("normalizes legacy and ordered pickup data deterministically", () => {
    expect(normalizePickups(undefined)).toEqual([]);
    const input = [pickup("b", "07:00", "Residence", 20), pickup("a", "06:45", "Hotel", 10)];
    expect(normalizePickups(input, "m")).toEqual([pickup("a", "06:45", "Hotel", 10), pickup("b", "07:00", "Residence", 20)]);
    expect(normalizePickups(input, "m")).toEqual(normalizePickups(input, "m"));
  });

  it("adds, edits, duplicates, deletes, and reorders without changing retained IDs", () => {
    const added = addPickup([]);
    const edited = updatePickup(added, added[0].id, { location: "Hotel", time: "06:45" });
    const duplicated = duplicatePickup(edited, edited[0].id);
    expect(duplicated).toHaveLength(2);
    expect(duplicated[1].id).not.toBe(duplicated[0].id);
    const moved = movePickup(duplicated, duplicated[1].id, "up");
    expect(moved[0].id).toBe(duplicated[1].id);
    expect(deletePickup(moved, moved[0].id)).toEqual([{ ...edited[0], sortOrder: 10 }]);
  });

  it("clones content with new collision-safe IDs", () => {
    const source = [pickup("original", "06:45", "Hotel", 10)];
    const cloned = clonePickups(source);
    expect(cloned[0]).toMatchObject({ time: "06:45", location: "Hotel", sortOrder: 10 });
    expect(cloned[0].id).not.toBe("original");
  });

  it("preserves the pickup array exactly through quick-edit updates", () => {
    const pickups = [pickup("stable", "06:45", "Hotel", 10)];
    const previous = { departureTime: "07:30", eventStartTime: "07:30", endTime: "08:00", eventEndTime: "08:00", pickups };
    const updated = { ...previous, engagementDetails: "Updated" };
    expect(preserveClearedTimeFields(updated, previous).pickups).toBe(pickups);
  });

  it("validates required fields, time, IDs, limits, keys, strings, and sort order", () => {
    expect(validatePickups([pickup("p", "06:45", "Hotel", 10)])).toEqual([]);
    const invalid = [
      { ...pickup("same", "6:45", "", Infinity), extra: true },
      { ...pickup("same", "07:00", "x".repeat(301), 20), notes: "x".repeat(5001) },
    ];
    const messages = validatePickups(invalid).map((issue) => issue.message).join(" ");
    expect(messages).toContain("HH:mm");
    expect(messages).toContain("location is required");
    expect(messages).toContain("duplicated");
    expect(messages).toContain("unsupported field");
    expect(messages).toContain("sort order");
    expect(validatePickups(Array.from({ length: 51 }, (_, index) => pickup(`p-${index}`, "", "Place", index * 10))).some((issue) => issue.message.includes("at most 50"))).toBe(true);
  });
});
