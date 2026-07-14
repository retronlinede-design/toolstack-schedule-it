import { useMemo, useState } from "react";
import ProgrammeDocument from "./preview/ProgrammeDocument";
import { createProgrammeDocumentModel } from "./preview/programmeDocumentModel";
import Card from "./ui/Card";
import SectionHeader from "./ui/SectionHeader";
import { Button } from "./ui/Button";

const tabs = [
  { id: "executive", label: "Executive" },
  { id: "operational", label: "Operational" },
  { id: "driver", label: "Driver" },
  { id: "workingTime", label: "Working Time" },
  { id: "importantInfo", label: "Important Info" },
];

export default function PreviewTabs({ schedule, selectedDriverId, onSelectedDriverChange, onWorkingTimePolicyChange, onEdit, onDelete, onReorderMovements, onMoveVehicleHandoverInOperational }) {
  const [activeTab, setActiveTab] = useState("executive");
  const model = useMemo(() => createProgrammeDocumentModel(schedule, activeTab, { selectedDriverId }), [schedule, activeTab, selectedDriverId]);
  const interactions = { onSelectedDriverChange, onWorkingTimePolicyChange, onEdit, onDelete, onReorderMovements, onMoveVehicleHandoverInOperational };

  return <div className="mt-8 no-print">
    <Card className="p-4 md:p-5">
      <SectionHeader title="Current Programme Preview" description="Live view of your mission schedule" />
      <div className="mb-4 flex flex-wrap gap-2">{tabs.map((tab) => <Button key={tab.id} onClick={() => setActiveTab(tab.id)} variant={activeTab === tab.id ? "primary" : "secondary"} className="min-h-10 px-3 py-2 text-xs">{tab.label}</Button>)}</div>
      <ProgrammeDocument model={model} showControls interactions={interactions} />
    </Card>
  </div>;
}
