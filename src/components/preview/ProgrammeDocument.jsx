import DriverView from "../DriverView";
import ExecutiveView from "../ExecutiveView";
import ImportantInfoView from "../ImportantInfoView";
import OperationalView from "../OperationalView";
import WorkingTimeSummary from "../WorkingTimeSummary";

export default function ProgrammeDocument({ model, showControls = false, interactions = {} }) {
  const { view, schedule, entriesByMonth, selectedDriverId } = model;
  const common = { entriesByMonth, drivers: schedule.drivers, vehicles: schedule.vehicles };
  return <div className="programme-document min-w-0 max-w-full bg-white">
    {view === "executive" || view === "executiveCg" || view === "executiveMarida" ? <ExecutiveView {...common} profile={schedule.profile} variant={showControls ? undefined : view} showVariantControls={showControls} onEdit={interactions.onEdit} onDelete={interactions.onDelete} /> : null}
    {view === "operational" ? <OperationalView {...common} vehicleHandoverNotes={schedule.vehicleHandoverNotes || []} scheduleDays={schedule.scheduleDays} onEdit={interactions.onEdit} onDelete={interactions.onDelete} onReorderMovements={interactions.onReorderMovements} onMoveVehicleHandoverInOperational={interactions.onMoveVehicleHandoverInOperational} /> : null}
    {view === "driver" ? <DriverView {...common} vehicleHandoverNotes={schedule.vehicleHandoverNotes || []} scheduleDays={schedule.scheduleDays} selectedDriverId={selectedDriverId} showDriverControl={showControls} onSelectedDriverChange={interactions.onSelectedDriverChange} onEdit={interactions.onEdit} onDelete={interactions.onDelete} /> : null}
    {view === "workingTime" ? <WorkingTimeSummary movements={schedule.movements} drivers={schedule.drivers} vehicles={schedule.vehicles} scheduleDays={schedule.scheduleDays} workingTimePolicy={schedule.workingTimePolicy} showControls={showControls} onWorkingTimePolicyChange={interactions.onWorkingTimePolicyChange} /> : null}
    {view === "importantInfo" ? <ImportantInfoView items={schedule.importantInfoItems || []} /> : null}
  </div>;
}
