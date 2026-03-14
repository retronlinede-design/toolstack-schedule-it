import React, { useEffect, useMemo, useState } from "react";
import { CalendarDays, Car, Clock3, Download, FileText, MapPin, Phone, Printer, RotateCcw, Save, Users } from "lucide-react";

const KEY = "toolstack.scheduleit.v1";

const emptyForm = {
  missionName: "South African Consulate-General Munich",
  documentTitle: "CG Event & Transport Schedule",
  date: "",
  weekday: "",
  eventTitle: "",
  eventType: "",
  host: "",
  organizer: "",
  venueName: "",
  venueAddress: "",
  pickupLocation: "",
  contactPerson: "",
  contactPhone: "",
  cgName: "",
  attendees: "",
  driverName: "",
  vehicle: "",
  registration: "",
  pickupTime: "",
  departureTime: "",
  arrivalTime: "",
  eventStartTime: "",
  eventEndTime: "",
  returnDepartureTime: "",
  estimatedReturnTime: "",
  parkingNotes: "",
  routeNotes: "",
  securityNotes: "",
  protocolNotes: "",
  dressCode: "",
  documentsToCarry: "",
  materialsOrGifts: "",
  specialInstructions: "",
  generalNotes: "",
  preparedBy: "",
  preparedDate: "",
};

function formatLongDate(value) {
  if (!value) return "";
  const d = new Date(`${value}T12:00:00`);
  if (Number.isNaN(d.getTime())) return value;
  return d.toLocaleDateString(undefined, {
    weekday: "long",
    year: "numeric",
    month: "long",
    day: "numeric",
  });
}

function downloadJson(filename, data) {
  const blob = new Blob([JSON.stringify(data, null, 2)], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

function Field({ label, icon: Icon, children }) {
  return (
    <label className="block">
      <div className="mb-1 flex items-center gap-2 text-sm font-medium text-neutral-700">
        {Icon ? <Icon className="h-4 w-4" /> : null}
        <span>{label}</span>
      </div>
      {children}
    </label>
  );
}

function Input(props) {
  return (
    <input
      {...props}
      className="w-full rounded-2xl border border-neutral-300 bg-white px-3 py-2 text-sm text-neutral-900 shadow-sm outline-none transition focus:border-neutral-500 focus:ring-2 focus:ring-neutral-200"
    />
  );
}

function Textarea(props) {
  return (
    <textarea
      {...props}
      className="min-h-[96px] w-full rounded-2xl border border-neutral-300 bg-white px-3 py-2 text-sm text-neutral-900 shadow-sm outline-none transition focus:border-neutral-500 focus:ring-2 focus:ring-neutral-200"
    />
  );
}

function SectionCard({ title, subtitle, children }) {
  return (
    <section className="rounded-3xl border border-neutral-200 bg-white p-4 shadow-sm md:p-5">
      <div className="mb-4">
        <h2 className="text-lg font-semibold text-neutral-900">{title}</h2>
        {subtitle ? <p className="mt-1 text-sm text-neutral-600">{subtitle}</p> : null}
      </div>
      <div className="space-y-4">{children}</div>
    </section>
  );
}

function PreviewRow({ label, value }) {
  return (
    <div className="grid grid-cols-[160px_1fr] gap-3 border-b border-neutral-200 py-2 text-sm last:border-b-0">
      <div className="font-medium text-neutral-700">{label}</div>
      <div className="whitespace-pre-wrap text-neutral-900">{value || "—"}</div>
    </div>
  );
}

export default function ScheduleItBasicApp() {
  const [form, setForm] = useState(emptyForm);

  useEffect(() => {
    const raw = localStorage.getItem(KEY);
    if (!raw) return;
    try {
      const parsed = JSON.parse(raw);
      setForm({ ...emptyForm, ...parsed });
    } catch {
      // ignore corrupt local data
    }
  }, []);

  useEffect(() => {
    localStorage.setItem(KEY, JSON.stringify(form));
  }, [form]);

  useEffect(() => {
    if (!form.date) return;
    const d = new Date(`${form.date}T12:00:00`);
    if (Number.isNaN(d.getTime())) return;
    const weekday = d.toLocaleDateString(undefined, { weekday: "long" });
    if (weekday !== form.weekday) {
      setForm((prev) => ({ ...prev, weekday }));
    }
  }, [form.date]);

  const displayDate = useMemo(() => formatLongDate(form.date), [form.date]);

  function updateField(name, value) {
    setForm((prev) => ({ ...prev, [name]: value }));
  }

  function resetForm() {
    const ok = window.confirm("Clear the current schedule and reset all fields?");
    if (!ok) return;
    setForm(emptyForm);
  }

  function exportData() {
    const safeDate = form.date || "undated";
    downloadJson(`schedule-it-${safeDate}.json`, form);
  }

  function importData(event) {
    const file = event.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      try {
        const parsed = JSON.parse(String(reader.result || "{}"));
        setForm({ ...emptyForm, ...parsed });
      } catch {
        window.alert("That file could not be imported.");
      }
    };
    reader.readAsText(file);
    event.target.value = "";
  }

  function printPreview() {
    window.print();
  }

  return (
    <div className="min-h-screen bg-neutral-100 text-neutral-900">
      <style>{`
        @media print {
          body * { visibility: hidden; }
          #print-sheet, #print-sheet * { visibility: visible; }
          #print-sheet { position: absolute; left: 0; top: 0; width: 100%; }
          .no-print { display: none !important; }
          body { background: white; }
        }
      `}</style>

      <div className="mx-auto max-w-7xl p-4 md:p-6">
        <div className="no-print mb-6 rounded-3xl border border-neutral-200 bg-white p-5 shadow-sm">
          <div className="flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
            <div>
              <div className="text-sm font-medium uppercase tracking-[0.18em] text-neutral-500">ToolStack / Mission Workflow</div>
              <h1 className="mt-2 text-3xl font-semibold tracking-tight">Schedule-It</h1>
              <p className="mt-2 max-w-3xl text-sm text-neutral-600">
                Basic mission schedule and driver brief builder. Enter the event details on the left and use the live preview on the right as the starting point for your official template workflow.
              </p>
            </div>
            <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
              <button onClick={printPreview} className="inline-flex items-center justify-center gap-2 rounded-2xl bg-neutral-800 px-4 py-2 text-sm font-medium text-white shadow-sm transition hover:bg-neutral-700">
                <Printer className="h-4 w-4" /> Print
              </button>
              <button onClick={exportData} className="inline-flex items-center justify-center gap-2 rounded-2xl border border-neutral-300 bg-white px-4 py-2 text-sm font-medium text-neutral-800 shadow-sm transition hover:bg-neutral-50">
                <Download className="h-4 w-4" /> Export
              </button>
              <label className="inline-flex cursor-pointer items-center justify-center gap-2 rounded-2xl border border-neutral-300 bg-white px-4 py-2 text-sm font-medium text-neutral-800 shadow-sm transition hover:bg-neutral-50">
                <Save className="h-4 w-4" /> Import
                <input type="file" accept="application/json" className="hidden" onChange={importData} />
              </label>
              <button onClick={resetForm} className="inline-flex items-center justify-center gap-2 rounded-2xl border border-neutral-300 bg-white px-4 py-2 text-sm font-medium text-neutral-800 shadow-sm transition hover:bg-neutral-50">
                <RotateCcw className="h-4 w-4" /> Reset
              </button>
            </div>
          </div>
        </div>

        <div className="grid gap-6 xl:grid-cols-[1.05fr_0.95fr]">
          <div className="no-print space-y-6">
            <SectionCard title="General Event Information" subtitle="Core identity of the meeting or event.">
              <div className="grid gap-4 md:grid-cols-2">
                <Field label="Mission Name" icon={FileText}><Input value={form.missionName} onChange={(e) => updateField("missionName", e.target.value)} /></Field>
                <Field label="Document Title" icon={FileText}><Input value={form.documentTitle} onChange={(e) => updateField("documentTitle", e.target.value)} /></Field>
                <Field label="Date" icon={CalendarDays}><Input type="date" value={form.date} onChange={(e) => updateField("date", e.target.value)} /></Field>
                <Field label="Weekday" icon={CalendarDays}><Input value={form.weekday} onChange={(e) => updateField("weekday", e.target.value)} /></Field>
                <Field label="Event Title" icon={FileText}><Input value={form.eventTitle} onChange={(e) => updateField("eventTitle", e.target.value)} /></Field>
                <Field label="Event Type" icon={FileText}><Input value={form.eventType} onChange={(e) => updateField("eventType", e.target.value)} placeholder="Meeting, reception, airport transfer..." /></Field>
                <Field label="Host" icon={Users}><Input value={form.host} onChange={(e) => updateField("host", e.target.value)} /></Field>
                <Field label="Organizer" icon={Users}><Input value={form.organizer} onChange={(e) => updateField("organizer", e.target.value)} /></Field>
                <Field label="Venue Name" icon={MapPin}><Input value={form.venueName} onChange={(e) => updateField("venueName", e.target.value)} /></Field>
                <Field label="Venue Address" icon={MapPin}><Input value={form.venueAddress} onChange={(e) => updateField("venueAddress", e.target.value)} /></Field>
                <Field label="Pickup Location" icon={MapPin}><Input value={form.pickupLocation} onChange={(e) => updateField("pickupLocation", e.target.value)} /></Field>
                <Field label="Contact Person" icon={Phone}><Input value={form.contactPerson} onChange={(e) => updateField("contactPerson", e.target.value)} /></Field>
                <Field label="Contact Phone" icon={Phone}><Input value={form.contactPhone} onChange={(e) => updateField("contactPhone", e.target.value)} /></Field>
                <Field label="CG Name" icon={Users}><Input value={form.cgName} onChange={(e) => updateField("cgName", e.target.value)} /></Field>
              </div>
              <Field label="Attendees / Accompanying Persons" icon={Users}>
                <Textarea value={form.attendees} onChange={(e) => updateField("attendees", e.target.value)} />
              </Field>
            </SectionCard>

            <SectionCard title="Transport and Timing" subtitle="Movement times and vehicle details.">
              <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
                <Field label="Driver Name" icon={Car}><Input value={form.driverName} onChange={(e) => updateField("driverName", e.target.value)} /></Field>
                <Field label="Vehicle" icon={Car}><Input value={form.vehicle} onChange={(e) => updateField("vehicle", e.target.value)} /></Field>
                <Field label="Registration" icon={Car}><Input value={form.registration} onChange={(e) => updateField("registration", e.target.value)} /></Field>
                <div />
                <Field label="Pickup Time" icon={Clock3}><Input type="time" value={form.pickupTime} onChange={(e) => updateField("pickupTime", e.target.value)} /></Field>
                <Field label="Departure Time" icon={Clock3}><Input type="time" value={form.departureTime} onChange={(e) => updateField("departureTime", e.target.value)} /></Field>
                <Field label="Arrival Time" icon={Clock3}><Input type="time" value={form.arrivalTime} onChange={(e) => updateField("arrivalTime", e.target.value)} /></Field>
                <Field label="Event Start" icon={Clock3}><Input type="time" value={form.eventStartTime} onChange={(e) => updateField("eventStartTime", e.target.value)} /></Field>
                <Field label="Event End" icon={Clock3}><Input type="time" value={form.eventEndTime} onChange={(e) => updateField("eventEndTime", e.target.value)} /></Field>
                <Field label="Return Departure" icon={Clock3}><Input type="time" value={form.returnDepartureTime} onChange={(e) => updateField("returnDepartureTime", e.target.value)} /></Field>
                <Field label="Estimated Return" icon={Clock3}><Input type="time" value={form.estimatedReturnTime} onChange={(e) => updateField("estimatedReturnTime", e.target.value)} /></Field>
              </div>
              <div className="grid gap-4 md:grid-cols-2">
                <Field label="Parking Notes" icon={MapPin}><Textarea value={form.parkingNotes} onChange={(e) => updateField("parkingNotes", e.target.value)} /></Field>
                <Field label="Route Notes" icon={MapPin}><Textarea value={form.routeNotes} onChange={(e) => updateField("routeNotes", e.target.value)} /></Field>
              </div>
            </SectionCard>

            <SectionCard title="Protocol, Security and Notes" subtitle="Operational detail for the day.">
              <div className="grid gap-4 md:grid-cols-2">
                <Field label="Security Notes"><Textarea value={form.securityNotes} onChange={(e) => updateField("securityNotes", e.target.value)} /></Field>
                <Field label="Protocol Notes"><Textarea value={form.protocolNotes} onChange={(e) => updateField("protocolNotes", e.target.value)} /></Field>
                <Field label="Dress Code"><Textarea value={form.dressCode} onChange={(e) => updateField("dressCode", e.target.value)} /></Field>
                <Field label="Documents to Carry"><Textarea value={form.documentsToCarry} onChange={(e) => updateField("documentsToCarry", e.target.value)} /></Field>
                <Field label="Materials / Gifts"><Textarea value={form.materialsOrGifts} onChange={(e) => updateField("materialsOrGifts", e.target.value)} /></Field>
                <Field label="Special Instructions"><Textarea value={form.specialInstructions} onChange={(e) => updateField("specialInstructions", e.target.value)} /></Field>
              </div>
              <Field label="General Notes">
                <Textarea value={form.generalNotes} onChange={(e) => updateField("generalNotes", e.target.value)} />
              </Field>
              <div className="grid gap-4 md:grid-cols-2">
                <Field label="Prepared By"><Input value={form.preparedBy} onChange={(e) => updateField("preparedBy", e.target.value)} /></Field>
                <Field label="Prepared Date"><Input type="date" value={form.preparedDate} onChange={(e) => updateField("preparedDate", e.target.value)} /></Field>
              </div>
            </SectionCard>
          </div>

          <div>
            <div id="print-sheet" className="rounded-3xl border border-neutral-200 bg-white p-6 shadow-sm md:p-8">
              <div className="border-b border-neutral-300 pb-4">
                <div className="text-xs font-semibold uppercase tracking-[0.24em] text-neutral-500">Mission Schedule Preview</div>
                <h2 className="mt-2 text-2xl font-semibold text-neutral-900">{form.documentTitle || "CG Event & Transport Schedule"}</h2>
                <div className="mt-2 text-sm text-neutral-700">{form.missionName || "—"}</div>
              </div>

              <div className="mt-6 rounded-2xl border border-neutral-200 bg-neutral-50 p-4">
                <div className="grid gap-3 md:grid-cols-2">
                  <div>
                    <div className="text-xs font-semibold uppercase tracking-wide text-neutral-500">Date</div>
                    <div className="mt-1 text-sm text-neutral-900">{displayDate || "—"}</div>
                  </div>
                  <div>
                    <div className="text-xs font-semibold uppercase tracking-wide text-neutral-500">Event</div>
                    <div className="mt-1 text-sm text-neutral-900">{form.eventTitle || "—"}</div>
                  </div>
                  <div>
                    <div className="text-xs font-semibold uppercase tracking-wide text-neutral-500">Venue</div>
                    <div className="mt-1 text-sm text-neutral-900">{form.venueName || "—"}</div>
                  </div>
                  <div>
                    <div className="text-xs font-semibold uppercase tracking-wide text-neutral-500">CG</div>
                    <div className="mt-1 text-sm text-neutral-900">{form.cgName || "—"}</div>
                  </div>
                </div>
              </div>

              <div className="mt-6">
                <h3 className="mb-2 text-base font-semibold">1. General Information</h3>
                <div className="rounded-2xl border border-neutral-200 px-4 py-2">
                  <PreviewRow label="Weekday" value={form.weekday} />
                  <PreviewRow label="Date" value={displayDate} />
                  <PreviewRow label="Event Title" value={form.eventTitle} />
                  <PreviewRow label="Event Type" value={form.eventType} />
                  <PreviewRow label="Host" value={form.host} />
                  <PreviewRow label="Organizer" value={form.organizer} />
                  <PreviewRow label="Venue" value={form.venueName} />
                  <PreviewRow label="Address" value={form.venueAddress} />
                  <PreviewRow label="Contact Person" value={form.contactPerson} />
                  <PreviewRow label="Contact Number" value={form.contactPhone} />
                  <PreviewRow label="Attendees" value={form.attendees} />
                </div>
              </div>

              <div className="mt-6">
                <h3 className="mb-2 text-base font-semibold">2. Transport Schedule</h3>
                <div className="rounded-2xl border border-neutral-200 px-4 py-2">
                  <PreviewRow label="Driver" value={form.driverName} />
                  <PreviewRow label="Vehicle" value={[form.vehicle, form.registration].filter(Boolean).join(" / ")} />
                  <PreviewRow label="Pickup Location" value={form.pickupLocation} />
                  <PreviewRow label="Pickup Time" value={form.pickupTime} />
                  <PreviewRow label="Departure Time" value={form.departureTime} />
                  <PreviewRow label="Arrival Time" value={form.arrivalTime} />
                  <PreviewRow label="Event Start" value={form.eventStartTime} />
                  <PreviewRow label="Event End" value={form.eventEndTime} />
                  <PreviewRow label="Return Departure" value={form.returnDepartureTime} />
                  <PreviewRow label="Estimated Return" value={form.estimatedReturnTime} />
                  <PreviewRow label="Parking Notes" value={form.parkingNotes} />
                  <PreviewRow label="Route Notes" value={form.routeNotes} />
                </div>
              </div>

              <div className="mt-6">
                <h3 className="mb-2 text-base font-semibold">3. Protocol and Operational Notes</h3>
                <div className="rounded-2xl border border-neutral-200 px-4 py-2">
                  <PreviewRow label="Security Notes" value={form.securityNotes} />
                  <PreviewRow label="Protocol Notes" value={form.protocolNotes} />
                  <PreviewRow label="Dress Code" value={form.dressCode} />
                  <PreviewRow label="Documents to Carry" value={form.documentsToCarry} />
                  <PreviewRow label="Materials / Gifts" value={form.materialsOrGifts} />
                  <PreviewRow label="Special Instructions" value={form.specialInstructions} />
                  <PreviewRow label="General Notes" value={form.generalNotes} />
                </div>
              </div>

              <div className="mt-8 grid gap-6 md:grid-cols-2">
                <div>
                  <div className="text-xs font-semibold uppercase tracking-wide text-neutral-500">Prepared By</div>
                  <div className="mt-2 border-b border-neutral-300 pb-2 text-sm text-neutral-900">{form.preparedBy || "—"}</div>
                </div>
                <div>
                  <div className="text-xs font-semibold uppercase tracking-wide text-neutral-500">Prepared Date</div>
                  <div className="mt-2 border-b border-neutral-300 pb-2 text-sm text-neutral-900">{formatLongDate(form.preparedDate) || "—"}</div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
