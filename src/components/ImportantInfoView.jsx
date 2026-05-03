const typeOrder = ["Route", "Contact", "Address", "Note"];

function sortedItems(items) {
  return [...items].sort((a, b) => (a.sortOrder ?? Number.MAX_SAFE_INTEGER) - (b.sortOrder ?? Number.MAX_SAFE_INTEGER));
}

function Detail({ label, value }) {
  if (!value) return null;

  return (
    <div className="border-t border-neutral-100 pt-2">
      <div className="text-[10px] font-black uppercase tracking-widest text-neutral-400">{label}</div>
      <div className="mt-1 text-sm font-semibold text-neutral-800">{value}</div>
    </div>
  );
}

function ImportantInfoCard({ item }) {
  const title = item.title || item.name || item.from || item.address || "Important Information";

  return (
    <article className="min-w-0 max-w-full rounded-xl border border-neutral-200 bg-white p-4 shadow-sm">
      <div className="mb-3">
        <div className="text-[10px] font-black uppercase tracking-widest text-neutral-400">{item.type || "Note"}</div>
        <h3 className="mt-1 text-base font-black text-neutral-900">{title}</h3>
      </div>
      <div className="grid min-w-0 max-w-full gap-3 md:grid-cols-2">
        <Detail label="From" value={item.from} />
        <Detail label="To" value={item.to} />
        <Detail label="Distance" value={item.distance} />
        <Detail label="Estimated Travel Time" value={item.estimatedTravelTime} />
      </div>
      {item.address ? <div className="mt-3 border-t border-neutral-100 pt-3 text-sm text-neutral-500">{item.address}</div> : null}
      {item.notes ? <div className="mt-3 whitespace-pre-line border-t border-neutral-100 pt-3 text-sm font-semibold text-neutral-900">{item.notes}</div> : null}
    </article>
  );
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
    <div className="space-y-6">
      {typeOrder.map((type) => {
        const typeItems = sorted.filter((item) => (item.type || "Note") === type);
        if (typeItems.length === 0) return null;

        return (
          <section key={type} className="min-w-0 max-w-full">
            <h3 className="mb-3 border-b border-neutral-200 pb-2 text-xs font-black uppercase tracking-widest text-neutral-700">{type}</h3>
            <div className="grid min-w-0 max-w-full gap-3 lg:grid-cols-2">
              {typeItems.map((item) => (
                <ImportantInfoCard key={item.id} item={item} />
              ))}
            </div>
          </section>
        );
      })}
    </div>
  );
}
