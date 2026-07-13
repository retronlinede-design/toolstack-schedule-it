import { sortPickups } from "./pickups";

export function pickupViewModels(movement) {
  return sortPickups(movement?.pickups || []).map((pickup, index) => ({ ...pickup, sequence: index + 1 }));
}

export function pickupSummary(movement) {
  const pickups = pickupViewModels(movement);
  if (!pickups.length) return "No pickups";
  return `${pickups.length} pickup${pickups.length === 1 ? "" : "s"}${pickups[0].time ? ` · First at ${pickups[0].time}` : ""}`;
}

export function pickupBadge(movement) {
  const pickups = pickupViewModels(movement);
  if (!pickups.length) return "";
  return pickups.length === 1 && pickups[0].time ? `Pickup ${pickups[0].time}` : `${pickups.length} pickups`;
}

function basicExecutivePickupText(movement) {
  const pickups = pickupViewModels(movement);
  if (!pickups.length) return "";
  return `Pickups: ${pickups.map((pickup) => [pickup.time, pickup.person, pickup.location && `— ${pickup.location}`].filter(Boolean).join(" ")).join("; ")}`;
}

export function executivePickupText(movement) {
  const summary = basicExecutivePickupText(movement);
  const details = movement?.printPickupDetails || {};
  const extra = pickupViewModels(movement).flatMap((pickup) => [
    details.addresses ? pickup.address : "",
    details.contacts && pickup.contactPhone ? `Contact: ${pickup.contactPhone}` : "",
    details.notes ? pickup.notes : "",
  ]).filter(Boolean);
  return extra.length ? `${summary} · ${extra.join(" · ")}` : summary;
}

export function operationalPickupText(movement) {
  const pickups = pickupViewModels(movement);
  if (!pickups.length) return "";
  return pickups.map((pickup) => [
    `${pickup.sequence}. ${pickup.time || "Time missing"} — ${pickup.location || "Location missing"}${pickup.person ? ` — ${pickup.person}` : ""}`,
    pickup.address,
    pickup.contactPhone && `Contact: ${pickup.contactPhone}`,
    pickup.notes,
  ].filter(Boolean).join("\n")).join("\n");
}
