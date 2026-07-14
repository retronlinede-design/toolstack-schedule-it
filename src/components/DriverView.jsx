import OperationalView from "./OperationalView";
import { selectMovementsForView } from "../domain/audiences";

export default function DriverView({
  entriesByMonth,
  vehicleHandoverNotes = [],
  drivers,
  vehicles,
  scheduleDays,
  selectedDriverId,
  showDriverControl = true,
  onSelectedDriverChange,
  onEdit,
  onDelete,
}) {
  const selectedDriver = drivers.find((driver) => driver.id === selectedDriverId) || drivers[0];
  const selectedVehicle = vehicles.find((vehicle) => vehicle.id === selectedDriver?.defaultVehicle);
  const filteredEntriesByMonth = Object.entries(entriesByMonth).reduce((acc, [month, entries]) => {
    const driverEntries = selectMovementsForView(entries, "driver", { selectedDriverId: selectedDriver?.id });
    if (driverEntries.length > 0) acc[month] = driverEntries;
    return acc;
  }, {});

  if (!selectedDriver) {
    return (
      <div className="py-12 text-center text-neutral-400 border-2 border-dashed rounded-3xl italic">
        No drivers are available.
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-col gap-3 border-b border-neutral-100 pb-4 md:flex-row md:items-end md:justify-between">
        <div>
          <p className="text-xs font-black uppercase tracking-widest text-neutral-400">Driver Sheet</p>
          <h3 className="text-xl font-black text-neutral-900">{selectedDriver.name}</h3>
          <p className="text-sm text-neutral-500">Vehicle: {selectedVehicle?.name || "-"}</p>
        </div>
        {showDriverControl ? <label className="programme-controls no-print block min-w-56">
          <span className="mb-2 block text-sm text-neutral-700">Driver</span>
          <select
            value={selectedDriver.id}
            onChange={(event) => onSelectedDriverChange(event.target.value)}
            className="w-full rounded-2xl border border-neutral-300 bg-white px-3 py-2 text-sm text-neutral-900 shadow-sm outline-none transition focus:border-neutral-500 focus:ring-2 focus:ring-neutral-200"
          >
            {drivers.map((driver) => (
              <option key={driver.id} value={driver.id}>
                {driver.name}
              </option>
            ))}
          </select>
        </label> : null}
      </div>

      <OperationalView
        entriesByMonth={filteredEntriesByMonth}
        vehicleHandoverNotes={vehicleHandoverNotes}
        drivers={drivers}
        vehicles={vehicles}
        scheduleDays={scheduleDays}
        groupByDriver={false}
        selectedDriverId={selectedDriver.id}
        onEdit={onEdit}
        onDelete={onDelete}
      />
    </div>
  );
}
