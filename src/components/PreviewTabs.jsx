import { useState } from "react";
import DriverView from "./DriverView";
import ExecutiveView from "./ExecutiveView";
import ImportantInfoView from "./ImportantInfoView";
import OperationalView from "./OperationalView";
import WorkingTimeSummary from "./WorkingTimeSummary";
import Card from "./ui/Card";
import SectionHeader from "./ui/SectionHeader";
import { Button } from "./ui/Button";

const tabs = [
  { id: "executive", label: "Executive" },
  { id: "operational", label: "Operational" },
  { id: "driver", label: "Driver" },
  { id: "summary", label: "Working Time" },
  { id: "importantInfo", label: "Important Info" },
];

function SectionCard({ title, subtitle, children }) {
  return (
    <Card className="p-4 md:p-5">
      <SectionHeader title={title} description={subtitle} />
      <div className="space-y-4">{children}</div>
    </Card>
  );
}

export default function PreviewTabs({
  entriesByMonth,
  profile,
  movements,
  vehicleHandoverNotes,
  importantInfoItems,
  drivers,
  vehicles,
  scheduleDays,
  workingTimePolicy,
  onWorkingTimePolicyChange,
  selectedDriverId,
  onSelectedDriverChange,
  onEdit,
  onDelete,
  onReorderMovements,
  onMoveVehicleHandoverInOperational,
}) {
  const [activeTab, setActiveTab] = useState("executive");

  return (
    <div className="mt-8 no-print">
      <SectionCard title="Current Programme Preview" subtitle="Live view of your mission schedule">
        <div className="mb-4 flex flex-wrap gap-2">
          {tabs.map((tab) => (
            <Button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              variant={activeTab === tab.id ? "primary" : "secondary"}
              className="min-h-10 px-3 py-2 text-xs"
            >
              {tab.label}
            </Button>
          ))}
        </div>

        {activeTab === "executive" ? (
          <ExecutiveView entriesByMonth={entriesByMonth} profile={profile} drivers={drivers} vehicles={vehicles} onEdit={onEdit} onDelete={onDelete} />
        ) : null}
        {activeTab === "operational" ? (
          <OperationalView
            entriesByMonth={entriesByMonth}
            vehicleHandoverNotes={vehicleHandoverNotes}
            drivers={drivers}
            vehicles={vehicles}
            scheduleDays={scheduleDays}
            onEdit={onEdit}
            onDelete={onDelete}
            onReorderMovements={onReorderMovements}
            onMoveVehicleHandoverInOperational={onMoveVehicleHandoverInOperational}
          />
        ) : null}
        {activeTab === "driver" ? (
          <DriverView
            entriesByMonth={entriesByMonth}
            vehicleHandoverNotes={vehicleHandoverNotes}
            drivers={drivers}
            vehicles={vehicles}
            scheduleDays={scheduleDays}
            selectedDriverId={selectedDriverId}
            onSelectedDriverChange={onSelectedDriverChange}
            onEdit={onEdit}
            onDelete={onDelete}
          />
        ) : null}
        {activeTab === "summary" ? (
          <WorkingTimeSummary movements={movements} drivers={drivers} vehicles={vehicles} scheduleDays={scheduleDays} workingTimePolicy={workingTimePolicy} onWorkingTimePolicyChange={onWorkingTimePolicyChange} />
        ) : null}
        {activeTab === "importantInfo" ? <ImportantInfoView items={importantInfoItems} /> : null}
      </SectionCard>
    </div>
  );
}
