const EMPTY = "-";

const headers = ["Type", "Title", "From", "To", "Distance", "Estimated Travel Time", "Name", "Phone", "Email", "Address", "Notes"];

function sortedItems(items) {
  return [...items].sort((a, b) => (a.sortOrder ?? Number.MAX_SAFE_INTEGER) - (b.sortOrder ?? Number.MAX_SAFE_INTEGER));
}

export default function ImportantInfoView({ items = [] }) {
  const sorted = sortedItems(items);

  if (sorted.length === 0) {
    return (
      <div className="py-12 text-center text-neutral-400 border-2 border-dashed rounded-3xl italic">
        No important information saved yet.
      </div>
    );
  }

  return (
    <div className="overflow-x-auto">
      <table className="min-w-[1180px] w-full border-collapse border border-neutral-200 bg-white text-xs shadow-sm">
        <thead>
          <tr className="bg-neutral-50 text-[10px] uppercase font-black tracking-tighter text-neutral-500">
            {headers.map((header) => (
              <th key={header} className="border border-neutral-200 p-3 text-left">
                {header}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {sorted.map((item) => (
            <tr key={item.id} className="align-top">
              <td className="border border-neutral-200 p-3 font-black uppercase tracking-wide text-neutral-700">{item.type || EMPTY}</td>
              <td className="border border-neutral-200 p-3 font-semibold text-neutral-900">{item.title || EMPTY}</td>
              <td className="border border-neutral-200 p-3">{item.from || EMPTY}</td>
              <td className="border border-neutral-200 p-3">{item.to || EMPTY}</td>
              <td className="border border-neutral-200 p-3">{item.distance || EMPTY}</td>
              <td className="border border-neutral-200 p-3">{item.estimatedTravelTime || EMPTY}</td>
              <td className="border border-neutral-200 p-3">{item.name || EMPTY}</td>
              <td className="border border-neutral-200 p-3">{item.phone || EMPTY}</td>
              <td className="border border-neutral-200 p-3">{item.email || EMPTY}</td>
              <td className="border border-neutral-200 p-3">{item.address || EMPTY}</td>
              <td className="border border-neutral-200 p-3 whitespace-pre-line">{item.notes || EMPTY}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
