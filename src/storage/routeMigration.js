function stablePart(value) {
  return encodeURIComponent(String(value ?? "route")).replaceAll("%", "_");
}

export function migrateRouteNotesToImportantInfo(routeNotes, scheduleDays, drivers) {
  return routeNotes.map((route, index) => {
    const day = scheduleDays.find((item) => item.id === route.scheduleDayId);
    const driver = drivers.find((item) => item.id === route.driverId);
    const context = [day?.title || day?.date, driver?.name].filter(Boolean).join(" / ");
    const contextNote = context ? `Imported from legacy route note: ${context}` : "Imported from legacy route note.";
    return {
      id: `info-route-${stablePart(route.id)}-${index + 1}`,
      type: "Route",
      title: route.from && route.to ? `${route.from} to ${route.to}` : route.from || route.to || "Route",
      from: route.from || "",
      to: route.to || "",
      distance: route.distance || "",
      estimatedTravelTime: route.estimatedTravelTime || "",
      name: "", phone: "", email: "", address: "",
      notes: [contextNote, route.notes || ""].filter(Boolean).join("\n"),
      sortOrder: Number.isFinite(route.sortOrder) ? route.sortOrder : (index + 1) * 10,
    };
  });
}
