import { useState } from "react";
import DriverView from "./DriverView";
import ExecutiveView from "./ExecutiveView";
import OperationalView from "./OperationalView";
import WorkingTimeSummary from "./WorkingTimeSummary";

const tabs = [
  { id: "executive", label: "Executive" },
  { id: "operational", label: "Operational" },
  { id: "driver", label: "Driver" },
  { id: "summary", label: "Working Time" },
];

function SectionCard({ title, subtitle, children }) {
  return (
    <section className="rounded-3xl bg-white p-4 shadow-sm md:p-5">
      <div className="mb-3">
        <h2 className="text-xl font-semibold text-neutral-900">{title}</h2>
        {subtitle ? <p className="mt-1 text-sm text-neutral-700">{subtitle}</p> : null}
      </div>
      <div className="space-y-4">{children}</div>
    </section>
  );
}

export default function PreviewTabs({
  entriesByMonth,
  profile,
  movements,
  routeNotes,
  drivers,
  vehicles,
  scheduleDays,
  selectedDriverId,
  onSelectedDriverChange,
  onEdit,
  onDelete,
}) {
  const [activeTab, setActiveTab] = useState("executive");

  return (
    <div className="mt-8 no-print">
      <SectionCard title="Current Programme Preview" subtitle="Live view of your mission schedule">
        <div className="mb-4 flex flex-wrap gap-2">
          {tabs.map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`rounded-xl px-3 py-2 text-xs font-semibold transition ${
                activeTab === tab.id ? "bg-neutral-900 text-white" : "border border-neutral-200 bg-white text-neutral-600 hover:bg-neutral-50"
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>

        {activeTab === "executive" ? (
          <ExecutiveView entriesByMonth={entriesByMonth} profile={profile} onEdit={onEdit} onDelete={onDelete} />
        ) : null}
        {activeTab === "operational" ? (
          <OperationalView entriesByMonth={entriesByMonth} routeNotes={routeNotes} drivers={drivers} vehicles={vehicles} onEdit={onEdit} onDelete={onDelete} />
        ) : null}
        {activeTab === "driver" ? (
          <DriverView
            entriesByMonth={entriesByMonth}
            routeNotes={routeNotes}
            drivers={drivers}
            vehicles={vehicles}
            selectedDriverId={selectedDriverId}
            onSelectedDriverChange={onSelectedDriverChange}
            onEdit={onEdit}
            onDelete={onDelete}
          />
        ) : null}
        {activeTab === "summary" ? (
          <WorkingTimeSummary movements={movements} drivers={drivers} vehicles={vehicles} scheduleDays={scheduleDays} />
        ) : null}
      </SectionCard>
    </div>
  );
}
