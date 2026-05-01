import { Pencil, Trash2 } from "lucide-react";
import { formatLongDate } from "../utils/time";

const EMPTY = "-";

function getVisibleEntries(entriesByMonth) {
  return Object.entries(entriesByMonth)
    .map(([month, entries]) => [month, entries.filter((entry) => entry.isExecutiveVisible !== false)])
    .filter(([, entries]) => entries.length > 0);
}

export default function ExecutiveView({ entriesByMonth, profile, onEdit, onDelete, printMode = false }) {
  const monthEntries = getVisibleEntries(entriesByMonth);

  return (
    <div id={printMode ? "print-sheet" : undefined} className="bg-white">
      <div className="mb-6 text-center border-b border-neutral-100 pb-4">
        <h3 className="text-2xl font-black uppercase text-neutral-900 tracking-widest">{profile.missionName || "Mission Name"}</h3>
        <p className="text-md font-bold uppercase text-neutral-500 underline">{profile.documentTitle || "Programme"}</p>
      </div>

      {monthEntries.length === 0 ? (
        <div className="py-12 text-center text-neutral-400 border-2 border-dashed rounded-3xl italic">
          No executive-visible movements yet.
        </div>
      ) : (
        monthEntries.map(([month, entries]) => (
          <div key={month} className={printMode ? "mb-12 last:mb-0" : "mb-10"}>
            <h4
              className={`${printMode ? "text-xl text-neutral-900" : "text-xs text-blue-600 border-b pb-2"} font-black uppercase mb-6 tracking-widest text-center`}
            >
              {month}
            </h4>
            {entries.map((entry, index) => {
              const showDate = index === 0 || entry.day?.date !== entries[index - 1].day?.date;
              return (
                <div key={entry.id} className="mb-6 last:mb-0">
                  {showDate ? (
                    <div className={`${printMode ? "border-b" : "border-b-2"} mb-3 border-neutral-900 pb-1`}>
                      <h3 className="text-sm font-black uppercase underline">{formatLongDate(entry.day?.date)}</h3>
                    </div>
                  ) : null}
                  <table className="w-full table-fixed border-collapse border border-neutral-200 bg-white text-sm shadow-sm">
                    <colgroup>
                      <col style={{ width: "15%" }} />
                      <col style={{ width: "18%" }} />
                      <col style={{ width: "27%" }} />
                      <col style={{ width: "20%" }} />
                      <col style={{ width: "20%" }} />
                    </colgroup>
                    <thead>
                      <tr className="bg-neutral-50 text-[10px] uppercase font-black tracking-tighter text-neutral-500">
                        <th className="break-words border border-neutral-200 p-3 text-left">Time</th>
                        <th className="break-words border border-neutral-200 p-3 text-left">Movement</th>
                        <th className="break-words border border-neutral-200 p-3 text-left">Details</th>
                        <th className="break-words border border-neutral-200 p-3 text-left">Venue</th>
                        <th className="break-words border border-neutral-200 p-3 text-left">Address</th>
                      </tr>
                    </thead>
                    <tbody>
                      <tr className="group align-top transition-colors hover:bg-neutral-50/50">
                        <td className="break-words border border-neutral-200 p-3 font-bold text-neutral-900">{entry.eventStartTime || entry.departureTime || EMPTY}</td>
                        <td className="break-words border border-neutral-200 p-3 font-semibold text-neutral-900">{entry.engagementDetails || EMPTY}</td>
                        <td className="break-words border border-neutral-200 p-3 text-neutral-700">
                          <div>{entry.participants || EMPTY}</div>
                          {entry.dressCode ? <div className="mt-1 text-xs text-neutral-500">Attire: {entry.dressCode}</div> : null}
                        </td>
                        <td className="break-words border border-neutral-200 p-3 font-bold text-neutral-900">{entry.venue || EMPTY}</td>
                        <td className="break-words border border-neutral-200 p-3 text-xs text-neutral-700">{entry.address || EMPTY}</td>
                      </tr>
                    </tbody>
                  </table>
                  <div className="no-print mt-2 flex justify-end gap-1">
                    <button onClick={() => onEdit(entry)} className="p-2 bg-blue-50 text-blue-600 rounded-lg" title="Edit">
                      <Pencil className="h-4 w-4" />
                    </button>
                    <button onClick={() => onDelete(entry.id)} className="p-2 bg-red-50 text-red-600 rounded-lg" title="Delete">
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        ))
      )}
    </div>
  );
}
